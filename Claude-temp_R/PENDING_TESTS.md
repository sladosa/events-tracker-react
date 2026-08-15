

# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S108 (2026-08-15) — Faza 1: RPC salda verificiran protiv Python modela (0,00 razlike), Overview tab + pločica sa sidrom + izračunata kolona `Stanje`.
**Otvoreno: T-S108-1…12 (sve novo), T-S107v-2…4 i 7, T-S107u-2 (backlog).**
**Detalji S108:** [S108_tests.md](test-sessions/S108_tests.md) · **S107y:** [S107y_tests.md](test-sessions/S107y_tests.md) · **S107x:** [S107x_tests.md](test-sessions/S107x_tests.md) · **S107w:** [S107w_tests.md](test-sessions/S107w_tests.md) · **S107v:** [S107v_tests.md](test-sessions/S107v_tests.md) · **S107u:** [S107u_tests.md](test-sessions/S107u_tests.md)

---

## S108 — Faza 1: RPC salda + Overview tab + pločica sa sidrom

**Preduvjet:** `sql/035`, `sql/036` i `sql/037` puštene na TEST — ✅ sve tri (2026-08-15;
`036` je pušten dvaput, druga verzija ispravlja `FULL JOIN`).

Prihvatni kriterij prošao **prije** pisanja UI-ja: RPC reproducira Python model (već validiran
protiv banke) **u cent** — ZABA `150,80`, RF `−1.978,32`. Naivni zbroj po `Racun`u dao bi
ZABA `−22.943,71`.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-6 | `verify_rpc_vs_model.py`: B vs C 0,00, A vs B 0,00, sidro 0,00, D1b 634/634 | ✅ (programski) |
| P-7…P-12 | `rpc_area_balance_anchored` end-to-end: sidro zbraja, granica **stvarno** isključiva (1 redak na granici), grupa bez prometa se i dalje prikazuje, poziv bez prava 401, nepoznat slug 400 s imenom | ✅ (programski) |
| T-S108-1 | ⭐ Overview tab postoji samo uz `dashboard` config (OQ-4), redoslijed Overview → Activities → Structure | ⬜ |
| T-S108-2 | ⭐ Pločica — ZABA 150,80 €, RF −1.978,32 €, „od početka podataka" | ⬜ |
| T-S108-3 | „planirano" — ZABA −2.521,38 € (13) | ⬜ |
| T-S108-4 | ⭐ Sidro: Δ → Potvrdi → „od potvrde"; retak datiran **na** dan potvrde NE mijenja saldo | ⬜ |
| T-S108-5 | Δ ostaje dok se ne slaže; ništa se ne mijenja bez Potvrdi | ⬜ |
| T-S108-6 | ⭐ Drill s pločice → Activities filtriran na račun / na `Status=Planiran` | ⬜ |
| T-S108-7 | ⭐ Izračunata kolona `Stanje` — silazi do salda, nestaje kod miješanih računa i obrnutog sorta | ⬜ |
| T-S108-8 | Rename sluga popravlja `dashboard.widgets[]`; pokvaren slug daje **imenovanu** grešku, ne 0,00 | ⬜ |
| T-S108-9 | Paginacija bez stabilnog sorta — Delete Area / Import Delete? nad >1000 atributa (regresija, nedeterministički) | ⬜ |
| T-S108-10 | „From template" nosi `settings` bez `export_profiles` i bez sidara | ⬜ |
| T-S108-11 | Read grantee vidi pločicu, nema „Potvrdi"; write grantee ima | ⬜ |
| T-S108-12 | Mobitel — polje „u banci" i čip vidljivi i upotrebljivi | ⬜ |

**Sljedeće nakon prolaza:** Faza 2 (brzi unos — §2.9, dvije sitnice nad postojećim
Shortcut sustavom), pa Faza 3 (Koka proba na mobitelu → odluka o cutoveru).

---

## S107y — `Pitanja za Koku` odgovoreno + popravci + batch 2025 uvezen

Sjedenje s Kokom: svih 14 pitanja odgovoreno. `fix_pitanja_koka.py` (novo) primijenio 3
popravka datuma (red 4996, redovi 2787+2788) i 3 brisanja (redovi 4997, 3609, 2004) na pravi
Review — verifikacija po `source_key`+iznos+datum prije pisanja, `.pre-pitanja-*` backup,
kontrola čista (Isplata delta 21,88 €, Uplata delta 1608,99 €, samo 3 retka promijenjena).
Zatim `make_financije_import.py --from 2025-01-01 --to 2025-12-31` → 1473 redaka → uvezeno u
TEST (Financije_all): **1473 created / 0 updated**. Spot-check OK (07.02.2025 Mirovina+Triglav
prisutni, `Rate?=TRUE` vidljiv, ukupno 2220 = 1473+747 iz S107v batcha).

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (`fix_pitanja_koka.py` verifikacija, Σ u cent, samo 3 retka dirnuta, 0 dodanih) | ✅ (programski) |
| T-S107y-1 | ⭐ Import batcha 2025 u TEST app — 1473 new / 0 modify | ✅ (2026-08-13) |
| T-S107y-2 | Spot-check: 07.02.2025 Mirovina+Triglav, `Rate?=TRUE`, ukupno 2220 | ✅ (2026-08-13) |

**Sljedeće:** dogovor o Fazi 1 (`sql/035_area_group_agg.sql`, RPC `balance_by_group`) — sljedeći
session. Batch 2024/2023 se ne priprema unaprijed (vetting je usko grlo, ne generiranje).

---

## S107x — Faza 1a: model salda dokazan + popravci podataka + `Pitanja za Koku`

**Nema promjena u `src/`** — Python data-prep + dokumentacija. Model salda iz
`OVERVIEW_TAB_SPEC.md` §2.10 dokazan nad 4.996 stvarnih redaka **prije** pisanja RPC-a:
pravilo `Izvor ∈ {Racun, Cash}` reproducira bankovni pomak u **17/30 mjeseci u cent**,
naivni zbroj po `Racun`u u **0/30**. Usput otkriveno i popravljeno 69 redaka podataka.

⚠ Mjeri se **pomak** protiv banke, ne razina — Kokin `Stanje` lanac je razbijen sortiranjem
Reviewa po `event_date` (969 puknuća od 2.564), pa bi usporedba razine mjerila artefakt sorta.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (model 17/30, Review netaknut u fazi mjerenja, 49+80 ćelija, Σ u cent, 115 → 69 označenih) | ✅ (programski) |
| T-S107x-1 | ⭐ `Pitanja za Koku` — 14 redaka, dropdown radi, tekst pitanja čitljiv naglas | ✅ (2026-08-13, korišteno uživo s Kokom) |
| T-S107x-2 | `Datum naplate` popravak — redovi 3494 i 3931; nema drugih „nemogućih" osim 4997 | ✅ (2026-08-12) |
| T-S107x-3 | KEKS/trener — 20 redaka u `Zdravlje\|Sport_Sasa`, ona 2 netaknuta | ✅ (2026-08-12) |
| T-S107x-4 | ⏸ Odluka o 8 „prekasnih" redaka (traži sud, nije test) | ⬜ (backlog, i dalje otvoreno) |
| T-S107x-5 | Sjedenje s Kokom — popuni `Odluka`; ⚠ ne pokretati generator ponovo (briše odgovore) | ✅ → S107y |

**Nakon T-S107x-5: batch 2025** ✅ **IZVRŠENO — v. S107y iznad.**

---

## S107w — `Delete?` kolona + izvještaj nakon uvoza kao radni file

Excel roundtrip je znao dodati i izmijeniti zapis, ali **ne obrisati** — rupa koja se osjeti
čim netko slučajno napravi kopiju retka. Sad: kolona **`Delete?`** (dropdown `DELETE`/prazno,
crveni CF, unutar autofiltera, **vidljiva**) + **zaseban delete guard** (vlastiti popis i
vlastita kvačica — „da, promijeni" nikad ne znači i „da, obriši") + **izvještaj koji se sam
skine nakon Applya i JEST radni file**: običan export dirnutih zapisa, pravi `event_id`,
ispravan `row_hash`, `Delete?` već na njemu ⇒ krivu kopiju označiš `DELETE` i uvezeš taj isti file.

Novo: `src/lib/excelImportReport.ts`, `loadEventsByIdsForExport()`. Parent lanac pada **tek kad
ode zadnji zapis sesije** (pravilo iz `AppHome.handleDeleteActivity`, S104). Delete se odvaja
**prije** `row_hash` skipa — otisak ne pokriva zastavicu, pa bi inače nedirani redak s `DELETE`
ispao kao „unchanged" i brisanje bi tiho nestalo.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-5 | Programske kontrole (typecheck+build, E2E, regresija 11/11, `hasChanges` → `computeRowDiff`) | ✅ (programski) |
| T-S107w-1 | E2E: ⭐ puna petlja — kopija → uvoz → izvještaj → `DELETE` u izvještaju → uvoz → zapis obrisan; Apply disabled do kvačice | ✅ (Playwright pass) |
| T-S107w-2 | E2E: `TRUE` u `Delete?` = greška, uvoz se ne otvori | ✅ (Playwright pass) |
| T-S107w-3 | E2E: ponovni uvoz nediranog izvještaja = no-op (dodatne kolone desno ne lome parsiranje) | ✅ (Playwright pass) |
| T-S107w-4 | **Saša:** Excel izgled — dropdown samo `DELETE`, crveni redak, Excel odbija proizvoljan tekst, nema „repair" | ✅ (2026-08-12) |
| T-S107w-5 | **Saša:** sort po drugoj koloni **ne rasparuje** zastavicu od retka | ✅ (2026-08-12) |
| T-S107w-6 | **Saša:** izmjena + brisanje u istom fileu → **dva** bloka, **dvije** kvačice, Apply traži obje | ✅ (2026-08-12) |
| T-S107w-7 | **Saša:** `Financije_all` — obriši jedan testni redak; ostali zapisi istog dana ostaju (klasa T-BUGG-5) | ✅ (2026-08-12, testni redak kreiran kroz Add Activity) |
| T-S107w-8 | **Saša:** ⭐ Fitness — sesija s 2 zapisa: brisanje prvog **ne ruši** parent lanac, brisanje drugog ga ruši | ✅ (2026-08-12, na novoj scratch `S107w Test` aredi — `sql/034_s107w_test_area.sql`) |
| T-S107w-9 | **Saša:** izvještaj kao radni file — sadrži samo dirnute zapise, `Deleted` sheet, re-import radi | ✅ (2026-08-12, uklj. "copied row" dedup slučaj) |

**Fail ako:** brisanje makne više od označenog · parent lanac padne dok sesija još ima zapise ·
zastavica preživi sort na krivom retku · jedna kvačica otključa oboje · izvještaj se ne skine
ili se ne da ponovo uvesti.

---

## S107v — batch import 2026 + čitljive greške pri brisanju Aree

**Import:** `Financije_all_import_20260804_083908.xlsx`, **747 redaka**, 02.01. → 11.07.2026.
Rez na `--to 2026-07-31` namjerno izostavlja **dva retka s krivim `event_date`** koje je ova sesija
našla (red 4996 parking 1,60 € — `Stanje` lanac ga stavlja u 04.–08.07., ne 07.08.; red 4997
MC 21,88 € — `Datum naplate` 10 mjeseci **prije** kupovine, moguć duplikat reda 4247, **čeka Koku**).

**App kod:** `src/lib/deleteErrors.ts` (novo) — `classifyDeleteError()` pretvara sirovu Postgres
grešku u naslov + objašnjenje + konkretne korake, uz original iza „Technical details". Pokriva FK
violation (tuđi `event_attributes` koje RLS skriva), trigger `P0001`, `42501`, istekli JWT, mrežu.
Uz to: **predprovjera vlasništva** (grantee vidi „You are not the owner", gumbi disabled) i
**`SilentNoOp`** — RLS-blokiran DELETE vraća uspjeh s 0 redaka, što je dosad izgledalo kao da je
brisanje prošlo. `sql/033_delete_area_cascade.sql` (novo) — generički SQL cascade + dijagnostika.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-8 | Programske kontrole (4 tihe rupe, guard, 0 duplih `session_start`, klasifikator na 6 oblika grešaka, typecheck+build) | ✅ (programski) |
| T-S107v-1 | **Saša:** ⭐ batch import 2026 — **747 new**; dan s 13 transakcija daje **13 redaka**; spot-check 3 retka + jedna rata | ✅ (747 eventa uvezeno u TEST, dokazano exportom 11.08.) |
| T-S107v-2 | **Saša:** brisanje `Financije_2` — čitljiva poruka umjesto sirovog `23503`, original iza „Technical details" | ⬜ |
| T-S107v-3 | **Saša:** grantee → „You are not the owner" + sva tri gumba disabled | ⬜ |
| T-S107v-4 | **Saša:** `sql/033_delete_area_cascade.sql` — SECTION 2a roster (tko ima zapise + `role`) i 2b **jesu li policyji iz `020_orphan_rls.sql` na TEST-u** (određuje je li UI fix moguć) | ⬜ |
| T-S107v-5 | **Saša:** Delete modal na `Financije_2` — sivi panel s **Owner:** i **popisom po korisniku** s brojem zapisa | ✅ (Owner: sladosa, 774 sve njegovo — **i to je oborilo prvu dijagnozu**) |
| T-S107v-6 | **Saša:** ⭐ **pravi uzrok** — obriši `Financije_2`: mora **proći do kraja** | ✅ (obrisane i `Financije_2` i `Financije`) |
| T-S107v-7 | **Saša (PROD, kad se opet dogodi):** View nakon Finish — ako ne otvori, ekran sad kaže **„Couldn't load this activity"** + tekst greške + **Try again**. **Pošalji tu poruku** — ona je dijagnoza koju dosad nismo imali. Ako piše „Activity not found", uzrok je drukčiji (zapisa stvarno nema) | ⬜ |
| Regresija | E2, E3, E4 (3), E5 (5), E6 (3), E14 (2), S104_delete_bug, S107_row_hash (2) — **20/20 PASS** prije mergea na main | ✅ (jedan flake T-S107-2 u prvom prolazu, ne reproducira se u 2 ponovna pokretanja) |

### ⚠ PRAVI UZROK (nađen T-S107v-5): PostgREST `max-rows = 1000`

Roster je pokazao da su **sva 774 eventa Sašina** — dakle RLS/tuđi podaci **nisu** bili uzrok.
Izmjereno na TEST bazi: `event_attributes` → `Content-Range: 0-999/24729`, **vraćeno 1000**.
Svaki `select` tiho staje na 1000 redaka, **bez greške**. `Financije_2` ima ~10.000
`event_attributes` ⇒ kaskada obriše prvih 1000, pa `DELETE` na eventima padne preko ostatka.

**Fix:** `src/lib/supabasePaging.ts` (novo) — `fetchAllPaged` / `fetchAllPagedIn`; napreduje za
**stvarno vraćeni** broj redaka, pa radi i ako je cap drukčiji od 1000. Primijenjeno na sva tri
neograničena SELECT-a u kaskadi (`events`, `event_attachments`, `event_attributes`) i na roster.
Verificirano na živoj TEST bazi: **24.729 redaka u 26 poziva** (prije 1000 u 1).

`excelDataLoader.ts` je za tu granicu **već** znao (`.limit()` + `.range()`) ⇒ Excel export i
backup nisu bili pogođeni. `useActivities` koristi `.range()`. Pogođena je bila samo kaskada.

### View nakon Finish ne otvara (PROD, Fitness/Strength) — dijagnostika, ne fix

Saša: nakon Finish View često ne otvori, Edit otvori, i nakon Edit→Save View radi.
**Eliminirano dokazima:** format `session_start` (Edit i View traže evente **identičnim** upitom);
`user_id` (PROD podaci: 0 NULL, jedan jedini `user_id`, `session_start` uredno zaokružen na minutu);
`categoryCache` truncation (PROD ima **30** kategorija, daleko ispod 1000); Excel/backup truncation.

**Nađeno umjesto toga:** `_fetchActivityData` je **svaku** grešku hvatao i vraćao `null`, a
ViewDetailsPage je `null` prikazivao kao **„Activity not found"** — isti mrtvi ekran za „zapisa
nema" i za „upit je pukao", bez teksta greške i **bez Retry**. Zato bug nikad nije bio dijagnostičan.
**Fix:** greška se propagira (`takeLastFetchError`), View razlikuje ta dva slučaja i nudi
**„Try again"**. Uzrok se hvata sljedeći put kad se dogodi — v. T-S107v-7.

⚠ **Zamka:** kad se red 4996 riješi, **ne** generirati ga novim batchom — dobio bi `09:00` na dan
koji je već uvezen. Dodati kroz app ili export → uredi → import.

---

## S107u — bugfix: nova Area gubi `comment_template` pri Structure importu

**Nađeno pri T-S107t testiranju** (`Financije_all` Area panel imao praznu „Auto-comment
template" iako je u fileu `{racun}/{tip}/{podtip}`). `dbAreas` je snapshot **prije** importa pa
za tek stvorenu Areu §8 (`comment_template`) i §9 (`Automations`) oboje rade
`{ ...existingArea?.settings }` nad `undefined` ⇒ §9 piše preko §8. Pogađa samo Aree stvorene
**u istom** importu koje imaju i CommentTemplate i Automations redak. Fix: `findOrCreateArea`
gura novu Areu u `dbAreas`. (`structureImport.ts`)

**Drugi dio S107u — `disable_save_plus` u roundtripu:** nova kolona **`DisableSavePlus`** (kol. T,
grouped+collapsed, DV `TRUE/FALSE`) na **Area** retku `Structure` sheeta. §8 sad piše
`comment_template` i `disable_save_plus` **jednim** upisom. Odsutnost kolone = postavka se ne dira;
prazna ćelija = `FALSE`. Roundtrip `AreaSettings` sad pokriva 3 od 4 ključa — ostaje `export_profiles`.

**Koraci T-S107u-3:**
1. Na `Financije_all` uključi `Disable "Save+"` u Area panelu → Save
2. Structure tab → Export → u `Structure` sheetu kolona **T `DisableSavePlus`** = `TRUE` na Area
   retku (kolona je collapsed — otvori grupu ili idi na ćeliju `T8`); Category/Attribute retci prazni
3. Uvezi taj file natrag → `Disable "Save+"` **ostaje uključen**, „Attributes updated 0"
4. U fileu promijeni `TRUE` → `FALSE`, uvezi → kvačica se **isključi** (dokaz da radi u oba smjera)
5. Uvezi **stari** file bez te kolone (`Financije_all_structure_20260801_172202.xlsx`) → postavka
   **ostaje nepromijenjena** (odsutnost ne briše)

**Fail ako:** kolone nema u exportu · uvoz ne mijenja kvačicu · stari file bez kolone je resetira ·
`comment_template` se izgubi pri bilo kojem od ovih uvoza (regresija na §8 spajanju)

| ID | Test | Status |
| --- | --- | --- |
| T-S107u-1 | **Saša:** obriši `Financije_all` → Structure import → Area panel ima `{racun}/{tip}/{podtip}` u „Auto-comment template", a Automations i dalje javlja **2** | ✅ (template + Preview `[racun]/[tip]/[podtip]` vidljivi u Area panelu) |
| T-S107u-3 | **Saša:** `disable_save_plus` roundtrip — vidi korake ispod | ✅ (oba smjera: TRUE→FALSE potvrđen kroz bazu + export + „Save +" u Add Activity; FALSE→TRUE kroz panel + nestali „Save +"; stari file bez kolone **ne resetira** postavku) |
| T-S107u-4 | **Saša:** panel više ne prikazuje staru vrijednost nakon importa (bez reloada) | ✅ (kvačica se ažurirala bez reloada) |
| T-S107u-5 | **Saša:** uvoz koji mijenja SAMO postavke javlja **„Settings updated: 1"** umjesto „Nothing to import" | ✅ (Settings updated 1, Automation rules 2, ostalo 0) |
| T-S107u-2 | (backlog, ne blokira) `groupAttributes` uzima `Default` s prvog retka grupe ⇒ atributski `default_value` ovisi o redoslijedu redaka; export piše `*` prvi, generator zadnji → `Status.default_value` `Izvrsen`↔`null` klackanje. Fix: ignorirati `Default` na retku koji ima `DependsOn` (pripada u `default_map`) | ⬜ |

---

## S107t — `Rata br` · čišćenje lažnih rata · import generator · `rata` u Automations roundtripu

**App kod (prvi put nakon S107f):** `Automations` sheet proširen na **`rata`** akciju
(export+import) — zadnja rupa roundtripa uz `export_profiles`. **Rata tok prebačen na model B
i novi model datuma:** sve rate jedne kupovine dijele `event_date` = dan kupnje, razlikuje ih
`Datum naplate` + pomak `session_start`-a za 1 min; `Rata br` = 1..N. **D1 iznimka za rate
ukinuta, D1a (`Datum kupovine`) povučen** — atribut izbačen iz strukture.

**Python:** `make_financije_import.py` (novo) — Review → `Activities Events` xlsx, sve 4 tihe
rupe ugrađene + guard imena/tipova atributa protiv strukture. `fix_lazne_rate.py` (novo) —
**32** HLK/APN retka gdje je `mjesec/godina` pročitan kao `rata n/N` (ne 19 kako je isprva
procijenjeno; `Broj rata = 24` je isti obrazac).

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-9 | Programske kontrole (paritet `validation_rules`, diff protiv backupa, simulacija oba parsera, typecheck+build) | ✅ (programski) |
| T-S107t-1 | **Saša:** Structure import — 15 atributa (⚠ ne 16), **Automation rules 2** | ✅ (1 area / 1 kat. / 15 attr / 2 rules / 0 skipped) |
| T-S107t-2 | **Saša:** `Rata br` se pojavljuje/nestaje zajedno s `Broj rata` | ✅ (Not set → No → Yes; oba se pojave/nestanu zajedno; `Datum naplate` auto 11.09. za Mastercard) |
| T-S107t-3 | **Saša:** ⭐ **rata tok** (novi kod) — rate na istom danu, `Datum naplate` 11./3., `Rata br` 1..N, bez zapisa s punim iznosom | ✅ (300/3: modal 3×100 · 3 reda na današnjem danu 19:11/12/13 · 13 = 10+3 ⇒ nema zapisa od 300 · rata 3: `Isplata` 100, `Rata br` 3, naplata 11.11.2026, `Status` Planiran, komentar `…/Hrana i ostalo · rata 3/3 · 100 od 300`) |
| T-S107t-4 | **Saša:** Activities import 10 zapisa — 28.02.2023. daje **3 reda**, `Rate? = Yes` na Anjinoj rati | ✅ (Anja redak: `Rate?`=Yes, `Broj rata` 96, `Rata br` 43, Uplata 450, `Prihodi`/`Povrat Anja`, naplata 28.02.2023, `Stanje` 1744,76, „3 empty" = točno Isplata/Izvod opis/Valuta) |
| T-S107t-5 | **Saša:** export roundtrip — `rata` redak u Automations sheetu, re-import bez promjena | ✅ (export: oba retka s punim `rata` kolonama · Activities re-import **0 new / 0 modify / 10 unchanged (skipped)** ⇒ `row_hash` skip radi · Structure re-import: 1 attr updated = `Status.default_value`, v. T-S107u-2, i „Automation rules 2" = brojač pročitanih, ne zapisanih) |
| T-S107t-6 | **Saša:** obrisan `rata` redak pri uvozu **ne briše** konfiguraciju | ✅ (import: „Automation rules 1" + 0 updated + „Nothing to import"; modal nakon toga i dalje radi — 400/2 → 2×200, naplate 11.09./11.10.) |
| T-S107t-7 | **Saša:** Review — 32 očišćena retka, `Rate?=DA` 661 → 629 | ✅ (32 redaka, svih 32 `Rate?`/`Broj rata` prazni — filter nudi samo „(Blanks)"; `Rate?=DA` **629** od 4996, prije fixa 661 i svih 32 bilo DA; `Tip`/`Podtip` 0 promjena vs backup) |

**Sljedeće:** popravci iz testova → batch import po godinama → `Financije_all` na PROD pod
Kokinim računom (D6). **Ostaje neizvršeno:** 15 nemarkiranih rata; `Saldo kontrola` 7 razlika
(pitanja za Koku); `export_profiles` roundtrip rupa.

---

## S107s — odluke o formatu importa + generator strukture `Financije_all` (Python; NEMA app koda)

Sve otvorene odluke oko app-import Excela donesene (`session_start`, `comment` vs atribut,
`Valuta`, `Sort`, email u kol. G). **`make_financije_all_structure.py` (novo)** generira
Structure Excel za novu areu iz PROD exporta + `Taksonomija` sheeta: 15 atributa,
Tip/Podtip regenerirani (18/65), `Napomena` → **`Izvod opis`**, novi `Datum naplate`/
`Datum kupovine`, Unit EUR, `Valuta` bez defaulta, `Automations` set_attribute pravilo.

**Četiri tihe rupe u importu nađene čitanjem koda** (sve u `NEXT_SESSION_PROMPT.md` DIO 2):
`session_start` mora biti **tekst** (inače svi redovi → 09:00 bez upozorenja) · krivo ime
atributa se gubi **bez greške** · `Rate?` je boolean pa bi `'DA'` postao **FALSE** · email u
kol. G mora biti račun koji **izvodi** import (inače se svi redovi preskoče kao „tuđi").

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (dry run, simulacija `buildValidationRules`, `\|` u taksonomiji, `DateMap`, CommentTemplate, Automations zaglavlje, SORT_ORDER pokrivenost) | ✅ (programski) |
| T-S107s-1 | **Saša:** pregled generiranog structure filea | ✅ (Sort OK; nalaz „stara taksonomija" bio je pogled u BASE `events_export_preview`, ne u generirani file) |
| T-S107s-2 | **Saša:** Structure import u TEST | ✅ (16 atributa / 1 pravilo) — **nadomješten T-S107t-1** jer se struktura promijenila |
| T-S107s-3 | **Saša:** Add Activity — lanac `Racun→Izvor→Status`, `Tip→Podtip`, EUR, `Datum naplate` auto | ✅ (potvrđeno na ekranu) |

**Sljedeće:** `make_financije_import.py` (10 zapisa u TEST) → spot-check → export roundtrip
→ batch po godinama. **Izmjereno ali neizvršeno:** 15 nemarkiranih rata; `Datum kupovine`
na ratama (199 grupa, 105 s ratom 1, anker aritmetički); `automations.rata` prijenos.

---

## S107r — migracija na Kokinu taksonomiju `Taksonomija (2)` (Python data-prep; NEMA app koda)

Koka složila vlastitu taksonomiju (18 Tipova; novi `Kuća`/`Prihodi`/`Prijevoz`/`Advokati`,
ukinuti `Namirnice`/`Mirovina`/`Povrat`/`Ostali prihodi`/`Ostavine`). **2061 od 3426
klasificiranih redaka (58 %)** nosilo je par kojeg više nema — bez migracije bi ih
`apply_rules.py` tiho resetirao na N/A.

Novo: `migrate_taksonomija.py` (remapira **4** mjesta istom tablicom), `Preimenovanja`
uvjetne kolone (`Smjer uvjet`/`Iznos min`/`Iznos max`/`Napomena uvjet`) + `--only-renames`,
`Tools/backup_to_external.bat`. `Pravila` 70 → **71**, `Tip_AI` 911 remapirano, `Neklasificirano` 10.
**`Pouzdanost` distribucija identična — `VISOKA` 1014 → 1014**, Σ novca delta 0,00.

| ID          | Test                                                                                      | Status         |
| ----------- | ----------------------------------------------------------------------------------------- | -------------- |
| T-S107r-A…F | Regresija `--dry`, pokrivenost 2061/2061, lanac na kopiji, integritet, rekonsilijacija brojki, sync | ✅ (programski) |
| T-S107r-1   | **Saša:** spot-check 2061 retka — `Tip_O` stari par + `Pouzdanost` raspored nepromijenjen (⚠ kriterij ispravljen: `PRAVILO` na 661 retku je legitimno, od prije migracije) | ✅ (2061 + `VISOKA` 646) |
| T-S107r-2   | **Saša:** 4 uvjetna slučaja — `Prihodi\|Povrat Anja` **45**, `Transfer\|Anja` **27**, `Kuća\|Holding (smeće)` 91, `Investicije\|Štednja` 1 | ✅              |
| T-S107r-7   | **⚠ NALAZ → IZVRŠENO:** 4 rate Anjine posudbe (397, 3727, 3612, 3613) pale u `Transfer\|Anja` zbog anomalije u izvoru (`Smjer=Isplata` uz `Uplata`=450; rata plaćena 400+50). `fix_anja_rate.py` (novo, guard po `source_key`+Napomena+iznos). `Prihodi\|Povrat Anja` 41→**45**, svi `X/96` na jednom mjestu | ✅ (Saša: vizualna potvrda 4 retka, filter `Pravilo run` = `2026-07-30 12:08`) |
| T-S107r-3   | **Saša:** `Taksonomija`/`_v1`/`Preimenovanja` (33 reda) + dropdowni rade na svim redcima   | ✅              |
| T-S107r-4   | **Saša:** `Pravila` 71 red; 2× Anja u pravom redoslijedu; `grobn` iznad `NAKNADA`          | ✅              |
| T-S107r-5   | **Saša:** `Tip_AI` filtriran na stare vrijednosti = 0 redaka                               | ✅              |
| T-S107r-6   | **Saša:** `backup_to_external.bat` dvoklikom — `[OK] Backup zavrsen`, 0 FAILED. `*EXTRA File` linije su **namjerne**: 12 starih `.pre-*` backupa koje `/E /XO` bez `/MIR` prijavi ali **ne briše**. Provjereno: lokalno 179 / na D: 191 fajlova, **0 lokalnih fajlova nije backupirano** | ✅              |

**✅ S107r ZATVOREN — svih 6 Sašinih + svih 6 programskih testova prošlo, 0 otvorenih stavki.**

**Sljedeće:** layout faza 1 (`sheet_layout.py`, header red 3 / freeze / collapsed help);
`srednja` (205) i `niska` (1023) traka nad NOVOM taksonomijom; AI re-run + **nov eval**
(stari baseline 81,5 % je mjeren na staroj taksonomiji).

---

## S107p — harvest `visoka` trake (Python data-prep; NEMA app koda)

`apply_ai.py --harvest`: 347 redaka preneseno `Tip_AI`/`Podtip_AI` → `Tip`/`Podtip` (Saša prošao
`visoka` + dio `srednja`/`niska`). 3 retka preskočena (861/887/3166 — imali ručni `Tip`, `OK`
ostaje trajno kao poznat ne-bug slučaj). Preostalo po traci: visoka 2, srednja 205, niska 1023.

| ID          | Test                                                                                     | Status         |
| ----------- | ---------------------------------------------------------------------------------------- | -------------- |
| T-S107p-A…D | Dry vs pravi harvest identični brojevi, report konzistentan, remaining-po-traci izračun   | ✅ (programski) |
| T-S107p-1   | **Saša:** vizualni pregled 347 novoklasificiranih redaka (`Labela iz` = `AI:* 2026-07-28`) | ⬜              |
| T-S107p-2   | **Saša:** 3 preskočena retka i dalje imaju ručni `Tip`, `AI odluka` ostaje `OK` (namjerno)  | ⬜              |

**Sljedeće:** `srednja` traka (205), pa `niska` (1023). V. `NEXT_SESSION_PROMPT.md`.

---

## S107o — kolona `AI odluka` + 2 odobrena popravka IZVRŠENA (Python data-prep; NEMA app koda)

Mehanizam za bilježenje odluke o AI prijedlogu nije postojao — T-S107n-1 je bio neizvediv
kako je napisan. Sad: kolona **`AI odluka`** (`OK`/`NE`/`?`) + `apply_ai.py --harvest`.
Review **5004 → 4996** redaka (−636,36 € dvostrukog troška), `Pravila` 69 → **70**.

| ID          | Test                                                                                     | Status         |
| ----------- | ---------------------------------------------------------------------------------------- | -------------- |
| T-S107o-A…E | Kolona na kopiji, harvest ciklus s rubnim slučajevima, eval guard, dedup, pravilo         | ✅ (programski) |
| T-S107o-1   | **Saša: GLAVNI POSAO** — `visoka` traka (261 redaka / **31 par**), upiši `OK` po grupi     | ✅ (S107p — prošao i dio srednja/niska) |
| T-S107o-2   | **Saša:** kontrola nakon `--harvest` — `OK` očišćen, `Labela iz` = `AI:visoka …`          | ✅ (S107p harvest, brojke se poklapaju; T-S107p-1 čeka vizualnu potvrdu) |
| T-S107o-3   | **Saša:** 8 Kokinih redaka dobilo `Izvod opis`; izvodnih parnjaka nema                     | ⬜              |
| T-S107o-4   | **Saša:** `freeze_panes` `F4855` → `F2` — odgovara li ti tako                              | ⬜              |

**Odobreno a NIJE izvršeno:** `reconcile_izvoda.py` matcher po `Datum naplate`+iznos (jedino
preostalo od tri S107n stavke — ne dira Review, može bilo kad).

---

## S107n — AI `--run` IZVRŠEN (1593 prijedloga) + duplikati rata (Python data-prep; NEMA app koda)

`ai_classify.py --run` napisan i pokrenut. **1593 retka** ima `Tip_AI`/`Podtip_AI`/`Pouzdanost_AI`/
`AI run`; `Tip`/`Podtip` netaknuti. **visoka 261 · srednja 239 · niska 1093** · NEPOZNATO 196 · $1,17.
⚠ `visoka` 16 % (eval je davao 57 %) — N/A hrpa je teži ostatak, bulk-accept traka je tanka.
**NALAZ: 8 duplikata rata, 636,36 €** (odobreno, nije izvršeno). Detalji: ENRICH_PLAN §2l.

| ID          | Test                                                                                                                           | Status         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| T-S107n-A…I | Umetanje kolona na kopiji, dry/limit modovi, recovery nakon pada kredita, eval regresija, kontrola upisa, skeniranje duplikata | ✅ (programski) |
| T-S107n-1   | **Saša: GLAVNI POSAO** — pregled AI prijedloga, sort po `Pouzdanost_AI`, kreni od `visoka`                                     | → T-S107o-1 (mehanizam sad postoji) |
| T-S107n-2   | **Saša:** kontrola — svaki redak s `AI run` mora imati `Tip` = N/A/prazan                                                      | ✅ (Claude programski, 0 kršenja) |
| T-S107n-3   | **Saša:** 196 `NEPOZNATO` — je li stvarno neodredivo iz teksta                                                                 | ⬜              |
| T-S107n-4   | **Saša:** Agram — ožujak=C5 / listopad=Lacetti? (blokira popravak pravila #43)                                                 | ◐ (par 4505 potvrdio ožujak=C5; ostatak čeka Sašu) |
| T-S107n-5   | **Saša:** 8 duplikata rata — potvrdi da Kokin redak ostaje                                                                     | ✅ (potvrdio 2026-07-28, izvršeno) |
| T-S107n-6   | **Saša:** red 4759 BIBERON / "Amsteradam"                                                                                      | ⬜              |
| T-S107n-7   | **Saša:** freeze + collapse grupe prežive AI run                                                                               | → T-S107o-4 (freeze namjerno promijenjen na F2) |

**Sve tri odobrene stavke:** ~~fix 8 duplikata~~ ✅ S107o · ~~pravilo `voce i povrce`~~ ✅ S107o ·
`reconcile_izvoda.py` matcher po `Datum naplate`+iznos — **još otvoreno**.

---

## S107m — AI klasifikacija: eval + 223 ispravke labela (Python data-prep; NEMA app koda)

Eval naslijepo na već klasificiranim redcima. **v1 62,5 % → v2 80,3 % → v3 80,8 % / Tip 91,9 %**
(ručne labele, zamrznut uzorak 600). `visoka` pouzdanost = 95 % točno na 47 % redaka.
Nevaljanih parova **171 → 0**. Potrošeno na API ~$4,4. Puni kontekst: `NEXT_SESSION_PROMPT.md`.

| ID          | Test                                                                     | Status |
| ----------- | ------------------------------------------------------------------------ | ------ |
| T-S107m-A…J | Eval v1/v2/v3, razlaganje neslaganja, kontrola upisa, store, guardovi     | ✅ (programski) |
| T-S107m-1   | **Saša:** pregled 223 ispravljena retka (filter `Pravilo run`=2026-07-26) | ✅ (Saša 2026-07-27) |
| T-S107m-2   | **Saša:** Konzum/Radnička — 30 redaka, RATA retci ostaju `Namirnice`      | ✅ (Saša 2026-07-27) |
| T-S107m-3   | **Saša:** BIBERON — svih 55 `Projekti \| Sasa_Informatika`               | ✅ (Saša nabrojao 54; razlika objašnjena — red 4759 ima "biberon" samo u `Izvod opis`, `Napomena`="Amsteradam" → T-S107n-6) |
| T-S107m-4   | **Saša:** HAK raspored C5/Lacetti                                        | ✅ (OK) — **ali otkrio `Voćarna` red 4512 pod `AGRAM` pravilom → lančano do nalaza duplikata rata, v. S107n** |
| T-S107m-5   | **Saša:** `Investicije \| Dionice` vidljiv u dropdownu                   | ✅ (Saša 2026-07-27) |
| T-S107m-6   | **Saša:** freeze + collapse grupa prežive script run                     | ⬜ → T-S107n-7 |

**Riješeno u S107n:** `--run` mode napisan i izvršen (1593 prijedloga).
**Još otvoreno:** `source_key` fix i `sql/0NN_staging_financije.sql` nisu napravljeni.
**Detalji testova:** [S107k_tests.md](test-sessions/S107k_tests.md) (novi) + [S107j_tests.md](test-sessions/S107j_tests.md) + [S107i_tests.md](test-sessions/S107i_tests.md) + [S107h_tests.md](test-sessions/S107h_tests.md) + [S107g_tests.md](test-sessions/S107g_tests.md) + [S107f_tests.md](test-sessions/S107f_tests.md)
**Upute za izvode (i za Koku):** [UPUTE_izvodi.md](UPUTE_izvodi.md) — kako skinuti/spremiti/obraditi bankovne izvode

---

## S107k — v3 Verdikt tok + date_accuracy + kartice_datum_naplate (Python, data-prep; NEMA app koda)

Svi pravi runovi IZVRŠENI ove sesije (v. S107k_tests.md). Review: 5004 redaka; **Datum naplate
100% popunjen**; Saldo kontrola 10→7; Nematchano_v3 **0 za odluku**; N/A 2026 = 178.

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107k-A | date_accuracy: 360 event_date → bankovni datum; dry=real; re-sort bez gubitka                                  | ✅ (programski)      |
| T-S107k-B | Harvest E2E ciklus (test kopija): prefill → harvest → v3 44→0; idempotentan                                    | ✅ (programski)      |
| T-S107k-C | "Used kandidat" zaštita: DUP ne sinka red matchan drugom tx; `Review (matchan)` info-only                      | ✅ (programski; bug uhvaćen i fiksan prije pravog runa) |
| T-S107k-D | kartice_datum_naplate spot-check: stm 2024-09→2024-10-08, 2026-06→2026-07-06; 0 naplata<kupovina; P3           | ✅ (programski)      |
| T-S107k-E | Saldo kontrola 10→7 bez novih razlika (2025-02, 2025-07 Astrum, 2025-08 riješene)                              | ✅ (programski)      |
| T-S107k-F | Claude tipfeler (sasa EU:549, 2024→2025) — DUP sync + pravilo #15 → Projekti                                   | ✅ (Saša otkrio)     |
| T-S107k-1 | **Saša:** vizualni pregled — filter `Pravilo run`=2026-07-23 (30 klasifikacija) + `Izvor reda`=Konsolidacija   | ✅ (Saša 2026-07-26) |
| T-S107k-2 | **Saša:** Datum naplate kontrola — Visa ~4.–8. u M+1; MC = 11. u M+1                                           | ✅ (Saša 2026-07-26) |
| T-S107k-3 | **Saša:** Saldo kontrola 7 preostalih — velike 3 = pitanja za Koku (2026-01 +359, 2024-09 +149, 2×±49)         | ⏸ BLOKIRANO — čeka Koku (nije test nego pitanja za nju) |

---

## S107l/m — N/A petlja 2026 (Python, data-prep; NEMA app koda)

S107l (2026-07-25, Sonnet): 3 kruga `suggest_candidates` → 42 nova pravila → **N/A 2026 178 → 85**.
Stanje u fileu 2026-07-26: Review 5004 redaka, **69 pravila** + 17 Preimenovanja, **N/A 2026 = 76**,
N/A ukupno 2424 (1606 s tekstom). PENDING_TESTS nije bio ažuriran u S107l — nadoknađeno ovdje.

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107l-1 | 3 kruga pravila (15+15+12) — svaki `--dry` prije pravog runa, backup lanac `.pre-*` kompletan                 | ✅ (programski)      |
| T-S107l-2 | Pravilo-review prije harvesta ulovio 4 problema (PAYPAL/KEKS PAY/GLS isključeni, NATURAL→Medical_Koka, NAKNADA vs `grobn` priority-order) | ✅ (programski)      |
| T-S107l-3 | Priority-order pattern: specifičnije pravilo (`grobn`) umetnuto IZNAD preširokog (`NAKNADA`) — prvi match pobjeđuje | ✅ (programski)      |
| T-S107m-1 | **Saša:** red 2115 `LJEKARNA OREBIC` Medical_Sasa → Medical_Koka (ručna izmjena u Excelu)                     | ✅ (Saša 2026-07-26) |

**Otvoreno za Koku (ne testovi — pitanja):** 700 € bankomat 26.11.2025 (2 PRESKOČENA v3 reda);
Saldo kontrola 7 razlika (2026-01 +359,43; 2024-09 +149; 2×±49 multisport; 3 sitna);
odluka o pre-2024 no-text N/A masi (~818 redaka, nema izvoda).

---

## S107j — ZABA parser fix + izvodi konsolidirani u Review + N/A rule petlja (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107j-A | `parse_zaba_racun` fix: saldo-lanac Σupl/Σisp = bankov Zbroj prometa 40/40 u cent; lanac neprekinut 2023-26   | ✅ (programski verificirano) |
| T-S107j-B | `consolidate_review.py`: +113 (31 MASTERCARD→Transfer, 82 N/A); Nematchano_v3 57 + Saldo kontrola 21/31        | ✅ (programski verificirano) |
| T-S107j-C | `suggest_candidates.py`: Neklasificirano 2026 top 20, Tip/Podtip dropdowni; `backfill_napomena` 1870          | ✅ (programski verificirano) |
| T-S107j-1 | **Saša:** N/A klasifikacija petlja — Neklasificirano popuni → `--harvest` → `apply_rules` → sljedeći krug kraći | ⬜ (glavni put do PROD) |
| T-S107j-2 | **Saša:** `Nematchano_v3` pregled — dismiss dup, dodaj genuine missing                                        | ✅ (S107k Verdikt pass — 0 za odluku) |
| T-S107j-3 | **Saša:** `Saldo kontrola` — razlike → pitanja za Koku                                                        | → T-S107k-3 (sad 7)  |
| T-S107j-4 | **Saša:** Napomena backfill kontrola — 1870 popunjeno, Kokine ne-prazne netaknute (P3)                        | ⬜                   |

**Backlog (S107j):** ~~date-accuracy pass~~ ✅ S107k; per-month reconcile view za velike saldo razlike;
~~PBZ Visa Transfer stragglers~~ — provjeriti je li ostalo N/A "PBZCARD" redova nakon S107k pravila.

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
