import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** Set E2E_BASE_URL to test a deployed site, e.g. https://mrfreekie.github.io/rigpoint-load-sheet/ */
const LIVE = process.env.E2E_BASE_URL;
const BASE = LIVE ?? `http://localhost:${PORT}/rigpoint-load-sheet/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // 375 px wide, Safari engine: the narrowest phone the brief requires.
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  // Tests run against the production build, with its Content Security Policy.
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
          url: BASE,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
