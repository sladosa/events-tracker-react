/**
 * eventPhotos.test.mjs — upload i brisanje slika eventa (S191)
 *
 * ZASTO POSTOJI
 *   Upload je do S191 bio prepisan u Add, Edit (izmjena) i Edit (novi event) i sve tri kopije su
 *   grešku GUTALE: spremanje je javljalo uspjeh, a slike nije bilo. Edit je uz to brisao DATOTEKU
 *   prije ZAPISA — RLS-blokiran zapis bi ostao i pokazivao na obrisanu sliku. Kartica kataloga je
 *   četvrti korisnik, pa sad svi idu kroz `eventPhotos.ts`.
 *
 * STO CUVA (nad lažnim Supabase klijentom — bilježi pozive redom)
 *   - put u Storageu i natrag iz URL-a;
 *   - brisanje: zapis PRVO, datoteka tek kad je zapis stvarno obrisan; 0 redaka ⇒ greška, datoteka ostaje;
 *   - upload: greška Storagea se javlja; pad zapisa makne već uploadanu datoteku i javlja se;
 *   - `savePhotoChanges` ne baca: uspjele i neuspjele po slici (ponovni Spremi pokuša samo neuspjele).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cacheDir = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cacheDir, { recursive: true });
const fake = join(cacheDir, 'eventPhotos.fakeSupabase.mjs');
writeFileSync(fake, `
export const calls = [];
export const plan = { uploadError: null, insertRows: [{ id: 'a1' }], insertError: null, deleteRows: [{ url: 'https://x.supabase.co/storage/v1/object/public/activity-attachments/u1/e1_p1.jpg' }], removeError: null };
const q = (table) => ({
  insert(row) { calls.push(['insert', table, row]); return { select: async () => ({ data: plan.insertError ? null : plan.insertRows, error: plan.insertError }) }; },
  delete() { return { eq(col, val) { calls.push(['delete', table, val]); return { select: async () => ({ data: plan.deleteRows, error: null }) }; } }; },
});
export const supabase = {
  from: q,
  storage: { from: () => ({
    upload: async (path) => { calls.push(['upload', path]); return { error: plan.uploadError }; },
    getPublicUrl: (path) => ({ data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/activity-attachments/' + path } }),
    remove: async (paths) => { calls.push(['remove', paths[0]]); return { error: plan.removeError }; },
  }) },
};
`);

const out = join(cacheDir, 'eventPhotos.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/eventPhotos'; export { calls, plan } from '@/lib/supabaseClient';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
  plugins: [{
    name: 'fake-supabase',
    setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fake })); },
  }],
});
const m = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`); }
};
const J = JSON.stringify;
const reset = () => {
  m.calls.length = 0;
  Object.assign(m.plan, { uploadError: null, insertRows: [{ id: 'a1' }], insertError: null,
    deleteRows: [{ url: 'https://x.supabase.co/storage/v1/object/public/activity-attachments/u1/e1_p1.jpg' }], removeError: null });
};
const photo = (id) => ({ id, base64: 'data:image/jpeg;base64,' + Buffer.from('jpeg-' + id).toString('base64'), filename: id + '.jpg', sizeBytes: 9 });

console.log('\n── Putovi ──');
ok('put u Storageu', m.photoStoragePath('u1', 'e1', 'p1') === 'u1/e1_p1.jpg');
ok('put iz URL-a', m.storagePathFromUrl('https://x/storage/v1/object/public/activity-attachments/u1/e1_p1.jpg') === 'u1/e1_p1.jpg');
ok('tuđi URL ⇒ null', m.storagePathFromUrl('https://example.com/a.jpg') === null);
ok('base64 ⇒ blob iste duljine', (await m.base64ToJpegBlob(photo('p1').base64).arrayBuffer()).byteLength === 'jpeg-p1'.length);

console.log('\n── Brisanje ──');
reset();
await m.deleteEventPhoto('a1');
ok('zapis prvo, pa datoteka', J(m.calls) === J([['delete', 'event_attachments', 'a1'], ['remove', 'u1/e1_p1.jpg']]), J(m.calls));
reset();
m.plan.deleteRows = [];
let err = null;
try { await m.deleteEventPhoto('a1'); } catch (e) { err = e; }
ok('0 redaka (RLS) ⇒ greška', /nemaš pravo/.test(err?.message ?? ''), String(err));
ok('…i datoteka NIJE dirnuta', !m.calls.some(c => c[0] === 'remove'), J(m.calls));

console.log('\n── Upload ──');
reset();
await m.uploadEventPhoto('e1', 'u1', photo('p1'));
ok('upload pa zapis pod uploaderom', m.calls[0][0] === 'upload' && m.calls[0][1] === 'u1/e1_p1.jpg'
  && m.calls[1][0] === 'insert' && m.calls[1][2].user_id === 'u1' && m.calls[1][2].event_id === 'e1', J(m.calls));
reset();
m.plan.uploadError = { message: 'quota' };
err = null;
try { await m.uploadEventPhoto('e1', 'u1', photo('p1')); } catch (e) { err = e; }
ok('greška Storagea se javlja', /p1\.jpg.*upload.*quota/.test(err?.message ?? ''), String(err));
ok('…bez zapisa', !m.calls.some(c => c[0] === 'insert'));
reset();
m.plan.insertError = { message: 'rls' };
err = null;
try { await m.uploadEventPhoto('e1', 'u1', photo('p1')); } catch (e) { err = e; }
ok('pad zapisa se javlja', /zapis.*rls/.test(err?.message ?? ''), String(err));
ok('…i uploadana datoteka se makne', m.calls.some(c => c[0] === 'remove' && c[1] === 'u1/e1_p1.jpg'), J(m.calls));

console.log('\n── savePhotoChanges ──');
reset();
m.plan.uploadError = null;
const res = await m.savePhotoChanges('e1', 'u1', [photo('p1')], ['a1']);
ok('sve uspjelo', J(res) === J({ added: ['p1'], removed: ['a1'], failed: [] }), J(res));
ok('brisanje prije dodavanja', m.calls[0][0] === 'delete' && m.calls.findIndex(c => c[0] === 'upload') > 0, J(m.calls));
reset();
m.plan.insertError = { message: 'rls' };
const res2 = await m.savePhotoChanges('e1', 'u1', [photo('p1'), photo('p2')], []);
ok('ne baca: obje neuspjele su u failed', res2.added.length === 0 && res2.failed.length === 2, J(res2));
ok('poruka za čovjeka', /Slike: 2 nije spremljeno/.test(m.photoFailuresMessage(res2.failed) ?? ''), m.photoFailuresMessage(res2.failed));
ok('bez pada nema poruke', m.photoFailuresMessage([]) === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
