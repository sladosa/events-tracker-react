# -*- coding: utf-8 -*-
"""Uskladi `PENDING_TESTS.md` s fajlovima u `docs/sessions/tests/`.

Ritual kaze: session file ciji su SVI testovi ✅ ide u arhivu. Kriterij se nije
dao primijeniti jer kurirani redak „Otvoreno:" i ⬜ oznake u tijelu navode
razlicite skupove. Ovo to prebrojava umjesto da procjenjuje.
"""
import io
import re
from pathlib import Path
from collections import defaultdict

TESTS = Path('docs/sessions/tests')
PENDING = Path('docs/sessions/PENDING_TESTS.md')

ID = re.compile(r'T-S[0-9]+[a-z]?-[0-9]+')

# --- testovi definirani po session fileu ---
defined = {}
for f in sorted(TESTS.glob('S*_tests.md')):
    txt = io.open(f, encoding='utf-8').read()
    ids = set()
    for m in ID.finditer(txt):
        ids.add(m.group(0))
    defined[f.name] = ids

# --- status iz PENDING_TESTS: gledaju se SAMO tablicni retci ---
pend = io.open(PENDING, encoding='utf-8').read()
status = {}
for line in pend.splitlines():
    if not line.startswith('|'):
        continue
    cells = [c.strip() for c in line.strip('|').split('|')]
    if len(cells) < 2:
        continue
    m = ID.fullmatch(cells[0].replace('*', '').replace('~', '').strip())
    if not m:
        continue
    last = cells[-1]
    if '✅' in last:
        st = 'done'
    elif '⬜' in last:
        st = 'open'
    elif last.strip() in ('—', '-', ''):
        st = 'dropped'
    else:
        st = 'other:' + last[:30]
    status[m.group(0)] = st

# --- kurirani redak „Otvoreno:" ---
curated = set()
for line in pend.splitlines():
    if line.startswith('**Otvoreno:'):
        curated = set(ID.findall(line))
        break

print('=' * 78)
print('%-22s %5s %5s %5s %5s  %s' % ('session file', 'def', '✅', '⬜', 'n/a', 'arhivirati?'))
print('=' * 78)
archivable, blocked, unknown_total = [], [], 0
for name, ids in defined.items():
    if not ids:
        continue
    done = sum(1 for i in ids if status.get(i) == 'done')
    open_ = sum(1 for i in ids if status.get(i) == 'open')
    na = sum(1 for i in ids if i not in status)
    unknown_total += na
    verdict = ''
    if open_ == 0 and na == 0:
        verdict = 'DA'
        archivable.append(name)
    elif na:
        verdict = '? %d bez oznake u PENDING' % na
        blocked.append(name)
    else:
        verdict = 'ne (%d otvorenih)' % open_
        blocked.append(name)
    print('%-22s %5d %5d %5d %5d  %s' % (name, len(ids), done, open_, na, verdict))

print('=' * 78)
print('Za arhivu (%d): %s' % (len(archivable), ', '.join(archivable) or '—'))
print('Testova koje PENDING uopce ne spominje: %d' % unknown_total)

# --- proturjecnost: kurirani redak vs tablice ---
open_in_tables = {i for i, st in status.items() if st == 'open'}
only_curated = curated - open_in_tables
only_tables = open_in_tables - curated
print()
print('PROTURJECNOST u PENDING_TESTS.md')
print('  „Otvoreno:" navodi, a tablica ne kaze ⬜ : %d  %s'
      % (len(only_curated), sorted(only_curated)[:12]))
print('  tablica kaze ⬜, a „Otvoreno:" ne navodi : %d  %s'
      % (len(only_tables), sorted(only_tables)[:12]))
