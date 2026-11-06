/**
 * S194 T42 — „older records" upozorenje u pregledu uvoza ne pali za pečat izvoda.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Upozorenje „N older records (> 30 days) — accidental change?" je palo SVAKI
 *   mjesec (studeni: Visa 7/37, MC 26/54), jer rata nosi dan kupnje, a izvod na
 *   njoj legitimno mijenja samo žig, datum naplate i status. Upozorenje koje
 *   uvijek pali se otkliče — pa ne štiti ni kad treba. Pravilo se izvodi iz
 *   configa Aree (stvarni PROD config 18.10.), a iznos/Tip i dalje upozoravaju.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'statementStamp.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/confirmedRowEdit';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { statementStampSlugs, isStampOnly } = await import(pathToFileURL(out).href);

const fixture = JSON.parse(readFileSync(join(process.cwd(),
  'src/lib/__tests__/fixtures/areaSettings_prod_2026-10-18.json'), 'utf-8'));

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failed++; };

// ⚠ Fixture (AreaSettings sheet, F5) NE nosi `automations` — one putuju sheetom
//   `Automations` (OWNED_ELSEWHERE). Pravilo je doslovno iz baze 06.11.2026.
//   (TEST = kopija PROD-a); bez njega bi test mjerio Areu bez žiga.
const RULE = { name: 'Datum naplate po Izvoru', action: 'set_attribute', map_slug: 'izvorplacanja',
  lock_slug: 'izvod_opis', target_slug: 'datum_naplate',
  date_map: { Cash: 'same', Visa: 'cutoff:3:5', Racun: 'same', Mastercard: 'next:11' } };
const fin = statementStampSlugs({ ...fixture.Financije_all, automations: { attribute_rules: [RULE] } });
ok(statementStampSlugs(fixture.Financije_all).includes('status'),
  'i bez pravila: košara (`due`) sama daje datum naplate i status');
console.log('Financije_all (PROD 18.10.) pečat:', fin.join(', '));
ok(fin.includes('izvod_opis'), 'žig izvoda (lock_slug) je pečat');
ok(fin.includes('datum_naplate'), 'datum naplate (target + due_slug) je pečat');
ok(fin.includes('status'), 'status košare (due.status_slug) je pečat');
ok(!fin.includes('isplata') && !fin.includes('uplata'), 'IZNOS nije pečat');
ok(!fin.includes('tip') && !fin.includes('podtip'), 'Tip/Podtip nisu pečat');

ok(isStampOnly(['izvod_opis', 'datum_naplate', 'status'], fin), 'rata: žig + datum naplate + status ⇒ samo pečat');
ok(isStampOnly(['izvod_opis'], fin), 'samo žig ⇒ samo pečat');
ok(!isStampOnly(['izvod_opis', 'isplata'], fin), 'žig + iznos ⇒ UPOZORAVA');
ok(!isStampOnly(['tip'], fin), 'Tip ⇒ upozorava (slučajni drag-fill razvrstavanja)');
ok(!isStampOnly(['@event_date'], fin), 'datum retka ⇒ upozorava');
ok(!isStampOnly([], fin), 'bez ključeva ⇒ nije „samo pečat"');

const fit = statementStampSlugs(fixture.Fitness);
ok(fit.length === 0, 'Fitness (bez pravila i košare) ⇒ nema pečata');
ok(!isStampOnly(['status'], fit), 'Area bez pečata ⇒ svaka izmjena starog retka upozorava');
ok(statementStampSlugs(null).length === 0, 'bez settingsa ⇒ prazno');

console.log(failed ? `\n${failed} PALO` : '\nSVE PROSLO');
process.exit(failed ? 1 : 0);
