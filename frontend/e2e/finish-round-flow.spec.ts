// E2E test: Finish Round Flow - Host finishes round, returns to lobby, song pair removed
// Tests the complete flow: results -> finish round -> lobby -> can start new round
import { test, expect, getArtifactsPath } from './fixtures';
import type { Page } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

const TEST_NAME = 'finish-round-flow';

// Helper: Get test auth token from backend
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

// Helper: Create room as host via REST API
async function createRoomViaAPI(): Promise<{ roomCode: string; hostUserId: string; hostToken: string }> {
  const roomCode = '410';
  const { accessToken: hostToken, userId: hostUserId } = await getTestAuthToken();
  console.log(`Got host auth token for user: ${hostUserId}`);

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
  return { roomCode, hostUserId, hostToken };
}

// Helper: Add song pair to room via API
async function addSongPairViaAPI(
  roomCode: string,
  hostUserId: string,
  pairIndex: number
): Promise<void> {
  const songs = [
    {
      track_a: 'spotify:track:stayinAlive',
      track_b: 'spotify:track:nightFever',
      title_a: "Stayin' Alive",
      artist_a: 'Bee Gees',
      title_b: 'Night Fever',
      artist_b: 'Bee Gees',
    },
    {
      track_a: 'spotify:track:billieJean',
      track_b: 'spotify:track:beatIt',
      title_a: 'Billie Jean',
      artist_a: 'Michael Jackson',
      title_b: 'Beat It',
      artist_b: 'Michael Jackson',
    },
  ];

  const pair = songs[pairIndex];
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: hostUserId,
      ...pair,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add song pair: ${await response.text()}`);
  }
  console.log(`Added song pair ${pairIndex + 1} to room`);
}

// Helper: Add a player to room via REST API
async function addPlayerViaAPI(
  roomCode: string,
  playerId: string,
  displayName: string
): Promise<void> {
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

// Helper: Start game via REST API
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

// Helper: Cast vote via REST API
async function castVoteViaAPI(
  roomCode: string,
  voterId: string,
  guessedId: string
): Promise<void> {
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

// Helper: Get room data via REST API
async function getRoomViaAPI(roomCode: string): Promise<{
  status: string;
  players: Array<{ id: string; display_name: string }>;
  song_pairs: Array<{ id: string; title_a: string; title_b: string }>;
}> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
  if (!response.ok) {
    throw new Error(`Failed to get room: ${await response.text()}`);
  }
  return response.json();
}

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

  const successMessage = page.locator('.bg-green-900\\/30');
  await expect(successMessage).toBeVisible({ timeout: 10000 });
  await expect(successMessage).toContainText('Welcome,');

  await page.waitForURL('**/rooms', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// Helper: Join room via UI
async function joinRoomViaUI(page: Page, roomCode: string): Promise<void> {
  const roomCodeInput = page.locator('#room-code');
  await expect(roomCodeInput).toBeVisible();
  await roomCodeInput.fill(roomCode);

  const joinButton = page.getByRole('button', { name: 'Join Room' });
  await expect(joinButton).toBeVisible();
  await joinButton.click();

  await page.waitForURL(`**/rooms/${roomCode}`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Finish Round Flow', () => {
  test('host finishes round, navigates to lobby, song pair removed, can start new round', async ({
    page,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverContext,
  }) => {
    // Setup: Create room with 2 song pairs
    const { roomCode, hostUserId, hostToken } = await createRoomViaAPI();
    await addSongPairViaAPI(roomCode, hostUserId, 0); // First pair
    await addSongPairViaAPI(roomCode, hostUserId, 1); // Second pair

    // Add 2 more players
    await addPlayerViaAPI(roomCode, 'player-2', 'Player Two');
    await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

    // Verify 2 song pairs initially
    const roomBefore = await getRoomViaAPI(roomCode);
    expect(roomBefore.song_pairs.length).toBe(2);
    console.log(`✅ Room has ${roomBefore.song_pairs.length} song pairs initially`);

    // Start game and mark all ready
    await startGameViaAPI(roomCode, hostUserId);
    await markPlayersReadyViaAPI(roomCode, [hostUserId, 'player-2', 'player-3']);

    // All players cast votes via API
    await castVoteViaAPI(roomCode, hostUserId, 'player-2');
    await castVoteViaAPI(roomCode, 'player-2', 'player-3');
    await castVoteViaAPI(roomCode, 'player-3', hostUserId);

    // Verify room status is now 'results'
    const roomAfterVotes = await getRoomViaAPI(roomCode);
    expect(roomAfterVotes.status).toBe('results');
    console.log('✅ Room status is results after all votes');

    // Login as host user via UI (use same token by storing in localStorage)
    await loadLandingPage(page);

    // Inject auth state for host user using the correct localStorage keys
    // auth store uses: access_token, refresh_token, user (JSON)
    await page.evaluate(
      ({ token, userId, displayName }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', token); // Use same token for refresh
        localStorage.setItem('user', JSON.stringify({
          id: userId,
          displayName: displayName,
          email: 'test@example.com'
        }));
      },
      { token: hostToken, userId: hostUserId, displayName: 'Test Host' }
    );

    // Navigate directly to results page as host
    await page.goto(`${FRONTEND_URL}/rooms/${roomCode}/results`);
    await page.waitForLoadState('networkidle');

    // Wait for results to load
    await page.waitForSelector('.bg-disco-pink\\/20', { timeout: 5000 });

    // Screenshot: Results page as host (should see Finish Round button)
    const resultsPath = getArtifactsPath(TEST_NAME, '01-results-as-host.png');
    await page.screenshot({ path: resultsPath, fullPage: true });
    console.log(`Screenshot saved: ${resultsPath}`);

    // Verify Finish Round button is visible (host only)
    const finishButton = page.getByRole('button', { name: 'Finish Round' });
    await expect(finishButton).toBeVisible();
    console.log('✅ Host sees Finish Round button');

    // Click Finish Round button
    await finishButton.click();
    console.log('✅ Clicked Finish Round button');

    // Wait for navigation to lobby
    await page.waitForURL(`**/rooms/${roomCode}`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Screenshot: Back in lobby after finishing round
    const lobbyPath = getArtifactsPath(TEST_NAME, '02-back-in-lobby.png');
    await page.screenshot({ path: lobbyPath, fullPage: true });
    console.log(`Screenshot saved: ${lobbyPath}`);

    // Verify we're in the lobby
    const roomCodeDisplay = page.locator('.text-4xl.font-bold');
    await expect(roomCodeDisplay).toBeVisible();
    await expect(roomCodeDisplay).toContainText(roomCode);
    console.log('✅ Navigated back to lobby');

    // Verify room status is 'lobby' via API
    const roomAfterFinish = await getRoomViaAPI(roomCode);
    expect(roomAfterFinish.status).toBe('lobby');
    console.log('✅ Room status is lobby after finishing round');

    // Verify song pair was removed (should have 1 pair left)
    expect(roomAfterFinish.song_pairs.length).toBe(1);
    console.log(`✅ Song pair removed: ${roomAfterFinish.song_pairs.length} pair(s) remaining`);

    // Verify Start Game button is visible (can start new round since songs remain)
    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    console.log('✅ Start Game button visible (can start new round)');

    // Screenshot: Lobby with Start Game visible
    const startVisiblePath = getArtifactsPath(TEST_NAME, '03-start-game-visible.png');
    await page.screenshot({ path: startVisiblePath, fullPage: true });
    console.log(`Screenshot saved: ${startVisiblePath}`);

    console.log('✅ Finish Round Flow test completed successfully');
  });

  test('non-host does not see Finish Round button', async ({
    page,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverContext,
  }) => {
    // Setup: Create room
    const { roomCode, hostUserId } = await createRoomViaAPI();
    await addSongPairViaAPI(roomCode, hostUserId, 0);
    await addPlayerViaAPI(roomCode, 'player-2', 'Player Two');
    await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

    // Start game and all vote
    await startGameViaAPI(roomCode, hostUserId);
    await markPlayersReadyViaAPI(roomCode, [hostUserId, 'player-2', 'player-3']);
    await castVoteViaAPI(roomCode, hostUserId, 'player-2');
    await castVoteViaAPI(roomCode, 'player-2', 'player-3');
    await castVoteViaAPI(roomCode, 'player-3', hostUserId);

    // Login as non-host player via UI
    await loadLandingPage(page);
    await loginWithSpotify(page);
    await joinRoomViaUI(page, roomCode);

    // Navigate to results page
    await page.goto(`${FRONTEND_URL}/rooms/${roomCode}/results`);
    await page.waitForLoadState('networkidle');

    // Wait for results to load
    await page.waitForSelector('.bg-disco-pink\\/20', { timeout: 5000 });

    // Screenshot: Results page as non-host
    const resultsPath = getArtifactsPath(TEST_NAME, '04-results-as-non-host.png');
    await page.screenshot({ path: resultsPath, fullPage: true });
    console.log(`Screenshot saved: ${resultsPath}`);

    // Verify Finish Round button is NOT visible for non-host
    const finishButton = page.getByRole('button', { name: 'Finish Round' });
    await expect(finishButton).not.toBeVisible();
    console.log('✅ Non-host does NOT see Finish Round button');

    console.log('✅ Non-host visibility test completed successfully');
  });
});
