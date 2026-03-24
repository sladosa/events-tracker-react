# EXCEL_FORMAT_ANALYSIS.md
# Events Tracker — Structure Excel Export/Import: Streamlit vs React Analysis

**Version:** 2.0
**Date:** 2026-03-21 (Session 20 — v2 implemented)
**Purpose:** Detailed comparison of Streamlit (v5) and React structure Excel formats,
with final format decisions and implementation record.

---

## 1. Streamlit Format (v5 — `enhanced_structure_exporter.py`)

### 1.1 Columns (A–Q, 17 fixed)

| Col | Name           | Color  | Editable? | Notes                                       |
| --- | -------------- | ------ | --------- | ------------------------------------------- |
| A   | Type           | Pink   | No        | Area / Category / Attribute                 |
| B   | Level          | Pink   | No        | Auto-calculated                             |
| C   | SortOrder      | Yellow | Yes       | Position within parent                      |
| D   | Area           | Pink   | No        | Formula: auto-extract from CategoryPath     |
| E   | CategoryPath   | Yellow | Careful   | KEY identifier — `Fitness > Activity > Gym` |
| F   | Category       | Blue   | Yes       | Must match last part of CategoryPath        |
| G   | AttributeName  | Blue   | Yes       | Name of attribute                           |
| H   | DataType       | Blue   | Yes       | number/text/datetime/boolean/link/image     |
| I   | Unit           | Blue   | Yes       | kg, min, EUR...                             |
| J   | IsRequired     | Blue   | Yes       | TRUE/FALSE                                  |
| K   | ValidationType | Blue   | Yes       | suggest/enum/none                           |
| L   | DefaultValue   | Blue   | Yes       | Default for new events                      |
| M   | TextOptions    | Blue   | Yes       | Pipe-separated options OR number min        |
| N   | ValidationMax  | Blue   | Yes       | Max value for numbers                       |
| O   | Description    | Blue   | Yes       | Documentation notes                         |
| P   | DependsOn      | Green  | Yes       | Parent attr slug (dependent dropdowns)      |
| Q   | WhenValue      | Green  | Yes       | Parent value for this row ("*" = fallback)  |

### 1.2 Depends_On representation (Streamlit)
**Multiple rows per attribute** — one row per `WhenValue`:
```
| AttributeName  | TextOptions              | DependsOn      | WhenValue |
| exercise_name  | pull.m|biceps|triceps    | strength_type  | Upp       |
| exercise_name  | squat-bw|iskoraci        | strength_type  | Low       |
| exercise_name  | plank|leg.raises         | strength_type  | Core      |
| exercise_name  |                          | strength_type  | *         |
```

### 1.3 Row colour-coding (Streamlit)
- Pink = Read-only (auto-calculated)
- Yellow = Key identifiers (edit carefully)
- Blue = Freely editable
- Green = Dependency columns

### 1.4 Additional features
- Column groups (outline collapsible)
- Data validations: dropdown for Type, DataType, IsRequired, ValidationType
- Column header comments (tooltips explaining each column)
- Freeze panes at G3
- Auto-filter on all columns
- Help sheet with full format description

---

## 2. React Format v1 (legacy — replaced by v2 in S20)

### 2.1 Columns (A–O fixed + dynamic DependsOnWhen_*)

> **DEPRECATED** — v1 format is no longer exported. Documented here for import
> backward-compatibility reference only.

| Col | Name                  | Notes                                  |
| --- | --------------------- | -------------------------------------- |
| A   | Type                  | Area / Category / Attribute            |
| B   | Sort                  | SortOrder                              |
| C   | Area                  | Area name                              |
| D   | Chain                 | Full path `Fitness > Activity > Gym`   |
| E   | Level                 | Numeric level                          |
| F   | IsLeaf                | TRUE/FALSE                             |
| G   | Description           | Documentation                          |
| H   | AttrName              | Attribute name                         |
| I   | AttrSlug              | URL-safe identifier                    |
| J   | AttrType              | data_type                              |
| K   | Unit                  | kg, min...                             |
| L   | IsRequired            | TRUE/FALSE                             |
| M   | ValidationType        | suggest/none                           |
| N   | TextOptions           | Pipe-separated                         |
| O   | DependsOnAttr         | Parent attribute slug                  |
| P+  | DependsOnWhen_<value> | One column per WhenValue (DYNAMIC)     |

### 2.2 Depends_On representation (React v1)
**One row per attribute, dynamic columns** — one column per WhenValue:
```
| AttrName      | DependsOnAttr  | DependsOnWhen_Upp       | DependsOnWhen_Low       |
| exercise_name | strength_type  | pull.m|biceps|triceps   | squat-bw|iskoraci        |
```

---

## 3. Comparison: Key Decisions (S18 analysis, all resolved)

### 3.1 Depends_On: Multi-row vs Multi-column
**Decision: Multi-row (Streamlit style)** — clearer for users, fixed column count,
Excel filter/sort works on WhenValue, simpler import logic.

### 3.2 Slug column
**Decision: Keep AttrSlug** — critical for round-trip correctness.
Slug never changes after creation, used as stable import key.
Placed in grouped/collapsed column (G) to reduce visual noise.

### 3.3 IsLeaf column
**Decision: Keep IsLeaf** — informational for user.
Import always recalculates from DB (never trusts Excel value).
Value: `"TRUE"` for leaf nodes, `""` (empty) for non-leaf.

### 3.4 Colour-coding philosophy
**Decision: Column-based editability coloring** (Pink/Yellow/Blue/Green).
Matches Streamlit — user knows at a glance which cells to edit.
Row-based entity coloring dropped (was React v1 approach).

### 3.5 Single sheet
**Decision: Single sheet `HierarchicalView`** — one parse pass for import,
one place to look, Excel auto-filter covers all areas.

---

## 4. React Format v2 — Implemented (S20)

### 4.1 Column layout (17 fixed columns A–Q)

> **Source of truth:** `src/lib/structureExcel.ts` — `COLS` array.

| Col | Name                | Color  | Group?  | Default   | Width | Notes                                       |
| --- | ------------------- | ------ | ------- | --------- | ----- | ------------------------------------------- |
| A   | Type                | Pink   | —       | visible   | 9     | Area / Category / Attribute                 |
| B   | IsLeaf              | Pink   | grouped | collapsed | 9     | `TRUE` or empty. Import ignores.            |
| C   | Area                | Pink   | grouped | collapsed | 9     | Formula: `=IFERROR(LEFT(D,FIND(...)...)`    |
| D   | CategoryPath        | Yellow | —       | visible   | 40    | KEY: `Fitness > Activity > Gym`             |
| E   | Sort                | Yellow | grouped | collapsed | 6     | SortOrder within parent                     |
| F   | AttrName            | Blue   | —       | visible   | 18    | Attribute display name                      |
| G   | Slug                | Pink   | grouped | collapsed | 18    | Stable import key. Forces open on conflict. |
| H   | AttrType            | Blue   | grouped | collapsed | 9     | number/text/datetime/boolean/link/image     |
| I   | IsRequired          | Blue   | grouped | collapsed | 9     | TRUE / FALSE                                |
| J   | Val.Type            | Blue   | grouped | collapsed | 9     | suggest / none                              |
| K   | Default             | Blue   | grouped | collapsed | 9     | Default value for new events                |
| L   | Val.Max (no)        | Blue   | grouped | collapsed | 9     | Max value (number attributes only)          |
| M   | Unit                | Blue   | —       | visible   | 7     | kg, min, bpm, EUR...                        |
| N   | TextOptions/Val.Min | Blue   | grouped | open      | 45    | Pipe-separated options OR number min        |
| O   | DependsOn           | Green  | grouped | open      | 18    | Parent attr slug                            |
| P   | WhenValue           | Green  | grouped | open      | 12    | Parent value (`*` = fallback)               |
| Q   | Description         | Blue   | —       | visible   | 60    | Documentation notes                         |

**Vs. v1:** Dropped `Level` and `Category` columns (redundant). Moved `Description`
to end. Replaced dynamic `DependsOnWhen_*` columns with fixed O+P. Added `Val.Max`.
Slug moved to Pink (read-only) and grouped/collapsed.

**Vs. S18 plan (19 cols A–S):** Plan had `Level`(B) and `Category`(F) which were
dropped as redundant. Final implementation is 17 columns, same count as Streamlit v5.

### 4.2 File layout (sheet: HierarchicalView)

| Rows  | Content                        | Behaviour                         |
| ----- | ------------------------------ | --------------------------------- |
| 1–5   | Color coding legend            | Row-grouped, default collapsed    |
| 6     | Export info / backup / conflict | Always visible                   |
| 7     | Column headers                 | Header row, autofilter            |
| 8+    | Data rows                      | Area → Category → Attribute order |

**Freeze pane:** G8 (cols A–F + rows 1–7 frozen simultaneously).

### 4.3 Row colour-coding (v2 — column-based, not row-based)

Every cell in a column gets the column's editability color regardless of row type.

| Color  | Columns     | Meaning                              |
| ------ | ----------- | ------------------------------------ |
| Pink   | A, B, C, G  | Read-only / auto-calculated          |
| Yellow | D, E        | Key identifiers — edit carefully     |
| Blue   | F,H,I,J,K,L,M,N,Q | Freely editable              |
| Green  | O, P        | Dependency columns                   |

**Row 6 background** varies by export type:
- Normal export: light gray (`FFF5F5F5`)
- Backup: soft orange (`FFFCE4D6`)
- Conflict report: soft yellow (`FFFFFF99`)

### 4.4 Row typography

| Row type              | Style          |
| --------------------- | -------------- |
| Area row              | **Bold**       |
| Leaf Category row     | **Bold**       |
| Non-leaf Category row | Normal         |
| Attribute row         | *Italic*       |

### 4.5 Data validations (Excel dropdowns in cells)

| Column    | Values                                       |
| --------- | -------------------------------------------- |
| A (Type)  | Area, Category, Attribute                    |
| H (AttrType) | number, text, datetime, boolean, link, image |
| I (IsRequired) | TRUE, FALSE                              |
| J (Val.Type) | suggest, none                              |

### 4.6 DependsOn — multi-row representation

Same as Streamlit v5. One row per `WhenValue`:

```
| AttrName      | DependsOn      | WhenValue | TextOptions/Val.Min     |
| exercise_name | strength_type  | Upp       | pull.m|biceps|triceps   |
| exercise_name | strength_type  | Low       | squat-bw|iskoraci       |
| exercise_name | strength_type  | Core      | plank|leg.raises        |
| exercise_name | strength_type  | *         |                         |
```

Fallback row (`WhenValue = "*"`) is auto-added by exporter if not present in
`options_map`. All rows for the same attribute share SortOrder, AttrType, Unit,
IsRequired.

### 4.7 File naming convention

| Type             | Pattern                                      | Example                                        |
| ---------------- | -------------------------------------------- | ---------------------------------------------- |
| Normal export    | `structure_export_YYYYMMDD_HHmmss.xlsx`      | `structure_export_20260321_142307.xlsx`        |
| Backup (pre-op)  | `structure_export_YYYYMMDD_HHmmss_backup.xlsx` | `structure_export_20260321_142307_backup.xlsx` |
| Conflict report  | `structure_export_YYYYMMDD_HHmmss_conflict.xlsx` | `structure_export_20260321_142307_conflict.xlsx` |

Timestamp = moment of file generation. All three share the same `nowTimestamp()` helper.

### 4.8 Conflict highlighting (import conflict report)

When import detects a slug found in a different CategoryPath:
- Export type: `conflict` (yellow Row 6 background)
- Row 6 C6: describes conflict e.g. `Import conflict: 2 rows skipped — see highlighted cells in col G`
- Slug column (G): **force-visible** (overrides collapsed group)
- Conflicted slug cells: bright yellow background (`FFFFFF00`)
- User corrects in Excel and re-imports

### 4.9 Backup row (Row 6) format

| Cell | Content              | Example                                                    |
| ---- | -------------------- | ---------------------------------------------------------- |
| A6   | ISO timestamp        | `2026-03-21 14:23:07`                                      |
| B6   | Label (bold)         | `Backup before:`                                           |
| C6   | Operation description | `Delete category 'Gym' — chain: Fitness › Activity › Gym (42 events affected)` |

Background: soft orange for backup, soft yellow for conflict, light gray for normal export.

---

## 5. Import Logic (planned — S20 Faza C)

### 5.1 Non-destructive principle
Import ONLY adds new structure. Never modifies data_type. Never deletes anything.

### 5.2 Slug lookup decision tree (Opcija A — decided S20)

| Slug in Excel | Found in DB? | CategoryPath match? | Action                          |
| ------------- | ------------ | ------------------- | ------------------------------- |
| Empty         | —            | —                   | CREATE new attr (DB trigger generates slug from AttrName) |
| Present       | No           | —                   | CREATE new attr (slug doesn't exist yet) |
| Present       | Yes          | Same                | UPDATE safe ops: name, unit, description, suggest options |
| Present       | Yes          | Different           | SKIP + add to conflictSlugs → conflict Excel |

### 5.3 Safe update operations (slug found, same path)
- Rename (attr.name)
- Unit change (attr.unit)
- Description change (attr.description)
- Suggest options update (validation_rules.suggest)
- DependsOn options_map update (non-destructive merge of WhenValues)

### 5.4 Forbidden import operations
- Change `data_type` (never — would corrupt existing event_attributes values)
- Delete existing attrs or categories
- Move a category to a different parent

### 5.5 Format auto-detection (for import backward-compat)

| Signal                          | Detected format       |
| ------------------------------- | --------------------- |
| Column header `WhenValue` present | React v2 or Streamlit v5 |
| Column header `DependsOnWhen_*` present | React v1 (legacy) |
| Column header `CategoryPath` present | React v2             |
| Column header `Chain` present   | React v1 (legacy)     |

### 5.6 Import result object (planned API)

```typescript
interface ImportResult {
  created:   { areas: number; categories: number; attributes: number };
  updated:   { attributes: number };
  skipped:   number;
  conflicts: ConflictRow[];
}

interface ConflictRow {
  rowNum:       number;
  attrName:     string;
  slug:         string;
  foundInPath:  string;
  importedPath: string;
}
```

---

## 6. Events Data Export (separate — planned S21+)

This is a **separate export** from structure — exports event data (not schema).

### 6.1 Sasa's proposal (deferred to S21+)
Add `AttrDetails` sheet to events export:
- Full attribute metadata (slug, data_type, unit, is_required, validation_rules)
- Main Events sheet: brief type info in column header e.g. `distance (km, number)`

**Pro:** Self-describing export, enables reverse-engineering import.
**Con:** Complexity, out of scope for MVP.
**Decision:** Defer to S21+. Document in ARCHITECTURE.md.

---

## 7. Implementation Status

| Task                          | Session | Status      |
| ----------------------------- | ------- | ----------- |
| Format analysis document      | S18     | ✅ Done     |
| React v2 export (`structureExcel.ts`) | S20 | ✅ Done |
| Help sheet rewrite            | S20     | ✅ Done     |
| Structure Import (`structureImport.ts`) | S20 Faza C | 🔜 Next |
| Import gumb u AppHome         | S20 Faza C | 🔜 Next  |
| Conflict report Excel         | S20 Faza C | 🔜 Next  |
| Events export AttrDetails     | S21+    | 🔜 Future  |

---

## 8. Public API (`src/lib/structureExcel.ts`)

```typescript
// Main export function
exportStructureExcel(
  nodes: StructureNode[],
  options?: ExportStructureOptions,   // filterAreaId, filterCategoryId
  infoRow?: InfoRowOptions,           // { type: 'export'|'backup'|'conflict', description? }
  conflictSlugs?: Set<string>,        // forces Slug col visible + yellow highlights
): Promise<ArrayBuffer>

// Filename generators
structureExportFilename():  string   // structure_export_YYYYMMDD_HHmmss.xlsx
structureBackupFilename():  string   // structure_export_YYYYMMDD_HHmmss_backup.xlsx
structureConflictFilename(): string  // structure_export_YYYYMMDD_HHmmss_conflict.xlsx
```

AppHome.tsx poziva samo `exportStructureExcel(nodes, options)` — treći i četvrti
parametar koriste se u Delete flow (Faza D) i Import conflict flow (Faza C).

---

*Document created: Session 18 — 2026-03-18*
*Updated: Session 20 — 2026-03-21 (v2 implemented, all Q1–Q4 resolved, import logic decided)*
