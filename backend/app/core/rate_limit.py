"""Rate limiting configuration using slowapi.

Provides rate limiter instance and rate limit constants for API endpoints.
Uses in-memory storage for single-instance deployment.
Rate limiting is disabled in debug mode to allow tests to run without hitting limits.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from .settings import settings

limiter = Limiter(key_func=get_remote_address, enabled=not settings.debug)

# Rate limit settings per route category
RATE_LIMITS = {
    'auth': '10/minute',
    'rooms': '30/minute',
}
