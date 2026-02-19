/**
 * E2E test: Page refresh reconnect during lobby phase.
 * Verifies that a player can refresh the browser (F5) and reconnect to the room
 * with correct state restored (room code, player list, player count).
 *
 * Coverage: req (g) from user-flow-combined — now standalone.
 */
import { test, expect } from './fixtures';
import type { Browser, Page, BrowserContext } from '@playwright/test';

const FRONTEND_PORT = process.env.VITE_PORT || '9100';
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// ============================================================================
// UI Interaction Helpers (self-contained, no shared imports)
// ============================================================================

/** Navigate to app landing page (initial load only). */
async function loadLandingPage(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  const loginButton = page.getByRole('button', { name: 'Login' });
  await expect(loginButton).toBeVisible({ timeout: 10000 });
}

/** Login with a display name via UI. Fills name input, clicks Login. */
async function loginWithName(page: Page, name: string): Promise<void> {
  const nameInput = page.locator('#displayName');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  const loginButton = page.getByRole('button', { name: 'Login' });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
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
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await expect(roomCodeDisplay).toContainText('310');
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
  const roomCodeDisplay = page.locator('.text-4xl.font-bold');
  await expect(roomCodeDisplay).toBeVisible({ timeout: 10000 });
  await expect(roomCodeDisplay).toContainText(roomCode);
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Page Refresh Reconnect', () => {
  test('player refreshes during lobby and sees correct room state restored', async ({
    browser,
    serverContext,
  }: {
    browser: Browser;
    serverContext: { backendProcess: unknown; frontendProcess: unknown };
  }) => {
    void serverContext; // trigger fixture — starts servers

    const hostContext: BrowserContext = await browser.newContext();
    const playerContext: BrowserContext = await browser.newContext();

    const hostPage: Page = await hostContext.newPage();
    const playerPage: Page = await playerContext.newPage();

    try {
      // Host creates room
      await loadLandingPage(hostPage);
      await loginWithName(hostPage, 'DJ Host');
      const roomCode = await createRoom(hostPage);
      console.log(`✅ Host created room: ${roomCode}`);

      // Player joins room
      await loadLandingPage(playerPage);
      await loginWithName(playerPage, 'Funky Player');
      await joinRoomViaUI(playerPage, roomCode);
      console.log('✅ Player joined room');

      // Both see 2 players
      await expect(hostPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      console.log('✅ Both see 2 players in lobby');

      // page.reload() IS the test action (simulating F5 browser refresh), not a state-refresh workaround.
      // This verifies that reconnect logic (sessionStorage + reconnect_token) restores room state after refresh.
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Player should see correct room state restored
      const playerRoomCode = playerPage.locator('.text-4xl.font-bold');
      await expect(playerRoomCode).toBeVisible({ timeout: 10000 });
      await expect(playerRoomCode).toContainText(roomCode);

      // Verify player list is restored with correct count
      await expect(playerPage.locator('ul.space-y-3 li')).toHaveCount(2, { timeout: 10000 });
      console.log('✅ Player reconnected after refresh, sees correct room state with 2 players');

    } finally {
      await hostContext.close();
      await playerContext.close();
    }
  });
});
