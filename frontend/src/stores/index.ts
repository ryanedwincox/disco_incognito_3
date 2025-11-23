/**
 * Pinia store barrel export file.
 * Re-exports all Pinia stores from a single entry point for cleaner imports.
 * Includes auth, room, game, player, music, and websocket stores.
 */
export { useAuthStore } from "./auth";
export { useRoomStore } from "./room";
export { useGameStore } from "./game";
export { usePlayerStore } from "./player";
export { useMusicStore } from "./music";
export { useWebSocketStore } from "./websocket";
