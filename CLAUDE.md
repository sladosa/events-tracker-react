# Events Tracker React — Claude Context

Personal activity tracking web app (fitness, habits, diary) built on an EAV data model
with hierarchical categories, Excel roundtrip as primary bulk workflow, and Supabase backend.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify
**Deploy:** Netlify (main branch only) — GitHub Actions runs typecheck + build on every push
**Current dev branch:** `test-branch` (dev), `main` = PROD (Netlify deploya samo main)

---

## Strategic Position (Decision snapshot — 2026-07-07)

**Misija aplikacije:**
Personal structured memory/decision system over historical data. Purpose: convert unstructured Excel (Financije, Zdravlje, Diary) into queryable, analysable data. Later: AI intelligence layer that surfaces insights/patterns for decisions.

**Collab status:**
- S38–S41 implemented all D1–D10 decisions (Share Management modal, User column, Avatar, permission-aware ⋮ menu)
- **D9 pending:** Excel User column — verify current logic (always in FIXED_COLUMNS, collapsed by default) matches desired behaviour for shared Areas
- **Technical threshold:** Done enough for 1–2 person shared areas (Financije, project) *after E7/E8/E9 race fix*
- **NOT expanding further** until historical ingestion pipeline is complete

**Supabase stance:**
- NO architectural pivot now — query/pattern optimization suffices
- categoryCache (S105) is template for further optimizations
- Upgrade plan if perf becomes real problem
- Local Postgres (ownership) is post-S110+ idea

**Work priorities (S106–S108):**
1. **S106 (tight scope):** E7/E8/E9 race condition fix (idempotent createShare model), D9 verify, smoke test E2/E3/E4/E14
2. **S107 (parallel):** Financije historical pipeline — export both areas, audit, Python Tip/Podtip classification, re-import, spot-check; Diary archaeology non-blocking
3. **S108+:** AI/intelligence layer (success criteria)

**Why historical ingestion is next priority:**
Without Financije/Zdravlje/Diary data flowing in, app is shell-only. Collab is stable-ish; ingestion unlocks the actual purpose. Historical data also feeds AI layer.

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
- **Excel Data Validation `promptTitle`/`prompt` limiti:** `promptTitle` ≤32 znaka, `prompt` ≤255 znakova — premašivanje generira neispravan OOXML i Excel javlja "We found a problem with some content" + nudi repair. Provjeri duljinu (`string.length`) prije dodavanja/proširivanja input-message teksta na bilo koju ćeliju (vidi `excelUtils.ts` Filter sheet).
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
- Collab UX Design (S35): `docs/COLLAB_UX_DESIGN_v1.html` — wireframe dizajn za sve collab scenarije (Owner, Grantee write/read, Share Management, User indicator, Excel format, Request access flow); D1–D10 odluke (vidi `Claude-temp_R/OLD/COLLAB_UX_DESIGN_decisions.txt`) — praktički sve implementirane kroz S38–S40 (Add Activity disabled za read grantee, Share Management modal, avatar+ime prikaz, ⋮ meni samo View na tuđim eventima, Export dostupan read granteeu, Profile settings modal, User kolona = email u Excelu); D9 (User kolona uvijek vs. samo za shared Areas) — provjeriti odgovara li trenutni Excel export ponašanju koje želimo (kolona je u `FIXED_COLUMNS` uvijek, ali grupirana/collapsed po defaultu)
- Collab Faza 5 (S36): `SharedContext` proširen s `ownerEmail`+`ownerDisplayName`; `fetchAreaGrantees` helper; `src/components/sharing/SharedAreaBanner.tsx` — 3 varijante bannera (owner purple, write grantee green, read grantee amber); integrirano u `AppHome.tsx` (Activities + Structure); `CategoryChainRow` — role-aware ⋮ menu (grantee: owner info + copy email + request access; owner: + Manage Access placeholder)
- Collab bugfixes (S37): `fetchAreaGrantees` — FK join na `profiles` zamijenjen s dva odvojena querija (FK je bio na `auth.users`, ne `profiles`); `ViewDetailsPage` — uklonjen `user_id` filter koji je blokirao Prev/Next navigaciju na tuđim eventima
- Collab Faza 6 (S38): User kolona u Activities listi — Avatar (inicijali + hash boja) + "You" badge za vlastite / ime za tuđe; `areaHasActiveShares` u `FilterContext` (owner view); `user_id`+`user_display_name` u `useActivities` (batch profile lookup); D1 — Add Activity disabled za read grantee (tooltip + toast); D4 — ⋮ menu samo View za tuđe evente
- Collab bugfixes + testiranje (S39): RLS `categories_select` bug — koristio `categories.user_id` umjesto area ownership → `009_sharing.sql` fixed; `canAddActivity` nije blokirao read grantee na leaf → `AppHome.tsx` fixed; leaf/non-leaf hint prikazivao se za read grantee → `ProgressiveCategorySelector.tsx` + `AppHome.tsx` fixed; ViewDetailsPage `isOwnEvent` — Edit Activity gumb sakriven za tuđe evente; `fetchSharedContext` guard `.neq('owner_id', userId)` dodan
- Collab Faza 7 (S40): `src/components/sharing/ShareManagementModal.tsx` — 3 sekcije (active access + pending invites + invite form) + help text; 3 entry pointa: (1) `🔗 Manage Access` badge u filter baru (`areaHasActiveShares`), (2) `⚙ Manage Access` u Structure OwnerBanneru, (3) `Manage Access` u CategoryChainRow ⋮ meniju; `StructureTableView` dobio `onManageAccess` prop; `AppHome.tsx` drži `shareModalTarget` state
- Collab bugfixes + inline permission dropdown (S41): `CategoryChainRow` — "Manage Access" izvučen iz `isEditMode` guarda (uvijek vidljiv za ownera); `useDataShares.listShares` — FK join zamijenjen s dva odvojena querija (isti pattern kao `fetchAreaGrantees`); `createShare` — upsert s `onConflict` umjesto INSERT (sprječava duplikate, update permission); nova fn `updateSharePermission`; `ShareManagementModal` — inline `<select>` dropdown za read↔write na aktivnim shareovima; DB: unique constraint `data_shares_unique_share`
- **S104 — Fable critical findings (arh. ispravke + Diary prerequisit):**
  - **Delete Activity bug fix** (Fable I.1): `AppHome.tsx handleDeleteActivity` sad prima `leafCategoryId` i briše samo `category_id = leafCategoryId OR chain_key = leafCategoryId` — prije je brisao SVE evente s istim `session_start`, uništavajući druge aktivnosti dodane u isto vrijeme (T-BUGG-5 klasa buga)
  - **Parent event write logika ekstrahirana** (Fable I.2): `parentEventLoader.ts` dobio `findParentEventByChain()` + `upsertParentEvent()` — single source of truth za sva 4 mjesta (AddActivityPage, EditActivityPage, excelImport.ts create+update). Hibrid ponašanje: P2 anchor UVIJEK kreiran (čak i s 0 atributa, po uzoru na Add flow), P3 attribute write kroz per-attribute upsert (po uzoru na Import flow — fixa EditActivityPage-ov stari delete-all-then-reinsert koji je mogao izbrisati ne-praznu vrijednost kad korisnik očisti polje)
  - **Bugfix pronađen kroz testiranje:** `canFinish` u `AddActivityPage.tsx` nije čekao da `categoryChain` završi loading — brzi klik na Finish je spremao leaf event bez parent chain-a (P2 anchor tiho preskočen). Fix: `canFinish` sad uključuje `!chainLoading`.
  - **BUG-S102-DELETE fix**: `StructureDeleteModal` — live COUNT query (`liveEventCount`) prije `isBlocked` odluke; "Delete" gumb disabled dok recount ne završi (`countChecked`)
  - **Q2**: `useMemo` na `FilterContext` value objekt (`FilterContext.tsx`)
  - **Q3**: batch `event_attributes` INSERT u `excelImport.ts` (CREATE + UPDATE tok) umjesto sekvencijalnih poziva
  - **Q4**: import progress bar (`onProgress(done, total)` kroz `applyImportChanges` → `ExcelImportModal`)
  - **Q5**: ILIKE wildcard escaping (`%`, `_`, `\`) u `eventQueryBuilder.ts` (comment search + attr filter)
  - **Q6**: dead code cleanup — `useLookupValues` (referencirao nepostojeću `lookup_values` tablicu), `DEBUG_ENABLED` logging sustav u `useActivities.ts`, dupli neiskorišteni `src/pages/useActivities.ts`
  - **Testovi**: 3 nova Playwright E2E testa (`S104_delete_bug.spec.ts`, `S104_parent_event.spec.ts`, `S104_import_progress.spec.ts`) — svi passing; puni regresijski E2 + E3 + E6 set re-testiran, bez regresije
- **S105 — PROD incident triage + IO redukcija (2026-07-06):**
  - **Incident**: View/Edit Activity na PROD-u padao s 500 (`57014 canceling statement due to statement timeout`) na `event_attributes`/`event_attachments`; čak i mali `categories` upiti 9–13 s. Dijagnoza: **instance-level gušenje** (Supabase kapacitetni incident za manje compute tipove + free tier Nano), NE S104 refaktoriranje i NE nedostajući indeksi (indeksi 024/031/032 primijenjeni na PROD; IOPS graf <1 op/s). Disk IO email iz lipnja = import-teški dani, ne trajno stanje.
  - **`src/lib/categoryCache.ts` (novo)**: module-level keš cijele `categories` tablice + area imena; invalidacija na `areas-changed`/`structure-deleted` CustomEvent + TTL 5 min. Koriste ga `activityViewCache._buildCategoryChain`, `parentEventLoader.buildParentChainIds` (više ne hoda upit-po-razini!) i `EditActivityPage.buildCategoryPath`.
  - **Batch attrs/attachments load**: `activityViewCache` + `EditActivityPage` — 2 upita ukupno (`.in('event_id', [...])`) umjesto 2 po eventu (7-event sesija: 14 → 2). View sad **baca grešku umjesto tihog prikaza praznih atributa** (500 na attrs više ne izgleda kao "nema podataka").
  - **Batch `loadParentAttrs`**: parent eventi svih razina u 1 upitu (chain_key) + 1 legacy fallback (chain_key null, točno-1-kandidat pravilo po kategoriji) + 1 upit za sve parent atribute — umjesto 2–3 upita po razini. Disambiguation semantika identična `findParentEventByChain`.
  - **Ukupno**: otvaranje 7-event aktivnosti ~35+ upita → ~8; Prev/Next prefetch više ne povlači categories full-table svaki put.
  - **`sql/032_event_attachments_index.sql`**: indeks na `event_attachments(event_id)` (FK bez indeksa); primijenjen na PROD zajedno s 024 + 031; **dupli indeksi droppani na PROD-u** (`idx_event_attr_event_id`, `idx_event_attr_def_id` — dupli od 024 verzija).
  - **E2E selector fixes (ne bugovi)**: e4 + e14 — `/prev|next/i` kolizija s AI Help chipom "What does Prev/Next do?" → egzaktna imena `'◀ Prev'`/`'Next ▶'`; e14 `isNavigationFetchFor` sad isključuje po `chain_key=` paramu (batched parent upit ima zarez u selectu pa stari "select=id bez zareza" prečac više ne diskriminira).
  - **Testovi**: E2, E3, E4, E14, T-S104-2 svi passing (`--workers=1`).
  - **PROD checklist**: Postgres upgrade na ≥17.6.1.121 (Settings → Infrastructure) — napraviti KAD Supabase incident bude Resolved; seli na novije instance tipove. Advisor "Security Definer View" (`category_full_paths`, iz 016) — riješiti s `security_invoker = true` u nekoj sesiji.
- **S105b/c — error handling hardening (2026-07-06, samo test-branch od S105c):**
  - **S105b**: `activityViewCache` — null (greška) se više ne lijepi u LRU (`_dropIfNull`); transient 500 je prikazivao trajni "Activity not found" do reloada
  - **S105c**: `EditActivityPage` batch attrs/attachments load — `throw` na error umjesto tihog praznog forma (T-S105-2 prvi pokušaj imao 7 evenata s praznim atributima; **Save iz takvog stanja može pregaziti prave vrijednosti — P3 rizik**); isto `loadParentAttrs` (sva 3 upita) — greška se propagira do loadError/retry umjesto praznih parent atributa
  - Backlog ideja (Saša): Edit bi mogao seedati iz View cachea umjesto refetcha — odbijeno za sada radi svježine podataka pri pisanju (mobitel/shared user mogu promijeniti podatke između View i Edit); kandidat: seed-from-cache + background revalidate
- **S105d — BUG-SLUG-NORMALIZE fix (2026-07-06, samo test-branch):**
  - **Bug**: `StructureNodeEditPanel` save je BEZUVJETNO normalizirao slug svih atributa (regex briše crtice: `strength-type` → `strengthtype`) pri svakom Save-u panela, uklj. običan rename kategorije; fixup depends_on referenci se preskakao jer je uspoređivao user-input (nepromijenjen), ne stvarno zapisani slug → depends_on ostane na nepostojećem slugu, dependent dropdown siv ("Select X first...") u Add i Edit
  - **Fix**: slug se normalizira samo ako ga je korisnik stvarno mijenjao; `slugChanged` se računa iz stvarne promjene (novi vs original) pa fixup referenci sada pokriva i normalizaciju; `areas-changed` se dispatcha nakon SVAKOG structure save-a (ne samo Area) — invalidira categoryCache za breadcrumb nakon rename kategorije
  - **PROD data repair (service role, 2026-07-06)**: `exercise_name.depends_on` `strength-type`→`strengthtype` (slomljeno današnjim rename testom); `Broj rata.depends_on` `na_rate`→`rate` (Financije b4cd5a81, slomljeno ranije istom klasom buga). Scan: 0 preostalih polomljenih referenci (108 attr defs).
  - ~~OPREZ dok fix ne dođe na PROD~~ — ✅ fix je na PROD-u (bio uključen u raniji deploy; stanje potvrđeno deployem 2026-07-15 kad je main dostigao test-branch)
- **S106 — E7/E8/E9 test harness race condition fix (2026-07-07):**
  - **Problem**: `test.beforeAll` u E8/E9/E10/E15 padali pri `--workers=4` s `duplicate key on data_shares_unique_share` — concurrent REST INSERT bez upsert logike
  - **Root cause**: Test harness issue, ne app bug. App code (`useDataShares.createShare`) već je imao `upsert` s `onConflict`. Problem je bio samo u `supabasePost` helper (obična INSERT)
  - **Fix**: `supabaseUpsert` helper u `e2e/fixtures/auth.ts` koji koristi Supabase JS SDK `upsert` s `onConflict` (admin client ako dostupan, fallback REST merge-duplicates). Ažurirani testovi: E8, E9, E10, E15
  - **Rezultat**: E8-1, E9-1/2/3, E10-1/2/3 svi PASS na --workers=1. Race condition eliminiran na test-harness nivou.
  - **E7/E8-2 odvojeni problemi**: E7-2/E7-3 (Toast "Access granted" missing) — backlog UX polish; E8-2 (Area select timeout) — novi open bug (vidi dolje)

### Open bugs (main)

- **BUG-1:** `useFilter must be used within a FilterProvider` na `AppHome.tsx:105` — vjerojatno StrictMode artefakt, nizak rizik
- **E8-2 Area select timeout (RLS/loading issue):** E8 grantee-write test padne na timeout (30s) pri `selectOption` na Area dropdown — element je disabled (vjerojatno RLS filter ili loading problem). Potencijalno isti family kao BUG-S103-ANYATTR (RLS + kolaboracija). Trebam detaljniju RLS/loading analizu.
- **Bulk delete (checkbox) nije ograničen za grantee-a** — backlog
- **BACKLOG — "Import as mine" za write grantee unutar iste shared aree nema smisla:** Pravi put je Leave Area (Detach with data) ili normalan re-import u novu vlastitu area; flag samo, nije implementirano.
- **BUG-S103-ANYATTR:** "In any attribute" filter (`ATTR_FILTER_ANY` u `eventQueryBuilder.ts`) timeouta za grantee-e — `ILIKE` nije leakproof operator, Postgres evaluira RLS EXISTS za cijelu `event_attributes` tablicu. Privremeno: amber notice u UI (`AppHome.tsx` kad `sharedContext` aktivan + `selectedFilterAttr === ATTR_FILTER_ANY`). Pravi fix: SECURITY DEFINER RPC — **odgođeno za S105+** (procjena 4-6h, vidi docs/FABLE_PLAN.md I.5).

~~BUG-S102-DELETE~~ — ✅ Riješeno S104 (live recount u `StructureDeleteModal.tsx`).
~~UX-Import-1~~ — ✅ Riješeno S104 (progress bar, Fable Q4).

### S106: E7/E8/E9 race condition fix + test modal flows ✅ DONE (2026-07-07)

1. **Race condition FIX** ✅ — `supabaseUpsert` helper (admin client onConflict + merge-duplicates fallback); E8/E9/E10/E15 tests updated
2. **Test modal fixes** ✅ — E10-2: confirm revoke dialog; E7-2/E7-3: dismiss email modal before expecting toast
3. **Result** ✅ — E8-1, E8-2, E9-1/2/3, E10-1/2/3 ALL PASS; E7-2/E7-3 have app toast logika issue (backlog)
4. **Typecheck + build** ✅ — clean state

### S107: Historical Financije pipeline — IN PROGRESS (2026-07-09)

**Sve odluke donesene** (D1/D1a/D2/D6–D9) — vidi `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` §4.
Ključne: nova area **`Financije_all` (owner = Koka!)**; novi Tip `Namirnice`/`Hrana i ostalo`;
event_date = datum kupovine + `Datum naplate`/`Datum kupovine` atributi; auto default C5; Stanje se prepisuje.

**Done ove sesije (2026-07-09):**
1. **row_hash skip + update-guard (D7)** ✅ — `src/lib/excelFingerprint.ts` (novi shared modul,
   FNV-1a 64 fingerprint normaliziranih vrijednosti); export piše `row_hash` kolonu (iza attr kolona,
   UNUTAR autofiltera da sort nosi hash s redom, collapsible); import preskače nedirane redove BEZ
   ijednog DB poziva (`untouchedCount` u ParseResult); `analyzeUpdates()` dry-run diff (staro→novo po
   polju, batch fetch po 200); **update-guard u `ExcelImportModal`**: crvena lista promjena + checkbox
   koji otključava Apply (anti "yes-to-all") + warning za zapise starije od 30 dana. Stari exporti bez
   kolone rade kao prije (bez skipa, guard i dalje aktivan). `hasChanges()` refaktoriran kao wrapper
   oko `computeRowDiff()` (single source of truth).
   Testovi: novi `e2e/tests/S107_row_hash_guard.spec.ts` (T-S107-1/2 PASS); T-S104-3 spec ažuriran
   (progress total sad bez untouched reda) PASS; E6 PASS; typecheck+build čisti.
2. **`normalize_financije.py`** ✅ — `data-prep_tools/Financije/`; čita 3 sheeta `Financije 2026.xlsx`,
   unified itemized model (D1 datumi, D9 Stanje, rate X/N parse), Za Sašu label-matching (datum ±2 dana
   + iznos → 169 labela), rules-first klasifikacija → **review Excel** (`Financije_review_*.xlsx`):
   dependent Tip→Podtip dropdowni u čistom xlsx (INDIRECT + named ranges; **DV formula mora biti <255
   znakova** — SUBSTITUTE lanac samo za znakove koji postoje u Tip imenima), CF mismatch crveno /
   N/A žuto, sheets Problemi (259) / Statistika / Pomoć. 3503 reda (Koka 2636 + Saša 867).
   **⚠ Data gap otkriven:** 82% Kokinih Mastercard redova (2023–2025-06) NEMA opis → Tip=N/A,
   pouzdanost NEMA (2104 redova); Za Sašu labele pokrivaju samo 2025-07+. Treba odluka Saša/Koka.

**Done 2026-07-10 (S107b — Faza 2b set_attribute + Automations Excel roundtrip):**
1. **D1 dopuna odlučena:** `Datum naplate` NIJE opcionalan — auto-fill po Izvoru (v. FINANCIJE_MIGRACIJA.md §12).
   **Postepena migracija odlučena:** prvo 2026 redovi, starija povijest gradualno; struktura+taksonomija
   kompletne od prvog importa. **Taksonomija sheet** dodan u review Excel
   (`Financije_review_20260710_1448.xlsx`) — editabilni izvor Tip/Podtip parova, pipeline korak 4 ga čita.
2. **Faza 2b `set_attribute` automatika** ✅ — `src/lib/attributeRules.ts` (evaluateDateRule
   `same`/`next:N`, computeSetAttributeValue, findDefBySlug); `AttributeRuleConfig` u `database.ts`
   (`AreaSettings.automations.attribute_rules`); live-prefill useEffect u `AddActivityPage` —
   `autoFilledValues` ref pamti zadnju auto-vrijednost po atributu (ručni unos se NIKAD ne gazi);
   **VAŽNO:** sve odluke/ref mutacije IZVAN setState updatera (StrictMode ga zove 2×, prvi pokušaj
   s mutacijom u updateru je gubio update — uhvaćeno T-S107b-1 testom).
3. **Automations sheet u Structure Excel roundtripu** ✅ — export (`structureExcel.ts`
   `writeAutomationsSheet`): kolone Area|RuleName|Action|TargetAttr|MapAttr|DateMap, format
   `Mastercard=next:11 | Racun=same`, help blok; import (`structureImport.ts` §9): replace-per-area
   semantika, validacija slugova+DateMap sintakse, nevaljani redovi → "Automation rules skipped";
   `ImportResult.automations` + prikaz u `StructureImportModal`; §8 fix: comment_template update sad
   osvježava in-memory settings (da ga §9 ne pregazi starim snapshotom).
4. **Testovi:** novi `e2e/tests/S107b_set_attribute.spec.ts` (T-S107b-1/2 PASS, self-contained area);
   regresija E2, E5 (svih 5), E6 (3), T-S104-2, T-S107-1/2 sve PASS. **E5-4/E5-5 selector fix**
   (pre-existing, ne app bug): item preimenovan u "+ Add Leaf" + ⋮ meni se zatvara na scroll pa ga je
   Playwrightov auto-scroll odmah zatvarao → `clickRowMenuItem()` retry helper u specu.
5. Typecheck + build čisti. Direktorij `data-prep_data/Financije/izvodi/` kreiran za PDF e-izvode
   (enrichment plan u FINANCIJE_MIGRACIJA.md §12.5).

**Done 2026-07-13 (S107d — svi Kokini izvodi + inventory pipeline):**
1. **`inventory_izvoda.py`** (novo) — 117 Kokinih PDF-ova (generička download imena): md5 dedup
   (6 duplikata → `izvodi/duplikati/`), klasifikacija po SADRŽAJU (ne imenu), parse, rename
   `PREFIX_YYYY-MM.pdf` → `izvodi/Analizirani_izvodi/`, piše `izvodi/Izvodi_transakcije.xlsx`
   (Transakcije 3182 tx + Manifest 117; report pokrivenosti s rupama). Idempotentno, `--dry`.
2. **MC + PBZ Visa parseri** u `enrich_from_izvoda.py` — "Obavijest o učinjenim troškovima" =
   ZABA MC izvod KARTICE koji je ENRICH_PLAN čekao (29 izvoda/1062 tx); neočekivano stigla i
   PBZ Visa Gold (31/1539 tx; obje kartice imaju i Sašinu dodatnu → `[kartica: SAŠA]` tag u opisu).
   Parsiranje verificirano u cent vs UKUPNO na dokumentima. Enrich sad čita Izvodi_transakcije.xlsx
   (fallback: PDF-ovi po prefixu) i piše `Nematchano` sheet (transakcije kojih NEMA u Review).
3. **Nalazi (enrich --dry na kopiji Review filea):** 1429/3182 match; 938 od 2218 N/A redova
   dobiva `Izvod opis` (MC 89%, ZABA 83%); **PBZ Visa 1/1539 — Koka te kupovine uopće ne vodi
   u Excelu** (nema Izvor='Visa' za Koku) → odluka pending; 2023. N/A masa slabo pokrivena
   (MC izvodi tek od 2024-01). Rupe u izvodima: MC 2026-05, ZABA 2024-07/08.
4. **D1 header Review filea bio pregažen** slučajnim pasteom (`run.bat sync_taxonomy.py` umjesto
   `Smjer`; podaci u koloni netaknuti) — `enrich_from_izvoda.py` dobio auto-repair (prepozna
   kolonu po Uplata/Isplata podacima) i popravio ga na pravom runu.
   Detalji + koraci: `data-prep_tools/Financije/ENRICH_PLAN.md` + FINANCIJE_MIGRACIJA.md §12.7.
5. **RF OCR pipeline (`rf_ocr.py`, isti dan):** Sašini Raiffeisen izvodi nemaju tekst-sloj →
   pypdfium2 render 300 DPI + RapidOCR **po horizontalnim trakama** (full-page OCR tiho gubi
   retke!) + **stanje-chain validacija** (svaki red vs tekuće stanje; sumnjivi → `[OCR?]`, 9/246).
   Inventory: NOTEXT → OCR klasifikacija; **md5 keš** (OCR se plaća jednom, ~25 s/str.); dedup i po
   SADRŽAJU transakcija (RBA daje druge bajtove pri svakom downloadu — `2026-5.pdf`==`2026-6.pdf`!);
   RF imenovanje po mjesecu PRVE transakcije (RBA period sredina→sredina mjeseca).
   `propusteno_Koka/` rupe uključene (MC 2026-05, ZABA 2024-07/08). **ENRICH IZVRŠEN na Review:
   1707/3501 match, 1069 od 2221 N/A redova pokriveno** (Koka MC 974 + Racun 516, Saša RF 217,
   RF match 88%). Jedina preostala rupa: RF 2026-05; MC prije 2024-01 ne postoji u e-bankarstvu.

**Done 2026-07-14 (S107e — recovery pass + kompletna pokrivenost + finalni enrich):**
1. **`rf_ocr.py` recovery pass testiran i izvršen** (chain-break → re-OCR uskog y-pojasa,
   red se umeće samo ako savršeno popravlja chain): svih 6 očekivanih redova ubačeno
   (RF_2024-11: +225.34, −100.00, **+984.78 MACGREGOR plaća**; RF_2024-12: +47.78, −2.39;
   RF_2025-02: −150.00), 0 novih flagova. `[OCR?]` flagovi **9 → 1**.
2. **RBA_2026-05 (Saša skinuo)** → inventory ga klasificirao/OCR-ao → `RF_2026-05.pdf` →
   **RF pokrivenost bez rupa** (2024-09→2026-06). Zadnji `[OCR?]` (1282.79) — Saša potvrdio
   na dokumentu: PBZ Card/Visa Gold lump 05.06.2026 → ručno upisan u Transakcije+Review;
   **0 flagova preostalo**.
3. **Finalni enrich re-run: 3519 tx; 1725/3519 match; 1075/2219 N/A redova pokriveno**
   (MC 778, Koka Racun 177, Saša RF 120). Nematchano 1794 (PBZ Visa 1538).
   Backup: `*.pre-izvod-20260714_145329.xlsx`.
4. **Dorade `apply_rules.py` ✅ IMPLEMENTIRANE + TESTIRANE** (na kopiji Review filea):
   `Tip_O`/`Podtip_O` jednokratni snapshot; validacija protiv Taksonomije (nepostojeći par →
   reset na N/A + `TAKS:` oznaka; VISOKA klasifikacije s valjanim parovima se čuvaju);
   `Napomena` output kolona u Pravila sheetu (P3 — puna se ne gazi); `--all` report mod.
   **--dry nalaz: 196 redova hvata validacija** (Sašina preimenovanja podtipova: T-com/T-mobile
   81×, Sport/Medical/PassSport/PP 76×, izbačeni streaming podtipovi 33×…). Pravila sheet
   kreiran (5 kolona); pravi run čeka pisanje pravila sa Sašom. Detalji: ENRICH_PLAN §3.2.
   Zamka openpyxl: `cell(r,c,None)` ne briše — mora `.value = None`.
5. **Zamka: cmd/run.bat guši zarez u argumentima** (`--reparse A,B,C` → samo A) — reparse
   pokretati jedan substring po pozivu.
6. **Autofilter Review sheeta proširen na sve kolone (A1:V)** + enrich/apply_rules ubuduće
   sami proširuju filter kad dodaju kolone (kolona izvan filtera se pri sortu raspari od reda!).
7. **`Datum naplate` analiza:** prazan kod Racun 1630 / Visa 220 / Cash 1. Odluka: Racun/Cash
   backfill = event_date (D1; čeka Sašinu potvrdu); **Visa NE** — puni se pri import generaciji
   (`next:N` ili stvarni datumi RF lump isplata iz Izvodi_transakcije.xlsx).
8. **Audit nalaz za Koku:** Review 2025-11-26 Isplata 700€ (Racun) ne postoji na ZABA izvodu
   (bankomat 11-12/2025: 100+150+100+200) — pitati Koku.

**Done 2026-07-15 (S107f — backfill + Preimenovanja + UI fix; detalji ENRICH_PLAN §2d):**
1. **`Datum naplate` backfill IZVRŠEN** — `backfill_datum_naplate.py` (novo): 1631 redova
   (Racun 1630 + Cash 1) = event_date; Visa 220 namjerno preskočena. Saša sam pokrenuo
   `sync_taxonomy.py` (dropdowni prate novu Taksonomiju).
2. **`Preimenovanja` sheet u `apply_rules.py`** — nevaljan Tip/Podtip par se PREIMENUJE
   u novi (VISOKA Pouzdanost se ČUVA, `PREIM:` marker) umjesto reseta na N/A; `Racun uvjet`
   kolona = per-osoba split (kokin/sasin). Auto-kreira se pred-popunjen s prijedlozima
   (substring match kandidata; 2 kandidata koka/sasa → 2 reda s uvjetom). Test na kopiji:
   135 preimenovano + 61 reset = 196 ✓. Sheet u pravom fileu — Saša popunjava 4 para
   (T-S107f-2). `pick_file` sad ignorira sve `.pre-*` backupe.
3. **PBZ Visa odluke (Saša):** 1538 tx DODATI kao nove retke; lump → Transfer; Datum naplate
   iz PBZ PDF-ova; osoba = per-osoba Podtip. **KLJUČNO: Kokina PBZ Visa se skida sa SAŠINOG
   RF računa** (MC obje s Kokinog ZABA) → `[kartica: SAŠA]` tx vjerojatno matchaju postojeće
   Sašine Visa retke → enrich treba PBZVISA split po Kartica koloni (objašnjava 1/1539 match).
   Kandidati dizajn: kolona `Izvod kandidat` U Review (kontekst!) + reconcile report po
   računu × mjesecu.
4. **UI fix — shortcut/skriveni atributi (`AttributeChainForm.tsx`):** atribut o kojem ovisi
   VIDLJIVO polje više se ne skriva na defaultu (Strength_type + exercise_name slučaj);
   kategorija sa svim atributima na defaultu pokazuje poruku umjesto praznog panela
   ("izgledalo kao da se Activity neće otvoriti"); stringovi prevedeni na engleski
   ("N fields hidden (at default)" / "Show all" / "Hide fields at default").
   Typecheck+build čisti; manualni test T-S107f-3.
5. **PROD DEPLOY izvršen 2026-07-15** (Saša zatražio): E2E regresija 12/12 PASS prije deploya
   (E2, E3, E6×3, T-S104-2, T-S107-1/2, T-S107b-1/2), zatim merge test-branch → main
   (fast-forward `b343815..cdbdff9`) + sync back. Na PROD otišlo: S107 row_hash+update-guard
   (D7 — preduvjet za Financije import!), S107b set_attribute automatika + Automations sheet,
   S107f UI fix. Help docs (activities.md, structure.md) ažurirani za novo ponašanje.

**Done 2026-07-16 (S107g — prvi pravi apply_rules run + Pravilo/Preimenovanja prioritet;
detalji ENRICH_PLAN §2e, sesija PRATNJE — Saša radio, Claude vodio kroz testove):**
1. **T-S107f-1 potvrđen OK** (Datum naplate backfill kontrola); Preimenovanja sheet
   pregledan — 2 auto-prijedloga bila pogrešna prije runa (PassSport kokin/sasin smjer +
   Medical razmak/donja_crta mismatch s Taksonomijom; Taksonomija imala i duplikat
   `Sport_Koka` bez `Sport_Sasa`) — sve ispravljeno prije prvog pravog runa.
2. **`Pravilo run` kolona (novo)** — timestamp na svaki red koji zadnji `apply_rules.py`
   run promijeni; filtrabilan audit trail (traženo od Saše: "da mogu provjeriti što sam
   ispravio").
3. **PRVI PRAVI RUN**: 196 preimenovano, 0 reset, 217 pravilo-klasificirano (7 pravila:
   temu/bolt.eu/konzum/bauhaus/prime video/skyshowtime/google*youtube). N/A 2218→2000.
4. **Nalaz: blanket Preimenovanja rename može pogoditi preširoko** kad stara kategorija
   miješa različit sadržaj — `Zdravlje/Sportski rekviziti` (29) zapravo Multisport+Kreatin+
   Decathlon. Fix: `fix_sportski_rekviziti_split.py` (one-off). Isti obrazac, drugi uzrok:
   Kokin originalni T-com/T-mobile label krivo upisan na 2 retka (Izvod opis otkrio) —
   `fix_tcom_tmobile_swap.py` (one-off).
5. **Arhitekturna promjena u `apply_rules.py` (trajno):** prioritet za invalid-par retke
   sad je **Pravilo (ako pogađa) > Preimenovanja rename > reset** — specifičnije keyword
   pravilo automatski nadvladava preširoki blanket rename ubuduće (Saša predložio nakon
   Sportski rekviziti nalaza). Testirano sintetički, 0 efekta na pravi file (nema više
   invalid parova).
6. **Nevenka Pavić uplata** (red 2436) ručno klasificirana: `Ostali prihodi` (bez Podtipa,
   isti obrazac kao "Uplata mama"/"Nataša povrat"), pravilo nije napravljeno (samo 1 pojava).
7. **Split-workbook prijedlog** (Taksonomija/Pravila/Preimenovanja → zaseban file za lakši
   side-by-side rad) — diskutirano i tehnički potvrđeno izvedivo, ali ODGOĐENO na Sašin
   zahtjev (prvo par krugova pravila s novom kolonom, pa eventualno split).

**Done 2026-07-17 (S107h — drugi krug Pravila + Iznos min/max novi feature; detalji
ENRICH_PLAN §2e/§3, test-sessions/S107h_tests.md):**
1. **Code review novih Pravila redova PRIJE runa** (Saša ih sam dodao) — našao 2 stvarna
   bug-a: `*osiguranje*`/`*porez*` zvjezdica se tretira doslovno (nije wildcard, kao
   `google*youtube` koji radi jer Google stvarno ispisuje literalnu zvjezdicu) → 0 pogodaka;
   `APPLE.COM` → Podtip "Apple" ne postoji u Taksonomiji → pravilo bi bilo preskočeno.
2. **`Komentar` → `Alternativa` dopisivanje (novo, trajno u `apply_rules.py`)** — kolona
   je postojala ali se nikad nije čitala; sad se, ako popunjena, dopisuje uz keyword marker
   u Alternativa/nap. koloni Reviewa — sigurno mjesto za "TODO razdvoji po X" bilješke za
   kasnije filtriranje, bez diranja pravog `comment` polja (Napomena kolona to hrani).
3. **Novi `Iznos min`/`Iznos max` uvjet (novo, trajno u `apply_rules.py`)** — opcionalni
   stupci u Pravila; pravilo pogađa samo ako je Isplata/Uplata reda unutar raspona. Otkrio
   da je APPLE.COM (60 redova) zapravo iCloud pretplata (2 price-point clustera), NE
   "Zabava" → `Informatika`/`Cloud backup`; razdvojio AUDIBLE na Audible_Koka/Sasa po
   pragu 10€ (Koka: Sasin je skuplji, jasan gap u podacima).
4. **Osiguranje/Allianz/Generali/Triglav redizajn (Koka odluke)** — sve ide u POSTOJEĆE
   kategorije, Taksonomija combined-bucket placeholder obrisan: Allianz (auto, nesigurno
   koji auto) → `auto C5`/`registracija` blanket + eksplicitno označeni red → `auto
   Lacetti`/`registracija`; Generali (kuća) → `Domaćinstvo`/`Popravci, održavanje,
   osiguranje`; Triglav (životno, "prošlost") → `Osiguranje`/`Osiguranje` (generic).
5. **`update_pravila_s107h.py` (novo, one-off)** — Claude je na Sašin zahtjev direktno
   regenerirao cijeli Pravila body (AMAZON maknut — 2 retka, cijena ne odgovara Prime
   pretplati; APPLE.COM/AUDIBLE split); idempotentan, auto-backup.
6. **Pravi run #2: 294 redova, +46 Napomena. N/A 2000→1706.** Sve programske kontrole
   prošle (Audible threshold 0 kršenja, Pravilo run timestamp count, Napomena fill count).

**Done 2026-07-20 (S107i — PBZ Visa merge u Review + reconcile/Problem dijagnoza; detalji
ENRICH_PLAN §2g, test-sessions/S107i_tests.md):**
1. **`merge_pbzvisa.py` (novo):** 1538 PBZ tx → dedup **187** (TAG-AGNOSTIČKI — Kartica tag ≠ osoba,
   Saša bilježio kupovine s obje kartice: 121 njegovih redaka nosi Kokinu karticu!) → **1351 novih
   redaka** (Koka 895, SAŠA povijesne 424, lump 32). **Odluka 2a (Saša): BEZ person-splita** — svi
   Racun=Sašin RF, Izvor=Visa, osoba samo kroz Podtip; Kartica kao audit trag u `Izvor reda`
   (`PBZ Visa:Koka/SAŠA/lump`). Lump `PRIMLJENA UPLATA`→Transfer/izmedju racuna; RATA→Rate?=DA+Broj rata.
   **Opcija B sort:** cijeli Review presortiran po event_date (0 padova), stil s Visa template reda,
   DV Tip/Podtip prošireni `J2:J4856`/`K2:K4856`, autofilter na sve. Idempotentno (source_key skip).
   Review **3504→4855**; `Sašin RF|Visa` 220→1571. Backup `pre-pbzvisa-20260720_110952`.
2. **apply_rules run:** 257 novih N/A klasificirano besplatno (konzum 230, bauhaus 16, parking 10) +
   246 Napomena. Backup `pre-rules-20260720_111111`.
3. **`reconcile_izvoda.py` (novo):** coverage izvod→Review + `Nematchano_v1` freeze + `Nematchano_v2`
   s **`Problem` kolonom** (Smjer?/nedostaje/možda-u-Reviewu/kartična) + `Coverage`, u
   `Izvodi_transakcije.xlsx` (backup `pre-reconcile-20260720_123953`). **PBZVISA coverage 1538/1539**
   (bilo 1/1539!). NEDOSTAJE 257: 101 "možda u Reviewu", 66 kartična, 51 nedostaje, **39 Smjer?**.
4. **⚠ NALAZ (→ backlog): ZABA parser Smjer bug.** `parse_zaba_racun` krivo određuje Priljev/Odljev
   za dio priljeva (≥35: mirovina/Priljev iz inozemstva/uplate → Isplata) po X-poziciji; saldo-lanac
   (POČETNO+Σtx=NOVO) ne zatvara. **Account merge + bank kolone UplataB/IsplataB/SaldoB + saldo-vs-Koka
   reconcile BLOKIRANI** dok se ne popravi. `merge_missing_account.py` napisan i spreman, ali NE
   koristiti (dry-run uhvatio mirovine kao Isplata, ništa upisano). Bankovni mjesečni saldi (ZABA
   POČETNO/NOVO STANJE) pouzdani i ulančavaju — čekaju parser fix. Koka je vodila SALDO, ne svaku tx.

**Done 2026-07-22 (S107j — parse_zaba_racun fix + suggest_candidates.py N/A petlja; detalji
ENRICH_PLAN §2h/§2i, sesija PRATNJE — Saša dijagnosticirao Nematchano_v2, Claude/Opus fix):**
1. **`parse_zaba_racun` FIX + POKRENUT** (`enrich_from_izvoda.py`): Saša ručno pregledao crvene
   `Smjer?` retke (original Smjer → kolona K) i ispravno zaključio da su Uplata + transfere treba
   obrisati. Root cause **mehanički** (ne x-pozicija fundamentalno): (a) granica Priljev|Odljev uzimala
   ZADNJU "Priljev" — a "Priljev" je i u opisu *"Priljev iz inozemstva…"* (x≈188) → cijela stranica →
   Isplata (8/31 fajlova, baš mjeseci sa stranom uplatom); (b) continuation stranice bez headera →
   boundary=None → tiho ispuštene sve tx tih stranica; (c) izvadak ima **Tekući + Multivalutni
   žiroračun** (pass-through 0→0) — parser oba tagirao tekući. **Fix:** header-red boundary + prijenos
   kroz stranice + account-tagging + `_validate_zaba` (saldo-lanac vs bankovni POČETNO/Zbroj/NOVO,
   mismatch→stderr); vraća SAMO Tekući, žiro izostavljen, **ime poslodavca prenesen** (`[izvor:…]` na
   self-transfer, Odluka Saša). **Dokaz:** Σupl/Σisp = bankov Zbroj **40/40 u cent**; saldo-lanac
   neprekinut 2023-12→2026-06 (0 pukotina). **Pokrenuto:** inventory --reparse ZABA (624→700 tx) →
   enrich (**1834/3595**, bilo 1725) → reconcile (**Smjer? 39→1**, NEDOSTAJE→224) → apply_rules (+16).
2. **`suggest_candidates.py` (novo) — N/A rule-authoring petlja (Sašina ideja #4):** N/A retci s tekstom
   → merchant klaster → **`Neklasificirano` sheet** (top 20, Tip/Podtip dropdowni preko TipList/INDIRECT
   named rangeova) → Saša popuni → `--harvest` u Pravila → `apply_rules` → sljedeći krug kraći.
   `--year 2026` fokus. Prvi run: Neklasificirano (2026, 20 klastera; BIBERON/KEINDL/HLK/TRAPERICE…).
3. **N/A po godini:** 2024 946 (793 text), 2025 792 (746 text), 2026 174 (155 text); pre-2024 ~600
   no-text (nema izvoda). **Plan (Saša): zatvoriti 2026 → PROD** (Koka nastavlja u app), pa 2025/2024.
4. **Nematchano_v2 (224) mapiran; KONSOLIDACIJA (#1+#3) NIJE još izgrađena:** ~113 čistih za Review
   (31 MASTERCARD lump→**Transfer** = Sašina ideja #1, 66 kartičnih, 16 account), 111→Nematchano_v3.

**Sljedeći koraci — v. i ENRICH_PLAN §3:**
1. ~~Fix `parse_zaba_racun`~~ ✅ S107j. **Konsolidacija (#1+#3):** merge ~113 čistih Nematchano_v2 u
   Review (MASTERCARD→Transfer, kartične, account) + Nematchano_v3 residual; `merge_missing_account.py`
   treba guard (skip MASTERCARD lump + možda-dup). Onda bank kolone UplataB/IsplataB/SaldoB. NIJE hitno.
1c. **N/A petlja (`suggest_candidates.py`) — PRIORITET 2026** pa PROD, zatim 2025/2024 (v. §2i).
2. **Pravila iterativno sa Sašom — sljedeći krug (Sonnet OK).** Preostali kandidati
   (ENRICH_PLAN §2e): `paypal` ostatak, `spotify` ostatak, porez grupa (porez/prirez/
   dohodak — treba nov Tip?), `leasing`, `bmove` (nepoznat merchant), `keks pay`,
   `zagrebparking`. Svaki treba Sašinu odluku o Tip/Podtip prije pisanja pravila.
3. Koka: 700€ isplata 2025-11-26 (nije na izvodu) + odluka što s preostalom N/A masom;
   Saša/Koka review `Financije_review_20260710_1448.xlsx`
4. Ručni testovi T-S107b-3..6 (Add prefill UX + Automations sheet roundtrip); T-S107f-3
   (UI fix shortcut/skriveni atributi, PROD/mobitel — još netestirano)
5. Generiranje app-import Excela iz odobrenog reviewa (period filter `--from/--to`) + struktura `Financije_all`;
   Leaf comment definira import generator kroz CommentTemplate (`{racun}/{tip}/{podtip}/{napomena}`);
   Visa `Datum naplate` puni generator (RF lump datumi ili `next:N`)
6. Import pod **Kokinim accountom** (D6) + spot-check; stare Financije aree obrisati NA KRAJU (backup!)
7. Diary archaeology (non-blocking)
8. Split-workbook (Taksonomija/Pravila/Preimenovanja → zaseban file) — opcionalno, kad Saša poželi

### S108+: Intelligence layer (success criteria)

---

### Backlog (future — after S107 historical pipeline)

1. **BUG-S103-ANYATTR pravi fix** — SECURITY DEFINER RPC za "In any attribute" pretragu koja zaobilazi ILIKE+RLS non-leakproof problem
2. **E7-2/E7-3 UX polish** — Toast "Access granted" missing u Share Management invite flow; selektore/toast implementacija trebam da vidim
3. **D9 verify** — Excel User column behaviour (always visible vs. only for shared areas) — minor, može biti nakon S107
4. **FilterContext koraci 2+3** (Fable I.4) — tipizirani event bus (`appEvents.ts`), eventualno split FilterProvider/SharingProvider
5. **Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi

### Doc Updates Checklist (S104–S110)

**Reference:** `docs/FABLE_PLAN.md` (S104–S110 plan po sesijama), `docs/DOCUMENTATION_AUDIT_2026-07-05.md` (što obrisati)

After each session:

| Session | Doc updates | Checklist |
|---------|------------|-----------|
| S104 end | CLAUDE.md "Done (through S104)" + "Open bugs (main)" sekcije | [x] Delete bug + parent event + BUG-S102-DELETE markirani kao Done; BUG-S103-ANYATTR s napomenom S105 |
| S105 end | CLAUDE.md backlog + docs/Diary.md § 6 mapping | [ ] Dairy archaeology hasil integrirani; mapping tablica popunjena |
| S106 end | — | — |
| S107 end | MIGRATION_STATE.md + CLAUDE.md backlog | [ ] trening.xlsm red dodana (PROD ✅); Garmin/Activities Clean ✅ |
| S108 end | docs/HELP_STRUCTURE.md § H5 Analytics tab | [ ] Analytics tab feature inventory dodana ako je tab implementiran |
| S110 end | FABLE_PLAN.md § VII ("Što se desilo — lessons learned") | [ ] Session notes + što se razlikovalo od plana |

### Active backlog

**Backlog (iz S97):**
- **Potpuni attrFilter za number/boolean/datetime** — proslijediti `data_type` u `AttrFilterParam`, koristiti `value_number`/`value_boolean`/`value_datetime` s odgovarajućim operatorima
- **Structure Edit UX za depends_on opcije** — lakše dodavanje opcija u mapping bez odlaska u full edit panel
- **Stanje post-processing** — automatski preračun Stanje atributa per-Račun (SUMIFS logika: kumulativ Uplata−Isplata po računu do datuma); kandidat za post-import batch update ili Post-Finish automation

**Post-Finish automation** — spec: `docs/AUTOMATION_SPEC.md`
- ✅ Faza 1: Python rata tool → Post-Finish modal u web app
- ✅ Faza 2: Auto-comment template po leaf kategoriji (S95)
- ✅ Faza 2b (S107b): `set_attribute` pravila — auto `Datum naplate` po Izvoru; `attributeRules.ts` + AddActivityPage prefill
- ◐ Faza 3 (djelomično, S107b): Automations sheet u Structure Excel roundtripu pokriva `set_attribute`; rata config još SQL
- Faza 4: Training parser/inverz (čeka `trening.xlsm` analizu)

**Structure Edit UX cleanup** (`StructureNodeEditPanel.tsx`, nema DB promjena):
1. Collapsible attribute kartice — `collapsedAttrs: Set<string>` (po attr.id), persist u localStorage key `structAttrCollapsed:<nodeId>`; collapsed header (1 red): name + type badge + sort broj + chevron ▶/▼ + trash ikona; "Collapse all / Expand all" gumb (prikaže se kad 3+ atributa)
2. `suggest` direktno u "New attribute" formi — odabir u Type `<select>` (interno: data_type='text' + val_type='suggest' + options textarea); `→ Suggest` gumb na postojećim text atributima ostaje
3. Help docs update — `docs/help/structure.md` sekcija "Editing attributes": tipovi, suggest opcije, default_value, depends_on, slug rename

**⭐ Help "What can I do here?" chip** — standing chip `"✨ What can I do on this screen?"` po `pageHint` kontekstu; zahtijeva `docs/help/*.md` sekcija "Feature inventory" s detaljnim opisima po stranici/kontekstu — **mora biti dosta detaljno** (korisnikov izričit zahtjev)

**AI Help sistem** — ✅ kompletno (S59–S81): Haiku FAB, 3 taba (Pitaj AI / Koncepti / Povratna info), dinamički load `docs/help/*.md`, context chips po pageHint. **Pravilo:** `docs/help/*.md` = jedini izvor istine za feature docove. `help.ts` statički prompt = samo Demo Area putanje + pravila tona.

**Template system** — ✅ kompletno (S49–S58). Template user (`VITE_TEMPLATE_USER_ID` env var), "From template" flow, Demo Area na PROD, E11/E12 Playwright. Budući: Garmin API adapter (schema za external source mapping).

~~Financije reorganizacija (classify_na_events.py plan)~~ — superseded S107 pipelineom (review Excel + apply_rules + enrich); stari plan i skripta arhivirani u `Claude-temp_R/docs_OLD/` i `data-prep_tools/Financije/Obsolete/` (S107d).

**Historijska migracija** (bez vremenskog pritiska) — `trening.xlsm` analiza + import

**Plotly bundle size** — vendor-plotly ~4.9MB; prihvatljivo dok performanse nisu problem.

**Health tracking Area** — ✅ kompletno osim: `health_lab_review.py` cleanup — čita Health_Saša iz baze, generira review xlsx za razdvajanje Medical Visit bilješki koje su pomiješane u Lab Results commentima

**Netlify scheduled maintenance** — kad se skupi 2-3 zadatka: `netlify/functions/maintenance.ts` s `schedule = "@weekly"` (orphaned share_invites, stari accepted invites >30 dana, stari help_log zapisi >90 dana)

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
6. **Samo kad korisnik IZRIČITO zatraži PROD deploy** — Netlify build troši kredite,
   NIKAD ne pushati/mergati na main samoinicijativno! Tada merge na main + sync back:
   ```
   git checkout main && git merge test-branch --no-edit && git push origin main
   git checkout test-branch && git merge main --no-edit && git push origin test-branch
   ```
   Bez sync-backa `test-branch` zaostaje za `main` (merge commiti ostaju samo na main).

### Test result reporting (next session)
User says e.g. "T-S24-1 OK, T-S24-3 fail" → Claude updates PENDING_TESTS.md accordingly
and investigates failures before coding new features.
For E2E: user says e.g. "pao E2-2" → Claude reads `e2e/test-results/` artefacts directly.
