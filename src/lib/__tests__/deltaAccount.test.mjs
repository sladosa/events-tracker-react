/**
 * deriveDeltaAccount tests
 * ========================
 * Cuva BUG-S123-DELTAACCT: delta sheet se gradio za racun iz ZIVOG filtra, a
 * eventi su dolazili iz profila. Kad se ne poklope, presjek je prazan — a file
 * svejedno izadje s tocnim sidrom, prefillom i kontrolnim stupcem, dakle izgleda
 * kao savrseno uskladjen racun. Izmjereno na PROD-u 31.08.2026.: profil `RF` +
 * panel `Kokin tekuci ZABA` ⇒ 79 RF eventa u upitu, 0 redaka u sheetu, bez poruke.
 *
 * Pokrece se iz korijena projekta:
 *   node src/lib/__tests__/deltaAccount.test.mjs
 *
 * ⚠ Test uvozi PRAVU funkciju (esbuild transpajlira exportProfile.ts u temp .mjs),
 *   ne svoju kopiju — inace bi kopija s vremenom odlutala od koda koji se isporucuje.
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const src = readFileSync('src/lib/exportProfile.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'dacct-'));
const out = join(dir, 'exportProfile.mjs');
// `deriveDeltaAccount` je cista funkcija nad stringovima — ne dira nijedan uvoz
// (exceljs, excelExport, excelFingerprint) niti ijedan modul-level izraz koji bi
// ih trebao. Uvoze koristе SAMO druge funkcije u fileu, koje test ne poziva, pa
// se smiju maknuti umjesto da se za njih vuce cijeli bundle.
writeFileSync(out, code.replace(/^import[^;]*;$/gm, ''));
const { deriveDeltaAccount } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (got === want) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};

console.log('\nStvarni profili s PROD-a (areas.settings.export_profiles, 31.08.2026.):');
// Panel je namjerno na ZABA u OBA slucaja — to je stanje koje je proizvelo bug.
eq('profil RF   + panel ZABA ⇒ RF',
   deriveDeltaAccount('racun: =Sašin tekući RF', 'racun', 'Kokin tekući ZABA'), 'Sašin tekući RF');
eq('profil ZABA + panel ZABA ⇒ ZABA',
   deriveDeltaAccount('racun: =Kokin tekući ZABA', 'racun', 'Kokin tekući ZABA'), 'Kokin tekući ZABA');

console.log('\nFallback i granicni slucajevi:');
eq('bez profila ⇒ zivi filtar',
   deriveDeltaAccount(undefined, 'racun', 'Kokin tekući ZABA'), 'Kokin tekući ZABA');
eq('profil bez filtra atributa ⇒ zivi filtar',
   deriveDeltaAccount(undefined, 'racun', 'Sašin tekući RF'), 'Sašin tekući RF');
eq('"_" (namjerno obrisan filtar) ⇒ nema racuna',
   deriveDeltaAccount('_', 'racun', 'Kokin tekući ZABA'), '');
eq('profil filtrira po DRUGOM atributu ⇒ nema racuna, ne zivi filtar',
   deriveDeltaAccount('tip: =Prijevoz', 'racun', 'Kokin tekući ZABA'), '');
eq('~ (djelomicno) se cita jednako kao =',
   deriveDeltaAccount('racun: ~ZABA', 'racun', 'Sašin tekući RF'), 'ZABA');
eq('bez razmaka iza dvotocke',
   deriveDeltaAccount('racun:=Sašin tekući RF', 'racun', ''), 'Sašin tekući RF');
eq('neispravan oblik ⇒ nema racuna',
   deriveDeltaAccount('racun Kokin tekući ZABA', 'racun', 'Kokin tekući ZABA'), '');
eq('nema widgeta (group_by undefined) ⇒ zivi filtar',
   deriveDeltaAccount('racun: =Sašin tekući RF', undefined, 'Kokin tekući ZABA'), 'Kokin tekući ZABA');
eq('nista nigdje ⇒ prazno (⇒ ponuda se ne prikazuje)',
   deriveDeltaAccount(undefined, 'racun', undefined), '');

console.log(`\n${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
