# Test Data Seeding for Screenshots

This document explains the test data seeding system that creates realistic screenshots with multiple players and song pairs.

## Overview

The application now includes a comprehensive test data seeding system that:
- **Generates random disco-themed usernames** for test users (e.g., "Groovy Dancer", "Funky Star")
- **Creates multiple room scenarios** with different states and player counts
- **Seeds realistic song pairs** from popular disco/dance tracks
- **Provides an API endpoint** for automated screenshot testing

## Random Test User Generation

### Test Adapter Enhancement

The `TestMusicAdapter` (backend/app/music/test_adapter.py) now generates unique users with fun disco-themed names:

**Features:**
- Random combination of adjectives and nouns (e.g., "Sparkly Bee", "Cosmic Unicorn")
- Unique user IDs for each login
- Consistent "premium" account status
- No credentials required

**Adjectives:** Groovy, Funky, Sparkly, Dancing, Boogie, Glittery, Shiny, Swinging, Electric, Cosmic, Neon, Stellar, Jazzy, Rad, Cool, Smooth, Flashy, Golden, Vivid, Retro

**Nouns:** Dancer, Star, Bee, Tiger, Eagle, Phoenix, Comet, Diamond, Pearl, Unicorn, Knight, Champion, Hero, Legend, Maverick, Rebel, Voyager, Dreamer, Wizard, Ninja

### Usage

In test mode (`SPOTIFY_MODE=test`), every login creates a new random user:

```bash
# Set in .env
SPOTIFY_MODE=test
MUSIC_SERVICE=spotify

# Each auth callback generates a new user like:
# - "Groovy Dancer" (test-user-a3f2b8c1)
# - "Cosmic Unicorn" (test-user-7d9e4f2a)
# - "Neon Champion" (test-user-5b8c3a1d)
```

## Room Scenarios

The seeding system creates 6 different room scenarios for comprehensive screenshot testing:

### Scenario 1: Empty Lobby (Room 123)
- **Players:** 1 (host only)
- **Song Pairs:** 0
- **Status:** lobby
- **Use Case:** New room, waiting for players

### Scenario 2: Lobby with Players (Room 456)
- **Players:** 7 (1 host + 6 guests)
- **Song Pairs:** 0
- **Status:** lobby
- **Use Case:** Players joined, waiting for song pairs

### Scenario 3: Lobby Ready (Room 789)
- **Players:** 7
- **Song Pairs:** 3
- **Status:** lobby
- **Use Case:** Ready to start game (has enough song pairs)

### Scenario 4: Playing (Room 111)
- **Players:** 7
- **Song Pairs:** 3
- **Status:** playing
- **Odd Duck:** Randomly selected
- **Use Case:** Active game round with music playing

### Scenario 5: Guessing (Room 222)
- **Players:** 7
- **Song Pairs:** 3
- **Status:** guessing
- **Odd Duck:** Randomly selected
- **Use Case:** Players voting for the odd duck

### Scenario 6: Reveal (Room 333)
- **Players:** 7
- **Song Pairs:** 3
- **Status:** reveal
- **Odd Duck:** Randomly selected
- **Use Case:** Showing results and correct answer

## Mock Song Pairs

The seeding uses realistic disco/dance song pairs:

| Track A | Track B |
|---------|---------|
| Stayin' Alive - Bee Gees | Night Fever - Bee Gees |
| September - Earth, Wind & Fire | Boogie Wonderland - Earth, Wind & Fire |
| I Will Survive - Gloria Gaynor | Never Can Say Goodbye - Gloria Gaynor |
| Le Freak - Chic | Good Times - Chic |
| Don't Stop 'Til You Get Enough - Michael Jackson | Rock With You - Michael Jackson |
| Dancing Queen - ABBA | Gimme! Gimme! Gimme! - ABBA |
| Ring My Bell - Anita Ward | Shake Your Groove Thing - Peaches & Herb |
| Car Wash - Rose Royce | Best of My Love - The Emotions |

## API Endpoints

### POST /api/testing/seed

Seeds all test scenarios to the database.

**Requirements:**
- `SPOTIFY_MODE=test` OR `DEBUG=true`

**Response:**
```json
{
  "message": "Test data seeded successfully",
  "rooms": ["123", "456", "789", "111", "222", "333"]
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/testing/seed
```

### DELETE /api/testing/clear

Clears all test data from the database.

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/testing/clear
```

### GET /api/testing/status

Check if testing features are enabled.

**Response:**
```json
{
  "test_mode_enabled": true,
  "spotify_mode": "test",
  "debug": true
}
```

## Screenshot Test Integration

The screenshot runner (frontend/tests/e2e/screenshot-runner.mjs) automatically:

1. **Seeds test data** before capturing screenshots
2. **Captures 12 different scenarios**:
   - 1-login.png
   - 2-room-selection.png
   - 3-test-playback.png
   - 4a-room-lobby-empty.png (Room 123)
   - 4b-room-lobby-players.png (Room 456)
   - 4c-room-lobby-ready.png (Room 789)
   - 5-song-picker.png
   - 6-game-playing.png (Room 111)
   - 7-guessing.png (Room 222)
   - 8-reveal.png (Room 333)
   - 9-error-server-disconnected.png
   - 10-error-exceptions.png

### Running Screenshot Tests

```bash
# From frontend directory
npm run test:screenshots

# The test runner will:
# 1. Call POST /api/testing/seed (if backend is running)
# 2. Start Vite dev server
# 3. Launch Puppeteer
# 4. Capture screenshots at mobile viewport (390x844)
# 5. Save to tests/e2e/screenshots/
```

**Note:** If the backend is not running, the test runner will show a warning but continue with the current frontend state.

## Development Workflow

### 1. Start Backend in Test Mode

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ensure .env has:
# SPOTIFY_MODE=test
# DEBUG=true
```

### 2. Seed Test Data

```bash
# Option A: Via API
curl -X POST http://localhost:8000/api/testing/seed

# Option B: Run screenshot tests (seeds automatically)
cd frontend
npm run test:screenshots
```

### 3. View Seeded Rooms

Navigate to different room codes to see various states:
- http://localhost:3000/rooms/123 (empty lobby)
- http://localhost:3000/rooms/456 (7 players, no songs)
- http://localhost:3000/rooms/789 (7 players + 3 songs)
- http://localhost:3000/rooms/111/play (playing)
- http://localhost:3000/rooms/222/guess (guessing)
- http://localhost:3000/rooms/333/reveal (reveal)

### 4. Clear Test Data

```bash
curl -X DELETE http://localhost:8000/api/testing/clear
```

## File Structure

```
backend/app/
├── music/
│   ├── test_adapter.py          # Random user generation
│   └── ...
├── testing/
│   ├── __init__.py
│   └── mock_data.py             # Seeding logic
├── api/routes/
│   └── testing.py               # Seeding API endpoints
└── ...

frontend/tests/e2e/
├── screenshot-runner.mjs         # Automated screenshot testing
└── screenshots/                  # Generated screenshots
    ├── 1-login.png
    ├── 4a-room-lobby-empty.png
    ├── 4b-room-lobby-players.png
    ├── 4c-room-lobby-ready.png
    └── ...
```

## Configuration

### Environment Variables

```bash
# Enable test mode
SPOTIFY_MODE=test
MUSIC_SERVICE=spotify
DEBUG=true

# Storage location
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json
```

### Disabling Test Features

Test data seeding is automatically disabled in production when:
- `SPOTIFY_MODE=live`
- `DEBUG=false`

The API endpoints will return 403 Forbidden in this configuration.

## Future Enhancements

When the frontend is fully connected to the backend API:

1. **Live Room Updates:** Seeded data will appear in real-time via WebSocket
2. **Player Interactions:** Test users can join rooms and interact
3. **Song Playback:** Mock playback control with the seeded song pairs
4. **Vote Recording:** Guessing phase will record votes from test users

Currently, the frontend views show hardcoded data, but the backend infrastructure is ready for integration.

## Troubleshooting

### Screenshots Show Hardcoded Data

**Cause:** Frontend views are not yet connected to backend API
**Solution:** This is expected. The seeding infrastructure is ready for Phase 3-4 implementation.

### Seeding API Returns 403

**Cause:** Test mode is disabled
**Solution:** Set `SPOTIFY_MODE=test` or `DEBUG=true` in .env

### Backend Not Seeding Data

**Cause:** Database file permissions or path issues
**Solution:** Check `SESSION_STORAGE_FILE` path and ensure write permissions

### Random Names Not Changing

**Cause:** Using cached tokens
**Solution:** Each new login creates a new user. Clear browser storage between tests.

## Summary

The test data seeding system provides:
- ✅ Random disco-themed usernames for every test login
- ✅ 6 different room scenarios for comprehensive testing
- ✅ Realistic song pairs from popular disco tracks
- ✅ API endpoints for automated screenshot testing
- ✅ Integration with existing screenshot test suite
- ✅ Multiple lobby states (empty, with players, ready to play)
- ✅ Game state scenarios (playing, guessing, reveal)

This infrastructure is ready for use once the frontend is connected to the backend WebSocket and REST APIs in Phase 3-4.
