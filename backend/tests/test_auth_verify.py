"""
Tests for the /auth/verify endpoint.

Validates that:
- Valid tokens return 200 with user info
- Invalid/missing tokens return 401
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def authenticated_user(client):
    """Create a test user and return token + user info."""
    response = client.post('/api/auth/test-login')
    assert response.status_code == 200
    return response.json()


class TestVerifyEndpoint:
    """Tests for GET /api/auth/verify."""

    def test_valid_token_returns_200_with_user_info(self, client, authenticated_user):
        """Valid token returns 200 and user_id + display_name."""
        token = authenticated_user['access_token']

        response = client.get(
            '/api/auth/verify',
            headers={'Authorization': f'Bearer {token}'},
        )

        assert response.status_code == 200
        data = response.json()
        assert 'user_id' in data
        assert 'display_name' in data
        assert data['user_id'] == authenticated_user['user_id']
        assert data['display_name'] == authenticated_user['display_name']

    def test_missing_auth_header_returns_401(self, client):
        """Missing Authorization header returns 401."""
        response = client.get('/api/auth/verify')

        assert response.status_code == 401
        assert 'detail' in response.json()

    def test_missing_bearer_prefix_returns_401(self, client, authenticated_user):
        """Token without 'Bearer ' prefix returns 401."""
        token = authenticated_user['access_token']

        response = client.get(
            '/api/auth/verify',
            headers={'Authorization': token},  # Missing 'Bearer ' prefix
        )

        assert response.status_code == 401
        assert 'detail' in response.json()

    def test_invalid_token_returns_401(self, client):
        """Invalid token returns 401."""
        response = client.get(
            '/api/auth/verify',
            headers={'Authorization': 'Bearer invalid_token_12345'},
        )

        assert response.status_code == 401
        assert 'detail' in response.json()

    def test_empty_token_returns_401(self, client):
        """Empty token after 'Bearer ' returns 401."""
        response = client.get(
            '/api/auth/verify',
            headers={'Authorization': 'Bearer '},
        )

        assert response.status_code == 401
        assert 'detail' in response.json()

    def test_malformed_header_returns_401(self, client):
        """Malformed Authorization header returns 401."""
        response = client.get(
            '/api/auth/verify',
            headers={'Authorization': 'Basic somebase64string'},
        )

        assert response.status_code == 401
        assert 'detail' in response.json()


class TestVerifyEndpointWithManualLogin:
    """Tests for /auth/verify with manual (guest) login tokens."""

    def test_manual_login_token_valid(self, client):
        """Manual login tokens are also valid for verify."""
        # Create guest user
        response = client.post(
            '/api/auth/manual-login',
            json={'display_name': 'Test Guest'},
        )
        assert response.status_code == 200
        guest_data = response.json()

        # Verify token works
        verify_response = client.get(
            '/api/auth/verify',
            headers={'Authorization': f'Bearer {guest_data["access_token"]}'},
        )

        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data['user_id'] == guest_data['user_id']
        assert data['display_name'] == guest_data['display_name']
