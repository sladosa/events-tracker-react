

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S102 (2026-06-29)
**Detalji testova:** [S102_tests.md](test-sessions/S102_tests.md)

---

## S102 — default_map + attr filter slug + Structure Import slug grouping

| ID        | Test                                                                              | Status |
| --------- | --------------------------------------------------------------------------------- | ------ |
| T-S102-1  | default_map: Izvor=Visa → Status=Planiran (Add Activity)                          | ✅      |
| T-S102-2  | default_map: Izvor=Račun → Status=Izvršen (Add Activity)                          | ✅      |
| T-S102-3  | default_map: promjena Izvor mijenja Status default (ne ostaje stari)              | ⬜      |
| T-S102-4  | default_map: ručno editiran Status NE smije se resetirati pri promjeni Izvor-a    | ⬜      |
| T-S102-5  | Structure Import: slug-based grouping (različita imena, isti slug → jedan atribut) | ✅      |
| T-S102-6  | Structure Export: default_map → Default kolona per-WhenValue red                  | ✅      |
| T-S102-7  | StructureNodeEditPanel: default polje vidljivo i editabilno uz WhenValue          | ✅      |
| T-S102-8  | Export Filter sheet: Attribute filter prikazuje slug umjesto UUID                 | ⬜      |
| T-S102-9  | Export Filter sheet: Comment filter i Attribute filter uvijek prisutni (čak prazni)| ⬜      |
| T-S102-10 | Import Profile: slug-based attr filter (racun: =Sašin tekući RF) se ispravno parsira | ⬜   |
| T-S102-11 | Export Filter sheet: Data Validation input message na Attribute filter ćeliji      | ⬜      |
| T-S102-12 | Shortcut pre-fill: preset s Izvor=Visa → Status=Planiran (default_map second pass)| ⬜      |

---

## S101 — Financije PROD fixes (carryover)

| ID       | Test                                                                              | Status |
| -------- | --------------------------------------------------------------------------------- | ------ |
| T-S101-5 | SQL 030 — Tip opcije ažurirane + Podtip atribut kreiran (obje area-e)             | ✅      |
| T-S101-6 | Add Activity — Tip dropdown prikazuje nove opcije (Domaćinstvo, Informatika...)   | ✅      |
| T-S101-7 | Add Activity — Podtip dropdown ovisi o Tip-u (Domaćinstvo → Struja, Voda...)     | ✅      |
| T-S101-8 | Export — Podtip kolona vidljiva u Events sheetu                                   | ✅      |

---

## S100 — Export Profile (carryover)

| ID       | Test                                                                              | Status |
| -------- | --------------------------------------------------------------------------------- | ------ |
| T-S100-1 | BUG-S99-IMPORT fix — import ne matcha krivu kategoriju kad 2 aree imaju isti path | ⬜      |
| T-S100-2 | Dependent dropdown za 'Izvor placanja' — dijakritici u opcijama                   | ✅      |
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
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši   | ✅      |

---
