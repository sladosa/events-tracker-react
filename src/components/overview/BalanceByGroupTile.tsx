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
//   * ⚠ SUPERSEDED IN S116. "Potvrdi" used to anchor on the date being LOOKED
//     AT, which is where BUG-S115-ANCHORDATE came from: a balance copied off a
//     statement that closed 30.07. got the date of the click. The date now
//     comes from the declared SOURCE — screen ⇒ today, paper ⇒ typed off the
//     paper — and the button always names it before it is pressed.
//     Anchoring backwards is still what turns the anchor from a cover into a
//     check (§2.17); it just has to be stated, not inferred from the filter.
//   * …but only BACKWARDS (S111). `asOf` is clamped to today for the balance,
//     because "All time" resolves dateTo to the newest event in the Area and
//     future instalments push that into 2027. The split ("planirano") keeps the
//     raw value — see the comment at the clamp for why the two must differ.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  deleteAnchor,
  fetchAnchoredBalance,
  fetchGroupAgg,
  listAnchors,
  saveAnchor,
  type AnchoredBalanceRow,
  type BalanceAnchor,
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

/**
 * Odakle potvrđeno stanje dolazi. Zatvoren popis, jer je bilješka podatak koji
 * se poslije **čita i uspoređuje**, a ne rečenica: pet varijanti istog izvora
 * ne daju se ni grupirati ni prebrojati. Isti tekst piše i
 * `make_saldo_anchors.py`, pa su sidra iz skripte i iz UI-ja istog oblika.
 */
export const ANCHOR_SOURCE_SCREEN    = 'ekran bankovne aplikacije';
export const ANCHOR_SOURCE_STATEMENT = 'ispisano stanje s izvoda';
export const ANCHOR_SOURCE_SLIP      = 'bankomat / ispis na papiru';
/**
 * Više se NE upisuje. Od S116 je izvor obavezan, jer o njemu ovisi datum
 * potvrde. Konstanta ostaje jer je stoji u starim retcima baze (i u onima koje
 * je pisala skripta prije S113) — brisanje bi ih učinilo nečitkima.
 */
export const ANCHOR_SOURCE_UNKNOWN   = 'nije navedeno';
const ANCHOR_SOURCES = [
  ANCHOR_SOURCE_SCREEN,
  ANCHOR_SOURCE_STATEMENT,
  ANCHOR_SOURCE_SLIP,
] as const;

/**
 * ── THE DATE MUST COME FROM THE SOURCE, NEVER FROM THE CLICK ────────────────
 *
 * BUG-S115-ANCHORDATE, twice in five sessions. The confirmation used to be
 * stamped with the day being LOOKED AT, so a balance copied off a statement
 * that closed on 30.07. got the date of the click, 22.08. Everything dated in
 * between then falls out of the balance silently — the anchor rule is "changes
 * STRICTLY AFTER the confirmation" (§2.17), so those rows count as already
 * included in a number that never saw them.
 *
 * What makes it a design flaw and not a slip: the app held BOTH facts in the
 * SAME ROW — `note: "…ZABA_2026-07.pdf"` next to `confirmed_on: 2026-08-22` —
 * and never compared them. The source field (S113) records where the number
 * came from; from S116 it also decides what its date is allowed to be.
 *
 * The rule fits in one sentence, which is why it can be taught to a user:
 *
 *     Broj s PAPIRA → datum piše na papiru.  Broj s EKRANA → app ga izračuna.
 *
 * ⚠ „App ga izračuna" je S116 ispravak Sašinog nalaza: očitanje s ekrana NE ide
 *   na danas nego na JUČER, s oduzetim današnjim prometom — v. blok uz
 *   `prevDayIso`. Sidro na danas bi današnje transakcije izbacilo iz salda.
 *
 * A screen reading genuinely IS today's — that direction was never wrong. A
 * printed one carries its own date, and no default the app could invent is
 * better than reading it off the page.
 */
function dateComesFromSource(src: string): boolean {
  return src === ANCHOR_SOURCE_STATEMENT || src === ANCHOR_SOURCE_SLIP;
}

/**
 * `2026-08-23` → `2026-08-22`. Anchored at NOON so no timezone or DST shift can
 * move the day — the same trick `excelDatetime.ts` uses for date cells.
 */
function prevDayIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * ── A SCREEN READING ANCHORS ON YESTERDAY, NOT TODAY ────────────────────────
 *
 * The balance rule is `anchor + changes STRICTLY AFTER the confirmed day`, and
 * `confirmed_on` is a DATE. That boundary can express "end of a day" exactly —
 * and nothing else. A statement fits: it closes at the end of its close date,
 * so everything dated that day is already inside the printed number.
 *
 * A bank screen read at 10:00 does not fit. The number covers today up to 10:00
 * only, but a same-day anchor claims it covers all of today — so a payment at
 * 15:00, recorded with today's date, is silently dropped from the balance and
 * STAYS dropped until some later confirmation supersedes the anchor.
 *
 * The fix is to move the confirmation to a boundary the rule CAN express:
 *
 *     anchor(yesterday) = <what the screen shows> − <today's movement so far>
 *
 * Then today's rows are all "strictly after" and all count, and the balance
 * comes back out as exactly the number that was read. The 15:00 payment lands
 * in the balance the moment it is recorded.
 *
 * ⚠ EXACT ONLY WHILE TODAY'S MOVEMENT IS COMPLETE. A transaction the app does
 *   not know about yet makes `S − R` wrong, and the error is FROZEN INTO AN
 *   ANCHOR instead of surfacing as Δ — the §2.17 failure mode, localised to one
 *   day. Mitigation is not a check the code can run: the arithmetic is printed
 *   before saving, and the raw reading is kept in the note so the stored amount
 *   stays traceable to something a human actually saw.
 *
 * ⚠ `R` MUST CARRY THE SAME FILTERS AS THE BALANCE (S112). Subtracting card
 *   purchases the balance never counted would move the anchor by their sum.
 */


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
  // Odakle broj dolazi. ⚠ Cijeli mehanizam počiva na tome da potvrđeno stanje
  // dolazi IZVANA (§2.17), a iz same brojke se poslije ne vidi je li s izvoda,
  // s ekrana banke ili izračunata. Prazno polje zato ne znači „bez bilješke"
  // nego zapisuje da izvor NIJE naveden — neistina je gora od izostanka.
  const [srcInput, setSrcInput] = useState<Record<string, string>>({});
  const [srcDetail, setSrcDetail] = useState<Record<string, string>>({});
  // Datum s papira. Namjerno BEZ zadane vrijednosti: svaki default koji bi app
  // ponudio bio bi pogodak, a pogodak koji izgleda kao podatak je upravo ono
  // što je proizvelo BUG-S115-ANCHORDATE.
  const [srcDate, setSrcDate] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Sve potvrde ovog računa — nose dvije uloge: upozorenje „novija već postoji"
  // (bez kojeg ispravak unatrag ne radi, a izgleda kao da radi) i popis ispod
  // pločice, jedini put da se krivo sidro uopće VIDI iz aplikacije.
  const [anchors, setAnchors] = useState<BalanceAnchor[]>([]);
  /**
   * Današnji promet po grupi (`plus − minus`), s ISTIM filtrima kao saldo.
   * `null` = nije se dalo izračunati ⇒ potvrda s ekrana se ne smije spremiti,
   * jer bi bez oduzimanja sidro na jučer dvostruko brojalo današnje retke.
   */
  const [todayMove, setTodayMove] = useState<Map<string, { sum: number; n: number }> | null>(null);
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      // Potvrde ovog računa. Ne ruši pločicu ako padne — saldo je i dalje točan,
      // izgubi se samo povijest i upozorenje. Tiho prazno bi bilo gore od
      // pogreške u konzoli, pa se greška ispisuje.
      try {
        setAnchors(await listAnchors(areaId, widget.group_by));
      } catch (e) {
        console.error('listAnchors:', e);
        setAnchors([]);
      }

      // Današnji promet — treba samo pločici s potvrdom, i to samo za izvor
      // „ekran". Jedan RPC poziv: `p_from` je isključiv, `p_as_of` uključiv,
      // pa `(jučer, danas]` je točno današnji dan. Zbroj se radi u Postgresu,
      // nikad u pregledniku.
      if (widget.reconcile) {
        try {
          const agg = await fetchGroupAgg({
            areaId,
            groupSlug: widget.group_by,
            plusSlug: widget.plus ?? null,
            minusSlug: widget.minus ?? null,
            filters: widget.filters ?? [],
            from: prevDayIso(today),
            asOf: today,
          });
          setTodayMove(new Map(agg.map(r => [
            r.group_value ?? NO_VALUE,
            { sum: r.plus_sum - r.minus_sum, n: r.n },
          ])));
        } catch (e) {
          console.error('todayMove:', e);
          setTodayMove(null);
        }
      } else {
        setTodayMove(new Map());
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
  }, [areaId, widget, asOf, effectiveAsOf, today]);

  useEffect(() => { void load(); }, [load]);

  /** Potvrde po vrijednosti grupe, najnovija prvo (`listAnchors` već sortira). */
  const anchorsByGroup = useMemo(() => {
    const m = new Map<string, BalanceAnchor[]>();
    for (const a of anchors) {
      const k = a.group_value ?? NO_VALUE;
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [anchors]);

  const splitByGroup = useMemo(() => {
    const m = new Map<string, GroupAggRow>();
    for (const r of splitRows) m.set(r.group_value ?? NO_VALUE, r);
    return m;
  }, [splitRows]);

  /**
   * The date this confirmation will carry — derived from the SOURCE, not the
   * click (see `dateComesFromSource`). Returns null while a printed source has
   * no date yet, which is what disables the button.
   *
   * ⚠ A screen reading is always TODAY, even when the filter is on a past day.
   *   You cannot read last March off today's bank screen; offering to stamp it
   *   with the filter date would invent provenance the user never claimed.
   */
  const confirmDateFor = (groupValue: string): string | null => {
    const src = (srcInput[groupValue] ?? '').trim();
    if (!src) return null;
    // Ekran ⇒ jučer (v. blok uz `prevDayIso`): dan koji se još odvija nije
    // granica koju „strogo nakon" može izraziti.
    if (!dateComesFromSource(src)) return prevDayIso(today);
    const d = (srcDate[groupValue] ?? '').trim();
    return d || null;
  };

  /**
   * Što će se stvarno spremiti, za izvor „ekran": iznos umanjen za današnji
   * promet, i sve što treba ispisati prije klika. `null` kad se današnji promet
   * nije dao izračunati — tada se NE smije spremiti.
   */
  const screenAnchorFor = (
    groupValue: string,
    reading: number,
  ): { amount: number; move: number; n: number; on: string } | null => {
    if (todayMove === null) return null;
    const t = todayMove.get(groupValue) ?? { sum: 0, n: 0 };
    return {
      // ⚠ Zaokruženo na cent. Bez toga binarni zapis ostavlja rep od ~1e-13,
      //   koji se poslije pojavi kao Δ od 0,00 koji nije nula (S112 zamka).
      amount: Math.round((reading - t.sum) * 100) / 100,
      move: t.sum,
      n: t.n,
      on: prevDayIso(today),
    };
  };

  const confirm = async (groupValue: string, typed: string) => {
    const amount = parseAmountInput(typed);
    if (amount === null) {
      toast.error('Upiši broj koji piše u bankovnoj aplikaciji');
      return;
    }
    const src = (srcInput[groupValue] ?? '').trim();
    if (!src) {
      toast.error('Odaberi odakle je broj — o tome ovisi na koji datum ide potvrda');
      return;
    }
    const confirmOn = confirmDateFor(groupValue);
    if (!confirmOn) {
      toast.error('Upiši datum koji piše na izvodu (dan zadnje transakcije)');
      return;
    }
    // Potvrda u budućnosti bi po pravilu „strogo nakon" presjekla SVE retke do
    // tog dana. Sprječava se ovdje jer je datum sada ručan, pa `effectiveAsOf`
    // klamp više ne stoji između korisnika i baze.
    if (confirmOn > today) {
      toast.error('Datum potvrde ne može biti u budućnosti');
      return;
    }

    // Izvor „ekran": sprema se stanje na KRAJU jučerašnjeg dana, a ne broj s
    // ekrana. Sirovo očitanje ide u bilješku — bez njega `amount` više nije broj
    // koji je čovjek vidio, pa ga poslije nema s čim usporediti.
    let storedAmount = amount;
    let note = (srcDetail[groupValue] ?? '').trim()
      ? `${src} · ${(srcDetail[groupValue] ?? '').trim()}`
      : src;

    if (!dateComesFromSource(src)) {
      const calc = screenAnchorFor(groupValue, amount);
      if (!calc) {
        toast.error('Današnji promet se nije dao izračunati — osvježi pločicu i pokušaj ponovno');
        return;
      }
      storedAmount = calc.amount;
      note = `${src} · očitano ${formatAmount(amount, widget.unit)} na ${formatDateHr(today)}`
        + (calc.move !== 0
          ? `; oduzet promet toga dana ${formatSigned(calc.move, widget.unit)} (${calc.n} zapisa)`
          : '; toga dana nije bilo zapisa');
    }

    setSavingKey(groupValue);
    try {
      await saveAnchor({
        areaId,
        groupSlug: widget.group_by,
        groupValue,
        amount: storedAmount,
        confirmedOn: confirmOn,
        note,
      });
      setBankInput(prev => ({ ...prev, [groupValue]: '' }));
      setSrcInput(prev => ({ ...prev, [groupValue]: '' }));
      setSrcDetail(prev => ({ ...prev, [groupValue]: '' }));
      setSrcDate(prev => ({ ...prev, [groupValue]: '' }));
      toast.success(
        `Potvrđeno na ${formatDateHr(confirmOn)}: ${groupValue} = ${formatAmount(storedAmount, widget.unit)}`
        + (storedAmount !== amount
          ? ` (očitano ${formatAmount(amount, widget.unit)} danas)`
          : ''),
      );
      await load();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? 'Spremanje nije uspjelo');
    } finally {
      setSavingKey(null);
    }
  };

  const removeAnchor = async (a: BalanceAnchor) => {
    setDeletingId(a.id);
    try {
      await deleteAnchor(a.id);
      toast.success(`Obrisana potvrda ${formatDateHr(a.confirmed_on)} = ${formatAmount(a.amount, widget.unit)}`);
      await load();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? 'Brisanje nije uspjelo');
    } finally {
      setDeletingId(null);
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

          // Odakle / kada — cijeli mehanizam potvrde visi o ovih par redaka.
          const src = (srcInput[key] ?? '').trim();
          const needsDate = src !== '' && dateComesFromSource(src);
          const willConfirmOn = confirmDateFor(key);
          const groupAnchors = anchorsByGroup.get(key) ?? [];
          // ⚠ `036` bira NAJNOVIJU potvrdu s `confirmed_on <= as_of`. Nova
          //   potvrda na STARIJI datum zato ne poništava kriva na novijem —
          //   dogodilo se dvaput (S111 tipfeler, S115 krivi datum) i oba puta
          //   je izgledalo kao da je ispravak prošao.
          const shadowedBy = willConfirmOn
            ? groupAnchors.find(a => a.confirmed_on > willConfirmOn)
            : undefined;

          // Izvor „ekran": što će se stvarno spremiti, i na koji dan.
          const isScreen = src !== '' && !dateComesFromSource(src);
          const screenCalc = isScreen && bank !== null ? screenAnchorFor(key, bank) : null;

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

                  {/* Odakle — zatvoren popis, ne slobodan tekst. Slobodan tekst
                      daje pet zapisa za istu stvar, pa se poslije ne da ni
                      grupirati ni prebrojati; a odgovor koji bilješka mora dati
                      („je li broj došao izvana") ima konačan broj oblika.
                      Detalj (ime izvoda) je dodatak, ne zamjena. */}
                  <select
                    id={`src-${key}`}
                    value={srcInput[key] ?? ''}
                    onChange={e => setSrcInput(prev => ({ ...prev, [key]: e.target.value }))}
                    title="Odakle je broj — sprema se uz potvrdu."
                    className={cn(
                      'px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white',
                      'focus:ring-2 focus:border-transparent',
                      T.ring,
                    )}
                  >
                    <option value="">odakle…</option>
                    {ANCHOR_SOURCES.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  {src === ANCHOR_SOURCE_STATEMENT && (
                    <input
                      type="text"
                      value={srcDetail[key] ?? ''}
                      onChange={e => setSrcDetail(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="npr. RF_2026-07.pdf"
                      className={cn(
                        'w-40 px-2 py-1.5 border border-gray-300 rounded-lg text-sm',
                        'focus:ring-2 focus:border-transparent',
                        T.ring,
                      )}
                    />
                  )}

                  {/* ⚠ DATUM S PAPIRA — prazan, bez zadane vrijednosti.
                      Ovo je popravak BUG-S115-ANCHORDATE: prije je potvrda
                      nosila dan klika, pa je broj s izvoda zatvorenog 30.07.
                      dobio datum 22.08. i sve između tiho ispalo iz salda.
                      Bilo koji default koji bi app ponudio bio bi pogodak, a
                      pogodak koji izgleda kao podatak je točno ono što se
                      dogodilo. */}
                  {needsDate && (
                    <input
                      type="date"
                      value={srcDate[key] ?? ''}
                      max={today}
                      onChange={e => setSrcDate(prev => ({ ...prev, [key]: e.target.value }))}
                      title={src === ANCHOR_SOURCE_STATEMENT
                        ? 'Datum ZADNJE transakcije na izvodu — izvod se ne zatvara na kraju mjeseca.'
                        : 'Datum koji piše na ispisu.'}
                      className={cn(
                        'px-2 py-1.5 border rounded-lg text-sm',
                        'focus:ring-2 focus:border-transparent',
                        (srcDate[key] ?? '') ? 'border-gray-300' : 'border-amber-400 bg-amber-50',
                        T.ring,
                      )}
                    />
                  )}

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
                      disabled={
                        bank === null || !willConfirmOn || savingKey === key ||
                        (isScreen && !screenCalc)
                      }
                      className={cn(
                        'ml-auto text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        T.btnConfirm,
                      )}
                      title={
                        !src
                          ? 'Prvo odaberi odakle je broj — o tome ovisi na koji datum ide potvrda'
                          : !willConfirmOn
                            ? 'Upiši datum koji piše na papiru'
                            : `Spremi kao potvrđeno stanje na ${formatDateHr(willConfirmOn)} — saldo se od tog dana računa od njega`
                      }
                    >
                      {savingKey === key
                        ? 'Spremam…'
                        // Za papir gumb ponavlja UPISANI datum — to je provjera
                        // onoga što je čovjek utipkao. Za ekran datum nije
                        // njegov unos nego posljedica, pa ga objašnjava
                        // rečenica ispod; „Potvrdi na jučer" bi na gumbu
                        // izgledalo kao greška.
                        : willConfirmOn && !isScreen
                          ? `Potvrdi na ${formatDateHr(willConfirmOn)}`
                          : 'Potvrdi'}
                    </button>
                  )}
                </div>
              )}

              {/* --- što će potvrda značiti, PRIJE nego se klikne --- */}
              {widget.reconcile && canWrite && (
                <div className="mt-2 space-y-1.5">
                  {!src && bank !== null && (
                    <p className="text-[11px] text-amber-700">
                      Odaberi <strong>odakle</strong> je broj. O tome ovisi na koji datum ide
                      potvrda — a datum je ono što odlučuje koje transakcije ulaze u saldo.
                    </p>
                  )}

                  {needsDate && !willConfirmOn && (
                    <p className="text-[11px] text-amber-700">
                      Upiši <strong>datum koji piše na papiru</strong>
                      {src === ANCHOR_SOURCE_STATEMENT
                        ? ' — dan zadnje transakcije na izvodu. Izvod se ne zatvara na kraju mjeseca: srpanjski ZABA izvod završava 30.07., a prosinački zna završiti 24.12.'
                        : '.'}
                      {isPast && ` (Gledaš ${formatDateHr(effectiveAsOf)} — ako izvod nosi taj datum, upiši njega.)`}
                    </p>
                  )}

                  {/* Pravilo „strogo nakon" (§2.17), izrečeno posljedicom a ne
                      pravilom. Ovo je rečenica koja bi uhvatila BUG-S115: uz
                      22.08. bi pisalo da se sve prije toga smatra uključenim,
                      a to je bilo očito netočno za retke od 31.07. nadalje. */}
                  {willConfirmOn && bank !== null && !isScreen && (
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Saldo će se računati ovako: <strong>{formatAmount(bank, widget.unit)}</strong>{' '}
                      plus sve što je datirano <strong>nakon {formatDateHr(willConfirmOn)}</strong>.
                      Sve prije toga smatra se da je <strong>već uključeno</strong> u ovaj broj —
                      pa ako datum promašiš, transakcije između tiho ispadnu iz salda.
                    </p>
                  )}

                  {/* ── EKRAN: računica se ispisuje PRIJE spremanja ──────────
                      Mehanizam je točan samo dok app zna sve današnje
                      transakcije. To nije nešto što kod može provjeriti, pa se
                      pokazuje: broj zapisa i njihov zbroj. Ako brojka ne
                      odgovara stvarnosti, vidi se ovdje, prije klika — a ne
                      mjesecima kasnije, zamrznuta u sidru. */}
                  {isScreen && bank !== null && screenCalc && (
                    <div className="text-[11px] text-gray-500 leading-snug rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
                      <p>
                        Očitanje s ekrana vrijedi za <strong>ovaj trenutak</strong>, a potvrda zna
                        samo za cijele dane. Zato se sprema kao stanje na{' '}
                        <strong>kraju {formatDateHr(screenCalc.on)}</strong>, umanjeno za današnji
                        promet — tako današnje transakcije <strong>ostaju</strong> u saldu:
                      </p>
                      {/* ⚠ Promet je NEGATIVAN kad se trošilo, pa bi doslovno
                          „očitano − promet" ispalo „13.815,33 − −40,00".
                          Predznak se zato okreće u prikazu: oduzimanje
                          negativnog prometa JEST zbrajanje. */}
                      <p className="mt-1 tabular-nums">
                        {formatAmount(bank, widget.unit)}
                        {' '}{screenCalc.move <= 0 ? '+' : '−'}{' '}
                        <span className="font-medium">
                          {formatAmount(Math.abs(screenCalc.move), widget.unit)}
                        </span>
                        {screenCalc.n > 0 && (
                          <span className="text-gray-400"> ({screenCalc.n} danas)</span>
                        )}
                        {' = '}
                        <strong>{formatAmount(screenCalc.amount, widget.unit)}</strong>
                        {' '}na {formatDateHr(screenCalc.on)}
                      </p>
                      <p className="mt-1">
                        {screenCalc.move === 0
                          ? '⚠ App nema nijedan zapis datiran danas. Ako je danas bilo transakcija, prvo ih upiši — inače se razlika zamrzne u potvrdu i više se ne vidi.'
                          : '⚠ Provjeri da app zna za SVE današnje transakcije. Ona koja fali ne javlja grešku — upiše se u potvrdu i tiho nestane.'}
                      </p>
                    </div>
                  )}

                  {/* ⚠ Δ iznad uspoređuje saldo NA DAN IZ FILTRA s onim što je
                      upisano. Broj s ekrana banke je današnji, pa uz prošli
                      filtar te dvije stvari nisu usporedive — potvrda je i
                      dalje ispravna, ali kvačica/Δ nisu. Ne blokira se: pravi
                      odgovor je reći što broj znači, ne sakriti gumb. */}
                  {isScreen && isPast && (
                    <p className="text-[11px] text-amber-700 leading-snug">
                      ⚠ Filtar je na {formatDateHr(effectiveAsOf)}, a broj s ekrana banke je
                      <strong> današnji</strong>. Potvrda je ispravna, ali <strong>Δ iznad se
                      odnosi na {formatDateHr(effectiveAsOf)}</strong> i s ovim brojem nije
                      usporediv. Za usklađenje makni datumski filtar.
                    </p>
                  )}

                  {isScreen && bank !== null && !screenCalc && (
                    <p className="text-[11px] text-red-700">
                      Današnji promet se nije dao izračunati, pa se potvrda s ekrana ne može
                      spremiti. Osvježi pločicu (↻).
                    </p>
                  )}

                  {/* Ispravak unatrag koji ne ispravlja ništa — dvaput u pet
                      sesija. Bez ove poruke izgleda kao da je prošao. */}
                  {shadowedBy && (
                    <p className="text-[11px] text-red-700 leading-snug">
                      ⚠ Za ovaj račun već postoji potvrda na{' '}
                      <strong>{formatDateHr(shadowedBy.confirmed_on)}</strong>{' '}
                      ({formatAmount(shadowedBy.amount, widget.unit)}). Nova na{' '}
                      {formatDateHr(willConfirmOn!)} je <strong>neće</strong> nadjačati — saldo i
                      dalje kreće od novije. Ako je novija kriva, obriši je u „povijesti potvrda".
                    </p>
                  )}
                </div>
              )}

              {/* --- povijest potvrda: jedini put da se kriva potvrda VIDI --- */}
              {widget.reconcile && groupAnchors.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="text-[11px] text-gray-400 hover:text-gray-600 underline decoration-dotted"
                  >
                    {showHistory[key] ? 'sakrij' : 'povijest potvrda'} ({groupAnchors.length})
                  </button>

                  {showHistory[key] && (
                    <ul className="mt-1.5 space-y-1">
                      {groupAnchors.map((a, i) => (
                        <li
                          key={a.id}
                          className={cn(
                            'flex items-baseline gap-2 text-[11px] rounded px-2 py-1',
                            // `036` uzima najnoviju <= danas; popis je sortiran
                            // silazno, pa je prva koja nije u budućnosti ta.
                            i === groupAnchors.findIndex(x => x.confirmed_on <= today)
                              ? 'bg-teal-50 text-gray-700'
                              : 'text-gray-400',
                          )}
                        >
                          <span className="shrink-0 w-4">
                            {i === groupAnchors.findIndex(x => x.confirmed_on <= today) ? '▸' : ''}
                          </span>
                          <span className="tabular-nums shrink-0">{formatDateHr(a.confirmed_on)}</span>
                          <span className="tabular-nums font-medium shrink-0">
                            {formatAmount(a.amount, widget.unit)}
                          </span>
                          <span className="truncate" title={a.note ?? undefined}>
                            {a.note ?? <em>bez podrijetla</em>}
                          </span>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => void removeAnchor(a)}
                              disabled={deletingId === a.id}
                              title="Obriši ovu potvrdu"
                              className="ml-auto shrink-0 text-gray-300 hover:text-red-600 disabled:opacity-40 px-1"
                            >
                              {deletingId === a.id ? '…' : '✕'}
                            </button>
                          )}
                        </li>
                      ))}
                      <li className="text-[10px] text-gray-400 pt-0.5">
                        ▸ = potvrda od koje saldo trenutno kreće. Starije su samo povijest;
                        novija od nje uvijek pobjeđuje.
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Δ is a signal, not a verdict — say so once, under the tile. */}
      {widget.reconcile && rows.length > 0 && !error && (
        <div className="text-[11px] text-gray-400 mt-3 leading-snug space-y-1">
          <p>
            Δ znači da se aplikacija i banka razilaze — nešto fali, nešto je dvaput, ili je iznos
            kriv. Nije greška izračuna.
          </p>
          <p>
            <strong className="text-gray-500">Zašto je datum potvrde važan:</strong> saldo se računa
            kao <em>potvrđeni broj + sve što je datirano poslije njega</em>. Sve prije toga smatra se
            već uključenim. Zato datum mora biti onaj na kojem je broj stvarno očitan:
            {' '}<em>ekran banke → danas</em>, <em>izvod → dan zadnje transakcije na izvodu</em>.
            Promašen datum ne javlja grešku — transakcije između tiho ispadnu iz salda.
          </p>
        </div>
      )}
    </div>
  );
}
