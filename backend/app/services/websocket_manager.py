"""WebSocket connection manager for room-based real-time communication.

Tracks WebSocket connections per room and provides methods for connection management
and broadcasting messages to room participants.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import WebSocket

from ..dependencies.storage import get_storage_adapter
from ..core.settings import RECONNECT_TOKEN_EXPIRATION_MINUTES

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages room-scoped WebSocket connections.

    Single connection model: each connection is indexed by (room_code, user_id).
    No app-level client connections.
    """

    def __init__(self) -> None:
        # Structure: {room_code: {user_id: WebSocket}}
        self.active_connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_code: str, user_id: str, websocket: WebSocket) -> dict[str, str]:
        """Register a user's WebSocket connection to a room.

        Caller must have already called websocket.accept() before this method.

        Returns:
            Dict with 'reconnect_token' for session resumption.
        """
        if room_code not in self.active_connections:
            self.active_connections[room_code] = {}

        self.active_connections[room_code][user_id] = websocket
        logger.info(f'User {user_id} connected to room {room_code}')

        # Generate reconnect token and update session
        storage = get_storage_adapter()
        new_reconnect_token = str(uuid.uuid4())

        state = await storage.load()
        sessions = state.get('sessions', {})

        access_token = None
        for token, session_data in sessions.items():
            if session_data.get('user_id') == user_id:
                access_token = token
                break

        if access_token:
            session_data = sessions[access_token]
            session_data['room_code'] = room_code
            session_data['reconnect_token'] = new_reconnect_token
            session_data['disconnected_at'] = None
            await storage.set_session(access_token, session_data)
            logger.info(f'Generated reconnect token for user {user_id}')
        else:
            logger.warning(f'No session found for user {user_id} during connection')

        return {'reconnect_token': new_reconnect_token}

    async def disconnect(self, room_code: str, user_id: str) -> None:
        """Disconnect a user from a room and record disconnect timestamp."""
        if room_code in self.active_connections:
            if user_id in self.active_connections[room_code]:
                del self.active_connections[room_code][user_id]
                logger.info(f'User {user_id} disconnected from room {room_code}')

                # Update session with disconnect timestamp
                storage = get_storage_adapter()
                state = await storage.load()
                sessions = state.get('sessions', {})

                access_token = None
                for token, session_data in sessions.items():
                    if session_data.get('user_id') == user_id:
                        access_token = token
                        break

                if access_token:
                    session_data = sessions[access_token]
                    session_data['disconnected_at'] = datetime.now(timezone.utc).isoformat()
                    await storage.set_session(access_token, session_data)
                    logger.info(f'Stored disconnect timestamp for user {user_id}')

                # Clean up empty room
                if not self.active_connections[room_code]:
                    del self.active_connections[room_code]
                    logger.info(f'Room {room_code} has no more connections, removed from tracking')

    async def validate_reconnect_token(self, reconnect_token: str) -> dict | None:
        """Validate a reconnection token and return session info if valid.

        Returns:
            Dict with user_id, room_code, access_token if valid within 5-min window; None otherwise.
        """
        storage = get_storage_adapter()
        state = await storage.load()
        sessions = state.get('sessions', {})

        for token, session_data in sessions.items():
            if session_data.get('reconnect_token') == reconnect_token:
                disconnected_at = session_data.get('disconnected_at')
                if disconnected_at:
                    disconnected_dt = datetime.fromisoformat(disconnected_at.replace('Z', '+00:00'))
                    if disconnected_dt.tzinfo is None:
                        disconnected_dt = disconnected_dt.replace(tzinfo=timezone.utc)

                    expiration_threshold = datetime.now(timezone.utc) - timedelta(minutes=RECONNECT_TOKEN_EXPIRATION_MINUTES)
                    if disconnected_dt < expiration_threshold:
                        logger.warning(f'Reconnect token expired for user {session_data.get("user_id")}')
                        return None

                return {
                    'user_id': session_data.get('user_id'),
                    'room_code': session_data.get('room_code'),
                    'access_token': token,
                }

        logger.warning(f'Invalid reconnect token: {reconnect_token}')
        return None

    async def send_to_user(self, room_code: str, user_id: str, message: dict) -> None:
        """Send a message to a specific user in a room."""
        if room_code in self.active_connections:
            websocket = self.active_connections[room_code].get(user_id)
            if websocket:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f'Error sending to user {user_id} in room {room_code}: {e}')
                    if room_code in self.active_connections and user_id in self.active_connections[room_code]:
                        del self.active_connections[room_code][user_id]

    async def broadcast_to_room(self, room_code: str, message: dict) -> None:
        """Broadcast a message to all connected users in a room."""
        if room_code in self.active_connections:
            connections = list(self.active_connections[room_code].items())
            for user_id, websocket in connections:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f'Error broadcasting to user {user_id} in room {room_code}: {e}')
                    if room_code in self.active_connections and user_id in self.active_connections[room_code]:
                        del self.active_connections[room_code][user_id]
        else:
            logger.warning(f'Attempted to broadcast to room {room_code} with no connections')


# Singleton instance for access from routes
_connection_manager: ConnectionManager | None = None


def get_connection_manager() -> ConnectionManager:
    """Get or create the singleton ConnectionManager instance."""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager
