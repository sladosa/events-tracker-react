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
- Profil = sačuvano grupiranje kolona (redoslijed, širine, collapse/expand) iz prethodno uređenog exporta, spremljeno u `area.settings.export_profiles`
- Workflow: exportaj → uredi LEGEND redoslijed (gornji dio Events sheeta) i/ili širine/grupiranje stupaca u EVENT DATA → "Import Profile" u Export modalu → daj ime → profil trajno spremljen za tu Area
- Nakon spremanja, originalni xlsx više nije potreban — profil se bira po imenu iz dropdowna na sljedećim exportima
- **Redoslijed kolona:** određuje ga redoslijed REDOVA u ATTRIBUTE LEGEND (gornji dio Events sheeta), ne fizički raspored kolona u EVENT DATA ispod. Dovoljno je prerasporediti LEGEND retke.
- **Širine/grupiranje:** mijenjaju se direktno na EVENT DATA kolonama u Excelu (resize, group/collapse)

## Filter sheet i Export Profile overrides
Filter sheet (zadnji tab u exportu) ima dvije uloge: (1) informativni zapis postavki tog konkretnog exporta, (2) ako se fajl importa kao Export Profile, neki redovi postaju **override** koji se primjenjuje na buduće exporte s tim profilom — bez obzira što je trenutno live u UI-u.

Redovi koji DJELUJU kao override (kad se import-aju kao profil):
- **Period key** — vrijednost iz dropdowna (`all-time`, `today`, `this-week`, `this-month`, `last-2-months`, `last-3-months`, `this-year`, `last-year`, `last-3-years`, `last-5-years`, `custom`). Prazno = nema override, naslijedi live filter.
  - `all-time` eksplicitno briše datumski filter (exporta sve)
  - `custom` koristi doslovne vrijednosti iz Date From / Date To (plain text `YYYY-MM-DD`, ne Excel date tip) kao raspon
  - bilo koji drugi key resolva se na relativan raspon (npr. "this-year" = 1.1.–31.12. tekuće godine, ponovno izračunato u trenutku exporta)
- **Sort order** — `Newest first` / `Oldest first`
- **Comment filter** — plain text substring search (ilike), bez posebnog formata
- **Attribute filter** — format `slug: =vrijednost` (exact) ili `slug: ~vrijednost` (partial/contains); `*: ~tekst` = pretraga kroz SVE atribute (kao "In any attribute" u UI dropdownu). Slugovi su u Structure sheetu (col I/H).
  - **Prazna ćelija** = nema override, profil naslijedi što god je live filtrirano u UI-u kad korisnik exporta
  - **`_`** = eksplicitno obriši filter (forsiraj "sve vrijednosti") bez obzira na live stanje — ista `_` konvencija kao kod Excel Importa (briše vrijednost) i Structure Default kolone (`_` = `default_value = null`)

Redovi koji su ČISTO informativni (NE čitaju se pri Import Profile): Export type, Exported at, Area, Category, Date From/To (osim kad je Period key = `custom`), Export profile naziv.

Data Validation dropdown postoji na ćelijama Period key i Sort order; tooltip s formatom postoji na Date From/To i Attribute filter ćelijama.
