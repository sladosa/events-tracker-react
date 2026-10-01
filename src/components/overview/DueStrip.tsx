// ============================================================
// DueStrip.tsx — „Čeka potvrdu": dospjele kartične košare
// ============================================================
// Spec: docs/DOSPJELO_SPEC.md §3 (košara, ne redak), §4 (kako Koka to vidi),
//       §5 (potvrda i što kad se NE slaže), §8 (D1–D6).
//
// Traka stoji IZNAD pločice salda i postoji samo kad ima čega (isto načelo
// kao OQ-4). Koka u banci vidi JEDAN broj po kartici; traka joj pokaže Σ
// košare i polje za taj broj, pa se jedan broj uspoređuje s jednim brojem.
//
// Faza 2 (S156) — četiri stanja košare (`basketAction`):
//   • slaže se, nema skupnog retka  → `Potvrdi`: skupni `Racun` redak + statusi
//   • ne slaže se, nema retka       → `Upiši naplatu kako ju je banka skinula`:
//                                     SAMO skupni redak; saldo slijedi banku,
//                                     košara ostaje otvorena (D2)
//   • redak postoji, slaže se       → `Potvrdi`: samo statusi
//   • redak postoji, ne slaže se    → „naplaćeno — neusklađeno" (D6), bez gumba
//
// ⚠ NIKAD „naplaćeno" bez skupnog retka — samo „provjeri u banci". Dospijeće
//   nije dokaz naplate (odbačeni automat, OVERVIEW §2.5a).
// ⚠ Neuspjelo čitanje se KAŽE. Traka koja zbog greške nestane izgleda točno
//   kao „ništa ne čeka" — a to je tvrdnja o novcu (S121).
// ⚠ Polja „banka skinula" i „dana" se ne pune unaprijed: Σ bi učinio provjeru
//   tautološkom (§2.17), a pogođen datum izgleda kao podatak (BUG-S115).
// ⚠ Potvrđuje SAMO vlasnica Aree (D5). Grantee vidi traku, ali ne gumb.
// ⚠ Svaki upis ide u DVA koraka (sažetak pa „Da"): na mobitelu je jedan
//   promašen dodir inače upisan novac.
// ⚠ Pravilo C (S157): prije upisa skupnog retka traka traži RUČNI redak istog
//   iznosa na računu (`findSuspectRows`). Ako ga ima, pita „je li to ova
//   naplata?" — „Da" ga ispravlja u prepoznatljiv oblik (opis + Tip/Podtip iz
//   configa), „Ne" tek onda pušta upis. Bez toga je ručno upisana naplata
//   (bez opisa) dobila DRUGI skupni redak — izmjereno u T-S156-1.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { fetchDueBaskets, type DueBasketRow } from '@/lib/overviewApi';
import { basketAction, basketNetCents, SETTLE_WINDOW_DAYS, type SettleMatch } from '@/lib/dueBaskets';
import { adoptSettleRow, attributeNames, findSettleRow, findSuspectRows, settleBasket, type SuspectRow } from '@/lib/dueConfirm';
import { formatAmount, formatDateHr, parseAmountInput, todayIso } from '@/lib/amountFormat';
import { cn } from '@/lib/cn';
import type { BalanceByGroupWidget, DueConfig, UUID } from '@/types/database';

interface Props {
  areaId: UUID;
  widget: BalanceByGroupWidget & { due: DueConfig };
  /** D5: samo vlasnica Aree potvrđuje. */
  isOwner: boolean;
  /** Nakon upisa — pločica salda mora se osvježiti (skupni redak je miče). */
  onSettled?: () => void;
}

const stavki = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'stavka'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'stavke'
  : 'stavki';

const redaka = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'redak'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'retka'
  : 'redaka';

/** Stanje traženja skupnog retka po košari. `undefined` = još se traži. */
type SettleState = SettleMatch | null | { error: string };
const isErr = (s: SettleState | undefined): s is { error: string } =>
  !!s && typeof s === 'object' && 'error' in s;

type Armed = 'confirm' | 'record' | 'flip';

export function DueStrip({ areaId, widget, isOwner, onSettled }: Props) {
  const { due, unit } = widget;
  const [rows, setRows] = useState<DueBasketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settle, setSettle] = useState<Record<string, SettleState>>({});
  const [bankInput, setBankInput] = useState<Record<string, string>>({});
  const [dateInput, setDateInput] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState<Record<string, Armed | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** Pravilo C po košari: ručni retci koji izgledaju kao ova naplata + što je čovjek htio. */
  const [suspects, setSuspects] = useState<Record<string, { list: SuspectRow[]; kind: 'confirm' | 'record' } | undefined>>({});
  const [dismissed, setDismissed] = useState<Record<string, string[]>>({});
  const [adopting, setAdopting] = useState<Record<string, string | undefined>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setArmed({});
    setSuspects({});
    setAdopting({});
    // Imena atributa samo za tekst ispravka — neuspjeh nije kvar, pada na slug.
    attributeNames(areaId, [...Object.keys(due.settle ?? {}), due.status_slug])
      .then(setNames).catch(() => setNames({}));
    try {
      const fresh = await fetchDueBaskets({
        areaId, due,
        plusSlug: widget.plus ?? null,
        minusSlug: widget.minus ?? null,
        asOf: todayIso(),
      });
      setRows(fresh);
      setSettle({});
      // Skupni redak po košari — usporedno; neuspjeh jedne ne gasi ostale.
      const found = await Promise.all(fresh.map(async r => {
        const key = `${r.basket}|${r.due_date}`;
        try {
          return [key, await findSettleRow(areaId, widget, r.basket, r.due_date)] as const;
        } catch (e) {
          return [key, { error: (e as { message?: string })?.message ?? String(e) }] as const;
        }
      }));
      setSettle(Object.fromEntries(found));
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [areaId, due, widget]);

  useEffect(() => { void load(); }, [load]);

  const run = async (row: DueBasketRow, kind: Armed, bankCents?: number, bankDate?: string) => {
    const key = `${row.basket}|${row.due_date}`;
    setBusy(key);
    try {
      const res = await settleBasket({
        areaId, w: widget, basket: row.basket, dueDate: row.due_date, kind,
        shownSumCents: basketNetCents(row), bankCents, bankDate,
        suspectsDismissed: dismissed[key] ?? [],
      });
      toast.success(
        [res.settleRowId ? 'Naplata upisana' : null,
         res.flipped > 0 ? `${res.flipped} ${redaka(res.flipped)} potvrđeno` : null]
          .filter(Boolean).join(' · ') || 'Gotovo',
      );
      setBankInput(prev => ({ ...prev, [key]: '' }));
      setDateInput(prev => ({ ...prev, [key]: '' }));
      setDismissed(prev => ({ ...prev, [key]: [] }));
      onSettled?.();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? String(e), { duration: 8000 });
    } finally {
      setBusy(null);
      void load();
    }
  };

  /** Klik na „Potvrdi"/„Upiši": prvo pravilo C, tek onda sažetak upisa. */
  const check = async (row: DueBasketRow, kind: 'confirm' | 'record', bankCents?: number, bankDate?: string) => {
    const key = `${row.basket}|${row.due_date}`;
    if (bankCents == null || !bankDate) return;
    setBusy(key);
    try {
      const list = (await findSuspectRows(areaId, widget, row.basket, bankCents, bankDate))
        .filter(s => !(dismissed[key] ?? []).includes(s.id));
      if (list.length > 0) setSuspects(prev => ({ ...prev, [key]: { list, kind } }));
      else setArmed(prev => ({ ...prev, [key]: kind }));
    } catch (e) {
      // Neuspjelo čitanje NIJE „nema ga" — bez odgovora nema ni upisa (S121).
      toast.error(`Nisam uspio provjeriti je li naplata već upisana rukom — ne upisujem. ${(e as { message?: string })?.message ?? String(e)}`, { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const adopt = async (row: DueBasketRow, s: SuspectRow, bankCents: number, bankDate: string) => {
    const key = `${row.basket}|${row.due_date}`;
    setBusy(key);
    try {
      await adoptSettleRow({ areaId, w: widget, basket: row.basket, eventId: s.id, bankCents, bankDate });
      toast.success('Redak ispravljen — sada je prepoznat kao naplata');
      setBankInput(prev => ({ ...prev, [key]: '' }));
      setDateInput(prev => ({ ...prev, [key]: '' }));
      setDismissed(prev => ({ ...prev, [key]: [] }));
      onSettled?.();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? String(e), { duration: 8000 });
    } finally {
      setBusy(null);
      void load();
    }
  };

  /** Promjena iznosa ili dana poništava sve odgovore za tu košaru. */
  const resetAnswers = (key: string) => {
    setArmed(prev => ({ ...prev, [key]: undefined }));
    setSuspects(prev => ({ ...prev, [key]: undefined }));
    setAdopting(prev => ({ ...prev, [key]: undefined }));
    setDismissed(prev => ({ ...prev, [key]: [] }));
  };

  // Ništa ne čeka ⇒ trake nema. Dok se učitava također ništa: traka koja
  // bljesne i nestane gora je od one koja se pojavi kad ima što reći.
  // ⚠ `rows` se ne prazne na početku osvježavanja — traka ne smije nestati
  //   dok se osvježava (↻, ili nakon upisa), inače izgleda kao da je sve gotovo.
  if (!error && rows.length === 0) return null;

  const today = todayIso();

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-amber-900 text-sm sm:text-base">
          Čeka potvrdu{rows.length > 0 ? ` (${rows.length})` : ''}
        </h3>
        <button
          onClick={() => void load()}
          disabled={loading || busy !== null}
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
          const st = settle[key];
          const match = st && !isErr(st) ? st : null;
          const typed = bankInput[key] ?? '';
          const bank = typed.trim() === '' ? null : (parseAmountInput(typed) ?? NaN);
          const bankDate = dateInput[key] ?? '';
          const act = basketAction({
            sumCents: sum, settle: match, bank, bankDate: bankDate || null,
            dueDate: row.due_date, today,
          });
          const rowBusy = busy === key;
          const canAct = isOwner && st !== undefined && !isErr(st) && !loading && busy === null;
          const arm = armed[key];
          const bankCents = bank !== null && Number.isFinite(bank) ? Math.round(bank * 100) : undefined;
          const susp = suspects[key];
          const sus = susp?.list[0];
          const adoptId = adopting[key];
          const nameOf = (slug: string) => names[slug] ?? slug;
          const shownSlugs = Object.keys(due.settle ?? {}).filter(s => s !== due.basket_by);

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

              {/* I tijekom osvježavanja: košara bez ičega ispod Σ izgleda kao da je nešto nestalo (T-S157-1). */}
              {st === undefined && (
                <p className="mt-1 text-xs text-gray-500">tražim je li naplata već upisana…</p>
              )}
              {isErr(st) && (
                <p className="mt-1 text-xs text-red-700 break-words">
                  Nisam uspio provjeriti je li naplata već upisana — zato ne nudim upis (↻). {st.error}
                </p>
              )}

              {/* Skupni redak već postoji: bankin broj JE njegov iznos. */}
              {match && (
                <div className="mt-2 text-sm">
                  <p className="text-gray-700">
                    Naplata upisana {formatDateHr(match.date)}:{' '}
                    <span className="font-semibold tabular-nums">{formatAmount(match.amountCents / 100, unit)}</span>
                    {act.kind === 'flip' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✓ slaže se
                      </span>
                    )}
                  </p>
                  {match.count > 1 && (
                    <p className="mt-1 text-xs text-red-700">
                      Našao sam {match.count} takva retka unutar {SETTLE_WINDOW_DAYS} dana — vjerojatno je naplata upisana dvaput. Provjeri u Activities.
                    </p>
                  )}
                  {act.kind === 'mismatch' && (
                    <div className="mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 tabular-nums">
                        naplaćeno — neusklađeno · razlika {formatAmount(act.diffCents / 100, unit)}
                      </span>
                      <p className="mt-1 text-xs text-amber-800">
                        {act.diffCents > 0
                          ? 'Košara je veća od naplate — neki redak možda pripada drugoj košari, ili je upisan dvaput.'
                          : 'Banka je skinula više — neka kupovina možda nije upisana, ili je upisana s krivim datumom naplate.'}
                        {' '}Saldo je točan (slijedi banku). Ispravi redak košare; kad se Σ poklopi, ovdje se pojavi potvrda.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Nema skupnog retka: bankin broj i dan upisuje čovjek. */}
              {!match && !isErr(st) && st !== undefined && (
                <>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-gray-600" htmlFor={`due-${key}`}>banka skinula</label>
                    <input
                      id={`due-${key}`}
                      type="text"
                      inputMode="decimal"
                      value={typed}
                      onChange={e => { setBankInput(prev => ({ ...prev, [key]: e.target.value })); resetAnswers(key); }}
                      placeholder="upiši s ekrana banke"
                      className={cn(
                        'w-36 px-2 py-1 text-sm border rounded tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400',
                        act.kind === 'none' && act.reason === 'unreadable' ? 'border-red-400 bg-red-50' : 'border-gray-300',
                      )}
                    />
                    {isOwner && (
                      <>
                        <label className="text-xs text-gray-600" htmlFor={`due-d-${key}`}>dana</label>
                        <input
                          id={`due-d-${key}`}
                          type="date"
                          value={bankDate}
                          max={today}
                          onChange={e => { setDateInput(prev => ({ ...prev, [key]: e.target.value })); resetAnswers(key); }}
                          className={cn(
                            'px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-amber-400',
                            act.kind === 'none' && (act.reason === 'date-far' || act.reason === 'date-future')
                              ? 'border-red-400 bg-red-50' : 'border-gray-300',
                          )}
                        />
                      </>
                    )}
                    {act.kind === 'confirm' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✓ slaže se
                      </span>
                    )}
                    {act.kind === 'record' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                        razlika {formatAmount(act.diffCents / 100, unit)}
                      </span>
                    )}
                  </div>
                  {act.kind === 'record' && (
                    <p className="mt-1 text-xs text-amber-800">
                      {act.diffCents > 0
                        ? 'Košara je veća od naplate — neki redak možda pripada drugoj košari, ili je upisan dvaput.'
                        : 'Banka je skinula više — neka kupovina možda nije upisana, ili je upisana s krivim datumom naplate.'}
                    </p>
                  )}
                  {isOwner && act.kind === 'none' && bank !== null && (
                    <p className="mt-1 text-xs text-gray-600">
                      {act.reason === 'no-date' && 'Upiši i dan kad je banka skinula — s ekrana banke, ne pogađaj.'}
                      {act.reason === 'date-future' && 'Taj dan još nije došao.'}
                      {act.reason === 'date-far' && `Banka tereti oko ${formatDateHr(row.due_date)} (najviše ${SETTLE_WINDOW_DAYS} dana razlike) — provjeri dan.`}
                      {act.reason === 'not-positive' && 'Iznos mora biti veći od nule.'}
                    </p>
                  )}
                </>
              )}

              {/* Gumbi — samo vlasnica (D5). */}
              {!isOwner && (act.kind === 'confirm' || act.kind === 'record' || act.kind === 'flip') && (
                <p className="mt-2 text-xs text-gray-600">Potvrđuje vlasnica Aree — ti vidiš usporedbu, ali ne upisuješ.</p>
              )}
              {isOwner && !arm && !sus && (act.kind === 'confirm' || act.kind === 'record' || act.kind === 'flip') && (
                <div className="mt-2">
                  <button
                    disabled={!canAct}
                    onClick={() => act.kind === 'flip'
                      ? setArmed(prev => ({ ...prev, [key]: 'flip' }))
                      : void check(row, act.kind as 'confirm' | 'record', bankCents, bankDate || undefined)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-40',
                      act.kind === 'record'
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700',
                    )}
                  >
                    {rowBusy ? 'Provjeravam…' : act.kind === 'record' ? 'Upiši naplatu kako ju je banka skinula' : 'Potvrdi'}
                  </button>
                </div>
              )}

              {/* Pravilo C: ručni redak istog iznosa — prvo pitanje, pa ispravak. */}
              {isOwner && sus && susp && adoptId !== sus.id && (
                <div className="mt-2 rounded-lg border border-amber-400 bg-amber-100/60 px-3 py-2 text-sm text-gray-800">
                  <p>
                    Na računu <span className="font-medium">{cfg?.account}</span> već postoji isplata{' '}
                    <span className="font-semibold tabular-nums">{bankCents != null ? formatAmount(bankCents / 100, unit) : '?'}</span>{' '}
                    od {formatDateHr(sus.date)}
                    {/* S imenom: goli niz vrijednosti („Domaćinstvo / Isplata / …") čita se kao kategorija. */}
                    {shownSlugs.length > 0 && <> · {shownSlugs.map(s => `${nameOf(s)}: ${String(sus.values[s] ?? '—')}`).join(' · ')}</>}
                    {' '}· opis „{sus.comment || '—'}”.
                  </p>
                  <p className="mt-1 font-medium">Je li to ova naplata?</p>
                  {susp.list.length > 1 && (
                    <p className="mt-1 text-xs text-red-700">Takvih redaka ima {susp.list.length} — pitam za svaki redom.</p>
                  )}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button
                      disabled={rowBusy}
                      onClick={() => setAdopting(prev => ({ ...prev, [key]: sus.id }))}
                      className="px-3 py-1.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Da, to je ona
                    </button>
                    <button
                      disabled={rowBusy}
                      onClick={() => {
                        const rest = susp.list.slice(1);
                        setDismissed(prev => ({ ...prev, [key]: [...(prev[key] ?? []), sus.id] }));
                        setSuspects(prev => ({ ...prev, [key]: rest.length > 0 ? { list: rest, kind: susp.kind } : undefined }));
                        if (rest.length === 0) setArmed(prev => ({ ...prev, [key]: susp.kind }));
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40"
                    >
                      Ne, to je nešto drugo
                    </button>
                    <button
                      disabled={rowBusy}
                      onClick={() => setSuspects(prev => ({ ...prev, [key]: undefined }))}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}
              {isOwner && sus && adoptId === sus.id && (
                <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                  <p>
                    Skupnu naplatu kartice s računa vodimo s opisom <i>„{cfg?.text}”</i>
                    {Object.keys(due.settle ?? {}).length > 0 && (
                      <> i kao {Object.entries(due.settle ?? {}).map(([s, v]) => `${nameOf(s)} = ${v}`).join(', ')}</>
                    )}
                    {' '}— po tome je prepoznaju traka i alati.
                  </p>
                  {sus.changes.length > 0 ? (
                    <>
                      <p className="mt-1">Ispravit ću:</p>
                      <ul className="mt-1 ml-4 list-disc text-xs">
                        {sus.changes.map(c => (
                          <li key={c.slug ?? '@comment'}>
                            {c.slug === null ? 'Opis' : nameOf(c.slug)}: „{c.from || '—'}” → „{c.to}”
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-1 text-xs">Redak je već u ispravnom obliku.</p>
                  )}
                  <p className="mt-1 text-xs text-gray-600">Iznos, račun i datum ostaju kakvi jesu.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={rowBusy || bankCents == null || !bankDate}
                      onClick={() => { if (bankCents != null && bankDate) void adopt(row, sus, bankCents, bankDate); }}
                      className="px-3 py-1.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      {rowBusy ? 'Ispravljam…' : 'U redu, ispravi'}
                    </button>
                    <button
                      disabled={rowBusy}
                      onClick={() => setAdopting(prev => ({ ...prev, [key]: undefined }))}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}
              {isOwner && arm && (
                <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                  {(arm === 'confirm' || arm === 'record') && (
                    <p>
                      Upisat ću redak <i>{cfg?.text}</i> · {cfg?.account} ·{' '}
                      {bankDate ? formatDateHr(bankDate) : '?'} ·{' '}
                      <span className="font-semibold tabular-nums">
                        {bankCents != null ? formatAmount(bankCents / 100, unit) : '?'}
                      </span>.
                    </p>
                  )}
                  {(arm === 'confirm' || arm === 'flip') && (
                    <p>
                      {row.n_pending} {redaka(row.n_pending)} košare prelazi „{due.pending}” → „{due.done ?? '?'}”.
                    </p>
                  )}
                  {arm === 'record' && (
                    <p className="text-amber-800">
                      Retci košare ostaju „{due.pending}”, a košara ostaje ovdje dok se razlika ne riješi. Saldo odmah slijedi banku.
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={!canAct || rowBusy}
                      onClick={() => void run(row, arm, bankCents, bankDate || undefined)}
                      className="px-3 py-1.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      {rowBusy ? 'Upisujem…' : 'Da, upiši'}
                    </button>
                    <button
                      disabled={rowBusy}
                      onClick={() => setArmed(prev => ({ ...prev, [key]: undefined }))}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Provjeri u bankovnoj aplikaciji koliko je skinuto i kojeg dana.
        </p>
      )}
    </div>
  );
}
