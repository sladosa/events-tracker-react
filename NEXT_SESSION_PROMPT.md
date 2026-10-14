> Pisano protiv commita **S171 zatvaranje** na `test-branch` (zadnji commit = „S171: zatvaranje …“).
> **`main` = `119653c` (deploy 12.10., S168)** — na `test-branch` čeka **S169 + S170 + S171** (jedan build).
> **PROD baza:** `sql/057` ✓ (S170). Visa config **NIJE** na PROD-u — ide tek poslije deploya
> (`set_due_visa_S170.py`). S171 nema migracije ni configa.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S171 (2026-10-14)

> **Ukratko (S171):** Na mobitelu Overview od filtra pokazuje samo razdoblje, a Activities kreće sklopljen i u jednom redu kaže što je aktivno; nova pločica „Košare“ pokazuje otvorene kartične košare po danu naplate, s kupnjama i koliko ostaje na računu kad prođu — sve čeka Sašin lokalni test i deploy.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno (na `test-branch`, čeka tvoj test pa deploy)

- **Filtar na mobitelu:** Overview pokazuje samo red `📅 This Year · 01.01.–31.12.2026.`; izbor
  razdoblja ga sam sklopi. Activities kreće sklopljen i kaže što je aktivno (i uvjet s ↗).
  **Clear all** je unutar otvorenog filtra, više ne uz strelicu.
- **Pločica „Košare (otvorene)"** ispod salda: po računu (ZABA, RF), košara po danu naplate,
  dodir pokaže kupnje, uz svaku **ostaje** (stanje danas − košare redom; plaće ne zna — piše).
  Visa s `~` (dan je procjena). U traci „Čeka potvrdu" novo: **pokaži kupnje**.
- Iz S170 (također čeka deploy): filtar izbornici, brže otvaranje, Visa u traci, delta košare.

## Što treba od tebe

1. **Lokalni test na laptopu (TEST, mobilni prikaz u DevTools):** T-S171-1..4 — koraci i brojke u
   `docs/sessions/tests/S171_tests.md`. Ključno: ZABA „danas" u Košarama = broj na pločici salda;
   MC 11.11. `−2.081,48 · ostaje 7.975,79`, Visa ~05.11. `−188,42 · ostaje 689,67`.
2. **Deploy** (S169 + S170 + S171 jednim buildom), PowerShell:
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
3. **Poslije deploya:** T-S170-4 (Network bez plotly/excel na početku), T-S169-8, pa **Visa config**
   (T-S170-8):
   ```powershell
   cd C:\0_Sasa\events-tracker-react\data-prep_tools
   $env:ET_TARGET='prod'; .\Financije\run.bat set_due_visa_S170.py
   $env:ET_TARGET='prod'; .\Financije\run.bat set_due_visa_S170.py --apply --yes-prod
   ```
   Bez Visa configa pločica Košare na PROD-u pokazuje samo MC (Visa nije u `due.baskets`).
4. Na TEST-u iz S170: T-S170-1 (broj `Racun` ≈ 355), T-S170-10 (uvoz). T-S170-12 uz ZABA izvod.
5. **Razmisli** (iz S170): provjera košara u „Review" sheetu — Backlog „Čeka Sašinu odluku".
6. Iz ranije: RF N/A (T-S169-6), s Kokom starija povijest (T-S169-7), ~03.11. Visa izvod (T-S170-9),
   11.11. MC traka + „pokaži kupnje" (T-S171-5).

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` ispred `main`: S169 `BreakdownTile` + S170 + S171 (`filterSummary.ts`,
  `BasketsTile.tsx` + `basketsView.ts`, `fetchBasketLines`, harmonika po ključevima u `OverviewTab`,
  `DateRangeFilter` `onPresetChosen`/`periodOnly`, `DueStrip` `onShowBasket`).
- S171 je **neverificiran uživo na `Financije_all`**: E2E račun (`PLAYWRIGHT_TEST_EMAIL`) na TEST-u
  ne vidi `Financije_all` (kopija je pod Sašinim TEST računom). Provjereno E2E-om na vlastitoj Arei s
  podmetnutim RPC-ovima (`S171_baskets_and_narrow_filter`, 2/2, protuprovjera pada) + brojke za ručni
  test izmjerene RPC-om service ključem (`rpc_area_due_baskets` s `as_of` 9999-12-31).
- Python skripte u scratchpad + `python -I` (+ `sys.stdout.reconfigure(encoding="utf-8")` — `-I`
  ignorira `PYTHONIOENCODING`).

## Otvoreno — kod (po prioritetu)

1. Ako Saša na T-S171 nađe nešto — prvo to.
2. **„Review" sheet — provjera košara** (čeka Sašu; Backlog).
3. **T23** naknada 1,32 uz MC rate „novog načina otplate"; **T13/T14** za MC u `fill_from_izvod`.
4. **F5** (`groupings` / `due` kroz Structure Excel) — roundtrip completeness.
5. Delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni u bojanju (Σ ih broji).
6. Moguće proširenje Košara (nije traženo): ↗ košara u Activities traži filtar s dva uvjeta
   (`Izvor` + `Datum naplate`) — `FilterContext` nosi jedan; zato je popis kupnji u pločici.
