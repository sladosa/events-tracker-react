# Preuređivanje strukture — spec (prijedlog prije koda)

> **Stanje 26.10. (S185):** F1 na PROD-u (§18–§20). **F2 (A1, A2, A4) je NACRT u DIO 3 (§21–§31)**,
> s tri pretpostavke koje čekaju Sašu (§21.2) — bez koda.
>
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

**✅ Popravljeno S185 (26.10., `test-branch`, PROD tek s deployem):** planer broji par (roditelj, dijete)
pod ključem liste koju forma **stvarno nudi** — vlastiti ključ, a bez njega `*` kad `*` nije prazan
(Namjena; Podtip ima `*: []` i ponaša se kao prije). Cilj koji `*` već nudi ne stvara ključ; preimenovanje
pod `*` prati i u vlastitim ključevima koji ponavljaju listu (auti) i u `default_map`; nova vrijednost samo
za neke roditelje ⇒ njihov ključ = lista pod `*` + nova (u `*` bi curila svim Tipovima). Čuva 5 blokova u
`restructurePlan.test.mjs` (nad starim kodom pada 8 tvrdnji). Izvorni nalaz:

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


---

# DIO 3 — F2: atributi (A1 promijeni tip, A2 izvedi, A4 spoji) — NACRT

> **Status:** nacrt, 26.10.2026. (S185), **bez koda**. Pisano dok je Saša bio vani, na njegov „ok".
> Odluke koje je Saša donio u razgovoru stoje u §21.1. Tri odluke koje **još čekaju njega** su
> upisane kao pretpostavke i označene **⏳ čeka Sašu** (§21.2); odbije li koju, mijenja se odlomak koji
> ona nosi, ne cijeli spec.
> Predložak oblika je F1 (§9–§17); sve invarijante iz §3 vrijede i ovdje.

## 21. Ukratko i odluke

- **A1 i A4 idu istim putem kao F1** — sheet u Structure Excelu → planer (TypeScript) → pregled u
  modalu → jedna transakcija u bazi → zapis prije/poslije → Poništi. Razlog: obje operacije mijenjaju
  **config** (reference na slug, izbornik, `list_columns.map`), a znanje o obliku configa živi
  **samo** u TypeScriptu (§9, `plan.ts`). Python kopija tog znanja bila bi drugo mjesto koje odluta.
- **A2 živi u Pythonu** — jedan modul pravila, dva pozivatelja (generator prije uvoza; alat nad bazom).
  Alat šalje bazi **gotove vrijednosti**, a baza ih upisuje kroz istu jezgru (`058` + `059`): ista
  transakcija, isti zapis, isti Poništi. A2 **ne piše config** — zato mu planer ne treba.
- **Prvi korisnik F2 nije DIARY nego `Fitness_Garmin` na TEST-u**: ondje već stoje dvije izmjerene
  greške (§22.3) — `kcal` je u kilodžulima (A2) i `pace` je tekst (A1). F2 se tako dokazuje na
  stvarnim podacima **prije** generatora za DIARY.

### 21.1 Odlučeno (Saša, 26.10.)

| # | Odluka |
| --- | --- |
| 1 | `vr NNN` / `v.r.NNN` u `O` = **visinska razlika** (uz `L = brda`) ⇒ `total_ascent` |
| 2 | `opt NN` = Garminovo **opterećenje vježbanja** ⇒ `training_load` |
| 3 | brojevi i smajlići u `N` (2015–16) se **ne izvode** — premalo, ostaju u Excelu |
| 4 | `VO2max` iz `O` se ne izvodi — Garmin ga ima kontinuirano (dnevni podatak); tekst ostaje u izvorniku |
| 5 | A2 zadano **puni samo prazno**; „uskladi s pravilom" se traži izričito (§26.3) |
| 6 | **A1 i A4 ulaze u F2** — *„da ne moramo jako precizno pogoditi organizaciju iz prve"* |

### 21.2 Pretpostavke — ✅ odlučeno 26.10. (Saša)

| # | Odluka | Posljedica za F2 |
| --- | --- | --- |
| P1 | ~~DIARY dan = leaf `Activity > Dan`~~ → **`Activity` ostaje TRENING** (jedan event = jedan stvarni trening); ostatak dana se **raspodijeli** na `Health_Sasa`, `Life_Sasa` i slično, uz **periode** za razne slučajeve | A2 radi **unutar jednog eventa** — razina `roditelj` ispada iz F2 (§26.4); A4 samo unutar iste kategorije (§25). Model dana je posao `TRENING_MIGRACIJA.md`, ne F2 |
| P2 | mapa za `mood`: `:-(` = 1 · `:-/` = 2 · `:-\|` = 3 · `:-)` = 4 · `:-D` = 5 | prvi A1 s mapom (§24) |
| P3 | **novi Garmin GDPR izvoz** teče paralelno (Saša ga traži) | A2 nad `O` je dopuna za rupu, ne glavni izvor (§22.4) |

## 22. Izmjereno (S185, samo čitanje)

### 22.1 DIARY — oblici (kopija 26.10., 7.458 dana)

| Stupac | Oblik | Pokrivenost / era |
| --- | --- | --- |
| `O` puls | `HR 110(134)` | 2017.→ ~99 %; bez oblika 56 redaka 2016.→ (najviše 2016: 21, 2021: 12) |
| `O` TE | `t.ef.2,3` (2015–2020) · `t.ef.2,3/0` (2023.→), 2021–22 prijelaz | **anaerobni tek od 2021.** — pravilo nosi razdoblje |
| `O` kcal | `394kcal`, 63 × `cal` (2020.→) | 2016.→ ~99 % |
| `O` opt / vr | `opt35` 2022.→ (248) · `vr 190` / `v.r.190` (~480) | |
| `AM` | `NN%, NNHRV, NNbb` 2024.→ (99 %); 2024. bb i kao `bbNN` (82), HRV i kao `HRVNN` (14); 2 tipfelera | **privatno** — v. §26.5 |
| `M` | vrijeme na početku: `16:30` 320 · `16h` 135 · `9:00` 98 (2024.→ 128 / 194 / 197 dana) | izvor je **komentar**, ne atribut |
| `I` | smajlići 3.329 (od 22.12.2014.) | mapa 1:1, ništa se ne gubi |
| `E`, `F`, `AL` | broj (1 tekst) · uvijek vrijeme · broj 39–52 | čisti — generator ih uvozi s pravim tipom, ne trebaju F2 |

### 22.2 Model `Fitness` (PROD export 26.10.) = model `Fitness_Garmin` (TEST)

`Activity` (L1, roditelj sesije): `duration`, `hr_avg`, `hr_max`, `kcal`, `aerobic_effect`,
`anaerobic_effect`, `training_load`, `intensity` (text), **`mood` (text, smajlići, bez `:-|`)**.
Leafovi: `Gym > Strength`, `Gym > Cardio`, `Outdoor` (`distance`, `pace`, `terrain` `ravno|brda|mix`,
`total_ascent`). Razlike TEST ↔ PROD: `pace` text (TEST) / number (PROD), TEST ima `location`.
⚠ Slugovi na PROD-u nose **crticu** (`hr-avg`) — generacija slug triggera prije `042`.

### 22.3 `Fitness_Garmin` (TEST): Garmin aktivnosti 01.2015. – 14.02.2025.

3.133 sesije na 2.822 dana, iz GDPR izvoza (S71). **Na PROD nikad nije prešla** (`MIGRATION_STATE.md`).

- ⚠ **`kcal` je u kilodžulima.** Omjer Garmin/DIARY na danima s jednom sesijom i istim pulsom:
  **4,19 na 1.794 od 1.905** (kJ/kcal = 4,184). `garmin_activities_to_xlsx.py:325` upisuje
  `calories` iz izvoza bez pretvorbe. ⇒ **Popraviti alat prije bilo kakvog PROD uvoza**, a podatke
  na TEST-u popraviti A2-om (§26, prvi korisnik).
- `pace` je tekst `MM:SS` (alat ga namjerno pretvara u tekst) ⇒ A1 korisnik (§24, pretvorba `mm:ss`).

### 22.4 DIARY ↔ Garmin, po danu (01.01.2015. – 14.02.2025.)

| | Dana |
| --- | ---: |
| DIARY trening (`F > 0`) | 2.832 |
| Garmin aktivnost | 2.822 |
| **oboje** | **2.661** (94 %) |
| samo DIARY (najviše `x-TRAIN` 69, `ODMOR` s vremenom 46) | 171 |
| samo Garmin (većina 2015.) | 161 |
| dan s više Garmin sesija | 280 |
| puls: DIARY ima i Garmin istog dana ima / **isti ±1** | 2.245 / **2.098** (93 %) |
| km: oba / unutar 10 % | 1.663 / 1.515 (91 %) |
| `opt` = training load ±1 | 90 / 97 |
| `vr` = total ascent ±10 % | 317 / 398 |
| **DIARY poslije 14.02.2025.** — dana / s treningom / s pulsom | **619 / 465 / 454** |

**Što to znači za F2:** za 2015.–02.2025. su brojevi iz `O` **prepis Garmina** (93 % u bpm). A2 nad
`O` zato ima pravu vrijednost samo za (a) rupu od 15.02.2025. — dok je ne zatvori novi GDPR izvoz,
(b) 171 dan bez Garmina, (c) **kontrolu** (sukob DIARY ↔ Garmin kao popis, ne kao upis). Zato je
P1 odlučen tako da `Activity` nosi **trening, ne dan** (§21.2): dnevni event DIARY-ja koji bi punio
`Activity` uz već postojeću Garmin sesiju brojao bi isti trening dvaput.

### 22.5 `C:\0_Sasa\GarminData` (GDPR izvoz 15.02.2025.)

- **San: 3.127 noći, 07.2016. – 02.2025.** (`DI-Connect-Wellness/*sleepData.json`: faze, disanje,
  stres u snu; Garminova ocjena sna ~860 noći) — **nije uvezen**. `garmin_daily_metrics_to_xlsx.py`
  tvrdi „Sleep/HRV not available" — zastarjelo (mapa raspakirana 07.05.).
- HRV-a u JSON-u nema; možda u `.fit` tipu 58 (~6.000 fileova, tek od 2022.) — **pretpostavka**,
  treba FIT čitač (venv ga nema). 2024.→ HRV ionako stoji u DIARY `AM`.
- `.fit` treninzi (~3.600, 2014–2025) nose dionice ⇒ pravi tempo (TRENING Q11) — kasnije.

## 23. Arhitektura

```
Structure Excel ──► sheet `Preuređivanje atributa` (A1, A4)      Python: pravila.py ──► izvedi.py (A2)
                         │                                                  │  računa vrijednosti
                         ▼                                                  │  (dry run: xlsx pregled)
          PLANER F2 (TS, čist) — config, izbornik, blokade                  │
                         │                                                  │
                         ▼                                                  ▼
              pregled u modalu ─────────► rpc_restructure_apply ◄──── service ključ (TEST: Claude,
                                          (058 + 059: nove vrste          PROD: Saša)
                                           koraka, jedna transakcija)
                                                    │
                                     zapis prije/poslije ─► rpc_restructure_undo
```

- **Svaki sheet = jedna operacija** (vlastiti `op_id`, vlastiti Poništi). Redoslijed faza u Structure
  uvozu: Structure (stvori ciljne atribute) → `Preuređivanje atributa` → `Preuređivanje` (F1).
- **A2 je jedna operacija po pravilu** (jedan ciljni atribut) — Poništi po pravilu, i svaki poziv
  ostaje ispod `statement_timeout` (§19: 9,7k promjena = 2,4–4,9 s; DIARY ≤ 7,5k po pravilu).

## 24. A1 — promijeni tip atributa

**Opseg F2:** `text → number` (s pretvorbom) i `number → text`. Ostali smjerovi (`datetime`,
`boolean`) ⇒ blokada „nije u F2".

**Pretvorbe** (stupac `Pretvorba` u sheetu):

| Pretvorba | Primjer | Korisnik |
| --- | --- | --- |
| `broj` | `2,3` → 2.3 · `1.234,5` → 1234.5 (isto pravilo kao `parseAmountInput`) | opći |
| `mm:ss` | `6:06` → 6.1 | `pace` na `Fitness_Garmin` |
| `mapa` | `:-( = 1 \| :-/ = 2 \| …` (oblik kao `Map` u `ListColumns`) | `mood` (P2) |

**Pravila:**
1. **Svaki redak mora se dati pretvoriti — inače blokada** s popisom (datum, vrijednost; prvih 50).
   Ne „ostavi kao tekst": app za brojčani atribut čita `value_number`, pa bi tekst postao nevidljiv —
   gubitak bez ijedne poruke. Popravak je Excelom ili A2, pa ponovni pregled.
2. Mijenja se **na mjestu**: `value_text` → `value_number` (`value_text = NULL`) i
   `attribute_definitions.data_type`. Slug ostaje ⇒ reference na slug ostaju žive.
3. **Blokade:** atribut je `depends_on` roditelj ili dijete (ključevi `options_map` su tekst) ·
   atribut je `group_by` / `basket_by` / `status_slug` pločice (tekstualna uloga) · `number → text` uz
   `list_columns` ulogu novca.
4. **Config** (planer, ista tablica mjesta kao §12.3): s pretvorbom `mapa` vrijednosti se prevode
   kao preimenovanje opcije (filtri pločica, `list_columns.map` **ključevi** — `:-)` → `4`, pa lista i
   dalje pokazuje smajlić; shortcut `default_attributes`). Bez mape (`broj`, `mm:ss`) config koji
   citira vrijednost tog atributa ⇒ **upozorenje** (nikad pogađanje). `validation_rules`: `suggest`
   pada (number ga nema), `min`/`max` ostaju prazni.
5. Opcija izbornika s 0 redaka ne ulazi u pretvorbu; nestaje sa `suggest`-om (upozorenje ako ih ima).

## 25. A4 — spoji atribute (B u A)

**Opseg:** A i B su atributi **istog tipa** na **istoj kategoriji** (dakle na istom eventu).
A na pretku B-ove kategorije (seljenje na roditeljski event sesije) je A3 — F3 (§26.4).

**Po eventu:**

| A | B | Ishod |
| --- | --- | --- |
| prazno | ima | B → A, B redak obrisan |
| ima | ista vrijednost | B redak obrisan |
| ima | **različita** | **sukob — ništa se ne dira**, redak ostaje u B, prijava |
| — | prazno | ništa |

- **B se briše kao atribut samo ako mu ne ostane nijedan redak** (i uz kvačicu „obriši izvor").
  Sukobi ⇒ B ostaje s preostalim retcima — ništa se ne gubi, a popis sukoba je posao za Excel.
  (Odgovor na pitanje 4 iz handoffa: nitko ne pobjeđuje; P3 ovdje ne vrijedi jer nijedna strana nije
  „zadnja".)
- **Config:** reference na B prelaze na A istim čistim funkcijama kao rename sluga u panelu
  (`renameSlugInDashboard`, `renameSlugInGroupings`, `renameSlugInListColumns`,
  `renameSlugInAutomations`; `depends_on` kao §12.2). Citira li config **već** i A i B na istom mjestu
  (dvije kolone liste) ⇒ upozorenje, ne spajanje.
- **Izbornik** (tekst sa `suggest`): A dobiva uniju, redoslijed vlasnika A, B-ove nove na kraj (§12.2).
- `export_profiles` ključevi stupaca nose **ime** atributa (`attr:Area||Cat||Ime`) ⇒ upozorenje
  „profil X ima stupac B" (ime se ne prepisuje — isto kao §17).
- **Blokade:** različit tip (prvo A1) · A i B nisu na istoj kategoriji · B je `depends_on` roditelj nekog
  trećeg atributa (rupa §20 — ne otvarati drugu).

## 26. A2 — izvedi atribut iz teksta (Python)

### 26.1 Modul pravila `data-prep_tools/Trening/pravila.py`

Jedan izvor istine za regexe; zovu ga generator i `izvedi.py`. Pravilo:

```python
Pravilo(ime='hr_avg', izvor='biljeska',          # slug ili 'comment'
        od='2015-01-01', do=None,                # era (§22.1: TE oblik se mijenja 2021.)
        uzorak=r'HR\s*(\d{2,3})\s*\(', grupa=1,
        pretvorba='broj',                        # broj · mm:ss · ×faktor · /faktor · mapa · vrijeme
        cilj='hr-avg')                           # isti event (§26.4)
```

- **Pravilo smije biti Python funkcija kad regex ne dostaje** (npr. `kcal = kcal / 4.184`, izvor = cilj).
- Uz modul ide **samoprovjera** (`pravila.py --test`, §29.1); `izvedi.py --apply` odbija rad ako ona pada.

### 26.2 Alat `izvedi.py`

```
izvedi.py --area Fitness_Garmin --pravilo hr_avg [--od 2025-02-15] [--nacin prazno|uskladi] [--apply]
izvedi.py --ponisti <op_id>
```

- **Dry run (zadano):** po godini — izvora / pogođeno / nepogođeno / cilj već pun (isti · različit);
  `izvedi_<pravilo>_<datum>.xlsx` za Sašin pregled (datum, izvor, izvedeno, postojeće; **za privatne
  izvore samo oblik**, kao u §22.1). Broj promjena koje idu u bazu = `expected`.
- `--apply`: jedan RPC poziv (§27), pa **ponovno mjerenje = baza je ono što je dry run predvidio**
  (pouka S179, ne „ponovi pravilo i očekuj 0").
- `ET_TARGET` / `--env` kao svi alati (zaglavlje `[TEST]` / `[PROD]` prvo, S137). PROD `--apply`
  pokreće Saša.
- `--od`: za DIARY dotok (DIARY se piše dalje) — isto pravilo nad novim danima.

### 26.3 Načini

- **`prazno` (zadano):** upisuje samo gdje cilj nema vrijednost. Ponovljiv bez štete.
- **`uskladi`:** gdje pravilo **pogodi**, cilj postaje izvedena vrijednost (i prepisuje ručni
  ispravak — zato izričito). Gdje pravilo **ne pogodi**, cilj se **ne dira** — A2 nikad ne briše.
  Brisanje krive vrijednosti je F1 korak `(prazno)` (proširen na brojeve, §27) ili Excel.

### 26.4 Samo unutar istog eventa (P1, 26.10.)

Izvor i cilj su na **istom eventu**. Za trening iz DIARY-ja to znači: izvorni tekst `O` ide u
atribut **na istoj razini** kao brojevi (`Activity`, npr. `biljeska`), pa A2 čita i piše isti event.
Seljenje vrijednosti između leafa i roditelja sesije (P2 lanac) ostaje **A3 u F3**. Time `059` ne
mora znati lanac sesije, a tako je bilo i u prvom nacrtu (razina `roditelj`, ispala 26.10.).

### 26.5 Između Area — nije A2

San / HRV / bb iz privatnog `AM` idu u `Health_Sasa` (Koka čita). Tekst `AM` ondje ne smije ni
privremeno ⇒ to izvodi **generator prije uvoza**, istim funkcijama iz `pravila.py`. A2 nad bazom radi
samo unutar sesije.

## 27. Baza — `059_restructure_f2.sql`

Proširuje `058`; F1 koraci ostaju kakvi jesu (i dalje samo tekst), osim jedne iznimke dolje.

**Nove vrste koraka** u `p_steps` (polje `kind`; bez njega = F1 korak):

| `kind` | Oblik | Provjera u trenutku izvođenja |
| --- | --- | --- |
| `values` (A2) | `target_attr`, `rows: [{event, value, expect, src_md5}]` | event je u Arei i na kategoriji ciljnog atributa · `md5(izvorni tekst)` = `src_md5` · trenutna vrijednost cilja = `expect` (`null` za način `prazno`) · broj redaka = plan |
| `retype` (A1) | `attr`, `to_type`, `conv: 'broj' \| 'mm:ss' \| {mapa}`, `expected` | **svaki** redak se pretvara (inače `RAISE` s prvih 20) · broj = plan |
| `merge` (A4) | `from_attr`, `into_attr`, `drop_from`, `expected_moved`, `expected_conflicts` | isti tip · ista kategorija · brojevi = plan |

- Vrijednost se piše u **stupac po `data_type`** (`value_number` / `value_text` / `value_datetime`) —
  jedna pomoćna funkcija za sve tri vrste.
- **Pretvorba je u SQL-u** (`retype`): `broj` = regex provjera pa zamjena zareza; `mm:ss` = split;
  mapa = `jsonb ->>`. Planer istu pretvorbu radi u TS-u za pregled ⇒ **dvije kopije pravila
  pretvorbe** — zato ih čuva zajednički popis primjera (§29.3).
- **Nova vrsta zapisa `attribute_definition`** (`restructure_op_rows.kind`): `before` / `after` =
  cijeli redak definicije. `retype` mijenja `data_type`; `merge` uz `drop_from` briše B (`after = NULL`).
  ⚠ Brisanje definicije ide **zadnje** u operaciji ⇒ povrat (`seq DESC`) **prvo** vraća definiciju,
  pa tek onda njene retke (FK).
- Povrat event atributa već vraća **sve** `value_*` stupce (`058`, provjereno čitanjem) — A1 povrat
  zato traži samo `attribute_definition`.
- **Iznimka u F1 grani:** `set` s `(prazno)` smije i na ne-tekstualni atribut (brisanje krive izvedene
  vrijednosti). Postavljanje broja kroz F1 i dalje ne.
- Pravo, zaključavanje Aree, „ništa se nije promijenilo od pregleda", `REVOKE … anon` — kao `058`.

## 28. Aplikacija

- `src/lib/restructure/attrSheet.ts` — sheet **`Preuređivanje atributa`**:
  `Korak | Operacija | Kategorija | Atribut | Novi tip | U atribut | Pretvorba | Obriši izvor | Napomena`
  (`Operacija` ∈ `promijeni tip`, `spoji u`). Prazan predložak u Structure exportu; slova stupaca se
  računaju (S160). Mapa u obliku `ListColumns` `Map`.
- `src/lib/restructure/attrPlan.ts` — planer A1/A4 (čist): brojevi, nepretvorivi retci, sukobi, config
  (§24.4, §25), blokade. ⚠ **`plan.ts` ostaje JEDINO mjesto koje zna gdje u configu stoji vrijednost
  opcije** — `attrPlan` njegove funkcije **zove**, ne kopira.
- `RestructurePanel` — isti pregled i Poništi; dodaje tablice „nepretvorivo" (crveno, gasi Primijeni)
  i „sukobi" (žuto, ne blokira).
- **A2 nema UI u F2.** Operacije A2 vide se tek u F1b popisu operacija (kad ga bude).

## 29. Testovi i dokaz

1. **`pravila.py --test`**: oblici iz §22.1 (HR, oba TE oblika, `kcal`/`cal`, `opt`, `vr`/`v.r.`,
   `16:30`/`16h`, AM prefiksi; dva tipfelera kao **nepogođeni**). Sabotaža (pokvaren regex) ruši test.
2. **`attrPlan.test.mjs`**: A1 mapa prevodi `list_columns.map` ključeve i filtar pločice; nepretvoriv
   redak blokira; `depends_on` blokira; A4 sukob ostavlja B; A4 prepisuje slug u dashboardu (fixture
   PROD snimka iz S175). Protuprovjera sabotažom (S120).
3. **Ista pretvorba u TS-u i SQL-u** — jedan popis primjera (`2,3`, `1.234,5`, `6:06`, `-`, `abc`),
   isti očekivani ishod; SQL strana kao proba na TEST-u.
4. **Baza na TEST-u**, nad `Fitness_Garmin`, svaka vrsta: primijeni → izmjeri → poništi → **`sha256`
   po tablici jednak** (dokaz iz §15 / §18) · promijeni izvor između dry runa i `--apply` ⇒ odbijeno,
   0 promjena · promijeni cilj poslije ⇒ povrat odbijen.
5. **Kontrolne brojke** (zapisati prije): A2 `kcal` dira sve sesije s `kcal`, svaka nova = stara /
   4,184 (±1); poslije toga DIARY ↔ Garmin `kcal` ±2 slaže se kao puls (~93 %). A1 `pace`: svi retci
   pretvoreni ili popis nepretvorivih.
6. **E2E:** sheet A1 (`mood` mapa) ⇒ lista pokazuje smajlić kroz `map`, Edit forma broj; Poništi vraća.

## 30. Redoslijed izvedbe (prijedlog)

| # | Što | Gdje | Dokaz |
| --- | --- | --- | --- |
| 0 | ✅ §20 popravak planera (`depends_on` pod `*`) — S185 | `plan.ts` + test | 78/78, nad starim kodom 8 pada |
| 1 | `059` + `pravila.py` + `izvedi.py`, **A2 `kcal` na `Fitness_Garmin`** | TEST | §29.4–5 |
| 2 | `garmin_activities_to_xlsx.py`: `kcal = calories / 4.184` (+ test) | alat | prije ikakvog PROD uvoza Garmina |
| 3 | A1 (`attrSheet`, `attrPlan`, modal) — `pace` na `Fitness_Garmin`, `mood` mapa | TEST | §29.2, .4, .6 |
| 4 | A4 | TEST | §29.2, .4 |
| 5 | model dana u `TRENING_MIGRACIJA.md` (trening → `Activity`; ostalo → `Health_Sasa` / `Life_Sasa`; periodi), pa generator v0 → grubi uvoz na TEST; A2 nad `O` / `M` za treninge bez Garmina | TEST | brojke §22.4 |
| 6 | PROD: `backup_db` → `059` (Saša) → deploy → prvi stvarni PROD korisnik: `Fitness` `mood` A1 | PROD | kontrolne brojke prije/poslije |

Korak 5 ovisi o modelu dana i o tome kad stigne novi GDPR izvoz (P3). Koraci 0–4 ne ovise ni o čemu.

## 31. Otvoreno

- ~~P1–P3~~ — odlučeno 26.10. (§21.2).
- **„Activity1" — ne ubiti sadašnji `Activity`** (Saša 26.10.): novi model treninga gradi se
  **uz** postojeći, ne preko njega. Prijedlog: prvo na TEST-u (`Fitness_Garmin` je već odvojena
  kopija modela — ondje se smije lomiti); na PROD ide tek gotov model, kao nova kategorija
  (`Activity1`, ime nije odluka) u istoj Arei `Fitness`. Ista Area je namjerna: seljenje 2026.
  treninga iz starog u novi je tada K2 (F3), a ne seljenje između Area (koje se ne planira).
- **Dnevni subjektivni podaci uz Garmin trening** (`mood`, `intensity`, komentar `M`, vrsta iz `K`):
  dan s jednom Garmin sesijom (~2.380 dana) je jednoznačan; **280 dana ima više sesija** — kojoj ide
  raspoloženje dana? Pitanje modela (`TRENING_MIGRACIJA.md`), ne F2.
- `pravila.py --test` u CI (CI danas vrti samo Node) ili ručna brana uz `izvedi.py`? Prijedlog:
  brana u alatu (§26.1), CI kasnije.
- A2 nad **tekstom sa `suggest`** (izvedena vrijednost koje nema u izborniku): u F2 **blokada** —
  dodavanje u izbornik traži planer, a A2 ga namjerno nema.
- `restructure_op_rows` uz A2 na DIARY-ju: ~7,5k zapisa po pravilu × ~8 pravila ≈ 60k — izmjeriti
  rast; čišćenje starih zapisa nije u F2.
- Garmin san (§22.5) u `Health_Sasa` — nije F2, ali je jeftin i čeka samo odluku.
