> Pisano protiv `13a9104` (S175 kod) + commita **S175 zatvaranje** koji nosi ovaj file.
> **`main` = `07361eb` (deploy 19.10.):** uvozni guard (S174) i Košare ↗ oznaka (S175) su na PROD-u.
> **Na `test-branch`, NIJE na PROD-u:** F5 (`AreaSettings`, Structure export = jedna Area) i
> „Create categories & continue" ne dira postojeću Areu — čekaju T-S175-6 i deploy (bez migracije).
> **PROD baza:** S174 i S175 nisu pisale ništa.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S175 (2026-10-19)

> **Ukratko (S175):** otvorenih test sesija bilo je jedanaest, a većina je čekala isti događaj — prvi mjesečni krug u studenom — pa su ti testovi sažeti u tri i jedno pitanje Koki; Košare ↗ po povratku označe kupnju (na PROD-u), Structure Excel sada nosi i pločice, grupiranja i export profile (F5, „sve ide importom" zatvoreno), stari Activities file više ne vraća Areu unatrag, a paralelna sesija je izmjerila `trening.xlsm` i postavila 17 pitanja za migraciju treninga.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S175)
- **Testovi:** 2 test sesije umjesto 11; studeni krug je jedan popis (`docs/sessions/tests/S175_tests.md`).
  Koka: lista s iznosima i `+` iz prve — „sve vidim ok".
- **Na PROD-u (19.10.):** uvoz razvrstavanja pita samo za bankino polje (S174); Košare ↗ po povratku
  označe kupnju.
- **Na `test-branch`:**
  - **F5** — Structure Excel nosi i pločice Overviewa, grupiranja „Kamo ide novac", export profile
    i svaku buduću postavku (sheet `AreaSettings`). Structure export je **jedna Area**.
  - **Stari Activities file ne vraća Areu unatrag** — „Create categories & continue" samo dodaje ono
    što nedostaje.
- **Trening:** `docs/TRENING_MIGRACIJA.md` — dnevnik ima 7.451 dan od 2006., bez rupa; prijedlog je
  privatna Area `Dnevnik` s `Trening` (svaki dan) i `Dan` (privatno/zdravlje).

## Što treba od tebe
1. **T-S175-6 (TEST, lokalno, ~10 min):** Structure export/import s `AreaSettings` (`S175_tests.md`).
   Ako prođe ⇒ **deploy** (PowerShell blok iz CLAUDE.md § End of session 11).
2. **Trening — pitanja Q1–Q3** iz `docs/TRENING_MIGRACIJA.md` §5 (blokiraju generator):
   ime Aree i leafova, fiksno vrijeme `session_start` (prijedlog 06:00), nastavljaš li pisati
   `trening.xlsm` ili prelaziš na app. Ostala pitanja (Q4–Q17) mogu i poslije.
3. **T-S174-3 (PROD)** kad nastaviš ručno razvrstavanje (ZABA file na TEST-u nosi ~123 tvojih odluka),
   pa **T-S174-5** (Nenini retci).
4. **Odluka iz S174:** `PARKING` (12/13) kao pravilo? `GLOVO` ručno?

## Studeni (`S175_tests.md`)
- **~03.–11.11. T-S175-2 Visa** · **~02.11. → 11.11. T-S175-1 MC** · **ZABA_2026-10 T-S175-3**.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **F5:** `src/lib/areaSettingsSheet.ts` (`flattenAreaSettings`, `unflattenAreaSettings`,
  `mergeAreaSettings`, `OWNED_ELSEWHERE`), `writeAreaSettingsSheet` u `structureExcel.ts`, §11 na kraju
  `importStructureExcel`, brojač u `StructureImportModal`; export = jedna Area (`AppHome`,
  `aria-disabled`). Unit `areaSettingsSheet.test.mjs` (fixture PROD 18.10.); E2E
  `S175_area_settings_roundtrip`. Pravila: CLAUDE.md § Excel.
- **Korak 7:** `importStructureExcel(..., { existingAreasUntouched: true })` iz `ExcelImportModal`;
  `keepArea()` u K-1, §7, §8–§11. E2E `S175_create_categories_keeps_area`; `supabasePatch` u
  `e2e/fixtures/auth.ts` (baca na 0 redaka).
- **Trening:** `docs/TRENING_MIGRACIJA.md` (commit `5607040`, paralelna sesija) — **pročitan, brojke
  nisu ponovo mjerene**. Uputnice `Diary.md` / `AUTOMATION_SPEC` F4 / `DATA_PIPELINE_PLAN` P5 /
  BACKLOG / `MIGRATION_STATE` još upućuju na stari plan — preusmjeriti uz odgovore (TRENING §6 korak 1).
  Kopija filea: `Claude-temp_R/trening/trening.xlsm`.
- **E2E:** jednom viđen prazan izbornik Area u nizu specova (BACKLOG, uz T-S172-4).

## Otvoreno — kod (po prioritetu)
1. **`po_pravilu` u `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda`** — **prije studenog**
   (Glovo/VPA iz MC_2026-09). Postojeći rječnici/presedan prvo; provjera unatrag prije (S164).
   ⚠ Ne smije pomaknuti T-S173-1 harness (`Claude-temp_R/s173_mc/regresija.sh`) osim u `Tip`u.
2. **Trening generator** (`data-prep_tools/Trening/trening_to_xlsx.py`) — tek kad stignu Q1–Q3.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika") — preduvjet
   za Financije-template (Strategic Position korak 4), uz D3.
4. Ako Saša odluči: `\bparking\b` (12/13) u `PRAVILA`.
5. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
6. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (BACKLOG vrh) · „Review" sheet ·
   delta retci ispod sekcije · ↗ ne vraća `attrFilter`.
