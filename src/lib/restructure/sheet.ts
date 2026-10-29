/**
 * restructure/sheet.ts — sheet `Restructure options` u Structure Excelu (F1, PREUREDJIVANJE_SPEC §11).
 *
 * ⚠ Engleski od S188 (Saša: par s `Restructure attributes`; konfiguracijska ploha). Do tada
 *   `Preuređivanje` / `kad:` / `postavi:` / `(prazno)`. Stara imena se NE čitaju (Saša, S188:
 *   nema starih fileova za uvoz) — ali sheet starog imena s upisanim retkom uvoz prijavi
 *   (`legacyRestructureWarning`), inače bi bio tiho preskočen.
 *
 * Jedan redak = jedan korak „when … set …":
 *   Step | Category | when: <slug> … | set: <slug> … | event_id | Note
 *
 * - Stupci atributa su PO SLUGU iz zaglavlja (ne ime — isti razlog kao `ListColumns`),
 *   koliko god treba. Zaglavlje određuje atribute; slova se nigdje ne pišu (S160).
 * - Prazna ćelija = „ne gleda se / ne mijenja se"; `(empty)` = izričito prazno.
 * - Isti `Step` u više redaka = jedan korak (popis `event_id` ne stane u ćeliju).
 * - Vrijednost se NE obrezuje: razmak je greška koju javlja planer (zamka S167),
 *   a tiho obrezivanje bi je sakrilo — config citira vrijednost doslovno.
 */
import type ExcelJS from 'exceljs';
import type { RestructureStep, StepValue } from './plan';

export const RESTRUCTURE_SHEET = 'Restructure options';
/** Ime do S188 — samo za upozorenje, ne čita se. */
export const LEGACY_RESTRUCTURE_SHEET = 'Preuređivanje';
export const EMPTY_TOKEN = '(empty)';
export const WHEN_PREFIX = 'when:';
export const SET_PREFIX = 'set:';
export const FIXED_HEAD = { step: 'Step', category: 'Category', eventIds: 'event_id', note: 'Note' } as const;

/** Zaglavlje predloška: prvo svi `when:`, pa svi `set:` (kao primjer u spec-u §11). */
export function restructureHeader(slugs: string[]): string[] {
  return [
    FIXED_HEAD.step, FIXED_HEAD.category,
    ...slugs.map(s => `${WHEN_PREFIX} ${s}`),
    ...slugs.map(s => `${SET_PREFIX} ${s}`),
    FIXED_HEAD.eventIds, FIXED_HEAD.note,
  ];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ćelija → tekst ili null (prazno). Broj/bool iz Excela postaje tekst; razmaci ostaju. */
export type Cell = string | number | boolean | null | undefined;
export const cellText = (c: Cell): string | null => {
  if (c === null || c === undefined) return null;
  const s = String(c);
  return s.trim() === '' ? null : s;
};

export interface ParsedSheet {
  steps: RestructureStep[];
  errors: string[];
  /** Broj redaka s ijednim podatkom — 0 = sheet je prazan predložak. */
  rowsRead: number;
}

/**
 * Čisto parsiranje: zaglavlje + retci (bez retka zaglavlja).
 * `rowNum` služi samo porukama (broj retka u Excelu).
 */
export function parseRestructureRows(
  header: Cell[],
  rows: Array<{ rowNum: number; cells: Cell[] }>,
): ParsedSheet {
  const errors: string[] = [];
  const cols = { step: -1, category: -1, eventIds: -1, note: -1 };
  const when: Array<{ col: number; slug: string }> = [];
  const set: Array<{ col: number; slug: string }> = [];

  header.forEach((h, i) => {
    const t = (cellText(h) ?? '').trim();
    if (!t) return;
    const low = t.toLowerCase();
    if (low === FIXED_HEAD.step.toLowerCase()) cols.step = i;
    else if (low === FIXED_HEAD.category.toLowerCase()) cols.category = i;
    else if (low === FIXED_HEAD.eventIds.toLowerCase()) cols.eventIds = i;
    else if (low === FIXED_HEAD.note.toLowerCase()) cols.note = i;
    else if (low.startsWith(WHEN_PREFIX)) when.push({ col: i, slug: t.slice(WHEN_PREFIX.length).trim() });
    else if (low.startsWith(SET_PREFIX)) set.push({ col: i, slug: t.slice(SET_PREFIX.length).trim() });
    else errors.push(`Header: unknown column "${t}" (expected Step, Category, "when: <slug>", "set: <slug>", event_id, Note).`);
  });
  if (cols.step < 0 || cols.category < 0) {
    errors.push('Header: "Step" or "Category" is missing.');
    return { steps: [], errors, rowsRead: 0 };
  }
  for (const list of [when, set]) {
    const seen = new Set<string>();
    for (const { slug } of list) {
      if (!slug) errors.push('Header: a "when:"/"set:" column without a slug.');
      else if (seen.has(slug)) errors.push(`Header: "${slug}" appears twice in the same group.`);
      seen.add(slug);
    }
  }

  const byStep = new Map<number, RestructureStep & { _row: number; _sig: string }>();
  let rowsRead = 0;
  for (const { rowNum, cells } of rows) {
    const at = `row ${rowNum}`;
    if (!cells.some(c => cellText(c) !== null)) continue;
    rowsRead++;
    const stepRaw = cellText(cells[cols.step]);
    const n = stepRaw === null ? NaN : Number(stepRaw.trim());
    if (!Number.isInteger(n)) { errors.push(`${at}: Step must be a whole number (${stepRaw ?? 'empty'}).`); continue; }
    const category = cellText(cells[cols.category]);
    if (!category) { errors.push(`${at}: Category is missing.`); continue; }

    const read = (list: typeof when) => {
      const out: Record<string, StepValue> = {};
      for (const { col, slug } of list) {
        const v = cellText(cells[col]);
        if (v === null) continue;
        out[slug] = v.trim() === EMPTY_TOKEN ? null : v;
      }
      return out;
    };
    const w = read(when);
    const s = read(set);
    const ids: string[] = [];
    if (cols.eventIds >= 0) {
      for (const id of (cellText(cells[cols.eventIds]) ?? '').split(/[\s,;]+/).filter(Boolean)) {
        if (UUID_RE.test(id)) ids.push(id.toLowerCase());
        else errors.push(`${at}: "${id}" is not an event_id.`);
      }
    }
    const note = cols.note >= 0 ? cellText(cells[cols.note]) ?? undefined : undefined;
    // Isti Step u više redaka smije se razlikovati SAMO u event_id (i napomeni).
    const sig = JSON.stringify([category, w, s]);
    const prev = byStep.get(n);
    if (prev) {
      if (prev._sig !== sig) {
        errors.push(`${at}: Step ${n} already exists (row ${prev._row}) with different conditions — only event_id may span several rows.`);
        continue;
      }
      prev.eventIds = [...(prev.eventIds ?? []), ...ids];
      continue;
    }
    byStep.set(n, { n, category, when: w, set: s, ...(ids.length ? { eventIds: ids } : {}),
      ...(note ? { note } : {}), _row: rowNum, _sig: sig });
  }

  const steps = [...byStep.values()]
    .sort((a, b) => a.n - b.n)
    .map(({ _row: _r, _sig: _s, ...st }) => st);
  return { steps, errors, rowsRead };
}

// ─────────────────────────────────────────────
// Radna knjiga (exceljs)
// ─────────────────────────────────────────────

// \p{M} = kombinirajući znakovi (č → c + ˇ); `đ` se ne rastavlja, pa ide posebno
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

/** Sheet `Restructure options`, ili null. */
export function findRestructureSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const want = norm(RESTRUCTURE_SHEET);
  return wb.worksheets.find(ws => norm(ws.name) === want) ?? null;
}

export function plain(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ('result' in v) return plain((v as { result: ExcelJS.CellValue }).result);
    if ('richText' in v) return (v as { richText: Array<{ text: string }> }).richText.map(r => r.text).join('');
    if ('text' in v) return String((v as { text: unknown }).text);
    return null;
  }
  return v as Cell;
}

/**
 * Retci od 2. do prvog `HELP …` u stupcu A. JEDINO mjesto tog pravila — čitaju ga i
 * `Restructure attributes` i upozorenje za stari sheet. ⚠ Ispod `HELP` stoje PRIMJERI
 * (S188) u pravim stupcima: da čitač ne stane ondje, primjer bi bio pravi korak.
 */
export function rowsBeforeHelp(ws: ExcelJS.Worksheet): { header: Cell[]; rows: Array<{ rowNum: number; cells: Cell[] }> } {
  const width = ws.columnCount;
  const rowCells = (r: number) => Array.from({ length: width }, (_, i) => plain(ws.getRow(r).getCell(i + 1).value));
  const rows: Array<{ rowNum: number; cells: Cell[] }> = [];
  const last = ws.lastRow?.number ?? 1;
  for (let r = 2; r <= last; r++) {
    const cells = rowCells(r);
    if (typeof cells[0] === 'string' && cells[0].startsWith('HELP')) break;
    rows.push({ rowNum: r, cells });
  }
  return { header: rowCells(1), rows };
}

/**
 * Pročitaj sheet. Retci ispod upute (`HELP …` u stupcu A) se ne čitaju.
 * Nema sheeta ⇒ null (ništa se ne dira).
 */
export function readRestructureSheet(wb: ExcelJS.Workbook): ParsedSheet | null {
  const ws = findRestructureSheet(wb);
  if (!ws) return null;
  const { header, rows } = rowsBeforeHelp(ws);
  return parseRestructureRows(header, rows);
}

/**
 * Sheet starog imena (`Preuređivanje`, do S188) s ijednim upisanim retkom ⇒ poruka.
 * Prazan predložak iz starog exporta šuti (svaki stari Structure file ga nosi).
 */
export function legacyRestructureWarning(wb: ExcelJS.Workbook): string | null {
  const want = norm(LEGACY_RESTRUCTURE_SHEET);
  const ws = wb.worksheets.find(w => norm(w.name) === want);
  if (!ws) return null;
  const { rows } = rowsBeforeHelp(ws);
  if (!rows.some(r => r.cells.some(c => cellText(c) !== null))) return null;
  return `Sheet "${ws.name}" was NOT read — it is now called "${RESTRUCTURE_SHEET}" `
    + `(columns Step, Category, "when: <slug>", "set: <slug>", event_id, Note; "(empty)" instead of "(prazno)"). `
    + 'Take a fresh Structure export and copy the steps into it.';
}

/** Uputa ispod zaglavlja praznog predloška. Retci počinju s `HELP` / razmakom (čitač tu staje). */
export function restructureHelpLines(): string[] {
  return [
    'HELP — restructure MENU OPTIONS: rename / merge / move options and fill an attribute, EVERYWHERE AT ONCE',
    '  (rows, the menu, tiles, buckets, baskets, list columns, shortcuts, anchors). One row = one step.',
    '  (For a whole attribute — change its type — use the "Restructure attributes" sheet.)',
    '  Step          a number; steps run in order and each one sees the result of the previous ones.',
    '  Category      the leaf whose events are looked at (e.g. Transakcija, Strength).',
    `  when: <slug>  condition — the value must be EXACTLY this. Blank = not looked at. ${EMPTY_TOKEN} = the attribute has no value.`,
    `  set: <slug>   new value. Blank = not changed. ${EMPTY_TOKEN} = clear the value.`,
    '  event_id      single rows (separated by a comma or a space); a long list → several rows with the same Step.',
    '  Another text attribute: add a column headed "when: <slug>" or "set: <slug>".',
    '',
    '  Before anything is written you get a PREVIEW (rows per step and every change outside the rows), and you can UNDO.',
    '  ⚠ Do not trim values: a trailing space is a new option — the preview reports it as an error.',
  ];
}

/** Popis tekstualnih atributa po leafu — ispod primjera. */
export function restructureAttrListLines(slugsByCategory: Array<[string, string[]]>): string[] {
  return slugsByCategory.map(([cat, slugs]) => `  Text attributes — ${cat}: ${slugs.join(', ')}`);
}

// ─────────────────────────────────────────────
// Primjeri (S188, Saša: „normalan korisnik ne bi znao popuniti ćelije")
// ─────────────────────────────────────────────
//   Primjer je PRAVI REDAK u pravim stupcima zaglavlja, s objašnjenjem ispod — iz
//   teksta u jednoj ćeliji (`1 | Transakcija | kad: tip = …`) nije se vidjelo koja
//   vrijednost ide u koji stupac. Vrijednosti su iz OVE Aree (prvi izbornik leafa i
//   njegovo `depends_on` dijete), da primjer izgleda kao ono što čovjek stvarno piše.
//   ⚠ Stoje ISPOD `HELP` ⇒ čitač ih nikad ne izvodi (`rowsBeforeHelp`). Čuva test.
//   ⚠ Svaki primjer mora proći parser bez greške — primjer koji uvoz odbije uči krivo.

export interface ExampleRow { cells: Cell[]; explain: string }

export interface RestructureExampleSource {
  category: string;
  /** Tekstualni atribut s izbornikom (`suggest`). */
  menu: string;
  options: string[];
  /** Atribut čiji izbornik ovisi o `menu` (`depends_on`), s jednom opcijom pod `parentValue`. */
  child?: { slug: string; parentValue: string; value: string };
}

/** Zamjenski UUID za primjer s `event_id` — oblik je ono što se uči. */
export const EXAMPLE_EVENT_ID = '00000000-0000-4000-8000-000000000001';

export function restructureExamples(header: string[], src: RestructureExampleSource | null): ExampleRow[] {
  if (!src || src.options.length === 0) return [];
  const idx = (h: string) => header.indexOf(h);
  const W = (slug: string) => `${WHEN_PREFIX} ${slug}`;
  const S = (slug: string) => `${SET_PREFIX} ${slug}`;
  const out: ExampleRow[] = [];
  const add = (vals: Record<string, Cell>, explain: string) => {
    if (Object.keys(vals).some(h => idx(h) < 0)) return;          // stupca nema ⇒ primjer se ne može pokazati
    const cells: Cell[] = header.map(() => null);
    for (const [h, v] of Object.entries(vals)) cells[idx(h)] = v;
    out.push({ cells, explain: `  ↑ ${out.length + 1}. ${explain}` });
  };
  const { category, menu: A, options } = src;
  const X = options[0];
  const Y = options[1];
  const base = (n: number) => ({ [FIXED_HEAD.step]: n, [FIXED_HEAD.category]: category });

  add({ ...base(out.length + 1), [W(A)]: X, [S(A)]: `${X}_new` },
    `Rename: every ${category} row with ${A} = "${X}" gets "${X}_new" — the ${A} menu and every setting that names "${X}" follow.`);
  if (Y) {
    add({ ...base(out.length + 1), [W(A)]: Y, [S(A)]: X },
      `Merge: rows with ${A} = "${Y}" get "${X}" — two options become one.`);
  }
  const c = src.child;
  if (c) {
    const to = options.find(o => o !== c.parentValue);
    if (to) {
      add({ ...base(out.length + 1), [W(A)]: c.parentValue, [W(c.slug)]: c.value, [S(A)]: to },
        `Move: rows with ${A} = "${c.parentValue}" and ${c.slug} = "${c.value}" go under ${A} = "${to}" (${c.slug} stays "${c.value}").`);
    }
    add({ ...base(out.length + 1), [W(A)]: c.parentValue, [W(c.slug)]: EMPTY_TOKEN, [S(c.slug)]: c.value },
      `Fill: where ${A} = "${c.parentValue}" and ${c.slug} is empty, set ${c.slug} = "${c.value}". A NEW attribute is filled the same way — add a column "set: <its slug>".`);
  } else {
    add({ ...base(out.length + 1), [W(A)]: EMPTY_TOKEN, [S(A)]: X },
      `Fill: rows without ${A} get "${X}".`);
  }
  add({ ...base(out.length + 1), [S(A)]: X, [FIXED_HEAD.eventIds]: EXAMPLE_EVENT_ID },
    `Single rows: only the listed event_id (from an Activities export; several separated by a comma) get ${A} = "${X}".`);
  return out;
}

/** Uvodni redak bloka primjera. */
export const EXAMPLES_INTRO =
  '  EXAMPLES — never imported (nothing below the HELP line is read). Each stands alone: copy one ABOVE the HELP line and change the values.';
