# Pending Tests

**Zadnja izmjena:** 2026-03-29 (S29)
**Branch:** test-branch
**Detalji testova:** `Claude-temp_R/test-sessions/S28_tests.md`

---

## Aktivni (nepotvrđeni) testovi

| ID | Opis | Sesija | Detalji |
|----|----|--------|---------|
| T-S29-1 | Add Activity: Other → "Nova vrijednost" → Save+ → Finish → vidi u Structure Edit suggest opcijama | S29 | |
| T-S29-2 | Add Activity: Other u DependsOn atributu → Finish → opcija dodana u options_map[WhenValue] | S29 | |
| T-S29-3 | Structure Edit: DependsOn atribut prikazuje tablicu mapiranja (ne "read-only notice") | S29 | |
| T-S29-4 | Structure Edit: Editirati opcije za jedan WhenValue → Save → ispravno u Add Activity | S29 | |
| T-S29-5 | Structure Edit: Dodati novi WhenValue red → Save → radi u Add Activity | S29 | |
| T-S29-6 | Structure Edit: Obrisati WhenValue red → Save → više ne pojavljuje u Add Activity | S29 | |

---

## Zatvoreni (potvrđeni/riješeni) testovi iz ove sesije

| ID | Opis | Sesija | Status |
|----|------|--------|--------|
| T-IMP-1  | Import isti xlsx dvaput → 0 updated, N Unchanged                   | S28/S29 | ✅ (timezone fix S29) |
| T-IMP-2  | Import xlsx s jednom promijenom → 1 updated, N-1 skipped           | S28/S29 | ✅ (timezone fix S29) |
| T-IMP-3  | Import xlsx prazna vrijednost gdje DB ima → P3: skipped            | S28/S29 | ✅ |
| T-IMP-4  | Import backup odmah nakon exporta → sve skipped, 0 updated         | S28/S29 | ✅ |
| T-ATTR-1 | Add text atribut na leaf → vidljiv u View i Add Activity           | S28/S29 | ✅ (id fix S29) |
| T-ATTR-2 | Add number atribut s unit "km" → unit prikazan u Add Activity      | S28     | ✅ |
| T-ATTR-3 | Delete atribut bez evenata → direktno briše                        | S28     | ✅ |
| T-ATTR-4 | Delete atribut s eventima → warning, confirm → briše               | S28     | ✅ |
| T-ATTR-5 | Konverzija text → suggest → dropdown vidljiv u Add Activity        | S28     | ✅ |
| T-ATTR-6 | Slug collision pri Add → suffix _2 automatski                      | S28     | ✅ |
| T-S25-1  | Structure Import: Area-only → result summary, nova Area u filteru  | S25/S26 | ✅ |
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
| T-S27-1  | Delete node s eventima → amber header, "Download Backup & Delete" | S27     | ✅ |
| T-S27-1b | Delete node s eventima → naslov "Delete Category/Area" (ne "Cannot Delete") | S27 | ✅ |
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
> "T-IMP-1 OK, T-ATTR-1 OK" itd.

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
| [S27_tests.md](test-sessions/S27_tests.md) | S27 | ✅ Sve verificirano |
| [S28_tests.md](test-sessions/S28_tests.md) | S28 | ⏳ pending |
