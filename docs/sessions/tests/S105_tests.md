# S105 — Testovi (2026-07-06)

**Kontekst sesije:** PROD incident triage (statement timeouts 57014 na `event_attributes`) +
IO redukcija: `categoryCache.ts`, batched attrs/attachments/parent loads.
Detalji u CLAUDE.md → "S105 — PROD incident triage + IO redukcija".

---

## T-S105-1 — View Activity na PROD-u (manualni, ⬜)

**Preduvjeti:** `npm run dev:prod` (PROD baza), postojeća sesija sa 7 evenata
(Fitness > Activity > Gym > Strength, 2026-07-06 09:27).

**Koraci:**
1. Otvori Activities listu, nađi sesiju 09:27, ⋮ → View.
2. Otvori DevTools → Network, filter "supabase".

**Očekivano:**
- Svi eventi (#1–#7) vidljivi odmah, atributi POPUNJENI (Strength_type, exercise_name, sets_reps, weight_info).
- Broj `event_attributes` upita za glavnu aktivnost: **1** (plus po 1 za svaki Prev/Next prefetch).
- `categories` full-table upit: **max 1** po sesiji (categoryCache) — ne po aktivnosti.
- Ukupno učitavanje < ~2 s (uz zdravu PROD instancu).

**Fail:** prazni atributi (—) uz 500 u konzoli; deseci `categories?select=parent_catego...` upita.

---

## T-S105-2 — Edit Activity batch load (manualni, ⬜)

**Koraci:**
1. Ista sesija → Edit Activity.
2. Provjeri da su svi eventi u tabovima, sa svim vrijednostima atributa.
3. Provjeri da parent (Activity/Gym) atributi imaju svoje vrijednosti.
4. Promijeni nešto malo, Save, ponovo otvori — vrijednosti ostale.

**Očekivano:** identično ponašanje kao prije S105 (samo brže; 2 upita umjesto 14 za attrs/attachmente).

**Fail:** prazan event tab, izgubljeni parent atributi nakon Save.

---

## T-S105-3 — categoryCache invalidacija na rename (manualni, ⬜)

**Koraci:**
1. Otvori bilo koju aktivnost u View (napuni keš).
2. Structure tab → Edit Mode → preimenuj neku kategoriju iz lanca te aktivnosti → Save.
3. Vrati se na Activities → otvori istu aktivnost u View.

**Očekivano:** breadcrumb path pokazuje NOVO ime (rename dispatcha `areas-changed`
→ categoryCache invalidiran). Napomena: activityViewCache (LRU) može poslužiti staru
stranicu za istu sesiju — testirati na aktivnosti koja NIJE bila otvorena nakon rename-a,
ili nakon reloada stranice.

**Fail:** staro ime kategorije i nakon reloada (>5 min TTL = sigurno fail).

---

## T-S105-4 — E14 prefetch cache (E2E, ✅)

`npx playwright test e2e/tests/e14-prefetch-cache.spec.ts --workers=1` — oba testa prolaze.
Spec fix: `isNavigationFetchFor` isključuje `chain_key=` upite (batched parent lookup).

## T-S105-5 — E2/E3/E4 regresija (E2E, ✅)

`npx playwright test e2e/tests/e2-add-activity.spec.ts e2e/tests/e3-edit-activity.spec.ts e2e/tests/e4-view-activity.spec.ts --workers=1`
— svih 7 prolazi. Spec fix (e4): egzaktni nazivi gumba `'◀ Prev'`/`'Next ▶'` (kolizija s Help chipom).

---

## T-S105-6 — Edit error handling retest (manualni, ⬜)

**Kontekst:** S105c — batch load u Editu sada BACA grešku umjesto tihog praznog forma.

1. Otvori 7-event sesiju → Edit Activity.
2. **Očekivano:** svi atributi popunjeni već u 1. pokušaju. Ako PROD baš tada
   zakašlje: error ekran "Failed to load activity" s Back gumbom — NE prazan form.
3. **Fail:** form s praznim atributima (opasno — Save bi pregazio vrijednosti).

## T-S105-7 — depends_on radi nakon data repaira (manualni, ⬜)

**Kontekst:** S105d — PROD reference popravljene (exercise_name → strengthtype,
Broj rata → rate).

1. Edit ili Add na Fitness > Activity > Gym > Strength: odaberi Strength_type
   (npr. wormup) → **exercise_name dropdown aktivan** s opcijama (ergometar...).
2. Financije (b4cd5a81 area): event s Rate? = TRUE → **Broj rata dropdown radi**.
3. **Fail:** sivi dropdown "Select X first..." iako je parent atribut odabran.

## T-S105-8 — rename ne lomi slugove (manualni, ⬜)

**Kontekst:** S105d fix — Save panela više bezuvjetno ne normalizira slugove.

1. Structure → Edit Mode → rename kategorije Strength u "Strength_X" → Save → vrati ime → Save.
2. Edit/Add na toj kategoriji: exercise_name dropdown i dalje radi.
3. (Opcionalno, SQL provjera) `SELECT name, slug FROM attribute_definitions WHERE category_id = 'f3d337a2-...'`
   — slugovi nepromijenjeni.
4. **Fail:** dropdown opet siv nakon rename ciklusa.

**⚠️ Do PROD deploya S105d:** Structure Edit Save na mobitelu/main appu i dalje
briše crtice iz slugova — Structure uređivati samo na localhostu (test-branch).
(Ova napomena postaje bespredmetna nakon deploya S105d na main.)

---

## Napomena — PROD checklist (nije test)

- Postgres upgrade ≥ 17.6.1.121 (Settings → Infrastructure) — NAKON što Supabase
  incident bude Resolved na status.supabase.com.
- Advisor: `category_full_paths` SECURITY DEFINER view → `security_invoker = true` (backlog).
