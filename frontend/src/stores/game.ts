import { defineStore } from "pinia";

interface GameState {
  round: number;
  countdown: number;
  dancerIncognitoId: string | null;
  isPlaying: boolean;
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    countdown: 90,
    dancerIncognitoId: null,
    isPlaying: false
  }),
  actions: {
    setCountdown(seconds: number) {
      this.countdown = seconds;
    },
    setDancerIncognito(playerId: string | null) {
      this.dancerIncognitoId = playerId;
    },
    setPlaying(value: boolean) {
      this.isPlaying = value;
    }
  }
});
