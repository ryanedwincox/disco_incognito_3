// Spotify login E2E test: Tests full login flow in test mode from login page to rooms redirect
import { test, expect, getArtifactsPath } from './fixtures';

test.describe('Spotify Login Flow', () => {
  test('should complete login flow and redirect to rooms', async ({ page, serverContext }) => {
    // Step 1: Navigate to login page
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Screenshot 1: Initial login page
    const initialScreenshot = getArtifactsPath('spotify-login-initial.png');
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`Screenshot saved to: ${initialScreenshot}`);

    // Step 2: Find and verify login button exists
    const loginButton = page.getByRole('button', { name: 'Login with Spotify' });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // Step 3: Click login button
    await loginButton.click();

    // Step 4: Wait for success message (green box with 'Welcome, [username]!')
    const successMessage = page.locator('.bg-green-900\\/30');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    await expect(successMessage).toContainText('Welcome,');

    // Screenshot 2: Success message visible
    const successScreenshot = getArtifactsPath('spotify-login-success.png');
    await page.screenshot({ path: successScreenshot, fullPage: true });
    console.log(`Screenshot saved to: ${successScreenshot}`);

    // Step 5: Wait for redirect to /rooms
    await page.waitForURL('**/rooms', { timeout: 10000 });

    // Step 6: Verify we're on the rooms page
    expect(page.url()).toContain('/rooms');

    // Screenshot 3: Rooms page after redirect
    await page.waitForLoadState('networkidle');
    const roomsScreenshot = getArtifactsPath('spotify-login-rooms.png');
    await page.screenshot({ path: roomsScreenshot, fullPage: true });
    console.log(`Screenshot saved to: ${roomsScreenshot}`);

    console.log('✅ Spotify login flow completed successfully');
  });
});
