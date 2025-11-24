"""
Automated tests for authentication and login endpoints.

Tests the test-login endpoint that creates random disco-themed users.
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


def test_test_login_endpoint_exists(client):
    """Test that the test-login endpoint exists and is accessible."""
    response = client.post('/api/auth/test-login')
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_test_login_creates_user(client):
    """Test that test-login creates a user with all required fields."""
    response = client.post('/api/auth/test-login')

    assert response.status_code == 200
    data = response.json()

    # Check all required fields are present
    assert 'access_token' in data
    assert 'refresh_token' in data
    assert 'expires_in' in data
    assert 'user_id' in data
    assert 'display_name' in data
    assert 'email' in data

    # Check field values are not empty
    assert data['access_token'] != ''
    assert data['user_id'] != ''
    assert data['display_name'] != ''
    assert data['email'] != ''


def test_test_login_returns_valid_tokens(client):
    """Test that test-login returns valid token format."""
    response = client.post('/api/auth/test-login')

    assert response.status_code == 200
    data = response.json()

    # Check token format - tokens are now unique per session for security
    assert data['access_token'].startswith('test_token_')
    assert len(data['access_token']) > len('test_token_')
    assert data['refresh_token'] == 'test-refresh-token'
    assert data['expires_in'] == '3600'


def test_test_login_creates_unique_users(client):
    """Test that each call to test-login creates a different user."""
    # Create 5 users
    users = []
    for _ in range(5):
        response = client.post('/api/auth/test-login')
        assert response.status_code == 200
        users.append(response.json())

    # Extract user IDs and display names
    user_ids = [user['user_id'] for user in users]
    display_names = [user['display_name'] for user in users]

    # All user IDs should be unique
    assert len(user_ids) == len(set(user_ids)), 'User IDs should be unique'

    # All display names should be unique (very high probability with 400 combinations)
    assert len(display_names) == len(set(display_names)), 'Display names should be unique'


def test_test_login_user_id_format(client):
    """Test that user IDs follow the expected format."""
    response = client.post('/api/auth/test-login')

    assert response.status_code == 200
    data = response.json()

    user_id = data['user_id']

    # Should start with "test-user-"
    assert user_id.startswith('test-user-')

    # Should have 8 hex characters after the prefix
    suffix = user_id.replace('test-user-', '')
    assert len(suffix) == 8
    assert all(c in '0123456789abcdef' for c in suffix)


def test_test_login_email_format(client):
    """Test that email addresses follow the expected format."""
    response = client.post('/api/auth/test-login')

    assert response.status_code == 200
    data = response.json()

    email = data['email']
    user_id = data['user_id']

    # Email should be user_id@disco.test
    assert email == f'{user_id}@disco.test'
    assert email.endswith('@disco.test')


def test_test_login_display_name_format(client):
    """Test that display names are disco-themed (adjective + noun)."""
    # List of valid adjectives and nouns from TestMusicAdapter
    valid_adjectives = [
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

    valid_nouns = [
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

    response = client.post('/api/auth/test-login')

    assert response.status_code == 200
    data = response.json()

    display_name = data['display_name']

    # Should have exactly one space (adjective + space + noun)
    assert display_name.count(' ') == 1

    parts = display_name.split(' ')
    assert len(parts) == 2

    adjective, noun = parts

    # Check that parts are from valid lists
    assert adjective in valid_adjectives, f"'{adjective}' not in valid adjectives"
    assert noun in valid_nouns, f"'{noun}' not in valid nouns"


def test_test_login_randomness(client):
    """Test that test-login generates different users over multiple calls."""
    # Create 10 users and check distribution
    display_names = []

    for _ in range(10):
        response = client.post('/api/auth/test-login')
        assert response.status_code == 200
        display_names.append(response.json()['display_name'])

    # At least 8 out of 10 should be unique (allowing for some collisions)
    unique_names = set(display_names)
    assert len(unique_names) >= 8, f'Expected at least 8 unique names, got {len(unique_names)}'


def test_login_endpoint_in_live_mode_returns_oauth_url(client):
    """Test that /auth/login in live mode returns OAuth authorization URL."""
    # Patch to simulate live mode
    mock_settings = Settings(
        SPOTIFY_MODE='live',
        DEBUG=True,
    )

    with patch('app.api.routes.auth.settings', mock_settings):
        response = client.get('/api/auth/login')

    assert response.status_code == 200
    data = response.json()

    # In live mode, should return authorization URL
    assert 'authorize_url' in data
    assert 'state' in data
    assert 'message' in data


def test_login_endpoint_in_test_mode_returns_mock_auth(client):
    """Test that /auth/login in test mode returns mock auth data directly."""
    # Patch to ensure test mode
    mock_settings = Settings(
        SPOTIFY_MODE='test',
        DEBUG=True,
    )

    with patch('app.api.routes.auth.settings', mock_settings):
        response = client.get('/api/auth/login')

    assert response.status_code == 200
    data = response.json()

    # In test mode, should return mock auth data (no OAuth redirect)
    assert 'access_token' in data
    assert 'user_id' in data
    assert 'display_name' in data
    assert 'authorize_url' not in data


def test_logout_endpoint_works(client):
    """Test that logout endpoint exists and works."""
    response = client.post('/api/auth/logout')

    assert response.status_code == 200
    data = response.json()

    assert 'message' in data
    assert data['message'] == 'Logged out successfully'


# Integration test
def test_complete_test_login_flow(client):
    """Test the complete flow: login -> verify user -> check data consistency."""
    # Step 1: Create a test user
    login_response = client.post('/api/auth/test-login')
    assert login_response.status_code == 200

    user_data = login_response.json()

    # Step 2: Verify all data is consistent
    assert user_data['user_id'] in user_data['email']
    assert len(user_data['display_name']) > 0
    assert len(user_data['access_token']) > 0

    # Step 3: Verify tokens are present
    assert user_data['access_token'] is not None
    assert user_data['refresh_token'] is not None

    print(f'\n✅ Test user created successfully: {user_data["display_name"]}')
    print(f'   User ID: {user_data["user_id"]}')
    print(f'   Email: {user_data["email"]}')
