/**
 * importDefaults.ts — `depends_on.default_map` na NOVIM retcima Excel uvoza (S181).
 *
 * ZAŠTO
 *   `default_map` je do S181 bio mehanizam SAMO forme (Add/Edit): redak upisan u
 *   Excel s praznom Namjenom ili Statusom ostajao je prazan u bazi (CLAUDE.md,
 *   „`default_map` ne radi na import putu"; na PROD-u 2 retka bez Statusa).
 *   Od S180 to vrijedi i za Namjenu, koju razrez po Namjeni čita.
 *
 * ⚠ OPSEG JE NAMJERNO UZAK (Sašina odluka S181, razlozi u FAZA3_IMPORT_AUTOMATIKA.md):
 *   - SAMO `default_map`, NIKAD `default_value`. Fitness nosi 7 `default_value`
 *     (`Trening_type=easy`…); na povijesnom uvozu (trening) to bi izmislilo podatak.
 *   - SAMO prazna ćelija (`null`/`''`). `_` je izričito „bez vrijednosti" i ostaje.
 *   - SAMO retci koji ulaze kao NOVI — postojeći (i oni koje „replace" ponovo stvara)
 *     su podatak, ne unos.
 *   - `set_attribute` pravila (datum naplate) se OVDJE NE RAČUNAJU — Visa nema
 *     fiksan dan (FAZA3 §„Pravilo koje se NE SMIJE primijeniti naslijepo").
 *
 * ⚠ ISTO PRAVILO KAO FORMA: `default_map[vrijednost roditelja] ?? default_map['*']`
 *   (`useAttributeDefinitions.ts`). Prazan roditelj ⇒ `*`.
 *
 * ⚠ Traka „Čeka potvrdu" (skupni redak, S193/T48) zove `resolveDefaultMaps` nad
 *   slugovima — isto pravilo; prije toga je redak iz trake ostajao bez Namjene.
 *
 * ⚠ Pregled uvoza i upis zovu OVU funkciju — dvije kopije uvjeta su prilika da se
 *   raziđu (razred `canUpdateExisting`, S125).
 */
import type { ExportAttrDef, ParsedImportRow } from './excelTypes';

export interface DefaultFill {
  attrName: string;
  value:    string;
  count:    number;
}

export interface DefaultMapRule {
  /** Ključ atributa u mapi vrijednosti (`name` na uvozu, `slug` u traci). */
  key:       string;
  /** Ključ roditelja u ISTOJ mapi; `null` = roditelja nema u lancu ⇒ `*`. */
  parentKey: string | null;
  map:       Record<string, string>;
}

/** `depends_on.default_map` atributa, ili `null` kad ga nema. */
export function defaultMapOf(def: { validation_rules?: unknown }): { parentSlug: string; map: Record<string, string> } | null {
  const vr  = def.validation_rules as { depends_on?: { attribute_slug?: string; default_map?: Record<string, string> } } | null;
  const dep = vr?.depends_on;
  if (!dep?.attribute_slug || !dep.default_map || Object.keys(dep.default_map).length === 0) return null;
  return { parentSlug: dep.attribute_slug, map: dep.default_map };
}

const isBlank = (v: unknown) => v == null || v === '';

/**
 * JEDINO pravilo `default_map` izvan forme — uvoz (S181) i traka (skupni redak,
 * S193/T48): prazno polje dobiva `map[vrijednost roditelja] ?? map['*']`; prazan
 * ili `_` roditelj ⇒ `*`. Popunjeno i `_` ostaju. Lanac (roditelj i sam dobije
 * zadano) se razriješi u najviše `rules.length` prolaza.
 * Vraća NOVU mapu i popis upisanog (`[]` = ništa).
 */
export function resolveDefaultMaps<V>(
  values: Record<string, V>,
  rules:  readonly DefaultMapRule[],
): { values: Record<string, V | string>; filled: { key: string; value: string }[] } {
  const out: Record<string, V | string> = { ...values };
  const filled: { key: string; value: string }[] = [];
  for (let pass = 0; pass < rules.length; pass++) {
    let any = false;
    for (const r of rules) {
      if (!isBlank(out[r.key])) continue;
      const pv  = r.parentKey ? out[r.parentKey] : null;
      const key = pv == null || pv === '_' ? '' : String(pv);
      const value = (key !== '' ? r.map[key] : undefined) ?? r.map['*'];
      if (!value) continue;
      out[r.key] = value;
      filled.push({ key: r.key, value });
      any = true;
    }
    if (!any) break;
  }
  return { values: out, filled };
}

/**
 * Vrati retke s upisanim zadanim vrijednostima i popis što je upisano.
 * @param catsOf  kategorije lanca retka (leaf + roditelji); `null` = redak se ne da smjestiti ⇒ netaknut
 */
export function fillDefaultMaps(
  rows:     ParsedImportRow[],
  attrDefs: ExportAttrDef[],
  catsOf:   (row: ParsedImportRow) => string[] | null,
): { rows: ParsedImportRow[]; fills: DefaultFill[] } {
  const byCat = new Map<string, ExportAttrDef[]>();
  for (const d of attrDefs) {
    if (!byCat.has(d.category_id)) byCat.set(d.category_id, []);
    byCat.get(d.category_id)!.push(d);
  }
  const counts = new Map<string, DefaultFill>();

  const out = rows.map(row => {
    const cats = catsOf(row);
    if (!cats || cats.length === 0) return row;
    const defs = cats.flatMap(c => byCat.get(c) ?? []);
    const nameBySlug = new Map(defs.filter(d => d.slug).map(d => [d.slug as string, d.name]));
    const rules: DefaultMapRule[] = [];
    for (const d of defs) {
      const dm = defaultMapOf(d);
      if (dm) rules.push({ key: d.name, parentKey: nameBySlug.get(dm.parentSlug) ?? null, map: dm.map });
    }
    if (rules.length === 0) return row;

    const { values, filled } = resolveDefaultMaps(row.attributes, rules);
    if (filled.length === 0) return row;
    for (const { key, value } of filled) {
      const k = `${key}\u0000${value}`;
      const f = counts.get(k) ?? { attrName: key, value, count: 0 };
      f.count++;
      counts.set(k, f);
    }
    return { ...row, attributes: values as ParsedImportRow['attributes'] };
  });

  return { rows: out, fills: [...counts.values()] };
}

/** Jedna rečenica za pregled uvoza i izvještaj; `null` kad nije upisano ništa. */
export function defaultFillsMessage(fills: DefaultFill[]): string | null {
  if (fills.length === 0) return null;
  const byAttr = new Map<string, DefaultFill[]>();
  for (const f of fills) {
    if (!byAttr.has(f.attrName)) byAttr.set(f.attrName, []);
    byAttr.get(f.attrName)!.push(f);
  }
  const parts = [...byAttr].map(([name, fs]) => {
    const n = fs.reduce((s, f) => s + f.count, 0);
    const byCount = [...fs].sort((a, b) => b.count - a.count);
    return `${name} ${n} (${byCount.map(f => `${f.value} ${f.count}`).join(', ')})`;
  });
  return `Zadano iz pravila (kao forma) na novim retcima s praznom ćelijom: ${parts.join(' · ')}.`;
}
