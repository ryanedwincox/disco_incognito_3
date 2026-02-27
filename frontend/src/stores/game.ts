// GameStore: manages active gameplay state (round, dancerIncognitoIds). NOT concerned with room state, player identity, or WebSocket connectivity.
import { defineStore } from "pinia";

interface GameState {
  round: number;
  dancerIncognitoIds: string[];
}

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    round: 1,
    dancerIncognitoIds: [],
  }),
  actions: {
    setDancerIncognito(playerIds: string[]) {
      this.dancerIncognitoIds = playerIds;
    },
  }
});
