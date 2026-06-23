

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S97 (2026-06-23)
**Detalji testova:** [S97_tests.md](test-sessions/S97_tests.md)

---

## S97 — Shortcut filter fix + "In any attribute" + non-leaf shortcuts + dependent dropdowns

| ID       | Test                                                                                      | Status |
| -------- | ----------------------------------------------------------------------------------------- | ------ |
| T-S97-1  | Switch between shortcuts: attrFilter/commentSearch/sortOrder properly reset               | ⬜      |
| T-S97-2  | Shortcut with saved attrFilter: filter restored correctly after switch                   | ⬜      |
| T-S97-3  | "In any attribute" filter: select option, type text → events filtered across all attrs   | ⬜      |
| T-S97-4  | "In any attribute" works with Export (correct count + data)                               | ⬜      |
| T-S97-5  | Save shortcut at non-leaf level (e.g. L1 category) → dropdown shows it, loads correctly  | ⬜      |
| T-S97-6  | Save shortcut at area-only level → loads correctly (no category selected)                 | ⬜      |
| T-S97-7  | "⚡ Use" button only visible for leaf-level shortcuts (not non-leaf)                      | ⬜      |
| T-S97-8  | Export xlsx with dependent attr: "Tip" column has INDIRECT dropdown depending on "Smjer"  | ⬜      |
| T-S97-9  | DropdownData hidden sheet present in exported xlsx (verify in Excel)                       | ⬜      |
| T-S97-10 | Dependent dropdown works: select Rashod in Smjer → Tip shows only expense categories      | ⬜      |
| T-S97-11 | Non-dependent suggest attrs still have static dropdown (regression check)                 | ⬜      |

---

## S96 — Shared filter helper + dynamic periods + Export Profile + suggest validation

| ID       | Test                                                                                      | Status |
| -------- | ----------------------------------------------------------------------------------------- | ------ |
| T-S96-1  | Activities table loads normally (regression — filter refactor)                            | ✅      |
| T-S96-2  | Export respects commentSearch (count + data match)                                        | ✅      |
| T-S96-3  | Period dropdown: "Last 2 Months" + "Last 3 Months" visible and resolve correctly          | ✅      |
| T-S96-4  | Save shortcut with filter state (period + sort) → load restores dynamically               | ✅      |
| T-S96-5  | Shortcut with attrFilter saved/restored                                                   | ⚠️ fixed S97 |
| T-S96-6  | Export xlsx Filter sheet includes "Period key" row                                        | ✅      |
| T-S96-7  | Preview export (10 rows) — no grouping, all columns visible                               | ✅      |
| T-S96-8  | Import Profile from grouped xlsx → saved in area.settings                                 | ✅      |
| T-S96-9  | Export with profile → columns grouped/collapsed + profile name in Filter sheet + filename | ✅      |
| T-S96-10 | Delete profile → removed from dropdown                                                    | ✅      |
| T-S96-11 | LEGEND col F shows "Default" (not "Unit") with default_value data                         | ✅      |
| T-S96-12 | Suggest columns have Excel dropdown Data Validation in exported xlsx                      | ✅      |

---

## S95 — depends_on bugfixes + comment_template (carryover, low priority)

| ID       | Test                                                                                                   | Status |
| -------- | ------------------------------------------------------------------------------------------------------ | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null                                  | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate"                                                  | ⬜      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši                                    | ⬜      |

---
