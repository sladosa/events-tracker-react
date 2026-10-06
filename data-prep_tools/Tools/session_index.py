"""
session_index.py -- „Zadnje sesije" + kronoloski dnevnik na vrhu DONE_HISTORY.md (S162)

    python data-prep_tools/Tools/session_index.py            # ispis, bez pisanja
    python data-prep_tools/Tools/session_index.py --write    # upise blok u file
    python data-prep_tools/Tools/session_index.py --normalize --write   # + razine naslova

ZASTO GENERATOR, A NE RUCNI POPIS
    DONE_HISTORY ima ~8.500 redaka i sesije NISU kronoloski poredane (S133 prije
    S132, arhive testova izmedju). Rucno odrzavan popis zastari isti tren kad se
    zaboravi -- isti razred kao kurirani popis testova (ukinut S116). Blok zato
    nastaje iz samih naslova, pa ne moze lagati o tome sto u fileu stoji.

STO CITA
    Sesija = naslov `## S<broj>…` ili `## Done S<broj>…` (i `###` iz starih grupa).
    Datum  = prvi `YYYY-MM-DD` u naslovu.
    Ukratko = redak `> Ukratko: …` u prva 4 retka ispod naslova (od S162);
              bez njega se koristi ostatak naslova.
    Ista sesija vise puta (sazetak + arhiva testova) -> vrijedi PRVA pojava.

/!\\ SIDRO = TOCAN TEKST NASLOVA, nikad slug, nikad postotno kodiran -- pravila
    i mjerenja su u `claude_index.py` (S139/S140). Dvotocka u naslovu lomi sidro u
    Obsidianu, pa `--normalize` dvotocke u naslovima sesija mijenja u ` —`.
    Stupac s brojem retka je jamstvo navigacije i kad sidro ne radi.

/!\\ --normalize (jednokratno, S162): S110–S135 su pisani kao `#`, ostalo `##`,
    pa je Obsidian sve od S136 nadalje sklapao UNUTAR „S135". Sada je svaka
    sesija `##`, a njene podsekcije pomaknute tako da najplica bude `###`.
    Broj sesija se broji prije i poslije -- razlika ruši alat bez pisanja.
"""
import io
import re
import sys

PATH = 'docs/sessions/DONE_HISTORY.md'
BEGIN = '<!-- SESSION-INDEX:BEGIN (generira session_index.py -- ne uredjivati rucno) -->'
END = '<!-- SESSION-INDEX:END -->'
RECENT = 3

SESSION = re.compile(r'^(#{1,3}) (?:Done )?(S\d+[a-z]*(?:[-–/]S?\d*[a-z]*)?)\b')
CONTAINER = re.compile(r'^#{1,2} (Arhiva|Arhivirano|✅ Siročad)')
HEAD = re.compile(r'^(#{1,6}) ')
DATE = re.compile(r'(\d{4}-\d{2}-\d{2})')

# Povratni link ispod svakog naslova sesije (S162, Sašin zahtjev) -- isti obrazac
# kao `↑ Sadrzaj` u claude_index.py. Sidro je JEDNORIJEČNO namjerno: to je oblik
# koji u Obsidianu dokazano skače (`Sadrzaj`, `Backlog`, S139).
# /!\ Čišćenje po OBLIKU, ne doslovnom stringu (S139: promjena oblika je inače
#     ostavila DVA linka ispod svakog naslova).
BACKLINK = '[↑ Dnevnik](#Dnevnik)'
BACKLINK_RE = re.compile(r'^\[↑ Dnevnik[^\]]*\]\(<?#Dnevnik[^)]*>?\)$')


def add_backlinks(lines):
    """Idempotentno: makni stare, dodaj po jedan ispod svakog naslova sesije."""
    out = []
    for line in (l for l in lines if not BACKLINK_RE.match(l.strip())):
        out.append(line)
        m = SESSION.match(line)
        if m and len(m.group(1)) >= 2:
            out.append(BACKLINK)
    return out


def sort_key(sid):
    m = re.match(r'S(\d+)([a-z]*)', sid)
    return (int(m.group(1)), m.group(2)) if m else (10**6, sid)


def clean_title(text):
    """Naslov sesije bez dvotocke (lomi sidro) i bez backtickova."""
    t = text.replace('`', '')
    t = re.sub(r'\s*:\s+', ' — ', t)
    return t.rstrip(':').strip()


def normalize(lines):
    out = list(lines)
    first = next(i for i, l in enumerate(out)
                 if l.startswith('# ') and SESSION.match(l))
    # blokovi: od svakog vrsnog naslova (sesija ili kontejner, razina 1-2) do sljedeceg
    tops = [i for i in range(first, len(out))
            if (SESSION.match(out[i]) and len(SESSION.match(out[i]).group(1)) <= 2)
            or CONTAINER.match(out[i])]
    tops.append(len(out))
    for a, b in zip(tops, tops[1:]):
        title = out[a].split(' ', 1)[1]
        out[a] = '## ' + (clean_title(title) if SESSION.match(out[a]) else title)
        subs = [i for i in range(a + 1, b) if HEAD.match(out[i])]
        if not subs:
            continue
        shift = max(0, 3 - min(len(HEAD.match(out[i]).group(1)) for i in subs))
        for i in subs:
            lvl = len(HEAD.match(out[i]).group(1)) + shift
            out[i] = '#' * min(lvl, 6) + ' ' + out[i].split(' ', 1)[1]
    # stare sesije prije regije (`##` S108/S109, `###` S106/S107x) -- samo dvotocka/backtick
    for i in range(first):
        m = SESSION.match(out[i])
        if m and len(m.group(1)) >= 2:
            out[i] = m.group(1) + ' ' + clean_title(out[i][len(m.group(1)) + 1:])
    return out


def sessions(lines, offset):
    seen, rows = set(), []
    for i, l in enumerate(lines):
        m = SESSION.match(l)
        if not m or len(m.group(1)) == 1:
            continue
        sid = m.group(2)
        if sid in seen:
            continue
        seen.add(sid)
        title = l[len(m.group(1)) + 1:].strip()
        d = DATE.search(title)
        uk = None
        for j in range(i + 1, min(i + 5, len(lines))):
            if lines[j].startswith('> Ukratko:'):
                uk = lines[j][len('> Ukratko:'):].strip()
                break
        has_line = uk is not None
        if uk is None:
            rest = title.split(sid, 1)[1]
            rest = re.sub(r'\s*\(\s*\d{4}-\d{2}-\d{2}\s*\)', '', rest)      # „(2026-10-04)"
            rest = re.sub(r'\(\s*\d{4}-\d{2}-\d{2}\s*[,;]\s*', '(', rest)   # „(2026-10-04, x)" -> „(x)"
            rest = DATE.sub('', rest)                                           # goli datum
            uk = rest.strip(' —-·:,').strip()
        rows.append((sort_key(sid), sid, d.group(1) if d else '', uk, title, i + 1 + offset, has_line))
    rows.sort()
    return rows


def build(lines, offset=0):
    rows = sessions(lines, offset)
    esc = lambda s: s.replace('|', '\\|')
    out = [BEGIN, '', '## Zadnje sesije', '']
    for _, sid, d, uk, title, n, _h in rows[-RECENT:]:
        out.append('- [%s](<#%s>) · r. %d — %s' % (sid + (' (' + d + ')' if d else ''), title, n, esc(uk)))
    out += ['', '## Dnevnik', '',
            '> Kronološki. Generirano: `python data-prep_tools/Tools/session_index.py --write`. '
            'Ukratko = redak `> Ukratko:` ispod naslova sesije, inače naslov.',
            '', '| sesija | datum | ukratko | r. |', '| --- | --- | --- | ---: |']
    for _, sid, d, uk, title, n, _h in rows:
        out.append('| [%s](<#%s>) | %s | %s | %d |' % (sid, title, d, esc(uk), n))
    out += ['', '_%d sesija._' % len(rows), '', END]
    return out


src = io.open(PATH, encoding='utf-8').read()
crlf = '\r\n' in src
src = src.replace('\r\n', '\n')
body = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n*', '', src, flags=re.S)
lines = body.split('\n')

if '--normalize' in sys.argv:
    before = sorted({SESSION.match(l).group(2) for l in lines if SESSION.match(l)})
    lines = normalize(lines)
    after = sorted({SESSION.match(l).group(2) for l in lines if SESSION.match(l)})
    h1 = [l for l in lines if l.startswith('# ')]
    if before != after or len(h1) != 1:
        sys.exit('/!\\ normalize: sesije prije %d, poslije %d, H1 naslova %d -- NISTA nije zapisano'
                 % (len(before), len(after), len(h1)))
    print('normalize: %d sesija nepromijenjeno, H1 ostao samo naslov filea' % len(after))

lines = add_backlinks(lines)

cut = next(i for i, l in enumerate(lines) if l.strip() == '---')
offset = len(build(lines)) + 1
index = build(lines, offset)
assert len(index) + 1 == offset, 'duljina bloka nije stabilna'
new = '\n'.join(lines[:cut] + index + [''] + lines[cut:])

if '--write' in sys.argv:
    if crlf:
        new = new.replace('\n', '\r\n')
    io.open(PATH, 'w', encoding='utf-8', newline='').write(new)
    rows = sessions(lines, offset)
    print('zapisano: %s (%d sesija)' % (PATH, len(rows)))
    # /!\ Ritual (CLAUDE.md, kraj sesije 5): zadnja sesija nosi `> Ukratko:` --
    #     jedna recenica za Sasin dnevnik. Bez nje dnevnik tiho pada na naslov.
    if not rows[-1][6]:
        print('/!\\ %s nema redak `> Ukratko:` ispod naslova -- dnevnik koristi naslov.' % rows[-1][1])
else:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print('\n'.join(index))
