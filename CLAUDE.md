# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` → merge to `main` when ready

---

## Key docs (read before touching related code)

| Doc | When to read |
|-----|-------------|
| `docs/ARCHITECTURE_v1_6.md` | Always — data model, P1/P2/P3, chain_key, session identity |
| `docs/STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md` | Structure tab work (zamjenjuje v1.5) |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md` | Excel export/import work |
| `docs/IMPORT_DIFF_SPEC.md` | Import "skipped" vs "updated" — ✅ implemented S28 |
| `docs/ADD_ATTRIBUTE_SPEC.md` | Add/Delete Attribute u Structure Edit — ✅ implemented S28 |
| `docs/SUGGEST_DEPENDSON_SPEC_v2.md` | Suggest + DependsOn editing — ✅ implemented S29–S31 |
| `sql/SQL_schema_V5_commented.sql` | DB schema reference |
| `docs/Code_Guidelines_React_v6.md` | Code conventions |

---

## Three core principles — NEVER violate

**P1** — All category levels (not just leaf) can have attribute definitions.

**P2** — Leaf gets N events per session; every parent level gets exactly 1 event per session
(upsert, not insert). `chain_key = leafCategoryId` on all parent events.

**P3** — Last non-empty value wins. Empty never overwrites non-empty.
Applies in: Add Activity, Edit Activity, Excel Import.

---

## Critical rules

- **`session_start` must be rounded to the minute** (`setHours(h, m, 0, 0)`) — collision detection depends on it
- **`chain_key`** is a system field (UUID), never display to users; `comment` is user text only
- **`session_start` format:** DB returns `+00:00`, JS produces `.000Z` — never use URL-decoded value for Supabase queries; always use `events[0].session_start` (DB format)
- **Supabase SELECT must be single-line** — nested multiline selects silently ignore relations
- **`touched: true`** must be set when loading attributes from DB in Edit flow — otherwise handleSave() skips them
- **`parentEventLoader.ts`** is the single shared service for parent event logic — never duplicate
- **Excel Category_Path format:** Activities Events sheet col C = **bez area name** (`Domacinstvo > Automobili > Gorivo`); Structure sheet col D = **sa area name** (`TEST > Domacinstvo > Automobili > Gorivo`). `ExportCategoryInfo.full_path` nikad ne uključuje area name (hodanje po `parent_category_id` staje na L1). `StructureNode.fullPath` uključuje area name.
- **Before every commit:** `npm run typecheck && npm run build`

---

## Theme colours (src/lib/theme.ts)

| Context | Colour | Token |
|---------|--------|-------|
| View Activity | Indigo | `THEME.view` |
| Edit Activity | Amber | `THEME.edit` |
| Add Activity | Blue | `THEME.add` |
| Structure tab | Indigo/Purple | `THEME.structure` |
| Structure Edit panels | Amber | `THEME.structureEdit` |

Preview all at `/app/debug` → Theme Preview tab.

---

## Key files

```
src/lib/parentEventLoader.ts       Shared: buildParentChainIds(), loadParentAttrs()
src/lib/excelExport.ts             Activities Excel export, mergeSessionEvents()
src/lib/excelImport.ts             Activities Excel import, collision handling
src/lib/structureExcel.ts          Structure Excel export v2 (17 cols, HierarchicalView sheet)
src/lib/structureImport.ts         Structure import — non-destructive, slug lookup
src/lib/theme.ts                   Theme colour tokens
src/pages/AppHome.tsx              Home: tabs, filter, export/import triggers
src/pages/AddActivityPage.tsx      Add flow — writes chain_key on parent INSERT
src/pages/EditActivityPage.tsx     Edit flow — delta-shift, collision check, parent upsert
src/pages/ViewDetailsPage.tsx      Read-only view, Prev/Next
src/context/FilterContext.tsx      Global filter state (area, category, date range)
src/components/structure/          All Structure tab components
src/components/activity/           Activity form components, ExcelImportModal
src/hooks/useAttributeDefinitions.ts  Loads attr defs + parseValidationRules()
```

---

## Structure tab — component map

```
AppHome (Structure tab)
└── StructureTableView          Main table + Edit Mode toolbar
    ├── CategoryChainRow        One row per node (Area/Category)
    ├── CategoryDetailPanel     View panel (modal)
    ├── StructureNodeEditPanel  Edit panel — rename, attributes, suggest options
    ├── StructureDeleteModal    Delete — blocked (has events) or cascade (empty)
    ├── StructureAddChildPanel  Add Child — blocked if leaf has events (S24)
    ├── StructureAddAreaPanel   Add new top-level Area (S24)
    └── StructureSunburstView   Plotly Sunburst chart
```

`areas-changed` CustomEvent: dispatched after any Area add/delete → `ProgressiveCategorySelector` refetches Area dropdown.

---

## Data model (simplified)

```
areas → categories (hierarchical, parent_category_id, level 1-10)
      → attribute_definitions → event_attributes (EAV values)

events (linked to category_id + user_id)
      → event_attributes (value_text / value_number / value_datetime / value_boolean)
      → event_attachments (images, links)
```

`validation_rules` (JSONB) on `attribute_definitions` drives all dropdowns — no separate dropdown table.

---

## What's done vs pending

### Done (through S28)
- Full Activities tab: Add, Edit, View, Excel Import/Export with collision handling
- Structure tab: Read-only view (Table + Sunburst), Edit Mode (rename, attributes)
- Structure Excel export v2 (17 cols) + Import (non-destructive, conflict report)
- Structure Delete (cascade, blocked if node has events)
- Structure Add Child (blocked on leaf-with-events since S24)
- Structure Add Area UI (S24)
- `areas-changed` CustomEvent for Area dropdown refresh
- Vite chunk splitting: vendor-react, vendor-supabase, vendor-ui, vendor-excel, vendor-plotly
- Structure Import fix: modal stays open after import (result summary visible); dispatches `areas-changed` (S25)
- Structure table: leaf categories with 0 events show "no events yet" badge (S25)
- Unified Workbook Format (S26–S27): `excelUtils.ts`, `excelExport.ts`, `structureExcel.ts`, `excelBackup.ts` refaktorirani; Korak 7 (excelImport structure validation) odgođen
- Delete with backup (S27): amber header, "Download Backup & Delete", full cascade + download
- Import diff (S28): `hasChanges()` diff check — identični eventi = "skipped" (sivi box u UI); P3 prazna xlsx vrijednost ne diruje DB
- Add Attribute u Structure Edit (S28): inline forma, INSERT na Save, slug generacija s collision handling
- Delete Attribute (S28): immediate delete s confirm panelom, warning ako ima event_attributes data
- Text → Suggest konverzija (S28): gumb "→ Suggest" na text atributima u Edit panelu
- Import diff fix (S29): `hasChanges()` koristio `getUTCHours` umjesto `getHours` → timezone bug, fiksano
- Add Attribute fix (S29): `crypto.randomUUID()` dodan u INSERT — `attribute_definitions.id` nema DB default
- "Other" persist fix (S29): queue u `pendingOptionAdds`, persist na Finish; `AttributeInput` više ne piše direktno u DB
- DependsOn editing (S29): `StructureNodeEditPanel` prikazuje WhenValue/Options tablica umjesto read-only notice; add/edit/delete rows; change parent slug; `+ Add Dependency` gumb na suggest atributima
- Multi-option persist bugfix (S29b): `latestRules` Map u `persistPendingOptions` — višestruki Other u jednoj sesiji sada svi opstaju
- DependsOn dropdown bugfix (S29b): fallback `<option>` za cross-level parent slug; label "— (remove dependency) —"
- Ancestor attrs u depends_on dropdown (S30): `buildAncestorAttrs()` hoda `parentCategoryId` chain; optgroup po levelu + orphan `⚠` fallback; `allNodes` prop prosljeđen u `StructureNodeEditPanel`
- Delete attr zaštita (S30): `findDependsOnReferences` client-side check; amber warning s listom referenci + slug info za obnovu
- AreaDropdown refresh (S31): `useEffect` u `AreaDropdown.tsx` sluša `areas-changed` i poziva `refetch()`
- Edit Activity Other persist (S31): `persistPendingOptions` + `handleNewOption` dodan u `EditActivityPage`; `onNewOption` više nije `undefined`
- DependsOn empty slug blokira Save (S31): validacija u `StructureNodeEditPanel.handleSave` — toast error ako `dependsOnSlug` prazan, return bez DB write
- Korak 7 — Excel Import s kreiranjem strukture (S32): `parseExcelFile` detektira structure-only stub i vraća helpful error; `checkMissingCategories()` u `excelImport.ts`; `confirm-structure` state u `ExcelImportModal` — lista missing kategorija + "Create categories & continue" → `importStructureExcel` → reload → proceed

### Backlog — priority order

**Faza 1: single-user stabilizacija (test-branch → main, kao dosad)**

1. **Add Category Between** — umetanje razine unutar postojeće hijerarhije.
   Zahtijeva data migraciju (UPDATE category_id + chain_key na eventima).

3. **Financije reorganizacija** — supruga kao single user; srediti strukturu
   kategorija i atributa u Area "Financije" prije uvođenja suradnje.

4. **Plotly bundle size** — vendor-plotly ~4.9MB; prihvatljivo dok performanse
   nisu problem.

**Faza 2: infrastruktura za suradnju**

5. **Playwright E2E setup** — prerequisit za collaboration development.
   Novi dedicirani Supabase TEST projekt (služi i za Playwright i za collab dev).
   Setup guide: `docs/Playwright_Supabase_Setup_Guide.md`
   Requires: Supabase test project (nije kreiran) + `.env.testing` popunjen.

**Faza 3: multi-user suradnja (nova `collab` grana)**

6. **`collab` branch** — `git checkout -b collab` iz test-branch.
   `.env.local` pokazuje na Supabase TEST projekt (izolacija od produkcije).
   Netlify Preview Deploy opcionalno.

7. **SQL migracije za suradnju** (na TEST Supabase):
   - `008_profiles.sql` — `profiles` tablica (email↔UUID bridge) + trigger +
     migracija postojećih korisnika
   - `009_sharing.sql` — `data_shares` RLS, `share_invites` + trigger,
     proširene SELECT/INSERT policies na areas/categories/attr_defs/events

8. **Frontend collaboration** (~13 fajlova) — useDataShares hook, Share management
   UI (invite po emailu, lista, revoke), useAreas/useCategories proširenje,
   FilterContext sharedContext, StructureTableView guard, AddActivity/EditActivity
   guard, Excel Export svih evenata dijeljene Area.
   Spec: `Claude-temp_R/MULTI_USER_SHARING_ANALYSIS.md`

9. **Help panel** — pravila dijeljenja vidljiva u UI.

10. **Merge collab → main** — SQL migracije ručno na PROD Supabase → merge.

**Faza 4: historijska migracija (poseban projekt, bez vremenskog pritiska)**

11. **trening.xlsm analiza** — mapiranje kolona i sheetova na trenutni data model.
12. **Import historijskih podataka** u finalnu produkcijsku bazu.

---

## TypeScript known issue

`TS2688: Cannot find type definition file for 'vite/client'` — pre-existing, harmless, does not block build. Ignore it.

---

## Session workflow (VSCode / Claude Code)

### Start of session
1. Claude reads this file automatically
2. `git log --oneline -10` for recent context
3. Read `Claude-temp_R/PENDING_TESTS.md` — check if user confirmed previous tests
4. No ZIP uploads, no doc uploads needed

### During session
- Screenshots: paste directly into chat
- Before committing: `npm run typecheck && npm run build`

### End of session (OBAVEZNO)
1. **Update `Claude-temp_R/PENDING_TESTS.md`** — add new tests for everything coded this session;
   mark confirmed tests as ✅; remove tests older than 2 sessions
2. **Write detailed test steps in `Claude-temp_R/test-sessions/SXX_tests.md`** — one file per session,
   with numbered steps, preconditions, and expected vs fail behaviour for EVERY new test.
   Update the `Detalji testova:` link in PENDING_TESTS.md to point to the new file.
3. **Update `CLAUDE.md` backlog** — move done items out, add new S24+ items if discovered
4. **Commit** with descriptive message (e.g. `S24 structure add-area, import fix, blocked leaf`)

### Test result reporting (next session)
User says e.g. "T-S24-1 OK, T-S24-3 fail" → Claude updates PENDING_TESTS.md accordingly
and investigates failures before coding new features.
