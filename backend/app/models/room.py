from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Player(BaseModel):
    id: str
    display_name: str
    is_host: bool = False
    is_connected: bool = True


class SongPair(BaseModel):
    id: str
    track_a: str
    track_b: str
    added_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoomState(BaseModel):
    code: str
    host_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active_at: datetime = Field(default_factory=datetime.utcnow)
    players: List[Player] = Field(default_factory=list)
    song_pairs: List[SongPair] = Field(default_factory=list)
    status: str = "lobby"
    odd_duck_player_id: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "code": "123",
                "host_id": "player-1",
                "players": [
                    {"id": "player-1", "display_name": "Host", "is_host": True, "is_connected": True}
                ],
                "song_pairs": [],
                "status": "lobby"
            }
        }
