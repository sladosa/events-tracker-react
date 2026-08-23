# -*- coding: utf-8 -*-
"""
set_list_columns.py  (S116, 2026-08-23)
================================================================================
Upisuje `areas.settings.list_columns` za `Financije_all` (TEST).

ZAŠTO SKRIPTA, KAD JE PRINCIP „SVE IDE IMPORTOM"
  Ide i importom — `ListColumns` sheet u Structure exportu. Ovo je alat za PRVI
  upis i za PROD (gdje Structure import ide pod Kokinim računom, pa je brže
  upisati config izravno nego joj slati file). Oblik je isti u oba puta.

⚠ MERGE, NE OVERWRITE. `settings` nosi i `dashboard`, `automations`,
  `export_profiles`, `comment_template`. Zapis cijelog objekta bi pobrisao rata
  modal — isti razlog zbog kojeg `structureImport.ts` svugdje radi `{ ...existing }`.

Pokretanje:
    python set_list_columns.py --show      # samo ispiši što je sada u bazi
    python set_list_columns.py --write     # upiši
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from verify_rpc_vs_model import AREA_ID, ENV_FILE, Supa, load_env

sys.stdout.reconfigure(encoding='utf-8')

# Redoslijed je Sašin (CLAUDE.md Backlog): Datum | Smjer + iznos | Tip / Podtip |
# Opis | ⋮.  `balance` i `user` su dodani jer već postoje i ne smiju nestati:
# `Stanje` je §2.12 instrument za traženje greške, `User` se ionako prikazuje
# samo kad je Area podijeljena.
COLUMNS = [
    {'role': 'date', 'label': 'Datum', 'width': 'w-28', 'mobile': 'line1'},
    # Tip i Podtip su JEDNA kolona — dvije bi na uskom ekranu pojele Opis.
    {'role': 'pair', 'label': 'Iznos', 'plus': 'uplata', 'minus': 'isplata',
     'unit': '€', 'width': 'w-36', 'mobile': 'line1'},
    {'role': 'attr', 'label': 'Tip / Podtip', 'slugs': ['tip', 'podtip'],
     'sep': ' / ', 'mobile': 'line2'},
    {'role': 'comment', 'label': 'Opis', 'mobile': 'line2'},
    {'role': 'user', 'mobile': 'line1'},
    {'role': 'balance', 'label': 'Stanje', 'unit': '€', 'width': 'w-28', 'mobile': 'hide'},
    {'role': 'actions'},
]

# Svaki slug mora postojati u Arei — kolona koja pokazuje prazno jer je slug
# krivo napisan izgleda točno kao kolona koja pokazuje prazno jer podatka nema.
def check_slugs(sp: Supa) -> None:
    cats = sp.select_all(f'categories?area_id=eq.{AREA_ID}&select=id&order=id')
    ids = {c['id'] for c in cats}
    defs = sp.select_all('attribute_definitions?select=slug,category_id&order=id')
    have = {d['slug'] for d in defs if d['category_id'] in ids}

    wanted = set()
    for c in COLUMNS:
        for k in ('plus', 'minus'):
            if c.get(k):
                wanted.add(c[k])
        wanted.update(c.get('slugs', []))

    missing = sorted(wanted - have)
    if missing:
        sys.exit(f'✗ Slugovi kojih u Arei nema: {missing}\n  Postojeći: {sorted(have)}')
    print(f'✓ svi slugovi postoje: {sorted(wanted)}')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--show', action='store_true')
    args = ap.parse_args()

    sp = Supa(load_env(ENV_FILE))
    area = sp.select_all(f'areas?id=eq.{AREA_ID}&select=name,settings&order=id')[0]
    settings = area['settings'] or {}

    print(f"Area: {area['name']}")
    print('settings ključevi:', sorted(settings.keys()))
    print('\nlist_columns SADA:')
    print(json.dumps(settings.get('list_columns'), ensure_ascii=False, indent=2))

    if args.show or not args.write:
        print('\nlist_columns KOJE BI UPISAO:')
        print(json.dumps({'columns': COLUMNS}, ensure_ascii=False, indent=2))
        print('\n(ništa nije upisano — dodaj --write)')
        return

    check_slugs(sp)
    merged = {**settings, 'list_columns': {'columns': COLUMNS}}
    got = sp._call(f'areas?id=eq.{AREA_ID}&select=id', method='PATCH',
                   body={'settings': merged},
                   extra={'Prefer': 'return=representation'})
    if not got:
        sys.exit('✗ PATCH je vratio 0 redaka — ništa nije upisano.')
    print(f'\n✓ Upisano. Ostali ključevi netaknuti: {sorted(k for k in merged if k != "list_columns")}')


if __name__ == '__main__':
    main()
