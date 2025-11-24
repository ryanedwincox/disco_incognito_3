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

    async def load(self):
        return {'rooms': self.rooms}

    async def save(self, state):
        self.rooms = state.get('rooms', {})

    async def get_room(self, room_code: str):
        return self.rooms.get(room_code)

    async def upsert_room(self, room_code: str, data):
        self.rooms[room_code] = data

    async def delete_room(self, room_code: str):
        self.rooms.pop(room_code, None)


@pytest.fixture
def mock_storage():
    """Create a fresh mock storage for each test."""
    return MockStorage()


@pytest.fixture
def client(mock_storage):
    """Create a test client with mock storage."""
    app.dependency_overrides[get_storage_adapter] = lambda: mock_storage
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_create_room_endpoint_exists(client):
    """Test that the POST /api/rooms endpoint exists."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '123'},
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'Test User'}
    )
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_create_room_returns_room_data(client):
    """Test that creating a room returns correct room data."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '456'},
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'Test Host'}
    )

    assert response.status_code == 200
    data = response.json()

    assert data['code'] == '456'
    assert data['host_id'] == 'user-1'
    assert data['status'] == 'lobby'
    assert len(data['players']) == 1
    assert data['players'][0]['id'] == 'user-1'
    assert data['players'][0]['display_name'] == 'Test Host'
    assert data['players'][0]['is_host'] is True
    assert data['players'][0]['is_connected'] is True


def test_create_room_stores_in_storage(client, mock_storage):
    """Test that creating a room stores it in storage."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '789'},
        headers={'X-User-Id': 'user-2', 'X-Display-Name': 'Storage Test'}
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
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'First Host'}
    )
    assert response1.status_code == 200

    # Try to create room with same code
    response2 = client.post(
        '/api/rooms',
        json={'room_code': '111'},
        headers={'X-User-Id': 'user-2', 'X-Display-Name': 'Second Host'}
    )
    assert response2.status_code == 409
    assert 'already exists' in response2.json()['detail']


def test_create_room_requires_user_id_header(client):
    """Test that X-User-Id header is required."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '222'}
    )
    assert response.status_code == 422


def test_create_room_validates_room_code_format(client):
    """Test that room code must be exactly 3 digits."""
    # Too short
    response = client.post(
        '/api/rooms',
        json={'room_code': '12'},
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'Test'}
    )
    assert response.status_code == 422

    # Too long
    response = client.post(
        '/api/rooms',
        json={'room_code': '1234'},
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'Test'}
    )
    assert response.status_code == 422

    # Non-numeric
    response = client.post(
        '/api/rooms',
        json={'room_code': 'abc'},
        headers={'X-User-Id': 'user-1', 'X-Display-Name': 'Test'}
    )
    assert response.status_code == 422


def test_create_room_uses_default_display_name(client):
    """Test that display name defaults to Guest if not provided."""
    response = client.post(
        '/api/rooms',
        json={'room_code': '333'},
        headers={'X-User-Id': 'user-1'}
    )

    assert response.status_code == 200
    data = response.json()
    assert data['players'][0]['display_name'] == 'Guest'
