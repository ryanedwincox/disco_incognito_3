/**
 * Room state store for multiplayer game lobby management.
 * Tracks room code, player list, game status (lobby/playing/guessing/reveal),
 * and song count. Provides actions for room state updates from WebSocket.
 */
import { defineStore } from "pinia";
import { STORAGE_KEYS } from "../config/storageKeys";

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
  status: "lobby" | "picking_songs" | "song_selection" | "playing" | "guessing" | "results";
  songCount: number;
  assignedSong: AssignedSong | null;
}

export const useRoomStore = defineStore("room", {
  state: (): RoomState => ({
    code: null,
    players: [],
    status: "lobby",
    songCount: 0,
    assignedSong: null,
  }),
  actions: {
    setRoom(code: string) {
      this.code = code;
      sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, code);
    },
    setPlayers(players: RoomPlayer[]) {
      this.players = players;
    },
    setStatus(status: RoomState["status"]) {
      this.status = status;
    },
    setSongCount(count: number) {
      this.songCount = count;
    },
    setAssignedSong(song: AssignedSong | null) {
      this.assignedSong = song;
    },
    reset() {
      this.code = null;
      this.players = [];
      this.status = "lobby";
      this.songCount = 0;
      this.assignedSong = null;
      sessionStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
      localStorage.removeItem(STORAGE_KEYS.SONG_PICKER_STATE);
    }
  }
});
