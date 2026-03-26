# Export/Import Refactor — Unified Workbook Format (v2)

**Datum:** 2026-03-26
**Status:** Dogovoreno — spremo za implementaciju (višesesijna)
**Zamjenjuje:** v1 (S25) koji je opisivao samo Full Backup + Opcije A/B/C

---

## Zašto ovo radimo

Originalni cilj (v1): spojiti Structure + Activities u jedan `.xlsx` za Full Backup i Delete with Backup.

Prošireni cilj (v2, dogovoreno S26): **jedinstven format workbooka** za sve export scenarije.
Svaki export (Activities, Structure, Backup) daje isti set sheetova — razlika je samo što je
uključeno. Ovo omogućuje:
- Full Backup kao preduvjet za Delete with Backup
- "Pošalji prijatelju" scenario: Activities export sadrži kompletnu Strukturu,
  import na drugoj strani može rekreirati istu organizaciju kategorija
- Čišći kod: jedna definicija formata, a ne dvije neovisne

---

## Novi unified workbook format

### Sheetovi (uvijek prisutni, redosljed fiksiran)

| # | Sheet | Activities Export | Structure Export | Backup (Delete) |
|---|-------|-----------------|-----------------|-----------------|
| 1 | **Events** | puni podaci (filtrirani) | stub + napomena | puni podaci (nefiltr.) |
| 2 | **HelpEvents** | ✓ | ✓ | ✓ |
| 3 | **Structure** | filtrirano kao Events | puno (kao dosad) | puno (nefiltr.) |
| 4 | **HelpStructure** | ✓ | ✓ | ✓ |
| 5 | **Filter** | aktivni filter | aktivni filter | All time (prvi–zadnji zapis) |

**Events stub poruka** (Structure Export):
> *"Export initiated from Structure tab — no events included. To export events, use Activities tab."*

---

## Izmjene Events sheeta

### ATTRIBUTE LEGEND

| | Staro | Novo |
|---|---|---|
| Kolone | Col, Area, Category_Path, Attribute, Type, **Default, Min, Max**, Unit | Col, Area, Category_Path, Attribute, Type, Unit |
| Column grouping | F–I grupirano i collapsano | uklonjeno (nema svrhe s 6 kolona) |
| Row grouping | ❌ | ✓ svi LEGEND redovi su collapsable blok (default collapsed) |
| Napomena | ❌ | C1: *"see Structure sheet for more details"* |

Obrazloženje: Default/Min/Max su redundantni — korisnik sve detalje ima u Structure sheetu.

### EVENT DATA

| | Staro | Novo |
|---|---|---|
| Comment kolona | G:J merged (4 col) | samo G, header: **'leaf comment'**, width = 30 |
| Attribute kolone | počinju od K | počinju od **H** (H, I, J oslobođene) |
| Freeze panes | na koloni K | na koloni **H** |

---

## Filter sheet

Sadržaj (svaki export):

| Polje | Primjer (Activities) | Primjer (Backup) |
|-------|---------------------|-----------------|
| Export type | Activities | Full Backup |
| Exported at | 2026-03-26 14:23:07 | 2026-03-26 14:23:07 |
| Area | Running | All |
| Category | Running > Road | All |
| Date From | 2026-01-01 | All time (first: 2024-11-03) |
| Date To | 2026-03-26 | All time (last: 2026-03-25) |
| Period label | Last 3 months *(can be outdated)* | — |
| Sort order | Newest first | Newest first |

Backup: Area i Category = "All", datumi = datum prvog i zadnjeg zapisa u bazi.

---

## HelpEvents sheet

- Preimenovati (dosad drugačije ime)
- Primijeniti stvarne obojene ćelije za color swatches — kao što HelpStructure već radi (A11–A14)

---

## Nova arhitektura fajlova

### Korak 1 — `src/lib/excelUtils.ts` (NOVI)

Zajednički utilities izvučeni iz oba export fajla:

```typescript
// Konstante boja (dosad duplikat)
export const PINK_FILL, YELLOW_FILL, BLUE_FILL, GREEN_FILL, ORANGE_FILL, BACKUP_FILL

// Tipografija i border
export const THIN_BORDER, HEADER_FONT

// Helpers
export function colLetter(n: number): string    // 1→A, 27→AA
export function timestampSuffix(): string        // "20260326_142307"

// Filter sheet builder
export function addFilterSheet(wb: ExcelJS.Workbook, filterInfo: FilterSheetInfo): void
```

---

### Korak 2 — `src/lib/structureExcel.ts` (IZMJENA)

Izvući interni builder, javni API ostaje nepromijenjen:

```typescript
// INTERNO — dodaje Structure + HelpStructure sheetove na zadani wb
export async function addStructureSheetsTo(
  wb: ExcelJS.Workbook,
  nodes: StructureNode[],
  options?: ExportStructureOptions,
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): Promise<void>

// JAVNO — thin wrapper, API nepromijenjen
export async function exportStructureExcel(...): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await addStructureSheetsTo(wb, nodes, options, infoRow, conflictSlugs);
  addEventsStubSheet(wb);       // ← NOVO: stub Events sheet
  addFilterSheet(wb, filterInfo); // ← NOVO: Filter sheet
  return wb.xlsx.writeBuffer();
}
```

---

### Korak 3 — `src/lib/excelExport.ts` (VELIKA IZMJENA)

Primjeniti sve promjene Events sheeta + izvući builder:

```typescript
// INTERNO — dodaje Events + HelpEvents sheetove
export async function addActivitiesSheetsTo(
  wb: ExcelJS.Workbook,
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder?: 'asc' | 'desc',
): Promise<void>

// JAVNO — thin wrapper, kreira puni unified workbook
export async function createEventsExcel(
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder?: 'asc' | 'desc',
  structureNodes?: StructureNode[],  // ← NOVO (za Structure + HelpStructure sheets)
  filterInfo?: FilterSheetInfo,       // ← NOVO (za Filter sheet)
): Promise<ArrayBuffer>
```

---

### Korak 4 — `src/lib/excelBackup.ts` (NOVI)

```typescript
// Nefiltriran full backup — koristi se za Delete with Backup
export async function exportFullBackup(userId: string): Promise<ArrayBuffer>
  // 1. Fetch svi structure nodes (bez filtera)
  // 2. Fetch svi eventi (bez filtera, bez date range)
  // 3. Kreiraj wb
  // 4. addActivitiesSheetsTo(wb, ...)
  // 5. addStructureSheetsTo(wb, ..., infoRow = { type: 'backup', timestamp })
  //    → Row 6 u Structure sheetu dobiva žutu backup oznaku (kao dosad za backup)
  // 6. addFilterSheet(wb, { mode: 'backup', firstRecord, lastRecord })
  // 7. return wb.xlsx.writeBuffer()

export function fullBackupFilename(): string   // "full_backup_20260326_142307.xlsx"
```

---

### Korak 5 — `src/components/activity/ExcelExportModal.tsx` (IZMJENA)

- Uz fetchanje evenata, dohvatiti i structure nodes za isti filter
- Proslijediti structure data + filterInfo u `createEventsExcel()`

---

### Korak 6 — `src/components/structure/StructureDeleteModal.tsx` (IZMJENA)

- Otključati BLOCKED stanje (dosad: "coming in next version")
- Novi flow: *"N events exist. A full backup will be downloaded before deletion."*
- Na confirm: `exportFullBackup(userId)` → auto-download → cascade delete
- Koristiti postojeću `handleDelete()` logiku nakon downloadanog backupa

---

### Korak 7 — `src/lib/excelImport.ts` (IZMJENA) — može biti odgođeno

Import u Activities modu čita Structure sheet iz xlsx:
- Usporediti s DB
- Ako nešto nedostaje: prikazati confirm *"These categories will be created: [list]"*
- Kreirati strukturu (reuse structureImport logike) → zatim importati evente
- Structure-only import: ako Events sheet ima podatke → obavijestiti *"to import events, use Activities tab"*

---

## Testni scenariji (pripremiti za prvu sesiju kodiranja)

| ID | Scenarij | Što provjeriti |
|----|---------|----------------|
| T-EXP-1 | Activities Export s aktivnim filterom | Svih 5 sheetova, Filter sheet prikazuje filter, Legend ima 6 kol, comment = G samo |
| T-EXP-2 | Activities Export bez filtera | Filter sheet: "All", Events sheet ima sve zapise |
| T-EXP-3 | Structure Export | Events sheet prikazuje stub poruku, Structure pun, Filter sheet prisutan |
| T-EXP-4 | LEGEND row grouping | Rows su collapsable, default collapsed, C1 napomena vidljiva |
| T-EXP-5 | Attribute kolone | Počinju od H (ne K), freeze panes na H |
| T-EXP-6 | HelpEvents boje | Color swatches su stvarno obojene ćelije (nije samo tekst) |
| T-DEL-1 | Delete node s eventima | Backup se download-a automatski, zatim node nestaje |
| T-DEL-2 | Backup workbook | Filter sheet: "All time", žuta oznaka u Structure Row 6 |
| T-DEL-3 | Import backup fajla | Activities import normalno radi, Structure sheet ignoriran (Korak 7) |
| T-REG-1 | Regression: Activities Import | Stari xlsx fajl (bez Structure/Filter sheeta) radi i dalje |
| T-REG-2 | Regression: Structure Import | Stari xlsx fajl radi i dalje |

**Napomena za testiranje:** Očekujemo podešavanja širina kolona i boja — plan je iterirati vizualno
nakon prve working verzije.

---

## Redosljed implementacije

```
Korak 1  excelUtils.ts          — foundation, nema riska
Korak 2  excelExport.ts         — LEGEND + comment promjene + extract builder
Korak 3  structureExcel.ts      — extract addStructureSheetsTo()
         (koraci 2 i 3 neovisni — mogu paralelno)
Korak 4  excelBackup.ts         — kompozitor
Korak 5  ExcelExportModal.tsx   — add structure fetch, unified workbook
Korak 6  StructureDeleteModal   — unlock delete + backup
Korak 7  excelImport.ts         — structure validation (može biti odgođeno)
```

---

## Što svjesno ostaje različito — NE dirati

- **Session merging** (`mergeSessionEvents`) — P2 rule, samo Activities
- **Collision detection** — Activities: `session_start + leafCategoryId`; Structure: `slug + categoryPath`
- **P3 rule** — samo Activities import
- **Destructive vs. non-destructive** — Activities može upisivati; Structure nikad briše
- **DependsOn row expansion** — samo Structure
- **Fiksnih 17 kolona (A–Q)** — samo Structure; Activities ima dinamičan broj kolona

---

## Verifikacija

- `npm run typecheck && npm run build` nakon svakog koraka
- Svi testni scenariji iz tablice iznad
- Posebna pažnja: T-REG-1 i T-REG-2 (stari fajlovi ne smiju se slomiti)
