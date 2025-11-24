"""Authentication dependency injection.

Provides dependencies for extracting and validating user identity from
Authorization header Bearer tokens via server-side session validation.
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel

from .storage import get_storage_adapter
from ..storage.base import StorageAdapter


class AuthenticatedUser(BaseModel):
    """Authenticated user information extracted from validated session."""

    user_id: str
    display_name: str


async def get_current_user(
    authorization: str | None = Header(None, description='Bearer token'),
    storage: StorageAdapter = Depends(get_storage_adapter),
) -> AuthenticatedUser:
    """
    Extract and validate user identity from Authorization header.

    Looks up the Bearer token in server-side session storage to retrieve
    user information. Returns 401 if token is missing, malformed, or invalid.

    Args:
        authorization: Authorization header value (expects "Bearer <token>")
        storage: Storage adapter for session lookup

    Returns:
        AuthenticatedUser with user_id and display_name from session

    Raises:
        HTTPException 401: If authentication fails
    """
    # Check if header is present
    if not authorization:
        raise HTTPException(status_code=401, detail='Authorization header required')

    # Validate header format
    if not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=401,
            detail='Invalid authorization header format. Expected: Bearer <token>'
        )

    token = authorization[7:]  # Remove 'Bearer ' prefix

    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')

    # Look up session by token
    session = await storage.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail='Invalid or expired access token')

    # Extract user info from session
    user_id = session.get('user_id')
    display_name = session.get('display_name', 'Guest')

    if not user_id:
        raise HTTPException(status_code=401, detail='Session missing user identity')

    return AuthenticatedUser(user_id=user_id, display_name=display_name)
