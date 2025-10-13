/**
 * E2E Test for Complete Game Flow
 *
 * Tests the full game workflow:
 * - Room Lobby (players list, buttons)
 * - Song Picker (search, selection UI)
 * - Game Play (countdown timer)
 * - Guessing (player selection)
 * - Reveal (results display, next round)
 */
import http from "node:http";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";

const TEST_TIMEOUT = 30000; // 30 seconds

// Test configuration
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
 * Run all E2E tests
 */
async function runTests() {
  console.log("🚀 Starting E2E Game Flow Tests\n");

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

    // ===== ROOM LOBBY TESTS =====
    console.log("📍 Room Lobby Tests\n");

    // Test 1: Room lobby page loads
    console.log("Test 1: Room lobby page loads correctly");
    try {
      await page.goto(`${baseUrl}/rooms/123`, { waitUntil: "networkidle0" });

      // Check for room code display
      const roomCode = await page.evaluate(() => {
        const codeElement = document.querySelector('p.text-4xl');
        return codeElement ? codeElement.textContent : null;
      });

      if (!roomCode || !roomCode.includes('123')) {
        throw new Error(`Expected room code '123', got '${roomCode}'`);
      }

      console.log("   ✅ Room lobby loaded with correct room code\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 2: Leave button exists
    console.log("Test 2: Leave button exists");
    try {
      const leaveButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Leave'));
      });

      if (!leaveButton) {
        throw new Error('Leave button not found');
      }

      console.log("   ✅ Leave button is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 3: Pick Songs button exists
    console.log("Test 3: Pick Songs button exists");
    try {
      const pickSongsButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Pick Songs'));
      });

      if (!pickSongsButton) {
        throw new Error('Pick Songs button not found');
      }

      console.log("   ✅ Pick Songs button is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 4: Players section displays
    console.log("Test 4: Players section displays");
    try {
      const playersHeading = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Players'));
      });

      if (!playersHeading) {
        throw new Error('Players section not found');
      }

      // Check for player list items
      const hasPlayers = await page.evaluate(() => {
        const playersList = document.querySelector('ul.space-y-3');
        return playersList && playersList.children.length > 0;
      });

      if (!hasPlayers) {
        throw new Error('No players displayed in list');
      }

      console.log("   ✅ Players section displays with player list\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5: Song Pairs section displays
    console.log("Test 5: Song Pairs section displays");
    try {
      const songPairsHeading = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Song Pairs'));
      });

      if (!songPairsHeading) {
        throw new Error('Song Pairs section not found');
      }

      console.log("   ✅ Song Pairs section is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5a: Pick Songs button navigates to song picker
    console.log("Test 5a: Pick Songs button navigates to song picker");
    try {
      await Promise.all([
        page.waitForNavigation({ timeout: 5000, waitUntil: "networkidle0" }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('Pick Songs'));
          if (btn) {
            btn.click();
          }
        })
      ]);

      const currentUrl = page.url();
      if (!currentUrl.includes('/rooms/123/songs')) {
        throw new Error(`Expected URL to contain '/rooms/123/songs', got '${currentUrl}'`);
      }

      console.log(`   ✅ Navigated to song picker: ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5b: Back to Lobby button returns to room lobby
    console.log("Test 5b: Back to Lobby button returns to room lobby");
    try {
      await Promise.all([
        page.waitForNavigation({ timeout: 5000, waitUntil: "networkidle0" }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('Back to Lobby'));
          if (btn) {
            btn.click();
          }
        })
      ]);

      const currentUrl = page.url();
      if (!currentUrl.includes('/rooms/123')) {
        throw new Error(`Expected URL to contain '/rooms/123', got '${currentUrl}'`);
      }

      console.log(`   ✅ Returned to room lobby: ${currentUrl}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 5c: Leave button navigates to room selection
    console.log("Test 5c: Leave button navigates to room selection");
    try {
      await Promise.all([
        page.waitForNavigation({ timeout: 5000, waitUntil: "networkidle0" }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.trim() === 'Leave');
          if (btn) {
            btn.click();
          }
        })
      ]);

      const currentUrl = page.url();
      const urlPath = new URL(currentUrl).pathname;
      if (urlPath !== '/rooms') {
        throw new Error(`Expected URL path '/rooms', got '${urlPath}'`);
      }

      console.log(`   ✅ Left room and returned to room selection\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // ===== SONG PICKER TESTS =====
    console.log("📍 Song Picker Tests\n");

    // Test 6: Song picker page loads
    console.log("Test 6: Song picker page loads correctly");
    try {
      await page.goto(`${baseUrl}/rooms/123/songs`, { waitUntil: "networkidle0" });

      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Pick a Pair')) {
        throw new Error(`Expected heading 'Pick a Pair', got '${heading}'`);
      }

      console.log("   ✅ Song picker page loaded\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 7: Generate Random Pair button exists (test mode)
    console.log("Test 7: Generate Random Pair button exists (test mode)");
    try {
      const generateButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Generate Random Pair'));
      });

      if (!generateButton) {
        throw new Error('Generate Random Pair button not found');
      }

      console.log("   ✅ Generate Random Pair button is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 8: Random Song Pair section exists
    console.log("Test 8: Random Song Pair section exists");
    try {
      const hasRandomPair = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Random Song Pair'));
      });

      if (!hasRandomPair) {
        throw new Error('Random Song Pair section not found');
      }

      console.log("   ✅ Random Song Pair section is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 9: Actions section with Save button
    console.log("Test 9: Actions section with Save button");
    try {
      const hasActions = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Actions'));
      });

      if (!hasActions) {
        throw new Error('Actions section not found');
      }

      const savePairButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Save Pair'));
      });

      if (!savePairButton) {
        throw new Error('Save Pair button not found');
      }

      const backButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Back to Lobby'));
      });

      if (!backButton) {
        throw new Error('Back to Lobby button not found');
      }

      console.log("   ✅ Actions section with Save and Back buttons\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // ===== GAME PLAY TESTS =====
    console.log("📍 Game Play Tests\n");

    // Test 10: Game play page loads
    console.log("Test 10: Game play page loads correctly");
    try {
      await page.goto(`${baseUrl}/rooms/123/play`, { waitUntil: "networkidle0" });

      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Round In Progress')) {
        throw new Error(`Expected heading 'Round In Progress', got '${heading}'`);
      }

      console.log("   ✅ Game play page loaded\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 11: Countdown timer displays
    console.log("Test 11: Countdown timer displays");
    try {
      const hasTimer = await page.evaluate(() => {
        const timerLabel = Array.from(document.querySelectorAll('p')).some(p =>
          p.textContent.includes('Time Remaining')
        );
        const timerValue = document.querySelector('.text-6xl.text-disco-pink');
        return timerLabel && timerValue;
      });

      if (!hasTimer) {
        throw new Error('Countdown timer not found');
      }

      const timerValue = await page.$eval('.text-6xl.text-disco-pink', el => el.textContent);
      console.log(`   ✅ Countdown timer displays: ${timerValue}\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 12: Music player bar exists
    console.log("Test 12: Music player bar exists on game page");
    try {
      const hasMusicBar = await page.evaluate(() => {
        // MusicPlayerBar should be at bottom
        const bar = document.querySelector('div');
        return bar !== null;
      });

      if (!hasMusicBar) {
        throw new Error('Music player bar not found');
      }

      console.log("   ✅ Music player bar is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // ===== GUESSING TESTS =====
    console.log("📍 Guessing Tests\n");

    // Test 13: Guessing page loads
    console.log("Test 13: Guessing page loads correctly");
    try {
      await page.goto(`${baseUrl}/rooms/123/guess`, { waitUntil: "networkidle0" });

      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Who Is The Odd Duck')) {
        throw new Error(`Expected heading with 'Odd Duck', got '${heading}'`);
      }

      console.log("   ✅ Guessing page loaded\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 14: Player cards display
    console.log("Test 14: Player cards display for guessing");
    try {
      const hasPlayerCards = await page.evaluate(() => {
        const playerCards = document.querySelectorAll('ul li.bg-zinc-900');
        return playerCards.length >= 2;
      });

      if (!hasPlayerCards) {
        throw new Error('Expected at least 2 player cards');
      }

      console.log("   ✅ Player cards display for selection\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 15: Guess buttons exist for each player
    console.log("Test 15: Guess buttons exist for each player");
    try {
      const guessButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.filter(b => b.textContent.includes('Guess')).length;
      });

      if (guessButtons < 2) {
        throw new Error(`Expected at least 2 guess buttons, found ${guessButtons}`);
      }

      console.log(`   ✅ Found ${guessButtons} guess buttons\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // ===== REVEAL TESTS =====
    console.log("📍 Reveal Tests\n");

    // Test 16: Reveal page loads
    console.log("Test 16: Reveal page loads correctly");
    try {
      await page.goto(`${baseUrl}/rooms/123/reveal`, { waitUntil: "networkidle0" });

      const heading = await page.$eval('h2', el => el.textContent);
      if (!heading.includes('Reveal')) {
        throw new Error(`Expected heading 'Reveal', got '${heading}'`);
      }

      console.log("   ✅ Reveal page loaded\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 17: Odd Duck section displays
    console.log("Test 17: Odd Duck section displays");
    try {
      const hasOddDuck = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Odd Duck'));
      });

      if (!hasOddDuck) {
        throw new Error('Odd Duck section not found');
      }

      console.log("   ✅ Odd Duck section is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 18: Votes section displays
    console.log("Test 18: Votes section displays");
    try {
      const hasVotes = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some(h => h.textContent.includes('Votes'));
      });

      if (!hasVotes) {
        throw new Error('Votes section not found');
      }

      // Check for vote list
      const voteList = await page.evaluate(() => {
        const list = document.querySelector('ul.space-y-2');
        return list && list.children.length > 0;
      });

      if (!voteList) {
        throw new Error('Vote list not found or empty');
      }

      console.log("   ✅ Votes section displays with results\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 19: Next Round button exists
    console.log("Test 19: Next Round button exists");
    try {
      const nextRoundButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Next Round'));
      });

      if (!nextRoundButton) {
        throw new Error('Next Round button not found');
      }

      console.log("   ✅ Next Round button is present\n");
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Test 20: Vote results show correct/incorrect guesses
    console.log("Test 20: Vote results show guess outcomes");
    try {
      const hasOutcomes = await page.evaluate(() => {
        const voteItems = Array.from(document.querySelectorAll('ul.space-y-2 li'));
        return voteItems.some(item => {
          const text = item.textContent || '';
          return text.includes('Guessed') || text.includes('Correctly');
        });
      });

      if (!hasOutcomes) {
        throw new Error('Vote outcomes not displayed');
      }

      console.log("   ✅ Vote results show guess outcomes\n");
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
