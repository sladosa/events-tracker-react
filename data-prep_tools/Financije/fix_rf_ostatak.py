# -*- coding: utf-8 -*-
"""
fix_rf_ostatak.py  (S111, 2026-08-18)
================================================================================
ZATVARA OSTATAK NA `Sasin tekuci RF` nakon fix_rf_duplikati.py.

Spec: docs/OVERVIEW_TAB_SPEC.md §2.10 (sto mice saldo, ukljucujuci Cash pravilo)

Dva zahvata, oba dokazana protiv ISPISANOG izvoda (RF_2024-12 … RF_2026-06):

  A) BRISE 4 Kokina retka bez opisa kojima banka nema protustavku
     -20,00 (07.10.2025) · -1,32 (04.04.2025) · -0,11 (02.07.2026) · +1,15 (18.03.2025)
     Svi postoje u Kokinoj Excelici, nijedan na izvodu. Njen lanac i bankov se
     razlikuju redak po redak a slazu u zbroju — visak ovdje ima kompenzaciju
     drugdje (npr. Mirovina 908,64 umjesto bankovnih 882,94, vec rijeseno).
     Za RF racun izvod je potpun i autoritativan: 196 redaka, delta 0,00.

  B) BRISE suvisan atribut `uplata` na jednom retku (ne brise event!)
     05.05.2025, naknada F4.5.3.2.1: event nosi `isplata = 0,17` (tocno, s izvoda)
     I `uplata = 0,26` (nema protustavke na izvodu) => neto +0,09 umjesto -0,17.
     `smjer = Isplata` je unutarnji svjedok da je uplata suvisna.

--------------------------------------------------------------------------------
STO SE NAMJERNO NE DIRA — I ZASTO (oboje bi bilo pogresno „popraviti")

  * 20.05.2026. -66,00 [Cash] „Promjena guma" — ISPRAVAN podatak. Iz salda
    izlazi promjenom KONFIGURACIJE (sql/037: `izvorplacanja` vise ne sadrzi
    `Cash`), ne brisanjem. Trosak ostaje vidljiv u razrezu po Tipu.
  * 25.08.2025. ZABA „Anja 73/96" (uplata 450,00 + isplata 0,70) — jedini drugi
    event u Arei s popunjena OBA smjera, ali to je VJERAN SPOJ dvaju stvarnih
    redaka izvoda (M-ZABA UPLATA ANJA 450,00 i naknada 0,70 istog dana). Neto
    449,30 je tocno ono sto je banka napravila. Granularnost, ne greska.

--------------------------------------------------------------------------------
OCEKIVANI ISHOD (redoslijed je bitan)

    375,80  polazno (poslije fix_rf_duplikati.py)
   + 20,28  A) 4 obrisana retka
   -  0,26  B) maknut suvisan `uplata`
   ---------
    395,82  <- ovo ispisuje ova skripta
   + 66,00  ponovno pokretanje sql/037 (Cash van filtra) — RUCNO, SQL Editor
   ---------
    461,82  = ispisano stanje na RF_2026-06.pdf

⚠ Ova skripta racuna po pravilu `Izvor IN (Racun, Cash)` jer citate iz
  verify_rpc_vs_model odgovaraju STAROM filtru. Zato ispisuje i broj po NOVOM
  pravilu, da se vidi meta prije nego 037 bude pokrenut.

--------------------------------------------------------------------------------
TRI ZASTITE (iste kao u fix_rf_duplikati.py)

1. paginacija samo uz `order=` (Supa to sama provjerava)
2. svaki DELETE/PATCH trazi `Prefer: return=representation`; 0 vracenih redaka
   je GRESKA, ne uspjeh (RLS-blokiran zahvat inace izgleda kao da je prosao)
3. `event_attributes` nema `ON DELETE CASCADE` => djeca prva, roditelj drugi

Pokretanje:
    Financije\\run.bat fix_rf_ostatak.py            -> DRY-RUN
    Financije\\run.bat fix_rf_ostatak.py --apply    -> mijenja (uz backup)
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))

from verify_rpc_vs_model import ENV_FILE, Supa, izvrseno_db, load_env, pull_db

RACUN = 'Sa\u0161in teku\u0107i RF'
ARHIVA = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije\_arhiva")
EPS = 0.005

SIDRO, META = 3458.03, 461.82
OD, DO = date(2025, 1, 2), date(2026, 7, 6)

# A) obrisati: (datum, neto, komentar koji se OCEKUJE) — svi su bez opisa
BRISATI = [
    (date(2025, 10, 7), -20.00, ''),
    (date(2025, 4, 4), -1.32, ''),
    (date(2026, 7, 2), -0.11, ''),
    (date(2025, 3, 18), 1.15, ''),
]

# B) maknuti suvisan atribut: (datum, neto sada, slug, vrijednost sada, ocekivani neto poslije)
CISTITI = [(date(2025, 5, 5), 0.09, 'uplata', 0.26, -0.17)]


def _req(sp, path, method, body=None):
    req = urllib.request.Request(f'{sp.base}/rest/v1/{path}', method=method)
    req.add_header('apikey', sp.key)
    req.add_header('Authorization', f'Bearer {sp.key}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} -> {e.code}\n{e.read().decode()[:600]}')
    return json.loads(raw) if raw else []


def saldo(rf_rows, cash_out=False):
    win = [r for r in rf_rows if OD < r['date'] <= DO
           and (not cash_out or r['izvor'] != 'Cash')]
    return SIDRO + sum(r['signed'] for r in win)


def main():
    apply = '--apply' in sys.argv
    print('=' * 78)
    print('fix_rf_ostatak.py — ' + ('APPLY (mijenja!)' if apply else 'DRY-RUN'))
    print('=' * 78)

    sp = Supa(load_env(ENV_FILE))
    rows, defs_all = pull_db(sp)[0], pull_db(sp)[2]
    rf = [r for r in rows if r['racun'] == RACUN and izvrseno_db(r)]
    slug_id = {d['slug']: d['id'] for d in defs_all}

    print(f'\nRedaka koji micu saldo: {len(rf)}')
    print(f'Saldo na {DO}: {saldo(rf):.2f}   (po NOVOM pravilu, bez Cash: '
          f'{saldo(rf, cash_out=True):.2f};  meta {META:.2f})')

    def find(d, amt, com=None):
        return [r for r in rf if r['date'] == d and abs(r['signed'] - amt) < EPS
                and (com is None or (r['comment'] or '').strip() == com)]

    plan_del, plan_clr, blocked = [], [], []
    for d, amt, com in BRISATI:
        hits = find(d, amt, com)
        if len(hits) == 1:
            plan_del.append(hits[0])
        else:
            blocked.append(f'BRISATI {d} {amt:+.2f} -> {len(hits)} pogodaka')

    for d, amt, slug, val, after in CISTITI:
        hits = find(d, amt)
        if len(hits) != 1:
            blocked.append(f'CISTITI {d} {amt:+.2f} -> {len(hits)} pogodaka')
            continue
        ev = hits[0]
        if abs((ev['a'].get(slug) or 0) - val) > EPS:
            blocked.append(f'CISTITI {d}: {slug} = {ev["a"].get(slug)!r}, ocekivano {val}')
            continue
        if str(ev['a'].get('smjer')) != 'Isplata':
            blocked.append(f'CISTITI {d}: smjer = {ev["a"].get("smjer")!r}, ocekivano Isplata')
            continue
        plan_clr.append((ev, slug, val, after))

    print(f'\n-- A) BRISANJE ({len(plan_del)}/{len(BRISATI)}) ' + '-' * 34)
    for ev in plan_del:
        print(f'   {ev["date"]}  {ev["signed"]:>9.2f}  id={ev["id"]}  atributa={len(ev["a"])}')
    print(f'\n-- B) MICANJE SUVISNOG ATRIBUTA ({len(plan_clr)}/{len(CISTITI)}) ' + '-' * 20)
    for ev, slug, val, after in plan_clr:
        print(f'   {ev["date"]}  {slug} = {val}  ->  NULL   (neto {ev["signed"]:+.2f} -> {after:+.2f})')
        print(f'            event ostaje: id={ev["id"]}  isplata={ev["a"].get("isplata")}')

    if blocked:
        print(f'\n-- BLOKIRANO ({len(blocked)}) — NE dira se --')
        for b in blocked:
            print(f'   ! {b}')

    d_del = sum(e['signed'] for e in plan_del)
    d_clr = sum(a - e['signed'] for e, s, v, a in plan_clr)
    print(f'\n   ocekivano poslije (staro pravilo): {saldo(rf) - d_del + d_clr:.2f}')
    print(f'   ocekivano poslije (bez Cash)     : {saldo(rf, True) - d_del + d_clr:.2f}'
          f'   <- meta {META:.2f}')

    if not apply:
        print('\nDRY-RUN gotov. Za stvarnu izmjenu: --apply')
        return
    if not plan_del and not plan_clr:
        sys.exit('\nNema sto mijenjati — prekidam.')

    ARHIVA.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bpath = ARHIVA / f'rf_ostatak_{stamp}.json'
    dump = {'obrisano': [], 'ocisceno': []}
    for ev in plan_del:
        dump['obrisano'].append({
            'event': sp.select_all(f'events?select=*&id=eq.{ev["id"]}&order=id'),
            'attributes': sp.select_all(
                f'event_attributes?select=*&event_id=eq.{ev["id"]}&order=id')})
    for ev, slug, val, after in plan_clr:
        dump['ocisceno'].append({
            'event_id': ev['id'], 'slug': slug, 'stara_vrijednost': val,
            'attributes': sp.select_all(
                f'event_attributes?select=*&event_id=eq.{ev["id"]}&order=id')})
    bpath.write_text(json.dumps(dump, ensure_ascii=False, indent=2, default=str),
                     encoding='utf-8')
    print(f'\nbackup: {bpath}')

    for ev in plan_del:
        eid = ev['id']
        _req(sp, f'event_attachments?event_id=eq.{eid}', 'DELETE')
        ea = _req(sp, f'event_attributes?event_id=eq.{eid}', 'DELETE')
        if not ea:
            sys.exit(f'{ev["date"]}: 0 obrisanih atributa — stao prije DELETE eventa.')
        gone = _req(sp, f'events?id=eq.{eid}', 'DELETE')
        if len(gone) != 1:
            sys.exit(f'{ev["date"]}: DELETE eventa vratio {len(gone)} redaka — PREKID. '
                     f'Atributi su obrisani, vrati ih iz {bpath.name}.')
        print(f'   obrisano  {ev["date"]}  {ev["signed"]:+.2f}  (atributa {len(ea)})')

    for ev, slug, val, after in plan_clr:
        aid = slug_id[slug]
        upd = _req(sp, f'event_attributes?event_id=eq.{ev["id"]}'
                       f'&attribute_definition_id=eq.{aid}', 'PATCH',
                   {'value_number': None})
        if len(upd) != 1:
            sys.exit(f'{ev["date"]}: PATCH vratio {len(upd)} redaka — PREKID.')
        print(f'   ocisceno  {ev["date"]}  {slug} -> NULL')

    rows2, _, _ = pull_db(sp)
    rf2 = [r for r in rows2 if r['racun'] == RACUN and izvrseno_db(r)]
    print(f'\nRedaka poslije: {len(rf2)}  (bilo {len(rf)})')
    print(f'Saldo na {DO} (staro pravilo, Cash jos unutra): {saldo(rf2):.2f}')
    print(f'Saldo na {DO} (bez Cash — meta):                {saldo(rf2, True):.2f}'
          f'   ocekivano {META:.2f}')
    print('\nPreostalo rucno: pokrenuti sql/037_financije_dashboard.sql u SQL Editoru')
    print('(Cash izvan filtra), pa u appu Date To = 06.07.2026.')


if __name__ == '__main__':
    main()
