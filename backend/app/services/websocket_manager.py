"""WebSocket connection manager for room-based real-time communication.

Tracks WebSocket connections per room and provides methods for connection management
and broadcasting messages to room participants.
"""

from __future__ import annotations

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for game rooms.

    Tracks active connections per room and handles broadcasting of messages
    to all players in a room. Also broadcasts player connect/disconnect events.
    """

    def __init__(self) -> None:
        """Initialize connection manager with empty connection tracking."""
        # Structure: {room_code: {user_id: WebSocket}}
        self.active_connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_code: str, user_id: str, websocket: WebSocket) -> None:
        """Connect a user to a room via WebSocket.

        Args:
            room_code: The room code to connect to
            user_id: The user's unique identifier
            websocket: The WebSocket connection
        """
        await websocket.accept()

        # Initialize room if it doesn't exist
        if room_code not in self.active_connections:
            self.active_connections[room_code] = {}

        # Store the connection
        self.active_connections[room_code][user_id] = websocket

        logger.info(f'User {user_id} connected to room {room_code}')

        # Broadcast player_connected event to all players in the room
        await self.broadcast_to_room(
            room_code,
            {
                'type': 'player_connected',
                'user_id': user_id,
            }
        )

    async def disconnect(self, room_code: str, user_id: str) -> None:
        """Disconnect a user from a room.

        Args:
            room_code: The room code to disconnect from
            user_id: The user's unique identifier
        """
        if room_code in self.active_connections:
            if user_id in self.active_connections[room_code]:
                del self.active_connections[room_code][user_id]
                logger.info(f'User {user_id} disconnected from room {room_code}')

                # Clean up empty room
                if not self.active_connections[room_code]:
                    del self.active_connections[room_code]
                    logger.info(f'Room {room_code} has no more connections, removed from tracking')
                else:
                    # Broadcast player_disconnected event to remaining players
                    await self.broadcast_to_room(
                        room_code,
                        {
                            'type': 'player_disconnected',
                            'user_id': user_id,
                        }
                    )

    async def broadcast_to_room(self, room_code: str, message: dict) -> None:
        """Broadcast a message to all connected users in a room.

        Args:
            room_code: The room code to broadcast to
            message: The message dictionary to send (will be serialized to JSON)
        """
        if room_code not in self.active_connections:
            logger.warning(f'Attempted to broadcast to non-existent room {room_code}')
            return

        # Get list of connections to avoid modification during iteration
        connections = list(self.active_connections[room_code].items())

        for user_id, websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f'Error broadcasting to user {user_id} in room {room_code}: {e}')
                # Connection is dead, remove it
                if room_code in self.active_connections and user_id in self.active_connections[room_code]:
                    del self.active_connections[room_code][user_id]
