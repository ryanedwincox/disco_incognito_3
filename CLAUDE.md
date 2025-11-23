# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Disco Incognito** - Multiplayer music guessing game powered by Spotify. One "Odd Duck" hears a different track while others hear the same song. Players vote to identify the Odd Duck.

**Status**: Early development. Core OAuth working, multiplayer features in progress.

**Tech Stack**: FastAPI + WebSockets (Python) | Vue 3 + Vite + Tailwind + Pinia | JSON file storage (swappable) | Docker

**Design**: Mobile-first (390×844 viewport), dark theme (zinc-950) with pink accents (#FF1493)

## Quick Reference

```bash
./setup.sh              # One-time setup
./run.sh --detached     # Start dev servers (frontend :3000, backend :8000)
./run.sh --stop         # Stop servers
./validate.sh           # Run all tests before commits
./validate.sh --fix     # Auto-fix linting issues
```

## Architecture

### Storage Adapter Pattern

All persistence uses swappable `StorageAdapter` interface:
- **Interface**: `backend/app/storage/base.py`
- **Implementation**: `backend/app/storage/json_file.py` (atomic writes with FileLock)
- **Config**: `SESSION_STORAGE=json_file`, `SESSION_STORAGE_FILE=./data/disco_incognito.json`

### Spotify Test Mode

- `SPOTIFY_MODE=test` (default) - Mock tokens/data for local dev
- `SPOTIFY_MODE=live` - Real Spotify API (requires credentials)
- Test mode adapter: `backend/app/services/spotify.py`

### Game State

Models in `backend/app/models/room.py`:
- `RoomState` - Room metadata, players, song pairs, game status
- `Player` - User in room (id, display_name, is_host, is_connected)
- `SongPair` - Two tracks submitted by player

State transitions: `lobby` → `playing` → `guessing` → `reveal` → `lobby`

### Frontend Stores

Located in `frontend/src/stores/`:
- `auth.ts` - OAuth tokens, user profile
- `room.ts` - Room state, players
- `game.ts` - Game phase, voting
- `player.ts` - Current user
- `music.ts` - Playback control
- `websocket.ts` - Real-time updates

### Route Structure

**Backend** (`backend/app/api/routes/`): `auth.py`, `health.py`

**Frontend views** (`frontend/src/views/`):
- `LoginView.vue` → `RoomSelectionView.vue` → `RoomLobbyView.vue`
- `SongPickerView.vue` → `GameView.vue` → `GuessingView.vue` → `RevealView.vue`

## Environment Variables

**Backend** (`backend/.env`):
```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_secret
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
SPOTIFY_MODE=test
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json
ALLOWED_ORIGINS=http://localhost:3000
DEBUG=true
```

**Frontend**:
```bash
VITE_API_URL=http://localhost:8000
VITE_UI_MODE=minimal
```

## Key Patterns

### Mobile-First UI

```vue
<!-- Full-screen container -->
<div class="min-h-screen bg-zinc-950 text-white px-6 py-10">

<!-- Full-width buttons -->
<button class="w-full bg-disco-pink text-black py-3 rounded-full">

<!-- Responsive grid -->
<div class="grid gap-4 md:grid-cols-2">
```

Touch targets: minimum `py-3` (48px), `px-6` padding, `space-y-3` separation

### Atomic JSON Writes

```python
# backend/app/storage/json_file.py
# 1. Write to temp file
# 2. FileLock for concurrent access
# 3. Atomic replace: temp_path.replace(self._path)
```

## Version Constraints

Node.js v19.9.0 requires:
- Vite: `4.5.0`
- @vitejs/plugin-vue: `4.5.0`
- Tailwind CSS: `3.4.0`

Do not upgrade without compatibility testing.

## Common Tasks

### Add API Endpoint

1. Create handler in `backend/app/api/routes/{feature}.py`
2. Register in `backend/app/api/router.py`
3. Add Pinia store action in `frontend/src/stores/`
4. Update types in `frontend/src/types/`

### Add Game Phase

1. Update `RoomState.status` in `backend/app/models/room.py`
2. Add transition logic in game service
3. Create view in `frontend/src/views/`
4. Add route in `frontend/src/router/index.ts`
5. Update `frontend/src/stores/game.ts`

### Switch to Live Spotify

1. Set `SPOTIFY_MODE=live`
2. Configure real credentials in `.env`
3. Test OAuth flow with real accounts
4. Handle Premium requirements

## File Structure

```
backend/app/
├── api/routes/      # API endpoints
├── core/            # Settings
├── dependencies/    # DI (storage)
├── models/          # Pydantic models
├── services/        # Business logic
├── storage/         # Storage adapters
└── main.py          # FastAPI entry

frontend/src/
├── components/      # Vue components
├── stores/          # Pinia stores
├── views/           # Route views
├── router/          # Vue Router
└── types/           # TypeScript types
```
