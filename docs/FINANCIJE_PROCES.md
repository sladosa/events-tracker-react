# Financije — kako Koka i Saša vode `Financije_all`

**Prepisano:** 2026-10-02 (S158) · **Za:** Koku i Sašu (§1–§4, §7) · Sašu i Claudea (§5–§6, §8)
**§4 je JEDINI popis otvorenog posla Financija** (od S158 i bivše stavke backloga; puni tekst §8).
**Prije:** `FINANCIJE_KOKA_PROCES.md` (S151–S157), a još prije `KOKA_PRVI_MJESEC.md` (S125) — oba u gitu.
**Susjedni:** `DOSPJELO_SPEC.md` (traka „Čeka potvrdu") · `OVERVIEW_TAB_SPEC.md` (saldo, sidra) ·
`FINANCIJE_STATUS.md` (stanje migracije) · `data-prep_tools/CLAUDE.md` (pravila alata) · `CLAUDE.md`

> **Stanje NIJE konačno.** Cilj je proces s **najmanje trenja za oboje**. §4 je popis mjesta gdje
> danas škripi — taj popis vodi sljedeće izmjene, i stavka iz njega nestaje tek kad je izvedena.

---

## 0. Mjerilo

Sašin zahtjev iz S125: *„bilo bi mi važno da ne izgubi povjerenje i volju."*

> **Tihi gubitak rada košta više od deset vidljivih smetnji.** Klikne, ništa se ne dogodi, nigdje
> ne piše zašto ⇒ aplikaciji se ne može vjerovati. Klikne i dobije poruku (i neugodnu) ⇒
> povjerenje ostaje.

---

## 1. Model u jednoj stranici

### 1.1 Što upisujemo

Dva računa, s **svakog** se naplaćuje po jedna kartica:

| račun | čiji | kartica koja se s njega naplaćuje |
| --- | --- | --- |
| Kokin tekući ZABA | Koka | **Mastercard** — skupna naplata 11. u mjesecu |
| Sašin tekući RF | Saša | **PBZ Visa** — skupna naplata ~5.–7., dan nije fiksan |

Svaka transakcija ima **dva datuma**: dan kad se **potrošilo** (datum retka) i dan kad je
**račun teretio** (`Datum naplate` — app ga računa sam iz `Izvor`a). Za plaćanje s računa su
isti; za karticu nisu. Iz toga izlazi sve ostalo:

| vrsta | `Izvor` | račun tereti | miče saldo? |
| --- | --- | --- | --- |
| plaćanje s računa, uplata, prijenos | `Racun` | isti dan | **da** |
| podizanje gotovine | `Racun` (`Transfer / cash - bankomat`) | isti dan | **da** |
| gotovinski trošak — upisuje se **kad nas zanima** (npr. `Projekti / Saša ručak`) | `Cash` | — novac je otišao već s podizanjem | ne |
| kartična kupovina | `Mastercard` / `Visa` | kasnije, **skupnom naplatom** | ne |
| kupovina na rate | `Mastercard` / `Visa` | N budućih skupnih naplata, svaka u svojoj košari | ne |
| skupna naplata kartice | `Racun` | dan naplate | **da** |

Dok kartica nije naplaćena, njene kupovine stoje kao `Planiran` (*„račun još nije teretio"*);
u `Izvrsen` prelaze kad skupna naplata stvarno skine novac. Prijelaz radi **čovjek koji gleda
banku**, nikad automat po datumu — dospjeli datum nije dokaz da je banka naplatila.

### 1.2 Dva cilja — isti podaci, dva reza

| | **Koka: saldo** | **Saša: analiza** |
| --- | --- | --- |
| pitanje | koliko imam na računu | na što se trošilo |
| kartična kupovina | ne broji (broji se skupna naplata) | **broji** |
| skupna naplata kartice | **broji** | ne broji (inače dvaput) |
| prijenos, podizanje gotovine | **broji** | ne broji |
| gotovinski trošak | ne broji | **broji** |
| mora biti točno | **danas**, na mobitelu | **jednom**, nad poviješću |
| ključno polje | `Izvor`, iznos | `Tip` / `Podtip` |

**Svaki euro točno jednom u svakom pogledu.** Isti redak zato ima dva pravila — namjerno.

- **`Tip`/`Podtip` upisuje onaj tko upisuje, odmah.** Banka ne zna da je „Konzum" bio ručak za
  projekt; izvod tu ne pomaže.
- **Gotovina se svjesno ne bilježi sva.** Analiza zato nosi redak *„gotovina, nerazvrstano"* =
  podignuto − zapisano. Taj redak se **računa**, nikad sprema; Koka ne radi ništa novo.
- **Saldo kaže „koliko imam", ne „koliko će ostati"**: nadolazeća kartična naplata se u saldu ne
  vidi dok ne prođe.

### 1.3 Što donosi izvod

- **Izvod je autoritet za iznos i datum; naš redak za opis i `Tip`/`Podtip`.** Usklađenje naš redak
  **potvrđuje i ispravlja**, ne zamjenjuje ga bankinim.
- **Bankovni izvod (ZABA, RF) potvrđuje saldo** → završava **sidrom**: stanje s izvoda, na datum
  **zadnje transakcije izvoda** (ne kraj mjeseca, ne danas).
- **Kartični izvod (MC, Visa) potvrđuje košaru** — zbroj kupovina = skupna naplata — i donosi
  **zaboravljene kupovine**. Saldo ne miču, ali analizi trebaju.

**„Sve zapisano i korektno"** znači tri provjere:
1. svaki bankin redak ima svoj par u appu (1:1, ili jedan naš = više bankinih),
2. iznosi se slažu **u cent**,
3. bankovni: saldo appa na datum izvoda = **ispisano stanje**; kartični: Σ košare = **naplata**.

---

## 2. Tri aktivnosti

### 2.1 Dnevni unos — oboje, svaki dan

**Gdje:** mobitel, Add.

- **`Izvor` točno** — on odlučuje ulazi li redak u saldo.
- **`Tip`/`Podtip` odmah.**
- Kupovina na rate: nakon **Finish** app ponudi rate.
- Nesiguran iznos: **`~` na početak opisa** (`~ gorivo, Ina`). Nađe se filtrom po komentaru.
- **Ispravak uvijek Editom postojećeg retka**, nikad novim retkom — novi bi ostao kao duplikat.
- **Skupnu naplatu Mastercarda ne upisuj rukom** — upisuje je traka (2.2). Visa naplatu dok Visa
  nije u traci upisuje Saša (v. §5 Visa).

**Gotovo kad:** saldo na pločici = bankovna aplikacija. Razliku prijavi — znači da nešto fali,
nešto je dvaput ili je iznos kriv, nikad grešku u izračunu.

### 2.2 Potvrda skupne naplate kartice — jednom mjesečno

**Mastercard (11., Koka, u aplikaciji):**
1. U bankovnoj aplikaciji pogleda **koliko** je skinuto i **kojeg dana**.
2. Overview → traka **„Čeka potvrdu"** → upiše iznos i dan.
3. **✓ slaže se** → **Potvrdi** → upiše se naplata, sve kupovine prelaze u `Izvrsen`. Gotovo.
4. Traka pita **„Je li to ova naplata?"** → naplata je već upisana rukom. Ako jest: **Da, to je
   ona** → **U redu, ispravi** → **Potvrdi**. Ako nije: **Ne, to je nešto drugo**.
5. **Ne slaže se** → **„Upiši naplatu kako ju je banka skinula"** → saldo je odmah točan, košara
   ostaje *„naplaćeno — neusklađeno"* i čeka MC izvod (2.3). Nije hitno.

**Visa (~5.–7.):** još **nije** u traci → ide preko Visa izvoda (2.3). Cilj: u traci od ~05.11.

**Gotovo kad:** košara potvrđena, kupovine `Izvrsen`.

### 2.3 Usklađenje s izvodom — kad izvod stigne

1. **Koka** spremi PDF u svoju OneDrive mapu `Izvodi`.
2. **Saša** pokrene obradu (§5) → dobije Excel za uvoz i **očekivane brojke** (*N novih, M ispravaka*).
3. **Uvoz** (Activities → Import): brojke u pregledu moraju biti te. Za tuđe retke odabrati
   **„fix as owner"**.
4. Provjera:
   - **bankovni** — kontrolni stupac završi na **ispisanom stanju** → na pločici se upiše sidro
     (broj i datum s papira, nikad iz klika);
   - **kartični** — Σ košare = naplata; traka tada sama ponudi **Potvrdi**.
5. **Ne slaže se → stati.** Traži se redak koji je kriv; sidro se ne upisuje dok se ne složi.

| izvod | potvrđuje | treba li uvijek? |
| --- | --- | --- |
| ZABA | Kokin saldo | da |
| RF | Sašin saldo (u njemu je i Visa naplata) | da |
| PBZ Visa | Visa košaru + zaboravljene kupovine | da, dok Visa nije u traci |
| Mastercard | MC košaru + zaboravljene kupovine + **rate starih planova** | **da, dok se ne riješi T11** — stiže ~2. u mjesecu, **prije** naplate 11. |

⚠ **MC izvod stiže PRIJE naplate** (izmjereno 02.10.2026., naplata 11.10.). To je najbolji
trenutak: košara se uskladi s izvodom unaprijed, pa Koka 11. u traci samo upiše iznos i klikne
**Potvrdi**. `Status` do naplate ostaje `Planiran` (pravilo S147). Bez toga traka 11. **ne može**
dati „slaže se": rate kupovina od prije (Konzum, Allianz…) u bazi postoje samo do zadnjeg izvoda
(T11) — u rujnu 2026. falilo ih je 11 + 4 naknade, ukupno 365,91 €.

**Gotovo kad:** tri provjere iz 1.3.

---

## 3. Mjesec na jednom mjestu

| kada | što | tko | gdje |
| --- | --- | --- | --- |
| svaki dan | unos | oboje | mobitel |
| ~2. | MC izvod (stiže prije naplate) | Saša → Koka uvozi | alat → Excel |
| 5.–7. | Visa naplata s RF-a + Visa izvod | Saša (Koka uvozi) | alat → Excel |
| 11. | Mastercard naplata | Koka | traka — ako je MC izvod uvezen, samo **Potvrdi** |
| kad stigne | ZABA izvod | Saša → Koka uvozi | alat → Excel |
| kad stigne | RF izvod | Saša | alat → Excel |

---

## 4. Gdje danas škripi — radni popis (stanje nije konačno)

Stavka se miče kad je izvedena, ne kad je opisana.

**Kokino trenje**

| # | što škripi | smjer |
| --- | --- | --- |
| T1 | **Uvoz Excela** za svaki izvod — na mobitelu najskuplji korak koji radi | ploha „Raščišćavanje izvoda" (§6): samo iznimke, u aplikaciji |
| T2 | **Visa nije u traci** — Visa naplata ide preko Saše i izvoda | Visa u traku (Backlog C5, ~05.11.) |
| T3 | Neusklađena MC košara **ne kaže gdje tražiti** | „Gdje bi mogla biti razlika?" (Backlog C5 — čeka prvu stvarnu razliku) |

**Sašino trenje**

| # | što škripi | smjer |
| --- | --- | --- |
| T4 | ZABA/RF izvod traži **Delta Export iz appa** kao ulaz alatu ⇒ tri predaje. Visa alat to ne treba — sam čita bazu i PDF | **jedna naredba za svaki izvod** (Backlog C1 „jedna naredba obrade") |
| T5–T10 | ✅ **Izvedeno S158** (ispisi kontrolnih alata prije/poslije identični): svi alati biraju bazu kroz `ET_TARGET` (bez njega TEST, krivo ime pada) · PDF samo imenom · alati čitaju cijeli `izvodi/` osim `duplikati/` · Visa uvijek `PBZVISA_` · Kokina Excelica samo na `--koka` · mapa pospremljena (korijen: `izvodi/`, `izlazi/`, `_arhiva/`). Usput nađeno: TEST je alatima išao **anon ključem** (RLS, bez `Financije_all`) i kategorija je bila tvrdi PROD ID — oboje popravljeno u `_db.py` | — |

**Nalazi prvog stvarnog prolaza — MC izvod 2026-09 (S158, 02.10.2026.)**

Košara 11.10. u bazi 40 redaka / 859,58, izvod 55 / 1.189,34. Zatvoreno u cent, ali uvozni file
je na kraju **složen skriptom ručno** — što pokazuje koliko alat još ne radi sam. Sašin cilj:
**alat radi što više sam** (sparivanje, `Tip`/`Podtip`, komentar), čovjek odlučuje samo ono što
samo on zna.

| # | što se dogodilo | smjer |
| --- | --- | --- |
| T11 | **Rate starih planova nisu unaprijed upisane** — u bazi postoje samo do zadnjeg izvoda. Falilo 10 rata + Miele + 4 naknade = 365,91 €. Dok je tako, traka 11. se **nikad** ne složi bez MC izvoda | ✅ **MC izvedeno S158**: `rate_alat.py --only b` (popravljen: planovi po mjesecu početka, minute lokalno, ne generira dvaput) → 37 rata / 12 planova uvezeno 02.10.2026.; košara 11.11. = 493,90, 11.12. = 430,09. Zadnja rata nosi `~` (iznos procjena). **Ostaje:** Visa 7 planova / 19 rata (uz „Visa u traku"); 2 zastarjela plana iz 2025. (Bauhaus 8/12, Inter Cars 2/6) — rupa u analizi, ne u saldu. ⚠ Naknade `1,32` po rati (MC obročna otplata) alat **ne** generira — dolaze s izvodom |
| T23 | **MC naknada `1,32` dolazi uz SVAKU ratu plana s novim načinom otplate** — prepoznaje ih redak u zagradi na izvodu (T15). Izmjereno 07–09/2026.: Lufthansa ×2, Miele, Booking ×2, Plitvice, svaka rata ⇒ jedna naknada. Trgovinski planovi (Konzum…) je nemaju | S158 jednokratno: 7 naknada za 11.11./11.12. (`naknade_rata_2026-10.xlsx`). Trajno: alat uz ratu takvog plana generira i naknadu; rata modal u appu isto (MC, kupnja na rate karticom) |
| T24 | **`fill_from_izvod --mc` od S126 nikad nije prepoznao ratu**: u regexu je stajao pravi znak backspace (`\x08`) umjesto `\b`, pa nove rate s izvoda nisu dobivale `Rate?`/`Broj rata`/`Rata br`. Izmjereno: 38 MC rata bez oznake (12 iz uvoza 02.10.) | ✅ regex popravljen S158. **Ostaje:** `rate_alat.py --only a` (higijena, 91 redak, i Visa) → uvoz — sljedeća sesija |
| T25 | Kokina OneDrive mapa `Izvodi` raste i nosi **generička imena**: MC stiže kao `Obavijest o učinjenim troškovima.pdf` — **svaki mjesec isto ime**, pa sljedeći izvod dobije `(1)` ili prepiše prethodni, a čovjek ne vidi što je što | ✅ **Odluka Saša S158: preimenovati u inboxu** u isto ime kao kod nas (`MC_2026-09.pdf` — izveden ručno 02.10.; razvrstač ga i dalje prepoznaje po sadržaju, „već imamo"). ✅ **Razvrstač to radi sam uz `--apply`** (S158; samo preimenovanje, nikad brisanje ni prepisivanje zauzetog imena — testirano u pješčaniku). Podmapa `Obrađeno`: još otvoreno |
| T22 | **Rata modal dijeli ostatak kao Visa i za MC.** Banka: Visa ostatak na **prvoj** rati (28/28), MC na **zadnjoj**, rata zaokružena naviše (16/16). MC plan s nedjeljivim iznosom iz appa zato odstupa od banke za cent ⇒ traka „neusklađeno" | `splitRataAmounts` po `Izvor`u — u configu (`automations.rata`), ne u kodu; CLAUDE.md S145 ispravljen |
| T12 | **Delta „Σ košara" zbraja SVE buduće naplate** (11.10. + 11.11. + 11.12. = 1.185,38) i uspoređuje ih s **jednom** naplatom ⇒ razlika 3,96 izgledala je kao sitnica, a stvarna je bila 329,76. Uz to `fill_from_izvod` javlja „list nema kontrolu košare" iako je ima | Σ po **jednom** dospijeću (najbližem), ili po dospijeću zasebno — **kod, deltaSheet** |
| T13 | **Redak s malo drugačijim iznosom alat dopisuje kao NOV** ⇒ duplikat. Ovdje 4: tečaj (Audible 8,99 USD → 8,11 €, toner 3,45 → 3,49), cent ostatka rate (Konzum 15,36 → 15,37), i redak bez opisa (28,79 → FENGHUA 33,10, isti dan) | isti račun, isti dan ±2, jedini neupareni s obje strane ⇒ **ispravak postojećeg** (iznos s izvoda, opis i `Tip` naši) |
| T14 | **Nitko ne traži duplikate u košari**: plan Plitvice upisan dvaput (Koka 07.09., Saša 12.09.), „Hlace i carape" dvaput (drugi dan, unatrag) | alat uz sparivanje prijavi **višak**: dva retka a jedan na izvodu; za plan rata ključ je izvorna kupovina (T15) |
| T15 | **Parser baca redak u zagradi** ispod rate: `(B080262578769884 12.09.26 135 EUR)` = **datum i ukupni iznos izvorne kupovine**. Iz njega se Plitvice riješio (kupljeno 12.09.) | čitati ga: jedan plan = jedna referenca; rata dobije **dan kupnje** (D1b — danas nove rate dobiju datum knjiženja 28.09.) |
| T16 | **Rata ne nasljeđuje klasifikaciju od ranije rate istog plana** — `Tip` je ostao N/A za Spar 2/4, Konzum P-1270 2/6, Miele 2/3, iako su 1. rate klasificirane. Presedani gledaju samo opću povijest naziva, i to samo **prije** početka delta prozora | rata ⇒ `Tip`/`Podtip`/komentar iz prethodne rate istog plana; komentar u obliku `<Trgovac> n/N` |
| T17 | **Kad povijest šuti, alat odustane** (GLOVO: 2× N/A + 1 kriv; `VPA PARKING`: nov naziv) | kratka lista pravila po riječi, vidljiva u kodu (kao `RF_RULES`): `PARKING`/`GARAZ` ⇒ Prijevoz / Taksi, Zet, Parking (Sašino pravilo); `GLOVO` ⇒ Domaćinstvo / Kave/jelo vani |
| T18 | **Komentar se ne upisuje kad povijest nije jednoglasna** (`Allianz` / `Alianz`, `Keindl` / `KEINDL SPORT…`) | rata ⇒ `<Trgovac> n/N`; inače najčešći oblik |
| T19 | `uskladi_izvod` predlaže `Status → Izvrsen` **prije naplate** — proturječi S147 | do naplate samo `Izvod opis` (žig) i ispravci; `Izvrsen` radi traka |
| T20 | 2 retka u košari **bez `Status`a** — ušli Excel uvozom, koji ne postavlja zadani `Status` (S137) | alat koji piše uvozni file uvijek postavlja `Status`; trajno: Faza 3 (`docs/FAZA3_IMPORT_AUTOMATIKA.md`) |
| T21 | Uvoz traži kvačicu „potvrđeno razdoblje" i za **kartične** retke prije sidra — lažna uzbuna (Backlog, S155) | guard samo za retke koji ulaze u saldo, kao C3c u Editu |

**Preneseno iz backloga (S158)** — puni tekst u §8

| # | što | smjer / stanje |
| --- | --- | --- |
| T26 | **C1 izvodi: od inboxa do žiga** (§8.1) | razvrstač ✅ (S152, S158 i preimenovanje u inboxu); ostaje „jedna naredba obrade" = **T4** / `obradi_izvod.py` |
| T27 | **C5 traka „Čeka potvrdu"** (§8.2) | faze 1–2 ✅ na PROD-u; ostaju **Visa u traku** (T2, ~05.11.) i „Gdje bi mogla biti razlika?" (T3, čeka prvu razliku) |
| T28 | **Visa buduće rate** — 7 planova / 19 rata nisu generirane (Visa nema stalan dan naplate) | uz Visa izvod ~05.–07.10.: generirati s danom 5. kao procjenom; `visa_uvoz_izvoda` ih mora **spariti, ne dodati** (generirana rata nema `Izvod opis`) |
| T29 | **PBZVISA prolaz** — ispravljač `Datum naplate` za Visu (§8.5) | dobrim dijelom ga radi `visa_uvoz_izvoda` (S148) — preispitati što ostaje; imena `PBZVIZA_` riješena (T8) |
| T30 | **`Izvod opis` za RF retke** (§8.4) | dio T4 (žig); razdvojiti po `Izvor`u — kartične retke potvrđuje PBZVISA, ne RF izvadak |
| T31 | **`oznaci_iz_presedana.py --apply`** (§8.3) | srodno T16–T17 (alat klasificira sam); pokrenuti uz sitne ispravke |
| T32 | **Dva zaostatka iz S125** (§8.6) | Excel put, nisko |
| — | Održavanje klasifikacije K0–K5 | **ostaje u backlogu** (generično, sve Aree); srodno T18 |

**Kokino, iz istog prolaza:** pretplate u stranoj valuti (Audible) upisuje u **dolarima** — iznos
se upisuje u eurima iz bankovne aplikacije; ako ga ne zna, `~` na početak opisa.

---

## 5. Za Sašu: naredbe danas (kvarljivo)

> ⚠ Vrijedi na dan u zaglavlju. Naredbe su za **PowerShell iz `data-prep_tools\`**.
> **Jednom po prozoru:** `$env:ET_TARGET='prod'` — vrijedi za **sve** alate (od S158); bez toga
> gađaju TEST (kopiju PROD-a), a brojka izgleda jednako uvjerljivo. Ispis počinje s `[PROD]` —
> **zaglavlje se čita prije brojke.**
> PDF se zadaje **samo imenom** (`MC_2026-09.pdf`) — alat ga sam nađe u `izvodi\`.

**Prvi korak za svaki izvod — razvrstač.** `Financije\run.bat razvrstaj_izvode.py` (pregled) →
`… --apply` (kopira iz OneDrive inboxa u `izvodi\` **i u inboxu preimenuje** u isto ime —
ništa ne briše, zauzeto ime ne prepisuje). Ne-izvod (PBZ „Detalji transakcije") ostaje u inboxu
uz razlog. MC stiže kao `Obavijest o učinjenim troškovima.pdf` → `MC_YYYY-MM.pdf` (i kod nas i
u Kokinoj mapi). Nakon uvoza PDF u `izvodi\Analizirani_izvodi\` — to je
oznaka „obrađeno" za čovjeka; alati ga vide i u korijenu.

**Mastercard izvod (~2. u mjesecu, prije naplate)** — izveden uživo S158 (MC_2026-09)
1. `Financije\run.bat uskladi_izvod.py --izvod MC_YYYY-MM.pdf --dry` → spareno, što fali
   (`ZA UVOZ`), što je višak (`PITANJA`). Prijedlog `Status → Izvrsen` se **ne primjenjuje** (T19).
2. Delta Export ZABA iz appa (Activities, filtar na račun — najlakše klikom na račun na pločici) →
   `Financije\run.bat fill_from_izvod.py <delta.xlsx> --mc MC_YYYY-MM.pdf` → `<delta>_filled.xlsx`
   (presedani se uzmu sami iz `ET_TARGET`).
3. ⚠ **`_filled` se NE uvozi bez pregleda** dok se ne riješe T13–T16: mali pomak iznosa = nov redak
   (duplikat), duplikati u košari se ne prijavljuju, rate ostanu `N/A`. Kontrola prije uvoza:
   **Σ redaka s naplatom = dan dospijeća = iznos izvoda u cent** — ne „Σ košara" iz sheeta (T12).
4. Koka uveze; 11. traka ponudi **Potvrdi**.
5. Jednom mjesečno nakon izvoda: `Financije\run.bat rate_alat.py --only b` — novi planovi rata
   (ako ih ima) → `--file <ime>` → uvoz. Ponovno pokretanje ne generira dvaput.

**Visa (~5.–7.)**
1. `Financije\run.bat visa_uvoz_izvoda.py PBZVISA_YYYY-MM.pdf <dan naplate na RF-u> --file`
   → app Excel: ispravci (`Status → Izvrsen`, `Datum naplate` = stvarni dan, `Izvod opis`) + novi
   retci. Kontrola **Σ = izvod u cent** — inače stati.
2. Koki javiti očekivane brojke; Koka uveze.
3. Naplata na RF-u: redak `Racun` · Sašin tekući RF · `Transfer / izmedju racuna` · Smjer `Isplata` ·
   opis **`Visa`**. **Naknada `0,17`** zasebno, kao `Domaćinstvo / Bankovni troškovi`, opis
   `Naknada` — **nikad** s opisom `Visa` (traka bi vidjela dvije naplate).

**ZABA (kad stigne)**
1. Delta Export ZABA iz appa (prozor mora obuhvatiti mjesec izvoda).
2. `Financije\run.bat fill_from_izvod.py <delta.xlsx> --zaba ZABA_YYYY-MM.pdf --zigosi`
   → `<delta>_filled.xlsx`. Skupna MC naplata iz trake je *„već na listu (preskočeno)"*; poruka
   `≈ … već upisana na …` znači da je u traci upisan krivi dan → ispraviti ga u appu.
3. Koka uveze; kontrolni stupac mora završiti na ispisanom stanju; sidro s izvoda.

**RF (kad stigne)** — kao ZABA, s `--rf RF_YYYY-MM.pdf` (`--od <datum>` za početak prozora).

**Kontrola nakon izvoda:** `Financije\run.bat promet_check.py` — promet po izvodu, app vs banka.

---

## 6. Kamo idemo: ploha „Raščišćavanje izvoda" (prijedlog, ništa nije izgrađeno)

Zatvara T1. Otvara se s Overview pločice, iz retka računa, kad za račun postoji obrađen a
nepregledan izvod:

```
┌ Stanje po računu ─────────────────────────────────┐
│ Kokin tekući ZABA        13.815,33 €   ✓           │
│   📄 Izvod 2026-09 · 44 stavke · 5 za pregled  [›] │
│ Sašin tekući RF             690,79 €   ✓           │
└────────────────────────────────────────────────────┘
```

**Vide se samo iznimke**; što se slaže u cent samo se ožigoše i prikaže kao *„39 slaže se"*. Na
mobitelu je razlika između 5 i 44 retka razlika između „odradim na kavi" i „ostavit ću za poslije".

| vrsta | značenje | potez |
| --- | --- | --- |
| ✎ razlika | redak postoji, iznos ili datum se ne slaže | **Prihvati bankin** (mijenja iznos, ne opis) ili ostavi |
| ＋ nema u bazi | banka ima, app nema | **Dopiši** — `Tip`/`Podtip` predložen iz povijesti |
| ？ nema na izvodu | app ima, banka ne | duplikat? kriv račun? — odluka je vlasnice, nikad automatski |
| ⇄ 1:N | jedan naš = više bankinih (ili obrnuto) | prihvati predloženi spoj |

Na kraju: *„Izvod kaže 13.815,33 na 30.09. — app kaže 13.815,33 ✓"* → **Potvrdi stanje** upiše sidro
s datumom i brojem s papira. Ne slaže li se, sidro se ne nudi.

**Odluke prihvaćene (S151):** K1 stavke izvoda u novoj tablici (`statement_lines`) · K2 PDF i dalje
parsira Sašin alat · K3 prvo traka (✅ izvedeno S155–S157) · K4 kartični izvodi kroz istu plohu,
ali kao košara · K5 potvrđuje vlasnica Aree.

Pravila koja ploha mora nositi (već plaćena): ispravak Editom postojećeg retka · sličan opis nije
duplikat · rata se veže brojem rate, ne datumom · izmjena retka prije sidra ne miče saldo i ploha
to mora reći.

---

## 7. Što reći Koki, njenim jezikom

1. ~~Kad počneš upisivati u app, u Excelicu više ne.~~ ✅ rečeno, prihvaćeno.
2. **Kartica se potvrđuje kad se zbroj složi s bankom, ne kad datum dođe.**
3. **Stanje na pločici uspoređuj s bankom, a razliku prijavi.** Razlika znači da nešto fali, nešto
   je dvaput ili je iznos kriv — nikad grešku u izračunu.
4. **Ako nešto ispraviš, a ništa se ne dogodi — javi.** To je greška aplikacije, ne tvoja.

⚠ Četvrta je najvažnija za povjerenje: daje joj dopuštenje da prijavi tišinu umjesto da zaključi
da je nešto krivo napravila.

---

## 8. Preneseno iz backloga (S158) — puni tekst

> Stavke Financija iz `docs/sessions/BACKLOG.md` preseljene su ovamo **doslovno**, da
> Financije imaju jedan popis otvorenog posla (§4). Prije su isti posao opisivala dva
> popisa — razred koji je S116 već platio (kurirani „Otvoreno" propustio 60 testova).
> Stanje iz S158 je u retku §4 koji pokazuje ovamo; tekst ispod je iz trenutka zapisa.

### 8.1 C1 — Izvodi: od inboxa do žiga

- **⭐ Izvodi: od inboxa do žiga (C1)** — RF **i** ZABA `Izvod opis`. Tok: Koka stavi PDF u
  svoju OneDrive mapu `Izvodi` → kod Saše `C:\0_Sasa\OneDrive\Izvodi` (postavljeno 26.09.) →
  **razvrstač** (prvi korak) preimenuje po **sadržaju** u `ZABA_YYYY-MM.pdf` i stavi u `izvodi/` →
  jedna naredba obrade → Excel za uvoz (pregled ostaje brana) → `Analizirani_izvodi/`.
  ✅ **Razvrstač gotov (S152):** `Financije\run.bat razvrstaj_izvode.py [--apply]` — kopira iz
  inboxa (Kokina mapa se ne dira), PBZ „Detalji transakcije" ostaje uz razlog. Sljedeće: obrada.
  Podsjetnik na pločici **iz podataka** („kolovoški izvod još nije obrađen“), ne iz kalendara.
  ⚠ Testni slučaj: PBZ „Detalji transakcije“ PDF — razvrstač ga mora odbiti kao ne-izvod.

### 8.2 C5 — „Dospjelo → potvrdi" (traka)

- **„Dospjelo → potvrdi“ (C5)** — `docs/DOSPJELO_SPEC.md`. ✅ **Faza 1 S155** (traka, samo
  čitanje, samo MC; `sql/053` + `054` na TEST-u, PROD čeka Sašu — T-S155-7). Sašina odluka S155:
  config **jednokratno SQL-om**, `Dashboard` sheet (F5) poslije. ⚠ Do F5 `due` blok ne putuje
  Excelom (uvoz ga ne briše). Sljedeće: faza 2 (`Potvrdi` + skupni redak, samo vlasnica).
  ✅ **Faza 2 S156–S157**, na PROD-u od 01.10.2026. (`sql/055`, `settle.smjer`, pravilo C).
  - **⏸ „Gdje bi mogla biti razlika?" — ČEKA PRVU STVARNU RAZLIKU** (S157, Sašina odluka).
    Kad traka kaže „naplaćeno — neusklađeno", ispod oznake na dodir popis SUMNJIVIH redaka
    iz podataka, svaki s Edit: (a) redak/dva u košari = razlici ⇒ druga košara ili dvaput;
    (b) banka više ⇒ redak u SUSJEDNOJ košari = razlici ⇒ krivi `Datum naplate` (S112);
    (c) par istog iznosa ±2 dana ⇒ duplikat (S148); (d) kupovine s ruba ciklusa.
    Naznake, ne presude — tipfelere i neupisano hvata samo izvod (postupak „kad se ne slaže",
    `FINANCIJE_PROCES.md` §5). **Zašto čeka:** na prvoj stvarnoj razlici izmjeriti bi li
    (a)–(d) pogodili uzrok; projektirati naslijepo = upozorenje koje se nauči otklikati.
  - **Visa u traku** (S157): D4 razlog riješen u S148; Koka potvrđuje i Visu (Sašina odluka).
    Prije: 12 redaka `Datum naplate` 03.10. → stvarni dan (alat to radi sam), širi prozor dana
    u configu (Visa nema fiksan dan), `text: "Visa"` (NE PBZ tekst — 6 varijanti), naknada
    `0,17` nikad s opisom `Visa`, `fill_from_izvod.py` čita tekst iz configa. Cilj: ~05.11.

### 8.3 `oznaci_iz_presedana.py --apply`

- **`oznaci_iz_presedana.py --apply`** — zadržati i pokrenuti (uz sitne ispravke podataka).

### 8.4 `Izvod opis` za RF retke

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

### 8.5 PBZVISA prolaz — ispravljač `Datum naplate` za Visu

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

### 8.6 Dva zaostatka iz S125

- **🟡 Dva zaostatka iz S125** (preseljeno iz `FINANCIJE_KOKA_PROCES.md` §5 pri prepisivanju, S158):
  (a) **sumnjiv redak u izvještaj o uvozu** — preskočen po `row_hash`, a u međuvremenu promijenjen
  u appu; pogađa Excel put, koji Koki više nije svakodnevni, pa je niže nego u S125.
  (b) **„promijenjeno nakon <datum>" vidljivo u listi** — dodiruje filtar s dva uvjeta
  (`docs/FILTER_SPEC.md`), svjesno odgođeno.
