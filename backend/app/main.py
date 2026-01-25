"""FastAPI application entry point for Disco Incognito backend.

Creates and configures the FastAPI app with CORS middleware, API routers, and WebSocket
endpoints. Handles application startup including storage file initialization.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

import logging

from .api.router import api_router
from .core.rate_limit import limiter
from .core.settings import settings
from .dependencies.storage import get_storage_adapter
from .models.room import RoomState, RoomStateResponse
from .services.websocket_manager import get_connection_manager
from .storage.json_file import JSONFileStorage

logger = logging.getLogger(__name__)

app = FastAPI(title='Disco Incognito API', version='0.1.0')

# WebSocket connection manager (singleton)
connection_manager = get_connection_manager()

# Register rate limiter
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exceeded errors with 429 response."""
    return JSONResponse(
        status_code=429,
        content={'detail': 'Rate limit exceeded. Please try again later.'},
    )


# In test/debug mode, allow all origins for E2E testing with dynamic ports
cors_origins = ['*'] if settings.debug else settings.allowed_origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router)


@app.on_event('startup')
async def ensure_storage_file() -> None:
    storage = get_storage_adapter()
    path_attr = getattr(storage, 'path', None)
    if isinstance(path_attr, Path):
        path = path_attr
    else:
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text('{}', encoding='utf-8')


@app.on_event('startup')
async def cleanup_expired_rooms() -> None:
    """Clean up expired rooms on application startup."""
    storage = get_storage_adapter()
    if isinstance(storage, JSONFileStorage):
        deleted_count = await storage.cleanup_expired_rooms()
        if deleted_count > 0:
            logger.info(f'Cleaned up {deleted_count} expired room(s) on startup')


async def _find_user_session(user_id: str) -> dict[str, Any] | None:
    """Find session by user_id by scanning all sessions.

    Returns session data with 'access_token' key added, or None if not found.
    """
    storage = get_storage_adapter()
    state = await storage.load()
    sessions = state.get('sessions', {})

    for token, session_data in sessions.items():
        if session_data.get('user_id') == user_id:
            return {**session_data, 'access_token': token}
    return None


async def _build_client_state(user_id: str) -> dict[str, Any]:
    """Build client_state message for a user.

    Determines if user is in a room and includes full room data if so.
    Returns dict with: type, in_room, room_code?, phase?, room_data?
    """
    session = await _find_user_session(user_id)
    storage = get_storage_adapter()

    # Base response for user not in room
    result: dict[str, Any] = {
        'type': 'client_state',
        'in_room': False,
    }

    if not session:
        return result

    room_code = session.get('room_code')
    if not room_code:
        return result

    # Fetch room and verify user is still a player
    room_data = await storage.get_room(room_code)
    if not room_data:
        return result

    room = RoomState(**room_data)
    player = next((p for p in room.players if p.id == user_id), None)
    if not player:
        return result

    # User is in room - build full response
    room_response = RoomStateResponse.from_room_state(room)

    # Get assigned song for this player if in active round
    assigned_song = None
    playback_start_time = None
    if room.current_round:
        assigned_song = room.current_round.player_assignments.get(user_id)
        if room.current_round.playback_start_time:
            playback_start_time = room.current_round.playback_start_time.isoformat()

    result['in_room'] = True
    result['room_code'] = room_code
    # Normalize phase: backend may use 'reveal' internally, but client expects 'results'
    result['phase'] = 'results' if room.status == 'reveal' else room.status
    result['room_data'] = {
        'players': [p.model_dump() for p in room_response.players],
        'song_pair_count': len(room_response.songs),
        'host_id': room_response.host_id,
    }

    if assigned_song:
        result['room_data']['assigned_song'] = assigned_song.model_dump()

    if playback_start_time:
        result['room_data']['playback_start_time'] = playback_start_time

    return result


@app.websocket('/api/ws/client')
async def client_websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    reconnect_token: str | None = None
) -> None:
    """App-level WebSocket endpoint for client state and phase broadcasts.

    Connects without requiring room_code. On connect:
    1. Validates reconnect_token if provided
    2. Queries DB to find user's current room (if any)
    3. Sends client_state message with full room data

    Message types sent:
    - client_state: Initial state on connect
    - phase_changed: Room phase transitions (lobby, song_selection, playing, guessing, results)
    - player_connected/player_disconnected: Connection events
    - player_left: Player left room

    Query params:
        user_id: User's unique identifier
        reconnect_token: Optional token for session resumption
    """
    # Validate reconnect token if provided
    if reconnect_token:
        logger.info(f'Client WS reconnection attempt with token for user {user_id}')
        validation = await connection_manager.validate_reconnect_token(reconnect_token)

        if not validation:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Invalid or expired reconnection token'
            })
            await websocket.close()
            return

        if validation['user_id'] != user_id:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Reconnection token does not match user'
            })
            await websocket.close()
            return

        logger.info(f'Client WS reconnection successful for user {user_id}')

    await websocket.accept()

    # Build and send initial client state
    client_state = await _build_client_state(user_id)
    room_code = client_state.get('room_code')

    # Register connection with manager (for receiving broadcasts)
    connection_info = await connection_manager.connect_client(user_id, websocket, room_code)

    # Send connection success with reconnect token and client state
    await websocket.send_json({
        'type': 'connected',
        'reconnect_token': connection_info['reconnect_token']
    })
    await websocket.send_json(client_state)

    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f'Client WS received from user {user_id}: {data}')
    except WebSocketDisconnect:
        logger.info(f'Client WS disconnected for user {user_id}')
    except Exception as e:
        logger.error(f'Client WS error for user {user_id}: {e}')
    finally:
        await connection_manager.disconnect_client(user_id)


