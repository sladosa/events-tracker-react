# Preuređivanje strukture — spec (prijedlog prije koda)

> **Status:** prijedlog, 2026-10-20. Nastalo iz razgovora o `trening.xlsm`
> ([`TRENING_MIGRACIJA.md`](TRENING_MIGRACIJA.md)). **Sašina odluka (20.10.):** operacije
> preuređivanja dolaze **prije** uvoza treninga — *„nije moguće unaprijed sve definirati savršeno"*.
> **Odnos prema [`KLASIFIKACIJA_ODRZAVANJE_SPEC.md`](KLASIFIKACIJA_ODRZAVANJE_SPEC.md):** ondje
> ostaju kriteriji održavanja (kad spojiti, tko odlučuje — K0, K1, K3–K5); njegov **K2**
> („prepisivanje izričitim mapiranjem") ovaj spec poopćuje na sve tri razine i sve Aree.

---

## 0. Ukratko

- **Danas se zaključava sve, jer se skoro ništa ne može promijeniti jeftino.** Pravilo
  „taksonomiju zaključati PRIJE uvoza" (CLAUDE.md, S105d) je zaobilaženje ograničenja
  aplikacije, ne princip.
- **Uzrok za opcije je jedan:** tekst opcije je istodobno i oznaka i identitet — prepisan je u
  svaki redak i u još najmanje šest mjesta (§1.3). Kategorije taj problem **nemaju** (event pamti
  `category_id`, putanja se izvodi), atributi su ga **riješili** slugom (S56, S105d) — opcije su
  jedina razina koja je ostala na tekstu.
- **Prijedlog:** skup operacija preuređivanja, svaka s istim oblikom — **prebroji sva mjesta →
  pokaži → izvedi u jednoj transakciji → izmjeri**. Tekst ostaje u retcima (Excel roundtrip mora
  ostati čitljiv), ali promjena postaje **jedan potez**, ne šest ručnih.
- **Posljedica:** zaključava se samo **identitet** (Area, leaf u koji event ide, granularnost,
  `session_start`). Taksonomija, atributi i izbornici smiju se uvesti grubo i dotjerivati poslije.
- **Ostaje skupo, i to se ne može zaobići:** **dijeljenje** opcije (A → A1/A2) traži odluku po
  retku. Jeftinijim ga čine samo sačuvan izvorni tekst i pravila nad njim.

---

## 1. Što danas radi (izmjereno iz koda, 20.10.)

### 1.1 Kategorije

| Operacija | Stanje | Gdje |
| --- | --- | --- |
| Preimenovanje | ✅ ime; slug ostaje | `StructureNodeEditPanel` |
| Umetni razinu između / iznad | ✅ | `StructureAddBetweenPanel`, `StructureAddAbovePanel` |
| Ukloni međurazinu | ✅ s prijenosom atributa na djecu (merge-down) | `StructureCollapseLevelPanel` |
| Dodaj dijete **leafu koji ima evente** | ❌ blokirano (S24) | `StructureAddChildPanel:124` |
| Premjesti kategoriju pod drugog roditelja | ❌ | — (Structure uvoz: *„never moves categories"*) |
| Premjesti evente iz leafa u leaf | ❌ | Activities uvoz: `event_id` iz druge kategorije se **preskače** (`excelImport.ts:1970`) |
| Spoji dva leafa | ❌ | — |
| Obriši kategoriju s eventima | ❌ blokirano | `StructureDeleteModal` |

### 1.2 Atributi

| Operacija | Stanje | Gdje |
| --- | --- | --- |
| Preimenovanje (ime **i** slug) | ✅ s ispravkom referenci: `depends_on`, `dashboard`, `list_columns`, `automations`, `comment_template` | `StructureNodeEditPanel:1434–1483` |
| Promjena tipa (`text → number` …) | ❌ read-only čim postoje eventi; uvoz *„never changes data_type"* | panel `:16`, `structureImport.ts:6` |
| Premjesti atribut na drugu razinu lanca | ❌ (osim kao dio Collapse Level) | — |
| Spoji dva atributa | ❌ | — |
| Izvedi novi atribut iz teksta (regex) | ❌ u appu; radi se Python alatom + Excel uvozom | — |

### 1.3 Opcije izbornika

| Operacija | Stanje |
| --- | --- |
| Dodaj | ✅ „Other" (samo vlasnik) i Structure uvoz |
| Obriši | ✅ **ali ostavi siročad** — retci zadrže tekst, izbornik ga više ne nudi (K-spec §2, §7) |
| Preimenuj | ❌ panel mijenja **samo izbornik** (S167 zamka) — retci i config ostaju na starom |
| Spoji | ❌ |
| Premjesti (Podtip pod drugi Tip) | ❌ — mijenja i **Tip na svakom retku** |
| Jednokratno | `Financije/fix_kuca_popravci_S167.py` — predložak, ne alat |

**Gdje sve živi tekst jedne opcije** (K-spec §4 + ovaj pregled — svako mjesto je put kojim
preimenovanje tiho promaši):

1. `event_attributes.value_text` — svaki redak;
2. `attribute_definitions.validation_rules` — `suggest`, **ključ** `depends_on.options_map`
   (Tip je `WhenValue` za Podtip), `default_map`;
3. `areas.settings` — `automations` (`date_map` ključevi `Visa`/`Mastercard`, `rata.date_map`,
   `remainder_map`), `dashboard` filtri i `split`, `due` (`baskets[k].text`, `settle`),
   `groupings` (bucketi), `list_columns.map`, `export_profiles` filtri;
4. `balance_anchors.group_value` — **sidro salda je vezano uz tekst računa**: preimenovan
   `Racun` bez sidara = pločica bez potvrđenog stanja, bez greške;
5. `activity_presets` — `default_attributes` i `filter_state`;
6. `categories.settings.comment_template` (samo ako template nosi doslovnu vrijednost);
7. **Python rječnici** (`pravila_trgovca.py`, `visa_uvoz_izvoda.KLASA`, `set_breakdown.py` …) —
   operacija ih ne može pisati, ali ih mora **prijaviti** (grep).

---

## 2. Rupe — što treba, poredano po koristi

Oznake: **O** = opcija, **A** = atribut, **K** = kategorija. Stupac *Tko treba* kaže je li rupa
izmjerena u Financijama ili je predviđena za DIARY.

| # | Operacija | Tko treba | Napomena |
| --- | --- | --- | --- |
| **O1** | Preimenuj opciju | Financije (Tip/Podtip), DIARY | sva mjesta iz §1.3 |
| **O2** | Spoji opcije A, B → C | Financije (rijetki parovi), DIARY (`x-TRAIN`/`X-TRAIN`, `SICK` varijante) | = O1 nad više izvora |
| **O3** | Premjesti opciju (Podtip pod drugi Tip) | Financije | mijenja Tip na retcima koji nose taj Podtip |
| **O4** | Pomoć pri dijeljenju A → A1/A2 | Financije, DIARY | **ne automatski**: popis redaka + izvorni tekst + pravila ⇒ Excel ⇒ uvoz |
| **O5** | **Izdvoji os u novi atribut** (npr. osoba iz `Audible_Koka` → Podtip `Audible` + `Namjena = Koka`) | Financije (§8), DIARY (`K` → vrsta / tip treninga / utrka) | jeftino kad je podatak **u imenu** (sufiks, Tip auta); inače postaje O4 |
| **O6** | Traženje u izborniku po oba nivoa (tipkaš „pok" ⇒ `Razno / Pokloni`, Tip se popuni sam) | Financije (Koka na mobitelu) | **nije preuređivanje** nego dorada forme — ali rješava „ne sjećam se gdje je" bez diranja ijednog retka |
| **A1** | Promijeni tip atributa s konverzijom | DIARY (uvesti kao text, poslije u broj) | izvještaj o retcima koji se ne daju pretvoriti; ne briše ih |
| **A2** | Izvedi atribut iz teksta | DIARY (`O` → puls/kcal/TE, `AM` → san/HRV/bb, vrijeme i mjesto iz `M`) | ponovljivo; izvornik ostaje |
| **A3** | Premjesti atribut na drugu razinu lanca | DIARY, Fitness | P2: vrijednost seli s leaf eventa na parent event iste sesije (ili obrnuto); logika postoji u Collapse Level |
| **A4** | Spoji dva atributa | DIARY (`I` era 2 + `mood` u `Fitness`) | sukob kad su oba popunjena ⇒ prijava, P3 |
| **K1** | Dodaj dijete leafu s eventima | DIARY, Fitness | postojeći eventi idu u novo dijete (npr. „Ostalo") — skida S24 blokadu **sigurno** |
| **K2** | Premjesti evente iz leafa u leaf (po filtru) | DIARY | P2 roditelji se grade iznova (`parentEventLoader`) |
| **K3** | Premjesti kategoriju pod drugog roditelja | Fitness | P2 roditelji cijelog podstabla |
| **K4** | Atribut ↔ podkategorije | DIARY („kategorije koje ne koristimo baš") | vrijednosti atributa postaju leafovi i obrnuto; najveća operacija |

---

## 3. Zajednički oblik svake operacije (invarijante)

1. **Prebroji prije pisanja.** Prvi korak je uvijek suhi prolaz koji ispiše **sva** mjesta iz
   §1.3 s brojem pogođenih (*„247 redaka · 2 shortcuta · 1 bucket · 1 sidro · `pravila_trgovca.py`
   redak 41"*). Pouka S138: „promijenili smo pravilo" je tvrdnja o jednom mjestu.
2. **Jedna transakcija.** Postgres funkcija, ne petlja u pregledniku. Petlja koja padne napola
   ostavlja retke bez atributa uz poruku o uspjehu (S125, S134 — isti razred).
3. **Samo vlasnik Aree** (S133, `docs/RLS_INVENTORY.md`). Funkcija to provjerava sama; RLS je
   druga brana.
4. **Izmjeri poslije.** Rezultat ponovno broji: stari tekst = 0 mjesta, novi = očekivano.
   „Uspjelo" znači izmjereno, ne „nije bacilo grešku".
5. **Zapis i povrat.** Svaka operacija sprema **prijašnje stanje** pogođenih redaka (tablica
   zapisa operacija) ⇒ poništavanje bez restorea cijele baze. Operacije diraju tisuće redaka
   odjednom — jeftino osiguranje (P2).
6. **Excel ne izražava preimenovanje** (K-spec §7): „nema `A`, ima `B`" je i preimenovanje i
   brisanje + nova opcija. Zato preuređivanje ide **izričitim mapiranjem**, nikad pogađanjem
   iz razlike dvaju Structure fileova.
7. **TEST prvo, s kopijom PROD-a** (`prod_to_test.py`), i `rls_probe.py` ako funkcija dira prava.

---

## 4. Dva ulaza, jedna jezgra (prijedlog)

- **Panel u Structure tabu** — jedna operacija, s pregledom iz §3.1. Za povremeno.
- **Sheet `Preuređivanje` u Structure Excelu** — popis redaka `operacija | atribut | staro | novo`,
  pregled u modalu prije primjene. Za **čišćenje u seriji**, što je upravo posao nakon
  grubog uvoza DIARY-ja — i drži Sašin princip „sve ide importom".

Obje zovu istu funkciju u bazi; razlikuju se samo po tome odakle dolazi popis.

---

## 5. Što ostaje skupo (i zašto se ne treba pretvarati da nije)

- **Dijeljenje** (O4) — nova informacija, odluka po retku. Pravila po trgovcu daju 98 % na
  Financijama (S174), ali samo gdje postoji izvorni tekst; 2023. ga nema.
- **Reklasifikacija bez dokaza** — ista stvar s druge strane: zato DIARY izvornik (`M`, `O`,
  sirovi `K`, `AM`) ostaje **uvijek** u bazi (`TRENING_MIGRACIJA.md` §3.3).
- **Pravi identitet opcija** (ID u retku umjesto teksta) — bio bi trajno rješenje za O1–O3, ali
  dira sve što čita `value_text` (filtri, lista, Excel u oba smjera, RPC-ovi, Python alati) i
  Excel čini nečitljivim bez prijevoda. **Ne predlaže se**; §3 daje većinu koristi uz djelić
  cijene. Vraća se na stol samo ako O1–O3 postanu česti.

---

## 6. Prijedlog redoslijeda

| Faza | Sadržaj | Prvi korisnik | Zašto tim redom |
| --- | --- | --- | --- |
| **F1** | Jezgra (§3: brojanje, transakcija, zapis/povrat) + **O1–O3, O5** (+ O6 kao dorada forme) | Financije (Tip/Podtip, bucketi — §8) | najčešća potreba, sva mjesta poznata, izmjerljivo na stvarnim podacima |
| **F2** | **A1, A2, A4** + sheet `Preuređivanje` | DIARY | omogućuje „uvezi grubo, dotjeraj poslije" |
| — | **Uvoz DIARY-ja** (sirovo, jednostavna struktura) | — | može nakon F2 |
| **F3** | **K1, K2, A3** | DIARY, Fitness | kategorije se dotjeruju kad su podaci već unutra i vidi se što treba |
| **F4** | **K3, K4** | po potrebi | najveće, najrjeđe |

---

## 7. Pitanja za Sašu

1. **Ulaz:** panel, Excel sheet ili oboje (preporuka: oboje nad jednom jezgrom; sheet prvi, jer
   je čišćenje serijski posao)?
2. **Povrat:** tablica zapisa operacija s prijašnjim stanjem (preporuka) ili je dovoljan
   `backup_db.py` prije svake operacije?
3. **A2 (izvođenje iz teksta):** u aplikaciji, ili ostaje Python alat + Excel uvoz? Regex se
   piše iterativno, a to je bliže alatu nego formi — preporuka: Python prvo, app tek ako se
   ponavlja.
4. **Financije_all je Kokina Area** ⇒ F1 nad njom izvodi **Koka** (vlasništvo, S133). Je li to u
   redu, ili da operacije nad strukturom smije pokrenuti i alat sa service ključem (kao danas
   `fix_*.py`), uz tvoju potvrdu?
5. **Što konkretno ne valja u Tip/Podtip i bucketima?** Popis želja (preimenovanja, spajanja,
   premještanja) je prvi test F1 — i pokazuje treba li O4 (dijeljenje) već u F1.
   *(Djelomično odgovoreno 20.10. — v. §8.)*

### 7.1 Sašini odgovori (20.10.)

| # | Odgovor | Što to znači |
| --- | --- | --- |
| 1 | sheet prvo | F1 ulaz je sheet `Preuređivanje` u Structure Excelu; panel kasnije |
| 2 | zapis operacija | za **svaki** dirnuti redak alat sprema **„prije"** (stara vrijednost) i **„poslije"** (nova). „Poništi operaciju" vrati sve „prije" vrijednosti — i nakon više dana, bez vraćanja cijele baze |
| 3 | pitanje: što je regex? | v. 7.2 |
| 4 | **smije** alat sa service ključem | v. 7.3 — i pitanje kako to ide s retcima write-grantee-ja |
| 5 | puno nedosljednosti, „posljedica prekompleksnog sistema" — izmjeriti | izmjereno, §8.1 |

### 7.2 Što je regex i gdje se puštaju Python alati (objašnjenje)

**Regex** (*regular expression*) je **uzorak za traženje teksta**. Umjesto „nađi točno `HR 110(134)`"
kaže se „nađi `HR`, pa broj, pa broj u zagradi" — i isti uzorak pogodi `HR 99(127)`,
`HR 128(137)`… u svih ~3.000 redaka, i izvuče oba broja. Tako bi se iz kolone `O` dobili
prosječni i maksimalni puls kao brojevi. Uzorak se piše **iterativno**: probaš, pogledaš koje
retke nije pogodio, popraviš — zato je bliži alatu nego formi u aplikaciji.

**Python alati se puštaju u terminalu** na tvom laptopu (`Tools\run.bat <alat>.py`):
- na **TEST**-u ih puštam ja;
- na **PROD**-u upise puštaš **ti** (auto-mode meni ih blokira), ili alat napravi **Excel koji
  uvoziš** u aplikaciji (obrazac koji je radio za Financije — vidiš svaku promjenu prije Apply).

### 7.3 Service ključ i retci write-grantee-ja

**Kako je danas u aplikaciji** (`Financije_all`, vlasnica Koka, Saša write-grantee):
- svaki redak ima **autora** (`user_id`) — Koka ili Saša;
- **promjena Tipa/Podtipa ne mijenja autora** — mijenja samo vrijednost atributa retka;
- kroz aplikaciju tuđi redak smije ispraviti **samo vlasnica Aree** (`sql/043`); autor ostaje,
  a `edited_by` zapiše tko je ispravljao. Saša kao grantee **ne može** ispraviti Kokin redak.

**Alat sa service ključem** zaobilazi sva prava (RLS) — zato **sam** mora držati ista pravila:
1. **nikad ne dira `user_id`** (autor ostaje); mijenja samo vrijednosti atributa i config;
2. mijenja vrijednost **na mjestu** (UPDATE), nikad „obriši pa upiši" — Edit tok aplikacije
   briše i ponovno upisuje sve atribute retka, i to je već jednom ostavilo redak bez atributa;
3. **zapisuje tko je pokrenuo operaciju** (u zapisu operacija iz 7.1/2), kad i zašto;
4. ⚠ **Struktura `Financije_all` je Kokina** (Sašina odluka S133). Pokretanje alata nad njom
   je **svjesna iznimka** — Koka treba znati i pristati, jer mijenja ono što ona vidi u
   izborniku svaki dan.

---

## 8. Financije — prvi konkretan zadatak (Saša 20.10., izmjereno na PROD-u, samo čitanje)

**Što si rekao:** Podtip se teško nađe (npr. `Pokloni`); u bucketima se iste stvari pojavljuju
dvaput; **namjena** (zajedničko, Koka, Saša, Kućište) nije ista vrsta podjele kao Domaćinstvo,
Kuća, Prijevoz.

**Što baza pokazuje** (18 Tipova, 69 parova Tip/Podtip):

- **Osoba je ugrađena u imena — na tri načina:**
  - **14 Podtipova** nosi osobu: `Audible_Koka` / `Audible_Sasa`, `Kindle_Koka`,
    `Sport_Koka` / `Sport_Sasa`, `Medical_Koka` / `Medical_Sasa`, `Lječnička komora_Koka`,
    `Odjeća/obuća/ostalo_Koka` / `_Sasa`, `Prihodi / Koka` / `Saša`, `Projekti / Koka` / `Sasa`;
  - **auti su dva Tipa** (`auto C5`, `auto Lacetti`) s **istim** Podtipovima (gorivo,
    registracija, popravci) — uz to postoji i Tip `Prijevoz`;
  - **bucketi** `Koka razno`, `Saša razno`, `Kućište · Nenin novac` stoje u istom popisu kao
    `Mjesečni troškovi` i `Kvaliteta života`.
- **Ista stvar na dva mjesta:** `Kuća / Osiguranje` uz Tip `Osiguranje`.
- **Teško naći:** `Pokloni` je pod `Razno` (bucket ga šalje u „Putovanja i pokloni").

**Jednostavno rečeno:** u jednom popisu žive **dva pitanja** — *„na što je novac otišao"*
(Kuća, Prijevoz, Zabava…) i *„za koga / čiji je"* (zajedničko, Koka, Saša, Kućište). Zato se
stvari ponavljaju (Audible dvaput, auto dvaput) i zato bucketi izgledaju neuredno.

### 8.1 Mjerenje nedosljednosti (PROD, 20.10., 5.443 transakcije, samo čitanje)

**Higijena popisa je dobra** — to nije problem:
- 0 vrijednosti u retcima koje nema u izborniku (nema siročadi);
- 1 par bez ijednog retka (`Informatika / Odrzavanje i servis`), 9 rijetkih parova (< 5 redaka);
- 1 skoro-isti naziv: Podtip **`Sasa`** (`Projekti`) i **`Saša`** (`Prihodi`);
- N/A: 2023. 585/1.133 · 2024. 476/1.605 · 2025. 330/1.462 · **2026. 1/1.243** — novi unos je
  uredan; N/A je stara povijest (T36).

**Nedosljednost je u RAZVRSTAVANJU — isti trgovac, različit par.** Od 136 trgovaca s ≥ 4
retka, 36 je razvrstano na više načina. (Bankovni opći tekstovi poput `KREDITNI TRANSFER` i
`KEKS PAY` nisu trgovci — izbačeni iz brojke ispod.) Uzroci, poredani:

| Uzrok | Primjeri (redaka) | Je li greška? |
| --- | --- | --- |
| **Osoba u imenu Podtipa** | `AUDIBLE` → `Audible_Sasa` 22 / `_Koka` 13 · `GRADSKA LJEKARNA` → `Medical_Sasa` 18 / `_Koka` 2 · `RATA AUTO` → C5 21 / Lacetti 3 | ne — **dvije osi u jednom polju** |
| **`Projekti / Sasa` kao „Sašine stvari"** | `SUPER KONZUM` → `Projekti/Sasa` 30 / `Hrana i ostalo` 14 · `BIBERON RESTORAN` → `Projekti/Sasa` 56 | ne — isto: **namjena** prerušena u Tip |
| **Dva Podtipa koja znače skoro isto** | `DECATHLON` → `Odjeća/obuća_Sasa` 10 / `Sport_Sasa` 7 · `ANJA` → `Prihodi/Povrat Anja` 32 / `Transfer/Anja` 16 | **da** — preklapanje značenja |
| Trgovac stvarno prodaje više stvari | `APPLE` → Cloud backup 57 / HBOmax 6 · `MALL MEGA` | ne |
| Prave greške | `NAKNADA KREDITNI` → `Kuća/Osiguranje` 1 · `MACGREGOR` → `auto C5/registracija` 15 / `Prihodi/Saša` 1 | da, ali **malo** |

**„Iste stvari dvaput" u razrezu — izmjereno:** bucketi su **treća os** (koliko je trošak
nužan / čest), pa se jedan Tip raspe po više bucketa: **Zdravlje → 4 bucketa**, **Razno → 4**,
**Kuća → 3**, Domaćinstvo, Informatika, Zabava → po 2, Projekti → `Koka razno` / `Saša razno`.

**Zaključak jednostavno:** sustav nije prekompleksan zbog broja opcija (69 parova, uredan
popis), nego zato što **tri različita pitanja** žive u dva polja i bucketima:

1. **na što** je novac otišao (Kuća, Prijevoz, Zabava…) — Tip/Podtip;
2. **za koga / čiji** je (zajedničko, Koka, Saša, Kućište) — danas u imenima Podtipova i u
   `Projekti`;
3. **kakav je to trošak** (mjesečni, povremeno nužan, kvaliteta života) — bucketi.

Kad se ta tri razdvoje, većina „nedosljednosti" nestane sama, a ostane mali broj pravih
odluka (Decathlon, Anja, Konzum).

### 8.2 Prijedlog (za razgovor s Kokom — pitanje je njeno)

1. Novi atribut **`Namjena`**: Zajedničko · Koka · Saša · Kućište (· Nena?).
2. **O5** ga popuni **sam** gdje je podatak u imenu: `Audible_Koka` → Podtip `Audible` +
   Namjena `Koka`; `Sport_Sasa` → `Sport` + `Saša`; `Projekti / Sasa` → Namjena `Saša` (a Tip po
   tome što je kupljeno — **to** su odluke po retku: Konzum, Biberon…). Ostali retci dobiju
   zadano (npr. Zajedničko) — mijenja se samo gdje zadano nije točno.
3. **Auti — ispravak ranijeg prijedloga:** auto **ostaje Tip** (`auto C5`, `auto Lacetti`).
   „Koliko košta koji auto" je pitanje **na što**, pa ponavljanje Podtipova (gorivo, registracija,
   popravci) tu nije greška. Namjena je zasebna: **Lacetti → Saša**; **C5 → Koka**, a na
   **putovanjima → Zajedničko** (Saša 20.10.). Kad periodi postoje (`Life_Sasa`), „putovanje" se
   može prepoznati po razdoblju — dotad ručno.
4. Riješiti **preklapanja** (Odjeća vs Sport, Povrat vs Transfer, `Kuća/Osiguranje` vs
   `Osiguranje`) i **`Sasa`/`Saša`** — O1/O2.
5. **O6** (traženje u izborniku) neovisno o svemu — Koka utipka „pok" i dobije `Razno / Pokloni`.

### 8.3 Kako se prikazuje Namjena i kako se definiraju bucketi

**Bucketi danas:** `areas.settings.groupings["Vrsta troška"]` — popis redaka *bucket ← (Tip, Podtip)*
ili *bucket ← (Tip, \*)*. Pravila: točan par pobjeđuje `Tip/*`; što ne pogodi ništa ide u
`nesvrstano`; `Transfer` i `Investicije` su **izvan razreza**. Mijenjalo se skriptom
`set_breakdown.py`; **od S175** (na `test-branch`, još ne na PROD-u) i kroz sheet `AreaSettings`
u Structure Excelu — ali tamo je svaki podatak jedan redak s putanjom
(`groupings.Vrsta troška.rows[3].bucket`), što je za uređivanje bucketa **nespretno**. Kandidat
za poslije: vlastiti sheet `Bucketi` (*bucket | Tip | Podtip*).

**Prijedlog prikaza Namjene:**
- **Unos (mobitel):** polje `Namjena` ispod Podtipa, sa zadanom vrijednošću (Zajedničko);
  za auto pravilo zadaje samo (Lacetti → Saša, C5 → Koka).
- **Lista:** po želji kratka oznaka (`Z`/`K`/`S`) kroz postojeći `map` kolone liste.
- **„Kamo ide novac":** prekidač na vrhu pločice **Bucketi | Namjena** (i možda **Tip**).
  Na **velikom ekranu** krug (unutra os, vani Tip), na **malom** samo popis s iznosima — krug se
  ondje ionako ne crta (≥ 640 px). ⚠ Danas pločica zna **jedno** grupiranje (RAZREZ R5) i
  razine su par `[tip, podtip]` — prekidač je **mala, nova dorada koda**, ne samo config.

⚠ Prije izvedbe: saldo se ne miče (Tip/Podtip nisu u filtru salda), ali **pravila trgovca**,
**rječnik `Izvod opis`** i **bucketi** nose stara imena — upravo mjesta iz §1.3 koja jezgra mora
prebrojati. Zato je ovo dobar **prvi test** cijelog alata.
