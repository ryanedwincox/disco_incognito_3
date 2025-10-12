# Test Mode Configuration

This document explains how test mode is configured and how it affects the user experience, particularly around login and user creation.

## Overview

The application supports two modes:
- **Test Mode** (default for development): Uses mock data, creates random test users
- **Live Mode** (production): Uses real Spotify API and OAuth

## Test Mode Features

### Random User Creation

In test mode, the login flow creates a new random user with each authentication:
- **Unique disco-themed names** (e.g., "Groovy Dancer", "Cosmic Unicorn")
- **No Spotify account required**
- **Instant authentication** with mock tokens
- **Unique user IDs** for each session

### UI Changes in Test Mode

#### Login Button
- **Test Mode**: Shows "Create Test User"
- **Live Mode**: Shows "Log in with Spotify"

#### Helper Text
Test mode displays: "Test Mode: Each login creates a new random user"

## Configuration

### Backend Configuration

#### Environment Variables (.env)

```bash
# backend/.env
MUSIC_SERVICE=spotify
SPOTIFY_MODE=test          # Options: test, live
DEBUG=true
```

#### Docker Compose (docker-compose.dev.yml)

```yaml
backend:
  environment:
    - SPOTIFY_MODE=test
    - MUSIC_SERVICE=spotify
    - DEBUG=true
```

### Frontend Configuration

#### Environment Variables (.env)

```bash
# frontend/.env
VITE_TEST_MODE=true        # Controls UI elements
VITE_API_URL=http://localhost:8000
```

#### Docker Compose (docker-compose.dev.yml)

```yaml
frontend:
  environment:
    - VITE_TEST_MODE=true
    - VITE_API_URL=http://localhost:8000
```

## How It Works

### Backend Flow (Test Mode)

1. User clicks "Create Test User"
2. Frontend calls `GET /api/auth/login`
3. Backend uses `TestMusicAdapter` (via `get_music_adapter()`)
4. `TestMusicAdapter.get_user_info()` generates random name:
   - Selects random adjective (e.g., "Groovy")
   - Selects random noun (e.g., "Dancer")
   - Creates unique ID (e.g., "test-user-a3f2b8c1")
5. Returns mock user data to frontend
6. User is logged in as "Groovy Dancer"

### Frontend Detection

```typescript
// LoginView.vue
const isTestMode = computed(() => {
  return import.meta.env.VITE_TEST_MODE === 'true'
})
```

The button text changes based on `isTestMode`:
```vue
{{ isTestMode ? 'Create Test User' : 'Log in with Spotify' }}
```

## Switching Modes

### Development → Production

**Backend (.env):**
```bash
MUSIC_SERVICE=spotify
SPOTIFY_MODE=live          # Changed from test
DEBUG=false                # Disable debug features
SPOTIFY_CLIENT_ID=<real-client-id>
SPOTIFY_CLIENT_SECRET=<real-secret>
```

**Frontend (.env):**
```bash
VITE_TEST_MODE=false       # Changed from true
```

**Effect:**
- Login button shows "Log in with Spotify"
- Real OAuth flow with Spotify
- Test data seeding endpoints disabled (403 Forbidden)

### Testing Test Mode

Run the screenshot tests to verify test mode UI:

```bash
cd frontend
npm run test:screenshots
```

Check `tests/e2e/screenshots/1-login.png` to see:
- "Create Test User" button
- "Test Mode: Each login creates a new random user" text

## Docker Compose Development

When using `docker-compose.dev.yml`:

```bash
docker-compose -f docker-compose.dev.yml up
```

**Both services start in test mode:**
- Backend: `SPOTIFY_MODE=test` + `MUSIC_SERVICE=spotify`
- Frontend: `VITE_TEST_MODE=true`

**Benefits:**
- No Spotify credentials needed
- Instant user creation
- Test data seeding available
- Random users for screenshots

## Implementation Details

### Files Modified

**Backend:**
- `backend/app/music/test_adapter.py` - Random name generation (lines 14-24, 82-105)
- `backend/app/dependencies/music.py` - Adapter selection logic
- `backend/.env` - Added `MUSIC_SERVICE=spotify`
- `docker-compose.dev.yml` - Added `MUSIC_SERVICE` and `DEBUG` env vars

**Frontend:**
- `frontend/src/views/LoginView.vue` - Conditional button text and helper message
- `frontend/.env` - Created with `VITE_TEST_MODE=true`
- `docker-compose.dev.yml` - Added `VITE_TEST_MODE=true`

### Random Name Generation

```python
# backend/app/music/test_adapter.py
DISCO_ADJECTIVES = [
    "Groovy", "Funky", "Sparkly", "Dancing", "Boogie", "Glittery",
    "Shiny", "Swinging", "Electric", "Cosmic", "Neon", "Stellar",
    "Jazzy", "Rad", "Cool", "Smooth", "Flashy", "Golden", "Vivid", "Retro"
]

DISCO_NOUNS = [
    "Dancer", "Star", "Bee", "Tiger", "Eagle", "Phoenix", "Comet",
    "Diamond", "Pearl", "Unicorn", "Knight", "Champion", "Hero", "Legend",
    "Maverick", "Rebel", "Voyager", "Dreamer", "Wizard", "Ninja"
]

# 20 × 20 = 400 possible combinations
adjective = random.choice(DISCO_ADJECTIVES)
noun = random.choice(DISCO_NOUNS)
display_name = f"{adjective} {noun}"
```

### User ID Format

```python
user_id = f"test-user-{uuid.uuid4().hex[:8]}"
# Example: test-user-a3f2b8c1
```

## Verification

### Check Backend Mode

```bash
curl http://localhost:8000/api/testing/status
```

Response:
```json
{
  "test_mode_enabled": true,
  "spotify_mode": "test",
  "debug": true
}
```

### Check Frontend Mode

Open browser console and check:
```javascript
import.meta.env.VITE_TEST_MODE
// Returns: "true"
```

### Verify Login Button

Navigate to `http://localhost:3000/`:
- Should see "Create Test User" button
- Should see "Test Mode: Each login creates a new random user" text

## Security Note

**Test mode should NEVER be enabled in production:**
- Bypasses real authentication
- Creates unlimited test users
- Exposes testing endpoints
- Mock data instead of real user data

Always verify production environment has:
```bash
SPOTIFY_MODE=live
DEBUG=false
VITE_TEST_MODE=false
```

## Troubleshooting

### Button Still Shows "Log in with Spotify"

**Cause:** `VITE_TEST_MODE` not set or not "true"
**Solution:**
1. Check `frontend/.env` has `VITE_TEST_MODE=true`
2. Restart Vite dev server
3. Hard refresh browser (Ctrl+Shift+R)

### "Create Test User" in Production

**Cause:** `VITE_TEST_MODE=true` in production build
**Solution:**
1. Set `VITE_TEST_MODE=false` in production `.env`
2. Rebuild: `npm run build`
3. Verify build artifacts don't contain test mode flag

### Backend Not Using Test Adapter

**Cause:** Missing `MUSIC_SERVICE` or wrong `SPOTIFY_MODE`
**Solution:**
```bash
# backend/.env
MUSIC_SERVICE=spotify    # Must be set
SPOTIFY_MODE=test        # Must be "test" not "live"
```

Restart backend server.

### Random Names Not Appearing

**Cause:** Backend might not be in test mode
**Solution:**
1. Check backend logs for "TestMusicAdapter initialized"
2. Verify `/api/testing/status` shows test mode enabled
3. Check adapter selection in `dependencies/music.py`

## Summary

✅ **Test mode UI** - Login button says "Create Test User"
✅ **Random users** - Each login creates unique disco-themed name
✅ **Docker Compose** - Configured for test mode by default
✅ **Environment variables** - Both backend and frontend configured
✅ **No credentials needed** - Works without Spotify API setup
✅ **Screenshot tests** - Captures test mode UI state

Test mode is the default development experience, making it easy to work on the application without external dependencies!
