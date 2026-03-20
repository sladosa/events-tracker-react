// ============================================================
// StructureNodeEditPanel.tsx
// ============================================================
// Edit panel for Structure tab nodes (Area / Category).
// Amber theme (THEME.structureEdit), independent from global 'edit'.
//
// Sticky header: X close | ← View (switch back to View panel) | Save
//
// Editable fields:
//   Area:     name, description, sort_order
//   Category: name, description, sort_order (slug stays unchanged)
//
// Attributes section:
//   - Listed for the selected node's level only
//   - Per attr: name, unit, description, sort_order
//   - data_type: read-only (forbidden to change if events exist)
//   - Simple suggest options: comma/pipe editor (one option per line textarea)
//   - DependsOn attributes: read-only note ("complex validation — future version")
//
// On Save:
//   - Supabase updates area/category + changed attribute_definitions
//   - Calls onSaved(nodeId) → StructureTableView triggers highlight + refetch
// ============================================================

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

interface StructureNodeEditPanelProps {
  node: StructureNode;
  onClose: () => void;
  /** Switch back to View panel for same node */
  onSwitchToView: () => void;
  /** Called after successful save — parent triggers refetch + highlight */
  onSaved: (nodeId: string) => void;
}

interface AttrEditState {
  id: string;
  name: string;
  unit: string;
  description: string;
  sortOrder: number;
  dataType: string;
  // For simple suggest: pipe/comma-separated options edited as textarea
  // For depends_on: read-only
  validationType: 'none' | 'suggest' | 'depends_on';
  suggestOptions: string; // one option per line
  // Original validation_rules stored so we can reconstruct on save
  originalRules: AttributeDefinition['validation_rules'];
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ViewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M5 13l4 4L19 7" />
  </svg>
);

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

/** Parse attribute for edit state */
function attrToEditState(attr: AttributeDefinition): AttrEditState {
  const parsed = parseValidationRules(attr.validation_rules);
  let validationType: AttrEditState['validationType'] = 'none';
  let suggestOptions = '';

  if (parsed.dependsOn) {
    validationType = 'depends_on';
  } else if (parsed.type === 'suggest' || parsed.type === 'enum') {
    validationType = 'suggest';
    suggestOptions = parsed.options.join('\n');
  }

  return {
    id: attr.id,
    name: attr.name,
    unit: attr.unit ?? '',
    description: attr.description ?? '',
    sortOrder: attr.sort_order,
    dataType: attr.data_type,
    validationType,
    suggestOptions,
    originalRules: attr.validation_rules,
  };
}

/** Reconstruct validation_rules jsonb from edit state */
function buildValidationRules(
  state: AttrEditState,
): Record<string, unknown> {
  if (state.validationType === 'depends_on') {
    // Keep original — we don't edit DependsOn rules in this panel
    return (state.originalRules as Record<string, unknown>) ?? {};
  }
  if (state.validationType === 'suggest') {
    const options = state.suggestOptions
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return { type: 'suggest', suggest: options };
  }
  return {};
}

// --------------------------------------------------------
// Input component
// --------------------------------------------------------

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

function TextInput({ value, onChange, placeholder, className }: TextInputProps) {
  const t = THEME.structureEdit;
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2',
        t.ring,
        className,
      )}
    />
  );
}

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}

function NumberInput({ value, onChange, min = 0 }: NumberInputProps) {
  const t = THEME.structureEdit;
  return (
    <input
      type="number"
      value={value}
      min={min}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(
        'w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2',
        t.ring,
      )}
    />
  );
}

interface TextAreaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

function TextArea({ value, onChange, placeholder, rows = 3 }: TextAreaProps) {
  const t = THEME.structureEdit;
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white resize-none',
        'focus:outline-none focus:ring-2',
        t.ring,
      )}
    />
  );
}

// --------------------------------------------------------
// Attribute edit section
// --------------------------------------------------------

interface AttrEditSectionProps {
  attrs: AttrEditState[];
  onChange: (updated: AttrEditState[]) => void;
  hasEvents: boolean;
}

function AttrEditSection({ attrs, onChange, hasEvents }: AttrEditSectionProps) {
  const t = THEME.structureEdit;

  if (attrs.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-2">(no attributes at this level)</p>
    );
  }

  const update = (index: number, partial: Partial<AttrEditState>) => {
    const next = [...attrs];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {attrs.map((attr, i) => (
        <div
          key={attr.id}
          className={cn('rounded-lg border p-3', t.lightBorder, t.light)}
        >
          {/* Name row */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={attr.name}
                onChange={v => update(i, { name: v })}
                placeholder="Attribute name"
              />
            </div>
            <div>
              <FieldLabel>Sort</FieldLabel>
              <NumberInput
                value={attr.sortOrder}
                onChange={v => update(i, { sortOrder: v })}
                min={0}
              />
            </div>
          </div>

          {/* Unit + data_type row */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <FieldLabel>Unit</FieldLabel>
              <TextInput
                value={attr.unit}
                onChange={v => update(i, { unit: v })}
                placeholder="e.g. kg, min, km"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Data type</FieldLabel>
              <div className={cn(
                'px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50',
                'text-gray-500 flex items-center gap-1.5',
              )}>
                <span className="font-mono">{attr.dataType}</span>
                {hasEvents && (
                  <span className="text-xs text-amber-600">(has events — locked)</span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-3">
            <FieldLabel>Description</FieldLabel>
            <TextInput
              value={attr.description}
              onChange={v => update(i, { description: v })}
              placeholder="Optional description"
            />
          </div>

          {/* Suggest options */}
          {attr.validationType === 'suggest' && (
            <div>
              <FieldLabel>Suggest options (one per line)</FieldLabel>
              <TextArea
                value={attr.suggestOptions}
                onChange={v => update(i, { suggestOptions: v })}
                placeholder={'opt1\nopt2\nopt3'}
                rows={4}
              />
              <p className="mt-1 text-xs text-gray-400">
                One option per line. Empty lines are ignored.
              </p>
            </div>
          )}

          {/* DependsOn — read-only note */}
          {attr.validationType === 'depends_on' && (
            <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <p className="text-xs text-indigo-600">
                ⚠ This attribute has dependent dropdown configuration.
                Full editing of dependent options is planned for a future version.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function StructureNodeEditPanel({
  node,
  onClose,
  onSwitchToView,
  onSaved,
}: StructureNodeEditPanelProps) {
  const t = THEME.structureEdit;

  // ---- Node form state ----
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description ?? '');
  const [sortOrder, setSortOrder] = useState(node.sortOrder);

  // ---- Attribute edit states ----
  const [attrStates, setAttrStates] = useState<AttrEditState[]>(() =>
    node.attributeDefinitions.map(attrToEditState),
  );

  const [saving, setSaving] = useState(false);

  // ---- Save handler ----
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Update area or category
      if (node.nodeType === 'area') {
        const { error } = await supabase
          .from('areas')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            sort_order: sortOrder,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            sort_order: sortOrder,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      // 2. Update each attribute definition
      for (const attr of attrStates) {
        const newRules = buildValidationRules(attr);
        const { error } = await supabase
          .from('attribute_definitions')
          .update({
            name: attr.name.trim(),
            unit: attr.unit.trim() || null,
            description: attr.description.trim() || null,
            sort_order: attr.sortOrder,
            validation_rules: newRules,
            updated_at: new Date().toISOString(),
          })
          .eq('id', attr.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      toast.success('Saved successfully');
      onSaved(node.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [name, description, sortOrder, attrStates, node, onSaved]);

  const nodeTypeLabel = node.nodeType === 'area' ? 'Area' : node.isLeaf ? 'Leaf' : `L${node.level}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* ---- Sticky Header (amber) ---- */}
        <div className={cn('flex-shrink-0 px-5 py-3 rounded-t-xl', t.headerBg, t.headerText)}>
          <div className="flex items-center justify-between gap-3">

            {/* Left: X close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>

            {/* Center: title */}
            <div className="flex-1 min-w-0 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {nodeTypeLabel}
                </span>
                <span className="text-sm font-semibold truncate">{node.name}</span>
              </div>
            </div>

            {/* Right: ← View + Save */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSwitchToView}
                title="Back to View"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  t.accent,
                )}
              >
                <ViewIcon />
                <span className="hidden sm:inline">View</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  'bg-white text-amber-700 hover:bg-amber-50',
                  saving && 'opacity-60 cursor-not-allowed',
                )}
              >
                {saving ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <SaveIcon />
                )}
                <span>{saving ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ---- Body (scrollable) ---- */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Node fields section */}
          <div className={cn('rounded-lg border p-4', t.lightBorder)}>
            <h3 className={cn('text-xs font-semibold uppercase tracking-wide mb-4', t.lightText)}>
              {node.nodeType === 'area' ? 'Area' : 'Category'} details
            </h3>

            <div className="space-y-3">
              <div>
                <FieldLabel>Name</FieldLabel>
                <TextInput
                  value={name}
                  onChange={setName}
                  placeholder={node.nodeType === 'area' ? 'Area name' : 'Category name'}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Slug (URL identifier) is not changed when renaming.
                </p>
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={description}
                  onChange={setDescription}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div>
                <FieldLabel>Sort order</FieldLabel>
                <NumberInput value={sortOrder} onChange={setSortOrder} min={0} />
              </div>
            </div>
          </div>

          {/* Attributes section — only for Category nodes */}
          {node.nodeType === 'category' && (
            <div>
              <h3 className={cn('text-xs font-semibold uppercase tracking-wide mb-3', t.lightText)}>
                Attributes at this level
                <span className="ml-2 text-gray-400 font-normal normal-case">
                  ({attrStates.length})
                </span>
              </h3>
              <AttrEditSection
                attrs={attrStates}
                onChange={setAttrStates}
                hasEvents={node.eventCount > 0}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
