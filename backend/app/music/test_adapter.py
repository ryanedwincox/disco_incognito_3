"""Mock music streaming adapter for development and testing.

Implements MusicStreamingAdapter with mock data for local development without requiring
real Spotify credentials. Generates random disco-themed usernames and returns mock tracks,
devices, and playback states for testing all game flows.
"""

from __future__ import annotations

import logging
import random
import uuid
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

    def __init__(self, redirect_uri: str, scopes: list[str]) -> None:
        """
        Initialize the test adapter.

        Args:
            redirect_uri: OAuth redirect URI
            scopes: List of required scopes
        """
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self.scope_string = ' '.join(scopes)
        logger.info('TestMusicAdapter initialized')

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
        Return mock user profile information with a random disco-themed name.

        Each call generates a unique user with a fun name like "Groovy Dancer" or "Funky Star".
        """
        # Generate random disco-themed username
        adjective = random.choice(DISCO_ADJECTIVES)
        noun = random.choice(DISCO_NOUNS)
        display_name = f'{adjective} {noun}'

        # Generate unique user ID
        user_id = f'test-user-{uuid.uuid4().hex[:8]}'

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
        """Return mock search results with fuzzy matching on disco/funk catalog."""
        logger.info(f"Test mode: Searching for '{query}'")
        # Expanded disco/funk catalog (~25 songs)
        mock_tracks = [
            {
                'id': 'test-track-1',
                'uri': 'spotify:track:test1',
                'name': "Stayin' Alive",
                'artist': 'Bee Gees',
                'album': 'Saturday Night Fever',
                'duration_ms': 285000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273f98d90cb3a9e82e797024e32',
            },
            {
                'id': 'test-track-2',
                'uri': 'spotify:track:test2',
                'name': 'September',
                'artist': 'Earth, Wind & Fire',
                'album': 'The Best of Earth, Wind & Fire Vol. 1',
                'duration_ms': 215000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273b7b169a4fef5a9247f0e4021',
            },
            {
                'id': 'test-track-3',
                'uri': 'spotify:track:test3',
                'name': 'I Will Survive',
                'artist': 'Gloria Gaynor',
                'album': 'Love Tracks',
                'duration_ms': 198000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273d7b169a4fef5a9247f0e4022',
            },
            {
                'id': 'test-track-4',
                'uri': 'spotify:track:test4',
                'name': 'Le Freak',
                'artist': 'Chic',
                'album': "C'est Chic",
                'duration_ms': 311000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273e7b169a4fef5a9247f0e4023',
            },
            {
                'id': 'test-track-5',
                'uri': 'spotify:track:test5',
                'name': 'Dancing Queen',
                'artist': 'ABBA',
                'album': 'Arrival',
                'duration_ms': 231000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273f7b169a4fef5a9247f0e4024',
            },
            {
                'id': 'test-track-6',
                'uri': 'spotify:track:test6',
                'name': 'Boogie Wonderland',
                'artist': 'Earth, Wind & Fire',
                'album': 'I Am',
                'duration_ms': 288000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273g7b169a4fef5a9247f0e4025',
            },
            {
                'id': 'test-track-7',
                'uri': 'spotify:track:test7',
                'name': "Don't Stop 'Til You Get Enough",
                'artist': 'Michael Jackson',
                'album': 'Off the Wall',
                'duration_ms': 366000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273h7b169a4fef5a9247f0e4026',
            },
            {
                'id': 'test-track-8',
                'uri': 'spotify:track:test8',
                'name': 'Ring My Bell',
                'artist': 'Anita Ward',
                'album': 'Songs of Love',
                'duration_ms': 234000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273i7b169a4fef5a9247f0e4027',
            },
            {
                'id': 'test-track-9',
                'uri': 'spotify:track:test9',
                'name': 'Last Dance',
                'artist': 'Donna Summer',
                'album': 'Thank God It\'s Friday',
                'duration_ms': 267000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273j7b169a4fef5a9247f0e4028',
            },
            {
                'id': 'test-track-10',
                'uri': 'spotify:track:test10',
                'name': 'Celebration',
                'artist': 'Kool & The Gang',
                'album': 'Celebrate!',
                'duration_ms': 264000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273k7b169a4fef5a9247f0e4029',
            },
            {
                'id': 'test-track-11',
                'uri': 'spotify:track:test11',
                'name': 'Y.M.C.A.',
                'artist': 'Village People',
                'album': 'Cruisin\'',
                'duration_ms': 292000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273l7b169a4fef5a9247f0e4030',
            },
            {
                'id': 'test-track-12',
                'uri': 'spotify:track:test12',
                'name': 'Disco Inferno',
                'artist': 'The Trammps',
                'album': 'Disco Inferno',
                'duration_ms': 330000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273m7b169a4fef5a9247f0e4031',
            },
            {
                'id': 'test-track-13',
                'uri': 'spotify:track:test13',
                'name': 'Hot Stuff',
                'artist': 'Donna Summer',
                'album': 'Bad Girls',
                'duration_ms': 237000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273n7b169a4fef5a9247f0e4032',
            },
            {
                'id': 'test-track-14',
                'uri': 'spotify:track:test14',
                'name': 'Super Freak',
                'artist': 'Rick James',
                'album': 'Street Songs',
                'duration_ms': 212000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273o7b169a4fef5a9247f0e4033',
            },
            {
                'id': 'test-track-15',
                'uri': 'spotify:track:test15',
                'name': 'Get Down Tonight',
                'artist': 'KC and the Sunshine Band',
                'album': 'KC and the Sunshine Band',
                'duration_ms': 192000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273p7b169a4fef5a9247f0e4034',
            },
            {
                'id': 'test-track-16',
                'uri': 'spotify:track:test16',
                'name': 'Car Wash',
                'artist': 'Rose Royce',
                'album': 'Car Wash',
                'duration_ms': 242000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273q7b169a4fef5a9247f0e4035',
            },
            {
                'id': 'test-track-17',
                'uri': 'spotify:track:test17',
                'name': 'Play That Funky Music',
                'artist': 'Wild Cherry',
                'album': 'Wild Cherry',
                'duration_ms': 305000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273r7b169a4fef5a9247f0e4036',
            },
            {
                'id': 'test-track-18',
                'uri': 'spotify:track:test18',
                'name': "That's the Way (I Like It)",
                'artist': 'KC and the Sunshine Band',
                'album': 'KC and the Sunshine Band',
                'duration_ms': 187000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273s7b169a4fef5a9247f0e4037',
            },
            {
                'id': 'test-track-19',
                'uri': 'spotify:track:test19',
                'name': 'Brick House',
                'artist': 'Commodores',
                'album': 'Commodores',
                'duration_ms': 206000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273t7b169a4fef5a9247f0e4038',
            },
            {
                'id': 'test-track-20',
                'uri': 'spotify:track:test20',
                'name': "I'm Coming Out",
                'artist': 'Diana Ross',
                'album': 'Diana',
                'duration_ms': 322000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273u7b169a4fef5a9247f0e4039',
            },
            {
                'id': 'test-track-21',
                'uri': 'spotify:track:test21',
                'name': 'Give Up the Funk',
                'artist': 'Parliament',
                'album': 'Mothership Connection',
                'duration_ms': 337000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273v7b169a4fef5a9247f0e4040',
            },
            {
                'id': 'test-track-22',
                'uri': 'spotify:track:test22',
                'name': 'Get Up Offa That Thing',
                'artist': 'James Brown',
                'album': 'Get Up Offa That Thing',
                'duration_ms': 257000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273w7b169a4fef5a9247f0e4041',
            },
            {
                'id': 'test-track-23',
                'uri': 'spotify:track:test23',
                'name': 'Funkytown',
                'artist': 'Lipps Inc.',
                'album': 'Mouth to Mouth',
                'duration_ms': 287000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273x7b169a4fef5a9247f0e4042',
            },
            {
                'id': 'test-track-24',
                'uri': 'spotify:track:test24',
                'name': 'Heart of Glass',
                'artist': 'Blondie',
                'album': 'Parallel Lines',
                'duration_ms': 254000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273y7b169a4fef5a9247f0e4043',
            },
            {
                'id': 'test-track-25',
                'uri': 'spotify:track:test25',
                'name': 'Good Times',
                'artist': 'Chic',
                'album': 'Risqué',
                'duration_ms': 482000,
                'album_art': 'https://i.scdn.co/image/ab67616d0000b273z7b169a4fef5a9247f0e4044',
            },
        ]

        # Fuzzy matching: check if query words appear in name, artist, or album
        if query:
            query_lower = query.lower()
            query_words = query_lower.split()

            def matches(track: dict[str, Any]) -> bool:
                searchable = f"{track['name']} {track['artist']} {track['album']}".lower()
                return any(word in searchable for word in query_words)

            filtered = [track for track in mock_tracks if matches(track)]
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
