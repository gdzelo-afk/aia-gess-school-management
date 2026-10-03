import { defineConfig } from '@playwright/test';
import { browserOrigin } from './scripts/browser/environment';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: browserOrigin,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx tsx scripts/browser/serve.ts',
    // Wait for Vite's proxy and the database-backed API, not just the HTML server.
    url: `${browserOrigin}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
