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
**Zadnji update:** S149 (2026-09-25) - pet bugova (BUG-S148-G, restore filtra bez roka, `hidden_in_add` na uvozu, kljuc nacrta, natpis plocice), svaki s testom provjerenim sabotazom; 3 rucna testa otvorena, sve ceka merge na `main`. Ranije: S148 (2026-09-24) - Visa kosare na PROD-u u cent 2024-10 -> 2026-09 (visak su bili Sasini rucni retci uz iste retke s izvoda; kolovoski izvod uvezen). Svih 5 testova S148 zatvoreno mjerenjem. Ranije: S147 (2026-09-24) - testiranje. Hrpa B prosla u cijelosti na `dev:prod` (T-S145-1/2, T-S108-1b/4, T-S131-34), `T-S137-8` na TEST-u, `T-S146-1` na ponovljenom E2E runu (11/11); cetiri sekcije arhivirane, PENDING **299 -> 113**. Otvoreno ostaju **3**: `T-S145-3` (pracenje), `T-S140-8` + `T-S141-1` (posao, ne test). Nov prijedlog: `docs/DOSPJELO_SPEC.md`. Ranije: S146 (2026-09-23) - trijaza. **Osam sekcija arhivirano** (S106, S107c/d/i/j, S120, S130, S135); PENDING **543 -> 277** redaka, otvorenih testova **18 -> 8**. Uveden **sesti kriterij zatvaranja, ZASTARJELO** (Sasina formulacija: *test tvrdi brojku iz trenutka, a mehanizam je mjeri iznova sam*) — s dvije granice, da ne postane kos za sve nezgodno. `check_links.py` je postao **brana** koju zovu `audit_tests.py` i `claude_index.py --write` (arhiviranje premjesta file a link ostaje; zamka se vratila **dvaput** nakon rucnog ciscenja). ⚠ **Dva kvara u E2E harnessu, app nijedan:** REST fallback je ispustao `onConflict` pa je svaki PONOVLJEN run pet specova padao na `409`; E15-3 je tekst info modala ocekivao na baneru. ⚠ **Dvije regresije izazvane SELIDBOM:** samoreferentno pitanje u `DONE_HISTORY` i marker `**Otvoreno:`. Ranije: S142 (2026-09-19) - `DELTA_WINDOW_SPEC` faze 1 i 2: sidro je prestalo biti **rez** i postalo **oznaka**. Prozor se mjeri sidrima umjesto danima (otvarajuce stanje je time POTVRDJEN broj, ne izracun -- izmjereno na PROD-u, 6/6 u cent), a retci unutar potvrdjenog stanja dobili su kolonu `Potvrda` + sivi ton; prazni retci topao ton. /!\ Zastita je OZNAKA, ne brana -- update-guard na uvozu je faza 4 i nje nema. Osam sabotaza kroz dva testna filea; `importForeignRows` sada uvozi file KOJI NOSI novu kolonu, pa je rizik za uvoz zatvoren mjerenjem. Ranije: S140 (2026-09-18) - instrumenti i dokumenti. `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze), pa je arhiviranje tri sesije tvrdilo da nema sto arhivirati. PENDING prepolovljen (1.198 -> 628), backlog dobio strukturu umjesto trijaznog odlomka. E7-3 i E10-2 zatvoreni -- nisu bili bug appa nego tvrdnja iz dizajna (isti commit `4413280`, S106). Obsidian navigacija zatvorena: goli `<datum>` je HTML tag, a dvotocka u naslovu lomi sidro (`+` je nevin). `dbScopedKey()` -- jedina promjena u `src/` -- sprjecava da TEST i PROD dijele filtar. Ranije: S140 (2026-09-18) - PENDING prepolovljen: 20 zatvorenih sekcija (588 redaka) preseljeno u `DONE_HISTORY.md`, pa se otvoreno vidi bez skrolanja (1.198 -> 628 redaka, 27 otvorenih testova u 15 sekcija). `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze) -- zato je arhiviranje 3 sesije tvrdilo da nema sto arhivirati. Zatvoreno E7-3/E10-2 (nisu bili bug appa nego tvrdnja iz dizajna) i Obsidian navigacija (goli `<datum>` je HTML tag; dvotocka u naslovu lomi sidro). Ranije: S139 (2026-09-17) - alati koji mjere nesto drugo nego sto tvrde: ESLint je linta o `Claude-temp_R/OLD/` pa je 75% nalaza dolazilo iz starih kopija; `structureExcel.test.mjs` je ispisivao pad i izlazio s exit 0; `audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema. `react-hooks` 189 -> 0 problema, ratchet postao tvrda brana, CI se sada okida i na `test-branch`. Ranije: S138 (2026-09-15) - deploy na `main` pusten; `cutoff:3:5` i `rata.date_map.Visa=5` primijenjeni na PROD-u kroz Structure uvoz (pod Kokinim racunom -- `areas.settings` je vlasnikov). Nadjeno da `Datum naplate` ima DVA rjecnika i da samo jedan razumije tokene. Ranije: S137 (2026-09-15) - triaza: `S119`-`S123` arhivirani (17 -> 12 otvorenih session fileova), `audit_tests.py` prestao biti slijep za cetiri od pet oblika ID-a i za tri od pet oznaka statusa; PROD potvrdio kolonu `Racun`. Ranije: S135 (2026-09-11) - E2E triaza (46/22/3; deset specova pada SAMO u punom runu), `areas_select` je trazila sam sebe pa je `INSERT ... RETURNING` padao uz poruku koja laze (`sql/052`, pusten SAMO na TEST-u), sonda dobila `areas INSERT` sa i bez `RETURNING`. Ranije: S134 (2026-09-10) - backup baze (prva kopija PROD-a uopce), shema obje baze u gitu, ciscenje RLS-a (46-50, pusteno SAMO na TEST-u) i zatvaranje otvorene rupe: bilo tko prijavljen mogao je pisati u tudju Areu.

---

## S149 — pet bugova, svaki s testom koji je provjeren i u drugom smjeru (2026-09-25)

⚠ **Ništa od ovoga nije na PROD-u dok Saša ne pusti merge na `main`.**

**Detalji testova:** [tests/S149_tests.md](tests/S149_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S149-1 | Kriv e-mail u koloni G: preview crven, Apply siv; s ispravnim e-mailom *Fix as owner* ažurira, ne dodaje | ✅ S149 — izmjereno 25.09. na `dev:prod`, Kokin račun: Sašin redak s Kokinim e-mailom ⇒ crvena kutija (red 27), Apply siv, `0 New`; korak 4 (*Fix as owner*) nije ponavljan — postojeći put, radio na PROD-u u S148 |
| T-S149-2 | „Restoring filter…" odustane nakon 8 s, Area ostaje, traka kaže što sad | ✅ S149 — čuva automatski test (`S149_restore_deadline.spec.ts`, sabotaža pada) |
| T-S149-3 | Structure file bez kolone `HiddenInAdd` ne briše skrivanje; prazna ćelija u postojećoj koloni ga briše | ✅ S149 — izmjereno 25.09. na TEST-u (`Health_Sasa > Medical Visit > Napomena`): file bez kolone + promijenjen opis ⇒ `Attributes updated 1`, opis `X Notes…` upisan, Napomena ostala skrivena; protuprovjera prazna ćelija ⇒ vidljiva. ⚠ Prvi pokušaj nije mjerio ništa — file nije bio spremljen, pa uvoz nije imao što pisati |
| T-S149-4 | Nacrt Add Activityja pod ključem s ref-om baze | ✅ S149 — čuvaju automatski testovi (`S121`/`S122` E2E, sabotaža ruši 2/3) |
| T-S149-5 | Pločica: „zadnja promjena salda" umjesto „zadnji zapis" (PROD, nakon deploya) | ✅ S149 — izmjereno 25.09. na `dev:prod`, Kokin račun (ZABA i RF) |

---

## S145 — testiranje hrpe A, a tri od cetiri popravka nisu bila na popisu (2026-09-22)

⚠ **Sest testova hrpe A su svi prosli, ali su usput ispala cetiri kvara.** Jedan je
gasio Kokin Overview tab pri svakom povratku, jedan bi uvozom vratio konfiguraciju iz
S138 unatrag, jedan gubi lipe pri dijeljenju rata, a cetvrti se nije dao reproducirati.
⚠ **Dva testa iz hrpe A nisu mjerila nista iz prvog pokusaja** (T-S133-5) — v. tamosnji redak.

**Detalji testova:** [tests/S145_tests.md](tests/S145_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| **T-S145-1** | Overview tab prezivi povratak — F5, View details, Finish | ✅ **S147, 24.09. `dev:prod`** — F5 (22.09.), Finish → `Go to Home` vraća na Overview i pločica preračuna (`Racun −1` ⇒ `12.301,90 → 12.300,90`, 20 → 21 promjena; `Cash 1` ne miče saldo, ispravno). ⚠ **Korak 3 bio je napisan iz dizajna:** s Overviewa **nema puta** do View detailsa (drill vodi u Activities), pa povratak na Activities jest ispravan. Remount `AppHome`-a mjere koraci 2 i 4 |
| **T-S145-2** | Rata s ostatkom: `100 / 3` — modal `33.34 / 33.33 / 33.33` + žuta napomena, isti broj u atributu i u komentaru retka | ✅ **S147, 24.09. `dev:prod`** — modal `33.34 / 33.33 / 33.33` + napomena *„zbroj je točno 100.00"*; u listi isti broj u iznosu i komentaru (`rata 1/3 · 33.34 od 100`); naplate 05.10./05.11./05.12. (kupnja 24.09. ⇒ `cutoff:3:5` točan). Automatski dio: `rataAmounts.test.mjs` |
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

**Arhivirano u S137:** `S136` (svi testovi ✅) → `Claude-temp_R/test-sessions/archive/`. Zadnji je pao `T-S136-7`, potvrđen i popravljen 15.09. Narativ je u `DONE_HISTORY.md`.

## Arhivirane sekcije — pune tablice su u `DONE_HISTORY.md`

> **S148 (2026-09-24): sekcija `S148`** (+ `S148_tests.md` u arhivu) — svih 5 testova zatvoreno mjerenjem u istoj sesiji.

> **S147 (2026-09-24): još četiri sekcije** — `S131`, `S108`, `S137`, `S146` (+ detaljni `S108`/`S137`/`S146_tests.md` u arhivu). Osam testova zatvoreno **izvođenjem** (hrpa B na `dev:prod`, `T-S137-8` na TEST-u, `T-S146-1` ponovljenim E2E runom), nijedan procjenom. PENDING **299 → 113** redaka. ⚠ Redak „Otvoreno (S131)" nabrajao je **22** testa koji su u tablici već bili ✅ — ručni popis uz tablicu, razred koji je S116 ukinuo samo za zaglavlje.

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

