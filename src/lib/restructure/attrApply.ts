/**
 * restructure/attrApply.ts — I/O za sheet `Restructure attributes` (F2 A1, S186).
 *
 * Obrazac kao `apply.ts` (F1): snimka → planer (`retype.ts`) → RPC (`060`) →
 * PONOVNO MJERENJE „baza = predviđanje"; Poništi (`058`) → „baza = prije".
 *
 * KORACI IDU JEDAN PO JEDAN (Saša, S186). Pregled pita bazu za SVAKI korak redom:
 *   done     atribut JE već traženog tipa — „Already in this state" (+ kad i tko, iz
 *            `restructure_ops`, ako je izveden ovim alatom). Dokaz je STANJE, ne oznaka
 *            u fileu: isti file uvezen drugi put ne mijenja ništa, bez ikakvog loga u Excelu.
 *   next     prvi korak koji nije izveden — jedini koji se smije primijeniti.
 *   blocked  prvi neizvedeni korak ima greške (nepretvorivi retci, uloga u pločici…).
 *   waiting  sve iza `next`/`blocked` — planira se tek kad prethodni prođe, jer korak
 *            smije ovisiti o prethodnom (S179: niz koraka nije idempotentan).
 *   unsupported  `merge into` (A4) — čita se, planer još ne postoji; zaustavlja niz.
 */
import { supabase } from '@/lib/supabaseClient';
import { fetchAllPaged, fetchAllPagedIn } from '@/lib/supabasePaging';
import { toError, withRetryQuery } from '@/lib/retry';
import { same } from './plan';
import type { SnapshotAttribute, SnapshotPreset } from './plan';
import { planRetype, type RetypePlan, type RetypeSnapshot } from './retype';
import { toRetypeInput, type AttrStep } from './attrSheet';
import type { Verification } from './apply';

const must = <T>(r: { data: T[]; error: unknown }, what: string): T[] => {
  if (r.error) throw new Error(`Restructure: reading ${what} failed — ${toError(r.error).message}`);
  return r.data;
};

/** Snimka za JEDAN korak A1: cijela Area (config, kategorije, atributi), retci samo ciljnog atributa. */
export async function loadRetypeSnapshot(areaId: string, step: Extract<AttrStep, { kind: 'retype' }>): Promise<RetypeSnapshot> {
  const { data: area, error } = await withRetryQuery(() =>
    supabase.from('areas').select('id, settings').eq('id', areaId).maybeSingle());
  if (error) throw toError(error);
  if (!area) throw new Error('Restructure: Area not found (or no permission to read it).');

  const cats = must(await fetchAllPaged<{ id: string; name: string }>((f, t) =>
    supabase.from('categories').select('id, name').eq('area_id', areaId).order('id').range(f, t)), 'categories');
  const catIds = cats.length ? cats.map(c => c.id) : ['00000000-0000-0000-0000-000000000000'];
  const attrs = must(await fetchAllPagedIn<SnapshotAttribute>(catIds, (chunk, f, t) =>
    supabase.from('attribute_definitions')
      .select('id, category_id, slug, name, data_type, default_value, validation_rules')
      .in('category_id', chunk).order('id').range(f, t)), 'attribute_definitions');

  const cat = cats.find(c => c.name === step.category);
  const target = cat ? attrs.find(a => a.category_id === cat.id && a.slug === step.slug) : undefined;

  type Ea = { id: string; event_id: string; value_text: string | null; value_number: number | null;
    // supabase-js tipizira embed kao niz; veza prema JEDNOM retku u praksi stiže kao objekt
    events: { event_date: string } | Array<{ event_date: string }> | null };
  const dateOf = (e: Ea['events']) => (Array.isArray(e) ? e[0]?.event_date : e?.event_date) ?? '';
  const [valRes, presetRes, anchorRes] = await Promise.all([
    target
      ? fetchAllPaged<Ea>((f, t) => supabase.from('event_attributes')
        .select('id, event_id, value_text, value_number, events!event_attributes_event_id_fkey(event_date)')
        .eq('attribute_definition_id', target.id).order('id').range(f, t))
      : Promise.resolve({ data: [] as Ea[], error: null }),
    fetchAllPaged<SnapshotPreset>((f, t) => supabase.from('activity_presets')
      .select('id, name, area_id, category_id, default_attributes, filter_state')
      .or(`area_id.eq.${areaId},category_id.in.(${catIds.join(',')})`)
      .order('id').range(f, t)),
    fetchAllPaged<{ id: string; group_slug: string; group_value: string }>((f, t) =>
      supabase.from('balance_anchors').select('id, group_slug, group_value')
        .eq('area_id', areaId).order('id').range(f, t)),
  ]);

  return {
    areaId,
    settings: (area.settings ?? null) as Record<string, unknown> | null,
    categories: cats,
    attributes: attrs,
    values: must(valRes, 'event_attributes').map(v => ({
      id: v.id, event_id: v.event_id, event_date: dateOf(v.events),
      value_text: v.value_text, value_number: v.value_number == null ? null : Number(v.value_number),
    })),
    presets: must(presetRes, 'activity_presets'),
    anchors: must(anchorRes, 'balance_anchors'),
  };
}

/** Zapis iz `restructure_ops` koji je izveo korak (za „Already in this state"). */
export interface AppliedRecord { at: string; by: string; source: string | null; opId: string }

/** Korak koji je planiran nad svježom snimkom (`next` se smije primijeniti, `blocked` ne). */
export interface PlannedStep { step: AttrStep; status: 'next' | 'blocked'; plan: RetypePlan; snapshot: RetypeSnapshot }

export type AttrStepStatus =
  | { step: AttrStep; status: 'done'; record: AppliedRecord | null }
  | PlannedStep
  | { step: AttrStep; status: 'waiting' | 'unsupported' };

async function findRecord(areaId: string, attrId: string, to: string): Promise<AppliedRecord | null> {
  // RLS: čita samo vlasnik Aree — isti koji smije preuređivati. Neuspjelo čitanje NIJE
  // „nije izveden": stanje je već dokazano, zapis je samo objašnjenje ⇒ tiho null.
  const { data, error } = await supabase.from('restructure_ops')
    .select('id, created_at, actor, actor_label, source, plan')
    .eq('area_id', areaId).eq('status', 'applied')
    .order('created_at', { ascending: false }).limit(200);
  if (error || !data) return null;
  type Op = { id: string; created_at: string; actor: string | null; actor_label: string | null;
    source: string | null; plan: { kind?: string; attr?: string; to?: string } | null };
  const op = (data as Op[]).find(o => o.plan?.kind === 'retype' && o.plan.attr === attrId && o.plan.to === to);
  if (!op) return null;
  let by = op.actor_label ?? 'unknown';
  if (op.actor) {
    const { data: me } = await supabase.auth.getUser();
    if (me.user?.id === op.actor) by = 'you';
    else {
      const { data: prof } = await supabase.from('profiles').select('display_name, email').eq('id', op.actor).maybeSingle();
      by = (prof as { display_name?: string | null; email?: string | null } | null)?.display_name
        || (prof as { email?: string | null } | null)?.email || 'another user';
    }
  }
  return { at: op.created_at, by, source: op.source, opId: op.id };
}

/** Pregled svih koraka redom; planira se samo do prvog neizvedenog. */
export async function previewAttrSteps(areaId: string, steps: AttrStep[]): Promise<AttrStepStatus[]> {
  const out: AttrStepStatus[] = [];
  let stopped = false;
  for (const step of steps) {
    if (stopped) { out.push({ step, status: 'waiting' }); continue; }
    if (step.kind === 'merge') { out.push({ step, status: 'unsupported' }); stopped = true; continue; }
    const snapshot = await loadRetypeSnapshot(areaId, step);
    const plan = planRetype(toRetypeInput(step), snapshot);
    if (plan.state === 'done' && plan.attr) {
      out.push({ step, status: 'done', record: await findRecord(areaId, plan.attr.id, step.to) });
      continue;
    }
    out.push({ step, status: plan.rpc ? 'next' : 'blocked', plan, snapshot });
    stopped = true;
  }
  return out;
}

// ── Ponovno mjerenje ─────────────────────────────────────────

async function verify(
  areaId: string, step: Extract<AttrStep, { kind: 'retype' }>, plan: RetypePlan,
  want: 'after' | 'before', before: RetypeSnapshot,
): Promise<Verification> {
  const t0 = performance.now();
  const snap = await loadRetypeSnapshot(areaId, step);
  const examples: string[] = [];
  const fresh = new Map(snap.values.map(v => [v.id, v]));
  const type = want === 'after' ? step.to : plan.from;
  let rowDiffs = 0;
  let rowsChecked = 0;
  if (want === 'after') {
    for (const [id, exp] of Object.entries(plan.predicted)) {
      rowsChecked++;
      const v = fresh.get(id);
      const okRow = !!v && (type === 'number'
        ? v.value_text == null && v.value_number === exp
        : v.value_number == null && v.value_text === exp);
      if (!okRow) { rowDiffs++; if (examples.length < 5) examples.push(`${id.slice(0, 8)}: ${v ? (v.value_text ?? v.value_number) : '(gone)'} instead of ${exp}`); }
    }
  } else {
    for (const b of before.values) {
      if (b.value_text == null && b.value_number == null) continue;
      rowsChecked++;
      const v = fresh.get(b.id);
      if (!v || v.value_text !== b.value_text || v.value_number !== b.value_number) {
        rowDiffs++;
        if (examples.length < 5) examples.push(`${b.id.slice(0, 8)}: ${v ? (v.value_text ?? v.value_number) : '(gone)'} instead of ${b.value_text ?? b.value_number}`);
      }
    }
  }

  let configDiffs = 0;
  const attrNow = snap.attributes.find(a => a.id === plan.attr?.id);
  for (const c of plan.config) {
    const exp = want === 'after' ? c.after : c.before;
    const got = c.kind === 'attribute_definition'
      ? (attrNow ? { data_type: attrNow.data_type, default_value: attrNow.default_value } : null)
      : c.kind === 'attribute_rules' ? attrNow?.validation_rules ?? null
      : c.kind === 'area_settings' ? snap.settings
      : (() => {
        const p = snap.presets.find(x => x.id === c.target_id);
        return p ? { default_attributes: p.default_attributes ?? null, filter_state: p.filter_state ?? null } : null;
      })();
    if (!same(got, exp)) { configDiffs++; if (examples.length < 5) examples.push(`${c.kind} ${c.target_id.slice(0, 8)}`); }
  }
  return { rowDiffs, configDiffs, rowsChecked, configChecked: plan.config.length, examples,
    ms: Math.round(performance.now() - t0) };
}

const announce = () => window.dispatchEvent(new CustomEvent('areas-changed'));

export interface AttrApplyResult { opId: string; ms: number; check: Verification }

export async function applyAttrStep(
  areaId: string, s: PlannedStep, source: string,
): Promise<AttrApplyResult> {
  const step = s.step as Extract<AttrStep, { kind: 'retype' }>;
  const rpc = s.plan.rpc;
  if (!rpc) throw new Error('Restructure: the preview has errors — nothing is applied.');
  const t0 = performance.now();
  // ⚠ Bez withRetry: primjena nije idempotentna — drugi pokušaj nakon prekinute veze
  //   naišao bi na već promijenjen tip i (ispravno) pao.
  const { data, error } = await supabase.rpc('rpc_restructure_retype', { ...rpc, p_source: source });
  if (error) throw toError(error);
  const ms = Math.round(performance.now() - t0);
  announce();
  return { opId: String(data), ms, check: await verify(areaId, step, s.plan, 'after', s.snapshot) };
}

export interface AttrUndoResult { restored: number; ms: number; check: Verification }

export async function undoAttrStep(
  areaId: string, s: PlannedStep, opId: string,
): Promise<AttrUndoResult> {
  const t0 = performance.now();
  const { data, error } = await supabase.rpc('rpc_restructure_undo', { p_op_id: opId });
  if (error) throw toError(error);
  const ms = Math.round(performance.now() - t0);
  announce();
  return { restored: Number(data), ms,
    check: await verify(areaId, s.step as Extract<AttrStep, { kind: 'retype' }>, s.plan, 'before', s.snapshot) };
}
