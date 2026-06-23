# S97 Test Details

**Date:** 2026-06-23
**Features:** Shortcut filter_state fix, "In any attribute" filter, non-leaf shortcuts, dependent dropdowns in Excel

---

## T-S97-1: Shortcut filter switch resets attrFilter

**Precondition:** Two shortcuts saved — one with attrFilter (e.g. Status=Planiran), one without.

1. Select the shortcut WITH attrFilter (e.g. "Rata Planiran")
2. Verify the attribute filter chip appears in the table header
3. Switch to the shortcut WITHOUT attrFilter
4. **Expected:** Attribute filter chip disappears, filter dropdown resets to "Comment", activities table shows all events for that shortcut's category
5. Switch back to the shortcut WITH attrFilter
6. **Expected:** Attribute filter is restored correctly

**Also test:** commentSearch and sortOrder should reset/restore similarly.

---

## T-S97-2: Shortcut attrFilter restoration after switching

**Precondition:** Save a shortcut with Status=Planiran attrFilter active.

1. Open app fresh (or switch to a different shortcut first)
2. Select the shortcut with attrFilter
3. **Expected:** Filter dropdown shows "Status" (not "Comment"), table shows only Planiran events
4. Verify the chip in table header shows "Planiran"

---

## T-S97-3: "In any attribute" filter

**Precondition:** Have an area with events that have various text attributes.

1. Select an area/category in the filter
2. Open the "Filter by" dropdown
3. **Expected:** "In any attribute" option visible after "Comment" (before individual attrs)
4. Select "In any attribute"
5. Type a value that appears in some attribute (e.g. "EUR" or "Visa")
6. **Expected:** Table shows only events where ANY attribute contains the typed text (case-insensitive partial match)
7. Clear the filter with x
8. **Expected:** All events shown again

---

## T-S97-4: "In any attribute" with Export

1. Set "In any attribute" filter with a value
2. Note the event count in Activities table
3. Open Export modal
4. **Expected:** Count matches the filtered table count
5. Export and verify events in xlsx match

---

## T-S97-5: Save shortcut at non-leaf level

1. Select an area and a non-leaf category (e.g. L1 "Rashodi" in Financije)
2. Click "Save Shortcut" in filter bar
3. Enter a name, save
4. **Expected:** Shortcut appears in dropdown
5. Switch away, then select the saved shortcut
6. **Expected:** Non-leaf category is selected, table shows all events under that subtree
7. "Use" button should NOT be visible (not a leaf)

---

## T-S97-6: Save shortcut at area-only level

1. Select only an area (no category drill-down)
2. Click "Save Shortcut"
3. Save with a name
4. **Expected:** Shortcut appears in dropdown
5. Select it after switching away
6. **Expected:** Area is selected, no category. Table shows all area events

---

## T-S97-7: "Use" button only for leaf shortcuts

1. Have both leaf and non-leaf shortcuts
2. Select a leaf shortcut
3. **Expected:** "Use" button visible
4. Select a non-leaf shortcut
5. **Expected:** "Use" button NOT visible

---

## T-S97-8: Dependent dropdown in exported xlsx

**Precondition:** Financije area with "Tip" depending on "Smjer" attribute.

1. Export Financije events to xlsx
2. Open in Excel
3. Find the "Smjer" and "Tip" columns
4. Click on a "Tip" cell
5. **Expected:** Data Validation shows "Depends on: smjer" in the input message
6. If Smjer cell = "Rashod" -> dropdown should show only Rashod-specific Tip options
7. If Smjer cell = "Prihod" -> dropdown should show Prihod-specific options

---

## T-S97-9: DropdownData hidden sheet

1. Export xlsx with dependent attrs
2. In Excel: right-click sheet tabs -> "Unhide" or use VBA to check
3. **Expected:** "DropdownData" sheet exists with columns of option lists per parent value
4. Named ranges defined (check via Formulas -> Name Manager in Excel)

---

## T-S97-10: Dependent dropdown interaction

1. In exported xlsx, go to a new/empty row in EVENT DATA
2. Enter a value in "Smjer" column (e.g. "Rashod")
3. Click on the "Tip" cell in the same row
4. **Expected:** Dropdown shows options specific to "Rashod"
5. Change "Smjer" to "Prihod"
6. Click "Tip" again
7. **Expected:** Dropdown updates to show Prihod options

---

## T-S97-11: Static suggest dropdowns (regression)

1. Export xlsx
2. Find a suggest column that does NOT have depends_on (e.g. "Valuta" or "Status")
3. Click on a cell in that column
4. **Expected:** Standard dropdown with all options (same as before S97)

---

## T-S97-12: Number/boolean/datetime atributi skriveni iz filter dropdowna

**Precondition:** Area s miješanim tipovima atributa (npr. Financije: Iznos=number, Na rate?=boolean, Status=text/suggest).

1. Odaberi Financije area (ili kategoriju unutar nje)
2. Otvori "Filter by" dropdown
3. **Expected:** Iznos (number), Na rate? (boolean) i sl. NISU u listi
4. Status, Tip, Smjer, Valuta i sl. (text/suggest) JESU u listi
5. "Comment" i "In any attribute" su na vrhu

---

## T-S97-13: Hint poruka za skrivene atribute

**Precondition:** Area koja ima barem 1 number/boolean/datetime atribut.

1. Odaberi tu area/kategoriju
2. Pogledaj ispod "Filter by" dropdowna
3. **Expected:** Siva poruka: "N numeric/other attributes not shown — use Excel Export to filter by those."
4. N odgovara broju skrivenih atributa (npr. 2 za Iznos + Na rate?)

---

## T-S97-14: Hint poruka se NE prikazuje kad nema skrivenih

**Precondition:** Area gdje su svi atributi text ili suggest (npr. Demo area, ili area bez number/boolean atributa).

1. Odaberi tu area/kategoriju
2. **Expected:** Nema sive poruke ispod dropdowna

---
