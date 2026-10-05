/**
 * S162 — rename sluga mora povući SVE reference u configu, i View mora
 * pokazati datetime znamenke kako su spremljene.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   1. Rename sluga u Structure panelu popravljao je `depends_on`, pločicu i
 *      kolone liste — ali ne `automations` (set_attribute, rata), ključeve
 *      `due.settle` ni `{slug}` u predlošku komentara. Pravilo bi tada tiho
 *      prestalo raditi (Backlog P4).
 *   2. View je datetime pretvarao u lokalnu zonu (`12:00` ⇒ `14:00`, a `23:00`
 *      ⇒ sutradan), dok Edit, lista, filtar i Excel čitaju spremljene znamenke.
 *
 * ⚠ Zona je Zagreb: u UTC-u (CI) bi stari View kod dao isti rezultat, pa test
 *   ne bi mjerio ništa.
 */
process.env.TZ = 'Europe/Zagreb';

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'slugRenameConfig.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export { renameSlugInAutomations, renameSlugInTemplate } from './src/lib/automationsConfig';",
      "export { renameSlugInDashboard, dashboardSlugRefs } from './src/lib/dashboardConfig';",
      "export { displayDatetime } from './src/lib/excelDatetime';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000',
      VITE_APP_ENV: 'test',
    }),
  },
});
const { renameSlugInAutomations, renameSlugInTemplate, renameSlugInDashboard, dashboardSlugRefs, displayDatetime }
  = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

// Oblik kakav stoji u Financije_all (skraćeno).
const automations = {
  attribute_rules: [
    { action: 'set_attribute', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
      date_map: { Racun: 'same', Visa: 'cutoff:3:5' }, lock_slug: 'izvod_opis' },
    { action: 'set_attribute', target_slug: 'drugo', map_slug: 'nesto', date_map: {} },
  ],
  rata: {
    trigger_slug: 'rate', count_slug: 'brojrata', amount_slug: 'isplata',
    date_map_slug: 'izvorplacanja', date_map: { Visa: 5, Mastercard: 11 },
    override_attrs: { status: 'Planiran', izvorplacanja: 'X' },
    comment_attr_slug: 'trgovac', charge_date_slug: 'datum_naplate', index_slug: 'rata_br',
  },
};

console.log('');
console.log('automations:');
{
  const r = renameSlugInAutomations(automations, 'izvorplacanja', 'izvor');
  ok('map_slug pravila prepisan', r.automations.attribute_rules[0].map_slug === 'izvor');
  ok('rata.date_map_slug prepisan', r.automations.rata.date_map_slug === 'izvor');
  ok('override_attrs KLJUČ prepisan, vrijednost netaknuta',
     r.automations.rata.override_attrs.izvor === 'X' && !('izvorplacanja' in r.automations.rata.override_attrs));
  ok('brojač = 3', r.changed === 3, String(r.changed));
  ok('drugo pravilo netaknuto', r.automations.attribute_rules[1].map_slug === 'nesto');
  ok('date_map (VRIJEDNOSTI, ne slugovi) netaknut', r.automations.rata.date_map.Visa === 5);
  ok('ulaz nije mutiran', automations.attribute_rules[0].map_slug === 'izvorplacanja'
     && automations.rata.override_attrs.izvorplacanja === 'X');
}
{
  const r = renameSlugInAutomations(automations, 'izvod_opis', 'zig');
  ok('lock_slug (žig) prepisan', r.automations.attribute_rules[0].lock_slug === 'zig' && r.changed === 1);
  ok('pravilo bez lock_slug ga ne dobiva', !('lock_slug' in r.automations.attribute_rules[1]));
}
{
  const r = renameSlugInAutomations(automations, 'datum_naplate', 'dn');
  ok('target_slug + charge_date_slug', r.automations.attribute_rules[0].target_slug === 'dn'
     && r.automations.rata.charge_date_slug === 'dn' && r.changed === 2, String(r.changed));
}
{
  const r = renameSlugInAutomations(automations, 'nepostoji', 'x');
  ok('nepoznat slug ⇒ 0', r.changed === 0);
}
{
  const r = renameSlugInAutomations({}, 'a', 'b');
  ok('prazna automatika ne dobiva ključeve', r.changed === 0 && !('rata' in r.automations) && !('attribute_rules' in r.automations));
}

console.log('');
console.log('comment_template:');
{
  const r = renameSlugInTemplate('{napomena} ({tip}/{podtip}) {tip}', 'tip', 'vrsta');
  ok('svaka pojava, cijeli token', r.template === '{napomena} ({vrsta}/{podtip}) {vrsta}' && r.changed === 2, r.template);
  const r2 = renameSlugInTemplate('{podtip} tip', 'tip', 'vrsta');
  ok('{podtip} i goli tekst `tip` se NE diraju', r2.template === '{podtip} tip' && r2.changed === 0, r2.template);
}

console.log('');
console.log('dashboard due.settle:');
{
  const dash = { widgets: [{
    type: 'balance_by_group', title: 'Saldo', group_by: 'racun', plus: 'uplata', minus: 'isplata',
    due: { basket_by: 'izvorplacanja', due_slug: 'datum_naplate', status_slug: 'status', pending: 'Planiran',
           baskets: { Mastercard: { account: 'ZABA' } },
           settle: { izvorplacanja: 'Racun', smjer: 'Isplata', tip: 'Transfer' } },
  }] };
  const r = renameSlugInDashboard(dash, 'smjer', 'pravac');
  const s = r.config.widgets[0].due.settle;
  ok('settle KLJUČ prepisan', s.pravac === 'Isplata' && !('smjer' in s), JSON.stringify(s));
  ok('dashboardSlugRefs vidi settle ključ', dashboardSlugRefs(dash).has('smjer'));
  const r2 = renameSlugInDashboard(dash, 'izvorplacanja', 'izvor');
  ok('basket_by + settle ključ = 2', r2.changed === 2 && r2.config.widgets[0].due.settle.izvor === 'Racun', String(r2.changed));
}

console.log('');
console.log('displayDatetime (View):');
ok('zona je doista postavljena', new Date(2026, 8, 1).getTimezoneOffset() === -120);
ok('baza `12:00+00:00` ⇒ 12:00, ne 14:00',
   displayDatetime('2026-09-05T12:00:00+00:00') === '2026-09-05 12:00', displayDatetime('2026-09-05T12:00:00+00:00'));
ok('sat 23:00 ostaje ISTI dan',
   displayDatetime('2026-09-05T23:00:00+00:00') === '2026-09-05 23:00', displayDatetime('2026-09-05T23:00:00+00:00'));
ok('oblik iz forme (bez zone)', displayDatetime('2026-09-05T08:30') === '2026-09-05 08:30');
ok('goli datum', displayDatetime('2026-09-05') === '2026-09-05');
ok('smeće ⇒ null', displayDatetime('abc') === null);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
