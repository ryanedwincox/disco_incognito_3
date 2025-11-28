# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Disco Incognito** is a multiplayer web-based music guessing game powered by Spotify. Players listen to songs simultaneously, with one "Dancer Incognito" hearing a different track. The game uses real-time WebSockets for multiplayer coordination and the Spotify Web API for music playback control.

**Status**: Early development. Core OAuth working, multiplayer features in progress.

**Tech Stack**: FastAPI + WebSockets (Python) | Vue 3 + Vite + Tailwind + Pinia | JSON file storage (swappable) | Docker

**Design**: Mobile-first (390×844 viewport), dark theme (zinc-950) with pink accents (#FF1493)

## Quick Reference

```bash
source dev_env.sh       # Activate venv and install deps (idempotent)
./run.sh --detached     # Start dev servers (frontend :3000, backend :8000)
./run.sh --stop         # Stop servers
./run_tests.sh          # Run all tests before commits
./run_tests.sh --fix    # Auto-fix linting issues
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
- Music adapters in `backend/app/music/`:
  - **Interface**: `base.py` - Abstract `MusicAdapter` base class
  - **Test**: `test_adapter.py` - Mock implementation for local dev
  - **Live**: `spotify_adapter.py` - Real Spotify API integration

### Game State

Models in `backend/app/models/room.py`:
- `RoomState` - Room metadata, players, song pairs, game status
- `Player` - User in room (id, display_name, is_host, is_connected)
- `SongPair` - Two tracks submitted by player

State transitions: `lobby` → `song_selection` → `playing` → `guessing` → `reveal` → `lobby`

> **Tip**: Consider using `Literal["lobby", "song_selection", "playing", "guessing", "reveal"]` for `RoomState.status` to get type-safe state handling.

### Frontend Stores

Located in `frontend/src/stores/`:

- **`auth.ts`** - Spotify OAuth tokens, user profile, login/logout
- **`game.ts`** - Game phase, dancer incognito selection, voting state
- **`music.ts`** - Spotify playback control, device management
- **`notifications.ts`** - Toast notifications, user feedback messages
- **`player.ts`** - Current user information
- **`room.ts`** - Current room state, players list, room actions
- **`websocket.ts`** - WebSocket connection management, real-time updates

Stores interact with backend API via axios and maintain WebSocket connections for real-time synchronization.

### WebSocket Communication

- **Endpoint**: `ws://localhost:8000/api/ws/rooms/{room_code}/ws`
- **Current state**: Placeholder implementation in `backend/app/main.py:39`
- **TODO**: Full implementation needed in Phase 3 for:
  - Room-based message broadcasting
  - Real-time player updates
  - Game state synchronization
  - Reconnection handling with heartbeat mechanism

### Route Structure

**Backend** (`backend/app/api/routes/`): `auth.py`, `health.py`

**Frontend views** (`frontend/src/views/`):
- `LoginView.vue` - Spotify authentication
- `RoomSelectionView.vue` - Create/join room
- `RoomLobbyView.vue` - Player list, song pairs, host controls
- `SongPickerView.vue` - Spotify search and song pair selection
- `GameView.vue` - Active game play with countdown
- `GuessingView.vue` - Vote for the dancer incognito
- `RevealView.vue` - Results and round progression

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

### Phase-Based Development (from spec)

The project follows a phased implementation plan defined in `spec/disco_incognito_spec.md`:

1. **Phase 1**: Project setup, infrastructure, storage adapter
2. **Phase 2**: Authentication & OAuth (currently implemented with test mode)
3. **Phase 3**: Multiplayer backend (rooms, game state, WebSockets)
4. **Phase 4**: Frontend game implementation
5. **Phase 5**: Live Spotify integration & polish

**Current status:** Phases 1-2 foundation is in place. Phase 3-4 multiplayer features are partially implemented.

### Commit Workflow

Per project specification:
- Make local commits after completing each checklist item
- Run automated test suite after every phase
- Capture Puppeteer screenshots to validate UI state
- Review screenshots before advancing to next section
- **DO NOT push** until end of project/phase

### Game Flow

Detailed in `spec/gameflow.md`:

1. **Login** → Spotify OAuth
2. **Room Selection** → Create (3-digit code) or Join
3. **Room Lobby** → Players join, add song pairs, host starts game
4. **Song Selection** → Players search Spotify and add 2-song pairs
5. **Game Start** → Random dancer incognito selection, music assignment, synchronized playback (90 seconds)
6. **Guessing** → Players vote on who is the dancer incognito
7. **Reveal** → Show results, highlight correct guesses
8. **Loop** → Return to lobby, remove used song pair, repeat

### UI/UX Guidelines

From specifications:
- **Mobile-First Design**: All layouts are designed for mobile (390px width) first, then scale up
- **Theme**: Dark background (zinc-950 / near-black) with vibrant pink accents
  - Primary pink: `#FF1493` (disco-pink)
  - Light pink: `#FF69B4` (disco-pink-light)
  - Background: zinc-950, zinc-900 for cards/containers
- **Minimalist**: No extra chrome beyond described controls
- **Typography**: Large, bold headings with generous letter-spacing for impact on mobile
- **Spacing**: Consistent padding (`px-6`, `py-10`) and generous gaps for touch targets
- **Buttons**: Full-width on mobile, rounded-full style, minimum 48px height for touch
- **Bottom music bar** (persistent during gameplay):
  - Left: Current song title (only during playback)
  - Center: Play/pause button (disabled during game rounds)
  - Right: Spotify device status/selector
- **Responsive Breakpoints**: Uses Tailwind's `md:` prefix for tablet/desktop (768px+)
  - Example: `grid md:grid-cols-2` stacks on mobile, 2 columns on desktop

## Mobile-First Implementation

### Vue Component Mobile Patterns

All Vue components follow mobile-first responsive patterns:

**Common Mobile-Friendly Patterns:**
```vue
<!-- Full-screen container -->
<div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">

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
├── music/           # Music adapters (Spotify/test)
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
