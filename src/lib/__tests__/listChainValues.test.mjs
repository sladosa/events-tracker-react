/**
 * listChainValues.test.mjs — kolona liste čita cijeli lanac retka (S186)
 *
 * ZASTO POSTOJI
 *   T-S185-2 (27.10.2026.): `Fitness_Garmin`, trening 01.12.2024. — View pokazuje
 *   `mood` 4, lista u koloni Mood `—`. `mood` je atribut razine `Activity`, dakle
 *   živi na P2 roditeljskom eventu, a kolona je tražila samo leaf evente.
 *
 * STO CUVA
 *   - roditelj se nalazi po istom identitetu kao View (korisnik + session_start
 *     + predak + chain_key = leaf; stari zapisi s chain_key NULL samo ako je
 *     kandidat jedini),
 *   - leaf pobjeđuje roditelja, bliži roditelj daljeg,
 *   - roditeljski broj se NE zbraja preko leaf eventa sesije,
 *   - tuđi korisnik, druga sesija i drugi leaf istog roditelja ne cure u redak,
 *   - Financije-oblik (leaf na L1) daje isto što i prije.
 *
 * /!\ PROTUPROVJERA: staro ponašanje (samo leaf) je izvedeno ovdje i mora
 *     pasti na istom ulazu na kojem novo prolazi.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'listChainValues.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/listChainValues'; export { ancestorIds } from './src/lib/categoryTree';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { matchParentEvents, combineChainValues, ancestorIds } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        dobio ${g}\n        htio  ${w}`); }
};

// Fitness_Garmin oblik: Activity > Gym > Cardio, Activity > Outdoor. Financije: Transakcija (L1).
const cats = [
  { id: 'act', parent_category_id: null },
  { id: 'gym', parent_category_id: 'act' },
  { id: 'cardio', parent_category_id: 'gym' },
  { id: 'outdoor', parent_category_id: 'act' },
  { id: 'tx', parent_category_id: null },
];
const map = new Map(cats.map(c => [c.id, { ...c, name: c.id, area_id: 'A' }]));
const ancestorsOf = leaf => ancestorIds(map, leaf).slice(1);

const S1 = '2024-12-01T14:27:00+00:00';
const S2 = '2024-12-02T07:00:00+00:00';
const U = 'sasa', K = 'koka';
const slugById = new Map([['d_mood', 'mood'], ['d_dur', 'duration'], ['d_eq', 'equipment'], ['d_amt', 'iznos'], ['d_gymnote', 'gym_note']]);
const attr = (event_id, def, v) => ({
  event_id, attribute_definition_id: def,
  value_text: typeof v === 'string' ? v : null, value_number: typeof v === 'number' ? v : null,
  value_datetime: null, value_boolean: null,
});
const perEventOf = rows => { const m = new Map(); for (const r of rows) { if (!m.has(r.event_id)) m.set(r.event_id, []); m.get(r.event_id).push(r); } return m; };

const rows = [
  { sessionKey: 'r1', category_id: 'cardio', user_id: U, session_start: S1 },
  { sessionKey: 'r2', category_id: 'outdoor', user_id: U, session_start: S1 },   // isti trenutak, drugi leaf
  { sessionKey: 'r3', category_id: 'cardio', user_id: U, session_start: S2 },
  { sessionKey: 'r4', category_id: 'cardio', user_id: K, session_start: S1 },   // drugi korisnik
  { sessionKey: 'r5', category_id: 'tx', user_id: U, session_start: S1 },
  { sessionKey: 'r6', category_id: 'cardio', user_id: U, session_start: null },
];
const parents = [
  { id: 'p_act_r1', category_id: 'act', chain_key: 'cardio', user_id: U, session_start: S1 },
  { id: 'p_gym_r1', category_id: 'gym', chain_key: 'cardio', user_id: U, session_start: S1 },
  { id: 'p_act_r2', category_id: 'act', chain_key: 'outdoor', user_id: U, session_start: S1 },
  // r3: stari zapis bez chain_key, jedini kandidat ⇒ uzima se
  { id: 'p_act_r3', category_id: 'act', chain_key: null, user_id: U, session_start: S2 },
  // r4: drugi korisnik, dva stara kandidata ⇒ dvosmisleno ⇒ ne uzima se
  { id: 'p_act_r4a', category_id: 'act', chain_key: null, user_id: K, session_start: S1 },
  { id: 'p_act_r4b', category_id: 'act', chain_key: null, user_id: K, session_start: S1 },
];

console.log('matchParentEvents:');
const m = matchParentEvents(rows, parents, ancestorsOf);
eq('r1: najbliži roditelj prvi (gym, pa act)', m.get('r1'), ['p_gym_r1', 'p_act_r1']);
eq('r2: drugi leaf istog trenutka dobiva SVOJ roditelj', m.get('r2'), ['p_act_r2']);
eq('r3: chain_key NULL, jedini kandidat ⇒ uzet', m.get('r3'), ['p_act_r3']);
eq('r4: tuđi Sašin roditelj se ne uzima; dva NULL kandidata ⇒ nijedan', m.get('r4'), undefined);
eq('r5: Financije (L1) ⇒ nema roditelja', m.get('r5'), undefined);
eq('r6: bez session_start ⇒ nema roditelja', m.get('r6'), undefined);
eq('tuđi chain_key ne curi: r1 ne dobiva p_act_r2', (m.get('r1') ?? []).includes('p_act_r2'), false);

console.log('combineChainValues:');
// r1: dva leaf eventa iste sesije; mood i duration na Activity, equipment na leafu, gym_note na Gym.
const values = perEventOf([
  attr('l1', 'd_eq', 'orb'), attr('l1', 'd_amt', 10),
  attr('l2', 'd_amt', 5),
  attr('p_gym_r1', 'd_gymnote', 'bliži'), attr('p_gym_r1', 'd_mood', 2),
  attr('p_act_r1', 'd_mood', 4), attr('p_act_r1', 'd_dur', 94.7), attr('p_act_r1', 'd_gymnote', 'dalji'),
]);
const v = combineChainValues([['l1', 'l2'], ['p_gym_r1'], ['p_act_r1']], values, slugById);
eq('duration s roditelja, NE zbrojen preko 2 leaf eventa', v.num.get('duration'), 94.7);
eq('duration tekst', v.text.get('duration'), '94.7');
eq('leaf zbroj ostaje zbroj (iznos 10 + 5)', v.num.get('iznos'), 15);
eq('leaf vrijednost', v.text.get('equipment'), 'orb');
eq('bliži roditelj pobjeđuje daljeg (mood Gym 2, ne Activity 4)', v.num.get('mood'), 2);
eq('bliži roditelj pobjeđuje daljeg (tekst)', v.text.get('gym_note'), 'bliži');

const leafWins = combineChainValues([['x'], ['p']], perEventOf([attr('x', 'd_mood', 5), attr('p', 'd_mood', 1)]), slugById);
eq('leaf pobjeđuje roditelja', leafWins.num.get('mood'), 5);

const onlyParent = combineChainValues([['l'], ['p']], perEventOf([attr('p', 'd_mood', 4)]), slugById);
eq('T-S185-2: mood samo na Activity ⇒ 4', onlyParent.num.get('mood'), 4);

const fin = combineChainValues([['t1', 't2']], perEventOf([attr('t1', 'd_amt', 100), attr('t2', 'd_amt', 23.5), attr('t1', 'd_eq', 'ZABA')]), slugById);
eq('Financije-oblik: zbroj i tekst kao prije', [fin.num.get('iznos'), fin.text.get('equipment')], [123.5, 'ZABA']);

console.log('protuprovjera (staro ponašanje = samo leaf):');
const old = combineChainValues([['l']], perEventOf([attr('p', 'd_mood', 4)]), slugById);
const oldFails = old.num.get('mood') !== 4;
eq('staro ponašanje NE daje mood 4 (test bi ga uhvatio)', oldFails, true);

console.log(`\n${pass} prolaz, ${fail} pad`);
if (fail) process.exit(1);
