/**
 * restructure/attrSheet.ts — sheet `Preuređivanje atributa` u Structure Excelu
 * (F2, PREUREDJIVANJE_SPEC §28). S186.
 *
 * Jedan redak = jedan korak nad ATRIBUTOM (ne nad opcijom — to je sheet `Preuređivanje`):
 *   Korak | Operacija | Kategorija | Atribut | Novi tip | U atribut | Pretvorba | Obriši izvor | Napomena
 *
 *   promijeni tip  (A1, §24)  Atribut → Novi tip (`number` / `text`); uz `number` obavezna Pretvorba.
 *   spoji u        (A4, §25)  Atribut (izvor B) → U atribut (cilj A); Obriši izvor DA/NE.
 *
 * - Stupci se traže PO NASLOVU (S160) — slova se nigdje ne pišu, redoslijed nije bitan.
 * - `Kategorija` je IME kategorije (bilo koje razine — `mood` je na `Activity`, P1),
 *   `Atribut` / `U atribut` su SLUG (kao `ListColumns`, ne ime).
 * - Parser ne zna ništa o bazi: postoji li atribut, je li pretvorba moguća i što
 *   prati u configu kaže planer (`retype.ts`) nad svježom snimkom.
 *
 * ⚠ MAPA U `Pretvorba`: parovi `vrijednost = broj`, odvojeni s ` | ` — RAZMAK S OBJE
 *   STRANE. Goli `|` je dio vrijednosti: DIARY raspoloženje `:-|` (794 dana) bi se
 *   inače raspao. Par koji se ne da pročitati je GREŠKA, ne preskočen par — tiho
 *   izgubljen par ostavio bi te retke nepretvorivima i blokirao korak bez jasnog razloga.
 */
import type ExcelJS from 'exceljs';
import type { Conv, RetypeInput, RetypeType } from './retype';
import { cellText, norm, plain, type Cell } from './sheet';

export const ATTR_SHEET = 'Preuređivanje atributa';
export const ATTR_HEAD = {
  step: 'Korak', op: 'Operacija', category: 'Kategorija', attr: 'Atribut', type: 'Novi tip',
  into: 'U atribut', conv: 'Pretvorba', drop: 'Obriši izvor', note: 'Napomena',
} as const;
type HeadKey = keyof typeof ATTR_HEAD;

export const OP_RETYPE = 'promijeni tip';
export const OP_MERGE = 'spoji u';

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

const TYPES: Record<string, RetypeType> = { number: 'number', broj: 'number', text: 'text', tekst: 'text' };
const YES = new Set(['da', 'true', 'yes', '1']);
const NO = new Set(['ne', 'false', 'no', '0']);
const NUM_RE = /^-?\d+(?:[.,]\d+)?$/;

/**
 * Tekst ćelije `Pretvorba` → pretvorba, ili poruka zašto ne.
 * `broj` · `mm:ss` · mapa `:-( = 1 | :-| = 3 | :-) = 4`.
 */
export function parseConv(raw: string): { conv: Conv } | { error: string } {
  const t = raw.trim();
  const low = t.toLowerCase();
  if (low === 'broj') return { conv: { kind: 'broj' } };
  if (low === 'mm:ss') return { conv: { kind: 'mm:ss' } };
  if (!t.includes('=')) return { error: `nepoznata pretvorba „${t}" (broj, mm:ss ili mapa „vrijednost = broj | …").` };

  const map: Record<string, number> = {};
  for (const part of t.split(/\s+\|\s+/)) {
    const eq = part.lastIndexOf('=');
    const key = eq < 0 ? '' : part.slice(0, eq).trim();
    const val = eq < 0 ? '' : part.slice(eq + 1).trim();
    // Ključ s `=` znači da dva para nisu razdvojena (`… = 1 |:-/ = 2`) — bez ove
    // provjere postali bi JEDAN čudan ključ, a oba retka nepretvoriva bez razloga.
    if (!key || key.includes('=') || !NUM_RE.test(val)) {
      return { error: `mapa: par „${part.trim()}" nije „vrijednost = broj" (parovi se odvajaju s „ | ", razmak s obje strane).` };
    }
    if (key in map) return { error: `mapa: vrijednost „${key}" dvaput.` };
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
    if (!key) errors.push(`Zaglavlje: nepoznat stupac „${t}" (očekivano: ${attrHeader().join(', ')}).`);
    else if (col[key] !== undefined) errors.push(`Zaglavlje: „${t}" dvaput.`);
    else col[key] = i;
  });
  const missing = (['step', 'op', 'category', 'attr'] as HeadKey[]).filter(k => col[k] === undefined);
  if (missing.length) {
    errors.push(`Zaglavlje: nedostaje ${missing.map(k => `„${ATTR_HEAD[k]}"`).join(', ')}.`);
    return { steps: [], errors, rowsRead: 0 };
  }

  const steps: AttrStep[] = [];
  const seenStep = new Map<number, number>();
  let rowsRead = 0;
  for (const { rowNum, cells } of rows) {
    if (!cells.some(c => cellText(c) !== null)) continue;
    rowsRead++;
    const at = `redak ${rowNum}`;
    const get = (k: HeadKey) => (col[k] === undefined ? null : cellText(cells[col[k]!])?.trim() ?? null);

    const stepRaw = get('step');
    const n = stepRaw === null ? NaN : Number(stepRaw);
    if (!Number.isInteger(n)) { errors.push(`${at}: Korak mora biti cijeli broj (${stepRaw ?? 'prazno'}).`); continue; }
    if (seenStep.has(n)) { errors.push(`${at}: Korak ${n} već postoji (redak ${seenStep.get(n)}).`); continue; }
    seenStep.set(n, rowNum);

    const category = get('category');
    const slug = get('attr');
    if (!category || !slug) { errors.push(`${at}: nedostaje Kategorija ili Atribut.`); continue; }
    const note = get('note') ?? undefined;
    const op = norm(get('op') ?? '');
    const typeRaw = get('type');
    const into = get('into');
    const convRaw = get('conv');
    const dropRaw = get('drop');
    const before = errors.length;

    if (op === norm(OP_RETYPE)) {
      const to = typeRaw ? TYPES[typeRaw.toLowerCase()] : undefined;
      if (!to) errors.push(`${at}: „${OP_RETYPE}" traži Novi tip number ili text (${typeRaw ?? 'prazno'}).`);
      if (into) errors.push(`${at}: „U atribut" je samo za „${OP_MERGE}".`);
      if (dropRaw) errors.push(`${at}: „Obriši izvor" je samo za „${OP_MERGE}".`);
      let conv: Conv | undefined;
      if (to === 'number') {
        if (!convRaw) errors.push(`${at}: tekst → broj traži Pretvorbu (broj, mm:ss ili mapa).`);
        else {
          const r = parseConv(convRaw);
          if ('error' in r) errors.push(`${at}: ${r.error}`); else conv = r.conv;
        }
      } else if (to === 'text' && convRaw) {
        errors.push(`${at}: broj → tekst nema Pretvorbu (${convRaw}).`);
      }
      if (errors.length === before && to) {
        steps.push({ n, kind: 'retype', category, slug, to, ...(conv ? { conv } : {}), ...(note ? { note } : {}) });
      }
    } else if (op === norm(OP_MERGE)) {
      if (!into) errors.push(`${at}: „${OP_MERGE}" traži „U atribut" (cilj).`);
      else if (into === slug) errors.push(`${at}: atribut se ne spaja sam u sebe.`);
      if (typeRaw) errors.push(`${at}: „Novi tip" je samo za „${OP_RETYPE}".`);
      if (convRaw) errors.push(`${at}: „Pretvorba" je samo za „${OP_RETYPE}".`);
      let dropSource = false;
      if (dropRaw) {
        const d = dropRaw.toLowerCase();
        if (YES.has(d)) dropSource = true;
        else if (!NO.has(d)) errors.push(`${at}: „Obriši izvor" je DA ili NE (${dropRaw}).`);
      }
      if (errors.length === before && into) {
        steps.push({ n, kind: 'merge', category, slug, into, dropSource, ...(note ? { note } : {}) });
      }
    } else {
      errors.push(`${at}: Operacija mora biti „${OP_RETYPE}" ili „${OP_MERGE}" (${get('op') ?? 'prazno'}).`);
    }
  }

  steps.sort((a, b) => a.n - b.n);
  return { steps, errors, rowsRead };
}

// ─────────────────────────────────────────────
// Radna knjiga (exceljs)
// ─────────────────────────────────────────────

/** Sheet `Preuređivanje atributa` (i bez dijakritike), ili null. */
export function findAttrSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const want = norm(ATTR_SHEET);
  return wb.worksheets.find(ws => norm(ws.name) === want || norm(ws.name) === 'preuredjivanje atributa') ?? null;
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
    'HELP — preuređivanje ATRIBUTA (ne opcija izbornika — to je sheet „Preuređivanje"). Jedan redak = jedan korak.',
    `  Operacija    „${OP_RETYPE}" ili „${OP_MERGE}".`,
    '  Kategorija   ime kategorije na kojoj je atribut (bilo koje razine, npr. Activity).',
    '  Atribut      slug atributa (vidi popis dolje).',
    `  ${OP_RETYPE}: Novi tip = number ili text. Tekst → broj traži Pretvorbu; SVAKI redak se mora dati pretvoriti,`,
    '               inače pregled pokaže nepretvorive i ništa se ne mijenja.',
    '    Pretvorba  broj   — 2,3 · 2.3 · -5   (1.234 je dvosmislen i NE prolazi)',
    '               mm:ss  — 6:06 → 6.1',
    '               mapa   — :-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5   (parovi odvojeni s „ | ", RAZMAK s obje strane)',
    `  ${OP_MERGE}: U atribut = slug cilja na ISTOJ kategoriji i istog tipa; Obriši izvor = DA/NE.`,
    '               Različite vrijednosti na istom retku su sukob — ništa se ne dira, dobiješ popis.',
    '',
    `  Primjer:  1 | ${OP_RETYPE} | Activity | mood | number |  | :-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5 |  |`,
    '',
    '  Prije primjene dobiješ PREGLED (broj redaka, što se mijenja u postavkama Aree) i mogućnost POVRATA.',
    '',
    ...attrsByCategory.map(([cat, attrs]) => `  Atributi — ${cat}: ${attrs.map(([s, t]) => `${s} (${t})`).join(', ')}`),
  ];
}
