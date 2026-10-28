# Structure — Help

## Pregled strukture
- Structure tab prikazuje sve tvoje Areas i Categories
- Table view: hijerarhijska tablica s ATTRS kolonom
- Sunburst view: interaktivni kružni grafikon
- Mine / All / Templates segmenti: filtriraj što se prikazuje

## Edit Mode
Unlock-a sve strukturne promjene:
- Rename kategorije/areae: klikni na ime u Edit panelu
- Dodaj atribut: klikni na kategoriju → Edit panel → "+ Add Attribute"
- Brišanje atributa: trash ikona uz atribut (zaštita ako ima eventa)
- Kartice atributa su **zadano sklopljene** (ime, tip, broj opcija, ⚠ ako kartica nosi
  upozorenje); klik na redak je otvori, a panel pamti koje si otvorio. „Expand all / Collapse all"
  iznad kartica. Novi, još nespremljen atribut je uvijek otvoren.
- „+ Add Attribute" za tekstualni atribut prima i **opcije** (jedna po retku) — tada je odmah
  dropdown (suggest).
- Zatvaranje panela (X, klik pored, „View") s **nespremljenim izmjenama** pita „Discard unsaved
  changes?" — „Keep editing" vraća u panel, ništa se ne gubi.

## Atributi u Edit panelu

**Tipovi:** text · number · boolean · datetime · suggest (text + predefinirane opcije u dropdown-u)

**`default_value`:** vrijednost automatski upisana kad korisnik otvori Add Activity za tu kategoriju.
Za suggest atribute mora točno odgovarati jednoj od opcija (case-sensitive).
Polje s defaultom se u formi **prikazuje, popunjeno** — default ne skriva polje (od S187; prije je
forma skrivala polja na defaultu). Za skrivanje polja postoji samo `HiddenInAdd`.
Za brisanje `default_value` via Excel Structure importa: upiši `_` u Default kolonu — import postavlja null (prazno).

**`IsRequired` (kol. J) — obavezno polje:**
Add i Edit ne daju spremiti dok polje nije ispunjeno (`false` i `0` **jesu** odgovori; netaknut
checkbox nije). **Ne vrijedi za Excel uvoz aktivnosti** — povijesni retci i `N/A` moraju i dalje
prolaziti, pa je to pravilo forme, a ne baze; postojeći retci se ne diraju.
- Atribut u Structure sheetu ima **više redaka** (po jedan za svaki `WhenValue`). `IsRequired` je
  **zastavica**, pa `TRUE` na **bilo kojem** retku atributa čini polje obaveznim — za razliku od
  ostalih atributskih polja, gdje vrijedi prvi redak.
- Obavezno dijete traži i **obaveznog roditelja**: ostane li `depends_on` roditelj prazan, dijete se
  u formi uopće ne prikaže, a obavezno je — panel na to upozorava.

**`HiddenInAdd` (kol. K) — polje skriveno pri unosu:**
Za atribute čija je **ispravna vrijednost prazna** (npr. `Izvod opis`, koji se popuni tek s izvoda).
"Show all" ga i dalje otkrije — urednost, ne zaključavanje.
Ako file **nema** kolonu `HiddenInAdd` (stariji export, ručno skraćen file), uvoz postojeće
skrivanje **ne dira**. Prazna ćelija u koloni koja **postoji** znači „ne skrivaj". Kod atributa
s više redaka dovoljan je `TRUE` u **bilo kojem** retku.
⚠ **`IsRequired` i `HiddenInAdd` ne mogu biti oboje `TRUE`** — tvrde suprotno o istom polju. Panel
kombinaciju ne da složiti; dođe li Excel uvozom, uvoz je prijavi i **sam preuzme označeni file**
(`structure_REVIEW_NEEDED_*`, žute ćelije u J/K), a forma polje svejedno prikaže — obavezno pobjeđuje,
da se unos ne može zaključati.

**`VisibleWhen` (kol. L) — polje vidljivo samo uz vrijednost drugog atributa:**
Oblik `slug = vrijednost | vrijednost`, npr. `vrsta = Snaga | Istezanje`. Radi za svaki tip polja.
Atribut o kojem ovisi mora biti na istoj kategoriji ili roditelju (nikad dijete); umjesto sluga smije
i ime atributa — uvoz ga pretvori u slug. Skriveno polje se ne sprema, „Show all" ga ne otkriva,
a obavezno vrijedi samo dok je vidljivo. U Edit panelu: „Visible only when".
- Prazna ćelija = nema pravila. Ako file **nema** kolonu `VisibleWhen` (stariji export), pravilo u
  bazi **ostaje**.
- Atribut ima više redaka (po jedan za `WhenValue`): vrijedi **prva popunjena** ćelija; različite
  vrijednosti uvoz prijavi upozorenjem.
- Neprepoznata ćelija ili atribut kojeg nema na kategoriji/roditelju ⇒ pravilo u bazi ostaje, uz
  upozorenje u rezultatu uvoza.

**`depends_on` — ovisnost o drugom atributu ("parent"):**
Konfigurira se u Edit panelu → klikni na atribut → "Depends on" / "WhenValue → Options (+ Default)".
Radi **dva različita posla, ovisno o tipu atributa**:

- **Tekstni atribut (dropdown) — mijenja se POPIS OPCIJA.** Polje je uvijek vidljivo; svaki
  WhenValue redak kaže *„kad parent ima ovu vrijednost, ponudi ove opcije"*.
  Primjer: `Izvor` ovisi o `Racun` — uz `Sašin tekući RF` nudi `Racun / Visa / Cash`, uz
  `Kokin tekući ZABA` nudi `Racun / Mastercard / Cash`.
- **Broj, da/ne, datum — mijenja se VIDLJIVOST.** Polje se pojavi tek kad parent ima jednu od
  navedenih vrijednosti. Primjer: `Uplata` vidljiva samo kad `Smjer = Uplata`; `Broj rata` samo
  kad `Rate? = true`.

**Redak `WhenValue = *` („sve ostalo"):**
- Kod tekstnog atributa: opcije za **svaku vrijednost parenta koja nije navedena**. Koristan je kad
  se doda nova vrijednost parenta — npr. **novi račun**: dok ga netko ne doda u popis `Izvor`a,
  `Izvor` uz njega nudi ono što piše pod `*`. Upiše li se ondje `Racun / Cash`, novi račun odmah
  dobije razumne opcije.
- **Prazan `*` znači „za nenavedene vrijednosti ne nudi ništa"** — i to je normalno stanje.
  Structure export ga **sam dopiše** svakom atributu s ovisnošću (kao mjesto za popuniti), pa ga
  imaju gotovo svi; nitko ga nije upisao namjerno i ne smeta.
- Kod broja / da-ne / datuma `*` **ne otkriva** polje — ostavi ga prazan.
- Vrijednost koja se ne poklapa ni s jednom stvarnom vrijednošću parenta (npr. `SKRIVENO`) nije
  posebna riječ — samo nikad ne pogodi. Za skrivanje polja služi kvačica **Hide in Add/Edit form**.

**`default_map` — uvjetni default po parent vrijednosti:**
Uz depends_on opcije, svaki WhenValue red može imati svoj Default. Kad korisnik odabere parent vrijednost u Add Activity, zavisni atribut automatski dobiva odgovarajući default.
- Primjer: `Izvor plaćanja = Račun` → `Status = Izvršen`; `Izvor plaćanja = Visa` → `Status = Planiran`
- Konfigurira se u Edit panelu (treće polje "default" uz svaki WhenValue red) ili via Excel Structure import (Default kolona per-WhenValue red)
- Ako korisnik ručno promijeni vrijednost, default se ne primjenjuje ponovo

Oba pravila (`default_value`, `depends_on`, `default_map`) vrijede u Add Activity i Edit Activity.

## Kategorije — ⋮ menu opcije
- **+ Add Leaf**: dodaj dijete kategoriju (leaf = može imati activnosti)
- **Add Between**: umetni novu razinu između ovog čvora i njegovih djece (novi čvor ide ispod odabranog, iznad djece)
- **Collapse Level**: ukloni ovu razinu; djeca se pomiču gore (na roditeljski nivo), atributi se prenose dolje na svako dijete
- **Delete**: brisanje (blokirano ako kategorija ima evente)
- **Manage Access** (area red): upravljanje dijeljenjem

## Dodavanje area
- Edit Mode → "Add Area" gumb (desno gore)
- Prazna area: upiši ime, Save
- Iz templatea: odaberi "From template" radio → odaberi template → Preview → Create

## Collapse/Expand area redova
- Klikni ▶/▼ chevron na area redu
- "Collapse all / Expand all" gumb (prikazuje se kad 2+ areaa)

## Brisanje s backupom
- ⋮ → Delete → "Download Backup & Delete" preuzima .xlsx backup pa briše

## Automations sheet (Structure export/import)
Zaseban sheet u Structure .xlsx-u — automatike po arei putuju **zajedno sa strukturom**,
pa se ne izgube pri prijenosu ili ponovnom uvozu area.

Kolona `Action` određuje vrstu pravila:

- **`set_attribute`** — auto-popunjavanje datumskog atributa iz vrijednosti drugog atributa.
  `TargetAttr` = polje koje se puni, `MapAttr` = polje koje bira pravilo,
  `DateMap` = `vrijednost=pravilo`, gdje je pravilo jedno od:
  `same` (datum sesije) · `next:N` (N-ti dan **sljedećeg** mjeseca) ·
  `cutoff:B:D` (prva pojava dana **D** nakon sljedećeg dana **B**).

  **Dodaješ novu karticu?** Kartica ima **tri** datuma i lako se zamijene:
  *zatvaranje izvoda* → *terećenje računa* → *dospijeće*. `Datum naplate` znači
  **terećenje** — dan kad novac stvarno ode s računa. Izmjeri dvoje umjesto da pogađaš:
  **B** = dan zadnje transakcije na izvodu, **D** = dan kad skupna naplata pogodi tekući račun.
  Ako je **D** u sljedećem mjesecu od **B** → `next:D` (Mastercard: `next:11`);
  ako je u istom mjesecu → `cutoff:B:D` (Visa: `cutoff:3:5`).
  Puna razrada s izmjerenim brojkama je u `docs/AUTOMATION_SPEC.md`.
- **`rata`** — Post-Finish modal koji kupovinu razdijeli na rate; najviše jedno po arei.
  `TriggerAttr` (checkbox koji pali modal), `CountAttr`, `AmountAttr`, `IndexAttr` (redni broj
  rate), `TargetAttr` (kamo ide datum naplate), `DateMap` = `vrijednost=DAN` (broj 1–31),
  `OverrideAttrs` = vrijednosti nametnute svakoj rati (npr. `status=Planiran`).
  Datume rata računa **isto `set_attribute` pravilo** koje puni `TargetAttr` (prva rata =
  datum naplate obične kupovine, svaka sljedeća +1 mjesec). Rata `DateMap` se koristi samo
  kao rezerva kad takvog pravila nema.

Import zamjenjuje navedene automatike svake area koja se pojavi u sheetu. **Odsutnost ne briše** —
stariji export bez rata kolona ne može pobrisati postojeću rata konfiguraciju. Pravilo koje
referencira nepostojeći slug se preskače (vidljivo u "Automation rules skipped").

Rezultat uvoza broji **promjene, ne retke**: `Attributes updated` su atributi koji su se
stvarno promijenili, a `Automations changed (areas)` / `List columns changed (areas)` broje
Aree kojima se ta postavka promijenila. Sivo `0` znači „sheet je pročitan, ništa se nije
promijenilo".

## Postavke area u Structure sheetu

Kolone na **Area** retku nose postavke same area, pa i one putuju roundtripom:

- **`CommentTemplate`** — auto-komentar na Finish; `{slug}` umeće vrijednost atributa.
  Na Area retku = default za sve leafove, na leaf Category retku = override.
- **`DisableSavePlus`** — `TRUE` skriva "Save +" u Add Activity (jedan event po sesiji,
  npr. Financije, Health). Prazno = `FALSE`. Čita se **samo** s Area retka.
- **`DefaultPeriod`** — razdoblje filtra kad Area otvoriš, a još nisi birao: `this-month`,
  `last-3-months`, `this-year`, `last-year` … (isti ključevi kao izbornik *Period*). Prazno =
  *All Time*. Nepoznat ključ uvoz **ne upiše** i to javi.

Kolone koje u fileu **nema** ne diraju svoju postavku — stariji export bez `DisableSavePlus`
kolone je ne može pobrisati (isti princip kao rata automatika).

## AreaSettings sheet — ostale postavke area

Export ide za **jednu area** — odaberi je u filtru (u *All Areas* gumb Export kaže
„Select an Area"). Backup cijele baze ne ide ovim putem.

Sheet `AreaSettings` nosi **sve postavke area koje ne nose ostali sheetovi**: pločice Overviewa
(`dashboard`), grupiranja razreza „Kamo ide novac" (`groupings`), export profile i svaku buduću
postavku. Jedan red = jedna vrijednost:

- **`Path`** — put do vrijednosti, npr. `dashboard.widgets[0].title`.
  `.ime` = ključ, `[0]` = mjesto u popisu, `["ime.s točkom"]` = ključ s posebnim znakovima.
- **`Type`** — `text` · `number` · `bool` · `null` · `[]` · `{}`. Izvoz ga popuni; **ne briši ga**
  (Excel tekst `05` pretvori u broj 5).
- **`Value`** — vrijednost. `{Area}` u ključu export profila znači „ova area", pa profil vrijedi
  i kad area dobije drugo ime ili postane kopija.

Uvoz **zamjenjuje** te postavke svake area koja se pojavi u sheetu: obrisan red = obrisana
postavka; red `[1]` smiješ obrisati bez prenumeriranja ostalih. Area koje nema u sheetu ostaje
netaknuta, a file bez sheeta ne dira ništa. Neispravan red (kriv `Type`, kriva putanja) uvoz
**javi** i tu area **ne mijenja** — djelomična pločica bila bi gora od stare.
Rezultat: `Area settings changed (areas)` + popis što se promijenilo (`area: dashboard, …`).
