# Overview tab — dashboard po Arei (spec + plan rada)

**Datum:** 2026-08-11 · **Status:** PRIJEDLOG — čeka Sašin pregled
**Povod:** sesija S107x — frustracije F1/F2 (zašto Koka i dalje bira svoj Excel)
**Vizualna skica:** v. link na kraju DIO 1

> **Odnos prema `docs/Analytics_tab.md`** — to je **drugi dokument o drugoj stvari** i oba
> ostaju. `Analytics_tab.md` (Fable, 2026-07-04) rješava **cross-Area korelaciju kroz vrijeme**
> (`periods` tablica, Series, AnalyticsDef Excel). Ovaj dokument rješava **stanje jedne Aree
> sada** (stanja računa, razrez po Tipu). Različiti korisnici, različita pitanja, različit
> read model. §2.6 opisuje gdje se smiju spojiti, a gdje ne.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Zašto ovo uopće postoji

Koka koristi svoj Excel jer joj daje jednu stvar: **koliko je novca na računu i slaže li se
s bankom.** Aplikacija to danas ne zna. `Stanje` je u njoj obično polje koje netko mora
upisati — nije izračunato. Na tvom exportu od 11.08. kolona `Stanje` je popunjena na par
redaka, ostalo prazno.

Dakle ona ne bira lošije. Bira bolje, po svom kriteriju. Dok je tako, cutover je guranje
lošijeg alata.

## Što joj aplikacija može dati što Excel ne može

1. **Zbroj ne može puknuti.** Njena formula `=F655+D656-E656` je lanac — ubaci redak u
   sredinu i raspari se. Zbroj po računu je neovisan o redoslijedu **potpuno**, ne samo
   uglavnom. Ono što danas drži disciplinom, tamo je nemoguće pokvariti.
2. **Rate se ne parkiraju ručno.** Njeno „vodim par redova niže pa prebacim kad dođe na
   naplatu" već postoji kao `Status: Planiran → Izvršen` + `Datum naplate`, a rata modal ih
   generira sam. Taj posao joj nestaje.
3. **Mobitel.** Ona gleda bankovne aplikacije na telefonu. Njen Excel je na laptopu.

## Što se gradi

**Novi tab „Overview"** pored Activities i Structure. Pokazuje stanje **te** Aree.

Za Financije: **stanja po računu** (izvršeno i planirano odvojeno), polje gdje upiše što
piše u bankovnoj aplikaciji pa vidi razliku, razrez troška po Tipu/Podtipu, trend po
mjesecima.

Za Fitness bi ista mehanika dala nešto sasvim drugo (broj treninga, niz, zadnja mjerenja) —
jer pločice nisu napisane za Financije, nego **posložene iz atributa**. To je bitno: inače
pišemo nov dashboard za svaku Areu zauvijek.

Uz to **brzi unos**: račun zapamćen, dva polja za iznos, datum = danas, sve ostalo se popuni
samo. Bez toga pločica pokazuje točan saldo, ali unos i dalje boli.

**Redoslijed tabova se mijenja u `Overview → Activities → Structure`** (Sašin prijedlog,
2026-08-11). Overview je razlog zbog kojeg otvara app, Activities je detalj, Structure je
rijetkost. Prava se **ne** diraju — Koka je vlasnik te Aree (D6), pa bi zaključavanje iz
strukture vratilo ovisnost o Saši koju migracija upravo uklanja. Redoslijed je dovoljan;
postavka se dodaje tek ako se pokaže da tamo luta. (v. OQ-6)

**Klik na račun otvara detalj** — ali dva različita klika, jer su to dva pitanja:
klik na **iznos** → Activities filtriran na taj račun (zadnjih N izvršenih);
klik na **„+ planirano"** → isti račun **i** `Status=Planiran`.

**Dospjele rate se NE prebacuju automatski** — v. §2.5a. Umjesto toga Overview pokaže
*„3 rate dospjele"* s jednim tapom za potvrdu. **Mjesto: traka IZNAD „Stanje po računu"**,
i **samo kad ima čega** (nema dospjelih ⇒ traka ne postoji, isto načelo kao OQ-4). Redoslijed
je namjeran — potvrdiš dospjelo, saldo ispod se odmah promijeni: uzrok i posljedica na istom
ekranu.

**Usklađenje s bankom (✓ / Δ) — što znači:** uz svaki račun stoji polje **„u banci"** gdje
korisnik utipka broj koji vidi u bankovnoj aplikaciji. Čip je usporedba s izračunatim saldom:
`✓ slaže se`, ili `Δ 49,00` = *app pokazuje 49 € više nego banka*. **Δ nije greška aplikacije**
nego signal da nešto fali, nešto je dvaput upisano, ili je iznos kriv. ⚠ Polje „u banci" mora
biti **i na mobitelu** — u prvoj skici je bilo izostavljeno pa je čip visio bez konteksta
(to je bio i prvi nesporazum pri pregledu skice).

## Što se NE gradi sada, i zašto

- **Lijepi grafovi jedne Aree.** Excel to već radi bolje. Ne natječemo se.
- **Cross-Area analitika** (tvoja ideja „kako su izgledale Financije u periodu koji je druga
  Area"). Dizajn postoji u `Analytics_tab.md` i dobar je — ali radi tek kad postoji **druga
  gusta Area**. Danas je Financije jedina s masom; Zdravlje, Diary i trening još čekaju.
  Prekrasan spoj nad praznom tablicom nema vrijednost.
- **AI sloj.** On sjeda **na** ovo, ne umjesto ovoga.

## Redoslijed rada

| # | Što | Tko | Ovisi o |
|---|---|---|---|
| 0 | Delete testovi → PROD deploy | Saša + Sonnet sesija | ničemu |
| 1 | **Stanje po računu** — jedna pločica + upit u bazi | Claude | ničemu |
| 2 | **Brzi unos** za Financije | Claude | 1 |
| 3 | Koka proba na mobitelu → **odluka o cutoveru** | Koka | 1+2 |
| 4 | Overview tab + ostale pločice | Claude | 3 (tek ako je 3 prošlo) |
| 5 | Batchevi 2025/2024/2023 + cutover | Saša | 3 |
| 6 | Cross-Area (`Analytics_tab.md`) | — | druga gusta Area |

Koraci 0 i 1 ne ovise jedan o drugom i mogu ići paralelno.

**Korak 3 je prava vaga.** Ako Koka nakon 1+2 i dalje bira Excel, ne guramo dalje —
mijenjamo plan i njen Excel ostaje trajni ulaz, a pipeline se automatizira umjesto gasi.
To je legitiman ishod, samo ga treba izabrati svjesno, a ne dogoditi se.

## Što s pomoćnim Excelom (`Financije_review`)

Kratko, jer je to bila F2:

| Sheet | Sudbina |
|---|---|
| `Preimenovanja` | **Gotov.** Bio je sprava za jednu situaciju (taksonomija se promijenila ispod već obilježenih redaka). Dogodilo se jednom, prošlo. |
| `Taksonomija` | **Već preseljena** u `Structure` sheet od `Financije_all`. Kopija u Reviewu je zastarjeli duplikat — samo je prestani koristiti. |
| `Pravila`, `Neklasificirano` | **Žive dalje, ali nad drugim fileom.** Alati se preusmjere s Reviewa na **Activities export aplikacije**. |
| `Problemi`, `Nematchano_*`, `Saldo kontrola` | Arhiva. Posao je odrađen. |

Ključno: **alati ne umiru, mijenjaju ulazni file.** `apply_rules.py` i `suggest_candidates.py`
rade nad kolonama `Tip`, `Podtip`, komentar, `Izvod opis` — sve to postoji u app exportu,
plus `event_id` i `row_hash`. To je **bolje** nego danas: identitet retka postaje `event_id`
umjesto nestabilnog `source_key`, a otpada ~13 od 30 kolona koje su bile skela pipelinea.

Novo mjesto: mali **„Pravila workbook"** (samo `Pravila` + `Neklasificirano`) sa strane, koji
čita i piše app export. To je onaj split-workbook koji si predložio u S107g pa odgodio — sad
ima razlog. I to je **tvoj** alat; Koka ga nikad ne vidi.

**Njena delta** (nova `Financije 2026-07.xlsx`) ne ide kroz Review uopće — `normalize_financije.py`
→ generator → import, kao `N/A`. Tako je već odlučeno u `FINANCIJE_MIGRACIJA.md` §13.

---

# DIO 2 — Tehnički dio

## 2.1 Zašto ovo nije dio `Analytics_tab.md`

| | `Analytics_tab.md` (Fable) | ovaj dokument |
|---|---|---|
| Pitanje | „kako je X izgledao **tijekom** Y" | „koliko je X **sada**" |
| Opseg | cross-Area | jedna Area |
| Vremenska os | period, bucket po danu/tjednu/mjesecu | trenutno stanje + opcionalni trend |
| Korisnik | Saša (analiza) | Koka (dnevni rad) |
| Nosivi entitet | `periods`, `analytics_views` (nove tablice) | `areas.settings.dashboard` (postojeći JSONB) |
| Preduvjet | druga gusta Area | ništa |
| Read model | agregacija po periodu | agregacija po cijeloj Arei |

Preklapanja nema u v1. Rizik konvergencije je opisan u §2.6.

## 2.2 ⚠ Ispravak pretpostavke iz `Analytics_tab.md` §3

Stari doc kaže: *„Bucketiranje client-side — količine podataka po periodu su male (stotine
sesija)."*

**Za period to vrijedi. Za pogled na cijelu Areu ne vrijedi.** Financije će nakon punog
importa imati ~5.000 eventa × ~13 atributa ≈ **65.000 redaka `event_attributes`**. Povlačiti
to u preglednik po renderu je:

- **S105 incident ponovo** — statement timeout na `event_attributes` je već jednom srušio PROD
- **tiho krivi rezultat** — PostgREST `max-rows = 1000` reže bez greške (S107v nalaz);
  saldo bi bio pogrešan, a nitko ne bi vidio zašto

Zato: **agregacija ide u Postgres, preglednik dobiva male brojke.** To nije optimizacija nego
uvjet ispravnosti.

**Bonus:** taj RPC sloj već je na backlogu kao pravi fix za **BUG-S103-ANYATTR** („In any
attribute" filtar puca za grantee-e jer `ILIKE` nije leakproof pa Postgres evaluira RLS EXISTS
nad cijelom tablicom). Jedna investicija, dva rješenja.

## 2.3 Model pločice

Konfiguracija u `areas.settings.dashboard` — isti obrazac kao postojeći `automations`,
`export_profiles`, `disable_save_plus`.

```jsonc
{
  "dashboard": {
    "widgets": [
      {
        "type": "balance_by_group",
        "title": "Stanje po računu",
        "group_by": "racun",                 // attribute slug
        "plus": "uplata",                    // numerički atribut
        "minus": "isplata",
        "filter":   { "attr": "status", "value": "Izvrsen" },
        "split_by": { "attr": "status", "value": "Planiran", "label": "Planirano" },
        "reconcile": true                    // polje "što piše u banci" + razlika
      },
      { "type": "breakdown", "title": "Trošak po tipu",
        "group_by": "tip", "drill": "podtip", "sum": "isplata" },
      { "type": "trend", "title": "Potrošnja po mjesecima",
        "sum": "isplata", "bucket": "month" }
    ]
  }
}
```

**Slug-based, ne ID-based** — iz istog razloga kao Series u `Analytics_tab.md` §3: slugovi su
stabilni, čitljivi u Excelu i preživljavaju Structure Import. (Uz ogradu S105d: slug se smije
mijenjati samo namjerno.)

Tipovi pločica v1: `balance_by_group`, `breakdown`, `trend`, `count`, `latest`.
Konfigurator nudi samo atribute odgovarajućeg tipa — `validation_rules` već zna `data_type`.

**Filtar:** Overview poštuje postojeći `FilterContext` (raspon datuma, kategorija, attr
filtri). Time „filtriranje po Tipu i Podtipu" dolazi besplatno. ⚠ Iznimka: `balance_by_group`
je **kumulativan po definiciji** — saldo se ne smije rezati rasponom datuma, inače prikazuje
besmislicu. Datumski filtar na toj pločici znači „stanje **na** taj datum", ne „promet u
rasponu". To mora biti eksplicitno i u UI-ju.

## 2.4 Read model — RPC

```sql
-- v1: jedna funkcija pokriva balance_by_group i breakdown
rpc_area_group_agg(
  p_area_id     uuid,
  p_group_slug  text,          -- 'racun' | 'tip'
  p_plus_slug   text,          -- 'uplata'  (NULL = samo count)
  p_minus_slug  text,          -- 'isplata' (NULL dozvoljen)
  p_filter_slug text,
  p_filter_val  text,
  p_as_of       date           -- NULL = sve
) RETURNS TABLE (group_value text, plus_sum numeric, minus_sum numeric, n integer)
```

Tri pravila koja se **ne smiju** prekršiti:

1. **`SECURITY DEFINER` zaobilazi RLS ⇒ funkcija mora sama provjeriti pristup.** Prvi red
   tijela je provjera je li `auth.uid()` vlasnik aree ili ima `data_shares` zapis za nju.
   Bez toga je ovo leak preko cijele baze. (Ovo je i razlog zašto RPC nije napisan davno.)
2. **P2 parent eventi se NIKAD ne zbrajaju.** Roditeljski eventi nose iste atribute
   (P1/P3), pa bi `Uplata` s leafa i s roditelja dala dvostruki iznos. Agregira se samo po
   leaf kategorijama. Za Financije je leaf L1 `Transakcija` pa parenata nema, ali pravilo
   mora stajati u funkciji, ne u pretpostavci.
3. **Čita se `value_number`, ne parse teksta.** Veže se na backlog stavku „Potpuni attrFilter
   za number/boolean/datetime".

Filtar po `attribute_definition_id` (imamo ga nakon slug resolvea) — **nikad `ILIKE` preko
cijele `event_attributes`** (BUG-S103-ANYATTR).

## 2.5 Faze

**Faza 1a — dokaz modela salda u Pythonu (XS), PRIJE koda.** Cijela pločica stoji na tome da je
broj točan, a to se dokazuje nad 4.996 stvarnih redaka bez ijednog reda TypeScripta. **Tri
provjere:**

1. **Reproducira li `Izvor ∈ {Racun, Cash}` (§2.10) `Saldo kontrola` sheet?** — tamo je nakon
   S107k ostalo **7 razlika** (od 10; sve ostalo balansira u cent). Ista formula mora dati iste
   brojke, i **isti popis od 7** — ni manje ni više. Novo neslaganje = model je kriv;
   nestalo neslaganje = model tiho krije pravu razliku.
2. **Je li interni transfer zapisan jednom ili dvaput?** (§2.14) — ako jednom, jedan račun je
   kriv za cijeli iznos i model treba dopunu.
3. **Koliko „planirano" ostaje po kanti** (§2.13) — dospjelo / uskoro / kasnije, oba smjera.
   Provjera zdravog razuma: ako je „dospjelo" velik broj, znači da povijesni uvoz nosi rate
   koje su davno naplaćene a stoje kao `Planiran`.

**Faza 1 — `balance_by_group` (S–M).** `sql/034_area_group_agg.sql` + hook + jedna pločica
prikazana iznad Activities liste za Financije. Konfiguracija se piše u obliku iz §2.3 **već
sad**, čak i ako je zasad hardkodirana za jednu Areu. Ovo je F1 fix.

**Faza 2 — brzi unos (S–M).** Podskup atributa u Add Activity + zapamćen zadnji `Racun`.
Otvoreno pitanje OQ-2 dolje.

**Faza 3 — odluka (nije kod).** Koka proba 1+2 na mobitelu. Prolaz/pad određuje nastavak.

**Faza 4 — Overview tab (M).** Tab skeleton, ostale pločice, konfigurator, `Dashboard` sheet
u Structure roundtripu (isti obrazac kao `Automations`, S107t) — time novi ključ
`AreaSettings` **ne otvara novu rupu** u principu „sve ide importom", nego se rodi pokriven.
Tada `AreaSettings` roundtrip pokriva 4 od 5 ključeva; ostaje samo `export_profiles`.

**Faza 5 — cross-Area.** `Analytics_tab.md` Faza 1 nadalje. Čeka drugu gustu Areu.

## 2.5a Dospjele rate — zašto NE automatski `Planiran → Izvršen`

Razmotreno i **odbačeno** (2026-08-11). Prijedlog je bio: na pokretanju aplikacije prebaci
u `Izvršen` svaku ratu kojoj je `Datum naplate` prošao.

**Zašto ne:** dospjeli datum **nije dokaz da je banka naplatila.** Kartica se zamijeni,
plaćanje padne, pretplata se otkaže, banka knjiži dan-dva kasnije. U svim tim slučajevima
automat pomakne saldo i **aplikacija sama proizvede razliku prema banci** — napad na jedini
kriterij zbog kojeg bi Koka prešla.

Asimetrija grešaka je odlučujuća:

| | saldo | vidljivost |
|---|---|---|
| automat NE flipne, a banka je naplatila | u zaostatku | **ona to vidi i popravi** |
| automat flipne, a banka nije | pogrešan | **izgleda točno** |

Prva greška se sama prijavljuje, druga se skriva. Uz to je to masovni tihi upis nad tuđim
podacima (629 rata redaka), pokrenut satom, na startu — ista klasa stvari zbog koje postoji
update-guard (D7), i isti IO obrazac na koji je S105 upozorio.

**Umjesto toga — „Dospjelo → potvrdi":** pločica na vrhu Overviewa nabraja rate kojima je
`Datum naplate` prošao a `Status` je još `Planiran`, s pojedinačnom i skupnom potvrdom. Ona
u tom trenutku ionako gleda banku, pa je potvrda nula dodatnog posla — a **njen pogled je ono
što broju daje težinu.** I dalje je manje posla nego u Excelu, gdje redak mora ručno
premjestiti gore.

Prelazak na pravi automat ostaje moguć kasnije, kad povjerenje postoji. Početi s automatom je
pogrešan default.

## 2.6 Rizik konvergencije (svjesno prihvaćen)

`dashboard.widgets[]` i `analytics_views.series[]` su **rođaci** — oba su „kategorija +
atribut + agregacija". Postoji stvarna opasnost da za godinu dana imamo dva konfiguracijska
jezika za istu stvar.

**Odluka:** ne unificirati sad (Overview treba biti gotov prije nego Series uopće postoji),
ali držati `widget` **podskupom** oblika `AnalyticsSeries` — ista imena polja (`attrSlug`,
`agg`, `bucket`, `attrFilter`). Kad Series dođe, widget se izrazi kao Series bez migracije.

Ono što se **ne** smije napraviti: `dashboard` u `areas.settings` **i** `analytics_views`
tablica koje se preklapaju u nadležnosti. Granica je: konfiguracija vezana **za jednu Areu**
ide u `areas.settings` (i time u Structure roundtrip); konfiguracija **preko Area** ide u
zasebnu tablicu (i time u `AnalyticsDef` sheet).

## 2.7 Otvorena pitanja

- **OQ-1:** Je li `reconcile` samo prikaz, ili se sprema? *Prijedlog: **sprema se**, i argument
  je jači nego prvotni („da se vidi kad je razlika nastala"). **Spremljeno sidro ograđuje
  pretragu:** sve prije potvrđene točke vrijedi kao provjereno, pa se razlika od 49 € traži
  po desetak redaka umjesto po 4.996. Uz to je sidro **sjeme formule** u koloni `Provjera
  stanja` (§2.11) ⇒ bez spremanja ta kolona nema odakle početi. Sidro je **po računu** —
  drukčije nema smisla.*
- ~~**OQ-2:** Brzi unos = zaseban ekran ili profil vidljivih polja?~~ **RIJEŠENO 2026-08-11
  čitanjem koda — ni jedno ni drugo, v. §2.9.** Mehanizam već postoji (Shortcuts / S88).
- ~~**OQ-3:** rate u saldu ili pored?~~ **ODLUČENO 2026-08-11: pored, i razloženo na tri kante
  + dva smjera — v. §2.13.** Banka planirano ne vidi, pa bi zbrajanje odmah rasparilo saldo s
  Kokinim kriterijem.
- ~~**OQ-4:** Overview za Areu bez konfiguracije — prazan tab ili nema taba?~~
  **ODLUČENO 2026-08-11 (Saša): nema taba.** Prazan tab je poziv na razočaranje.
- ~~**OQ-6:** ograničiti Koki Structure/Edit Mode?~~ **ODLUČENO 2026-08-11 (Saša): NE
  ograničavati.** Vlasnik je (D6) pa bi zaključavanje vratilo ovisnost o Saši; Edit Mode je
  ionako zaseban toggle (dva klika, ne jedan); a novi ključ `AreaSettings` tražio bi i svoj
  stupac u roundtripu, inače se gubi pri prijenosu aree.

**✅ Nema više otvorenih odluka — specifikacija je spremna za Fazu 1a.**
- **OQ-5:** Ostaje li `Stanje` atribut nakon Faze 1? *Prijedlog: ostaje kao povijesni
  artefakt importa, ali se **prestaje pisati** — inače imamo dvije istine o istom broju.
  Odluku donijeti prije Faze 5 batcheva, ne poslije.*

## 2.9 Brzi unos = postojeći Shortcut (S88), ne novi ekran

Provjereno u kodu 2026-08-11. Mehanizam je **već izgrađen i testiran**:

| dio | gdje | stanje |
| --- | --- | --- |
| snimka vrijednosti atributa u preset | `AddActivityPage.tsx:716–739` („Save as Shortcut") | ✅ |
| `default_attributes` na tablici `activity_presets` | `database.ts:248` | ✅ |
| primjena, s **prioritetom nad `attr.default_value`** | `AddActivityPage.tsx:542–545` (`touched: true`) | ✅ |
| `default_map` drugi prolaz poštuje preset | `AddActivityPage.tsx:552–556` | ✅ |
| skok ravno u Add Activity | `onUseShortcut` u `ProgressiveCategorySelector` | ✅ |

Znači shortcut *„ZABA Mastercard trošak"* (Racun + Izvor + Status + Tip/Podtip unaprijed
popunjeni, korisnik upiše samo iznos) **radi već danas**.

**Fale dvije sitnice:**

1. **Prefilana polja se ne skupljaju.** `isHiddenByDefault` (`AttributeChainForm.tsx:216–222`)
   uspoređuje s `attr.default_value` iz definicije, ne s vrijednošću iz shortcuta ⇒ korisnik
   vidi svih 15 polja, samo popunjenih. **Fix:** tretirati „vrijednost došla iz preseta i nije
   ručno dirana" isto kao „na defaultu" (postojeći S107f collapse tada radi posao).
2. **Dropdown shortcuta je ravan popis** — `presets.map(...)`
   (`ProgressiveCategorySelector.tsx:711`). **Fix:** `<optgroup>` po Arei; `area_id` **već
   postoji** na svakom presetu, dakle nema promjene sheme. Unutar grupe sortirati po
   `usage_count`/`last_used` (već se broje, ne koriste se za redoslijed).

⚠ **Grupirati da, filtrirati ne.** Sakrivanje shortcuta drugih Area je kružno — posao
shortcuta je upravo da te *prebaci* u drugu Areu.

## 2.10 ⚠ Što stvarno miče saldo — `Izvor`, ne `Racun` (inače dvostruko brojanje)

**Najozbiljniji nalaz u ovoj specifikaciji.** Naivni `balance_by_group` (zbroji sve po
`Racun`) daje **krivi broj**, i to odmah.

Na jednom tekućem računu postoje **oba** zapisa iste potrošnje:
pojedinačne kartične kupovine (`Racun = Sašin RF`, `Izvor = Visa`) **i** skupna naplata
kartice (`Transfer | izmedju racuna`). Zbroj po `Racun`u ih broji dvaput.

Uzrok: `Racun` ne znači „račun čiji se saldo miče", nego **„račun na koji se to na kraju
naplati"** (odluka 2a, S107i — svi PBZ Visa retci nose `Racun = Sašin RF`). Ono što miče
saldo je **`Izvor`**:

| `Izvor` | miče saldo | gdje se prikazuje |
| --- | --- | --- |
| `Racun`, `Cash` | odmah | **izvršeno** (glavni broj) |
| `Visa`, `Mastercard` | tek kroz skupnu naplatu | **„+ planirano"** |

Skupna naplata je `Izvor = Racun` pa uđe u izvršeno u trenutku kad je banka stvarno knjižila —
točno kako se ponaša i na izvatku.

**Verifikacija PRIJE koda (korak 1a):** `Saldo kontrola` sheet već uspoređuje Kokino stanje na
datum zatvaranja izvatka s bankovnim `NOVO STANJE` — nakon S107k ostalo je **7 razlika od 31
mjeseca**, sve ostalo balansira u cent.
Isto pravilo se pusti u Pythonu nad Reviewom i usporedi s tim brojkama. ⇒ pravilo se dokazuje
na **4.996 stvarnih redaka prije nego RPC uopće nastane**. Ako padne, saznali smo besplatno.

⚠ Ovo je i test za `p_filter_slug` iz §2.4: filtar pločice nije `status`, nego **`izvorplacanja`**
(uz `status` za planirano). Konfiguracija iz §2.3 to podnosi bez promjene oblika.

## 2.11 Usklađenje u Excelu — kolona `Provjera stanja` (Sašin prijedlog, 2026-08-11)

Rješava ono što je najveća frikcija UI varijante: **ne prepisuje se nijedan broj.**

U izvezeni file ide kolona s **pravom Excel formulom** — tekući zbroj, ekvivalent njenog
`=F655+D656-E656`. Ona dopiše nove retke, formula se preračunava dok tipka (ista neposrednost
koju ima danas), i kad zadnji redak pokaže broj koji istovremeno vidi u bankovnoj aplikaciji —
**uveze**. Usporedba je vizualna, greška nikad ne uđe u bazu.

Tri uvjeta:

1. **Sidro je sjeme formule.** Tekući zbroj mora odnekud početi = zadnje potvrđeno stanje ⇒
   **OQ-1 i ova kolona su ista stvar**, ne dvije.
2. **Sortiranje najstarije-prvo** za taj export profil (lanac ide prema dolje). Postojeći
   `export_profiles` već nosi override sortiranja.
3. **Kolona se pri uvozu ignorira** — izvedena je. Ide skroz desno, gdje `parseDataRows`
   ionako ne gleda (isti prostor u kojem već žive `Result`/`Source row`/`Changed`, S107w).

**Dva puta usklađenja, različiti poslovi — oba pišu u isto sidro:**

| put | gdje | kada |
| --- | --- | --- |
| Excel + `Provjera stanja` | laptop | periodično **pravo** usklađenje, bez prepisivanja |
| ✓ / Δ u Overviewu | mobitel | brzi pogled „štima li otprilike" |

**Njene korekcije prežive selidbu bez promjene navike:** redak korekcije = običan novi zapis;
korekcija utopljena u postojeći redak = izmjena, koju hvata `row_hash` + update-guard (D7).

## 2.12 Izračunata kolona `Stanje` u Activities listi

Njena Excelica nema *jedan* saldo nego **saldo uz svaki redak**. To nije isti zahtjev: jedan
broj kaže *„nešto ne štima"*, kolona kaže *„ne štima OD OVOG RETKA"*. Za traženje greške to je
razlika između beskorisnog i korisnog.

**Jeftino je:** lista je već najnovije-prvo, a ukupni saldo dolazi iz RPC-a ⇒ saldo svakog
retka se izračuna **iz same vidljive stranice**, silazeći (`saldo(i) = ukupno − Σ novijih`).
Ne povlači se povijest; radi i s „Load next 20".

Dva uvjeta, oba prirodna:
- **samo kad je lista filtrirana na jedan račun** (miješani računi = besmislen tekući zbroj) —
  a to je točno ono što drill s Overviewa radi;
- **samo u kanonskom datumskom poretku** — presortiranje po drugoj koloni kolonu obesmišljava
  pa mora nestati.

⚠ **Ovo odlučuje OQ-5:** ako se `Stanje` računa, stari upisani atribut `Stanje` mora **prestati
biti u upotrebi**, inače postoje dvije kolone istog imena s različitim brojem.

## 2.13 „Planirano" treba horizont i dva smjera (odluka 2026-08-11)

Jedan broj „+ planirano" ne odgovara ni na jedno pitanje: Anjinih 96 rata seže **osam godina**
naprijed, pa isti zbroj miješa ratu koja stiže za tri dana i ratu iz 2032.

**Tri kante — tri različita mentalna stanja:**

| kanta | definicija | čemu služi |
| --- | --- | --- |
| **Dospjelo** | `Status = Planiran` ∧ `Datum naplate ≤ danas` | **potvrda** (traka s vrha, §2.5a) |
| **Uskoro** | sljedeći ciklus (~30 dana) | *„hoću li imati dovoljno"* |
| **Kasnije** | sve ostalo | obveza, ne novčani tok — **ovdje toggle ima smisla** |

**⚠ `Dospjelo` mora biti IZVEDENO, ne spremljeno.** Ako postane treća vrijednost `Status`
atributa, netko je mora upisati — a to je **točno onaj automat koji je §2.5a odbacio**, samo pod
drugim imenom. Izvedeno ne može zastarjeti, ne piše ništa i računa se u istom upitu. Dodatno:
nova vrijednost `Status`a živjela bi i u `validation_rules` **i** u `value_text` svakog zapisa
(rizik S105d) bez ikakve koristi.

**Dva smjera, ne jedan.** Planirani **prihodi** koriste isti mehanizam (`Uplata` + `Planiran`) —
i Kokina mirovina je točno to (`Mirovina I/II/III stup`, svaki mjesec). Zato „planirano" nisu
jedan nego **dva broja**: `−218,00` odlazi / `+1.350,22` dolazi. Tek tada odgovara na *„hoću li
imati dovoljno"*, što je jedino pitanje zbog kojeg se planirano gleda.

## 2.14 Transfer — isti redak, različito pravilo po pločici

Drugi problem od Visa lumpa (§2.10), ne isti:

| pločica | Transfer retci | zašto |
| --- | --- | --- |
| `balance_by_group` | **broje se** | novac je stvarno otišao s računa; izostavljanje razilazi saldo s bankom |
| `breakdown` (trošak po Tipu) | **izbacuju se** | prebacivanje između vlastitih računa nije potrošnja i napuhuje razrez |

Isti redak dakle ulazi u jednu pločicu a ne u drugu — normalno, ali mora biti zapisano da se ne
„popravi" kasnije kao nedosljednost.

**⚠ Empirijsko pitanje za Fazu 1a:** je li interni transfer u podacima zapisan **jednom ili
dvaput**?
- **dvaput** (isplata na jednom računu, uplata na drugom) → oba salda točna, ništa se ne dupla
- **jednom** → jedan račun je kriv **za cijeli iznos**

Ne da se pogoditi iz koda — mjeri se nad Reviewom.

## 2.8 Što ovo NE mijenja

Migracija (`FINANCIJE_MIGRACIJA.md` §13) teče paralelno i nepromijenjeno — to je podatkovni
posao. Jedina veza je Faza 3: cutover se **ne izvodi** dok se ne zna bira li Koka aplikaciju.

---

## Vizualna skica

Overview tab u tri varijante — **Financije (široki ekran)**, **Financije (mobitel — pogled koji
odlučuje)**, **Fitness (ista mehanika, drugi rezultat)** — plus tablica „pločica → konfiguracija
→ što nacrta" i pet otvorenih pitanja označenih na mjestu gdje se javljaju:

**https://claude.ai/code/artifact/5a5dcb5e-c7d4-4795-befd-689d3a3ee965**

(Privatna stranica; vidljiva samo Saši dok je ne podijeli.)

---

*Sljedeći korak: Sašin pregled ovog dokumenta + skice → odluka o OQ-1…OQ-5 → Faza 1.*
