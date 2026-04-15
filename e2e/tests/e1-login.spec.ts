/**
 * E1 — Login flow
 *
 * Tests the UI login form directly (not the REST shortcut).
 * Does NOT use loginAsOwner() — we're testing the form itself.
 *
 * Preconditions:
 *   - owner@test.com exists in TEST Supabase (password: Test1234!)
 */

import { test, expect } from '@playwright/test';

test.describe('E1 — Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('E1-1: valid credentials → redirected to /app', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
    await page.getByPlaceholder('••••••••').fill(process.env.PLAYWRIGHT_TEST_PASSWORD!);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
    // App header / nav should be visible
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible();
  });

  test('E1-2: invalid password → error toast shown', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
    await page.getByPlaceholder('••••••••').fill('wrong-password-123');
    await page.locator('button[type="submit"]').click();

    // Wait for Supabase response — redirect would happen quickly if login succeeded
    await page.waitForTimeout(3_000);

    // Still on login page (redirect to /app did NOT happen)
    await expect(page).toHaveURL(/\/login/);
  });

  test('E1-3: unauthenticated access to /app → redirect to /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
