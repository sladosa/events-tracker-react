# NEXT SESSION PROMPT — Financije: import generator (kritični put)

**Zadnja sesija: S107r (2026-07-30, Opus).** Migracija na Kokinu taksonomiju izvršena
(2061 redak preimenovan, `VISOKA` 1014 očuvana, 0 nevaljanih parova, 12/12 testova).
Time je pao preduvjet *"taksonomiju zaključati PRIJE importa"* → kritični put je otvoren.

**Sljedeća sesija = korak 4 pipelinea: generator app-import Excela.** To je **jedina prava
rupa** na putu do PROD-a. Trajni plan prelaska: `FINANCIJE_MIGRACIJA.md` **§13**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Kako import uopće radi

Aplikacija uvozi Excel u kojem je **jedan red = jedna transakcija**. Prvih osam stupaca su
fiksni i aplikacija ih traži po imenu, a od devetog nadalje idu atributi (jedan stupac po
atributu, u zaglavlju piše ime atributa — `Racun`, `Tip`, `Podtip`, `Uplata`…).

Najvažniji stupac je **prvi, `event_id`**:

- **prazan** → aplikacija to čita kao **novi zapis** i kreira ga
- **popunjen** → to je postojeći zapis i aplikacija ga **ažurira**

Zato je uvoz povijesti jednostavan: svih ~5000 redaka ide s praznim `event_id`, dakle sve su
to novi zapisi. Aplikacija nikad ne briše zapis zato što ga u file-u nema — vidi samo ono
što joj daš.

## Što treba napisati

**Alat koji od odobrenog Reviewa napravi taj Excel.** Ništa više. Mapiranje je gotovo 1:1
jer je Review od početka pravljen s ciljnim stupcima:

```
Review                    →  import Excel
─────────────────────────────────────────────
(ništa)                   →  event_id        (prazno = novi zapis)
(konstanta)               →  Area            = Financije_all
(konstanta)               →  Category_Path   = Transakcija
event_date                →  event_date
Napomena                  →  comment
Racun, Izvor, Smjer,      →  isti atributi
Uplata, Isplata, Stanje,
Tip, Podtip, Status,
Rate?, Broj rata,
Datum naplate
```

Radne kolone pipelinea (`Tip_O`, `Tip_AI`, `Pouzdanost`, `source_key`, `Izvod *`, `Pravilo run`…)
**ne idu u import** — njih je 13 od 30 i one su skela, ne podaci.

## Kako izgleda prelazak — i što s Kokinim finalnim file-om

Ovo je odgovor na tvoju brigu da nakon predaje file-a treba "relativno brzo" prijeći.
**Ne treba** — jer se povijest uvozi dok ona normalno radi.

| kad | što se radi | Koka |
| --- | --- | --- |
| T1 | struktura `Financije_all` u bazi, pod **njenim** računom | **napravi login** |
| T2 | uvoz povijesti u batchevima (2026 prva kao proba, pa 2025 → 2024 → 2023) | radi normalno u Excelu |
| T3 | provjera: brojevi, atributi, `Stanje`, prava pristupa | radi normalno |
| **T4** | **dan prelaska:** pošalje finalni `.xlsm` → uvezu se samo redovi noviji od zadnjeg uvezenog datuma | **od tad unosi u appu** |
| T5+ | mjesečni Excel roundtrip | export → dopiši → import |

**Prozor u kojem ne smije unositi je samo T4 — nekoliko sati, ne tjedana.**

**Njeni novi redovi ne moraju proći kroz Review.** Oni nemaju Tip/Podtip (ona ih ne vodi),
pa ulaze kao **`N/A`** i ona ih klasificira poslije, u appu. To je upravo poanta zaokreta od
29.7.: klasificira osoba koja zna transakciju. Time otpada i ona procjena od ~90 min za
"delta merge u Review" — ne treba ga.

## Tri stvari koje moraju biti gotove prije dana prelaska

1. **Kokin login** i da vidi `Financije_all`.
2. **`Datum naplate` na uvozu.** Automatika koja ga popunjava radi **samo** kod unosa u
   aplikaciji, ne i kod uvoza iz Excela. Bez male dorade bi novim redovima ostao prazan, a
   odluka D1 je bila da ga nitko ne tipka ručno.
3. **Jedan probni roundtrip s njom** — export, dopiši jedan red, import. To je ono što će
   raditi svaki mjesec; bolje da prvi put pukne dok smo tu.

## Što se NE dira

Stare aree `Financije` i `Financije_old` brišu se **na kraju**, nakon provjere i s backupom.
Do tada su netaknuta rezerva.

---

# DIO 2 — Tehnički dio (za Claudea)

## Cilj sesije

Napisati **`make_financije_import.py`**: odobreni Review → `Activities Events` Excel za
`ExcelImportModal`. Podržati `--from/--to` (batch po razdoblju, §12) i `--dry`.

## Format (provjereno u kodu 2026-07-30)

`src/lib/excelExport.ts:61` — `FIXED_COLUMNS`, **redoslijed je obvezan** (A–H):

```
event_id | Area | Category_Path | event_date | session_start | created_at | user_email | comment
```

- Display zaglavlja se razlikuju od internih imena: G = `User`, H = `leaf comment`
  (`FIXED_DISPLAY_HEADERS`). `excelImport.ts` mapira po **poziciji** za A–H.
- `ATTR_COL_START = 9` (I) — jedan stupac po atributu, zaglavlje = **ime atributa**.
- `row_hash` kolona je **opcionalna**, traži se po imenu zaglavlja (`excelImport.ts:204`).
  Za CREATE retke je nepotrebna (skip vrijedi samo za retke s `event_id`, linija ~399).
- Iznad podataka postoji **LEGEND blok**; `parseExcelFile` ga sam prepoznaje i preskače
  (`excelImport.ts:119`). Uzor generiranja: `data-prep_tools/Tools/excel_import_template.py`.
- **`Category_Path` = BEZ imena aree** (kritično pravilo iz CLAUDE.md). Leaf `Transakcija`
  je **L1**, pa je puna putanja samo `Transakcija`.

## ⚠ Otvoreno pitanje #1 — `session_start` mora biti jedinstven po transakciji

Leaf je L1, dakle **nema roditeljskih kategorija** → **P2 parent eventi ne nastaju**
(area nije kategorija). To uklanja cijelu klasu složenosti i `parentEventLoader` iz igre.

Ali: `session_start` je **sidro sesije**, zaokruženo na minutu, i po njemu ide detekcija
kolizije. Ako svih 4996 redaka dobije isti `session_start` (npr. datum 00:00), aplikacija
će ih tretirati kao **jednu sesiju** — a `replace` grana kolizije briše po `chain_key`/
`session_start` (linije ~756, ~778; klasa buga T-BUGG-5, fix S104).

**Hipoteza: svaka transakcija = svoja sesija**, pa `session_start` treba biti unikatan —
npr. `event_date` + inkrementalna minuta po danu (1440/dan je više nego dovoljno).
**Prvi zadatak sesije: pročitati collision granu `excelImport.ts` i potvrditi ili oboriti
ovo prije generiranja ijednog reda.** Nije provjereno u S107r.

## ⚠ Otvoreno pitanje #2 — `Datum naplate` pri importu

`attributeRules.ts` (`set_attribute`) evaluira se **samo u `AddActivityPage`**. Import i Edit
ga ne zovu. Preporuka S107q: proširiti na Import sa *"popuni samo ako je prazno"*
(P3-kompatibilno, isti modul). Za **povijesni** import nije blocker — `Datum naplate` je u
Reviewu **100 % popunjen** (S107k) pa ide kao vrijednost. Blocker je za **T4+ / roundtrip**.

## Mapiranje Review → import

| import stupac | izvor |
| --- | --- |
| `event_id` | **prazno** (sve CREATE) |
| `Area` | `Financije_all` |
| `Category_Path` | `Transakcija` |
| `event_date` | `event_date` |
| `session_start` | izvedeno (v. otvoreno #1) |
| `created_at` | prazno / now |
| `user_email` | Kokin (area je pod njenim accountom, D6) |
| `comment` | `Napomena` |
| atributi I+ | `Racun`, `Izvor`, `Smjer`, `Uplata`, `Isplata`, `Stanje`, `Tip`, `Podtip`, `Status`, `Rate?`, `Broj rata`, `Datum naplate` |

**Ne prenositi:** `Tip_O`, `Podtip_O`, `Tip_AI`, `Podtip_AI`, `AI odluka`, `Pouzdanost*`,
`AI run`, `Alternativa / nap.`, `Labela iz`, `Problem`, `source_key`, `Izvod opis`,
`Izvod file`, `Izvor reda`, `Pravilo run`.

⚠ **Imena atributa u zaglavlju moraju točno odgovarati `attribute_definitions.name`** u
`Financije_all` (ne slugu). Provjeriti nakon T1 exportom strukture.

## Struktura `Financije_all` (T1) — što treba prije generatora

Put: Structure Excel export postojeće PROD aree `Financije` → osvježi `Tip`/`Podtip` iz
`Taksonomija` sheeta → dodaj 2 atributa + `Automations` red → import kao **nova** area pod
Kokinim accountom. Detalji i inventura zatečenog stanja: `ENRICH_PLAN.md` §2o / stari
`NEXT_SESSION_PROMPT` odjeljak (u gitu, commit `9b1cd8a`).

- Za preuzimanje 1:1: `Racun`, `Izvor` (`depends_on` na `racun`), `Status` (`depends_on` +
  `default_map`), `Podtip` (`depends_on` na `tip`), `settings.automations.rata`, `export_profiles`.
- **Nedostaje:** `Datum naplate`, `Datum kupovine` (datetime), `attribute_rules`.
- **Zastarjelo:** `Tip` 13 starih opcija (treba **18** iz nove `Taksonomija`), `Podtip`
  `options_map` pre-S107g. Višak: `Valuta`; `Smjer` ima radnu opciju `PROVJERI`.

## Volumen / batching

4996 eventa × ~12 atributa ≈ **60k `event_attributes`**. Ne u jednom naletu (S105 IO
incident). `--from/--to`, 2026 prva kao proba mehanizma (750 redaka).

## Reuse

`data-prep_tools/Financije/Obsolete/make_import.py` (32 kB) i `make_financije3_import.py`
(19 kB) = baza; `Tools/excel_import_template.py` = LEGEND/EVENT DATA format;
spec `docs/EXCEL_FORMAT_ANALYSIS_v2.md`. `Obsolete/verify_financije3_import.py` = uzor za
post-import spot-check.

## Redoslijed rada u sesiji

1. Pročitati collision granu `excelImport.ts` → riješiti otvoreno #1 **prije** koda.
2. `make_financije_import.py --dry` na 2026 → pokazati Saši brojke (redaka, atributa, raspon
   datuma), pa generirati file.
3. Ručni pregled generiranog file-a (Saša) → import u **TEST** area/projekt kao proba.
4. Tek onda T1 (`Financije_all` struktura na PROD-u) i pravi batch import.

## Stanje podataka (2026-07-30)

| | |
| --- | --- |
| Review | **4996** redaka, `event_date` 2022-12-01 → 2026-07-08 |
| Taksonomija | **18 Tipova / 65 parova** (Kokina, `Taksonomija_v1` = stara, skrivena) |
| N/A | **1570** (2022: 30 · 2023: 587 · 2024: 476 · 2025: 429 · **2026: 48**) |
| — od toga bez ikakvog teksta | **818** ⇒ trajno nerješivo, ne čekati ih |
| `Datum naplate` | **100 % popunjen** (svih 4996) |
| Pravila | **71** valjano, 0 preskočeno |
| Kokin snapshot | `Financije 2026.xlsx` od **2026-07-08** (divergencija ~3,5 tj.) |
| Zadnji backup | `*.pre-anjarate-20260730_120836.xlsx` + vanjski disk `D:` |

## Nije na kritičnom putu (svjesno odgođeno)

1. **Layout faza 1** (`sheet_layout.py`) — Sašin zahtjev: header u **red 3**, freeze `F4`
   **tek tada** (dok je header u redu 1 ispravno je `F2`, sad garantirano u
   `sync_taxonomy.py`), help u collapsed redove 1–2 **kolona B**, za sve sheetove.
   Blast radius: header red 1 hardkodiran u **15** skripti, `min_row=2`/`range(2,` u **22**,
   **12 kopija** funkcije za traženje kolone (`find_header_col` ×5, `hdr_index` ×4,
   `header_map` ×3). Red: **prvo čitači tolerantni na raspored** (`find_header_row` skenira
   1–6, radi i na starom i na novom), pa promjena rasporeda, Review **zadnji**.
2. **Kvaliteta klasifikacije** (izmjereno S107r, ako se ikad vrati na to):
   - **Ne gledati sadašnje AI kolone na N/A** — 736/739 je `niska`, a nastale su protiv
     taksonomije kojoj su fala 4 od 18 Tipova (`Kuća`/`Prihodi`/`Prijevoz`/`Advokati`);
     u tim novim Tipovima danas sjedi **24 %** klasificiranih redaka. Valjane su (0 nevaljanih),
     ali nisu svježe.
   - **Prvi korak nije AI nego lookup:** od 752 N/A s tekstom, **209 (73 merchanta)** dijeli
     brand-ključ s klasificiranim retkom koji **jednoznačno** ima isti par → besplatan
     prijedlog iz vlastite prošle odluke. 172 višeznačna, 371 merchant nikad viđen.
     ⚠ Obavezan pregled, ne auto-apply: `GLS-D` i `GOOGLE` su preširoki (u S107l izričito
     odbačeni kao dostavljač/multi-servis).
   - **AI re-run** tek na ostatak, s **few-shot primjerima iz 3426 klasificiranih redaka**
     (nema fine-tuninga; "učenje" = primjeri u promptu — isti mehanizam koji je dao skok
     62,5 → 80,3 %). ~$1. **Nov eval obavezan** — stari 81,5 % / Tip 92,3 % je mjeren na
     staroj taksonomiji i **void**; mjeriti na uzorku tipa N/A, ne na klasificiranima
     (S107n: `visoka` 57 % na klasificiranima vs 16 % na N/A hrpi).
3. **Za Koku:** 700 € bankomat 26.11.2025; `Saldo kontrola` 7 razlika (2026-01 +359,
   2024-09 +149, 2×±49 multisport, 3 sitna). Ne blokiraju import.
4. `reconcile_izvoda.py` matcher po `Datum naplate`+iznos (jedina neizvršena S107n stavka).
5. Otvoreni testovi iz starijih sesija: T-S107p-1/2, T-S107o-3/4, T-S107n-3/6.

## Pravila okruženja

Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi
non-interactive; **cmd guši zarez u argumentima**); `PYTHONUTF8=1`; `ANTHROPIC_API_KEY` u
`.env.local`. Review mora biti **zatvoren** za pisanje.
**`--dry` prvo, pokazati brojke, čekati potvrdu prije upisa.**
**NIKAD ne pushati/mergati na `main` bez izričitog Sašinog zahtjeva.**
Backup na vanjski disk: `data-prep_tools\Tools\backup_to_external.bat` (additive, bez `/MIR`).

⚠ `data-prep_data/` i `Claude-temp_R/` su gitignorirani ⇒ postoje samo na Sašinom disku +
vanjskom disku `D:`. Git čuva alate, ne podatke.

## Zamke (plaćene otkrićem — ne ponavljati)

1. **Odluka koja nije u sheetu ne postoji.** Koka je *rekla* da ukida
   `Domaćinstvo|Investicije`, ali red je stajao u Taksonomiji → par valjan → rename se nikad
   ne bi aktivirao. Isto: mapping izveden samo iz stvarnih `Tip` vrijednosti promašio je
   `auto Lacetti|parking` (0 u `Tip`, **8 u `Tip_AI`**). Oba uhvatio `--dry`.
2. **`apply_rules` ne popravlja redak s VALJANIM parom** (~linija 516) — kriva ali valjana
   klasifikacija traži jednokratnu skriptu (`fix_vocarna_pravilo.py`, `fix_anja_rate.py`).
3. **Retke tražiti po `source_key`, ne po broju retka** — pomiču se pri sortu/dedupu.
4. **`openpyxl`**: `insert_cols`/`insert_rows` ne pomiču `column_dimensions`, DV ni CF; nove
   kolone umetati **desno** od `J`/`K`; `cell(r,c,None)` ne briše — mora `.value = None`.
   Čuva layout, **gubi grafove/slike/pivote**.
5. Sve što nosi status mora biti **unutar autofiltera** — inače se pri sortu raspari od reda.
6. **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** → obrisani `source_key` mora u
   registar `V3 preskočeno`.
7. `BATCH` u `ai_classify.py` je 25; `effort: low` zna vratiti 1/40 uz uredan `stop_reason`;
   structured-output `enum` **nije** obvezujuć.
8. **Ne pisati testni kriterij kao "X se ne smije pojaviti"** ako X ima legitiman povijesni
   izvor — u S107r su dva takva kriterija dala lažni alarm (`Pouzdanost=PRAVILO` na
   preimenovanim redcima je legitimno od prije migracije). Kriterij vezati na **nepromijenjen
   agregat**, ne na odsutnost vrijednosti.
