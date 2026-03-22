# STRUCTURE_TAB_CONTEXT_FOR_CLAUDE.md
# Events Tracker React — Structure Tab: Context for Claude

**Version:** 1.5
**Created:** 2026-03-15 (Session 14 planning)
**Updated:** 2026-03-22 (Session 22 — Delete + Add Child implemented; S23 backup architecture decided)
**Purpose:** All context Claude needs to work on the Structure tab in future sessions,
without reloading U1–U9 each time. Update this document after each Structure session.

---

## 1. Data Model (Structure-relevant subset)

### 1.1 Key tables

**`areas`** — top-level grouping (e.g. "Fitness", "Personal")
- `id uuid`, `name text`, `slug text`, `sort_order int`

**`categories`** — hierarchical via `parent_category_id` + `path` (ltree)
- `id uuid`, `area_id uuid`, `parent_category_id uuid`
- `name text`, `slug text`, `level int` (1–10)
- `path` (ltree materialized path)
- Hierarchy example: Area → L1 (Activity) → L2 (Gym) → Leaf (Cardio)
- **P1**: ALL category levels can have attribute definitions, not just leaf

**`attribute_definitions`** — EAV attribute schema per category
- `id uuid`, `category_id uuid`, `name text`, `slug text`
- `data_type text` — `'number' | 'text' | 'datetime' | 'boolean' | 'link' | 'image'`
- `validation_rules jsonb` — drives dropdowns:
  - Simple suggest: `{ "type": "suggest", "suggest": ["val1","val2",...] }`
  - Dependent suggest: `{ "type": "suggest", "depends_on": { "attribute_slug": "X", "options_map": { "val1": ["a","b"], "val2": ["c","d"] } } }`
  - `none` = free text, no dropdown
- `unit text`, `is_required bool`, `default_value text`, `sort_order int`

**`events`** — NOT directly used in Structure tab (only event COUNT per category is shown)
- `chain_key uuid` — FK to categories.id — leaf category discriminator (BUG-G fix)
- `session_start timestamptz` — rounded to minute

**`lookup_values`** — DEAD CODE. Was legacy dropdown store; never used in React app.
  Dropped via migration 005 (`005_drop_lookup_values.sql`).
  Do not reference this table anywhere in new code.

### 1.2 Leaf vs. parent category distinction
- **Leaf category**: has no children in `categories` table
- **Non-leaf category**: has at least one child category
- A category can be both non-leaf AND have its own attribute definitions (P1)
- Structure Table View shows ALL nodes (Area + every category level) as individual rows
- Adding a child to a Leaf turns it into a Non-leaf — this is normal and supported

### 1.3 Event count per category
- Displayed as: **subtree leaf event count** (= number of sessions, not DB row count)
- **Leaf node**: own direct event count
- **Non-leaf node**: sum of all leaf event counts in subtree (bottom-up DFS in `useStructureData.ts` step 7)
- **Area node**: sum of all leaf event counts for all categories under that area
- Shown in: Sunburst tooltip, CategoryDetailPanel sticky header badge
- NOT shown as a table column
- **Critical for Delete safety**: `node.eventCount > 0` = has activity data = delete requires full backup (S23)

---

## 2. Existing React Architecture (Structure-relevant)

### 2.1 Current state of Structure tab
- `AppHome.tsx` — main page, contains Activities + Structure tabs
- Structure tab: Table View + Sunburst + Export + Import + Edit Mode toggle (all functional as of S21)
- Filter section (Shortcuts + Area/Category dropdowns) is **shared** between Activities and Structure tabs via `FilterContext`
- Date range filter hidden when Structure tab active

### 2.2 Relevant existing files
| File | Path | Relevance |
|---|---|---|
| `AppHome.tsx` | `src/pages/` | Tab container, filter area, tab switching, Edit Mode toggle |
| `FilterContext.tsx` | `src/context/` | Shared filter state (area, category, date range, sort) |
| `ProgressiveCategorySelector.tsx` | `src/components/filter/` | Area → Category chain dropdowns |
| `useStructureData.ts` | `src/hooks/` | Fetches all structure data + subtree event count (step 7) |
| `StructureTableView.tsx` | `src/components/structure/` | Table: panelMode, activePanelIndex, highlight, refetch, delete + add child modals |
| `CategoryChainRow.tsx` | `src/components/structure/` | One row; unified `onAddChild` on all node types (S22) |
| `CategoryDetailPanel.tsx` | `src/components/structure/` | View panel: sticky header, Prev/Next, event count, Edit, Delete (active when isEditMode) |
| `StructureNodeEditPanel.tsx` | `src/components/structure/` | **[S19]** Edit panel: amber, Save to Supabase |
| `StructureDeleteModal.tsx` | `src/components/structure/` | **[S22]** Delete: blocked if eventCount > 0; cascade delete if empty |
| `StructureAddChildPanel.tsx` | `src/components/structure/` | **[S22]** Add Child: amber modal, any node type, slug auto-generated |
| `StructureImportModal.tsx` | `src/components/structure/` | **[S21]** Import UI |
| `StructureSunburstView.tsx` | `src/components/structure/` | Plotly Sunburst with filter sync |
| `structureExcel.ts` | `src/lib/` | Structure Excel export v2 (S20). 17 cols A–Q, single sheet, multi-row DependsOn. |
| `structureImport.ts` | `src/lib/` | **[S21]** Structure Import, non-destructive, conflict report |
| `theme.ts` | `src/lib/` | `THEME.structure` (indigo) + `THEME.structureEdit` (amber) |

### 2.3 Filter behaviour in Structure tab
- **Uses**: Area dropdown, Category chain dropdowns, Shortcuts
- **Does NOT use**: Date range filter (hidden when Structure tab active)
- **Shortcuts**: same mechanism as Activities tab; reset to "Custom" when filter scope changes
- Filter state drives both Table View rows and Sunburst focus

### 2.4 Theme / styling conventions
- Theme colors managed in `src/lib/theme.ts` — full static Tailwind class strings
- Structure tab: **`THEME.structure`** — indigo/purple (independent from ViewDetailsPage)
- Structure Edit panel + Add Child panel: **`THEME.structureEdit`** — amber (independent from global `THEME.edit`)
- Code Guidelines: `Code_Guidelines_React_v6.md` — always follow
- `structureEdit` available keys: `headerBg`, `headerText`, `headerBorder`, `accent`, `cancelBtn`, `deleteBtn`, `light`, `lightBorder`, `lightText`, `spinner`, `ring`
- No `saveBtn`, `inputFocus`, `icon`, `closeBtn` keys — use direct classes or `accent` for in-header buttons

### 2.5 Panel state pattern (StructureTableView — S19)
```typescript
panelMode: 'view' | 'edit' | null
activePanelIndex: number | null   // index into filtered[] array
highlightedNodeId: string | null  // 3s auto-clear, scroll-to-row

// View panel opens  → panelMode='view', activePanelIndex=idx
// Edit button       → panelMode='edit' (same activePanelIndex)
// ← View button     → panelMode='view' (same activePanelIndex)
// Close / Save      → panelMode=null, highlightedNodeId=nodeId
// Delete trigger    → deleteNode state set → StructureDeleteModal opens (S22)
// Add Child trigger → addChildParent state set → StructureAddChildPanel opens (S22)
```

### 2.6 Add Child — slug generation (S22)
```typescript
// Frontend slug generation (StructureAddChildPanel):
name.toLowerCase().trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '') || 'category'

// sort_order = max existing sibling sort_order + 10 (or 10 if no siblings)
// level = parentNode.nodeType === 'area' ? 1 : parentNode.level + 1
```

### 2.7 Delete cascade sequence (S22, empty subtrees only)
```typescript
// executeDelete() in StructureDeleteModal:
// 1. DELETE attribute_definitions WHERE category_id IN (subtreeIds)
// 2. DELETE categories grouped by level DESC (leaf-first) to satisfy FK
// 3. If Area: DELETE areas WHERE id = areaId
// Uses supabase.auth.getUser() for user_id — same pattern as StructureNodeEditPanel
```

---

## 3. Streamlit Reference (functional parity guide)

The Streamlit "Interactive Structure Viewer" provides the feature reference.
**Do not replicate code** — use as UX reference only.

### 3.1 Read-Only features in Streamlit
- View Type dropdown: Sunburst, Table, TreeMap, Network Graph
  - **React scope**: Sunburst + Table only (TreeMap and Network Graph excluded)
- Filter by Area + Drill-down to Category dropdowns
- Show Events toggle → **NOT implemented in React version**
- Excel export button (top-right)
- Sunburst: Plotly-based, re-renders on filter change, no true interactive drill-down sync

### 3.2 Edit Mode features in Streamlit
- Add/Delete/Edit Area, Category, Attribute
- Upload hierarchical Excel (U8 format)
- Toggle between Read-Only and Edit Mode at top of page

### 3.3 What React improves on
- Responsive: Sunburst on desktop, Table only on mobile
- Bidirectional filter sync: clicking Sunburst segment updates Area/Category dropdowns
- Edit mode: inline panel (no page switch), amber theme
- Prev/Next navigation in View panel without closing
- Event count in View panel header = subtree leaf count (number of sessions, not DB rows)
- Dependent dropdowns: real UI (dropdown with Other, add/delete/reorder options) — S23+
- Delete protection: blocked if events exist (full backup S23); cascade delete if empty (S22)
- "+ Add Child": unified action on all node types including Area and Leaf (S22)
- Table View: **hierarchical node list** (one row per node, not per leaf chain)
  showing full path text `Fitness > Activity > Gym > Cardio` with color-coding by level

---

## 4. Excel Structure Format (U8)

### 4.1 Format summary
The structure Excel (U8) contains one sheet with rows = one per category chain or attribute.
Full spec → `EXCEL_FORMAT_ANALYSIS_v2.md` Section 4.

Example:
- Area "Fitness", Category chain: "Activity > Gym > Strength"
- Attribute "Strength Type": suggest, options `Upp|Low|Core`
- Attribute "Exercise Name": suggest, **depends_on** `Strength_type`:
  - When `Upp` → options: `pull.m|biceps|triceps|rame|z.sklek|sklek|inv.row`
  - When `Low` → options: `squat-bw|squat-bulg|iskoraci|squat.m`
  - When `Core` → options: `leg.raises|plank|side.pl|bird-dog|McGill_curl-up`

### 4.3 Import rules (decided)
- **Non-destructive only** — import only ADDS new areas/categories/attributes
- No modification or deletion of existing structure via import
- If user wants to edit/delete → must use UI
- User shown a clear message if import would conflict with existing data

### 4.4 React v2 format — **IMPLEMENTED S20**
17 columns A–Q, single sheet `HierarchicalView`, multi-row DependsOn (Streamlit style).
Full spec → `EXCEL_FORMAT_ANALYSIS_v2.md` Section 4.

Key decisions (all resolved S20):
- **Q1:** 17 cols (not 19) — dropped `Level` and `Category` as redundant
- **Q2:** Column-based editability coloring (Pink/Yellow/Blue/Green) — not row-based
- **Q3:** Data validations YES — Type, AttrType, IsRequired, Val.Type
- **Q4:** Help sheet LAST

File naming: `structure_export_YYYYMMDD_HHmmss.xlsx` / `_backup.xlsx` / `_conflict.xlsx`
Conflict flow: slug in different CategoryPath → yellow highlight on Slug cell (col G forced visible)

---

## 5. UX Decisions (all resolved as of Session 22)

| ID | Decision |
|---|---|
| UX-1 | No date filter in Structure tab |
| UX-2 | "+ Add Activity" removed from Structure tab header |
| UX-3 | "Export" (Excel) button + "Import" button + "Edit Mode" button in header |
| UX-4 | Sunburst on desktop (≥ md breakpoint), Table only on mobile |
| UX-5 | Visualization library: **react-plotly.js** |
| UX-6 | Clicking Sunburst segment updates Area/Category dropdowns (bidirectional sync) |
| UX-7 | Shortcuts reset to "Custom" when filter changes via Sunburst or dropdown |
| UX-8 | No "Show Events" toggle; event count in Sunburst tooltip + View panel header only |
| UX-9 | Edit Mode: inline toggle within Structure tab — **functional as of S19** |
| UX-10 | In Edit mode on desktop: Sunburst switches to Table view automatically — **working S19** |
| UX-11 | **No checkboxes / bulk delete.** All operations via per-row Actions menu only. |
| UX-12 | Table View: **hierarchical node list** — one row per node. Full path text with **color-coding by level**. |
| UX-13 | Attribute count shown as badge per row in Table View |
| UX-14 | "Add Between": placeholder button → modal with "coming soon" message |
| UX-15 | View panel: sticky header with event count badge, Prev/Next, Edit, Delete — **S19/S22** |
| UX-16 | Edit panel: amber sticky header (independent theme), Save to Supabase — **S19** |
| UX-17 | **[S22]** "+ Add Child" unified action on ALL node types (Area, non-leaf, leaf). Opens amber `StructureAddChildPanel`. |
| UX-18 | **[S22]** Delete blocked (with message) if `eventCount > 0`. Full delete with combined backup planned S23. |
| OQ-7 | Help sheet in Export: clean **rewrite** (not copy from Streamlit). Defined in S17. |
| OQ-8 | `lookup_values` table: DROP via migration 005. Done S15. |

---

## 6. Edit Mode — Architecture Constraints

### 6.1 Operation safety matrix

| Operation | No events exist | Events exist |
|---|---|---|
| Rename Area | ✅ Safe | ✅ Safe (name only, slug unchanged) |
| Rename Category | ✅ Safe | ✅ Safe (name only, slug unchanged) |
| Rename Attribute | ✅ Safe | ✅ Safe (name only, slug unchanged) |
| Change attr `data_type` | ✅ Safe | ❌ **FORBIDDEN** (would corrupt existing values) |
| Edit attr unit/description/sort | ✅ Safe | ✅ Safe |
| Edit suggest options | ✅ Safe | ✅ Safe (UI in S19 StructureNodeEditPanel) |
| Add new child category | ✅ Safe | ✅ Safe — **implemented S22** |
| Add category "between" | ⚠️ Placeholder S23+ | ⚠️ Requires data migration |
| Delete leaf category (no events) | ✅ Safe | — |
| Delete leaf category (has events) | — | ⚠️ **Blocked S22** — full backup required (S23) |
| Delete non-leaf / Area (no events) | ✅ Safe — **implemented S22** | — |
| Delete non-leaf / Area (has events) | — | ⚠️ **Blocked S22** — full backup required (S23) |
| Delete attribute | ✅ Safe | ⚠️ Warning: existing event_attributes values lost — S23 |
| Edit `validation_rules` (suggest options) | ✅ Safe | ✅ Safe — implemented S19 |

**Implemented S19:** Rename Area, Rename Category, Rename Attribute, Edit unit/description/sort, Edit suggest options.
**Implemented S22:** Add Child Category (all node types); Delete empty subtrees (cascade, no events).
**Blocked S22 → S23:** Delete nodes with events (requires combined backup first).

### 6.2 Suggest options editing (S19 — StructureNodeEditPanel)
- Simple suggest: `textarea` — one option per line
- Reconstructed to `{ type: 'suggest', suggest: [...] }` on Save
- DependsOn attributes: read-only notice in Edit panel (full UI planned S23+)

### 6.3 Delete safety: combined backup (planned S23)
- **S22 state**: Delete blocked if `eventCount > 0`. Message shown:
  "X activities exist. Full backup (structure + activities) required — coming in next version."
- **S23 plan**: Before cascade delete of node with events:
  1. `exportFullBackup(subtree)` → download combined Excel (Structure + Activities)
  2. User confirms after download
  3. Execute cascade: `event_attachments` → `event_attributes` → `events` → `attribute_definitions` → `categories` (leaf-first) → `areas` (if Area)
- **S23 architecture** (already designed):
  - `exportStructureExcel(..., wb?)` — new optional 5th param
  - `exportActivitiesExcel(..., wb?)` — new optional param
  - Both backward compatible (AppHome call unchanged)
  - New `exportFullBackup()` creates shared workbook, calls both

### 6.4 data_type change — FORBIDDEN if events exist
- Edit panel shows `data_type` as read-only always
- If `node.eventCount > 0`: badge "locked (has events)" shown
- No UI to change `data_type` even if events = 0 (intentional for safety)

### 6.5 Add Child — design notes (S22)
- Available on ALL node types: Area → creates L1; Category (any level) → creates level+1
- Adding a child to a Leaf turns it into a Non-leaf — DB and UI update correctly after refetch
- Slug generated on frontend: `name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')` etc.
- sort_order = max sibling sort_order + 10 (room for future "Add Between")
- Panel: amber (`THEME.structureEdit`), modal overlay, autoFocus on name input, Enter to submit

---

## 7. Open Questions — all resolved as of S22

| ID | Question | Resolution |
|---|---|---|
| Q1 | 19 columns (A–S), drop any? | **17 cols** — dropped `Level` and `Category` as redundant |
| Q2 | DependsOn rows distinct color (Green-50) vs same Amber-50? | **Column-based coloring** |
| Q3 | Excel Data Validations in export? | **YES** — Type, AttrType, IsRequired, Val.Type |
| Q4 | Help sheet first or last? | **Last** |
| OQ-S22-1 | Delete backup scope: "All" or affected subtree? | **Affected subtree** (filterCategoryId/filterAreaId) |
| OQ-S22-2 | Add Leaf: Edit panel button or row actions menu? | **Row actions menu** — unified "+ Add Child" on all types |
| OQ-S22-3 | Delete Area protection: direct events or all cascade? | **All cascade** — `eventCount` already = subtree leaf count |
| OQ-S22-4 | Soft delete while backup not ready? | **No** — too complex for single-user app. Block delete with message. |
| OQ-S22-5 | Combined backup architecture? | Decided for S23: `wb?` optional param on both export functions, new `exportFullBackup()` |

---

## 8. Session History

| Session | Date | What was done |
|---|---|---|
| S14 | 2026-03-15 | Planning session. UX decisions made, all P-questions resolved. No code. |
| S15 | 2026-03-16 | Pre-coding: P1.1 + OQ-2,4,5,6,7,8 resolved. Coding starts. |
| S16 | 2026-03-16 | Core components built: useStructureData, StructureTableView, StructureSunburstView, CategoryDetailPanel, AppHome wired. |
| S17 | 2026-03-17 | TS fixes; `structureExcel.ts` (full export); Export button wired; Sunburst filter sync; Up button; tooltip fix. |
| S18 | 2026-03-18 | Bugfixes: BUG-S1/S2/S3/S4. `EXCEL_FORMAT_ANALYSIS_v1.md` created. Streamlit exporter analysed. |
| S19 | 2026-03-19 | View panel: sticky header + event count badge + Prev/Next + Edit. NEW `StructureNodeEditPanel.tsx` (amber): rename, suggest options, Supabase Save. Edit Mode toggle. Row highlight. |
| S20A | 2026-03-20 | Bug fixes: Save Area/Category (RLS — migrations 006+007), actions menu overflow (createPortal), sticky controls scroll. |
| S20B | 2026-03-21 | Excel Export v2: `structureExcel.ts` full rewrite. 17 cols, single sheet, legend rows, freeze G8, column groups, data validations, multi-row DependsOn. |
| S21 | 2026-03-21 | Structure Import: `structureImport.ts` + `StructureImportModal.tsx`. Non-destructive, slug lookup, conflict report Excel. Import button in AppHome. |
| S22 | 2026-03-22 | Delete + Add Child: `StructureDeleteModal` (blocked if events, cascade if empty), `StructureAddChildPanel` (amber, all node types, slug auto-gen). `CategoryChainRow` unified `+ Add Child`. `CategoryDetailPanel` Delete button wired. Architecture decisions: no soft delete, S23 plan for combined backup. |

---

## 9. Event Count — Implementation Note

Event count in `useStructureData.ts` (step 7) is **subtree leaf event count**, not direct DB count.

- **Leaf node**: own direct event count (e.g. Cardio = 2)
- **Non-leaf node**: sum of all leaf event counts in subtree (e.g. Gym = Cardio + Strength counts)
- **Area node**: sum of all leaf event counts for all categories under that area

This is computed via a bottom-up DFS post-pass in `useStructureData.ts`.
**Why**: direct DB count for non-leaf categories = parent event rows (1 per session chain),
which is meaningless to users. Subtree leaf count = number of activity sessions.

Displayed in: Sunburst tooltip, **CategoryDetailPanel sticky header badge** (S19).

**Delete guard**: `node.eventCount > 0` means the subtree has activity data. Delete is blocked
until combined backup is implemented in S23.

---

*Last updated: Session 22 — 2026-03-22*
