# PENDING TESTS

**Otvoreno: NE VODI SE OVDJE** -- vodi se iskljucivo u tablicama (`audit_tests.py`). Pravila filea: [na dnu](#o-ovom-fileu).

**Branch:** `test-branch` (dev) / `main` (PROD) · **Zadnji update:** S174 (2026-10-18) · povijest sesija: `DONE_HISTORY.md`

---

## S174 — Klasifikacija povijesti: uvozni guard + pravila po trgovcu (T17) (2026-10-18)

Uvoz više ne traži kvačicu „potvrđeno stanje" za razvrstavanje (samo bankino polje pita — isto pravilo kao Edit). 31 pravilo po trgovcu (AI predložio, Python prebrojao, Saša odobrio) je 4. ključ `razvrstaj_na.py`: starija povijest ZABA 38 → 70, RF 29 → 90 prijedloga (PROD snimka 18.10.).

**Detalji testova:** [tests/S174_tests.md](tests/S174_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S174-1 | Guard pita samo za bankino polje (unit `importConfirmedBankFields`, 10 tvrdnji) | ✅ S174 — čuva automatski test (protuprovjera i sabotaža ruše 4) |
| T-S174-2 | TEST lokalno: uvoz `na_razvrstavanje_kokin_tekuci_zaba_202401-202509_20261018_1628.xlsx` ⇒ 0 · 70 · 0, **bez** kutije „POTVRĐENOG stanja" (staro: 15); izmijenjen iznos jednog Racun retka ⇒ pita za 1 | ⬜ |
| T-S174-3 | PROD: starija povijest s pravilima (nasljeđuje T-S169-7) — ZABA 257 / 70 (32 pravila), RF 384 / 90 (61) ⇒ razvrstavanje ⇒ `--preuzmi` ⇒ uvoz pod Kokom, bez kutije potvrđenog stanja | ⬜ |
| T-S174-4 | Provjera unatrag po pravilu (PROD snimka): iz pravila 144/147 (98,0 %), 12 mj 54/56 | ✅ S174 — izmjereno (in-sample, v. detalje) |
| T-S174-5 | PROD, **POSLIJE uvoza T-S174-3**: Nenini retci — `ispravi_tip` ×2 (`Claude-temp_R/s174_pravila/nena_naredbe.ps1`) ⇒ Koka uvozi `0 · 36 · 0` (Transfer / Nena) i `0 · 5 · 0` (Razno / Nena's funds), saldo nepomaknut | ⬜ |

---

## S173 — MC alat prije 11.11.: T13/T14/T15/T16/T23 u `fill_from_izvod --mc` (2026-10-18)

Samo Python alati (`_mc_spajanje.py` nov, `fill_from_izvod.py`, parser u `uskladi_izvod.py`), bez promjene appa. Nad stanjem od 02.10. alat sam proizvodi ono što je S158 složio ručno (košara 55 / 1.189,34 u cent; pravi parser uvoza appa 24 / 38 / 4). Harness: `Claude-temp_R/s173_mc/regresija.sh`.

**Detalji testova:** [tests/S173_tests.md](tests/S173_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S173-1 | Offline nad backup snimkama: stanje 02.10. ⇒ 24 New · 38 Modify · 4 Delete, košara = S158, ponovni prolaz 0/0, stanje poslije S158 0 New, sintetički studeni 12/12 | ✅ S173 — izmjereno (8 provjera u detaljima; sabotaže ruše 4 i 2); čuva `regresija.sh` (lokalno, uz backupe) |
| T-S173-2 | ~02.11. PROD, Saša: `MC_2026-10` kroz `--mc` — 15 rata starih planova i 4 naknade 11.11. SPARENE (nijedna u NOVI), KONTROLA ✓ u cent, novi retci pod Kokom | ⬜ |
| T-S173-3 | Koka uvozi `_filled`: pregled = OČEKIVANO iz ispisa, nijedan nov redak „tuđi" | ⬜ |
| T-S173-4 | Ponovni prolaz nad uvezenim: 0 New · 0 Modify; 11.11. traka MC slaže se ⇒ Potvrdi | ⬜ |
| T-S173-5 | Samo uz `⚠ NOV PLAN`: `rate_alat --only b` nudi preostale rate, naknade su već ušle | ⬜ |

---

## S172 — povratak razdoblja nakon ↗, zatvaranje testova (2026-10-17)

Košare „isti dan u Activities ↗" postavljaju filtar na jedan dan; povratak na Overview sada vraća razdoblje od prije (saldo je inače pokazivao stanje na taj dan, Sašin nalaz). Ručno razdoblje izabrano u Activities ostaje. Pamti se do F5 (`dayDrillReturn.ts`). Automatski: `dayDrillReturn.test.mjs` (7; sabotaža ruši 2), E2E `S171_baskets_and_narrow_filter` korak 3d.

**Detalji testova:** [tests/S172_tests.md](tests/S172_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S172-1 | PROD (nakon deploya): This Year → Košare → ↗ na kupnji ⇒ Activities na taj dan ⇒ tab Overview ⇒ opet This Year, ZABA saldo = današnji; s ručno promijenjenim razdobljem u Activities ostaje ručno | ✅ 17.10. (Saša, lokalno TEST = kopija PROD-a) — ↗ pa tab Overview ⇒ opet This Year, saldo isti; ručni This Month u Activities ostao This Month; **PROD 17.10.** nakon deploya isto ✅ |
| T-S172-2 | E2E E11-4 / E12-2 / E13-2 stalno padaju — podaci na TEST-u i zastarjeli tekst | ✅ S172 (17.10.) — TEST očišćen (8 zaostalih Area, 2 tuđa sharea); `global-setup` to sada provodi pri svakom runu (pokus: podmetnuta Area + share ⇒ uklonjeni i ispisani); E13-2 spec tražio stari tekst „move up" (app: „become direct children of"). S133-1 je ovisio o tuđem shareu (`Garmin_data`) ⇒ sada sije vlastitih 1.100 eventa (protuprovjera: brojka odrezana na 1000 ⇒ pada). **Puni run 84 / 3**; S107-3 i S104-3 pojedinačno prolaze ⇒ T-S172-4 |
| T-S172-4 | E2E povremeni padovi u punom runu: S104-3 (kategorije Fitnessa „Loading…" > 10 s, `waitFor` option), S107-3 | ⬜ pojedinačno prolaze (S104 2/2 zaredom); izmjeriti zašto se kategorije ponekad učitavaju > 10 s prije nego se produlji čekanje |
| T-S172-3 | PROD (nakon deploya), **Kokin mali iPhone**: zaglavlje košare u dva retka — `Mastercard · 11.11.` / `35 kupnji` lijevo, iznos / `ostaje` desno, ništa se ne preklapa | ✅ 17.10. — laptop (393 px) i **Kokin iPhone na PROD-u** (deploy `ca496cb`): „Koka vidi sve ok“ |

---

## S171 — Filtar na mobitelu i pločica Košare (2026-10-14)

Na uskom ekranu Overview od filtra nudi samo red razdoblja, a Activities kreće sklopljen sa sažetkom (razdoblje + uvjet); `Clear all` je ušao u otvoren filtar. Nova pločica **Košare (otvorene)**: kartične košare po računu i danu naplate, kupnje na dodir, i „ostaje" (stanje danas − košare redom). Traka „Čeka potvrdu" dobila je „pokaži kupnje".

**Detalji testova:** [tests/S171_tests.md](tests/S171_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S171-1 | TEST mobitel: Overview = samo red razdoblja; izbor razdoblja ga sklopi; **bez odabrane Aree puni filtar** | ✅ 14.10. (Saša, lokalno TEST) — uz dva nalaza (odjava/prijava: izbornik Area; ponovni ulazak: This Year), oba popravljena i potvrđena |
| T-S171-2 | TEST mobitel: Activities sklopljen sa sažetkom (razdoblje, Podtip, uvjet s drilla); Clear all unutra | ✅ 14.10. (Saša) — 1–4 ok (drill = dodir na iznos salda); 5: uvjet s drilla ne preživi F5 — staro ponašanje (filtar pamti Areu/kategoriju/razdoblje, ne uvjet), preporuka: ostaje tako (F5 = svježe otvaranje; trajno ⇒ Shortcut) |
| T-S171-3 | TEST: Košare — ZABA danas 10.057,27, MC 11.11. −2.081,48 ostaje 7.975,79 … RF Visa ~05.11. ostaje 689,67 | ✅ 14.10. (Saša) — sve brojke u cent; RF prvi i Visa rasklopljena (ispravan redoslijed, opis testa ispravljen); usput `· N kupnji` više se ne lomi |
| T-S171-4 | TEST: kupnje košare (26), dodir → View → Back ostaje rasklopljeno; F5 vraća saldo | ✅ 17.10. (Saša, PROD) — 1–4 ✅ 14.10.; ponovljen 2a: Prev/Next samo kroz košaru, po povratku označena kupnja na kojoj je stao |
| T-S171-6 | TEST: košara piše Tip/Podtip, ispod opis (dva retka); ↗ ⇒ Activities za taj dan (sve rate plana zajedno); Edit → Save → Next ostaje u košari | ✅ 14.10. (Saša) — dva retka (Tip/Podtip, opis), ↗ isti dan, Edit u nizu |
| T-S171-5 | PROD ~11.11.: „pokaži kupnje" u traci otvori tu košaru; naplaćena se ne oduzima dvaput | ⬜ |

---

## S170 — Filtar izbornik, Rate? bez broja, lazy Plotly/Excel, Structure RPC (2026-10-13)

„Filter by" nudi izbornik i za `depends_on` atribute (`Izvor`, `Podtip` grupiran po `Tip`u, `Status`). Add ne sprema `Rate?` bez broja rata. Plotly i ExcelJS se skidaju tek kad zatrebaju (početno 2.036 → 269 KB gzipa). Zadano razdoblje više ne gubi utrku s All Time. Structure broji evente jednim RPC-om (`sql/057`, TEST + PROD ✓). **Drugi dio:** Visa u traci (prozor −2/+6, Σ bruto — config tek poslije deploya), T21 (kvačica „potvrđeno“ samo za retke u saldu), T12 (Σ košara po jednom dospijeću; `fill_from_izvod` nalazi kontrolu po naslovu).

**Detalji testova:** [tests/S170_tests.md](tests/S170_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S170-1 | TEST: Filter by `Izvor` ⇒ izbornik `Racun, Visa, Cash, Mastercard`; `Racun` This Year ≈ 355 | ✅ 17.10. (Saša, TEST = kopija PROD-a 17.10.) — izbornik ravan `Racun, Visa, Cash, Mastercard` (13.10.); `Izvor = Racun`, This Year ⇒ **370 events total** = baza (izmjereno isti dan, TEST i PROD 370; stara procjena 355 zastarjela) |
| T-S170-2 | TEST: Filter by `Podtip` grupiran po Tipu; `Kuća › Popravci, održavanje` = 18 (ne 30); `gorivo` = 22 (oba auta); `Status` ravan | ✅ S170 (13.10., Saša) — grupe po Tipu (PROD `dev:prod`); TEST This Year: `Kuća › Popravci, održavanje` **18** (stari tekstualni 30), `gorivo` **22** s `auto C5` i `auto Lacetti` |
| T-S170-3 | TEST: Add, `Rate?` ✓ i `Broj rata` prazno/1 ⇒ poruka, ništa spremljeno; 3 ⇒ rata modal | ✅ S170 (13.10., Saša) — prazno i `1` ⇒ poruka, forma ostaje; `3` ⇒ rata modal (MC: 0,34 · 0,34 · 0,32, zadnja nosi ostatak = T22 na TEST-u). Usput: gumb „Kreiraj 3 rata“ ⇒ „3 rate“ (popravljeno) |
| T-S170-4 | PROD nakon deploya: Network bez `vendor-plotly`/`vendor-excel` na početku; krug, Export/Import, Structure modali rade („Loading…") | ✅ 17.10. (Saša, lokalni build `npm run preview` = isti kod koji Netlify gradi) — početak: samo `vendor-react/ui/supabase` (132 KB); krug ⇒ `vendor-plotly` 1.481 KB; Export ⇒ `vendor-excel` 271 KB, modal radi. `dist/index.html` preloada samo 4 filea |
| T-S170-5 | TEST + PROD: `Financije_all` + F5 ×5 ⇒ uvijek This Year; ručni All Time preživi Activities↔Overview | ✅ S170 (13.10., Saša) — F5 ×5 ⇒ This Year; ručni All Time preživi Activities ↔ Overview, F5 ga vraća na This Year |
| T-S170-6 | PROD: `sql/057` u SQL editoru (Saša) | ✅ S170 (13.10., Saša) — pušteno; prava `authenticated · postgres · service_role`, **bez `anon`** |
| T-S170-7 | PROD nakon 057 + deploya: Structure = 1 `rpc_category_event_counts`, 0 `events?select=id` HEAD; brojke kao prije | ✅ S170 (13.10., Saša) — TEST i **PROD** (`dev:prod`, Saša kao grantee na `Financije_all`): 2 × RPC 200 ~1 kB (dev StrictMode duplira; deployano 1), **0** `events?select=id` (prije 39 po učitavanju) |
| T-S170-8 | PROD **poslije deploya**: `set_due_visa_S170.py` dry ⇒ popis Visa košara; `--apply --yes-prod` ⇒ `Visa ✓ · ostale netaknute ✓` | ✅ 14.10. (Saša) — dry run: Visa 05.11. 20 redaka / 579,05, najranija 05.11. (stare 03.10. nema); `--apply` ⇒ `Visa ✓ · ostale postavke netaknute ✓` |
| T-S170-9 | PROD ~03.–11.11.: Visa košara u traci, Σ „(samo isplate)“, dani od 03.11.; potvrda ⇒ `visa_uvoz_izvoda` kaže „već upisana“ | ⬜ |
| T-S170-10 | TEST: Excel izmjena retka prije sidra — kvačica „potvrđeno“ za `Racun`, NE za `Mastercard`; MC→Racun ⇒ traži | ✅ 17.10. (Saša, TEST) — opis: kvačica samo za `Racun` redak 09.10. („1 redak“), MC redak obična izmjena; MC → `Izvor = Racun` **i** `Status = Izvrsen` ⇒ „2 redaka“. Samo Izvor uz `Planiran` ⇒ i dalje 1 — ispravno (saldo ne broji `Planiran`), opis testa bio nepotpun |
| T-S170-11 | TEST: delta ZABA — Σ košara jednog dospijeća (dan desno, najbliži); drugi dan ⇒ drugi Σ; `Potvrda` prazna na kartičnim retcima | ✅ S170 (13.10., Saša, TEST) — sekcija KOSARA u grupama po datumu naplate (+/−), izbornik dana uz Σ, odabrana košara žuta; „file je ok“. Usput: TEST nije imao `split.due_slug` (044) — poravnato |
| T-S170-12 | `fill_from_izvod` nad delta sheetom sa sidrom u prozoru ⇒ „Σ kosare prosirena“, ne „List nema kontrolu“ | ⬜ |

---

## S168 — T22 rata po kartici, lista čeka kolone, brojač dohvata (2026-10-11)

Rata modal: ostatak zaokruživanja po kartici iz configa (MC zadnja, Visa prva). Lista ne crta retke sa zadanim kolonama dok postavke Aree nisu stigle (Kokina „lista bez iznosa"). `useActivities` brojač umjesto `Date.now()`. **D7:** traka „Čeka potvrdu“ prvo pita i nudi dane — bez tipkanja kad se slaže. Kod na `test-branch`, TEST config upisan; PROD = deploy + `set_rata_ostatak_S168.py`.

**Detalji testova:** [tests/S168_tests.md](tests/S168_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S168-1 | TEST rata modal: MC 55,45/3 ⇒ 18,49 · 18,49 · 18,47 „Zadnja…"; Visa 37,48/3 ⇒ 12,50 · 12,49 · 12,49 „Prva…" | ✅ S168 (12.10., TEST, Saša) — MC 18.49 · 18.49 · 18.47 „Zadnja…“, Visa 12.50 · 12.49 · 12.49 „Prva…“ |
| T-S168-2 | TEST Structure export: `Automations` kolona `Remainder` = `Mastercard=last \| Visa=first`; ponovni uvoz 0 promjena | ✅ 17.10. (Saša, TEST = kopija PROD-a s postavkama) — `Automations` redak `rata`: `Remainder` = `Visa=first \| Mastercard=last`; isti file ⇒ Import: sve 0, „Nothing to import“ |
| T-S168-3 | PROD nakon deploya: `set_rata_ostatak_S168.py --apply --yes-prod` ✓; prvi MC plan „Zadnja…", traka se slaže u cent | ⬜ **config ✅ 12.10.** (`remainder_map ✓ · ostale postavke netaknute ✓`, deploy `119653c`); ostaje korak 3: prvi Kokin MC plan „Zadnja…“ i traka 11. u cent |
| T-S168-4 | PROD (praćenje): Kokin iPhone — lista nikad bez iznosa (kostur pa retci s iznosima) | ⬜ |
| T-S168-5 | D7: traka pita „Je li banka skinula Σ?“ + dani (nijedan označen, bez sutra) ⇒ sažetak ⇒ „Da, upiši“; „drukčije“ = prazna polja; grantee bez pitanja | ✅ S168 (12.10., TEST, Saša) — nudi 11. i 12. i iznos; „drukčije“ ispravlja; „sve kako treba“. PROD: Koka 11.11. |

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

## S158 — audit procesa Financija, MC izvod 2026-09, T11 rate, T5–T10 alati (2026-10-02)

Samo Python alati i dokumenti, bez promjene u appu. Košara 11.10. na PROD-u = izvod u cent (55 / 1.189,34); uvezeno 37 budućih MC rata + 7 naknada (11.11. = 499,18, 11.12. = 434,05).

**Detalji testova:** [tests/S158_tests.md](tests/S158_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S158-1 | PROD, Koka, 11.10.: traka 55 stavki / 1.189,34 ⇒ ✓ slaže se ⇒ Potvrdi (isti trenutak kao T-S156-6) | ✅ S168 (12.10.) — Koka potvrdila na PROD-u (stari način, prije deploya D7) |
| T-S158-2 | `MC_2026-10`: rate i naknade NISU u `ZA UVOZ` (već u bazi); 11.11. razlika = samo neupisane kupovine | ⬜ |
| T-S158-3 | `rate_alat --only b` nakon uvoza nudi 0 rata (ne generira dvaput) | ✅ S158 — izmjereno: 0 planova / 0 rata |
| T-S158-4 | Visa rujan: razvrstač daje `PBZVISA_`, `visa_uvoz_izvoda` samo imenom, zaglavlje `[PROD]`, Σ u cent | ✅ S172 — izvela novija sesija: S161 (05.10.) razvrstač ⇒ `PBZVISA_2026-09.pdf`, `visa_uvoz_izvoda` na PROD-u, Σ = izvod u cent, Koka uvezla 9/33/1 |
| T-S158-5 | ZABA: `fill_from_izvod --zaba` imenom, presedani iz `ET_TARGET`; `promet_check` vidi PDF i u korijenu `izvodi\` | ⬜ **korak 2 ✅** (S161 `promet_check` 2026-09 nad `ZABA_2026-09.pdf` koji i danas stoji u korijenu `izvodi\`, provjereno 17.10.); ostaje korak 1 — `fill_from_izvod --zaba` treba tek kad `promet_check` NIJE ✓ |
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
| T-S156-6 | PROD, Koka, 11.10.: prava MC košara, saldo ZABA isti dan = banka | ✅ S168 (12.10.) — nakon Kokine MC potvrde pločica ZABA **11.290,73 = banka** (uz povrate KEKS Pay +30,00 / +3,73); Koka odmah potvrdila sidro na mobitelu |
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

---

## O ovom fileu

> ⚠ Redak `**Otvoreno: NE VODI SE OVDJE**` mora ostati na VRHU filea, izvan svake sekcije
> (S146) — `audit_tests.py` ga traži; da ode sa sekcijom u arhivu, audit javi fantomske
> proturječnosti. Ova objašnjenja su preseljena na dno u S162 (Saša: uvod je bio predug za
> skrolanje do testova); stari lanac „Zadnji update … Ranije: …" je povijest i živi u `DONE_HISTORY.md`.

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



> Kurirani popis je ukinut u **S116** jer se odrzavao rukom i razilazio s tablicama
> (propustao je 60 testova). Stanje mjeri `python data-prep_tools/Tools/audit_tests.py`.
>
> /!\ **Ovaj redak mora ostati u ZAGLAVLJU** (S146). Do tada je stajao unutar sekcije
> `S120` i **otisao s njom u arhivu** — nakon cega je audit istog trena prijavio
> **8 fantomskih proturjecnosti**, jer bez markera usporedjuje tablice s *praznim*
> kuriranim popisom. To je razred koji je S139 vec jednom zatvorio, ozivljen
> **selidbom, ne izmjenom** (isti razred kao samoreferenca u `DONE_HISTORY.md`).
