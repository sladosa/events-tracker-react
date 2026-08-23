# -*- coding: utf-8 -*-
"""
anchors.py  (S116, 2026-08-23)
================================================================================
POPIS I BRISANJE SIDARA (`balance_anchors`) — ono što aplikacija još ne zna.

ZAŠTO POSTOJI
  `overviewApi.ts` ima `listAnchors()` i `deleteAnchor()` i **nitko ih ne zove**
  (CLAUDE.md, Backlog). Sidro upisano s krivim datumom ili krivim iznosom se
  zato danas „ispravlja" samo NOVIM retkom — a to ne pomaže:

      `036` bira NAJNOVIJE sidro s `confirmed_on <= p_as_of`.

  Novo sidro na STARIJI datum dakle ne poništava krivo na novijem; krivo i dalje
  pobjeđuje. Dogodilo se dvaput u pet sesija (S111 tipfeler `3.453,03`,
  S115 krivi datum `22.08.`), pa ovo više nije jednokratni promašaj nego
  izostanak koraka.

  `make_saldo_anchors.py` je namjerno append-only i čita PDF — on je alat za
  UPIS ispisanog stanja. Ovo je alat za POGLED i ISPRAVAK, i zato je odvojen.

ŠTO NE RADI
  • ne upisuje sidra (to je `make_saldo_anchors.py --anchor`, iz PDF-a)
  • ne dira evente

Pokretanje:
    python anchors.py                      # popis, uz oznaku koje sidro danas vrijedi
    python anchors.py --as-of 2026-07-30   # koje bi sidro vrijedilo na taj dan
    python anchors.py --delete <uuid>      # brisanje, uz potvrdu da je redak stvarno nestao
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date, datetime

sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))

from verify_rpc_vs_model import AREA_ID, ENV_FILE, Supa, eur, load_env

sys.stdout.reconfigure(encoding='utf-8')

SEP = '─' * 100


def fetch(sp: Supa) -> list[dict]:
    return sp.select_all(
        f'balance_anchors?area_id=eq.{AREA_ID}'
        f'&select=id,group_slug,group_value,amount,confirmed_on,note,created_at'
        f'&order=id')


def cmd_list(sp: Supa, as_of: date) -> None:
    rows = fetch(sp)
    if not rows:
        print('Nema nijednog sidra za ovu Areu.')
        return

    by_group: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        by_group[(r['group_slug'], r['group_value'])].append(r)

    print(f'\nSIDRA — area {AREA_ID}   ·   ukupno {len(rows)}'
          f'   ·   „vrijedi" se računa za {as_of.isoformat()}')

    for (slug, value), group in sorted(by_group.items()):
        group.sort(key=lambda r: r['confirmed_on'])
        # Isto pravilo koje primjenjuje `036`: najnovije sidro <= as_of.
        active = None
        for r in group:
            if datetime.fromisoformat(r['confirmed_on']).date() <= as_of:
                active = r['id']

        print(SEP)
        print(f'{slug} = {value}   ({len(group)} sidara)')
        print(SEP)
        print(f"{'':<2} {'confirmed_on':<13} {'iznos':>12}  {'id':<38} bilješka")
        for r in group:
            mark = '►' if r['id'] == active else ' '
            note = r['note'] or '⚠ bez podrijetla'
            print(f"{mark:<2} {r['confirmed_on']:<13} {eur(float(r['amount'])):>12}  "
                  f"{r['id']:<38} {note}")
        if active is None:
            print('   ⚠ nijedno sidro ne vrijedi na taj dan — saldo se računa od početka podataka')

    print(SEP)
    print('► = sidro koje `rpc_area_balance_anchored` koristi na zadani dan.')
    print('Sidro ISPOD ► je mrtvo slovo; sidro IZNAD ► pobjeđuje čim as_of dođe do njega.')


def cmd_delete(sp: Supa, anchor_id: str) -> None:
    rows = fetch(sp)
    target = next((r for r in rows if r['id'] == anchor_id), None)
    if target is None:
        sys.exit(f'✗ Sidro {anchor_id} nije u ovoj Arei — ništa nije obrisano.')

    print(f"Brišem:  {target['confirmed_on']}  {eur(float(target['amount']))}  "
          f"{target['group_value']}\n         {target['note'] or '(bez bilješke)'}")

    # ⚠ RLS-blokiran DELETE „uspije" s 0 redaka (CLAUDE.md). Bez `select=id`
    # i provjere praznog odgovora, brisanje izgleda kao da je prošlo.
    got = sp._call(f'balance_anchors?id=eq.{anchor_id}&select=id',
                   method='DELETE', extra={'Prefer': 'return=representation'})
    if not got:
        sys.exit('✗ DELETE je vratio 0 redaka — sidro NIJE obrisano (RLS?).')
    print(f'✓ Obrisano ({len(got)} redak).')


def main() -> None:
    ap = argparse.ArgumentParser(description='Popis i brisanje sidara salda.')
    ap.add_argument('--delete', metavar='UUID', help='obriši sidro po id-u')
    ap.add_argument('--as-of', metavar='YYYY-MM-DD',
                    help='dan za koji se računa koje sidro vrijedi (zadano: danas)')
    args = ap.parse_args()

    sp = Supa(load_env(ENV_FILE))
    if args.delete:
        cmd_delete(sp, args.delete)
        print()
    as_of = datetime.fromisoformat(args.as_of).date() if args.as_of else date.today()
    cmd_list(sp, as_of)


if __name__ == '__main__':
    main()
