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

## 5. Shortcutovi po Arei (Sašina točka 4 — po njemu najvažnija)

- **Toggle u Filter panelu** suzi popis na shortcutove odabrane Aree. Isključen toggle
  pokazuje one bez Aree (`area_id IS NULL`) — dakle „globalne".
- **Shortcut napravljen u Add Activity uvijek dobiva Areu** (ondje se zna).
- **Stari zapisi s `NULL` Areom ostaju globalni** — bez migracije, bez pogađanja.
- ⚠ **Preset je per-user i ID-based** (nikad ne putuje Excelom, v. „Preset ≠ widget").
  Ovo je čisto sužavanje popisa, ne nov oblik zapisa.

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
| **1** | shortcutovi po Arei (§5) | nula nove strojarije, **odmah** koristi Koki na mobitelu |
| **2** | RPC s N uvjeta (§3) + model (§2), UI ostaje jedan uvjet | rizik je u bazi, pa se odvaja od UI-ja |
| **3** | UI s čipovima (§4), drill s dva uvjeta, prefill iz Add Activity | tek kad ispod radi |
| **4** | brojevi i datumi (§1.3) | najviše novih operatora, najmanje hitno |

⚠ Faza 1 **ne ovisi** ni o čemu drugom i može ići sama.

---

## 10. Otvoreno za Sašu

1. **AND/OR:** je li „AND između uvjeta, OR unutar jednog atributa" (§2) dovoljno, ili
   postoji stvaran primjer koji traži zagrade?
2. **Koliko uvjeta** je realno — 2, ili proizvoljan broj? (Utječe na UI, ne na RPC.)
3. **Faza 1 odmah?** Shortcutovi po Arei su odvojivi i najbrže vidljivi Koki.
4. **`NOT`** (§2) — postoji li potreba, ili se izostavlja bez rasprave?
