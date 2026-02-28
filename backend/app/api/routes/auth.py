"""Authentication routes for guest login.

Provides endpoints for guest login (name-based), logout, display name updates,
and token verification. Manages session lifecycle for all users.
"""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ...core.rate_limit import RATE_LIMITS, limiter
from ...utils.user_id import compute_guest_user_id
from ...dependencies.auth import AuthenticatedUser, get_current_user
from ...dependencies.storage import get_storage_adapter
from ...storage.base import StorageAdapter


class LoginRequest(BaseModel):
    """Request model for guest login."""

    display_name: str = Field(..., min_length=1, max_length=50, description='Display name for the user')


class UpdateNameRequest(BaseModel):
    """Request model for updating display name. Send null to clear and revert to original."""

    custom_name: str | None = Field(None, max_length=50)

    @field_validator('custom_name')
    @classmethod
    def strip_whitespace(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None  # Whitespace-only treated as clear
        return stripped


router = APIRouter(prefix='/auth', tags=['Authentication'])
logger = logging.getLogger(__name__)


@router.post('/login', summary='Login with display name')
@limiter.limit(RATE_LIMITS['auth'])
async def login(
    request: Request,
    body: LoginRequest,
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> dict[str, str]:
    """
    Create a user session with the provided display name.

    Returns:
        Dict containing access_token, user_id, and display_name
    """
    try:
        # Intentional: same display_name always yields the same user_id (deterministic identity)
        user_id = compute_guest_user_id(body.display_name)
        access_token = f'token_{secrets.token_urlsafe(32)}'

        await storage.set_session(
            access_token,
            {
                'user_id': user_id,
                'display_name': body.display_name,
            },
        )

        logger.info(f'Login successful for user: {body.display_name}')

        return {
            'access_token': access_token,
            'user_id': user_id,
            'display_name': body.display_name,
        }
    except Exception as e:
        logger.error(f'Error in login: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Failed to create user session')


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


@router.post('/update-name', summary='Update custom display name')
@limiter.limit(RATE_LIMITS['auth'])
async def update_name(
    request: Request,
    body: UpdateNameRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> dict[str, str]:
    """
    Set or clear a custom display name for the current user.

    Send a custom_name string to override the original display name,
    or null to clear it and revert to the original.
    """
    try:
        session = await storage.get_session(user.token)
        if not session:
            raise HTTPException(status_code=401, detail='Invalid or expired access token')

        if body.custom_name:
            session['custom_name'] = body.custom_name
        else:
            session.pop('custom_name', None)

        await storage.set_session(user.token, session)

        effective_name = body.custom_name or session.get('display_name', 'Guest')
        logger.info(f'Custom name updated for user {user.user_id}')
        return {'display_name': effective_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error updating custom name: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Failed to update display name')


@router.get('/verify', summary='Verify access token')
@limiter.limit(RATE_LIMITS['auth'])
async def verify(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, str]:
    """Verify the provided access token and return user information."""
    logger.info(f'Token verified for user: {user.user_id}')
    return {
        'user_id': user.user_id,
        'display_name': user.display_name,
        'custom_name': user.custom_name,
    }
