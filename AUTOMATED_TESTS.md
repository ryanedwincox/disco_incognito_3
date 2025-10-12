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

### Location
`frontend/tests/e2e/login-flow.test.mjs`

### Technology
- **Framework**: Puppeteer
- **Integration**: Full stack (backend + frontend)
- **Viewport**: Mobile (390x844) - iPhone 12/13 Pro

### Tests Included

1. **Page loads with correct UI** - Title, button, helper text
2. **Test mode indicator visible** - "Test Mode" text present
3. **Login button click and loading state** - Button becomes disabled
4. **Success message appears** - "Welcome, [Username]!" message
5. **Redirect to /rooms** - Navigation after login
6. **Tokens stored in localStorage** - Persistence verification
7. **Multiple logins create unique users** - Randomness verification

### Running E2E Tests

**Prerequisites:**
1. Backend must be running on http://localhost:8000
2. Frontend will start automatically

```bash
# Start backend first
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, run E2E tests
cd frontend
npm run test:e2e:login

# Run with visible browser (non-headless)
HEADLESS=false npm run test:e2e:login
```

### Expected Output

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

## Running All Tests

### Quick Test (Frontend Only)

```bash
cd frontend
npm test
```

This runs:
1. Unit tests (Vitest)
2. E2E login tests (Puppeteer)

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
✅ **7 E2E tests** - Complete user workflow simulation
✅ **37 total automated tests** - Full coverage of login workflow

All tests verify that clicking "Create Test User" successfully creates a random disco-themed user and properly handles the authentication flow!
