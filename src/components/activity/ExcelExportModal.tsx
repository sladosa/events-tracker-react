/**
 * Events Tracker – Excel Export Modal
 * =====================================
 * Export Activities to Excel with:
 * - Filter-aware (uses FilterContext)
 * - Pagination for large exports (configurable batch size)
 * - Progress feedback
 */

import { useState, useEffect, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { loadExportData, loadStructureNodes } from '@/lib/excelDataLoader';
import { createEventsExcel, mergeSessionEvents } from '@/lib/excelExport';
import { timestampSuffix, type FilterSheetInfo } from '@/lib/excelUtils';
import type { ExportFilters } from '@/lib/excelTypes';

interface ExcelExportModalProps {
  onClose: () => void;
}

const DEFAULT_BATCH_SIZE = 10000;
const MIN_BATCH = 2;
const MAX_BATCH = 50000;

export function ExcelExportModal({ onClose }: ExcelExportModalProps) {
  const { filter } = useFilter();

  const [totalCount,  setTotalCount]  = useState<number | null>(null);
  const [batchSize,   setBatchSize]   = useState(DEFAULT_BATCH_SIZE);
  const [fileCount,   setFileCount]   = useState(1);
  const [currentFile, setCurrentFile] = useState(0);   // 0 = idle, >0 = generating file N
  const [loadingCount, setLoadingCount] = useState(true);
  const [error,       setError]       = useState('');

  // Build ExportFilters from FilterContext
  const filters: ExportFilters = {
    areaId:     filter.areaId,
    categoryId: filter.categoryId,
    dateFrom:   filter.dateFrom,
    dateTo:     filter.dateTo,
    sortOrder:  filter.sortOrder,
  };

  // Load total count on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    setError('');

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const bundle = await loadExportData(user.id, filters, 0, 1);
        if (!cancelled) {
          setTotalCount(bundle.totalCount);
          setFileCount(Math.max(1, Math.ceil(bundle.totalCount / batchSize)));
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.areaId, filter.categoryId, filter.dateFrom, filter.dateTo, filter.sortOrder]);

  // Recompute file count when batch size changes
  useEffect(() => {
    if (totalCount !== null) {
      setFileCount(Math.max(1, Math.ceil(totalCount / batchSize)));
    }
  }, [batchSize, totalCount]);

  const downloadFile = useCallback(async (fileIndex: number) => {
    try {
      setError('');
      setCurrentFile(fileIndex);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const offset = (fileIndex - 1) * batchSize;

      const bundle = await loadExportData(user.id, filters, offset, batchSize);
      const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

      // Fetch structure nodes for unified workbook (Structure + HelpStructure sheets)
      const structureNodes = await loadStructureNodes(user.id);

      // Derive actual date range from exported events (for Filter sheet)
      const eventDates = bundle.events.map(e => e.event_date).filter(Boolean).sort();
      const firstRecord = eventDates.length > 0 ? eventDates[0] : undefined;
      const lastRecord  = eventDates.length > 0 ? eventDates[eventDates.length - 1] : undefined;

      // Area/category display names from categoriesDict
      const catValues = Object.values(bundle.categoriesDict);
      const areaName     = filters.areaId
        ? catValues.find(c => c.area_id === filters.areaId)?.area_name ?? null
        : null;
      const categoryPath = filters.categoryId
        ? bundle.categoriesDict[filters.categoryId]?.full_path ?? null
        : null;

      const ts = timestampSuffix();
      const filterInfo: FilterSheetInfo = {
        exportType:  'Activities',
        exportedAt:  ts,
        area:        areaName,
        category:    categoryPath,
        dateFrom:    filters.dateFrom,
        dateTo:      filters.dateTo,
        sortOrder:   filters.sortOrder ?? 'desc',
        firstRecord: filters.dateFrom ? undefined : firstRecord,
        lastRecord:  filters.dateTo   ? undefined : lastRecord,
        // Period label: 'All time' when no explicit dates; empty when dates are set
        periodLabel: (!filters.dateFrom && !filters.dateTo) ? 'All time' : undefined,
      };

      const buffer = await createEventsExcel(
        merged, bundle.attrDefs, bundle.categoriesDict,
        filters.sortOrder ?? 'desc',
        structureNodes,
        filterInfo,
        // Structure sheet shows only the area/category matching the event filter
        { filterAreaId: filters.areaId, filterCategoryId: filters.categoryId },
      );

      const suffix   = fileCount > 1 ? `_part${fileIndex}of${fileCount}` : '';
      const filename = `events_export_${ts}${suffix}.xlsx`;

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, filename);
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally {
      setCurrentFile(0);
    }
  }, [batchSize, fileCount, filters]);

  const downloadAll = useCallback(async () => {
    for (let i = 1; i <= fileCount; i++) {
      await downloadFile(i);
      if (i < fileCount) await new Promise(r => setTimeout(r, 500)); // small delay between files
    }
  }, [fileCount, downloadFile]);

  const isGenerating = currentFile > 0;
  const noData       = totalCount !== null && totalCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">📥</span>
            <h2 className="text-lg font-semibold">Export to Excel</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-emerald-100 hover:text-white text-2xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Filters summary */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-800 mb-1">Active filters:</p>
            <p>📅 Date: {filter.dateFrom ?? '(all)'} → {filter.dateTo ?? '(all)'}</p>
            {filter.areaId && <p>📁 Area filter active</p>}
            {filter.categoryId && <p>🏷️ Category filter active</p>}
            <p>🔃 Sort: {filter.sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}</p>
          </div>

          {/* Count info */}
          {loadingCount ? (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="animate-spin">⏳</span>
              <span>Counting records...</span>
            </div>
          ) : noData ? (
            <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              ⚠️ No events found matching current filters.
            </div>
          ) : totalCount !== null && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              <span className="font-semibold">{totalCount.toLocaleString()} event{totalCount !== 1 ? 's' : ''}</span>
              {' '}will be exported
              {fileCount > 1 && <span className="font-semibold"> → {fileCount} files</span>}
            </div>
          )}

          {/* Batch size control (only if > default threshold) */}
          {!loadingCount && !noData && totalCount !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Records per file
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={MIN_BATCH}
                  max={MAX_BATCH}
                  step={batchSize < 1000 ? 1 : 1000}
                  value={batchSize}
                  onChange={e => setBatchSize(Math.max(MIN_BATCH, Math.min(MAX_BATCH, Number(e.target.value))))}
                  disabled={isGenerating}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">
                  → {fileCount} file{fileCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-400">Range: {MIN_BATCH.toLocaleString()} – {MAX_BATCH.toLocaleString()}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Download buttons */}
          {!loadingCount && !noData && totalCount !== null && (
            <div className="space-y-2">
              {fileCount === 1 ? (
                <button
                  onClick={() => downloadFile(1)}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <><span className="animate-spin">⏳</span> Generating…</>
                  ) : (
                    <><span>📥</span> Download Excel</>
                  )}
                </button>
              ) : (
                <>
                  {/* Individual file buttons */}
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: fileCount }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => downloadFile(n)}
                        disabled={isGenerating}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentFile === n
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                            : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-gray-700'
                        }`}
                      >
                        {currentFile === n ? <span className="animate-spin">⏳</span> : <span>📥</span>}
                        File {n}/{fileCount}
                      </button>
                    ))}
                  </div>

                  {/* Download All */}
                  <button
                    onClick={downloadAll}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <><span className="animate-spin">⏳</span> Generating file {currentFile}/{fileCount}…</>
                    ) : (
                      <><span>📥</span> Download All {fileCount} Files</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
