# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S94 (2026-06-16)
**Detalji testova:** [S94_tests.md](test-sessions/S94_tests.md)

---

## S94 — Rata modal bugfixes + Export attrFilter + PROD deploy

| ID      | Test                                                                                                                                                                    | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S94-1 | PROD: Add Activity → Financije > Transakcija; Rate?=Da, Broj rata=3, Iznos=300, Izvor=Visa; Finish → rata modal se prikazuje s 3 rate po 100, datumi 3. u sljedeća 3 mj. | ⬜      |
| T-S94-2 | PROD: "Kreiraj 3 rata" → originalni event nestaje iz tablice; u tablici su 3 nova rata eventa s Status=Planiran i komentarima "... · rata 1/3 · 100 od 300" itd.        | ⬜      |
| T-S94-3 | PROD: "Preskoči" → modal se zatvori, originalni event ostaje u tablici s Rate?=Ne, Broj rata=—                                                                          | ⬜      |
| T-S94-4 | Filter Status=Planiran → klikni Export → xlsx sadrži **samo** Planiran evente (attrFilter se primjenjuje na Export)                                                     | ⬜      |

---

## S93b — Bugfixes: attrFilter large result + import duplicate

| ID       | Test                                                                                                                                                                 | Status |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S93b-1 | Filter Status=Izvrsen (velika količina podataka) → tablica prikazuje evente BEZ greške "Failed to fetch activities" (bugfix: !inner join umjesto pre-fetch+IN array) | ✅      |
| T-S93b-2 | Import xlsx s event_id u kol A (UPDATE path) → eventi se UPDATE-aju (Status dodan/promijenjen), BEZ kreiranja duplikata (bugfix: chunked smartReclassify)            | ✅      |

---

## S93 — Attribute filter + Rata modal

| ID       | Test                                                                                                                                                                                                                    | Status |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S93-1  | Filter bar: odaberi Financije_3 area → dropdown "Comment" se pojavi s attr opcijama (Status, Smjer, Izvor plaćanja, Tip...)                                                                                             | ✅      |
| T-S93-2  | Filter bar: odaberi "Status" u dropdownu → pojavi se select s opcijama (Izvrsen, Planiran...); odaberi "Planiran" → tablica filtrira samo Planiran evente                                                               | ✅      |
| T-S93-3  | Filter bar: odaberi "Smjer" → select s Uplata/Isplata; odaberi "Isplata" → chip "Isplata" prikazan u tablici; × briše filter                                                                                            | ✅      |
| T-S93-4  | Filter bar: odaberi "Comment" → text input za pretragu; unesi tekst → filtrira po komentaru (staro ponašanje)                                                                                                           | ✅      |
| T-S93-5  | Filter bar: promijeni Area → dropdown se resetira na "Comment" i attrFilter se briše                                                                                                                                    | ✅      |
| T-S93-6  | Filter area-only (bez kategorije): odaberi samo Financije_3 → u dropdownu su atributi iz cijele areae                                                                                                                   | ✅      |
| T-S93-7  | **Rata modal — happy path:** Add Activity → Financije_3 > Transakcija; postavi Na rate?=Da, Broj rata=3, Iznos=450, Izvor=Mastercard kartica; Finish → pojavi se modal s 3 rate po 150 EUR, datumi 11. u sljedeća 3 mj. | ✅      |
| T-S93-8  | Rata modal: klikni "Kreiraj 3 rata" → toast "Kreirano 3 rata"; u Activities tablici filteraj Status=Planiran → vide se 3 nova eventa s komentarima "… · rata 1/3" itd.                                                  | ✅      |
| T-S93-9  | Rata modal: klikni "Preskoči" → modal se zatvori, success dialog se otvori, rata eventi **nisu** kreirani; Rate?=No, Broj rata=— na originalnom eventu                                                                  | ✅      |
| T-S93-10 | Rata atributi: View Activity na rata eventu → Isplata=110, Status=Planiran, Rate?=Yes+Broj rata=3 ostaju (korisno za tracing, by design)                                                                                | ✅      |
| T-S93-11 | Rata bez config (non-Financije area): Add Activity → Finish → **nema** rata modala, odmah success dialog                                                                                                                | ✅      |
| T-S93-12 | Rata trigger nije aktivan: Rate?=Ne → Broj rata polje skriveno (depends_on) → detectRata vraća null → nema modala (by design)                                                                                           | ✅      |

---

## S92 — `_` sentinel + dev:netlify fix + structureImport bugfixes

| ID      | Test                                                                                                                                       | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S92-1 | Export event s atributom Smjer=Isplata → upiši `_` u Smjer kolonu → Import → atribut obrisan (View Activity: Smjer polje prazno/nedostaje) | ✅      |
| T-S92-2 | Import xlsx s `_` za nepostojeći atribut (novi event) → atribut se **ne kreira** (tretira se kao prazno)                                   | ✅      |
| T-S92-3 | Import xlsx s `_` za atribut koji je već prazan/null → event se broji kao "skipped" (bez promjene, hasChanges=false)                       | ✅      |
| T-S92-4 | `npm run dev:netlify` → otvori localhost:8888 → app se prikazuje (nije blank page); AI Help ❓ FAB radi (odgovara na pitanje)               | ✅      |
| T-S92-5 | Structure import: Default kolona = `_` → atribut dobiva `default_value = null` (polje prazno u Edit panelu)                                | ✅      |
| T-S92-6 | Structure import: Default kolona = `Isplata` → atribut dobiva `default_value = Isplata` (vidljivo u Edit panelu)                           | ✅      |

---

## S91 — default_value UI + depends_on visibility + hide-if-default

| ID      | Test                                                                                                                                                                  | Status |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S91-1 | Structure Edit → Transakcija → uredi atribut → vidi se "Default value" polje; upiši "EUR" → Save → Export pokazuje Default=EUR u xlsx                                 | ✅      |
| T-S91-2 | Add Activity → Financije_3 > Transakcija → Status i Valuta su **skriveni** pri otvaranju (defaulti: Izvrsen/EUR); dno forme pokazuje "N polja skrivena (na defaultu)" | ✅      |
| T-S91-3 | Klikni "Prikaži sve" → Status i Valuta se pojave; klikni "Sakrij polja na defaultu" → nestanu opet                                                                    | ✅      |
| T-S91-4 | Promijeni Status na "Planiran" → Status ostaje vidljiv; promijeni ga nazad na "Izvrsen" → ostaje vidljiv (userEdited=true)                                            | ✅      |
| T-S91-5 | Odaberi drugu kategoriju pa se vrati na Transakcija → "show all" se resetirao, Status i Valuta opet skriveni                                                          | ✅      |
| T-S91-6 | Smjer = "Uplata" → Uplata polje vidljivo, Isplata skriveno; Smjer = "Isplata" → Isplata vidljiva, Uplata skrivena (nakon Structure import s novom konfiguracijom)     | ✅      |
| T-S91-7 | Stanje polje nije vidljivo u Add Activity ni u Edit Activity (DependsOn=smjer, WhenValue=SKRIVENO)                                                                    | ✅      |
| T-S91-8 | Structure Import → drugi import istog xlsx-a → **ne stvara duplikate** atributa (slug-based deduplication fix)                                                        | ✅      |

---
