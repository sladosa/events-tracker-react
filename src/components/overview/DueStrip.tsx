// ============================================================
// DueStrip.tsx — „Čeka potvrdu": dospjele kartične košare (faza 1)
// ============================================================
// Spec: docs/DOSPJELO_SPEC.md §3 (košara, ne redak), §4 (kako Koka to vidi),
//       §9 faza 1 (SAMO ČITANJE — bez ijednog upisa).
//
// Traka stoji IZNAD pločice salda i postoji samo kad ima čega (isto načelo
// kao OQ-4). Koka u banci vidi JEDAN broj po kartici; traka joj pokaže Σ
// košare i polje za taj broj, pa se jedan broj uspoređuje s jednim brojem.
//
// ⚠ NIKAD „naplaćeno" — samo „provjeri u banci". Dospijeće nije dokaz naplate
//   (odbačeni automat, OVERVIEW §2.5a); potvrđuje čovjek, i to tek u fazi 2.
// ⚠ Neuspjelo čitanje se KAŽE. Traka koja zbog greške nestane izgleda točno
//   kao „ništa ne čeka" — a to je tvrdnja o novcu (S121).
// ⚠ Polje „banka skinula" se ne puni Σ-om — provjera bi bila tautološka.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { fetchDueBaskets, type DueBasketRow } from '@/lib/overviewApi';
import { basketNetCents, compareWithBank } from '@/lib/dueBaskets';
import { formatAmount, formatDateHr, parseAmountInput, todayIso } from '@/lib/amountFormat';
import { cn } from '@/lib/cn';
import type { BalanceByGroupWidget, DueConfig, UUID } from '@/types/database';

interface Props {
  areaId: UUID;
  widget: BalanceByGroupWidget & { due: DueConfig };
}

const stavki = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'stavka'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'stavke'
  : 'stavki';

export function DueStrip({ areaId, widget }: Props) {
  const { due, unit } = widget;
  const [rows, setRows] = useState<DueBasketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankInput, setBankInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchDueBaskets({
        areaId, due,
        plusSlug: widget.plus ?? null,
        minusSlug: widget.minus ?? null,
        asOf: todayIso(),
      }));
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [areaId, due, widget.plus, widget.minus]);

  useEffect(() => { void load(); }, [load]);

  // Ništa ne čeka ⇒ trake nema. Dok se učitava također ništa: traka koja
  // bljesne i nestane gora je od one koja se pojavi kad ima što reći.
  if (!error && (loading || rows.length === 0)) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-amber-900 text-sm sm:text-base">
          Čeka potvrdu{rows.length > 0 ? ` (${rows.length})` : ''}
        </h3>
        <button
          onClick={() => void load()}
          disabled={loading}
          title="Osvježi"
          className="text-xs text-amber-700 hover:text-amber-900 disabled:opacity-40 px-2 py-1"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">Nisam uspio provjeriti dospjele kartične naplate.</p>
          <p className="mt-1 font-mono text-xs break-words">{error}</p>
          <p className="mt-1 text-xs">Ovo ne znači da ništa ne čeka — pokušaj ponovno (↻).</p>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {rows.map(row => {
          const key = `${row.basket}|${row.due_date}`;
          const cfg = due.baskets[row.basket];
          const sum = basketNetCents(row);
          const typed = bankInput[key] ?? '';
          const bank = typed.trim() === '' ? null : parseAmountInput(typed);
          const cmp = compareWithBank(sum, bank);
          const unreadable = typed.trim() !== '' && bank === null;
          return (
            <div key={key} className="rounded-lg bg-white border border-amber-200 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">
                {row.basket} · naplata {formatDateHr(row.due_date)} · {row.n} {stavki(row.n)}
              </p>
              {row.n_pending !== row.n && (
                <p className="text-xs text-gray-500">
                  od toga {row.n_pending} još „{due.pending}”
                </p>
              )}
              <p className="mt-1 text-sm text-gray-700 w-full max-w-full break-words">
                Σ <span className="font-semibold tabular-nums">{formatAmount(sum / 100, unit)}</span>
                {cfg?.account && <> → s računa <span className="font-medium">{cfg.account}</span></>}
              </p>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-600" htmlFor={`due-${key}`}>banka skinula</label>
                <input
                  id={`due-${key}`}
                  type="text"
                  inputMode="decimal"
                  value={typed}
                  onChange={e => setBankInput(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="upiši s ekrana banke"
                  className={cn(
                    'w-36 px-2 py-1 text-sm border rounded tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400',
                    unreadable ? 'border-red-400 bg-red-50' : 'border-gray-300',
                  )}
                />
                {cmp.state === 'ok' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ slaže se
                  </span>
                )}
                {cmp.state === 'diff' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                    razlika {formatAmount(cmp.diffCents / 100, unit)}
                  </span>
                )}
              </div>
              {cmp.state === 'diff' && (
                <p className="mt-1 text-xs text-amber-800">
                  {cmp.diffCents > 0
                    ? 'Košara je veća od naplate — neki redak možda pripada drugoj košari, ili je upisan dvaput.'
                    : 'Banka je skinula više — neka kupovina možda nije upisana, ili je upisana s krivim datumom naplate.'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Provjeri u bankovnoj aplikaciji koliko je skinuto. Potvrda (<i>{due.pending}</i> →{' '}
          <i>{due.done ?? 'izvršeno'}</i>) još nije ugrađena — zasad samo usporedba.
        </p>
      )}
    </div>
  );
}
