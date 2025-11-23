# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Disco Incognito** is a multiplayer web-based music guessing game powered by Spotify. Players listen to songs simultaneously, with one "Dancer Incognito" hearing a different track. The game uses real-time WebSockets for multiplayer coordination and the Spotify Web API for music playback control.

**Tech Stack:**
- **Backend**: FastAPI (Python 3.10+) with WebSockets
- **Frontend**: Vue 3 (Composition API) + Vite 4.5.0 + Tailwind CSS 3.4.0
- **State Management**: Pinia stores
- **Storage**: JSON file adapter (swappable architecture)
- **Authentication**: Spotify OAuth 2.0
- **Deployment**: Docker + Google Cloud Run

**Design Philosophy:**
- **Mobile-First**: UI is designed primarily for mobile devices (390×844 viewport - iPhone 12/13 Pro)
- **Responsive**: Scales up gracefully to desktop using Tailwind's responsive breakpoints
- **Minimalist Dark Theme**: Near-black background (zinc-950) with vibrant pink accents (#FF1493)
- **Touch-Optimized**: Large tap targets, full-width buttons, and spacious padding for mobile interactions

## Development Commands

### Backend Development

```bash
# Run backend directly (development mode with auto-reload)
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Using Docker Compose (recommended)
docker-compose -f docker-compose.dev.yml up backend

# Run with test mode Spotify adapter
SPOTIFY_MODE=test python -m uvicorn app.main:app --reload
```

**Backend is at:** `http://localhost:8000`
**API endpoints:** `http://localhost:8000/api/*`

### Frontend Development

```bash
# Run frontend dev server with hot reload
cd frontend
npm run dev

# Using Docker Compose (recommended)
docker-compose -f docker-compose.dev.yml up frontend

# Build for production
npm run build
```

**Frontend is at:** `http://localhost:3000`

### Testing

```bash
# Frontend unit tests (Vitest)
cd frontend
npm run test:unit        # Run once
npm run test:watch       # Watch mode

# E2E screenshot tests (Puppeteer)
npm run test:screenshots

# Linting
npm run lint
```

**Screenshot Testing:**
- The project uses Puppeteer-based screenshot validation workflow
- Screenshots are captured at **mobile viewport** (390×844px, 3× device scale factor)
- Run `npm run test:screenshots` after implementing each major feature to capture visual state
- Screenshots saved to `tests/e2e/screenshots/` with a JSON summary
- **Mobile-first approach**: All screenshots and validation are done at mobile resolution

### Full Stack Development

```bash
# Start both backend and frontend with Docker Compose
docker-compose -f docker-compose.dev.yml up

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# CORS is handled by FastAPI middleware
```

## Architecture & Key Patterns

### Storage Adapter Pattern

The application uses a **swappable storage adapter** architecture. All persistence goes through the `StorageAdapter` interface:

- **Interface**: `backend/app/storage/base.py` - Abstract base class defining storage contract
- **Implementation**: `backend/app/storage/json_file.py` - JSON file storage with atomic writes (temp file + rename) and file locking
- **Dependency Injection**: `backend/app/dependencies/storage.py` - Provides singleton storage adapter instance
- **Configuration**: Set via `SESSION_STORAGE=json_file` and `SESSION_STORAGE_FILE=./data/disco_incognito.json`

**Why this matters:** Future storage backends (Redis, PostgreSQL, etc.) can be added by implementing `StorageAdapter` without changing application logic. The JSON file adapter uses `FileLock` to prevent corruption during concurrent access.

### Spotify Test Mode

The app supports a **spoofed Spotify adapter** for local development:

- **Configuration**: `SPOTIFY_MODE=test` (default for development)
- **Location**: `backend/app/services/spotify.py` - Returns mock tokens/data when in test mode
- **Purpose**: Develop all multiplayer flows without requiring real Spotify API calls
- **Production**: Set `SPOTIFY_MODE=live` to enable real Spotify integration

**Development workflow:** Stay in test mode until Phase 5, then switch to live mode and re-run all tests.

### Room & Game State Management

Game state flows through these models:

- **`backend/app/models/room.py`**:
  - `RoomState` - Room metadata, players, song pairs, game status
  - `Player` - User in a room (id, display_name, is_host, is_connected)
  - `SongPair` - Two tracks submitted by a player (track_a, track_b, added_by)

- **State transitions**: `lobby` → `playing` → `guessing` → `reveal` → back to `lobby`
- **Persistence**: All state changes are immediately written to storage adapter
- **Room lifecycle**: Rooms expire after 60 minutes of inactivity (tracked via `last_active_at`)

### Frontend State (Pinia Stores)

Located in `frontend/src/stores/`:

- **`auth.ts`** - Spotify OAuth tokens, user profile, login/logout
- **`room.ts`** - Current room state, players list, room actions
- **`game.ts`** - Game phase, dancer incognito selection, voting state
- **`player.ts`** - Current user information
- **`music.ts`** - Spotify playback control, device management
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

**Backend API routes** (`backend/app/api/routes/`):
- `auth.py` - Spotify OAuth flow endpoints
- `health.py` - Health check endpoint
- Future: `rooms.py`, `game.py` for multiplayer features

**Frontend views** (`frontend/src/views/`):
- `LoginView.vue` - Spotify authentication
- `RoomSelectionView.vue` - Create/join room
- `RoomLobbyView.vue` - Player list, song pairs, host controls
- `SongPickerView.vue` - Spotify search and song pair selection
- `GameView.vue` - Active game play with countdown
- `GuessingView.vue` - Vote for the dancer incognito
- `RevealView.vue` - Results and round progression

**Routing**: See `frontend/src/router/index.ts` for full route definitions.

## Environment Configuration

### Backend Environment Variables

Located at `backend/.env` (use `backend/.env.example` as template):

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_secret
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
SPOTIFY_MODE=test                    # Use 'live' for production
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json
ALLOWED_ORIGINS=http://localhost:3000
DEBUG=true
LOG_LEVEL=INFO
JWT_SECRET_KEY=your-secret-key
SESSION_SECRET=your-session-secret
```

**Settings class**: `backend/app/core/settings.py` - Uses Pydantic Settings with environment variable loading

### Frontend Environment Variables

```bash
VITE_API_URL=http://localhost:8000
VITE_UI_MODE=minimal
```

Configuration is loaded via Vite's `loadEnv` in `frontend/vite.config.ts`.

## Development Workflow

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
<!-- Full-screen container with mobile padding -->
<div class="min-h-screen bg-zinc-950 text-white px-6 py-10">

<!-- Flexbox centering for single-column mobile layouts -->
<div class="flex flex-col items-center justify-center">

<!-- Full-width buttons on mobile -->
<button class="w-full bg-disco-pink text-black py-3 rounded-full">

<!-- Responsive grid: stacks on mobile, 2 columns on desktop -->
<div class="grid gap-4 md:grid-cols-2">

<!-- Touch-friendly spacing -->
<ul class="space-y-3">  <!-- Vertical spacing between list items -->
<div class="space-x-3"> <!-- Horizontal spacing between buttons -->
```

**View-by-View Mobile Analysis:**

1. **LoginView.vue**: Centered content, large touch-friendly button, readable text wrapping
2. **RoomSelectionView.vue**: Full-width buttons, max-width constraint (max-w-md), spacious input
3. **RoomLobbyView.vue**: Uses `md:grid-cols-2` pattern - stacks cards vertically on mobile
4. **SongPickerView.vue**: Full-width search input, stacked cards on mobile, centered max-width layout
5. **GameView.vue**: Large countdown display, fixed footer with grid layout for music controls
6. **GuessingView.vue**: Card-based layout with `md:grid-cols-2`, full-width guess buttons
7. **RevealView.vue**: Vertical stacking, large typography, full-width CTA button

**Touch Target Guidelines:**
- All buttons have minimum `py-3` (48px height with padding)
- Rounded-full buttons provide large, easy-to-tap areas
- Consistent `px-6` horizontal padding for comfortable margins
- `space-y-3` or higher for adequate vertical separation between interactive elements

**Typography Scaling:**
- Mobile: `text-3xl`, `text-4xl` for headers
- Desktop: Same sizes (optimized for mobile readability first)
- Letter-spacing: `tracking-wide`, `tracking-widest`, `tracking-[0.6em]` for emphasis

## Key Implementation Details

### Atomic JSON Writes

The `JSONFileStorage` adapter uses atomic writes to prevent corruption:

```python
# backend/app/storage/json_file.py
# 1. Write to temp file
# 2. Use FileLock for concurrent access
# 3. Atomic replace: temp_path.replace(self._path)
```

This ensures multiple instances can safely update the shared state file, critical for Cloud Run deployment.

### Version Compatibility Notes

**Frontend uses downgraded versions for Node.js v19.9.0 compatibility:**
- Vite: `4.5.0` (not latest)
- @vitejs/plugin-vue: `4.5.0`
- Tailwind CSS: `3.4.0`

Do not upgrade these without testing compatibility with the Node.js version.

### Docker Development Setup

The `dev.Dockerfile` provides two multi-stage build targets:

- **`dev-backend`**: Python backend with uvicorn auto-reload
- **`dev-frontend`**: Node frontend with Vite HMR

Both mount source directories as volumes for live code reloading. The `docker-compose.dev.yml` orchestrates both services with proper networking.

### Spotify OAuth Scopes

Required scopes (defined in `spec/SPOTIFY_SETUP.md`):
- `user-read-private` - User profile
- `user-read-email` - Email address
- `user-read-playback-state` - Current playback state
- `user-modify-playback-state` - Control playback
- `user-read-currently-playing` - Currently playing track
- `streaming` - Web Playback SDK control

### Cloud Run Deployment Considerations

Per `spec/disco_incognito_spec.md`:
- **Port 8080**: Google Cloud Run requirement (not 8000)
- **Shared JSON storage**: Mount Cloud Storage bucket at `/mnt/disco_incognito` via FUSE
- **No virtual environments**: Python dependencies installed directly in container
- **Atomic writes**: Critical for multi-instance state consistency
- **Environment variables**: Set via `gcloud run services update`

## File Structure Summary

```
disco_incognito_3/
├── backend/
│   ├── app/
│   │   ├── api/            # API routes (auth, health, future: rooms, game)
│   │   ├── core/           # Settings and configuration
│   │   ├── dependencies/   # Dependency injection (storage adapter)
│   │   ├── models/         # Pydantic models (RoomState, Player, SongPair)
│   │   ├── services/       # Business logic (spotify auth service)
│   │   ├── storage/        # Storage adapter interface + JSON implementation
│   │   └── main.py         # FastAPI app entry point
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # Vue components
│   │   ├── stores/         # Pinia state management
│   │   ├── views/          # Route views (Login, Room, Game, etc.)
│   │   ├── router/         # Vue Router configuration
│   │   └── types/          # TypeScript type definitions
│   ├── tests/
│   │   └── e2e/            # Puppeteer screenshot tests
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── disco_incognito.json  # Shared state file (git-tracked baseline)
├── spec/                   # Project specifications
│   ├── disco_incognito_spec.md
│   ├── gameflow.md
│   └── SPOTIFY_SETUP.md
├── docker-compose.dev.yml  # Development orchestration
├── dev.Dockerfile          # Multi-stage dev containers
└── Dockerfile              # Production build
```

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `backend/app/api/routes/{feature}.py`
2. Register in `backend/app/api/router.py`
3. Update storage adapter if new persistence needed
4. Add corresponding Pinia store action in frontend
5. Update TypeScript types in `frontend/src/types/`

### Adding a New Game Phase

1. Update `RoomState.status` field in `backend/app/models/room.py`
2. Add phase transition logic in game service
3. Create corresponding view in `frontend/src/views/`
4. Add route in `frontend/src/router/index.ts`
5. Update game store state machine in `frontend/src/stores/game.ts`
6. Capture Puppeteer screenshots for new phase

### Implementing WebSocket Features

1. Extend `websocket_endpoint` in `backend/app/main.py`
2. Implement connection manager for room-based broadcasting
3. Add message handlers for game events
4. Update `frontend/src/stores/websocket.ts` with message processing
5. Add reconnection logic with heartbeat mechanism

### Switching from Test to Live Spotify

1. Set `SPOTIFY_MODE=live` in environment
2. Implement real Spotipy calls in `backend/app/services/spotify.py`
3. Configure actual Spotify app credentials
4. Test OAuth flow with real Spotify accounts
5. Implement Web Playback SDK in `frontend/src/stores/music.ts`
6. Handle Premium account requirements and rate limits
