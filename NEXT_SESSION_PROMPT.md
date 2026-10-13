> Pisano protiv commita **S170 ritual** na `test-branch` (zadnji commit = „S170: zatvaranje …").
> **`main` = `119653c` (deploy 12.10., S168)** — na `test-branch` čeka **S169 + S170** (jedan build).
> **PROD baza (S170, 13.10.):** `sql/057` pušten (Saša) ✓. Visa config **NIJE** na PROD-u — ide tek
> poslije deploya (`set_due_visa_S170.py`).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S170 (2026-10-13)

> **Ukratko (S170):** Filtar sada nudi izbornik i za Izvor, Podtip i Status, aplikacija se otvara bez 1,7 MB koje nije trebala, Structure broji jednim upitom umjesto stotinu, Visa je spremna za traku „Čeka potvrdu“, a delta sheet pokazuje košare po mjesecima s izbornikom i bojom.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno (na `test-branch`, čeka deploy)

- **Filtar:** `Izvor`, `Podtip` (grupiran po `Tip`u), `Status` imaju izbornik. Provjereno: 18 / 22.
- **Add:** `Rate?` bez broja rata se ne sprema tiho; gumb „Kreiraj 3 rate".
- **Brže otvaranje:** 2.036 → 269 KB (krug i Excel se skidaju tek kad zatrebaju). Kokin iPhone!
- **Financije se uvijek otvaraju na This Year** (bio je rijedak kvar koji je vraćao All Time).
- **Structure tab:** jedan upit za brojanje umjesto 39 po učitavanju (`057` već na PROD-u).
- **Visa u traci „Čeka potvrdu"** — kod spreman, uključuje se configom poslije deploya.
- **Excel uvoz** više ne traži kvačicu „potvrđeno" za kartične retke.
- **Delta sheet:** košare po mjesecima, `+`/`−` po košari, izbornik dana uz Σ, odabrana košara žuta.

## Što treba od tebe

1. **Deploy** (S169 + S170 jednim buildom), PowerShell:
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
2. **Poslije deploya:** T-S170-4 (Network: nema plotly/excel na početku), T-S169-8 (razrez pamti),
   pa **Visa config** (T-S170-8):
   ```powershell
   cd C:\0_Sasa\events-tracker-react\data-prep_tools
   $env:ET_TARGET='prod'; .\Financije\run.bat set_due_visa_S170.py
   $env:ET_TARGET='prod'; .\Financije\run.bat set_due_visa_S170.py --apply --yes-prod
   ```
   ⚠ Ako dry run pokaže staru Visa košaru **03.10.** — prvo izvod kroz `visa_uvoz_izvoda.py`.
3. **Ostatak testa na TEST-u:** T-S170-1 (Filter `Izvor = Racun` ≈ 355), T-S170-10 (uvoz: kvačica
   samo za Racun redak). T-S170-12 uz sljedeći ZABA izvod.
4. **Razmisli:** kako provjeravati **košare u „Review" sheetu** (zapisano u Backlog → „Čeka Sašinu
   odluku"). Pretpostavio sam da je to izvještaj nakon uvoza (`ImportReport`) — potvrdi.
5. Opcionalno: `.\Tools\run.bat Tools\dump_schema.py --env prod` (osvježi `SCHEMA_PROD.sql` s `057`).
6. Iz ranije: RF N/A (T-S169-6), s Kokom starija povijest (T-S169-7), ~03.11. Visa izvod (T-S170-9),
   11.11. MC traka.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` ispred `main`: S169 `BreakdownTile` + cijeli S170 (filterOptions, rataCountProblem,
  lazy Plotly/Excel + `LazyModalFallback` + `useMinWidth`, DateRangeFilter jedan efekt, `057` RPC +
  fallback, `due.baskets[k].window/measure`, T21 `inBalanceBeforeOrAfter`, T12 Σ po danu + grupe
  košara u delta sekciji).
- TEST: `057` ✓, Visa due config ✓, `split.due_slug` ✓ (bio je zaostao — `prod_to_test` ne prenosi
  `settings`). PROD: `057` ✓; Visa config ✗ (namjerno, poslije deploya).
- E2E: novi `S170_structure_event_counts`, Visa test u `S168_due_quick_confirm`. Dok Saša drži
  `dev:prod` na :5173, E2E ide preko privremenog configa na :5174 (`e2e/CLAUDE.md`, S165) — obrisan.
- Python skripte u scratchpad + `python -I`; hrvatski navodnici u bash heredocu lome naredbu —
  skripta u fileu.

## Otvoreno — kod (po prioritetu)

1. **„Review" sheet — provjera košara** (čeka Sašu; vidi Backlog).
2. **Filtar predug na malom ekranu** (B9) — razgovor o obliku.
3. **T23** naknada 1,32 uz MC rate „novog načina otplate"; **T13/T14** za MC u `fill_from_izvod`.
4. **F5** (`groupings` / `due` kroz Structure Excel) — roundtrip completeness.
5. Delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni u bojanju (Σ ih broji).
