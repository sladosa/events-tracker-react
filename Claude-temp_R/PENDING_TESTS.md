# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S89 (2026-06-09)
**Detalji testova:** [S89_tests.md](test-sessions/S89_tests.md)

---

## S89 — Perf: filter persist + chain cache + skeleton

| ID      | Test                                                                                                                     | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S89-1 | Zatvori browser, otvori ponovo → aktivni filter (Area+Category) je restauriran, tablica odmah učitava filtriran sadržaj | ⬜      |
| T-S89-2 | Add Activity drugi put za isti shortcut (ista sesija) → forma se otvori brže nego prvi put (chain cache hit)             | ⬜      |
| T-S89-3 | Skeleton: dok se Activities tablica učitava vide se animated placeholder redovi (ne prazan div/spinner)                  | ⬜      |

---

## S88 — Shortcut pre-fill (default_attributes) + UX bugfixes

| ID       | Test                                                                                                        | Status |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| T-S88-1  | Save as Shortcut iz Add Activity (s atributima) — `default_attributes` populiran u DB                       | ✅      |
| T-S88-2  | Update postojeći vs Save as new — choice modal, ne pravi duplikate slučajno                                 | ⬜      |
| T-S88-3  | Pre-fill vrijednosti pri odabiru shortcuta u Add Activity (preset default > static default_value)           | ✅      |
| T-S88-4  | Filter-bar info nudge ("Did you know?") — prikaz prvi put, "Don't show again" perzistira                    | ⬜      |
| T-S88-5  | "⚡ Use" fast-lane gumb — odmah otvara Add Activity za odabrani shortcut                                     | ✅      |
| T-S88-6  | Broken shortcut detekcija — toast + reset filtera + amber banner s "Delete shortcut" (BUGFIX)               | ✅      |
| T-S88-7  | Mobile — filter ostaje otvoren nakon odabira shortcuta, "⚡ Use" ostaje vidljiv (BUGFIX)                     | ✅      |
| T-S88-8  | Delete Shortcut button — vizualni kontrast aktivno/neaktivno (BUGFIX)                                       | ✅      |
| T-S88-9  | Duplikat imena shortcuta blokiran — toast error, save odbijen (BUGFIX)                                      | ✅      |
| T-S88-10 | Help panel — Add Activity chip "How do I save my values as a Shortcut?" + ažurirani docs/help/activities.md | ⬜      |

---

## S87 — Financije_3 flat import + StructureDeleteModal activity_presets bugfix

| ID      | Test                                                                                                                                             | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S87-1 | Financije_3 TEST: Activities tablica prikazuje leaf comment s prefiksom — npr. "ZABA: Parking", "RF: Mirovina I stup" (ne prazan comment)        | ⬜      |
| T-S87-2 | Financije_3 TEST: View Activity → jedina sekcija "Transakcija" s leaf badge + 8 atributa (Racun/Uplata/Isplata/Stanje/Valuta/Napomena/Smjer/Tip) | ⬜      |
| T-S87-3 | Financije_3 TEST: comment filter "DATUM_GREŠKA" → prikazuje samo problematične redove (41 kom); clear filter → svi redovi natrag                 | ⬜      |
| T-S87-4 | Delete Area s aktivnim shortcutom: u TEST bazi kreiraj shortcut na neku kategoriju → pokušaj brisanja → delete uspijeva bez FK greške            | ⬜      |

---

## S86 — Financije_2 import + StructureDeleteModal bugfixes

| ID      | Test                                                                                                                                   | Status |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S86-1 | Financije_2 import: 458 eventa kretirano, suggest dropdowni rade (npr. Zdravlje > Vrsta: Ljekarna/Liječnik/HLK/Optika/Passport/...)    | ✅      |
| T-S86-2 | Rashodi L1 event Add → Iznos bez EUR labela; Valuta pre-selected EUR; Račun suggest dropdown s opcijama bankovnih računa              | ✅      |
| T-S86-3 | StructureDeleteModal: pokušaj brisanja area → modal prikazuje stvarnu Supabase grešku (ne "Delete failed. Please try again.")          | ✅      |
| T-S86-4 | StructureDeleteModal: brisanje area s djelomično importanim eventima (eventCount=0 ali eventi postoje) → delete uspijeva bez FK greške | ✅      |

---
