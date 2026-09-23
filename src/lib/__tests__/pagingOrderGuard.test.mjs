/**
 * BRANA: svaki `.range()` u `src/` mora imati `.order()` u istom lancu upita.
 *
 * Zasto brana a ne rucni test: `T-S108-9` je bio opisan kao „regresija,
 * nedeterministicki" -- dakle rucno se NE da pouzdano izvesti. Paginacija bez
 * stabilnog sorta je tiha: Postgres ne jamci isti redoslijed izmedju dva upita,
 * pa se retci izmedju stranica **preklope i istovremeno preskoce**. Rezultat
 * izgleda uredno, samo mu fali dio redaka -- i **svaki put drugi**.
 *
 * /!\ Kod brisanja je gore od krive brojke: preskocen redak => parent DELETE
 *     padne na FK (S108). Zato ovo mjeri kod, ne ponasanje.
 *
 * Izmjereno pri pisanju (S146): 11 `.range()` poziva u `src/`, svih 11 sortirano.
 * Brana ne popravlja nista danas -- cuva da tako ostane.
 *
 * Tri stvari koje naivni provjeravac promasi, sve tri izmjerene:
 *   /!\ KOMENTAR koji spominje `.range(` -- `useStructureData.ts:78` opisuje bas
 *       ovaj kvar, pa bi ga brana prijavila kao kvar. Zato se komentari BRISU
 *       prije provjere. Gore od laznog pozitiva: komentar moze i SAKRITI pravi
 *       poziv, pa bi brana sutjela.
 *   /!\ LANAC KROZ VISE REDAKA -- `.order()` stoji redak-dva iznad `.range()`
 *       (`useActivities.ts`). Zato se gleda izraz do granice naredbe, ne redak.
 *   /!\ POMOCNA FUNKCIJA -- `buildBaseQuery().range(...)` u `excelDataLoader.ts`
 *       nosi `.order()` unutar helpera. Zato se helper razrjesava po imenu.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SRC = join(ROOT, 'src');
const NL = String.fromCharCode(10);
const TICK = String.fromCharCode(9989);
const CROSS = String.fromCharCode(10060);

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  ${CROSS} ${label}`);
    console.log(`       ocekivano: ${JSON.stringify(expected)}`);
    console.log(`       dobiveno : ${JSON.stringify(actual)}`);
  }
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__') continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/** Zamijeni komentare razmacima -- duljina se CUVA da brojevi redaka ostanu tocni. */
function stripComments(src) {
  let out = '';
  let i = 0;
  let mode = 'code';   // code | line | block | sq | dq | tpl
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tpl';
      out += c; i += 1; continue;
    }
    if (mode === 'line') {
      if (c === NL) { mode = 'code'; out += c; } else out += ' ';
      i += 1; continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = 'code'; out += '  '; i += 2; continue; }
      out += (c === NL ? c : ' '); i += 1; continue;
    }
    // unutar stringa
    if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = 'code';
    out += c; i += 1; continue;
  }
  return out;
}

/** Izraz koji zavrsava na `.range(` -- unatrag do granice naredbe. */
function chainBefore(text, rangeIdx) {
  let i = rangeIdx;
  let depth = 0;
  while (i > 0) {
    const c = text[i];
    if (c === ')') depth += 1;
    else if (c === '(') { if (depth === 0) break; depth -= 1; }
    else if (depth === 0 && (c === ';' || c === '{' || c === '}')) break;
    i -= 1;
  }
  return text.slice(i, rangeIdx);
}

/** `foo().range(` -> tijelo `foo` iz istog filea (jedna razina). */
function helperHasOrder(text, chain) {
  const m = chain.match(/([A-Za-z_$][\w$]*)\s*\(\s*\)\s*$/);
  if (!m) return false;
  const name = m[1];
  const decl = new RegExp(`(?:const|let|var|function)\\s+${name}\\b`);
  const at = text.search(decl);
  if (at === -1) return false;
  // tijelo: od deklaracije do kraja njenog bloka (brojanje viticastih)
  let i = text.indexOf('{', at);
  if (i === -1) return false;
  let depth = 0;
  const start = i;
  for (; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return text.slice(start, i).includes('.order(');
}

const files = walk(SRC).sort();
const findings = [];
let rangeCount = 0;

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = stripComments(readFileSync(file, 'utf8'));
  let idx = text.indexOf('.range(');
  while (idx !== -1) {
    rangeCount += 1;
    const chain = chainBefore(text, idx);
    const line = text.slice(0, idx).split(NL).length;
    if (!chain.includes('.order(') && !helperHasOrder(text, chain)) {
      findings.push(`${rel}:${line}`);
    }
    idx = text.indexOf('.range(', idx + 1);
  }
}

console.log('--- paginacija: svaki .range() mora imati .order() ---');
console.log(`  pregledano ${files.length} filea, nadjeno ${rangeCount} poziva .range()`);
check('nijedan .range() bez .order()', findings, []);

// /!\ Brojka mora biti > 0: prazan rezultat bi izgledao kao prolaz
//     (razred „brojac koji nula pokusaja prikazuje kao nula rezultata", S114).
check('detektor je uopce nesto nasao', rangeCount >= 10, true);

console.log('--- PROTUPROVJERA: detektor mora prijaviti pravi kvar ---');
const bad = "const q = supabase.from('events').select('id').range(0, 999);";
check('nesortiran .range() se prijavi',
      chainBefore(bad, bad.indexOf('.range(')).includes('.order('), false);
const good = "const q = supabase.from('events').select('id').order('id').range(0, 999);";
check('sortiran .range() prolazi',
      chainBefore(good, good.indexOf('.range(')).includes('.order('), true);

console.log('--- PROTUPROVJERA: komentar ne smije ni zapaliti ni sakriti ---');
const cmt = `// stari kod je isao .range() bez .order()${NL}const q = f().order('id').range(0, 9);`;
const cs = stripComments(cmt);
check('komentar s .range( se ne broji', (cs.match(/\.range\(/g) || []).length, 1);
check('brojevi redaka prezive stripanje', cs.split(NL).length, cmt.split(NL).length);

console.log('--- PROTUPROVJERA: helper se razrjesava ---');
const helper = "const build = () => { return supabase.from('e').order('id'); };" + NL
             + 'const q = build().range(0, 9);';
check('helper s .order() prolazi',
      helperHasOrder(helper, chainBefore(helper, helper.indexOf('.range('))), true);
const helperBad = "const build = () => { return supabase.from('e'); };" + NL
                + 'const q = build().range(0, 9);';
check('helper BEZ .order() se prijavi',
      helperHasOrder(helperBad, chainBefore(helperBad, helperBad.indexOf('.range('))), false);

console.log();
if (fail > 0) {
  console.error(`${CROSS} ${fail} palo, ${pass} proslo`);
  process.exit(1);
}
console.log(`${TICK} svih ${pass} proslo`);
