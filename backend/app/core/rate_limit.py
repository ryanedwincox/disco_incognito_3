# Rate limiting: Per-player-per-room key function and RATE_LIMITS constants for slowapi. NOT concerned with JWT decode or auth logic. | I/O: (FastAPI Request headers/path_params) → limiter instance, limit strings

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .settings import settings


def _player_room_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        room_code = request.path_params.get("room_code", "")
        # Bearer + room_code → per-player-per-room bucket (prevents NAT collapse)
        if room_code:
            return f"room:{room_code}:player:{token}"
        # Bearer only (auth endpoints) → per-player bucket
        return f"player:{token}"
    # No token (unauthenticated) → fall back to remote IP
    return get_remote_address(request)


# 20× relaxed limits in debug mode so 429s remain producible (dev parity)
# but normal gameplay never hits them.
_rooms_limit = "600/minute" if settings.debug else "60/minute"
_auth_limit = "100/minute" if settings.debug else "10/minute"

limiter = Limiter(key_func=_player_room_key)

# Rate limit settings per route category
RATE_LIMITS = {
    "auth": _auth_limit,
    "rooms": _rooms_limit,
}
