"""Tests for POST /api/rooms/{room_code}/reveal endpoint.

Tests the host-only reveal results feature that bypasses the all-voted
requirement during the guessing phase.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.storage import get_storage_adapter
from app.models.room import CurrentRound, Player, RoomState, SongInfo


def _make_guessing_room(votes: dict[str, str] | None = None) -> dict:
    """Build a room dict in 'guessing' status with 3 players and a current round."""
    song_a = SongInfo(id='song-aaa', title='Song A', artist='Artist A')
    song_b = SongInfo(id='song-bbb', title='Song B', artist='Artist B')

    players = [
        Player(id='host-user', display_name='Host', is_host=True),
        Player(id='player-2', display_name='Player 2'),
        Player(id='player-3', display_name='Player 3'),
    ]

    current_round = CurrentRound(
        song_for_majority=song_a,
        song_for_incognito=song_b,
        incognito_player_ids=['player-2'],
        player_assignments={
            'host-user': song_a,
            'player-2': song_b,
            'player-3': song_a,
        },
        votes=votes or {},
    )

    room = RoomState(
        code='999',
        host_id='host-user',
        players=players,
        status='guessing',
        dancer_incognito_player_ids=['player-2'],
        current_round=current_round,
    )
    return room.model_dump(mode='json')


def auth_header(token: str) -> dict:
    """Helper to create Authorization header."""
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def reveal_storage(mock_storage):
    """Extend shared mock_storage with sessions needed for reveal tests."""
    mock_storage.sessions = {
        'test-token-host': {'user_id': 'host-user', 'display_name': 'Host'},
        'test-token-player2': {'user_id': 'player-2', 'display_name': 'Player 2'},
    }
    return mock_storage


@pytest.fixture
def client(reveal_storage):
    """Create a test client with mock storage."""
    app.dependency_overrides[get_storage_adapter] = lambda: reveal_storage
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_reveal_endpoint_exists(client, reveal_storage):
    """Test that POST /api/rooms/{room_code}/reveal endpoint exists."""
    reveal_storage.rooms['999'] = _make_guessing_room()
    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )
    assert response.status_code != 404


def test_reveal_transitions_to_results(client, reveal_storage):
    """Test that reveal transitions room from guessing to results with partial votes."""
    reveal_storage.rooms['999'] = _make_guessing_room(votes={'player-3': 'player-2'})

    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'results'

    # Verify storage was updated
    stored = reveal_storage.rooms['999']
    assert stored['status'] == 'results'


def test_reveal_rejects_non_host(client, reveal_storage):
    """Test that non-host players cannot reveal results."""
    reveal_storage.rooms['999'] = _make_guessing_room()

    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'player-2'},
        headers=auth_header('test-token-player2'),
    )

    assert response.status_code == 403
    assert 'Only the host' in response.json()['detail']


def test_reveal_rejects_wrong_status_lobby(client, reveal_storage):
    """Test that reveal fails when room is in lobby status."""
    room = RoomState(
        code='999',
        host_id='host-user',
        players=[Player(id='host-user', display_name='Host', is_host=True)],
        status='lobby',
    )
    reveal_storage.rooms['999'] = room.model_dump(mode='json')

    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 400
    assert 'Cannot reveal from lobby' in response.json()['detail']


def test_reveal_rejects_wrong_status_playing(client, reveal_storage):
    """Test that reveal fails when room is in playing status."""
    room_data = _make_guessing_room()
    room_data['status'] = 'playing'
    reveal_storage.rooms['999'] = room_data

    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 400
    assert 'Cannot reveal from playing' in response.json()['detail']


def test_reveal_works_with_zero_votes(client, reveal_storage):
    """Test that reveal works when no votes have been cast."""
    reveal_storage.rooms['999'] = _make_guessing_room(votes={})

    response = client.post(
        '/api/rooms/999/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'results'


def test_reveal_room_not_found(client):
    """Test that reveal returns 404 for non-existent room."""
    response = client.post(
        '/api/rooms/000/reveal',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 404
