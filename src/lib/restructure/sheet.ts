/**
 * restructure/sheet.ts — sheet `Preuređivanje` u Structure Excelu (F1, PREUREDJIVANJE_SPEC §11).
 *
 * Jedan redak = jedan korak „kad … postavi …":
 *   Korak | Kategorija | kad: <slug> … | postavi: <slug> … | event_id | Napomena
 *
 * - Stupci atributa su PO SLUGU iz zaglavlja (ne ime — isti razlog kao `ListColumns`),
 *   koliko god treba. Zaglavlje određuje atribute; slova se nigdje ne pišu (S160).
 * - Prazna ćelija = „ne gleda se / ne mijenja se"; `(prazno)` = izričito prazno.
 * - Isti `Korak` u više redaka = jedan korak (popis `event_id` ne stane u ćeliju).
 * - Vrijednost se NE obrezuje: razmak je greška koju javlja planer (zamka S167),
 *   a tiho obrezivanje bi je sakrilo — config citira vrijednost doslovno.
 */
import type ExcelJS from 'exceljs';
import type { RestructureStep, StepValue } from './plan';

export const RESTRUCTURE_SHEET = 'Preuređivanje';
export const EMPTY_TOKEN = '(prazno)';
export const WHEN_PREFIX = 'kad:';
export const SET_PREFIX = 'postavi:';
export const FIXED_HEAD = { step: 'Korak', category: 'Kategorija', eventIds: 'event_id', note: 'Napomena' } as const;

/** Zaglavlje predloška: prvo svi `kad:`, pa svi `postavi:` (kao primjer u spec-u §11). */
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
const cellText = (c: Cell): string | null => {
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
    else errors.push(`Zaglavlje: nepoznat stupac „${t}" (očekivano Korak, Kategorija, „kad: <slug>", „postavi: <slug>", event_id, Napomena).`);
  });
  if (cols.step < 0 || cols.category < 0) {
    errors.push('Zaglavlje: nedostaje „Korak" ili „Kategorija".');
    return { steps: [], errors, rowsRead: 0 };
  }
  for (const list of [when, set]) {
    const seen = new Set<string>();
    for (const { slug } of list) {
      if (!slug) errors.push('Zaglavlje: stupac „kad:"/„postavi:" bez sluga.');
      else if (seen.has(slug)) errors.push(`Zaglavlje: „${slug}" dvaput u istoj skupini.`);
      seen.add(slug);
    }
  }

  const byStep = new Map<number, RestructureStep & { _row: number; _sig: string }>();
  let rowsRead = 0;
  for (const { rowNum, cells } of rows) {
    const at = `redak ${rowNum}`;
    if (!cells.some(c => cellText(c) !== null)) continue;
    rowsRead++;
    const stepRaw = cellText(cells[cols.step]);
    const n = stepRaw === null ? NaN : Number(stepRaw.trim());
    if (!Number.isInteger(n)) { errors.push(`${at}: Korak mora biti cijeli broj (${stepRaw ?? 'prazno'}).`); continue; }
    const category = cellText(cells[cols.category]);
    if (!category) { errors.push(`${at}: nema Kategorije.`); continue; }

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
        else errors.push(`${at}: „${id}" nije event_id.`);
      }
    }
    const note = cols.note >= 0 ? cellText(cells[cols.note]) ?? undefined : undefined;
    // Isti Korak u više redaka smije se razlikovati SAMO u event_id (i napomeni).
    const sig = JSON.stringify([category, w, s]);
    const prev = byStep.get(n);
    if (prev) {
      if (prev._sig !== sig) {
        errors.push(`${at}: Korak ${n} već postoji (redak ${prev._row}) s drukčijim uvjetima — samo event_id smije ići u više redaka.`);
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
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

/** Sheet `Preuređivanje` (i bez dijakritike — `Preuredjivanje`), ili null. */
export function findRestructureSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const want = new Set([norm(RESTRUCTURE_SHEET), 'preuredjivanje']);
  return wb.worksheets.find(ws => want.has(norm(ws.name))) ?? null;
}

function plain(v: ExcelJS.CellValue): Cell {
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
 * Pročitaj sheet. Retci ispod upute (`HELP …` u stupcu A) se ne čitaju.
 * Nema sheeta ⇒ null (ništa se ne dira).
 */
export function readRestructureSheet(wb: ExcelJS.Workbook): ParsedSheet | null {
  const ws = findRestructureSheet(wb);
  if (!ws) return null;
  const width = ws.columnCount;
  const rowCells = (r: number) => Array.from({ length: width }, (_, i) => plain(ws.getRow(r).getCell(i + 1).value));
  const header = rowCells(1);
  const rows: Array<{ rowNum: number; cells: Cell[] }> = [];
  const last = ws.lastRow?.number ?? 1;
  for (let r = 2; r <= last; r++) {
    const cells = rowCells(r);
    if (typeof cells[0] === 'string' && cells[0].startsWith('HELP')) break;
    rows.push({ rowNum: r, cells });
  }
  return parseRestructureRows(header, rows);
}

/** Uputa ispod zaglavlja praznog predloška. Retci počinju s `HELP` / razmakom (čitač tu staje). */
export function restructureHelpLines(slugsByCategory: Array<[string, string[]]>): string[] {
  return [
    'HELP — preuređivanje: preimenuj / spoji / premjesti opcije izbornika i popuni novi atribut, U SVIM MJESTIMA ODJEDNOM',
    '  (retci, izbornik, pločice, bucketi, košare, kolone liste, shortcuti, sidra). Jedan redak = jedan korak.',
    '  Korak       broj; koraci se izvode redom i svaki vidi rezultat prethodnih.',
    '  Kategorija  leaf čiji eventi se gledaju (npr. Transakcija).',
    '  kad: <slug>      uvjet — vrijednost mora biti TOČNO ta. Prazno = ne gleda se. (prazno) = atribut nema vrijednost.',
    '  postavi: <slug>  nova vrijednost. Prazno = ne mijenja se. (prazno) = obriši vrijednost.',
    '  event_id    pojedinačni retci (odvojeni zarezom ili razmakom); dugi popis → više redaka s istim brojem koraka.',
    '  Stupac za drugi tekstualni atribut: dodaj zaglavlje „kad: <slug>" ili „postavi: <slug>".',
    '',
    '  Primjer:  1 | Transakcija | kad: tip = Kuća | kad: podtip = Osiguranje | postavi: tip = Osiguranje | postavi: podtip = Kuća',
    '',
    '  Prije primjene dobiješ PREGLED (broj redaka po koraku i svaka promjena izvan redaka) i mogućnost POVRATA.',
    '  ⚠ Ne obrezuj vrijednosti: razmak na kraju je nova opcija — pregled ga javi kao grešku.',
    '',
    ...slugsByCategory.map(([cat, slugs]) => `  Tekstualni atributi — ${cat}: ${slugs.join(', ')}`),
  ];
}
