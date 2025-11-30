// Combined host+player E2E test: Both roles exercise full flows with parallel execution
// Uses browser.newContext() for separate browser contexts (host and player)
// Screenshots: user-flow-combined/host-*.png and user-flow-combined/player-*.png
import { test, expect, getArtifactsPath, getBaselinePath, getBaselineScreenshots, compareScreenshots } from './fixtures';
import type { Browser, Page, BrowserContext } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';
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

  // Wait for success message
  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 10000 });
  await expect(successMessage).toContainText('Welcome,');

  // Wait for redirect to /rooms
  await page.waitForURL('**/rooms', { timeout: 10000 });
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

  // Wait for navigation to room lobby
  await page.waitForURL('**/rooms/310', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Verify room code is displayed
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible();

  // Verify host badge
  const hostBadge = page.locator('text=Host').first();
  await expect(hostBadge).toBeVisible();

  return '310';
}

// Helper: Navigate to song picker, generate pair, save it
async function addSongPair(page: Page, rolePrefix: string): Promise<{ name: string; path: string }[]> {
  const screenshots: { name: string; path: string }[] = [];

  // Click 'Pick Songs' button to navigate to song picker
  const pickSongsButton = page.getByRole('button', { name: 'Pick Songs' });
  await expect(pickSongsButton).toBeVisible();
  await pickSongsButton.click();

  // Wait for navigation to song picker
  await page.waitForURL('**/rooms/*/songs', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Screenshot: Empty song picker
  const emptyPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-04-song-picker-empty.png`);
  await page.screenshot({ path: emptyPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-04-song-picker-empty.png`, path: emptyPath });
  console.log(`Screenshot saved: ${emptyPath}`);

  // Click 'Generate Random Pair' button
  const generateButton = page.getByRole('button', { name: 'Generate Random Pair' });
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  // Wait for song pair to be displayed
  await page.waitForSelector('.bg-zinc-800.rounded-xl', { timeout: 5000 });

  // Screenshot: Song picker with generated pair
  const generatedPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-05-song-picker-generated.png`);
  await page.screenshot({ path: generatedPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-05-song-picker-generated.png`, path: generatedPath });
  console.log(`Screenshot saved: ${generatedPath}`);

  // Click 'Save Pair' button
  const saveButton = page.getByRole('button', { name: 'Save Pair' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait for success message
  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 5000 });
  await expect(successMessage).toContainText('Saved pair');

  // Screenshot: Song picker with success message
  const savedPath = getArtifactsPath(TEST_NAME, `${rolePrefix}-06-song-picker-saved.png`);
  await page.screenshot({ path: savedPath, fullPage: true });
  screenshots.push({ name: `${rolePrefix}-06-song-picker-saved.png`, path: savedPath });
  console.log(`Screenshot saved: ${savedPath}`);

  // Wait for auto-redirect back to lobby
  await page.waitForURL('**/rooms/310', { timeout: 5000 });
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

  // Wait for navigation to room lobby
  await page.waitForURL(`**/rooms/${roomCode}`, { timeout: 10000 });
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
}

// ============================================================================
// Combined Test
// ============================================================================

test.describe('Combined Host+Player User Flow: Real Multi-User Interaction', () => {
  test('host creates room, player joins, both see game flow with screenshot verification', async ({
    browser,
    serverContext: _serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    const collector: ScreenshotCollector = { hostScreenshots: [], playerScreenshots: [] };

    // Create separate browser contexts for host and player
    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();

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
      const songPairScreenshots = await addSongPair(hostPage, 'host');
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
      // PHASE 3: Add third player via API, both see updated lobby
      // ========================================================================
      console.log('\n=== PHASE 3: Third player joins ===');

      // Add player-3 via API
      await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

      // Host: Refresh and see all players
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      await hostPage.waitForSelector('ul.space-y-3 li:nth-child(3)', { timeout: 5000 });

      const hostThreePlayersPath = getArtifactsPath(TEST_NAME, 'host-07-lobby-three-players.png');
      await hostPage.screenshot({ path: hostThreePlayersPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-07-lobby-three-players.png', path: hostThreePlayersPath });
      console.log(`Host screenshot: ${hostThreePlayersPath}`);

      // Verify 3 players in host view
      const hostPlayerCount = await hostPage.locator('ul.space-y-3 li').count();
      expect(hostPlayerCount).toBe(3);
      console.log(`✅ Host sees ${hostPlayerCount} players in lobby`);

      // Player: Refresh and see all players
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerPage.waitForSelector('ul.space-y-3 li:nth-child(2)', { timeout: 5000 });

      const playerMultiplePath = getArtifactsPath(TEST_NAME, 'player-04-lobby-multiple-players.png');
      await playerPage.screenshot({ path: playerMultiplePath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-04-lobby-multiple-players.png', path: playerMultiplePath });
      console.log(`Player screenshot: ${playerMultiplePath}`);

      // Verify multiple players visible from player's view
      const playerPlayerCount = await playerPage.locator('ul.space-y-3 li').count();
      expect(playerPlayerCount).toBeGreaterThanOrEqual(2);
      console.log(`✅ Player sees ${playerPlayerCount} players in lobby`);

      // ========================================================================
      // PHASE 4: Host starts game, both see assignment
      // ========================================================================
      console.log('\n=== PHASE 4: Host starts game ===');

      // Host: Click Start Game button
      const startButton = hostPage.getByRole('button', { name: 'Start Game' });
      await expect(startButton).toBeVisible({ timeout: 5000 });
      await startButton.click();

      // Host: Wait for navigation to /assignment
      await hostPage.waitForURL('**/rooms/*/assignment', { timeout: 10000 });
      await hostPage.waitForLoadState('networkidle');
      console.log('✅ Host navigated to /assignment');

      // Host: Verify song assignment view
      const hostYourSongHeader = hostPage.locator('h2:has-text("Your Song")');
      await expect(hostYourSongHeader).toBeVisible({ timeout: 5000 });

      const hostSongTitle = hostPage.locator('h3.text-2xl.font-bold');
      await expect(hostSongTitle).toBeVisible();
      const hostTitleText = await hostSongTitle.textContent();
      expect(hostTitleText).not.toBe('Unknown Song');
      console.log(`✅ Host song: ${hostTitleText}`);

      const hostGameStartedPath = getArtifactsPath(TEST_NAME, 'host-08-game-started.png');
      await hostPage.screenshot({ path: hostGameStartedPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-08-game-started.png', path: hostGameStartedPath });
      console.log(`Host screenshot: ${hostGameStartedPath}`);

      // Player: Navigate to assignment (simulating real-time update)
      await playerPage.goto(`${FRONTEND_URL}/rooms/${roomCode}/assignment`);
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

      // Verify room status via API
      const roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const roomData = await roomResponse.json();
      expect(roomData.status).toBe('song_selection');
      console.log(`✅ Room status: ${roomData.status}`);

      // Security: Verify incognito identity NOT exposed
      expect(roomData.current_round?.incognito_player_id).toBeUndefined();
      console.log('✅ Security: incognito identity NOT exposed');

      // ========================================================================
      // PHASE 5: Both click ready, navigate to playback
      // ========================================================================
      console.log('\n=== PHASE 5: Both players ready ===');

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

      // Mark player-3 ready via API
      await markPlayersReadyViaAPI(roomCode, ['player-3']);

      // Screenshot both after all ready
      const hostAllReadyPath = getArtifactsPath(TEST_NAME, 'host-10-all-players-ready.png');
      await hostPage.screenshot({ path: hostAllReadyPath, fullPage: true });
      collector.hostScreenshots.push({ name: 'host-10-all-players-ready.png', path: hostAllReadyPath });

      const playerAllReadyPath = getArtifactsPath(TEST_NAME, 'player-07-all-players-ready.png');
      await playerPage.screenshot({ path: playerAllReadyPath, fullPage: true });
      collector.playerScreenshots.push({ name: 'player-07-all-players-ready.png', path: playerAllReadyPath });

      // ========================================================================
      // PHASE 6: Both navigate to playback view
      // ========================================================================
      console.log('\n=== PHASE 6: Navigate to playback ===');

      // Refresh both to trigger navigation
      await hostPage.reload();
      await hostPage.waitForLoadState('networkidle');
      await hostPage.waitForURL('**/rooms/*/play', { timeout: 10000 });
      console.log('✅ Host navigated to /play');

      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerPage.waitForURL('**/rooms/*/play', { timeout: 10000 });
      console.log('✅ Player navigated to /play');

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

      // Verify MusicPlayerBar visible for both
      const hostMusicBar = hostPage.locator('.backdrop-blur-sm.border-t');
      await expect(hostMusicBar).toBeVisible();
      const playerMusicBar = playerPage.locator('.backdrop-blur-sm.border-t');
      await expect(playerMusicBar).toBeVisible();
      console.log('✅ MusicPlayerBar visible for both');

      // Verify room status is 'playing'
      const finalRoomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      const finalRoomData = await finalRoomResponse.json();
      expect(finalRoomData.status).toBe('playing');
      console.log(`✅ Final room status: ${finalRoomData.status}`);

      console.log('\n✅ Combined host+player flow completed successfully');

      // ========================================================================
      // Screenshot Comparison
      // ========================================================================
      console.log('\n--- Screenshot Comparison ---');

      const allScreenshots = [...collector.hostScreenshots, ...collector.playerScreenshots];
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
      for (const { name, path: screenshotPath } of allScreenshots) {
        const baselinePath = getBaselinePath(TEST_NAME, name);
        const result = await compareScreenshots(screenshotPath, baselinePath, 0.05);

        if (result.match) {
          console.log(`✅ ${name}: matches`);
        } else if (result.baselineMissing) {
          console.log(`⚠️ ${name}: baseline missing`);
        } else {
          console.log(`❌ ${name}: ${result.diffPercent?.toFixed(2)}% different`);
        }

        expect(result.match, `Screenshot ${name} should match baseline`).toBe(true);
      }
    } finally {
      // Cleanup contexts
      await hostContext.close();
      await playerContext.close();
    }
  });
});
