/**
 * Events Tracker – Delta sheet  (Faza 1)
 * =======================================
 * Radni list za usklađenje jednog računa s bankovnom aplikacijom.
 *
 * Nastaje NAD običnim Activities exportom (`addActivitiesSheetsTo`), ne umjesto
 * njega — pa se uvozi istim putem, s istim `row_hash` skipom i istim
 * update-guardom. Delta sheet dodaje samo ono što usklađenju treba:
 *
 *   1. PRAZNE RETKE s prepisanim kolonama i UNAPRIJED UPISANIM `session_start`
 *   2. KOLONU `Stanje (kontrola)` — tekući saldo po istom pravilu kao pločica
 *   3. ĆELIJU „u banci piše" + razliku, da se greška vidi PRIJE uvoza
 *
 * ⚠ ZAŠTO VREMENA UNAPRIJED, A NE AUTOMATSKI PRI UVOZU
 *   Prazan `session_start` import tumači kao `09:00` (`excelImport.ts:249`).
 *   Leaf je L1, pa bi svi retci istog dana pali u JEDNU aktivnost. Automatska
 *   dodjela slobodne minute u importu rješava to, ali ubija zaštitu koja već
 *   postoji: KOLIZIJA je način na koji se hvata dvostruki uvoz istog filea.
 *   Zato vremena piše generator, iz pojasa koji povijesni uvoz nije koristio
 *   (`09:00+n`) — ponovni uvoz istog sheeta daje ista vremena i uredno se
 *   prijavi kao kolizija.
 *
 * ⚠ ZAŠTO SUMIFS, A NE „prethodni redak + uplata − isplata"
 *   Lančana formula se raspadne na prvom sortu, a korisnik sortira čim doda
 *   redak sa starijim datumom. `SUMIFS` po datumu ≤ datum ovog retka daje isti
 *   broj i preživi i sort i umetanje retka u sredinu.
 *
 * ⚠ ZAŠTO KONTROLNI STUPAC MORA IMATI ISTE UVJETE KAO PLOČICA
 *   Zbroji li sve retke, pokazat će drugi broj od pločice i korisnik će loviti
 *   razliku koje nema. Uvjeti se zato ČITAJU IZ `dashboard` configa (isti izvor
 *   iz kojeg ih čita RPC), a ne prepisuju ovdje.
 */

import ExcelJS from 'exceljs';
import type { ExportEvent, ExportAttrDef, ExportCategoriesDict } from './excelTypes';
import type { WidgetFilter } from '@/types/database';
import { addActivitiesSheetsTo, buildAttrMeta, colLetter, FIXED_COL_COUNT } from './excelExport';
import { applyProfileToWorkbook, getProfileAttrOrder, type ExportProfile } from './exportProfile';

/** Prvi slobodni pojas vremena za ručno dodane retke (povijesni uvoz koristi 09:00+n). */
export const DELTA_TIME_START_H = 14;

export interface DeltaSheetOptions {
  /** Ime računa/grupe koju sheet usklađuje. */
  groupLabel:   string;
  /**
   * Stanje od kojeg kontrolni stupac kreće, i dan na koji vrijedi.
   *
   * ⚠ NIJE ISTO ŠTO I SIDRO. Sidro je potvrđeno izvana (§2.17) i može biti staro
   *   godinu i pol; prozor sheeta je kratak. Otvarajuće stanje je zato ono što
   *   APLIKACIJA računa na dan prije prozora — sidro plus sve od tada. Piše se u
   *   sheet uz oznaku da je izračunato, a sidro se ispisuje ispod njega: ako
   *   razlika na dnu ne padne na nulu ni nakon što je prozor pročešljan, greška
   *   je STARIJA od prozora i traži širi raspon.
   */
  opening:      { amount: number; asOf: string };
  /** Sidro na kojem to stanje počiva — samo za ispis, formula ga ne koristi. */
  anchor:       { amount: number; confirmed_on: string } | null;
  /** Slugovi iz `dashboard` widgeta. */
  plusSlug:     string;
  minusSlug:    string;
  /** Uvjeti koje pločica primjenjuje na saldo (`izvorplacanja`, `status`, …). */
  filters:      WidgetFilter[];
  /** Koliko praznih redaka ponuditi. */
  blankRows:    number;
  /** Vrijednosti koje se prepisuju u prazne retke: naziv atributa → vrijednost. */
  prefill:      Record<string, string | number | boolean>;
  /**
   * Koliko je redaka u GLAVNOM bloku (retci koji micu saldo). Sluzi da se kraj
   * bloka zna tocno, umjesto da se pogada skeniranjem kolone B — event bez
   * `area_name` bi tada tiho odrezao blok na krivom mjestu.
   */
  mainCount:    number;
  /**
   * Koliko je redaka u sekciji „planirano" (pisanoj ispod praznih redaka).
   * 0 = sekcije nema.
   */
  plannedCount: number;
  /**
   * Slug datumskog atributa dospijeca (`split.due_slug` iz configa).
   * Kad ga ima, sekcija je CIJELA KOSARA -- i retci koje je netko vec
   * prebacio u izvrseno -- pa dobiva drugaciji naslov i stupac `Provjeri`.
   * Odabir redaka radi pozivatelj (ExcelExportModal); ovdje sluzi samo za
   * pronalazak kolone i tekst.
   */
  dueSlug?:     string;
  /** Kolone B/C/G praznih redaka. */
  areaName:     string;
  categoryPath: string;
  userEmail:    string;
}

interface SheetLayout {
  headerRow:   number;
  dataStart:   number;
  dataEnd:     number;
  lastCol:     number;
  summaryRows: number[];      // Max / Min / Summ (redom)
  colByHeader: Map<string, number>;
}

/** Pročitaj raspored lista koji je složio `addActivitiesSheetsTo`. */
function readLayout(ws: ExcelJS.Worksheet, mainCount: number): SheetLayout {
  let headerRow = 0;
  const summaryRows: number[] = [];

  for (let r = 1; r <= ws.rowCount; r++) {
    const a = String(ws.getCell(r, 1).value ?? '').trim();
    if (a === 'event_id') { headerRow = r; break; }
    const h = String(ws.getCell(r, FIXED_COL_COUNT).value ?? '').trim();
    if (h.startsWith('Max (if relevant)') || h.startsWith('Min (if relevant)') || h.startsWith('Summ (if relevant)')) {
      summaryRows.push(r);
    }
  }
  if (!headerRow) throw new Error('Delta sheet: ne nalazim zaglavlje EVENT DATA (kolona A "event_id").');

  const colByHeader = new Map<string, number>();
  let lastCol = 0;
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = String(ws.getCell(headerRow, c).value ?? '').trim();
    if (v) { colByHeader.set(v, c); lastCol = c; }
  }

  // Kraj GLAVNOG bloka. ⚠ Ne skenira se kolona B: sekcija „planirano" je pisana
  // ispod praznine, pa bi „zadnji redak s popunjenim B" pokazao na NJU i prazni
  // retci bi se upisali preko nje. Broj redaka je poznat pozivatelju, pa se
  // racuna, ne pogada.
  const dataEnd = mainCount > 0 ? headerRow + mainCount : headerRow;

  return { headerRow, dataStart: headerRow + 1, dataEnd, lastCol, summaryRows, colByHeader };
}

/** `YYYY-MM-DD` -> `DD.MM.YYYY.` — sheet čita čovjek, ne stroj. */
function hr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}

/** Kolona atributa se u zaglavlju zove `Ime (Kategorija)`. */
function findAttrCol(layout: SheetLayout, attrName: string): number | null {
  for (const [header, col] of layout.colByHeader) {
    if (header === attrName || header.startsWith(`${attrName} (`)) return col;
  }
  return null;
}

/**
 * Jedan uvjet → SUMIFS par (raspon, kriterij).
 * ⚠ Podržani su samo jednovrijednosni `in` / `not_in`. Više vrijednosti bi
 *   tražilo SUMPRODUCT; kad zatreba, ovdje je mjesto — a dotad se uvjet
 *   IZOSTAVLJA i to se javlja pozivatelju, jer tiho ispuštanje uvjeta znači
 *   kontrolni stupac koji se ne slaže s pločicom, a izgleda uvjerljivo.
 */
function filterToCriteria(
  f: WidgetFilter,
  layout: SheetLayout,
  attrNameBySlug: Map<string, string>,
  rowFrom: number,
  rowTo: number,
): { range: string; criterion: string } | null {
  if (f.values.length !== 1) return null;
  const name = attrNameBySlug.get(f.slug);
  if (!name) return null;
  const col = findAttrCol(layout, name);
  if (!col) return null;

  const ltr = colLetter(col);
  const range = `$${ltr}$${rowFrom}:$${ltr}$${rowTo}`;
  if (f.op === 'in')     return { range, criterion: `"${f.values[0]}"` };
  if (f.op === 'not_in') return { range, criterion: `"<>${f.values[0]}"` };
  return null;
}

/**
 * Dopiši delta-alate na već složeni `Events` list.
 * Vraća upozorenja (uvjeti koji se nisu dali prevesti u formulu).
 */
export function addDeltaHelpersTo(
  ws: ExcelJS.Worksheet,
  attrDefs: ExportAttrDef[],
  opts: DeltaSheetOptions,
): string[] {
  const warnings: string[] = [];
  const layout = readLayout(ws, opts.mainCount);
  const attrNameBySlug = new Map<string, string>();
  for (const d of attrDefs) if (d.slug) attrNameBySlug.set(d.slug, d.name);

  const dateCol    = 4;                       // D = event_date
  const sessionCol = 5;                       // E = session_start
  const blankFrom  = layout.dataEnd + 1;
  const blankTo    = layout.dataEnd + opts.blankRows;

  // ── 1. Prazni retci ─────────────────────────────────────────────────────
  const templateRow = layout.dataEnd;         // s njega se preuzima validacija
  for (let i = 0; i < opts.blankRows; i++) {
    const r = blankFrom + i;

    ws.getCell(r, 2).value = opts.areaName;
    ws.getCell(r, 3).value = opts.categoryPath;
    ws.getCell(r, 7).value = opts.userEmail;  // ⚠ bez ovoga je redak „tuđi" i tiho se preskoči

    // Vrijeme unaprijed, jedinstveno po retku — v. zaglavlje datoteke.
    const hh   = DELTA_TIME_START_H + Math.floor(i / 60);
    const cell = ws.getCell(r, sessionCol);
    cell.value  = `${String(hh).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
    cell.numFmt = '@';

    for (const [attrName, value] of Object.entries(opts.prefill)) {
      const col = findAttrCol(layout, attrName);
      if (col) ws.getCell(r, col).value = value;
    }

    // Dropdowni i provjera datuma vrijede i za nove retke — inače ih korisnik
    // ima točno ondje gdje mu ne trebaju (na povijesti) i nema ondje gdje piše.
    if (templateRow > layout.headerRow) {
      for (let c = 1; c <= layout.lastCol; c++) {
        const dv = ws.getCell(templateRow, c).dataValidation;
        if (dv) ws.getCell(r, c).dataValidation = dv;
      }
    }
  }

  /**
 * Objasnjenje uz celiju, kao Data Validation "input message" umjesto biljeske.
 *
 * /!\ ZASTO NE `.note` (Sasin nalaz 2026-09-02)
 *   Biljeska se otvara DESNO od celije, pa kod desnog ruba lista izlazi izvan
 *   ekrana; a kad je list skrolan, odreze joj se dno. Objasnjenje koje se ne
 *   moze procitati je isto sto i objasnjenje kojeg nema. Input message se
 *   pozicionira uz celiju i uvijek stane cijeli.
 *
 * /!\ EXCEL LIMITI: promptTitle <= 32, prompt <= 255 znakova. Premasaj daje
 *   neispravan OOXML -- Excel ponudi "repair" i pritom izbaci sadrzaj, dakle
 *   kvar je gori od izostale poruke. Predugacak tekst zato PADA NATRAG na
 *   biljesku umjesto da srusi file.
 *
 * /!\ Nema crvenog trokuta, dakle ne najavljuje sam sebe. Ide samo na celije
 *   koje su vec naslov necega -- korisnik ih klikne kad ga zanima -- nikad kao
 *   jedini nositelj informacije bez koje se ne moze.
 */
function explain(cell: ExcelJS.Cell, title: string, text: string): void {
  if (title.length <= 32 && text.length <= 255) {
    cell.dataValidation = {
      type: 'custom', formulae: ['TRUE'], allowBlank: true,
      showInputMessage: true, showErrorMessage: false,
      promptTitle: title, prompt: text,
    };
  } else {
    cell.note = text;
  }
}

// ── 2. Kontrolni stupac ─────────────────────────────────────────────────
  const ctrlCol = layout.lastCol + 1;
  const ctrlLtr = colLetter(ctrlCol);

  const plusName  = attrNameBySlug.get(opts.plusSlug);
  const minusName = attrNameBySlug.get(opts.minusSlug);
  const plusCol   = plusName  ? findAttrCol(layout, plusName)  : null;
  const minusCol  = minusName ? findAttrCol(layout, minusName) : null;

  if (!plusCol || !minusCol) {
    warnings.push('Kontrolni stupac preskočen: ne nalazim kolone za uplatu/isplatu.');
    return warnings;
  }

  const crit: string[] = [];
  for (const f of opts.filters) {
    const c = filterToCriteria(f, layout, attrNameBySlug, layout.dataStart, blankTo);
    if (c) crit.push(`,${c.range},${c.criterion}`);
    else   warnings.push(`Uvjet "${f.slug} ${f.op} ${f.values.join('/')}" nije ušao u kontrolni stupac — brojka će se razlikovati od pločice.`);
  }

  const dLtr = colLetter(dateCol);
  const dateRange = `$${dLtr}$${layout.dataStart}:$${dLtr}$${blankTo}`;
  const sumRange = (col: number) => {
    const l = colLetter(col);
    return `$${l}$${layout.dataStart}:$${l}$${blankTo}`;
  };
  const openingAmount = opts.opening.amount;

  const ctrlHeader = ws.getCell(layout.headerRow, ctrlCol);
  ctrlHeader.value = 'Stanje (kontrola)';
  ctrlHeader.font  = { bold: true };

  for (let r = layout.dataStart; r <= blankTo; r++) {
    const cell = ws.getCell(r, ctrlCol);
    // Prazan datum ⇒ prazan saldo; inače bi neispunjeni redak pokazivao sidro.
    cell.value = {
      formula:
        `IF($${dLtr}${r}="","",` +
        `${openingAmount}` +
        `+SUMIFS(${sumRange(plusCol)},${dateRange},"<="&$${dLtr}${r}${crit.join('')})` +
        `-SUMIFS(${sumRange(minusCol)},${dateRange},"<="&$${dLtr}${r}${crit.join('')}))`,
    };
    cell.numFmt    = '#,##0.00';
    cell.alignment = { horizontal: 'right' };
  }

  // ── 3. „U banci piše" + razlika ─────────────────────────────────────────
  // Ide u redove sažetka IZNAD zaglavlja, pa se ne dira ni jedan podatkovni
  // redak i import ovo nikad ne vidi.
  const labelCol = ctrlCol - 1;
  const rows = layout.summaryRows;
  if (rows.length >= 3) {
    const openRow = rows[rows.length - 3];
    const bankRow = rows[rows.length - 2];
    const diffRow = rows[rows.length - 1];

    // Odakle stupac kreće — ispisano, jer se inače ne vidi da broj na dnu ovisi
    // o nečemu izvan vidljivih redaka.
    // Kratka oznaka: dugačak tekst preliva se preko susjednih sažetaka i
    // izgleda kao da pripada njima.
    ws.getCell(openRow, labelCol).value = `stanje ${hr(opts.opening.asOf)} ->`;
    ws.getCell(openRow, labelCol).alignment = { horizontal: 'right' };
    const openCell = ws.getCell(openRow, ctrlCol);
    openCell.value  = opts.opening.amount;
    openCell.numFmt = '#,##0.00';
    // Podrijetlo ide u bilješku: brojka je IZRAČUNATA, sidro je potvrđeno.
    // Ako razlika na dnu ne padne na nulu ni nakon češljanja prozora, greška je
    // starija od prozora — a to se vidi samo ako se zna odakle stupac kreće.
    openCell.note = opts.anchor
      ? `Izračunato iz aplikacije na ${hr(opts.opening.asOf)}.\n`
        + `Počiva na sidru ${hr(opts.anchor.confirmed_on)} = ${opts.anchor.amount.toFixed(2)}, `
        + `plus sve promjene do ${hr(opts.opening.asOf)}.\n`
        + `Ako razlika ne padne na nulu, greška može biti i starija od ovog prozora.`
      : `Izračunato iz aplikacije na ${hr(opts.opening.asOf)}. Račun nema sidro — `
        + `nijedno stanje nije potvrđeno izvana.`;

    ws.getCell(bankRow, labelCol).value = 'u banci piše ->';
    ws.getCell(bankRow, labelCol).alignment = { horizontal: 'right' };
    const bankCell = ws.getCell(bankRow, ctrlCol);
    bankCell.value  = null;
    bankCell.numFmt = '#,##0.00';
    bankCell.border = {
      top:    { style: 'medium' }, left:  { style: 'medium' },
      bottom: { style: 'medium' }, right: { style: 'medium' },
    };

    ws.getCell(diffRow, labelCol).value = 'razlika ->';
    ws.getCell(diffRow, labelCol).alignment = { horizontal: 'right' };
    const diffCell = ws.getCell(diffRow, ctrlCol);
    // Zadnji NEPRAZAN kontrolni redak, bez tvrdo upisanog kraja raspona —
    // isti obrazac koji sažeci već koriste (LOOKUP(2,1/(…<>"")…)).
    // ⚠ ROUND NIJE KOZMETIKA. Zbroj stotinjak `SUMIFS` članova nosi grešku
    //   zapisa u dvojnom sustavu (~1e-13), pa razlika koja se ISPISUJE kao
    //   `0,00` doslovno nije nula — uvjetni format je zato bojao crveno nad
    //   savršeno usklađenim sheetom. Zaokruži se na lipu, tj. na jedinicu u
    //   kojoj su i svi ulazi.
    diffCell.value = {
      formula:
        `IF(${ctrlLtr}${bankRow}="","",` +
        `ROUND(${ctrlLtr}${bankRow}-LOOKUP(2,1/($${ctrlLtr}$${layout.dataStart}:$${ctrlLtr}$${blankTo}<>""),` +
        `$${ctrlLtr}$${layout.dataStart}:$${ctrlLtr}$${blankTo}),2))`,
    };
    diffCell.numFmt = '#,##0.00';
    diffCell.font   = { bold: true };
    // Zeleno na nuli je cijela poanta: usklađeno se vidi bez čitanja broja.
    ws.addConditionalFormatting({
      ref: `${ctrlLtr}${diffRow}`,
      rules: [
        { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['0'],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } } },
        // ⚠ exceljs pozna samo equal/greaterThan/lessThan/between za `cellIs`;
        //   „različito od nule" mora ići kao izraz. Prazna ćelija se izuzima,
        //   inače prazan sheet svijetli crveno prije nego je itko išta upisao.
        { type: 'expression', priority: 2,
          formulae: [`AND(${ctrlLtr}${diffRow}<>"",${ctrlLtr}${diffRow}<>0)`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } } },
      ],
    });
  }

  // ── 3b. Sekcija „planirano" ─────────────────────────────────────────────
  // Retci koje je pisac vec upisao ISPOD praznine (v. `trailing` u
  // addActivitiesSheetsTo). Ovdje im se doda samo naslov i vlastita kontrola.
  //
  // ⚠ ZASTO ODVOJENA SEKCIJA, A NE MEDU OSTALIMA
  //   Planirane kartcne stavke su cesto STARIJE od prozora (rate s naplatom
  //   11.07. uz sidro 30.07.), pa u glavnom bloku ne bi bile ni prikazane —
  //   a bas njih treba potvrditi.
  //
  // ⚠ KONTROLNI STUPAC IH NE POKRIVA, I TO JE ISPRAVNO
  //   Kartcna stavka ne tereti racun; tereti ga tek skupna naplata. Zato su
  //   izvan raspona `dataStart..blankTo` i njihova celija ostaje PRAZNA —
  //   `0,00` bi ondje tvrdio da je stanje nula.
  if (opts.plannedCount > 0) {
    const sepRow      = blankTo + 1;                 // prazan redak = granica
    const plannedFrom = blankTo + 2;
    const plannedTo   = plannedFrom + opts.plannedCount - 1;

    // Naslov ide u kolonu H (komentar). Kolona B ostaje PRAZNA, pa import ovaj
    // redak uopce ne vidi kao redak.
    const title = ws.getCell(sepRow, FIXED_COL_COUNT);
    title.value = opts.dueSlug
      // Kosara: unutra su i retci koje je netko vec prebacio u izvrseno. Zato
      // tekst NE trazi promjenu Statusa na svakom retku, nego slaganje ZBROJA.
      ? `KOSARA -- kartcni retci cije dospijece jos nije proslo. Ne micu saldo. `
        + `Prvo slozi zbroj s izvodom (v. dno), pa tek onda potvrdi retke `
        + `promjenom "${attrNameBySlug.get('status') ?? 'Status'}" u Izvrsen.`
      : `PLANIRANO — ne mice saldo. Potvrdi promjenom "${attrNameBySlug.get('status') ?? 'Status'}" u Izvrsen, ali TEK kad se kosara slozi s izvodom (v. dno).`;
    title.font  = { bold: true, italic: true };

    // ── Kontrola kosare: zbroj sekcije vs iznos skupne naplate s izvoda ──
    // ⚠ Bez ove celije bi „potvrdi" bila potvrda PO DATUMU, a izmjereno je da
    //   datum naplate na kartcnim retcima zna biti kriv (S112): kosara za
    //   11.07.2026. nosi 2.234,02, a banka je tog dana skinula 1.244,74.
    //   Potvrditi po dospijecu znaci upisati tvrdnju koju mjerenje opovrgava.
    const sumRow  = plannedTo + 2;
    const bankRow = sumRow + 1;
    const diffRow = sumRow + 2;
    const mLtr    = colLetter(minusCol);

    // -- Stupac `Provjeri`: sto s ovim retkom nije u redu ------------------
    // /!\ FORMULA, ne upisan tekst. Kad korisnik u Excelu promijeni `Status`,
    //   napomena mora nestati istog trena -- inace sheet i dalje prigovara
    //   retku koji je upravo popravljen, a upozorenje koje lazе se prestane
    //   citati.
    //
    // /!\ DRUGI SLUCAJ NE SMIJE GLASITI "promijeni u Izvrsen".
    //   Automat "dospjelo => izvrseno" je ODBACEN (dospjeli datum nije dokaz da
    //   je banka naplatila), pa ni savjet ne smije tako glasiti -- naucio bi
    //   korisnika da potvrdjuje po datumu. Zato upucuje na DOKAZ, ne na potez.
    const notIn    = opts.filters.find(f => f.op === 'not_in' && f.values.length > 0);
    const statusNm = notIn ? attrNameBySlug.get(notIn.slug) : undefined;
    const dueNm    = opts.dueSlug ? attrNameBySlug.get(opts.dueSlug) : undefined;
    const statusCol = statusNm ? findAttrCol(layout, statusNm) : null;
    const dueColIdx = dueNm    ? findAttrCol(layout, dueNm)    : null;

    if (opts.dueSlug && notIn && statusCol && dueColIdx) {
      const hintCol = ctrlCol + 1;
      const sLtr = colLetter(statusCol);
      const uLtr = colLetter(dueColIdx);
      const planned = notIn.values[0];

      // /!\ Naslov ide u REDAK-RAZDJELNIK, ne u zaglavlje lista (Sasina
      //   primjedba): stupac vrijedi samo za sekciju, a zaglavlje je desetke
      //   redaka iznad, uz `Stanje (kontrola)` koje se odnosi na glavni blok.
      //   Ovako naslov stoji tocno iznad redaka na koje se odnosi.
      const hdr = ws.getCell(sepRow, hintCol);
      hdr.value = 'Provjeri';
      hdr.font  = { bold: true };
      explain(hdr, 'Provjeri',
        'Popunjava se samo u sekciji košare. Napomena nestaje čim redak postane '
        + 'u redu — mijenja se sama, ne treba je brisati.');
      ws.getColumn(hintCol).width = 46;

      for (let r = plannedFrom; r <= plannedTo; r++) {
        const cell = ws.getCell(r, hintCol);
        cell.value = {
          formula:
            `IF($${sLtr}${r}="","",` +
            `IF(AND($${sLtr}${r}<>"${planned}",$${uLtr}${r}>TODAY()),` +
              `"dospijeva tek "&TEXT($${uLtr}${r},"d.m.yyyy.")&" — nije moglo biti naplaćeno",` +
            `IF(AND($${sLtr}${r}="${planned}",$${uLtr}${r}<TODAY()),` +
              `"dospjelo "&TEXT($${uLtr}${r},"d.m.yyyy.")&" — potvrdi TEK s izvoda","")))`,
        };
        cell.font      = { color: { argb: 'FFB45309' }, italic: true };
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
    } else if (opts.dueSlug) {
      // Tiho izostajanje bi bilo gore od poruke: stupac koji nekad ima smisla, a
      // nekad ga nema, korisnik cita kao "sve je u redu".
      warnings.push('Stupac „Provjeri" preskočen: ne nalazim kolonu za status ili dospijeće.');
    }

    ws.getCell(sumRow, labelCol).value = opts.dueSlug ? 'Σ košara (gore) ->' : 'Σ planirano (gore) ->';
    ws.getCell(sumRow, labelCol).alignment = { horizontal: 'right' };
    const sumCell = ws.getCell(sumRow, ctrlCol);
    // /!\ NETO, ne samo zbroj isplata: povrat zna sjediti u istoj kosari.
    //   Izmjereno na ZABA kosari 11.08.: 49 redaka, isplate 2.868,04, a
    //   jedan povrat od 3,00 -- banka tereti neto. Zbroj bez njega bi
    //   tvrdio razliku prema izvodu koje nema.
    const pLtr     = colLetter(plusCol);
    sumCell.value  = { formula: `ROUND(SUM($${mLtr}$${plannedFrom}:$${mLtr}$${plannedTo})-SUM($${pLtr}$${plannedFrom}:$${pLtr}$${plannedTo}),2)` };
    sumCell.numFmt = '#,##0.00';
    explain(sumCell, 'Σ košare',
      'Usporedi sa SKUPNOM NAPLATOM s izvoda za taj datum. Ne slažu li se, kriv je '
      + 'datum naplate na nekim retcima — ne potvrđuj ih dok se to ne razriješi: '
      + 'dospjeli datum nije dokaz da je banka naplatila.');

    ws.getCell(bankRow, labelCol).value = 'naplaceno s izvoda ->';
    ws.getCell(bankRow, labelCol).alignment = { horizontal: 'right' };
    const bank2 = ws.getCell(bankRow, ctrlCol);
    bank2.value  = null;
    bank2.numFmt = '#,##0.00';
    bank2.border = {
      top:    { style: 'medium' }, left:  { style: 'medium' },
      bottom: { style: 'medium' }, right: { style: 'medium' },
    };

    ws.getCell(diffRow, labelCol).value = 'razlika ->';
    ws.getCell(diffRow, labelCol).alignment = { horizontal: 'right' };
    const diff2 = ws.getCell(diffRow, ctrlCol);
    // Suti dok „naplaceno" nije popunjeno rukom — inace bi provjera bila
    // tautoloska (isti obrazac kao „u banci pise" gore).
    diff2.value  = { formula: `IF(${ctrlLtr}${bankRow}="","",ROUND(${ctrlLtr}${bankRow}-${ctrlLtr}${sumRow},2))` };
    diff2.numFmt = '#,##0.00';
    diff2.font   = { bold: true };
    ws.addConditionalFormatting({
      ref: `${ctrlLtr}${diffRow}`,
      rules: [
        { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['0'],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } } },
        { type: 'expression', priority: 2,
          formulae: [`AND(${ctrlLtr}${diffRow}<>"",${ctrlLtr}${diffRow}<>0)`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } } },
      ],
    });
  }

  // ── 3c. Sazeci se ogranicavaju na glavni blok + prazne retke ────────────
  // ⚠ `addActivitiesSheetsTo` racuna Max/Min/Summ dinamicki, do ZADNJEG retka s
  //   popunjenom kolonom B na cijelom listu. Sa sekcijom „planirano" to vise nije
  //   glavni blok, pa bi Σ tiho pocela ukljucivati i kartcne stavke — broj bi se
  //   promijenio, a nigdje ne bi pisalo zasto. Ovdje se raspon fiksira.
  if (opts.plannedCount > 0 && layout.summaryRows.length >= 3) {
    const [maxR, minR, sumR] = layout.summaryRows.slice(-3);
    for (const [r, fn] of [[maxR, 4], [minR, 5], [sumR, 9]] as [number, number][]) {
      for (let c = FIXED_COL_COUNT + 1; c <= layout.lastCol; c++) {
        const cell = ws.getCell(r, c);
        if (!cell.value || typeof cell.value !== 'object' || !('formula' in cell.value)) continue;
        const l = colLetter(c);
        cell.value = { formula: `SUBTOTAL(${fn},${l}${layout.dataStart}:${l}${blankTo})` };
      }
    }
  }

  // ── 4. Raspored ─────────────────────────────────────────────────────────
  ws.getColumn(ctrlCol).width = 15;

  // ⚠ Kontrolni stupac MORA biti unutar autofiltera — stupac izvan njega se pri
  //   sortu raspari od retka (isto pravilo zbog kojeg su tu row_hash i Delete?).
  ws.autoFilter = {
    from: { row: layout.headerRow, column: 1 },
    to:   { row: blankTo,          column: ctrlCol },
  };

  return warnings;
}

/** Cijeli delta workbook: Activities export (najstariji gore) + delta alati. */
export async function createDeltaExcel(
  events:         ExportEvent[],
  attrDefs:       ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  opts:           Omit<DeltaSheetOptions, 'mainCount' | 'plannedCount'>,
  exportProfile?: ExportProfile | null,
  /**
   * Planirani retci ovog racuna koje glavni blok NE pokriva (tipicno kartcni:
   * ne micu saldo, pa ih prozor ne prikazuje — a bas njih treba potvrditi).
   * ⚠ Ne smiju se preklapati s `events`, inace isti `event_id` stoji dvaput u
   *   istom fileu i uvoz obradi redak dvaput.
   */
  plannedRows:    ExportEvent[] = [],
): Promise<{ buffer: ArrayBuffer; warnings: string[] }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Events Tracker';
  wb.created = new Date();

  // Profil (redoslijed i skrivanje kolona) vrijedi i ovdje — delta sheet je
  // upravo ono mjesto gdje deset skrivenih kolona najviše znači.
  let attrColumnOrder: number[] | undefined;
  if (exportProfile) {
    const { attrMeta, attrColumns } = buildAttrMeta(attrDefs, categoriesDict);
    attrColumnOrder = getProfileAttrOrder(exportProfile, attrColumns, attrMeta);
  }

  // 'asc' — najstariji gore, najnoviji tik iznad praznih redaka: novi redak se
  // dopisuje ondje gdje je i u banci, na dnu.
  // Praznina mora primiti sve prazne retke + jedan redak granice, inace bi ih
  // `addDeltaHelpersTo` upisao PREKO sekcije „planirano".
  const gapRows = opts.blankRows + 1;
  await addActivitiesSheetsTo(
    wb, events, attrDefs, categoriesDict, 'asc', attrColumnOrder, undefined,
    plannedRows.length > 0 ? { events: plannedRows, gapRows } : undefined,
  );

  // ⚠ REDOSLIJED: profil PRIJE delta alata. Profil dira kolone po položaju
  //   (širine, skrivanje, grupe), a kontrolni stupac se dodaje kao zadnji —
  //   obrnuto bi ga profil mogao sakriti ili mu prepisati širinu.
  if (exportProfile) applyProfileToWorkbook(wb, exportProfile, attrDefs, categoriesDict);

  const ws = wb.getWorksheet('Events');
  if (!ws) throw new Error('Delta sheet: nema lista Events.');

  const warnings = addDeltaHelpersTo(ws, attrDefs, {
    ...opts, mainCount: events.length, plannedCount: plannedRows.length,
  });
  return { buffer: (await wb.xlsx.writeBuffer()) as ArrayBuffer, warnings };
}
