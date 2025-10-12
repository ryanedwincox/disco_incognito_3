# Music Streaming Adapter Pattern

This module implements a **swappable adapter pattern** for music streaming services, following the same architecture as the storage adapter in `app/storage/`.

## Architecture Overview

The music streaming adapter pattern allows the application to:
1. Support multiple streaming services (Spotify, Apple Music, YouTube Music, etc.)
2. Use mock data during development without requiring API credentials
3. Easily switch between test and live modes
4. Add new streaming services without modifying existing code

## Components

### 1. Base Interface (`base.py`)

`MusicStreamingAdapter` is an abstract base class that defines the contract for all music streaming adapters. It includes methods for:

**Authentication:**
- `create_authorize_url()` - Generate OAuth authorization URL
- `handle_callback()` - Exchange authorization code for tokens
- `refresh_access_token()` - Refresh expired tokens
- `get_user_info()` - Retrieve user profile information

**Playback Control:**
- `play_track()` - Start playback of a specific track
- `pause_playback()` - Pause current playback
- `get_playback_state()` - Get current playback status

**Search & Discovery:**
- `search_tracks()` - Search for tracks by query
- `get_track_info()` - Get detailed track information

**Device Management:**
- `get_available_devices()` - List available playback devices
- `transfer_playback()` - Transfer playback to another device

### 2. Test Adapter (`test_adapter.py`)

`TestMusicAdapter` provides mock implementations of all methods, returning fake data for development:
- No API credentials required
- Instant responses with realistic mock data
- Useful for frontend development and testing
- Mock tracks include popular disco/dance songs

**Usage:**
```python
from app.music.test_adapter import TestMusicAdapter

adapter = TestMusicAdapter(
    redirect_uri="http://localhost:8000/api/auth/callback",
    scopes=["user-read-private", "streaming"]
)

# Returns mock token data
tokens = await adapter.handle_callback("fake-code", "state")
```

### 3. Spotify Adapter (`spotify_adapter.py`)

`SpotifyAdapter` integrates with the real Spotify Web API using the Spotipy library:
- Requires valid Spotify API credentials
- Makes real API calls to Spotify
- Handles errors and rate limiting
- Normalizes Spotify responses to match the adapter interface

**Usage:**
```python
from app.music.spotify_adapter import SpotifyAdapter

adapter = SpotifyAdapter(
    client_id="your-client-id",
    client_secret="your-client-secret",
    redirect_uri="http://localhost:8000/api/auth/callback",
    scopes=["user-read-private", "streaming"]
)

# Makes real Spotify API call
user_info = await adapter.get_user_info(access_token)
```

### 4. Dependency Injection (`dependencies/music.py`)

The `get_music_adapter()` function provides a singleton adapter instance based on configuration:

**Configuration Logic:**
- `MUSIC_SERVICE=test` OR `SPOTIFY_MODE=test` → Returns `TestMusicAdapter`
- `MUSIC_SERVICE=spotify` AND `SPOTIFY_MODE=live` → Returns `SpotifyAdapter`
- Future: `MUSIC_SERVICE=apple_music` → Returns `AppleMusicAdapter`

**Usage:**
```python
from app.dependencies.music import get_music_adapter

# Get the configured adapter (cached singleton)
adapter = get_music_adapter()

# Use adapter methods
auth_url = await adapter.create_authorize_url(state="csrf-token")
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Music Service Configuration
MUSIC_SERVICE=spotify              # Options: test, spotify, apple_music, youtube_music
SPOTIFY_MODE=test                  # Options: test (mock), live (real API)

# Spotify API Credentials (only needed for SPOTIFY_MODE=live)
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
```

### Switching Modes

**Development (Default):**
```bash
MUSIC_SERVICE=spotify
SPOTIFY_MODE=test
```
Uses `TestMusicAdapter` with mock data. No credentials needed.

**Production:**
```bash
MUSIC_SERVICE=spotify
SPOTIFY_MODE=live
SPOTIFY_CLIENT_ID=<your-real-client-id>
SPOTIFY_CLIENT_SECRET=<your-real-secret>
```
Uses `SpotifyAdapter` with real Spotify API.

**Test Mode Only:**
```bash
MUSIC_SERVICE=test
```
Forces `TestMusicAdapter` regardless of other settings.

## Usage in Services

The `SpotifyAuthService` (in `app/services/spotify.py`) has been refactored to use the adapter pattern:

```python
from app.services.spotify import SpotifyAuthService

# Service automatically uses the configured adapter
service = SpotifyAuthService()

# All operations now go through the adapter
auth_url = await service.create_authorize_url(state="csrf")
tokens = await service.handle_callback(code="auth-code", state="csrf")
user_info = await service.get_user_info(access_token="token")

# New methods now available
tracks = await service.search_tracks(access_token="token", query="disco")
await service.play_track(access_token="token", track_uri="spotify:track:123")
devices = await service.get_available_devices(access_token="token")
```

## Adding a New Streaming Service

To add support for a new streaming service (e.g., Apple Music):

### 1. Create Adapter Implementation

```python
# app/music/apple_music_adapter.py
from .base import MusicStreamingAdapter

class AppleMusicAdapter(MusicStreamingAdapter):
    def __init__(self, client_id: str, private_key: str, ...):
        # Initialize Apple Music API client
        pass

    async def create_authorize_url(self, state: str) -> str:
        # Implement Apple Music OAuth
        pass

    # Implement all other abstract methods...
```

### 2. Update Dependency Injection

```python
# app/dependencies/music.py
from ..music.apple_music_adapter import AppleMusicAdapter

@lru_cache
def get_music_adapter() -> MusicStreamingAdapter:
    music_service = settings.music_service.lower()

    # Add new case
    if music_service == "apple_music":
        return AppleMusicAdapter(
            client_id=settings.apple_music_client_id,
            private_key=settings.apple_music_private_key,
            ...
        )
    # ... existing cases
```

### 3. Add Settings

```python
# app/core/settings.py
class Settings(BaseSettings):
    # Add new fields
    apple_music_client_id: str = Field("", alias="APPLE_MUSIC_CLIENT_ID")
    apple_music_private_key: str = Field("", alias="APPLE_MUSIC_PRIVATE_KEY")
    # ...
```

### 4. Update Configuration

```bash
# .env
MUSIC_SERVICE=apple_music
APPLE_MUSIC_CLIENT_ID=your-client-id
APPLE_MUSIC_PRIVATE_KEY=your-private-key
```

## Testing

### Unit Tests

```python
import pytest
from app.music.test_adapter import TestMusicAdapter

@pytest.mark.asyncio
async def test_search_tracks():
    adapter = TestMusicAdapter(
        redirect_uri="http://test",
        scopes=["streaming"]
    )

    tracks = await adapter.search_tracks(
        access_token="test-token",
        query="disco"
    )

    assert len(tracks) > 0
    assert "name" in tracks[0]
    assert "uri" in tracks[0]
```

### Integration Tests

Use `TestMusicAdapter` for integration tests to avoid hitting real APIs:

```python
from app.services.spotify import SpotifyAuthService
from app.music.test_adapter import TestMusicAdapter

def test_service_with_mock_adapter():
    mock_adapter = TestMusicAdapter(
        redirect_uri="http://test",
        scopes=["streaming"]
    )
    service = SpotifyAuthService(adapter=mock_adapter)

    # Test service methods with mock data
    auth_url = await service.create_authorize_url(state="test")
    assert "test-client-id" in auth_url
```

## Benefits

1. **Flexibility:** Easy to switch between test and live modes
2. **Extensibility:** Add new streaming services without breaking changes
3. **Testability:** Mock adapter enables testing without API credentials
4. **Maintainability:** All service-specific logic contained in adapters
5. **Consistency:** Uniform interface across all streaming services
6. **Development Speed:** Work on frontend/game logic without API setup

## Migration Notes

The old `SpotifyAuthService` had embedded `if self.mode == "test"` checks. The new implementation:
- Delegates all operations to the configured adapter
- Removes conditional logic from the service layer
- Exposes additional methods (search, playback, devices)
- Maintains backward compatibility with existing code

All existing code using `SpotifyAuthService` will continue to work without changes.
