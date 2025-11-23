/**
 * Current player identity store.
 * Stores the local player's ID, display name, and avatar URL.
 * Represents the authenticated user's identity within the game context.
 */
import { defineStore } from "pinia";

interface PlayerState {
  id: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export const usePlayerStore = defineStore("player", {
  state: (): PlayerState => ({
    id: null,
    displayName: null,
    avatarUrl: null
  }),
  actions: {
    setPlayer(id: string, displayName: string, avatarUrl: string | null) {
      this.id = id;
      this.displayName = displayName;
      this.avatarUrl = avatarUrl;
    },
    clear() {
      this.id = null;
      this.displayName = null;
      this.avatarUrl = null;
    }
  }
});
