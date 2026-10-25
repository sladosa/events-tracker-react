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

**✅ ODLUČENO 20.10. — Koka se slaže s prijedlozima 1–5** (Namjena kao zaseban atribut, O5
popunjava gdje je osoba u imenu, auti ostaju Tip, preklapanja se rješavaju, traženje u izborniku).

**Još otvoreno — sitni izbori, svaki s prijedlogom** (potvrđuju se u suhom prolazu alata, kad se
vide brojke; ne traže zaseban razgovor):

| Izbor | Prijedlog | Zašto |
| --- | --- | --- |
| Vrijednosti `Namjena` | Zajedničko · Koka · Saša · Kućište | „Nena" ostaje pod Kućište (bucket `Kućište · Nenin novac` već ih spaja) |
| Zadana vrijednost | Zajedničko | najčešći slučaj; mijenja se samo iznimka |
| `Decathlon`: Odjeća vs Sport | `Zdravlje / Sport` (+ Namjena) | sportska oprema; `Odjeća` ostaje za svakodnevnu |
| `Anja`: `Prihodi / Povrat Anja` vs `Transfer / Anja` | ~~Transfer~~ → **ostaje Prihod** (Saša 22.10.: *„prihod svaki mjesec"*) | izmjereno 22.10.: `Povrat Anja` = 46 mjesečnih rata `NN/96` po 450 € (Σ 20.250 €); `Transfer / Anja` = 29 povrata za sitne zajedničke kupnje (kapa, alat, karte). **Razlika je smislena** — ostaju oba. ⚠ **Jedna prava greška:** 25.09.2026. `Rata 86/96` 450 € stoji kao `Transfer / Anja` ⇒ treba `Prihodi / Povrat Anja` |
| **Prihodi po osobi** (Saša 22.10.: Koka · Saša · Ostalo) | **os Namjena**, ne bucketi | Podtipovi `Prihodi / Koka` (111, 101.312 €) i `Saša` (134, 71.026 €) **već jesu** namjena. Nakon O5: Podtip = **izvor** (plaća, mirovina, honorar, povrat Anja…), Namjena = čiji. Prekidač Bucketi \| Namjena tada daje Koka / Saša / Zajedničko i na Prihodima. (Razrez danas buckete primjenjuje **samo na troškove** — `breakdownModel.ts`.) |
| **Nenin novac** (Saša 22.10.) | v. ispod | izmjereno 22.10. na PROD snimci |

**Nenin novac — izmjereno i razjašnjeno (Saša 22.10.):**

- **50.000 € je prolaz, ne prihod:** Nena → Koka (10.04.2026., *„Poklon od majke kćeri"*) → Igor
  (18.04.2026., isti iznos, prijenos u inozemstvo) — poklon Igoru za stan. Oba retka su
  `Transfer / Nena` ⇒ izvan razreza, neto 0. **Već je ispravno — ne dira se.**
- **„7.000 + 5.000" su stvarni Nenin fond:** uplate od Nevenke 25.07. (7.000 €) i 28.07.2026.
  (5.000 €) — **ali stoje kao `Prihodi / Koka`**, pa Kokin prihod 2026. izgleda 12.000 € veći nego
  što jest. Troškovi iz fonda su `Razno / Nena's funds` (račune za stan, grob, Kućište — dosad
  ~2.465 €, isto što pločica pokazuje u bucketu „Kućište · Nenin novac").
- **Prijedlog — fond kroz os Namjena:** Namjena vrijednost ~~`Nena`~~ **„Nena / Kućište"** (odlučeno
  22.10.: zamjenjuje `Kućište` u izborniku) na **obje** strane: dvije uplate dobiju Namjenu `Nena` (Podtip izvora, npr.
  `Nasljedstvo`), troškovi `Nena's funds` isto. Razrez po Namjeni tada sam pokaže
  *ušlo 12.000 · izašlo ~2.465 · ostaje ~9.535*, i radi i za uplatu nakon ostavinske.
  ⚠ Te uplate i dalje broje u „Ušlo" — ako to smeta (usporedba godina), alternativa je
  `Transfer / Nena` (izvan razreza) uz cijenu da se „ušlo u fond" ne vidi na pločici.
- `Prihodi / Koka` 24.04. (200 €, *„Poklon"* od Nevenke) — pravi poklon, ostaje Kokin.
| `Kuća / Osiguranje` | spojiti u Tip `Osiguranje` (Podtip `Kuća`) | jedno mjesto za osiguranja |
| `Projekti / Sasa` + `Prihodi / Saša` | `Sasa` → `Saša` | O1, jedan naziv |
| Retci `Projekti / Sasa` (Konzum, Biberon…) | Namjena `Saša`; Tip po tome što je kupljeno — **prijedlog po trgovcu** iz povijesti, ti potvrđuješ | jedine prave odluke po retku |

**✅ ODLUČENO 22.10. (S180, Saša) — sheet za PROD, izmjereno na kopiji PROD-a:**

| Izbor | Odluka | Izmjereno |
| --- | --- | --- |
| O5 opseg | **sve s osobom u imenu**: Audible, Kindle, Sport, Medical, Lječnička komora, Odjeća/obuća/ostalo → jedan Podtip + Namjena; `Prihodi / Koka`, `Saša`, `Projekti / Koka` samo Namjena (Podtip izvora = kasnije) | 445 redaka preimenovano; svaki par `_Koka`/`_Sasa` je u **istom** bucketu ⇒ spoj se sažme |
| `Projekti / Sasa` | **ostaje `Projekti / Saša`** + Namjena Saša — bez odluka po retku | 113 redaka nije „razno Sašino": 64 ručka (Biberon/Kvatrić/Time, Radnička 49) 619 €, 30 Konzum ista adresa 152 €, 18 Claude/Anthropic/Perplexity 571 €, 1 parking — trošak projekta je odgovor na „na što" |
| Nenine uplate 25.07./28.07. | `Prihodi / Nasljedstvo` (nov Podtip) + Namjena „Nena / Kućište"; `Razno / Nena's funds` (14) isto Namjena | fond po Namjeni: ušlo 12.000, izašlo 2.465,05, **ostaje 9.534,95** |
| Decathlon | Odjeća_Sasa (13) **i** N/A (13) → `Zdravlje / Sport` + Saša; Sport_Sasa (8) kroz O5 | N/A −13 |
| `Kuća / Osiguranje` | 4 Generali → `Osiguranje / Kuća`; naknada 0,17 (§8.1 „prava greška") → `Domaćinstvo / Bankovni troškovi` | — |
| Izbornik Namjene | Zajedničko · Koka · Saša · **Nena / Kućište** | — |

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
  ✅ **S183 (25.10.): izveden na TEST-u** — Bucketi | Namjena | Tip, fond Nena / Kućište, bez
  migracije (`namjena` = 4. dimenzija 056); „Koka razno" / „Saša razno" raspušteni. `RAZREZ_SPEC.md` §18.

⚠ Prije izvedbe: saldo se ne miče (Tip/Podtip nisu u filtru salda), ali **pravila trgovca**,
**rječnik `Izvod opis`** i **bucketi** nose stara imena — upravo mjesta iz §1.3 koja jezgra mora
prebrojati. Zato je ovo dobar **prvi test** cijelog alata.

---

# DIO 2 — Tehnički spec F1 (za kod)

> **Saša 20.10.:** jezgra je **transakcija u bazi** (Postgres funkcija), ulaz je **sheet prvo**,
> povrat kroz **zapis operacija** (prije / poslije), alat sa service ključem **smije**.
> **S178:** jezgra izvedena i dokazana na TEST-u (`058`, planer, sheet) — stanje i odstupanja u **§18**.
> **S179:** faza u Structure uvozu (pregled, Primijeni, Poništi), `apply.ts`, E2E, grep alat — **§19**.

## 9. Arhitektura u jednoj slici

```
Structure Excel ──► sheet `Preuređivanje` (koraci)
                         │
                         ▼
  ┌──────────── PLANER (TypeScript, čist, bez I/O) ─────────────┐
  │ ulaz:  koraci + snimka Aree (atributi, validation_rules,     │
  │        settings, shortcuti, sidra, vrijednosti redaka)       │
  │ radi:  simulira korake REDOM u memoriji                      │
  │ izlaz: očekivani broj redaka po koraku · nova pravila        │
  │        izbornika · nove postavke · popis promjena za čovjeka │
  │        · upozorenja · blokirajuće greške                     │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
                  PREGLED u modalu (čovjek čita, kvačica)
                                 ▼
  ┌──────── rpc_restructure_apply (Postgres, JEDNA transakcija) ─┐
  │ provjeri pravo (vlasnik Aree ili service_role)               │
  │ zaključa Areu · provjeri da se ništa nije promijenilo        │
  │   od pregleda (očekivani brojevi + „prije" config jednak)    │
  │ izvede korake nad retcima · upiše config                     │
  │ zapiše svaki dirnuti redak: prije / poslije                  │
  │ bilo kakvo odstupanje ⇒ RAISE ⇒ ništa nije upisano           │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
           ponovno mjerenje (planer nad svježom snimkom: 0 starih)
                                 ▼
             rpc_restructure_undo(op_id) kad zatreba
```

**Zašto podjela planer / baza:** znanje o **obliku** postavki (gdje u `dashboard`, `due`,
`groupings`, `automations` stoji vrijednost opcije) već živi u TypeScriptu
(`dashboardConfig.ts`, `automationsConfig.ts`) i mora se održavati na jednom mjestu — u
plpgsql-u bi bila druga kopija. Baza radi ono što samo ona može: **atomičnost, provjeru prava i
zaključavanje**. Retke baza mijenja **po pravilu** (uvjet koraka), ne po popisu ID-eva — planer
šalje samo **očekivani broj**, a razilaženje znači „baza se promijenila od pregleda" ⇒ odbij.

## 10. Model operacije: korak = „kad … postavi …"

Sve što F1 treba (O1 preimenuj, O2 spoji, O3 premjesti, O5 izdvoji os, pojedinačne odluke)
svodi se na **jedan oblik koraka**:

```jsonc
{ "category": "Transakcija",                              // leaf čiji eventi se gledaju
  "when": { "tip": "Zabava", "podtip": "Audible_Koka" },  // svi uvjeti AND, točna jednakost
  "set":  { "podtip": "Audible", "namjena": "Koka" } }
```

| Što | Kako izgleda korak |
| --- | --- |
| O1 preimenuj Tip | `when {tip: A}` → `set {tip: B}` |
| O1 preimenuj Podtip | `when {tip: T, podtip: P}` → `set {podtip: Q}` |
| O2 spoji | dva koraka u isti cilj |
| O3 premjesti Podtip | `when {tip: A, podtip: P}` → `set {tip: B}` |
| O5 izdvoji os | `when {podtip: Audible_Koka}` → `set {podtip: Audible, namjena: Koka}` |
| pojedinačno | `when {event_id: [...]}` → `set {...}` (prijedlozi iz alata, npr. Projekti/Sasa) |
| zadano za ostatak | `when {namjena: (prazno)}` → `set {namjena: Zajedničko}` — **zadnji** korak |

**Pravila koraka:**
- **Koraci se izvode redom**; korak vidi rezultat prethodnih (planer simulira isto).
- **`(prazno)`** u `when` = atribut nema vrijednost; u `set` = **obriši** vrijednost.
- F1 radi samo s **tekstualnim** atributima i **točnom jednakošću**. „Sadrži" i regex su F2 (A2).
- **Atributi istog eventa.** P1 roditeljska razina nije u F1 — za Financije nebitno, jer je
  `Transakcija` L1 leaf; za Fitness/DIARY dolazi u F3.
- `set` na atribut koji redak **nema** ⇒ **novi** `event_attributes` redak, s `user_id` =
  **autor eventa** (isto pravilo kao Edit tok, CLAUDE.md § Collab — vlasnik Aree).
- `set` vrijednosti koja je **ista** kao postojeća ne broji se kao promjena i ne ide u zapis.

## 11. Sheet `Preuređivanje`

| Korak | Kategorija | kad: tip | kad: podtip | kad: namjena | postavi: tip | postavi: podtip | postavi: namjena | event_id | Napomena |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Transakcija | Zabava | Audible_Koka | | | Audible | Koka | | O5 |
| 2 | Transakcija | Zabava | Audible_Sasa | | | Audible | Saša | | O5 |
| 3 | Transakcija | Kuća | Osiguranje | | Osiguranje | Kuća | | | O3 |
| 4 | Transakcija | Projekti | Sasa | | | Saša | | | O1 |
| 5 | Transakcija | auto Lacetti | | | | | Saša | | |
| 6 | Transakcija | | | | Domaćinstvo | Hrana i ostalo | Saša | 3f2a…, 81c0… | iz alata (Konzum) |
| 99 | Transakcija | | | (prazno) | | | Zajedničko | | zadano |

- **Stupci su po atributu**: `kad: <slug>` i `postavi: <slug>`, koliko god treba; zaglavlje
  određuje atribute (slug, ne ime — isti razlog kao `ListColumns`).
- Prazna ćelija = „ne gleda se / ne mijenja se"; `(prazno)` = izričito prazno.
- `event_id`: popis odvojen zarezom ili razmakom (ćelija do 32.767 znakova ≈ 900 ID-eva; više ⇒
  više redaka istog koraka).
- Structure export nosi **prazan** sheet sa zaglavljem i uputom (da se zna da postoji).
  ⚠ **Slova stupaca se računaju, nikad pišu** (S160).
- Sheet se obrađuje **poslije** ostatka Structure uvoza, kao **zasebna faza** s vlastitim
  pregledom i vlastitim „Primijeni" — jer korak smije koristiti atribut koji je isti uvoz tek
  stvorio (npr. `namjena`).

## 12. Planer — što računa (`src/lib/restructure/plan.ts`, čista funkcija)

**Ulaz:** koraci + snimka Aree: `attribute_definitions` (s `validation_rules`), `areas.settings`,
`activity_presets` Aree, `balance_anchors` Aree, sve tekstualne vrijednosti atributa koje koraci
spominju (`fetchAllPaged` + `.order('id')`; Financije: ~11k redaka za 3 atributa).

**Izlaz:**
1. **Po koraku:** broj pogođenih redaka, broj stvarnih promjena, primjer 3 retka (datum, opis, iznos).
2. **Izbornik** (`validation_rules`) — kroz `src/lib/validationRules.ts`, **nikad iz parsiranog
   oblika** (S152):
   - vrijednost **A** koja nakon svih koraka ima **0 redaka**, a bila je izvor u koraku ⇒
     **nestaje iz izbornika**; ako je korak preslikao A → B 1:1 i B još nije u izborniku, **B
     sjeda na A-ovo mjesto** (redoslijed vlasnika ostaje, S164/S167);
   - nova vrijednost koje nema u izborniku ⇒ **dodaje se na kraj** popisa, a za `depends_on`
     atribut **pod roditeljsku vrijednost** retka (Podtip `Kuća` pod Tip `Osiguranje`);
   - preimenovan **roditelj** (Tip) ⇒ preimenuje se i **ključ** u `options_map` djeteta (inače
     Podtip ostane bez opcija — K-spec §4), a spoj dvaju ključeva **spaja popise**;
   - `default_map` ključevi i vrijednosti prate isto pravilo;
   - vrijednost s 0 redaka koju **nijedan korak nije dirao** ostaje — nikakvo čišćenje usput.
3. **Postavke** (`areas.settings`) — za svaku promjenu vrijednosti `A → B` atributa `s`:

   | Mjesto | Što se mijenja |
   | --- | --- |
   | `dashboard.widgets[].filters[]`, `split.filters[]` | `values` gdje je `slug = s` |
   | breakdown `income`, `outside[]`, `adjustments[].add/subtract` | isto |
   | breakdown `unclassified` | ako je `levels[0] = s` |
   | `due` | `basket_by = s` ⇒ **ključ** u `baskets`; `group_by = s` ⇒ `baskets[*].account`; `status_slug = s` ⇒ `pending`/`done`; `settle[s]` |
   | `groupings[*].rows[].values` | na položaju `levels.indexOf(s)`; O3 mijenja **par**. ⚠ Isti par dvaput = **greška** (zbrojio bi se dvaput, RAZREZ §10.2) ⇒ blokira |
   | `automations.attribute_rules[]` | `map_slug = s` ⇒ ključ u `date_map` |
   | `automations.rata` | `date_map_slug = s` ⇒ ključ u `date_map` i `remainder_map`; `override_attrs[s]` |
   | `list_columns[].map` | `attr` kolona sa `s` u `slugs` ⇒ ključ |
   | `export_profiles` | filtar atributa po `s` (oblik provjeriti pri izvedbi — `exportProfile.ts`) |

   Promjena koja nije čisto preimenovanje (A se raspalo na više B-ova) ⇒ planer **ne pogađa**
   nego **upozori**: „bucket / filtar pokazuje na A, a A više nema redaka".
4. **Izvan `settings`:** `activity_presets` (`default_attributes` vrijednost, `filter_state.attrFilter`
   kad je `isExact`; djelomičan filtar ⇒ upozorenje), `balance_anchors.group_value` kad je
   `group_slug = s` (⚠ račun bez sidra = pločica bez potvrđenog stanja, bez greške).
5. **Samo upozorenja (ne piše):** `comment_template` koji sadrži doslovno A; **Python rječnici**
   — preglednik ne može grepati, pa ih pokriva `Tools/preuredjivanje_grep.py <file.xlsx>`
   (ispiše file:redak za svaku staru vrijednost; pokreće se uz suhi prolaz).
6. **Blokirajuće greške:** atribut iz zaglavlja ne postoji u kategoriji · `set` na netekstualni
   atribut · korak bez ijednog `kad` (osim `event_id`) · dvostruki par u `groupings` · vrijednost
   s vodećim/pratećim razmakom (zamka S167: config citira doslovno).

## 13. Baza — migracija `058_restructure.sql`

**Tablice:**

```sql
restructure_ops (
  id uuid PK, area_id uuid FK areas, actor uuid,          -- auth.uid() ili NULL za service
  actor_label text,                                        -- 'service: <alat>' kad nema uid
  created_at timestamptz, source text,                     -- ime filea / sheeta
  plan jsonb,                                              -- koraci + očekivani brojevi (dokaz)
  status text CHECK (status IN ('applied','undone')),
  undone_at timestamptz, undone_by uuid )

restructure_op_rows (
  op_id uuid FK ON DELETE CASCADE, seq int,
  kind text CHECK (kind IN ('event_attribute','attribute_rules','area_settings',
                            'preset','anchor')),
  target_id uuid,                                          -- id dirnutog retka
  before jsonb,                                            -- NULL = redak nije postojao
  after  jsonb )                                           -- NULL = redak obrisan
```

RLS: `SELECT` vlasniku Aree; **nema** INSERT/UPDATE/DELETE politika — pišu samo funkcije.

**`rpc_restructure_apply(p_area_id uuid, p_steps jsonb, p_config jsonb, p_source text) RETURNS uuid`**

- `SECURITY DEFINER`, `SET search_path = public, pg_temp`. Pravo: `areas.user_id = auth.uid()`
  **ili** JWT `role = service_role` (isti obrazac kao `app_can_read_area`, `035`; ⚠ nikad
  `current_user` — u DEFINER funkciji to je vlasnik funkcije). Grantee i stranac ⇒ `RAISE`.
- `SELECT … FROM areas WHERE id = p_area_id FOR UPDATE` — dvije operacije nad istom Areom ne
  mogu se preplesti.
- **Provjera „ništa se nije promijenilo od pregleda":**
  - za svaki `p_config` dio: trenutna vrijednost (`validation_rules`, `settings`, preset, sidro)
    mora biti **jednaka** (`jsonb =`, neosjetljivo na redoslijed ključeva — S153) onoj „prije"
    koju je planer vidio;
  - za svaki korak: broj pogođenih redaka **u trenutku izvođenja** = `expected` iz plana;
  - inače `RAISE` s porukom *„korak N: očekivano 22, nađeno 23 — baza se promijenila od
    pregleda, napravi pregled ponovo"* ⇒ cijela transakcija se poništi.
- **Koraci redom**, svaki kao `UPDATE … RETURNING` / `INSERT … RETURNING` / `DELETE … RETURNING`,
  s pisanjem `before`/`after` u `restructure_op_rows`. Mijenja se **na mjestu** (UPDATE), nikad
  „obriši pa upiši" (S125/S134 razred).
- `events` se **ne dira** — ni `user_id` (autor ostaje), ni `edited_by` (inače bi tisuće redaka
  dobile ✎ oznaku u listi; trag je u zapisu operacije).
- Vraća `op_id`.

**`rpc_restructure_undo(p_op_id uuid) RETURNS int`**

- Isto pravo, isto zaključavanje.
- Za svaki zapis: trenutno stanje mora biti **jednako `after`** — inače je netko poslije
  operacije dirao isti redak ⇒ `RAISE` s popisom (prvih 20) i **ništa se ne vraća**.
  Djelomičan povrat bi ostavio mješavinu starog i novog — gore od ijednog od njih.
- Vraća `before` obrnutim redom (`seq DESC`), `status = 'undone'`.

`REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated` (⚠ Supabase sam dodijeli
`anon` — `057`), `NOTIFY pgrst, 'reload schema'`.

⚠ **Vremenski limit:** PostgREST ima `statement_timeout` za `authenticated`. Financije: najveći
korak ~1.400 redaka, cijela operacija procjena < 1 s — **izmjeriti na TEST-u** (kopija PROD-a)
prije nego se tvrdi. Ako zatreba: `SET LOCAL statement_timeout` u funkciji.

## 14. Aplikacija

- `src/lib/restructure/sheet.ts` — čitanje/pisanje sheeta (prazan predložak u Structure exportu).
- `src/lib/restructure/plan.ts` — planer (§12), čist, s testovima.
- `src/lib/restructure/apply.ts` — snimka Aree, poziv RPC-a, ponovno mjerenje.
- `StructureImportModal` — faza „Preuređivanje": tablica koraka (broj, primjer), popis promjena
  izbornika i postavki, upozorenja (žuto), greške (crveno, gase Primijeni), kvačica *„Vidio sam
  što se mijenja"*, rezultat s `op_id` i gumbom **Poništi**.
- Poslije primjene: `areas-changed` (keš lanca i kategorija se prazne — S132/S133).
- **Popis operacija Aree s Poništi** u Structure tabu = F1b (do tada povrat ide iz modala odmah
  ili alatom).
- **Ne u F1:** prekidač Bucketi | Namjena u razrezu (§8.3) i traženje u izborniku (O6) — zasebni,
  mali zadaci koji ne ovise o jezgri.

## 15. Testovi i dokaz

1. **Planer** (`restructurePlan.test.mjs`): fixture = PROD snimka postavki
   (`areaSettings_prod_2026-10-18.json`, postoji od S175) + sintetičke vrijednosti. Tvrdnje:
   preimenovanje Tipa preimenuje ključ `options_map`; O3 mijenja par u `groupings`; dvostruki par
   blokira; `Visa` ključ u `due.baskets` prati preimenovanje `izvorplacanja`; vrijednost bez
   ijednog koraka ostaje u izborniku. **Protuprovjera sabotažom** (pravilo S120).
2. **Baza na TEST-u** (kopija PROD-a kroz `prod_to_test.py --settings`):
   - primijeni → izmjeri → poništi → **`sha256` po tablici jednak snimci prije** (isti dokaz kao
     `restore_db.py`, S136) — jedini pošten dokaz da povrat radi;
   - promijeni jedan redak između pregleda i primjene ⇒ odbijeno, **0 redaka promijenjeno**;
   - promijeni redak poslije operacije ⇒ povrat odbijen, ništa vraćeno.
3. **Prava:** `rls_probe.py` dobiva probe za obje funkcije — vlasnik DA, write-grantee NE,
   stranac NE, service DA.
4. **E2E:** jedan spec — sheet s preimenovanjem, lista pokazuje novi naziv, Poništi vraća stari.

## 16. Puštanje na PROD (redoslijed)

1. `backup_db.py --env prod` (Saša).
2. `058` u Supabase SQL editoru (Saša), `dump_schema.py --diff` potvrdi.
3. Deploy (merge `main`, Saša).
4. Structure uvoz: atribut **`namjena`** (text, suggest: Zajedničko · Koka · Saša · Kućište,
   `depends_on: tip`) — **tri retka** u Structure sheetu, svi s istom listom u `TextOptions`:
   `WhenValue = *` / `Default` Zajedničko · `auto Lacetti` / Saša · `auto C5` / Koka.
   ⚠ **Ne `default_value`** (S179): za `depends_on` atribut uvoz `Default` čita kao `default_map`
   za taj `WhenValue` (T-S107u-2), a forma pada na `default_map['*']`. Izvedeno tako na TEST-u
   (`Claude-temp_R/s179/measure.mjs build` je predložak redaka).
5. Sheet `Preuređivanje` s koracima iz §8.2 — **pod Kokinim računom** (vlasnica; ili service
   alat, uz njen pristanak — §7.3). Suhi prolaz + `preuredjivanje_grep.py` ⇒ pregled ⇒ Primijeni.
6. **Mjerenje poslije** (kontrolne brojke **zapisati prije**): saldo svakog računa **nepomaknut**
   (Tip/Podtip/Namjena nisu u filtru salda) · Σ neto isti · izvedeni pomaci (S180: N/A −13 zbog
   Decathlona; Anja 25.09. **Transfer → Prihodi** +450) · stari nazivi: 0 mjesta.
   Alat: `Claude-temp_R/s180/kontrola.mjs <oznaka> [--env prod]` + `--diff` (samo čitanje).
7. Python rječnici (`pravila_trgovca.py` …) — ispraviti po grep popisu istog dana.

## 17. Otvoreno (odluke pri izvedbi, ne blokiraju početak)

- Treba li F1 i **brisanje opcije s retcima uz obavezno „spoji u…"** (K-spec §7: danas uvoz tiho
  pravi siročad)? Prijedlog: da, kao upozorenje u Structure uvozu koje upućuje na ovaj sheet.
- ~~`export_profiles` filtar~~ — **riješeno S178:** jedan string `filterState.attrFilterRaw`
  (`slug: =vrijednost` točno · `slug: ~dio` · `*: ~dio` · stari `uuid: =…` · `_` = namjerno
  obrisan). Planer prepisuje samo `=` (uuid ključ razriješi u slug), `~`/`*` upozori. Ključevi
  stupaca profila nose **ime atributa**, ne vrijednost — preuređivanje opcija ih ne dira.
- ~~Ime atributa~~ — **odlučeno 22.10. (Saša): `namjena`**, s izbornikom. ⚠ Uz `depends_on: tip` (radi
  `default_map` za aute) lista ide u redak `WhenValue = *`, inače se nudi samo uz aute. **Odlučeno 22.10.
  (Koka, kroz Sašu): „Nena / Kućište"** — jedna vrijednost umjesto `Kućište`; izbornik postaje
  Zajedničko · Koka · Saša · Nena / Kućište (v. §8.2).

## 18. Izvedeno (S178, 22.10.) — i gdje je kod odstupio od §9–§15

**Stanje:** `058` na **TEST-u** (ne na PROD-u) · `plan.ts` + `sheet.ts` + prazan sheet u
Structure exportu na `test-branch` · **nema** faze u `StructureImportModal`, `apply.ts`, E2E ni
`preuredjivanje_grep.py`. ~~Uvoz popunjenog sheeta zasad samo **javlja** da koraci nisu primijenjeni.~~ **S179: faza u modalu postoji — §19.**

**Oblik poziva** (`p_steps` / `p_config`) — opisan u zaglavlju `sql/058_restructure.sql`; planer ga
gradi u `plan.rpc`. Slugovi se razriješe u ID-eve u planeru; baza ID-eve **provjerava** (kategorija
u Arei, atribut tekstualan i na toj kategoriji, config cilj u Arei).

**Odstupanja / dopune:**

| Mjesto | Spec | Izvedeno | Zašto |
| --- | --- | --- | --- |
| §13 zapis | `seq`, redak po promjeni | **PK (op, vrsta, cilj)**: dira li više koraka isti redak, `before` ostaje prvi, `after` zadnji | povrat bi inače provjeravao međustanje koje više ne postoji i odbio ispravnu operaciju |
| §13 provjera | očekivani broj po koraku | **dva** broja: pogođeni eventi I stvarne promjene atributa | isti broj eventa s drukčijim vrijednostima prošao bi prvu provjeru |
| §13 FK | `area_id FK areas` | `ON DELETE CASCADE` | inače zapis blokira Delete Area kroz UI |
| §13 pravo | inline | helper `app_can_restructure_area` | ista provjera u apply i undo |
| §13 | — | prazan plan ⇒ greška; dvostruki redak (event, atribut) ⇒ greška; isti atribut dvaput u „postavi" ⇒ greška | brane, ne grane (izmjereno 0 duplikata na PROD-u) |
| §12.3 groupings | isti par dvaput = greška | isti par **u istom bucketu** ⇒ sažme se (javi u promjenama); u **dva** bucketa ⇒ greška | O5 (`Audible_Koka` + `_Sasa` → `Audible`) bi inače uvijek blokirao |
| §12.4 shortcut | `default_attributes`, `attrFilter` | isto; config cilj `{default_attributes, filter_state}` | — |
| §12.2 `default_value` | — | samo **upozorenje** (stupac, ne `validation_rules`) | F1 ne piše `attribute_definitions` osim pravila |
| §15.3 sonda | — | dodana uloga `service`; priprema (lažna operacija) u istoj transakciji | TEST nema write-share ⇒ za probu se doda privremeno |

**Izmjereno na TEST-u (kopija PROD-a 22.10.):** 10 koraka, 9.743 promjene + 12 config zapisa ⇒
apply **2,5 s** (service preko PostgREST-a; `authenticated` ima `statement_timeout` 8 s — pod Kokinim
računom **nije** mjereno, ali je isti posao), povrat **1 s**, `sha256` 12/12 tablica jednak.

## 19. Izvedeno (S179, 22.10.) — faza u Structure uvozu

**Stanje:** na `test-branch` — `restructure/apply.ts`, `RestructurePanel.tsx` (faza u
`StructureImportModal`), E2E `S179_restructure_apply_undo`, `Tools/preuredjivanje_grep.py`.
`structureImport.ts` §12 više ne javlja „NIJE primijenjeno" nego predaje korake modalu
(`result.restructure`). Na TEST-u postoji atribut `namjena` (Structure uvozom, §16.4). PROD: ništa.

| Mjesto | Spec | Izvedeno | Zašto |
| --- | --- | --- | --- |
| §9 ponovno mjerenje | „planer nad svježom snimkom: 0 starih" | **baza = predviđanje pregleda** (`plan.predicted`: vrijednosti iz „postavi" po eventu + svaki config zapis `jsonb =` `after`); poslije povrata baza = stanje prije | izmjereno: niz koraka ne mora biti idempotentan (99 postavi zadano, 100 ga na 3 retka obriše) ⇒ „isti koraci opet" je javljao **6 promjena nad ispravnom bazom** |
| §12 ulaz | sve tekstualne vrijednosti | samo slugovi koje koraci trebaju (uvjeti, „postavi", `depends_on` roditelj/dijete, razine `groupings`), **paralelno po atributu** | 14 s → 9 s za pregled (TEST, 10 koraka, 7 atributa); na PROD koracima (tip/podtip/namjena) manje |
| §14 Area | — | iz Structure sheeta istog filea; file s više Area ⇒ greška | koraci nose samo ime kategorije |
| §14 shortcuti | — | snimka vidi samo **pozivateljeve** shortcute (RLS po korisniku) ⇒ žuto upozorenje **kad Area ima share** | tuđi shortcut ostaje sa starom vrijednošću; upozorenje koje uvijek pali nauči se otklikati |
| §14 Poništi | gumb u modalu | isto; `op_id` piše u rezultatu (za alat) | popis operacija = F1b |
| §16.4 `namjena` | `default_value` Zajedničko | red `WhenValue = *` s `Default` | v. §16.4 |

**Izmjereno kroz modal, pod vlasnikom (`authenticated`, `statement_timeout` 8 s), TEST = kopija PROD-a:**
10 koraka / 9.743 promjene: apply **2,4 s, 4,4 s i 4,9 s** (treće = Saša, T-S179-1), undo **1,9 · 2,2 · 3,2 s** (RPC iz preglednika);
pregled ~9 s, provjera poslije ~7 s. Dva ciklusa primijeni → poništi: `sha256` **11/12** tablica
jednak (12. = `attribute_definitions` +1, `namjena`). ⚠ Zalihost do 8 s je **~1,6×** (najgore izmjereno 4,9 s) — PROD plan
(§8.2) je manji (bez Visa/RF koraka, ~5,6k promjena), ali **ne spajati** u jedan sheet više velikih
domena; dijeli se u dva uvoza.

## 20. Izvedeno (S180, 22.10.) — sheet §8.2 na kopiji PROD-a

**Stanje:** sheet složen alatom `Claude-temp_R/s180/build_sheet.mjs <structure_export.xlsx>` (isti nad
TEST i PROD exportom — event ID-evi su isti, `prod_to_test.py`); na TEST-u primijenjen i ostavljen
(op `2b200967`). **PROD 22.10. (Kokin račun, Netlify bez deploya): op `e0c3de1f`, 6.066 promjena, 3,7 s,
provjera ✓; kontrolne brojke PROD poslije = TEST poslije u svemu** (T-S180-2).

| Mjesto | Izvedeno | Zašto |
| --- | --- | --- |
| koraci po retku | `event_id` **uz** uvjet Tip/Podtip (Decathlon, Anja, Nena, naknada) | brana: promijeni li se redak, broj se ne poklopi i baza odbije cijelu operaciju |
| bucketi koji bi se raspali | (Razno, Odjeća_Sasa) i (Kuća, Osiguranje) **maknuti iz `AreaSettings` u istom fileu** | planer za raspadnut par samo upozori i ostavi mrtav redak; Structure dio uvoza ide PRIJE planiranja, pa par u planiranju već ne postoji; poslije koraka ih pokrivaju (Razno, Odjeća/obuća/ostalo) i (Osiguranje, *) u **istom** bucketu. Indeksi `rows[N]` se ne prenumeriraju (`unflattenAreaSettings` sažme po redu) |
| izbornik Namjene | redak `namjena` × 3 u Structure sheetu istog filea | Namjena je bila prazna ⇒ obična izmjena liste, bez koraka |
| shortcuti | `fix_shortcuti_S180.py` (service, poslije Apply) | planer vidi samo vlasnikove; Sašin `AI_rucak` nosi `Projekti / Sasa` (PROD, 1 od 5) |
| grep | korak s `event_id` se preskače | `kad tip=N/A` + ID-evi je davao jak pogodak za svaki `'N/A'` (106 → 29) |

**Izmjereno (TEST = PROD 22.10. 14:15, pod vlasnikom):** 24 koraka / 6.066 promjena, pregled 12 s (drugi
put 4 s), apply **2,1–2,4 s**, provjera ✓, undo 1,1 s ✓. Saldo i Σ neto isti u cent; N/A 1.392 → 1.379;
Namjena: Zajedničko 4.420 · Saša 548 · Koka 471 · Nena / Kućište 16. Poslije povrata tip/par/Namjena/saldo
ISTO. `set_breakdown.py` nad primijenjenim TEST-om: „grupiranje: ISTO", nesvrstano: ništa.
Python rječnici ispravljeni po grep popisu (`set_breakdown`, `pravila_trgovca`, `uvezi_transu`,
`klasificiraj_transu` — i `nena` → `Prihodi / Nasljedstvo`); preostalih 8 pogodaka su jednokratne S107.

**⚠ Nađeno, NIJE popravljeno (preduvjet za iduće preuređivanje Namjene):** grana planera „dodaj cilj u
izbornik" (§12, `depends_on`) radi samo kad atribut **ima izvora** (prije je imao vrijednost). Tada za
roditelja bez vlastitog ključa stvori ključ **samo s ciljem** — a lista Namjene živi pod `*` (ključevi:
`*`, `auto C5`, `auto Lacetti`). Korak koji mijenja POSTOJEĆU Namjenu (npr. C5 putovanja → Zajedničko,
preimenovanje „Nena / Kućište") dao bi `options_map.Zabava = ["Zajedničko"]` ⇒ izbornik pod Zabavom
nudi samo to. Isto „makni / preimenuj" ne vidi listu pod `*` (traži `om[roditelj]`). Danas bezopasno
(Namjena je bila prazna ⇒ grana se ne izvrši). Popravak: cilj koji `*` već nudi ne stvara ključ;
izvor čija lista je pod `*` mijenja `*`. Uz test u `restructurePlan.test.mjs`.

**⚠ Otvoreno:** Python uvozni alati (`fill_from_izvod`, `visa_uvoz_izvoda`) ne pišu Namjenu ⇒ novi retci s
izvoda dolaze bez nje (forma je puni sama kroz `default_map`, Excel uvoz ne). Prije prekidača
Bucketi | Namjena (RAZREZ R5) — ili alati upisuju zadano po Tipu, ili razrez prazninu broji kao Zajedničko.
✅ Zatvoreno S181 (alati i Excel uvoz upisuju zadano); S183 izmjerio 0 praznih Namjena, a razrez prazninu
prikazuje kao vidljivu krišku `(prazno)` — nikad je ne pretvara u Zajedničko.

