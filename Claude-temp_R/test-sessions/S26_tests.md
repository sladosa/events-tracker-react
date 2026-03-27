# S26 Tests

**Sesija:** S26 — 2026-03-27
**Branch:** test-branch
**Fokus:** Excel refaktor — Koraci 1-3 (excelUtils, excelExport, structureExcel)

---

## T-S26-1

**Opis:** Activities Export → attr kolone od H, comment samo G, freeze na H

**Koraci:**
1. Activities tab → Export → preuzmi xlsx
2. Otvori u Excelu
3. Provjeri `Events` sheet, sekcija EVENT DATA:
   - Kolona G: header = `leaf comment`, jedna kolona (nije mergeana G:J)
   - Kolona H: prva attr kolona (format `attrName (CategoryShort)`)
   - Kolone I, J, K...: ostale attr kolone (H, I, J više nisu prazne)
4. Scroll desno — provjeri da je freeze panel na H (A-G su frozen, H je prvi scrollabilni)

**Očekivano:**
- G = `leaf comment`, single cell, nije merged
- Atributi počinju od H
- Freeze na H (ne na K kao prije)

---

## T-S26-2

**Opis:** Activities Export → LEGEND: 6 kolona, C1 napomena

**Koraci:**
1. Isti xlsx iz T-S26-1
2. `Events` sheet, sekcija ATTRIBUTE LEGEND (gornji dio):
   - Header red: `Col | Area | Category_Path | Attribute | Type | Unit` — točno 6 kolona
   - NEMA kolona `Default`, `Min`, `Max`
   - NEMA column grouping (stari F-I outline buttons)
3. Provjeri ćeliju C1: tekst `see Structure sheet for more details` (italic, sivi)
4. Provjeri row grouping: LEGEND redovi su u collapsible grupama (gumb `+/-` na lijevoj strani), defaultno collapsed

**Očekivano:**
- Točno 6 LEGEND kolona
- C1 napomena vidljiva
- Row grouping funkcionira, collapsed by default

---

## T-S26-3

**Opis:** Activities Export → HelpEvents sheet postoji, boje swatch-ova su stvarne

**Koraci:**
1. Isti xlsx iz T-S26-1
2. Provjeri da postoji sheet nazvan `HelpEvents` (ne `Help`)
3. Na `HelpEvents` sheetu pronađi sekciju COLOR CODING
4. Red `PINK = READ-ONLY`: ćelija A ima ružičastu pozadinsku boju (ne samo emoji tekst)
5. Red `BLUE = EDITABLE`: ćelija A ima plavu pozadinsku boju
6. Red `ORANGE = NOT RELEVANT`: ćelija A ima narančastu/žutu pozadinsku boju

**Očekivano:**
- Sheet se zove `HelpEvents`
- Boje su vizualni cell fill (ne emoji)
- Tekst u tim redovima nema više 🩷🔵🟠 emoji prefixe

---

## T-S26-4

**Opis:** Structure Export → 4 sheeta u xlsx

**Koraci:**
1. Structure tab → Export (gumb u toolbaru ili context meniju)
2. Otvori xlsx
3. Provjeri sheet tab-ove na dnu:
   - `Events` — postoji
   - `Structure` — postoji (staro ime bilo `HierarchicalView`)
   - `HelpStructure` — postoji (staro ime bilo `Help`)
   - `Filter` — postoji
4. Provjeri `Events` sheet: sadrži jednu ćeliju s tekstom `Export initiated from Structure tab — no events included...`
5. Provjeri `Structure` sheet: sadrži normalne podatke (Area/Category/Attribute redovi)

**Očekivano:**
- Točno 4 sheeta s navedenim imenima
- Events sheet = stub poruka, ne pravi podaci
- Structure sheet izgleda isto kao i prije (17 kolona, Row 6, Row 7 header)

---

## T-S26-5

**Opis:** Structure Export → Filter sheet sadržaj

**Koraci:**
1. Isti xlsx iz T-S26-4
2. Otvori `Filter` sheet
3. Provjeri redove:
   - `Export type` = `Structure`
   - `Exported at` = timestamp u formatu `YYYY-MM-DD HH:MM:SS`
   - `Area` = naziv areala ako je filter bio aktivan, ili `All`
   - `Category` = puna putanja ako je filter bio aktivan, ili `All`
   - `Date From` / `Date To` = `All time` (structure nema datumski filter)

**Očekivano:**
- Filter sheet postoji i ima ispravne vrijednosti
- Export type = Structure
- Datumi = All time

---

## T-REG-1

**Opis:** Regression — Activities Import sa starim xlsx fajlom (bez Structure/Filter sheeta)

**Koraci:**
1. Uzmi stari xlsx exportan prije S26 (ima samo `Events` i `Help` sheetove)
2. Activities tab → Import → uvezi taj fajl
3. Provjeri da import normalno parsira i prikazuje preview
4. Provjeri da nema grešaka vezanih za strukturu fajla

**Očekivano:**
- Import radi normalno
- Stari fajl se čita bez problema unatoč tome što nema `Structure`/`Filter` sheetove
- Nema regresije u import logici

---

## T-REG-2

**Opis:** Regression — Structure Import sa starim xlsx fajlom (`HierarchicalView` sheet)

**Koraci:**
1. Uzmi stari xlsx exportan prije S26 (sheet se zove `HierarchicalView`, ne `Structure`)
2. Structure tab → Import → uvezi taj fajl
3. Provjeri da import normalno parsira i prikazuje result summary

**Očekivano:**
- Import pronalazi `HierarchicalView` sheet (backwards compat lookup)
- Parsiranje i import rade normalno
- Nema regresije

---

## Napomene za testiranje

- Za T-REG-1 i T-REG-2: ako nemaš stare fajlove, exportaj SADA sa starim kodom (na main branchu) pa testiraj na test-branchu. Ili provjeri ima li xlsx fajlova iz prethodnih sesija.
- Vizualni izgled (boje, širine stupaca) — prihvatljive manje razlike. Fokus je na ispravnosti strukturalnih promjena.
- Ako T-S26-1 fail: najvjerojatnije ATTR_COL_START problem → provjeri excelImport.ts čita li ispravno kolonu H.
