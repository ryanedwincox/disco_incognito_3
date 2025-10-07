import http from "node:http";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer";
import { createServer as createViteServer } from "vite";

const OUTPUT_DIR = resolve("tests/e2e/screenshots");
const ROUTES = [
  { path: "/", label: "login" },
  { path: "/rooms", label: "room-selection" },
  { path: "/rooms/123", label: "room-lobby" },
  { path: "/rooms/123/songs", label: "song-picker" },
  { path: "/rooms/123/play", label: "game" },
  { path: "/rooms/123/guess", label: "guessing" },
  { path: "/rooms/123/reveal", label: "reveal" }
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

async function captureScreenshots(baseUrl) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

  const report = [];

  for (const route of ROUTES) {
    const url = `${baseUrl}${route.path}`;
    await page.goto(url, { waitUntil: "networkidle0" });
    const filePath = join(OUTPUT_DIR, `${route.label}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    report.push({ route: route.path, file: filePath });
  }

  await browser.close();
  return report;
}

async function main() {
  await ensureCleanDirectory();
  const { vite, httpServer, baseUrl } = await startViteServer();

  try {
    const report = await captureScreenshots(baseUrl);
    const summaryPath = join(OUTPUT_DIR, "summary.json");
    await writeFile(summaryPath, JSON.stringify(report, null, 2));
    console.log(`Screenshots captured to ${OUTPUT_DIR}`);
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
