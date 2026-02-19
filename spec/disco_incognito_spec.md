# Disco Incognito - Multiplayer Music Guessing Game Specification

> **NOTE**: Spotify integration has been removed. The app now uses guest login (display name only) and manual song entry (title + artist text fields). All Spotify OAuth, adapter, and playback sections below are historical and do not reflect the current implementation.

## Process

- When building the app follow the steps in order and check them off as you go
- commit to git after each phase
- Add comments so a new developer can understand the code. If the code is referencing other parts of the code base tell the new developer where to find those files
- At the end of every phase, run the automated test suite and use Puppeteer to capture and review screenshots before moving forward
- After every checklist item, make a local commit documenting progress (do not push until the end of the project)

## Project Overview

🎧 **Disco Incognito** is a multiplayer web game where players must guess which player has a different song than everyone else. One player becomes the "Dancer Incognito" and is assigned a different track while all other players get the same song. Players listen on their own, then vote on who they think the Dancer Incognito is.

## Technology Stack

- **Backend**: FastAPI (Python) + WebSockets
- **Frontend**: Vue3 + Vite + Tailwind CSS + Pinia
- **Real-time**: WebSockets for multiplayer communication
- **Storage**: JSON file–backed room and session storage via swappable adapter pattern
- **Testing & Verification**: Pytest / Vitest (as appropriate) plus Puppeteer-driven screenshot review workflow
- **Authentication**: Guest login (display name only) with token-based sessions
- **Deployment**: Docker + Docker Compose

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Initialize Project Structure

- [ ] Set up backend directory structure (`/backend`)
- [ ] Set up frontend directory structure (`/frontend`)
- [ ] Create `.gitignore` file for both Python and Node.js
- [ ] Initialize git repository
- [ ] Create an initial commit capturing the scaffolded project structure
- [ ] Set up Docker configuration files

### 1.2 Backend Setup (FastAPI + WebSockets + JSON Storage)

- [ ] Create `requirements.txt` with comprehensive dependencies:
  - FastAPI, uvicorn, python-dotenv, spotipy, python-multipart
  - websockets, pydantic, pydantic-settings
  - python-jose for JWT handling
- [ ] Create FastAPI app structure with WebSocket support
- [ ] Set up CORS middleware for frontend communication
- [ ] Implement storage adapter interface with default JSON file implementation
- [ ] Define default storage file path (e.g., `./data/disco_incognito.json`) and ensure directory creation
- [ ] Create comprehensive `.env` file template

### 1.3 Frontend Setup (Vue3 + Vite + Tailwind + Pinia)

- [ ] Initialize Vue3 project with Vite (v4.5.0 for Node.js v19.9.0 compatibility)
- [ ] Install and configure Tailwind CSS v3.4.0 (dark theme with pink accents)
- [ ] Install dependencies: axios, vue-router, pinia, @vueuse/core
- [ ] Set up Pinia store for state management
- [ ] Configure Vite for development and production builds
- [ ] Create component structure for multiplayer game UI
- [ ] Set up WebSocket client for real-time communication
- [ ] Configure Puppeteer test harness for automated screenshot capture

### 1.4 Spotify API Setup

- [ ] Configure Spotify app credentials with comprehensive OAuth setup
- [ ] Set up redirect URI configuration (http://localhost:8000/api/auth/callback)
- [ ] Configure OAuth scopes: user-read-private, user-read-email, user-read-playback-state, user-modify-playback-state, user-read-currently-playing
- [ ] Implement token refresh mechanism
- [ ] Add "test mode" configuration toggle that routes Spotify calls through a spoofed adapter for local development

### 1.5 Session Management & Storage Adapter

- [ ] Define storage adapter pattern for room and session state
- [ ] Implement JSON file adapter as the default storage (single source-of-truth file on disk)
- [ ] Ensure adapter interface can be swapped for alternative persistence layers in future iterations
- [ ] Configure session storage leveraging the JSON adapter with optimistic locking or checksum safeguards
- [ ] Create room expiration policies (60 minutes inactivity)
- [ ] Seed an initial JSON data file (e.g., `{}`) and commit it so local devs share baseline state

---

## Phase 2: Authentication & User Management

### 2.1 Comprehensive OAuth Implementation

- [ ] Create SpotifyAuthService with complete OAuth flow
- [ ] Implement authorization URL generation with state parameter for CSRF protection
- [ ] Create secure callback handler with comprehensive error handling
- [ ] Implement token exchange with validation
- [ ] Add token refresh mechanism with automatic renewal
- [ ] Create middleware for token validation and user authentication

### 2.2 Security Implementation

- [ ] Implement CSRF protection with state parameters
- [ ] Add redirect URI validation
- [ ] Create secure token storage strategy
- [ ] Implement automatic token refresh on expiration
- [ ] Add rate limiting for API endpoints
- [ ] Create comprehensive error handling with user-friendly redirects
- [ ] Verify all authentication flows under the spoofed Spotify adapter when running in test mode

### 2.3 Authentication API Endpoints

- [ ] `GET /api/auth/login` - Generate Spotify authorization URL with state
- [ ] `GET /api/auth/callback` - Handle OAuth callback with RedirectResponse
- [ ] `GET /api/auth/refresh` - Refresh access token
- [ ] `GET /api/auth/logout` - Logout user and clear session
- [ ] `GET /api/user/profile` - Get authenticated user profile
- [ ] `GET /api/health` - Health check endpoint

### 2.4 Frontend Authentication Integration

- [ ] Create Pinia auth store with comprehensive state management
- [ ] Implement login flow with automatic redirect handling
- [ ] Add URL parameter extraction for OAuth tokens
- [ ] Create authentication guards for protected routes
- [ ] Implement automatic token refresh on API calls
- [ ] Add localStorage persistence with proper cleanup
- [ ] Ensure UI surfaces indicate when spoofed Spotify test mode is active

---

## Phase 3: Multiplayer Game Backend

### 3.1 Room Management System

- [ ] Create Room model using storage adapter (JSON file by default)
- [ ] Implement 3-digit numeric room code generation
- [ ] Add room creation and joining functionality
- [ ] Create room state management (lobby, playing, finished)
- [ ] Implement room expiration (60 minutes inactivity)
- [ ] Add player management within rooms
- [ ] Handle concurrent JSON file access with advisory locks or transactional write strategy

### 3.2 Game State Management

- [ ] Create GameState model with phases (lobby, song_selection, playing, guessing, reveal)
- [ ] Implement song pair management system
- [ ] Add "Dancer Incognito" selection logic
- [ ] Create round management with song assignment
- [ ] Implement voting system for guessing phase
- [ ] Add game progression and cleanup

### 3.3 WebSocket Communication

- [ ] Set up WebSocket connection management
- [ ] Create room-based message broadcasting
- [ ] Implement real-time player updates
- [ ] Add game state synchronization
- [ ] Create reconnection handling for disconnected players
- [ ] Implement heartbeat mechanism for connection health

### 3.4 Spotify Integration for Multiplayer

- [ ] Create simultaneous playback coordination
- [ ] Implement device management for multiple users
- [ ] Add track assignment (different songs for Dancer Incognito vs others)
- [ ] Create playback synchronization timing
- [ ] Handle Spotify API rate limits for multiple users
- [ ] Add fallback mechanisms for playback failures
- [ ] Build Spotify service interface with spoofed local adapter for development and real API adapter for production integration
- [ ] Document final integration checklist to run after local test mode is validated

### 3.5 Game API Endpoints

- [ ] `POST /api/rooms` - Create new room
- [ ] `POST /api/rooms/{room_code}/join` - Join existing room
- [ ] `GET /api/rooms/{room_code}` - Get room state
- [ ] `POST /api/rooms/{room_code}/songs` - Add song pair
- [ ] `POST /api/rooms/{room_code}/start` - Start game (host only)
- [ ] `POST /api/rooms/{room_code}/vote` - Submit guess
- [ ] `POST /api/rooms/{room_code}/next-round` - Start next round (host only)
- [ ] `DELETE /api/rooms/{room_code}/leave` - Leave room
- [ ] `WebSocket /api/ws/rooms/{room_code}/ws` - Real-time communication

---

## Phase 4: Frontend Game Implementation

### 4.1 Core Game Components

- [ ] Create Login page with Spotify authentication
- [ ] Build Room Selection page (Create/Join room)
- [ ] Implement Room Lobby with player list and controls
- [ ] Create Song Picker with Spotify search integration
- [ ] Build Game Play interface with countdown timer
- [ ] Implement Guessing Phase with player voting
- [ ] Create Reveal Screen with results display

### 4.2 Persistent UI Elements

- [ ] Create bottom music player bar with:
  - Left: Current song display (title only during playback)
  - Center: Play/Pause button (disabled during game rounds)
  - Right: Device status and selector
- [ ] Implement dark theme with pink accent colors
- [ ] Add responsive design for mobile and desktop
- [ ] Create loading states and error handling

### 4.3 Real-time Communication

- [ ] Set up WebSocket client with auto-reconnection
- [ ] Implement room state synchronization
- [ ] Add real-time player updates
- [ ] Create game phase transitions
- [ ] Handle connection status indicators
- [ ] Add message broadcasting for game events

### 4.4 Game Flow Implementation

Reference spec/gameflow.md for more notes on how the game works

- [ ] **Login Flow**: Spotify OAuth with token management
- [ ] **Room Selection**: Create (generate 3-digit code) or Join room
- [ ] **Room Lobby**: Player list, song pair count, host controls
- [ ] **Song Picker**: Search and select 2-song pairs
- [ ] **Game Start**: Countdown, music assignment, synchronized playback
- [ ] **Guessing Phase**: Player voting interface
- [ ] **Reveal**: Results display and round progression

### 4.5 State Management

- [ ] Create auth store with comprehensive token handling
- [ ] Implement room store for multiplayer state
- [ ] Add game store for current game state
- [ ] Create player store for user management
- [ ] Add music store for Spotify integration
- [ ] Implement WebSocket store for real-time communication
- [ ] Ensure stores can operate entirely in test mode with spoofed Spotify data

---

## Phase 5: Advanced Features & Polish

### 5.1 Live Spotify Integration

- [ ] Replace spoofed Spotify adapter with real API integration
- [ ] Re-run full automated tests and Puppeteer screenshot suite before enabling production mode
- [ ] Update documentation to reflect production credentials and adapter selection

### 5.2 User Experience Improvements

- [ ] Implement smooth animations and transitions
- [ ] Create intuitive mobile interface
- [ ] Implement accessibility features

### 5.3 Performance Optimizations

- [ ] Implement connection pooling for WebSockets
- [ ] Add caching for Spotify API responses
- [ ] Optimize real-time message handling
- [ ] Implement lazy loading for components
- [ ] Add service worker for offline functionality
- [ ] Optimize bundle size and loading times

---

## Technical Requirements

### Backend Requirements

- Python 3.10.12+ (tested and working)
- FastAPI framework with WebSocket support
- Spotipy library for Spotify API integration
- **Storage**: JSON file adapter implementation with a clear path to persistent store replacements
- Atomic JSON write strategy (temp file + rename or file locks) to avoid corruption
- Comprehensive OAuth 2.0 implementation
- WebSocket communication for real-time multiplayer
- Docker containerization (no virtual environments)
- Environment variable management
- Logging and monitoring

### Frontend Requirements

- Vue 3 with Composition API
- **Version Compatibility** (Node.js v19.9.0):
  - Vite v4.5.0 (downgraded for compatibility)
  - @vitejs/plugin-vue v4.5.0
  - Tailwind CSS v3.4.0 (downgraded for PostCSS compatibility)
- Pinia for state management
- WebSocket client for real-time communication
- Responsive design with dark theme
- Pink accent colors (#FF69B4, #FF1493)
- Mobile-first approach

### Multiplayer Requirements

- Real-time WebSocket communication
- Room-based game sessions (stored locally)
- Synchronized music playback
- Player state management
- Reconnection handling
- **Local game state persistence** via JSON file adapter (future adapters can be added)
- Anti-cheat measures

### Security Requirements

- OAuth 2.0 with CSRF protection
- Secure token storage and refresh
- Input validation and sanitization
- Rate limiting and abuse prevention
- Secure WebSocket connections
- Error message sanitization
- Production-ready security headers

### Environment Variables

```env
# Spotify API Configuration
SPOTIFY_CLIENT_ID=29031d6def0649eaa5c3f5f5d36363dc
SPOTIFY_CLIENT_SECRET=***
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Application URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8000

# Storage Adapter
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json

# Security
JWT_SECRET_KEY=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# Development
DEBUG=true
LOG_LEVEL=INFO
SPOTIFY_MODE=test
```

### Deployment Configuration

**Production Dockerfile (Google Cloud Run):**

```dockerfile
# Multi-stage Dockerfile for Google Cloud Run
# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ .

# Build the frontend
RUN npm run build

# Stage 2: Production backend
FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies (no virtual environment)
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Prepare JSON storage file
RUN mkdir -p /app/data
COPY data/disco_incognito.json /app/data/disco_incognito.json

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./static

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Expose port for Google Cloud Run
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Development Container Setup:**

```dockerfile
# dev.Dockerfile - Development container with hot reloading
FROM node:18-alpine AS dev-frontend

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source
COPY frontend/ .

# Expose frontend dev port
EXPOSE 3000

# Hot reload command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Backend development
FROM python:3.11-slim AS dev-backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt .

# Install Python dependencies (no virtual environment)
RUN pip install --no-cache-dir -r requirements.txt

# Install development tools
RUN pip install --no-cache-dir watchfiles

# Copy backend source
COPY backend/ .

# Prepare JSON storage file
RUN mkdir -p /app/data
COPY data/disco_incognito.json /app/data/disco_incognito.json

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Expose backend port
EXPOSE 8000

# Development server with hot reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Docker Compose for Development:**

```yaml
version: "3.8"
services:
  # Development backend
  backend:
    build:
      context: .
      dockerfile: dev.Dockerfile
      target: dev-backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./data:/app/data
    environment:
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
      - SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
      - DEBUG=true
      - SPOTIFY_MODE=test
      - SESSION_STORAGE=json_file
      - SESSION_STORAGE_FILE=/app/data/disco_incognito.json

  # Development frontend
  frontend:
    build:
      context: .
      dockerfile: dev.Dockerfile
      target: dev-frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app/frontend
      - /app/frontend/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_UI_MODE=minimal
```

**FastAPI CORS Configuration:**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Start Development Environment:**

```bash
# Start development containers
docker-compose -f docker-compose.dev.yml up --build

# Access the app:
# - Frontend: http://localhost:3000 (with hot reload)
# - Backend API: http://localhost:8000/api
# - CORS: Handled by FastAPI middleware
```

**Frontend Development:**

- Hot module replacement via Vite dev server
- Direct API calls to backend:8000
- WebSocket connections for real-time updates
- Accessible at `http://localhost:3000`
- Puppeteer-based screenshot workflow to validate each phase locally

**Backend Development:**

- Auto-reload with uvicorn `--reload` flag
- JSON file storage adapter for local development
- WebSocket support for multiplayer features
- API accessible at `http://localhost:8000/api`
- Spoofed Spotify adapter enabled by default (`SPOTIFY_MODE=test`)
- Shared `./data/disco_incognito.json` file is bind-mounted so local teams operate on the same baseline dataset

### Google Cloud Run Deployment

**Cloud Run Configuration:**

```yaml
# cloudbuild.yaml
steps:
  - name: "gcr.io/cloud-builders/docker"
    args: ["build", "-t", "gcr.io/$PROJECT_ID/disco-incognito", "."]
  - name: "gcr.io/cloud-builders/docker"
    args: ["push", "gcr.io/$PROJECT_ID/disco-incognito"]
  - name: "gcr.io/cloud-builders/gcloud"
    args:
      - "run"
      - "deploy"
      - "disco-incognito"
      - "--image"
      - "gcr.io/$PROJECT_ID/disco-incognito"
      - "--platform"
      - "managed"
      - "--region"
      - "us-central1"
      - "--allow-unauthenticated"
      - "--port"
      - "8080"
      - "--memory"
      - "1Gi"
      - "--concurrency"
      - "80"
      - "--max-instances"
      - "10"
```

**Environment Variables for Cloud Run:**

```bash
# Set via gcloud CLI or Google Cloud Console
gcloud run services update disco-incognito \
  --set-env-vars="SPOTIFY_CLIENT_ID=your_client_id" \
  --set-env-vars="SPOTIFY_CLIENT_SECRET=your_client_secret" \
  --set-env-vars="SPOTIFY_REDIRECT_URI=https://your-app.run.app/api/auth/callback" \
  --set-env-vars="SESSION_STORAGE=json_file" \
  --set-env-vars="SESSION_STORAGE_FILE=/mnt/disco_incognito/disco_incognito.json" \
  --set-env-vars="SPOTIFY_MODE=live" \
  --set-env-vars="DEBUG=false"
```

Mount the chosen Cloud Storage bucket into the container (for example via Cloud Storage FUSE) at `/mnt/disco_incognito` so every instance reads and writes the shared JSON state file.

### Key Changes for Cloud Run

1. **Shared JSON Storage**: Uses JSON file adapter with bucket-mounted path for cross-instance persistence
2. **No Virtual Environments**: All Python dependencies installed directly in container
3. **Port 8080**: Google Cloud Run requires port 8080
4. **Adapter Flexibility**: Future storage backends can replace the JSON adapter without container rebuilds
5. **WebSocket Support**: Full WebSocket support for real-time multiplayer

This configuration provides a production-ready setup for Google Cloud Run while maintaining a smooth development experience with hot module replacement and a clear path to swap in different storage or Spotify adapters.

## Delivery Rubric

- **Minimalist UI**: Keep interface elements focused on core gameplay with restrained styling choices across web and mobile layouts.
- **Automated Validation**: Run the full automated test suite and review Puppeteer-generated screenshots at the end of every section before advancing.
- **Adapter Discipline**: Maintain clean boundaries for storage and Spotify integrations so implementations remain swappable.
- **Documentation & Checkpoints**: Record outcomes from each phase's tests and screenshot reviews to confirm readiness to move on.
