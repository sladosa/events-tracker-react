/**
 * Events Tracker – Excel Import Modal
 * =====================================
 * Import flow:
 *   idle → parsing → checking (collision detect) → ready → applying → done
 *
 * Collision resolution: ako CREATE sesija već postoji u bazi,
 * korisnik bira Overwrite / Skip per sesija.
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  importEventsFromExcel,
  checkImportCollisions,
  parseExcelFile,
} from '@/lib/excelImport';
import { loadCategoriesForExport } from '@/lib/excelDataLoader';
import type { CollisionInfo } from '@/lib/excelImport';

interface ExcelImportModalProps {
  onClose:   () => void;
  onSuccess: () => void;
}

type ImportState = 'idle' | 'parsing' | 'checking' | 'ready' | 'applying' | 'done' | 'error';

interface ParsePreview {
  toCreateCount: number;
  toUpdateCount: number;
  warnings:      string[];
}

export function ExcelImportModal({ onClose, onSuccess }: ExcelImportModalProps) {
  const [importState,   setImportState]   = useState<ImportState>('idle');
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [preview,       setPreview]       = useState<ParsePreview | null>(null);
  const [collisions,    setCollisions]    = useState<CollisionInfo[]>([]);
  const [overwriteMap,  setOverwriteMap]  = useState<Map<string, boolean>>(new Map());
  const [result,        setResult]        = useState<{ created: number; updated: number; warnings: string[] } | null>(null);
  const [errors,        setErrors]        = useState<string[]>([]);
  const [isDragOver,    setIsDragOver]    = useState(false);

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

      // Collision detection za CREATE redove
      if (parsed.toCreate.length > 0) {
        setImportState('checking');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const categoriesDict = await loadCategoriesForExport(user.id);
        const foundCollisions = await checkImportCollisions(user.id, parsed.toCreate, categoriesDict);

        setCollisions(foundCollisions);

        // Inicijalna odluka: sve na false (skip)
        if (foundCollisions.length > 0) {
          const initialMap = new Map<string, boolean>();
          for (const c of foundCollisions) initialMap.set(c.sessionKey, false);
          setOverwriteMap(initialMap);
        }
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

  // ── Toggle overwrite odluke ──
  const toggleOverwrite = (sessionKey: string, value: boolean) => {
    setOverwriteMap(prev => {
      const next = new Map(prev);
      next.set(sessionKey, value);
      return next;
    });
  };

  // ── Apply import ──
  const handleApply = async () => {
    if (!selectedFile) return;

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
        warnings: importResult.warnings,
      });
      setImportState('done');
      onSuccess();
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

          {/* ── READY: Preview + collision resolution ── */}
          {importState === 'ready' && preview && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📄</span>
                <span className="truncate font-medium">{selectedFile?.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{preview.toCreateCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">New events to create</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{preview.toUpdateCount}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Events to update</p>
                </div>
              </div>

              {/* Collision resolution */}
              {collisions.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ {collisions.length} session conflict{collisions.length > 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-amber-700">
                    These sessions already exist in the database. Choose what to do for each:
                  </p>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {collisions.map(c => (
                      <div key={c.sessionKey} className="bg-white border border-amber-200 rounded-lg p-2.5">
                        <div className="text-xs text-gray-700 mb-1">
                          <span className="font-medium">{c.eventDate}</span>
                          <span className="text-gray-400"> @ </span>
                          <span className="font-medium">{formatTime(c.sessionISO)}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <span className="text-gray-600">{c.categoryPath}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mb-2">Rows: {c.rowNumbers.join(', ')}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleOverwrite(c.sessionKey, true)}
                            className={`flex-1 py-1 px-2 text-xs rounded font-medium border transition-colors ${
                              overwriteMap.get(c.sessionKey) === true
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'bg-white border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600'
                            }`}
                          >
                            ✏️ Overwrite
                          </button>
                          <button
                            onClick={() => toggleOverwrite(c.sessionKey, false)}
                            className={`flex-1 py-1 px-2 text-xs rounded font-medium border transition-colors ${
                              overwriteMap.get(c.sessionKey) === false
                                ? 'bg-gray-500 border-gray-500 text-white'
                                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            ⏭ Skip
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600">
                    Skipped sessions will appear as warnings in the result.
                  </p>
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
                  onClick={handleApply}
                  disabled={preview.toCreateCount + preview.toUpdateCount === 0}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ✅ Apply Import
                </button>
              </div>
            </>
          )}

          {/* ── APPLYING ── */}
          {importState === 'applying' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-4xl animate-spin">⏳</span>
              <p className="text-gray-600">Importing events…</p>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600 mt-0.5">Events created</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Events updated</p>
                </div>
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
                  onClick={onClose}
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
