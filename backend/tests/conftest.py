"""Shared test fixtures for backend tests.

Provides MockStorage (in-memory storage adapter) and auth_header helper
used across multiple test modules.
"""

from __future__ import annotations

from typing import Any

import pytest


class MockStorage:
    """In-memory mock storage for testing."""

    def __init__(self) -> None:
        self.rooms: dict[str, Any] = {}
        self.sessions: dict[str, Any] = {}

    async def load(self) -> dict[str, Any]:
        return {'rooms': self.rooms, 'sessions': self.sessions}

    async def save(self, state: dict[str, Any]) -> None:
        self.rooms = state.get('rooms', {})
        self.sessions = state.get('sessions', {})

    async def get_room(self, room_code: str) -> dict[str, Any] | None:
        return self.rooms.get(room_code)

    async def upsert_room(self, room_code: str, data: dict[str, Any]) -> None:
        self.rooms[room_code] = data

    async def delete_room(self, room_code: str) -> None:
        self.rooms.pop(room_code, None)

    async def get_session(self, token: str) -> dict[str, Any] | None:
        return self.sessions.get(token)

    async def set_session(self, token: str, data: dict[str, Any]) -> None:
        self.sessions[token] = data

    async def delete_session(self, token: str) -> None:
        self.sessions.pop(token, None)


@pytest.fixture
def mock_storage() -> MockStorage:
    """Create a fresh mock storage instance."""
    return MockStorage()


def auth_header(token: str) -> dict[str, str]:
    """Helper to create Authorization header."""
    return {'Authorization': f'Bearer {token}'}
