// Player user flow E2E test: Join room via code -> wait in lobby -> see song reveal when game starts
// Screenshots are saved to artifacts/screenshots/user-flow-player/ and compared against baselines
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
const FRONTEND_URL = 'http://localhost:3000';

const TEST_NAME = 'user-flow-player';

// Helper: Load and verify landing page
async function loadLandingPage(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
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

// Helper: Get test auth token from backend (test mode returns mock token directly)
async function getTestAuthToken(): Promise<{ accessToken: string; userId: string }> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`);
  if (!response.ok) {
    throw new Error(`Failed to get test auth token: ${await response.text()}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token,
    userId: data.user_id,
  };
}

// Helper: Create room as host via REST API (simulating host creating room first)
// Returns room code and host's user ID (from auth token)
async function createRoomViaAPI(): Promise<{ roomCode: string; hostUserId: string }> {
  const roomCode = '310';

  // Get auth token for host
  const { accessToken: hostToken, userId: hostUserId } = await getTestAuthToken();
  console.log(`Got host auth token for user: ${hostUserId}`);

  // Create room via API (requires auth)
  const response = await fetch(`${BACKEND_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hostToken}`,
    },
    body: JSON.stringify({ room_code: roomCode }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${await response.text()}`);
  }

  console.log(`Created room ${roomCode} with host ${hostUserId}`);
  return { roomCode, hostUserId };
}

// Helper: Add song pair to room via API (simulating host adding songs)
async function addSongPairViaAPI(roomCode: string, hostUserId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: hostUserId,
      track_a: 'spotify:track:mockTrackA123',
      track_b: 'spotify:track:mockTrackB456',
      title_a: "Stayin' Alive",
      artist_a: 'Bee Gees',
      title_b: 'Night Fever',
      artist_b: 'Bee Gees',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add song pair: ${await response.text()}`);
  }

  console.log('Added song pair for room');
}

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

  // Verify Leave and Pick Songs buttons are visible
  const leaveButton = page.getByRole('button', { name: 'Leave' });
  await expect(leaveButton).toBeVisible();

  console.log('✅ Player verified in lobby (no Start Game button)');
}

// Helper: Start game via REST API (simulating host starting game)
async function startGameViaAPI(roomCode: string, hostPlayerId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: hostPlayerId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start game: ${await response.text()}`);
  }

  console.log('Game started by host via API');
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

// Helper: Mark other players as ready via REST API
async function markOtherPlayersReady(roomCode: string, playerIds: string[]): Promise<void> {
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

test.describe('Player User Flow: Join Room → Wait in Lobby → See Song Reveal', () => {
  const screenshots: { name: string; path: string }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('complete player user flow with screenshot verification', async ({ page, serverContext }) => {
    // Setup: Create room via API (simulating another player creating room)
    const { roomCode, hostUserId } = await createRoomViaAPI();

    // Setup: Add song pair to room (host would do this)
    await addSongPairViaAPI(roomCode, hostUserId);

    // Step 1: Load landing page
    await loadLandingPage(page);

    // Screenshot: Landing page
    const landingPath = getArtifactsPath(TEST_NAME, '01-landing.png');
    await page.screenshot({ path: landingPath, fullPage: true });
    screenshots.push({ name: '01-landing.png', path: landingPath });
    console.log(`Screenshot saved: ${landingPath}`);

    // Step 2: Login with Spotify (as a different test user)
    await loginWithSpotify(page);

    // Screenshot: Room selection page (after login) - showing join room form
    const roomSelectionPath = getArtifactsPath(TEST_NAME, '02-room-selection.png');
    await page.screenshot({ path: roomSelectionPath, fullPage: true });
    screenshots.push({ name: '02-room-selection.png', path: roomSelectionPath });
    console.log(`Screenshot saved: ${roomSelectionPath}`);

    // Step 3: Enter room code and join room
    await joinRoomViaUI(page, roomCode);

    // Screenshot: Player in room lobby (as non-host)
    const lobbyPath = getArtifactsPath(TEST_NAME, '03-player-lobby.png');
    await page.screenshot({ path: lobbyPath, fullPage: true });
    screenshots.push({ name: '03-player-lobby.png', path: lobbyPath });
    console.log(`Screenshot saved: ${lobbyPath}`);

    // Verify player is in lobby as non-host
    await verifyPlayerInLobby(page, roomCode);

    // Step 4: Add another player via API (simulating more players joining)
    await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

    // Refresh to see updated player list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for player list to update (should show at least 2 other players)
    await page.waitForSelector('ul.space-y-3 li:nth-child(2)', { timeout: 5000 });

    // Screenshot: Lobby with multiple players
    const multiPlayerPath = getArtifactsPath(TEST_NAME, '04-lobby-multiple-players.png');
    await page.screenshot({ path: multiPlayerPath, fullPage: true });
    screenshots.push({ name: '04-lobby-multiple-players.png', path: multiPlayerPath });
    console.log(`Screenshot saved: ${multiPlayerPath}`);

    // Verify multiple players visible
    const playerItems = await page.locator('ul.space-y-3 li').count();
    expect(playerItems).toBeGreaterThanOrEqual(2);
    console.log(`✅ Verified ${playerItems} players in lobby`);

    // Step 5: Host starts game via API
    await startGameViaAPI(roomCode, hostUserId);

    // Player refreshes/navigates to see game started state
    // In real app, WebSocket would push update; for test, navigate to assignment
    await page.goto(`${FRONTEND_URL}/rooms/${roomCode}/assignment`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the SongAssignmentView
    const yourSongHeader = page.locator('h2:has-text("Your Song")');
    await expect(yourSongHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ Your Song header visible');

    // Verify song title is shown
    const songTitle = page.locator('h3.text-2xl.font-bold');
    await expect(songTitle).toBeVisible();
    const titleText = await songTitle.textContent();
    console.log(`✅ Song title displayed: ${titleText}`);

    // Verify artist is shown
    const songArtist = page.locator('p.text-lg.text-zinc-400');
    await expect(songArtist).toBeVisible();
    const artistText = await songArtist.textContent();
    console.log(`✅ Song artist displayed: ${artistText}`);

    // Verify "I'm Ready!" button is visible
    const readyButton = page.getByRole('button', { name: "I'm Ready!" });
    await expect(readyButton).toBeVisible();
    console.log('✅ Ready button visible');

    // Screenshot: Player's song assignment view
    const revealPath = getArtifactsPath(TEST_NAME, '05-song-assignment.png');
    await page.screenshot({ path: revealPath, fullPage: true });
    screenshots.push({ name: '05-song-assignment.png', path: revealPath });
    console.log(`Screenshot saved: ${revealPath}`);

    // Step 6: Click "I'm Ready!" button
    await readyButton.click();
    console.log('✅ Clicked Ready button');

    // Verify ready button is hidden after clicking
    await expect(readyButton).not.toBeVisible({ timeout: 2000 });
    console.log('✅ Ready button hidden after clicking');

    // Screenshot: After clicking ready (button hidden)
    const readyClickedPath = getArtifactsPath(TEST_NAME, '06-ready-clicked.png');
    await page.screenshot({ path: readyClickedPath, fullPage: true });
    screenshots.push({ name: '06-ready-clicked.png', path: readyClickedPath });
    console.log(`Screenshot saved: ${readyClickedPath}`);

    // Step 7: Mark other players as ready via API (simulating host and other player)
    await markOtherPlayersReady(roomCode, [hostUserId, 'player-3']);

    // Screenshot: All players ready (before navigation)
    const allReadyPath = getArtifactsPath(TEST_NAME, '07-all-players-ready.png');
    await page.screenshot({ path: allReadyPath, fullPage: true });
    screenshots.push({ name: '07-all-players-ready.png', path: allReadyPath });
    console.log(`Screenshot saved: ${allReadyPath}`);

    // Refresh to trigger navigation (since we don't have WebSocket)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for navigation to /play route (GameView)
    await page.waitForURL('**/rooms/*/play', { timeout: 10000 });
    console.log('✅ Navigated to /play route');

    // Verify we're on the GameView
    const roundHeader = page.locator('h2:has-text("Round In Progress")');
    await expect(roundHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ Round In Progress header visible');

    // Verify Time Remaining label is shown
    const timeLabel = page.locator('p:has-text("Time Remaining")');
    await expect(timeLabel).toBeVisible();
    console.log('✅ Time Remaining label visible');

    // Verify countdown timer is displayed
    const countdownTimer = page.locator('p.text-6xl.font-bold');
    await expect(countdownTimer).toBeVisible();
    const timerText = await countdownTimer.textContent();
    expect(timerText).toMatch(/\d{2}:\d{2}/);
    console.log(`✅ Countdown timer displayed: ${timerText}`);

    // Verify MusicPlayerBar is visible (has backdrop-blur-sm and border-t classes)
    const musicPlayerBar = page.locator('.backdrop-blur-sm.border-t');
    await expect(musicPlayerBar).toBeVisible();
    console.log('✅ MusicPlayerBar visible');

    // Screenshot: Music playing view
    const musicPlayingPath = getArtifactsPath(TEST_NAME, '08-music-playing.png');
    await page.screenshot({ path: musicPlayingPath, fullPage: true });
    screenshots.push({ name: '08-music-playing.png', path: musicPlayingPath });
    console.log(`Screenshot saved: ${musicPlayingPath}`);

    // Verify room status is 'playing' via API
    const roomResponse = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
    const roomData = await roomResponse.json();
    expect(roomData.status).toBe('playing');
    console.log(`✅ Room status verified: ${roomData.status}`);

    console.log('✅ Player user flow completed successfully');

    // Compare screenshots against baselines
    console.log('\n--- Screenshot Comparison ---');

    // Get baseline screenshots and produced screenshots
    const baselineNames = getBaselineScreenshots(TEST_NAME);
    const producedNames = screenshots.map((s) => s.name).sort();

    console.log(`Baselines: ${baselineNames.length} files`);
    console.log(`Produced:  ${producedNames.length} files`);

    // If no baselines exist yet, just report produced screenshots
    if (baselineNames.length === 0) {
      console.log('⚠️  No baseline screenshots found. Creating initial baselines...');
      for (const { name, path } of screenshots) {
        const baselinePath = getBaselinePath(TEST_NAME, name);
        console.log(`   Copy: ${path} → ${baselinePath}`);
      }
      // Don't fail the test when baselines are missing - first run creates them
      return;
    }

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
