# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S89 (2026-06-09)
**Detalji testova:** [S89_tests.md](test-sessions/S89_tests.md)

---

## S89 — Perf: filter persist + chain cache + skeleton

| ID      | Test                                                                                                                     | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S89-1 | Zatvori browser, otvori ponovo → aktivni filter (Area+Category) je restauriran, tablica odmah učitava filtriran sadržaj | ✅      |
| T-S89-2 | Add Activity drugi put za isti shortcut (ista sesija) → forma se otvori brže nego prvi put (chain cache hit)             | ✅      |
| T-S89-3 | Skeleton: dok se Activities tablica učitava vide se animated placeholder redovi (ne prazan div/spinner)                  | ✅      |

---

## S88 — Shortcut pre-fill (default_attributes) + UX bugfixes

| ID       | Test                                                                                                        | Status |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| T-S88-1  | Save as Shortcut iz Add Activity (s atributima) — `default_attributes` populiran u DB                       | ✅      |
| T-S88-2  | Update postojeći vs Save as new — choice modal, ne pravi duplikate slučajno                                 | ✅      |
| T-S88-3  | Pre-fill vrijednosti pri odabiru shortcuta u Add Activity (preset default > static default_value)           | ✅      |
| T-S88-4  | Filter-bar info nudge ("Did you know?") — prikaz prvi put, "Don't show again" perzistira                    | ✅      |
| T-S88-5  | "⚡ Use" fast-lane gumb — odmah otvara Add Activity za odabrani shortcut                                     | ✅      |
| T-S88-6  | Broken shortcut detekcija — toast + reset filtera + amber banner s "Delete shortcut" (BUGFIX)               | ✅      |
| T-S88-7  | Mobile — filter ostaje otvoren nakon odabira shortcuta, "⚡ Use" ostaje vidljiv (BUGFIX)                     | ✅      |
| T-S88-8  | Delete Shortcut button — vizualni kontrast aktivno/neaktivno (BUGFIX)                                       | ✅      |
| T-S88-9  | Duplikat imena shortcuta blokiran — toast error, save odbijen (BUGFIX)                                      | ✅      |
| T-S88-10 | Help panel — Add Activity chip "How do I save my values as a Shortcut?" + ažurirani docs/help/activities.md | ✅      |

---

