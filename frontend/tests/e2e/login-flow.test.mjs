/**
 * E2E Test for Login Workflow
 *
 * Tests the complete login flow including Spotify and Guest login options.
 * Uses Puppeteer to simulate real user interaction.
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
    httpServer.listen(0, "localhost", resolvePromise);
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine server address");
  }

  const baseUrl = `http://localhost:${address.port}`;
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
  console.log("🚀 Starting E2E Login Flow Tests\n");

  // Check if backend is available
  const backendAvailable = await checkBackendAvailable();
  if (!backendAvailable) {
    console.error("❌ Backend not available at", BACKEND_URL);
    console.error("   Please start the backend server first with ./run.sh\n");
    process.exit(1);
  }
  console.log("✅ Backend is running\n");

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

    // Enable console logging from the page (only show user creation)
    page.on('console', msg => {
      if (msg.text().includes('user created') || msg.text().includes('Guest user')) {
        console.log(`   📝 Browser: ${msg.text()}`);
      }
    });

    // Test 1: Page loads with correct UI elements
    console.log("Test 1: Page loads with correct UI");
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle0" });

      const title = await page.$eval('h1', el => el.textContent);
      if (title !== 'DISCO INCOGNITO') {
        throw new Error(`Expected title 'DISCO INCOGNITO', got '${title}'`);
      }

      const buttons = await page.$$('button');
      if (buttons.length < 2) {
        throw new Error(`Expected at least 2 buttons, got ${buttons.length}`);
      }

      const buttonTexts = await page.$$eval('button', els => els.map(el => el.textContent.trim()));

      if (!buttonTexts.includes('Login with Spotify')) {
        throw new Error(`Expected 'Login with Spotify' button, got: ${buttonTexts.join(', ')}`);
      }

      if (!buttonTexts.includes('Continue as Guest')) {
        throw new Error(`Expected 'Continue as Guest' button, got: ${buttonTexts.join(', ')}`);
      }

      console.log("   ✅ Page loaded with correct UI\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 2: Guest info text is visible
    console.log("Test 2: Guest info text visible");
    try {
      const infoText = await page.$eval('p.text-xs', el => el.textContent);
      if (!infoText.includes('Guest users can join games but cannot select songs')) {
        throw new Error('Guest info text not found');
      }
      console.log("   ✅ Guest info text visible\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 3: Click "Continue as Guest" shows name input form
    console.log("Test 3: Guest button shows name input form");
    try {
      // Find and click the "Continue as Guest" button
      const buttons = await page.$$('button');
      let guestButton = null;
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent.trim());
        if (text === 'Continue as Guest') {
          guestButton = button;
          break;
        }
      }

      if (!guestButton) {
        throw new Error('Continue as Guest button not found');
      }

      await guestButton.click();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check for name input form
      const nameInput = await page.$('input#displayName');
      if (!nameInput) {
        throw new Error('Name input field not found');
      }

      const joinButton = await page.$eval('button', el => el.textContent.trim());
      if (!joinButton.includes('Join as Guest')) {
        throw new Error(`Expected 'Join as Guest' button, got '${joinButton}'`);
      }

      console.log("   ✅ Guest form displayed correctly\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 4: Enter name and submit guest login
    console.log("Test 4: Submit guest login with name");
    try {
      const nameInput = await page.$('input#displayName');
      await nameInput.type('Test Player');

      // Click the "Join as Guest" button
      const submitButton = await page.$('button.bg-disco-pink');
      await submitButton.click();

      // Wait for success message
      await page.waitForSelector('div.bg-green-900\\/30', { timeout: 5000 });

      const successMessage = await page.$eval('div.bg-green-900\\/30', el => el.textContent);
      if (!successMessage.includes('Welcome')) {
        throw new Error(`Expected success message with 'Welcome', got '${successMessage}'`);
      }

      console.log(`   ✅ Success message appeared: "${successMessage.trim()}"\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5: Redirect to /rooms
    console.log("Test 5: Redirect to room selection");
    try {
      // Poll for URL change
      const startTime = Date.now();
      const timeout = 5000;
      let currentUrl = page.url();

      while (!currentUrl.includes('/rooms') && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
        currentUrl = page.url();
      }

      if (!currentUrl.includes('/rooms')) {
        throw new Error(`Expected URL to contain '/rooms', got '${currentUrl}'`);
      }

      console.log(`   ✅ Redirected to ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 6: LocalStorage contains tokens
    console.log("Test 6: Tokens stored in localStorage");
    try {
      const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
      const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
      const user = await page.evaluate(() => localStorage.getItem('user'));

      if (!accessToken) {
        throw new Error('access_token not found in localStorage');
      }
      if (!refreshToken) {
        throw new Error('refresh_token not found in localStorage');
      }
      if (!user) {
        throw new Error('user not found in localStorage');
      }

      const userData = JSON.parse(user);
      console.log(`   ✅ Tokens stored: ${accessToken.substring(0, 20)}...`);
      console.log(`   ✅ User stored: ${userData.displayName}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 7: Back button returns to main login options
    console.log("Test 7: Back button returns to main options");
    try {
      // Go back to login page
      await page.goto(baseUrl, { waitUntil: "networkidle0" });

      // Click "Continue as Guest"
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent.trim());
        if (text === 'Continue as Guest') {
          await button.click();
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify we're in the guest form
      const nameInput = await page.$('input#displayName');
      if (!nameInput) {
        throw new Error('Name input not found after clicking Continue as Guest');
      }

      // Click back button
      const backButton = await page.$('button.text-zinc-400');
      if (!backButton) {
        throw new Error('Back button not found');
      }
      await backButton.click();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify we're back to main options
      const buttonTexts = await page.$$eval('button', els => els.map(el => el.textContent.trim()));
      if (!buttonTexts.includes('Login with Spotify')) {
        throw new Error('Login with Spotify button not found after going back');
      }
      if (!buttonTexts.includes('Continue as Guest')) {
        throw new Error('Continue as Guest button not found after going back');
      }

      console.log("   ✅ Back button works correctly\n");
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
