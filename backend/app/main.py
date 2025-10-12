from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core.settings import settings
from .dependencies.storage import get_storage_adapter

app = FastAPI(title="Disco Incognito API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def ensure_storage_file() -> None:
    storage = get_storage_adapter()
    path_attr = getattr(storage, "path", None)
    if isinstance(path_attr, Path):
        path = path_attr
    else:
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("{}", encoding="utf-8")


@app.websocket("/api/ws/rooms/{room_code}/ws")
async def websocket_endpoint(websocket: WebSocket, room_code: str) -> None:
    await websocket.accept()
    try:
        await websocket.send_json({
            "type": "system",
            "message": "WebSocket placeholder for room",
            "room": room_code,
        })
        # TODO: Implement real-time room messaging in Phase 3.
        await websocket.close()
    except WebSocketDisconnect:
        # Connection closed by client; nothing to do yet.
        pass
