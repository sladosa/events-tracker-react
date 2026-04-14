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
 * Direct REST GET helper for queries.
 */
export async function supabaseGet(
  page: Page,
  table: string,
  filter: Record<string, string>,
  select = '*',
): Promise<unknown[]> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const session = await page.evaluate(
    (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    storageKey,
  );

  if (!session?.access_token) return [];

  const params = new URLSearchParams({
    select,
    ...Object.fromEntries(Object.entries(filter).map(([k, v]) => [k, `eq.${v}`])),
  });

  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json',
      },
    },
  );

  if (!res.ok()) {
    console.error(`supabaseGet ${table}: ${res.status()} ${await res.text()}`);
    return [];
  }
  return res.json();
}

/**
 * Delete an area and all its categories + attribute_definitions (manual cascade).
 * The DB FK has no ON DELETE CASCADE, so we delete in the correct order.
 */
export async function deleteAreaCascade(
  page: Page,
  areaId: string,
): Promise<void> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const session = await page.evaluate(
    (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    storageKey,
  );

  if (!session?.access_token) {
    console.error('deleteAreaCascade: no access_token in localStorage');
    return;
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    Prefer: 'return=minimal',
    Accept: 'application/json',
  };

  // 1. Get all category IDs in this area
  const catRes = await page.request.get(
    `${SUPABASE_URL}/rest/v1/categories?area_id=eq.${areaId}&select=id`,
    { headers },
  );
  if (!catRes.ok()) {
    console.error('deleteAreaCascade: failed to fetch categories', catRes.status(), await catRes.text());
    return;
  }
  const cats: Array<{ id: string }> = await catRes.json();

  // 2. Delete event_attributes for those categories' attr_defs (avoid FK violations)
  if (cats.length > 0) {
    const catIds = cats.map(c => c.id).join(',');

    // Fetch attr_def IDs
    const adRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/attribute_definitions?category_id=in.(${catIds})&select=id`,
      { headers },
    );
    const attrDefs: Array<{ id: string }> = adRes.ok() ? await adRes.json() : [];

    if (attrDefs.length > 0) {
      const adIds = attrDefs.map(a => a.id).join(',');
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/event_attributes?attribute_definition_id=in.(${adIds})`,
        { headers },
      );
      // Delete attribute_definitions
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/attribute_definitions?category_id=in.(${catIds})`,
        { headers },
      );
    }

    // 3. Gather all event IDs referencing these categories (category_id + chain_key)
    const evCatRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/events?category_id=in.(${catIds})&select=id`,
      { headers },
    );
    const evChainRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/events?chain_key=in.(${catIds})&select=id`,
      { headers },
    );
    const evCat: Array<{ id: string }> = evCatRes.ok() ? await evCatRes.json() : [];
    const evChain: Array<{ id: string }> = evChainRes.ok() ? await evChainRes.json() : [];
    const allEvIds = [...evCat, ...evChain].map(e => e.id);

    if (allEvIds.length > 0) {
      const evIds = allEvIds.join(',');
      // Delete event_attachments first (FK: event_attachments.event_id → events.id)
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/event_attachments?event_id=in.(${evIds})`,
        { headers },
      );
      // Delete event_attributes (FK: event_attributes.event_id → events.id)
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/event_attributes?event_id=in.(${evIds})`,
        { headers },
      );
      // Delete events
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/events?category_id=in.(${catIds})`,
        { headers },
      );
      await page.request.delete(
        `${SUPABASE_URL}/rest/v1/events?chain_key=in.(${catIds})`,
        { headers },
      );
    }

    // 4. Delete categories
    const delCatRes = await page.request.delete(
      `${SUPABASE_URL}/rest/v1/categories?area_id=eq.${areaId}`,
      { headers },
    );
    if (!delCatRes.ok()) {
      console.error('deleteAreaCascade: failed to delete categories', delCatRes.status(), await delCatRes.text());
      return;
    }
  }

  // 5. Delete the area
  const delAreaRes = await page.request.delete(
    `${SUPABASE_URL}/rest/v1/areas?id=eq.${areaId}`,
    { headers },
  );
  if (!delAreaRes.ok()) {
    console.error('deleteAreaCascade: failed to delete area', delAreaRes.status(), await delAreaRes.text());
  }
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
