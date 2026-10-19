> Pisano protiv `07361eb` (deploy 19.10.) + commita **S175 F5** koji nosi ovaj file.
> **`main` = `07361eb` (deploy 19.10.):** uvozni guard (S174) i Košare ↗ oznaka (S175) su na PROD-u.
> **F5 (`AreaSettings`, Structure export = jedna Area) je samo na `test-branch`** — čeka T-S175-6 i deploy.
> **PROD baza:** ni S174 ni S175 nisu pisale ništa (F5 ne traži migraciju).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S175 (2026-10-19)

> **Ukratko (S175):** otvorenih test sesija bilo je jedanaest, a većina je čekala isti događaj — prvi mjesečni krug u studenom — pa su ti testovi sažeti u tri (MC, Visa, ZABA) i jedno pitanje Koki, i sada su otvorene samo dvije; usput Košare ↗ po povratku označe kupnju (na PROD-u), a Structure Excel sada nosi i pločice, grupiranja i export profile (sheet `AreaSettings`, F5) — princip „sve ide importom" je zatvoren.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S175)
- **PENDING očišćen:** 2 test sesije umjesto 11. Studeni krug je jedan popis: `docs/sessions/tests/S175_tests.md`.
- **Na PROD-u od 19.10.:** uvoz razvrstavanja pita za „potvrđeno stanje" samo kad se mijenja bankino
  polje (S174); Košare ↗ po povratku označe kupnju s koje si krenuo.
- **Na `test-branch`:** F5 — Structure export nosi sheet `AreaSettings` (pločice Overviewa,
  grupiranja „Kamo ide novac", export profili, i svaka buduća postavka). Export je sada **jedna Area**.
  Activities uvoz „Create categories & continue" više ne vraća postojeću Areu na stanje iz starog filea.
- Koka: lista s iznosima i `+` iz prve — „sve vidim ok" (T-S175-4 ✅).

## Što treba od tebe — sad
1. **T-S175-6 (TEST, lokalno, ~10 min):** F5 — Structure export/import (koraci u `S175_tests.md`).
   Ako prođe ⇒ **deploy** (PowerShell blok iz CLAUDE.md § End of session 11).
2. **T-S174-3 (PROD)**, kad nastaviš ručno razvrstavanje: starija povijest s Kokom (ZABA) i ti (RF),
   pa **T-S174-5** (Nenini retci, tek poslije). File za ZABA na TEST-u već nosi tvojih ~123 ručnih odluka.
3. **Odluka iz S174:** `PARKING` (12/13) kao pravilo? `GLOVO` ostaviti ručno?

## Što treba od tebe — studeni (`S175_tests.md`)
- **~03.–11.11. T-S175-2 Visa:** traka (ti kao grantee: usporedba bez gumba), Koka upiše naplatu, `visa_uvoz_izvoda`.
- **~02.11. → 11.11. T-S175-1 MC:** `fill_from_izvod --mc`, Koka uvozi, ponovni prolaz 0/0, 11.11. traka.
- **ZABA_2026-10 T-S175-3:** `fill_from_izvod --zaba`, MC naplata 11.10. se ne smije dodati drugi put.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **F5 (S175):** `src/lib/areaSettingsSheet.ts` (čiste funkcije: `flattenAreaSettings`,
  `unflattenAreaSettings`, `mergeAreaSettings`, `OWNED_ELSEWHERE`), `writeAreaSettingsSheet` u
  `structureExcel.ts`, §11 na kraju `importStructureExcel` (nad svježom `existingArea.settings`),
  brojač u `StructureImportModal`. Export = jedna Area (`AppHome`, `aria-disabled`). Unit
  `areaSettingsSheet.test.mjs` nad fixtureom `fixtures/areaSettings_prod_2026-10-18.json`; E2E
  `S175_area_settings_roundtrip` (+ S119 i S107b-2 dobili odabir Aree). Pravila: CLAUDE.md § Excel.
- **Korak 7 (S175):** `importStructureExcel(..., { existingAreasUntouched: true })` iz `ExcelImportModal`
  — `keepArea()` preskače postojeće atribute (i K-1 za njih) i §8–§11 Aree koja je postojala prije
  uvoza. E2E `S175_create_categories_keeps_area`. Namjerni put (pregled razlika + datum izvoza, slučajevi
  C/D) je BACKLOG stavka „Napredak Aree između korisnika" — preduvjet za template (korak 4).
- **Paralelna sesija `trening.xlsm`:** ako ju je Saša pokrenuo, njen rezultat je
  `docs/TRENING_MIGRACIJA.md` — **neverificiran** dok ga netko ne pročita; u `DONE_HISTORY` i ovaj
  handoff unijeti tek tada.
- **PENDING:** 10 sekcija (S145–S173) preseljeno u `DONE_HISTORY`; T-S172-4 je stavka BACKLOG-a (E2E
  padovi S104-3/S107-3); T-S145-3 prati BUG-S145-BOOLEDIT u CLAUDE.md.
- **Guard (`6720662`):** `isBankKey(spec, key)` u `confirmedRowEdit.ts` je jedino pravilo; uvoz ga
  zove kroz `importBankChanges` u `analyzeUpdates`. `useAreaDashboard` vraća i `automations`.
- **`pravila_trgovca.py` (`568b7c5`):** `PRAVILA` (31), `kljuc_trgovca`, `po_pravilu`;
  `razvrstaj_na.iz_pravila` = 4. ključ. Radni stol `Claude-temp_R/s174_pravila/` (novo pravilo =
  isti put, nikad ručni upis bez brojanja).

## Otvoreno — kod (po prioritetu)
1. **`po_pravilu` u `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda`** — **prije studenog**, da
   T-S175-1/2 već dobiju prijedloge (Glovo/VPA iz MC_2026-09). Postojeći rječnici/presedan prvo.
   Prije: provjera unatrag na tim tokovima (S164). ⚠ Ne smije pomaknuti T-S173-1 harness
   (`Claude-temp_R/s173_mc/regresija.sh`) osim u `Tip`u.
2. Ako Saša odluči: `\bparking\b` (12/13) u `PRAVILA`.
3. **Strategic Position korak 3: `trening.xlsm`** (F5 je gotov, pločice trening Area sada mogu ići Excelom).
4. F5 dorade (ako zatreba): `set_*.py` skripte sada imaju alternativu u Excelu — ne brisati ih;
   rename Aree u appu i dalje lomi ključeve export profila (`attr:<Area>||`).
5. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
6. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (BACKLOG vrh) · E2E padovi (BACKLOG) ·
   „Review" sheet · delta retci ispod sekcije · ↗ ne vraća `attrFilter`.
