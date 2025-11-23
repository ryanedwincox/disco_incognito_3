import http from "node:http";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";

const OUTPUT_DIR = resolve("tests/e2e/screenshots");

// Routes with different room scenarios for realistic screenshots
// Room codes correspond to test data seeding:
// 123: Empty lobby (1 player)
// 456: Lobby with 7 players, no songs
// 789: Lobby with 7 players and 3 song pairs (ready to play)
// 111: Playing state
// 222: Guessing state
// 333: Reveal state
const ROUTES = [
  { path: "/", label: "1a-login" },
  { path: "/", label: "1b-login-guest-form", action: "click-guest-login" },
  { path: "/rooms", label: "2-room-selection" },
  { path: "/test", label: "3-test-playback" },
  { path: "/rooms/123", label: "4a-room-lobby-empty" },
  { path: "/rooms/456", label: "4b-room-lobby-players" },
  { path: "/rooms/789", label: "4c-room-lobby-ready" },
  { path: "/rooms/789/songs", label: "5-song-picker" },
  { path: "/rooms/111/play", label: "6-game-playing" },
  { path: "/rooms/222/guess", label: "7-guessing" },
  { path: "/rooms/333/reveal", label: "8-reveal" },
  { path: "/test/server-disconnected", label: "9-error-server-disconnected" },
  { path: "/test/exception", label: "10-error-exceptions" }
];

async function ensureCleanDirectory() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
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
  // Seed test data via backend API
  // This creates rooms with realistic player and song data
  console.log("Seeding test data...");
  try {
    const response = await fetch("http://localhost:8000/api/testing/seed", {
      method: "POST"
    });
    if (!response.ok) {
      console.warn("Warning: Failed to seed test data. Screenshots may show empty states.");
    } else {
      const data = await response.json();
      console.log(`Test data seeded: ${data.rooms?.join(", ") || "unknown rooms"}`);
    }
  } catch (error) {
    console.warn("Warning: Could not connect to backend to seed test data:", error.message);
    console.warn("Make sure backend is running on http://localhost:8000");
  }
}

async function captureScreenshots(baseUrl) {
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

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  // Mobile viewport (iPhone 12/13 Pro dimensions)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });

  const report = [];

  for (const route of ROUTES) {
    const url = `${baseUrl}${route.path}`;
    console.log(`Capturing: ${route.label} - ${route.path}`);
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

    const filePath = join(OUTPUT_DIR, `${route.label}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    report.push({ route: route.path, file: filePath, viewport: "mobile" });
  }

  await browser.close();
  return report;
}

async function main() {
  await ensureCleanDirectory();

  // Seed test data before starting screenshot capture
  await seedTestData();

  const { vite, httpServer, baseUrl } = await startViteServer();

  try {
    const report = await captureScreenshots(baseUrl);
    const summaryPath = join(OUTPUT_DIR, "summary.json");
    await writeFile(summaryPath, JSON.stringify(report, null, 2));
    console.log(`\nScreenshots captured to ${OUTPUT_DIR}`);
    console.log(`Total screenshots: ${report.length}`);
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

main().catch((error) => {
  console.error("Screenshot run failed", error);
  process.exit(1);
});
