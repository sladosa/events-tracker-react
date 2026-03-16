# Events Tracker React — ARCHITECTURE.md

**Version:** 1.2 — 2026-03-12  
**Scope:** Single source of truth for core principles, data model, and critical patterns.  
**Audience:** Claude (session continuity), Sasa (developer reference), future refactoring.

> ⚠️ **Regression compass:** Any change touching `session_start`, `category_id`, `event_id`, the parent/leaf distinction, `chain_key`, or the Excel roundtrip **must** be verified against this document.

---

## 1. Project in one sentence

A personal activity tracking web app (fitness, habits, diary) built on an EAV data model with hierarchical categories up to 10 levels deep, Excel roundtrip as the primary bulk workflow, and Supabase as the backend.

**Stack:** React 19 + TypeScript + Vite + Tailwind + Supabase + Netlify  
**Database:** Supabase (PostgreSQL) with RLS policies per `user_id`  
**Deploy:** Netlify (main branch only, no preview deploys)

---

## 2. Data model

### 2.1 Key tables

```
areas              → top-level container (Fitness, Health, Work...)
  └── categories   → hierarchical trees, level 1–10, self-referential parent_category_id
        └── attribute_definitions  → attribute definitions per category (name, data_type, unit...)
              └── event_attributes → attribute values per event (EAV)

events             → one "activity record", linked to category_id + user_id
  ├── event_attributes   → values (value_text, value_number, value_datetime, value_boolean)
  └── event_attachments  → images and links

lookup_values      → legacy table (see section 2.4), currently unused in React app
```

### 2.2 Critical fields in `events`

| Field | Type | Description |
|---|---|---|
| `category_id` | uuid | Which category — leaf OR parent |
| `event_date` | date | Activity date (display and filter) |
| `session_start` | timestamptz | ISO timestamp, **rounded to the minute** (seconds = 0, ms = 0) |
| `comment` | text | **User-facing** free text / Event Note. Never used for system data. |
| `chain_key` | uuid (FK → categories) | **[V4] System field.** Chain discriminator — UUID of the leaf category that owns this parent event. NULL on leaf events and legacy (pre-migration) data. |

> ⚠️ `chain_key` and `comment` must never be swapped. Before migration 004, the chain discriminator was incorrectly stored in `comment`, causing UUIDs to appear as user-visible Event Notes. Migration 004 moved all UUID values into `chain_key` and cleaned `comment`.

### 2.3 SQL Schema

Current version: **V5** (V4 + migration 005)  
Applied migrations: 001 (lookup_values), 002 (examples), 003 (RLS policies), 004 (chain_key), 005 (drop lookup_values).

> Note: `auth.uid()` returns NULL when Role=postgres in Supabase SQL Editor. Use direct UUID for ad-hoc queries: `768a6056-91fd-42bb-98ae-ee83e6bd6c8d`

### 2.4 lookup_values — DROPPED (migration 005, 2026-03-16)

`lookup_values` table has been **dropped** via migration `005_drop_lookup_values.sql`.
It was never used by the React application — dropdown options are stored in
`attribute_definitions.validation_rules` (jsonb). The `useLookupValues()` hook
in `useAttributeDefinitions.ts` and its export in `hooks/index.ts` are dead code
and may be removed in a future cleanup. The `LookupValue` interface in `types/database.ts`
is also dead code post-migration.

---

## 3. Three core principles — P1 / P2 / P3

### P1 — All levels can have attributes

Every category at every level (Activity, Gym, Strength...) can have its own `attribute_definitions`. Not just the leaf.

```
Activity  → attributes: duration, hr_avg
  └── Gym       → attributes: location
        └── Strength  → attributes: weight, reps, sets  ← leaf
```

### P2 — Leaf gets N events, every parent level gets exactly 1 event per session

```
User adds 3 Strength sets in one session → database gets:
  1 event (category=Activity, session_start=14:00)
  1 event (category=Gym,      session_start=14:00)
  3 events (category=Strength, session_start=14:00)

TOTAL: 5 events in the database for one session.
```

**Leaf** = a category that is not the `parent_category_id` of any other event in the session.  
**Parent** = all levels above the leaf. Upsert (not insert) per session.

### P3 — Last non-empty value wins

An empty value (`null`, `""`) **never** overwrites an existing non-empty value.  
Applies in: Add Activity, Edit Activity, Excel Import (all three paths).

```
Session has hr_avg=120 in the database.
User has hr_avg="" in one Excel row  → P3: hr_avg stays 120.
User has hr_avg=130 in another row   → P3: hr_avg becomes 130.
```

---

## 4. Session identity — the most important rule

**Activity (session) = `session_start` (rounded to minute) + category chain (Area → ... → Leaf)**

Two chains with the same `session_start` but **different category chains** are **two separate activities** with **two separate sets of parent events**.

```
14:00 + Activity > Gym > Strength  →  Activity event A,  Gym event X,  3× Strength
14:00 + Activity > Gym > Cardio    →  Activity event B,  Gym event Y,  2× Cardio
                                       ↑ SEPARATE event!  ↑ SEPARATE event!
```

### 4.1 Why `session_start` must be rounded to the minute

- The UI never displays seconds (HH:MM everywhere)
- Collision check uses exact string match → only reliable without seconds
- **Fix (BUG-B/C):** `setHours(h, m, 0, 0)` in time picker + `d.setSeconds(0, 0)` in `useSessionTimer.ts`

### 4.2 ⚠️ session_start format — DB vs URL

`session_start` appears in two different string formats for the same instant:

| Source | Format | Example |
|---|---|---|
| Supabase DB response | `+00:00` offset | `2026-03-10 14:00:00+00:00` |
| JS `.toISOString()` / URL encode | `.000Z` | `2026-03-10T14:00:00.000Z` |

Supabase `eq()` filter **does not reliably match cross-format** when combined with additional filters (e.g. `chain_key`). **Always use the DB-format value** from `events[0].session_start` for Supabase queries. Never use `decodeURIComponent(urlParam)` as a filter when other filters are present.

### 4.3 Session key (Excel pipeline)

```typescript
const sessionKey = `${event_date}__${sessionISO}__${leafCategoryId}`;
// Example: "2026-03-08__2026-03-08T14:00:00.000Z__<uuid>"
```

Used by: `excelImport.ts` (grouping), `checkImportCollisions()`, `ExcelImportModal`.

---

## 5. Chain disambiguation — `chain_key`

### 5.1 The `chain_key` field (V4, migration 004)

Every parent event written by any code path (Add, Edit, Import) carries:

```
events.chain_key = leafCategoryId   ← UUID of the leaf that owns this parent
```

`chain_key` is a **system field** — never display it to users. `comment` is exclusively for user text.

```
Activity event (chain_key = CardioUUID)     ← belongs to the Cardio chain
Activity event (chain_key = StrengthUUID)   ← belongs to the Strength chain
Cardio leaf event   (chain_key = NULL)      ← leaf events never have chain_key
Strength leaf event (chain_key = NULL)
```

### 5.2 Disambiguation algorithm in `parentEventLoader.ts`

```
Step 1 (Primary):  find parent WHERE chain_key = leafCategoryId
Step 2 (Fallback): find parent WHERE chain_key IS NULL
                   → safe ONLY if exactly 1 candidate (truly legacy data)
                   → if > 1 candidate: skip (better empty than wrong)
```

### 5.3 Shared service — `parentEventLoader.ts`

Parent event loading lives in **one shared service** (`src/lib/parentEventLoader.ts`). Never duplicate this logic.

```
ViewDetailsPage  → loadParentAttrs()          (read parent attrs for display)
EditActivityPage → buildParentChainIds()       (get parent category IDs for save path)
              └→ loadParentAttrs()          (read parent attrs for form)
AddActivityPage  → writes chain_key on INSERT  (no read needed)
excelImport.ts   → writes chain_key on INSERT  (no read needed)
```

**`buildParentChainIds(leafCategoryId)`** — traverses `categories.parent_category_id` from leaf to root. Returns `[gymUUID, activityUUID, ...]`.

**`loadParentAttrs(leafCategoryId, sessionStart, userId)`** — runs disambiguation per parent, returns `Map<attrDefinitionId, {value, dataType}>`.

> ⚠️ Always pass `events[0].session_start` (DB format) to `loadParentAttrs()`. See section 4.2.

### 5.4 Parent/leaf state pattern (Edit + View)

```typescript
// LOAD:
// 1. Fetch leaf events
// 2. loadParentAttrs() → parentAttrValues
// 3. buildParentChainIds() + per-parent chain_key query → parentDbIds (Edit only)

// ON EVENT SELECT:
attrMap = new Map(parentAttrValues)    // parent first (shared)
leafEvent.attributes.forEach(...)      // leaf overrides (P3)

// ON ATTRIBUTE CHANGE (Edit):
if (leafAttrDefs.has(defId)) → update pendingEvents[selectedIndex]
else                          → update parentAttrValues + ref (shared)

// ON SAVE — parent upsert (Edit):
for (catId, dbId) of parentDbIds:
    dbId exists → UPDATE attrs (P3)
    dbId null   → INSERT new parent event with chain_key = leafCategoryId
```

---

## 6. Dropdown / validation_rules system

Attribute dropdowns (Cardio_type, equipment, exercise_name...) are driven entirely by `attribute_definitions.validation_rules` (JSON). There is **no separate dropdown table** — `lookup_values` is legacy and empty.

### 6.1 validation_rules formats

**Simple dropdown** (TextOptions column M in Excel structure file):
```json
{ "type": "suggest", "suggest": ["Z2", "tempo", "interval"] }
```

**Cascading dropdown** (DependsOn col P + WhenValue col Q in Excel structure file):
```json
{
  "type": "suggest",
  "depends_on": {
    "attribute_slug": "Strength_type",
    "options_map": {
      "Upp":  ["pull.m", "biceps", "triceps", "rame"],
      "Low":  ["squat-bw", "squat-bulg", "iskoraci"],
      "Core": ["leg.raises", "plank", "side.pl"],
      "*":    []
    }
  }
}
```

**Fixed enum:**
```json
{ "type": "enum", "enum": ["option1", "option2"] }
```

### 6.2 How it flows

```
Excel structure file (TextOptions M, DependsOn P, WhenValue Q)
         ↓  written to DB during structure import
attribute_definitions.validation_rules  (JSON in Supabase)
         ↓  read by useAttributeDefinitions.ts → parseValidationRules()
AttributeInput.tsx  →  renders <select> or <datalist>
```

The dependent dropdown resolves the parent attribute value from current form state at render time and filters `options_map` accordingly. `parseValidationRules()` handles `suggest`, `enum`, `depends_on`, and a legacy `dropdown` format.

---

## 7. Prev/Next navigation — ViewDetailsPage

Prev/Next navigates through the **full activity list**, ignoring the home-page date filter. This is intentional — after Edit→Save with a date change, the activity may be outside the filtered range but navigation must still work.

```typescript
// activities loaded with dateFrom=null, dateTo=null
// currentIndex: format-agnostic via Date.getTime() — resolves +00:00 vs .000Z mismatch
const sessionMatch = new Date(g.session_start).getTime() === new Date(decoded).getTime();
```

---

## 8. Collision detection

**Collision = same `session_start` (rounded to minute) + same `leafCategoryId` + same `user_id`**

### 8.1 Where it is checked

| Context | Location | Behaviour |
|---|---|---|
| **Edit Activity — Save** | `EditActivityPage.tsx` → `handleSave()` | Supabase query, toast error, blocks save |
| **Excel Import — pre-apply** | `checkImportCollisions()` in `excelImport.ts` | Returns `CollisionInfo[]` for UI |

### 8.2 Excel Import collision resolution

| Decision | Behaviour |
|---|---|
| **Replace** | DELETE existing leaf events + attrs + attachments → INSERT new ones |
| **Add** | Keep existing → INSERT new (session has more events) |
| **Skip** | Session skipped, database untouched |

**BUG-F fix:** If decision is `replace` and an Excel row has an `event_id`, the `event_id` is set to `null` (reclassified as CREATE) because the old events were already deleted.

**T-BUGG-5 fix:** Replace delete loop uses `.eq('chain_key', leafCategoryId)` — only deletes parents of the current chain, not sibling chains sharing the same `session_start`.

---

## 9. Excel Export / Import roundtrip

### 9.1 Export — `excelExport.ts`

**`mergeSessionEvents()` (DESIGN-1):**
1. Separate leaf from parent events
2. Group leaf events by `session_start + leafCategoryId`
3. Merge parent attributes into the first leaf row (P3)
4. Remaining leaf rows: leaf attributes only
5. Parent events are **not** exported as separate rows

### 9.2 Import — `excelImport.ts`

**Pass 1** (parse + grouping): group by `sessionKey`, P3-merge parent attrs, distinguish CREATE vs UPDATE.

**Pass 2** (apply): per-session decision → replace / add / skip → INSERT/UPDATE leaf events → INSERT parent events with `chain_key = leafCategoryId`.

**Smart reclassify:** `event_id` from column A not found in DB → reclassified as CREATE.

**`normalizeTimeCell()` (BUG-E):** ExcelJS reads `Time`-formatted cells as Date with epoch 1899-12-30. Fix: `val instanceof Date → getHours():getMinutes()`.

### 9.3 CollisionInfo structure

```typescript
interface CollisionInfo {
  sessionKey:        string;
  eventDate:         string;
  sessionISO:        string;
  categoryPath:      string;
  rowNumbers:        number[];
  existingLeafCount: number;
  hasPhotos:         boolean;
}
```

---

## 10. Key files

| File | Role |
|---|---|
| `src/lib/parentEventLoader.ts` | **[V4 NEW]** Shared service: `buildParentChainIds()`, `loadParentAttrs()` |
| `src/lib/excelExport.ts` | Export → Excel, `mergeSessionEvents()` |
| `src/lib/excelImport.ts` | Parse, smart reclassify, apply import, chain_key writes |
| `src/lib/excelDataLoader.ts` | Loads `ExportCategoriesDict` + `ExportAttrDef[]` |
| `src/lib/excelTypes.ts` | Shared TypeScript types for the Excel pipeline |
| `src/lib/theme.ts` | Theme colour tokens (view=indigo, edit=amber, add=blue) |
| `src/components/activity/ExcelImportModal.tsx` | Import UI: collision resolution, reactive counters |
| `src/pages/EditActivityPage.tsx` | Edit flow: delta-shift, collision check, parent upsert |
| `src/pages/ViewDetailsPage.tsx` | Read-only view, Prev/Next, delegates to parentEventLoader |
| `src/pages/AddActivityPage.tsx` | Add flow: writes `chain_key` on parent INSERT |
| `src/pages/AppHome.tsx` | Home: Activities tab, filter, Export/Import triggers |
| `src/pages/DebugPage.tsx` | `/app/debug` — Theme Preview tab, debug tools |
| `src/context/FilterContext.tsx` | Global filter state (area, category, date range, sort) |
| `src/hooks/useAttributeDefinitions.ts` | Loads attr defs + `parseValidationRules()` for dropdowns |
| `src/hooks/useSessionTimer.ts` | Holds `sessionDateTime` (seconds = 0 — BUG-C fix) |
| `src/components/activity/ActivityHeader.tsx` | Time picker (seconds = 0 — BUG-B fix) |
| `src/components/activity/AttributeInput.tsx` | Renders dropdown/input based on validation_rules |
| `sql/SQL schema_V4.sql` | Reference schema (not for direct execution) |

---

## 11. LocalStorage — draft system

```typescript
const STORAGE_KEY = 'et_activity_draft';
// Stores: pendingEvents[], sessionDateTime, categoryId, isDirty flag
// Max image size: 5 MB total, 1200 px max dimension (resized before storing)
```

When the user opens Add/Edit with an existing draft → "Resume / Discard" dialog.

---

## 12. Theming

| Screen | Colour | Constant | Note |
|---|---|---|---|
| View Activity | Indigo | `THEME['view']` | |
| Edit Activity | Amber | `THEME['edit']` | |
| Add Activity | Blue | `THEME['add']` | ⚠️ V1.1 said Green — actual `theme.ts` has `bg-blue-600` |
| Structure Tab | Indigo/Purple | `THEME['structure']` | Independent entry — change separately from ViewDetailsPage |

Preview all themes at `/app/debug` → Theme Preview tab (HMR, no restart needed).

---

## 13. Collision criteria — complete matrix

| Scenario | Collision? | Reason |
|---|---|---|
| Same `session_start` + same chain (`leafCategoryId`) | ✅ YES | Duplicate session |
| Same `session_start` + different chain | ❌ NO | Two separate chains |
| Different `session_start` + same chain | ❌ NO | Different sessions |
| Import Replace → row has `event_id` | ❌ NO (reclassified) | BUG-F fix |
| Edit → time changed to occupied HH:MM | ✅ YES | BUG-B/C fix active |

---

## 14. Known edge cases and fixes

| ID | Description | Fix | File |
|---|---|---|---|
| BUG-A | After Edit Save, navigation used old `sessionStart` | `navigate(encodeURIComponent(newSessionStart))` | `EditActivityPage.tsx` |
| BUG-B | Time picker left seconds/ms → collision miss | `setHours(h, m, 0, 0)` | `ActivityHeader.tsx` |
| BUG-C | Add Activity created `session_start` with full timestamp | `d.setSeconds(0, 0)` | `useSessionTimer.ts` |
| BUG-D | Blank screen after navigating to non-existent session | `!isLoading && viewEvents.length === 0` → error UI | `ViewDetailsPage.tsx` |
| BUG-E | Excel Time cells read as Date with epoch 1899-12-30 | `normalizeTimeCell()` | `excelImport.ts` |
| BUG-F | Replace + UPDATE path → partial DB state | `event_id = null` for replace-session rows | `excelImport.ts` |
| BUG-G | Two chains sharing `session_start` shared parent event | `chain_key = leafCategoryId` on all parent INSERTs | all write paths |
| T-BUGG-5 | Replace loop deleted sibling chain's parent | `.eq('chain_key', leafCategoryId)` on delete | `excelImport.ts` |
| VIEW-Z1 | Prev/Next disabled after Edit→Save with date change | Date-filter-free list + `getTime()` comparison | `ViewDetailsPage.tsx` |
| FORMAT-1 | Parent attrs empty in View (`+00:00` vs `.000Z`) | Pass `events[0].session_start` to `loadParentAttrs()` | `parentEventLoader.ts` |
| CHAIN-KEY | `comment` field stored UUIDs → visible in Event Note UI | Migration 004: new `chain_key` column, `comment` cleaned | `004_add_chain_key.sql` |
| DESIGN-1 | Parent events exported as separate rows | `mergeSessionEvents()` Option A | `excelExport.ts` |

---

## 15. Not yet implemented / In progress

| Feature | Status | Note |
|---|---|---|
| Structure Tab — Read-Only | **In progress (S15)** | Table View + Sunburst — see STRUCTURE_TAB_SPEC_FOR_DEV.md |
| Structure Tab — Edit Mode | Planned S18 | Rename/Add/Delete Area, Category, Attribute |
| Structure Tab — Excel Export | Planned S17 | structureExcel.ts |
| Structure Tab — Excel Import | Planned S20 | Non-destructive add-only |
| BUG-F Step 2 (transaction / rollback) | Deferred | Supabase RPC |
| `date_trunc('minute')` for collision check in SQL | Deferred | Long-term fix for legacy data |

### 15.1 ⚠️ Structure View — "Add category between" risk

Inserting a new category level between two existing ones (e.g. `Gym > Strength` → `Gym > Upper Body > Strength`) is dangerous because:

- `leafCategoryId` stays the same → `chain_key` on existing events remains valid
- But `buildParentChainIds()` traverses **current** `parent_category_id` — old events now get the wrong (longer) chain
- Excel Export produces inconsistent `category_path` across old and new events

**Principle:** "Add category between" must be a **data migration** (UPDATE `category_id` on all affected events), not just a structural change in the `categories` table. `chain_key` values must also be verified/updated.

---

*Document version 1.3 — 2026-03-16 | Sessions 1–15*  
*Key changes in V1.3: migration 005 (DROP lookup_values), Structure Tab in-progress (S15), theme.ts structure entry added, section 15 updated.*  
*Key changes in V1.2: chain_key field (migration 004), parentEventLoader.ts shared service, dropdown/validation_rules system (section 6), session_start format warning (4.2), Prev/Next fix (section 7), lookup_values legacy status, theme colour correction, complete fix history in section 14.*
