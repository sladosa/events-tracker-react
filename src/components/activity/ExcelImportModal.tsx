/**
 * Events Tracker – Excel Import Modal
 * =====================================
 * Import flow:
 *   idle → parsing → checking (collision detect) → ready → applying → done
 *
 * Collision resolution: ako CREATE sesija već postoji u bazi,
 * korisnik bira Overwrite / Skip per sesija.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  importEventsFromExcel,
  checkImportCollisions,
  checkMissingCategories,
  parseExcelFile,
} from '@/lib/excelImport';
import { importStructureExcel } from '@/lib/structureImport';
import { loadCategoriesForExport } from '@/lib/excelDataLoader';
import type { CollisionInfo } from '@/lib/excelImport';

interface ExcelImportModalProps {
  onClose:   () => void;
  onSuccess: () => void;  // called when modal is closed after a successful import
  onRefresh: () => void;  // called immediately when import completes (refreshes table)
}

type ImportState = 'idle' | 'parsing' | 'checking' | 'confirm-structure' | 'ready' | 'applying' | 'done' | 'error';

interface ParsePreview {
  toCreateCount: number;
  toUpdateCount: number;
  warnings:      string[];
}

export function ExcelImportModal({ onClose, onSuccess, onRefresh }: ExcelImportModalProps) {
  const [importState,   setImportState]   = useState<ImportState>('idle');
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [preview,       setPreview]       = useState<ParsePreview | null>(null);
  const [collisions,    setCollisions]    = useState<CollisionInfo[]>([]);
  const [overwriteMap,  setOverwriteMap]  = useState<Map<string, 'replace' | 'add' | 'skip'>>(new Map());
  const [result,        setResult]        = useState<{ created: number; updated: number; skipped: number; warnings: string[] } | null>(null);
  const [errors,        setErrors]        = useState<string[]>([]);
  const [isDragOver,       setIsDragOver]       = useState(false);
  const [missingCatPaths,  setMissingCatPaths]  = useState<string[]>([]);
  const [applyingMessage,  setApplyingMessage]  = useState('Importing events…');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setErrors(['Please select an Excel file (.xlsx)']);
      return;
    }

    setSelectedFile(file);
    setErrors([]);
    setPreview(null);
    setCollisions([]);
    setOverwriteMap(new Map());
    setMissingCatPaths([]);
    setImportState('parsing');

    try {
      const parsed = await parseExcelFile(file);

      if (parsed.errors.length > 0) {
        setErrors(parsed.errors);
        setImportState('error');
        return;
      }

      const previewData: ParsePreview = {
        toCreateCount: parsed.toCreate.length,
        toUpdateCount: parsed.toUpdate.length,
        warnings:      parsed.warnings,
      };
      setPreview(previewData);

      // Always load user + categories (needed for collision check and missing-category check)
      setImportState('checking');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const categoriesDict = await loadCategoriesForExport(user.id);

      // Collision detection za CREATE redove
      if (parsed.toCreate.length > 0) {
        const foundCollisions = await checkImportCollisions(user.id, parsed.toCreate, categoriesDict);
        setCollisions(foundCollisions);

        // Inicijalna odluka: sve na 'skip'
        if (foundCollisions.length > 0) {
          const initialMap = new Map<string, 'replace' | 'add' | 'skip'>();
          for (const c of foundCollisions) initialMap.set(c.sessionKey, 'skip');
          setOverwriteMap(initialMap);
        }
      }

      // Korak 7: check for missing category paths in file
      const missingCheck = await checkMissingCategories(file, categoriesDict);
      if (missingCheck.missingPaths.length > 0 && missingCheck.hasStructureSheet) {
        setMissingCatPaths(missingCheck.missingPaths);
        setImportState('confirm-structure');
        return;
      }

      setImportState('ready');
    } catch (err) {
      setErrors([`Parse error: ${String(err)}`]);
      setImportState('error');
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Toggle collision odluke ──
  const setDecision = (sessionKey: string, value: 'replace' | 'add' | 'skip') => {
    setOverwriteMap(prev => {
      const next = new Map(prev);
      next.set(sessionKey, value);
      return next;
    });
  };

  // ── OP2: Skip all sessions with photos ──
  const handleSkipAllWithPhotos = () => {
    setOverwriteMap(prev => {
      const next = new Map(prev);
      for (const c of collisions) {
        if (c.hasPhotos) next.set(c.sessionKey, 'skip');
      }
      return next;
    });
  };
  const hasAnyPhotoCollisions = collisions.some(c => c.hasPhotos);

  // ── UX-1: Reaktivni counteri ──
  // Koliko CREATE redova je efektivno (ne-skip) + koliko UPDATE redova
  const { effectiveCreateCount, effectiveUpdateCount, allSkipped } = useMemo(() => {
    if (!preview) return { effectiveCreateCount: 0, effectiveUpdateCount: 0, allSkipped: false };

    // Izračunaj CREATE redove koji NEĆE biti preskočeni
    let collisionRows = 0;
    let skippedRows   = 0;
    for (const c of collisions) {
      const dec = overwriteMap.get(c.sessionKey) ?? 'skip';
      collisionRows += c.rowNumbers.length;
      if (dec === 'skip') skippedRows += c.rowNumbers.length;
    }
    const nonCollisionCreates = preview.toCreateCount - collisionRows;
    const effectiveCreates    = nonCollisionCreates + (collisionRows - skippedRows);

    const allS = collisions.length > 0
      && skippedRows === collisionRows
      && preview.toUpdateCount === 0
      && nonCollisionCreates === 0;

    return {
      effectiveCreateCount: effectiveCreates,
      effectiveUpdateCount: preview.toUpdateCount,
      allSkipped: allS,
    };
  }, [preview, collisions, overwriteMap]);

  // ── Korak 7: Create missing categories from Structure sheet, then continue ──
  const handleCreateStructure = async () => {
    if (!selectedFile) return;
    setApplyingMessage('Creating categories…');
    setImportState('applying');
    setErrors([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await importStructureExcel(selectedFile, user.id);
      // Notify AreaDropdown and other listeners that areas may have changed
      window.dispatchEvent(new CustomEvent('areas-changed'));
      setImportState('ready');
    } catch (err) {
      setErrors([`Failed to create categories: ${String(err)}`]);
      setImportState('error');
    }
  };

  // ── Apply import ──
  const handleApply = async () => {
    if (!selectedFile) return;

    setApplyingMessage('Importing events…');
    setImportState('applying');
    setErrors([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const importResult = await importEventsFromExcel(user.id, selectedFile, overwriteMap);

      if (importResult.errors.length > 0) {
        setErrors(importResult.errors);
        setImportState('error');
        return;
      }

      setResult({
        created:  importResult.created,
        updated:  importResult.updated,
        skipped:  importResult.skipped,
        warnings: importResult.warnings,
      });
      setImportState('done');
      // Refresh the activities table immediately if anything was actually imported
      if (importResult.created > 0 || importResult.updated > 0) {
        onRefresh();
      }
    } catch (err) {
      setErrors([`Import failed: ${String(err)}`]);
      setImportState('error');
    }
  };

  const handleReset = () => {
    setImportState('idle');
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setErrors([]);
    setCollisions([]);
    setOverwriteMap(new Map());
    setMissingCatPaths([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isWorking = importState === 'parsing' || importState === 'checking' || importState === 'applying';

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">📤</span>
            <h2 className="text-lg font-semibold">Import from Excel</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="text-blue-100 hover:text-white text-2xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── IDLE / File picker ── */}
          {(importState === 'idle' || importState === 'error') && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <div className="text-4xl mb-2">📂</div>
                <p className="text-sm font-medium text-gray-700">Click to select or drag &amp; drop</p>
                <p className="text-xs text-gray-400 mt-1">Excel files (.xlsx) only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
                  <p className="font-medium">❌ Import error:</p>
                  {errors.map((e, i) => (
                    <p key={i} className="whitespace-pre-wrap font-mono text-xs">{e}</p>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-gray-600">Supported file format:</p>
                <p>• Export from Events Tracker (Excel export button)</p>
                <p>• ATTRIBUTE LEGEND section must be intact</p>
                <p>• Rows with empty column A → CREATE new events</p>
                <p>• Rows with UUID in column A → UPDATE existing</p>
              </div>
            </>
          )}

          {/* ── PARSING / CHECKING ── */}
          {(importState === 'parsing' || importState === 'checking') && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-4xl animate-spin">⏳</span>
              <p className="text-gray-600">
                {importState === 'parsing' ? 'Parsing Excel file…' : 'Checking for conflicts…'}
              </p>
              <p className="text-sm text-gray-400">{selectedFile?.name}</p>
            </div>
          )}

          {/* ── CONFIRM STRUCTURE: missing categories need to be created ── */}
          {importState === 'confirm-structure' && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📄</span>
                <span className="truncate font-medium">{selectedFile?.name}</span>
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ {missingCatPaths.length} category path{missingCatPaths.length !== 1 ? 's' : ''} not found in database
                </p>
                <p className="text-xs text-amber-700">
                  The file contains a Structure sheet. These categories will be created before importing events:
                </p>
                <ul className="text-xs text-amber-900 space-y-0.5 max-h-40 overflow-y-auto">
                  {missingCatPaths.map(p => (
                    <li key={p} className="font-mono bg-amber-100 rounded px-2 py-0.5">{p}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="py-2.5 px-3 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateStructure}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Create categories &amp; continue
                </button>
              </div>
            </>
          )}

          {/* ── READY: Preview + collision resolution ── */}
          {importState === 'ready' && preview && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📄</span>
                <span className="truncate font-medium">{selectedFile?.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{effectiveCreateCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">New events to create</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{effectiveUpdateCount}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Events to update</p>
                </div>
              </div>

              {/* Collision resolution */}
              {collisions.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        ⚠️ {collisions.length} session conflict{collisions.length > 1 ? 's' : ''} detected
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        These sessions already exist in the database. Choose what to do for each:
                      </p>
                    </div>
                    {/* OP2: Skip all with photos button */}
                    {hasAnyPhotoCollisions && (
                      <button
                        onClick={handleSkipAllWithPhotos}
                        className="shrink-0 text-[10px] font-medium px-2 py-1 rounded border border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                        title="Set all sessions with photos to Skip"
                      >
                        📷 Skip all with photos
                      </button>
                    )}
                  </div>
                  {/* OP2: global photo warning banner */}
                  {hasAnyPhotoCollisions && (
                    <div className="bg-yellow-100 border border-yellow-400 rounded p-2 text-[11px] text-yellow-900 font-medium">
                      ⚠️ Some sessions below contain photos. Replacing them will <strong>permanently delete</strong> those photos from storage. Use <em>Skip</em> or <em>Add</em> to preserve them.
                    </div>
                  )}

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {collisions.map(c => {
                      const dec = overwriteMap.get(c.sessionKey) ?? 'skip';
                      // OP2: photo sessions get a more prominent border
                      const cardBorder = c.hasPhotos
                        ? 'border-yellow-400 bg-yellow-50'
                        : 'border-amber-200 bg-white';
                      return (
                        <div key={c.sessionKey} className={`border rounded-lg p-3 ${cardBorder}`}>
                          <div className="text-xs text-gray-700 mb-0.5">
                            <span className="font-semibold">{c.eventDate}</span>
                            <span className="text-gray-400"> @ </span>
                            <span className="font-semibold">{formatTime(c.sessionISO)}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span className="text-gray-600">{c.categoryPath}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mb-2.5">
                            Excel rows: {c.rowNumbers.join(', ')}
                            <span className="mx-1.5">·</span>
                            <span className="text-indigo-500 font-medium">{c.existingLeafCount} existing event{c.existingLeafCount !== 1 ? 's' : ''} in DB</span>
                            {c.hasPhotos && (
                              <span className="ml-1.5 font-bold text-yellow-700">📷 HAS PHOTOS</span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setDecision(c.sessionKey, 'replace')}
                              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium border transition-colors ${
                                dec === 'replace'
                                  ? 'bg-red-500 border-red-500 text-white'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600'
                              }`}
                              title="Delete existing events for this session and insert from Excel"
                            >
                              🔄 Replace
                            </button>
                            <button
                              onClick={() => setDecision(c.sessionKey, 'add')}
                              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium border transition-colors ${
                                dec === 'add'
                                  ? 'bg-green-600 border-green-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600'
                              }`}
                              title="Keep existing events and add Excel rows on top"
                            >
                              ➕ Add to session
                            </button>
                            <button
                              onClick={() => setDecision(c.sessionKey, 'skip')}
                              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium border transition-colors ${
                                dec === 'skip'
                                  ? 'bg-gray-500 border-gray-500 text-white'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                              }`}
                              title="Leave this session untouched"
                            >
                              ⏭ Skip
                            </button>
                          </div>
                          {dec === 'replace' && (
                            <p className="text-[10px] text-red-500 mt-1.5">
                              ⚠️ {c.existingLeafCount} existing event{c.existingLeafCount !== 1 ? 's' : ''} will be deleted and replaced with {c.rowNumbers.length} from Excel.
                              {c.hasPhotos && (
                                <span className="block mt-0.5 font-semibold text-red-600">
                                  📷 This session has photos — they will also be permanently deleted!
                                </span>
                              )}
                            </p>
                          )}
                          {dec === 'add' && (
                            <p className="text-[10px] text-green-600 mt-1.5">
                              {c.rowNumbers.length} Excel event{c.rowNumbers.length !== 1 ? 's' : ''} will be added → session will have {c.existingLeafCount + c.rowNumbers.length} events total.
                            </p>
                          )}
                          {dec === 'skip' && (
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              This session will not be changed.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
                  <p className="font-medium">⚠️ Warnings:</p>
                  {preview.warnings.map((w, i) => (
                    <p key={i} className="whitespace-pre-wrap text-xs">{w}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Choose different file
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-3 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                  title="Close without importing"
                >
                  Abort
                </button>
                {/* UX-2: Apply is always enabled unless currently applying */}
                <button
                  onClick={handleApply}
                  disabled={false}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {allSkipped ? '⏭ All skipped – Apply' : '✅ Apply Import'}
                </button>
              </div>
            </>
          )}

          {/* ── APPLYING ── */}
          {importState === 'applying' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-4xl animate-spin">⏳</span>
              <p className="text-gray-600">{applyingMessage}</p>
              <p className="text-xs text-gray-400">Please wait, do not close this window</p>
            </div>
          )}

          {/* ── DONE ── */}
          {importState === 'done' && result && (
            <>
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="text-5xl">✅</span>
                <p className="text-lg font-semibold text-gray-800">Import successful!</p>
              </div>

              <div className={`grid gap-3 ${result.skipped > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600 mt-0.5">Events created</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Events updated</p>
                </div>
                {result.skipped > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Unchanged</p>
                  </div>
                )}
              </div>

              {result.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
                  <p className="font-medium">⚠️ Notes:</p>
                  {result.warnings.map((w, i) => (
                    <p key={i} className="whitespace-pre-wrap text-xs">{w}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Import another file
                </button>
                <button
                  onClick={onSuccess}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
