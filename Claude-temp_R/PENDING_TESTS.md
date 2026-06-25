

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S99 (2026-06-25)
**Detalji testova:** [S99_tests.md](test-sessions/S99_tests.md)

---

## S99 — Delete Area fixes + Financije PROD reorganizacija

| ID       | Test                                                                                     | Status |
| -------- | ---------------------------------------------------------------------------------------- | ------ |
| T-S99-1  | Delete Area (no events) — radi bez problema (Financije_old obrisana OK)                  | ✅      |
| T-S99-2  | Delete Area (with events) — "Delete without backup" gumb vidljiv, radi                   | ⬜      |
| T-S99-3  | Delete Area (with events) — "Download Backup & Delete" skida area-scoped xlsx            | ✅      |
| T-S99-4  | Backup xlsx sadrži samo tu area (ne cijelu bazu)                                         | ✅      |
| T-S99-5  | Financije PROD obrisana via SQL (029_delete_financije_prod.sql)                          | ✅      |
| T-S99-6  | Financije_old (pre-2026) importana na PROD, Koka dobila read-only pristup               | ✅      |
| T-S99-7  | Koka importa Financije (2026+) na PROD kao owner                                        | ⬜      |
| T-S99-8  | Error poruka u Delete modalu prikazuje step + code + details (ne samo "Bad Request")     | ✅      |

---

## S95 — depends_on bugfixes + comment_template (carryover, low priority)

| ID       | Test                                                                                                   | Status |
| -------- | ------------------------------------------------------------------------------------------------------ | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null                                  | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate"                                                  | ⬜      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši                                    | ⬜      |

---
