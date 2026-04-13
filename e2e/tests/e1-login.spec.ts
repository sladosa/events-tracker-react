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
    await page.getByPlaceholder(/email/i).fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
    await page.getByPlaceholder(/password/i).fill(process.env.PLAYWRIGHT_TEST_PASSWORD!);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
    // App header / nav should be visible
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible();
  });

  test('E1-2: invalid password → error toast shown', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
    await page.getByPlaceholder(/password/i).fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Supabase error message appears as toast
    await expect(
      page.locator('[class*="toast"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 8_000 });

    // Still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('E1-3: unauthenticated access to /app → redirect to /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
