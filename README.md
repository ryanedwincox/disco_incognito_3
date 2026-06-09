# 🕺 Disco Incognito

> A multiplayer music-guessing party game. Everyone hears the same song… except one. Can you spot the **Dancer Incognito**?

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776ab?logo=python&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Google%20Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Live at **[discoincognito.com](https://discoincognito.com)**.

---

## What is this?

**Disco Incognito** is a real-time, mobile-first party game you play together on your phones. Every player is secretly assigned a song (entered as plain title/artist text). One randomly chosen player — the **Dancer Incognito** — is given a *different* track. After a short listening phase, everyone votes on who they think heard the odd song out, and the Dancer is revealed.

It's built as a full-stack showcase: a Vue 3 + TypeScript front end driven by a FastAPI WebSocket backend, with resilient reconnect handling, a swappable storage layer, and a full test pyramid — deployed on Google Cloud Run.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/login.png" width="220" alt="Login" />
  <img src="docs/screenshots/room-selection.png" width="220" alt="Room selection" />
  <img src="docs/screenshots/lobby.png" width="220" alt="Lobby" />
</p>
<p align="center">
  <img src="docs/screenshots/song-picker.png" width="220" alt="Song picker" />
  <img src="docs/screenshots/assignment.png" width="220" alt="Song assignment" />
  <img src="docs/screenshots/guessing.png" width="220" alt="Guessing" />
  <img src="docs/screenshots/results.png" width="220" alt="Results" />
</p>

<p align="center"><sub>Guest login → room selection → lobby → song picker → assignment → guessing → results</sub></p>

---

## Highlights / Engineering notes

The interesting parts, for the curious reviewer:

- **Resilient WebSocket reconnect.** A room-scoped endpoint (`/api/ws/room/{room_code}`) backed by a singleton `ConnectionManager` issues **reconnect tokens** (30-minute window) so a dropped client resumes its session rather than losing its seat. The front end layers on exponential backoff, **page-visibility reconnection** (handling iOS Safari tab backgrounding), `localStorage` state restoration, and a "server disconnected" banner — so the game survives flaky mobile networks.
- **State-driven UI, not URL routing.** An `AppOrchestrator.vue` component maps the Pinia game-phase state directly to the active view (Login → RoomSelection → Lobby → SongPicker → Assignment → Guessing → Results). Game flow is a single source of truth in the store, not a tangle of routes.
- **Atomic JSON storage behind a swappable adapter.** A storage interface (`storage/base.py`) lets the persistence layer be swapped out; the default `json_file.py` implementation uses temp-file-plus-rename atomic writes and `filelock` optimistic locking for safe concurrent access. In production it's served on a GCS-mounted volume.
- **Full test pyramid.** Pytest for the backend, Vitest for front-end units, Playwright + Puppeteer for E2E, and **Storybook-driven visual regression** for components — plus Ruff/ESLint linting, all wired into GitHub Actions CI.
- **Production-grade plumbing.** JWT-based guest auth with a deterministic `user_id` derived from the display name, per-player-per-room rate-limit bucketing (slowapi), and an "incognito dancer" mode for larger rooms (>8 players). In production, the FastAPI backend also serves the built Vue SPA as static files from a single container.

---

## Tech stack

**Frontend** — Vue 3 · TypeScript · Vite · Pinia · Vue Router · Tailwind CSS · axios · @vueuse/core · Storybook 8 · Vitest · Playwright + Puppeteer

**Backend** — Python · FastAPI + Uvicorn · native WebSockets · Pydantic 2 / pydantic-settings · python-jose (JWT) · filelock · slowapi · pytest

**Infra** — Docker / docker-compose · Google Cloud Run (`cloudbuild.yaml`, GCS bucket-mounted volume, Secret Manager) · Ruff · GitHub Actions CI

---

## How it works

### Gameplay flow

1. Players join a room with a short code (guest login — just pick a name).
2. The host starts the round; each player is assigned a song, and one secret **Dancer Incognito** gets a different track.
3. Everyone listens during the assignment/guessing phase.
4. Players vote on who they think heard the odd song out.
5. The Dancer is revealed in the results screen.

### Architecture

```
  ┌────────────┐   WebSocket    ┌───────────────┐   atomic +    ┌──────────────┐
  │  Vue 3 SPA │ ◄───────────►  │    FastAPI    │   filelock    │  JSON store  │
  │  (Pinia)   │  /api/ws/room  │ ConnectionMgr │ ───────────►  │ (GCS volume) │
  └────────────┘   + REST/JWT   └───────────────┘    writes     └──────────────┘
        ▲                              │
        │  AppOrchestrator maps        │  broadcasts game-state
        │  phase → view                │  to every client in the room
        └──────────────────────────────┘
```

The Pinia store holds the canonical game phase; `AppOrchestrator.vue` renders the matching view. Real-time updates flow over the room WebSocket, with REST + JWT used for auth and setup. Game state is persisted through the storage adapter — JSON files locally and on a GCS-mounted volume in production.

---

## Running locally

**Prerequisites:** Docker + Docker Compose, Node.js, and Python.

```bash
# One-time (idempotent) setup: venv + dependencies + .env files
source dev_env.sh

# Run the full stack in Docker (backend :8000, frontend :3000, hot reload)
./run.sh
./run.sh --detached    # run in the background
./run.sh --stop        # stop the containers
```

Frontend on its own:

```bash
cd frontend
npm run dev          # Vite dev server
npm run build        # production build
npm run storybook    # component explorer on :6006
```

Tests and linting:

```bash
./run_tests.sh             # lint + E2E (Playwright) + backend (pytest)
./run_tests.sh --fix       # auto-fix lint issues
./run_tests.sh --e2e       # Playwright E2E only
./run_tests.sh --backend   # backend pytest only

cd frontend && npm run test:unit   # front-end unit tests (Vitest)
```

**Key environment variables** (sensible dev defaults exist; production values come from Cloud Run secrets): `JWT_SECRET_KEY`, `SESSION_SECRET`, `SESSION_STORAGE`, `ALLOWED_ORIGINS`, `DEBUG`.

---

## Project structure

```
disco_incognito_3/
├── backend/            # FastAPI app
│   └── app/
│       ├── api/        # REST routes + WebSocket endpoint
│       ├── core/       # config, settings
│       ├── models/     # Pydantic models
│       ├── services/   # ConnectionManager, game logic
│       ├── storage/    # swappable adapter: base.py + json_file.py
│       └── utils/      # auth, helpers
├── frontend/           # Vue 3 + TypeScript SPA
│   └── src/
│       ├── components/ # AppOrchestrator + UI components
│       ├── views/      # phase views (Login, Lobby, Guessing, …)
│       ├── stores/     # Pinia state
│       ├── services/   # websocket client, API
│       └── stories/    # Storybook stories
├── spec/               # game spec + flow docs
├── docs/screenshots/   # gameplay screenshots
├── cloudbuild.yaml     # Cloud Run build/deploy
├── docker-compose*.yml # local dev orchestration
├── run.sh              # dev server launcher
└── run_tests.sh        # lint + test runner
```

---

## License

Released under the [MIT License](LICENSE).

---

<sub>Built by **Ryan Cox** · [ryan@olisrobotics.com](mailto:ryan@olisrobotics.com)</sub>
