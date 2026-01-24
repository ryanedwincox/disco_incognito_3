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
    """Manages WebSocket connections for game rooms.

    Tracks active connections per room and handles broadcasting of messages
    to all players in a room. Also broadcasts player connect/disconnect events.
    Supports both room-specific and app-level client connections.
    """

    def __init__(self) -> None:
        """Initialize connection manager with empty connection tracking."""
        # Structure: {room_code: {user_id: WebSocket}}
        self.active_connections: dict[str, dict[str, WebSocket]] = {}
        # App-level client connections: {user_id: (WebSocket, room_code | None)}
        self.client_connections: dict[str, tuple[WebSocket, str | None]] = {}

    async def connect(self, room_code: str, user_id: str, websocket: WebSocket, reconnect_token: str | None = None) -> dict:
        """Connect a user to a room via WebSocket.

        Args:
            room_code: The room code to connect to
            user_id: The user's unique identifier
            websocket: The WebSocket connection
            reconnect_token: Optional reconnection token for resuming a session

        Returns:
            Dict with connection info including new or validated reconnect_token
        """
        await websocket.accept()

        # Initialize room if it doesn't exist
        if room_code not in self.active_connections:
            self.active_connections[room_code] = {}

        # Store the connection
        self.active_connections[room_code][user_id] = websocket

        logger.info(f'User {user_id} connected to room {room_code}')

        # Generate or validate reconnect token
        storage = get_storage_adapter()
        new_reconnect_token = str(uuid.uuid4())

        # Update session with reconnect info
        # Find session by user_id (we need to scan sessions)
        state = await storage.load()
        sessions = state.get('sessions', {})

        # Find the token for this user_id
        access_token = None
        for token, session_data in sessions.items():
            if session_data.get('user_id') == user_id:
                access_token = token
                break

        if access_token:
            session_data = sessions[access_token]
            session_data['room_code'] = room_code
            session_data['reconnect_token'] = new_reconnect_token
            session_data['disconnected_at'] = None  # Clear disconnect timestamp
            await storage.set_session(access_token, session_data)
            logger.info(f'Generated reconnect token for user {user_id}')
        else:
            logger.warning(f'No session found for user {user_id} during connection')

        # Broadcast player_connected event to all players in the room
        await self.broadcast_to_room(
            room_code,
            {
                'type': 'player_connected',
                'user_id': user_id,
            }
        )

        return {'reconnect_token': new_reconnect_token}

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

                # Update session with disconnect timestamp
                storage = get_storage_adapter()
                state = await storage.load()
                sessions = state.get('sessions', {})

                # Find the token for this user_id
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
                else:
                    # Broadcast player_disconnected event to remaining players
                    await self.broadcast_to_room(
                        room_code,
                        {
                            'type': 'player_disconnected',
                            'user_id': user_id,
                        }
                    )

    async def validate_reconnect_token(self, reconnect_token: str) -> dict | None:
        """Validate a reconnection token and return session info if valid.

        Args:
            reconnect_token: The reconnection token to validate

        Returns:
            Dict with user_id and room_code if valid, None otherwise
        """
        storage = get_storage_adapter()
        state = await storage.load()
        sessions = state.get('sessions', {})

        # Find session with matching reconnect token
        for token, session_data in sessions.items():
            if session_data.get('reconnect_token') == reconnect_token:
                # Check if token has expired
                disconnected_at = session_data.get('disconnected_at')
                if disconnected_at:
                    # Parse ISO format timestamp
                    disconnected_dt = datetime.fromisoformat(disconnected_at.replace('Z', '+00:00'))
                    if disconnected_dt.tzinfo is None:
                        disconnected_dt = disconnected_dt.replace(tzinfo=timezone.utc)

                    # Check if within expiration window
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

    async def connect_client(self, user_id: str, websocket: WebSocket, room_code: str | None = None) -> dict:
        """Connect a client via app-level WebSocket (no room required).

        Args:
            user_id: The user's unique identifier
            websocket: The WebSocket connection
            room_code: Optional room code if user is currently in a room

        Returns:
            Dict with connection info including reconnect_token
        """
        self.client_connections[user_id] = (websocket, room_code)
        logger.info(f'Client {user_id} connected via app-level WS (room={room_code})')

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
            session_data['reconnect_token'] = new_reconnect_token
            session_data['disconnected_at'] = None
            await storage.set_session(access_token, session_data)

        return {'reconnect_token': new_reconnect_token}

    async def disconnect_client(self, user_id: str) -> None:
        """Disconnect an app-level client connection.

        Args:
            user_id: The user's unique identifier
        """
        if user_id in self.client_connections:
            del self.client_connections[user_id]
            logger.info(f'Client {user_id} disconnected from app-level WS')

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

    async def update_client_room(self, user_id: str, room_code: str | None) -> None:
        """Update the room association for a client connection and session.

        Args:
            user_id: The user's unique identifier
            room_code: New room code (or None if leaving room)
        """
        # Update in-memory connection
        if user_id in self.client_connections:
            websocket, _ = self.client_connections[user_id]
            self.client_connections[user_id] = (websocket, room_code)

        # Update session for reconnection support
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
            session_data['room_code'] = room_code
            await storage.set_session(access_token, session_data)

        logger.debug(f'Updated client {user_id} room to {room_code}')

    async def broadcast_to_room(self, room_code: str, message: dict) -> None:
        """Broadcast a message to all connected users in a room.

        Sends to both legacy room connections and app-level client connections.

        Args:
            room_code: The room code to broadcast to
            message: The message dictionary to send (will be serialized to JSON)
        """
        # Legacy room connections
        if room_code in self.active_connections:
            connections = list(self.active_connections[room_code].items())
            for user_id, websocket in connections:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f'Error broadcasting to user {user_id} in room {room_code}: {e}')
                    if room_code in self.active_connections and user_id in self.active_connections[room_code]:
                        del self.active_connections[room_code][user_id]

        # App-level client connections for this room
        client_connections = [
            (uid, ws) for uid, (ws, rc) in self.client_connections.items()
            if rc == room_code
        ]
        for user_id, websocket in client_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f'Error broadcasting to client {user_id} for room {room_code}: {e}')
                if user_id in self.client_connections:
                    del self.client_connections[user_id]

        if room_code not in self.active_connections and not client_connections:
            logger.warning(f'Attempted to broadcast to room {room_code} with no connections')


# Singleton instance for access from routes
_connection_manager: ConnectionManager | None = None


def get_connection_manager() -> ConnectionManager:
    """Get or create the singleton ConnectionManager instance."""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager
