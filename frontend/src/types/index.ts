export interface PlayerSummary {
  id: string;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface SongPairSummary {
  id: string;
  trackA: string;
  trackB: string;
  addedBy: string;
}

export type RoomStatus = "lobby" | "song_selection" | "playing" | "guessing" | "reveal";
