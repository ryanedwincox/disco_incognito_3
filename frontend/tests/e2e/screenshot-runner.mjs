import http from "node:http";
import { mkdir, rm, readFile, writeFile, access, readdir, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

// Configuration
const DIFF_THRESHOLD = 0.001; // 0.1% pixel difference allowed
const OUTPUT_DIR = resolve("tests/e2e/screenshots");
const BASELINE_DIR = join(OUTPUT_DIR, "baseline");
const BASELINE_HOST_DIR = join(BASELINE_DIR, "host");
const BASELINE_PLAYER_DIR = join(BASELINE_DIR, "player");
const CURRENT_DIR = join(OUTPUT_DIR, "current");
const CURRENT_HOST_DIR = join(CURRENT_DIR, "host");
const CURRENT_PLAYER_DIR = join(CURRENT_DIR, "player");
const DIFF_DIR = join(OUTPUT_DIR, "diff");
const DIFF_HOST_DIR = join(DIFF_DIR, "host");
const DIFF_PLAYER_DIR = join(DIFF_DIR, "player");

// Parse command line arguments
const UPDATE_MODE = process.argv.includes("--update") || process.argv.includes("--update-screenshots");

// Routes that need both host and player perspectives for dual-browser screenshots
// Room codes correspond to test data seeding with deterministic player IDs:
// 456: Lobby with 7 players, no songs (has host + player IDs)
// 789: Lobby with 7 players and 3 song pairs (has host + player IDs)
const DUAL_BROWSER_ROUTES = [
  { path: "/rooms/456", label: "4b-room-lobby-players", roomCode: "456" },
  { path: "/rooms/789", label: "4c-room-lobby-ready", roomCode: "789" },
];

// Routes that only need single browser (non-room or host-only views)
const SINGLE_BROWSER_ROUTES = [
  { path: "/", label: "1a-login" },
  { path: "/", label: "1b-login-guest-form", action: "click-guest-login" },
  { path: "/rooms", label: "2-room-selection" },
  { path: "/test", label: "3-test-playback" },
  { path: "/rooms/123", label: "4a-room-lobby-empty" },
  { path: "/rooms/789/songs", label: "5-song-picker" },
  { path: "/rooms/111/play", label: "6-game-playing" },
  { path: "/rooms/222/guess", label: "7-guessing" },
  { path: "/rooms/333/reveal", label: "8-reveal" },
  { path: "/test/server-disconnected", label: "9-error-server-disconnected" },
  { path: "/test/exception", label: "10-error-exceptions" }
];

async function ensureDirectories() {
  await mkdir(BASELINE_HOST_DIR, { recursive: true });
  await mkdir(BASELINE_PLAYER_DIR, { recursive: true });
  await mkdir(CURRENT_HOST_DIR, { recursive: true });
  await mkdir(CURRENT_PLAYER_DIR, { recursive: true });
  await mkdir(DIFF_HOST_DIR, { recursive: true });
  await mkdir(DIFF_PLAYER_DIR, { recursive: true });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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

async function seedTestData() {
  // Seed test data via backend API and get player IDs for localStorage injection
  console.log("Seeding test data...");
  try {
    const response = await fetch("http://localhost:8000/api/testing/seed", {
      method: "POST"
    });
    if (!response.ok) {
      console.warn("Warning: Failed to seed test data. Screenshots may show empty states.");
      return null;
    }
    const data = await response.json();
    console.log(`Test data seeded: ${data.rooms?.join(", ") || "unknown rooms"}`);
    if (data.player_ids) {
      console.log("Player IDs received for dual-browser testing:");
      for (const [roomCode, ids] of Object.entries(data.player_ids)) {
        console.log(`  Room ${roomCode}: host=${ids.host_id}, player=${ids.player_id || 'N/A'}`);
      }
    }
    return data;
  } catch (error) {
    console.warn("Warning: Could not connect to backend to seed test data:", error.message);
    console.warn("Make sure backend is running on http://localhost:8000");
    return null;
  }
}

async function createBrowser() {
  const launchOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  };

  // Use system Chromium if available (set via PUPPETEER_EXECUTABLE_PATH env var)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.launch(launchOptions);
}

async function captureSingleBrowserScreenshots(baseUrl, outputDir) {
  const browser = await createBrowser();
  const page = await browser.newPage();
  // Mobile viewport (iPhone 12/13 Pro dimensions)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });

  const captured = [];

  for (const route of SINGLE_BROWSER_ROUTES) {
    const url = `${baseUrl}${route.path}`;
    console.log(`Capturing (single): ${route.label} - ${route.path}`);
    await page.goto(url, { waitUntil: "networkidle0" });

    // Give a small delay for any animations to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Handle special actions
    if (route.action === "click-guest-login") {
      // Click the "Continue as Guest" button to show the name input form
      await page.click('button:has-text("Continue as Guest")').catch(() => {
        // Fallback: try to find by text content
        return page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const guestButton = buttons.find(b => b.textContent.includes('Continue as Guest'));
          if (guestButton) guestButton.click();
        });
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const filePath = join(outputDir, `${route.label}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    captured.push({ label: route.label, file: filePath, perspective: "host" });
  }

  await browser.close();
  return captured;
}

async function captureDualBrowserScreenshots(baseUrl, hostOutputDir, playerOutputDir, seedData) {
  if (!seedData?.player_ids) {
    console.warn("No player IDs available, skipping dual-browser screenshots");
    return [];
  }

  const captured = [];

  // Launch two browsers in parallel
  const [hostBrowser, playerBrowser] = await Promise.all([
    createBrowser(),
    createBrowser()
  ]);

  const hostPage = await hostBrowser.newPage();
  const playerPage = await playerBrowser.newPage();

  // Mobile viewport for both
  await Promise.all([
    hostPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 }),
    playerPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 })
  ]);

  for (const route of DUAL_BROWSER_ROUTES) {
    const roomIds = seedData.player_ids[route.roomCode];
    if (!roomIds) {
      console.warn(`No player IDs for room ${route.roomCode}, skipping`);
      continue;
    }

    const url = `${baseUrl}${route.path}`;
    console.log(`Capturing (dual): ${route.label} - ${route.path}`);

    // Navigate both browsers to the same room
    await Promise.all([
      hostPage.goto(url, { waitUntil: "networkidle0" }),
      playerPage.goto(url, { waitUntil: "networkidle0" })
    ]);

    // Wait for animations
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capture both perspectives simultaneously
    const hostFilePath = join(hostOutputDir, `${route.label}.png`);
    const playerFilePath = join(playerOutputDir, `${route.label}.png`);

    await Promise.all([
      hostPage.screenshot({ path: hostFilePath, fullPage: true }),
      playerPage.screenshot({ path: playerFilePath, fullPage: true })
    ]);

    captured.push(
      { label: route.label, file: hostFilePath, perspective: "host" },
      { label: route.label, file: playerFilePath, perspective: "player" }
    );
  }

  await Promise.all([
    hostBrowser.close(),
    playerBrowser.close()
  ]);

  return captured;
}

async function compareImages(baselinePath, currentPath, diffPath) {
  const baselineBuffer = await readFile(baselinePath);
  const currentBuffer = await readFile(currentPath);

  const baselinePng = PNG.sync.read(baselineBuffer);
  const currentPng = PNG.sync.read(currentBuffer);

  // Check dimensions match
  if (baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height) {
    return {
      match: false,
      error: `Dimension mismatch: baseline ${baselinePng.width}x${baselinePng.height} vs current ${currentPng.width}x${currentPng.height}`,
      diffPixels: -1,
      totalPixels: -1,
      diffPercent: 100
    };
  }

  const { width, height } = baselinePng;
  const totalPixels = width * height;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 } // Per-pixel sensitivity
  );

  const diffPercent = (diffPixels / totalPixels) * 100;
  const match = diffPercent <= (DIFF_THRESHOLD * 100);

  // Save diff image if there are differences
  if (diffPixels > 0) {
    const diffBuffer = PNG.sync.write(diffPng);
    await writeFile(diffPath, diffBuffer);
  }

  return {
    match,
    diffPixels,
    totalPixels,
    diffPercent
  };
}

async function runUpdateMode() {
  console.log("=== Screenshot Update Mode (Dual-Browser) ===");
  console.log("Regenerating baseline screenshots...\n");

  await ensureDirectories();

  // Clear existing baselines
  for (const dir of [BASELINE_HOST_DIR, BASELINE_PLAYER_DIR]) {
    const existingFiles = await readdir(dir).catch(() => []);
    for (const file of existingFiles) {
      if (file.endsWith(".png")) {
        await rm(join(dir, file));
      }
    }
  }

  const seedData = await seedTestData();
  const { vite, httpServer, baseUrl } = await startViteServer();

  try {
    // Capture single browser screenshots (to host dir)
    const singleCaptured = await captureSingleBrowserScreenshots(baseUrl, BASELINE_HOST_DIR);

    // Capture dual browser screenshots
    const dualCaptured = await captureDualBrowserScreenshots(baseUrl, BASELINE_HOST_DIR, BASELINE_PLAYER_DIR, seedData);

    const allCaptured = [...singleCaptured, ...dualCaptured];

    console.log(`\n=== Baseline Screenshots Updated ===`);
    console.log(`Total screenshots: ${allCaptured.length}`);
    console.log(`Host screenshots: ${BASELINE_HOST_DIR}`);
    console.log(`Player screenshots: ${BASELINE_PLAYER_DIR}`);

    // Write summary
    const summary = {
      updated: new Date().toISOString(),
      screenshots: allCaptured.map(c => ({ label: c.label, perspective: c.perspective }))
    };
    await writeFile(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

    return 0;
  } finally {
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
}

async function runComparisonMode() {
  console.log("=== Screenshot Comparison Mode (Dual-Browser) ===");
  console.log(`Threshold: ${DIFF_THRESHOLD * 100}% pixel difference allowed\n`);

  await ensureDirectories();

  // Check if baselines exist
  const hostBaselineFiles = await readdir(BASELINE_HOST_DIR).catch(() => []);
  const playerBaselineFiles = await readdir(BASELINE_PLAYER_DIR).catch(() => []);
  const hostBaselinePngs = hostBaselineFiles.filter(f => f.endsWith(".png"));
  const playerBaselinePngs = playerBaselineFiles.filter(f => f.endsWith(".png"));

  if (hostBaselinePngs.length === 0) {
    console.error("ERROR: No baseline screenshots found.");
    console.error("Run with --update-screenshots to generate baselines first.");
    return 1;
  }

  console.log(`Found ${hostBaselinePngs.length} host baseline screenshots`);
  console.log(`Found ${playerBaselinePngs.length} player baseline screenshots\n`);

  // Clear current and diff directories
  for (const dir of [CURRENT_HOST_DIR, CURRENT_PLAYER_DIR, DIFF_HOST_DIR, DIFF_PLAYER_DIR]) {
    const files = await readdir(dir).catch(() => []);
    for (const file of files) {
      if (file.endsWith(".png")) {
        await rm(join(dir, file));
      }
    }
  }

  const seedData = await seedTestData();
  const { vite, httpServer, baseUrl } = await startViteServer();

  let exitCode = 0;
  const results = [];

  try {
    // Capture current screenshots
    const singleCaptured = await captureSingleBrowserScreenshots(baseUrl, CURRENT_HOST_DIR);
    const dualCaptured = await captureDualBrowserScreenshots(baseUrl, CURRENT_HOST_DIR, CURRENT_PLAYER_DIR, seedData);
    const allCaptured = [...singleCaptured, ...dualCaptured];

    console.log("\n=== Comparing Screenshots ===\n");

    for (const { label, file, perspective } of allCaptured) {
      const baselineDir = perspective === "player" ? BASELINE_PLAYER_DIR : BASELINE_HOST_DIR;
      const diffDir = perspective === "player" ? DIFF_PLAYER_DIR : DIFF_HOST_DIR;

      const baselinePath = join(baselineDir, `${label}.png`);
      const diffPath = join(diffDir, `${label}-diff.png`);

      const hasBaseline = await fileExists(baselinePath);

      if (!hasBaseline) {
        console.log(`⚠️  ${label} (${perspective}): NO BASELINE (new screenshot)`);
        results.push({ label, perspective, status: "new" });
        exitCode = 1;
        continue;
      }

      const comparison = await compareImages(baselinePath, file, diffPath);

      if (comparison.error) {
        console.log(`❌ ${label} (${perspective}): ${comparison.error}`);
        results.push({ label, perspective, status: "error", error: comparison.error });
        exitCode = 1;
      } else if (comparison.match) {
        console.log(`✅ ${label} (${perspective}): MATCH (${comparison.diffPixels} pixels differ, ${comparison.diffPercent.toFixed(4)}%)`);
        results.push({ label, perspective, status: "match", ...comparison });
      } else {
        console.log(`❌ ${label} (${perspective}): MISMATCH (${comparison.diffPixels} pixels differ, ${comparison.diffPercent.toFixed(4)}%)`);
        console.log(`   Diff saved to: ${diffPath}`);
        results.push({ label, perspective, status: "mismatch", ...comparison });
        exitCode = 1;
      }
    }

    // Summary
    const passed = results.filter(r => r.status === "match").length;
    const failed = results.filter(r => r.status === "mismatch").length;
    const errors = results.filter(r => r.status === "error" || r.status === "new").length;

    console.log("\n=== Summary ===");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Errors/New: ${errors}`);

    if (exitCode !== 0) {
      console.log("\nRun with --update-screenshots to update baselines if changes are intentional.");
    }

    // Write results
    await writeFile(join(OUTPUT_DIR, "comparison-results.json"), JSON.stringify({
      timestamp: new Date().toISOString(),
      threshold: DIFF_THRESHOLD,
      results,
      summary: { passed, failed, errors }
    }, null, 2));

  } finally {
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

  return exitCode;
}

async function main() {
  const exitCode = UPDATE_MODE ? await runUpdateMode() : await runComparisonMode();
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("Screenshot run failed", error);
  process.exit(1);
});
