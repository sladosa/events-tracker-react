// CatalogPickerField — polje čije opcije su zapisi DRUGE Aree (`options_from`, S190).
//
// Tok (Saša, 31.10.): dodir na polje ⇒ izbornik po skupinama (otvorena skupina trenutne
// vrijednosti); u skupini najčešće u zadnjih 12 mj, najviše 6 + „Sve"; dodir na vježbu ⇒
// KARTICA (slike, opis); tek „Izaberi" upisuje vrijednost. Vlasnik kataloga u kartici ima
// „Uredi vježbu" — ime, skupine, opis… bez izlaska iz forme. Ključ (slug) se ondje ne mijenja.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AttributeDefinition } from '@/types';
import type { OptionsFrom } from '@/lib/optionsFrom';
import { loadCatalog, loadUsage, saveCatalogItem, type Catalog } from '@/lib/catalogOptions';
import { TOP_N, NO_GROUP, initialGroup, itemByValue, pickerGroups, type CatalogItem, type Usage } from '@/lib/catalogPicker';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';
import { useBackdropClose } from '@/hooks/useBackdropClose';
import { todayLocalYmd } from '@/lib/localDate';
import { PhotoCarousel } from './PhotoCarousel';

const PALETTE = ['#e0612a', '#5b5bd6', '#0e8f8f', '#3f8f3a', '#a26fc4', '#c79a12', '#d14b8f', '#4b8fd1'];

interface Props {
  definition: AttributeDefinition;
  optionsFrom: OptionsFrom;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

type View = { kind: 'list' } | { kind: 'card'; item: CatalogItem } | { kind: 'edit'; item: CatalogItem };

export function CatalogPickerField({ definition, optionsFrom, value, onChange, disabled }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Map<string, Usage>>(new Map());
  const [view, setView] = useState<View | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState<string | null>(null);

  // Ključ, ne objekt: pravilo se čita iz `validation_rules` i zna doći kao nov objekt na
  // svakom renderu — efekt na objektu bi učitavao u krug.
  const ofKey = JSON.stringify(optionsFrom);
  useEffect(() => {
    let alive = true;
    loadCatalog(JSON.parse(ofKey) as OptionsFrom)
      .then(c => { if (alive) { setCatalog(c); setLoadError(null); } })
      .catch(e => { if (alive) setLoadError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [ofKey]);

  const current = itemByValue(catalog?.items ?? [], value);
  const groupColor = useCallback((g: string | null) => {
    if (!g || !catalog) return '#9aa6b6';
    const all = [...catalog.groupOrder, ...catalog.items.map(i => i.group).filter((x): x is string => !!x)];
    const idx = [...new Set(all)].indexOf(g);
    return PALETTE[idx % PALETTE.length];
  }, [catalog]);

  const open = () => {
    if (disabled) return;
    setOpenGroup(initialGroup(catalog?.items ?? [], value));
    setShowAll(new Set());
    setJustSaved(null);
    setView({ kind: 'list' });
    loadUsage(definition.id).then(setUsage).catch(() => setUsage(new Map()));   // bez korištenja = abecedno
  };
  const close = () => setView(null);

  const groups = useMemo(
    () => (catalog ? pickerGroups(catalog.items, usage, catalog.groupOrder, todayLocalYmd()) : []),
    [catalog, usage],
  );

  const pick = (it: CatalogItem) => { onChange(it.value); close(); };

  // ── polje u formi
  const field = (
    <button
      type="button"
      onClick={open}
      disabled={disabled || (!catalog && !loadError)}
      className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-left hover:bg-gray-50 disabled:bg-gray-100"
    >
      {current?.photos[0] ? (
        <img src={current.photos[0].url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
      ) : (
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: groupColor(current?.group ?? null) }} />
      )}
      <span className="min-w-0 truncate">
        {current ? current.label
          : value ? <span className="text-amber-700">{value} <span className="text-xs">(nije u katalogu)</span></span>
          : <span className="text-gray-400">{catalog ? `Izaberi ${definition.name}…` : 'Učitavam katalog…'}</span>}
      </span>
      <span className="ml-auto text-gray-400">›</span>
    </button>
  );

  return (
    <>
      {field}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}
      {view && catalog && (
        <Sheet onClose={close}>
          {view.kind === 'list' && (
            <>
              <SheetHeader title={definition.name} action="Zatvori" onAction={close} />
              <div>
                {groups.map(g => {
                  const isOpen = openGroup === g.key;
                  const shown = showAll.has(g.key) ? g.items : g.items.slice(0, TOP_N);
                  const color = groupColor(g.key || null);
                  return (
                    <div key={g.key || '_none'}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenGroup(isOpen ? null : g.key)}
                        className="w-full grid grid-cols-[10px_1fr_auto] gap-2.5 items-center px-3.5 py-2.5 text-left border-b"
                        style={isOpen ? { borderBottom: `2px solid ${color}`, background: `${color}12` } : undefined}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span className="font-semibold">{g.key === NO_GROUP ? 'Bez skupine' : g.key}</span>
                        <span className="text-xs text-gray-500 text-right leading-tight">
                          {g.daysSince === null ? 'nije u 12 mj' : g.daysSince === 0 ? 'zadnje danas' : `zadnje prije ${g.daysSince} d`}
                          <br />{g.items.length} {g.items.length === 1 ? 'zapis' : 'zapisa'}
                        </span>
                      </button>
                      {isOpen && shown.map(it => {
                        const u = usage.get(it.value);
                        return (
                          <button
                            key={it.eventId}
                            type="button"
                            onClick={() => setView({ kind: 'card', item: it })}
                            className={`w-full grid grid-cols-[44px_1fr_auto] gap-2.5 items-center px-3.5 py-1.5 border-b text-left hover:bg-gray-50 ${it.value === value ? 'bg-blue-50' : ''} ${justSaved === it.eventId ? 'shadow-[inset_4px_0_0_#15803d]' : ''}`}
                          >
                            <span className="w-11 h-11 rounded-lg border bg-gray-50 overflow-hidden grid place-items-center relative">
                              {it.photos[0]
                                ? <img src={it.photos[0].url} alt="" className="w-full h-full object-cover" />
                                : <span className="w-3 h-3 rounded-full" style={{ background: color }} />}
                              {it.photos.length > 1 && (
                                <span className="absolute right-0.5 bottom-0 text-[10px] font-bold bg-white rounded px-0.5">{it.photos.length}</span>
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold truncate">{it.label}</span>
                              <span className="block text-xs text-gray-500">
                                {u ? `${u.days12}× u 12 mj` : 'nije rađeno 12 mj'}
                                {it.group2 ? ` · + ${it.group2}` : ''}
                              </span>
                            </span>
                            <span className="text-gray-400 text-xl">›</span>
                          </button>
                        );
                      })}
                      {isOpen && g.items.length > TOP_N && (
                        <button
                          type="button"
                          onClick={() => setShowAll(prev => {
                            const next = new Set(prev);
                            if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                            return next;
                          })}
                          className="w-full text-left px-3.5 py-2 text-sm font-semibold text-blue-600 bg-gray-50 border-b"
                        >
                          {showAll.has(g.key) ? 'Samo najčešće' : `Sve (${g.items.length})`}
                        </button>
                      )}
                    </div>
                  );
                })}
                {groups.length === 0 && <p className="p-4 text-sm text-gray-500">Katalog „{catalog.areaName}" je prazan.</p>}
              </div>
            </>
          )}
          {view.kind === 'card' && (
            <ItemCard
              item={view.item}
              catalog={catalog}
              optionsFrom={optionsFrom}
              groupColor={groupColor}
              saved={justSaved === view.item.eventId}
              onBack={() => setView({ kind: 'list' })}
              onPick={() => pick(view.item)}
              onEdit={() => setView({ kind: 'edit', item: view.item })}
            />
          )}
          {view.kind === 'edit' && (
            <ItemEdit
              item={view.item}
              catalog={catalog}
              optionsFrom={optionsFrom}
              onCancel={() => setView({ kind: 'card', item: view.item })}
              onSaved={async () => {
                const fresh = await loadCatalog(optionsFrom, true);
                setCatalog(fresh);
                const it = fresh.items.find(i => i.eventId === view.item.eventId) ?? view.item;
                setJustSaved(it.eventId);
                setOpenGroup(it.group ?? NO_GROUP);          // izbornik se vraća na skupinu u koju je otišla
                setView({ kind: 'card', item: it });
              }}
            />
          )}
        </Sheet>
      )}
    </>
  );
}

// ── okvir prozora
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const backdrop = useBackdropClose(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-3" {...backdrop}>
      <div role="dialog" aria-modal="true" className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-auto shadow-xl">
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="sticky top-0 z-10 bg-white flex items-center justify-between gap-2 px-3.5 py-2.5 border-b">
      <h2 className="font-semibold text-lg leading-tight">{title}</h2>
      <button type="button" onClick={onAction} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 shrink-0">
        {action}
      </button>
    </div>
  );
}

// ── kartica: slike, skupine, ostali atributi; „Uredi" (vlasnik), „Izaberi"
function ItemCard({ item, catalog, optionsFrom, groupColor, saved, onBack, onPick, onEdit }: {
  item: CatalogItem; catalog: Catalog; optionsFrom: OptionsFrom; groupColor: (g: string | null) => string;
  saved: boolean; onBack: () => void; onPick: () => void; onEdit: () => void;
}) {
  const skip = new Set([optionsFrom.attribute, optionsFrom.label, optionsFrom.group, optionsFrom.group2].filter(Boolean) as string[]);
  const chips: string[] = [];
  const paragraphs: { name: string; text: string }[] = [];
  for (const d of catalog.defs) {
    if (skip.has(d.slug)) continue;
    const v = item.values[d.slug];
    if (v == null || v === '' || v === false) continue;          // „po ruci" samo kad vrijedi
    if (v === true) chips.push(d.name);
    else if (typeof v === 'string' && (v.length > 40 || v.includes('\n'))) paragraphs.push({ name: d.name, text: v });
    else chips.push(d.data_type === 'number' ? `${d.name}: ${v}${d.unit ? ' ' + d.unit : ''}` : String(v));
  }
  return (
    <>
      <SheetHeader title={item.label} action="Natrag" onAction={onBack} />
      <div className="p-3.5 space-y-2.5">
        {item.photos.length > 0
          ? <PhotoCarousel key={item.eventId} photos={item.photos} />
          : <p className="text-xs text-gray-400 italic">Nema slike.</p>}
        <div className="flex flex-wrap gap-1.5">
          {[item.group, item.group2].filter(Boolean).map(g => (
            <span key={g} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              <span className="w-2 h-2 rounded-full" style={{ background: groupColor(g) }} />{g}
            </span>
          ))}
          {chips.map(c => <span key={c} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c}</span>)}
        </div>
        {paragraphs.map(p => <p key={p.name} className="text-sm whitespace-pre-line">{p.text}</p>)}
        <p className="text-xs text-gray-500">{optionsFrom.attribute} <span className="font-mono">{item.value}</span></p>
        {saved && <p className="text-sm font-semibold text-green-700">Spremljeno u katalog.</p>}
        <div className="flex justify-between gap-2 pt-1">
          {catalog.canEdit
            ? <button type="button" onClick={onEdit} className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-amber-50 border border-amber-400">Uredi vježbu</button>
            : <span />}
          <button type="button" onClick={onPick} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white">Izaberi</button>
        </div>
      </div>
    </>
  );
}

// ── uređivanje zapisa kataloga iz kartice
function ItemEdit({ item, catalog, optionsFrom, onCancel, onSaved }: {
  item: CatalogItem; catalog: Catalog; optionsFrom: OptionsFrom; onCancel: () => void; onSaved: () => Promise<void>;
}) {
  type Val = string | number | boolean | null;
  const [draft, setDraft] = useState<Record<string, Val>>(() => ({ ...item.values }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = catalog.defs.filter(d => d.slug !== optionsFrom.attribute);
  const set = (slug: string, v: Val) => setDraft(prev => ({ ...prev, [slug]: v }));

  const save = async () => {
    const missing = editable.filter(d => d.is_required && (draft[d.slug] == null || draft[d.slug] === '')).map(d => d.name);
    if (missing.length) { setError(`Obavezno: ${missing.join(', ')}`); return; }
    const changes: Record<string, Val> = {};
    for (const d of editable) {
      const before = item.values[d.slug] ?? null, after = draft[d.slug] ?? null;
      if ((before ?? '') !== (after ?? '')) changes[d.slug] = after;
    }
    if (Object.keys(changes).length === 0) { onCancel(); return; }
    setSaving(true);
    setError(null);
    try {
      await saveCatalogItem(optionsFrom, catalog, item, changes);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg';
  return (
    <>
      <SheetHeader title="Uredi vježbu" action="Odustani" onAction={onCancel} />
      <div className="p-3.5 space-y-3">
        <div>
          <p className="text-sm font-semibold">{catalog.defs.find(d => d.slug === optionsFrom.attribute)?.name ?? optionsFrom.attribute}</p>
          <p className="text-xs text-gray-500"><span className="font-mono">{item.value}</span> · mijenja se alatom za preuređivanje (nalazi se u svakom zapisu koji ga koristi)</p>
        </div>
        {editable.map(d => {
          const v = draft[d.slug];
          const opts = parseValidationRules(d.validation_rules).options;
          return (
            <label key={d.id} className="block space-y-1">
              <span className="text-sm font-semibold">{d.name}{d.is_required && <span className="text-red-500 ml-0.5">*</span>}</span>
              {d.data_type === 'boolean' ? (
                <span className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={v === true} onChange={e => set(d.slug, e.target.checked)} className="w-5 h-5" /> Da
                </span>
              ) : opts.length > 0 ? (
                <select value={v == null ? '' : String(v)} onChange={e => set(d.slug, e.target.value || null)} className={input}>
                  <option value="">—</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  {v != null && v !== '' && !opts.includes(String(v)) && <option value={String(v)}>{String(v)}</option>}
                </select>
              ) : d.data_type === 'number' ? (
                <input type="text" inputMode="decimal" value={v == null ? '' : String(v)}
                  onChange={e => { const t = e.target.value.replace(',', '.'); set(d.slug, t === '' ? null : (Number.isFinite(Number(t)) ? Number(t) : t)); }}
                  className={input} />
              ) : (
                <textarea
                  rows={d.slug === optionsFrom.label ? 1 : 3}
                  value={v == null ? '' : String(v)}
                  onChange={e => set(d.slug, e.target.value)}
                  className={`${input} resize-y`}
                />
              )}
            </label>
          );
        })}
        <p className="text-xs text-gray-500">
          Slike se dodaju u Editu zapisa kataloga (Area „{catalog.areaName}").
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50">
            {saving ? 'Spremam…' : 'Spremi'}
          </button>
        </div>
      </div>
    </>
  );
}
