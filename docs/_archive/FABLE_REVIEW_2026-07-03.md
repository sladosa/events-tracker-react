# Fable 5 Code Review — Events Tracker React
**Datum:** 2026-07-03  
**Model:** claude-fable-5 (pristup do 2026-07-07)  
**Scope:** Cijeli codebase, pročitao sve src/ + sql/ + docs/

Ovaj dokument bilježi Fableov uvid uz praktične primjere koji pokazuju zašto svaki nalaz stvarno
boli u praksi. Prioriteti za implementaciju su odvojeni od samog opisa.

---

## 1. Arhitekturalni problemi

### 1.1 ⚠️ VISOKI PRIORITET: Delete Activity tiho briše krive podatke

**Problem:** `handleDeleteActivity` u `AppHome.tsx` briše **sve** evente s istim `session_start +
user_id`, bez filtera po kategoriji. `ActivitiesTable.tsx` već proslijedi `(sessionStart,
categoryId)` pozivajući handler, ali handler `categoryId` ignorira.

**Praktični primjer:**  
U petak ujutro unosiš dvije aktivnosti u 09:00:
- Trčanje 5km (leaf: "Z2 Run")
- Snaga — bench press + pull (leaf: "Snaga")

Obje imaju `session_start = '2026-07-04 09:00:00'`. Sutradan vidiš da si krivo upisao tempo
trčanja, klikneš ⋮ → Delete na Trčanje. App briše **oboje** bez upozorenja — Snaga session
nestaje zajedno s trčanjem.

Ista klasa buga je već nađena i fiksana u `excelImport.ts:819` (T-BUGG-5). Ovdje nije.

**Fix (3 linije u `AppHome.tsx`):**
```typescript
// Trenutno:
const handleDeleteActivity = async (sessionStart: string) => {
  await supabase.from('events')
    .delete()
    .eq('user_id', userId)
    .eq('session_start', sessionStart)  // briše SVE sesije u tom trenutku!
}

// Fix — dodati filter po chain_key (= leafCategoryId):
const handleDeleteActivity = async (sessionStart: string, leafCategoryId: string) => {
  await supabase.from('events')
    .delete()
    .eq('user_id', userId)
    .eq('session_start', sessionStart)
    .eq('chain_key', leafCategoryId)   // samo ovaj lanac
}
// + handler za parent evente koji nemaju chain_key = leafCategoryId od DRUGOG lanca
```

---

### 1.2 Parent-event write logika na 4 mjesta

**Problem:** `parentEventLoader.ts` je shared samo za **čitanje**. Logika za pisanje (INSERT/UPSERT
parent eventa s `chain_key`) copy-paste-ana je u:
1. `AddActivityPage.tsx:954–1027`
2. `EditActivityPage.tsx:1002–1145`
3. `excelImport.ts:643–703` (`upsertParentEventForUpdate`)
4. `excelImport.ts:836–899` (drugi blok u CREATE toku — duplikat unutar istog fajla!)

**Praktični primjer:**  
Sutra odlučiš dodati "sub-session" koncept gdje jedan parent može imati više chain_key-eva
(npr. fitness blok koji pokriva i Z2 i Snaga u istom treningu). Moraš ažurirati 4 odvojena mjesta,
svako malo drugačije napisana. Vrlo vjerojatno propustiš jedno.

**Ispravak:**  
Ekstrahirati `upsertParentEvent(leafCategoryId, sessionISO, attrs, userId)` u `parentEventLoader.ts`
uz `buildParentChainIds` koji već tamo postoji. Sva 4 mjesta postaju 1-linijski poziv.

---

### 1.3 `persistPendingOptions` dupliciran + concurrency rizik

**Problem:** Identična ~50-linijska funkcija u `AddActivityPage.tsx:172` i
`EditActivityPage.tsx:86`. Obje rade read-modify-write na `validation_rules` JSONB bez locka.

**Praktični primjer:**  
Koka (write grantee na Financije arei) i ti istovremeno dodajete "Other" opciju u suggest
dropdown za "Tip" atribut:

```
Koka čita:  options: ["Hrana", "Prijevoz", "Stan"]
Ti čitaš:   options: ["Hrana", "Prijevoz", "Stan"]
Koka piše:  options: ["Hrana", "Prijevoz", "Stan", "Kino"]
Ti pišeš:   options: ["Hrana", "Prijevoz", "Stan", "Teretana"]  ← pregazi Kokinu izmjenu!
```

Kratkoročni fix: premjestiti u `src/lib/pendingOptions.ts`.  
Dugoročni fix: Supabase RPC koji atomarno appenda opciju
(`UPDATE ... SET validation_rules = jsonb_set(..., array_append(...))`).

---

### 1.4 FilterContext: 3 konteksta u jednom, bez `useMemo`, untipizirani eventi

**Problem:** `FilterContext.tsx` (791 linija) drži tri logički odvojena konteksta:
- **Filter state** (dateRange, categoryId, attrFilter, commentSearch...)
- **Category dropdown cache** (selectionChain, dropdownOptions, s vlastitim DB loaderima)
- **Sharing context** (sharedContext, areaHasActiveShares, selectedArea, orphanFilter)

Context `value` objekt se kreira **iznova na svakom renderu** providera (bez `useMemo`).

Uz to, cross-component komunikacija ide kroz 5 window CustomEventa (`areas-changed`,
`structure-deleted`, `shares-changed`, `open-share-modal`, `activities:open-*`) — 30+
dispatch/listen mjesta bez TypeScript tipova.

**Praktični primjer:**  
Upisuješ tekst u Comment search field. Svaki pritisak tipke:
1. `setCommentSearch('t')` → FilterContext state se mijenja
2. Novi `value` objekt kreiran (bez useMemo = uvijek novi referenčni identitet)
3. **Svi** consumeri FilterContexta re-renderaju: ActivitiesTable, StructureTableView,
   ProgressiveCategorySelector, SharedAreaBanner, ExcelExportModal...
4. Većina re-renderira bez razloga jer ne koristi `commentSearch`

Na slabom mobitelu = vidljivi lag pri tipkanju.

**Fix u 3 koraka (nezavisni, mogu se raditi odvojeno):**
```typescript
// Korak 1 (5 min): useMemo na value u FilterContext.tsx ~linija 715
const value = useMemo(() => ({
  filter, setFilter, reset, ...sharing
}), [filter, sharing, reset]) // dep array spriječava nepotrebne re-rendere

// Korak 2 (2h): src/lib/appEvents.ts — tipizirani event bus
type AppEvent =
  | { type: 'areas-changed' }
  | { type: 'structure-deleted'; deletedIds: string[] }
  | { type: 'shares-changed'; areaId: string }
export const dispatch = (e: AppEvent) => window.dispatchEvent(new CustomEvent(e.type, { detail: e }))
export const subscribe = <T extends AppEvent['type']>(type: T, handler: ...) => { ... }

// Korak 3 (4h): Split na FilterProvider + SharingProvider (veći refaktor)
```

---

### 1.5 Paginacija cijepa sesiju na granici stranice

**Problem:** Paginacija ide po raw eventima (`range(offset, offset+pageSize-1)`), a prikazujemo
grupirane sesije. Sesija čiji eventi padaju na granicu stranice pojavljuje se kao **dvije nepotpune
grupe**.

**Praktični primjer:**  
`pageSize = 20`. Sesija 10 (Trening blok: Trčanje + Snaga + Yoga, 3 leaf eventa + 6 parent) ima
event redove 18, 19, 20, 21... Load More učitava redove 21-40. Rezultat u UI:

```
Sesija 10 — Trčanje [prikazuje 2 od 9 atributa] ← prva stranica
──── Load More ────
Sesija 10 — Trčanje [prikazuje preostalih 7 atributa] ← druga stranica (DUPLIKAT GRUPE!)
Sesija 10 — Snaga
Sesija 10 — Yoga
```

**Fix:** Pri appendu novih eventa mergeati zadnju grupu prethodne stranice s prvom grupom nove
stranice ako imaju isti `sessionKey` (`session_start + user_id`).

---

### 1.6 N+1 queriji pri loadu Activities

**Problem:** `getDescendantCategoryIds` u `eventQueryBuilder.ts:122` radi **rekurzivni query po
čvoru** kada nema filtera po kategoriji — area s 50 kategorija = 50+ DB round tripova prije nego
se učita ijedan event.

**Praktični primjer:**  
Otvoriš app na mobitelu s sporim 4G, odabereš Area "Fitness" bez specifične kategorije. App radi:
1. Query: "daj mi child nodes od Fitness" → [Cardio, Snaga, Mobilnost]
2. Query: "daj mi child nodes od Cardio" → [Z2, Threshold, VO2]
3. Query: "daj mi child nodes od Snaga" → [Push, Pull, Legs]
4. Query: "daj mi child nodes od Mobilnost" → [Yoga, Istezanje]
5. Query: "daj mi child nodes od Z2" → [] (leaf)
6. ... itd za svaki node
7. Tek onda: "daj mi evente gdje category_id IN [id1, id2, ..., id50]"

Na 50ms po query-ju = 2.5 sekunde samo za discovery kategorija, bez eventa.

**Fix:** View `category_full_paths` (sql/016) već postoji i dohvaća cijelo stablo jednim
CTE queryjem. Ili: fetchati sve kategorije aree jednim `.eq('area_id', areaId)` i hodati
in-memory (pattern već postoji u `filterToLeafCategories` u FilterContextu).

---

### 1.7 Excel Import: ~15.000 sekvencijalnih DB poziva za 3000 redaka

**Problem:** `applyImportChanges` u `excelImport.ts` radi per-row leaf INSERT pa per-atribut INSERT
u petlji, plus SELECT+UPDATE za parent upsert po atributu. Nema rollbacka na parcijalni fail.

**Praktični primjer:**
```
3000 redaka × 5 atributa = 15.000 INSERT poziva
+ 3000 × parent SELECT + parent UPDATE = 6.000 extra poziva
= ~21.000 round tripova @ 30ms = ~630 sekundi = 10+ minuta
```

Za usporedbu, `EditActivityPage.tsx:928` već radi batch insert atributa (jedan `.insert(array)`
za sve atribute jednog eventa). Import to ne radi.

**Fix u 2 koraka:**
1. **Batch atribute** — skupiti sve atribute jedne sesije u array, jedan INSERT (smanjuje 15k → 3k poziva)
2. **Progress callback** — `onProgress?(done: number, total: number)` parametar u `applyImportChanges`,
   progress bar u `ExcelImportModal` (direktno rješava UX-Import-1)

---

## 2. Quick Wins (< 2h svaki)

| # | Što | Gdje | Složenost |
|---|-----|------|-----------|
| Q1 | Fix 1.1 (Delete bug) | `AppHome.tsx` handler | **S** — 3 linije |
| Q2 | `useMemo` na FilterContext value | `FilterContext.tsx:715` | **S** — 5 min |
| Q3 | Batch `event_attributes` INSERT u importu | `excelImport.ts` | **S** — 30 min |
| Q4 | Import progress bar | `excelImport.ts` + `ExcelImportModal.tsx` | **S** — 1h |
| Q5 | Escape ILIKE wildcard znakova | `eventQueryBuilder.ts:88,99` | **S** — 5 min |
| Q6 | Dead code brisanje | `useLookupValues` hook, DEBUG_ENABLED blokovi | **S** — 30 min |

**Q5 detalj:** Korisnik koji upiše `100%` u comment search ili `_test_` u attr search — `%` i `_`
su SQL wildcard znakovi, ILIKE ih interpretira kao "bilo koji niz znakova" / "bilo koji znak".
Fix: `value.replace(/[%_\\]/g, '\\$&')` prije slanja u query.

---

## 3. Feature Ideje

### F1. "Repeat last session" (S veličina)
Jedan tap na leaf kategoriji kopira zadnju sesiju s novim `session_start = now()`. Prirodna
ekstenzija Shortcut+prefill patterna (sql/022 `preset_default_attributes` već postoji). Gym i
habit unosi su 90% identični prethodnima — ovo eliminira 80% klikova.

### F2. Trend mini-chart po number atributu (M veličina)
Za svaku leaf kategoriju s bar chart-om: `value_number` kroz `event_date`. Primjeri:
- Trčanje → pace trend kroz posljednjih 90 dana
- Lab Results → Kolesterol trend kroz 3 godine s referentnom linijom
- Financije → Iznos po Tipu kroz godine

Plotly je **već u bundleu** (vendor-plotly 4.9MB) — koristi se samo za Sunburst u Structure tabu.
Dodavanje line/bar chartovaima malo utječe na bundle.

### F3. Generalizirani "aggregate attribute" (L veličina)
Backlog "Stanje post-processing" (SUMIFS po Računu) generalizirati u config na
`attribute_definitions`:

```json
{
  "aggregate": {
    "op": "cumsum",
    "group_by_slug": "racun",
    "sign_by": { "Uplata": 1, "Isplata": -1 },
    "trigger": "post_finish"
  }
}
```

Ovo pokriva Financije bez hardkodiranja i otvara isti mehanizam za npr. kumulativni km u
godini, streak brojanje, tekuće prosjeke.

### F4. "Changes-only" export (S veličina)
Export samo sesija s `created_at > X` ili `updated_at > X`. Pohranjuje zadnji export timestamp
u `area.settings.last_export_at`. Tip/Podtip reklasifikacijski workflow (S104 prioritet 3-4)
je točno ovakav roundtrip — ne treba slati 3000 redaka kada ih je samo 50 promijenjeno.

### F5. Grantee change feed (S veličina)
U `SharedAreaBanner` za ownera: "3 nova zapisa od Koke od utorka". Query:
`events WHERE user_id != me AND area_id = X AND created_at > last_seen`.
`last_seen` per-area u localStorage. Bez schema promjena.

### F6. Cascading dropdowni u Excelu
**Already done in S97** via `addDependentDropdowns()` u `excelExport.ts` — INDIRECT +
DropdownData sheet. Fable to nije znao, potvrđuje da je pristupr bio ispravan.

---

## Što nije u ovom dokumentu

Fable je planirao napisati i 3 spec dokumenta (Analytics tab, Help improvement, Data collection)
ali agent je pao nakon 4.4h rada (stream timeout — output prevelik za jedan agent run).

Ti planovi se mogu rekuperirati u odvojenim, fokusiranim sesijama:
- **Analytics tab + Period koncept** → najveći dizajn izazov, vrijedi Fable interakciju
- **Help "What can I do here?" chip** → content task, može Sonnet uz CLAUDE.md
- **Data collection adapteri** → tehnički spec, može Sonnet uz `data-prep_tools/` kontekst
