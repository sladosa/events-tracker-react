/**
 * Minimalni markdown za odgovore Help AI-ja (S160).
 *
 * ⚠ ZASTO (T-S159-1, na mobitelu): Haiku odgovara u markdownu, a `HelpPanel` je
 *   crtao `msg.content` kao obican tekst — korisnik je citao `#`, `**` i ```.
 *   Uz pravilo u promptu („bez naslova i tablica") ovo je druga strana istog
 *   popravka: prompt smanjuje sto dolazi, parser cisti ono sto ipak dode.
 *
 * ⚠ Namjerno MALO: naslov, lista (- * 1.), blok koda, odlomak; inline
 *   **podebljano** i `kod`. Sve ostalo ostaje doslovan tekst — krivo prepoznata
 *   sintaksa je gora od vidljive zvjezdice. Bez HTML-a: crta se kroz React
 *   elemente, pa odgovor ne moze ubaciti oznaku.
 */

export type Inline = { t: 'text' | 'bold' | 'code'; v: string };

export type Block =
  | { kind: 'heading'; text: Inline[] }
  | { kind: 'para'; lines: Inline[][] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'code'; text: string }
  | { kind: 'hr' };

/** `**x**` i `` `x` `` — nezatvorena oznaka ostaje doslovan tekst. */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+?)\*\*|`([^`]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] });
    else out.push({ t: 'code', v: m[2] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

const LIST_UL = /^\s*[-*•]\s+(.*)$/;
const LIST_OL = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*```/;
/** `---` / `***` / `___` sam u retku — razdjelnik (T-S160-8: stajao je kao tekst). */
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

export function parseHelpMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: 'para', lines: para }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      blocks.push({ kind: 'code', text: body.join('\n') });   // nezatvoren blok ide do kraja
      continue;
    }

    if (RULE.test(line)) { flushPara(); blocks.push({ kind: 'hr' }); continue; }

    const h = HEADING.exec(line);
    if (h) { flushPara(); blocks.push({ kind: 'heading', text: parseInline(h[1]) }); continue; }

    const ul = LIST_UL.exec(line);
    const ol = ul ? null : LIST_OL.exec(line);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      const prev = blocks[blocks.length - 1];
      const item = parseInline((ul ?? ol)![1]);
      if (prev && prev.kind === 'list' && prev.ordered === ordered) prev.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
      continue;
    }

    if (line.trim() === '') { flushPara(); continue; }
    para.push(parseInline(line));
  }
  flushPara();
  return blocks;
}
