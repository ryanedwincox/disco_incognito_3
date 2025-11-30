/**
 * Room state store for multiplayer game lobby management.
 * Tracks room code, player list, game status (lobby/playing/guessing/reveal),
 * and song pair count. Provides actions for room state updates from WebSocket.
 */
import { defineStore } from "pinia";

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

interface AssignedSong {
  id: string;
  title: string;
  artist: string;
}

interface RoomState {
  code: string | null;
  players: RoomPlayer[];
  status: "lobby" | "song_selection" | "playing" | "guessing" | "reveal";
  songPairCount: number;
  assignedSong: AssignedSong | null;
}

export const useRoomStore = defineStore("room", {
  state: (): RoomState => ({
    code: null,
    players: [],
    status: "lobby",
    songPairCount: 0,
    assignedSong: null
  }),
  actions: {
    setRoom(code: string) {
      this.code = code;
    },
    setPlayers(players: RoomPlayer[]) {
      this.players = players;
    },
    setStatus(status: RoomState["status"]) {
      this.status = status;
    },
    setSongPairCount(count: number) {
      this.songPairCount = count;
    },
    setAssignedSong(song: AssignedSong | null) {
      this.assignedSong = song;
    },
    reset() {
      this.code = null;
      this.players = [];
      this.status = "lobby";
      this.songPairCount = 0;
      this.assignedSong = null;
    }
  }
});
