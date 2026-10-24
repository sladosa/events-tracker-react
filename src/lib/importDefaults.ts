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
 * ⚠ Pregled uvoza i upis zovu OVU funkciju — dvije kopije uvjeta su prilika da se
 *   raziđu (razred `canUpdateExisting`, S125).
 */
import type { ExportAttrDef, ParsedImportRow } from './excelTypes';

export interface DefaultFill {
  attrName: string;
  value:    string;
  count:    number;
}

interface DefaultMapRule {
  def:        ExportAttrDef;
  parentSlug: string;
  map:        Record<string, string>;
}

function ruleOf(def: ExportAttrDef): DefaultMapRule | null {
  const vr  = def.validation_rules as { depends_on?: { attribute_slug?: string; default_map?: Record<string, string> } } | null;
  const dep = vr?.depends_on;
  if (!dep?.attribute_slug || !dep.default_map || Object.keys(dep.default_map).length === 0) return null;
  return { def, parentSlug: dep.attribute_slug, map: dep.default_map };
}

const isBlank = (v: unknown) => v == null || v === '';

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
    const defs  = cats.flatMap(c => byCat.get(c) ?? []);
    const rules = defs.map(ruleOf).filter((r): r is DefaultMapRule => r !== null);
    if (rules.length === 0) return row;
    const nameBySlug = new Map(defs.filter(d => d.slug).map(d => [d.slug as string, d.name]));

    const attrs = { ...row.attributes };
    let changed = false;
    // Lanac (roditelj i sam dobije zadano) se razriješi u najviše `rules.length` prolaza.
    for (let pass = 0; pass < rules.length; pass++) {
      let any = false;
      for (const r of rules) {
        if (!isBlank(attrs[r.def.name])) continue;
        const parentName = nameBySlug.get(r.parentSlug);
        const pv  = parentName ? attrs[parentName] : null;
        const key = pv == null || pv === '_' ? '' : String(pv);
        const value = (key !== '' ? r.map[key] : undefined) ?? r.map['*'];
        if (!value) continue;
        attrs[r.def.name] = value;
        any = changed = true;
        const k = `${r.def.name}\u0000${value}`;
        const f = counts.get(k) ?? { attrName: r.def.name, value, count: 0 };
        f.count++;
        counts.set(k, f);
      }
      if (!any) break;
    }
    return changed ? { ...row, attributes: attrs } : row;
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
