/**
 * WebSocket connection state store.
 * Tracks connection status (disconnected/connecting/connected) and last received message.
 * Used by components to display connection banners and handle real-time updates.
 */
import { defineStore } from "pinia";

interface WebSocketState {
  status: "disconnected" | "connecting" | "connected";
  lastMessage: Record<string, unknown> | null;
  hasEverConnected: boolean; // Track if we've ever had a successful connection
}

export const useWebSocketStore = defineStore("websocket", {
  state: (): WebSocketState => ({
    status: "connected",
    lastMessage: null,
    hasEverConnected: false
  }),
  actions: {
    setStatus(status: WebSocketState["status"]) {
      this.status = status;
      // Mark that we've successfully connected at least once
      if (status === "connected") {
        this.hasEverConnected = true;
      }
    },
    setLastMessage(message: Record<string, unknown> | null) {
      this.lastMessage = message;
    },
    reset() {
      this.status = "connected";
      this.lastMessage = null;
      this.hasEverConnected = false;
    }
  }
});
