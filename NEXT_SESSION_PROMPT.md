> Pisano protiv commita **S165** na `test-branch` (zadnji commit = „S165: …").
> **`main` = `006374c` (deploy S160, 04.10.)**. Na `test-branch` čekaju deploy: S160b, S161, S162,
> **S165 (pločica „Kamo ide novac")** i S163–S164 (samo dokumenti i alati).
> **Migracija `056` je na TEST-u, NIJE na PROD-u.**
> ⚠ Ako `git log` pokazuje noviji commit od S165, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S165 (2026-10-07)

> **Ukratko (S165):** Pločica „Kamo ide novac" je izgrađena i radi na TEST-u — novi upit u bazi,
> izračun bucketa, krug na laptopu i lista na mobitelu — i svaka brojka se s neovisnim izračunom i sa
> Sašinom tablicom iz skice slaže u lipu; PROD čeka migraciju, deploy i osiguranje kuće.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S165

- **Pločica „Kamo ide novac" postoji** i na TEST-u je upaljena za `Financije_all` (Overview, ispod salda).
  Razdoblje uzima iz filtra; prekidači Troškovi/Prihodi i po kupnji/po naplati; 8 tvojih bucketa +
  N/A; gotovina kao podstavka Mjesečnih; Transfer u podnožju; ↗ otvara retke u Activities.
- **Brojke su provjerene u lipu** na tri načina: upit u bazi = neovisni Python zbroj (svaka grupa),
  model = tvoja tablica iz skice (svaki bucket, obje osi), i aplikacija (automatski test) crta iste brojke.
- **Na laptopu krug + lista, na mobitelu samo lista** (trake, imena se prelamaju).
- **PROD nije diran.**

## Što treba od tebe

1. **Ručni testovi na TEST-u: T-S165-1..8** (`docs/sessions/tests/S165_tests.md`) — `npm run dev`,
   tvoj račun, Overview, filtar 01.10.2025.–30.09.2026. Očekivane brojke su upisane.
   ⚠ Ako na :5173 imaš `dev:prod`, TEST je na :5174 — **čitaj banner**.
2. **Prije PROD-a: R3 osiguranje kuće (T-S164-2)** — alat za config na PROD-u **stane** bez njega
   (`Kuća / Osiguranje` mora postojati u izborniku). Treba Kokin pristanak.
3. **PROD (T-S165-9):** 056 u SQL editoru → `verify_breakdown.py` → deploy → `set_breakdown.py
   --apply --yes-prod`. Redoslijed je obavezan (config prije deploya = žuti okvir Koki).
4. Od ranije: **11.10.** Koka potvrđuje MC naplatu u traci (T-S158-1 / T-S156-6); RF izvod →
   `promet_check`; T-S164-1/3/4 (Podtip Osiguranje na TEST-u, N/A fileovi); **~03.11.** Visa izvod (T-S161-3).

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- **TEST:** 056 pušten (psql); `areas.settings` `Financije_all` ima `dashboard.widgets = [saldo,
  breakdown]` i `groupings["Vrsta troška"]` (`set_breakdown.py`). TEST = PROD 07.10. + R3.
- **PROD:** ništa od S165. Bez R3 bi pločica na PROD-u imala Povremeno nužno 2.476,71 / Kuća
  investicije 1.048,87 (ostalo isto), ali `set_breakdown.py` na PROD-u staje dok R3 nije izveden
  (provjera Podtipa u `validation_rules`) — namjerno.
- `npm run check` ✓, build ✓, E2E `S165_breakdown_tile.spec.ts` 2/2.

## Novo u S165

- `sql/056_area_breakdown.sql`, `src/lib/breakdownModel.ts` (+ test + fixture
  `__tests__/fixtures/breakdown_financije_12mj.json`), `BreakdownTile.tsx`, `BreakdownSunburst.tsx`,
  `fetchBreakdown` (`overviewApi`), `isBalanceWidget` + `BreakdownWidget`/`Grouping` (`types/database`),
  `renameSlugInGroupings` (`dashboardConfig`), `useAreaDashboard` vraća `groupings`.
- `data-prep_tools/Financije/set_breakdown.py` (jedini izvor rasporeda do F5), `verify_breakdown.py`.
- Odstupanja od spec-a: `RAZREZ_SPEC.md` §17.

## Otvoreno

- Ručni testovi T-S165-1..9 neizvedeni. Ako nešto padne na TEST-u, **prvo `verify_breakdown.py`**
  (RPC vs Python) pa model.
- **F5** (Structure Excel `AreaSettings` + `Grupiranja`) — kad se raspored ustali (R14); mora i
  **izvoziti** raspored iz `set_breakdown.py` stanja.
- Drugo grupiranje „Čiji trošak" (R5) — model ga nosi, treba izbornik.
- Lazy učitavanje Plotlyja (backlog) — pločica ga ionako statički uvozi kroz `StructureSunburstView`.
- Nepromijenjeno od S164: E12-2 na TEST-u; `export_profiles` ne preživi rename; `Zdravlje / Other`
  bez retka; prijedlog održavanja Financija prije ~05.11. (T2, T28, T24, T22, T21, T12).
