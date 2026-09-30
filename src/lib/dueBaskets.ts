// ============================================================
// dueBaskets.ts — košara protiv bankinog broja (DOSPJELO_SPEC §3, §5)
// ============================================================
// Čista funkcija, testabilna bez baze (isti obrazac kao `splitRataAmounts`).
//
// ⚠ U LIPAMA. Novac se ovdje uspoređuje s nulom (tolerancija 0,00 — odluka
//   D3), a zbroj decimala nosi grešku binarnog zapisa (`0,1 + 0,2`). Isti
//   razlog kao `ROUND(…, 2)` u Excelu (S112) i `splitRataAmounts` (S145).
// ⚠ NETO (minus − plus): banka tereti neto — povrat umanjuje skupnu naplatu
//   (ZABA košara 11.08.: isplate 2.868,04, povrat 3,00). Visa traži bruto
//   isplatu (spec §2, zrcalo `PRIMLJENA UPLATA`) — to je faza 4 i odluka
//   koja se donosi kad Visa uđe u config, ne sad.
// ============================================================

const toCents = (x: number): number => Math.round(x * 100);

/** Σ košare u lipama: ono što banka treba skinuti. */
export function basketNetCents(row: { gross_plus: number; gross_minus: number }): number {
  return toCents(row.gross_minus) - toCents(row.gross_plus);
}

export type BankCompare =
  | { state: 'empty' }
  | { state: 'ok' }
  | { state: 'diff'; diffCents: number };

/**
 * Usporedi Σ košare s brojem koji je čovjek upisao s ekrana banke.
 * `bank = null` ⇒ polje je prazno ili nečitljivo — tada se NE tvrdi ništa.
 * `diffCents` > 0 ⇒ košara je VEĆA od onoga što je banka skinula.
 *
 * ⚠ Polje se nikad ne popunjava unaprijed Σ-om: tada bi usporedba bila
 *   tautološka (§2.17), zelena po konstrukciji.
 */
export function compareWithBank(sumCents: number, bank: number | null): BankCompare {
  if (bank === null || !Number.isFinite(bank)) return { state: 'empty' };
  const diff = sumCents - toCents(bank);
  return diff === 0 ? { state: 'ok' } : { state: 'diff', diffCents: diff };
}

// ============================================================
// Faza 2 — skupni redak i potvrda (DOSPJELO_SPEC §5, odluke D1, D2, D6)
// ============================================================

/** Razmak dana između dva `YYYY-MM-DD` (b − a). Stringovno → UTC podne, pa
 *  ljetno računanje vremena ne pomakne rezultat (S143: usporedba je stringovna). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/**
 * Koliko dana smije biti između dospijeća košare i dana kad je banka skinula.
 * ⚠ ISTI broj koristi `uvezi_transu.py` za drugi prolaz (isti iznos + strojni
 *   tekst + ≤ 3 dana) — skupni redak koji traka ne prepozna kao „već upisan"
 *   ili alat ne prepozna kao „već u bazi" postaje DRUGI skupni redak.
 */
export const SETTLE_WINDOW_DAYS = 3;

/** Redak koji bi mogao biti skupna naplata košare (učitan iz baze). */
export interface SettleCandidate {
  id: string;
  event_date: string;
  comment: string | null;
  /** slug → vrijednost atributa (text ili number) */
  values: Record<string, string | number | null | undefined>;
}

export interface SettleMatch {
  id: string;
  date: string;
  /** Neto iznos skupnog retka u lipama (minus − plus), ista mjera kao Σ košare. */
  amountCents: number;
  /** Koliko redaka je pravilo prepoznalo — > 1 znači da nešto treba raščistiti. */
  count: number;
}

/**
 * Pravilo B (S156): košara VEĆ IMA skupni redak ako postoji redak
 *   • s opisom = strojni tekst košare (`baskets[k].text`),
 *   • na računu košare (`group_by` = `baskets[k].account`),
 *   • sa svim `settle` atributima (npr. `Racun` / `Transfer` / `izmedju racuna`),
 *   • datiran najviše `SETTLE_WINDOW_DAYS` od dospijeća.
 * Izmjereno na PROD-u 30.09.2026.: svih 7 MC naplata 2026-03 … 2026-09 ima
 * upravo taj oblik (i one iz izvoda i ručne).
 *
 * ⚠ BEZ veze u bazi, namjerno: skupni redak može doći iz izvoda (alat), iz
 *   trake ili rukom — sva tri moraju biti prepoznata jednako. Veza bi znala
 *   samo za redak koji je traka sama napravila.
 * Više pogodaka ⇒ najbliži po datumu, a `count` to kaže naglas.
 */
export function matchSettleRow(
  cands: readonly SettleCandidate[],
  p: {
    text: string;
    account: string;
    groupSlug: string;
    settle: Record<string, string>;
    plusSlug?: string | null;
    minusSlug?: string | null;
    dueDate: string;
    windowDays?: number;
  },
): SettleMatch | null {
  const win = p.windowDays ?? SETTLE_WINDOW_DAYS;
  const hits = cands.filter(c =>
    (c.comment ?? '').trim() === p.text.trim()
    && c.values[p.groupSlug] === p.account
    && Object.entries(p.settle).every(([slug, v]) => c.values[slug] === v)
    && Math.abs(daysBetween(p.dueDate, c.event_date.slice(0, 10))) <= win,
  );
  if (hits.length === 0) return null;
  const best = [...hits].sort((a, b) =>
    Math.abs(daysBetween(p.dueDate, a.event_date.slice(0, 10)))
    - Math.abs(daysBetween(p.dueDate, b.event_date.slice(0, 10))))[0];
  const num = (slug?: string | null) => {
    const v = slug ? best.values[slug] : null;
    return typeof v === 'number' ? v : 0;
  };
  return {
    id: best.id,
    date: best.event_date.slice(0, 10),
    amountCents: toCents(num(p.minusSlug)) - toCents(num(p.plusSlug)),
    count: hits.length,
  };
}

/**
 * Što traka smije ponuditi za jednu košaru.
 *   confirm  — nema skupnog retka, Σ = banka  ⇒ skupni redak + `Planiran → Izvrsen` (§5.1)
 *   record   — nema skupnog retka, Σ ≠ banka  ⇒ SAMO skupni redak s bankinim brojem;
 *              retci ostaju `Planiran`, košara ostaje u traci (§5.2, D2)
 *   flip     — skupni redak postoji, Σ = njegov iznos ⇒ samo prebaci statuse
 *   mismatch — skupni redak postoji, Σ ≠ njegov iznos ⇒ „naplaćeno — neusklađeno" (D6),
 *              bez gumba: razliku rješava Edit retka, ne potvrda
 *   none     — još se nema što ponuditi; `reason` kaže zašto
 *
 * ⚠ Datum mora biti BANKIN i upisan rukom (BUG-S115: pogođen datum koji
 *   izgleda kao podatak). Izvan prozora od `SETTLE_WINDOW_DAYS` se odbija:
 *   takav redak traka sljedeći put ne bi prepoznala ⇒ nudila bi DRUGI.
 */
export type BasketAction =
  | { kind: 'confirm' }
  | { kind: 'record'; diffCents: number }
  | { kind: 'flip' }
  | { kind: 'mismatch'; diffCents: number }
  | { kind: 'none'; reason: 'no-bank' | 'unreadable' | 'not-positive' | 'no-date' | 'date-far' | 'date-future' };

export function basketAction(p: {
  sumCents: number;
  settle: SettleMatch | null;
  /** Upisani broj; `null` = prazno, `NaN` = nečitljivo. */
  bank: number | null;
  bankDate: string | null;
  dueDate: string;
  today: string;
  windowDays?: number;
}): BasketAction {
  if (p.settle) {
    const diff = p.sumCents - p.settle.amountCents;
    return diff === 0 ? { kind: 'flip' } : { kind: 'mismatch', diffCents: diff };
  }
  if (p.bank === null) return { kind: 'none', reason: 'no-bank' };
  if (!Number.isFinite(p.bank)) return { kind: 'none', reason: 'unreadable' };
  if (toCents(p.bank) <= 0) return { kind: 'none', reason: 'not-positive' };
  if (!p.bankDate) return { kind: 'none', reason: 'no-date' };
  if (p.bankDate > p.today) return { kind: 'none', reason: 'date-future' };
  if (Math.abs(daysBetween(p.dueDate, p.bankDate)) > (p.windowDays ?? SETTLE_WINDOW_DAYS)) {
    return { kind: 'none', reason: 'date-far' };
  }
  const diff = p.sumCents - toCents(p.bank);
  return diff === 0 ? { kind: 'confirm' } : { kind: 'record', diffCents: diff };
}

/**
 * Vrijednosti skupnog retka po slugu (bez izvedenih — `Datum naplate` računa
 * pravilo `set_attribute`, isto kao u Addu). Iznos ide u `minus` (banka je
 * skinula); negativna naplata (povrat veći od kupovina) ide u `plus`.
 */
export function settleValues(p: {
  settle: Record<string, string>;
  groupSlug: string;
  account: string;
  statusSlug: string;
  done: string;
  plusSlug?: string | null;
  minusSlug?: string | null;
  amountCents: number;
}): Record<string, string | number> {
  const out: Record<string, string | number> = { ...p.settle };
  out[p.groupSlug] = p.account;
  out[p.statusSlug] = p.done;
  const abs = Math.abs(p.amountCents) / 100;
  const slug = p.amountCents >= 0 ? p.minusSlug : p.plusSlug;
  if (!slug) throw new Error('Pločica nema atribut za iznos (plus/minus) — skupni redak ne znam upisati.');
  out[slug] = abs;
  return out;
}
