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
  slug: string;        // Stable identifier — never changed on update
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
  // true for newly added attrs not yet persisted (INSERT on Save)
  isNew?:     boolean;
  isRequired?: boolean; // only used for new attrs; maps to is_required column
}

interface NewAttrFormState {
  name: string;
  dataType: 'text' | 'number' | 'boolean' | 'datetime';
  unit: string;
  required: boolean;
}

interface DeleteConfirmState {
  attrId:    string;
  attrName:  string;
  checking:  boolean;
  eventCount: number | null;
  deleting:  boolean;
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
    slug: attr.slug,   // Preserved — never regenerated from name
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

/** Generate slug from name; appends _2, _3 if collision with existing slugs */
function generateSlug(name: string, existingSlugs: string[]): string {
  const base = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!existingSlugs.includes(base)) return base;
  let i = 2;
  while (existingSlugs.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
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
  attrs:     AttrEditState[];
  onChange:  (updated: AttrEditState[]) => void;
  hasEvents: boolean;
  nodeId:    string;
}

function AttrEditSection({ attrs, onChange, hasEvents, nodeId }: AttrEditSectionProps) {
  const t = THEME.structureEdit;

  const [addOpen,      setAddOpen]      = useState(false);
  const [newForm,      setNewForm]      = useState<NewAttrFormState>({ name: '', dataType: 'text', unit: '', required: false });
  const [deleteState,  setDeleteState]  = useState<DeleteConfirmState | null>(null);

  const update = (index: number, partial: Partial<AttrEditState>) => {
    const next = [...attrs];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  };

  // ── Delete flow ──────────────────────────────────────────
  const handleClickDelete = async (attr: AttrEditState) => {
    if (attr.isNew) {
      // Not in DB yet — just remove from local list
      onChange(attrs.filter(a => a.id !== attr.id));
      return;
    }
    setDeleteState({ attrId: attr.id, attrName: attr.name, checking: true, eventCount: null, deleting: false });
    const { count } = await supabase
      .from('event_attributes')
      .select('id', { count: 'exact', head: true })
      .eq('attribute_definition_id', attr.id);
    setDeleteState(prev => prev ? { ...prev, checking: false, eventCount: count ?? 0 } : null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteState) return;
    setDeleteState(prev => prev ? { ...prev, deleting: true } : null);
    try {
      if ((deleteState.eventCount ?? 0) > 0) {
        const { error: e1 } = await supabase
          .from('event_attributes')
          .delete()
          .eq('attribute_definition_id', deleteState.attrId);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from('attribute_definitions')
        .delete()
        .eq('id', deleteState.attrId);
      if (e2) throw e2;
      onChange(attrs.filter(a => a.id !== deleteState.attrId));
      toast.success(`Attribute "${deleteState.attrName}" deleted`);
      setDeleteState(null);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Delete failed';
      toast.error(msg);
      setDeleteState(prev => prev ? { ...prev, deleting: false } : null);
    }
  };

  // ── Add Attribute ──────────────────────────────────────────
  const handleAddAttr = () => {
    if (!newForm.name.trim()) return;
    const existingSlugs = attrs.map(a => a.slug);
    const slug = generateSlug(newForm.name.trim(), existingSlugs);
    const maxSort = attrs.length > 0 ? Math.max(...attrs.map(a => a.sortOrder)) + 1 : 0;
    const newAttrState: AttrEditState = {
      id:            `new_${Date.now()}`,
      slug,
      name:          newForm.name.trim(),
      unit:          newForm.unit.trim(),
      description:   '',
      sortOrder:     maxSort,
      dataType:      newForm.dataType,
      validationType: 'none',
      suggestOptions: '',
      originalRules: {},
      isNew:         true,
      isRequired:    newForm.required,
    };
    onChange([...attrs, newAttrState]);
    setNewForm({ name: '', dataType: 'text', unit: '', required: false });
    setAddOpen(false);
  };

  // ── Delete confirm modal (inline) ──────────────────────────
  const DeleteConfirmPanel = deleteState && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Delete attribute "{deleteState.attrName}"?
        </h3>
        {deleteState.checking ? (
          <p className="text-xs text-gray-500">Checking for existing data…</p>
        ) : (deleteState.eventCount ?? 0) > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 font-medium">
              ⚠ This attribute has <strong>{deleteState.eventCount}</strong> recorded value{deleteState.eventCount !== 1 ? 's' : ''}.
              Deleting will permanently remove all recorded data for this attribute.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">This attribute has no recorded values. It will be deleted immediately.</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteState(null)}
            disabled={deleteState.deleting}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={deleteState.checking || deleteState.deleting}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleteState.deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Add Attribute inline form ─────────────────────────────
  const AddAttrForm = addOpen && (
    <div className={cn('rounded-lg border p-3 mt-3', 'border-dashed border-amber-300 bg-amber-50')}>
      <p className="text-xs font-semibold text-amber-700 mb-3">New attribute</p>
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <FieldLabel>Name *</FieldLabel>
          <TextInput
            value={newForm.name}
            onChange={v => setNewForm(f => ({ ...f, name: v }))}
            placeholder="Attribute name"
          />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <select
            value={newForm.dataType}
            onChange={e => setNewForm(f => ({ ...f, dataType: e.target.value as NewAttrFormState['dataType'] }))}
            className={cn('px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2', t.ring)}
          >
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="datetime">datetime</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mb-2 items-end">
        <div className="flex-1">
          <FieldLabel>Unit</FieldLabel>
          <TextInput
            value={newForm.unit}
            onChange={v => setNewForm(f => ({ ...f, unit: v }))}
            placeholder="e.g. kg, km"
          />
        </div>
        <label className="flex items-center gap-1.5 pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={newForm.required}
            onChange={e => setNewForm(f => ({ ...f, required: e.target.checked }))}
            className="accent-amber-600"
          />
          <span className="text-xs text-gray-600">Required</span>
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setAddOpen(false); setNewForm({ name: '', dataType: 'text', unit: '', required: false }); }}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleAddAttr}
          disabled={!newForm.name.trim()}
          className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );

  void nodeId; // used for potential future attr-level operations

  return (
    <div className="space-y-4">
      {DeleteConfirmPanel}

      {attrs.length === 0 && !addOpen && (
        <p className="text-sm text-gray-400 italic py-2">(no attributes at this level)</p>
      )}

      {attrs.map((attr, i) => (
        <div
          key={attr.id}
          className={cn('rounded-lg border p-3', attr.isNew ? 'border-amber-300 bg-amber-50' : cn(t.lightBorder, t.light))}
        >
          {/* Name row + Delete button */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <FieldLabel>Name{attr.isNew && <span className="ml-1 text-amber-500">(new)</span>}</FieldLabel>
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
            <div className="flex items-end pb-0.5">
              <button
                onClick={() => handleClickDelete(attr)}
                title="Delete attribute"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
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
                {hasEvents && !attr.isNew && (
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

          {/* Text → Suggest conversion button */}
          {attr.dataType === 'text' && attr.validationType === 'none' && (
            <div className="mb-3">
              <button
                onClick={() => update(i, { validationType: 'suggest' })}
                className="text-xs px-2.5 py-1 rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Convert to suggest type — adds dropdown with free text input"
              >
                → Suggest
              </button>
            </div>
          )}

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

      {/* Add Attribute form / button */}
      {AddAttrForm}
      {!addOpen && (
        <button
          onClick={() => setAddOpen(true)}
          className={cn(
            'w-full py-2 text-xs font-medium rounded-lg border border-dashed transition-colors',
            'border-amber-300 text-amber-600 hover:bg-amber-50',
          )}
        >
          + Add Attribute
        </button>
      )}
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
      // NOTE: user_id included in payload (not in WHERE) so rows imported from
      // Streamlit with null user_id get ownership claimed on first save.
      // RLS allows update when auth.uid() matches the row's user_id OR when
      // the row has no user_id yet (template/import data).
      if (node.nodeType === 'area') {
        const { error } = await supabase
          .from('areas')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            sort_order: sortOrder,
            user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            sort_order: sortOrder,
            user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id);
        if (error) throw error;
      }

      // 2. Update existing + INSERT new attribute definitions
      for (const attr of attrStates) {
        const newRules = buildValidationRules(attr);

        if (attr.isNew) {
          const { error } = await supabase
            .from('attribute_definitions')
            .insert({
              category_id:      node.id,
              name:             attr.name.trim(),
              slug:             attr.slug,
              data_type:        attr.dataType,
              unit:             attr.unit.trim() || null,
              description:      attr.description.trim() || null,
              sort_order:       attr.sortOrder,
              validation_rules: newRules,
              is_required:      attr.isRequired ?? false,
              user_id:          user.id,
            });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attribute_definitions')
            .update({
              name:             attr.name.trim(),
              unit:             attr.unit.trim() || null,
              description:      attr.description.trim() || null,
              sort_order:       attr.sortOrder,
              validation_rules: newRules,
              user_id:          user.id,
              updated_at:       new Date().toISOString(),
            })
            .eq('id', attr.id);
          if (error) throw error;
        }
      }

      toast.success('Saved successfully');
      onSaved(node.id);
    } catch (err) {
      console.error('Save error (full):', err);
      // PostgrestError from Supabase is not instanceof Error — extract message manually
      const message =
        (err as { message?: string })?.message ??
        (typeof err === 'string' ? err : 'Save failed');
      toast.error(message);
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
                nodeId={node.id}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
