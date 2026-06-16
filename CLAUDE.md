# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` (dev), `main` = PROD (Netlify deploya samo main)

---

## Key docs (read before touching related code)

| Doc                                        | When to read                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE_v1_6.md`               | Always — data model, P1/P2/P3, chain_key, session identity                       |
| `docs/STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md` | Structure tab work                                                               |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md`        | Excel export/import work                                                         |
| `sql/SQL_schema_V5_commented.sql`         | DB schema reference                                                              |
| `docs/Code_Guidelines_React_v6.md`        | Code conventions                                                                 |
| `docs/COLLAB_PLAN_v2.md`                  | Collab implementation plan (v2) — faze 0–11, decisions                           |
| `docs/RESTRUCTURE_DECISIONS_2026-04-01.md`| Odluke o reorganizaciji i Financije data modelu                                  |
| `docs/TEMPLATE_SYSTEM_SPEC.md`            | Template user sistem — starter Areas za nove korisnike, Add Area "From template" |
| `docs/PLAYWRIGHT_E2E_GUIDE.md`            | E2E test setup i workflow                                                        |
| `docs/HELP_STRUCTURE.md`                  | Help sistem — chip map, context detection, Content Evolution Protocol            |
| `data-prep_tools/DATA_PIPELINE_PLAN.md`  | Migracija podataka — prioriteti, Dirty Excel workflow, PROD checklist, alati     |

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

### Done (through S33)
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
- Filter reset after Structure delete (S33): `StructureDeleteModal` dispatcha `structure-deleted` CustomEvent s `deletedIds`; `FilterContext` resetira category (ili full reset za area) ako je obrisani node bio u aktivnom filteru
- Category dropdown refresh after structure changes (S33): `FilterContext` sluša `areas-changed` i reloada `dropdownOptions` in-place — novo importane/dodane kategorije odmah vidljive bez navigate away
- Collab Faza 0+1 (S34): TEST Supabase projekt kreiran (`events-tracker-test`, eu-west-1); `sql/TEST_setup.sql`, `sql/008_profiles.sql`, `sql/009_sharing.sql` primijenjeni; `useAreas`, `useCategories`, `useStructureData` — uklonjen `.eq('user_id')` filter, RLS sad handle-a shared areas; `collab` grana kreirana; `.env.testing` popunjen
- Collab Faza 2 (S35): `Profile` + `ShareInvite` + `DataShareWithProfile` types dodani u `database.ts`; `src/hooks/useDataShares.ts` kreiran (listShares, createShare, revokeShare, cancelInvite, listInvites, fetchSharedContext); `FilterContext` dobio `sharedContext: SharedContext | null` — auto-detektira kad je aktivan filter na shared Area (grantee view)
- Collab Faza 3 (S35): `AppHome.tsx` — Edit Mode gumb sakriven za grantee (`!sharedContext`); `useEffect` resetira `isEditMode` ako se shared Area odabere dok je Edit Mode aktivan
- Collab Faza 4 (S35): `AddActivityPage` — read-only guard (lock ekran) za `permission !== 'write'`; `EditActivityPage` — uklonjen `user_id` filter iz leaf events SELECT, `isOwnEvent` detekcija, tuđi event prikazuje "Tuđi zapis" + link na ViewDetailsPage
- Collab UX Design (S35): `docs/COLLAB_UX_DESIGN_v1.html` — wireframe dizajn za sve collab scenarije (Owner, Grantee write/read, Share Management, User indicator, Excel format, Request access flow); D1–D10 open decisions čekaju potvrdu
- Collab Faza 5 (S36): `SharedContext` proširen s `ownerEmail`+`ownerDisplayName`; `fetchAreaGrantees` helper; `src/components/sharing/SharedAreaBanner.tsx` — 3 varijante bannera (owner purple, write grantee green, read grantee amber); integrirano u `AppHome.tsx` (Activities + Structure); `CategoryChainRow` — role-aware ⋮ menu (grantee: owner info + copy email + request access; owner: + Manage Access placeholder)
- Collab bugfixes (S37): `fetchAreaGrantees` — FK join na `profiles` zamijenjen s dva odvojena querija (FK je bio na `auth.users`, ne `profiles`); `ViewDetailsPage` — uklonjen `user_id` filter koji je blokirao Prev/Next navigaciju na tuđim eventima
- Collab Faza 6 (S38): User kolona u Activities listi — Avatar (inicijali + hash boja) + "You" badge za vlastite / ime za tuđe; `areaHasActiveShares` u `FilterContext` (owner view); `user_id`+`user_display_name` u `useActivities` (batch profile lookup); D1 — Add Activity disabled za read grantee (tooltip + toast); D4 — ⋮ menu samo View za tuđe evente
- Collab bugfixes + testiranje (S39): RLS `categories_select` bug — koristio `categories.user_id` umjesto area ownership → `009_sharing.sql` fixed; `canAddActivity` nije blokirao read grantee na leaf → `AppHome.tsx` fixed; leaf/non-leaf hint prikazivao se za read grantee → `ProgressiveCategorySelector.tsx` + `AppHome.tsx` fixed; ViewDetailsPage `isOwnEvent` — Edit Activity gumb sakriven za tuđe evente; `fetchSharedContext` guard `.neq('owner_id', userId)` dodan
- Collab Faza 7 (S40): `src/components/sharing/ShareManagementModal.tsx` — 3 sekcije (active access + pending invites + invite form) + help text; 3 entry pointa: (1) `🔗 Manage Access` badge u filter baru (`areaHasActiveShares`), (2) `⚙ Manage Access` u Structure OwnerBanneru, (3) `Manage Access` u CategoryChainRow ⋮ meniju; `StructureTableView` dobio `onManageAccess` prop; `AppHome.tsx` drži `shareModalTarget` state
- Collab bugfixes + inline permission dropdown (S41): `CategoryChainRow` — "Manage Access" izvučen iz `isEditMode` guarda (uvijek vidljiv za ownera); `useDataShares.listShares` — FK join zamijenjen s dva odvojena querija (isti pattern kao `fetchAreaGrantees`); `createShare` — upsert s `onConflict` umjesto INSERT (sprječava duplikate, update permission); nova fn `updateSharePermission`; `ShareManagementModal` — inline `<select>` dropdown za read↔write na aktivnim shareovima; DB: unique constraint `data_shares_unique_share`

### Backlog — priority order

**Faza 1: single-user stabilizacija (test-branch → main, kao dosad)**

1. **Add Category Between** — umetanje razine unutar postojeće hijerarhije.
   Zahtijeva data migraciju (UPDATE category_id + chain_key na eventima).

2. **Financije reorganizacija** — supruga kao single user; srediti strukturu
   kategorija i atributa u Area "Financije" prije uvođenja suradnje.

3. **Plotly bundle size** — vendor-plotly ~4.9MB; prihvatljivo dok performanse
   nisu problem.

**Faza 2: infrastruktura za suradnju**

4. ~~**Playwright E2E setup**~~ — ✅ **kompletno (S50–S51)**. E1–E10 svi prolaze.

**Faza 3: multi-user suradnja (`collab` grana — u tijeku)**

Detaljan plan: `docs/COLLAB_PLAN_v2.md` ← **koristiti ovo** (UX odluke finalizirane 2026-04-03)
UX design wireframes: `docs/COLLAB_UX_DESIGN_v1.html`
Spec detalji: `Claude-temp_R/MULTI_USER_SHARING_ANALYSIS.md`
Branch: `collab` (kreiran S34), `.env.local` → TEST Supabase

Faze i status:
- ✅ Faza 0 — TEST Supabase setup (S34)
- ✅ Faza 1 — SQL migracije 008+009 (S34); verifikacija prošla
- ✅ Faza 2 — Frontend hooks: `useDataShares` + `FilterContext.sharedContext` (S35)
- ✅ Faza 3 — Structure tab guard: Edit Mode sakriven za grantee (S35)
- ✅ Faza 4 — Activity guards: AddActivity lock, EditActivity isOwnEvent (S35)
- ✅ Faza 5 — Structure tab UX + Edit Mode fix (banners, ⋮ menu po roli) — S36
- ✅ Faza 6 — User indicator (Activities lista: User kolona, avatar+ime, D1, D4) — S38
- ✅ Faza 7 — Share Management UI Modal (invite, lista, revoke) — S40
- ✅ Faza 8 — Profile settings modal (header avatar → modal, display_name edit, sign out) — S42
- ✅ Faza 9 — Help panel (modal: poboljšan tekst + ❓ mobile toggle; grantee banneri: "What can I do?" collapsible) — S42
- ✅ Faza 10a — Events sheet: User kolona G (email); attr kolone od I; uklonjen user_id filter (RLS); batch email lookup — S43
- ✅ Faza 10b — Structure sheet: SharedWith kolona D (pipe-separated emails, Area-only); `loadSharedEmailsByArea` — S43
- ✅ Faza 10c — HelpEvents + HelpStructure ažurirani za novi format — S43
- ✅ Bugfix (S43 session): `structureImport.ts` — uklonjen `.eq('user_id')` filter na categories + attr_defs; RLS handle-a access
- ✅ Faza 10e — Smart import (S44): `parseExcelFile` čita col G (User email), klasificira own/foreign redove; `confirm-users` modal korak (Skip / Import as mine); BUG-2 fiksiran
- ✅ S45 bugfixes: `cellStr` hyperlink fix; empty legend fix; `👤` owner u View/Edit headeru; `useActivities` groupKey uključuje `user_id`; Prev/Next nosi `userId` u URL + filtrira query; `loadParentAttrs` koristi event owner userId; export mergira parent event atribute u leaf
- ✅ S46 bugfixes: BUG-S45-1 — Prev/Next fix (Opcija A): `ActivitiesView` pre-builduje navActivities + prosljeđuje via `location.state`; skip option u `useActivities`; ViewDetailsPage koristi state listu; owner display — vlastiti event prikazuje email (ne "You"); tuđi event → Area: ownerEmail + Activity: foreignEmail u header; EditActivityPage "Tuđi zapis" → amber box s Area owner + Activity owner
- ✅ S47 UX fixes: Import gumb u empty state (`ActivitiesTable`); FilterContext stale areaId reset (`areas-changed` handler validira da UUID još postoji, inače `reset()`); `ExcelImportModal` scrollable (`max-h-full flex-col`) — gumbi dostupni i s dugim listama
- ✅ Faza 11 — Merge na main (S48): `009_sharing.sql` dodan unique constraint `data_shares_unique_share`; 008+009 pokrenuti na PROD; `collab` → `main` merge; Netlify deploy OK; tag `v1.0-collab`
- ✅ S49: Template user setup u TEST bazi; RLS policies; `useAreas.ts` template filter; `activity-attachments` bucket
- ✅ S50–S51: Playwright E2E — instalacija, `playwright.config.ts`, `auth.ts`, `filter.ts`, `seed.sql`, E1–E10 specs; selector tuning; `data-testid` na `CategoryChainRow`; svi E1–E10 prolaze
- ✅ S52: Template "From template" flow — `StructureAddAreaPanel` radio toggle; `useTemplateAreas()` hook; slug filter (bug fix: `n.area.user_id === userId`); preview async counts; copy logic (area + categories + attr_defs s UUID remapiranjem); `e2e/tests/e11-template.spec.ts` E11-1 do E11-5 prolaze; `deleteAreaCascade` helper u auth.ts
- ✅ S53: BUG-S52-1 fix — root cause DATA BUG u TEST bazi (sve template kategorije imale area_id = Health UUID); `sql/011_template_fix_area_ids.sql` UPDATE script; `sql/010_template_seed.sql` → `ON CONFLICT DO UPDATE SET area_id`; `StructureAddAreaPanel` defensive `.eq('user_id', TEMPLATE_USER_ID)` filter; E11-3 provjerava točne countove (3 cats, 2 attrs); svi E11 prolaze (5/5); T-S53-3 manualni smoke ✅
- ✅ S54: Structure tab filter segments (Mine/All/Templates) — stanje podignuto u `StructureTabContent` u `AppHome.tsx`; segmenti vidljivi iznad i Tablea i Sunbursta; slug-based exclusion: already-copied templates skriveni iz "All"/"Templates" segmenata; `StructureSunburstView` dobio `nodeFilter` prop; S54b bugfix: filter logic popravljan — `copiedTemplateAreaIds` set filtrira po `areaId` da isključi i area i sve njene kategorije; E12 spec (5/5 pass)
- ✅ S55: Add Category Between (Scenarij A) + Collapse Level (Scenarij D) implementirani; `StructureAddBetweenPanel.tsx`, `StructureCollapseLevelPanel.tsx`; E13-1/E13-2 Playwright (prolaze)
- ✅ S55b: Collapse Level bugfixes + UX — (1) `event_attributes` INSERT nedostajao `user_id` → vrijednosti bile nevidljive zbog RLS; (2) leaf direktno dijete: `maybeSingle()` pucao na 2+ leaf eventa u sesiji → prebačeno na loop po svim leaf eventima; (3) slug konflikt isti tip sada prebacuje vrijednosti na postojeći attr def umjesto skip-a; (4) slug konflikt različit tip → warning s listom; modal tekst: "will become a direct child of X", amber: "will be reassigned down to X"; E13 Playwright fix: force Table view u `goToStructure()`, strict-mode locator za Strength
- ✅ S56: Collapse Level bugfix — non-leaf direktno dijete: `maybeSingle()` tiho pucao kad query vrati 0/2+ redova → vrijednosti preskočene; fix: zamijenjeno loopom (isti pattern kao leaf branch); T-S55-4 ✅
- ✅ S56: UX-F1 — "Reset cat." u `ProgressiveCategorySelector`: `resetCategory()` resetira samo Category, Area ostaje netaknut; label promjenjen na "Reset cat."
- ✅ S56: UX-M1 — `useTouchSwipe` hook u `ViewDetailsPage`: swipe lijevo = Next, swipe desno = Prev; vertical scroll ne interferira
- ✅ S56: "Add Leaf" rename — `CategoryChainRow` ⋮ menu: "+ Add Child" → "+ Add Leaf" (sve 3 instance: area, non-leaf, leaf)
- ✅ S56: Slug rename u `StructureNodeEditPanel` — inline edit slug na attr defu; amber border kad promijenjeno; Reset gumb; auto-update depends_on referenci u allNodes; nema utjecaja na event_attributes (veza je UUID, ne slug)
- ✅ S56: Collapse Level pre-collapse warning — `incompatibleSlugs` useMemo prikazuje warning PRIJE collapse (ne nakon); inline rename input po konfliktu u modalu; green "✓ All conflicts resolved" kad sve riješeno; placeholder "new name for 'slug' on child"
- ✅ S56: Collapse Level fresh fetch fix — `freshChildAttrsMap` state fetchan na mount (bez `user_id` filtera, RLS handle-a); i warning UI i `handleCollapse` koriste isti map; `handleRenameConflict` refresha map nakon rename → stale allNodes props više ne uzrokuju krive INSERT-e; T-S55-5/6 ✅
- ✅ S57: ViewDetailsPage prefetch cache — `src/lib/activityViewCache.ts` (LRU 7 entry-a, ms-normalized key); `loadActivityData` koristi cache; prefetch ±3 susjeda u pozadini dok korisnik čita; Add+Edit nije potrebno (ViewDetails je read-only)
- ✅ S57: `CategoryDetailPanel` swipe — `useTouchSwipe` hook dodan; swipe lijevo = Next node, desno = Prev node
- ✅ S57: Structure area collapse — `CategoryChainRow` dobio ▼/▶ chevron za area redove + "N hidden" badge; `StructureTableView` — `collapsedAreaIds` state, `visibleRows` filter, "Collapse all / Expand all" gumb (prikazuje se kad 2+ areaa); panel Prev/Next navigira kroz `visibleRows`
- ✅ S57: AddAreaPanel duplikat zaštita — provjera po imenu (case-insensitive) za "empty" mode (inline error) i "template" mode (template se ne pojavljuje u dropdownu ako postoji area s istim imenom ili slugom)
- ✅ S57: AttributeChainForm localStorage expand persist — `attrExpanded:<categoryId>` u localStorage; korisnikova preferencija (otvori/zatvori) pamti se per-category; radi za Add i Edit Activity
- ✅ S61: Help sistem UX refaktor — `src/context/HelpContext.tsx` (global state: isOpen, pageHint); `App.tsx` refaktoriran: jedan `FilterProvider` + `HelpProvider` za sve `/app/*` rute, `AppShell` s nested Routes + `HelpOverlay`; `HelpPanel.tsx` rewritan: FAB (fixed bottom-right, globalno vidljiv na svim stranicama i modalima), draggable header (drag → floating 400×580, Pin → docked), context chips (3 brza pitanja po kontekstu: activities/structure/add/edit/view), context reset (chat se briše kad se Help otvori iz drugog konteksta), engleski UI; `AppHome.tsx` — uklonjen `showHelp` state i `HelpButton` iz headera, dodan `setPageHint(activeTab)` effect

**Open bugs (main):**
- **BUG-1:** `useFilter must be used within a FilterProvider` na `AppHome.tsx:105` — vjerojatno StrictMode artefakt, nizak rizik
- ✅ **UX-2** (S74): Activities "All Areas" — User kolona prikazuje se kad owner ima ijedan aktivan share (ranije samo kad je specifična area odabrana); fix u `FilterContext.tsx`: null-areaId branch sada queryja `data_shares` za bilo koji aktivan share umjesto immediate `false`
- **BUG-S52-1:** ✅ RIJEŠEN (S53)
- **E7/E8/E9 parallel:** Padaju pri 4 workers (duplicate key na data_shares); prolaze `--workers=1`
- Bulk delete (checkbox) nije ograničen za grantee-a — backlog
- ✅ S71 bugfix: Export modal — `[object Object]` error display (Supabase plain error obj → `.message`); count query koristio puni `loadExportData` umjesto laganog count → statement timeout fiksano korištenjem `countEventsForExport` direktno; `loadEventsForExport` i parent event merge koristili PostgREST nested select (→ ogroman JOIN ~126k redova) → fiksano chunked `loadAttrsForEvents()` (200 event_id po queriju)
- **UX-Import-1:** Excel Import modal nema progress indikator ni timer — veliki importi (3000+ redova) izgledaju frozen; dodati: elapsed time + "Processing row X of Y" ili spinner s brojevima
- ✅ **UX-Unit-1** (S73): View Activity — `unit` dodan kao sivi suffix uz numeričke vrijednosti (`75.4 min`, `4.86 km`); `activityViewCache.ts` fetchuje `unit` iz `attribute_definitions`; prikazuje se samo za `data_type='number'`.
- ✅ **View Activity description** (S73): `description` atributa prikazan u zagradi uz naziv (`Zeljezo (Ref: 9–30 μmol/L)`); fetchuje se u `activityViewCache.ts`.
- ✅ **Leave shared area** (S73): grantee može se odvojiti od shared aree via ⋮ meni → "Leave this area"; write grantee s eventima dobiva modal s 2 opcije: "Detach with data" (kopira strukturu + batch-reassigna evente/attrs na nove UUID-ove) ili "Leave without data"; `sql/019_leave_area.sql` proširuje `data_shares_delete` policy; `src/lib/leaveArea.ts` + `src/components/sharing/LeaveAreaModal.tsx`.
- ✅ S74 bugfix: `detachAreaWithData` — leaf event imaju `chain_key = NULL` (AddActivityPage ne upisuje chain_key na leaf INSERT); pairMap key bio `"catId:null"` → `catIdMap.get("null") = undefined` → silent skip leaf eventa; fix u `leaveArea.ts`: eksplicitni `'null'` string check, leaf event dobiva `category_id` update, `chain_key` ostaje null.
- ✅ S75: Orphan events feature — `useOrphanUsers.ts` hook (batch `data_shares` query → `orphanedUserIds`); amber `OrphanBanner` (View events / Manage gumbi); `OrphanManagementModal` (per-user: Re-invite → ShareManagementModal, Claim all → UPDATE user_id, Delete all → CASCADE delete); `filterOrphans` bool u FilterContext → ActivitiesTable chip + client-side filter; amber ring + ⚠ badge na avataru za orphan redove; ⋮ menu "Manage orphan events"; `area_id` dodan u `ActivityGroup`; `sql/020_orphan_rls.sql` — owner UPDATE/DELETE policy na tuđim eventima u vlastitim areasima.
- ✅ S76: Grantee zaštita podataka — 3 featuera:
  - **"Revoke with events" dialog** (`ShareManagementModal`): Revoke gumb prvo fetchira event count za grantee-a; ako ima eventa → amber dialog s 3 opcije (Revoke only / Claim events / Delete events); Claim = UPDATE user_id na ownera; Delete = kaskada event_attachments+attrs+events
  - **"Take your data" gumb** (`SharedAreaBanner.tsx` WriteGranteeBanner): zeleni banner dobio gumb koji otvara postojeći `LeaveAreaModal` + info tekst "Your events are stored in owner's area"
  - **Invite acceptance warning** (`AuthPage.tsx`): set-password form prikazuje ownership note kad `areaName` postoji u JWT metadata
  - Help system update: `netlify/functions/help.ts` system prompt + `docs/help/sharing.md` + `docs/help/activities.md`
  - E15 Playwright (3/3 pass): dialog pojava, revoke-only → orphan banner, grantee banner s gumbom
- ✅ S76b bugfixes (pronađeni tijekom manualnih testova):
  - `shares-changed` CustomEvent: `FilterContext` + `StructureTableView` + `SharedAreaBanner` sada re-fetchaju share status odmah nakon invite/revoke — bez page refresha
  - `useOrphanUsers` false positive: grantee je vidio lažni orphan banner za owner-ove evente; fix: check `areas.user_id = currentUserId` prije označavanja kao orphan
- ✅ S77: SharedAreaBanner OwnerBanner UX — skraćen na jedan red: `🔗 This Area is shared` + `⚙ Manage Access` (bez liste granteeova, bez "Structure changes" teksta u banneru); "Structure changes affect all users" premješteno u Edit Mode toolbar (`StructureTableView`) — prikazuje se s lijeve strane "+ Add Area" gumba samo kad `areaHasActiveShares`
- ✅ S78 bugfix: `loadAttrsForEvents` u `excelDataLoader.ts` — dodan `.limit(chunk.length * 50)` override; bez toga Supabase default 1000-row cap truncirao attrs za evente s 10+ atributima po chunku od 200 (200×10=2000>1000); vidljivi simptom: najnoviji eventi (uneseni zadnji u DB) imali prazne kolone u xlsx exportu dok su stariji radili ispravno
- ✅ S79: Help FAB prekrivao ⋮ Actions meni — `ActivitiesTable` i `StructureTableView` scroll containeri dobili `pb-20` (80px); zadnji red tablice uvijek scrollable iznad FAB-a na mobilnom
- **BUG-S61-1:** ✅ RIJEŠEN (S62) — toast error na fail; `ProgressiveCategorySelector` uvijek mounted (filter collapse ga više ne unmountira); `sql/015_activity_presets_rls.sql` pokrenut na PROD (missing INSERT policy)
- ✅ S63: Delete Shortcut auto-select — `useEffect` u `ProgressiveCategorySelector` auto-selektira preset kad `filter.categoryId` odgovara nekom presetu (fix za browser restart koji briše sessionStorage)
- ✅ S63: Help Concepts tab — treći tab s glosarijem (Core Concepts / Key Behaviors / Design Decisions s trade-offovima)
- ✅ S63: Help Structure chips update — Structure stranica: "What does the ⋮ menu do?" + "How do I share an area?" umjesto manje relevantnih chipova
- ✅ S63: Edit Activity chip fix — "What happens when I change the time?" (bilo: "What is delta shift?")
- ✅ S63: docs cleanup — 10 obsolete spec fajlova → `docs/obsolete/`; `Claude-temp_R` old artefakti → `Claude-temp_R/obsolete/`
- ✅ S63: `docs/HELP_STRUCTURE.md` — referentni dokument za help sistem (chip map, context detection, Content Evolution Protocol)
- ✅ S64: Permissions fix — `isOwnedArea` prop na `CategoryChainRow`; edit akcije i Manage Access skriveni za tuđe areae u "All" view (root cause: `sharedContext` = null bez area filtera)
- ✅ S64: Add Between na area ⋮ meniju — `StructureAddBetweenPanel` podržava area parent (level=0); L1 djeca traže se po `areaId`, INSERT s `parent_category_id = null`
- ✅ S64: Add Above na leaf ⋮ meniju — novi `StructureAddAbovePanel`; INSERT Y na razini lista (isti parent), UPDATE leaf parent=Y level++; eventi netaknuti; siblizi nepromijenjeni
- ✅ S64: `help.ts` system prompt — ispravljen opis Add Between (novi čvor ISPOD odabranog) i Collapse Level (djeca GORE, atributi DOLJE); docs/help/structure.md opis ažuriran
- ✅ S66: Perf — `category_full_paths` recursive CTE view (`sql/016_category_paths_view.sql`); `useActivities.ts` refaktoriran: `buildCategoryPath` N+1 loop uklonjen, zamijenjen jednim batch queryjem na view; pokrenuto na TEST + PROD. Stranica 20 eventa s 8 unique kategorija: ~32 querija → 1.
- ✅ S66: `dev:prod` npm script + `.env.prod.local` (gitignored) za lokalni dev server koji koristi PROD Supabase bazu
- ✅ S68: Health tracking — `make_health_events.py` (Korak 3): čita `Bloodwork.xlsx` sheet "Krv", filtrira `zdravstveni` redove, generira `Health_events_import.xlsx` (45 Lab Results + 13 Medical Visit); `range_flags()` generira H/L comment (samo out-of-range vrijednosti, format "Kolesterol H · Feritin L"); 2 preskočena retka (bez datuma / invalid date)
- ✅ S68: Excel Export poboljšanja — (1) attr kolone sortirane po `sort_order` iz DB (ne abecedno); (2) Description dodana u ATTRIBUTE LEGEND (col G, 7 kolona ukupno); (3) Max/Min/Sum redovi iznad EVENT DATA s `SUBTOTAL(4/5/9)` i dinamičkim LOOKUP rangem; redovi grupirani (outlineLevel=1); label u col H desno poravnan
- ✅ S68: `data-prep_tools/` direktorij u korijenu repoa (tracked) — Python skripte za data preparation; `venv/` i `*.xlsx` gitignored; `Tools/`, `Health/`, `Financije/` poddirektoriji
- ✅ S69: Invite sustav — `netlify/functions/send-share-invite.ts`: verifikacija JWT, insert `share_invites` PRIJE `inviteUserByEmail()` (izbjegava race s DB trigger chainom), šalje Supabase invite email s `invited_by` + `area_name` kontekstom; `useDataShares.ts createShare`: za neregistrirane korisnike poziva Netlify funkciju umjesto direktnog inserta; `ShareManagementModal.tsx`: prosljeđuje `areaName`; `AuthPage.tsx`: detektira `#type=invite` u URL hash, čita email iz JWT tokena (ne aktivne sesije — bugfix), prikazuje set-password formu s pre-fillovanim emailom i porukom tko poziva; `npm run dev:netlify-prod` script (dotenv-cli, mergea .env.local + .env.prod.local); Supabase "Invite user" email template prilagođen
- ✅ S70: Invite sustav — clean URL + message box + expired token handling:
  - `generateLink` umjesto `inviteUserByEmail` (nema rate limita, nema Outlook deliverability problema)
  - Clean invite URL `/invite/:id` na našoj domeni (umjesto raw Supabase verify URL)
  - `sql/018_invite_action_link.sql`: ADD COLUMN action_link na share_invites
  - `netlify/functions/get-invite-link.ts`: novi Netlify fn — lookup action_link by invite ID (service role); vraća owner_email za error poruke
  - `src/pages/InviteRedirectPage.tsx`: `/invite/:id` → redirect na Supabase; sprema owner_email u sessionStorage
  - `ShareManagementModal.tsx`: message box s TO + SUBJ + body + Copy gumbovima; dvije varijante poruke (registered/unregistered); caller info fetchan iz profiles
  - `AuthPage.tsx`: `setSession()` eksplicitno s invite tokenima (bugfix: `updateUser` ažurirao owner password umjesto grantee); detektira `#error=access_denied` expired token → amber banner "Invite link has expired, ask [owner] to resend"
  - `AppHome.tsx` + `StructureTableView.tsx`: localStorage persist za activeTab, structureViewMode, nodeFilter, collapsedAreaIds
- ✅ S71: Migration tools + Garmin Activities import:
  - `data-prep_tools/Tools/common_excel.py` — **SHARED LIBRARY**: `excel_date()`, `STRUCTURE_HEADERS`, `write_structure_row()` — importira se iz svih skripti
  - `data-prep_tools/Tools/supabase_structure_export.py` — read-only Supabase structure reader; ispisuje areas/categories/attrs + event counts kao markdown
  - `data-prep_tools/Tools/excel_import_template.py` — **REFERENTNI TEMPLATE** za xlsx import skripte; točan LEGEND/EVENT DATA format + česte greške; kopiraj kao osnovu za novi importer
  - `data-prep_tools/Tools/db_inspector.py` — inspekcija baze iz chata; `--area`, `--category`, `--fields`, `--limit`, `--check duplicates|ranges|empty`; service role, zaobilazi RLS
  - `data-prep_tools/Tools/garmin_full_field_audit.py` — katalogizira sva polja iz svih Garmin JSON export tipova
  - `data-prep_tools/Tools/garmin_activities_to_xlsx.py` — generira roundtrip xlsx iz Garmin summarizedActivities:
    - 3134 aktivnosti (2002 Outdoor, 1127 Gym/Cardio, 5 Strength), raspon 2015–02/2025
    - `pace` kao text "MM:SS" (npr. "06:04") — u bazi `text`, ne `number`
    - `location` attr na Activity nivou, popunjen Nominatim reverse geocode (zoom=18)
    - 555 geocode zona cachirano u `data-prep_tools/Tools/geocode_cache.json` (tracked)
    - Structure sheet auto-included; pace attr auto-patch number→text
  - `data-prep_tools/MIGRATION_STATE.md` — tracking tablica za sve izvore podataka
  - Output: `data-prep_data/Fitness_Garmin_import.xlsx` (spreman za TEST import)
  - Garmin distance u cm (ne meters!) → ÷100000 za km; elevationGain cm → ÷100 za metre
- ✅ S72: Reorganizacija direktorija — `data-prep/` → `data-prep_tools/` (tracked scripts); `Claude-temp_R/Data_preparation/` → `data-prep_data/` (gitignored data: xlsx, DataFromGarmin, Health, Financije)

---

### Backlog — sljedeći koraci (prioritetni redoslijed)

**Prioriteti za S77 (određeno na kraju S76):**
1. ✅ SharedAreaBanner UX cleanup (banner simplification + Edit Mode toolbar warning)
2. ✅ Garmin Daily Metrics importer — `Health_Sasa > Daily_metrics > Garmin_data`; 3624 eventa (2014–2025); HR Rest/Min, Body Battery, VO2max, Steps, Active Min, Calories, Avg Stress, Training Status; importano u TEST ✅
3. **Financije reorganizacija** — srediti strukturu prije pusha na main (Koka feedback)

**Napomena S77:** Docs cleanup (README, PENDING_TESTS, CLAUDE.md), SAVE_PLUS_TOGGLE_SPEC obrisan, Koka Health_Saša pristup potvrđen. Garmin Daily Metrics: TEST import OK (trajao ~30min zbog sekvencijalnih API poziva — za PROD koristiti split po godinama). Sleep/HRV stubovi u strukturi, čekaju DI-Connect-Wellness fajlove.

**Napomena S78:** Export attrs bugfix (loadAttrsForEvents .limit() + ATTR_CHUNK_SIZE 200→80). Garmin Daily Metrics importan u PROD ✅. Health_Sasa Medical struktura fix importan u PROD ✅. Header left-align u xlsx exportu. compare_xlsx.py alat dodan. S78 mergean na main.

**Napomena S80:** `dev:netlify-prod` fix (--port 8889 + dotenv -o; netlify re-injektira .env.local pa za PROD pregled koristiti `npm run dev:prod`). Supabase PROD Site URL ispravljen (bio Streamlit, sad Netlify). Garmin_data dedupliciranje: `fix_garmin_duplicates.py` — 1000 duplikata obrisano iz TEST. Medical cleanup: `delete_by_comment.py` — 8 IZBRISATI eventa obrisano iz TEST. Export paginacija bug: `loadEventsForExport` udario u Supabase 1000-row cap; fiksano paginacijom po 1000 unutar funkcije. Health_Sasa TEST čist (3716 eventa), spreman za PROD import.

**Napomena S81:** Comment filter implementiran — `commentSearch` u `FilterState`, `.ilike('comment', '%text%')` u `useActivities`, text input u filter baru (Activities tab), chip u `ActivitiesTable` header; `navActivities` i `ActivitiesTable` oba koriste `commentSearch`. Health_Sasa PROD import potvrđen T-S80-3 ✅.

**Napomena S82:** SharedAreaBanner UX kompresija — read i write grantee banneri svedeni na 1 kompaktni red (`👁 Read-only access` / `✅ Write access` + `[ℹ Info]` gumb). Info otvara modal s owner emailom, copy email i listom dozvola. Owner Structure row: sharing badge uklonjen email username, ostala samo 🔗 ikona (+ broj ako >1 grantee).

**Napomena S83:** "Contact owner" message draft u Info modalima — `ReadGranteeInfoModal` i `WriteGranteeInfoModal` dobili "Contact owner" gumb umjesto "Copy email"; otvara TO/SUBJ/body message draft (identičan UX kao invite modal u ShareManagementModal); Read grantee: pre-filled poruka za zahtjev write accessa; Write grantee: pre-filled header + textarea za slobodni tekst; `← Back` vraća na info prikaz; oba modala fetchaju grantee email (supabase.auth.getUser) za personalizaciju.

**Napomena S84:** ✅ UX-Mobile-1 implementirano — `ActivitiesTable.tsx`: desktop `<tr hidden sm:table-row>` + mobilni `<tr sm:hidden>` (2 ćelije: main content + sticky ⋮); `<thead hidden sm:table-header-group>`; Import/Export `hidden sm:flex` u headeru tablice. `AppHome.tsx`: mobilni Import/Export gumbi u filter sekciji (dispatchu `activities:open-import`/`activities:open-export` CustomEvente); `ActivitiesView` sluša iste. Desktop layout netaknut.

**Napomena S86:**
- ✅ **Bug fix: suggest atributi u make_import.py** — `Structure` sheet pisao `AttrType='suggest'`; DB ne prihvaća 'suggest' kao `data_type` (valjani: number/text/datetime/boolean/link/image); suggest atributi tiho preskočeni pri importu. Fix: `AttrType='text'` + `Val.Type='suggest'` (suggest = data_type='text' + validation_rules). Pravilo dokumentirano u `data-prep_tools/Tools/excel_import_template.py`.
- ✅ **Bug fix: StructureDeleteModal error display** — `catch` blok prikazivao genericku "Delete failed" jer Supabase `PostgrestError` nije `instanceof Error`. Fix: `(err as {message?:string})?.message` prikazuje stvarnu DB grešku u modalu.
- ✅ **Bug fix: StructureDeleteModal cascadeDelete** — `cascadeDelete(false)` (no-events path) nije brisao `events`/`event_attributes` → FK constraint `event_attributes_attribute_definition_id_fkey` pucao ako su eventi djelomično importani. Fix: uvijek čisti events za kategorije (stale `eventCount` u UI ne blokira cleanup).
- ✅ **Bug fix: StructureDeleteModal activity_presets FK** (S87) — Delete Area pucao s FK constraint `activity_presets_category_id_fkey` ako je postojao shortcut na nekoj kategoriji u subtreeu. Fix: `cascadeDelete` briše `activity_presets` gdje `category_id IN categoryIds` prije brisanja `attribute_definitions` i `categories`.
- ✅ **Financije_2 importana u TEST** — 458 eventa (2026-01 do 06), 39 atributa (uključujući svi suggest dropdowni), 20 kategorija. Struktura: Prihodi (Plaća/Najam/Ostali) + Rashodi (Dom/Svakodnevni/Restoran/Prijevoz/Zdravlje/Trening/Pretplate/Razvoj/Kupovina/Telekomunikacije/Rate/Porezi/Putovanje/Ostalo) + Transferi.
- ✅ **S86b: `default_value` primjenjuje se u Add Activity** — `AddActivityPage.tsx` dobio `useEffect` koji inicijalizira `attributeValues` s `default_value` kad se atributi učitaju (samo za atribute koji nisu već u mapi → draft restore nije ugrožen); `touched: true` osigurava da se default sprema; primjer: Valuta → EUR pre-selected.
- ✅ **S86b: Iznos bez EUR unit** — `make_import.py` uklonjen `unit='EUR'` s Iznos atributa (Prihodi + Rashodi + Transferi); Structure re-import updateirao 3 attr_defs (EUR → null); Iznos više nema statički EUR label koji bi bio netočan kad je Valuta = HRK/USD.

**Napomena S87:**
- ✅ `make_financije3_import.py` refaktoriran — flat struktura (Transakcija = leaf, nema L2 Kategorija); svih 8 atributa pod Transakcija; bad-date redovi uključeni s fallback datumom + `[DATUM_GREŠKA: ...]` u Napomeni; out-of-range datumi auto-korigirani (2005→2025 +20yr, 2036→2026 -10yr) ili fallback; leaf_comment = `RF: [Napomena]` / `ZABA: [Napomena]`
- ✅ `StructureDeleteModal` bugfix — `cascadeDelete` sada briše `activity_presets` (shortcuts) prije `attribute_definitions`; FK constraint `activity_presets_category_id_fkey` više ne blokira brisanje Area
- ✅ **Financije_3 importana u TEST** — flat, 3163 eventi; Activities tablica prikazuje `ZABA: Parking`, `RF: Mirovina I stup` itd.; View Activity: jedna Transakcija sekcija s 8 atributa + leaf badge
- 41 DATUM_GREŠKA redova u bazi (pretraživivi via comment filter "DATUM_GREŠKA"); 3 SKIP (balance rows bez iznosa)

**Napomena S88 — Shortcut pre-fill (`default_attributes`) + UX bugfixes:**
- ✅ `sql/022_preset_default_attributes.sql` — `activity_presets.default_attributes JSONB` dodan; pokrenuto na TEST + PROD ✅
- ✅ Filter-bar "💾 Save Shortcut" — info nudge ("💡 Did you know?") prvi put kad shortcut nema atribute, objašnjava da treba Add Activity za defaults; localStorage flag `ui:shortcutAttrTipDismissed` pamti "Don't show again"
- ✅ Add Activity "💾 Save as Shortcut (with these attribute values)" gumb — sprema `touched` atribute kao `default_attributes`; ako kategorija već ima shortcut → choice modal (Update postojećeg / Save as new / Cancel); inače name-input modal
- ✅ Pre-fill efekt proširen — preset `default_attributes` ima prednost nad statičkim `attr.default_value`; oba poštuju "ne prepisuj postojeću/draft vrijednost" (`prev.has(attr.id)`)
- ✅ "⚡ Use" fast-lane gumb (`ProgressiveCategorySelector`) — kad je odabran shortcut koji vodi do leafa, preskače Activities tablicu i odmah otvara Add Activity (`onUseShortcut` prop, `canUseShortcut` derived check uključuje `sharedContext?.permission !== 'read'`)
- ✅ Bugfix — broken shortcut (kategorija obrisana u Structure): `handleShortcutSelect` detektira `error || !category`, zove `resetCategory()` (briše stale filter state od prethodnog shortcuta), postavlja `brokenShortcutId`, prikazuje `toast.error` + amber warning banner s "Delete shortcut" linkom
- ✅ Bugfix — mobile auto-collapse: `onLeafSelected` dobio treći param `source?: 'manual' | 'shortcut'`; `AppHome.handleLeafSelected` ne kolabira filter sekciju na mobilnom kad je leaf odabran preko shortcuta (čuva vidljivost "⚡ Use" gumba)
- ✅ Bugfix — Delete Shortcut button vizualni kontrast: enabled `bg-red-100 border-red-200 text-red-700`, eksplicitni `disabled:bg-red-50 disabled:border-transparent disabled:opacity-40` (ranije `bg-red-50`/`opacity-40` izgledao identično u oba stanja)
- ✅ Bugfix — duplikat imena shortcuta: case-insensitive provjera u `handleSavePreset` (filter bar) i `handleConfirmSaveNewShortcut` (Add Activity); `toast.error` blokira save ako ime već postoji
- ✅ `docs/help/activities.md` — nova sekcija "Shortcuts (brzi pristup)" (Update vs Save as new, "⚡ Use", `default_attributes`); `HelpPanel.tsx` `CHIPS.add` dobio "How do I save my values as a Shortcut?"

**Napomena S89 — Perf: filter persist + chain cache + skeleton rows:**
- ✅ `FilterContext`: filter state prebačen na `localStorage` (sessionStorage → localStorage); app se otvori s restauriranim Area+Category filterom iz prethodne sesije
- ✅ `useCategoryChain`: sessionStorage cache po `categoryId` (`chain_v1_<id>`); drugi Add Activity za isti shortcut preskače SELECT * FROM categories; explicit `refetch()` invalidira cache
- ✅ `ActivitiesTable`: loading spinner zamijenjen skeleton tablom (7 animate-pulse redova, desktop+mobile)
- ✅ Svi T-S88 i T-S89 testovi prošli (2026-06-09)
- ✅ `data-prep_tools/Financije/match_sasa_napomene.py` — matchira 'Što' opise iz 'Za Sašu' sheeta s export datotekom po ključu (datum, iznos); col R output za ručni pregled; 96 matchiranih, 9 duplikata (narančasto)
- ✅ `data-prep_data/Financije/FINANCIJE_MODEL.md` — prijedlog novog data modela: Račun + Izvor plaćanja (Direktno/Visa/Mastercard/Cash) + Tip (kategorija troška) + Napomena; Transfer = interni, nije pravi trošak; za razgovor s Kokom

**Prioriteti za S90:**
1. **Financije model redesign** — dogovor s Kokom o `FINANCIJE_MODEL.md`; proširiti `Račun` suggest + dodati `Izvor plaćanja` atribut; uvesti kartične transakcije iz 'Za Sašu' umjesto Transfer lump-sum redova
2. **Financije_3 bulk kategorizacija** — popuniti N/A Tip (~2434 redova) nakon što je model dogovoren
3. **Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi

**Napomena S91:**
- ✅ `default_value` polje dodano u `StructureNodeEditPanel` — novo polje vidljivo za sve tipove osim boolean, u formi postojećih atributa i u "New attribute" formi; INSERT + UPDATE šalju `default_value` u DB
- ✅ `depends_on` visibility za non-text tipove — `AttributeChainForm.tsx`: number/boolean/datetime atributi skriveni/prikazani prema parent vrijednosti (bez dropdown opcija, samo visibility control)
- ✅ `structureImport.ts` deduplication fix — prazni slug → `makeAttrSlug(name)` fallback + name-based lookup; drugi import istog xlsx-a ne stvara duplikate
- ✅ `netlify.toml` — dodan `[dev]` section (`targetPort=5173, port=8888`); blank page fix za `npm run dev:netlify`
- ✅ **Hide-if-default** u `AttributeChainForm.tsx` — atributi čija je vrijednost jednaka `default_value` skrivaju se pri otvaranju forme; toggle "Prikaži sve / Sakrij"; `userEditedIds` Set (odvojeno od `touched` koji je za save logiku); reset na promjenu kategorije
- ✅ Bugfix: `touched: true` (pre-fill S86b) više ne sprječava skrivanje defaulta — koristi `userEditedIds.has(attr.id)` umjesto `!currentValue?.touched`
- **Backlog: Structure Edit UX cleanup** — skupiti u jedan sprint (~4-5h ukupno, sve u `StructureNodeEditPanel.tsx` ~1200 redova, nema DB promjena):

  **1. Collapsible attribute kartice** (~2-3h)
  - State: `collapsedAttrs: Set<string>` (po attr.id) u komponenti; persist u localStorage key `structAttrCollapsed:<nodeId>`
  - Collapsed header (1 red): `name` + type badge (`text`, `suggest`, `number`...) + sort broj + chevron ▶/▼ + trash ikona
  - Expanded: cijeli sadašnji sadržaj (kao danas)
  - Trash/delete akcije moraju biti vidljive i u collapsed stanju (u headeru)
  - "Collapse all / Expand all" gumb iznad liste (prikaže se kad 3+ atributa)
  - Pattern: isti kao area collapse u `StructureTableView` (S57)

  **2. `suggest` direktno u "New attribute" formi** (~1h)
  - `NewAttrFormState` (trenutno: `{ name, dataType: 'text'|'number'|'boolean'|'datetime', unit, required, defaultValue }`)
  - Dodati `suggest` kao opciju u Type `<select>` — ali interno to je `data_type='text'` + `val_type='suggest'`
  - Kad je odabran `suggest`: ispod dropdowna se pojavljuje `<textarea>` "Options (one per line)"
  - `handleAddAttr`: ako `dataType === 'suggest'` → `{ dataType: 'text', validationType: 'suggest', suggestOptions: textarea.value }`
  - `NewAttrFormState` treba dobiti `suggestOptions: string` field
  - `→ Suggest` gumb na postojećim text atributima ostaje (konverzija)

  **3. Help docs update** (~20min)
  - `docs/help/structure.md` → sekcija "Editing attributes": tipovi, suggest opcije, default_value (mora točno odgovarati opciji), depends_on (vidljivost / SKRIVENO), slug (siguran za rename)

  **4. Post-Finish konfiguracija** — odgoditi dok Financije Korak 3 (rate modal) ne bude konkretan
- **Konfiguracija za Stanje (uvijek skriven):** `DependsOn=smjer, WhenValue=SKRIVENO` — depends_on ima prednost pred hide-if-default; polje nikad vidljivo u formi ali postoji u bazi
- **Konfiguracija za Uplata/Isplata (depends_on visibility):** SQL ili Excel import s `DependsOn=smjer, WhenValue=Uplata/PROVJERI` (za Uplata) i `WhenValue=Isplata/PROVJERI` (za Isplata)

**Napomena S92:**
- ✅ `netlify-cli` 25.3.0 → 26.1.0 + `netlify.toml [dev] framework = "vite"` — blank page s Vite 7 riješen; `npm run dev:netlify` radi (T-S92-4 ✅)
- ✅ `_` sentinel u Activities Excel importu (`excelImport.ts`) — `_` briše vrijednost atributa (zaobilazi P3); novi eventi tretiraju `_` kao prazno; `hasChanges()` detektira `_` kao promjenu (T-S92-1,2,3 ✅)
- ✅ `_` sentinel u Structure Excel importu (`structureImport.ts`) — `_` u Default koloni = `default_value = null`; implementirano istovremeno (T-S92-5 ✅)
- ✅ Structure import bugfix — `default_value` nije bio u SELECT, dirty checku ni UPDATE payloadu; sva 3 mjesta dodana (T-S92-6 ✅)
- ✅ Help docs — `structure.md`: "Atributi u Edit panelu" + `_` sentinel za Default kolonu; `activities.md`: vidljivost polja + `_` sentinel za xlsx
- ✅ S91 testovi svi potvrđeni (T-S91-1..8); S92 testovi svi potvrđeni (T-S92-1..6)

**Napomena S93 (prošla sesija — implementacija):**
- ✅ Attribute filter u filter baru (`AppHome.tsx`): dropdown koji prikazuje atribute aree/kategorije; suggest → select s opcijama; text/number → text input; chip u tablici s × za brisanje; `FilterContext` proširen s `attrFilter: { attrDefId, value, isExact }`
- ✅ Rata modal (`src/components/activity/RataModal.tsx`): post-Finish automation za Financije_3; triggerira se kad `Na rate?=Da`; generira N rata s iznosom Iznos/N, datumima 11. u sljedećim mjesecima, Status=Planiran; `sql/023_rata_config.sql` za `rata_config` tablicu (ali se koristi hardkodirana logika u Financije_3)
- ✅ `generate_rata.py` Python tool za batch generiranje rata iz CSV-a
- T-S93-1 ✅ T-S93-2 ✅ (Status=Planiran) — testovi iz S93

**Napomena S93b (ova sesija — bugfixes):**
- ✅ **URL length bug** (`useActivities.ts`): pre-fetch pristup koristio `.in('id', thousands_ids)` → URL > 8KB → silent fail → "Error loading activities"; fix: PostgREST `!inner` join (`event_attributes!event_attributes_event_id_fkey!inner(...)`) — filter server-side, nema URL limita
- ✅ **Statement timeout** (`sql/024_event_attributes_indexes.sql`): nema indexa na `event_attributes(event_id, attribute_definition_id, attribute_definition_id+value_text)` → query skenira cijelu tablicu, timeout 8s; 3 indexa kreirana, **pokrenuto na TEST + PROD**
- ✅ **Import duplicates** (`excelImport.ts`): `smartReclassify` koristio `.in('id', 3163_ids)` → isti URL limit → sve reklasificirano kao CREATE → 3163 duplikata; fix: chunked query po 200 IDs; `sql/fix_financije3_import_duplicates.sql` za cleanup TEST baze (pokrenut)
- ✅ **PostgrestError propagation** (`useActivities.ts`): `PostgrestError` nije `instanceof Error` → catch blok gubio stvarnu poruku; fix: `pgErr?.message` direktno u `setError(new Error(...))`
- ✅ **Filter dropdown dedup bug** (`AppHome.tsx`): atributi importani prije S91 (Health_Sasa Medical Visit: Doktor/Vrsta/Iznos/Napomena) imaju slug=`''`; deduplication kolabirala sve empty-slug atribute na prvi (Doktor); fix: preskači dedup za prazne slugove
- ✅ **Filter dropdown ancestor walk** (`AppHome.tsx`): koristio `selectionChain` (async state, može biti stale); fix: direktni DB walk od `filter.categoryId` gore → determinističan
- **⬜ SQL slug fix** (opcionalno): pokrenuti u Supabase SQL Editor (TEST + PROD): `UPDATE attribute_definitions SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g') WHERE slug IS NULL OR slug = '';`
- T-S93b-1 ✅ T-S93b-2 ✅ T-S93-3 ✅ T-S93-4 ✅ T-S93-5 ✅ T-S93-6 ✅
- **T-S93-7 do T-S93-12** (Rata modal testovi) — **čekaju sljedeću sesiju**

**Napomena S94 (2026-06-16):**
- ✅ Rata modal bugfixes: `sql/023_rata_config.sql` pokrenut na TEST; `amount_slug` ispravljen na `"isplata"`; `date_map` ključevi → `{"Mastercard": 11, "Visa": 3}`; `comment_attr_slug: "napomena"` dodan
- ✅ Rata modal: original event briše se nakon "Kreiraj rate" (`pendingRataOriginalEventIds` + DELETE); `navigate('/app')` umjesto success dialoga s broken Edit gumbom
- ✅ `buildRataComment`: `rata 1/3 · 150 od 300` format
- ✅ Preskoči: `na_rate → false`, `broj_rata → null` UPDATE na original eventu
- ✅ Export attrFilter: `ExportFilters.attrFilter` + `!inner` join u `countEventsForExport` + `loadEventsForExport`
- ✅ `RataAutomationConfig.comment_attr_slug` optional field u `database.ts`
- ✅ Svi T-S93-7..T-S93-12 potvrđeni; T-S93-12 by design (Broj rata skriven kad Rate?=Ne)
- ✅ `sql/025_prod_rata_config.sql` kreiran za PROD deploy
- ✅ PROD SQL deploy (S94 session): slug fix (hyphens→underscores na Financije attr_defs); `trigger_slug` ispravljen na `"rate"` (PROD attr se zove "Rate?" → slug `rate`, TEST je "Na rate?" → `na_rate`); rata modal spreman za Koka testiranje

**⚠️ Arhitekturalni dug — filter logika duplikacija:**
`useActivities.ts` i `excelDataLoader.ts` imaju odvojene implementacije filter logike.
Svaki novi filter mora biti dodan na oba mjesta. `commentSearch` je trenutno samo u
`useActivities` (Export ga ignorira). Rješenje: `src/lib/eventQueryBuilder.ts` shared
helper koji oba mjesta importaju. Napraviti u zasebnom sprintu kad bude više filtera.

**Prioriteti za S95:**
1. **Financije forma UX s Kokom** — testiranje na mobilnom, fine-tuning
2. **Auto leaf comment** (Napomena + Isplata) — `leaf_comment` config u area settings, S94 design dogovoren
3. **Financije_3 bulk kategorizacija** — popuniti N/A Tip (~2434 redova)
4. **Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi

**Post-Finish automation** — spec: `docs/AUTOMATION_SPEC.md`
- Faza 1: Python rata tool → Post-Finish modal u web app
- Faza 2: Auto-comment template po leaf kategoriji
- Faza 3: Excel Automations sheet (generalni engine)
- Faza 4: Training parser/inverz (čeka `trening.xlsm` analizu)

**✅ UX-Mobile-1: Activities tablica na mobilnom** — implementirano S84
- `sm:hidden` mobilni redovi: Red 1 (datum · vrijeme · ⋮ sticky desno), Red 2 (kategorijna staza ako nema filtera · comment)
- Bez events badge na mobilnom (nije kontekstualno jasno bez headera)
- Import/Export premješteni u filter sekciju (mobile only, `sm:hidden`)
- Desktop: potpuno netaknut


**1. ✅ PROD smoke test** — T-S48-1 do T-S48-5 sve ✅ (S49, 2026-04-13)

**2. Template system** — `sql/010_template_seed.sql` kreiran (S49); spec: `docs/TEMPLATE_SYSTEM_SPEC.md`
- ✅ Template user kreiran u TEST bazi (`be785f09-b7c6-497f-b351-363d224c93c8`)
- ✅ Template user kreiran u PROD bazi (`d6ab00dd-4fda-4e86-bfdc-34a17f032e92`) — S58, loginable
- ✅ RLS policies za areas/categories/attr_defs uključuju template user (per-env UUID)
- ✅ `TEMPLATE_USER_ID` centraliziran kao `VITE_TEMPLATE_USER_ID` env var (S58)
- ✅ `useAreas.ts` — template areas skrivene iz filter dropdowna
- ✅ Storage bucket `activity-attachments` kreiran u TEST s policies
- ✅ Add Area "From template" flow — `StructureAddAreaPanel` radio toggle + dropdown + preview + copy (S52)
- ✅ BUG-S52-1 riješen (S53) — DATA BUG u TEST bazi; sql/011 pokrenut
- ✅ 010_template_seed.sql pokrenuto na PROD via 012_prod_template_uuid_fix.sql (S58)
- ✅ Template "Demo" Area — `sql/014_demo_area.sql` kreiran (S60); 8 kategorija, sve attr vrste, suggest, dependent suggest; system prompt u help.ts ažuriran
- ✅ `014_demo_area.sql` pokrenuto na PROD (S64); Demo vidljiva u Templates ✅
- ⬜ Garmin API adapter (future) — template kao schema za external source mapping

**3. ~~Add Category Between~~** — ✅ **kompletno (S55–S56)**. Scenarij A (Add Between) + Scenarij D (Collapse Level) implementirani i testirani.
   Spec: `docs/ADD_CATEGORY_BETWEEN_SPEC_v2.md`
   Novi fajlovi: `StructureAddBetweenPanel.tsx`, `StructureCollapseLevelPanel.tsx`
   E2E: `e2e/tests/e13-add-between.spec.ts` (E13-1, E13-2) — ✅ prolaze (S55b)
   Manualni: T-S55-1/2/3/4/5/6 sve ✅; T-S56-1/2/3 ✅

**4. ~~UX poboljšanja — Filter i Mobile~~** — ✅ **kompletno (S56–S57)**

- ✅ **UX-F1** — "Reset cat." resetira samo Category, Area ostaje (`resetCategory()` u `FilterContext`, `ProgressiveCategorySelector`)
- ✅ **UX-M1** — Swipe geste na `ViewDetailsPage`: `useTouchSwipe` hook, swipe lijevo = Next, desno = Prev
- ✅ **UX-M2** — Swipe geste na `CategoryDetailPanel` (Structure tab): swipe lijevo = Next node, desno = Prev node (S57)
- ✅ **UX-P1** — Prefetch cache za ViewDetailsPage: LRU 7 entry-a, prefetch ±3 susjeda u pozadini (S57)
- ✅ **UX-S1** — Structure area collapse/expand: per-area chevron + "Collapse all" gumb (S57)
- ✅ **UX-A1** — AttributeChainForm expand state persist via localStorage per category (S57)

**5. AI Help sistem** — Claude Haiku embedded u app, kontekstualni help + feedback + log
Odlučeno S58, sve na TEST bazi. Plan po fazama:

- ✅ **Faza H1 — Infrastruktura** (S59):
  - `sql/013_help_tables.sql` — tablice `help_log` + `feedback`; pokrenuti na TEST + PROD
  - `docs/help/` — 7 fajlova: concepts, activities, structure, sharing, excel, attributes, templates
  - `netlify/functions/help.ts` — Haiku, non-streaming, logira u `help_log` via service role
  - `netlify.toml` — `[functions]` section s esbuild bundlerom
  - Env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Netlify + `.env.local`)

- ✅ **Faza H2 — UI komponenta** (S59):
  - `src/components/help/HelpPanel.tsx` — `HelpPanel` + `HelpButton` eksporti
  - Desktop: fixed side panel 400px, slide in s desna | Mobitel: bottom sheet 78vh
  - 2 taba: **Pitaj AI** (chat + history) | **Povratna info** (wish/bug/question → `feedback`)
  - `HelpButton` (❓) u headeru `AppHome.tsx`

- ✅ **Faza H3 — Template Demo Area + `netlify dev`** (S60):
  - `netlify-cli` devDependency + `"dev:netlify"` script u `package.json`
  - `.env.local`: `ANTHROPIC_API_KEY` placeholder + `VITE_HELP_API_URL` aktivan za lokalno testiranje
  - `sql/014_demo_area.sql` — Demo Area: 2 L1 (Exercise, Daily Log), 5 leaf kategorija, 21 attr def; sve attr vrste; suggest + dependent suggest; DO block s email-based user detection (radi na TEST i PROD)
  - System prompt u `netlify/functions/help.ts` ažuriran — citira Demo Area po path-u
  - ✅ Pokrenuto na PROD (S64); smoke test prošao

- ✅ **Faza H4 — Aktivacija + Merge na PROD** (S59):
  - `013_help_tables.sql` pokrenuto na TEST + PROD ✅
  - `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` na Netlify ✅
  - Smoke test: AI odgovori rade, feedback se sprema u DB ✅

- ✅ **Help docs — dinamički load (S81):**
  - `netlify.toml`: `included_files = ["docs/help/**"]` — fajlovi bundlani uz funkciju
  - `help.ts` refaktoriran: `STATIC_PROMPT` (pravila + Demo Area) + `HELP_DOCS` (čita svih 7 `.md` fajlova via `fs.readFileSync(process.cwd() + 'docs/help/*.md')`)
  - Novi feature → samo ažuriraj `docs/help/<tema>.md` — `help.ts` se ne dirá
  - `concepts.md`: uklonjen meta-komentar koji nije bio namijenjen AI-u

**Pravilo:** `docs/help/*.md` = jedini izvor istine za feature docove. `help.ts` statički prompt = samo Demo Area putanje + pravila tona.

**⭐ VAŽNO korisniku — "What can I do here?" discovery chip (predloženo S88, 2026-06-08):**
Problem: Help sistem (Ask AI/Concepts/Feedback) odgovara na pitanja, ali ne pomaže korisniku
otkriti mogućnosti za koje ne zna da postoje (npr. korisnik nije znao da "Disable Save+" postoji
po Areai dok nije slučajno naišao na checkbox u Structure edit panelu).
**Odluka:** NE novi 4. tab ("Details") — dupli content nasuprot `docs/help/*.md` koji bi brzo
zastario. Umjesto toga: standing chip **"✨ What can I do on this screen?"** po `pageHint`
kontekstu (isti `CHIPS`/`HelpContext` mehanizam kao danas), koji ruta kroz postojeći AI + markdown
docs. Zahtijeva: `docs/help/*.md` dobiva sekciju "Feature inventory" po stranici/kontekstu
(npr. "Add Activity: Save+, Save as Shortcut, Disable Save+ po Areai, default_value pre-fill...")
— **mora biti dosta detaljno** (korisnikov izričit zahtjev), ne samo lista naziva nego kratak
opis svake mogućnosti i gdje se nalazi/uključuje. Niska žurnost, ali visok prioritet kad se
počne raditi na Help sistemu dalje.

**6. Financije reorganizacija** — srediti strukturu kategorija i atributa u Area "Financije".
   Status S86: `Financije_2` importana u TEST ✅ — 458 eventa (2026-01 do 06), flat L2 struktura,
   svi suggest dropdowni rade. Sljedeće: vizualni pregled podataka, usporedba s originalom.
   Skripte: `data-prep_tools/Financije/make_import.py` (generira xlsx za import)
   ⚠️ Pravilo: AttrType u Structure sheetu = 'text' za suggest (ne 'suggest') → vidi `excel_import_template.py`

**7. Historijska migracija** (poseban projekt, bez vremenskog pritiska)
- `trening.xlsm` analiza — mapiranje kolona i sheetova na trenutni data model
- Import historijskih podataka u finalnu produkcijsku bazu

**8. Plotly bundle size** — vendor-plotly ~4.9MB; prihvatljivo dok performanse nisu problem.

**9. Health tracking Area** — Area "Health" s Lab Results + Medical Visit leaf kategorijama.
   Kontekst: `data-prep_data/Health/HEALTH_SESSION_CONTEXT.md`
   Skripte: `data-prep_tools/Health/make_health_structure.py` + `make_health_events.py` + `health_lab_review.py`
   - ✅ Korak 1 — Struktura importana u TEST bazu (Health > Medical > Lab Results + Medical Visit; 10 attr defs)
   - ✅ Korak 2 — UX verificiran (Add Activity radi)
   - ✅ Korak 3 — `make_health_events.py` generira `Health_events_import.xlsx` (58 eventa iz Bloodwork.xlsx)
   - ✅ Korak 4+5 — PROD deploy (S68): struktura + 58 eventa importani; Area preimenovana u "Health_Saša"
   - ✅ Koka → Read grantee pristup na Health_Saša — potvrđeno S77
   - ⬜ Cleanup — `health_lab_review.py`: čita Health_Saša iz baze, generira review xlsx za razdvajanje Medical Visit bilješki koje su pomiješane u Lab Results commentima

**11. Netlify scheduled maintenance function** — kad se skupi 2-3 zadatka, implementirati
   `netlify/functions/maintenance.ts` s `schedule = "@weekly"`. Kandidati:
   - DELETE orphaned `share_invites` gdje user ne postoji u `auth.users`
     (`DELETE FROM share_invites WHERE status = 'pending' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email = share_invites.grantee_email)`)
   - DELETE stare accepted `share_invites` (> 30 dana)
   - DELETE stare `help_log` zapise (> 90 dana)
   Do tada: pokretati ručno po potrebi.

**10. ~~Save+ toggle po Arei~~** — ✅ **kompletno (S67)**
   `settings jsonb` kolona na `areas` tablici (`sql/017_area_settings.sql`);
   `disable_save_plus: true` flag; `FilterContext` fetchuje area i eksponira `disableSavePlus`;
   `ActivityHeader.tsx` conditionally renderira Save+ gumb; `StructureNodeEditPanel` ima
   checkbox "Disable Save+" u Area edit panelu.
   **Deploy needed:** pokrenuti `017_area_settings.sql` na TEST + PROD Supabase.

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

### E2E testing workflow (Playwright)
- Pokreni testove: `npx playwright test e2e/tests/<spec>.ts --headed`
  ili `npx playwright test --ui` za interaktivni debugger.
  Dev server NE treba zasebni terminal — `playwright.config.ts` ga sam pokrene ako nije aktivan
  (`reuseExistingServer: true`).
- Kada test padne: samo reci "pao E2-X" — Claude čita artefakte direktno iz
  `e2e/test-results/` (screenshot, video, trace). Nema potrebe za copy-paste ili screenshotom.
- **Bug pronađen E2E testom = dokumentira se identično kao manualni bug:**
  - Opis i fix u `CLAUDE.md` → "Done" sekcija (uz sesijsku oznaku, npr. `S51 bugfix`)
  - Ako fix nije odmah napravljen → u "Open bugs" sekciju
  - PENDING_TESTS.md status: ⬜ → ✅ (ili ❌ ako odgođeno)
- **Selektor problem** (test pada, ali aplikacija radi ispravno) → fix samo u spec fajlu,
  ne u aplikacijskom kodu; nije potrebno dokumentirati kao bug.

### End of session (OBAVEZNO)
1. **Update `Claude-temp_R/PENDING_TESTS.md`** — add new tests for everything coded this session;
   mark confirmed tests as ✅; remove tests older than 2 sessions.
   E2E testovi (T-S50-x) idu u istu tablicu kao manualni.
2. **Write detailed test steps in `Claude-temp_R/test-sessions/SXX_tests.md`** — one file per session,
   with numbered steps, preconditions, and expected vs fail behaviour for EVERY new test.
   Update the `Detalji testova:` link in PENDING_TESTS.md to point to the new file.
3. **Update `CLAUDE.md` backlog** — move done items out, add new S24+ items if discovered
4. **Update `docs/help/`** — ako je dodan ili promijenjen bilo koji feature, ažuriraj odgovarajući help fajl.
   `netlify/functions/help.ts` se **ne mijenja** za feature docove — AI čita markdown fajlove dinamički.
   Iznimke koje idu direktno u `help.ts` statički prompt: Demo Area putanje, pravila tona, app framing.
5. **Commit + push test-branch** (nema Netlify deploya, nema troška):
   ```
   git push origin test-branch
   ```
6. **Samo kad je verzija spremna za PROD** — merge na main (Netlify build) + sync back:
   ```
   git checkout main && git merge test-branch --no-edit && git push origin main
   git checkout test-branch && git merge main --no-edit && git push origin test-branch
   ```
   Bez sync-backa `test-branch` zaostaje za `main` (merge commiti ostaju samo na main).

### Test result reporting (next session)
User says e.g. "T-S24-1 OK, T-S24-3 fail" → Claude updates PENDING_TESTS.md accordingly
and investigates failures before coding new features.
For E2E: user says e.g. "pao E2-2" → Claude reads `e2e/test-results/` artefacts directly.
