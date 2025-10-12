# Manual Test Checklist for Screenshot Validation

**Environment**: Chrome cannot be run in this container due to missing system dependencies.
**Automated tests**: Run `npm run test:screenshots` on a system with Chrome installed.

## Test Scenarios to Verify

### 1. Login Page (Route: `/`)
**Expected Outcome:**
- [ ] Title "DISCO INCOGNITO" displays fully without cutoff
- [ ] Letter spacing is readable (tracking-[0.3em])
- [ ] No muted text/description below title
- [ ] Two buttons visible: "Log in with Spotify" (pink) and "Test Playback" (gray)
- [ ] NO server disconnected banner should be visible
- [ ] NO error notifications should be visible
- [ ] Clean, minimalist design

**Validation Command:**
```bash
npm run test:screenshots
# Check: 1-login.png
```

### 2. Test Playback Page (Route: `/test`)
**Expected Outcome:**
- [ ] Header: "Playback Test"
- [ ] Search input for songs
- [ ] Mock search results display
- [ ] Selected track card with playback controls
- [ ] Device connection status display
- [ ] Back button
- [ ] Music player bar at bottom
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 1.5-test-playback.png
```

### 3. Room Selection (Route: `/rooms`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 2-room-selection.png
```

### 4. Room Lobby (Route: `/rooms/123`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 3-room-lobby.png
```

### 5. Song Picker (Route: `/rooms/123/songs`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 4-song-picker.png
```

### 6. Game View (Route: `/rooms/123/play`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 5-game.png
```

### 7. Guessing View (Route: `/rooms/123/guess`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 6-guessing.png
```

### 8. Reveal View (Route: `/rooms/123/reveal`)
**Expected Outcome:**
- [ ] Page renders without errors
- [ ] NO server disconnected banner should be visible

**Validation Command:**
```bash
npm run test:screenshots
# Check: 7-reveal.png
```

### 9. Server Disconnected Demo (Route: `/test/server-disconnected`)
**Expected Outcome:**
- [ ] Shows the SAME login page layout as route `/`
- [ ] Title "DISCO INCOGNITO" without cutoff
- [ ] Two buttons: "Log in with Spotify" and "Test Playback"
- [ ] **RED banner at bottom** with:
  - Warning icon (pulsing)
  - "Server Disconnected" heading
  - "Lost connection to server. Check your network." message
  - "Retry" button (red)
- [ ] NO error notifications at top

**Validation Command:**
```bash
npm run test:screenshots
# Check: 8-error-server-disconnected.png
```

**Key Code Reference:**
- Banner component: `frontend/src/components/ServerDisconnectedBanner.vue`
- Triggers on: `wsStore.status === 'disconnected'`
- Set in: `ServerDisconnectedDemoView.vue` onMounted hook

### 10. Exception Demo (Route: `/test/exception`)
**Expected Outcome:**
- [ ] Shows the SAME login page layout as route `/`
- [ ] Title "DISCO INCOGNITO" without cutoff
- [ ] Two buttons: "Log in with Spotify" and "Test Playback"
- [ ] **Error notification toasts at top** with:
  - Red toast: "Connection Failed" - "Unable to connect to the Spotify API..."
  - Yellow toast: "Premium Required" - "Spotify Premium account required..."
  - Proper icons (error X, warning triangle)
  - Dismiss buttons (X) on each
- [ ] NO server disconnected banner at bottom

**Validation Command:**
```bash
npm run test:screenshots
# Check: 9-error-exceptions.png
```

**Key Code Reference:**
- Toast component: `frontend/src/components/NotificationToast.vue`
- Triggered via: `notificationStore.error()` and `notificationStore.warning()`
- Set in: `ExceptionDemoView.vue` onMounted hook

## Common Issues to Watch For

### ❌ BUGS FIXED:
1. ~~"INCOGNITO" text cutoff~~ - Fixed by reducing letter-spacing from 0.6em to 0.3em
2. ~~Server banner showing on all pages~~ - Fixed by changing WebSocket default status to "connected"
3. ~~Muted text cluttering login~~ - Fixed by removing description paragraph
4. ~~Inconsistent error demo layouts~~ - Fixed by using login page layout in demos

### ✅ EXPECTED BEHAVIOR:
- Banner ONLY shows on `/test/server-disconnected` route
- Notifications ONLY show on `/test/exception` route
- All other pages are clean without error states
- Login page is minimal: title + 2 buttons

## Running Tests

### Automated (requires system with Chrome):
```bash
cd frontend
npm run test:screenshots
```

### Manual (using dev server):
```bash
cd frontend
npm run dev
# Visit http://localhost:3000 and navigate to each route
```

### Using Docker:
```bash
docker-compose -f docker-compose.dev.yml up frontend
# Visit http://localhost:3000
```

## Screenshot Validation Success Criteria

All screenshots should show:
1. ✅ Proper mobile viewport (390×844px, 3× scale)
2. ✅ Clean rendering without console errors
3. ✅ Correct error states only on designated pages
4. ✅ No text cutoff or overflow
5. ✅ Consistent styling and spacing

## Test Results

**Status:** CANNOT RUN - Chrome requires system dependencies not available in container

**Next Steps:**
- Run tests on local machine with Chrome installed
- OR run tests in CI/CD pipeline with Chrome support
- OR use Docker with Chrome pre-installed

**Manual Verification:**
- Dev server starts successfully ✅
- Frontend builds without errors ✅
- All components render without TypeScript errors ✅
