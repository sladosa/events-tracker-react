// ============================================================
// StructureImportModal.tsx — Structure Excel Import modal
// ============================================================
// Shows file picker → import button → result summary.
// On conflict: offers conflict Excel download.
// ============================================================

import { useState, useRef } from 'react';
import { saveAs } from 'file-saver';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { importStructureExcel, type ImportResult } from '@/lib/structureImport';
import {
  exportStructureExcel,
  structureConflictFilename,
} from '@/lib/structureExcel';
import type { StructureNode } from '@/types/structure';

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface StructureImportModalProps {
  userId: string;
  onClose: () => void;
  /** Called after a successful import so Structure can refetch */
  onImported: () => void;
  /** Current nodes — needed for conflict Excel generation */
  getNodes: () => Promise<StructureNode[]>;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function StructureImportModal({
  userId,
  onClose,
  onImported,
  getNodes,
}: StructureImportModalProps) {
  const t = THEME.structure;
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictDownloading, setConflictDownloading] = useState(false);

  // ── File selection ───────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setErrorMsg(null);
  };

  // ── Import ───────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await importStructureExcel(file, userId);
      setResult(res);

      const totalCreated =
        res.created.areas + res.created.categories + res.created.attributes;

      if (totalCreated > 0 || res.updated.attributes > 0) {
        onImported(); // trigger refetch in parent
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ── Conflict Excel download ──────────────────────────────
  const handleConflictExcel = async () => {
    if (!result?.conflicts.length) return;
    setConflictDownloading(true);
    try {
      const nodes = await getNodes();
      const conflictSlugs = new Set(result.conflicts.map(c => c.slug));
      const buffer = await exportStructureExcel(
        nodes,
        {},
        {
          type: 'conflict',
          description: `Import conflict: ${result.conflicts.length} row${result.conflicts.length !== 1 ? 's' : ''} skipped — see highlighted cells in col G`,
        },
        conflictSlugs,
      );
      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        structureConflictFilename(),
      );
    } catch (err) {
      console.error('Conflict Excel failed:', err);
    } finally {
      setConflictDownloading(false);
    }
  };

  // ── Derived state ────────────────────────────────────────
  const hasConflicts = (result?.conflicts.length ?? 0) > 0;
  const totalCreated = result
    ? result.created.areas + result.created.categories + result.created.attributes
    : 0;
  const totalChanged = result ? totalCreated + result.updated.attributes : 0;
  const isDone = result !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className={cn('flex-shrink-0 px-5 py-3 rounded-t-xl', t.headerBg, t.headerText)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UploadIcon />
              <span className="font-semibold text-sm">Import Structure</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Info banner */}
          <div className={cn('rounded-lg px-4 py-3 text-sm', t.light, t.lightBorder, 'border', t.lightText)}>
            <p className="font-medium mb-1">Non-destructive import</p>
            <p className="text-xs opacity-80">
              Only ADDS new areas, categories, and attributes. Never deletes or changes existing data types.
              Existing attributes with matching slugs will have name/unit/description updated.
            </p>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel file
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                  <FileIcon />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">
                  <UploadIcon />
                  <p className="mt-1">Click to select .xlsx file</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm flex gap-2">
              <WarningIcon />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result summary */}
          {isDone && result && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Import result
                </div>
                <div className="divide-y divide-gray-100">
                  <ResultRow label="Areas created"       value={result.created.areas} />
                  <ResultRow label="Categories created"  value={result.created.categories} />
                  <ResultRow label="Attributes created"  value={result.created.attributes} />
                  <ResultRow label="Attributes updated"  value={result.updated.attributes} />
                  <ResultRow label="Rows skipped"        value={result.skipped} warn={result.skipped > 0} />
                </div>
              </div>

              {/* Success message */}
              {totalChanged > 0 && !hasConflicts && (
                <div className="rounded-lg px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm">
                  ✓ Import completed successfully.
                </div>
              )}

              {/* No-op message */}
              {totalChanged === 0 && !hasConflicts && (
                <div className="rounded-lg px-4 py-3 bg-gray-50 border border-gray-200 text-gray-600 text-sm">
                  Nothing to import — all data already exists in the database.
                </div>
              )}

              {/* Conflicts */}
              {hasConflicts && (
                <div className="rounded-lg border border-amber-200 overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 text-amber-800">
                    <WarningIcon />
                    <span className="text-sm font-medium">
                      {result.conflicts.length} conflict{result.conflicts.length !== 1 ? 's' : ''} detected
                    </span>
                  </div>
                  <div className="px-4 py-3 text-xs text-gray-600 space-y-1">
                    <p>These attribute slugs were found in a different category path:</p>
                    {result.conflicts.map((c, i) => (
                      <div key={i} className="mt-2 bg-gray-50 rounded p-2 space-y-0.5">
                        <p><span className="font-medium">{c.attrName}</span> <span className="text-gray-400">(slug: {c.slug})</span></p>
                        <p className="text-red-600">In Excel:  {c.importedPath}</p>
                        <p className="text-gray-500">In DB:     {c.foundInPath}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3">
                    <button
                      onClick={handleConflictExcel}
                      disabled={conflictDownloading}
                      className={cn(
                        'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                        conflictDownloading ? 'opacity-50 cursor-not-allowed' : '',
                        'bg-amber-500 hover:bg-amber-600 text-white',
                      )}
                    >
                      {conflictDownloading ? 'Generating…' : '↓ Download Conflict Report'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1.5 text-center">
                      Conflicted slugs are highlighted in col G. Fix and re-import.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>
          {!isDone && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                !file || importing ? 'opacity-50 cursor-not-allowed' : '',
                t.headerBg, t.headerText,
              )}
            >
              {importing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <UploadIcon />
                  Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Small helper component for result rows
// ─────────────────────────────────────────────────────────────

function ResultRow({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          value > 0 && !warn ? 'text-green-600' : '',
          warn && value > 0 ? 'text-amber-600' : '',
          value === 0 ? 'text-gray-400' : '',
        )}
      >
        {value}
      </span>
    </div>
  );
}
