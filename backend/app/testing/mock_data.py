"""
Mock data seeding for realistic test screenshots and development.

This module provides functions to seed the storage with realistic test data
including rooms with players and song pairs in various states.
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime

from ..dependencies.storage import get_storage_adapter
from ..models.room import Player, RoomState, SongPair

logger = logging.getLogger(__name__)

# Fun disco-themed names matching the test adapter
DISCO_NAMES = [
    'Groovy Dancer',
    'Funky Star',
    'Sparkly Bee',
    'Dancing Tiger',
    'Boogie Eagle',
    'Glittery Phoenix',
    'Shiny Comet',
    'Swinging Diamond',
    'Electric Pearl',
    'Cosmic Unicorn',
    'Neon Knight',
    'Stellar Champion',
    'Jazzy Hero',
    'Rad Legend',
    'Cool Maverick',
    'Smooth Rebel',
    'Flashy Voyager',
    'Golden Dreamer',
    'Vivid Wizard',
    'Retro Ninja',
]

# Realistic disco/dance song pairs
SONG_PAIRS = [
    ("Stayin' Alive - Bee Gees", 'Night Fever - Bee Gees'),
    ('September - Earth, Wind & Fire', 'Boogie Wonderland - Earth, Wind & Fire'),
    ('I Will Survive - Gloria Gaynor', 'Never Can Say Goodbye - Gloria Gaynor'),
    ('Le Freak - Chic', 'Good Times - Chic'),
    ("Don't Stop 'Til You Get Enough - Michael Jackson", 'Rock With You - Michael Jackson'),
    ('Dancing Queen - ABBA', 'Gimme! Gimme! Gimme! - ABBA'),
    ('Ring My Bell - Anita Ward', 'Shake Your Groove Thing - Peaches & Herb'),
    ('Car Wash - Rose Royce', 'Best of My Love - The Emotions'),
]


def generate_test_player(name: str, is_host: bool = False) -> Player:
    """Generate a test player with the given name."""
    user_id = f'test-user-{uuid.uuid4().hex[:8]}'
    return Player(id=user_id, display_name=name, is_host=is_host, is_connected=True)


def generate_song_pair(player_id: str, song_a: str, song_b: str) -> SongPair:
    """Generate a song pair."""
    pair_id = f'pair-{uuid.uuid4().hex[:8]}'
    return SongPair(id=pair_id, track_a=f'spotify:track:{song_a}', track_b=f'spotify:track:{song_b}', added_by=player_id, created_at=datetime.utcnow())


async def seed_room_lobby_empty() -> None:
    """Seed: Room lobby with just 1 host, no song pairs (room code: 123)."""
    storage = get_storage_adapter()

    host = generate_test_player('Groovy Dancer', is_host=True)

    room = RoomState(code='123', host_id=host.id, players=[host], song_pairs=[], status='lobby')

    await storage.upsert_room('123', room.model_dump())
    logger.info('Seeded room 123: lobby with 1 player, no songs')


async def seed_room_lobby_with_players() -> None:
    """Seed: Room lobby with 7 players, no song pairs yet (room code: 456)."""
    storage = get_storage_adapter()

    # Create 7 players with unique disco names
    names = random.sample(DISCO_NAMES, 7)
    players = [generate_test_player(names[0], is_host=True)]  # First is host
    players.extend([generate_test_player(name) for name in names[1:]])

    room = RoomState(code='456', host_id=players[0].id, players=players, song_pairs=[], status='lobby')

    await storage.upsert_room('456', room.model_dump())
    logger.info('Seeded room 456: lobby with 7 players, no songs')


async def seed_room_lobby_ready() -> None:
    """Seed: Room lobby with 7 players and 3 song pairs ready to play (room code: 789)."""
    storage = get_storage_adapter()

    # Create 7 players
    names = random.sample(DISCO_NAMES, 7)
    players = [generate_test_player(names[0], is_host=True)]
    players.extend([generate_test_player(name) for name in names[1:]])

    # Add 3 song pairs from different players
    song_pairs = []
    for i in range(3):
        song_a, song_b = SONG_PAIRS[i]
        song_pair = generate_song_pair(player_id=players[i].id, song_a=song_a, song_b=song_b)
        song_pairs.append(song_pair)

    room = RoomState(code='789', host_id=players[0].id, players=players, song_pairs=song_pairs, status='lobby')

    await storage.upsert_room('789', room.model_dump())
    logger.info('Seeded room 789: lobby with 7 players and 3 song pairs')


async def seed_room_playing() -> None:
    """Seed: Room in playing state with 7 players and 3 song pairs (room code: 111)."""
    storage = get_storage_adapter()

    names = random.sample(DISCO_NAMES, 7)
    players = [generate_test_player(names[0], is_host=True)]
    players.extend([generate_test_player(name) for name in names[1:]])

    # Add 3 song pairs
    song_pairs = []
    for i in range(3):
        song_a, song_b = SONG_PAIRS[i]
        song_pair = generate_song_pair(player_id=players[i].id, song_a=song_a, song_b=song_b)
        song_pairs.append(song_pair)

    # Pick a random player as the dancer incognito
    dancer_incognito = random.choice(players)

    room = RoomState(code='111', host_id=players[0].id, players=players, song_pairs=song_pairs, status='playing', dancer_incognito_player_id=dancer_incognito.id)

    await storage.upsert_room('111', room.model_dump())
    logger.info(f'Seeded room 111: playing with 7 players, dancer incognito is {dancer_incognito.display_name}')


async def seed_room_guessing() -> None:
    """Seed: Room in guessing state (room code: 222)."""
    storage = get_storage_adapter()

    names = random.sample(DISCO_NAMES, 7)
    players = [generate_test_player(names[0], is_host=True)]
    players.extend([generate_test_player(name) for name in names[1:]])

    song_pairs = []
    for i in range(3):
        song_a, song_b = SONG_PAIRS[i]
        song_pair = generate_song_pair(player_id=players[i].id, song_a=song_a, song_b=song_b)
        song_pairs.append(song_pair)

    dancer_incognito = random.choice(players)

    room = RoomState(code='222', host_id=players[0].id, players=players, song_pairs=song_pairs, status='guessing', dancer_incognito_player_id=dancer_incognito.id)

    await storage.upsert_room('222', room.model_dump())
    logger.info(f'Seeded room 222: guessing with 7 players, dancer incognito is {dancer_incognito.display_name}')


async def seed_room_reveal() -> None:
    """Seed: Room in reveal state (room code: 333)."""
    storage = get_storage_adapter()

    names = random.sample(DISCO_NAMES, 7)
    players = [generate_test_player(names[0], is_host=True)]
    players.extend([generate_test_player(name) for name in names[1:]])

    song_pairs = []
    for i in range(3):
        song_a, song_b = SONG_PAIRS[i]
        song_pair = generate_song_pair(player_id=players[i].id, song_a=song_a, song_b=song_b)
        song_pairs.append(song_pair)

    dancer_incognito = random.choice(players)

    room = RoomState(code='333', host_id=players[0].id, players=players, song_pairs=song_pairs, status='reveal', dancer_incognito_player_id=dancer_incognito.id)

    await storage.upsert_room('333', room.model_dump())
    logger.info(f'Seeded room 333: reveal with 7 players, dancer incognito is {dancer_incognito.display_name}')


async def seed_test_data() -> None:
    """
    Seed all test scenarios for realistic screenshots.

    Creates multiple rooms in different states:
    - 123: Empty lobby (1 player)
    - 456: Lobby with 7 players, no songs
    - 789: Lobby with 7 players and 3 song pairs
    - 111: Playing state
    - 222: Guessing state
    - 333: Reveal state
    """
    logger.info('Seeding test data for screenshots...')
    await seed_room_lobby_empty()
    await seed_room_lobby_with_players()
    await seed_room_lobby_ready()
    await seed_room_playing()
    await seed_room_guessing()
    await seed_room_reveal()
    logger.info('Test data seeding complete')


async def clear_test_data() -> None:
    """Clear all test data from storage."""
    storage = get_storage_adapter()
    test_room_codes = ['123', '456', '789', '111', '222', '333']

    for code in test_room_codes:
        await storage.delete_room(code)

    logger.info('Test data cleared')
