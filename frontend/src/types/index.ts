/** Shared TypeScript type definitions for the Disco Incognito frontend. */

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

export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  albumArt?: string;
}
