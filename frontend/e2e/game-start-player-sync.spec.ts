/**
 * Bug reproduction test: Non-host players don't auto-navigate when host starts game.
 *
 * EXPECTED: When host clicks 'Start Game', ALL players should automatically see
 * the song assignment view via WebSocket phase_changed event and state-driven navigation.
 *
 * This test verifies WebSocket-triggered state changes work for non-host players
 * via AppOrchestrator's state-driven view selection (no URL-based navigation).
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

  // Wait for RoomSelectionView (state-driven navigation - view switches fast after auth)
  // The success message may appear briefly but view changes quickly
  const createRoomButton = page.getByRole('button', { name: 'Create Room' });
  await expect(createRoomButton).toBeVisible({ timeout: 10000 });
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

  // Wait for RoomSelectionView (state-driven navigation - view switches fast after auth)
  const createRoomButton = page.getByRole('button', { name: 'Create Room' });
  await expect(createRoomButton).toBeVisible({ timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// Helper: Wait for RoomLobbyView (verify by room code display and players section)
async function waitForLobbyView(page: Page): Promise<string> {
  // Wait for room code display (4xl font bold with tracking)
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  const roomCode = await roomCodeDisplay.textContent() || '';

  // Verify players section exists
  const playersSection = page.locator('h3:has-text("Players")');
  await expect(playersSection).toBeVisible({ timeout: 5000 });

  return roomCode.trim();
}

// Helper: Wait for SongAssignmentView (verify by "Your Song" header)
async function waitForSongAssignmentView(page: Page): Promise<void> {
  const yourSongHeader = page.locator('h2:has-text("Your Song")');
  await expect(yourSongHeader).toBeVisible({ timeout: 10000 });
}

test.describe('Game Start Player Sync Bug Reproduction', () => {
  test('Non-host players should auto-navigate to song assignment when host starts game', async ({
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

    // Host: Wait for RoomLobbyView and get room code
    const roomCode = await waitForLobbyView(hostPage);
    console.log(`Room created with code: ${roomCode}`);

    // Host: Navigate to song picker and add songs
    const pickSongsButton = hostPage.getByRole('button', { name: 'Pick Songs' });
    await expect(pickSongsButton).toBeVisible({ timeout: 5000 });
    await pickSongsButton.click();

    // Wait for SongPickerView (this still uses URL routing)
    await hostPage.waitForLoadState('networkidle');

    // Host: Search for songs using search input
    const searchInput = hostPage.locator('input[type="search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('chic');

    // Wait for search results to load
    await hostPage.waitForSelector('.max-h-80 button', { timeout: 10000 });

    // Select first track from search results
    const trackButtons = hostPage.locator('.max-h-80 button');
    await trackButtons.nth(0).click();

    // Wait for first track to be selected
    await hostPage.waitForSelector('text=Selected Songs (1/2)', { timeout: 5000 });
    console.log('First song selected');

    // Select second track from search results
    await trackButtons.nth(1).click();

    // Wait for second track to be selected
    await hostPage.waitForSelector('text=Selected Songs (2/2)', { timeout: 5000 });
    console.log('Second song selected');

    // Click 'Add Song Pair' button
    const addButton = hostPage.getByRole('button', { name: 'Add Song Pair' });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
    await addButton.click();

    // Wait for success message
    const successMessage = hostPage.locator('.bg-green-900\\/30');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    await expect(successMessage).toContainText('Added');
    console.log('Song pair added');

    // Return to lobby
    const backButton = hostPage.getByRole('button', { name: 'Back to Lobby' });
    await backButton.click();

    // Wait for RoomLobbyView to appear again
    await waitForLobbyView(hostPage);
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

    // Player: Wait for RoomLobbyView
    await waitForLobbyView(playerPage);
    console.log('Player joined room and is in lobby');

    // Verify WebSocket connected for player (check for player list)
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

    // Host: Verify transition to SongAssignmentView (state-driven)
    await waitForSongAssignmentView(hostPage);
    console.log('Host sees song assignment view (via HTTP response + store update)');

    // ========================================================================
    // BUG ASSERTION: Player should auto-transition via WebSocket phase_changed
    // This is the critical test - player should see assignment WITHOUT manual action
    // ========================================================================
    console.log('\n=== BUG ASSERTION: Player should auto-navigate ===');

    // Wait for player to auto-transition to SongAssignmentView via WebSocket
    // This should happen within a few seconds if WebSocket event is received and handled
    try {
      await waitForSongAssignmentView(playerPage);
      console.log('SUCCESS: Player auto-navigated to song assignment via WebSocket');
    } catch (error) {
      // Take screenshot showing player is still on lobby
      const failScreenshotPath = getArtifactsPath(TEST_NAME, 'player-stuck-on-lobby.png');
      await playerPage.screenshot({ path: failScreenshotPath, fullPage: true });
      console.log(`BUG CONFIRMED: Player stuck on lobby. Screenshot: ${failScreenshotPath}`);
      throw new Error(
        `BUG: Player did not auto-navigate to song assignment view. ` +
          `Expected to see "Your Song" header but player appears stuck on lobby.`
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
