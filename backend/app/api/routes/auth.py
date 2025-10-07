from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends

from ...services.spotify import SpotifyAuthService

router = APIRouter(prefix="/auth")


def get_spotify_service() -> SpotifyAuthService:
    return SpotifyAuthService()


@router.get("/login", summary="Begin Spotify OAuth flow")
async def login(service: SpotifyAuthService = Depends(get_spotify_service)) -> dict[str, str]:
    state = secrets.token_urlsafe(16)
    authorize_url = await service.create_authorize_url(state)
    return {"authorize_url": authorize_url, "state": state}


@router.get("/callback", summary="Handle Spotify OAuth callback")
async def callback(code: str, state: str, service: SpotifyAuthService = Depends(get_spotify_service)) -> dict[str, str]:
    tokens = await service.handle_callback(code=code, state=state)
    return {"message": "Callback received", "tokens": tokens}  # type: ignore[return-value]
