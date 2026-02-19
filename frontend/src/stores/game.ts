/** Game state store for active gameplay. Tracks round, odd duck selection, and playing status. */
import { defineStore } from "pinia";

interface GameState {
  round: number;
  dancerIncognitoId: string | null;
  isPlaying: boolean;
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    dancerIncognitoId: null,
    isPlaying: false
  }),
  actions: {
    setDancerIncognito(playerId: string | null) {
      this.dancerIncognitoId = playerId;
    },
    setPlaying(value: boolean) {
      this.isPlaying = value;
    }
  }
});
