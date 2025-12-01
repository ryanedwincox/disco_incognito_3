"""JSON file storage adapter with atomic writes and file locking.

Implements StorageAdapter persisting game state to a JSON file. Uses atomic writes
(temp file + rename) and FileLock for concurrent access safety. Suitable for development
and single-instance production deployments.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from filelock import FileLock


class DateTimeEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime objects."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

from .base import StorageAdapter

# Room expires after 60 minutes of inactivity
ROOM_EXPIRATION_MINUTES = 60


class JSONFileStorage(StorageAdapter):
    """Storage adapter that persists state to a JSON file atomically."""

    def __init__(self, path: Path, lock_timeout: float = 5.0) -> None:
        self._path = path
        self._lock = FileLock(f'{path}.lock', timeout=lock_timeout)

        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text('{}', encoding='utf-8')

    @property
    def path(self) -> Path:
        """Expose the backing file path for maintenance tasks."""
        return self._path

    async def load(self) -> dict[str, Any]:
        return await asyncio.to_thread(self._read_file)

    async def save(self, state: dict[str, Any]) -> None:
        await asyncio.to_thread(self._write_file, state)

    async def get_room(self, room_code: str) -> dict[str, Any] | None:
        state = await self.load()
        rooms = state.get('rooms', {})
        room = rooms.get(room_code)

        if room is None:
            return None

        # Check if room has expired (60 min inactivity)
        last_active = room.get('last_active_at')
        if last_active:
            # Parse ISO format timestamp
            if isinstance(last_active, str):
                last_active_dt = datetime.fromisoformat(last_active.replace('Z', '+00:00'))
            else:
                last_active_dt = last_active

            # Normalize to UTC for comparison
            if last_active_dt.tzinfo is None:
                last_active_dt = last_active_dt.replace(tzinfo=timezone.utc)

            expiration_threshold = datetime.now(timezone.utc) - timedelta(minutes=ROOM_EXPIRATION_MINUTES)
            if last_active_dt < expiration_threshold:
                # Room expired - delete it and return None
                await self.delete_room(room_code)
                return None

        return room

    async def upsert_room(self, room_code: str, data: dict[str, Any]) -> None:
        state = await self.load()
        rooms = state.setdefault('rooms', {})
        rooms[room_code] = data
        await self.save(state)

    async def delete_room(self, room_code: str) -> None:
        state = await self.load()
        rooms = state.get('rooms', {})
        if room_code in rooms:
            del rooms[room_code]
            await self.save(state)

    async def get_session(self, token: str) -> dict[str, Any] | None:
        state = await self.load()
        sessions = state.get('sessions', {})
        return sessions.get(token)

    async def set_session(self, token: str, data: dict[str, Any]) -> None:
        state = await self.load()
        sessions = state.setdefault('sessions', {})
        sessions[token] = data
        await self.save(state)

    async def delete_session(self, token: str) -> None:
        state = await self.load()
        sessions = state.get('sessions', {})
        if token in sessions:
            del sessions[token]
            await self.save(state)

    async def cleanup_expired_rooms(self) -> int:
        """Remove all expired rooms. Returns count of rooms deleted."""
        state = await self.load()
        rooms = state.get('rooms', {})

        if not rooms:
            return 0

        expiration_threshold = datetime.now(timezone.utc) - timedelta(minutes=ROOM_EXPIRATION_MINUTES)
        expired_codes: list[str] = []

        for room_code, room in rooms.items():
            last_active = room.get('last_active_at')
            if last_active:
                if isinstance(last_active, str):
                    last_active_dt = datetime.fromisoformat(last_active.replace('Z', '+00:00'))
                else:
                    last_active_dt = last_active

                if last_active_dt.tzinfo is None:
                    last_active_dt = last_active_dt.replace(tzinfo=timezone.utc)

                if last_active_dt < expiration_threshold:
                    expired_codes.append(room_code)

        if expired_codes:
            for code in expired_codes:
                del rooms[code]
            await self.save(state)

        return len(expired_codes)

    def _read_file(self) -> dict[str, Any]:
        with self._lock:
            if not self._path.exists():
                return {}
            raw = self._path.read_text(encoding='utf-8')
            return json.loads(raw or '{}')

    def _write_file(self, state: dict[str, Any]) -> None:
        serialized = json.dumps(state, indent=2, sort_keys=True, cls=DateTimeEncoder)
        with self._lock:
            with NamedTemporaryFile('w', delete=False, dir=self._path.parent, encoding='utf-8') as tmp:
                tmp.write(serialized)
                tmp.flush()
                temp_path = Path(tmp.name)
            temp_path.replace(self._path)
