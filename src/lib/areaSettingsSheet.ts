// ============================================================
// areaSettingsSheet.ts — F5: `areas.settings` u Structure Excelu (S175)
// ============================================================
// Princip „sve ide importom" (Saša): sve stanje Aree mora proći Structure
// roundtrip. Do S175 su `dashboard`, `groupings` i `export_profiles` živjeli
// SAMO u bazi i mijenjali se `set_*.py` skriptama.
//
// Format odlučen S160 (Saša): retci ključ-putanja, jedan generički sheet
// `Area | Putanja | Tip | Vrijednost`, npr.
//   Financije_all | dashboard.widgets[0].due.baskets.Visa.text | text | Visa
// Odbačeno: JSON u ćeliji (jedan zarez ruši uvoz), tablica po pločici (svaki
// novi ključ = nov kod).
//
// ⚠ Sheet nosi SVE ključeve osim onih koje već nosi drugi dio filea
//   (`OWNED_ELSEWHERE`) — i svaki BUDUĆI ključ sam od sebe. Nova postavka se
//   tako ne može zaboraviti dodati u roundtrip (F5-1).
// ⚠ `Tip` je zato što Excel ne čuva namjeru: tekst `05` postane broj 5, tekst
//   `TRUE` postane da/ne. Izvoz ga uvijek piše; prazan `Tip` = pogodi iz ćelije.
// ⚠ Ime Aree u ključevima export profila (`attr:Financije_all||…`) izvozi se
//   kao `{Area}` i vraća imenom iz kolone A — profil preživi kopiranje u drugu
//   Areu (F5-5).
// ============================================================

/** Ključevi koje nosi Structure sheet / `Automations` / `ListColumns` — ovdje NE. */
export const OWNED_ELSEWHERE = [
  'comment_template', 'disable_save_plus', 'add_header', 'default_period',
  'automations', 'list_columns',
] as const;

export const AREA_SETTINGS_TYPES = ['text', 'number', 'bool', 'null', '[]', '{}'] as const;
export type AreaSettingsType = typeof AREA_SETTINGS_TYPES[number];

export interface AreaSettingsRow {
  path: string;
  type: AreaSettingsType;
  value: string | number | boolean | null;
}

const AREA_TOKEN = '{Area}';
const ATTR_PREFIX = 'attr:';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Dio postavki koji ide u sheet `AreaSettings`. */
export function sheetOwnedSettings(settings: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if ((OWNED_ELSEWHERE as readonly string[]).includes(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// ─── putanja ────────────────────────────────────────────────

/** Ključ koji se smije pisati golo: bez `.`, `[`, `]`, `"` i bez rubnih razmaka. */
const isPlainKey = (k: string) => k !== '' && !/[.[\]"]/.test(k) && k.trim() === k;

function keySeg(k: string, first: boolean): string {
  if (isPlainKey(k)) return first ? k : `.${k}`;
  return `[${JSON.stringify(k)}]`;
}

type Seg = { kind: 'key'; key: string } | { kind: 'index'; index: number };

/** `a.b[0]["c.d"]` → segmenti. Baca na krivoj sintaksi. */
export function parsePath(path: string): Seg[] {
  const segs: Seg[] = [];
  let i = 0;
  const n = path.length;
  let expectKey = true;
  while (i < n) {
    const c = path[i];
    if (c === '[') {
      if (path[i + 1] === '"') {
        // JSON string do zatvarajućeg navodnika koji nije escapan
        let j = i + 2;
        while (j < n && !(path[j] === '"' && path[j - 1] !== '\\')) j++;
        if (j >= n || path[j + 1] !== ']') throw new Error(`neispravna putanja „${path}" (nezatvoren ["…"])`);
        segs.push({ kind: 'key', key: JSON.parse(path.slice(i + 1, j + 1)) as string });
        i = j + 2;
      } else {
        const j = path.indexOf(']', i);
        const num = j < 0 ? '' : path.slice(i + 1, j);
        if (!/^\d+$/.test(num)) throw new Error(`neispravna putanja „${path}" (indeks [${num}])`);
        segs.push({ kind: 'index', index: Number(num) });
        i = j + 1;
      }
      expectKey = false;
    } else if (c === '.') {
      if (expectKey) throw new Error(`neispravna putanja „${path}" (prazan ključ)`);
      i++;
      expectKey = true;
      if (i >= n) throw new Error(`neispravna putanja „${path}" (točka na kraju)`);
    } else {
      if (!expectKey) throw new Error(`neispravna putanja „${path}" (nedostaje točka)`);
      let j = i;
      while (j < n && path[j] !== '.' && path[j] !== '[') j++;
      segs.push({ kind: 'key', key: path.slice(i, j) });
      i = j;
      expectKey = false;
    }
  }
  if (segs.length === 0) throw new Error('prazna putanja');
  if (segs[0].kind !== 'key') throw new Error(`neispravna putanja „${path}" (počinje indeksom)`);
  return segs;
}

// ─── izvoz ──────────────────────────────────────────────────

function areaOut(v: string, areaName: string): string {
  const p = `${ATTR_PREFIX}${areaName}||`;
  return v.startsWith(p) ? `${ATTR_PREFIX}${AREA_TOKEN}||${v.slice(p.length)}` : v;
}

function areaIn(v: string, areaName: string): string {
  const p = `${ATTR_PREFIX}${AREA_TOKEN}||`;
  return v.startsWith(p) ? `${ATTR_PREFIX}${areaName}||${v.slice(p.length)}` : v;
}

/** Postavke → retci sheeta (samo `sheetOwnedSettings`). Redoslijed = redoslijed u objektu. */
export function flattenAreaSettings(settings: Record<string, unknown> | null | undefined, areaName: string): AreaSettingsRow[] {
  const rows: AreaSettingsRow[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) {
      if (v.length === 0) rows.push({ path, type: '[]', value: null });
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      if (entries.length === 0) rows.push({ path, type: '{}', value: null });
      for (const [k, x] of entries) walk(x, path + keySeg(k, false));
    } else if (v === null) {
      rows.push({ path, type: 'null', value: null });
    } else if (typeof v === 'boolean') {
      rows.push({ path, type: 'bool', value: v });
    } else if (typeof v === 'number') {
      rows.push({ path, type: 'number', value: v });
    } else {
      rows.push({ path, type: 'text', value: areaOut(String(v), areaName) });
    }
  };
  for (const [k, v] of Object.entries(sheetOwnedSettings(settings))) walk(v, keySeg(k, true));
  return rows;
}

// ─── uvoz ───────────────────────────────────────────────────

/**
 * Ćelija + `Tip` → vrijednost. `raw` je ono što exceljs vrati (string, broj, bool,
 * null). Prazan `Tip` = pogodi iz ćelije (broj ⇒ number, da/ne ⇒ bool, prazno ⇒ null).
 */
export function cellToValue(raw: unknown, typeRaw: string): { value: Json } | { error: string } {
  const t = typeRaw.trim().toLowerCase();
  const s = raw === null || raw === undefined ? '' : String(raw).trim();
  switch (t) {
    case 'text': return { value: s };
    case 'number': {
      const num = typeof raw === 'number' ? raw : Number(s.replace(',', '.'));
      return s !== '' && Number.isFinite(num) ? { value: num } : { error: `„${s}" nije broj` };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { value: raw };
      const u = s.toUpperCase();
      return u === 'TRUE' ? { value: true } : u === 'FALSE' ? { value: false } : { error: `„${s}" nije TRUE/FALSE` };
    }
    case 'null': return { value: null };
    case '[]': return { value: [] };
    case '{}': return { value: {} };
    case '': {
      if (typeof raw === 'number' || typeof raw === 'boolean') return { value: raw };
      return s === '' ? { value: null } : { value: s };
    }
    default: return { error: `nepoznat Tip „${typeRaw}" (dopušteno: ${AREA_SETTINGS_TYPES.join(', ')})` };
  }
}

/**
 * Retci jedne Aree → objekt postavki. Nizovi se slažu po indeksu i ZATVARAJU
 * rupe (F5-4): obrisan redak `widgets[1]` ne traži prenumeriranje ostalih.
 * Neispravan redak se preskače i vraća u `errors` — tiho preskočen bi izgledao
 * kao uvezen.
 */
export function unflattenAreaSettings(
  rows: { rowNum: number; path: string; type: string; raw: unknown }[],
  areaName: string,
): { settings: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  // Privremeno: nizovi kao Map<indeks, vrijednost>, sažimaju se na kraju.
  const ARR = Symbol('arr');
  type Node = { [ARR]?: true; m: Map<string | number, unknown> };
  const mk = (arr: boolean): Node => (arr ? { [ARR]: true, m: new Map() } : { m: new Map() });
  const root = mk(false);
  const isNode = (x: unknown): x is Node => !!x && typeof x === 'object' && 'm' in (x as object) && (x as Node).m instanceof Map;

  for (const r of rows) {
    let segs: Seg[];
    try { segs = parsePath(r.path.trim()); } catch (e) { errors.push(`red ${r.rowNum}: ${(e as Error).message}`); continue; }
    const cv = cellToValue(r.raw, r.type);
    if ('error' in cv) { errors.push(`red ${r.rowNum} (${r.path}): ${cv.error}`); continue; }
    const leaf: unknown = typeof cv.value === 'string' ? areaIn(cv.value, areaName)
      : Array.isArray(cv.value) ? mk(true) : cv.value !== null && typeof cv.value === 'object' ? mk(false) : cv.value;

    let cur = root;
    let bad: string | null = null;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const wantArr = !!cur[ARR];
      if ((s.kind === 'index') !== wantArr) { bad = `${r.path}: miješa niz i objekt na istom mjestu`; break; }
      const k = s.kind === 'index' ? s.index : s.key;
      if (i === segs.length - 1) {
        const prev = cur.m.get(k);
        if (prev !== undefined && !(isNode(prev) && isNode(leaf) && !!prev[ARR] === !!(leaf as Node)[ARR])) {
          bad = `${r.path}: ista putanja dvaput`; break;
        }
        if (prev === undefined) cur.m.set(k, leaf);
      } else {
        const nextIsArr = segs[i + 1].kind === 'index';
        let nxt = cur.m.get(k);
        if (nxt === undefined) { nxt = mk(nextIsArr); cur.m.set(k, nxt); }
        if (!isNode(nxt) || !!nxt[ARR] !== nextIsArr) { bad = `${r.path}: miješa vrijednost i podstablo`; break; }
        cur = nxt;
      }
    }
    if (bad) errors.push(`red ${r.rowNum}: ${bad}`);
  }

  const build = (n: Node): Json => {
    if (n[ARR]) {
      return [...n.m.entries()].sort((a, b) => (a[0] as number) - (b[0] as number))
        .map(([, v]) => (isNode(v) ? build(v) : (v as Json)));
    }
    const o: { [k: string]: Json } = {};
    for (const [k, v] of n.m) o[k as string] = isNode(v) ? build(v) : (v as Json);
    return o;
  };
  return { settings: build(root) as Record<string, unknown>, errors };
}

/**
 * Nove postavke Aree: ključevi drugih sheetova iz `current` (baza nakon njihovih
 * sekcija uvoza), ostalo TOČNO iz sheeta (F5-2 — ključ kojeg nema se briše).
 */
export function mergeAreaSettings(
  current: Record<string, unknown> | null | undefined,
  fromSheet: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of OWNED_ELSEWHERE) {
    const v = (current ?? {})[k];
    if (v !== undefined) out[k] = v;
  }
  return { ...out, ...sheetOwnedSettings(fromSheet) };
}

/** Top-level ključevi koji se razlikuju (za poruku u modalu). */
export function changedTopKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  same: (x: unknown, y: unknown) => boolean,
): string[] {
  const keys = new Set([...Object.keys(sheetOwnedSettings(a)), ...Object.keys(sheetOwnedSettings(b))]);
  return [...keys].filter(k => !same(a[k], b[k])).sort();
}
