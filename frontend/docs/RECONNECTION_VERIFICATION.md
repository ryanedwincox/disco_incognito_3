# Reconnection Verification Matrix

State-driven reconnection via `AppOrchestrator` + `client_state` WebSocket message.

## Architecture Overview

```
Page Refresh / Reconnect
         │
         ▼
authStore.loadFromStorage()        ◀── src/stores/auth.ts:162
         │
         ▼
AppOrchestrator watch triggers     ◀── src/components/AppOrchestrator.vue:72-85
         │
         ▼
websocketService.connectClient()   ◀── src/services/websocket.ts:49
         │
         ▼
Server sends `client_state`        ◀── backend WebSocket handler
         │
         ▼
handleClientState() populates:     ◀── src/services/websocket.ts:263-316
  - roomStore.code
  - roomStore.status (phase)
  - roomStore.players
  - roomStore.assignedSong
  - gameStore.playbackStartTime
         │
         ▼
AppOrchestrator.appPhase computed  ◀── src/components/AppOrchestrator.vue:50-58
         │
         ▼
currentView computed → renders     ◀── src/components/AppOrchestrator.vue:61-69
```

## Verification Table

| # | Scenario | Expected View | Code Path |
|---|----------|---------------|-----------|
| 1 | Refresh at lobby | `RoomLobbyView` | `client_state.phase="lobby"` → `roomStore.status="lobby"` → `appPhase="lobby"` → `phaseToViewMap.lobby` |
| 2 | Refresh at song_selection | `SongAssignmentWrapper` | `client_state.phase="song_selection"` → `roomStore.status="song_selection"` → `appPhase="song_selection"` → `phaseToViewMap.song_selection` |
| 3 | Refresh at playing | `GameView` | `client_state.phase="playing"` + `playback_start_time` → `roomStore.status="playing"` + `gameStore.playbackStartTime` → `appPhase="playing"` → `phaseToViewMap.playing` |
| 4 | Refresh at guessing | `GuessingView` | `client_state.phase="guessing"` → `roomStore.status="guessing"` → `appPhase="guessing"` → `phaseToViewMap.guessing` |
| 5 | Refresh at results | `ResultsView` | `client_state.phase="results"` → `roomStore.status="results"` → `appPhase="results"` → `phaseToViewMap.results` |
| 6 | Disconnect in lobby, game advances, reconnect | Current phase view | On reconnect: `client_state` contains current server phase (e.g., `playing`). `handleClientState()` updates stores. `appPhase` recomputes to server's current phase. View renders accordingly. |
| 7 | Fresh auth, not in room | `RoomSelectionView` | `client_state.in_room=false` → `handleClientState()` calls `roomStore.reset()` → `roomStore.code=null` → `appPhase="authenticated_no_room"` → `LoginView` guard passes → `RoomSelectionView` |

## Key Files

| File | Responsibility |
|------|----------------|
| `src/components/AppOrchestrator.vue` | State-driven view selection, WS connection on auth |
| `src/services/websocket.ts` | WS connection, `client_state` handling, store population |
| `src/stores/auth.ts` | Auth persistence via localStorage, `loadFromStorage()` |
| `src/stores/room.ts` | Room state: code, status (phase), players |
| `src/stores/game.ts` | Game state: playbackStartTime |

## Phase-to-View Mapping

```typescript
// src/components/AppOrchestrator.vue:38-45
const phaseToViewMap: Record<string, Component> = {
  lobby: RoomLobbyView,
  picking_songs: SongPickerView,
  song_selection: SongAssignmentWrapper,
  playing: GameView,
  guessing: GuessingView,
  results: ResultsView
}
```

## client_state Message Schema

```typescript
// From server on WebSocket connect
{
  type: "client_state",
  in_room: boolean,
  room_code?: string,
  phase?: "lobby" | "picking_songs" | "song_selection" | "playing" | "guessing" | "results",
  room_data?: {
    players: Array<{ id, display_name, is_host, is_connected }>,
    song_pair_count?: number,
    assigned_song?: { id, title, artist },
    playback_start_time?: string  // ISO timestamp
  }
}
```
