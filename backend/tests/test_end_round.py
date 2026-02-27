"""Tests for POST /api/rooms/{room_code}/end-round endpoint.

Tests the host-only end-round feature that transitions song_selection → guessing.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.storage import get_storage_adapter
from app.models.room import CurrentRound, Player, RoomState, SongInfo


def auth_header(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def _make_song_selection_room() -> dict:
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
    )

    room = RoomState(
        code='999',
        host_id='host-user',
        players=players,
        status='song_selection',
        dancer_incognito_player_ids=['player-2'],
        current_round=current_round,
    )
    return room.model_dump(mode='json')


@pytest.fixture
def end_round_storage(mock_storage):
    mock_storage.sessions = {
        'test-token-host': {'user_id': 'host-user', 'display_name': 'Host'},
        'test-token-player2': {'user_id': 'player-2', 'display_name': 'Player 2'},
    }
    return mock_storage


@pytest.fixture
def client(end_round_storage):
    app.dependency_overrides[get_storage_adapter] = lambda: end_round_storage
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_end_round_transitions_to_guessing(client, end_round_storage):
    end_round_storage.rooms['999'] = _make_song_selection_room()

    response = client.post(
        '/api/rooms/999/end-round',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 200
    assert response.json()['status'] == 'guessing'
    assert end_round_storage.rooms['999']['status'] == 'guessing'


def test_end_round_rejects_non_host(client, end_round_storage):
    end_round_storage.rooms['999'] = _make_song_selection_room()

    response = client.post(
        '/api/rooms/999/end-round',
        json={'player_id': 'player-2'},
        headers=auth_header('test-token-player2'),
    )

    assert response.status_code == 403
    assert 'Only the host' in response.json()['detail']


def test_end_round_rejects_wrong_status(client, end_round_storage):
    room_data = _make_song_selection_room()
    room_data['status'] = 'guessing'
    end_round_storage.rooms['999'] = room_data

    response = client.post(
        '/api/rooms/999/end-round',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 400
    assert 'Cannot end round from guessing' in response.json()['detail']


def test_end_round_rejects_lobby_status(client, end_round_storage):
    room = RoomState(
        code='999',
        host_id='host-user',
        players=[Player(id='host-user', display_name='Host', is_host=True)],
        status='lobby',
    )
    end_round_storage.rooms['999'] = room.model_dump(mode='json')

    response = client.post(
        '/api/rooms/999/end-round',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 400
    assert 'Cannot end round from lobby' in response.json()['detail']


def test_end_round_rejects_missing_round(client, end_round_storage):
    """End-round with no active current_round should return 400."""
    room = RoomState(
        code='999',
        host_id='host-user',
        players=[Player(id='host-user', display_name='Host', is_host=True)],
        status='song_selection',
        current_round=None,
    )
    end_round_storage.rooms['999'] = room.model_dump(mode='json')

    response = client.post(
        '/api/rooms/999/end-round',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 400
    assert 'No active round' in response.json()['detail']


def test_end_round_room_not_found(client):
    response = client.post(
        '/api/rooms/000/end-round',
        json={'player_id': 'host-user'},
        headers=auth_header('test-token-host'),
    )

    assert response.status_code == 404
