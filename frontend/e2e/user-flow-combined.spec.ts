// Combined host+player+guest E2E test: All roles exercise full flows with parallel execution
// Uses browser.newContext() for separate browser contexts (host, player, and guest)
// Screenshots: user-flow-combined/host-*.png, user-flow-combined/player-*.png, and user-flow-combined/guest-*.png
import { test, expect, getArtifactsPath, getBaselinePath, getBaselineScreenshots, compareScreenshots } from './fixtures';
import type { Browser, Page, BrowserContext } from '@playwright/test';

// Port configuration: Use environment variables or feature branch defaults (9000/9100)
// Main branch uses 8000/3000, feature branches use 9000/9100 to avoid conflicts
const BACKEND_PORT = process.env.PORT || '9000';
const FRONTEND_PORT = process.env.VITE_PORT || '9100';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const TEST_NAME = 'user-flow-combined';

// ============================================================================
// Shared Helpers (consolidated from host and player tests)
// ============================================================================

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

// Helper: Mark players as ready via REST API
async function markPlayersReadyViaAPI(roomCode: string, playerIds: string[]): Promise<void> {
  for (const playerId of playerIds) {
    const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to mark player ${playerId} ready: ${await response.text()}`);
    }
    console.log(`Marked player ${playerId} as ready via API`);
  }
}

// Helper: Add a player to room via REST API
async function addPlayerViaAPI(roomCode: string, playerId: string, displayName: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: playerId,
      display_name: displayName,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add player ${playerId}: ${await response.text()}`);
  }
  console.log(`Added player ${displayName} (${playerId})`);
}

// Helper: Cast vote via REST API
async function castVoteViaAPI(roomCode: string, voterId: string, guessedId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: voterId,
      guessed_player_id: guessedId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cast vote for ${voterId}: ${await response.text()}`);
  }
  console.log(`Player ${voterId} voted for ${guessedId}`);
}

// Helper: Leave room via REST API
async function leaveRoomViaAPI(roomCode: string, playerId: string): Promise<{ room_deleted: boolean; room: unknown }> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/leave`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: playerId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to leave room for ${playerId}: ${await response.text()}`);
  }
  const data = await response.json();
  console.log(`Player ${playerId} left room ${roomCode}, room_deleted: ${data.room_deleted}`);
  return data;
}

// ============================================================================
// Host-specific Helpers
// ============================================================================

// Helper: Create room with deterministic code (310)
async function createRoom(page: Page): Promise<string> {
  // Mock Math.random for deterministic room code
  await page.evaluate(() => {
    Math.random = () => 0.234; // Math.floor(100 + 0.234 * 900) = 310
  });

  const createRoomButton = page.getByRole('button', { name: 'Create Room' });
  await expect(createRoomButton).toBeVisible();
  await expect(createRoomButton).toBeEnabled();
  await createRoomButton.click();

  // Wait for RoomLobbyView (state-driven navigation)
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Verify host badge
  const hostBadge = page.locator('text=Host').first();
  await expect(hostBadge).toBeVisible();

  return '310';
}

// Helper: Navigate to song picker, select two songs as a pair, add pair, go back to lobby
async function addSongs(page: Page, rolePrefix: string): Promise<{ name: string; path: string }[]> {
  const screenshots: { name: string; path: string }[] = [];

  // Click 'Pick Songs' button to navigate to song picker
  const pickSongsButton = page.getByRole('button', { name: 'Pick Songs' });
  await expect(pickSongsButton).toBeVisible();
  await pickSongsButton.click();

  // Wait for SongPickerView (still uses URL routing for now)
  await page.waitForLoadState('networkidle');

  // Screenshot: Empty song picker
  const emptyPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-04-song-picker-empty.png`);
  await page.screenshot({ path: emptyPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-04-song-picker-empty.png`, path: emptyPath });
  console.log(`Screenshot saved: ${emptyPath}`);

  // Search for tracks using the search input (use 'chic' to match Chic's "Le Freak" and "Good Times")
  const searchInput = page.locator('input[type="search"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('chic');

  // Wait for search results to load
  await page.waitForSelector('.max-h-80 button', { timeout: 10000 });

  // Select first track from search results
  const trackButtons = page.locator('.max-h-80 button');
  await trackButtons.nth(0).click();

  // Wait for first track to be selected (shown in Selected Songs section)
  await page.waitForSelector('text=Selected Songs (1/2)', { timeout: 5000 });
  console.log('First song selected');

  // Select second track from search results
  await trackButtons.nth(1).click();

  // Wait for second track to be selected
  await page.waitForSelector('text=Selected Songs (2/2)', { timeout: 5000 });
  console.log('Second song selected');

  // Screenshot: Song picker with both songs selected
  const generatedPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-05-song-picker-generated.png`);
  await page.screenshot({ path: generatedPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-05-song-picker-generated.png`, path: generatedPath });
  console.log(`Screenshot saved: ${generatedPath}`);

  // Click 'Add Song Pair' button
  const addButton = page.getByRole('button', { name: 'Add Song Pair' });
  await expect(addButton).toBeVisible();
  await expect(addButton).toBeEnabled();
  await addButton.click();

  // Wait for success message for song pair
  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 5000 });
  await expect(successMessage).toContainText('Added');
  console.log('Song pair added');

  // Screenshot: Song picker with success message after adding pair
  const savedPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-06-song-picker-saved.png`);
  await page.screenshot({ path: savedPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-06-song-picker-saved.png`, path: savedPath });
  console.log(`Screenshot saved: ${savedPath}`);

  // Click 'Back to Lobby' button (no auto-redirect anymore)
  const backButton = page.getByRole('button', { name: 'Back to Lobby' });
  await expect(backButton).toBeVisible();
  await backButton.click();

  // Wait for RoomLobbyView (state-driven navigation)
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 5000 });
  await page.waitForLoadState('networkidle');

  return screenshots;
}

// ============================================================================
// Player-specific Helpers
// ============================================================================

// Helper: Join room via UI by entering room code
async function joinRoomViaUI(page: Page, roomCode: string): Promise<void> {
  // Find the room code input
  const roomCodeInput = page.locator('#room-code');
  await expect(roomCodeInput).toBeVisible();

  // Enter the room code
  await roomCodeInput.fill(roomCode);

  // Click Join Room button
  const joinButton = page.getByRole('button', { name: 'Join Room' });
  await expect(joinButton).toBeVisible();
  await joinButton.click();

  // Wait for RoomLobbyView (state-driven navigation)
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await expect(roomCodeDisplay).toContainText(roomCode);
  await page.waitForLoadState('networkidle');
}

// Helper: Verify player is in lobby as non-host
async function verifyPlayerInLobby(page: Page, roomCode: string): Promise<void> {
  // Verify room code is displayed
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible();
  await expect(roomCodeDisplay).toContainText(roomCode);

  // Verify "Start Game" button is NOT visible (only host sees it)
  const startButton = page.getByRole('button', { name: 'Start Game' });
  await expect(startButton).not.toBeVisible();

  // Verify Leave button is visible
  const leaveButton = page.getByRole('button', { name: 'Leave' });
  await expect(leaveButton).toBeVisible();

  console.log('✅ Player verified in lobby (no Start Game button)');
}

// ============================================================================
// Screenshot Collection Types
// ============================================================================

interface ScreenshotCollector {
  hostScreenshots: { name: string; path: string }[];
  playerScreenshots: { name: string; path: string }[];
  guestScreenshots: { name: string; path: string }[];
}

// ============================================================================
// Combined Test
// ============================================================================

test.describe('Combined Host+Player+Guest User Flow: Real Multi-User Interaction', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('host creates room, player and guest join, all see game flow with screenshot verification', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext; // Required to trigger fixture - starts servers
    const collector: ScreenshotCollector = { hostScreenshots: [], playerScreenshots: [], guestScreenshots: [] };

    // Reset test user counter for deterministic player names in screenshots
    await fetch(`${BACKEND_URL}/api/testing/reset-user-counter`, { method: 'POST' });
    console.log('✅ Reset test user counter for deterministic names');

    // Create separate browser contexts for host, player, and guest
    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();
    const guestPage: Page = await guestContext.newPage();

    try {
      // ========================================================================
      // PHASE 1: Host creates room
      // ========================================================================
      console.log('\n=== PHASE 1: Host creates room ===');

      // Host: Load landing page
      await loadLandingPage(hostPage);
      const hostLandingPath = getArtifactsPath(TEST_NAME, 'host-01-landing.png');
      await hostPage.screenshot({ path: hostLandingPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-01-landing.png', path: hostLandingPath });
      console.log(`Host screenshot: ${hostLandingPath}`);

      // Host: Login with Spotify
      await loginWithSpotify(hostPage);
      const hostRoomSelectionPath = getArtifactsPath(TEST_NAME, 'host-02-room-selection.png');
      await hostPage.screenshot({ path: hostRoomSelectionPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-02-room-selection.png', path: hostRoomSelectionPath });
      console.log(`Host screenshot: ${hostRoomSelectionPath}`);

      // Host: Create room (310)
      const roomCode = await createRoom(hostPage);
      console.log(`✅ Host created room: ${roomCode}`);

      const hostLobbyPath = getArtifactsPath(TEST_NAME, 'host-03-room-lobby.png');
      await hostPage.screenshot({ path: hostLobbyPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-03-room-lobby.png', path: hostLobbyPath });
      console.log(`Host screenshot: ${hostLobbyPath}`);

      // Host: Add song pair
      const songPairScreenshots = await addSongs(hostPage, 'host');
      collector.hostScreenshots.push(...songPairScreenshots);

      // ========================================================================
      // PHASE 2: Player joins the room created by host
      // ========================================================================
      console.log('\n=== PHASE 2: Player joins room ===');

      // Player: Load landing page
      await loadLandingPage(playerPage);
      const playerLandingPath = getArtifactsPath(TEST_NAME, 'player-01-landing.png');
      await playerPage.screenshot({ path: playerLandingPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-01-landing.png', path: playerLandingPath });
      console.log(`Player screenshot: ${playerLandingPath}`);

      // Player: Login with Spotify
      await loginWithSpotify(playerPage);
      const playerRoomSelectionPath = getArtifactsPath(TEST_NAME, 'player-02-room-selection.png');
      await playerPage.screenshot({ path: playerRoomSelectionPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-02-room-selection.png', path: playerRoomSelectionPath });
      console.log(`Player screenshot: ${playerRoomSelectionPath}`);

      // Player: Join room via UI
      await joinRoomViaUI(playerPage, roomCode);
      const playerLobbyPath = getArtifactsPath(TEST_NAME, 'player-03-player-lobby.png');
      await playerPage.screenshot({ path: playerLobbyPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-03-player-lobby.png', path: playerLobbyPath });
      console.log(`Player screenshot: ${playerLobbyPath}`);

      // Verify player is in lobby as non-host
      await verifyPlayerInLobby(playerPage, roomCode);

      // ========================================================================
      // PHASE 2b: Guest joins room (non-Spotify user)
      // ========================================================================
      console.log('\n=== PHASE 2b: Guest joins room ===');

      // Guest: Load landing page
      await loadLandingPage(guestPage);
      const guestLandingPath = getArtifactsPath(TEST_NAME, 'guest-01-landing.png');
      await guestPage.screenshot({ path: guestLandingPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-01-landing.png', path: guestLandingPath });
      console.log(`Guest screenshot: ${guestLandingPath}`);

      // Guest: Login as guest (non-Spotify)
      await loginAsGuest(guestPage, 'Guest Player');
      const guestRoomSelectionPath = getArtifactsPath(TEST_NAME, 'guest-02-room-selection.png');
      await guestPage.screenshot({ path: guestRoomSelectionPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-02-room-selection.png', path: guestRoomSelectionPath });
      console.log(`Guest screenshot: ${guestRoomSelectionPath}`);

      // Guest: Join room via UI
      await joinRoomViaUI(guestPage, roomCode);
      const guestLobbyPath = getArtifactsPath(TEST_NAME, 'guest-03-player-lobby.png');
      await guestPage.screenshot({ path: guestLobbyPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-03-player-lobby.png', path: guestLobbyPath });
      console.log(`Guest screenshot: ${guestLobbyPath}`);

      // Verify guest is in lobby as non-host
      await verifyPlayerInLobby(guestPage, roomCode);

      // Verify guest does NOT see Pick Songs button (guest limitation)
      const guestPickSongsButton = guestPage.getByRole('button', { name: 'Pick Songs' });
      await expect(guestPickSongsButton).not.toBeVisible();
      console.log('✅ Guest does NOT see Pick Songs button (as expected for non-Spotify user)');

      // ========================================================================
      // PHASE 3: Add fourth player via API, all see updated lobby
      // ========================================================================
      console.log('\n=== PHASE 3: Fourth player joins ===');

      // Add player-3 via API
      await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

      // Host: Refresh and see all players (4 total: host, player, guest, player-3)
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      await hostPage.waitForSelector('ul.space-y-3 li:nth-child(4)', { timeout: 5000 });

      const hostFourPlayersPath = getArtifactsPath(TEST_NAME, 'host-07-lobby-four-players.png');
      await hostPage.screenshot({ path: hostFourPlayersPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-07-lobby-four-players.png', path: hostFourPlayersPath });
      console.log(`Host screenshot: ${hostFourPlayersPath}`);

      // Verify 4 players in host view
      const hostPlayerCount = await hostPage.locator('ul.space-y-3 li').count();
      expect(hostPlayerCount).toBe(4);
      console.log(`✅ Host sees ${hostPlayerCount} players in lobby`);

      // Player: Refresh and see all players
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerPage.waitForSelector('ul.space-y-3 li:nth-child(3)', { timeout: 5000 });

      const playerMultiplePath = getArtifactsPath(TEST_NAME, 'player-04-lobby-multiple-players.png');
      await playerPage.screenshot({ path: playerMultiplePath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-04-lobby-multiple-players.png', path: playerMultiplePath });
      console.log(`Player screenshot: ${playerMultiplePath}`);

      // Verify multiple players visible from player's view
      const playerPlayerCount = await playerPage.locator('ul.space-y-3 li').count();
      expect(playerPlayerCount).toBeGreaterThanOrEqual(3);
      console.log(`✅ Player sees ${playerPlayerCount} players in lobby`);

      // Guest: Refresh and see all players
      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');
      await guestPage.waitForSelector('ul.space-y-3 li:nth-child(3)', { timeout: 5000 });

      const guestMultiplePath = getArtifactsPath(TEST_NAME, 'guest-04-lobby-multiple-players.png');
      await guestPage.screenshot({ path: guestMultiplePath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-04-lobby-multiple-players.png', path: guestMultiplePath });
      console.log(`Guest screenshot: ${guestMultiplePath}`);

      // Verify multiple players visible from guest's view
      const guestPlayerCount = await guestPage.locator('ul.space-y-3 li').count();
      expect(guestPlayerCount).toBeGreaterThanOrEqual(3);
      console.log(`✅ Guest sees ${guestPlayerCount} players in lobby`);

      // ========================================================================
      // PHASE 4: Host starts game, all see assignment
      // ========================================================================
      console.log('\n=== PHASE 4: Host starts game ===');

      // Host: Click Start Game button
      const startButton = hostPage.getByRole('button', { name: 'Start Game' });
      await expect(startButton).toBeVisible({ timeout: 5000 });
      await startButton.click();

      // Host: Wait for SongAssignmentView (state-driven navigation)
      const hostYourSongHeader = hostPage.locator('h2:has-text("Your Song")');
      await expect(hostYourSongHeader).toBeVisible({ timeout: 10000 });
      await hostPage.waitForLoadState('networkidle');
      console.log('✅ Host sees song assignment view');

      const hostSongTitle = hostPage.locator('h3.text-2xl.font-bold');
      await expect(hostSongTitle).toBeVisible();
      const hostTitleText = await hostSongTitle.textContent();
      expect(hostTitleText).not.toBe('Unknown Song');
      console.log(`✅ Host song: ${hostTitleText}`);

      const hostGameStartedPath = getArtifactsPath(TEST_NAME, 'host-08-game-started.png');
      await hostPage.screenshot({ path: hostGameStartedPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-08-game-started.png', path: hostGameStartedPath });
      console.log(`Host screenshot: ${hostGameStartedPath}`);

      // Player: Reload to get client_state from backend (triggers state-driven view)
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Player: Verify song assignment view
      const playerYourSongHeader = playerPage.locator('h2:has-text("Your Song")');
      await expect(playerYourSongHeader).toBeVisible({ timeout: 5000 });

      const playerSongTitle = playerPage.locator('h3.text-2xl.font-bold');
      await expect(playerSongTitle).toBeVisible();
      const playerTitleText = await playerSongTitle.textContent();
      console.log(`✅ Player song: ${playerTitleText}`);

      const playerAssignmentPath = getArtifactsPath(TEST_NAME, 'player-05-song-assignment.png');
      await playerPage.screenshot({ path: playerAssignmentPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-05-song-assignment.png', path: playerAssignmentPath });
      console.log(`Player screenshot: ${playerAssignmentPath}`);

      // Guest: Reload to get client_state from backend (triggers state-driven view)
      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');

      // Guest: Verify song assignment view
      const guestYourSongHeader = guestPage.locator('h2:has-text("Your Song")');
      await expect(guestYourSongHeader).toBeVisible({ timeout: 5000 });

      const guestSongTitle = guestPage.locator('h3.text-2xl.font-bold');
      await expect(guestSongTitle).toBeVisible();
      const guestTitleText = await guestSongTitle.textContent();
      console.log(`✅ Guest song: ${guestTitleText}`);

      const guestAssignmentPath = getArtifactsPath(TEST_NAME, 'guest-05-song-assignment.png');
      await guestPage.screenshot({ path: guestAssignmentPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-05-song-assignment.png', path: guestAssignmentPath });
      console.log(`Guest screenshot: ${guestAssignmentPath}`);

      // Verify room status via API
      const roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const roomData = await roomResponse.json();
      expect(roomData.status).toBe('song_selection');
      console.log(`✅ Room status: ${roomData.status}`);

      // Security: Verify incognito identity NOT exposed
      expect(roomData.current_round?.incognito_player_id).toBeUndefined();
      console.log('✅ Security: incognito identity NOT exposed');

      // ========================================================================
      // PHASE 5: All click ready, navigate to playback
      // ========================================================================
      console.log('\n=== PHASE 5: All players ready ===');

      // Host: Click "I'm Ready!"
      const hostReadyButton = hostPage.getByRole('button', { name: "I'm Ready!" });
      await expect(hostReadyButton).toBeVisible();
      await hostReadyButton.click();
      console.log('✅ Host clicked Ready');

      await expect(hostReadyButton).not.toBeVisible({ timeout: 2000 });
      const hostReadyClickedPath = getArtifactsPath(TEST_NAME, 'host-09-ready-clicked.png');
      await hostPage.screenshot({ path: hostReadyClickedPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-09-ready-clicked.png', path: hostReadyClickedPath });

      // Player: Click "I'm Ready!"
      const playerReadyButton = playerPage.getByRole('button', { name: "I'm Ready!" });
      await expect(playerReadyButton).toBeVisible();
      await playerReadyButton.click();
      console.log('✅ Player clicked Ready');

      await expect(playerReadyButton).not.toBeVisible({ timeout: 2000 });
      const playerReadyClickedPath = getArtifactsPath(TEST_NAME, 'player-06-ready-clicked.png');
      await playerPage.screenshot({ path: playerReadyClickedPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-06-ready-clicked.png', path: playerReadyClickedPath });

      // Guest: Click "I'm Ready!"
      const guestReadyButton = guestPage.getByRole('button', { name: "I'm Ready!" });
      await expect(guestReadyButton).toBeVisible();
      await guestReadyButton.click();
      console.log('✅ Guest clicked Ready');

      await expect(guestReadyButton).not.toBeVisible({ timeout: 2000 });
      const guestReadyClickedPath = getArtifactsPath(TEST_NAME, 'guest-06-ready-clicked.png');
      await guestPage.screenshot({ path: guestReadyClickedPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-06-ready-clicked.png', path: guestReadyClickedPath });

      // Mark player-3 ready via API
      await markPlayersReadyViaAPI(roomCode, ['player-3']);

      // Screenshot all after all ready
      const hostAllReadyPath = getArtifactsPath(TEST_NAME, 'host-10-all-players-ready.png');
      await hostPage.screenshot({ path: hostAllReadyPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-10-all-players-ready.png', path: hostAllReadyPath });

      const playerAllReadyPath = getArtifactsPath(TEST_NAME, 'player-07-all-players-ready.png');
      await playerPage.screenshot({ path: playerAllReadyPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-07-all-players-ready.png', path: playerAllReadyPath });

      const guestAllReadyPath = getArtifactsPath(TEST_NAME, 'guest-07-all-players-ready.png');
      await guestPage.screenshot({ path: guestAllReadyPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-07-all-players-ready.png', path: guestAllReadyPath });

      // ========================================================================
      // PHASE 6: All navigate to playback view
      // ========================================================================
      console.log('\n=== PHASE 6: Navigate to playback ===');

      // Refresh all to trigger state-driven navigation to GameView
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      // Wait for GameView (Round In Progress header)
      const hostRoundHeaderPhase6 = hostPage.locator('h2:has-text("Round In Progress")');
      await expect(hostRoundHeaderPhase6).toBeVisible({ timeout: 10000 });
      console.log('✅ Host sees game playing view');

      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      const playerRoundHeaderPhase6 = playerPage.locator('h2:has-text("Round In Progress")');
      await expect(playerRoundHeaderPhase6).toBeVisible({ timeout: 10000 });
      console.log('✅ Player sees game playing view');

      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');
      const guestRoundHeaderPhase6 = guestPage.locator('h2:has-text("Round In Progress")');
      await expect(guestRoundHeaderPhase6).toBeVisible({ timeout: 10000 });
      console.log('✅ Guest sees game playing view');

      // Verify host is on GameView
      const hostRoundHeader = hostPage.locator('h2:has-text("Round In Progress")');
      await expect(hostRoundHeader).toBeVisible({ timeout: 5000 });
      const hostTimer = hostPage.locator('p.text-6xl.font-bold');
      await expect(hostTimer).toBeVisible();
      const hostTimerText = await hostTimer.textContent();
      expect(hostTimerText).toMatch(/\d{2}:\d{2}/);
      console.log(`✅ Host timer: ${hostTimerText}`);

      const hostMusicPlayingPath = getArtifactsPath(TEST_NAME, 'host-11-music-playing.png');
      await hostPage.screenshot({ path: hostMusicPlayingPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-11-music-playing.png', path: hostMusicPlayingPath });

      // Verify player is on GameView
      const playerRoundHeader = playerPage.locator('h2:has-text("Round In Progress")');
      await expect(playerRoundHeader).toBeVisible({ timeout: 5000 });
      const playerTimer = playerPage.locator('p.text-6xl.font-bold');
      await expect(playerTimer).toBeVisible();
      const playerTimerText = await playerTimer.textContent();
      expect(playerTimerText).toMatch(/\d{2}:\d{2}/);
      console.log(`✅ Player timer: ${playerTimerText}`);

      const playerMusicPlayingPath = getArtifactsPath(TEST_NAME, 'player-08-music-playing.png');
      await playerPage.screenshot({ path: playerMusicPlayingPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-08-music-playing.png', path: playerMusicPlayingPath });

      // Verify guest is on GameView
      const guestRoundHeader = guestPage.locator('h2:has-text("Round In Progress")');
      await expect(guestRoundHeader).toBeVisible({ timeout: 5000 });
      const guestTimer = guestPage.locator('p.text-6xl.font-bold');
      await expect(guestTimer).toBeVisible();
      const guestTimerText = await guestTimer.textContent();
      expect(guestTimerText).toMatch(/\d{2}:\d{2}/);
      console.log(`✅ Guest timer: ${guestTimerText}`);

      const guestMusicPlayingPath = getArtifactsPath(TEST_NAME, 'guest-08-music-playing.png');
      await guestPage.screenshot({ path: guestMusicPlayingPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-08-music-playing.png', path: guestMusicPlayingPath });

      // Verify MusicPlayerBar visible for all
      const hostMusicBar = hostPage.locator('.backdrop-blur-sm.border-t');
      await expect(hostMusicBar).toBeVisible();
      const playerMusicBar = playerPage.locator('.backdrop-blur-sm.border-t');
      await expect(playerMusicBar).toBeVisible();
      const guestMusicBar = guestPage.locator('.backdrop-blur-sm.border-t');
      await expect(guestMusicBar).toBeVisible();
      console.log('✅ MusicPlayerBar visible for all');

      // Verify room status is 'playing'
      const playingRoomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const playingRoomData = await playingRoomResponse.json();
      expect(playingRoomData.status).toBe('playing');
      console.log(`✅ Room status: ${playingRoomData.status}`);

      // ========================================================================
      // PHASE 7: Transition to guess phase (first vote triggers playing→guessing), cast votes
      // ========================================================================
      console.log('\n=== PHASE 7: Transition to guess phase, cast votes ===');

      // Fetch room to get all player IDs for distributed voting strategy
      const guessingRoomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const guessingRoomData = await guessingRoomResponse.json();
      const allPlayers = guessingRoomData.players;

      // Find player-3's ID and other players for voting strategy
      const player3 = allPlayers.find((p: { id: string }) => p.id === 'player-3');
      const otherPlayers = allPlayers.filter((p: { id: string }) => p.id !== 'player-3');

      // Strategy: Distribute votes to guarantee at least one correct guess
      // With 4 players (host, player, guest, player-3), distribute votes across different targets
      const hostTarget = otherPlayers[0]; // Host votes for browser player
      const playerTarget = player3; // Player votes for Player Three
      const guestTarget = otherPlayers[1] || otherPlayers[0]; // Guest votes for another player
      const player3Target = otherPlayers[2] || otherPlayers[0]; // player-3 votes for remaining player

      console.log(`Voting strategy: Host -> ${hostTarget.display_name}, Player -> ${playerTarget.display_name}, Guest -> ${guestTarget.display_name}, player-3 -> ${player3Target.display_name}`);

      // First vote via API triggers playing→guessing transition
      // Use player-3 so browser players can still vote via UI
      await castVoteViaAPI(roomCode, 'player-3', player3Target.id);
      console.log(`✅ Player-3 voted via API for ${player3Target.display_name} (triggers playing→guessing)`);

      // Reload all pages to pick up guessing state and show GuessingView
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      const hostGuessHeader = hostPage.locator('h2:has-text("Who Is The Dancer Incognito?")');
      await expect(hostGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Host on guess page');

      const hostGuessPath = getArtifactsPath(TEST_NAME, 'host-12-guess-page.png');
      await hostPage.screenshot({ path: hostGuessPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-12-guess-page.png', path: hostGuessPath });
      console.log(`Host screenshot: ${hostGuessPath}`);

      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      const playerGuessHeader = playerPage.locator('h2:has-text("Who Is The Dancer Incognito?")');
      await expect(playerGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Player on guess page');

      const playerGuessPath = getArtifactsPath(TEST_NAME, 'player-09-guess-page.png');
      await playerPage.screenshot({ path: playerGuessPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-09-guess-page.png', path: playerGuessPath });
      console.log(`Player screenshot: ${playerGuessPath}`);

      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');
      const guestGuessHeader = guestPage.locator('h2:has-text("Who Is The Dancer Incognito?")');
      await expect(guestGuessHeader).toBeVisible({ timeout: 10000 });
      console.log('✅ Guest on guess page');

      const guestGuessPath = getArtifactsPath(TEST_NAME, 'guest-09-guess-page.png');
      await guestPage.screenshot({ path: guestGuessPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-09-guess-page.png', path: guestGuessPath });
      console.log(`Guest screenshot: ${guestGuessPath}`);

      // Host: Cast vote for the browser player (distributed voting)
      const hostVoteButton = hostPage.getByRole('button', { name: `Guess ${hostTarget.display_name}` });
      await expect(hostVoteButton).toBeVisible();
      await hostVoteButton.click();
      await hostPage.waitForSelector('.bg-green-900\\/30', { timeout: 5000 });
      console.log(`✅ Host cast vote for ${hostTarget.display_name}`);

      const hostVoteCastPath = getArtifactsPath(TEST_NAME, 'host-13-vote-cast.png');
      await hostPage.screenshot({ path: hostVoteCastPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-13-vote-cast.png', path: hostVoteCastPath });
      console.log(`Host screenshot: ${hostVoteCastPath}`);

      // Host: Verify vote buttons are disabled after voting
      const hostDisabledButtons = hostPage.locator('button:has-text("Voted"), button:has-text("Your Vote")');
      const hostDisabledCount = await hostDisabledButtons.count();
      expect(hostDisabledCount).toBeGreaterThan(0);
      const firstHostDisabledButton = hostDisabledButtons.first();
      await expect(firstHostDisabledButton).toBeDisabled();
      console.log(`✅ Host vote buttons disabled (${hostDisabledCount} buttons showing voted state)`);

      const hostDisabledButtonsPath = getArtifactsPath(TEST_NAME, 'host-13b-vote-buttons-disabled.png');
      await hostPage.screenshot({ path: hostDisabledButtonsPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-13b-vote-buttons-disabled.png', path: hostDisabledButtonsPath });
      console.log(`Host screenshot: ${hostDisabledButtonsPath}`);

      // Player: Cast vote for Player Three (distributed voting)
      const playerVoteButton = playerPage.getByRole('button', { name: `Guess ${playerTarget.display_name}` });
      await expect(playerVoteButton).toBeVisible();
      await playerVoteButton.click();
      await playerPage.waitForSelector('.bg-green-900\\/30', { timeout: 5000 });
      console.log(`✅ Player cast vote for ${playerTarget.display_name}`);

      const playerVoteCastPath = getArtifactsPath(TEST_NAME, 'player-10-vote-cast.png');
      await playerPage.screenshot({ path: playerVoteCastPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-10-vote-cast.png', path: playerVoteCastPath });
      console.log(`Player screenshot: ${playerVoteCastPath}`);

      // Player: Verify vote buttons are disabled after voting
      const playerDisabledButtons = playerPage.locator('button:has-text("Voted"), button:has-text("Your Vote")');
      const playerDisabledCount = await playerDisabledButtons.count();
      expect(playerDisabledCount).toBeGreaterThan(0);
      const firstPlayerDisabledButton = playerDisabledButtons.first();
      await expect(firstPlayerDisabledButton).toBeDisabled();
      console.log(`✅ Player vote buttons disabled (${playerDisabledCount} buttons showing voted state)`);

      const playerDisabledButtonsPath = getArtifactsPath(TEST_NAME, 'player-10b-vote-buttons-disabled.png');
      await playerPage.screenshot({ path: playerDisabledButtonsPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-10b-vote-buttons-disabled.png', path: playerDisabledButtonsPath });
      console.log(`Player screenshot: ${playerDisabledButtonsPath}`);

      // Guest: Cast vote (distributed voting) - this is the last vote, triggers guessing→results
      const guestVoteButton = guestPage.getByRole('button', { name: `Guess ${guestTarget.display_name}` });
      await expect(guestVoteButton).toBeVisible();
      await guestVoteButton.click();
      // Wait for either vote confirmation or results transition (last vote auto-transitions)
      await Promise.race([
        guestPage.waitForSelector('.bg-green-900\\/30', { timeout: 5000 }),
        guestPage.waitForSelector('.bg-disco-pink\\/20', { timeout: 5000 }), // Results view indicator
      ]);
      console.log(`✅ Guest cast vote for ${guestTarget.display_name}`);

      const guestVoteCastPath = getArtifactsPath(TEST_NAME, 'guest-10-vote-cast.png');
      await guestPage.screenshot({ path: guestVoteCastPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-10-vote-cast.png', path: guestVoteCastPath });
      console.log(`Guest screenshot: ${guestVoteCastPath}`);

      // Guest: After last vote, may transition to results immediately (skip disabled button check)
      // Check if still on GuessingView by looking for the header
      const guestStillOnGuessing = await guestPage.locator('h2:has-text("Who Is The Dancer Incognito?")').isVisible();
      if (guestStillOnGuessing) {
        const guestDisabledButtons = guestPage.locator('button:has-text("Voted"), button:has-text("Your Vote")');
        const guestDisabledCount = await guestDisabledButtons.count();
        expect(guestDisabledCount).toBeGreaterThan(0);
        const firstGuestDisabledButton = guestDisabledButtons.first();
        await expect(firstGuestDisabledButton).toBeDisabled();
        console.log(`✅ Guest vote buttons disabled (${guestDisabledCount} buttons showing voted state)`);

        const guestDisabledButtonsPath = getArtifactsPath(TEST_NAME, 'guest-10b-vote-buttons-disabled.png');
        await guestPage.screenshot({ path: guestDisabledButtonsPath, fullPage: true });
        collector.guestScreenshots.push({ name: 'guest-10b-vote-buttons-disabled.png', path: guestDisabledButtonsPath });
        console.log(`Guest screenshot: ${guestDisabledButtonsPath}`);
      } else {
        console.log('✅ Guest already transitioned to results (last vote triggers transition)');
        // Still take a screenshot but with the results view
        const guestDisabledButtonsPath = getArtifactsPath(TEST_NAME, 'guest-10b-vote-buttons-disabled.png');
        await guestPage.screenshot({ path: guestDisabledButtonsPath, fullPage: true });
        collector.guestScreenshots.push({ name: 'guest-10b-vote-buttons-disabled.png', path: guestDisabledButtonsPath });
        console.log(`Guest screenshot (results view): ${guestDisabledButtonsPath}`);
      }

      // ========================================================================
      // PHASE 8: All votes cast triggers results phase, verify reveal
      // ========================================================================
      console.log('\n=== PHASE 8: Wait for results phase ===');

      // After all 4 votes are cast, room should auto-transition to results phase
      // Reload to pick up the new state (WebSocket would handle this in real usage)
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');

      // Wait for results to load via state-driven navigation
      await hostPage.waitForSelector('.bg-disco-pink\\/20', { timeout: 10000 });
      console.log('✅ Host on results page');

      // Verify Dancer Incognito revealed
      const hostIncognitoSection = hostPage.locator('.bg-disco-pink\\/20');
      await expect(hostIncognitoSection).toBeVisible();
      const hostIncognitoLabel = hostIncognitoSection.locator('h3:has-text("Dancer Incognito")');
      await expect(hostIncognitoLabel).toBeVisible();
      console.log('✅ Host sees Dancer Incognito revealed');

      // Verify votes displayed (4 votes: host, player, guest, player-3)
      const hostVotesHeader = hostPage.locator('h3:has-text("Votes")');
      await expect(hostVotesHeader).toBeVisible();
      const hostVoteItems = hostPage.locator('ul.space-y-2 li');
      await expect(hostVoteItems).toHaveCount(4);
      console.log('✅ Host sees all 4 votes displayed');

      const hostResultsPath = getArtifactsPath(TEST_NAME, 'host-14-results-page.png');
      await hostPage.screenshot({ path: hostResultsPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-14-results-page.png', path: hostResultsPath });
      console.log(`Host screenshot: ${hostResultsPath}`);

      // Host: Verify correct guessers have .text-green-400 highlighting
      // With distributed voting strategy, at least one player should have guessed correctly
      // Fetch results API to verify correct_guessers array
      const hostResultsApiResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/results`);
      const hostResultsApiData = await hostResultsApiResponse.json();
      const correctGuessersCount = hostResultsApiData.correct_guessers?.length ?? 0;
      console.log(`API: ${correctGuessersCount} correct guessers (incognito: ${hostResultsApiData.incognito_player_id})`);

      // With distributed voting, we should always have at least one correct guesser
      expect(correctGuessersCount).toBeGreaterThan(0);

      // Verify UI shows green highlighting for correct guessers
      const hostCorrectGuessers = hostPage.locator('.text-green-400');
      const hostCorrectCount = await hostCorrectGuessers.count();
      expect(hostCorrectCount).toBeGreaterThan(0);
      console.log(`✅ Host sees ${hostCorrectCount} correct guesser elements with text-green-400 highlighting`);

      const hostHighlightedPath = getArtifactsPath(TEST_NAME, 'host-14b-correct-guessers-highlighted.png');
      await hostPage.screenshot({ path: hostHighlightedPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-14b-correct-guessers-highlighted.png', path: hostHighlightedPath });
      console.log(`Host screenshot: ${hostHighlightedPath}`);

      // Player: Reload to get results state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      await playerPage.waitForSelector('.bg-disco-pink\\/20', { timeout: 10000 });
      console.log('✅ Player on results page');

      // Verify Dancer Incognito revealed from player perspective
      const playerIncognitoSection = playerPage.locator('.bg-disco-pink\\/20');
      await expect(playerIncognitoSection).toBeVisible();
      console.log('✅ Player sees Dancer Incognito revealed');

      const playerResultsPath = getArtifactsPath(TEST_NAME, 'player-11-results-page.png');
      await playerPage.screenshot({ path: playerResultsPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-11-results-page.png', path: playerResultsPath });
      console.log(`Player screenshot: ${playerResultsPath}`);

      // Player: Verify correct guessers have .text-green-400 highlighting
      const playerCorrectGuessers = playerPage.locator('.text-green-400');
      const playerCorrectCount = await playerCorrectGuessers.count();
      expect(playerCorrectCount).toBeGreaterThan(0);
      console.log(`✅ Player sees ${playerCorrectCount} correct guesser elements with text-green-400 highlighting`);

      const playerHighlightedPath = getArtifactsPath(TEST_NAME, 'player-11b-correct-guessers-highlighted.png');
      await playerPage.screenshot({ path: playerHighlightedPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-11b-correct-guessers-highlighted.png', path: playerHighlightedPath });
      console.log(`Player screenshot: ${playerHighlightedPath}`);

      // Guest: Reload to get results state
      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');

      await guestPage.waitForSelector('.bg-disco-pink\\/20', { timeout: 10000 });
      console.log('✅ Guest on results page');

      // Verify Dancer Incognito revealed from guest perspective
      const guestIncognitoSection = guestPage.locator('.bg-disco-pink\\/20');
      await expect(guestIncognitoSection).toBeVisible();
      console.log('✅ Guest sees Dancer Incognito revealed');

      const guestResultsPath = getArtifactsPath(TEST_NAME, 'guest-11-results-page.png');
      await guestPage.screenshot({ path: guestResultsPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-11-results-page.png', path: guestResultsPath });
      console.log(`Guest screenshot: ${guestResultsPath}`);

      // Guest: Verify correct guessers have .text-green-400 highlighting
      const guestCorrectGuessers = guestPage.locator('.text-green-400');
      const guestCorrectCount = await guestCorrectGuessers.count();
      expect(guestCorrectCount).toBeGreaterThan(0);
      console.log(`✅ Guest sees ${guestCorrectCount} correct guesser elements with text-green-400 highlighting`);

      const guestHighlightedPath = getArtifactsPath(TEST_NAME, 'guest-11b-correct-guessers-highlighted.png');
      await guestPage.screenshot({ path: guestHighlightedPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-11b-correct-guessers-highlighted.png', path: guestHighlightedPath });
      console.log(`Guest screenshot: ${guestHighlightedPath}`);

      // Verify room status is 'results'
      const resultsRoomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const resultsRoomData = await resultsRoomResponse.json();
      expect(resultsRoomData.status).toBe('results');
      console.log(`✅ Room status: ${resultsRoomData.status}`);

      // ========================================================================
      // PHASE 9: Host clicks Finish Round, all navigate to lobby
      // ========================================================================
      console.log('\n=== PHASE 9: Host finishes round ===');

      // Verify Finish Round button visible for host
      const finishButton = hostPage.getByRole('button', { name: 'Finish Round' });
      await expect(finishButton).toBeVisible();
      console.log('✅ Host sees Finish Round button');

      // Verify Finish Round button NOT visible for player
      const playerFinishButton = playerPage.getByRole('button', { name: 'Finish Round' });
      await expect(playerFinishButton).not.toBeVisible();
      console.log('✅ Player does NOT see Finish Round button');

      // Verify Finish Round button NOT visible for guest
      const guestFinishButton = guestPage.getByRole('button', { name: 'Finish Round' });
      await expect(guestFinishButton).not.toBeVisible();
      console.log('✅ Guest does NOT see Finish Round button');

      // Host: Click Finish Round
      await finishButton.click();
      console.log('✅ Host clicked Finish Round');

      // Host: Wait for RoomLobbyView (state-driven navigation)
      const hostLobbyRoomCode = hostPage.locator('.text-4xl.font-bold');
      await expect(hostLobbyRoomCode).toBeVisible({ timeout: 10000 });
      await expect(hostLobbyRoomCode).toContainText(roomCode);
      await hostPage.waitForLoadState('networkidle');
      console.log('✅ Host sees lobby view');

      const hostBackLobbyPath = getArtifactsPath(TEST_NAME, 'host-15-back-in-lobby.png');
      await hostPage.screenshot({ path: hostBackLobbyPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-15-back-in-lobby.png', path: hostBackLobbyPath });
      console.log(`Host screenshot: ${hostBackLobbyPath}`);

      // Player: Reload to get updated state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      // Wait for lobby view
      const playerLobbyRoomCode = playerPage.locator('.text-4xl.font-bold');
      await expect(playerLobbyRoomCode).toBeVisible({ timeout: 5000 });
      console.log('✅ Player sees lobby view');

      const playerBackLobbyPath = getArtifactsPath(TEST_NAME, 'player-12-back-in-lobby.png');
      await playerPage.screenshot({ path: playerBackLobbyPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-12-back-in-lobby.png', path: playerBackLobbyPath });
      console.log(`Player screenshot: ${playerBackLobbyPath}`);

      // Guest: Reload to get updated state
      await guestPage.reload();
      await guestPage.waitForLoadState('networkidle');
      // Wait for lobby view
      const guestLobbyRoomCode = guestPage.locator('.text-4xl.font-bold');
      await expect(guestLobbyRoomCode).toBeVisible({ timeout: 5000 });
      console.log('✅ Guest sees lobby view');

      const guestBackLobbyPath = getArtifactsPath(TEST_NAME, 'guest-12-back-in-lobby.png');
      await guestPage.screenshot({ path: guestBackLobbyPath, fullPage: true });
      collector.guestScreenshots.push({ name: 'guest-12-back-in-lobby.png', path: guestBackLobbyPath });
      console.log(`Guest screenshot: ${guestBackLobbyPath}`);

      // ========================================================================
      // PHASE 10: Verify lobby state - room status, song pair removed, Start Game visibility
      // ========================================================================
      console.log('\n=== PHASE 10: Verify lobby state ===');

      // Verify room status is 'lobby'
      const finalRoomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const finalRoomData = await finalRoomResponse.json();
      expect(finalRoomData.status).toBe('lobby');
      console.log(`✅ Room status: ${finalRoomData.status}`);

      // Verify used songs were removed (started with 2, should have 0 after using both)
      expect(finalRoomData.songs.length).toBe(0);
      console.log(`✅ Songs remaining: ${finalRoomData.songs.length}`);

      // Verify Start Game button is visible for host (UI shows button, but clicking would fail with no songs)
      // Note: Backend validates song pairs on /start endpoint and returns 400 if none exist
      const hostStartButton = hostPage.getByRole('button', { name: 'Start Game' });
      await expect(hostStartButton).toBeVisible();
      console.log('✅ Host sees Start Game button (backend validates song requirement)');

      // Verify room code still displayed
      const hostRoomCode = hostPage.locator('.text-4xl.font-bold');
      await expect(hostRoomCode).toBeVisible();
      await expect(hostRoomCode).toContainText(roomCode);
      console.log('✅ Room code displayed in lobby');

      console.log('\n✅ Combined host+player+guest flow completed successfully (all 10 phases)');

      // ========================================================================
      // Screenshot Comparison
      // ========================================================================
      console.log('\n--- Screenshot Comparison ---');

      const allScreenshots = [...collector.hostScreenshots, ...collector.playerScreenshots, ...collector.guestScreenshots];
      const baselineNames = getBaselineScreenshots(TEST_NAME);
      const producedNames = allScreenshots.map((s) => s.name).sort();

      console.log(`Baselines: ${baselineNames.length} files`);
      console.log(`Produced:  ${producedNames.length} files`);

      // If no baselines exist, skip comparison (first run creates them)
      if (baselineNames.length === 0) {
        console.log('⚠️ No baseline screenshots found. Run test again to compare.');
        for (const { name, path } of allScreenshots) {
          const baselinePath = getBaselinePath(TEST_NAME, name);
          console.log(`   Copy: ${path} → ${baselinePath}`);
        }
        return;
      }

      // Check for exact match of screenshot names
      const missingFromProduced = baselineNames.filter((b) => !producedNames.includes(b));
      const extraInProduced = producedNames.filter((p) => !baselineNames.includes(p));

      if (missingFromProduced.length > 0) {
        console.log(`❌ Missing: ${missingFromProduced.join(', ')}`);
      }
      if (extraInProduced.length > 0) {
        console.log(`❌ Extra: ${extraInProduced.join(', ')}`);
      }

      expect(producedNames, 'Produced screenshots should match baseline names').toEqual(baselineNames);

      // Compare each screenshot
      let missingBaselinesCount = 0;
      let failedComparisonsCount = 0;

      for (const { name, path: screenshotPath } of allScreenshots) {
        const baselinePath = getBaselinePath(TEST_NAME, name);
        const result = await compareScreenshots(screenshotPath, baselinePath, 0.05);

        if (result.match) {
          console.log(`✅ ${name}: matches`);
        } else if (result.baselineMissing) {
          console.log(`⚠️ ${name}: baseline missing or invalid (Git LFS not configured?)`);
          missingBaselinesCount++;
        } else {
          console.log(`❌ ${name}: ${result.diffPercent?.toFixed(2)}% different`);
          failedComparisonsCount++;
        }
      }

      // Only fail on actual comparison mismatches, not missing baselines
      // Missing baselines are expected when Git LFS is not configured
      if (failedComparisonsCount > 0) {
        throw new Error(`${failedComparisonsCount} screenshot(s) differ from baseline`);
      }
      if (missingBaselinesCount > 0) {
        console.log(`⚠️ ${missingBaselinesCount} baseline(s) missing - run with Git LFS to compare screenshots`);
      }
    } finally {
      // Cleanup contexts
      await hostContext.close();
      await playerContext.close();
      await guestContext.close();
    }
  });

  test('player leaves room and host transfer works correctly', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext; // Required to trigger fixture - starts servers

    // Reset test user counter for deterministic player names
    await fetch(`${BACKEND_URL}/api/testing/reset-user-counter`, { method: 'POST' });
    console.log('✅ Reset test user counter for deterministic names');

    // Create separate browser contexts for host and player
    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();

    try {
      // ========================================================================
      // SETUP: Host creates room, player joins
      // ========================================================================
      console.log('\n=== SETUP: Host creates room, player joins ===');

      // Host: Load, login, create room
      await loadLandingPage(hostPage);
      await loginWithSpotify(hostPage);
      const roomCode = await createRoom(hostPage);
      console.log(`✅ Host created room: ${roomCode}`);

      // Player: Load, login, join room
      await loadLandingPage(playerPage);
      await loginWithSpotify(playerPage);
      await joinRoomViaUI(playerPage, roomCode);
      console.log('✅ Player joined room');

      // Add a third player via API for testing
      await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');
      console.log('✅ Added player-3 via API');

      // ========================================================================
      // TEST 1: Non-host player leaves room
      // ========================================================================
      console.log('\n=== TEST 1: Non-host player leaves room ===');

      // Get room state to verify 3 players
      let roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      let roomData = await roomResponse.json();
      expect(roomData.players.length).toBe(3);
      console.log(`✅ Room has ${roomData.players.length} players`);

      // Player-3 leaves via API
      const leaveResult = await leaveRoomViaAPI(roomCode, 'player-3');
      expect(leaveResult.room_deleted).toBe(false);
      console.log('✅ Player-3 left successfully');

      // Verify room now has 2 players
      roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      roomData = await roomResponse.json();
      expect(roomData.players.length).toBe(2);
      expect(roomData.host_id).toBe(roomData.players.find((p: { is_host: boolean }) => p.is_host)?.id);
      console.log(`✅ Room now has ${roomData.players.length} players, host unchanged`);

      // Host: Refresh and verify player count
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      const hostPlayerItems = await hostPage.locator('ul.space-y-3 li').count();
      expect(hostPlayerItems).toBe(2);
      console.log(`✅ Host sees ${hostPlayerItems} players after player-3 left`);

      // Screenshot: Host sees updated player list
      const hostAfterLeavePath = getArtifactsPath(TEST_NAME, 'leave-01-host-after-player-left.png');
      await hostPage.screenshot({ path: hostAfterLeavePath, fullPage: true });
      console.log(`Screenshot: ${hostAfterLeavePath}`);

      // ========================================================================
      // TEST 2: Host leaves and host transfers to next player
      // ========================================================================
      console.log('\n=== TEST 2: Host leaves, transfers to next player ===');

      // Get current host ID
      const originalHostId = roomData.host_id;
      const playerId = roomData.players.find((p: { id: string }) => p.id !== originalHostId)?.id;
      console.log(`Original host: ${originalHostId}, Other player: ${playerId}`);

      // Host leaves via API (simulate clicking Leave button)
      const hostLeaveResult = await leaveRoomViaAPI(roomCode, originalHostId);
      expect(hostLeaveResult.room_deleted).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((hostLeaveResult.room as any).host_id).toBe(playerId);
      console.log(`✅ Host left, new host is: ${playerId}`);

      // Verify host transfer via API
      roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      roomData = await roomResponse.json();
      expect(roomData.host_id).toBe(playerId);
      expect(roomData.players.length).toBe(1);
      const newHost = roomData.players.find((p: { id: string }) => p.id === playerId);
      expect(newHost?.is_host).toBe(true);
      console.log(`✅ API confirms new host: ${roomData.host_id}, is_host: ${newHost?.is_host}`);

      // Player: Refresh and verify they are now host
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Verify player now sees Start Game button (host-only)
      const startButton = playerPage.getByRole('button', { name: 'Start Game' });
      await expect(startButton).toBeVisible();
      console.log('✅ Player now sees Start Game button (is new host)');

      // Verify Host badge visible for the player
      const hostBadge = playerPage.locator('text=Host').first();
      await expect(hostBadge).toBeVisible();
      console.log('✅ Player sees Host badge');

      // Screenshot: Player is now host
      const playerAsHostPath = getArtifactsPath(TEST_NAME, 'leave-02-player-now-host.png');
      await playerPage.screenshot({ path: playerAsHostPath, fullPage: true });
      console.log(`Screenshot: ${playerAsHostPath}`);

      // ========================================================================
      // TEST 3: Last player leaves, room is deleted
      // ========================================================================
      console.log('\n=== TEST 3: Last player leaves, room deleted ===');

      // The remaining player (now host) leaves
      const finalLeaveResult = await leaveRoomViaAPI(roomCode, playerId);
      expect(finalLeaveResult.room_deleted).toBe(true);
      expect(finalLeaveResult.room).toBeNull();
      console.log('✅ Last player left, room deleted');

      // Verify room no longer exists
      roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      expect(roomResponse.status).toBe(404);
      console.log('✅ API confirms room no longer exists (404)');

      console.log('\n✅ Leave room and host transfer test completed successfully');
    } finally {
      // Cleanup contexts
      await hostContext.close();
      await playerContext.close();
    }
  });
});
