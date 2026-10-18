# Financije — stanje migracije (kvarljivo)

> Izdvojeno iz `CLAUDE.md` u S137 (2026-09-15). Ondje je ostalo samo ono što je
> **pravilo**; ovdje je **stanje i plan**, koje zastarijeva samo od sebe.
>
> ⚠ **Prije nego povjeruješ brojci, provjeri datum uz nju.** Većina ovog teksta
> pisana je u S116–S124; „trenutno stanje" u naslovu znači *tada*, ne *danas*.

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

1. **~~Faza 3 — automatika na Import putu~~ — ⛔ ODGOĐENA, IZMJERENO (S136).**
   Puni nalaz i plan: **`docs/FAZA3_IMPORT_AUTOMATIKA.md`**. Stajalo je da „jedna rupa
   drži tri featurea"; mjerenje na PROD-u to ruši:
   - **`Datum naplate`: 0 praznih redaka od 5.192** — Python alati ga već pune, pa
     automatika na uvozu **danas ne bi napravila ništa**.
   - **`Tip = N/A`: 1.582 (30,5 %), ali 93 % je povijest** (2023 → 585, 2024 → 476,
     2025 → 413, **2026 → 108**). Povijest se razvrstava **jednokratno** postojećim
     alatima, ne motorom koji radi pri svakom uvozu.
   ⚠ **Okidač za ponovno otvaranje:** kad Koka preuzme roundtrip pa njeni novi retci
   počnu dolaziti bez tih polja (prva brojka prestane biti 0), ili kad `N/A` u
   **tekućoj** godini prijeđe ~100 mjesečno. Do tada bi to bio kod koji čeka podatke.
   ⚠ Ako se ikad gradi: **`Visa = next:3` se NE smije primijeniti naslijepo** —
   izmjereno na 855 redaka da Visa nema fiksan dan naplate (5. → 383×, 4. → 231×,
   3. → **11×**), pa bi uvoz proizveo uvjerljivo krive datume, i to tiho.
   ⚠ Vrjednija meta istog razreda: **1.431 redak (27,6 %) bez `Izvod opis`**.
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

