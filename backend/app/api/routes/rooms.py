"""
Room management routes for Disco Incognito.

Provides endpoints for fetching room state, including player lists and song pair counts.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...dependencies.storage import get_storage_adapter
from ...models.room import RoomState

router = APIRouter(prefix='/rooms', tags=['Rooms'])
logger = logging.getLogger(__name__)


@router.get('/{room_code}', summary='Get room state')
async def get_room(room_code: str) -> dict:
    """
    Fetch current room state by room code.

    Returns room data including players, song pair count, and status.

    Args:
        room_code: The 3-digit room code

    Returns:
        Room state with players and metadata

    Raises:
        HTTPException: 404 if room not found
    """
    storage = get_storage_adapter()
    room_data = await storage.get_room(room_code)

    if room_data is None:
        raise HTTPException(status_code=404, detail=f'Room {room_code} not found')

    try:
        room = RoomState.model_validate(room_data)
    except Exception as e:
        logger.error(f'Error validating room data for {room_code}: {e}')
        raise HTTPException(status_code=500, detail='Invalid room data')

    # Return room data in frontend-friendly format
    return {
        'code': room.code,
        'status': room.status,
        'players': [
            {
                'id': player.id,
                'name': player.display_name,
                'isHost': player.is_host,
                'isConnected': player.is_connected,
            }
            for player in room.players
        ],
        'songPairCount': len(room.song_pairs),
    }
