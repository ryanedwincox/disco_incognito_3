// GameStore: manages active gameplay state (round, dancerIncognitoIds, isPlaying). NOT concerned with room state, player identity, or WebSocket connectivity.
import { defineStore } from "pinia";

interface GameState {
  round: number;
  dancerIncognitoIds: string[];
  isPlaying: boolean;
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    dancerIncognitoIds: [],
    isPlaying: false
  }),
  actions: {
    setDancerIncognito(playerIds: string[]) {
      this.dancerIncognitoIds = playerIds;
    },
    setPlaying(value: boolean) {
      this.isPlaying = value;
    }
  }
});
