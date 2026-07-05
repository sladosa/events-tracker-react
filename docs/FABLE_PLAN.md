# Strategic Plan: Quality + Data Import (S104–S110)

**Datum:** 2026-07-05  
**Temelj:** Fable 5 review (2026-07-03) + Diary strategija (2026-07-04) + CLAUDE.md backlog  
**Cilj:** Maksimalna aplikacijska kvaliteta + uvoz trening.xlsm (Diary sheet) + analytics cap  
**Vremenska perspektiva:** 8 tjedana (4-5 fokusirajućih sesija po 6-8 sati)

---

## I. Kritične arhitekturalne ispravke (S104–S105) — Fable findings

Fable 5 review je identificirao 7 problema koji ugrožavaju integritet podataka ili su bliskokd problemi. Redoslijed po riziku.

### I.1 ⚠️ HIGHEST PRIORITY: Delete Activity bug (30 min)

**Bug:** `handleDeleteActivity` u `AppHome.tsx` briše **sve** evente s istim `session_start`, ignorirajući kategoriju. Ako unosiš 2 aktivnosti istovremeno (Trčanje + Snaga u 09:00), brisanje Trčanja briše i Snagu.

**Fable nalaz:** T-BUGG-5 tip — ista greška je već nađena i fiksana u `excelImport.ts:819`. Ovdje nije.

**Fix:** 3 linije `AppHome.tsx`. Dodati `chain_key` (= leafCategoryId) filter.

**Status:** ⬜ Čeka implementaciju  
**Session:** S104

---

### I.2 Parent-event write logika — 4 mjesta (S104, 2–3 sata)

**Problem:** `insertParentEvent()` je copy-paste u 4 odvojena mjesta:
1. `AddActivityPage.tsx:954–1027`
2. `EditActivityPage.tsx:1002–1145`
3. `excelImport.ts:643–703` (`upsertParentEventForUpdate`)
4. `excelImport.ts:836–899` (drugi blok u CREATE toku — duplikat unutar istog fajla!)

**Rizik:** Promjena u parent event logici (npr. sub-session koncept, new attr na parent levelu) zahtijeva update na 4 mjesta → vjerojatno ćeš propustiti jedno.

**Fix:** Ekstrahirati `upsertParentEvent(leafCategoryId, sessionISO, attrs, userId)` u `parentEventLoader.ts` uz `buildParentChainIds` koji je tamo. Sva 4 mjesta postaju 1-linijski poziv.

**Status:** ⬜ Čeka implementaciju  
**Session:** S104  
**Procjena:** 2–3 sata (test coverage za parent logic)

---

### I.3 BUG-S102-DELETE: Stale event count pri Delete Area (1 sat)

**Problem:** `StructureDeleteModal` — ako su eventi dodani u istoj sesiji, Delete Area briše bez backup prompt upozorenja (jer koristi stale `node.eventCount` iz snapshot-a).

**Impact:** Nizak — `cascadeDelete` ionako svaki put fresh-queryja (nema orphan data), ali UX je loš (korisnik očekuje "Download Backup" prompt).

**Fix:** Live COUNT query u `StructureDeleteModal.tsx` prije `isBlocked` odluke.

**Status:** ⬜ Čeka implementaciju  
**Session:** S104 (prioritet 1)  
**Procjena:** 1 sat

---

### I.4 FilterContext — useMemo + bloat (5 min + 4h refaktor)

**Problem:** `FilterContext` objekt se kreira **iznova na svakom renderu** bez `useMemo` → svi consumeri (ActivitiesTable, StructureTableView, ProgressiveCategorySelector...) re-rendiraju bez razloga.

**Fable preporuka:** 3-step fix:
1. `useMemo` na value objekt (5 min, immediate win)
2. Tipizirani event bus (`appEvents.ts`) za 5 window CustomEventa (2h)
3. Split na FilterProvider + SharingProvider (4h refaktor — opcionalno)

**Status:** ⬜ Korak 1 (useMemo) OBAVEZNO prije S110 (async operations na filteru mogu biti slabi bez toga)  
**Session:** S105 (korak 1), S106 (korak 2, ako je vremenske ok)  
**Prioritet:** MEDIUM (performance, ne correctness)

---

### I.5 BUG-S103-ANYATTR: ILIKE timeout na "In any attribute" (4+ sata)

**Problem:** "In any attribute" filter timeout-a za grantee-e. `ILIKE` nije leakproof operator, Postgres evaluira RLS EXISTS za cijelu `event_attributes` tablicu.

**Privremeno rješenje:** Amber notice u UI (`AppHome.tsx`) kad je `sharedContext` aktivan + `ATTR_FILTER_ANY`.

**Pravi fix:** SECURITY DEFINER RPC koji zaobilazi ILIKE+RLS non-leakproof problem.

**Status:** ✅ S103 privremeni fix + amber notice; ⬜ pravi fix u S105+  
**Prioritet:** MEDIUM (grantee-u je filtar ionako ograničen jer ima samo read access na jednu Area)  
**Procjena:** 4–6 sati (RPC testing)

---

### I.6 Quick wins — Fable Q1–Q6 (ukupno 2–3 sata)

| # | Fix | Gdje | Procjena |
|---|-----|------|----------|
| Q1 | ✅ Delete bug | `AppHome.tsx` | 30 min |
| Q2 | `useMemo` FilterContext | `FilterContext.tsx:715` | 5 min |
| Q3 | Batch `event_attributes` INSERT u importu | `excelImport.ts` | 30 min |
| Q4 | Import progress bar | `ExcelImportModal` | 1h |
| Q5 | Escape ILIKE wildcard znakovi | `eventQueryBuilder.ts:88,99` | 5 min |
| Q6 | Dead code brisanje | — | 30 min |

**Zadnja dva (Q5, Q6)** su nisko-rizični doraščaj. Q3+Q4 su **kritični za Diary uvoz** (7000 redaka bez progress bar-a = korisnik misli da je app froze).

---

## II. Diary migracija (S106–S108) — Fable nije znao za ovo

Volgens `docs/Diary.md`, strategija je jasna. Plan je 7 koraka:

### II.0 Prerequisit (S104, zadnji dio)

**Batch event_attributes INSERT u excelImport.ts** (Fable Q3).  
Bez toga: 7000 redaka × ~10 atributa = 70k sekvencijalnih poziva = 30+ min "frozen" importa.

**Procjena:** 30 min (zajedno s progress bar-om Q4)

### II.1 Kolonska arheologija (1 sesija s korisnikom, 2–3 sata)

**Korak iz docs/Diary.md § 3:**

```
trening.xlsm → audit skripta (pattern: garmin_full_field_audit.py)
   ↓
za svaku kolonu po godini: fill rate, distinct vrijednosti, type guess
   ↓
Korisnik objašnjava značenja po eri
   ↓ Output: mapping tablica (kolona → era → značenje → target atribut + tip + transformacija)
```

**Rezultat:** Mapping tablica u docs/Diary.md §6 (popunjeno).

**Status:** ⬜  
**Session:** S106 (interactive session)  
**Procjena:** 2–3 sata (uključujući audit skriptu)

---

### II.2–II.7 Migracija po koracima (S107–S108)

Nakon II.1, koraci su automatizirati:

| Korak | Što | Procjena | Status |
|-------|-----|----------|--------|
| II.2 | Identitetske odluke (area, session_start pravilo, tipovi) | 30 min | ⬜ |
| II.3 | Kostur strukture (Create categories flow) | — | će biti auto |
| II.4 | Generator skripta (`diary_to_xlsx.py`) | 2h | ⬜ |
| II.5 | TEST import + iteracija (po godinama ako trebalo) | 2h | ⬜ |
| II.6 | Čišćenje nakon importa (Excel roundtrip, P3 lows) | 2–4h | ⬜ |
| II.7 | PROD + ažurirati MIGRATION_STATE.md | 30 min | ⬜ |

**Ukupno za Diary:** ~10 sati čistog razvoja + testing.

**Temporalna strategija:** 
- S106 = II.1 + II.2
- S107 = II.3–II.5
- S108 = II.6–II.7

---

## III. Analytics tab + Period koncept (S109–S110) — Fable F2 ideja

Fable je predložio Analytics tab kao M-veličinu feature (Plotly je **već u bundleu**).

Според `docs/Analytics_tab.md`, dizajn je bio započet. Prije S109 trebalo bi finalizirati Open Questions (§5.1–5.3).

### III.1 Odluke prije implementacije

Iz `docs/Analytics_tab.md` § 5 (Open Questions) — trebalo bi da korisnik potvrdi:

1. **Period vs. Date range:** Koristiti `periods` tablica (Alternativa A) ili status quo s `periodKey` presetima?
   - A = best (no schema changes, retroaktivno), ali samo temporalna semantika
   - Preporuka: **Alternativa A** + `scope` JSONB za future filtering (§1.5)

2. **Cross-area agregacije:** Želiš li trend chart-a koji kombinira više Area-a (npr. "All fitness activities" + "Sleep quality")? Ili per-area?
   - Preporuka: **per-area prvi**, cross-area kao future extension

3. **Eksportabilnost:** Trebaju li Analytics rezultati biti exportable kao xlsx?
   - Preporuka: **ne** — Analytics je read-only drill-down; izvoz je iz Activities tab-a

### III.2 Faza 1 — Period entities (2 sata)

Ako OK na odlukama:
- DB: `CREATE TABLE periods` (Alternativa A iz spec-a)
- API: `/periods` CRUD endpoints
- UI: Period management modal (Create / Edit / Delete)
- Integration: Date range dropdown dobiva `optgroup "My periods"`

### III.3 Faza 2 — Mini-charts (4–6 sati)

`ActivitiesTable` + leaf kategorije → dodatni "Trends" red ispod grupe koji pokazuje line/bar chart.

Primjer: Fitness > Cardio > Outdoor → chart `pace` kroz 90 dana, odnosno `distance` bar chart po sedmici.

**Plotly je već u bundleu** (`vendor-plotly 4.9MB`) — dodavanje male chart-ove ima minimalan dodatni efekt.

### III.4 Faza 3 — Full Analytics tab (5–8 sati)

Novi tab s table-om što je dostupno po Area-i, UI za odabir `Series` (category + attr + agg), period, drill-down, export.

**Procjena za III ukupno:** 12–16 sati (ali nije kritično za uvoz podataka)

---

## IV. Redoslijed po sesijama (preporuka)

### S104 — Quality quickwins + Diary prerequisit
- I.1 Delete bug (30 min)
- I.2 Parent event extract (2–3h)
- I.3 BUG-S102-DELETE live recount (1h)
- I.6 Q1–Q6 quickwins: Q2, Q5, Q6 (50 min) + Q3, Q4 batch insert + progress (1.5h)
- **Ukupno:** 5–6 sati
- **Commit:** S104 quality round 1

### S105 — Kontekst + Early Diary
- I.4 FilterContext `useMemo` (5 min)
- I.4 Tipizirani event bus (2h, opcionalno ako je vremenske ok)
- II.1 Dairy archeology session s korisnikom (2–3h)
- II.2 Identitetske odluke (30 min)
- **Ukupno:** 4.5–5.5 sati
- **Commit:** S105 context refactor + Diary spec

### S106 — Diary generator + struktura
- II.4 `diary_to_xlsx.py` skripta (2h)
- II.3 Create categories flow (testiranje)
- II.5 TEST import, iteracija po godinama (2h)
- **Ukupno:** 4 sata
- **Commit:** S106 Diary migracija TEST import

### S107 — Dairy čišćenje + PROD
- II.6 Post-import cleaning (Excel roundtrip, P3) (2–4h)
- II.7 PROD import + ažuriranje MIGRATION_STATE.md (1h)
- **Ukupno:** 3–5 sati
- **Commit:** S107 Diary PROD + migration checklist

### S108 — Analytics foundations (ako je vremenske)
- III.1 Open questions + user feedback (1h)
- III.2 Period entities (2h)
- **Ukupno:** 3 sata
- **Commit:** S108 Period entities

### S109–S110 — Analytics tab (opcionalno)
- III.3–III.4 Mini-charts + full Analytics UI (ako želiš prije nego što počneš s drugimAreama, npr. Health/Lab review cleanup)

---

## V. Dokumentacijska pravila i cleanup

### V.1 Što ažurirati

| Dokument | Što + zašto | Prioritet |
|----------|----------|-----------|
| `docs/FABLE_PLAN.md` | **Ovo** — novi file (plan po sesijama) | ✅ Sada (S105) |
| `CLAUDE.md` backlog | Dodati "Done (S104)" sekcijai Done sektori (parent event, delete bug, etc.); Diary II.1–II.7 kao pendinga | S104 end |
| `docs/Diary.md` | Popunjavanje §6 mapping tablice tijekom II.1 | S105 |
| `MIGRATION_STATE.md` | Update "Garmin/Activities" row: TEST ✅ → ⬜ Clean; nakon II.7, "trening.xlsm" add s PROD ✅ | S107 |
| `docs/Analytics_tab.md` | Finalizacija §5 (Open Questions) nakon III.1 | S108 |
| `docs/Help_details.md` | Treće "Feature inventory" sekcije (npr. za Analytics tab) kad tab postoji | S109+ |

### V.2 Zastarjele dokumente (prebaci u obsolete/ ili obriši)

Pregledavam `docs/obsolete/` — postoji 12 fajlova.

**Kandidati za brisanje čak i iz obsolete/** (jer su već superseded):

| File | Razlog | Preporuka |
|------|--------|-----------|
| `obsolete/MULTI_USER_SHARING_ANALYSIS.md` | Superseded od COLLAB_PLAN_v2.md; v1 logika je integrated | **Obriši** |
| `obsolete/ADD_ATTRIBUTE_SPEC.md` | V1 spec, Add Attribute je napravljen (S28); već je retired | **Obriši** |
| `obsolete/FAZA_10E_SMART_IMPORT_SPEC.md` | Smart import nije implementiran; plan je objasnjen u Diary.md koraci | **Obriši** |
| `obsolete/SUGGEST_DEPENDSON_SPEC_v2.md` | V2 je implemented (S29–S30); v2 nije trebala biti spec, već commit log | **Obriši** |

**Kandidati za ažuriranje/promovirati iz obsolete/**:

| File | Status | Preporuka |
|------|--------|-----------|
| `obsolete/COLLAB_PLAN_v1.md` | Superseded od v2 (COLLAB_PLAN_v2.md) | Ostani u obsolete/ |
| `obsolete/RESTRUCTURE_ANALYSIS.md` | Dio je integriran u RESTRUCTURE_DECISIONS_2026-04-01.md | Ostani u obsolete/ |

### V.3 Što je dobro kako je

- ✅ `docs/ARCHITECTURE_v1_6.md` — živući dokument, ažuran
- ✅ `docs/Code_Guidelines_React_v6.md` — jasne konvencije
- ✅ `docs/COLLAB_PLAN_v2.md` — detaljan, do kraja
- ✅ `docs/RESTRUCTURE_DECISIONS_2026-04-01.md` — decision log, vrijedan za budućnost
- ✅ `docs/help/*.md` — dinamički učitani od AI systema, ažuran s featurima
- ✅ `data-prep_tools/DATA_PIPELINE_PLAN.md` — referentni dokument za sve migracije
- ✅ `data-prep_tools/MIGRATION_STATE.md` — status tracking table

---

## VI. Što se NE trebalo brisati (jer je vrijedan)

`docs/FABLE_REVIEW_2026-07-03.md` — **Arhivna vrijednost:**
- Sve Fable kritike su implementacijski relevantne
- Feature ideje (F1–F5) su backlog za kasnije
- Trebati će kao referenca tijekom S104–S105 implementacije

→ Ostaviti gdje je (docs/), ne premještati u obsolete/.

---

## VII. Buduće extension (van ovog plana, 2026+)

Iz Fable review-a — low-priority ideje:

| Ideja | Veličina | Kada | Napomena |
|-------|----------|------|---------|
| **F1. Repeat last session** | S | 2027+ | Kontekst: Shortcuts + prefill |
| **F3. Generaliziran aggregate attr** | L | 2027+ | SUMIFS po Računu, kumulativna analiza |
| **F4. Changes-only export** | S | 2027 Q1 | Potreban za Tip/Podtip reklasifikacijski workflow |
| **F5. Grantee change feed** | S | 2027 Q2 | "N novi zapisi od Koke od utorka" |
| **Garmin / Sleep import** | M | 2026 Q4 | Čeka `garmin_sleep_to_xlsx.py` |
| **Health / Lab review cleanup** | M | 2026 Q4 | Separ Medical Visit iz Lab Results (MIGRATION_STATE.md Prioritet 1) |

---

## VIII. Zaključak

**Razina:** Realistična, fokusirana na **integritet podataka** (Fable arkitekturalni nalazi) prije mass import-a.

**Rok za S110:** ≈4–5 tjedana @ 6–8 sati po sesiji = ~30–35 sati neto razvoja.

**Čeka korisnika:**
- S105: II.1 (Diary archeology) — interactive session
- S108–S109: III.1 (Analytics decisions) — 1h feedback sesija
- S107 end: PROD import confirmation — 30 min

**Risk mitigation:**
- Q3+Q4 (batch insert + progress bar) u S104 = Diary won't freeze na 7000 redaka
- Batch parent event logic (I.2) = future parent-level features su jeftini
- Delete bug (I.1) = nema slučajnog data loss-a
