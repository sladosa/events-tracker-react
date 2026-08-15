# S108 — Faza 1: RPC salda + Overview tab + pločica sa sidrom

**Datum:** 2026-08-15 · **Model:** Opus 5 · **Grana:** `test-branch`
**Prethodno:** S107z (odluke o analitici i sidru), S107x Faza 1a (model salda dokazan
protiv banke: 17/30 mjeseci u cent, naivni zbroj 0/30).
**Spec:** `docs/OVERVIEW_TAB_SPEC.md` §2.4, §2.10, §2.12, §2.15, §2.16, §2.17

⚠ **Oznaka sesije:** `S107z` je potrošio abecedu, pa ovo ide kao **S108**. CLAUDE.md
„S108+: Intelligence layer" time gubi broj — Intelligence layer je S109+.

---

## Što je napravljeno

| Sloj | File | Novo/izmjena |
| --- | --- | --- |
| SQL | `sql/035_area_group_agg.sql` | novo — `rpc_area_group_agg`, `app_can_read_area`, `area_agg_rows`, validacija slugova |
| SQL | `sql/036_balance_anchors.sql` | novo — tablica `balance_anchors` + RLS + `rpc_area_balance_anchored` |
| SQL | `sql/037_financije_dashboard.sql` | novo — **podatak, ne shema**: dashboard config za `Financije_all` |
| Alat | `data-prep_tools/Financije/verify_rpc_vs_model.py` | novo — troslojni prihvatni test (Review / baza / RPC) |
| Tipovi | `src/types/database.ts` | `WidgetFilter`, `BalanceByGroupWidget`, `DashboardConfig`, `AreaSettings.dashboard` |
| Data | `src/lib/overviewApi.ts` | novo — prvi `.rpc()` pozivi u aplikaciji + CRUD sidara |
| Data | `src/lib/dashboardConfig.ts` | novo — fixup slug referenci (S105d razred) |
| UI | `src/components/overview/OverviewTab.tsx`, `BalanceByGroupTile.tsx` | novo |
| UI | `src/hooks/useAreaDashboard.ts`, `useRunningBalance.ts` | novo |
| UI | `src/pages/AppHome.tsx` | tab `Overview` (samo ako Area ima config — OQ-4), redoslijed Overview → Activities → Structure |
| UI | `src/components/activity/ActivitiesTable.tsx` | izračunata kolona `Stanje` (§2.12) |
| Fix | `StructureAddAreaPanel.tsx` | „From template" kopira `areas.settings` **bez** `export_profiles` |
| Fix | 6 poziva `fetchAllPaged*` | `.order('id')` — paginacija bez stabilnog sorta |
| Tema | `src/lib/theme.ts` | `THEME.overview` (teal) |

`npm run typecheck` ✅ · `npm run build` ✅

---

## Programske kontrole (već izvršene)

`verify_rpc_vs_model.py` nad TEST bazom, 2220 eventa, prozor `2025-01-01 .. 2026-07-11`:

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | **B vs C** — RPC vs neovisna agregacija istih redaka iz baze | ✅ 0,00 razlike po grupi |
| P-2 | **A vs B** — Review (Python model) vs baza | ✅ 0,00; od 2222 retka u prozoru razlikuju se 2 (Σ 1,60) |
| P-3 | `p_from` (sidro, strogo nakon) vs isto filtriranje u Pythonu | ✅ 0,00 |
| P-4 | Kontrast: naivni zbroj po `Racun`u | ZABA −22.943,71 vs model **150,80** ⇒ §2.10 vrijedi i na ovom podskupu |
| P-5 | D1b nad podacima: za svih 634 izvršenih redaka `Datum naplate == event_date` | ✅ 0 iznimaka ⇒ sidro smije uspoređivati po `event_date` |
| P-6 | P2 guard: `chain_key ≠ NULL` eventa u Arei | 0 (L1 leaf) — guard nema što izbaciti, ali stoji u SQL-u |

Nakon ponovnog puštanja `sql/036` (2026-08-15), `rpc_area_balance_anchored` end-to-end:

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-7 | Bez sidra: `anchored=false`, saldo identičan `rpc_area_group_agg` | ✅ 150,80 / −1.978,32 |
| P-8 | Sidro ZABA `1000 @ 2026-06-30` → `1000 + (1.262,11 − 112,30)` | ✅ 2.149,81, `n=6` na obje putanje |
| P-9 | RF (bez sidra) nepromijenjen dok ZABA ima sidro | ✅ |
| P-10 | ⭐ **Granica je stvarno isključiva**, ne samo sama sa sobom dosljedna: postoji točno **1 redak datiran 2026-06-30** (−1,60); `> D` daje `n=6`, `> D−1` daje `n=7`, razlika = taj redak. Sidro `0,00 @ D` daje isti saldo kao `p_from = D`. | ✅ |
| P-11 | Grupa sa sidrom a **bez prometa poslije** i dalje se prikazuje (`UNION` putanja): sidro `777,77 @ 2026-12-31` → saldo 777,77, `n=0`. Isto za grupu koja **nema nijedan redak**, samo sidro. | ✅ |
| P-12 | Zaštita: poziv bez prava → **HTTP 401** `No access to area …`; nepostojeći slug → **HTTP 400** koji **imenuje** slug, ne 0,00 | ✅ |

⚠ Zanimljivo: redak koji sjedi na granici je isti onaj od **1,60 €** koji se pojavljuje kao
`A vs B` razlika. Sretna slučajnost — da je granica bila uključiva, P-10 bi to uhvatio.

**Verificirani brojevi** (izvršeno, `Izvor ∈ {Racun, Cash} ∧ Status ≠ Planiran`):

| račun | uplata | isplata | saldo | n |
| --- | ---: | ---: | ---: | ---: |
| Kokin tekući ZABA | 96.792,87 | 96.642,07 | **150,80** | 430 |
| Sašin tekući RF | 26.314,96 | 28.293,28 | **−1.978,32** | 213 |

⚠ **Zamka koja je pri tome nađena i popravljena:** prvi run alata je „našao" 45 eventa bez
atributa, drugi run 49 drugih. Nijedan nije postojao — `select_all` je paginirao **bez
`order=`**, pa su se retci između stranica preklopili i istovremeno preskočili. Alat sad
**baca iznimku** ako pozivatelj ne zada `order=`. Isti bug je bio u 6 poziva u `src/` — v.
T-S108-9.

---

## Ručni testovi

**Preduvjet za sve:** TEST baza, Area `Financije_all`, pokrenuti **035, 036 i 037**
u Supabase SQL Editoru. `npm run dev:test`.

⚠ **036 je nakon prvog puštanja ispravljen** (`FULL JOIN` s `IS NOT DISTINCT FROM` Postgres
odbija) — mora se pustiti ponovo. Bez toga pločica javlja grešku, kolona `Stanje` se ne
prikazuje, a `rpc_area_group_agg` (035) i dalje radi normalno.

### T-S108-1 ⭐ Overview tab postoji samo gdje ima konfiguracije (OQ-4)

1. Filtar → Area `Financije_all`. **Očekivano:** tabovi su `Overview · Activities · Structure`, tim redoslijedom.
2. Filtar → bilo koja druga Area (npr. `Health_Sasa`). **Očekivano:** taba `Overview` **nema**; ako si bio na njemu, prebacuje te na Activities.
3. Vrati se na `Financije_all`. **Očekivano:** tab se vraća.

**Pad:** prazan Overview tab na Arei bez configa, ili tab koji ostane vidljiv nakon promjene Aree.

### T-S108-2 ⭐ Pločica „Stanje po računu" — brojevi

1. Overview tab na `Financije_all`.
2. **Očekivano:** dva retka — `Kokin tekući ZABA` **150,80 €** i `Sašin tekući RF` **−1.978,32 €**.
3. Ispod imena stoji **„od početka podataka · N zapisa"** (dok nema sidra).
4. RF iznos je crven, ZABA zelen.

**Pad:** bilo koji drugi broj (posebno ZABA ≈ −22.943 ⇒ filtar `izvorplacanja` se ne primjenjuje),
ili tekst koji ne kaže da je zbroj od početka podataka.

### T-S108-3 „planirano" — dva smjera

1. Ista pločica.
2. **Očekivano:** uz ZABA stoji `planirano −2.521,38 € (13)`. Uz RF ničega (nema planiranih).

### T-S108-4 ⭐ Sidro — „u banci" + Potvrdi

1. U polje **u banci** uz ZABA upiši `100`. **Očekivano:** čip `Δ +50,80` (app pokazuje više nego banka).
2. Upiši `150,80`. **Očekivano:** čip `✓ slaže se`.
3. Klikni **Potvrdi**. **Očekivano:** toast, pločica se osvježi, saldo je i dalje `150,80 €`, a podnaslov sad kaže **„od potvrde 15.08.2026. · 150,80 € · 0 promjena poslije"**.
4. Dodaj novu transakciju na ZABA s `Izvor=Racun`, `Isplata=10`, datum **danas**. Vrati se na Overview. **Očekivano:** `140,80 €`, „1 promjena poslije".
5. Dodaj transakciju datiranu **jučer** (dakle ≤ datum potvrde). **Očekivano:** saldo se **NE mijenja** — pravilo je „strogo nakon".

**Pad:** korak 5 promijeni saldo ⇒ dvostruko brojanje oko sidra (§2.17, točka 3).

### T-S108-5 Δ ostaje kad se ne slaže

1. Nakon T-S108-4, upiši u „u banci" broj koji nije jednak prikazanom saldu.
2. **Očekivano:** Δ čip s razlikom i objašnjenjem u tooltipu. Ništa se ne mijenja dok ne klikneš Potvrdi.

### T-S108-6 ⭐ Drill s pločice → Activities

1. Klikni na **iznos** uz `Kokin tekući ZABA`.
2. **Očekivano:** prebacuje na Activities, filtar „Racun = Kokin tekući ZABA", lista pokazuje samo taj račun.
3. Vrati se, klikni na **planirano**. **Očekivano:** Activities filtriran na `Status = Planiran`.

⚠ **Poznato ograničenje:** filtar nosi **jedan** atribut, a uvjet pločice ima dva
(`Izvor` + `Status`). Drill zato znači „pokaži mi ovaj račun", ne „pokaži mi točno one retke
koje je pločica zbrojila". To **nije** pad testa.

### T-S108-7 ⭐ Izračunata kolona `Stanje` (§2.12)

1. Nakon T-S108-6 (lista filtrirana na jedan račun, sortiranje **najnovije prvo**).
2. **Očekivano:** nova kolona `Stanje` skroz desno; prvi (najnoviji) redak pokazuje isti broj kao pločica.
3. Idi niz listu: svaki sljedeći redak = prethodni **minus** iznos tog retka.
4. Kartični retci (`Izvor = Visa/Mastercard`) pokazuju **—**, ne broj.
5. Prebaci sortiranje na „najstarije prvo". **Očekivano:** kolona **nestane**.
6. Makni filtar računa. **Očekivano:** kolona nestane.
7. Ako je sidro postavljeno (T-S108-4): retci **stariji ili jednaki** datumu potvrde pokazuju **—**.

**Pad:** kolona koja se prikaže kod miješanih računa ili u obrnutom sortu, ili brojevi koji
ne dolaze do salda s pločice.

### T-S108-8 Fixup slugova pri preimenovanju (S105d razred)

1. Structure → Edit Mode → `Financije_all` → `Transakcija` → atribut `Racun`.
2. Promijeni slug `racun` → `racun_test`. Save.
3. **Očekivano:** toast „Overview: 1 reference updated…" i Overview tab **i dalje radi**.
4. Vrati slug na `racun`. **Očekivano:** opet 1 referenca, pločica radi.
5. **Negativna kontrola:** ručno u bazi pokvari slug u configu (`racun` → `nepostojeci`) i otvori Overview. **Očekivano:** crvena kutija s porukom RPC-a koja **imenuje** slug — ne „0,00" i ne prazna pločica.

### T-S108-9 Paginacija bez stabilnog sorta (regresija)

1. Structure → Delete Area nad Areom s **više od 1000** `event_attributes` (npr. kopija Financija).
2. **Očekivano:** brisanje prođe; ranije je moglo pasti na FK grešku jer je stranica preskočila retke.
3. Isto za Excel import s `Delete?` kolonom nad >1000 atributa.

⚠ Ovo je najteže reproducirati jer je bug **nedeterministički** — može proći i bez popravka.
Vrijednost testa je da ne padne.

### T-S108-10 „From template" nosi settings, bez `export_profiles`

1. Structure → Add Area → **From template** → bilo koji template koji ima `automations`.
2. **Očekivano:** nova Area ima automatiku (rata modal / auto-comment) odmah, bez ručnog podešavanja.
3. **Očekivano:** nema `export_profiles` u novoj Arei (Excel export koristi default kolone).
4. **Očekivano:** nema nikakvog sidra u novoj Arei (`balance_anchors` je prazan za nju).

### T-S108-11 Grantee (read-only) ne smije potvrditi saldo

1. Podijeli `Financije_all` s drugim računom kao **read**.
2. Kao grantee otvori Overview.
3. **Očekivano:** pločica se vidi, brojevi su tu, **gumba „Potvrdi" nema**.
4. Kao **write** grantee: gumb postoji i radi.

### T-S108-12 Mobitel

1. Otvori Overview na telefonu (ili DevTools ≤ 400 px).
2. **Očekivano:** polje **u banci** i čip su vidljivi i upotrebljivi; ništa ne ispada iz ekrana; tabovi pokazuju samo ikone.

**Pad:** polje „u banci" izostavljeno na mobitelu — čip tada visi bez konteksta (to je bio
prvi nesporazum pri pregledu skice).

---

## Otvoreno / nije u ovoj fazi

- **Tri kante planiranog** (Dospjelo / Uskoro / Kasnije, §2.13) — traži granicu po
  `Datum naplate`, a RPC filtrira po `event_date`. Faza 4.
- **Traka „Dospjelo → potvrdi"** (§2.5a) — ovisi o gornjem.
- **Konfigurator UI** — namjerno se ne gradi dok N nije 2 (§2.15).
- **`Dashboard` sheet u Structure roundtripu** — Faza 4; do tada config putuje samo kroz
  `sql/037` odnosno „From template".
- **OQ-5 do kraja:** izračunato `Stanje` sad postoji, pa **spremljeni atribut `Stanje` treba
  prestati pisati** u `make_financije_import.py`. U aplikaciji sudara nema (lista ne prikazuje
  atribute), ali u Excel exportu se pojavljuju dvije kolone istog imena.
- **Drill s dva uvjeta** — `FilterContext` nosi jedan `attrFilter`. Predviđeno u §2.16 kao
  test; ispalo je da filtru fali mogućnost, ne da je widget izmislio nešto.
