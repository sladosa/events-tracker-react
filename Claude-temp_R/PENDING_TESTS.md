

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S100 (2026-06-27)
**Detalji testova:** [S100_tests.md](test-sessions/S100_tests.md)

---

## S100 — Export Profile (order+widths+filter) + BUG-S99-IMPORT fix + Dropdown fix

| ID       | Test                                                                              | Status |
| -------- | --------------------------------------------------------------------------------- | ------ |
| T-S100-1 | BUG-S99-IMPORT fix — import ne matcha krivu kategoriju kad 2 aree imaju isti path | ⬜      |
| T-S100-2 | Dependent dropdown za 'Izvor placanja' — dijakritici u opcijama                   | ⬜      |
| T-S100-3 | Export Profile — column order iz LEGEND-a                                         | ⬜      |
| T-S100-4 | Export Profile — column widths iz profila                                         | ⬜      |
| T-S100-5 | Export Profile — Filter sheet override                                            | ⬜      |
| T-S100-6 | Export Profile — Filter sheet format za Attribute filter                          | ⬜      |
| T-S100-7 | Import Profile toast prikazuje column order + widths info                         | ⬜      |

---

## S99 — Delete Area fixes (carryover, confirmed)

| ID      | Test                                                                                 | Status |
| ------- | ------------------------------------------------------------------------------------ | ------ |
| T-S99-2 | Delete Area (with events) — "Delete without backup" gumb vidljiv, radi               | ✅      |
| T-S99-7 | Koka importa Financije (2026+) na PROD kao owner                                     | ✅      |

---

## S95 — depends_on bugfixes + comment_template (carryover)

| ID       | Test                                                                  | Status |
| -------- | --------------------------------------------------------------------- | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate"                | ✅      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši   | ⬜      |

---
