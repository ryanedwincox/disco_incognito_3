from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class StorageAdapter(ABC):
    """Interface for session and room storage adapters."""

    @abstractmethod
    async def load(self) -> Dict[str, Any]:
        """Return the full persisted state as a dictionary."""

    @abstractmethod
    async def save(self, state: Dict[str, Any]) -> None:
        """Persist the entire state atomically."""

    @abstractmethod
    async def get_room(self, room_code: str) -> Optional[Dict[str, Any]]:
        """Fetch a single room by its code if present."""

    @abstractmethod
    async def upsert_room(self, room_code: str, data: Dict[str, Any]) -> None:
        """Create or replace a room entry."""

    @abstractmethod
    async def delete_room(self, room_code: str) -> None:
        """Remove a room from storage."""
