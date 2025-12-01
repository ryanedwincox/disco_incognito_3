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
from .storage.json_file import JSONFileStorage

logger = logging.getLogger(__name__)

app = FastAPI(title='Disco Incognito API', version='0.1.0')

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
async def websocket_endpoint(websocket: WebSocket, room_code: str) -> None:
    await websocket.accept()
    try:
        await websocket.send_json(
            {
                'type': 'system',
                'message': 'WebSocket placeholder for room',
                'room': room_code,
            }
        )
        # TODO: Implement real-time room messaging in Phase 3.
        await websocket.close()
    except WebSocketDisconnect:
        # Connection closed by client; nothing to do yet.
        pass
