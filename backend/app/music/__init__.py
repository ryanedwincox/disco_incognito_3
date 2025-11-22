"""Music streaming adapter module."""

from .base import MusicStreamingAdapter
from .test_adapter import TestMusicAdapter
from .spotify_adapter import SpotifyAdapter

__all__ = ['MusicStreamingAdapter', 'TestMusicAdapter', 'SpotifyAdapter']
