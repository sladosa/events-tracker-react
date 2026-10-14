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
import type { BasketLine } from './dueConfirm';
import type { ActivityEvent, ActivityGroup } from '@/hooks/useActivities';

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

/**
 * Prev/Next u View-u kroz KUPNJE OVE KOŠARE (T-S171-4, Saša: „jel se Prev/Next miču po
 * tabeli košare?"). Bez ovoga View sam učita cijelu Areu (500 redaka, bez datuma) pa Prev/Next
 * skače po svim transakcijama. View iz popisa čita samo `session_start`, kategoriju, autora i
 * id prvog eventa (`ViewDetailsPage`: `currentIndex`, `navigateToGroup`, prefetch) — ostala
 * polja su prazna namjerno. Redoslijed = redoslijed tablice u pločici (po datumu kupnje).
 * ⚠ Ključ grupe je isti kao u `useActivities` (`user_category_session`): dva eventa iste sesije
 *   su JEDAN redak liste, pa i jedan korak Prev/Next.
 */
/** Ključ retka liste — isti oblik kao `useActivities` i `highlightKey` koji View → Back šalje. */
export function lineSessionKey(l: Pick<BasketLine, 'user_id' | 'category_id' | 'session_start' | 'event_id'>): string {
  return l.session_start ? `${l.user_id}_${l.category_id}_${l.session_start}` : l.event_id;
}

export function basketNavList(lines: BasketLine[], areaId: string): ActivityGroup[] {
  const seen = new Set<string>();
  const out: ActivityGroup[] = [];
  for (const l of lines) {
    const sessionKey = lineSessionKey(l);
    if (seen.has(sessionKey)) continue;
    seen.add(sessionKey);
    const ev: ActivityEvent = {
      id: l.event_id, category_id: l.category_id, event_date: l.event_date,
      session_start: l.session_start, comment: l.comment, created_at: '', edited_at: '',
      edited_by: null, user_id: l.user_id, category_name: '', category_path: [],
      area_id: areaId, area_name: '', area_icon: null,
    };
    out.push({
      sessionKey, category_id: l.category_id, category_name: '', category_path: [],
      area_id: areaId, area_name: '', area_icon: null, event_date: l.event_date,
      session_start: l.session_start, events: [ev], eventCount: 1, has_photos: false,
      user_id: l.user_id, user_display_name: '', edited_by_other: null, user_email: '',
    });
  }
  return out;
}
