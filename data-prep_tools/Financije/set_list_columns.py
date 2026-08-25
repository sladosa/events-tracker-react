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
# ⚠ RACUN JE NA LINIJI 1, I TO KRATICOM (S119, Sašin zahtjev)
#   Puno ime (`Kokin tekući ZABA`) pojede prostor koji na uskom ekranu treba
#   iznosu — izmjereno: na 320 px linija 1 stane tek s kraticom i kratkim
#   datumom. Vrijednost koje u `map` nema prikaže se CIJELA: preimenovan račun
#   tada izgleda neskraćeno (vidljivo), nikad kao KRIVI račun (nevidljivo).
RACUN_MAP = {
    'Kokin tekući ZABA': 'ZABA',
    'Sašin tekući RF': 'RF',
}

COLUMNS = [
    {'role': 'date', 'label': 'Datum', 'width': 'w-28', 'mobile': 'line1'},
    {'role': 'attr', 'label': 'Račun', 'slugs': ['racun'], 'map': RACUN_MAP,
     'width': 'w-32', 'mobile': 'line1'},
    # Tip i Podtip su JEDNA kolona — dvije bi na uskom ekranu pojele Opis.
    {'role': 'pair', 'label': 'Iznos', 'plus': 'uplata', 'minus': 'isplata',
     'unit': '€', 'width': 'w-36', 'mobile': 'line1'},
    {'role': 'attr', 'label': 'Tip/Podtip', 'slugs': ['tip', 'podtip'],
     'sep': '/', 'mobile': 'line2'},
    {'role': 'comment', 'label': 'Opis', 'mobile': 'line2'},
    {'role': 'user', 'mobile': 'line1'},
    {'role': 'balance', 'label': 'Stanje', 'unit': '€', 'width': 'w-28', 'mobile': 'hide'},
    {'role': 'actions'},
]

# Svaki slug mora postojati u Arei — kolona koja pokazuje prazno jer je slug
# krivo napisan izgleda točno kao kolona koja pokazuje prazno jer podatka nema.
def check_slugs(sp: Supa, area_id: str = AREA_ID) -> None:
    cats = sp.select_all(f'categories?area_id=eq.{area_id}&select=id&order=id')
    ids = {c['id'] for c in cats}
    defs = sp.select_all('attribute_definitions?select=slug,category_id&order=id')
    have = {d['slug'] for d in defs if d['category_id'] in ids}

    wanted = set()
    for c in COLUMNS:
        for k in ('plus', 'minus'):
            if c.get(k):
                wanted.add(c[k])
        wanted.update(c.get('slugs', []))
        # `map` se ne provjerava protiv baze ovdje — ključevi su VRIJEDNOSTI
        # atributa, ne slugovi. Provjera je u --show ispisu (v. warn_map_values).


    missing = sorted(wanted - have)
    if missing:
        sys.exit(f'✗ Slugovi kojih u Arei nema: {missing}\n  Postojeći: {sorted(have)}')
    print(f'✓ svi slugovi postoje: {sorted(wanted)}')


def warn_map_values(sp: Supa, area_id: str) -> None:
    """Kratica za vrijednost koja u bazi ne postoji je mrtvo slovo — ne ruši
    ništa, ali ni ne radi ništa, a izgleda kao da radi. Zato se ispisuje."""
    cats = sp.select_all(f'categories?area_id=eq.{area_id}&select=id&order=id')
    ids = {c['id'] for c in cats}
    defs = [d for d in sp.select_all('attribute_definitions?select=id,slug,category_id&order=id')
            if d['category_id'] in ids]
    for col in COLUMNS:
        if not col.get('map'):
            continue
        for slug in col.get('slugs', []):
            did = next((d['id'] for d in defs if d['slug'] == slug), None)
            if not did:
                continue
            vals = {r['value_text'] for r in sp.select_all(
                f'event_attributes?attribute_definition_id=eq.{did}&select=value_text&order=id')
                if r.get('value_text')}
            unknown = sorted(k for k in col['map'] if k not in vals)
            missing = sorted(v for v in vals if v not in col['map'])
            print()
            print(f"kratice za `{slug}`:")
            for k, v in col['map'].items():
                print(f"   {k}  ->  {v}" + ('   ⚠ te vrijednosti nema u bazi' if k in unknown else ''))
            for v in missing:
                print(f"   {v}  ->  (bez kratice, prikazuje se cijelo)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--show', action='store_true')
    # ⚠ Zadano je i dalje TEST. PROD se traži IZRIČITO, u dva polja koja se
    #   moraju složiti — kriva kombinacija (PROD env + TEST area id) vrati
    #   prazan rezultat, a ne tihi upis u krivu bazu.
    ap.add_argument('--env', choices=['test', 'prod'], default='test',
                    help='test = .env.local (zadano), prod = .env.prod.local')
    ap.add_argument('--area', default=AREA_ID, help='area id (zadano: Financije_all TEST)')
    args = ap.parse_args()

    env_file = ENV_FILE if args.env == 'test' else ENV_FILE.parent / '.env.prod.local'
    if not env_file.exists():
        sys.exit(f'✗ Nema env filea: {env_file}')
    area_id = args.area

    sp = Supa(load_env(env_file))
    print(f'Baza: {args.env.upper()}  ({env_file.name})')
    rows = sp.select_all(f'areas?id=eq.{area_id}&select=name,settings&order=id')
    if not rows:
        sys.exit(f'✗ Area {area_id} ne postoji u {args.env.upper()} bazi — provjeri --env i --area.')
    area = rows[0]
    settings = area['settings'] or {}

    print(f"Area: {area['name']}")
    print('settings ključevi:', sorted(settings.keys()))
    print('\nlist_columns SADA:')
    print(json.dumps(settings.get('list_columns'), ensure_ascii=False, indent=2))

    warn_map_values(sp, area_id)

    if args.show or not args.write:
        print('\nlist_columns KOJE BI UPISAO:')
        print(json.dumps({'columns': COLUMNS}, ensure_ascii=False, indent=2))
        print('\n(ništa nije upisano — dodaj --write)')
        return

    check_slugs(sp, area_id)
    merged = {**settings, 'list_columns': {'columns': COLUMNS}}
    got = sp._call(f'areas?id=eq.{area_id}&select=id', method='PATCH',
                   body={'settings': merged},
                   extra={'Prefer': 'return=representation'})
    if not got:
        sys.exit('✗ PATCH je vratio 0 redaka — ništa nije upisano.')
    print(f'\n✓ Upisano. Ostali ključevi netaknuti: {sorted(k for k in merged if k != "list_columns")}')


if __name__ == '__main__':
    main()
