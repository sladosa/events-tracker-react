/**
 * restructure/plan.ts — planer preuređivanja (F1, docs/PREUREDJIVANJE_SPEC.md §12).
 *
 * ČISTA FUNKCIJA, bez I/O. Ulaz: koraci „kad … postavi …" + snimka Aree.
 * Izlaz: što će se dogoditi (po koraku broj pogođenih i promjena, izbornik,
 * postavke, shortcuti, sidra), upozorenja, blokirajuće greške — i točan
 * paket za `rpc_restructure_apply` (sql/058).
 *
 * ZAŠTO PLANER U TS-u, A NE U BAZI (§9)
 *   Znanje o OBLIKU configa (gdje u `dashboard`, `due`, `groupings`, `automations`
 *   stoji vrijednost opcije) već živi u TypeScriptu; u plpgsql-u bi bila druga
 *   kopija. Baza dobiva samo pravila koraka i OČEKIVANE brojeve, pa razilaženje
 *   znači „baza se promijenila od pregleda" ⇒ odbij.
 *
 * ⚠ PRAVILA SE MIJENJAJU OD SIROVOG OBLIKA, nikad od `parseValidationRules` (S152).
 *   Ključevi koje planer ne zna (`hidden_in_add`, `max`, …) prežive netaknuti.
 *
 * ⚠ CONFIG SE PREPISUJE SAMO ZA ČISTO PREIMENOVANJE. Vrijednost A je „čisto
 *   preimenovana" u B kad SVI retci koji su prije nosili A poslije nose B.
 *   Raspadne li se A na više vrijednosti, ili ostane djelomično, planer NE POGAĐA
 *   nego upozori (§12.3) — referenca na A tada i dalje ima retke, ili ih nema
 *   nijedan, i to mora vidjeti čovjek.
 */

import { readVisibleWhen } from '../visibleWhen';

// ─────────────────────────────────────────────
// Ulaz
// ─────────────────────────────────────────────

/** Vrijednost u koraku: tekst, ili `null` = „(prazno)". */
export type StepValue = string | null;

export interface RestructureStep {
  /** Broj koraka iz sheeta — samo za poruke. */
  n: number;
  /** Ime kategorije (leaf) čiji eventi se gledaju. */
  category: string;
  /** slug → vrijednost; svi uvjeti AND, točna jednakost. Izostanak ključa = ne gleda se. */
  when: Record<string, StepValue>;
  /** slug → nova vrijednost; `null` = obriši. Izostanak ključa = ne mijenja se. */
  set: Record<string, StepValue>;
  /** Pojedinačni eventi (prijedlozi iz alata). */
  eventIds?: string[];
  note?: string;
}

export interface SnapshotAttribute {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  data_type: string;
  default_value: string | null;
  validation_rules: unknown;
}

export interface SnapshotEvent {
  id: string;
  category_id: string;
  /** Tekstualne vrijednosti po slugu (samo popunjene). */
  values: Record<string, string>;
  event_date?: string;
  comment?: string | null;
}

export interface SnapshotPreset {
  id: string;
  name: string;
  area_id: string | null;
  category_id: string | null;
  default_attributes: Record<string, unknown> | null;
  filter_state: Record<string, unknown> | null;
}

export interface SnapshotAnchor {
  id: string;
  group_slug: string;
  group_value: string;
}

export interface AreaSnapshot {
  areaId: string;
  settings: Record<string, unknown> | null;
  categories: Array<{ id: string; name: string; parent_category_id: string | null; settings?: unknown }>;
  attributes: SnapshotAttribute[];
  events: SnapshotEvent[];
  presets: SnapshotPreset[];
  anchors: SnapshotAnchor[];
}

// ─────────────────────────────────────────────
// Izlaz
// ─────────────────────────────────────────────

export interface StepResult {
  n: number;
  matched: number;
  changed: number;
  examples: Array<{ id: string; event_date?: string; comment?: string | null }>;
}

export interface ConfigWrite {
  kind: 'attribute_rules' | 'area_settings' | 'preset' | 'anchor';
  target_id: string;
  before: unknown;
  after: unknown;
}

export interface RpcStep {
  n: number;
  category_id: string;
  when: Array<{ attr: string; value: StepValue }>;
  event_ids: string[] | null;
  set: Array<{ attr: string; value: StepValue }>;
  expected_matched: number;
  expected_changed: number;
}

export interface RestructurePlan {
  steps: StepResult[];
  /** Čitljiv popis svega što se mijenja izvan redaka. */
  changes: string[];
  warnings: string[];
  /** Blokirajuće — dok ih ima, `rpc` je null. */
  errors: string[];
  config: ConfigWrite[];
  rpc: { p_steps: RpcStep[]; p_config: ConfigWrite[] } | null;
  /**
   * PREDVIĐENO stanje poslije primjene: event id → vrijednosti atributa iz „postavi"
   * (samo eventi dirnutih kategorija; izostanak sluga = prazno). Ponovno mjerenje
   * uspoređuje bazu s ovim — „isti koraci opet ne mijenjaju ništa" nije dokaz,
   * jer niz koraka ne mora biti idempotentan (99 postavi, 100 obriše).
   */
  predicted: { slugs: string[]; values: Record<string, Record<string, string>> };
}

// ─────────────────────────────────────────────
// Pomoćno
// ─────────────────────────────────────────────

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function stable(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v as Obj).sort()
    .map(k => JSON.stringify(k) + ':' + stable((v as Obj)[k])).join(',') + '}';
}
/** Jednakost JSON-a neovisna o redoslijedu ključeva (JSONB ih presloži, S153). */
export const same = (a: unknown, b: unknown) => stable(a) === stable(b);

const show = (v: StepValue | undefined) => (v == null ? '(prazno)' : `„${v}"`);

/** Preimenuj ključ objekta NA ISTOM MJESTU (redoslijed ključeva = redoslijed u exportu). */
function renameKey<T>(o: Record<string, T>, from: string, to: string, merge?: (a: T, b: T) => T): Record<string, T> {
  if (!(from in o) || from === to) return o;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === from) {
      if (to in o) continue;                 // spaja se u postojeći ključ, niže
      out[to] = v;
    } else if (k === to && merge) {
      out[k] = merge(v, o[from]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// Prijelazi vrijednosti (što se s čim dogodilo)
// ─────────────────────────────────────────────

/**
 * Za jedan atribut: čije je vrijednosti A dirao barem jedan korak, i kamo su
 * otišli SVI retci koji su prije nosili A.
 */
class Transitions {
  /** A → (B → broj redaka koji su prije bili A, poslije B); B = '' znači prazno. */
  private flows = new Map<string, Map<string, number>>();
  /** broj redaka s vrijednošću POSLIJE */
  readonly afterCount = new Map<string, number>();
  /** vrijednosti koje su bile izvor stvarne promjene */
  readonly sources = new Set<string>();
  /** vrijednosti koje su nastale stvarnom promjenom */
  readonly targets = new Set<string>();

  add(before: string | undefined, after: string | undefined) {
    if (after) this.afterCount.set(after, (this.afterCount.get(after) ?? 0) + 1);
    if (before) {
      const m = this.flows.get(before) ?? new Map<string, number>();
      m.set(after ?? '', (m.get(after ?? '') ?? 0) + 1);
      this.flows.set(before, m);
    }
    if (before !== after) {
      if (before) this.sources.add(before);
      if (after) this.targets.add(after);
    }
  }

  /** B ako je A ČISTO preimenovan u B (svi A-ovi su sada B, B ≠ A, B neprazno). */
  pure(a: string): string | null {
    const m = this.flows.get(a);
    if (!m || m.size !== 1) return null;
    const [b] = [...m.keys()];
    return b && b !== a ? b : null;
  }

  /** Izvor koji je nestao bez čistog preimenovanja (raspao se ili obrisan). */
  vanished(a: string): boolean {
    return this.sources.has(a) && !this.afterCount.get(a) && !this.pure(a);
  }
}

// ─────────────────────────────────────────────
// Planer
// ─────────────────────────────────────────────

export function planRestructure(steps: RestructureStep[], snap: AreaSnapshot): RestructurePlan {
  const errors: string[] = [];
  const warnings: string[] = [];
  const changes: string[] = [];
  const results: StepResult[] = [];
  const rpcSteps: RpcStep[] = [];

  const catByName = new Map<string, typeof snap.categories>();
  for (const c of snap.categories) catByName.set(c.name, [...(catByName.get(c.name) ?? []), c]);
  const attrsOf = (catId: string) => snap.attributes.filter(a => a.category_id === catId);
  const attrById = new Map(snap.attributes.map(a => [a.id, a]));

  // Radna kopija vrijednosti: event id → slug → vrijednost (poslije dosadašnjih koraka).
  const work = new Map<string, Record<string, string>>();
  const evById = new Map(snap.events.map(e => [e.id, e]));
  for (const e of snap.events) work.set(e.id, { ...e.values });

  const touchedCats = new Set<string>();

  // ── 1. Koraci, redom ──────────────────────────────────────────────────────
  for (const st of steps) {
    const at = `korak ${st.n}`;
    const cands = catByName.get(st.category) ?? [];
    if (cands.length !== 1) {
      errors.push(cands.length === 0
        ? `${at}: kategorija „${st.category}" ne postoji u Arei.`
        : `${at}: kategorija „${st.category}" nije jednoznačna (${cands.length}×).`);
      continue;
    }
    const cat = cands[0];
    const defs = new Map(attrsOf(cat.id).map(a => [a.slug, a]));
    let bad = false;

    const resolve = (slug: string, v: StepValue, role: string) => {
      const d = defs.get(slug);
      if (!d) { errors.push(`${at}: atribut „${slug}" (${role}) ne postoji u „${cat.name}".`); bad = true; return null; }
      if (d.data_type !== 'text') {
        errors.push(`${at}: „${slug}" je ${d.data_type} — F1 radi samo s tekstualnim atributima.`); bad = true; return null;
      }
      // Zamka S167: config citira vrijednost doslovno — razmak bi bio nova opcija.
      if (v != null && (v !== v.trim() || v === '')) {
        errors.push(`${at}: vrijednost ${show(v)} za „${slug}" ima vodeći/prateći razmak ili je prazna.`); bad = true;
      }
      return { attr: d.id, value: v };
    };

    const whenE = Object.entries(st.when ?? {});
    const setE = Object.entries(st.set ?? {});
    const when = whenE.map(([s, v]) => resolve(s, v, 'kad'));
    const set = setE.map(([s, v]) => resolve(s, v, 'postavi'));
    if (whenE.length === 0 && !st.eventIds?.length) {
      errors.push(`${at}: nema nijednog uvjeta (kad / event_id) — korak bi pogodio cijelu kategoriju.`);
      bad = true;
    }
    if (setE.length === 0) { errors.push(`${at}: nema što postaviti.`); bad = true; }
    const idSet = st.eventIds?.length ? new Set(st.eventIds) : null;
    if (idSet) {
      for (const id of idSet) {
        const e = evById.get(id);
        if (!e || e.category_id !== cat.id) { errors.push(`${at}: event ${id} nije u „${cat.name}".`); bad = true; }
      }
    }
    if (bad) continue;
    touchedCats.add(cat.id);

    let matched = 0;
    let changed = 0;
    const examples: StepResult['examples'] = [];
    for (const e of snap.events) {
      if (e.category_id !== cat.id || (idSet && !idSet.has(e.id))) continue;
      const vals = work.get(e.id)!;
      if (!whenE.every(([s, v]) => (v == null ? !vals[s] : vals[s] === v))) continue;
      matched++;
      let hit = false;
      for (const [s, v] of setE) {
        if (v == null) {
          if (vals[s]) { delete vals[s]; changed++; hit = true; }
        } else if (vals[s] !== v) {
          vals[s] = v; changed++; hit = true;
        }
      }
      if (hit && examples.length < 3) examples.push({ id: e.id, event_date: e.event_date, comment: e.comment });
    }
    if (matched === 0) warnings.push(`${at}: ne pogađa nijedan redak.`);
    else if (changed === 0) warnings.push(`${at}: pogađa ${matched} redaka, ali ništa ne mijenja (već su takvi).`);
    results.push({ n: st.n, matched, changed, examples });
    rpcSteps.push({
      n: st.n, category_id: cat.id,
      when: when as RpcStep['when'], set: set as RpcStep['set'],
      event_ids: idSet ? [...idSet] : null,
      expected_matched: matched, expected_changed: changed,
    });
  }

  // ── 2. Prijelazi po atributu (i po paru roditelj/dijete) ─────────────────
  const trans = new Map<string, Transitions>();          // slug → globalno
  // `${slug}` → parovi „roditelj\u0000dijete" prije/poslije, po retku. Sirovo, jer se ključ
  // liste za roditelja zna tek uz izbornik (vlastiti ključ ili `*`, §20).
  const pairRaw = new Map<string, Array<[string | undefined, string | undefined]>>();
  const tupleTrans = new Map<string, Transitions>();     // „l0|l1" → ključ „v0\u0000v1"
  const touchedSlugs = new Set<string>();
  for (const st of steps) for (const s of Object.keys(st.set ?? {})) touchedSlugs.add(s);

  const parentOf = new Map<string, string>();            // slug djeteta → slug roditelja
  for (const a of snap.attributes) {
    const dep = isObj(a.validation_rules) && isObj(a.validation_rules.depends_on)
      ? a.validation_rules.depends_on : null;
    if (dep && typeof dep.attribute_slug === 'string') parentOf.set(a.slug, dep.attribute_slug);
  }

  const groupLevels: string[][] = [];
  const groupings = isObj(snap.settings?.groupings) ? snap.settings!.groupings as Obj : {};
  for (const g of Object.values(groupings)) {
    if (isObj(g) && Array.isArray(g.levels) && g.levels.length === 2) groupLevels.push(g.levels as string[]);
  }

  const PAIR = '\u0000';
  for (const e of snap.events) {
    if (!touchedCats.has(e.category_id)) continue;
    const b = e.values;
    const a = work.get(e.id)!;
    const slugsHere = new Set([...Object.keys(b), ...Object.keys(a), ...touchedSlugs]);
    for (const s of slugsHere) {
      if (!trans.has(s)) trans.set(s, new Transitions());
      trans.get(s)!.add(b[s], a[s]);
      const p = parentOf.get(s);
      if (p) {
        if (!pairRaw.has(s)) pairRaw.set(s, []);
        pairRaw.get(s)!.push([b[s] ? (b[p] ?? '') + PAIR + b[s] : undefined,
                              a[s] ? (a[p] ?? '') + PAIR + a[s] : undefined]);
      }
    }
    for (const lv of groupLevels) {
      const key = lv.join('|');
      if (!tupleTrans.has(key)) tupleTrans.set(key, new Transitions());
      tupleTrans.get(key)!.add(b[lv[0]] ? (b[lv[0]] ?? '') + PAIR + (b[lv[1]] ?? '') : undefined,
                               a[lv[0]] ? (a[lv[0]] ?? '') + PAIR + (a[lv[1]] ?? '') : undefined);
    }
  }
  const changedSlugs = [...trans.entries()].filter(([, t]) => t.sources.size || t.targets.size).map(([s]) => s);
  const pureOf = (slug: string, v: string) => trans.get(slug)?.pure(v) ?? null;
  const vanishedOf = (slug: string, v: string) => trans.get(slug)?.vanished(v) ?? false;

  const config: ConfigWrite[] = [];

  // ── 3. Izbornik (validation_rules) ────────────────────────────────────────
  const ruleSlugs = new Set<string>(changedSlugs);
  for (const [child, p] of parentOf) if (changedSlugs.includes(p)) ruleSlugs.add(child);

  for (const a of snap.attributes) {
    if (!isObj(a.validation_rules)) continue;
    // S187: `visible_when` citira VRIJEDNOST atributa Y — i Y smije biti na pretku,
    //   pa atribut s pravilom ne mora biti na kategoriji koju koraci diraju.
    const vw = readVisibleWhen(a.validation_rules);
    const vwHit = !!vw && changedSlugs.includes(vw.attributeSlug);
    const ownRules = touchedCats.has(a.category_id) && ruleSlugs.has(a.slug);
    if (!ownRules && !vwHit) continue;
    const before = a.validation_rules;
    const after = clone(before) as Obj;
    const t = trans.get(a.slug);
    const lines: string[] = [];

    if (vw && vwHit) {
      const out: string[] = [];
      for (const v of vw.values) {
        const to = pureOf(vw.attributeSlug, v);
        if (to && to !== v) lines.push(`vidljivo uz ${vw.attributeSlug}: „${v}" → „${to}"`);
        else if (vanishedOf(vw.attributeSlug, v)) {
          warnings.push(`${a.slug}: vidljivo samo uz ${vw.attributeSlug} „${v}", a ta vrijednost više nema redaka.`);
        }
        const m = to ?? v;
        if (!out.includes(m)) out.push(m);
      }
      after.visible_when = { attribute_slug: vw.attributeSlug, values: out };
    }

    // Izbornik samog atributa — samo kad ga koraci diraju (inače je ovdje zbog `visible_when`).
    if (ownRules && isObj(after.depends_on)) {
      const dep = after.depends_on;
      const p = String(dep.attribute_slug);
      let om = (isObj(dep.options_map) ? dep.options_map : {}) as Record<string, string[]>;
      let dm = isObj(dep.default_map) ? dep.default_map as Record<string, string> : null;

      // (a) roditelj čisto preimenovan ⇒ ključ liste prati (spoj = unija, redom)
      for (const pv of Object.keys(om)) {
        const nk = pureOf(p, pv);
        if (!nk) continue;
        om = renameKey(om, pv, nk, (x, y) => [...x, ...y.filter(o => !x.includes(o))]);
        lines.push(`ključ „${pv}" → „${nk}"`);
        if (dm && pv in dm) dm = renameKey(dm, pv, nk, x => x);
      }
      for (const pv of Object.keys(dm ?? {})) {
        if (!(pv in om) && vanishedOf(p, pv)) warnings.push(`${a.slug}.default_map: ključ „${pv}" više nema redaka.`);
      }

      // (b) parovi (roditelj, dijete) koje su koraci pomaknuli — i kad se mijenjao
      //     samo roditelj (O3: Podtip ostaje, Tip se mijenja).
      //     ⚠ §20 (S185): roditelj BEZ vlastitog ključa nudi listu pod `*`
      //     (`getOptionsForDependency`) — kad ona nije prazna (Namjena; Podtip ima
      //     `*: []`). Par se zato broji pod ključem liste koju forma stvarno nudi,
      //     inače bi cilj stvorio ključ samo sa sobom i sakrio cijelu listu.
      const star0 = Array.isArray(om['*']) ? [...om['*']] : [];
      const star = star0.length > 0;
      const listKey = (pv: string) => (pv in om || !star ? pv : '*');
      const raw = pairRaw.get(a.slug);
      const lt = new Transitions();
      const starParents = new Map<string, Set<string>>();   // nova vrijednost → roditelji pod `*`
      for (const [b, aft] of raw ?? []) {
        let kb: string | undefined;
        if (b) { const [pb, vb] = b.split(PAIR); kb = listKey(pureOf(p, pb) ?? pb) + PAIR + vb; }
        let ka: string | undefined;
        if (aft) {
          const [pa, va] = aft.split(PAIR);
          ka = listKey(pa) + PAIR + va;
          if (listKey(pa) === '*' && pa !== '*') {
            if (!starParents.has(va)) starParents.set(va, new Set());
            starParents.get(va)!.add(pa);
          }
        }
        lt.add(kb, ka);
      }
      const renamed = new Set<string>();                     // vrijednosti koje je (b) preimenovao pod `*`
      if (lt.sources.size) {
        for (const src of lt.sources) {
          const [k, vb] = src.split(PAIR);
          if ((lt.afterCount.get(src) ?? 0) > 0) continue;
          const list = om[k];
          if (!list?.includes(vb)) continue;
          const to = lt.pure(src);
          const [pa, va] = to ? to.split(PAIR) : [null, null];
          if (to && pa === k && !list.includes(va!)) {
            om[k] = list.map(o => (o === vb ? va! : o));
            lines.push(`„${k}": „${vb}" → „${va}"`);
            if (k === '*') renamed.add(vb);
          } else {
            om[k] = list.filter(o => o !== vb);
            lines.push(`„${k}": makni „${vb}"`);
          }
        }
        for (const tg of lt.targets) {
          const [pk, va] = tg.split(PAIR);
          if (!lt.afterCount.get(tg)) continue;
          if (pk === '*' && star) {
            if (om['*'].includes(va)) continue;               // `*` je već nudi — bez ključa
            // Nova vrijednost samo za neke roditelje: vlastiti ključ = lista pod `*` + nova.
            // U `*` bi je ponudila i SVIM ostalim roditeljima.
            for (const pv of starParents.get(va) ?? []) {
              const list = om[pv] ?? [...om['*']];
              if (list.includes(va)) continue;
              om[pv] = [...list, va];
              lines.push(`„${pv}": lista pod * + „${va}"`);
            }
            continue;
          }
          const list = om[pk] ?? [];
          if (list.includes(va)) continue;
          om[pk] = [...list, va];
          lines.push(`„${pk}": dodaj „${va}"`);
        }
        // default_map vrijednosti: čisto preimenovanje para unutar istog ključa liste
        if (dm) {
          for (const [k, v] of Object.entries(dm)) {
            const src = (k === '*' ? '*' : listKey(k)) + PAIR + v;
            if (!lt.sources.has(src) || (lt.afterCount.get(src) ?? 0) > 0) continue;
            const to = lt.pure(src);
            if (to && to.split(PAIR)[0] === src.split(PAIR)[0]) {
              dm = { ...dm, [k]: to.split(PAIR)[1] };
              lines.push(`default „${k}": „${v}" → „${to.split(PAIR)[1]}"`);
            } else {
              warnings.push(`${a.slug}: zadana vrijednost za „${k}" je „${v}", a ona više nema redaka.`);
            }
          }
        }
      }

      // (c) §20: lista pod `*` je ZAJEDNIČKA (Namjena) — vlastiti ključevi koji je ponavljaju
      //     (auti, radi default_map) nemaju retke te vrijednosti, pa ih (b) ne vidi. Preimenovanje
      //     koje je (b) izveo pod `*` i koje je ČISTO za cijeli atribut prati i u njima.
      //     Samo uz nepraznu `*` listu: kod Podtipa (`*: []`) bi preimenovanje u jednom Tipu
      //     preimenovalo istu riječ i u drugim Tipovima.
      for (const vb of renamed) {
        const va = pureOf(a.slug, vb);
        if (!va) continue;
        for (const k of Object.keys(om)) {
          if (k === '*' || !om[k].includes(vb)) continue;
          om[k] = om[k].includes(va) ? om[k].filter(o => o !== vb) : om[k].map(o => (o === vb ? va : o));
          lines.push(`„${k}": „${vb}" → „${va}" (kao pod *)`);
        }
        for (const [k, v] of Object.entries(dm ?? {})) {
          if (v !== vb) continue;
          dm = { ...dm, [k]: va };
          lines.push(`default „${k}": „${vb}" → „${va}" (kao pod *)`);
        }
      }
      dep.options_map = om;
      if (dm) dep.default_map = dm;
    } else if (ownRules && Array.isArray(after.suggest) && t) {
      let list = after.suggest as string[];
      for (const src of t.sources) {
        if (t.afterCount.get(src) || !list.includes(src)) continue;
        const to = t.pure(src);
        if (to && !list.includes(to)) {
          list = list.map(o => (o === src ? to : o));
          lines.push(`„${src}" → „${to}"`);
        } else {
          list = list.filter(o => o !== src);
          lines.push(`makni „${src}"`);
        }
      }
      for (const tg of t.targets) {
        if (t.afterCount.get(tg) && !list.includes(tg)) { list = [...list, tg]; lines.push(`dodaj „${tg}"`); }
      }
      after.suggest = list;
    }

    if (ownRules && a.default_value) {
      const to = pureOf(a.slug, a.default_value);
      if (to || vanishedOf(a.slug, a.default_value)) {
        warnings.push(`${a.slug}: default_value „${a.default_value}" ${to ? `postaje „${to}"` : 'više nema redaka'} — promijeni Structure uvozom.`);
      }
    }

    if (!same(before, after)) {
      config.push({ kind: 'attribute_rules', target_id: a.id, before, after });
      changes.push(`Izbornik ${a.slug}: ${lines.join(' · ') || 'promijenjen'}`);
    }
  }

  // ── 4. areas.settings ─────────────────────────────────────────────────────
  if (snap.settings) {
    const sb = snap.settings;
    const s = clone(sb) as Obj;
    const log = (m: string) => changes.push(`Postavke: ${m}`);

    const mapVal = (slug: string, v: string, where: string): string => {
      const to = pureOf(slug, v);
      if (to) { log(`${where}: ${slug} „${v}" → „${to}"`); return to; }
      if (vanishedOf(slug, v)) warnings.push(`${where}: pokazuje na ${slug} „${v}", a ona više nema redaka.`);
      return v;
    };
    const mapFilter = (f: unknown, where: string) => {
      if (!isObj(f) || typeof f.slug !== 'string' || !Array.isArray(f.values)) return;
      const out: string[] = [];
      for (const v of f.values as string[]) {
        const m = mapVal(f.slug, v, where);
        if (!out.includes(m)) out.push(m);
      }
      f.values = out;
    };
    const mapFilters = (fs: unknown, where: string) => {
      if (Array.isArray(fs)) fs.forEach(f => mapFilter(f, where));
    };
    const mapKeys = <T>(o: unknown, slug: string, where: string): Record<string, T> | unknown => {
      if (!isObj(o)) return o;
      let out = o as Record<string, T>;
      for (const k of Object.keys(out)) {
        const to = mapVal(slug, k, where);
        if (to !== k) {
          if (to in out) errors.push(`${where}: ključ „${to}" već postoji — spoj bi ga prepisao.`);
          else out = renameKey(out, k, to);
        }
      }
      return out;
    };

    const widgets = isObj(s.dashboard) && Array.isArray(s.dashboard.widgets) ? s.dashboard.widgets as Obj[] : [];
    widgets.forEach((w, i) => {
      const where = `dashboard „${w.title ?? i}"`;
      mapFilters(w.filters, where);
      if (isObj(w.split)) mapFilters(w.split.filters, where + ' · split');
      if (w.type === 'breakdown') {
        mapFilter(w.income, where + ' · income');
        mapFilters(w.outside, where + ' · outside');
        if (Array.isArray(w.adjustments)) for (const adj of w.adjustments as Obj[]) {
          mapFilters(adj.add, where + ' · korekcija'); mapFilters(adj.subtract, where + ' · korekcija');
        }
        const l0 = Array.isArray(w.levels) ? String(w.levels[0]) : null;
        if (l0 && Array.isArray(w.unclassified)) {
          w.unclassified = [...new Set((w.unclassified as string[]).map(v => mapVal(l0, v, where + ' · nerazvrstano')))];
        }
      }
      if (isObj(w.due)) {
        const due = w.due;
        const dw = where + ' · due';
        if (typeof due.basket_by === 'string') due.baskets = mapKeys(due.baskets, due.basket_by, dw + '.baskets');
        if (typeof w.group_by === 'string' && isObj(due.baskets)) {
          for (const b of Object.values(due.baskets)) {
            if (isObj(b) && typeof b.account === 'string') b.account = mapVal(w.group_by, b.account, dw + '.account');
          }
        }
        if (typeof due.status_slug === 'string') {
          for (const k of ['pending', 'done'] as const) {
            if (typeof due[k] === 'string') due[k] = mapVal(due.status_slug, due[k] as string, `${dw}.${k}`);
          }
        }
        if (isObj(due.settle)) {
          for (const [k, v] of Object.entries(due.settle)) {
            if (typeof v === 'string') due.settle[k] = mapVal(k, v, dw + '.settle');
          }
        }
      }
    });

    // groupings: par (razina 0, razina 1); `*` = cijela razina 0
    for (const [gname, g] of Object.entries(groupings)) {
      const gs = (s.groupings as Obj)[gname];
      if (!isObj(g) || !isObj(gs) || !Array.isArray(gs.rows) || !Array.isArray(g.levels)) continue;
      const lv = g.levels as string[];
      const tt = tupleTrans.get(lv.join('|'));
      const seen = new Map<string, string>();
      const keep: Obj[] = [];
      for (const row of gs.rows as Obj[]) {
        if (!Array.isArray(row.values)) { keep.push(row); continue; }
        const [v0, v1] = row.values as string[];
        const where = `grupiranje „${gname}" · ${row.bucket}`;
        if (v1 === '*') {
          row.values = [mapVal(lv[0], v0, where), '*'];
        } else if (tt) {
          const key = v0 + PAIR + v1;
          const to = tt.pure(key);
          if (to) {
            row.values = to.split(PAIR);
            log(`${where}: „${v0} / ${v1}" → „${(row.values as string[]).join(' / ')}"`);
          } else if (tt.vanished(key)) {
            warnings.push(`${where}: par „${v0} / ${v1}" više nema redaka (raspao se) — premjesti ručno.`);
          }
        }
        const pk = (row.values as string[]).join(PAIR);
        const pair = (row.values as string[]).join(' / ');
        if (seen.get(pk) === String(row.bucket)) {
          // Spoj dviju vrijednosti u ISTOM bucketu (O5: Audible_Koka + _Sasa) — isti
          // redak dvaput, ne dvostruko brojanje. Drugi se miče.
          log(`grupiranje „${gname}": par „${pair}" sažet u jedan redak (${row.bucket})`);
          continue;
        }
        if (seen.has(pk)) {
          errors.push(`grupiranje „${gname}": par „${pair}" u dva bucketa (${seen.get(pk)} i ${row.bucket}) — zbrojio bi se dvaput.`);
        }
        seen.set(pk, String(row.bucket));
        keep.push(row);
      }
      gs.rows = keep;
    }

    // automations
    if (isObj(s.automations)) {
      const au = s.automations;
      if (Array.isArray(au.attribute_rules)) for (const r of au.attribute_rules as Obj[]) {
        if (typeof r.map_slug === 'string') r.date_map = mapKeys(r.date_map, r.map_slug, `automatika „${r.name ?? r.target_slug}"`);
      }
      if (isObj(au.rata)) {
        const r = au.rata;
        if (typeof r.date_map_slug === 'string') {
          r.date_map = mapKeys(r.date_map, r.date_map_slug, 'rata.date_map');
          if (r.remainder_map) r.remainder_map = mapKeys(r.remainder_map, r.date_map_slug, 'rata.remainder_map');
        }
        if (isObj(r.override_attrs)) {
          for (const [k, v] of Object.entries(r.override_attrs)) {
            if (typeof v === 'string') r.override_attrs[k] = mapVal(k, v, 'rata.override_attrs');
          }
        }
      }
    }

    // list_columns: `map` je rječnik kratica po VRIJEDNOSTI
    if (isObj(s.list_columns) && Array.isArray(s.list_columns.columns)) {
      for (const c of s.list_columns.columns as Obj[]) {
        if (c.role !== 'attr' || !Array.isArray(c.slugs) || !isObj(c.map)) continue;
        for (const slug of c.slugs as string[]) c.map = mapKeys(c.map, slug, `kolona „${c.label ?? slug}"`);
      }
    }

    // export_profiles: `filterState.attrFilterRaw` = „slug: =vrijednost" (§17)
    if (isObj(s.export_profiles)) {
      for (const [pname, p] of Object.entries(s.export_profiles)) {
        const fs = isObj(p) && isObj(p.filterState) ? p.filterState : null;
        const raw = fs && typeof fs.attrFilterRaw === 'string' ? fs.attrFilterRaw : null;
        if (!raw || raw === '_') continue;
        const m = raw.match(/^([^:]+):\s*(>=|<=|>|<|=|~)(.+)$/);
        if (!m) continue;
        const key = m[1].trim();
        const slug = attrById.get(key)?.slug ?? key;
        const where = `profil „${pname}"`;
        if (m[2] === '=' && changedSlugs.includes(slug)) {
          const to = mapVal(slug, m[3], where);
          if (to !== m[3]) fs!.attrFilterRaw = `${key}: =${to}`;
        } else if (m[2] === '~' && (slug === '*' || changedSlugs.includes(slug))) {
          warnings.push(`${where}: djelomičan filtar „${raw}" — provjeri pogađa li i dalje iste retke.`);
        }
      }
    }

    // comment_template: samo upozorenje (tekst, ne struktura)
    const tpls: Array<[string, unknown]> = [['Area', sb.comment_template],
      ...snap.categories.map(c => [c.name, isObj(c.settings) ? c.settings.comment_template : null] as [string, unknown])];
    for (const [who, tpl] of tpls) {
      if (typeof tpl !== 'string') continue;
      for (const slug of changedSlugs) for (const src of trans.get(slug)!.sources) {
        if (tpl.includes(src)) warnings.push(`comment_template (${who}) sadrži doslovno „${src}".`);
      }
    }

    if (!same(sb, s)) config.push({ kind: 'area_settings', target_id: snap.areaId, before: sb, after: s });
  }

  // ── 5. Shortcuti i sidra ──────────────────────────────────────────────────
  for (const p of snap.presets) {
    const before = { default_attributes: p.default_attributes ?? null, filter_state: p.filter_state ?? null };
    const after = clone(before);
    const where = `shortcut „${p.name}"`;
    if (isObj(after.default_attributes)) {
      for (const [id, v] of Object.entries(after.default_attributes)) {
        const slug = attrById.get(id)?.slug;
        if (!slug || typeof v !== 'string' || !changedSlugs.includes(slug)) continue;
        const to = pureOf(slug, v);
        if (to) { after.default_attributes[id] = to; changes.push(`${where}: ${slug} „${v}" → „${to}"`); }
        else if (vanishedOf(slug, v)) warnings.push(`${where}: zadaje ${slug} „${v}", a ona više nema redaka.`);
      }
    }
    const af = isObj(after.filter_state) && isObj(after.filter_state.attrFilter) ? after.filter_state.attrFilter : null;
    if (af && typeof af.value === 'string') {
      const slug = attrById.get(String(af.attrDefId))?.slug;
      if (slug && changedSlugs.includes(slug)) {
        const to = pureOf(slug, af.value);
        if (af.isExact && to) { changes.push(`${where} (filtar): ${slug} „${af.value}" → „${to}"`); af.value = to; }
        else if (!af.isExact) warnings.push(`${where}: djelomičan filtar po ${slug} „${af.value}" — provjeri.`);
        else if (vanishedOf(slug, af.value)) warnings.push(`${where}: filtar ${slug} „${af.value}" više nema redaka.`);
      }
    }
    if (!same(before, after)) config.push({ kind: 'preset', target_id: p.id, before, after });
  }

  for (const b of snap.anchors) {
    if (!changedSlugs.includes(b.group_slug)) continue;
    const to = pureOf(b.group_slug, b.group_value);
    if (to) {
      config.push({ kind: 'anchor', target_id: b.id, before: { group_value: b.group_value }, after: { group_value: to } });
    } else if (vanishedOf(b.group_slug, b.group_value)) {
      // ⚠ račun bez sidra = pločica bez potvrđenog stanja, bez greške
      errors.push(`sidro ${b.group_slug} „${b.group_value}": račun se raspao — sidro ne može slijediti.`);
    }
  }
  const nAnchors = config.filter(c => c.kind === 'anchor').length;
  if (nAnchors) changes.push(`Sidra salda: ${nAnchors} prate preimenovani račun`);

  const predicted: RestructurePlan['predicted'] = { slugs: [...touchedSlugs], values: {} };
  for (const e of snap.events) {
    if (!touchedCats.has(e.category_id)) continue;
    const w = work.get(e.id)!;
    const out: Record<string, string> = {};
    for (const s of touchedSlugs) if (w[s]) out[s] = w[s];
    predicted.values[e.id] = out;
  }

  return {
    steps: results, changes, warnings, errors, config,
    rpc: errors.length ? null : { p_steps: rpcSteps, p_config: config },
    predicted,
  };
}
