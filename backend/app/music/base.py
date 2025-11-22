from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class MusicStreamingAdapter(ABC):
    """
    Abstract base class for music streaming service adapters.

    This interface defines the contract for all music streaming services
    (Spotify, Apple Music, YouTube Music, etc.) to ensure consistent
    behavior across different providers.
    """

    # OAuth and Authentication
    @abstractmethod
    async def create_authorize_url(self, state: str) -> str:
        """
        Generate the authorization URL for OAuth flow.

        Args:
            state: CSRF protection state parameter

        Returns:
            Authorization URL string
        """
        pass

    @abstractmethod
    async def handle_callback(self, code: str, state: str) -> dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from OAuth callback
            state: CSRF protection state parameter

        Returns:
            Dictionary containing:
                - access_token: Access token string
                - refresh_token: Refresh token string
                - expires_in: Token expiration time in seconds
                - token_type: Token type (usually "Bearer")
                - scope: Granted scopes
        """
        pass

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            Dictionary containing refreshed token information
        """
        pass

    @abstractmethod
    async def get_user_info(self, access_token: str) -> dict[str, Any]:
        """
        Get user profile information.

        Args:
            access_token: Valid access token

        Returns:
            Dictionary containing:
                - id: User ID
                - display_name: User's display name
                - email: User's email
                - country: User's country code
                - product: Account type (e.g., "premium", "free")
                - images: List of profile images
                - external_urls: Dictionary of external URLs
        """
        pass

    # Playback Control
    @abstractmethod
    async def play_track(self, access_token: str, track_uri: str, device_id: str | None = None) -> dict[str, Any]:
        """
        Start playback of a specific track.

        Args:
            access_token: Valid access token
            track_uri: Track URI (e.g., "spotify:track:123")
            device_id: Optional device ID for playback

        Returns:
            Playback status information
        """
        pass

    @abstractmethod
    async def pause_playback(self, access_token: str, device_id: str | None = None) -> dict[str, Any]:
        """
        Pause current playback.

        Args:
            access_token: Valid access token
            device_id: Optional device ID

        Returns:
            Playback status information
        """
        pass

    @abstractmethod
    async def get_playback_state(self, access_token: str) -> dict[str, Any]:
        """
        Get current playback state.

        Args:
            access_token: Valid access token

        Returns:
            Dictionary containing current playback information
        """
        pass

    # Search and Track Information
    @abstractmethod
    async def search_tracks(self, access_token: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Search for tracks.

        Args:
            access_token: Valid access token
            query: Search query string
            limit: Maximum number of results

        Returns:
            List of track dictionaries, each containing:
                - id: Track ID
                - uri: Track URI
                - name: Track name
                - artist: Artist name
                - album: Album name
                - duration_ms: Track duration in milliseconds
                - album_art: Album artwork URL
        """
        pass

    @abstractmethod
    async def get_track_info(self, access_token: str, track_id: str) -> dict[str, Any]:
        """
        Get detailed information about a specific track.

        Args:
            access_token: Valid access token
            track_id: Track ID

        Returns:
            Dictionary containing detailed track information
        """
        pass

    # Device Management
    @abstractmethod
    async def get_available_devices(self, access_token: str) -> list[dict[str, Any]]:
        """
        Get list of available playback devices.

        Args:
            access_token: Valid access token

        Returns:
            List of device dictionaries, each containing:
                - id: Device ID
                - name: Device name
                - type: Device type (e.g., "Computer", "Smartphone")
                - is_active: Whether device is currently active
                - volume_percent: Current volume level
        """
        pass

    @abstractmethod
    async def transfer_playback(self, access_token: str, device_id: str, play: bool = False) -> dict[str, Any]:
        """
        Transfer playback to a different device.

        Args:
            access_token: Valid access token
            device_id: Target device ID
            play: Whether to start playing immediately

        Returns:
            Transfer status information
        """
        pass
