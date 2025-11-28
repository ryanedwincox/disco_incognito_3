// Room creation E2E test: Tests full flow from login to room creation with screenshots
import { test, expect, getArtifactsPath } from './fixtures';

test.describe('Room Creation Flow', () => {
  test('should login, create room, and display room lobby', async ({ page, serverContext }) => {
    // Step 1: Navigate to login page
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Step 2: Click login button (test mode auth)
    const loginButton = page.getByRole('button', { name: 'Login with Spotify' });
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Step 3: Wait for success message and redirect to /rooms
    const successMessage = page.locator('.bg-green-900\\/30');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    await page.waitForURL('**/rooms', { timeout: 10000 });

    // Step 4: Screenshot - Room selection page
    await page.waitForLoadState('networkidle');
    const roomSelectionScreenshot = getArtifactsPath('room-selection.png');
    await page.screenshot({ path: roomSelectionScreenshot, fullPage: true });
    console.log(`Screenshot saved to: ${roomSelectionScreenshot}`);

    // Step 5: Verify Create Room button exists
    const createRoomButton = page.getByRole('button', { name: 'Create Room' });
    await expect(createRoomButton).toBeVisible();
    await expect(createRoomButton).toBeEnabled();

    // Step 6: Verify Join Room button exists
    const joinRoomButton = page.getByRole('button', { name: 'Join Room' });
    await expect(joinRoomButton).toBeVisible();

    // Step 7: Click Create Room
    await createRoomButton.click();

    // Step 8: Wait for navigation to /rooms/{3-digit-code}
    await page.waitForURL(/\/rooms\/\d{3}$/, { timeout: 10000 });
    const currentUrl = page.url();
    console.log(`Navigated to room: ${currentUrl}`);

    // Step 9: Extract room code from URL
    const roomCodeMatch = currentUrl.match(/\/rooms\/(\d{3})$/);
    expect(roomCodeMatch).toBeTruthy();
    const roomCode = roomCodeMatch![1];
    console.log(`Room code: ${roomCode}`);

    // Step 10: Wait for lobby to load
    await page.waitForLoadState('networkidle');

    // Step 11: Screenshot - Room lobby page
    const roomLobbyScreenshot = getArtifactsPath('room-lobby.png');
    await page.screenshot({ path: roomLobbyScreenshot, fullPage: true });
    console.log(`Screenshot saved to: ${roomLobbyScreenshot}`);

    // Step 12: Verify room code is displayed (with tracking spacing)
    const roomCodeDisplay = page.locator('.text-4xl.font-bold');
    await expect(roomCodeDisplay).toBeVisible();
    const displayedCode = await roomCodeDisplay.textContent();
    expect(displayedCode?.replace(/\s/g, '')).toBe(roomCode);

    // Step 13: Verify host player is shown with Host badge
    const hostBadge = page.locator('text=Host').first();
    await expect(hostBadge).toBeVisible();

    // Step 14: Verify Players section exists
    const playersSection = page.locator('text=Players').first();
    await expect(playersSection).toBeVisible();

    // Step 15: Verify Song Pairs section exists
    const songPairsSection = page.locator('text=Song Pairs').first();
    await expect(songPairsSection).toBeVisible();

    console.log('✅ Room creation flow completed successfully');
  });
});
