# Playwright E2E — Kako funkcioniraju testovi

Ovaj dokument objašnjava arhitekturu, izvođenje i debugging Playwright E2E testova
u ovom projektu. Namijenjen je razumijevanju — ne instrukcijama za Claudea.

---

## 1. Što je Playwright i što ovdje testira

Playwright je alat koji automatski upravlja pravim Chrome browserom. Umjesto da
ti ručno klikaeš po aplikaciji, Playwright to radi programski — otvori stranicu,
klikne gumb, provjeri je li tekst vidljiv, i prijavi pass/fail.

Naši testovi (E1–E10) pokrivaju:

| Spec           | Što testira                                      |
|----------------|--------------------------------------------------|
| `e1-login`     | Login form, pogrešna lozinka, redirect za unauth |
| `e2-add-activity` | Dodavanje aktivnosti i pojava u listi        |
| `e3-edit-activity` | Edit flow, save bez promjena                |
| `e4-view-activity` | View Details, Prev/Next navigacija          |
| `e5-structure` | Structure tab: Add Area, blokirani Add Child     |
| `e6-excel-export` | Excel download (provjerava da je .xlsx)      |
| `e7-share`     | Share Management: invite + revoke                |
| `e8-grantee-write` | Write grantee: vidi area, može dodati      |
| `e9-grantee-read`  | Read grantee: Add Activity disabled          |
| `e10-revoke`   | Nakon revoke: grantee ne vidi area              |

---

## 2. Infrastruktura — datoteke

```
playwright.config.ts          Globalna konfiguracija (timeouts, browser, dev server)
e2e/
  fixtures/
    auth.ts                   loginAsOwner(), loginAsUserB(), supabasePost(), supabaseDelete()
    filter.ts                 SEED UUIDs + selectFilterPath() helper
  setup/
    seed.sql                  Početni podaci u TEST bazi (jednom pokrenuti)
  tests/
    e1-login.spec.ts
    e2-add-activity.spec.ts
    ...
  playwright-report/          HTML izvještaj (generira se nakon svakog runa)
```

---

## 3. Konfiguracija — `playwright.config.ts`

```ts
use: {
  baseURL: 'http://localhost:5173',    // Adresa dev servera
  screenshot: 'only-on-failure',       // Screenshot samo ako test padne
  video: 'retain-on-failure',          // Video samo ako test padne
  trace: 'retain-on-failure',          // Network/DOM trace samo ako test padne
}

webServer: {
  command: 'npm run dev',
  reuseExistingServer: true,           // Ako server već radi — koristi ga
}
```

**`reuseExistingServer: true`** znači: Playwright NE mora imati zasebni terminal
s dev serverom. Ako server nije aktivan, Playwright ga sam pokrene. Ako je aktivan,
samo se spoji na njega.

---

## 4. Kako login funkcionira (bez UI forme u E2–E10)

Testovi E2–E10 koriste `loginAsOwner(page)` umjesto klikanja kroz login formu.
Ovo ubrzava testove jer za svaki test ne čekamo puni login UI.

**Mehanizam (REST shortcut):**

1. Playwright direktno pozove Supabase Auth REST endpoint:
   `POST https://<project>.supabase.co/auth/v1/token?grant_type=password`
   s email + password

2. Dobije `access_token` + `refresh_token` (JWT session)

3. Injektira session u `localStorage` PRIJE nego što se stranica učita:
   ```ts
   await page.addInitScript(({ key, value }) => {
     localStorage.setItem(key, JSON.stringify(value));
   }, { key: 'sb-xtnbhmojmffjelsqejpw-auth-token', value: session });
   ```

4. Kad se stranica učita, Supabase JS v2 pročita session iz `localStorage`
   i korisnik je "već ulogiran"

**Zašto to radi:** Supabase JS v2 pohranjuje session u `localStorage` pod ključem
`sb-<projectRef>-auth-token`. Ako taj ključ postoji pri pokretanju aplikacije,
Supabase smatra korisnika autentificiranim — bez da ikad prikaže login formu.

---

## 5. Seed podaci — `e2e/setup/seed.sql`

Seed SQL kreira determinirane podatke s fiksnim UUID-ovima. Ovo je ključno jer
testovi referenciraju specifične UUIDs (npr. `SEED.CAT_STRENGTH`).

**Hierarhija:**
```
owner@test.com
└── Area: Fitness (a1000000-...-0001)
    └── Activity (L1, c1000000-...-0001)
        └── Gym (L2, c1000000-...-0002)
            ├── Strength (L3, leaf, BEZ eventa)  ← za E2 add-activity
            └── Cardio   (L3, leaf, IMA event)   ← za E3 edit-activity
```

Cardio ima seed event (2026-01-01) koji se nikad ne briše — E3/E4 testovi rade
na njemu. Strength nema eventa — E2 ga kreira i briše u `afterEach`.

**Seed je idempotent:** `ON CONFLICT DO NOTHING` na svim INSERT-ima.
Možeš ga pokrenuti više puta bez problema.

---

## 6. Cleanup — kako testovi ne ostavljaju smeće u DB

E2 koristi `afterEach`:
```ts
test.afterEach(async ({ page }) => {
  await supabaseDelete(page, 'events', {
    user_id: OWNER_ID,
    category_id: SEED.CAT_STRENGTH,
  });
});
```

`supabaseDelete` uzme access_token iz `localStorage` (session je injektiran u
`beforeEach`) i pošalje direktni REST DELETE na Supabase — bez UI, instant.

**Zašto ne koristiti UI za brisanje?** Puno sporije, i potrebno je navigirati
kroz više ekrana. REST direktno je ~10x brže i ne ovisi o UI selektorima.

---

## 7. `selectFilterPath` — kako se bira kategorija u filteru

```ts
await selectFilterPath(page, SEED.AREA_FITNESS, [
  SEED.CAT_ACTIVITY,
  SEED.CAT_GYM,
  SEED.CAT_STRENGTH,
]);
```

Filter na `/app` ima `ProgressiveCategorySelector` koji ima:
- `select` s "All Areas" defaultom → identifikacija po toj opciji
- `select` koji se reload-a nakon svake selekcije (Categories)

Helper locira Area select po `option[value=""][hasText='All Areas']`, selektira
area, zatim iterira kroz categoryIds i čeka svaki put da se opcija pojavi u DOM-u
(`option[value="<uuid>"]`).

**Zašto UUID-ovi umjesto text-a?** Text ("Strength") može se promijeniti, UUID
ne može. Testovi su otporni na rename kategorija.

---

## 8. Kako pokrenuti testove

### Headless (terminalni output, bez browsera):
```bash
npx playwright test
```

### Headed (vidljiv browser, real-time):
```bash
npx playwright test e2e/tests/e2-add-activity.spec.ts --headed
```

### Samo jedan test:
```bash
npx playwright test --grep "E2-2"
```

### UI mode (preporučeno za debugging):
```bash
npx playwright test --ui
```
Otvori Playwright UI u browseru. Možeš:
- Vidjet listu svih testova, kliknuti run za svaki
- Pratiti browser korak-po-korak
- Vidjeti screenshot/video/trace za failed testove
- Ponovo pokrenuti samo jedan test bez restartanja

### Prikaži HTML report nakon runa:
```bash
npx playwright show-report e2e/playwright-report
```

---

## 9. Što znači kada test padne

Kada test padne, u terminal output vidiš:
```
✘ E2-2: save new activity → appears in activities list
  Error: locator.click: Error: element is not visible
    at e2-add-activity.spec.ts:49
```

Uz to, u `e2e/playwright-report/` generirani su:
- **Screenshot** trenutka pada (automatski, `screenshot: 'only-on-failure'`)
- **Video** cijelog testa (`video: 'retain-on-failure'`)
- **Trace** — network requestovi, DOM snapshots, timeline (`trace: 'retain-on-failure'`)

Za trace viewer:
```bash
npx playwright show-trace e2e/test-results/e2-add-activity-E2-2/trace.zip
```

---

## 10. Evolucija — što se mijenjalo i zašto

### S50 — Inicijalna izgradnja (2026-04-13)

**Korak 1: Playwright instalacija**
```bash
npm install -D @playwright/test dotenv
npx playwright install chromium
```

**Korak 2: `playwright.config.ts`**
- ESM-compatible (`fileURLToPath` za `__dirname`)
- Učitava `.env.testing` (TEST Supabase kredencijali)
- `reuseExistingServer: true` — ne treba zasebni terminal
- `fullyParallel: false` — testovi su sekvencijalni jer dijele TEST Supabase stanje

**Korak 3: `e2e/fixtures/auth.ts`**
- `loginAsOwner` / `loginAsUserB` — REST login bypass (brže od UI forme)
- `supabasePost` / `supabaseDelete` — direktne REST operacije za test setup/cleanup

**Korak 4: `e2e/fixtures/filter.ts`**
- `SEED` objekt s UUID konstantama (jednoznačna referenca na seed podatke)
- `selectFilterPath()` — robusni helper za selekciju filter puta

**Korak 5: `e2e/setup/seed.sql`**
- Determinirani UUID-ovi za sve test entitete
- Idempotent `ON CONFLICT DO NOTHING`
- Cardio s eventom (za E3/E4), Strength bez eventa (za E2)
- Komentari s cleanup SQL-om za manualni reset

**Korak 6: E1–E10 spec fileovi**
- E1: direktna UI forma (testira sam login, ne bypass)
- E2–E10: koriste loginAsOwner bypass

### E2-2 fix — stabilizacija race conditiona

**Problem:** E2-2 test je povremeno padao. `addBtn.click()` bi se izvršio u
trenutku kad je category select bio kratko disabled.

**Root cause:** `ProgressiveCategorySelector` ima `useEffect` koji sinkronizira
`filter.categoryId` sa `selectionChain`. Između dva React batch rendera,
`isLoading` state na select-u bi se kratko postavio na `true` (a zatim odmah
`false`). Playwright `click()` čeka stability — ako element oscilira između
enabled/disabled, test može uhvatiti disabled moment.

**Fix:**
```ts
// Čekaj da category select prestane biti disabled (async side-effect se slegne)
const catSelect = page.locator('select').filter({
  has: page.locator('option[value=""]'),
}).last();
await expect(catSelect).not.toBeDisabled({ timeout: 5_000 });
await addBtn.click();
```

Ovo ne čeka Add Activity gumb (koji ne mijenja disabled stanje) nego category
select koji je direktni indikator da je async sinkronizacija završila.

---

## 11. Poznati selektorski problemi (E3–E10, nije testirano)

Sljedeći selektori su "educated guesses" koji vjerojatno trebaju podešavanje:

**E3/E4 — ⋮ menu:**
```ts
await activityRow.getByRole('button').filter({ hasText: /⋮|more|menu/i }).first().click();
```
Stvarni gumb možda nema text content (samo SVG ikona) — možda treba:
```ts
await activityRow.locator('button[aria-label*="more"], button.menu-trigger').click();
```

**E5 — Structure tab:**
```ts
await page.getByRole('button', { name: /structure/i }).click();
```
Tab gumb se zove točno "Structure" — vjerojatno OK.

**E7–E10 — Share management:**
Selektori za Share modal, invite formu i grantee view su najkompleksniji.
Vjerojatno će trebati iteracija s `--headed` modom.

---

## 12. Workflow za debugging failova

Umjesto slanja screenshota:

1. Pokreni failed spec s `--headed`:
   ```bash
   npx playwright test e2e/tests/e3-edit-activity.spec.ts --headed
   ```

2. Gledaj browser uživo — vidiš gdje se zaglavi

3. Copy-paste terminal output (cijeli error s line brojem)

4. Za kompleksnije — UI mode:
   ```bash
   npx playwright test e2e/tests/e3-edit-activity.spec.ts --ui
   ```
   Klikni na failed korak u timeline-u — vidiš DOM snapshot u tom trenutku

5. Terminal output je dovoljan za dijagnozu u 90% slučajeva:
   - `locator.click: element not found` → selektor ne odgovara
   - `locator.click: element not visible` → element u DOM-u ali skriven
   - `locator.click: element not enabled` → disabled state race condition
   - `expect(page).toHaveURL: expected /app/edit` → navigacija nije uspjela (UI greška)
