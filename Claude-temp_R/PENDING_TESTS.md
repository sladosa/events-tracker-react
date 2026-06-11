# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S91 (2026-06-11)
**Detalji testova:** [S91_tests.md](test-sessions/S91_tests.md)

---

## S91 — default_value UI + depends_on visibility + hide-if-default

| ID      | Test                                                                                                                                                              | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S91-1 | Structure Edit → Transakcija → uredi atribut → vidi se "Default value" polje; upiši "EUR" → Save → Export pokazuje Default=EUR u xlsx                            | ⬜      |
| T-S91-2 | Add Activity → Financije_3 > Transakcija → Status i Valuta su **skriveni** pri otvaranju (defaulti: Izvrsen/EUR); dno forme pokazuje "N polja skrivena (na defaultu)" | ⬜      |
| T-S91-3 | Klikni "Prikaži sve" → Status i Valuta se pojave; klikni "Sakrij polja na defaultu" → nestanu opet                                                               | ⬜      |
| T-S91-4 | Promijeni Status na "Planiran" → Status ostaje vidljiv; promijeni ga nazad na "Izvrsen" → ostaje vidljiv (userEdited=true)                                        | ⬜      |
| T-S91-5 | Odaberi drugu kategoriju pa se vrati na Transakcija → "show all" se resetirao, Status i Valuta opet skriveni                                                      | ⬜      |
| T-S91-6 | Smjer = "Uplata" → Uplata polje vidljivo, Isplata skriveno; Smjer = "Isplata" → Isplata vidljiva, Uplata skrivena (nakon Structure import s novom konfiguracijom) | ⬜      |
| T-S91-7 | Stanje polje nije vidljivo u Add Activity ni u Edit Activity (DependsOn=smjer, WhenValue=SKRIVENO)                                                                | ⬜      |
| T-S91-8 | Structure Import → drugi import istog xlsx-a → **ne stvara duplikate** atributa (slug-based deduplication fix)                                                    | ⬜      |

---

## S89 — Perf: filter persist + chain cache + skeleton

| ID      | Test                                                                                                                     | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S89-1 | Zatvori browser, otvori ponovo → aktivni filter (Area+Category) je restauriran, tablica odmah učitava filtriran sadržaj | ✅      |
| T-S89-2 | Add Activity drugi put za isti shortcut (ista sesija) → forma se otvori brže nego prvi put (chain cache hit)             | ✅      |
| T-S89-3 | Skeleton: dok se Activities tablica učitava vide se animated placeholder redovi (ne prazan div/spinner)                  | ✅      |

---
