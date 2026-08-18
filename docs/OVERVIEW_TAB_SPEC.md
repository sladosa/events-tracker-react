# Overview tab — dashboard po Arei (spec + plan rada)

**Datum:** 2026-08-11, dopunjeno 2026-08-15 · **Status:** ODOBRENO — Faza 1 spremna za kod
**Povod:** sesija S107x — frustracije F1/F2 (zašto Koka i dalje bira svoj Excel)
**Zadnje odluke (2026-08-15):** §2.15 (gdje živi konfiguracija — univerzalnost),
§2.16 (preset vs widget), §2.17 (**saldo se računa od sidra**) + revidiran opseg Faze 1
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
| 0 | Delete testovi → PROD deploy | Saša | ✅ 2026-08-12 |
| 1 | **Kokina delta** u TEST (uvoz kao `N/A`) | Saša | ničemu |
| 2 | **Stanje po računu** — RPC + ljuska taba + pločica sa sidrom | Claude | ničemu |
| 3 | **Brzi unos** (= Shortcut + 2 sitnice, §2.9) | Claude | 2 |
| 4 | Koka proba na TEST-u (mobitel) → **odluka o cutoveru** | Koka | 1+2+3 |
| 5 | Overview tab dovršen + ostale pločice + `Dashboard` sheet | Claude | 4 |
| 6 | Batchevi 2024/2023 | Saša | ne blokira cutover (§2.17) |
| 7 | Cross-Area (`Analytics_tab.md`) | — | druga gusta Area |

Koraci 1 i 2 ne ovise jedan o drugom i idu paralelno (1 je Sašin ručni rad, 2 je Claudeov kod).

⚠ **Batchevi 2024/2023 su ispali s kritičnog puta** (§2.17): sidro čini saldo točnim od dana
potvrde bez obzira na staru povijest. Idu zbog analize i AI sloja, ne zbog salda.

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

**Faza 1a — dokaz modela salda u Pythonu (XS), PRIJE koda. ✅ IZVRŠENO 2026-08-12.**
Alat: `data-prep_tools/Financije/verify_saldo_model.py` (READ-ONLY nad Reviewom).
Puni nalazi: `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` + `saldo_model_nalazi.xlsx`.

1. **Pravilo `Izvor ∈ {Racun, Cash}` (§2.10) ✅ POTVRĐENO.** *(Povijesni zapis mjerenja od
   2026-08-12. `Cash` je iz filtra izbačen 2026-08-18 — v. §2.10; mjerenje time nije ugroženo
   jer na ZABA-i nema nijednog `Cash` retka.)* Reproducira **bankovni pomak u
   17/30 mjeseci u cent**; naivni zbroj po `Racun`u u **0/30**. Bruto dvostruko brojanje:
   56.894 € (ZABA), 81.591 € (RF).
   ⚠ **Traženi test „isti popis od 7" pokazao se neizvedivim, i to je nalaz.** `Saldo kontrola`
   uspoređuje *razinu* Kokinog ručnog `Stanje` s bankom, a taj se stupac u ovom fileu ne može
   hodati: Review je presortiran po `event_date` (S107i), pa lanac puca na **969 od 2.564**
   mjesta. Usporedba razine mjerila bi artefakt sortiranja. Zato se mjeri **pomak protiv banke**
   (neovisan o sidru). Presjek s onih 7 je samo `2026-05` — očekivano, jer su to različite
   veličine. **➡ Potvrđuje OQ-5:** `Stanje` nije upotrebljiv kao istina, prestaje se pisati.
2. **Transfer ✅ zapisan DVAPUT** — 90,6 % *iznosa* međuračunskih transfera je dvostrano
   (23.789 € od 26.270 €) ⇒ oba salda točna. Prije mjerenja treba razvrstati po ulozi: naplata
   kartice (108), bankomat (78) i „druga osoba" (38) **nemaju** protupartiju po definiciji.
   ⚠ Mjerodavan je udio po iznosu, ne po komadima (42,5 % kom. vodi u suprotan zaključak).
3. **§2.13 (tri kante) ⏸ NEPROVJERLJIVO na ovim podacima.** `Planiran` ima 15 redaka i svih 15
   je dospjelo; `Uskoro`/`Kasnije` prazne — jer buduće rate u Reviewu **ne postoje kao retci**
   (generira ih rata modal nakon importa). **Ne smatrati potvrđenim do prvog importa.**
   Dobra vijest: od 629 `Rate?=DA` samo 11 stoji kao `Planiran` ⇒ povijesni uvoz **ne** nosi
   davno naplaćene rate kao planirane.

**Posljedica za Fazu 1:** 13 rezidualnih mjeseci znači da će `✓/Δ` čip pokazivati Δ i kad je
model točan. To je **potvrda dizajna §2.11**, ne greška — Δ je signal da nešto fali/je dvaput/je
krivo, i već je izbacio 4 konkretna slučaja (v. NALAZI §3.1). Model se **ne smije** „ugađati" da
Δ nestane.

**Faza 1 — `balance_by_group` (S–M).** Opseg revidiran 2026-08-15 nakon Sašinih prigovora
(§2.15 univerzalnost, §2.17 sidro):

1. `sql/035_area_group_agg.sql` (⚠ ne 034 — zauzeo ga `034_s107w_test_area.sql`) — generički
   RPC po §2.4; u potpisu **nema riječi „Financije"**
2. `sql/036_balance_anchors.sql` — tablica sidara (§2.17), **ne** `areas.settings`
3. **Ljuska Overview taba**, ne blok iznad Activities liste. Tab postoji **iff** Area ima
   `dashboard` konfiguraciju (OQ-4); redoslijed `Overview → Activities → Structure`.
   Konfigurator UI **se ne gradi** (N=1, §2.15) — konfiguracija se upiše ručno.
4. Pločica `balance_by_group` **sa sidrom i `✓/Δ` čipom** — bez sidra broj nije usporediv s
   bankom, a to je jedini razlog zašto pločica postoji
5. **Fixup `dashboard.widgets[]` referenci pri renameu sluga** (§2.15, S105d klasa)
6. **Kopiranje `areas.settings` u „From template"** (§2.15 — provjerena rupa)

Kandidat za isti potez: izračunata kolona `Stanje` u Activities listi (§2.12) — bez nje drill
s pločice vodi u listu koja je za traženje greške neupotrebljiva.

Ovo je F1 fix. Konfiguracija se piše u obliku iz §2.3 **već sad**.

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

- ~~**OQ-1:** Je li `reconcile` samo prikaz, ili se sprema?~~ **ZATVOREN 2026-08-15 (Saša):
  sprema se, i to je NOSIVO — v. §2.17.** Sidro ne ograđuje samo pretragu nego **definira
  saldo**. Podignuto s „lijepo bi bilo" na „ovako je saldo definiran".
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
| `Racun` | odmah | **izvršeno** (glavni broj) |
| `Visa`, `Mastercard` | tek kroz skupnu naplatu | **„+ planirano"** |
| `Cash` | **nikad** — podizanje je već oduzelo novac | samo u razrezu po `Tip`u |

Skupna naplata je `Izvor = Racun` pa uđe u izvršeno u trenutku kad je banka stvarno knjižila —
točno kako se ponaša i na izvatku.

### ⚠ `Cash` je izbačen iz filtra (2026-08-18, S111) — ista greška, drugi pot

Prvotni filtar bio je `Izvor ∈ {Racun, Cash}` i **bio je pogrešan iz istog razloga zbog kojeg
je pogrešan naivni zbroj po `Racun`u** — samo se nije imao gdje pokazati.

Gotovina je **pot kao i kartica**, i zrcalna joj je:

| | puni pot | prazni pot | u saldo ulazi |
| --- | --- | --- | --- |
| **Visa / MC** | pojedinačne kupovine `Izvor=Visa` | skupna naplata `Transfer \| izmedju racuna` | **skupna naplata** |
| **Gotovina** | podizanje `Transfer \| cash - bankomat` | pojedinačni troškovi `Izvor=Cash` | **podizanje** |

U oba slučaja novac napusti banku **jednom**, kroz jedan `Transfer` redak. Zato gotovinski
trošak ne smije ulaziti u bankovni saldo — on opisuje **što se s već podignutim novcem
dogodilo**.

**Nalaz koji je to otkrio** (mjereno, ne zaključeno): `Sašin tekući RF`, 18.05.2026. podizanje
`−150,00` (`Transfer | cash - bankomat`, `Izvor = Racun`), 20.05.2026. trošak `−66,00`
(`Izvor = Cash`, „Promjena guma"). Banka je izgubila 150 €; baza ih je oduzimala **216 €**.

**Zašto se nije vidjelo 18 mjeseci:** u cijeloj Arei postoji **46 podizanja** i **točno jedan**
gotovinski trošak. Verifikacija 17/30 mjeseci stoji netaknuta jer na ZABA-i nema nijednog
`Cash` retka — staro pravilo bilo je istinito na podacima na kojima je mjereno.

**Zrcalno pravilo, dvije osi.** `Transfer` **ulazi u saldo, izlazi iz razreza** po `Tip`u;
gotovinski trošak **izlazi iz salda, ulazi u razrez**. Nije nedosljednost nego isti princip:
svaki euro točno jednom u svakom pogledu. Vrijedi i za gotovinu dobivenu izvana (netko ti da
novac za protuuslugu): `Izvor = Cash`, `Tip = Prihodi` — banka je nije vidjela, razrez jest.

**Odbačena alternativa — `Gotovina` kao pravi račun.** Nova vrijednost atributa `Racun`; pločica
bi ju prikazala **bez ijedne linije koda** (test §2.15), a mogla bi se i sidriti — prebrojati
novčanik je isti epistemički čin kao pogledati bankovnu aplikaciju (§2.18, *očitanja vanjske
istine*). Odbijeno jer traži **drugi redak uz svako podizanje** (46 unatrag) i disciplinu
bilježenja **svakog** gotovinskog troška, inače pot tiho odluta. Za 1 redak na 2.220 preskupo —
i posao bi pao na Koku, na mjestu gdje ga pokušavamo smanjiti (Sašina odluka, 2026-08-18).
⇒ Cijena koju svjesno plaćamo: **stanje novčanika se ne zna.** Prijelaz na tu varijantu poslije
ne stvara dug — današnja odluka ne dira nijedan podatak, samo `filters` u configu.

**Verifikacija PRIJE koda (korak 1a): ✅ IZVRŠENA 2026-08-12 — pravilo POTVRĐENO.**
Mjereno je nad 4.996 stvarnih redaka, prije nego je RPC nastao: model reproducira **bankovni
pomak u 17/30 mjeseci u cent**, naivni zbroj po `Racun`u u **0/30**. Detalji i zamke u
`data-prep_tools/Financije/SALDO_MODEL_NALAZI.md`.

⚠ **Mjeri se pomak, ne razina.** Prvotna zamisao (usporediti izračunatu razinu s Kokinim
`Stanje` stupcem preko `Saldo kontrola`) ne radi jer je taj lanac razbijen sortiranjem Reviewa
po `event_date` — 969 puknuća od 2.564. Pomak protiv bankovnog `NOVO STANJE` je neovisan o
sidru, pa jedna rana greška ne razmazuje se kroz svih 31 mjesec.

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

**⚠ Empirijsko pitanje za Fazu 1a: ✅ ODGOVORENO 2026-08-12 — zapisan je DVAPUT.**
**90,6 % iznosa** međuračunskih transfera ima protupartiju na drugom računu (23.789 € od
26.270 €) ⇒ oba salda točna, ništa se ne dupla.

Uvjet za ispravno mjerenje: `Transfer` retke treba **prvo razvrstati po ulozi**, jer većina ih
po definiciji nema protupartiju — naplata kartice (108 redaka, druga strana je kartica),
bankomat (78, druga strana je novčanik) i „druga osoba" (38, tuđi račun). Samo `izmedju racuna`
(73) smije imati par.

Preostalih 42 jednostranih (Σ 2.481 €) su **pogrešna labela** — idu Seki, Neni, Revolutu, APN-u,
a označeni su `izmedju racuna`. Saldo ne kvare, ali po gornjoj tablici ispadaju iz razreza po
Tipu ⇒ **popraviti prije `breakdown` pločice**, ne prije `balance_by_group`.

## 2.15 Gdje živi konfiguracija analitike (odluka 2026-08-15)

**Povod (Sašin prigovor):** *„pločica iznad Activities liste kad je filtar na Financije_all"*
ruši univerzalnost aplikacije. **Prigovor prihvaćen** — v. izmjenu Faze 1 u §2.5.

### Zašto je analitika drukčija od Activities/Structure

Activities i Structure su generični jer rade nad **oblikom** modela: svaka Area ima kategorije,
atribute, evente, i alatu je dovoljno da postoje. Analitika ne može tako — da izračuna saldo,
netko mora znati koji je atribut *novac unutra*, koji *van*, po čemu se grupira, i koje
vrijednosti znače *„već se dogodilo"*.

**Model tu semantiku ne nosi.** `Uplata` je bazi običan `number`, isti kao `Težina`. Zato
konfiguracija pločice nije „postavka" nego **taj nedostajući sloj značenja** — preslikavanje
generičkih EAV atributa u uloge koje računu trebaju.

### Četiri sloja, četiri mjesta

| sloj | što je | gdje živi | putuje s Areom? |
| --- | --- | --- | --- |
| **rječnik** | koji tipovi pločica postoje (`balance_by_group`, `breakdown`, `trend`, `count`, `latest`) | **u kodu** (RPC grana + renderer) | n/p |
| **semantika jedne Aree** | koji slug je plus, koji grupa, što je „izvršeno" | `areas.settings.dashboard` → `Dashboard` sheet | **da** |
| **semantika preko Area** | Series, `periods` (`Analytics_tab.md`) | **zasebna tablica** → `AnalyticsDef` Excel | ne (nema vlasnika među Areama) |
| **sidro salda** | potvrđeno stanje po računu | **zasebna tablica** (v. §2.17) | **ne smije** |
| trenutno stanje | filtar, raspon, drill | `FilterContext`, ne perzistira | n/p |

**Rječnik je u kodu namjerno, ne kao kompromis.** Presedan postoji: `data_type` atributa
(`text`/`number`/`datetime`/`boolean`/`suggest`) je isto rječnik u kodu — korisnik ne izmišlja
nove tipove podataka, slaže iz postojećih. Pločice su isto na razini više.

### Ovo nije nov obrazac — treći je put

`areas.settings` već nosi dva ista slučaja. `automations.attribute_rules` kaže *„atribut
`datum_naplate` dobiva vrijednost iz `izvorplacanja` po ovoj mapi"* — doslovno ista stvar:
**dodjela uloga slugovima da bi generički motor mogao djelovati** (`attributeRules.ts` ne zna
ništa o Financijama, zna samo `same`/`next:N`). `export_profiles` isto.

### Test generičnosti

> **Nova Area smije tražiti nula linija koda — samo konfiguraciju.**

Ako Fitness traži „broj treninga po mjesecu", to mora biti `count` + `bucket: month` nad
postojećim atributima. Ako traži kod, ili rječniku fali unos, ili to pitanje nije analitika.

Praktično: pločice su parametrizirane **po ulogama** (`group`/`plus`/`minus`/`filter`/`bucket`),
nikad po domeni. Isti `balance_by_group` s drugim slugovima odgovara na „stanje po računu",
„kalorije po tjednu" i „sati po projektu".

⚠ **Iskren rizik: generaliziramo iz N=1.** Ne znamo je li rječnik stvarno generičan dok ga
druga gusta Area ne upotrijebi. Zaštita: oblik widgeta je **podskup** `AnalyticsSeries` (§2.6),
i **konfigurator se ne gradi dok N nije 2** — inače betoniramo pogrešan rječnik u UI.

### Ime Aree i slugovi — dvije krhkosti

Konfiguracija živi **unutar retka te Aree**, pa se ime nigdje ne spominje: `Financije_all` →
`Financije_Bulatova` → `Financije` je preimenovanje jednog stupca. Ali:

1. **Ne ponoviti grešku `export_profiles`** — njegov ključ je `attr:Area||CatPath||AttrName` pa
   ne preživi rename. Dashboard config referencira **samo slugove atributa**, nikad ime aree
   ni putanju kategorije.
2. **Slug atributa nije nepromjenjiv** ⇒ rename ga može razbiti (S105d klasa: normalizacija
   sluga je razbila `depends_on`, dropdowni posivili). `StructureNodeEditPanel` već popravlja
   `depends_on` reference pri promjeni sluga — **mora popravljati i `dashboard.widgets[]`.**
   To ide u Fazu 1, ne kasnije.

### „Tip Aree" = Template, i to samo u trenutku nastanka

U shemi nema `area_type` i ne treba ga. Scenarij *„Igor uzme nešto financijskog oblika pa
prilagodi svom jeziku i situaciji (firma + privatno)"* pokriva **Template sustav** (S49–S58):
uzme financijski template, preimenuje račune, doda `Kontekst = firma/privatno`, izbaci suvišno.
Nema flag koji ga drži u „finance" ladici.

Igorovo firma/privatno je usput dobar test rječnika: može biti **dvije Aree** (svaka svoj
dashboard) **ili jedna Area s atributom `Kontekst`** i pločicom koja po njemu grupira — oba
rade s istim `balance_by_group`, bez linije koda.

⚠ **Provjereno 2026-08-15: „From template" NE kopira `areas.settings`**
(`StructureAddAreaPanel.tsx:275` kopira `name`, `slug`, `icon`, `color`, `description`).
Igor bi dobio strukturu **bez** automatike i bez dashboarda. Ista rupa kao u principu „sve ide
importom", samo na drugom putu → **popraviti u Fazi 1** (uz odluku kopira li se `export_profiles`).

## 2.16 Preset (Shortcut) vs widget — rođaci koji se ne smiju spojiti

**Sašino zapažanje:** Shortcut sustav je usko vezan uz filtriranje, pa izgleda kao ista stvar
kao widget. Poveznica je stvarna, spajanje nije.

`activity_presets` od S96 (`sql/027`) nosi `filter_state`:
`{ periodKey, sortOrder, commentSearch?, attrFilter? }` — dakle preset **već** je „spremljeni
pogled + spremljene vrijednosti za unos". Zajednički komad je **predikat odabira**.

Razlika je u glagolu: **preset piše, widget čita.** Preset nosi vrijednosti koje se upisuju u
novi zapis; widget nosi uloge po kojima se postojeći zapisi zbrajaju.

**Zašto se ne spajaju — mehanički, ne estetski:**

| | preset | widget |
| --- | --- | --- |
| vlasnik | **korisnik** (`user_id`) | **Area** |
| referencira atribut preko | **ID-a** (`attrDefId`; `default_attributes` keyed by attr def id) | **sluga** |
| putuje | **nikad** — ostaje u bazi | **mora** preživjeti Structure Excel u tuđu bazu |

Preset smije koristiti ID jer nikad ne napušta bazu i precizniji je. Widget ne smije — nakon
importa u drugu bazu ID-evi ne postoje. Spajanje bi jednom od njih nametnulo krivi izbor.

**Susreću se u runtimeu, ne na disku:** oba se razriješe u isto `FilterContext` stanje.
Isplata: **drill s pločice proizvodi točno filter stanje kakvo preset sprema** ⇒ „Save as
Shortcut" (već postoji) snimi baš taj pogled, bez nove šifre.

**Pravilo za Fazu 1:** widgetov `filter` mora se moći razriješiti u `PresetFilterState` oblik.
Ako ne može, ili je widget izmislio nešto što filtar ne zna, ili filtru fali mogućnost — bolje
vidjeti odmah nego kad se drill pokaže kao slijepa ulica.

## 2.17 Saldo se računa OD SIDRA, ne od početka povijesti (odluka 2026-08-15)

**Sašin prigovor:** *„opasno je ići u duboku prošlost i računati stanje svaki put od početka —
Koka je jako ponosna na to da joj se sve u Excelici slaže u cent."*

**Prihvaćeno, i to mijenja definiciju salda.**

### Zašto — i koji argument je zapravo nosio

**Brzina nije pravi razlog.** ~5.000 eventa je za Postgres ništa (indeksi 024/032 postoje), a
sidro ne mijenja oblik upita (isti EAV pivot), samo dodaje datumski filtar. Dobitak je stvaran
ali marginalan.

**Povjerenje jest.** Da se Koki sve slaže u cent nije taština nego **njena kontrola kvalitete**.
A u podacima znamo da postoji **13 rezidualnih mjeseci** i **69 označenih loših redaka**
(`SALDO_MODEL_NALAZI.md` §3). Zbroj od 1.1.2023. bi gotovo sigurno promašio banku, a njen bi
zaključak bio *„aplikacija je kriva, moja Excelica je točna"* — **i bio bi točan**.

### ⚠ Ispravak ranije tvrdnje u ovom dokumentu

Ranije je stajalo da je sidro opasno jer je „nosivo za točnost, pa krivo sidro daje krivi saldo
koji izgleda točno". **To je bilo naopako.** Analogija s odbačenim automatom (§2.5a) ne vrijedi:
tamo **stroj tvrdi nešto što ne može znati** (da je banka naplatila). Sidro je suprotno —
**čovjek gleda bankovnu aplikaciju i prepisuje broj**, što je najkvalitetniji podatak u sustavu.

I obrnuto: sidro je **robusnije**. Greška u 5.000 redaka tiho pomakne današnji broj i traži se
kao igla u plastu; greška poslije sidra traži se po desetak redaka.

### Definicija

```
saldo = potvrđeno_stanje + Σ(promjene STROGO nakon datuma potvrde)
```

Povijest ostaje u bazi i dalje hrani `breakdown`, `trend` i AI sloj — samo ne hrani glavni broj.

Četiri posljedice:

1. **Sidro NE ide u `areas.settings`.** Config putuje s Areom (template, Structure export), a
   Igor ne smije naslijediti Kokin saldo ⇒ **zasebna tablica** (`area_id`, `group_value`,
   iznos, datum, tko, kad). Ovo je prvi slučaj konfiguracije koja *ne smije* putovati —
   čist kriterij za granicu iz §2.15.
2. **Čuva se povijest potvrda, ne jedna vrijednost.** Jeftino, daje „otkad se razilazi", i
   sjeme je formule za kolonu `Provjera stanja` (§2.11).
3. **⚠ Sidro uvodi vlastiti rizik dvostrukog brojanja** — ista klasa kao `Racun` vs `Izvor`
   (§2.10). Ako se sidro postavi danas, a u bazi su 2025+2026, ti retci **ne smiju** ući u
   zbroj. Pravilo je „strogo nakon", bez iznimke.
4. **Bez sidra → zbroj od početka, ali izričito označen** *(„od početka podataka")*. Nikad tiho.

### Posljedica za redoslijed rada

**Ovo vadi 2023 i 2024 s kritičnog puta.** Ako Koka pri cutoveru upiše stanje po računu s
mobitela, pločica je točna od tog dana bez obzira koliko je 2023. neuredna. Stari batchevi
tada služe analizi i AI sloju — **ne blokiraju prelazak**.

⚠ **Delta je i dalje prva, ali iz drugog razloga nego što se prvo činilo:** sidro popravlja
**glavni broj**, delta popravlja **zapis**. Bez delte joj u aplikaciji fali ~6 tjedana vlastite
povijesti — a to je razlog zbog kojeg ne bi vjerovala ostatku. Pritisak nije „netočnost raste",
nego „posao uvoza raste".

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

## 2.18 Zapis vs. očitanje — razred, ne iznimka (odluka 2026-08-17)

Sašina primjedba: *„smeta me da imamo tako specifičnu tablicu — cijela poanta aplikacije je
općenitost."*

**Provjereno mjerenjem, ne raspravom.** Grep kroz `src/components/overview/`, `overviewApi.ts`
i `useRunningBalance.ts` na `financ|racun|kokin|planiran|izvorplacanja|uplata|isplata|saldo`
daje **tri pogotka, sva tri tekst u tooltipu**. Nula u logici, RPC-ovima, dispatchu pločica.
Shema `balance_anchors` nema financijsku riječ osim `amount`; RPC prima slugove kao parametre.
Jedina domenska stvar je `037` — a on je **podatak, ne shema**.

Dokaz općenitosti: Area „Auto" s `group_by: vozilo`, `plus: natočeno` i sidrom = **očitanje
kilometraže** radi **danas, bez linije koda**. Isto vaga, brojilo struje, zaliha. Obrazac je
**kumulativna veličina + povremeno vanjsko očitanje**, ne „novac".

⇒ **Nelagoda je bila točan detektor, ali je pokazala na ime i tekst, ne na strukturu.**

### Pravilo koje razdvaja dva razreda

| | **zapis** (event) | **očitanje** (sidro) |
| --- | --- | --- |
| što je | što korisnik tvrdi da se dogodilo | što je **vanjski izvor** pokazao na datum |
| pisanje | popravljivo, brisivo, P3 | samo dopisivanje — ispravak je novi redak |
| putuje? | da (Excel roundtrip) | nikad |

**Ne popravljaš mjerilo da bi daska stala.** Zabrana editiranja stanja u financijskim
sustavima **nije financijska osobitost** — isto vrijedi za očitanje vage, brojila, lab nalaza:
zapis je dokaz, a dokaz koji se može naknadno doraditi prestaje biti dokaz (razred „prekršaj
se ne vidi", §2.17).

⇒ Ovo je i **konačni argument protiv selidbe sidara u `Financije_all > Stanja`**: eventi imaju
namjerno **suprotnu** disciplinu pisanja (Edit, P3, roundtrip). Selidba ne bi bila povećanje
općenitosti nego **stapanje dviju disciplina u onu labaviju**. Dvije discipline ⇒ dva doma.
(Jači od argumenta o Δ čipu iz iste sesije, jer nije o plumbingu nego o vrsti zapisa.)

### Dogovoreno, još neizvedeno

`036` je pokrenut **samo na TEST-u** (potvrdio Saša, 2026-08-17), tablica ima 3 retka, na PROD-u
ničega ⇒ **preimenovanje je sada besplatno i nikad neće biti jeftinije.**

1. Generički rječnik: `balance_anchors` → `confirmed_readings` (radni naziv), `amount` → `value`,
   `rpc_area_balance_anchored` → `rpc_area_value_anchored`. **Imena još probrati** — nije hitno.
2. Tekst pločice iz configa, ne iz koda: `confirm_label` / `source_label` ⇒ Financije kažu
   „u banci", Fitness „na vagi". Danas su `bankInput`, „Upiši broj koji piše u bankovnoj
   aplikaciji" i sl. tvrdo u `BalanceByGroupTile.tsx`.
3. §2.15 dobiva **imenovan treći razred** — *očitanja vanjske istine* — umjesto jedne iznimke.
   Razred s jednim članom izgleda proizvoljan; s kriterijem se sljedeći član prepozna sam.

### ⚠ `asOf` se steže na danas — saldo, ne i „planirano" (2026-08-18, S111)

„All time" razrješava `dateTo` na **najnoviji event u Arei**, a s budućim ratama to je
`30.04.2027.` Nestegnuto je to proizvodilo **tri laži odjednom**:

1. zaglavlje je tvrdilo očitanje na dan koji se nije dogodio,
2. razmak svježine se brojao protiv budućnosti (`prije 296 dana`),
3. gumb je nudio **„Potvrdi na 30.04.2027."** — sidro u budućnosti, koje bi po pravilu
   „strogo nakon" **presjeklo sve retke do tada.** Najgora od tri, i tiha.

Pravilo: **budućnost nema saldo, ima planove** — a planovi su već *drugi* broj na pločici.
Zato se steže samo `balance`; `split` („planirano") dobiva **sirovi `asOf`**, jer je rata
datirana u 2027. točno ono što taj broj treba brojati. Dvije upite, dva pravila, namjerno.

Posljedica koju je Saša tražio: razmak `zadnji zapis … · prije N dana` sada mjeri **od danas**,
što je jedino pitanje koje Koku zanima.

## 2.19 ⏸ OTVORENA NIT — što Overview daje pri ulasku dublje u podatke

**Prekinuto zbog vremena 2026-08-17; nastavlja se razgovorom, ne kodom.**

Polazište (Sašine slike): najviša razina je pločica `Stanje po računu`; klik na `3.403,74 €`
radi drill u Activities **s ispravnim stanjem filtera** (`Racun = Kokin tekući ZABA`, raspon
datuma, leaf `Transakcija`). **Taj dio već radi.**

Pitanje je što to mjesto treba dati **dvjema različitim osobama**:

- **Koka** — sve što joj treba da **upiše deltu** od stanja koje ima. (Operativa, ne analiza.)
- **Saša** — analitika: **koliko je potrošeno po `Tip`/`Podtip` taksonomiji**, eventualno
  grafika (pie chart).

**Poveznice na već poznate rupe — provjeriti prije dizajniranja bilo čega novog:**

- **Drill nosi jedan uvjet, a uvjet pločice ima dva** (`Izvor` + `Status`) ⇒ drill danas znači
  „pokaži mi ovaj račun", ne „točno ove retke". Predviđeno u §2.16 kao test; ispalo da
  `FilterContext` nosi jedan `attrFilter`. (Backlog u `CLAUDE.md`.)
- **Amber notica na slici 2** — „7 numeric/other attributes not shown — use Excel Export to
  filter by those" — isti razred: backlog „Potpuni attrFilter za number/boolean/datetime".
- Razrez po `Tip`/`Podtip` je **nova pločica** (`breakdown`), ne proširenje `balance_by_group`.
  Mora proći test §2.15: parametrizirana po ulogama, nula linija koda za novu Areu.
- ⚠ **Transfer izlazi iz razreza po Tipu, a ulazi u saldo** (§2.10) — razrez ne smije naslijediti
  filtar pločice salda nekritički.

*(Na slici 1 vidljivo i očekivano: `Sašin tekući RF` = „od početka podataka · 213 zapisa" +
čip „još nije potvrđeno" — §2.17 točka 4 radi kako je zamišljeno.)*

---

*Stanje 2026-08-17: §2.18 zatvara pitanje doma za sidra (ostaju zasebna tablica, dobivaju
generički rječnik). §2.19 je otvorena nit — drill i analitika. Ostalo nepromijenjeno:
Kokina delta (Saša), Faza 2 — brzi unos (§2.9).*
