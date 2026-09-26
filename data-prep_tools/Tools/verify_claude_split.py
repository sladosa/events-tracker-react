"""Dokaz da podjela CLAUDE.md-a nije izgubila nijedan redak.

Usporedi original (argument) s unijom: CLAUDE.md + e2e/CLAUDE.md + data-prep_tools/CLAUDE.md
+ docs/sessions/BACKLOG.md. Svaki neprazan redak originala mora se pojaviti bar onoliko puta
koliko u originalu. Ispis: sto fali (mora biti 0) i sto je novo (uputnice, zaglavlja).
    python data-prep_tools/Tools/verify_claude_split.py <original_CLAUDE.md>
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import Counter
FILES = ['CLAUDE.md', 'e2e/CLAUDE.md', 'data-prep_tools/CLAUDE.md', 'docs/sessions/BACKLOG.md']
def lines(p):
    return [l.rstrip() for l in open(p, encoding='utf-8').read().split('\n') if l.strip()]
orig = Counter(lines(sys.argv[1]))
new = Counter()
for f in FILES:
    new.update(lines(f))
missing = orig - new
extra = new - orig
# Sadrzaj (tablica) generira claude_index.py -- njeni retci se legitimno mijenjaju
missing = Counter({k: v for k, v in missing.items() if not k.startswith('| ') or '](<#' not in k})
missing.pop('_Ukupno' , None)
missing = Counter({k: v for k, v in missing.items() if not k.startswith('_Ukupno')})
print('Original: %d nepraznih redaka · nova unija: %d' % (sum(orig.values()), sum(new.values())))
print('FALI: %d' % sum(missing.values()))
for k in missing: print('   - ' + k[:110])
print('NOVO (uputnice/zaglavlja): %d' % sum(extra.values()))
for k in extra: print('   + ' + k[:110])
sys.exit(1 if missing else 0)
