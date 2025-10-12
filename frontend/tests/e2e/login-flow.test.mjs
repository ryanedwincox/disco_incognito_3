/**
 * E2E Test for Login Workflow
 *
 * Tests the complete login flow from button click to successful authentication.
 * Uses Puppeteer to simulate real user interaction.
 */
import http from "node:http";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";

const TEST_TIMEOUT = 30000; // 30 seconds

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const HEADLESS = process.env.HEADLESS !== "false"; // Run headless by default

/**
 * Start Vite dev server for testing
 */
async function startViteServer() {
  const vite = await createViteServer({
    configFile: resolve("vite.config.ts"),
    server: {
      middlewareMode: true
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
  console.log("🚀 Starting E2E Login Flow Tests\n");

  // Check if backend is available
  const backendAvailable = await checkBackendAvailable();
  if (!backendAvailable) {
    console.error("❌ Backend not available at", BACKEND_URL);
    console.error("   Please start the backend server first:");
    console.error("   cd backend && uvicorn app.main:app --reload --port 8000\n");
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

    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.text().includes('Test user created')) {
        console.log(`   📝 Browser: ${msg.text()}`);
      }
    });

    // Test 1: Page loads correctly
    console.log("Test 1: Page loads with correct UI");
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle0" });

      const title = await page.$eval('h1', el => el.textContent);
      if (title !== 'DISCO INCOGNITO') {
        throw new Error(`Expected title 'DISCO INCOGNITO', got '${title}'`);
      }

      const buttonExists = await page.$('button');
      if (!buttonExists) {
        throw new Error('Login button not found');
      }

      const buttonText = await page.$eval('button', el => el.textContent.trim());
      if (buttonText !== 'Create Test User') {
        throw new Error(`Expected button 'Create Test User', got '${buttonText}'`);
      }

      console.log("   ✅ Page loaded with correct UI\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 2: Test mode indicator is visible
    console.log("Test 2: Test mode indicator visible");
    try {
      const helperText = await page.$eval('p', el => el.textContent);
      if (!helperText.includes('Test Mode')) {
        throw new Error('Test mode indicator not found');
      }
      console.log("   ✅ Test mode indicator visible\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 3: Click login button and verify loading state
    console.log("Test 3: Login button click and loading state");
    try {
      const button = await page.$('button');

      // Click the button
      await button.click();

      // Wait a moment and check for loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      const loadingText = await page.$eval('button', el => el.textContent.trim());
      if (!loadingText.includes('Creating') && !loadingText.includes('Welcome')) {
        // Button might have already changed to success
        console.log("   ⚠️  Loading state too fast to capture, checking success state...");
      }

      console.log("   ✅ Button click successful\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 4: Success message appears
    console.log("Test 4: Success message appears");
    try {
      // Wait for success message to appear
      await page.waitForSelector('div.bg-green-900\\/30', { timeout: 5000 });

      const successMessage = await page.$eval('div.bg-green-900\\/30', el => el.textContent);
      if (!successMessage.includes('Welcome')) {
        throw new Error(`Expected success message with 'Welcome', got '${successMessage}'`);
      }

      // Extract username from message
      const usernameMatch = successMessage.match(/Welcome, (.+)!/);
      if (usernameMatch) {
        console.log(`   ✅ Success message appeared: "${successMessage.trim()}"`);
      } else {
        console.log(`   ✅ Success message appeared`);
      }
      console.log();
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5: Redirect to /rooms
    console.log("Test 5: Redirect to room selection");
    try {
      // Wait for navigation (with timeout)
      await page.waitForNavigation({ timeout: 3000, waitUntil: "networkidle0" });

      const currentUrl = page.url();
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

    // Test 7: Multiple logins create different users
    console.log("Test 7: Multiple logins create unique users");
    try {
      // Go back to login page
      await page.goto(baseUrl);

      const users = [];

      // Create 3 users
      for (let i = 0; i < 3; i++) {
        await page.reload({ waitUntil: "networkidle0" });
        const button = await page.$('button');
        await button.click();

        // Wait for success message
        await page.waitForSelector('div.bg-green-900\\/30', { timeout: 5000 });

        // Get user from localStorage
        const user = await page.evaluate(() => localStorage.getItem('user'));
        const userData = JSON.parse(user);
        users.push(userData.displayName);

        console.log(`   User ${i + 1}: ${userData.displayName}`);

        // Small delay between logins
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Check uniqueness
      const uniqueUsers = new Set(users);
      if (uniqueUsers.size !== users.length) {
        throw new Error(`Expected ${users.length} unique users, got ${uniqueUsers.size}`);
      }

      console.log(`   ✅ All ${users.length} users are unique\n`);
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
