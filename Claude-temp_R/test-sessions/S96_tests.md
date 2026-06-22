# S96 Test Plan

**Branch:** test-branch
**Date:** 2026-06-22
**Features:** Shared filter helper, dynamic periods, shortcut filter_state, Export Profile, suggest Data Validation, LEGEND Default col

---

## Korak A — Shared Filter Helper (eventQueryBuilder.ts)

### T-S96-1: Activities table loads normally (regression)
**Pre:** Any area/category selected
**Steps:**
1. Open Activities tab
2. Change area, category, date filters
3. Verify events load correctly each time
**Expected:** No regressions — same behavior as before refactor

### T-S96-2: Export respects commentSearch
**Pre:** Some events with comments
**Steps:**
1. Type a comment filter in Activities tab (e.g., "rata")
2. Click Export
3. Verify count in Export modal matches filtered count
4. Download xlsx → verify only matching events present
**Expected:** Export count and data match the filtered Activities table

---

## Korak B — Dynamic Periods + Shortcut filter_state

### T-S96-3: New period presets visible
**Pre:** Activities tab open
**Steps:**
1. Open Period dropdown
2. Verify "Last 2 Months" and "Last 3 Months" are listed
3. Select "Last 2 Months" → verify date range updates
**Expected:** New presets resolve to correct date range (2 months ago → today)

### T-S96-4: Save shortcut with filter state
**Pre:** 027_preset_filter_state.sql run on TEST
**Steps:**
1. Select a leaf category + set period to "This Year" + sort "Oldest"
2. Click Save Shortcut in filter bar → give it a name
3. Switch to a different shortcut
4. Switch back to the saved shortcut
**Expected:** Period = "This Year", Sort = Oldest → dates and sort restored dynamically

### T-S96-5: Shortcut with attrFilter saved/restored
**Pre:** Category with suggest attribute
**Steps:**
1. Set attr filter (e.g., Status = Planiran)
2. Save as shortcut
3. Navigate away, come back via shortcut
**Expected:** Attr filter restored

### T-S96-6: Filter sheet includes periodKey
**Pre:** Activities filtered with a preset period
**Steps:**
1. Export xlsx
2. Open Filter sheet
3. Look for "Period key" row
**Expected:** "Period key" row shows e.g., "this-year" or "last-3-months"

---

## Export Profile System

### T-S96-7: Preview export (10 rows)
**Pre:** Area selected with events
**Steps:**
1. Open Export modal
2. In "Export Profile" section, click "Preview (10 rows)"
3. Open downloaded xlsx
**Expected:** Events sheet has exactly 10 data rows, all columns visible, no grouping

### T-S96-8: Import Profile from grouped xlsx
**Pre:** Preview xlsx opened in Excel
**Steps:**
1. In Excel: select columns B, C, E, F, G → Data > Group → click [-] to collapse
2. Save the xlsx
3. In app Export modal, click "Import Profile"
4. Select the modified xlsx
5. Enter a profile name (e.g., "Koka mjesečni")
**Expected:** Profile saved; dropdown shows "Koka mjesečni"; info text shows "5 hidden columns"

### T-S96-9: Export with profile applied
**Pre:** Profile "Koka mjesečni" saved
**Steps:**
1. In Export modal, select "Koka mjesečni" from profile dropdown
2. Click "Download Excel"
3. Open downloaded xlsx
**Expected:** Columns B, C, E, F, G are grouped and collapsed; expand via [+]; filename includes profile name; Filter sheet has "Export profile: Koka mjesečni"

### T-S96-10: Delete profile
**Pre:** Profile exists
**Steps:**
1. Select profile in dropdown
2. Click ✕ (delete) button
3. Confirm deletion
**Expected:** Profile removed from dropdown; export returns to all-columns mode

---

## LEGEND Default Column

### T-S96-11: LEGEND col F shows Default (not Unit)
**Steps:**
1. Export any activities xlsx
2. Open Events sheet → ATTRIBUTE LEGEND section
3. Check column F header
**Expected:** Header says "Default"; values show default_value (not unit)

---

## Suggest Data Validation

### T-S96-12: Suggest columns have dropdown in xlsx
**Pre:** Category with suggest attribute (e.g., Financije > Transakcija: Tip, Smjer)
**Steps:**
1. Export activities for that category
2. Open xlsx → go to a suggest-type attribute column
3. Click on a data cell in that column
**Expected:** Excel shows dropdown arrow with the suggest options; can select from list; also allows free-text entry (allowBlank: true)

---

## SQL for PROD (when ready)

- `sql/027_preset_filter_state.sql` — activity_presets.filter_state JSONB
- `sql/026_category_settings.sql` — categories.settings JSONB (from S95, if not yet run)
