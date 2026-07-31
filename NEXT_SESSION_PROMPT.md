# NEXT SESSION PROMPT — Financije: import generator (kritični put)

**Zadnja sesija: S107s (2026-07-31, Opus).** Sve otvorene odluke oko formata importa
donesene; **struktura `Financije_all` generirana i verificirana**, čeka Sašin pregled +
import u TEST. Preostaje **jedan alat: `make_financije_import.py`**.

**Trajni plan prelaska:** `FINANCIJE_MIGRACIJA.md` **§13**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Gdje smo stali

Prošli put je bilo pitanje "kako Review pretvoriti u Excel koji aplikacija uvozi". Ispalo je
da prije toga treba **struktura** — jer uvozni file mora u zaglavlju imati **točna imena
atributa** kakva postoje u bazi. Zato je prvo nastala struktura.

**Napravljeno i spremno:**
`data-prep_data/Financije/Financije_all_structure_20260731_180411.xlsx`

To je file za **Structure tab → Import**. Kad ga uvezeš, nastane nova area `Financije_all`
s 15 atributa. Ništa se ne briše — import je nedestruktivan.

## Što slijedi, tim redom

| korak | što | tko |
| --- | --- | --- |
| 1 | pregledaš generirani structure file (`Sort` redoslijed, `Podtip` retci) | **Saša** |
| 2 | `npm run dev:test` → Structure tab → Import → nastaje `Financije_all` u TEST bazi | Saša |
| 3 | Claude piše `make_financije_import.py`, vadi **10 raznolikih zapisa** | Claude |
| 4 | import tih 10 u TEST → gledaš Add Activity, listu, **export roundtrip** | Saša |
| 5 | popravke → obrišeš areu → ponovo (petlja je jeftina) | oboje |
| 6 | tek kad sjedne: `Financije_all` na PROD pod Kokinim računom + batch import | oboje |

## Što je odlučeno prošli put (da se ne otvara ponovo)

- **Svaka transakcija = svoja „aktivnost"** — dobiva svoje vrijeme (09:00, 09:01, 09:02…
  po danu). Bez toga bi se svih 21 transakcija jednog dana slijepilo u jedan redak u listi.
- **Kokina napomena → `Event Note`** (polje za slobodan tekst), **bankovni opis → atribut
  `Izvod opis`**. Dva odvojena mjesta, ne miješaju se.
- **`Valuta` ostaje, ali bez defaulta** — inače bi svaki novi zapis trajno spremio „EUR".
  Umjesto toga `Uplata`/`Isplata`/`Stanje` sad pokazuju **EUR** uz polje.
- **Auto-komentar skraćen** na `{racun}/{tip}/{podtip}` (tvoja odluka) — jer je `Izvod opis`
  pri unosu uvijek prazan pa bi rep ostao prazan.
- **4 retka s `PROVJERI`** — nisu dvojbeni smjer, nego: 2× početno stanje (1.1.2023.),
  1× prazan placeholder, 1× pravi zapis bez iznosa. Prva tri se **ne uvoze**.
- **`Datum kupovine` na ratama** — radi se, ali kao zaseban korak nad Reviewom, poslije.

## Što još čeka tebe

1. ~~Redak 1521 („Ašo")~~ — ✅ **riješeno**: saldo se ne pomiče (5640,16 → 5640,16), a
   sljedeći redak se zatvara iz iste brojke ⇒ **nepotpuni duplikat** retka 1503 (isti tekst
   „Ašo", isti saldo, 20 € tjedan ranije). **Ne uvozi se.** Ograda: RF izvodi počinju
   2024-09, pa se 2024-03 ne može unakrsno provjeriti bankom.
2. **Kredencijali TEST baze** (`.env.testing`) — zadnji put korišteni u S106; ako `npm run
   dev:test` ne prođe login, javi.
3. Iz starijih sesija: 700 € bankomat 26.11.2025 (pitanje za Koku); `Saldo kontrola`
   7 razlika. **Ne blokiraju import.**

---

# DIO 2 — Tehnički dio (za Claudea)

## Cilj sesije

Napisati **`make_financije_import.py`**: odobreni Review → `Activities Events` Excel za
`ExcelImportModal`. Podrška `--from/--to` (batch po razdoblju) i `--dry`. Prvi run: 10
raznolikih redaka u TEST.

## ⚠ Četiri tihe rupe u importu (sve provjerene u kodu 2026-07-31 — NE otkrivati ponovo)

1. **`session_start` MORA biti tekst `"HH:MM"`.** `excelImport.ts:239` čita kolonu E preko
   `cellStr`; ako je ćelija prava Excel time/date vrijednost, `cellStr` vrati puni ISO,
   `parseTimeStr` vrati `null`, a pozivatelj ima fallback `?? {h:9,m:0,s:0}` → **svi redovi
   dobiju 09:00**, bez upozorenja. App export piše `'14:26'` kao string — isto mora i generator.
2. **Krivo ime atributa se gubi bez greške.** `excelImport.ts:836` — atribut čije se ime ne
   poklapa s `attribute_definitions.name` za leaf kategoriju se preskoči, **bez greške i bez
   warninga**. `validateLegendHeaders` provjerava samo LEGEND vs zaglavlje *unutar filea*, ne
   protiv baze. ⇒ prvi batch mora biti mali + brojanje atributa nakon importa.
3. **`Rate?` je `boolean`, a Review ima `'DA'`.** `buildAttrData` radi
   `String(value).toLowerCase() === 'true'` → `'DA'` bi se spremio kao **FALSE** na svih 661
   rata. Generator mora pisati pravi boolean (openpyxl `True`) ili tekst `TRUE`.
4. **Email u koloni G mora biti račun koji IZVODI import.** Redak čiji se email razlikuje od
   trenutnog korisnika klasificira se kao „tuđi" i po defaultu se **preskoči**
   (`foreignMode='skip'`). Za TEST → Sašin, za PROD → Kokin (D6).

## Zašto svaka transakcija treba svoj `session_start`

`useActivities.ts:242` grupira listu po `user_id_category_id_session_start`. Leaf je L1
`Transakcija` ⇒ **category_id je isti za sve retke** ⇒ svi koji dijele `session_start` se
slijepe u **jednu aktivnost**. Maksimum je 21 tx/dan (1194 dana), dan ima 1440 minuta.

**Odluka: `09:00 + redni broj unutar dana`** (09:00, 09:01, …). To je **isti obrazac koji
postojeći PROD podaci već koriste** (provjereno u exportu: 2026-06-01 ima 09:00 i 09:01).

⚠ Batchevi moraju biti **datumski disjunktni**, inače novi batch sudari `session_start` s
već uvezenim danom → collision detekcija. Cutoff na granici dana.

## Format `Activities Events` (provjereno na stvarnom exportu)

Uzorak: `data-prep_data/Financije/events_export_preview_20260731_163957.xlsx` (sheet `Events`).

- **LEGEND blok** na vrhu: `Col | Area | Category_Path | Attribute | Type | Default | Description`,
  jedan redak po atributnoj koloni. **LEGEND je izvor istine za mapiranje kolona**
  (`parseDataRows` gradi `colToAttr` iz njega, ne iz zaglavlja).
- Zatim redak `EVENT DATA:`, pa zaglavlje, pa podaci.
- Fiksne kolone A–H (`excelExport.ts:61`), **redoslijed obvezan**:
  `event_id | Area | Category_Path | event_date | session_start | created_at | User | leaf comment`
- `ATTR_COL_START = 9` (I). Zaglavlje atributa smije biti `AttrName` **ili**
  `AttrName (Kategorija)` — `validateLegendHeaders` reže na `(`.
- `Category_Path` = **bez imena aree** → samo `Transakcija` (leaf je L1).
- `created_at` prazan → kod postavi `session_start + 1s`.
- `row_hash` nije potreban za CREATE retke.
- **Leaf je L1 ⇒ nema roditeljskih kategorija ⇒ P2 parent eventi ne nastaju**
  (`parentEventLoader` izvan igre — cijela klasa složenosti otpada).

## Mapiranje Review → import

| import stupac | izvor |
| --- | --- |
| `event_id` | **prazno** (sve CREATE) |
| `Area` | `Financije_all` |
| `Category_Path` | `Transakcija` |
| `event_date` | `event_date` |
| `session_start` | `09:00 + n` unutar dana, **kao tekst** |
| `created_at` | prazno |
| `User` (kol. G) | email računa koji importa |
| `leaf comment` | `Napomena` (Kokin tekst) |
| atributi I+ | `Racun`, `Izvor`, `Smjer`, `Uplata`, `Isplata`, `Tip`, `Podtip`, `Izvod opis` ← **`Izvod opis` kolona Reviewa**, `Rate?` (**boolean!**), `Broj rata`, `Datum naplate`, `Status`, `Stanje` |

**Ne prenositi:** `Tip_O`, `Podtip_O`, `Tip_AI`, `Podtip_AI`, `AI odluka`, `Pouzdanost*`,
`AI run`, `Alternativa / nap.`, `Labela iz`, `Problem`, `source_key`, `Izvod file`,
`Izvor reda`, `Pravilo run`. **`Valuta` se ne piše** (prazno = EUR).

**Ne uvoziti retke:** 32, 33 (početna stanja 1.1.2023.), 4983 (prazan placeholder),
**1521** (nepotpuni duplikat retka 1503 — saldo se ne pomiče, v. DIO 1).
⇒ svi retci sa `Smjer=PROVJERI` ispadaju; filtrirati po tome, ne po brojevima redaka.

## Struktura `Financije_all` — ✅ NAPRAVLJENO (S107s)

**`data-prep_tools/Financije/make_financije_all_structure.py`** (novo). Sve odluke su u
`MODS` bloku na vrhu (`SORT_ORDER`, `RENAME`, `SET_UNIT`, `CLEAR_DEFAULT`, `NEW_ATTRS`,
`AUTOMATION_ROWS`, `COMMENT_TEMPLATE`) ⇒ promjena = jedna linija + ponovni run.

Ulazi: BASE = `events_export_preview_*.xlsx` (sheet `Structure`, PROD area `Financije`);
REVIEW = `Financije_review_*.xlsx` (sheet `Taksonomija`).
Izlaz: **`Financije_all_structure_20260731_180411.xlsx`** — 15 atributa / 46 attr-redaka
+ `Automations` sheet.

| Sort | Atribut | Tip | Promjena vs PROD |
| --- | --- | --- | --- |
| 1–3 | Racun · Izvor · Smjer | text | lanac ovisnosti dignut na vrh |
| 4–5 | Uplata · Isplata | number | **+ Unit EUR** |
| 6–7 | Tip · Podtip | text | **regenerirani iz Taksonomije** (18 Tipova / 65 Podtipova) |
| 8 | **Izvod opis** | text | **preimenovan** iz `Napomena`, slug `izvod_opis` |
| 9–10 | Rate? · Broj rata | boolean/number | 1:1 |
| 11–12 | **Datum naplate · Datum kupovine** | datetime | **novi** |
| 13 | Status | text | 1:1 (`default_map` po Izvoru očuvan) |
| 14 | Stanje | number | 1:1 (+ Unit EUR, ostaje skriven trikom `smjer=SKRIVENO`) |
| 15 | Valuta | text | **default `EUR` maknut** |

`CommentTemplate` = `{racun}/{tip}/{podtip}` na Area i Category retku.
`Automations`: `datum_naplate ← izvorplacanja`, `Racun=same | Cash=same | Mastercard=next:11 | Visa=next:3`
(11 i 3 = isti brojevi kao postojeći `automations.rata.date_map` `{RF:3, ZABA:11}`).

**Verifikacija (izvršena, ne pretpostavljena):** simulirani `groupAttributes()` +
`buildValidationRules()` iz `structureImport.ts` nad generiranim fileom → ispisan točan JSON
koji bi završio u `validation_rules`. Sve mape ispravne; Taksonomija provjerena da ne sadrži
`|`; `DateMap` provjeren istim pravilom kao `isValidDateRule`.

⚠ **`automations.rata` se NE prenosi Structure importom** — `Automations` sheet pokriva samo
`set_attribute`. Rata konfiguraciju treba prenijeti ručno/SQL-om na `Financije_all`, inače
se gubi (Post-Finish rata modal prestaje raditi).

⇒ **Sašin princip (S107s): „sve bi trebalo ići importom".** Prijenos aree je stvaran
scenarij, pa je svaki dio konfiguracije koji roundtrip ne pokriva **tihi gubitak** — otkrije
se tek kad nešto prestane raditi. Poznate rupe: **`automations.rata`** i **`export_profiles`**
(ključ kolone je `attr:Area||CatPath||AttrName` ⇒ profil ne preživi promjenu imena aree ni
atributa). Kandidat za app backlog: proširiti `Automations` sheet na `rata` + dodati
`ExportProfiles` sheet u Structure roundtrip. **Nije blocker za Financije migraciju** —
rata config se za `Financije_all` prenese ručno.

## Stanje podataka (2026-07-31)

| | |
| --- | --- |
| Review | **4996** redaka (`Financije_review_20260710_1448.xlsx`), 2022-12-01 → 2026-12-01 |
| po godinama | 2022: 30 · 2023: 1135 · 2024: 1607 · 2025: 1474 · 2026: 750 |
| prazno u ciljnim kolonama | `Racun`/`Smjer`/`Izvor`/`Status`/`Datum naplate`/`event_date` = **0** |
| namjerno prazno | `Uplata` 4499 · `Isplata` 498 · `Stanje` 1786 (D9) · `Napomena` 818 · `Podtip` 1570 (N/A) · `Rate?`/`Broj rata` 4335 |
| Taksonomija | **18 Tipova / 65 parova**; nijedna vrijednost ne sadrži `|` |
| max transakcija/dan | **21** (1194 dana ukupno) |
| Zadnji backup | `*.pre-anjarate-20260730_120836.xlsx` + vanjski disk `D:` |

**Anomalije (izmjerene):** redak 4997 `event_date` = **2026-12-01** (vjerojatan tipfeler,
snapshot je od 2026-07-08); redak 4996 = 2026-08-07 (tjedan u budućnost).
Odluka: **uvoze se kakvi jesu**, ispravak u appu (radimo na TEST-u pa ne smeta).

## Zadaci koji su izmjereni i čekaju izvršenje

1. **15 nemarkiranih rata** — retci gdje je banka zapisala `RATA n/m` a Koka nije, pa
   `Rate?`/`Broj rata` nisu popunjeni. Otkriveni preko `Izvod opis`. Popis u
   `Claude-temp_R/test-sessions/S107s_tests.md`. ⚠ Ključ mora biti **`RATA n/m`**, ne goli
   `n/m` — goli uzorak hvata **31 lažni pozitiv** (datumi `03/23`, `12/23` u napomenama).
   Kontrola: 661 postojeći rata redak ima `Broj rata` == N u **661/661** slučajeva.
2. **`Datum kupovine` na ratama** (Sašina ideja) — svi retci iste kupovine dobivaju isti
   datum ⇒ zbroj po njemu = ukupna cijena artikla. Mjerenja:
   - Ključ grupe **mora sadržavati iznos**: `(račun, merchant, N)` spaja različite kupovine
     (`Konzum 1/6` postoji **4×**, iznosi 20,44 / 21,28 / 17,09 / 26,82).
     S iznosom: **199 grupa**, od toga **9 i dalje sudara**.
   - **Samo 105/199 grupa ima ratu `1/N`** — 85 počinje na 2/12, 3/12… (kupovina starija od
     podataka) ⇒ **tražiti ratu 1 ne radi**.
   - **Anker računati aritmetički:** redak s najmanjim `n` minus `(n−1)` mjeseci.
     ⚠ Razmak nije uvijek mjesec: 250 parova na ~1 mj, ali **136 unutar istog mjeseca**
     ⇒ grupe s neurednim korakom **flagirati, ne pogađati**.
   - 40 rata redaka nema `n/N` u napomeni ⇒ negrupirljivi.
   - Terminološka ograda: dobiveno je *datum naplate prve rate*, ne stvarni trenutak kupovine.
     Za zbrajanje je svejedno (ključ je konzistentan).
   - **Radi se kao zaseban Review-side korak** (uzor `backfill_datum_naplate.py`), NE u
     generatoru — generator ostaje 1:1.

## Redoslijed rada u sesiji

1. Saša potvrdi structure file → import u TEST (`npm run dev:test`) → nastaje `Financije_all`.
2. **Export strukture iz TEST-a** → potvrdi stvarna `attribute_definitions.name` imena
   protiv kojih generator piše zaglavlja (rupa #2 gore).
3. `make_financije_import.py --dry --limit 10` → pokazati brojke → generirati file.
4. Import u TEST → spot-check: broj eventa, broj `event_attributes` po eventu,
   `Rate?` je stvarno TRUE, `Datum naplate` popunjen, lista aktivnosti pokazuje **N redaka,
   ne 1**.
5. Export roundtrip iz TEST-a (to je ono što Koka radi mjesečno).
6. Tek onda batch po godinama (2026 prva, 750 redaka).

## Volumen / batching

4996 eventa × ~11 atributa ≈ **55k `event_attributes`**. Import radi **jedan `INSERT` po
eventu** (atributi se batchaju unutar retka) ⇒ 750 redaka ≈ 1500 poziva. Ne sve odjednom
(S105 IO incident).

## Reuse

`data-prep_tools/Financije/Obsolete/make_import.py` (32 kB) + `make_financije3_import.py`
(19 kB) = baza; `Tools/excel_import_template.py` = LEGEND/EVENT DATA format;
`Obsolete/verify_financije3_import.py` = uzor za post-import spot-check.
Spec: `docs/EXCEL_FORMAT_ANALYSIS_v2.md`.

## Nije na kritičnom putu (svjesno odgođeno)

1. **Layout faza 1** (`sheet_layout.py`) — header u red 3, freeze `F4` tek tada, help u
   collapsed redove 1–2 kol. B. Blast radius: header red 1 hardkodiran u **15** skripti,
   `min_row=2` u **22**, **12 kopija** funkcije za traženje kolone. Red: **prvo čitači
   tolerantni na raspored**, pa promjena, Review **zadnji**.
2. **Kvaliteta klasifikacije** — `srednja` (205) i `niska` (1023) traka nad **novom**
   taksonomijom. **AI baseline 81,5 % / Tip 92,3 % je VOID** (mjeren na staroj taksonomiji).
   Prvi korak nije AI nego **lookup**: 209 N/A redaka (73 merchanta) dijeli brand-ključ s
   klasificiranim retkom koji jednoznačno ima isti par. ⚠ Obavezan pregled — `GLS-D` i
   `GOOGLE` su u S107l izričito odbačeni kao preširoki.
3. `reconcile_izvoda.py` matcher po `Datum naplate`+iznos (jedina neizvršena S107n stavka).
4. Otvoreni testovi: T-S107p-1/2, T-S107o-3/4, T-S107n-3/6.
5. **Stare aree `Financije` (357 eventa) i `Financije_old` brišu se NA KRAJU**, nakon
   verifikacije, s backupom (D6).

## Pravila okruženja

Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi
non-interactive; **cmd guši zarez u argumentima**); `PYTHONUTF8=1`; `ANTHROPIC_API_KEY` u
`.env.local`. Review mora biti **zatvoren** za pisanje (`~$` lock file = otvoren je).
**`--dry` prvo, pokazati brojke, čekati potvrdu prije upisa.**
**NIKAD ne pushati/mergati na `main` bez izričitog Sašinog zahtjeva.**
TEST app: `npm run dev:test` (`.env.testing`). Backup: `Tools/backup_to_external.bat`.

⚠ `data-prep_data/` i `Claude-temp_R/` su gitignorirani ⇒ postoje samo na Sašinom disku +
vanjskom disku `D:`. Git čuva alate, ne podatke.

## Zamke (plaćene otkrićem — ne ponavljati)

1. **Odluka koja nije u sheetu ne postoji.** Koka je *rekla* da ukida `Domaćinstvo|Investicije`,
   ali red je stajao u Taksonomiji → par valjan → rename se nikad ne bi aktivirao.
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
8. **Ne pisati testni kriterij kao „X se ne smije pojaviti"** ako X ima legitiman povijesni
   izvor — vezati kriterij na **nepromijenjen agregat**, ne na odsutnost vrijednosti.
9. **Ne pouzdati se u to da file „izgleda dobro"** — S107s je strukturu verificirao
   simulacijom stvarne import logike (`groupAttributes` + `buildValidationRules`), i to je
   jedini razlog zašto znamo da su `options_map`/`default_map` točni.
