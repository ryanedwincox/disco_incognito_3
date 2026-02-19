// Test fixtures: Fresh backend + frontend per test with isolated state
import { test as base } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

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
const VENV_PYTHON = path.join(ROOT_DIR, '.venv', 'bin', 'python3');

// For worktrees, use main repo's .venv (worktrees share the same .venv)
// Worktrees have a .git file (not directory) pointing to gitdir
function getMainRepoDir(): string {
  const gitPath = path.join(ROOT_DIR, '.git');
  if (fs.existsSync(gitPath) && fs.statSync(gitPath).isFile()) {
    // Worktree: .git is a file containing "gitdir: /path/to/.git/worktrees/name"
    const gitContent = fs.readFileSync(gitPath, 'utf-8').trim();
    const match = gitContent.match(/^gitdir:\s*(.+)$/);
    if (match) {
      // Go from .git/worktrees/name to .git to main repo
      return path.resolve(match[1], '..', '..', '..');
    }
  }
  return ROOT_DIR;
}
// Note: getMainRepoDir() available if needed for worktree .venv resolution
void getMainRepoDir; // Suppress unused warning - kept for future use

// Port configuration: Use environment variables or feature branch defaults (9000/9100)
// Main branch uses 8000/3000, feature branches use 9000/9100 to avoid conflicts
const BACKEND_PORT = parseInt(process.env.PORT || '9000', 10);
const FRONTEND_PORT = parseInt(process.env.VITE_PORT || '9100', 10);

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
    // eslint-disable-next-line no-empty-pattern
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
      // Use venv python directly for reproducible environment
      const testStorageFile = path.join(TEST_DATA_DIR, 'disco_incognito.json');
      const pythonPath = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
      const backendProcess = spawn(
        pythonPath,
        ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)],
        {
          cwd: BACKEND_DIR,
          env: {
            ...process.env,
            SESSION_STORAGE_FILE: testStorageFile,
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

// Helper to get list of baseline screenshots for a test
export function getBaselineScreenshots(testName: string): string[] {
  const baselineDir = path.join(BASELINES_DIR, testName);
  if (!fs.existsSync(baselineDir)) {
    return [];
  }
  return fs.readdirSync(baselineDir).filter((f) => f.endsWith('.png')).sort();
}

// Screenshot comparison result
interface CompareResult {
  match: boolean;
  baselineMissing: boolean;
  diffPercent?: number;
}

// Compare two screenshots using pixelmatch for pixel-level comparison
export async function compareScreenshots(
  actualPath: string,
  baselinePath: string,
  threshold: number = 0.05 // 5% difference allowed by default
): Promise<CompareResult> {
  // Check if baseline exists
  if (!fs.existsSync(baselinePath)) {
    return { match: false, baselineMissing: true };
  }

  // Read both files
  const actualBuffer = fs.readFileSync(actualPath);
  const baselineBuffer = fs.readFileSync(baselinePath);

  // Quick check: if files are byte-identical, skip pixel comparison
  if (actualBuffer.equals(baselineBuffer)) {
    console.log(`  [pixelmatch] ${path.basename(actualPath)}: identical files, 0% diff`);
    return { match: true, baselineMissing: false, diffPercent: 0 };
  }

  // Decode PNG images
  let actualPng, baselinePng;
  try {
    actualPng = PNG.sync.read(actualBuffer);
    baselinePng = PNG.sync.read(baselineBuffer);
  } catch (err) {
    // Baseline might be a Git LFS pointer or corrupted file
    console.log(`  [pixelmatch] ${path.basename(actualPath)}: invalid PNG (possibly Git LFS pointer), skipping comparison`);
    return { match: false, baselineMissing: true };
  }

  // Check dimensions match
  if (actualPng.width !== baselinePng.width || actualPng.height !== baselinePng.height) {
    const diffPercent = 100; // Different dimensions = 100% diff
    console.log(
      `  [pixelmatch] ${path.basename(actualPath)}: dimension mismatch ` +
        `(${actualPng.width}x${actualPng.height} vs ${baselinePng.width}x${baselinePng.height})`
    );
    return { match: false, baselineMissing: false, diffPercent };
  }

  // Run pixel-by-pixel comparison
  const { width, height } = actualPng;
  const totalPixels = width * height;
  const diffPixels = pixelmatch(actualPng.data, baselinePng.data, null, width, height, {
    threshold: 0.1, // pixelmatch per-pixel sensitivity (0-1, lower = stricter)
  });

  const diffPercent = (diffPixels / totalPixels) * 100;
  const match = diffPercent <= threshold * 100;

  console.log(
    `  [pixelmatch] ${path.basename(actualPath)}: ${diffPixels}/${totalPixels} pixels differ (${diffPercent.toFixed(2)}%) - ${match ? 'PASS' : 'FAIL'}`
  );

  return { match, baselineMissing: false, diffPercent };
}
