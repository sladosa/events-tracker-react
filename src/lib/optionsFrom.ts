/**
 * optionsFrom.ts — izbornik atributa iz zapisa DRUGE Aree (S190, katalog vježbi).
 *
 * `validation_rules.options_from`:
 *   { area: 'Katalog vježbi', category: 'Vježba', attribute: 'slug',
 *     label?: 'name', group?: 'group', group2?: 'secondary' }
 *
 * Polje sprema VRIJEDNOST `attribute` (slug vježbe); izbornik pokazuje `label` (ime) i slaže po
 * `group`. Veza je po IMENU Aree i kategorije i po slugu atributa — nikad UUID — pa preživi
 * „From template", Structure Excel i prijenos TEST → PROD.
 *
 * Structure Excel: kolona `OptionsFrom`, ćelija
 *   `Katalog vježbi > Vježba : slug | label: name | group: group | group2: secondary`
 * Prazna ćelija ⇒ običan izbornik; nema kolone ⇒ baza ostaje.
 */

export interface OptionsFrom {
  area: string;
  /** Put kategorije unutar Aree, `>` između razina. */
  category: string;
  attribute: string;
  label: string | null;
  group: string | null;
  group2: string | null;
}

export function readOptionsFrom(raw: unknown): OptionsFrom | null {
  const rules = asObject(raw);
  const o = asObject(rules?.options_from);
  if (!o) return null;
  const s = (k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim() : null);
  const area = s('area'), category = s('category'), attribute = s('attribute');
  if (!area || !category || !attribute) return null;
  return { area, category, attribute, label: s('label'), group: s('group'), group2: s('group2') };
}

export function optionsFromToRaw(o: OptionsFrom): Record<string, string> {
  const raw: Record<string, string> = { area: o.area, category: o.category, attribute: o.attribute };
  if (o.label) raw.label = o.label;
  if (o.group) raw.group = o.group;
  if (o.group2) raw.group2 = o.group2;
  return raw;
}

export function serializeOptionsFrom(o: OptionsFrom | null): string {
  if (!o) return '';
  const parts = [`${o.area} > ${o.category} : ${o.attribute}`];
  if (o.label) parts.push(`label: ${o.label}`);
  if (o.group) parts.push(`group: ${o.group}`);
  if (o.group2) parts.push(`group2: ${o.group2}`);
  return parts.join(' | ');
}

export type OptionsFromCell = { ok: true; value: OptionsFrom | null } | { ok: false; error: string };

export function parseOptionsFromCell(cell: string): OptionsFromCell {
  const s = cell.trim();
  if (!s) return { ok: true, value: null };
  const [head, ...rest] = s.split('|').map(p => p.trim());
  const colon = head.lastIndexOf(':');
  const path = colon > 0 ? head.slice(0, colon).trim() : '';
  const attribute = colon > 0 ? head.slice(colon + 1).trim() : '';
  const segs = path.split('>').map(p => p.trim()).filter(Boolean);
  if (segs.length < 2 || !attribute) {
    return { ok: false, error: `"${s}" — expected "Area > Category : attribute_slug"` };
  }
  const out: OptionsFrom = {
    area: segs[0], category: segs.slice(1).join(' > '), attribute, label: null, group: null, group2: null,
  };
  for (const p of rest) {
    const m = /^(label|group2|group)\s*:\s*(\S+)$/i.exec(p);
    if (!m) return { ok: false, error: `"${p}" — expected label: / group: / group2: <attribute_slug>` };
    out[m[1].toLowerCase() as 'label' | 'group' | 'group2'] = m[2];
  }
  return { ok: true, value: out };
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}
