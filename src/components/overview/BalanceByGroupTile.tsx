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
//
// `asOf` (S109) — the date filter reaches the tile, so "balance on 31.03.2025"
// is answerable. Two rules come with it:
//   * whenever asOf is set, the tile SAYS "na dan …" — in the subtitle and on
//     the "u banci" label. A past number rendered as the present one is the
//     same class of error as rule 1.
//   * "Potvrdi" then anchors ON that date, not today. Anchoring backwards is
//     what turns the anchor from a cover into a check (§2.17), and it must be
//     visible in the button before it is clicked, never a surprise after.
//   * …but only BACKWARDS (S111). `asOf` is clamped to today for the balance,
//     because "All time" resolves dateTo to the newest event in the Area and
//     future instalments push that into 2027. The split ("planirano") keeps the
//     raw value — see the comment at the clamp for why the two must differ.
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

/**
 * Gap (in days) above which the freshness line turns amber.
 *
 * The threshold only picks a COLOUR — the day count is always in the text, so
 * getting it wrong cannot mislead anyone, only under- or over-emphasise. That
 * is deliberate: a number nobody can defend must not be load-bearing.
 */
const STALE_DAYS = 7;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. UTC on both sides so DST never shifts it. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/** 1 dan · 2 dana · 21 dan · 39 dana */
function danWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana';
}

interface Props {
  areaId: UUID;
  widget: BalanceByGroupWidget;
  /** Read-only grantee: may look, may not confirm a balance. */
  canWrite: boolean;
  /**
   * Global date filter `dateTo` (`YYYY-MM-DD`), or null for "up to today".
   * Drives both the reading and the date a confirmation is stamped with.
   */
  asOf?: string | null;
  /** Open Activities filtered on this group value (§2.16 — drill = filter state). */
  onDrill?: (groupValue: string, opts: { planned: boolean }) => void;
}

export function BalanceByGroupTile({ areaId, widget, canWrite, asOf, onDrill }: Props) {
  const [rows, setRows] = useState<AnchoredBalanceRow[]>([]);
  const [splitRows, setSplitRows] = useState<GroupAggRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankInput, setBankInput] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // ── A BALANCE CANNOT BE "AS OF" A FUTURE DATE ────────────────────────────
  // "All time" resolves dateTo to the newest event in the Area, and with future
  // instalments in the data that is 30.04.2027. Left unclamped it produced three
  // separate lies at once: the header claimed a 2027 reading, the staleness gap
  // counted 296 days against a day that has not happened, and — worst — the
  // button offered "Potvrdi na 30.04.2027.", which would stamp an anchor in the
  // future and silently cut every row before it out of the balance (§2.17, the
  // strictly-after rule).
  //
  // The future has no balance, only plans — and plans are already the OTHER
  // number on this tile. So the clamp loses nothing.
  const today = todayIso();
  const effectiveAsOf = asOf && asOf < today ? asOf : today;
  /** Is the user actually looking at the past? Drives the "na dan …" wording. */
  const isPast = effectiveAsOf < today;

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
        asOf: effectiveAsOf,
      });
      setRows(balance);

      if (widget.split) {
        // The second number is a plain sum, NOT anchored: "what is still
        // planned" is a forward-looking total, so subtracting a past
        // confirmation from it would be meaningless.
        //
        // ⚠ THE RAW `asOf` ON PURPOSE — this one is NOT clamped to today.
        //   Clamping is right for the balance (the future has no balance) and
        //   wrong here for the same reason: a planned instalment dated 2027 is
        //   exactly what "planirano" is supposed to count. Clamping would have
        //   quietly dropped most of it.
        //
        // ⚠ The answer is still only half a one. `Status` is CURRENT state, not
        //   history: the app never recorded WHEN a row went Planiran → Izvrsen.
        //   So "planirano na 31.03.2025" can only mean "dated up to 31.03.2025
        //   and STILL planned today". A true retrospective needs status history
        //   — a new thing, not a tweak here.
        setSplitRows(
          await fetchGroupAgg({
            areaId,
            groupSlug: widget.group_by,
            plusSlug: widget.plus ?? null,
            minusSlug: widget.minus ?? null,
            filters: widget.split.filters,
            asOf: asOf ?? null,
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
  }, [areaId, widget, asOf, effectiveAsOf]);

  useEffect(() => { void load(); }, [load]);

  const splitByGroup = useMemo(() => {
    const m = new Map<string, GroupAggRow>();
    for (const r of splitRows) m.set(r.group_value ?? NO_VALUE, r);
    return m;
  }, [splitRows]);

  // A confirmation is stamped with the date being LOOKED AT, not the date of
  // the click: with the filter on 31.03.2025 the number typed in is that day's
  // printed balance, so today's date would be a lie about its own source.
  // ⚠ Never the raw `asOf`: a future filter bound must not become a future
  //   anchor. `effectiveAsOf` is the clamped, real day being looked at.
  const confirmOn = effectiveAsOf;

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
        confirmedOn: confirmOn,
      });
      setBankInput(prev => ({ ...prev, [groupValue]: '' }));
      toast.success(
        `Potvrđeno na ${formatDateHr(confirmOn)}: ${groupValue} = ${formatAmount(amount, widget.unit)}`,
      );
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
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{widget.title}</h3>
          {/* Rule: when the reading is not "now", the tile says so. A future
              dateTo is not a past reading, so it correctly says nothing. */}
          {isPast && (
            <p className={cn('text-xs mt-0.5 font-medium', T.asOfNote)}>
              na dan {formatDateHr(effectiveAsOf)}
            </p>
          )}
        </div>
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

          // How far the data actually reaches, vs how far the question reached
          // (sql/038). Measured against the effective as-of, not against today:
          // if the user asked "na dan 06.07.2026." and the last movement IS
          // 06.07.2026., nothing is stale — the answer is complete.
          const gap = row.last_on ? daysBetween(row.last_on, effectiveAsOf) : null;

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

                  {/* Freshness (§038) — the header says WHICH DAY was asked
                      about; this says how far this account can actually answer.
                      Without it a 39-day-old number renders as today's.
                      ⚠ `last_on == null` is ambiguous on purpose-of-failure: it
                      means "nothing since the anchor" only when n === 0. If the
                      RPC has not been upgraded (038 not run yet) the field is
                      simply absent, and claiming "nothing since" would be a
                      FALSE statement rather than a missing one — so that case
                      renders nothing at all. */}
                  {(row.last_on || row.n === 0) && (
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        gap !== null && gap > STALE_DAYS ? T.asOfNote : 'text-gray-500',
                      )}
                    >
                      {row.last_on ? (
                        <>
                          zadnji zapis{' '}
                          <span className="font-medium">{formatDateHr(row.last_on)}</span>
                          {gap !== null && gap > 0 && <> · prije {gap} {danWord(gap)}</>}
                        </>
                      ) : (
                        <>zadnji zapis: nema poslije potvrde</>
                      )}
                    </p>
                  )}
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
                    u banci{isPast ? ` na ${formatDateHr(effectiveAsOf)}` : ''}
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
                      title={
                        isPast
                          ? `Spremi ovaj broj kao potvrđeno stanje na ${formatDateHr(effectiveAsOf)} — saldo se od tog dana računa od njega`
                          : 'Spremi ovaj broj kao potvrđeno stanje — saldo se od danas računa od njega'
                      }
                    >
                      {savingKey === key
                        ? 'Spremam…'
                        : isPast
                          ? `Potvrdi na ${formatDateHr(effectiveAsOf)}`
                          : 'Potvrdi'}
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
