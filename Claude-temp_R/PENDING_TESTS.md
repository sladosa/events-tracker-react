

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S107j (2026-07-22)
**Detalji testova:** [S107j_tests.md](test-sessions/S107j_tests.md) (novi) + [S107i_tests.md](test-sessions/S107i_tests.md) + [S107h_tests.md](test-sessions/S107h_tests.md) + [S107g_tests.md](test-sessions/S107g_tests.md) + [S107f_tests.md](test-sessions/S107f_tests.md) + [S107d_tests.md](test-sessions/S107d_tests.md)
**Upute za izvode (i za Koku):** [UPUTE_izvodi.md](UPUTE_izvodi.md) — kako skinuti/spremiti/obraditi bankovne izvode

---

## S107j — ZABA parser fix + izvodi konsolidirani u Review + N/A rule petlja (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107j-A | `parse_zaba_racun` fix: saldo-lanac Σupl/Σisp = bankov Zbroj prometa 40/40 u cent; lanac neprekinut 2023-26   | ✅ (programski verificirano) |
| T-S107j-B | `consolidate_review.py`: +113 (31 MASTERCARD→Transfer, 82 N/A); Nematchano_v3 57 + Saldo kontrola 21/31        | ✅ (programski verificirano) |
| T-S107j-C | `suggest_candidates.py`: Neklasificirano 2026 top 20, Tip/Podtip dropdowni; `backfill_napomena` 1870          | ✅ (programski verificirano) |
| T-S107j-1 | **Saša:** N/A klasifikacija petlja — Neklasificirano popuni → `--harvest` → `apply_rules` → sljedeći krug kraći | ⬜ (glavni put do PROD) |
| T-S107j-2 | **Saša:** `Nematchano_v3` pregled — dismiss dup (peach=odluka, green=kontekst), dodaj genuine missing         | ⬜                   |
| T-S107j-3 | **Saša:** `Saldo kontrola` — 21 OK + 10 razlika; velike (2026-01/2025-08/2024-09) = pitanja za Koku           | ⬜                   |
| T-S107j-4 | **Saša:** Napomena backfill kontrola — 1870 popunjeno, Kokine ne-prazne netaknute (P3)                        | ⬜                   |

**Backlog (S107j → sljedeća):** date-accuracy pass (Review datum ← bankovni, točniji); per-month
reconcile view za 3 velike saldo razlike; PBZ Visa Transfer stragglers (3 N/A "PBZCARD" → Transfer).

---

## S107i — PBZ Visa merge u Review + reconcile/Problem dijagnoza (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107i-1 | `merge_pbzvisa.py`: 1538 PBZ tx → dedup 187 (tag-agnostički) → 1351 novih redaka; PREVIEW verificiran         | ✅ (0 sort padova, DV J/K prošireno, 3503 postojećih source_key netaknuto, 1351 nov jedinstven) |
| T-S107i-2 | Pravi merge run: Review 3504→4855, `Sašin RF\|Visa` 220→1571, backup napravljen                               | ✅ (verificirano skriptom) |
| T-S107i-3 | `apply_rules.py` na mergeanom: 257 klasificirano + 246 Napomena (konzum 230, bauhaus 16, parking 10)         | ✅ (dry=real brojevi, backup) |
| T-S107i-4 | `reconcile_izvoda.py`: Coverage PBZVISA 1538/1539 (bilo 1/1539); Nematchano_v2 257 + Problem dijagnoza        | ✅ (sheetovi u Izvodi_transakcije.xlsx, backup) |
| T-S107i-5 | **Saša Excel pregled:** `pbzvisa` novi retci (filter Izvor reda=`PBZ Visa:*`), RATA/lump ispravni, dropdowni  | ⬜ (Saša — vizualni pregled Reviewa) |
| T-S107i-6 | **Saša Excel pregled:** `Izvodi_transakcije.xlsx` → `Nematchano_v2` Problem kolona (39 Smjer? crveni, 51 nedostaje) | ⬜ (Saša — gdje su problemi) |

**⚠ NALAZ za backlog (ne test):** ZABA parser (`parse_zaba_racun`) krivo određuje Smjer za dio priljeva
(mirovina/Priljev iz inozemstva/uplate → Isplata) + saldo-lanac ne zatvara → account merge + bank
kolone (UplataB/IsplataB/SaldoB) + SaldoB reconcile BLOKIRANI dok se parser ne popravi. `merge_missing_account.py`
napisan i spreman, ali NE pokretati dok Smjer nije pouzdan (dry-run uhvatio greške, ništa upisano).

---

## S107h — drugi krug Pravila (Osiguranje/Allianz/Generali/Triglav, Audible/Apple po iznosu)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107h-1 | Code review novih Pravila redova prije runa: `*osiguranje*`/`*porez*` zvjezdica-bug, Apple Podtip missing     | ✅ (nalazi potvrđeni, doveli do fixeva) |
| T-S107h-2 | Komentar → Alternativa dopisivanje (novi mehanizam u `apply_rules.py`)                                        | ✅ (compile + dry run čist) |
| T-S107h-3 | Osiguranje/Allianz/Generali/Triglav redizajn — sve u postojeće kategorije, Taksonomija red obrisan            | ✅ (Koka odluke primijenjene) |
| T-S107h-4 | Iznos min/max uvjet (novi feature) — Audible_Koka/Sasa split + Apple→iCloud otkriće                           | ✅ (compile + 0 kršenja praga) |
| T-S107h-5 | `update_pravila_s107h.py` — Pravila sheet regeneriran (AMAZON maknut, Apple/Audible split)                    | ✅ (verificirano dumpom) |
| T-S107h-6 | Pravi `apply_rules.py` run #2: 294 redova, +46 Napomena, 0 warninga                                            | ✅ (programski provjereno; Sašin vizualni Excel pregled pending) |

---

## S107g — prvi pravi apply_rules run + Pravilo/Preimenovanja prioritet

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107g-1 | Pravi `apply_rules.py` run: 196 preimenovano, 0 reset, 217 pravilo (7 pravila)                                | ✅ (programski provjereno; Sašin vizualni Excel pregled još pending) |
| T-S107g-2 | `Pravilo run` kolona kreirana i timestampana (413 = 196+217)                                                  | ✅ (programski provjereno) |
| T-S107g-3 | Pravilo nadvladava Preimenovanja (sintetički test)                                                            | ✅ (sintetički test)   |
| T-S107g-4 | `fix_sportski_rekviziti_split.py`: 23 multisport→Sport_Sasa, 3 Kreatin→Namirnice, 3 Decathlon netaknuto       | ✅ (verificirano)    |
| T-S107g-5 | `fix_tcom_tmobile_swap.py`: 2 retka (2281, 2282) zamijenjena po Izvod opisu                                    | ✅ (verificirano)    |
| T-S107g-6 | Nevenka Pavić uplata (red 2436) → Ostali prihodi                                                               | ✅ (verificirano)    |

---

## S107f — Datum naplate backfill + Preimenovanja + UI fix skrivenih atributa

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107f-1 | Kontrola backfilla: Racun/Cash `Datum naplate` = event_date (1631); Visa prazan; MC netaknut                  | ✅ (Saša potvrdio "OK") |
| T-S107f-2 | **GLAVNI POSAO:** Preimenovanja sheet popuna (4 prazna para + pregled prijedloga) → apply_rules --dry → run   | ✅ (izvršeno S107g, v. gore)     |
| T-S107f-3 | UI fix (test-branch): shortcut Strength — Strength_type vidljiv, Activity expand pokazuje poruku, engleski    | ⬜ (netestirano ove sesije — PROD/mobitel)                   |

---

## S107d — inventory izvoda + MC/PBZ parseri (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                        | Status                        |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T-S107d-1 | `inventory_izvoda.py` idempotentnost: ponovni `--dry` = isti brojevi, ništa se ne premješta                 | ⬜                             |
| T-S107d-2 | `Izvodi_transakcije.xlsx`: 3182 tx, Manifest 117 redova, MC_2024-02 suma = 1.642,83                          | ✅ (verificirano skriptom)     |
| T-S107d-3 | **Pravi enrich run** (Review zatvoren!): `--dry` ≈1429 match, pa bez `--dry` → Izvod kolone + Nematchano    | ✅ (2026-07-13; 1429 upisano, ručne kolone verificirane identične backupu, D1 auto-popravljen) |
| T-S107d-4 | Lanac: `apply_rules.py` pravilo pogađa red kojem je merchant SAMO u `Izvod opis`                            | ⬜ (zamjenjuje T-S107c-4)      |
| T-S107d-5 | Nematchano spot-check (PBZ Visa ~1538 tx) — podloga za odluku importati/ignorirati                          | ⬜ (odluka Saša/Koka)          |
| T-S107d-6 | RF OCR spot-check: 3 nasumična reda iz Review s `Izvod file`=RF_* usporediti s PDF-om                       | ⬜                             |
| T-S107d-7 | Pregled 9 `[OCR?]` redova (filter po `[OCR?]` u Izvod opis / Transakcije sheetu) — ispraviti ručno ako treba | ⬜                             |

---

## S107c — klasifikacijski alati (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                     | Status                           |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| T-S107c-1 | `sync_taxonomy.py` na pravom review fileu: dropdowni prate editirani Taksonomija sheet                   | ✅ (Saša potvrdio "ok radi tool") |
| T-S107c-2 | `apply_rules.py`: 1. run kreira Pravila sheet; upiši pravilo; `--dry` pokaže pogodke; run označi PRAVILO | ⬜                                |
| T-S107c-3 | `enrich_from_izvoda.py --dry`: ZABA_2024-01 → ~15/18 match report; bez `--dry` puni Izvod kolone         | ~ superseded → T-S107d-3         |
| T-S107c-4 | Lanac: pravilo koje matcha SAMO tekst iz `Izvod opis` kolone → red dobije Tip/Podtip                     | ~ superseded → T-S107d-4         |

---

## S107b — set_attribute automatika (Faza 2b) + Automations Excel roundtrip

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107b-1 | E2E: Add Activity — Datum naplate live prefill po Izvoru (next:11 / same); ručni unos se ne gazi              | ✅ (Playwright pass) |
| T-S107b-2 | E2E: Structure export sadrži Automations sheet; edit DateMap u Excelu + import mijenja area.settings          | ✅ (Playwright pass) |
| T-S107b-3 | Manualno: Add Activity UX — odabir Izvora puni Datum naplate, promjena Izvora ažurira, ručni edit "zaključa"  | ⬜                   |
| T-S107b-4 | Manualno: Structure export → otvori Automations sheet u Excelu (header, help blok, postojeća pravila)         | ⬜                   |
| T-S107b-5 | Manualno: dodaj NOVO pravilo u Automations sheet → import → pravilo radi u Add Activity                       | ⬜                   |
| T-S107b-6 | Manualno: neispravan DateMap / nepostojeći slug u sheetu → import preskače uz "Automation rules skipped"      | ⬜                   |
| E5-4/5-r  | Regresija: E5 spec fix (Add Child → "+ Add Leaf" label + menu-scroll retry helper) — selector fix, ne app bug | ✅ (Playwright pass) |
| Regresija | E2, E5 (svih 5), E6 (3), T-S104-2, T-S107-1/2 — sve PASS nakon S107b promjena                                 | ✅                   |

---

## S107 — row_hash skip + update-guard (Excel roundtrip zaštita, D7)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107-1  | E2E: re-import nediranog exporta = potpuni no-op (svi redovi skipped, 0 DB poziva)                            | ✅ (Playwright pass) |
| T-S107-2  | E2E: izmjena 1 reda → update-guard lista staro→novo, Apply zaključan do checkboxa                             | ✅ (Playwright pass) |
| T-S107-3  | Manualno: export → promijeni atribut (ne comment) u Excelu → guard pokazuje promjenu polja                    | ⬜                   |
| T-S107-4  | Manualno: guard warning za stare zapise (>30 dana) — promijeni povijesni red                                  | ⬜                   |
| T-S107-5  | Manualno: stari export (bez row_hash kolone) i dalje radi normalno (bez skipa, guard aktivan)                 | ⬜                   |
| T-S107-6  | Review Excel (`Financije_review_*.xlsx`): Tip dropdown radi, Podtip se mijenja po Tipu, krivi Podtip pocrveni | ⬜                   |
| T-S104-3r | Regresija: import progress total sad BEZ untouched reda (spec ažuriran)                                       | ✅ (Playwright pass) |
| E6-r      | Regresija: export s novom row_hash kolonom, download OK                                                       | ✅ (Playwright pass) |

---

## S106 — E7/E8/E9 test harness race condition fix

| ID       | Test                                                                           | Status                                                 |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| E8-1     | Grantee write setup (supabaseUpsert): concurrent data_shares INSERT idempotent | ✅                                                      |
| E8-2     | Grantee write: navigate to Add Activity (Area dropdown select)                 | ⚠️ (timeout: Area select disabled — RLS/loading issue) |
| E9-1     | Grantee read setup + sees shared Fitness area in dropdown                      | ✅                                                      |
| E9-2     | Grantee read: Add Activity button disabled                                     | ✅                                                      |
| E9-3     | Grantee read: no Edit Mode button on Structure tab                             | ✅                                                      |
| E10-1    | Before revoke — grantee sees Fitness area                                      | ✅                                                      |
| E10-2    | Owner revokes access via Share modal                                           | ✅                                                      |
| E10-3    | After revoke — grantee no longer sees Fitness area                             | ✅                                                      |
| E15-full | Revoke with events: dialog + Take your data banner                             | ⬜ (pending smoke test)                                 |
| E7-2/3   | Share Management: invite existing user → "Access granted" toast appears        | ⚠️ (Toast missing — UX polish backlog)                 |

---

## S105 — preostali manualni (starije, još nepotvrđeno)

| ID       | Test                                                                                                                                     | Status |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S105-6 | S105c retest: Edit otvara sve atribute i u 1. pokušaju; ako upit padne → error ekran s retry (ne prazan form)                            | ⬜      |
| T-S105-7 | Suggest depends_on radi opet: Edit/Add Strength → exercise_name dropdown aktivan (wormup → ergometar...); Financije → Broj rata dropdown | ⬜      |
| T-S105-8 | Rename kategorije (Structure Edit → Save) NE mijenja slugove atributa; depends_on i dalje radi nakon rename                              | ⬜      |

---
