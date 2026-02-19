"""Pydantic models for game rooms, players, and songs.

Defines the core domain models: RoomState for room metadata and game status, Player for
user participation tracking, and Song for manual song entries. These models are
serialized for storage and WebSocket communication.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Player(BaseModel):
    id: str
    display_name: str
    is_host: bool = False
    is_connected: bool = True


class SongInfo(BaseModel):
    """Song info for display (title + artist)."""

    id: str
    title: str
    artist: str


class Song(BaseModel):
    """Individual song in the room's song pool."""

    id: str
    title: str
    artist: str
    added_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CurrentRound(BaseModel):
    """Current round state with song assignments (internal model with incognito identity)."""

    song_for_majority: SongInfo
    song_for_incognito: SongInfo
    incognito_player_id: str
    player_assignments: dict[str, SongInfo]  # player_id -> assigned song
    ready_players: list[str] = Field(default_factory=list)  # player_ids who clicked ready
    votes: dict[str, str] = Field(default_factory=dict)  # player_id -> guessed_player_id


class CurrentRoundResponse(BaseModel):
    """Public response model for current round (hides incognito identity).

    Security: Players can look up their own assignment via player_assignments[player_id],
    but cannot determine who the incognito player is since that field is excluded.
    """

    player_assignments: dict[str, SongInfo]  # player_id -> assigned song
    ready_players: list[str] = Field(default_factory=list)  # player_ids who clicked ready
    votes: dict[str, str] = Field(default_factory=dict)  # player_id -> guessed_player_id


class RoundResultsResponse(BaseModel):
    """Results response model after voting (reveals incognito identity)."""

    incognito_player_id: str
    votes: dict[str, str]  # player_id -> guessed_player_id
    correct_guessers: list[str]  # player_ids who guessed correctly


class RoomState(BaseModel):
    """Internal room state model (includes incognito identity for backend logic)."""

    code: str
    host_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active_at: datetime = Field(default_factory=datetime.utcnow)
    players: list[Player] = Field(default_factory=list)
    songs: list[Song] = Field(default_factory=list)
    status: str = 'lobby'
    dancer_incognito_player_id: str | None = None
    current_round: CurrentRound | None = None

    class Config:
        json_schema_extra = {
            'example': {
                'code': '123',
                'host_id': 'player-1',
                'players': [{'id': 'player-1', 'display_name': 'Host', 'is_host': True, 'is_connected': True}],
                'songs': [],
                'status': 'lobby',
            }
        }


class RoomStateResponse(BaseModel):
    """Public API response model for room state (excludes incognito identity).

    Security: Does not expose dancer_incognito_player_id or the full CurrentRound.
    Instead uses CurrentRoundResponse which only contains player_assignments.
    Each player can look up their own song but cannot identify who is incognito.
    """

    code: str
    host_id: str
    created_at: datetime
    last_active_at: datetime
    players: list[Player]
    songs: list[Song]
    status: str
    current_round: CurrentRoundResponse | None = None

    @classmethod
    def from_room_state(cls, room: RoomState) -> 'RoomStateResponse':
        """Convert internal RoomState to public response (strips sensitive fields)."""
        current_round_response = None
        if room.current_round:
            current_round_response = CurrentRoundResponse(
                player_assignments=room.current_round.player_assignments,
                ready_players=room.current_round.ready_players,
                votes=room.current_round.votes,
            )

        return cls(
            code=room.code,
            host_id=room.host_id,
            created_at=room.created_at,
            last_active_at=room.last_active_at,
            players=room.players,
            songs=room.songs,
            status=room.status,
            current_round=current_round_response,
        )
