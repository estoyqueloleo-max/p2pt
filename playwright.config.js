process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.js', 'docs/tutorials/scripts/**/*.spec.js'],
  fullyParallel: false, // Set to false to run P2P coordination step-by-step
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Keep to 1 worker for deterministic multi-browser orchestration
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'https://localhost:5188',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5188',
    url: 'https://localhost:5188',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 30000,
    env: {
      VITE_PEER_HOST: 'localhost',
      VITE_PEER_PORT: '9005',
      VITE_PEER_SECURE: 'false',
      VITE_PEER_PROXIED: 'false',
    },
  },
});
