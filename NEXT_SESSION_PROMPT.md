# NEXT SESSION PROMPT — nakon S116 (kod je gotov i djelomično provjeren; kolovoz čeka uvoz)

**Pisan protiv commita `9fa05e1`** (+ commit zatvaranja S116 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S116. `main` = PROD, **nije diran od S107**.

> S116 je bio dug dan: kolone po Arei, `--iz-koke`, dva popravka sidra i prvo stvarno
> testiranje u pregledniku. **Sljedeći korak je dogovoren: uvoz kolovoza.**

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je napravljeno

**Kolone po Arei.** Financije lista pokazuje `Datum | Iznos | Tip / Podtip | Opis | User |
Stanje | ⋮`, na mobitelu u dva reda. Ostale Aree izgledaju točno kao prije. Postava putuje
Structure Excelom, pa se mijenja bez mene. ⚠ **Još nije viđena u pregledniku.**

**Sidro — dva popravka.** Prvi: datum potvrde više ne dolazi od klika nego od **izvora**
(izvod → upisuješ datum zatvaranja, ekran → app računa sam). Drugi, tvoj nalaz: očitanje s
ekrana sidri se na **jučer**, s oduzetim današnjim prometom — inače današnje transakcije
ispadnu iz salda. **Oboje provjereno uživo i radi.**

**Ispod pločice je „povijest potvrda"** sa ✕ za brisanje. SQL Editor za sidra više ne treba.

**Kolovoz je izmjeren i pripremljen, ali NIJE uvezen.**

## 2. Što slijedi — dogovoreno

1. **Uvoz kolovoza.** Koraci i kontrolni brojevi: `docs/sessions/tests/S116_tests.md`,
   T-S116-7 (ZABA → **`13.239,31`**) i T-S116-8 (RF → **`796,43`**).
   - ⚠ Delta sheet izvezi s **najmanje 60 praznih redaka** (zadanih 40 nije dosta).
   - ⚠ Prvo pusti `--dry` i provjeri da i dalje piše **14 novih**. Njen se file mijenja
     svakih par dana; između `08-16` i `08-23` pojavilo se 20 novih redaka poslije 30.07.
   - ⚠ Skupna MC naplata `1.332,52` **nije** među tih 14 i ne smije se izmisliti — piše na
     `MC_2026-07.pdf` i uvozi se zasebno. Bez nje pločica na 13.08. neće dati `13.239,31`.

2. **Pogledaj kolone** (T-S116-1…5) — to je najveći komad koda koji nitko još nije vidio.

3. **Tek onda PROD**, i samo na tvoj izričit „idi".

## 3. Što stoji na tebi

- **Reci Koki za retke s krivom godinom** — `2036-04-08` (`Mirovina 1.323,64`,
  `Netdomena Igor 47,76`) i `2028-05-16` (`HLK 5/26`). Ispravak ide **u njen file**.
- **Redak `07.08. Parking 1,60`** je tipfeler u mjesecu (treba `07.07.`) — kod nas je
  isključen, kod nje je i dalje krivo.
- **Onih 5 spornih lipanjskih redaka** (Σ `373,11`) i 11 kartičnih bez para iz S113.
- **Odluka o siročadi:** 57 testova iz `S99`–`S104` postoji u fajlovima, a `PENDING_TESTS.md`
  ih uopće ne spominje. Jesu li još relevantni? (v. sekcija „Siročad" u tom fileu.)
- **Kad dođe dan prelaska: jedna rečenica njoj** — *„kad počneš upisivati u app, u Excelicu
  više ne."*

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S116** (tri dijela) · `CLAUDE.md` → „Critical rules"
(nova sekcija **Kolone Activities liste**, dvije zamke o sidru, pet o Kokinom fileu kao
izvoru) · `docs/sessions/tests/S116_tests.md` · `ENRICH_PLAN.md` **S116**.

## 2. Provjereno uživo 23.08. (TEST baza)

| test | ishod |
| --- | --- |
| T-S115-2 | ✅ sidro na račun bez ijednog eventa daje redak pločice |
| T-S116-6 | ✅ ZABA sidro na 30.07. |
| T-S116-13 | ✅ povijest potvrda, ▸ oznaka, brisanje s ✕ (⚠ grantee slučaj neproban) |
| **T-S116-14 A/B/C** | ✅ **jezgra** — `799,12` → event danas `−40` → **`759,12 €`** |
| T-S116-10, -11 | ⚠ **djelomično** — samo put „ekran"; put „izvod" nije proban |
| T-S116-1…5, -7…9, -12, -14 D/E | ⬜ |

## 3. Izmjereno u S116 (ništa procijenjeno)

| Što | Vrijednost |
| --- | --- |
| `ZABA_2026-07.pdf` | close **2026-07-30** · NOVO **`13.815,33`** |
| `RF_2026-07.pdf` | close **2026-08-11** ⇒ RF sidro `11.08. = 799,12` je **točno** |
| app iz sidra 01.07. → 30.07. | **`13.815,33`** (38 eventa), Δ = 0 — netautološka provjera |
| Kokin file `2026-08-23` | 3.735 redaka · **175** nakon 30.07. · saldo dira **23** |
| novih za uvoz | ZABA **14** (bez retka 2564), RF **1** |
| njen lanac ZABA → 13.08. | **`13.239,31`** ✓ · RF → **`796,43`** |
| retci s tekstualnim datumom | **103**, svi 2023. — prepreka za batch 2023 |
| sidara u TEST bazi | **6**, sve provjereno |

## 4. Stanje koda

Nove datoteke: `src/lib/listColumns.ts`, `src/hooks/useListColumnValues.ts`,
`data-prep_tools/Financije/{anchors,set_list_columns}.py`, `data-prep_tools/Tools/audit_tests.py`.
Dirani: `ActivitiesTable.tsx`, `useAreaDashboard.ts`, `structureExcel.ts`, `structureImport.ts`,
`StructureNodeEditPanel.tsx`, `StructureImportModal.tsx`, `types/database.ts`,
`BalanceByGroupTile.tsx`, `overviewApi.ts`, `fill_from_izvod.py`, `docs/help/overview.md`.

`npm run typecheck && npm run build` prolaze.

## 5. Otvoreno / neverificirano

- **Kolone (T-S116-1…5) nitko nije vidio.** Config je u bazi, kod je commitan. Prvo to.
- **Put „izvod" u potvrdi sidra nije proban** — prazno polje za datum, ugašen gumb, odbijanje
  budućeg datuma. Brzo je: odaberi `ispisano stanje s izvoda` i gledaj što se pojavi.
- **T-S116-14 D/E** — upozorenje uz prošli datumski filtar, i svjesna granica (transakcija
  prije očitanja upisana **nakon** potvrde broji se dvaput; rješava je redoslijed unosa).
- **Prvo sidro na praznoj Arei se ne može upisati kroz UI.** Sašina odluka: **ne gradi se**
  (v. CLAUDE.md). Ugrize samo kod **novog bankovnog računa**.
- **BUG-S114-REPORTDD** — izvještaj o uvozu nema `DropdownData`. Za pipeline nebitno,
  **za Koku bitno**: ondje bi dorađivala uvezeno, a tipkala bi slobodan tekst bez provjere.
- **Faza 3** (automatika na Import putu) — jedna rupa drži tri featurea.
- **Siročad u `PENDING_TESTS.md`** — 57 testova bez retka; čeka Sašinu odluku.
- **Ideja koju vrijedi izvagati:** E2E test za Overview pločicu. Logika sidra je najnosiviji
  i najmanje pokriven dio; `e2e/setup/seed.sql` ima Areu `Financije` **bez** `dashboard`
  configa, pa treba seed proširiti. ~1–1,5 h.
