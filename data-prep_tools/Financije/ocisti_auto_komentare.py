# -*- coding: utf-8 -*-
"""
ocisti_auto_komentare.py — brise REDUNDANTNE `comment`e koje je napisao
`comment_template`, a ne covjek. S132.

--------------------------------------------------------------------------------
STO BRISE

Area `Financije_all` nosi auto-comment template `{racun}/{tip}/{podtip}`.
On se primjenjuje SAMO kad je korisnikov komentar prazan
(`AddActivityPage.resolveEventNote`), pa nikad nista nije prepisao — ali je
prazna polja popunio strojnim tekstom koji ne nosi nijednu novu informaciju:

    Kokin tekuci ZABA/Domacinstvo/Hrana i ostalo

`Tip / Podtip` je vec svoja kolona liste, a racun stoji na `line1` kao
kratica (`RF`, `ZABA`). Dakle redak dvaput kaze isto, `Filter by = Comment`
time postaje neupotrebljiv, a buduci "prijedlog komentara iz povijesti"
(S130 backlog) dobio bi vlastiti strojni tekst kao najcesci presedan.

--------------------------------------------------------------------------------
/!\\ KRITERIJ JE REKONSTRUKCIJA, NE PRETRAGA PO UZORKU

Ne trazi se "sadrzi kosu crtu" nego se za SVAKI redak iznova izracuna sto bi
template nad NJEGOVIM atributima proizveo, i brise se samo ako je `comment`
tome jednak ZNAK U ZNAK. Rucno napisan opis se tako ne moze pogoditi ni
slucajno — a redak koji je covjek dopunio ("Konzum, akcija") ostaje. Skripta
uvijek ISPISE uzorak rucnih komentara koje ne dira, da se to vidi a ne vjeruje.

/!\ JEDAN RUB: redak kojem je auto-komentar upisan pa je POSLIJE reklasificiran
  (`Domacinstvo` u komentaru, `Razno` u atributu) rekonstrukciji vise ne
  odgovara, pa bi ostao zauvijek. Takvi se prepoznaju po OBLIKU nad rjecnikom
  vrijednosti koje u Arei stvarno postoje, i po zadanom se SAMO PRIJAVLJUJU —
  `--i-stare` ih ukljucuje u brisanje.

Evaluacija doslovno prati `src/lib/commentTemplate.ts`:
  - `{slug}` bez vrijednosti daje prazan string (pa je i `ZABA/Domacinstvo/`
    s praznim repom pogodak, ako je template tako ispao),
  - ima li template placeholdere a nijedan se nije popunio -> `null`,
  - rezultat se trimma.

/!\\ SKRIPTA PRVO PROVJERI JE LI TEMPLATE JOS ZIV, i to na OBJE razine.
  `resolveCommentTemplate` bira leaf PA TEK ONDA Areu, pa ciscenje samo Aree
  ne ugasi automatiku. Brisanje komentara dok pravilo stoji je posao koji se
  sam ponisti — sljedeci unos ga vrati. Nadje li ga, STAJE.

/!\\ RLS-blokiran write "uspije" s 200 i praznim rezultatom (CLAUDE.md), pa se
  mjeri BROJ VRACENIH REDAKA, nikad HTTP status.

/!\\ `--apply` uvijek prvo zapise backup `{id, comment}` svakog retka.
  `--restore <file> --apply` ga vraca.

Pokretanje:
    python ocisti_auto_komentare.py                  # dry run nad PROD-om
    python ocisti_auto_komentare.py --env test       # isto nad TEST bazom
    python ocisti_auto_komentare.py --apply          # pise (pokrece Sasa)
    python ocisti_auto_komentare.py --i-stare        # + reklasificirani auto-oblik
    python ocisti_auto_komentare.py --restore backup_autocomment_*.json --apply
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _db import load_env, rest  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ARHIVA = ROOT / 'data-prep_data' / 'Financije' / '_arhiva'

AREA_PROD = 'de8662e6-54f7-4ded-ab42-a786e7456067'
CAT_PROD = '986a4612-86a2-49fa-b73f-a29e048e5750'

# Template koji Area nosi. Ne cita se iz baze jer ciscenje mora raditi i
# POSLIJE njegova uklanjanja — a tada ga ondje vise nema.
TEMPLATE = '{racun}/{tip}/{podtip}'

CHUNK = 100  # koliko id-eva ide u jedan PATCH


def js_str(v):
    """`String(v)` iz JS-a. Bitno za brojeve: JS `String(13.0)` daje '13', a
    Python `str(13.0)` daje '13.0' — razlika bi napravila laznu nepodudarnost."""
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def evaluate(template, by_slug):
    """Doslovan prijevod `evaluateCommentTemplate` iz src/lib/commentTemplate.ts."""
    seen = {'ph': 0, 'filled': 0}

    def sub(m):
        seen['ph'] += 1
        v = by_slug.get(m.group(1))
        if v is None or v == '':
            return ''
        seen['filled'] += 1
        return js_str(v)

    out = re.sub(r'\{(\w+)\}', sub, template)
    if seen['ph'] > 0 and seen['filled'] == 0:
        return None
    return out.strip() or None


def build_shape_re(template, vocab):
    """Regex koji hvata komentar OBLIKA templatea, ali s BILO KOJOM kombinacijom
    vrijednosti koje u ovoj Arei stvarno postoje.

    Sluzi jednom jedinom slucaju: redak kojem je auto-komentar upisan, pa je
    POSLIJE reklasificiran. Rekonstrukcija tada vise ne odgovara (`Domacinstvo`
    u komentaru, `Razno` u atributu), pa bi takav zapis ostao zauvijek — a
    strojni je koliko i ostali.

    /!\\ Alternacija ide OD NAJDUZE VRIJEDNOSTI: `N/A` sadrzi separator `/`, pa
      bi naivni `split('/')` takav komentar razbio na krivom mjestu. Zato se
      uspoređuje s poznatim vrijednostima, ne reze po znaku.

    /!\\ Prazan ogranak (`|`) je nuzan jer `evaluate` za praznu vrijednost pise
      prazan string — `RF/Domacinstvo/` je legitiman ishod templatea.
    """
    out = []
    for p in re.split(r'(\{\w+\})', template):
        m = re.fullmatch(r'\{(\w+)\}', p)
        if not m:
            out.append(re.escape(p))
            continue
        vals = sorted(vocab.get(m.group(1), set()), key=len, reverse=True)
        if not vals:
            return None
        out.append('(?:' + '|'.join(re.escape(v) for v in vals) + '|)')
    return re.compile('^' + ''.join(out) + '$')


def load(url, key, cat_id):
    """Eventi kategorije + vrijednosti atributa slozene PO SLUGU — template ih
    gada slugom, ne imenom (v. S118, gdje su se slug i ime razisli)."""
    defs = {d['id']: d for d in rest(
        url, key, 'attribute_definitions?category_id=eq.' + cat_id
        + '&select=id,name,slug')}
    if not defs:
        sys.exit('/!\\ Kategorija ' + cat_id + ' nema atributa — kriva baza? STOP.')
    events = rest(url, key, 'events?category_id=eq.' + cat_id
                  + '&select=id,event_date,comment,user_id')
    vals = defaultdict(dict)
    for a in rest(url, key,
                  'event_attributes?attribute_definition_id=in.(' + ','.join(defs) + ')'
                  '&select=event_id,attribute_definition_id,value_text,value_number,'
                  'value_datetime,value_boolean'):
        d = defs.get(a['attribute_definition_id'])
        if not d or not d.get('slug'):
            continue
        v = a['value_text']
        for alt in ('value_number', 'value_datetime', 'value_boolean'):
            if v is None:
                v = a[alt]
        vals[a['event_id']][d['slug']] = v
    return defs, [dict(e, attrs=vals.get(e['id'], {})) for e in events]


def resolve_ids(url, key, which):
    """PROD id-evi su konstante; na TEST-u se Area/kategorija traze po imenu,
    jer su to druge tablice s drugim id-evima."""
    if which == 'prod':
        return AREA_PROD, CAT_PROD
    areas = rest(url, key, 'areas?slug=eq.financije-all&select=id,name')
    if not areas:
        sys.exit('/!\\ TEST baza nema areu `financije-all`. STOP.')
    area_id = areas[0]['id']
    cats = rest(url, key, 'categories?area_id=eq.' + area_id + '&select=id,name')
    leaf = [c for c in cats if c['name'] == 'Transakcija'] or cats
    if not leaf:
        sys.exit('/!\\ Area nema kategoriju `Transakcija`. STOP.')
    return area_id, leaf[0]['id']


def live_templates(url, key, area_id, cat_id):
    """Leaf pobjeduje Areu (`resolveCommentTemplate`), pa se gledaju OBJE."""
    out = {}
    for label, path in (
        ('Leaf  (pobjeduje)', 'categories?id=eq.' + cat_id + '&select=settings'),
        ('Area  (fallback)', 'areas?id=eq.' + area_id + '&select=settings'),
    ):
        rows = rest(url, key, path + '&limit=1')
        s = (rows[0].get('settings') if rows else None) or {}
        out[label] = s.get('comment_template')
    return out


def main():
    argv = sys.argv[1:]
    apply_ = '--apply' in argv
    svejedno = '--svejedno' in argv
    i_stare = '--i-stare' in argv
    which = 'prod'
    if '--env' in argv and argv[argv.index('--env') + 1].lower() in ('test', 'testing'):
        which = 'test'
    restore = argv[argv.index('--restore') + 1] if '--restore' in argv else None

    url, key = load_env(which)
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def patch(path, body):
        r = urllib.request.Request(url + '/rest/v1/' + path, method='PATCH',
                                   headers=H, data=json.dumps(body).encode())
        return json.load(urllib.request.urlopen(r))

    tag = '[' + which.upper() + ']'

    # -- restore ------------------------------------------------------------
    if restore:
        p = Path(restore)
        if not p.exists():
            p = ARHIVA / Path(restore).name
        rows = json.loads(p.read_text(encoding='utf-8'))
        print('=' * 92)
        print('RESTORE ' + tag + ' — ' + p.name + '   (' + str(len(rows)) + ' redaka)')
        print('=' * 92)
        if not apply_:
            print('\nDRY RUN — dodaj --apply da se stvarno vrati. Uzorak:')
            for r in rows[:10]:
                print('   ' + r['id'][:8] + '  <- ' + repr(r['comment']))
            return
        done = 0
        for r in rows:
            done += len(patch('events?id=eq.' + r['id'], {'comment': r['comment']}))
        print('\nvraceno ' + str(done) + ' / ' + str(len(rows)) + ' redaka')
        if done != len(rows):
            sys.exit('/!\\ Broj se ne poklapa — provjeri rucno.')
        return

    print('=' * 92)
    print('AUTO-KOMENTARI ' + tag + '   template: ' + TEMPLATE
          + ('   [APPLY]' if apply_ else '   [DRY RUN]'))
    print('=' * 92)

    area_id, cat_id = resolve_ids(url, key, which)
    print('   area ' + area_id[:8] + '   kategorija ' + cat_id[:8])

    # -- 1. je li pravilo jos zivo ------------------------------------------
    print('\n1 · PRAVILO — je li jos u bazi')
    live = live_templates(url, key, area_id, cat_id)
    for label, tpl in live.items():
        print('   ' + label.ljust(22) + (repr(tpl) if tpl else '— nema'))
    still = [k.split()[0] for k, v in live.items() if v]
    if still and not svejedno:
        print('\n/!\\ Pravilo je JOS ZIVO na: ' + ', '.join(still))
        print('    Ciscenje sada je posao koji se sam ponisti — sljedeci unos u')
        print('    appu upise isti komentar natrag. Prvo makni template (Structure')
        print('    Edit panel ili Structure import), provjeri da modal javi')
        print('    `Settings updated`, pa pokreni ovo.')
        sys.exit('    STOP. (`--svejedno` preskace provjeru.)')

    # -- 2. rekonstrukcija --------------------------------------------------
    print('\n2 · REKONSTRUKCIJA — sto bi template napisao nad svakim retkom')
    defs, events = load(url, key, cat_id)
    slugs = re.findall(r'\{(\w+)\}', TEMPLATE)
    have = {d['slug'] for d in defs.values() if d.get('slug')}
    missing = [s for s in slugs if s not in have]
    if missing:
        sys.exit('/!\\ Template gadja slug koji kategorija nema: ' + ', '.join(missing)
                 + '\n    (razred S118 — slug i ime su se razisli.) STOP.')
    print('   ' + str(len(events)) + ' eventa, ' + str(len(have)) + ' atributa; '
          + 'slugovi iz templatea nadjeni: ' + ', '.join(slugs))

    # Rjecnik stvarno postojecih vrijednosti po slugu — sluzi samo prepoznavanju
    # reklasificiranih redaka (v. `build_shape_re`).
    vocab = defaultdict(set)
    for e in events:
        for s in slugs:
            v = e['attrs'].get(s)
            if v not in (None, ''):
                vocab[s].add(js_str(v))
    shape = build_shape_re(TEMPLATE, vocab)

    hits, near, stari, human, prazni = [], [], [], [], 0
    for e in events:
        c = e.get('comment')
        if c is None or c.strip() == '':
            prazni += 1
            continue
        gen = evaluate(TEMPLATE, e['attrs'])
        if gen is not None and c == gen:
            hits.append(e)
        elif gen is not None and ' '.join(c.split()) == ' '.join(gen.split()):
            near.append((e, gen))          # razlikuje se SAMO u prazninama
        elif shape is not None and shape.match(c):
            stari.append((e, gen))         # oblik templatea, ali druga klasifikacija
        else:
            human.append(e)

    print('\n   ' + str(len(hits)).rjust(5) + '  auto-komentar, rekonstruiran  <- BRISE SE')
    print('   ' + str(len(stari)).rjust(5) + '  auto-oblik, reklasificiran    <- '
          + ('BRISE SE (--i-stare)' if i_stare else 'samo prijava'))
    print('   ' + str(len(near)).rjust(5) + '  razlika samo u prazninama     <- ostaje')
    print('   ' + str(len(human)).rjust(5) + '  rucno napisano                <- OSTAJE')
    print('   ' + str(prazni).rjust(5) + '  vec prazno')

    if near:
        print('\n   /!\\ Razlika samo u prazninama znaci da ih template nije napisao')
        print('       ovakve — ne brisu se, ali ih pogledaj:')
        for e, gen in near[:5]:
            print('       ' + e['event_date'] + '  ' + repr(e['comment'])
                  + '  vs  ' + repr(gen))

    if stari:
        print('\n   /!\\ Komentar ima OBLIK templatea, ali ne odgovara danasnjoj')
        print('       klasifikaciji retka — dakle upisan pa reklasificiran.')
        print('       Strojan je koliko i ostali; ukljuci ih s `--i-stare`.')
        for e, gen in stari[:8]:
            print('       ' + e['event_date'] + '  ' + repr(e['comment'])
                  + '\n           danas bi bilo  ' + repr(gen))

    # Dokaz da rucni opisi prezivljavaju — gleda se, ne vjeruje na rijec.
    if human:
        print('\n   RUCNO NAPISANI koje skripta NE DIRA (uzorak):')
        for e in sorted(human, key=lambda x: x['event_date'], reverse=True)[:8]:
            print('       ' + e['event_date'] + '  ' + e['comment'][:70])

    if i_stare:
        hits = hits + [e for e, _ in stari]

    if not hits:
        print('\nNema sto brisati.')
        return

    # -- 3. tko i kada ------------------------------------------------------
    print('\n3 · RASPODJELA')
    for uid, n in Counter(e['user_id'] for e in hits).most_common():
        print('   user ' + (uid or '—')[:8] + '   ' + str(n).rjust(5) + ' redaka')
    by_month = Counter(e['event_date'][:7] for e in hits)
    print('   po mjesecu: ' + ', '.join(m + '=' + str(n)
                                        for m, n in sorted(by_month.items())))
    print('\n   uzorak (najnoviji):')
    for e in sorted(hits, key=lambda x: x['event_date'], reverse=True)[:8]:
        print('       ' + e['event_date'] + '  ' + e['comment'])

    # -- 4. upis ------------------------------------------------------------
    if not apply_:
        print('\nDRY RUN — nista nije upisano. `--apply` brise ' + str(len(hits))
              + ' komentara (uz backup).')
        return

    ARHIVA.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bak = ARHIVA / ('backup_autocomment_' + which + '_' + stamp + '.json')
    bak.write_text(json.dumps([{'id': e['id'], 'comment': e['comment']} for e in hits],
                              ensure_ascii=False, indent=1), encoding='utf-8')
    print('\n4 · UPIS')
    print('   backup: ' + bak.name + '   (' + str(len(hits)) + ' redaka)')

    ids = [e['id'] for e in hits]
    done = 0
    for i in range(0, len(ids), CHUNK):
        part = ids[i:i + CHUNK]
        try:
            got = patch('events?id=in.(' + ','.join(part) + ')', {'comment': None})
        except urllib.error.HTTPError as ex:
            sys.exit('/!\\ PATCH pao na bloku ' + str(i // CHUNK + 1) + ': '
                     + ex.read().decode()[:300] + '\n    backup: ' + bak.name)
        done += len(got)
        print('   blok ' + str(i // CHUNK + 1).rjust(3) + '   trazeno '
              + str(len(part)).rjust(4) + '   promijenjeno ' + str(len(got)).rjust(4))

    print('\n   ukupno promijenjeno ' + str(done) + ' / ' + str(len(ids)))
    if done != len(ids):
        sys.exit('/!\\ RLS je progutao ' + str(len(ids) - done) + ' redaka'
                 ' (blokiran write "uspije" s praznim rezultatom).'
                 '\n    backup: ' + bak.name)
    print('   OK. Povratak: --restore ' + bak.name + ' --apply')


if __name__ == '__main__':
    main()
