> Pisano protiv commita **S171 deploy** na `test-branch` (zadnji commit = „S171: deploy …“).
> **`main` = `6ff19d4` (deploy 14.10., S169 + S170 + S171).** `test-branch` = `main` + ovi dokumenti.
> **PROD baza:** `sql/057` ✓ (S170), **Visa config ✓ (14.10.)**. S171 nema migracije.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S171 (2026-10-14)

> **Ukratko (S171):** Na mobitelu Overview od filtra pokazuje samo razdoblje, a Activities kreće sklopljen i u jednom redu kaže što je aktivno; nova pločica „Košare“ pokazuje otvorene kartične košare po danu naplate, s kupnjama i koliko ostaje na računu kad prođu — Saša je sve testirao lokalno, pa je isti dan otišlo na PROD zajedno sa S169–S170 i Visom u traci.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno — NA PROD-u od 14.10.

- **Filtar na mobitelu:** Overview pokazuje samo red `📅 This Year · 01.01.–31.12.2026.`; izbor
  razdoblja ga sam sklopi. Activities kreće sklopljen i kaže što je aktivno (i uvjet s ↗).
  **Clear all** je unutar otvorenog filtra, više ne uz strelicu.
- **Pločica „Košare (otvorene)"** ispod salda: po računu (ZABA, RF), košara po danu naplate,
  dodir pokaže kupnje, uz svaku **ostaje** (stanje danas − košare redom; plaće ne zna — piše).
  Visa s `~` (dan je procjena). U traci „Čeka potvrdu" novo: **pokaži kupnje**.
- Iz S170 (isti deploy): filtar izbornici, brže otvaranje, Visa u traci (config ✓), delta košare.
- Nakon tvog testa: kupnja u dva retka (Tip/Podtip, opis), ↗ „isti dan u Activities", Prev/Next
  samo kroz košaru, Edit → Save → Next ostaje u košari, označena kupnja na kojoj si stao.

## Što treba od tebe

1. **PROD provjere (nakon hard refresha; Koka: zatvori karticu i otvori iznova):**
   - Košare: ZABA „danas" = pločica salda; Visa se vidi u Košarama (05.11., 20 kupnji, −579,05).
   - Mobitel: Overview = samo red razdoblja; Activities sklopljen sa sažetkom.
   - T-S170-4 (Network: na početku nema `plotly`/`excel`), T-S169-8 (razrez pamti nakon ↗).
   - T-S168-4 (praćenje): Kokin iPhone — lista nikad bez iznosa.
2. Na TEST-u iz S170: T-S170-1 (broj `Racun` ≈ 355), T-S170-10 (uvoz). T-S170-12 uz ZABA izvod.
3. **~03.–11.11.:** Visa košara u traci (T-S170-9); **11.11.** MC traka + „pokaži kupnje" (T-S171-5).
4. **Razmisli** (iz S170): provjera košara u „Review" sheetu — Backlog „Čeka Sašinu odluku".
5. Iz ranije: RF N/A (T-S169-6), s Kokom starija povijest (T-S169-7).
6. Opcionalno: `.\Tools\run.bat Tools\dump_schema.py --env prod` (osvježi `SCHEMA_PROD.sql` s `057`).

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- **Deployano 14.10.** (`main` = `6ff19d4`): S169 `BreakdownTile` + S170 + S171 (`filterSummary.ts`,
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
