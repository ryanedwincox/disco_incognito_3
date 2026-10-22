"""FastAPI application entry point for Disco Incognito backend.

Creates and configures the FastAPI app with CORS middleware, API routers, and WebSocket
endpoints. Handles application startup including storage file initialization.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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


async def ensure_storage_file() -> None:
    """Create the JSON storage file (and its directory) if it does not exist yet."""
    storage = get_storage_adapter()
    path_attr = getattr(storage, 'path', None)
    if isinstance(path_attr, Path):
        path = path_attr
    else:
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text('{}', encoding='utf-8')


async def cleanup_expired_rooms() -> None:
    """Clean up expired rooms on application startup."""
    storage = get_storage_adapter()
    if isinstance(storage, JSONFileStorage):
        deleted_count = await storage.cleanup_expired_rooms()
        if deleted_count > 0:
            logger.info(f'Cleaned up {deleted_count} expired room(s) on startup')


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Run startup tasks (replaces the deprecated @app.on_event('startup') hooks)."""
    await ensure_storage_file()
    await cleanup_expired_rooms()
    yield


app = FastAPI(title='Disco Incognito API', version='0.1.0', lifespan=lifespan)

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
# NOTE: Cannot use app.mount("/", StaticFiles(...)) because it catches WebSocket
# requests and crashes (StaticFiles asserts scope["type"] == "http").
# Instead, mount assets at /assets and add a catch-all route for SPA index.html.
static_dir = Path(__file__).parent.parent / 'static'
if static_dir.is_dir():
    app.mount('/assets', StaticFiles(directory=str(static_dir / 'assets')), name='static-assets')

    @app.get('/{full_path:path}')
    async def serve_spa(full_path: str) -> FileResponse:
        """Serve index.html for all non-API routes (SPA client-side routing)."""
        return FileResponse(str(static_dir / 'index.html'))


async def _build_room_state_for_user(room_code: str, user_id: str) -> dict[str, Any] | None:
    """Build a per-user tailored room_state message.

    Returns dict with: type, phase, players[], host_id, pair_count, assigned_song (for this user).
    Returns None when the room does not exist so the caller can send room_not_found.
    """
    storage = get_storage_adapter()
    room_data = await storage.get_room(room_code)

    if not room_data:
        return None

    room = RoomState(**room_data)

    # Normalize phase: backend may use 'reveal' internally, but client expects 'results'
    phase = 'results' if room.status == 'reveal' else room.status

    result: dict[str, Any] = {
        'type': 'room_state',
        'phase': phase,
        'players': [p.model_dump() for p in room.players],
        'host_id': room.host_id,
        'pair_count': len(room.song_pairs),
    }

    # Include assigned song for THIS user only (if in active round)
    if room.current_round:
        assigned_song = room.current_round.player_assignments.get(user_id)
        if assigned_song:
            result['assigned_song'] = assigned_song.model_dump()
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
    1. Validates reconnect_token if provided (30-min window)
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
        reconnect_token: Optional token for session resumption within 30-min window
    """
    is_reconnect = False

    # Validate reconnect token if provided
    if reconnect_token:
        logger.info(f'Room WS reconnection attempt for user {user_id} in room {room_code}')
        validation = await connection_manager.validate_reconnect_token(reconnect_token)

        if not validation:
            await websocket.accept()
            await websocket.send_json(
                {
                    'type': 'reconnect_failed',
                    'reason': 'Invalid or expired reconnection token',
                }
            )
            await websocket.close()
            return

        if validation['user_id'] != user_id:
            await websocket.accept()
            await websocket.send_json(
                {
                    'type': 'reconnect_failed',
                    'reason': 'Reconnection token does not match user',
                }
            )
            await websocket.close()
            return

        if validation.get('room_code') != room_code:
            await websocket.accept()
            await websocket.send_json(
                {
                    'type': 'reconnect_failed',
                    'reason': 'Reconnection token does not match room',
                }
            )
            await websocket.close()
            return

        is_reconnect = True
        logger.info(f'Room WS reconnection validated for user {user_id} in room {room_code}')

    # Accept and register
    await websocket.accept()
    connection_info = await connection_manager.connect(room_code, user_id, websocket)

    # Send connected message with reconnect token
    await websocket.send_json(
        {
            'type': 'connected',
            'reconnect_token': connection_info['reconnect_token'],
        }
    )

    # Send per-user room state (or signal room_not_found and close)
    room_state = await _build_room_state_for_user(room_code, user_id)
    if room_state is None:
        await websocket.send_json({'type': 'room_not_found', 'room_code': room_code})
        await websocket.close(code=4004)
        # Clean up the just-registered connection since the room doesn't exist
        await connection_manager.disconnect(room_code, user_id)
        return
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
            try:
                msg = json.loads(data)
                if msg.get('type') == 'ping':
                    await websocket.send_json({'type': 'pong'})
                    continue
            except (json.JSONDecodeError, TypeError):
                pass
            logger.debug(f'Room WS received from user {user_id} in room {room_code}: {data}')
    except WebSocketDisconnect:
        logger.info(f'Room WS disconnected for user {user_id} in room {room_code}')
    except Exception as e:
        logger.exception(f'Room WS error for user {user_id} in room {room_code}: {e}')
    finally:
        # Only disconnect if THIS websocket instance is still the registered one.
        # If a new socket replaced us (zombie eviction via connect()), our entry is gone
        # and disconnect() will no-op due to its idempotency guard.
        # disconnect() handles both the dict removal and player_disconnected broadcast.
        await connection_manager.disconnect(room_code, user_id)
