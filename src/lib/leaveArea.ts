/**
 * leaveArea.ts — "Leave shared area" operations for grantee users.
 *
 * leaveAreaOnly      — simple DELETE from data_shares (no data migration).
 * detachAreaWithData — copies owner's area structure into grantee's account,
 *                      batch-reassigns grantee's events + event_attributes to
 *                      new UUIDs, then leaves the shared area.
 *
 * Batch strategy for 3000+ events:
 *   - events grouped by (old_category_id, old_chain_key) pair → 1 UPDATE per pair
 *   - event_attributes grouped by old_attribute_definition_id → 1 UPDATE per attr_def
 */

import { supabase } from '@/lib/supabaseClient';

// ── Types ────────────────────────────────────────────────

export interface DetachProgress {
  step: 'loading' | 'copying_structure' | 'moving_attrs' | 'moving_events' | 'leaving' | 'done';
  detail?: string;
}

// ── Helpers ──────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

// ── Public API ───────────────────────────────────────────

/** Count grantee's own events in a shared area. */
export async function countGranteeEventsInArea(sharedAreaId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: cats } = await supabase
    .from('categories')
    .select('id')
    .eq('area_id', sharedAreaId);

  const catIds = (cats ?? []).map((c: { id: string }) => c.id);
  if (catIds.length === 0) return 0;

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('category_id', catIds)
    .eq('user_id', user.id);

  return count ?? 0;
}

/** Leave without migrating data. Events become inaccessible (still in DB). */
export async function leaveAreaOnly(sharedAreaId: string): Promise<{ error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not logged in' };

    const { error } = await supabase
      .from('data_shares')
      .delete()
      .eq('target_id', sharedAreaId)
      .eq('grantee_id', user.id);

    if (error) throw error;
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Leave failed' };
  }
}

/**
 * Copy owner's area structure to grantee's account, batch-reassign all
 * grantee events + event_attributes to new UUIDs, then leave the shared area.
 *
 * Rollback: if structure copy or attr reassignment fails before events are
 * touched, deletes the new area (cascade). If events are partially moved,
 * leaves new area intact (user retains share access to see data).
 */
export async function detachAreaWithData(
  sharedAreaId: string,
  newAreaName: string,
  onProgress?: (p: DetachProgress) => void,
): Promise<{ error?: string; newAreaId?: string }> {

  const progress = (step: DetachProgress['step'], detail?: string) =>
    onProgress?.({ step, detail });

  let newAreaId: string | null = null;
  let eventsStarted = false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not logged in' };

    // ── 1. Load shared area metadata ─────────────────────
    progress('loading', 'Loading area structure…');

    const { data: sharedArea, error: areaErr } = await supabase
      .from('areas')
      .select('*')
      .eq('id', sharedAreaId)
      .single();
    if (areaErr) throw areaErr;

    // ── 2. Load categories ────────────────────────────────
    const { data: catRows, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('area_id', sharedAreaId)
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true });
    if (catErr) throw catErr;

    const catList = catRows ?? [];
    const oldCatIds = catList.map((c: { id: string }) => c.id);

    // ── 3. Load attr_defs ─────────────────────────────────
    let attrDefs: Record<string, unknown>[] = [];
    if (oldCatIds.length > 0) {
      const { data: adData, error: adErr } = await supabase
        .from('attribute_definitions')
        .select('*')
        .in('category_id', oldCatIds);
      if (adErr) throw adErr;
      attrDefs = adData ?? [];
    }

    // ── 4. Load grantee events in this area ───────────────
    let granteeEvents: { id: string; category_id: string; chain_key: string }[] = [];
    if (oldCatIds.length > 0) {
      const { data: evData, error: evErr } = await supabase
        .from('events')
        .select('id, category_id, chain_key')
        .in('category_id', oldCatIds)
        .eq('user_id', user.id);
      if (evErr) throw evErr;
      granteeEvents = evData ?? [];
    }

    // ── 5. Resolve unique area name/slug for grantee ──────
    const { data: userAreas } = await supabase
      .from('areas')
      .select('name, slug, sort_order')
      .eq('user_id', user.id);

    const existingNames = new Set(
      (userAreas ?? []).map((a: { name: string }) => a.name.toLowerCase()),
    );
    const existingSlugs = new Set(
      (userAreas ?? []).map((a: { slug: string }) => a.slug),
    );

    let finalName = newAreaName;
    if (existingNames.has(finalName.toLowerCase())) finalName = `${newAreaName}_det`;
    if (existingNames.has(finalName.toLowerCase())) finalName = `${newAreaName}_det2`;

    let finalSlug = generateSlug(finalName);
    if (existingSlugs.has(finalSlug)) finalSlug = `${finalSlug}_det`;

    const maxSort = (userAreas ?? []).reduce(
      (m: number, a: { sort_order?: number }) => Math.max(m, a.sort_order ?? 0),
      0,
    );

    // ── 6. Build UUID maps ────────────────────────────────
    progress('copying_structure', 'Creating your own copy of the area…');

    const catIdMap = new Map<string, string>();
    catList.forEach((c: { id: string }) => catIdMap.set(c.id, crypto.randomUUID()));

    const attrDefIdMap = new Map<string, string>();
    attrDefs.forEach((ad) => attrDefIdMap.set(ad.id as string, crypto.randomUUID()));

    // ── 7. Insert new area ────────────────────────────────
    newAreaId = crypto.randomUUID();

    const { error: insertAreaErr } = await supabase.from('areas').insert({
      id: newAreaId,
      user_id: user.id,
      name: finalName,
      slug: finalSlug,
      sort_order: maxSort + 10,
      icon: (sharedArea as { icon?: string | null }).icon ?? null,
      color: (sharedArea as { color?: string | null }).color ?? null,
      description: (sharedArea as { description?: string | null }).description ?? null,
    });
    if (insertAreaErr) throw insertAreaErr;

    // ── 8. Insert categories ──────────────────────────────
    if (catList.length > 0) {
      const newCats = catList.map((c: {
        id: string; parent_category_id: string | null; name: string; slug: string;
        description: string | null; level: number; sort_order: number;
      }) => ({
        id: catIdMap.get(c.id)!,
        user_id: user.id,
        area_id: newAreaId!,
        parent_category_id: c.parent_category_id
          ? (catIdMap.get(c.parent_category_id) ?? null)
          : null,
        name: c.name,
        slug: c.slug,
        description: c.description,
        level: c.level,
        sort_order: c.sort_order,
        path: null,
      }));
      const { error: catInsertErr } = await supabase.from('categories').insert(newCats);
      if (catInsertErr) throw catInsertErr;
    }

    // ── 9. Insert attr_defs ───────────────────────────────
    if (attrDefs.length > 0) {
      const newAttrs = attrDefs.map((ad: Record<string, unknown>) => ({
        id: attrDefIdMap.get(ad.id as string)!,
        user_id: user.id,
        category_id: catIdMap.get(ad.category_id as string) ?? null,
        name: ad.name,
        slug: ad.slug,
        description: ad.description,
        data_type: ad.data_type,
        unit: ad.unit,
        is_required: ad.is_required,
        default_value: ad.default_value,
        validation_rules: ad.validation_rules,
        sort_order: ad.sort_order,
      }));
      const { error: attrInsertErr } = await supabase.from('attribute_definitions').insert(newAttrs);
      if (attrInsertErr) throw attrInsertErr;
    }

    // ── 10. Reassign event_attributes ─────────────────────
    if (granteeEvents.length > 0) {
      progress('moving_attrs', `Migrating attributes for ${granteeEvents.length} events…`);
      eventsStarted = true;

      const eventIds = granteeEvents.map(e => e.id);

      // Fetch in chunks of 500 to avoid URL length limits
      const CHUNK = 500;
      const allEAs: { id: string; attribute_definition_id: string }[] = [];
      for (let i = 0; i < eventIds.length; i += CHUNK) {
        const { data: chunk, error: eaErr } = await supabase
          .from('event_attributes')
          .select('id, attribute_definition_id')
          .in('event_id', eventIds.slice(i, i + CHUNK));
        if (eaErr) throw eaErr;
        allEAs.push(...(chunk ?? []));
      }

      // Group by old_attr_def_id → batch UPDATE
      const easByAttrDef = new Map<string, string[]>();
      for (const ea of allEAs) {
        if (!attrDefIdMap.has(ea.attribute_definition_id)) continue;
        const ids = easByAttrDef.get(ea.attribute_definition_id) ?? [];
        ids.push(ea.id);
        easByAttrDef.set(ea.attribute_definition_id, ids);
      }

      for (const [oldId, eaIds] of easByAttrDef) {
        const newId = attrDefIdMap.get(oldId)!;
        // Update in chunks in case of large EA sets
        for (let i = 0; i < eaIds.length; i += CHUNK) {
          const { error: eaUpdateErr } = await supabase
            .from('event_attributes')
            .update({ attribute_definition_id: newId })
            .in('id', eaIds.slice(i, i + CHUNK));
          if (eaUpdateErr) throw eaUpdateErr;
        }
      }

      // ── 11. Reassign events ───────────────────────────────
      progress('moving_events', `Moving ${granteeEvents.length} events to your area…`);

      // Group by (old_category_id : old_chain_key) pair → batch UPDATE
      const pairMap = new Map<string, string[]>();
      for (const ev of granteeEvents) {
        const key = `${ev.category_id}:${ev.chain_key}`;
        const ids = pairMap.get(key) ?? [];
        ids.push(ev.id);
        pairMap.set(key, ids);
      }

      for (const [key, evIds] of pairMap) {
        const sep = key.indexOf(':');
        const oldCatId = key.slice(0, sep);
        const oldChainKey = key.slice(sep + 1);
        const newCatId = catIdMap.get(oldCatId);
        const newChainKey = catIdMap.get(oldChainKey);
        if (!newCatId || !newChainKey) continue;

        for (let i = 0; i < evIds.length; i += CHUNK) {
          const { error: evUpdateErr } = await supabase
            .from('events')
            .update({ category_id: newCatId, chain_key: newChainKey })
            .in('id', evIds.slice(i, i + CHUNK));
          if (evUpdateErr) throw evUpdateErr;
        }
      }
    }

    // ── 12. Leave shared area ─────────────────────────────
    progress('leaving', 'Removing shared access…');

    const { error: leaveErr } = await supabase
      .from('data_shares')
      .delete()
      .eq('target_id', sharedAreaId)
      .eq('grantee_id', user.id);
    if (leaveErr) throw leaveErr;

    progress('done');
    return { newAreaId };

  } catch (err) {
    // Only rollback new area if events haven't been touched yet
    if (newAreaId && !eventsStarted) {
      void supabase.from('areas').delete().eq('id', newAreaId);
    }
    return { error: err instanceof Error ? err.message : 'Detach failed' };
  }
}
