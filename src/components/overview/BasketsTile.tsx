// ============================================================
// BasketsTile.tsx — „Košare": otvorene kartične košare i koliko ostaje
// ============================================================
// S171 (Saša): delta sheet od S170 pokazuje košare kao grupe po datumu
// naplate; ovo je isto u aplikaciji. Traka „Čeka potvrdu" pokazuje samo
// DOSPJELE košare i samo Σ — ovdje su i buduće (MC 11.11., rate 11.12.,
// Visa ~05.), s kupnjama, i uz svaku koliko ostaje na računu kad prođe.
//
// Model: `src/lib/basketsView.ts` (čist, testiran). Ovdje samo I/O i prikaz.
// ⚠ Postoji samo uz `due` config pločice salda — isto načelo kao OQ-4.
// ⚠ Neuspjelo čitanje se KAŽE (S121): prazna pločica tvrdila bi „nema košara",
//   a to je tvrdnja o novcu.
// ⚠ Pločica NE gleda razdoblje filtra: košare su budućnost, a filtar
//   (This Year) je prošlost do danas.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLastViewed, setLastViewed } from '@/lib/lastViewed';
import { line2Parts, resolveColumns } from '@/lib/listColumns';
import { useListColumnValues } from '@/hooks/useListColumnValues';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { formatSigned, todayIso } from '@/lib/amountFormat';
import { fetchAnchoredBalance, fetchDueBaskets } from '@/lib/overviewApi';
import { fetchBasketLines, findSettleRow, type BasketLine } from '@/lib/dueConfirm';
import {
  basketKey, basketNavList, defaultOpenKey, lineSessionKey, needsSettleCheck, planBasketView, type BasketAccountGroup,
} from '@/lib/basketsView';
import type { BalanceByGroupWidget, DueConfig, ListColumnsConfig, UUID } from '@/types/database';

const T = THEME.overview;

/** Koje su košare rasklopljene — modul, ne storage: preživi View i povratak, F5 ne
 *  (isti obrazac kao harmonika i razrez, S166/S169). */
let lastExpanded: { area: UUID; keys: string[] } | null = null;

/** Daleki `as_of`: RPC trake vraća košare dospjele DO njega ⇒ ovako i buduće. */
const FAR_FUTURE = '9999-12-31';

type Widget = BalanceByGroupWidget & { due: DueConfig };

interface Props {
  areaId: UUID;
  widget: Widget;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  /** Traka „pokaži kupnje" ⇒ ova košara se rasklopi i dovede u vidik.
   *  Oblik `basket|due#n` — `n` raste, pa i ponovljen zahtjev za istu košaru opali. */
  focusKey?: string | null;
  /** Promjena = upis u traci ili saldu ⇒ učitaj ponovo. */
  reloadToken?: number;
  /** `settings.list_columns` — kupnja se piše kao drugi redak uske liste (Tip/Podtip · opis). */
  listColumns?: ListColumnsConfig | null;
  /** „Isti dan u Activities ↗" — sve kupnje tog dana (i sve rate plana: dijele dan kupnje). */
  onShowDay?: (day: string) => void;
}

/** `2026-11-11` → `11.11.` (godina samo kad nije tekuća, isto kao lista, S119). */
const shortDate = (iso: string, today: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y === today.slice(0, 4) ? `${d}.${m}.` : `${d}.${m}.${y.slice(2)}.`;
};

const kupnji = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'kupnja'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'kupnje'
  : 'kupnji';

type Lines = BasketLine[] | { error: string } | undefined;
const isLinesErr = (l: Lines): l is { error: string } => !!l && !Array.isArray(l);

export function BasketsTile({ areaId, widget, collapsed, onToggleCollapsed, focusKey, reloadToken, listColumns, onShowDay }: Props) {
  const nav = useNavigate();
  // Redak na kojem je čovjek u View-u STAO (i nakon Prev/Next) — označava se po povratku
  // (T-S171-4, Saša: „teško je prepoznati iz kojeg si eventa došao natrag"). `lastViewed.ts`.
  const returnedKey = getLastViewed();
  const { due, unit } = widget;
  const [groups, setGroups] = useState<BasketAccountGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string[] | null>(
    lastExpanded && lastExpanded.area === areaId ? lastExpanded.keys : null,
  );
  const [lines, setLines] = useState<Record<string, Lines>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Tekst kupnje = drugi redak uske liste (S171, Saša: opisa nema uvijek ⇒ Tip/Podtip).
  // Iste kolone i ISTI hook kao lista — bez nove postavke i bez druge kopije pravila.
  const line2Cols = useMemo(() => resolveColumns(listColumns).filter(c => c.mobile === 'line2'), [listColumns]);
  const loadedLines = useMemo(
    () => Object.values(lines).filter((l): l is BasketLine[] => Array.isArray(l)).flat(),
    [lines],
  );
  const lineGroups = useMemo(() => basketNavList(loadedLines, areaId), [loadedLines, areaId]);
  const lineValues = useListColumnValues({ areaId, columns: line2Cols, activities: lineGroups });
  const today = todayIso();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = todayIso();
      const [baskets, balance] = await Promise.all([
        fetchDueBaskets({
          areaId, due, plusSlug: widget.plus ?? null, minusSlug: widget.minus ?? null, asOf: FAR_FUTURE,
        }),
        // ⚠ ISTI filtri i isti dan kao pločica salda (S112) — inače dvije brojke
        //   na istom ekranu pričaju dvije priče.
        fetchAnchoredBalance({
          areaId, groupSlug: widget.group_by, plusSlug: widget.plus ?? null,
          minusSlug: widget.minus ?? null, filters: widget.filters ?? [], asOf: t,
        }),
      ]);
      // Skupna naplata već upisana ⇒ košara je već u saldu (ne oduzima se dvaput).
      // Pita se samo gdje je moguća; neuspjelo čitanje ruši pločicu, jer bez
      // odgovora „ostaje" može biti krivo za cijelu košaru.
      const settledKeys = await Promise.all(
        baskets
          .filter(r => needsSettleCheck(r.due_date, t, due.baskets[r.basket]))
          .map(async r => ((await findSettleRow(areaId, widget, r.basket, r.due_date)) ? basketKey(r) : null)),
      );
      const balances = new Map<string, number>();
      for (const b of balance) if (b.group_value != null) balances.set(b.group_value, b.balance);
      setGroups(planBasketView({
        baskets, due, balances, settled: new Set(settledKeys.filter((k): k is string => !!k)), today: t,
      }));
      setLines({});
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [areaId, due, widget]);

  // Učitava se tek kad je pločica otvorena (harmonika) — i ponovo na upis drugdje.
  useEffect(() => {
    if (collapsed) return;
    void load();
  }, [collapsed, load, reloadToken]);

  const openKeys = useMemo(
    () => expanded ?? (groups ? [defaultOpenKey(groups)].filter((k): k is string => !!k) : []),
    [expanded, groups],
  );

  const loadLines = useCallback(async (key: string) => {
    const [basket, dueDate] = key.split('|');
    setLines(prev => ({ ...prev, [key]: undefined }));
    try {
      const l = await fetchBasketLines(areaId, widget, basket, dueDate);
      setLines(prev => ({ ...prev, [key]: l }));
    } catch (e) {
      setLines(prev => ({ ...prev, [key]: { error: (e as { message?: string })?.message ?? String(e) } }));
    }
  }, [areaId, widget]);

  // Retci rasklopljenih košara — dohvat kad se košara rasklopi (i nakon reloada).
  useEffect(() => {
    if (collapsed || !groups) return;
    for (const k of openKeys) if (!(k in lines)) void loadLines(k);
  }, [collapsed, groups, openKeys, lines, loadLines]);

  const setOpen = useCallback((keys: string[]) => {
    lastExpanded = { area: areaId, keys };
    setExpanded(keys);
  }, [areaId]);
  const toggle = (key: string) =>
    setOpen(openKeys.includes(key) ? openKeys.filter(k => k !== key) : [...openKeys, key]);

  // Traka „pokaži kupnje": rasklopi tu košaru i dovedi je u vidik — JEDNOM po
  // zahtjevu (`focusKey` nosi brojač), inače bi svaki dodir opet skrolao.
  const handledFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey || collapsed || !groups || handledFocus.current === focusKey) return;
    handledFocus.current = focusKey;
    const key = focusKey.split('#')[0];
    if (!openKeys.includes(key)) setOpen([...openKeys, key]);
    requestAnimationFrame(() => rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [focusKey, collapsed, groups, openKeys, setOpen]);

  // Povratak iz View: dovedi označenu kupnju u vidik — jednom po montiranju.
  const scrolledToLast = useRef(false);
  const lastRowRef = useCallback((el: HTMLTableRowElement | null) => {
    if (!el || scrolledToLast.current) return;
    scrolledToLast.current = true;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, []);

  const openRow = (l: BasketLine, basket: BasketLine[]) => {
    // Prev/Next u View-u ide kroz kupnje OVE košare, istim redom kao tablica.
    const state = { collapseFilter: true, navActivities: basketNavList(basket, areaId) };
    if (l.session_start) {
      nav(`/app/view/${encodeURIComponent(l.session_start)}?categoryId=${l.category_id}&userId=${l.user_id}`, { state });
    } else {
      nav(`/app/view/${l.event_id}?noSession=1&categoryId=${l.category_id}&userId=${l.user_id}`, { state });
    }
  };

  const nOpen = groups?.reduce((s, g) => s + g.rows.length, 0) ?? 0;

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border p-3 sm:p-4', T.tileBorder)} data-testid="baskets-tile">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onToggleCollapsed} className="min-w-0 text-left" disabled={!onToggleCollapsed}>
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
            <span className="text-gray-400 text-xs mr-1">{collapsed ? '▸' : '▾'}</span>
            Košare (otvorene){groups && !collapsed ? ` · ${nOpen}` : ''}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">kartične kupnje koje banka tek treba skinuti</p>
        </button>
        {!collapsed && (
          <button
            onClick={() => void load()}
            disabled={loading}
            title="Osvježi"
            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 px-2 py-1"
          >
            {loading ? '…' : '↻'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="font-medium">Nisam uspio učitati košare.</p>
              <p className="mt-1 font-mono text-xs break-words">{error}</p>
            </div>
          )}
          {!error && groups && groups.length === 0 && (
            <p className="text-sm text-gray-500">Nema otvorenih košara — sve kartične kupnje su naplaćene.</p>
          )}
          {!error && !groups && loading && <p className="text-sm text-gray-400">Učitavam…</p>}

          {groups?.map(g => (
            <div key={g.account}>
              <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1">
                <span className="text-sm font-medium text-gray-800 truncate">{g.account}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">
                  {g.balanceCents === null ? 'stanje nepoznato' : `danas ${formatSigned(g.balanceCents / 100, unit)}`}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {g.rows.map(r => {
                  const open = openKeys.includes(r.key);
                  const l = lines[r.key];
                  return (
                    <div key={r.key} ref={el => { rowRefs.current[r.key] = el; }} className="py-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(r.key)}
                        className="w-full flex items-start justify-between gap-2 text-left"
                        aria-expanded={open}
                      >
                        {/* Dva retka s obje strane (S172, Kokin mali iPhone): kartica · dan
                            nasuprot iznosu, broj kupnji nasuprot „ostaje". U jednom retku se
                            „· 35 kupnji" podvlačio pod iznos — razmak ispred njega bio je unutar
                            `nowrap`, pa redak nije imao gdje prijeći u novi. */}
                        <span className="min-w-0 text-sm text-gray-900">
                          <span className="block whitespace-nowrap">
                            <span className="text-gray-400 text-xs mr-1">{open ? '▾' : '▸'}</span>
                            <span className="font-medium">{r.basket}</span>
                            {' · '}
                            {r.estimate ? '~' : ''}{shortDate(r.due_date, today)}
                          </span>
                          <span className="block pl-3 text-xs text-gray-500">
                            {r.n} {kupnji(r.n)}
                            {r.overdue && !r.settled && (
                              <span className="text-amber-700"> · dospjelo, čeka potvrdu</span>
                            )}
                            {r.settled && <span> · naplata upisana, već u stanju</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-right whitespace-nowrap tabular-nums">
                          <span className="block text-sm font-medium text-gray-900">
                            {formatSigned(-r.sumCents / 100, unit)}
                          </span>
                          {r.remainingCents !== null && (
                            <span className="block text-xs text-gray-500">
                              ostaje {formatSigned(r.remainingCents / 100, unit)}
                            </span>
                          )}
                        </span>
                      </button>

                      {open && (
                        <div className="mt-1 ml-4">
                          {l === undefined && <p className="text-xs text-gray-400">Učitavam kupnje…</p>}
                          {isLinesErr(l) && (
                            <p className="text-xs text-red-700">
                              Nisam uspio učitati kupnje: <span className="font-mono">{l.error}</span>{' '}
                              <button className="underline" onClick={() => void loadLines(r.key)}>Pokušaj ponovno</button>
                            </p>
                          )}
                          {Array.isArray(l) && (
                            <table className="w-full text-xs">
                              <tbody>
                                {l.map(x => {
                                  const amt = (x.plus_v ?? 0) - (x.minus_v ?? 0);
                                  const pending = x.status === due.pending;
                                  const isLast = returnedKey !== null && lineSessionKey(x) === returnedKey;
                                  return (
                                    <tr
                                      key={x.event_id}
                                      ref={isLast ? lastRowRef : undefined}
                                      data-last-opened={isLast || undefined}
                                      onClick={() => openRow(x, l)}
                                      className={cn(
                                        'cursor-pointer hover:bg-gray-50',
                                        !pending && 'text-gray-400',
                                        isLast && cn(T.light, 'font-semibold outline outline-1 outline-teal-400'),
                                      )}
                                      title={pending ? 'Otvori redak' : `Status: ${x.status ?? '—'}`}
                                    >
                                      <td className="py-0.5 pr-2 whitespace-nowrap tabular-nums align-top">
                                        {shortDate(x.event_date, today)}
                                      </td>
                                      {/* ⚠ `w-full max-w-0` — bez gornje granice tekst rasteže tablicu (S119) */}
                                      {/* Dva retka (Saša, T-S171-6): Tip/Podtip, pa opis ispod — u
                                          jednom retku opis nije stao. Bez opisa ostaje jedan. */}
                                      <td className="py-1 pr-2 w-full max-w-0 align-top">
                                        {(() => {
                                          const p = line2Parts(line2Cols, lineValues.byKey.get(lineSessionKey(x))?.text, x.comment);
                                          if (!p.attrs && !p.comment) return <span className="block">—</span>;
                                          return (
                                            <>
                                              {p.attrs && <span className="block truncate">{p.attrs}</span>}
                                              {p.comment && (
                                                <span className={cn('block truncate', p.attrs && 'text-gray-500')}>{p.comment}</span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </td>
                                      <td className="py-0.5 text-right whitespace-nowrap tabular-nums align-top">
                                        {amt === 0 ? '—' : formatSigned(amt, unit)}
                                      </td>
                                      {onShowDay && (
                                        <td className="py-0.5 pl-1 align-top">
                                          <button
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              // Po povratku na Overview označen je ovaj redak, kao nakon View-a
                                              // (Saša, S175) — isti modul, pa ga označavanje i skrol već znaju.
                                              setLastViewed(lineSessionKey(x));
                                              onShowDay(x.event_date);
                                            }}
                                            title={`Isti dan u Activities (${shortDate(x.event_date, today)})`}
                                            aria-label={`Isti dan u Activities ${x.event_date}`}
                                            className="px-1 text-teal-700 hover:text-teal-900"
                                          >
                                            ↗
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {groups && groups.length > 0 && (
            <p className="text-xs text-gray-500">
              <strong>Ostaje</strong> = današnje stanje računa minus košare redom po datumu naplate.
              Plaće i ostale buduće uplate i isplate nisu uračunate.
              {groups.some(g => g.rows.some(r => r.estimate)) && ' ~ = dan naplate je procjena.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
