/**
 * Auth helpers for Playwright E2E tests.
 *
 * Strategy: REST login → store session in localStorage before page navigation.
 * This is faster than clicking through the UI login form on every test.
 *
 * Supabase JS v2 reads its session from:
 *   localStorage key: sb-<projectRef>-auth-token
 *
 * For TEST project https://xtnbhmojmffjelsqejpw.supabase.co
 *   key = sb-xtnbhmojmffjelsqejpw-auth-token
 */

import type { Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  // 1. Exchange credentials for tokens via Supabase Auth REST API
  const res = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      data: { email, password },
    },
  );

  if (!res.ok()) {
    throw new Error(
      `Supabase auth failed for ${email}: ${res.status()} ${await res.text()}`,
    );
  }

  const session = await res.json();

  // 2. Inject session into localStorage before page scripts execute
  //    Supabase JS v2 key = sb-<projectRef>-auth-token
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session },
  );
}

/** Login as owner@test.com (primary test user) */
export async function loginAsOwner(page: Page): Promise<void> {
  await loginAs(
    page,
    process.env.PLAYWRIGHT_TEST_EMAIL!,
    process.env.PLAYWRIGHT_TEST_PASSWORD!,
  );
}

/** Login as userb@test.com (secondary / grantee user) */
export async function loginAsUserB(page: Page): Promise<void> {
  await loginAs(
    page,
    process.env.PLAYWRIGHT_TEST_EMAIL_B!,
    process.env.PLAYWRIGHT_TEST_PASSWORD_B!,
  );
}

/**
 * Direct REST POST helper (INSERT via Supabase REST API).
 * page must already have a session injected via loginAs*.
 */
export async function supabasePost(
  page: Page,
  table: string,
  body: Record<string, unknown>,
  prefer = 'return=representation',
): Promise<unknown> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const session = await page.evaluate(
    (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    storageKey,
  );

  if (!session?.access_token) throw new Error('No session available for supabasePost');

  const res = await page.request.post(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      data: body,
    },
  );

  if (!res.ok()) {
    throw new Error(`supabasePost ${table} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json().catch(() => null);
}

/**
 * Direct REST DELETE helper for cleanup.
 * Uses owner credentials (service-level access via RLS = own data).
 */
export async function supabaseDelete(
  page: Page,
  table: string,
  filter: Record<string, string>,
): Promise<void> {
  // Get access token from the session we injected
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const session = await page.evaluate(
    (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    storageKey,
  );

  if (!session?.access_token) return;

  const params = new URLSearchParams(
    Object.entries(filter).map(([k, v]) => [`${k}`, `eq.${v}`]),
  );

  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: 'return=minimal',
      },
    },
  );
}
