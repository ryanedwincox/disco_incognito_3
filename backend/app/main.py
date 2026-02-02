"""FastAPI application entry point for Disco Incognito backend.

Creates and configures the FastAPI app with CORS middleware, API routers, and WebSocket
endpoints. Handles application startup including storage file initialization.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from .api.router import api_router
from .core.rate_limit import limiter
from .core.settings import settings
from .dependencies.storage import get_storage_adapter
from .models.room import RoomState
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

# Serve frontend static files in production (built into static/ by Docker)
static_dir = Path(__file__).parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


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


async def _build_room_state_for_user(room_code: str, user_id: str) -> dict[str, Any]:
    """Build a per-user tailored room_state message.

    Returns dict with: type, phase, players[], host_id, song_pair_count, assigned_song (for this user).
    """
    storage = get_storage_adapter()
    room_data = await storage.get_room(room_code)

    if not room_data:
        return {
            'type': 'room_state',
            'phase': 'lobby',
            'players': [],
            'host_id': None,
            'song_pair_count': 0,
        }

    room = RoomState(**room_data)

    # Normalize phase: backend may use 'reveal' internally, but client expects 'results'
    phase = 'results' if room.status == 'reveal' else room.status

    result: dict[str, Any] = {
        'type': 'room_state',
        'phase': phase,
        'players': [p.model_dump() for p in room.players],
        'host_id': room.host_id,
        'song_pair_count': len(room.songs),
    }

    # Include assigned song for THIS user only (if in active round)
    if room.current_round:
        assigned_song = room.current_round.player_assignments.get(user_id)
        if assigned_song:
            result['assigned_song'] = assigned_song.model_dump()
        if room.current_round.playback_start_time:
            result['playback_start_time'] = room.current_round.playback_start_time.isoformat()
        result['ready_players'] = room.current_round.ready_players

    return result


@app.websocket('/api/ws/room/{room_code}')
async def room_websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    user_id: str,
    reconnect_token: str | None = None,
) -> None:
    """Room-scoped WebSocket endpoint.

    On connect:
    1. Validates reconnect_token if provided (5-min window)
    2. Accepts WebSocket, registers with connection manager
    3. Sends 'connected' with reconnect_token, then 'room_state' with per-user data
    4. Broadcasts player_connected to room (unless reconnecting)

    Message types sent:
    - connected: Initial handshake with reconnect_token
    - reconnect_failed: Token invalid/expired
    - room_state: Full room state tailored per-user
    - phase_changed: Room phase transitions
    - player_connected/player_disconnected: Connection events
    - player_left/player_joined: Room membership changes

    Query params:
        user_id: User's unique identifier
        reconnect_token: Optional token for session resumption within 5-min window
    """
    is_reconnect = False

    # Validate reconnect token if provided
    if reconnect_token:
        logger.info(f'Room WS reconnection attempt for user {user_id} in room {room_code}')
        validation = await connection_manager.validate_reconnect_token(reconnect_token)

        if not validation:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Invalid or expired reconnection token',
            })
            await websocket.close()
            return

        if validation['user_id'] != user_id:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Reconnection token does not match user',
            })
            await websocket.close()
            return

        if validation.get('room_code') != room_code:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Reconnection token does not match room',
            })
            await websocket.close()
            return

        is_reconnect = True
        logger.info(f'Room WS reconnection validated for user {user_id} in room {room_code}')

    # Accept and register
    await websocket.accept()
    connection_info = await connection_manager.connect(room_code, user_id, websocket)

    # Send connected message with reconnect token
    await websocket.send_json({
        'type': 'connected',
        'reconnect_token': connection_info['reconnect_token'],
    })

    # Send per-user room state
    room_state = await _build_room_state_for_user(room_code, user_id)
    await websocket.send_json(room_state)

    # Broadcast player_connected (skip if reconnecting - they were already in room)
    if not is_reconnect:
        await connection_manager.broadcast_to_room(
            room_code,
            {
                'type': 'player_connected',
                'user_id': user_id,
            },
        )

    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f'Room WS received from user {user_id} in room {room_code}: {data}')
    except WebSocketDisconnect:
        logger.info(f'Room WS disconnected for user {user_id} in room {room_code}')
    except Exception as e:
        logger.exception(f'Room WS error for user {user_id} in room {room_code}: {e}')
    finally:
        await connection_manager.disconnect(room_code, user_id)
        # Broadcast player_disconnected to remaining players
        await connection_manager.broadcast_to_room(
            room_code,
            {
                'type': 'player_disconnected',
                'user_id': user_id,
            },
        )
