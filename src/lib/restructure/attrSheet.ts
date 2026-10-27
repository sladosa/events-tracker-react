/**
 * restructure/attrSheet.ts — sheet `Restructure attributes` u Structure Excelu
 * (F2, PREUREDJIVANJE_SPEC §28, §34). S186.
 *
 * ⚠ Engleski (Saša, S186: „dosta općenit alat") — sheet, stupci, operacije i poruke.
 *   Konfiguracijska ploha, isto pravilo kao ostali natpisi Structure taba.
 *
 * Jedan redak = jedan korak nad ATRIBUTOM (ne nad opcijom — to je sheet `Preuređivanje`):
 *   Step | Operation | Category | Attribute | New type | Into attribute | Conversion | Delete source | Note
 *
 *   change type  (A1, §24)  Attribute → New type (`number` / `text`); uz `number` obavezna Conversion.
 *   merge into   (A4, §25)  Attribute (izvor B) → Into attribute (cilj A); Delete source yes/no.
 *
 * - Stupci se traže PO NASLOVU (S160) — slova se nigdje ne pišu, redoslijed nije bitan.
 * - `Category` je IME kategorije (bilo koje razine — `mood` je na `Activity`, P1),
 *   `Attribute` / `Into attribute` su SLUG (kao `ListColumns`, ne ime).
 * - Parser ne zna ništa o bazi: postoji li atribut, je li pretvorba moguća, je li
 *   korak već izveden i što prati u configu kaže planer nad svježom snimkom.
 *
 * ⚠ MAPA U `Conversion`: parovi `value = number`, odvojeni s ` | ` — RAZMAK S OBJE
 *   STRANE. Goli `|` je dio vrijednosti: DIARY raspoloženje `:-|` (794 dana) bi se
 *   inače raspao. Par koji se ne da pročitati je GREŠKA, ne preskočen par — tiho
 *   izgubljen par ostavio bi te retke nepretvorivima i blokirao korak bez jasnog razloga.
 */
import type ExcelJS from 'exceljs';
import type { Conv, RetypeInput, RetypeType } from './retype';
import { cellText, norm, plain, type Cell } from './sheet';

export const ATTR_SHEET = 'Restructure attributes';
export const ATTR_HEAD = {
  step: 'Step', op: 'Operation', category: 'Category', attr: 'Attribute', type: 'New type',
  into: 'Into attribute', conv: 'Conversion', drop: 'Delete source', note: 'Note',
} as const;
type HeadKey = keyof typeof ATTR_HEAD;

export const OP_RETYPE = 'change type';
export const OP_MERGE = 'merge into';

export type AttrStep =
  | { n: number; kind: 'retype'; category: string; slug: string; to: RetypeType; conv?: Conv; note?: string }
  | { n: number; kind: 'merge'; category: string; slug: string; into: string; dropSource: boolean; note?: string };

export interface ParsedAttrSheet {
  steps: AttrStep[];
  errors: string[];
  /** Broj redaka s ijednim podatkom — 0 = sheet je prazan predložak. */
  rowsRead: number;
}

/** Zaglavlje predloška, redoslijedom iz spec-a §28. */
export const attrHeader = (): string[] => Object.values(ATTR_HEAD);

const TYPES: Record<string, RetypeType> = { number: 'number', text: 'text' };
const YES = new Set(['yes', 'true', '1']);
const NO = new Set(['no', 'false', '0']);
const NUM_RE = /^-?\d+(?:[.,]\d+)?$/;

/** Kratak opis koraka za pregled i poruke. */
export function describeAttrStep(s: AttrStep): string {
  if (s.kind === 'merge') return `${s.category}.${s.slug} merge into ${s.into}${s.dropSource ? ' (delete source)' : ''}`;
  const c = s.conv;
  const how = !c ? '' : c.kind === 'broj' ? ' (number)' : c.kind === 'mm:ss' ? ' (mm:ss)'
    : ` (map: ${Object.entries(c.map).map(([k, v]) => `${k} = ${v}`).join(' | ')})`;
  return `${s.category}.${s.slug} → ${s.to}${how}`;
}

/**
 * Tekst ćelije `Conversion` → pretvorba, ili poruka zašto ne.
 * `number` · `mm:ss` · mapa `:-( = 1 | :-| = 3 | :-) = 4`.
 * (Interno se `number` zove `broj` — ime dijeli SQL `_restructure_convert`, 060.)
 */
export function parseConv(raw: string): { conv: Conv } | { error: string } {
  const t = raw.trim();
  const low = t.toLowerCase();
  if (low === 'number') return { conv: { kind: 'broj' } };
  if (low === 'mm:ss') return { conv: { kind: 'mm:ss' } };
  if (!t.includes('=')) return { error: `unknown conversion "${t}" (number, mm:ss or a map "value = number | …").` };

  const map: Record<string, number> = {};
  for (const part of t.split(/\s+\|\s+/)) {
    const eq = part.lastIndexOf('=');
    const key = eq < 0 ? '' : part.slice(0, eq).trim();
    const val = eq < 0 ? '' : part.slice(eq + 1).trim();
    // Ključ s `=` znači da dva para nisu razdvojena (`… = 1 |:-/ = 2`) — bez ove
    // provjere postali bi JEDAN čudan ključ, a oba retka nepretvoriva bez razloga.
    if (!key || key.includes('=') || !NUM_RE.test(val)) {
      return { error: `map: pair "${part.trim()}" is not "value = number" (separate pairs with " | ", a space on both sides).` };
    }
    if (key in map) return { error: `map: value "${key}" appears twice.` };
    map[key] = Number(val.replace(',', '.'));
  }
  return { conv: { kind: 'mapa', map } };
}

/** Korak A1 → ulaz planera (`planRetype`). */
export function toRetypeInput(step: Extract<AttrStep, { kind: 'retype' }>): RetypeInput {
  return { category: step.category, slug: step.slug, to: step.to, ...(step.conv ? { conv: step.conv } : {}) };
}

/**
 * Čisto parsiranje: zaglavlje + retci (bez retka zaglavlja).
 * `rowNum` služi samo porukama (broj retka u Excelu).
 */
export function parseAttrRows(
  header: Cell[],
  rows: Array<{ rowNum: number; cells: Cell[] }>,
): ParsedAttrSheet {
  const errors: string[] = [];
  const col: Partial<Record<HeadKey, number>> = {};
  const byNorm = new Map(Object.entries(ATTR_HEAD).map(([k, v]) => [norm(v), k as HeadKey]));

  header.forEach((h, i) => {
    const t = (cellText(h) ?? '').trim();
    if (!t) return;
    const key = byNorm.get(norm(t));
    if (!key) errors.push(`Header: unknown column "${t}" (expected: ${attrHeader().join(', ')}).`);
    else if (col[key] !== undefined) errors.push(`Header: "${t}" appears twice.`);
    else col[key] = i;
  });
  const missing = (['step', 'op', 'category', 'attr'] as HeadKey[]).filter(k => col[k] === undefined);
  if (missing.length) {
    errors.push(`Header: missing ${missing.map(k => `"${ATTR_HEAD[k]}"`).join(', ')}.`);
    return { steps: [], errors, rowsRead: 0 };
  }

  const steps: AttrStep[] = [];
  const seenStep = new Map<number, number>();
  let rowsRead = 0;
  for (const { rowNum, cells } of rows) {
    if (!cells.some(c => cellText(c) !== null)) continue;
    rowsRead++;
    const at = `row ${rowNum}`;
    const get = (k: HeadKey) => (col[k] === undefined ? null : cellText(cells[col[k]!])?.trim() ?? null);

    const stepRaw = get('step');
    const n = stepRaw === null ? NaN : Number(stepRaw);
    if (!Number.isInteger(n)) { errors.push(`${at}: Step must be a whole number (${stepRaw ?? 'empty'}).`); continue; }
    if (seenStep.has(n)) { errors.push(`${at}: Step ${n} already exists (row ${seenStep.get(n)}).`); continue; }
    seenStep.set(n, rowNum);

    const category = get('category');
    const slug = get('attr');
    if (!category || !slug) { errors.push(`${at}: Category or Attribute is missing.`); continue; }
    const note = get('note') ?? undefined;
    const op = norm(get('op') ?? '');
    const typeRaw = get('type');
    const into = get('into');
    const convRaw = get('conv');
    const dropRaw = get('drop');
    const before = errors.length;

    if (op === OP_RETYPE) {
      const to = typeRaw ? TYPES[typeRaw.toLowerCase()] : undefined;
      if (!to) errors.push(`${at}: "${OP_RETYPE}" needs New type number or text (${typeRaw ?? 'empty'}).`);
      if (into) errors.push(`${at}: "Into attribute" is only for "${OP_MERGE}".`);
      if (dropRaw) errors.push(`${at}: "Delete source" is only for "${OP_MERGE}".`);
      let conv: Conv | undefined;
      if (to === 'number') {
        if (!convRaw) errors.push(`${at}: text → number needs a Conversion (number, mm:ss or a map).`);
        else {
          const r = parseConv(convRaw);
          if ('error' in r) errors.push(`${at}: ${r.error}`); else conv = r.conv;
        }
      } else if (to === 'text' && convRaw) {
        errors.push(`${at}: number → text takes no Conversion (${convRaw}).`);
      }
      if (errors.length === before && to) {
        steps.push({ n, kind: 'retype', category, slug, to, ...(conv ? { conv } : {}), ...(note ? { note } : {}) });
      }
    } else if (op === OP_MERGE) {
      if (!into) errors.push(`${at}: "${OP_MERGE}" needs "Into attribute" (the target).`);
      else if (into === slug) errors.push(`${at}: an attribute cannot be merged into itself.`);
      if (typeRaw) errors.push(`${at}: "New type" is only for "${OP_RETYPE}".`);
      if (convRaw) errors.push(`${at}: "Conversion" is only for "${OP_RETYPE}".`);
      let dropSource = false;
      if (dropRaw) {
        const d = dropRaw.toLowerCase();
        if (YES.has(d)) dropSource = true;
        else if (!NO.has(d)) errors.push(`${at}: "Delete source" is yes or no (${dropRaw}).`);
      }
      if (errors.length === before && into) {
        steps.push({ n, kind: 'merge', category, slug, into, dropSource, ...(note ? { note } : {}) });
      }
    } else {
      errors.push(`${at}: Operation must be "${OP_RETYPE}" or "${OP_MERGE}" (${get('op') ?? 'empty'}).`);
    }
  }

  steps.sort((a, b) => a.n - b.n);
  return { steps, errors, rowsRead };
}

// ─────────────────────────────────────────────
// Radna knjiga (exceljs)
// ─────────────────────────────────────────────

/** Sheet `Restructure attributes`, ili null. */
export function findAttrSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const want = norm(ATTR_SHEET);
  return wb.worksheets.find(ws => norm(ws.name) === want) ?? null;
}

/** Pročitaj sheet; retci od `HELP` u stupcu A naniže se ne čitaju. Nema sheeta ⇒ null. */
export function readAttrSheet(wb: ExcelJS.Workbook): ParsedAttrSheet | null {
  const ws = findAttrSheet(wb);
  if (!ws) return null;
  const width = ws.columnCount;
  const rowCells = (r: number) => Array.from({ length: width }, (_, i) => plain(ws.getRow(r).getCell(i + 1).value));
  const rows: Array<{ rowNum: number; cells: Cell[] }> = [];
  const last = ws.lastRow?.number ?? 1;
  for (let r = 2; r <= last; r++) {
    const cells = rowCells(r);
    if (typeof cells[0] === 'string' && cells[0].startsWith('HELP')) break;
    rows.push({ rowNum: r, cells });
  }
  return parseAttrRows(rowCells(1), rows);
}

/** Uputa ispod zaglavlja praznog predloška (čitač staje na `HELP`). */
export function attrHelpLines(attrsByCategory: Array<[string, Array<[string, string]>]>): string[] {
  return [
    'HELP — restructure ATTRIBUTES (not menu options — that is the "Preuređivanje" sheet). One row = one step.',
    `  Operation    "${OP_RETYPE}" or "${OP_MERGE}".`,
    '  Category     name of the category that holds the attribute (any level, e.g. Activity).',
    '  Attribute    attribute slug (see the list below).',
    `  ${OP_RETYPE}: New type = number or text. Text → number needs a Conversion; EVERY row must convert,`,
    '               otherwise the preview lists the rows that do not and nothing changes.',
    '    Conversion number — 2,3 · 2.3 · -5   (1.234 is ambiguous and does NOT convert)',
    '               mm:ss  — 6:06 → 6.1',
    '               map    — :-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5   (pairs separated by " | ", a SPACE on both sides)',
    `  ${OP_MERGE}: Into attribute = target slug on the SAME category, same type; Delete source = yes/no.`,
    '               Different values on the same row are a conflict — nothing is touched, you get a list.',
    '',
    `  Example:  1 | ${OP_RETYPE} | Activity | mood | number |  | :-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5 |  |`,
    '',
    '  Steps run ONE AT A TIME: the import shows a preview of the next step, you apply it, then the next one.',
    '  A step already done shows "Already in this state" — importing the same file again changes nothing.',
    '  Each applied step can be undone while the window is open.',
    '',
    ...attrsByCategory.map(([cat, attrs]) => `  Attributes — ${cat}: ${attrs.map(([s, t]) => `${s} (${t})`).join(', ')}`),
  ];
}
