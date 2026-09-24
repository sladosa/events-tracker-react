# -*- coding: utf-8 -*-
"""
visa_kosare.py  (S148, 2026-09-24)
==================================
Visa kosara po mjesecu naplate protiv PBZ naplate na RF-u — i, za mjesec koji
se ne slaze, redak po redak protiv PBZVISA izvoda.

Mjerenje iz S147 (skripta je tada stajala samo u scratchpadu): 16 mjeseci u cent
(2024-10 -> 2026-01), od 2026-02 razlika 6 od 7 mjeseci. Alat ostaje jer ce isti
broj trebati i POSLIJE popravka — kriterij je "svi mjeseci 0,00".

Pravila mjerenja (sva placena):
  * kosara = Visa retci grupirani po MJESECU `Datum naplate`, BRUTO `Isplata`.
    Zrcalni redak `PRIMLJENA UPLATA - HVALA` je `Uplata` s `Izvor = Visa` —
    u neto zbroju bi pokazao samo razliku umjesto zbroja (S147).
  * naplata = `Izvor = Racun` redak ciji `Izvod opis` (bez razmaka, velika
    slova) sadrzi `PBZCARD`, po mjesecu `event_date`.
  * izvod za naplatu u mjesecu M je PBZVISA_(M-1); glob `PBZVI[SZ]A_*` jer se
    jedan file zove `PBZVIZA_` (S137).
  * /!\ ET_TARGET: alat cita PROD SAMO uz `ET_TARGET=prod` — zaglavlje ispisa
    kaze koju bazu gleda; citaj ga PRIJE brojke (S137).

Pokretanje:
  $env:ET_TARGET='prod'; Financije\\run.bat visa_kosare.py            -> tablica
  $env:ET_TARGET='prod'; Financije\\run.bat visa_kosare.py 2026-02    -> + detalj
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from _db import ROOT, load_env  # noqa: E402
from uskladi_izvod import load_db  # noqa: E402

IZVODI = ROOT / 'data-prep_data' / 'Financije' / 'izvodi'
EPS = 0.005


def num(v) -> float:
    try:
        return round(float(v or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def ym_prev(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return f'{y:04d}-{m:02d}'


def naplata_ym(r) -> str | None:
    v = r['attrs'].get('Datum naplate')
    return str(v)[:7] if v else None


def is_pbzcard(r) -> bool:
    """Naplata Visa racuna na RF-u. `Izvod opis` s `PBZCARD` je potvrda; dok RF
    izvadak ne stigne, rucno upisana naplata nosi samo `Transfer/izmedju racuna`
    + komentar `Visa...` (S148: 07.09.2026. `Visa racun` 1.218,38). Bez ovoga je
    kosara izgledala kao da naplate NEMA, dok je bila u bazi."""
    a = r['attrs']
    io = str(a.get('Izvod opis') or '').replace(' ', '').upper()
    if 'PBZCARD' in io:
        return True
    return (not io and a.get('Racun') == 'Sašin tekući RF' and a.get('Tip') == 'Transfer'
            and a.get('Podtip') == 'izmedju racuna'
            and str(r.get('comment') or '').strip().lower().startswith('visa'))


def kosare(rows):
    visa = [r for r in rows if r['attrs'].get('Izvor') == 'Visa']
    kos = defaultdict(list)
    for r in visa:
        ym = naplata_ym(r)
        if ym:
            kos[ym].append(r)
    nap = defaultdict(list)
    for r in rows:
        if r['attrs'].get('Izvor') == 'Racun' and is_pbzcard(r) and num(r['attrs'].get('Isplata')):
            nap[r['event_date'][:7]].append(r)
    bez = [r for r in visa if not naplata_ym(r)]
    return kos, nap, bez


def find_izvod(ym: str) -> Path | None:
    for p in sorted(IZVODI.rglob('PBZVI*A_' + ym + '*.pdf')):
        if re.match(r'PBZVI[SZ]A_', p.name) and 'duplikati' not in p.parts:
            return p
    return None


def tablica(kos, nap, od='2024-10'):
    print(f'{"naplata":8} {"n":>4} {"Σ košara":>11} {"PBZ naplata":>12} {"razlika":>10}  izvod')
    for ym in sorted(set(kos) | set(nap)):
        if ym < od:
            continue
        s = sum(num(r['attrs'].get('Isplata')) for r in kos.get(ym, []))
        n = sum(num(r['attrs'].get('Isplata')) for r in nap.get(ym, []))
        d = round(s - n, 2)
        iz = find_izvod(ym_prev(ym))
        flag = '' if abs(d) < EPS else '  <<<'
        print(f'{ym:8} {len(kos.get(ym, [])):4} {s:11.2f} {n:12.2f} {d:10.2f}  '
              f'{iz.name if iz else "-"}{flag}')


def detalj(ym, kos, nap):
    from enrich_from_izvoda import parse_pbz_visa
    iz = find_izvod(ym_prev(ym))
    print(f'\n=== {ym}: izvod {iz.name if iz else "NEMA"} ===')
    for r in nap.get(ym, []):
        print(f'  RF naplata {r["event_date"]}  {num(r["attrs"].get("Isplata")):.2f}')
    if not iz:
        return
    tx = parse_pbz_visa(iz)
    isp = [t for t in tx if t['smjer'] == 'Isplata']
    print(f'  izvod: {len(isp)} isplata, Σ {sum(t["iznos"] for t in isp):.2f}; '
          f'uplate: ' + ', '.join(f'{t["opis"][:30]} {t["iznos"]:.2f}'
                                  for t in tx if t['smjer'] == 'Uplata'))
    baza = [r for r in kos.get(ym, []) if num(r['attrs'].get('Isplata'))]
    # sparivanje: iznos tocno, najblizi datum
    slob = list(baza)
    nesp_iz = []
    for t in sorted(isp, key=lambda t: t['date']):
        kand = [r for r in slob if abs(num(r['attrs'].get('Isplata')) - t['iznos']) < EPS]
        if not kand:
            nesp_iz.append(t)
            continue
        kand.sort(key=lambda r: abs((__import__('datetime').date.fromisoformat(r['event_date'])
                                     - t['date']).days))
        slob.remove(kand[0])
    print(f'\n  NA IZVODU, NEMA U KOŠARI ({len(nesp_iz)}, Σ {sum(t["iznos"] for t in nesp_iz):.2f}):')
    for t in nesp_iz:
        print(f'    {t["date"]}  {t["iznos"]:9.2f}  {t["opis"][:70]}')
    print(f'\n  U KOŠARI, NEMA NA IZVODU ({len(slob)}, '
          f'Σ {sum(num(r["attrs"].get("Isplata")) for r in slob):.2f}):')
    for r in sorted(slob, key=lambda r: r['event_date']):
        a = r['attrs']
        print(f'    {r["event_date"]}  {num(a.get("Isplata")):9.2f}  st={a.get("Status")} '
              f'rata={a.get("Rata br")}/{a.get("Broj rata")}  io={str(a.get("Izvod opis") or "")[:40]!r} '
              f'kom={str(r.get("comment") or "")[:40]!r}  id={r["id"][:8]}')


def main():
    target = os.environ.get('ET_TARGET', 'test').strip().lower()
    url, key = load_env(target)
    print(f'[{target.upper()}] {url}')
    rows = load_db(url, key)
    kos, nap, bez = kosare(rows)
    print(f'retci: {len(rows)}; Visa bez Datum naplate: {len(bez)}\n')
    tablica(kos, nap)
    for ym in sys.argv[1:]:
        detalj(ym, kos, nap)


if __name__ == '__main__':
    main()
