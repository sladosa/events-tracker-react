# Kamo ide novac — pločica razreza i grupiranja u buckete (prijedlog prije koda, S163)

> **Status (S165, 07.10.2026.): §15 koraci 1–4 IZVEDENI na TEST-u** — 056, `verify_breakdown.py` (u lipu),
> model + pločica + testovi, config (`set_breakdown.py`). PROD (koraci 6–8) čeka Sašu; odstupanja od teksta: **§17**.
> Nastavak otvorene niti `OVERVIEW_TAB_SPEC.md`
> §2.19 („Saša — analitika: koliko je potrošeno po Tip/Podtip"). Nastao razgovorom 2026-10-06.
> **Detaljni tehnički spec R-F2/R-F3: DIO 2 (§10–§16, S164).**
> Odluke (§9): S164 odlučeno R1–R8, R10–R15 (sve); **R3 čeka Kokin korak** (§4.4); ono što je u razgovoru već dogovoreno označeno je ✅.
> **S164 (07.10.):** R1 izveden na PROD-u; TEST ponovo = PROD (`prod_to_test.py`); dodane odluke
> R10–R15 iz skice; brojke u §8 ponovo izmjerene (TEST = PROD od **07.10.2026.**), razdoblje
> **10/2025–09/2026**.
> **Skica (interaktivna, stvarni podaci):** https://claude.ai/artifact/CKaA4SgUbfuvV5qo4zNvFs

---

# DIO 1 — za Sašu

## 1. Što gradimo, u jednoj rečenici

Na Overview tabu Aree nova pločica koja pokazuje **koliko je novca ušlo i odakle, koliko je
izašlo i kamo**, u razdoblju iz filtra, složeno u **buckete** koje sami definiramo
(„mjesečni troškovi", „luksuzna potrošnja"…) — i koja radi i na mobitelu.

Do danas Overview ima jednu jedinu pločicu (`Stanje po računu`), dakle odgovara na „koliko
imam", a ne na „kamo ide". Podaci za drugo pitanje postoje: 5.292 retka, 68 parova Tip/Podtip.

## 2. Kako izgleda

### 2.1 Raspored — jedan prikaz, prekidači (✅ dogovoreno)

Prihodi i troškovi **ne stoje jedan uz drugog** nego se biraju prekidačem — na uskom ekranu
dva stupca ne stanu, a dva rasporeda (jedan za laptop, drugi za mobitel) su dva mjesta koja
se razilaze (CLAUDE.md, „ista radnja na dvije širine živi na dva mjesta"). Isti raspored na
obje širine; razlikuje se samo **crtež** (§2.2).

```
┌ Kamo ide novac ───────────────────────── 01.09.–30.09.2026 (iz filtra) ┐
│ Ušlo 8.120,00 · Izašlo 6.430,00 · Razlika +1.690,00                     │  ← uvijek vidljivo
│ [ Troškovi | Prihodi ]    [ po kupnji | po naplati ]    [Vrsta troška ▾] │  ← prekidači
│                                                                          │
│   <crtež>                                                                │
│                                                                          │
│ izvan razreza: Transfer 1.300,00 · nerazvrstano (N/A) 309,82  ⓘ         │  ← nikad skriveno
└──────────────────────────────────────────────────────────────────────────┘
```

- **Razdoblje dolazi iz filtra** („This Month", „Last Year", ručni raspon). Pločica ne pamti
  svoj period, pa ista pločica odgovara na rujan i na cijelu godinu.
- **Sažetak (ušlo / izašlo / razlika)** je jedan redak i ostaje vidljiv uz oba prekidača.
- **Treći izbornik** bira grupiranje u buckete (§4) — ako ih Area ima više. Bez grupiranja
  pločica ide izravno Tip → Podtip.

### 2.2 Crtež

**Laptop:** isti Plotly Sunburst kao na Structure tabu. Prsteni iznutra prema van:
**Bucket → Tip → Podtip**, veličina = **iznos** (ne broj redaka). Desno tablica s brojkama —
iznos se s kolača ne čita točno.

**Mobitel:** isti podaci kao **lista s trakama**; dodir rasklopi razinu niže, dodir na Podtip
otvara te retke u Activities (drill, §6.4).

```
Mjesečni troškovi     ████████████  2.140,30  ›
Luksuzna potrošnja    ██████          980,00  ›
Kuća investicije      ███             420,00  ›
nesvrstano  ⓘ         █               110,00  ›
```

Na mobitelu se krug ne crta (lista nosi sve brojke). ⚠ S164: Plotly je ionako u paketu, pa se štedi crtanje, ne preuzimanje (§12.2).

## 3. Što se broji — pravila

| pravilo | zašto |
| --- | --- |
| **Prihod = redak s `Tip = Prihodi`** (strana „Prihodi", grupirano po Podtipu) | jedino mjesto gdje je „ovo je prihod" zapisano |
| **Povrat se neto oduzima od troška svog Tipa** (uplata pod `Kuća` smanjuje `Kuća`) | povrat nije prihod. Izmjereno: Kuća 889,18, Porezi 1.323,23, Razno 200,00, Putovanja 105,30 uplata u 12 mj. ⚠ Tip može ispasti **negativan** (Porezi −973,23: povrat veći od plaćenog) — to se prikazuje, ne skriva |
| **`Transfer` je izvan razreza**, ali iznos stoji u retku „izvan razreza" | novac je prošao, nije potrošen ni zarađen. Isto pravilo kao saldo (OVERVIEW §2.10, §2.14) — samo obrnuto: saldo ga broji, razrez ne |
| **`N/A` i prazan Tip su vidljiv redak „nerazvrstano"**, nikad izostavljen | prešućen N/A izgleda kao manja potrošnja. Izmjereno: **1.501** redak u povijesti, 109 u zadnjih 12 mj |
| **Redak „gotovina, nerazvrstano"** = Σ(`Transfer / cash - bankomat`) − Σ(`Izvor = Cash`) | inače razrez prešuti ~4.000 €/god podignute gotovine (CLAUDE.md § Overview, S121). Ulazi u troškove kao vlastiti bucket |
| **Rate (✅ dogovoreno):** „po kupnji" ⇒ cijela kupnja u mjesecu kupnje, **uključujući `Planiran` rate** | sve rate dijele `event_date` = dan kupnje (D1b). Bez `Planiran` kupnja od 600 € na 6 rata izgleda kao 100 € |
| **„Po naplati"** ⇒ razdoblje se gleda po `Datum naplate` | v. §3.1 |

### 3.1 Prekidač „po kupnji / po naplati" (✅ dogovoreno)

| prikaz | odgovara na | kupnja 600 € na 6 rata |
| --- | --- | --- |
| **po kupnji** (`event_date`) | „što smo potrošili u rujnu" | 600 u mjesecu kupnje |
| **po naplati** (`Datum naplate`) | „koliko je u rujnu stvarno otišlo s računa" | 100 svaki mjesec |

Izmjereno: od **1.022** kartična retka u 12 mj njih **990** je naplaćeno u **drugom** mjesecu
od kupnje — za kartice prekidač mijenja gotovo sve; za `Racun`/`Cash` nema razlike.
Ovo nisu dva prikaza istog broja nego **dvije različite istine**, i usput rješavaju dvojbu
oko rata: tko želi rate razvučene po mjesecima, prebaci na „po naplati".

⚠ „Po naplati" za buduće Visa rate koristi **procijenjeni** dan (5.), jer Visa nema stalan dan
naplate (CLAUDE.md § Model / atributi). Za prošle mjesece je datum s izvoda — točan.

## 4. Bucketi — grupiranje iznad Tipa

### 4.1 Zamisao

Bucket je **skup parova Tip/Podtip** s imenom, npr. *„Mjesečni troškovi" = {Kuća/Struja,
Kuća/Plin, Informatika/Komunikacije_T-mobile, …}*. Definira se **tablicom pridruživanja**,
a ne upisom na svaki redak:

```
Sheet „Grupiranja" (dio Structure Excela, putuje kao i ostala struktura)
Area          | Grupiranje    | Bucket              | Tip          | Podtip
Financije_all | Vrsta troška  | Mjesečni troškovi   | Kuća         | Struja
Financije_all | Vrsta troška  | Mjesečni troškovi   | Zabava       | Spotify
Financije_all | Vrsta troška  | Mjesečni troškovi   | Prijevoz     | *
Financije_all | Vrsta troška  | Kuća investicije    | Kuća         | Popravci, održavanje, osiguranje
Financije_all | Vrsta troška  | Luksuzna potrošnja  | Putovanja    | *
```

- **Nijedan redak se ne dira.** Premještanje Podtipa u drugi bucket je jedna ćelija, ne 5.000
  redaka — i vrijedi unatrag za cijelu povijest.
- **`*` = cijeli Tip** (obrazac poznat iz `WhenValue = *`). Konkretan par ima prednost pred `*`.
- **Nesvrstano je vidljivo.** Par koji nije nigdje dodijeljen pada u bucket **„nesvrstano"** na
  pločici. Kad Koka doda novi Podtip, on se pojavi kao „dodijeli me", nikad ne nestane.
- **Izvoz sheeta je ujedno inventar klasifikacije:** ispiše **sve** postojeće parove (68), a
  prazna kolona `Bucket` pokazuje što nije razvrstano. To je K0 iz
  `KLASIFIKACIJA_ODRZAVANJE_SPEC.md`, dobiven usput.
- **Generično:** Fitness bi istim mehanizmom svrstao vježbe u mišićne skupine — nula linija koda.

### 4.2 Može li isti par u dva bucketa? (Sašino pitanje)

**Unutar jednog grupiranja — ne. U dva različita grupiranja — da.**

Razlog je mehanički: unutar grupiranja **zbroj bucketa mora dati ukupan trošak**. Kad bi
`Kuća/Popravci` bio i u „Mjesečni" i u „Kuća investicije", taj bi se iznos brojao dvaput i
kolač bi bio veći od stvarne potrošnje — bez ijedne poruke. Uvoz sheeta zato **staje** ako
isti par stoji u dva bucketa istog grupiranja.

Ono što se u pitanju zapravo krije su **dvije različite potrebe**, i obje imaju odgovor:

1. **Isti trošak gledan s dvije strane** — npr. „Vrsta troška" (mjesečni / luksuz / investicije)
   i „Čiji trošak" (Koka / Saša / zajedničko). To su **dva grupiranja**; par ima po jedan bucket
   u svakom, izbornik na pločici bira koje se gleda.
2. **Isti par je ponekad jedno, ponekad drugo** — i tu tablica parova **ne može** pomoći, jer
   razlika nije u paru nego u **retku**. Izmjereno na `Kućište`u (§8.4): troškovi Kućišta
   razasuti su po `Razno` (pločice 299,39), `Porezi` (porez 630,00), `Kuća/Voda` i
   `Domaćinstvo/Hrana` (Studenac Kućište). Nijedan par ne znači „Kućište".
   ⇒ **Faza 2: iznimka na retku.** Opcionalan atribut (radno ime `Namjena`) čije su opcije
   imena bucketa; kad je popunjen, **pobjeđuje** tablicu parova. Pravilo je **specifičnost, ne
   redoslijed**: iznimka na retku > konkretan par > `Tip / *` > nesvrstano. (Redoslijed
   pravila je u `parked/RULES_ENGINE_SPEC.md` odbačen jer konflikt tiho odluči — ovdje
   konflikta nema, jer je svaka razina strogo uža od sljedeće.)

### 4.3 Prvi prijedlog rasporeda — Sašini bucketi

Saša je predložio: **Mjesečni troškovi · Kuća investicije · Kućište investicije · Luksuzna
potrošnja**. Raspored ispod je **moj prijedlog za ispravljanje**, ne odluka — ❓ = nisam
siguran, ✱ = par koji mješa dvije stvari pa traži iznimku na retku (§4.2). Iznosi su **neto**
(isplata − uplata) u 12 mj, zbrojeni iz tablice parova.

| Bucket (prijedlog) | parovi | neto 12 mj |
| --- | --- | ---: |
| **Mjesečni troškovi** | Domaćinstvo/Hrana i ostalo, Domaćinstvo/Bankovni troškovi · Kuća/Struja, Plin, Voda, Holding (smeće) · Informatika/Komunikacije_T-com, Komunikacije_T-mobile, Cloud backup, Microsoft, HP, Hosting domene · Zabava/Audible_*, Spotify, Prime, Sky, Disney, HBOmax, Youtube, Kindle_Koka (pretplate) · Prijevoz/* · auto C5/gorivo, leasing, registracija · auto Lacetti/gorivo, registracija · Osiguranje/Zivotno · Zdravlje/Lječnička komora_Koka, PP ❓, Sport_* ❓ · Porezi/* ❓ (neto −973,23) | 20.109,26 |
| **Kuća investicije** | Kuća/Popravci, održavanje, osiguranje ✱ (osiguranje je mjesečno, popravak investicija) | 947,73 |
| **Kućište investicije** | ~~nijedan par~~ ⇒ **S164: `Razno / Nena's funds`** (novi Podtip na PROD-u, v. §8.4, R12) | 499,39 |
| **Luksuzna potrošnja** | Putovanja/* · Domaćinstvo/Kave/jelo vani ❓ · Zabava/Kino/Kazalište/Muzeji, Wellness · Razno/Temu ❓ · Razno/Pokloni ❓ | 6.333,83 |
| **ostaje nesvrstano** (treba ti bucket ili svjesno „ostalo") | Zdravlje/Medical_* · Razno/Odjeća/obuća_* · Razno/Razno, sitnice · auto */popravci · Informatika/Hardver · Projekti/* · Advokati/Ostavine · Razno bez Podtipa · Investicije/* (financijske, ≠ kuća; 0 u 12 mj) · **Kuća/Povrat Zoran, Povrat Nataša** ❓ (samo uplate, neto −889,18 — kamo god idu, smanjuju taj bucket) | 6.089,84 |
| **izvan razreza** | Transfer/* · Prihodi/* (druga strana) · N/A (vlastiti redak „nerazvrstano") | — |

Iz rasporeda se vidi da će vjerojatno trebati **peti bucket** („Zdravlje i ostalo nužno" ili
„Povremeni troškovi") — inače „nesvrstano" ostaje trajno velik, a trajno velik „nesvrstano"
se prestane čitati.

**✅ S164 — Sašin raspored (R2 odlučen).** Zamjenjuje tablicu iznad (koja ostaje kao povijest
prijedloga). Grupiranje „Vrsta troška", 8 bucketa + dvije posebne kriške. Iznosi: neto, **po kupnji**,
10/2025–09/2026, TEST = PROD 07.10. (po naplati u zagradi).

| Bucket | parovi | 12 mj |
| --- | --- | ---: |
| **Mjesečni troškovi** | Domaćinstvo/Hrana i ostalo, Bankovni troškovi · Kuća/Struja, Plin, Voda, Holding, **Povrat Zoran, Povrat Nataša** (R15: vraćaju dio režija; Zoran 12/12 mj) · Informatika/T-com, T-mobile, Cloud backup, Microsoft, HP, Hosting · Zabava/pretplate (Audible ×2, Kindle, Spotify, Prime, Sky, Disney, HBOmax, Youtube) · Prijevoz/* · Zdravlje/PP · **gotovina, nerazvrstano** (S164, v. ispod) | 20.994,89 (19.939,85) |
| **Kvaliteta života** | Razno/Temu (12/12 mj) · Domaćinstvo/Kave/jelo vani (12/12) · Zdravlje/Sport_Sasa (11/12), Sport_Koka (8/12) · Zabava/Kino/Kazalište/Muzeji, Wellness | 4.164,57 (4.106,59) |
| **Putovanja i pokloni** | Putovanja/* · Razno/Pokloni | 2.909,94 (2.281,44) |
| **Povremeno nužno** | **Osiguranje/*** · **Porezi/*** (−973,23 u 12 mj, R11) · Zdravlje/Medical_*, Other · Razno/Odjeća ×2, Razno sitnice · Informatika/Hardver, Održavanje i servis · Advokati/* · **Kuća/Osiguranje** (R3) | 2.911,14 (2.825,88) |
| **Kuća investicije** | Kuća/Popravci, održavanje, osiguranje (bez osiguranja od R3, §4.4) | 614,44 (716,33) |
| **Kućište · Nenin novac** | Razno/Nena's funds (R12) | 499,39 (499,39) |
| **Koka razno** | Projekti/Koka · **auto C5/*** (gorivo, leasing, registracija s osiguranjem Allianz, popravci) · Zdravlje/Lječnička komora_Koka (S164) | 4.311,71 (4.242,03) |
| **Saša razno** | Projekti/Sasa · **auto Lacetti/*** | 1.611,03 (1.638,85) |
| *nerazvrstano (N/A)* | N/A i prazan Tip (R10) | 2.110,80 (3.054,84) |
| **= Izašlo** | | **40.127,91 (39.305,20)** |

- **Gotovina, nerazvrstano ide u Mjesečne troškove** (Saša, S164) kao vlastita podstavka bucketa
  (podignuto − evidentirano), vidljiva kad se bucket rasklopi. **Bez razmazivanja po mjesecima:**
  podizanja su neravnomjerna (10/2025 4,00 · 11/2025 800,00 · 07/2026 740,00), ali u pogledu jednog
  mjeseca prosjek bi pokazao broj koji se nije dogodio; na 12 mj je zbroj isti. Prosjek kao opcija
  prikaza — kasnije, ako zatreba. Config: redak grupiranja može pokazivati na korekcijski redak
  (`{ bucket, adjustment: 'gotovina, nerazvrstano' }`, §10).
- Ništa ne ostaje „nesvrstano" u 12 mj. Σ bucketa = Σ Tipova = Izašlo, provjereno u skici.
- **Pravilo „mjesečno" = plaća se (gotovo) svaki mjesec** (Saša, S164). Zato su osiguranje, porezi i
  registracija izašli iz Mjesečnih: plaćaju se godišnje.
- ⚠ **„Koka razno" / „Saša razno" miješa drugu os** (čiji trošak) u grupiranje po vrsti. Svjesno, za
  aute i projekte. Parovi s imenom osobe u drugim Tipovima (Medical, Sport, Odjeća, Audible) **ostaju**
  u bucketu po vrsti. Potpun pogled „čiji trošak" je drugo grupiranje (R5, kasnije); uz njega ide i
  **raspodjela goriva po godišnjoj kilometraži** (servisne knjižice) — Sašina ideja, nije izrađena.

### 4.4 R3 — odvajanje osiguranja kuće (S164, plan)

Izmjereno na PROD kopiji: `Kuća / Popravci, održavanje, osiguranje` ima **133** retka u povijesti
(6.686,86). **Osiguranje su samo 5:** Generali 21.03.2023. 402,75 · Allianz kuća 02.04.2024. 418,76 ·
Osiguranje za kuću 27.03.2025. 418,76 · Generali police 19.03.2026. 434,26 + naknada 0,17. Jednom
godišnje, ožujak/travanj. Ostalih 128 su Ikea, Bauhaus (uglavnom rate), vrtlar, Letinčić 1.470 —
oprema i održavanje kuće.

Koraci 1–2 radi alat **`Financije/fix_kuca_osiguranje_S164.py`** (Saša, S164: „alatom na TEST-u za
probu, pa PROD"): doda opciju `Osiguranje` pod `Kuća` i prebaci 5 redaka, ciljano po `event_id`
(TEST i PROD dijele ID-eve eventa). ✅ **Izvedeno na TEST-u 07.10.** (`5 od 5 ✓`, ponovni prolaz ne
mijenja ništa). PROD: T-S164-2, nakon Kokinog pristanka — struktura je njezina (S133).
1. ~~Koka doda Podtip `Osiguranje` pod `Kuća`~~ ⇒ alat (service ključ, uz Kokin pristanak).
2. ~~5 redaka Editom~~ ⇒ alat.
3. Grupiranje: `Kuća / Osiguranje` → **Povremeno nužno**.
4. Ime starog Podtipa (`…, osiguranje`) **ne dirati sada**: preimenovanje opcije ostavlja stari tekst
   na 128 redaka (K-plan, `KLASIFIKACIJA_ODRZAVANJE_SPEC.md`). Ide u održavanje klasifikacije.

⚠ „Kuća investicije" je po sadržaju više **oprema i održavanje** nego investicija (Ikea/Bauhaus rate).
Ime je Sašino i ostaje dok on ne odluči drukčije.

### 4.5 N/A — naknadno razvrstavanje (S164, zaseban zadatak)

12 mj: **121** redak, 2.110,80 (cijela povijest 1.513). **79** ih je iz 10–12/2025 — prije nego je Koka
prešla na unos u appu s obaveznim Tipom; 2026. ih ima 42. **112 nosi `Izvod opis`**, 109 komentar, pa
su razvrstivi (Restoran Lanterna 450,70 → Kave/jelo vani, Recepcija Lone 444,55 → Putovanja, Google
Play, Masterclass, Nespresso…). Po računu: **Kokin ZABA 72** (MC 54, Racun 18), **Sašin RF 49**
(Visa 40, Racun 9) ⇒ Saša svoje razvrstava sam.
**Alat (S164): `Financije/razvrstaj_na.py`** — prijedlog brojanjem povijesti (ljudska oznaka u opisu →
trgovac → trgovac + iznos → za račun `presedani.Presedani`; ≥ 90 % i ≥ 3 presedana; `N/A` ne glasa;
posrednik se ne pogađa; ručni rječnici `uvezi_transu.RUCNO` i `visa_uvoz_izvoda.KLASA`). Izlaz: app
Excel **po računu** (tko pregledava), kol. G = autor, Tip/Podtip izbornici, list `Pregled` s dokazom.
- **Provjera unatrag** (`--provjera`, povijest strogo starija od retka): na 1.318 razvrstanih redaka
  12 mj prijedlog za **65 %**, od toga **97,3 % točno**. Najčešći promašaj: Apple 9,99 (HBOmax vs
  Cloud backup — ista cijena, dvije pretplate) ⇒ žuto se **pregledava**, ne uvozi naslijepo.
- Na stvarnim N/A (121): prijedlog za **14** (ZABA 8, RF 6). Ostatak su jednokratni trgovci
  (Lanterna, Recepcija Lone, Masterclass…) i KEKS PAY — to zna samo čovjek; file ih nudi narančasto.
- ⚠ `uvezi_transu.RUCNO_IZNOS` (Apple 9,99 → HBOmax) se **ne koristi**: provjera unatrag ga je 3×
  pobila. Ručna odluka za jednu transu nije pravilo.
Pločica to ne čeka: N/A je vidljiva kriška (R10) i smanjuje se kako se razvrstava.

## 5. Spremljeni upiti — gdje žive (✅ dogovoreno)

- **„Spremljeni upit po Arei" = pločica** u `areas.settings.dashboard`. Area može imati više
  pločica („Kamo ide novac", „Gorivo po autu"…). Pripada **Arei**: vidi je i Koka, putuje
  Excelom i predloškom, preživi rename sluga.
- **Shortcut ostaje osoban** (`OVERVIEW_TAB_SPEC.md` §2.16 — „preset piše, widget čita";
  vlasnik je korisnik, pamti po ID-u, nikad ne putuje). Most postoji: drill s pločice daje
  stanje filtra, a „Save as Shortcut" ga već zna spremiti kao **osobni** pogled.
- **„Ne pojavljuje se ako ne tražiš analitiku":** Overview tab postoji samo u Arei koja ga ima;
  analitičke pločice su **sklopive** (stanje po pregledniku), saldo ostaje gore. Koka ih sklopi
  jednom.
- **Excel put:** pločica kroz `AreaSettings` sheet (F5, format odlučen u S160), bucketi kroz
  vlastiti sheet `Grupiranja` (§4.1) — tablica je tablica, ne niz ključ-putanja.

## 6. Što se NE gradi sada

| što | zašto ne | okidač |
| --- | --- | --- |
| Usporedba s prethodnim razdobljem | ✅ Saša: kasnije | kad se pločica koristi |
| Prihodi i troškovi jedan uz drugog na laptopu | ✅ prekidač; drugi raspored = drugo mjesto za održavanje | ako zafali |
| Prihodi „iz čega" (mirovina, plaća, najam) | danas je Podtip pod Prihodi **osoba** (Koka / Saša / Povrat Anja) — to je klasifikacija, Kokina odluka | R6 |
| Drill s bucketa | bucket je više parova, a filtar nosi **jedan** uvjet | „drill s dva uvjeta" (Backlog, parkirano) |
| Gumb „Spremi ovaj filtar kao pločicu" | prvo F5 + ručno složena pločica; poslije most iz filtra (samo vlasnik) | nakon R-F3 |
| Cross-Area razrez | `docs/parked/Analytics_tab.md` | prve Aree iz `trening.xlsm` |
| Grupiranje „Čiji trošak" + raspodjela goriva po kilometraži | R5: prvo jedno grupiranje; kilometraža traži podatak sa servisnih knjižica | kad se pločica koristi |

## 7. Redoslijed

| faza | što | veličina |
| --- | --- | --- |
| **R-F0** | ~~Ispravak 50.000 € (§8.1)~~ ✅ S164 · odluka o bucketima — **podaci, ne kod** | XS |
| **R-F1** | **F5:** `AreaSettings` sheet (Structure Excel) + sheet `Grupiranja`; uvoz brani dupli par u grupiranju i javlja par koji ne postoji | M |
| **R-F2** | Migracija: RPC razreza (§11) — više razina grupiranja + os datuma | S–M |
| **R-F3** | Pločica `breakdown`: sažetak, prekidači, sunburst + tablica, trake na mobitelu, drill na Podtip | M |
| ~~R-F4~~ | ~~Iznimka na retku (`Namjena`) — Kućište~~ — **otpada za prvu verziju (R12, S164)**; ostaje opcija ako par ikad ne bude dovoljan | S |

**S164 — predloženi drukčiji redoslijed (R14):** R-F2 → R-F3 **prije** R-F1. Config pločice i
grupiranja do F5 upisuje Python alat u `areas.settings` (obrazac `set_list_columns.py`, PROD pokreće
Saša). Koka dobije pločicu ranije, a raspored bucketa će se ionako mijenjati nekoliko puta prije nego
se isplati Excel put. R-F4 vjerojatno otpada (R12).

## 8. Nalazi iz mjerenja (TEST = PROD od 01.10., 10/2025–09/2026)

### 8.1 Redak od 50.000 € — prolazna stavka upisana kao prihod i trošak

| datum | Tip / Podtip | iznos | stvarno |
| --- | --- | --- | --- |
| 10.04.2026. | **Prihodi / Koka** | uplata 50.000,00 | Nenin poklon Igoru stigao na Kokin račun |
| 18.04.2026. | **N/A** | isplata 50.000,00 | Koka proslijedila Igoru |

Posljedica bez ispravka: Kokini prihodi 76.723,22 umjesto ~26.700, a N/A trošak 54.472,71
umjesto ~4.470 — svaki godišnji prikaz bi lagao u oba smjera.
**✅ IZVEDENO (Saša, prije 07.10.):** oba retka su `Transfer / Nena`. Provjereno na PROD-u
07.10.: točno 2 retka s 50.000, svi atributi na mjestu (`Smjer`, `Izvor = Racun`, `Racun`,
`Izvod opis`), autorica i `edited_by` = Koka, iznosi netaknuti ⇒ saldo se nije pomaknuo.
Kokini prihodi u 12 mj sada **26.723,22**.

### 8.2 Prihodi po Podtipu = po osobi

Koka 76.723,22 (s 50.000 iz §8.1) · Saša 15.299,26 · Povrat Anja 4.950,00 — 67 redaka.
Uz to `Transfer / Anja` 655,00 i `Transfer / Natasa` 838,00 uplata: ista vrsta novca (netko
vraća) živi pod dva Tipa. Ne lomi pločicu, ali je kandidat za održavanje klasifikacije.

### 8.3 Nerazvrstano

`N/A` + prazan Podtip: **1.501** redak ukupno, **109** u 12 mj (54.162,89 s retkom iz §8.1,
bez njega ~4.160). Najviše 10–12/2025 (16 + 19 + 42 retka).
**S164 (nakon R1, podaci do 07.10.):** N/A u 12 mj = **121** redak, **2.110,80** po kupnji;
po naplati 151 redak, 3.054,84 (kartični N/A kupljen u rujnu 2025. a naplaćen u listopadu ulazi
u prozor).

### 8.4 Kućište nema svoj Tip ni Podtip

13 redaka s „Kućište" u komentaru: Domaćinstvo/Hrana (6), Kuća/Voda (3), Porezi (2), Razno
bez Podtipa (1 — „Pločice za Kućište" 299,39), N/A (1). ⇒ bucket „Kućište investicije"
nije izrazljiv parovima (§4.2).

**S164 — promijenilo se:** na PROD-u je nastao Podtip **`Razno / Nena's funds`**, 6 redaka,
**2.321,47 €** (16.09.–04.10.2026.): Pločice za Kućište 299,39 · ventilatori 564,96 · Lampe 144,92 ·
Geberit wc + prevoz 312,20 · 4 kreveta 800,00 · **Graviranje Neninog groba 200,00**. Pločice su
prebačene s `Razno` bez Podtipa. Podtip dakle znači **čiji je novac** (Nenin), ne mjesto — grob
nije Kućište. Ostaje 9 starih redaka (Studenac, voda, porez Kućište) pod svojim parovima.
⇒ R12: bucket Kućište = taj par; R-F4 nije potreban za prvu verziju.

### 8.5 Inventar

**68** parova Tip/Podtip u **18** Tipova; **62** korišteno u zadnjih 12 mj. Nekorišteni:
Investicije/* (2), Osiguranje/Zivotno, Projekti/Koka, auto C5/leasing, Transfer/Nena.
**S164:** Transfer/Nena sada 3 retka (R1). Nova opcija `Razno / Nena's funds` (6 redaka). Opcija
**`Zdravlje / Other`** stoji u `validation_rules`, a **nijedan** redak je ne koristi — izgleda kao
ostatak; kandidat za brisanje (`KLASIFIKACIJA_ODRZAVANJE_SPEC.md`).

### 8.6 Ukupno, 10/2025–09/2026 (S164, TEST = PROD 07.10.)

| | po kupnji | po naplati |
| --- | ---: | ---: |
| Ušlo (`Prihodi`: Koka 26.723,22 · Saša 15.299,26 · Povrat Anja 4.950,00) | 46.972,48 | 46.972,48 |
| Izašlo po Tipu (neto, povrati oduzeti) | 34.186,21 | 32.419,46 |
| + nerazvrstano (N/A) | 2.110,80 | 3.054,84 |
| + gotovina, nerazvrstano (podignuto 4.044,00 − evidentirano 213,10) | 3.830,90 | 3.830,90 |
| **= Izašlo** | **40.127,91** | **39.305,20** |
| izvan razreza: Transfer ušlo / izašlo | 61.420,64 / 81.561,51 | isto |

- Skupne naplate kartica su sve `Transfer / izmedju racuna` (55 redaka) ⇒ razrez kartičnu kupnju
  **ne broji dvaput**. Provjereno jer bi suprotno udvostručilo svaku kartičnu potrošnju.
- Najveći Tipovi (po kupnji): Domaćinstvo 9.574 · Kuća 4.324 · auto C5 4.128 · Informatika 3.746 ·
  Razno 3.522 · Zdravlje 3.363 · Putovanja 2.347. **Porezi −973,23** (povrat > plaćeno, R11).
- Invarijanta 1 (§12) provjerena u skici: Σ bucketa = Σ Tipova = Izašlo, u sve 4 kombinacije
  (rujan / 12 mj × kupnja / naplata).

## 9. Odluke za Sašu

| # | pitanje | prijedlog |
| --- | --- | --- |
| ~~R1~~ | ~~50.000 € (§8.1): oba retka `Transfer / Nena`?~~ | ✅ **riješeno** — Saša izveo na PROD-u, provjereno 07.10. |
| ~~R2~~ | Raspored parova u §4.3 — ispravi/potvrdi; treba li **peti** bucket za nužno-povremeno (zdravlje, odjeća, popravci auta)? | ✅ **Saša S164:** raspored u §4.3 („Sašin raspored"), 8 bucketa — prijedlog bio: peti bucket, inače „nesvrstano" ostaje ~6.100. **S164:** u skici kao „Povremeno nužno" — pogledaj ondje (❓ = nesigurno) |
| ~~R3~~ | `Kuća/Popravci, održavanje, osiguranje` miješa mjesečno (osiguranje) i investiciju — razdvojiti Podtip (Kokina odluka) ili čekati iznimku na retku (R-F4)? | ✅ **Saša S164: razdvojiti** — novi Podtip `Kuća / Osiguranje` (5 redaka), koraci u §4.4; **čeka Koku** (korak 1) — prijedlog bio: **razdvojiti Podtip** ako Koka pristane — jeftinije od iznimke na svakom retku |
| ~~R4~~ | Kućište: bucket samo za **investicije** (pločice, radovi) ili **sav** trošak Kućišta (i Studenac, voda, porez)? | ✅ **zatvoreno R12** (Kućište = izvor novca, ne mjesto) — prijedlog bio: o tome ovisi je li `Namjena` bucket ili zasebno grupiranje „Lokacija". **S164:** vjerojatno ga zatvara R12 |
| ~~R5~~ | Jedno grupiranje („Vrsta troška") ili odmah i drugo („Čiji trošak": Koka / Saša / zajedničko)? | ✅ **Saša S164: da** — prijedlog bio: **jedno** za prvu verziju |
| ~~R6~~ | Prihodi „iz čega" (mirovina, plaća…) — mijenjati Podtipove pod `Prihodi`? | ✅ **Saša S164: da** — prijedlog bio: **ne sada** — osoba je dovoljan prvi odgovor |
| ~~R7~~ | Zadana os datuma: po kupnji? | ✅ **Saša S164: da** — prijedlog bio: **da** (D1b) |
| ~~R8~~ | `Porezi` negativni kad je povrat veći od plaćenog — prikazati kao negativan trošak? | ✅ **Saša S164: da** (zajedno s R11) — prijedlog bio: **da**, s oznakom „povrat > trošak" |
| ~~R9~~ | ~~Redoslijed §7: F5 prvi, pa RPC, pa pločica?~~ | **zamijenjeno s R14** |
| ~~R10~~ | N/A: kriška **unutar** „Izašlo" ili redak izvan razreza? (§2.1 i §3 si proturječe) | ✅ **Saša S164: da** — prijedlog bio: **unutra**, kao kriška „nerazvrstano (N/A)" — vani bi „Izašlo" bilo manje od stvarnog |
| ~~R11~~ | Krug ne crta negativne iznose (Porezi −973,23 u 12 mj) | ✅ **Saša S164: da** — prijedlog bio: krug crta samo pozitivne, lista nosi sve, ispod kruga „nije nacrtano: …"; sažetak je uvijek neto |
| ~~R12~~ | Kućište = bucket `Razno / Nena's funds` (§8.4)? Ondje je i grob — bucket „Kućište · Nenin novac" ili Koka razdvoji Podtip? | ✅ **Saša S164: da**, bucket „Kućište · Nenin novac" = `Razno / Nena's funds`, grob ostaje u njemu; R-F4 otpada — prijedlog bio: **da**, bucket = taj par; R-F4 otpada za prvu verziju |
| ~~R13~~ | Grupiranje i za stranu Prihodi? | ✅ **Saša S164: da** — prijedlog bio: **ne** — prihodi su 3 Podtipa, bucketi bi ih samo ponovili |
| ~~R14~~ | Redoslijed: pločica (R-F2 + R-F3) **prije** F5, config upisuje alat? | ✅ **Saša S164: da** — prijedlog bio: **da** — Koka dobije pločicu ranije, raspored će se ionako mijenjati |
| ~~R15~~ | Što vraćaju `Kuća / Povrat Zoran` i `Povrat Nataša`? U „Kuća investicije" bucket postaje negativan (rujan −68,38; 12 mj ostane 159,69 od 947,73) | ✅ **Saša S164:** Mjesečni troškovi (vraćaju dio režija) — prijedlog bio: **pitanje za Koku**: ako vraćaju dio režija ⇒ „Mjesečni troškovi". Povrat ide u bucket troška koji vraća |

---

# DIO 2 — tehnički (za Claudea) · detaljni spec R-F2 + R-F3 (S164)

> Zamjenjuje skicu §10–§12 iz S163. Sve odluke iz §9 su ugrađene. Redoslijed je **R14**: RPC i
> pločica **prije** F5; config do F5 upisuje alat (§13). Brojke u ovom dijelu izmjerene su na TEST-u
> (= PROD od 07.10. + R3 osiguranje kuće).

## 10. Config

### 10.1 Pločica — `areas.settings.dashboard.widgets[]`, novi član rječnika

`src/types/database.ts` (rječnik je u kodu namjerno, OVERVIEW §2.15):

```ts
export interface BreakdownWidget {
  type: 'breakdown';
  title: string;
  /** Razine ispod bucketa, od vrha: ['tip', 'podtip']. */
  levels: string[];
  plus: string;                 // 'uplata'
  minus: string;                // 'isplata'
  /** Redak je PRIHOD kad prolazi ovaj uvjet. slug ∈ levels. */
  income: WidgetFilter;         // { slug: 'tip', op: 'in', values: ['Prihodi'] }
  /** Izvan razreza; iznos se ispisuje u podnožju. slug ∈ levels. */
  outside?: WidgetFilter[];     // [{ slug: 'tip', op: 'in', values: ['Transfer'] }]
  /** Vrijednosti levels[0] koje znače „nerazvrstano" (R10: kriška UNUTAR Izašlo). Prazno uvijek. */
  unclassified?: string[];      // ['N/A']
  /** Osi datuma; prva je zadana (R7). slug null = event_date. Jedan član ⇒ nema prekidača. */
  date_axes?: Array<{ label: string; slug: string | null }>;
  /** Korekcijski retci troškova: Σneto(add) − Σneto(subtract). */
  adjustments?: Array<{ label: string; add: WidgetFilter[]; subtract: WidgetFilter[] }>;
  /** Ime grupiranja iz `areas.settings.groupings` (R5: jedno). Bez njega Tip → Podtip. */
  grouping?: string;
  unit?: string;
}
export type DashboardWidget = BalanceByGroupWidget | BreakdownWidget;
```

**Dimenzije RPC-a** = `levels` ∪ svi slugovi iz `income`, `outside`, `adjustments` (Financije:
`['tip', 'podtip', 'izvorplacanja']`). Jedan poziv vraća retke po kombinaciji dimenzija (~120), a
**sve ostalo računa model u pregledniku** nad tim retcima: strana prihod/trošak, izvan razreza,
korekcije, bucketi. Nema drugog poziva za gotovinu.

Filtri u `add`/`subtract`/`income`/`outside` se nad redom rezultata primjenjuju **kao AND**, s istom
semantikom kao `p_filters` u 035 (`in` = vrijednost postoji i u popisu; `not_in` = nema je u popisu,
prazno prolazi). Slug izvan dimenzija = **greška configa** (pločica je ispiše, ne šuti).

Neto se svugdje računa kao **`minus − plus`** (trošak pozitivan). Prihod: `plus − minus`.

### 10.2 Grupiranja — `areas.settings.groupings` (zaseban ključ)

Zaseban, ne unutar pločice: istu tablicu smiju čitati i druge pločice i budući filtar.

```ts
export interface Grouping {
  levels: [string, string];                    // ['tip', 'podtip'] — što par znači
  rows: Array<
    | { bucket: string; values: [string, string] }   // values[1] = '*' ⇒ cijeli Tip
    | { bucket: string; adjustment: string }         // korekcijski redak ide u bucket (gotovina → Mjesečni)
  >;
}
// AreaSettings: groupings?: Record<string, Grouping>
```

Razrješavanje (specifičnost, ne redoslijed — §4.2): **par > `Tip / *` > „nesvrstano"**. Isti par
dvaput u istom grupiranju (ili isti `Tip / *` dvaput) = **greška**: model je vrati, pločica je
ispiše crveno i crta **bez bucketa** (Tip → Podtip) — nikad ne zbraja dvaput.
Korekcija bez retka u grupiranju ide na vrh kao vlastita kriška. N/A je uvijek vlastita kriška
„nerazvrstano (N/A)" (R10), i **ne** ide u buckete.

### 10.3 Financije_all — točan config (piše ga `set_breakdown.py`, §13)

```json
{ "type": "breakdown", "title": "Kamo ide novac", "unit": "€",
  "levels": ["tip", "podtip"], "plus": "uplata", "minus": "isplata",
  "income":  { "slug": "tip", "op": "in", "values": ["Prihodi"] },
  "outside": [{ "slug": "tip", "op": "in", "values": ["Transfer"] }],
  "unclassified": ["N/A"],
  "date_axes": [{ "label": "po kupnji", "slug": null },
                { "label": "po naplati", "slug": "datum_naplate" }],
  "adjustments": [{ "label": "gotovina, nerazvrstano",
     "add":      [{ "slug": "tip", "op": "in", "values": ["Transfer"] },
                  { "slug": "podtip", "op": "in", "values": ["cash - bankomat"] }],
     "subtract": [{ "slug": "izvorplacanja", "op": "in", "values": ["Cash"] },
                  { "slug": "tip", "op": "not_in", "values": ["Transfer"] }] }],
  "grouping": "Vrsta troška" }
```

`groupings["Vrsta troška"]` = raspored iz §4.3 („Sašin raspored") + `Kuća/Osiguranje` → Povremeno
nužno + `{ bucket: "Mjesečni troškovi", adjustment: "gotovina, nerazvrstano" }`. Popis parova živi
**samo** u `set_breakdown.py` (jedan izvor); spec ga ne prepisuje.

⚠ **Gotovina „add" broji Transfer retke** koje razrez inače drži vani — namjerno: podizanje je
jedini trag gotovinske potrošnje (CLAUDE.md § Overview, S121). Podnožje „izvan razreza: Transfer"
i dalje pokazuje puni Transfer iznos; korekcija ga ne umanjuje (to su dva različita pitanja).

## 11. RPC — `sql/056_area_breakdown.sql`

```sql
rpc_area_breakdown(
  p_area_id     uuid,
  p_group_slugs text[],                 -- 1..4 dimenzije, redoslijed se čuva u g[]
  p_plus_slug   text,
  p_minus_slug  text,
  p_filters     jsonb DEFAULT '[]',     -- ista semantika kao 035 (zasad se ne koristi)
  p_date_slug   text  DEFAULT NULL,     -- NULL = event_date; inače datetime atribut
  p_date_from   date  DEFAULT NULL,     -- UKLJUČIVO
  p_date_to     date  DEFAULT NULL      -- UKLJUČIVO
) RETURNS TABLE (g text[], plus_sum numeric, minus_sum numeric, n integer, n_no_date integer)
```

- `SECURITY DEFINER`, `SET search_path = public, pg_temp`, prvo `app_can_read_area` (42501), pa
  `app_assert_slugs(area, NULL, plus, minus, filters)` + svaki `p_group_slugs[i]` kroz
  `app_slug_count > 0` + `p_date_slug` mora postojati **kao `datetime`** (novi uvjet, 22023).
  Prazan ili > 4 člana niza ⇒ 22023.
- **Leaf-only + `chain_key IS NULL`** — isti dvostruki čuvar kao `area_agg_rows` (P2 se ne zbraja).
- Vlastiti izvor redaka (ne `area_agg_rows`: ona zna jednu dimenziju i nema datumsku os). Oblik je
  izmjereni prototip: po jedan `LATERAL`/podupit po dimenziji, ključ `attribute_definition_id`
  (nikad `ILIKE`, BUG-S103), `g = ARRAY(... ORDER BY ordinality)`.
- **Datum atributa: `(value_datetime AT TIME ZONE 'UTC')::date`**, ne goli `::date`. Atribut je
  zidni sat spremljen s `+00:00` (S162); goli cast ovisi o `TimeZone` sesije i u zoni ≠ UTC
  pomakne ponoćne vrijednosti na dan prije.
- **Obje granice UKLJUČIVE i to piše u imenu** (`p_date_from`). `rpc_area_group_agg.p_from` je
  isključiv (S144 zamka) — novi RPC je ne nasljeđuje.
- Redak bez datuma u osi atributa se ne gubi tiho: ne ulazi u sume, ali se broji u `n_no_date`
  svoje grupe ⇒ pločica ispiše „N redaka bez datuma naplate". (Danas 0.)
- Grupa koju čine samo retci bez datuma vraća se s nulama i `n_no_date > 0` — inače bi broj nestao.
- Grants: `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated`.

**Izmjereno na prototipu (TEST, 07.10., `BEGIN READ ONLY`, ništa nije stvoreno):** dvije dimenzije
`tip`, `podtip`, 10/2025–09/2026: **63 grupe, ~35 ms** na serveru, **obje osi**. Zbrojevi se s
Python modelom (§8.6) slažu **u cent**: ušlo 46.972,48 · Tip neto 34.186,21 / 32.419,46 · N/A
2.110,80 / 3.054,84 (kupnja / naplata). Treća dimenzija (`izvorplacanja`) dodaje jedan podupit.

## 12. Preglednik

| file | što |
| --- | --- |
| `src/types/database.ts` | `BreakdownWidget`, `Grouping`, `AreaSettings.groupings`, unija `DashboardWidget` |
| `src/lib/overviewApi.ts` | `fetchBreakdown()` — `.rpc('rpc_area_breakdown')`, greška se baca s porukom (kao `fetchGroupAgg`), `withRetry` |
| **`src/lib/breakdownModel.ts`** | **čista funkcija, jedini izračun** (§12.1). Desktop i mobitel čitaju isti model |
| `src/components/overview/BreakdownTile.tsx` | zaglavlje, sažetak, prekidači, lista, podnožje; krug samo `≥ sm` |
| `src/components/overview/BreakdownSunburst.tsx` | `react-plotly` sunburst iz `toSunburst(model)` |
| `src/components/overview/OverviewTab.tsx` | `case 'breakdown'` |
| `src/lib/dashboardConfig.ts` | `fixupDashboardSlug` zna i breakdown slugove (`levels`, `plus`, `minus`, filtri, `date_axes`) + `groupings[*].levels` |
| `docs/help/overview.md` | odlomak o pločici (Kokin jezik: hrvatski) |

### 12.1 `breakdownModel.ts`

```ts
buildBreakdown(rows: BreakdownRow[], w: BreakdownWidget, grouping?: Grouping): BreakdownModel
// BreakdownModel = { totals: {in, out, diff}, income: Node, expense: Node,
//                    outside: {plus, minus}, nNoDate, errors: string[] }
// Node = { name, value, n, children: Node[], meta: { pair?, unsure?, special?, drill? } }
toSunburst(node): { ids, labels, parents, values, notDrawn: Array<{path, value}> }
```

- Novac **u lipama** (cijeli brojevi) kroz cijeli model, kao `splitRataAmounts` — zbroj stotinjak
  decimala nosi grešku binarnog zapisa, a invarijanta se uspoređuje u cent.
- Strana troška: redak koji nije `income`, nije `outside`, nije `unclassified` ⇒ par `levels`.
  Povrat (uplata pod Tipom troška) **neto** umanjuje svoj par (§3). Negativan par/Tip/bucket ostaje
  negativan (R8).
- `toSunburst` crta **samo pozitivne listove**, roditelj = zbroj nacrtane djece; sve izostavljeno
  ide u `notDrawn` i ispisuje se ispod kruga (R11). Lista nosi neto.
- Redoslijed djece: po iznosu silazno; posebne kriške (N/A, nesvrstano) zadnje.

### 12.2 `BreakdownTile.tsx`

- **Razdoblje = filtar** (`filter.dateFrom`/`dateTo`, uključivo). Zaglavlje ga ispisuje
  (`01.09.–30.09.2026. · iz filtra`). „All time" daje raspon do zadnjeg retka (i budućih `Planiran`
  rata, 2027.) — za „po kupnji" je to ispravno (§3: rate u mjesecu kupnje).
- Prekidači: **Troškovi | Prihodi** (zadano Troškovi), os datuma (samo kad `date_axes.length > 1`),
  ime grupiranja kao oznaka (izbornik tek kad ih bude više, R5).
- **Sklopiva** (§5): klik na naslov; stanje po pregledniku pod
  `dbScopedKey('ui:tileCollapsed:' + areaId + ':' + title)` (S140: ključ nosi bazu). Zadano otvoreno.
- Krug samo kad `matchMedia('(min-width: 640px)')`. ⚠ **Ispravak §2.2:** Plotly je ionako u paketu
  (statički import u `StructureSunburstView`, rute nisu lazy — CLAUDE.md S133), dakle mobitel ne
  štedi preuzimanje nego samo **crtanje i čitljivost**. Lazy učitavanje ostaje stavka backloga.
- Stanja: „Računam…", greška RPC-a (crveno, s porukom), greška configa (crveno, imenuje ključ),
  prazno („Nema zapisa u razdoblju").
- `loaded`/`ready` se pamti **za koji ulaz** (`loadedFor`, S145/S159), ključ ulaza = area + raspon + os.

### 12.3 Drill (§6, invarijanta 3)

Filtar nosi **jedan** uvjet ⇒ drill postoji samo gdje jedan uvjet točno opisuje ćeliju:

| redak | drill |
| --- | --- |
| Tip | `tip = X` (raspon iz filtra ostaje) |
| Podtip **jedinstven** među Tipovima | `podtip = X` |
| Podtip **dvoznačan** — danas `gorivo`, `registracija`, `popravci` (oba auta), `Koka` (Projekti i Prihodi) | ~~drill na **Tip** + toast~~ **S166: nema ↗** (Saša: toast se previdi, a strelica bi bila kopija one uz Tip); `title` kaže zašto |
| bucket, N/A, gotovina, nesvrstano | nema drilla (više uvjeta) |
| bilo što u osi „po naplati" | nema drilla — filtar ne zna raspon `Datuma naplate` (ikona + objašnjenje) |

Dvoznačnost se računa iz `validation_rules` (Podtip u > 1 popisa), ne iz koda.

## 13. Alat za config — `data-prep_tools/Financije/set_breakdown.py`

Obrazac `set_list_columns.py`: **merge, ne overwrite** (`settings` nosi `dashboard`, `automations`,
`list_columns`, `export_profiles`…).
- Piše **pločicu** (zamjenjuje widget istog `type` + `title`, ostale ne dira) i
  **`groupings["Vrsta troška"]`**. Popis bucketa je u alatu kao Python konstanta — jedini izvor.
- Provjere prije upisa (alat **staje**): slugovi postoje; isti par dvaput; par čiji Tip/Podtip nije u
  `validation_rules` (pokazuje u prazno, K-1 razred); korekcija u retku grupiranja koje nema u pločici.
- Ispis: parovi iz **podataka** (zadnjih 12 mj) koji nisu ni u jednom bucketu ⇒ „nesvrstano" — mora
  biti prazno za Financije danas.
- Zadano dry run (ispis razlike starog i novog JSON-a), `--apply`; PROD traži i `--yes-prod`.
- ⚠ **Na PROD tek POSLIJE deploya.** Stari bundle za nepoznat tip crta žuti okvir „Nepoznat tip
  pločice" (`OverviewTab` `default` grana) — Koka bi ga vidjela iznad salda.

## 14. Testovi

**Unit — `src/lib/__tests__/breakdownModel.test.mjs`** (obrazac `rataAmounts.test.mjs`, s protuprovjerom):
1. **Σ bucketa = Σ Tipova = Izašlo** u lipu, uz grupiranje i bez njega, obje strane.
   Sabotaža: model koji par u dva bucketa broji dvaput ⇒ test pada.
2. Isti par dvaput u grupiranju ⇒ `errors` neprazan i model **bez** bucketa.
3. Specifičnost: par > `Tip / *` > nesvrstano.
4. Korekcija s retkom u grupiranju ide **u** bucket; bez retka na vrh.
5. Negativan list nije u `toSunburst`, jest u `notDrawn`, i jest u `totals.out`.
6. Povrat umanjuje svoj Tip; Tip smije biti negativan.
7. `outside` nije ni u prihodu ni u trošku, a jest u podnožju.
8. Drill tablica §12.3 (dvoznačan Podtip ⇒ Tip; os naplate ⇒ ništa).
`slugRenameConfig.test.mjs`: rename `podtip` ⇒ breakdown `levels` i `groupings[*].levels` prate.

**SQL protiv Pythona — `data-prep_tools/Financije/verify_breakdown.py`:** poziva RPC service
ključem za 10/2025–09/2026 i rujan, obje osi, i uspoređuje svaku grupu s Python modelom (logika
skice) — **mora biti u cent**. Pokreće se na TEST-u poslije 056, i na PROD-u poslije Sašinog 056.

**Ručni (S16x_tests):** pločica na TEST-u, laptop i mobitel širina; brojke = §4.3 tablica (12 mj,
po kupnji / naplati); drill Tip i Podtip daje isti zbroj kao ćelija; sklapanje preživi F5; Overview
bez configa (druga Area) se ne mijenja; grantee (Saša na PROD-u) vidi pločicu.

## 15. Redoslijed izvedbe

| korak | tko | baza |
| --- | --- | --- |
| 1. `sql/056_area_breakdown.sql` + smoke upit | Claude | TEST (psql, `SUPABASE_DB_URL`) ✅ S165 |
| 2. `verify_breakdown.py` ⇒ u cent | Claude | TEST ✅ S165 |
| 3. model + unit testovi (sabotaže) → pločica → OverviewTab → fixup | Claude | — ✅ S165 |
| 4. `set_breakdown.py --apply` | Claude | TEST ✅ S165 |
| 5. ručni testovi (`npm run dev`) | Saša | TEST |
| 6. 056 u SQL editoru, `verify_breakdown.py` | Saša | PROD |
| 7. deploy (merge na `main`) | Saša | — |
| 8. `set_breakdown.py --apply --yes-prod`, `Ctrl+Shift+R` — ⚠ traži R3 na PROD-u prije (T-S164-2): alat staje jer `Kuća / Osiguranje` nije u `validation_rules` | Saša | PROD |

Procjena: jedna sesija za 1–4. Koraci 6–8 su jedan blok naredbi.

## 16. Otvoreno (tehnički, ne traži odluku prije koda)

- **F5** (Structure Excel: `AreaSettings` + `Grupiranja`) — poslije, kad se raspored ustali (R14).
  Do tada je raspored u `set_breakdown.py`; F5 ga mora moći **izvesti**, ne samo uvesti.
- **Rename opcije** (Podtip) lomi par u grupiranju tiho → do F5 to hvata `set_breakdown.py` pri
  sljedećem pokretanju; poslije F5 uvoz Structure. Rename **sluga** pokriva fixup (§12).
- Drugo grupiranje „Čiji trošak" + gorivo po kilometraži (R5, §6) — config i model ga već nose
  (`grouping` je ime), treba samo izbornik.

## 17. Izvedba S165 — što je drukčije od teksta (izmjereno)

- **`n_no_date` — koji redak bez datuma „pripada" razdoblju?** Spec nije rekao. Odluka: zamjena je
  `event_date` u razdoblju (pločica za rujan javlja rujanske retke bez datuma naplate, ne sve iz 2019.).
  Danas ih je 0. Zapisano u zaglavlju 056 i u `verify_breakdown.py` (ista zamjena na obje strane).
- **Brzina 056** (TEST, 3 dimenzije, 12 mj, na serveru): os `event_date` ~75 ms; os „po naplati" je
  prvom verzijom bila ~500 ms (svi atributi pa rez), pa ~280 ms (rez pa atributi, podupit po retku),
  pa **~85 ms** (datum JOIN-om nad svim vrijednostima atributa). Os atributa nema jeftin pred-rez jer
  rata dospijeva i godinu poslije kupnje.
- **Grupna vrijednost datuma** u 056 ide kroz `AT TIME ZONE 'UTC'` i za `to_char` (035 to nema; ondje
  datum nije dimenzija ni u jednom configu).
- **`DashboardWidget` je sada unija** ⇒ `widgets.find(w => w.type === 'balance_by_group')` u TS-u NE
  sužava tip. Svi potrošači salda (delta export/uvoz, `confirmedRowEdit`, `useRunningBalance`) idu kroz
  `isBalanceWidget` (`types/database.ts`). Python alati `dashboard.widgets` ne čitaju (izmjereno grep-om).
- **`groupings` rename:** `fixupDashboardSlug` piše `dashboard` i `groupings` u ISTOM write-u
  (`renameSlugInGroupings`); `rows[].values` su vrijednosti i ostaju netaknute.
- **Drill kad se `validation_rules` ne daju pročitati:** svaki Podtip se tretira kao dvoznačan ⇒ Podtip
  nema ↗ (S166), ostaje ↗ uz Tip. Nikad na krivi Podtip.
- **Mobitel:** lista nosi trake i na 320–400 px (uže), imena se **prelamaju** (CLAUDE.md S119: prelom,
  ne `…`). Krug od 640 px.
- **Greška RPC-a 22023/42501 se ne ponavlja** (`fetchBreakdown`): config i pristup se ponavljanjem ne
  popravljaju; ostale greške idu kroz `withRetry`.
- **E2E `S165_breakdown_tile.spec.ts`:** stvarna pločica u aplikaciji s podmetnutim RPC odgovorom
  (snimka `src/lib/__tests__/fixtures/breakdown_financije_12mj.json`) — širok i uzak ekran, prekidač osi,
  sklapanje preživi reload. E2E korisnik nije vlasnik `Financije_all`, zato podmetanje.
