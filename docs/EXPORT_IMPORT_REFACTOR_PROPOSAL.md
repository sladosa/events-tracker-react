# Export/Import Refactor — Prijedlog arhitekture (S25)

**Datum:** 2026-03-25
**Status:** Draft — za pregled i odluku

---

## Zašto ovo radimo

Cilj je implementirati **Full Backup** (jedan `.xlsx` s Strukturom + Aktivnostima),
koji je preduvjet za **Delete with Backup** (bezbjedno brisanje nodova s eventima).
Usput rješavamo malu duplikaciju stilskog koda između dva export modula.

---

## Trenutno stanje

### Dvije neovisne pipeline

| | Activities | Structure |
|---|---|---|
| Export lib | `src/lib/excelExport.ts` → `createEventsExcel()` | `src/lib/structureExcel.ts` → `exportStructureExcel()` |
| Import lib | `src/lib/excelImport.ts` → `importEventsFromExcel()` | `src/lib/structureImport.ts` → `importStructureExcel()` |
| Import modal | `ExcelImportModal.tsx` (state machine: parse → collisions → apply) | `StructureImportModal.tsx` (run → result) |
| Export trigger | `ExcelExportModal.tsx` (filter + paginacija) | Inline u `AppHome.tsx` |

Svaka export funkcija kreira **vlastiti `ExcelJS.Workbook`** i vraća `Promise<ArrayBuffer>`.
Za Full Backup trebamo obje pipeline spojiti u jedan workbook — to trenutno nije moguće.

### Što je duplikat (može se konsolidirati)

| | Gdje postoji |
|---|---|
| `PINK_FILL`, `BLUE_FILL`, `THIN_BORDER`, `HEADER_FONT` | Odvojeno u oba export fajla |
| Filename timestamp logika | Identična formula, dvaput implementirana |
| `colLetter(n)` (1→A, 27→AA) | Samo u `excelExport.ts`, logički treba i u strukturi |

### Što je svjesno različito — NE dirati

- **Session merging** (`mergeSessionEvents`) — P2 rule, samo Activities
- **Collision detection** — Activities: `session_start + leafCategoryId`; Structure: `slug + categoryPath`
- **P3 rule** — samo Activities import
- **Destructive vs. non-destructive** — Activities može brisati; Structure nikad
- **DependsOn row expansion** — samo Structure
- **Excel format** — Activities: 17+ dinamičnih kolona; Structure: 17 fiksnih (A–Q)

---

## Što treba implementirati

1. `exportFullBackup()` — jedan `.xlsx` s oba dataseta
2. UI gumb za Full Backup
3. Delete with Backup — pozvati `exportFullBackup()` prije cascade delete-a u `StructureDeleteModal`
4. (Opcionalno) Zajednički stilski utilities

---

## Opcije arhitekture

---

### Opcija A — `wb?` opcionalni parametar

Modificirati potpise postojećih funkcija:

```typescript
// structureExcel.ts
export async function exportStructureExcel(
  nodes: StructureNode[],
  options?: ExportStructureOptions,
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
  wb?: ExcelJS.Workbook,      // ← NOVO
): Promise<ArrayBuffer>

// excelExport.ts
export async function createEventsExcel(
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder?: 'asc' | 'desc',
  wb?: ExcelJS.Workbook,      // ← NOVO
): Promise<ArrayBuffer>

// excelBackup.ts (NOVO)
export async function exportFullBackup(userId: string): Promise<ArrayBuffer> {
  const sharedWb = new ExcelJS.Workbook();
  await exportStructureExcel(nodes, {}, { type: 'backup' }, undefined, sharedWb);
  await createEventsExcel(events, attrDefs, cats, 'desc', sharedWb);
  return sharedWb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

**Problem**: Kada se `wb` preda izvana, funkcija **ne smije** zvati `writeBuffer()` interno
(jer caller želi dodati još sheetova). Ali return type je `ArrayBuffer` — kontradikcija.

Moguća rješenja unutar Opcije A:

| Podvarijanta | Opis | Ocjena |
|---|---|---|
| **A1** | Kad je `wb` predan, vrati `new ArrayBuffer(0)` — caller ignorira | Hakovanje, radi ali je zbunjujuće |
| **A2** | `Promise<ArrayBuffer \| ExcelJS.Workbook>` s TypeScript overloadima | Složeniji tipovi |
| **A3** | `wb?` samo dodaje sheetove, ne zove `writeBuffer`; caller je odgovoran za buffer | Razumno, ali drugačija semantika od standalone |

**Pro:**
- Minimalne promjene API-ja — samo jedan parametar više
- Postojeći pozivači rade bez izmjena
- Logika sheetova ostaje u originalnim fajlovima

**Kontra:**
- Return type postaje dvosmislen ili nekonvencionalan (A1, A3)
- Potencijalna zabuna: zašto funkcija ponekad vraća bezvrijedan buffer?

---

### Opcija B — Interni sheet-builderi ✅ PREPORUČENO

Svaki export fajl dobija **dvije razine**: interna `addXxxSheetsTo()` i javna wrapper funkcija.

```typescript
// ── structureExcel.ts ────────────────────────────────────────
// Interni: dodaje sheetove na zadani wb, ne vraća ništa
export async function addStructureSheetsTo(
  wb: ExcelJS.Workbook,
  nodes: StructureNode[],
  options?: ExportStructureOptions,
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): Promise<void>

// Javni: standalone export — API nepromijenjen
export async function exportStructureExcel(
  nodes: StructureNode[],
  options?: ExportStructureOptions,
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await addStructureSheetsTo(wb, nodes, options, infoRow, conflictSlugs);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

// ── excelExport.ts — isti pattern ────────────────────────────
export async function addActivitiesSheetsTo(
  wb: ExcelJS.Workbook,
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder?: 'asc' | 'desc',
): Promise<void>

export async function createEventsExcel(
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder?: 'asc' | 'desc',
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await addActivitiesSheetsTo(wb, events, attrDefs, categoriesDict, sortOrder);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

// ── excelBackup.ts (NOVI FAJL) ────────────────────────────────
export async function exportFullBackup(userId: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  // 1. Structure sheets
  const nodes = await loadStructureNodes(userId);  // nova helper fn ili refetchStructure
  await addStructureSheetsTo(wb, nodes, {}, { type: 'backup' });
  // 2. Activities sheets
  const { events, attrDefs, categoriesDict } = await loadExportData(userId, {});
  await addActivitiesSheetsTo(wb, events, attrDefs, categoriesDict, 'desc');
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function fullBackupFilename(): string {
  return `full_backup_${timestampSuffix()}.xlsx`;
}
```

**Pro:**
- **Čisti return tipovi** — `void` vs `ArrayBuffer`, bez dvosmislenosti
- **Javni API nepromijenjen** — svi postojeći pozivači rade bez ijedne izmjene
- **Separation of concerns** — "dodaj sheetove" jasno razdvojeno od "spremi fajl"
- **Proširivo** — lako dodati `addChangelogSheetTo()`, `addHelpSheetTo()` itd.

**Kontra:**
- Lagano veći refactor: svaki export fajl dobija internu reorganizaciju (1–2h)
- Eksportira se još jedna funkcija po modulu (`addXxxSheetsTo`) — minorno
- `loadStructureNodes` treba biti dostupan iz `excelBackup.ts`
  → Rješenje: eksportirati iz `useStructureData.ts` ili kreirati `src/lib/structureDataLoader.ts`

---

### Opcija C — Backup duplicira logiku

`excelBackup.ts` direktno re-implementira setup sheetova:

**Pro:** Nema promjena u postojećim fajlovima
**Kontra:** ❌ Direktna duplikacija — svaka promjena formata treba biti napravljena dvaput. Odbaciti.

---

## Zajednički utilities (opcijski, preporučeno uz B)

Novi fajl `src/lib/excelUtils.ts`:

```typescript
// Boje — trenutno duplikat u oba export fajla
export const PINK_FILL:   ExcelJS.Fill      // { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }
export const YELLOW_FILL: ExcelJS.Fill      // { ... argb: 'FFFFFF00' }
export const BLUE_FILL:   ExcelJS.Fill      // { ... argb: 'FFDCE6F1' }
export const GREEN_FILL:  ExcelJS.Fill      // { ... argb: 'FFE2EFDA' }
export const THIN_BORDER: ExcelJS.Borders   // all sides thin gray
export const HEADER_FONT: ExcelJS.Font      // { bold: true, name: 'Calibri', size: 11 }

// Utilities
export function colLetter(n: number): string    // 1→A, 27→AA (trenutno samo u excelExport.ts)
export function timestampSuffix(): string        // "20260325_142307"
```

**Scope:** Refactor oba export fajla (zamjena lokalnih konstanti importima) — oko 30 min.
**Vrijednost:** Jedno mjesto za izmjenu stila kad dođe dizajn promjena.

---

## UI — gdje smjestiti "Full Backup" gumb

| | Opis | Footprint |
|---|---|---|
| **UI-1** | Novi gumb `↓ Full Backup` u Structure tab toolbar-u (uz Export/Import) | Vidljiv, odmah dostupan |
| **UI-2** | Dropdown na `Export` gumbu: "Export Structure" / "Full Backup" | Kompaktniji, ali neočit |
| **UI-3** | Posebna Backup stranica ili footer | Preopširno za ovaj projekt |

**Preporuka: UI-1** — novi gumb samo na Structure tabu.
Backup je prirodno vezan uz strukturalne promjene (export-before-delete workflow).

---

## Preporučeni redosljed implementacije (Opcija B)

```
Korak 1  src/lib/excelUtils.ts         — zajedničke konstante + colLetter + timestampSuffix
Korak 2  src/lib/structureExcel.ts     — refactor: addStructureSheetsTo() interno
Korak 3  src/lib/excelExport.ts        — refactor: addActivitiesSheetsTo() interno
         (koraci 2 i 3 su neovisni — mogu se raditi paralelno)
Korak 4  src/lib/excelBackup.ts        — novi: exportFullBackup(), fullBackupFilename()
Korak 5  src/pages/AppHome.tsx         — "Full Backup" gumb u Structure toolbar-u
Korak 6  StructureDeleteModal          — unlock delete s eventima + backup poziv prije brisanja
```

Ukupan scope: **~3 fajla refactor + 2 nova fajla + 1 UI promjena**.

---

## Verifikacija (end-to-end)

- `npm run typecheck && npm run build` — bez grešaka
- Export Structure (solo) → isti format kao prije (regresija)
- Export Activities (solo) → isti format kao prije (regresija)
- Full Backup → jedan fajl, oba dataseta u zasebnim sheetovima, čitljivo
- Import Structure s backup fajlom → non-destructive, radi normalno
- Delete s eventima → backup se kreira, zatim cascade delete

---

## Zaključak

**Opcija B + excelUtils.ts** daje čiste tipove, nepromijenjen javni API i solidnu osnovu za Delete with Backup.
Opcija A je prihvatljiva ako želimo manji scope, ali A3 podvarijanta je jedina čista verzija unutar A.
