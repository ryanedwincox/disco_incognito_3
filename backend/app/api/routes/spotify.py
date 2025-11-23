from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ...services.spotify import SpotifyAuthService

router = APIRouter(prefix='/spotify', tags=['Spotify'])
logger = logging.getLogger(__name__)


def get_spotify_service() -> SpotifyAuthService:
    """Dependency injection for SpotifyAuthService."""
    return SpotifyAuthService()


def get_access_token(authorization: str = Header(..., description='Bearer token')) -> str:
    """Extract access token from Authorization header."""
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Invalid authorization header format')
    return authorization[7:]


class PlayTrackRequest(BaseModel):
    track_uri: str
    device_id: str | None = None


class TransferPlaybackRequest(BaseModel):
    device_id: str
    play: bool = False


@router.get('/search', summary='Search for tracks')
async def search_tracks(
    q: str,
    limit: int = 20,
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Search for tracks on Spotify.

    Args:
        q: Search query string
        limit: Maximum number of results (default 20)

    Returns:
        Dict containing list of tracks
    """
    try:
        tracks = await service.search_tracks(access_token, q, limit)
        return {'tracks': tracks}
    except Exception as e:
        logger.error(f'Error searching tracks: {e}')
        raise HTTPException(status_code=500, detail='Failed to search tracks')


@router.post('/play', summary='Play a track')
async def play_track(
    request: PlayTrackRequest,
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Start playback of a specific track.

    Args:
        request: Contains track_uri and optional device_id

    Returns:
        Dict with success status
    """
    try:
        result = await service.play_track(access_token, request.track_uri, request.device_id)
        return result
    except Exception as e:
        logger.error(f'Error playing track: {e}')
        raise HTTPException(status_code=500, detail='Failed to play track')


@router.post('/pause', summary='Pause playback')
async def pause_playback(
    device_id: str | None = None,
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Pause current playback.

    Args:
        device_id: Optional device ID to pause on

    Returns:
        Dict with success status
    """
    try:
        result = await service.pause_playback(access_token, device_id)
        return result
    except Exception as e:
        logger.error(f'Error pausing playback: {e}')
        raise HTTPException(status_code=500, detail='Failed to pause playback')


@router.get('/playback', summary='Get current playback state')
async def get_playback_state(
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Get the current playback state.

    Returns:
        Dict containing playback state information
    """
    try:
        state = await service.get_playback_state(access_token)
        return state
    except Exception as e:
        logger.error(f'Error getting playback state: {e}')
        raise HTTPException(status_code=500, detail='Failed to get playback state')


@router.get('/devices', summary='Get available devices')
async def get_devices(
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Get list of available playback devices.

    Returns:
        Dict containing list of devices
    """
    try:
        devices = await service.get_available_devices(access_token)
        return {'devices': devices}
    except Exception as e:
        logger.error(f'Error getting devices: {e}')
        raise HTTPException(status_code=500, detail='Failed to get devices')


@router.post('/transfer', summary='Transfer playback to device')
async def transfer_playback(
    request: TransferPlaybackRequest,
    access_token: str = Depends(get_access_token),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> dict:
    """
    Transfer playback to a different device.

    Args:
        request: Contains device_id and optional play flag

    Returns:
        Dict with success status
    """
    try:
        result = await service.transfer_playback(access_token, request.device_id, request.play)
        return result
    except Exception as e:
        logger.error(f'Error transferring playback: {e}')
        raise HTTPException(status_code=500, detail='Failed to transfer playback')
