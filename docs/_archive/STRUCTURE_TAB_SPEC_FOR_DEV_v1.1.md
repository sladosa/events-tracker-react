# STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md
# Events Tracker React — Structure Tab: Developer Specification

**Version:** 1.1
**Created:** 2026-03-15 (S14)
**Updated:** 2026-03-27 (S27 — Delete with Backup implemented; S28 plan added)
**Purpose:** All context needed to work on the Structure tab. Update after each Structure session.

---

## 1. Data Model (Structure-relevant subset)

### 1.1 Key tables

**`areas`** — top-level grouping (e.g. "Fitness", "Financije")
- `id uuid`, `name text`, `slug text`, `sort_order int`

**`categories`** — hierarchical via `parent_category_id` + `path` (ltree)
- `id uuid`, `area_id uuid`, `parent_category_id uuid`
- `name text`, `slug text`, `level int` (1–10)
- `path` (ltree materialized path)
- **P1**: ALL category levels can have attribute definitions, not just leaf

**`attribute_definitions`** — EAV attribute schema per category
- `id uuid`, `category_id uuid`, `name text`, `slug text`
- `data_type text` — `'number' | 'text' | 'datetime' | 'boolean' | 'link' | 'image'`
- `validation_rules jsonb` — drives dropdowns:
  - Free text: `null` or `{ "type": "none" }`
  - Simple suggest: `{ "type": "suggest", "suggest": ["val1","val2",...] }`
  - Dependent suggest: `{ "type": "suggest", "depends_on": { "attribute_slug": "X", "options_map": { "val1": ["a","b"], "val2": ["c","d"] } } }`
- `unit text`, `is_required bool`, `default_value text`, `sort_order int`

**`events`** — NOT directly used in Structure tab (only event COUNT per category is shown)
- `chain_key uuid` — leaf category discriminator (P2)
- `session_start timestamptz` — rounded to minute

**`lookup_values`** — DEAD CODE. Dropped via migration 005. Do not reference.

### 1.2 Leaf vs. parent category distinction
- **Leaf**: has no children in `categories` table
- **Non-leaf**: has at least one child category
- A category can be non-leaf AND have its own attribute definitions (P1)
- Adding a child to a Leaf turns it into a Non-leaf — normal and supported

### 1.3 Event count per category
- **Leaf node**: own direct event count
- **Non-leaf node**: sum of all leaf event counts in subtree (bottom-up DFS in `useStructureData.ts`)
- **Area node**: sum of all leaf event counts under that area
- Computed in `useStructureData.ts` step 7 (post-pass, not DB query)
- Displayed in: Sunburst tooltip, CategoryDetailPanel sticky header badge
- **Critical for Delete safety**: `node.eventCount > 0` = has activity data = delete requires full backup

---

## 2. React Architecture

### 2.1 Component map
```
AppHome (Structure tab)
└── StructureTableView          Main table + Edit Mode toolbar
    ├── CategoryChainRow        One row per node (Area/Category)
    ├── CategoryDetailPanel     View panel (modal)
    ├── StructureNodeEditPanel  Edit panel — rename, attributes, suggest options
    ├── StructureDeleteModal    Delete — backup+cascade (has events) or cascade (empty)
    ├── StructureAddChildPanel  Add Child — all node types, blocked if leaf has events (S24)
    ├── StructureAddAreaPanel   Add new top-level Area (S24)
    └── StructureSunburstView   Plotly Sunburst chart
```

### 2.2 Key files
| File | Path | Notes |
|------|------|-------|
| `AppHome.tsx` | `src/pages/` | Tab container, filter area, Edit Mode toggle |
| `FilterContext.tsx` | `src/context/` | Shared filter state (area, category, date range, sort, periodLabel) |
| `ProgressiveCategorySelector.tsx` | `src/components/filter/` | Area → Category chain dropdowns |
| `useStructureData.ts` | `src/hooks/` | Fetches all structure data + subtree event count |
| `StructureTableView.tsx` | `src/components/structure/` | Panel state, modals, refetch |
| `CategoryChainRow.tsx` | `src/components/structure/` | One row, unified `onAddChild` |
| `CategoryDetailPanel.tsx` | `src/components/structure/` | View panel: sticky header, Prev/Next, Edit, Delete |
| `StructureNodeEditPanel.tsx` | `src/components/structure/` | Edit panel: rename, attr edit, suggest options |
| `StructureDeleteModal.tsx` | `src/components/structure/` | Delete: backup+cascade or empty cascade |
| `StructureAddChildPanel.tsx` | `src/components/structure/` | Add Child (amber modal) |
| `StructureAddAreaPanel.tsx` | `src/components/structure/` | Add Area (amber modal) |
| `StructureImportModal.tsx` | `src/components/structure/` | Import UI |
| `StructureSunburstView.tsx` | `src/components/structure/` | Plotly Sunburst with filter sync |
| `structureExcel.ts` | `src/lib/` | Structure Excel export (17 cols), `addStructureSheetsTo()` |
| `structureImport.ts` | `src/lib/` | Structure Import, non-destructive, conflict report |
| `excelBackup.ts` | `src/lib/` | Full backup export — `exportFullBackup(userId)` |
| `theme.ts` | `src/lib/` | `THEME.structure` (indigo) + `THEME.structureEdit` (amber) |

### 2.3 Filter behaviour in Structure tab
- **Uses**: Area dropdown, Category chain dropdowns, Shortcuts
- **Does NOT use**: Date range filter (hidden when Structure tab active)
- Filter state drives both Table View rows and Sunburst focus
- `areas-changed` CustomEvent: dispatched after any Area add/delete → `ProgressiveCategorySelector` refetches

### 2.4 Theme / styling conventions
- Structure tab: **`THEME.structure`** — indigo/purple
- Structure Edit panels + Add panels: **`THEME.structureEdit`** — amber
- `structureEdit` keys: `headerBg`, `headerText`, `headerBorder`, `accent`, `cancelBtn`, `deleteBtn`, `light`, `lightBorder`, `lightText`, `spinner`, `ring`
- No `saveBtn`, `inputFocus`, `icon`, `closeBtn` keys — use direct classes or `accent`

### 2.5 Panel state pattern (StructureTableView)
```typescript
panelMode: 'view' | 'edit' | null
activePanelIndex: number | null   // index into filtered[] array
highlightedNodeId: string | null  // 3s auto-clear, scroll-to-row

// View panel opens  → panelMode='view', activePanelIndex=idx
// Edit button       → panelMode='edit' (same activePanelIndex)
// ← View button     → panelMode='view' (same activePanelIndex)
// Close / Save      → panelMode=null, highlightedNodeId=nodeId
// Delete trigger    → deleteNode state set → StructureDeleteModal opens
// Add Child trigger → addChildParent state set → StructureAddChildPanel opens
```

---

## 3. Edit Mode — Operation Safety Matrix

| Operation | No events exist | Events exist |
|-----------|----------------|--------------|
| Rename Area / Category / Attribute | ✅ Safe | ✅ Safe (name only, slug unchanged) |
| Change attr `data_type` | ✅ (no UI intentionally) | ❌ FORBIDDEN (corrupts values) |
| Edit attr unit / description / sort | ✅ Safe | ✅ Safe |
| Edit suggest options | ✅ Safe | ✅ Safe |
| Add new attribute | ✅ Safe | ✅ Safe — **planned S28** |
| Delete attribute | ✅ Safe | ⚠️ Warning: event_attributes lost — **planned S28** |
| Add child category | ✅ Safe | ✅ Safe |
| Add category "between" | ⚠️ Deferred | ⚠️ Requires data migration |
| Delete empty subtree | ✅ Cascade — implemented S22 | — |
| Delete subtree with events | — | ✅ **Backup + cascade — implemented S27** |

### 3.1 data_type change — always read-only in UI
Edit panel shows `data_type` as read-only regardless of event count.
Reason: changing type would corrupt existing `value_text/value_number/...` data.

### 3.2 Slug generation
```typescript
// Used in: Add Child, Add Area, Add Attribute (planned S28)
slug = name.toLowerCase().trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '') || 'category'

// sort_order = max existing sibling sort_order + 10 (room for future "Add Between")
// Slug never changes on rename — same rule as categories
```

---

## 4. Delete Architecture (S22 + S27)

### 4.1 Empty subtree — direct cascade (S22)
```
1. DELETE attribute_definitions WHERE category_id IN (subtreeIds)
2. DELETE categories grouped by level DESC (leaf-first, FK safety)
3. If Area: DELETE areas WHERE id = areaId
```

### 4.2 Subtree with events — backup + cascade (S27)
```
1. exportFullBackup(userId) → download full_backup_YYYYMMDD_HHmmss.xlsx
2. DELETE event_attachments WHERE event_id IN (eventIds under subtree)
   → also removes files from Supabase Storage
3. DELETE event_attributes WHERE event_id IN (eventIds)
4. DELETE events WHERE category_id IN (categoryIds)
5. DELETE attribute_definitions WHERE category_id IN (subtreeIds)
6. DELETE categories grouped by level DESC
7. If Area: DELETE areas WHERE id = areaId
```

### 4.3 Why full backup (not branch-only)?

Full backup = entire database, not just the deleted subtree. Reasons:

1. **Self-contained restore**: branch-only backup is useless without the rest of the
   category structure already in DB. If you deleted "Domacinstvo", you can't import
   its events back without "Domacinstvo" existing — which you just deleted.

2. **Session context**: P2 means parent events are shared across chain_key sessions.
   Deleted branch events may overlap in time with other branches.

3. **Single restore procedure**: full backup can always be imported as-is
   (Structure Import first → Activities Import second, same file). Branch-only
   would require a custom restore procedure.

4. **Simpler code**: `exportFullBackup()` has no filter logic — fetches everything.

### 4.4 Restore procedure (manual, 2 steps, same backup file)
1. **Structure tab → Import** → reads Structure sheet → recreates areas/categories/attributes (non-destructive)
2. **Activities tab → Import** → reads Events sheet → imports events

Both steps use the same `full_backup_*.xlsx` file.

---

## 5. Excel Format (Structure-related)

### 5.1 Unified workbook format (S26)
All exports (Activities, Structure, Full Backup) produce the same 5-sheet workbook:

| # | Sheet | Activities | Structure | Full Backup |
|---|-------|-----------|-----------|-------------|
| 1 | Events | full data | stub message | full data |
| 2 | HelpEvents | ✓ | ✓ | ✓ |
| 3 | Structure | filtered | full | full |
| 4 | HelpStructure | ✓ | ✓ | ✓ |
| 5 | Filter | active filter | active filter | All time |

### 5.2 Structure sheet format — 17 columns A–Q
Single sheet named `Structure`. Full spec → `EXCEL_FORMAT_ANALYSIS_v2.md`.

Key decisions:
- 17 cols (not 19) — dropped `Level` and `Category` as redundant
- Column-based editability coloring (Pink/Yellow/Blue/Green)
- Data validations: Type, AttrType, IsRequired, Val.Type
- Help sheet last
- Multi-row DependsOn (Streamlit style)
- Row 6: info row (export / backup / conflict type + timestamp)
- Row 7: column headers

File naming:
- `structure_export_YYYYMMDD_HHmmss.xlsx`
- `full_backup_YYYYMMDD_HHmmss.xlsx`

### 5.3 Import rules
- **Non-destructive only** — import only ADDS new areas/categories/attributes
- No modification or deletion of existing structure via import
- Slug lookup for conflict detection (same name, different path → conflict)
- Conflict report: yellow highlight on Slug cell (col G forced visible)

---

## 6. S28 Planned Work

### 6.1 Add / Delete Attribute in Structure Edit (P2)
Full spec → `docs/ADD_ATTRIBUTE_SPEC.md`

- **Add Attribute**: "Add Attribute" gumb u `StructureNodeEditPanel`, inline forma
  (name, type, unit, required) → INSERT `attribute_definitions`
- **Delete Attribute**: warning ako ima `event_attributes`, then cascade delete
- **Text → Suggest konverzija**: "→ Suggest" gumb na text atributima
- **DependsOn editing UI**: složenije, možda odvojena sesija

### 6.2 Import "skipped" vs "updated" (P1, Activities Import)
Full spec → `docs/IMPORT_DIFF_SPEC.md`

Svaki event s ID-em u koloni A ide UPDATE path i broji se "updated" čak i kad se ništa nije promijenilo. Fix: diff provjera prije update-a → "skipped" ako identično.

---

## 7. UX Decisions (all resolved)

| ID | Decision |
|----|----------|
| UX-1 | No date filter in Structure tab |
| UX-2 | "+ Add Activity" removed from Structure tab header |
| UX-3 | "Export" + "Import" + "Edit Mode" buttons in header |
| UX-4 | Sunburst on desktop (≥ md), Table only on mobile |
| UX-5 | Visualization library: react-plotly.js |
| UX-6 | Clicking Sunburst segment updates Area/Category dropdowns (bidirectional sync) |
| UX-7 | Shortcuts reset when filter changes via Sunburst or dropdown |
| UX-8 | No "Show Events" toggle; event count in Sunburst tooltip + View panel header |
| UX-9 | Edit Mode: inline toggle within Structure tab |
| UX-10 | In Edit mode on desktop: Sunburst switches to Table view automatically |
| UX-11 | No checkboxes / bulk delete. All operations via per-row Actions menu only. |
| UX-12 | Table View: hierarchical node list — one row per node, full path, color-coded by level |
| UX-13 | Attribute count shown as badge per row |
| UX-14 | "Add Between": deferred (requires data migration) |
| UX-15 | View panel: sticky header with event count badge, Prev/Next, Edit, Delete |
| UX-16 | Edit panel: amber sticky header, Save to Supabase |
| UX-17 | "+ Add Child" unified action on ALL node types (Area, non-leaf, leaf) |
| UX-18 | Delete with events: full backup auto-downloaded before cascade — **implemented S27** |
| UX-19 | Delete modal title always "Delete Area/Category" (never "Cannot Delete") — **S27** |

---

## 8. Session History

| Session | Date | What was done |
|---------|------|---------------|
| S14 | 2026-03-15 | Planning. UX decisions, all P-questions resolved. No code. |
| S15 | 2026-03-16 | Pre-coding: P1.1 + OQ resolved. |
| S16 | 2026-03-16 | Core components: useStructureData, StructureTableView, StructureSunburstView, CategoryDetailPanel, AppHome wired. |
| S17 | 2026-03-17 | TS fixes; structureExcel.ts; Export button; Sunburst filter sync. |
| S18 | 2026-03-18 | Bugfixes BUG-S1–S4; EXCEL_FORMAT_ANALYSIS_v1.md. |
| S19 | 2026-03-19 | View panel sticky header + Prev/Next + Edit. StructureNodeEditPanel (amber): rename, suggest options, Save. Edit Mode toggle. |
| S20A | 2026-03-20 | Bugfixes: Save Area/Category (RLS), actions menu overflow (createPortal). |
| S20B | 2026-03-21 | Excel Export v2: structureExcel.ts rewrite. 17 cols, freeze, validations, multi-row DependsOn. |
| S21 | 2026-03-21 | Structure Import: structureImport.ts + StructureImportModal.tsx. Non-destructive, slug lookup, conflict Excel. |
| S22 | 2026-03-22 | Delete + Add Child: StructureDeleteModal (blocked if events, cascade if empty), StructureAddChildPanel (all node types). |
| S24 | 2026-03-24 | Add Area UI (StructureAddAreaPanel). Add Child blocked on leaf-with-events. areas-changed CustomEvent. |
| S25 | 2026-03-25 | Structure Import fix: modal stays open after import. areas-changed dispatch. Leaf badge "no events yet". |
| S26 | 2026-03-27 | Unified workbook format (Koraci 1–5): excelUtils.ts, excelExport.ts refaktor, structureExcel.ts extract builder, ExcelExportModal 5 sheetova. |
| S27 | 2026-03-27 | Delete with Backup: excelBackup.ts (exportFullBackup), StructureDeleteModal unlock (amber, backup+cascade). FilterContext periodLabel fix. |
