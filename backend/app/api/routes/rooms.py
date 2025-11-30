"""Room management routes.

Provides endpoints for creating and managing game rooms. Handles room creation,
player joining, and room state retrieval.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import random
import uuid

from ...dependencies.auth import AuthenticatedUser, get_current_user
from ...dependencies.storage import get_storage_adapter
from ...models.room import CurrentRound, Player, RoomState, RoomStateResponse, SongInfo, SongPair
from ...storage.base import StorageAdapter

router = APIRouter(prefix='/rooms', tags=['Rooms'])
logger = logging.getLogger(__name__)


class CreateRoomRequest(BaseModel):
    """Request model for creating a new room."""

    room_code: str = Field(..., min_length=3, max_length=3, pattern=r'^\d{3}$', description='3-digit room code')


class JoinRoomRequest(BaseModel):
    """Request model for joining a room."""

    player_id: str = Field(..., description='Player ID')
    display_name: str = Field(..., description='Player display name')


class StartGameRequest(BaseModel):
    """Request model for starting a game."""

    player_id: str = Field(..., description='Player ID (must be host)')


class AddSongPairRequest(BaseModel):
    """Request model for adding a song pair to a room."""

    player_id: str = Field(..., description='Player ID')
    track_a: str = Field(..., description='Spotify URI for track A')
    track_b: str = Field(..., description='Spotify URI for track B')
    title_a: str = Field(..., description='Title of track A')
    artist_a: str = Field(..., description='Artist of track A')
    title_b: str = Field(..., description='Title of track B')
    artist_b: str = Field(..., description='Artist of track B')


class CreateRoomResponse(BaseModel):
    """Response model for room creation."""

    code: str
    host_id: str
    players: list[dict]
    status: str


@router.post('', summary='Create a new room', response_model=CreateRoomResponse)
async def create_room(
    body: CreateRoomRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CreateRoomResponse:
    """
    Create a new game room.

    Creates a room with the specified code and adds the current user as host.
    Room code must be a 3-digit number.

    Returns:
        Created room data including code, host_id, players list, and status.
    """
    try:
        # Check if room already exists
        existing_room = await storage.get_room(body.room_code)
        if existing_room:
            raise HTTPException(status_code=409, detail='Room already exists')

        # Create host player
        host_player = Player(
            id=current_user.user_id,
            display_name=current_user.display_name,
            is_host=True,
            is_connected=True,
        )

        # Create room state
        room = RoomState(
            code=body.room_code,
            host_id=current_user.user_id,
            players=[host_player],
            status='lobby',
        )

        # Store the room
        await storage.upsert_room(body.room_code, room.model_dump(mode='json'))

        logger.info(f'Room {body.room_code} created by user {current_user.user_id}')

        return CreateRoomResponse(
            code=room.code,
            host_id=room.host_id,
            players=[p.model_dump() for p in room.players],
            status=room.status,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error creating room: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Failed to create room')


@router.get('/{room_code}', summary='Get room by code', response_model=RoomStateResponse)
async def get_room(
    room_code: str,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Fetch room state by room code.

    Returns room data including players list with host indicator.
    Security: Excludes incognito player identity from response.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)
    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/join', summary='Join a room', response_model=RoomStateResponse)
async def join_room(
    room_code: str,
    body: JoinRoomRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Join an existing room.

    Adds player to room's players list if not already present.
    Returns updated room state.
    Security: Excludes incognito player identity from response.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Check if player already in room
    existing_player = next((p for p in room.players if p.id == body.player_id), None)
    if existing_player:
        # Update connection status if rejoining
        existing_player.is_connected = True
    else:
        # Add new player
        new_player = Player(
            id=body.player_id,
            display_name=body.display_name,
            is_host=False,
            is_connected=True,
        )
        room.players.append(new_player)

    # Save updated room
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Player {body.player_id} joined room {room_code}')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/songs', summary='Add a song pair to room', response_model=RoomStateResponse)
async def add_song_pair(
    room_code: str,
    body: AddSongPairRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Add a song pair to the room.

    Creates a SongPair and adds it to the room's song_pairs list.
    Returns updated room state.
    Security: Excludes incognito player identity from response.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify player is in room
    player = next((p for p in room.players if p.id == body.player_id), None)
    if not player:
        raise HTTPException(status_code=403, detail='Player not in room')

    # Create song pair
    pair_id = f'pair-{uuid.uuid4().hex[:8]}'
    song_pair = SongPair(
        id=pair_id,
        track_a=body.track_a,
        track_b=body.track_b,
        title_a=body.title_a,
        artist_a=body.artist_a,
        title_b=body.title_b,
        artist_b=body.artist_b,
        added_by=body.player_id,
    )
    room.song_pairs.append(song_pair)

    # Save updated room
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Song pair {pair_id} added to room {room_code} by player {body.player_id}')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/start', summary='Start the game', response_model=RoomStateResponse)
async def start_game(
    room_code: str,
    body: StartGameRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Start the game (host only).

    Picks a random song pair, assigns incognito player, and assigns songs to all players.
    Transitions room status from 'lobby' to 'song_selection'.
    Returns updated room state.
    Security: Excludes incognito player identity from response. Players can only see
    their own song assignment via current_round.player_assignments[player_id].
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify requester is host
    if room.host_id != body.player_id:
        raise HTTPException(status_code=403, detail='Only the host can start the game')

    # Verify room is in lobby state
    if room.status != 'lobby':
        raise HTTPException(status_code=400, detail=f'Cannot start game from {room.status} state')

    # Verify there's at least one song pair
    if not room.song_pairs:
        raise HTTPException(status_code=400, detail='Need at least one song pair to start the game')

    # Pick random song pair
    selected_pair = random.choice(room.song_pairs)

    # Randomly select incognito player
    incognito_player = random.choice(room.players)

    # Create SongInfo objects for the two songs
    song_a = SongInfo(
        id=selected_pair.track_a,
        title=selected_pair.title_a,
        artist=selected_pair.artist_a,
    )
    song_b = SongInfo(
        id=selected_pair.track_b,
        title=selected_pair.title_b,
        artist=selected_pair.artist_b,
    )

    # Randomly decide which song is for majority vs incognito
    if random.choice([True, False]):
        song_for_majority, song_for_incognito = song_a, song_b
    else:
        song_for_majority, song_for_incognito = song_b, song_a

    # Build player_assignments: incognito gets song_for_incognito, others get song_for_majority
    player_assignments: dict[str, SongInfo] = {}
    for player in room.players:
        if player.id == incognito_player.id:
            player_assignments[player.id] = song_for_incognito
        else:
            player_assignments[player.id] = song_for_majority

    # Create CurrentRound
    room.current_round = CurrentRound(
        song_for_majority=song_for_majority,
        song_for_incognito=song_for_incognito,
        incognito_player_id=incognito_player.id,
        player_assignments=player_assignments,
    )

    # Transition to song_selection
    room.status = 'song_selection'
    room.dancer_incognito_player_id = incognito_player.id

    # Save updated room
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Game started in room {room_code} by host {body.player_id}, incognito: {incognito_player.id}')

    return RoomStateResponse.from_room_state(room)
