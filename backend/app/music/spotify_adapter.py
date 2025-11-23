"""Live Spotify API adapter implementation.

Implements MusicStreamingAdapter using Spotipy library for real Spotify API integration.
Handles OAuth token exchange, user profile retrieval, playback control, track search, and
device management through the Spotify Web API.
"""

from __future__ import annotations

import logging
from typing import Any

import spotipy
from fastapi import HTTPException, status
from spotipy.oauth2 import SpotifyOAuth

from .base import MusicStreamingAdapter

logger = logging.getLogger(__name__)


class SpotifyAdapter(MusicStreamingAdapter):
    """
    Spotify implementation of the music streaming adapter.

    This adapter integrates with the Spotify Web API using the Spotipy library
    to provide real music streaming functionality.
    """

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, scopes: list[str]) -> None:
        """
        Initialize the Spotify adapter.

        Args:
            client_id: Spotify application client ID
            client_secret: Spotify application client secret
            redirect_uri: OAuth redirect URI
            scopes: List of required Spotify scopes
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self.scope_string = ' '.join(scopes)

        # Validate credentials
        if not self.client_id or self.client_id == 'change-me':
            raise ValueError('Spotify not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.')

        # Initialize SpotifyOAuth
        self.oauth = SpotifyOAuth(
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri=self.redirect_uri,
            scope=self.scope_string,
            show_dialog=True,  # Force user to reauthorize
            cache_path=None,  # Disable caching for stateless operation
        )

        logger.info('SpotifyAdapter initialized in LIVE mode')

    def _create_client(self, access_token: str) -> spotipy.Spotify:
        """Create a Spotify client with the given access token."""
        return spotipy.Spotify(auth=access_token)

    # OAuth and Authentication
    async def create_authorize_url(self, state: str) -> str:
        """Generate Spotify authorization URL."""
        try:
            auth_url = self.oauth.get_authorize_url(state=state)
            logger.info(f'Generated Spotify authorization URL with state: {state}')
            return auth_url
        except Exception as e:
            logger.error(f'Error generating authorization URL: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to generate authorization URL')

    async def handle_callback(self, code: str, state: str) -> dict[str, Any]:
        """Exchange authorization code for access and refresh tokens."""
        try:
            token_info = self.oauth.get_access_token(code, as_dict=True, check_cache=False)

            if not token_info:
                logger.error('Failed to obtain access token from Spotify')
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to exchange code for access token')

            logger.info('Successfully obtained access token from Spotify')
            return token_info
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error during token exchange: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error exchanging code for token: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to exchange code for access token')

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        """Refresh an expired access token."""
        try:
            token_info = self.oauth.refresh_access_token(refresh_token)

            if not token_info:
                logger.error('Failed to refresh access token')
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to refresh access token')

            logger.info('Successfully refreshed access token')
            return token_info
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error during token refresh: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error refreshing access token: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to refresh access token')

    async def get_user_info(self, access_token: str) -> dict[str, Any]:
        """Get user profile information from Spotify."""
        try:
            sp = self._create_client(access_token)
            user_info = sp.current_user()
            logger.info(f'Retrieved user info for user: {user_info.get("id", "unknown")}')
            return user_info
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error getting user info: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error getting user info: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to get user information')

    # Playback Control
    async def play_track(self, access_token: str, track_uri: str, device_id: str | None = None) -> dict[str, Any]:
        """Start playback of a specific track."""
        try:
            sp = self._create_client(access_token)
            sp.start_playback(device_id=device_id, uris=[track_uri])
            logger.info(f'Started playback of track {track_uri}')
            return {'status': 'playing', 'track_uri': track_uri, 'device_id': device_id}
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error playing track: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error playing track: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to play track')

    async def pause_playback(self, access_token: str, device_id: str | None = None) -> dict[str, Any]:
        """Pause current playback."""
        try:
            sp = self._create_client(access_token)
            sp.pause_playback(device_id=device_id)
            logger.info('Paused playback')
            return {'status': 'paused', 'device_id': device_id}
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error pausing playback: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error pausing playback: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to pause playback')

    async def get_playback_state(self, access_token: str) -> dict[str, Any]:
        """Get current playback state."""
        try:
            sp = self._create_client(access_token)
            playback = sp.current_playback()
            logger.info('Retrieved playback state')
            return playback or {}
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error getting playback state: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error getting playback state: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to get playback state')

    # Search and Track Information
    async def search_tracks(self, access_token: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """Search for tracks on Spotify."""
        try:
            sp = self._create_client(access_token)
            results = sp.search(q=query, type='track', limit=limit)
            tracks = results.get('tracks', {}).get('items', [])

            # Normalize track data to match our interface
            normalized_tracks = []
            for track in tracks:
                normalized_tracks.append(
                    {
                        'id': track['id'],
                        'uri': track['uri'],
                        'name': track['name'],
                        'artist': ', '.join(artist['name'] for artist in track['artists']),
                        'album': track['album']['name'],
                        'duration_ms': track['duration_ms'],
                        'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    }
                )

            logger.info(f'Found {len(normalized_tracks)} tracks for query: {query}')
            return normalized_tracks
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error searching tracks: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error searching tracks: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to search tracks')

    async def get_track_info(self, access_token: str, track_id: str) -> dict[str, Any]:
        """Get detailed information about a specific track."""
        try:
            sp = self._create_client(access_token)
            track = sp.track(track_id)

            # Normalize track data
            normalized_track = {
                'id': track['id'],
                'uri': track['uri'],
                'name': track['name'],
                'artist': ', '.join(artist['name'] for artist in track['artists']),
                'album': track['album']['name'],
                'duration_ms': track['duration_ms'],
                'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'popularity': track.get('popularity', 0),
                'preview_url': track.get('preview_url'),
            }

            logger.info(f'Retrieved track info for: {track_id}')
            return normalized_track
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error getting track info: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error getting track info: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to get track information')

    # Device Management
    async def get_available_devices(self, access_token: str) -> list[dict[str, Any]]:
        """Get list of available Spotify playback devices."""
        try:
            sp = self._create_client(access_token)
            devices = sp.devices()
            device_list = devices.get('devices', [])

            logger.info(f'Retrieved {len(device_list)} available devices')
            return device_list
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error getting devices: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error getting devices: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to get available devices')

    async def transfer_playback(self, access_token: str, device_id: str, play: bool = False) -> dict[str, Any]:
        """Transfer playback to a different device."""
        try:
            sp = self._create_client(access_token)
            sp.transfer_playback(device_id=device_id, force_play=play)
            logger.info(f'Transferred playback to device: {device_id}')
            return {
                'status': 'transferred',
                'device_id': device_id,
                'is_playing': play,
            }
        except spotipy.SpotifyException as e:
            logger.error(f'Spotify API error transferring playback: {e}')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Spotify API error: {str(e)}')
        except Exception as e:
            logger.error(f'Error transferring playback: {e}')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to transfer playback')
