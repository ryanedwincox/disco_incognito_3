// Playwright config: Integration testing with fresh backend per test
import { defineConfig, devices } from '@playwright/test';

// Port configuration: Use environment variables or feature branch defaults (9000/9100)
// Main branch uses 8000/3000, feature branches use 9000/9100 to avoid conflicts
const FRONTEND_PORT = process.env.VITE_PORT || '9100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Run tests sequentially - each needs its own backend
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,  // Single worker - each test manages its own backend
  reporter: 'html',

  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  // Global timeout for each test (includes server startup + multi-context game flow)
  timeout: 90000,

  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // Override to match mobile-first design viewport from CLAUDE.md
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
