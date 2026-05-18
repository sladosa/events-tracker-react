# Data Pipeline Plan

Referentni dokument za sve migracije podataka u events-tracker.
Za status po izvoru → `MIGRATION_STATE.md`.

---

## Prerequisiti — napraviti prvo

### 1. `db_inspector.py` ✅ (implementiran)

Alat koji Claudeu omogućuje direktan pogled u bazu iz chata (via Bash tool).

```
python db_inspector.py --area "Health_Saša"
python db_inspector.py --area "Fitness_Garmin" --category "Outdoor" --limit 20
python db_inspector.py --area "Health_Saša" --category "Lab Results" --fields comment --limit 50
```

Što treba raditi:
- Autentikacija: Supabase service role key iz `.env.local`
- Dohvat: area → kategorije → eventi (sample) → event_attributes + comment
- Output: markdown tablica u stdout (Claude vidi direktno)
- Opcija `--fields` za prikaz samo određenih atributa
- Opcija `--sql` za arbitrary SELECT (za cleaning provjere)

---

## Izvori podataka — plan po prioritetu

### Prioritet 1: Health_Saša cleanup ⬜

**Problem:** `comment` u Lab Results eventima sadrži mixed content:
```
"Kratin H · Kolesterol H | Bates, UZV abdomena Natko Bek - komunikativan tip..."
```
Tekst ispred `|` su lab flag-ovi (auto-generirani), tekst iza `|` su bilješke s doktorskog posjeta.

**Plan:**
1. `db_inspector.py --area "Health_Saša" --category "Lab Results" --fields comment`
2. Identificirati koji eventi imaju `|` separator (Medical Visit mix)
3. Za svaki: kreirati novi Medical Visit event (isti `session_start`), prebaciti tekst iza `|`
4. Na Lab Results eventu: ostaviti samo tekst ispred `|`
5. Generirati Python cleaning skriptu
6. Pokrenuti na TEST → verificirati u appu → PROD

**Napomena:** Medical Visit kategorija već postoji u `Health_Saša`. Treba provjeriti koje atribute ima.

---

### Prioritet 2: Fitness_Garmin → PROD ⬜

**Status:** xlsx generiran (S71), importiran u TEST (T-S71-1 ✅), spot check OK.

**Plan:**
1. `db_inspector.py --area "Fitness_Garmin"` — PROD-ready check
   - Numerički outlieri (duration, distance, pace format)?
   - Prazni atributi koji ne bi trebali biti prazni?
   - Duplikati?
2. Ako čisto: import `Fitness_Garmin_import.xlsx` → PROD
3. Odluka o nazivu: ostaviti "Fitness_Garmin" ili preimenovati u "Fitness"?

---

### Prioritet 3: Garmin / Sleep ⬜

**Status:** JSON source postoji (3127 zapisa), skripta nije napisana, leaf `Health > Sleep` postoji ali prazna.

**Plan:**
1. Dodati atribute na `Health > Sleep` leaf (trenutno ima samo `duration` i `quality`):
   - `sleep_score` (number)
   - `deep_min` (number)
   - `rem_min` (number)
   - `recovery_score` (number)
   - `awake_count` (number)
   - (body_battery, hr_min_night, hrv_night → ručni unos, ne iz Garmina)
2. Napisati `data-prep_tools/Health/garmin_sleep_to_xlsx.py`
3. Import u TEST → spot check → PROD

---

### Prioritet 4: Financije reorganizacija ⬜

**Status:** `Za Sašu 2026` (356 redova) importiran u TEST. Čeka Kokin feedback o strukturi.
Docs: `data-prep_data/Financije/KOKA_STRUKTURA_PRIJEDLOG.md`

**Plan:**
1. Koka pregleda prijedlog i daje feedback
2. Prilagoditi strukturu (max L2, Vrsta dropdowns)
3. Regenerirati xlsx s čistom strukturom
4. Import TEST → PROD

---

### Prioritet 5: trening.xlsm (historijski podaci) ⬜

**Status:** Nije početo. Nema vremenskog pritiska.

**Plan:**
1. Audit: otvoriti xlsm, dokumentirati sheetove i kolone
2. Mapiranje: kolone → kategorije/atributi u Fitness_Garmin (ili nova area?)
3. Python skripta za konverziju
4. Import TEST → PROD

---

## Dirty Excel Workflow — tehnika za prljave podatke

Koristi se kad izvorni Excel ima **nestrukturirani ili mixed content** i ne znamo odmah mapiranje.

### Faza 1: Staging import (sirovi podaci)

Umjesto odmah mapirati kolone na atribute, kreiramo privremene `text` atribute:

```
raw_col_A, raw_col_B, raw_col_C, ...
```

Python skripta čita Excel i svrstava svaku kolonu u jedan text atribut (1:1 kopija, bez transformacije). Import u TEST.

### Faza 2: Inspekcija u chatu

```
db_inspector.py --area "Z_Staging_XYZ" --limit 10
```

Claude vidi raw podatke. Zajedno sa korisnikom:
- "Kolona A je uvijek datum — ide u `session_start`"
- "Kolona B redovi 1–5 su iznosi u kunama, redovi 6+ su opisi — treba split"
- "Kolona C od linije 200 nadalje je novi tip eventa (Medical Visit, ne Lab)"

### Faza 3: Recept → skripta

Na temelju dogovora, Claude generira `clean_XYZ.py`:
- Split po separatoru (`|`, newline, `;`)
- Prebacivanje u pravi atribut (UPDATE event_attributes)
- Kreiranje novih eventa (INSERT) za prebačene zapise
- Brisanje staging atributa

### Faza 4: Promocija

Staging area (`Z_`) → obriši → reimportaj s čistim imenom → PROD

---

## PROD-ready checklist

Prije svakog PROD importa provjeriti:

| Provjera | Metoda |
|----------|--------|
| Struktura kategorija ispravna | db_inspector → kategorije |
| Numerički outlieri (min/max sanity check) | db_inspector --sql |
| Duplikati (isti session_start + category) | db_inspector --sql |
| Prazni atributi koji ne bi trebali biti prazni | db_inspector |
| Comment polja — mixed data pattern | db_inspector --fields comment |
| Attr tipovi ispravni (text/number/datetime) | Structure tab u appu |
| Datum raspon logičan | db_inspector --sql MIN/MAX session_start |

---

## Alati u `data-prep_tools/Tools/`

| Alat | Status | Opis |
|------|--------|------|
| `common_excel.py` | ✅ S71 | Shared library — `excel_date()`, `STRUCTURE_HEADERS`, `write_structure_row()` |
| `supabase_structure_export.py` | ✅ S71 | Čita areas/cats/attrs, ispisuje markdown |
| `excel_import_template.py` | ✅ S71 | Referentni template za nove import skripte |
| `garmin_activities_to_xlsx.py` | ✅ S71 | Garmin JSON → xlsx (3134 aktivnosti) |
| `garmin_full_field_audit.py` | ✅ S71 | Katalog svih Garmin JSON polja |
| `db_inspector.py` | ✅ | Events + attrs inspekcija za Claude iz chata |
| `Health/health_lab_review.py` | ✅ | Health_Saša review xlsx — Lab Results / Medical Visit split priprema |
| `Health/garmin_sleep_to_xlsx.py` | ⬜ | Garmin Sleep JSON → xlsx |
| `clean_health_labresults.py` | ⬜ | DB cleaning skripta (import via Excel roundtrip) |
