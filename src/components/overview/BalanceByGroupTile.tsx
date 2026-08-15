// ============================================================
// BalanceByGroupTile.tsx — "Stanje po računu"
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md §2.3 (config), §2.10 (what actually moves a
// balance), §2.11 (reconciliation), §2.17 (the anchor).
//
// The tile knows nothing about money. It renders ROLES — group / plus / minus /
// filter — so the same component answers "balance per account", "kcal per week"
// and "hours per project". Everything domain-specific arrives in `widget`.
//
// THREE THINGS THAT MUST NOT DRIFT
//   1. The balance is anchor + movement strictly after the confirmation
//      (§2.17). When there is no anchor the tile SAYS "od početka podataka".
//      Never present a from-the-beginning sum as if it were a bank figure.
//   2. Δ is not an error message. The data has 13 residual months and 69
//      flagged rows, so Δ will appear even when the model is right — that is
//      the design working (§2.11). Nothing here may be tuned to make Δ vanish.
//   3. The "u banci" field must exist on mobile too. That is the screen where
//      the decision gets made; without the field the chip floats without
//      context (the first misreading of the sketch).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  fetchAnchoredBalance,
  fetchGroupAgg,
  saveAnchor,
  type AnchoredBalanceRow,
  type GroupAggRow,
} from '@/lib/overviewApi';
import {
  formatAmount,
  formatSigned,
  formatDateHr,
  parseAmountInput,
  todayIso,
} from '@/lib/amountFormat';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { BalanceByGroupWidget, UUID } from '@/types/database';

const T = THEME.overview;

const NO_VALUE = '(bez vrijednosti)';

interface Props {
  areaId: UUID;
  widget: BalanceByGroupWidget;
  /** Read-only grantee: may look, may not confirm a balance. */
  canWrite: boolean;
  /** Open Activities filtered on this group value (§2.16 — drill = filter state). */
  onDrill?: (groupValue: string, opts: { planned: boolean }) => void;
}

export function BalanceByGroupTile({ areaId, widget, canWrite, onDrill }: Props) {
  const [rows, setRows] = useState<AnchoredBalanceRow[]>([]);
  const [splitRows, setSplitRows] = useState<GroupAggRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankInput, setBankInput] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const balance = await fetchAnchoredBalance({
        areaId,
        groupSlug: widget.group_by,
        plusSlug: widget.plus ?? null,
        minusSlug: widget.minus ?? null,
        filters: widget.filters ?? [],
      });
      setRows(balance);

      if (widget.split) {
        // The second number is a plain sum, NOT anchored: "what is still
        // planned" is a forward-looking total, so subtracting a past
        // confirmation from it would be meaningless.
        setSplitRows(
          await fetchGroupAgg({
            areaId,
            groupSlug: widget.group_by,
            plusSlug: widget.plus ?? null,
            minusSlug: widget.minus ?? null,
            filters: widget.split.filters,
          }),
        );
      } else {
        setSplitRows([]);
      }
    } catch (e) {
      // The RPC raises on an unknown slug on purpose (sql/035 §2). Showing the
      // message verbatim is the whole payoff: it names the slug that broke.
      const msg = (e as { message?: string })?.message ?? String(e);
      setError(msg);
      setRows([]);
      setSplitRows([]);
    } finally {
      setLoading(false);
    }
  }, [areaId, widget]);

  useEffect(() => { void load(); }, [load]);

  const splitByGroup = useMemo(() => {
    const m = new Map<string, GroupAggRow>();
    for (const r of splitRows) m.set(r.group_value ?? NO_VALUE, r);
    return m;
  }, [splitRows]);

  const confirm = async (groupValue: string, typed: string) => {
    const amount = parseAmountInput(typed);
    if (amount === null) {
      toast.error('Upiši broj koji piše u bankovnoj aplikaciji');
      return;
    }
    setSavingKey(groupValue);
    try {
      await saveAnchor({
        areaId,
        groupSlug: widget.group_by,
        groupValue,
        amount,
        confirmedOn: todayIso(),
      });
      setBankInput(prev => ({ ...prev, [groupValue]: '' }));
      toast.success(`Potvrđeno: ${groupValue} = ${formatAmount(amount, widget.unit)}`);
      await load();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? 'Spremanje nije uspjelo');
    } finally {
      setSavingKey(null);
    }
  };

  // ------------------------------------------------------------------
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border p-3 sm:p-4', T.tileBorder)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{widget.title}</h3>
        <button
          onClick={() => void load()}
          disabled={loading}
          title="Osvježi"
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 px-2 py-1"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">Pločica se ne može izračunati.</p>
          <p className="mt-1 font-mono text-xs break-words">{error}</p>
          <p className="mt-1 text-xs">
            Najčešći uzrok: slug iz konfiguracije više ne postoji (preimenovan atribut).
          </p>
        </div>
      )}

      {!error && loading && rows.length === 0 && (
        <p className="text-sm text-gray-400 py-4">Računam…</p>
      )}

      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-gray-500 py-4">Nema zapisa koji zadovoljavaju uvjete pločice.</p>
      )}

      <div className="space-y-3">
        {rows.map(row => {
          const key = row.group_value ?? NO_VALUE;
          const split = splitByGroup.get(key);
          const typed = bankInput[key] ?? '';
          const bank = parseAmountInput(typed);
          // Δ > 0 ⇒ the app shows MORE than the bank.
          const delta = bank === null ? null : row.balance - bank;

          return (
            <div key={key} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              {/* --- account + balance --- */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{key}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.anchored ? (
                      <>
                        od potvrde <span className="font-medium">{formatDateHr(row.anchor_on!)}</span>
                        {' · '}
                        {formatAmount(row.anchor_amount ?? 0, widget.unit)}
                        {' · '}
                        {row.n} {row.n === 1 ? 'promjena' : 'promjena'} poslije
                      </>
                    ) : (
                      <>od početka podataka · {row.n} zapisa</>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDrill?.(key, { planned: false })}
                  disabled={!onDrill}
                  title={onDrill ? 'Otvori zapise ovog računa' : undefined}
                  className={cn(
                    'text-xl sm:text-2xl font-semibold tabular-nums rounded px-1',
                    row.balance < 0 ? T.amountNeg : T.amountPos,
                    onDrill && 'hover:underline underline-offset-4 cursor-pointer',
                  )}
                >
                  {formatAmount(row.balance, widget.unit)}
                </button>
              </div>

              {/* --- planned, two directions (§2.13) --- */}
              {widget.split && split && (split.plus_sum !== 0 || split.minus_sum !== 0) && (
                <button
                  type="button"
                  onClick={() => onDrill?.(key, { planned: true })}
                  disabled={!onDrill}
                  className={cn(
                    'mt-2 flex items-center gap-3 text-xs rounded px-1 py-0.5',
                    onDrill && 'hover:bg-white cursor-pointer',
                  )}
                >
                  <span className="text-gray-500">{widget.split.label}</span>
                  {split.minus_sum !== 0 && (
                    <span className={cn('tabular-nums font-medium', T.amountNeg)}>
                      {formatSigned(-split.minus_sum, widget.unit)}
                    </span>
                  )}
                  {split.plus_sum !== 0 && (
                    <span className={cn('tabular-nums font-medium', T.amountPos)}>
                      {formatSigned(split.plus_sum, widget.unit)}
                    </span>
                  )}
                  <span className="text-gray-400">({split.n})</span>
                </button>
              )}

              {/* --- reconciliation: "u banci" + ✓/Δ --- */}
              {widget.reconcile && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-gray-500 shrink-0" htmlFor={`bank-${key}`}>
                    u banci
                  </label>
                  <input
                    id={`bank-${key}`}
                    type="text"
                    inputMode="decimal"
                    value={typed}
                    onChange={e => setBankInput(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="npr. 1.240,00"
                    className={cn(
                      'w-32 px-2 py-1.5 border border-gray-300 rounded-lg text-sm tabular-nums',
                      'focus:ring-2 focus:border-transparent',
                      T.ring,
                    )}
                  />

                  {delta === null ? (
                    !row.anchored && (
                      <span className={cn('text-xs px-2 py-1 rounded-full', T.chipNoAnchor)}>
                        još nije potvrđeno
                      </span>
                    )
                  ) : Math.abs(delta) < 0.005 ? (
                    <span className={cn('text-xs px-2 py-1 rounded-full', T.chipOk)}>
                      ✓ slaže se
                    </span>
                  ) : (
                    <span
                      className={cn('text-xs px-2 py-1 rounded-full', T.chipDiff)}
                      title={
                        delta > 0
                          ? 'Aplikacija pokazuje više nego banka — nešto je upisano dvaput ili je iznos prevelik.'
                          : 'Aplikacija pokazuje manje nego banka — nešto fali ili je iznos premalen.'
                      }
                    >
                      Δ {formatSigned(delta, widget.unit)}
                    </span>
                  )}

                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => void confirm(key, typed)}
                      disabled={bank === null || savingKey === key}
                      className={cn(
                        'ml-auto text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        T.btnConfirm,
                      )}
                      title="Spremi ovaj broj kao potvrđeno stanje — saldo se od danas računa od njega"
                    >
                      {savingKey === key ? 'Spremam…' : 'Potvrdi'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Δ is a signal, not a verdict — say so once, under the tile. */}
      {widget.reconcile && rows.length > 0 && !error && (
        <p className="text-[11px] text-gray-400 mt-3 leading-snug">
          Δ znači da se aplikacija i banka razilaze — nešto fali, nešto je dvaput, ili je iznos kriv.
          Nije greška izračuna. „Potvrdi" sprema ono što piše u banci: saldo se od tog dana računa od
          te brojke naviše.
        </p>
      )}
    </div>
  );
}
