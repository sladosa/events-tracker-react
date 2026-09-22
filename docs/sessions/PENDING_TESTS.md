# PENDING TESTS

> **Arhivirani session fileovi izlaze iz gita** (ritual, korak 3): sele u
> `Claude-temp_R/test-sessions/archive/`, koji je gitignoriran. Linkovi na njih zato
> pokazuju izvan repoa i rade samo lokalno.
> 
> /!\ Do S139 arhiviranje **nije diralo linkove**, pa ih je 21 od 30 pokazivao u prazno
> (`tests/S111_tests.md` i dalje, svi postojeci u arhivi). Mrtav link se cita kao
> „tog dokaza vise nema", a dokaz je cijelo vrijeme bio na disku.

> 
> /!\ **Od S140 sekcija napusta ovaj file ZAJEDNO sa svojim detaljnim fileom** (ritual,
> korak 3). Do tada se arhivirao samo `tests/SXX_tests.md`, a sekcija je ostajala — pa je
> dokument rastao zauvijek i polovica mu je bila zatvoreni posao.

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S142 (2026-09-19) - `DELTA_WINDOW_SPEC` faze 1 i 2: sidro je prestalo biti **rez** i postalo **oznaka**. Prozor se mjeri sidrima umjesto danima (otvarajuce stanje je time POTVRDJEN broj, ne izracun -- izmjereno na PROD-u, 6/6 u cent), a retci unutar potvrdjenog stanja dobili su kolonu `Potvrda` + sivi ton; prazni retci topao ton. /!\ Zastita je OZNAKA, ne brana -- update-guard na uvozu je faza 4 i nje nema. Osam sabotaza kroz dva testna filea; `importForeignRows` sada uvozi file KOJI NOSI novu kolonu, pa je rizik za uvoz zatvoren mjerenjem. Ranije: S140 (2026-09-18) - instrumenti i dokumenti. `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze), pa je arhiviranje tri sesije tvrdilo da nema sto arhivirati. PENDING prepolovljen (1.198 -> 628), backlog dobio strukturu umjesto trijaznog odlomka. E7-3 i E10-2 zatvoreni -- nisu bili bug appa nego tvrdnja iz dizajna (isti commit `4413280`, S106). Obsidian navigacija zatvorena: goli `<datum>` je HTML tag, a dvotocka u naslovu lomi sidro (`+` je nevin). `dbScopedKey()` -- jedina promjena u `src/` -- sprjecava da TEST i PROD dijele filtar. Ranije: S140 (2026-09-18) - PENDING prepolovljen: 20 zatvorenih sekcija (588 redaka) preseljeno u `DONE_HISTORY.md`, pa se otvoreno vidi bez skrolanja (1.198 -> 628 redaka, 27 otvorenih testova u 15 sekcija). `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze) -- zato je arhiviranje 3 sesije tvrdilo da nema sto arhivirati. Zatvoreno E7-3/E10-2 (nisu bili bug appa nego tvrdnja iz dizajna) i Obsidian navigacija (goli `<datum>` je HTML tag; dvotocka u naslovu lomi sidro). Ranije: S139 (2026-09-17) - alati koji mjere nesto drugo nego sto tvrde: ESLint je linta o `Claude-temp_R/OLD/` pa je 75% nalaza dolazilo iz starih kopija; `structureExcel.test.mjs` je ispisivao pad i izlazio s exit 0; `audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema. `react-hooks` 189 -> 0 problema, ratchet postao tvrda brana, CI se sada okida i na `test-branch`. Ranije: S138 (2026-09-15) - deploy na `main` pusten; `cutoff:3:5` i `rata.date_map.Visa=5` primijenjeni na PROD-u kroz Structure uvoz (pod Kokinim racunom -- `areas.settings` je vlasnikov). Nadjeno da `Datum naplate` ima DVA rjecnika i da samo jedan razumije tokene. Ranije: S137 (2026-09-15) - triaza: `S119`-`S123` arhivirani (17 -> 12 otvorenih session fileova), `audit_tests.py` prestao biti slijep za cetiri od pet oblika ID-a i za tri od pet oznaka statusa; PROD potvrdio kolonu `Racun`. Ranije: S135 (2026-09-11) - E2E triaza (46/22/3; deset specova pada SAMO u punom runu), `areas_select` je trazila sam sebe pa je `INSERT ... RETURNING` padao uz poruku koja laze (`sql/052`, pusten SAMO na TEST-u), sonda dobila `areas INSERT` sa i bez `RETURNING`. Ranije: S134 (2026-09-10) - backup baze (prva kopija PROD-a uopce), shema obje baze u gitu, ciscenje RLS-a (46-50, pusteno SAMO na TEST-u) i zatvaranje otvorene rupe: bilo tko prijavljen mogao je pisati u tudju Areu.

---

## S145 — testiranje hrpe A, a tri od cetiri popravka nisu bila na popisu (2026-09-22)

⚠ **Sest testova hrpe A su svi prosli, ali su usput ispala cetiri kvara.** Jedan je
gasio Kokin Overview tab pri svakom povratku, jedan bi uvozom vratio konfiguraciju iz
S138 unatrag, jedan gubi lipe pri dijeljenju rata, a cetvrti se nije dao reproducirati.
⚠ **Dva testa iz hrpe A nisu mjerila nista iz prvog pokusaja** (T-S133-5) — v. tamosnji redak.

**Detalji testova:** [tests/S145_tests.md](tests/S145_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| **T-S145-1** | Overview tab prezivi povratak — F5, View details, Finish | ⚠ **F5 ✅ izmjeren 22.09.**; View details i Finish ⬜ |
| **T-S145-2** | Rata s ostatkom: `100 / 3` — modal `33.34 / 33.33 / 33.33` + žuta napomena, isti broj u atributu i u komentaru retka | ⬜ ⚠ automatski dio je pokriven (`src/lib/__tests__/rataAmounts.test.mjs`, 21 tvrdnja; sabotaža implementacije ruši 11) |
| T-S145-3 | (praćenje) Boolean u Edit formi piše `Not set` nad retkom koji u bazi ima `true` | ⬜ **nije reproduciran** — ako se ponovi, **prvo** hard refresh; četiri hipoteze su već oborene (izmjereno: do kvačice stiže pravi boolean) |
| T-S145-4 | Generator ne vraća `Automations` unatrag | ✅ **izmjereno 22.09. prije uvoza**: file je nosio `Visa=next:3` i rata `Visa=3` (stanje od prije S138), popravljeno pa potvrđeno uvozom — nova Visa kupovina nosi `05.10.2026.` |

---

## S141 — tri tvrdnje oborene mjerenjem, i sve tri su bile moje (2026-09-18)

⚠ **Sesija bez ijedne izmjene u `src/`.** Tri stvari su zapisane kao istina pa oborene brojkom:
da se Visa retci „ne grupiraju“ (grupiraju se — **35 od 37** ciklusa ima jedan dan), da je za
delta prozor dobro uzeti `N` dana (nije — otvarajuće stanje bi postalo nagadjanje dugo **565**
dana), i da je E10-2 pao na dijalogu opoziva (nije — pao je prije, na Structure retku).

**Detalji testova:** [tests/S141_tests.md](tests/S141_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S141-1 | Structure fan-out: **39 zahtjeva po pozivu, 6–8 poziva po toku** | ⬜ **otvoreno — izmjereno, čeka popravak.** 2.601 fan-out zahtjev kroz 17 palih testova (`e15` 330, `e11` 276); u E10-2 traceu 39+39 u sekundi razmaka, odgovoreno **11 od 78**. ⚠ Uzrok padova **NIJE** utvrđen: 10 od 17 padova ima zahtjeve bez odgovora, **7 nema nijedan**. Potvrda je **ponovno mjerenje** koje mora dati **jedan** fan-out po toku |
| T-S141-2 | `Datum naplate` za karticu znači **dan terećenja** (odluka b) — app upisuje pretpostavku, izvod je ispravlja | ✅ S141 — odlučeno na mjerenju: **35/37** ciklusa ima jedan dan, **1.616 od 1.639** redaka već nosi to značenje; pravilo u CLAUDE.md |
| T-S141-3 | `DELTA_WINDOW_SPEC` — prozor se mjeri **sidrima**, ne danima | ✅ S141 — spec napisan i odluke unesene; **faza 1 čeka kod**, ništa više ne čeka odluku |
| **T-S141-4** | Faza 1 delta prozora: otvarajuce stanje mora izaci **jednako iznosu sidra u cent** | ✅ **S144 — zatvoreno u cijelosti.** RPC razina dokazana S142 (`rpc_area_balance_anchored` s `as_of` = dan sidra ⇒ sam iznos sidra uz `n = 0`, 6/6) · **uzivo je izvedeno u S143** (T-S142-1): modal prosljedjuje bas taj `asOf`, file nosi `stanje 30.07.2026. -> 13.815,33`. Potvrdjeno ponovo S144 na `Prozor = 2`: otvarajuce stanje `3.054,41` = doslovno iznos sidra |

---

## S140 — instrumenti i dokumenti: četiri tvrdnje koje su bile napisane, a ne izmjerene (2026-09-18)

⚠ **Jedina promjena u `src/` je `dbScopedKey()`.** Sve ostalo su alati i dokumenti — ali
su tri od njih **blokirala posao**: `audit_tests.py` je tvrdio da nema što arhivirati,
`claude_index.py` je generirao mrtve linkove, a `PENDING_TESTS.md` je narastao tako da se
„što još treba" nije vidjelo. Dva E2E pada koja su se vodila kao nepoznata imala su **jedan**
uzrok, i on nije bio u aplikaciji.

**Detalji testova:** [tests/S140_tests.md](tests/S140_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S140-1 | E7-3 + E10-2: `Confirm revoke` postoji samo kad grantee **ima evente** ⇒ app je ispravan, tvrdnja u specu nije | ✅ S140 — 6/6 prolaz; protuprovjera: sabotiran `doSimpleRevoke` ruši točno ta dva |
| T-S140-2 | CLAUDE.md: goli `<datum>` je za Markdown **HTML tag** koji se ne zatvara | ✅ S140 — Saša potvrdio da `Zamke` sada skače i renderira se |
| T-S140-3 | Dvotočka u naslovu lomi Obsidian sidro; **`+` je nevin**; kodiranje **kvari** link koji radi | ✅ S140 — 11 varijanti klikano; guard: 0 upozorenja nad ispravnim, točno 1 kad se dvotočka vrati |
| T-S140-4 | `audit_tests.py` pripisivao fileu svaki ID koji se u njemu **spominje** | ✅ S140 — 4 od 12 fileova nose tuđe ID-eve; S134 postao arhivabilan |
| T-S140-5 | `PENDING_TESTS.md` 1.198 → 628 redaka, 20 sekcija u `DONE_HISTORY.md` | ✅ S140 — poslije selidbe audit ima **0** pojava „PENDING nema redak za" |
| T-S140-6 | Backlog: struktura nosi trijažu (3 podnaslova), unosi presloženi bez izmjene znaka | ✅ S140 — brana prebrojala retke prije i poslije |
| T-S140-7 | `dbScopedKey`: filtar više ne curi između TEST-a i PROD-a | ✅ S141 — TEST **nije** naslijedio PROD-ov `Health_Sasa > Medical` nego pokazao **svoj** `Financije_all`; povratak na `dev:prod` vratio `Health_Sasa > Medical` netaknut. Bez `Unknown`, bez trake o grešci |
| T-S140-8 | Puni E2E nakon popravka `e7`/`e10` — E7-3 i E10-2 zeleni i u **punom** runu | ⬜ **DJELOMIČNO — ostaje otvoren.** **E7-3 ✅ S141** prolazi i u punom runu (popravak drži). **E10-2 ❌** pada, ali **na drugom mjestu**: `structure-row-…` se nikad ne pojavi, pa dijalog opoziva nije ni dosegnut ⇒ v. T-S141-1. Ukupno **54/17** protiv baseline-a 60/11 |
| T-S140-9 | `S139_tests.md` napisan (ritual korak 2 bio preskočen u S139) | ✅ S140 — audit ga vidi (5 definiranih, 4 zatvorena, 1 otvoren) |

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
| **T-S137-9** | ⭐ Nov oblik pravila `cutoff:B:D` (granica ciklusa + dan naplate) | ✅ **S144 — zatvoreno u cijelosti.** `dateRuleCutoff.test.mjs` **20/20** (protuprovjereno) · S138 promijenio vrijednost na PROD-u (`Visa: cutoff:3:5`, potvrdjeno citanjem `areas.settings`) · **provjera upotrebom je sada izvedena**: sve 4 Visa kupovine nastale nakon promjene nose `2026-10-05` (T-S138-1) |

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

## Arhivirane sekcije — pune tablice su u `DONE_HISTORY.md`

> **20 sekcija (588 redaka) preseljeno u `DONE_HISTORY.md` u S140.** Ovdje ostaje samo
> ono s **otvorenim** testovima, da se „sto jos treba" vidi bez skrolanja.
>
> /!\ Ovo NIJE krsenje pravila „retci se ne brisu, nego dobivaju ✅ + razlog" (S136) —
> retci su prezivjeli u cijelosti, samo u drugom fileu, i pretraga po ID-u ih i dalje
> nalazi. Oba filea su u `docs/sessions/`, pa su relativni linkovi na detaljne fileove
> presli nedirnuti.
>
> /!\ **Kriterij za selidbu nije bio „sekcija je zelena"** — to je izmjereno kao NESIGURNO:
> `T-S134-16` zivi pod sekcijom **S135**, dakle retci migriraju izmedju sekcija. Selile su
> samo sekcije koje (a) nemaju nijedan ⬜ i (b) ne drze **jedini** redak za test cijem
> session fileu jos ima zivih testova. Bez uvjeta (b) bi `audit_tests.py` za takav test
> javio „PENDING nema redak za" — dakle zamijenili bismo jedan sum drugim.

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
| **T-S130-10** | kontrola kosare pokazuje razliku `19,98` (dva neuvezena retka) | ⬜ ⚠ **BROJKA JE ZASTARJELA — test se ne da zatvoriti kako je napisan** (izmjereno S144). MC kosara s dospijecem `11.09.2026.` danas ima **47 redaka, Σ `1.055,35`**, naplata s izvoda je `1.068,70` ⇒ razlika je **`13,35`**, ne `19,98`. ⇒ pretvara se u **zadatak**: uskladiti rujansku MC kosaru s izvodom (`uskladi_izvod.py`) |
| **T-S130-11** | ⏸ **PARKIRANO** — prijedlog `comment`a iz povijesti (izmjereno) | ⏸ |

**Otvoreno: NE VODI SE OVDJE** — vodi se u tablicama ispod. Kurirani popis se održavao rukom i razilazio se s tablicama (`data-prep_tools/Tools/audit_tests.py` to mjeri).

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
| `S101` (8) | **8 ✅ — zatvoreno S144** | **arhiva, nadidjeno**: izmjereno — `Tip` danas ima **18 opcija** (Kokina taksonomija, S107r); test provjerava popis od 14 koji vise ne postoji |
| `S105` (8) | **8 ✅ — zatvoreno S144** | **arhiva, nadidjeno**: PROD okolina tog incidenta ne postoji; popravci su na PROD-u 7 tjedana |
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
| T-S108-1b | Add Activity + “⚡ Use” rade i iz Overviewa; povratak nakon spremanja ide na Overview; leaf hint uz sivi gumb | ✅ koraci 2/3 (15.09. + 22.09. PROD). ⚠ **Korak 4 PAO 22.09. (S145)** — `Go to Home` je vraćao na **Activities**. Uzrok nije bio u Add toku nego `BUG-S145-OVERVIEWTAB`: zastavica `loaded` je prezivjela promjenu `areaId`-a. Popravljeno (`useAreaDashboard` izvodi `loaded` u renderu + `AppHome` traži poznatu Areu), izmjereno istim potezom `Overview` + `F5`. ⚠ 15.09. je ovaj korak bio označen ✅ — nije utvrđeno je li tada bio promašaj u očitanju ili je kvar ovisan o vremenu. ⬜ **Ostaje korak 5**: uz `All Categories` gumb siv **i žuti hint** (provjera u `dev:prod`) |
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
| E7-3 | Revoke access → user removed from Active access list | ✅ S140 — zatvoreno; `confirm revoke` je bila tvrdnja napisana iz dizajna, app radi ispravno. Popravak u specu (`e7`+`e10`), put s eventima čuva `e15` |

---

