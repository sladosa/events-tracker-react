# Migration State

Track what data sources exist, where we are in the pipeline, and what area they land in.

**Pipeline stages:** Audit → Script → xlsx → TEST import → PROD import

| Source | Audit | Script | xlsx | TEST | PROD | Area u app |
|--------|-------|--------|------|------|------|------------|
| Garmin / Activities | ✅ S71 | ✅ S71 | ✅ S71 | ⬜ | ⬜ | `Fitness_Garmin` |
| Garmin / Sleep | ✅ S71 | ⬜ | ⬜ | ⬜ | ⬜ | `Health > Sleep` (leaf postoji) |
| Bloodwork.xlsx | ✅ S68 | ✅ S68 | ✅ S68 | ✅ | ✅ | `Health_Saša` |
| Za Sašu 2026 (Financije) | ✅ S65 | ✅ S65 | ✅ S65 | ✅ | ⬜ | `Financije_1` |
| trening.xlsm (ručni log) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | (mapiranje u Fitness?) |

---

## Garmin / Activities — detalji (S71)

**Source files:** `Claude-temp_R/Data_preparation/DataFromGarmin/DI_CONNECT/DI-Connect-Fitness/`
`sasasl_{0,1001,2002,3003}_summarizedActivities.json`

**Script:** `data-prep/Tools/garmin_activities_to_xlsx.py`

**Output:** `Claude-temp_R/Data_preparation/Fitness_Garmin_import.xlsx`
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
1. Import `Fitness_Garmin_import.xlsx` u TEST bazu
2. Pregledati nekoliko aktivnosti u appu
3. Ako OK → import u PROD (preimenovati area iz "Fitness_Garmin" u "Fitness" ili ostaviti)

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

Detaljni audit u: `Claude-temp_R/Data_preparation/garmin_audit_report.md`

Supabase struktura snapshot: `Claude-temp_R/Data_preparation/supabase_structure_report.md`
(regeneriraj sa `python data-prep/Tools/supabase_structure_export.py`)
