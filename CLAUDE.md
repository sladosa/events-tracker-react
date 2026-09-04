# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**PROD:** <https://events-tracker-react.netlify.app> (Netlify deploya **samo** `main`)
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` (dev), `main` = PROD (Netlify deploya samo main)

> **Povijest po sesijama je u `docs/sessions/DONE_HISTORY.md`** (S1–S127).
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
| `docs/FILTER_SPEC.md`                     | **Nadogradnja filtra** (prijedlog prije koda, S122) — jedan uvjet ⇒ lista uvjeta, RPC granica, shortcutovi po Arei, faze |
| `docs/RULES_ENGINE_SPEC.md`               | **Pravila razvrstavanja** (prijedlog prije koda) — pravila u bazi uz Areu, konflikt se prijavljuje umjesto da ga odluči redoslijed |
| `docs/Analytics_tab.md`                   | **Cross-Area** analitika — `periods`, Series, AnalyticsDef Excel. Čeka drugu gustu Areu. ⚠ §3 („bucketiranje client-side") je opovrgnut u OVERVIEW_TAB_SPEC §2.2 |
| `docs/PLAYWRIGHT_E2E_GUIDE.md`            | E2E test setup i workflow                                                        |
| `docs/HELP_STRUCTURE.md`                  | Help sistem — chip map, context detection, Content Evolution Protocol            |
| `data-prep_tools/DATA_PIPELINE_PLAN.md`  | Migracija podataka — prioriteti, Dirty Excel workflow, PROD checklist            |
| `data-prep_tools/Financije/ENRICH_PLAN.md` | Financije pipeline — alati, koraci, nalazi po sesijama                          |
| `docs/KOKA_PRVI_MJESEC.md`                | **Prije nego Koka počne** — što je riješeno, što nije, i redoslijed po riziku za njeno povjerenje |
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

**Uvoz — tri načina da „uspije" a ne napravi što misliš (S118)**

- **⚠ Stari keširani bundle tiho osakati Structure import.** Prvi uvoz na PROD prošao je
  sa `Areas 1 / Categories 1 / Attributes 15` i izgledao potpuno — a **nije upisao**
  `comment_template`, `add_header`, `list_columns`, `hidden_in_add` ni drugo automation
  pravilo. Netlify je imao aktualan build; preglednik je vrtio stari. Vidjelo se **samo**
  po tome što modal nije imao retke `Settings updated` i `List columns` — brojači koji u
  novijoj verziji postoje. **Hard refresh (Ctrl+Shift+R) je dio postupka**, ne higijena.
- **⚠ „Import as mine" pokaže `0 New / 0 Modify`, a uvoz ipak radi** (BUG-S118-PREVIEWMODE,
  v. Open bugs). Ne odustaj na temelju preview brojki.
- **⚠ `et_activity_draft` nije vezan uz korisnika** (`src/types/activity.ts:226`). Jedan
  ključ po pregledniku ⇒ nedovršen nacrt napravljen pod jednim računom iskoči kao
  „Resume Previous Session?" pod **drugim**, i nudi kategoriju iz tuđe aree. Bezopasno
  dok se klikne Discard, zbunjujuće kad se ne zna odakle.
- **Delete Area kroz UI radi kad su SVI zapisi tvoji.** Pravilo nije „UI nikad ne uspije"
  nego: padne kad postoje retci koje RLS skriva (tuđi ili osirotjeli). Kokina stara
  `Financije` (357 eventa, svi njeni) obrisana je kroz UI čisto, s backupom prije brisanja.

**Model / atributi**

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

**Collab — što grantee NE može**

- **⚠ Grantee ne može spremiti Export/Import profil, ni s `write` dozvolom** (S122). Dva
  nezavisna zida: app ga zaustavi prije upisa (`ExcelExportModal.tsx:557`, uvjet je
  `if (sharedContext)` — dakle **svaki** grantee, ne samo read), a i da ne zaustavi, RLS na
  `areas` dopušta UPDATE **samo vlasniku** (`009_sharing.sql`: „INSERT/UPDATE/DELETE unchanged
  (only owner writes)"). Profili žive u `areas.settings`, zajedno s `automations`, `dashboard`
  i `list_columns` — dakle write-grantee koji bi ih smio pisati mijenjao bi **cijelu Areu
  vlasniku**. Ponašanje je zato ispravno; **poruka nije**: piše „(read-only access)" i
  write-grantee-u, što je neistina o njegovim pravima.
  ⚠ Isto vrijedi za svaku buduću per-Area konfiguraciju: **`areas.settings` je vlasnikov**.

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
- **`Izvod opis` se skraćuje za uvod, `(m-zaba)` ostaje** (S126). Sigurno je za
  sparivanje jer `kljuc_izvoda` isti uvod ionako skida prije nego napravi ključ —
  stari (dugi) i novi (kratki) zapisi se i dalje poklapaju.
- **Žigosanje postojećih redaka (`--zigosi`) ide SAMO na točan par** (datum + iznos
  + smjer). Tolerancija na datum bi ovdje bila opasna nevidljivo: `Cash 100,00` se
  ponavlja svakih par tjedana (S114), pa bi prvi bankomat pokupio potvrdu nekog
  kasnijeg — iznos se i dalje slaže. **Popunjena ćelija se ne dira**: postojeća
  potvrda je dokaz nekog drugog izvoda.

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
  prije klika ispiše *„saldo = X plus sve datirano nakon <datum>; sve prije toga smatra se već
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
- **Baza drži UTC, app prikazuje lokalno** (+2h ljeti). DB `07:00` = UI `09:00`. Bitno kad se
  traži slobodan `session_start` — kolizija se računa na razini minute.

**Prije svakog commita:** `npm run typecheck && npm run build` (⚠ `npm` se pokreće **iz
direktorija projekta**, inače ENOENT `package.json`; Browserslist poruka je upozorenje, ne greška)

---

## Zamke (data pipeline / AI / E2E)

**Python alati (`data-prep_tools/`)**

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
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u fileu)
  ⇒ ubačeni redak mijenja ključeve svih redaka tog dana iza njega
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

**E2E (Playwright)**

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
data-prep_tools/Financije/uskladi_izvod.py
                                   Jedan izvod ↔ baza ↔ Kokin file. Četiri sekcije po
                                   tome TKO ODLUČUJE + `--file` review workbook za Koku.
                                   Zamjenjuje `kosara_naplate.py` za `Datum naplate`.
data-prep_tools/Financije/primijeni_uskladu.py
                                   Upisuje nalaz na PROD (ispravci + dopune + brisanja),
                                   jednim potezom, s backupom i brojanjem redaka.
data-prep_tools/Financije/presedani.py
                                   `Tip`/`Podtip` brojanjem povijesti RACUNA.
                                   Tri kljuca: primatelj+poziv > primatelj > iznos
                                   (s predznakom). Ne pogadja — sto nije
                                   jednoglasno ostaje `N/A`.
data-prep_tools/Financije/pregled_stanja.py
                                   Jedan file koji odgovara "je li stanje tocno":
                                   Pregled (svi izvodi + sidra) · Sporno (redak po
                                   redak, banka vs baza, autofilter) · 2023.
                                   ⚠ Kokina Excelica se NE oznacava — v. zaglavlje.
data-prep_tools/Financije/promet_check.py
                                   Promet po izvodu, app vs banka. Ne prolazi kroz
                                   sidro ⇒ jedini instrument za ZASIDREN mjesec,
                                   gdje `--report` po konstrukciji daje nulu.
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
- **Shortcutovi po Arei (S122):** kvačica „samo ova Area" uz `⚡ Shortcuts` (stanje po
  pregledniku, `et_shortcuts_area_only`), `<optgroup>` po Arei u punom popisu, sufiks
  `0× · 25.06.` (`usage_count` + `last_used`). **Bez granice po broju** — v. „Backlog".
- **Overview (S108):** tab po Arei, postoji **samo** uz `settings.dashboard` (OQ-4). Pločica
  `balance_by_group` sa sidrom i `✓/Δ` čipom, drill u Activities, izračunata kolona `Stanje`.
  Agregacija ide u Postgres (`rpc_area_group_agg`, `rpc_area_balance_anchored`) — nikad u preglednik.

---

## Izmjereno i **nije** problem — ne trošiti vrijeme ponovno

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

## Open bugs

- **~~BUG-S123-DELTAACCT~~ — ✅ POPRAVLJENO S123.** Delta sheet je uzimao račun iz
  **živog filtra**, a evente iz profila; presjek prazan ⇒ file s točnim sidrom i
  nula redaka. Sada `deriveDeltaAccount()` (`exportProfile.ts`) + upozorenje na
  praznu sekciju. Čuva `src/lib/__tests__/deltaAccount.test.mjs` (11 slučajeva).
- **~~BUG-S123-EDITMARK~~ — ✅ POPRAVLJENO S125.** Oznaka ✎ nije se prikazivala
  jer redak renderiraju **dva različita mjesta**, a oznaku je imalo samo jedno:
  `cellContent('actions')` (desktop, `tr.hidden.sm:table-row`) vraćao je goli
  `menuButton`, dok ju je sticky ćelija uskog retka (`tr.sm:hidden`) crtala.
  Playwright vrti 1280 px ⇒ **test je cijelo vrijeme govorio istinu**, a tražilo
  se na krivom mjestu (mrežni odgovor, locator, stale bundle). Otkriveno tek kad
  je Saša pogledao **oba ekrana** na PROD-u: uski je pokazivao ✎, široki ne.
  ⚠ Na krivi trag je odveo komentar iznad `editedMark` koji je tvrdio „na oba
  rasporeda" dok je kod radio jedan — isti razred kao PROD slug trigger (S118).
  Čuva `T-S123-3` u `S123_owner_edits_grantee_row.spec.ts` (mijenja viewport).
- **BUG-1:** `useFilter must be used within a FilterProvider` (`AppHome.tsx:105`) — vjerojatno
  StrictMode artefakt, nizak rizik
- **BUG-S103-ANYATTR:** „In any attribute" filter (`ATTR_FILTER_ANY`) timeouta za grantee-e —
  `ILIKE` nije leakproof pa Postgres evaluira RLS EXISTS nad cijelom `event_attributes`.
  Privremeno: amber notice u UI. **Pravi fix = SECURITY DEFINER RPC — isti sloj kao Faza 1.**
- **E8-2 Area select timeout:** grantee-write test padne na `selectOption` (element disabled) —
  moguće isti family kao BUG-S103-ANYATTR
- **E7-2/E7-3:** Toast „Access granted" izostaje u invite flowu — UX polish
- **~~T-S107u-2~~ — ✅ POPRAVLJENO S117.** Oscilacija je bila **zatvoreni krug preko obje
  strane**, ne samo uvozna greška: **export** za `depends_on` atribut svakim retkom prepiše
  `defaultVal` vrijednošću iz `default_map`, pa se atributov vlastiti `default_value` **nikad
  ne zapiše**; **import** je onda čitao `Default` s prvog takvog retka natrag **kao atributov**.
  Otud `Izvrsen`↔`null`. Sada `defaultVal: row.dependsOn ? '' : row.defaultVal` — kod
  `depends_on` atributa vlastitog defaulta nema, a po vrijednostima žive u `default_map`u
  (dvoje bi bilo dvosmisleno: forma ne bi znala koje pobjeđuje).
  ⚠ Bug je bio označen „bezopasno" jer `default_value` nitko nije čitao. **To je prestalo
  vrijediti u S117**, kad ga je skrivanje-na-defaultu počelo čitati — `Status` bi počeo
  nasumično nestajati iz forme. Zabilježeno kao obrazac: „bezopasno" vrijedi **dok** nitko ne
  čita, i prestaje bez ijedne poruke.
- **~~BUG-S115-ANCHORDATE~~ — ✅ POPRAVLJENO S116.** Datum potvrde više se ne izvodi iz
  filtra nego iz **izvora**: `ekran bankovne aplikacije` ⇒ danas (app upisuje sam),
  `izvod`/`ispis` ⇒ **prazno polje koje korisnik popuni s papira**. Izvor je postao obavezan
  (bez njega gumb ne radi), jer o njemu ovisi datum. Uz to: rečenica o posljedici prije klika,
  upozorenje kad novija potvrda već postoji, popis potvrda s brisanjem, i guard protiv
  budućeg datuma u `saveAnchor()`. **Neverificirano uživo: T-S116-10…13.**
  ⚠ Popravljeno je i konkretno sidro (`22.08.` → `30.07.`, Sašin ručni ispravak u Supabase
  editoru). RF `11.08. = 799,12` je **provjeren i točan** — `RF_2026-07.pdf` se zatvara
  11.08. (zadnja tx `Mirovina III stup 254,33`).
- **BUG-S114-REPORTDD:** izvještaj o uvozu **nema `DropdownData` list** (`Events / HelpEvents /
  ImportReport / Filter`), pa u njemu `Tip`/`Podtip` nemaju padajući izbornik. Za pipeline
  nebitno, **za Koku bitno**: izvještaj je mišljen kao mjesto gdje dorađuje uvezeno, a ondje bi
  tipkala slobodan tekst bez ijedne provjere. Fix = nositi `DropdownData` kao i običan export.
- **~~BUG-S118-PREVIEWMODE~~ — ✅ POPRAVLJENO S120.** Modal parsira file **prije** nego pita
  što s tuđim retcima, pa prvi prolaz može samo pretpostaviti `skip`. Popravak nije bio „jedan
  argument" kako je ovdje pisalo nego **ponovna analiza s odabranim načinom** prije prikaza
  previewa (`analyzeFile(file, mode)`). Izmjereno prije/poslije na fileu s tuđim emailom:
  prije — **nijedna** kolizija, dakle Apply bi ubacio duplikate bez poruke; poslije — **2 od 2**
  retka prijavljena, `⏭ All skipped`. Čuva `e2e/tests/e17-import-foreign-preview.spec.ts`.
  Stari opis:
  `ExcelImportModal.tsx:106` zove `parseExcelFile(file, userEmail)` **bez** `foreignMode`,
  pa preview uvijek računa po `skip` — kod tuđeg filea pokaže **`0 New / 0 Modify`** baš
  u trenutku kad korisnik odlučuje hoće li uvoziti. Apply putanja
  (`excelImport.ts:1864`) prosljeđuje `foreignMode` i uvoz **radi**.
  ⚠ Gore od krive brojke: preview je taj koji računa **provjeru kolizija**, a ona je nad
  praznim skupom, pa za „Import as mine" **otpada zaštita od dvostrukog uvoza istog filea**.
  Izmjereno S118 na 3×1000 redaka (uvoz prošao, preview lagao sva tri puta).
  Fix je jedan argument; nije napravljen jer bi tražio deploy usred migracije.
- **~~BUG-S119-FILTERBACK~~ — ✅ POPRAVLJENO S120.** Sumnja na `ProgressiveCategorySelector`
  bila je **kriva**: krivac je `AppHome`ov reset-efekt, koji se okida i pri montiranju
  (v. „UI (React)"). Izmjereno logom u `setFilter`, ne zaključivanjem. Stari opis: drill s Overview pločice postavi
  `attrFilter` (npr. `Racun`), ali nakon **View Details pa natrag** lista se vrati na **sve
  račune**. Korisnik je otvorio jedan redak da ga pogleda i izgubio kontekst u koji se vraća.
  ⚠ Nije stanje konteksta: `/app/*` dijeli **jedan** `FilterProvider` (`App.tsx:110`), a
  `/view/:sessionStart` je unutar njega — dakle `filter.attrFilter` bi trebao preživjeti.
  Sumnja pada na **remount filter panela** pri povratku na `AppHome` i njegov init
  (`ProgressiveCategorySelector` zove `clearAttrFilter()` na više mjesta, `:212`/`:218`).
  **Isti razred kao S111** (`DateRangeFilter`: auto-init je prepisivao korisnikov raspon čim
  se komponenta odmontira) — a taj se bug tada činio „povremenim", a bio je determinističan.
  ⇒ Prvo **izmjeriti** kad se točno `attrFilter` gubi (drill → View → natrag, s logom u
  `setFilter`), pa tek onda popravljati. Vrijedi provjeriti i vraća li se **kategorija** i
  raspon datuma, ne samo `attrFilter`.
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
- **~~BUG-S121-DRAFTDUP~~ — ✅ POPRAVLJENO S121.** `finish()` je zvao `clearDraft()` ali ne i
  `stopAutoSave()`, pa je nacrt uskrsnuo i sljedeći unos postao **duplikat**. Sada
  `clearDraft()` sam gaši auto-save (invarijanta, ne disciplina) + `sessionFinishedRef`.
  Čuva `e2e/tests/S121_draft_after_finish.spec.ts`. **Neverificirano uživo: T-S121-3/-4.**
- **~~BUG-S121-AUTOSAVE~~ — ✅ POPRAVLJENO S121.** Auto-save se naoružavao iznova na svakom
  renderu pa **nikad nije opalio tijekom unosa** — v. „UI (React)“. Posljedica koja se nije
  vidjela: Koka nije imala nikakvu zaštitu od gubitka unosa (jedini upis nacrta bio je
  `Save +`, a Financije ga imaju ugašen). Sada interval 5 s, naoružan jednom po sesiji, uz
  preskočan upis kad se sadržaj nije promijenio.
- **~~BUG-S121-AREACTX~~ — ✅ POPRAVLJENO S121.** Palo čitanje `areas` gašilo je Overview tab,
  kolone i „Write access“ baner **trajno, do reloada** — v. „UI (React)“. Sada `withRetry`,
  zadržavanje već učitanog za istu Areu, i **amber traka s „Pokušaj ponovno“**.
  Čuva `e2e/tests/S121_area_context_failure.spec.ts` (3 slučaja).
  ⚠ Retry **skriva uzrok, ne liječi ga**: na PROD-u je to vjerojatno S105 obrazac
  (free-tier se guši). Pravi potez ostaje **Postgres upgrade**, otvoren od S105.
- **~~`e16-filter-persistence` je flaky~~ — ✅ ZATVORENO S122.** Nije bio filter reset nego
  ⋮ izbornik koji remount liste odnese čim se otvori — v. „E2E“. Popravak je u specu.
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

**Otvoreno:** `845,12` (planiran, 11.07.2026.) — nije ni na izvodu ni u Kokinom fileu ⇒ pitanje
za nju · dva njena retka datirana `2036-04-08` (`Mirovina 1.323,64`, `Netdomena Igor 47,76`) —
tipfeler za 2026. · red 2115 (LJEKARNA OREBIC) → Medical_Sasa treba postati Medical_Koka;
N/A petlja (`suggest_candidates.py`) za 2024/2023; preostali kandidati za pravila
(`paypal`, `spotify`, porez grupa, `leasing`, `bmove`, `keks pay`, `zagrebparking`).

---

## Sljedeći koraci (2026-08-23, S116)

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
| ~~**3**~~ | ✅ **GOTOVO S114.** ZABA banka: 31 novi + potvrda `1.244,74`. Izvod nosi 38 tx, 7 ih je baza imala. `845,12` **obrisan u S115** (postojao samo u snimci od 08.07., bez datuma i opisa ⇒ ostatak, ne transakcija). | ✅ **ZABA @ 30.07. = 13.815,33** (ispisano). ⚠ `14.722,84 @ 09.08.` traži još ~15 Kokinih redaka od 02.08. — izvod ih ne pokriva. |
| **4** | MC iz `MC_2026-07`: 45 stavki (12 ih baza već ima) + naplata `1.332,52`, **plus cijeli kolovoz iz Kokinog filea**. S116 izmjerio i pripremio: ZABA **14** novih redaka (02.–13.08.), RF **1** (18.08.). Alat: `fill_from_izvod.py --iz-koke`. ⚠ Redak 2564 (`07.08. Parking 1,60`) je tipfeler u mjesecu — već u bazi kao 07.07. ⇒ `--osim 2564`. | **ZABA @ 13.08. = 13.239,31** (njen lanac to daje u cent, izmjereno S116) · **RF = 796,43** |

⚠ **Tranša 4 više NIJE preduvjet za PROD** (S115). Sidro prikazuje račun i bez ijednog eventa
(`036`, T-S115-2) ⇒ Koka može upisati stanje sa svog ekrana banke i saldo je od tog trena točan.
Kolovoz se uvozi **zbog zapisa**, ne zbog salda — a Kokin file je u međuvremenu otišao dalje:
`Financije 2026-08-16.xlsx` ima **87 redaka nakon 30.07. na „koka EU" i 68 na „sasa EU"**,
od kojih je u bazi **6**. Tranša 4 je time narasla iz „MC paket" u „MC paket + cijeli kolovoz".

⚠ **Skupna naplata se NE sintetizira, a njen datum je DOSPIJEĆE s izvoda** (S117).
`MC_2026-07.pdf` piše `Datum dospijeća: 11.08.2026.` i `UKUPNO (EUR): 1.332,52`. Isto potvrđuje
povijest: skupna MC naplata pojavljuje se na **ZABA izvatku** kao `TROŠKOVI UČINJENI MASTERCARD
KARTICOM`, uvijek **11. u mjesecu**, osam mjeseci zaredom (`Izvodi_transakcije.xlsx`). Dakle nije
na MC izvodu nego na izvatku tekućeg — a dok `ZABA_2026-08.pdf` ne stigne, iznos i datum dolaze
s MC izvoda. ⚠ **Opis mora ostati strojni tekst izvatka**, ne „Mastercard": svih 18 prijašnjih
MC naplata ga nosi, pa bi varijanta razbila brojanje po opisu (`klasificiraj_transu.py`).
⚠ Ostalo netaknuto: `PBZVIZA_2026-07.pdf` sadrži `1.171,59`, a
`PBZVIZA_2026-07.pdf` `1.171,59`, oboje u cent jednako Kokinim grupama. Banka ih je ispisala.

✅ **Onih 5 spornih redaka — RIJEŠENO S126, izvodom.** `207,26`, `57,19` i `13,31` doista
jesu kolovoški, i to `T-mobile`, `Nataša Holding` i `Bulatova plin` — svi stoje na
`ZABA_2026-08.pdf` (16.–17.08.). U bazi ih pod lipanjskim datumom **nije bilo** (provjereno
po svim računima), pa duplikata nema; uvezeni su s ispravnim datumom. Stari opis:
`207,26`, `57,19` i `13,31` **nisu na `ZABA_2026-06.pdf`** — najvjerojatnije kolovoški
računi s krivim mjesecom. Uvezeni s lipanjskim
datumom padaju **prije ZABA sidra** (01.07.) i po pravilu „strogo nakon" tiho ispadaju iz salda.
Tranša 4 ih rješava: ostane li `13.239,31` bili su duplikati, postane li `12.866,20` bili su stvarni.

### ~~`Datum naplate` — otvoreno~~ — ✅ ZATVORENO S124, izvodom

**`MC_2026-06.pdf` je cijelo vrijeme bio u `izvodi/Analizirani_izvodi/`.** S123 je zaključio
„pravilo je iscrpljeno, ostatak može razriješiti samo `MC_2026-06.pdf`" — **ne provjerivši
je li već tu.** Pouka šira od ovog slučaja: prije nego proglasiš da nekog izvora nema,
pogledaj podmape; `Analizirani_izvodi/` drži svih 30 MC i 31 Visa izvoda.

S papirom u ruci raspodjela iz S123 (40 OK / 21 RATA / 11+1 KRIVI MJESEC) **nije bila
točna** — bila je najbolje što se dalo bez izvoda. Stvarno stanje košare 11.07.:

| | redaka | Σ | dokaz |
| --- | ---: | ---: | --- |
| na izvodu 11.07. | **48** | **1.244,74** | 48/48, nula redaka izvoda bez para |
| duplikat (`LH 1/3` ×2) | 2 | 126,66 | isti trošak dvaput |
| pripada izvodu 11.08. | 23 | 859,62 | `MC_2026-07.pdf` |

**Cijela MC povijest 2026. zatvara se u cent na svih 7 izvoda.** Alat:
`data-prep_tools/Financije/uskladi_izvod.py` (v. „Ključni alati"). `kosara_naplate.py` je
time umirovljen za ovu svrhu.

⚠ Skupna MC naplata od **11.07. ima prazan `comment`**, dok ostalih 18 nosi strojni
tekst `TROŠKOVI UČINJENI MASTERCARD` — jedan prazan redak izmiče brojanju po opisu.
Jedino što je ovdje ostalo otvoreno.

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
7. (82×), 11. (49×), 3. (11×). Posljedica: kontrola po košari, koja pretpostavlja fiksno
dospijeće, **ne vidi 855 Visa redaka** — ne padaju ni u jednu košaru. MC je čist (4 retka).
Traži zaseban prolaz s PBZVISA izvodima; ne popravljati napamet.

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

### PROD — ✅ IZVEDENO 2026-08-25 (S118)

**Koka radi na PROD-u.** Area `Financije_all` (`de8662e6-54f7-4ded-ab42-a786e7456067`,
slug `financije-all`) pod **njenim** računom (`dubravka.pavic-sladoljev@dps-perceptum.com`,
`eeb78414`), Saša je **write grantee**. Puštene migracije: `035`, `036`, `038` (RPC + sidra),
`039` (čišćenje siročadi), `040` (poravnanje slugova), `041` (dashboard config),
`042` (slug trigger). Kod je na `main` od 24.08. (S108–S117), Netlify deployao.

**Podaci: 2.312 eventa** (`2025-01-01 … 2026-08-25`), preseljeni **Excel roundtripom iz TEST-a**
— tri filea po 1000 redaka, „Import as mine". Nije korišten pipeline: TEST nosi sve ispravke
iz S110–S117 kojih u Review workbooku nema, pa bi regeneriranje bilo korak unatrag.

**Provjereno mjerenjem, ne dojmom:**
- `uplata`/`isplata` po računu **identične TEST-u u cent** (478/478 i 209/209 redaka)
- sidra s izvoda: ZABA `13.815,33 @ 30.07.` · RF `799,12 @ 11.08.`
- ⇒ pločica daje **`13.239,31`** (ZABA) i **`796,43`** (RF) — isti brojevi kao TEST,
  kroz drugu bazu, drugog vlasnika i „Import as mine"

**Stare aree:** Kokina `Financije` (357 eventa) **obrisana** — prije brisanja izmjereno da
svih 357 ima pokriće u novoj arei (199 ih je samo drukčije datirano zbog D1b; jedini prividni
manjak, `7,63` vs `7,83` „Chromos - Konzum" 29.06., bio je skoro-duplikat razreda S111).
Sašina `Financije_old` (2.774 eventa, `2023-01-01 … 2025-12-27`) **ostaje** — jedina kopija
2023./2024. na PROD-u dok ti batchevi ne prođu pipeline. Share prema Koki maknut.

**Ostalo za nju:** upisati svoje sidro s ekrana banke kad krene (nije nužno — sidra s izvoda
već drže saldo) i jedna rečenica: **kad počne upisivati u app, u Excelicu više ne.**
Radi li oboje, sve dobijemo dvaput — a to se neće vidjeti dok se saldo ne raziđe.

⚠ **Izvodi su samo PDF** — ni ZABA ni PBZ ne nude CSV/Excel (potvrdio Saša, S115). Ideja
„app čita izvod" zato znači **pisanje novog čitača PDF-a**, i **imenovana je i odložena**:
PDF-ove i dalje čita Sašin Python alat. Vrijednost te ideje nosi njezin drugi dio —
**pravila u bazi + evaluacija na uvozu** (Faza 3), koji PDF uopće ne dira.

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
  **„Potvrdi na <budući datum>"**, čime bi sidro po pravilu „strogo nakon" **presjeklo sve
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

## S112+: Intelligence layer

Sjeda **na** Overview, ne umjesto njega. Success criteria se definiraju kad Faza 3 prođe.
(Broj pomican četiri puta — S108, S109, S110, S111 su zauzeli mjesto.)

---

## Backlog

**~~Kolone Activities liste po Arei~~ — ✅ IZVEDENO S116.** `settings.list_columns`,
slug-based, `ListColumns` sheet u Structure roundtripu, fixup na rename. Financije:
`Datum | Iznos | Tip / Podtip | Opis | User | Stanje | ⋮`, uski ekran u dva reda.
Pravila su promaknuta u „Critical rules". **Neverificirano uživo: T-S116-1…5.**
⚠ Ostalo neizvedeno: rječnik uloga se širi **samo kodom** (namjerno), pa nova vrsta
kolone (npr. `attr` s formatom broja) i dalje traži commit.

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

**Roundtrip completeness** — `export_profiles` (ključ `attr:Area||CatPath||AttrName` ne preživi
rename; fix = `ExportProfiles` sheet, isti obrazac kao `Automations`) **i `dashboard`**
(fix = `Dashboard` sheet, Faza 4). „From template" je riješen u S108.

**~~Sidra se ne mogu vidjeti ni obrisati iz aplikacije~~ — ✅ IZVEDENO S116.** Pločica ima
„povijest potvrda" (▸ označava onu od koje saldo kreće) i ✕ za brisanje; `listAnchors()` i
`deleteAnchor()` se konačno zovu. Uz to postoji i `data-prep_tools/Financije/anchors.py`
(`--list`, `--delete`) za rad izvan aplikacije. **Neverificirano uživo: T-S116-13.**
⚠ Blokada je **otpala** (§2.18 — sidra ostaju zasebna tablica), pa se ovo sada smije graditi.
⚠ **S115 je dao drugi slučaj u dvije sesije** (krivo datirano sidro, BUG-S115-ANCHORDATE) —
dakle nije jednokratni promašaj nego izostanak koraka. Postalo je i konkretnije: u S111 je jedno
sidro upisano s tipfelericom (3.453,03 umjesto 3.458,03) i **ispravlja se samo novim retkom** — bez popisa u UI-ju korisnik ne vidi da uz
važeće sidro stoji i ono krivo.

**~~Sidro upisano kroz UI nema podrijetlo~~ — ✅ ZATVORENO** (polje „odakle" u S113,
**obavezno** od S116 jer o njemu ovisi datum potvrde). Ostatak ispod je povijest problema.
Izvorni opis (S110) — `balance_anchors.note` postoji, skripta ga
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

**Lista se preupita ŠEST puta na jednu promjenu filtra** (izmjereno S122 iz Playwright
tracea: `events?select=…` na 16664, 16735, 16832, 16909, 17022, 17098 ms nakon promjene
aree). Dvije posljedice: čist trošak — a na PROD-u je Saša **grantee**, dakle skupa RLS
grana (v. „Izmjereno i nije problem") — i **osvježavanje zatvara otvoren ⋮ izbornik**, što
korisnik vidi kao „meni mi se sam zatvorio". Drugo je posljedica prvog, pa se mjeri zajedno.
⚠ Nije hipoteza nego mjerenje, ali **uzrok kaskade nije utvrđen** — prije popravka izbrojati
tko sve okida refetch (`useDateBounds` settle, `areas-changed`, promjena `attrFilter`).

**Drill s dva uvjeta** — `FilterContext` nosi jedan `attrFilter`, a uvjet pločice ima dva
(`Izvor` + `Status`), pa drill znači „pokaži mi ovaj račun", ne „točno ove retke".
Predviđeno u OVERVIEW_TAB_SPEC §2.16 kao test; ispalo da filtru fali mogućnost.
⚠ **Nije samo drill** (Sašin nalaz S118, iz stvarnog rada u appu): isto fali u **običnom
filtru** — „ZABA **i** samo uplate" (`Racun` + `Smjer`) korisnik ne može složiti. Time to
prestaje biti polish pločice i postaje svakodnevna potreba. Sašina odluka: **ne sada.**

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
3. **Arhiviranje (inače se ne dogodi):** ⚠ prvo `python data-prep_tools/Tools/audit_tests.py`
   — ispisuje po session fileu koliko je testova ✅/⬜ i koji su **spremni za arhivu**.
   Korak je bio preskočen **tri sesije zaredom** jer se kriterij „svi testovi ✅" nije dao
   primijeniti dok su postojala dva popisa koja se ne slažu (kurirani redak je propuštao
   60 testova). Sada se broji, ne procjenjuje.
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
