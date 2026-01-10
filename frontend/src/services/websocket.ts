/**
 * WebSocket service for real-time room communication.
 * Manages WebSocket connections to rooms and handles incoming events.
 */

import router from "../router";
import { useGameStore } from "../stores/game";
import { useRoomStore } from "../stores/room";
import { useWebSocketStore } from "../stores/websocket";
import { API_URL } from "../config/api";

export interface WebSocketMessage {
  type: string;
  user_id?: string;
  display_name?: string;
  data?: unknown;
  reconnect_token?: string;
  reason?: string;
  phase?: string;
  room_code?: string;
  playback_start_time?: string; // ISO timestamp when clients should start audio playback
}

const RECONNECT_TOKEN_KEY = "disco_reconnect_token";

export class WebSocketService {
  private socket: WebSocket | null = null;
  private roomCode: string | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: number | null = null;
  private reconnectToken: string | null = null;

  /**
   * Connect to a room's WebSocket endpoint.
   */
  connect(roomCode: string, userId: string): void {
    this.roomCode = roomCode;
    this.userId = userId;

    // Try to load reconnect token from localStorage
    const storedToken = localStorage.getItem(RECONNECT_TOKEN_KEY);
    const reconnectParam = storedToken ? `&reconnect_token=${storedToken}` : "";

    // Determine WebSocket URL based on API_URL (same host/port as HTTP API)
    // Convert http(s):// to ws(s)://
    const wsBaseUrl = API_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBaseUrl}/api/ws/rooms/${roomCode}/ws?user_id=${userId}${reconnectParam}`;

    console.log(
      `Connecting to WebSocket: ${wsUrl.replace(/reconnect_token=[^&]+/, "reconnect_token=***")}`
    );

    const wsStore = useWebSocketStore();
    wsStore.setStatus("connecting");

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log(`WebSocket connected to room ${roomCode}`);
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        wsStore.setStatus("connected");
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        wsStore.setStatus("disconnected");
      };

      this.socket.onclose = () => {
        console.log(`WebSocket disconnected from room ${roomCode}`);
        this.socket = null;
        wsStore.setStatus("disconnected");
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      wsStore.setStatus("disconnected");
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

    // Clear reconnect token when deliberately disconnecting
    localStorage.removeItem(RECONNECT_TOKEN_KEY);

    this.roomCode = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.reconnectToken = null;
  }

  /**
   * Manually trigger reconnection using stored reconnect token.
   * Called by the retry button in ServerDisconnectedBanner.
   */
  reconnect(): void {
    if (!this.roomCode || !this.userId) {
      console.warn("Cannot reconnect: missing room code or user ID");
      return;
    }

    console.log("Manual reconnection triggered");
    this.reconnectAttempts = 0; // Reset attempts for manual reconnect
    this.connect(this.roomCode, this.userId);
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
        case "connected":
          this.handleConnected(message);
          break;

        case "reconnect_failed":
          this.handleReconnectFailed(message);
          break;

        case "room_state":
          this.handleRoomState(message);
          break;

        case "player_connected":
          this.handlePlayerConnected(message, roomStore);
          break;

        case "player_disconnected":
          this.handlePlayerDisconnected(message, roomStore);
          break;

        case "room_update":
          this.handleRoomUpdate(message);
          break;

        case "phase_changed":
          this.handlePhaseChanged(message);
          break;

        default:
          console.warn("Unknown WebSocket message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  /**
   * Handle connected event (contains reconnect token).
   */
  private handleConnected(message: WebSocketMessage): void {
    if (message.reconnect_token) {
      this.reconnectToken = message.reconnect_token;
      localStorage.setItem(RECONNECT_TOKEN_KEY, message.reconnect_token);
      console.log("Reconnect token stored");
    }
  }

  /**
   * Handle reconnect_failed event.
   */
  private handleReconnectFailed(message: WebSocketMessage): void {
    console.error("Reconnection failed:", message.reason);
    // Clear invalid token
    localStorage.removeItem(RECONNECT_TOKEN_KEY);
    this.reconnectToken = null;
  }

  /**
   * Handle room_state event (sent on reconnection).
   */
  private handleRoomState(message: WebSocketMessage): void {
    console.log("Received full room state on reconnection:", message.data);
    const roomStore = useRoomStore();
    // Update room state from server
    if (message.data && typeof message.data === "object") {
      const roomData = message.data as Record<string, unknown>;
      if (roomData.players && Array.isArray(roomData.players)) {
        roomStore.setPlayers(roomData.players);
      }
      // Handle other room state updates as needed
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
   * Handle phase_changed event and navigate to appropriate view.
   */
  private handlePhaseChanged(message: WebSocketMessage): void {
    const { phase, room_code, playback_start_time } = message;
    console.log(`Phase changed to: ${phase} in room ${room_code}`, { playback_start_time });

    if (!phase || !room_code) {
      console.warn("phase_changed event missing phase or room_code");
      return;
    }

    // Update game store
    const gameStore = useGameStore();

    // Map phase to route and update state
    switch (phase) {
      case "song_selection":
        // Navigate to song assignment view
        router.push({ name: "song-assignment", params: { code: room_code } });
        break;

      case "playing":
        // Store playback start time for synchronized audio
        if (playback_start_time) {
          gameStore.setPlaybackStartTime(playback_start_time);
        }
        // Update game store and navigate to game playing view
        gameStore.setPlaying(true);
        router.push({ name: "game", params: { code: room_code } });
        break;

      case "guessing":
        // Navigate to guessing view
        router.push({ name: "guessing", params: { code: room_code } });
        break;

      case "results":
        // Navigate to results view
        router.push({ name: "results", params: { code: room_code } });
        break;

      case "lobby":
        // Reset game state and navigate back to lobby
        gameStore.setPlaying(false);
        gameStore.setPlaybackStartTime(null);
        router.push({ name: "room-lobby", params: { code: room_code } });
        break;

      default:
        console.warn(`Unknown phase: ${phase}`);
    }
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
