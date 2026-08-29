# FILTER_SPEC — filtar kao alat, ne kao jedno polje

**Status:** prijedlog prije koda (S122, 2026-08-29). Ništa od ovoga nije implementirano.
**Isti obrazac kao `RULES_ENGINE_SPEC.md`:** Saša čita, reže što ne treba, pa se kodira.

Povod: Sašino pitanje „bi li se filtar mogao nadograditi". Odgovor je da, ali prvo mora
postojati jedno mjesto na kojem stoji **što** se nadograđuje — dosad je bilo pet natuknica
u backlogu koje se nikad ne sretnu.

---

## 1. Što se danas ne da — i zašto to nije UI problem

### 1.1 Filtar nosi **jedan** uvjet

`FilterState.attrFilter` je jedan objekt ili `null`
([FilterContext.tsx:22](../src/context/FilterContext.tsx#L22)):

```ts
export interface AttrFilterState { attrDefId: string; value: string; isExact: boolean; }
```

Posljedica u svakodnevnom radu (Sašin nalaz S118): **„ZABA i samo uplate"**
(`Racun` + `Smjer`) se ne da složiti. Ista rupa ruši drill s Overview pločice: uvjet pločice
ima **dva** dijela (`Izvor` + `Status`), pa drill znači „pokaži mi ovaj račun", ne „točno
ove retke" (OVERVIEW_TAB_SPEC §2.16).

### 1.2 ⚠ Drugi uvjet se **ne da dodati** proširenjem današnjeg upita

Ovo je jezgra spec-a i razlog zašto posao nije „još jedno polje u formi".

Današnji filtar radi kroz **jedan `!inner` join** na `event_attributes`
([eventQueryBuilder.ts:44](../src/lib/eventQueryBuilder.ts#L44)), pa uvjeti padaju na
**isti spojeni redak**:

```
event_attributes.attribute_definition_id = <Racun>
event_attributes.value_text              = 'ZABA'
```

Dodaš li drugi uvjet, on se veže na **taj isti** redak:
`attribute_definition_id = Racun AND attribute_definition_id = Smjer` — nijedan redak
ne može biti oba atributa, pa je rezultat **uvijek prazan**. Nije stvar dotjerivanja:
dva atributa traže **dva zasebna `EXISTS` podupita**, a to PostgREST ne izražava.

⇒ **Više uvjeta znači RPC.** Vidi §3.

### 1.3 Filtrira se samo tekst

Filterable su samo `text`/`suggest` atributi; ostali se broje i prijave rečenicom
„_N numeric/other attributes not shown — use Excel Export to filter by those_"
([AppHome.tsx:647](../src/pages/AppHome.tsx#L647)). Dakle **„iznos > 500" ne postoji** —
za to se izlazi u Excel. `value_number`, `value_datetime` i `value_boolean` su u bazi,
samo ih upit ne dira.

### 1.4 Shortcutovi su ravan popis kroz sve Aree

Izmjereno na Sašinom telefonu (screenshot, 29.08.): u `Financije_all > Transakcija`
dropdown nudi `Strength`, `Outdoor`, `Gym Z2`, `Sasa_MedVisit` — **nijedan nije iz te Aree**,
a zauzimaju cijeli ekran. `activity_presets.area_id` **postoji i puni se pri spremanju**
([useActivityPresets.ts:73](../src/hooks/useActivityPresets.ts#L73)) — dakle podatak za
sužavanje već postoji, samo se ne koristi. ⚠ Stari zapisi mogu imati `NULL`; to nije greška
nego „globalan" (§5).

### 1.5 Filtar je puknuo tri puta na tri načina

S111 (`DateRangeFilter` auto-init prepisao raspon), S119/S120 (`AppHome` reset efekt obrisao
`attrFilter` pri povratku iz View Detailsa), i S122 (⋮ izbornik odnesen remountom liste).
Sva tri su **isti razred**: stanje filtra živi u komponentama koje se odmontiraju.
Nadogradnja koja doda još stanja bez da to riješi umnožit će razred.

### 1.6 „In any attribute" timeouta grantee-u

`BUG-S103-ANYATTR`: `ILIKE` nije leakproof, pa Postgres evaluira RLS `EXISTS` nad **cijelom**
`event_attributes`. Vlasnik je jeftin (`auth.uid() = user_id`), grantee nije (join na
`data_shares`). Na PROD-u je **Koka vlasnik, Saša grantee** — dakle skupu granu vozi baš onaj
tko najviše filtrira.

---

## 2. Model uvjeta (prijedlog)

```ts
type FilterOp =
  | 'contains' | 'equals' | 'one_of'          // text / suggest
  | 'gt' | 'lt' | 'gte' | 'lte' | 'between'   // number
  | 'before' | 'after' | 'range'              // datetime
  | 'is_true' | 'is_false';                   // boolean

interface FilterCondition {
  attrDefId: string;      // ili ATTR_FILTER_ANY (samo uz 'contains')
  op: FilterOp;
  values: string[];       // 1 vrijednost; 2 za 'between'/'range'; N za 'one_of'
}
```

**Odluka o logici — AND između uvjeta, OR unutar uvjeta. ✅ POTVRĐENO (Saša, S122).**
Uz njegovu ogradu koja se ne smije izgubiti: *„moramo vidjeti kako će to u korištenju
zapravo izgledati"* — dakle model je prihvaćen, **UI još nije**, i §4 se provjerava na
stvarnom unosu prije nego se zabetonira.
„ZABA i uplate" je AND (dva uvjeta). „Visa ili Mastercard" je OR, ali unutar
**istog** atributa ⇒ `one_of`. Time se pokrivaju oba stvarna primjera **bez logičkog
stabla** (zagrade, ugniježđeni AND/OR). Stablo je moguće poslije; UI za njega nije.

**Broj uvjeta: proizvoljan. ✅ ODLUKA (Saša, S122).** UI nosi `+ dodatni uvjet`, ne fiksna
dva polja. Za RPC je svejedno (petlja po uvjetima); za UI znači da popis uvjeta mora biti
**popis**, ne dva imenovana retka — i da svaki čip nosi vlastiti ✕.

⚠ **Bez `NOT`. ✅ ODLUKA (Saša, S122):** *„uvijek se u Excelu mogu raditi egzotičniji
upiti."* To je šire pravilo nego jedna funkcija i vrijedi ga zapisati kao takvo:
**app pokriva svakodnevno filtriranje, Excel pokriva egzotiku.** Svaka buduća molba za
operator prolazi kroz to sito — ako se traži jednom mjesečno, nije za app.

Izvorno obrazloženje zašto je `NOT` k tome i tehnički neugodan: „Sve osim ZABA" zvuči jednostavno, a nad EAV-om znači
„eventi kojima taj atribut **nema** tu vrijednost **ili ga uopće nema**" — dvije različite
tvrdnje koje korisnik ne razlikuje, a rezultat se razlikuje za sve retke bez atributa.
Uzima se tek kad postoji stvarna potreba, i tada s izričitim izborom.

---

## 3. Gdje se izvršava — `SECURITY DEFINER` RPC

**Što je to, u jednoj rečenici:** funkcija u bazi koja se izvršava **s ovlastima onoga tko
ju je napisao**, a ne onoga tko ju zove — dakle RLS je unutar nje ugašen, i funkcija **sama**
mora provjeriti smije li pozivatelj vidjeti te retke.

Zašto ovdje:

1. **Izražajnost.** N uvjeta = N `EXISTS` podupita. PostgREST to ne zna složiti (§1.2), SQL zna.
2. **Cijena za grantee-a.** Umjesto da Postgres provjerava RLS na svakom retku
   `event_attributes` (68.692 na PROD-u), funkcija **jednom** provjeri „smije li ovaj korisnik
   ovu Areu" i onda upit vozi bez RLS-a.
3. Isti RPC zatvara i `BUG-S103-ANYATTR` — **jedna investicija, dvije stavke backloga.**

⚠ **Cijena greške je istog reda kao korist.** `SECURITY DEFINER` bez vlastite provjere
pristupa je **curenje cijele baze**. Pravilo je već zapisano uz Overview RPC-ove
(CLAUDE.md, „RPC pravila") i ovdje vrijedi doslovno: prvi red funkcije je provjera pristupa,
a ne upit.

**Granica:** RPC vraća **id-eve eventa** (i ukupan broj), ne cijele retke. Prikaz ostaje
na postojećem putu, pa Excel export, kolone i paginacija ne moraju znati da se išta
promijenilo. ⚠ Paginacija u RPC-u mora imati `ORDER BY` po jedinstvenom stupcu — inače
tiho preklapanje stranica (CLAUDE.md, S108).

---

## 4. UI — kako ostati razumljiv (Sašina točka 1)

Rizik nadogradnje nije tehnički nego što filtar postane **alat za koji treba upute**.
Zato:

- **Uvjet je čip, ne redak forme.** Aktivni uvjeti stoje kao čipovi
  (`Racun = ZABA ✕`, `Smjer = Uplata ✕`), ispod njih `+ uvjet`. Prazan filtar izgleda
  **isto kao danas** — jedan red, bez ičega novog na ekranu.
- **Mobitel je mjera, ne desktop.** Čipovi se prelamaju u dva reda; `+ uvjet` otvara isti
  izbornik atributa koji već postoji. ⚠ Vrijedi pravilo iz S119: čip s tekstom promjenjive
  duljine mora imati gornju granicu širine, inače razvuče redak.
- **Operator se ne pokazuje dok ne treba.** Tekstualni atribut ima „sadrži" kao zadano i
  operator se **ne prikazuje**; broj i datum ga prikazuju, jer ondje bez njega uvjet nema
  smisla.
- **Spremanje iz Add Activity nosi vrijednosti koje su upravo unesene** (Sašina točka 1):
  „Save as shortcut" iz Add-a ponudi uvjete **prefilane iz forme** (`Racun = ZABA`,
  `Smjer = Uplata`), jer se ondje ionako zna Area i sve vrijednosti. Danas se shortcut iz
  Add-a sprema kao `default_attributes` (vrijednosti za **unos**); ovo je druga polovica —
  isti podaci, drugi smjer (vrijednosti za **traženje**).

---

## 5. Shortcutovi po Arei — **✅ IZVEDENO S122** (faza 1)

**Izvedeno:** kvačica „samo ova Area" uz `⚡ Shortcuts` (stanje se pamti po pregledniku,
`et_shortcuts_area_only`), `<optgroup>` po Arei u punom popisu, i sufiks `23× · 12.06.`
u svakom retku. **Bez granice po broju** — v. odluku niže.
**Nije izvedeno:** „skraćena lista za skakanje" (koliko ih pokazati kad je kvačica
isključena) — čeka stvarne brojke, v. §9.

---

**Toggle ima dva stanja i ona nisu „filtrirano / nefiltrirano" nego dvije namjene**
(Sašina formulacija): **uključen** = „radim u ovoj Arei, pokaži mi njene";
**isključen** = *„najvažnijih nekoliko iz raznih area — da me prebaci brzo."*
Dakle isključen toggle **nije** popis svega, nego **kratka lista za skakanje**.

- **Uključen:** svi shortcutovi odabrane Aree (popis jedne Aree je ionako kratak).
- **Isključen:** **najviše N** (predloženo **15**, konstanta na jednom mjestu) kroz sve Aree,
  poredani po učestalosti. ⚠ Ondje **ime Aree ide kao sufiks** (`Gym Z2 · Fitness`) — u toj
  je listi Area upravo ono što razlikuje stavke; u listi jedne Aree bila bi šum.
- **Shortcut napravljen u Add Activity uvijek dobiva Areu** (ondje se zna).
- **Stari zapisi s `NULL` Areom ostaju globalni** — bez migracije, bez pogađanja.
- ⚠ **Preset je per-user i ID-based** (nikad ne putuje Excelom, v. „Preset ≠ widget").
  Ovo je sužavanje popisa, ne nov oblik zapisa.

**Sort već postoji i ne treba ga graditi:** `usage_count desc, last_used desc`
([useActivityPresets.ts:38](../src/hooks/useActivityPresets.ts#L38)). Nedostaju samo
**granica** (danas se renderira koliko ih ima) i **grupiranje po Arei** — dropdown je ravan
`<option>` popis ([ProgressiveCategorySelector.tsx:711](../src/components/filter/ProgressiveCategorySelector.tsx#L711)).

### ⚠ Granica po učestalosti su jednosmjerna vrata

Zamka koja se ne vidi dok ne ugrize: **što ispadne ispod 15. mjesta više se ne nudi ⇒ ne
koristi se ⇒ `usage_count` mu ne raste ⇒ ne može se vratiti.** Rangiranje po učestalosti
samo sebe pojačava. Granica je zato dopuštena **samo uz izlaz** iz nje.

**Sašino pitanje — „imati i sort po najmanje popularnim, da se čovjek podsjeti?"
Preporuka: ne.** Tri razloga:

1. **Obrće cilj.** Povod je da na malom ekranu gore bude ono što najviše treba; način koji
   na vrh stavlja **najmanje** korišteno radi suprotno.
2. **Rješava problem otkrivanja novom kontrolom koju treba otkriti.** Prekidač za koji se
   mora znati da postoji nije lijek za „ne znam kako se tamo ulazi".
3. **Rijedak shortcut je češće kandidat za brisanje nego za podsjećanje** — a briše se ondje
   gdje se vidi cijeli popis.

**Umjesto toga: zadnja stavka skraćene liste je `Svi shortcutovi…`** — otvara **cijeli**
popis. Deterministično, uvijek na istom mjestu, jedna kontrola umjesto dvije, i **razbija
jednosmjerna vrata** iz prethodnog odlomka. ⚠ Bez te stavke granica se **ne smije** uvesti.

⚠ **Ta stavka pripada granici, ne popisu — pa danas NE POSTOJI i ne treba** (Sašin nalaz
S122: *„sada ih je malo pa nema smisla"*). Dok granice nema, cijeli popis je jedna kvačica
daleko, i drugi put do istog mjesta bio bi samo još jedna kontrola. `Svi shortcutovi…`
ulazi **istim commitom kao granica**, nikad prije njega.

### Cijeli popis: isti sort, ali sa **brojkom** (Sašin dodatak, S122)

Sašin prigovor na abecedu: *„inače korisnik ne može lako naći nepopularni kojeg eventualno
treba izbrisati."* Točno — cijeli popis služi **dvjema** stvarama: naći rijetko korišten
da se **skoči** na njega, i naći ga da se **obriše**. Abeceda služi prvoj, ne drugoj.

**Odluka: cijeli popis zadržava sort po učestalosti** (isti kao skraćena lista — jedan
mentalni model, nema drugog poretka za naučiti), a **svaki redak nosi brojku**. Kandidati
za brisanje se tada sami skupe na dnu, s najstarijim datumom.

⚠ **„Broj korištenja u zadnja 2 mjeseca" se danas NE MOŽE izračunati.**
`activity_presets` drži `usage_count` (kumulativno, od početka) i `last_used`
(jedan timestamp) — **povijesti korištenja nema** i nema tablice koja bi je vodila.
Prozorska brojka tražila bi nov log zapis pri svakom korištenju, dakle novu tablicu i pisanje
u bazu na svaki klik.

**Predloženo bez nove strojarije:** `Gym Z2 · Fitness · 23× · 12.06.`
— kumulativni broj i zadnje korištenje. Za odluku o brisanju je **`last_used` ionako jači
signal** od prozorske brojke: „nije korišten od ožujka" je razlog za brisanje, a „0 puta u
2 mjeseca" je ista tvrdnja s manje podataka.
⚠ Ako se ikad pokaže da to nije dosta, prozorska brojka je **zaseban posao** (tablica
`preset_usage_log` + čišćenje), ne varijanta ovoga.

**Brisanje ne treba novo mjesto:** 🗑️ pored dropdowna već briše odabrani shortcut, uz
potvrdu ([ProgressiveCategorySelector.tsx:332](../src/components/filter/ProgressiveCategorySelector.tsx#L332))
⇒ „nađi u cijelom popisu → 🗑️" radi bez ijedne nove kontrole.

**Sašina ideja o parenju s Export profilom:** kad se definira profil exporta, ponuditi i
shortcut **istog imena**. ⚠ Prije nego se to gradi: `export_profiles` je per-Area config u
`areas.settings` i **ključ mu nosi ime aree**, pa ne preživi rename (poznata rupa,
backlog „Roundtrip completeness"). Shortcut je per-user i ID-based. Spojiti ih po **imenu**
znači vezati dvije stvari različitog životnog vijeka. ⇒ Predlaže se **odgoditi dok se ključ
`export_profiles` ne popravi**; tada je to par redaka.

---

## 6. Što se popravlja usput (i mora, jer se inače umnožava)

| # | nalaz | odakle |
| --- | --- | --- |
| a | jedna promjena filtra pokrene **šest** upita liste u ~500 ms | izmjereno S122 (trace) |
| b | osvježavanje liste **zatvara otvoren ⋮ izbornik** | posljedica (a) |
| c | filtar se gubi pri odmontiranju komponente | S111, S119/S120 |
| d | `BUG-S103-ANYATTR` timeout za grantee-a | S103 |

⚠ (a) je **mjerenje, ali uzrok kaskade nije utvrđen.** Prije popravka izbrojati tko okida
refetch (`useDateBounds` settle, `areas-changed`, promjena `attrFilter`) — inače se popravlja
simptom. Sašina formulacija: *„želimo jednostavniji mehanizam."*

**Što znači „event bus / split providera" (backlog Fable I.4), bez žargona:**
danas jedan `FilterContext` drži **dvije nevezane stvari** — filtar (Area, kategorija,
datumi, uvjeti) i podatke o dijeljenju (`sharedContext`, dozvole). Svaka promjena bilo koje
od njih ponovno iscrta **sve** što ih čita. „Split providera" znači razdvojiti ih u dva
konteksta, pa promjena filtra ne budi dio o dijeljenju i obrnuto. „Event bus" je zajednički
tipizirani kanal za poruke tipa `areas-changed` (danas `CustomEvent` bez tipa, prepoznat po
imenu-stringu) — dakle da promjena strukture javi **jednom, na jednom mjestu**, umjesto da
svaka komponenta sluša za sebe. **Oboje je izravni kandidat za uzrok (a).**

---

## 7. Kompatibilnost — što ne smije puknuti

- **Stari `attrFilter`** se čita kao **jedan** uvjet (`op: isExact ? 'equals' : 'contains'`).
- **Stari `filter_state` u shortcutovima** (`PresetFilterState.attrFilter`,
  [database.ts:389](../src/types/database.ts#L389)) mora se **tolerirati, ne migrirati** —
  preset je per-user i njegov vlasnik ga nije tražio promijeniti.
- **Excel export vozi isti filtar** (`eventQueryBuilder` je zajednički za listu i export) ⇒
  novi uvjeti moraju vrijediti i za export, inače „izvezi ovo što vidim" prestane biti istina.
- **Drill s pločice** postaje točan tek kad uvjeta može biti dva — dakle §2 zatvara
  OVERVIEW_TAB_SPEC §2.16.

---

## 8. Mjerenje (bez ovoga se ne kreće)

Prije i poslije, **na PROD-u i kao grantee** (jer je to skupa grana):

1. jedan tekstualni uvjet (danas moguć) — vrijeme do prvog retka
2. dva uvjeta (danas nemoguć) — isto
3. „In any attribute" (danas timeout)
4. broj upita po jednoj promjeni filtra (danas **6**)

⚠ Mjeriti **istim oblikom upita koji app šalje**, ne pojednostavljenim — S120 je pokazao da
`statement timeout` može doći od nečeg trećeg (paralelni Playwright workeri), a krivi trag
je stajao dva dana.

---

## 9. Faze

| faza | sadržaj | zašto tim redom |
| --- | --- | --- |
| **0** | izbrojati refetch kaskadu (§6a), popraviti uzrok | najjeftinije, i čisti teren |
| **1** | ~~shortcutovi po Arei (§5)~~ **✅ S122** | nula nove strojarije, odmah koristi na mobitelu |
| **1b** | „skraćena lista za skakanje" — koliko ih kad je kvačica isključena | ⚠ **tek kad se izbroje** stvarni shortcutovi. Prijedlog: mjera nije brojka nego **Area** — 1–2 najkorištenija **po Arei**, pa se samo skalira i nema izmišljene konstante |
| **2** | RPC s N uvjeta (§3) + model (§2), UI ostaje jedan uvjet | rizik je u bazi, pa se odvaja od UI-ja |
| **3** | UI s čipovima (§4), drill s dva uvjeta, prefill iz Add Activity | tek kad ispod radi |
| **4** | brojevi i datumi (§1.3) | najviše novih operatora, najmanje hitno |

⚠ Faza 1 **ne ovisi** ni o čemu drugom i može ići sama.

---

## 10. Odgovoreno (Saša, S122) — i što je ostalo

| # | pitanje | odgovor |
| --- | --- | --- |
| 1 | AND između uvjeta, OR unutar atributa? | ✅ dovoljno, **uz ogradu**: provjeriti na stvarnom korištenju (§2) |
| 2 | koliko uvjeta? | ✅ **proizvoljno**, kroz `+ dodatni uvjet` |
| 3 | faza 1 odmah? | ✅ **da** — shortcutovi po Arei, semantika toggla u §5 |
| 4 | `NOT`? | ✅ **ne** — „egzotičniji upiti se rade u Excelu" (§2) |

**Ostalo otvoreno:**

- ~~**N u granici popisa**~~ — ✅ **odluka (Saša, S122): bez granice dok nema stvarnog uvida.**
  *„Nema smisla uvoditi granice bez stvarnog uvida; kad ih je previše ne valja, ali koliko ih
  za promjenu Aree ima smisla ostaje neka manja mjera."* ⇒ faza 1 je izvedena **bez granice**,
  a mjera za skraćenu listu (faza 1b) se bira nad brojkama.
- ~~**Sort po najmanje popularnim**~~ — ✅ riješeno: `Svi shortcutovi…` sa **sortom po
  učestalosti i brojkom u retku** (§5). Prozorska brojka („zadnja 2 mjeseca") **nije
  moguća** bez nove tablice; umjesto nje `usage_count` + `last_used`.
- **UI čipova (§4)** se ne betonira dok se ne isproba na stvarnom unosu (ograda iz #1).
