# Pending Tests

**Zadnja izmjena:** 2026-03-30 (S30)
**Branch:** test-branch
**Detalji testova:** `Claude-temp_R/test-sessions/S30_tests.md`

---

## Aktivni (nepotvrđeni) testovi

| ID | Opis | Sesija | Bilješka |
|----|----|--------|---------|
| T-S29b-1 | Add Activity: Other → 'A' + Other → 'B' za ISTI atribut → Finish → OBA vidljiva u Structure Edit | S29b | ✅ Potvrđeno od korisnika |
| T-S29b-2 | Structure Edit: otvoriti depends_on atribut → "Depends on" dropdown odmah prikazuje ispravni parent | S29b | Zamijenjen s T-S30-1 (novi feature) |
| T-S30-1 | Depends-on dropdown: ancestor atributi prikazani u optgroup "↑ LevelName" | S30 | ✅ |
| T-S30-2 | Depends-on dropdown: odaberi ancestor atribut → Save → radi u Add Activity | S30 | ✅ |
| T-S30-3 | Depends-on dropdown: orphan slug (attr obrisan) → prikazan "⚠ slug (not found)" | S30 | ✅ |
| T-S30-4 | Delete attr koji je depends_on referenca → amber warning s listom referenci i slug info | S30 | ✅ |
| T-S30-5 | Delete attr koji NIJE referenca → nema amber warning (samo postojeći red/no-data flow) | S30 | ✅ |

---

## Zatvoreni (potvrđeni/riješeni) testovi

| ID | Opis | Sesija | Status |
|----|------|--------|--------|
| T-S29b-1 | Add Activity: Other → 'A' + Other → 'B' za ISTI atribut → Finish → OBA vidljiva | S29b | ✅ |
| T-S29-1  | Add Activity: Other → Save+ → Finish → vidi u Structure Edit suggest opcijama | S29 | ✅ |
| T-S29-2  | Add Activity: Other u DependsOn (Strength_type=Upp) → Finish → opcija u options_map["Upp"] | S29 | ✅ |
| T-S29-3  | Add Activity: Other → Finish odmah (bez Save+) → opcija persists | S29 | ✅ |
| T-S29-3b | Add Activity: Other → 'A' + Other → 'B' → Finish → oba vidljiva | S29 | ✅ (bug otkriven: 'A' nestaje; fixano u S29b) |
| T-S29-4  | Structure Edit: DependsOn atribut prikazuje WhenValue/Options tablicu | S29 | ✅ |
| T-S29-5  | Structure Edit: Editirati opcije za WhenValue → Save → ispravno u Add Activity | S29 | ✅ |
| T-S29-6  | Structure Edit: Dodati novi WhenValue red → Save → radi u Add Activity | S29 | ✅ |
| T-S29-7  | Structure Edit: Obrisati WhenValue red → Save → nestaje iz Add Activity | S29 | ✅ |
| T-S29-8  | Structure Edit: Promijeniti parent atribut → Save → DB ažuriran | S29 | ✅ |
| T-S29-9  | View panel: DependsOn atribut prikazuje tablicu mapiranja | S29 | ✅ |
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
| T-S26-4  | Structure Export → 4 sheeta                                       | S26     | ✅ |
| T-S26-5  | Structure Export → Filter sheet ispravni podaci                   | S26     | ✅ |
| T-S26-6  | Activities Export → 5 sheetova                                    | S26     | ✅ |
| T-S26-7  | Activities Export → Filter sheet datumi + Period label            | S26     | ✅ |
| T-S26-8  | Activities Export → filename s punim timestamp                    | S26     | ✅ |
| T-S26-9  | Filter sheet: Period label = 'All time' / 'Custom'                | S27     | ✅ |
| T-S26-10 | Activities Export: Structure sheet filtriran prema Area/Category  | S26     | ✅ |
| T-S27-1  | Delete node s eventima → amber header, "Download Backup & Delete" | S27     | ✅ |
| T-S27-1b | Delete node s eventima → naslov "Delete Category/Area"            | S27     | ✅ |
| T-S27-2  | Delete s backupom → backup downloada, node nestaje                | S27     | ✅ |
| T-S27-3  | Backup workbook → 5 sheetova, Filter sheet ispravno               | S27     | ✅ |
| T-S27-4  | Delete bez evenata → red header, stari flow                       | S27     | ✅ |
| T-S24-2  | Add Child na leaf s eventima → orange blocked state               | S24     | ✅ |
| T-S24-3  | Add Area UI → gumb u Edit Mode, modal, kreira area, refresh dropdown | S24  | ✅ |

---

## Kako koristiti

**Testiranje:** Pokreni aplikaciju lokalno (`npm run dev`) i prođi kroz korake u linkovanim fajlovima.

**Sljedeća sesija — javi rezultate:**
> "T-S29b-1 OK, T-S29b-2 fail" itd.

Claude će: ažurirati ovaj fajl, označiti ✅/❌, istražiti failove.

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
| [S28_tests.md](test-sessions/S28_tests.md) | S28 | ✅ Sve verificirano (S29) |
| [S29_tests.md](test-sessions/S29_tests.md) | S29 | ✅ Sve verificirano |
