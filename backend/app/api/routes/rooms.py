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
