import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
process.env.MADATOURS_E2E_DB ??= path.join(tmpdir(), `madatours-e2e-${randomUUID()}.sqlite`);
export default defineConfig({
  globalTeardown: './tests/e2e/cleanup.ts',
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    env: { PORT: '3100', LOCAL_DATABASE_PATH: process.env.MADATOURS_E2E_DB },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
