import { defineConfig, devices } from '@playwright/test';

// BASE_URL set   -> test a running/deployed app (e.g. https://shelfwise.onrender.com)
// BASE_URL unset -> build the app and start it locally on :3001
const BASE_URL = process.env.BASE_URL?.replace(/\/$/, '');
const LOCAL_URL = 'http://localhost:3001';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  // One retry in CI: a test that passes on retry is reported as "flaky", not failed,
  // so a single network blip never opens an issue.
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL: BASE_URL || LOCAL_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm start',
        url: `${LOCAL_URL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
});
