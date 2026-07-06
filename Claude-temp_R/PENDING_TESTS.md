

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S105 (2026-07-06)
**Detalji testova:** [S105_tests.md](test-sessions/S105_tests.md)

---

## S105 — PROD IO redukcija: categoryCache + batched loads

| ID       | Test                                                                         | Status |
| -------- | ---------------------------------------------------------------------------- | ------ |
| T-S105-1 | View Activity (PROD, 7-event sesija): brzo učitavanje, svi atributi vidljivi | ✅      |
| T-S105-2 | Edit Activity: svi eventi + parent atributi ispravno učitani (batch load)    | ✅ (1. pokušaj prazni attrs → bug fixan u S105c) |
| T-S105-3 | Structure rename kategorije → breadcrumb u View/Edit odmah pokazuje novo ime | ✅      |
| T-S105-4 | E14 prefetch cache: Next klik bez re-fetcha (E2E)                            | ✅      |
| T-S105-5 | E2+E3+E4 regresija (Add/Edit/View flow s categoryCache)                      | ✅      |
| T-S105-6 | S105c retest: Edit otvara sve atribute i u 1. pokušaju; ako upit padne → error ekran s retry (ne prazan form) | ⬜      |
| T-S105-7 | Suggest depends_on radi opet: Edit/Add Strength → exercise_name dropdown aktivan (wormup → ergometar...); Financije → Broj rata dropdown | ⬜      |
| T-S105-8 | Rename kategorije (Structure Edit → Save) NE mijenja slugove atributa; depends_on i dalje radi nakon rename | ⬜      |

---

## S104 — Fable critical findings: Delete bug + parent event extraction + import progress

| ID        | Test                                                                     | Status |
| --------- | ------------------------------------------------------------------------- | ------ |
| T-S104-1  | Delete Activity: 2 activities same time, delete one, other remains        | ✅      |
| T-S104-2  | Parent event upsert: chain_key correct, no duplicate inserts (P2 anchor)  | ✅      |
| T-S104-3  | Import progress bar: large xlsx shows progress, no frozen UI              | ✅      |

---
