/**
 * WebSocket service for room-scoped real-time communication.
 * Manages a single WebSocket connection per room.
 * State-driven navigation via AppOrchestrator - no router.push() calls.
 */

import { useGameStore } from "../stores/game";
import { useMusicStore } from "../stores/music";
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
  playback_start_time?: string;
  // room_state fields
  players?: Array<{
    id: string;
    display_name: string;
    is_host: boolean;
    is_connected: boolean;
  }>;
  host_id?: string;
  song_pair_count?: number;
  assigned_song?: { id: string; title: string; artist: string };
  ready_players?: string[];
  // player_joined fields
  // player_left fields
  new_host_id?: string | null;
}

const RECONNECT_TOKEN_KEY = "disco_reconnect_token";

/**
 * Minimum ms remaining before playback to show the countdown overlay.
 * Below this threshold the countdown would flash too briefly to be useful.
 */
const COUNTDOWN_THRESHOLD_MS = 500;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private userId: string | null = null;
  private roomCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: number | null = null;
  private reconnectToken: string | null = null;
  private heartbeatTimer: number | null = null;

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
    const savedToken = sessionStorage.getItem(RECONNECT_TOKEN_KEY);
    const tokenParam =
      savedToken || this.reconnectToken
        ? `&reconnect_token=${savedToken || this.reconnectToken}`
        : "";
    const wsUrl = `${wsBaseUrl}/api/ws/room/${roomCode}?user_id=${userId}${tokenParam}`;

    console.log(`Connecting to room WebSocket: ${wsUrl}`);

    const wsStore = useWebSocketStore();
    wsStore.setStatus("connecting");

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log(
          `Room WebSocket connected for user ${userId} in room ${roomCode}`
        );
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

      this.socket.onclose = () => {
        console.log(`Room WebSocket disconnected`);
        this.socket = null;
        this.stopHeartbeat();
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
    this.stopHeartbeat();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      // Null out handlers before close() to prevent the async onclose from
      // setting status to "disconnected" and triggering reconnect attempts
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }

    // Clear reconnect token when deliberately disconnecting
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);

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

    console.log("Manual reconnection triggered");
    this.reconnectAttempts = 0;
    this.connectToRoom(this.userId, this.roomCode);
  }

  /**
   * Attempt to reconnect with exponential backoff: 1s->2s->4s->8s->16s, max 5 attempts.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
      );
      return;
    }

    if (!this.userId || !this.roomCode) {
      console.warn("Cannot reconnect: missing user ID or room code");
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    this.reconnectTimer = window.setTimeout(() => {
      if (this.userId && this.roomCode) {
        this.connectToRoom(this.userId, this.roomCode);
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

      const wsStore = useWebSocketStore();
      wsStore.setLastMessage(message as Record<string, unknown>);

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

        case "player_joined":
          this.handlePlayerJoined(message, roomStore);
          break;

        case "player_left":
          this.handlePlayerLeft(message, roomStore);
          break;

        case "player_ready":
          if (message.ready_players) {
            roomStore.setReadyPlayers(message.ready_players);
          }
          break;

        case "phase_changed":
          this.handlePhaseChanged(message);
          break;

        case "song_added":
          this.handleSongAdded(message);
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
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
    this.reconnectToken = null;
  }

  /**
   * Handle room_state event - populates roomStore with per-user tailored state.
   */
  private handleRoomState(message: WebSocketMessage): void {
    console.log("Received room_state:", message);
    const roomStore = useRoomStore();
    const gameStore = useGameStore();

    // Populate all data BEFORE setting status. The status change triggers
    // AppOrchestrator's currentView computation — all dependent data must
    // already be in place to prevent the countdown gate from being missed.

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

    if (typeof message.song_pair_count === "number") {
      roomStore.setSongPairCount(message.song_pair_count);
    }

    if (message.assigned_song) {
      roomStore.setAssignedSong({
        id: message.assigned_song.id,
        title: message.assigned_song.title,
        artist: message.assigned_song.artist,
      });
    }

    if (typeof message.playback_start_time === "string") {
      gameStore.setPlaybackStartTime(message.playback_start_time);
      if (message.phase === "playing") {
        this.signalCountdownIfNeeded(message.playback_start_time);
      }
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
          | "playing"
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
    console.log(`Player ${user_id} connected`);
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
    console.log(`Player ${user_id} disconnected`);
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
      console.log(`Player ${user_id} already in list, skipping add`);
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
    console.log(`Player ${user_id} (${display_name}) joined room`);
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
    console.log(`Player ${user_id} left room`);
  }

  /**
   * Handle phase_changed event - updates stores only.
   * Navigation is handled by AppOrchestrator based on store state.
   */
  private async handlePhaseChanged(message: WebSocketMessage): Promise<void> {
    const { phase, room_code, playback_start_time, assigned_song } = message;
    console.log(`Phase changed to: ${phase} in room ${room_code}`, {
      playback_start_time,
    });

    if (!phase || !room_code) {
      console.warn("phase_changed event missing phase or room_code");
      return;
    }

    const roomStore = useRoomStore();
    const gameStore = useGameStore();
    const musicStore = useMusicStore();

    // Set assigned_song if present in phase_changed (per-player delivery)
    if (assigned_song) {
      roomStore.setAssignedSong({
        id: assigned_song.id,
        title: assigned_song.title,
        artist: assigned_song.artist,
      });
    }

    // Populate phase-specific data BEFORE setting status. The status change
    // triggers AppOrchestrator's currentView computation — all dependent data
    // (countdown, playbackStartTime, etc.) must already be in place.
    switch (phase) {
      case "playing":
        if (playback_start_time) {
          gameStore.setPlaybackStartTime(playback_start_time);
          this.signalCountdownIfNeeded(playback_start_time);
          console.log(`[phase_changed→playing] countdownSecondsLeft=${gameStore.countdownSecondsLeft}, playbackStartTime=${playback_start_time}`);
        } else {
          console.warn("[phase_changed→playing] missing playback_start_time — countdown won't trigger");
        }
        gameStore.setPlaying(true);
        break;

      case "lobby":
        gameStore.setPlaying(false);
        gameStore.setPlaybackStartTime(null);
        gameStore.setCountdownSecondsLeft(null);
        roomStore.setReadyPlayers([]);
        break;

      case "song_selection":
        break;

      case "guessing":
        gameStore.setPlaying(false);
        try {
          await musicStore.pausePlayback();
        } catch (error) {
          console.error("Failed to pause playback on phase change to guessing:", error);
        }
        break;

      case "results":
        break;

      default:
        console.warn(`Unknown phase: ${phase}`);
    }

    // Set status LAST so the view transition sees all data already populated
    roomStore.setStatus(
      phase as
        | "lobby"
        | "song_selection"
        | "playing"
        | "guessing"
        | "results"
    );
  }

  /**
   * Handle song_added event - update song pair count.
   */
  private handleSongAdded(message: WebSocketMessage): void {
    if (typeof message.song_pair_count === "number") {
      const roomStore = useRoomStore();
      roomStore.setSongPairCount(message.song_pair_count);
      console.log(`Song pair count updated: ${message.song_pair_count}`);
    }
  }

  /**
   * Signal the pre-playback countdown if playback_start_time is far enough in the future.
   * Shared between handleRoomState (reconnect) and handlePhaseChanged (live transition).
   */
  private signalCountdownIfNeeded(playbackStartTime: string): void {
    const gameStore = useGameStore();
    const msUntilPlayback =
      new Date(playbackStartTime).getTime() - Date.now();
    if (msUntilPlayback > COUNTDOWN_THRESHOLD_MS) {
      gameStore.setCountdownSecondsLeft(Math.ceil(msUntilPlayback / 1000));
    }
  }

  /**
   * Start sending periodic ping messages to keep the connection alive through proxies/LBs.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 30_000);
  }

  /**
   * Stop the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
