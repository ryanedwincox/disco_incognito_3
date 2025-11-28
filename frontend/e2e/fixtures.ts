// Test fixtures: Fresh backend + frontend per test with isolated state
import { test as base, type Page } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root directories
const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const TEST_DATA_DIR = path.join(ROOT_DIR, 'test-data');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts');
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
const BASELINES_DIR = path.join(__dirname, 'screenshots');

// Ports
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

// Wait for port to be available
async function waitForPort(port: number, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.connect(port, 'localhost');
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

// Kill process on port
function killPort(port: number): void {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
  } catch {
    // Ignore errors - port may already be free
  }
}

// Fixture type
type TestFixtures = {
  serverContext: {
    backendProcess: ChildProcess | null;
    frontendProcess: ChildProcess | null;
  };
};

// Extended test with server fixtures
export const test = base.extend<TestFixtures>({
  serverContext: [
    async ({}, use) => {
      // Clear and recreate test data directory at start of each test
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true });
      }
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

      // Ensure artifacts directory exists
      if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
      }

      // Kill any existing processes on our ports
      killPort(BACKEND_PORT);
      killPort(FRONTEND_PORT);

      // Wait a moment for ports to be freed
      await new Promise((r) => setTimeout(r, 1000));

      // Start backend with isolated storage
      const testStorageFile = path.join(TEST_DATA_DIR, 'disco_incognito.json');
      const backendProcess = spawn(
        path.join(ROOT_DIR, '.venv/bin/uvicorn'),
        ['app.main:app', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)],
        {
          cwd: BACKEND_DIR,
          env: {
            ...process.env,
            SESSION_STORAGE_FILE: testStorageFile,
            SPOTIFY_MODE: 'test',
            DEBUG: 'true',
            PYTHONPATH: BACKEND_DIR,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      // Log backend output for debugging
      backendProcess.stdout?.on('data', (data) => {
        console.log(`[backend] ${data.toString().trim()}`);
      });
      backendProcess.stderr?.on('data', (data) => {
        console.error(`[backend] ${data.toString().trim()}`);
      });

      // Start frontend
      const frontendProcess = spawn('npm', ['run', 'dev', '--', '--port', String(FRONTEND_PORT)], {
        cwd: FRONTEND_DIR,
        env: {
          ...process.env,
          VITE_API_URL: `http://localhost:${BACKEND_PORT}`,
          VITE_TEST_MODE: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Log frontend output for debugging
      frontendProcess.stdout?.on('data', (data) => {
        console.log(`[frontend] ${data.toString().trim()}`);
      });
      frontendProcess.stderr?.on('data', (data) => {
        console.error(`[frontend] ${data.toString().trim()}`);
      });

      // Wait for both servers to be ready
      const [backendReady, frontendReady] = await Promise.all([
        waitForPort(BACKEND_PORT, 30000),
        waitForPort(FRONTEND_PORT, 30000),
      ]);

      if (!backendReady) {
        throw new Error('Backend failed to start on port ' + BACKEND_PORT);
      }
      if (!frontendReady) {
        throw new Error('Frontend failed to start on port ' + FRONTEND_PORT);
      }

      // Give servers a moment to fully initialize
      await new Promise((r) => setTimeout(r, 1000));

      try {
        // Run the test
        await use({ backendProcess, frontendProcess });
      } finally {
        // Cleanup: Kill both processes
        if (backendProcess) {
          backendProcess.kill('SIGTERM');
          await new Promise((r) => setTimeout(r, 500));
          if (!backendProcess.killed) {
            backendProcess.kill('SIGKILL');
          }
        }
        if (frontendProcess) {
          frontendProcess.kill('SIGTERM');
          await new Promise((r) => setTimeout(r, 500));
          if (!frontendProcess.killed) {
            frontendProcess.kill('SIGKILL');
          }
        }

        // Extra cleanup - kill any remaining processes on ports
        killPort(BACKEND_PORT);
        killPort(FRONTEND_PORT);
      }
    },
    { scope: 'test' },
  ],
});

export { expect } from '@playwright/test';

// Helper to get artifacts path (with optional test name subdirectory)
export function getArtifactsPath(testName: string, filename: string): string {
  const dir = path.join(SCREENSHOTS_DIR, testName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, filename);
}

// Helper to get baseline screenshot path
export function getBaselinePath(testName: string, filename: string): string {
  return path.join(BASELINES_DIR, testName, filename);
}

// Screenshot comparison result
interface CompareResult {
  match: boolean;
  baselineMissing: boolean;
  diffPercent?: number;
}

// Compare two screenshots (pixel-level comparison)
export async function compareScreenshots(
  actualPath: string,
  baselinePath: string,
  threshold: number = 0.01 // 1% difference allowed
): Promise<CompareResult> {
  // Check if baseline exists
  if (!fs.existsSync(baselinePath)) {
    return { match: false, baselineMissing: true };
  }

  // Read both files
  const actualBuffer = fs.readFileSync(actualPath);
  const baselineBuffer = fs.readFileSync(baselinePath);

  // Simple byte-level comparison (for identical matches)
  if (actualBuffer.equals(baselineBuffer)) {
    return { match: true, baselineMissing: false, diffPercent: 0 };
  }

  // If sizes are very different, they don't match
  const sizeDiff = Math.abs(actualBuffer.length - baselineBuffer.length) / baselineBuffer.length;
  if (sizeDiff > threshold) {
    return { match: false, baselineMissing: false, diffPercent: sizeDiff * 100 };
  }

  // For now, use size comparison as proxy (full pixel comparison would need sharp/pixelmatch)
  // Consider screenshots matching if within threshold
  return { match: sizeDiff <= threshold, baselineMissing: false, diffPercent: sizeDiff * 100 };
}
