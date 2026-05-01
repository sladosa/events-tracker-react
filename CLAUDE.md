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
- **UX-2:** Structure tablica ne prikazuje sharing indikatore po redu u All Areas pogledu — backlog
- **BUG-S52-1:** ✅ RIJEŠEN (S53)
- **E7/E8/E9 parallel:** Padaju pri 4 workers (duplicate key na data_shares); prolaze `--workers=1`
- Bulk delete (checkbox) nije ograničen za grantee-a — backlog
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

---

### Backlog — sljedeći koraci (prioritetni redoslijed)

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

**Napomena:** Svaki novi feature uz kod dobiva update `docs/help/` — dodano u End of session checklist.

**6. Financije reorganizacija** — srediti strukturu kategorija i atributa u Area "Financije".
   Status S65: `Za Sašu` 2026 (356 redova) importiran u TEST bazu ✅. Struktura pre-složena
   (19 listova), čeka Kokin feedback za pojednostavljenje (max L2, Vrsta dropdowns).
   Process docs: `Claude-temp_R/Data_preparation/Financije/IMPORT_PROCES.md`
   Prijedlog za Koku: `Claude-temp_R/Data_preparation/Financije/KOKA_STRUKTURA_PRIJEDLOG.md`
   Skripte: `fix_dates.py` (datumi) + `make_import.py` (generira xlsx za import)

**7. Historijska migracija** (poseban projekt, bez vremenskog pritiska)
- `trening.xlsm` analiza — mapiranje kolona i sheetova na trenutni data model
- Import historijskih podataka u finalnu produkcijsku bazu

**8. Plotly bundle size** — vendor-plotly ~4.9MB; prihvatljivo dok performanse nisu problem.

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
4. **Update `docs/help/`** — ako je dodan ili promijenjen bilo koji feature, ažuriraj odgovarajući help fajl
5. **Commit** with descriptive message (e.g. `S24 structure add-area, import fix, blocked leaf`)

### Test result reporting (next session)
User says e.g. "T-S24-1 OK, T-S24-3 fail" → Claude updates PENDING_TESTS.md accordingly
and investigates failures before coding new features.
For E2E: user says e.g. "pao E2-2" → Claude reads `e2e/test-results/` artefacts directly.
