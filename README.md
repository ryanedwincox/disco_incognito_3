# Disco Incognito

**Overview**: Multiplayer web-based music guessing game. FastAPI backend with WebSockets, Vue 3 frontend with Tailwind CSS. Players each get assigned a song—one player (the "Dancer Incognito") hears a different track. After listening, players vote to identify who had the different song.

**Development status**: Early development. Guest login (name-based) with manual song entry. Multiplayer room/game features in progress. Mobile-first design.

**Run Tests**: `./run_tests.sh` - Run before commits. Linting + unit tests + E2E tests + backend tests. Use `--fix` for auto-fix, `--unit`/`--e2e`/`--backend` to run specific suites.

**Demo**: `./run.sh --detached` - Builds and starts backend (port 8000) + frontend (port 3000) in Docker. `./run.sh --stop` to stop. Hot reload enabled via volume mounts.

**Setup**: `source dev_env.sh` - Activates venv and installs dependencies (idempotent, safe to run repeatedly).

**Architecture**: FastAPI (Python) + Vue 3 + Vite + Tailwind + Pinia + WebSockets. JSON file storage adapter (swappable). Docker Compose for development, Cloud Run for production.

**Gotchas**: Node.js v19.9.0 requires downgraded Vite 4.5.0 and Tailwind 3.4.0 • JSON storage uses atomic writes (temp file + rename) for concurrent safety

**Context**: Read [spec/disco_incognito_spec.md](spec/disco_incognito_spec.md) when planning new features or making architectural decisions (phased implementation plan, API endpoints, deployment config, game flow details)
