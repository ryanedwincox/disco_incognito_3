/**
 * E2E Test for Room Selection and Playback Test
 *
 * Tests all buttons and navigation on:
 * - Room Selection page (Create Room, Join Room, Test Playback)
 * - Test Playback page (Back to Login button)
 */
import http from "node:http";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";

const TEST_TIMEOUT = 30000; // 30 seconds

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9000";
const HEADLESS = process.env.HEADLESS !== "false"; // Run headless by default

/**
 * Start Vite dev server for testing
 */
async function startViteServer() {
  const vite = await createViteServer({
    configFile: resolve("vite.config.ts"),
    server: {
      middlewareMode: true
    },
    // Pass BACKEND_URL to Vite so frontend uses the correct API URL
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(BACKEND_URL)
    }
  });

  const httpServer = http.createServer((req, res) => {
    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end("Not found");
    });
  });

  await new Promise((resolvePromise) => {
    httpServer.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { vite, httpServer, baseUrl };
}

/**
 * Check if backend is available
 */
async function checkBackendAvailable() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Run all E2E tests
 */
async function runTests() {
  console.log("🚀 Starting E2E Room Selection Tests\n");

  // Check if backend is available (optional for these tests)
  const backendAvailable = await checkBackendAvailable();
  if (backendAvailable) {
    console.log("✅ Backend is running\n");
  } else {
    console.log("ℹ️  Backend not running (not required for these tests)\n");
  }

  // Start Vite server
  console.log("Starting Vite dev server...");
  const { vite, httpServer, baseUrl } = await startViteServer();
  console.log(`✅ Frontend running at ${baseUrl}\n`);

  let browser;
  let passed = 0;
  let failed = 0;

  try {
    // Launch browser
    const launchOptions = {
      headless: HEADLESS ? "new" : false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set mobile viewport
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });

    // Test 1: Navigate to room selection page
    console.log("Test 1: Navigate to room selection page");
    try {
      await page.goto(`${baseUrl}/rooms`, { waitUntil: "networkidle0" });

      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Choose Your Room')) {
        throw new Error(`Expected heading 'Choose Your Room', got '${heading}'`);
      }

      console.log("   ✅ Room selection page loaded successfully\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 2: Create Room button exists and is clickable
    console.log("Test 2: Create Room button exists and is clickable");
    try {
      // Check if button is visible and enabled
      const isVisible = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Create Room'));
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !btn.disabled;
      });

      if (!isVisible) {
        throw new Error('Create Room button is not visible or is disabled');
      }

      console.log("   ✅ Create Room button is present and clickable\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 3: Create Room button navigates to room lobby
    console.log("Test 3: Create Room button navigates to room lobby");
    try {
      // Authenticate first - room creation requires Bearer token auth
      const loginResponse = await fetch(`${BACKEND_URL}/api/auth/test-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!loginResponse.ok) {
        throw new Error(`Failed to authenticate: ${loginResponse.status}`);
      }

      const loginData = await loginResponse.json();

      // Store auth tokens in localStorage
      await page.evaluate((data) => {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify({
          id: data.user_id,
          displayName: data.display_name,
          email: data.email
        }));
      }, loginData);

      // Navigate back to room selection (with auth now in localStorage)
      await page.goto(`${baseUrl}/rooms`, { waitUntil: "networkidle0" });

      // Wait a moment for Pinia store to load from localStorage
      await new Promise(resolve => setTimeout(resolve, 500));

      // Click Create Room button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Create Room'));
        if (btn) {
          btn.click();
        }
      });

      // Wait for URL to change to /rooms/### pattern (async API call + navigation)
      await page.waitForFunction(
        () => /^\/rooms\/\d{3}$/.test(window.location.pathname),
        { timeout: 10000 }
      );

      const currentUrl = page.url();
      const urlPath = new URL(currentUrl).pathname;

      // Should navigate to /rooms/:code format
      if (!urlPath.match(/^\/rooms\/\d{3}$/)) {
        throw new Error(`Expected URL pattern '/rooms/###', got '${urlPath}'`);
      }

      console.log(`   ✅ Create Room navigated to ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 4: Room code input field exists
    console.log("Test 4: Room code input field exists");
    try {
      // Navigate back to room selection
      await page.goto(`${baseUrl}/rooms`, { waitUntil: "networkidle0" });

      const input = await page.$('#room-code');
      if (!input) {
        throw new Error('Room code input not found');
      }

      // Check maxlength attribute
      const maxLength = await page.$eval('#room-code', el => el.getAttribute('maxlength'));
      if (maxLength !== '3') {
        throw new Error(`Expected maxlength='3', got '${maxLength}'`);
      }

      console.log("   ✅ Room code input exists with correct attributes\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5: Join Room button exists and is clickable
    console.log("Test 5: Join Room button exists and is clickable");
    try {
      const isVisible = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Join Room'));
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !btn.disabled;
      });

      if (!isVisible) {
        throw new Error('Join Room button is not visible or is disabled');
      }

      console.log("   ✅ Join Room button is present and clickable\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 6: Test Playback button navigates to /test
    console.log("Test 6: Test Playback button navigates to /test");
    try {
      // Click button and wait for navigation simultaneously
      await Promise.all([
        page.waitForNavigation({ timeout: 5000, waitUntil: "networkidle0" }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('Test Playback'));
          if (btn) {
            btn.click();
          }
        })
      ]);

      const currentUrl = page.url();
      if (!currentUrl.includes('/test')) {
        throw new Error(`Expected URL to contain '/test', got '${currentUrl}'`);
      }

      console.log(`   ✅ Navigated to ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 7: Playback test page loads correctly
    console.log("Test 7: Playback test page loads correctly");
    try {
      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Playback Test')) {
        throw new Error(`Expected heading 'Playback Test', got '${heading}'`);
      }

      // Check for search input
      const searchInput = await page.$('input[type="search"]');
      if (!searchInput) {
        throw new Error('Search input not found');
      }

      console.log("   ✅ Playback test page loaded with correct UI\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 8: Back button exists on playback test page
    console.log("Test 8: Back button exists on playback test page");
    try {
      const backButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Back to Room Selection'));
      });

      if (!backButton) {
        throw new Error('Back to Room Selection button not found');
      }

      console.log("   ✅ Back to Room Selection button is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 9: Back button navigates to /rooms
    console.log("Test 9: Back button navigates to /rooms");
    try {
      // Click button and wait for navigation simultaneously
      await Promise.all([
        page.waitForNavigation({ timeout: 5000, waitUntil: "networkidle0" }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('Back to Room Selection'));
          if (btn) {
            btn.click();
          }
        })
      ]);

      const currentUrl = page.url();
      // Should be at /rooms path
      const urlPath = new URL(currentUrl).pathname;
      if (urlPath !== '/rooms') {
        throw new Error(`Expected URL path '/rooms', got '${urlPath}'`);
      }

      // Verify we're on room selection page
      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Choose Your Room')) {
        throw new Error(`Expected to be on room selection page, but heading is '${heading}'`);
      }

      console.log(`   ✅ Navigated back to room selection page at ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 10: Room code input accepts exactly 3 characters
    console.log("Test 10: Room code input accepts exactly 3 characters");
    try {
      // Navigate back to room selection
      await page.goto(`${baseUrl}/rooms`, { waitUntil: "networkidle0" });

      const input = await page.$('#room-code');
      await input.click();
      await input.type('12345'); // Try to type 5 characters

      const value = await page.$eval('#room-code', el => el.value);
      if (value.length !== 3) {
        throw new Error(`Expected input length 3, got ${value.length} (value: '${value}')`);
      }

      if (value !== '123') {
        throw new Error(`Expected value '123', got '${value}'`);
      }

      console.log("   ✅ Room code input correctly limits to 3 characters\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 11: Search functionality on playback test page
    console.log("Test 11: Search functionality on playback test page");
    try {
      // First, authenticate by calling the test login endpoint
      const loginResponse = await fetch(`${BACKEND_URL}/api/auth/test-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!loginResponse.ok) {
        throw new Error(`Failed to authenticate: ${loginResponse.status}`);
      }

      const loginData = await loginResponse.json();

      // Store tokens in localStorage via page context
      await page.evaluate((data) => {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }, loginData);

      // Navigate to test page (will load auth from localStorage)
      await page.goto(`${baseUrl}/test`, { waitUntil: "networkidle0" });

      // Wait for the page to fully initialize with auth
      await new Promise(resolve => setTimeout(resolve, 300));

      const searchInput = await page.$('input[type="search"]');

      // Verify input is not disabled
      const isDisabled = await searchInput.evaluate(el => el.disabled);
      if (isDisabled) {
        throw new Error('Search input is disabled - authentication may have failed');
      }

      await searchInput.click();
      await searchInput.type('dance');

      // Wait for search results (debounced)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check for results
      const hasResults = await page.evaluate(() => {
        const resultsContainer = document.querySelector('div.bg-zinc-900.rounded-3xl');
        return resultsContainer && resultsContainer.textContent.includes('Search Results');
      });

      if (!hasResults) {
        throw new Error('Search results not displayed');
      }

      console.log("   ✅ Search functionality works correctly\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

  } catch (error) {
    console.error("❌ Test suite error:", error);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
    await vite.close();
    await new Promise((resolvePromise, rejectPromise) => {
      httpServer.close((error) => {
        if (error) {
          rejectPromise(error);
        } else {
          resolvePromise();
        }
      });
    });
  }

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log("=".repeat(50) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Test run failed", error);
  process.exit(1);
});
