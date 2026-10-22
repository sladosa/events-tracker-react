/**
 * restructure/apply.ts — I/O sloj preuređivanja (F1, PREUREDJIVANJE_SPEC §14).
 *
 * snimka Aree → planer (`plan.ts`, čist) → `rpc_restructure_apply` (sql/058)
 * → PONOVNO MJERENJE nad svježom snimkom → `areas-changed`. Povrat isto.
 *
 * ⚠ SNIMKA MORA BITI CIJELA. Planer šalje bazi OČEKIVANE brojeve, a baza
 *   odbija svako razilaženje — pa odrezana snimka (PostgREST `max-rows` 1000,
 *   bez greške) ne bi dala krivu primjenu nego odbijenu, uz poruku „baza se
 *   promijenila od pregleda", koja bi lagala. Zato svaki upit ide kroz
 *   `fetchAllPaged` s `.order('id')` (paginacija bez reda je tiho kriva, S108),
 *   i svaka greška čitanja BACA — palo čitanje nije „nema ničega" (S121).
 *
 * ⚠ Snimka čita vrijednosti SAMO atributa koje koraci trebaju (uvjeti, „postavi",
 *   njihovi `depends_on` roditelji i djeca, razine `groupings`), PARALELNO po
 *   atributu. Izmjereno S179 na kopiji PROD-a: svi tekstualni atributi redom =
 *   14 s za pregled, i još jednom toliko za ponovno mjerenje.
 *
 * ⚠ PONOVNO MJERENJE = „baza je ono što je pregled predvidio" (vrijednosti po
 *   eventu + svaki config zapis), a poslije povrata „baza je ono što je bilo".
 *   „Isti koraci opet ne mijenjaju ništa" NIJE dokaz: izmjereno S179 da niz
 *   koraka ne mora biti idempotentan (99 postavi zadano, 100 ga na 3 retka
 *   obriše ⇒ ponovno izvođenje opet nađe 6 promjena nad ispravnom bazom).
 *
 * ⚠ Shortcuti: RLS na `activity_presets` je po korisniku, pa snimka vidi samo
 *   POZIVATELJEVE shortcute u Arei. Tuđi (grantee) shortcut s istom vrijednošću
 *   ostaje sa starom — kaže se u upozorenju kad Area ima dijeljenog korisnika.
 */
import { supabase } from '@/lib/supabaseClient';
import { fetchAllPaged, fetchAllPagedIn } from '@/lib/supabasePaging';
import { toError, withRetryQuery } from '@/lib/retry';
import {
  planRestructure,
  same,
  type AreaSnapshot,
  type ConfigWrite,
  type RestructurePlan,
  type RestructureStep,
  type SnapshotAttribute,
  type SnapshotEvent,
} from './plan';

const must = <T>(r: { data: T[]; error: unknown }, what: string): T[] => {
  if (r.error) throw new Error(`Preuređivanje: čitanje „${what}" nije uspjelo — ${toError(r.error).message}`);
  return r.data;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Slugovi čije vrijednosti planer treba (v. zaglavlje). */
export function neededSlugs(
  steps: RestructureStep[],
  attrs: Array<Pick<SnapshotAttribute, 'slug' | 'validation_rules'>>,
  settings: Record<string, unknown> | null,
): Set<string> {
  const need = new Set<string>();
  for (const st of steps) for (const s of [...Object.keys(st.when ?? {}), ...Object.keys(st.set ?? {})]) need.add(s);
  const named = new Set(need);
  for (const a of attrs) {
    const dep = isObj(a.validation_rules) && isObj(a.validation_rules.depends_on) ? a.validation_rules.depends_on : null;
    const p = dep && typeof dep.attribute_slug === 'string' ? dep.attribute_slug : null;
    if (!p) continue;
    if (named.has(a.slug)) need.add(p);       // par (roditelj, dijete) za izbornik
    if (named.has(p)) need.add(a.slug);       // O3: mijenja se roditelj, dijete ostaje
  }
  const groupings = isObj(settings?.groupings) ? settings!.groupings : {};
  for (const g of Object.values(groupings)) {
    if (isObj(g) && Array.isArray(g.levels)) for (const l of g.levels) if (typeof l === 'string') need.add(l);
  }
  return need;
}

/** Snimka Aree za planer. Baca na svakoj grešci čitanja. */
export async function loadAreaSnapshot(
  areaId: string,
  steps: RestructureStep[],
): Promise<AreaSnapshot & { areaName: string }> {
  const { data: area, error: aErr } = await withRetryQuery(() =>
    supabase.from('areas').select('id, name, settings').eq('id', areaId).maybeSingle());
  if (aErr) throw toError(aErr);
  if (!area) throw new Error('Preuređivanje: Area nije pronađena (ili nemaš pravo čitanja).');
  const settings = (area.settings ?? null) as Record<string, unknown> | null;

  const cats = must(await fetchAllPaged<AreaSnapshot['categories'][number]>((f, t) =>
    supabase.from('categories').select('id, name, parent_category_id, settings')
      .eq('area_id', areaId).order('id').range(f, t)), 'categories');
  const catIds = cats.map(c => c.id);
  const noCats = catIds.length ? catIds : ['00000000-0000-0000-0000-000000000000'];

  const attrs = must(await fetchAllPagedIn<SnapshotAttribute>(noCats, (chunk, f, t) =>
    supabase.from('attribute_definitions')
      .select('id, category_id, slug, name, data_type, default_value, validation_rules')
      .in('category_id', chunk).order('id').range(f, t)), 'attribute_definitions');
  const need = neededSlugs(steps, attrs, settings);
  const text = attrs.filter(a => a.data_type === 'text' && need.has(a.slug));

  type EvRow = { id: string; category_id: string; event_date: string; comment: string | null };
  type EaRow = { event_id: string; attribute_definition_id: string; value_text: string | null };
  const [evRes, eaRes, presetRes, anchorRes] = await Promise.all([
    fetchAllPagedIn<EvRow>(noCats, (chunk, f, t) =>
      supabase.from('events').select('id, category_id, event_date, comment')
        .in('category_id', chunk).order('id').range(f, t)),
    // ⚠ Po atributu, PARALELNO: tisuće ID-eva eventa ne stanu u URL, a stranice
    //   jednog upita idu jedna za drugom.
    Promise.all(text.map(a => fetchAllPaged<EaRow>((f, t) =>
      supabase.from('event_attributes').select('id, event_id, attribute_definition_id, value_text')
        .eq('attribute_definition_id', a.id).not('value_text', 'is', null)
        .order('id').range(f, t)))),
    fetchAllPaged<AreaSnapshot['presets'][number]>((f, t) =>
      supabase.from('activity_presets')
        .select('id, name, area_id, category_id, default_attributes, filter_state')
        .or(`area_id.eq.${areaId},category_id.in.(${noCats.join(',')})`)
        .order('id').range(f, t)),
    fetchAllPaged<AreaSnapshot['anchors'][number]>((f, t) =>
      supabase.from('balance_anchors').select('id, group_slug, group_value')
        .eq('area_id', areaId).order('id').range(f, t)),
  ]);
  const evs = must(evRes, 'events');
  const ea = eaRes.flatMap(r => must(r, 'event_attributes'));

  const slugOf = new Map(text.map(a => [a.id, a.slug]));
  const vals = new Map<string, Record<string, string>>(evs.map(e => [e.id, {}]));
  for (const r of ea) {
    const v = vals.get(r.event_id);
    const slug = slugOf.get(r.attribute_definition_id);
    if (v && slug && r.value_text != null) v[slug] = r.value_text;
  }
  const events: SnapshotEvent[] = evs.map(e => ({ ...e, values: vals.get(e.id)! }));

  return {
    areaId, areaName: area.name, settings,
    categories: cats, attributes: attrs, events,
    presets: must(presetRes, 'activity_presets'), anchors: must(anchorRes, 'balance_anchors'),
  };
}

/** Iznosi (brojčani atributi) za primjere u pregledu — samo za prikaz. */
export interface ExampleAmount { attr: string; value: number }

async function loadExampleAmounts(snap: AreaSnapshot, plan: RestructurePlan): Promise<Record<string, ExampleAmount[]>> {
  const ids = [...new Set(plan.steps.flatMap(s => s.examples.map(e => e.id)))];
  const num = new Map(snap.attributes.filter(a => a.data_type === 'number').map(a => [a.id, a.name]));
  if (!ids.length || !num.size) return {};
  // Prikaz, ne odluka — palo čitanje ostavi primjere bez iznosa, ne ruši pregled.
  const { data } = await supabase.from('event_attributes')
    .select('event_id, attribute_definition_id, value_number')
    .in('event_id', ids).in('attribute_definition_id', [...num.keys()]).not('value_number', 'is', null);
  const out: Record<string, ExampleAmount[]> = {};
  for (const r of (data ?? []) as Array<{ event_id: string; attribute_definition_id: string; value_number: number }>) {
    (out[r.event_id] ??= []).push({ attr: num.get(r.attribute_definition_id)!, value: r.value_number });
  }
  return out;
}

export interface RestructurePreview {
  areaId: string;
  areaName: string;
  steps: RestructureStep[];
  plan: RestructurePlan;
  /** Stanje PRIJE (vrijednosti iz „postavi" po eventu) — za provjeru povrata. */
  before: Record<string, Record<string, string>>;
  amounts: Record<string, ExampleAmount[]>;
  /** Broj eventa u Arei (kontekst za brojke). */
  eventCount: number;
  ms: number;
}

/** Snimka + planer. Ne piše ništa. */
export async function previewRestructure(areaId: string, steps: RestructureStep[]): Promise<RestructurePreview> {
  const t0 = performance.now();
  const snap = await loadAreaSnapshot(areaId, steps);
  const plan = planRestructure(steps, snap);
  // Samo kad Area stvarno ima dijeljenog korisnika — upozorenje koje pali
  // uvijek nauči se otklikati. Palo čitanje = ne znam ⇒ upozori.
  const { count, error: shErr } = await supabase.from('data_shares')
    .select('id', { count: 'exact', head: true })
    .eq('share_type', 'area').eq('target_id', areaId);
  if (shErr || (count ?? 0) > 0) {
    plan.warnings.push('Shortcuti: pregled vidi samo TVOJE shortcute u ovoj Arei — shortcuti dijeljenog korisnika ostaju sa starom vrijednošću.');
  }
  const before: RestructurePreview['before'] = {};
  const valsById = new Map(snap.events.map(e => [e.id, e.values]));
  for (const id of Object.keys(plan.predicted.values)) {
    const v = valsById.get(id)!;
    before[id] = Object.fromEntries(plan.predicted.slugs.filter(s => v[s]).map(s => [s, v[s]]));
  }
  const amounts = await loadExampleAmounts(snap, plan);
  return {
    areaId, areaName: snap.areaName, steps, plan, before, amounts,
    eventCount: snap.events.length, ms: Math.round(performance.now() - t0),
  };
}

/** Ponovno mjerenje: svježa baza protiv očekivanog stanja. */
export interface Verification {
  /** Eventa s barem jednom vrijednošću drukčijom od očekivane (ili nestalih). */
  rowDiffs: number;
  /** Config zapisa (izbornik, postavke, shortcut, sidro) drukčijih od očekivanog. */
  configDiffs: number;
  rowsChecked: number;
  configChecked: number;
  /** Do 5 primjera za poruku. */
  examples: string[];
  ms: number;
}

function freshConfig(snap: AreaSnapshot, c: ConfigWrite): unknown {
  switch (c.kind) {
    case 'attribute_rules': return snap.attributes.find(a => a.id === c.target_id)?.validation_rules ?? null;
    case 'area_settings': return snap.settings;
    case 'preset': {
      const p = snap.presets.find(x => x.id === c.target_id);
      return p ? { default_attributes: p.default_attributes ?? null, filter_state: p.filter_state ?? null } : null;
    }
    case 'anchor': {
      const b = snap.anchors.find(x => x.id === c.target_id);
      return b ? { group_value: b.group_value } : null;
    }
  }
}

async function verify(preview: RestructurePreview, want: 'after' | 'before'): Promise<Verification> {
  const t0 = performance.now();
  const snap = await loadAreaSnapshot(preview.areaId, preview.steps);
  const { slugs, values: predicted } = preview.plan.predicted;
  const expected = want === 'after' ? predicted : preview.before;
  const fresh = new Map(snap.events.map(e => [e.id, e.values]));
  const examples: string[] = [];
  let rowDiffs = 0;
  for (const [id, exp] of Object.entries(expected)) {
    const got = fresh.get(id);
    const bad = !got ? ['(event više ne postoji)']
      : slugs.filter(s => (got[s] ?? '') !== (exp[s] ?? ''))
        .map(s => `${s}: „${got[s] ?? ''}" umjesto „${exp[s] ?? ''}"`);
    if (bad.length) { rowDiffs++; if (examples.length < 5) examples.push(`${id.slice(0, 8)} ${bad.join(', ')}`); }
  }
  let configDiffs = 0;
  for (const c of preview.plan.config) {
    if (!same(freshConfig(snap, c), want === 'after' ? c.after : c.before)) {
      configDiffs++;
      if (examples.length < 5) examples.push(`${c.kind} ${c.target_id.slice(0, 8)}`);
    }
  }
  return {
    rowDiffs, configDiffs, examples,
    rowsChecked: Object.keys(expected).length, configChecked: preview.plan.config.length,
    ms: Math.round(performance.now() - t0),
  };
}

const announce = () => window.dispatchEvent(new CustomEvent('areas-changed'));

export interface ApplyResult {
  opId: string;
  /** Trajanje samog RPC-a (jedna transakcija). */
  ms: number;
  check: Verification;
}

export async function applyRestructure(preview: RestructurePreview, source: string): Promise<ApplyResult> {
  const rpc = preview.plan.rpc;
  if (!rpc) throw new Error('Preuređivanje: pregled ima greške — ništa se ne primjenjuje.');
  const t0 = performance.now();
  // ⚠ Bez withRetry: apply nije idempotentan — drugi pokušaj nakon prekinute
  //   veze naišao bi na već primijenjeno i (ispravno) pao na brojevima.
  const { data, error } = await supabase.rpc('rpc_restructure_apply', {
    p_area_id: preview.areaId, p_steps: rpc.p_steps, p_config: rpc.p_config, p_source: source,
  });
  if (error) throw toError(error);
  const ms = Math.round(performance.now() - t0);
  announce();
  return { opId: String(data), ms, check: await verify(preview, 'after') };
}

export interface UndoResult {
  restored: number;
  ms: number;
  check: Verification;
}

export async function undoRestructure(preview: RestructurePreview, opId: string): Promise<UndoResult> {
  const t0 = performance.now();
  const { data, error } = await supabase.rpc('rpc_restructure_undo', { p_op_id: opId });
  if (error) throw toError(error);
  const ms = Math.round(performance.now() - t0);
  announce();
  return { restored: Number(data), ms, check: await verify(preview, 'before') };
}
