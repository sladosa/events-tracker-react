/**
 * Events Tracker – Excel Export Modal
 * =====================================
 * Export Activities to Excel with:
 * - Filter-aware (uses FilterContext)
 * - Export Profiles (column grouping recipes)
 * - Preview mode (10 rows for profile creation)
 * - Import Profile from xlsx (reads column grouping state)
 * - Pagination for large exports
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { loadExportData, loadStructureNodes, loadSharedEmailsByArea, loadCategoriesForExport, resolveExportCategoryIds, countEventsForExport } from '@/lib/excelDataLoader';
import { createEventsExcel, mergeSessionEvents } from '@/lib/excelExport';
import { timestampSuffix, type FilterSheetInfo } from '@/lib/excelUtils';
import type { ExportFilters } from '@/lib/excelTypes';
import { readProfileFromWorkbook, readProfileNameFromWorkbook, readFilterFromWorkbook, sanitizeProfileName, type ExportProfiles, type ProfileFilterState } from '@/lib/exportProfile';
import { resolvePeriodKey, type PeriodKey } from '@/hooks/useDateBounds';
import { ATTR_FILTER_ANY } from '@/lib/eventQueryBuilder';
import type { ExportAttrDef } from '@/lib/excelTypes';

interface ExcelExportModalProps {
  onClose: () => void;
}

const DEFAULT_BATCH_SIZE = 10000;
const MIN_BATCH = 2;
const MAX_BATCH = 50000;
const PREVIEW_LIMIT = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAttrFilterRaw(
  raw: string,
  attrDefs?: ExportAttrDef[],
): { attrDefId: string; value: string; isExact: boolean } | null {
  // Format: "slug: =value" or "slug: ~value" or "*: ~value" or legacy "uuid: =value"
  const match = raw.match(/^([^:]+):\s*([=~])(.+)$/);
  if (!match) return null;
  const key = match[1].trim();
  const isExact = match[2] === '=';
  const value = match[3];

  if (key === '*') return { attrDefId: ATTR_FILTER_ANY, isExact: false, value };
  if (UUID_RE.test(key)) return { attrDefId: key, isExact, value };
  // Slug lookup
  if (attrDefs) {
    const def = attrDefs.find(d => d.slug === key);
    if (def) return { attrDefId: def.id, isExact, value };
  }
  return null;
}

async function resolveAttrDefsForSlug(
  _userId: string,
  areaId?: string | null,
  categoryId?: string | null,
): Promise<ExportAttrDef[]> {
  let query = supabase.from('attribute_definitions')
    .select('id, category_id, name, slug, data_type, unit, is_required, default_value, validation_rules, sort_order, description');
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  } else if (areaId) {
    const { data: cats } = await supabase.from('categories').select('id').eq('area_id', areaId);
    if (cats?.length) query = query.in('category_id', cats.map(c => c.id));
  }
  const { data } = await query;
  return (data ?? []) as ExportAttrDef[];
}

function formatAttrFilterDesc(
  af: { attrDefId: string; value: string; isExact: boolean },
  attrDefs?: ExportAttrDef[],
): string {
  const op = af.isExact ? '=' : '~';
  if (af.attrDefId === ATTR_FILTER_ANY) return `*: ${op}${af.value}`;
  const def = attrDefs?.find(d => d.id === af.attrDefId);
  const label = def?.slug || af.attrDefId;
  return `${label}: ${op}${af.value}`;
}

function applyProfileFilterOverrides(
  baseFilters: ExportFilters,
  pfs: ProfileFilterState,
  attrDefs?: ExportAttrDef[],
): { filters: ExportFilters; overrideLabel: string | null; periodKeyOverride: string | null } {
  const filters = { ...baseFilters };
  const parts: string[] = [];
  let periodKeyOverride: string | null = null;

  if (pfs.periodKey) {
    if (pfs.periodKey === 'all-time') {
      // resolvePeriodKey('all-time') returns null by design (no resolvable
      // range) — handle it explicitly so the override actually clears dates
      // instead of silently leaving the live filter's date range in place.
      filters.dateFrom = null;
      filters.dateTo = null;
      periodKeyOverride = pfs.periodKey;
      parts.push('Period: all-time');
    } else if (pfs.periodKey === 'custom') {
      // Mirrors the live UI: explicit From/To dates + Period = "Custom".
      // Only applies if readFilterFromWorkbook found valid ISO dates.
      if (pfs.dateFrom && pfs.dateTo) {
        filters.dateFrom = pfs.dateFrom;
        filters.dateTo = pfs.dateTo;
        periodKeyOverride = pfs.periodKey;
        parts.push(`Period: custom (${pfs.dateFrom} → ${pfs.dateTo})`);
      }
    } else {
      const resolved = resolvePeriodKey(pfs.periodKey as PeriodKey);
      if (resolved) {
        filters.dateFrom = resolved.from;
        filters.dateTo = resolved.to;
        periodKeyOverride = pfs.periodKey;
        parts.push(`Period: ${pfs.periodKey}`);
      }
    }
  }
  if (pfs.sortOrder) {
    filters.sortOrder = pfs.sortOrder;
    parts.push(`Sort: ${pfs.sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}`);
  }
  if (pfs.commentSearch) {
    filters.commentSearch = pfs.commentSearch;
    parts.push(`Comment: "${pfs.commentSearch}"`);
  }
  if (pfs.attrFilterRaw) {
    if (pfs.attrFilterRaw === '_') {
      // "_" sentinel = explicitly clear the attribute filter (same convention
      // as Excel Import/Structure Import). Distinct from a blank cell, which
      // means "no override — inherit whatever the live filter has".
      filters.attrFilter = null;
      parts.push('Attr filter: (cleared)');
    } else {
      const parsed = parseAttrFilterRaw(pfs.attrFilterRaw, attrDefs);
      if (parsed) {
        filters.attrFilter = parsed;
        parts.push(`Attr filter: ${parsed.value}`);
      }
    }
  }

  return { filters, overrideLabel: parts.length > 0 ? parts.join(', ') : null, periodKeyOverride };
}

export function ExcelExportModal({ onClose }: ExcelExportModalProps) {
  const { filter, selectedArea, sharedContext } = useFilter();

  const [totalCount,  setTotalCount]  = useState<number | null>(null);
  const [batchSize,   setBatchSize]   = useState(DEFAULT_BATCH_SIZE);
  const [fileCount,   setFileCount]   = useState(1);
  const [currentFile, setCurrentFile] = useState(0);   // 0 = idle, >0 = generating file N
  const [loadingCount, setLoadingCount] = useState(true);
  const [error,       setError]       = useState('');

  // Export Profile state
  const [profiles, setProfiles]           = useState<ExportProfiles>({});
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [importing, setImporting]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters: ExportFilters = {
    areaId:     filter.areaId,
    categoryId: filter.categoryId,
    dateFrom:   filter.dateFrom,
    dateTo:     filter.dateTo,
    sortOrder:  filter.sortOrder,
    commentSearch: filter.commentSearch,
    attrFilter: filter.attrFilter,
  };

  // Load profiles from area.settings on mount
  useEffect(() => {
    if (!selectedArea?.settings?.export_profiles) {
      setProfiles({});
      return;
    }
    setProfiles(selectedArea.settings.export_profiles as ExportProfiles);
  }, [selectedArea]);

  // Load total count on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    setError('');

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const categoriesDict = await loadCategoriesForExport(user.id);
        const categoryIds    = await resolveExportCategoryIds(user.id, filters, categoriesDict);
        const total          = await countEventsForExport(user.id, filters, categoryIds);

        if (!cancelled) {
          setTotalCount(total);
          setFileCount(Math.max(1, Math.ceil(total / batchSize)));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message
          : (typeof err === 'object' && err !== null && 'message' in err)
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err);
        if (!cancelled) setError(msg);
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

  // ── Core download ─────────────────────────────────────────────────
  const doDownload = useCallback(async (fileIndex: number, previewMode: boolean) => {
    try {
      setError('');
      setCurrentFile(fileIndex);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profileName = selectedProfile || undefined;
      const activeProfile = profileName ? profiles[profileName] ?? null : null;

      // Apply profile filter overrides (if profile has saved filter state)
      let effectiveFilters = filters;
      let effectivePeriodKey: string | undefined = filter.periodKey;
      let effectiveCommentSearch = filter.commentSearch;
      let effectiveAttrFilter = filter.attrFilter;

      if (activeProfile?.filterState && !previewMode) {
        // Resolve attrDefs BEFORE building overrides — parseAttrFilterRaw needs
        // them to look up a slug-based filter (e.g. "racun: =Sašin tekući RF").
        // Without attrDefs, slug lookups silently fail and the live filter's
        // attrFilter stays in effect instead of the profile's override.
        const attrFilterRaw = activeProfile.filterState.attrFilterRaw;
        const attrDefsForOverride = attrFilterRaw && attrFilterRaw !== '_'
          ? await resolveAttrDefsForSlug(user.id, filters.areaId, filters.categoryId)
          : undefined;
        const overrides = applyProfileFilterOverrides(filters, activeProfile.filterState, attrDefsForOverride);
        effectiveFilters = overrides.filters;
        if (overrides.periodKeyOverride) {
          effectivePeriodKey = overrides.periodKeyOverride;
        }
        if (activeProfile.filterState.commentSearch !== undefined) {
          effectiveCommentSearch = activeProfile.filterState.commentSearch;
        }
        if (attrFilterRaw) {
          // attrFilterRaw was present (real filter or "_" clear sentinel) —
          // effectiveFilters.attrFilter is now authoritative, including null
          // (explicitly cleared). Falls through to the live value otherwise.
          effectiveAttrFilter = effectiveFilters.attrFilter ?? null;
        }
      }

      const limit = previewMode ? PREVIEW_LIMIT : batchSize;
      const offset = previewMode ? 0 : (fileIndex - 1) * batchSize;

      const [bundle, structureNodes, sharedWithByArea] = await Promise.all([
        loadExportData(user.id, effectiveFilters, offset, limit),
        loadStructureNodes(user.id),
        loadSharedEmailsByArea(user.id),
      ]);
      const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

      const eventDates = bundle.events.map(e => e.event_date).filter(Boolean).sort();
      const firstRecord = eventDates.length > 0 ? eventDates[0] : undefined;
      const lastRecord  = eventDates.length > 0 ? eventDates[eventDates.length - 1] : undefined;

      const catValues = Object.values(bundle.categoriesDict);
      const areaName     = effectiveFilters.areaId
        ? catValues.find(c => c.area_id === effectiveFilters.areaId)?.area_name ?? null
        : null;
      const categoryPath = effectiveFilters.categoryId
        ? bundle.categoriesDict[effectiveFilters.categoryId]?.full_path ?? null
        : null;

      const ts = timestampSuffix();
      const filterInfo: FilterSheetInfo = {
        exportType:  'Activities',
        exportedAt:  ts,
        area:        areaName,
        category:    categoryPath,
        dateFrom:    effectiveFilters.dateFrom,
        dateTo:      effectiveFilters.dateTo,
        sortOrder:   effectiveFilters.sortOrder ?? 'desc',
        firstRecord: effectiveFilters.dateFrom ? undefined : firstRecord,
        lastRecord:  effectiveFilters.dateTo   ? undefined : lastRecord,
        periodKey:   effectivePeriodKey,
        commentSearch: effectiveCommentSearch || undefined,
        attrFilterDesc: effectiveAttrFilter
          ? formatAttrFilterDesc(effectiveAttrFilter, bundle.attrDefs)
          : undefined,
        exportProfile: profileName,
      };

      const buffer = await createEventsExcel(
        merged, bundle.attrDefs, bundle.categoriesDict,
        effectiveFilters.sortOrder ?? 'desc',
        structureNodes,
        filterInfo,
        { filterAreaId: effectiveFilters.areaId, filterCategoryId: effectiveFilters.categoryId, sharedWithByArea },
        activeProfile,
      );

      const profileSlug = profileName ? `_${sanitizeProfileName(profileName)}` : '';
      const previewTag  = previewMode ? '_preview' : '';
      const suffix      = !previewMode && fileCount > 1 ? `_part${fileIndex}of${fileCount}` : '';
      const filename = `events_export${profileSlug}${previewTag}_${ts}${suffix}.xlsx`;

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, filename);

      if (previewMode) {
        toast.success('Preview exported — group columns in Excel, then Import Profile here');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      setError(`Export failed: ${msg}`);
    } finally {
      setCurrentFile(0);
    }
  }, [batchSize, fileCount, filters, filter.periodKey, filter.commentSearch, filter.attrFilter, selectedProfile, profiles]);

  const downloadFile = useCallback((fileIndex: number) => doDownload(fileIndex, false), [doDownload]);
  const downloadPreview = useCallback(() => doDownload(1, true), [doDownload]);

  const downloadAll = useCallback(async () => {
    for (let i = 1; i <= fileCount; i++) {
      await downloadFile(i);
      if (i < fileCount) await new Promise(r => setTimeout(r, 500));
    }
  }, [fileCount, downloadFile]);

  // ── Import Profile from xlsx ──────────────────────────────────────
  const handleImportProfile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      const profile = readProfileFromWorkbook(wb);
      if (!profile) {
        setError('Could not read column grouping from this file. Make sure it has an Events sheet with ATTRIBUTE LEGEND.');
        return;
      }

      // Read filter settings from Filter sheet (if present)
      const filterState = readFilterFromWorkbook(wb);
      if (filterState) {
        profile.filterState = filterState;
      }

      const existingName = readProfileNameFromWorkbook(wb);
      const defaultName = existingName || file.name.replace(/\.xlsx?$/i, '').replace(/^events_export_?/, '');

      const name = window.prompt('Profile name:', defaultName);
      if (!name?.trim()) return;
      const trimmedName = name.trim();

      // Save to area.settings
      if (!filter.areaId) {
        setError('Select an Area before importing a profile');
        return;
      }
      if (sharedContext) {
        setError("You don't have permission to save export profiles in this area (read-only access). Use the UI filters, or filter the full Excel locally after downloading.");
        return;
      }

      const newProfiles = { ...profiles, [trimmedName]: profile };

      const { error: updateError } = await supabase
        .from('areas')
        .update({
          settings: {
            ...(selectedArea?.settings ?? {}),
            export_profiles: newProfiles,
          },
        })
        .eq('id', filter.areaId);

      if (updateError) throw updateError;

      setProfiles(newProfiles);
      setSelectedProfile(trimmedName);
      const filterNote = profile.filterState ? ' + filter overrides' : '';
      toast.success(`Profile "${trimmedName}" saved (${profile.columns.filter(c => c.hidden).length} hidden cols, column order + widths${filterNote})`);
      window.dispatchEvent(new CustomEvent('areas-changed'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Import profile failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  }, [filter.areaId, profiles, selectedArea]);

  // ── Delete profile ────────────────────────────────────────────────
  const handleDeleteProfile = useCallback(async () => {
    if (!selectedProfile || !filter.areaId) return;
    if (sharedContext) { toast.error("Read-only access — cannot delete profiles"); return; }
    if (!window.confirm(`Delete profile "${selectedProfile}"?`)) return;

    const newProfiles = { ...profiles };
    delete newProfiles[selectedProfile];

    const { error: updateError } = await supabase
      .from('areas')
      .update({
        settings: {
          ...(selectedArea?.settings ?? {}),
          export_profiles: newProfiles,
        },
      })
      .eq('id', filter.areaId);

    if (updateError) {
      setError(`Delete failed: ${updateError.message}`);
      return;
    }

    setProfiles(newProfiles);
    setSelectedProfile('');
    toast.success('Profile deleted');
    window.dispatchEvent(new CustomEvent('areas-changed'));
  }, [selectedProfile, filter.areaId, profiles, selectedArea]);

  const isGenerating = currentFile > 0;
  const noData       = totalCount !== null && totalCount === 0;
  const profileNames = Object.keys(profiles);
  const activeProfile = selectedProfile ? profiles[selectedProfile] : null;
  const hiddenCount  = activeProfile ? activeProfile.columns.filter(c => c.hidden).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-full flex flex-col">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
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

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Filters summary */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-800 mb-1">Active filters:</p>
            <p>📅 Date: {filter.dateFrom ?? '(all)'} → {filter.dateTo ?? '(all)'}</p>
            {filter.areaId && <p>📁 Area filter active</p>}
            {filter.categoryId && <p>🏷️ Category filter active</p>}
            <p>🔃 Sort: {filter.sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}</p>
            {filter.commentSearch && <p>💬 Comment: "{filter.commentSearch}"</p>}
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

          {/* Export Profile section */}
          {filter.areaId && !loadingCount && !noData && totalCount !== null && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium text-gray-800">Export Profile</p>

              {/* Profile dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  disabled={isGenerating}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">No profile (all columns)</option>
                  {profileNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {selectedProfile && (
                  <button
                    onClick={handleDeleteProfile}
                    disabled={isGenerating}
                    title="Delete this profile"
                    className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 disabled:opacity-40"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Profile info */}
              {activeProfile && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">
                    {hiddenCount} column{hiddenCount !== 1 ? 's' : ''} hidden · column order from profile
                  </p>
                  {activeProfile.filterState && (
                    <p className="text-xs text-blue-600">
                      📋 Profile includes filter overrides: {(() => {
                        const parts: string[] = [];
                        if (activeProfile.filterState.periodKey) parts.push(`Period: ${activeProfile.filterState.periodKey}`);
                        if (activeProfile.filterState.sortOrder) parts.push(`Sort: ${activeProfile.filterState.sortOrder === 'asc' ? 'Oldest' : 'Newest'}`);
                        if (activeProfile.filterState.commentSearch) parts.push(`Comment: "${activeProfile.filterState.commentSearch}"`);
                        if (activeProfile.filterState.attrFilterRaw) parts.push('Attr filter');
                        return parts.join(', ');
                      })()}
                    </p>
                  )}
                </div>
              )}

              {/* Preview + Import buttons */}
              <div className="flex gap-2">
                <button
                  onClick={downloadPreview}
                  disabled={isGenerating || importing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? '⏳' : '👁️'} Preview (10 rows)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating || importing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 disabled:opacity-50 transition-colors"
                >
                  {importing ? '⏳' : '📋'} Import Profile
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportProfile}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Batch size control */}
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
                    <><span>📥</span> Download Excel{selectedProfile ? ` (${selectedProfile})` : ''}</>
                  )}
                </button>
              ) : (
                <>
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
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end flex-shrink-0">
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
