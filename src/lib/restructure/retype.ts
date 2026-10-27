/**
 * restructure/retype.ts — A1: promijeni tip atributa (PREUREDJIVANJE_SPEC §24). S185.
 *
 * Čist planer (bez I/O), isti obrazac kao `plan.ts`: snimka → što se mijenja,
 * što se NE da pretvoriti, što u configu prati, blokade, paket za
 * `rpc_restructure_retype` (`sql/060`).
 *
 * ⚠ PRETVORBA ŽIVI NA DVA MJESTA — ovdje (pregled) i u `_restructure_convert`
 *   (`060`, izvođenje). Čuva ih zajednički popis primjera (`CONVERT_EXAMPLES`,
 *   test u TS-u i proba u SQL-u). Tko mijenja jednu, mijenja obje.
 * ⚠ `broj` je NAMJERNO stroži od `parseAmountInput`: prima samo `-12`, `2,3`, `2.3`.
 *   `1.234` je dvosmislen (tisuća ili decimala) — pretvorba koja pogađa bila bi
 *   tiha greška, a ovako je redak na popisu nepretvorivih.
 * ⚠ SVAKI redak se mora dati pretvoriti, inače blokada (§24.1): tekst u brojčanom
 *   atributu app ne prikazuje (čita `value_number`) — gubitak bez ijedne poruke.
 * ⚠ Config koji atribut koristi kao ULOGU (pločica, grupiranje, automatika, sidro,
 *   `depends_on`) blokira — F2 ga ne zna prevesti; kolone liste, profil i shortcuti
 *   se prevode istom pretvorbom.
 */
import { buildRules, sameRules } from '@/lib/validationRules';
import { same } from './plan';
import type { SnapshotAttribute, SnapshotPreset } from './plan';

export type Conv =
  | { kind: 'broj' }
  | { kind: 'mm:ss' }
  | { kind: 'mapa'; map: Record<string, number> };

export type RetypeType = 'number' | 'text';

const BROJ_RE = /^-?\d+(?:[.,]\d+)?$/;
const MMSS_RE = /^(\d{1,2}):([0-5]\d)$/;

/** Tekst → broj po pretvorbi; `null` = ne da se pretvoriti. */
export function convertValue(text: string, conv: Conv): number | null {
  const t = text.trim();
  if (conv.kind === 'broj') return BROJ_RE.test(t) ? Number(t.replace(',', '.')) : null;
  if (conv.kind === 'mm:ss') {
    const m = MMSS_RE.exec(t);
    if (!m) return null;
    // stotinke minute iz CIJELIH sekundi: t·5/3 nikad nema ostatak .5 ⇒ isto zaokruživanje kao SQL
    return Math.round(((Number(m[1]) * 60 + Number(m[2])) * 5) / 3) / 100;
  }
  const v = conv.map[t];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Broj → tekst: isti oblik kao `trim_scale(numeric)::text` u SQL-u (`6.10` → `6.1`). */
export const numberToText = (n: number): string => String(n);

/** Primjeri koje dijele TS test i SQL proba (`060` mora dati isto). */
export const CONVERT_EXAMPLES: Array<[string, Conv, number | null]> = [
  ['2,3', { kind: 'broj' }, 2.3],
  ['2.3', { kind: 'broj' }, 2.3],
  [' 42 ', { kind: 'broj' }, 42],
  ['-5', { kind: 'broj' }, -5],
  ['1.234,5', { kind: 'broj' }, null],
  ['abc', { kind: 'broj' }, null],
  ['', { kind: 'broj' }, null],
  ['6:06', { kind: 'mm:ss' }, 6.1],
  ['06:07', { kind: 'mm:ss' }, 6.12],
  ['10:00', { kind: 'mm:ss' }, 10],
  ['5:60', { kind: 'mm:ss' }, null],
  ['6.06', { kind: 'mm:ss' }, null],
  [':-)', { kind: 'mapa', map: { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 } }, 4],
  [':-|', { kind: 'mapa', map: { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 } }, 3],
  [':)', { kind: 'mapa', map: { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 } }, null],
];

// ─────────────────────────────────────────────

export interface RetypeInput {
  category: string;
  slug: string;
  to: RetypeType;
  conv?: Conv;
}

export interface RetypeValue {
  id: string;                 // event_attributes.id
  event_id: string;
  event_date: string;
  value_text: string | null;
  value_number: number | null;
}

export interface RetypeSnapshot {
  areaId: string;
  settings: Record<string, unknown> | null;
  categories: Array<{ id: string; name: string }>;
  attributes: SnapshotAttribute[];
  /** Svi `event_attributes` retci TOG atributa. */
  values: RetypeValue[];
  presets: SnapshotPreset[];
  anchors: Array<{ id: string; group_slug: string; group_value: string }>;
}

export interface RetypeConfigWrite {
  kind: 'attribute_definition' | 'attribute_rules' | 'area_settings' | 'preset';
  target_id: string;
  before: unknown;
  after: unknown;
}

export interface RetypePlan {
  /** `done` = atribut JE već traženog tipa (S186: ponovljen file ⇒ „already in this state", ne greška). */
  state: 'todo' | 'done';
  attr: SnapshotAttribute | null;
  from: string | null;
  /** retci koji se mijenjaju (izvor nije prazan) */
  rows: number;
  /** prvih 50 nepretvorivih (datum, vrijednost) i ukupan broj */
  unconvertible: { count: number; first: Array<{ event_date: string; value: string }> };
  changes: string[];
  warnings: string[];
  errors: string[];
  config: RetypeConfigWrite[];
  /** event_attributes.id → nova vrijednost (broj ili tekst) — ponovno mjerenje */
  predicted: Record<string, number | string>;
  rpc: {
    p_area_id: string; p_attr: string; p_to_type: RetypeType; p_conv: Conv | null;
    p_config: RetypeConfigWrite[]; p_expected: number;
  } | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
/** Navodi li podstablo configa slug kao vrijednost (`"slug"`)? Konzervativno — blokada je sigurna. */
const mentions = (v: unknown, slug: string) => v != null && JSON.stringify(v).includes(JSON.stringify(slug));

export function planRetype(input: RetypeInput, snap: RetypeSnapshot): RetypePlan {
  const out: RetypePlan = {
    state: 'todo', attr: null, from: null, rows: 0, unconvertible: { count: 0, first: [] },
    changes: [], warnings: [], errors: [], config: [], predicted: {}, rpc: null,
  };
  const { errors, warnings, changes } = out;
  const cat = snap.categories.find(c => c.name === input.category);
  const attr = cat ? snap.attributes.find(a => a.category_id === cat.id && a.slug === input.slug) : undefined;
  if (!cat) { errors.push(`category "${input.category}" does not exist in this Area.`); return out; }
  if (!attr) { errors.push(`attribute "${input.slug}" is not on category "${input.category}".`); return out; }
  out.attr = attr;
  out.from = attr.data_type;
  const from = attr.data_type, to = input.to;
  const conv = input.conv ?? null;

  // Stanje baze je dokaz da je korak izveden (S186) — ponovljen file nije greška.
  if (from === to) { out.state = 'done'; return out; }
  if (!((from === 'text' && to === 'number') || (from === 'number' && to === 'text'))) {
    errors.push(`${from} → ${to} is not supported (only text ↔ number).`);
  }
  if (from === 'text' && to === 'number' && !conv) errors.push('text → number needs a conversion (number, mm:ss or map).');
  if (errors.length) return out;

  const conversion = (s: string): number | string | null =>
    to === 'number' ? convertValue(s, conv!) : s;
  const toNumberText = (v: number) => numberToText(v);

  // ── Blokade: uloge koje F2 ne zna prevesti ──
  const rules = isObj(attr.validation_rules) ? attr.validation_rules : {};
  if (isObj(rules.depends_on)) errors.push(`${attr.slug} has depends_on (menu keys are text).`);
  for (const a of snap.attributes) {
    const dep = isObj(a.validation_rules) && isObj(a.validation_rules.depends_on) ? a.validation_rules.depends_on : null;
    if (dep && dep.attribute_slug === attr.slug && a.category_id === attr.category_id) {
      errors.push(`${a.slug} depends on ${attr.slug} (depends_on).`);
    }
  }
  const s0 = isObj(snap.settings) ? snap.settings : {};
  for (const k of ['dashboard', 'groupings', 'automations'] as const) {
    if (mentions(s0[k], attr.slug)) errors.push(`${k} uses ${attr.slug} — changing the type cannot translate that role; remove ${attr.slug} from ${k} first.`);
  }
  if (snap.anchors.some(b => b.group_slug === attr.slug)) errors.push(`balance anchors are grouped by ${attr.slug}.`);

  // ── Retci ──
  const bad: Array<{ event_date: string; value: string }> = [];
  for (const v of snap.values) {
    if (from === 'text') {
      if (v.value_text == null) continue;
      const n = conversion(v.value_text);
      if (n == null) { bad.push({ event_date: v.event_date, value: v.value_text }); continue; }
      out.predicted[v.id] = n;
    } else {
      if (v.value_number == null) continue;
      out.predicted[v.id] = toNumberText(v.value_number);
    }
    out.rows++;
  }
  bad.sort((x, y) => x.event_date.localeCompare(y.event_date));
  out.unconvertible = { count: bad.length, first: bad.slice(0, 50) };
  if (bad.length) errors.push(`${bad.length} rows cannot be converted (first: ${bad[0].event_date} "${bad[0].value}").`);

  // ── Definicija: tip + zadana vrijednost ──
  let dv: string | null = attr.default_value;
  if (dv != null && dv !== '') {
    const n = to === 'number' ? convertValue(dv, conv!) : dv;
    if (n == null) errors.push(`default value "${dv}" cannot be converted.`);
    else { dv = String(n); if (dv !== attr.default_value) changes.push(`default value "${attr.default_value}" → "${dv}"`); }
  }
  out.config.push({
    kind: 'attribute_definition', target_id: attr.id,
    before: { data_type: from, default_value: attr.default_value },
    after: { data_type: to, default_value: dv },
  });
  changes.push(`${attr.slug}: ${from} → ${to}${conv ? ` (${conv.kind === 'broj' ? 'number' : conv.kind})` : ''}, ${out.rows} rows`);

  // ── Izbornik: broj nema suggest ──
  if (to === 'number') {
    const after = buildRules({ hiddenInAdd: rules.hidden_in_add === true });
    if (!sameRules(rules, after)) {
      out.config.push({ kind: 'attribute_rules', target_id: attr.id, before: attr.validation_rules, after });
      if (Array.isArray(rules.suggest) && rules.suggest.length) changes.push(`menu (${rules.suggest.length} options) is removed — a number is typed in`);
    }
  }

  // ── Postavke Aree: kolone liste, profili ──
  const key = (k: string): string | null => {
    if (to === 'text') return k;
    const n = convertValue(k, conv!);
    return n == null ? null : toNumberText(n);
  };
  const s = clone(s0);
  const lc = isObj(s.list_columns) && Array.isArray(s.list_columns.columns) ? s.list_columns.columns : [];
  for (const c of lc) {
    if (!isObj(c) || !Array.isArray(c.slugs) || !c.slugs.includes(attr.slug) || !isObj(c.map)) continue;
    const nm: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c.map)) {
      const nk = key(k);
      if (nk == null) { warnings.push(`column "${c.label ?? attr.slug}": map key "${k}" cannot be converted — it stays (and will never match).`); nm[k] = v; }
      else { nm[nk] = v; if (nk !== k) changes.push(`column "${c.label ?? attr.slug}": map "${k}" → "${nk}"`); }
    }
    c.map = nm;
  }
  if (isObj(s.export_profiles)) {
    for (const [pname, p] of Object.entries(s.export_profiles)) {
      const fs = isObj(p) && isObj(p.filterState) ? p.filterState : null;
      const raw = fs && typeof fs.attrFilterRaw === 'string' ? fs.attrFilterRaw : null;
      const m = raw?.match(/^([^:]+):\s*(>=|<=|>|<|=|~)(.+)$/);
      if (!m) continue;
      const k = m[1].trim();
      if (k !== attr.slug && k !== attr.id) continue;
      const nv = m[2] === '=' ? key(m[3]) : null;
      if (nv != null) { fs!.attrFilterRaw = `${k}: =${nv}`; if (nv !== m[3]) changes.push(`profile "${pname}": filter "${m[3]}" → "${nv}"`); }
      else warnings.push(`profile "${pname}": filter "${raw}" — check it after the type change.`);
    }
  }
  if (!same(s0, s)) out.config.push({ kind: 'area_settings', target_id: snap.areaId, before: snap.settings, after: s });

  // ── Shortcuti ──
  for (const p of snap.presets) {
    const before = { default_attributes: p.default_attributes ?? null, filter_state: p.filter_state ?? null };
    const after = clone(before);
    const where = `shortcut "${p.name}"`;
    if (isObj(after.default_attributes) && attr.id in after.default_attributes) {
      const v = after.default_attributes[attr.id];
      // shortcut drži VRIJEDNOST (broj za number), za razliku od ključa mape kolone (tekst prikaza)
      const nv = v == null || v === '' ? v
        : to === 'number' ? convertValue(String(v), conv!) : String(v);
      if (nv == null && v != null && v !== '') errors.push(`${where}: sets "${String(v)}", which cannot be converted.`);
      else if (nv !== v) { after.default_attributes[attr.id] = nv; changes.push(`${where}: "${String(v)}" → "${String(nv)}"`); }
    }
    const af = isObj(after.filter_state) && isObj(after.filter_state.attrFilter) ? after.filter_state.attrFilter : null;
    if (af && String(af.attrDefId) === attr.id) warnings.push(`${where}: filters by ${attr.slug} — check it after the type change.`);
    if (!same(before, after)) out.config.push({ kind: 'preset', target_id: p.id, before, after });
  }

  if (!errors.length) {
    out.rpc = {
      p_area_id: snap.areaId, p_attr: attr.id, p_to_type: to, p_conv: conv,
      p_config: out.config, p_expected: out.rows,
    };
  }
  return out;
}
