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
- Collab UX Design (S35): `docs/COLLAB_UX_DESIGN_v1.html` — wireframe dizajn za sve collab scenarije (Owner, Grantee write/read, Share Management, User indicator, Excel format, Request access flow); D1–D10 open decisions čekaju potvrdu
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
  - **OPREZ dok fix ne dođe na PROD (main)**: Save u Structure Edit panelu na PROD appu (mobitel!) i dalje tiho briše crtice iz slugova — izbjegavati spremanje panela za kategorije čiji atributi imaju `-` u slugu (npr. `broj-rata`)

### Open bugs (main)

- **BUG-1:** `useFilter must be used within a FilterProvider` na `AppHome.tsx:105` — vjerojatno StrictMode artefakt, nizak rizik
- **E7/E8/E9 parallel:** Playwright padaju pri 4 workers (duplicate key na data_shares); prolaze `--workers=1`
- **Bulk delete (checkbox) nije ograničen za grantee-a** — backlog
- **BACKLOG — "Import as mine" za write grantee unutar iste shared aree nema smisla:** Pravi put je Leave Area (Detach with data) ili normalan re-import u novu vlastitu area; flag samo, nije implementirano.
- **BUG-S103-ANYATTR:** "In any attribute" filter (`ATTR_FILTER_ANY` u `eventQueryBuilder.ts`) timeouta za grantee-e — `ILIKE` nije leakproof operator, Postgres evaluira RLS EXISTS za cijelu `event_attributes` tablicu. Privremeno: amber notice u UI (`AppHome.tsx` kad `sharedContext` aktivan + `selectedFilterAttr === ATTR_FILTER_ANY`). Pravi fix: SECURITY DEFINER RPC — **odgođeno za S105+** (procjena 4-6h, vidi docs/FABLE_PLAN.md I.5).

~~BUG-S102-DELETE~~ — ✅ Riješeno S104 (live recount u `StructureDeleteModal.tsx`).
~~UX-Import-1~~ — ✅ Riješeno S104 (progress bar, Fable Q4).

### Prioriteti za S106 (bivši S105 plan — S105 je potrošen na PROD incident triage)

1. **BUG-S103-ANYATTR pravi fix** — SECURITY DEFINER RPC za "In any attribute" pretragu koja zaobilazi ILIKE+RLS non-leakproof problem
2. **FilterContext koraci 2+3** (Fable I.4) — tipizirani event bus (`appEvents.ts`), eventualno split FilterProvider/SharingProvider
3. **Diary archaeology session** (docs/Diary.md §3) — audit skripta + mapping tablica s korisnikom
4. **Export + Python klasifikacija** — export obje Financije area-e, Python skripta predlaže Tip/Podtip
5. **Bulk update** — reimport xlsx s ispravljenim Tip/Podtip vrijednostima
6. **Garmin/Sleep skripta** — kad se nađu DI-Connect-Wellness fajlovi

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
- Faza 3: Excel Automations sheet (generalni engine)
- Faza 4: Training parser/inverz (čeka `trening.xlsm` analizu)

**Structure Edit UX cleanup** (`StructureNodeEditPanel.tsx`, nema DB promjena):
1. Collapsible attribute kartice — `collapsedAttrs: Set<string>` (po attr.id), persist u localStorage key `structAttrCollapsed:<nodeId>`; collapsed header (1 red): name + type badge + sort broj + chevron ▶/▼ + trash ikona; "Collapse all / Expand all" gumb (prikaže se kad 3+ atributa)
2. `suggest` direktno u "New attribute" formi — odabir u Type `<select>` (interno: data_type='text' + val_type='suggest' + options textarea); `→ Suggest` gumb na postojećim text atributima ostaje
3. Help docs update — `docs/help/structure.md` sekcija "Editing attributes": tipovi, suggest opcije, default_value, depends_on, slug rename

**⭐ Help "What can I do here?" chip** — standing chip `"✨ What can I do on this screen?"` po `pageHint` kontekstu; zahtijeva `docs/help/*.md` sekcija "Feature inventory" s detaljnim opisima po stranici/kontekstu — **mora biti dosta detaljno** (korisnikov izričit zahtjev)

**AI Help sistem** — ✅ kompletno (S59–S81): Haiku FAB, 3 taba (Pitaj AI / Koncepti / Povratna info), dinamički load `docs/help/*.md`, context chips po pageHint. **Pravilo:** `docs/help/*.md` = jedini izvor istine za feature docove. `help.ts` statički prompt = samo Demo Area putanje + pravila tona.

**Template system** — ✅ kompletno (S49–S58). Template user (`VITE_TEMPLATE_USER_ID` env var), "From template" flow, Demo Area na PROD, E11/E12 Playwright. Budući: Garmin API adapter (schema za external source mapping).

**Financije reorganizacija** — Tip/Podtip bulk klasifikacija: export obje area-e, Python skripta `classify_na_events.py` (`data-prep_tools/Financije/`), reimport xlsx s ispravljenim Tip/Podtip. Plan u `Claude-temp_R/FINANCIJE_TIP_PODTIP_PLAN.md`.

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
