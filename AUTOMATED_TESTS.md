# Automated Tests for Login Workflow

This document describes the automated tests for the login workflow, including backend API tests, frontend unit tests, and end-to-end integration tests.

## Test Suite Overview

The project includes three levels of automated testing:

1. **Backend API Tests** (Python/pytest) - Test authentication endpoints
2. **Frontend Unit Tests** (TypeScript/Vitest) - Test auth store logic
3. **E2E Tests** (Puppeteer) - Test complete user workflow

## Backend API Tests

### Location
`backend/tests/test_auth_login.py`

### Technology
- **Framework**: pytest
- **Client**: FastAPI TestClient
- **Coverage**: Authentication endpoints

### Tests Included

1. **test_test_login_endpoint_exists** - Endpoint is accessible
2. **test_test_login_creates_user** - Returns all required fields
3. **test_test_login_returns_valid_tokens** - Token format is correct
4. **test_test_login_creates_unique_users** - Each call creates different user
5. **test_test_login_user_id_format** - User ID follows `test-user-{8hex}` format
6. **test_test_login_email_format** - Email is `{user_id}@disco.test`
7. **test_test_login_display_name_format** - Name is disco-themed (adjective + noun)
8. **test_test_login_randomness** - High uniqueness rate over multiple calls
9. **test_regular_login_endpoint_still_works** - OAuth endpoint unaffected
10. **test_logout_endpoint_works** - Logout functionality works
11. **test_complete_test_login_flow** - Full integration test

### Running Backend Tests

```bash
# From backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test
pytest tests/test_auth_login.py::test_test_login_creates_unique_users

# Run with coverage
pytest --cov=app --cov-report=html
```

### Expected Output

```
================================ test session starts =================================
collected 11 items

tests/test_auth_login.py::test_test_login_endpoint_exists PASSED           [  9%]
tests/test_auth_login.py::test_test_login_creates_user PASSED              [ 18%]
tests/test_auth_login.py::test_test_login_returns_valid_tokens PASSED      [ 27%]
tests/test_auth_login.py::test_test_login_creates_unique_users PASSED      [ 36%]
tests/test_auth_login.py::test_test_login_user_id_format PASSED            [ 45%]
tests/test_auth_login.py::test_test_login_email_format PASSED              [ 54%]
tests/test_auth_login.py::test_test_login_display_name_format PASSED       [ 63%]
tests/test_auth_login.py::test_test_login_randomness PASSED                [ 72%]
tests/test_auth_login.py::test_regular_login_endpoint_still_works PASSED   [ 81%]
tests/test_auth_login.py::test_logout_endpoint_works PASSED                [ 90%]
tests/test_auth_login.py::test_complete_test_login_flow PASSED             [100%]

✅ Test user created successfully: Groovy Dancer
   User ID: test-user-a3f2b8c1
   Email: test-user-a3f2b8c1@disco.test

================================= 11 passed in 2.34s =================================
```

## Frontend Unit Tests

### Location
`frontend/tests/unit/auth.test.ts`

### Technology
- **Framework**: Vitest
- **Store**: Pinia
- **Mocking**: vi (Vitest mocking)
- **Coverage**: Auth store actions and getters

### Tests Included

**Initial State:**
- Initial tokens are null
- Test mode detection from environment
- Not authenticated initially

**Actions:**
- `setTokens` - Stores tokens in state and localStorage
- `setUser` - Stores user info
- `clearTokens` - Clears all auth data
- `loadFromStorage` - Restores from localStorage
- `testLogin` - Creates test user via API

**Error Handling:**
- Network errors
- 403 Forbidden (test mode disabled)
- Invalid JSON in storage

**Getters:**
- `isAuthenticated` - Checks token presence
- `userName` - Returns display name or "Guest"

**Integration:**
- State persistence through page reload

### Running Frontend Unit Tests

```bash
# From frontend directory
cd frontend

# Run all unit tests
npm run test:unit

# Watch mode (auto-rerun on changes)
npm run test:watch

# Run with UI
npm run test:unit -- --ui

# Run specific test file
npm run test:unit tests/unit/auth.test.ts
```

**Configuration Note:**
The `vite.config.ts` file includes test configuration to ensure only unit tests are run:
```typescript
test: {
  globals: true,
  environment: "jsdom",
  include: ["tests/unit/**/*.test.ts"],
  exclude: ["tests/e2e/**/*"]
}
```
This prevents E2E tests from being picked up by Vitest's unit test runner.

### Expected Output

```
 ✓ tests/unit/auth.test.ts (19)
   ✓ Auth Store (19)
     ✓ Initial State (3)
       ✓ should have null tokens initially
       ✓ should detect test mode from environment
       ✓ should not be authenticated initially
     ✓ setTokens (1)
       ✓ should set tokens in store and localStorage
     ✓ setUser (1)
       ✓ should set user in store and localStorage
     ✓ clearTokens (1)
       ✓ should clear tokens and user from store and localStorage
     ✓ loadFromStorage (3)
       ✓ should load tokens and user from localStorage
       ✓ should handle missing localStorage data gracefully
       ✓ should handle invalid JSON in user storage
     ✓ testLogin (6)
       ✓ should successfully create a test user
       ✓ should handle API errors gracefully
       ✓ should handle 403 Forbidden (test mode disabled)
       ✓ should call the correct API endpoint
       ✓ should store tokens in localStorage
     ✓ Getters (4)
       ✓ isAuthenticated should return true when token exists
       ✓ isAuthenticated should return false when no token
       ✓ userName should return display name when user exists
       ✓ userName should return "Guest" when no user
     ✓ Integration (1)
       ✓ should maintain authentication state through reload

Test Files  1 passed (1)
     Tests  19 passed (19)
  Start at  14:23:45
  Duration  1.24s (transform 89ms, setup 0ms, collect 234ms, tests 156ms)
```

## E2E Tests

The project includes two E2E test suites that test complete user workflows:

### Login Flow Tests

**Location:** `frontend/tests/e2e/login-flow.test.mjs`

**Technology:**
- **Framework**: Puppeteer
- **Integration**: Full stack (backend + frontend)
- **Viewport**: Mobile (390x844) - iPhone 12/13 Pro

**Tests Included:**

1. **Page loads with correct UI** - Title, button, helper text
2. **Test mode indicator visible** - "Test Mode" text present
3. **Login button click and loading state** - Button becomes disabled
4. **Success message appears** - "Welcome, [Username]!" message
5. **Redirect to /rooms** - Navigation after login
6. **Tokens stored in localStorage** - Persistence verification
7. **Multiple logins create unique users** - Randomness verification

### Room Selection & Playback Tests

**Location:** `frontend/tests/e2e/room-selection.test.mjs`

**Technology:**
- **Framework**: Puppeteer
- **Integration**: Frontend navigation and UI interactions
- **Viewport**: Mobile (390x844) - iPhone 12/13 Pro

**Tests Included:**

1. **Navigate to room selection page** - Page loads with correct heading
2. **Create Room button exists and is clickable** - Button is visible and enabled
3. **Create Room button navigates to room lobby** - Creates random 3-digit code and navigates to /rooms/:code
4. **Room code input field exists** - Input has correct maxlength attribute
5. **Join Room button exists and is clickable** - Button is visible and enabled
6. **Test Playback button navigates to /test** - Navigation works correctly
7. **Playback test page loads correctly** - Heading and search input present
8. **Back button exists on playback test page** - "Back to Room Selection" button is present
9. **Back button navigates to /rooms** - Returns to room selection page (not login)
10. **Room code input accepts exactly 3 characters** - Input length validation
11. **Search functionality on playback test page** - Search shows results

### Complete Game Flow Tests

**Location:** `frontend/tests/e2e/game-flow.test.mjs`

**Technology:**
- **Framework**: Puppeteer
- **Integration**: Frontend UI and navigation
- **Viewport**: Mobile (390x844) - iPhone 12/13 Pro

**Tests Included:**

**Room Lobby (5 tests):**
1. **Room lobby page loads correctly** - Room code displays
2. **Leave button exists** - Leave button present
3. **Pick Songs button exists** - Pick Songs button present
4. **Players section displays** - Player list shows
5. **Song Pairs section displays** - Song pairs section present

**Song Picker (4 tests):**
6. **Song picker page loads correctly** - "Pick a Pair" heading
7. **Search input exists** - Spotify search input with placeholder
8. **Search Results section exists** - Results section present
9. **Selected Pair section with Save button** - Save Pair button present

**Game Play (3 tests):**
10. **Game play page loads correctly** - "Round In Progress" heading
11. **Countdown timer displays** - Timer shows remaining time (01:30)
12. **Music player bar exists** - Music controls present

**Guessing (3 tests):**
13. **Guessing page loads correctly** - "Who Is The Odd Duck" heading
14. **Player cards display** - At least 2 player cards shown
15. **Guess buttons exist** - Guess buttons for each player

**Reveal (5 tests):**
16. **Reveal page loads correctly** - "Reveal" heading
17. **Odd Duck section displays** - Shows who was the Odd Duck
18. **Votes section displays** - Shows voting results
19. **Next Round button exists** - Button to continue playing
20. **Vote results show guess outcomes** - Displays correct/incorrect guesses

### Running E2E Tests

**Prerequisites:**
1. Backend must be running on http://localhost:8000 (required for login tests)
2. Frontend will start automatically

```bash
# Start backend first (required for login tests)
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, run E2E tests
cd frontend

# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e:login   # Login workflow tests (7 tests)
npm run test:e2e:rooms   # Room selection & playback tests (11 tests)
npm run test:e2e:game    # Complete game flow tests (20 tests)

# Run with visible browser (non-headless)
HEADLESS=false npm run test:e2e:login
HEADLESS=false npm run test:e2e:rooms
HEADLESS=false npm run test:e2e:game
```

### Expected Output - Login Flow Tests

```
🚀 Starting E2E Login Flow Tests

✅ Backend is running

Starting Vite dev server...
✅ Frontend running at http://127.0.0.1:5173

Test 1: Page loads with correct UI
   ✅ Page loaded with correct UI

Test 2: Test mode indicator visible
   ✅ Test mode indicator visible

Test 3: Login button click and loading state
   ✅ Button click successful

Test 4: Success message appears
   📝 Browser: ✅ Test user created: Groovy Dancer
   ✅ Success message appeared: "Welcome, Groovy Dancer!"

Test 5: Redirect to room selection
   ✅ Redirected to http://127.0.0.1:5173/rooms

Test 6: Tokens stored in localStorage
   ✅ Tokens stored: test-access-token...
   ✅ User stored: Groovy Dancer

Test 7: Multiple logins create unique users
   User 1: Funky Star
   User 2: Cosmic Unicorn
   User 3: Neon Champion
   ✅ All 3 users are unique

==================================================
📊 Test Results
==================================================
✅ Passed: 7
❌ Failed: 0
📈 Total:  7
==================================================
```

### Expected Output - Room Selection Tests

```
🚀 Starting E2E Room Selection Tests

ℹ️  Backend not running (not required for these tests)

Starting Vite dev server...
✅ Frontend running at http://127.0.0.1:5173

Test 1: Navigate to room selection page
   ✅ Room selection page loaded successfully

Test 2: Create Room button exists and is clickable
   ✅ Create Room button is present and clickable

Test 3: Create Room button navigates to room lobby
   ✅ Create Room navigated to http://127.0.0.1:5173/rooms/342

Test 4: Room code input field exists
   ✅ Room code input exists with correct attributes

Test 5: Join Room button exists and is clickable
   ✅ Join Room button is present and clickable

Test 6: Test Playback button navigates to /test
   ✅ Navigated to http://127.0.0.1:5173/test

Test 7: Playback test page loads correctly
   ✅ Playback test page loaded with correct UI

Test 8: Back button exists on playback test page
   ✅ Back to Room Selection button is present

Test 9: Back button navigates to /rooms
   ✅ Navigated back to room selection page at http://127.0.0.1:5173/rooms

Test 10: Room code input accepts exactly 3 characters
   ✅ Room code input correctly limits to 3 characters

Test 11: Search functionality on playback test page
   ✅ Search functionality works correctly

==================================================
📊 Test Results
==================================================
✅ Passed: 11
❌ Failed: 0
📈 Total:  11
==================================================
```

## Running All Tests

### Quick Test (Frontend Only)

```bash
cd frontend
npm test
```

This runs:
1. Unit tests (Vitest) - 19 tests
2. E2E login tests (Puppeteer) - 7 tests
3. E2E room selection tests (Puppeteer) - 11 tests
4. E2E game flow tests (Puppeteer) - 20 tests

### Full Test Suite (Backend + Frontend)

```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Run backend tests
cd backend
pytest -v

# Terminal 3: Run frontend tests
cd frontend
npm test
```

### CI/CD Script

Create a script to run all tests in sequence:

```bash
#!/bin/bash
# run_all_tests.sh

set -e  # Exit on error

echo "🧪 Running Full Test Suite"
echo "=========================="
echo

# Backend tests
echo "📦 Backend Tests"
echo "----------------"
cd backend
pytest -v
echo

# Frontend unit tests
echo "🎨 Frontend Unit Tests"
echo "----------------------"
cd ../frontend
npm run test:unit
echo

# E2E tests (requires backend running)
echo "🌐 E2E Tests"
echo "------------"
echo "⚠️  Make sure backend is running on port 8000"
npm run test:e2e:login
echo

echo "✅ All tests passed!"
```

## Test Coverage

### Backend Coverage

```bash
cd backend
pytest --cov=app --cov-report=term --cov-report=html
```

View HTML report at `backend/htmlcov/index.html`

### Frontend Coverage

```bash
cd frontend
npm run test:unit -- --coverage
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Login Workflow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run backend tests
        run: |
          cd backend
          pytest -v

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '19'

      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Run frontend unit tests
        run: |
          cd frontend
          npm run test:unit

      - name: Start backend for E2E
        run: |
          cd backend
          uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          sleep 5

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e:login
```

## Troubleshooting

### Backend Tests Fail

**Issue:** `ModuleNotFoundError: No module named 'pytest'`
**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

### Frontend Unit Tests Fail

**Issue:** `Cannot find module 'axios'`
**Solution:**
```bash
cd frontend
npm install
```

### E2E Tests Fail - Backend Not Available

**Issue:** `❌ Backend not available at http://localhost:8000`
**Solution:**
```bash
# Start backend in separate terminal
cd backend
uvicorn app.main:app --reload --port 8000
```

### E2E Tests Fail - Puppeteer Errors

**Issue:** `Error: Failed to launch the browser process`
**Solution:**
```bash
# Install Chromium
cd frontend
npx puppeteer browsers install chrome

# Or use system Chromium
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
npm run test:e2e:login
```

### Tests Pass But No Output

**Issue:** Tests run but no console output
**Solution:** Use verbose flags:
```bash
# Backend
pytest -v -s

# Frontend
npm run test:unit -- --reporter=verbose
```

## Test Maintenance

### Updating Tests When Code Changes

1. **New Auth Store Action** → Add unit test in `auth.test.ts`
2. **New API Endpoint** → Add backend test in `test_auth_login.py`
3. **UI Changes** → Update E2E test selectors in `login-flow.test.mjs`
4. **New User Name Format** → Update validation in all test files

### Adding New Test Scenarios

**Backend:**
```python
def test_my_new_scenario(client):
    """Test description."""
    response = client.post("/api/auth/test-login")
    assert response.status_code == 200
    # Add assertions
```

**Frontend Unit:**
```typescript
it('should handle my new scenario', async () => {
  const authStore = useAuthStore()
  // Test logic
  expect(authStore.someProperty).toBe(expected)
})
```

**E2E:**
```javascript
console.log("Test 8: My new E2E test");
try {
  // Test logic
  console.log("   ✅ Test passed\n");
  passed++;
} catch (error) {
  console.log(`   ❌ Failed: ${error.message}\n`);
  failed++;
}
```

## Summary

✅ **11 Backend API tests** - Comprehensive endpoint validation
✅ **19 Frontend unit tests** - Store logic and error handling
✅ **38 E2E tests** - Complete user workflow simulation
   - 7 login flow tests
   - 11 room selection & playback tests
   - 20 complete game flow tests (lobby → picker → play → guess → reveal)
✅ **68 total automated tests** - Full coverage of authentication, navigation, and game flow

All tests verify:
- Test user creation with random disco-themed names
- Authentication flow with proper error handling
- All buttons and navigation on room selection page
- Create Room generates random 3-digit code and navigates to room lobby
- Join Room functionality with validation
- Test playback page functionality
- Back button navigates to room selection (not login)
- Complete game flow through all phases:
  - Room lobby with players and song pairs
  - Song picker with search and selection
  - Game play with countdown timer
  - Guessing phase with player selection
  - Reveal phase with results and next round
