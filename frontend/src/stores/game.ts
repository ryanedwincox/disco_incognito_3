/**
 * Game state store for active gameplay management.
 * Tracks current round number, countdown timer, odd duck selection, and playing status.
 * Provides actions for game phase transitions during active rounds.
 */
import { defineStore } from "pinia";

interface GameState {
  round: number;
  countdown: number;
  oddDuckId: string | null;
  isPlaying: boolean;
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    countdown: 90,
    oddDuckId: null,
    isPlaying: false
  }),
  actions: {
    setCountdown(seconds: number) {
      this.countdown = seconds;
    },
    setOddDuck(playerId: string | null) {
      this.oddDuckId = playerId;
    },
    setPlaying(value: boolean) {
      this.isPlaying = value;
    }
  }
});
