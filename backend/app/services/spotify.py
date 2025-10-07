from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException, status

from ..core.settings import settings


class SpotifyAuthService:
    """Handles Spotify OAuth logic. Real implementation arrives in Phase 2."""

    def __init__(self) -> None:
        self.client_id = settings.spotify_client_id
        self.redirect_uri = settings.spotify_redirect_uri

    async def create_authorize_url(self, state: str) -> str:
        # TODO: Implement Spotify authorization URL generation.
        if not self.client_id or self.client_id == "change-me":
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Spotify not configured")
        return f"https://accounts.spotify.com/authorize?client_id={self.client_id}&state={state}"

    async def handle_callback(self, code: str, state: str) -> Dict[str, Any]:
        # TODO: Exchange code for tokens using Spotipy when moving out of test mode.
        return {"access_token": "spoofed-token", "refresh_token": "spoofed-refresh"}
