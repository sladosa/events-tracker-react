// ============================================================
// AttrRestructurePanel.tsx — faza „Restructure attributes" u Structure uvozu (F2 A1, S186)
// ============================================================
// Prikazuje se POSLIJE ostatka uvoza, kad file nosi popunjen sheet
// `Restructure attributes`. Isti tok kao F1 (`RestructurePanel`): pregled → kvačica
// → Apply → ponovno mjerenje → Undo — ali KORAK PO KORAK (Saša, S186):
//   - za svaki korak se pita BAZA je li već izveden („Already in this state");
//   - primjenjuje se samo prvi neizvedeni; poslije se pregled računa iznova, pa
//     sljedeći korak vidi stanje nakon prethodnog;
//   - isti file uvezen drugi put ne mijenja ništa — dokaz je stanje, ne oznaka u fileu.
// ⚠ Engleski u cijelosti (natpisi I poruke planera) — općenit alat (Saša, S186).
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  applyAttrStep, previewAttrSteps, undoAttrStep,
  type AttrApplyResult, type AttrStepStatus, type AttrUndoResult, type PlannedStep,
} from '@/lib/restructure/attrApply';
import { describeAttrStep } from '@/lib/restructure/attrSheet';
import type { ImportResult } from '@/lib/structureImport';
import type { Verification } from '@/lib/restructure/apply';
import { CheckLine } from './RestructurePanel';

const clean = (c: Verification) => c.rowDiffs === 0 && c.configDiffs === 0;

const fmtNum = (n: number) => n.toLocaleString('hr-HR');
const pad = (n: number) => String(n).padStart(2, '0');
/** `27.10.2026 10:15:42` — lokalno vrijeme, do sekunde. */
function fmtAt(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StatusCell({ s }: { s: AttrStepStatus }) {
  switch (s.status) {
    case 'done':
      return (
        <span className="text-green-700">
          ✓ Already in this state
          {s.record && (
            <span className="text-gray-500"> · applied {fmtAt(s.record.at)} by {s.record.by}
              {s.record.source ? ` · ${s.record.source}` : ''}</span>
          )}
        </span>
      );
    case 'next': return <span className="font-medium text-indigo-700">▶ Next · {fmtNum(s.plan.rows)} rows</span>;
    case 'blocked': return <span className="font-medium text-red-700">✗ Blocked — see below</span>;
    case 'waiting': return <span className="text-gray-400">⏸ Waits for the previous step</span>;
    case 'unsupported': return <span className="text-amber-700">“merge into” is not available yet — steps stop here</span>;
  }
}

type Busy = 'loading' | 'idle' | 'applying' | 'undoing';

export function AttrRestructurePanel({
  data,
  onChanged,
}: {
  data: NonNullable<ImportResult['attrRestructure']>;
  /** Struktura se promijenila — roditelj osvježi stablo. */
  onChanged: () => void;
}) {
  const { areaId, steps, errors: fileErrors } = data;
  const measurable = !!areaId && fileErrors.length === 0;

  const [busy, setBusy] = useState<Busy>(measurable ? 'loading' : 'idle');
  const [statuses, setStatuses] = useState<AttrStepStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [applied, setApplied] = useState<{ planned: PlannedStep; result: AttrApplyResult } | null>(null);
  const [undone, setUndone] = useState<{ n: number; result: AttrUndoResult } | null>(null);

  // Isti razlog kao F1 (T-S179-1): panel se rađa ispod rezultata uvoza — pomakni se do njega.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  const refresh = useCallback(async () => {
    if (!measurable || !areaId) return;
    setBusy('loading');
    try {
      setStatuses(await previewAttrSteps(areaId, steps));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('idle');
    }
  }, [measurable, areaId, steps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const next = statuses?.find((s): s is PlannedStep => s.status === 'next') ?? null;
  const planned = statuses?.find((s): s is PlannedStep => s.status === 'next' || s.status === 'blocked') ?? null;
  const allDone = !!statuses && statuses.length > 0 && statuses.every(s => s.status === 'done');
  const remaining = statuses ? statuses.filter(s => s.status === 'waiting' || s.status === 'unsupported').length : 0;
  const canApply = busy === 'idle' && !!next && ack && !error;

  const doApply = async () => {
    if (!next || !areaId) return;
    setBusy('applying'); setError(null); setUndone(null);
    try {
      const result = await applyAttrStep(areaId, next, data.source);
      setApplied({ planned: next, result });
      setAck(false);
      onChanged();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setBusy('idle'); setAck(false);
    }
  };

  const doUndo = async () => {
    if (!applied || !areaId) return;
    setBusy('undoing'); setError(null);
    try {
      const result = await undoAttrStep(areaId, applied.planned, applied.result.opId);
      setUndone({ n: applied.planned.step.n, result });
      setApplied(null);
      onChanged();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setBusy('idle');
    }
  };

  return (
    <div ref={rootRef} className="rounded-lg border border-indigo-200 overflow-hidden scroll-mt-2" data-testid="attr-restructure-panel">
      <div className="bg-indigo-50 px-4 py-2 text-indigo-900">
        <p className="text-sm font-semibold">Restructure attributes — preview</p>
        <p className="text-xs opacity-80">{data.areaName} · {steps.length} step{steps.length !== 1 ? 's' : ''} · one at a time</p>
      </div>

      <div className="px-4 py-3 space-y-3 text-xs">
        {busy === 'loading' && (
          <p className="text-gray-500 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
            Measuring the Area… (nothing is written)
          </p>
        )}

        {(error || fileErrors.length > 0) && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2 space-y-0.5" data-testid="attr-errors">
            {fileErrors.length > 0 && <p className="font-medium">Errors in the file — nothing can be applied until they are fixed:</p>}
            {fileErrors.map((e, i) => <p key={i}>✗ {e}</p>)}
            {error && <p>✗ {error}</p>}
          </div>
        )}

        {statuses && busy !== 'loading' && (
          <p className="font-medium text-gray-800" data-testid="attr-summary">
            {allDone
              ? 'All steps are already in this state — nothing to do.'
              : next
                ? <>Doing 1 change: step {next.step.n} — {describeAttrStep(next.step)} ({fmtNum(next.plan.rows)} rows).
                  {remaining > 0 && <> The remaining {remaining} step{remaining !== 1 ? 's go' : ' goes'} one at a time, in later passes.</>}</>
                : planned
                  ? <>Step {planned.step.n} cannot be applied — fix the file (or the data) and import it again.</>
                  : 'No step can be applied.'}
          </p>
        )}

        {statuses && statuses.length > 0 && (
          <div className="border border-gray-100 rounded">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">#</th>
                  <th className="text-left px-2 py-1 font-medium">step</th>
                  <th className="text-left px-2 py-1 font-medium">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statuses.map(s => (
                  <tr key={s.step.n} data-testid={`attr-step-${s.step.n}`} className="align-top">
                    <td className="px-2 py-1 tabular-nums text-gray-500">{s.step.n}</td>
                    <td className="px-2 py-1 break-all">{describeAttrStep(s.step)}</td>
                    <td className="px-2 py-1" data-testid={`attr-step-status-${s.step.n}`}><StatusCell s={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {planned && planned.plan.errors.length > 0 && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2 space-y-0.5">
            {planned.plan.errors.map((e, i) => <p key={i}>✗ {e}</p>)}
          </div>
        )}

        {planned && planned.plan.unconvertible.count > 0 && (
          <div data-testid="attr-unconvertible">
            <p className="font-medium text-red-700 mb-1">
              Cannot be converted ({fmtNum(planned.plan.unconvertible.count)} rows
              {planned.plan.unconvertible.count > planned.plan.unconvertible.first.length
                ? `, first ${planned.plan.unconvertible.first.length}` : ''}) — fix them in Excel, then import again:
            </p>
            <div className="max-h-40 overflow-y-auto border border-red-100 rounded">
              <table className="w-full">
                <tbody className="divide-y divide-red-50">
                  {planned.plan.unconvertible.first.map((u, i) => (
                    <tr key={i}><td className="px-2 py-0.5 tabular-nums text-gray-500 w-28">{u.event_date}</td>
                      <td className="px-2 py-0.5 font-mono text-red-800">{u.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {next && next.plan.changes.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Step {next.step.n} changes ({next.plan.changes.length})</p>
            <div className="max-h-40 overflow-y-auto bg-gray-50 rounded px-2 py-1 space-y-0.5" data-testid="attr-changes">
              {next.plan.changes.map((c, i) => <p key={i}>• {c}</p>)}
            </div>
          </div>
        )}

        {planned && planned.plan.warnings.length > 0 && (
          <div className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 space-y-0.5 max-h-40 overflow-y-auto">
            {planned.plan.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          </div>
        )}

        {next && (busy === 'idle' || busy === 'applying') && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5"
                disabled={busy === 'applying'} data-testid="attr-ack" />
              <span>I have seen what changes.</span>
            </label>
            <button
              onClick={doApply}
              disabled={!canApply}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white',
                !canApply && 'opacity-50 cursor-not-allowed')}
              data-testid="attr-apply"
            >
              {busy === 'applying' ? 'Applying…' : `Apply step ${next.step.n}`}
            </button>
          </div>
        )}

        {applied && (
          <div className={cn('rounded px-3 py-2 border', clean(applied.result.check)
            ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800')}
            data-testid="attr-applied">
            <p>
              ✓ Step {applied.planned.step.n} applied · op <span className="font-mono">{applied.result.opId.slice(0, 8)}</span> ·{' '}
              {fmtNum(applied.planned.plan.rows)} rows · {(applied.result.ms / 1000).toFixed(1)} s
            </p>
            <CheckLine check={applied.result.check} what="the preview predicted" />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-gray-600">Undo is available while this window is open (op id above for the tool).</span>
              <button onClick={doUndo} disabled={busy !== 'idle'}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                data-testid="attr-undo">
                {busy === 'undoing' ? 'Undoing…' : `Undo step ${applied.planned.step.n}`}
              </button>
            </div>
          </div>
        )}

        {undone && (
          <div className={cn('rounded px-3 py-2 border', clean(undone.result.check)
            ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-800')}
            data-testid="attr-undone">
            <p>↺ Step {undone.n} undone · {fmtNum(undone.result.restored)} records restored · {(undone.result.ms / 1000).toFixed(1)} s</p>
            <CheckLine check={undone.result.check} what="it was before" />
          </div>
        )}
      </div>
    </div>
  );
}
