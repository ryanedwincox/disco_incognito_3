"""Music streaming adapter dependency injection.

Provides a singleton MusicStreamingAdapter instance based on configuration. Returns
TestMusicAdapter for development/test mode or SpotifyAdapter for production. Responsible
for adapter instantiation and lifecycle management.
"""

from functools import lru_cache

from ..core.settings import settings
from ..music.base import MusicStreamingAdapter
from ..music.test_adapter import TestMusicAdapter
from ..music.spotify_adapter import SpotifyAdapter


# Required scopes for music streaming services
REQUIRED_SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
]


@lru_cache
def get_music_adapter() -> MusicStreamingAdapter:
    """
    Return a singleton music streaming adapter instance.

    The adapter type is determined by the MUSIC_SERVICE and SPOTIFY_MODE settings:
    - If MUSIC_SERVICE is "test" or SPOTIFY_MODE is "test": Returns TestMusicAdapter
    - If MUSIC_SERVICE is "spotify" and SPOTIFY_MODE is "live": Returns SpotifyAdapter
    - Future: Can add support for "apple_music", "youtube_music", etc.

    Returns:
        MusicStreamingAdapter: The configured music streaming adapter

    Raises:
        ValueError: If the music service is not configured or unsupported
    """
    music_service = settings.music_service.lower()
    spotify_mode = settings.spotify_mode.lower()

    # Determine which adapter to use
    if music_service == 'test' or spotify_mode == 'test':
        # Test mode adapter
        return TestMusicAdapter(redirect_uri=str(settings.spotify_redirect_uri), scopes=REQUIRED_SCOPES)

    elif music_service == 'spotify':
        if spotify_mode == 'live':
            # Live Spotify adapter
            return SpotifyAdapter(
                client_id=settings.spotify_client_id, client_secret=settings.spotify_client_secret, redirect_uri=str(settings.spotify_redirect_uri), scopes=REQUIRED_SCOPES
            )
        else:
            # Default to test mode for Spotify if not explicitly "live"
            return TestMusicAdapter(redirect_uri=str(settings.spotify_redirect_uri), scopes=REQUIRED_SCOPES)

    # Future: Add support for other streaming services
    # elif music_service == "apple_music":
    #     return AppleMusicAdapter(...)
    # elif music_service == "youtube_music":
    #     return YouTubeMusicAdapter(...)

    else:
        raise ValueError(f'Unsupported music service: {music_service}. Supported services: test, spotify (future: apple_music, youtube_music)')
