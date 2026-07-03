

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S103 (2026-07-03)
**Detalji testova:** [S102b_tests.md](test-sessions/S102b_tests.md), [S102_tests.md](test-sessions/S102_tests.md)

---

## S103 — RLS fix + grantee guard + FilterContext abort

| ID       | Test                                                                                               | Status |
| -------- | -------------------------------------------------------------------------------------------------- | ------ |
| T-S103-1 | "In any attribute" filter radi za grantee (DP na Health_Sasa) — potrebno **nakon** 031 SQL na PROD | ❌ BUG-S103-ANYATTR (i dalje timeout; ILIKE nije leakproof → RLS eval na cijeloj tablici; notice dodan u UI umjesto punog fixa) |
| T-S103-2 | Import Profile kao grantee → jasna poruka "no permission to save" (ne tihi fail)                   | ✅ (usput otkriven i fiksan BUG-S103-IMPORT-GRANTEE — Import gumb sad skriven za read grantee) |
| T-S103-3 | Delete Profile kao grantee → toast "Read-only access — cannot delete profiles"                     | ✅      |
| T-S103-4 | "Clear all" odmah briše "Restoring filter..." bez čekanja (i dok je doRestore u tijeku)            | ✅ (testirano pod 3G throttling; par "Uncaught AbortError" u konzoli od starih nadjačanih requesta — ne regresija, artefakt throttlinga) |
| T-S103-5 | Nakon Clear all + refresh → app se učita normalno (nema zaglavljenog "Restoring filter...")        | ✅      |

**Napomena:** `sql/031_rls_exists_fix.sql` pokrenut na TEST i PROD (2026-07-03, PROD status potvrđen Healthy). Djelomično uspio — specific-attribute filter za grantee sad radi (Doktor test ✅), ali "In any attribute" i dalje timeouta (BUG-S103-ANYATTR, vidi CLAUDE.md Open bugs). Pravi fix (SECURITY DEFINER RPC) odgođen u backlog; za sada amber notice u UI.

**Napomena (T-S103-3):** Export profili su spremljeni u `area.settings.export_profiles` (JSONB na area razini) — svi korisnici s pristupom area-i (owner + svi grantee-i) vide ISTE profile, nisu per-user. Da bi se T-S103-3 testirao: (1) kao owner (sladosa) kreiraj profil na Health_Sasa; (2) prijavi se kao grantee (DP) i provjeri da profil postoji u dropdownu (read radi preko RLS na `areas`); (3) probaj Delete → očekivano toast "Read-only access — cannot delete profiles".

---

## S102b — bugfixes pronađeni tijekom S100/S102 testiranja (Export Profile filter overrides)

| ID        | Test                                                                                                                   | Status |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S102b-1 | Period dropdown nakon "Use" shortcuta prikazuje TOČAN period (ne lažno "All Time" kad se raspon poklopi s data bounds) | ✅      |
| T-S102b-2 | Export Profile s attrFilterRaw (slug format) STVARNO filtrira exportane redove, ne samo Filter sheet tekst             | ✅      |
| T-S102b-3 | Export Profile Period key = `all-time` stvarno briše datumski filter (prije bio no-op)                                 | ✅      |
| T-S102b-4 | Export Profile Period key = `custom` + Date From/To stvarno postavlja eksplicitni raspon                               | ✅      |
| T-S102b-5 | Filter sheet: "Period label" red uklonjen (12 redova umjesto 13); Date From/To tooltip ažuriran                        | ✅      |
| T-S102b-6 | Filter sheet: Period key / Sort order dropdownovi (Data Validation liste) rade u Excelu                                | ✅      |
| T-S102b-7 | HelpEvents sheet: novi "EXPORT PROFILES" odjeljak prikazan ispravno (vizualna provjera)                                | ✅      |
| T-S102b-8 | Attribute filter `_` sentinel u profilu eksplicitno briše filter (sve vrijednosti), za razliku od prazne ćelije (inherit live) | ✅ |
| T-S102b-9 | Excel se otvara bez "We found a problem with some content" greške (Data Validation prompt/title length fix)           | ✅      |

**Napomena:** Logiran i (NE fixan, samo backlog) `BUG-S102-DELETE` u CLAUDE.md — Delete Area backup-prompt gate koristi stale `node.eventCount`; nema test stavku jer fix nije implementiran.

---

## S102 — default_map + attr filter slug + Structure Import slug grouping

| ID        | Test                                                                                 | Status |
| --------- | ------------------------------------------------------------------------------------ | ------ |
| T-S102-1  | default_map: Izvor=Visa → Status=Planiran (Add Activity)                             | ✅      |
| T-S102-2  | default_map: Izvor=Račun → Status=Izvršen (Add Activity)                             | ✅      |
| T-S102-3  | default_map: promjena Izvor mijenja Status default (ne ostaje stari)                 | ✅      |
| T-S102-4  | default_map: ručno editiran Status NE smije se resetirati pri promjeni Izvor-a       | ✅      |
| T-S102-5  | Structure Import: slug-based grouping (različita imena, isti slug → jedan atribut)   | ✅      |
| T-S102-6  | Structure Export: default_map → Default kolona per-WhenValue red                     | ✅      |
| T-S102-7  | StructureNodeEditPanel: default polje vidljivo i editabilno uz WhenValue             | ✅      |
| T-S102-8  | Export Filter sheet: Attribute filter prikazuje slug umjesto UUID                    | ✅      |
| T-S102-9  | Export Filter sheet: Comment filter i Attribute filter uvijek prisutni (čak prazni)  | ✅      |
| T-S102-10 | Import Profile: slug-based attr filter (racun: =Sašin tekući RF) se ispravno parsira | ✅      |
| T-S102-11 | Export Filter sheet: Data Validation input message na Attribute filter ćeliji        | ✅      |
| T-S102-12 | Shortcut pre-fill: preset s Izvor=Visa → Status=Planiran (default_map second pass)   | ✅      |

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
| T-S100-1 | BUG-S99-IMPORT fix — import ne matcha krivu kategoriju kad 2 aree imaju isti path | ✅      |
| T-S100-2 | Dependent dropdown za 'Izvor placanja' — dijakritici u opcijama                   | ✅      |
| T-S100-3 | Export Profile — column order iz LEGEND-a                                         | ✅      |
| T-S100-4 | Export Profile — column widths iz profila                                         | ✅      |
| T-S100-5 | Export Profile — Filter sheet override                                            | ✅ (pokriveno T-S102b-2/3/4) |
| T-S100-6 | Export Profile — Filter sheet format za Attribute filter (`~` partial, `*` any)   | ✅      |
| T-S100-7 | Import Profile toast prikazuje column order + widths info                         | ✅      |

---

## S95 — depends_on bugfixes + comment_template (carryover)

| ID       | Test                                                                  | Status |
| -------- | --------------------------------------------------------------------- | ------ |
| T-S95-10 | Add Activity → Finish s praznim atributima u templateu → comment null | ✅ (otkriven i fiksan bug — vidi CLAUDE.md) |
| T-S95-12 | Structure Import → CommentTemplate update-ira settings; `_` = briši   | ✅      |

---
