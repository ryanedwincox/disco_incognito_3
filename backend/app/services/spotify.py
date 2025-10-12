from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..dependencies.music import get_music_adapter
from ..music.base import MusicStreamingAdapter

logger = logging.getLogger(__name__)


class SpotifyAuthService:
    """
    Service for handling music streaming authentication and operations.

    This service now uses the adapter pattern to support multiple music streaming
    services (Spotify, Apple Music, etc.) and test mode for development.
    """

    def __init__(self, adapter: Optional[MusicStreamingAdapter] = None) -> None:
        """
        Initialize the auth service with a music streaming adapter.

        Args:
            adapter: Optional music streaming adapter. If not provided,
                    the default adapter from dependency injection will be used.
        """
        self.adapter = adapter or get_music_adapter()
        logger.info(f"SpotifyAuthService initialized with {type(self.adapter).__name__}")

    async def create_authorize_url(self, state: str) -> str:
        """
        Generate authorization URL using the configured adapter.

        Args:
            state: CSRF protection state parameter

        Returns:
            Authorization URL string
        """
        return await self.adapter.create_authorize_url(state)

    async def handle_callback(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from OAuth callback
            state: CSRF protection state parameter

        Returns:
            Dictionary containing token information
        """
        return await self.adapter.handle_callback(code, state)

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get user profile information.

        Args:
            access_token: Valid access token

        Returns:
            Dictionary containing user profile information
        """
        return await self.adapter.get_user_info(access_token)

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            Dictionary containing refreshed token information
        """
        return await self.adapter.refresh_access_token(refresh_token)

    # Additional music streaming operations exposed via the adapter

    async def play_track(
        self,
        access_token: str,
        track_uri: str,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start playback of a specific track."""
        return await self.adapter.play_track(access_token, track_uri, device_id)

    async def pause_playback(
        self,
        access_token: str,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pause current playback."""
        return await self.adapter.pause_playback(access_token, device_id)

    async def get_playback_state(self, access_token: str) -> Dict[str, Any]:
        """Get current playback state."""
        return await self.adapter.get_playback_state(access_token)

    async def search_tracks(
        self,
        access_token: str,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search for tracks."""
        return await self.adapter.search_tracks(access_token, query, limit)

    async def get_track_info(
        self,
        access_token: str,
        track_id: str
    ) -> Dict[str, Any]:
        """Get detailed track information."""
        return await self.adapter.get_track_info(access_token, track_id)

    async def get_available_devices(self, access_token: str) -> List[Dict[str, Any]]:
        """Get list of available playback devices."""
        return await self.adapter.get_available_devices(access_token)

    async def transfer_playback(
        self,
        access_token: str,
        device_id: str,
        play: bool = False
    ) -> Dict[str, Any]:
        """Transfer playback to a different device."""
        return await self.adapter.transfer_playback(access_token, device_id, play)
