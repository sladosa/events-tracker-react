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
