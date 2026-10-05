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
**Zadnji update:** S160 (2026-10-04) - P1 tihi gubici + dio P3 (filtar datum/da-ne, B4/F7, Help markdown); 8 ručnih testova, 6 ✅, 6 kvarova nađeno testiranjem i popravljeno. Ranije: S159 (2026-10-02) - ne-Financije backlog (B3, fan-out, B6, D2/D4/D5, F4, C4); 7 ručnih testova. Ranije: S158 (2026-10-02) - audit procesa Financija: `FINANCIJE_PROCES.md`, MC izvod 2026-09 u cent, T11 (37 rata + 7 naknada), T5–T10 alati, T24 regex; 6 testova (2 ✅). Ranije: S157 (2026-10-01) - traka uživo na TEST-u (kopija PROD-a): PGRST201, pravilo C (ručna naplata), `Smjer` u `settle`; T-S157-1..6 ✅ i arhivirani; T-S156-1..4 zatvoreni; deploy S156+S157 na `main`. Otvoreno: T-S156-5/6/7 (od 11.10.). Ranije: S156 (2026-09-30) - C5 faza 2 (`Potvrdi` + skupni redak iz trake, `sql/055` samo na TEST-u); 7 ručnih testova otvoreno; S155 arhiviran (svih 9 ✅). Ranije: S155 (2026-09-30) - C3b (žig izvoda), C3c (upozorenje u Editu na potvrđenom retku), C5 faza 1 (traka „Čeka potvrdu”); `053`/`054` na TEST-u; 7 ručnih testova otvoreno. Ranije: S154 (2026-09-28) - S152 testovi zatvoreni (osim T-S152-7, ceka izvod); BUG-S154-DATARANGE; tri Kokine prijave s malog iPhonea (`+` ugasen bez rijeci dok se filtar obnavlja, Area s jednim leafom, zapamceno zatvaranje leafa) + Help jezicac; merge na `main` (`d74c084`). Otvoreno: T-S154-2 (Kokin iPhone nakon deploya). Ranije: S152 (2026-09-26) - B1 (jedan graditelj `validation_rules`; „Other" vise ne brise `default_map`/`hidden_in_add`), B2, razvrstac izvoda, C2+C3, lokalni dan umjesto UTC-a; 7 rucnih testova otvoreno, 2 izmjerena. Ranije: S149 (2026-09-25) - pet bugova (BUG-S148-G, restore filtra bez roka, `hidden_in_add` na uvozu, kljuc nacrta, natpis plocice), svaki s testom provjerenim sabotazom; 3 rucna testa otvorena, sve ceka merge na `main`. Ranije: S148 (2026-09-24) - Visa kosare na PROD-u u cent 2024-10 -> 2026-09 (visak su bili Sasini rucni retci uz iste retke s izvoda; kolovoski izvod uvezen). Svih 5 testova S148 zatvoreno mjerenjem. Ranije: S147 (2026-09-24) - testiranje. Hrpa B prosla u cijelosti na `dev:prod` (T-S145-1/2, T-S108-1b/4, T-S131-34), `T-S137-8` na TEST-u, `T-S146-1` na ponovljenom E2E runu (11/11); cetiri sekcije arhivirane, PENDING **299 -> 113**. Otvoreno ostaju **3**: `T-S145-3` (pracenje), `T-S140-8` + `T-S141-1` (posao, ne test). Nov prijedlog: `docs/DOSPJELO_SPEC.md`. Ranije: S146 (2026-09-23) - trijaza. **Osam sekcija arhivirano** (S106, S107c/d/i/j, S120, S130, S135); PENDING **543 -> 277** redaka, otvorenih testova **18 -> 8**. Uveden **sesti kriterij zatvaranja, ZASTARJELO** (Sasina formulacija: *test tvrdi brojku iz trenutka, a mehanizam je mjeri iznova sam*) — s dvije granice, da ne postane kos za sve nezgodno. `check_links.py` je postao **brana** koju zovu `audit_tests.py` i `claude_index.py --write` (arhiviranje premjesta file a link ostaje; zamka se vratila **dvaput** nakon rucnog ciscenja). ⚠ **Dva kvara u E2E harnessu, app nijedan:** REST fallback je ispustao `onConflict` pa je svaki PONOVLJEN run pet specova padao na `409`; E15-3 je tekst info modala ocekivao na baneru. ⚠ **Dvije regresije izazvane SELIDBOM:** samoreferentno pitanje u `DONE_HISTORY` i marker `**Otvoreno:`. Ranije: S142 (2026-09-19) - `DELTA_WINDOW_SPEC` faze 1 i 2: sidro je prestalo biti **rez** i postalo **oznaka**. Prozor se mjeri sidrima umjesto danima (otvarajuce stanje je time POTVRDJEN broj, ne izracun -- izmjereno na PROD-u, 6/6 u cent), a retci unutar potvrdjenog stanja dobili su kolonu `Potvrda` + sivi ton; prazni retci topao ton. /!\ Zastita je OZNAKA, ne brana -- update-guard na uvozu je faza 4 i nje nema. Osam sabotaza kroz dva testna filea; `importForeignRows` sada uvozi file KOJI NOSI novu kolonu, pa je rizik za uvoz zatvoren mjerenjem. Ranije: S140 (2026-09-18) - instrumenti i dokumenti. `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze), pa je arhiviranje tri sesije tvrdilo da nema sto arhivirati. PENDING prepolovljen (1.198 -> 628), backlog dobio strukturu umjesto trijaznog odlomka. E7-3 i E10-2 zatvoreni -- nisu bili bug appa nego tvrdnja iz dizajna (isti commit `4413280`, S106). Obsidian navigacija zatvorena: goli `<datum>` je HTML tag, a dvotocka u naslovu lomi sidro (`+` je nevin). `dbScopedKey()` -- jedina promjena u `src/` -- sprjecava da TEST i PROD dijele filtar. Ranije: S140 (2026-09-18) - PENDING prepolovljen: 20 zatvorenih sekcija (588 redaka) preseljeno u `DONE_HISTORY.md`, pa se otvoreno vidi bez skrolanja (1.198 -> 628 redaka, 27 otvorenih testova u 15 sekcija). `audit_tests.py` je fileu pripisivao svaki ID koji se u njemu SPOMINJE (unakrsne reference iz proze) -- zato je arhiviranje 3 sesije tvrdilo da nema sto arhivirati. Zatvoreno E7-3/E10-2 (nisu bili bug appa nego tvrdnja iz dizajna) i Obsidian navigacija (goli `<datum>` je HTML tag; dvotocka u naslovu lomi sidro). Ranije: S139 (2026-09-17) - alati koji mjere nesto drugo nego sto tvrde: ESLint je linta o `Claude-temp_R/OLD/` pa je 75% nalaza dolazilo iz starih kopija; `structureExcel.test.mjs` je ispisivao pad i izlazio s exit 0; `audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema. `react-hooks` 189 -> 0 problema, ratchet postao tvrda brana, CI se sada okida i na `test-branch`. Ranije: S138 (2026-09-15) - deploy na `main` pusten; `cutoff:3:5` i `rata.date_map.Visa=5` primijenjeni na PROD-u kroz Structure uvoz (pod Kokinim racunom -- `areas.settings` je vlasnikov). Nadjeno da `Datum naplate` ima DVA rjecnika i da samo jedan razumije tokene. Ranije: S137 (2026-09-15) - triaza: `S119`-`S123` arhivirani (17 -> 12 otvorenih session fileova), `audit_tests.py` prestao biti slijep za cetiri od pet oblika ID-a i za tri od pet oznaka statusa; PROD potvrdio kolonu `Racun`. Ranije: S135 (2026-09-11) - E2E triaza (46/22/3; deset specova pada SAMO u punom runu), `areas_select` je trazila sam sebe pa je `INSERT ... RETURNING` padao uz poruku koja laze (`sql/052`, pusten SAMO na TEST-u), sonda dobila `areas INSERT` sa i bez `RETURNING`. Ranije: S134 (2026-09-10) - backup baze (prva kopija PROD-a uopce), shema obje baze u gitu, ciscenje RLS-a (46-50, pusteno SAMO na TEST-u) i zatvaranje otvorene rupe: bilo tko prijavljen mogao je pisati u tudju Areu.

---

## S161 — mjesečni krug: ZABA + Visa izvod 2026-09, Visa alat bez mjesečnih popisa (2026-10-05)

ZABA −8,60 = Visa kupnja (Ljekarna Štimac) upisana na ZABA račun. Visa izvod 1.150,92 plaćen 05.10.; `visa_uvoz_izvoda.py` radi svaki mjesec bez izmjene (test: kolovoški izvod ponovno ⇒ 48/48, 0 New / 0 Modify).

**Detalji testova:** [tests/S161_tests.md](tests/S161_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S161-1 | Koka uvozi `visa_uvoz_2026-09_*.xlsx`: pregled **9 New · 33 Modify · 1 Delete**; ZABA pločica **11.191,11**; RF −270,00 ± uplate od 29.09.; ponovno pokretanje alata ⇒ 0/0 | ✅ S161 — uvoz 9/33/1; ZABA 11.191,11 i RF 878,09 (uz Sašine mirovine 1.057,31 + 101,78 i naknadu −11,00) = banka; ponovni prolaz 40/40 spareno, 0 New · 0 Modify; `promet_check` 2026-09 ✓ (30 u cent, 3 stara iz 2024.) |
| T-S161-2 | ZABA sidro 01.10.2026. = 11.714,47 (izvod) nakon T-S161-1 ⇒ saldo 11.191,11, Δ 0; `promet_check` 2026-09 ✓ | ✅ S161 — upisana sidra S EKRANA umjesto izvoda (Koka, 05.10.): ZABA očitano 11.246,61 − povrat 55,50 ⇒ **11.191,11 @ 04.10.**, RF 878,09 − promet 05.10. ⇒ **2.040,18 @ 04.10.**; oba = app prije sidra. Izvodno sidro 01.10. nije upisano (neobavezno: samo kontrolna točka) |
| T-S161-3 | Visa izvod 2026-10 kroz isti alat bez izmjene koda; rate planova iz appa sparene | ⬜ |

---

## S160b — grantee ne dodaje opcije (2026-10-04)

Na `test-branch`, nije na `main`. Grantee umjesto „Other..." vidi sivu stavku o vlasniku; neuspio upis opcije sada je poruka, ne samo konzola.

**Detalji testova:** [tests/S160b_tests.md](tests/S160b_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S160b-1 | Grantee (PROD, `dev:prod`): Podtip/Smjer u Add i Edit bez „Other...", siva stavka „Nova opcija? Dodaje je vlasnik Aree (…)"; vlasnik i dalje ima „Other..." | ⬜ DJELOMIČNO — grantee strana ✅ S160b (Playwright, TEST, `owner@test.com` write na Sašinu `Health_Sasa`, Add → `Lab`: `… | Ostalo | Nova opcija? Dodaje je vlasnik Aree (sladosa)`, bez „Other..."). Ostaje: vlasnik i dalje vidi „Other..." (Saša/Koka) |

---

## S158 — audit procesa Financija, MC izvod 2026-09, T11 rate, T5–T10 alati (2026-10-02)

Samo Python alati i dokumenti, bez promjene u appu. Košara 11.10. na PROD-u = izvod u cent (55 / 1.189,34); uvezeno 37 budućih MC rata + 7 naknada (11.11. = 499,18, 11.12. = 434,05).

**Detalji testova:** [tests/S158_tests.md](tests/S158_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S158-1 | PROD, Koka, 11.10.: traka 55 stavki / 1.189,34 ⇒ ✓ slaže se ⇒ Potvrdi (isti trenutak kao T-S156-6) | ⬜ |
| T-S158-2 | `MC_2026-10`: rate i naknade NISU u `ZA UVOZ` (već u bazi); 11.11. razlika = samo neupisane kupovine | ⬜ |
| T-S158-3 | `rate_alat --only b` nakon uvoza nudi 0 rata (ne generira dvaput) | ✅ S158 — izmjereno: 0 planova / 0 rata |
| T-S158-4 | Visa rujan: razvrstač daje `PBZVISA_`, `visa_uvoz_izvoda` samo imenom, zaglavlje `[PROD]`, Σ u cent | ⬜ |
| T-S158-5 | ZABA: `fill_from_izvod --zaba` imenom, presedani iz `ET_TARGET`; `promet_check` vidi PDF i u korijenu `izvodi\` | ⬜ |
| T-S158-6 | Ispisi kontrolnih alata prije/poslije izmjena i selidbe identični | ✅ S158 — izmjereno `diff`om (namjerne razlike: `[PROD]` redak, `PBZVISA_`) |

---

## S156 — C5 faza 2: `Potvrdi` + skupni redak (2026-09-30)

⚠ Na `test-branch`, nije na `main`. `sql/055` pušten **samo na TEST-u** (Claude); `rpc_area_due_baskets` izmjereno isto prije i poslije, pokus pod RLS-om (11 statusa + upis retka, `ROLLBACK`) prošao. Automatski dio: `dueSettle.test.mjs` (38) — sabotaže ruše 2 / 2 / 1. ⚠ **Merge tek nakon 11.10.** i nakon što Saša pusti `055` na PROD-u.

**Detalji testova:** [tests/S156_tests.md](tests/S156_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S156-1 | TEST: `1244,74` / 11.07. ⇒ „Upiši naplatu kako ju je banka skinula” ⇒ skupni redak, košara ostaje kao „naplaćeno — neusklađeno · razlika 986,28”, pločica −1.244,74 | ✅ S157 — izmjereno: koraci 2–5 kako piše; „pločica −1.244,74” bila je **kriva tvrdnja** (11.07. je prije sidra 30.07.); otkrio PGRST201 i duplikat ručne naplate ⇒ pravilo C |
| T-S156-2 | TEST: Edit skupnog retka na 2231,02 ⇒ „✓ slaže se” + Potvrdi ⇒ samo 11 statusa, **bez** drugog retka | ✅ S157 — zamijenjen T-S157-2 (TEST je sada kopija PROD-a, košara 11.07. zatvorena) |
| T-S156-3 | TEST: `2231,02` / 11.07. ⇒ Potvrdi ⇒ redak + 11 statusa, traka nestane | ✅ S157 — zamijenjen T-S157-3 (košara poslije sidra, saldo se mora pomaknuti) |
| T-S156-4 | TEST: brane — bez dana nema gumba; dan >3 dana od dospijeća crveno; `abc`; izmjena iznosa zatvara kutiju; uska širina | ✅ S157 — zamijenjen T-S157-6 |
| T-S156-5 | PROD (nakon merge-a), Saša kao grantee: usporedba da, gumb ne, rečenica zašto | ⬜ |
| T-S156-6 | PROD, Koka, 11.10.: prava MC košara, saldo ZABA isti dan = banka | ⬜ |
| T-S156-7 | `fill_from_izvod.py --zaba` sa ZABA_2026-10: skupna naplata preskočena (točno ili ≈ ≤3 dana), nikad nov redak | ⬜ |

---

## S154 — testovi S152 + BUG-S154-DATARANGE (2026-09-28)

⚠ Na `test-branch`, nije na `main`. Automatski dio: `dateBounds.test.mjs` (15 tvrdnji; stari hook ruši **8**, uključujući utrku s točno izmjerenim `2003-04-07 — 2027-04-30`).

**Detalji testova:** [tests/S154_tests.md](tests/S154_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S154-1 | „Data range" broji samo odabranu Areu: TEST `Financije_all` ⇒ `2025-01-01 — 2026-09-28`, i nakon F5 | ✅ **S154, 28.09. `dev:prod`, Kokin račun:** `Health_Sasa` `2003-04-07 — 2027-04-30`, `Financije_all` `2023-01-01 — 2026-09-28`, All Areas cijela baza — **sve se poklapa s bazom** (izmjereno REST-om istog dana); nakon F5 na iPhone SE veličini i dalje `2023-01-01 — 2026-09-28` |
| T-S154-2 | `+` dodirnut dok se filtar još obnavlja: kružić, pa se Add otvori sam (ne „ništa") | ⬜ **lokalno neizvedivo** — pod 3G dev server ne učita ni popis Area (Sašina slika 28.09.). Mjeri se **na Kokinom iPhoneu nakon deploya**: reagira li `+` iz prve |
| T-S154-3 | `Financije_all > All Categories`: `+` zelen i vodi u `Transakcija`; Area s više leafova: dodir ⇒ poruka, hint na hrvatskom | ✅ **S154, 28.09. `dev:prod`, iPhone SE** — Kokin račun: `Financije_all > All Categories` ⇒ `+` zelen, Add `Financije_all > Transakcija` (otvorena). Protuprovjera pod **Sašinim** računom (`Health_Sasa`, vlasnik, 3 leafa): `+` blijed, dodir ⇒ *„Odaberi kategoriju u filtru (onu bez podkategorija)"*. ⚠ Prvi pokušaj protuprovjere pod Kokinim računom nije mjerio ništa: ondje ima **`read`** (izmjereno u `data_shares`), a jedina Area koju smije pisati ima 1 leaf. Usput: read grantee je dobivao ugašen `+` bez riječi — od `cc9fb4b` dodir ⇒ *„Read only access — cannot add activities"* (izmjereno) |
| T-S154-4 | Zatvorena `Transakcija` u Addu se ne pamti — sljedeći Add je otvoren | ✅ **S154, 28.09. `dev:prod`, Kokin račun, iPhone SE** — zatvoreno, ✕, novi Add otvoren |
| T-S154-5 | iPhone SE: `?` je jezičac uz desni rub na pola visine, ne prekriva `+` ni ⋮ ni polja forme; na desktopu ostaje dolje desno | ✅ **S154, 28.09.** — jezičac na pola visine (lista i Add), ne sjeda na `+` ni na polja; dodir otvara Help |

---

## S152 — B1/B2, razvrstač izvoda, datumi rata i Edita, UTC datum (2026-09-26)

⚠ **Sve je na `test-branch`, nije na `main`** — ručni testovi idu na lokalnom dev serveru
(`npm run dev` = TEST, `dev:prod` = PROD). Automatski dio: `validationRules`, `rataChargeDates`,
`shiftSameDayTarget`, `localDate` (svaki provjeren sabotažom).

**Detalji testova:** [tests/S152_tests.md](tests/S152_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S152-1 | Structure uvoz nakon Save u panelu → `Attributes updated 0`; prava promjena → 1 (TEST) | ✅ **S153, 27.09. TEST** — nepromijenjen file: sve 0; opcija `TEST` dodana u `Smjer` ⇒ `Attributes updated 1`; maknuta iz filea ⇒ opet `1` i **nestala iz baze** (uvoz ZAMJENJUJE popis opcija, ne samo dodaje). ⚠ Prvi pokušaj je ispao `List columns 1` bez promjene (JSONB presloži ključeve, uvoz uspoređivao doslovnim `JSON.stringify`) — popravljeno, čuva `structureListColumnsCompare.test.mjs` |
| T-S152-2 | „Other" u Add/Editu ne briše default (`WhenValue`) ni „Hidden in Add" (TEST, vlastita Area) | ✅ **S153** — **A (27.09. TEST):** `Status` Other → `TESTNOVO` + Finish ⇒ redak nosi `TESTNOVO`, opcija dodana pod `Mastercard`, `default_map` (4 ključa) netaknut, Edit prikazuje `TESTNOVO`. ⚠ Prvi pokušaj spremio `Planiran` bez opcije — Edit **nije** uzrok (atributi upisani samo pri Finishu, izmjereno); uzrok neutvrđen, čisti put radi. **B:** `Valuta` Other → `TestB` u Editu ⇒ opcija dodana, `hidden_in_add: true` ostao (baza + panel), u Addu i dalje samo pod „prazna po pravilu". |
| T-S152-3 | Panel: nema polja „Default options", umjesto njega napomena o `*` (TEST) | ✅ S153 — izmjereno u ovoj sesiji: Sašine slike panela (`Izvor`, `Status`, 27.09. TEST) nemaju polje, i sa starim i s novim natpisom (S153 natpis ovisi o tipu atributa) |
| T-S152-4 | Visa rata kupljena 02.09. → prva rata **05.09.**; MC 26.09. → 11.10. (`dev:prod`, obriši retke) | ✅ **S154, 28.09. `dev:prod`, Kokin račun** — datum u zaglavlju Adda 28.09. → 02.09. ⇒ `Datum naplate` 05/10 → **05/09/2026** (forma preračunava na promjenu datuma); modal `05.09. / 05.10. / 05.11.2026.` po `10.00`; lista: 3 retka `rata 1/3..3/3 · 10 od 30` na 02.09. Retci obrisani. MC kontrola u UI-ju nije izvođena — čuva je `rataChargeDates.test.mjs` (MC 26.09. ⇒ 11.10./11.11./11.12. i stari = novi za MC). ⚠ Prvi pokušaj: `3` upisan u `Rata br` umjesto `Broj rata` ⇒ modal se ne bi ni otvorio; uputa u testu je bila točna, ali polja stoje jedno ispod drugog |
| T-S152-5 | Edit: promjena datuma pomiče `Datum naplate` za Racun/Cash, ne za karticu (`dev:prod`, bez spremanja) | ✅ **S154, 28.09. `dev:prod`, Kokin račun** — testni `Cash 1 €` (28.09.): datum → 26.09. ⇒ `Datum naplate` 26.09.; → 23.09. ⇒ 23.09., oba puta odmah. MC redak: datum → 23.09., `Datum naplate` ostao `11.10.` Testni retci obrisani. ⚠ Kartični korak u UI-ju **ne razlikuje** ispravno od pokvarenog (MC datum naplate ionako nije jednak datumu retka, pa ga ne bi dirao ni kod bez provjere `Izvor`a — S129 pravilo); taj rub čuva `shiftSameDayTarget.test.mjs` (*„Visa — ni kad se slučajno poklapa sa starim datumom"*) |
| T-S152-6 | „This Month" = 01.–30.09., „This Year" = 01.01.–31.12. | ✅ **S154, 28.09. TEST** — This Month `01/09/2026 – 30/09/2026`, This Year `01/01/2026 – 31/12/2026` (Sašine slike). Prazna rujanska lista je ispravna: najnoviji redak `Financije_all` na TEST-u je 24.08. ⚠ Usput: „Data range" pokazuje `2003-04-07` iako je najstariji redak te Aree na TEST-u `2025-01-01` (izmjereno REST-om) ⇒ v. BUG-S154-DATARANGE |
| T-S152-7 | Razvrstač na pravom novom izvodu (kad Koka pošalje): dry → `--apply` → „vec imamo" | ⬜ |
| T-S152-8 | `make_financije_all_structure.py` staje nad `Financije_all` | ✅ S152 — izmjereno (exit 1, 49 redaka; stari export prolazi) |
| T-S152-9 | Razvrstač: stvarni inbox + pješčanik (5 scenarija) | ✅ S152 — izmjereno |

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

