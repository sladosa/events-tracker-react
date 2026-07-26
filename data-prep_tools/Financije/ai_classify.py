"""
ai_classify.py — AI klasifikacija Tip/Podtip za Financije Review.

Dva moda:
  --eval   NASLIJEPO na već klasificiranim redcima → mjeri točnost. NE PIŠE NIŠTA.
  (--run   dolazi kasnije: piše Tip_AI/Podtip_AI/Pouzdanost_AI/AI run na N/A retke.)

Zašto eval daje DVA broja (v. NEXT_SESSION_PROMPT O9a):
  Od ~2580 klasificiranih redaka s tekstom, ~1414 je klasificirao `apply_rules.py`
  (keyword pravilo) — model ih pogađa trivijalno jer JE keyword u opisu. Pošten broj
  je slaganje na ručno labeliranim redcima (Kokine/Sašine labele).

Model se bira tako da EVAL VRTI ISTI MODEL I ISTI PROMPT koji ide u pravi run —
inače je izmjereni broj lažan.

Pokretanje (Review NE mora biti zatvoren — eval samo čita):
  python ai_classify.py --eval [--limit N] [--workers 5] [--model claude-sonnet-5]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import random
import re
import sys
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / 'data-prep_data' / 'Financije'
ENV_FILE = HERE.parent.parent / '.env.local'

MODEL = 'claude-sonnet-5'
BATCH = 40
UNKNOWN = 'NEPOZNATO'

# Bumpaj kad se promijeni prompt — predikcije iz starije verzije se NE recikliraju.
PROMPT_VER = 'v3-tvrda-pravila'
CONTEXT_FILE = 'AI_KONTEKST_pitanja.txt'      # Sašini odgovori, idu doslovno u prompt
PRED_FILE = 'ai_predictions.jsonl'            # append-only store, ključ = source_key
EVAL_SEED = 20260726                          # zamrznut uzorak → runovi su usporedivi

# Cijena po milijun tokena (Sonnet 5 uvodna cijena do 2026-08-31).
PRICE_IN, PRICE_OUT = 2.00, 10.00


# ── Pomoćno ──────────────────────────────────────────────────────────────────

def load_api_key() -> str:
    key = os.environ.get('ANTHROPIC_API_KEY')
    if key:
        return key
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
            m = re.match(r'\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$', line)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    sys.exit('✗ ANTHROPIC_API_KEY nije nađen (ni u okolini ni u .env.local).')


def pick_review() -> Path:
    cands = [p for p in DATA.glob('Financije_review_*.xlsx')
             if '.pre-' not in p.name and not p.name.startswith('~$')]
    if not cands:
        sys.exit(f'✗ Nema Review filea u {DATA}')
    return max(cands, key=lambda p: p.stat().st_mtime)


def header_map(ws) -> dict[str, int]:
    return {str(c.value).strip(): i
            for i, c in enumerate(next(ws.iter_rows(min_row=1, max_row=1)))
            if c.value}


def clean(v) -> str:
    return str(v).strip() if v is not None else ''


# ── Učitavanje ───────────────────────────────────────────────────────────────

def load_taxonomy(wb) -> list[str]:
    """Vraća listu valjanih 'Tip | Podtip' parova (bez N/A bucketa)."""
    ws = wb['Taksonomija']
    pairs, seen = [], set()
    for r in ws.iter_rows(min_row=2, values_only=True):
        tip, pod = clean(r[0]), clean(r[1]) if len(r) > 1 else ''
        if not tip or tip == 'N/A':
            continue
        p = f'{tip} | {pod}'
        if p not in seen:
            seen.add(p)
            pairs.append(p)
    return pairs


def load_context() -> str:
    """Sašini odgovori o kraticama i granicama — idu doslovno u system prompt.

    Namjerno se NE parsira: Saša je odgovarao inline uz stavke, ne iza "ODGOVOR:",
    i svaki parser bi nešto pojeo. Cijeli tekst je ~15 KB i kešira se.
    """
    p = DATA / CONTEXT_FILE
    if not p.exists():
        print(f'⚠ Nema {CONTEXT_FILE} — vrtim BEZ konteksta (slabiji rezultat).')
        return ''
    return p.read_text(encoding='utf-8')


def load_rows(wb) -> list[dict]:
    """Već klasificirani retci s tekstom = eval set."""
    ws = wb['Review']
    H = header_map(ws)
    need = ['Tip', 'Podtip', 'Napomena', 'Izvod opis', 'Izvor', 'Racun',
            'Uplata', 'Isplata', 'event_date', 'Pravilo run', 'Pouzdanost', 'source_key']
    missing = [c for c in need if c not in H]
    if missing:
        sys.exit(f'✗ Review sheetu nedostaju kolone: {missing}')

    out = []
    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        tip = clean(r[H['Tip']])
        if not tip or tip == 'N/A':
            continue
        napomena, izvod = clean(r[H['Napomena']]), clean(r[H['Izvod opis']])
        if not (napomena or izvod):
            continue
        iznos = r[H['Isplata']] or r[H['Uplata']] or 0
        d = r[H['event_date']]
        out.append({
            'row': i,
            # Ključ za store je source_key, NE broj retka — retci se pomiču pri re-sortu.
            'key': clean(r[H['source_key']]) or f'row:{i}',
            'datum': d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d),
            'racun': clean(r[H['Racun']]),
            'izvor': clean(r[H['Izvor']]),
            'smjer': 'isplata' if r[H['Isplata']] else 'uplata',
            'iznos': round(float(iznos), 2) if iznos else 0.0,
            'napomena': napomena,
            'izvod': izvod,
            'istina': f'{tip} | {clean(r[H["Podtip"]])}',
            'izvor_labele': 'pravilo' if clean(r[H['Pravilo run']]) else 'rucno',
        })
    return out


# ── Poziv modela ─────────────────────────────────────────────────────────────

SYSTEM = """Klasificiraš bankovne transakcije jednog hrvatskog kućanstva (Saša i Koka) \
u zadanu taksonomiju Tip/Podtip.

Pravila:
- Odgovori TOČNO jednim parom iz zadane liste, doslovno prepisanim.
- Ako opis stvarno ne dopušta zaključak, vrati "{unknown}". Bolje to nego pogoditi nasumično.
- Podtipovi sa sufiksom _Koka / _Sasa označavaju osobu. Kokin račun je "Kokin tekući ZABA", \
Sašin je "Sašin tekući RF" — ali to je samo naznaka, ne pravilo: oboje su kupovali objema karticama.
- "Namirnice | Hrana i ostalo" pokriva i drogerije (DM, Müller) — ustaljena konvencija ovog kućanstva.
- Prijenosi između vlastitih računa i podizanje gotovine idu u "Transfer".
- conf: "visoka" kad je merchant jasno prepoznatljiv, "srednja" kad je vjerojatno ali ne sigurno, \
"niska" kad pogađaš.
- Ako je zapis čista interna bilješka (osobno ime, kratica, ime + broj bez konteksta) i ništa \
u kontekstu ispod ga ne objašnjava — vrati "{unknown}" s conf "niska". NEMOJ pogađati \
samouvjereno; na prvom evalu je model za "Igor kune" i "Zoran povrat" tvrdio "Domaćinstvo | Struja" \
s visokom pouzdanošću, što je gore od priznanja da ne zna.

TVRDA PRAVILA — imaju prednost pred svime, uključujući kontekst na dnu.
Izvedena su iz Sašinih odgovora i iz stvarnih grešaka na prethodnom evalu.

 1. OSOBA KOD PRIHODA: kod uplata (mirovina, plaća, povrat) osobu određuje RAČUN —
    "Kokin tekući ZABA" → Koka, "Sašin tekući RF" → Saša. Kod KUPOVINA račun NE
    određuje osobu (oboje su kupovali objema karticama).
 2. AUDIBLE: ako u opisu piše AUDIBLE, Podtip je uvijek Audible_* i NIKAD Kindle.
    Iznos < 10 € → Audible_Koka; > 10 € (tipično ~16 €) → Audible_Sasa.
    Kindle_Koka samo ako u opisu doslovno piše KINDLE.
 3. RADNIČKA 49 = Sašino radno mjesto:
    · BIBERON (bilo gdje) → uvijek "Projekti | Sasa_Informatika".
    · KONZUM + RADNIČKA + isplata < 30 € i BEZ "RATA" → "Projekti | Sasa_Informatika"
      (ručak uz posao). Svaki drugi Konzum → "Namirnice | Hrana i ostalo".
 4. RATE: "RATA nn/mm" ili "ime N/M" znači N-tu ratu od ukupno M. Kategoriju određuje
    MERCHANT, ne činjenica da je rata. Konzum na rate ostaje Namirnice (velika kupovina
    razbijena na rate NIJE ručak, pa ne ide u Projekti).
 5. TRANSFER vs OSTALI PRIHODI: prijenos vlastitog novca ("Saša uplata", "PBZ Visa",
    naplata kartice, KEKS između njih dvoje) → "Transfer | izmedju racuna".
    "Ostali prihodi" je samo za STVARNI vanjski prihod koji nije mirovina ni povrat.
 6. AUTO kad se ne zna koji: default je "auto C5" (Koka ga vozi). "auto Lacetti" samo
    ako opis to izričito kaže (npr. oznaka SS = Saša Sladoljev).
 7. Ako Podtip nosi sufiks _Koka/_Sasa, a u Napomeni stoji ime ("Saša multisport"),
    ime određuje sufiks. To vrijedi SAMO za Podtipove sa sufiksom — "Saša Holding"
    je i dalje "Domaćinstvo | Holding (smeće)", jer taj Podtip nema osobu.

Dostupni parovi (Tip | Podtip):
{pairs}
{context}"""

CONTEXT_HDR = """

================================================================================
KONTEKST OD VLASNIKA PODATAKA (Saša) — kako ovo kućanstvo stvarno bilježi troškove.
Ovo je autoritativno: gdje se kosi s tvojom intuicijom, vrijedi ovo.
Tekst je izvorni odgovor na pitanja, uključujući primjere redaka.
================================================================================
"""


def render(rows: list[dict]) -> str:
    lines = []
    for r in rows:
        txt = ' / '.join(x for x in (r['napomena'], r['izvod']) if x)
        lines.append(f"[{r['row']}] {r['datum']} · {r['racun']} · {r['izvor']} · "
                     f"{r['smjer']} {r['iznos']:.2f} € · {txt}")
    return '\n'.join(lines)


def schema(pairs: list[str]) -> dict:
    return {
        'type': 'object',
        'properties': {
            'results': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'par': {'type': 'string', 'enum': pairs + [UNKNOWN]},
                        'conf': {'type': 'string', 'enum': ['visoka', 'srednja', 'niska']},
                    },
                    'required': ['id', 'par', 'conf'],
                    'additionalProperties': False,
                },
            }
        },
        'required': ['results'],
        'additionalProperties': False,
    }


def _call(client, model: str, pairs: list[str], rows: list[dict],
          effort: str, context: str = '') -> tuple[dict, dict]:
    """Jedan poziv. Vraća ({row: (par, conf)}, usage)."""
    sys_prompt = SYSTEM.format(unknown=UNKNOWN, pairs='\n'.join(pairs),
                               context=(CONTEXT_HDR + context) if context else '')
    ids = [r['row'] for r in rows]
    # Opseg se navodi EKSPLICITNO: Sonnet 5 čita upute doslovno i ne generalizira
    # instrukciju s prve stavke na ostale (v. migration guide). Bez ovoga je pri
    # effort=low vraćao 1 rezultat na 40 redaka, uz uredan stop_reason=end_turn.
    user = (f'Ispod je {len(rows)} transakcija.\n'
            f'Vrati TOČNO {len(rows)} rezultata — po jedan za SVAKI navedeni ID, '
            f'istim redoslijedom. Nemoj preskočiti nijedan i nemoj stati na prvom.\n'
            f'ID-evi: {", ".join(str(i) for i in ids)}\n\n' + render(rows))

    last = None
    for attempt in range(4):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=16000,
                system=[{'type': 'text', 'text': sys_prompt,
                         'cache_control': {'type': 'ephemeral'}}],
                thinking={'type': 'disabled'},
                output_config={'effort': effort,
                               'format': {'type': 'json_schema', 'schema': schema(pairs)}},
                messages=[{'role': 'user', 'content': user}],
            )
            break
        except Exception as e:                                   # noqa: BLE001
            last = e
            time.sleep(2 ** attempt + random.random())
    else:
        raise RuntimeError(f'4 pokušaja neuspješna: {last}')

    if resp.stop_reason == 'refusal':
        raise RuntimeError(f'refusal: {getattr(resp, "stop_details", None)}')

    text = ''.join(b.text for b in resp.content if b.type == 'text')
    data = json.loads(text)
    wanted = set(ids)
    canon = {p.lower(): p for p in pairs}          # structured-output enum NIJE obvezujuć:
    got = {}                                       # vraćalo je 'Hrana I ostalo' (veliko I)
    for x in data['results']:
        if int(x['id']) not in wanted:
            continue
        par = x['par']
        if par != UNKNOWN:
            par = canon.get(par.lower(), par)
        got[int(x['id'])] = (par, x['conf'])
    u = resp.usage
    return got, {
        'in': u.input_tokens,
        'out': u.output_tokens,
        'cache_w': getattr(u, 'cache_creation_input_tokens', 0) or 0,
        'cache_r': getattr(u, 'cache_read_input_tokens', 0) or 0,
    }


def classify(client, model: str, pairs: list[str], rows: list[dict],
             effort: str = 'medium', context: str = '') -> tuple[dict, dict]:
    """Poziv + dopuna: nepotpun odgovor se NE prihvaća tiho, nego se doziva.

    Tihi manjak je najgori mogući ishod — izgleda kao uspješan run s manjim N.
    """
    got, usage = _call(client, model, pairs, rows, effort, context)
    remaining = [r for r in rows if r['row'] not in got]
    for _ in range(3):
        if not remaining:
            break
        more, u = _call(client, model, pairs, remaining, effort, context)
        got.update(more)
        for k, v in u.items():
            usage[k] += v
        nxt = [r for r in remaining if r['row'] not in got]
        if len(nxt) == len(remaining):          # nema napretka → ne petljaj
            break
        remaining = nxt
    if remaining:
        print(f'\n  ⚠ {len(remaining)} redaka bez odgovora nakon dopuna '
              f'(redovi: {[r["row"] for r in remaining][:8]}…)')
    return got, usage


# ── Izvještaj ────────────────────────────────────────────────────────────────

def report(rows: list[dict], pred: dict, usage: dict, model: str) -> None:
    buckets = collections.defaultdict(lambda: {'n': 0, 'hit': 0, 'tip_hit': 0, 'unk': 0})
    conf_stats = collections.defaultdict(lambda: {'n': 0, 'hit': 0})
    confusion = collections.Counter()
    misses = []

    for r in rows:
        p = pred.get(r['row'])
        if not p:
            continue
        par, conf = p
        b = buckets[r['izvor_labele']]
        a = buckets['SVE']
        for x in (b, a):
            x['n'] += 1
        if par == UNKNOWN:
            for x in (b, a):
                x['unk'] += 1
            continue
        ok = par == r['istina']
        tip_ok = par.split(' | ')[0] == r['istina'].split(' | ')[0]
        for x in (b, a):
            x['hit'] += ok
            x['tip_hit'] += tip_ok
        conf_stats[conf]['n'] += 1
        conf_stats[conf]['hit'] += ok
        if not ok:
            confusion[(r['istina'], par)] += 1
            misses.append((r['row'], r['izvor_labele'], conf, r['istina'], par,
                           (r['napomena'] or r['izvod'])[:58]))

    def pct(a, b):
        return f'{a / b * 100:5.1f}%' if b else '    —'

    print('\n' + '=' * 78)
    print(f'  EVAL — {model}   (naslijepo, ništa nije pisano u Review)')
    print('=' * 78)
    print(f'\n{"skup":<22}{"N":>6}{"točan par":>12}{"točan Tip":>12}{"NEPOZNATO":>12}')
    print('-' * 78)
    for k, lbl in (('rucno', 'RUČNE labele ⭐'), ('pravilo', 'pravilo (napuhano)'), ('SVE', 'ukupno')):
        b = buckets.get(k)
        if not b or not b['n']:
            continue
        star = '  ← odluka na ovome' if k == 'rucno' else ''
        print(f'{lbl:<22}{b["n"]:>6}{pct(b["hit"], b["n"]):>12}'
              f'{pct(b["tip_hit"], b["n"]):>12}{pct(b["unk"], b["n"]):>12}{star}')

    print(f'\n{"pouzdanost modela":<22}{"N":>6}{"točan par":>12}')
    print('-' * 78)
    for c in ('visoka', 'srednja', 'niska'):
        s = conf_stats.get(c)
        if s and s['n']:
            print(f'{c:<22}{s["n"]:>6}{pct(s["hit"], s["n"]):>12}')

    if confusion:
        print(f'\nNajčešća neslaganja (istina → model), top 15:')
        print('-' * 78)
        for (t, p), n in confusion.most_common(15):
            print(f'{n:>4}×  {t[:33]:<34} → {p[:33]}')

    tot_in = usage['in'] + usage['cache_w'] + usage['cache_r']
    cost = ((usage['in'] + usage['cache_w'] * 1.25 + usage['cache_r'] * 0.1) / 1e6 * PRICE_IN
            + usage['out'] / 1e6 * PRICE_OUT)
    print(f'\nTokeni: {tot_in:,} ulaz ({usage["cache_r"]:,} iz keša) · {usage["out"]:,} izlaz')
    print(f'STVARNI TROŠAK: ${cost:.2f}')

    out = DATA / 'ai_eval_neslaganja.tsv'
    with out.open('w', encoding='utf-8') as f:
        f.write('red\tizvor_labele\tconf\tistina\tmodel\ttekst\n')
        for m in sorted(misses, key=lambda x: (x[1], x[0])):
            f.write('\t'.join(str(x) for x in m) + '\n')
    print(f'Neslaganja ({len(misses)}) → {out.name}   ← ovo je i detektor postojećih grešaka')


# ── Main ─────────────────────────────────────────────────────────────────────

def store_load(model: str, effort: str) -> dict[str, tuple[str, str]]:
    """Predikcije iz ranijih runova s ISTIM (prompt_ver, model, effort). Ključ = source_key."""
    p = DATA / PRED_FILE
    if not p.exists():
        return {}
    out: dict[str, tuple[str, str]] = {}
    for line in p.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if (d.get('prompt_ver'), d.get('model'), d.get('effort')) == (PROMPT_VER, model, effort):
            out[d['key']] = (d['par'], d['conf'])            # kasniji zapis pobjeđuje
    return out


def store_append(recs: list[dict]) -> None:
    with (DATA / PRED_FILE).open('a', encoding='utf-8') as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def stratified(rows: list[dict], n: int) -> list[dict]:
    """Zamrznut uzorak, pola ručnih / pola pravilo — da su runovi međusobno usporedivi."""
    rnd = random.Random(EVAL_SEED)
    out: list[dict] = []
    for src in ('rucno', 'pravilo'):
        pool = sorted((r for r in rows if r['izvor_labele'] == src), key=lambda r: r['key'])
        out += rnd.sample(pool, min(n // 2, len(pool)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--eval', action='store_true', required=True)
    ap.add_argument('--sample', type=int, default=0,
                    help='zamrznut stratificiran uzorak od N (jeftino podešavanje prompta)')
    ap.add_argument('--limit', type=int, default=0, help='prvih N nasumično (smoke test)')
    ap.add_argument('--resume', action='store_true',
                    help='preskoči retke koje store već ima za isti prompt_ver+model+effort')
    ap.add_argument('--only-conf', default='',
                    help='ponovi SAMO retke te pouzdanosti iz storea, npr. niska,srednja')
    ap.add_argument('--workers', type=int, default=5)
    ap.add_argument('--model', default=MODEL)
    ap.add_argument('--effort', default='medium', choices=['low', 'medium', 'high', 'xhigh'])
    args = ap.parse_args()

    import anthropic

    review = pick_review()
    wb = openpyxl.load_workbook(review, data_only=True)
    pairs = load_taxonomy(wb)
    rows = load_rows(wb)
    wb.close()
    context = load_context()

    if args.sample:
        rows = stratified(rows, args.sample)
    elif args.limit:
        rnd = random.Random(EVAL_SEED)
        rnd.shuffle(rows)
        rows = rows[:args.limit]

    cached = store_load(args.model, args.effort)
    todo = rows
    if args.only_conf:
        want = {c.strip() for c in args.only_conf.split(',')}
        todo = [r for r in rows if cached.get(r['key'], ('', ''))[1] in want]
    elif args.resume:
        todo = [r for r in rows if r['key'] not in cached]

    src = collections.Counter(r['izvor_labele'] for r in rows)
    print(f'Review: {review.name}')
    print(f'Taksonomija: {len(pairs)} parova · '
          + (f'kontekst {len(context):,} znakova' if context else 'kontekst: NEMA'))
    print(f'Eval set: {len(rows)} redaka  (ručno {src["rucno"]} · pravilo {src["pravilo"]})')
    print(f'Store: {len(cached)} predikcija za {PROMPT_VER}/{args.model}/{args.effort}'
          f'  →  zovem model za {len(todo)}')
    print(f'Model: {args.model} · effort {args.effort} · batch {BATCH} · '
          f'{args.workers} paralelno\n')

    pred = {r['row']: cached[r['key']] for r in rows if r['key'] in cached}
    usage: collections.Counter = collections.Counter()

    if todo:
        batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
        client = anthropic.Anthropic(api_key=load_api_key())
        by_row = {r['row']: r for r in todo}
        stamp = datetime.now().isoformat(timespec='seconds')
        run_id = f'{stamp}-{PROMPT_VER}'
        done = 0

        def work(b):
            return classify(client, args.model, pairs, b, args.effort, context)

        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            for got, u in ex.map(work, batches):
                pred.update(got)
                usage.update(u)
                store_append([
                    {'key': by_row[row]['key'], 'row': row, 'run_id': run_id,
                     'prompt_ver': PROMPT_VER, 'model': args.model, 'effort': args.effort,
                     'par': par, 'conf': conf, 'ts': stamp}
                    for row, (par, conf) in got.items() if row in by_row
                ])
                done += 1
                print(f'\r  batch {done}/{len(batches)}', end='', flush=True)
        print()

    report(rows, pred, dict(usage), args.model)
    print(f'Predikcije → {PRED_FILE}   ({len(pred)} u ovom izvještaju)')


if __name__ == '__main__':
    main()
