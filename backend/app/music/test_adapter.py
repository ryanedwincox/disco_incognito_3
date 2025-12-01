"""Mock music streaming adapter for development and testing.

Implements MusicStreamingAdapter with mock data for local development without requiring
real Spotify credentials. Generates random disco-themed usernames and returns mock tracks,
devices, and playback states for testing all game flows.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

from .base import MusicStreamingAdapter

logger = logging.getLogger(__name__)

# Fun disco-themed adjectives and nouns for random test usernames
DISCO_ADJECTIVES = [
    'Groovy',
    'Funky',
    'Sparkly',
    'Dancing',
    'Boogie',
    'Glittery',
    'Shiny',
    'Swinging',
    'Electric',
    'Cosmic',
    'Neon',
    'Stellar',
    'Jazzy',
    'Rad',
    'Cool',
    'Smooth',
    'Flashy',
    'Golden',
    'Vivid',
    'Retro',
]

DISCO_NOUNS = [
    'Dancer',
    'Star',
    'Bee',
    'Tiger',
    'Eagle',
    'Phoenix',
    'Comet',
    'Diamond',
    'Pearl',
    'Unicorn',
    'Knight',
    'Champion',
    'Hero',
    'Legend',
    'Maverick',
    'Rebel',
    'Voyager',
    'Dreamer',
    'Wizard',
    'Ninja',
]


class TestMusicAdapter(MusicStreamingAdapter):
    """
    Test/mock implementation of the music streaming adapter.

    This adapter returns mock data for all operations, allowing development
    and testing without requiring real streaming service credentials or API calls.
    """

    # Class-level counter for deterministic name generation across instances
    _user_counter = 0

    def __init__(self, redirect_uri: str, scopes: list[str]) -> None:
        """
        Initialize the test adapter.

        Resets the user counter on initialization to ensure deterministic test runs.

        Args:
            redirect_uri: OAuth redirect URI
            scopes: List of required scopes
        """
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self.scope_string = ' '.join(scopes)
        # Reset counter on adapter creation for deterministic test runs
        TestMusicAdapter._user_counter = 0
        logger.info('TestMusicAdapter initialized (user counter reset)')

    # OAuth and Authentication
    async def create_authorize_url(self, state: str) -> str:
        """Generate a mock authorization URL."""
        logger.info('Generating test mode authorization URL')
        params = urlencode(
            {
                'client_id': 'test-client-id',
                'response_type': 'code',
                'redirect_uri': self.redirect_uri,
                'scope': self.scope_string,
                'state': state,
            }
        )
        return f'https://accounts.example.com/authorize?{params}'

    async def handle_callback(self, code: str, state: str) -> dict[str, Any]:
        """Return mock access and refresh tokens."""
        logger.info('Returning test mode tokens')
        return {
            'access_token': 'test-access-token',
            'refresh_token': 'test-refresh-token',
            'expires_in': 3600,
            'token_type': 'Bearer',
            'scope': self.scope_string,
        }

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        """Return mock refreshed tokens."""
        logger.info('Returning test mode refreshed token')
        return {
            'access_token': 'test-refreshed-access-token',
            'expires_in': 3600,
            'token_type': 'Bearer',
            'scope': self.scope_string,
        }

    async def get_user_info(self, access_token: str) -> dict[str, Any]:
        """
        Return mock user profile information with a deterministic disco-themed name.

        Uses a counter-based approach for deterministic test runs. Names cycle through
        adjective/noun combinations in a predictable order.
        """
        # Deterministic name generation using counter
        adj_index = TestMusicAdapter._user_counter % len(DISCO_ADJECTIVES)
        noun_index = TestMusicAdapter._user_counter % len(DISCO_NOUNS)
        adjective = DISCO_ADJECTIVES[adj_index]
        noun = DISCO_NOUNS[noun_index]
        display_name = f'{adjective} {noun}'

        # Deterministic user ID based on counter
        user_id = f'test-user-{TestMusicAdapter._user_counter:04d}'
        TestMusicAdapter._user_counter += 1

        logger.info(f'Returning test mode user info: {display_name} ({user_id})')
        return {
            'id': user_id,
            'display_name': display_name,
            'email': f'{user_id}@disco.test',
            'country': 'US',
            'product': 'premium',
            'images': [],
            'external_urls': {'music': f'https://music.example.com/user/{user_id}'},
        }

    # Playback Control
    async def play_track(self, access_token: str, track_uri: str, device_id: str | None = None) -> dict[str, Any]:
        """Mock track playback."""
        logger.info(f'Test mode: Playing track {track_uri} on device {device_id}')
        return {
            'status': 'playing',
            'track_uri': track_uri,
            'device_id': device_id or 'test-device-id',
            'position_ms': 0,
        }

    async def pause_playback(self, access_token: str, device_id: str | None = None) -> dict[str, Any]:
        """Mock pause playback."""
        logger.info(f'Test mode: Pausing playback on device {device_id}')
        return {
            'status': 'paused',
            'device_id': device_id or 'test-device-id',
        }

    async def get_playback_state(self, access_token: str) -> dict[str, Any]:
        """Return mock playback state with a mock track for E2E testing visibility."""
        logger.info('Returning test mode playback state')
        return {
            'is_playing': True,
            'track': {
                'id': 'test-track-1',
                'uri': 'test:track:1',
                'name': "Stayin' Alive",
                'artist': 'Bee Gees',
                'album': 'Saturday Night Fever',
                'duration_ms': 285000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273f98d90cb3a9e82e797024e32',
            },
            'device_id': 'test-device-1',
            'progress_ms': 45000,
            'duration_ms': 285000,
        }

    # Search and Track Information
    async def search_tracks(self, access_token: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """Return mock search results."""
        logger.info(f"Test mode: Searching for '{query}'")
        # Mock tracks that match common disco/dance songs
        mock_tracks = [
            {
                'id': 'test-track-1',
                'uri': 'test:track:1',
                'name': "Stayin' Alive",
                'artist': 'Bee Gees',
                'album': 'Saturday Night Fever',
                'duration_ms': 285000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273f98d90cb3a9e82e797024e32',
            },
            {
                'id': 'test-track-2',
                'uri': 'test:track:2',
                'name': 'September',
                'artist': 'Earth, Wind & Fire',
                'album': 'The Best of Earth, Wind & Fire Vol. 1',
                'duration_ms': 215000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273b7b169a4fef5a9247f0e4021',
            },
            {
                'id': 'test-track-3',
                'uri': 'test:track:3',
                'name': 'I Wanna Dance with Somebody',
                'artist': 'Whitney Houston',
                'album': 'Whitney',
                'duration_ms': 291000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273f7f1b7e42f3b8f8ddac3a0e1',
            },
            {
                'id': 'test-track-4',
                'uri': 'test:track:4',
                'name': "Don't Stop Believin'",
                'artist': 'Journey',
                'album': 'Escape',
                'duration_ms': 251000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273c5653f9038e42efba85151ee',
            },
        ]

        # Simple filter based on query
        if query:
            query_lower = query.lower()
            filtered = [track for track in mock_tracks if query_lower in track['name'].lower() or query_lower in track['artist'].lower()]
            return filtered[:limit]

        return mock_tracks[:limit]

    async def get_track_info(self, access_token: str, track_id: str) -> dict[str, Any]:
        """Return mock track information."""
        logger.info(f'Test mode: Getting track info for {track_id}')
        return {
            'id': track_id,
            'uri': f'test:track:{track_id}',
            'name': 'Test Track',
            'artist': 'Test Artist',
            'album': 'Test Album',
            'duration_ms': 240000,
            'album_art': 'https://via.placeholder.com/300',
            'popularity': 75,
            'preview_url': None,
        }

    # Device Management
    async def get_available_devices(self, access_token: str) -> list[dict[str, Any]]:
        """Return mock device list."""
        logger.info('Returning test mode available devices')
        return [
            {
                'id': 'test-device-1',
                'name': 'Web Player',
                'type': 'Computer',
                'is_active': True,
                'volume_percent': 50,
            },
            {
                'id': 'test-device-2',
                'name': 'Test Phone',
                'type': 'Smartphone',
                'is_active': False,
                'volume_percent': 30,
            },
        ]

    async def transfer_playback(self, access_token: str, device_id: str, play: bool = False) -> dict[str, Any]:
        """Mock playback transfer."""
        logger.info(f'Test mode: Transferring playback to device {device_id}')
        return {
            'status': 'transferred',
            'device_id': device_id,
            'is_playing': play,
        }
