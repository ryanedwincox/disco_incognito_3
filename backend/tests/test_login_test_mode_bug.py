"""
Test to reproduce the SPOTIFY_MODE=test login bug.

BUG: Login should use mock auth when SPOTIFY_MODE=test instead of real Spotify OAuth.
     Currently, clicking 'Login with Spotify' redirects to real Spotify OAuth even
     when SPOTIFY_MODE=test is set.

Expected: With SPOTIFY_MODE=test, calling /api/auth/login should return mock auth data
          directly (access_token, user_id, display_name) without requiring OAuth redirect.

Actual: /api/auth/login always returns {authorize_url, state, message} regardless of
        SPOTIFY_MODE setting, forcing the user to go through OAuth flow.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.settings import Settings


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


class TestLoginTestModeBug:
    """Tests to verify the SPOTIFY_MODE=test login bug exists."""

    def test_login_in_test_mode_should_return_mock_auth_data_directly(self, client):
        """
        BUG REPRODUCTION TEST

        When SPOTIFY_MODE=test, the /api/auth/login endpoint should return
        mock authentication data directly without requiring an OAuth redirect.

        Expected response format:
        {
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "expires_in": "3600",
            "user_id": "test-user-xxx",
            "display_name": "Some Disco Name",
            "email": "test-user-xxx@disco.test"
        }

        Actual (buggy) response format:
        {
            "authorize_url": "https://...",
            "state": "xxx",
            "message": "Navigate to the authorize_url..."
        }
        """
        # Patch settings to ensure SPOTIFY_MODE=test
        mock_settings = Settings(
            SPOTIFY_MODE='test',
            DEBUG=True,
        )

        with patch('app.api.routes.auth.settings', mock_settings):
            response = client.get('/api/auth/login')

        assert response.status_code == 200
        data = response.json()

        # BUG: Currently this assertion FAILS because /login returns OAuth URL
        # instead of mock auth data when SPOTIFY_MODE=test

        # These fields should be present in test mode (immediate auth)
        assert 'access_token' in data, (
            "BUG: /api/auth/login in test mode should return access_token directly, "
            f"but got: {data.keys()}"
        )
        assert 'user_id' in data, (
            "BUG: /api/auth/login in test mode should return user_id directly, "
            f"but got: {data.keys()}"
        )
        assert 'display_name' in data, (
            "BUG: /api/auth/login in test mode should return display_name directly, "
            f"but got: {data.keys()}"
        )

        # These fields should NOT be present in test mode (no OAuth needed)
        assert 'authorize_url' not in data, (
            "BUG: /api/auth/login in test mode should NOT return authorize_url "
            "(no OAuth redirect needed)"
        )
        assert 'state' not in data, (
            "BUG: /api/auth/login in test mode should NOT return state "
            "(no OAuth redirect needed)"
        )

    def test_login_in_test_mode_should_not_return_oauth_fields(self, client):
        """
        Verify the bug is fixed: /api/auth/login in test mode should NOT return
        OAuth-related fields (authorize_url, state).

        This test was inverted from the original "proving bug exists" test
        after the bug was fixed.
        """
        # Patch settings to ensure SPOTIFY_MODE=test
        mock_settings = Settings(
            SPOTIFY_MODE='test',
            DEBUG=True,
        )

        with patch('app.api.routes.auth.settings', mock_settings):
            response = client.get('/api/auth/login')

        assert response.status_code == 200
        data = response.json()

        # Bug is FIXED: In test mode, we should NOT get OAuth fields
        assert 'authorize_url' not in data, (
            "BUG REGRESSION: /api/auth/login should NOT return authorize_url in test mode"
        )
        assert 'state' not in data, (
            "BUG REGRESSION: /api/auth/login should NOT return state in test mode"
        )

        # Verify it IS returning mock auth data (bug is fixed)
        assert 'access_token' in data, (
            "BUG REGRESSION: /api/auth/login should return access_token in test mode"
        )
        assert 'user_id' in data, (
            "BUG REGRESSION: /api/auth/login should return user_id in test mode"
        )

    def test_login_should_behave_like_test_login_in_test_mode(self, client):
        """
        In test mode, /api/auth/login should return the same response format
        as /api/auth/test-login.

        This is the expected behavior when SPOTIFY_MODE=test.
        """
        # Patch settings to ensure SPOTIFY_MODE=test
        mock_settings = Settings(
            SPOTIFY_MODE='test',
            DEBUG=True,
        )

        # Get response from /test-login (known working endpoint)
        test_login_response = client.post('/api/auth/test-login')
        assert test_login_response.status_code == 200
        test_login_data = test_login_response.json()

        # Get response from /login in test mode
        with patch('app.api.routes.auth.settings', mock_settings):
            login_response = client.get('/api/auth/login')

        assert login_response.status_code == 200
        login_data = login_response.json()

        # BUG: These two endpoints should return the same keys in test mode
        test_login_keys = set(test_login_data.keys())
        login_keys = set(login_data.keys())

        # Expected keys from /test-login
        expected_keys = {'access_token', 'refresh_token', 'expires_in',
                        'user_id', 'display_name', 'email'}

        # /test-login returns correct keys
        assert expected_keys.issubset(test_login_keys), (
            f"/test-login missing expected keys. Has: {test_login_keys}"
        )

        # BUG: /login does NOT return the same keys in test mode
        assert expected_keys.issubset(login_keys), (
            f"BUG: /login in test mode should return same keys as /test-login. "
            f"/login has: {login_keys}, /test-login has: {test_login_keys}"
        )
