// ============================================================
// StructureAddAreaPanel.tsx
// ============================================================
// Amber modal for creating a new top-level Area (S24).
//
// Two modes:
//   "empty"    — Create blank area (original behaviour)
//   "template" — Copy template area + categories + attr_defs (S52)
//
// Accessible via "+ Add Area" button in Structure Edit Mode toolbar.
// After create: onCreated(newAreaId) → StructureTableView refetches
// + dispatches 'areas-changed' to refresh Activity Area dropdown.
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import { useTemplateAreas } from '@/hooks/useAreas';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';

const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000001';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureAddAreaPanelProps {
  allNodes: StructureNode[];
  userId: string;
  onClose: () => void;
  onCreated: (newAreaId: string) => void;
}

// --------------------------------------------------------
// Slug generation
// --------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// --------------------------------------------------------
// Mode type
// --------------------------------------------------------

type AddMode = 'empty' | 'template';

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function StructureAddAreaPanel({
  allNodes,
  userId,
  onClose,
  onCreated,
}: StructureAddAreaPanelProps) {
  const t = THEME.structureEdit;

  // ── Empty mode state ──────────────────────────────────
  const [name, setName] = useState('');

  // ── Shared state ──────────────────────────────────────
  const [mode, setMode] = useState<AddMode>('empty');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Template mode state ───────────────────────────────
  const [selectedTemplateAreaId, setSelectedTemplateAreaId] = useState('');
  const [templatePreview, setTemplatePreview] = useState<{ categoryCount: number; attrCount: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { areas: templateAreas, loading: templateAreasLoading } = useTemplateAreas();

  // Slugs that the current user already has (exclude template/shared areas from allNodes)
  const userAreaSlugs = useMemo(
    () => new Set(
      allNodes
        .filter(n => n.nodeType === 'area' && n.area.user_id === userId)
        .map(n => n.area.slug),
    ),
    [allNodes, userId],
  );

  // Template areas not yet copied by this user
  const availableTemplateAreas = useMemo(
    () => templateAreas.filter(ta => !userAreaSlugs.has(ta.slug)),
    [templateAreas, userAreaSlugs],
  );

  // Auto-select first available template area when mode switches
  useEffect(() => {
    if (mode === 'template' && availableTemplateAreas.length > 0 && !selectedTemplateAreaId) {
      setSelectedTemplateAreaId(availableTemplateAreas[0].id);
    }
    if (mode === 'template' && availableTemplateAreas.length === 0) {
      setSelectedTemplateAreaId('');
    }
  }, [mode, availableTemplateAreas, selectedTemplateAreaId]);

  // Load category/attr preview for selected template area
  useEffect(() => {
    if (mode !== 'template' || !selectedTemplateAreaId) {
      setTemplatePreview(null);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);

    (async () => {
      try {
        const { data: cats } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', TEMPLATE_USER_ID)
          .eq('area_id', selectedTemplateAreaId);

        if (cancelled) return;

        const catIds = (cats || []).map((c: { id: string }) => c.id);
        let attrCount = 0;

        if (catIds.length > 0) {
          const { count } = await supabase
            .from('attribute_definitions')
            .select('id', { count: 'exact', head: true })
            .in('category_id', catIds);
          attrCount = count || 0;
        }

        if (!cancelled) {
          setTemplatePreview({ categoryCount: catIds.length, attrCount });
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mode, selectedTemplateAreaId]);

  // ── Auto-focus ────────────────────────────────────────
  useEffect(() => {
    if (mode === 'empty') inputRef.current?.focus();
  }, [mode]);

  // ── Escape to close ───────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [creating, onClose]);

  const slug = generateSlug(name);

  // ── sort_order ────────────────────────────────────────
  const computeSortOrder = useCallback((): number => {
    const areas = allNodes.filter(n => n.nodeType === 'area');
    const maxSort = areas.reduce((max, n) => Math.max(max, n.sortOrder), 0);
    return maxSort + 10;
  }, [allNodes]);

  // ── Create empty area (original logic) ────────────────
  const handleCreateEmpty = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    setError(null);

    try {
      const newId = crypto.randomUUID();
      const sortOrder = computeSortOrder();
      const areaSlug = slug || generateSlug(trimmedName);

      const { error: insertErr } = await supabase.from('areas').insert({
        id: newId,
        user_id: userId,
        name: trimmedName,
        slug: areaSlug,
        sort_order: sortOrder,
      });

      if (insertErr) throw insertErr;

      onCreated(newId);
    } catch (err) {
      console.error('StructureAddAreaPanel: create failed', err);
      setError(err instanceof Error ? err.message : 'Create failed. Please try again.');
      setCreating(false);
    }
  }, [name, slug, userId, computeSortOrder, onCreated]);

  // ── Create from template ───────────────────────────────
  const handleCreateFromTemplate = useCallback(async () => {
    if (!selectedTemplateAreaId) return;

    const templateArea = templateAreas.find(ta => ta.id === selectedTemplateAreaId);
    if (!templateArea) return;

    setCreating(true);
    setError(null);

    try {
      const newAreaId = crypto.randomUUID();
      const sortOrder = computeSortOrder();

      // 1. Fetch template categories (ordered by level for correct parent mapping)
      const { data: templateCats, error: catFetchErr } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', TEMPLATE_USER_ID)
        .eq('area_id', selectedTemplateAreaId)
        .order('level', { ascending: true })
        .order('sort_order', { ascending: true });

      if (catFetchErr) throw catFetchErr;
      const cats = templateCats || [];

      // 2. Fetch template attribute_definitions
      const catIds = cats.map((c: { id: string }) => c.id);
      let attrDefs: AttributeDefinition[] = [];

      if (catIds.length > 0) {
        const { data: adData, error: adErr } = await supabase
          .from('attribute_definitions')
          .select('*')
          .in('category_id', catIds);
        if (adErr) throw adErr;
        attrDefs = adData || [];
      }

      // 3. Insert the new area
      const { error: areaErr } = await supabase.from('areas').insert({
        id: newAreaId,
        user_id: userId,
        name: templateArea.name,
        slug: templateArea.slug,
        sort_order: sortOrder,
        icon: templateArea.icon,
        color: templateArea.color,
        description: templateArea.description,
      });
      if (areaErr) throw areaErr;

      // 4. Build old→new category ID map, then insert categories
      const catIdMap = new Map<string, string>();
      for (const cat of cats) {
        catIdMap.set(cat.id, crypto.randomUUID());
      }

      if (cats.length > 0) {
        const newCats = cats.map((cat: {
          id: string;
          parent_category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          level: number;
          sort_order: number;
        }) => ({
          id: catIdMap.get(cat.id)!,
          user_id: userId,
          area_id: newAreaId,
          parent_category_id: cat.parent_category_id
            ? (catIdMap.get(cat.parent_category_id) ?? null)
            : null,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          level: cat.level,
          sort_order: cat.sort_order,
          path: null,
        }));

        const { error: catErr } = await supabase.from('categories').insert(newCats);
        if (catErr) throw catErr;
      }

      // 5. Insert attribute_definitions, remapping category_id
      if (attrDefs.length > 0) {
        const newAttrs = attrDefs.map((ad: AttributeDefinition) => ({
          id: crypto.randomUUID(),
          user_id: userId,
          category_id: ad.category_id ? (catIdMap.get(ad.category_id) ?? null) : null,
          name: ad.name,
          slug: ad.slug,
          description: ad.description,
          data_type: ad.data_type,
          unit: ad.unit,
          is_required: ad.is_required,
          default_value: ad.default_value,
          validation_rules: ad.validation_rules,
          sort_order: ad.sort_order,
        }));

        const { error: attrErr } = await supabase.from('attribute_definitions').insert(newAttrs);
        if (attrErr) throw attrErr;
      }

      onCreated(newAreaId);
    } catch (err) {
      console.error('StructureAddAreaPanel: template create failed', err);
      setError(err instanceof Error ? err.message : 'Create failed. Please try again.');
      setCreating(false);
    }
  }, [selectedTemplateAreaId, templateAreas, userId, computeSortOrder, onCreated]);

  // ── Dispatch ──────────────────────────────────────────
  const handleCreate = () => {
    if (mode === 'empty') handleCreateEmpty();
    else handleCreateFromTemplate();
  };

  const canCreate = mode === 'empty'
    ? !!name.trim() && !creating
    : !!selectedTemplateAreaId && !creating;

  // ── Enter to submit (empty mode) ──────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !creating && mode === 'empty') {
      handleCreateEmpty();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !creating) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className={cn('flex items-center justify-between px-5 py-4', t.headerBg)}>
          <h3 className={cn('text-base font-semibold', t.headerText)}>
            + Add New Area
          </h3>
          <button
            onClick={onClose}
            disabled={creating}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              t.accent,
              creating && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4">

          {/* Mode selector */}
          <div className="flex gap-3">
            <label className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors',
              mode === 'empty'
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 bg-gray-50 hover:border-amber-200',
            )}>
              <input
                type="radio"
                name="addMode"
                value="empty"
                checked={mode === 'empty'}
                onChange={() => { setMode('empty'); setError(null); }}
                disabled={creating}
                className="accent-amber-600"
              />
              <span className="text-sm font-medium text-gray-700">Create empty</span>
            </label>
            <label className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors',
              mode === 'template'
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 bg-gray-50 hover:border-amber-200',
              templateAreasLoading && 'opacity-60',
            )}>
              <input
                type="radio"
                name="addMode"
                value="template"
                checked={mode === 'template'}
                onChange={() => { setMode('template'); setError(null); }}
                disabled={creating || templateAreasLoading}
                className="accent-amber-600"
              />
              <span className="text-sm font-medium text-gray-700">Use template</span>
            </label>
          </div>

          {/* ── Empty mode content ── */}
          {mode === 'empty' && (
            <div>
              <label className={cn('block text-sm font-medium mb-1', t.lightText)}>
                Area Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                disabled={creating}
                placeholder="e.g. Health"
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors',
                  t.ring,
                  'border-amber-300 focus:border-amber-400',
                  creating && 'opacity-50',
                )}
              />
              <p className="mt-1 text-xs text-gray-400">
                Slug: <span className="font-mono text-gray-500">{slug || '—'}</span>
              </p>
            </div>
          )}

          {/* ── Template mode content ── */}
          {mode === 'template' && (
            <div className="space-y-3">
              {templateAreasLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Spinner /> Loading templates…
                </div>
              ) : availableTemplateAreas.length === 0 ? (
                <div className={cn('text-sm px-3 py-2 rounded-lg', t.light, t.lightText)}>
                  All available templates have already been added to your workspace.
                </div>
              ) : (
                <>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', t.lightText)}>
                      Template
                    </label>
                    <select
                      data-testid="template-area-select"
                      value={selectedTemplateAreaId}
                      onChange={(e) => {
                        setSelectedTemplateAreaId(e.target.value);
                        setError(null);
                      }}
                      disabled={creating}
                      className={cn(
                        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors',
                        t.ring,
                        'border-amber-300 focus:border-amber-400',
                        creating && 'opacity-50',
                      )}
                    >
                      {availableTemplateAreas.map(ta => (
                        <option key={ta.id} value={ta.id}>{ta.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preview */}
                  <div className={cn('text-sm px-3 py-2 rounded-lg', t.light)}>
                    {loadingPreview ? (
                      <span className="text-gray-400">Loading preview…</span>
                    ) : templatePreview ? (
                      <span className={t.lightText}>
                        Includes{' '}
                        <strong>{templatePreview.categoryCount}</strong>{' '}
                        {templatePreview.categoryCount === 1 ? 'category' : 'categories'},{' '}
                        <strong>{templatePreview.attrCount}</strong>{' '}
                        {templatePreview.attrCount === 1 ? 'attribute' : 'attributes'}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Error: {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            onClick={onClose}
            disabled={creating}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              t.cancelBtn,
              creating && 'opacity-50 cursor-not-allowed',
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-amber-700 hover:bg-amber-800 text-white',
              !canCreate && 'opacity-50 cursor-not-allowed',
            )}
          >
            {creating && <Spinner />}
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>

      </div>
    </div>
  );
}
