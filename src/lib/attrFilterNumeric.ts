/**
 * F4 (S159) — a number attribute in "Filter by": `Iznos > 1000`.
 *
 * ONE condition with an operator, not the multi-condition filter (that needs a
 * RPC, FILTER_SPEC §3). It rides on the same `attrFilter` slot:
 *   { attrDefId, value: <what the person typed>, isExact: false, op }
 * `op` present ⇒ the condition reads `value_number`; absent ⇒ today's text
 * filter on `value_text`, unchanged.
 *
 * ⚠ `value` stays the RAW text, the number is parsed where it is applied. The
 *   input therefore never rewrites itself mid-typing (S131: a field that
 *   reformats what you type loses characters), and an unreadable value is NOT
 *   a filter — `isAttrFilterActive` refuses it, so the list never quietly
 *   filters by a guess.
 *
 * ⚠ The serialized form (export Filter sheet / profile `Attribute filter`)
 *   uses ASCII operators `>`, `>=`, `<`, `<=`, `=` — a profile is typed in
 *   Excel, and `≥` cannot be typed there.
 *
 * Pure module (no Supabase) so the unit test runs it without a client.
 */
import { parseAmountInput } from './amountFormat';

export type NumericOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export const NUMERIC_OPS: { op: NumericOp; ascii: string; label: string }[] = [
  { op: 'gt',  ascii: '>',  label: '>' },
  { op: 'gte', ascii: '>=', label: '≥' },
  { op: 'lt',  ascii: '<',  label: '<' },
  { op: 'lte', ascii: '<=', label: '≤' },
  { op: 'eq',  ascii: '=',  label: '=' },
];

export function isNumericOp(v: unknown): v is NumericOp {
  return NUMERIC_OPS.some(o => o.op === v);
}

export function opAscii(op: NumericOp): string {
  return NUMERIC_OPS.find(o => o.op === op)!.ascii;
}

export function opLabel(op: NumericOp): string {
  return NUMERIC_OPS.find(o => o.op === op)!.label;
}

/** `>=` → `gte`. Longest first, so `>=` is never read as `>` + `=…`. */
export function opFromAscii(s: string): NumericOp | null {
  const hit = [...NUMERIC_OPS].sort((a, b) => b.ascii.length - a.ascii.length)
    .find(o => o.ascii === s);
  return hit?.op ?? null;
}

interface MaybeNumeric { value: string; op?: NumericOp | null }

/** The number a numeric condition compares against, or null if unreadable. */
export function numericFilterValue(af: MaybeNumeric | null | undefined): number | null {
  if (!af?.op) return null;
  return parseAmountInput(af.value);
}

/** Does a row's number satisfy the condition? (Used by tests; the DB does the real work.) */
export function matchesNumeric(n: number, op: NumericOp, target: number): boolean {
  switch (op) {
    case 'gt':  return n > target;
    case 'gte': return n >= target;
    case 'lt':  return n < target;
    case 'lte': return n <= target;
    case 'eq':  return n === target;
  }
}

/** Data types whose value lives in `value_number`. */
export const NUMERIC_DATA_TYPES = new Set(['number']);

// ─────────────────────────────────────────────────────────────
// S160 (Backlog „Potpuni attrFilter") — datum i da/ne na istom utoru.
//
// `kind` odsutan ⇒ ponasanje od S159 (uz `op` broj, bez `op` tekst) — spremljeni
// shortcuti i profili ostaju valjani bez migracije.
// ─────────────────────────────────────────────────────────────

export type AttrFilterKind = 'datetime' | 'boolean';

export const DATETIME_DATA_TYPES = new Set(['datetime']);
export const BOOLEAN_DATA_TYPES = new Set(['boolean']);

/** Koji kind uvjeta trazi atribut ovog tipa (`null` = tekst, `undefined` u stanju). */
export function kindForDataType(dataType: string): AttrFilterKind | 'number' | null {
  if (NUMERIC_DATA_TYPES.has(dataType)) return 'number';
  if (DATETIME_DATA_TYPES.has(dataType)) return 'datetime';
  if (BOOLEAN_DATA_TYPES.has(dataType)) return 'boolean';
  return null;
}

interface MaybeKinded { value: string; op?: NumericOp | null; kind?: AttrFilterKind | null }

/**
 * Datumski uvjet kao granice nad `value_datetime`, na razini DANA.
 *
 * ⚠ Granice su u UTC-u, NE lokalno. App datum-atribut pise kao naivni zapis
 *   (`2026-10-11T12:00`, `set_attribute`, Excel), a baza ga cita kao UTC — dakle
 *   UTC datum zapisa JEST dan koji je covjek upisao (CLAUDE.md, C3c: Edit
 *   prikazuje UTC sat). Lokalna ponoc bi u Zagrebu pomaknula granicu za 2 h i
 *   zapis `…T23:00` pripisala sljedecem danu.
 * ⚠ `=` je CIJELI dan (dvije granice), ne trenutak — trenutak se ne da upisati.
 */
export function dateFilterBounds(op: NumericOp, ymd: string): { op: 'gte' | 'lt'; iso: string }[] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const start = new Date(Date.UTC(y, mo - 1, d));
  if (start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== d) return null;   // 2026-02-31
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const s = start.toISOString(), n = next.toISOString();
  switch (op) {
    case 'gt':  return [{ op: 'gte', iso: n }];
    case 'gte': return [{ op: 'gte', iso: s }];
    case 'lt':  return [{ op: 'lt',  iso: s }];
    case 'lte': return [{ op: 'lt',  iso: n }];
    case 'eq':  return [{ op: 'gte', iso: s }, { op: 'lt', iso: n }];
  }
}

/** `true`/`false` iz uvjeta da/ne; sve drugo je `null` (nije uvjet). */
export function booleanFilterValue(af: MaybeKinded | null | undefined): boolean | null {
  if (af?.kind !== 'boolean') return null;
  const v = af.value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

/** Je li uvjet sa `kind`/`op` citljiv (nikad filtrirati po nagadjanju). */
export function isTypedFilterReadable(af: MaybeKinded): boolean {
  if (af.kind === 'datetime') return !!af.op && dateFilterBounds(af.op, af.value) !== null;
  if (af.kind === 'boolean') return booleanFilterValue(af) !== null;
  if (af.op) return numericFilterValue(af) !== null;
  return true;
}

/** Kratak opis vrijednosti uvjeta za traku iznad liste. */
export function describeTypedFilter(af: MaybeKinded): string {
  if (af.kind === 'boolean') return booleanFilterValue(af) ? '= Yes' : '= No';
  if (af.kind === 'datetime' && af.op) {
    const [y, mo, d] = af.value.split('-');
    return `${opLabel(af.op)} ${d}.${mo}.${y}.`;
  }
  return af.op ? `${opLabel(af.op)} ${af.value}` : af.value;
}
