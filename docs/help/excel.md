# Excel Import/Export — Help

## Export
- Gumb "Export" (Activities ili Structure tab)
- Preuzima .xlsx s dva sheeta: Activities Events + Structure
- Activities Events sheet: datum, session time, user email (col G), category path, atributi
- Structure sheet: hijerarhija kategorija s atributima, shared-with emailovi

## Import (Activities)
1. Klikni "Import"
2. Odaberi .xlsx fajl (isti format kao export)
3. Ako fajl sadrži kategorije koje ne postoje → modal nudi kreiranje strukture
4. Ako fajl sadrži tuđe evente (User email kolona) → odaberi Skip ili "Import as mine"
5. Pregled: identični eventi = sivi (skipped), izmijenjeni = žuti (update), novi = zeleni

## Import (Structure)
- Import na Structure tabu učitava strukturni sheet
- Non-destructive: ne briše postojeće kategorije
- Kreira novo, preskače postojeće (po slug-u)

## Format aktivnosti — ključne kolone
- Col B: datum (DD.MM.YYYY)
- Col C: category path (bez area name, npr. `Domacinstvo > Automobili > Gorivo`)
- Col G: user email
- Col I+: atributi (ime u headeru)

## Format strukture — ključne kolone
- Col D: full path (sa area name, npr. `Fitness > Cardio > Running`)
- Col E: level
- Col F+: atributi

## Dropdowni u exportu
- **Suggest atributi** (text s opcijama) automatski dobivaju Excel Data Validation dropdown u exportanom xlsx-u
- **Dependent suggest** (atribut ovisi o drugom atributu): koristi INDIRECT formulu + skriveni "DropdownData" sheet; kad odaberete vrijednost u parent koloni, dependent kolona automatski prikazuje odgovarajuće opcije
- Ako je lista opcija duža od 255 znakova, dropdown se ne prikazuje (Excel ograničenje za inline liste); dependent dropdowni koriste Named Ranges pa nemaju ovo ograničenje

## Export Profile
- Profil = sačuvano grupiranje kolona iz prethodnog exporta
- "Import Profile" u Export modalu učitava grouping state iz xlsx-a i sprema ga kao profil
- Profil se primjenjuje na sljedeći export → kolone grupirane/sklopljene kao u originalu
