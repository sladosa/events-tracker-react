# Attributes — Help

## Vrste atributa
- **text**: slobodan tekst
- **number**: broj s opcionalnom jedinicom (kg, min, km, EUR...)
- **datetime**: datum i/ili vrijeme
- **boolean**: da/ne checkbox
- **link**: URL adresa
- **image**: foto upload

## Suggest type
- Text atribut s predefiniranim opcijama u dropdownu
- Može se pretvoriti iz text u suggest: Edit panel → "→ Suggest" gumb
- Opcija "Other": korisnik upiše vlastitu vrijednost, sprema se u listu

## Dependent suggest
- Opcije dropdownu ovise o vrijednosti drugog atributa
- Npr. "Muscle Group" ovisi o "Exercise Type"
- Postavlja se u Edit panelu → DependsOn tablica

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
