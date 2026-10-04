/**
 * S160 — Help odgovor kao lagani markdown (T-S159-1: korisnik je citao `#`, `**`, ```).
 *
 * ⚠ Mjeri i ono sto se NE smije prepoznati: nezatvorena `**` i obicna zvjezdica
 *   u tekstu ostaju doslovno — krivo prepoznata sintaksa gora je od vidljive.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'helpMarkdown.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/helpMarkdown';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { parseHelpMarkdown, parseInline } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const J = (x) => JSON.stringify(x);

const answer = [
  '## Kako dodati unos',
  'Klikni **+** u listi.',
  '',
  '1. Odaberi `Transakcija`',
  '2. Upiši iznos',
  '',
  '- prva',
  '* druga',
  '',
  '```',
  'Structure → Import',
  '```',
  'Kraj.',
].join('\n');
const b = parseHelpMarkdown(answer);
ok('naslov bez #', b[0].kind === 'heading' && J(b[0].text) === J([{ t: 'text', v: 'Kako dodati unos' }]), J(b[0]));
ok('podebljano u odlomku', b[1].kind === 'para' && b[1].lines[0].some(p => p.t === 'bold' && p.v === '+'), J(b[1]));
ok('numerirana lista, 2 stavke, kod u stavci', b[2].kind === 'list' && b[2].ordered && b[2].items.length === 2
  && b[2].items[0].some(p => p.t === 'code' && p.v === 'Transakcija'), J(b[2]));
ok('- i * su ista lista', b[3].kind === 'list' && !b[3].ordered && b[3].items.length === 2, J(b[3]));
ok('blok koda doslovno, bez ```', b[4].kind === 'code' && b[4].text === 'Structure → Import', J(b[4]));
ok('tekst poslije bloka', b[5].kind === 'para' && b[5].lines[0][0].v === 'Kraj.');
ok('nista vise', b.length === 6, String(b.length));

ok('nezatvorena ** ostaje doslovno', J(parseInline('2 ** 3')) === J([{ t: 'text', v: '2 ** 3' }]));
ok('obicna zvjezdica u tekstu nije lista ni bold', J(parseInline('iznos*2')) === J([{ t: 'text', v: 'iznos*2' }]));
const multi = parseHelpMarkdown('red jedan\nred dva');
ok('dva retka bez praznine = jedan odlomak s prijelomom', multi.length === 1 && multi[0].lines.length === 2);
ok('CRLF', parseHelpMarkdown('a\r\n\r\nb').length === 2);
ok('--- je razdjelnik, ne tekst (T-S160-8)', J(parseHelpMarkdown('a\n\n---\n\nb').map(x => x.kind)) === J(['para', 'hr', 'para']));
ok('- stavka i dalje lista, ne razdjelnik', parseHelpMarkdown('- x')[0].kind === 'list');
ok('nezatvoren blok koda ide do kraja', J(parseHelpMarkdown('```\nx\ny')) === J([{ kind: 'code', text: 'x\ny' }]));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
