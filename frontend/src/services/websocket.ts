/**
 * WebSocket service for real-time client communication.
 * Manages WebSocket connections and handles incoming events.
 * State-driven navigation via AppOrchestrator - no router.push() calls.
 */

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
  // client_state fields
  in_room?: boolean;
  status?: string;
  players?: Array<{
    id: string;
    display_name: string;
    is_host: boolean;
    is_connected: boolean;
  }>;
}

const RECONNECT_TOKEN_KEY = "disco_reconnect_token";

export class WebSocketService {
  private socket: WebSocket | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: number | null = null;
  private reconnectToken: string | null = null;

  /**
   * Connect to the app-level client WebSocket endpoint.
   * Called on authentication success.
   */
  connectClient(userId: string): void {
    this.userId = userId;

    // Try to load reconnect token from sessionStorage
    const storedToken = sessionStorage.getItem(RECONNECT_TOKEN_KEY);
    const reconnectParam = storedToken ? `&reconnect_token=${storedToken}` : "";

    // Determine WebSocket URL based on API_URL (same host/port as HTTP API)
    // Convert http(s):// to ws(s)://
    const wsBaseUrl = API_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBaseUrl}/api/ws/client?user_id=${userId}`;

    console.log(`Connecting to client WebSocket: ${wsUrl}`);

    const wsStore = useWebSocketStore();
    wsStore.setStatus("connecting");

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log(`Client WebSocket connected for user ${userId}`);
        this.reconnectAttempts = 0;
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
        console.log(`Client WebSocket disconnected`);
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
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);

    this.userId = null;
    this.reconnectAttempts = 0;
    this.reconnectToken = null;
  }

  /**
   * Manually trigger reconnection.
   * Called by the retry button in ServerDisconnectedBanner.
   */
  reconnect(): void {
    if (!this.userId) {
      console.warn("Cannot reconnect: missing user ID");
      return;
    }

    console.log("Manual reconnection triggered");
    this.reconnectAttempts = 0; // Reset attempts for manual reconnect
    this.connectClient(this.userId);
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

    if (!this.userId) {
      console.warn("Cannot reconnect: missing user ID");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    this.reconnectTimer = window.setTimeout(() => {
      if (this.userId) {
        this.connectClient(this.userId);
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

        case "client_state":
          this.handleClientState(message);
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
      sessionStorage.setItem(RECONNECT_TOKEN_KEY, message.reconnect_token);
      console.log("Reconnect token stored");
    }
  }

  /**
   * Handle reconnect_failed event.
   */
  private handleReconnectFailed(message: WebSocketMessage): void {
    console.error("Reconnection failed:", message.reason);
    // Clear invalid token
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
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
   * Handle client_state event from app-level WebSocket.
   * Populates roomStore and gameStore, clears stale state when not in room.
   */
  private handleClientState(message: WebSocketMessage): void {
    console.log("Received client_state:", message);
    const roomStore = useRoomStore();
    const gameStore = useGameStore();

    if (message.in_room === false) {
      // Clear stale room/game state when server says we're not in a room
      roomStore.reset();
      gameStore.setPlaying(false);
      gameStore.setPlaybackStartTime(null);
      return;
    }

    // Populate room state
    if (message.room_code) {
      roomStore.setRoom(message.room_code);
    }

    if (message.phase) {
      roomStore.setStatus(message.phase as "lobby" | "picking_songs" | "song_selection" | "playing" | "guessing" | "results");
    }

    // Room data is nested under room_data
    const roomData = message.room_data as Record<string, unknown> | undefined;
    if (roomData) {
      if (roomData.players && Array.isArray(roomData.players)) {
        roomStore.setPlayers(
          (roomData.players as Array<{id: string; display_name: string; is_host: boolean; is_connected: boolean}>).map((p) => ({
            id: p.id,
            name: p.display_name,
            isHost: p.is_host,
            isConnected: p.is_connected
          }))
        );
      }

      if (typeof roomData.song_pair_count === 'number') {
        roomStore.setSongPairCount(roomData.song_pair_count);
      }

      if (roomData.assigned_song && typeof roomData.assigned_song === 'object') {
        const song = roomData.assigned_song as {id: string; title: string; artist: string};
        roomStore.setAssignedSong({
          id: song.id,
          title: song.title,
          artist: song.artist,
        });
      }

      if (typeof roomData.playback_start_time === 'string') {
        gameStore.setPlaybackStartTime(roomData.playback_start_time);
      }
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
   * Handle phase_changed event - updates stores only.
   * Navigation is handled by AppOrchestrator based on store state.
   */
  private handlePhaseChanged(message: WebSocketMessage): void {
    const { phase, room_code, playback_start_time } = message;
    console.log(`Phase changed to: ${phase} in room ${room_code}`, { playback_start_time });

    if (!phase || !room_code) {
      console.warn("phase_changed event missing phase or room_code");
      return;
    }

    const roomStore = useRoomStore();
    const gameStore = useGameStore();

    // Update room status - AppOrchestrator will handle view selection
    roomStore.setStatus(phase as "lobby" | "song_selection" | "playing" | "guessing" | "results");

    // Update game state based on phase
    switch (phase) {
      case "playing":
        if (playback_start_time) {
          gameStore.setPlaybackStartTime(playback_start_time);
        }
        gameStore.setPlaying(true);
        break;

      case "lobby":
        gameStore.setPlaying(false);
        gameStore.setPlaybackStartTime(null);
        break;

      case "song_selection":
      case "guessing":
      case "results":
        // No additional game state updates needed
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
