# Playwright E2E Testing Setup Guide

**Projekt:** Events Tracker React
**Status:** Nije implementirano — planned for future (post Combined-backup arhitektura)
**Zadnja izmjena:** 2026-03-24

---

## Pregled

Cilj: automatizirati manualne UI testove koji su se dosad vodili u `PENDING_TESTS.md`.
Playwright pokreće pravi browser, klikće gumbe, provjerava UI stanje — točno kao ručno testiranje.

**Stack:**
- Playwright — E2E test framework
- Supabase test projekt — odvojena baza, ne kontaminira produkciju
- `.env.testing` — već postoji u repo rootu, dodati test Supabase kredencijale

---

## Faza 1 — Supabase test projekt (jednokratno, ~30 min)

### 1.1 Kreiraj novi Supabase projekt

1. Idi na [supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → ime npr. `events-tracker-test`
3. Isti region kao produkcija
4. Zapamti DB password

### 1.2 Primijeni SQL schema na test projekt

1. Otvori novi test projekt → **SQL Editor**
2. Kopiraj cijeli sadržaj `Claude-temp_R/SQL_schema_V5_commented.sql`
3. Ukloni komentare koji su samo za čitanje (ili ostavi — ne smeta)
4. **Run** — kreirat će sve tablice, RLS policies, triggere

### 1.3 Kreiraj test usera

1. Test projekt → **Authentication** → **Users** → **Add user**
2. Email: `test@events-tracker.local`
3. Password: nešto sigurno (spremi negdje)
4. Kopiraj User UUID — trebat će ti za seed podatke

### 1.4 Dodaj seed podatke (minimalni set za testove)

U SQL Editoru test projekta — ubaci minimalni dataset:

```sql
-- Zamijeni <TEST_USER_UUID> s UUID-om iz koraka 1.3

-- Areas
INSERT INTO areas (id, user_id, name, slug, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', '<TEST_USER_UUID>', 'Fitness', 'fitness', 10),
  ('a1000000-0000-0000-0000-000000000002', '<TEST_USER_UUID>', 'Financije', 'financije', 20);

-- Categories (Fitness > Activity > Gym > Strength — leaf bez evenata)
INSERT INTO categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', '<TEST_USER_UUID>', 'a1000000-0000-0000-0000-000000000001', NULL, 'Activity', 'activity', 1, 10),
  ('c1000000-0000-0000-0000-000000000002', '<TEST_USER_UUID>', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Gym', 'gym', 2, 10),
  ('c1000000-0000-0000-0000-000000000003', '<TEST_USER_UUID>', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Strength', 'strength', 3, 10);

-- Categories (Fitness > Activity > Gym > Cardio — leaf S eventima)
INSERT INTO categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000004', '<TEST_USER_UUID>', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Cardio', 'cardio', 3, 20);

-- Event na Cardio (da testiramo blocked Add Child)
INSERT INTO events (id, user_id, category_id, event_date, session_start) VALUES
  ('e1000000-0000-0000-0000-000000000001', '<TEST_USER_UUID>', 'c1000000-0000-0000-0000-000000000004', '2026-01-01', '2026-01-01T10:00:00+00:00');
```

### 1.5 Popuni .env.testing

```bash
# .env.testing — NE commitati (već u .gitignore)
VITE_SUPABASE_URL=https://<TEST-PROJECT-ID>.supabase.co
VITE_SUPABASE_ANON_KEY=<test-project-anon-key>

# Playwright test user
PLAYWRIGHT_TEST_EMAIL=test@events-tracker.local
PLAYWRIGHT_TEST_PASSWORD=<password-iz-koraka-1.3>
```

Kredencijale nađeš u test projektu → **Project Settings** → **API**.

---

## Faza 2 — Playwright instalacija (~30 min)

### 2.1 Instaliraj

```bash
npm install -D @playwright/test dotenv
npx playwright install chromium   # samo chromium je dovoljno za početak
```

### 2.2 Kreiraj playwright.config.ts

```typescript
// playwright.config.ts (repo root)
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Učitaj .env.testing umjesto .env
dotenv.config({ path: path.resolve(__dirname, '.env.testing') });

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      // Proslijedi test env varijable Vite dev serveru
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL!,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY!,
    },
  },
});
```

### 2.3 Auth fixture

```typescript
// e2e/fixtures/auth.ts
import { type Page } from '@playwright/test';

export async function loginAsTestUser(page: Page) {
  // REST login — brže nego klikati kroz UI svaki test
  const res = await page.request.post(
    `${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY! },
      data: {
        email: process.env.PLAYWRIGHT_TEST_EMAIL,
        password: process.env.PLAYWRIGHT_TEST_PASSWORD,
      },
    },
  );
  const { access_token, refresh_token } = await res.json();

  // Spremi session u localStorage kao što Supabase JS klijent očekuje
  await page.addInitScript(
    ({ url, token, refresh }) => {
      const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
      localStorage.setItem(key, JSON.stringify({
        access_token: token,
        refresh_token: refresh,
        token_type: 'bearer',
        expires_in: 3600,
      }));
    },
    {
      url: process.env.VITE_SUPABASE_URL!,
      token: access_token,
      refresh: refresh_token,
    },
  );
}
```

### 2.4 Dodaj npm skripte

```json
// package.json — dodaj u "scripts":
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug"
```

---

## Faza 3 — Prvi testovi (~1-2h)

### Struktura

```
e2e/
├── fixtures/
│   └── auth.ts
├── tests/
│   ├── structure-add-area.spec.ts
│   ├── structure-add-child.spec.ts
│   ├── structure-delete.spec.ts
│   └── structure-import.spec.ts
└── playwright.config.ts  (ili repo root)
```

### Primjer testa — blocked Add Child na leaf s eventima

```typescript
// e2e/tests/structure-add-child.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/app');
  // Pređi na Structure tab
  await page.getByRole('tab', { name: /structure/i }).click();
  // Uključi Edit Mode
  await page.getByRole('button', { name: /edit mode/i }).click();
});

test('Add Child na leaf s eventima — blocked state', async ({ page }) => {
  // Klik na row actions za Cardio (leaf s eventom)
  await page.getByText('Cardio').hover();
  await page.getByRole('button', { name: /add child/i }).first().click();

  // Provjeri blocked state
  await expect(page.getByText('Cannot add child — leaf has events')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'OK' })).toBeVisible();
});

test('Add Child na leaf bez evenata — normalna forma', async ({ page }) => {
  await page.getByText('Strength').hover();
  await page.getByRole('button', { name: /add child/i }).first().click();

  // Provjeri amber forma
  await expect(page.getByPlaceholder('e.g. Cardio')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
});

test('Add Area — kreira novu area', async ({ page }) => {
  await page.getByRole('button', { name: /add area/i }).click();
  await page.getByPlaceholder('e.g. Health').fill('TestArea');
  await page.getByRole('button', { name: 'Create' }).click();

  // Provjeri da se area pojavila u tablici
  await expect(page.getByText('TestArea')).toBeVisible();
});
```

---

## Napomene

### Test izolacija
- Seed podaci su fiksni (fixed UUID-ovi) — testovi ih ne brišu
- Testovi koji kreiraju nove podatke trebaju cleanup u `afterEach`:
  ```typescript
  test.afterEach(async ({ page }) => {
    // Briši testne podatke ako su kreirani
  });
  ```

### CI integracija (opcija)
Dodaj u `.github/workflows/typecheck.yml` nakon build koraka:
```yaml
- name: Install Playwright
  run: npx playwright install chromium
- name: Run E2E tests
  run: npm run test:e2e
  env:
    VITE_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    PLAYWRIGHT_TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
    PLAYWRIGHT_TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```
Sekreti se dodaju u GitHub repo → Settings → Secrets.

### .gitignore dodaci
```
# Playwright
/e2e/test-results/
/e2e/playwright-report/
/playwright-report/
.env.testing
```

---

*Dokument kreiran: 2026-03-24*
*Implementirati nakon: Combined backup arhitektura (S24+)*
