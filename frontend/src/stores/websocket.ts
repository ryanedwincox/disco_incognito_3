import { defineStore } from "pinia";

interface WebSocketState {
  status: "disconnected" | "connecting" | "connected";
  lastMessage: Record<string, unknown> | null;
}

export const useWebSocketStore = defineStore("websocket", {
  state: (): WebSocketState => ({
    status: "connected",
    lastMessage: null
  }),
  actions: {
    setStatus(status: WebSocketState["status"]) {
      this.status = status;
    },
    setLastMessage(message: Record<string, unknown> | null) {
      this.lastMessage = message;
    }
  }
});
