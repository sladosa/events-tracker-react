/**
 * useBackdropClose — selekcija teksta ne smije zatvoriti modal (S134)
 * ==================================================================
 * Svi modali su zatvarali na `onClick` s uvjetom `e.target === e.currentTarget`.
 * Izgleda kao „kliknuto je na pozadinu", ali nije: **`click` se okida na
 * najbližem ZAJEDNIČKOM PRETKU elemenata na kojima su se dogodili `mousedown` i
 * `mouseup`.** Povučeš li selekciju iz polja unutar panela i otpustiš miš izvan
 * njega, taj predak je upravo pozadina — uvjet je istinit i panel se zatvara,
 * s nespremljenim izmjenama.
 *
 * Prijavljeno pod Kokinim računom: „kad u Edit prozoru nešto brzo selektiram,
 * izleti mi iz Edit ekrana bez izmjena".
 *
 * Test vrti PRAVI kod hooka nad minimalnim React shimom i mjeri PONAŠANJE.
 * ⚠ Ključan je slučaj 2: on je jedini koji pada nad starim kodom. Bez njega bi
 *   test prolazio i prije popravka — dakle ne bi čuvao ništa (S120 pouka).
 *
 * Pokreće se iz korijena projekta:
 *   node src/hooks/__tests__/backdropClose.test.mjs
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

// ── minimalni React shim: `useRef` mora PREŽIVJETI između rendera ───────────
const slots = [];
let idx = 0;
const React = {
  useRef(init) {
    const i = idx++;
    if (!slots[i]) slots[i] = { current: init };
    return slots[i];
  },
};
const render = () => { idx = 0; };

// ── učitaj PRAVI hook, samo mu preusmjeri uvoz reacta ───────────────────────
const dir = mkdtempSync(join(tmpdir(), 'backdrop-'));
const src = readFileSync('src/hooks/useBackdropClose.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
writeFileSync(join(dir, 'react-stub.mjs'), 'export const useRef = globalThis.__R.useRef;');
writeFileSync(join(dir, 'hook.mjs'),
  code.replace(/from ['"]react['"]/, "from './react-stub.mjs'"));
globalThis.__R = React;
const { useBackdropClose } = await import(pathToFileURL(join(dir, 'hook.mjs')).href);

// ── driver: glumi backdrop i sadržaj panela ─────────────────────────────────
const BACKDROP = { id: 'backdrop' };
const INPUT    = { id: 'input-u-panelu' };

let closed = 0;
const onClose = () => { closed++; };

/** Jedan potez mišem: pritisak na `down`, otpuštanje na `up`.
 *  `click` ide na zajedničkog pretka — a to je pozadina čim se elementi
 *  razlikuju, jer je ona njihov zajednički kontejner. */
function drag(handlers, down, up) {
  handlers.onMouseDown({ target: down, currentTarget: BACKDROP });
  handlers.onMouseUp({ target: up, currentTarget: BACKDROP });
  // `click.target` je ZAJEDNIČKI PREDAK elemenata na kojima su bili mousedown i
  // mouseup — čim se razlikuju, to je pozadina. Upravo zato hook ne smije
  // odlučivati po njemu.
  const clickTarget = down === up ? down : BACKDROP;
  handlers.onClick({ target: clickTarget, currentTarget: BACKDROP });
}

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else      { fail++; console.log('  ✗', name); }
};

console.log('\nuseBackdropClose\n');

// 1. pravi klik na pozadinu → zatvara
render();
let h = useBackdropClose(onClose);
closed = 0;
drag(h, BACKDROP, BACKDROP);
check('klik na pozadinu zatvara', closed === 1);

// 2. ⭐ SELEKCIJA iz panela van → NE zatvara  (jedini slučaj koji pada nad starim kodom)
render();
h = useBackdropClose(onClose);
closed = 0;
drag(h, INPUT, BACKDROP);
check('selekcija iz polja prema van NE zatvara', closed === 0);

// 3. klik unutar panela → ne zatvara
render();
h = useBackdropClose(onClose);
closed = 0;
drag(h, INPUT, INPUT);
check('klik unutar panela ne zatvara', closed === 0);

// 4. `enabled = false` (npr. dok traje spremanje) → ne zatvara
render();
h = useBackdropClose(onClose, false);
closed = 0;
drag(h, BACKDROP, BACKDROP);
check('dok je zatvaranje ugašeno, ni pravi klik ne zatvara', closed === 0);

// 5. ⚠ zastavica se mora RAZORUŽATI: selekcija van, pa odmah pravi klik.
//    Bez brisanja `startedOnBackdrop` drugi bi klik naslijedio staro stanje.
render();
h = useBackdropClose(onClose);
closed = 0;
drag(h, INPUT, BACKDROP);      // ne smije zatvoriti
drag(h, BACKDROP, BACKDROP);   // smije
check('nakon selekcije van, sljedeći pravi klik i dalje zatvara', closed === 1);

// 6. obrnuto: pritisak na pozadini, otpuštanje unutar panela → ne zatvara
render();
h = useBackdropClose(onClose);
closed = 0;
drag(h, BACKDROP, INPUT);
check('pritisak na pozadini a otpuštanje u panelu ne zatvara', closed === 0);

console.log('\n%d/%d\n', pass, pass + fail);
process.exit(fail ? 1 : 0);
