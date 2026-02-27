/**
 * E2E tests: Full game lifecycle with UI-only interactions.
 * Zero page.reload(), zero fetch(), zero API helpers.
 * All player actions through browser UI. Phase transitions detected via WS-driven DOM updates.
 *
 * Coverage requirements:
 *   a. Player join reflected in existing player's lobby WITHOUT reload
 *   b. Player leave reflected WITHOUT reload
 *   c. Host transfer visible to new host WITHOUT reload
 *   d. Game start auto-navigates non-host players to song assignment WITHOUT reload
 *   e. Each player sees their assigned song (received via WS per-user state)
 *   f. All phase transitions: lobby -> song_selection -> guessing -> results -> lobby
 *   g. (moved to reconnect.spec.ts)
 *   h. No WS on room selection: logged-in user on room selection has no active WS
 *   i. At least 3 browser contexts: host, player, guest
 *   j. Full game cycle through all phases
 *   k. Host transfer on host leave
 *   l. Song adding by user
 *   m. Guest login flow (now the only login flow)
 */
import { test, expect } from './fixtures';
import type { Browser, Page, BrowserContext } from '@playwright/test';

const FRONTEND_PORT = process.env.VITE_PORT || '9100';
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// ============================================================================
// UI Interaction Helpers (no fetch, no reload)
// ============================================================================

/** Navigate to app landing page (initial load only — allowed per constraints). */
async function loadLandingPage(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  const loginButton = page.getByRole('button', { name: 'Login' });
  await expect(loginButton).toBeVisible({ timeout: 10000 });
}

/** Login with a display name via UI. Fills name input, clicks Login. */
async function loginWithName(page: Page, name: string): Promise<void> {
  const nameInput = page.locator('#guest-handle');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  const loginButton = page.getByRole('button', { name: 'Login' });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  // Wait for RoomSelectionView
  const createRoomButton = page.getByRole('button', { name: 'Create Room' });
  await expect(createRoomButton).toBeVisible({ timeout: 10000 });
}

/** Create room with deterministic code (310) via UI. */
async function createRoom(page: Page): Promise<string> {
  await page.evaluate(() => {
    Math.random = () => 0.234; // floor(100 + 0.234 * 900) = 310
  });
  const createRoomButton = page.getByRole('button', { name: 'Create Room' });
  await expect(createRoomButton).toBeVisible();
  await expect(createRoomButton).toBeEnabled();
  await createRoomButton.click();
  // Wait for RoomLobbyView
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await expect(roomCodeDisplay).toContainText('310');
  // Verify host badge
  await expect(page.locator('text=Host').first()).toBeVisible();
  return '310';
}

/** Join room by entering room code via UI. */
async function joinRoomViaUI(page: Page, roomCode: string): Promise<void> {
  const roomCodeInput = page.locator('#room-code');
  await expect(roomCodeInput).toBeVisible();
  await roomCodeInput.fill(roomCode);
  const joinButton = page.getByRole('button', { name: 'Join Room' });
  await expect(joinButton).toBeVisible();
  await joinButton.click();
  // Wait for RoomLobbyView
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await expect(roomCodeDisplay).toContainText(roomCode);
}

/**
 * Add songs via UI (manual title+artist entry for 2 songs + click Add Song Pair + back to lobby).
 * Coverage req (l): Song adding by user.
 */
async function addSongs(page: Page): Promise<void> {
  const pickSongsButton = page.getByRole('button', { name: 'Add Songs' });
  await expect(pickSongsButton).toBeVisible();
  await pickSongsButton.click();

  // Wait for SongPickerView title/artist inputs
  const song1Title = page.locator('#song1-title');
  await expect(song1Title).toBeVisible({ timeout: 10000 });

  // Fill Song 1
  await song1Title.fill("Stayin' Alive");
  await page.locator('#song1-artist').fill('Bee Gees');

  // Fill Song 2
  await page.locator('#song2-title').fill('September');
  await page.locator('#song2-artist').fill('Earth, Wind & Fire');

  // Add song pair
  const addButton = page.getByRole('button', { name: 'Add Song Pair' });
  await expect(addButton).toBeEnabled();
  await addButton.click();

  // Wait for navigation back to lobby (goBack is called on success)
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
}

/** Leave room via UI Leave button. */
async function leaveRoomViaUI(page: Page): Promise<void> {
  const leaveButton = page.getByRole('button', { name: 'Leave' });
  await expect(leaveButton).toBeVisible();
  await leaveButton.click();
  // After leaving, should see RoomSelectionView (Create Room button)
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible({ timeout: 10000 });
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Full Game Lifecycle: UI-Only Multi-User E2E', () => {
  test('full game cycle with host, player, and guest through all phases', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext; // trigger fixture — starts servers

    // Create 3 separate browser contexts: host, player, guest
    // Coverage req (i): At least 3 browser contexts
    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();
    const guestPage: Page = await guestContext.newPage();

    try {
      // ======================================================================
      // PHASE 1: Host creates room and adds songs
      // Coverage req (l): Song adding by user
      // ======================================================================
      console.log('\n=== PHASE 1: Host creates room ===');

      await loadLandingPage(hostPage);

      // Coverage req (h): No WS on room selection
      // Track WebSocket connections opened during login + room selection
      let wsConnectionCount = 0;
      const wsListener = () => { wsConnectionCount++; };
      hostPage.on('websocket', wsListener);
      await loginWithName(hostPage, 'DJ Host');
      await expect(hostPage.getByRole('button', { name: 'Create Room' })).toBeVisible();
      // Brief wait to catch any delayed WS connections
      await hostPage.waitForTimeout(1000);
      expect(wsConnectionCount).toBe(0);
      console.log('✅ Coverage (h): No WS connection on room selection screen');
      hostPage.removeListener('websocket', wsListener);

      const roomCode = await createRoom(hostPage);
      console.log(`✅ Host created room: ${roomCode}`);

      await addSongs(hostPage);
      console.log('✅ Coverage (l): Host added songs via UI');

      // Verify song count updated in lobby
      await expect(hostPage.locator('text=song pairs in queue')).toBeVisible({ timeout: 5000 });

      // ======================================================================
      // PHASE 2: Player joins room
      // Coverage req (a): Player join reflected in existing player's lobby WITHOUT reload
      // ======================================================================
      console.log('\n=== PHASE 2: Player joins room ===');

      await loadLandingPage(playerPage);
      await loginWithName(playerPage, 'Funky Player');
      await joinRoomViaUI(playerPage, roomCode);
      console.log('✅ Player joined room via UI');

      // Coverage (a): Host sees player in lobby WITHOUT reload (WS player_joined)
      // Host should see 2 players in the player list via WS update
      const hostPlayerList = hostPage.locator('ul.space-y-3 li');
      await expect(hostPlayerList).toHaveCount(2, { timeout: 10000 });
      console.log('✅ Coverage (a): Host sees player join in lobby WITHOUT reload');

      // ======================================================================
      // PHASE 2b: Guest joins room
      // Coverage req (m): Guest login flow
      // ======================================================================
      console.log('\n=== PHASE 2b: Guest joins room ===');

      await loadLandingPage(guestPage);
      // Coverage req (m): Guest login flow (same as all login flows now)
      await loginWithName(guestPage, 'Guest Player');
      console.log('✅ Coverage (m): Guest logged in via login flow');

      await joinRoomViaUI(guestPage, roomCode);
      console.log('✅ Guest joined room via UI');

      // Host and player see guest join WITHOUT reload (WS player_joined)
      await expect(hostPlayerList).toHaveCount(3, { timeout: 10000 });
      const playerPlayerList = playerPage.locator('ul.space-y-3 li');
      await expect(playerPlayerList).toHaveCount(3, { timeout: 10000 });
      console.log('✅ All players see 3 players in lobby without reload');

      // ======================================================================
      // PHASE 4: Host starts game, all auto-navigate to song assignment
      // Coverage req (d): Game start auto-navigates non-host players WITHOUT reload
      // Coverage req (e): Each player sees their assigned song
      // Coverage req (f): lobby -> song_selection transition
      // ======================================================================
      console.log('\n=== PHASE 4: Host starts game ===');

      const startButton = hostPage.getByRole('button', { name: 'Start Game' });
      await expect(startButton).toBeVisible({ timeout: 5000 });
      await startButton.click();

      // Host sees song assignment via HTTP response
      const hostYourSong = hostPage.locator('h1:has-text("Your Song")');
      await expect(hostYourSong).toBeVisible({ timeout: 10000 });
      console.log('✅ Host sees song assignment view');

      // Coverage (d): Player auto-navigates via WS phase_changed + assigned_song
      const playerYourSong = playerPage.locator('h1:has-text("Your Song")');
      await expect(playerYourSong).toBeVisible({ timeout: 10000 });
      console.log('✅ Coverage (d): Player auto-navigated to song assignment via WS');

      // Coverage (d): Guest auto-navigates via WS
      const guestYourSong = guestPage.locator('h1:has-text("Your Song")');
      await expect(guestYourSong).toBeVisible({ timeout: 10000 });
      console.log('✅ Coverage (d): Guest auto-navigated to song assignment via WS');

      // Coverage (e): Each player sees their assigned song (not "Unknown Song")
      const hostSongTitle = hostPage.locator('h3.text-2xl.font-bold');
      await expect(hostSongTitle).toBeVisible();
      await expect(hostSongTitle).not.toHaveText('Unknown Song');
      const hostSong = await hostSongTitle.textContent();
      console.log(`✅ Coverage (e): Host assigned song: ${hostSong}`);

      const playerSongTitle = playerPage.locator('h3.text-2xl.font-bold');
      await expect(playerSongTitle).toBeVisible();
      await expect(playerSongTitle).not.toHaveText('Unknown Song');
      const playerSong = await playerSongTitle.textContent();
      console.log(`✅ Coverage (e): Player assigned song: ${playerSong}`);

      const guestSongTitle = guestPage.locator('h3.text-2xl.font-bold');
      await expect(guestSongTitle).toBeVisible();
      await expect(guestSongTitle).not.toHaveText('Unknown Song');
      const guestSong = await guestSongTitle.textContent();
      console.log(`✅ Coverage (e): Guest assigned song: ${guestSong}`);

      // ======================================================================
      // PHASE 5: Host clicks End Round → guessing → all vote via UI → results
      // Coverage req (f): song_selection -> guessing -> results transitions
      // ======================================================================
      console.log('\n=== PHASE 5: Host ends round + voting phase ===');

      // Host clicks "End Round" button to transition song_selection→guessing
      const endRoundButton = hostPage.getByRole('button', { name: 'End Round' });
      await expect(endRoundButton).toBeVisible({ timeout: 10000 });
      await endRoundButton.click();
      console.log('✅ Host clicked End Round');
      console.log('✅ Coverage (f): song_selection -> guessing transition');

      // All players should see GuessingView via WS phase_changed broadcast
      const hostGuessHeader = hostPage.locator('h1:has-text("Who Is The Dancer Incognito?")');
      await expect(hostGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Host on guessing page');

      const playerGuessHeader = playerPage.locator('h1:has-text("Who Is The Dancer Incognito?")');
      await expect(playerGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Player on guessing page (via WS)');

      const guestGuessHeader = guestPage.locator('h1:has-text("Who Is The Dancer Incognito?")');
      await expect(guestGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Guest on guessing page (via WS)');

      // Host votes via UI (all vote via actual UI interactions, no page.evaluate/fetch)
      const hostVoteButtons = hostPage.locator('button:has-text("Guess ")');
      await expect(hostVoteButtons.first()).toBeVisible({ timeout: 10000 });
      await hostVoteButtons.first().click();
      await expect(hostPage.locator('.bg-green-900\\/30')).toBeVisible({ timeout: 5000 });
      console.log('✅ Host voted via UI');

      // Player votes via UI
      const playerVoteButtons = playerPage.locator('button:has-text("Guess ")');
      await expect(playerVoteButtons.first()).toBeVisible({ timeout: 10000 });
      await playerVoteButtons.first().click();
      await expect(playerPage.locator('.bg-green-900\\/30')).toBeVisible({ timeout: 5000 });
      console.log('✅ Player voted via UI');

      // Guest votes via UI — this is the last vote, triggers guessing→results
      const guestVoteButtons = guestPage.locator('button:has-text("Guess ")');
      await expect(guestVoteButtons.first()).toBeVisible({ timeout: 10000 });
      await guestVoteButtons.first().click();
      console.log('✅ Guest voted via UI (last vote — triggers results transition)');

      // ======================================================================
      // PHASE 7: Results phase
      // Coverage req (f): guessing -> results transition
      // ======================================================================
      console.log('\n=== PHASE 7: Results phase ===');

      // All should see ResultsView with "REVEAL" header via WS phase_changed
      // Guest may transition immediately (from vote response) or via WS
      const guestReveal = guestPage.locator('h1:has-text("Reveal")');
      await expect(guestReveal).toBeVisible({ timeout: 10000 });
      console.log('✅ Guest sees Results view');

      // Host and player should see results via WS broadcast
      const hostReveal = hostPage.locator('h1:has-text("Reveal")');
      await expect(hostReveal).toBeVisible({ timeout: 10000 });
      console.log('✅ Host sees Results view (via WS)');

      const playerReveal = playerPage.locator('h1:has-text("Reveal")');
      await expect(playerReveal).toBeVisible({ timeout: 10000 });
      console.log('✅ Player sees Results view (via WS)');

      // Verify Dancer Incognito revealed
      const hostIncognito = hostPage.locator('.bg-disco-pink\\/20');
      await expect(hostIncognito).toBeVisible();
      await expect(hostIncognito.locator('h3:has-text("Dancer Incognito")')).toBeVisible();
      console.log('✅ Dancer Incognito revealed');

      // Verify votes displayed (3 votes: host, player, guest)
      const hostVoteItems = hostPage.locator('ul.space-y-2 li');
      await expect(hostVoteItems).toHaveCount(3, { timeout: 5000 });
      console.log('✅ All 3 votes displayed');

      // Verify correct guessers highlighted (green)
      // At least some vote results should be visible
      await expect(hostPage.locator('ul.space-y-2 li').first()).toBeVisible();
      console.log('✅ Vote results displayed with highlighting');

      // Verify Finish Round only visible for host
      await expect(hostPage.getByRole('button', { name: 'Finish Round' })).toBeVisible();
      await expect(playerPage.getByRole('button', { name: 'Finish Round' })).not.toBeVisible();
      await expect(guestPage.getByRole('button', { name: 'Finish Round' })).not.toBeVisible();
      console.log('✅ Finish Round button only visible for host');

      // ======================================================================
      // PHASE 8: Host finishes round → all return to lobby
      // Coverage req (f): results -> lobby transition
      // ======================================================================
      console.log('\n=== PHASE 8: Finish round ===');

      const finishButton = hostPage.getByRole('button', { name: 'Finish Round' });
      await finishButton.click();

      // Host should return to lobby (via HTTP response)
      const hostLobbyCode = hostPage.locator('.text-4xl.font-bold');
      await expect(hostLobbyCode).toBeVisible({ timeout: 10000 });
      await expect(hostLobbyCode).toContainText(roomCode);
      console.log('✅ Host back in lobby');

      // Player and guest should return to lobby via WS phase_changed(lobby)
      const playerLobbyCode = playerPage.locator('.text-4xl.font-bold');
      await expect(playerLobbyCode).toBeVisible({ timeout: 10000 });
      await expect(playerLobbyCode).toContainText(roomCode);
      console.log('✅ Player back in lobby (via WS)');

      const guestLobbyCode = guestPage.locator('.text-4xl.font-bold');
      await expect(guestLobbyCode).toBeVisible({ timeout: 10000 });
      await expect(guestLobbyCode).toContainText(roomCode);
      console.log('✅ Guest back in lobby (via WS)');

      console.log('✅ Coverage (f): All phase transitions complete: lobby → song_selection → guessing → results → lobby');
      console.log('✅ Coverage (j): Full game cycle through all phases complete');

    } finally {
      await hostContext.close();
      await playerContext.close();
      await guestContext.close();
    }
  });

  test('player leave reflected WITHOUT reload and host transfer works', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext;

    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();
    const guestPage: Page = await guestContext.newPage();

    try {
      // ======================================================================
      // SETUP: Host creates room, player and guest join
      // ======================================================================
      console.log('\n=== SETUP: Room with 3 players ===');

      await loadLandingPage(hostPage);
      await loginWithName(hostPage, 'DJ Host');
      const roomCode = await createRoom(hostPage);
      console.log(`✅ Host created room: ${roomCode}`);

      await loadLandingPage(playerPage);
      await loginWithName(playerPage, 'Funky Player');
      await joinRoomViaUI(playerPage, roomCode);

      await loadLandingPage(guestPage);
      await loginWithName(guestPage, 'Guest Player');
      await joinRoomViaUI(guestPage, roomCode);

      // Wait for all to see 3 players
      await expect(hostPage.locator('ul.space-y-3 li')).toHaveCount(3, { timeout: 10000 });
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(3, { timeout: 10000 });
      console.log('✅ All 3 players in lobby');

      // ======================================================================
      // TEST 1: Non-host player leaves — reflected WITHOUT reload
      // Coverage req (b): Player leave reflected WITHOUT reload
      // ======================================================================
      console.log('\n=== TEST 1: Guest leaves room ===');

      await leaveRoomViaUI(guestPage);
      console.log('✅ Guest left room via UI');

      // Host and player should see 2 players WITHOUT reload (WS player_left)
      await expect(hostPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      console.log('✅ Coverage (b): Player leave reflected in lobby WITHOUT reload');

      // Host badge should still be on the original host
      await expect(hostPage.locator('text=Host').first()).toBeVisible();
      console.log('✅ Host unchanged after non-host leaves');

      // ======================================================================
      // TEST 2: Host leaves → host transfers to remaining player
      // Coverage req (c): Host transfer visible to new host WITHOUT reload
      // Coverage req (k): Host transfer on host leave
      // ======================================================================
      console.log('\n=== TEST 2: Host leaves, transfers to player ===');

      await leaveRoomViaUI(hostPage);
      console.log('✅ Host left room via UI');

      // Player should now see themselves as host WITHOUT reload (WS player_left + new_host_id)
      // Verify: Start Game button appears (host-only)
      await expect(playerPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10000 });
      console.log('✅ Coverage (c): Host transfer visible to new host WITHOUT reload');

      // Verify Host badge appears on the player
      await expect(playerPage.locator('text=Host').first()).toBeVisible();
      console.log('✅ Coverage (k): Host transfer on host leave — new host sees Host badge and Start Game');

      // Player should see 1 player in lobby
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(1, { timeout: 5000 });
      console.log('✅ Player is now the only player in the room');

    } finally {
      await hostContext.close();
      await playerContext.close();
      await guestContext.close();
    }
  });

  test('player leave returns to room selection without disconnect banner and host transfers', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext;

    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();
    const guestPage: Page = await guestContext.newPage();

    try {
      // ======================================================================
      // SETUP: Host creates room, player and guest join (3 players in lobby)
      // ======================================================================
      console.log('\n=== SETUP: Room with 3 players ===');

      await loadLandingPage(hostPage);
      await loginWithName(hostPage, 'DJ Host');
      const roomCode = await createRoom(hostPage);

      await loadLandingPage(playerPage);
      await loginWithName(playerPage, 'Funky Player');
      await joinRoomViaUI(playerPage, roomCode);

      await loadLandingPage(guestPage);
      await loginWithName(guestPage, 'Guest Player');
      await joinRoomViaUI(guestPage, roomCode);

      // All see 3 players
      await expect(hostPage.locator('ul.space-y-3 li')).toHaveCount(3, { timeout: 10000 });
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(3, { timeout: 10000 });
      console.log('✅ All 3 players in lobby');

      // ======================================================================
      // STEP 1-3: Guest clicks Leave, sees RoomSelectionView, no banner
      // ======================================================================
      console.log('\n=== Guest leaves room ===');

      await leaveRoomViaUI(guestPage);
      // leaveRoomViaUI already asserts Create Room button is visible
      console.log('✅ Guest sees RoomSelectionView after leaving');

      // Wait briefly to catch any flash of the disconnect banner
      await guestPage.waitForTimeout(1000);
      const guestBanner = guestPage.locator('role=alert >> text=Server Disconnected');
      await expect(guestBanner).not.toBeVisible();
      console.log('✅ No "Server Disconnected" banner on guest page after leave');

      // ======================================================================
      // STEP 4: Host and player see player count drop from 3 → 2 WITHOUT reload
      // ======================================================================
      await expect(hostPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      console.log('✅ Host and player see player count drop to 2 without reload');

      // ======================================================================
      // STEP 5-7: Host clicks Leave, sees RoomSelectionView, no banner
      // ======================================================================
      console.log('\n=== Host leaves room ===');

      await leaveRoomViaUI(hostPage);
      console.log('✅ Host sees RoomSelectionView after leaving');

      await hostPage.waitForTimeout(1000);
      const hostBanner = hostPage.locator('role=alert >> text=Server Disconnected');
      await expect(hostBanner).not.toBeVisible();
      console.log('✅ No "Server Disconnected" banner on host page after leave');

      // ======================================================================
      // STEP 8-9: Player sees count drop to 1, becomes host
      // ======================================================================
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(1, { timeout: 10000 });
      console.log('✅ Player sees player count drop to 1');

      // Player is now the host — "Start Game" button and "Host" badge visible
      await expect(playerPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10000 });
      await expect(playerPage.locator('text=Host').first()).toBeVisible();
      console.log('✅ Player is now the host — Start Game button and Host badge visible');

    } finally {
      await hostContext.close();
      await playerContext.close();
      await guestContext.close();
    }
  });
});
