# Done History — Events Tracker React

Session-by-session history extracted from CLAUDE.md during S104 cleanup.
Active project state is in CLAUDE.md (repo root).

---

## Done S1-S33: Jezgra aplikacije (Activities, Structure, Excel roundtrip)

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


---

## Done S34–S72: Collab system + Foundation

### Collab implementation (S34–S48)

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
- Collab Faza 8 — Profile settings modal (header avatar → modal, display_name edit, sign out) — S42
- Collab Faza 9 — Help panel (modal: poboljšan tekst + ❓ mobile toggle; grantee banneri: "What can I do?" collapsible) — S42
- Collab Faza 10a — Events sheet: User kolona G (email); attr kolone od I; uklonjen user_id filter (RLS); batch email lookup — S43
- Collab Faza 10b — Structure sheet: SharedWith kolona D (pipe-separated emails, Area-only); `loadSharedEmailsByArea` — S43
- Collab Faza 10c — HelpEvents + HelpStructure ažurirani za novi format — S43
- Bugfix (S43 session): `structureImport.ts` — uklonjen `.eq('user_id')` filter na categories + attr_defs; RLS handle-a access
- Collab Faza 10e — Smart import (S44): `parseExcelFile` čita col G (User email), klasificira own/foreign redove; `confirm-users` modal korak (Skip / Import as mine); BUG-2 fiksiran
- S45 bugfixes: `cellStr` hyperlink fix; empty legend fix; `👤` owner u View/Edit headeru; `useActivities` groupKey uključuje `user_id`; Prev/Next nosi `userId` u URL + filtrira query; `loadParentAttrs` koristi event owner userId; export mergira parent event atribute u leaf
- S46 bugfixes: BUG-S45-1 — Prev/Next fix (Opcija A): `ActivitiesView` pre-builduje navActivities + prosljeđuje via `location.state`; skip option u `useActivities`; ViewDetailsPage koristi state listu; owner display — vlastiti event prikazuje email (ne "You"); tuđi event → Area: ownerEmail + Activity: foreignEmail u header; EditActivityPage "Tuđi zapis" → amber box s Area owner + Activity owner
- S47 UX fixes: Import gumb u empty state (`ActivitiesTable`); FilterContext stale areaId reset (`areas-changed` handler validira da UUID još postoji, inače `reset()`); `ExcelImportModal` scrollable (`max-h-full flex-col`) — gumbi dostupni i s dugim listama
- Faza 11 — Merge na main (S48): `009_sharing.sql` dodan unique constraint `data_shares_unique_share`; 008+009 pokrenuti na PROD; `collab` → `main` merge; Netlify deploy OK; tag `v1.0-collab`

### S49–S72: Templates, E2E, Add Between, Help, perf

- S49: Template user setup u TEST bazi; RLS policies; `useAreas.ts` template filter; `activity-attachments` bucket
- S50–S51: Playwright E2E — instalacija, `playwright.config.ts`, `auth.ts`, `filter.ts`, `seed.sql`, E1–E10 specs; selector tuning; `data-testid` na `CategoryChainRow`; svi E1–E10 prolaze
- S52: Template "From template" flow — `StructureAddAreaPanel` radio toggle; `useTemplateAreas()` hook; slug filter (bug fix: `n.area.user_id === userId`); preview async counts; copy logic (area + categories + attr_defs s UUID remapiranjem); `e2e/tests/e11-template.spec.ts` E11-1 do E11-5 prolaze; `deleteAreaCascade` helper u auth.ts
- S53: BUG-S52-1 fix — root cause DATA BUG u TEST bazi (sve template kategorije imale area_id = Health UUID); `sql/011_template_fix_area_ids.sql` UPDATE script; `sql/010_template_seed.sql` → `ON CONFLICT DO UPDATE SET area_id`; `StructureAddAreaPanel` defensive `.eq('user_id', TEMPLATE_USER_ID)` filter; E11-3 provjerava točne countove (3 cats, 2 attrs); svi E11 prolaze (5/5); T-S53-3 manualni smoke ✅
- S54: Structure tab filter segments (Mine/All/Templates) — stanje podignuto u `StructureTabContent` u `AppHome.tsx`; segmenti vidljivi iznad i Tablea i Sunbursta; slug-based exclusion: already-copied templates skriveni iz "All"/"Templates" segmenata; `StructureSunburstView` dobio `nodeFilter` prop; S54b bugfix: filter logic popravljan — `copiedTemplateAreaIds` set filtrira po `areaId` da isključi i area i sve njene kategorije; E12 spec (5/5 pass)
- S55: Add Category Between (Scenarij A) + Collapse Level (Scenarij D) implementirani; `StructureAddBetweenPanel.tsx`, `StructureCollapseLevelPanel.tsx`; E13-1/E13-2 Playwright (prolaze)
- S55b: Collapse Level bugfixes + UX — (1) `event_attributes` INSERT nedostajao `user_id` → vrijednosti bile nevidljive zbog RLS; (2) leaf direktno dijete: `maybeSingle()` pucao na 2+ leaf eventa u sesiji → prebačeno na loop po svim leaf eventima; (3) slug konflikt isti tip sada prebacuje vrijednosti na postojeći attr def umjesto skip-a; (4) slug konflikt različit tip → warning s listom; modal tekst: "will become a direct child of X", amber: "will be reassigned down to X"; E13 Playwright fix: force Table view u `goToStructure()`, strict-mode locator za Strength
- S56: Collapse Level bugfix — non-leaf direktno dijete: `maybeSingle()` tiho pucao kad query vrati 0/2+ redova → vrijednosti preskočene; fix: zamijenjeno loopom (isti pattern kao leaf branch); T-S55-4 ✅
- S56: UX-F1 — "Reset cat." u `ProgressiveCategorySelector`: `resetCategory()` resetira samo Category, Area ostaje netaknut; label promjenjen na "Reset cat."
- S56: UX-M1 — `useTouchSwipe` hook u `ViewDetailsPage`: swipe lijevo = Next, swipe desno = Prev; vertical scroll ne interferira
- S56: "Add Leaf" rename — `CategoryChainRow` ⋮ menu: "+ Add Child" → "+ Add Leaf" (sve 3 instance: area, non-leaf, leaf)
- S56: Slug rename u `StructureNodeEditPanel` — inline edit slug na attr defu; amber border kad promijenjeno; Reset gumb; auto-update depends_on referenci u allNodes; nema utjecaja na event_attributes (veza je UUID, ne slug)
- S56: Collapse Level pre-collapse warning — `incompatibleSlugs` useMemo prikazuje warning PRIJE collapse (ne nakon); inline rename input po konfliktu u modalu; green "✓ All conflicts resolved" kad sve riješeno; placeholder "new name for 'slug' on child"
- S56: Collapse Level fresh fetch fix — `freshChildAttrsMap` state fetchan na mount (bez `user_id` filtera, RLS handle-a); i warning UI i `handleCollapse` koriste isti map; `handleRenameConflict` refresha map nakon rename → stale allNodes props više ne uzrokuju krive INSERT-e; T-S55-5/6 ✅
- S57: ViewDetailsPage prefetch cache — `src/lib/activityViewCache.ts` (LRU 7 entry-a, ms-normalized key); `loadActivityData` koristi cache; prefetch ±3 susjeda u pozadini dok korisnik čita
- S57: `CategoryDetailPanel` swipe — `useTouchSwipe` hook dodan; swipe lijevo = Next node, desno = Prev node
- S57: Structure area collapse — `CategoryChainRow` dobio ▼/▶ chevron za area redove + "N hidden" badge; `StructureTableView` — `collapsedAreaIds` state, `visibleRows` filter, "Collapse all / Expand all" gumb (prikazuje se kad 2+ areaa); panel Prev/Next navigira kroz `visibleRows`
- S57: AddAreaPanel duplikat zaštita — provjera po imenu (case-insensitive) za "empty" mode (inline error) i "template" mode (template se ne pojavljuje u dropdownu ako postoji area s istim imenom ili slugom)
- S57: AttributeChainForm localStorage expand persist — `attrExpanded:<categoryId>` u localStorage; korisnikova preferencija (otvori/zatvori) pamti se per-category; radi za Add i Edit Activity
- S61: Help sistem UX refaktor — `src/context/HelpContext.tsx` (global state: isOpen, pageHint); `App.tsx` refaktoriran: jedan `FilterProvider` + `HelpProvider` za sve `/app/*` rute, `AppShell` s nested Routes + `HelpOverlay`; `HelpPanel.tsx` rewritan: FAB (fixed bottom-right, globalno vidljiv na svim stranicama i modalima), draggable header (drag → floating 400×580, Pin → docked), context chips (3 brza pitanja po kontekstu: activities/structure/add/edit/view), context reset (chat se briše kad se Help otvori iz drugog konteksta), engleski UI; `AppHome.tsx` — uklonjen `showHelp` state i `HelpButton` iz headera, dodan `setPageHint(activeTab)` effect
- S62: BUG-S61-1 fix — toast error na fail; `ProgressiveCategorySelector` uvijek mounted (filter collapse ga više ne unmountira); `sql/015_activity_presets_rls.sql` pokrenut na PROD (missing INSERT policy)
- S63: Delete Shortcut auto-select — `useEffect` u `ProgressiveCategorySelector` auto-selektira preset kad `filter.categoryId` odgovara nekom presetu (fix za browser restart koji briše sessionStorage)
- S63: Help Concepts tab — treći tab s glosarijem (Core Concepts / Key Behaviors / Design Decisions s trade-offovima)
- S63: Help Structure chips update — Structure stranica: "What does the ⋮ menu do?" + "How do I share an area?"
- S63: Edit Activity chip fix — "What happens when I change the time?" (bilo: "What is delta shift?")
- S63: docs cleanup — 10 obsolete spec fajlova → `docs/obsolete/`; `Claude-temp_R` old artefakti → `Claude-temp_R/obsolete/`
- S63: `docs/HELP_STRUCTURE.md` — referentni dokument za help sistem (chip map, context detection, Content Evolution Protocol)
- S64: Permissions fix — `isOwnedArea` prop na `CategoryChainRow`; edit akcije i Manage Access skriveni za tuđe areae u "All" view (root cause: `sharedContext` = null bez area filtera)
- S64: Add Between na area ⋮ meniju — `StructureAddBetweenPanel` podržava area parent (level=0); L1 djeca traže se po `areaId`, INSERT s `parent_category_id = null`
- S64: Add Above na leaf ⋮ meniju — novi `StructureAddAbovePanel`; INSERT Y na razini lista (isti parent), UPDATE leaf parent=Y level++; eventi netaknuti; siblizi nepromijenjeni
- S64: `help.ts` system prompt — ispravljen opis Add Between (novi čvor ISPOD odabranog) i Collapse Level (djeca GORE, atributi DOLJE); docs/help/structure.md opis ažuriran
- S66: Perf — `category_full_paths` recursive CTE view (`sql/016_category_paths_view.sql`); `useActivities.ts` refaktoriran: `buildCategoryPath` N+1 loop uklonjen, zamijenjen jednim batch queryjem na view; pokrenuto na TEST + PROD. Stranica 20 eventa s 8 unique kategorija: ~32 querija → 1.
- S66: `dev:prod` npm script + `.env.prod.local` (gitignored) za lokalni dev server koji koristi PROD Supabase bazu
- S67: Save+ toggle po Arei — `settings jsonb` na `areas` tablici (`sql/017_area_settings.sql`); `disable_save_plus: true` flag; `FilterContext` fetchuje area i eksponira `disableSavePlus`; `ActivityHeader.tsx` conditionally renderira Save+ gumb; `StructureNodeEditPanel` checkbox "Disable Save+" u Area edit panelu
- S68: Health tracking — `make_health_events.py` (Korak 3): čita `Bloodwork.xlsx` sheet "Krv", filtrira `zdravstveni` redove, generira `Health_events_import.xlsx` (45 Lab Results + 13 Medical Visit); `range_flags()` generira H/L comment (samo out-of-range vrijednosti, format "Kolesterol H · Feritin L"); 2 preskočena retka (bez datuma / invalid date)
- S68: Excel Export poboljšanja — (1) attr kolone sortirane po `sort_order` iz DB (ne abecedno); (2) Description dodana u ATTRIBUTE LEGEND (col G, 7 kolona ukupno); (3) Max/Min/Sum redovi iznad EVENT DATA s `SUBTOTAL(4/5/9)` i dinamičkim LOOKUP rangem; redovi grupirani (outlineLevel=1); label u col H desno poravnan
- S68: `data-prep_tools/` direktorij u korijenu repoa (tracked) — Python skripte za data preparation; `venv/` i `*.xlsx` gitignored; `Tools/`, `Health/`, `Financije/` poddirektoriji
- S68: PROD deploy: Health_Sasa struktura + 58 eventa importani; Area preimenovana u "Health_Saša"
- S69: Invite sustav — `netlify/functions/send-share-invite.ts`: verifikacija JWT, insert `share_invites` PRIJE `inviteUserByEmail()` (izbjegava race s DB trigger chainom), šalje Supabase invite email s `invited_by` + `area_name` kontekstom; `useDataShares.ts createShare`: za neregistrirane korisnike poziva Netlify funkciju umjesto direktnog inserta; `ShareManagementModal.tsx`: prosljeđuje `areaName`; `AuthPage.tsx`: detektira `#type=invite` u URL hash, čita email iz JWT tokena (ne aktivne sesije — bugfix), prikazuje set-password formu s pre-fillovanim emailom i porukom tko poziva; `npm run dev:netlify-prod` script (dotenv-cli, mergea .env.local + .env.prod.local); Supabase "Invite user" email template prilagođen
- S70: Invite sustav — clean URL + message box + expired token handling: `generateLink` umjesto `inviteUserByEmail` (nema rate limita); Clean invite URL `/invite/:id`; `sql/018_invite_action_link.sql`; `netlify/functions/get-invite-link.ts`; `src/pages/InviteRedirectPage.tsx`; `ShareManagementModal.tsx` message box s TO + SUBJ + body; `AuthPage.tsx` `setSession()` fix + expired token detection; `AppHome.tsx` + `StructureTableView.tsx` localStorage persist za activeTab/structureViewMode/nodeFilter/collapsedAreaIds
- S71: Migration tools + Garmin Activities import: `common_excel.py` (shared library), `supabase_structure_export.py`, `excel_import_template.py` (referentni template), `db_inspector.py`, `garmin_full_field_audit.py`, `garmin_activities_to_xlsx.py` — 3134 aktivnosti (2015–02/2025), `pace` kao text "MM:SS", `location` attr via Nominatim reverse geocode, 555 zona cachirano u `geocode_cache.json`; `data-prep_tools/MIGRATION_STATE.md`; Garmin distance u cm (ne meters!) → ÷100000 za km
- S72: Reorganizacija direktorija — `data-prep/` → `data-prep_tools/` (tracked scripts); `Claude-temp_R/Data_preparation/` → `data-prep_data/` (gitignored data: xlsx, DataFromGarmin, Health, Financije)

---

## Done S73–S103: UX + Data + Fixes

**Napomena S77:**
- SharedAreaBanner OwnerBanner UX — skraćen na jedan red: `🔗 This Area is shared` + `⚙ Manage Access`; "Structure changes affect all users" premješteno u Edit Mode toolbar (`StructureTableView`) — prikazuje se s lijeve strane "+ Add Area" gumba samo kad `areaHasActiveShares`
- Garmin Daily Metrics importer — `Health_Sasa > Daily_metrics > Garmin_data`; 3624 eventa (2014–2025); HR Rest/Min, Body Battery, VO2max, Steps, Active Min, Calories, Avg Stress, Training Status; importano u TEST ✅
- Docs cleanup (README, PENDING_TESTS, CLAUDE.md), SAVE_PLUS_TOGGLE_SPEC obrisan, Koka Health_Saša pristup potvrđen. Sleep/HRV stubovi u strukturi, čekaju DI-Connect-Wellness fajlove.

**Napomena S73:**
- View Activity — `unit` dodan kao sivi suffix uz numeričke vrijednosti (`75.4 min`, `4.86 km`); `activityViewCache.ts` fetchuje `unit` iz `attribute_definitions`; prikazuje se samo za `data_type='number'`
- `description` atributa prikazan u zagradi uz naziv (`Zeljezo (Ref: 9–30 μmol/L)`); fetchuje se u `activityViewCache.ts`
- Leave shared area: grantee može se odvojiti od shared aree via ⋮ meni → "Leave this area"; write grantee s eventima dobiva modal s 2 opcije: "Detach with data" (kopira strukturu + batch-reassigna evente/attrs na nove UUID-ove) ili "Leave without data"; `sql/019_leave_area.sql` proširuje `data_shares_delete` policy; `src/lib/leaveArea.ts` + `src/components/sharing/LeaveAreaModal.tsx`

**Napomena S74:**
- `detachAreaWithData` bugfix — leaf event imaju `chain_key = NULL` (AddActivityPage ne upisuje chain_key na leaf INSERT); pairMap key bio `"catId:null"` → `catIdMap.get("null") = undefined` → silent skip leaf eventa; fix u `leaveArea.ts`: eksplicitni `'null'` string check, leaf event dobiva `category_id` update, `chain_key` ostaje null
- Activities "All Areas" — User kolona prikazuje se kad owner ima ijedan aktivan share (ranije samo kad je specifična area odabrana); fix u `FilterContext.tsx`: null-areaId branch sada queryja `data_shares` za bilo koji aktivan share umjesto immediate `false`

**Napomena S75:**
- Orphan events feature — `useOrphanUsers.ts` hook (batch `data_shares` query → `orphanedUserIds`); amber `OrphanBanner` (View events / Manage gumbi); `OrphanManagementModal` (per-user: Re-invite → ShareManagementModal, Claim all → UPDATE user_id, Delete all → CASCADE delete); `filterOrphans` bool u FilterContext → ActivitiesTable chip + client-side filter; amber ring + ⚠ badge na avataru za orphan redove; ⋮ menu "Manage orphan events"; `area_id` dodan u `ActivityGroup`; `sql/020_orphan_rls.sql` — owner UPDATE/DELETE policy na tuđim eventima u vlastitim areasima

**Napomena S76:**
- Grantee zaštita podataka — 3 featuera: "Revoke with events" dialog (amber dialog s 3 opcije: Revoke only / Claim events / Delete events); "Take your data" gumb (`SharedAreaBanner.tsx` WriteGranteeBanner); Invite acceptance warning (`AuthPage.tsx`); Help system update: `netlify/functions/help.ts` system prompt + `docs/help/sharing.md` + `docs/help/activities.md`; E15 Playwright (3/3 pass)
- S76b bugfixes: `shares-changed` CustomEvent — `FilterContext` + `StructureTableView` + `SharedAreaBanner` sada re-fetchaju share status odmah nakon invite/revoke; `useOrphanUsers` false positive fix: check `areas.user_id = currentUserId` prije označavanja kao orphan

**Napomena S78:**
- `loadAttrsForEvents` u `excelDataLoader.ts` — dodan `.limit(chunk.length * 50)` override; bez toga Supabase default 1000-row cap truncirao attrs za evente s 10+ atributima po chunku od 200 (200×10=2000>1000); vidljivi simptom: najnoviji eventi imali prazne kolone u xlsx exportu dok su stariji radili ispravno
- Garmin Daily Metrics importan u PROD ✅. Health_Sasa Medical struktura fix importan u PROD ✅. Header left-align u xlsx exportu. `compare_xlsx.py` alat dodan. S78 mergean na main.
- Export attrs bugfix: `loadAttrsForEvents .limit()` + ATTR_CHUNK_SIZE 200→80

**Napomena S79:**
- Help FAB prekrivao ⋮ Actions meni — `ActivitiesTable` i `StructureTableView` scroll containeri dobili `pb-20` (80px); zadnji red tablice uvijek scrollable iznad FAB-a na mobilnom

**Napomena S80:**
- `dev:netlify-prod` fix (--port 8889 + dotenv -o; netlify re-injektira .env.local pa za PROD pregled koristiti `npm run dev:prod`). Supabase PROD Site URL ispravljen (bio Streamlit, sad Netlify). Garmin_data dedupliciranje: `fix_garmin_duplicates.py` — 1000 duplikata obrisano iz TEST. Medical cleanup: `delete_by_comment.py` — 8 IZBRISATI eventa obrisano iz TEST. Export paginacija bug: `loadEventsForExport` udario u Supabase 1000-row cap; fiksano paginacijom po 1000 unutar funkcije. Health_Sasa TEST čist (3716 eventa), spreman za PROD import.

**Napomena S81:**
- Comment filter implementiran — `commentSearch` u `FilterState`, `.ilike('comment', '%text%')` u `useActivities`, text input u filter baru (Activities tab), chip u `ActivitiesTable` header; `navActivities` i `ActivitiesTable` oba koriste `commentSearch`. Health_Sasa PROD import potvrđen T-S80-3 ✅.
- Help docs — dinamički load: `netlify.toml`: `included_files = ["docs/help/**"]` — fajlovi bundlani uz funkciju; `help.ts` refaktoriran: `STATIC_PROMPT` (pravila + Demo Area) + `HELP_DOCS` (čita svih 7 `.md` fajlova via `fs.readFileSync`); `concepts.md`: uklonjen meta-komentar koji nije bio namijenjen AI-u

**Napomena S82:**
- SharedAreaBanner UX kompresija — read i write grantee banneri svedeni na 1 kompaktni red (`👁 Read-only access` / `✅ Write access` + `[ℹ Info]` gumb). Info otvara modal s owner emailom, copy email i listom dozvola. Owner Structure row: sharing badge uklonjen email username, ostala samo 🔗 ikona (+ broj ako >1 grantee).

**Napomena S83:**
- "Contact owner" message draft u Info modalima — `ReadGranteeInfoModal` i `WriteGranteeInfoModal` dobili "Contact owner" gumb umjesto "Copy email"; otvara TO/SUBJ/body message draft (identičan UX kao invite modal u ShareManagementModal); `← Back` vraća na info prikaz; oba modala fetchaju grantee email za personalizaciju.

**Napomena S84:**
- UX-Mobile-1 implementirano — `ActivitiesTable.tsx`: desktop `<tr hidden sm:table-row>` + mobilni `<tr sm:hidden>` (2 ćelije: main content + sticky ⋮); `<thead hidden sm:table-header-group>`; Import/Export `hidden sm:flex` u headeru tablice. `AppHome.tsx`: mobilni Import/Export gumbi u filter sekciji (dispatchu `activities:open-import`/`activities:open-export` CustomEvente); `ActivitiesView` sluša iste. Desktop layout netaknut.

**Napomena S86:**
- Bug fix: suggest atributi u make_import.py — `Structure` sheet pisao `AttrType='suggest'`; DB ne prihvaća 'suggest' kao `data_type` (valjani: number/text/datetime/boolean/link/image); suggest atributi tiho preskočeni pri importu. Fix: `AttrType='text'` + `Val.Type='suggest'` (suggest = data_type='text' + validation_rules). Pravilo dokumentirano u `data-prep_tools/Tools/excel_import_template.py`.
- Bug fix: StructureDeleteModal error display — `catch` blok prikazivao genericku "Delete failed" jer Supabase `PostgrestError` nije `instanceof Error`. Fix: `(err as {message?:string})?.message` prikazuje stvarnu DB grešku u modalu.
- Bug fix: StructureDeleteModal cascadeDelete — `cascadeDelete(false)` (no-events path) nije brisao `events`/`event_attributes` → FK constraint `event_attributes_attribute_definition_id_fkey` pucao ako su eventi djelomično importani. Fix: uvijek čisti events za kategorije (stale `eventCount` u UI ne blokira cleanup).
- Bug fix: StructureDeleteModal activity_presets FK (S87) — Delete Area pucao s FK constraint `activity_presets_category_id_fkey` ako je postojao shortcut na nekoj kategoriji u subtreeu. Fix: `cascadeDelete` briše `activity_presets` gdje `category_id IN categoryIds` prije brisanja `attribute_definitions` i `categories`.
- Financije_2 importana u TEST — 458 eventa (2026-01 do 06), 39 atributa (uključujući svi suggest dropdowni), 20 kategorija. Struktura: Prihodi (Plaća/Najam/Ostali) + Rashodi (Dom/Svakodnevni/Restoran/Prijevoz/Zdravlje/Trening/Pretplate/Razvoj/Kupovina/Telekomunikacije/Rate/Porezi/Putovanje/Ostalo) + Transferi.
- S86b: `default_value` primjenjuje se u Add Activity — `AddActivityPage.tsx` dobio `useEffect` koji inicijalizira `attributeValues` s `default_value` kad se atributi učitaju (samo za atribute koji nisu već u mapi → draft restore nije ugrožen); `touched: true` osigurava da se default sprema; primjer: Valuta → EUR pre-selected.
- S86b: Iznos bez EUR unit — `make_import.py` uklonjen `unit='EUR'` s Iznos atributa; Structure re-import updateirao 3 attr_defs (EUR → null)

**Napomena S87:**
- `make_financije3_import.py` refaktoriran — flat struktura (Transakcija = leaf, nema L2 Kategorija); svih 8 atributa pod Transakcija; bad-date redovi uključeni s fallback datumom + `[DATUM_GREŠKA: ...]` u Napomeni; out-of-range datumi auto-korigirani (2005→2025 +20yr, 2036→2026 -10yr) ili fallback; leaf_comment = `RF: [Napomena]` / `ZABA: [Napomena]`
- Financije_3 importana u TEST — flat, 3163 eventi; Activities tablica prikazuje `ZABA: Parking`, `RF: Mirovina I stup` itd.; View Activity: jedna Transakcija sekcija s 8 atributa + leaf badge
- 41 DATUM_GREŠKA redova u bazi (pretraživivi via comment filter "DATUM_GREŠKA"); 3 SKIP (balance rows bez iznosa)

**Napomena S88 — Shortcut pre-fill (`default_attributes`) + UX bugfixes:**
- `sql/022_preset_default_attributes.sql` — `activity_presets.default_attributes JSONB` dodan; pokrenuto na TEST + PROD ✅
- Filter-bar "💾 Save Shortcut" — info nudge ("💡 Did you know?") prvi put kad shortcut nema atribute, objašnjava da treba Add Activity za defaults; localStorage flag `ui:shortcutAttrTipDismissed` pamti "Don't show again"
- Add Activity "💾 Save as Shortcut (with these attribute values)" gumb — sprema `touched` atribute kao `default_attributes`; ako kategorija već ima shortcut → choice modal (Update postojećeg / Save as new / Cancel); inače name-input modal
- Pre-fill efekt proširen — preset `default_attributes` ima prednost nad statičkim `attr.default_value`; oba poštuju "ne prepisuj postojeću/draft vrijednost" (`prev.has(attr.id)`)
- "⚡ Use" fast-lane gumb (`ProgressiveCategorySelector`) — kad je odabran shortcut koji vodi do leafa, preskače Activities tablicu i odmah otvara Add Activity (`onUseShortcut` prop, `canUseShortcut` derived check uključuje `sharedContext?.permission !== 'read'`)
- Bugfix — broken shortcut (kategorija obrisana u Structure): `handleShortcutSelect` detektira `error || !category`, zove `resetCategory()`, postavlja `brokenShortcutId`, prikazuje `toast.error` + amber warning banner s "Delete shortcut" linkom
- Bugfix — mobile auto-collapse: `onLeafSelected` dobio treći param `source?: 'manual' | 'shortcut'`; `AppHome.handleLeafSelected` ne kolabira filter sekciju na mobilnom kad je leaf odabran preko shortcuta
- Bugfix — Delete Shortcut button vizualni kontrast: enabled `bg-red-100 border-red-200 text-red-700`, eksplicitni `disabled:bg-red-50 disabled:border-transparent disabled:opacity-40`
- Bugfix — duplikat imena shortcuta: case-insensitive provjera u `handleSavePreset` (filter bar) i `handleConfirmSaveNewShortcut` (Add Activity)
- `docs/help/activities.md` — nova sekcija "Shortcuts (brzi pristup)"; `HelpPanel.tsx` `CHIPS.add` dobio "How do I save my values as a Shortcut?"

**Napomena S89 — Perf: filter persist + chain cache + skeleton rows:**
- `FilterContext`: filter state prebačen na `localStorage` (sessionStorage → localStorage); app se otvori s restauriranim Area+Category filterom iz prethodne sesije
- `useCategoryChain`: sessionStorage cache po `categoryId` (`chain_v1_<id>`); drugi Add Activity za isti shortcut preskače SELECT * FROM categories; explicit `refetch()` invalidira cache
- `ActivitiesTable`: loading spinner zamijenjen skeleton tablom (7 animate-pulse redova, desktop+mobile)
- `data-prep_tools/Financije/match_sasa_napomene.py` — matchira 'Što' opise iz 'Za Sašu' sheeta s export datotekom po ključu (datum, iznos); col R output za ručni pregled; 96 matchiranih, 9 duplikata (narančasto)
- `data-prep_data/Financije/FINANCIJE_MODEL.md` — prijedlog novog data modela: Račun + Izvor plaćanja (Direktno/Visa/Mastercard/Cash) + Tip (kategorija troška) + Napomena; Transfer = interni, nije pravi trošak; za razgovor s Kokom

**Napomena S91:**
- `default_value` polje dodano u `StructureNodeEditPanel` — novo polje vidljivo za sve tipove osim boolean, u formi postojećih atributa i u "New attribute" formi; INSERT + UPDATE šalju `default_value` u DB
- `depends_on` visibility za non-text tipove — `AttributeChainForm.tsx`: number/boolean/datetime atributi skriveni/prikazani prema parent vrijednosti (bez dropdown opcija, samo visibility control)
- `structureImport.ts` deduplication fix — prazni slug → `makeAttrSlug(name)` fallback + name-based lookup; drugi import istog xlsx-a ne stvara duplikate
- `netlify.toml` — dodan `[dev]` section (`targetPort=5173, port=8888`); blank page fix za `npm run dev:netlify`
- **Hide-if-default** u `AttributeChainForm.tsx` — atributi čija je vrijednost jednaka `default_value` skrivaju se pri otvaranju forme; toggle "Prikaži sve / Sakrij"; `userEditedIds` Set (odvojeno od `touched` koji je za save logiku); reset na promjenu kategorije
- Bugfix: `touched: true` (pre-fill S86b) više ne sprječava skrivanje defaulta — koristi `userEditedIds.has(attr.id)` umjesto `!currentValue?.touched`
- **Structure Edit UX cleanup backlog** (spec za S91+ sprint, ~4-5h ukupno, sve u `StructureNodeEditPanel.tsx`, nema DB promjena):
  1. Collapsible attribute kartice — `collapsedAttrs: Set<string>` (po attr.id), persist u localStorage key `structAttrCollapsed:<nodeId>`; collapsed header (1 red): name + type badge + sort broj + chevron ▶/▼ + trash ikona; "Collapse all / Expand all" gumb (prikaže se kad 3+ atributa)
  2. `suggest` direktno u "New attribute" formi (data_type='text' + val_type='suggest' + options textarea); `→ Suggest` gumb na postojećim text atributima ostaje
  3. Help docs update — `docs/help/structure.md` sekcija "Editing attributes"
- **Konfiguracija za Stanje (uvijek skriven):** `DependsOn=smjer, WhenValue=SKRIVENO`
- **Konfiguracija za Uplata/Isplata (depends_on visibility):** SQL ili Excel import s `DependsOn=smjer, WhenValue=Uplata/PROVJERI` (za Uplata) i `WhenValue=Isplata/PROVJERI` (za Isplata)

**Napomena S92:**
- `netlify-cli` 25.3.0 → 26.1.0 + `netlify.toml [dev] framework = "vite"` — blank page s Vite 7 riješen; `npm run dev:netlify` radi (T-S92-4 ✅)
- `_` sentinel u Activities Excel importu (`excelImport.ts`) — `_` briše vrijednost atributa (zaobilazi P3); novi eventi tretiraju `_` kao prazno; `hasChanges()` detektira `_` kao promjenu (T-S92-1,2,3 ✅)
- `_` sentinel u Structure Excel importu (`structureImport.ts`) — `_` u Default koloni = `default_value = null`; implementirano istovremeno (T-S92-5 ✅)
- Structure import bugfix — `default_value` nije bio u SELECT, dirty checku ni UPDATE payloadu; sva 3 mjesta dodana (T-S92-6 ✅)
- Help docs — `structure.md`: "Atributi u Edit panelu" + `_` sentinel za Default kolonu; `activities.md`: vidljivost polja + `_` sentinel za xlsx

**Napomena S93:**
- Attribute filter u filter baru (`AppHome.tsx`): dropdown koji prikazuje atribute aree/kategorije; suggest → select s opcijama; text/number → text input; chip u tablici s × za brisanje; `FilterContext` proširen s `attrFilter: { attrDefId, value, isExact }`
- Rata modal (`src/components/activity/RataModal.tsx`): post-Finish automation za Financije_3; triggerira se kad `Na rate?=Da`; generira N rata s iznosom Iznos/N, datumima 11. u sljedećim mjesecima, Status=Planiran; `sql/023_rata_config.sql` za `rata_config` tablicu
- `generate_rata.py` Python tool za batch generiranje rata iz CSV-a

**Napomena S93b:**
- URL length bug (`useActivities.ts`): pre-fetch pristup koristio `.in('id', thousands_ids)` → URL > 8KB → silent fail → "Error loading activities"; fix: PostgREST `!inner` join — filter server-side, nema URL limita
- Statement timeout (`sql/024_event_attributes_indexes.sql`): nema indexa na `event_attributes(event_id, attribute_definition_id, attribute_definition_id+value_text)` → query skenira cijelu tablicu, timeout 8s; 3 indexa kreirana, pokrenuto na TEST + PROD
- Import duplicates (`excelImport.ts`): `smartReclassify` koristio `.in('id', 3163_ids)` → isti URL limit → sve reklasificirano kao CREATE → 3163 duplikata; fix: chunked query po 200 IDs; `sql/fix_financije3_import_duplicates.sql` za cleanup TEST baze
- PostgrestError propagation (`useActivities.ts`): `PostgrestError` nije `instanceof Error` → catch blok gubio stvarnu poruku; fix: `pgErr?.message` direktno u `setError(new Error(...))`
- Filter dropdown dedup bug (`AppHome.tsx`): atributi importani prije S91 imaju slug=`''`; deduplication kolabirala sve empty-slug atribute na prvi; fix: preskači dedup za prazne slugove
- Filter dropdown ancestor walk (`AppHome.tsx`): koristio `selectionChain` (async state, može biti stale); fix: direktni DB walk od `filter.categoryId` gore → determinističan
- ⬜ SQL slug fix (opcionalno): pokrenuti u Supabase SQL Editor (TEST + PROD): `UPDATE attribute_definitions SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g') WHERE slug IS NULL OR slug = '';`

**Napomena S94 (2026-06-16):**
- Rata modal bugfixes: `sql/023_rata_config.sql` pokrenut na TEST; `amount_slug` ispravljen na `"isplata"`; `date_map` ključevi → `{"Mastercard": 11, "Visa": 3}`; `comment_attr_slug: "napomena"` dodan
- Rata modal: original event briše se nakon "Kreiraj rate" (`pendingRataOriginalEventIds` + DELETE); `navigate('/app')` umjesto success dialoga s broken Edit gumbom
- `buildRataComment`: `rata 1/3 · 150 od 300` format
- Preskoči: `na_rate → false`, `broj_rata → null` UPDATE na original eventu
- Export attrFilter: `ExportFilters.attrFilter` + `!inner` join u `countEventsForExport` + `loadEventsForExport`
- `RataAutomationConfig.comment_attr_slug` optional field u `database.ts`
- Svi T-S93-7..T-S93-12 potvrđeni; T-S93-12 by design (Broj rata skriven kad Rate?=Ne)
- `sql/025_prod_rata_config.sql` kreiran za PROD deploy
- PROD SQL deploy (S94 session): slug fix (hyphens→underscores na Financije attr_defs); `trigger_slug` ispravljen na `"rate"` (PROD attr se zove "Rate?" → slug `rate`, TEST je "Na rate?" → `na_rate`); rata modal spreman za Koka testiranje

**Napomena S95:**
- Boolean/number atributi u depends_on dropdownu — `StructureNodeEditPanel` filtrirao na `data_type === 'text'`; fix: uklonjeni filtri za same-level i ancestor atribute
- `parseValidationRules` — `dropdown.depends_on.mapping` format (Record<string,string>) sada se konvertira u `optionsMap` (Record<string,string[]>) i postavlja `result.dependsOn`
- "→ true" vizualni artefakt uklonjen iz `AttributeInput.tsx` (dependency hint ispod zavisnih polja)
- Debug console.log cleanup u `useAttributeDefinitions.ts` (parseValidationRules + exercise_name logovi)
- **Auto-comment template** — `comment_template` string u `area.settings` (default) i `category.settings` (leaf override); `CommentTemplateField` UI u `StructureNodeEditPanel` sa slug dropdown helperom i live preview; `src/lib/commentTemplate.ts` (resolveCommentTemplate + evaluateCommentTemplate); `AddActivityPage` evaluira template na Finish ako korisnik nije upisao Event Note; `sql/026_category_settings.sql` (categories.settings JSONB kolona)
- Structure Excel export/import — nova kolona S "CommentTemplate"; Area red = area template, Leaf red = override; Data Validation input message; import čita kolonu i update-ira settings; `_` briše template

**Napomena S96:**
- **Shared filter helper** (`src/lib/eventQueryBuilder.ts`): `applyEventFilters()`, `attrFilterJoinClause()`, `resolveLeafCategoryIds()` — `useActivities.ts` i `excelDataLoader.ts` oboje koriste isti helper; `ExportFilters` proširen s `commentSearch` → Export sada poštuje comment filter
- **Dynamic periods**: `useDateBounds.ts` preseti dobili stabilan `PeriodKey` tip (e.g. `this-year`, `last-3-months`); dodani "Last 2 Months" i "Last 3 Months"; `FilterState.periodKey` u FilterContext; `DateRangeFilter` koristi keys umjesto labels
- **Shortcut filter_state**: `sql/027_preset_filter_state.sql` — `activity_presets.filter_state JSONB`; Save Shortcut (filter bar + Add Activity) sprema periodKey + sortOrder + commentSearch + attrFilter; Load Shortcut restaurira filter state s `resolvePeriodKey()` (dinamički resolve); `PresetFilterState` tip u `database.ts`
- **Export Profile system**: `src/lib/exportProfile.ts` — `readProfileFromWorkbook()`, `applyProfileToWorkbook()`; ExcelExportModal: Preview (10 rows), Import Profile (čita column grouping state iz xlsx), profile dropdown, Delete profile; profili spremljeni u `area.settings.export_profiles`; `AreaSettings` proširen; profile name u Filter sheetu + filename
- **LEGEND col F: Unit → Default** — `excelExport.ts` LEGEND cols sada prikazuju `default_value` umjesto `unit`; import netaknut (ne čita col F)
- **Suggest Data Validation**: attribute kolone s suggest opcijama dobivaju Excel Data Validation dropdown u exportanom xlsx-u; inline formulae za ≤255 znakova; `suggestOptions` dodan u `AttrMeta`
- **Filter sheet proširenja**: novi redovi `Period key`, `Comment filter`, `Attribute filter`, `Export profile`

**Napomena S97:**
- **Shortcut filter_state reset bugfix** — prebacivanje između shortcuta nije resetiralo `attrFilter`/`commentSearch`/`sortOrder` kad target shortcut nema `filter_state` ili nema te specifične vrijednosti; root cause: (1) `handleShortcutSelect` postavljao attrFilter ali AppHome `useEffect` na `filter.categoryId` odmah brisao; (2) `else` grana (no filter_state) resetirala samo dateRange. Fix: `skipNextFilterReset` ref u FilterContext — shortcut handler postavlja flag, AppHome reset effect ga čita i preskače; explicit reset svih polja u oba brancha
- **"In any attribute" filter** — nova opcija u filter dropdown: `ATTR_FILTER_ANY` sentinel (`__any__`) u `eventQueryBuilder.ts`; `applyEventFilters` preskače `attribute_definition_id` filter za `__any__` (traži `value_text` ilike u svim atributima); AppHome: opcija vidljiva kad postoje attr defs; text input za pretragu; radi i u Exportu (shared eventQueryBuilder)
- **Non-leaf shortcut saving** — `canSaveShortcut` proširen: dozvoljava save kad je odabrana bilo koja kategorija ILI samo area (ne samo leaf); `handleSavePreset` prihvaća null `categoryId`; `handleShortcutSelect` area-only branch: učitava L1/L2, postavlja filter bez kategorije; "⚡ Use" gumb ostaje samo za leaf shortcuts
- **Dependent dropdowns u Excel exportu** — INDIRECT + hidden "DropdownData" sheet (bez VBA!); `AttrMeta` proširen sa `slug` + `dependsOn`; `ExportAttrDef` dobio `slug` field; `addDependentDropdowns()` u `excelExport.ts`: skenira attrs s `dependsOn`, kreira DropdownData sheet s kolonama po parent_value, definira Named Ranges, postavlja `INDIRECT("Dep_slug_"&SUBSTITUTE(...))` Data Validation; SUBSTITUTE chain pokriva: space, `/`, `-`, `.`, `(`, `)`, `,`, `:`, `+`, `&`; statički suggest dropdowni preskačeni za attrs koji imaju dependsOn (handled by INDIRECT)
- **Non-text atributi skriveni iz filter dropdowna** — number/boolean/datetime koriste `value_number`/`value_boolean`/`value_datetime` u DB; text-based `ilike` filter na `value_text` ne radi za njih; hint poruka "N numeric/other attributes not shown — use Excel Export to filter by those." kad postoje skriveni
- **selectedFilterAttr reset bugfix** — prebacivanje na shortcut bez attrFilter nije resetiralo dropdown na "Comment"; sync useEffect sada resetira na 'comment' kad `filter.attrFilter` postane null
- **Shortcut info dialog tekst** — "Did you know?" dijalog ažuriran: sada navodi da shortcut pamti i filtere (period, sort, attr filter)
- **Broken area-only shortcut detekcija** — area-only shortcuti sada detektiraju obrisanu area; toast error + amber broken shortcut banner s "Delete" opcijom
- **GIN trigram index** — `sql/028_value_text_trigram_index.sql`: `pg_trgm` extension + GIN index na `event_attributes.value_text`; potrebno za "In any attribute" filter performance (ILIKE s vodećim wildcarddom); pokrenuto na TEST + PROD ✅

**Napomena S99 (2026-06-25) — Delete Area fixes + Financije PROD reorganizacija:**
- **Backup scope fix** (`excelBackup.ts`): `exportFullBackup` sada prima opcionalni `areaId` + `areaName` → backup samo za tu area, ne cijelu bazu; `fullBackupFilename` generira `backup_AreaName_timestamp.xlsx`
- **cascadeDelete robustnost** (`StructureDeleteModal.tsx`): (1) error checking na SVIM koracima; (2) step indicator u error poruci (`[delete events] P0001 — message — details`); (3) `data_shares` + `share_invites` cleanup prije brisanja aree; (4) `event_attachments` DELETE samo ako postoje (skip ako 0); (5) `event_attributes` DELETE po PK (SELECT IDs → chunked DELETE by id)
- **"Delete without backup"** gumb u Delete modalu — sekundarna opcija (crveni tekst link) za slučaj kad backup nije potreban
- **Financije PROD obrisana** via `sql/029_delete_financije_prod.sql` (postgres role, zaobilazi RLS + DB trigger koji je blokirao UI delete jer je vidio 2118 eventa nevidljivih kroz RLS)
- **Financije_old (pre-2026)** importana na PROD, Koka dobila read-only pristup
- **Financije (2026+)** — Koka importala na PROD kao owner (struktura kreirana via Structure Import, pa Events Import)
- Root cause "Bad Request" grešaka: (1) full backup svih 7000+ eventa → Supabase query fail; (2) expired auth token (`Invalid Refresh Token`); (3) DB trigger `P0001` blokira DELETE kad RLS-nevidljivi eventi postoje

**Napomena S100 (2026-06-27) — Export Profile column order/widths + Filter override + bugfixes:**
- **BUG-S99-IMPORT fix** — `excelImport.ts`: composite key `${area_name}||${full_path}` u svim `catByPath` mapama + `areaName` parametar u `getHierarchyLevels`; lookupovi koriste `${row.area}||${row.category_path}`; error poruka sad kaže "not found in area 'X'"
- **Dependent dropdown diacriticals fix** — `excelExport.ts`: `transliterateDiacriticals` (č→c, ć→c, š→s, ž→z, đ→d) primijenjen u `sanitizeNamedRange` I u SUBSTITUTE chain INDIRECT formule; "Kokin tekući ZABA" sada producira isti named range name na obje strane
- **Export Profile column order** — `readProfileFromWorkbook` čita LEGEND redove u redoslijedu iz xlsx-a; `getProfileAttrOrder` reorder-ira attrColumns prema profilu; `addActivitiesSheetsTo` prima `attrColumnOrder?: number[]`; kolone u exportu slijede raspored iz profila
- **Export Profile column widths** — `ExportProfileColumn.width` dodan; `readProfileFromWorkbook` čita `col.width`; `applyProfileToWorkbook` postavlja custom width za svaku kolonu
- **Export Profile filter overrides** — `ProfileFilterState` tip (periodKey, sortOrder, commentSearch, attrFilterRaw); `readFilterFromWorkbook` čita Filter sheet; profil sprema filterState; `ExcelExportModal` prikazuje "📋 Profile includes filter overrides"; `doDownload` primjenjuje filter overridee iz profila (date range, sort, comment, attr filter)
- **Attr filter raw format** — `<attrDefId>: =<value>` (exact) / `<attrDefId>: ~<value>` (partial); korisnik može editirati Filter sheet u xlsx-u, promijeniti filter, reimportati kao profil

**Napomena S101 (2026-06-28) — Financije PROD fixes + Tip/Podtip reorganizacija:**
- Broj rata depends_on slug fix — DependsOn referencirao `na_rate` umjesto stvarnog sluga `rate`; popravljeno via Structure Edit panel na PROD
- Rata config re-applied — nova Financije area (nakon S99 reimporta) nije imala `settings.automations.rata`; SQL postavio config s ispravnim slugovima za obje area-e
- `date_map_slug: racun` — rata datumi se sada računaju po Racunu (ZABA→11., RF→3.) umjesto po Izvoru plaćanja; `date_map` ključevi promijenjeni na račun imena
- Rata modal testiran — 3 × 150 = 450, datumi 11.07/08/09 (Mastercard dan za ZABA) ✅
- SQL 030 Tip/Podtip — `sql/030_financije_tip_podtip.sql` pokrenut na PROD; Tip opcije ažurirane, Podtip atribut kreiran s depends_on na Tip
- ⬜ `classify_na_events.py` — Python skripta za keyword klasifikaciju N/A evenata kreirana (`data-prep_tools/Financije/`); generira xlsx s predloženim Tip/Podtip
- `FINANCIJE_TIP_PODTIP_PLAN.md` — dizajn dokument v2 u `Claude-temp_R/`; Kokine izmjene: spojeno Domaćinstvo (bez Normal/Specijalno), auti po vozilu (C5/Lacetti), detaljna Informatika (svaki streaming servis), Zdravlje vraćeno; Povrat Nataša/Zoran pod Domaćinstvo Podtip (neto kalkulacija)

**Napomena S102 (2026-06-29) — default_map + attr filter slug + Structure Import fix:**
- **`default_map` u depends_on sustavu** — per-WhenValue default vrijednosti; `validation_rules.depends_on.default_map`; Izvor=Visa→Status=Planiran, Izvor=Račun→Status=Izvršen
  - `useAttributeDefinitions.ts`: `ParsedAttributeOptions.dependsOn.defaultMap` + `getDefaultForDependency()`
  - `structureImport.ts`: čita Default kolonu per-WhenValue → gradi `default_map`
  - `structureExcel.ts`: piše Default kolonu per-WhenValue iz `default_map`
  - `AttributeChainForm.tsx`: parent promjena → `default_map[parentValue]` umjesto `null`
  - `AddActivityPage.tsx`: second pass u default pre-fill useEffect za shortcut pre-fill
  - `StructureNodeEditPanel.tsx`: editabilno "default" polje uz svaki WhenValue red
- **Structure Import slug-based grouping** — key `${categoryPath}||${slug || attrName}`; fiksira mismatch kad bazni red ima "Izvor placanja" a DependsOn redovi "Izvor" (isti slug)
- **Attr filter slug format** — UUID → slug u Filter sheet exportu; `parseAttrFilterRaw()` prihvaća slug, UUID i `*`; Comment/Attribute filter uvijek prisutni; Data Validation input message
- Help docs — `docs/help/structure.md`: `default_map`, `*` wildcard, uvjetni default sekcije

**Napomena S102b (2026-06-30) — bugfixevi pronađeni tijekom S100/S102 testiranja:**
- Period dropdown display bug (`DateRangeFilter.tsx`) — `activePresetKey` se izvodio usporedbom `localFrom/localTo` s `bounds.minDate/maxDate` umjesto da čita `filter.periodKey` direktno; Fix: dropdown sad trusta `filter.periodKey`
- Export Profile attrFilterRaw override bug (`ExcelExportModal.tsx`) — `applyProfileFilterOverrides()` interno zvao `parseAttrFilterRaw()` BEZ `attrDefs`, pa je slug-based override tiho failao; Fix: `attrDefs` se resolvaju PRIJE poziva
- `all-time` periodKey override bio no-op — `resolvePeriodKey('all-time')` namjerno vraća `null`, ali override kod nije imao posebnu granu; Fix: eksplicitna grana koja postavlja `dateFrom/dateTo = null`
- Novi `custom` periodKey override — Period key = `custom` + eksplicitni Date From/To (plain `YYYY-MM-DD` text) u Filter sheetu sad rade kao profil override; `ProfileFilterState.dateFrom/dateTo` dodano; `readFilterFromWorkbook` ih čita SAMO kad je Period key = `custom`
- `_` sentinel za Attribute filter — prazna ćelija = nema override (naslijedi live filter); `_` = eksplicitno obriši filter
- "Period label" red uklonjen iz Filter sheeta (bio redundantan/zbunjujuć duplikat Period key-a, nije se čitao pri importu)
- Period key / Sort order Data Validation dropdownovi dodani na Filter sheet
- HelpEvents sheet — novi "EXPORT PROFILES" odjeljak
- Bugfix: Excel "We found a problem with some content" greška — Data Validation `promptTitle` (>32 znaka) i `prompt` (>255 znakova) premašili Excel-ove hard limite; skraćeni tekstovi; pravilo dodano u Critical rules
- `docs/help/excel.md` — prošireno: Export Profile workflow, Filter sheet override semantika, `_` sentinel

**Napomena S103 (2026-07-03) — RLS fix + grantee guardovi + FilterContext abort:**
- `sql/031_rls_exists_fix.sql` pokrenut na TEST i PROD (odgođeno s 2026-07-01 na 2026-07-03 zbog Supabase platform incidenta — PROD bio Unhealthy) — `event_attr_select`/`event_attach_select` RLS: EXISTS umjesto IN(subquery); specific-attribute filter za grantee sad radi (T-S103-1 djelomično ✅, vidi BUG-S103-ANYATTR u CLAUDE.md Open bugs)
- Export Profile grantee guard (`ExcelExportModal.tsx`): jasna error poruka na Import Profile + toast na Delete Profile kad je `sharedContext` aktivan (read-only grantee ne može pisati u `area.settings`)
- `FilterContext.tsx` — `restoreAbortedRef` abort mehanizam: `reset()` odmah gasi `isRestoring`/"Restoring filter..." umjesto čekanja na pending Supabase pozive iz `doRestore`
- BUG-S103-IMPORT-GRANTEE riješen: Import gumb (Activities Excel Import) nije bio skriven za read-only grantee-a; sad skriven na sva 3 mjesta (`ActivitiesTable.tsx` header + empty-state, `AppHome.tsx` mobile chip), isti pattern kao Add Activity guard
- Flag (NE implementirano): "Import as mine" za write grantee unutar postojeće shared aree stvara besmislene duplikate — pravi put je Leave Area ili re-import u novu vlastitu area
- Export profili (`area.settings.export_profiles`) su area-level, ne per-user — svi korisnici s pristupom vide iste profile
- Bugfix: `evaluateCommentTemplate` null detekcija (`src/lib/commentTemplate.ts`) — otkriveno T-S95-10: kad su SVI placeholderi prazni, literal separatori između njih preživljavali su trim (`"///".trim()` nije prazan string) → comment se spremao kao `"///"` umjesto `null`. Fix: broji `filledCount`; ako template ima 1+ placeholder i nijedan nije popunjen → vrati `null`
- T-S100-6/7 dovršeni — `~` partial i `*` any-attribute kao Export Profile attrFilterRaw override potvrđeni; Import Profile toast s column order+widths+filter overrides info potvrđen


---

## Done S104-S107y: Perf, collab fixevi, Financije pipeline

> Preseljeno iz CLAUDE.md tijekom destilacije (2026-08-15).
> Zamke iz ovog bloka koje vrijede i dalje **promaknute su** u CLAUDE.md
> sekcije "Critical rules" i "Zamke" - ovdje ostaje kronologija.

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
puni handoff: `NEXT_SESSION_PROMPT.md`, testovi: `docs/sessions/tests/S107m_tests.md`):**

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
testovi `docs/sessions/tests/S107n_tests.md`):**
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
ENRICH_PLAN §2m, testovi `docs/sessions/tests/S107o_tests.md`):**
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
testovi `docs/sessions/tests/S107r_tests.md`):**
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
detalji `NEXT_SESSION_PROMPT.md`, testovi `docs/sessions/tests/S107s_tests.md`):**
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
Automations roundtripu; detalji `docs/sessions/tests/S107t_tests.md`):**
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
testovi: `docs/sessions/tests/S107u_tests.md`):**
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
testovi: `docs/sessions/tests/S107v_tests.md`):**
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

**Done 2026-08-04 (S107w — `Delete?` kolona + izvještaj nakon uvoza kao radni file;
testovi: `docs/sessions/tests/S107w_tests.md`):**
1. **Kolona `Delete?` u exportu** (`excelExport.ts`) — skroz desno uz `row_hash`, **vidljiva**
   (nikad grupirana), dropdown **samo `DELETE`** + prazno (namjerno NE `TRUE`/`FALSE`: to koriste
   obični booleani poput `Rate?`, a `TRUE` je najvjerojatniji preživjeli nepažljivog fill-downa),
   **crveni CF** na označenom retku, **unutar autofiltera** (inače Excelov sort raspari zastavicu
   od retka i brisanje pogodi krivi zapis). Odsutnost kolone = ništa se ne briše (kao
   `DisableSavePlus`).
2. **Import** (`excelImport.ts`): kolona se traži **skeniranjem zaglavlja**; bilo koja druga
   vrijednost = **greška koja prekida uvoz** (tiho ignoriranje je način da se izgubi brisanje koje
   je korisnik htio). **⚠ Redoslijed:** delete se odvaja **prije** `row_hash` skipa — otisak pokriva
   samo polja zapisa, pa bi nediran redak sa zastavicom matchao svoj hash i ispao kao „unchanged".
   **Kopirani redak označen DELETE = greška**, ne brisanje (kopija nosi originalov `event_id` ⇒
   obrisao bi zapis na koji se poziva drugi redak). Redak bez `event_id`: ništa za brisati **i ne
   kreira se**.
3. **`applyDeletes()`** — briše označene leaf zapise, pa **tek kad ode zadnji zapis sesije** ruši
   parent lanac (`chain_key` = leaf kat.), isto pravilo kao `AppHome.handleDeleteActivity` (S104,
   Fable I.1); ključevi lanca dolaze iz **DB redaka pročitanih prije brisanja**, ne iz Excel
   vrijednosti. Attachmenti i iz storagea, popis **paginirano** (`fetchAllPagedIn`); `DELETE` ide
   s `.select('id')` jer RLS-blokiran DELETE „uspije" s 0 redaka. Brisanja se izvršavaju **prije**
   create/update ⇒ pad zaustavi uvoz prije ijednog upisa, a u istom fileu se smije obrisati zapis
   i sesiju ponovo izgraditi.
4. **Delete guard** (`ExcelImportModal.tsx`) — **zaseban popis i zasebna kvačica**, odvojeni od
   update-guarda; po zapisu: datum, kategorija, komentar, broj atributa, fotografije, oznaka
   „zadnji zapis sesije → parent zapisi idu s njim". Apply zaključan dok obje potrebne kvačice
   nisu označene.
5. **`src/lib/excelImportReport.ts` (novo) — izvještaj JE radni file**, ne log: običan export s
   točno dirnutim zapisima (pravi `event_id`, ispravan `row_hash`, `Delete?` dropdown na njemu),
   skida se **automatski** nakon Applya ⇒ petlja *uvoz → izvještaj → označiš krivu kopiju `DELETE`
   → uvezeš taj isti file*. Kolone `Result`/`Source row`/`Changed` skroz desno — **provjereno u
   kodu**: `parseDataRows` čita fiksne A–H, LEGEND kolone i `row_hash`/`Delete?` po zaglavlju, sve
   desno se ignorira. Sheetovi `ImportReport` + `Deleted` (obrisane se ne može izvesti). Workbook
   se **sastavlja u jednom prolazu** — ExcelJS load/save roundtrip ne jamči očuvanje DV/CF/skrivenog
   `DropdownData` sheeta, a to je upravo ono što file čini editabilnim. Novo:
   `loadEventsByIdsForExport()` + `mergeParentAttrsIntoEvents()` (izvučeno iz `loadExportData`).
6. **`hasChanges()` uklonjen** — apply put koristi `computeRowDiff()` izravno (treba mu popis
   polja za `Changed` kolonu); single source of truth ostaje jedan.
7. **Testovi:** novi `e2e/tests/S107w_delete_column.spec.ts` (T-S107w-1/2/3 PASS na živoj TEST
   bazi); regresija E2, E3, E6×3, S107_row_hash×3, S104_import_progress×3 — **11/11 PASS**.
   `S104_delete_bug` pao u batchu pa **prošao sam** (leftover redci prekinutog pokušaja —
   `beforeEach` inserta bez čišćenja), ne regresija. ⚠ **Zamka u E2E:** testovi koji dijele
   komentar i `session_start` — ostatak prekinutog pokušaja ne izazove grešku nego **koliziju**,
   Apply postane „All skipped" i to izgleda kao pad featurea; sad cleanup **po prefiksu**.

**Sljedeći koraci (stanje 2026-08-13, nakon S107y):**
1. **Dogovor o Fazi 1** (RPC `balance_by_group`, `sql/035_area_group_agg.sql` — ⚠ ne 034,
   zauzeo ga `034_s107w_test_area.sql`) — sljedeći session, Sašin zahtjev.
2. **Batch 2024, pa 2023** — generirati **tek nakon** Pitanja-za-Koku vetting prolaska za
   svaki period (isti obrazac kao 2025/S107y); ne pripremati unaprijed (S107y odluka —
   vetting je usko grlo, ne generiranje).
3. ~~Saldo kontrola 7 razlika~~ ✅ S107y (#8–14: "ne sjećam se", ostaje rezidual, dizajn
   dopušta). ~~700€ bankomat~~ ✅ S107y (#3: točno je, zbroj podizanja).
3b. **Red 2115 (LJEKARNA OREBIC)** — ručno promijeniti Medical_Sasa → Medical_Koka (Kokin račun).
3c. N/A petlja (`suggest_candidates.py`) za 2024/2023 — isti obrazac kao S107l krugovi,
    radi se usput s vettingom prije svakog batcha.
4. **Pravila iterativno sa Sašom.** Preostali kandidati (ENRICH_PLAN §2e): `paypal` ostatak,
   `spotify` ostatak, porez grupa, `leasing`, `bmove`, `keks pay`, `zagrebparking`.
5. Ručni testovi T-S107b-3..6 (Add prefill UX + Automations sheet roundtrip); T-S107f-3
   (UI fix shortcut/skriveni atributi, PROD/mobitel — još netestirano)
6. Import pod **Kokinim accountom** (D6) nakon svih batcheva + spot-check; stare Financije
   aree obrisati NA KRAJU (backup!)
7. Diary archaeology (non-blocking)
8. Split-workbook (Taksonomija/Pravila/Preimenovanja → zaseban file) — opcionalno, kad Saša poželi

### S107x — Overview tab: zašto Koka još bira svoj Excel (2026-08-11, odluke; NEMA koda)

**Puni spec: `docs/OVERVIEW_TAB_SPEC.md` + vizualna skica (link u §Vizualna skica).**

1. **T-S107v-1 ✅** — batch 2026 (747 eventa) uvezen u TEST pod Sašinim accountom; dokazano
   exportom od 11.08. Lanac `Review → generator → import` radi.
2. **F1 — dijagnoza: aplikacija ne radi posao zbog kojeg Koka koristi Excel.** Njen kriterij
   je jedan (*koliko je na računu, slaže li se s bankom*), a `Stanje` je u appu **obično polje
   koje netko upisuje**, ne izračun. Ona ne bira lošije — bira bolje, po svom kriteriju.
   Aplikacija ima tri prednosti koje Excel nema: zbroj ne može puknuti (njena `=F655+D656-E656`
   je lanac, zbroj po računu je neovisan o redoslijedu), rate se ne parkiraju ručno
   (`Status: Planiran → Izvršen` + rata modal), i **mobitel** (ona gleda banku na telefonu).
3. **⚠ Ispravak pretpostavke iz `Analytics_tab.md` §3** („bucketiranje client-side, stotine
   sesija"): vrijedi za period, **ne za pogled na cijelu Areu**. Financije → ~5.000 eventa ×
   13 atributa ≈ **65k `event_attributes`** ⇒ S105 timeout + tiho krivi rezultat zbog
   PostgREST `max-rows 1000`. **Agregacija mora u Postgres (RPC)** — uvjet ispravnosti, ne
   optimizacija. Isti RPC sloj je pravi fix za **BUG-S103-ANYATTR**.
4. **Model pločice:** `areas.settings.dashboard.widgets[]`, slug-based, isti obrazac kao
   `automations`/`export_profiles`. Tipovi v1: `balance_by_group`, `breakdown`, `trend`,
   `count`, `latest`. Fitness nema saldo jer nije konfiguriran — **ne** jer je kod drukčiji.
   Tri pravila za RPC: `SECURITY DEFINER` mora **sam** provjeriti pristup (inače leak preko
   cijele baze); **P2 parent eventi se nikad ne zbrajaju** (dvostruki iznos); čita se
   `value_number`, ne parse teksta.
5. **Redoslijed:** (0) Delete testovi → PROD · (1) `balance_by_group` = F1 fix · (2) brzi unos ·
   (3) **Koka proba na mobitelu = prava vaga** · (4) Overview tab + `Dashboard` sheet u
   roundtripu · (5) batchevi 2025/2024/2023 + cutover · (6) cross-Area kad postoji druga gusta
   Area. Koraci 0 i 1 su neovisni. **Ako korak 3 padne, njen Excel ostaje trajni ulaz i
   pipeline se automatizira umjesto gasi — legitiman ishod, ali mora se izabrati svjesno.**
6. **F2 — sudbina `Financije_review` workbooka:** `Preimenovanja` **gotova** (bila sprava za
   jednu situaciju); `Taksonomija` **već preseljena** u `Structure` sheet od `Financije_all`
   (kopija u Reviewu je zastarjeli duplikat); `Pravila`+`Neklasificirano` **žive dalje, ali
   nad app exportom** — alati ne umiru, mijenjaju ulazni file. Identitet retka postaje
   `event_id` umjesto nestabilnog `source_key`, otpada ~13 od 30 kolona skele. Novo mjesto =
   mali „Pravila workbook" sa strane (Sašin split-workbook prijedlog iz S107g, sad ima razlog).
   Kokina delta ne ide kroz Review uopće (`FINANCIJE_MIGRACIJA.md` §13).
7. **Otvoreno prije koda: OQ-1…OQ-6** (spremanje usklađenja · brzi unos kao profil vs zaseban
   ekran · rate u saldu ili pored · Area bez konfiguracije · ostaje li atribut `Stanje` ·
   ograničiti Koki Structure).
8. **Dopune nakon prve skice (Saša, isti dan):** redoslijed tabova →
   **`Overview → Activities → Structure`** (prava se NE diraju — ona je vlasnik po D6, pa bi
   zaključavanje vratilo ovisnost o Saši); **klik na račun = dva drilla** (iznos → Activities
   filtriran na račun; „+ planirano" → isti račun + `Status=Planiran`);
   **⚠ automat `Planiran → Izvršen` po dospijeću ODBAČEN** (spec §2.5a) — dospjeli datum nije
   dokaz da je banka naplatila, pa bi automat **sam proizveo razliku prema banci**, tj. napao
   jedini kriterij zbog kojeg bi prešla. Asimetrija: ako ne flipne, saldo je u zaostatku i
   **ona to vidi**; ako flipne krivo, saldo je pogrešan i **izgleda točno**. Umjesto toga
   **„Dospjelo → potvrdi"** (pojedinačno + skupno) — traka **iznad** „Stanje po računu", i samo
   kad ima čega; potvrda odmah pomiče saldo ispod (uzrok i posljedica na istom ekranu).
9. **OQ-2 RIJEŠEN čitanjem koda (spec §2.9): brzi unos = postojeći Shortcut (S88), ne novi
   ekran ni novi „profil vidljivih polja".** `activity_presets.default_attributes` već nosi
   snimku vrijednosti; primjenjuju se s **prioritetom nad `attr.default_value`**
   (`AddActivityPage.tsx:542`, `touched:true`), `default_map` drugi prolaz to poštuje, a
   „Use Shortcut" već skače u Add Activity. **Fale dvije sitnice:** (a) prefilana polja se ne
   skupljaju — `isHiddenByDefault` (`AttributeChainForm.tsx:216`) gleda `attr.default_value`,
   ne vrijednost iz preseta ⇒ tretirati „iz preseta i nedirano" kao „na defaultu";
   (b) dropdown shortcuta je ravan `presets.map` (`ProgressiveCategorySelector.tsx:711`) ⇒
   `<optgroup>` po Arei (`area_id` **već postoji**, nema promjene sheme) + sort po
   `usage_count`/`last_used`. ⚠ **Grupirati da, filtrirati na trenutnu Areu NE** — kružno je,
   posao shortcuta je upravo prebaciti te u drugu Areu.
10. **Usklađenje ✓ / Δ:** polje „u banci" gdje korisnik utipka iznos iz bankovne aplikacije;
   čip je usporedba s izračunatim saldom. Δ **nije greška appa** nego signal da nešto fali/je
   dvaput/je krivo. ⚠ Polje mora postojati **i na mobitelu** (u prvoj skici izostavljeno).
11. **⚠ NAJOZBILJNIJI NALAZ (spec §2.10): saldo miče `Izvor`, NE `Racun`.** Naivni zbroj po
   `Racun`u **dvostruko broji** — na istom tekućem računu stoje i pojedinačne kartične kupovine
   (`Racun=Sašin RF`, `Izvor=Visa`) i skupna naplata kartice (`Transfer`). `Racun` znači „gdje
   se to na kraju naplati" (odluka 2a, S107i), a ne „čiji se saldo miče". Pravilo:
   `Izvor ∈ {Racun, Cash}` → **izvršeno**; `Visa`/`Mastercard` → **„+ planirano"** dok ne dođe
   skupna naplata. **Faza 1a (prije koda) — ✅ IZVRŠENA, v. sekciju „S107x Faza 1a":** pravilo se pusti u Pythonu nad Reviewom i usporedi
   sa `Saldo kontrola` (21/31 mjeseci u cent) ⇒ dokaz na 4.996 redaka bez TypeScripta.
12. **Kolona `Provjera stanja` u exportu (Sašina ideja):** prava Excel formula = tekući zbroj,
   ekvivalent njenog `=F655+D656-E656`. Ona dopiše retke, formula računa dok tipka, i kad zadnji
   redak pokaže broj koji vidi u banci — uveze. **Ništa se ne prepisuje.** Traži: sidro kao
   sjeme formule (⇒ OQ-1 i ova kolona su ista stvar), export **najstarije-prvo** (profil već nosi
   override sortiranja), i da se kolona pri uvozu **ignorira** (skroz desno, gdje `parseDataRows`
   ne gleda — isti prostor kao `Result`/`Changed` iz S107w). Dva puta usklađenja, isti sidro:
   **Excel = pravo periodično usklađenje (laptop), ✓/Δ = brzi pogled (mobitel).**
13. **Izračunata kolona `Stanje` u Activities listi (spec §2.12):** njena Excelica ima saldo uz
   **svaki** redak — jedan broj kaže „nešto ne štima", kolona kaže „ne štima OD OVOG RETKA".
   Jeftino: lista je najnovije-prvo + ukupni saldo iz RPC-a ⇒ `saldo(i) = ukupno − Σ novijih`,
   računa se **iz vidljive stranice**, bez povlačenja povijesti. Uvjeti: samo uz filtar na
   **jedan račun** i samo u kanonskom datumskom poretku. ⚠ **Time OQ-5 pada na „stari atribut
   `Stanje` se prestaje pisati"** — inače dvije kolone istog imena s različitim brojem.
14. **Njene korekcije prežive selidbu:** redak korekcije = novi zapis; korekcija utopljena u
   postojeći redak = izmjena koju hvata `row_hash` + update-guard (D7). Navika se ne mijenja.
15. **„Planirano" ima horizont i dva smjera (spec §2.13):** jedan broj ne odgovara ni na jedno
   pitanje (Anjinih 96 rata seže 8 godina). Tri kante — **Dospjelo** (`Planiran` ∧
   `Datum naplate ≤ danas`, traži potvrdu) · **Uskoro** (~30 dana, „hoću li imati dovoljno") ·
   **Kasnije** (obveza, ne novčani tok — tu toggle ima smisla). **⚠ `Dospjelo` mora biti
   IZVEDENO, ne treća vrijednost `Status`a** — spremljena vrijednost traži pisca, a to je točno
   automat odbačen u §2.5a pod drugim imenom (+ S105d rizik: ime bi živjelo i u
   `validation_rules` i u `value_text` svakog zapisa). **Dva smjera:** planirani prihodi rade
   isto (`Uplata` + `Planiran`) — Kokina mirovina I/II/III stup je točno to ⇒ „planirano" su
   **dva broja** (odlazi / dolazi), inače ne odgovara na „hoću li imati dovoljno".
16. **Transfer — pravilo ovisi o pločici (spec §2.14):** u **saldo ULAZI** (novac je stvarno
   otišao; izostavljanje razilazi saldo s bankom), iz **razreza po Tipu IZLAZI** (nije potrošnja,
   napuhuje). Isti redak, dva pravila — zapisano da se kasnije ne „popravi" kao nedosljednost.
   **⚠ Otvoreno empirijski:** je li interni transfer zapisan **jednom ili dvaput**? Dvaput ⇒ oba
   salda točna; jednom ⇒ jedan račun kriv za cijeli iznos. Mjeri se u Fazi 1a.
17. **Faza 1a sad ima TRI provjere** (ne jednu): (1) reproducira li `Izvor ∈ {Racun,Cash}`
   `Saldo kontrola` (21/31 u cent) · (2) transfer jednom ili dvaput · (3) raspodjela „planiranog"
   po kantama i smjerovima. **Sve OQ (1–6) zatvorene ⇒ specifikacija spremna.**
   ➡ **✅ IZVRŠENO 2026-08-12 — v. zasebnu sekciju „S107x Faza 1a" niže.** Ishod: (1) pravilo
   potvrđeno ali **mjeri se pomak, ne razina** (usporedba sa `Saldo kontrola` nije bila
   izvediva — lanac razbijen sortom); (2) **dvaput**; (3) **neprovjerljivo** na ovim podacima.

**Done 2026-08-12 (S107w — ručni testovi T-S107w-4…9 ZAVRŠENI + 2 sitna nalaza; testovi:
`docs/sessions/tests/S107w_tests.md`):**
1. **Svih 6 ručnih testova prošlo** — Excel izgled (`DELETE` dropdown, crveni redak, Excel
   odbija proizvoljan tekst), sort ne rasparuje zastavicu, dvije odvojene guard kvačice
   (ni jedna ne otključava drugu), Financije brisanje (1 zapis, `Deleted` sheet točan),
   **⭐ Fitness parent lanac** (brisanje prvog od 2 zapisa sesije ostavlja `Workout Type`
   netaknut; brisanje zadnjeg ispravno ruši i parent lanac — poruka "last event of its
   session" se pojavljuje točno kad treba), izvještaj kao radni file (puna petlja
   create→report→DELETE u reportu→re-import, uklj. `event_id` iste kopije u kodu
   `matchesRowHash`/"copied row" dedup — provjereno da radi i kad korisnik namjerno/greškom
   ne očisti `event_id`+`row_hash` na kopiranom retku, ne samo kad ga ručno makne).
2. **UI polish** (`ExcelImportModal.tsx`) — "(Excel row N)" oznaka u delete/update guard
   listama bila `text-gray-300 text-[10px]` (jedva čitljivo); `text-gray-500 text-[11px]`
   na oba mjesta (delete guard + update guard).
3. **`sql/034_s107w_test_area.sql` (novo)** — scratch testna Area (Workout L1 s atributom →
   Set leaf s atributom) za sigurno testiranje P2 parent-chain scenarija bez diranja pravih
   Areas (Financije_all, Health_Sasa); idempotentan, borrow-a `user_id` sa `financije-all`
   sluga (⚠ TEST baza ima više simuliranih usera koji dijele imena/slugove kao `Financije`/
   `Health` — `financije-all` je jedini slug jedinstven Sašinom pravom TEST accountu).
4. **⚠ NALAZ — TEST seed data drift:** `e5-structure.spec.ts` T-S107w-4 (Add Child na Cardio
   → blocked state) je konzistentno padao — Cardio leaf u TEST bazi izgubio svoj seed event
   (`e1000000-...-01`) nekad prije ove sesije (nepoznato kad/čime), pa app ispravno prikazuje
   "no events yet" i ne blokira Add Child — **nije regresija S107w koda** (ne dira Structure
   logiku). Fix: `e2e/setup/seed.sql` je potpuno idempotentan (`ON CONFLICT DO NOTHING`,
   fiksni ID-jevi izolirani od pravih podataka) — ponovno pokretanje je vratilo Cardio event,
   E5 5/5 PASS nakon toga.
5. **Puni regresijski set 28/28 PASS** (E2, E3, E4×3, E5×5, E6×3, E14×2, S104_delete_bug,
   S104_parent_event, S104_import_progress, S107_row_hash_guard×3, S107b×2,
   S107w_delete_column×3) — spreman za PROD kad Saša zatraži deploy.

### S107x Faza 1a — model salda DOKAZAN u Pythonu (2026-08-12; alat + nalazi, NEMA app koda)

**Alat:** `data-prep_tools/Financije/verify_saldo_model.py` (READ-ONLY nad Reviewom, nema
`.save()`; `--rows` detalj, `--nalazi` izvoz loših redaka).
**Nalazi:** `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` + `data-prep_data/Financije/saldo_model_nalazi.xlsx`.
**⚠ Pročitati oboje prije pisanja RPC-a** — mjerenje je promijenilo tri stvari u specu.

1. **§2.10 POTVRĐENO:** `Izvor ∈ {Racun, Cash}` reproducira **bankovni pomak u 17/30 mjeseci
   u cent**; naivni zbroj po `Racun`u u **0/30**. Bruto dvostruko brojanje **56.894 €** (ZABA),
   **81.591 €** (RF). Formula ide u RPC kakva jest.
2. **⚠ Traženi test „isti popis od 7" NIJE bio izvediv — i to je nalaz.** `Saldo kontrola`
   uspoređuje *razinu* Kokinog ručnog `Stanje` s bankom, a taj lanac je razbijen sortiranjem
   Reviewa po `event_date` (S107i): **969 puknuća od 2.564**. Usporedba razine mjerila bi
   artefakt sortiranja. Zato se mjeri **pomak protiv banke** (neovisan o sidru — jedna rana
   greška ne razmazuje se kroz 31 mjesec). Presjek s onih 7 je samo `2026-05`, jer su to
   različite veličine. **➡ Potvrđuje OQ-5: `Stanje` nije istina, prestaje se pisati.**
3. **§2.14 ODGOVORENO — transfer je zapisan DVAPUT** (90,6 % **iznosa**; 23.789 € od 26.270 €)
   ⇒ oba salda točna. Uvjet: prvo razvrstati po ulozi — naplata kartice (108), bankomat (78),
   „druga osoba" (38) **po definiciji nemaju** protupartiju; samo `izmedju racuna` (73) smije.
   ⚠ Udio po komadima (42,5 %) vodi u suprotan zaključak od udjela po iznosu.
4. **§2.13 (tri kante) ⏸ NEPROVJERLJIVO** — `Planiran` ima 15 redaka i svih 15 je dospjelo;
   buduće rate u Reviewu **ne postoje kao retci** (generira ih rata modal nakon importa).
   **Ne smatrati potvrđenim do prvog importa.** Dobra vijest: od 629 `Rate?=DA` samo 11 je
   `Planiran` ⇒ povijesni uvoz ne nosi davno naplaćene rate kao planirane.
5. **13 rezidualnih mjeseci ⇒ `✓/Δ` čip će pokazivati Δ i kad je model točan.** To je
   **potvrda dizajna §2.11**, ne greška — model se **ne smije ugađati** da Δ nestane.
6. **115 označenih loših redaka u 7 kategorija** (TSV, filtriraj po `sifra`):
   `NAPLATA<KUPNJA` 28 (naplata prije kupnje — nemoguće), `TRANSFER-BEZ-PARA` 42 (labela;
   **popraviti prije `breakdown` pločice, ne prije `balance_by_group`** — saldo ne diraju),
   `BANKA-NE-VIDI` 10, `DUPLI-IZVOR` 12, `OBJE-KOLONE` 3 (S107r §10b), `BEZ-IZNOSA` 4,
   `PLANIRAN-DOSPIO` 16 (po dizajnu §2.5a). Imenovani za ispravak: Mirovina+Triglav krivo
   datirani (2.385,65 seli iz 2025-01 u 2025-02), Anjina rata 72/96 dvaput (Kokinih 450 +
   bankovni split 400+50), Allianz Lacetti 2024-10, dvije Mirovine 2024-07.
7. **⚠ RPC ide na `sql/035_area_group_agg.sql`** — `034` je zauzeo `034_s107w_test_area.sql`.
8. **Zamka:** ime skripte ne smije biti ime stdlib modula — `inspect.py` je srušio `openpyxl`
   (`partially initialized module`, jer `numpy` radi `import inspect`).
9. **PROD deploy izvršen 2026-08-12** — merge `test-branch` → `main` (fast-forward
   `3930c8e..7239c8d`), `typecheck`+`build` čisti prije mergea. Na PROD: S107v + S107w + Faza 1a.
   ⚠ `sql/034_s107w_test_area.sql` putuje u mergeu ali se **ne izvršava sam** (TEST-only).

**Popravci podataka izvršeni isti dan (oba s `.pre-*` backupom i kontrolom):**

- **`fix_datum_naplate_statement.py` (novo) — 49 redaka.** `Datum naplate` preračunat iz
  `Izvod file` (11. u mjesecu NAKON statementa). **Nalaz je bio veći od simptoma:** 27
  „nemogućih" (naplata prije kupnje) bilo je samo vidljivi vrh — usporedba protiv statementa
  dala je **57** neslaganja, od čega 30 **tiho** krivih. Jezgra: cijeli statement `MC_2025-10`
  (40 redaka) nosio je 11.10. umjesto 11.11.
  **Uzrok:** `kartice_datum_naplate.py` namjerno ne dira retke s već popunjenim `Datum naplate`;
  stara vrijednost je preživjela, `enrich_from_izvoda.py` je poslije pridružio statement, a
  `date_accuracy.py` (S107k) pomaknuo `event_date`.
  ⚠ **8 redaka svjesno NIJE dirnuto** iako je odobren opseg 57: to su **manjinska odstupanja
  unutar statementa koji inače slijedi pravilo** (`MC_2025-05`: 32 točno, 6 odstupa) — drukčiji
  obrazac od veleprodajne greške; jedan je pomak od 1 dana (11.04.2026. = **subota**, dakle
  vjerojatno stvarni datum knjiženja). Pokreće ih `--include-obrnute`.
- **`fix_keks_trener.py` (novo) — 20 redaka, 400 €.** KEKS Pay uplate osobnom treneru
  (`Transfer|izmedju racuna` → `Zdravlje|Sport_Sasa`). Saša ih uočio pregledavajući
  `saldo_model_nalazi.xlsx`; potvrda u podacima: 27 `Ašo/Aša` redaka je već `Zdravlje|Sport_Sasa`,
  a 20 `KEKS` −20,00 (21.07.2023.→14.03.2024., **tjedna kadenca**) nije — prešao je s izravne
  uplate na KEKS Pay. 2025./2026. je prestao (potvrdio), pa preostala 2 KEKS −20 nisu trener.
  ⚠ Ni pravilo ni `Preimenovanja` to ne mogu — `Transfer|izmedju racuna` je **valjan** par
  (ista zamka kao `fix_vocarna_pravilo.py`, `fix_anja_rate.py`). Keyword pravilo se namjerno
  **ne** dodaje: `KEKS` je aplikacija za plaćanje, ne trgovac (isti razlog kao `PAYPAL`/`GLS`, S107l).
- **Kontrola:** 49 ćelija (sve `Datum naplate`) + 80 ćelija (20 × Tip/Podtip/Alternativa/
  Pravilo run); **Σ Uplata i Σ Isplata nepromijenjeni u cent**; broj redaka/kolona isti.
  Model salda i dalje **17/30** (popravci ne diraju iznos ni `event_date`), dvostranost
  transfera **90,6 % → 91,9 %**. Označenih redaka **115 → 69**; `NAPLATA<KUPNJA` 28 → **1**
  (ostaje red 4997, poznat iz S107v).
- **`verify_saldo_model.py --nalazi` sad piše i `.xlsx`** — `.tsv` nije registriran tip na
  Windowsu (dvoklik nudi „Select an app"), a ostatak pipelinea je ionako xlsx.

**`make_pitanja_koka.py` (novo) — sheet `Pitanja za Koku` u Review workbooku.** 14 otvorenih
pitanja skupljenih na jedno mjesto, u obliku na koji se odgovara. Obrazac preuzet od
`Nematchano_v3` (S107k), koji je s `Verdikt` dropdownom otišao 41 → 0: kontekst u retku,
jedna kolona za odluku, `source_key` za kasniju programsku primjenu.
**7 pitanja na razini retka** (konkretna transakcija koju prepozna — idu PRVA jer lakše kreće)
+ **7 na razini mjeseca** (`Saldo kontrola` razlike; nema retka za pokazati, pita se sjećanje).
⚠ Ključna kolona je **`U čemu je nejasnoća`** — mora reći ŠTO nije bilo moguće zaključiti i
ZAŠTO; „provjeri redak 2787" nije pitanje na koje se može odgovoriti.
⚠ Skripta je **idempotentna** ⇒ ponovni run **briše popunjene odgovore**; `--harvest` još nije
napisan (za 14 redaka je ručna primjena vjerojatno brža).
**Trag nađen usput:** ona dva `±49` iz `Saldo kontrola` točno su iznos mjesečne Multisport
uplate, a Multisport **nedostaje u 4 mjeseca** (07/2023, 11/2023, 06/2024, 03/2025) — jedan
Kokin odgovor vjerojatno pokriva oba pitanja.

**Done 2026-08-13 (S107y — `Pitanja za Koku` odgovoreno + popravci + batch 2025 uvezen;
testovi: `docs/sessions/tests/S107y_tests.md`):**
1. **Sjedenje s Kokom — svih 14 pitanja odgovoreno.** #1 (red 4996 parking): datum kriv,
   07.08.2026→07.07.2026. #2 (red 4997 MC 21,88): duplikat reda 4247, obriši. #3 (red 4101,
   700€ bankomat): točno je, zbroj podizanja, bez izmjene. #4 (redovi 2787+2788, Mirovina+
   Triglav): datum kriv → **07.02.2025** (pravi bankovni datum nađen u
   `Izvodi_transakcije.xlsx`, ZABA_2025-02.pdf). #5 (red 3609 vs 3612+3613, Anja rata):
   duplikat, 3609 obriši (3612/3613 već nose "72/96" u Napomeni). #6 (red 2368 Allianz):
   točno je, gotovina. #7 (redovi 2001+2004, dvije Mirovine): 2004 duplikat, obriši.
   #8–14 (Saldo kontrola mjesečne razlike): **ne rekonstruirati bankovne datume unatrag**
   (Sašina odluka) — nema pouzdanog matcha za te mjesece, Kokini `event_date`/`Stanje`
   ostaju izvor istine, rezidual je prihvatljiv (saldo na kraju već točan, dizajn to dopušta).
2. **`fix_pitanja_koka.py` (novo)** — primijenio sve odgovore na pravi Review: verifikacija
   po `source_key`+iznos+trenutni datum PRIJE ijedne izmjene (isti obrazac kao
   `fix_duplikati_rata.py`), `--dry` pa pravi run. Rezultat: 3 datuma ispravljena, 3 retka
   obrisana (4995→4992 podatkovnih redaka), 14 odgovora prepisano u `Pitanja za Koku` sheet
   pravog Reviewa. Kontrola: Isplata delta 21,88 €, Uplata delta 1608,99 € (= 450+1158,99,
   točno zbroj obrisanih), samo 3 retka dirnuta (isključivo `event_date`/`Datum naplate`/
   `Alternativa / nap.`), 0 neočekivanih izmjena. Backup `.pre-pitanja-20260813_105537.xlsx`.
3. **Odluka: ne pripremati batch 2024/2023 unaprijed.** Usko grlo je vetting (Pitanja-za-Koku
   pass po periodu), ne generiranje — pre-generiran file bi zastario prije nego se stigne
   uvesti (isti razlog zašto je 2025 trebao ispravke PRIJE generiranja, ne poslije).
4. **Batch 2025 generiran i uvezen u TEST** — `make_financije_import.py --from 2025-01-01
   --to 2025-12-31` → `Financije_all_import_20260813_110152.xlsx`, 1473 redaka, 351 dana,
   max 16 tx/dan. 4 retka izostavljena (`Smjer=PROVJERI`, poznata odluka S107s). Import kroz
   app UI (TEST, Financije_all): **1473 created / 0 updated**. Spot-check: 07.02.2025
   Mirovina+Triglav prisutni (današnji fix), `Rate?=TRUE` vidljiv u exportu, ukupno u bazi
   **2220** = 1473 (2025) + 747 (2026, S107v) — brojevi se poklapaju.
5. **Sljedeće:** dogovor o **Fazi 1** (RPC `balance_by_group`, `sql/035_area_group_agg.sql`)
   — odgođeno na Sašin zahtjev za sljedeći session.

**Kontekst koji određuje dizajn (Saša, 2026-08-12):** radi se u **TEST bazi**, Koka **još ne
otvara Sašine fileove**. Prioritet je (a) **točnost podataka** kao uvjet za PROD i (b) da ona
razumije gdje su greške — **ne** izgradnja njenog alata, koji dolazi tek nakon odluke o
cutoveru (spec, korak 3). Zato je `Pitanja za Koku` namjerno **malo kolona i čitljivo**, a ne
bogat export s njenim originalnim podacima. Ta ideja (app export + kolone `Sheet`/`row_no`/
originalni iznosi + `Nalaz`) ostaje za kasnije i **traži manifest** `source_key ↔
(event_date, session_start)` iz generatora — `source_key` NIJE u `ATTRS` pa nakon importa ne
postoji veza natrag na redak Reviewa; bez manifesta bi spajanje bilo fuzzy match po
datumu+iznosu, tj. povratak na `Nematchano_v*` bol.

**⚠ Redoslijed ispravljen (Saša):** `Pitanja za Koku` → ispravci → **batch 2025** → Faza 1.
Prvotni prijedlog (generiraj batch pa izostavi sporne retke) je odbačen jer izostavljen redak
**ne može** natrag novim batchom (sudar `session_start` za isti dan, S107v) nego samo ručno
kroz app. Ispraviti pa generirati jednom je jeftinije.


---

## Done S108: Faza 1 — RPC salda, Overview tab, pločica sa sidrom

**Datum:** 2026-08-15 · **Model:** Opus 5 · Prva sesija koja piše **kod** za analitiku;
S107x je model dokazao u Pythonu, S107z zaključio odluke, ovo ih je izvelo.

⚠ **Oznaka:** `S107z` je potrošio abecedu, pa ovo ide kao `S108`. Time „S108+: Intelligence
layer" iz CLAUDE.md-a gubi broj — Intelligence layer je **S109+**.

### Redoslijed je bio uvjet, ne preporuka

Saša je zadao: SQL → pusti RPC nad TEST bazom → usporedi s `verify_saldo_model.py` →
**tek onda** UI. Držano doslovno; nijedan red UI koda nije napisan prije nego su brojevi prošli.

### 1. `sql/035_area_group_agg.sql` — generički RPC

`rpc_area_group_agg(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters, p_from,
p_as_of)`. U potpisu nema riječi „Financije" — parametri su **uloge**.
Uz njega `app_can_read_area()` (vlastita provjera pristupa), `area_agg_rows()` (interni izvor
redaka, EXECUTE oduzet `anon`/`authenticated`) i `app_assert_slugs()`.

**Dva odstupanja od skice §2.4, oba nužna:**
- `p_filter_slug`/`p_filter_val` (jedan par) → **`p_filters jsonb` (lista)**. Dokazano pravilo
  traži dva uvjeta odjednom: `izvorplacanja ∈ {Racun, Cash}` **i** `status ∉ {Planiran}`.
  Ops v1: `in` / `not_in`, sa semantikom koja se poklapa s Python modelom (redak bez
  vrijednosti prolazi `not_in`, isto kao `'' != 'Planiran'`).
- **`p_from` dodan** uz `p_as_of` — „strogo nakon" iz §2.17 je dio modela, ne udobnost.

Tri pravila iz §2.4 održana: vlastita provjera pristupa (`service_role`, vlasnik, template
user, `data_shares` — preslikan `areas_select`), P2 guard **dvostruk** (samo leaf kategorije
**i** `chain_key IS NULL`), čita se `value_number` po `attribute_definition_id` bez ijednog
`ILIKE`. **Nepoznat slug diže iznimku** umjesto da vrati 0 — inače je preimenovanje sluga
tiha nula umjesto salda.

### 2. `sql/036_balance_anchors.sql` — sidro

Tablica `balance_anchors` (`area_id`, `group_slug`, `group_value`, `amount`, `confirmed_on`,
`created_by`) + RLS (čitanje = pristup Arei; upis = vlasnik ili **write** grantee — strože od
`events_insert`; **bez UPDATE politike**, ispravak je novi redak) + `rpc_area_balance_anchored`.

Zašto zaseban RPC: jedan `p_from` ne može izraziti **različit datum sidra po grupi**, pa se
sidra spajaju unutar SQL-a. Grupa sa sidrom a bez prometa i dalje se prikazuje; grupa bez
sidra vraća `anchored: false` da UI **mora** reći „od početka podataka".

⚠ **Pao pri prvom puštanju:** `FULL OUTER JOIN … ON a.group_value IS NOT DISTINCT FROM
c.group_value` → `FULL JOIN is only supported with merge-joinable or hash-joinable join
conditions`. Prepisano u `UNION` ključeva + dva `LEFT JOIN`-a (UNION ionako tretira NULL-ove
kao jednake). **`sql/036` se mora pustiti ponovo.**

### 3. Prihvatni test — `verify_rpc_vs_model.py` (nov alat)

Troslojno, i namjerno razdvojeno: **A** Review (Python model, sužen na prozor baze) ·
**B** baza (sirovi retci, isti predikat) · **C** RPC.
`A vs B` = je li uvoz vjeran Excelu (podatkovno pitanje). `B vs C` = radi li SQL ono što treba
(kodno pitanje). Razlika u prvom se **ne smije** popraviti u SQL-u.

**Rezultat (2220 eventa, prozor 2025-01-01 .. 2026-07-11): sve tri strane u cent.**

| račun | uplata | isplata | saldo | n |
| --- | ---: | ---: | ---: | ---: |
| Kokin tekući ZABA | 96.792,87 | 96.642,07 | **150,80** | 430 |
| Sašin tekući RF | 26.314,96 | 28.293,28 | **−1.978,32** | 213 |

Naivni zbroj po `Racun`u dao bi ZABA **−22.943,71** ⇒ §2.10 vrijedi i na ovom podskupu.
`A vs B`: od 2222 retka u prozoru razlikuju se **2** (Σ 1,60).
Usput potvrđeno **D1b**: za svih 634 izvršenih redaka `Datum naplate == event_date`, 0 iznimaka
⇒ sidro smije uspoređivati po `event_date`.

### 4. Zamka koja je zamalo prošla kao podatkovni nalaz

Prvi run alata „našao" je **45 eventa bez ijednog atributa** (svibanj 2025), drugi run **49
drugih** (veljača/ožujak 2026). Nijedan nije postojao: `select_all` je paginirao **bez
`order=`**, pa su se retci između stranica preklopili i istovremeno preskočili.

Prijavljeno Saši kao rupa u uvozu prije nego je uzrok nađen — **povučeno**. Alat sad baca
iznimku ako pozivatelj ne zada `order=`. **Isti bug je bio u 6 poziva u `src/`** (Delete Area,
Excel import Delete?, attachment cleanup, `areaOccupants`) — dodan `.order('id')`. Kod brisanja
je posljedica gora od krive brojke: preskočen redak ⇒ parent DELETE padne na FK, što je točno
kvar zbog kojeg je `supabasePaging.ts` i napisan.

### 5. UI

- **Overview tab** (`src/components/overview/`) — postoji **samo** ako Area ima
  `settings.dashboard` (OQ-4); redoslijed `Overview → Activities → Structure`.
  Konfigurator se **ne gradi** (N=1, §2.15). Nova tema `THEME.overview` (teal).
- **Pločica `balance_by_group`** — saldo od sidra, „planirano" u dva smjera, polje **„u banci"**
  + `✓/Δ` čip, „Potvrdi" piše sidro. Δ je opisan kao **signal, ne greška** (13 rezidualnih
  mjeseci jamči da će se pojaviti). Greška RPC-a se prikazuje **doslovno** — to je jedina
  stvar koja imenuje pokvaren slug.
- **Izračunata kolona `Stanje`** (§2.12) — silazi kroz vidljivu stranicu (`saldo(i) =
  saldo(i−1) − iznos(i−1)`), pojavljuje se **samo** uz filtar na jedan račun i sortiranje
  najnovije-prvo, retci koji ne miču saldo (`Izvor = Visa/Mastercard`) i retci prije sidra
  pokazuju `—`.
- **Fixup `dashboard.widgets[]` pri renameu sluga** (`src/lib/dashboardConfig.ts`) — u istom
  save-u kao postojeći `depends_on` fixup, S105d razred.
- **„From template" kopira `areas.settings`** — **bez `export_profiles`** (Sašina odluka):
  ključ nosi ime izvorne aree, pa bi u novoj Arei bio mrtav. Komentar u kodu objašnjava zašto,
  da netko kasnije ne „popravi" dodavanjem.
- **`sql/037_financije_dashboard.sql`** — config za `Financije_all`, **podatak a ne shema**.

### 6. Odluke donesene u sesiji (Saša)

- **Izračunata kolona `Stanje` ide u Fazu 1** (ne čeka Fazu 4) — bez nje drill s pločice vodi
  u listu u kojoj se greška ne može naći, a Δ jamči da će je biti. Time se zatvara **OQ-5**:
  spremljeni atribut `Stanje` treba prestati pisati u `make_financije_import.py`.
- **`export_profiles` se NE kopira** pri „From template".

### 7. Ostalo otvoreno

Tri kante planiranog (§2.13) i traka „Dospjelo → potvrdi" (§2.5a) trebaju granicu po
`Datum naplate`, a RPC filtrira po `event_date` — Faza 4. `Dashboard` sheet u Structure
roundtripu — Faza 4. Drill nosi **jedan** `attrFilter`, a uvjet pločice ima dva; §2.16 je to
predvidio kao test, ispalo je da **filtru fali mogućnost**.

### 8. Dopune nakon prvog kruga testiranja (isti dan)

**`sql/036` pušten dvaput.** Prva verzija je pala na `FULL JOIN … ON IS NOT DISTINCT FROM`.
Nakon ispravka (`UNION` + dva `LEFT JOIN`-a) sidro je verificirano end-to-end — P-7…P-12 u
`S108_tests.md`. Najvažnija od njih je **P-10**: granica nije provjerena samo na
dosljednost sa samom sobom (sidro vs `p_from` dijele isti kod pa bi oba dala ✔ i da je
granica uključiva), nego protiv **retka koji stvarno sjedi na granici** — postoji točno 1
zapis datiran 2026-06-30, `> D` daje `n=6`, `> D−1` daje `n=7`. Tek to isključuje dvostruko
brojanje oko sidra.

**Sašini rezultati:** T-S108-1, -2, -3 ✅. Pločica pokazuje točne brojeve, tab se pojavljuje
samo na `Financije_all`, Δ čip radi.

**T-S108-4 nije prošao — i uputa je bila kriva, ne kod.** U bazi je bilo 0 sidara, dakle
„Potvrdi" nije ni pokušan. Provjereno da baza nije kriva: insert reproduciran kao **stvarno
prijavljeni korisnik** (magic-link sesija, ne servisni ključ koji bi zaobišao i RLS i table
grantove pa sakrio bug) → HTTP 201. Uz to je nađeno da je **korak 4 bio nemoguć**: „Potvrdi"
uvijek datira sidro na danas, a pravilo je „strogo nakon", pa transakcija datirana **danas**
po definiciji ne ulazi u saldo — korak koji je tražio da uđe ne bi prošao ni s ispravnim
kodom. Ispravljeno: korak 4 koristi **sutrašnji** datum („mora ući"), korak 5 današnji ili
raniji („ne smije ući"), čime su oba smjera pravila provjerljiva kroz UI.

**Add Activity i „⚡ Use" aktivni i na Overviewu** (Sašin zahtjev). Saldo je razlog zbog
kojeg se tab otvara, a idući potez je unijeti transakciju koja ga mijenja; slanje na drugi
tab je nepotreban skok. Uz gumb ide i leaf hint, inače sivi gumb nema razlog uz sebe.
Povratak nakon spremanja ide na tab s kojeg se krenulo, pa se pločica remounta i preračuna.
„⚡ Use" je već radio — filter panel je neovisan o tabu.

**Help sistem — bio propušten, dodan.** `pageHint` je od uvođenja taba imao vrijednost
`overview` koju `CHIPS` nije poznavao, pa Help na tom tabu **ne bi prikazao nijedan chip i
ne bi javio grešku**. Dodano: `docs/help/overview.md` (nova tema — što miče saldo i zašto
nije zbroj po računu, kako radi sidro, što znači Δ, kolona `Stanje`, zašto neke Aree nemaju
tab), unos u `HELP_DOC_NAMES`, unos u `CHIPS`, i procedura „kako dodati novu temu" u
`HELP_STRUCTURE.md`. Zamka je promaknuta u CLAUDE.md „Critical rules".


---

## Done S109: stanja kao podatak, ne kao parametar (sesija odluka — NEMA `src/` koda)

**Datum:** 2026-08-16 · **Model:** Opus 5 · Počela kao nastavak testiranja S108, završila kao
preispitivanje gdje potvrđena stanja uopće žive. **Nijedan red aplikacijskog koda nije napisan.**

⚠ **Oznaka:** ovo je `S109` ⇒ „Intelligence layer" iz CLAUDE.md-a pomiče se na **S110+**
(drugi put; S108 ga je već jednom pomaknuo).

### 1. Krivi prijedlog, ispravljen od Saše

Saša je krenuo na T-S108-4 i naletio na stvarni problem: pločica pokazuje `150,80 €`, što je
pošten zbroj **uvezenoga** (2025. + 2026. do 11.07.), a ne stanje na računu. Fali ranija
povijest i ~5 tjedana Kokine delte.

**Moj prijedlog:** usidri današnje stanje iz banke, povijest postane nebitna.
**Sašin protuprijedlog:** usidri **31.12.2024.** (početak onoga što postoji), pusti app da
računa naprijed, i provjeri slaže li se s Kokinim `3.403,74` na 08.07.2026.

Njegov je bolji i prihvaćen. Razlika nije kozmetička: moj prijedlog sidro koristi kao
**pokrivač** preko rupe, njegov kao **provjeru**. Drugo mjeri, prvo skriva.

### 2. Nalaz: mehanika za to već postoji, fali samo prosljeđivanje parametra

Provjereno čitanjem koda na `929073a`:

| Sposobnost | Baza / RPC | UI |
| --- | --- | --- |
| Sidro na proizvoljan datum | ✅ `confirmed_on` je obična `date` | ❌ `confirm()` hardkodira `todayIso()` |
| Saldo „na dan X" | ✅ `p_as_of` u oba RPC-a | ❌ pločica ga ne šalje (`:68`) |
| Saldo „na dan X" u listi | ✅ | ✅ **već radi** — `useRunningBalance:127` šalje `asOf: p.dateTo` |
| Izbor sidra po datumu | ✅ `036:191` `confirmed_on <= p_as_of` + `DISTINCT ON` | — |
| Popis / brisanje sidara | ✅ funkcije postoje | ❌ **nitko ih ne zove** |

Zadnji redak je prava rupa: sidro se može stvoriti, ali ne vidjeti ni obrisati iz aplikacije.
Saša je to osjetio odmah — upisao je probnih `3000` i ostao bez načina da to makne osim SQL-a.

### 3. T-S108-4 korak 3 PROŠAO usput

Najveća nepoznanica iz S108 (0 sidara u bazi, „Potvrdi" nikad kliknut do kraja) pala je bez da
je bila cilj: sidro `3.000` spremljeno, podnaslov prešao na „od potvrde 16.08.2026. · 3.000,00 €
· 0 promjena poslije". `saveAnchor()` i RLS su u redu.

### 4. Tri „pada" koja nisu pad

- **Kolona `Stanje` sve `—`** — dva neovisna ispravna razloga: sidro datirano danas ⇒ cijela
  lista je ispod sidra (uvjet 4); vidljivi retci su svi `Izvor = Mastercard`, koji ne miču
  saldo (uvjet 3).
- **Parking redak nije u bazi** — batch 2026 rezan na 31.07., redak je tada bio `2026-08-07`.
  Nije bug nego posljedica reza. Dodati kroz app, ⚠ ne novim batchom (`09:00` na već uvezen dan).
- **„planirano" ne reagira na sidro** — namjerno, `split` je neusidren plain sum.

### 5. „Planirano" razjašnjeno

Nije „kartično što još nije naplaćeno" nego doslovno **`Status = Planiran`** — ljudska oznaka.
`037` header to i obrazlaže: vezati ga uz `Izvor ∈ {Visa, Mastercard}` bilo bi grubo krivo, jer
je kupovina od prije godinu dana odavno plaćena skupnom naplatom.

⚠ **Izvedena granica koju treba znati:** `Status` je **trenutno stanje, ne povijest**. App ne
pamti *kad* je nešto prešlo iz `Planiran` u `Izvrsen`, pa „što je bilo planirano na 08.07."
nije pitanje na koje se može pošteno odgovoriti — samo „od datiranog do 08.07., što je i danas
još planirano". Prava retrospektiva traži povijest statusa.

### 6. Velika odluka: stanja sele iz tablice u evente

Saša: zašto sidro nije obična kategorija `Financije_all > Stanja`?

**Argument iz `036` headera ne pokriva taj prijedlog.** On je bio protiv `areas.settings` —
konfiguracije koja **putuje** s Areom (Structure export, „From template"). Eventi ne putuju:
Structure export nosi oblik (kategorija + atributi), ne vrijednosti. Prijedlog prolazi baš onaj
test zbog kojeg je zasebna tablica nastala.

**Za:** sav UI već postoji (Add/Edit/Delete/View, Excel roundtrip) ⇒ nestaju i „polje za datum"
i „popis sidara" · **bulk povijest** — mjesečna stanja iz Kokine `Stanje` kolone kroz import,
a RPC već bira „zadnje stanje na ili prije datuma" ⇒ **svaki mjesec neovisno provjeren** ·
slaže se sa Sašinim principom „sve ide importom".

**Protiv (cijena, ne prepreka):** RPC prelazi s tipiziranih stupaca na pivot tri EAV atributa
(~20 redaka SQL-a, još jedno mjesto koje puca na rename sluga) · **zaštita pisanja slabi** —
`app_can_write_area` radi na razini baze, eventi se oslanjaju na provjeru u aplikaciji (S43) ·
stanja ulaze u tok aktivnosti (export, brojači, Kokino stablo) · sa zasebnom tablicom je
**strukturno nemoguće** da sidro upadne u zbroj, s eventima to ovisi o konfiguraciji.
(Provjereno: s trenutnim configom ne bi — sidro nema `izvorplacanja`, a `op: in` pada kad
vrijednosti nema. **Sreća, ne jamstvo.**)

**Sud:** pravo pitanje nije „tablica ili EAV" nego **je li stanje zapis o nečemu što se dogodilo
ili parametar modela**. Čovjek je na dan D pogledao banku i vidio X — to je zapis. Sašina
strana je jača.

**Dogovoreno:** kategorija se zove **`Stanja`** (Kokina riječ; „sidro" je bio moj žargon) ·
atribut `Stanje` se **prestaje pisati** na Transakciju, ali se **postojećih 2220 zapisa ne dira**
— Kokin lanac je jedini neovisni svjedok za provjeru · kasnije automat iz izvoda.

### 7. Pravilo koje se ne smije prekršiti

**Stanje smije doći samo izvana** — ispisani saldo s izvoda ili broj s ekrana bankovne
aplikacije. **Nikad izračunat iz zapisa u bazi.**

Prekršaj se **ne vidi**: Δ postane trajno nula, sve izgleda savršeno, a usklađenje je mrtvo bez
ijedne greške. Isti razred kao već odbačeni automat `Planiran → Izvršen` po dospijeću.

Zato je i automat iz izvoda legitiman: parsiranje **ispisanog** završnog salda je druga (i
pouzdanija) operacija od izvođenja smjera po transakciji — a baš je tamo ZABA parser jednom
već pogriješio (S107i).

### 8. Odluka o redoslijedu: provjera prije selidbe

Selidba na `Stanja` **nije prvi korak**, iako je prihvaćena. Za provjeru ne treba: mjesečna
stanja iz izvoda mogu se skriptom ubaciti ravno u postojeću tablicu (~30 redaka Pythona nad
podacima koji već postoje — ZABA lanac je verificiran 40/40 u cent, T-S107j-A).

Razlog nije opreznost nego to što **provjera odgovara na pitanje o dizajnu**: ako 30-ak
mjesečnih stanja riješi stvar, `Stanja` kao kategorija je očito pravo mjesto; ako ih treba
stalno ručno korigirati, treba i povijest ispravaka — drugačiji oblik. Cijena odgode je jedan
`INSERT ... SELECT`.

**Redoslijed:** pločica prima `asOf` → skripta mjesečnih stanja → provjera (ZABA `3.403,74`
na 08.07.2026.) → odluka o selidbi → automat.

### 9. Zamka za provjeru: Kokin lanac nije u datumskom redoslijedu

Na Kokinom fileu red 2564 je Parking `2026-08-07` a sjedi **ispred** reda 2565 (`2026-07-08`).
Znači `3.403,74` **već sadrži** redak datiran mjesec dana kasnije — onaj poznati od **1,60 €**
(red 4996), izostavljen iz batcha 2026. **Očekivana razlika od točno 1,60 na toj točki nije pad.**

---

# S110 — provjera lanca salda (2026-08-17)

Prva sesija u kojoj je saldo **izmjeren protiv vanjskog svjedoka**, a ne protiv sebe.
Rezultat: app reproducira banku i Kokin Excel **do centa** na oba kraja intervala.

### 1. Korak 1 — pločica prima `asOf`

`BalanceByGroupTile` dobiva `dateTo` iz `FilterContext` i prosljeđuje ga u oba RPC-a
(`p_as_of` je već postojao, samo ga nitko nije slao). Uz to:

- podnaslov u žutom **„na dan …"** kad je filtar aktivan — bez toga pločica pokazuje prošli
  broj kao sadašnji, ista klasa greške kao „od početka podataka" prikazan kao bankovni iznos
- **„Potvrdi na `<datum>`"** — sidrenje na gledani datum umjesto hardkodiranog `todayIso()`.
  Time sidro unatrag (S109 odluka) postaje izvedivo iz aplikacije, bez novog UI-ja.
- `dateFrom` se namjerno **ne** prosljeđuje: saldo nema početak, akumulira se od sidra.

### 2. Korak 2 — `make_saldo_anchors.py`

Ispisano `NOVO STANJE` s **31 ZABA izvoda** (2023-12 … 2026-06). Ponovno koristi već
validirani `_parse_zaba_all` iz `enrich_from_izvoda.py` — nije pisan nov parser.

Lanac je **neprekinut**: `novo[i] == pocetno[i+1]` kroz sva 31 izvoda. To je jedina provjera
koja hvata **izvod koji fali** — takav mjesec inače izgleda kao mjesec bez prometa.

### 3. Zamka koja je oborila plan iz handoffa

**Izvod se ne zatvara na kraju mjeseca.** `ZABA_2024-12` ima zadnju tekuću transakciju
`2025-01-01`, `ZABA_2025-12` ima `2025-12-24`. Ispisano stanje pripada **tom** datumu.

Plan je govorio „sidro na 31.12.2024. = 3.054,41". To bi bilo tiho dvostruko brojanje:
pravilo je „promjene **strogo nakon**", pa bi transakcije 1.1.2025. ušle i u ispisano stanje
i kao promjena poslije. Ispravno sidro je `confirmed_on = 2025-01-01`.

### 4. Zamka koja je oborila i sam plan provjere

**Mjesečna sidra ubijaju provjeru na svojim datumima.** `036` bira najnovije sidro
`confirmed_on <= p_as_of` i zbraja promjene strogo nakon njega ⇒ sidro NA datum usporedbe
daje `balance == amount` po konstrukciji. Δ bi bio 0,00 na svakih 30 mjeseci i sve bi
izgledalo savršeno.

Zato `--report` detektira međusidro i takav redak označi `SIDRO (nije provjera)` umjesto
lažne kvačice, a u bazu su upisana **samo dva** sidra — na oba kraja mjerenog intervala.
Prostor između njih je ono što se mjeri; trideset sidara bi ga prekrilo.

### 5. Nalaz: Kokina tipfelerica u godini

Podizanje `200,00` s bankomata datirano `2026-05-29` umjesto `2025-05-29`. Dokaz iz tri
neovisna izvora: `ZABA_2025-05` ima **dva** podizanja po 200 (19.05. i 29.05.), Review je imao
samo prvo; `ZABA_2026-05` nema nijedno; Kokin redak `EU:1780` je **osam redaka** iza `EU:1772`
a njeno vlastito `Stanje` (925,33) ga smješta u svibanj 2025.

Nije rupa u uvozu — app samo sortira po datumu, a Koka ne.

### 6. Vlastita greška u čitanju: poništavanje je lažiralo zdravlje

Prije popravka ostatak na 28.04.2026. bio je `−0,14` i ja sam ga pročitao kao „jedna greška
plus šum, sve se samo zatvorilo". **Bilo je krivo.** Nedostajućih `+200` iz svibnja 2025.
slučajno je poništavalo nepovezanih `−200,94` iz kasnijih mjeseci. Kad je 200 sjela na mjesto,
ostatak se pokazao kao stvaran.

**Pouka, šira od Financija: mali zbirni Δ nije dokaz da nema grešaka — može biti dokaz da ih
ima paran broj.** Zapisano u `SALDO_MODEL_NALAZI.md` §6.1.

### 7. BUG-S110-DATESHIFT

Nađen usput, pri ispravljanju datuma one 200. `Event #1` je pokazivao godinu **−3831**, Save
je tiho pao (bez poruke, samo bez navigacije na View); baza je ostala netaknuta jer je
Postgres odbio `-003831-05-29T…`.

Uzrok: delta se računala od **fiksne** `originalDateTime`, a primjenjivala na `event.createdAt`
koji je **već bio pomaknut** ⇒ svaki sljedeći poziv dodaje cijelu deltu ponovno. Gore:
`<input type="date">` javlja `onChange` i na međustanjima dok se tipka godina
(`2026 → 0002 → 0020 → 0202 → 2025`), pa se nagomilaju pomaci od po ~2000 godina.

Fix: inkrementalni pomak od zadnje primijenjene vrijednosti (ref) — zbroj je uvijek
`konačno − izvorno` bez obzira na broj međustanja, dakle **sam se ispravlja**. Uz to sanity
guard u `handleSave` (1900–2200), jer je Postgresova poruka neupotrebljiva.

### 8. Rezultat provjere

| Točka | Očekivano | Dobiveno |
| --- | --- | --- |
| sidro `2025-01-01` = 3.054,41 → 31.03.2025. | banka 2.546,55 = Kokin red 1641 | **2.546,55** |
| sidro `2026-07-01` = 2.255,64 → 08.07.2026. | Kokin 3.403,74 | **3.403,74** |

Drugi red je najtješnja provjera koju podaci dopuštaju: sedam dana, šest transakcija, bez
nakupljenog naslijeđa.

### 9. Poznato odstupanje, s odlukom

`−200,14` na ZABA lancu 2025-08 → 2026-04: četiri retka u bazi **bez opisa** i **bez
protustavke u izvodu** (`45,94`, `150,00`, `2,80`, `1,40`). Provjereno da nisu pomaknute
kopije — `45,94`, `2,80` i `1,40` se **nikad** ne pojavljuju ni u jednom ZABA izvodu
2023-12…2026-06, a `150,00` iz studenog app već ima na pravom mjestu.

Iz izvoda se više ne mogu razriješiti; znala bi samo Koka, a iznosi su mali i stari.
**Sašina odluka: ne loviti dalje**, zapisati kao poznato (`SALDO_MODEL_NALAZI.md` §6.3).
Odstupanje **ne dodiruje današnji broj** — sidro od 01.07.2026. ga presijeca.

### 10. Usklađenje izvora s bazom

`align_review_s110.py`: Review dobiva ono što je ručno uneseno u app (Tip/Podtip na onoj 200,
`Status = Izvrsen` na parkingu). Bez toga bi sljedeći uvoz **tiho** vratio staro — update-guard
(D7) gleda `row_hash` i mirno prepiše ručnu ispravku.

⚠ Time su prekršena dva pravila iz `ENRICH_PLAN.md` §4 (mijenjanje datuma i `Status`a u
Reviewu, pisanje u bazu iz „pre-import review faze"). Oba puta uz Sašino izričito odobrenje,
i oba su pravila sada zastarjela — 2025/2026 su **uvezeni**, pa Review više nije pre-import.
Zabilježeno u `ENRICH_PLAN.md`.

### 11. Odgođeno

**Odluka o `Financije_all > Stanja`** — Sašina odluka da se o tome razgovara u svježoj sesiji.
Provjera ju je oslobodila pritiska točnosti: model je dokazan, pa je pitanje čisto gdje je
stanjima ugodnije živjeti (Excel roundtrip, Kokino stablo, automat iz izvoda).

---

# S111 — RF lanac zatvoren · gotovina izvan salda · svježina po računu (2026-08-18)

**Polazište:** Overview je pokazivao `Kokin tekući ZABA` uredno, a `Sašin tekući RF` **crveno**.
Saša: *„to bi Koku vjerojatno uvrijedilo da joj pokažem."* Ispalo je da crveno nije bug nego
izostanak sidra — ali put do njegovog gašenja otkrio je razred grešaka koji je čekao Kokinu deltu.

### 1. Zatečeno stanje dokumenata

`NEXT_SESSION_PROMPT.md` je najavljivao „razgovor o `Financije_all > Stanja`" kao otvorenu nit.
**Bio je zastario**: §2.18 (necommitano u radnom stablu, pisano 2026-08-17) tu je odluku već
zatvorio — sidra ostaju u zasebnoj tablici, argument je o **vrsti zapisa**, ne o saldu.
Potvrda da provjera commita iz zaglavlja handoffa nije formalnost.

### 2. Kokin novi file — izmjeren prije nego se išta radilo

`Financije 2026-08-16.xlsx`: ukinut sheet `Za Sašu`, Visa retci preseljeni u `sasa EU`.

| Mjera | Rezultat |
| --- | --- |
| lanac `Stanje[i] = Stanje[i−1] + Uplata − Isplata` | 911 redaka, **0 puknuća** |
| razina protiv starog filea na 376 zajedničkih datuma | **Δ 0,00 na svakom** |
| zadnje stanje | 799,12 @ 11.08.2026. |

Njena restrukturacija je dakle **čista**. Novo: kol. **G = datum kupovine**, kol. **C = datum
naplate** (prazna dok naplata ne dođe) — što je doslovno D1b. `koka EU` ima 6 puknuća u dvije
skupine, ali **svaka neto daje 0,00** ⇒ zamijenjeni redoslijedi, ne izgubljen novac.

⚠ Nađeno i: od 323 nova RF retka njih ~186 nisu nova potrošnja nego preformulacija naplata koje
baza već ima iz PBZ izvoda. To je rizik za uvoz delte, izmjeren prije nego je nastao.

### 3. Sidro za RF — i zamka u odabiru datuma

Saša je predložio sidro `02.01.2025. = 3.372,96`, pročitano iz **app exporta**. Dvije stvari:

1. Broj je slučajno **bio** ispravnog podrijetla (atribut `Stanje` na RF retcima dolazi s izvoda),
   ali se to **iz baze ne vidi** — ista kolona za Kokine retke nosi njen izračunati lanac.
   Zato: OCR nad `RF_2024-12.pdf` (`rf_ocr.py`, `_stanje` zadržan kroz patchirani exec).
2. `3.372,96` je stanje nakon **prvog** od **dva** retka toga dana. Sidro je `date`, pravilo je
   „strogo nakon" ⇒ oba bi ispala, a iznos sadrži samo jedan ⇒ **85,07 bi trajno nedostajalo.**
   Ispravan par: `02.01.2025. = 3.458,03`.

⚠ Sidro na `31.12.2024. = 2.560,82` (veća pokrivenost) **nije izvedivo kroz UI**: skup redaka
pločice je `promet ∪ sidra` (`036:214`), a RF na taj dan nema ni jedno ni drugo ⇒ redak se ne
pojavi i nema gdje upisati broj.

Saša je pri upisu napravio **tipfelericu** (`3.453,03`), preskočivši Δ provjeru. Uhvaćeno pri
sljedećem koraku; ispravak je **novi redak** (`036` nema UPDATE policy). Oba sidra ostaju.

### 4. Mjerenje: banka je bila u pravu, spajanje nije

| Strana | Rezultat |
| --- | --- |
| izvodi (196 tx, 03.01.2025 → 06.07.2026) | `3.458,03 − 2.996,21 = 461,82` — **Δ 0,00** |
| aplikacija | `331,57` — **Δ −130,25** |

⇒ **`T-S107d-6` zatvoren**: RF OCR lanac je točan. Sumnja je bila neopravdana.

Sparivanje redak-po-redak dalo je 15 siročadi, **sva u bazi**. Neto `−130,25`, **bruto 2.609,78**
— dvadeset puta. Uzrok: dedup je radio po `(datum, iznos)`, a Koka i banka isti događaj opisuju
**skoro** istim iznosom:

| Datum | Izvod | Kokin redak | Učinak |
| --- | --- | --- | --- |
| 04.12.2025. | −1.285,59 | −1.265,59 „Visa" | −1.265,59 |
| 01.02.2025. | 882,94 | 908,64 „Mirovina I stup" | +908,64 |
| 10.05.2025. | 225,74 | 225,47 „Mirovina III stup" | +225,47 |
| … | … | … | (ukupno 9) |

Dublji nalaz: **Kokin lanac i bankov se razlikuju redak po redak, a slažu u zbroju** — oba daju
`461,82`. Baza koja spoji oba izvora dobije najgoru varijantu.

### 5. Dva zahvata nad podacima

`fix_rf_duplikati.py` (9 redaka, neto `−44,23`) i `fix_rf_ostatak.py` (4 retka bez protustavke
+ 1 suvišan atribut). Oba: dry-run zadano, backup u `_arhiva/`, `Prefer: return=representation`
na svakom DELETE/PATCH, djeca prije roditelja (`event_attributes` nema kaskadu).

⚠ Zaštita koja je bila ključna: svaki duplikat u `SPEC`u nosi i **blizanca koji mora postojati**
— duplikat bez blizanca nije duplikat nego jedini svjedok.

### 6. Gotovina — nalaz koji je promijenio pravilo

Preostali `−66,00 [Cash]` „Promjena guma" nije bio greška unosa. Kontekst iz baze:

```
18.05.2026.  Izvor=Racun  −150,00  Transfer | cash - bankomat   „Koka"
20.05.2026.  Izvor=Cash    −66,00  auto C5 | popravci           „Promjena guma"
```

Banka je izgubila 150 €; baza ih je oduzimala **216 €**. Gotovina je **pot zrcalan kartici**:
podizanje puni pot i miče saldo, trošak prazni pot i **ne smije** micati saldo.

Nevidljivo 18 mjeseci jer Area ima **46 podizanja** i **točno jedan** gotovinski trošak — i
ZABA nema nijedan `Cash` redak, pa verifikacija 17/30 stoji netaknuta.

**Odbačeno (Sašina odluka):** `Gotovina` kao pravi račun s vlastitim saldom. Radilo bi bez
ijedne linije koda i moglo bi se sidriti (prebrojati novčanik = očitanje vanjske istine), ali
traži drugi redak uz svako podizanje i disciplinu bilježenja. *„Novčanik je teško kontrolirati
i nema previše smisla."* Cijena koja se svjesno plaća: **stanje novčanika se ne zna.**

**Izabrano:** `Cash` van filtra — jedna vrijednost u `areas.settings.dashboard`, nula koda,
nula izmjena podataka. Trošak ostaje vidljiv u razrezu po Tipu.

### 7. Usput: dva eventa s popunjena oba smjera

Pretraga cijele Aree dala je **dva**:

- RF 05.05.2025. — `isplata 0,17` (s izvoda) **+** `uplata 0,26` (nema protustavke) ⇒ višak, čisti se
- ZABA 25.08.2025. „Anja 73/96" — `uplata 450,00` **+** `isplata 0,70`; izvod tog dana ima **oba**
  retka, neto `449,30` je točno ono što je banka napravila ⇒ **granularnost, ne greška, ne dirati**

Razlika između ta dva je cijeli posao: izgledaju isto.

### 8. Dvije UI izmjene

**Filtar datuma na Overviewu** (`AppHome.tsx:487`, `activeTab === 'activities'` →
`!== 'structure'`). Jedna linija, dva simptoma: sidrenje unatrag više ne traži skok na drugi
tab, i raspon se **prestaje resetirati** — komponenta se više ne odmontira, pa njen lokalni
`userModified` preživi i auto-init iz `useDateBounds` ne prepiše korisnikov izbor s „All time".
Saša je to prijavio kao „često se resetira"; bilo je deterministično.

**`sql/038` — `last_on` po grupi.** Pločica je tvrdila „na dan 18.08.2026." nad podacima koji
staju 10.07.2026. Isti razred kao dva pravila koja pločica već nosi (ne prikazuj zbroj od
početka kao bankovni broj; reci kad gledaš prošlost) — samo o **svježini**. Povratni tip se
mijenja ⇒ `DROP FUNCTION` + `CREATE`, zato nov file a ne izmjena `036`.

⚠ Graciozan pad: dok `038` nije pušten, `last_on` je `null` — isto kao „nema ničega poslije
sidra". Uvjet je zato `row.last_on || row.n === 0`: **neistina je gora od izostanka.**

### 9. Rezultat

`461,82` na 06.07.2026., **196 promjena** — jednako broju transakcija na izvodu.
Poklopio se i iznos i broj redaka.

### 10. Session artefakti preseljeni u `docs/sessions/`

Povod: Saša je pri D: backupu primijetio da su testovi „prije bili u gitu, a sada nisu".

**Mjerenje je pokazalo da se to nikad nije promijenilo.** `Claude-temp_R/` je u `.gitignore`
od **03.02.2026.** — pola godine prije ijednog od tih fajlova. Dakle svaki praćeni session file
bio je **ručna iznimka** (`git add -f`), a iznimke su se radile neujednačeno i **nekronološki**:

| | |
| --- | --- |
| u gitu | S99 … S107t **i S108** |
| vani | S107o, S107s, **S107u–S107y**, S110, S111 — i `DONE_HISTORY.md` **nikad** |

Usput dvije zamke, obje izmjerene a ne pretpostavljene:

1. **`!Claude-temp_R/DONE_HISTORY.md` nakon `Claude-temp_R/` nema efekta.** Git ne ulazi u
   isključen direktorij, pa negaciju unutra nikad ne pročita. Radi tek `Claude-temp_R/*` + negacije.
2. **`git check-ignore -v` ispisuje pravilo i kad je negacija.** Rezultat se mora čitati po
   **izlaznom kodu**, ne po tome ima li ispisa — na tome sam se prvi put prevario i javio
   krivi nalaz.

Saša je odabrao **puni premještaj** umjesto zakrpe u `.gitignore`: problem nestaje umjesto da
dobije pravilo koje netko mora pamtiti.

```
Claude-temp_R/DONE_HISTORY.md      → docs/sessions/DONE_HISTORY.md
Claude-temp_R/PENDING_TESTS.md     → docs/sessions/PENDING_TESTS.md
Claude-temp_R/test-sessions/*.md   → docs/sessions/tests/*.md      (32 fajla)
Claude-temp_R/test-sessions/archive/  OSTAJE                        (zatvoreno = radni stol)
```

Kriterij koji to reže bez iznimaka: **što end-of-session ritual proizvede → `docs/sessions/`;
radni stol → `Claude-temp_R/`.** `.gitignore` nije diran.

⚠ Premještanje lomi reference, a mrtva referenca se **ne javi greškom** — isti razred kao
rename sluga (S105d). Zato: 23 fajla kroz `git mv` (povijest sačuvana), 6 fajlova s
prepisanim putanjama, 16 relativnih linkova u `PENDING_TESTS`, i jedan link produbljen za
razinu (`../../` → `../../../`, jer su test fajlovi sišli jednu razinu dublje). Na kraju
**programska provjera da se svih 37 fajlova i svaki njihov link razrješuje** — našla je jednu
mrtvu (`UPUTE_izvodi.md`, koji je ostao na radnom stolu) i ona je popravljena.

---

# S112 — kako Koka rješava deltu · Faza 0 i Faza 1 (2026-08-19)

**Polazište:** Kokin novi file (`Financije 2026-08-16.xlsx`) čeka uvoz. Saša je tražio
**razgovor prije koda**, i to s izričitim ciljem: *„nije nam cilj samo uvesti deltu nego razviti
najefikasniji način da Koka rješava deltu."* Sesija je zato pola mjerenje i dogovor, pola gradnja.

### 1. Delta je izmjerena prije nego je itko išta predložio

`Financije 2026-08-16.xlsx` protiv snapshota od 08.07. i protiv TEST baze:

| Razred | ZABA (`koka EU`) | RF (`sasa EU`) |
| --- | --- | --- |
| novo, nakon zadnjeg eventa u bazi | 110 | 9 |
| dodano *unutar* već uvezenog razdoblja | 6 | 2 |
| kartične stavke koje baza **već ima** | ~46 (MC 11.07.) | **220** (Visa) |
| kartične stavke kojih baza nema | 45 (MC 11.08.) | 42 (Visa 07.08.) |
| planirano (bez naplate) | 11 | 22 |
| izmjena postojećeg retka | 20× planirano→naplaćeno | 1× iznos |

**Sparivanje Kokinih Visa redaka protiv baze (±3 dana, isti iznos): 207 od 208 kupovina
01–06/2026 već postoji.** Njeni stari kartični retci ne donose novac nego **opise**.

### 2. Glavni nalaz razgovora: delta nije datumski raspon nego skup razlika

Datumski rez ne radi ni u jednom smjeru. Za Visu je granica baze **zadnji obrađeni izvod**, ne
datum: 42 srpanjske kupovine imaju `event_date` *prije* zadnjeg eventa u bazi, a ipak nedostaju
(PBZ izvod za srpanj nije bio obrađen), dok 220 starijih postoji.

Drugi nalaz iste vrste: **„promijenila / dodala" nije podatak nego interpretacija.** Kokin file
nema identitet retka, pa se promjena vidi kao *jedan nestali + jedan novi redak*
(`Mirovina III 250,93 → 253,51` izgleda identično kao brisanje + dodavanje).

⚠ I treći: **„prazan C ⇒ planirano" nije istina.** Od 85 njenih Visa redaka bez datuma naplate,
**35 je uredno naplaćeno** (travanjska grupa, Σ `783,76`) — samo im nije upisala datum.
Razlikuju se jedino po tome što imaju popunjeno `Stanje`, tj. leže *unutar* lanca.

### 3. Izvodi su promijenili plan

Dva nova PDF-a u `izvodi/` pokazala su se kao točno ono što je Koka prepisivala rukom:

| Izvod | Sadrži | Odgovara |
| --- | --- | --- |
| `MC_2026-07.pdf` (obavijest 01.08., dospijeće 11.08.) | **1.332,52** | njenoj MC grupi od 11.08. u cent |
| `PBZVIZA_2026-07.pdf` (dospijeće 12.08.) | **1.171,59** | njenoj Visa grupi od 07.08. u cent |

⇒ **skupne naplate se ne moraju sintetizirati** — banka ih je ispisala, zajedno sa stavkama.

**Usput nađena greška u bazi:** 12 MC kupovina (01–05.07.) nosi `Datum naplate = 11.07.`, a
banka ih je naplatila **11.08.** Vidi se i zbirno: košara „naplaćeno 11.07." ima **73 retka i
`2.231,02`**, a banka je tog dana skinula **`1.244,74`**. Saldo to ne dira (kartične stavke nisu
u njemu), ali lomi svaku buduću automatiku „dospjelo → potvrdi".

### 4. Onih 6 spornih lipanjskih redaka

Koka je na **dno** filea (iza 13.08.) dopisala pet redaka datiranih 16–17.06., Σ `373,11`.
Provjera protiv `ZABA_2026-06.pdf`: `207,26`, `57,19` i `13,31` **nisu na izvodu**; `75,24`,
`222,62`, `20,11`, `49,04`, `62,10` jesu — i baza ih već ima, u cent.

⚠ Najvjerojatnije kolovoški računi s krivo utipkanim mjesecom. Uvezeni s lipanjskim datumom
pali bi **prije ZABA sidra** (01.07.) i po pravilu „strogo nakon" tiho ispali iz salda — `373,11`
bi nestalo bez ijedne greške na ekranu.

### 5. Odluke (Sašine)

- **D-1: preskočiti** Kokine kartične retke iz razdoblja koje izvodi već pokrivaju.
- **D-2: „Koka sada, izvod potvrda"** — njeni retci ulaze, izvod odmah zatim provjerava.
  ⚠ Uz uvjet da je provjera **mehanička** (sparivanje s tolerancijom + potvrda razlike): u S111
  se pokazalo da joj se iznos razlikuje od bankinog na ~4 % redaka, a kako kartične stavke ne
  diraju saldo, takva greška **nikad ne ispliva sama**.
- **Granica je datum, ne vrsta retka.** Prije datuma piše pipeline, poslije piše samo ona.
  Granica po vrsti („kartice iz izvoda, tekući od Koke") traži prosudbu na svakom retku, zauvijek.

### 6. Faza 0 — četiri sitnice, svaka gasi jedan razred tihe greške

**0.1 Datum-atribut je sad pravi Excel datum** (`src/lib/excelDatetime.ts`).
Export je pisao sirovo `2025-01-07T12:00:00+00:00`, import je datumsku ćeliju pretvarao u
`toISOString()` (ponoć UTC). Kao stringovi se razlikuju, kao trenutak ne — pa je `computeRowDiff`
**svaki dodirnut redak** prijavljivao kao promjenu `Datum naplate` i prepisivao ga.
Kanonski oblik `YYYY-MM-DDTHH:mm` sad vrijedi na obje strane, uključujući otisak retka; bez toga
bi D7 skip nedirnutih redaka tiho prestao raditi. Dodana i Data Validation tipa `date`.
Provjereno roundtripom kroz stvarni `.xlsx`, uključujući oba DST prijelaza (16/16).

**0.3 `planirano` je dobilo `Izvor` filtar** (`sql/037`). Split je koristio samo
`Status = Planiran`, pa je brojio kartične stavke **i** planiranu skupnu naplatu koja ih plaća:
`−2.521,38 (13)` umjesto `−2.089,86 (2)`. Razlika `431,52` je dvostruko brojanje.
⚠ Ta izmjena je razbila drill na „planirano" (uzimao `split.filters[0]`, sad zajednički uvjet),
pa drill sada bira **uvjet koji bazni filtar nema** — radi za bilo koju konfiguraciju.

**0.2 i 0.4 su premješteni u alat, s razlogom.** Automatska dodjela `session_start` u importu
ubila bi zaštitu koja već postoji: **kolizija je način na koji se hvata dvostruki uvoz istog
filea.** Upozorenje na pred-sidreni redak traži da import poznaje `dashboard` config i sidra —
u generatoru je besplatno.

### 7. Faza 1 — delta sheet (`src/lib/deltaSheet.ts`)

Nastaje **nad** običnim Activities exportom, pa se uvozi istim putem, s istim `row_hash` skipom
i update-guardom. Dodaje tri stvari: prazne retke s prepisanim kolonama i **unaprijed upisanim
vremenima** (`14:00+n`, pojas koji povijesni uvoz nije dirao), kolonu `Stanje (kontrola)`, i
ćeliju „u banci piše" s razlikom koja **zeleni na nuli**.

Uvjeti se **čitaju iz `dashboard` configa**, ne prepisuju u kod — isti izvor iz kojeg ih čita
RPC. Uvjet koji se ne da prevesti u `SUMIFS` javlja se kao upozorenje umjesto da tiho ispadne.

Formula je `SUMIFS` po datumu ≤ datum retka, **ne** „prethodni redak + uplata − isplata":
lančana se raspadne na prvom sortu, a korisnik sortira čim doda redak sa starijim datumom.

**Prva verzija je dala 1.010 redaka** — prozor je išao od sidra, a RF sidro je od 02.01.2025.
Saša: *„trebao bi stavit sidro na neki bliski datum."* Odbijeno kao rješenje, prihvaćeno kao
navika: alat koji traži blisko sidro traži baš ono što bi trebao proizvesti, a Kokin prvi put
bit će uvijek slučaj sa starim sidrom. Umjesto toga **prozor od 60 dana** i **otvarajuće stanje
koje aplikacija računa** na dan prije prozora (isti RPC koji hrani pločicu).

⚠ Otvarajuće stanje **nije sidro** i tako je i označeno — bilješka na ćeliji kaže na kojem sidru
počiva. Ako razlika na dnu ne padne na nulu ni nakon češljanja prozora, greška je **starija od
prozora**. Bez toga bi izgledalo kao da je greška u zadnjih 60 dana.

Rezultat: **RF 9 redaka umjesto 1.010**, ZABA 15. U sheet idu samo retci koji miču saldo
(`Izvor = Racun`), **ali planirani ostaju vidljivi** — to je nalaz o ratama: baza već ima buduće
rate kao `Planiran`, pa ako ih sheet sakrije, korisnik ih dopiše iz bankovne aplikacije i dobiju
se dvaput. Ovako ih **potvrdi**, i kontrolni stupac ih istog trena uračuna.

### 8. Tri popravka nakon Sašinog prvog pokušaja

1. **Razlika `0,00` bojala se crveno.** Zbroj stotinjak `SUMIFS` članova nosi grešku binarnog
   zapisa (~`1e-13`), pa ono što se ispisuje kao nula doslovno nije nula. `ROUND(…, 2)`.
   ⚠ Brojka je pritom bila **točna** — sheet je reproducirao `712,75` do zadnje znamenke.
2. **Export profil se nije primjenjivao** u delta modu (file je dolazio sa svim kolonama).
   Sad prolazi isti put; ⚠ profil **prije** delta alata, jer profil dira kolone po položaju a
   kontrolni stupac se dodaje zadnji — obrnuto bi ga profil mogao sakriti.
3. **Predugačka oznaka** otvarajućeg stanja prelijevala se preko sažetaka; skraćena, podrijetlo
   preseljeno u bilješku na ćeliji.

### 9. Import: redak predloška

40 praznih redaka nosi prepisani `Area`, pa ih je parser vidio kao prave retke i svaki prijavio
kao „event_date is required". Sada se preskaču, ali **broje** i prikazuju kao upozorenje.
⚠ Kriterij ne gleda prepisane atribute nego ono što upisuje čovjek: datum, opis ili **bilo koji
broj** — redak s iznosom a bez datuma i dalje pada kao greška. Tiho progutan iznos je gore od poruke.

### 10. Zatečeno usput

- **Krivo RF sidro (`3.453,03`) više ne postoji** — obrisano između sesija. `T-S111-2` time nema
  što provjeriti i briše se.
- U cijeloj TEST bazi postoje **dva** `datetime` atributa (`Datum naplate`, `Due Date` u Demo),
  pa je domet izmjene 0.1 točno onaj koji je ciljan.

---

# S113 (2026-08-21) — tranše 1 i 2 zatvorene izvodom, `fill_from_izvod.py`

Sesija je počela testom T-S112-3 i završila s **dva bankovna lanca potvrđena izvana** i alatom
kojim se delta rješava bez prepisivanja rukom.

### 1. Tranša 1 — uvezena i potvrđena

7 redaka + ispravak `250,93 → 253,51` ušlo je kroz delta sheet (`7 New / 1 Modify / 8 Unchanged`,
33 prazna retka preskočena). Overview je dao **1.716,55** na 04.08. — brojku iz Kokinog lanca.

Zatim je `RF_2026-07.pdf` (OCR) potvrdio **svih 7 redaka u cent**, uključujući ispravak, a
ispisana stanja izvoda poklopila su se s kontrolnim stupcem **redak po redak**
(`715,33 … 1.716,55`). Time je D-2 („Koka sada, izvod potvrda") prvi put odrađen mehanički.

### 2. Tranša 2 — sastav je bio drugačiji nego u planu

Izvod je pokazao da Visa naplata `1.171,59` i naknada `0,17` padaju **07.08.** (ne 11.08.), te da
11.08. stiže **+254,33** (Mirovina III) koje u planu nije bilo. Kokina brojka `799,12` je bila
točna, sastav nije. Tri Racun retka uvezena, pločica dala **799,12** — jednako **ispisanom**
`NOVO STANJE` s izvoda. Sidro postavljeno na 11.08. (**T-S112-6 ✅**), lanac skraćen s 207
promjena na nulu.

Zatim 45 Visa stavki (47 s računa, 2 već u bazi) — saldo netaknut, kako i mora biti.

### 3. Novi alat: `fill_from_izvod.py`

Puni app-ov Excel retcima s izvoda, **po imenu zaglavlja** (raspored kolona nebitan). Izvori:
`--rf` (OCR), `--zaba`, `--visa`. Dedup protiv redaka na listu **i** protiv zasebne reference
(`--protiv`), s **tolerancijom na datum**. Opisi se preuzimaju iz Kokine Excelice (`--koka`).

Usput je alat otkrio četiri stvari koje bi inače prošle tiho:

1. **Isti redak pod drugim datumom** — `Mirovina III stup` je na izvodu 09.07., u bazi 10.07.;
   dedup po točnom `(datum, iznos)` bi ga uveo drugi put.
2. **Kartični izvod bez `--protiv` duplicira** — delta sheet ne sadrži kartične retke, pa dedup
   nema što usporediti, a saldo grešku ne osjeti.
3. **Krivi račun u krivom sheetu** prolazio je bez poruke → dodana brana.
4. **Prazan prozor** (usklađen račun) daje prazne retke bez `Area`.

### 4. Bugovi nađeni i popravljeni

| Što | Posljedica |
| --- | --- |
| `Date.UTC` mjesec 0-based | delta prozor kretao **mjesec prekasno**; retci tog mjeseca tiho ispadali |
| `Area`/`Category_Path` iz prvog retka | usklađen račun ⇒ predložak bez `Area` ⇒ uvoz „0 New" nad punim fileom |
| `errorStyle="error"` u Data Validation | nevaljan OOXML; Excel ga progura, **openpyxl padne** — app-ov export nije se dao otvoriti alatom |
| openpyxl bilješka | apsolutna putanja u relacijama ⇒ exceljs padne, **cijeli file neuvoziv zbog jedne bilješke** |
| profil pozicijski preko atributa | mogao sakriti `row_hash`/`Delete?`/`Result` u izvještaju |
| `run.bat %2 %3 %4` | tiho rezao peti argument nadalje |

### 5. Podrijetlo sidara

Pločica je dobila izbornik **„odakle"** (zatvoren popis + detalj kad je izvod), a
`make_saldo_anchors.py` piše isti oblik. Svih 5 sidara normalizirano; dva bez bilješke
istražena iz izvoda: RF `3.458,03` je **tekuće stanje ispisano uz redak od 02.01.2025.**
(`RF_2024-12.pdf`), ZABA `1.184,86` je `NOVO STANJE` iz `ZABA_2025-12.pdf` — izvod zatvoren
24.12., a sidro datirano 31.12.; provjereno da između nema prometa, pa je iznos istinit i tada.

### 6. Zatečeno usput

- `ZABA_2026-07.pdf` (tekstualni): **POČETNO 2.255,64** — u cent jednako našem sidru od 01.07. —
  38 transakcija, zadnja 30.07., **NOVO STANJE 13.815,33**. Tranša 3 ima vanjski kontrolni broj.
- `PBZVIZA_2026-07.pdf`: **47 kupovina, Σ 1.171,59** — u cent jednako naplati na RF izvodu.
- 11 kartičnih stavki **nema para** u Kokinom fileu (pitanje za nju, ne prepreka).


---

# S114 — tranša 3 (ZABA) · klasifikacija iz povijesti, ne iz heuristike (2026-08-22)

**Rezultat u jednoj rečenici:** ZABA lanac je zatvoren protiv **ispisanog** `NOVO STANJE`
(`13.815,33` @ 30.07.2026.), a svih 28 novih redaka je klasificirano — bez ijednog pogađanja,
protiv izbrojane povijesti i uz provjeru parova protiv `validation_rules`.

## 1. Tranša 3 — brojka je izašla prije uvoza

Delta sheet (prozor 60 dana, **150** praznih redaka umjesto zadanih 40), pa
`fill_from_izvod.py --zaba`: **38 transakcija na izvodu, 7 već u bazi, 31 novih.**

```
 2.255,64  otvarajuće stanje (app računa, 01.07.2026.)
11.559,69  neto cijelog izvoda (uplate 14.110,47 − isplate 2.550,78)
─────────
13.815,33  = ispisano NOVO STANJE na ZABA_2026-07.pdf   ✔
```

Uvoz: **31 New / 1 Modify / 7 Unchanged**, 119 praznih redaka predloška preskočeno i **prijavljeno**.

Onaj `1 Modify` je bit tranše: planirana MC naplata `1.244,74` (11.07.) postala je `Izvrsen`
jer je izvod potvrđuje u cent. Dedup ju je ispravno preskočio kao već postojeći redak.

## 2. Zamka koja je izašla iz same kontrolne formule

Kontrolni stupac **ne broji `Planiran`** (`$U:$U,"<>Planiran"`). Dok je `1.244,74` stajao kao
planiran, kontrola je davala **15.060,07** — točno `1.244,74` previše. Nije bug: to je isti
mehanizam zbog kojeg planirani retci **moraju** ostati vidljivi u sheetu. Ali znači da
usklađenje ima **obavezan ručni korak**: potvrdi u sheetu što je banka naplatila, pa tek onda
čitaj kontrolni broj. Bez toga razlika izgleda kao greška u podacima, a nije.

Isto vrijedi za ćeliju `razlika`: šuti dok `u banci piše` nije popunjen rukom — namjerno,
jer bi inače provjera bila tautološka (§2.17).

## 3. `--koka` je na ZABA izvodu bio mrtvo slovo

`zaba_rows()` je primao `koka` i **nikad ga nije pozvao** — samo `visa_rows()` je zvao
`koka.find()`. Ispis je pritom govorio `Kokini opisi: 0 spareno, 0 bez para`, što se čita kao
„pokušano, ništa nije našlo", a zapravo znači „nije ni pokušano". **Brojač koji nula pokušaja
prikazuje kao nula rezultata je gori od nikakvog brojača.**

Posljedica bi bila 27 redaka s tekstom `Kreditni transfer nacionalni u eurima on-line
bankarstvom` — istim za T-com, T-mobile, Holding, parking i posmrtnu pripomoć.

Popravak: `koka.find()` i u `zaba_rows()`, ali s **uskim** prozorom.

## 4. Prozor sparivanja mora ovisiti o izvoru

Za kartice je prozor `−3 / +45` dana (ona kupovinu upisuje na dan kupnje **ili** na dan naplate
kartičnog računa). Na tekućem računu ista tolerancija nije velikodušna nego opasna:
`Cash 100,00` se ponavlja svakih par tjedana, pa bi prvi bankomat pokupio opis nekog kasnijeg —
tiho, jer se iznos i dalje slaže. Ondje je njen datum bankin datum ⇒ **`0 / +1`**.

`+1` nije kozmetika: `Zoran povrat 9,51` je na izvodu 17.07., kod nje 18.07.

Rezultat: **30 od 38 spareno.** Provjerena su tri pogotka koja su izgledala kriva
(`14.07. Parking 100,00`, `19.07. Zoran struja 290,00`, `30.07. Cash 100,00`) — sva tri su
njeni stvarni retci: kod bankomatskih podizanja ona bilježi **na što** je gotovina otišla,
a banka samo da je podignuta. `Tip` ostaje s pravila, mijenja se samo tekst za čovjeka.

## 5. Nalaz koji bi inače prošao kao uredan podatak

Preostalih 6 nesparenih redaka po `0,70` **nisu bankovni troškovi nego parking.**

Ona vodi **jedan** redak `Parking 1,40` (13.07., 27.07., 30.07.), banka svaki naplaćuje kao
**dva** naloga po `0,70`. Sparivanje po `(iznos, datum)` ih zato ne može naći — iznos se ne
poklapa ni s čim. A njihov strojni tekst (`Kreditni transfer nacionalni…`) u povijesti vodi na
`Domaćinstvo / Bankovni troškovi` (12×) — dakle u **krivi razred, i to uvjerljivo**.

Ovo je nova varijanta S111 nalaza o skoro-duplikatima: ondje su se dva izvora razlikovala u
**iznosu** istog događaja, ovdje u **broju redaka** za isti događaj. Zajedničko im je da ključ
`(iznos, datum)` ne vidi ni jedno ni drugo.

## 6. Klasifikacija: povijest kao autoritet, dropdown kao brana

Umjesto pravila po tekstu izvoda, `Tip`/`Podtip` su izvučeni **prebrojavanjem kako je isti
Kokin tekst klasificiran u 4.992 retka Reviewa**:

| Kokin tekst | Tip / Podtip | Povijest |
| --- | --- | --- |
| Parking (11 redaka) | `Prijevoz / Taksi, Zet, Parking` | 118/118 |
| T-com · T-mobile | `Informatika / Komunikacije_T-com` · `_T-mobile` | 40/41 · 41/42 |
| Saša/Nataša Holding | `Kuća / Holding (smeće)` | 39/39 · 41/41 |
| Nataša povrat / popvrat | `Transfer / Natasa` | 5/5 |
| Zoran povrat | `Kuća / Povrat Zoran` | 41/41 |
| Povrat poreza | `Porezi / porez/prirez/dohodak` | 4/5 |
| PP Saša 7/60 · PP Koka 7/60 | `Zdravlje / PP (Posmrtna pripomoc)` | 10/10 |
| HLK 07/26 | `Zdravlje / Lječnička komora_Koka` | 16/18 |
| **Anja 84/96** | `Prihodi / Povrat Anja` | 41/41, **niz `81/96 → 82 → 83 → 84`** |
| Anja povrat | `Transfer / Anja` | 19/19 za ne-ratne |
| **MC naplata 1.244,74** | `Transfer / izmedju racuna` | 31/31, **niz 11.01.–11.06.2026.** |

Tri retka povijest nije mogla riješiti i o njima je **odlučio čovjek**: `Nena` 7.000 + 5.000
(povijest zna samo „Nena pričuva" od 7–75 €) i `Mall.hr povrat` 79,99 → **Sašina odluka:
`Prihodi / Koka`**. Podtip `Prihodi / Nena` je razmotren i odbijen — taksonomija se zaključava
prije importa, ime bi živjelo i u `validation_rules` i u `value_text` (razred S105d).

**Brana:** novi alat `klasificiraj_transu.py` **provjerava svih 18 parova protiv `DropdownData`
lista app-ovog exporta prije nego išta upiše** (17 Tipova, 65 podtipova). Podtip mimo
`validation_rules` uvezao bi se kao običan tekst i ne bi javio grešku — vidio bi ga tek kad ga
dropdown poslije odbije, a tada je već u bazi.

Uvoz: **0 New / 28 Modify / 4 Unchanged** (ona 4 su bankomatski retci, već klasificirani pravilima).

## 7. `845,12` — razriješeno, negativno

Planirani redak od 11.07. koji je od S113 stajao kao „neobjašnjen": **nije na srpanjskom ZABA
izvodu i nema ga nigdje u Kokinom fileu** (pretražena oba lista po iznosu, 0 pogodaka). Ostaje
`Planiran` pa ne dira kontrolni broj. Pitanje za nju, ne prepreka.

## 8. Zatečeno usput

- **Izvještaj o uvozu nema `DropdownData` list** (`Events / HelpEvents / ImportReport / Filter`),
  pa u njemu nema `Tip`/`Podtip` dropdowna. Za pipeline nebitno, **za Koku bitno**: izvještaj je
  mišljen kao mjesto gdje se dorađuje uvezeno, a ondje bi tipkala slobodan tekst bez provjere.
- **Delta export nudi 40 praznih redaka**, a tranša ih je trebala 110+. Redak koji ne stane pada
  **izvan raspona kontrolnog stupca** — brojka bi bila uvjerljiva i nepotpuna. Polje postoji od
  S113; ovo je prvi put da je zadana vrijednost bila premala.
- **Dva retka u Kokinom fileu datirana su `2036-04-08`** (`Mirovina 1.323,64`, `Netdomena Igor
  47,76`) — gotovo sigurno tipfeler za 2026. Isti razred kao S110 nalaz.


---

# S115 — 2026-08-22 (druga sesija istog dana) · razgovor, mjerenje, plan za PROD

**Bez koda.** Jedna promjena podataka (obrisan jedan event), tri razriješena otvorena pitanja,
jedan novi bug i plan za PROD koji je usput **prepolovljen** jednim svojstvom koje već postoji.

## 1. Sidro ZABA je krivo datirano — nađeno na slici, potvrđeno u bazi

Saša je otvorio Overview i pločica je pisala **„od potvrde 22.08.2026."**. Ispis sidara iz baze:

```
2026-08-22  Kokin tekući ZABA  13.815,33  note='ispisano stanje s izvoda · ZABA_2026-07.pdf'
```

Iznos je ispravan i vanjski. Datum je od klika — a `ZABA_2026-07.pdf` se **zatvara 30.07.**
App je oba podatka imao **u istom retku** i nije ih usporedio.

Po pravilu „promjene **strogo nakon**" sve datirano 31.07.–22.08. time ispada iz salda.
Provjereno: **danas ne gubi ništa** (u tom prozoru nema nijednog ZABA retka — svih 7 su RF).
Ali sljedeći uvoz pada točno u njega: MC naplata `1.332,52` @ 13.08. i ~87 Kokinih kolovoških
redaka. ⇒ **BUG-S115-ANCHORDATE**, popravak je prvi zadatak S116. `T-S114-1` je time
**izmjeren i pao** — nije ostao neprovjeren.

Drugi put u dvije sesije da krivo sidro traži SQL (S111: tipfeler `3.453,03`) ⇒ backlog stavka
„popis sidara + brisanje u UI-ju" nije više teorijska.

## 2. `845,12` — obrisan, s dokazom

Pretraga triju verzija Kokinog filea po iznosu:

| File | Nalaz |
| --- | --- |
| `Financije 2026.xlsx` (08.07.) | **postoji — bez datuma i bez opisa** |
| `Financije 2026-07.xlsx` | nema |
| `Financije 2026-08-16.xlsx` | nema |

U bazi je stajao kao `Planiran`, `Tip = N/A`, bez `Datuma naplate` — dakle ostatak, ne
transakcija. Bio je **jedina** stavka na liniji „planirano" ZABA pločice, pa je tvrdio da će
pomaknuti stanje. Obrisan (7 atributa + event, DELETE provjeren po vraćenim retcima).

**Razred, ne slučaj:** redak koji izvor obriše nakon uvoza **ostaje u bazi zauvijek** — uvoz
vidi ono što piše, ne ono što je nestalo. Usporedba stare i nove verzije izvornog filea je
jedini način da se takvi nađu.

## 3. Retci iz 2036. — NE ispravljati i uvoziti

Dva njena retka datirana `2036-04-08` izgledaju kao očit tipfeler za 2026. Provjera u bazi:

```
1.323,64 → 2026-04-08  Kokin tekući ZABA  Prihodi / Koka
   47,76 → 2026-04-08  Kokin tekući ZABA  Informatika / Hosting domene (DPS, Igor)
```

**Već su unutra**, uredno klasificirani, ušli preko travanjskog izvoda. „Popravi godinu pa
uvezi" bi ih udvostručio — i to tiho, jer padaju prije ZABA sidra pa ne bi pomaknuli nijednu
kontrolnu brojku. Popravak ide **u njen file**, ne u bazu.

## 4. Koliko je Kokin file otišao dalje od baze

| | retci nakon 30.07. | u bazi |
| --- | --- | --- |
| „koka EU" (ZABA) | **87** | 0 |
| „sasa EU" (RF) | **68** | 6 |

Zadnji zapis po računu u bazi: ZABA **2026-07-30**, RF **2026-08-11**. MC naplata `1.332,52`
**nije u bazi**. Dakle: **oba bankovna računa jesu usklađena protiv izvoda**, ali njen file je
u međuvremenu narastao — „tranša 4" više nije MC paket nego MC paket + cijeli kolovoz.

## 5. Svojstvo koje je prepolovilo plan za PROD

Saša je pitao može li se na PROD staviti **sidro** da Koka vidi stanje koje prepoznaje.
Čitanje `036` je pokazalo da je odgovor bolji nego što se činilo: popis grupa je `UNION`
brojanih grupa **i sidara** — *„potvrđeno 1.240,00 i ništa se nije dogodilo je odgovor, nije
odsutnost."*

⇒ **Za novu bazu povijest nije preduvjet.** Koka upiše stanje sa svog ekrana banke i saldo je
od tog trena točan; njeni kolovoški retci trebaju samo zbog **zapisa**. (Uživo neprovjereno —
`T-S115-2`, i cijeli plan stoji na tome.)

Cijena koju to nosi: **Overview postoji samo na `test-branch`**, pa PROD traži deploy.

## 6. Odluke

- **PROD bez žurbe.** Ne sutra ujutro pod pritiskom. Redoslijed: kolovoz u miru → kolone po
  Arei → testiranje → deploy na `main` → Saša testira na **njenom PROD računu lokalno** → javi
  joj da može s mobitela.
- **Kolone Activities liste po Arei.** Za Financije `Datum | Smjer + iznos | Tip / Podtip |
  Opis | ⋮`, uski ekran u dva reda. **Tip i Podtip jedna spojena kolona**
  (`Domaćinstvo / Hrana i ostalo`) — Sašina odluka. Generičko ostaje Areama bez postave.
- **Izvodi su samo PDF** — ZABA ni PBZ ne nude CSV/Excel. „App čita izvod" je zato **imenovano
  i odloženo**; vrijednost nosi drugi dio te ideje — **pravila u bazi + evaluacija na uvozu**
  (Faza 3), koji PDF uopće ne dira.
- **Kolovoz:** uvozi se po D-2 („Koka sada, izvod potvrda"), uz oznaku da vanjske potvrde nema
  dok ne stigne kolovoški izvod.

## 7. Zatečeno usput

- **`PENDING_TESTS.md` sam sebi proturječi:** kurirani redak „Otvoreno:" navodi jedan skup
  testova, a ⬜ oznake u tijelu filea drugi (⬜ postoje i za S105, S107, S107c, S107d, S107i,
  S107j, S107m, S107n, S107o, S107p, S107x, koje „Otvoreno" ne spominje). Zbog toga **ritual
  arhiviranja nije izveden** — kriterij „svi testovi ✅" se ne može primijeniti mehanički dok
  se to ne uskladi. Zadatak za S116.
- Arhivirana dva generirana izvještaja o uvozu (`import_report_20260822_101209*.xlsx`) u
  `_arhiva/izlazi/`. `.pre-*` backupa ima točno 3 ⇒ ništa se ne seli.

---

# S116 — kolone po Arei · Kokin file kao izvor · sidro na pravi datum (2026-08-23)

Sesija je imala dogovoren plan iz S115 i ~2–3 h. Sašin redoslijed: **1) kolone,
2) kolovoz saldo-retci, 3) ostali kolovoški retci s `N/A` tipom.**

## Sidro — provjera prije upisa, kako pravilo traži

`ZABA_2026-07.pdf` **nije bio** u `Analizirani_izvodi/`, pa ga `make_saldo_anchors.py`
nikad nije vidio. Parsiran izravno: **close 2026-07-30**, POČETNO `2.255,64`
(lanac se poklapa sa sidrom od 01.07.), **NOVO `13.815,33`**.

Netautološka provjera prije nego je išta upisano — app iz sidra `01.07. = 2.255,64`
dolazi na **`13.815,33` na 30.07.** s 38 eventa, Δ = 0. Krivo sidro (22.08.) nije
smetalo jer `036` bira najnovije `confirmed_on <= as_of`, a 22.08. > 30.07.

⚠ **Brisanje sidra blokirao klasifikator** — ostalo Saši za pokrenuti. Napisan
`anchors.py` (`--list` / `--delete <uuid>`): uz svako sidro označi **koje danas
vrijedi** (`►`), pa se mrtvo i pobjedničko vide na prvi pogled. Popunjava rupu iz
Backloga na razini skripte; UI i dalje treba (Koka nema Python).

## Kolone Activities liste po Arei

`areas.settings.list_columns`, slug-based, kroz Structure roundtrip (`ListColumns`
sheet). Uloge, ne imena iz domene: `date · time · category · events · user · pair ·
attr · comment · balance · actions`.

Odluke koje su se pokazale nužne tek pri pisanju:

- **`actions` se pinna na kraj i dodaje ako ga config nema.** Sticky ćelija usred
  tablice pokriva susjede; config bez nje daje listu bez ⋮ menija i ni jedne poruke.
- **`desktopHide` vrijedi samo za zadanu listu.** Area koja je kolone konfigurirala
  tražila ih je sve — sužavanje je posao `mobile` uloge.
- **`ListColumns` import BRIŠE ono čega nema**, za razliku od `Automations`. Kolone
  su jedan uređeni popis, pa je brisanje retka jedini način da se kolona makne;
  „odsutnost ne briše" značilo bi da se kolona može dodati ali nikad ukloniti.
  Zaštita je na razini **sheeta**: nema sheeta ⇒ ništa se ne dira.
- **`pair` pokazuje obje strane kad su obje popunjene** (ZABA `Anja 73/96`:
  uplata 450,00 **i** isplata 0,70 u istom eventu — vjeran spoj dvaju redaka izvoda).
- Prazan iznos je `—`, **nikad `0,00`** — za novac je nula tvrdnja o retku.

Financije: `Datum | Iznos | Tip / Podtip | Opis | User | Stanje | ⋮`.
Skeleton loading state također ide po configu — inače je učitavanje layout shift,
a to je jedina stvar zbog koje skeleton postoji.

## Kolovoz — izmjeren, pripremljen, neuvezen

`Financije 2026-08-23.xlsx`: 3.735 redaka, **175 nakon 30.07.** Ključna raspodjela:
**ZABA 17, RF 6** diraju saldo; **MC 80 + Visa 72** su potovi.

| | |
| --- | --- |
| stvarno novih za uvoz | ZABA **14**, RF **1** |
| njen lanac ZABA 31.07.→13.08. | `13.815,33` → **`13.239,31`** = kontrolni broj tranše 4 |
| njen lanac RF nakon 11.08. | `799,12` → **`796,43`** |

`fill_from_izvod.py` dobio izvor **`--iz-koke`** (ne nov alat — `Target` i `write_rows`
već nose sve zamke). Nalazi ugrađeni u kod:

- **Lanac salda gleda SAMO kolonu C.** `C or G` je dao `12.983,69` umjesto `13.239,31`
  — promašaj za točno zbroj nenaplaćenih kartičnih stavaka, koje kolona G datira
  danom troška. Za `event_date` vrijedi obrnuto (D1b: dan kupovine ⇒ G).
- **Njen model ≠ naš model.** Ona tereti račun svakom kartičnom stavkom; banka skida
  jednu skupnu naplatu. Zbroj se poklapa u cent (45 MC stavki 11.08. = `1.332,52` =
  iznos s `MC_2026-07.pdf`), model ne. Zato `Izvor` određuje **kolona A** njenog sheeta.
  ⚠ I zato je njen lanac **svjedok**: dva modela koja broje različito a daju isti broj
  potvrđuju jedan drugoga; isti broj iz istog modela ne potvrđuje ništa.
- **Redak 2564 (`07.08. Parking 1,60`) je tipfeler u mjesecu.** Tri neovisne potvrde:
  `Parking` već postoji u bazi na **07.07.**, njen vlastiti stupac `Stanje` ga računa
  među srpanjskima (`2.142,74`), i lanac **bez** njega daje točno `13.239,31`.
  ⇒ `--osim 2564`. Odluka je čovjekova, ali broj retka ostaje u naredbi kao trag.
- **Tipfeleri u godini nisu samo 2036.** Nađen i `2028-05-16` (`HLK 5/26`). Alat ih
  **izdvaja i ispisuje**, nikad ne popravlja — ispravak ide u njen file (S115).
- **103 njena retka nose datum kao TEKST** (`'11.05.23.'`, `'28.6.23.'`, `'29.2.2024.'`).
  Svi iz **2023.**, dakle ne diraju kolovoz — ali batch 2023 bi ih progutao bez poruke.
- **`--iz-koke` se ne kombinira s izvodom:** gdje se razilaze (~4 % redaka) nema pravila
  koje bi presudilo, pa jedan prolaz nosi jedan autoritet.

## Što je ostalo Saši

Brisanje sidra (`anchors.py --delete`), pogled na kolone, i sam uvoz kolovoza
(export delta sheeta iz appa ≥ 60 praznih redaka → `--dry` → uvoz). Koraci i
kontrolni brojevi: `docs/sessions/tests/S116_tests.md`, T-S116-6…8.

## Nastavak S116 — kontrola nad datumom sidra (BUG-S115-ANCHORDATE popravljen)

Saša je ispravio krivo sidro ručno u Supabase editoru (izmjena retka: `22.08.` → `30.07.`,
bilješka dopunjena s „izvod zatvoren 30.07.") i postavio pravo pitanje: **što nas sprječava
da to ponovimo?**

Odgovor je bio neugodan: **u aplikaciji ništa.** Sve što je uhvatilo obje greške (S111, S115)
bilo je izvan nje — Python `--report`, `anchors.py`, ručno mjerenje. Koka nema ništa od toga.

⚠ Polje „odakle" **već je postojalo** od S113 — i baš je ono ostavilo dokaz: sidro je nosilo
bilješku `ZABA_2026-07.pdf` **i** datum `22.08.` **u istom retku**, a app ih nikad nije
usporedio. Rupa dakle nije bila nedostatak podatka nego to što se podatak nije koristio.

### Popravak: datum se izvodi iz IZVORA, ne iz klika

Pravilo stane u rečenicu, i zato se da naučiti korisnika:

> **Broj s ekrana → datum je danas. Broj s papira → datum piše na papiru.**

⚠ Prva polovica ove rečenice **preživjela je samo do idućeg pitanja u istoj sesiji** —
v. „Nastavak S116 (2)": očitanje s ekrana ide na **jučer**, jer sidro na danas izbacuje
današnje transakcije iz salda.

- `ekran bankovne aplikacije` ⇒ datum = danas, polja nema (ta strana nikad nije bila kriva —
  broj s ekrana banke **i jest** očitanje za danas)
- `izvod` / `ispis na papiru` ⇒ **prazno** polje, žuto obrubljeno, gumb ugašen dok se ne popuni
- **izvor je postao obavezan** — bez njega app ne zna smije li upisati današnji dan
- **nema zadanog datuma** za papirnate izvore: svaki default bio bi pogodak, a pogodak koji
  izgleda kao podatak je točno ono što je grešku proizvelo

### Tri kontrole uz to

1. **Rečenica o posljedici prije klika:** *„saldo = 13.815,33 € plus sve datirano nakon
   30.07.2026.; sve prije toga smatra se već uključenim."* Pravilo „strogo nakon" izrečeno
   posljedicom, ne pravilom — uz `22.08.` bi tvrdila da su retci od 31.07. već uključeni,
   što je bilo očito netočno. **To je rečenica koja bi bug uhvatila na licu mjesta.**
2. **Upozorenje kad novija potvrda već postoji.** `036` bira najnoviju `confirmed_on <= as_of`,
   pa ispravak na stariji datum ne poništava ništa — a izgleda kao da je prošao. Dvaput
   ugrizlo (S111 tipfeler `3.453,03`, S115 krivi datum).
3. **„povijest potvrda" + brisanje iz pločice.** `listAnchors()`/`deleteAnchor()` postoje od
   S109 i **nitko ih nije zvao**; jedini put do krivog sidra bio je SQL Editor. Sada ▸ označava
   potvrdu od koje saldo kreće, ostale su vidljivo mrtve.

Uz to: guard protiv budućeg datuma u `saveAnchor()` (ne samo u pločici — mora vrijediti za
svakog pozivatelja), i `docs/help/overview.md` prepisan s tablicom izvor→datum i opisom
**što se dogodi ako datum promašiš** (ništa vidljivo — to je cijela poanta).

### Usput provjereno

**RF sidro `11.08. = 799,12` je TOČNO.** `RF_2026-07.pdf` se zatvara **11.08.** (zadnja
transakcija `Mirovina III stup 254,33`) — isti obrazac kao ZABA, ali datum se poklapa.
Time je zatvoreno pitanje otvoreno u paralelnoj sesiji.

## Nastavak S116 (2) — očitanje s ekrana sidri se na jučer

Sašino pitanje: *„može li se desiti da potvrdiš stanje s ekrana s datumom danas, a onda tog
dana bude još transakcija koje ispadnu iz salda?"*

**Može, i tiho.** `sql/036:203` glasi `r.event_date > a.confirmed_on`, a `confirmed_on` je
`date`. Potvrda u 10:00 → sidro na danas → plaćanje u 15:00 upisano s današnjim datumom
**ne prolazi** uvjet i **ostaje vani** dok ga kasnije sidro ne nadjača.

⚠ Nije isti kvar kao BUG-S115-ANCHORDATE: ondje je datum bio **kriv**, ovdje je **točan** a
problem je **granularnost** — sidro zna dan, očitanje vrijedi za trenutak. I ne popravlja se
prelaskom na `>=`: kava kupljena u 09:00 **jest** u broju očitanom u 10:00, pa bi je `>=`
brojao dvaput.

### Sašino rješenje (prihvaćeno, bolje od predložene detekcije)

Pomakni potvrdu na granicu koju pravilo **zna** izraziti:

```
sidro(jučer) = očitano s ekrana − današnji promet
```

Saldo tada izađe točno kao očitani broj, a današnji retci se broje — uključujući one koji tek
dolaze. Provjereno na sva tri slučaja:

| | saldo | |
| --- | --- | --- |
| odmah po potvrdi | `(S − R) + R = S` | ✓ |
| nakon transakcije u 15:00 | `S + 40` | ✓ **slučaj koji je bio slomljen** |
| ujutro, `R = 0` | sidro `= S` na jučer | ✓ točno |

Zadnji redak je argument koji je odlučio: mehanizam **poopćava jedini slučaj koji je oduvijek
bio nedvosmisleno točan** (jutarnja potvrda prije ijedne transakcije). I izjednačava oba puta —
izvod i ekran oboje sidre na „kraj dana kad je dan gotov", pa RPC ostaje **jedno pravilo bez
iznimke**.

⚠ **Bez SQL migracije.** `rpc_area_group_agg` već prima `p_from` (isključiv) i `p_as_of`
(uključiv), pa je `(jučer, danas]` jedan poziv — zbroj u Postgresu, nikad u pregledniku.
Time je otpao planirani `039` na PROD.

### Uvjet, i tri stvari koje ga pretvaraju u provjeru

Mehanizam je točan **dok je današnji promet potpun**. Transakcija koju app ne zna čini `S − R`
krivim, i greška se **zamrzne u sidro** umjesto da ispliva kao Δ — §2.17 kvar, lokaliziran na
jedan dan. To kod ne može provjeriti, pa se pokazuje:

1. **računica prije spremanja:** `13.815,33 + 40,00 (1 danas) = 13.855,33 na 22.08.`
   ⚠ Predznak se u prikazu okreće: promet je negativan pri trošenju, pa bi doslovno
   „očitano − promet" ispalo `13.815,33 − −40,00`.
2. **sirovo očitanje u bilješci** — `amount` više nije broj koji je čovjek vidio, pa bez toga
   nema ga s čim usporediti za pola godine.
3. **uputa umjesto koda:** *prvo upiši današnje, pa pogledaj banku i potvrdi.* Tim redoslijedom
   je `R` potpun i mehanizam egzaktan.

Također: promet se računa s **istim filtrima kao saldo** (S112 zamka doslovno), gumb je ugašen
dok se promet ne izračuna (bez oduzimanja bi sidro dvostruko brojalo današnje retke), i uz
prošli datumski filtar stoji upozorenje da Δ nije usporediv s današnjim očitanjem.

**Granica koja ostaje, svjesno:** transakcija koja se dogodila **prije** očitanja a upisana je
**poslije** potvrde broji se dvaput. Rješava je redoslijed, ne kod — i zato je zapisana kao
test (T-S116-14 dio E), da se zna da je granica, a ne propust.

### Provjereno uživo (23.08., TEST baza)

Prvi put da se išta iz S116 vidjelo u pregledniku. Prošlo: **T-S115-2**, **T-S116-6**,
**T-S116-13**, **T-S116-14 A/B/C**.

**T-S116-14 dio B je jezgra i prošao je.** Na `Sašin tekući RF`: potvrda s ekrana (`799,12`,
bez ijednog zapisa toga dana) dala je sidro `22.08. = 799,12` i nepromijenjen saldo; zatim
event **s današnjim datumom** (`Izvor = Racun`, `Isplata 40,00`) i pločica je pokazala
**`759,12 €`** uz `1 promjena poslije · zadnji zapis 23.08.2026.`

Pod starim ponašanjem (sidro na danas) ostalo bi `799,12` — i to bez ijedne poruke. To je
razlika između mehanizma koji radi i mehanizma koji izgleda kao da radi.

⚠ **Nalaz koji je došao tek iz izvođenja, ne iz čitanja koda:** T-S115-2 prolazi, ali sidro
je moralo biti upisano **skriptom**. Prazna Area daje nula redaka, a polja `u banci` i
`Potvrdi` žive unutar `rows.map(...)` ⇒ na PROD-u prvog dana Koka nema gdje upisati stanje.
Ispravna formulacija: **povijest nije preduvjet, ali jedan event jest.**

Neprovjereno ostaje: put „izvod" u potvrdi (prazno polje za datum, ugašen gumb, budući datum),
rečenica o posljedici za papirnate izvore, T-S116-14 D/E, i cijeli blok kolona (T-S116-1…5).

⚠ Sitnica koja je pojela nekoliko minuta i vrijedi zapamtiti: Python skripta za uređivanje
ovih dokumenata pukla je na `„ekran"` unutar `"..."` literala — hrvatski navodnik se zatvara
**ASCII** znakom `"`, koji prekine string. Tekstovi s hrvatskim navodnicima idu u `''' '''`.

---

## Done S117 (2026-08-24): kolone i sidro provjereni · kolovoz uvezen · unos prepravljen za Koku

Sesija je počela pitanjem „što najbrže na PROD" i završila tako da je **kod prvi put cijeli
viđen uživo**, kolovoz uvezen u cent, a tri stvari koje bi Koki svakodnevno smetale — maknute.

### Testovi: sve prošlo

`T-S116-1…5` (kolone po Arei), `-7/-8` (uvoz kolovoza), `-9` (guard), `-10/-11/-12` (put
„izvod" kod sidra). Time je S116 zatvoren osim `T-S116-14 D/E` i grantee slučaja kod `-13`.

### Pet popravaka, i nijedan nije bio planiran — svi su ispali iz testiranja

1. **`Sep` nije preživljavao roundtrip.** Config je imao `' / '`, `cellStr` pri uvozu trima →
   `'/'`. Trim je ispravan za svako drugo polje i baš zato je ovdje promašio: `Sep` je jedino
   polje kojem je razmak podatak. **Sašino rješenje je bolje od obje moje varijante** — ne
   zaobići trim nego birati vrijednost nad kojom trim nema što napraviti. Zadano je sada
   tijesno `/`, pa je roundtrip idempotentan po konstrukciji.
2. **`depends_on` fixup se poništavao unutar istog Save-a.** Petlja upisuje
   `buildValidationRules` iz panelnog stanja za svaki atribut; fixup je pisao u bazu *unutar*
   te petlje, pa je dolazak do ovisnog atributa vratio stari slug preko njega. ⚠ Preživljavanje
   je ovisilo o `sort_order` — `Tip`(6) prije `Podtip`(7) = pad, obrnuto bi **prošlo test**.
3. **Gumb je nudio potvrdu na budući datum.** Podatak je bio siguran (dva guarda), ali gumb je
   pozivao na klik koji će odbiti. Sada je u `disabled`, s vidljivim objašnjenjem.
4. **T-S107u-2** — oscilacija `Status.default_value`. Nalaz je bio veći od opisa: **zatvoreni
   krug preko obje strane** (export gubi atributov default, import mu podmeće tuđi iz
   `default_map`). ⚠ Tri sesije je nosio oznaku „bezopasno" — a bio je bezopasan samo **dok**
   `default_value` nitko nije čitao. Isti dan kad ga je skrivanje-na-defaultu počelo čitati,
   prestao je biti bezopasan.
5. **Brojač skrivenih polja obećavao je više nego što otkrije** (`3 fields hidden` → dva).

### Kolovoz: `13.239,31` i `796,43`, oba u cent

ZABA: 14 Kokinih redaka + skupna MC naplata `1.332,52`. RF: jedan redak (`RF naknada 2,69`).

**Potvrda vrijedi zato što dolazi iz dva različita modela**: njen lanac tereti račun svakom od
59 kartičnih stavaka, naš s 15 redaka. Isti cent iz istog modela ne bi značio ništa.

⚠ **Datum MC naplate je bio krivo zapisan** (`@ 13.08`). S papira: `MC_2026-07.pdf` →
`Datum dospijeća: 11.08.2026.`, a povijest to potvrđuje — skupna MC naplata je **na ZABA
izvatku**, uvijek 11. u mjesecu, osam mjeseci zaredom.

⚠ **Pet redaka klasificirano ručno** (`Cash` ×4 → `Transfer / cash - bankomat`, `RF naknada` →
`Domaćinstvo / Bankovni troškovi`, 6/6 u bazi). `--klasificiraj` ih nije uzeo jer broji iz
**Review snimke od 10.07.**, ne iz baze — ne vidi ništa što je ušlo poslije.

### Tri stvari koje bi je svakodnevno gnjavile

**Zaglavlje Add Activity po Arei.** Sašina ideja, isti obrazac kao kolone. Jezgra nije bila
prosljeđivanje propsa: `sessionStart` je nosio **dvije uloge** — ishodište štoperice i trenutak
zapisa. Zato birač datuma nije mogao postojati. Sada su `sessionStart` i `eventAt`.
Posljedica: unos za prošli dan traje **jedan ekran** umjesto dva.

**`HiddenInAdd` po atributu.** Postojeće skrivanje-na-defaultu ne pomaže jer može sakriti samo
polje koje **ima** vrijednost; smetaju ona čija je ispravna vrijednost **prazno**. Izmjereno:
`default_value` postoji na **7 atributa u cijeloj bazi**, svi u `Fitness_Garmin` — mehanizam je
u Financijama bio potpuno neaktivan, otud „nije nam baš pomogla".

**Konvencija `~`** za nesiguran iznos, na **početku** opisa (lista reže dugačak tekst).

### Ispravak koji vrijedi zapamtiti kao metodu

Tvrdio sam da kartični redak treba `Status = Izvrsen`, brojeći povijest (Visa 855/855).
**Krivo.** Config već ima `default_map` `Visa → Planiran`, i to je točno: onih 855 je `Izvrsen`
jer su svi došli **s izvoda**, dakle već naplaćeni. `Status` je **trenutno stanje, ne povijest**
— brojanje zatečenih vrijednosti ne govori kakvo stanje redak treba **na početku**. Za
`Tip`/`Podtip` je brojanje pravi alat; za `Status` nije.

### Odluke

- **Preimenovanje aree odgođeno**, okidač je **zadnji pipeline uvoz** (ne „kad bude na PROD-u" —
  batch 2024/2023 idu *nakon* cutovera). Rename tada ide **kroz UI**, jer slug preživi.
- **Prvo sidro na praznoj Arei se ne gradi** (potvrđeno iz S116).

---

# S118 — 2026-08-25 · Koka na PROD-u

Sesija je počela pitanjem „što dalje" i završila tako da **Koka radi na PROD-u s 2.312 eventa
i saldom koji se poklapa s bankom u cent**. Usput su izašla tri kvara koja se **ne vide iz koda**
— sva tri se očituju tako da nešto „uspije" i ne napravi ono što piše.

## 1. Prvo mjerenje: `main` je već bio deployan

Handoff je tvrdio „`main` nije diran od S107". `git log origin/main` kaže drugo: fast-forward na
`71b3418` **24.08. u 16:36**, dakle S108–S117 su na PROD-u od jučer. Sašina slutnja („čini mi se
da smo možda već pushali") bila je točna. Ispravljeno u `NEXT_SESSION_PROMPT.md`.

**PROD baza je pritom bila prazna od svega novog:** ni `balance_anchors`, ni `rpc_area_group_agg`,
ni `rpc_area_balance_anchored`. Deploy je bio **inertan** — Overview tab postoji samo uz
`settings.dashboard`, a nijedna PROD area ga nije imala. Ništa nije puklo jer se ništa nije zvalo.

## 2. Čišćenje prije useljenja

Inventura je našla: tipfeler-račun (`dubravla.…`, prazan — Saša ga obrisao), osirotjeli
`data_shares` prema obrisanoj arei, i tri mrtve `share_invites`. Riješeno kroz **`039`**, pisan
generički (uvjet, ne popis id-eva) pa je idempotentan. Jedina zaštita koju vrijedi zapamtiti:
brisanje pozivnica bez računa gleda **samo `accepted`** — neprihvaćena pozivnica na email bez
računa je normalna i čeka registraciju.

Uz to je maknut share `Financije_old → Koka`: kad dobije `Financije_all`, tri slična imena u
dropdownu su poziv na krivi unos, a krivi unos ne javlja ništa.

## 3. Migracija koja je „uspjela" i izgubila pola posla

`035`/`036`/`038` prošle, Structure import prošao (`Areas 1 / Categories 1 / Attributes 15`).
Mehanička usporedba TEST↔PROD pokazala je da **ništa od toga nije istina do kraja**:

| | TEST | PROD |
| --- | --- | --- |
| slugovi 5 atributa | `izvorplacanja`, `datum_naplate`, `brojrata`, `rata_br`, `izvod_opis` | `izvor`, `datum-naplate`, `broj-rata`, `rata-br`, `izvod-opis` |
| `hidden_in_add` (3×) | ✓ | nema |
| `comment_template` / `add_header` / `list_columns` | ✓ | `null` |
| `automations` | `attribute_rules` + `rata` | samo `attribute_rules` |

⚠ **Najgori dio nije ono čega nema nego ono što je ostalo i pokazuje u prazno:** preživjeli
`attribute_rules` referencira `izvorplacanja`/`datum_naplate`, a `Status.depends_on` isto —
slugove kojih na PROD-u nema. `set_attribute` i Status dropdown bili su **mrtvi, a u bazi
izgledali konfigurirano.**

### Uzrok A: PROD ima trigger koji gazi slug, TEST ga nema

Ni file ni build nisu bili krivi — export je nosio ispravne slugove, a deployani bundle je imao
sve S116/S117 markere (provjereno `curl`-om nad `index-*.js`). Uzrok se našao **pokusom**:
upiši atribut sa slugom → pročitaj → obriši.

```
PROD:  poslano 'zz_test_slug'  ->  spremljeno 'zz-test-slug'    x
TEST:  poslano 'zz_test_slug'  ->  spremljeno 'zz_test_slug'    v
```

Šest pokusa pokazalo je da trigger **ne popunjava nego bezuvjetno prepisuje**; preživi samo slug
koji je slučajno već jednak `slugify(name)`. Dva dodatna pokusa: trigger je **INSERT-only** i
rename **ne** regenerira slug — zato je popravak UPDATE-om trajan.

Funkcija `generate_slug_from_name()` nosila je komentar *„Generate slug ONLY on INSERT or if slug
is empty"* i uvjet `IF TG_OP = 'INSERT' OR NEW.slug IS NULL OR NEW.slug = ''`. **Komentar opisuje
namjeru, uvjet radi drugo** — čitanjem koda se to ne vidi, jer komentar zvuči kao zaštita.

Popravljeno: **`040`** (poravnanje 5 slugova prema TEST-u/Excelu, prije ponovnog uvoza — obrnutim
redoslijedom bi uvoz stvorio pet novih atributa uz pet krivih) i **`042`** (iz uvjeta ispada
`TG_OP = 'INSERT'`). Regex u `042` nije prepisan s odsječenog ekrana nego **izmjeren** trima
pokusima (`'ZZ  Test--Slug!!'` daje `'zz-test-slug'`).

⚠ Funkcija je zajednička za `set_area_slug`, `set_category_slug`, `set_attribute_slug`. Areama se
nikad nije očitovala samo zato što app i trigger slučajno daju isti oblik
(`Financije_all` → `financije-all`).

### Uzrok B: preglednik je vrtio stari bundle

Ostatak (config, `hidden_in_add`, drugo automation pravilo) vratio se **ponovnim uvozom istog
filea nakon hard refresha**: `Attributes updated 3 · Settings updated 1 · Automation rules 2 ·
List columns 7`. Dokaz nije bio zaključivanje nego **sam modal**: prvi uvoz nije imao retke
`Settings updated` i `List columns` — brojače koji u novijoj verziji postoje.

Poslije toga usporedba daje: 15/15 atributa identično, `add_header` ✓ `automations` ✓
`comment_template` ✓ `list_columns` ✓; razlikuju se samo `dashboard` (ide kroz `041`) i
`export_profiles` (zna se da ne putuje).

## 4. Podaci: Sašin prijedlog je pobijedio moj plan

Plan je bio „minimum sad, povijest kasnije" i uvoz kolovoza kroz `fill_from_izvod.py`. Saša je
pitao **zašto ne izvesti Activities s TEST-a i uvesti na PROD**. Provjera je pokazala da app oba
potencijalna blokera već rješava sam:

- TEST `event_id`-evi ne postoje na PROD-u ⇒ `smartReclassify` ih pretvara u CREATE
- kolona G nosi Sašin email ⇒ „Import as mine" forsira INSERT i postavlja nju za vlasnicu

Time je otpao cijeli korak s pipelineom — i to je **bolje**, jer TEST nosi ispravke iz S110–S117
kojih u Review workbooku nema. Uvezeno u tri filea po 1000 redaka, brojano nakon svakog
(1001 → 2001 → 2312).

⚠ **BUG-S118-PREVIEWMODE** otkriven usput: preview je sva tri puta pokazao `0 New / 0 Modify`
jer `ExcelImportModal.tsx:106` zove `parseExcelFile` **bez** `foreignMode`. Apply putanja ga
prosljeđuje i uvoz radi. Gore od krive brojke: preview računa i **provjeru kolizija**, pa za
„Import as mine" otpada zaštita od dvostrukog uvoza istog filea. Zato se brojalo poslije svakog.

## 5. Potvrda koja nešto znači

```
uplata/isplata po računu, @ 13.08.:   TEST == PROD u cent   (478/478, 209/209)
sidra s izvoda:  ZABA 13.815,33 @ 30.07.   ·   RF 799,12 @ 11.08.
pločica:         ZABA 13.239,31            ·   RF 796,43
```

Isti brojevi kao TEST — kroz drugu bazu, drugog vlasnika i „Import as mine". Sidra su upisana
**kroz UI**, putem „izvod" s ručno utipkanim datumom, čime je S116 popravak prvi put izveden
na PROD-u.

## 6. Stara area: prividan manjak koji nije bio manjak

Prije brisanja Kokine stare `Financije` izmjereno je nosi li išta čega u novoj nema.
Od 357 iznosa, **200 nema par po `(datum, smjer, iznos)`** — ali 199 ih ima **isti iznos unutar
±45 dana**, što je D1b: stara area datira kartičnu kupovinu na **dan naplate** (11. u mjesecu),
nova na **dan kupovine**.

Preostao je jedan: `29.06. RF Visa 7,63 „Chromos - Konzum"`. Traženje s tolerancijom našlo je
`29.06. RF Visa 7,83 „Konzum"` — isti dan, račun, kartica i trgovac, razlika **0,20**. Dakle
skoro-duplikat razreda S111, a ne gubitak; točan je `7,83` (autoritet za iznos je izvod).

Obrisano **kroz UI** s „Download Backup & Delete" (file se skine prije brisanja), i prošlo je
čisto — nula ostataka. ⚠ Time je precizirano staro pravilo: UI brisanje ne pada uvijek, nego
**kad postoje retci koje RLS skriva**; ovdje su svi bili njeni.

`Financije_old` (2.774 eventa, 2023–2025) **ostaje** — jedina kopija 2023./2024. na PROD-u.

## 7. Sitno, ali zapisano

- **`et_activity_draft` nije vezan uz korisnika** — „Resume Previous Session?" od prije 3 tjedna
  iskočio je pod njenim računom, s kategorijom iz stare aree. Discard rješava; ključ je po
  pregledniku, ne po korisniku.
- **`Financije_all` vs `financije-all` nisu dvije verzije imena nego dva polja** — ime se tipka,
  slug app izvodi. U repou nema nijednog krivog oblika; zabuna je bila stvarna, greška nije.
- **Filtar s dva uvjeta** — Sašin nalaz iz stvarnog rada: „ZABA **i** samo uplate" se ne da
  složiti. Dosad zapisano kao nedostatak *drilla*; sada je jasno da fali i u običnom filtru.
  Odluka: ne sada.
