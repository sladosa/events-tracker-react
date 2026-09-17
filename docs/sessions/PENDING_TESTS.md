# PENDING TESTS

> **Arhivirani session fileovi izlaze iz gita** (ritual, korak 3): sele u
> `Claude-temp_R/test-sessions/archive/`, koji je gitignoriran. Linkovi na njih zato
> pokazuju izvan repoa i rade samo lokalno.
> 
> /!\ Do S139 arhiviranje **nije diralo linkove**, pa ih je 21 od 30 pokazivao u prazno
> (`tests/S111_tests.md` i dalje, svi postojeci u arhivi). Mrtav link se cita kao
> „tog dokaza vise nema", a dokaz je cijelo vrijeme bio na disku.

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S139 (2026-09-17) - alati koji mjere nesto drugo nego sto tvrde: ESLint je linta o `Claude-temp_R/OLD/` pa je 75% nalaza dolazilo iz starih kopija; `structureExcel.test.mjs` je ispisivao pad i izlazio s exit 0; `audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema. `react-hooks` 189 -> 0 problema, ratchet postao tvrda brana, CI se sada okida i na `test-branch`. Ranije: S138 (2026-09-15) - deploy na `main` pusten; `cutoff:3:5` i `rata.date_map.Visa=5` primijenjeni na PROD-u kroz Structure uvoz (pod Kokinim racunom -- `areas.settings` je vlasnikov). Nadjeno da `Datum naplate` ima DVA rjecnika i da samo jedan razumije tokene. Ranije: S137 (2026-09-15) - triaza: `S119`-`S123` arhivirani (17 -> 12 otvorenih session fileova), `audit_tests.py` prestao biti slijep za cetiri od pet oblika ID-a i za tri od pet oznaka statusa; PROD potvrdio kolonu `Racun`. Ranije: S135 (2026-09-11) - E2E triaza (46/22/3; deset specova pada SAMO u punom runu), `areas_select` je trazila sam sebe pa je `INSERT ... RETURNING` padao uz poruku koja laze (`sql/052`, pusten SAMO na TEST-u), sonda dobila `areas INSERT` sa i bez `RETURNING`. Ranije: S134 (2026-09-10) - backup baze (prva kopija PROD-a uopce), shema obje baze u gitu, ciscenje RLS-a (46-50, pusteno SAMO na TEST-u) i zatvaranje otvorene rupe: bilo tko prijavljen mogao je pisati u tudju Areu.

---

## S139 — alati koji mjere nešto drugo nego što tvrde (2026-09-17)

⚠ **Četiri puta isti razred, i jedan od njih je bio moj vlastiti instrument.**
ESLint je lintao `Claude-temp_R/OLD/` (142 od 189 problema = 75 % iz starih kopija; audit je
76 `react-hooks` nalaza pripisao živom kodu, živih je bilo **25**) · `structureExcel.test.mjs`
je ispisivao ❌ i izlazio s **exit 0** · `audit_tests.py` je prijavljivao **22** proturječnosti
protiv popisa ukinutog u S116 · moja **dva** detektora „mrtvih alata" dala su **100 % lažnih
pozitiva**. Puna zamka je u CLAUDE.md § „Alati koji mjere nesto drugo nego sto mislis".

**Detalji testova:** `../../Claude-temp_R/test-sessions/archive/` (arhiva) · ovdje su samo statusi.

| ID        | Test                                                                                                      | Status |
| --------- | --------------------------------------------------------------------------------------------------------- | ------ |
| T-S139-1  | `npx eslint .` nad **živim** kodom = **0 problema** (bilo 189, od toga 142 iz `Claude-temp_R/OLD/`)       | ✅ S139 — izmjereno |
| T-S139-2  | `npm run check` = `typecheck` + `test:unit` + `lint:ratchet`, sve tri prolaze                              | ✅ S139 — izmjereno |
| T-S139-3  | CI (`Checks`) se okida **i na `test-branch`**, i koraci `Unit guards` + `Lint ratchet` stvarno izvrše      | ✅ S139 — dva zelena runa, workflow file pročitan iz samog runa |
| T-S139-4  | Ratchet **pada i kad brojka padne** (zastarjela baseline), ne samo kad naraste                             | ✅ S139 — po konstrukciji + `--update` |
| T-S139-5  | `run-unit-tests.mjs` prijavljuje „ispisuje pad, a izlazi s exit 0" kao **POKVAREN**                        | ✅ S139 — dokazano sabotažom jedne tvrdnje |
| T-S139-6  | `structureExcel.test.mjs` sada **može pasti** (sažetak + `process.exit(failed ? 1 : 0)`)                   | ✅ S139 — sabotaža daje exit 1 |
| T-S139-7  | 12 nepotpunih dep lista popravljeno; nijedna nije zastarijevala **danas**, sve su bile mine                | ✅ S139 — E2E specovi S121/S122/S123/S133 prolaze |
| T-S139-8  | `ViewDetailsPage`: efekt premješten **ispod** deklaracije `loadActivityData`                               | ⬜ **potvrdi ručno** — otvori redak, Prev/Next, pa Edit pa natrag na View |
| T-S139-9  | `ExcelExportModal`: izvoz i dalje poštuje `filter.categoryId` i profil (dep lista dopunjena)               | ⬜ **potvrdi ručno** — izvezi s profilom i bez njega, usporedi broj redaka |
| T-S139-10 | `hidden_in_add` preživi Structure roundtrip iz `make_financije_all_structure.py` (kolona `HiddenInAdd`)    | ⬜ **potvrdi na PROD-u** — 3 atributa, svi u `Financije_all`; ⚠ uvoz **nije** popravljen (v. Backlog) |
| T-S139-11 | `audit_tests.py` više ne prijavljuje 22 fantomske proturječnosti (`curated_retired`)                       | ✅ S139 — izmjereno |
| T-S139-12 | E7-3 uzrok — klik na `Revoke` ne otvori `confirm revoke`                                                   | ⬜ **otvoreno** — nije regresija S139 (v. E7-3 niže i CLAUDE.md Open bugs) |
| T-S139-13 | Usporedba punog E2E runa `fd07840` vs `HEAD` — je li ijedan pad **nastao** u S139                          | ⬜ **BASELINE_RESULT** |

⚠ **Otvoreno pitanje o samom ovom dokumentu** (S139, nije izvedeno): 18 od 34 sekcije su
**100 % zelene** i zauzimaju **539 od 1159 redaka (47 %)**. Ritual arhivira
`docs/sessions/tests/SXX_tests.md` kad su svi testovi ✅, ali **nitko nikad ne arhivira
odgovarajuću sekciju ovdje** — pa PENDING raste zauvijek i „što još treba" se ne vidi.
Prijedlog: zelene sekcije u `DONE_HISTORY.md`, ovdje ostaje 14 sekcija s 24 otvorena testa.
⚠ To **nije** kršenje pravila „retci se ne brišu" (S136) — retci prežive, samo u drugom fileu
— ali **jest** promjena oblika rituala, pa čeka Sašinu odluku.

---


## S138 — deploy, `cutoff:3:5` na PROD, i pravilo koje je bilo promijenjeno samo napola (2026-09-15)

⚠ **`Datum naplate` ima DVA rječnika, a samo jedan razumije tokene.**
`automations.attribute_rules[].date_map` prima pravila (`same`/`next:N`/`cutoff:B:D`),
`automations.rata.date_map` prima **goli broj dana**. Promjena Vise na `cutoff:3:5` bila je
zato **polovična**: obična kupovina išla bi na 05., a rata i dalje na 03. Izmjereno na PROD-u
isti dan: MC rate **285/285** na 11. (slažu se), Visa rate **225** s danima 5.→99 / 4.→56 /
6.→25 / 7.→15 (stvarna terećenja s izvoda) i **3 retka na 3.** — sva tri nastala **tog dana**
kroz rata modal. Zatvoreno konfiguracijom: `rata.date_map.Visa = 5`. Puna zamka u CLAUDE.md.

⚠ **Uvoz je morao ići pod Kokinim računom.** `attribute_rules` živi u `areas.settings`, a
`sql/047` drži `areas_update USING (user_id = auth.uid())` ⇒ samo vlasnik. Saša je grantee;
njegov bi uvoz **tiho stvorio duplikat Aree** (`structureImport.ts:498` filtrira po `user_id`).

⚠ **Modal ne dokazuje da je pravilo promijenjeno.** `Automation rules 2` piše i kad se ništa
nije promijenilo — `rulesImported` se povećava **prije** usporedbe (`structureImport.ts:1176`),
isti razred kao `List columns` (S132). Dokaz je čitanje `areas.settings`, ne brojka.

| #            | test                                                                 | status |
| ------------ | -------------------------------------------------------------------- | ------ |
| **T-S138-1** | ⭐ `cutoff:3:5` živ u aplikaciji: nova Visa kupovina danas ⇒ `Datum naplate` = **05.10.2026.** (ne `03.10.`) | ⬜ |
| **T-S138-2** | ⭐ `rata.date_map.Visa = 5` živ: Visa kupovina s `Rate? = 3` ⇒ **05.10. / 05.11. / 05.12.** | ⬜ |
| T-S138-3     | MC naplata `11.09.` `1.068,70` ispravljena: `Transfer`/`izmedju racuna` + comment `TROŠKOVI UČINJENI MASTERCARD KARTICOM` | ⬜ (zadatak) |
| T-S138-4     | MC naplata `11.07.` `1.244,74` dobila comment (Tip/Podtip su već točni) | ⬜ (zadatak) |
| T-S138-5     | Tri `Konzum dostava` rate od 15.09. prebačene s `03.` na `05.` (10./11./12. mj.) | ⬜ (zadatak) |

**Detalji testova:** [tests/S138_tests.md](tests/S138_tests.md)

---

## S137 — triaža: pet sesija zatvoreno, i instrument koji ih nije vidio (2026-09-15)

**Arhivirano** (svi testovi zatvoreni, `Claude-temp_R/test-sessions/archive/`):
`S119`, `S120`, `S121`, `S122`, `S123`. Otvorenih session fileova: **17 → 12**.

⚠ **Osam od deset „nedostajućih" redaka NIJE nedostajalo — `audit_tests.py` ih nije vidio.**
ID u prvoj ćeliji dolazi u pet oblika, a alat je poznavao jedan (`T-S119-3`):
`` `T-S121-1` `` (backticks), `**T-S119-1** ⭐` (ukras), `` `T-S122-1` (2 slučaja) ``
(sufiks), `` `T-S123-1/-2` `` (spojeni). Sva četiri su ispadala iz brojanja, pa je file
izgledao nedovršen a odluka je **bila donesena**. Isti razred kao sufiks `A7` (S136) i
sonda bez `areas INSERT` (S135): **instrument slijep točno ondje gdje se donosi odluka.**

⚠ **Rječnik oznaka ima PET vrijednosti, ne dvije.** `~ superseded`, `→ T-Sxxx` i `⏸ PARKIRANO`
su **donesene odluke**, a alat ih je čitao kao „bez oznake". Gore: redak bez ijedne oznake
nije blokirao arhiviranje (`open == 0` je bilo dovoljno) ⇒ **sesija se mogla arhivirati s
neodlučenim testom unutra, i to tiho.** Sada `unclear` blokira i **imenuje se**.

⚠ **Brojka otvorenih je PORASLA s 20 na 22 i to je ispravno** — retci oblika
`✅ u kodu · ⬜ provjera traži deploy` sada se čitaju kao **otvoreni**, jer ⬜ pobjeđuje ✅
u istom retku. Prije su bili nevidljivi.

| #            | test                                                                      | status |
| ------------ | ------------------------------------------------------------------------- | ------ |
| **T-S137-1** | ⭐ `audit_tests.py` vidi svih pet oblika ID-a + rječnik od pet oznaka; `unclear` blokira arhivu i imenuje se | ✅ izmjereno: `bez retka 10 → 0`, `bez oznake 6 → 0`, za arhivu `0 → 5` |
| **T-S137-2** | PROD **ima** kolonu `Račun` (zatvara `T-S119-8`)                          | ✅ **15.09. PROD** — `set_list_columns.py --env prod --show`: `role: attr`, `label: Račun`, `map` RF/ZABA |
| **T-S137-3** | ⭐ CLAUDE.md dobio **generiran** indeks + razdvojeno pravilo od plana     | ✅ izmjereno: `330 ⚠ redaka u HEAD, 0 izgubljenih`; `Critical rules` i `Zamke` bajt-identične; indeks 18/18 brojeva točan |
| **T-S137-4** | ⭐ MC košara 11.09. — `--apply` + kontrola                                 | ✅ **15.09. PROD** — `69 ispravaka / 2 brisanja`, pa ponovni `uskladi_izvod`: `48 POTVRĐENO / 0 ZA ISPRAVAK`. `promet_check` **nepromijenjen** `27/5` ⇒ MC ne dira tekući |
| **T-S137-5** | ⭐ `Tip`/`Podtip` za 15 neklasificiranih redaka košare                     | ✅ **15.09. PROD** — `upisano polja: 30 · provjera nakon čitanja: SVE SE SLAZE`; ponovni dry run daje **0 za promjenu** (idempotentno) |
| **T-S137-6** | `skriveno ✕` sakriva **samo to polje**; polje otkriveno preko „Show all" ostaje običan natpis | ✅ **15.09. PROD** (`dev:prod`) -- s **dva** otvorena polja klik na `Izvod opis` sakrio **samo njega**, `Valuta` ostala; polja iz Show all nose natpis **bez** ✕ |
| **T-S137-7** | ⭐ Preset ne zamrzava izvedenu vrijednost: `Datum naplate` se racuna, ne pamti | ✅ **15.09. PROD** -- snimka `AI_rucak` ima **6** vrijednosti, `Datum naplate` i `Status` **nisu u njoj**; uz `Visa` izracunat `03.10.`, a promjenom `Izvor -> Racun` **skocio na `15.09.`** |
| **T-S137-8** | Auto-odabir preseta samo kad pobjednik **nije nerijesen** | ✅ djelomicno: uz `Financije` (12x) + `AI_rucak` (0x) auto-odabir **i dalje radi** (bira cesceg), pa je `AI_rucak` trebalo izabrati rucno. ⬜ grana **izjednaceno** (dva preseta `0x` + `last_used NULL`) neprovjerena -- Kokin slucaj je obrisan |
| **T-S137-9** | ⭐ Nov oblik pravila `cutoff:B:D` (granica ciklusa + dan naplate) | ✅ `dateRuleCutoff.test.mjs` **20/20**, protuprovjereno. ✅ S138 -- vrijednost na PROD-u promijenjena (`Visa: cutoff:3:5`), potvrdjeno citanjem `areas.settings`. ⬜ provjera upotrebom → **T-S138-1** |

⚠ **`dev:prod` je nov kod nad PROD bazom** ⇒ `T-S136-6/-8/-9` **ne čekaju deploy**.
Tri testa zatvorena bez ijednog Netlify builda.

⚠ **NALAZ: pločica precjenjuje saldo za `1.068,70`** — skupna MC naplata od 11.09. nije
u bazi jer `ZABA_2026-09.pdf` nije stigao. **Račun je točan, podatak nije potpun** —
v. „Critical rules". Zatvorit će ga rujanski izvadak; **ne dopisivati ručno**.

⚠ **NALAZ: 2 retka bez `Status`a došla su uvozom**, ne UI-jem (`session_start = 07:00`,
`created_at` +1 s). `depends_on.default_map` ne radi na Import putu — isto kao
`set_attribute`. **Pomiče okidač Faze 3**, koja je mjerila `Datum naplate` (0 praznih),
a to polje **pune Python alati u fileu**. Saša ispravio ručno.

⚠ **NALAZ: vanjski backup bio star 5 dana** (`D:\...ackup.log` 10.09. 13:25) i to se
**nigdje ne vidi** — otkriveno samo zato što je Saša pitao gdje je backup. Isti razred
kao „sidra se ne mogu vidjeti iz aplikacije" (S116). Pokrenut nakon oba današnja upisa.

⚠ **`PAYPAL *BANDIFY BANDIF` (19,95, 07.08.) namjerno ostaje `N/A`** — nema presedana,
**pitanje za Koku**. Pogođen `Tip` u podacima izgleda identično izmjerenom.

---


**Arhivirano u S137:** `S136` (svi testovi ✅) → `Claude-temp_R/test-sessions/archive/`. Zadnji je pao `T-S136-7`, potvrđen i popravljen 15.09. Narativ je u `DONE_HISTORY.md`.
## S135 — E2E triaza + `areas_select` samoreferentna politika (2026-09-11)

Detalji: [S135_tests.md](tests/S135_tests.md)

⚠ **`sql/052` je pusten SAMO na TEST-u.** PROD i dalje ima `047` verziju
politike — dakle `INSERT ... RETURNING` nad `areas` ondje jos pada.

### A. Kvar i popravak

| #            | test                                                                       | status |
| ------------ | -------------------------------------------------------------------------- | ------ |
| **T-S135-1** | Sonda PRIJE na TEST-u: `areas INSERT svoju` DA, `INSERT +RETURNING` **NE**  | ✅ izmjereno — asimetrija vidljiva u dva susjedna retka |
| **T-S135-2** | `sql/052` na TEST-u: `app_can_read_area(id)` → `user_id = auth.uid() OR …`  | ✅ |
| **T-S135-3** | Sonda POSLIJE: jedina promjena je `INSERT +RETURNING` NE → DA               | ✅ stranac i dalje ne vidi tudju Areu; grantee i dalje bez UPDATE/DELETE |
| **T-S135-4** | ⭐ Tri speca koja su kvar nasla sada prolaze (`S100`, `S107b`, `S119`)      | ✅ 1+2+1 passed |
| **T-S135-5** | ⭐⭐ `sql/052` na PROD-u, sa sondom s obje strane                           | ✅ S136 — pušteno na PROD; politika pročitana iz `pg_policy`, poklapa se s migracijom |
| **T-S135-6** | Rucna protuprovjera u SQL editoru (2 INSERT-a, razlika samo `RETURNING`)    | ✅ S136 — nepotrebno; `T-S135-5` je izmjerio isto na PROD-u |
| **T-S135-7** | „Add Area" u aplikaciji i dalje radi (nije se pokvarilo popravkom)          | ✅ **14.09. PROD** — Area dodana i obrisana |

### B. E2E triaza — 22 pada u punom runu

| #             | test                                                                      | status |
| ------------- | ------------------------------------------------------------------------- | ------ |
| **T-S135-8**  | ⭐ Puni E2E nakon RLS migracija (preuzima T-S134-16)                       | ✅ **izmjereno** 46 proslo / 22 palo / 3 nisu krenula, 19,9 min — uzrok padova ide u `T-S135-11` |
| **T-S135-9**  | ⭐ Pojedinacni run svakog palog speca — razdvaja kvar od artefakta runa    | ✅ 10 specova prolazi SAMO ⇒ artefakt; 6 padalo i samo |
| **T-S135-10** | ⭐ **NALAZ: `e13`, `e15` i `e7` padaju na ISTOM mjestu** — stavka unutar ⋮ izbornika na Structure tabu (`Manage Access` ×2, `Add Between`). Meni se dokazano otvori (`button "Actions" [active]`), pa stavka nestane. `CategoryChainRow:343` zatvara meni na **svaki** `scroll`, s `capture: true`. `e7-1` jednom prosao jednom pao ⇒ ovisi o trenutku. ⚠ Hipoteza da to izazivaju asinkrone S133 znacke s brojem eventa **NIJE izmjerena** — trazi trace | ✅ S136 — popravljeno; protuprovjera: bez popravka `e13-1` pada, s njim prolazi |
| **T-S135-11** | ⚠ Zasto suite rusi sam sebe (hipoteza: gusenje TEST baze kroz 20 min)     | ⬜ **neistrazeno** |

---

## S134 — backup, shema u gitu, ciscenje RLS-a (2026-09-10)

Detalji: [S134_tests.md](tests/S134_tests.md)

⚠ **Migracije `046`–`050` puštene su SAMO na TEST-u.** Na PROD-u je pušten samo
`sql/045`. Kod je na `test-branch` i **nije deployan**.

### A. Backup i shema

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-1**  | `backup_db.py --env prod` — puna snimka                                 | ✅ 107.772 retka, 6,79 MB, 53 s + 46 fotografija |
| **T-S134-2**  | `--verify` hvata pokvarenu snimku (protuprovjera)                       | ✅ redak manje i promijenjen iznos → oba uhvaćena |
| **T-S134-3**  | Guard staje kad ključ nije service                                      | ✅ 3 krive varijante staju, 2 ispravne prolaze |
| **T-S134-4**  | Backup završi na vanjskom disku (`backup_to_external.bat`)              | ✅ **15.09.** — Saša pokrenuo nakon oba PROD upisa. ⚠ Usput izmjereno da je D: bio star **5 dana** i to se nigdje ne vidi |
| **T-S134-5**  | `dump_schema.py` obje baze                                              | ✅ PROD 107 politika / 8 triggera, TEST 50 / 2 |
| **T-S134-6**  | `--diff` nakon PROD migracija pokaže samo očekivano                     | ✅ **14.09.** — `--diff` na PROD-u pokazao **točno jednu** stvarnu razliku: `areas_select` (= `052`). Sheme obje baze osvježene ⇒ `--diff` sada čist na oba. ⚠ Usput: **`SCHEMA_TEST.sql` je bio zastario od S135** (052 pušten na TEST, shema nikad ponovno dumpana) |

### B. Vlasništvo strukture

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-7**  | `sql/045` na PROD-u — vlasništvo poravnato, slugovi netaknuti           | ✅ izmjereno |
| **T-S134-8**  | ⭐ Spremanje strukture više ne prepisuje `user_id`                       | ✅ **14.09. TEST** — `Garmin_data` podmetnut userb-u, Saša (vlasnik Aree) spremio opis: upis sletio (`Saved successfully` + `TEST` vidljiv u listi), `user_id` **ostao** `93b96e77…`. Obje polovice izmjerene ⇒ nije mogao proći tihim neuspjehom |

### C. RLS

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-9**  | Sonda prije/poslije na TEST-u                                           | ✅ 45 proba, promijenjene točno 4 |
| **T-S134-10** | Rupa je bila stvarna (psql + REST 201 + sonda)                          | ✅ dokazano, redak počišćen |
| **T-S134-11** | ⭐⭐ Migracije `046`–`051` na PROD-u, sa sondom s obje strane            | ✅ 45 proba, 8 promjena, sve zatvaranja; 107→76 politika |
| **T-S134-12** | ⭐⭐ **Koka i dalje može raditi** nakon migracija                        | ✅ Edit kategorije + Edit atributa + Save, promjena vidljiva |
| **T-S134-13** | Saša kao grantee: Edit siv + poruka umjesto tišine                      | ✅ Edit i Delete vidljivi ali neaktivni |
| **T-S134-14** | Unos podataka (Add Activity) granteeu i dalje radi                      | ✅ dodao event i mogao ga obrisati |

### D. E2E

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-15** | Guard staje kad na :5173 stoji `dev:prod`                               | ✅ **pravi run 11.09.** — siroce od 10.09. 11:39 (`vite --mode prod`, PID 8604) preuzeto bi bilo; guard stao prije preglednika. Usput izmjereno da Nodeov `fetch` dosegne listener koji sluša **samo na `[::1]`** — da nije, `catch { return }` bi tiho propustio |
| **T-S134-16** | ⭐ Cijeli E2E prolazi nakon RLS migracija                                | ✅ S136 — zamijenio ga `T-S135-8` (izmjereno 46/22/3) |

### F. `sql/051` — `search_path` na SECURITY DEFINER funkcijama

⚠ Ova dva testa su do S136 postojala **samo** u `S134_tests.md`, bez ijednog retka ovdje —
dakle nije se znalo ni da su otvoreni ni da su zatvoreni. Našla ih je triaža iz S136.

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-17** | `sql/051` na TEST-u                                                     | ✅ |
| **T-S134-18** | `sql/051` na PROD-u                                                     | ✅ S136 — izmjereno iz `sql/SCHEMA_PROD.sql`: **svaka** `SECURITY DEFINER` funkcija nosi `SET search_path TO 'public', 'pg_temp'` (isto na TEST-u). Shema u gitu je autoritet, ne pamćenje |

### E. Modali — selekcija teksta

| #             | test                                                                    | status |
| ------------- | ----------------------------------------------------------------------- | ------ |
| **T-S134-19** | `backdropClose.test.mjs` — 6 slučajeva, protuprovjera pada 3/6           | ✅ |
| **T-S134-20** | ⭐ Uživo: u Edit panelu povuci selekciju iz polja **izvan** panela — modal ostaje otvoren, izmjene sačuvane | ✅ **11.09.** (lokalno, TEST) — `Garmin_data`, `Description` selektiran povlačenjem van panela; panel otvoren, tekst na mjestu |
| **T-S134-21** | Klik na zatamnjenu pozadinu i dalje zatvara modal + obrnuti smjer (pritisak na pozadini, otpuštanje u panelu ⇒ ostaje otvoren) | ✅ **11.09.** oba smjera |

## S133 — module-level invalidacija kesa + brojanje eventa (2026-09-10)

Detalji: [S133_tests.md](tests/S133_tests.md)

⚠ **Gdje se testira:** oba popravka su isla na `main` na kraju S133. Prije toga
su bila samo na `test-branch`, pa se PROD ponasao po starom.

### A. Kes lanca kategorija — module-level listener

| #            | test                                                                       | status |
| ------------ | -------------------------------------------------------------------------- | ------ |
| **T-S133-1** | ⭐ `categoryChainCache.test.mjs` — jezgra ODMONTIRA hook prije dispatcha    | ✅ 12/12, protuprovjera pada 4/12 |
| **T-S133-2** | ⭐ PROD, template POSTAVLJEN → Finish upise komentar (bez F5, ista kartica) | ✅ izmjereno 10.09. (`TEST132 Domacinstvo/Hrana i ostalo`) |
| **T-S133-3** | ⭐ PROD, template MAKNUT → Finish ostavi `Event Note` prazan                | ✅ izmjereno 10.09. |
| **T-S133-4** | Structure **import** (ne panel) probije kes — modal mora javiti `Settings updated` | ✅ S136 — čuva `categoryChainCache.test.mjs` (12 testova) |
| **T-S133-5** | Rename/premjestanje kategorije pa Add u istoj kartici → P2 parent eventi po NOVOJ hijerarhiji | ⬜ **nije provjereno, a `categoryChain.map(c => c.id)` hrani parent evente** |

### B. Broj eventa na Structure tabu (BUG-S132-EVENTCOUNT)

| #            | test                                                                    | status |
| ------------ | ------------------------------------------------------------------------ | ------ |
| **T-S133-6** | ⭐ E2E `S133_structure_event_count.spec.ts` — panel pise STVARAN broj    | ✅ prolazi; protuprovjera (vracen stari upit) pada |
| **T-S133-7** | ⭐ PROD: `Financije_all > Transakcija` mora pisati **5.173 events**, ne `no events yet` | ✅ **11.09.** — znacka pise `5173 events`, tocno predvidjeni broj |
| **T-S133-8** | S24 brava: Edit Mode → `+ Add Leaf` na toj kategoriji mora biti BLOKIRAN | ⬜ ⚠ **11.09. POKUSAN I NE VRIJEDI** — Sasa je na PROD-u **grantee**, pa ga je zaustavila S134 zabrana (Edit/Delete sivi, ⋮ nudi samo View details / Owner / Copy owner email) **prije** nego je dosao do `+ Add Leaf`. Prosao bi i da je S24 brava posve otvorena ⇒ ne mjeri nista. **Izvesti kao VLASNIK** — na TEST-u nad vlastitom Areom s eventima, ili pod Kokinim racunom |
| **T-S133-9** | Structure tab se i dalje otvara bez osjetnog cekanja (39 count upita usporedno) | ✅ **11.09. na PROD-u, kao grantee** — s ucitanom aplikacijom Structure se otvori **ispod 3 s**. ⚠ Prvi dojam („sporo prvi put") razlucen je jednim klikom: sporo je samo **prije** nego se aplikacija ucita ⇒ to je **hladan bundle** (`vendor-plotly` ~4,9 MB, Backlog), **ne** brojanje. RPC s `GROUP BY` zato **ne treba** |

### C. Nalaz koji NIJE popravljen

| #             | test                                                                | status |
| ------------- | -------------------------------------------------------------------- | ------ |
| **T-S133-11** | ⭐ Tko smije pisati po `Financije_all > Transakcija` — grantee, vlasnica, ili oboje | ✅ **IZMJERENO 10.09.: OBOJE.** 3 spremanja, svako provjereno u bazi. Odlučeno da grantee **ne smije** |
| **T-S133-12** | ⭐ Pročitaj STVARNU politiku na PROD-u (`pg_policy` nad `categories`/`areas`/`attribute_definitions`) — nije u repou | ✅ S136 — izveo ga i izmjerio S134/S135 |
| **T-S133-13** | Nakon popravka: grantee **nema** Edit u View details, **nema** Edit Mode, **ne može** Structure import | ✅ S136 — izveo ga i izmjerio S134/S135 |
| **T-S133-14** | Nakon popravka: grantee-jev write preko REST-a **pada** (skrivanje gumba nije brana) | ✅ S136 — izveo ga i izmjerio S134/S135 |
| **T-S133-15** | `StructureNodeEditPanel` prestaje prepisivati `user_id` na spremanju — vlasništvo se ne prebacuje | ✅ S136 — izveo ga i izmjerio S134/S135 |
| **T-S133-10** | ⚠ E2E s `reuseExistingServer: true` preuzme dev server koji vec stoji na 5173 — 10.09. je to bio `dev:prod`, pa je Playwright s TEST tokenom udario u PROD | ✅ S136 — zatvoreno S134 (`assertServedBuildIsTest`) |

---

## S131 — decimalni zarez + obavezna polja (2026-09-08)

Detalji: [S131_tests.md](../../Claude-temp_R/test-sessions/archive/S131_tests.md)

⚠ **Gdje se testira:** kod nije na `main`, pa PROD aplikacija (Kokina) jos vrti
stari bundle — kvacica `Required` upisana na PROD ondje nece ni blokirati ni
pokazati zvjezdicu. B i D radi na TEST-u; PROD kvacicu na `Racun`/`Izvor`
postavi tek **nakon** deploya.

### A. Decimalni zarez u polju za broj

| #            | test                                                     | status                           |
| ------------ | -------------------------------------------------------- | -------------------------------- |
| **T-S131-1** | ⭐ `amountInput.test.mjs`                                 | ✅ 28/28, protuprovjera pada 2/28 |
| **T-S131-2** | ⭐ Add: `1.234,56` se spremi tocan (ne `1,23`, ne prazno) | ✅ |
| **T-S131-3** | ⭐ Edit: iznos preživi otvaranje + Save nedirnut          | ✅ |
| **T-S131-4** | neprepoznat unos pocrveni, ne nestane tiho               | ✅ |
| **T-S131-5** | broj bez decimala ne dobiva `,00` (druga Area)           | ✅ 150 / 2,8 / 2,835 |
| **T-S131-25** | ⭐ NALAZ+FIX: prvi znak u praznom „skriveno" polju rusio polje (gubitak fokusa, SVI tipovi atributa) | ✅ **14.09. PROD** — `Izvod opis` (prazan, `hidden_in_add`, otkriven „Show all"): `TEST,TEST` ostao cijel. Pod starim kodom bi ostalo `T` |
| **T-S131-26** | ⭐ NALAZ+FIX: prazan `default_value` vise ne skriva polje (S117 podjela vracena) | ✅ **14.09. PROD** — svih 10 `Fitness > Activity` polja vidljivo BEZ „Show all". ⭐ I obrnuti smjer: `Strength_type = Core` (hide-at-default) je OSTAO skriven ⇒ popravak nije pregrub |
| **T-S131-27** | Help pokriva sva tri razloga skrivanja + Required | ✅ S136 — nadiđeno upotrebom |

### B. Obavezna polja — upis

| # | test | status |
| --- | --- | --- |
| **T-S131-6** | ⭐ UI kvacica se STVARNO sprema (provjera kroz Add, ne kroz panel) | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-7** | ⭐ Excel kol. J ⇒ `attributes updated`, ne „nothing changed" | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-8** | ⭐ `TRUE` na NE-prvom retku atributa (pravilo OR) | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-9** | `FALSE` na svim retcima iskljuci obavezno | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-10** | izvoz nosi `TRUE` nakon kvacice (roundtrip zatvoren) | ✅ S136 — sažeto u T-S136-3 |

### C. Provjera pri spremanju

| # | test | status |
| --- | --- | --- |
| **T-S131-11** | Add Finish blokiran + poruka imenuje polje | ✅ ⚠ poruka je otad kraca — jos jedan pogled |
| **T-S131-12** | ⭐ Edit blokiran kad se obavezno polje OBRIŠE | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-13** | Edit starog retka koji ima sve — sprema se (regresija) | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-14** | `Save +` takodjer blokira (Area bez `disable_save_plus`) | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-15** | ⭐ Excel uvoz aktivnosti NE provjerava obavezna polja | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-16** | obavezan boolean: netaknut blokira, `false` prolazi | ✅ S136 — sažeto u T-S136-3 |

### D. Obavezno + skriveno

| # | test | status |
| --- | --- | --- |
| **T-S131-17** | panel ne da složiti kombinaciju (kvacice se iskljucuju) | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-18** | ⭐ kombinacija iz Excela: forma svejedno prikaze polje | ✅ S136 — čuva automatski test |
| **T-S131-19** | obavezno dijete neobaveznog roditelja — upozorenje | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-22** | ⭐ uvoz JAVI kontradikciju + sam preuzme `structure_REVIEW_NEEDED_*` | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-23** | oznaka prezivi u OBICNOM izvozu i sama nestane kad se popravi | ✅ S136 — sažeto u T-S136-3 |
| **T-S131-24** | sudar putanja i dalje radi — jedan file, oba razloga | ✅ S136 — sažeto u T-S136-3 |

### E. Regresija i nalazi

| # | test | status |
| --- | --- | --- |
| **T-S131-20** | ⭐ `requiredAttributes.test.mjs` + typecheck + build | ✅ 18/18, protuprovjera pada 3/18 |
| **T-S131-21** | ⚠ NALAZ: `structureExcel.test.mjs` odrezan u gitu od **S17** | ✅ **S137 -- dovrsen, ne obrisan**. Bio odrezan usred zadnjeg testa (`const row = buildRowsForNode` bez ostatka), pa je Node odbijao CIJELI file (`SyntaxError`) i **37 tvrdnji se nije izvrsavalo**. ⚠ `npm run typecheck` to ne vidi -- `.mjs` nije u tsconfigu. Sada 37/37 prolazi |

### F. Podaci — PROD (mjereno 08.09.2026, samo citanje)

| # | test | status |
| --- | --- | --- |
| **T-S131-28** | ⭐ `MC_2026-08` NIJE gotov — 48 ispravaka ceka `--apply` (47× Status, 1× Izvod opis) | ✅ **15.09. PROD** — pušteno; kontrola `48 POTVRĐENO / 0 ZA ISPRAVAK` (v. `T-S137-4`) |
| **T-S131-29** | ⭐ RF: jedna greska (`0,17` upisan kao uplata) objasnjava Δ `+0,34` u cent | ✅ RF 690,79 = izvod, u cent |
| **T-S131-30** | RF `Bankovna naknada 11,00` datiran 07.09., izvod kaze **04.09.** | ✅ pomaknut na 04.09., `Datum naplate` uz njega |
| **T-S131-31** | ✅ redak `2,69` NE fali — postoji u bazi (18.08.), OCR ga je promasio | ✅ |
| **T-S131-32** | ✅ `uskladi_izvod.py` vise ne pada na hrvatskom znaku (`stdout.reconfigure`) | ✅ |
| **T-S131-33** | ✅ sidro `RF 690,79 @ 07.09.` (izvor `izvod`, nota imenuje `RF_2026-08.pdf`) | ✅ redoslijed: provjera pa sidro |
| **T-S131-34** | ⚠ BUG-S131-VIEWSTALE — View „Activity not found" nakon Edita koji pomakne `session_start`; F5 rijesi | ⬜ **neponovljen** |

**Otvoreno (S131):** T-S131-6 … T-S131-10, T-S131-12 … T-S131-19, T-S131-21 … T-S131-27, T-S131-28, T-S131-34

---

## S130 — dropdowni na praznim retcima delta sheeta + priprema PROD podataka (2026-09-07)

Detalji: [S130_tests.md](tests/S130_tests.md)

### A. Kod — delta sheet

| # | test | status |
| --- | --- | --- |
| **T-S130-1** | ⭐ `Podtip` na praznom retku nudi podtipove **vlastitog** `Tipa` | ✅ S136 — nadiđeno upotrebom |
| **T-S130-2** | prazan glavni blok (`mainCount = 0`) i dalje ima dropdowne | ✅ S136 — nadiđeno upotrebom |
| **T-S130-3** | ⭐ `deltaBlankRowDropdowns.test.mjs` | ✅ 8/8, protuprovjera pada 4/8 |
| **T-S130-4** | ostali lib testovi + typecheck + build | ✅ 36/11/26/22, cisto |

### B. Podaci — PROD

| # | test | status |
| --- | --- | --- |
| **T-S130-5** | ⭐ `MC_2026-08.pdf` dry run zatvara u cent (`1.068,70`) | ✅ 46 spareno, 2 za uvoz, 0 pitanja |
| **T-S130-6** | `--apply` za kolovoz — 46 ispravaka | ✅ **15.09. PROD** — obuhvaćeno istim prolazom (`69 ispravaka` = 48 MC_2026-08 + 21 stariji). ⚠ Uvjet „prvo T-S130-9" je **otpao sam**: košara je dospjela 11.09., pa formula `Provjeri` šuti |
| **T-S130-7** | `--apply` za starije izvode — 21 ispravak + 2 brisanja | ✅ **15.09. PROD** — **u brojku**: `69 − 48 = 21` ispravak i točno **2 brisanja** (`LH 1:N`, 3,20 ×2) |
| **T-S130-8** | sidro `2026-08-26 = 12.784,36` | ~ **nadiđeno**: PROD od 06.09. ima **novije** sidro (`12.772,86`, ekran banke), a `036` bira najnovije `confirmed_on <= as_of` ⇒ starije ne mijenja ništa. Kolovoz je ionako provjeren prometom (`promet_check` 2026-08 u cent) |

### C. Nalaz koji ceka odluku

| # | test | status |
| --- | --- | --- |
| **T-S130-9** | ⭐ `--apply` za kolovoz puni kosaru sa **46** upozorenja `Provjeri` | ⬜ **odluka o modelu** |
| **T-S130-10** | kontrola kosare pokazuje razliku `19,98` (dva neuvezena retka) | ⬜ |
| **T-S130-11** | ⏸ **PARKIRANO** — prijedlog `comment`a iz povijesti (izmjereno) | ⏸ |

**Otvoreno: NE VODI SE OVDJE** — vodi se u tablicama ispod. Kurirani popis se održavao rukom i razilazio se s tablicama (`data-prep_tools/Tools/audit_tests.py` to mjeri).

## S129 — podaci Financije_all + prekidač filtara, raspon datuma, ključ primatelja (2026-09-05)

Detalji: [S129_tests.md](tests/S129_tests.md)

### A. Podaci — `Financije_all` (PROD)

| # | test | status |
| --- | --- | --- |
| **T-S129-A1** | popravak parkinga + multisporta (`--apply`) | ✅ 3 brisanja + 1 pomak, `ostalo 0` |
| **T-S129-A2** | ⭐ Δ pada na `0,00` u 2025-02, 2025-03, 2026-03, 2026-04 | ✅ sva četiri |
| **T-S129-A3** | parking `1,40` nestao iz **liste** | ✅ sva tri datuma po 2×`0,70` |
| **T-S129-A4** | ⭐ podizanje `150,00` — duplikat obrisan, Δ(2025-10) na nulu | ✅ dokaz iz banke + Kokinog filea + baze |
| **T-S129-A5** | ZABA 2026-07 i 2026-08 zatvaraju u cent, **uvoza nema** | ✅ 38 i 46 redaka |
| **T-S129-A6** | ⭐ app reproducira ispisano stanje `12.784,36 @ 26.08.` | ✅ u cent |
| **T-S129-A7** | sidro `2026-08-26 = 12.784,36` | ✅ S136 — duplikat `T-S130-8`, koji ga izrijekom preuzima |
| **T-S129-A8** | delta sheet nakon sidra — prozor od 27.08., 2 retka | ⬜ |
| **T-S129-A9** | preostala dva mjeseca (2025-07 `+0,80`, 2025-08 `−46,74`) | ⬜ |
| **T-S129-A10** | `MC_2026-08.pdf` — netaknut, prvi korak je `--dry` | ✅ S130, zatvara u cent |

### B. Procedure i kod

| # | test | status |
| --- | --- | --- |
| **T-S129-1** | prekidač „Koristi filtre iz profila" mijenja prikazani raspon | ✅ |
| **T-S129-2** | ⭐ brojka retka prati prekidač — **387** / **5.154** | ✅ |
| **T-S129-3** | `Custom` raspon preživi **Structure tab** | ✅ |
| **T-S129-4** | `Custom` raspon preživi **View details** | ✅ |
| **T-S129-5** | `All Time` iz dropdowna i dalje radi | ✅ |
| **T-S129-9** | Excel Import/Export uz `+` na uskom, uz listu na širokom — **nigdje oba** | ✅ |
| **T-S129-B1** | ⭐ T-S127-9 — pravilo se ne okida na otvaranju (uz ispravak metode) | ✅ |
| **T-S127-9** | pravilo `set_attribute` se ne okida na otvaranju retka | ✅ S129 — **izveden kao `T-S129-B1`**, uz ispravak metode (prvi pokušaj je pao na retku čiji se datum poklapao s rezultatom pravila ⇒ nije mjerio ništa) |
| **T-S129-B2** | ⭐ ključ primatelja ne preživljava skraćen `Izvod opis` — popravljeno | ✅ 59 redaka |
| **T-S129-6** | export s otkvačenim prekidačem stvarno sadrži traženi raspon | ✅ S136 — nadiđeno upotrebom |
| **T-S129-7** | delta sheet s otkvačenim prekidačem nije prazan | ✅ S136 — nadiđeno upotrebom |
| **T-S129-8** | shortcut s `periodKey` se više ne prepisuje | ✅ S136 — nadiđeno upotrebom |
| **T-S129-B3** | ⏸ **PARKIRANO** — oznake iz presedana (45/71, `--apply` nije pušten) | ⏸ |
| **T-S129-B4** | merge na `main` | ✅ 05.09.2026., `main` = `b080739` |
| **T-S129-B5** | provjera na **PROD URL-u** uz hard refresh (3 stavke) | ✅ S136 — nadiđeno upotrebom (S129 popravci su na PROD-u od 05.09.) |

**Otvoreno: NE VODI SE OVDJE** — vodi se u tablicama ispod. Kurirani popis se održavao rukom i razilazio se s tablicama (`data-prep_tools/Tools/audit_tests.py` to mjeri).

---

## S123 — Kokin roundtrip, ispravci tuđih redaka, i `Datum naplate` (2026-08-31)

Detalji: [S123_tests.md](../../Claude-temp_R/test-sessions/archive/S123_tests.md)

⚠ **Sve je na `test-branch`. PROD je na `5533420`** — Koka od ovoga još ništa ne vidi.
⚠ **Redoslijed puštanja nije stvar ukusa:** prvo `sql/043` na PROD, **pa tek onda**
merge na `main`. Obrnuto znači da UI otvori Edit, a RLS ga odbije — i to tiho
(`UPDATE` „uspije" s 0 redaka), a kod atributa nakon uspješnog `DELETE`.

### Automatizirano

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S123-1/-2` | vlasnica ima Edit a nema Delete; ispravak čuva autorstvo i **atribut preživi** | ✅ automat prolazi · ⛔ protuprovjera ne može — DDL se odavde ne izvršava |
| `T-S123-10` | `Datum naplate` — 1:N spoj razriješen izvodom | ✅ S123 — **provjereno pokusom**, zapisano u `S123_tests.md` kao „ne treba ponavljati" |
| `deltaAccount.test.mjs` (11) | delta sheet uzima račun iz profila, ne iz panela | ✅ bez popravka pada 6/11 |
| `deltaSheetLayout.test.mjs` (18) | raspored sekcije „planirano" + `row_hash` u profilu | ✅ manja praznina ⇒ padaju 3 tvrdnje |

### Novo — traži tebe, **tek nakon `043` + deploya**

| # | test | status |
| --- | --- | --- |
| T-S123-3 | ⭐ oznaka ✎ „netko drugi je ispravio redak" — **jedino što nije automatizirano** | ✅ S136 — čuva automatski test |
| T-S123-4 | vlasnica nema Delete na tuđem retku (na svom ga ima) | ✅ S136 — nadiđeno upotrebom |
| T-S123-5 | ⭐ delta sheet uzima račun iz **profila**, ne iz panela | ✅ S136 — nadiđeno upotrebom |
| T-S123-6 | prazan delta sheet se **javlja**, izvoz se ne prekida | ✅ S136 — nadiđeno upotrebom |
| T-S123-7 | ⭐ sekcija „planirano": granica, prazan kontrolni stupac, uvoz nakon promjene `Status` | ✅ S136 — nadiđeno upotrebom |
| T-S123-8 | Export profil se bira sam; bilješka na `row_hash`; profil ga smije sakriti | ✅ S136 — nadiđeno upotrebom |

### ⚠ Blokira deploy — nije test nego posao

| # | što | status |
| --- | --- | --- |
| **T-S123-9** | ~~`Datum naplate` raščistiti prije nego sekcija „planirano" ode Koki~~ — **✅ ZATVORENO S124**: `MC_2026-06.pdf` je cijelo vrijeme bio u `izvodi/Analizirani_izvodi/`. Košara se razlaže na 48 (= 1.244,74 u cent) + 2 duplikata + 23 kriva datuma, a cijela MC 2026. zatvara se u cent na svih 7 izvoda. Alat: `uskladi_izvod.py` | ✅ |

Alat: `python data-prep_tools/Financije/kosara_naplate.py --naplata 2026-07-11 --banka 1244.74`
File: `data-prep_data/Financije/kosara_20260711_mastercard.xlsx` (app format lijevo, dijagnostika desno)

Izmjereno 31.08. — košara **73 retka / 2.231,02** vs banka **1.244,74**:

| dijagnoza | redaka | Σ |
| --- | --- | --- |
| OK | 40 | 946,48 |
| **RATA** — pravilo ne vrijedi | 21 | 832,86 |
| KRIVI MJESEC ⇒ 11.08. | 11 | 431,10 |
| KRIVI MJESEC ⇒ 11.06. | 1 | 20,58 |

⚠ Ni nakon micanja krivo datiranih se **ne zatvara** (946,48 + 832,86 = 1.779,34).
Ostatak traži **`MC_2026-06.pdf`** — pravilo je iscrpljeno.
⚠ **Tranša 4 se ne uvozi prije ovoga** — dedup po `(datum, iznos)` bi krivo
datirane preskočio, pa bi i košara 11.08. ispala kraća točno za njih.

### Zatvoreno u S123

- `BUG-S123-DELTAACCT` — delta sheet je uzimao račun iz živog filtra
- „vlasnica ne može ispraviti Sašin redak" — `sql/043` + UI (samo Edit)
- Export profil: zadani odabir + `row_hash` smije u profil (`Delete?` nikad)

---

## S122 — fantomski nacrt: dijalog nad formom u koju nitko nije tipkao (2026-08-29)

Detalji: [S122_tests.md](../../Claude-temp_R/test-sessions/archive/S122_tests.md)

**Nalaz je Sašin, iz T-S121-3.** Kad je auto-save u S121 konačno proradio, počeo je pisati
nacrt i za forme koje nitko nije dotaknuo — Add se sam napuni defaultima, a prvi tik piše
bezuvjetno. Repro (izmjeren na PROD-u 29.08.): otvori Add → **6 s** → back gumb → sljedeći
Add nudi „Resume Previous Session?" nad nacrtom bez ijednog tvog znaka.

### Automatizirano

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S122-1` (2 slučaja) | netaknut Add ekran **ne** ostavlja nacrt; utipkan znak ga **ostavlja** | ✅ s izvađenim guardom prvi slučaj pada |

⚠ Drugi slučaj postoji da prvi ne bude prazan: „nema dijaloga" prolazi i kad se nacrt
uopće ne može napisati — a to je točno bio S121 bug.

### Novo — traži tebe, **tek nakon deploya na PROD**

| # | test | status |
| --- | --- | --- |
| T-S122-2 | ⭐ otvori Add → čekaj 10 s → back → opet Add: **nema** dijaloga | ✅ S136 — nadiđeno upotrebom |
| T-S122-3 | isto, ali utipkaj nešto prije backa: dijalog **mora** iskočiti i Resume vratiti polja | ✅ S136 — nadiđeno upotrebom |
| T-S122-4 | ⭐ **shortcutovi po Arei** — kvačica „samo ova Area", `<optgroup>` u punom popisu, sufiks `23× · 12.06.` | ✅ S136 — nadiđeno upotrebom |

---

## S121 — dva Sašina nalaza s PROD-a, oba veća nego što su izgledala (2026-08-28)

Detalji: [S121_tests.md](../../Claude-temp_R/test-sessions/archive/S121_tests.md)

### Automatizirano, ne traži ništa (2 filea, 4 slučaja)

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S121-1` | Finish ne ostavlja nacrt ⇒ **nema duplikata** | ✅ bez popravka nacrt se vrati na t+15 s |
| `T-S121-2` | palo čitanje postavki Aree se **prijavljuje** | ✅ sva tri slučaja padaju bez popravka |

⚠ **Oba su zamalo bila lažna i to je zapisano u samim specovima.** `T-S121-1` je isprva
čekao da auto-save napiše nacrt — a auto-save **nikad nije radio**, pa bi test mjerio ništa;
sada nacrt piše kroz `Save +`. `T-S121-2` je prvo tvrdio „nema trake" (prolazi i na
pokvarenom kodu — trake ondje nema), pa brojao upite (`>2`, ne razlikuje jer
`useAreaDashboard` živi u tri komponente), pa tek onda mjerio **ishod**: Overview tab mora
preživjeti prolazni 503.

### Novo — traži tebe, na PROD-u nakon deploya

| # | test | status |
| --- | --- | --- |
| T-S121-3 | ⭐ **Add → Finish → odmah Add: nema „Resume Previous Session?"** | ✅ PROD 29.08. — oba prolaza, i brzi i s 30 s čekanja na success dijalogu |
| T-S121-4 | nacrt čuva nedovršen unos (zatvori tab → Resume vrati polja); Cancel ga briše | ✅ PROD 29.08. — Resume vratio polja. ⚠ korak 5 (Cancel briše nacrt) nije vrtjen zasebno |
| T-S121-5 | traka „Nisam uspio učitati postavke ove Aree" (Offline → promjena Aree) — **opcionalno**, automat pokriva | ✅ S136 — nadiđeno upotrebom |

### Otvoreno za Claudea

| # | što | status |
| --- | --- | --- |
| T-S121-6 | **`e16-filter-persistence` je flaky** — pada i bez izmjena iz S121 (1/3 bez, 2/3 s). Dok je flaky, S120 popravak nije čuvan. | ✅ S136 — zatvoreno S122 (uzrok je bio ⋮ izbornik, ne filtar) |
| T-S121-7 | razrez po Tipu mora nositi redak `gotovina, nerazvrstano` (izmjereno: 9.894 € podignuto vs 86 € zabilježeno) | ✅ S136 — nadiđeno upotrebom |

### Arhivirano u S121

`S107w_tests.md` (11/11 ✅, audit ga sam prijavio) → `Claude-temp_R/test-sessions/archive/`.

⚠ `audit_tests.py` je **pucao** na Windows konzoli (`UnicodeEncodeError` na ✅ prije prvog
retka) — izgledao je pokvaren, a samo nije mogao ispisati. Popravljen; ritual ga traži svaku
sesiju pa mora raditi bez `chcp 65001`.

---

## S120 — što je zatvoreno i, važnije, što je OSTALO

### Zatvoreno (17)

**Mjereno protiv TEST baze i alata, bez ijednog ručnog koraka (10):**
`T-S111-3` `T-S111-4` `T-S114-1` `T-S114-2` `T-S114-3` `T-S114-4` `T-S111-6` `T-S110-4`
`T-S107d-1` `T-S115-1` — dokaz je upisan uz svaki redak u tablicama ispod, ne ovdje.

**Automatizirano (1):** `T-S119-6` → `e2e/tests/S119_list_columns_map.spec.ts`.

**Pokriveno automatom koji je 26.08. prošao (2):** `T-S107b-3`, `T-S107b-4`.

**Papirologija — zaglavlje je to tvrdilo, tablica nije znala (4):**
`T-S107d-6` `T-S111-2` `T-S107u-2` `T-S107m-6`.

⚠ Tri su zatvorena **djelomično** i to piše uz redak: `T-S111-4` (korak s Excel exportom nije
izvršen), `T-S111-6` (zaštita blizanca se više ne da izazvati), `T-S107b-4` (help blok).

### ✅ Prošlo uživo na PROD-u 2026-08-26 (Sašin Android, nakon deploya `main@ad0c6e1`)

| test | dokaz |
| --- | --- |
| **T-S119-1** ⭐ | iznos vidljiv uz desni rub, bez ijednog pomicanja ustranu |
| **T-S119-2** ⭐ | `RF` / `ZABA` sitno i sivo između datuma i iznosa |
| **T-S120-1** ⭐ | drill → View Details → natrag: čip `Sašin tekući RF ×` **ostao**, lista i dalje filtrirana |
| **T-S119-3** | `Anja 73/96` (25.08.2025.): `+450,00 €` **i** `−0,70 €`, složeni jedan ispod drugog |
| **T-S119-4** | `neka dostava - rucnici i toster` prelomljeno u dva reda, bez vodoravnog scrolanja |
| **T-S119-5** | `25.08.25. po` (lanjski, s godinom) vs `26.08. sr` (ovogodišnji, bez nje) |
| **T-S120-2** | `N/A  KEKS PAY` — jedan `N/A`, ne `N/A/N/A` |
| **T-S108-12** | Overview na telefonu: polje „u banci" **prima unos**, čip i brojevi na ekranu, ništa ne ispada |
| **T-S107v-7** | ekran `Couldn't load this activity · 57014` s gumbom **Try again** — i retry je uspio. Test je tražio točno to („kad se opet dogodi") |
| — | plava oznaka retka vidljiva pri povratku iz View Detailsa |

**Time je prolaz na telefonu gotov: 8 od 8 što ovisi o Saši.** Ostaje `T-S118-6` (Kokin prolaz),
`T-S119-7` (desktop), `T-S120-3`/`-4` (Excel uvoz, desktop).

⚠ **Usput potvrđeno da lanac salda drži.** PROD pločica 26.08.: ZABA `13.231,31 €`,
RF `796,43 €`. TEST je isti dan davao `13.239,31` — razlika je **točno 8,00 €**, Sašin redak
`26.08. ZABA −8,00 dnevna karta C5`. I RF pokazuje **1 promjenu** poslije sidra od 11.08. iako
je na listi šest RF redaka nakon tog datuma: samo `18.08. RF naknada −2,69` ima `Izvor = Racun`,
ostalo su Visa kupovine koje račun terete tek skupnom naplatom. Model radi kako je zamišljen.

**⚠ Nalaz koji je iz toga ispao — popravljen isti dan (commit `742c83a`, čeka sljedeći deploy):**
na sporoj vezi lista je pokazivala `—` ondje gdje idu iznos i račun. To **nije bio prazan
podatak nego upit u letu**. Za novac `—` je **tvrdnja** („ovaj redak nema iznos"), pa je lista
sekundu-dvije to tvrdila o svakom retku. `useListColumnValues` je razliku već znao
(`:38` — *„a missing key means not loaded yet, not empty"*), ali `loaded` nikad nije stigao do
ćelija. Sada dok upit traje stoji blijedi placeholder.

**⚠ Sporost i `57014` — izmjereno što NIJE uzrok** (2026-08-26):
PROD servisnim ključem `0,14–0,30 s` · **grantee na 3.715 eventa** (TEST, isti odnos kao Saša
kod Koke) `0,09–0,41 s` · atributni filtar u oba režima `0,3–0,7 s`. Dakle ni podaci, ni
RLS-grantee, ni filtar. Ostaje **S105 obrazac** — free-tier PROD se povremeno guši (isti kod
greške, ista tablica, „čas 0,2 s čas timeout"), što potvrđuje i to da je `Try again` odmah
upalio. **Nije potvrđeno kao zaključak.** Ako se ponovi: zabilježi **sat i minutu** i ekran.
Pravi potez ostaje **Postgres upgrade na PROD-u** (`Settings → Infrastructure`, otvoreno od S105).

### Novo u S120 — traži telefon ili tvoj račun

Detalji: [S120_tests.md](../../Claude-temp_R/test-sessions/archive/S120_tests.md)

| # | test | status |
| --- | --- | --- |
| T-S120-1 | ⭐ **Filtar preživi View Details na telefonu** (E2E to pokriva na desktopu) | ✅ **26.08. uživo** — drill → View Details → natrag: čip `Sašin tekući RF ×` ostao, lista i dalje filtrirana|
| T-S120-2 | `N/A` se pojavljuje **jednom**, ne `N/A/N/A` | ✅ **26.08. uživo** — `N/A  KEKS PAY`, jedan `N/A`|
| T-S120-3 | „Import as mine" prijavi **kolizije** (prije: `0 New / 0 Modify` nad praznim skupom) | ✅ S136 — nadiđeno upotrebom |
| T-S120-4 | Uvoz u areu s istim imenom kategorije — **prije batcha 2024** | ✅ S136 — nadiđeno upotrebom |
| T-S100-1 | ⭐ Redak ide u areu koju imenuje kolona `Area`, ne u blizanca s istim pathom | ✅ S120 — **čuva automatski test** `e2e/tests/S100_same_path_two_areas.spec.ts` (provjeren i u drugom smjeru). Redak je dosad živio samo u prozi, pa ga audit nije vidio |

**Automatizirano u S120, ne traži ništa:** `E16-1`, `E17-1`, `T-S119-6`, `T-S100-1`.
Svaki je provjeren **i u drugom smjeru** (namjerno pokvaren kod ⇒ test padne).

### Arhivirano u S120

`S107m` i `S107u` (audit ih je sam prijavio) + `S102b` (9/9 ✅) i `S104` (3/3 ✅), koje audit
nije vidio jer ih ovaj file nikad nije spominjao. Otišli u `Claude-temp_R/test-sessions/archive/`.
⏸ `S99`, `S101`, `S105` — **nadiđeni po analizi, čekaju izričitu potvrdu** (v. tablicu siročadi).

### Ostalo otvoreno — po tome TKO ga može zatvoriti

Ovo je jedini popis koji treba gledati kad se pita „što još".

| traka | koliko | što |
| --- | --- | --- |
| **Telefon, nakon deploya** | 8 | `T-S119-1…5`, `T-S119-7`, `T-S118-6`, `T-S108-12` — svi na istom ekranu |
| **App na desktopu** (`Financije_all`) | ~22 | `T-S108-1b/-5/-6/-7/-10/-11/-13`, `T-S111-1/-5`, `T-S117-1…4`, `T-S118-1…5`, `T-S107v-2/-3/-7`, `T-S113-2`, `E15-full` |
| **Excel pregled** (Review / Kokina) | ~13 | `T-S107i-5/-6`, `T-S107j-1/-4`, `T-S107n-3/-6`, `T-S107o-3/-4`, `T-S107p-1/-2`, `T-S107-6`, `T-S107d-4/-7` |
| **Može se automatizirati** (nije još) | 6 | `T-S107-3/-4/-5`, `T-S107b-5/-6`, `T-S110-5` |
| **Čeka podatke ili odluku, nije test** | ~8 | `T-S115-3` (tranša 4), `T-S116-14D`, `T-S107x-4`, `T-S107d-5`, `T-S108-9`, `T-S114-5`, `T-S107c-2`, `T-S107f-3` |

⚠ **`T-S107c-2` je namjerno preskočen u S120:** piše u Review workbook, a to se ne dira pred
deploy. Nije „nije stigao" nego „nije se smjelo".

### 58 siročadi — izmjereno, čeka jednu odluku

Ranije je stajalo „jesu li relevantni?" bez podloge. Sada podloga postoji:

| file | stanje u **vlastitom** fileu | prijedlog |
| --- | --- | --- |
| `S102b` (9), `S104` (3) | **svi ✅** | **arhiva odmah** — nema se što odlučivati |
| `S99` (8) | bez oznaka | **arhiva, nadiđeno**: Delete Area i uvoz na PROD su **izvedeni i ponovno izmjereni u S118** |
| `S101` (8) | 4 ✅ / 4 ⬜ | **arhiva, nadiđeno**: izmjereno — `Tip` danas ima **18 opcija** (Kokina taksonomija, S107r); test provjerava popis od 14 koji više ne postoji |
| `S105` (8) | 2 ✅ / 6 ⬜ | **arhiva, nadiđeno**: PROD okolina tog incidenta ne postoji; popravci su na PROD-u 7 tjedana |
| `S100` (7), `S102` (12) | 5 ✅ | **zadržati i upisati u tablice** — Export Profile, `default_map`, Filter sheet su i dalje u upotrebi |

⭐ **`T-S100-1` — ✅ ZATVOREN U S120, automatiziran** (`e2e/tests/S100_same_path_two_areas.spec.ts`).
Nije bio povijest: na PROD-u `Financije_all` i `Financije_old` **obje** imaju `Transakcija`, a
pred nama su batch 2024 i 2023. Razrješavanje je ispravno — redak ide u areu koju imenuje
kolona `Area`.

⚠ **Dvije pouke iz pisanja tog testa, obje šire od njega:**

1. **Prva verzija je bila bacanje novčića.** Uvozila je jedan file, u areu A, i **prošla je i s
   namjerno pokvarenim razrješavanjem** — jer uz ključ bez imena aree jedan od blizanaca ionako
   pobijedi rječnik, i slučajno je to bila A. Test mora uvoziti u **oba** blizanca: razrješavanje
   po samoj putanji tada ne može zadovoljiti obje strane.
2. **Ovlast nije ondje gdje izgleda.** `catByPath` (5 mjesta) se koristi za validaciju i kolizije;
   o tome **gdje redak stvarno završi** odlučuje `getHierarchyLevels`. Lomljenje `catByPath`-a nije
   promijenilo ishod — tek lomljenje `getHierarchyLevels` pošalje redak u krivu areu.

---

**Zadnji update:** S119 (2026-08-25) — uska lista: iznos bez scrolanja, kratica racuna, prelom opisa; ranije: S118 (2026-08-25) — Koka na PROD-u; ranije: S116 (2026-08-23) — kolone Activities liste po Arei, `--iz-koke` izvor, sidro ZABA ispravljeno.
**Prošlo 2026-08-22: T-S113-3.** · 2026-08-21: T-S112-3, -4, -6; T-S113-1. · 2026-08-19: T-S112-1, T-S112-2. · 2026-08-17: T-S110-1, -2, -3, -6, -7. · 2026-08-15: T-S108-1, -2, -3. · 2026-08-16: T-S108-4 korak 3.
**Zatvoreno programski 2026-08-18: T-S107d-6** (RF OCR lanac reproducira ispisano stanje u cent, 196 tx / 18 mj).
**⚠ T-S111-2 se BRIŠE:** krivo RF sidro (`3.453,03`) više ne postoji u bazi, pa test nema što provjeriti.
**✅ T-S114-1 RIJEŠEN 2026-08-23 (S116):** sidro ZABA premješteno na **30.07.** (ručni ispravak retka u Supabase editoru), prije toga netautološki provjereno da app iz sidra 01.07. sam dođe do `13.815,33`. Mehanizam koji je grešku proizveo popravljen je u kodu — v. T-S116-10…13.
**Otvoreno: NE VODI SE OVDJE — vodi se u tablicama ispod (⬜).** Ovaj redak je do S116 bio ručno kuriran popis i **propuštao je 60 testova** koje tablice označavaju ⬜ (izmjereno `data-prep_tools/Tools/audit_tests.py`). Dva popisa koja se moraju slagati, a jedan se održava rukom — isti razred greške koji inače lovimo. Za stanje pokreni:

```
python data-prep_tools/Tools/audit_tests.py
```

Ispisuje po session fileu koliko je testova definirano, koliko ✅ / ⬜, i koje je fileove **spremno arhivirati** (svi ✅). ⚠ Prijavljuje i testove kojih u ovom fileu uopće nema — v. „Siročad" ispod.
**Detalji S119:** [S119_tests.md](../../Claude-temp_R/test-sessions/archive/S119_tests.md) · **S116:** [S116_tests.md](../../Claude-temp_R/test-sessions/archive/S116_tests.md) · **S115:** [S115_tests.md](../../Claude-temp_R/test-sessions/archive/S115_tests.md) · **S114:** [S114_tests.md](../../Claude-temp_R/test-sessions/archive/S114_tests.md) · **S113:** [S113_tests.md](../../Claude-temp_R/test-sessions/archive/S113_tests.md) · **S112:** [S112_tests.md](../../Claude-temp_R/test-sessions/archive/S112_tests.md) · **S111:** [S111_tests.md](../../Claude-temp_R/test-sessions/archive/S111_tests.md) · **S110:** [S110_tests.md](../../Claude-temp_R/test-sessions/archive/S110_tests.md) · **S108:** [S108_tests.md](tests/S108_tests.md) · **S107x:** [S107x_tests.md](../../Claude-temp_R/test-sessions/archive/S107x_tests.md) · **S107w:** [S107w_tests.md](../../Claude-temp_R/test-sessions/archive/S107w_tests.md) · **S107v:** [S107v_tests.md](../../Claude-temp_R/test-sessions/archive/S107v_tests.md) · **S107u:** [S107u_tests.md](../../Claude-temp_R/test-sessions/archive/S107u_tests.md)

---

## ✅ Siročad — riješeno u S136

`S99`, `S100`, `S101`, `S102`, `S102b`, `S104` i dio `S105` imali su detaljne testove u
`docs/sessions/tests/`, a **nijedan redak u ovom fileu** — nastalo pri kuriranju: retci su
maknuti, fajlovi nisu. Zato se za njih nije znalo ni da su otvoreni ni da su zatvoreni, a
arhiviranje ih nije moglo dotaknuti. Stajalo je kao poznata rupa od S116.

**Sašina odluka (14.09.2026.): nisu više relevantni ⇒ arhivirani.** Dokaz po fileu, da se
odluka ne čita kao „staro je":

| file | zašto |
| --- | --- |
| `S100` | `T-S100-1` čuva E2E spec (`S100_same_path_two_areas.spec.ts`); izmjereno u S120 |
| `S101` | izmjereno nadiđen: `Tip` danas ima **18** opcija (Kokina taksonomija, S107r), a test provjerava popis od **14** koji više ne postoji |
| `S102` | testovi su označeni ✅ **u samom session fileu** |
| `S105` | PROD okolina tog incidenta ne postoji; popravci su na PROD-u od 07/2026 |

`S99`, `S102b` i `S104` bili su **već** u arhivi.

⚠ **Pouka koja ostaje:** rupa je nastala time što su se **dva popisa** održavala ručno i
razišla. Zato se od S136 retci **ne brišu** iz tablica nego dobivaju ✅ **s razlogom** —
redak bez oznake je gori od otvorenog retka, jer se o njemu ne može donijeti nijedna odluka.

## Arhivirano u S116

Prvi put da je korak izveden nakon tri preskočene sesije — kriterij „svi testovi ✅" nije se
dao primijeniti dok se popisi nisu izmjerili. Otišlo je 7 fileova (svi ✅, nula otvorenih):
`S107g`, `S107h`, `S107k`, `S107r`, `S107s`, `S107t`, `S107y`.

---

**✅ Prošlo 23.08. (uživo, TEST baza): T-S115-2, T-S116-6, T-S116-13, T-S116-14 A/B/C.**

**T-S116-14 dio B — izmjereno, jezgra cijele sesije.** Na `Sašin tekući RF`: potvrda s ekrana
(`799,12`, bez ijednog zapisa toga dana) ⇒ sidro `22.08. = 799,12`, saldo nepromijenjen. Zatim
event **s današnjim datumom** (`Izvor = Racun`, `Isplata 40,00`) ⇒ pločica **`759,12 €`**,
zaglavlje `od potvrde 22.08.2026. · 1 promjena poslije · zadnji zapis 23.08.2026.`
Pod starim ponašanjem (sidro na danas) ostalo bi `799,12` — bez ijedne poruke.
Bilješka sidra nosi sirovo očitanje (dio C ✓). Testni event i sidro `22.08.` obrisani nakon testa.
Sidro `TEST prazan račun = 1.240,00` (nula eventa u bazi) prikazalo se kao redak pločice,
pa obrisano s ✕ iz „povijest potvrda" — toast `Obrisana potvrda 22.08.2026. = 1.240,00 €`,
pločica se vratila na dva računa, baza na 6 sidara.

⚠ **T-S115-2 prolazi, ali ne znači ono što je zapisano.** Sidro je upisano **skriptom**
(`anchors.py --add`). Kroz UI ne bi išlo: `u banci` i `Potvrdi` renderiraju se **unutar**
`rows.map(...)`, a prazna Area daje **nula redaka** ⇒ pločica pokaže „Nema zapisa koji
zadovoljavaju uvjete pločice" i **nema polja za unos**. Dakle za Kokin PROD prvog dana:
**povijest nije preduvjet, ali jedan event jest.** Plan za PROD to već zaobilazi
(korak 5, „2–3 stvarna retka da se račun pojavi") — zaključak u `CLAUDE.md` je bio širi
nego što stoji. **Otvoreno: ponuditi vrijednosti iz `racun.validation_rules.suggest` kao
prazne retke s poljem za potvrdu** (dropdown, ne slobodan tekst — tipfeler bi inače
stvorio fantomski račun). Sašina odluka, ~30 min.

## S119 — uska lista: iznos prije ⋮ (2026-08-25)

**Uzrok i popravak su izmjereni, ne procijenjeni** (Playwright, prava aplikacija, 393 px):
tablica je bila **709 px u 367 px prostora**, pa je iznos stajao 342 px izvan ekrana; poslije
popravka **367 / 367, bez scrolla**. Snimke: `Claude-temp_R/S119_lista_prije.png` i
`…_poslije.png`.

Neprovjereno uzivo ostaje ono sto TEST racun ne moze prikazati — `Financije_all` je pod
drugim korisnikom, pa kratica racuna i dvostrani iznos nisu vidjeni u pravoj listi, samo
izmjereni u harnessu s istim klasama:

| test | opis | status |
| --- | --- | --- |
| T-S119-1 | ⭐ **Iznos vidljiv bez scrolanja** na Kokinom iPhoneu i na Androidu — lista `Financije_all`, redak s dugackim opisom | ✅ **26.08. uživo na PROD-u (Android)** — iznos uz desni rub, bez pomicanja ustranu|
| T-S119-2 | ⭐ **Kratica racuna** (`ZABA` / `RF`) sitnim sivim slovima u gornjem redu, izmedu datuma i iznosa | ✅ **26.08. uživo** — `RF` / `ZABA` sitno i sivo između datuma i iznosa|
| T-S119-3 | **Dvostrani iznos** (`Anja 73/96`, 25.08.2025.) — obje strane vidljive, slozene u dva reda; nijedna ne nestaje | ✅ **26.08. uživo** — `Anja 73/96` (25.08.2025.): `+450,00 €` i `−0,70 €` složeni jedan ispod drugog, obje strane vidljive|
| T-S119-4 | **Opis se prelama u dva reda** i zavrsava s „…" tek ako ne stane ni u dva; vodoravnog scrolanja nema | ✅ **26.08. uživo** — `neka dostava - rucnici i toster` prelomljeno u dva reda, bez vodoravnog scrolanja|
| T-S119-5 | **Kratki datum**: `25.08. ut` za ovu godinu, `25.08.25. po` za lanjski redak (godina se pojavi sama) | ✅ **26.08. uživo** — `25.08.25. po` (lanjski, s godinom) vs `26.08. sr` (ovogodišnji, bez nje)|
| T-S119-6 | ⭐ **Excel roundtrip za `Map`**: Structure export nosi kolonu `Map`, import je vrati — kratice prezive krug | ✅ **S120 (automatiziran)** — `e2e/tests/S119_list_columns_map.spec.ts`: export nosi `Map` → import ga zadrži → **brisanje ćelije ga ukloni**|
| T-S119-7 | Desktop lista **nepromijenjena** (dug datum, kolone jedna do druge, `Stanje` vidljivo) | ✅ S136 — nadiđeno upotrebom |
| T-S119-8 | PROD nema kolonu `Račun` (bila upisana samo na TEST-u) | ✅ S137 — **izmjereno na PROD-u**: `list_columns` nosi `role: attr`, `label: Račun`, `slugs: [racun]` i `map` (`Sašin tekući RF → RF`, `Kokin tekući ZABA → ZABA`). Upisano usput, negdje između S119 i danas |

**Detalji:** [S119_tests.md](../../Claude-temp_R/test-sessions/archive/S119_tests.md)

## S116 — kolone po Arei · `--iz-koke` · sidro

Puni koraci: [S116_tests.md](../../Claude-temp_R/test-sessions/archive/S116_tests.md).

| Test      | Što                                                                                                                                         | Status                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T-S116-1  | ⭐ Financije lista: `Datum \| Iznos \| Tip / Podtip \| Opis \| Stanje`; prazan iznos je `—`, nikad `0,00`; redak s obje strane pokazuje obje | ✅ 24.08. — sva 4 uvjeta `Stanje` kolone pokazana (pojava s filtrom po računu, hod, predznaci, rez na sidru)                                                                                                                                        |
| T-S116-2  | Generička Area **netaknuta** — točno kao prije S116                                                                                         | ✅ 24.08. — Health_Sasa: `DEFAULT_COLUMNS` doslovno, `balance` skriven jer nema `dashboard`                                                                                                                                        |
| T-S116-3  | Uski ekran: dva reda, iznos desno uz rub, `Stanje` skriven                                                                                  | ✅ 24.08.                                                                                                                                        |
| T-S116-4  | ⭐ **Roundtrip** — `ListColumns` sheet: izmjena `Label` preživi export→import; prazan popis vraća zadano                                     | ✅ 24.08. — oba smjera; usput nalaz: `Sep` nije preživio trim (popravljeno)                                                                                                                                        |
| T-S116-5  | Rename sluga `tip` povlači fixup kolona (prazna kolona zbog mrtve reference izgleda isto kao prazna zbog nedostatka podatka)                | ✅ 24.08. — **pao iz prve**: `depends_on` fixup je bio prepisan istim Save-om (popravljeno), kolone su prošle                                                                                                                                        |
| T-S116-6  | ⭐ Sidro ZABA stoji na **30.07.**, ono s 22.08. obrisano                                                                                     | ✅ 23.08.                                                                                                                                 |
| T-S116-7  | ⭐ Uvoz kolovoza ZABA (14 redaka) → **`13.239,31` @ 13.08.** ⚠ traži i MC naplatu `1.332,52` s `MC_2026-07.pdf`                              | ✅ 24.08. — `13.239,31 €` u cent. 14 Kokinih redaka (4 `Cash` ručno klasificirana kao `Transfer / cash - bankomat`) + MC naplata `1.332,52` @ **11.08.** (dospijeće s `MC_2026-07.pdf`, ne 13.08.). Potvrda iz **dva modela**: njen lanac 59 redaka, naš 15.                                                                                                                                        |
| T-S116-8  | Uvoz kolovoza RF (1 redak) → **`796,43`**                                                                                                   | ✅ 24.08. — `796,43 €`, 1 promjena poslije. Redak `18.08. RF naknada 2,69` ručno klasificiran (`Domaćinstvo / Bankovni troškovi`, 6/6 u povijesti baze — `--klasificiraj` ga nije uzeo jer broji iz Review snimke, ne iz baze)                                                                                                                                        |
| T-S116-9  | Alat stane kad delta sheet nije za traženi račun (regresija)                                                                                | ✅ 24.08. — ZABA sheet + `--tip-racuna Sasin tekuci` ⇒ poruka i **exit code 1** (ne samo ispis)                                                                                                                                        |
| T-S116-10 | ⭐ **Datum potvrde iz IZVORA, ne iz klika**                                                                                                  | ✅ 24.08. — put „izvod" prošao: prazno polje bez defaulta, gumb ugašen do datuma s papira, guard na budući datum. Usput: gumb je nudio klik koji bi guard odbio (popravljeno) |
| T-S116-11 | Rečenica o posljedici prije klika                                                                                                           | ✅ 24.08. — rečenica za put „izvod" viđena: iznos, datum, „prije toga već uključeno", posljedica promašaja |
| T-S116-12 | ⭐ Upozorenje kad **novija** potvrda već postoji (ispravak unatrag ne ispravlja ništa)                                                       | ✅ 24.08. — poruka nosi i izlaz („obriši je u povijesti potvrda") |
| T-S116-13 | ⭐ „povijest potvrda" + brisanje iz aplikacije; ▸ označava važeću                                                                            | ✅ 23.08. (⚠ **korak 3 — grantee bez ✕ — NIJE proban**)                                                                                   |
| T-S116-14 | ⭐⭐ **Očitanje s ekrana sidri se na JUČER** ⇒ današnja transakcija ostaje u saldu                                                            | ✅ S136 — nadiđeno upotrebom |

**Brojke izmjerene u S116** (sve provjerene, ne procijenjene):

| Što | Vrijednost |
| --- | --- |
| `ZABA_2026-07.pdf` | close **2026-07-30**, POČETNO `2.255,64`, **NOVO `13.815,33`** |
| app iz sidra 01.07. na 30.07. | **`13.815,33`** (38 eventa) — Δ = 0, **netautološka provjera** |
| Kokin file `2026-08-23.xlsx` | 3.735 redaka; **175** nakon 30.07. |
| od toga dira saldo | ZABA **17**, RF **6** · kartice (MC 80 + Visa 72) su potovi |
| stvarno novih za uvoz | ZABA **14** (bez retka 2564), RF **1** |
| njen lanac ZABA 31.07.–13.08. | `13.815,33` → **`13.239,31`** ✓ kontrolni broj tranše 4 |
| njen lanac RF nakon 11.08. | `799,12` → **`796,43`** |
| retci s datumom kao TEKSTOM | **103**, svi iz 2023. (`'11.05.23.'`, `'28.6.23.'`, `'29.2.2024.'`) |

---

## S109 — sesija odluka (NEMA `src/` koda, nema novih testova)

Testiranje S108 skrenulo u dizajn: sidro na **danas** pokriva rupu u povijesti, sidro
**unatrag** je provjerava. Plan i obrazloženje: `NEXT_SESSION_PROMPT.md`.

**Tri „pada" koja NISU pad — ne istraživati ponovo:**

| Opažanje | Objašnjenje |
| --- | --- |
| Kolona `Stanje` sve `—` nakon drill downa | Dva neovisna i ispravna razloga: sidro datirano **danas** ⇒ ispod sidra saldo nije definiran (`useRunningBalance` uvjet 4); i svi vidljivi retci su `Izvor = Mastercard`, koji ne miču saldo (uvjet 3) |
| Parking redak (2026-07-07) se ne nalazi u bazi | Nije ni uvezen — batch 2026 rezan na 31.07., a redak je tada bio datiran `2026-08-07`. Treba ga **dodati kroz app**, ⚠ ne novim batchom |
| „planirano −2.521,38 (13)" ne reagira na sidro | Namjerno — `split` je **plain sum, nije usidren** (`BalanceByGroupTile:78`). „Što je još planirano" je pogled naprijed |

**Otvoreno za sljedeću sesiju (bit će testovi kad se napiše):** pločica prima `asOf`;
skripta mjesečnih stanja iz izvoda; provjera lanca (ZABA `3.403,74` na 08.07.2026.);
odluka o `Financije_all > Stanja`.

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
| T-S108-1 | ⭐ Overview tab postoji samo uz `dashboard` config (OQ-4), redoslijed Overview → Activities → Structure | ✅ (2026-08-15) |
| T-S108-1b | Add Activity + “⚡ Use” rade i iz Overviewa; povratak nakon spremanja ide na Overview; leaf hint uz sivi gumb | ✅ **15.09. PROD** koraci 2/3/4 (`+` aktivan na Overviewu, `Use` vodi u Add, Finish vraca na Overview). ⚠ **Korak 5 PAO i popravljen**: uz `All Categories` gumb je siv **bez hinta** -- uvjet je trazio `filter.categoryId`, a to je ondje `null`. Sada gleda `filter.areaId`, isto kao gumb. ⬜ provjera u `dev:prod` |
| T-S108-2 | ⭐ Pločica — ZABA 150,80 €, RF −1.978,32 €, „od početka podataka" | ✅ (2026-08-15) |
| T-S108-3 | „planirano" — ZABA −2.521,38 € (13) | ✅ (2026-08-15) |
| T-S108-4 | ⭐ Sidro: Δ čip ✅; **„Potvrdi" ✅ (2026-08-16)** — sidro 3.000 spremljeno, podnaslov prešao na „od potvrde 16.08.2026. · 3.000,00 € · 0 promjena poslije". Koraci **4–5 (transakcija poslije / prije sidra) još neisprobani** | 🟡 3/5 |
| T-S108-5 | Δ ostaje dok se ne slaže; ništa se ne mijenja bez Potvrdi | ✅ S136 — nadiđeno upotrebom |
| T-S108-6 | ⭐ Drill s pločice → Activities filtriran na račun / na `Status=Planiran` | ✅ S136 — nadiđeno upotrebom |
| T-S108-7 | ⭐ Izračunata kolona `Stanje` — silazi do salda, nestaje kod miješanih računa i obrnutog sorta | ✅ S136 — nadiđeno upotrebom |
| T-S108-8 | Rename sluga popravlja `dashboard.widgets[]`; pokvaren slug daje **imenovanu** grešku, ne 0,00 | ✅ S136 — nadiđeno upotrebom |
| T-S108-9 | Paginacija bez stabilnog sorta — Delete Area / Import Delete? nad >1000 atributa (regresija, nedeterministički) | ⬜ ⚠ regresijska brava — paginacija bez `.order()` je tiha (S108 razred) |
| T-S108-10 | „From template" nosi `settings` bez `export_profiles` i bez sidara | ✅ S136 — nadiđeno upotrebom |
| T-S108-11 | Read grantee vidi pločicu, nema „Potvrdi"; write grantee ima | ✅ S136 — nadiđeno upotrebom |
| T-S108-12 | Mobitel — polje „u banci" i čip vidljivi i upotrebljivi | ✅ **26.08. uživo na PROD-u (Android)** — polje „u banci" prima unos, čip i brojevi na ekranu, ništa ne ispada|
| T-S108-13 | Help zna za Overview — chipovi na tabu, odgovori o Δ i o sidru | ✅ S136 — nadiđeno upotrebom |

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
| T-S107u-2 | (backlog, ne blokira) `groupAttributes` uzima `Default` s prvog retka grupe ⇒ atributski `default_value` ovisi o redoslijedu redaka; export piše `*` prvi, generator zadnji → `Status.default_value` `Izvrsen`↔`null` klackanje. Fix: ignorirati `Default` na retku koji ima `DependsOn` (pripada u `default_map`) | ✅ **POPRAVLJENO S117** (v. `CLAUDE.md` → Open bugs) — export više ne piše `defaultVal` za `depends_on` atribut|

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
| T-S107m-6   | **Saša:** freeze + collapse grupa prežive script run                     | ➡ **zamijenjen s T-S107n-7** — vodi se ondje|

**Riješeno u S107n:** `--run` mode napisan i izvršen (1593 prijedloga).
**Još otvoreno:** `source_key` fix i `sql/0NN_staging_financije.sql` nisu napravljeni.
**Detalji testova:** [S107k_tests.md](../../Claude-temp_R/test-sessions/archive/S107k_tests.md) (novi) + [S107j_tests.md](tests/S107j_tests.md) + [S107i_tests.md](tests/S107i_tests.md) + [S107h_tests.md](../../Claude-temp_R/test-sessions/archive/S107h_tests.md) + [S107g_tests.md](../../Claude-temp_R/test-sessions/archive/S107g_tests.md) + [S107f_tests.md](../../Claude-temp_R/test-sessions/archive/S107f_tests.md)
**Upute za izvode (i za Koku):** [UPUTE_izvodi.md](../../Claude-temp_R/UPUTE_izvodi.md) — kako skinuti/spremiti/obraditi bankovne izvode

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
| T-S107j-4 | **Saša:** Napomena backfill kontrola — 1870 popunjeno, Kokine ne-prazne netaknute (P3)                        | ✅ S136 — stari pipeline; podaci zamrznuti, PROD pušten roundtripom |

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
| T-S107i-5 | **Saša Excel pregled:** `pbzvisa` novi retci (filter Izvor reda=`PBZ Visa:*`), RATA/lump ispravni, dropdowni  | ✅ S136 — stari pipeline; podaci zamrznuti, PROD pušten roundtripom |
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

## S107d — inventory izvoda + MC/PBZ parseri (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                        | Status                        |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T-S107d-1 | `inventory_izvoda.py` idempotentnost: ponovni `--dry` = isti brojevi, ništa se ne premješta                 | ✅ **S120 (mjereno)** — 118 fajlova, **0 duplikata**, ništa se ne premješta. ⚠ Brojke u testu su zastarjele (MC 31/1139, PBZVISA 32/1587, ZABA 32/738 — pribilo je izvoda). ⚠ `RF_2026-07.pdf` preskočen: `rapidocr_onnxruntime` nije instaliran|
| T-S107d-2 | `Izvodi_transakcije.xlsx`: 3182 tx, Manifest 117 redova, MC_2024-02 suma = 1.642,83                          | ✅ (verificirano skriptom)     |
| T-S107d-3 | **Pravi enrich run** (Review zatvoren!): `--dry` ≈1429 match, pa bez `--dry` → Izvod kolone + Nematchano    | ✅ (2026-07-13; 1429 upisano, ručne kolone verificirane identične backupu, D1 auto-popravljen) |
| T-S107d-4 | Lanac: `apply_rules.py` pravilo pogađa red kojem je merchant SAMO u `Izvod opis`                            | ⬜ (zamjenjuje T-S107c-4)      |
| T-S107d-5 | Nematchano spot-check (PBZ Visa ~1538 tx) — podloga za odluku importati/ignorirati                          | ✅ S136 — stari pipeline; podaci zamrznuti, PROD pušten roundtripom |
| T-S107d-6 | RF OCR spot-check: 3 nasumična reda iz Review s `Izvod file`=RF_* usporediti s PDF-om                       | ✅ S136 — stari pipeline; podaci zamrznuti, PROD pušten roundtripom |
| T-S107d-7 | Pregled 9 `[OCR?]` redova (filter po `[OCR?]` u Izvod opis / Transakcije sheetu) — ispraviti ručno ako treba | ✅ S136 — stari pipeline; podaci zamrznuti, PROD pušten roundtripom |

---

## S107c — klasifikacijski alati (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                     | Status                           |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| T-S107c-1 | `sync_taxonomy.py` na pravom review fileu: dropdowni prate editirani Taksonomija sheet                   | ✅ (Saša potvrdio "ok radi tool") |
| T-S107c-2 | `apply_rules.py`: 1. run kreira Pravila sheet; upiši pravilo; `--dry` pokaže pogodke; run označi PRAVILO | ⬜                                |
| T-S107c-3 | `enrich_from_izvoda.py --dry`: ZABA_2024-01 → ~15/18 match report; bez `--dry` puni Izvod kolone         | ~ superseded → T-S107d-3         |
| T-S107c-4 | Lanac: pravilo koje matcha SAMO tekst iz `Izvod opis` kolone → red dobije Tip/Podtip                     | ~ superseded → T-S107d-4         |

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
| E7-2    | Share Management: invite existing user → poziv prolazi bez fantomskog toasta          | ✅ **S139 (izmjereno)** — toast `Access granted` NIKAD nije postojao (`handleInvite` otvara messageBox); uklanjanjem tvrdnje spec prolazi |
| E7-3    | Revoke access → korisnik nestaje s popisa `Active access`                                | ⬜ **PADA, uzrok neutvrđen.** Klik na `Revoke` ne otvori `confirm revoke`. Izmjereno S139: verzija speca od **prije** sesije pada 2 (E7-2+E7-3), poslije pada 1 (E7-3) ⇒ **nije regresija**. V. CLAUDE.md Open bugs |

---

