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

## Atributi u Edit panelu

**Tipovi:** text · number · boolean · datetime · suggest (text + predefinirane opcije u dropdown-u)

**`default_value`:** vrijednost automatski upisana kad korisnik otvori Add Activity za tu kategoriju.
Za suggest atribute mora točno odgovarati jednoj od opcija (case-sensitive).
Polja na defaultu se skrivaju u formi (hide-if-default) — korisnik klika "Show all" ako ih želi urediti.
Iznimka: polje o kojem ovisi vidljivo `depends_on` polje nikad se ne skriva (S107f).
Za brisanje `default_value` via Excel Structure importa: upiši `_` u Default kolonu — import postavlja null (prazno).

**`depends_on` — uvjetna vidljivost:**
Atribut se prikazuje u formi samo kad drugi atribut ("parent") ima određenu vrijednost.
Konfigurira se u Edit panelu → klikni na atribut → "Depends on" / "When value".
- Primjer: `Broj rata` vidljiv samo kad `Na rate? = true`
- `WhenValue = SKRIVENO`: atribut je uvijek skriven u formi (postoji u bazi, ali korisnik ga ne uređuje — za interne/sistemske vrijednosti)
- `WhenValue = *`: catch-all — koristi se kad parent ima vrijednost koja nije eksplicitno navedena u mapi

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
  `DateMap` = `vrijednost=same` ili `vrijednost=next:N` (N-ti dan sljedećeg mjeseca).
- **`rata`** — Post-Finish modal koji kupovinu razdijeli na rate; najviše jedno po arei.
  `TriggerAttr` (checkbox koji pali modal), `CountAttr`, `AmountAttr`, `IndexAttr` (redni broj
  rate), `TargetAttr` (kamo ide datum naplate), `DateMap` = `vrijednost=DAN` (broj 1–31),
  `OverrideAttrs` = vrijednosti nametnute svakoj rati (npr. `status=Planiran`).

Import zamjenjuje navedene automatike svake area koja se pojavi u sheetu. **Odsutnost ne briše** —
stariji export bez rata kolona ne može pobrisati postojeću rata konfiguraciju. Pravilo koje
referencira nepostojeći slug se preskače (vidljivo u "Automation rules skipped").
