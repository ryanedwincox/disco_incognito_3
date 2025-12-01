"""Spotify OAuth authentication routes.

Provides endpoints for initiating the Spotify OAuth flow, handling callbacks, refreshing
tokens, and test mode authentication. Manages the full authentication lifecycle including
token exchange and user info retrieval.
"""

import logging
import secrets
import urllib.parse
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from ...core.rate_limit import RATE_LIMITS, limiter
from ...core.settings import settings
from ...dependencies.storage import get_storage_adapter
from ...services.spotify import SpotifyAuthService
from ...storage.base import StorageAdapter


class ManualLoginRequest(BaseModel):
    """Request model for manual (non-Spotify) login."""

    display_name: str = Field(..., min_length=1, max_length=50, description='Display name for the user')

router = APIRouter(prefix='/auth', tags=['Authentication'])
logger = logging.getLogger(__name__)


def get_spotify_service() -> SpotifyAuthService:
    """Dependency injection for SpotifyAuthService."""
    return SpotifyAuthService()


@router.get('/login', summary='Begin Spotify OAuth flow')
@limiter.limit(RATE_LIMITS['auth'])
async def login(
    request: Request,
    service: SpotifyAuthService = Depends(get_spotify_service),
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> dict[str, str]:
    """
    Generate Spotify authorization URL for user login.

    In test mode (SPOTIFY_MODE=test), returns mock authentication data directly
    without requiring an OAuth redirect.

    Returns:
        Dict containing the authorization URL and state parameter (live mode),
        or mock auth data directly (test mode)
    """
    try:
        # In test mode, return mock auth data directly without OAuth redirect
        if settings.spotify_mode.lower() == 'test':
            token_info = await service.handle_callback(code='test-code', state='test-state')
            user_info = await service.get_user_info(token_info['access_token'])

            # Generate unique token for this session (test-access-token is not unique)
            access_token = f'test_token_{secrets.token_urlsafe(32)}'

            # Store session mapping token -> user info
            await storage.set_session(access_token, {
                'user_id': user_info.get('id', ''),
                'display_name': user_info.get('display_name', ''),
                'email': user_info.get('email', ''),
            })

            logger.info(f'Test mode login successful for user: {user_info.get("display_name", "unknown")}')
            return {
                'access_token': access_token,
                'refresh_token': token_info.get('refresh_token', ''),
                'expires_in': str(token_info.get('expires_in', 3600)),
                'user_id': user_info.get('id', ''),
                'display_name': user_info.get('display_name', ''),
                'email': user_info.get('email', ''),
            }

        # Live mode: return OAuth authorization URL
        state = secrets.token_urlsafe(16)
        authorize_url = await service.create_authorize_url(state)
        logger.info('Login endpoint accessed, returning authorization URL')
        return {'authorize_url': authorize_url, 'state': state, 'message': 'Navigate to the authorize_url to authenticate with Spotify'}
    except Exception as e:
        logger.error(f'Error in login endpoint: {e}')
        raise HTTPException(status_code=500, detail='Failed to generate login URL')


@router.get('/callback', summary='Handle Spotify OAuth callback')
@limiter.limit(RATE_LIMITS['auth'])
async def callback(
    request: Request,
    code: str | None = Query(None, description='Authorization code from Spotify'),
    state: str | None = Query(None, description='State parameter from OAuth flow'),
    error: str | None = Query(None, description='Error parameter from OAuth flow'),
    service: SpotifyAuthService = Depends(get_spotify_service),
) -> RedirectResponse:
    """
    Handle OAuth callback from Spotify.

    This endpoint receives the authorization code from Spotify,
    exchanges it for an access token, and redirects the user
    back to the frontend with the authentication information.

    Per OAuth spec, this endpoint returns a redirect, not JSON.
    """
    try:
        # Handle OAuth errors
        if error:
            logger.error(f'OAuth error in callback: {error}')
            error_url = f'{settings.frontend_url}/?error={urllib.parse.quote(error)}'
            return RedirectResponse(url=error_url, status_code=302)

        if not code:
            logger.error('No authorization code provided in callback')
            error_url = f'{settings.frontend_url}/?error=no_code'
            return RedirectResponse(url=error_url, status_code=302)

        if not state:
            logger.error('No state parameter provided in callback')
            error_url = f'{settings.frontend_url}/?error=no_state'
            return RedirectResponse(url=error_url, status_code=302)

        # Exchange code for tokens
        token_info = await service.handle_callback(code=code, state=state)

        if not token_info:
            logger.error('Failed to obtain access token')
            error_url = f'{settings.frontend_url}/?error=token_exchange_failed'
            return RedirectResponse(url=error_url, status_code=302)

        # Get user info using the access token
        user_info = await service.get_user_info(token_info['access_token'])

        logger.info(f'OAuth callback successful for user: {user_info.get("id", "unknown")}')

        # Create success URL with token and user information
        # Frontend will extract this from URL parameters
        success_url = (
            f'{settings.frontend_url}/?auth_success=true'
            f'&access_token={urllib.parse.quote(token_info["access_token"])}'
            f'&refresh_token={urllib.parse.quote(token_info.get("refresh_token", ""))}'
            f'&expires_in={token_info.get("expires_in", 3600)}'
            f'&user_id={urllib.parse.quote(user_info.get("id", ""))}'
            f'&display_name={urllib.parse.quote(user_info.get("display_name", ""))}'
        )

        return RedirectResponse(url=success_url, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error in callback endpoint: {e}', exc_info=True)
        error_url = f'{settings.frontend_url}/?error=callback_failed'
        return RedirectResponse(url=error_url, status_code=302)


@router.post('/refresh', summary='Refresh access token')
@limiter.limit(RATE_LIMITS['auth'])
async def refresh(request: Request, refresh_token: str, service: SpotifyAuthService = Depends(get_spotify_service)) -> dict[str, str]:
    """
    Refresh an expired access token using a refresh token.

    Args:
        refresh_token: The refresh token obtained during initial authorization

    Returns:
        Dict containing the new access token and expiration info
    """
    try:
        token_info = await service.refresh_access_token(refresh_token)
        logger.info('Successfully refreshed access token')
        return {
            'access_token': token_info['access_token'],
            'expires_in': str(token_info.get('expires_in', 3600)),
            'token_type': token_info.get('token_type', 'Bearer'),
        }
    except Exception as e:
        logger.error(f'Error refreshing token: {e}')
        raise HTTPException(status_code=400, detail='Failed to refresh access token')


@router.post('/test-login', summary='Create test user (test mode only)')
@limiter.limit(RATE_LIMITS['auth'])
async def test_login(
    request: Request,
    service: SpotifyAuthService = Depends(get_spotify_service),
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> dict[str, str]:
    """
    Create a test user with random disco-themed name.

    This endpoint bypasses OAuth and directly returns mock tokens and user info.
    Only available when SPOTIFY_MODE=test or DEBUG=true.

    Returns:
        Dict containing access_token, refresh_token, user_id, and display_name
    """
    # Check if we're in test mode
    if settings.spotify_mode.lower() != 'test' and not settings.debug:
        raise HTTPException(status_code=403, detail='Test login is only available in test/debug mode')

    try:
        # Generate mock tokens
        token_info = await service.handle_callback(code='test-code', state='test-state')

        # Get random test user info
        user_info = await service.get_user_info(token_info['access_token'])

        # Generate unique token for this session
        access_token = f'test_token_{secrets.token_urlsafe(32)}'

        # Store session mapping token -> user info
        await storage.set_session(access_token, {
            'user_id': user_info.get('id', ''),
            'display_name': user_info.get('display_name', ''),
            'email': user_info.get('email', ''),
        })

        logger.info(f'Test login successful for user: {user_info.get("display_name", "unknown")}')

        return {
            'access_token': access_token,
            'refresh_token': token_info.get('refresh_token', ''),
            'expires_in': str(token_info.get('expires_in', 3600)),
            'user_id': user_info.get('id', ''),
            'display_name': user_info.get('display_name', ''),
            'email': user_info.get('email', ''),
        }
    except Exception as e:
        logger.error(f'Error in test login: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Failed to create test user')


@router.post('/manual-login', summary='Manual login with display name')
@limiter.limit(RATE_LIMITS['auth'])
async def manual_login(
    request: Request,
    body: ManualLoginRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> dict[str, str]:
    """
    Create a guest user with the provided display name.

    This endpoint allows users to join without Spotify authentication.
    These users can participate in games but cannot select songs or control playback.

    Returns:
        Dict containing access_token, refresh_token, user_id, display_name, and is_spotify_user flag
    """
    try:
        # Generate unique user ID with manual prefix
        user_id = f'manual_{uuid.uuid4().hex[:12]}'

        # Generate mock tokens for session management
        access_token = f'manual_token_{secrets.token_urlsafe(32)}'
        refresh_token = f'manual_refresh_{secrets.token_urlsafe(32)}'

        # Store session mapping token -> user info
        await storage.set_session(access_token, {
            'user_id': user_id,
            'display_name': body.display_name,
            'email': '',
        })

        logger.info(f'Manual login successful for user: {body.display_name}')

        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': '3600',
            'user_id': user_id,
            'display_name': body.display_name,
            'email': '',
            'is_spotify_user': 'false',
        }
    except Exception as e:
        logger.error(f'Error in manual login: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Failed to create guest user')


@router.post('/logout', summary='Logout user')
@limiter.limit(RATE_LIMITS['auth'])
async def logout(request: Request) -> dict[str, str]:
    """
    Logout user and clear session.

    Note: This is primarily handled client-side by clearing tokens.
    This endpoint is here for future server-side session management.
    """
    logger.info('Logout endpoint called')
    return {'message': 'Logged out successfully'}
