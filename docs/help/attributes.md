# Attributes — Help

## Vrste atributa
- **text**: slobodan tekst
- **number**: broj s opcionalnom jedinicom (kg, min, km, EUR...)
- **datetime**: datum i/ili vrijeme
- **boolean**: da/ne checkbox
- **link**: URL adresa
- **image**: foto upload

### Unos broja
Decimale se pišu **zarezom** (`1389,52`). Točka je također prihvaćena (`1389.52`) — oba
oblika daju isti broj. Polje prikazuje **točno spremljenu vrijednost**: cijeli broj ostaje
cijel (`12`, ne `12,00`), a `2,835` zadržava sve tri decimale. Formatiranje novca na dvije
decimale radi se **u listi**, ne u polju za unos, jer isto polje nosi i iznose i broj
ponavljanja.

Ako se upisano ne može pročitati kao broj, polje **pocrveni** i javi da će se spremiti kao
prazno. To je namjerno glasno: prije se takav unos tiho pretvarao u praznu vrijednost.

## Suggest type
- Text atribut s predefiniranim opcijama u dropdownu
- Može se pretvoriti iz text u suggest: Edit panel → "→ Suggest" gumb
- Opcija "Other": korisnik upiše vlastitu vrijednost, sprema se u listu

## Dependent suggest
- Opcije dropdownu ovise o vrijednosti drugog atributa
- Npr. "Muscle Group" ovisi o "Exercise Type"
- Postavlja se u Edit panelu → DependsOn tablica

## Obavezno polje (Required)

Kvačica **"Required field"** u Edit panelu atributa. Add i Edit **ne daju spremiti** dok
polje nije ispunjeno; uz naziv stoji crvena zvjezdica, a pri pokušaju spremanja poruka
**imenuje polje** koje nedostaje.

Što se broji kao ispunjeno:

- `false` na checkboxu i `0` na broju **jesu odgovori**, ne izostanak. Netaknut checkbox
  (`Not set`) nije odgovor.
- Sami razmaci u tekstu se ne broje.

⚠ **Ne vrijedi za Excel uvoz.** Obavezno polje je pravilo **forme**, ne baze — povijesni
retci i vrijednosti tipa `N/A` moraju i dalje prolaziti uvozom. Isto vrijedi za postojeće
retke: označavanje atributa obaveznim **ne dira** ono što je već u bazi, tek sljedeći ručni
unos ili izmjena traže vrijednost.

Roditelj prije djeteta: ako obavezan atribut ovisi o drugom (`DependsOn`), poruka nabraja
polja **redoslijedom forme**, pa se prvo ispuni roditelj — dijete se tek tada pojavi s
ponuđenim opcijama. Zato obavezno dijete traži i **obaveznog roditelja**; panel na to
upozorava.

## Kada se polje NE vidi pri unosu — dva različita razloga

Polje može nedostajati na dva načina i **svaki se rješava drukčije**.

⚠ **Default value polje NE skriva** (od S187): polje s defaultom se prikazuje, popunjeno.
Do listopada 2026. forma je skrivala svako polje koje je sjedilo na svom defaultu — pravilo
koje nitko nije postavio, pa se nije znalo zašto polje fali. Za skrivanje postoji samo točka 1.

### 1. Izričito skriveno za ovu Areu (`Hide in Add/Edit form`)

Kvačica u Edit panelu atributa (u Structure Excelu kolona `HiddenInAdd`), za polja **čija je
ispravna vrijednost prazna** — npr. `Izvod opis`, koji se popunjava tek kad stigne bankovni izvod.

- Na dnu forme piše "prazna po pravilu: …" s imenima; klik na ime otvori samo to polje,
  **"Show all"** sva. Otkriveno polje nosi oznaku `skriveno`. Ovo je urednost, ne zaključavanje.
- ⚠ **Ne može se kombinirati s "Required field".** Dvije kvačice tvrde suprotno o istom
  polju, pa je u panelu uključena jedna onemogućuje drugu. Dođe li takav par Excel uvozom,
  uvoz to prijavi i **sam preuzme označeni file** (`structure_REVIEW_NEEDED_*`), a forma polje
  **svejedno prikaže** — obavezno pobjeđuje, da se unos ne može zaključati.

### 2. Roditelj nema odgovarajuću vrijednost (`DependsOn`)

Polje tipa broj, boolean ili datum s `DependsOn` prikazuje se tek kad atribut o kojem ovisi
ima jednu od navedenih vrijednosti (npr. `Broj rata` tek uz `Na rate?`). Tekstualni dropdown
s `DependsOn` je uvijek vidljiv — roditelj mu samo mijenja ponuđene opcije.

- ⚠ **"Show all" ga NE otkriva.** Jedini način je ispuniti roditelja.

## Dodavanje atributa
1. Structure tab → Edit Mode
2. Klikni na kategoriju → otvori Edit panel
3. "+ Add Attribute" → upiši ime, odaberi type, optional unit
4. Save

## Brisanje atributa
- Trash ikona uz atribut u Edit panelu
- Upozorenje ako atribut ima pohranjena data (event_attributes)
- Upozorenje ako drugi atribut ima depends_on referencu na ovaj

## Slug
- Interni identifikator atributa (URL-safe, ne mijenja se)
- Može se preimenovati u Edit panelu (automatski ažurira depends_on reference)
