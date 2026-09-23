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


**Otvoreno: NE VODI SE OVDJE** -- vodi se iskljucivo u tablicama.

> Kurirani popis je ukinut u **S116** jer se odrzavao rukom i razilazio s tablicama
> (propustao je 60 testova). Stanje mjeri `python data-prep_tools/Tools/audit_tests.py`.
>
> /!\ **Ovaj redak mora ostati u ZAGLAVLJU** (S146). Do tada je stajao unutar sekcije
> `S120` i **otisao s njom u arhivu** — nakon cega je audit istog trena prijavio
> **8 fantomskih proturjecnosti**, jer bez markera usporedjuje tablice s *praznim*
> kuriranim popisom. To je razred koji je S139 vec jednom zatvorio, ozivljen
> **selidbom, ne izmjenom** (isti razred kao samoreferenca u `DONE_HISTORY.md`).
**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S146 (2026-09-23) - trijaza. **Osam sekcija arhivirano** (S106, S107c/d/i/j, S120, S130, S135); PENDING **543 -> 277** redaka, otvorenih testova **18 -> 8**. Uveden **sesti kriterij zatvaranja, ZASTARJELO** (Sasina formulacija: *test tvrdi brojku iz trenutka, a mehanizam je mjeri iznova sam*) — s dvije granice, da ne postane kos za sve nezgodno. `check_links.py` je postao **brana** koju zovu `audit_tests.py` i `claude_index.py --write` (arhiviranje premjesta file a link ostaje; zamka se vratila **dvaput** nakon rucnog ciscenja). ⚠ **Dva kvara u E2E harnessu, app nijedan:** REST fallback je ispustao `onConflict` pa je svaki PONOVLJEN run pet specova padao na `409`; E15-3 je tekst info modala ocekivao na baneru. ⚠ **Dvije regresije izazvane SELIDBOM:** samoreferentno pitanje u `DONE_HISTORY` i marker `**Otvoreno:`. Ranije: S142 (2026-09-19) - `DELTA_WINDOW_SPEC` faze 1 i 2: sidro je prestalo biti **rez** i postalo **oznaka**. Prozor se mjeri sidrima umjesto danima (otvarajuce stanje je time POTVRDJEN broj, ne izracun -- izmjereno na PROD-u, 6/6 u cent), a retci unutar potvrdjenog stanja dobili su kolonu `Potvrda` + sivi ton; prazni retci topao ton. /!\ Zastita je OZNAKA, ne brana -- update-guard na uvozu je faza 4 i nje nema. Osam sabotaza kroz dva testna filea; `importForeignRows` sada uvozi file KOJI NOSI novu kolonu, pa je rizik za uvoz zatvoren mjerenjem. Ranije: S140 (2026-09-18) - instrumenti i dokumenti. `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze), pa je arhiviranje tri sesije tvrdilo da nema sto arhivirati. PENDING prepolovljen (1.198 -> 628), backlog dobio strukturu umjesto trijaznog odlomka. E7-3 i E10-2 zatvoreni -- nisu bili bug appa nego tvrdnja iz dizajna (isti commit `4413280`, S106). Obsidian navigacija zatvorena: goli `<datum>` je HTML tag, a dvotocka u naslovu lomi sidro (`+` je nevin). `dbScopedKey()` -- jedina promjena u `src/` -- sprjecava da TEST i PROD dijele filtar. Ranije: S140 (2026-09-18) - PENDING prepolovljen: 20 zatvorenih sekcija (588 redaka) preseljeno u `DONE_HISTORY.md`, pa se otvoreno vidi bez skrolanja (1.198 -> 628 redaka, 27 otvorenih testova u 15 sekcija). `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze) -- zato je arhiviranje 3 sesije tvrdilo da nema sto arhivirati. Zatvoreno E7-3/E10-2 (nisu bili bug appa nego tvrdnja iz dizajna) i Obsidian navigacija (goli `<datum>` je HTML tag; dvotocka u naslovu lomi sidro). Ranije: S139 (2026-09-17) - alati koji mjere nesto drugo nego sto tvrde: ESLint je linta o `Claude-temp_R/OLD/` pa je 75% nalaza dolazilo iz starih kopija; `structureExcel.test.mjs` je ispisivao pad i izlazio s exit 0; `audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema. `react-hooks` 189 -> 0 problema, ratchet postao tvrda brana, CI se sada okida i na `test-branch`. Ranije: S138 (2026-09-15) - deploy na `main` pusten; `cutoff:3:5` i `rata.date_map.Visa=5` primijenjeni na PROD-u kroz Structure uvoz (pod Kokinim racunom -- `areas.settings` je vlasnikov). Nadjeno da `Datum naplate` ima DVA rjecnika i da samo jedan razumije tokene. Ranije: S137 (2026-09-15) - triaza: `S119`-`S123` arhivirani (17 -> 12 otvorenih session fileova), `audit_tests.py` prestao biti slijep za cetiri od pet oblika ID-a i za tri od pet oznaka statusa; PROD potvrdio kolonu `Racun`. Ranije: S135 (2026-09-11) - E2E triaza (46/22/3; deset specova pada SAMO u punom runu), `areas_select` je trazila sam sebe pa je `INSERT ... RETURNING` padao uz poruku koja laze (`sql/052`, pusten SAMO na TEST-u), sonda dobila `areas INSERT` sa i bez `RETURNING`. Ranije: S134 (2026-09-10) - backup baze (prva kopija PROD-a uopce), shema obje baze u gitu, ciscenje RLS-a (46-50, pusteno SAMO na TEST-u) i zatvaranje otvorene rupe: bilo tko prijavljen mogao je pisati u tudju Areu.

---

## S146 — trijaza: osam sekcija, sesti kriterij, i dva kvara u harnessu (2026-09-23)

⚠ **Dva kvara koja su se vratila SELIDBOM, ne izmjenom.** Samoreferentno pitanje u
`DONE_HISTORY.md` (*„o samom ovom dokumentu"*) pokazivalo je na krivi dokument
otkad ga je S140 preselio; a marker `**Otvoreno:` otisao je s arhiviranom sekcijom
S120 i ozivio **8 fantomskih proturjecnosti** koje je S139 vec bio zatvorio.

⚠ **E2E harness je imao dva kvara, app nijedan.** Ponovljen run pet specova padao je na
`409` jer je REST fallback tiho ispustao `onConflict`; E15-3 je tekst info
modala ocekivao na baneru (treci slucaj razreda E7-3/E10-2).

**Detalji testova:** [tests/S146_tests.md](tests/S146_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| **T-S146-1** | `supabaseUpsert` `on_conflict` — ponovljen run `e8`/`e9`/`e10`/`S123` | ⬜ ⚠ **popravljen je DIJELJENI helper, a izmjeren samo `e15`.** Spec se mora pustiti **dvaput zaredom** — prvi run ne dokazuje nista |
| T-S146-2 | brana paginacije: svaki `.range()` ima `.order()` | ✅ **S146** — 10/10 sortirano, 8 tvrdnji; protuprovjera prijavljuje nesortiran upit |
| T-S146-3 | `check_links.py` javlja iz `audit_tests` i `claude_index --write` | ✅ **S146** — sabotaza u oba smjera; uhvatio mrtav link na prvoj stvarnoj upotrebi |
| T-S146-4 | `e15` zelen nakon popravaka harnessa | ✅ **S146** — **3 passed (58,7 s)** |
| T-S146-5 | marker `**Otvoreno:` prezivi sljedece arhiviranje | ⬜ jeftino (~1 min), uz sljedecu selidbu sekcije |

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
## Arhivirane sekcije — pune tablice su u `DONE_HISTORY.md`

> **S146 (2026-09-23): još šest sekcija** — `S130`, `S135`, `S107c`, `S107d`, `S107i`, `S107j`. **Osam** zatvorenih testova: četiri S107 po kriteriju *stari pipeline / nadiđeno novijom sesijom* · T-S135-11 jer ga je **S140 istražio** a status je ostao „neistrazeno" · T-S130-10 po **šestom kriteriju, ZASTARJELO**, uvedenom u ovoj sesiji · T-S130-9 **preseljen** u CLAUDE.md § Delta sheet jer je **odluka, ne test** — i na njega se šesti kriterij namjerno **ne** primjenjuje.

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
| T-S108-9 | Paginacija bez stabilnog sorta — Delete Area / Import Delete? nad >1000 atributa (regresija, nedeterministički) | ✅ **S146 — čuva ga automatski test.** Rucno se nije dalo izvesti (opisan kao *„regresija, nedeterministicki"*), pa je zamijenjen **branom**: `src/lib/__tests__/pagingOrderGuard.test.mjs` staticki provjerava da svaki `.range()` u `src/` ima `.order()`. Izmjereno: **10 poziva, svih 10 sortirano**. ⚠ Detektor mora znati **tri** stvari koje naivna verzija promasi, sve tri izmjerene: komentar koji spominje `.range(` (`useStructureData:78` opisuje bas ovaj kvar) · lanac kroz vise redaka (`useActivities`) · pomocna funkcija (`buildBaseQuery().range()`). Protuprovjera: 8 tvrdnji, ukljucujuci da nesortiran upit **bude** prijavljen |
| T-S108-10 | „From template" nosi `settings` bez `export_profiles` i bez sidara | ✅ S136 — nadiđeno upotrebom |
| T-S108-11 | Read grantee vidi pločicu, nema „Potvrdi"; write grantee ima | ✅ S136 — nadiđeno upotrebom |
| T-S108-12 | Mobitel — polje „u banci" i čip vidljivi i upotrebljivi | ✅ **26.08. uživo na PROD-u (Android)** — polje „u banci" prima unos, čip i brojevi na ekranu, ništa ne ispada|
| T-S108-13 | Help zna za Overview — chipovi na tabu, odgovori o Δ i o sidru | ✅ S136 — nadiđeno upotrebom |

**Sljedeće nakon prolaza:** Faza 2 (brzi unos — §2.9, dvije sitnice nad postojećim
Shortcut sustavom), pa Faza 3 (Koka proba na mobitelu → odluka o cutoveru).

---
