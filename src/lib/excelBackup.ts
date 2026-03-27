/**
 * excelBackup.ts
 * ==============
 * Full backup export — unfiltered, all events + full structure.
 * Used as a safety step before "Delete with Backup" in StructureDeleteModal.
 */

import ExcelJS from 'exceljs';
import { addActivitiesSheetsTo, mergeSessionEvents } from './excelExport';
import { addStructureSheetsTo } from './structureExcel';
import { addFilterSheet, timestampSuffix } from './excelUtils';
import { loadExportData, loadStructureNodes } from './excelDataLoader';
import type { ExportFilters } from './excelTypes';

/** Empty filter = fetch everything, no date/area/category restriction. */
const FULL_FILTERS: ExportFilters = {
  areaId:    null,
  categoryId: null,
  dateFrom:  null,
  dateTo:    null,
  sortOrder: 'desc',
};

/**
 * Build a full backup workbook (5 sheets: Events, HelpEvents, Structure,
 * HelpStructure, Filter) containing all events and all structure nodes.
 *
 * @param userId  Authenticated user ID (from supabase.auth.getUser())
 * @returns ArrayBuffer ready for file-saver / Blob download
 */
export async function exportFullBackup(userId: string): Promise<ArrayBuffer> {
  // ── 1. Fetch data ──────────────────────────────────────────────────────────
  const [bundle, structureNodes] = await Promise.all([
    loadExportData(userId, FULL_FILTERS),
    loadStructureNodes(userId),
  ]);

  const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

  // Derive first / last event date for Filter sheet
  const eventDates  = bundle.events.map(e => e.event_date).filter(Boolean).sort();
  const firstRecord = eventDates.length > 0 ? eventDates[0] : undefined;
  const lastRecord  = eventDates.length > 0 ? eventDates[eventDates.length - 1] : undefined;

  // ── 2. Build workbook ──────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const ts = timestampSuffix();

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
    {},                          // no filter — full structure
    { type: 'backup', description: `Full backup — ${ts.replace(/_/, ' ').replace(/(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6')}` },
  );

  addFilterSheet(wb, {
    exportType:  'Full Backup',
    exportedAt:  ts,
    area:        null,
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

/** Filename for the backup download, e.g. "full_backup_20260327_142307.xlsx" */
export function fullBackupFilename(): string {
  return `full_backup_${timestampSuffix()}.xlsx`;
}
