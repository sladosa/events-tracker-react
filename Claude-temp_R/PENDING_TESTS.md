

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S97 (2026-06-23)
**Detalji testova:** [S97_tests.md](test-sessions/S97_tests.md)

---

## S97 — Shortcut filter fix + "In any attribute" + non-leaf shortcuts + dependent dropdowns

| ID       | Test                                                                                     | Status |
| -------- | ---------------------------------------------------------------------------------------- | ------ |
| T-S97-1  | Switch between shortcuts: attrFilter/commentSearch/sortOrder properly reset              | ✅      |
| T-S97-2  | Shortcut with saved attrFilter: filter restored correctly after switch                   | ✅      |
| T-S97-3  | "In any attribute" filter: select option, type text → events filtered across all attrs   | ✅      |
| T-S97-4  | "In any attribute" works with Export (correct count + data)                              | ✅      |
| T-S97-5  | Save shortcut at non-leaf level (e.g. L1 category) → dropdown shows it, loads correctly  | ✅      |
| T-S97-6  | Save shortcut at area-only level → loads correctly (no category selected)                | ✅      |
| T-S97-7  | "⚡ Use" button only visible for leaf-level shortcuts (not non-leaf)                      | ✅      |
| T-S97-8  | Export xlsx with dependent attr: "Tip" column has INDIRECT dropdown depending on "Smjer" | ✅      |
| T-S97-9  | DropdownData hidden sheet present in exported xlsx (verify in Excel)                     | ✅      |
| T-S97-10 | Dependent dropdown works: select Rashod in Smjer → Tip shows only expense categories     | ✅      |
| T-S97-11 | Non-dependent suggest attrs still have static dropdown (regression check)                | ✅      |
| T-S97-12 | Filter dropdown: number/boolean/datetime atributi NISU u listi (samo text/suggest)       | ✅      |
| T-S97-13 | Hint poruka vidljiva kad postoje skriveni atributi ("N numeric/other attributes...")     | ✅      |
| T-S97-14 | Hint poruka NIJE vidljiva kad su svi atributi text/suggest (nema skrivenih)              | ✅ n/a  |

---

## S95 — depends_on bugfixes + comment_template (carryover, low priority)

| ID       | Test                                                                                                   | Status |
| -------- | ------------------------------------------------------------------------------------------------------ | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null                                  | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate"                                                  | ⬜      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši                                    | ⬜      |

---
