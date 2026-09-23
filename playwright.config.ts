import { randomUUID } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
process.env.MADATOURS_E2E_TOKEN ??= randomUUID();
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    locale: 'en-GB',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run build:web && node --import tsx tests/support/start-server.ts',
    env: { MADATOURS_E2E_TOKEN: process.env.MADATOURS_E2E_TOKEN },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
