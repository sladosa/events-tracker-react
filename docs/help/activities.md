# Activities — Help

## Dodavanje aktivnosti
1. Klikni "+" u headeru ili "Add Activity" gumb
2. Odaberi Area iz dropdown-a
3. Odaberi Category path (L1 → L2 → ... → leaf)
4. Ispuni atribute, klikni Save
5. Gumb "💾 Save as Shortcut" ispod atributa sprema trenutne vrijednosti kao shortcut default — vidi sekciju **Shortcuts** niže

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
- **Comment contains** — tekst polje na dnu filtera; pretražuje `comment` polje leaf eventa (case-insensitive, server-side); chip "comment: xyz ×" pojavljuje se u tablici kad je aktivan

## Shortcuts (brzi pristup)
Shortcut pamti Area + Category, a po želji i predefinirane vrijednosti atributa — koristan
za ponavljajuće unose (npr. ista vrsta transakcije, isti trening).

**Spremanje iz Filter bara** (💾 ikona pored Shortcuts dropdowna):
- Pamti samo Area + Category
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
