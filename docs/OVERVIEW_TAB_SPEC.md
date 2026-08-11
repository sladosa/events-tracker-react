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

- **OQ-1:** Je li `reconcile` (upiši stanje iz banke → vidi razliku) samo prikaz, ili se
  sprema? *Prijedlog: sprema se — `area.settings.dashboard.reconcile_snapshots[]` po računu
  i datumu. Bez povijesti se ne vidi kad je razlika nastala, a to je jedino pitanje koje
  Koku zanima kad se ne slaže.*
- ~~**OQ-2:** Brzi unos = zaseban ekran ili profil vidljivih polja?~~ **RIJEŠENO 2026-08-11
  čitanjem koda — ni jedno ni drugo, v. §2.9.** Mehanizam već postoji (Shortcuts / S88).
- **OQ-3:** Prikazuje li `balance_by_group` planirane rate u saldu ili samo pored njega?
  *Prijedlog: pored — banka ih ne vidi, pa bi ih zbrajanje odmah rasparilo s Kokinim
  kriterijem („slaže li se s bankom").*
- **OQ-4:** Overview za Areu bez konfiguracije — prazan tab, ili se tab ne prikazuje?
  *Prijedlog: ne prikazuje se. Prazan tab je poziv na razočaranje.*
- **OQ-6:** Treba li Koki ograničiti Structure/Edit Mode na vlastitoj Arei? *Prijedlog: ne —
  vlasnik je (D6), a zaključavanje vraća ovisnost o Saši. Redoslijed tabova (Structure treći)
  je dovoljan. Postavka po Arei tek ako se pokaže potreba; svaki novi ključ `AreaSettings`
  otvara i novu rupu u roundtripu dok se ne pokrije sheetom.*
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
