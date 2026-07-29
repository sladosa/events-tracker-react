# NEXT SESSION PROMPT — Financije: zaokret na "import prvi, klasifikacija poslije"

**Zadnja sesija: S107q (2026-07-29, Opus).** Nije bilo koda — strateška revizija redoslijeda.
Prethodno: S107p (2026-07-28) harvestao `visoka` traku (347 redaka).

---

# DIO 1 — Plan jednostavnim rječnikom

## Što se promijenilo u razmišljanju

- **Do sada je plan bio: prvo posloži svu povijest, pa onda Koka prelazi u aplikaciju.**
  Ispalo je da to ne funkcionira, jer se posao puni brže nego što se prazni. Koka u svom
  Excelu dodaje otprilike 147 transakcija mjesečno, a to su redovi bez Tipa i Podtipa —
  znači da svaki mjesec čekanja stvara novu hrpu koja poslije treba proći cijeli isti
  postupak (normalizacija, izvodi, AI klasifikacija, tvoj pregled). Trenutna razlika
  između Reviewa i njenog file-a je već **tri tjedna, oko 150 transakcija**.

- **Novi plan: Koka prelazi u aplikaciju prvo, povijest se dovršava poslije.**
  Razlog je jednostavan: kad Koka unosi transakciju u aplikaciju, Tip i Podtip su
  obavezni izbornik na samom unosu. Klasificira ih osoba koja zna što je transakcija
  bila, isti dan, i to je najbolja moguća klasifikacija — a besplatna je. Kad ista
  transakcija ostane u Excelu, za tri mjeseca postaje redak nad kojim AI pogađa i nad
  kojim ti moraš potvrđivati.

- **Neklasificirani stari redovi ne blokiraju ništa.** `N/A` je legitimna vrijednost u
  taksonomiji (doslovno je u popisu Tipova). Redak iz 2023. bez Tipa i dalje nosi datum,
  račun, iznos, opis i opis s izvoda. Analitika za 2023. je time slabija, ali nije
  pokvarena — i ni na koji način ne sprječava Koku da unese jučerašnju kupovinu.

- **Ovo nije novi izum, nego opcija koja je odavno zapisana kao rezerva.**
  U `FINANCIJE_MIGRACIJA.md` §12.3 već piše: "sve odjednom kao N/A pa reklasifikacija kroz
  D7 update flow ostaje fallback". Odluka od 2026-07-29 je da ta rezerva postane glavni plan.

## Zašto je to i tehnički povoljnije

- **Problem s `source_key` nestaje sam od sebe.** Sada se svaki redak prepoznaje po ključu
  izračunatom iz datuma, iznosa i rednog broja unutar dana — a taj se ključ pomakne čim
  Koka umetne redak u sredinu nekog starog dana. Nakon importa svaki redak ima svoj
  `event_id` iz baze, koji se ne mijenja nikad. Problem koji je zapisan kao "preduvjet za
  ponovljiv re-ingest" prestaje postojati umjesto da ga rješavamo.

- **Mehanizam za popravljanje već postoji i već je na PROD-u.** `row_hash` + update-guard
  (D7, deploy 2026-07-15) napravljeni su baš za ovo: izvezeš Areu u Excel, pustiš pravila
  ili AI po njoj, uvezeš natrag, a aplikacija ti prije upisa pokaže popis promjena
  staro→novo i traži izričitu potvrdu. Reklasifikacija povijesti radi točno isto kao sada,
  samo nad pravim podacima umjesto nad međufileom.

- **Onih 30 kolona u Reviewu je posljedica, ne uzrok.** Otprilike 13 od 30 kolona
  (`Tip_O`, `Podtip_O`, `Izvor reda`, `Labela iz`, `Problem`, `source_key`, `Izvod file`,
  `Pravilo run`, `Pouzdanost`, `AI run`, `Pouzdanost_AI`…) su radne kolone ovog pipelinea
  i **u exportu iz aplikacije uopće ne postoje**. Znači da je rad kroz Excel nakon importa
  lakši nego danas, bez ijedne nove tablice.

## Što je s dodatnom tablicom u Supabaseu (`staging_financije`)

- **Odluka od 2026-07-29: ne gradi se.** Bila je odlučena u S107m i nikad napisana
  (`sql/` staje na `032`). Njeno glavno opravdanje bilo je "treba nam mjesto za masovni
  pregled koje nije Excel" — a ako podaci ionako idu u aplikaciju, to mjesto je aplikacija.

- **Potreba koja ostaje — vidjeti samo dio kolona i masovno potvrđivati AI prijedloge —
  ostaje kao mogući feature aplikacije**, nad pravim eventima, i koristan je za svako
  područje, ne samo za Financije. Gradi se **tek ako** se rad kroz Excel nakon importa
  pokaže prespor. Do tada ne gradimo treće mjesto za podatke između Excela i baze.

## Redoslijed koraka

1. **Zamrzni razliku prema Kokinom file-u.** Uzmi svjež izvoz njenog `Financije 2026.xlsm`
   i dopiši u Review samo ono što je novije od 2026-07-08. To je oko 150 redaka. Za nove
   dane je siguran postupak, jer za dan koji u Reviewu još ne postoji ne može biti sudara
   ključeva — treba samo provjeriti da nije umetala retke u stare dane.
2. **Napiši generator import file-a.** Ovo je jedina prava rupa na putu: alat koji od
   odobrenog Reviewa radi Excel u formatu koji aplikacija uvozi (`Activities Events`).
   Struktura i taksonomija su gotove (65 parova), ostaje samo generator.
3. **Uvozi u batchevima, 2026. prva.** Prva godina služi kao proba mehanizma, ne kao
   strategija: provjeriš parent chain, atribute, prava pristupa i Stanje, pa tek onda
   ide 2025 → 2024 → 2023. Oko 5000 transakcija znači nekoliko desetaka tisuća zapisa
   atributa i to se ne gura odjednom — pogotovo nakon incidenta s opterećenjem baze (S105).
4. **Koka prelazi na unos u aplikaciji.** Od tog dana razlika više ne raste, njen Excel
   postaje samo arhiva, a lanac `.pre-*` backupa prestaje rasti.
5. **Povijest se dovršava kroz izvoz → pravila/AI → uvoz** s update-guardom, u svom tempu,
   bez pritiska.

## Što danas raditi s Kokom (Sonnet sesija)

- **Radi `niska` traku (1023 retka), ne `srednja` (205).** `srednja` možeš i sam kasnije.
  `niska` je hrpa gdje je model nesiguran i gdje je **njeno sjećanje jedini izvor** — a te
  su transakcije uglavnom iz 2023–2025, dakle upravo one kod kojih sjećanje trenutno curi.

- **Ne čekaj bankovne izvode za ono što ona pamti.** Izvodi uvijek kasne, ali to nije
  problem: alat za obogaćivanje piše isključivo u kolone `Izvod opis` i `Izvod file` i
  **fizički ne može pregaziti Tip ili Podtip**, a pravila diraju samo retke gdje je Tip
  prazan ili N/A. Ako Koka danas odluči, a izvod stigne u rujnu, izvod će samo dodati dokaz
  uz njenu odluku. Podjela je čista: **izvodi rješavaju staro, Koka rješava novo.**

- **Ako ima primjedbu na formulaciju bilo kojeg Tipa ili Podtipa — riješi to danas.**
  Sad je promjena imena jeftina. Nakon importa isto ime živi na dva mjesta — u definiciji
  izbornika i kao spremljena vrijednost na svakom pojedinom eventu — pa traži dva odvojena
  ciklusa izvoz-uvoz, a preimenovanja su povijesno mjesto gdje pukne (S105d).

- **Ako stigneš, iskoristi to što je prisutna za pripremu prelaska.** Area se uvozi **pod
  njenim računom** (odluka D6), pa je ovo prilika da napravi login, ručno doda jednu
  transakciju i kaže je li unos podnošljiv za 5–8 transakcija dnevno. Ta jedna informacija
  određuje je li cijeli plan izvediv, a doznaje se u pet minuta. **To je jedina stvar koja
  još može srušiti plan** — sve ostalo je posao koji znamo napraviti.

- **Rad na koloni `AI odluka` nije bačen.** `apply_ai --harvest` upisuje u `Tip`/`Podtip`
  Reviewa, a Review je ono što se uvozi. Što stigneš do importa ide unutra klasificirano,
  ostatak ide kao N/A i dovršava se poslije. Promijenilo se samo to da to više nije uvjet
  za početak.

## Tri pravila o mijenjanju podataka

- **Dodavanje redaka je uvijek sigurno**, i prije i poslije importa. Prije importa novi dan
  dobiva svoj ključ bez sudara; poslije importa redak bez `event_id` aplikacija tretira
  kao novi zapis.

- **Spajanje ili brisanje redaka — samo prije importa i samo kroz skriptu.** Ako se redak
  obriše iz Reviewa, alat za spajanje PBZ Vise bi ga sljedeći put vratio natrag, jer
  preskače samo one ključeve koje **vidi** u Reviewu. Zato obrisani ključ mora u registar
  `V3 preskočeno` — točno to radi `fix_duplikati_rata.py` i to je gotov uzorak za svako
  buduće spajanje. **Nakon importa se u Excelu više ne briše ništa:** uvoz zna samo
  stvoriti i ažurirati retke koje **vidi** u file-u, a redak koji si maknuo naprosto ne
  vidi — event tiho ostaje u bazi. Spajanje nakon importa radi se u aplikaciji.

- **Taksonomija se mijenja sada.** Prije importa: urediš `Taksonomija` sheet, pokreneš
  `sync_taxonomy.py` za izbornike i po potrebi `Preimenovanja` sheet koji preimenuje već
  klasificirane retke i pritom čuva visoku pouzdanost. Poslije importa je to dvostruko
  veći posao s realnim rizikom.

---

# DIO 2 — Tehnički dio (za Claudea)

## Odluka S107q (2026-07-29) — sažetak

Redoslijed **obrnut**: import → cutover → reklasifikacija, umjesto klasifikacija → import.
`staging_financije` **otkazana** (S107m odluka poništena). Identitet nakon importa =
`event_id`, čime `source_key` instabilnost prestaje biti blocker. Reklasifikacija ide kroz
D7 (`row_hash` + update-guard, već na PROD-u od 2026-07-15).

**Jedina otvorena ovisnost koja može srušiti plan:** ergonomija `Add Activity` za Kokin
dnevni tempo (5–8 tx/dan, atributi Racun/Smjer/Izvor/iznos/Tip/Podtip/Napomena). Mjeri se
tako da Koka doda jednu transakciju. `set_attribute` automatika + comment template +
shortcut prefill već režu dio unosa.

## Stanje podataka (izmjereno 2026-07-29)

| | |
| --- | --- |
| Review redaka | **4996** · raspon `event_date` 2022-12-01 → 2026-07-08 (+2 buduća) |
| Po godinama | 2022: 30 · 2023: 1135 · 2024: 1607 · 2025: 1474 · 2026: 750 |
| Po računu | Kokin ZABA 2774 · Sašin RF 2222 |
| N/A ukupno | **2059** — 2022: 30 · 2023: 680 · 2024: 718 · 2025: 564 · **2026: 60** |
| Preostalo po AI traci (Tip=N/A) | visoka 2 · **srednja 205** · **niska 1023** |
| AI prijedlozi | 1592 · visoka 261 / srednja 239 / niska 1092 · NEPOZNATO 196 |
| `AI odluka` | `(prazno)` 1586 · `?` 3 · `OK` 3 (namjerno, v. zamka 7) |
| Pravila / Taksonomija | 70 pravila · 65 parova |
| Kokin snapshot | `Financije 2026.xlsx` od **2026-07-08** → divergencija ~3 tjedna, ~150 tx (lipanj 147/mj) |
| `freeze_panes` | `F2` |

**Zadnji backup:** `Financije_review_20260710_1448.pre-aiapply-20260728_171029.xlsx`

## Kritični put — što treba napisati

| # | Stavka | Veličina | Bilješke |
| --- | --- | --- | --- |
| 1 | **Delta merge Kokinog `.xlsm`** | ~90 min | `normalize_financije.py` ima **hardkodiran** `INPUT = "Financije 2026.xlsx"` i uvijek generira **novi** timestampani Review — ne zna dopisati. Treba: parametar za input + filter `event_date >` cutoff + append po uzoru `merge_pbzvisa.py` (358 l.), uz čitanje `V3 preskočeno`. Za dane kojih nema u Reviewu `seq_per_day` ne može kolidirati; provjeriti hashom da nije umetala u stare dane. |
| 2 | **Import generator (korak 4)** | 1 sesija | **Ne postoji.** `make_import.py` i `make_financije3_import.py` su u `Obsolete/` = baza za reuse. Format: `data-prep_tools/Tools/excel_import_template.py` (LEGEND/EVENT DATA), spec `docs/EXCEL_FORMAT_ANALYSIS_v2.md`. Treba `--from/--to` za batch po razdoblju (§12.3). |
| 3 | **`Financije_all` struktura** | mala | Iz `Taksonomija` sheeta → Structure retci + `Automations` sheet (`Datum naplate` `set_attribute`). Novi atributi `Datum naplate`/`Datum kupovine` na `Transakcija`. |
| 4 | **Batch import + spot-check** | po batchu | 2026 prva kao proba. ~5000 eventa × ~10 atributa ≈ 50k `event_attributes` — ne u jednom naletu (S105 IO). Pod **Kokinim** accountom (D6). |

Zajednička ovisnost 1 i 2 = `normalize_financije` logika → raditi ih u istoj sesiji.

## Semantika mijenjanja redaka (provjereno u kodu 2026-07-29)

- **CREATE/UPDATE only.** `excelImport.ts` briše evente **isključivo** u `replace` grani
  kolizije sesije (linije ~756, ~778 — `chain_key`-specific delete, T-BUGG-5 fix). Redak
  odsutan iz file-a se **ne obrađuje** → event preživi u bazi. Import nikad ne briše zbog
  odsutnosti retka.
- **Prije importa:** brisanje retka u Reviewu lomi idempotenciju `merge_pbzvisa.py`
  (preskače `source_key`eve koji POSTOJE u Reviewu) → obrisani ključ mora u `V3 preskočeno`.
  Uzorak: `fix_duplikati_rata.py` (183 l.), registar čitaju `consolidate_review.py`,
  `merge_pbzvisa.py`, `fix_duplikati_rata.py`.
- **Izvod enrich je neutralan prema klasifikaciji:** `enrich_from_izvoda.py` piše samo
  `Izvod opis`/`Izvod file`; `apply_rules.py` dira samo retke s Tip prazan/N/A. Klasifikacija
  prije dolaska izvoda ne zaključava ništa.
- **Taksonomija poslije importa** = ime u `attribute_definitions.validation_rules` **i** u
  `event_attributes.value_text` svakog eventa + `depends_on` mapping za Podtip → Structure
  roundtrip + data roundtrip. Povijesni rizik: S105d BUG-SLUG-NORMALIZE. Zaključati prije importa.

## Otvoreno (nepromijenjeno)

1. `reconcile_izvoda.py` matcher po `Datum naplate` + iznos (jedina neizvršena S107n stavka; ne dira Review).
2. Agram / pravilo #43 — ožujak = C5 potvrđen (par 4505); ostaje pregled listopadskih pa `Iznos min/max` split.
   Kandidati za `auto C5`: redovi 1463, 3038–3041, 4499 (⚠ brojevi prije dedupa).
3. Petlja učenja: ispravci → `AI_KONTEKST_pitanja.txt` → bump `PROMPT_VER` → re-run `niska`+`srednja` (~$1).
4. T-S107n-3 (196 `NEPOZNATO`) i T-S107n-6 (red 4759 BIBERON / "Amsteradam").
5. Za Koku: 700 € bankomat 26.11.2025; `Saldo kontrola` 7 razlika (2026-01 +359, 2024-09 +149, 2×±49).
6. T-S107p-1/2 (vizualni pregled 347 harvestanih + 3 preskočena retka).

## Pravila okruženja

Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi
non-interactive; **cmd guši zarez u argumentima**); `PYTHONUTF8=1`; `ANTHROPIC_API_KEY` u
`.env.local`. Review mora biti **zatvoren** samo za pisanje.
**`--dry` prvo, pokazati brojke, čekati potvrdu prije upisa.**
**NIKAD ne pushati/mergati na `main` bez izričitog Sašinog zahtjeva.**

⚠ **`data-prep_data/` i `Claude-temp_R/` su gitignorirani = postoje SAMO na Sašinom disku, u
jednom primjerku.** Git čuva alate, ne podatke. Vanjska kopija Reviewa i dalje nije napravljena.

## Zamke (plaćene otkrićem — ne ponavljati)

1. **Pravilo ne popravlja postojeći redak** ako mu je par valjan u Taksonomiji —
   `apply_rules.py` ga preskače (~linija 516). Treba i jednokratni ispravak.
2. **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** — zato `V3 preskočeno` registar.
3. **AI provenijencija ne smije u `Pravilo run`** — `--eval` bi AI labele brojao kao `rucno`.
   Ide u `Labela iz` (`AI:visoka …`).
4. **`openpyxl`**: `insert_cols`/`insert_rows` ne pomiču `column_dimensions`, DV ni CF —
   širine/outline prenositi ručno, nove kolone umetati **desno** od `J`/`K`.
   `cell(r,c,None)` ne briše — mora `.value = None`.
5. Sve što nosi status mora biti **unutar autofiltera** (sad `A1:AD`) — inače se pri sortu raspari.
6. `BATCH` u `ai_classify.py` je 25, ne 40; guard poslano-vs-vraćeno se ne ignorira.
   `effort: low` zna vratiti 1/40 uz uredan `stop_reason`; structured-output `enum` nije obvezujuć.
7. **`OK` retci već-klasificiranih redaka ostaju trajno `OK`** nakon harvesta (harvest ih
   preskače i ne čisti ćeliju) — 3 poznata slučaja (861, 887, 3166), ne trebaju popravak.
8. **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day`) — bitno samo
   do importa; poslije njega identitet je `event_id`.
