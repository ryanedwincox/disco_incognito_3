/**
 * WebSocket service for room-scoped real-time communication.
 * Manages a single WebSocket connection per room.
 * Navigation is state-driven via AppOrchestrator reacting to roomStore changes.
 */

import { useRoomStore } from "../stores/room";
import { useWebSocketStore } from "../stores/websocket";
import { useNotificationStore } from "../stores/notifications";
import { API_URL } from "../config/api";
import { STORAGE_KEYS } from "../config/storageKeys";
import { WS_CLOSE } from "../constants/wsCloseCodes";

export interface WebSocketMessage {
  type: string;
  user_id?: string;
  display_name?: string;
  data?: unknown;
  reconnect_token?: string;
  reason?: string;
  phase?: string;
  room_code?: string;
  player_id?: string;
  ready_players?: string[];
  players?: Array<{
    id: string;
    display_name: string;
    is_host: boolean;
    is_connected: boolean;
  }>;
  host_id?: string;
  pair_count?: number;
  assigned_song?: { id: string; title: string; artist: string };
  new_host_id?: string | null;
}

// Reconnect backoff constants
const BASE_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;
const MAX_DELAY_MS = 16_000;
const MAX_RECONNECT_ATTEMPTS = 8;

function getBackoffDelay(attempt: number): number {
  const base = Math.min(
    BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_DELAY_MS
  );
  // ±20% jitter
  return base * (0.8 + Math.random() * 0.4);
}

export class WebSocketService {
  private socket: WebSocket | null = null;
  private userId: string | null = null;
  private roomCode: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectToken: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pongWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Connect to a room-scoped WebSocket endpoint.
   * Called when entering a room (create/join) or on reconnect.
   */
  connectToRoom(userId: string, roomCode: string): void {
    // Guard: skip if already connected or connecting to avoid duplicate connections
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.userId = userId;
    this.roomCode = roomCode;

    // Build WS URL: /api/ws/room/{roomCode}?user_id={userId}&reconnect_token={token}
    const wsBaseUrl = API_URL.replace(/^http/, "ws");
    const savedToken =
      sessionStorage.getItem(STORAGE_KEYS.RECONNECT_TOKEN) ||
      this.reconnectToken;
    const tokenParam = savedToken ? `&reconnect_token=${savedToken}` : "";
    const wsUrl = `${wsBaseUrl}/api/ws/room/${roomCode}?user_id=${userId}${tokenParam}`;

    const wsStore = useWebSocketStore();
    wsStore.setStatus("connecting");

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        wsStore.setStatus("connected");
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        wsStore.setStatus("disconnected");
      };

      this.socket.onclose = (event: CloseEvent) => {
        this.socket = null;
        this.stopHeartbeat();
        wsStore.setStatus("disconnected");

        // Replaced by a newer connection from the same user — do not reconnect.
        if (event.code === WS_CLOSE.REPLACED) {
          return;
        }

        // Intentional clean close — do not reconnect.
        if (event.code === 1000 && event.wasClean) {
          return;
        }

        // Room no longer exists — notify and navigate home.
        if (event.code === WS_CLOSE.ROOM_NOT_FOUND) {
          this.handleRoomNotFound();
          return;
        }

        // All other codes (network drop, pong timeout, etc.) → reconnect.
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
   * Clears all timers and resets state. Does NOT navigate.
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.socket) {
      // Null out handlers before close() to prevent the async onclose from
      // setting status to "disconnected" and triggering reconnect attempts
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }

    // Clear reconnect token when deliberately disconnecting
    sessionStorage.removeItem(STORAGE_KEYS.RECONNECT_TOKEN);

    // Reset WS store so hasEverConnected is false — prevents the
    // ServerDisconnectedBanner from flashing during intentional disconnect
    const wsStore = useWebSocketStore();
    wsStore.reset();

    this.userId = null;
    this.roomCode = null;
    this.reconnectAttempts = 0;
    this.reconnectToken = null;
  }

  /**
   * Manually trigger reconnection.
   * Called by the retry button in ServerDisconnectedBanner.
   */
  reconnect(): void {
    if (!this.userId || !this.roomCode) {
      console.warn("Cannot reconnect: missing user ID or room code");
      return;
    }

    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.connectToRoom(this.userId, this.roomCode);
  }

  /**
   * Trigger an immediate reconnect attempt if the socket is not OPEN or CONNECTING.
   * Used by the page-visibility handler on foreground resume.
   */
  reconnectIfNeeded(): void {
    if (!this.userId || !this.roomCode) return;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.clearReconnectTimer();
    this.connectToRoom(this.userId, this.roomCode);
  }

  /**
   * Attempt to reconnect with exponential backoff + jitter.
   * After MAX_RECONNECT_ATTEMPTS gives up and navigates home.
   */
  private attemptReconnect(): void {
    // Clear any pending timer first — prevents timer accumulation on rapid calls.
    this.clearReconnectTimer();

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.handleReconnectFailed();
      return;
    }

    if (!this.userId || !this.roomCode) {
      console.warn("Cannot reconnect: missing user ID or room code");
      return;
    }

    const delay = getBackoffDelay(this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.userId && this.roomCode) {
        this.connectToRoom(this.userId, this.roomCode);
      }
    }, delay);
  }

  /** Clear any pending reconnect timer. */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Handle exhausted reconnect attempts — clear state and navigate home. */
  private handleReconnectFailed(): void {
    console.error(
      `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
    );
    this.clearReconnectTimer();
    sessionStorage.removeItem(STORAGE_KEYS.RECONNECT_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
    this.reconnectAttempts = 0;
    this.reconnectToken = null;
    this.userId = null;
    this.roomCode = null;

    const notifications = useNotificationStore();
    notifications.error("Connection Lost", "Could not reconnect to the room.");

    const roomStore = useRoomStore();
    // reset() clears roomCode → AppOrchestrator's watch navigates to RoomSelectionView.
    roomStore.reset();
  }

  /** Handle room_not_found close code — room deleted or never existed. */
  private handleRoomNotFound(): void {
    console.warn("Room not found — navigating home");
    sessionStorage.removeItem(STORAGE_KEYS.RECONNECT_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
    this.reconnectToken = null;
    this.userId = null;
    this.roomCode = null;
    this.reconnectAttempts = 0;

    const notifications = useNotificationStore();
    notifications.error("Room Not Found", "This room no longer exists.");

    const roomStore = useRoomStore();
    // reset() clears roomCode → AppOrchestrator's watch navigates to RoomSelectionView.
    roomStore.reset();
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      const wsStore = useWebSocketStore();
      wsStore.setLastMessage(message as Record<string, unknown>);

      const roomStore = useRoomStore();

      switch (message.type) {
        case "connected":
          this.handleConnected(message);
          break;

        case "reconnect_failed":
          this.handleReconnectFailedMessage(message);
          break;

        case "room_not_found":
          this.handleRoomNotFound();
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

        case "player_joined":
          this.handlePlayerJoined(message, roomStore);
          break;

        case "player_left":
          this.handlePlayerLeft(message, roomStore);
          break;

        case "phase_changed":
          this.handlePhaseChanged(message);
          break;

        case "song_added":
          this.handleSongAdded(message);
          break;

        case "player_ready":
          this.handlePlayerReady(message, roomStore);
          break;

        case "pong":
          // Clear pong watchdog — connection is alive.
          if (this.pongWatchdogTimer !== null) {
            clearTimeout(this.pongWatchdogTimer);
            this.pongWatchdogTimer = null;
          }
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
      sessionStorage.setItem(STORAGE_KEYS.RECONNECT_TOKEN, message.reconnect_token);
    }
  }

  /**
   * Handle reconnect_failed message event (token invalid/expired).
   */
  private handleReconnectFailedMessage(message: WebSocketMessage): void {
    console.error("Reconnection failed:", message.reason);
    sessionStorage.removeItem(STORAGE_KEYS.RECONNECT_TOKEN);
    this.reconnectToken = null;
  }

  /**
   * Handle room_state event - populates roomStore with per-user tailored state.
   */
  private handleRoomState(message: WebSocketMessage): void {
    const roomStore = useRoomStore();

    // Populate all data BEFORE setting status. The status change triggers
    // AppOrchestrator's currentView computation — all dependent data must
    // already be in place.

    if (message.players && Array.isArray(message.players)) {
      roomStore.setPlayers(
        message.players.map((p) => ({
          id: p.id,
          name: p.display_name,
          isHost: p.is_host,
          isConnected: p.is_connected,
        }))
      );
    }

    if (typeof message.pair_count === "number") {
      roomStore.setSongCount(message.pair_count);
    }

    if (message.assigned_song) {
      roomStore.setAssignedSong({
        id: message.assigned_song.id,
        title: message.assigned_song.title,
        artist: message.assigned_song.artist,
      });
    }

    if (Array.isArray(message.ready_players)) {
      roomStore.setReadyPlayers(message.ready_players);
    }

    // Set status LAST so the view transition sees all data already populated
    if (message.phase) {
      roomStore.setStatus(
        message.phase as
          | "lobby"
          | "picking_songs"
          | "song_selection"
          | "guessing"
          | "results"
      );
    }
  }

  /**
   * Handle player_connected event - update connection status.
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

    const players = roomStore.players.map((player) => {
      if (player.id === user_id) {
        return { ...player, isConnected: true };
      }
      return player;
    });

    roomStore.setPlayers(players);
  }

  /**
   * Handle player_disconnected event - update connection status.
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

    const players = roomStore.players.map((player) => {
      if (player.id === user_id) {
        return { ...player, isConnected: false };
      }
      return player;
    });

    roomStore.setPlayers(players);
  }

  /**
   * Handle player_joined event - add new player to store.
   */
  private handlePlayerJoined(
    message: WebSocketMessage,
    roomStore: ReturnType<typeof useRoomStore>
  ): void {
    const { user_id, display_name } = message;
    if (!user_id || !display_name) {
      console.warn("player_joined event missing user_id or display_name");
      return;
    }

    // Don't add if already in list
    const existing = roomStore.players.find((p) => p.id === user_id);
    if (existing) {
      return;
    }

    roomStore.setPlayers([
      ...roomStore.players,
      {
        id: user_id,
        name: display_name,
        isHost: false,
        isConnected: true,
      },
    ]);
  }

  /**
   * Handle player_left event - remove player from store.
   */
  private handlePlayerLeft(
    message: WebSocketMessage,
    roomStore: ReturnType<typeof useRoomStore>
  ): void {
    const { user_id, new_host_id } = message;
    if (!user_id) {
      console.warn("player_left event missing user_id");
      return;
    }

    let players = roomStore.players.filter((p) => p.id !== user_id);

    // Update host if transferred
    if (new_host_id) {
      players = players.map((p) => ({
        ...p,
        isHost: p.id === new_host_id,
      }));
    }

    roomStore.setPlayers(players);
  }

  /**
   * Handle phase_changed event - updates stores only.
   * Navigation is handled by AppOrchestrator based on store state.
   */
  private handlePhaseChanged(message: WebSocketMessage): void {
    const { phase, room_code, assigned_song } = message;

    if (!phase || !room_code) {
      console.warn("phase_changed event missing phase or room_code");
      return;
    }

    const roomStore = useRoomStore();

    // Set assigned_song if present in phase_changed (per-player delivery)
    if (assigned_song) {
      roomStore.setAssignedSong({
        id: assigned_song.id,
        title: assigned_song.title,
        artist: assigned_song.artist,
      });
    }

    // Set status LAST so the view transition sees all data already populated
    roomStore.setStatus(
      phase as
        | "lobby"
        | "song_selection"
        | "guessing"
        | "results"
    );
  }

  /**
   * Handle song_added event - update song count.
   */
  private handleSongAdded(message: WebSocketMessage): void {
    if (typeof message.pair_count === "number") {
      const roomStore = useRoomStore();
      roomStore.setSongCount(message.pair_count);
    }
  }

  /**
   * Handle player_ready event — update readyPlayers in roomStore.
   */
  private handlePlayerReady(
    message: WebSocketMessage,
    roomStore: ReturnType<typeof useRoomStore>
  ): void {
    if (Array.isArray(message.ready_players)) {
      roomStore.setReadyPlayers(message.ready_players);
    } else if (message.player_id) {
      roomStore.markPlayerReady(message.player_id);
    }
  }

  /**
   * Start the heartbeat: ping every 20s, watchdog closes socket after 10s without pong.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendPing();
    }, 20_000);
  }

  /** Send a ping and start the pong watchdog. */
  private sendPing(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "ping" }));

    // Watchdog: close socket if pong doesn't arrive within 10s
    this.pongWatchdogTimer = setTimeout(() => {
      console.warn("Pong not received within 10s — closing dead connection");
      this.socket?.close(WS_CLOSE.PONG_TIMEOUT);
    }, 10_000);
  }

  /**
   * Stop the heartbeat interval and pong watchdog.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pongWatchdogTimer !== null) {
      clearTimeout(this.pongWatchdogTimer);
      this.pongWatchdogTimer = null;
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
