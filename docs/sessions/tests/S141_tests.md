# S141 — detalji testova (2026-09-18)

> Sesija bez ijedne izmjene u `src/`. Tri zapisane tvrdnje oborene su mjerenjem, i **sve tri
> su bile moje** — jedna od njih stajala je u CLAUDE.md-u sedamnaest sesija.
>
> Skripte kojima je mjereno su u `Claude-temp_R/_probes/` (izvan gita): `visa_datum_naplate.py`,
> `visa_po_ciklusu.py`, `delta_prozor.py`, `sidra_razmaci.py`, `trace_sweep.py`.
> Sve su **read-only** — nijedna ne piše u bazu.

---

## T-S140-7 — ✅ `dbScopedKey`: filtar više ne curi između TEST-a i PROD-a

Potvrdio Saša, u tri koraka (detalji i tablica su u [S140_tests.md](S140_tests.md)).

Ukratko: TEST **nije** naslijedio PROD-ov `Health_Sasa > Medical` nego je pokazao **svoj**
`Financije_all`; povratak na `dev:prod` vratio PROD-ov odabir netaknut.

⚠ **Ishod je jači nego što je test tražio.** Očekivanje je dopuštalo i **prazan** filtar na
TEST-u; dobiven je **zadnji TEST-ov**. Prazan filtar ne bi razlikovao *„ključ je odvojen"* od
*„ključ je obrisan"* — a ovo razlikuje, dakle **oba zapisa postoje istovremeno**.

---

## T-S141-1 — ⬜ Structure fan-out: 39 zahtjeva po pozivu, 6–8 poziva po toku

**Status:** ⬜ otvoreno — **izmjereno, čeka popravak.** Uzrok E2E padova **NIJE** utvrđen i ne smije se proglasiti. Potvrda ovog retka je **ponovno mjerenje** koje mora dati **jedan** fan-out po toku.

### Kako je nađeno

Puni E2E (`npx playwright test`, 22,0 min) dao je **54 prošlo / 17 palo** protiv baseline-a
S139 **60/11**. E10-2 je pao, pa je primijenjeno pravilo iz S140: *prije nego se pad pripiše
specu ili appu, prebroji nedovršene zahtjeve u traceu.*

### Koraci za ponavljanje

1. `npx playwright test` (⚠ na 5173 ne smije stajati `dev:prod` — guard staje).
2. `python Claude-temp_R/_probes/trace_sweep.py` — prolazi kroz `test-results/*/trace.zip`
   i broji zahtjeve bez odgovora **stariji od 2 s** prije kraja tracea (mlađi su artefakt
   zatvaranja stranice, ne šutnja mreže).

### Izmjereno

| | |
| --- | --- |
| fan-out zahtjeva kroz 17 palih testova | **2.601** |
| najviše u jednom testu | **330** (`e15`), **276** (`e11`) ⇒ 6–8 punih fan-outa |
| u E10-2 traceu | **39 + 39** u sekundi razmaka, odgovoreno **11 od 78** |
| padova s barem jednim zahtjevom bez odgovora | **10 od 17** |

### Uzrok dvostrukog fan-outa — u kodu, ne u testu

`useStructureData()` zove se na **tri** mjesta, a svaki poziv je **zasebna instanca s
vlastitim efektom**: `AppHome.tsx:122`, `StructureTableView.tsx:113`,
`StructureSunburstView.tsx:186`.

⚠ **`AppHome` destrukturira samo `refetch`** (komentar: *„needed for Export button"*), a riječ
`nodes` u tom fileu se pojavljuje **0×** — dakle 39 upita čiji rezultat **nitko ne pročita**,
na **svakom** mountu `AppHome`-a, uključujući svaki povratak iz View Detailsa (S129).

### Što se NE tvrdi

- **Da je to uzrok padova.** U E10-2 je fan-out opalio **poslije** isteka tvrdnje, a **7 od
  17** padova nema **nijedan** zahtjev bez odgovora ⇒ šutnja mreže ne objašnjava sve.
- **Da je S140 izazvao regresiju.** Za to bi trebao pun run nad starijim commitom (~22 min),
  a suite je po zapisu nedeterminističan između runova.

Ono što **jest** utvrđeno: E10-2 ne pada na dijalogu opoziva nego **prije njega** —
`structure-row-a1000000-…` se nikad ne pojavi, breadcrumb ostaje `All Areas > All Categories`.
Deset od sedamnaest padova su Structure tab (E5-1/3/5, E6-1, E7-1, E10-2, E11-4, E12-2/4,
E13-2) ⇒ **jedan obrazac, ne sedamnaest kvarova**.

---

## T-S141-2 — ✅ `Datum naplate` za karticu znači **dan terećenja** (Sašina odluka b)

**Pitanje koje je stajalo otvoreno od S137:** znači li stupac *(a)* kojem izvodu trošak
pripada (dan zatvaranja, `next:3`) ili *(b)* kad je novac stvarno otišao.

### Izmjereno (PROD, read-only, 1.639 Visa redaka)

Po danu u mjesecu raspodjela izgleda razbacano — `5.→724, 4.→400, 6.→176, 7.→137, …`.
**Grupirano po ciklusu, razbacanosti nema:**

```
2024-05    66   6x66        2025-01    56   7x56        2026-07    60   6x60
2024-07    61   4x61        2025-08    50   11x50       2026-08    45   7x45
2024-08    63   12x63       2026-06    65   5x65        2026-10    18   3x13, 5x5
```

**35 od 37 ciklusa ima točno jedan dan.** To je potpis **izmjerene** veličine: pravilo bi
svaki mjesec dalo isti dan, a banka ga pomiče.

### Što je time oboreno

CLAUDE.md je sedamnaest sesija tvrdio da *„kontrola po košari ne vidi 855 Visa redaka — ne
padaju ni u jednu košaru"*. **Padaju.** 1.616 od 1.639 uredno sjeda u svoj ciklus; ne sjeda
**23** retka koje je napravila aplikacija kao `next:3`. Razbacanost je bila **artefakt
gledanja po danu umjesto po ciklusu** — krivo ravnalo, ne krivi podaci.

⚠ **Posljedica je živa danas:** otvorena košara `2026-10` razlomljena je na **3.×13 + 5.×5** —
dva dana su **dvije generacije configa** (`next:3` prije S138, `cutoff:3:5` poslije).
Potvrđeno čitanjem živog configa: `Visa: "cutoff:3:5"`, `rata.date_map.Visa: 5`.

### Odluka i dva pravila koja iz nje slijede

*„Dok se ne zna, pretpostavljamo; kad stigne izvod, editiramo na točno."* (Saša)

1. **Ispravak je operacija nad košarom, ne nad retkom** — s ugrađenom kontrolom:
   Σ košare po ispravljenom danu mora dati iznos terećenja s RF-a.
2. **Redak koji već nosi `Izvod opis` svejedno dobiva ispravljen datum** — PBZVISA i RF
   potvrđuju **različita polja**, pa se ne prepisuju.

⚠ Odbijena (a) bi tražila prepisivanje **1.616** redaka i nepovratno izbrisala jedini zapis
stvarnog dana terećenja po ciklusu — dakle zamjenu **izmjerenog** izvedenim.

---

## T-S141-3 — ✅ `DELTA_WINDOW_SPEC` napisan, prozor se mjeri sidrima

Spec: [`docs/DELTA_WINDOW_SPEC.md`](../../DELTA_WINDOW_SPEC.md). Povod je Sašin prijedlog
(delta sheet da pokazuje i retke ispred zadnjeg sidra, jer kartično plaćanje ostavlja glavni
blok prazan).

### Premisa — izmjerena, i oštrija od opisa

| račun | zadnje sidro | iza njega | **miče saldo** |
| --- | --- | ---: | ---: |
| Kokin tekući ZABA | 06.09. | 50 | **18** |
| Sašin tekući RF | 07.09. | 20 | **2** (18 od 20 su Visa ⇒ odlaze u sekciju) |

Na ZABA-i problem nije „prazno" nego **tiho skraćeno**: panel traži 60 dana, sidro reže na
**12**, i **47 `Racun` redaka nestane bez poruke**.

### ⚠ Moj poopćeni prijedlog („prozor od N dana") pao je na Sašinom pitanju

Pitao je *„ako odemo 60 dana natrag, imamo li problema sa stanjem tog dana?"* — i imamo:

| početak prozora | najbliže sidro **prije** njega | otvarajuće stanje |
| --- | --- | --- |
| „danas − 60" = 20.07.2026. | ZABA **01.01.2025.** | sidro **+ 565 dana izračuna** |
| isto | RF **31.12.2022.** | sidro **+ 1.297 dana izračuna** |
| **„jedno sidro ranije"** | ZABA 30.07.2026. | **13.815,33 točno** (`ZABA_2026-07.pdf`) |
| isto | RF 11.08.2026. | **799,12 točno** (`RF_2026-07.pdf`) |

⇒ **Dani su kriva mjerna jedinica.** Prozor uvijek kreće **dan poslije nekog sidra**, pa je
otvarajuće stanje **potvrđen broj bez ijednog dijela izračuna** — a to je jedino svojstvo
zbog kojeg kontrolni stupac išta vrijedi.

⚠ Usput izmjereno: rupe među sidrima su velike (**ZABA 575 dana**, **RF 1.319**), pa `K = 2`
nije „malo širi prozor" nego ~625 dana ⇒ panel mora ispisati stvarni raspon prije izvoza.

### Sašine odluke unutar spec-a

| pitanje | odluka |
| --- | --- |
| koliko unatrag | **jedno sidro** (zadano `K = 1`) |
| smije li se mijenjati potvrđen redak | **smije, ali glasno** — tri sloja, bez zabrane uvoza |
| tekst u koloni | **kratki oblik**, puna bilješka jednom u zaglavlju |
| prag upozorenja | **200 redaka**, bez zabrane |
| sivi ton | **dovoljan zasad** |
| prazni retci za unos | **blag format** (§4.5) — ton se bira uz fazu 2 |

---

## T-S141-4 — ✅ Faza 1 delta prozora (čeka kod)

**Preduvjet:** implementirana faza 1 iz spec-a (`K` umjesto `N` dana).

**Koraci**

1. Delta izvoz za **Kokin tekući ZABA** uz `K = 1`.
2. Pogledaj otvarajuće stanje u zaglavlju.
3. Pogledaj kontrolnu točku na sidru 06.09.

**Očekivano**

- Otvarajuće stanje = **`13.815,33`** — jednako sidru **u cent**, jer prozor kreće točno dan
  poslije njega.
- Prozor **50 dana** (od 31.07.), ~151 redak.
- Kontrolna točka na 06.09. daje razliku **`0,00`**.

**Pad:** otvarajuće stanje različito od `13.815,33` ⇒ prozor ne kreće dan poslije sidra, nego
negdje drugdje — i tada je cijeli stupac nagađanje.

⚠ **Test ide na ZABA-i, ne na RF-u.** RF ima 3 sidra, ZABA **16** — samo ZABA nosi slučaj
„više sidara unutar jednog prozora", koji je jedini zanimljiv. (Pravilo iz S129: *kad se
testira automatika, slučaj se bira tako da se razlikuje od njezinog rezultata.*)
