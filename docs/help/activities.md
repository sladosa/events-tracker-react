# Activities — Help

## Dodavanje aktivnosti
1. Klikni "+" u headeru ili "Add Activity" gumb
2. Odaberi Area iz dropdown-a
3. Odaberi Category path (L1 → L2 → ... → leaf)
4. Ispuni atribute, klikni Save
5. Gumb "💾 Save as Shortcut" ispod atributa sprema trenutne vrijednosti kao shortcut default — vidi sekciju **Shortcuts** niže

**Zaglavlje Add Activity ovisi o Arei:**
- Zadano zaglavlje pokazuje štopericu `SESSION` / `LAP` — korisna je dok se aktivnost
  *izvodi* dok je ekran otvoren (trening).
- Area može umjesto toga tražiti **birač datuma** (zadano: današnji dan). To ima smisla
  kad se zapis *bilježi naknadno* — transakcija od prije tri dana. Tada unos za prošli
  dan traje **jedan** ekran; prije je trebalo spremiti pa odmah urediti datum.
- Postavlja se u Structure Excelu, na retku Aree: kolone `AddTimer` i `AddDatePicker`.
- Promjena datuma **povlači automatike** koje ovise o njemu (npr. `Datum naplate`),
  osim ako si to polje već upisao rukom — ručni unos se ne pregazi.

**Ako ne znaš točan iznos — upiši približno i označi tildom:**
- Stavi `~` na **početak** opisa: `~ gorivo, Ina Heinzlova`. Na početku je zato što
  lista reže dugačak opis, pa bi tilda na kraju nestala baš tamo gdje je trebaš vidjeti.
- Ispravi iznos kad vidiš bankovnu ili kartičnu aplikaciju, pa makni tildu.
- **Ne upisuj isti trošak drugi put** kad vidiš izvod — **uredi postojeći redak**.
  Novi redak s ispravnim iznosom ne bi se prepoznao kao isti trošak (iznosi se
  razlikuju), pa bi ostala dva.
- Kako naći sve takve retke odjednom: **Filter panel → `Filter by` = `Comment` →
  upiši `~`**. Lista pokaže samo retke s tildom, uz chip `comment: "~" ×`. Tilda je
  običan znak u pretrazi, ne poseban.

**Vidljivost polja u formi:**
- Polja čija vrijednost odgovara `default_value` automatski se skrivaju pri otvaranju.
  Broj skrivenih polja prikazan je na dnu forme ("N fields hidden (at default)").
  Klik "Show all" otkriva sva polja; klik "Hide fields at default" ih sakriva nazad.
  Jednom kad ručno promijeniš vrijednost, polje ostaje vidljivo (čak i ako se vratiš na default).
- **Iznimka (S107f):** polje o kojem ovisi neko VIDLJIVO polje (`depends_on` parent, npr.
  `Strength_type` za `exercise_name`) nikad se ne skriva — inače dependent dropdown "visi u zraku".
- Ako su SVI atributi neke kategorije skriveni (npr. shortcut je sve prefillao na default),
  otvorena kategorija prikazuje poruku "All fields hidden (at default values)" umjesto praznine.
- Polja s `depends_on` prikazuju se samo kad drugi atribut ("parent") ima određenu vrijednost
  (npr. `Broj rata` se pojavi tek kad označiš `Na rate?`).
- Oba pravila vrijede i u Edit Activity.

## Automatike nakon Finish

Ovise o postavkama area (Structure tab → `Automations` sheet u exportu/importu).

**Auto-popunjavanje datuma (`set_attribute`)** — čim odabereš vrijednost o kojoj pravilo ovisi,
ciljano polje se popuni samo. Primjer: odabir `Izvor = Mastercard` popuni `Datum naplate` na
11. sljedećeg mjeseca. **Ručni unos se nikad ne gazi** — ako sam upišeš vrijednost, automatika
je više ne dira.

**Rate** — ako area ima rata pravilo, nakon Finish se pojavi modal koji ponudi razdvajanje
kupovine na rate. Prikazuje iznos po rati i **datume naplate** svake rate.

- Nastane onoliko zapisa koliko je rata; iznos svake = ukupno ÷ broj rata.
- **Sve rate ostaju na danu kupnje** (`event_date`) — kupovina je jedna, samo se plaća u
  više navrata. Zato u listi stoje jedna do druge.
- Razlikuje ih **`Datum naplate`** (kad novac stvarno ode) i **`Rata br`** (redni broj).
- Rate dobiju `Status = Planiran`; izvorni zapis se ukloni jer rate nose sve podatke — nema
  dvostrukog zbrajanja.
- Za pregled "koliko me čeka kojeg datuma" koristi export sortiran po `Datum naplate`, ne po
  datumu aktivnosti.

## Uređivanje aktivnosti
- ⋮ menu → Edit (ili ikona olovke na redu)
- Mijenja atribute za tu sesiju
- Session time se može promijeniti (delta shift — sve u sesiji se pomakne)

## Pregled aktivnosti
- Klikni na red ili ⋮ → View
- Prev/Next navigacija unutar trenutnog filtera
- Swipe lijevo/desno na mobitelu

## Filter
- Area dropdown + Category dropdown u Filter panelu
- Shortcuts dropdown — odaberi spremljeni shortcut da brzo postaviš Area + Category (i, ako ga ima, predefinirane vrijednosti atributa — vidi sekciju **Shortcuts**)
- "Reset cat." resetira samo kategoriju, area ostaje
- **Filter by** dropdown: odaberi "Comment" za pretragu komentara, specifični atribut za pretragu po vrijednosti atributa, ili **"In any attribute"** za pretragu po tekstu u svim atributima odjednom
- **Comment contains** — pretražuje `comment` polje leaf eventa (case-insensitive, server-side); chip "xyz ×" u tablici kad je aktivan
- **Pretraga po `~` (nepotvrđeni iznosi)** — upiši `~` u Comment pretragu da dobiješ sve
  retke kojima iznos još nije potvrđen (v. **Dodavanje aktivnosti**). Radi kao i svaka
  druga pretraga — tilda nije poseban znak.
- **Attribute filter** — odaberi atribut, pa za suggest atribute odaberi opciju iz dropdowna; za text/number upiši tekst za pretragu (partial match)
- **"In any attribute"** — traži tekst u svim atributima odjednom (npr. upiši "EUR" da nađeš sve evente gdje bilo koji atribut sadrži "EUR")

## Shortcuts (brzi pristup)
Shortcut pamti Area + Category, a po želji i predefinirane vrijednosti atributa — koristan
za ponavljajuće unose (npr. ista vrsta transakcije, isti trening).

**Spremanje iz Filter bara** (💾 ikona pored Shortcuts dropdowna):
- Pamti Area + Category (ili samo Area za area-level shortcut) + filter state (period, sort, comment/attr filter)
- Može se spremiti i za non-leaf kategoriju — korisno za izvješća/exporte koji uključuju cijelu granu
- Prvi put se prikazuje info dijalog koji objašnjava da se vrijednosti atributa mogu spremiti
  jedino iz Add Activity stranice ("Don't show this again" pamti se trajno)

**Spremanje iz Add Activity** ("💾 Save as Shortcut" gumb ispod atributa):
- Pamti Area + Category **i** trenutno ispunjene (touched) vrijednosti atributa kao defaulte
- Ako za tu kategoriju već postoji shortcut → nudi izbor: **Update postojećeg** (prepiše defaulte),
  **Save as new** (novi shortcut s drugim imenom — npr. dvije varijante za istu kategoriju), ili Cancel
- Ako shortcut ne postoji → traži ime i kreira novi

**Korištenje:** odaberi shortcut iz dropdowna (Filter bar) → otvori Add Activity (gumbom "Add Activity"
ili izravno preko "⚡ Use" — vidi niže) → polja s predefiniranim vrijednostima su unaprijed popunjena
i označena kao "touched" (Save je odmah aktivan bez dodatnog unosa). Statički `default_value` na
atributu i dalje vrijedi kad shortcut nema svoj default za taj atribut.

**"⚡ Use" gumb** (pored Shortcuts dropdowna): kad je odabran shortcut koji vodi do leaf kategorije,
ovaj gumb preskače filter i odmah otvara Add Activity za taj shortcut — brži put za ponavljajuće
unose. Obično odabir shortcuta samo postavlja filter (za pregled povijesti te kategorije);
"⚡ Use" je eksplicitan way da se odmah krene na unos.

- Brisanje shortcuta: 🗑 ikona pored dropdowna

## Bulk operacije
- Checkbox na redovima → odaberi više
- Gumb za brisanje odabranih (ne dostupno za grantee)

## Export/Import
- Export gumb → download .xlsx (Activities sheet + Structure sheet)
- Import gumb → upload .xlsx; detektira missing kategorije i nudi kreiranje

**Brisanje vrijednosti atributa via Excel (sentinel `_`):**
Prazne ćelije nikad ne brišu postojeće vrijednosti (P3 pravilo — blank ne prepisuje).
Da eksplicitno obrišeš vrijednost nekog atributa, upiši `_` (underscore) u tu ćeliju.
Import tretira `_` kao "postavi na prazno", zaobilazeći P3.
- Primjer: atribut `Smjer` ima vrijednost "Isplata" (i to je default pa polje ne vidiš u formi);
  želiš ga obrisati → upiši `_` u xlsx kolonu Smjer za taj event → import → vrijednost se briše
- Za **nove redove** (novi eventi): `_` se tretira jednako kao prazno (atribut se ne kreira)

**Brisanje zapisa via Excel — kolona `Delete?` (S107w):**
Skroz desno u EVENT DATA sekciji (do `row_hash`) stoji kolona **`Delete?`** s padajućim
izbornikom. Odabereš `DELETE` na retku → import taj zapis **trajno briše**.
- Prihvaćaju se **samo** `DELETE` ili prazna ćelija; bilo koja druga vrijednost (npr. `TRUE`)
  je **greška** i import se prekida — ništa se ne uveze dok se ne ispravi
- Označeni redak se u Excelu oboji crveno (conditional formatting)
- Prije primjene import pokaže **zaseban popis što nestaje** (datum, kategorija, komentar,
  broj atributa, fotografije) i **vlastitu kvačicu** — Apply je zaključan dok je ne označiš.
  Odvojena je od kvačice za izmjene: "da, promijeni" nikad ne znači i "da, obriši"
- Ako je to bio **zadnji zapis svoje sesije**, brišu se i parent zapisi te sesije
  (isto pravilo kao Delete Activity u UI-u)
- **Brisanje retka iz Excela ne briše ništa** — zapis koji nije u fileu se jednostavno ne dira.
  Briše samo `Delete?` zastavica
- Stariji exporti (bez te kolone) rade nepromijenjeno — ništa se ne briše

**Izvještaj nakon uvoza (auto-download):**
Nakon svakog importa automatski se skine **`import_report_*.xlsx`**. To **nije pasivan log**
nego **radni file** — običan export format sa samo onim zapisima koje je import kreirao ili
promijenio: pravi `event_id`, ispravan `row_hash`, `Delete?` dropdown već na njemu.
- Petlja: uvoz → izvještaj → označiš krivi redak `DELETE` → uvezeš **taj isti file**
- Tri dodatne kolone skroz desno: `Result` (Created/Updated), `Source row` (redak uvoznog
  filea), `Changed` (koja polja su se promijenila). Pri ponovnom uvozu se ignoriraju
- Sheet `ImportReport` = sažetak; sheet `Deleted` = popis obrisanih zapisa
  (njih se ne može izvesti — postoje samo kao zapis što je otišlo)

## Orphan eventi (owner pogled)
Orphan eventi nastaju u dva scenarija:
- Grantee napusti area bez podataka ("Leave without data")
- Owner revokne pristup i odabere "Revoke only" (grantee ima evente)

**Amber banner** iznad tablice: "N users no longer have access · M activities"
- **[View events]** — prikazuje samo orphan redove u tablici (chip "Orphan events only ×")
- **[Manage]** — otvara Orphan Events modal

**Orphan Events modal** (po korisniku):
- **Re-invite** — otvara Manage Access modal s pre-fillom emaila
- **Claim events** — preuzima vlasništvo (eventi postaju tvoji)
- **Delete events** — briše sve orphan evente tog korisnika (ne može se poništiti)

**Po redu u tablici:** orphan redovi imaju amber ring na avataru + ⚠ badge.
⋮ menu → "Manage orphan events" otvara isti modal.
