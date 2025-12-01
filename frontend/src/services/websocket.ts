/**
 * WebSocket service for real-time room communication.
 * Manages WebSocket connections to rooms and handles incoming events.
 */

import { useRoomStore } from "../stores/room";

export interface WebSocketMessage {
  type: string;
  user_id?: string;
  display_name?: string;
  data?: unknown;
}

export class WebSocketService {
  private socket: WebSocket | null = null;
  private roomCode: string | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: number | null = null;

  /**
   * Connect to a room's WebSocket endpoint.
   */
  connect(roomCode: string, userId: string): void {
    this.roomCode = roomCode;
    this.userId = userId;

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws/rooms/${roomCode}/ws?user_id=${userId}`;

    console.log(`Connecting to WebSocket: ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log(`WebSocket connected to room ${roomCode}`);
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.socket.onclose = () => {
        console.log(`WebSocket disconnected from room ${roomCode}`);
        this.socket = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from the current WebSocket connection.
   */
  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.roomCode = null;
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Attempt to reconnect to the WebSocket.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
      );
      return;
    }

    if (!this.roomCode || !this.userId) {
      console.warn("Cannot reconnect: missing room code or user ID");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    this.reconnectTimer = window.setTimeout(() => {
      if (this.roomCode && this.userId) {
        this.connect(this.roomCode, this.userId);
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket message received:", message);

      const roomStore = useRoomStore();

      switch (message.type) {
        case "player_connected":
          this.handlePlayerConnected(message, roomStore);
          break;

        case "player_disconnected":
          this.handlePlayerDisconnected(message, roomStore);
          break;

        case "room_update":
          this.handleRoomUpdate(message);
          break;

        default:
          console.warn("Unknown WebSocket message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  /**
   * Handle player_connected event.
   */
  private handlePlayerConnected(
    message: WebSocketMessage,
    roomStore: ReturnType<typeof useRoomStore>
  ): void {
    const { user_id } = message;

    if (!user_id) {
      console.warn("player_connected event missing user_id");
      return;
    }

    // Update player connection status
    const players = roomStore.players.map((player) => {
      if (player.id === user_id) {
        return { ...player, isConnected: true };
      }
      return player;
    });

    roomStore.setPlayers(players);
    console.log(`Player ${user_id} connected`);
  }

  /**
   * Handle player_disconnected event.
   */
  private handlePlayerDisconnected(
    message: WebSocketMessage,
    roomStore: ReturnType<typeof useRoomStore>
  ): void {
    const { user_id } = message;

    if (!user_id) {
      console.warn("player_disconnected event missing user_id");
      return;
    }

    // Update player connection status
    const players = roomStore.players.map((player) => {
      if (player.id === user_id) {
        return { ...player, isConnected: false };
      }
      return player;
    });

    roomStore.setPlayers(players);
    console.log(`Player ${user_id} disconnected`);
  }

  /**
   * Handle room_update event (for future use).
   */
  private handleRoomUpdate(message: WebSocketMessage): void {
    // Future: handle room state updates
    console.log("Room update received:", message);
  }

  /**
   * Send a message through the WebSocket.
   */
  send(message: WebSocketMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected. Cannot send message:", message);
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
