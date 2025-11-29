"""Room management routes.

Provides endpoints for creating and managing game rooms. Handles room creation,
player joining, and room state retrieval.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ...dependencies.auth import AuthenticatedUser, get_current_user
from ...dependencies.storage import get_storage_adapter
from ...models.room import Player, RoomState
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


@router.get('/{room_code}', summary='Get room by code')
async def get_room(
    room_code: str,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomState:
    """
    Fetch room state by room code.

    Returns room data including players list with host indicator.
    """
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    return RoomState(**room_data)


@router.post('/{room_code}/join', summary='Join a room')
async def join_room(
    room_code: str,
    body: JoinRoomRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomState:
    """
    Join an existing room.

    Adds player to room's players list if not already present.
    Returns updated room state.
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

    return room


@router.post('/{room_code}/start', summary='Start the game')
async def start_game(
    room_code: str,
    body: StartGameRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> RoomState:
    """
    Start the game (host only).

    Transitions room status from 'lobby' to 'song_selection'.
    Returns updated room state.
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

    # Transition to song_selection
    room.status = 'song_selection'

    # Save updated room
    await storage.upsert_room(room_code, room.model_dump(mode='json'))

    logger.info(f'Game started in room {room_code} by host {body.player_id}')

    return room
