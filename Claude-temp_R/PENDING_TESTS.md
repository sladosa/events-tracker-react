# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S96 (2026-06-22)
**Detalji testova:** [S96_tests.md](test-sessions/S96_tests.md)

---

## S96 — Shared filter helper + dynamic periods + Export Profile + suggest validation

| ID       | Test                                                                                                         | Status |
| -------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| T-S96-1  | Activities table loads normally (regression — filter refactor)                                                | ⬜      |
| T-S96-2  | Export respects commentSearch (count + data match)                                                            | ⬜      |
| T-S96-3  | Period dropdown: "Last 2 Months" + "Last 3 Months" visible and resolve correctly                             | ⬜      |
| T-S96-4  | Save shortcut with filter state (period + sort) → load restores dynamically                                  | ⬜      |
| T-S96-5  | Shortcut with attrFilter saved/restored                                                                      | ⬜      |
| T-S96-6  | Export xlsx Filter sheet includes "Period key" row                                                            | ⬜      |
| T-S96-7  | Preview export (10 rows) — no grouping, all columns visible                                                  | ⬜      |
| T-S96-8  | Import Profile from grouped xlsx → saved in area.settings                                                    | ⬜      |
| T-S96-9  | Export with profile → columns grouped/collapsed + profile name in Filter sheet + filename                    | ⬜      |
| T-S96-10 | Delete profile → removed from dropdown                                                                       | ⬜      |
| T-S96-11 | LEGEND col F shows "Default" (not "Unit") with default_value data                                            | ⬜      |
| T-S96-12 | Suggest columns have Excel dropdown Data Validation in exported xlsx                                         | ⬜      |

---

## S95 — depends_on bugfixes + comment_template (carryover, low priority)

| ID       | Test                                                                                                   | Status |
| -------- | ------------------------------------------------------------------------------------------------------ | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null                                  | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate"                                                  | ⬜      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši                                    | ⬜      |

---

## S94 — Rata modal (PROD, Koka testiranje)

| ID      | Test                                                                                                                                     | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S94-1 | PROD: Add Activity → Financije > Transakcija; Rate?=Da → rata modal s 3 rate                                                            | ⬜      |
| T-S94-2 | PROD: "Kreiraj 3 rata" → originalni event nestaje, 3 nova rata eventa                                                                   | ⬜      |
| T-S94-3 | PROD: "Preskoči" → modal se zatvori, event ostaje s Rate?=Ne                                                                            | ⬜      |
| T-S94-4 | Filter Status=Planiran → Export → samo Planiran eventi                                                                                   | ⬜      |

---
