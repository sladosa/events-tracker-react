# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S87 (2026-06-07)
**Detalji testova:** [S87_tests.md](test-sessions/S87_tests.md)

---

## S87 — Financije_3 flat import + StructureDeleteModal activity_presets bugfix

| ID      | Test                                                                                                                                          | Status |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S87-1 | Financije_3 TEST: Activities tablica prikazuje leaf comment s prefiksom — npr. "ZABA: Parking", "RF: Mirovina I stup" (ne prazan comment)     | ⬜      |
| T-S87-2 | Financije_3 TEST: View Activity → jedina sekcija "Transakcija" s leaf badge + 8 atributa (Racun/Uplata/Isplata/Stanje/Valuta/Napomena/Smjer/Tip) | ⬜      |
| T-S87-3 | Financije_3 TEST: comment filter "DATUM_GREŠKA" → prikazuje samo problematične redove (41 kom); clear filter → svi redovi natrag              | ⬜      |
| T-S87-4 | Delete Area s aktivnim shortcutom: u TEST bazi kreiraj shortcut na neku kategoriju → pokušaj brisanja → delete uspijeva bez FK greške         | ⬜      |

---

## S86 — Financije_2 import + StructureDeleteModal bugfixes

| ID      | Test                                                                                                                                   | Status |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S86-1 | Financije_2 import: 458 eventa kretirano, suggest dropdowni rade (npr. Zdravlje > Vrsta: Ljekarna/Liječnik/HLK/Optika/Passport/...)    | ✅      |
| T-S86-2 | Rashodi L1 event Add → Iznos bez EUR labela; Valuta pre-selected EUR; Račun suggest dropdown s opcijama bankovnih računa              | ✅      |
| T-S86-3 | StructureDeleteModal: pokušaj brisanja area → modal prikazuje stvarnu Supabase grešku (ne "Delete failed. Please try again.")          | ✅      |
| T-S86-4 | StructureDeleteModal: brisanje area s djelomično importanim eventima (eventCount=0 ali eventi postoje) → delete uspijeva bez FK greške | ✅      |

---

## S84 — UX-Mobile-1: Activities tablica na mobilnom

| ID      | Test                                                                                                                                              | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S84-1 | Mobilni prikaz (< 640px): redovi prikazuju 2-linijski card format — Red 1: datum · vrijeme · ⋮; Red 2: category path (ako nema filtera) · comment | ✅      |
| T-S84-2 | ⋮ Actions gumb uvijek vidljiv na desnom rubu ekrana — nema horizontalnog scrolla da se do njega dođe                                              | ✅      |
| T-S84-3 | ⋮ menu otvara se s ispravnom pozicijom (iznad ako nema mjesta ispod) i radi View/Edit/Delete                                                      | ✅      |
| T-S84-4 | Mobile, leaf selektiran: Red 2 prikazuje samo comment (bez category, jer breadcrumb je u header); bez commenta — samo Red 1                       | ✅      |
| T-S84-5 | Mobile, filter otvoren: na dnu filter sekcije vidljivi "Excel · 📤 Import · 📥 Export" gumbi                                                      | ✅      |
| T-S84-6 | Mobile Import gumb → Import modal se otvara; Export gumb → Export modal se otvara                                                                 | ✅      |
| T-S84-7 | Desktop (≥ 640px): layout potpuno netaknut — header tablice vidljiv, Import/Export u header tablice, svi stupci prikazani                         | ✅      |

---

## S83 — "Contact owner" message draft u Info modalima

| ID      | Test                                                                                                                                             | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-S83-1 | Read grantee Info modal: "Copy email" gumb zamijenjen s "Contact owner"; klik → prikazuje TO/SUBJ/poruka sekciju                                 | ✅      |
| T-S83-2 | Read grantee message: TO = owner email, SUBJ = "Write access request — {Area}", poruka sadrži grantee email + opis read prava + zahtjev za write | ✅      |
| T-S83-3 | "Copy message" gumb kopira cijelu poruku u clipboard; toast "Message copied"                                                                     | ✅      |
| T-S83-4 | Write grantee Info modal: "Contact owner" klik → prikazuje TO/SUBJ/poruka sekciju s textareom za custom poruku                                   | ✅      |
| T-S83-5 | Write grantee message: textarea tekst uključen u kopiranu poruku; "Copy message" radi                                                            | ✅      |
| T-S83-6 | "← Back" gumb vraća na info prikaz (bez zatvaranja modala)                                                                                       | ✅      |

---

## S82 — SharedAreaBanner UX kompresija

| ID      | Test                                                                                                 | Status |
| ------- | ---------------------------------------------------------------------------------------------------- | ------ |
| T-S82-1 | Read grantee: amber banner prikazuje 1 red `👁 Read-only access` + `ℹ Info` gumb (bez emaila inline) | ✅      |
| T-S82-2 | Klik na `ℹ Info` → modal s owner emailom, copy email, lista dozvola                                  | ✅      |
| T-S82-3 | Write grantee: zeleni banner prikazuje 1 red `✅ Write access` + `ℹ Info` + `Take your data`          | ✅      |
| T-S82-4 | Klik na `ℹ Info` → modal s owner info, copy email, lista dozvola + nota o pohrani eventa             | ✅      |
| T-S82-5 | Owner Structure row: sharing badge prikazuje samo 🔗 ikonu (bez emaila), tooltip s emailovima        | ✅      |

---

## S81 — Comment filter

| ID      | Test                                                                                                                      | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S81-1 | Filter bar → Activities tab: "Comment contains" input vidljiv ispod Date range sekcije                                    | ✅      |
| T-S81-2 | Upiši "IZBRISATI" → tablice se filtrira na samo te redove; chip "comment: "IZBRISATI" ×" prikazan u headeru tablice       | ✅      |
| T-S81-3 | Klik na × chip → filter se briše, tablice prikazuje sve aktivnosti                                                        | ✅      |
| T-S81-4 | Klik na × u inputu → isti efekt kao × chip (filter obrisan)                                                               | ✅      |
| T-S81-5 | Comment filter kombinira se s Area/Category filterom (AND logika) — npr. odaberi specifičnu kategoriju + "TODO" u comment | ✅      |
| T-S81-6 | "Clear all" u filter headeru briše i commentSearch (filter se resetira)                                                   | ✅      |

---

## S80 — Export pagination fix + Health cleanup tools

| ID      | Test                                                                                                           | Status |
| ------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| T-S80-1 | Export Health_Sasa (TEST, All Categories) → xlsx ima 3716 redaka (ne 1000)                                     | ✅      |
| T-S80-2 | TEST: Health_Sasa > Daily_metrics > Garmin_data — pregled random datuma, samo 1 event u sesiji (bez duplikata) | ✅      |
| T-S80-3 | PROD: Health_Sasa Area obrisana + xlsx import → 3716 eventa, struktura ispravna, Medical Visit eventi vidljivi | ✅      |
| T-S80-4 | PROD: `npm run dev:prod` → otvara se bez TEST DATABASE bannera, prikazuje PROD podatke                         | ✅      |

---

## S79 — Help FAB padding fix

| ID      | Test                                                                                                                       | Status |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S79-1 | Activities tab, mobitel/uski viewport: scrolla do zadnjeg reda → ⋮ Actions meni dostupan, Help FAB (? krug) ga ne prekriva | ✅      |
| T-S79-2 | Structure tab, mobitel/uski viewport: scrolla do zadnjeg reda → ⋮ meni dostupan, Help FAB ga ne prekriva                   | ✅      |

---

## S78 — Export attrs bug fix (loadAttrsForEvents limit)

| ID      | Test                                                                                                                                                    | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S78-1 | Export Health_Sasa → xlsx: sve vidljive rows (2025-02) imaju HR Rest, Steps, Avg Stress vrijednosti (više nisu prazne); provjeri par datuma uz View Activity | ✅      |

---

## S77 — SharedAreaBanner UX + Garmin Daily Metrics import

| ID      | Test                                                                                                                                                                      | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S77-1 | Structure tab, owned area s granteeom: OwnerBanner prikazuje samo "🔗 This Area is shared" + "⚙ Manage Access" gumb (nema grantee names, nema "Structure changes" teksta) | ✅      |
| T-S77-2 | Edit Mode aktivan, area s aktivnim shareom: amber toolbar prikazuje "⚠ Structure changes affect all users" s lijeve strane "+ Add Area" gumba                             | ✅      |
| T-S77-3 | Edit Mode aktivan, area BEZ shareova: toolbar prikazuje samo "+ Add Area" gumb (bez warning teksta)                                                                       | ✅      |
| T-S77-4 | TEST: Health_Sasa → Daily_metrics → Garmin_data leaf postoji; spot check — event 2024-01-15 ima HR Rest, Steps, Training Status                                           | ✅      |
| T-S77-5 | TEST: Export Health_Sasa → xlsx sadrži Garmin_data sheet; vrijednosti HR/Steps/VO2max izgledaju realno                                                                    | ❌ BUG → fiksano S78 (loadAttrsForEvents bez .limit() → Supabase default 1000-row cap truncirao attrs za 2025-02 evente) |

**Confirmed this session:** T-S70-3 / T-S69-3 — Koka ima pristup `Health_Saša` area (read grantee) ✅

---

## S76 — Revoke with events + Grantee protection

| ID      | Test                                                                                                               | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| E15-1   | Owner klikne Revoke na grantee s eventima → amber dialog s brojem eventa + 3 opcije (Revoke only / Claim / Delete) | ✅      |
| E15-2   | Dialog → "Revoke only" → potvrda → share nestaje, toast OK → Activities → OrphanBanner vidljiv                     | ✅      |
| E15-3   | Grantee (write) odabere shared area → zeleni banner ima "Take your data" gumb + info tekst                         | ✅      |
| T-S76-1 | Owner klikne Revoke na grantee BEZ eventa → nema dialog, odmah toast "Access revoked"                              | ✅      |
| T-S76-2 | Dialog → "Claim events" → potvrda → eventi se pojavljuju kao owner-ovi, banner nestaje                             | ✅      |
| T-S76-3 | Dialog → "Delete events" → potvrda → eventi nestaju, share nestaje                                                 | ✅      |
| T-S76-4 | Grantee (write) klikne "Take your data" → LeaveAreaModal otvori se s "Detach with data" opcijom                    | ✅      |
| T-S76-5 | AuthPage invite flow (s areaName) → note "Your events are stored in owner's area..." vidljiv ispod invite teksta   | ✅      |

## S75 — Orphan events feature

| ID      | Test                                                                                                                              | Status |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| SQL     | `020_orphan_rls.sql` pokrenuto na TEST Supabase                                                                                   | ✅      |
| SQL     | `020_orphan_rls.sql` pokrenuto na PROD Supabase                                                                                   | ✅      |
| T-S75-1 | Grantee "Leave without data" → owner otvori Activities (All Areas) → amber banner prikazuje se s brojem usera i aktivnosti        | ✅      |
| T-S75-2 | Banner [View events] → chip "Orphan events only" pojavi se, tablice prikazuje samo orphan redove                                  | ✅      |
| T-S75-3 | Chip × → filter se briše, tablice prikazuje sve aktivnosti, banner se ponovo pojavi                                               | ✅      |
| T-S75-4 | Banner [Manage] → OrphanManagementModal otvori se, prikazuje orphan usera s brojem aktivnosti i Area tagovima                    | ✅      |
| T-S75-5 | Modal [Re-invite to X] → ShareManagementModal otvori se za tu Area                                                               | ✅      |
| T-S75-6 | Modal [Claim events] → potvrda → eventi se pojavljuju kao "You", banner nestaje                                                   | ✅      |
| T-S75-7 | Modal [Delete events] → potvrda → eventi nestaju iz liste, banner nestaje                                                         | ✅      |
| T-S75-8 | Orphan red u tablici: amber ring na avataru + ⚠ badge; tooltip "X no longer has access to this area"                             | ✅      |
| T-S75-9 | Orphan red ⋮ meni → "Manage orphan events" opcija → otvori OrphanManagementModal                                                 | ✅      |
