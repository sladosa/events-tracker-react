// ============================================================
// optionOrder.ts — redoslijed opcija u izbornicima (S164)
// ============================================================
// Koka i Saša: „imamo dosta itema … trebalo bi ih složiti po abecedi, inače je
// gnjavaža naći". Opcije su stajale redom kojim su nastale u `validation_rules`
// (Tip: `N/A, auto C5, auto Lacetti, Prijevoz, Domaćinstvo, …`), pa se 18 Tipova
// tražilo očima.
//
// PRAVILO
//   Atribut čiji NAJDULJI popis ima ≥ ALPHA_MIN opcija prikazuje SVE svoje popise
//   abecedno (hrvatska kolacija: č/ć poslije c, veličina slova se ne gleda).
//   Kraći atributi zadržavaju redoslijed vlasnika: tamo je on namjeran i kratak
//   (`Smjer`: Uplata, Isplata, PROVJERI; `Izvor`: Racun, Visa, Mastercard).
//   ⚠ Odluka je po ATRIBUTU, ne po popisu: inače bi Podtip pod `Zabava` (11)
//     bio abecedan, a pod `Razno` (6) ne — isti izbornik, dva ponašanja.
//   `N/A` (i `*`) ostaju NA VRHU: to je „još ne znam", ne vrijednost među ostalima.
//
// ⚠ Mijenja se samo PRIKAZ. `validation_rules` u bazi ostaje kako ga je vlasnik
//   upisao — Structure panel i dalje uređuje izvorni redoslijed.
// ⚠ Isto pravilo zovu forma (`AttributeInput`) i app Excel export. Python alati
//   (`_excel_izbornici.py`) ga ponavljaju — promjena praga ide na oba mjesta.
// ============================================================

export const ALPHA_MIN = 7;

const PINNED = ['N/A', '*'];
const collator = new Intl.Collator('hr', { sensitivity: 'base', numeric: true });

/** Abecedno (hr), `N/A` i `*` na vrhu, bez mijenjanja ulaza. */
export function sortOptions(options: readonly string[]): string[] {
  const pinned = PINNED.filter(p => options.includes(p));
  const rest = options.filter(o => !PINNED.includes(o));
  return [...pinned, ...[...rest].sort(collator.compare)];
}

/** Slaže li se atribut abecedno — gleda SVE njegove popise (vlastiti + po roditelju). */
export function isAlphaAttribute(lists: ReadonlyArray<readonly string[]>): boolean {
  return lists.some(l => l.length >= ALPHA_MIN);
}

/** Redoslijed za prikaz jednog popisa atributa čiji su svi popisi `allLists`. */
export function orderForDisplay(
  options: readonly string[],
  allLists: ReadonlyArray<readonly string[]>,
): string[] {
  return isAlphaAttribute(allLists) ? sortOptions(options) : [...options];
}
