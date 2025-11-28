// User flow E2E test: Combined flow from landing -> login -> room creation
// Screenshots are saved to artifacts/screenshots/user-flow/ and compared against baselines
import { test, expect, getArtifactsPath, getBaselinePath, compareScreenshots } from './fixtures';
import type { Page } from '@playwright/test';

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

test.describe('User Flow: Landing → Login → Room Creation', () => {
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

    console.log('✅ User flow completed successfully');

    // Compare screenshots against baselines
    // Use 5% threshold to account for minor rendering differences (fonts, antialiasing)
    console.log('\n--- Screenshot Comparison ---');
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

      // Assert screenshots match (skip if baseline missing - first run)
      if (!result.baselineMissing) {
        expect(result.match, `Screenshot ${name} should match baseline`).toBe(true);
      }
    }
  });
});
