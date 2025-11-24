"""
Automated tests for room creation endpoint.

Tests POST /api/rooms endpoint for creating game rooms.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.storage import get_storage_adapter


class MockStorage:
    """In-memory mock storage for testing."""

    def __init__(self):
        self.rooms = {}
        self.sessions = {}

    async def load(self):
        return {'rooms': self.rooms, 'sessions': self.sessions}

    async def save(self, state):
        self.rooms = state.get('rooms', {})
        self.sessions = state.get('sessions', {})

    async def get_room(self, room_code: str):
        return self.rooms.get(room_code)

    async def upsert_room(self, room_code: str, data):
        self.rooms[room_code] = data

    async def delete_room(self, room_code: str):
        self.rooms.pop(room_code, None)

    async def get_session(self, token: str):
        return self.sessions.get(token)

    async def set_session(self, token: str, data):
        self.sessions[token] = data

    async def delete_session(self, token: str):
        self.sessions.pop(token, None)


@pytest.fixture
def mock_storage():
    """Create a fresh mock storage for each test."""
    storage = MockStorage()
    # Pre-populate test sessions
    storage.sessions = {
        'test-token-user-1': {'user_id': 'user-1', 'display_name': 'Test User'},
        'test-token-user-2': {'user_id': 'user-2', 'display_name': 'Second User'},
        'test-token-host': {'user_id': 'host-user', 'display_name': 'Test Host'},
        'test-token-storage': {'user_id': 'user-2', 'display_name': 'Storage Test'},
        'test-token-first': {'user_id': 'user-1', 'display_name': 'First Host'},
        'test-token-second': {'user_id': 'user-2', 'display_name': 'Second Host'},
        'test-token-guest': {'user_id': 'user-1', 'display_name': 'Guest'},
    }
    return storage


@pytest.fixture
def client(mock_storage):
    """Create a test client with mock storage."""
    app.dependency_overrides[get_storage_adapter] = lambda: mock_storage
    yield TestClient(app)
    app.dependency_overrides.clear()


def auth_header(token: str) -> dict:
    """Helper to create Authorization header."""
    return {'Authorization': f'Bearer {token}'}


def test_create_room_endpoint_exists(client):
    """Test that the POST /api/rooms endpoint exists."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '123'},
        headers=auth_header('test-token-user-1')
    )
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_create_room_returns_room_data(client):
    """Test that creating a room returns correct room data."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '456'},
        headers=auth_header('test-token-host')
    )

    assert response.status_code == 200
    data = response.json()

    assert data['code'] == '456'
    assert data['host_id'] == 'host-user'
    assert data['status'] == 'lobby'
    assert len(data['players']) == 1
    assert data['players'][0]['id'] == 'host-user'
    assert data['players'][0]['display_name'] == 'Test Host'
    assert data['players'][0]['is_host'] is True
    assert data['players'][0]['is_connected'] is True


def test_create_room_stores_in_storage(client, mock_storage):
    """Test that creating a room stores it in storage."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '789'},
        headers=auth_header('test-token-storage')
    )

    assert response.status_code == 200
    assert '789' in mock_storage.rooms
    assert mock_storage.rooms['789']['code'] == '789'
    assert mock_storage.rooms['789']['host_id'] == 'user-2'


def test_create_room_rejects_duplicate_code(client, mock_storage):
    """Test that creating a room with an existing code fails."""
    # Create first room
    response1 = client.post(
        '/api/rooms',
        json={'room_code': '111'},
        headers=auth_header('test-token-first')
    )
    assert response1.status_code == 200

    # Try to create room with same code
    response2 = client.post(
        '/api/rooms',
        json={'room_code': '111'},
        headers=auth_header('test-token-second')
    )
    assert response2.status_code == 409
    assert 'already exists' in response2.json()['detail']


def test_create_room_requires_auth(client):
    """Test that authentication is required (returns 401 without valid token)."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '222'}
    )
    assert response.status_code == 401


def test_create_room_rejects_invalid_token(client):
    """Test that invalid token returns 401."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '444'},
        headers=auth_header('invalid-token-not-in-session')
    )
    assert response.status_code == 401
    assert 'Invalid or expired' in response.json()['detail']


def test_create_room_validates_room_code_format(client):
    """Test that room code must be exactly 3 digits."""
    # Too short
    response = client.post(
        '/api/rooms',
        json={'room_code': '12'},
        headers=auth_header('test-token-user-1')
    )
    assert response.status_code == 422

    # Too long
    response = client.post(
        '/api/rooms',
        json={'room_code': '1234'},
        headers=auth_header('test-token-user-1')
    )
    assert response.status_code == 422

    # Non-numeric
    response = client.post(
        '/api/rooms',
        json={'room_code': 'abc'},
        headers=auth_header('test-token-user-1')
    )
    assert response.status_code == 422


def test_create_room_uses_display_name_from_session(client):
    """Test that display name comes from session, not header."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '333'},
        headers=auth_header('test-token-guest')
    )

    assert response.status_code == 200
    data = response.json()
    # Display name comes from session, not header
    assert data['players'][0]['display_name'] == 'Guest'
