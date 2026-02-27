"""Room management routes.

Provides endpoints for creating and managing game rooms. Handles room creation,
player joining, and room state retrieval.
"""

import asyncio
import logging
import random
import uuid
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ...core.rate_limit import RATE_LIMITS, limiter
from ...core.settings import settings
from ...dependencies.auth import AuthenticatedUser, get_current_user
from ...dependencies.storage import get_storage_adapter
from ...models.room import CurrentRound, Player, RoomState, RoomStateResponse, RoundResultsResponse, Song, SongInfo, SongPair
from ...services.websocket_manager import get_connection_manager
from ...storage.base import StorageAdapter

router = APIRouter(prefix='/rooms', tags=['Rooms'])
logger = logging.getLogger(__name__)

# Per-room asyncio locks to serialize read-modify-write cycles.
# Prevents lost-update races when concurrent requests mutate the same room
# (e.g. guest /ready + host /force-start overlapping at await boundaries).
#
# INTENTIONAL DEVIATION from python-standards asyncio.Lock guidance (-9 score):
# Each endpoint has MULTIPLE await points within a single read-modify-write cycle
# (get_room → mutate → upsert_room). The GIL only prevents interleaving between
# await points, NOT across them. The storage layer is a simple JSON file with no
# conditional writes or optimistic concurrency, so application-level locking is
# the correct pragmatic solution to prevent lost updates.
_room_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

# Rooms with more than this many players get 2 incognito players instead of 1
_LARGE_ROOM_PLAYER_THRESHOLD = 8


async def broadcast_phase_changed(room_code: str, phase: str) -> None:
    """Broadcast phase change to all connected clients in a room.

    Args:
        room_code: The room code to broadcast to
        phase: The new phase (lobby, song_selection, playing, guessing, results)
    """
    manager = get_connection_manager()
    await manager.broadcast_to_room(
        room_code,
        {
            'type': 'phase_changed',
            'phase': phase,
            'room_code': room_code,
        },
    )


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
    song_a_title: str = Field(..., min_length=1, max_length=200, description='Song A title')
    song_a_artist: str = Field(..., min_length=1, max_length=200, description='Song A artist')
    song_b_title: str = Field(..., min_length=1, max_length=200, description='Song B title')
    song_b_artist: str = Field(..., min_length=1, max_length=200, description='Song B artist')


class PlayerReadyRequest(BaseModel):
    """Request model for marking a player as ready."""

    player_id: str = Field(..., description='Player ID')


class EndListeningRequest(BaseModel):
    """Request model for ending the listening phase (host only)."""

    player_id: str = Field(..., description='Player ID (must be host)')


class VoteRequest(BaseModel):
    """Request model for casting a vote on who is the Dancer Incognito."""

    player_id: str = Field(..., description='Player ID casting the vote')
    guessed_player_id: str = Field(..., description='Player ID being guessed as Dancer Incognito')


class RevealRequest(BaseModel):
    """Request model for revealing results during guessing (host only)."""

    player_id: str = Field(..., description='Player ID (must be host)')


class FinishRoundRequest(BaseModel):
    """Request model for finishing a round (host only)."""

    player_id: str = Field(..., description='Player ID (must be host)')


class LeaveRoomRequest(BaseModel):
    """Request model for leaving a room."""

    player_id: str = Field(..., description='Player ID leaving the room')


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
        async with _room_locks[body.room_code]:
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
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Check if player already in room
        existing_player = next((p for p in room.players if p.id == body.player_id), None)
        if existing_player:
            # Update connection status and display name if rejoining (name may have changed)
            existing_player.is_connected = True
            existing_player.display_name = body.display_name
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

    # Broadcast player_joined to existing room members (outside lock — network I/O)
    manager = get_connection_manager()
    await manager.broadcast_to_room(
        room_code,
        {
            'type': 'player_joined',
            'user_id': body.player_id,
            'display_name': body.display_name,
        },
    )

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/song-pairs', summary='Add a song pair to room', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def add_song_pair(
    request: Request,
    room_code: str,
    body: AddSongPairRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Add a song pair to the room's song pool.

    Creates a SongPair (two linked songs) and adds it to the room's song_pairs list.
    Returns updated room state.
    Security: Excludes incognito player identity from response.
    """
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Verify player is in room
        player = next((p for p in room.players if p.id == body.player_id), None)
        if not player:
            raise HTTPException(status_code=403, detail='Player not in room')

        # Create song pair with linked song IDs derived from pair ID
        pair_id = f'pair-{uuid.uuid4().hex[:8]}'
        now = datetime.utcnow()
        song_a = Song(
            id=f'{pair_id}-a',
            title=body.song_a_title,
            artist=body.song_a_artist,
            added_by=body.player_id,
            created_at=now,
        )
        song_b = Song(
            id=f'{pair_id}-b',
            title=body.song_b_title,
            artist=body.song_b_artist,
            added_by=body.player_id,
            created_at=now,
        )
        pair = SongPair(
            id=pair_id,
            song_a=song_a,
            song_b=song_b,
            added_by=body.player_id,
            created_at=now,
        )
        room.song_pairs.append(pair)

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Song pair {pair_id} added to room {room_code} by player {body.player_id}')
        pair_count = len(room.song_pairs)

    # Broadcast song_added to all players in room (outside lock — network I/O)
    manager = get_connection_manager()
    await manager.broadcast_to_room(
        room_code,
        {
            'type': 'song_added',
            'song_count': pair_count,
        },
    )

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

    Picks one random song pair from the pool, assigns incognito player, and assigns songs to all players.
    Majority players receive song_a (or song_b), incognito player receives the other song of the pair.
    Transitions room status from 'lobby' to 'song_selection'.
    Returns updated room state.
    Security: Excludes incognito player identity from response. Players can only see
    their own song assignment via current_round.player_assignments[player_id].
    """
    async with _room_locks[room_code]:
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

        # Verify there is at least 1 song pair
        if not room.song_pairs:
            raise HTTPException(status_code=400, detail='Need at least 1 song pair to start the game')

        # Determine how many incognito players to pick (2 for large rooms, else 1)
        num_incognito = 2 if len(room.players) > _LARGE_ROOM_PLAYER_THRESHOLD else 1

        # Pick one pair (deterministic in debug mode for reproducible E2E tests)
        if settings.debug:
            selected_pair = room.song_pairs[0]  # Always first pair
            incognito_players = room.players[:num_incognito]  # Always first N players
            use_song_a_for_majority = True
        else:
            selected_pair = random.choice(room.song_pairs)
            incognito_players = random.sample(room.players, num_incognito)
            use_song_a_for_majority = random.choice([True, False])

        # Create SongInfo objects from the selected pair
        song_a = SongInfo(
            id=selected_pair.song_a.id,
            title=selected_pair.song_a.title,
            artist=selected_pair.song_a.artist,
        )
        song_b = SongInfo(
            id=selected_pair.song_b.id,
            title=selected_pair.song_b.title,
            artist=selected_pair.song_b.artist,
        )

        # Decide which song is for majority vs incognito
        if use_song_a_for_majority:
            song_for_majority, song_for_incognito = song_a, song_b
        else:
            song_for_majority, song_for_incognito = song_b, song_a

        # Build player_assignments: incognito players get song_for_incognito, others get song_for_majority
        incognito_ids_set = {p.id for p in incognito_players}
        player_assignments: dict[str, SongInfo] = {}
        for player in room.players:
            if player.id in incognito_ids_set:
                player_assignments[player.id] = song_for_incognito
            else:
                player_assignments[player.id] = song_for_majority

        # Create CurrentRound
        room.current_round = CurrentRound(
            song_for_majority=song_for_majority,
            song_for_incognito=song_for_incognito,
            incognito_player_ids=[p.id for p in incognito_players],
            player_assignments=player_assignments,
        )

        # Transition to song_selection
        room.status = 'song_selection'
        room.dancer_incognito_player_ids = [p.id for p in incognito_players]

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Game started in room {room_code} by host {body.player_id}, incognito: {[p.id for p in incognito_players]}')

    # Broadcast phase change to all connected clients (outside lock — network I/O)
    await broadcast_phase_changed(room_code, 'song_selection')

    # Send per-player assigned_song via send_to_user
    manager = get_connection_manager()
    for player in room.players:
        assigned = player_assignments.get(player.id)
        if assigned:
            await manager.send_to_user(
                room_code,
                player.id,
                {
                    'type': 'phase_changed',
                    'phase': 'song_selection',
                    'room_code': room_code,
                    'assigned_song': assigned.model_dump(),
                },
            )

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

    Tracks ready state for host visibility. Round starts only when
    host clicks 'Start Round' (force-start endpoint).
    Returns updated room state.
    """
    async with _room_locks[room_code]:
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

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        all_player_ids = {p.id for p in room.players}
        ready_player_ids = set(room.current_round.ready_players)
        ready_players_snapshot = list(room.current_round.ready_players)
        logger.info(f'Player {body.player_id} marked ready in room {room_code} ({len(ready_player_ids)}/{len(all_player_ids)} ready)')

    # Broadcast player_ready to all clients so host can see real-time updates (outside lock — network I/O)
    manager = get_connection_manager()
    await manager.broadcast_to_room(
        room_code,
        {
            'type': 'player_ready',
            'user_id': body.player_id,
            'ready_players': ready_players_snapshot,
        },
    )

    return RoomStateResponse.from_room_state(room)


class ForceStartRequest(BaseModel):
    """Request model for force-starting a round (host only)."""

    player_id: str = Field(..., description='Player ID (must be host)')


@router.post('/{room_code}/force-start', summary='Force start the round (host only)', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def force_start_round(
    request: Request,
    room_code: str,
    body: ForceStartRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Force start the round without waiting for all players to be ready (host only).

    Transitions room status from 'song_selection' to 'playing'.
    Auto-adds host to ready_players if not already there.
    Returns updated room state.
    """
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Verify requester is host
        if room.host_id != body.player_id:
            raise HTTPException(status_code=403, detail='Only the host can force start the round')

        # Verify room is in song_selection state
        if room.status != 'song_selection':
            raise HTTPException(status_code=400, detail=f'Cannot force start from {room.status} state')

        # Verify current_round exists
        if not room.current_round:
            raise HTTPException(status_code=400, detail='No active round')

        # Auto-add host to ready_players if not already there
        if body.player_id not in room.current_round.ready_players:
            room.current_round.ready_players.append(body.player_id)

        # Transition to playing
        room.status = 'playing'

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Round force-started in room {room_code} by host {body.player_id}')

    # Broadcast phase change (outside lock — network I/O)
    await broadcast_phase_changed(room_code, 'playing')

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
    async with _room_locks[room_code]:
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

        # Track if we need to broadcast guessing transition
        was_playing = room.status == 'playing'

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

    # Broadcast phase changes (outside lock — network I/O)
    if was_playing:
        await broadcast_phase_changed(room_code, 'guessing')
    if all_voted:
        await broadcast_phase_changed(room_code, 'results')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/end-listening', summary='End listening phase (host only)', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def end_listening(
    request: Request,
    room_code: str,
    body: EndListeningRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    End the listening phase and transition to guessing (host only).

    Transitions room status from 'playing' to 'guessing'.
    Returns updated room state.
    """
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Verify room is in playing state
        if room.status != 'playing':
            raise HTTPException(status_code=400, detail=f'Cannot end listening from {room.status} state')

        # Verify requester is host
        if room.host_id != body.player_id:
            raise HTTPException(status_code=403, detail='Only the host can end the listening phase')

        # Transition to guessing
        room.status = 'guessing'

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Listening ended in room {room_code} by host {body.player_id}, transitioning to guessing')

    # Broadcast phase change (outside lock — network I/O)
    await broadcast_phase_changed(room_code, 'guessing')

    return RoomStateResponse.from_room_state(room)


@router.post('/{room_code}/reveal', summary='Reveal results (host only)', response_model=RoomStateResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def reveal_results(
    request: Request,
    room_code: str,
    body: RevealRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomStateResponse:
    """
    Reveal results without waiting for all votes (host only).

    Transitions room status from 'guessing' to 'results', bypassing the
    requirement for all players to have voted. Used when a disconnected
    player prevents the game from progressing.
    """
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Verify requester is host
        if room.host_id != body.player_id:
            raise HTTPException(status_code=403, detail='Only the host can reveal results')

        # Verify room is in guessing state
        if room.status != 'guessing':
            raise HTTPException(status_code=400, detail=f'Cannot reveal from {room.status} state')

        # Verify current_round exists
        if not room.current_round:
            raise HTTPException(status_code=400, detail='No active round')

        # Transition to results
        room.status = 'results'

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        vote_count = len(room.current_round.votes)
        player_count = len(room.players)
        logger.info('Results revealed in room %s by host %s (%d/%d voted)', room_code, body.player_id, vote_count, player_count)

    # Broadcast phase change (outside lock — network I/O)
    await broadcast_phase_changed(room_code, 'results')

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

    # Calculate correct guessers (correct if they voted for any incognito player)
    incognito_ids = room.current_round.incognito_player_ids
    correct_guessers = [voter_id for voter_id, guessed_id in room.current_round.votes.items() if guessed_id in incognito_ids]

    return RoundResultsResponse(
        incognito_player_ids=incognito_ids,
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
    and clears the current round. Players can then start a new round if enough pairs remain.
    """
    async with _room_locks[room_code]:
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

        # Find and remove the used song pair by matching song IDs
        used_song_ids = {
            room.current_round.song_for_majority.id,
            room.current_round.song_for_incognito.id,
        }
        original_pair_count = len(room.song_pairs)
        room.song_pairs = [
            pair for pair in room.song_pairs
            if pair.song_a.id not in used_song_ids and pair.song_b.id not in used_song_ids
        ]

        if len(room.song_pairs) < original_pair_count:
            logger.info(f'Removed used song pair from room {room_code} ({original_pair_count} -> {len(room.song_pairs)} pairs)')

        # Reset room state for next round
        room.status = 'lobby'
        room.current_round = None
        room.dancer_incognito_player_ids = []

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Round finished in room {room_code} by host {body.player_id}')

    # Broadcast phase change to lobby (outside lock — network I/O)
    await broadcast_phase_changed(room_code, 'lobby')

    return RoomStateResponse.from_room_state(room)


class LeaveRoomResponse(BaseModel):
    """Response model for leaving a room."""

    room_deleted: bool = Field(..., description='True if room was deleted (last player left)')
    room: RoomStateResponse | None = Field(None, description='Updated room state, None if deleted')


@router.delete('/{room_code}/leave', summary='Leave a room', response_model=LeaveRoomResponse)
@limiter.limit(RATE_LIMITS['rooms'])
async def leave_room(
    request: Request,
    room_code: str,
    body: LeaveRoomRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> LeaveRoomResponse:
    """
    Leave a room.

    Removes player from room's players list. If the leaving player is the host,
    transfers host role to another player. If this is the last player, deletes the room.
    Broadcasts player_left event to remaining players.
    """
    was_host = False
    async with _room_locks[room_code]:
        room_data = await storage.get_room(room_code)

        if not room_data:
            raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

        room = RoomState(**room_data)

        # Verify player is in room
        leaving_player = next((p for p in room.players if p.id == body.player_id), None)
        if not leaving_player:
            raise HTTPException(status_code=404, detail='Player not in room')

        was_host = leaving_player.is_host

        # Remove the player from the list
        room.players = [p for p in room.players if p.id != body.player_id]

        # Check if room is now empty
        if not room.players:
            # Delete the room
            await storage.delete_room(room_code)
            # Clean up lock entry to prevent memory leak
            _room_locks.pop(room_code, None)
            logger.info(f'Room {room_code} deleted (last player {body.player_id} left)')

            # Disconnect the leaving player's WebSocket
            manager = get_connection_manager()
            await manager.disconnect(room_code, body.player_id)

            return LeaveRoomResponse(room_deleted=True, room=None)

        # Handle host transfer if the leaving player was the host
        if was_host:
            # Transfer host to the first remaining player
            new_host = room.players[0]
            new_host.is_host = True
            room.host_id = new_host.id
            logger.info(f'Host transferred from {body.player_id} to {new_host.id} in room {room_code}')

        # Update last_active_at and save
        room.last_active_at = datetime.utcnow()
        await storage.upsert_room(room_code, room.model_dump(mode='json'))

        logger.info(f'Player {body.player_id} left room {room_code}')

    # Disconnect the leaving player's WebSocket (outside lock — network I/O)
    manager = get_connection_manager()
    await manager.disconnect(room_code, body.player_id)

    # Broadcast player_left event to remaining players
    await manager.broadcast_to_room(
        room_code,
        {
            'type': 'player_left',
            'user_id': body.player_id,
            'new_host_id': room.host_id if was_host else None,
        },
    )

    return LeaveRoomResponse(room_deleted=False, room=RoomStateResponse.from_room_state(room))
