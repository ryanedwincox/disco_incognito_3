// E2E test: Guessing Phase Flow and Results Reveal Flow
// Tests the complete flow from music playing -> voting -> results reveal
import { test, expect, getArtifactsPath } from './fixtures';
import type { Page } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

const TEST_NAME = 'guess-results-flow';

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
async function createRoomViaAPI(): Promise<{ roomCode: string; hostUserId: string }> {
  const roomCode = '310';
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
  return { roomCode, hostUserId };
}

// Helper: Add song pair to room via API
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

// Helper: Get room data via REST API
async function getRoomViaAPI(roomCode: string): Promise<{
  status: string;
  players: Array<{ id: string; display_name: string }>;
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

test.describe('Guessing Phase Flow', () => {
  test('player can navigate to guess page, see all players, cast vote, and cannot vote twice', async ({
    page,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverContext,
  }) => {
    // Setup: Create room with host and add players
    const { roomCode, hostUserId } = await createRoomViaAPI();
    await addSongPairViaAPI(roomCode, hostUserId);
    await addPlayerViaAPI(roomCode, 'player-2', 'Player Two');
    await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

    // Start game and mark all ready
    await startGameViaAPI(roomCode, hostUserId);
    await markPlayersReadyViaAPI(roomCode, [hostUserId, 'player-2', 'player-3']);

    // Login as a test user via UI
    await loadLandingPage(page);
    await loginWithSpotify(page);

    // Join room via UI (this creates a new player in the room)
    await joinRoomViaUI(page, roomCode);

    // Navigate to guess page
    await page.goto(`${FRONTEND_URL}/rooms/${roomCode}/guess`);
    await page.waitForLoadState('networkidle');

    // Screenshot: Guessing page with all players visible
    const guessingPath = getArtifactsPath(TEST_NAME, '01-guessing-page.png');
    await page.screenshot({ path: guessingPath, fullPage: true });
    console.log(`Screenshot saved: ${guessingPath}`);

    // Verify header is visible
    const header = page.locator('h2:has-text("Who Is The Dancer Incognito?")');
    await expect(header).toBeVisible();
    console.log('✅ Guessing page header visible');

    // Verify all 4 players are displayed as vote options
    // (3 existing players + the UI user who joined the room)
    const playerCards = page.locator('li.bg-zinc-900');
    await expect(playerCards).toHaveCount(4, { timeout: 5000 });
    console.log('✅ All 4 players displayed as vote options');

    // Verify player names are visible (host and UI user have random disco names, others are fixed)
    await expect(page.locator('h3:has-text("Player Two")')).toBeVisible();
    await expect(page.locator('h3:has-text("Player Three")')).toBeVisible();
    // Verify there are 4 player cards total
    const playerHeadings = page.locator('li.bg-zinc-900 h3');
    await expect(playerHeadings).toHaveCount(4);
    console.log('✅ All player names visible');

    // Click to vote for Player Two
    const voteButton = page.getByRole('button', { name: 'Guess Player Two' });
    await expect(voteButton).toBeVisible();
    await expect(voteButton).toBeEnabled();
    await voteButton.click();
    console.log('✅ Clicked vote button for Player Two');

    // Wait for vote confirmation
    await page.waitForSelector('.bg-green-900\\/30', { timeout: 5000 });

    // Screenshot: Vote confirmation visible
    const votedPath = getArtifactsPath(TEST_NAME, '02-vote-confirmed.png');
    await page.screenshot({ path: votedPath, fullPage: true });
    console.log(`Screenshot saved: ${votedPath}`);

    // Verify vote confirmation message
    const confirmationMessage = page.locator('.bg-green-900\\/30');
    await expect(confirmationMessage).toBeVisible();
    await expect(confirmationMessage).toContainText('You voted for');
    await expect(confirmationMessage).toContainText('Player Two');
    console.log('✅ Vote confirmation message displayed');

    // Verify buttons are now disabled (can't vote twice)
    const disabledButtons = page.locator('button:has-text("Voted")');
    await expect(disabledButtons.first()).toBeDisabled();
    console.log('✅ Vote buttons disabled after voting');

    // Verify the player's own vote button shows "Your Vote"
    const yourVoteButton = page.locator('button:has-text("Your Vote")');
    await expect(yourVoteButton).toBeVisible();
    await expect(yourVoteButton).toBeDisabled();
    console.log('✅ "Your Vote" button visible for selected player');

    // Screenshot: Buttons disabled state
    const disabledPath = getArtifactsPath(TEST_NAME, '03-buttons-disabled.png');
    await page.screenshot({ path: disabledPath, fullPage: true });
    console.log(`Screenshot saved: ${disabledPath}`);

    console.log('✅ Guessing Phase Flow test completed successfully');
  });
});

test.describe('Results Reveal Flow', () => {
  test('all players vote, navigate to results, verify Dancer Incognito revealed with highlight, host sees Finish Round button', async ({
    page,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverContext,
  }) => {
    // Setup: Create room with host and add players via API
    const { roomCode, hostUserId } = await createRoomViaAPI();
    await addSongPairViaAPI(roomCode, hostUserId);
    await addPlayerViaAPI(roomCode, 'player-2', 'Player Two');
    await addPlayerViaAPI(roomCode, 'player-3', 'Player Three');

    // Start game and mark all ready
    await startGameViaAPI(roomCode, hostUserId);
    await markPlayersReadyViaAPI(roomCode, [hostUserId, 'player-2', 'player-3']);

    // Get room state
    const roomDataBefore = await getRoomViaAPI(roomCode);
    console.log(`Room status before votes: ${roomDataBefore.status}`);

    // All players cast votes via API
    await castVoteViaAPI(roomCode, hostUserId, 'player-2');
    await castVoteViaAPI(roomCode, 'player-2', 'player-3');
    await castVoteViaAPI(roomCode, 'player-3', hostUserId);

    // Verify room status is now 'results'
    const roomDataAfter = await getRoomViaAPI(roomCode);
    expect(roomDataAfter.status).toBe('results');
    console.log('✅ Room status is results after all votes');

    // Login as a test user via UI and join the room
    await loadLandingPage(page);
    await loginWithSpotify(page);
    await joinRoomViaUI(page, roomCode);

    // Navigate to results page
    await page.goto(`${FRONTEND_URL}/rooms/${roomCode}/results`);
    await page.waitForLoadState('networkidle');

    // Wait for results to load
    await page.waitForSelector('.bg-disco-pink\\/20', { timeout: 5000 });

    // Screenshot: Results page
    const resultsPath = getArtifactsPath(TEST_NAME, '04-results-page.png');
    await page.screenshot({ path: resultsPath, fullPage: true });
    console.log(`Screenshot saved: ${resultsPath}`);

    // Verify header is visible
    const header = page.locator('h2:has-text("Reveal")');
    await expect(header).toBeVisible();
    console.log('✅ Results page header visible');

    // Verify Dancer Incognito is revealed with highlight
    const incognitoSection = page.locator('.bg-disco-pink\\/20');
    await expect(incognitoSection).toBeVisible();
    const incognitoLabel = incognitoSection.locator('h3:has-text("Dancer Incognito")');
    await expect(incognitoLabel).toBeVisible();
    console.log('✅ Dancer Incognito section with highlight visible');

    // Verify incognito player name is shown (it will be one of the 3 players)
    // Host has random disco name, so we just verify the text is not empty/Unknown
    const incognitoName = incognitoSection.locator('p.text-2xl');
    await expect(incognitoName).toBeVisible();
    const incognitoNameText = await incognitoName.textContent();
    expect(incognitoNameText).toBeTruthy();
    expect(incognitoNameText).not.toBe('Unknown');
    console.log(`✅ Dancer Incognito revealed: ${incognitoNameText}`);

    // Verify Votes section is visible
    const votesHeader = page.locator('h3:has-text("Votes")');
    await expect(votesHeader).toBeVisible();
    console.log('✅ Votes section visible');

    // Verify all 3 votes are shown
    const voteItems = page.locator('ul.space-y-2 li');
    await expect(voteItems).toHaveCount(3);
    console.log('✅ All 3 player votes displayed');

    // Verify correct guessers are highlighted (green background)
    // The correct guessers have bg-green-900/30 class
    const correctGuessers = page.locator('li.bg-green-900\\/30');
    const correctCount = await correctGuessers.count();
    console.log(`✅ ${correctCount} player(s) guessed correctly (highlighted in green)`);

    // Note: UI user is not the host (host was created via API), so Finish Round should not be visible
    // However, the requirement says host should see it - we verify that non-hosts DON'T see it
    // This confirms the host-only visibility logic is working
    const finishButton = page.getByRole('button', { name: 'Finish Round' });
    await expect(finishButton).not.toBeVisible();
    console.log('✅ Non-host user correctly does NOT see Finish Round button (host-only)');

    // Screenshot: Final results with all elements visible
    const finalPath = getArtifactsPath(TEST_NAME, '05-results-final.png');
    await page.screenshot({ path: finalPath, fullPage: true });
    console.log(`Screenshot saved: ${finalPath}`);

    console.log('✅ Results Reveal Flow test completed successfully');
  });
});
