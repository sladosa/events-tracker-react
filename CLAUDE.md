# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**PROD:** <https://events-tracker-react.netlify.app> (Netlify deploya **samo** `main`)
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` (dev), `main` = PROD (Netlify deploya samo main)

> **Povijest po sesijama je u `docs/sessions/DONE_HISTORY.md`** (S1–S140).
> ⚠ **Preseljeno iz `Claude-temp_R/` u S111** (2026-08-18). Razlog: `Claude-temp_R/` je u
> `.gitignore` od 03.02.2026., pa je svaki praćeni session file bio **ručna iznimka** (`git add -f`)
> — i iznimke su se radile neujednačeno (S108 unutra, S107u–y i S110 vani, `DONE_HISTORY` nikad).
> Sada vrijedi kriterij bez iznimaka: **što ritual proizvede → `docs/sessions/`** (praćeno),
> **radni stol → `Claude-temp_R/`** (ignorirano u cijelosti, bez negacija i bez `-f`).
> Ovdje ostaje samo ono što mijenja buduće odluke. Zamke iz starih sesija su
> promaknute u „Critical rules" i „Zamke" — ne traži ih u povijesti.

<!-- INDEX:BEGIN -->

## Sadrzaj

> Generirano: `python data-prep_tools/Tools/claude_index.py --write`.
> **X** = stit od regresije, svaki redak placen izmjerenim kvarom -- ne skracivati.
> **~** = kvarljivo (stanje/plan) -- prije nego vjerujes, provjeri datum u naslovu.

| r. | sekcija | |
| ---: | --- | :---: |
| 55 | [Strategic Position (2026-08-15)](<#Strategic Position (2026-08-15)>) |  |
| 77 | [Key docs (read before touching related code)](<#Key docs (read before touching related code)>) |  |
| 108 | [Three core principles — NEVER violate](<#Three core principles — NEVER violate>) | X |
| 121 | [Critical rules](<#Critical rules>) | X |
| 1043 | [Zamke (data pipeline / AI / E2E)](<#Zamke (data pipeline / AI / E2E)>) | X |
| 1640 | [Theme colours (src/lib/theme.ts)](<#Theme colours (src/lib/theme.ts)>) |  |
| 1656 | [Key files](<#Key files>) |  |
| 1776 | [Structure tab — component map](<#Structure tab — component map>) |  |
| 1796 | [Data model (simplified)](<#Data model (simplified)>) |  |
| 1818 | [Što aplikacija zna raditi](<#Što aplikacija zna raditi>) |  |
| 1844 | [Izmjereno i **nije** problem — ne trošiti vrijeme ponovno](<#Izmjereno i nije problem — ne trošiti vrijeme ponovno>) | X |
| 1884 | [Open bugs](<#Open bugs>) | ~ |
| 1981 | [Financije — pravila domene (izvodi, rječnik, 1-N)](<#Financije — pravila domene (izvodi, rječnik, 1-N)>) |  |
| 2174 | [Overview tab / analitika — sažetak odluka](<#Overview tab / analitika — sažetak odluka>) |  |
| 2271 | [S112+ Intelligence layer](<#S112+ Intelligence layer>) | ~ |
| 2279 | [Backlog](<#Backlog>) | ~ |
| 2638 | [TypeScript known issue](<#TypeScript known issue>) |  |
| 2646 | [Session workflow (VSCode / Claude Code)](<#Session workflow (VSCode / Claude Code)>) |  |

_Ukupno 2781 redaka, 18 sekcija._

<!-- INDEX:END -->

---

## Strategic Position (2026-08-15)
[↑ Sadrzaj](#Sadrzaj)

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
[↑ Sadrzaj](#Sadrzaj)

| Doc                                        | When to read                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE_v1_6.md`               | Always — data model, P1/P2/P3, chain_key, session identity                       |
| `docs/OVERVIEW_TAB_SPEC.md`               | **Overview tab / analitika** — model pločice, RPC, sidro salda, gdje živi konfiguracija |
| `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` | **⚠ PROČITATI prije Faze 1** — dokaz modela salda nad 4.996 redaka, 3 zamke u mjerenju |
| `docs/STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md` | Structure tab work                                                               |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md`        | Excel export/import work — **⚠ POVIJESNI ZAPIS, ne referenca** (izmjereno S139: doc 17 kolona A–Q, kod 23 A–W, i svako slovo od D nadalje je pomaknuto). Popis kolona ima **samo** `COLS` u `src/lib/structureExcel.ts` |
| `sql/SQL_schema_V5_commented.sql`         | DB schema reference                                                              |
| `docs/Code_Guidelines_React_v6.md`        | Code conventions                                                                 |
| `docs/COLLAB_PLAN_v2.md`                  | Collab implementation plan (v2) — faze 0–11, decisions                           |
| `docs/TEMPLATE_SYSTEM_SPEC.md`            | Template user sistem — starter Areas, Add Area „From template"                   |
| `docs/AUTOMATION_SPEC.md`                 | Post-Finish automatika — rata modal, comment template, `set_attribute`           |
| `docs/FILTER_SPEC.md`                     | **Nadogradnja filtra** (prijedlog prije koda, S122) — jedan uvjet ⇒ lista uvjeta, RPC granica, shortcutovi po Arei, faze |
| `docs/RULES_ENGINE_SPEC.md`               | **Pravila razvrstavanja** (prijedlog prije koda) — pravila u bazi uz Areu, konflikt se prijavljuje umjesto da ga odluči redoslijed |
| `docs/FAZA3_IMPORT_AUTOMATIKA.md`         | **⛔ Prije nego kreneš graditi Fazu 3** — izmjereno da meta ne postoji (`Datum naplate` 0 praznih od 5.192); okidač za ponovno otvaranje i pet odluka prije koda |
| `docs/FINANCIJE_STATUS.md`                 | **Stanje migracije Financija** — tranše, PROD povijest, „Nakon tranši". ⚠ **Kvarljivo**: provjeri datum prije nego povjeruješ brojci; pravila su ostala u CLAUDE.md-u |
| `docs/Analytics_tab.md`                   | **Cross-Area** analitika — `periods`, Series, AnalyticsDef Excel. Čeka drugu gustu Areu. ⚠ §3 („bucketiranje client-side") je opovrgnut u OVERVIEW_TAB_SPEC §2.2 |
| `docs/RLS_INVENTORY.md`                   | **Prava — tko što smije.** Namjera; `sql/SCHEMA_PROD.sql` je stvarnost, `rls_probe.py` mjeri razliku |
| `docs/PLAYWRIGHT_E2E_GUIDE.md`            | E2E test setup i workflow                                                        |
| `docs/HELP_STRUCTURE.md`                  | Help sistem — chip map, context detection, Content Evolution Protocol            |
| `data-prep_tools/DATA_PIPELINE_PLAN.md`  | Migracija podataka — prioriteti, Dirty Excel workflow, PROD checklist            |
| `data-prep_tools/Financije/ENRICH_PLAN.md` | Financije pipeline — alati, koraci, nalazi po sesijama                          |
| `docs/KOKA_PRVI_MJESEC.md`                | **Prije nego Koka počne** — što je riješeno, što nije, i redoslijed po riziku za njeno povjerenje |
| `NEXT_SESSION_PROMPT.md`                  | **Na početku svake sesije** — handoff, DIO 1 netehnički / DIO 2 tehnički. Prepisuje se na kraju svake sesije (v. „End of session" 5). ⚠ Provjeri commit u zaglavlju: ako nije zadnji, čitaj ga kao povijest, ne kao stanje |
| `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13** | **Cutover plan** (⚠ gitignoriran — samo lokalno + `D:`)           |

---

## Three core principles — NEVER violate
[↑ Sadrzaj](#Sadrzaj)

**P1** — All category levels (not just leaf) can have attribute definitions.

**P2** — Leaf gets N events per session; every parent level gets exactly 1 event per session
(upsert, not insert). `chain_key = leafCategoryId` on all parent events.

**P3** — Last non-empty value wins. Empty never overwrites non-empty.
Applies in: Add Activity, Edit Activity, Excel Import.

---

## Critical rules
[↑ Sadrzaj](#Sadrzaj)

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

**PROD ≠ TEST — ponašanje baze se provjerava pokusom, ne čitanjem koda (S118)**

- **⚠ PROD je imao trigger koji GAZI slug na INSERT-u; TEST ga uopće nema.**
  `generate_slug_from_name()` (triggeri `set_area_slug`, `set_category_slug`,
  `set_attribute_slug`) nosio je uvjet `IF TG_OP = 'INSERT' OR NEW.slug IS NULL OR …`,
  dakle na svakom INSERT-u zamijeni proslijeđeni slug s `slugify(name)` — i to s
  **crticom**, dok app proizvodi **podvlaku** (`makeAttrSlug`). Komentar iznad uvjeta
  tvrdio je suprotno („ONLY on INSERT **or if slug is empty**"), pa se čitanjem koda
  nije dalo vidjeti.
  Izmjereno pri prvom uvozu Structure na PROD: Excel nosi `izvorplacanja`,
  `datum_naplate`, `brojrata`, `rata_br`, `izvod_opis` — baza spremi `izvor`,
  `datum-naplate`, `broj-rata`, `rata-br`, `izvod-opis`.
  ⚠ **Imena ostanu točna**, pa struktura izgleda uredno uvezena, a `automations`,
  `Status.depends_on`, `dashboard` i `list_columns` pokazuju u prazno — dakle
  `set_attribute` i dropdown lanac su mrtvi bez ijedne poruke.
  Popravljeno: `040` (poravnanje slugova) + `042` (uvjet je sada samo „popuni ako ga nema").
  ⚠ Trigger **ne dira UPDATE** — zato popravak UPDATE-om drži, a rename ne regenerira slug.
  ⚠ **Pouka koja vrijedi šire od sluga:** dvije baze nisu ista baza. Ponašanje se
  utvrđuje pokusom (upiši → pročitaj → obriši), ne pretpostavkom da je shema ista.

**Backup, shema i RLS (S134)**

- **Supabase free NEMA automatske backupe.** Do S134 jedina kopija PROD podataka bila je
  **nijedna**. `Tools\run.bat Tools\backup_db.py --env prod` — 12 tablica + auth popis +
  Storage; izmjereno **107.772 retka, 6,79 MB gzip, 53 s**. Ide u `data-prep_data/_backup/`,
  koji `backup_to_external.bat` već nosi na `D:` ⇒ nula novih navika.
  ⚠ **Backup napravljen anon ključem bio bi PRAZAN i izgledao uredan** — zato alat staje ako
  ključ nije `service`. Nije teorija: `_db.load_env('test')` pada na anon, i TEST je u prvom
  mjerenju izgledao kao baza s 0 eventa (stvarno 12.363).
- **✅ RESTORE POSTOJI I DOKAZAN JE (S136).** `Tools\run.bat Tools\restore_db.py`.
  Izmjereno na TEST-u: obrisano **55 redaka** (5 `balance_anchors` + 50
  `event_attributes`), vraćeno, i **`sha256` po tablici se poklopio s manifestom** —
  dakle ne „retci su se vratili" nego „sadržaj je identičan".
  ⚠ **Opasnost restorea nije „prepisati starim podacima" nego BRISANJE SVEGA
  NASTALOG POSLIJE SNIMKE** (Sašin nalaz). Zato je to riješeno **oblikom alata**, ne
  upozorenjem: zadano je **dry run**; `--mode fill` (zadano) upisuje **samo retke
  kojih nema** i **po konstrukciji** ne može dirati novije; `--mode exact` (insert +
  update + **delete**) traži utipkano `OBRISI`. Izmjereno da se razlikuju: nad
  retkom novijim od snimke `fill` javlja `OBRISATI 0`, `exact` `OBRISATI 1 <<< BRISE`.
  ⚠ **`fill` namjerno NE daje poklapanje `sha256`** kad baza ima novije retke — to
  nije pad. Poruka to mora reći, inače sljedeći čovjek posegne za `exact`.
  ⚠ Insert ide po `table_order` (roditelji prvi), **DELETE obrnutim redom** (djeca
  prva) — inače FK.
  ⚠ **`auth.users` se NE vraća** (u manifestu je samo popis) ⇒ redak čijeg korisnika
  više nema padne na FK. Storage ide svojim putem. Triggeri mogu promijeniti ono što
  se upisuje (PROD ih ima 8, TEST 2) — zato se poslije vraćanja **mjeri**.
- **Shema obje baze je u gitu:** `sql/SCHEMA_PROD.sql`, `sql/SCHEMA_TEST.sql`, generira
  `Tools\run.bat Tools\dump_schema.py --env <env>` (`--diff` uspoređuje bazu s gitom).
  **Na pitanje „što politika kaže" odgovara `git diff`, ne pamćenje.**
  ⚠ Veza ide preko **Session poolera** (PROD `aws-1-eu-west-1`, TEST `aws-0-eu-west-1`, port
  **5432**): `db.<ref>.supabase.co` ima samo AAAA zapis a stroj nema IPv6 izlaz. Pooler host
  se **ne da pogoditi** — nađen je time što pooler na krivu regiju kaže „tenant not found",
  a na točnu traži lozinku. Connection string je `SUPABASE_DB_URL` u `.env.*.local`.
  ⚠ DB lozinka se **nigdje drugdje ne koristi** (app i Netlify funkcije idu preko PostgREST-a),
  pa je njen reset bezopasan.
- **⚠ PROD 107 politika / 8 triggera, TEST 50 / 2.** Triggeri kojih na TEST-u **nema**:
  `maintain_paths`, `prevent_category_deletion`, sva tri slug triggera, `data_shares_updated_at`.
  ⇒ **„Provjereno na TEST-u" ne znači „vrijedi za PROD"** ni za RLS ni za triggere.
- **⚠ RLS POLITIKE SU PERMISSIVE ⇒ OR-AJU SE ⇒ NAJŠIRA UVIJEK POBJEĐUJE.** Na jednoj
  operaciji ih je stajalo 3–5 iz tri generacije. **Zabrana se postiže BRISANJEM, nikad
  dodavanjem** — migracija koja „doda strožu politiku" ne mijenja ništa, a izgleda kao
  gotov posao. Zato `047`–`050` brišu **sve** politike tablice (dinamički, jer PROD i TEST
  nemaju ista imena) pa stvore po jednu za svaku operaciju.
- **⚠ Kriterij za strukturu je VLASNIŠTVO AREE, nikad `categories.user_id`.** Taj se stupac
  do S134 prepisivao pri svakom spremanju panela, pa je govorio „tko je zadnji spremio" a
  politike su ga čitale kao „čije je". Vlasništvo Aree se spremanjem ne mijenja.
- **Prava se MJERE, ne čitaju:** `Tools\run.bat Tools\rls_probe.py --env <env>` glumi svaku
  ulogu, svaka proba u vlastitoj transakciji koja završava `ROLLBACK`-om. **Migracija koja
  dira RLS bez tog ispisa s obje strane je nagađanje.**
  ⚠ Čita se pažljivo: **RLS-blokiran UPDATE/DELETE ne baca grešku nego pogodi 0 redaka**, a
  FK/trigger greška znači da je RLS **propustio**.
- **⚠ ISTI `RETURNING` ČINI I LEGITIMAN INSERT „ZABRANJENIM" — obrnuti privid istog
  uzroka** (S135, migracija `052`). `047` je postavio
  `areas_select USING (app_can_read_area(id))`, a taj helper redak **traži u tablici**
  (`SELECT 1 FROM areas WHERE id = …`). Uz `RETURNING` Postgres traži SELECT pravo na
  **novi** redak — kojeg u snimci naredbe još nema — pa `EXISTS` padne i cijeli INSERT
  se poništi uz `42501 new row violates row-level security policy`. Poruka **laže**:
  `areas_insert` ga je propustio, zabranjeno je bilo **čitanje natrag**.
  ⚠ **Politika nad tablicom X ne smije tražiti redak X-a u tablici X.** Uvjet mora
  gledati **stupce samog retka** (`user_id = auth.uid()`). `categories` i
  `attribute_definitions` su pošteđene jer gledaju **roditelja**, koji već postoji;
  `areas_select` je bila jedina samoreferentna.
  ⚠ **Produkcija nije bila pokvarena — izmjereno, ne pretpostavljeno:** sva četiri
  mjesta koja stvaraju Areu zovu `.insert()` **bez** `.select()`, a `postgrest-js
  2.93.0` uz `insert()` šalje samo `count=`/`missing=default`. `return=representation`
  dolazi tek s `.select()`. Mina je bila postavljena, nitko nije stao.
  ⚠ **Sonda to nije mogla uhvatiti jer `areas INSERT` u njoj nije postojao.**
  Instrument kojim se dokazivala ispravnost `047` bio je slijep točno ondje gdje je
  `047` pogriješio; našla su ga tri E2E speca (`S100`, `S107b`, `S119`). Sonda sada nosi
  **dvije** INSERT probe na `areas` — sa i bez `RETURNING` — jer **jedna ne može
  razlikovati ta dva privida**. I oznaka više ne glasi „RLS odbio (WITH CHECK)" nego
  samo „RLS odbio": uz `RETURNING` odbija **SELECT** politika, a imenovanje krive
  politike šalje na krivi trag.
- **⚠ `Prefer: return=representation` MASKIRA OTVOREN INSERT.** Postgres tada traži i SELECT
  pravo na novi redak, pa politika koja INSERT propušta izgleda kao da ga brani. Tako je
  otvorena rupa („bilo tko može pisati u tuđu Areu") devet mjeseci izgledala zatvoreno —
  supabase-js šalje baš taj header. **INSERT se mjeri bez `RETURNING`.**

**⚠ WRITE-GRANTEE MOŽE MIJENJATI STRUKTURU TUĐE AREE (S133) — Sašina odluka: NE SMIJE**

- **Izmjereno na PROD-u 10.09.2026., u tri koraka i svaki put provjereno u bazi:**
  Saša (write grantee na `Financije_all`) spremio `comment_template` na leaf
  `Transakcija` ✅ · Koka (vlasnica Aree) spremila `description` ✅ · Saša ponovo
  spremio `description` nad retkom koji je tada bio **njen** ✅. Dakle politika
  propušta write-grantee-a **bez obzira na `categories.user_id`**.
- **⚠ Politika koja to dopušta NIJE U REPOU.** `TEST_setup.sql` ima
  `categories_update … USING (user_id = auth.uid())`, ali to je TEST; PROD-ova
  nigdje nije zapisana. Isti razred kao PROD slug trigger (S118): **shema PROD-a
  nije u cijelosti u gitu**, pa se prava utvrđuju pokusom, nikad čitanjem.
  ⚠ Prvi korak svakog popravka je **pročitati stvarnu politiku** (`pg_policy` nad
  `public.categories` u Supabase SQL editoru), ne pretpostaviti je iz migracija.
- **⚠ Nesimetrija je oštrica:** `areas.settings` je **vlasnikov** (RLS + app
  zaustavlja grantee-a), a `categories.settings` je **otvoren write-grantee-u**.
  `comment_template` živi na **obje** razine, a `resolveCommentTemplate` bira
  **leaf** prije Aree ⇒ zaštita „`areas.settings` je vlasnikov" je **zaobilazna**
  jedan nivo niže. To nije bila odluka nego zatečenost.
- **⚠ `user_id` se PREPISUJE NA SVAKOM SPREMANJU strukture.**
  `StructureNodeEditPanel:1175` šalje `user_id: user.id` u payloadu; komentar iznad
  kaže da je to zato da se preuzmu retci **bez** vlasnika, ali uvjeta nema — pa
  svako spremanje prebaci vlasništvo na onoga tko je kliknuo Save. Izmjereno:
  vlasništvo je danas dvaput promijenilo stranu. Posljedica: `categories.user_id`
  ne govori tko je nešto napravio nego **tko je zadnji spremio**.
- **Sašina odluka (S133): vlasnik Aree je vlasnik strukture cijelog lanca.**
  Grantee ne smije uređivati strukturu; treba li Saša mijenjati strukturu
  `Financije_all`, radi to **pod Kokinim računom**.
  ⚠ **Skrivanje gumba NIJE brana** — „nema gumb" nije „baza brani". Popravak
  mora dirati **i** RLS **i** UI.
- **✅ ZATVORENO S134, i na PROD-u.** `sql/045` poravnao vlasništvo (izmjereno:
  `Transakcija` + svih 15 atributa prešli s Saše na Koku, slugovi netaknuti);
  `046`–`051` očistile politike (**107 → 76**); `assertWrote()` u panelu
  pretvara tihi neuspjeh u poruku; `canEdit` gasi Edit gumb u View panelu.
  Sonda na PROD-u: 45 proba, **8 promjena, sve zatvaranja** ⇒ *write grantee*
  smije samo čitati (+ svoje evente), *stranac* **ništa**.
  Potvrđeno uživo: Koka uređuje strukturu normalno (T-S134-12), grantee vidi
  **sivi** Edit umjesto tišine (T-S134-13), unos mu i dalje radi (T-S134-14).
  ⚠ Svjesno ostaje otvoreno: **write-grantee smije `events UPDATE` tuđeg retka**
  (`050` dira samo INSERT). Izmjereno na 40 ispravljenih eventa da se taj smjer
  ne koristi (Koka → Sašini 4×, obrnuto 0×), pa bi zabrana bila besplatna — ali
  `events` UPDATE je baš mjesto gdje pogrešno sužavanje ostavlja redak **bez
  ijednog atributa** uz poruku o uspjehu (Edit tok briše pa ponovno upisuje sve).
  Ide kao zaseban zahvat, s pokusom nad Edit tokom.
- **⚠ ISPRAVAK zapisanog o tri puta do pisanja** (S134). Stajalo je da
  `StructureImportModal` „nema nijednu provjeru prava" i da je „puna zamjena za
  panel". **Izmjereno da nije točno:** `structureImport.ts:498` čita `areas` s
  `.eq('user_id', userId)`, dakle vidi **samo vlastite** Aree. Uvoz Structure
  filea tuđe Aree zato ne mijenja nju nego **tiho stvara duplikat Aree istog
  imena** pod uvoznikom. Manje opasno nego što je pisalo, ali i dalje zbunjujuće
  — popravak (stani i javi umjesto duplikata) **nije napravljen**, jer mijenja
  ponašanje uvoza, a Excel roundtrip je Koki glavni put.
  Preostala dva puta (`CategoryDetailPanel`, Edit Mode) su zatvorena.
- **⚠ `comment_template` BEZ placeholdera upisuje se doslovno.** Guard
  `placeholderCount > 0 && filledCount === 0` (`commentTemplate.ts:42`) pali samo
  kad template *ima* `{...}`; `Test` prolazi kroz njega i postaje `comment` svakog
  novog retka bez korisnikova opisa. Izmjereno: prozor od 2,5 min, nula pogođenih
  redaka — ali samo zato što u njemu nitko nije unosio.

**Uvoz — tri načina da „uspije" a ne napravi što misliš (S118)**

- **⚠ Stari keširani bundle tiho osakati Structure import.** Prvi uvoz na PROD prošao je
  sa `Areas 1 / Categories 1 / Attributes 15` i izgledao potpuno — a **nije upisao**
  `comment_template`, `add_header`, `list_columns`, `hidden_in_add` ni drugo automation
  pravilo. Netlify je imao aktualan build; preglednik je vrtio stari. Vidjelo se **samo**
  po tome što modal nije imao retke `Settings updated` i `List columns` — brojači koji u
  novijoj verziji postoje. **Hard refresh (Ctrl+Shift+R) je dio postupka**, ne higijena.
- **~~„Import as mine" pokaze `0 New / 0 Modify`, a uvoz ipak radi~~ — POPRAVLJENO S120**
  (BUG-S118-PREVIEWMODE). Stajalo je ovdje kao **ziv** kvar jos cetiri sesije nakon popravka,
  i govorilo „ne odustaj na temelju preview brojki" — sto je od S120 neistina.
  ponovo analizira s odabranim nacinom; cuva `e2e/tests/e17-import-foreign-preview.spec.ts`.
- **⚠ `et_activity_draft` nije vezan uz korisnika** (`src/types/activity.ts:226`). Jedan
  ključ po pregledniku ⇒ nedovršen nacrt napravljen pod jednim računom iskoči kao
  „Resume Previous Session?" pod **drugim**, i nudi kategoriju iz tuđe aree. Bezopasno
  dok se klikne Discard, zbunjujuće kad se ne zna odakle.
- **Delete Area kroz UI radi kad su SVI zapisi tvoji.** Pravilo nije „UI nikad ne uspije"
  nego: padne kad postoje retci koje RLS skriva (tuđi ili osirotjeli). Kokina stara
  `Financije` (357 eventa, svi njeni) obrisana je kroz UI čisto, s backupom prije brisanja.

**⚠ PYTHON ALAT BEZ `ET_TARGET` GAĐA **TEST**, A BROJKA IZGLEDA UVJERLJIVO** (S137)

- `_db.load_env` pada na `.env.testing` kad `ET_TARGET` nije postavljen, pa alat uredno
  odradi posao **nad krivom bazom**. Izmjereno isti dan, isti `promet_check.py`:
  **TEST `✓ 12 / ✗ 20`**, **PROD `✓ 27 / ✗ 5`** — dvije priče o zdravlju istih podataka.
  Jedina razlika u ispisu je zagrada u zaglavlju (`[TEST] area 98dd91f3 · .env.local`).
  ⚠ **Zaglavlje se čita PRIJE brojke, ne poslije.** U S137 je TEST ispis zamalo otišao
  Saši kao stanje PROD-a — a 2024. je ondje prazna, pa je izgledalo kao da je uvoz pao.
  Ispravno: `$env:ET_TARGET = 'prod'` (PowerShell) ili `ET_TARGET=prod` (bash).
  ⚠ Isti razred kao `dev` vs `dev:prod` za aplikaciju — banner je jedini dokaz.

**Model / atributi**

- **`is_required` je pravilo FORME, nikad baze ni uvoza** (oživljeno S131 — dotad je bilo
  **mrtvo**: kolona u Structure Excelu, crvena zvjezdica u formi i polje u bazi postojali su,
  a nitko ga nije provjeravao ni upisivao na UPDATE putu; Excel je promjenu samo `IsRequired`
  prijavljivao kao *„ništa se nije promijenilo"*). Provjera živi u
  `src/lib/requiredAttributes.ts` i zovu je **tri** mjesta (Add `Save +`, Add Finish,
  Edit Save) — svaka kopija uvjeta je prilika da se raziđe.
  ⚠ **`false` i `0` su ODGOVORI, ne izostanak** — naivni `if (value)` bi obavezan boolean
  dao spremiti samo s „da", a obavezan broj nikad s nulom.
  ⚠ **Ne primjenjuje se na Excel uvoz aktivnosti** — povijesni batchevi i `N/A` moraju proći.
  ⚠ **`IsRequired` je ZASTAVICA:** atribut ima više redaka u Structure sheetu (po jedan po
  `WhenValue`), pa `TRUE` na **bilo kojem** čini polje obaveznim — za razliku od ostalih
  atributskih polja, gdje vrijedi prvi redak. „Prvi pobjeđuje" bi `TRUE` na drugom retku
  tiho progutao, dakle točno kvar koji se popravkom zatvara.
  ⚠ **`is_required` + `hidden_in_add` je PROTURJEČJE**, ne nezgodna kombinacija: skriveno
  znači „ispravna vrijednost je prazna", obavezno „ne smije biti". Panel je ne da složiti
  (svaka kvačica gasi drugu, ali **nikad dok je sama uključena** — inače se par koji dođe
  Excelom ne bi dao popraviti); forma je razrješava **u korist obaveznog** (polje se prikaže),
  a uvoz je **prijavi i sam preuzme** `structure_REVIEW_NEEDED_*` s obojanim ćelijama J/K.
  ⚠ Jedina kombinacija koja **još** može ostaviti obavezno polje izvan ekrana: obavezno
  dijete **neobaveznog** `depends_on` roditelja — takvo polje ne otkriva ni „Show all".
- **`chain_key`** je sistemsko polje (UUID), nikad se ne prikazuje; `comment` je samo korisnički tekst
- **`touched: true`** mora biti postavljen pri učitavanju atributa iz baze u Edit toku —
  inače ih `handleSave()` preskoči
- **`parentEventLoader.ts`** je jedini shared servis za parent event logiku — nikad duplicirati
- **Promjena sluga lomi reference.** `depends_on` (S105d), a od Faze 1 i `dashboard.widgets[]`.
  Fixup referenci mora ići uz svaki rename sluga.
- **`set_attribute` se evaluira u Add Activity i (od S127) u Edit — ne u Import.**
  ⚠ **U Editu okidač NIJE stanje forme nego čovjekov potez** nad map atributom.
  Razlika nije kozmetička: računanje na *otvaranju* retka tiho bi prepisalo
  stvarne datume s izvoda — Visa **nema fiksan dan naplate** (izmjereno na 855
  redaka: 5. 383×, 4. 231×, 6. 109×, 7. 82×, 11. 49×, 3. 11×), pa bi `next:3`
  proglasio krivom **većinu** njih, i to svakome tko redak samo otvori i spremi.
  Add smije računati i na učitavanju **samo zato** što je ondje target zajamčeno
  prazan (v. „SHORTCUT NE SMIJE NOSITI IZVEDENU VRIJEDNOST").
  ⚠ `null` iz `computeSetAttributeValue` znači **„ne diraj target"**, nikad
  „isprazni ga" — prazan `Izvor` ne smije obrisati datum koji je došao s izvoda.
  ⚠ Još **ne** prati promjenu *datuma* u Editu (delta-shift) — v. Backlog.
- **⚠ `Datum naplate` IMA DVA RJEČNIKA, A SAMO JEDAN RAZUMIJE TOKENE** (S138).
  `automations.attribute_rules[].date_map` prima **pravila** (`same` / `next:N` /
  `cutoff:B:D`), a `automations.rata.date_map` prima **goli broj dana** —
  `generateRataChargeDates` (`rataAutomation.ts:77`) tvrdo radi „N-ti dan svakog
  sljedećeg mjeseca". Dakle promjena pravila kartice je **polovična** dok se ne
  dira i drugi rječnik, a iz configa se to ne vidi: oba stoje pod `automations`,
  oba imaju ključ `Visa`, i oba pune **isti** atribut (`charge_date_slug` =
  `target_slug` = `datum_naplate`).
  ⚠ **Token u rata rječniku ne javlja grešku** nego padne na zadanih `15`
  (`config.date_map[v] ?? 15`) ⇒ `cutoff:3:5` ondje daje datum koji nema veze ni
  sa starim ni s novim pravilom. U rata redak ide **broj**, nikad token.
  Izmjereno na PROD-u 15.09.2026., odmah nakon prelaska Vise na `cutoff:3:5`:
  MC rate **285/285** na 11. (oba rječnika se slažu), Visa rate **225** s danima
  5. → 99, 4. → 56, 6. → 25, 7. → 15 — to su **stvarna terećenja s izvoda** — i
  **3 retka na 3.**, sva tri nastala **istog dana kroz rata modal**. Dakle jedini
  proizvođač tog datuma je aplikacija, a proizvela ga je u prozoru od par sati.
  Zatvoreno **konfiguracijom, bez deploya**: `rata.date_map.Visa = 5` (modus
  stvarnih terećenja, 99/225), istim Structure uvozom kojim je išao i `cutoff`.
  ⚠ Ostaje rub koji ni to ne rješava: rata **uvijek kreće od sljedećeg mjeseca**,
  pa kupovina 1.–3. u mjesecu dobije prvu ratu mjesec prekasno — jednako sa `3` i
  sa `5`, dakle promjena strogo poboljšava. Pravi popravak traži kod, v. Backlog.
  ⚠ **Pouka šira od rata modala:** „promijenili smo pravilo" je tvrdnja o **jednom**
  mjestu. Prije nego se proglasi gotovim, prebroji **tko sve puni taj atribut** —
  ovdje je drugi punilac bio dva retka niže u istom Excel sheetu.
- **⚠ SHORTCUT NE SMIJE NOSITI IZVEDENU VRIJEDNOST** (S127). `activity_presets.
  default_attributes` sprema doslovne vrijednosti; za izvedeni atribut to je
  zamrznut **rezultat jednog trenutka**, i gori je od praznog polja — jer poslije
  **gasi pravilo koje bi ga ispravilo**. `set_attribute` čuva ručni unos tako da
  preskoči target koji već ima vrijednost koju samo nije upisalo (`userOwned`), a
  preset izgleda točno tako. Izmjereno na PROD-u 04.09.2026.: preset `Isplata`
  (spremljen 02.09. uz `Izvor = Mastercard`) nosio je `datum_naplate =
  2026-10-11`, pa je `Izvor = Racun` — koji traži isti dan — ostao **bez ijednog
  učinka i bez poruke**. Zatvoreno na oba kraja (`collectRuleManagedIds`):
  izvedeni atributi ne ulaze u snimku, i ne primjenjuju se iz starih snimki —
  pa popravak liječi i presete koji već postoje, bez pisanja po bazi.
  ⚠ Dvije vrste se **ne liječe isto**: target `set_attribute` pravila ne smije
  zasjeniti ni preset ni `default_value` (pravilo je jedini izvor), dok kod
  `depends_on.default_map` atributa `default_value` ostaje legitiman dok roditelj
  nema vrijednost.
  ⚠ **Preset se bira SAM** čim se poklopi `category_id`
  (`ProgressiveCategorySelector.tsx:411-416`) — nitko ga ne mora kliknuti, i
  `usage_count` ostaje **0**, pa u podacima izgleda kao da se nikad nije koristio.
  Zato je jedna slučajna snimka tiho upravljala **svakim** unosom u tu kategoriju.

**⚠ `depends_on.default_map` NE RADI NA IMPORT PUTU — kao ni `set_attribute`** (S137)

- Pravilo „`set_attribute` se evaluira u Add i Edit, ne u Import" vrijedi i za
  `default_map`: **oboje su mehanizmi forme.** Izmjereno na PROD-u 15.09.2026.:
  **2 retka od 5.198** nemaju `Status`, oba `Izvor = Mastercard` — a
  `Status.depends_on.default_map` ima `Mastercard → Planiran`. Config je ispravan;
  put je bio krivi.
  ⚠ **Prepoznaje se po `session_start = 07:00`** (import fallback 09:00 lokalno, 676
  redaka u Arei) i `created_at` **+1 sekunda**; UI redak istog dana ima `+1 minutu` i
  uredan `Status`.
  ⚠ **Ovo pomiče okidač Faze 3.** `docs/FAZA3_IMPORT_AUTOMATIKA.md` ju je odgodio jer
  `Datum naplate` ima **0 praznih od 5.192** — ali to polje **pune Python alati u fileu**,
  pa mjeri alat, ne app. `Status` nitko ne puni ⇒ **2**. Brojka više nije nula.

**Kolone Activities liste (`settings.list_columns`)**

- **Area bez configa zadrži današnju listu.** Odsutnost je zadano, ne prazna tablica —
  isti obrazac kao Overview tab (OQ-4). `DEFAULT_COLUMNS` je zato **pravi popis kolona**
  u `listColumns.ts`, ne `if (!config)` grana razasuta po tablici.
- **`actions` se uvijek renderira i uvijek zadnji**, i kad ga config nema. Config koji ga
  zaboravi inače daje listu **bez ⋮ menija** — nema Edit, View ni Delete — i nigdje ne
  piše zašto. Sticky ćelija usred tablice pokriva susjede, pa se i pomiče na kraj.
- **Rename sluga mora povući `fixupListColumnsSlug`** u istom write-u kao rename (isto
  što `dashboardConfig.ts` radi za pločice). Ovdje je pad **tiši** nego kod pločice:
  RPC na nepoznat slug baci grešku, a kolona samo ostane prazna — a prazno zbog mrtve
  reference izgleda **identično** kao prazno zbog nedostatka podatka.
- **`pair` mora pokazati OBJE strane kad su obje popunjene.** ZABA `Anja 73/96`
  (25.08.2025.) nosi uplatu `450,00` **i** isplatu `0,70` u istom eventu i to nije
  greška nego vjeran spoj dvaju redaka izvoda. Ćelija koja pokaže jednu skriva pola
  transakcije. ⚠ I: prazan iznos je `—`, **nikad `0,00`** — za novac je nula tvrdnja.
- **`desktopHide` vrijedi samo za zadanu listu.** Area koja je konfigurirala kolone
  tražila ih je sve; sužavanje je posao `mobile` uloge, ne skrivanja iza korisnikovih leđa.
- **`ListColumns` import BRIŠE ono čega nema — namjerno, za razliku od `Automations`.**
  Kolone su jedan uređeni popis, pa je brisanje retka jedini način da čovjek makne
  kolonu. Zaštita je na razini **sheeta**: nema sheeta ⇒ ništa se ne dira.
- **⚠ Ćelija u tablici bez gornje granice širine RASTEŽE TABLICU, a `truncate` je ne**
  **skraćuje** (S119). `truncate` nosi `white-space: nowrap`, a tablica s `table-layout:
  auto` naraste do **min-content** širine sadržaja — pa se tekst nikad ne skrati nego
  odgurne sve desno od sebe izvan ekrana. Izmjereno na 393 px: mobilni redak je davao
  tablicu od **709 px u 367 px prostora**, i **iznos** je stajao 342 px van vidljivog.
  Desktop ćelije to nikad nisu pokazale jer nose `max-w-[140px]`/`max-w-[180px]`; mobilna
  nije nosila ništa. Lijek je `w-full max-w-0` na ćeliji — tek tada prelom i skraćivanje
  unutar nje uopće rade. **Vrijedi za svaku buduću ćeliju s tekstom promjenjive duljine.**
- **Uska lista ima dvije linije i one nisu isto mjesto.** `line1` nosi datum, kraticu
  računa i **iznos** (desno poravnato ide uz sam rub, prije sticky ⋮); `line2` se
  **prelama** do dva reda. Zato `cellContent` prima `'desktop' | 'line1' | 'line2'`, ne
  boolean: `truncate` na `line2` bi vratio `nowrap` i s njim cijeli gornji kvar.
  ⚠ Vodoravno scrolanje je bilo **jedini** način da se pročita kraj opisa na mobitelu —
  ukine li ga se, mora ga nešto zamijeniti. Zamjena je prelom, ne `…`.
- **`map` na `attr` koloni je rječnik kratica po VRIJEDNOSTI** (`Kokin tekući ZABA` →
  `ZABA`). Vrijednost koje u rječniku nema prikazuje se **cijela** — preimenovan račun
  time izgleda neskraćeno (**vidljivo**), nikad kao krivi račun (**nevidljivo**). Zato
  rječnik, a ne pravilo tipa „zadnja riječ imena". Ide kroz roundtrip: kolona `Map`
  u `ListColumns` sheetu, oblik `Vrijednost = kratica | Vrijednost2 = kratica2`.
- **Kratki datum na uskom ekranu nosi godinu SAMO kad redak nije iz tekuće godine**
  (`25.08. ut` / `25.08.25. po`). Puni datum je koštao ~50 px od ~270 px koliko linija ima,
  a na istoj liniji mora stati iznos. Izbaciti godinu posve bilo bi jeftinije i pogrešno:
  popis seže u prošlu godinu, a redak bez godine **tvrdi** da je iz ove.

**Unos u aplikaciji**

- **Zaglavlje Add Activity je po Arei** (`areas.settings.add_header`, S117). Odsutnost =
  današnje zaglavlje, isto pravilo kao `list_columns`. Financije: `{timer: false, date: true}`.
  ⚠ `sessionStart` je do S117 nosio **dvije uloge** — ishodište štoperice i trenutak zapisa;
  zato birač datuma nije mogao postojati. Sada su `sessionStart` (nepomičan) i `eventAt`
  (promjenjiv). Tko ih ikad opet spoji, vraća „unos za jučer traži dva ekrana".
- **`event_date` se računa LOKALNO** (`toLocalDateStr`), ne iz `toISOString()`. S biračem
  datuma UTC dan bi navečer spremio **dan prije** onoga koji je čovjek odabrao.
- **Unos unatrag traži slobodnu minutu.** `useActivities` grupira po
  user+kategorija+`session_start` ⇒ dva zapisa iste minute su **jedan redak liste**. „Sada"
  se praktički ne sudara, prošli dan da (uvezeni kolovoz sjedi na 14:00–14:13).
  ⚠ **Ovo NIJE iznimka od zabrane automatske minute** — ona vrijedi za **import**, gdje je
  kolizija način na koji se hvata dvostruki uvoz istog filea. Ovdje čovjek tipka jedan redak,
  a dvije stvarne transakcije istog dana moraju proći. P2 ostaje: pomiče se **cijela sesija**.
- **`Status` kartičnog retka je `Izvrsen`, ne `Planiran`.** Izmjereno: Visa **855/855**
  `Izvrsen`, Racun 689/689, Mastercard 754 uz 11 `Planiran` (to su rate). Kupovina se
  **dogodila**; `Planiran` znači „nije se dogodilo" i pločica se na to značenje oslanja.
  Saldo se ionako ne miče — kartični redak je pot, račun tereti tek skupna naplata.
  ⚠ Posljedica koju treba znati prije nego je netko primijeti: između kupovine i izvoda
  **nadolazeća naplata nigdje ne postoji** (`Racun/Planiran` = 0 redaka), pa saldo pokazuje
  „koliko imam", ne „koliko će ostati".
- **Nesiguran iznos: `~` na POČETKU opisa** (`~ gorivo, Ina Heinzlova`). Na početku jer
  lista reže dugačak opis. Nalazi se kroz `Filter by = Comment`, upit `~` (tilda nije
  poseban znak u `ilike`). ⚠ Ispravak ide **Editom postojećeg retka**, nikad novim retkom:
  dedup je `(datum, iznos)`, pa bi `55,00` i `54,35` ostala **dva** retka — isti razred kao
  9 skoro-duplikata iz S111.
- **`Datum naplate` se ne upisuje rukom** — `set_attribute` ga računa iz `Izvor`a
  (`Racun`/`Cash` = isti dan, `Visa` = `next:3`, `Mastercard` = `next:11`). Ručni unos
  `userOwned` guard više ne dira, pa ga ne diraj bez razloga.

**⚠ PLOČICA PRECJENJUJE SALDO IZMEĐU NAPLATE I IZVATKA** (S137)

- Skupna MC naplata dolazi **s ZABA izvatka**, a ne sintetizira se. Dok izvadak ne stigne,
  naplata koja se **već dogodila** nigdje ne postoji. Izmjereno 15.09.2026.: pločica
  `13.962,38` (sidro `12.772,86` @ 06.09. + `1.389,52` − `200,00`), a naplate od
  **11.09. `1.068,70`** nema ⇒ banka pokazuje ~`12.893,68`.
  ⚠ **Račun pločice je točan, podatak nije potpun** — to su dvije različite dijagnoze i
  brkanje vodi na krivi trag (traženje greške u RPC-u umjesto retka koji fali).
  ⚠ **Ne dopisuj je ručno.** Povijest pokazuje da dolazi 11. u mjesecu, uvijek sa
  strojnim tekstom `TROŠKOVI UČINJENI MASTERCARD KARTICOM`; ručna verzija razbija
  brojanje po opisu.

**Collab — što grantee NE može**

- **⚠ Grantee ne može spremiti Export/Import profil, ni s `write` dozvolom** (S122). Zid je
  **JEDAN, ne dva**: app ga zaustavi prije upisa (`ExcelExportModal.tsx:557`, uvjet je
  `if (sharedContext)` — dakle **svaki** grantee, ne samo read). Profili žive u
  `areas.settings`, zajedno s `automations`, `dashboard` i `list_columns` — dakle
  write-grantee koji bi ih smio pisati mijenjao bi **cijelu Areu vlasniku**. Ponašanje je
  zato ispravno; **poruka nije**: piše „(read-only access)" i write-grantee-u, što je
  neistina o njegovim pravima.
  ⚠ **DRUGI ZID NIJE POSTOJAO, a ovdje je devet sesija pisalo da postoji** (ispravljeno
  S134). Tvrdnja „RLS na `areas` dopušta UPDATE **samo vlasniku** (`009_sharing.sql`:
  *INSERT/UPDATE/DELETE unchanged (only owner writes)*)" bila je **prepisan komentar iz
  migracije**, ne stanje baze. Stvarna politika PROD-a (`areas_update_policy`) nosi granu
  `permission = 'write'`; izmjereno `rls_probe.py`: *write grantee → `areas UPDATE settings`
  → **DA, 1 redak***. Dakle disciplina se vodila kao invarijanta — isti razred kao PROD slug
  trigger (S118). Zatvoreno tek migracijom `sql/047`.
  ⚠ Isto vrijedi za svaku buduću per-Area konfiguraciju: **`areas.settings` je vlasnikov**
  (Sašina odluka, S134 — v. `docs/RLS_INVENTORY.md`).

**Collab — vlasnik Aree (S123)**

- **⚠ „Import as mine" NIJE način da se ispravi tuđi redak.** `excelImport.ts:443`
  postavlja `event_id: null` ⇒ **forsira INSERT s novim ID-em**. Original ostaje,
  kopija se doda — i to **tiho**: kolizija se provjerava po `(user_id, kategorija,
  session_start)`, a `user_id` je drugi. Saldo zbraja atribute **bez obzira na
  vlasnika**, pa duplikat s `Izvor = Racun` uđe u stanje **dvaput**.
- **Vlasnica Aree smije ISPRAVITI grantee-jev redak, ali ne obrisati** (`sql/043`).
  Autorstvo (`user_id`) ostaje autoru; `edited_by` bilježi tko je ispravljao.
  ⚠ **Brisanje je zatvoreno SAMO u UI-ju** — RLS `events_delete_by_area_owner`
  iz `020` i dalje dopušta (služi čišćenju siročadi), izmjereno pokusom.
  Točna formulacija je „nema gumb", ne „baza brani".
- **⚠ Edit tok BRIŠE pa PONOVNO UPISUJE sve atribute retka**
  (`EditActivityPage.tsx:940–966`). Zato `043` mora dirati **tri** politike, ne
  jednu: bez INSERT grane na `event_attributes` `DELETE` prođe a `INSERT` padne
  ⇒ redak ostane **bez ijednog atributa**, a ekran pokaže uspjeh.
  Atributi se pišu pod **autorom eventa**, ne pod onim tko ispravlja — inače bi
  delete+reinsert prebacio i one vrijednosti koje nitko nije dirao.
- **⚠ `WITH CHECK` vidi samo NOVI redak**, pa u njemu nema načina reći „autorstvo
  se nije promijenilo". Zato trigger `guard_event_author` — invarijanta, ne
  disciplina. Za `service_role` je `auth.uid()` NULL ⇒ migracije i dalje prolaze.
- **⚠ RLS-blokiran write „uspije" s 200 i praznim rezultatom.** Svaka provjera
  ovlasti mjeri **broj promijenjenih redaka**, nikad HTTP status.

**Collab — Excel put za tuđi redak (S125)**

- **Excel roundtrip je Koki VAŽNIJI od UI puta** (Sašina odluka) — na njega je
  naviknuta iz svoje Excelice, i bez njega ne prelazi na aplikaciju. Zato uvoz od
  S125 ima treći način uz `skip` / `import_as_mine`: **`fix_as_owner`**, koji
  **zadržava `event_id`** ⇒ UPDATE na mjestu, autorstvo ostaje autoru, `edited_by`
  bilježi ispravljača. Baza je to dopuštala od `043`; blokada je bila u klijentu.
- **⚠ Nije rubni slučaj nego glavni tok delta sheeta.** Izmjereno na košari 03.09.:
  **7 od 10 redaka su Sašini**. Bez ovoga Kokin mjesečni krug ne bi vidio većinu
  košare — i to **tiho**, retci se preskaču bez poruke.
- **⚠ ISTO PRAVILO ŽIVI NA TRI MJESTA i već je jednom odlutalo.** Apply
  (`importEventsFromExcel`), reklasifikacija (`smartReclassify`) i preview
  (`analyzeUpdates`) svi odlučuju smije li se postojeći redak ažurirati. U S125 je
  popravljen samo apply, pa su druga dva ostala s `.eq('user_id', userId)` —
  **posljedica nije bila poruka o pravima nego „event_id više ne odgovara bazi ⇒
  bit će uvezen kao NOV", dakle obećan DUPLIKAT.** Pravilo je zato izdvojeno u
  **`canUpdateExisting()`**; svaka kopija tog uvjeta je prilika da se raziđe.
  ⚠ Vlasništvo se provjerava **u kodu**, ne filtrom u upitu — filtar tuđi redak
  prikazuje kao nepostojeći. RLS ostaje druga brana.
- **⚠ BRISANJE TUĐEG RETKA BI PROŠLO POLA PUTA.** `applyDeletes` briše
  `event_attributes` **bez** filtra po korisniku (RLS iz `020` to vlasniku Aree
  dopušta), a `events` **s** filtrom ⇒ redak bi ostao **bez ijednog atributa, a
  prisutan** — uništen, a naizgled netaknut. Zatvoreno na **dva** mjesta jer je
  jedno disciplina a drugo invarijanta: parser tuđi redak nikad ne stavlja u
  `toDelete` (i to **javi**), a `applyDeletes` prije brisanja ičega provjeri **što
  se uopće smije obrisati**. Drugo štiti i svaki budući put do te funkcije.
- **Tuđi redak BEZ `event_id` se ne ispravlja nego prijavljuje** — to nije ispravak
  nego nov zapis pod tuđim imenom.
- **Ponuda se prikazuje samo vlasniku** svih Area u kojima ti retci žive
  (`foreignAreas` iz parsera + provjera nad `areas`). Ponuda koja ne može uspjeti
  gora je od izostanka.

**Excel**

- **⚠ IZVOZ KOJI NE MOŽE UČITATI PODATKE MORA PASTI, NE IZAĆI KRAĆI** (S125).
  `excelDataLoader.ts` je od `5b45f40` (28.02.2026.) u **devet od jedanaest** upita
  odbacivao `error` destrukturiranjem (`const { data } = await supabase…`). Kako
  `supabase` **ne odbacuje promise** nego vraća `{ data, error }`, palo čitanje daje
  `data: null`, a pozivatelj to čita kao „nema ničega". Izmjereno na PROD-u: jedan
  pali upit na `attribute_definitions` dao je file **bez ijedne atributske kolone** —
  izašao je, izgledao uredno, a jedina naznaka bio je toast *„Kontrolni stupac
  preskočen: ne nalazim kolone za uplatu/isplatu"*, koji zvuči kao problem delta
  sheeta.
  ⚠ **Posljedica je gora od tablice:** `passes()` u `ExcelExportModal` vraća `true`
  kad za slug nema definicije, pa su bez atributa u delta blok ušli i kartični retci
  — dakle i **odabir redaka** je bio kriv, ne samo prikaz.
  Popravljeno: `withRetryQuery` + `must()` koji **baci s porukom što se nije
  učitalo**, na upitima čija tiha praznina kvari file (areas, categories,
  attribute_definitions, event_attributes, roditeljski eventi, profiles/emailovi).
  ⚠ Dva upita u `loadSharedEmailsByArea` su **namjerno** ostavljena — hrane popis
  emailova za dropdown, ne same retke; ondje bi bacanje srušilo izvoz zbog nebitnog
  popisa. **Glasan pad ide samo gdje šutnja kvari podatke.**
  ⚠ Email u kol. G je u toj skupini s razlogom: bez njega uvoz **tog** filea preskoči
  svaki redak kao „tuđi".
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
- **Redak bez `Area` nije redak — i to bez ijedne poruke** (S113). Parser prepoznaje redak po
  popunjenoj koloni B; 45 ispravno popunjenih redaka bez nje dalo je uvoz „**0 New, 0 Modify**"
  nad punim fileom. Svaki generator koji piše u app-ov Excel mora upisati `Area`,
  `Category_Path` i **email** — ne oslanjati se na to da ih predložak već nosi.
- **⚠ Export usklađenog računa daje prazne retke predloška BEZ `Area`** (S113, popravljeno).
  Delta export je te vrijednosti čitao iz **prvog podatkovnog retka**, a usklađen račun ima
  prazan prozor (sve je prije sidra). Dakle: što je račun uredniji, to je predložak
  beskorisniji. Fallback je kategorija odabrana u filtru.
- **⚠ `Date.UTC` uzima mjesec 0-based** (S113). Delta prozor je zbog toga kretao **mjesec dana
  prekasno** (sidro 11.08. → „stanje 11.09.") i tiho izostavljao sve retke tog mjeseca —
  usklađenje izgleda uredno jer ih sheet uopće ne pokaže. Vidjelo se tek kad je sidro svježe:
  dok je pobjeđivalo „danas − N dana", greška se nije očitovala.

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
- **Profil nosi 8 fiksnih + N atributskih kolona — `Delete?` NIKAD.** `row_hash`
  smije u profil (S123), `Delete?` ne: on je **okidač brisanja**, a zastavica koju
  nitko ne vidi je zastavica koju nitko ne može ni maknuti. Sakriven stupac se i
  dalje sortira s retkom (unutar je autofiltera), pa se otisak ne raspari.
  ⚠ Skrivanje kolone **rukom u fileu** ne ulazi u profil ako profil za tu kolonu
  nema ključ — živi samo u tom fileu, i idući izvoz je vrati.
- **Export modal zadano bira PRVI profil Aree** (S123). Bez profila izvoz izađe u
  punoj širini, pa zaboravljen klik ne daje grešku nego **neuredan file**.
  ⚠ Posljedica: `Preview (10 rows)` sada primjenjuje kolone profila — za izradu
  **novog** profila prvo odaberi „No profile (all columns)".
- **⚠ Ponovno spremanje profila iz exporta VRAĆA filtar računa u profil.** `Filter`
  list zapisuje **efektivni** filtar atributa; nema li ga profil, ondje završi onaj
  **iz panela**. Prije `Import Profile` isprazni ćeliju `Attribute filter`.
  Prazna ćelija = „naslijedi panel"; `_` = „izričito bez filtra". Nisu isto.
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
- **⚠ Kontrolni stupac NE broji `Planiran` — usklađenje ima obavezan ručni korak** (S114).
  Formula nosi `$U:$U,"<>Planiran"`. Dok je planirana MC naplata `1.244,74` stajala nepotvrđena,
  kontrola je davala `15.060,07` umjesto `13.815,33` — **točno taj iznos previše**, i to je
  izgledalo kao greška u podacima. Nije bug nego druga strana pravila „planirani retci ostaju
  vidljivi": prvo u sheetu potvrdiš što je banka naplatila, pa tek onda čitaš kontrolni broj.
  Isto vrijedi za ćeliju `razlika` — šuti dok `u banci piše` nije popunjen **rukom**, jer bi
  inače provjera bila tautološka (§2.17).
- **⚠ Zadanih 40 praznih redaka nije dosta za tranšu s izvoda** (S114). Redak koji ne stane u
  pripremljene prazne pada **izvan raspona kontrolnog stupca** — brojka ostane uvjerljiva i
  nepotpuna. Broj je polje u export modalu od S113; postavi ga prema broju redaka na izvodu.
- **Kontrolna formula je `SUMIFS` po datumu ≤ datum retka**, nikad „prethodni redak + uplata −
  isplata": lančana se raspadne na prvom sortu, a korisnik sortira čim doda stariji datum.
  I: **uvjeti se čitaju iz `dashboard` configa**, ne prepisuju u kod — stupac koji se ne slaže
  s pločicom, a izgleda uvjerljivo, gori je od nikakvog.
- **⚠ Račun delta sheeta mora doći ODANDE ODAKLE I EVENTI** (S123,
  BUG-S123-DELTAACCT). Čitao se iz **živog filtra u panelu**, a eventi iz profila;
  kad se ne poklope, presjek je prazan — a file svejedno izađe s **točnim** sidrom,
  prefillom i kontrolnim stupcem. **Prazan delta sheet i savršeno usklađen račun
  izgledaju identično.** Izmjereno na PROD-u: profil `RF` + panel `Kokin tekući
  ZABA` ⇒ 79 RF eventa u upitu, **0 redaka** u sheetu, gumb „Download Excel (RF)",
  file `delta_Kokin_teku_i_ZABA_*.xlsx`, bez ijedne poruke.
  Lijek: `deriveDeltaAccount()` + upozorenje kad je sekcija prazna.
- **Sekcija „planirano" ide ISPOD praznih redaka** (S123), odvojena praznim
  retkom. Piše je **isti pisač redaka** (`trailing` u `addActivitiesSheetsTo`), pa
  nosi ispravan `row_hash` i dropdowne — logika retka se nigdje ne duplicira.
  ⚠ Praznina mora biti `blankRows + 1`, inače prazni retci **pregaze sekciju**.
  ⚠ Kontrolni stupac je ne pokriva i ćelija ostaje **prazna** — `0,00` bi ondje
  tvrdio da je stanje nula. ⚠ Sažeci `Max/Min/Summ` se u delta putu **ograničavaju**
  na glavni blok: računaju se do zadnjeg retka s popunjenom kolonom B na cijelom
  listu, pa bi sekcija tiho ušla u njih.
- **⚠ Sekcija nosi VLASTITU kontrolu košare** (`Σ planirano` / `naplaćeno s izvoda`
  / `razlika`). Bez nje je „potvrdi" potvrda **po datumu**, a datum zna biti kriv.
- **⚠ SIDRO TVRDO ZAKLJUČAVA POČETAK PROZORA** (S126). `ExcelExportModal` računa
  `startMs = max(dan nakon sidra, danas − N dana)` i to postaje `dateFrom` — dakle
  raspon upisan u panel **ne može** dosegnuti ispred sidra. Posljedica koja se ne
  vidi dok ne zatreba: postaviš li sidro na kraj mjeseca koji je tek usklađen, retci
  tog mjeseca **ispadaju iz svakog budućeg delta sheeta**, pa se više ne mogu ni
  razvrstati ni ispraviti tim putem. Zato: **sidro ide tek kad je prozor gotov**.
  ⚠ Odgoda je sigurna samo jer je razvrstavanje (`Tip`/`Podtip`) neutralno za saldo;
  promjena **iznosa ili datuma** u nezasidrenom prozoru prolazi bez ijedne kontrole.
- **Kontrola košare ide IZNAD sekcije** (S126). Sekcija je zadnji blok i **raste**
  (alat joj dopisuje retke s kartičnog izvoda), pa bi se kontrola ispod nje pri
  svakom dopisivanju morala pomicati zajedno s rasponom svoje formule.
  ⚠ Raspored živi na **dva mjesta**: `gapRows = blankRows + 4` (`createDeltaExcel`)
  i pomaci u `addDeltaHelpersTo`. Raziđu li se, kontrola se upiše **preko prvih
  redaka sekcije**. Čuva `deltaSheetLayout.test.mjs`.
- **⚠ Kartični redak NE SMIJE u prazne retke glavnog bloka** (S126). Prije je smio
  („kontrolni stupac ih ionako ne broji"), i to je bilo točno **dok sekcija nije
  imala vlastitu kontrolu**. Sada ima: `Σ košara` pokriva samo retke sekcije, pa bi
  kartični redak u praznom retku ispao iz **oba** zbroja. Izmjereno: uz `--zaba` (30)
  i `--mc` (45) na 40 praznih redaka, 10 MC stavki palo bi upravo tako.
- **⚠ Kontrolni stupac NE izuzima retke označene `Delete?`** (S126). Formula nosi
  samo `$J="Racun"` i `$U<>"Planiran"`. Zato „uvezi N bankinih + označi spojeni za
  brisanje" daje kontrolni broj **previsok za taj iznos tijekom pregleda**, a točan
  tek **poslije** uvoza — dakle baš u trenutku kad se brojka provjerava prije Applyja.
  Za razriješen 1:N spoj je zato jeftinije **zadržati spojeni redak** i ožigosati ga
  svim tekstovima izvoda koje pokriva.
- **⚠ Sumarni retci sjede u koloni `Delete?`** i bezopasni su **samo** zato što
  parser prvo gleda kolonu B (`Area`) i redak bez nje uopće ne obrađuje. Otkad
  kontrola stoji **između** praznih redaka i sekcije, iza nje ima pravih redaka —
  pa je to invarijanta koju drži test, ne disciplina.
- **⚠ VALIDACIJA PRAZNIH REDAKA SE NE SMIJE KOPIRATI S POVIJESNOG RETKA** (S130).
  Prazni retci predložka su **jedino mjesto gdje čovjek upisuje**, pa su i jedino mjesto
  gdje dropdown stvarno treba. `addDeltaHelpersTo` ih je popunjavao prepisivanjem
  `dataValidation` zadnjeg povijesnog retka. Za statican popis (`Tip`) to prolazi, ali
  **`depends_on` atribut nosi APSOLUTNU adresu roditeljske ćelije**:
  `INDIRECT("Dep_tip_"&SUBSTITUTE(N18,…))`. Kopija je zato svakom praznom retku nudila
  podtipove `Tipa` sa **zadnjeg povijesnog retka**. Izmjereno: pet praznih redaka, svih
  pet gleda `N18`. **Gore od izostanka dropdowna** — izgleda ispravno, nudi krivu listu,
  a podtip mimo `validation_rules` uveze se kao običan tekst **bez greske**.
  ⚠ Na PROD-u ima **šest** `depends_on` atributa, ali samo `Podtip` je stvarno lomilo:
  `Izvor` i `Status` ovise o `Racun`/`Izvor`, a prazni retci nose **prefill** s istim
  vrijednostima kao povijest, pa im je zamrznuta lista slučajno bila točna. Slučajnost,
  ne ispravnost — prvi delta sheet nad Areom bez prefilla bi je razbio.
  ⚠ Kopiranje je padalo i drugdje: uz **prazan glavni blok** (račun usklađen do sidra)
  predloska za kopiranje uopće nema ⇒ predložak je ostajao **bez ijednog dropdowna**.
  Sada dropdowne piše **pisač retka** (`addActivitiesSheetsTo`, parametar `dvBlankRows`),
  svakom retku sa **svojom** adresom. Čuva `deltaBlankRowDropdowns.test.mjs`.
- **⚠ `Provjeri` PRIJAVLJUJE NORMALNO STANJE OTVORENE KOŠARE** (S130, neodlučeno).
  Formula glasi `Status <> "Planiran" AND dospijeće > TODAY()` ⇒
  *„dospijeva tek … — nije moglo biti naplaćeno"*. Za kartični redak u **otvorenoj**
  košari to je **normalno stanje**: kupovina se dogodila (`Izvrsen`), a skupna naplata
  tek dolazi. Izmjereno na `MC_2026-08`: košara je **46 redaka**, svih 46 dospijeva
  `11.09.2026.`, svih 46 `Izvor = Mastercard`. Dok su `Planiran`, stupac je **prazan**;
  primijeni li se usklađenje izvoda (`Planiran → Izvrsen`), pali **svih 46**.
  ⚠ **Ovdje se dva zapisana pravila razilaze i to nije riješeno:**
  „`Status` kartičnog retka je `Izvrsen`, kupovina se dogodila" (izmjereno Visa 855/855)
  protiv delta toka gdje je `Status` **prekidač potvrde** („potvrdi promjenom `Status`a").
  Slažu se za **zatvorene** košare (dospijeće u prošlosti), sudaraju samo za otvorenu.
  ⚠ Praktična posljedica dok se ne odluči: **ne primjenjuj usklađenje kartičnog izvoda
  neposredno prije izvoza Delte** — dobiješ desetke narančastih upozorenja na retcima na
  kojima ništa nije u redu, a *upozorenje koje laže korisnik nauči otklikati bez čitanja*.
  ⚠ I: `primijeni_uskladu.py` **ne uvozi** — radi samo ispravke, dopune i brisanja. Retci
  kojih baza nema ostaju vani, pa kontrola košare pokaže razliku (izmjereno: Σ `1.048,72`
  protiv `1.068,70` s izvoda = **`19,98`**, točno dva neuvezena retka). Ta je razlika
  čitljiva **samo dok je košara nedirnuta**.
- **Export profil se primjenjuje PRIJE delta alata.** Profil dira kolone po položaju (širine,
  skrivanje, grupe), a kontrolni stupac se dodaje zadnji — obrnutim redoslijedom bi ga profil
  mogao sakriti.
- **⚠ Sekcija je CIJELA KOŠARA, ne samo `Status = Planiran`** (S125). Redak koji je
  netko prebacio u `Izvrsen` **bez potvrde izvodom** ispadao je iz **obje** strane:
  iz glavnog bloka jer je kartičan pa ne miče saldo, iz sekcije jer nije planiran.
  Izmjereno na PROD-u: košara 03.09. ima 10 redaka / 205,36, a sekcija je pokazivala
  9 / 150,36 — kontrola bi pokazala razliku od **točno 55,00** koju na listu ništa ne
  objašnjava. Gore od krive brojke: **redak nije bio ni u fileu**, pa se nije dao
  ispraviti ni uvozom — a roundtrip je jedini put kojim Koka ispravlja retke.
  Sada u sekciju ide i sve čije **dospijeće još nije prošlo**, bez obzira na `Status`.
  ⚠ **Prag je „danas", ne sidro** — sa sidrom bi ZABA vratila **47 već potvrđenih**
  redaka košare 11.08. (izmjereno); sekcija koja svaki mjesec ponovi zatvorenu košaru
  je šum, a šum se prestane čitati.
  ⚠ Slug dospijeća dolazi **iz configa** (`split.due_slug`, migracija `044`), ne iz
  koda — `datum_naplate` je pojam Financija, ne aplikacije. Bez ključa je ponašanje
  doslovno prijašnje, pa migracija i kod ne moraju ići zajedno.
- **⚠ `Σ` sekcije je NETO** (minus − plus). Izmjereno na ZABA košari 11.08.: 49
  redaka, isplate `2.868,04`, **povrat `3,00`** — banka tereti neto, pa bi bruto
  zbroj izmislio razliku prema izvodu.
- **Stupac `Provjeri` kaže ŠTO s retkom nije u redu** (S125): `Izvrsen` a dospijeće
  u budućnosti ⇒ *„dospijeva tek …, nije moglo biti naplaćeno"*; `Planiran` a
  dospijeće prošlo ⇒ *„dospjelo …, potvrdi TEK s izvoda"*.
  ⚠ **Drugi slučaj NE SMIJE glasiti „promijeni u Izvrsen"**, iako se tako prirodno
  formulira — to je doslovno odbačeni automat („dospjelo ⇒ izvršeno") izrečen kao
  savjet, i naučio bi korisnika da potvrđuje po datumu. Uputa ide na **dokaz**, ne
  na potez. Čuva test u `deltaSheetLayout`.
  ⚠ Napomena je **formula nad `TODAY()`**, ne upisan tekst — promijeni li korisnik
  `Status`, nestaje istog trena. Upozorenje koje i dalje prigovara popravljenom
  retku prestane se čitati.
  ⚠ Naslov stupca stoji u **retku-razdjelniku**, ne u zaglavlju lista: vrijedi samo
  za sekciju, a zaglavlje je desetke redaka iznad, uz `Stanje (kontrola)` koje se
  odnosi na glavni blok.
- **⚠ Objašnjenja uz ćelije idu kao Data Validation „input message", ne kao `.note`**
  (S125). Bilješka se otvara **desno** od ćelije: kod desnog ruba lista izlazi izvan
  ekrana, a kad je list skrolan, odreže joj se dno — objašnjenje koje se ne može
  pročitati jednako je onome kojeg nema. Helper `explain()` nosi oba Excel limita
  (`promptTitle ≤ 32`, `prompt ≤ 255`) i **pada natrag na bilješku** ako tekst ne
  stane; premašaj daje neispravan OOXML, Excel ponudi „repair" i pritom **izbaci
  sadržaj**. ⚠ Input message **nema crveni trokut**, dakle ne najavljuje sam sebe —
  ide samo na ćelije koje su već naslov nečega, nikad kao jedini nositelj nužne
  informacije (sidro od 355 znakova zato ostaje bilješka).

**Rječnik `Izvod opis` → `Tip`/`Podtip` (`presedani.py`, S126)**

- **⚠ SKRAĆEN ISPIS JE HIPOTEZA, NE PODATAK.** Osamnaest sesija je vrijedilo da ZABA
  izvadak nema sidro za sparivanje jer „svaki nalog počinje istim tekstom". Uvod
  `Kreditni transfer nacionalni u eurima on-line bankarstvom` ima **66 znakova**, a
  dijagnostički ispis je rezao na **60** — primatelj stoji **iza** njega, na svakom
  retku (`… HT d.d. - UPLATNI RAČUN T-MOBILE POSTPAID HR01 29308057000-999-8`).
  Zaključak se držao dok se nije ispisao **cijeli** redak. Vrijedi šire od ovog
  alata: prije nego proglasiš da podatka nema, ispiši ga bez rezanja.
- **Tri ključa, od najoštrijeg prema najslabijem:** ime primatelja **+ poziv na
  broj** → samo ime → **iznos s predznakom**. Izmjereno na `ZABA_2026-08.pdf`
  (31 nepoznat redak, povijest 443): iznos daje 6 jednoglasnih, primatelj **19** —
  i to baš one koje nismo znali (T-mobile 207,26 13/13, Nataša Holding 57,19 19/19,
  Bulatova plin 13,31 11/11).
- **⚠ Poziv na broj je RAZLIKOVNI dio, ne ukras.** Tri kolovoška retka nose istog
  primatelja `ZAGREBAČKI HOLDING` a različite pozive: `12045603` je Sašin stan,
  `03879097` Natašin. Ključ bez poziva slio bi ih i svakom ponudio komentar onog
  češćeg — dakle **uvjerljivo krivo ime stana**.
- **⚠ Ključ po iznosu mora nositi PREDZNAK.** Bez njega je uplata od `7,43` presedan
  za isplatu od `7,43` — izmjereno 19.08.2026., redak je dobio `Bankovni troškovi`
  s uplatne strane. Iznos je već slab ključ; iznos bez smjera nije ključ nego
  podudarnost.
- **⚠ `N/A` u povijesti NIJE konkurentska klasifikacija nego izostanak odluke**, pa
  ne smije glasati protiv. Izmjereno na `HLK`: 7 redaka `Zdravlje / Liječnička
  komora` i 1 `N/A` daju 7/8 = 0,875 i padaju ispod praga — dakle **jedan
  neklasificiran redak poništi sedam odluka**.
- **⚠ Dio povijesnih komentara je SIROVI TEKST IZVODA, ne oznaka**
  (`Bmove d.o.o. CASH HR00 00056571 Parking - ZAGREB - e286w-…`). Svaki je
  jedinstven, pa brojanjem obara jednoglasnost prave oznake: parking je `Parking`
  11× uz dva takva ostatka, i komentar zbog njih **nije bio predložen** — a
  alternativa mu je bila 60 znakova strojnog teksta. Broje se samo kratke oznake.
- **Par se smije predložiti i kad komentar nije jednoglasan — komentar se tada NE
  PIŠE nego prijavi kao izbor.** `PP Saša` i `PP Koka` dijele `Tip/Podtip` 12/12, a
  21.08. stoje **dva** retka po 22,90 (vjerojatno jedan svakome). Isto `ZAGREBAČKI
  HOLDING` s tri stana.
- **⚠ Broj rate se ne izmišlja.** Presedan `Anja 84/96` je prošlomjesečni; broj se
  **reže** iz presedana i vraća samo ako ga tekst izvoda stvarno nosi.
  ⚠ Regex mora imati granice oko znamenki — bez njih `režije voda za 07/2026` daje
  „ratu 07/202", što izgleda kao podatak.
- **⚠ Sidro pravila na POČETAK retka kad je riječ dvoznačna** (proširenje S124
  pravila „pretraga po ključnoj riječi prekomjerno hvata"). `Naknada za ` je uz
  bankinu naknadu pokupilo i `… (m-zaba) Naknada za uređenje voda - SPLIT … NUV -
  1. rata za 2026.` — vodnogospodarsko davanje, ne bankovni trošak. **Bankine
  vlastite naknade svoj redak POČINJU tim tekstom; tuđe ga nose iza prefiksa
  naloga.** Razlika je u položaju, pa je i pravilo takvo.
- **⚠ `Izvod opis` se skraćuje za uvod, `(m-zaba)` ostaje** (S126) — a tvrdnja da je
  to **sigurno za sparivanje** bila je **NETOČNA i stajala je ovdje devet sesija**
  (ispravljeno S129). `_PREFIX` je tražio **cijeli** uvod, pa bez njega ne uhvati
  ništa i `(m-zaba)` postane **dio imena primatelja**:

      dugi    Kreditni transfer … (m-zaba) POSMRTNA …  →  ('posmrtna pripomoc', '1147')
      kratki  (m-zaba) POSMRTNA …                      →  ('m zaba posmrtna',   '1147')

  Izmjereno na PROD-u: **14** povijesnih PP redaka nije bilo presedan za 2 kolovoška,
  pa je alat javio **„nema presedana"** ondje gdje povijest ima odgovor — razred S114
  („brojač koji nula pokušaja prikazuje kao nula rezultata").
  ⚠ Gore od toga: oblik `(mobilne aplikacije)` stari regex nije hvatao **ni s uvodom**,
  pa je **22 nepovezana primatelja** dobilo isti ključ `kreditni transfer nac`. Prag
  jednoglasnosti je sprječavao krive prijedloge, ali su pravi presedani bili
  **nedohvatljivi**. Popravak: uvod je neobavezan, zagrada s kanalom se skida i sama.
  Izmjereno: **59 redaka** dobiva pravog primatelja.
  ⚠ **Pouka šira od regexa:** tvrdnja „X i Y se poklapaju" nije dokazana time što je
  napisana. Ovdje je devet sesija stajala kao pravilo, a razlika se vidi u **dva retka
  ispisa**.
- **⚠ Ključ za oznaku je PRIMATELJ + POZIV NA BROJ, nikad `Tip`/`Podtip`** (S129).
  Izmjereno: po `Tip`/`Podtip` vodeća oznaka parking skupine ima **36 %** — jer isti
  Podtip nosi i `Prevoz` (45×); po primatelju **96 %**. Označavanje po `Tip`/`Podtip`
  nazvalo bi 45 redaka krivo. Isti razlog vrijedi obrnuto: `ZAGREBAČKI HOLDING` ima
  **tri** poziva na broj (tri stana), pa bi ključ bez poziva svakom ponudio ime onog
  češćeg — dakle uvjerljivo krivo ime stana.
  Alat: `oznaci_iz_presedana.py` (prag ≥ 90 % i ≥ 3 presedana; 45 od 71 retka).
- **Žigosanje postojećih redaka (`--zigosi`) ide SAMO na točan par** (datum + iznos
  + smjer). Tolerancija na datum bi ovdje bila opasna nevidljivo: `Cash 100,00` se
  ponavlja svakih par tjedana (S114), pa bi prvi bankomat pokupio potvrdu nekog
  kasnijeg — iznos se i dalje slaže. **Popunjena ćelija se ne dira**: postojeća
  potvrda je dokaz nekog drugog izvoda.

**⚠ SLIČAN `Izvod opis` NIJE DUPLIKAT — provjerava se BROJEM TRANSAKCIJE** (S137)

- `LUFTHAN2202242474447 RATA 3/3` i `…448 RATA 3/3`, isti dan, **isti iznos 62,00**,
  izgledaju kao dvostruki upis. Nisu: to su **dvije karte**, svaka sa svojim planom
  otplate — par se ponavlja kroz tri mjeseca (`1/3` 28.06., `2/3` 29.07., `3/3` 29.08.),
  i izvod ih nosi pod **različitim brojevima** (`B08026241143682**1**` / `…682**3**`),
  svaki sa **svojom** naknadom od `1,32`.
- **Dokaz nije sličnost opisa nego kontrola košare:** `uskladi_izvod.py` javlja
  `48 redaka / 1.068,70 == izvod, u cent`. Brisanje jednog dalo bi 47 redaka i manjak
  od točno `62,00` — dakle kvar koji se vidi tek sljedeći mjesec.
  ⚠ Pravilo: **prije brisanja „duplikata" traži redak IZVODA, ne redak baze.**

**Mjerenje / usklađenje**

- **⚠ Sidro iz pločice nosi datum KOJI SE GLEDA, a broj može biti sa starijeg izvoda** (S115).
  Potvrda se žigoše `effectiveAsOf`-om (dan koji je na filtru, stegnut na danas), a ne datumom
  zatvaranja izvoda. Izmjereno: sidro `22.08.2026. = 13.815,33` s bilješkom
  `ispisano stanje s izvoda · ZABA_2026-07.pdf` — a taj se izvod **zatvara 30.07.** App je oba
  podatka imao **u istom retku** i nije ih usporedio. Posljedica po pravilu „strogo nakon":
  sve datirano 31.07.–22.08. tiho ispada iz salda. Nije se vidjelo jer u tom prozoru trenutno
  nema nijednog ZABA retka — ali sljedeći uvoz (kolovoz, MC naplata `1.332,52` @ **11.08.**) pada
  točno u njega. **Kad izvor nije ekran banke nego izvod, datum mora doći iz izvoda.**
  ⚠ Obrnuto je ispravno: broj s **ekrana bankovne aplikacije** i jest očitanje za danas.
- **⚠ Datum sidra dolazi iz IZVORA, nikad iz filtra ni iz klika** (S116, popravak
  BUG-S115-ANCHORDATE). Pravilo stane u rečenicu i zato se da naučiti korisnika:
  **broj s papira → datum piše na papiru; broj s ekrana → app ga izračuna** (⚠ na **jučer**,
  s oduzetim današnjim prometom — v. sljedeću zamku; sidro na danas izbacuje današnje retke
  iz salda). Za papirnate
  izvore app **ne nudi zadani datum** — svaki default bio bi pogodak, a pogodak koji izgleda
  kao podatak je točno ono što je proizvelo grešku. ⚠ Izvor je zato **obavezan**: bez njega
  app ne zna smije li upisati današnji dan.
- **⚠ Očitanje s ekrana sidri se na JUČER, s oduzetim današnjim prometom** (S116, Sašin nalaz).
  `confirmed_on` je `date`, pa pravilo „strogo nakon" može izraziti samo granicu **kraj dana**.
  Izvod u to stane (zatvara se na kraju svog dana); očitanje s ekrana u 10:00 ne stane — sidro
  na danas tvrdi da pokriva cijeli dan, pa transakcija u 15:00 **tiho ispada iz salda i ostaje
  vani** dok je kasnije sidro ne nadjača. Rješenje pomiče potvrdu na granicu koju pravilo zna:
  `sidro(jučer) = očitano − današnji promet`. Saldo tada izađe točno kao očitani broj, a
  današnji retci se broje — uključujući one koji tek dolaze.
  ⚠ Točno **samo dok je današnji promet potpun**: transakcija koju app ne zna zamrzne se u
  sidro umjesto da ispliva kao Δ (§2.17 kvar, lokaliziran na jedan dan). Zato se računica
  **ispisuje prije spremanja**, a sirovo očitanje ide u `note` — bez njega `amount` više nije
  broj koji je čovjek vidio. Uputa korisniku: *prvo upiši današnje, pa pogledaj banku.*
  ⚠ Današnji promet mora nositi **iste filtre kao saldo** (S112) — inače oduzme kartične
  stavke koje saldo nikad nije brojao. Računa se u Postgresu (`rpc_area_group_agg` ima
  `p_from`/`p_as_of`), pa **nije trebala nova migracija**.
- **⚠ Pravilo „strogo nakon" se korisniku iskazuje POSLJEDICOM, ne pravilom** (S116). Pločica
  prije klika ispiše *„saldo = X plus sve datirano nakon `<datum>`; sve prije toga smatra se već
  uključenim"*. Ta bi rečenica uhvatila S115 na licu mjesta: uz 22.08. tvrdila bi da su retci
  od 31.07. nadalje već uključeni, što je bilo očito netočno.
- **⚠ Sidro se ispravlja SAMO novim retkom, a krivo ostaje** — i nema ga gdje vidjeti
  (v. „Sidra se ne mogu vidjeti ni obrisati", backlog). `036` bira najnovije
  `confirmed_on <= p_as_of` ⇒ novo sidro na **stariji** datum **ne poništava** ono krivo na
  novijem. Drugi put u dvije sesije (S111: tipfeler `3.453,03`).

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
- **⚠ ZASIDREN MJESEC SE PROVJERAVA PROMETOM, NE SALDOM** (S128). Gornja zamka nije
  teorijska: S127 je sva 2024. sidra upisao **prije** uvoza 2024., pa je `--report`
  nakon uvoza za svih 12 mjeseci ispisao `0.00 / SIDRO (nije provjera)` — dakle
  predviđanje se nije imalo čime provjeriti. Instrument je `promet_check.py`: mjeri
  promet u prozoru `(prev_close, close]` preko `rpc_area_group_agg` s
  `p_from`/`p_as_of`, a ta RPC za sidra **ne zna**. Izmjereno na PROD-u 04.09.2026.:
  2024. daje `+10,00 / −17,28 / −236,04` i nule drugdje — **u cent kako je S127
  predvidio**, dok je `--report` na istim podacima šutio.
  ⚠ Pouka šira od alata: **sidro je pečat na usklađen mjesec, ne alat za usklađivanje.**
  Upisano prije provjere, ono provjeru ne pokvari nego je **učini nemogućom** — i to
  bez ijedne greške, jer izlaz izgleda uredno.
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
- **⚠ `izvodi/Analizirani_izvodi/` NIJE arhiva — to je mapa koju alati čitaju** (S129).
  `make_saldo_anchors.py:65` i `pregled_stanja.py:61` glob-aju **samo** nju, pa izvod
  koji stoji u `izvodi/` korijenu za `promet_check`, `pregled_stanja` i sidra
  **ne postoji**. Ime navodi na krivo: premještanje ondje znači **„stavi u igru"**,
  ne „skloni". Izmjereno: `ZABA_2026-07` i `-08` su mjesecima bili vani, pa je
  `promet_check` prestajao na 2026-06 — a oba zatvaraju **u cent** (38 i 46 redaka).
  ⚠ Dio alata gađa **korijen** (`uvezi_transu.py`, `uskladi_izvod.py` preko `--izvod`),
  pa premještanje nije posve neutralno — provjeri koji alat čita odakle prije selidbe.
- **⚠ `rpc_area_balance_anchored` bez `p_plus_slug`/`p_minus_slug` vraća NULE** (S129).
  Oba imaju `DEFAULT NULL` (`036`), pa izostavljen argument daje `plus_sum = 0`,
  `minus_sum = 0` i `balance = anchor_amount` — dakle **saldo jednak sidru**, uz uredan
  `n` koji izgleda kao da je nešto brojano. To se čita kao „ništa se nije dogodilo
  poslije sidra", a zapravo znači „nisam ni pitao". Ispravan poziv je u
  `make_saldo_anchors.app_balance()`.
- **⚠ `uskladi_izvod.py` prima SAMO MC izvode** (`Zasad samo MC izvodi… Visa/ZABA imaju
  drugi format`). Handoff iz S128 ga je preporučio za ZABA mjesece — za ZABA-u se ide
  izravno na podatke (usporedba `_parse_zaba_all` protiv `load_db`), kao u S129.
- **Baza drži UTC, app prikazuje lokalno** (+2h ljeti). DB `07:00` = UI `09:00`. Bitno kad se
  traži slobodan `session_start` — kolizija se računa na razini minute.

**Prije svakog commita:** `npm run typecheck && npm run build` (⚠ `npm` se pokreće **iz
direktorija projekta**, inače ENOENT `package.json`; Browserslist poruka je upozorenje, ne greška)

---

## Zamke (data pipeline / AI / E2E)
[↑ Sadrzaj](#Sadrzaj)

**Python alati (`data-prep_tools/`)**

- **/!\ BASH HEREDOC JEDE BACKSLASH, i `py_compile` to ne uhvati ako ga nema komu** (S140).
  Python kod pisan kroz `python - <<'EOF'` izgubi `\n` unutar stringa -- postane **stvaran**
  prijelom retka, pa `sys.stderr.write('\n...')` padne na `SyntaxError: unterminated string
  literal`. Ugrizlo **dvaput u istoj sesiji**, iako je zapisano u handoffu -- zato je sada
  ovdje. Isto vrijedi za `\\` u regexu i za Windows putanje.
  /!\ **Prepoznaje se po tome sto assert padne na stringu koji ocito postoji u fileu** -- jer
  ne trazis ono sto mislis. Drugi oblik: CRLF. File s `\r\n` ne poklapa se s obrascem koji
  ima `\n`, pa `old in s` vrati `False` nad tekstom koji vidis vlastitim ocima.
  => Za izmjene fileova koristi **line-based** zamjenu (`readlines()` + indeks) i patch pisi u
  **zaseban .py file**, ne kroz heredoc. Prijelom iz `chr(10)`, backslash iz `chr(92)`.
- **`run.bat` guši zarez u argumentima** — jedan substring po pozivu (`--reparse A,B,C` → samo A)
- **openpyxl `cell(r,c,None)` NE briše** — mora `.value = None`
- **⚠ openpyxl string koji počinje s `=` sprema kao FORMULU** (S124). Excel je ne može
  parsirati i file se **ne otvori** — nudi „repair" i tiho izbaci taj sadržaj
  (`Removed Records: Formula from /xl/worksheets/sheet1.xml`). Ulovljeno na pripovjednoj
  ćeliji `Pregled!A31`: objašnjenje se prelomilo tako da je redak počeo s
  `= 63,33), ali razdvojeno…`. Vrijedi i za `+`, `-`, `@` — dakle i `-100` kao vrijednost,
  i crtica na početku retka. **Kvar se ne vidi pri pisanju nego tek kad korisnik otvori
  file**, a tada je već kod njega. Svaka ćelija sa slobodnim tekstom mora ići kroz helper
  koji forsira `data_type = 's'` (`uskladi_izvod.tekst()`); prelamanje rečenice popravi
  jedan slučaj i pusti sljedeći.
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
- **⚠ Prozor sparivanja s Kokinim opisima mora ovisiti o IZVORU** (S114). Kartični retci traže
  nesimetričnih `−3 / +45` dana (upisuje ih na dan kupnje ili na dan naplate računa). Na
  **tekućem računu** ista tolerancija nije velikodušna nego opasna: `Cash 100,00` se ponavlja
  svakih par tjedana, pa bi prvi bankomat pokupio opis nekog kasnijeg — tiho, jer se iznos i
  dalje slaže. Ondje je njen datum bankin datum ⇒ `0 / +1`. ⚠ `+1` nije kozmetika:
  `Zoran povrat 9,51` je na izvodu 17.07., kod nje 18.07.
- **⚠ Isti događaj, različit BROJ redaka — ključ `(iznos, datum)` to ne vidi** (S114). Ona vodi
  jedan redak `Parking 1,40`, banka ga naplaćuje kao **dva** naloga po `0,70`. Nespareni retci
  onda nose strojni tekst izvoda (`Kreditni transfer nacionalni…`), koji u povijesti vodi na
  `Domaćinstvo / Bankovni troškovi` (12×) — dakle u **krivi razred, i to uvjerljivo**. Isti
  razred kao S111 skoro-duplikati, samo se ondje razlikovao iznos, a ovdje broj redaka.
- **⚠ Brojač koji nula pokušaja prikazuje kao nula rezultata** (S114). `zaba_rows()` je primao
  `koka` i nikad ga nije pozvao, a ispis je govorio `Kokini opisi: 0 spareno, 0 bez para` —
  što se čita kao „pokušano, ništa nije našlo". Svaki takav brojač mora razlikovati
  „nije pokušano" od „pokušano bez pogotka".
- **Klasificiraj iz IZBROJANE povijesti, ne iz teksta izvoda** (S114). `Tip`/`Podtip` se izvlače
  prebrojavanjem kako je **isti Kokin tekst** klasificiran u 4.992 retka Reviewa (Parking 118/118,
  T-com 40/41, Zoran povrat 41/41, MC naplata 31/31). Gdje povijest nije jednoglasna, odlučuje
  čovjek — ne skripta. ⚠ **Par se prije upisa mora provjeriti protiv `DropdownData` lista
  app-ovog exporta**: podtip mimo `validation_rules` uveze se kao običan tekst i **ne javi
  grešku** — vidi se tek kad ga dropdown poslije odbije, a tada je već u bazi.
  Alat: `klasificiraj_transu.py`.
- **Autoritet za iznos je izvod, za opis i klasifikaciju Kokin redak.** Njen lanac i bankov se
  razlikuju redak po redak a **slažu u zbroju** (oba daju `461,82` na 06.07.2026.) — višak na
  jednoj strani ima kompenzaciju na drugoj. Baza koja spoji oba izvora dobije **najgoru** od
  tri varijante: dvostruko brojanje ondje gdje se opisi razlikuju.
- **Ako izvor s odgovorom već postoji, ne izmišljaj heuristiku** (S113). Umjesto strojnog
  kraćenja opisa izvoda (`SUPER KONZUM P-3200 - RADNIČKA CESTA 1 - ZAGREB`) uzima se **Kokin
  tekst** (`Konzum`) sparivanjem po `(iznos, datum)`. ⚠ Prozor sparivanja mora biti
  **nesimetričan** (−3 / +45 dana): kartičnu kupovinu ona upisuje ili na dan kupnje ili na dan
  naplate kartičnog računa — oboje postoji u istom fileu. Sa simetričnih ±3 dana: 0 od 47.
- **Kokina Excelica ima DVIJE kolone datuma** (S113). `Datum` (C) je dan kad novac napusti
  račun; dok naplata nije poznata, C je **prazan**, a dan troška stoji u koloni **G**.
  Alat koji čita samo C ne vidi upravo najsvježije retke — one koje sljedeći kartični izvod
  tek donosi. (To je u našem modelu `Status = Planiran` + prazan `Datum naplate`.)
- **⚠ Kokin lanac salda gleda SAMO kolonu C, nikad `C or G`** (S116). Kolona G je dan
  troška i za još nenaplaćene kartične stavke **jedini** datum koji redak ima — ali te
  stavke račun još nisu teretile. Uzeti ih znači brojati buduće naplate kao dogođene:
  izmjereno `12.983,69` umjesto `13.239,31`, promašaj za točno njihov zbroj. Pravilo
  vrijedi samo za **lanac salda**; za `event_date` je obrnuto (D1b: dan kupovine ⇒ G).
- **⚠ Njen model tereti račun svakom kartičnom stavkom, naš jednom skupnom naplatom**
  (S116). Zbroj se poklapa u cent (45 MC stavki 11.08. = `1.332,52` = iznos s
  `MC_2026-07.pdf`), model ne. Uvezu li se njene kartične stavke s `Izvor = Racun`,
  saldo se **dvostruko** umanji — jednom po stavci, jednom skupnom naplatom. `Izvor`
  zato određuje **kolona A** njenog sheeta, a skupna naplata dolazi s izvoda.
  ⚠ Zato je i njen lanac koristan kao **svjedok**: dva modela koja broje različito, a
  daju isti broj, potvrđuju jedan drugoga. Isti broj iz istog modela ne potvrđuje ništa.
- **⚠ Njeni datumi znaju biti tipfeler u GODINI, i ne samo 2036.** (S116). Osim dva
  poznata retka iz `2036-04-08` postoji i `2028-05-16` (`HLK 5/26`). Alat ih **izdvaja
  i ispisuje**, nikad ne popravlja — ispravak ide u **njen** file (v. S115: popravak +
  uvoz udvostručuje redak tiho, jer pada prije sidra).
- **⚠ 103 njena retka nose datum kao TEKST, ne kao datum** (S116): `'11.05.23.'`,
  `'28.6.23.'`, `'29.2.2024.'` — neujednačeno, s točkom na kraju i dvoznamenkastom
  godinom. Svi su iz **2023.**, dakle batch 2023 ih mora parsirati ručno; alat koji
  prima samo `datetime` progutao bi ih **bez ijedne poruke**.
- **⚠ Usporedba imena računa mora ići preko normalizacije dijakritika** (S116). Njena
  kolona A piše `Kokin tekući` s kvačicama, a argument s komandne linije ih kroz
  `run.bat` zna izgubiti; obična `==` usporedba tada nađe **nula** redaka i alat javi
  „0 novih" — što se čita kao „nema što uvesti", a ne kao „nije ni uspoređeno"
  (isti razred kao S114 brojač). ⚠ Normalizacija je **samo za usporedbu**: vrijednost
  atributa `Racun` koja ide u bazu nosi dijakritike i mora se poklopiti u znak, inače
  redak završi pod novim, četvrtim računom — a pločica to prikaže kao uredan račun.
- **⚠ UVOZ NE POPRAVLJA KRIVO DATIRANE RETKE — dedup ih preskoči** (S123). Alat
  izbacuje iz generiranog filea sve što u bazi već postoji po `(datum, iznos)`, a
  kupovina s krivim `Datum naplate` ima **isti** `event_date` i iznos. Zato
  „uvezi tranšu pa popravi datume" ne radi: krivi datum preživi, a **i ciljna
  košara ispadne kraća točno za te retke** — dobiješ dvije neusklađene umjesto
  jedne. **Prvo ispravak, pa uvoz.**
- **⚠ RATA NIJE KUPOVINA i pravilo naplate se na nju ne smije primijeniti** (S123).
  Sve rate jedne kupovine dijele `event_date` = dan kupnje, a razlikuje ih plan
  otplate. Pravilo „MC = 11. sljedećeg mjeseca" proglasilo bi **21 vjerojatno
  ispravan redak** krivim i poslalo čovjeka da ih „popravi". `kosara_naplate.py`
  ih zato izdvaja u vlastitu dijagnozu umjesto da ih ocijeni.
- **⚠ ALAT KOJI NABRAJA PUTANJE RUČNO UMRE PRI PRVOJ SELIDBI FILEA** (S130).
  `primijeni_uskladu.py` je nosio hardkodiran popis izvoda koji je završavao na
  `MC_2026-07.pdf` **u korijenu** `izvodi/`; kad je taj u S129 prešao u
  `Analizirani_izvodi/`, skripta je padala na `FileNotFoundError` **prije ijedne
  provjere** — dakle bila je mrtva, a to ništa nije javilo dok je nitko nije pokrenuo.
  Popis se sada **nalazi sam** (glob preko obje lokacije, dedup po imenu).
  ⚠ Time se vidjelo i da je stari ručni popis pokrivao samo `2026-01..07` — dakle
  **2024. i 2025. nikad nisu bili u zadanom prolazu**, a to se iz koda čitalo kao
  „obrađeno je sve". Zadano sada nađe **32** izvoda i **67** ispravaka umjesto 46.
  ⚠ Vrijedi za svaki alat u `data-prep_tools/`: **mapa je izvor popisa, ne konstanta.**
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u fileu)
  ⇒ ubačeni redak mijenja ključeve svih redaka tog dana iza njega
- **⚠ BRISANJE PO KOMBINACIJI TRAŽI DA SVAKA KOMPONENTA IMA SVOJ REDAK** (S130).
  Provjera prije 1:N brisanja glasila je `all(any(…))`, pa je **isti** redak baze mogao
  zadovoljiti **dvije** komponente: kombinacija `1,60 + 1,60` prošla bi i da u bazi
  postoji **jedan** redak od `1,60` ⇒ agregat obrisan, a `1,60` ostaje nepokriveno.
  Izmjereno da danas takvih slučajeva **nema** (oba brisanja imaju različite retke), pa
  popravak **ne mijenja ishod** — zatvara rupu prije nego se otvori, jer je brisanje
  nepovratno. Isti oblik provjere vrijedi svugdje gdje se skup uspoređuje sa zbrojem.
- **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** (preskače `source_key`eve koji POSTOJE
  u Reviewu) → registar `V3 preskočeno` mora se čitati
- **openpyxl bilješka ruši uvoz u app** (S113). Kad openpyxl prepiše app-ov export,
  komentar ćelije završi kao `xl/comments/comment1.xml` s **apsolutnom** putanjom u
  relacijama; exceljs očekuje relativnu, ne nađe dio i padne s
  `Cannot read properties of undefined (reading 'comments')` — dakle **cijeli file je
  neuvoziv zbog jedne bilješke**. `fill_from_izvod.py` ih zato izbacuje iz radne kopije i
  **ispiše tekst**: original izvoza ih čuva, a podrijetlo otvarajućeg stanja ne smije nestati bez traga.
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

- **⚠ REDAK LISTE RENDERIRAJU DVA MJESTA, I LAKO SE POPRAVI SAMO JEDNO** (S125).
  `ActivitiesTable` crta desktop redak kroz `cellContent('actions')`
  (`tr.hidden.sm:table-row`) i uski redak kroz vlastitu sticky ćeliju
  (`tr.sm:hidden`). Oznaka ✎ dodana je samo u drugo — pa se **vidjela na mobitelu,
  a ne na desktopu**, i to je tri sesije vođeno kao „E2E okolina" (Playwright vrti
  1280 px). Nalaz je cijelo vrijeme bio točan; tražilo se na krivom mjestu.
  ⚠ **Komentar je odveo na krivi trag:** tvrdio je „stoji na oba rasporeda" dok je
  kod radio jedan. Isti razred kao PROD slug trigger (S118) — komentar koji opisuje
  **namjeru** čita se kao opis koda. Svaka nova ćelija retka mora se provjeriti na
  **obje širine**, i test to mora mjeriti mijenjanjem viewporta.
- **⚠ KEŠ MORA SLUŠATI ONOGA TKO GA ČINI ZASTARJELIM — inače je invalidacija samo**
  **komentar** (S132). `useCategoryChain` sprema **cijeli lanac, uključujući `settings`**,
  u `sessionStorage` bez TTL-a, a `resolveEventNote` odande čita `comment_template`.
  `refetch` je postojao od početka i nosio napomenu „called after Structure edits" —
  a **nitko ga nikad nije zvao**: oba pozivatelja (`AddActivityPage:616`,
  `EditActivityPage:558`) destrukturiraju samo `chain`/`loading`/`error`. Signal je
  sve vrijeme postojao: `areas-changed` dispatchaju i Structure panel i Structure import.
  ⚠ **`sessionStorage` PREŽIVI F5** — gasi se tek zatvaranjem kartice. Zato je kvar
  izgledao neuklonjiv: izmjereno na PROD-u 09.09.2026., template obrisan i u
  `areas.settings` i u `categories.settings` (potvrđeno Structure exportom **i** s oba
  Edit panela), a Finish ga je i dalje upisivao. Dvije hipoteze prije toga („uvoz nije
  prošao", „template je na leafu") bile su krive; opovrgnulo ih je **mjerenje**, ne
  razmišljanje — presudan je bio placeholder `e.g. {napomena} ({tip})` umjesto
  `Inherited: …`, koji dokazuje da ni Area nema template.
  ⚠ **PRVI LIJEK JE BIO POGREŠAN, i to se vidjelo tek mjerenjem** (S133). S132 je
  listener stavio **u hook** i nazvao ga invarijantom. Nije: `useCategoryChain` je
  montiran samo na `/app/add` i `/app/edit/:s`, a **svaki** dispatcher `areas-changed`
  živi u `AppHome` (`/app/`) — Structure panel, StructureTableView, Excel modali.
  U trenutku kad signal ode, hook **ne postoji**, pa listener nije ni vezan.
  Izmjereno na PROD-u 10.09.2026.: template upisan u `categories.settings`
  (`TEST132 {tip}/{podtip}`, potvrđeno REST-om), a Finish napravio event s
  `comment = null`.
  ⚠ Razred je bio **zapisan u kodu prije nego smo u njega upali**: `AppHome:507`
  nosi komentar „Filter Content — always mounted so areas-changed listener stays
  active", a `categoryCache.ts:78` radi module-level registraciju od početka.
  **Pravilo: listener koji čuva keš ide na razinu MODULA, nikad u hook** —
  `clearChainCache()` briše sve `chain_v1_*` ključeve na `areas-changed` i
  `structure-deleted`. Listener u hooku ostaje, ali samo da osvježi `chain` u
  React stateu dok je Add/Edit otvoren; on nije brana.
  ⚠ **Ključevi se PRVO skupe pa brišu.** `removeItem` usred petlje po indeksu
  pomakne preostale za jedno mjesto ⇒ preskoči se svaki drugi, bez ijedne greške
  (razred „paginacija bez `.order()`", S108).
  ⚠ Popravak **ovisi o tome da rute nisu lazy-loadane** (`App.tsx:12-13` su statički
  importi). Uvede li se ikad code splitting — a `vendor-plotly` je 4,9 MB, pa je to
  živa stavka u backlogu — `clearChainCache` mora u modul koji se učitava bezuvjetno.
  ⚠ Keš ne hrani samo `comment_template`: `categoryChain.map(c => c.id)` gradi **P2
  parent evente** (`AddActivityPage.tsx:1178`), pa bi stara snimka nakon renamea ili
  premještanja upisala roditelje po **staroj** hijerarhiji.
  Čuva `src/hooks/__tests__/categoryChainCache.test.mjs` (vrti pravi kod hooka nad
  React shimom; 12 testova, bez module-level listenera pada 4).
  ⚠ **Test MORA odmontirati hook prije dispatcha** — S132 verzija je dispatchala dok
  je hook montiran, pa je prolazila nad kodom koji u aplikaciji ne radi ništa.
- **⚠ KLJUČ U `localStorage` BEZ OZNAKE BAZE SPAJA TEST I PROD — I APLIKACIJA IZGLEDA
  POKVARENO** (S140, Sašin nalaz). `FilterContext` je pamtio filtar pod golim ključem
  `events-tracker-filter-state`, a u njemu stoje **`areaId` i cijeli `selectionChain`**
  (objekti kategorija, **s imenima**). Ključ nije nosio ref projekta, pa su `npm run dev`
  (TEST) i `dev:prod` (PROD) dijelili **isti zapis**.
  Izmjereno 18.09.2026.: nakon rada na PROD-u, TEST je pokazivao `Unknown > Transakcija`,
  **praznu listu** i traku „Nisam uspio učitati postavke ove Aree” — a „Pokušaj ponovno”
  nije pomagao, jer PROD-ov `areaId` na TEST-u **nikad neće postojati**
  (PROD `Transakcija` = `986a4612…`, TEST = `cde31231…`).
  ⚠ **Ime kategorije se vidjelo IAKO tog retka nema**, jer dolazi iz spremljenog
  `selectionChain`-a, ne iz baze. Zato simptom izgleda kao **kvar čitanja**, a ne kao stara
  snimka — i zato je dijagnoza tri puta krenula prema bazi. Baza je bila zdrava: `areas`
  16 redaka, **0 padova u 8 pokušaja**, 0,22–0,91 s.
  ⚠ **Traka o grešci je ovdje LAGALA**: `withRetry` iz S121 ispravno javlja da čitanje nije
  uspjelo, ali uzrok nije mreža nego **id koji ne postoji**. Poruka koja upućuje na
  ponavljanje, a ponavljanje ne može pomoći, šalje na krivi trag.
  Zatvoreno **sprječavanjem**: `dbScopedKey()` (`src/lib/storageKey.ts`) lijepi ref projekta
  na ključ i **jednom obriše stari, neograničen ključ** — inače bi zauvijek ležao u
  pregledniku i čekao sljedeću zabunu.
  ⚠ **`et_activity_draft` je ISTI RAZRED i namjerno NIJE diran** — dva E2E speca ga tvrdo
  kodiraju (`S121_draft_after_finish`, `S122_no_phantom_draft`). V. Backlog.
  ⚠ Ostali ključevi su pregledani i bezopasni: `ui:collapsedAreas` (stari id samo ne radi
  ništa), `attrExpanded:<catId>` (već nosi id), `et_shortcuts_area_only` (boolean).
- **⚠ ONO ŠTO PREGLEDNIK PREBROJI OGRANIČENO JE NA 1000 REDAKA — I TO JE BRAVA,**
  **NE BROJKA** (S133). `useStructureData` je vukao `events?select=category_id` bez
  `.range()` i bez `.order()` pa brojao u JS-u; PostgREST reže na 1000 **bez greške**.
  Izmjereno 10.09.2026.: PROD **1000 od 12.199**, TEST **1000 od 3.727** — dakle
  brojka je računata nad 8–27 % podataka i ispisana kao da je cijela.
  ⚠ Posljedica nije kozmetička: `node.eventCount` je **brava**
  (`StructureAddChildPanel:123` ne da dodati dijete leafu koji ima evente, S24).
  Lažna nula je otključava, bez ijedne poruke. `StructureDeleteModal` je bio pošteđen
  jer već radi vlastiti `count: 'exact'` — **isti obrazac koji je ovdje falio**.
  Lijek: jedan `count: 'exact', head: true` po kategoriji, **usporedno**. Izmjereno
  s aktivnim RLS-om: 39 kategorija, 127 ms po upitu — serijski 4,95 s, **usporedno
  0,46 s**, zbroj točan u redak.
  ⚠ Neuspjelo brojanje se **ne čita kao nula** (`withRetry` pa throw) — tiha nula je
  upravo ono što otključava bravu.
  ⚠ RPC s `GROUP BY` je odbačen **zasad, ne zauvijek**: dok su kategorije u desecima
  ovo je jeftinije jer nema migracije; narastu li na stotine, RPC. PostgREST agregati
  (`id.count()`) **nisu opcija** — projekt ih odbija s `PGRST123`.
  ⚠ **Prva verzija testa nije čuvala ništa**, i uhvatila ju je samo protuprovjera:
  tvrdila je da leaf s eventima nema značku `no events yet`, a na TEST-u ta kategorija
  ima 3.624 od 3.727 eventa ⇒ odrezanih 1000 redaka je ionako gotovo sve njeno, značka
  izostane i nad pokvarenim kodom. Mjeri se **ispisan broj**, ne značka.
- **⚠ BROJAČ KOJI BROJI PARSIRANE RETKE PRIKAZUJE POSAO KOJI SE NIJE DOGODIO** (S132).
  `List columns 8` u Structure import modalu znači „sheet je imao 8 redaka", ne „8 se
  promijenilo": `columnsImported++` ide **prije** usporedbe, a `JSON.stringify` jednakost
  i `continue` tek poslije (`structureImport.ts:1333` pa `:1340`). Obrnuto od S114 zamke
  („nula pokušaja prikazana kao nula rezultata") — ovdje nula promjena izgleda kao osam.
  ⚠ Suprotno tome, **`Settings updated` se renderira SAMO kad je > 0**
  (`StructureImportModal.tsx:266`) — njegova **odsutnost je podatak**: settings se nisu
  promijenili. To je jedini pouzdan signal je li uvoz dirnuo `comment_template`.
- **⚠ `e.target === e.currentTarget` NA `onClick` NIJE „kliknuto je na pozadinu"** (S134).
  `click` se okida na najbližem **zajedničkom pretku** elemenata na kojima su se
  dogodili `mousedown` i `mouseup`. Povuče li korisnik selekciju iz polja unutar
  modala i otpusti miš izvan njega, taj predak je **upravo pozadina** — pa se
  modal zatvori, s nespremljenim izmjenama. Prijavljeno kao *„kad brzo nešto
  selektiram, izleti mi iz Edit ekrana bez izmjena"*; zvuči kao nespretnost, a
  **gubitak je rada**. Obrazac je bio prepisan u **14** modala.
  Lijek je `useBackdropClose` — pamti gdje je pritisak počeo **i** gdje je
  završio; zatvara samo ako su oba bila na pozadini.
  ⚠ `mouseup` se prati **zasebno** iako se čini suvišnim uz `click`: iz
  `click.target` se ne vidi je li miš otpušten na pozadini ili u panelu, jer je
  on već zajednički predak. Bez toga pritisak na pozadini s otpuštanjem u panelu
  i dalje zatvara — **uhvaćeno testom, ne razmišljanjem**.
  ⚠ Lijek **nije** `stopPropagation` na sadržaju — to lomi klikove koji
  legitimno moraju doći do pozadine.
  ⚠ `CategoryChainRow` zove hook **na vrhu komponente**, ne u JSX-u: ondje je
  modal renderiran uvjetno, pa bi to bio **uvjetan poziv hooka** ⇒ *„Rendered
  fewer hooks than expected"* i srušen render, i to tek pri prvom otvaranju.
  Čuva `src/hooks/__tests__/backdropClose.test.mjs` (protuprovjera pada 3/6).
- **⚠ UVJETNI OMOTAČ OKO POLJA GUBI FOKUS USRED TIPKANJA** (S131). `renderAttribute` je
  birao **između dva različita elementa** — goli `AttributeInput` ili `<div>` oko njega
  (`revealed ? <div>{input}</div> : input`). React na promjeni **tipa** elementa na istom
  mjestu odmontira podstablo i montira novo, pa se `<input>` DOM čvor **uništi i stvori
  nanovo**, a s njim ode **fokus**. `revealed` se prevrće na **prvi utipkani znak**
  (`userEditedIds` dobije atribut, i vrijednost prestane biti jednaka defaultu) — dakle
  točno usred tipkanja. Izmjereno na PROD-u: u „Show all" upišeš `2,8` u prazan
  `aerobic_effect`, ostane **`2`**; drugi pokušaj radi jer je atribut već u `userEditedIds`.
  Zato je izgledalo nasumično. ⚠ **Nije bug polja za broj** — pogađa **svaki** tip atributa;
  na broju se vidi kao izgubljena decimala, na tekstu kao skraćena riječ, i korisnik to
  pripiše svojim prstima. Lijek: omotač se **uvijek** renderira, mijenjaju se samo klase,
  a oznaka ide kao `{revealed && …}` da slot djeteta ostane stabilan.
- **⚠ PRAZAN STRING NIJE DEFAULT — `'' == null` je `false`** (S131). Uvjet
  `attr.default_value == null` propuštao je svako prazno polje s `default_value = ''` i
  proglašavao ga „na svom defaultu" (`'' === ''`) ⇒ **skriveno**. Time je skrivanje-na-defaultu
  radilo posao zbog kojeg je `hidden_in_add` uopće izmišljen, i tiho poništavalo podjelu
  odlučenu u **S117**: *hide-at-default* skriva polje koje **ima** vrijednost jednaku
  defaultu, *`hidden_in_add`* polje čija je **ispravna vrijednost prazna**. Izmjereno na
  PROD-u: **14** atributa s `''`, **svi u `Fitness`**, nijedan s `hidden_in_add`; sva **3**
  `hidden_in_add` su u `Financije_all`. Mehanizmi se u podacima nigdje ne preklapaju —
  preklapao ih je samo taj uvjet. ⚠ Uvjet živi na **tri** mjesta (`isHiddenByDefault`,
  `isRevealedOnly`, `requiredParentSlugs`) i mijenja se **zajedno**.
- **⚠ `<input type="number">` PREPUŠTA DECIMALNI SEPARATOR PREGLEDNIKU** (S131), pa se isti
  build drukčije ponaša na dva uređaja. Gore od nedosljednosti: kad preglednik odbije znak,
  `e.target.value` je `''`, a kod je to mapirao u `null` ⇒ **iznos tiho nestane**. Polje je
  sada `type="text"` + `inputMode="decimal"` + `parseAmountInput` (prima `1.234,56` i
  `1234.56`), a neprepoznat unos **pocrveni**. ⚠ `hr-HR` formatiranje daje minus **U+2212**
  (`−`), koji `Number()` ne prima i koji se ne tipka — prikaz mora vratiti obični `-`, a
  parser primiti oba (`formatSigned` isto koristi U+2212, pa se vrijednost zna zalijepiti
  iz liste). ⚠ Polje za unos **ne formatira** (bez tisućica, bez dopune nula, bez
  zaokruživanja): zaokruživanje u prikazu prije ili kasnije zaokruži i pri spremanju.
  Novac na 2 decimale živi u **ulogama kolona liste**, ne u polju.
- **⚠ NEUSPJELO ČITANJE NIJE „NEMA NIČEGA" — i to je danas tri puta zaredom bio isti bug**
  (S121). Pravilo je već stajalo uz RPC (`last_on`), ali se krši svugdje gdje loader ima
  granu za grešku. Izmjereno na PROD-u: **jedno** palo čitanje `areas` ugasilo je Overview
  tab, kratice računa, iznose **i** „Write access" baner — i to **trajno**, jer nijedan od
  dva loadera ne ponavlja, a oba se re-runaju tek kad se promijeni Area. F5 je sve vratio;
  podaci su cijelo vrijeme bili netaknuti (`settings` sa svih 6 ključeva, share aktivan,
  upit 0,18–0,27 s).
  ⚠ **Gore od nestalog taba:** `disableSavePlus` čita `selectedArea?.settings?…`, pa je
  `null` area vratila **`Save +`** u Financije gdje je namjerno ugašen — app se nije samo
  drukčije prikazivao nego i **drukčije ponašao**, bez ijedne poruke.
  Lijek u tri koraka: `withRetry` (`src/lib/retry.ts`), zadrži već učitano **za istu Areu**
  (za drugu čisti — tuđe kolone su gore od nikakvih), i **reci naglas** trakom.
  ⚠ **`supabase` NE odbija promise na neuspjeh** — vraća `{ data, error }`. `try/catch` oko
  `await supabase.from(...)` zato ne hvata ništa; to je razlog zašto su ovi kvarovi bili
  nevidljivi. `withRetry` uzima `isFailure` predikat baš zbog toga.

- **⚠ ZASTAVICA KOJA ŠTITI STANJE IZ KONTEKSTA MORA ŽIVJETI U KONTEKSTU** (S129).
  `DateRangeFilter.userModified` je bio lokalni `useState`, a čuvao je
  `filter.dateFrom/dateTo` iz `FilterContext`. Svaki unmount ga je vratio na `false`,
  ponovo naoružao bounds auto-init i bacio raspon na **„All time"**. Dva živa puta:
  **Structure tab** (`AppHome`: `activeTab !== 'structure'`) i **View Details**
  (cijeli `AppHome` se odmontira). S120 je taj razred zatvorio za `attrFilter`, a
  datumski raspon je ostao vani — pa je izgledalo „povremeno", a ovisilo je o tome
  je li čovjek usput svratio na Structure.
  Lijek nije još jedan `hidden` uvjet nego **izvođenje iz konteksta**:
  `const userModified = filter.periodKey !== 'all-time'` — `periodKey` je već ondje i
  održava ga **svaki** setter. ⚠ Usput je time vjerojatno popravljeno i to što je
  auto-init smio prepisati raspon koji je **shortcut** upravo vratio (`handleShortcutSelect`
  zove `setDateRange` iz konteksta, što lokalnu zastavicu nije dizalo) — neprovjereno.
- **⚠ BROJKA I SAŽETAK MORAJU OPISIVATI FILE KOJI IZLAZI, NE PANEL** (S129).
  `ExcelExportModal` je u kutiji „Active filters" pokazivao `filter.dateFrom`, a
  profil s `periodKey` je taj raspon **prepisivao** (`applyProfileFilterOverrides`) —
  dakle dvije linije koje si proturječe i nijedna ne kaže tko pobjeđuje. Isti razred
  kao BUG-S123-DELTAACCT: file izađe uredan, s krivim retcima, bez ijedne poruke.
  Isto je vrijedilo za **brojku**: `5.154 events will be exported` za file koji ih ima
  **387** (izmjereno s profilom `Kokin_format`, `last-3-months`).
  Sada oboje ide kroz efektivne filtre; brojač usput dobiva `commentSearch` i
  `attrFilter` u dep listu, koji su ondje **falili** — promjena filtra komentara
  ostavljala je **staru brojku**, koja izgleda kao odgovor.
  ⚠ Prekidač „Koristi filtre iz profila" je **JEDAN, ne dva**: sort nikad ne mijenja
  *koji* su retci u fileu, samo njihov redoslijed — a prekidač čije krivo stanje nema
  posljedicu uči čovjeka da prekidače ne čita, pa onda ni onaj koji je ima. Zadano je
  **uključen** (dosadašnje ponašanje) i **resetira se pri svakom otvaranju modala**,
  da otkvačeno stanje ne može ostati ležati i tiho ugristi sljedeći mjesec.
  ⚠ Prekidač **mora biti proveden i kroz `deriveDeltaAccount`** — inače eventi dolaze
  iz panela a račun iz profila, presjek je prazan, i delta sheet izađe s **točnim
  sidrom i nula redaka**.
- **⚠ Ista radnja na dvije širine živi na DVA mjesta** (S129). Activities Excel
  Import/Export: uski ekran ih crta u redu s tabovima (`sm:hidden`, `AppHome`), široki
  uz listu (`hidden sm:flex`, `ActivitiesTable`). Tko makne jedan uvjet mora maknuti i
  drugi — inače se gumbi **udvostruče ili nestanu**. Isti razred kao „redak liste
  renderiraju dva mjesta" (S125).
- **⚠ AUTOMATSKI POPUNJENA FORMA NIJE KORISNIKOV SADRŽAJ** (S122). Add Activity se pri
  otvaranju sam napuni defaultima (`default_value`, preset, `default_map`), a auto-save je od
  S121 stvarno počeo raditi ⇒ nacrt se pisao i za forme koje nitko nije dotaknuo. Otvori Add
  → 6 s → back gumb → sljedeći Add nudi **„Resume Previous Session?"** nad nacrtom bez
  ijednog korisnikovog znaka (izmjereno na PROD-u, `Events: 0`). Šteta nije u podacima nego u
  **značenju dijaloga**: poruka koja treba značiti „tvoj nedovršen unos je preživio" počne
  iskakati kad ništa nije uneseno, a upozorenje koje laže korisnik nauči otklikati bez čitanja.
  ⚠ Guard **ne smije** biti izračun iz stanja: `canSave` je za netaknutu formu **već `true`**
  (defaulti nose `touched: true`). Pitanje nije „ima li vrijednosti" nego „**je li ih čovjek
  dirao**" — a to zna samo handler kroz koji je promjena prošla (`userTouchedRef`,
  `AddActivityPage.tsx:565`). Zastavicu diže atribut/komentar/fotografija/datum/`Save +`/Resume;
  **ne diže je** nijedan efekt koji puni defaulte ni `set_attribute`.
- **⚠ `async` funkcija pozvana bez `await`/`.catch()` guta svoju grešku u tišini** (S121).
  `FilterContext.resolve()` je bio fire-and-forget: padne li bilo koji `await` unutra,
  `setState` se nikad ne pozove i stanje ostane na početnoj vrijednosti — što se čita kao
  legitiman odgovor. Svaki `resolve()`/`doRestore()` obrazac mora imati `.catch()`.

- **⚠ Inline lambda u opcijama hooka ubija svaki `setInterval` u tom hooku** (S121,
  BUG-S121-AUTOSAVE). `useLocalStorageSync({ onError: (err) => … })` — nov identitet na
  svakom renderu ⇒ `saveDraft` i `setupAutoSave` novi ⇒ efekt koji ih drži re-runa se na
  svakom renderu i **ruši interval prije nego istekne**. Štoperica renderira jednom u
  sekundi (i kad je `add_header.timer: false` sakriva — `useSessionTimer` tiktače svejedno),
  pa auto-save **nikad nije opalio tijekom unosa**. Izmjereno: `Stopping / Setting up
  auto-save` jednom u sekundi, 30 puta u 30 s.
  ⚠ **Jedini tik u životu tog intervala padao je POSLIJE Finisha** — jer `endSession()`
  zaustavi štopericu, renderi prestanu, i zadnji postavljeni interval konačno preživi do
  kraja. Dakle jedino što je auto-save ikad napravio bilo je da **vrati nacrt koji je
  `clearDraft()` upravo obrisao** ⇒ „Resume Previous Session?" ⇒ **duplikat** (2,70 €
  dvaput, `session_start` 09:51 i 09:53).
  Lijek: `onError` u `useCallback`, `getDraftData` u ref (inače svaki tipkani znak resetira
  odbrojavanje), interval se naoruža **jednom po sesiji**.

- **⚠ Brisanje stanja mora ugasiti i stroj koji ga vraća — invarijanta, ne disciplina**
  (S121). `clearDraft()` se zove s **5 mjesta**; da je gašenje auto-savea ostalo na pozivnim
  mjestima, šesto bi ga zaboravilo. Zato `clearDraft()` sam zove `haltAutoSave()`.

- **⚠ Auto-save piše u `localStorage`, NE u bazu.** Nula mrežnog troška; nacrt bez
  fotografije je **383 B**. Zato je 5 s jeftinije nego što zvuči — ali upis se **preskače
  kad se sadržaj nije promijenio**, inače bi nacrt s 5 MB base64 fotografije bio iznova
  serijaliziran svakih 5 s, a `updatedAt` bi se resetirao pa bi dijalog tvrdio „just now"
  za sesiju koju nitko ne dira.


- **⚠ Efekt s dependency arrayem OKIDA SE I PRI MONTIRANJU** (S119 → popravljeno S120).
  `useEffect(..., [a, b])` ne znači „kad se `a` ili `b` promijene" nego „na mount **i** kad se
  promijene". `AppHome` se odmontira na svakom odlasku u `/app/view/:sessionStart`, pa je
  njegov „resetiraj filtar kad se promijeni Area/kategorija" brisao `attrFilter` **pri svakom
  povratku** iz View Detailsa. Izmjereno: odlazak s `MjeraRacun = ZABA-MJERA`, povratak na
  `Filter by = Comment` bez ijednog polja. **Drugi put isti razred u dvije sesije** (S111:
  `DateRangeFilter` auto-init). Lijek: usporedi s **prethodnom** vrijednošću u `useRef`, prvi
  prolaz samo zapamti. Čuva ga `e2e/tests/e16-filter-persistence.spec.ts`.

- **⚠ Uvjetno renderirana komponenta gubi lokalno stanje pri svakom skrivanju** (S111).
  `DateRangeFilter` je bio montiran samo uz `activeTab === 'activities'`; svaki prolaz kroz
  Overview ga je odmontirao, resetirao njegov `userModified` flag i pustio auto-init iz
  `useDateBounds` da **prepiše korisnikov raspon s „All time"**. Izgledalo je kao povremeni bug
  („često se resetira"), a bilo je deterministično. Filter panel je namjerno uvijek montiran
  (`hidden` klasa, ne uvjet) — isto vrijedi za sve što drži stanje.
- **Nedostajuće polje iz RPC-a ne smije se čitati kao „nema ničega".** Kad `038` nije pušten,
  `last_on` je `undefined` ⇒ `null` — isto kao „ništa poslije sidra". Zato uvjet u
  `BalanceByGroupTile` glasi `row.last_on || row.n === 0`: neistina je gora od izostanka.
- **⚠ `scroll` LISTENER S `capture: true` NA `window` HVATA SVAKI UGNIJEŽĐENI SPREMNIK**
  (S136). `CategoryChainRow` je ⋮ meni zatvarao na svaki `scroll`, uz obrazloženje „meni je
  `fixed` pa bi inače odlutao" — točno, ali lijek prestrog: `capture` propušta i scroll koji
  s menijem nema veze (pomak sadržaja ispod njega, preglednikov `scrollIntoView`, inercija
  trackpada), pa je stavka nestajala **ispod prsta**. Korisnik to vidi kao „meni mi se sam
  zatvorio"; tri E2E speca (`e7`, `e13`, `e15`) padala su točno tako — meni se dokazano
  otvori (`button "Actions" [active]`), pa stavka **unutar** njega nestane.
  ⚠ Lijek je **premjestiti, ne zatvoriti**: pozicija se preračuna iz žive
  `getBoundingClientRect()` gumba. Time se uklanja **razred**, pa više nije važno *tko* je
  scrollao — a to je bilo jedino otvoreno pitanje u dijagnozi (hipoteza o asinkronim S133
  značkama nikad nije izmjerena). Drift zbog kojeg je zatvaranje uvedeno tada ne može nastati.
  ⚠ **Vrijedi za svaki budući `fixed` element usidren uz redak** (portal meniji, tooltipovi):
  usidrenje traži **praćenje**, a zatvaranje je krinka za to da se ne prati.

**Alati koji mjere nesto drugo nego sto mislis (S139)**

- **/!\ ESLINT JE LINTAO `Claude-temp_R/OLD/` — CIJELE STARE KOPIJE PROJEKTA.** ESLint 9
  **ne cita `.gitignore`**, a config je ignorirao samo `dist`. Od 189 prijavljenih problema
  **142 (75 %) dolazilo je odande**. Posljedica nije bio sum nego **kriva dijagnoza**: audit od
  16.09.2026. je 76 `react-hooks` nalaza pripisao zivom kodu (zivih je **25**), a
  `DateRangeFilter.tsx` — file iz S111 incidenta — po toj je brojci izgledao najgori (8),
  dok ih u njemu danas **nema nijedan**. Zatvoreno u `eslint.config.js` (`globalIgnores`).
  /!\ Pravilo sire od ESLinta: **alat koji sam bira sto ce citati mora se pitati STO JE
  PROCITAO**, ne samo koliko je nasao. Repo koji drzi stare kopije pored zivog koda je zamka
  za svaki takav alat (grep, lint, brojanje redaka).
- **/!\ TEST KOJI NE MOZE PASTI IZGLEDA ISTO KAO TEST KOJI PROLAZI.**
  `structureExcel.test.mjs` je brojao padove u `failed` i **nikad ga nije procitao** — pa je
  ispisivao kriz i zavrsavao s `exit 0`. Izmjereno sabotazom jedne tvrdnje: exit ostao **0**.
  Zaglavlje filea sazetak obecava od pocetka; otpao je s istim S17 rezanjem koje je odrezalo
  tvrdnje, a S137 je vratio tvrdnje ali ne i nacin da se pad vidi.
  ⇒ `scripts/run-unit-tests.mjs` zato „ispis pada + exit 0" prijavljuje kao **POKVAREN TEST**.
- **/!\ `audit_tests.py` je prijavljivao 22 proturjecnosti kojih NEMA.** Kurirani popis
  „Otvoreno:" ukinut je u S116, a alat je marker citao kao **prazan popis**, pa je svaki
  otvoren redak prijavljivao kao razilazenje. Audit ga je preuzeo kao nalaz o dokumentu.
  /!\ Upozorenje koje uvijek pali covjek nauci preskakati — pa onda ne vidi ni ono pravo.
- **/!\ NACELO „KOLONA KOJE NEMA NE DIRA SVOJU POSTAVKU" NE DOSEZE U `validation_rules`**
  (S139). `structureImport.ts:874-879` to nacelo provodi za Area postavke — `hasSavePlusCol`,
  `hasAddTimerCol`, `hasAddDateCol`, `hasCommentTplCol` — i **radi**. Ali `hidden_in_add` ne
  zivi u vlastitoj postavci nego **unutar `validation_rules`**, a taj se na UPDATE-u prepisuje
  **u cijelosti** (`:858`). Dakle Structure file bez kolone `HiddenInAdd` daje `newRules` bez
  tog kljuca ⇒ `rulesDiff` je `true` ⇒ UPDATE opali ⇒ **zastavica se tiho obrise**.
  Izmjereno po konstrukciji, ne pretpostavljeno: `findCol` vraca `0`, `get(0)` vraca `''`,
  `'' === 'TRUE'` je `false`, a `buildValidationRules` kljuc tada uopce ne doda (`:413`).
  ⚠ **Bilo je dohvatljivo:** `make_financije_all_structure.py` je imao popis od 19 kolona uz
  komentar „redoslijed kao u app exportu" — a kod ih ima 23. Sva **tri** `hidden_in_add`
  atributa u bazi su bas u `Financije_all`, dakle u Arei koju taj alat generira.
  Zatvoreno u alatu (kolona dodana, S139); **uvoz nije diran** — v. Backlog.
  ⚠ Suprotno vrijedi za `DisableSavePlus`: ondje prazno **legitimno znaci FALSE**, pa bi
  dodavanje kolone bez tocne vrijednosti ugasilo zabranu `Save +`. Izostanak je ondje
  ispravan, a prisutnost opasna — dakle „popis kolona mora biti potpun" je **kriva** pouka.
  Tocna je: **za svaku kolonu provjeri sto uvoz radi kad je NEMA.**
- **`react-hooks` ratchet je od S139 na NULI ⇒ svaki nov nalaz ruši CI.** Do tada je bio
  „ne smije rasti"; sada je „ne smije postojati". Baseline: `.lint-baseline.json`.
  ⚠ **Od 26 nalaza nijedan nije bio kvar koji se vidi** — 12 `exhaustive-deps` je
  popravljeno (nijedan nije zastarijevao, ali svaki je bio **mina** koju aktivira prva
  memoizacija), a 14 `set-state-in-effect`/`immutability` su **legitimni obrasci** i nose
  `eslint-disable` s imenom obrasca. Pet obrazaca, da se ne prepričavaju uz svaki redak:
  | obrazac | zašto efekt | primjer |
  | --- | --- | --- |
  | `objectURL` | `createObjectURL` **traži** cleanup | `PhotoUpload`, `PhotoGallery` |
  | `async-u-stanje` | podatak stiže iz mreže, ne iz propsa | `ShareManagementModal`, `ViewDetailsPage` |
  | `citanje-okoline` | `window`/`localStorage`/`hash` se ne smiju čitati u renderu | `AuthPage`, `PhotoUpload` |
  | `reset-na-promjenu-ulaza` | promjena kategorije mora očistiti formu | `AttributeChainForm` |
  | `kontrolirani-sync` | vrijednost dolazi izvana, guard je `useRef` | `AttributeInput` (S131) |
  ⚠ **`disable` je tvrdnja „pregledao sam ovo"**, pa uz njega ide i brana koja javi kad
  tvrdnja prestane vrijediti: `reportUnusedDisableDirectives: "error"`.
  ⚠ **Jedan `disable` NIJE „obrazac" nego zabrana popravka:** `useActivities.ts` dep lista
  **ne smije** dobiti `attrFilter` kao objekt (lint ga traži) — iz konteksta dolazi kao nov
  objekt ⇒ refetch češće nego treba. Tri polja su iscrpna; doda li `AttrFilterState` četvrto,
  listu treba proširiti **ručno**, jer lint ondje više ne gleda.

- **Sto je od ovoga BRANA, a ne izvjestaj:** `npm run check` = `typecheck` + `test:unit` +
  `lint:ratchet`; CI ih vrti **i na `test-branch`** (do S139 se okidao samo na `main`, dakle
  tek kad kod vec ide na PROD). Ratchet gadja **samo dva** `react-hooks` pravila — gate koji
  obuhvaca i kozmetiku nauci covjeka da ga zaobilazi. Baseline: `.lint-baseline.json`.

**E2E (Playwright)**

- **⚠ E2E PREUZME DEV SERVER KOJI VEĆ STOJI NA 5173 — I TO MOŽE BITI PROD** (S133).
  `playwright.config.ts` ima `reuseExistingServer: true` i `baseURL: localhost:5173`.
  Vrti li se ondje `npm run dev:prod`, Playwright **ne podiže svoj TEST server nego
  preuzme PROD**, ubrizga TEST sesijski token i krene. Izmjereno 10.09.2026.: server
  na :5173 servirao je `zdojdazosfoajwnuafgx` (PROD), a `.env.testing` pokazuje na
  `xtnbhmojmffjelsqejpw` (TEST).
  ⚠ Tog puta je stalo na login ekranu — ali **spec koji se uspije prijaviti radio bi
  stvarne izmjene na PROD-u**, a u izlazu Playwrighta **nigdje ne piše na koju bazu
  gađa**. Jedini znak je banner u samoj aplikaciji, koji nitko ne čita u CI izlazu.
  ⚠ Gore: `global-setup.ts` ima **vlastitog** klijenta iz `.env.testing`, pa čisti
  TEST i kad preglednik gleda PROD — dvije polovice runa gledaju **različite baze**.
  ✅ **ZATVORENO S134** (`assertServedBuildIsTest`): `global-setup` dohvati modul koji
  nosi Supabase klijent (`/src/lib/supabaseClient.ts`) i pročita **koji projekt Vite
  ondje inlinea** — dakle mjeri što će preglednik **stvarno** dobiti, ne što config
  tvrdi. Server koji **ne odgovara nije greška** (Playwright tada diže svoj); staje
  samo na odgovor s krivim projektom.
  ⚠ Provjereno nad živim serverom: 10.09. je na :5173 stajao `vite --mode prod` i
  guard je bacio. **Disciplina više nije jedina brana, ali `dev:prod` i dalje ugasi**
  — inače E2E jednostavno neće krenuti.
- **⚠ PONOVLJEN POJEDINACNI RUN MJERI BAZU KOJU JE PRETHODNI RUN PROMIJENIO** (S139).
  `global-setup.ts` vraca seed stanje **na pocetku runa**, nikad izmedju specova — pa
  ciljano ponavljanje jednog speca radi dijagnoze krece od stanja koje je ostavio
  prethodni. Izmjereno istog dana: u punom runu (71 test) `e5-structure` pada **1 od 5**
  (E5-3); nakon tri uzastopna `e7-share` runa — a on poziva i opoziva pristup — isti
  `e5-structure` pao je **5 od 5**.
  ⚠ Smjer je suprotan od poznatog artefakta: dosad je vrijedilo „spec sam prolazi, u
  paketu pada". Ovdje spec **u paketu prolazi, a sam pada** — dakle „pustit cu ga samog
  da vidim je li stvaran" je potez koji moze **proizvesti** pad koji dijagnosticira.
  ⇒ Usporedba dvije verzije koda radi se **punim runom nad svakom**, ili barem runom koji
  krece cist. Za usporedbu s prijasnjim commitom posluzi `git worktree` (kod se mijenja
  bez diranja radnog direktorija) — ⚠ put worktreeja mora biti **ASCII**: u putu s
  `Saša` Vite ne razrijesi `/src/main.tsx` i **svaki** test padne iz krivog razloga.
- **⚠ ZAHTJEVI KOJI NIKAD NE DOBIJU ODGOVOR — `T-S135-11` VISE NIJE HIPOTEZA** (S140).
  Dotad je „suite rusi sam sebe" bilo objasnjeno **pretpostavkom** gusenja TEST baze.
  Izmjereno iz Playwright tracea (`trace.zip` → `0-trace.network`), jedan run `e7-share`:
  **347 zahtjeva, 24 sa `status: -1` i `time: -1`** — dakle bez ijednog odgovora. Dvadeset
  ih je izdano **8+ sekundi prije kraja testa**, pa nisu artefakt zatvaranja stranice.
  Nisu vezani uz jedan endpoint: `events`, `categories`, `areas`, `activity_presets`,
  `share_invites`, `data_shares`, `profiles`.
  ⚠ **Kako se to vidi u aplikaciji:** `E7-2` je pao jer `createShare` **nije se vratio** —
  GET `profiles?email=eq.userb@test.com` ostao je u letu, pa je `setIsInviting(false)` nikad
  izvrsen i gumb je u snapshotu `"…" [disabled]`. **Snapshot pokazuje zamrznut gumb, ne
  gresku** — a zamrznut gumb se cita kao „app ne radi", dok je zapravo mreza sutjela.
  ⚠ **Uzrok i dalje NIJE utvrdjen** i ne smije se proglasiti: kandidati su gusenje free-tier
  baze, connection pool, i **HTTP/1.1 head-of-line blocking** (trace kaze `httpVersion:
  HTTP/1.1`, preglednik drzi 6 veza po hostu, a `useStructureData` od S133 salje **39
  usporednih** `HEAD` upita). Treci kandidat je nov i dotad neimenovan.
  ⚠ **Posljedica za svaku dijagnozu E2E pada:** prije nego se pad pripise specu ili appu,
  **prebroji nedovrsene zahtjeve u traceu**. Isti spec je u S139 (puni run) prosao, a u S140
  pao u dva uzastopna pojedinacna runa — bez ijedne izmjene koda. To nije proturjecje nego
  mjera da ishod ovisi o **vremenu**, ne o specu.

- **⚠ `fullyParallel: false` NE čini run sekvencijalnim** (S120). Drži redoslijed samo
  *unutar* jednog spec filea; **fileovi i dalje idu u zasebne workere**, a Playwright uzima
  otprilike pola jezgri. Šest specova nad **istom seed Areom i istom bazom** dalo je
  **9 od 10 padova** — `selectOption` timeouti, `Cardio` skriven, `canceling statement due to
  statement timeout` — a svaki od njih prolazi kad se pusti sam. Popravljeno s `workers: 1`.
  ⚠ Taj `statement timeout` je isti onaj koji je izgledao kao da ga proizvodi atributni
  filtar — v. „Atributni filtar nije spor" niže. Dva dana bi se moglo potrošiti na krivi trag.
- **⚠ Spec koji obriše svoj leaf ostavlja P2 PARENTE** (S120). Siročići se nakupljaju kroz
  runove, uđu u sljedeći **export** i sudare se s uvozom — a to se **ne pokaže kao ostatak**
  nego kao pokvaren feature: `T-S107-2` je upisao komentar koji je već bio ondje (nema
  promjene ⇒ nema guarda), `T-S107w-1` je udario u koliziju (Apply se ne pojavi ⇒ izvještaj
  se ne preuzme). Oboje je lovljeno kao bug prije nego je uzrok izmjeren.
  Lijek: `e2e/setup/global-setup.ts` vraća seed Areu na seed stanje prije **svakog** runa.
- **⚠ „Test je flaky" je opis, ne dijagnoza — `e16` je padao na sasvim drugom mjestu**
  (S122, zatvara T-S121-6). Dva runa: 1 prolaz (34 s), 1 pad (**čist timeout od 120 s**).
  Trace pokazuje da je visio na kliku **„View details"**, a klik na **⋮ je uredno prošao
  1,9 s prije toga**; screenshot pada ima filtar **netaknut**. Dakle ono što test čuva
  (S120 popravak „filtar preživi View Details") **nikad nije puklo** — a cijelu je sesiju
  stajalo zapisano da nije čuvano.
  Uzrok: promjena aree/atributa pokrene **šest** upita liste u ~500 ms (`events?select=…`
  na 16664, 16735, 16832, 16909, 17022, 17098 ms), ⋮ klik je pao na **16712** — usred
  toga; redak se remounta i odnese tek otvoren izbornik. Lijek u specu (`expect(...)
  .toPass()` oko otvaranja izbornika), jer **app se ponaša ispravno**. Poslije: 4/4,
  24–29 s. ⚠ Pouka koja vrijedi za svaki idući flaky test: **prvo pročitaj trace i vidi
  na kojem je pozivu stao** — „flaky" je bio razlog da se dva puta ne pogleda.
- **Fiksan literal u testu se sudari s vlastitim ostatkom.** `T-S107-2` je upisivao stalni
  komentar; kad ga je raniji run već ostavio u bazi, upis nije bio promjena. Svaki marker
  koji test upisuje mora biti **jedinstven po runu** (`${Date.now()}`).
- **Test koji nikad ne pada ne čuva ništa** (S120). Prva verzija `T-S100-1` prošla je i s
  **namjerno pokvarenim** razrješavanjem aree, jer uz ključ bez imena aree jedan blizanac
  ionako pobijedi rječnik — i slučajno je to bio očekivani. Svaki nov test se provjerava
  **i u drugom smjeru**: pokvari kod, test mora pasti, pa vrati kod.

- **Testovi koji dijele komentar + `session_start`:** ostatak prekinutog pokušaja ne daje grešku
  nego **koliziju** → Apply postane „All skipped" i izgleda kao pad featurea. Cleanup po prefiksu.
- **TEST baza ima više simuliranih usera** koji dijele imena/slugove (`Financije`, `Health`) —
  `financije-all` je jedini slug jedinstven pravom TEST accountu
- **`e2e/setup/seed.sql` je idempotentan** — ponovno pokretanje vraća seed evente koji su odlutali
- **Kvačica u Area panelu je lokalno stanje forme.** Stvarno stanje se provjerava kroz
  Add Activity ili novi export, ne kroz panel.

---

## Theme colours (src/lib/theme.ts)
[↑ Sadrzaj](#Sadrzaj)

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
[↑ Sadrzaj](#Sadrzaj)

```
data-prep_tools/Tools/backup_db.py Snimka CIJELE baze (12 tablica + auth popis +
                                   Storage) preko PostgREST-a, service kljucem.
                                   /!\ STAJE ako kljuc nije service -- anon bi
                                   dao PRAZAN backup koji izgleda uredan.
                                   `--verify` provjeri staru snimku po sha256.
                                   /!\ NE pokriva shemu (v. `dump_schema.py`).
data-prep_tools/Tools/restore_db.py
                                   Vracanje snimke. ZADANO JE DRY RUN.
                                   `--mode fill` (zadano) upisuje samo retke
                                   kojih nema => ne moze unistiti novije PO
                                   KONSTRUKCIJI. `--mode exact` brise visak i
                                   trazi utipkano `OBRISI`.
                                   /!\ `project_ref` iz manifesta mora odgovarati
                                   ciljanoj bazi; PROD trazi `--yes-i-mean-prod`
                                   i sam uzme svjez backup prije vracanja.
                                   Poslije mjeri `sha256` po tablici -- dokaz,
                                   ne nada. Dokazan na TEST-u (S136).
data-prep_tools/Tools/dump_schema.py
                                   `pg_dump --schema-only` -> `sql/SCHEMA_*.sql`.
                                   Ide preko Session poolera (IPv6 problem).
                                   `--diff` = slaze li se baza s gitom.
data-prep_tools/Tools/rls_probe.py Sto RLS STVARNO dopusta, po ulozi. Svaka proba
                                   u vlastitoj transakciji s ROLLBACK-om.
                                   Mjera PRIJE i POSLIJE svake RLS migracije.
src/lib/parentEventLoader.ts       Shared: buildParentChainIds(), loadParentAttrs(),
                                   findParentEventByChain(), upsertParentEvent()
src/lib/categoryCache.ts           Module-level keš categories + area imena (TTL 5 min)
src/lib/supabasePaging.ts          fetchAllPaged / fetchAllPagedIn — obavezno za "sve retke"
src/lib/excelExport.ts             Activities Excel export, mergeSessionEvents(), Delete? kolona
src/lib/excelImport.ts             Activities Excel import, collision handling, applyDeletes()
src/lib/excelImportReport.ts       Izvještaj nakon uvoza — radni file, ne log
src/lib/excelFingerprint.ts        row_hash (FNV-1a 64) — skip nedirnutih redaka
src/lib/excelDatetime.ts           Kanonski oblik datum-atributa (baza ↔ app ↔ Excel ćelija)
data-prep_tools/Financije/uskladi_izvod.py
                                   Jedan izvod ↔ baza ↔ Kokin file. Četiri sekcije po
                                   tome TKO ODLUČUJE + `--file` review workbook za Koku.
                                   Zamjenjuje `kosara_naplate.py` za `Datum naplate`.
data-prep_tools/Financije/primijeni_uskladu.py
                                   Upisuje nalaz na PROD (ispravci + dopune + brisanja),
                                   jednim potezom, s backupom i brojanjem redaka.
data-prep_tools/Financije/_db.py   `load_env` + pagirani `rest`. Izdvojeno iz
                                   `uskladi_izvod` (koji uvozi pdfplumber) da alat
                                   koji prica SAMO s bazom ne vuce PDF citac.
                                   /!\ PRESELJENO, ne kopirano — `uskladi_izvod`
                                   re-exporta, pravilo o paginaciji ostaje jedno.
data-prep_tools/Financije/ocisti_auto_komentare.py
                                   Brise `comment` koji je napisao `comment_template`.
                                   Kriterij je REKONSTRUKCIJA po retku, ne uzorak —
                                   rucni opis se ne moze pogoditi. Staje dok je
                                   template ziv (na OBJE razine). Backup + `--restore`.
data-prep_tools/Financije/presedani.py
                                   `Tip`/`Podtip` brojanjem povijesti RACUNA.
                                   Tri kljuca: primatelj+poziv > primatelj > iznos
                                   (s predznakom). Ne pogadja — sto nije
                                   jednoglasno ostaje `N/A`.
data-prep_tools/Financije/rate_alat.py
                                   Rate: prolaz A (higijena oznaka) + prolaz B
                                   (generiranje preostalih). Autoritet je
                                   `Izvod opis`, NIKAD komentar. Ne pise u bazu
                                   nego proizvodi xlsx za uvoz.
                                   /!\ `Izvod opis` ima DVA oblika: `X RATA n/N`
                                   (MC) i `RATA n/N-X` (Visa) -- zato prolaz A
                                   hvata 85 redaka, ne 43.
data-prep_tools/Financije/pregled_stanja.py
                                   Jedan file koji odgovara "je li stanje tocno":
                                   Pregled (svi izvodi + sidra) · Sporno (redak po
                                   redak, banka vs baza, autofilter) · 2023.
                                   ⚠ Kokina Excelica se NE oznacava — v. zaglavlje.
data-prep_tools/Financije/promet_check.py
                                   Promet po izvodu, app vs banka. Ne prolazi kroz
                                   sidro ⇒ jedini instrument za ZASIDREN mjesec,
                                   gdje `--report` po konstrukciji daje nulu.
data-prep_tools/Financije/oznaci_iz_presedana.py
                                   Sirovi tekst izvoda u `Opis`u -> oznaka iz
                                   BROJANE povijesti. Kljuc = primatelj + poziv
                                   na broj (nikad Tip/Podtip). Prag >=90% i >=3.
                                   ⚠ 45/71 redaka, `--apply` NIJE pusten (S129).
data-prep_tools/Financije/fix_podizanje_150.py
                                   Jednokratno: duplikat podizanja 150,00 s
                                   krivim mjesecom. Primijenjeno S129.
data-prep_tools/Financije/uvezi_transu.py
                                   Uvozi retke s izvoda kojih baza nema. Rječnik
                                   `Izvod opis → Tip/Podtip` iz brojane povijesti;
                                   STANE na retku bez jednoglasnog presedana.
src/lib/deltaSheet.ts              Delta sheet — prozor, kontrolni stupac, "u banci piše",
                                   sekcija "planirano" + kontrola košare (S123)
                                   ⚠ kontrolni SUMIFS ne broji `Planiran`
src/lib/structureExcel.ts          Structure export (Automations, Dashboard, DisableSavePlus)
src/lib/structureImport.ts         Structure import — non-destructive, slug lookup
src/lib/attributeRules.ts          set_attribute automatika (evaluateDateRule, same/next:N)
src/lib/deleteErrors.ts            classifyDeleteError() — čitljive poruke iz PG grešaka
src/lib/theme.ts                   Theme colour tokens
src/lib/overviewApi.ts             Overview read model — rpc_area_group_agg / _balance_anchored,
                                   CRUD sidara. Jedini `.rpc()` pozivi u aplikaciji.
src/lib/dashboardConfig.ts         Fixup slug referenci u dashboard configu (S105d razred)
src/lib/listColumns.ts             Kolone Activities liste po Arei — DEFAULT_COLUMNS,
                                   resolveColumns(), fixupListColumnsSlug()
                                   ⚠ mobilni redak: v. „Kolone Activities liste" (S119)
src/hooks/useListColumnValues.ts   Vrijednosti atributa za vidljive retke — jedan upit,
                                   ograničen na attribute_definition_id (ne skenira EAV)
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
[↑ Sadrzaj](#Sadrzaj)

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
[↑ Sadrzaj](#Sadrzaj)

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
[↑ Sadrzaj](#Sadrzaj)

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
- **Shortcutovi po Arei (S122):** kvačica „samo ova Area" uz `⚡ Shortcuts` (stanje po
  pregledniku, `et_shortcuts_area_only`), `<optgroup>` po Arei u punom popisu, sufiks
  `0× · 25.06.` (`usage_count` + `last_used`). **Bez granice po broju** — v. „Backlog".
- **Overview (S108):** tab po Arei, postoji **samo** uz `settings.dashboard` (OQ-4). Pločica
  `balance_by_group` sa sidrom i `✓/Δ` čipom, drill u Activities, izračunata kolona `Stanje`.
  Agregacija ide u Postgres (`rpc_area_group_agg`, `rpc_area_balance_anchored`) — nikad u preglednik.

---

## Izmjereno i **nije** problem — ne trošiti vrijeme ponovno
[↑ Sadrzaj](#Sadrzaj)

- **Atributni filtar nije spor** (S120). `ILIKE '%x%'` na `event_attributes.value_text` je
  **indeksiran** — `sql/028_value_text_trigram_index.sql` (GIN, `pg_trgm`, još iz S97).
  Izmjereno istim oblikom upita koji app šalje: TEST (74.125 atributa) `0,38–0,73 s`,
  PROD (68.692) `0,31–0,52 s`; kao prijavljen korisnik s aktivnim RLS-om `0,37–0,66 s`.
  ⚠ `canceling statement due to statement timeout` koji je to naizgled potvrđivao dolazio je
  od **paralelnih Playwright workera** (v. „E2E"), ne od upita.
  Ostaje istinito samo ovo: RLS politika `event_attr_select` ima jeftinu granu
  (`auth.uid() = user_id`) i skupu (join na `data_shares`) — dakle **vlasnik** je jeftin, a
  **grantee** nije. Na PROD-u je Koka vlasnik, a Saša grantee.
- **Razrješavanje kategorije pri uvozu je ispravno** (S120, `T-S100-1`). Redak ide u areu koju
  imenuje kolona `Area`, i kad druga area ima kategoriju istog imena — a to je na PROD-u živ
  slučaj (`Financije_all` i `Financije_old` obje imaju `Transakcija`).
  ⚠ **Ovlast nije ondje gdje izgleda:** `catByPath` (5 mjesta) služi validaciji i kolizijama;
  o tome **gdje redak stvarno završi** odlučuje `getHierarchyLevels`. Lomljenje `catByPath`-a
  ishod ne promijeni — tek lomljenje `getHierarchyLevels` pošalje redak u krivu areu.
  Zaostala grana „gola putanja bez imena aree" sada **izostavlja dvosmislenu** putanju, pa
  redak padne glasno (`Invalid category path`) umjesto da završi negdje uvjerljivo.

- **„87 Python alata, sigurno su neki mrtvi" — NIJE TOCNO, izmjereno S139.** Audit od
  2026-09-16 je predlozio „kandidate za umirovljenje" i sam ju preskocio kao preskupu.
  Izvedena je i **isplata je gotovo nula**: od 87 pracenih alata **2** nitko ne spominje,
  a jedan od ta dva je `fix_*` jednokratna skripta, kojoj je to **normalno stanje**.
  Dakle stvarni kandidat je **jedan** (`garmin_daily_metrics_to_xlsx.py`), i on visi o
  otvorenoj Backlog stavci (Garmin/Sleep).
  ⚠ **Zasto je pitanje bilo krivo postavljeno:** `18` od 87 alata su `fix_*.py` jednokratne
  skripte, koje CLAUDE.md sam propisuje kao obrazac („zato postoje one-off skripte"). One su
  **zapis sto je ucinjeno nad podacima**, ne alat koji ceka iduci poziv — a za financijski
  skup podataka je brisanje tog zapisa tocno pogresan potez. Jos 7 ih je u `Obsolete/`.
  ⚠ **I nema jeftine mjere za „ne koristi se":** git zna kad je file zadnji put MIJENJAN, ne
  kad je POKRENUT — a alat koji radi i ne treba izmjene izgleda **identicno** mrtvome.
  Probana su tri mehanicka detektora; **dva su dala same lazne pozitive**: „mrtva hardkodirana
  putanja" (12 pogodaka — svih 12 krivo, alati putanju sastavljaju iz segmenata preko
  `ROOT / ... / ...`) i „hardkodirano ime filea kojeg nema" (11 pogodaka — vecinom IZLAZNI
  fileovi koje alat tek stvara). Prosao je samo „nitko ga ne spominje", i dao 2.
  ⇒ Ako se ikad ponovo otvori, jedino sto vrijedi mjeriti je **referenciranost**, i odgovor
  je vec ovdje.

## Open bugs
[↑ Sadrzaj](#Sadrzaj)

> **Dva pravila o samom ovom popisu** — izvedena iz zatvorenih unosa pri ciscenju u S139,
> jer bi se seljenjem punog teksta izgubila:
>
> - **/!\ „bezopasno" vrijedi DOK nitko ne cita, i prestaje bez ijedne poruke.**
>   `T-S107u-2` je bio oznacen bezopasnim jer `default_value` nitko nije citao — a u S117 ga je
>   skrivanje-na-defaultu pocelo citati i `Status` bi poceo nasumicno nestajati iz forme.
> - **/!\ Bug zatvoren usput ostaje otvoren dok ga netko ne IZMJERI.** `BUG-S114-REPORTDD`
>   je zatvorio refaktor u nekoj ranijoj sesiji, a unos je stajao jos dugo — a „otvoren bug"
>   se cita kao poznat kvar i trosi paznju svake iduce sesije.

- **BUG-S131-VIEWSTALE — ⚠ NEPONOVLJEN, ne popravljati napamet.** Nakon Edita koji
  **pomakne `session_start`** (promjena datuma retka), View na tom retku javi „Activity not
  found"; **F5 ga riješi**. Izmjereno da su podaci ispravni: `event_date 2026-09-04`,
  `session_start 2026-09-04T07:52:00+00:00`, bez kolizije sa susjednim minutama.
  Hipoteza: `AppHome` prosljeđuje snimak liste kroz `navigate(..., { state })`
  (`AppHome.tsx:1154`), a `ViewDetailsPage.currentIndex` traži grupu po `session_start`
  (`:422`) — snimak od prije edita više ne sadrži novi ključ. ⚠ **Hipoteza nije dokazana**
  i nije se dala ponoviti; prvo reproducirati, pa popravljati. Redak koji **postoji** a app
  tvrdi da ga nema je gori od greške koja se vidi.

- **BUG-1:** `useFilter must be used within a FilterProvider` (`AppHome.tsx:105`) — vjerojatno
  StrictMode artefakt, nizak rizik

- **BUG-S103-ANYATTR:** „In any attribute" filter (`ATTR_FILTER_ANY`) timeouta za grantee-e —
  `ILIKE` nije leakproof pa Postgres evaluira RLS EXISTS nad cijelom `event_attributes`.
  Privremeno: amber notice u UI. **Pravi fix = SECURITY DEFINER RPC — isti sloj kao Faza 1.**

- **~~E7-3 / E10-2 `confirm revoke`~~ — ZATVORENO S140: bila je TVRDNJA NAPISANA IZ
  DIZAJNA, a app je cijelo vrijeme radio ispravno.** Gumb `Confirm revoke` renderira se
  samo unutar `{revokeTarget && …}` (`ShareManagementModal:300`), a `revokeTarget` se
  postavlja **iskljucivo** unutar `if (eventIds.length > 0)` (`:199`) ⇒ grantee **bez
  ijednog eventa** u Arei ide ravno na `doSimpleRevoke` i opoziv se izvrsi **bez pitanja**.
  Seed daje sve evente vlasniku (`seed.sql:73-96`); `userb` je ondje samo profil.
  ⚠ **Potvrda je dosla iz samog repoa, s druge strane:** `e15-revoke-with-events.spec.ts`
  prije **istog** ocekivanja sam stvori **6 eventa** za userb (`:69-114`), i zove se
  doslovno *„Revoke shows event-count dialog when grantee has events"*. Ista app, isti
  gumb — razlika je samo ima li grantee evente.
  ⚠ **Jedan uzrok, DVA pada koja su se vodila kao nepoznata.** `e10-revoke.spec.ts` je uz
  isto ocekivanje nosio komentar *„(since grantee has events in the area)"* — neistinu:
  njegov `beforeAll` radi samo `supabaseUpsert` nad `data_shares`. Obje tvrdnje dodao je
  **isti** commit `4413280` (S106), zajedno s fantomskim toastom `Access granted` kojeg je
  S139 vec maknuo. Dakle jedan commit je ostavio **tri** tvrdnje napisane iz dizajna, a
  ciscene su u tri navrata — jer se svaka lovila zasebno, kao vlastiti kvar.
  ⚠ **Pouka sira od ovog speca:** komentar u testu koji **obrazlaze** ocekivanje
  (*„since grantee has events"*) treba citati kao **tvrdnju koju treba provjeriti**, ne kao
  opis stanja — isti razred kao PROD slug trigger (S118) i `BUG-S123-EDITMARK` (S125), gdje
  je komentar opisivao namjeru a kod radio drugo.
  ⚠ **Popravak je u specu, nikad u appu** (pravilo iz § Session workflow). Put **s**
  eventima ostaje pokriven `e15`-om, pa se u E7-3/E10-2 **ne smije** dodavati stvaranje
  eventa — ta dva mjere *jednostavan* opoziv, kako im i ime kaze.
  Protuprovjera po S120 pravilu: uz sabotiran `doSimpleRevoke` (maknuti `toast` + `refresh`)
  padaju **tocno ta dva** testa; s ispravnim kodom prolazi svih 6 (E7-1..3, E10-1..3).

- **E8-2 Area select timeout:** grantee-write test padne na `selectOption` (element disabled) —
  moguće isti family kao BUG-S103-ANYATTR

- **BUG-S117-RULESHAPE:** panel i import **ne pišu isti oblik** `validation_rules` za
  `depends_on` atribut. Panel: `{type, suggest: [...], allow_other: true, depends_on}`;
  import: `{type, depends_on}`. Zato svaki Structure import nakon spremanja panela prijavi
  **9 „attributes updated"** koji nisu promjena nego poravnanje oblika (izmjereno S117).
  Bezopasno za ponašanje (`allow_other` je ionako zadano `true`, `suggest` je prazan), ali
  **šum koji skriva pravu promjenu** — a taj brojač je jedini signal da je import nešto dirnuo.
  ⚠ **Ozbiljniji dio: fallback lista se GUBI.** Panelovo polje „Default options (when no
  WhenValue matches)" piše u top-level `suggest`, a **export ga uopće ne nosi** ⇒ prvi
  roundtrip ga izbriše. Trenutno neopasno jer je u cijeloj bazi **0 od 12** `depends_on`
  atributa ima nepraznu listu — dakle rupa čeka prvog korisnika, ne ruši ništa danas.
  Fix: kolona za fallback opcije + isti graditelj pravila na obje strane.

- **Bulk delete (checkbox) nije ograničen za grantee-a**

- **„Import as mine" za write grantee unutar iste shared aree** nema smisla (pravi put je
  Leave Area ili re-import u novu vlastitu Areu) — flag, nije implementirano

---

### Zatvoreno — puni tekst je u `docs/sessions/DONE_HISTORY.md` (preseljeno S139)

> Ostaje jedan redak po unosu da pretraga po ID-u i dalje nesto nadje. Prije seljenja je
> provjereno nosi li koji od njih pravilo kojeg nema drugdje: tri su ga nosila i sva tri su
> zadrzana (dva gore, `Postgres upgrade` u Backlogu). Isti postupak kao „Spaseno iz plana" (S137).

- **~~BUG-S123-DELTAACCT~~** — zatvoreno S123: racun delta sheeta dolazio iz filtra a eventi iz profila => prazan sheet s tocnim sidrom. Pravilo: § Delta sheet.
- **~~BUG-S123-EDITMARK~~** — zatvoreno S125: oznaka ✎ crtana samo na uskom retku. Pravilo: „redak liste renderiraju dva mjesta", § UI (React).
- **~~BUG-S132-EVENTCOUNT~~** — zatvoreno S133: Structure tab brojao evente u pregledniku nad odrezanih 1000 redaka. Pravilo: § UI (React).
- **~~T-S107u-2~~** — zatvoreno S117: `depends_on` default oscilirao kroz export/import. Pouka je iznad, u pravilima o popisu.
- **~~BUG-S115-ANCHORDATE~~** — zatvoreno S116: datum sidra izvodio se iz filtra umjesto iz izvora. Pravilo: § Mjerenje / usklađenje.
- **~~BUG-S114-REPORTDD~~** — zatvoreno S136: izvjestaj o uvozu tobože bez `DropdownData`; zatvorio ga refaktor, potvrdilo mjerenje.
- **~~BUG-S118-PREVIEWMODE~~** — zatvoreno S120: preview racunao po `skip` i gutao provjeru kolizija. Cuva `e2e/tests/e17-import-foreign-preview.spec.ts`.
- **~~BUG-S119-FILTERBACK~~** — zatvoreno S120: `attrFilter` se gubio pri povratku iz View Details. Pravilo: § UI (React); cuva `e16`.
- **~~BUG-S121-DRAFTDUP~~** — zatvoreno S121: nacrt uskrsnuo nakon Finisha => duplikat. Cuva `S121_draft_after_finish.spec.ts`.
- **~~BUG-S121-AUTOSAVE~~** — zatvoreno S121: auto-save se naoruzavao iznova na svakom renderu, pa nikad nije opalio tijekom unosa.
- **~~BUG-S121-AREACTX~~** — zatvoreno S121: palo citanje `areas` trajno gasilo Overview tab i kolone. Cuva `S121_area_context_failure.spec.ts`.
- **~~e16-filter-persistence~~** — zatvoreno S122: „flaky" nije bio filter reset nego remount liste koji odnese otvoren ⋮ izbornik.

## Financije — pravila domene (izvodi, rječnik, 1-N)
[↑ Sadrzaj](#Sadrzaj)

> Plan, tranše i povijest migracije su u **`docs/FINANCIJE_STATUS.md`** (kvarljivo).
> Ovdje ostaje samo ono što vrijedi **bez obzira na to dokle je migracija došla**.

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

**⚠ Redak koji izvor OBRIŠE nakon uvoza ostaje u bazi zauvijek** (S115). Uvoz obrađuje ono
što u fileu **piše**, ne ono što je iz njega nestalo. Izmjereno: `845,12` (`Planiran`, ZABA,
11.07.2026.) postojao je **samo** u snimci `Financije 2026.xlsx` od 08.07., i to kao redak
**bez datuma i bez opisa** — ostatak, ne transakcija; u obje novije verzije njezinog filea ga
nema. U bazi je preživio pet tjedana i bio jedina stavka na liniji „planirano" ZABA pločice,
dakle **tvrdio je da će pomaknuti stanje**. Obrisan u S115. Vrijedi šire: usporedba stare i
nove verzije izvornog filea je jedini način da se takvi nađu — uvoz ih po definiciji ne vidi.

**⚠ Tipfeler u godini nije poziv da ga „popraviš i uvezeš"** (S115). Dva Kokina retka datirana
`2036-04-08` (`Mirovina 1.323,64`, `Netdomena Igor 47,76`) **već postoje u bazi** kao
`2026-04-08`, uredno klasificirani — ušli preko travanjskog izvoda. Ispravak godine + uvoz
udvostručio bi ih, i to **tiho**: padaju prije ZABA sidra pa ne bi pomaknuli nijednu kontrolnu
brojku. **Prije ispravka datuma uvijek provjeri postoji li redak već pod ispravnim datumom.**

**Pravila mijenjanja redaka:** dodavanje je uvijek sigurno; **spajanje/brisanje samo prije
importa i kroz skriptu** (`excelImport.ts` briše samo u `replace` grani kolizije — redak
odsutan iz filea se ne obrađuje, pa event tiho preživi).


### Spašeno iz plana (S137) — četiri pravila bez kopije igdje drugdje

⚠ Pri izmicanju plana u `FINANCIJE_STATUS.md` ova su četiri odlomka bila **unutar**
plana, a grep je pokazao da ih **nema nigdje drugdje** — dakle bulk move bi ih tiho
odnio. Zato se razdvajanje radilo s dokazom (39 `⚠` redaka prije, 0 izgubljenih),
ne procjenom.

  ⚠ Provjera mora biti **mehanička** (sparivanje s tolerancijom + potvrda razlike): njeni se
  iznosi razlikuju od bankinih na ~4 % redaka, a kartične stavke ne diraju saldo, pa takva
  greška **nikad ne ispliva sama**.
- **Granica je datum, ne vrsta retka.** Prije datuma piše pipeline, poslije samo ona.
⚠ **Skupna naplata se NE sintetizira, a njen datum je DOSPIJEĆE s izvoda** (S117).
`MC_2026-07.pdf` piše `Datum dospijeća: 11.08.2026.` i `UKUPNO (EUR): 1.332,52`. Isto potvrđuje
povijest: skupna MC naplata pojavljuje se na **ZABA izvatku** kao `TROŠKOVI UČINJENI MASTERCARD
KARTICOM`, uvijek **11. u mjesecu**, osam mjeseci zaredom (`Izvodi_transakcije.xlsx`). Dakle nije
na MC izvodu nego na izvatku tekućeg — a dok `ZABA_2026-08.pdf` ne stigne, iznos i datum dolaze
s MC izvoda. ⚠ **Opis mora ostati strojni tekst izvatka**, ne „Mastercard": svih 18 prijašnjih
MC naplata ga nosi, pa bi varijanta razbila brojanje po opisu (`klasificiraj_transu.py`).
s MC izvoda. ⚠ **Opis mora ostati strojni tekst izvatka**, ne „Mastercard": svih 18 prijašnjih
MC naplata ga nosi, pa bi varijanta razbila brojanje po opisu (`klasificiraj_transu.py`).
⚠ **Izvodi su samo PDF** — ni ZABA ni PBZ ne nude CSV/Excel (potvrdio Saša, S115). Ideja
„app čita izvod" zato znači **pisanje novog čitača PDF-a**, i **imenovana je i odložena**:
PDF-ove i dalje čita Sašin Python alat. Vrijednost te ideje nosi njezin drugi dio —
**pravila u bazi + evaluacija na uvozu** (Faza 3), koji PDF uopće ne dira.

### `Izvod opis` JE oznaka „potvrđeno izvodom" (S124)

Izmjereno: za MC retke je `Izvod opis` **doslovno prepisan** tekst izvoda
(`PAYPAL *TEMU`, `KONZUM P-3200 RATA 4/12`). Popunjenost: **Visa 96 %, Racun 92 %,
Mastercard 91 %**; po mjesecima kupovine MC 04/2026 36:3, 05 31:2, 06 47:5, **07 0 od 22**
— nula jer taj izvod nije bio obrađen. Dakle oznaka je pouzdana i **nitko je nije čitao**.

**Tri stanja, ne dva:** prazan = Kokina nepotvrđena tvrdnja (iznos/datum/oblik privremeni) ·
popunjen = banka potvrdila · **prazan a razdoblje pokriveno izvodom = pitanje** (ili duplikat,
ili banka za taj trošak ne zna).

⚠ **`Izvod opis` NIJE jedinstven kroz vrijeme** — `ZAGREBPARKING.HR APP 3 · 26,60` postoji u
više mjeseci. Sidro kaže *koji trgovac*, ne *koje pojavljivanje*; sparivanje bez prozora
spoji lipanjski redak izvoda s retkom iz **rujna 2025.**
⚠ **Potvrđen redak pripada točno jednom izvodu** — bez tog uvjeta sljedeći izvod „ispravlja"
ono što je prethodni potvrdio. Ali uvjet **sakrije** potvrđen redak s krivim dospijećem
(izmjereno: `Kokin Temu` 20,72 nosi `Izvod opis`, a `Datum naplate` = dan kupnje), pa uz njega
mora ići uski drugi prolaz: **isti opis + isti iznos + ≤ 2 dana**.
⚠ **Rata se veže BROJEM RATE, ne datumom.** Koka je datira na dospijeće (11.07.), banka na dan
terećenja (29.07.) — 18 dana. S tolerancijom od 5 dana svih 11 rata ispadne kao „za uvoz",
i uvoz ih **udvostruči**.
⚠ **Zbroj sam po sebi nije dokaz.** Subset-sum bez ograničenja „nađe" da je `LH 2/3` 63,33 =
PEVEX + TEMU + KONZUM preko 27 dana. Razdvojeni bankini redci su **istog dana**.

### ⚠ 1:N ide u OBA smjera, i obrnuti je opasniji (S124)

Detektor je tražio „**jedan** redak baze = **N** redaka izvoda" (`LH 1/3`). Postoji i
obrnuto: **N redaka baze = jedan redak izvoda.** Izmjereno: Kokin `34,08` + `0,90` = bankin
`KEKS PAY 34,98` (12.05.2026.). Sparivanje redak-po-redak to **ne može naći** — oba njena
retka izgledaju kao „banka ih nema", i tako su dva mjeseca stajala kao pitanja za nju.

⚠ **Zbroj cijele košare je jači signal od sparivanja po retku** — ne ovisi o tome pogađaju
li se parovi ispravno. Sašin potez koji je to razriješio: zbroji **sve** njene MC retke s
`Datum = 11.06.` i usporedi s izvodom. Dalo je `1.768,00 = 1.768,00` uz **31 njena retka
naspram 30 bankinih**, i razlika je bila točno taj jedan spoj. **To bi trebalo biti prvo
što alat ispiše**, prije bilo kakvog sparivanja.

### Rječnik `Izvod opis → Tip/Podtip` — brojanjem, ne rukom (S124)

Ključ je **normaliziran na trgovca**; vrijednost se bira **prebrojavanjem potvrđene
povijesti**. Izmjereno nad 26 redaka tranše: **20 iz povijesti, 6 ručnih odluka** — a svaka
od tih 6 postaje presedan. Baza ima **694 ključa**, od toga 679 jednoglasnih.

- **⚠ Režu se samo sufiksi KOJI SADRŽE ZNAMENKE.** Sufiks je broj transakcije
  (`SPOTIFY P44015227F` / `SPOTIFY P450E8139E` = isti Spotify), ali bez tog uvjeta
  `PAYPAL *DISNEYPLUS` postane `paypal` i **svi PayPal trgovci se sliju u jedan ključ**.
  Bez normalizacije 14/26 ima presedan, s njom 17/26.
- **⚠ `[kartica: SAŠA]` je anotacija pipelinea, ne ime trgovca.** Baza drži
  `GOOGLE*YOUTUBE [kartica: SAŠA]`, izvod samo `GOOGLE*YOUTUBE` — bez rezanja **15
  presedana na istih 9,55 ispadne kao „nema presedana"**. ⚠ Ali nositelj kartice **ostaje
  upotrebljiv kao zasebna dimenzija**: `AUDIBLE` je 10:9 `Koka`:`Sasa`, a kartica to riješi.
- **⚠ Dvojben trgovac ⇒ druga razina po IZNOSU**, uz jednoglasnost i **≥ 3 presedana**
  (jedan presedan po iznosu je slučajnost). `APPLE.COM/BILL` je po trgovcu 26/29 — ispod
  praga; ali `2,99` je **17/17** `Cloud backup`.
- **⚠ Posrednik nije trgovac.** `KEKS PAY` ima **8 različitih Tipova** (Parking, Sport,
  Hardver, Pokloni, Domaćinstvo…) jer je aplikacija za plaćanje — `Izvod opis` ne govori
  što je kupljeno. Isto `PAYPAL *`, `KUPOVINA…`. Ondje rječnik **ne smije ni pokušati**.
- **Ključ koji nije jednoglasan (< 90 %) se NE POGAĐA — alat STANE.** Prvi run tranše je
  stao na 3 retka, i sva tri su bila *pravilo koje fali*, ne *podatak koji fali*.
- **⚠ Kokin opis je jači od statistike.** `APPLE.COM/BILL 9,99` je 5:3 i ostaje dvojben;
  njen redak kaže „HBOMax" i time je riješen. Isti princip kao „ako izvor s odgovorom
  već postoji, ne izmišljaj heuristiku".
- **⚠ Pretraga po ključnoj riječi prekomjerno hvata.** `spa` je uhvatio
  `KUPOVINAFS *DesignSpa fsprg.` (FastSpring — **softverska pretplata**) i
  `JU AQUATIKA CAFFE BAR` (kafić); `parking` je uhvatio `Prihodi / Povrat Anja` jer se
  riječ pojavljuje u strojnom tekstu naloga. Pravilo mora gađati **trgovca**, ne riječ.
- **⚠ Ista trgovina, drugi trošak.** `TERME JEZERCICA-VODENI` je `Zabava / Wellness`, a
  `TERME JEZERCICA-POOL BAR` je `Domaćinstvo / Kave/jelo vani`. Ključ po trgovcu bi ih
  slio.

**Gdje taksonomija živi:** isključivo `attribute_definitions.validation_rules` za `Podtip`,
u `depends_on.options_map.<Tip>`. **U kodu aplikacije nema nijedne hardkodirane vrijednosti**
(provjereno grepom po `src/` i `netlify/`) — dropdown, `DropdownData` list i Structure export
sve čitaju odatle. `sync_taxonomy.py` služi starom Review workbooku i ne dira se.
⚠ **Dodavanje vrijednosti je sigurno, preimenovanje nije** — ime poslije živi i u
`validation_rules` i u `value_text` svakog eventa.

### ⚠ Visa NEMA fiksan dan naplate (S124)

CLAUDE.md-ovo pravilo `Visa = next:3` (`set_attribute`) **se ne slaže s podacima**.
Izmjerena raspodjela `Datum naplate` na 855 Visa redaka: **5. (383×)**, 4. (231×), 6. (109×),
7. (82×), 11. (49×), 3. (11×). Traži zaseban prolaz s PBZVISA izvodima; ne popravljati napamet.

⚠ **ISPRAVAK S141: „ne padaju ni u jednu košaru“ je bilo NETOČNO, i stajalo je ovdje 17
sesija.** Razbacanost je artefakt gledanja **po danu umjesto po ciklusu**: grupirano po
mjesecu naplate, **35 od 37 ciklusa ima točno jedan dan** (1.639 redaka, PROD). Dakle Visa
se grupira uredno — krivo je bilo **ravnalo**, ne podaci. Značenje stupca odlučeno je u S141,
v. Backlog „PBZVISA prolaz“.

### Pravilo 1:N — banka ima N redaka za Kokin jedan (S124)

> **Bankini redci su KOSTUR** (iznos, datum, klasifikacija, potvrda), **Kokin DOPUNJAVA**
> (opis, `Rate?`/`Broj rata`/`Rata br`) i zatim nestaje. **Nikad ne ostaju oba.**

To je postojeće pravilo („iznos ← izvod, opis ← Koka") prošireno s *vrijednosti* na *broj
redaka*. Konkretno: `LH 1/3` 63,33 kod nje = `LUFTHAN…447 RATA 1/3` 62,01 + `NAKNADA ZA
OBROČNU OTPLATU` 1,32 kod banke. Spojeno, **naknada banke se vodi kao putovanje** — svaki
mjesec, tiho.
⚠ **Smjer je kontraintuitivan i mjerenje ga je okrenulo:** Kokin redak je **prazniji**
(`Tip = N/A`, bez `Podtip`, bez `Izvod opis`, datum 2 dana kriv), bankin nosi
`Putovanja / Karte, osiguranje` + potvrdu + točan datum. Zadržati njen znači zadržati lošiji.
⚠ **Ciljni oblik već postoji u podacima:** ostalih 8 rata od 28.06. su **jedan** redak s
njenim opisom + bankinim iznosom + klasifikacijom + `Izvod opis` + ratom. Pipeline taj spoj
radi za 1:1 i pada samo na 1:N.
⚠ **Brisanje i uvoz idu jednim potezom ili nikako.** `LH 2/3` se ne briše dok bankini redci
ne uđu tranšom — inače ostane rupa od 126,66.
⚠ **Dopuna ne prepisuje opis.** Bankin `LUFTHAN…447 RATA 1/3` zamijenjen Kokinim `LH 1/3`
dao bi **dva identična retka** istog dana i iznosa — dakle nešto što u listi izgleda kao
duplikat, točno ono što se čisti.

⚠ **`Status` se ne mijenja po pravilu nego kao POSLJEDICA POTVRDE.** Odbačeni automat je bio
„dospjelo ⇒ izvršeno"; ovdje dokaz nije dospijeće nego izvod. Zato `Planiran → Izvrsen` samo
na retku kojem se **istovremeno** upisuje `Izvod opis` s tog izvoda. Redak koji se ne može
ožigosati ne dira se.

⚠ **Višak jednog izvoda je često posao SLJEDEĆEG.** MC_2026-06 prijavi 23 retka kao „banka ih
nema", a MC_2026-07 preuzme 21 kao ispravak i 2 kao duplikat. Filtrira se tek kad su **svi**
izvodi obrađeni — inače Koka dobije 30 pitanja umjesto 7, i to baš ona na koja već imamo
odgovor.

⚠ **`event_date` se ne poravnava s izvodom.** Uvoz ga zna promijeniti
(`excelImport.ts:1326`), ali time pomiče i `session_start`, a `useActivities` grupira po
njemu ⇒ dva retka iste minute postaju **jedan redak liste**. Na MC retcima pomak ionako ne
dira saldo. **Ratama se ne dira ni kasnije:** rate dijele dan **kupnje**, izvod nosi dan
**terećenja** — ondje izvod nije autoritet za `event_date`, samo za `Datum naplate`.

## Overview tab / analitika — sažetak odluka
[↑ Sadrzaj](#Sadrzaj)

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
- **⚠ IZMJERENO (S121): gotovina je 99 % neevidentirana, i to je SVJESNA odluka.**
  **57 podizanja / 9.894,00 €** naspram **2 gotovinska troška / 86,00 €**. Saldo je zbog toga
  savršeno točan (podizanje ga miče, trošak ne), ali **razrez po Tipu još ne postoji** —
  `settings.dashboard` ima jedan jedini widget. Kad se gradi, mora nositi vlastiti redak
  **`gotovina, nerazvrstano` = Σ(`Transfer/cash - bankomat`) − Σ(`Izvor = Cash`)**, inače
  prešuti ~9.800 € i podcijeni potrošnju. Sašina odluka: **ne bilježiti svaku sitnicu** —
  selektivno bilježenje je sigurno jer `Izvor = Cash` retci **nikad ne ulaze u saldo**, pa
  nepotpunost ne može pokvariti Kokinu kontrolu računa. Cijena je da parcijalnost mora biti
  **vidljiva**, ne skrivena.
  ⚠ Time je poseban račun `Gotovina` **definitivno odbačen**, i to s razlogom a ne odgodom:
  izmjereno je da `Transfer / izmedju racuna` **NIJE dvostruki zapis** (75 redaka, jedan po
  transakciji, druga strana izvan modela) ⇒ `Gotovina` ne bi mogla reciklirati postojeću
  strojariju, a računica „nerazvrstano“ daje istu dijagnostiku besplatno.
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
  **„Potvrdi na `<budući datum>`"**, čime bi sidro po pravilu „strogo nakon" **presjeklo sve
  retke do tada**. `split` („planirano") dobiva **sirovi** `asOf`, jer je rata u 2027. upravo
  ono što taj broj broji. Dvije upite, dva pravila.
- **Sidro prikazuje račun i BEZ ijednog eventa** — ✅ **izmjereno uživo 23.08.** (T-S115-2):
  sidro na `TEST prazan račun` (nula eventa) dalo je redak `1.240,00 € · 0 promjena poslije`.
  Popis grupa je `UNION` brojanih grupa **i** sidara: *„potvrđeno 1.240,00 i ništa se nije
  dogodilo" je odgovor, nije odsutnost.*
- **⚠ ALI PRVO SIDRO SE NE MOŽE UPISATI KROZ APLIKACIJU** (S116, otkriveno tek pri izvođenju
  testa — čitanje `036` to nije moglo pokazati). `u banci` i `Potvrdi` renderiraju se **unutar**
  `rows.map(...)`; prazna Area daje **nula redaka**, pa pločica pokaže „Nema zapisa koji
  zadovoljavaju uvjete pločice" i **nema polja za unos**. Testno sidro je zato upisano skriptom
  (`anchors.py --add`).
  ⇒ Točna formulacija je: **povijest nije preduvjet, ali JEDAN EVENT jest.** Plan za PROD to
  već zaobilazi (korak 5: „2–3 stvarna retka da se račun pojavi"), a to i nije zaobilaženje
  nego normalan posao — ona ionako ima transakcije za upisati.
  ⚠ **Sašina odluka (S116): NE gradi se.** Dva razloga: sidro bez ijednog eventa ionako malo
  znači (vrijednost sidra dolazi od prometa **poslije** njega), a feature bi služio jednom
  jedinom trenutku. **Uvjet pod kojim ipak ugrize:** otvori li se **novi bankovni račun**,
  ne može se usidriti dok se na njemu ne zapiše prva transakcija. Rijetko, i rješava se samo.
  Ako se ikad gradi: vrijednosti iz `racun.validation_rules.suggest` kao prazni retci s poljem
  za potvrdu — **dropdown, nikad slobodan tekst**, jer bi tipfeler stvorio fantomski račun
  koji pločica prikaže kao uredan.
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

## S112+ Intelligence layer
[↑ Sadrzaj](#Sadrzaj)

Sjeda **na** Overview, ne umjesto njega. Success criteria se definiraju kad Faza 3 prođe.
(Broj pomican četiri puta — S108, S109, S110, S111 su zauzeli mjesto.)

---

## Backlog
[↑ Sadrzaj](#Sadrzaj)

> **Struktura NOSI trijazu, umjesto da je opisuje** (S140). Do tada je ovdje stajao odlomak
> koji je nabrajao sto je parkirano a sto otvoreno — pa je svaka sesija citala svih 306
> redaka da bi dosla do istog zakljucka. Sada je dovoljno procitati **prvi** podnaslov.
>
> /!\ Unosi su preslozeni, **nijedan znak u njima nije promijenjen**. Svrstavanje je
> procjena i smije se ispraviti; zato je pravilo bilo **u korist vidljivosti** — sto je bilo
> dvojbeno islo je u „Otvoreno". Krivo prikazan zadatak kosta jedan pogled, krivo sakriven
> kosta zadatak.

### Otvoreno — ovo je posao

**⭐ `HiddenInAdd` se čita samo iz PRVOG retka atributa, a `IsRequired` iz svih** (S140).
Nesimetrija u `structureImport.ts`: `group.isRequired = group.isRequired || row.isRequired`
(`:379`) protiv `hiddenInAdd` koji se postavlja samo pri stvaranju grupe (`:347`).
⚠ S131 je tu istu stvar popravio za `IsRequired` uz izričito obrazloženje — *„prvi
pobjeđuje” bi `TRUE` na drugom retku tiho progutao* — i **propustio ovu zastavicu**.
⚠ **Danas ne grize**, i to je izmjereno: i app export i
`make_financije_all_structure.py` pišu istu vrijednost u **svaki** redak atributa. Ali
`Stanje` (`Financije_all`) ima **dva** retka jer `depends_on` daje redak po `WhenValue`, pa
čovjek koji ručno uredi drugi redak dobiva tiho zanemarenu namjeru.
⚠ Popravak je jedan redak (`group.hiddenInAdd = group.hiddenInAdd || row.hiddenInAdd`), ali
**mijenja semantiku uvoza za svaki file**, pa ide uz test i uz Sašinu potvrdu — isto pravilo
koje već stoji uz susjednu stavku o `hidden_in_add` na uvozu.

**⭐ `et_activity_draft` nosi isti razred kao filtar — ključ bez oznake baze** (S140).
`FilterContext` je zatvoren `dbScopedKey()`-em, ali nacrt Add Activityja i dalje stoji pod
golim ključem, a drži `categoryId` i vrijednosti atributa. Posljedica je zapisana još u S118:
nacrt napravljen pod jednim računom iskoči kao „Resume Previous Session?” pod **drugim**, i
nudi kategoriju iz tuđe aree. Sada se zna da isto vrijedi **između TEST-a i PROD-a**.
⚠ **Nije popravljeno odmah zato što dva E2E speca tvrdo kodiraju taj string**
(`S121_draft_after_finish.spec.ts:40`, `S122_no_phantom_draft.spec.ts:28`) — popravak ih mora
dirati u istom commitu, inače padnu i izgledaju kao regresija featurea.
⚠ Manje je opasan od filtra (Discard ga riješi, i ne prikazuje praznu listu kao kvar), pa je
svjesno odgođen, ne zaboravljen.

**⭐ Zaglavlje Add Activity po Arei** (Sašina ideja S117) — isti obrazac kao `list_columns`:
uloge u configu, ne domena u kodu. **Financije nemaju smisla pokazivati štopericu** — ona je
bila donekle korisna za treninge, i ondje ograničeno. **Koka je već jednom pitala zašto je tu**,
i odgovor je bio „za sada je tako". Umjesto nje: nešto poput Edit Activity panela — **birač
datuma s defaultom „danas"**.
⚠ Nije samo prosljeđivanje propsa. `ActivityHeader` **već zna** crtati datum (crta ga čim dobije
`dateTime` + `onDateTimeChange`; Edit ih šalje, Add ne). Prepreka je što `sessionStart`
(`useSessionTimer.ts:25`) služi **dvjema ulogama odjednom**: zapisano vrijeme eventa **i**
ishodište štoperice — pomak na prošli datum natjera štopericu da broji danima. Razdvojiti te
dvije uloge je jezgra posla; uz to ide ponovna evaluacija `set_attribute` na promjenu datuma i
odluka o koliziji `session_start`a pri unosu unatrag.
⚠ **Zašto je ovo najvrjednija stavka Faze 2:** danas se unos za prošli dan radi kroz **dva
ekrana** (Add pa odmah Edit), a Koka gleda banku svakih par dana ⇒ pogađa je na **svakom**
retku. Ostale stavke Faze 2 štede sekunde, ova uklanja cijeli drugi ekran.

**⭐ `Izvod opis` za RF retke — nijedan alat ga danas ne puni** (Sašin izričit zahtjev
S131: „pazi da ne zaboravimo"). `uskladi_izvod.py` radi **samo MC** izvode; RF je drugi
format i ide kroz OCR (`rf_ocr.py`), pa RF retci ostaju bez oznake „banka je ovo potvrdila".
Izmjereno na PROD-u 08.09.2026.: `Sašin tekući RF` **1.839 / 2.282 (81 %)**,
`Kokin tekući ZABA` **1.922 / 2.885 (67 %)**; od 25.08. je **17** RF redaka bez njega.
⚠ Dio tih 17 **i ne pripada** RF izvatku — kartične kupovine (`Izvor = Visa`) potvrđuje
PBZVISA izvod, ne izvadak tekućeg. Dakle prije alata treba **razdvojiti po `Izvor`u**, inače
se traži potvrda ondje gdje je po definiciji nema.
⚠ Saldo je i bez toga točan (`RF 690,79 @ 07.09.` u cent) — vrijednost je u **budućem
sparivanju**, ne u kontroli. Ide kad se RF put ionako bude dirao.

**⭐ Zatvaranje modala ne smije tiho baciti rad** (Sašin nalaz S135, uz T-S134-21).
S134 je maknuo **slučajni okidač** (selekcija koja završi izvan panela), ali ne i
**posljedicu**: namjeran klik na pozadinu i dalje odbacuje nespremljene izmjene **bez
pitanja**. Izmjereno: `StructureNodeEditPanel` uopće ne zna je li „prljav" — nema
`isDirty`, `hasChanges` ni `confirm`, a `useBackdropClose` prima `enabled` koji mu
**nitko ne šalje**.
Zamisao: zastavicu diže **handler kroz koji je promjena prošla**, pa
`useBackdropClose(onClose, !touched)`. Obrazac već postoji u ovoj bazi koda —
`userTouchedRef` (S122): pitanje nije *„ima li vrijednosti"* nego *„je li ih čovjek
dirao"*, a izračun iz stanja to ne može reći jer defaulti nose `touched: true`.
⚠ **„Prljav pa se tiho ne zatvara" je GORE od zatvaranja** — korisnik klikne, ništa se
ne dogodi, i nigdje ne piše zašto; isti razred kao tihi neuspjeh Savea koji je `assertWrote()`
zatvorio u S134. Dakle pitanje (`Discard changes?`), nikad šutnja.
⚠ Natpis je **engleski** — Structure Edit je konfiguracijska ploha; hrvatski je za Kokine
plohe unosa i Help.
⚠ Uvjet ide **po panelu, ne u hook.** Hook koristi **13** modala, a nemaju svi rad koji se
može izgubiti (`CategoryDetailPanel` je samo pregled). Guranje uvjeta u hook pretvorilo bi
jednu invarijantu u trinaest iznimki.
⚠ Usput zapaženo: `StructureNodeEditPanel:548` ima **drugi** overlay (`z-[60]`, ugniježđeni
dijalog) koji hook **ne** koristi ⇒ ne zatvara se klikom na pozadinu **uopće**. Nije kvar
(ništa se ne gubi), ali je nedosljednost koju treba odlučiti zajedno s ovim.

**Roundtrip completeness** — `export_profiles` (ključ `attr:Area||CatPath||AttrName` ne preživi
rename; fix = `ExportProfiles` sheet, isti obrazac kao `Automations`) **i `dashboard`**
(fix = `Dashboard` sheet, Faza 4). „From template" je riješen u S108.

**⭐ `rata` ne razumije `cutoff:B:D` — prva rata zna pasti mjesec prekasno** (S138).
`generateRataChargeDates` (`rataAutomation.ts:77`) prima **broj dana** i uvijek kreće od
**sljedećeg** mjeseca (`d.setMonth(d.getMonth() + i)`, `i` kreće od 1). Za kupovinu
1.–3. u mjesecu to je mjesec previše: Visa kupovina 02.10. pripada izvodu koji se
zatvara **03.10.** i tereti se **05.10.**, a rata modal joj daje prvu ratu `05.11.`
⚠ Rub je **neovisan o danu** — jednako griješi sa `3` i sa `5`, pa ga popravak iz S138
(`rata.date_map.Visa = 5`) nije ni mogao zatvoriti; on je samo poravnao **dan**.
⚠ Fix je da rata koristi **isti** `evaluateDateRule` kao `set_attribute` (prva rata =
rezultat pravila nad datumom kupnje, svaka sljedeća +1 mjesec), a `rata.date_map` primi
iste tokene. Time nestaje i zamka „dva rječnika, samo jedan razumije tokene".
⚠ Traži **deploy prije** nego token uđe u ijedan Excel — nepoznat token rata parser
tiho pretvori u zadanih `15` (isto pravilo kao za `cutoff` u S137e, samo tiše: ondje
uvoz barem `console.warn`a).
Veličina: **225 Visa rata** u bazi; pogođen je samo prozor 1.–3. u mjesecu.

**`Datum naplate` ne prati promjenu datuma u Editu** (S110) — delta-shift
(`EditActivityPage.handleDateTimeChange`) pomiče samo *vremena eventa*, ne i datumske atribute.
Oba popravka u S110 tražila su ručnu izmjenu. D1b kaže `Izvor ∈ {Racun, Cash}` ⇒ `Datum naplate`
= `event_date` (ovdje `Cash` **ostaje** — D1b je o datumu naplate, ne o saldu; v. S111),
pa bi se za te retke moglo pomicati automatski. ⚠ Za kartice **ne smije** —
tamo je datum naplate vezan uz ciklus banke, ne uz dan kupovine.

**Lista se preupita ŠEST puta na jednu promjenu filtra** (izmjereno S122 iz Playwright
tracea: `events?select=…` na 16664, 16735, 16832, 16909, 17022, 17098 ms nakon promjene
aree). Dvije posljedice: čist trošak — a na PROD-u je Saša **grantee**, dakle skupa RLS
grana (v. „Izmjereno i nije problem") — i **osvježavanje zatvara otvoren ⋮ izbornik**, što
korisnik vidi kao „meni mi se sam zatvorio". Drugo je posljedica prvog, pa se mjeri zajedno.
⚠ Nije hipoteza nego mjerenje, ali **uzrok kaskade nije utvrđen** — prije popravka izbrojati
tko sve okida refetch (`useDateBounds` settle, `areas-changed`, promjena `attrFilter`).

**⭐ `hidden_in_add` se tiho brise kad Structure file nema kolonu `HiddenInAdd`** (S139).
Popravljen je **alat** (`make_financije_all_structure.py` sada emitira kolonu), ali **uvoz je
ostao kakav jest**: svaki drugi file bez te kolone — stariji export, rucno skracen file, tudi
alat — i dalje brise zastavicu, i to bez ijedne poruke.
⚠ Pravi popravak je u `structureImport.ts`: `hidden_in_add` mora slijediti **isto nacelo** koje
Area postavke vec imaju (`hasSavePlusCol` i dr.) — nema kolone ⇒ zadrzi postojecu vrijednost.
Traži da se u `buildValidationRules` proslijedi „je li kolona postojala", jer se danas ne
razlikuje *„pise FALSE"* od *„kolone nema"*.
⚠ **Ne popravljati napamet:** mijenja semantiku uvoza za svaki file, pa ide uz test i uz
Sasinu potvrdu. Danas pogađa **3 atributa**, sva tri u `Financije_all`.

**⭐ `ViewDetailsPage`: efekt zove `loadActivityData` PRIJE nego je deklariran** (S139,
`react-hooks/immutability`, `:334`). Radi danas — efekti se vrte nakon rendera, pa je `const`
do tada dodijeljen — ali efekt drzi **staru** funkciju i ne osvjezava se kad se ona promijeni.
Isti razred kao S119/S120, i u istom fileu.
⚠ **Ne popravljati naivno:** dodavanje u dep listu ponovo bi pokretalo efekt na SVAKOM renderu
(funkcija se stvara iznova), sto je klasicna zamjena jednog kvara drugim. Trazi `useCallback`
ili premjestanje deklaracije, i E2E protuprovjeru (`e4-view-activity`).
⚠ **Bio je NEVIDLJIV do S139:** skrivao ga je `eslint-disable-next-line` za **drugo** pravilo
(`exhaustive-deps`) — plugin preskoci cijeli efekt koji nosi disable za bilo koje `react-hooks`
pravilo. Mrtva suzbijanja zato nisu kozmetika nego **slijepa mrlja**.

**Postgres upgrade — otvoren od S105, i retry ga samo SKRIVA** (spaseno iz `BUG-S121-AREACTX`,
S139). Palo citanje `areas` na PROD-u je vjerojatno S105 obrazac: free-tier se gusi. `withRetry`
iz S121 je posljedicu ucinio prezivljivom (tab se vise ne gasi trajno), ali uzrok stoji.
/!\ Zato ga retry cini **manje vidljivim, ne manje prisutnim** — a mjera da se i dalje
dogadja je broj retryja, koji danas nitko ne broji.

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

**Health `health_lab_review.py` cleanup** — razdvajanje Medical Visit bilješki iz Lab Results komentara.

**⭐ PBZVISA prolaz — `Datum naplate` za Visu nema ispravljača** (S137; značenje stupca
odlučeno S141, v. dolje). `uskladi_izvod.py:939` prima **samo MC** (`Zasad samo MC izvodi`),
pa za **1.639** Visa redaka (PROD, S141) nitko ne čita izvod i ne ispravlja datum.

⚠ **Parsiranje PBZVISA-e NIJE prepreka** — izmjereno: `PBZVIZA_2026-07.pdf` daje **49 od 49**
transakcijskih redaka čitljivo, `(cid:` smetnja je 11 od 180 redaka (6 %) i samo u zaglavlju.
Ranija pretpostavka „Visa traži OCR" bila je **zamjena s RF-om** (tekući račun), ne s PBZVISA-om.

⚠ **Prepreka je što izvod daje KRIVI DATUM.** Izmjereno na svih **32** Visa izvoda:
`Dospijeće plaćanja` je **11.** sljedećeg mjeseca (20× točno 11., a 12./13./14. kad 11. padne
na vikend). Ali stvarno terećenje RF-a je **6.–7.**:

| izvod | dospijeće | stvarno terećen RF |
| --- | --- | --- |
| `PBZVISA_2026-06` | 13.07. | **06.07.** `1.495,78` |
| `PBZVIZA_2026-07` | 12.08. | **07.08.** `1.171,59` |
| — | — | **07.09.** `1.218,38` |

`Datum naplate` po definiciji znači *dan kad banka stvarno skine iznos*, dakle **6.–7.** — što se
poklapa s raspodjelom u bazi (5. → 719, 4. → 400, 6. → 176, 7. → 137), a **ne** s dospijećem.

⚠ **Zato alat mora čitati DVA izvora**, i to je jedina prava razlika prema MC alatu:
PBZVISA za stavke i rate, **RF izvod** za dan i iznos stvarne naplate. Mastercardu to ne treba
jer su mu ta dva datuma **ista** (`11.08. 1.332,52 TROŠKOVI UČINJENI MASTERCARD` na ZABA izvatku).

⚠ **`next:3` NIJE loše pogađanje naplate — to je dan ZATVARANJA izvoda, i točan je.**
Kokina teorija (*„3. se formira račun"*) potvrđena mjerenjem zadnje transakcije po izvodu:
**2. → 6×, 3. → 4×, 31. → 3×, 1. → 1×**. Dakle odgovara na *kojem izvodu trošak pripada*.
⚠ **Zato ga NE mijenjati u `next:7`** (prijedlog iz prvog nacrta ove stavke, **povučen**):
izgubilo bi grupiranje po izvodu, a ne bi dobilo točan datum jer terećenje varira 6.–7.

⚠ **Stupac je nosio DVA ZNAČENJA, ali razmjer je 40× manji nego što je ovdje pisalo**
(ispravljeno S141). Stajalo je da se Visa retci „ne grupiraju jer nisu mjereni istim
ravnalom“ — **grupiraju se**: **1.616 od 1.639** uredno sjeda u svoj ciklus, a ne sjeda
**23** retka koje je napravila aplikacija kao `next:3`.
⚠ **Posljedica je živa i danas**, izmjereno na PROD-u: otvorena košara `2026-10`
razlomljena je na **3.×13 + 5.×5** — ta dva dana su **dvije generacije configa**
(`next:3` prije S138, `cutoff:3:5` poslije). Zatvoreni ciklusi su netaknuti.
Za MC se pitanje ne postavlja jer mu se sva tri datuma poklapaju na **11.**
(izmjereno S141: **1.802 od 1.806** retka).

✅ **ODLUČENO (S141, Saša): značenje je (b) — dan kad je novac stvarno otišao.**
*„Dok se ne zna, pretpostavljamo; kad stigne izvod, editiramo na točno.“* Pretpostavka nije
druga vrsta podatka nego **isti podatak u privremenom stanju** — zato app smije i dalje
upisivati `cutoff:3:5`; treba mu **ispravljač**, ne drugo pravilo. Odbijena (a) bi tražila
prepisivanje **1.616** redaka i time nepovratno izbrisala jedini zapis stvarnog dana
terećenja po ciklusu — dakle zamjenu **izmjerenog** izvedenim.

⚠ **Ispravak je operacija nad KOŠAROM, ne nad retkom.** Izmjereno (PROD, S141): **35 od 37**
ciklusa ima točno **jedan** dan — potpis izmjerene veličine, jer bi pravilo svaki mjesec dalo
isti dan, a banka ga pomiče (2024-07 → 4., 2024-08 → 12., 2026-08 → 7.). Kad se dan sazna,
ispravlja se **cijeli ciklus odjednom**, i to ima ugrađenu kontrolu: **Σ košare po
ispravljenom danu mora dati iznos terećenja s RF-a** (isto pravilo kao MC, i isti razred kao
„zbroj košare je jači signal od sparivanja po retku“, S124).

⚠ **Redak koji već nosi `Izvod opis` SVEJEDNO dobiva ispravljen datum**, i to **nije**
kršenje pravila „potvrđen redak pripada točno jednom izvodu“: ta dva podatka dolaze s
**različitih** izvoda — PBZVISA kazuje *koje stavke, koji iznosi, koja rata*, RF izvadak
*kojeg dana i koliko je stvarno skinuto*. Svaki izvod potvrđuje **drugo polje**, pa se ne
prepisuju. Pravilo je štitilo od dva izvoda nad **istim** poljem; ovdje ih nema.

⚠ **Imena fileova nisu ujednačena: 31× `PBZVISA_`, 1× `PBZVIZA_`** (`2026-07`, i to je najnoviji,
onaj koji CLAUDE.md spominje po imenu). Alat koji glob-a jedno ime **preskace drugi, tiho** —
isti razred kao `Analizirani_izvodi/` selidba (S129). Glob mora biti `PBZVI[SZ]A_*`, ili se file
preimenuje.

⚠ Oblik rate se razlikuje i to je **već zapisano** u `rate_alat.py`: MC `X RATA n/N`,
Visa `RATA n/N-X`. Ostale razlike su formatske: dvoznamenkasta godina (`05.06.26.`),
referencija je 10 znamenki (ne `B0802…`), opis nosi **adresu** (`SPAR - MARTIĆEVA 13 - ZAGREB`).

### Čeka Sašinu odluku prije ijedne linije koda

> **Prazno je PODATAK, ne propust** (S141): trenutno ništa ne čeka Sašinu odluku, pa se
> nijedna stavka ne smije parkirati ovdje „dok se ne odluči“. Zadnji stanar je bio
> **PBZVISA prolaz** — odlučen u S141 i premješten u „Otvoreno“.

### Parkirano i izvedeno — ne traži akciju

> Ceka vanjski okidac, ili je vec izvedeno pa ostaje samo zbog ostatka koji je jos otvoren
> i zbog pretrage po imenu. **Preskoci pri planiranju sesije.**

**⚠ `Financije_all` i `financije-all` su DVA POLJA, ne dvije verzije istog imena** (S118).
Podvlaka je **ime aree** — ono što čovjek utipka i što stoji u Excel koloni `Area` i u `Category_Path`.
Crtica je **slug**, i **nikad se ne tipka**: app ga izvede iz imena (`generateSlug`, `_` → `-`,
`structureImport.ts:149`), a `037` i `dashboard`/`list_columns` reference traže baš `financije-all`.
Posljedica koja se ne vidi: nazove li se area na PROD-u ikako drukčije, slug ispadne drugi,
`037` ne nađe areu ⇒ **nema Overview taba**, i nigdje ne piše zašto. Izmjereno na TEST-u:
`name='Financije_all'`, `slug='financije-all'`. U repou nema nijednog pojavljivanja krivog
oblika (`Financije-all` 0×, `financije_all` 0×) — dakle nije tipfeler koji se čisti, nego
razlika koju treba znati pri **stvaranju aree na PROD-u**.

**Preimenovanje `Financije_all` → `Financije` — ODGOĐENO, s okidačem** (Sašina odluka S117).
Okidač **nije** „kad bude na PROD-u" nego **„kad prođe zadnji uvoz koji generira pipeline"**
(batch 2024 i 2023 idu **nakon** cutovera, na PROD — rename odmah po cutoveru ugrizao bi isto
kao rename danas). Razlog odgode: ime aree je **ključ** u svakom generiranom fileu (`Structure`
`Category_Path`, `ListColumns`/`Automations` kol. A, Activities kol. `Area`), a redak s
neprepoznatom areom se **preskoči bez poruke** — S113 „0 New, 0 Modify nad punim fileom".
Mijenjati taj ključ dok alati rade je razmjena kozmetike za tihi gubitak redaka.
⚠ **Kad dođe vrijeme, rename ide kroz UI, nikad kroz novi Structure import.** UI mijenja samo
`name` i **slug ostaje** (`StructureNodeEditPanel.tsx:1049`) ⇒ `037`, `dashboard` i
`list_columns` prežive jer su slug-based. Import bi izveo **novi** slug (`generateSlug(areaName)`,
`structureImport.ts:548`) i `037` ne bi našao areu ⇒ nema Overview taba.
⚠ Jedino što rename ionako ubija: `export_profiles` (ključ nosi ime aree,
`exportProfile.ts:146`) — složiti ih nanovo, posao od par minuta.

**⭐ Prijedlog `comment`a iz povijesti — IZMJERENO, parkirano (S130, Sašina odluka).**
Ideja: u delta sheetu ponuditi uobičajen opis na temelju `Tip`/`Podtip` i iznosa, jer
Koka čita bankovnu aplikaciju a Saša tipka — dakle `Izvod opis` (primatelja) **nema**.
Ne treba ponovno mjeriti; brojke su nad PROD-om, 5.153 retka:

| ključ (Izvor=Racun, zadnjih 12 mj) | pokriva | top-1 | top-3 | top-5 | top-10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `Podtip` | 335 | 57,6 % | 88,7 % | **93,4 %** | 98,5 % |
| `Podtip` + iznos | 193 | 76,7 % | 90,7 % | 93,3 % | 98,4 % |
| `Tip`+`Podtip` | 335 | 57,6 % | 88,7 % | 93,4 % | 98,5 % |

- **Iznos ne doda ništa**, a suzi pokrivenost s 335 na 193 retka — i upravo je on ono
  što se u Excelu ne da vezati na dropdown. Otpada i težak dio.
- **`Tip`+`Podtip` je identičan `Podtip`u sam** (samo 4 Podtipa žive pod dva Tipa, i
  spajanje im je korisno: `gorivo`/`registracija`/`popravci` pod dva auta). Znači ključ
  ostaje **jedna ćelija**, dakle ista INDIRECT formula od **424 znaka** kao postojeći
  `Podtip` dropdown — dva roditelja bi tražila **829**, a to je neprovjereno.
- **Prozor je bitniji od ključa:** cijela povijest umjesto 12 mjeseci ruši top-5 s
  93,4 % na 81,4 %, a najdužu listu diže s 14 na 41 stavku.
- **Ponuda, nikad upis:** top-1 je 57,6 % ⇒ automatski upis griješi dvije od pet.
  Isto pravilo koje već stoji uz `presedani.py`.
- ⚠ **Ne proturječi S129 pravilu** „ključ za oznaku je primatelj + poziv na broj, nikad
  Tip/Podtip". Ondje se oznaka **upisuje** na retke koji primatelja **imaju**; ovdje
  primatelja nema uopće, i ništa se ne upisuje nego nudi.
- Gdje ne pomaže: `PP (Posmrtna pripomoc)` ima 14 redaka i 14 različitih opisa, jer nose
  brojač (`PP Saša 6/60`). Tražilo bi rezanje broja iz presedana, kao za rate.
- Konkretna dobit ako se ikad napravi: `izmedju racuna` nudi
  `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (11×) — pravilo „opis skupne MC naplate mora
  ostati strojni tekst izvatka" danas živi samo u dokumentaciji.

**Drill s dva uvjeta** — `FilterContext` nosi jedan `attrFilter`, a uvjet pločice ima dva
(`Izvor` + `Status`), pa drill znači „pokaži mi ovaj račun", ne „točno ove retke".
Predviđeno u OVERVIEW_TAB_SPEC §2.16 kao test; ispalo da filtru fali mogućnost.
⚠ **Nije samo drill** (Sašin nalaz S118, iz stvarnog rada u appu): isto fali u **običnom
filtru** — „ZABA **i** samo uplate" (`Racun` + `Smjer`) korisnik ne može složiti. Time to
prestaje biti polish pločice i postaje svakodnevna potreba. Sašina odluka: **ne sada.**

**Netlify scheduled maintenance** — kad se skupi 2–3 zadatka: `netlify/functions/maintenance.ts`
sa `schedule = "@weekly"` (orphaned share_invites, stari accepted invites, stari help_log).

**Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi.

**Historijska migracija** `trening.xlsm` — bez vremenskog pritiska.

**Plotly bundle** ~4.9MB — prihvatljivo dok performanse nisu problem.

**Split-workbook** (Pravila + Neklasificirano u zaseban file nad app exportom) — kad Saša poželi.

---

**~~Kolone Activities liste po Arei~~ — ✅ IZVEDENO S116.** `settings.list_columns`,
slug-based, `ListColumns` sheet u Structure roundtripu, fixup na rename. Financije:
`Datum | Iznos | Tip / Podtip | Opis | User | Stanje | ⋮`, uski ekran u dva reda.
Pravila su promaknuta u „Critical rules". **Neverificirano uživo: T-S116-1…5.**
⚠ Ostalo neizvedeno: rječnik uloga se širi **samo kodom** (namjerno), pa nova vrsta
kolone (npr. `attr` s formatom broja) i dalje traži commit.

**~~⭐ Shortcuts po Arei — toggle u Filter panelu~~ — ✅ IZVEDENO S122** (Sašina ideja S119).
Kvačica „samo ova Area", `<optgroup>` po Arei, sufiks `0× · 25.06.` Provjereno usput:
`activity_presets.area_id` **se puni** pri spremanju (bila je otvorena sumnja), pa migracija
nije trebala. **Nije izvedeno i čeka brojke:** granica popisa („pokaži samo N") i s njom
stavka `Svi shortcutovi…`. Sašina odluka: *„nema smisla uvoditi granice bez stvarnog uvida"*
⇒ mjera se bira nad stvarnim brojem shortcutova, a prijedlog je da to ne bude broj nego
**Area** (1–2 najkorištenija po Arei). ⚠ Granica i `Svi shortcutovi…` idu **istim commitom**
— granica bez izlaza iz nje su jednosmjerna vrata (v. `FILTER_SPEC.md` §5).
Izvorna skica:
Popis shortcutova raste i **preduga lista nema smisla** — a većina ih pripada jednoj Arei.
Zamisao: **toggle u Filter panelu** koji popis suzi na shortcutove **odabrane Aree**;
isključen toggle pokazuje one koji su napravljeni **s isključenim togglom** (dakle
„globalne"). Shortcut napravljen unutar **Add Activity** po prirodi pripada Arei — ondje se
Area zna, pa se veže bez pitanja.
⚠ Prije koda razjasniti dvoje: (a) `activity_presets` već nosi `area_id` (v. `filter_state`)
— treba provjeriti je li **uvijek** popunjen, jer stari zapisi možda nisu; (b) što znači
„globalan" shortcut kad se Area filtar promijeni — nestaje li iz popisa ili ostaje.
⚠ **Preset je per-user i ID-based** (nikad ne putuje) — v. „Preset ≠ widget" u sažetku
Overview odluka. Ovo je čisto UI sužavanje popisa, ne nov oblik zapisa.

**~~Sidra se ne mogu vidjeti ni obrisati iz aplikacije~~** — IZVEDENO S116: pločica ima
„povijest potvrda" + ✕; uz to `data-prep_tools/Financije/anchors.py` (`--list`, `--delete`).
**Neverificirano uživo: T-S116-13.** Povijest: `DONE_HISTORY.md`.

**~~Sidro upisano kroz UI nema podrijetlo~~** — ZATVORENO: polje „odakle" (S113), **obavezno**
od S116 jer o njemu ovisi datum potvrde. Povijest problema: `DONE_HISTORY.md`.

**Stanje post-processing** — **otpada** (potvrđeno S109). `make_financije_import.py` prestaje
pisati atribut `Stanje` na Transakciju; vrijednost seli u zasebnu kategoriju `Stanja`.
⚠ **Postojećih 2220 zapisa se NE dira** — Kokin per-redak lanac je jedini **neovisni svjedok**
protiv kojeg se app-ov izračun može provjeriti. Prestani pisati, nemoj brisati.

## TypeScript known issue
[↑ Sadrzaj](#Sadrzaj)

`TS2688: Cannot find type definition file for 'vite/client'` — pre-existing, harmless,
does not block build. Ignore it.

---

## Session workflow (VSCode / Claude Code)
[↑ Sadrzaj](#Sadrzaj)

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
3. **Arhiviranje (inače se ne dogodi):** ⚠ prvo `python data-prep_tools/Tools/audit_tests.py`
   — ispisuje po session fileu koliko je testova ✅/⬜ i koji su **spremni za arhivu**.
   Korak je bio preskočen **tri sesije zaredom** jer se kriterij „svi testovi ✅" nije dao
   primijeniti dok su postojala dva popisa koja se ne slažu (kurirani redak je propuštao
   60 testova). Sada se broji, ne procjenjuje.
   - **⚠ SEKCIJA U `PENDING_TESTS.md` SELI ZAJEDNO S DETALJNIM FILEOM** (S140). Do tada se
     arhivirao samo `tests/SXX_tests.md`, a sekcija je ostajala — pa je PENDING narastao na
     **35 sekcija / 1.183 retka, od cega polovica zatvorena**, i „sto jos treba" se nije
     vidjelo. Sekcije bez ijednog ⬜ idu u `DONE_HISTORY.md` **u cijelosti** (retci prezive,
     pravilo S136 ostaje na snazi); oba filea su u `docs/sessions/` pa relativni linkovi
     prezive selidbu nedirnuti.
     ⚠ **Kriterij NIJE „sekcija je zelena"** — izmjereno da je to nesigurno: `T-S134-16` zivi
     pod sekcijom **S135**, dakle retci migriraju izmedju sekcija. Seli se samo sekcija koja
     (a) nema nijedan ⬜ **i** (b) ne drzi **jedini** redak za test cijem session fileu jos
     ima zivih testova. Bez (b) `audit_tests.py` javi „PENDING nema redak za" ⇒ zamijenio bi
     se jedan sum drugim.
   - session file čiji su **svi** testovi ✅ → `Claude-temp_R/test-sessions/archive/`
     (⚠ arhiviranje **izlazi iz gita** — arhiviran test je zatvoren, pa seli na radni stol)
     (⚠ **ne po starosti** — otvoreni testovi sežu unatrag više sesija)
   - **⚠ RETCI SE NE BRIŠU IZ TABLICA, NEGO DOBIVAJU ✅ + RAZLOG** (S136). Brisanje ih
     pretvara u „bez oznake u PENDING", a o takvom se retku ne može donijeti **nijedna**
     odluka — ni zatvoriti ga ni otvoriti. Tako su `S99`–`S105` stajali kao „poznata rupa"
     od S116 do S136. Razlog se upisuje u ćeliju statusa (`✅ S136 — nadiđeno upotrebom`,
     `✅ S136 — čuva automatski test`, …), pa se odluka poslije ne čita kao „staro je".
   - **Pet kriterija za zatvaranje** (S136, svaki traži dokaz): izmjereno u ovoj sesiji ·
     čuva ga automatski test · izvela ga novija sesija · alat/podaci više ne postoje ·
     **nadiđeno upotrebom** (feature je na PROD-u i ponašanje je otad izmjereno drugim
     putem). ⚠ Šesta mogućnost nije zatvaranje nego **sažimanje**: 14 ručnih koraka se
     neće izvesti nikad, dva hoće (`T-S131-6..24` → `T-S136-3`).
   - **⚠ `audit_tests.py` je do S136 bio SLIJEP za sufikse `-A7`/`-B5`** — regex je iza
     crtice tražio samo znamenke, pa **15 testova iz S129 nije vidio** i sesiju je
     prijavljivao kao *„svi ✅, spremno za arhivu"* dok su unutra stajala **4 otvorena**.
     Popravljeno, ali pouka je šira: **skripta koja miče sekcije mora odbiti maknuti onu
     u kojoj postoji ijedan ⬜** — guard je uhvatio ono što alat nije. ⚠ I guard mora
     gledati **samo tablične retke** (`|`), inače ga zapali ⬜ u običnom tekstu.
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
   NIKAD ne pushati/mergati na main samoinicijativno.
   ⚠ **Merge pušta Saša** — auto-mode klasifikator Claudeu blokira `main` (izmjereno S136),
   pa se naredbe **daju njemu**, ne pokušavaju same.
   ⚠ **Njegova ljuska je Windows PowerShell 5.1, koji NEMA `&&`** — zalijepljen bash oblik
   daje `The token '&&' is not a valid statement separator in this version` i **ništa se ne
   izvrši** (parser odbije cijelu liniju, pa bar nema polovičnog stanja). Ovdje je dotad
   stajao bash oblik i u S136 je poslan doslovno — zato ovaj zapis:
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
   Bez sync-backa (zadnja tri retka) `test-branch` zaostaje za `main`.

### ⚠ Test pravila mora se razlikovati od onoga što pravilo proizvodi (S129)

T-S127-9 („otvaranje retka ne smije ništa promijeniti") prvi je put pušten na Visa
retku `28.08.2026.` čiji je `Datum naplate` bio `03.09.2026.` — a to je **točno ono
što `next:3` izračuna**. Da se pravilo pogrešno okinulo na otvaranju, vrijednost bi
ostala **ista**, i test bi prošao nad pokvarenim kodom.

Izmjereno: od **1.619** Visa redaka samo ih je **11** naplaćeno 3. u mjesecu
(5. → 719, 4. → 400, 6. → 176, 7. → 137, 12. → 63, 8. → 62, 11. → 50, **3. → 11**).
Dakle vjerojatnost da se slučajnim odabirom pogodi neupotrebljiv redak je mala, ali
je **upravo to što se dogodilo**.

Ponovljeno na retku koji se od pravila razlikuje **4 dana** — prošlo.

**Pravilo:** kad se testira automatika, redak se bira tako da se **razlikuje** od
njezinog rezultata. Inače test ne mjeri ništa, a izgleda kao da mjeri.
Isti razred kao „Test koji nikad ne pada ne čuva ništa" (S120).

### Test result reporting (next session)
Korisnik kaže npr. „T-S24-1 OK, T-S24-3 fail" → Claude ažurira PENDING_TESTS.md i istražuje
padove prije novog koda. Za E2E: „pao E2-2" → Claude čita `e2e/test-results/` artefakte.
