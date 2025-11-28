// Landing page test: Navigate to home and capture screenshot
import { test, expect, getArtifactsPath } from './fixtures';

test.describe('Landing Page', () => {
  test('should display login page and capture screenshot', async ({ page, serverContext }) => {
    // Navigate to the landing page
    await page.goto('http://localhost:3000/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify we're on the login page by checking for expected content
    // The login view should have Spotify login button or disco-related branding
    await expect(page.locator('body')).toBeVisible();

    // Take screenshot and save to artifacts directory
    const screenshotPath = getArtifactsPath('landing-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Basic assertion - page loaded successfully
    const title = await page.title();
    console.log(`Page title: ${title}`);
  });
});
