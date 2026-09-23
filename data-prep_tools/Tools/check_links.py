# -*- coding: utf-8 -*-
"""Provjeri pokazuju li relativni linkovi u dokumentaciji na postojece fileove.

Ritual (CLAUDE.md, End of session korak 3): arhiviranje PREMJESTA file, a link
ostaje -- i mrtav link se cita kao „tog dokaza vise nema", dok je dokaz na disku.
Zamka je zapisana u S139 (21 od 30 linkova pokazivalo u prazno), popravljena je
rucno vec dvaput, i **vratila se oba puta** (S133/S138/S139 linkovi nadjeni
mrtvi u S146). Zato brana, ne disciplina.

Pokretanje iz korijena projekta:
    python data-prep_tools/Tools/check_links.py
    python data-prep_tools/Tools/check_links.py --fix   # preusmjeri u arhivu

Izlaz: 0 = svi linkovi zivi, 1 = ima mrtvih.

/!\ NE ZOVE SE SAMO RUCNO. Zovu ga i `audit_tests.py` (ondje se steta i radja --
    arhiviranje) i `claude_index.py --write` (dovrsava CLAUDE.md). Zato su
    `find_dead()` i `report()` uvozive funkcije: dvije kopije iste provjere
    znace da se jednog dana raziđu (pravilo `canUpdateExisting()`, S125).

/!\ Windows konzola je cp1252 -- bez reconfigure alat pada na prvom nelatinicnom
    znaku prije nego ispise ijedan redak (isti razred kao audit_tests.py).
"""
import io
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# [tekst](meta) -- i oblik <...> koji Obsidian koristi za sidra s razmacima
LINK = re.compile(r'\[[^\]^]*\]\(\s*(<[^>]*>|[^)\s]+)\s*\)')

# /!\ venv i node_modules nose tudju dokumentaciju s vlastitim mrtvim linkovima
#     (izmjereno: 5 od 6 pogodaka prije nego su iskljuceni). Brana koja od prvog
#     dana javlja tudje kvarove nauci se otklikati -- pa onda ne vidi ni nas.
SKIP_PARTS = {'node_modules', '.git', 'dist', 'venv', 'site-packages',
              'playwright-report', 'test-results', '__pycache__'}

ROOTS = ['docs', 'sql']
FILES = ['CLAUDE.md', 'NEXT_SESSION_PROMPT.md', 'README.md']

ARCHIVE = Path('Claude-temp_R/test-sessions/archive')
ARCHIVE_REL = '../../Claude-temp_R/test-sessions/archive/'
TESTS_LINK = re.compile(r'\]\(tests/(S[0-9]+[a-z]*_tests\.md)\)')


def collect():
    """Svi markdown fileovi koje provjeravamo, bez tudjih stabala."""
    out = []
    for f in FILES:
        p = Path(f)
        if p.exists():
            out.append(p)
    for r in ROOTS:
        root = Path(r)
        if not root.exists():
            continue
        for p in root.rglob('*.md'):
            if SKIP_PARTS & set(p.parts):
                continue
            out.append(p)
    return sorted(set(out))


def targets(text):
    for raw in LINK.findall(text):
        t = raw.strip()
        if t.startswith('<') and t.endswith('>'):
            t = t[1:-1]
        if t.startswith(('http://', 'https://', 'mailto:', '#')):
            continue
        t = t.split('#')[0].strip()
        if t:
            yield t


def find_dead(paths=None):
    """-> (broj provjerenih linkova, [(file, target), ...])."""
    paths = collect() if paths is None else paths
    total = 0
    dead = []
    for md in paths:
        text = io.open(md, encoding='utf-8', errors='replace').read()
        for t in targets(text):
            total += 1
            if not (md.parent / t).exists():
                dead.append((str(md), t))
    return total, dead


def fix_archive_links(paths=None):
    """Preusmjeri ](tests/SXX_tests.md) na arhivu, ali SAMO ako file ondje je."""
    paths = collect() if paths is None else paths
    fixed = 0
    for md in paths:
        text = io.open(md, encoding='utf-8').read()
        new = text
        for name in sorted(set(TESTS_LINK.findall(text))):
            if (md.parent / 'tests' / name).exists():
                continue
            if not (ARCHIVE / name).exists():
                continue
            old = '](tests/%s)' % name
            new = new.replace(old, '](%s%s)' % (ARCHIVE_REL, name))
            fixed += text.count(old)
        if new != text:
            io.open(md, 'w', encoding='utf-8', newline='').write(new)
    return fixed


def report(prefix='', quiet_when_clean=False):
    """Ispis za domacina. -> broj mrtvih (0 = cisto).

    `quiet_when_clean` je za alate koji vec imaju svoj ispis: tisina kad je
    cisto, glasno kad nije. /!\\ Nikad obrnuto -- brana koja se javlja svaki
    put kad je sve u redu nauci se preskakati.
    """
    total, dead = find_dead()
    if not dead:
        if not quiet_when_clean:
            print('%sLinkovi: %d provjereno, mrtvih NEMA' % (prefix, total))
        return 0
    print()
    print('%s/!\\ MRTVIH LINKOVA: %d  (od %d)' % (prefix, len(dead), total))
    for f, t in sorted(set(dead)):
        hint = ''
        name = t.rsplit('/', 1)[-1]
        if (ARCHIVE / name).exists():
            hint = '   <- u arhivi je, probaj --fix'
        print('%s  %s' % (prefix, f))
        print('%s      %s%s' % (prefix, t, hint))
    print('%s  => python data-prep_tools/Tools/check_links.py --fix' % prefix)
    return len(dead)


def main():
    if '--fix' in sys.argv:
        print('Preusmjereno u arhivu: %d' % fix_archive_links())
    total, dead = find_dead()
    print('Fileova: %d   ·   relativnih linkova: %d' % (len(collect()), total))
    if not dead:
        print('Mrtvih: NEMA')
        return 0
    report()
    return 1


if __name__ == '__main__':
    sys.exit(main())
