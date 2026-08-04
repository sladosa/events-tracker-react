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
| `NEXT_SESSION_PROMPT.md`                  | **Handoff za sljedeću sesiju** — DIO 1 netehnički, DIO 2 tehnički                 |
| `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13** | **Cutover plan** — kako Koka prelazi s Excela na bazu (⚠ gitignoriran, samo lokalno + `D:`; sažetak je u `NEXT_SESSION_PROMPT.md` DIO 1) |

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
4. **`consolidate_review.py` (novo) — izvodi ZATVORENI, sve u Review:** DODANO **113** (31 MASTERCARD
   lump→**Transfer/izmedju racuna**=ideja #1, 65 MC+1 Visa kartične→N/A, 16 account→N/A); **`Nematchano_v3`**
   sheet (side-by-side Source Izvod↔Review + Transfer Y/n + saldo-hint, Sašin dizajn) i **`Saldo kontrola`**
   sheet (Kokin Stanje NA datum zatvaranja izvatka vs bankovni NOVO STANJE — 21/31 balansira u cent, 10
   razlika za Koku) sad ŽIVE U REVIEW workbooku (Izvodi_transakcije.xlsx više ne treba za odluke).
   Review 4855→**4968**; apply_rules klasificirao ~40 novih. Backup `pre-consolidate-20260722_102449`.

**Done 2026-07-23 (S107k — v3 Verdikt tok + date-accuracy + Datum naplate KOMPLETAN; detalji
ENRICH_PLAN §2k, test-sessions/S107k_tests.md; SVE IZVRŠENO na pravom Reviewu):**
1. **Odluke (Saša):** prag sitniša **5 €** (ispod = auto-verdikt, ništa se ne baca — bez slobodnog
   kandidata auto-DODAJ pa pravila klasificiraju); DUP verdikt = potvrđen par ⇒ **event_date sync na
   bankovni datum** (kombinirani v3+date-accuracy pass); `Datum naplate` se puni u Review SADA.
2. **`date_accuracy.py` (novo):** matchani parovi Δ±1/±2 → event_date ← bankovni datum. **Izvršeno:
   360 pomaka** + 89 naplata follow + 187 Izvod opis. **Verificiran obrazac PBZ naplate:** suma
   statementa M == PRIMLJENA UPLATA u M+1 == RF PBZCARD isplata isti dan (30/30 u cent).
3. **`consolidate_review.py` — Verdikt tok:** kandidati **slobodan vs. `(matchan)`** (bug uhvaćen na
   test kopiji: DUP sync krao Δ0-matchane retke tuđih tx → fix prije pravog runa); sitniš<5€ auto-DUP/
   auto-DODAJ; v3 `Verdikt` dropdown (DUP/DODAJ/PRESKOČI, pre-popunjen) + `Src`+`key`; **`--harvest`**
   primjenjuje verdikte PRIJE regeneracije (DODAJ→novi red s Izvod opis; DUP→datum-sync+opis;
   PRESKOČI→hidden `V3 preskočeno`). **Sašin pass:** 41 red → 20 DUP + 19 DODAJ + 2 PRESKOČI →
   **v3 = 0 za odluku**. Ulov: Claude pretplata `sasa EU:549` imala tipfeler godine (2024→2025) —
   DUP sync popravio; KONZUM RATA 2/3 stvarno falila (kandidati matchani drugim ratama) → DODAJ.
4. **`kartice_datum_naplate.py` (novo, bivši visa_datum_naplate):** Visa ← stvarni datum uplate
   statementa (lump M+1/RF, cutoff dan≤3 fallback); MC ← 11. u M+1 (Kokino pravilo, 1650/1653
   potvrda). **Datum naplate 100% popunjen — svih 5004 redaka, 0 praznih.**
5. **Saldo kontrola 10 → 7 razlika** (2025-02, 2025-07 Astrum −2875, 2025-08 +200 riješene datumima!);
   preostale = prava pitanja za Koku: 2026-01 +359, 2024-09 +149, 2×±49 multisport + 3 sitna.
6. **PBZCARD pravilo #26** → 4 preostala N/A → Transfer/izmedju racuna (stragglers zatvoreni);
   apply_rules ukupno +35 novih klasifikacija (parking 8, Spotify 4, Prime 4, Claude→Projekti…).
   **N/A 2026 = 178** (od 2812 ukupno). Poznat 1 pre-postojeći dupli source_key (`koka EU:31`,
   2022, 2×17.82) — pre-2024 cleanup.

**Done 2026-07-25 (S107l — N/A petlja 2026, 3 kruga, ručni fixevi + priority-order pravilo;
Sonnet pratnja sesija):**
1. **T-S107k-1/T-S107k-2 potvrđeni OK** (Saša vizualni pregled); T-S107k-3 (Saldo kontrola 7 razlika)
   odgođeno — pitanja za Koku.
2. **3 kruga `suggest_candidates.py --year 2026` → popuni → harvest → `apply_rules.py`:**
   Krug 1 (15 pravila, 201 redaka: BIBERON/KEINDL/HLK ČLANARINA/TRAPERICE/AFRODITA/IGOMAT/
   VIDIKOVAC/BATES/TEKSTILPROMET/ŠATRAK/EUROPA/REG/HRANA/FISHERIJA/PUREX); Krug 2 (15 pravila,
   104 redaka: CHIPOTEKA/AGRAM/AUTOCENTAR/IQNIO/LUFTHAN/NAKNADA/DUBRAVICA-II/PRO STAKLO/MELODIJA/
   NATURAL/TISAK/VIDEO/KORICA/LJEKARNA); Krug 3 (12 pravila, 66 redaka: GRAFOCENTAR/MINI MLJEKARA/
   MASLINA/MLINAR/BODY SHOP/CINESTAR/MULLER/BOFROST/NETDOMENA/COREEVENT/BATAK).
   **N/A 2026: 178 → 85** (68 s tekstom preostalo za krug 4, 17 bez teksta — hard/ručno).
3. **Pravilo-review prije svakog harvesta ulovio 4 stvarna problema** (Claude provjerava
   Tip/Podtip protiv stvarnog Izvod opisa PRIJE svakog runa — obrazac za buduće krugove):
   - **PAYPAL, KEKS PAY, GLS, GLS-D isključeni iz pravila** — dostavljač/servis, ne merchant;
     stvarni sadržaj varira previše za blanket (npr. GLS je nosio i Nespresso i Yasenka odjeću
     pod istim ključem) — ista klasa problema kao već poznati `paypal`/`keks pay` backlog.
   - **NATURAL → Zdravlje/Medical_Koka** (bio pogrešno Razno/Odjeća; opis "Natural Pharmaceutical"
     + Napomena "D-vitamin" otkrili pravi kontekst).
   - **GRAFOCENTAR krug 1 izostavljen** (2 pojavljivanja, različit kontekst po osobi — Koka "Čaše",
     Sašin nejasan); krug 3 Saša sam klasificirao (Razno/Pokloni), prihvaćeno.
   - **NAKNADA prepoznat kao preširok ključ** — 45 stvarnih bankovnih naknada ALI i 3 "Grobna
     naknada" retka (godišnja gradska pristojba za grob, Zagrebački holding — ISTA firma kao
     "Holding (smeće)") koja bi pogrešno pala pod Domaćinstvo/Bankovni troškovi. **Fix: nova
     Taksonomija par Domaćinstvo/Groblja + specifičnije "grobn" pravilo UMETNUTO IZNAD "NAKNADA"
     reda u Pravila sheetu** (`ws.insert_rows()` — prvi-match-pobjeđuje znači redoslijed rješava
     over-broad keyword bez potrebe za NOT/exclusion sintaksom, koja ne postoji).
   - **LJEKARNA 1 poznati outlier** — "LJEKARNA OREBIC" (red 2115) je Kokina transakcija ali
     blanket pravilo je stavilo Medical_Sasa (Pravila sheet nema per-račun uvjet kao Preimenovanja);
     Saša ručno ispravlja.
   - **MULLER → Namirnice/Hrana i ostalo provjeren protiv presedana** (DM Drogerie Markt već ide
     u istu kategoriju) — potvrđeno da je to ustaljena "drogerija+hrana" konvencija, ne greška.
4. **Backup lanac:** svaki harvest/apply_rules/manual-fix korak ostavio `.pre-*` backup
   (uklj. `pre-manual-fix-20260725_132637` za ručni openpyxl fix izvan standardnih alata).

**Done 2026-07-26 (S107m — strateški zaokret + IZVRŠEN eval i čišćenje labela;
puni handoff: `NEXT_SESSION_PROMPT.md`, testovi: `Claude-temp_R/test-sessions/S107m_tests.md`):**

**A) Izvršeno (kod + podaci):**
- **`ai_classify.py` (novo)** — AI klasifikacija Tip/Podtip, Sonnet 5. Eval naslijepo na već
  klasificiranim redcima, zamrznut stratificiran uzorak (`--sample 600`, seed 20260726) pa su
  runovi usporedivi. Store **`ai_predictions.jsonl`** append-only, **ključ `source_key`** (ne broj
  retka — pomiče se pri re-sortu), s `--resume` i `--only-conf niska` (ponovi samo nesigurne).
- **Rezultat (ručne labele):** v1 samo popis kategorija **62,5 %** → v2 + Sašin kontekst file
  **80,3 %** → v3 + tvrda pravila 80,8 % → **v3 + `--effort high` 81,5 %, Tip 92,3 %**.
  `visoka` pouzdanost = **95 % točno na 57 % redaka** → bulk-accept traka. Prag postavljen prije
  mjerenja: ~80 % = **model predlaže, čovjek potvrđuje** (ne puna automatika). Dorada prompta je
  na granici povrata. **`--effort high` je odabran** ne zbog točnosti (unutar šuma) nego jer pri
  istoj preciznosti gura 10 pp više redaka u `visoka` traku. ⚠ Potpunost pada s effortom
  (600→577→550 vraćenih od 600) — prije produkcijskog runa smanjiti `BATCH` 40 → ~25.
- **`AI_KONTEKST_pitanja.txt` + `make_context_questions.py` (novo)** — generirana pitanja iz
  stvarnih podataka, Saša popunio; **najveći pojedinačni skok točnosti dolazi odatle, ne od modela.**
  Ide u prompt DOSLOVNO (Saša je odgovarao inline, parser bi nešto pojeo).
- **`apply_label_fixes.py` (novo) — 223 retka ispravljena.** Eval je otkrio da dio "grešaka
  modela" nisu greške: **171 redak imao Tip bez Podtipa** (par ne postoji u Taksonomiji pa ga
  model ne može vratiti; `apply_rules` ih nikad nije prijavio jer preskače prazan Podtip) → **0**;
  **BIBERON bio 33/22 nedosljedan** → svih 55 `Projekti | Sasa_Informatika`. Novi par
  **`Investicije | Dionice`**. Backup `pre-labelfix-20260726_145103`.
- **`date_accuracy.py` fix** — bezuvjetno je gazio `freeze_panes='F2'` na Reviewu; više ne dira
  korisnikovu postavku (openpyxl je ionako čuva).
- **Zamke (sve plaćene otkrićem, v. NEXT_SESSION_PROMPT):** `effort: low` vraća **1 rezultat na
  40 redaka** uz uredan `stop_reason: end_turn` → guard uspoređuje poslano/vraćeno; **structured-output
  `enum` NIJE obvezujuć** (vraćao `Hrana I ostalo`) → normalizacija; heredoc patchevi tiho ne pogode
  a `py_compile` prođe → provjeravati grep-om; preširok keyword (Konzum+Radnička hvatao i `RATA`
  retke = rate velike kupovine, ne ručak).

**B) Strateške odluke (dogovorene, NISU implementirane):**
1. **"2026-first → PROD" NAPUŠTEN** (Sašin argument): Koka je otišla dalje u svom
   `Financije 2026.xlsm` → PROD u koji ona ne prelazi ne otključava ništa. **Pravi gate =
   mehanizam na koji Koka prelazi, ne postotak N/A.** Mjerenje potvrdilo: 59 N/A 2026 s tekstom
   = 46 brandova, isti brandovi u 265 redaka prije 2026 (rad na 2026 nije izoliran).
2. **Ručno autorstvo keyword pravila napušteno kao glavni tok** — ne skalira se: 1606 text
   redaka → 662 klastera, 427 s 1 pojavom; top 20/krug = 26% → ~30 krugova. **Model klasificira,
   čovjek pregledava** (taksonomija zatvorena, 63 para u upotrebi). Pravila ostaju samo za
   ponovljiv budući import, pišu se kao nusprodukt. **PRVI KORAK: eval naslijepo na 2580 već
   klasificiranih redaka** — taj broj određuje sve dalje. Otvoreno: API batch ili u razgovoru.
3. **⚠ `source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u
   fileu) → Kokin ubačeni redak mijenja ključeve svih redaka tog dana iza njega. Preduvjet za
   ponovljivi re-ingest; fix = deterministički sort unutar dana.
4. **Store ≠ UI** — korijen svih frikcija (Excel lock, 25 kolona, 11 `.pre-*` backupa,
   split-brain, taksonomija se ne pamti). SQLite predložen pa **odbačen** (ne rješava Koku na
   drugom laptopu); **NE nova Area** (EAV = krivi model za ravnu tablicu); **DA
   `staging_financije` obična tablica u Supabaseu** + audit log; import u Areu = transformacija
   u bazi. Zdravlje/Diary/trening kasnije = nove tablice.
5. **Review ekran (Sašin dizajn):** prijedlog Tip/Podtip + ✓OK toggle + override kolone
   (prijedlog ostaje vidljiv); dopune: grupiranje po merchantu, sort po sigurnosti modela,
   dokaz u retku. **Taj ekran = Kokin prvi kontakt s aplikacijom.** Dev ruta, ne feature.
6. **Nalazi u Review fileu:** `freeze_panes = F4855` (zamrznuti redovi 1–4854, vjerojatno
   slučajan klik); `Taksonomija!D1` zalutali paste; `Izvod opis` na koloni U → reorder + outline
   grupe (ništa se ne briše; `apply_rules` rješava kolone po imenu pa je siguran).
   openpyxl **čuva** layout izmjene, ali **gubi grafove/slike/pivote**.
7. Backupi → git umjesto hrpe fileova; `merge-by-source_key` alat (~40 linija) da Saša ne mora
   zatvarati Excel. T-S107k-1/2 ✅, T-S107k-3 ⏸ (Koka), red 2115 ✅ ručno ispravljen.

**Done 2026-07-27 (S107n — AI `--run` izvršen + NALAZ duplikati rata; detalji ENRICH_PLAN §2l,
testovi `Claude-temp_R/test-sessions/S107n_tests.md`):**
1. **`ai_classify.py --run` napisan i IZVRŠEN** — `BATCH` 40→25; nove kolone **`Tip_AI`/`Podtip_AI`**
   (vidljive, odmah desno od `Podtip`) + **`Pouzdanost_AI`/`AI run`** (collapsed grupa), umetnute
   DESNO od J/K pa DV i CF ostaju netaknuti. **Model nikad ne piše u `Tip`/`Podtip`.**
   `--dry` bez `--limit` = plan bez API poziva; `--dry --limit N` = prava predikcija bez pisanja.
   **Rezultat: 1593 retka** (od 1606 s tekstom; 818 bez teksta preskočeno — Sašina odluka),
   **visoka 261 / srednja 239 / niska 1093**, NEPOZNATO 196, **$1,17**.
   Kontrola vs backup: 0 promjena u starim kolonama, 0 AI upisa na klasificiran redak.
   **⚠ `visoka` je 16 %, a eval je davao 57 %** — nije regresija, eval je mjeren na već klasificiranim
   (prepoznatljivim) redcima; N/A hrpa je teži ostatak. Bulk-accept traka je tanka.
2. **Robusnost:** `is_fatal()` — prazan kredit/400/401/403 ne ide u 4 retry-a; **pali batch više ne ruši
   run**, djelomičan rezultat se zadrži i upiše, ostatak s `--resume`. (Naučeno skupo: kredit je pao na
   19/64 batcheva i cijeli posao propao iako je 491 predikcija bila u storeu.)
3. **⚠ NALAZ — duplikati rata: 8 redaka, 636,36 €.** Kad Koka ratu vodi mjesečno, a izvod sve rate
   knjiži na datum kupovine, rate 2..N se udvostruče. Dedup i v3 (±2 dana) to **strukturno ne mogu**
   uhvatiti. Detekcija ide po **`Datum naplate` + iznos** (moguće tek otkad je 100 % popunjen, S107k).
   Plodine/Šatrak×2/Levis×3/Agram×2. 2 lažna pozitivna (ZAKS vs e-Zaba 7,96 €) odbačena.
   **Odobreno, NIJE izvršeno.**
4. **Nalazi iz T-S107m-4:** pravilo #43 `AGRAM` ne može odrediti auto (oba auta, isti merchant) —
   hipoteza ožujak=C5 / listopad=Lacetti čeka Sašin pregled; `Voćarna` (4512) krivo u `auto Lacetti`.
5. **Odluka o označavanju "pregledaj ručno":** ne nova flag-kolona, ne `Problem` (zauzet parse-problemima)
   — kad naraste, sheet `Za pregled` + `Odluka` dropdown + `--harvest` koji ga isprazni (uzor
   `Nematchano_v3`, radio 41→0). Za šačicu redaka ne graditi.
6. **T-S107m-1…5 potvrđeni** (v. PENDING_TESTS); T-S107m-3 "54 vs 55" objašnjeno — red 4759 ima
   "biberon" samo u `Izvod opis`.

**Done 2026-07-28 (S107o — mehanizam `AI odluka` + 2 odobrena popravka izvršena; detalji
ENRICH_PLAN §2m, testovi `Claude-temp_R/test-sessions/S107o_tests.md`):**
1. **`apply_ai.py` (novo)** — kolona **`AI odluka`** (dropdown `OK`/`NE`/`?`) desno od `Podtip_AI`,
   unutar autofiltera. `--harvest` prenosi `OK` u `Tip`/`Podtip` i **čisti ćeliju**; `NE`/`?` ostaju
   pa je filter "nije prazno" uvijek preostali posao (uzor `Nematchano_v3`). Nikad preko postojećeg
   `Tip`a, par mora biti u Taksonomiji, `NEPOZNATO` se ne prenosi. Povod: T-S107n-1 je bio neizvediv
   jer mehanizam za bilježenje odluke nije postojao.
   **Provenijencija u `Labela iz` (`AI:visoka …`), NE u `Pravilo run`** — tu kolonu `ai_classify --eval`
   čita kao "labelirano keyword pravilom", pa bi AI labele ušle u vlastiti eval set kao `rucno`
   (pošteni benchmark). `ai_classify.py` sad izbacuje `Labela iz`=`AI:*` iz eval seta.
   **Jedinica pregleda je par, ne redak:** `visoka` = 261 redaka ali **31 par**, 3 para nose 165.
2. **`fix_duplikati_rata.py` (novo) — IZVRŠENO:** 8 parova, `DUP` semantika (Kokin ostaje + `Izvod opis`,
   izvodni obrisan → `V3 preskočeno`). Traži po `source_key`, ne po broju retka. Review **5004 → 4996**,
   Σ Isplata −**636,36 €** u cent, **0 razlika u 149.834 ćelija** ostalih redaka.
   ⚠ **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** (preskače `source_key`eve koji POSTOJE u
   Reviewu) → `V3 preskočeno` je sad registar koji i taj alat čita.
3. **`fix_vocarna_pravilo.py` (novo) — IZVRŠENO:** ⚠ pravilo samo ne bi popravilo ništa —
   `apply_rules.py` preskače retke s **valjanim** parom, a `auto Lacetti|registracija` jest valjan,
   samo kriv. Zato: pravilo `voce i povrce` na red 44 (iznad #43 `AGRAM`) **+** jednokratni ispravak
   retka (nađen po ključu na 4504, bio 4512 prije dedupa). `Pravila` 69 → 70.
4. `freeze_panes` `F4855` → **`F2`**. **Par 4505 potvrdio ožujak = C5** (T-S107n-4).
5. **Petlja učenja (načelno, nije građeno):** `NE` sam ne nosi informaciju — vrijednost je u **ispravku**;
   `Tip_AI` ostaje u retku pa je ispravak rekonstruktibilan bez oznake. Put natrag: ispravci →
   `AI_KONTEKST_pitanja.txt` → bump `PROMPT_VER` → re-run `niska`+`srednja` (~$1).

**Done 2026-07-28 (S107p — harvest `visoka` trake):**
1. **`apply_ai.py --harvest`** (dry pa pravi run) — **347 redaka** preneseno iz `Tip_AI`/`Podtip_AI`
   u `Tip`/`Podtip` (Saša je prošao `visoka` i dio `srednja`/`niska` prije harvesta). 3 retka
   preskočena (861/887/3166 — već imali ručni `Tip`, `OK` ignoriran po dizajnu). Backup
   `*.pre-aiapply-20260728_171029`. Review i dalje 4996 redaka (harvest ne mijenja broj redaka).
2. **Preostalo po traci (Tip i dalje N/A):** visoka 2, srednja 205, niska 1023.
3. **Namjerna odluka:** 3 skipnuta retka ostaju trajno `OK` u `AI odluka` (harvest ih ne čisti) —
   dokumentirano kao poznat, ne-bug slučaj umjesto popravljano.
4. **Sljedeće:** `srednja` traka (205), pa `niska` (1023) — v. `NEXT_SESSION_PROMPT.md`.

**Done 2026-07-29 (S107q — STRATEŠKI ZAOKRET: import prvi, klasifikacija poslije; nema koda.
Detalji: `ENRICH_PLAN.md` §2o, plan za netehnički pregled: `NEXT_SESSION_PROMPT.md` DIO 1):**
1. **Redoslijed migracije OBRNUT:** `import → cutover → reklasifikacija` umjesto
   `klasifikacija → import`. Povod (izmjereno): Kokin tempo ≈147 tx/mj u file-u **bez
   Tip/Podtip**, Review snapshot od 2026-07-08 → divergencija ~3 tjedna/~150 tx i **raste brže
   nego što se N/A prazni**. Unos u appu ima obavezan Tip/Podtip dropdown → klasificira osoba
   koja zna transakciju, isti dan, besplatno; AI na N/A hrpi daje `visoka` na samo 16 % redaka.
   `N/A` je legitimna vrijednost u taksonomiji → ne blokira. Promocija već zapisanog fallbacka
   (`FINANCIJE_MIGRACIJA.md` §12.3).
2. **`staging_financije` OTKAZANA** (S107m odluka poništena; `sql/` staje na `032`). Ako podaci
   idu u app, mjesto za masovni pregled je app. Potreba "podskup kolona + bulk potvrda AI
   prijedloga" ostaje kao **mogući feature nad pravim eventima** (generički za svaku Areu), gradi
   se tek ako Excel petlja nakon importa bude prespora. Bez trećeg storea između Excela i baze.
3. **Tri tehnička dobitka:** (a) `source_key` instabilnost **nestaje** — identitet postaje
   `event_id`; (b) mehanizam reklasifikacije već na PROD-u — D7 `row_hash`+update-guard (deploy
   2026-07-15) je točno export→pravila/AI→re-import s diff potvrdom; (c) ~13/30 kolona Reviewa je
   skela pipelinea koja **u app exportu ne postoji** → Excel petlja poslije importa lakša nego danas.
4. **Kritični put:** delta merge Kokinog `.xlsm` (~90 min; `normalize_financije.py` ima hardkodiran
   INPUT i uvijek generira NOVI Review) → **import generator (korak 4) — NE POSTOJI**, jedina prava
   rupa, `make_import.py` u `Obsolete/` = baza → `Financije_all` struktura → batch import (2026 prva
   kao proba mehanizma; ~50k `event_attributes` ne u jednom naletu, S105 IO) → cutover →
   reklasifikacija bez pritiska.
5. **Cutover mehanizam = Excel roundtrip, NE `Add Activity`** (Sašin nalaz + provjera koda isti dan;
   ovisnost "ergonomija Add Activity" OTPADA). `excelExport.ts:278–395` generira dependent dropdowne
   (INDIRECT + hidden `DropdownData`) petljom po SVIM `depends_on` atributima ⇒ lanci
   **`Racun → Izvor → Status`** i **`Tip → Podtip`** rade u izvezenom fileu — ista UX kao Review, samo
   spojena na bazu. `export_profiles` (već u `areas.settings`) rješava "podskup kolona" ⇒ zadnji ostatak
   opravdanja za staging pada. ⚠ **Rupa:** `set_attribute` se evaluira samo u Add Activity (Edit/Import
   ne) → `Datum naplate` bi novim Excel retcima ostao prazan (protivno D1); preporuka = proširiti na
   Import sa "popuni samo ako je prazno".
5b. **Inventura strukture (PROD `Financije`, read-only 2026-07-29):** leaf L1 `Transakcija`, 357 eventa,
   13 attr. **Oblik pravi, taksonomija zaostala.** Ispravno 1:1: `Racun`; `Izvor` depends_on `racun`;
   `Status` depends_on `izvorplacanja` + `default_map`; `Podtip` depends_on `tip`; `automations.rata`
   (testirano na mobitelu); `export_profiles`. **Zastarjelo/fali:** `Tip` 13 starih opcija vs 19 u
   Taksonomiji (fale `Osiguranje`/`Projekti`/`Zabava`/`Namirnice`/`Porezi`/`Investicije`); `Podtip`
   options_map pre-S107g; **`Datum naplate`/`Datum kupovine` ne postoje**; nema `attribute_rules`;
   višak `Valuta`, `Smjer` ima `PROVJERI`. Put = Structure export → osvježi iz `Taksonomija` → +2 atributa
   → import kao `Financije_all` pod Kokinim accountom.
6. **Politika izvora:** izvodi rješavaju staro, Koka novo — ne sudaraju se. `enrich_from_izvoda.py`
   piše samo `Izvod opis`/`Izvod file` i **ne može** dirnuti Tip/Podtip; `apply_rules.py` samo retke
   s Tip prazan/N/A. ⇒ **ne čekati izvode za retke koje Koka pamti.**
7. **Pravila mijenjanja redaka (provjereno u kodu):** dodavanje uvijek sigurno; **spajanje/brisanje
   samo prije importa i kroz skriptu** (`V3 preskočeno` registar — `excelImport.ts` briše samo u
   `replace` grani kolizije, redak odsutan iz file-a se ne obrađuje pa event tiho preživi);
   **taksonomiju zaključati PRIJE importa** (poslije ime živi i u `validation_rules` i u
   `value_text` svakog eventa; rizik S105d).

**Done 2026-07-30 (S107r — migracija na Kokinu taksonomiju; detalji ENRICH_PLAN §2p,
testovi `Claude-temp_R/test-sessions/S107r_tests.md`):**
1. **Povod:** Koka klasificirala dosta redaka u sesijama sa Sašom, ali imala primjedbu na
   taksonomiju → Saša duplicirao sheet (`Taksonomija (2)`) i pustio je da je složi po svom.
   Nova: **18 Tipova** (novi `Kuća`/`Prihodi`/`Prijevoz`/`Advokati`; ukinuti `Namirnice`/
   `Mirovina`/`Povrat`/`Ostali prihodi`/`Ostavine`). **2061 od 3426 klasificiranih redaka
   (58 %)** nosilo par kojeg više nema — bez migracije bi ih `apply_rules.py` tiho resetirao.
2. **`migrate_taksonomija.py` (novo)** — `Preimenovanja` pokriva samo **1 od 4** mjesta gdje
   ime taksonomije živi; ostala tri bi tiho propala: `Pravila` (37/70 nevaljanih → `read_rules`
   ih preskoči, izgubio bi se S107l/S107h posao), `Tip_AI`/`Podtip_AI` (911 predikcija →
   `apply_ai --harvest` ih odbija, $1,17 + pregled u smeće), `Neklasificirano` (10). Jedna
   `MAP` tablica (33 reda) na sva 4 mjesta, jedan `wb.save()` = atomično. **Nema "training
   runa"** — remap je deterministički; jedino model-side je AI re-run, i to poslije.
3. **`Preimenovanja` dobio uvjetne kolone** `Smjer uvjet`/`Iznos min`/`Iznos max`/
   `Napomena uvjet` (uz postojeći `Racun uvjet`) — AND-ane, prvi red pobjeđuje, uvjetni iznad
   bezuvjetnog za isti par. Trebalo za: `Povrat|Anja` (41 Uplata **450 €** → `Prihodi|Povrat
   Anja`, ostalo uklj. **2 Isplate od 450** → `Transfer|Anja`), `Povrat Nataša` (41 s `Nataša
   Holding` u napomeni → `Kuća|Holding (smeće)`, 3 bez → `Transfer|Natasa`), `Groblja`
   (Nena/Nataša iz napomene). Stari 7-kolonski sheet radi nepromijenjeno (kolone po imenu;
   regresija: `--dry` prije/poslije bajt-identičan).
4. **`--only-renames` flag** — prioritet `Pravilo > Preimenovanja` (uveden S107g za obrnutu
   situaciju) bi nad 2061 retkom × 70 pravila prepisao Kokine ručne odluke i spustio
   `VISOKA`→`PRAVILO`. Nakon migracije se pokrene normalan run za N/A hrpu.
5. **Rezultat:** 2061 preimenovano, **0 resetirano**, **0 preostalih nevaljanih parova** ni u
   `Tip` ni u `Tip_AI`; **`Pouzdanost` distribucija identična (`VISOKA` 1014 → 1014)** = nijedno
   pravilo nije pregazilo ručnu odluku; `Tip_O`/`Podtip_O` netaknuti; **Σ Uplata/Isplata delta
   0,00**; `Pravila` 70 → **71** (Anja split), 0 preskočenih.
6. **Dva nalaza koja su otkrili `--dry` runovi:** (a) `auto Lacetti|parking` ima 0 redaka u
   `Tip` ali **8 predikcija** u `Tip_AI` → mapping izveden samo iz stvarnih `Tip` vrijednosti
   imao je rupu; (b) **odluka koja nije u sheetu ne postoji** — Koka je *rekla* da ukida
   `Domaćinstvo|Investicije`, ali red je stajao u `Taksonomija (2)` → par valjan → rename se
   nikad ne bi aktivirao (ista klasa kao zamka "pravilo ne popravlja redak s valjanim parom").
7. **`grobn` pravilo zadržano i preusmjereno** na `Transfer|Natasa` (ne obrisano): prag po
   iznosu ne razdvaja grobnu (26–28 €) od bankovnih naknada (0,13–50 €); 3 postojeća retka su
   nakon renamea trajno imuna, a bez pravila bi `NAKNADA` buduću grobnu zakopala među 102
   bankovne naknade.
8. **`sync_taxonomy.py` sad garantira `freeze_panes`** (`F{HEADER_ROW+1}`) — odlutao treći put
   (F2 → F4855 → F2 → F84). DV rasponi konsolidirani iz **26 fragmenata s ~30 rupa** (redaka
   BEZ dropdowna) u 2 čista raspona.
9. **`Tools/backup_to_external.bat` (novo)** — additive robocopy (`/E /XO`, **bez `/MIR`** jer
   mirror prenese lokalno brisanje/kvar na jedinu drugu kopiju) za `data-prep_data/` +
   `Claude-temp_R/`; oba gitignorirana ⇒ vanjski disk je jedina druga kopija. Backup napravljen
   prije i poslije migracije; ključni fajlovi verificirani po veličini.
10b. **⚠ NALAZ iz testiranja → `fix_anja_rate.py` (novo, IZVRŠENO):** od 45 redaka Anjine
    posudbe (`X/96`, 96 rata × 450 €) **4 su pala u `Transfer|Anja`** jer nisu zadovoljila
    uvjet `Smjer=Uplata` + 450 €: redovi 397 i 3727 imaju **popunjene OBJE kolone iznosa**
    (`Uplata`=450 uz `Isplata`=0,30/0,70) i `Smjer=Isplata` — a `row_amount()` čita `Isplata`
    PRVO pa vidi 0,30; redovi 3612+3613 su **jedna rata plaćena u dva dijela** (400+50,
    Napomena `72/96 (1/2)`/`(2/2)`). **Nije regresija migracije** — anomalija u izvoru koju je
    migracija razotkrila. Opseg zatvoren: u cijelom fileu **samo 3** retka imaju obje kolone
    popunjene (treći je bankovna naknada 0,26/0,17, ispravno klasificirana), `Smjer` se inače
    svugdje slaže ⇒ nema sistemskog rizika za `Iznos min/max` pravila. Fix traži retke po
    `source_key` s guardom na Napomenu+iznos; ⚠ **pravilo/`Preimenovanja` to ne mogu popraviti
    jer je `Transfer|Anja` sad VALJAN par** (`apply_rules` preskače valjane — ista zamka kao
    `fix_vocarna_pravilo.py`). Rezultat: `Prihodi|Povrat Anja` 41 → **45**, `Transfer|Anja`
    31 → 27, svih 45 `X/96` na jednom mjestu.
10c. **Dva testna kriterija koja sam sam loše napisao pa dala lažni alarm** (ispravljena u
    `S107r_tests.md`): (a) "`Pouzdanost` na preimenovanim redcima nije `PRAVILO`" — redak
    klasificiran keyword pravilom u S107g/h/l legitimno nosi `PRAVILO` **od tada**, a
    preimenovanje `Pouzdanost` ne dira; takvih je 661 i **svih 661 imalo je `PRAVILO` i prije**
    (0 novih). Pravi dokaz je **nepromijenjen raspored**, ne odsutnost oznake. (b) "među
    `Transfer|Anja` su 2 Isplate od 450 koje namjerno nisu povrat" — v. 10b, dvostruko pogrešno.
11. **Otvoreno:** layout faza 1 (`sheet_layout.py` — header u red 3, freeze `F4` **tek tada**,
    help u collapsed redove 1–2 kol. B; header red 1 hardkodiran u **15** skripti, **12 kopija**
    funkcije za traženje kolone ⇒ prvo čitači tolerantni na raspored, pa promjena rasporeda).
    **AI eval baseline 81,5 % / Tip 92,3 % više ne vrijedi** — mjeren na staroj taksonomiji;
    `srednja` (205) i `niska` (1023) traka rade se nad novom.

**Done 2026-07-31 (S107s — odluke o formatu importa + generator strukture `Financije_all`;
detalji `NEXT_SESSION_PROMPT.md`, testovi `Claude-temp_R/test-sessions/S107s_tests.md`):**
1. **Redoslijed obrnut u odnosu na plan:** prije generatora importa trebala je **struktura**,
   jer zaglavlja uvoznog filea moraju nositi točna `attribute_definitions.name` imena.
2. **⚠ Četiri tihe rupe u `excelImport.ts` nađene čitanjem koda** (nijedna ne javlja grešku):
   (a) **`session_start` mora biti tekst `"HH:MM"`** — `cellStr` na pravoj Excel time
   vrijednosti vrati puni ISO, `parseTimeStr` → `null`, fallback `?? {h:9}` ⇒ **svi redovi
   dobiju 09:00**; (b) **krivo ime atributa se tiho preskoči** (`:836`) — `validateLegendHeaders`
   provjerava LEGEND vs zaglavlje samo *unutar filea*, ne protiv baze; (c) **`Rate?` je
   `boolean`**, a Review ima `'DA'` → `String(v).toLowerCase()==='true'` bi spremio **FALSE**
   na svih 661 rata; (d) **email u kol. G mora biti račun koji IZVODI import** — inače se
   redak klasificira kao „tuđi" i preskoči (`foreignMode='skip'`).
3. **`session_start` unikatan po transakciji — potvrđeno jačim razlogom nego što je handoff
   pretpostavljao:** `useActivities.ts:242` grupira listu po
   `user_id_category_id_session_start`, a leaf je L1 ⇒ isti `category_id` za sve retke ⇒ dan
   s 21 transakcijom bi bio **jedan redak u listi**. Odluka `09:00 + n` — isti obrazac koji
   postojeći PROD podaci već koriste.
4. **`make_financije_all_structure.py` (novo)** — BASE (PROD export) + `Taksonomija` sheet →
   `Financije_all_structure_20260731_180411.xlsx`. 15 atributa: Tip/Podtip regenerirani
   (18 Tipova / 65 parova), `Napomena` → **`Izvod opis`** (slug `izvod_opis`), novi
   `Datum naplate`/`Datum kupovine` (datetime), `Unit=EUR` na Uplata/Isplata/Stanje,
   **`Valuta` bez defaulta** (default se piše s `touched:true` ⇒ 1 suvišan zapis po
   transakciji zauvijek), novi `Sort` (lanac ovisnosti odozgo), `CommentTemplate`
   skraćen na `{racun}/{tip}/{podtip}`, `Automations` red
   `datum_naplate ← izvorplacanja` (`Racun=same | Cash=same | Mastercard=next:11 | Visa=next:3`).
   Sve odluke u `MODS` bloku ⇒ promjena = jedna linija + rerun.
5. **Verifikacija simulacijom, ne pogledom:** `groupAttributes()` + `buildValidationRules()`
   iz `structureImport.ts` reproducirani nad generiranim fileom → ispisan točan JSON koji bi
   završio u `validation_rules`; Taksonomija provjerena na `|`; `DateMap` na `isValidDateRule`.
6. **⚠ `automations.rata` NE ide Structure importom** — `Automations` sheet pokriva samo
   `set_attribute`. Rata konfiguraciju treba prenijeti ručno/SQL-om, inače Post-Finish rata
   modal na `Financije_all` prestaje raditi.
7. **`PROVJERI` razriješen — sva 4 retka ispadaju iz importa:** nisu dvojbeni smjer, nego
   **nemaju iznos**. 32/33 = početna stanja (1.1.2023.), 4983 = prazan placeholder,
   **1521** = nepotpuni duplikat retka 1503 — saldo se **ne pomiče** (5640,16 → 5640,16) a
   sljedeći redak se zatvara iz iste brojke, dakle novca nije bilo; ista napomena „Ašo",
   20 € tjedan ranije. (Ograda: RF izvodi počinju 2024-09 ⇒ nema bankovne potvrde za 2024-03.)
7b. **Princip (Saša): „sve bi trebalo ići importom".** Povod: `automations.rata` ne prolazi
   Structure roundtripom. Prijenos aree je stvaran scenarij ⇒ konfiguracija koju roundtrip ne
   pokriva je **tihi gubitak**. Poznate rupe: `automations.rata`, `export_profiles` (ključ
   `attr:Area||CatPath||AttrName` ne preživi promjenu imena aree/atributa). App backlog:
   proširiti `Automations` sheet na `rata` + `ExportProfiles` sheet u Structure roundtrip.
8. **Izmjereno, neizvršeno:** **15 nemarkiranih rata** (banka zapisala `RATA n/m`, Koka nije;
   ključ mora biti `RATA n/m` — goli `n/m` daje **31 lažni pozitiv**, datumi `03/23`);
   **`Datum kupovine` na ratama** — ključ grupe **mora sadržavati iznos** (`Konzum 1/6`
   postoji 4× kao različite kupovine), 199 grupa / **samo 105 ima ratu 1** ⇒ anker računati
   aritmetički (min `n` − (n−1) mjeseci), 136 parova ima nemjesečni korak ⇒ flagirati.

**Done 2026-08-01 (S107t — `Rata br` + čišćenje lažnih rata + import generator + `rata` u
Automations roundtripu; detalji `Claude-temp_R/test-sessions/S107t_tests.md`):**
1. **`Rata br` (novi atribut, `rata_br`)** — `Broj rata` je ukupno N, ali redni broj TE uplate
   živio je samo kao tekst u `Napomena`. Nije izvediv iz datuma: **136 grupa ima nemjesečni korak**
   i **samo 105 od 199 grupa ima ratu 1** (Anja počinje na 41/96) ⇒ indeks je činjenica iz izvora,
   ne izvedena vrijednost. Samovalidirajući parse (`n/m` gdje se **m poklapa s `Broj rata`**):
   **621 od 661** redaka, **0 sudara**. Zrcali `Broj rata` (`depends_on rate=TRUE`), Sort 11.
2. **`fix_lazne_rate.py` (novo) — IZVRŠENO, 32 retka (ne 19).** `normalize_financije.py` čitao je
   Kokin `mjesec/godina` kao `rata n/N`: `HLK 3/26` → `Rate?=DA, Broj rata=26`. Prvotna procjena
   (19) promašila je **`Broj rata = 24`** — izgledao je kao uvjerljiv broj rata. Detekcija je
   samovalidirajuća (**`2000 + Broj rata == godina event_date-a`** ∧ `n/m` s n ≤ 12): nijedan pravi
   plan (2,3,4,5,6,10,12,48,60,96) je ne pogađa, svih 32 nose `HLK`/`APN`. Kontrola protiv backupa:
   samo 4 stupca dirnuta, Σ Uplata/Isplata **u cent**, `Tip`/`Podtip` 0 promjena. `Rate?=DA` 661→**629**.
3. **`make_financije_import.py` (novo)** — Review → `Activities Events` xlsx. Sve četiri tihe rupe
   ugrađene (`session_start` kao **tekst**, `Rate?` kao pravi bool, email u kol. G, imena atributa)
   + **guard koji uspoređuje svih 15 imena I tipova protiv generirane strukture** i prekida ako se
   ne poklapaju — jedina obrana od tihog preskakanja (`excelImport.ts:836` nema `else`).
   `--sample N` bira raznolik uzorak i **rezervira 3 mjesta za istu datum** (bez toga uzorak ne
   testira ono najrizičnije: `useActivities.ts:242` grupira po `session_start`).
   Verificirano simulacijom `parseLegend`→`parseDataRows`, ne pogledom.
4. **⚠ D1a POVUČEN, D1 iznimka za rate UKINUTA (nova D1b).** Sašino pitanje „zašto još čuvamo
   `Datum kupovine`?" razotkrilo je da atribut postoji **samo kao zakrpa za iznimku** koju smo istog
   dana ukinuli — uz `event_date` = uvijek dan kupnje bio bi doslovno jednak `event_date`-u na svakom
   retku (suvišan zapis po transakciji + suvišno polje u Kokinoj formi). **Izbačen iz strukture**;
   vraća se jednim nedestruktivnim importom ako zatreba kao povijesni anker. Ograda: datum 1. rate
   **nije** datum kupnje nego prve naplate (~ciklus kasnije).
5. **Rata tok → model B + novi model datuma:** sve rate jedne kupovine dijele **`event_date` = dan
   kupnje**; razlikuje ih **`Datum naplate`** (11./3. svakog sljedećeg mjeseca) i **pomak
   `session_start`-a za +1 min** (inače ih `useActivities` slijepi u jedan redak liste). `Rata br`
   1..N, iznos = ukupno/N, `Status=Planiran`. `generateRataDates` → `generateRataChargeDates`,
   nova `rataSessionStarts`; `RataModal` prikazuje naplate. **Povijest se NE mijenja** — Kokinih 629
   rata redaka zadržava `event_date` = mjesec naplate (pravi datum kupnje za većinu nije poznat);
   pogled po `Datum naplate` ostaje konzistentan za oboje, pogled po `event_date` ne.
   ⚠ **Ispravak ranije tvrdnje:** stari tok NIJE dvostruko brojao — `AddActivityPage.tsx:1237`
   **briše uneseni event** nakon generiranja rata.
6. **`Automations` sheet proširen na `rata`** (Faza 3 ✅) — 6 novih kolona (`TriggerAttr`,
   `CountAttr`, `AmountAttr`, `OverrideAttrs`, `CommentAttr`, `IndexAttr`), `TargetAttr` = kamo ide
   datum naplate. **Povod:** Finish nije okidao rata modal na `Financije_all` — ne bug, nego točno
   ona rupa koju je S107s zapisao (`automations.rata` išla je SQL-om). **Odsutnost NE briše** —
   stariji export bez tih kolona ne smije pobrisati konfiguraciju (inače bi popravak rupe uveo novi
   način tihog gubitka). Slugovi se provjeravaju protiv atributa te Aree; max 1 rata po Arei.
   Preostala rupa: **`export_profiles`**.
7. **Verifikacija:** simulacija novog Automations parsera nad generiranim sheetom (2 pravila,
   0 preskočenih); `typecheck` + `build` čisti. **Nijedan app test još nije odrađen** — T-S107t-1…7
   čekaju Sašu.
8. **Zamke zabilježene:** `npm` se mora pokretati iz direktorija projekta (ENOENT `package.json`);
   Browserslist poruka je upozorenje, ne greška; generirani structure/import fajlovi se brišu čim
   nastane novi (jutros je pogled u **BASE `events_export_preview`** umjesto u generirani file
   proizveo lažni nalaz „stara taksonomija").

**Done 2026-08-02 (S107u — S107t odtestiran u appu + 3 buga + `disable_save_plus` u roundtripu;
testovi: `Claude-temp_R/test-sessions/S107u_tests.md`):**
1. **S107t app testovi 7/7 PASS.** Potvrđeno na `Financije_all` u TEST-u: struktura (15 attr /
   2 automatike), `Rata br` vidljivost, **rata tok** (300/3 → 3 rate na danu kupnje, naplate
   11.09./11.10./11.11., `Rata br` 1..3, `Status=Planiran`, komentar `…· rata 3/3 · 100 od 300`,
   **bez** zapisa s punim iznosom), Activities import 10 zapisa (28.02.2023. = 3 reda
   09:00/09:01/09:02 ⇒ `session_start` kao tekst radi; Anja rata `Rate?=Yes`, `Broj rata` 96,
   `Rata br` 43), roundtrip u oba smjera (Activities re-import **0/0/10 unchanged** ⇒ `row_hash`
   skip), odsutnost `rata` retka ne briše konfiguraciju, Review 32 očišćena retka / `Rate?=DA` 629.
2. **BUG — nova Area gubila `comment_template`** (`structureImport.ts`): `dbAreas` je snapshot
   učitan **prije** importa, a `findOrCreateArea` novu Areu nije gurao u njega ⇒ §8 i §9 oboje
   rade `{ ...existingArea?.settings }` nad `undefined`, §9 piše preko §8. Fix: novi zapis odmah
   u `dbAreas`. (T-S107u-1)
3. **BUG — uvoz koji mijenja SAMO postavke nije okidao refetch** (`StructureImportModal.tsx`):
   `onImported()` se zvao samo uz `totalCreated > 0 || updated.attributes > 0`, a takav uvoz vraća
   sve nule ⇒ `nodes` ostaju stari, Edit panel prikazuje staru vrijednost, a **Save iz njega vraća
   cijelu staru snimku `settings` u bazu** (spread nosi i `automations` ⇒ tek uvezena rata
   konfiguracija tiho nestaje). Fix: bezuvjetni `onImported()` + `useEffect` sync u
   `StructureNodeEditPanel` (`useState` inicijalizator se pri re-renderu ne zove). (T-S107u-4)
4. **Novi brojač `updated.settings` + redak „Settings updated"** — §8 promjene prije nisu ulazile
   ni u jedan broj pa je modal javljao „Nothing to import" iako je prepisao postavke; uz to
   **dirty-check na `categories.settings`** (prije se svaki leaf prepisivao pri svakom uvozu,
   `settings` dodan u SELECT). (T-S107u-5)
5. **`disable_save_plus` u Structure roundtripu** — kolona `DisableSavePlus` (T, vidljiva,
   DV `TRUE/FALSE`) na Area retku; odsutnost kolone ne dira postavku, prazna ćelija = `FALSE`.
   `AreaSettings` roundtrip sad pokriva 3 od 4 ključa. (T-S107u-3)
6. **Backlog T-S107u-2 (bezopasno):** `groupAttributes` uzima `Default` s **prvog** retka grupe ⇒
   atributski `default_value` ovisi o redoslijedu (generator piše `*` zadnji, export prvi) →
   `Status.default_value` se klacka `Izvrsen`↔`null`. `default_map` netaknut, konvergira nakon
   jednog kruga. Fix: ignorirati `Default` na retku s `DependsOn`.
7. **Zamka pri testiranju:** kvačica u Area panelu je lokalno stanje forme — pokazuje tvoj klik
   dok ne pritisneš Save. Stvarno stanje se provjerava kroz **Add Activity** (je li „Save +" tu)
   ili novi export, ne kroz panel.

**Done 2026-08-04 (S107v — batch import 2026 + čitljive greške pri brisanju Aree;
testovi: `Claude-temp_R/test-sessions/S107v_tests.md`):**
1. **Batch import 2026 generiran** — `Financije_all_import_20260804_083908.xlsx`, **747 redaka**,
   02.01. → 11.07.2026. Verificiran protiv sve četiri tihe rupe (`session_start` tekst svih 747,
   0 duplih parova datum+vrijeme, `Rate?` pravi bool 107×, kolona G = račun koji uvozi).
2. **⚠ NALAZ — dva retka u Reviewu s krivim `event_date`** (nije bug u kodu; iskočili jer je batch
   sezao do 2026-12-01): **red 4996** (parking 1,60 €, stoji na 07.08.) — `Stanje` lanac ga
   zaključava u 04.–08.07., u cent s obje strane (`2144,34 − 1,60 = 2142,74`, pa `+1261 = 3403,74`);
   **red 4997** (MC 21,88 €, stoji na 01.12.) — `Datum naplate` 11.02.2026 je **10 mjeseci prije**
   kupovine, a jedina MC transakcija od 21,88 u tom razdoblju (31.12.2025 `PAYPAL *TEMU`) već je
   na redu 4247 ⇒ moguć duplikat, **čeka Kokin odgovor**. Odluka: **oba preskočena** rezom
   `--to 2026-07-31` (zadnji stvarni redak je 11.07.), Review netaknut.
   ⚠ Kad se 4996 riješi, **ne** generirati ga novim batchom — dobio bi `09:00` na već uvezen dan.
3. **`src/lib/deleteErrors.ts` (novo)** — `classifyDeleteError()` pretvara sirovu Postgres grešku
   iz Delete Area kaskade u naslov + objašnjenje + korake, s originalom iza „Technical details".
   Povod: brisanje stare `Financije_2` padalo je uz `23503 … event_attributes_event_id_fkey`, iz
   čega se ne vidi da je uzrok **RLS** — kaskada obriše samo *vidljive* `event_attributes`, pa
   `DELETE` na eventu padne preko skrivenih. Klase: FK violation, trigger `P0001`, `42501`,
   istekli JWT, mreža, fallback. `throwStep` sad baca `DeleteStepError` s PG poljima (`code`
   umjesto pogađanja po tekstu).
4. **Predprovjera vlasništva + `SilentNoOp`** (`StructureDeleteModal.tsx`) — grantee vidi amber
   „You are not the owner" i sva tri gumba za brisanje su disabled. **Bitnije:** RLS-blokiran
   DELETE ne javlja grešku nego uspijeva s **0 redaka**, pa je dosad izgledalo kao da je brisanje
   prošlo — `areas` DELETE sad ide s `.select('id')` i prazan rezultat daje „Nothing was deleted".
4b. **⚠ PRAVI UZROK pada brisanja — PostgREST `max-rows = 1000`, NE RLS** (nađeno kad je roster
   panel pokazao da su **sva 774 eventa Sašina**, čime je prva dijagnoza pala). Izmjereno na TEST
   bazi: `event_attributes` → `Content-Range: 0-999/24729`, **vraćeno 1000**. Svaki `select` tiho
   staje na 1000 redaka **bez greške**. `Financije_2` ima ~10.000 `event_attributes` ⇒ kaskada
   obriše prvih 1000, pa `DELETE` na eventima padne preko ostatka kao FK violation.
   **Fix:** `src/lib/supabasePaging.ts` (novo) — `fetchAllPaged`/`fetchAllPagedIn`; napreduje za
   **stvarno vraćeni** broj redaka (radi i ako je cap drukčiji od 1000), uz jedan prazan zadnji
   poziv kao cijenu. Primijenjeno na sva tri neograničena SELECT-a u kaskadi + roster.
   Verificirano na živoj TEST bazi: 24.729 redaka u 26 poziva (prije 1000 u 1).
   **Nije pogođeno:** `excelDataLoader.ts` (export + backup) je za granicu već znao
   (`.limit()`/`.range()`), `useActivities` koristi `.range()`. ⚠ Pravilo za ubuduće: svaki
   `select` koji mora vratiti *sve* retke mora paginirati — truncation je tih.
4c. **View nakon Finish ne otvara (PROD, Fitness/Strength) — dijagnostika, ne fix.** Simptom: nakon
   Finish View često ne otvori, Edit otvori, i nakon Edit→Save View radi. **Eliminirano dokazima:**
   format `session_start` (Edit i View traže evente **identičnim** upitom ⇒ mismatch bi srušio oba);
   `user_id` (PROD: 0 NULL, jedan `user_id`, `session_start` zaokružen na minutu); `categoryCache`
   truncation (PROD ima **30** kategorija). **Nađeno umjesto toga:** `_fetchActivityData` je hvatao
   **svaku** grešku i vraćao `null`, a `ViewDetailsPage` je `null` prikazivao kao „Activity not
   found" — isti mrtvi ekran za „nema zapisa" i za „upit je pukao", bez teksta greške i bez Retry.
   Zato bug nikad nije bio dijagnostičan (i zato je izgledao kao da je stvar u View-u, a ne u
   transientu). Fix: greška se propagira (`takeLastFetchError`), View razlikuje ta dva slučaja i
   nudi **„Try again"**. Pravi uzrok se hvata iduće pojave — T-S107v-7.
5. **`sql/033_delete_area_cascade.sql` (novo)** — generički cascade delete po UUID-u (⚠ ne po
   imenu; imena nisu jedinstvena po korisnicima), poopćen iz `029`. SECTION 2 je dijagnostika:
   čiji su `user_id` na atributima + **jesu li 4 policyja iz `020_orphan_rls.sql` uopće na toj
   bazi** — ako fale, to je uzrok i primjena `020` vraća UI brisanje u funkciju.

**Sljedeći koraci — ⚠ ZASTARJELO od S107m, prekrojeno S107q/S107s, v. `NEXT_SESSION_PROMPT.md`:**
1. ~~Fix `parse_zaba_racun`~~ ✅ S107j. ~~Konsolidacija~~ ✅ S107j. ~~Nematchano_v3 pass + date-accuracy
   + Datum naplate~~ ✅ S107k (v3 = 0). **Preostalo:** `Saldo kontrola` 7 razlika → pitanja za Koku
   (2026-01 +359, 2024-09 +149, 2×±49 multisport); 2 PRESKOČENA bankomat reda čekaju Kokin odgovor o 700 €.
1b. **Red 2115 (LJEKARNA OREBIC)** — ručno promijeniti Medical_Sasa → Medical_Koka (Kokin račun).
1c. **N/A petlja (`suggest_candidates.py`) — PRIORITET 2026** (85 preostalo, 68 s tekstom) pa PROD,
    zatim 2025/2024 (§2i). Isti obrazac kao S107l krugovi: suggest → Saša popuni → Claude pregleda
    (usporedi Primjer opis sa stvarnim Review retcima PRIJE harvesta, provjeri Taksonomija parove i
    person/account konzistentnost) → harvest → apply_rules --dry → potvrda → pravi run.
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

0. **Roundtrip completeness (S107s, Sašin princip)** — ~~`automations.rata`~~ ✅ riješeno S107t
   (`Automations` sheet nosi `rata` akciju). **Preostalo: `export_profiles`** — ključ kolone je
   `attr:Area||CatPath||AttrName` pa profil ne preživi promjenu imena aree ni atributa; fix =
   `ExportProfiles` sheet (export+import, replace-per-area, isti obrazac kao Faza 2b).
   ~~**Također `disable_save_plus`**~~ ✅ riješeno S107u — nova kolona `DisableSavePlus`
   na Area retku Structure sheeta (export+import, odsutnost kolone ne mijenja postavku).
   Od 4 ključa `AreaSettings` roundtrip sad pokriva `comment_template`, `automations` i
   `disable_save_plus`; **ostaje samo `export_profiles`**

**S107u bugfix — nova Area gubi `comment_template`** (`structureImport.ts`): `dbAreas` je
snapshot učitan **prije** importa, a `findOrCreateArea` novu Areu nije gurao u njega ⇒ za Areu
stvorenu u istom runu i §8 (`comment_template`) i §9 (`Automations`) rade
`{ ...existingArea?.settings }` nad `undefined`, pa §9 piše preko §8. Pogađa samo kombinaciju
„nova Area + CommentTemplate + Automations redak" (točno `Financije_all`); postojeće Aree su
imale zaštitu (`existingArea.settings = newSettings` nakon §8). Leaf `comment_template` je
preživio (§9 ne dira kategorije) pa se u appu nije vidjelo. Fix: novi zapis se odmah gura u
`dbAreas`. Test T-S107u-1.

**S107u — `disable_save_plus` u Structure roundtripu** (`structureExcel.ts` + `structureImport.ts`):
nova kolona **`DisableSavePlus`** (T, grouped+collapsed, DV `TRUE/FALSE`) piše se samo na **Area**
retku; import je čita u §8 zajedno s `comment_template` **jednim** upisom settingsa (prije su bila
dva odvojena spreada nad istim objektom). Odsutnost kolone = postavka se ne dira (isti princip kao
`rata` u §9); prazna ćelija = `FALSE`. Povod: Saša ju je morao ručno kvačiti nakon svakog uvoza
`Financije_all`. Test T-S107u-3.

**S107u — uvoz koji mijenja SAMO postavke nije okidao refetch** (`StructureImportModal.tsx`,
`structureImport.ts`): `onImported()` se zvao samo uz `totalCreated > 0 || updated.attributes > 0`,
a uvoz koji dira isključivo `comment_template`/`disable_save_plus`/automatike vraća sve nule ⇒
nema refetcha, `nodes` ostaju stari, Edit panel prikazuje staru vrijednost — i **Save iz takvog
panela vraća cijelu staru snimku `settings` u bazu** (`{ ...node.area.settings }` spread nosi i
`automations` ⇒ tek uvezena rata konfiguracija bi nestala; lost update, bez ijedne poruke).
Fix: `onImported()` bezuvjetno nakon uspješnog uvoza + novi brojač `updated.settings` (§8 promjene
prije nisu ulazile ni u jedan broj, pa je modal javljao „Nothing to import" iako je prepisao
postavke) + dirty-check na `categories.settings` (prije se svaki leaf prepisivao pri svakom uvozu;
`settings` dodan u SELECT). Uz to `StructureNodeEditPanel` sinkronizira `disableSavePlus`/
`commentTemplate` na promjenu `node`-a (`useState` inicijalizator se pri re-renderu ne zove).
Testovi T-S107u-4/5.
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
