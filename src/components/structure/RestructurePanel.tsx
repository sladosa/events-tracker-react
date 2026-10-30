// ============================================================
// RestructurePanel.tsx — faza „Preuređivanje" u Structure uvozu (F1, S179)
// ============================================================
// Prikazuje se POSLIJE ostatka uvoza (§1–§11), kad file nosi popunjen sheet
// `Preuređivanje`. Redom: pregled (snimka + planer, ništa se ne piše) →
// kvačica → Primijeni → rezultat s ponovnim mjerenjem → Poništi.
//
// ⚠ Pregled se računa NAKON uvoza, ne iz filea: korak smije koristiti atribut
//   koji je isti uvoz tek stvorio (`namjena`), a brojke moraju biti brojke baze.
// ⚠ Greške gase Primijeni — `plan.rpc` je tada null, pa ni gumb ne bi imao što
//   poslati; gašenje samo kaže zašto.
// ⚠ Natpisi i poruke planera su engleski (konfiguracijska ploha, S189); vrijednosti
//   koje poruke citiraju ostaju kakve jesu u bazi (hrvatske u Financijama).
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatAmount, formatDateHr } from '@/lib/amountFormat';
import {
  applyRestructure, previewRestructure, undoRestructure,
  type ApplyResult, type RestructurePreview, type UndoResult, type Verification,
} from '@/lib/restructure/apply';
import type { RestructureStep, StepValue } from '@/lib/restructure/plan';
import { EMPTY_TOKEN } from '@/lib/restructure/sheet';
import type { ImportResult } from '@/lib/structureImport';

const clean = (c: Verification) => c.rowDiffs === 0 && c.configDiffs === 0;

/** Ponovno mjerenje: baza = očekivano (predviđanje pregleda, ili stanje prije). */
export function CheckLine({ check, what }: { check: Verification; what: string }) {
  return clean(check) ? (
    <p data-testid="restructure-check">
      Re-measure: the database is exactly what {what} ✓
      <span className="opacity-70"> ({fmtNum(check.rowsChecked)} rows, {check.configChecked} settings · {(check.ms / 1000).toFixed(1)} s)</span>
    </p>
  ) : (
    <div data-testid="restructure-check">
      <p className="font-medium">
        Re-measure: {fmtNum(check.rowDiffs)} rows / {check.configDiffs} settings differ from what {what} — someone
        changed the Area meanwhile, or the operation did something unexpected. Check before continuing.
      </p>
      {check.examples.map((e, i) => <p key={i} className="font-mono">{e}</p>)}
    </div>
  );
}

type Phase = 'loading' | 'preview' | 'applying' | 'applied' | 'undoing' | 'undone';

const fmtNum = (n: number) => n.toLocaleString('hr-HR');
const val = (v: StepValue) => (v == null ? EMPTY_TOKEN : v);
const pairs = (o: Record<string, StepValue>) =>
  Object.entries(o).map(([k, v]) => `${k} = ${val(v)}`).join(' · ');

function stepText(st: RestructureStep): { when: string; set: string } {
  const w = [pairs(st.when), st.eventIds?.length ? `${st.eventIds.length} event_id` : '']
    .filter(Boolean).join(' · ');
  return { when: w, set: pairs(st.set) };
}

export function RestructurePanel({
  data,
  onChanged,
}: {
  data: NonNullable<ImportResult['restructure']>;
  /** Struktura (izbornik) se promijenila — roditelj osvježi stablo. */
  onChanged: () => void;
}) {
  const fileErrors = data.errors;
  const { areaId, steps } = data;
  // Greška filea (više Area, kriv sheet) ⇒ nema što mjeriti; pregled odmah pokaže greške.
  const measurable = !!areaId && fileErrors.length === 0;

  const [phase, setPhase] = useState<Phase>(measurable ? 'loading' : 'preview');
  const [preview, setPreview] = useState<RestructurePreview | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [undone, setUndone] = useState<UndoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);

  // Panel se rađa ISPOD rezultata uvoza (sve nule) — na ekranu se vidi samo rub naslova.
  // Tko ne skrola, pročita „Structure unchanged" kao kraj i zatvori prozor: koraci se tada
  // ne primijene, a izgleda kao obavljen posao (Saša, T-S179-1). Zato se prozor pomakne sam.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!measurable || !areaId) return;
    let alive = true;
    previewRestructure(areaId, steps)
      .then(p => { if (alive) { setPreview(p); setPhase('preview'); } })
      .catch(e => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setPhase('preview'); } });
    return () => { alive = false; };
  }, [measurable, areaId, steps]);

  const plan = preview?.plan;
  const errors = [...fileErrors, ...(plan?.errors ?? [])];
  const canApply = phase === 'preview' && !!plan?.rpc && errors.length === 0 && ack && !error;
  const totalChanged = plan?.steps.reduce((s, x) => s + x.changed, 0) ?? 0;

  const doApply = async () => {
    if (!preview) return;
    setPhase('applying'); setError(null);
    try {
      const r = await applyRestructure(preview, data.source);
      setApplied(r); setPhase('applied'); onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setPhase('preview'); setAck(false);
    }
  };

  const doUndo = async () => {
    if (!preview || !applied) return;
    setPhase('undoing'); setError(null);
    try {
      const r = await undoRestructure(preview, applied.opId);
      setUndone(r); setPhase('undone'); onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setPhase('applied');
    }
  };

  return (
    <div ref={rootRef} className="rounded-lg border border-indigo-200 overflow-hidden scroll-mt-2" data-testid="restructure-panel">
      <div className="bg-indigo-50 px-4 py-2 text-indigo-900">
        <p className="text-sm font-semibold">Restructure — preview</p>
        <p className="text-xs opacity-80">
          {data.areaName} · {steps.length} step{steps.length !== 1 ? 's' : ''}
          {plan && <> · <span data-testid="restructure-total">{fmtNum(totalChanged)}</span> changes
            {preview && <> · {fmtNum(preview.eventCount)} rows in Area · measured in {(preview.ms / 1000).toFixed(1)} s</>}</>}
        </p>
      </div>

      <div className="px-4 py-3 space-y-3 text-xs">
        {phase === 'loading' && (
          <p className="text-gray-500 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
            Measuring the Area… (nothing is written)
          </p>
        )}

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2" data-testid="restructure-error">
            {error}
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2 space-y-0.5" data-testid="restructure-errors">
            <p className="font-medium">Errors — nothing can be applied until they are fixed in the file:</p>
            {errors.map((e, i) => <p key={i}>✗ {e}</p>)}
          </div>
        )}

        {/* Koraci */}
        {plan && plan.steps.length > 0 && (
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">#</th>
                  <th className="text-left px-2 py-1 font-medium">when → set</th>
                  <th className="text-right px-2 py-1 font-medium">rows</th>
                  <th className="text-right px-2 py-1 font-medium">changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plan.steps.map(r => {
                  const st = steps.find(s => s.n === r.n)!;
                  const tx = stepText(st);
                  return (
                    <tr key={r.n} data-testid={`restructure-step-${r.n}`} className="align-top">
                      <td className="px-2 py-1 tabular-nums text-gray-500">{r.n}</td>
                      <td className="px-2 py-1">
                        <p><span className="text-gray-500">{tx.when}</span> → <span className="font-medium">{tx.set}</span></p>
                        {r.examples.map(ex => (
                          <p key={ex.id} className="text-gray-400 truncate max-w-[26rem]">
                            {ex.event_date ? formatDateHr(ex.event_date) : '—'}
                            {' · '}{ex.comment || '(no description)'}
                            {(preview?.amounts[ex.id] ?? []).map((a, i) => (
                              <span key={i}> · {a.attr} {formatAmount(a.value)}</span>
                            ))}
                          </p>
                        ))}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtNum(r.matched)}</td>
                      <td className={cn('px-2 py-1 text-right tabular-nums', r.changed ? 'font-semibold' : 'text-gray-400')}>
                        {fmtNum(r.changed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {plan && plan.changes.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Also changes ({plan.changes.length})</p>
            <div className="max-h-40 overflow-y-auto bg-gray-50 rounded px-2 py-1 space-y-0.5" data-testid="restructure-changes">
              {plan.changes.map((c, i) => <p key={i}>• {c}</p>)}
            </div>
          </div>
        )}

        {plan && plan.warnings.length > 0 && (
          <div className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 space-y-0.5 max-h-40 overflow-y-auto">
            {plan.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          </div>
        )}

        {/* Potvrda i primjena */}
        {(phase === 'preview' || phase === 'applying') && plan?.rpc && errors.length === 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5"
                disabled={phase === 'applying'} data-testid="restructure-ack" />
              <span>I have seen what changes.</span>
            </label>
            <button
              onClick={doApply}
              disabled={!canApply}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white',
                !canApply && 'opacity-50 cursor-not-allowed')}
              data-testid="restructure-apply"
            >
              {phase === 'applying' ? 'Applying…' : 'Apply restructure'}
            </button>
          </div>
        )}

        {(phase === 'applied' || phase === 'undoing') && applied && (
          <div className={cn('rounded px-3 py-2 border', clean(applied.check)
            ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800')}
            data-testid="restructure-applied">
            <p>
              ✓ Applied · op <span className="font-mono">{applied.opId.slice(0, 8)}</span> ·{' '}
              {fmtNum(totalChanged)} changes · {(applied.ms / 1000).toFixed(1)} s
            </p>
            <CheckLine check={applied.check} what="the preview predicted" />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-gray-600">Undo is available while this window is open (op id above for the tool).</span>
              <button onClick={doUndo} disabled={phase === 'undoing'}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                data-testid="restructure-undo">
                {phase === 'undoing' ? 'Undoing…' : 'Undo'}
              </button>
            </div>
          </div>
        )}

        {phase === 'undone' && undone && (
          <div className={cn('rounded px-3 py-2 border', clean(undone.check)
            ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-800')}
            data-testid="restructure-undone">
            <p>↺ Undone · {fmtNum(undone.restored)} records restored · {(undone.ms / 1000).toFixed(1)} s</p>
            <CheckLine check={undone.check} what="it was before" />
          </div>
        )}
      </div>
    </div>
  );
}
