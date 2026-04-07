# RESTRUCTURE_DECISIONS_2026-04-01.md
# Events Tracker — Odluke o reorganizaciji baze (sesija 2026-04-01)

**Podloga:** `docs/RESTRUCTURE_ANALYSIS.md` — scenariji A–F, opcije 1–4, pitanja Q1–Q6
**Status:** Odluke donijete — čuvamo kao referencu za budući razvoj

---

## 1. Prioritet reorganizacije — odluka

**Reorganizacija Financija nije prioritet sada.**

Razlozi:
- Financije Area ima samo testne evente — mogu se ručno pobrisati ako treba
- Struktura kategorija Financija nije finalizirana
- Kolaboracija dolazi prije reorganizacije (vidi COLLAB_PLAN_v1.md)
- Reorganizacija Financija smislenija je nakon što je collab stabilan
  (moguće kreiranje dvije Financije Area-e: privatna + kolaborativna)

---

## 2. Data model za Financije — odluka

**Odabrana: Opcija A** — `value` i `unit` atributi na L1 razini (Prihod/Rashod),
ne na svakom leaf-u.

```
Prihod (L1) → value: number, unit: text (default 'eur')
  ├── Placa (leaf) → description: text (optional)
  ├── Freelance (leaf) → description, klijent (optional)
  └── Najam (leaf) → description (optional)

Rashod (L1) → value: number, unit: text (default 'eur')
  ├── Hrana (L2, bez atributa — samo grupiranje)
  │     ├── Restoran (leaf) → description (optional)
  │     └── Dućan (leaf) → description (optional)
  ├── Prijevoz (L2)
  │     ├── Gorivo (leaf) → litri (optional, leaf-specifičan)
  │     └── Parking (leaf)
  └── ...
```

**Zašto Opcija A:**
- `value` je atribut koncepta "transakcija" (Prihod/Rashod), ne atribut "Restorana"
- Novi leaf = samo INSERT kategorije, bez kopiranja atributa
- P2 arhitektura automatski kreira parent event za Prihod/Rashod uz svaki leaf event
- Leaf-specifični atributi (npr. `litri` za Gorivo) mogu postojati uz L1 atribute

**Nije implementirano** — samo je dizajnerska odluka za kad dođe na red.

---

## 3. Excel-driven migration (Opcija 3) — odluka

**Odabrani pristup:** AI kao Excel transformer + enhanced import (move detection)

### Zašto ne "delete staro + import novo":
- Kategorije s eventima **ne mogu se obrisati** (blokirano u S27)
- Čak i kad bi mogle: brisanje kaskadira na evente → gubitak podataka

### Pravi workflow za reorganizaciju:
```
1. Export Structure Excel (17 col format)
2. AI transformira Excel:
   - Scenarij A (Insert Between): "Gym > Strength" → "Gym > Upper Body > Strength"
   - Scenarij B (Move to Area): "Domacinstvo > Automobili" → "Financije > Automobili"
   - Scenarij C (Move leaf): "Gym > Cardio" → "Sport > Cardio"
3. Enhanced import (BUDUĆI razvoj):
   - slug postoji + CategoryPath isti → skip (već radi)
   - slug postoji + CategoryPath drugačiji → MOVE (UPDATE parent_category_id)
   - slug ne postoji → INSERT (već radi)
4. Nema brisanja, nema gubitka evenata
```

### "Remap unknown path" za stare backupe:
- **Odgođeno** — nema trenutnog blockera
- Za historijski import: AI transformira stari Excel na novu strukturu (trivijalno)
- Implementirati kad bude recurring need (vjerojatno nakon collab)

---

## 4. Orphan parent eventi (Q3) — odluka

**Nije donesena finalna odluka** — problem se ne pojavljuje sve dok nema
Scenarij C (Move leaf) operacija u UI ili SQL.

Preferencija kad dođe na red: **opcija (b) auto-brisanje s backupom**
- Backup prije svake reorganizacijske operacije je obavezan (već postoji u S27 patternu)
- Orphan eventi su "dead weight" bez koristi za UI
- Logging u SQL migracijskom skriptu: RAISE NOTICE o broju obrisanih orphana

---

## 5. Excel roundtrip strategija (Q4) — odluka

**Odabrana: Strategija 1** — stari Excel je stale, dokumentirano.

- Svaki backup ima implicitni "rok trajanja": valjan dok se struktura ne promijeni
- Full backup prije reorganizacije = jedini validan restore fajl
- PathMapping sheet (Strategija 2) moguć kao kasnija nadogradnja uz Excel-driven migration

---

## 6. SQL-first vs UI za reorganizaciju (Q5) — odluka

**Za Financije** (kad dođe na red): SQL skripta, pokrenuta direktno u Supabase.
Razlozi:
- Testni eventi — mogu se pobrisati, stoga čak ni SQL migracija evenata nije nužna
- Nema sense u ulaganju frontend vremena za jednokratnu operaciju
- SQL okviri za Scenarij A i B već su napisani u RESTRUCTURE_ANALYSIS.md (Prilog A, B)

**Za dugoročnu reorganizaciju:** Insert Between UI + Excel-driven migration (Opcija 4 hybrid).
Ovo dolazi **nakon** collab, kad bude jasno koji scenariji su stvarno potrebni.

---

## 7. Multi-user timing (Q6) — odluka

**Reorganizacija se uvijek radi dok je sustav "miran"** (single active user, koordinirano).
- Nema "Maintenance lock" implementacije za sada
- SQL operacija je brza (milisekunde) → window za race condition zanemariv u praksi
- Ovo preispitati ako collab korisnici postanu aktivni i česti

---

## 8. Historijski podaci — organizacijske odluke

### Projekt struktura:
- Historijska migracija ide u **odvojeni direktorij**: `C:\0_Sasa\events-data-migration\`
- Vlastiti CLAUDE.md koji referira ovaj projekt (data model, Excel format, SQL schema)
- Tools: Python za Garmin FIT parsing; output = unified workbook format za import
- "Bridge" između projekata: Excel format (migration producira, app konzumira)

### Redosljed:
1. Collab stabilizacija
2. Definirati kategorije za historijske podatke (diskusija)
3. Jedan probni import (AI transformira stari Excel)
4. Garmin ZIP/FIT parser (zasebni projekt, zasebni chat)

---

## 9. Backlog prioriteti — potvrđen redosljed

```
Sada (test-branch):   Nema novih feature-a — spremi se za collab granu
Collab grana:         COLLAB_PLAN_v1.md — sve faze 0–8
Nakon collab:         Financije reorganizacija + data model
                      Historijski import (events-data-migration projekt)
                      "Remap unknown path" u importu (ako se pokaže potreba)
                      Insert Between UI (ako se pokaže potreba)
Dugoročno:            Excel-driven migration s move detection
```

---

*Dokument kreiran: 2026-04-01 — osnova za diskusiju u budućim sesijama*
*Podloga: razgovor o RESTRUCTURE_ANALYSIS.md i data modelu Financija*
