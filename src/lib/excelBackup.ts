/**
 * excelBackup.ts
 * ==============
 * Backup export — scoped to a specific area when deleting,
 * or full (all areas) when called without areaId.
 * Used as a safety step before "Delete with Backup" in StructureDeleteModal.
 */

import ExcelJS from 'exceljs';
import { addActivitiesSheetsTo, mergeSessionEvents } from './excelExport';
import { addStructureSheetsTo } from './structureExcel';
import { addFilterSheet, timestampSuffix } from './excelUtils';
import { loadExportData, loadStructureNodes } from './excelDataLoader';
import type { ExportFilters } from './excelTypes';

/**
 * Build a backup workbook scoped to a single area (or full if areaId omitted).
 *
 * @param userId   Authenticated user ID (from supabase.auth.getUser())
 * @param areaId   Optional — scope backup to this area only
 * @param areaName Optional — used in Filter sheet metadata
 * @returns ArrayBuffer ready for file-saver / Blob download
 */
export async function exportFullBackup(
  userId: string,
  areaId?: string | null,
  areaName?: string | null,
): Promise<ArrayBuffer> {
  const filters: ExportFilters = {
    areaId:     areaId ?? null,
    categoryId: null,
    dateFrom:   null,
    dateTo:     null,
    sortOrder:  'desc',
  };

  // ── 1. Fetch data ──────────────────────────────────────────────────────────
  const [bundle, structureNodes] = await Promise.all([
    loadExportData(userId, filters),
    loadStructureNodes(userId),
  ]);

  const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

  const eventDates  = bundle.events.map(e => e.event_date).filter(Boolean).sort();
  const firstRecord = eventDates.length > 0 ? eventDates[0] : undefined;
  const lastRecord  = eventDates.length > 0 ? eventDates[eventDates.length - 1] : undefined;

  // ── 2. Build workbook ──────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const ts = timestampSuffix();

  const label = areaName ? `Backup — ${areaName}` : 'Full Backup';

  await addActivitiesSheetsTo(
    wb,
    merged,
    bundle.attrDefs,
    bundle.categoriesDict,
    'desc',
  );

  await addStructureSheetsTo(
    wb,
    structureNodes,
    areaId ? { filterAreaId: areaId } : {},
    { type: 'backup', description: `${label} — ${ts.replace(/_/, ' ').replace(/(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6')}` },
  );

  addFilterSheet(wb, {
    exportType:  label,
    exportedAt:  ts,
    area:        areaName ?? null,
    category:    null,
    dateFrom:    null,
    dateTo:      null,
    firstRecord,
    lastRecord,
    periodLabel: 'All time at export',
    sortOrder:   'desc',
  });

  // ── 3. Serialise ───────────────────────────────────────────────────────────
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Filename for the backup download */
export function fullBackupFilename(areaName?: string | null): string {
  const prefix = areaName
    ? `backup_${areaName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : 'full_backup';
  return `${prefix}_${timestampSuffix()}.xlsx`;
}
