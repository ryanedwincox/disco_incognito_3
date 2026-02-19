"""
Tests for the POST /api/auth/update-name endpoint and custom_name resolution.

Validates that:
- Custom name can be set and persists in verify response
- Custom name is used in room creation (via auth dependency resolution)
- Clearing custom name reverts to original display_name
- Whitespace is stripped; whitespace-only input clears the name
- Unauthenticated requests are rejected
- Rejoin updates display_name on existing player
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.storage import get_storage_adapter

from tests.conftest import MockStorage, auth_header


@pytest.fixture
def mock_storage():
    """Create a fresh mock storage with pre-populated user sessions."""
    storage = MockStorage()
    storage.sessions = {
        'test-token-1': {
            'user_id': 'test-user-1',
            'display_name': 'Funky Dancer',
        },
        'test-token-2': {
            'user_id': 'test-user-2',
            'display_name': 'Groovy Star',
        },
    }
    return storage


@pytest.fixture
def client(mock_storage):
    """Create a test client with mock storage."""
    app.dependency_overrides[get_storage_adapter] = lambda: mock_storage
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestUpdateNameEndpoint:
    """Tests for POST /api/auth/update-name."""

    def test_set_custom_name(self, client):
        """Setting a custom name returns the new effective display_name."""
        response = client.post(
            '/api/auth/update-name',
            json={'custom_name': 'Cool Cat'},
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        assert response.json()['display_name'] == 'Cool Cat'

    def test_custom_name_persists_in_verify(self, client):
        """After setting custom name, /auth/verify returns it."""
        # Set custom name
        client.post(
            '/api/auth/update-name',
            json={'custom_name': 'DJ Sparkle'},
            headers=auth_header('test-token-1'),
        )

        # Verify returns custom_name
        response = client.get(
            '/api/auth/verify',
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        data = response.json()
        assert data['display_name'] == 'DJ Sparkle'
        assert data['custom_name'] == 'DJ Sparkle'

    def test_custom_name_used_in_room_creation(self, client):
        """Room creation uses the resolved custom name from auth dependency."""
        # Set custom name
        client.post(
            '/api/auth/update-name',
            json={'custom_name': 'Party Boss'},
            headers=auth_header('test-token-1'),
        )

        # Create room
        response = client.post(
            '/api/rooms',
            json={'room_code': '123'},
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        data = response.json()
        assert data['players'][0]['display_name'] == 'Party Boss'

    def test_clear_custom_name_reverts_to_original(self, client):
        """Sending null clears custom_name and reverts to original name."""
        # Set custom name first
        client.post(
            '/api/auth/update-name',
            json={'custom_name': 'Temp Name'},
            headers=auth_header('test-token-1'),
        )

        # Clear it
        response = client.post(
            '/api/auth/update-name',
            json={'custom_name': None},
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        assert response.json()['display_name'] == 'Funky Dancer'

        # Verify also shows original name
        verify = client.get(
            '/api/auth/verify',
            headers=auth_header('test-token-1'),
        )
        assert verify.json()['display_name'] == 'Funky Dancer'
        assert verify.json()['custom_name'] == ''

    def test_strips_whitespace(self, client):
        """Leading/trailing whitespace is stripped from custom name."""
        response = client.post(
            '/api/auth/update-name',
            json={'custom_name': '  Trimmed Name  '},
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        assert response.json()['display_name'] == 'Trimmed Name'

    def test_whitespace_only_clears(self, client):
        """Whitespace-only input is treated as a clear (reverts to original)."""
        # Set a custom name first
        client.post(
            '/api/auth/update-name',
            json={'custom_name': 'Will Be Cleared'},
            headers=auth_header('test-token-1'),
        )

        # Send whitespace-only
        response = client.post(
            '/api/auth/update-name',
            json={'custom_name': '   '},
            headers=auth_header('test-token-1'),
        )

        assert response.status_code == 200
        assert response.json()['display_name'] == 'Funky Dancer'

    def test_unauthenticated_rejected(self, client):
        """Requests without valid auth are rejected with 401."""
        response = client.post(
            '/api/auth/update-name',
            json={'custom_name': 'Hacker'},
        )

        assert response.status_code == 401


class TestRejoinUpdatesDisplayName:
    """Test that rejoining a room updates the player's display_name."""

    def test_rejoin_updates_display_name(self, client):
        """Leave and rejoin with a new custom name updates the Player record."""
        # Create room as user 1
        client.post(
            '/api/rooms',
            json={'room_code': '456'},
            headers=auth_header('test-token-1'),
        )

        # User 2 joins
        client.post(
            '/api/rooms/456/join',
            json={'player_id': 'test-user-2', 'display_name': 'Groovy Star'},
        )

        # User 2 sets a custom name (session-level)
        client.post(
            '/api/auth/update-name',
            json={'custom_name': 'New Groovy'},
            headers=auth_header('test-token-2'),
        )

        # User 2 rejoins with the new name
        response = client.post(
            '/api/rooms/456/join',
            json={'player_id': 'test-user-2', 'display_name': 'New Groovy'},
        )

        assert response.status_code == 200
        players = response.json()['players']
        user2 = next(p for p in players if p['id'] == 'test-user-2')
        assert user2['display_name'] == 'New Groovy'
