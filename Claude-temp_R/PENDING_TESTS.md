

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S101 (2026-06-28)
**Detalji testova:** [S101_tests.md](test-sessions/S101_tests.md)

---

## S101 — Financije PROD fixes + Tip/Podtip reorganizacija

| ID       | Test                                                                              | Status |
| -------- | --------------------------------------------------------------------------------- | ------ |
| T-S101-1 | Broj rata depends_on fix — Rate?=Yes prikazuje Broj rata polje                    | ✅      |
| T-S101-2 | Rata config na novoj Financije area-i — modal se pojavljuje na Finish             | ✅      |
| T-S101-3 | date_map_slug=racun — rata datumi po Racunu (ZABA→11., RF→3.)                    | ✅      |
| T-S101-4 | Rata modal — 3 rate × 150 = 450, datumi ispravni                                 | ✅      |
| T-S101-5 | SQL 030 — Tip opcije ažurirane + Podtip atribut kreiran (obje area-e)             | ⬜      |
| T-S101-6 | Add Activity — Tip dropdown prikazuje nove opcije (Domaćinstvo, Informatika...)   | ⬜      |
| T-S101-7 | Add Activity — Podtip dropdown ovisi o Tip-u (Domaćinstvo → Struja, Voda...)     | ⬜      |
| T-S101-8 | Export — Podtip kolona vidljiva u Events sheetu                                   | ⬜      |

---

## S100 — Export Profile (carryover)

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

## S95 — depends_on bugfixes + comment_template (carryover)

| ID       | Test                                                                  | Status |
| -------- | --------------------------------------------------------------------- | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null | ⬜      |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši   | ⬜      |

---
