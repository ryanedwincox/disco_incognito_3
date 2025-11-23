"""
Room API routes for fetching room state.

Provides read-only access to room data for frontend rendering.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...dependencies.storage import get_storage_adapter
from ...models.room import RoomState

router = APIRouter(prefix='/rooms', tags=['Rooms'])
logger = logging.getLogger(__name__)


@router.get('/{room_code}', summary='Get room by code')
async def get_room(room_code: str) -> RoomState:
    """
    Fetch room state by room code.

    Returns room data including players list with host indicator.
    """
    storage = get_storage_adapter()
    room_data = await storage.get_room(room_code)

    if not room_data:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    return RoomState(**room_data)
