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

## T-S26-6

**Opis:** Activities Export → 5 sheetova u xlsx

**Koraci:**
1. Activities tab → Export → preuzmi xlsx
2. Otvori u Excelu, provjeri sheet tabove:
   - `Events` — postoji (pravi podaci)
   - `HelpEvents` — postoji
   - `Structure` — postoji (puna struktura, nefiltrirana)
   - `HelpStructure` — postoji
   - `Filter` — postoji
3. Provjeri `Structure` sheet: sadrži normalne podatke (nije stub)

**Očekivano:** Točno 5 sheetova s navedenim imenima

---

## T-S26-7

**Opis:** Activities Export → Filter sheet s stvarnim datumima

**Koraci:**
1. Export bez datumskog filtera (All time)
2. Otvori `Filter` sheet:
   - `Export type` = `Activities`
   - `Date From` = `All time (YYYY/MM/DD)` gdje je datum stvarnog prvog eventa u exportu
   - `Date To` = `All time (YYYY/MM/DD)` gdje je datum stvarnog zadnjeg eventa
   - `Sort order` = `Newest first` ili `Oldest first`
3. Export s aktivnim datumskim filterom (npr. od 2026-01-01):
   - `Date From` = `2026-01-01` (direktno, bez "All time")
   - `Date To` = datum filtera ili `All time (YYYY/MM/DD)`

**Očekivano:** Format `All time (2026/01/29)` za nepostavljene datume, direktni datum za postavljene

---

## T-S26-8

**Opis:** Activities Export → filename s punim timestamp

**Koraci:**
1. Export → preuzmi datoteku
2. Provjeri naziv: `events_export_YYYYMMDD_HHmmss.xlsx` (npr. `events_export_20260327_095937.xlsx`)

**Očekivano:** Datum + sat:minuta:sekunda u imenu datoteke

---

## T-S25-1 (retest)

**Opis:** Structure Import → Area-only red → result summary vidljiv, nova Area u filteru

**Napomena:** Testirati s **novo exportanim** structure xlsx (S26 format, sheet = `Structure`).
Stari xlsx (HierarchicalView sheet) više nije podržan.

**Koraci:**
1. Structure tab → Export → preuzmi xlsx
2. U xlsx dodaj novi red: `Type=Area`, `CategoryPath=MojaTestArea`
3. Structure tab → Import → uvezi modificirani xlsx
4. Provjeri: modal ostaje otvoren i prikazuje result summary
5. Zatvori modal → nova Area vidljiva u filteru (bez page refresha)

**Očekivano:** Modal ne zatvara automatski, result summary prikazuje "Areas created: 1"

---

## T-S26-9

**Opis:** Filter sheet — Period label = 'All time' kad nema datumskih filtera

**Koraci:**
1. Activities Export bez postavljenih datuma (All time) → otvori Filter sheet
   - `Period label` = `All time`
2. Activities Export s postavljenim From datumom (npr. 2026-01-01) → Filter sheet
   - `Period label` = prazno (nije "All time" jer su datumi eksplicitno odabrani)
3. Structure Export → Filter sheet
   - `Period label` = `All time`

**Očekivano:** `All time` samo kad nema eksplicitnih datuma; inače prazno

---

## T-S26-10

**Opis:** Activities Export — Structure sheet filtriran prema aktivnom filteru

**Koraci:**
1. Postavi filter na specifičnu Area (npr. "Running")
2. Export → otvori `Structure` sheet
3. Provjeri: sadrži SAMO čvorove koji belong to "Running" arealu
4. Provjeri: ostale area-e NISU vidljive

**Koraci (full export):**
1. Ukloni sve filtere
2. Export → otvori `Structure` sheet
3. Sadrži cijelu strukturu (sve area-e)

**Očekivano:** Structure sheet prati isti filter kao Events sheet

---

## Napomene za testiranje

- Stari xlsx fajlovi (pre-S26) nisu podržani — novi format je S26+. Streamlit sustav radi neovisno.
- Vizualni izgled (boje, širine stupaca) — prihvatljive manje razlike. Fokus je na ispravnosti strukturalnih promjena.
