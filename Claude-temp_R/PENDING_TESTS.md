# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S95 (2026-06-21)
**Detalji testova:** [S95_tests.md](test-sessions/S95_tests.md)

---

## S95 — depends_on bugfixes + comment_template + Structure Excel

| ID       | Test                                                                                                                                       | Status |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S95-1  | parseValidationRules: atribut s `dropdown.depends_on.mapping` formatom → depends_on se parsira, visibility radi                            | ⏭ (nema mapping formata u TEST bazi) |
| T-S95-2  | Structure Edit → depends_on dropdown prikazuje boolean i number atribute (ne samo text/suggest)                                             | ✅      |
| T-S95-3  | Add Activity → zavisno polje NEMA "→ true" ili "→ [vrijednost]" sivi tekst ispod sebe                                                      | ✅      |
| T-S95-4  | Console: nema `[parseValidationRules]` ni `[useAttributeDefinitions]` debug logova                                                         | ✅      |
| T-S95-5  | Financije_3 > Transakcija: Smjer=Uplata→Uplata vidljiv; Smjer=Isplata→Isplata vidljiv; Stanje nikad vidljiv (regression check)             | ✅      |
| T-S95-6  | Structure Edit Area: "Auto-comment template" polje vidljivo; slug dropdown radi; Save sprema u area.settings                                | ✅      |
| T-S95-7  | Structure Edit Leaf: template polje s "Inherited from Area" hintom; override radi                                                          | ✅      |
| T-S95-8  | Add Activity → Finish bez Event Note → comment = evaluirani template                                                                       | ✅      |
| T-S95-9  | Add Activity → Finish s Event Note → comment = korisnički unos (template ignoriran)                                                        | ✅      |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null (ne prazan string)                                                   | ⬜      |
| T-S95-11 | Structure Export → xlsx ima kolonu S "CommentTemplate" s area/leaf template vrijednostima + Data Validation hint                             | ⬜      |
| T-S95-12 | Structure Import → xlsx s CommentTemplate → area.settings/category.settings se update-aju; `_` = briši template                             | ⬜      |

---

## S94 — Rata modal bugfixes + Export attrFilter + PROD deploy

| ID      | Test                                                                                                                                                                     | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S94-1 | PROD: Add Activity → Financije > Transakcija; Rate?=Da, Broj rata=3, Iznos=300, Izvor=Visa; Finish → rata modal se prikazuje s 3 rate po 100, datumi 3. u sljedeća 3 mj. | ⬜      |
| T-S94-2 | PROD: "Kreiraj 3 rata" → originalni event nestaje iz tablice; u tablici su 3 nova rata eventa s Status=Planiran i komentarima "... · rata 1/3 · 100 od 300" itd.         | ⬜      |
| T-S94-3 | PROD: "Preskoči" → modal se zatvori, originalni event ostaje u tablici s Rate?=Ne, Broj rata=—                                                                           | ⬜      |
| T-S94-4 | Filter Status=Planiran → klikni Export → xlsx sadrži **samo** Planiran evente (attrFilter se primjenjuje na Export)                                                      | ⬜      |

---
