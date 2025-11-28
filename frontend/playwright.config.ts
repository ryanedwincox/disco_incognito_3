// Playwright config: Integration testing with fresh backend per test
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Run tests sequentially - each needs its own backend
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,  // Single worker - each test manages its own backend
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  // Global timeout for each test (includes server startup)
  timeout: 60000,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
