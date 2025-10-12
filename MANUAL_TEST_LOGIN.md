# Manual Test: Login Workflow

This document provides steps to manually test the login workflow, particularly the "Create Test User" functionality.

## Prerequisites

Ensure the following configuration is in place:

**Backend** (`backend/.env`):
```bash
SPOTIFY_MODE=test
MUSIC_SERVICE=spotify
DEBUG=true
```

**Frontend** (`frontend/.env`):
```bash
VITE_TEST_MODE=true
VITE_API_URL=http://localhost:8000
```

## Test Scenarios

### Scenario 1: Test User Creation (Happy Path)

**Steps:**
1. Start backend server:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Start frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to `http://localhost:3000/`

4. **Verify UI:**
   - Page title: "Disco Incognito"
   - Helper text: "Test Mode: Each login creates a new random user"
   - Button text: "Create Test User"

5. **Click "Create Test User" button**

**Expected Results:**
- Button changes to "Creating Test User..." with disabled state
- After ~1 second, success message appears: "Welcome, [Random Name]!"
  - Example: "Welcome, Groovy Dancer!"
  - Example: "Welcome, Cosmic Unicorn!"
- Browser console shows: "✅ Test user created: [Random Name]"
- After 1 second, automatically redirects to `/rooms`

**Backend Logs Should Show:**
```
INFO: Test login successful for user: Groovy Dancer
```

**LocalStorage Should Contain:**
- `access_token`: "test-access-token"
- `refresh_token`: "test-refresh-token"
- `user`: `{"id":"test-user-a3f2b8c1","displayName":"Groovy Dancer","email":"test-user-a3f2b8c1@disco.test"}`

### Scenario 2: Test User Creation (Multiple Times)

**Steps:**
1. From Room Selection page, go back to `/`
2. Click "Create Test User" again
3. Repeat 3-5 times

**Expected Results:**
- Each time creates a NEW user with different name
- Examples:
  - First: "Funky Star"
  - Second: "Neon Champion"
  - Third: "Sparkly Bee"
  - Fourth: "Electric Phoenix"
  - Fifth: "Jazzy Hero"

### Scenario 3: Test Backend Endpoint Directly

**Using curl:**
```bash
curl -X POST http://localhost:8000/api/auth/test-login
```

**Expected Response:**
```json
{
  "access_token": "test-access-token",
  "refresh_token": "test-refresh-token",
  "expires_in": "3600",
  "user_id": "test-user-7d9e4f2a",
  "display_name": "Cosmic Unicorn",
  "email": "test-user-7d9e4f2a@disco.test"
}
```

**Run multiple times - each should return different display_name**

### Scenario 4: Test Mode Disabled (Production Simulation)

**Steps:**
1. Change `backend/.env`:
   ```bash
   SPOTIFY_MODE=live
   DEBUG=false
   ```

2. Restart backend

3. Try to call test login:
   ```bash
   curl -X POST http://localhost:8000/api/auth/test-login
   ```

**Expected Result:**
```json
{
  "detail": "Test login is only available in test/debug mode"
}
```

Status code: 403 Forbidden

### Scenario 5: Frontend Error Handling

**Steps:**
1. Stop the backend server
2. In frontend at `http://localhost:3000/`, click "Create Test User"

**Expected Results:**
- Button shows "Creating Test User..." briefly
- Red error box appears with message like:
  - "Network Error" or
  - "Failed to create test user"
- Button returns to normal state

### Scenario 6: Browser Console Verification

**Open browser DevTools > Console**

**Click "Create Test User"**

**Expected Console Output:**
```
✅ Test user created: Groovy Dancer
```

**Check Network Tab:**
- Request to: `http://localhost:8000/api/auth/test-login`
- Method: POST
- Status: 200 OK
- Response contains `display_name`, `access_token`, etc.

### Scenario 7: LocalStorage Persistence

**Steps:**
1. Login and create test user
2. Note the user name (e.g., "Funky Star")
3. Refresh the page (F5)

**Expected Results:**
- User should still be logged in
- Auth store should load tokens from localStorage
- Can verify in Application tab > Local Storage

## Automated Test Script

Create a simple script to verify the endpoint works:

```bash
#!/bin/bash
# test_login_workflow.sh

echo "Testing login workflow..."
echo

# Test 1: Check test mode is enabled
echo "Test 1: Check test mode status"
curl -s http://localhost:8000/api/testing/status | jq .
echo

# Test 2: Create 5 test users and show their names
echo "Test 2: Creating 5 test users"
for i in {1..5}; do
  echo -n "User $i: "
  curl -s -X POST http://localhost:8000/api/auth/test-login | jq -r '.display_name'
done
echo

# Test 3: Verify names are different
echo "Test 3: Verify uniqueness"
echo "Creating 10 users and checking for duplicates..."
names=$(for i in {1..10}; do
  curl -s -X POST http://localhost:8000/api/auth/test-login | jq -r '.display_name'
done)

echo "$names" | sort | uniq -d | wc -l | {
  read count
  if [ "$count" -eq 0 ]; then
    echo "✅ All names are unique"
  else
    echo "❌ Found $count duplicate names"
  fi
}

echo
echo "Testing complete!"
```

**Run with:**
```bash
chmod +x test_login_workflow.sh
./test_login_workflow.sh
```

## Common Issues

### Issue: "Network Error" when clicking button

**Cause:** Backend not running
**Solution:** Start backend with `uvicorn app.main:app --reload`

### Issue: Button shows "Log in with Spotify" instead of "Create Test User"

**Cause:** `VITE_TEST_MODE` not set to true
**Solution:**
1. Check `frontend/.env` has `VITE_TEST_MODE=true`
2. Restart Vite dev server
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: 403 Forbidden from `/api/auth/test-login`

**Cause:** Backend not in test mode
**Solution:**
1. Check `backend/.env` has `SPOTIFY_MODE=test`
2. Restart backend server

### Issue: Same username every time

**Cause:** Unlikely but possible if random seed is broken
**Solution:** Check backend logs for errors in `TestMusicAdapter`

### Issue: Redirect to `/rooms` doesn't work

**Cause:** Vue Router not configured properly
**Solution:** Check `frontend/src/router/index.ts` has `/rooms` route

## Success Criteria

✅ Button shows "Create Test User" in test mode
✅ Button is clickable and shows loading state
✅ Backend generates random disco-themed username
✅ Each login creates unique user ID
✅ Success message shows username
✅ Auto-redirects to room selection after 1 second
✅ Tokens stored in localStorage
✅ User info stored in auth store
✅ Console shows success message
✅ Multiple logins create different users
✅ Test endpoint returns 403 when not in test mode

## Integration with Test Data Seeding

Once logged in, you can test the full flow:

1. Login as test user (e.g., "Groovy Dancer")
2. Navigate to Room Selection
3. Backend should have test rooms seeded (123, 456, 789, etc.)
4. Join a room to see multiplayer features

This provides an end-to-end test of the authentication and test data systems working together.
