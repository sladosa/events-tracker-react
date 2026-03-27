# Pending Tests

**Zadnja izmjena:** 2026-03-27 (S27)
**Branch:** test-branch
**Detalji testova:** `Claude-temp_R/test-sessions/S27_tests.md`

---

## S28 plan (sljedeća sesija)

**P1 — Import diff** — spec: `docs/IMPORT_DIFF_SPEC.md`
- Proširiti fetch query: dodati `event_date, session_start, comment` + attr vrijednosti
- Diff helper: identično → `skipped`, promjena → `updated`
- UI: treći box "N Events unchanged" (siva boja)
- P3 rubni slučaj: prazna xlsx vrijednost + DB ima vrijednost → skipped (ne diraj)

**P2 — Add/Delete Attribute u Structure Edit** — spec: `docs/ADD_ATTRIBUTE_SPEC.md`
- "Add Attribute" inline forma (name, type, unit, required) → INSERT `attribute_definitions`
- Delete Attribute s warning ako ima `event_attributes`
- Text → Suggest konverzija (gumb "→ Suggest" na text atributima)
- DependsOn editing UI — složenije, možda odvojena sesija

---

## Aktivni (nepotvrđeni) testovi

| ID       | Opis                                                                                      | Sesija | Detalji                                                           |
| -------- | ----------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| T-S27-1b | Delete node s eventima → naslov "Delete Category/Area" (ne "Cannot Delete")              | S27    | Fix S27 kraj sesije — retest |

## Zatvoreni (potvrđeni/riješeni) testovi iz ove sesije

| ID | Opis | Sesija | Status |
|----|------|--------|--------|
| T-S25-1  | Structure Import: Area-only → result summary, nova Area u filteru | S25/S26 | ✅ |
| T-S25-2  | Leaf bez evenata → badge "no events yet" vidljiv u tabeli         | S25     | ✅ |
| T-S25-3  | Leaf s eventima → nema "no events yet" badge                      | S25     | ✅ |
| T-S22-T3 | Delete Area (prazna)                                              | S22     | ✅ |
| T-S26-1  | Activities Export → attr kolone od H, comment samo G, freeze na H | S26     | ✅ |
| T-S26-2  | Activities Export → LEGEND: 6 kolona, C1 napomena                 | S26     | ✅ |
| T-S26-3  | Activities Export → HelpEvents sheet, PINK/BLUE/ORANGE boje       | S26     | ✅ |
| T-S26-4  | Structure Export → 4 sheeta (Events stub, Structure, HelpStructure, Filter) | S26 | ✅ |
| T-S26-5  | Structure Export → Filter sheet ispravni podaci                   | S26     | ✅ |
| T-S26-6  | Activities Export → 5 sheetova                                    | S26     | ✅ |
| T-S26-7  | Activities Export → Filter sheet datumi + Period label            | S26     | ✅ (fiksirano) |
| T-S26-8  | Activities Export → filename s punim timestamp                    | S26     | ✅ |
| T-S26-9  | Filter sheet: Period label = 'All time' / 'Custom'                | S27     | ✅ |
| T-S26-10 | Activities Export: Structure sheet filtriran prema Area/Category  | S26     | ✅ |
| T-S27-1  | Delete node s eventima → amber header, "Download Backup & Delete" | S27     | ✅ (naslov još nije bio OK, fixan kraj sesije) |
| T-S27-2  | Delete s backupom → backup downloada, node nestaje                | S27     | ✅ |
| T-S27-3  | Backup workbook → 5 sheetova, Filter sheet ispravno               | S27     | ✅ |
| T-S27-4  | Delete bez evenata → red header, stari flow                       | S27     | ✅ |
| T-S24-1  | Import Area-only Excel reda → kreira Area                         | S24     | ❌ → riješeno S25 |
| T-S24-2  | Add Child na leaf s eventima → orange blocked state               | S24     | ✅ |
| T-S24-3  | Add Area UI → gumb u Edit Mode, modal, kreira area, refresh dropdown | S24  | ✅ |
| T-S24-5  | Regression: T4, T5, T9 i dalje rade                               | S24     | ✅ |

---

## Napomena: T-S26-10 invalid date issue

Korisnik je unio "29/02/2026" kao From datum — ali Feb 29 ne postoji u 2026 (nije prijestupna godina).
`type="date"` input vraća `""` za nevažeće datume → filter ostaje na auto-inicijaliziranoj vrijednosti.
Ovo je očekivano ponašanje browsera, nije bug u kodu.
**Za retest: koristiti važeći datum (npr. 2026-02-01), zatim exportirati i provjeriti Structure sheet.**

---

## Kako koristiti

**Testiranje:** Pokreni aplikaciju lokalno (`npm run dev`) i prođi kroz korake u linkovanim fajlovima.

**Sljedeća sesija — javi rezultate:**
> "T-S26-9 OK, T-S26-10 OK"

Claude će: ažurirati ovaj fajl, označiti ✅/❌ u test-sessions arhivi, istražiti failove.

---

## Arhiva prethodnih sesija

| Fajl | Sesije | Status |
|------|--------|--------|
| [S01-S14_summary.md](test-sessions/S01-S14_summary.md) | S01–S14 | ✅ Sve verificirano |
| [S15-S21_tests.md](test-sessions/S15-S21_tests.md) | S15–S21 | ✅ Sve verificirano |
| [S22_tests.md](test-sessions/S22_tests.md) | S22 | ✅ Sve verificirano |
| [S23_tests.md](test-sessions/S23_tests.md) | S23 | ✅ Sve verificirano |
| [S24_tests.md](test-sessions/S24_tests.md) | S24 | ✅ Sve verificirano |
| [S26_tests.md](test-sessions/S26_tests.md) | S26 | ✅ Sve verificirano |
| [S27_tests.md](test-sessions/S27_tests.md) | S27 | ⏳ T-S27-1 do T-S27-4 pending |
