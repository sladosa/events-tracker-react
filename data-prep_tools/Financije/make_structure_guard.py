# -*- coding: utf-8 -*-
"""
make_structure_guard.py  (S127)
================================================================================
Structure guard file za `make_financije_import.py` — IZ ŽIVE BAZE, ne iz Reviewa.

ZAŠTO POSTOJI
  `make_financije_import.py` odbija raditi bez `Financije_all_structure_*.xlsx`,
  i to s pravom: krivo ime atributa uvoz **tiho preskoči** (`excelImport.ts:836`
  radi lookup po `leafCategoryId||attrName` i nema `else`). Guard je jedina
  obrana od te rupe.

  Ali dosadašnji generator (`make_financije_all_structure.py`) gradi strukturu iz
  **Review workbooka** — snapshota od 08.07.2026. To je bilo točno kad je area
  tek nastajala; danas je area živa i mijenjala se (S118 poravnanje slugova,
  S124–S126 taksonomija). Guard koji provjerava protiv snapshota jamči da se
  file slaže s prošlošću, a uvozi se u sadašnjost.

  ⚠ Ovo je isti razred kao PROD slug trigger (S118): dvije baze nisu ista baza,
    pa se ponašanje utvrđuje pokusom nad ONOM u koju se piše. Zato ovaj alat
    poštuje `ET_TARGET` — guard za PROD uvoz nastaje iz PROD-a.

ŠTO NE RADI
  · ne piše ništa u bazu (samo čita `attribute_definitions`)
  · ne zamjenjuje `make_financije_all_structure.py` — onaj STVARA areu,
    ovaj samo opisuje onu koja postoji

Pokretanje:
    python make_structure_guard.py                    # TEST
    ET_TARGET=prod python make_structure_guard.py     # PROD
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from verify_rpc_vs_model import AREA_ID, ENV_FILE, Supa, load_env, target_banner  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "data-prep_data" / "Financije"


def main() -> None:
    print(f'\nSTRUCTURE GUARD   {target_banner()}')
    sp = Supa(load_env(ENV_FILE))

    area = sp._call(f'areas?id=eq.{AREA_ID}&select=name')
    if not area:
        sys.exit(f'✗ Area {AREA_ID} ne postoji u toj bazi.')
    area_name = area[0]['name']

    cats = sp._call(f'categories?area_id=eq.{AREA_ID}&select=id,name')
    if not cats:
        sys.exit('✗ Area nema kategorija — guard bi bio prazan, a prazan guard ne štiti ništa.')
    ids = ','.join(c['id'] for c in cats)
    by_id = {c['id']: c['name'] for c in cats}

    defs = sp._call(f'attribute_definitions?category_id=in.({ids})'
                    f'&select=name,data_type,category_id&order=sort_order')
    if not defs:
        sys.exit('✗ Nijedan atribut — v. gore.')

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Structure'
    # Zaglavlje je u 3. retku jer ga `read_structure_attrs` ondje traži
    # (`rows[2]`), a podaci od 4. — oblik app-ovog Structure exporta.
    ws.append([f'STRUCTURE — {area_name}  ({target_banner()})'])
    ws.append([f'generirano {dt.datetime.now():%Y-%m-%d %H:%M} iz ŽIVE baze'])
    ws.append(['Level', 'Type', 'Name', 'Category_Path', 'AttrName', 'AttrType'])
    for d in defs:
        ws.append([1, 'Attribute', by_id.get(d['category_id'], ''),
                   f"{area_name} > {by_id.get(d['category_id'], '')}",
                   d['name'], d['data_type']])

    ts = dt.datetime.now().strftime('%Y%m%d_%H%M%S')
    out = DATA / f'Financije_all_structure_{ts}.xlsx'
    wb.save(out)
    print(f'  area      : {area_name}')
    print(f'  atributi  : {len(defs)}')
    for d in defs:
        print(f'     {d["name"]:<16} {d["data_type"]}')
    print(f'\n  ✓ {out.name}')


if __name__ == '__main__':
    main()
