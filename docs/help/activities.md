# Activities — Help

## Dodavanje aktivnosti
1. Klikni "+" u headeru ili "Add Activity" gumb
2. Odaberi Area iz dropdown-a
3. Odaberi Category path (L1 → L2 → ... → leaf)
4. Ispuni atribute, klikni Save

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
- Shortcuts: sačuvaj filter s 💾 ikonom, učitaj iz dropdown-a
- "Reset cat." resetira samo kategoriju, area ostaje

## Bulk operacije
- Checkbox na redovima → odaberi više
- Gumb za brisanje odabranih (ne dostupno za grantee)

## Export/Import
- Export gumb → download .xlsx (Activities sheet + Structure sheet)
- Import gumb → upload .xlsx; detektira missing kategorije i nudi kreiranje

## Orphan eventi (owner pogled)
Kad grantee napusti tvoju area bez podataka ("Leave without data"), njegovi
eventi ostaju u tvojim kategorijama ali bez aktivnog sharea — "orphan eventi".

**Amber banner** iznad tablice: "N users no longer have access · M activities"
- **[View events]** — prikazuje samo orphan redove u tablici (chip "Orphan events only ×")
- **[Manage]** — otvara Orphan Events modal

**Orphan Events modal** (po korisniku):
- **Re-invite** — otvara Manage Access modal s pre-fillom emaila
- **Claim events** — preuzima vlasništvo (eventi postaju tvoji)
- **Delete events** — briše sve orphan evente tog korisnika (ne može se poništiti)

**Po redu u tablici:** orphan redovi imaju amber ring na avataru + ⚠ badge.
⋮ menu → "Manage orphan events" otvara isti modal.
