"""Application configuration via Pydantic Settings.

Loads and validates configuration from environment variables including Spotify credentials,
storage settings, CORS origins, and debug flags. Uses Pydantic Settings for automatic
environment variable parsing and validation.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    backend_url: AnyHttpUrl = Field('http://localhost:8000', alias='BACKEND_URL')
    frontend_url: AnyHttpUrl = Field('http://localhost:3000', alias='FRONTEND_URL')
    spotify_client_id: str = Field('change-me', alias='SPOTIFY_CLIENT_ID')
    spotify_client_secret: str = Field('change-me', alias='SPOTIFY_CLIENT_SECRET')
    spotify_redirect_uri: AnyHttpUrl = Field('http://localhost:8000/api/auth/callback', alias='SPOTIFY_REDIRECT_URI')
    spotify_mode: str = Field('test', alias='SPOTIFY_MODE')
    music_service: str = Field('spotify', alias='MUSIC_SERVICE')
    session_storage: str = Field('json_file', alias='SESSION_STORAGE')
    session_storage_file: str = Field('./data/disco_incognito.json', alias='SESSION_STORAGE_FILE')
    allowed_origins: str = Field('http://localhost:3000', alias='ALLOWED_ORIGINS')
    jwt_secret_key: str = Field('super-secret-key', alias='JWT_SECRET_KEY')
    session_secret: str = Field('development-secret', alias='SESSION_SECRET')
    debug: bool = Field(True, alias='DEBUG')
    log_level: str = Field('INFO', alias='LOG_LEVEL')

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse allowed_origins string into a list."""
        if not self.allowed_origins:
            return []
        # Handle comma-separated values
        return [origin.strip() for origin in self.allowed_origins.split(',')]

    model_config = SettingsConfigDict(
        env_file=[Path(__file__).resolve().parents[2] / '.env', Path(__file__).resolve().parents[3] / '.env'],
        env_file_encoding='utf-8',
        frozen=True,
        extra='allow',
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
