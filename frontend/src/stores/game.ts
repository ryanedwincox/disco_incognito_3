/**
 * Game state store for active gameplay management.
 * Tracks current round number, countdown timer, odd duck selection, playing status,
 * and synchronized playback timing.
 * Provides actions for game phase transitions during active rounds.
 */
import { defineStore } from "pinia";

interface GameState {
  round: number;
  countdown: number;
  dancerIncognitoId: string | null;
  isPlaying: boolean;
  playbackStartTime: string | null; // ISO timestamp when audio should start
  // In Pinia because three consumers coordinate: websocket service (sets),
  // AppOrchestrator (reads for view routing), CountdownView (reads + updates on tick).
  countdownSecondsLeft: number | null;
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    countdown: 90,
    dancerIncognitoId: null,
    isPlaying: false,
    playbackStartTime: null,
    countdownSecondsLeft: null
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
    },
    setPlaybackStartTime(isoTimestamp: string | null) {
      this.playbackStartTime = isoTimestamp;
    },
    setCountdownSecondsLeft(seconds: number | null) {
      this.countdownSecondsLeft = seconds;
    }
  }
});
