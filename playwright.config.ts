import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.testing (TEST Supabase credentials)
dotenv.config({ path: path.resolve(__dirname, '.env.testing') });

export default defineConfig({
  testDir: './e2e/tests',
  // Clears leftover events from earlier runs — see e2e/setup/global-setup.ts.
  globalSetup: './e2e/setup/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // ⚠ `fullyParallel: false` alone does NOT make the run sequential — it only
  //   keeps tests WITHIN one file in order. Files still go to separate workers,
  //   and Playwright defaults to about half the CPU cores. Six spec files then
  //   fight over the same seed Area and the same TEST database: measured
  //   2026-08-26, nine of ten specs failed in one batch (selectOption timeouts,
  //   `Cardio` hidden, `canceling statement due to statement timeout`) while
  //   every one of them passed when run on its own.
  //   ⚠ That statement timeout is also what an attribute filter looked like it
  //   was causing — it was this, not the query.
  fullyParallel: false,
  workers: 1,            // shared TEST Supabase state — one worker, really
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL!,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY!,
    },
  },
});
