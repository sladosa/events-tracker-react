# Events Tracker React — ARCHITECTURE.md

**Version:** 1.1 — 2026-03-10  
**Scope:** Single source of truth for core principles, data model, and critical patterns.  
**Audience:** Claude (session continuity), Sasa (developer reference), future refactoring.

> ⚠️ **Regression compass:** Any change touching `session_start`, `category_id`, `event_id`, the parent/leaf distinction, or the Excel roundtrip **must** be verified against this document.

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
```

### 2.2 Critical fields in `events`

| Field | Type | Description |
|---|---|---|
| `category_id` | uuid | Which category — leaf OR parent |
| `event_date` | date | Activity date (display and filter) |
| `session_start` | timestamptz | ISO timestamp, **rounded to the minute** (seconds = 0, ms = 0) |
| `comment` | text | Free text / note |

---

## 3. Three core principles — P1 / P2 / P3

These are the fundamental invariants that must never be violated anywhere in the code.

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
  3 events (category=Strength, session_start=14:00)  ← NEW event for each set

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

Two chains with the same `session_start` but **different category chains** are **two separate activities** with **two separate sets of parent events** — even if they share the same parent category in the tree.

```
14:00 + Activity > Gym > Strength  →  Activity event A,  Gym event X,  3× Strength
14:00 + Activity > Gym > Cardio    →  Activity event B,  Gym event Y,  2× Cardio
                                       ↑ SEPARATE event!  ↑ SEPARATE event!
```

> **Implementation note:** In the current model, `leafCategoryId` is used as a proxy for the chain because each leaf category uniquely determines the full path to the root. This assumption holds as long as category trees are not restructured. See section 13.1 for the "Add category between" risk.

### 4.1 Why `session_start` must be rounded to the minute

- The UI never displays seconds anywhere (HH:MM everywhere)
- Two activities of the same chain within the same minute is not a realistic scenario
- Collision check uses exact match → only reliable without seconds
- **Fix (BUG-B/C, Session 5):** `setHours(h, m, 0, 0)` in time picker + `d.setSeconds(0, 0)` in `useSessionTimer.ts`

### 4.2 Session key (Excel pipeline)

```typescript
const sessionKey = `${event_date}__${sessionISO}__${leafCategoryId}`;
// Example: "2026-03-08__2026-03-08T14:00:00.000Z__<uuid>"
// leafCategoryId used as chain proxy — see section 4 note above
```

The same session key is used by: `excelImport.ts` (grouping), `checkImportCollisions()`, `ExcelImportModal` (overwriteMap).

---

## 5. Chain disambiguation

When multiple parent events of the same category exist for the same `session_start` (e.g. two Activity events because there is both Strength and Cardio at 14:00), the correct one is identified by the **immediate child** category in the chain:

```
For the Gym event belonging to the Strength chain:
  childCategoryId = leafCategoryId (Strength)

  candidates = SELECT FROM events WHERE category_id=Gym AND session_start=14:00
  if candidates.length > 1:
      for each candidate c:
          childExists = SELECT FROM events
                        WHERE category_id=Strength AND session_start=14:00
                        AND (c is parent via attribute chain)
          → c with the child is the correct Gym for the Strength chain
```

**Implementation:** `findParentEventByChain(categoryId, sessionISO, childCategoryId)` in `excelImport.ts` and `loadActivityData()` in `ViewDetailsPage.tsx` / `EditActivityPage.tsx`.

### 5.1 Parent/leaf state pattern (Edit + View)

```typescript
// 1. Fetch leaf events → selectedEventIndex
// 2. Traverse parent chain → parentChainIds[] (leaf→root)
// 3. For each parent: chain disambiguation → parentDbId
// 4. Fetch attrs → parentAttrValues Map<defId, value>

// On event select:
attrMap = new Map(parentAttrValues)     // parent first (shared across all tabs)
leafEvent.attributes.forEach(...)       // leaf overrides

// On attribute change:
if (leafAttrDefs.has(defId)) → update pendingEvents[selectedIndex]
else                          → update parentAttrValues + ref (shared)

// On Save — parent upsert:
for (catId, dbId) of parentDbIds:
    dbId exists → UPDATE attrs (P3: empty does not overwrite)
    dbId null   → INSERT new parent event
```

---

## 6. Collision detection

**Collision = same `session_start` (rounded to minute) + same category chain + same `user_id`**

> *Implementation:* `leafCategoryId` is used as a proxy for the chain because in the current model the leaf category uniquely determines the full path to the root. If the model changes (e.g. category restructuring), this assumption must be revisited.

### 6.1 Where it is checked

| Context | Location | Behaviour |
|---|---|---|
| **Edit Activity — Save** | `EditActivityPage.tsx` → `handleSave()` | Supabase query, toast error, blocks save |
| **Excel Import — pre-apply** | `checkImportCollisions()` in `excelImport.ts` | Returns `CollisionInfo[]` for UI decisions |

### 6.2 Edit collision query

```typescript
const newSessionStart = sessionDateTime.toISOString(); // seconds = 0 (BUG-B/C fix)

SELECT id FROM events
WHERE user_id = $userId
  AND category_id = $leafCategoryId   -- proxy for the chain
  AND session_start = $newSessionStart
  AND id NOT IN (own leaf event IDs)
LIMIT 1
```

If result is not empty → toast error, `setSaving(false)`, return.

### 6.3 Excel Import collision resolution

The UI shows one collision card per session. The user chooses:

| Decision | Behaviour |
|---|---|
| **Replace** | DELETE existing leaf events + attrs + attachments → INSERT new ones |
| **Add** | Keep existing → INSERT new (session will have more events) |
| **Skip** | Session is skipped, database untouched |

**BUG-F fix (Session 8):** If the decision is `replace` and an Excel row has an `event_id` in column A, the `event_id` is set to `null` (reclassified as CREATE) because the old events were already deleted — an UPDATE on a deleted ID would fail without a rollback, leaving the database in a partial state.

---

## 7. Excel Export / Import roundtrip

### 7.1 Export — `excelExport.ts`

**`mergeSessionEvents()` Option A (DESIGN-1, Session 7):**

1. Separate leaf events from parent events (leaf = not the `parent_category_id` of any other event)
2. Group leaf events by `session_start + leafCategoryId` (= chain proxy) → one chain group
3. For each chain: walk up hierarchy, merge parent attributes into the **first leaf row** (P3)
4. Remaining leaf rows of the chain: leaf attributes only
5. **Parent events are NOT exported as separate rows**

Result: the Excel file contains only leaf rows. Each chain has exactly as many rows as it has leaf events.

### 7.2 Import — `excelImport.ts`

**Pass 1** (parse + grouping):
- Read rows → group by `sessionKey`
- P3-merge parent attributes (an attribute not in leaf attrDefs → goes into `parentMerged`)
- Distinguish CREATE (no `event_id`) from UPDATE (has `event_id`)

**Pass 2** (apply):
- For each session: check `overwriteDecisions` (replace / add / skip / undefined)
- `replace` → DELETE old leaf events → then INSERT (BUG-F fix: nullify `event_id` for those rows)
- INSERT / UPDATE leaf events
- Upsert parent events using chain disambiguation

**Smart reclassify:**  
If an `event_id` from column A no longer exists in the database → reclassified as CREATE (not UPDATE).

**`normalizeTimeCell()` (BUG-E, Session 7):**  
ExcelJS reads `Time`-formatted cells as a `Date` with epoch 1899-12-30. Fix: `val instanceof Date → getHours():getMinutes()`.

### 7.3 CollisionInfo structure

```typescript
interface CollisionInfo {
  sessionKey:        string;   // event_date__sessionISO__leafCategoryId (chain proxy)
  eventDate:         string;
  sessionISO:        string;
  categoryPath:      string;   // human-readable, e.g. "Fitness > Gym > Strength"
  rowNumbers:        number[]; // Excel rows that make up this session
  existingLeafCount: number;   // how many leaf events exist in the database
  hasPhotos:         boolean;  // whether the session has photos attached
}
```

---

## 8. Key files

| File | Role |
|---|---|
| `src/lib/excelExport.ts` | Export → Excel, `mergeSessionEvents()` |
| `src/lib/excelImport.ts` | Parse, smart reclassify, apply import, `findParentEventByChain()` |
| `src/lib/excelDataLoader.ts` | Loads `ExportCategoriesDict` + `ExportAttrDef[]` for export/import |
| `src/lib/excelTypes.ts` | Shared TypeScript types for the Excel pipeline |
| `src/components/activity/ExcelImportModal.tsx` | Import UI: collision resolution, reactive counters, decisions |
| `src/pages/EditActivityPage.tsx` | Edit flow: delta-shift, collision check, parent upsert |
| `src/pages/ViewDetailsPage.tsx` | Read-only view + chain disambiguation + empty-state guard |
| `src/pages/AppHome.tsx` | Home: Activities tab, filter, Export/Import triggers |
| `src/context/FilterContext.tsx` | Global filter state (area, category, date range, sort) |
| `src/hooks/useSessionTimer.ts` | Holds `sessionDateTime` (seconds = 0 — BUG-C fix) |
| `src/components/activity/ActivityHeader.tsx` | Time picker (seconds = 0 — BUG-B fix) |

---

## 9. LocalStorage — draft system

Edit and Add Activity auto-save a draft to `localStorage` every 15 seconds:

```typescript
const STORAGE_KEY = 'et_activity_draft';
// Stores: pendingEvents[], sessionDateTime, categoryId, isDirty flag
// Maximum image size: 5 MB total, 1200 px max dimension (resized before storing)
```

When the user opens Add/Edit with an existing draft → "Resume / Discard" dialog.

---

## 10. Theming

| Screen | Colour | Constant |
|---|---|---|
| View Activity | Indigo | `THEME['view']` |
| Edit Activity | Amber | `THEME['edit']` |
| Add Activity | Green | `THEME['add']` |

Defined in `src/lib/theme.ts`.

---

## 11. Collision criteria — complete matrix

| Scenario | Collision? | Reason |
|---|---|---|
| Same `session_start` + same chain (same `leafCategoryId`) | ✅ YES | Duplicate session |
| Same `session_start` + different chain (different `leafCategoryId`) | ❌ NO | Two separate chains |
| Different `session_start` + same chain | ❌ NO | Different sessions |
| Import Replace → row has `event_id` in column A | ❌ NO (reclassified) | BUG-F fix: old events already deleted |
| Edit → time changed to an already-occupied HH:MM | ✅ YES | BUG-B/C fix active |

---

## 12. Known edge cases and fixes

| ID | Description | Fix | File |
|---|---|---|---|
| BUG-A | After Edit Save, navigation used the old `sessionStart` | `navigate(encodeURIComponent(newSessionStart))` | `EditActivityPage.tsx` |
| BUG-B | Time picker left seconds/ms in place → collision miss | `setHours(h, m, 0, 0)` | `ActivityHeader.tsx` |
| BUG-C | Add Activity created `session_start` with full timestamp | `d.setSeconds(0, 0)` in `useSessionTimer.ts` | `useSessionTimer.ts` |
| BUG-D | Blank screen after navigating to a non-existent session | `!isLoading && viewEvents.length === 0` → error UI | `ViewDetailsPage.tsx` |
| BUG-E | Excel Time cells read as Date with epoch 1899-12-30 | `normalizeTimeCell()` | `excelImport.ts` |
| BUG-F | Replace + UPDATE path → partial database state | `event_id = null` for replace-session rows | `excelImport.ts` |
| DESIGN-1 | Parent events exported as separate rows | `mergeSessionEvents()` Option A | `excelExport.ts` |

---

## 13. Not yet implemented

| Feature                                                           | Status                       | Note                                      |
| ----------------------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| Structure View                                                    | Placeholder in `AppHome.tsx` | Session 9+                                |
| BUG-F Step 2 (transaction)                                        | Deferred                     | Supabase RPC, waiting for stable pipeline |
| BUG-G (two chains with same `session_start` share a parent event) | Documented                   | `excelImport.ts` CREATE path              |
| `date_trunc('minute')` for collision check in SQL                 | Deferred                     | Long-term fix for legacy seconds in DB    |

### 13.1 ⚠️ Structure View — "Add category between" risk

The Streamlit MVP supports inserting a new category level between two existing ones (e.g. `Gym > Strength` → `Gym > Upper Body > Strength`) without losing events.

This is the **most dangerous operation** for data consistency because:

- `leafCategoryId` remains **the same** (the Strength UUID does not change)
- But `parent_category_id` in the `categories` table changes
- All existing events remain linked to the same `category_id` values — but the path traversal changes

**What breaks:**

| Component | Problem |
|---|---|
| `findParentEventByChain()` | Traverses `parent_category_id` live from DB — old events have the "short" path, new events the "long" path |
| Chain disambiguation | The `childCategoryId` that was a direct child now has a new intermediary |
| `buildCategoryPath()` in ViewDetails | Displays the new (longer) path for old events — visually inconsistent |
| Excel Export | Old events export with short `category_path`, new events with long — Import groups them separately |

**Principle that must be satisfied during implementation:**  
The "Add category between" operation must be a **migration** (UPDATE `category_id` on all existing events linked to that path), not just a structural change in the `categories` table.

---

*Document generated: 2026-03-10 | Based on Sessions 1–8 + all handover documents*
