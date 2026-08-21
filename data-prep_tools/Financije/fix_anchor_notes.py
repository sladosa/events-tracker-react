# -*- coding: utf-8 -*-
"""
fix_anchor_notes.py  (S113, 2026-08-21)
=======================================
Jednokratno: sve bilješke sidara (`balance_anchors.note`) na JEDAN oblik —
`<kategorija> · <detalj>`, kategorija iz istog zatvorenog popisa koji nudi
pločica (v. `BalanceByGroupTile.tsx`).

ZAŠTO: bilješka postoji da odgovori na jedno pitanje — je li potvrđeno stanje
došlo IZVANA (OVERVIEW_TAB_SPEC §2.17). Odgovor koji se svaki put drukčije
napiše ne da se ni grupirati ni prebrojati, a `NULL` je dvosmislen: ne razlikuje
„staro sidro" od „nitko nije naveo".

⚠ Skripta NE POGAĐA podrijetlo. Sidro za koje se ne zna odakle je dobiva
doslovno `nije navedeno` — to je istina, a izmišljen izvor bi bio gori od
praznog polja.

Pokretanje:  run.bat fix_anchor_notes.py [--dry]
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.stdout.reconfigure(encoding='utf-8')

from verify_rpc_vs_model import ENV_FILE, Supa, load_env  # noqa: E402

STATEMENT = 'ispisano stanje s izvoda'
UNKNOWN   = 'nije navedeno'

# Stari oblik koji je pisao make_saldo_anchors.py do S113.
RE_OLD = re.compile(r'ispisano NOVO STANJE,\s*([^\s(]+)', re.I)

# Sidra bez bilješke kojima podrijetlo ZNAMO iz sesijskih zapisa. Sve ostalo
# ide u `nije navedeno` — ključ je (group_value, confirmed_on).
KNOWN = {
    ('Sašin tekući RF', '2026-08-11'): f'{STATEMENT} · RF_2026-07.pdf',
}


def target_note(row: dict) -> str | None:
    note = (row.get('note') or '').strip()
    if note:
        m = RE_OLD.search(note)
        if m:
            return f'{STATEMENT} · {m.group(1)}'
        return None                      # već u novom obliku ili ručno pisano
    return KNOWN.get((row['group_value'], row['confirmed_on']), UNKNOWN)


def main() -> None:
    dry = '--dry' in sys.argv
    sb = Supa(load_env(ENV_FILE))
    rows = sb.select_all('balance_anchors?select=id,group_value,amount,confirmed_on,note'
                         '&order=confirmed_on')
    changed = 0
    for r in rows:
        new = target_note(r)
        if new is None or new == (r.get('note') or ''):
            print(f'  = {r["confirmed_on"]}  {r["group_value"]:<20} {r.get("note")!r}')
            continue
        print(f'  → {r["confirmed_on"]}  {r["group_value"]:<20} {r.get("note")!r}\n'
              f'      → {new!r}')
        changed += 1
        if not dry:
            sb._call(f'balance_anchors?id=eq.{r["id"]}', method='PATCH', body={'note': new})

    print(f'\n{changed} od {len(rows)} sidara {"bi se promijenilo" if dry else "promijenjeno"}.')
    if dry:
        print('--dry: ništa nije zapisano.')


if __name__ == '__main__':
    main()
