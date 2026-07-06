

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S105 (2026-07-06)
**Detalji testova:** [S105_tests.md](test-sessions/S105_tests.md)

---

## S105 — PROD IO redukcija: categoryCache + batched loads

| ID        | Test                                                                        | Status |
| --------- | ---------------------------------------------------------------------------- | ------ |
| T-S105-1  | View Activity (PROD, 7-event sesija): brzo učitavanje, svi atributi vidljivi | ⬜      |
| T-S105-2  | Edit Activity: svi eventi + parent atributi ispravno učitani (batch load)    | ⬜      |
| T-S105-3  | Structure rename kategorije → breadcrumb u View/Edit odmah pokazuje novo ime | ⬜      |
| T-S105-4  | E14 prefetch cache: Next klik bez re-fetcha (E2E)                            | ✅      |
| T-S105-5  | E2+E3+E4 regresija (Add/Edit/View flow s categoryCache)                      | ✅      |

---

## S104 — Fable critical findings: Delete bug + parent event extraction + import progress

| ID        | Test                                                                     | Status |
| --------- | ------------------------------------------------------------------------- | ------ |
| T-S104-1  | Delete Activity: 2 activities same time, delete one, other remains        | ✅      |
| T-S104-2  | Parent event upsert: chain_key correct, no duplicate inserts (P2 anchor)  | ✅      |
| T-S104-3  | Import progress bar: large xlsx shows progress, no frozen UI              | ✅      |

---
