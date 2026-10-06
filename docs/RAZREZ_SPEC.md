# Kamo ide novac — pločica razreza i grupiranja u buckete (prijedlog prije koda, S163)

> **Status: PRIJEDLOG, ništa nije izgrađeno.** Nastavak otvorene niti `OVERVIEW_TAB_SPEC.md`
> §2.19 („Saša — analitika: koliko je potrošeno po Tip/Podtip"). Nastao razgovorom 2026-10-06.
> Odluke R1–R9 (§9) čekaju Sašu; ono što je u razgovoru već dogovoreno označeno je ✅.
> Brojke u §8 izmjerene su na TEST-u (kopija PROD-a od 01.10.2026.), razdoblje **10/2025–09/2026**.

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

Na mobitelu nema Plotlyja (4,9 MB) i ne gubi se ništa.

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
| **Kućište investicije** | **nijedan par** — samo kroz iznimku na retku (faza 2) | — |
| **Luksuzna potrošnja** | Putovanja/* · Domaćinstvo/Kave/jelo vani ❓ · Zabava/Kino/Kazalište/Muzeji, Wellness · Razno/Temu ❓ · Razno/Pokloni ❓ | 6.333,83 |
| **ostaje nesvrstano** (treba ti bucket ili svjesno „ostalo") | Zdravlje/Medical_* · Razno/Odjeća/obuća_* · Razno/Razno, sitnice · auto */popravci · Informatika/Hardver · Projekti/* · Advokati/Ostavine · Razno bez Podtipa · Investicije/* (financijske, ≠ kuća; 0 u 12 mj) · **Kuća/Povrat Zoran, Povrat Nataša** ❓ (samo uplate, neto −889,18 — kamo god idu, smanjuju taj bucket) | 6.089,84 |
| **izvan razreza** | Transfer/* · Prihodi/* (druga strana) · N/A (vlastiti redak „nerazvrstano") | — |

Iz rasporeda se vidi da će vjerojatno trebati **peti bucket** („Zdravlje i ostalo nužno" ili
„Povremeni troškovi") — inače „nesvrstano" ostaje trajno velik, a trajno velik „nesvrstano"
se prestane čitati.

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

## 7. Redoslijed

| faza | što | veličina |
| --- | --- | --- |
| **R-F0** | Ispravak 50.000 € (§8.1) i odluka o bucketima — **podaci, ne kod** | XS |
| **R-F1** | **F5:** `AreaSettings` sheet (Structure Excel) + sheet `Grupiranja`; uvoz brani dupli par u grupiranju i javlja par koji ne postoji | M |
| **R-F2** | Migracija: RPC razreza (§11) — više razina grupiranja + os datuma | S–M |
| **R-F3** | Pločica `breakdown`: sažetak, prekidači, sunburst + tablica, trake na mobitelu, drill na Podtip | M |
| **R-F4** | Iznimka na retku (`Namjena`) — Kućište | S |

## 8. Nalazi iz mjerenja (TEST = PROD od 01.10., 10/2025–09/2026)

### 8.1 Redak od 50.000 € — prolazna stavka upisana kao prihod i trošak

| datum | Tip / Podtip | iznos | stvarno |
| --- | --- | --- | --- |
| 10.04.2026. | **Prihodi / Koka** | uplata 50.000,00 | Nenin poklon Igoru stigao na Kokin račun |
| 18.04.2026. | **N/A** | isplata 50.000,00 | Koka proslijedila Igoru |

Posljedica bez ispravka: Kokini prihodi 76.723,22 umjesto ~26.700, a N/A trošak 54.472,71
umjesto ~4.470 — svaki godišnji prikaz bi lagao u oba smjera.
**Prijedlog:** oba retka `Tip = Transfer`, `Podtip = Nena` — **Podtip već postoji** (1 redak),
dakle bez promjene strukture. Saldo se ne miče (oba su `Izvor = Racun`). Ispravak ide kao
mali app Excel za uvoz (2 retka, kol. G = autor retka).

### 8.2 Prihodi po Podtipu = po osobi

Koka 76.723,22 (s 50.000 iz §8.1) · Saša 15.299,26 · Povrat Anja 4.950,00 — 67 redaka.
Uz to `Transfer / Anja` 655,00 i `Transfer / Natasa` 838,00 uplata: ista vrsta novca (netko
vraća) živi pod dva Tipa. Ne lomi pločicu, ali je kandidat za održavanje klasifikacije.

### 8.3 Nerazvrstano

`N/A` + prazan Podtip: **1.501** redak ukupno, **109** u 12 mj (54.162,89 s retkom iz §8.1,
bez njega ~4.160). Najviše 10–12/2025 (16 + 19 + 42 retka).

### 8.4 Kućište nema svoj Tip ni Podtip

13 redaka s „Kućište" u komentaru: Domaćinstvo/Hrana (6), Kuća/Voda (3), Porezi (2), Razno
bez Podtipa (1 — „Pločice za Kućište" 299,39), N/A (1). ⇒ bucket „Kućište investicije"
nije izrazljiv parovima (§4.2).

### 8.5 Inventar

**68** parova Tip/Podtip u **18** Tipova; **62** korišteno u zadnjih 12 mj. Nekorišteni:
Investicije/* (2), Osiguranje/Zivotno, Projekti/Koka, auto C5/leasing, Transfer/Nena.

## 9. Odluke za Sašu

| # | pitanje | prijedlog |
| --- | --- | --- |
| **R1** | 50.000 € (§8.1): oba retka `Transfer / Nena`? | **da** — Podtip postoji, saldo se ne miče |
| **R2** | Raspored parova u §4.3 — ispravi/potvrdi; treba li **peti** bucket za nužno-povremeno (zdravlje, odjeća, popravci auta)? | peti bucket, inače „nesvrstano" ostaje ~6.100 |
| **R3** | `Kuća/Popravci, održavanje, osiguranje` miješa mjesečno (osiguranje) i investiciju — razdvojiti Podtip (Kokina odluka) ili čekati iznimku na retku (R-F4)? | **razdvojiti Podtip** ako Koka pristane — jeftinije od iznimke na svakom retku |
| **R4** | Kućište: bucket samo za **investicije** (pločice, radovi) ili **sav** trošak Kućišta (i Studenac, voda, porez)? | o tome ovisi je li `Namjena` bucket ili zasebno grupiranje „Lokacija" |
| **R5** | Jedno grupiranje („Vrsta troška") ili odmah i drugo („Čiji trošak": Koka / Saša / zajedničko)? | **jedno** za prvu verziju |
| **R6** | Prihodi „iz čega" (mirovina, plaća…) — mijenjati Podtipove pod `Prihodi`? | **ne sada** — osoba je dovoljan prvi odgovor |
| **R7** | Zadana os datuma: po kupnji? | **da** (D1b) |
| **R8** | `Porezi` negativni kad je povrat veći od plaćenog — prikazati kao negativan trošak? | **da**, s oznakom „povrat > trošak" |
| **R9** | Redoslijed §7: F5 prvi, pa RPC, pa pločica? | **da** — bez F5 svaka nova pločica znači SQL koji pokrećeš ti |

---

# DIO 2 — tehnički (za Claudea)

## 10. Config

Pločica — novi član rječnika `DashboardWidget` (`src/types/database.ts`; rječnik je u kodu
namjerno, §2.15):

```ts
export interface BreakdownWidget {
  type: 'breakdown';
  title: string;
  /** Razine ispod bucketa, npr. ['tip', 'podtip']. */
  levels: string[];
  plus: string;            // 'uplata'
  minus: string;           // 'isplata'
  /** Strana „Prihodi": uvjet koji redak čini prihodom. */
  income: WidgetFilter;    // { slug: 'tip', op: 'in', values: ['Prihodi'] }
  /** Izvan razreza, ali iznos se prikazuje (Transfer). */
  outside?: WidgetFilter[];
  /** Vrijednosti koje znače „nerazvrstano" (N/A); prazno se uvijek tako broji. */
  unclassified?: string[];
  /** Osi datuma; prva je zadana. Bez drugog člana nema prekidača. */
  date_axes?: Array<{ label: string; slug: string | null }>; // null = event_date
  /** Korekcijski retci (gotovina): Σ(add) − Σ(subtract), kao vlastiti bucket. */
  adjustments?: Array<{ label: string; add: WidgetFilter[]; subtract: WidgetFilter[] }>;
  /** Imena grupiranja iz `areas.settings.groupings` koja pločica nudi. */
  groupings?: string[];
  unit?: string;
}
```

Grupiranja — **zaseban ključ** `areas.settings.groupings` (ne unutar pločice: više pločica,
i budući filtar, smiju koristiti isto grupiranje):

```ts
type Groupings = Record<string /*grupiranje*/, {
  levels: [string, string];                     // ['tip', 'podtip'] — što parovi znače
  rows: Array<{ bucket: string; values: [string, string] }>; // values[1] može biti '*'
  row_override?: string;                        // faza R-F4: slug atributa „Namjena"
}>;
```

⚠ **Ključevi su slugovi i vrijednosti opcija** — rename sluga mora povući fixup
(`fixupAutomationsSlug` / `dashboardConfig` obitelj, S162), inače bucketi tiho pokazuju u
prazno. **Rename opcije** (Podtip) lomi par isto tako — Structure uvoz mora javiti par u
`Grupiranja` koji pokazuje na opciju koje više nema (isti razred kao K-1, S160).

## 11. RPC

Novi `rpc_area_breakdown` (stari `rpc_area_group_agg` ostaje za saldo — drukčija semantika
`p_from`, v. dolje):

```
rpc_area_breakdown(
  p_area_id uuid, p_group_slugs text[],     -- ['tip','podtip'] (+ override u R-F4)
  p_plus_slug text, p_minus_slug text, p_filters jsonb,
  p_date_slug text,                         -- NULL = event_date; inače value_datetime::date
  p_date_from date, p_date_to date          -- OBA UKLJUČIVA
) RETURNS TABLE (g text[], plus_sum numeric, minus_sum numeric, n int, n_no_date int)
```

- `SECURITY DEFINER` + `app_can_read_area` (isto kao 035); `app_assert_slugs` proširiti na niz.
- **P2 roditelji se nikad ne zbrajaju** (leaf-only, kao `area_agg_rows`).
- ⚠ **Granice su obje UKLJUČIVE i to piše u imenu** (`p_date_from`). `rpc_area_group_agg.p_from`
  je **isključiv** (S144 zamka: ime se čita kao „od", pa provjera s danom poslije ispusti dan).
  Razdoblje iz filtra je uključivo s obje strane; novi RPC ne smije naslijediti tu zamku.
- `datetime` je **zidni sat** (S162): `value_datetime::date` daje dan koji je upisan, jer baza
  drži iste znamenke uz `+00:00`. Ne pretvarati zonu.
- U osi `Datum naplate` redak **bez** tog atributa se ne gubi tiho: `n_no_date` ⇒ pločica
  ispiše „N redaka bez datuma naplate".
- Mapiranje parova u buckete radi **preglednik** nad rezultatom (≤ ~100 redaka) — agregacija
  ostaje u Postgresu (pravilo iz CLAUDE.md § Što aplikacija zna raditi), samo preslikavanje
  imena ne. Zato bucketi ne traže migraciju.

## 12. Invarijante (testovi)

1. **Σ bucketa = Σ Tipova = ukupno** (uz nesvrstano, bez `outside`) — za svako grupiranje,
   obje osi datuma. Sabotaža: par u dva bucketa ⇒ test pada.
2. Uvoz `Grupiranja` **staje** na isti par dvaput u istom grupiranju (§4.2).
3. Drill na Podtip daje u Activities **isti** zbroj kao ćelija pločice (os „po kupnji").
   ⚠ U osi „po naplati" drill ne može izraziti Podtip **i** raspon `Datum naplate` (filtar nosi
   jedan uvjet) ⇒ drill se u toj osi **ne nudi**, uz objašnjenje — drill koji vodi na druge
   retke gori je od izostanka.
4. Gotovinski korekcijski redak: Σ podizanja − Σ Cash troškova, izmjereno protiv Python
   brojanja na istom razdoblju.
5. Mobilni i desktop prikaz čitaju **isti** izračunati model (jedna funkcija), crtaju dva
   crteža — test nad modelom, ne nad crtežom.
