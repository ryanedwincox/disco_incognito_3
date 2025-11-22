from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class StorageAdapter(ABC):
    """Interface for session and room storage adapters."""

    @abstractmethod
    async def load(self) -> dict[str, Any]:
        """Return the full persisted state as a dictionary."""

    @abstractmethod
    async def save(self, state: dict[str, Any]) -> None:
        """Persist the entire state atomically."""

    @abstractmethod
    async def get_room(self, room_code: str) -> dict[str, Any] | None:
        """Fetch a single room by its code if present."""

    @abstractmethod
    async def upsert_room(self, room_code: str, data: dict[str, Any]) -> None:
        """Create or replace a room entry."""

    @abstractmethod
    async def delete_room(self, room_code: str) -> None:
        """Remove a room from storage."""
