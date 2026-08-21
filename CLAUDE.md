# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` (dev), `main` = PROD (Netlify deploya samo main)

> **Povijest po sesijama je u `docs/sessions/DONE_HISTORY.md`** (S1–S112).
> ⚠ **Preseljeno iz `Claude-temp_R/` u S111** (2026-08-18). Razlog: `Claude-temp_R/` je u
> `.gitignore` od 03.02.2026., pa je svaki praćeni session file bio **ručna iznimka** (`git add -f`)
> — i iznimke su se radile neujednačeno (S108 unutra, S107u–y i S110 vani, `DONE_HISTORY` nikad).
> Sada vrijedi kriterij bez iznimaka: **što ritual proizvede → `docs/sessions/`** (praćeno),
> **radni stol → `Claude-temp_R/`** (ignorirano u cijelosti, bez negacija i bez `-f`).
> Ovdje ostaje samo ono što mijenja buduće odluke. Zamke iz starih sesija su
> promaknute u „Critical rules" i „Zamke" — ne traži ih u povijesti.

---

## Strategic Position (2026-08-15)

**Misija:** Personal structured memory/decision system nad povijesnim podacima. Pretvoriti
nestrukturirani Excel (Financije, Zdravlje, Diary) u upitne, analizirane podatke. Kasnije:
AI sloj koji izvlači obrasce za odluke.

**Aplikacija je namjerno agnostična prema domeni.** Activities i Structure rade nad *oblikom*
modela (kategorije, atributi, eventi) i ne znaju semantiku. Analitika je prva stvar kojoj
semantika treba — zato ide kroz konfiguraciju, ne kroz kod (v. `docs/OVERVIEW_TAB_SPEC.md` §2.15).

**Collab:** dovršen za 1–2 osobe po Arei (S34–S41, S106). **Ne širi se dalje** dok povijesna
ingestija nije gotova. D9 (Excel User kolona — uvijek vs. samo za shared Aree) još neprovjeren.

**Supabase:** bez arhitektonskog zaokreta — optimizacija upita dostaje. `categoryCache` (S105)
je predložak. Lokalni Postgres je post-S110 ideja.

**Zašto je ingestija prioritet:** bez Financija/Zdravlja/Diaryja app je ljuska. Povijesni
podaci hrane i AI sloj.

---

## Key docs (read before touching related code)

| Doc                                        | When to read                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE_v1_6.md`               | Always — data model, P1/P2/P3, chain_key, session identity                       |
| `docs/OVERVIEW_TAB_SPEC.md`               | **Overview tab / analitika** — model pločice, RPC, sidro salda, gdje živi konfiguracija |
| `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` | **⚠ PROČITATI prije Faze 1** — dokaz modela salda nad 4.996 redaka, 3 zamke u mjerenju |
| `docs/STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md` | Structure tab work                                                               |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md`        | Excel export/import work (⚠ audit ga zove zastarjelim — provjeri prije oslanjanja) |
| `sql/SQL_schema_V5_commented.sql`         | DB schema reference                                                              |
| `docs/Code_Guidelines_React_v6.md`        | Code conventions                                                                 |
| `docs/COLLAB_PLAN_v2.md`                  | Collab implementation plan (v2) — faze 0–11, decisions                           |
| `docs/TEMPLATE_SYSTEM_SPEC.md`            | Template user sistem — starter Areas, Add Area „From template"                   |
| `docs/AUTOMATION_SPEC.md`                 | Post-Finish automatika — rata modal, comment template, `set_attribute`           |
| `docs/Analytics_tab.md`                   | **Cross-Area** analitika — `periods`, Series, AnalyticsDef Excel. Čeka drugu gustu Areu. ⚠ §3 („bucketiranje client-side") je opovrgnut u OVERVIEW_TAB_SPEC §2.2 |
| `docs/PLAYWRIGHT_E2E_GUIDE.md`            | E2E test setup i workflow                                                        |
| `docs/HELP_STRUCTURE.md`                  | Help sistem — chip map, context detection, Content Evolution Protocol            |
| `data-prep_tools/DATA_PIPELINE_PLAN.md`  | Migracija podataka — prioriteti, Dirty Excel workflow, PROD checklist            |
| `data-prep_tools/Financije/ENRICH_PLAN.md` | Financije pipeline — alati, koraci, nalazi po sesijama                          |
| `NEXT_SESSION_PROMPT.md`                  | **Na početku svake sesije** — handoff, DIO 1 netehnički / DIO 2 tehnički. Prepisuje se na kraju svake sesije (v. „End of session" 5). ⚠ Provjeri commit u zaglavlju: ako nije zadnji, čitaj ga kao povijest, ne kao stanje |
| `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13** | **Cutover plan** (⚠ gitignoriran — samo lokalno + `D:`)           |

---

## Three core principles — NEVER violate

**P1** — All category levels (not just leaf) can have attribute definitions.

**P2** — Leaf gets N events per session; every parent level gets exactly 1 event per session
(upsert, not insert). `chain_key = leafCategoryId` on all parent events.

**P3** — Last non-empty value wins. Empty never overwrites non-empty.
Applies in: Add Activity, Edit Activity, Excel Import.

---

## Critical rules

**Baza / upiti**

- **PostgREST `max-rows = 1000` reže BEZ GREŠKE.** Svaki `select` koji mora vratiti *sve* retke
  mora paginirati — `src/lib/supabasePaging.ts` (`fetchAllPaged`/`fetchAllPagedIn`).
  Truncation je tih; `event_attributes` na jednoj Arei lako prijeđe 20k.
- **⚠ Paginacija BEZ `.order()` je tiho pogrešna** (S108). Postgres ne jamči isti redoslijed
  između dva upita, pa se retci između stranica **preklope i istovremeno preskoče**. Rezultat
  izgleda uredno, samo mu fali dio redaka — **svaki put drugi**. Otkriveno kad je alat
  „našao" 45 eventa bez atributa u jednom runu i 49 drugih u sljedećem; nijedan nije postojao.
  Svaki `range()`/`Range:` upit mora imati `.order('id')` (ili drugi jedinstveni stupac).
  Kod brisanja je gore od krive brojke: preskočeni redak ⇒ parent DELETE padne na FK.
- **RLS-blokiran `DELETE` „uspije" s 0 redaka.** Uvijek `.select('id')` i provjeri je li
  rezultat prazan — inače brisanje izgleda kao da je prošlo.
- **Supabase SELECT mora biti jednoredni** — ugniježđeni multiline selecti tiho ignoriraju relacije
- **`session_start` mora biti zaokružen na minutu** (`setHours(h, m, 0, 0)`) — detekcija kolizije ovisi o tome
- **`session_start` format:** DB vraća `+00:00`, JS proizvodi `.000Z` — nikad ne koristi
  URL-dekodiranu vrijednost za Supabase upit; uvijek `events[0].session_start` (DB format)
- **`useActivities` grupira po `user_id_category_id_session_start`** ⇒ isti dan + ista kategorija
  = **jedan redak liste**. Za Areu s L1 leafom (Financije) to znači da svaka transakcija mora
  imati različit `session_start`.

**Model / atributi**

- **`chain_key`** je sistemsko polje (UUID), nikad se ne prikazuje; `comment` je samo korisnički tekst
- **`touched: true`** mora biti postavljen pri učitavanju atributa iz baze u Edit toku —
  inače ih `handleSave()` preskoči
- **`parentEventLoader.ts`** je jedini shared servis za parent event logiku — nikad duplicirati
- **Promjena sluga lomi reference.** `depends_on` (S105d), a od Faze 1 i `dashboard.widgets[]`.
  Fixup referenci mora ići uz svaki rename sluga.
- **`set_attribute` se evaluira SAMO u Add Activity** — ne u Edit ni u Import.

**Excel**

- **`Category_Path` format:** Activities Events kol. C = **bez area name**
  (`Domacinstvo > Automobili > Gorivo`); Structure sheet kol. D = **sa area name**.
  `ExportCategoryInfo.full_path` nikad ne uključuje area name; `StructureNode.fullPath` da.
- **`excelImport.ts` — 4 tihe rupe** (nijedna ne javlja grešku):
  (a) `session_start` mora biti **tekst** `"HH:MM"` — prava Excel time vrijednost daje puni ISO,
  `parseTimeStr` → `null`, fallback ⇒ **svi redovi dobiju 09:00**;
  (b) **krivo ime atributa se tiho preskoči** (`:836`, nema `else`);
  (c) `boolean` mora biti pravi bool — sve osim doslovnog stringa `'true'` sprema se kao
  **FALSE** (`:1214`, isto u update-guardu `:1336`). `'DA'` tiho postane FALSE; `'NE'` ispadne
  točno **slučajno**, pa greška ne upada u oči;
  (d) email u kol. G mora biti račun koji **izvodi** import, inače je redak „tuđi" i preskočen.
- **Data Validation limiti:** `promptTitle` ≤32 znaka, `prompt` ≤255 — premašivanje daje
  neispravan OOXML i Excel nudi repair. Provjeri `string.length` prije proširivanja teksta.
- **`datetime` atribut ima TRI oblika i svi moraju proći kroz `excelDatetime.ts`** (S112):
  baza vraća `2025-01-07T12:00:00+00:00`, aplikacija piše `2025-01-07T12:00`, Excel drži pravu
  datumsku ćeliju. Kao **stringovi** se razlikuju, kao **trenutak** ne. Dok je usporedba bila
  sirova, `computeRowDiff` je **svaki dodirnut redak** prijavljivao kao promjenu datuma i
  prepisivao ga. ⚠ Isti kanonski oblik mora ući i u **otisak retka** — inače se `row_hash`
  nikad ne poklopi i D7 skip nedirnutih redaka tiho prestane raditi.
  ⚠ Datumska ćelija se sidri u **podne UTC**: exceljs prevodi serial ↔ `Date` čistim UTC-om
  (`utils.dateToExcel`), a kod čita lokalnim getterima — podne ima 12 h margine u obje zone.
- **⚠ Zbroj u Excelu nije nula ni kad piše `0,00`** (S112). Razlika `banka − Σ SUMIFS` nosi
  grešku binarnog zapisa (~`1e-13`), pa je uvjetni format bojao **crveno nad savršeno usklađenim
  sheetom**. Svaka usporedba novca s nulom mora ići kroz `ROUND(…, 2)` — jedinicu u kojoj su i
  svi ulazi. Vrijedi za svaku buduću kontrolnu ćeliju, ne samo za ovu.
- **Izvještaj o uvozu nosi layout filea koji je uvezen** (S113). Profil se čita iz **tog**
  filea (`readProfileFromWorkbook`), ne iz `areas.settings` — izvještaj je nastavak radnog
  filea, pa mora otvoriti iste grupe skupljene i iste širine. ⚠ Profil se na atribute
  primjenjuje **pozicijski**, a izvještaj pokriva samo dodirnute kategorije ⇒ list može imati
  **manje** atributskih stupaca od profila. Bez granice petlja piše `hidden` preko `row_hash`,
  `Delete?` i `Result` — dakle sakrije baš ono što file čini ponovno uvozivim.
  `applyProfileToWorkbook` zato staje na prvom stupcu koji nije atribut.
- **Kolona izvan autofiltera se pri sortu raspari od retka.** Svaka nova kolona mora ući u
  `auto_filter.ref` (vrijedi i za app export i za Python alate).
- **`export_profiles` još ne preživljava Structure roundtrip** (ključ `attr:Area||CatPath||AttrName`
  ne preživi rename aree/atributa) — jedina preostala rupa u „sve ide importom".
- **„From template" kopira `areas.settings` OSIM `export_profiles`** (popravljeno S108).
  Izostavljen je namjerno: ključ `attr:Area||CatPath||AttrName` nosi **ime izvorne aree**, pa
  bi u drugačije nazvanoj Arei svaki ključ bio mrtav. Vraća se kad se format ključa popravi.
  ⚠ `balance_anchors` **nikad** ne putuju — config smije putovati, potvrđeno stanje ne (§2.17).

- **Nov tab = nov `CHIPS` unos, inače Help tiho nema chipova.** `pageHint` je ime taba;
  `HelpPanel.CHIPS` bez tog ključa ne javlja grešku nego ne prikaže ništa. Nova tema u
  `docs/help/` mora ići i u `HELP_DOC_NAMES` (`netlify/functions/help.ts`) — to je jedini
  razlog da se taj file dira; sadržaj postojeće teme ne traži promjenu koda.

**Delta sheet (usklađenje s bankom)**

- **Prozor NIJE sidro.** Sidro je potvrđeno izvana i može biti staro godinu i pol (RF:
  02.01.2025.), pa „od sidra do danas" daje **1.010 redaka** za usklađenje zadnjih par tjedana.
  Prozor je kratak (zadano 60 dana), a kontrolni stupac kreće od stanja koje **aplikacija
  računa** na dan prije prozora. ⚠ To otvarajuće stanje mora biti **označeno kao izračunato**
  i nositi sidro na kojem počiva: ako razlika ne padne na nulu ni nakon češljanja prozora,
  greška je **starija od prozora**, a bez te oznake se to ne vidi.
- **Prozor kreće DAN NAKON `confirmed_on`.** Saldo su promjene **strogo nakon** sidra (§2.17);
  redak datiran točno na dan sidra bi bio prikazan, ušao u kontrolnu formulu i razišao sheet
  s pločicom za taj iznos.
- **⚠ Planirani retci MORAJU ostati vidljivi.** Baza već drži buduće rate kao `Planiran`
  (13 komada na 11.07.2026.). Sakrije li ih sheet, korisnik ih dopiše iz bankovne aplikacije i
  **dobiješ ih dvaput**. Ovako ih potvrdi promjenom `Status`a, a kontrolni stupac ih istog
  trena uračuna — saldo se pomakne prije nego išta uđe u bazu.
- **⚠ NE dodjeljivati `session_start` automatski u importu.** Prazan pada na `09:00`, pa bi svi
  retci istog dana pali u jednu aktivnost — ali automatska dodjela slobodne minute ubija
  zaštitu koja već postoji: **kolizija je način na koji se hvata dvostruki uvoz istog filea.**
  Vremena zato piše generator, iz pojasa `14:00+n` (povijesni uvoz koristi `09:00+n`).
- **Redak predloška se preskače, započet pada.** Prazni retci nose prepisani `Area`, pa ih
  parser inače vidi kao prave retke. Kriterij za „netaknut" ne gleda prepisane atribute nego
  ono što upisuje čovjek: datum, opis ili **bilo koji broj**. Preskočeni se **broje** i javljaju
  kao upozorenje — tiho progutan iznos je gore od poruke.
- **Kontrolna formula je `SUMIFS` po datumu ≤ datum retka**, nikad „prethodni redak + uplata −
  isplata": lančana se raspadne na prvom sortu, a korisnik sortira čim doda stariji datum.
  I: **uvjeti se čitaju iz `dashboard` configa**, ne prepisuju u kod — stupac koji se ne slaže
  s pločicom, a izgleda uvjerljivo, gori je od nikakvog.
- **Export profil se primjenjuje PRIJE delta alata.** Profil dira kolone po položaju (širine,
  skrivanje, grupe), a kontrolni stupac se dodaje zadnji — obrnutim redoslijedom bi ga profil
  mogao sakriti.

**Mjerenje / usklađenje**

- **⚠ Neto Δ krije bruto.** U S111 je ostatak od `−130,25` bio **neto od 2.609,78 bruto** —
  dvadeset puta. Sastojao se od `+1.239,68` viška uplata i `−1.370,01` viška isplata koji su
  se skoro poništili. Pravilo: kad tražiš uzrok razlike, **zbroji apsolutne vrijednosti
  nesparenih redaka**, ne njihov neto — neto ti kaže koliko fali, bruto koliko je grešaka.
- **⚠ Mali zbirni Δ nije dokaz da nema grešaka — može biti dokaz da ih ima paran broj** (S110).
  Ostatak lanca salda bio je `−0,14` i izgledao kao potvrda ispravnosti; zapravo je
  nedostajućih `+200` poništavalo nepovezanih `−200,94` iz kasnijih mjeseci. Tek kad je jedna
  greška ispravljena, ostatak se pokazao. **Mjeri po razdoblju (Δ prometa), ne samo na kraju.**
- **⚠ Bankovni izvod se NE zatvara na kraju mjeseca** (S110). `ZABA_2024-12` ima zadnju
  transakciju `2025-01-01`, `ZABA_2025-12` ima `2025-12-24`. Ispisano stanje pripada **tom**
  datumu. Sidro datirano na kalendarski kraj mjeseca dvostruko broji preklop (pravilo je
  „promjene **strogo nakon**"). `confirmed_on` = *close date izvoda*, uvijek.
- **⚠ Sidro NA datum usporedbe čini provjeru tautološkom** (S110). `036` bira najnovije sidro
  `confirmed_on <= p_as_of` i zbraja promjene strogo nakon njega ⇒ `balance == amount`, Δ = 0
  po konstrukciji. **Prvo provjera, sidra poslije.** `make_saldo_anchors.py --report` to
  detektira i označi `SIDRO (nije provjera)` umjesto lažne kvačice.
- **⚠ Pomoćni broj uz saldo mora nositi ISTE uvjete kao saldo** (S112). `split` („planirano")
  je koristio samo `Status = Planiran`, bez `Izvor` uvjeta — pa je brojio kartične stavke **i**
  planiranu skupnu naplatu koja ih plaća: `−2.521,38 (13)` umjesto `−2.089,86 (2)`.
  Pločica koja kaže „stanje X, planirano Y" tvrdi da će Y pomaknuti X; bez istog filtra ne tvrdi.
  ⚠ Popravak lomi drill: `split.filters[0]` postaje **zajednički** uvjet. Drill mora birati
  uvjet koji bazni filtar **nema** — onaj koji split čini splitom.
- **⚠ `Datum naplate` na kartičnim retcima može biti kriv, a saldo to ne otkriva** (S112).
  12 MC kupovina (01–05.07.2026.) nosi `11.07.`, a banka ih je naplatila `11.08.` Košara
  „naplaćeno 11.07." ima 73 retka i `2.231,02`; banka je tog dana skinula `1.244,74`. Saldo je
  netaknut (kartične stavke nisu u njemu), ali svaka automatika „dospjelo → potvrdi" gleda
  krivi datum. Kontrola: **zbroj košare po datumu naplate mora dati iznos skupne naplate.**
- **Baza drži UTC, app prikazuje lokalno** (+2h ljeti). DB `07:00` = UI `09:00`. Bitno kad se
  traži slobodan `session_start` — kolizija se računa na razini minute.

**Prije svakog commita:** `npm run typecheck && npm run build` (⚠ `npm` se pokreće **iz
direktorija projekta**, inače ENOENT `package.json`; Browserslist poruka je upozorenje, ne greška)

---

## Zamke (data pipeline / AI / E2E)

**Python alati (`data-prep_tools/`)**

- **`run.bat` guši zarez u argumentima** — jedan substring po pozivu (`--reparse A,B,C` → samo A)
- **openpyxl `cell(r,c,None)` NE briše** — mora `.value = None`
- **Ime skripte ne smije biti ime stdlib modula** — `inspect.py` je srušio openpyxl
  (`partially initialized module`, jer `numpy` radi `import inspect`)
- **`apply_rules.py` preskače redak s VALJANIM parom** ⇒ pravilo ne može popraviti
  krivo-ali-valjano klasificiran redak. Zato postoje one-off skripte
  (`fix_vocarna_pravilo.py`, `fix_anja_rate.py`, `fix_keks_trener.py`).
- **⚠ Dedup po `(datum, iznos)` ne hvata skoro-duplikate** (S111). Kad dva izvora opisuju
  **isti** događaj različitim iznosom (Koka `1.265,59`, banka `1.285,59` — zamijenjena
  znamenka), ključ se razlikuje i **oba retka uđu**. Nađeno 9 takvih na jednom računu, razlike
  od `0,02` do `25,70` €. Otkriva se samo sparivanjem s **tolerancijom na iznos**, ne točnim
  poklapanjem. ⚠ Vrijedi i obrnuto: `ZABA 25.08.2025. „Anja 73/96"` ima uplatu 450,00 **i**
  isplatu 0,70 u istom eventu, i to **nije** greška nego vjeran spoj dvaju stvarnih redaka
  izvoda. Prije brisanja uvijek provjeri postoji li protustavka na izvodu.
- **Autoritet za iznos je izvod, za opis i klasifikaciju Kokin redak.** Njen lanac i bankov se
  razlikuju redak po redak a **slažu u zbroju** (oba daju `461,82` na 06.07.2026.) — višak na
  jednoj strani ima kompenzaciju na drugoj. Baza koja spoji oba izvora dobije **najgoru** od
  tri varijante: dvostruko brojanje ondje gdje se opisi razlikuju.
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u fileu)
  ⇒ ubačeni redak mijenja ključeve svih redaka tog dana iza njega
- **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** (preskače `source_key`eve koji POSTOJE
  u Reviewu) → registar `V3 preskočeno` mora se čitati
- **openpyxl čuva layout, ali gubi grafove/slike/pivote**
- **Udio po komadima ≠ udio po iznosu** — kod transfera je razlika 42 % vs 91 % i vodi u
  suprotan zaključak. Neto zbroj isključenih redaka može podcijeniti problem — **mjeri bruto.**
- **`.pre-*` backupi i generirani izlazi idu u `data-prep_data/Financije/_arhiva/`** —
  gore ostaju samo živi fajlovi i zadnja 3 backupa

**AI (`ai_classify.py`, Anthropic API)**

- **`effort: low` vratio 1 rezultat na 40 redaka** uz uredan `stop_reason: end_turn` ⇒
  guard koji uspoređuje poslano/vraćeno je obavezan
- **structured-output `enum` NIJE obvezujuć** (vraćao `Hrana I ostalo`) ⇒ normalizacija
- **Potpunost pada s efortom** — pri `--effort high` smanjiti `BATCH` (40 → 25)
- **Pali batch ne smije srušiti run** — `is_fatal()` (kredit/400/401/403 bez retryja),
  djelomičan rezultat se zadrži i dopuni s `--resume`
- **heredoc patch tiho promaši a `py_compile` prođe** ⇒ provjeri grepom, ne pretpostavkom

**UI (React)**

- **⚠ Uvjetno renderirana komponenta gubi lokalno stanje pri svakom skrivanju** (S111).
  `DateRangeFilter` je bio montiran samo uz `activeTab === 'activities'`; svaki prolaz kroz
  Overview ga je odmontirao, resetirao njegov `userModified` flag i pustio auto-init iz
  `useDateBounds` da **prepiše korisnikov raspon s „All time"**. Izgledalo je kao povremeni bug
  („često se resetira"), a bilo je deterministično. Filter panel je namjerno uvijek montiran
  (`hidden` klasa, ne uvjet) — isto vrijedi za sve što drži stanje.
- **Nedostajuće polje iz RPC-a ne smije se čitati kao „nema ničega".** Kad `038` nije pušten,
  `last_on` je `undefined` ⇒ `null` — isto kao „ništa poslije sidra". Zato uvjet u
  `BalanceByGroupTile` glasi `row.last_on || row.n === 0`: neistina je gora od izostanka.

**E2E (Playwright)**

- **Testovi koji dijele komentar + `session_start`:** ostatak prekinutog pokušaja ne daje grešku
  nego **koliziju** → Apply postane „All skipped" i izgleda kao pad featurea. Cleanup po prefiksu.
- **TEST baza ima više simuliranih usera** koji dijele imena/slugove (`Financije`, `Health`) —
  `financije-all` je jedini slug jedinstven pravom TEST accountu
- **`e2e/setup/seed.sql` je idempotentan** — ponovno pokretanje vraća seed evente koji su odlutali
- **Kvačica u Area panelu je lokalno stanje forme.** Stvarno stanje se provjerava kroz
  Add Activity ili novi export, ne kroz panel.

---

## Theme colours (src/lib/theme.ts)

| Context | Colour | Token |
|---------|--------|-------|
| View Activity | Indigo | `THEME.view` |
| Edit Activity | Amber | `THEME.edit` |
| Add Activity | Blue | `THEME.add` |
| Structure tab | Indigo/Purple | `THEME.structure` |
| Structure Edit panels | Amber | `THEME.structureEdit` |
| Overview tab | Teal | `THEME.overview` |

Preview all at `/app/debug` → Theme Preview tab.

---

## Key files

```
src/lib/parentEventLoader.ts       Shared: buildParentChainIds(), loadParentAttrs(),
                                   findParentEventByChain(), upsertParentEvent()
src/lib/categoryCache.ts           Module-level keš categories + area imena (TTL 5 min)
src/lib/supabasePaging.ts          fetchAllPaged / fetchAllPagedIn — obavezno za "sve retke"
src/lib/excelExport.ts             Activities Excel export, mergeSessionEvents(), Delete? kolona
src/lib/excelImport.ts             Activities Excel import, collision handling, applyDeletes()
src/lib/excelImportReport.ts       Izvještaj nakon uvoza — radni file, ne log
src/lib/excelFingerprint.ts        row_hash (FNV-1a 64) — skip nedirnutih redaka
src/lib/excelDatetime.ts           Kanonski oblik datum-atributa (baza ↔ app ↔ Excel ćelija)
src/lib/deltaSheet.ts              Delta sheet — prozor, kontrolni stupac, "u banci piše"
src/lib/structureExcel.ts          Structure export (Automations, Dashboard, DisableSavePlus)
src/lib/structureImport.ts         Structure import — non-destructive, slug lookup
src/lib/attributeRules.ts          set_attribute automatika (evaluateDateRule, same/next:N)
src/lib/deleteErrors.ts            classifyDeleteError() — čitljive poruke iz PG grešaka
src/lib/theme.ts                   Theme colour tokens
src/lib/overviewApi.ts             Overview read model — rpc_area_group_agg / _balance_anchored,
                                   CRUD sidara. Jedini `.rpc()` pozivi u aplikaciji.
src/lib/dashboardConfig.ts         Fixup slug referenci u dashboard configu (S105d razred)
src/lib/amountFormat.ts            formatAmount / parseAmountInput (hr 1.234,56)
src/hooks/useAreaDashboard.ts      Ima li Area `settings.dashboard` ⇒ postoji li Overview tab
src/hooks/useRunningBalance.ts     Izračunata kolona `Stanje` u Activities listi (§2.12)
src/components/overview/           OverviewTab + BalanceByGroupTile
src/pages/AppHome.tsx              Home: tabs, filter, export/import triggers
src/pages/AddActivityPage.tsx      Add flow — chain_key na parent INSERT, rata modal
src/pages/EditActivityPage.tsx     Edit flow — delta-shift, collision check, parent upsert
src/pages/ViewDetailsPage.tsx      Read-only view, Prev/Next
src/context/FilterContext.tsx      Global filter state (area, category, date range, sharedContext)
src/components/structure/          All Structure tab components
src/components/activity/           Activity form components, ExcelImportModal
src/hooks/useAttributeDefinitions.ts  Loads attr defs + parseValidationRules()
```

---

## Structure tab — component map

```
AppHome (Structure tab)
└── StructureTableView          Main table + Edit Mode toolbar
    ├── CategoryChainRow        One row per node (Area/Category)
    ├── CategoryDetailPanel     View panel (modal)
    ├── StructureNodeEditPanel  Edit panel — rename, attributes, suggest options
    ├── StructureDeleteModal    Delete — blocked (has events) or cascade (empty)
    ├── StructureAddChildPanel  Add Child — blocked if leaf has events (S24)
    ├── StructureAddAreaPanel   Add new top-level Area / From template
    └── StructureSunburstView   Plotly Sunburst chart
```

`areas-changed` CustomEvent: dispatched after any Area add/delete/structure save →
`ProgressiveCategorySelector` refetches Area dropdown, `categoryCache` se invalidira.

---

## Data model (simplified)

```
areas → categories (hierarchical, parent_category_id, level 1-10)
      → attribute_definitions → event_attributes (EAV values)

events (linked to category_id + user_id)
      → event_attributes (value_text / value_number / value_datetime / value_boolean)
      → event_attachments (images, links)
```

`validation_rules` (JSONB) na `attribute_definitions` pokreće sve dropdowne — nema zasebne tablice.

`areas.settings` (JSONB) nosi per-Area konfiguraciju: `comment_template`, `automations`
(`attribute_rules` + `rata`), `export_profiles`, `disable_save_plus`, `dashboard` (S108).
⚠ **Sidro salda NIJE tu** — `balance_anchors` je zasebna tablica jer config smije putovati
s Areom, a potvrđeno bankovno stanje ne smije (OVERVIEW_TAB_SPEC §2.17).
**Sve što je tu mora ići kroz Structure Excel roundtrip** (Sašin princip „sve ide importom").

---

## Što aplikacija zna raditi

- **Activities:** Add / Edit / View, Excel Import+Export s detekcijom kolizija, `row_hash` skip
  nedirnutih redaka + update-guard (D7), `Delete?` kolona + delete-guard, izvještaj nakon uvoza
  kao radni file, progress bar, attachments
- **Structure:** Table + Sunburst, Edit Mode (rename, atributi, suggest opcije, depends_on),
  Add Child / Add Area / From template, Delete s backupom i kaskadom, Excel roundtrip (17 kol.
  + `Automations` + `DisableSavePlus`), non-destructive import s conflict reportom
- **Collab:** share po Arei (read/write), Share Management modal, avatar + User kolona,
  permission-aware ⋮ meni, SharedAreaBanner, invite flow
- **Automatika:** Post-Finish rata modal, auto-comment template po leafu, `set_attribute`
  pravila (`Datum naplate` po Izvoru)
- **Shortcuts (S88):** `activity_presets` — snimka vrijednosti atributa (`default_attributes`,
  prioritet nad `attr.default_value`) + spremljeno filter stanje (`filter_state`)
- **AI Help:** Haiku FAB, 3 taba, dinamički load `docs/help/*.md` (8 tema, uklj. `overview`), context chips po `pageHint`
- **Template sustav:** template user, „From template" flow (nosi `settings` bez `export_profiles`), Demo Area na PROD
- **Overview (S108):** tab po Arei, postoji **samo** uz `settings.dashboard` (OQ-4). Pločica
  `balance_by_group` sa sidrom i `✓/Δ` čipom, drill u Activities, izračunata kolona `Stanje`.
  Agregacija ide u Postgres (`rpc_area_group_agg`, `rpc_area_balance_anchored`) — nikad u preglednik.

---

## Open bugs

- **BUG-1:** `useFilter must be used within a FilterProvider` (`AppHome.tsx:105`) — vjerojatno
  StrictMode artefakt, nizak rizik
- **BUG-S103-ANYATTR:** „In any attribute" filter (`ATTR_FILTER_ANY`) timeouta za grantee-e —
  `ILIKE` nije leakproof pa Postgres evaluira RLS EXISTS nad cijelom `event_attributes`.
  Privremeno: amber notice u UI. **Pravi fix = SECURITY DEFINER RPC — isti sloj kao Faza 1.**
- **E8-2 Area select timeout:** grantee-write test padne na `selectOption` (element disabled) —
  moguće isti family kao BUG-S103-ANYATTR
- **E7-2/E7-3:** Toast „Access granted" izostaje u invite flowu — UX polish
- **T-S107u-2** (bezopasno): `groupAttributes` uzima `Default` s **prvog** retka grupe ⇒
  `Status.default_value` se klacka `Izvrsen`↔`null`. Fix: ignorirati `Default` na retku s `DependsOn`.
- **Bulk delete (checkbox) nije ograničen za grantee-a**
- **„Import as mine" za write grantee unutar iste shared aree** nema smisla (pravi put je
  Leave Area ili re-import u novu vlastitu Areu) — flag, nije implementirano

---

## Financije migracija — trenutno stanje

**Cilj:** Kokina Excelica (`Financije 2026.xlsm`) → Area `Financije_all` u bazi, pa cutover.
Puni detalji: `ENRICH_PLAN.md`, `FINANCIJE_MIGRACIJA.md`, povijest u `DONE_HISTORY.md`.

**Podaci**

- **Review workbook:** `data-prep_data/Financije/Financije_review_20260710_1448.xlsx` —
  4.992 podatkovna retka, snapshot Kokinog filea od **2026-07-08**
- **Taksonomija:** Kokina (S107r) — **18 Tipova**, 65 parova. Živi u `Structure` sheetu od
  `Financije_all`; kopija u Reviewu je zastarjeli duplikat.
- **U TEST bazi:** batch 2026 (747) + batch 2025 (1473) = **2220 eventa**
- **Ostaje uvesti:** Kokina delta (od 2026-07-08, ~147 tx/mj), pa 2024, pa 2023

**Ključne odluke**

- **D1b:** `event_date` = dan kupovine uvijek; `Datum naplate` = dan kad banka skine
  (Racun/Cash = isti dan, MC = 11. u M+1, Visa = 3.). `Datum kupovine` **povučen** (bio bi
  jednak `event_date`-u na svakom retku).
- **D6:** import ide pod **Kokinim** accountom (ona je vlasnik Aree)
- **D7:** `row_hash` + update-guard — mehanizam reklasifikacije, **već na PROD-u** (2026-07-15)
- **Redoslijed (S107q):** `import → cutover → reklasifikacija`, ne obrnuto. Unos u appu ima
  obavezan Tip/Podtip dropdown ⇒ klasificira osoba koja zna transakciju, isti dan.
  **`N/A` je legitimna vrijednost i ne blokira import.**
- **Rate:** sve rate jedne kupovine dijele `event_date` = dan kupnje; razlikuje ih
  `Datum naplate` + pomak `session_start` za +1 min. `Rata br` 1..N, `Status=Planiran`.
- **Politika izvora:** izvodi rješavaju staro, Koka novo — ne sudaraju se.
  `enrich_from_izvoda.py` ne može dirnuti Tip/Podtip; `apply_rules.py` samo prazan/`N/A` Tip.
- **Taksonomiju zaključati PRIJE importa** — poslije ime živi i u `validation_rules` i u
  `value_text` svakog eventa (rizik S105d).

**Pravila mijenjanja redaka:** dodavanje je uvijek sigurno; **spajanje/brisanje samo prije
importa i kroz skriptu** (`excelImport.ts` briše samo u `replace` grani kolizije — redak
odsutan iz filea se ne obrađuje, pa event tiho preživi).

**Otvoreno:** red 2115 (LJEKARNA OREBIC) → Medical_Sasa treba postati Medical_Koka;
N/A petlja (`suggest_candidates.py`) za 2024/2023; preostali kandidati za pravila
(`paypal`, `spotify`, porez grupa, `leasing`, `bmove`, `keks pay`, `zagrebparking`).

---

## Sljedeći koraci (2026-08-19)

**✅ OBA LANCA SALDA SU ZATVORENA** (S110/S111). App reproducira **ispisana bankovna stanja u cent**:
ZABA `2.546,55` @ 31.03.2025. i `3.403,74` @ 08.07.2026. · RF `461,82` @ 06.07.2026.
(`RF_2026-06.pdf`). Time je zatvoren i `T-S107d-6` — RF OCR lanac je bio točan, greške su bile
u **spajanju** Kokinog Excela s izvodima.

**Kokina delta se radi u TRANŠAMA, kroz alat koji će poslije koristiti Koka** (Sašina odluka
S112: *„nije cilj samo uvesti deltu nego razviti najefikasniji način da je Koka rješava"*).
Faza 0 i Faza 1 su gotove; ostalo je izvođenje.

**Odluke koje više nisu otvorene:**
- **D-1: preskočiti** Kokine kartične retke iz razdoblja koje izvodi već pokrivaju
  (207 od 208 Visa kupovina 01–06/2026 već postoji u bazi — donose opis, ne novac).
- **D-2: „Koka sada, izvod potvrda"** — njeni retci ulaze, izvod odmah zatim provjerava.
  ⚠ Provjera mora biti **mehanička** (sparivanje s tolerancijom + potvrda razlike): njeni se
  iznosi razlikuju od bankinih na ~4 % redaka, a kartične stavke ne diraju saldo, pa takva
  greška **nikad ne ispliva sama**.
- **Granica je datum, ne vrsta retka.** Prije datuma piše pipeline, poslije samo ona.

### Tranše — svaka testira drugi mehanizam, svaka ima brojku iz Kokinog lanca

| # | Sadržaj | Kontrolni broj |
| --- | --- | --- |
| **1** | RF banka: 7 novih redaka + ispravak `250,93 → 253,51` | **RF @ 04.08. = 1.716,55** |
| **2** | RF Visa iz `PBZVIZA_2026-07`: 42 stavke + naplata `1.171,59` + `0,17` | **RF @ 11.08. = 799,12** |
| **3** | ZABA banka: 110 novih + potvrda planirane naplate `1.244,74` + `845,12` i 5 spornih | **ZABA @ 09.08. = 14.722,84** |
| **4** | MC iz `MC_2026-07`: 45 stavki (12 ih baza već ima) + naplata `1.332,52` | **ZABA @ 13.08. = 13.239,31** |

⚠ **Skupne naplate se NE sintetiziraju** — `MC_2026-07.pdf` sadrži `1.332,52`, a
`PBZVIZA_2026-07.pdf` `1.171,59`, oboje u cent jednako Kokinim grupama. Banka ih je ispisala.

⚠ **Onih 5 spornih redaka** (16–17.06.2026., Σ `373,11`): `207,26`, `57,19` i `13,31` **nisu na
`ZABA_2026-06.pdf`** — najvjerojatnije kolovoški računi s krivim mjesecom. Uvezeni s lipanjskim
datumom padaju **prije ZABA sidra** (01.07.) i po pravilu „strogo nakon" tiho ispadaju iz salda.
Tranša 4 ih rješava: ostane li `13.239,31` bili su duplikati, postane li `12.866,20` bili su stvarni.

### Nakon tranši

1. **Faza 3 — automatika na Import putu** („popuni ako je prazno"). Jedna rupa drži **tri**
   featurea: `Datum naplate` na uvozu, pravila `Tip/Podtip`, širenje rata. `set_attribute` se
   danas evaluira samo u Add Activity.
2. **Faza 2 — brzi unos** (§2.9): prefilana polja se ne skupljaju
   (`AttributeChainForm.tsx:216–222`), shortcut dropdown je ravan popis
   (`ProgressiveCategorySelector.tsx:711`). Male, i **direktno za Koku**.
3. **Tip/Podtip automatika** — shortcutovi po trgovcu **prvo** (nula koda, `activity_presets`),
   tekstualno pravilo `opis → Tip/Podtip` tek ako popis postane nezgrapan, AI tek nakon toga.
4. **Koka proba na TEST-u (mobitel) → odluka o cutoveru.** ⚠ Prije toga Saša **odglumi Koku
   3 dana stvarnog unosa** i izmjeri frikciju — to pretvara „bi li bila zadovoljna" u brojku.
5. **Batch 2024, pa 2023** — svaki uz `Pitanja za Koku` vetting. ⚠ Sidro ih **vadi s kritičnog
   puta**; idu zbog analize i AI sloja, ne zbog salda.
6. Ručni testovi: **T-S112-3…6** (novi), T-S111-1/-3/-4/-5/-6, T-S110-4/-5, T-S107b-3..6,
   T-S107f-3, T-S107v-2/3/4/7
7. Stare Financije aree obrisati **na kraju** (backup!)
8. Diary archaeology (non-blocking)

**Preostali poznati Δ, oba svjesno ostavljena:**
`−200,14` na ZABA lancu 2025-08 → 2026-04 (`SALDO_MODEL_NALAZI.md` §6.3) · RF nema više ništa.

## Overview tab / analitika — sažetak odluka

Puni spec: **`docs/OVERVIEW_TAB_SPEC.md`**. Ovdje samo ono što se ne smije zaboraviti:

- **Saldo miče `Izvor`, NE `Racun`.** Bankovni saldo miče **samo `Izvor = Racun`**;
  `Visa`/`Mastercard`/`Cash` su **potovi** koji se s bankom poravnaju jednim zasebnim retkom.
  Naivni zbroj po `Racun`u dvostruko broji (dokazano: 17/30 mjeseci u cent vs **0/30**).
- **⚠ `Cash` je IZBAČEN iz filtra salda (S111).** Podizanje gotovine već postoji kao
  `Transfer | cash - bankomat` s `Izvor = Racun` i **već je oduzeto od računa**; gotovinski
  trošak (`Izvor = Cash`) isti novac broji drugi put. Nije se vidjelo 18 mjeseci jer u cijeloj
  Arei postoji **jedan jedini** takav redak (66,00 „Promjena guma", 20.05.2026.) uz **46
  podizanja**. Staro pravilo `∈ {Racun, Cash}` **ostaje istinito za ZABA-u** (ondje nema
  nijednog `Cash` retka) ⇒ provjera 17/30 nije ugrožena. Odbačena alternativa: `Gotovina`
  kao pravi račun s vlastitim saldom — traži drugi redak uz svako podizanje i disciplinu
  bilježenja svakog gotovinskog troška; preskupo za 1 redak na 2.220 (Sašina odluka).
- **Zrcalno pravilo, dvije osi:** `Transfer` **ulazi u saldo, izlazi iz razreza** po Tipu;
  gotovinski trošak **izlazi iz salda, ulazi u razrez**. Isti princip — svaki euro točno
  jednom u svakom pogledu. Isto vrijedi za gotovinu dobivenu izvana (`Izvor = Cash`,
  `Tip = Prihodi`): banka je nije vidjela, razrez jest.
- **Saldo se računa od sidra, ne od početka povijesti:**
  `saldo = potvrđeno_stanje + Σ(promjene STROGO nakon datuma potvrde)`.
  Sidro upisuje **čovjek gledajući bankovnu aplikaciju** — najkvalitetniji podatak u sustavu.
  ⚠ Sidro nosi vlastiti rizik dvostrukog brojanja: retci prije datuma potvrde **ne smiju** ući.
- **⚠ POTVRĐENO STANJE MORA DOĆI IZVANA** (S109) — s ekrana bankovne aplikacije ili kao
  **ispisani** saldo s izvoda. **Nikad izračunato iz zapisa u bazi.** Prekršaj se **ne vidi**:
  Δ postane trajno nula, sve izgleda savršeno, a usklađenje je mrtvo bez ijedne greške.
  Isti razred kao odbačeni automat `Planiran → Izvršen`. Vrijedi i za budući automat iz izvoda.
- **⚠ `asOf` se steže na danas — ali samo za saldo** (S111). „All time" razrješava `dateTo` na
  najnoviji event u Arei, a s budućim ratama to je `2027`. Nestegnuto: zaglavlje tvrdi očitanje
  u budućnosti, razmak svježine se broji protiv nepostojećeg dana, i — najgore — gumb nudi
  **„Potvrdi na <budući datum>"**, čime bi sidro po pravilu „strogo nakon" **presjeklo sve
  retke do tada**. `split` („planirano") dobiva **sirovi** `asOf`, jer je rata u 2027. upravo
  ono što taj broj broji. Dvije upite, dva pravila.
- **Sidro unatrag je provjera, sidro na danas je pokrivač** (S109). Datirano na početak
  uvezene povijesti, sidro mjeri **reproducira li app tuđi lanac**; datirano na danas samo
  skriva rupu. `confirmed_on` je obična `date` — baza to već podržava, UI još ne.
- **Sidro NE ide u `areas.settings`** — config putuje s Areom (template, Structure export),
  a saldo ne smije putovati. ⚠ Taj argument **ne pokriva** ideju „sidro kao obična kategorija
  s eventima" (`Financije_all > Stanja`) — eventi ne putuju Structure exportom.
  **✅ ZATVORENO (§2.18, 2026-08-17): sidra OSTAJU u zasebnoj tablici.** Odlučujući argument
  nije o saldu nego o **vrsti zapisa** — event je popravljiv, brisiv, P3, putuje Excelom;
  očitanje se samo dopisuje i nikad ne putuje. Selidba bi bila stapanje dviju disciplina
  u onu labaviju. Ostaje neizvedeno: generički rječnik (`balance_anchors` → `confirmed_readings`,
  `amount` → `value`) + tekst pločice iz configa. Besplatno je dok je tablica samo na TEST-u.
- **`Status` je trenutno stanje, ne povijest.** App ne pamti kad je nešto prešlo iz `Planiran`
  u `Izvrsen` ⇒ „što je bilo planirano na dan X" nije pitanje na koje se može pošteno
  odgovoriti — samo „od datiranog do X, što je **i danas** još planirano".
- **Tri sloja konfiguracije:** rječnik pločica **u kodu** · semantika jedne Aree u
  `areas.settings.dashboard` (slug-based, ide u roundtrip) · cross-Area u zasebnoj tablici.
- **Test generičnosti:** *nova Area smije tražiti nula linija koda, samo konfiguraciju.*
  Pločice su parametrizirane po **ulogama** (`group`/`plus`/`minus`/`filter`/`bucket`), ne po domeni.
- **Preset ≠ widget:** preset je per-user i **ID-based** (nikad ne putuje); widget je per-Area
  i **slug-based** (mora preživjeti Excel u tuđu bazu). Susreću se u `FilterContext` na runtimeu
  ⇒ drill s pločice daje filter stanje koje „Save as Shortcut" već zna spremiti.
- **RPC pravila:** `SECURITY DEFINER` mora **sam** provjeriti pristup (inače leak preko cijele
  baze) · **P2 parent eventi se nikad ne zbrajaju** · čita se `value_number`, filtar po
  `attribute_definition_id`, nikad `ILIKE` preko `event_attributes`.
- **Automat `Planiran → Izvršen` po dospijeću je ODBAČEN** — dospjeli datum nije dokaz da je
  banka naplatila, pa bi automat sam proizveo razliku prema banci. Umjesto toga „Dospjelo → potvrdi".
- **Transfer:** **ulazi** u saldo (novac je stvarno otišao), **izlazi** iz razreza po Tipu.
  Isti redak, dva pravila — namjerno, ne nedosljednost.

---

## S112+: Intelligence layer

Sjeda **na** Overview, ne umjesto njega. Success criteria se definiraju kad Faza 3 prođe.
(Broj pomican četiri puta — S108, S109, S110, S111 su zauzeli mjesto.)

---

## Backlog

**Roundtrip completeness** — `export_profiles` (ključ `attr:Area||CatPath||AttrName` ne preživi
rename; fix = `ExportProfiles` sheet, isti obrazac kao `Automations`) **i `dashboard`**
(fix = `Dashboard` sheet, Faza 4). „From template" je riješen u S108.

**Sidra se ne mogu vidjeti ni obrisati iz aplikacije** (S109) — `listAnchors()` i
`deleteAnchor()` postoje u `overviewApi.ts` i **nitko ih ne zove**; jedini put je SQL Editor.
⚠ Blokada je **otpala** (§2.18 — sidra ostaju zasebna tablica), pa se ovo sada smije graditi.
Postalo je i konkretnije: u S111 je jedno sidro upisano s tipfelericom (3.453,03 umjesto
3.458,03) i **ispravlja se samo novim retkom** — bez popisa u UI-ju korisnik ne vidi da uz
važeće sidro stoji i ono krivo.

**Sidro upisano kroz UI nema podrijetlo** (S110) — `balance_anchors.note` postoji, skripta ga
puni („ispisano NOVO STANJE, `ZABA_2024-12.pdf`"), a `saveAnchor()` iz pločice ga ostavlja
`NULL`. Smeta baš zbog pravila oko kojeg je mehanizam građen — **stanje smije doći samo
izvana** (§2.17) — jer se poslije iz baze ne vidi je li broj s izvoda, s ekrana banke ili
izračunat. Fix: malo polje „odakle" uz „u banci", ili barem automatski `note`.
⚠ Više se **ne odgađa** (§2.18 zatvorio `Stanja`). Rješenje je sada malo polje „odakle" uz
„u banci" — istu ulogu koju je trebao imati atribut `Izvor podatka`, bez selidbe u evente.

**`Datum naplate` ne prati promjenu datuma u Editu** (S110) — delta-shift
(`EditActivityPage.handleDateTimeChange`) pomiče samo *vremena eventa*, ne i datumske atribute.
Oba popravka u S110 tražila su ručnu izmjenu. D1b kaže `Izvor ∈ {Racun, Cash}` ⇒ `Datum naplate`
= `event_date` (ovdje `Cash` **ostaje** — D1b je o datumu naplate, ne o saldu; v. S111),
pa bi se za te retke moglo pomicati automatski. ⚠ Za kartice **ne smije** —
tamo je datum naplate vezan uz ciklus banke, ne uz dan kupovine.

**Drill s dva uvjeta** — `FilterContext` nosi jedan `attrFilter`, a uvjet pločice ima dva
(`Izvor` + `Status`), pa drill znači „pokaži mi ovaj račun", ne „točno ove retke".
Predviđeno u OVERVIEW_TAB_SPEC §2.16 kao test; ispalo da filtru fali mogućnost.

**BUG-S103-ANYATTR pravi fix** — SECURITY DEFINER RPC; ista investicija kao Faza 1.

**FilterContext koraci 2+3** (Fable I.4) — tipizirani event bus (`appEvents.ts`),
eventualno split FilterProvider/SharingProvider.

**Potpuni attrFilter za number/boolean/datetime** — proslijediti `data_type` u `AttrFilterParam`,
koristiti `value_number`/`value_boolean`/`value_datetime` s odgovarajućim operatorima.

**Structure Edit UX cleanup** (`StructureNodeEditPanel.tsx`, bez DB promjena):
collapsible attribute kartice (persist u localStorage) · `suggest` direktno u „New attribute"
formi · lakše dodavanje opcija u depends_on mapping · help docs update.

**⭐ Help „What can I do here?" chip** — standing chip po `pageHint` kontekstu; zahtijeva
sekciju „Feature inventory" u `docs/help/*.md`, **dosta detaljno** (korisnikov izričit zahtjev).

**Stanje post-processing** — **otpada** (potvrđeno S109). `make_financije_import.py` prestaje
pisati atribut `Stanje` na Transakciju; vrijednost seli u zasebnu kategoriju `Stanja`.
⚠ **Postojećih 2220 zapisa se NE dira** — Kokin per-redak lanac je jedini **neovisni svjedok**
protiv kojeg se app-ov izračun može provjeriti. Prestani pisati, nemoj brisati.

**Netlify scheduled maintenance** — kad se skupi 2–3 zadatka: `netlify/functions/maintenance.ts`
sa `schedule = "@weekly"` (orphaned share_invites, stari accepted invites, stari help_log).

**Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi.
**Historijska migracija** `trening.xlsm` — bez vremenskog pritiska.
**Health `health_lab_review.py` cleanup** — razdvajanje Medical Visit bilješki iz Lab Results komentara.
**Plotly bundle** ~4.9MB — prihvatljivo dok performanse nisu problem.
**Split-workbook** (Pravila + Neklasificirano u zaseban file nad app exportom) — kad Saša poželi.

---

## TypeScript known issue

`TS2688: Cannot find type definition file for 'vite/client'` — pre-existing, harmless,
does not block build. Ignore it.

---

## Session workflow (VSCode / Claude Code)

### Start of session
1. Claude reads this file automatically
2. `git log --oneline -10` for recent context
3. Read `NEXT_SESSION_PROMPT.md` — usporedi commit iz njegovog zaglavlja sa `git log`om;
   ako je stariji, tretiraj ga kao povijest (CLAUDE.md je autoritet)
4. Read `docs/sessions/PENDING_TESTS.md` — check if user confirmed previous tests

### During session
- Screenshots: paste directly into chat
- Before committing: `npm run typecheck && npm run build`

### E2E testing workflow (Playwright)
- `npx playwright test e2e/tests/<spec>.ts --headed` ili `npx playwright test --ui`.
  Dev server ne treba zasebni terminal (`reuseExistingServer: true`).
- Kad test padne: reci „pao E2-X" — Claude čita artefakte iz `e2e/test-results/`
  (screenshot, video, trace). Bez copy-paste.
- **Bug pronađen E2E testom = dokumentira se kao manualni bug** (Done sekcija uz sesijsku
  oznaku; ako fix nije odmah — u „Open bugs").
- **Selektor problem** (test pada, app radi ispravno) → fix samo u spec fajlu, ne u app kodu;
  ne dokumentira se kao bug.

### End of session (OBAVEZNO)
1. **`docs/sessions/PENDING_TESTS.md`** — dodaj testove za sve novo; potvrđene označi ✅
2. **`docs/sessions/tests/SXX_tests.md`** — detaljni koraci za SVAKI novi test
   (preduvjeti, numerirani koraci, očekivano vs. pad). Ažuriraj `Detalji testova:` link.
3. **Arhiviranje (inače se ne dogodi):**
   - session file čiji su **svi** testovi ✅ → `Claude-temp_R/test-sessions/archive/`
     (⚠ arhiviranje **izlazi iz gita** — arhiviran test je zatvoren, pa seli na radni stol)
     (⚠ **ne po starosti** — otvoreni testovi sežu unatrag više sesija)
   - `.pre-*` backupi stariji od zadnja 3 → `data-prep_data/Financije/_arhiva/backup/`
   - generirani izlazi (import/structure/export xlsx) → `_arhiva/izlazi/`
4. **`CLAUDE.md`** — nova zamka ide u „Critical rules"/„Zamke". **Ne dopisuj sesijski
   narativ ovdje** — on ide u `DONE_HISTORY.md` (korak 5).
5. **`docs/sessions/DONE_HISTORY.md`** — kronologija sesije. Vlastiti korak, ne podrečenica
   uz CLAUDE.md: kao podrečenica je preskočen za S107y i S107z. Ažuriraj i raspon sesija
   u zaglavlju CLAUDE.md-a (`> Povijest po sesijama…`) da se zaostajanje vidi odmah.
6. **`NEXT_SESSION_PROMPT.md` — prepiši ga, uvijek, bez da Saša traži.** Ako izostane, sljedeća
   sesija dobije handoff **pretprošle** sesije i otvara pitanja koja su već odgovorena. Pravila:
   - **prepiši cijeli file, ne dopisuj** — stari sadržaj je već u `DONE_HISTORY.md`
   - **prvi redak nosi commit protiv kojeg je pisan** ⇒ zastarjelost se vidi jednim `git log`om
   - **DIO 1 netehnički** (za Sašu: što je gotovo, što slijedi, što treba od njega/Koke),
     **DIO 2 tehnički** (za Claudea: stanje grana, novi alati, otvoreno)
   - ne prepisuj ono što CLAUDE.md već ima — handoff nosi **stanje u letu**
     (što čeka Sašinu akciju, što je neverificirano), CLAUDE.md nosi **trajna pravila**
   - ⚠ ako je paralelna sesija radila na istoj temi, njen rezultat ide ovdje označen kao
     **neverificiran** dok ga netko ne potvrdi — ne kao činjenica
7. **Memory** (`~/.claude/projects/c--0-Sasa-events-tracker-react/memory/`) — **jedini artefakt
   koji se učitava u kontekst PRIJE CLAUDE.md-a**, pa zastarjeli unos ne izgleda kao povijest
   nego kao činjenica o sadašnjosti. Zato:
   - **`MEMORY.md` mora odgovarati fajlovima na disku** — fajl bez retka u indeksu se nikad ne
     dozove (tako je `no_main_push.md` 39 dana bio nevidljiv)
   - **ne dupliciraj CLAUDE.md** — memorija nosi samo ono što se ne vidi iz repoa:
     tko je Saša, kako radi, što je izričito tražio, otvorena pitanja o PROD okolini
   - unos koji je CLAUDE.md preuzeo → `memory/_archive/` (ne brisati — nije u gitu)
   - status sesije („S103 je gotov", „SLJEDEĆE: …") **nikad** ne ide u memoriju — to je posao
     `DONE_HISTORY.md` i `NEXT_SESSION_PROMPT.md`
8. **`docs/help/`** — ako je feature dodan ili promijenjen. `netlify/functions/help.ts` se
   **ne mijenja** za feature docove (AI čita markdown dinamički); iznimke: Demo Area putanje,
   pravila tona, app framing.
9. **`ENRICH_PLAN.md`** — **samo ako je sesija dirala data-prep.** Nalazi/prolazi po sesijama.
   (Zadnji upisan prolaz je S107r/30.7. — S107v–y nedostaju.)
10. **Commit + push `test-branch`** (nema Netlify deploya, nema troška):
   `git push origin test-branch`
11. **Samo kad korisnik IZRIČITO zatraži PROD deploy** — Netlify build troši kredite,
   NIKAD ne pushati/mergati na main samoinicijativno:
   ```
   git checkout main && git merge test-branch --no-edit && git push origin main
   git checkout test-branch && git merge main --no-edit && git push origin test-branch
   ```
   Bez sync-backa `test-branch` zaostaje za `main`.

### Test result reporting (next session)
Korisnik kaže npr. „T-S24-1 OK, T-S24-3 fail" → Claude ažurira PENDING_TESTS.md i istražuje
padove prije novog koda. Za E2E: „pao E2-2" → Claude čita `e2e/test-results/` artefakte.
