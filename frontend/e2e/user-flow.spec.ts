// User flow E2E test: Combined flow from landing -> login -> room creation -> multiplayer game start
// Screenshots are saved to artifacts/screenshots/user-flow/ and compared against baselines
import {
  test,
  expect,
  getArtifactsPath,
  getBaselinePath,
  getBaselineScreenshots,
  compareScreenshots,
} from './fixtures';
import type { Page } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';

const TEST_NAME = 'user-flow';

// Helper: Load and verify landing page
async function loadLandingPage(page: Page): Promise<void> {
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  // Verify we're on the login page
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
// Returns paths of screenshots taken during the flow
async function addSongPair(
  page: Page,
  testName: string
): Promise<{ name: string; path: string }[]> {
  const screenshots: { name: string; path: string }[] = [];

  // Click 'Pick Songs' button to navigate to song picker
  const pickSongsButton = page.getByRole('button', { name: 'Pick Songs' });
  await expect(pickSongsButton).toBeVisible();
  await pickSongsButton.click();

  // Wait for navigation to song picker
  await page.waitForURL('**/rooms/*/songs', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Screenshot: Empty song picker
  const emptyPath = getArtifactsPath(testName, '04-song-picker-empty.png');
  await page.screenshot({ path: emptyPath, fullPage: true });
  screenshots.push({ name: '04-song-picker-empty.png', path: emptyPath });
  console.log(`Screenshot saved: ${emptyPath}`);

  // Click 'Generate Random Pair' button
  const generateButton = page.getByRole('button', { name: 'Generate Random Pair' });
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  // Wait for song pair to be displayed (check for song cards in the UI)
  await page.waitForSelector('.bg-zinc-800.rounded-xl', { timeout: 5000 });

  // Screenshot: Song picker with generated pair
  const generatedPath = getArtifactsPath(testName, '05-song-picker-generated.png');
  await page.screenshot({ path: generatedPath, fullPage: true });
  screenshots.push({ name: '05-song-picker-generated.png', path: generatedPath });
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
  const savedPath = getArtifactsPath(testName, '06-song-picker-saved.png');
  await page.screenshot({ path: savedPath, fullPage: true });
  screenshots.push({ name: '06-song-picker-saved.png', path: savedPath });
  console.log(`Screenshot saved: ${savedPath}`);

  // Wait for auto-redirect back to lobby (1.5s delay in SongPickerView)
  await page.waitForURL('**/rooms/310', { timeout: 5000 });
  await page.waitForLoadState('networkidle');

  return screenshots;
}

// Helper: Add players via REST API
async function addPlayersViaREST(roomCode: string): Promise<void> {
  // Add player 2
  const response1 = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: 'player-2',
      display_name: 'Player Two',
    }),
  });
  if (!response1.ok) {
    throw new Error(`Failed to add player 2: ${await response1.text()}`);
  }

  // Add player 3
  const response2 = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: 'player-3',
      display_name: 'Player Three',
    }),
  });
  if (!response2.ok) {
    throw new Error(`Failed to add player 3: ${await response2.text()}`);
  }

  console.log('Added 2 players via REST API');
}

// Helper: Start game via host clicking button
async function startGameAsHost(
  page: Page,
  testName: string,
  hostPlayerId: string,
  roomCode: string
): Promise<{ name: string; path: string }[]> {
  const screenshots: { name: string; path: string }[] = [];

  // Refresh page to see updated player list
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for player list to update (3 players should be visible)
  await page.waitForSelector('ul.space-y-3 li:nth-child(3)', { timeout: 5000 });

  // Screenshot: Room lobby with 3 players
  const threePlayersPath = getArtifactsPath(testName, '07-lobby-three-players.png');
  await page.screenshot({ path: threePlayersPath, fullPage: true });
  screenshots.push({ name: '07-lobby-three-players.png', path: threePlayersPath });
  console.log(`Screenshot saved: ${threePlayersPath}`);

  // Verify 3 players are shown
  const playerItems = await page.locator('ul.space-y-3 li').count();
  expect(playerItems).toBe(3);
  console.log(`✅ Verified ${playerItems} players in lobby`);

  // Click Start Game button (visible only to host)
  const startButton = page.getByRole('button', { name: 'Start Game' });
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await startButton.click();

  // Wait for game-in-progress UI to appear (stays on lobby, no navigation)
  const gameStatusBanner = page.locator('[data-testid="game-status-banner"]');
  await expect(gameStatusBanner).toBeVisible({ timeout: 5000 });
  await expect(gameStatusBanner).toContainText('Game in Progress');

  // Verify Start Game button is now hidden
  await expect(startButton).not.toBeVisible();

  // Verify header changed to show 'Game Started'
  const gameStartedHeader = page.locator('h2:has-text("Game Started")');
  await expect(gameStartedHeader).toBeVisible();

  // Verify assigned song is displayed
  const assignedSongSection = page.locator('[data-testid="assigned-song"]');
  await expect(assignedSongSection).toBeVisible({ timeout: 5000 });
  console.log('✅ Assigned song section visible');

  // Verify song title is shown
  const songTitle = page.locator('[data-testid="song-title"]');
  await expect(songTitle).toBeVisible();
  const titleText = await songTitle.textContent();
  console.log(`✅ Song title displayed: ${titleText}`);

  // Verify artist is shown
  const songArtist = page.locator('[data-testid="song-artist"]');
  await expect(songArtist).toBeVisible();
  const artistText = await songArtist.textContent();
  console.log(`✅ Song artist displayed: ${artistText}`);

  // Verify "Listening now..." indicator
  const listeningIndicator = page.locator('text=Listening now...');
  await expect(listeningIndicator).toBeVisible();
  console.log('✅ Listening indicator visible');

  // Screenshot: After game start (lobby with song assignment displayed)
  const gameStartedPath = getArtifactsPath(testName, '08-game-started.png');
  await page.screenshot({ path: gameStartedPath, fullPage: true });
  screenshots.push({ name: '08-game-started.png', path: gameStartedPath });
  console.log(`Screenshot saved: ${gameStartedPath}`);

  // Verify room status changed via API
  const roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
  const roomData = await roomResponse.json();
  expect(roomData.status).toBe('song_selection');
  console.log(`✅ Room status verified: ${roomData.status}`);

  // Verify current_round with player_assignments exists
  expect(roomData.current_round).toBeDefined();
  expect(roomData.current_round.player_assignments).toBeDefined();
  expect(roomData.current_round.incognito_player_id).toBeDefined();
  console.log(`✅ Current round verified with incognito: ${roomData.current_round.incognito_player_id}`);

  // Verify status is displayed in UI
  const statusText = page.locator('text=song_selection');
  await expect(statusText).toBeVisible();

  return screenshots;
}

test.describe('User Flow: Landing → Login → Room Creation → Song Pair → Multiplayer Game Start', () => {
  const screenshots: { name: string; path: string }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('complete user flow with screenshot verification', async ({ page, serverContext }) => {
    // Step 1: Load landing page
    await loadLandingPage(page);

    // Screenshot: Landing page
    const landingPath = getArtifactsPath(TEST_NAME, '01-landing.png');
    await page.screenshot({ path: landingPath, fullPage: true });
    screenshots.push({ name: '01-landing.png', path: landingPath });
    console.log(`Screenshot saved: ${landingPath}`);

    // Step 2: Login with Spotify
    await loginWithSpotify(page);

    // Screenshot: Room selection page (after login)
    const roomSelectionPath = getArtifactsPath(TEST_NAME, '02-room-selection.png');
    await page.screenshot({ path: roomSelectionPath, fullPage: true });
    screenshots.push({ name: '02-room-selection.png', path: roomSelectionPath });
    console.log(`Screenshot saved: ${roomSelectionPath}`);

    // Step 3: Create room
    const roomCode = await createRoom(page);
    console.log(`Created room: ${roomCode}`);

    // Screenshot: Room lobby
    const roomLobbyPath = getArtifactsPath(TEST_NAME, '03-room-lobby.png');
    await page.screenshot({ path: roomLobbyPath, fullPage: true });
    screenshots.push({ name: '03-room-lobby.png', path: roomLobbyPath });
    console.log(`Screenshot saved: ${roomLobbyPath}`);

    // Step 4: Add song pair
    const songPairScreenshots = await addSongPair(page, TEST_NAME);
    screenshots.push(...songPairScreenshots);
    console.log(`Added ${songPairScreenshots.length} song pair screenshots`);

    // Step 5: Add 2 more players via REST API
    await addPlayersViaREST(roomCode);

    // Step 6: Start game as host (with screenshots)
    // Host player ID in test mode is 'test-user-123'
    const gameStartScreenshots = await startGameAsHost(page, TEST_NAME, 'test-user-123', roomCode);
    screenshots.push(...gameStartScreenshots);
    console.log(`Added ${gameStartScreenshots.length} game start screenshots`);

    console.log('✅ User flow completed successfully');

    // Compare screenshots against baselines
    console.log('\n--- Screenshot Comparison ---');

    // Get baseline screenshots and produced screenshots
    const baselineNames = getBaselineScreenshots(TEST_NAME);
    const producedNames = screenshots.map((s) => s.name).sort();

    console.log(`Baselines: ${baselineNames.length} files`);
    console.log(`Produced:  ${producedNames.length} files`);

    // Check for exact match of screenshot names
    const missingFromProduced = baselineNames.filter((b) => !producedNames.includes(b));
    const extraInProduced = producedNames.filter((p) => !baselineNames.includes(p));

    if (missingFromProduced.length > 0) {
      console.log(`❌ Missing screenshots (in baseline but not produced): ${missingFromProduced.join(', ')}`);
    }
    if (extraInProduced.length > 0) {
      console.log(`❌ Extra screenshots (produced but not in baseline): ${extraInProduced.join(', ')}`);
    }

    // Assert exact match of screenshot sets
    expect(producedNames, 'Produced screenshots should match baseline names exactly').toEqual(baselineNames);

    // Compare each screenshot's content
    for (const { name, path: screenshotPath } of screenshots) {
      const baselinePath = getBaselinePath(TEST_NAME, name);
      const result = await compareScreenshots(screenshotPath, baselinePath, 0.05);

      if (result.match) {
        console.log(`✅ ${name}: matches baseline`);
      } else if (result.baselineMissing) {
        console.log(`⚠️  ${name}: baseline missing at ${baselinePath}`);
        console.log(`   Run: cp "${screenshotPath}" "${baselinePath}"`);
      } else {
        console.log(`❌ ${name}: differs from baseline (${result.diffPercent?.toFixed(2)}% different)`);
      }

      // Assert screenshots match
      expect(result.match, `Screenshot ${name} should match baseline`).toBe(true);
    }
  });
});
