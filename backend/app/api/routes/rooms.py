"""Room management routes.

Provides endpoints for creating and managing game rooms. Handles room creation,
player joining, and room state retrieval.
"""

import logging
import random
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ...core.rate_limit import RATE_LIMITS, limiter
from ...core.settings import settings
from ...dependencies.auth import AuthenticatedUser, get_current_user
from ...dependencies.storage import get_storage_adapter
from ...models.room import CurrentRound, Player, RoomState, RoomStateResponse, RoundResultsResponse, SongInfo, SongPair
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


class PlayerReadyRequest(BaseModel):
    """Request model for marking a player as ready."""

    player_id: str = Field(..., description='Player ID')


class VoteRequest(BaseModel):
    """Request model for casting a vote on who is the Dancer Incognito."""

    player_id: str = Field(..., description='Player ID casting the vote')
    guessed_player_id: str = Field(..., description='Player ID being guessed as Dancer Incognito')


class FinishRoundRequest(BaseModel):
    """Request model for finishing a round (host only)."""

    player_id: str = Field(..., description='Player ID (must be host)')


class CreateRoomResponse(BaseModel):
    """Response model for room creation."""

    code: str
    host_id: str
    players: list[dict]
    status: str


@router.post('', summary='Create a new room', response_model=CreateRoomResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def create_room(
    request: Request,
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

        # Create room state (last_active_at is set by default in RoomState)
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
@limiter.limit(RATE_LIMITS['rooms'])
async def get_room(
    request: Request,
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
@limiter.limit(RATE_LIMITS['rooms'])
async def join_room(
    request: Request,
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

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Player {body.player_id} joined room {room_code}')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/songs', summary='Add a song pair to room', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def add_song_pair(
    request: Request,
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

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Song pair {pair_id} added to room {room_code} by player {body.player_id}')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/start', summary='Start the game', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def start_game(
    request: Request,
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

    # Pick song pair (deterministic in test mode for reproducible E2E tests)
    if settings.spotify_mode.lower() == 'test':
        selected_pair = room.song_pairs[0]  # Always first pair
        incognito_player = room.players[0]  # Always first player (host)
        use_song_a_for_majority = True
    else:
        selected_pair = random.choice(room.song_pairs)
        incognito_player = random.choice(room.players)
        use_song_a_for_majority = random.choice([True, False])

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

    # Decide which song is for majority vs incognito
    if use_song_a_for_majority:
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

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Game started in room {room_code} by host {body.player_id}, incognito: {incognito_player.id}')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/ready', summary='Mark player as ready', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def mark_player_ready(
    request: Request,
    room_code: str,
    body: PlayerReadyRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Mark a player as ready to start playback.

    When all players are ready, transitions room status to 'playing'.
    Returns updated room state.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify room is in song_selection state
    if room.status != 'song_selection':
        raise HTTPException(status_code=400, detail=f'Cannot mark ready from {room.status} state')

    # Verify current_round exists
    if not room.current_round:
        raise HTTPException(status_code=400, detail='No active round')

    # Verify player is in room
    player = next((p for p in room.players if p.id == body.player_id), None)
    if not player:
        raise HTTPException(status_code=403, detail='Player not in room')

    # Add player to ready list if not already there
    if body.player_id not in room.current_round.ready_players:
        room.current_round.ready_players.append(body.player_id)

    # Check if all players are ready
    all_player_ids = {p.id for p in room.players}
    ready_player_ids = set(room.current_round.ready_players)
    all_ready = all_player_ids == ready_player_ids

    if all_ready:
        room.status = 'playing'
        logger.info(f'All players ready in room {room_code}, transitioning to playing')

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Player {body.player_id} marked ready in room {room_code} ({len(ready_player_ids)}/{len(all_player_ids)} ready)')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/vote', summary='Cast a vote for Dancer Incognito', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def cast_vote(
    request: Request,
    room_code: str,
    body: VoteRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Cast a vote for who the player thinks is the Dancer Incognito.

    Each player can only vote once. When all players have voted, transitions
    room status to 'results'.
    Returns updated room state.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify room is in playing or guessing state
    if room.status not in ('playing', 'guessing'):
        raise HTTPException(status_code=400, detail=f'Cannot vote from {room.status} state')

    # Verify current_round exists
    if not room.current_round:
        raise HTTPException(status_code=400, detail='No active round')

    # Verify voter is in room
    voter = next((p for p in room.players if p.id == body.player_id), None)
    if not voter:
        raise HTTPException(status_code=403, detail='Player not in room')

    # Verify guessed player is in room
    guessed = next((p for p in room.players if p.id == body.guessed_player_id), None)
    if not guessed:
        raise HTTPException(status_code=400, detail='Guessed player not in room')

    # Check if player already voted
    if body.player_id in room.current_round.votes:
        raise HTTPException(status_code=400, detail='Player has already voted')

    # Record the vote
    room.current_round.votes[body.player_id] = body.guessed_player_id

    # Transition to guessing if still playing
    if room.status == 'playing':
        room.status = 'guessing'

    # Check if all players have voted
    all_player_ids = {p.id for p in room.players}
    voted_player_ids = set(room.current_round.votes.keys())
    all_voted = all_player_ids == voted_player_ids

    if all_voted:
        room.status = 'results'
        logger.info(f'All players voted in room {room_code}, transitioning to results')

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Player {body.player_id} voted for {body.guessed_player_id} in room {room_code} ({len(voted_player_ids)}/{len(all_player_ids)} voted)')

    return RoomStateResponse.from_room_state(room)


@router.get('/{room_code}/results', summary='Get round results', response_model=RoundResultsResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def get_results(
    request: Request,
    room_code: str,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoundResultsResponse:
    """
    Get the round results after all players have voted.

    Reveals who the Dancer Incognito was, all votes, and who guessed correctly.
    Only available when room status is 'results'.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify room is in results state
    if room.status != 'results':
        raise HTTPException(status_code=400, detail=f'Results not available in {room.status} state')

    # Verify current_round exists
    if not room.current_round:
        raise HTTPException(status_code=400, detail='No active round')

    # Calculate correct guessers
    incognito_id = room.current_round.incognito_player_id
    correct_guessers = [
        voter_id
        for voter_id, guessed_id in room.current_round.votes.items()
        if guessed_id == incognito_id
    ]

    return RoundResultsResponse(
        incognito_player_id=incognito_id,
        votes=room.current_round.votes,
        correct_guessers=correct_guessers,
    )


@router.post('/{room_code}/finish-round', summary='Finish round and return to lobby', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def finish_round(
    request: Request,
    room_code: str,
    body: FinishRoundRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Finish the current round and return to lobby (host only).

    Removes the used song pair from the pool, resets room status to 'lobby',
    and clears the current round. Players can then start a new round if song pairs remain.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    room = RoomState(**room_data)

    # Verify requester is host
    if room.host_id != body.player_id:
        raise HTTPException(status_code=403, detail='Only the host can finish the round')

    # Verify room is in results state
    if room.status != 'results':
        raise HTTPException(status_code=400, detail=f'Cannot finish round from {room.status} state')

    # Verify current_round exists
    if not room.current_round:
        raise HTTPException(status_code=400, detail='No active round to finish')

    # Find and remove the used song pair by matching the song_for_majority track ID
    used_track_id = room.current_round.song_for_majority.id
    original_pair_count = len(room.song_pairs)
    room.song_pairs = [
        pair for pair in room.song_pairs
        if pair.track_a != used_track_id and pair.track_b != used_track_id
    ]

    if len(room.song_pairs) < original_pair_count:
        logger.info(f'Removed used song pair from room {room_code} ({original_pair_count} -> {len(room.song_pairs)} pairs)')

    # Reset room state for next round
    room.status = 'lobby'
    room.current_round = None
    room.dancer_incognito_player_id = None

    # Update last_active_at and save
    room.last_active_at = datetime.utcnow()
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Round finished in room {room_code} by host {body.player_id}')

    return RoomStateResponse.from_room_state(room)
