// ============================================================
// automationsConfig.ts — rename sluga u automatici i predlošku komentara
// ============================================================
// Isti razred kao `dashboardConfig.ts` i `listColumns.ts` (S105d): config
// imenuje atribute PO SLUGU, a slug se smije promijeniti u Structure panelu.
//
// Bez ovoga rename tiho ubija:
//   - `automations.attribute_rules` — `Datum naplate` se prestane računati
//     (target/map nepoznat ⇒ pravilo se preskoči), a žig (`lock_slug`) prestane
//     štititi bankin datum, BEZ ijedne poruke;
//   - `automations.rata` — rata modal ne prepozna okidač ili upiše rate bez
//     iznosa / datuma naplate;
//   - `comment_template` (Area I leaf) — `{slug}` koji ne postoji ostane
//     prazan, pa komentar izgubi dio teksta.
// Popravak ide u ISTOM spremanju kao rename (S162, Backlog P4).
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import type { AreaSettings, RataAutomationConfig, AttributeRuleConfig, UUID } from '@/types/database';

type Automations = NonNullable<AreaSettings['automations']>;

/** Zamijeni `oldSlug` u automatici. Čista funkcija. */
export function renameSlugInAutomations(
  automations: Automations,
  oldSlug: string,
  newSlug: string,
): { automations: Automations; changed: number } {
  let changed = 0;
  const swap = <T extends string | undefined>(s: T): T => {
    if (s === oldSlug) { changed++; return newSlug as T; }
    return s;
  };

  const out: Automations = { ...automations };

  if (automations.attribute_rules) {
    out.attribute_rules = automations.attribute_rules.map((r): AttributeRuleConfig => ({
      ...r,
      target_slug: swap(r.target_slug),
      map_slug: swap(r.map_slug),
      ...(r.lock_slug !== undefined ? { lock_slug: swap(r.lock_slug) } : {}),
    }));
  }

  if (automations.rata) {
    const r = automations.rata;
    const rata: RataAutomationConfig = {
      ...r,
      trigger_slug: swap(r.trigger_slug),
      count_slug: swap(r.count_slug),
      amount_slug: swap(r.amount_slug),
      date_map_slug: swap(r.date_map_slug),
    };
    if (r.comment_attr_slug !== undefined) rata.comment_attr_slug = swap(r.comment_attr_slug);
    if (r.charge_date_slug !== undefined) rata.charge_date_slug = swap(r.charge_date_slug);
    if (r.index_slug !== undefined) rata.index_slug = swap(r.index_slug);
    if (r.override_attrs) {
      // Ključevi su slugovi; redoslijed se čuva (Structure export ga ispisuje).
      rata.override_attrs = Object.fromEntries(
        Object.entries(r.override_attrs).map(([k, v]) => [swap(k), v]),
      );
    }
    out.rata = rata;
  }

  return { automations: out, changed };
}

/** Zamijeni `{oldSlug}` u predlošku komentara. Čista funkcija. */
export function renameSlugInTemplate(
  template: string,
  oldSlug: string,
  newSlug: string,
): { template: string; changed: number } {
  const token = `{${oldSlug}}`;
  const parts = template.split(token);
  return { template: parts.join(`{${newSlug}}`), changed: parts.length - 1 };
}

/**
 * Primijeni rename na `areas.settings` (automatika + predložak Aree) i na
 * `categories.settings.comment_template` svih kategorija te Aree.
 * Vraća broj prepisanih referenci (0 = nitko ga nije spominjao).
 *
 * Read-modify-write CIJELOG `settings` objekta, kao `fixupDashboardSlug`:
 * djelomičan upis bi obrisao ostale ključeve.
 * ⚠ Upis se provjerava brojem redaka — RLS-blokiran UPDATE „uspije" s 0.
 */
export async function fixupAutomationsSlug(
  areaId: UUID,
  oldSlug: string,
  newSlug: string,
): Promise<number> {
  if (!oldSlug || oldSlug === newSlug) return 0;
  let total = 0;

  const { data, error } = await supabase
    .from('areas').select('settings').eq('id', areaId).single();
  if (error) throw error;

  const settings = (data?.settings ?? null) as AreaSettings | null;
  if (settings) {
    let changed = 0;
    const next: AreaSettings = { ...settings };
    if (settings.automations) {
      const r = renameSlugInAutomations(settings.automations, oldSlug, newSlug);
      next.automations = r.automations;
      changed += r.changed;
    }
    if (settings.comment_template) {
      const r = renameSlugInTemplate(settings.comment_template, oldSlug, newSlug);
      next.comment_template = r.template;
      changed += r.changed;
    }
    if (changed > 0) {
      const { data: upd, error: upErr } = await supabase
        .from('areas').update({ settings: next }).eq('id', areaId).select('id');
      if (upErr) throw upErr;
      if (!upd?.length) throw new Error('areas.settings: upis nije prošao (0 redaka)');
      total += changed;
    }
  }

  const { data: cats, error: catErr } = await supabase
    .from('categories').select('id, settings').eq('area_id', areaId).order('id');
  if (catErr) throw catErr;

  for (const c of cats ?? []) {
    const cs = c.settings as { comment_template?: string } | null;
    if (!cs?.comment_template) continue;
    const r = renameSlugInTemplate(cs.comment_template, oldSlug, newSlug);
    if (r.changed === 0) continue;
    const { data: upd, error: upErr } = await supabase
      .from('categories')
      .update({ settings: { ...cs, comment_template: r.template } })
      .eq('id', c.id).select('id');
    if (upErr) throw upErr;
    if (!upd?.length) throw new Error('categories.settings: upis nije prošao (0 redaka)');
    total += r.changed;
  }

  return total;
}
