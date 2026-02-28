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
    """Create a test user via guest login and return token + user info."""
    response = client.post(
        '/api/auth/login',
        json={'display_name': 'Test Dancer'},
    )
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


class TestVerifyEndpointWithGuestLogin:
    """Tests for /auth/verify with guest login tokens."""

    def test_guest_login_token_valid(self, client):
        """Guest login tokens are valid for verify."""
        # Create guest user
        response = client.post(
            '/api/auth/login',
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


class TestDeterministicUserId:
    """Tests for deterministic user_id generation based on display name."""

    def test_same_display_name_same_user_id(self, client):
        """Two logins with the same display name produce identical user_ids."""
        login1 = client.post('/api/auth/login', json={'display_name': 'Alice'})
        login2 = client.post('/api/auth/login', json={'display_name': 'Alice'})

        assert login1.status_code == 200
        assert login2.status_code == 200
        assert login1.json()['user_id'] == login2.json()['user_id']

    def test_different_display_names_different_user_ids(self, client):
        """Two logins with different display names produce different user_ids."""
        login1 = client.post('/api/auth/login', json={'display_name': 'Alice'})
        login2 = client.post('/api/auth/login', json={'display_name': 'Bob'})

        assert login1.status_code == 200
        assert login2.status_code == 200
        assert login1.json()['user_id'] != login2.json()['user_id']

    def test_display_name_case_insensitive(self, client):
        """Display name comparison for user_id is case-insensitive."""
        login_lower = client.post('/api/auth/login', json={'display_name': 'alice'})
        login_upper = client.post('/api/auth/login', json={'display_name': 'ALICE'})
        login_mixed = client.post('/api/auth/login', json={'display_name': 'Alice'})

        assert login_lower.status_code == 200
        assert login_upper.status_code == 200
        assert login_mixed.status_code == 200

        uid_lower = login_lower.json()['user_id']
        uid_upper = login_upper.json()['user_id']
        uid_mixed = login_mixed.json()['user_id']

        assert uid_lower == uid_upper == uid_mixed

    def test_display_name_whitespace_stripped(self, client):
        """Leading/trailing whitespace in display name does not affect user_id."""
        login_clean = client.post('/api/auth/login', json={'display_name': 'Bob'})
        login_padded = client.post('/api/auth/login', json={'display_name': '  Bob  '})

        assert login_clean.status_code == 200
        assert login_padded.status_code == 200
        assert login_clean.json()['user_id'] == login_padded.json()['user_id']
