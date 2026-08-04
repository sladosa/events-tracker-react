# NEXT SESSION PROMPT — nakon S107w (Delete? kolona + izvještaj)

**Zadnja sesija: S107w (2026-08-04, Opus).** Oba koraka iz prošlog handoffa **napravljena,
otestirana i pushana** na `test-branch` (`f10f2a9`). PROD nije diran.

**Trajni plan prelaska:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13**.
**Detalji ove sesije:** `Claude-temp_R/test-sessions/S107w_tests.md` · popis testova:
`Claude-temp_R/PENDING_TESTS.md` · trajni zapis: `CLAUDE.md` (sekcija „Done 2026-08-04 (S107w …)").

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što sad radi

**Brisanje kroz Excel.** U izvezenom fileu, skroz desno, stoji kolona **`Delete?`**. Odabereš
`DELETE` iz padajućeg izbornika, uvezeš — zapis nestane. Prije nego što se išta obriše, uvoz
pokaže **popis što točno nestaje** i traži **zasebnu kvačicu** (odvojenu od one za izmjene).

Sitnice koje su namjerno tako:
- prihvaća se **samo** `DELETE` ili prazno; bilo što drugo (npr. `TRUE`) je greška i uvoz stane
- označeni redak **pocrveni** u Excelu
- **brisanje retka iz Excela ne briše ništa** — briše samo ta zastavica
- stari izvezeni fileovi (bez te kolone) rade kao i prije

**Izvještaj nakon uvoza.** Sam se skine i **nije popis nego radni file**: izgleda kao običan
export, ali sadrži samo zapise koje je taj uvoz dirnuo. Vidiš grešku — označiš je `DELETE`
u izvještaju i uvezeš **taj isti file**. Petlja se zatvara u jednom fileu.

## Što čeka tebe (kad budeš imao vremena)

Testovi **T-S107w-4…9** u `PENDING_TESTS.md` (koraci: `test-sessions/S107w_tests.md`).
Dva su važna, ostalo je kozmetika:
1. **T-S107w-8 (Fitness):** aktivnost s 2 zapisa → obriši samo jedan → aktivnost mora i dalje
   raditi; obriši i drugi → nestaje cijela. (Financije ovo ne testiraju — tamo nema roditelja.)
2. **T-S107w-5:** označi `DELETE`, pa sortiraj tablicu po drugoj koloni — zastavica mora ostati
   na svom retku.

## I dalje otvoreno (nepromijenjeno)

1. **Red 4997 u Reviewu** (MC 21,88 €) — pitanje za Koku: duplikat reda 4247?
2. **Red 4996** (parking 1,60 €) — datum je kriv (stoji 07.08., pripada 04.–08.07.).
   ⚠ Kad se popravi, **ne** kroz novi batch — dobio bi 09:00 na već uvezen dan. Ide kroz app
   ili export → uredi → import (sad se to i može ispraviti/obrisati).
3. 700 € bankomat 26.11.2025. i `Saldo kontrola` (7 razlika) — pitanja za Koku.

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje grana

| grana | commit | sadrži |
| --- | --- | --- |
| `test-branch` | `f10f2a9` | S107v + **S107w** |
| `main` (PROD) | `3930c8e` | sve osim fixa za kopirani redak i cijelog S107w |

`typecheck` + `build` čisti. Radna kopija čista.
**`main` namjerno zaostaje** — Koka još ne koristi Excel roundtrip. Na PROD ide zajedno:
fix za kopirani redak (S107v) + `Delete?` + izvještaj (S107w), **tek nakon T-S107w-4…9**.

## Što je S107w dodao (kratko; puni opis u `CLAUDE.md`)

- `excelExport.ts` — `Delete?` kolona (DV `DELETE`/prazno, crveni CF, u autofilteru, vidljiva)
  + opcionalne `Result`/`Source row`/`Changed` kolone za izvještaj
- `excelImport.ts` — parsiranje zastavice, klasifikacija, `analyzeDeletes()`, `applyDeletes()`
- `excelImportReport.ts` (novo) + `loadEventsByIdsForExport()` u `excelDataLoader.ts`
- `ExcelImportModal.tsx` — zaseban delete guard, auto-download izvještaja
- `e2e/tests/S107w_delete_column.spec.ts` — 3 testa, PASS

**Tri stvari koje ne otkrivati ponovo:**
1. Delete se mora odvojiti **prije** `row_hash` skipa — otisak ne pokriva zastavicu.
2. Kopirani redak označen `DELETE` je **greška**, ne brisanje (nosi originalov `event_id`).
3. Izvještaj se **sastavlja u jednom prolazu**; ExcelJS load/save roundtrip ne jamči DV/CF/
   skriveni `DropdownData`.

## Sljedeći koraci (prijedlog)

1. **T-S107w-4…9** (Saša) → ako prođu, **PROD deploy** (merge `test-branch` → `main` + sync back,
   ⚠ samo na izričit Sašin zahtjev — Netlify build troši kredite)
2. **Sljedeći batchevi importa:** `--to 2025-12-31`, pa unatrag. Granica **uvijek na danu** —
   inače se `session_start` (09:00 + n) sudari s već uvezenim danom
3. Reklasifikacija N/A hrpe kroz app + Excel petlju (plan iz S107q: import prvi, klasifikacija poslije)

## Otvoreno (nepromijenjeno od S107v)

- **T-S107v-7 (PROD):** kad se View opet ne otvori nakon Finish — **poslati poruku s ekrana**
  („Couldn't load this activity" + tekst greške vs „Activity not found"). Uzrok još nije nađen.
- **E2E cold start:** prvi test u hladnom pokretanju zna pasti (danas `S104_delete_bug` — prošao
  sam u ponovnom pokretanju; uzrok je leftover iz prekinutog pokušaja jer `beforeEach` inserta
  bez čišćenja). Predloženo: timeout 10 → 20 s u `e2e/fixtures/filter.ts`, još nije napravljeno.
- `sql/033_delete_area_cascade.sql` SECTION 2b — jesu li policyji iz `020_orphan_rls.sql` na TEST-u
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu
- `T-S107u-2` — `groupAttributes` uzima `Default` s prvog retka grupe (bezopasno, konvergira)
- **Bulk delete (checkbox) nije ograničen za grantee-a** — stari backlog
- `Claude-temp_R/` je gitignoriran ⇒ test-session dokumenti su **samo lokalni** + na vanjskom disku
  (`Tools/backup_to_external.bat`). Trajni zapis ide u `CLAUDE.md`.
