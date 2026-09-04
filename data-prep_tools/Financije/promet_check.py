# -*- coding: utf-8 -*-
"""
promet_check.py  (S128, 2026-09-04)
================================================================================
PROMET po izvodu, app vs banka — provjera koja NE prolazi kroz sidro.

--------------------------------------------------------------------------------
ZAŠTO POSTOJI (a `make_saldo_anchors.py --report` ne dostaje)

`--report` mjeri SALDO, a saldo ide kroz `rpc_area_balance_anchored` (`036`),
koja bira najnovije sidro `confirmed_on <= p_as_of` i zbraja promjene strogo
nakon njega. Stoji li sidro NA close datumu izvoda, `balance == amount` i Δ je
nula PO KONSTRUKCIJI. To je zamka 2 iz zaglavlja `make_saldo_anchors.py`
(„Prvo provjera, sidra poslije") — i u S127 se dogodila nama: sva 2024. sidra
upisana su PRIJE uvoza 2024., pa je `--report` nakon uvoza za svih 12 mjeseci
2024. ispisao `0.00 / SIDRO (nije provjera)` umjesto nalaza.

Ovaj alat zato mjeri samo PROMET u prozoru `(prev_close, close]`, preko
`rpc_area_group_agg` s `p_from`/`p_as_of`. Ta RPC za sidra **ne zna**, pa
brojka ne ovisi o tome je li mjesec zasidren.

⚠ Ne zamjenjuje `--report` nego ga dopunjuje: `--report` odgovara na „koliko app
pokazuje na taj dan", ovaj na „je li se u tom mjesecu dogodilo isto što i u
banci". Zasidren mjesec zna odgovoriti samo drugi.

--------------------------------------------------------------------------------
IZMJERENO (PROD, 2026-09-04, nakon uvoza 2023.+2024.)

  2024: 9/12 mjeseci u cent · odstupaju 2024-03 +10,00, 2024-07 −17,28,
        2024-10 −236,04 — točno predviđanje iz S127, u cent.
  2023: nema izvoda osim `ZABA_2023-12`, pa se promet nema s čim usporediti.

--------------------------------------------------------------------------------
Pokretanje (⚠ run.bat guši zarez — jedan argument po pozivu):

    Financije\run.bat promet_check.py
    Financije\run.bat promet_check.py --od=2024-01
    Financije\run.bat promet_check.py --do=2024-12

    ET_TARGET=prod ..\Tools\venv\Scripts\python.exe promet_check.py --od=2024-01

`--od`/`--do` filtriraju po oznaci izvoda (`YYYY-MM`), ne po datumu.
Alat NIŠTA ne piše u bazu.
"""
from __future__ import annotations

import sys

from make_saldo_anchors import EPS, GROUP_SLUG, GROUP_VALUE, printed_series
from verify_rpc_vs_model import (AREA_ID, ENV_FILE, FILTERS_IZVRSENO, Supa,
                                 eur, load_env, target_banner)

sys.stdout.reconfigure(encoding='utf-8')

SEP = '─' * 78


def promet(sp: Supa, od, do) -> tuple[float, int]:
    """Σ uplata − Σ isplata u prozoru `(od, do]`.

    ⚠ `p_from` je STROGO nakon — isto pravilo kao sidro (§2.17). Redak datiran
    na sam `od` pripada prethodnom prozoru; inače bi ušao u oba."""
    res = sp.rpc('rpc_area_group_agg', {
        'p_area_id': AREA_ID, 'p_group_slug': GROUP_SLUG,
        'p_plus_slug': 'uplata', 'p_minus_slug': 'isplata',
        'p_filters': FILTERS_IZVRSENO,
        'p_from': od.isoformat(), 'p_as_of': do.isoformat(),
    })
    for r in res or []:
        if r['group_value'] == GROUP_VALUE:
            return float(r['plus_sum']) - float(r['minus_sum']), int(r['n'])
    return 0.0, 0


def main() -> None:
    lo = hi = None
    for a in sys.argv[1:]:
        if a.startswith('--od='):
            lo = a[5:]
        elif a.startswith('--do='):
            hi = a[5:]
        else:
            sys.exit(f'✗ nepoznat argument: {a}  (--od=YYYY-MM | --do=YYYY-MM)')

    sp = Supa(load_env(ENV_FILE))
    series = printed_series()

    print(f'\nPROMET po izvodu — app vs banka (sidra NE sudjeluju)   {target_banner()}')
    print(SEP)
    print(f"{'izvod':<9} {'prozor':<25} {'app':>12} {'banka':>12} {'Δ':>10} {'n':>5}")
    print(SEP)

    ok = off = 0
    for prev, cur in zip(series, series[1:]):
        if (lo and cur['ym'] < lo) or (hi and cur['ym'] > hi):
            continue
        app, n = promet(sp, prev['close'], cur['close'])
        banka = cur['novo'] - cur['pocetno']
        d = app - banka
        if abs(d) < EPS:
            ok += 1
        else:
            off += 1
        print(f"{cur['ym']:<9} "
              f"{prev['close'].isoformat()}→{cur['close'].isoformat():<12} "
              f"{eur(app):>12} {eur(banka):>12} {eur(d):>10} {n:>5}"
              f"{'' if abs(d) < EPS else '   ✗'}")

    print(SEP)
    print(f'✓ u cent: {ok}   ·   razilazi se: {off}')
    if not ok and not off:
        print('\n⚠ Nijedan izvod u rasponu — provjeri `--od`/`--do` i sadržaj'
              '\n  `izvodi/Analizirani_izvodi/` (prvi ZABA izvod je 2023-12).')
    else:
        print('\nČitanje: Δ je promet MJESECA, ne nakupljeno stanje — ne ovisi o sidrima,'
              '\npa vrijedi i za zasidrene mjesece gdje `--report` po konstrukciji daje nulu.'
              '\nMjesec s Δ ≠ 0 se otvara `uskladi_izvod.py` nad tim izvodom.')


if __name__ == '__main__':
    main()
