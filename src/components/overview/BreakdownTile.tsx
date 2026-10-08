// ============================================================
// BreakdownTile.tsx — „Kamo ide novac" (pločica razreza)
// ============================================================
// Spec: docs/RAZREZ_SPEC.md §2 (izgled), §12.2 (pločica), §12.3 (drill).
//
// Jedan raspored na obje širine (§2.1): sažetak, prekidači, lista. Razlikuje se
// samo CRTEŽ — krug tek od 640 px. Lista je ista komponenta i na mobitelu i uz
// krug, pa se brojke ne mogu razići (CLAUDE.md „ista radnja na dvije širine").
//
// ⚠ SVE BROJKE IZ `buildBreakdown` — ovdje se ništa ne zbraja. Pločica samo
//   prikazuje model i bira što će pitati RPC.
//
// ⚠ RAZDOBLJE = FILTAR, UKLJUČIVO S OBJE STRANE. Pločica ne pamti svoj period;
//   ista pločica odgovara na rujan i na cijelu godinu.
// ============================================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { formatAmount, formatDateHr, formatSigned } from '@/lib/amountFormat';
import { fetchBreakdown } from '@/lib/overviewApi';
import {
  ambiguousValues, breakdownDims, buildBreakdown, drillFor,
  type BreakdownNode, type BreakdownRow,
} from '@/lib/breakdownModel';
import { BreakdownSunburst } from './BreakdownSunburst';
import type { BreakdownWidget, Grouping, UUID } from '@/types/database';

const T = THEME.overview;

interface Props {
  areaId: UUID;
  widget: BreakdownWidget;
  /** `settings.groupings[widget.grouping]`; undefined = nema ga. */
  grouping?: Grouping;
  dateFrom: string | null;
  dateTo: string | null;
  onDrill: (slug: string, value: string) => void;
  /** Harmonika na Overviewu (S166): stanje drži OverviewTab, ne preglednik. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface Loaded {
  /** Za KOJI ulaz je ovo odgovor (S145/S159: `loaded` je tvrdnja o ulazu). */
  key: string;
  rows: BreakdownRow[];
  /** `options_map` razine 2; `null` = nije se dalo pročitati. */
  optionsMap: Record<string, string[]> | null;
  error: string | null;
}

function useWide(): boolean {
  const q = '(min-width: 640px)';
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/** `01.09.–30.09.2026.` ili `01.09.2025.–30.09.2026.` */
function periodLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'cijelo razdoblje';
  if (!from) return `do ${formatDateHr(to!)}`;
  if (!to) return `od ${formatDateHr(from)}`;
  const f = formatDateHr(from), t = formatDateHr(to);
  return from.slice(0, 4) === to.slice(0, 4) ? `${f.slice(0, 6)}–${t}` : `${f}–${t}`;
}

export function BreakdownTile({ areaId, widget, grouping, dateFrom, dateTo, onDrill, collapsed, onToggleCollapsed }: Props) {
  const wide = useWide();
  const axes = useMemo(
    () => (widget.date_axes?.length ? widget.date_axes : [{ label: 'po datumu', slug: null }]),
    [widget.date_axes],
  );
  const dims = useMemo(() => breakdownDims(widget), [widget]);

  const [side, setSide] = useState<'expense' | 'income'>('expense');
  const [axisIdx, setAxisIdx] = useState(0);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // Sklopiva (§5). Do S166 se pamtila po pregledniku; sada je harmonika s
  // pločicom salda u OverviewTab-u — zadano ZATVORENA (zatvorena ništa ne računa).

  const axis = axes[Math.min(axisIdx, axes.length - 1)];
  const inputKey = `${areaId}|${dateFrom}|${dateTo}|${axis.slug}|${dims.join(',')}|${reload}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (collapsed) return;
    let cancelled = false;
    (async () => {
      const level2 = widget.levels[1];
      // Dvoznačni Podtipovi (drill §12.3) dolaze iz `validation_rules`. Ako se
      // ne daju pročitati, drill ide na Tip — nikad na krivi Podtip.
      const rulesP = level2
        ? Promise.resolve(
            supabase.from('attribute_definitions')
              .select('validation_rules, categories!inner(area_id)')
              .eq('slug', level2).eq('categories.area_id', areaId).limit(1),
          ).then(({ data, error }) => {
            if (error || !data?.length) return null;
            const vr = data[0].validation_rules as { depends_on?: { options_map?: Record<string, string[]> } } | null;
            return vr?.depends_on?.options_map ?? {};
          }).catch(() => null)
        : Promise.resolve({});
      try {
        const [rows, optionsMap] = await Promise.all([
          fetchBreakdown({
            areaId, groupSlugs: dims, plusSlug: widget.plus, minusSlug: widget.minus,
            dateSlug: axis.slug, dateFrom, dateTo,
          }),
          rulesP,
        ]);
        if (!cancelled) setLoaded({ key: inputKey, rows, optionsMap, error: null });
      } catch (e) {
        if (!cancelled) {
          setLoaded({ key: inputKey, rows: [], optionsMap: null, error: (e as Error)?.message ?? String(e) });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [inputKey, collapsed, areaId, dims, widget.levels, widget.plus, widget.minus, axis.slug, dateFrom, dateTo]);

  const fresh = loaded?.key === inputKey;
  const model = useMemo(
    () => (loaded && !loaded.error ? buildBreakdown(loaded.rows, widget, grouping) : null),
    [loaded, widget, grouping],
  );
  const ambiguous = useMemo(() => {
    if (!loaded || loaded.optionsMap === null) return null;     // ne znam ⇒ v. drill
    return ambiguousValues(loaded.optionsMap, loaded.rows, 0, 1);
  }, [loaded]);

  const axisIsEventDate = axis.slug == null;
  const root = model ? (side === 'expense' ? model.expense : model.income) : null;
  const maxAbs = root ? Math.max(1, ...root.children.map(c => Math.abs(c.cents))) : 1;
  const unit = widget.unit;
  const money = (cents: number) => formatAmount(cents / 100, unit);

  const drillTarget = (nd: BreakdownNode) => {
    // Nepoznata dvoznačnost ⇒ svaki Podtip tretiraj kao dvoznačan (bez drilla dok se ne zna).
    const amb = ambiguous ?? new Set(nd.values?.filter((v): v is string => !!v) ?? []);
    return drillFor(nd, widget, { axisIsEventDate, ambiguous: amb });
  };
  const drill = (nd: BreakdownNode) => {
    const t = drillTarget(nd);
    if ('none' in t) { toast(t.none); return; }
    onDrill(t.slug, t.value);
  };

  const toggle = (id: string) => setOpen(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const renderRow = (nd: BreakdownNode, depth: number): ReactNode => {
    const hasKids = nd.children.length > 0;
    const isOpen = open.has(nd.id);
    const neg = nd.cents < 0;
    // Isti izvor kao klik: strelica postoji točno kad drill postoji.
    const target = axisIsEventDate && nd.kind === 'level' ? drillTarget(nd) : null;
    const canDrill = target != null && !('none' in target);
    const special = nd.kind === 'unclassified' || nd.kind === 'unassigned';
    return (
      <li key={nd.id}>
        <div className={cn('flex items-center gap-2 py-1.5 text-sm', depth > 0 && 'text-[13px]')}
             style={{ paddingLeft: depth * 14 }}>
          <button
            type="button"
            onClick={() => hasKids && toggle(nd.id)}
            className={cn('flex-1 min-w-0 text-left flex items-center gap-1', hasKids ? 'cursor-pointer' : 'cursor-default')}
            title={hasKids ? (isOpen ? 'Sklopi' : 'Rasklopi') : undefined}
          >
            <span className="w-3 shrink-0 text-gray-400 text-xs">{hasKids ? (isOpen ? '▾' : '▸') : ''}</span>
            <span className={cn('min-w-0 break-words leading-tight', depth === 0 && 'font-medium text-gray-900',
              special && 'italic text-gray-600', nd.kind === 'adjustment' && 'italic')}>
              {nd.name}
            </span>
            {neg && side === 'expense' && nd.kind === 'level' && (
              <span className="shrink-0 text-[10px] text-emerald-700 bg-emerald-50 rounded px-1">povrat &gt; trošak</span>
            )}
          </button>
          <div className="w-10 sm:w-20 shrink-0 h-1.5 bg-gray-100 rounded">
            <div className={cn('h-1.5 rounded', neg ? 'bg-emerald-400' : 'bg-teal-500')}
                 style={{ width: `${Math.min(100, (Math.abs(nd.cents) / maxAbs) * 100)}%` }} />
          </div>
          <span className={cn('w-24 sm:w-28 shrink-0 text-right tabular-nums',
            neg ? 'text-emerald-700' : 'text-gray-900', depth === 0 && 'font-medium')}>
            {neg ? formatSigned(nd.cents / 100, unit) : money(nd.cents)}
          </span>
          <button
            type="button"
            onClick={() => drill(nd)}
            disabled={!canDrill}
            className={cn('w-6 shrink-0 text-xs rounded', canDrill
              ? 'text-teal-600 hover:bg-teal-50' : 'text-transparent cursor-default')}
            title={canDrill ? `Prikaži retke (${nd.n}) u Activities`
              : target && 'none' in target ? target.none : undefined}
            aria-label={canDrill ? `Prikaži retke za ${nd.name}` : undefined}
          >
            ↗
          </button>
        </div>
        {hasKids && isOpen && (
          <ul>{nd.children.map(c => renderRow(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border p-3 sm:p-4', T.tileBorder)}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onToggleCollapsed} className="min-w-0 text-left">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
            <span className="text-gray-400 text-xs mr-1">{collapsed ? '▸' : '▾'}</span>
            {widget.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{periodLabel(dateFrom, dateTo)} · iz filtra</p>
        </button>
        {!collapsed && (
          <button
            onClick={() => setReload(r => r + 1)}
            disabled={!fresh}
            title="Osvježi"
            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 px-2 py-1"
          >
            {fresh ? '↻' : '…'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mt-3">
          {loaded?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="font-medium">Pločica se ne može izračunati.</p>
              <p className="mt-1 font-mono text-xs break-words">{loaded.error}</p>
            </div>
          )}
          {model && model.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-2">
              <p className="font-medium">Greška u postavkama pločice — prikazujem bez bucketa:</p>
              <ul className="mt-1 text-xs list-disc pl-4">
                {model.errors.map(e => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
          {!loaded && <p className="text-sm text-gray-400 py-4">Računam…</p>}

          {model && root && (
            <div className={cn(!fresh && 'opacity-50 transition-opacity')}>
              {/* Sažetak — uvijek vidljiv, uz oba prekidača (§2.1). */}
              <p className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>Ušlo <b className="tabular-nums">{money(model.totals.inCents)}</b></span>
                <span>Izašlo <b className="tabular-nums">{money(model.totals.outCents)}</b></span>
                <span>Razlika <b className={cn('tabular-nums', model.totals.diffCents < 0 ? T.amountNeg : T.amountPos)}>
                  {formatSigned(model.totals.diffCents / 100, unit)}</b></span>
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Segmented
                  value={side}
                  options={[['expense', 'Troškovi'], ['income', 'Prihodi']]}
                  onChange={v => setSide(v as 'expense' | 'income')}
                />
                {axes.length > 1 && (
                  <Segmented
                    value={String(axisIdx)}
                    options={axes.map((a, i) => [String(i), a.label])}
                    onChange={v => setAxisIdx(Number(v))}
                  />
                )}
                {side === 'expense' && model.bucketsApplied && widget.grouping && (
                  <span className="text-xs text-gray-500">grupirano: {widget.grouping}</span>
                )}
              </div>

              {!fresh && <p className="text-xs text-gray-400 mt-1">Računam…</p>}

              {root.children.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">Nema zapisa u razdoblju.</p>
              ) : (
                <div className={cn('mt-2', wide && 'grid grid-cols-2 gap-4 items-start')}>
                  {wide && <BreakdownSunburst root={root} unit={unit} />}
                  <ul className="divide-y divide-gray-50">
                    {root.children.map(c => renderRow(c, 0))}
                  </ul>
                </div>
              )}

              {/* Podnožje: izvan razreza — nikad skriveno (§2.1). */}
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
                {(model.outside.plusCents !== 0 || model.outside.minusCents !== 0) && (
                  <p title="Novac je prošao, nije potrošen ni zarađen (prijenosi među računima, podizanje gotovine). Saldo ga broji, razrez ne.">
                    izvan razreza ({(widget.outside ?? []).flatMap(f => f.values).join(', ')}):
                    ušlo <span className="tabular-nums">{money(model.outside.plusCents)}</span> ·
                    izašlo <span className="tabular-nums">{money(model.outside.minusCents)}</span> ⓘ
                  </p>
                )}
                {model.nNoDate > 0 && (
                  <p className="text-amber-700">
                    {model.nNoDate} redaka bez datuma za os „{axis.label}" — nisu u zbroju.
                  </p>
                )}
                {!axisIsEventDate && (
                  <p>↗ (prikaz redaka) radi samo „{axes[0].label}" — filtar ne zna raspon ove osi.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn('px-2.5 py-1 rounded-md', v === value ? T.tabActive : 'text-gray-600 hover:bg-gray-50')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
