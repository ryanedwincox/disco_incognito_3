/**
 * Bug reproduction test: Non-host players don't auto-navigate when host starts game.
 *
 * EXPECTED: When host clicks 'Start Game', ALL players should automatically navigate
 * to /rooms/{code}/assignment via WebSocket phase_changed event.
 *
 * ACTUAL (BUG): Only host navigates (via HTTP response). Other players stay on lobby.
 *
 * This test SHOULD FAIL until the bug is fixed. It verifies WebSocket-triggered
 * navigation works for non-host players without manual goto().
 */
import { test, expect, getArtifactsPath } from './fixtures';
import type { Page, BrowserContext } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';
const TEST_NAME = 'game-start-player-sync';

// Helper: Load and verify landing page
async function loadLandingPage(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();
  const loginButton = page.getByRole('button', { name: 'Login with Spotify' });
  await expect(loginButton).toBeVisible();
}

// Helper: Login with Spotify (test mode)
async function loginWithSpotify(page: Page): Promise<void> {
  const loginButton = page.getByRole('button', { name: 'Login with Spotify' });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();

  // Wait for success message
  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 10000 });
  await expect(successMessage).toContainText('Welcome,');

  // Wait for redirect to /rooms
  await page.waitForURL('**/rooms', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// Helper: Login as guest (non-Spotify user)
async function loginAsGuest(page: Page, displayName: string): Promise<void> {
  // Click 'Continue as Guest' to show name input
  const guestButton = page.getByRole('button', { name: 'Continue as Guest' });
  await expect(guestButton).toBeEnabled();
  await guestButton.click();

  // Enter display name
  const nameInput = page.locator('#displayName');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(displayName);

  // Click 'Join as Guest'
  const joinButton = page.getByRole('button', { name: 'Join as Guest' });
  await expect(joinButton).toBeEnabled();
  await joinButton.click();

  // Wait for success message
  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 10000 });
  await expect(successMessage).toContainText('Welcome,');

  // Wait for redirect to /rooms
  await page.waitForURL('**/rooms', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Game Start Player Sync Bug Reproduction', () => {
  test('Non-host players should auto-navigate to /assignment when host starts game', async ({
    browser,
    serverContext,
  }) => {
    // Ensure servers are running
    expect(serverContext.backendProcess).not.toBeNull();
    expect(serverContext.frontendProcess).not.toBeNull();

    // ========================================================================
    // SETUP: Create host and player contexts with separate sessions
    // ========================================================================
    console.log('\n=== SETUP: Creating browser contexts ===');

    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();

    // ========================================================================
    // PHASE 1: Host creates room and adds songs
    // ========================================================================
    console.log('\n=== PHASE 1: Host creates room ===');

    // Host: Login with Spotify
    await loadLandingPage(hostPage);
    await loginWithSpotify(hostPage);
    console.log('Host logged in with Spotify');

    // Host: Create room
    const createRoomButton = hostPage.getByRole('button', { name: 'Create Room' });
    await expect(createRoomButton).toBeVisible({ timeout: 5000 });
    await createRoomButton.click();

    // Host: Wait for navigation to lobby
    await hostPage.waitForURL('**/rooms/*', { timeout: 10000 });
    await hostPage.waitForLoadState('networkidle');

    // Extract room code from URL
    const hostUrl = hostPage.url();
    const roomCodeMatch = hostUrl.match(/\/rooms\/(\d{3})/);
    expect(roomCodeMatch).not.toBeNull();
    const roomCode = roomCodeMatch![1];
    console.log(`Room created with code: ${roomCode}`);

    // Host: Navigate to song picker and add songs
    const pickSongsButton = hostPage.getByRole('button', { name: 'Pick Songs' });
    await expect(pickSongsButton).toBeVisible({ timeout: 5000 });
    await pickSongsButton.click();
    await hostPage.waitForURL(`**/rooms/${roomCode}/songs`, { timeout: 5000 });

    // Host: Search for songs using search input
    const searchInput = hostPage.locator('input[type="search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('chic');

    // Wait for search results to load
    await hostPage.waitForSelector('.max-h-80 button', { timeout: 10000 });

    // Select first track from search results
    const trackButtons = hostPage.locator('.max-h-80 button');
    await trackButtons.nth(0).click();

    // Wait for track to be selected
    await hostPage.waitForSelector('text=Selected Song', { timeout: 5000 });

    // Click 'Add Song' button
    const addButton = hostPage.getByRole('button', { name: 'Add Song' });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
    await addButton.click();

    // Wait for success message
    const successMessage = hostPage.locator('.bg-green-900\\/30');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    await expect(successMessage).toContainText('Added');
    console.log('First song added');

    // Select second track from search results
    await trackButtons.nth(1).click();
    await hostPage.waitForSelector('text=Selected Song', { timeout: 5000 });

    // Click 'Add Song' button for second song
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    console.log('Second song added');

    // Return to lobby
    const backButton = hostPage.getByRole('button', { name: 'Back to Lobby' });
    await backButton.click();
    await hostPage.waitForURL(`**/rooms/${roomCode}`, { timeout: 5000 });
    console.log('Host returned to lobby');

    // ========================================================================
    // PHASE 2: Player joins room
    // ========================================================================
    console.log('\n=== PHASE 2: Player joins room ===');

    // Player: Login as guest
    await loadLandingPage(playerPage);
    await loginAsGuest(playerPage, 'TestPlayer');
    console.log('Player logged in as guest');

    // Player: Join room via room code input
    const roomCodeInput = playerPage.locator('#room-code');
    await expect(roomCodeInput).toBeVisible({ timeout: 5000 });
    await roomCodeInput.fill(roomCode);

    const joinRoomButton = playerPage.getByRole('button', { name: 'Join Room' });
    await expect(joinRoomButton).toBeEnabled({ timeout: 5000 });
    await joinRoomButton.click();

    // Player: Wait for navigation to lobby
    await playerPage.waitForURL(`**/rooms/${roomCode}`, { timeout: 10000 });
    await playerPage.waitForLoadState('networkidle');
    console.log('Player joined room and is in lobby');

    // Verify WebSocket connected for player (check console logs or wait for player list)
    await playerPage.waitForSelector('ul.space-y-3 li', { timeout: 5000 });
    console.log('Player sees player list (WS connected)');

    // Take screenshot showing both in lobby
    const lobbyScreenshotPath = getArtifactsPath(TEST_NAME, 'player-in-lobby.png');
    await playerPage.screenshot({ path: lobbyScreenshotPath, fullPage: true });

    // ========================================================================
    // PHASE 3: Host starts game - BUG REPRODUCTION
    // ========================================================================
    console.log('\n=== PHASE 3: Host starts game (BUG REPRODUCTION) ===');

    // Host: Click Start Game
    const startGameButton = hostPage.getByRole('button', { name: 'Start Game' });
    await expect(startGameButton).toBeVisible({ timeout: 5000 });
    await startGameButton.click();
    console.log('Host clicked Start Game');

    // Host: Verify navigation to /assignment (this should work via HTTP response)
    await hostPage.waitForURL(`**/rooms/${roomCode}/assignment`, { timeout: 10000 });
    console.log('Host navigated to /assignment (via HTTP response)');

    // ========================================================================
    // BUG ASSERTION: Player should auto-navigate via WebSocket phase_changed
    // This is the critical test - player should navigate WITHOUT manual goto()
    // ========================================================================
    console.log('\n=== BUG ASSERTION: Player should auto-navigate ===');

    // Wait for player to auto-navigate to /assignment via WebSocket
    // This should happen within a few seconds if WebSocket event is received and handled
    // NOTE: We use waitForURL WITHOUT goto() - this tests the WS-triggered navigation
    try {
      await playerPage.waitForURL(`**/rooms/${roomCode}/assignment`, { timeout: 10000 });
      console.log('SUCCESS: Player auto-navigated to /assignment via WebSocket');
    } catch (error) {
      // Take screenshot showing player is still on lobby
      const failScreenshotPath = getArtifactsPath(TEST_NAME, 'player-stuck-on-lobby.png');
      await playerPage.screenshot({ path: failScreenshotPath, fullPage: true });
      console.log(`BUG CONFIRMED: Player stuck on lobby. Screenshot: ${failScreenshotPath}`);
      console.log(`Current player URL: ${playerPage.url()}`);
      throw new Error(
        `BUG: Player did not auto-navigate to /assignment. ` +
          `Expected URL to match **/rooms/${roomCode}/assignment but got ${playerPage.url()}`
      );
    }

    // Verify player sees song assignment view
    const playerYourSongHeader = playerPage.locator('h2:has-text("Your Song")');
    await expect(playerYourSongHeader).toBeVisible({ timeout: 5000 });
    console.log('Player sees "Your Song" header');

    // Success screenshot
    const successScreenshotPath = getArtifactsPath(TEST_NAME, 'player-on-assignment.png');
    await playerPage.screenshot({ path: successScreenshotPath, fullPage: true });

    // Cleanup
    await hostContext.close();
    await playerContext.close();

    console.log('\n=== TEST PASSED: WebSocket navigation works ===');
  });
});
