"""FastAPI application entry point for Disco Incognito backend.

Creates and configures the FastAPI app with CORS middleware, API routers, and WebSocket
endpoint. Handles application startup including storage file initialization.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

import logging

from .api.router import api_router
from .core.rate_limit import limiter
from .core.settings import settings
from .dependencies.storage import get_storage_adapter
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


@app.websocket('/api/ws/rooms/{room_code}/ws')
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    user_id: str,
    reconnect_token: str | None = None
) -> None:
    """WebSocket endpoint for real-time room communication.

    Connects user to room, broadcasts connect/disconnect events, and maintains
    connection for room updates. Supports reconnection via reconnect_token.

    Args:
        websocket: The WebSocket connection
        room_code: The room code to connect to
        user_id: The user's unique identifier (from query parameter)
        reconnect_token: Optional reconnection token for resuming a session
    """
    # If reconnect_token is provided, validate it
    if reconnect_token:
        logger.info(f'Reconnection attempt with token for user {user_id} in room {room_code}')
        validation = await connection_manager.validate_reconnect_token(reconnect_token)

        if not validation:
            # Invalid or expired token
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Invalid or expired reconnection token'
            })
            await websocket.close()
            return

        # Validate that the token matches the user and room
        if validation['user_id'] != user_id or validation['room_code'] != room_code:
            await websocket.accept()
            await websocket.send_json({
                'type': 'reconnect_failed',
                'reason': 'Reconnection token does not match user or room'
            })
            await websocket.close()
            return

        logger.info(f'Reconnection successful for user {user_id} in room {room_code}')

    # Connect the user
    connection_info = await connection_manager.connect(room_code, user_id, websocket, reconnect_token)

    # Send connection success with reconnect token
    await websocket.send_json({
        'type': 'connected',
        'reconnect_token': connection_info['reconnect_token']
    })

    # If this is a reconnection, send full room state
    if reconnect_token:
        storage = get_storage_adapter()
        room_data = await storage.get_room(room_code)
        if room_data:
            await websocket.send_json({
                'type': 'room_state',
                'data': room_data
            })

    try:
        # Keep connection alive and listen for messages
        while True:
            # Wait for any message from client (keepalive or future message types)
            data = await websocket.receive_text()
            # For now, we just maintain the connection
            # Future: handle client messages here
            logger.debug(f'Received message from user {user_id} in room {room_code}: {data}')

    except WebSocketDisconnect:
        logger.info(f'WebSocket disconnected for user {user_id} in room {room_code}')
    except Exception as e:
        logger.error(f'WebSocket error for user {user_id} in room {room_code}: {e}')
    finally:
        await connection_manager.disconnect(room_code, user_id)
