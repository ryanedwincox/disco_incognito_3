"""Storage adapter dependency injection.

Provides a singleton StorageAdapter instance for persisting room and session data.
Currently returns JSONFileStorage configured from application settings. Supports future
extension to other storage backends.
"""

from functools import lru_cache
from pathlib import Path

from ..core.settings import settings
from ..storage.json_file import JSONFileStorage
from ..storage.base import StorageAdapter


@lru_cache
def get_storage_adapter() -> StorageAdapter:
    """Return a singleton storage adapter instance."""
    data_path = Path(settings.session_storage_file).resolve()
    return JSONFileStorage(data_path)
