# Migration State

Track what data sources exist, where we are in the pipeline, and what area they land in.

**Pipeline stages:** Audit → Script → xlsx → TEST import → Clean → PROD import

| Source | Audit | Script | xlsx | TEST | Clean | PROD | Area u app |
|--------|-------|--------|------|------|-------|------|------------|
| Garmin / Activities | ✅ S71 | ✅ S71 | ✅ S71 | ✅ S71 | ⬜ | ⬜ | `Fitness_Garmin` |
| Garmin / Daily metrics | ✅ S77 | ✅ S77 | ✅ S77 | ✅ S77 | ⬜ | ✅ S78 | `Health_Sasa > Daily_metrics > Garmin_data` |
| Garmin / Sleep | ✅ S71 | ⬜ | ⬜ | ⬜ | — | ⬜ | `Health_Sasa > Daily_metrics > Garmin_data` (stub cols ready) |
| Bloodwork.xlsx | ✅ S68 | ✅ S68 | ✅ S68 | ✅ | ✅ S74 | ✅ | `Health_Saša` |
| Za Sašu 2026 (Financije) | ✅ S65 | ✅ S65 | ✅ S65 | ✅ | ⬜ | ⬜ | `Financije_1` |
| trening.xlsm (ručni log) | ⬜ | ⬜ | ⬜ | ⬜ | — | ⬜ | (mapiranje u Fitness?) |

---

## Garmin / Activities — detalji (S71)

**Source files:** `data-prep_data/DataFromGarmin/DI_CONNECT/DI-Connect-Fitness/`
`sasasl_{0,1001,2002,3003}_summarizedActivities.json`

**Script:** `data-prep_tools/Tools/garmin_activities_to_xlsx.py`

**Output:** `data-prep_data/Fitness_Garmin_import.xlsx`
- 3134 aktivnosti: 2002 Outdoor, 1127 Gym/Cardio, 5 Strength
- Vremenski raspon: 2015–02/2025

**Konverzije:**
- `duration`: ms → minute (÷ 60000)
- `distance`: cm → km (÷ 100000) — Garmin pohranjuje u cm!
- `elevationGain`: cm → m (÷ 100)
- `pace`: text "MM:SS" format (e.g. "06:04") — u bazi kao `text`, ne `number`
- `location`: Nominatim reverse geocode (zoom=18), cache u `geocode_cache.json`

**Struktura u appu:**
```
Fitness_Garmin (Area)
└── Activity (L1) — shared attrs: duration, hr_avg, hr_max, kcal,
                    aerobic_effect, anaerobic_effect, training_load,
                    intensity (manual), mood (manual), location (geocoded)
    ├── Gym (L2)
    │   ├── Cardio (L3 leaf) — cardio_type, equipment (orb/erg), intervals_description
    │   └── Strength (L3 leaf) — strength_type, exercise_name, sets_reps, weight_info
    └── Outdoor (L2 leaf) — outdoor_type, trening_type, distance, pace, terrain, total_ascent
```

**NAPOMENA za import:** `pace` attr mora biti tipa `text` (ne `number`) — skripte
auto-patchaju Structure sheet. Ako direktno importaš `Sport_structure.xlsx`, promijeni
pace row u koloni I (AttrType) iz `number` u `text` prije importa.

**Sljedeći koraci:**
1. ✅ Import `Fitness_Garmin_import.xlsx` u TEST bazu (T-S71-1 prošao)
2. ✅ Spot check u appu (pace, location, kategorije)
3. ⬜ Data cleaning (vidjeti sekciju "Data Cleaning Workflow" ispod)
4. ⬜ Import u PROD (preimenovati area iz "Fitness_Garmin" u "Fitness" ili ostaviti)

---

## Garmin / Sleep — plan (S71)

**Source files:** `DataFromGarmin/DI_CONNECT/DI-Connect-Wellness/*_sleepData.json`
- 3127 zapisa, 2016–02/2025

**Dostupno iz Garmina:**

| Attr | Garmin field | Pokrivenost |
|------|-------------|-------------|
| sleep_score | `sleepScores.overallScore` | 100% |
| deep_min | `deepSleepSeconds / 60` | 100% |
| rem_min | `remSleepSeconds / 60` | 98% |
| recovery_score | `sleepScores.recoveryScore` | 100% |
| awake_count | `awakeCount` | 100% |
| body_battery | — | ❌ nije u exportu |
| hr_min_night | — | ❌ nije u exportu |
| hrv_night | — | ❌ nije u exportu |

Body Battery, HRV i HR_min noću vidljivi su u Garmin appu ali nisu u GDPR exportu —
unos ručno ujutro.

**Leaf postoji:** `Health > Sleep` (0 eventa) — treba dodati gore navedene atribute
prije importa. Trenutno ima samo `duration` i `quality`.

---

## Garmin data audit (S71)

Detaljni audit u: `data-prep_data/garmin_audit_report.md`

Supabase struktura snapshot: `data-prep_data/supabase_structure_report.md`
(regeneriraj sa `python data-prep_tools/Tools/supabase_structure_export.py`)

---

## TEST → PROD Workflow

Standard postupak za promoviranje podataka iz TEST u PROD:

```
Python skripta → xlsx (generički — bez baze-specific ID-ova)
    ↓
Import u TEST (Z_ prefix na Area ako je destruktivno/throwaway)
    ↓
Spot check u appu (5–10 eventa, struktura ispravna?)
    ↓  da
[Opcionalno] Data cleaning (vidi sekciju ispod)
    ↓
Import isti xlsx → PROD
    ↓
Ažurirati ovu tablicu (TEST ✅, Clean ✅/—, PROD ✅)
```

**Throwaway pattern:** `Z_` prefix na imenu Area (sortira se na dno liste, lako prepoznatljivo).
Po verifikaciji: obriši Area (Structure → Delete cascade) i reimportaj s čistim imenom.

**Schema changevi** (SQL migracije 001–019 itd.) idu paralelno — ne čekaju xlsx workflow,
deployaju se ručno na TEST i PROD odmah.

**Drift prevencija:** Ne akumuliraj "TEST ✅, PROD ⬜" stanje — promotaj što prije.

---

## Data Cleaning Workflow

Nakon prvog importa podaci često trebaju "recept" korekciju:
- Atribut u krivoj kategoriji (npr. dio Lab Results evenata zapravo Medical Visit)
- Podatak razmrskan između comment-a i atributa
- Duplikati ili krivi formati

**AI-assisted cleaning proces (S74+):**

1. **Inspect:** Claude pokrene `db_inspector.py --area "Health_Saša"` direktno iz chata
   → dobiva strukturu + sample eventa bez manualnog copy-paste
2. **Recipe:** korisnik opiše što treba (plain language: "eventi s ovim u komentaru idu u Medical Visit")
3. **Generate:** Claude generira SQL ili Python transformaciju
4. **Review:** korisnik pregleda skriptu
5. **Run:** korisnik pokrene na TEST → verificira → pokrene na PROD

**Alat:** `data-prep_tools/Tools/db_inspector.py` ✅ (implementiran)
- Argumenti: `--area`, `--category`, `--fields`, `--limit`, `--check duplicates|ranges|empty`
- Koristi Supabase service role (`.env.local`), zaobilazi RLS
- Output: markdown tablica u stdout (Claude vidi direktno iz chata)

**Cleaning log po izvoru:**

| Source | Problem | Status | Skripta |
|--------|---------|--------|---------|
| Bloodwork.xlsx | Lab Results comment sadrži i medical visit bilješke | ⬜ | `Health/health_lab_review.py` — generira review + import xlsx |
| Garmin / Activities | — (čisti podaci iz Garmin JSONa) | — | — |
