// ============================================================
// basketsView.ts — pločica „Košare": otvorene kartične košare po računu
// i koliko ostaje kad prođu (S171, Saša; Backlog „Pločica Košare")
// ============================================================
// Ista ideja kao delta sekcija S170 (grupe po datumu naplate), u aplikaciji.
//
// ⚠ Košara je ISTA definicija kao u traci „Čeka potvrdu" (`rpc_area_due_baskets`
//   nad `app_due_rows`, 055) — ovdje samo s dalekim `as_of`, pa dolaze i buduće.
//   Druga kopija uvjeta bila bi prilika da se pločica i traka raziđu (S125).
// ⚠ „Ostaje" je TVRDNJA O NOVCU. Polazi od salda s ISTIM filtrima kao pločica
//   salda (S112) i oduzima SAMO košare — buduće plaće i ostala terećenja ne zna,
//   i to natpis mora reći.
// ⚠ Košara čija je skupna naplata VEĆ UPISANA (traka: „redak postoji") je već
//   u saldu — oduzeti je opet znači brojati je dvaput. Zato `settled`.
// ⚠ Sve u lipama (S145): zbrajanje decimala nosi grešku binarnog zapisa.
// ============================================================

import { basketSumCents, basketWindow, daysBetween } from './dueBaskets';
import type { DueBasketRow } from './overviewApi';
import type { DueConfig } from '@/types/database';

export const basketKey = (r: { basket: string; due_date: string }) => `${r.basket}|${r.due_date}`;

/**
 * Može li skupna naplata ove košare već postojati? Samo kad je danas unutar
 * (ili iza) početka prozora naplate — prije toga banka nije mogla teretiti,
 * pa ni redak ne može postojati (štedi upit po budućoj košari).
 */
export function needsSettleCheck(dueDate: string, today: string, cfg?: DueConfig['baskets'][string] | null): boolean {
  return daysBetween(today, dueDate) <= basketWindow(cfg).before;
}

export interface BasketViewRow {
  key: string;
  basket: string;
  due_date: string;
  n: number;
  n_pending: number;
  /** Σ košare po mjeri iz configa (Visa bruto), u lipama — ono što banka skida. */
  sumCents: number;
  /** Skupna naplata već upisana ⇒ novac je već u saldu, ne oduzima se. */
  settled: boolean;
  /** Dan naplate je procjena (košara s prozorom, Visa) ⇒ prikaz `~`. */
  estimate: boolean;
  /** Dospijeće prošlo, a košara još otvorena (traka „Čeka potvrdu"). */
  overdue: boolean;
  /** Stanje računa kad prođe i ova košara; `null` = saldo računa nepoznat. */
  remainingCents: number | null;
}

export interface BasketAccountGroup {
  account: string;
  /** Saldo računa danas, u lipama; `null` = nema ga među grupama pločice salda. */
  balanceCents: number | null;
  rows: BasketViewRow[];
}

/**
 * Košare grupirane po računu s kojeg ih banka skida (`due.baskets[k].account`),
 * unutar računa po dospijeću; „ostaje" je kumulativno. Računi idu redom prve
 * košare, pa je na vrhu uvijek ono što prvo dospijeva.
 */
export function planBasketView(p: {
  baskets: DueBasketRow[];
  due: DueConfig;
  /** Saldo danas po vrijednosti računa (isti filtri kao pločica salda). */
  balances: Map<string, number>;
  settled: Set<string>;
  today: string;
}): BasketAccountGroup[] {
  const sorted = [...p.baskets]
    .filter(r => r.n_pending > 0 && p.due.baskets[r.basket])
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.basket.localeCompare(b.basket));

  const groups = new Map<string, BasketAccountGroup>();
  const running = new Map<string, number | null>();

  for (const r of sorted) {
    const cfg = p.due.baskets[r.basket];
    const account = cfg.account;
    if (!groups.has(account)) {
      const bal = p.balances.get(account);
      const balanceCents = bal === undefined ? null : Math.round(bal * 100);
      groups.set(account, { account, balanceCents, rows: [] });
      running.set(account, balanceCents);
    }
    const key = basketKey(r);
    const sumCents = basketSumCents(r, cfg);
    const settled = p.settled.has(key);
    let rem = running.get(account) ?? null;
    if (rem !== null && !settled) rem -= sumCents;
    running.set(account, rem);
    groups.get(account)!.rows.push({
      key, basket: r.basket, due_date: r.due_date, n: r.n, n_pending: r.n_pending,
      sumCents, settled, estimate: !!cfg.window, overdue: r.due_date < p.today,
      remainingCents: rem,
    });
  }
  return [...groups.values()];
}

/** Ključ košare koja se rasklopi sama: prva koja još NIJE naplaćena. */
export function defaultOpenKey(groups: BasketAccountGroup[]): string | null {
  const all = groups.flatMap(g => g.rows).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (all.find(r => !r.settled) ?? all[0])?.key ?? null;
}
