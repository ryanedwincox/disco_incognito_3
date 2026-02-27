"""Tests for POST /api/rooms/{room_code}/reveal endpoint.

Tests the host-only reveal results feature that bypasses the all-voted
requirement during the guessing phase.
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.storage import get_storage_adapter
from app.models.room import CurrentRound, Player, RoomState, Song, SongInfo, SongPair


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


# ── Large-room helpers (>8 players → 2 incognito) ─────────────────────────────

def _make_lobby_room_9_players() -> dict:
    """Build a 9-player lobby room with 1 song pair (triggers 2-incognito logic on start)."""
    now = datetime.utcnow()
    song_a = Song(id='song-aaa', title='Song A', artist='Artist A', added_by='host-user', created_at=now)
    song_b = Song(id='song-bbb', title='Song B', artist='Artist B', added_by='host-user', created_at=now)
    pair = SongPair(id='pair-001', song_a=song_a, song_b=song_b, added_by='host-user', created_at=now)
    players = [Player(id='host-user', display_name='Host', is_host=True)] + [
        Player(id=f'player-{i}', display_name=f'Player {i}') for i in range(2, 10)
    ]
    room = RoomState(
        code='999',
        host_id='host-user',
        players=players,
        status='lobby',
        song_pairs=[pair],
    )
    return room.model_dump(mode='json')


def _make_results_room_two_incognito(votes: dict[str, str]) -> dict:
    """Build a 9-player results room with 2 incognito players (player-2 and player-3).

    Design note: votes is dict[str, str] — one guess per voter. In a 2-incognito round
    a voter can name only one suspect. Correct means guessing *either* incognito player;
    there is no requirement to name both. See get_results logic in rooms.py:
    correct if guessed_id in incognito_player_ids.
    """
    song_a = SongInfo(id='song-aaa', title='Song A', artist='Artist A')
    song_b = SongInfo(id='song-bbb', title='Song B', artist='Artist B')
    players = [Player(id='host-user', display_name='Host', is_host=True)] + [
        Player(id=f'player-{i}', display_name=f'Player {i}') for i in range(2, 10)
    ]
    incognito_ids = {'player-2', 'player-3'}
    current_round = CurrentRound(
        song_for_majority=song_a,
        song_for_incognito=song_b,
        incognito_player_ids=['player-2', 'player-3'],
        player_assignments={p.id: (song_b if p.id in incognito_ids else song_a) for p in players},
        votes=votes,
    )
    room = RoomState(
        code='999',
        host_id='host-user',
        players=players,
        status='results',
        dancer_incognito_player_ids=['player-2', 'player-3'],
        current_round=current_round,
    )
    return room.model_dump(mode='json')


# ── 2-incognito tests ──────────────────────────────────────────────────────────

def test_start_game_large_room_assigns_two_incognito(client, reveal_storage):
    """start_game with >8 players assigns exactly 2 incognito players."""
    reveal_storage.rooms['999'] = _make_lobby_room_9_players()

    response = client.post('/api/rooms/999/start', json={'player_id': 'host-user'})

    assert response.status_code == 200
    stored = reveal_storage.rooms['999']
    room_after = RoomState(**stored)
    assert room_after.current_round is not None
    assert len(room_after.current_round.incognito_player_ids) == 2
    assert room_after.status == 'song_selection'


def test_get_results_two_incognito_correct_guess(client, reveal_storage):
    """Guessing either incognito player is correct in a 2-incognito round.

    Correct = guessed_id in incognito_player_ids. Naming one of the two incognito
    players is sufficient; the voter need not identify both.
    """
    reveal_storage.rooms['999'] = _make_results_room_two_incognito(
        votes={'host-user': 'player-2'}  # player-2 IS incognito
    )

    response = client.get('/api/rooms/999/results')

    assert response.status_code == 200
    data = response.json()
    assert len(data['incognito_player_ids']) == 2
    assert 'host-user' in data['correct_guessers']


def test_get_results_two_incognito_wrong_guess(client, reveal_storage):
    """Guessing a non-incognito player is incorrect in a 2-incognito round."""
    reveal_storage.rooms['999'] = _make_results_room_two_incognito(
        votes={'host-user': 'player-4'}  # player-4 is NOT incognito
    )

    response = client.get('/api/rooms/999/results')

    assert response.status_code == 200
    data = response.json()
    assert 'host-user' not in data['correct_guessers']


def test_finish_round_resets_dancer_incognito_ids(client, reveal_storage):
    """finish_round resets dancer_incognito_player_ids to [] regardless of round size."""
    reveal_storage.rooms['999'] = _make_results_room_two_incognito(
        votes={'host-user': 'player-2'}
    )

    response = client.post('/api/rooms/999/finish-round', json={'player_id': 'host-user'})

    assert response.status_code == 200
    stored = reveal_storage.rooms['999']
    assert stored['dancer_incognito_player_ids'] == []
    assert stored['status'] == 'lobby'
    assert stored['current_round'] is None
