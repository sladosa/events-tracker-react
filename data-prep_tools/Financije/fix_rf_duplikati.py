# -*- coding: utf-8 -*-
"""
fix_rf_duplikati.py  (S111, 2026-08-18)
================================================================================
BRISE 9 DUPLIH REDAKA NA `Sasin tekuci RF` — isti stvarni dogadaj upisan dvaput,
jednom iz bankovnog izvoda i jednom iz Kokine Excelice, s RAZLICITIM iznosom.

Spec: docs/OVERVIEW_TAB_SPEC.md §2.10 (Izvor mice saldo), §2.17 (sidro)

--------------------------------------------------------------------------------
ZASTO IH DEDUP NIJE UHVATIO

Kljuc je bio `(datum, iznos)`. Kad je Koka upisala SKORO isti iznos kao banka
(1.265,59 umjesto 1.285,59 — zamijenjena znamenka), kljuc se razlikovao i OBA
retka su usla. Razlike idu od 0,02 do 25,70 EUR.

Neto ucinak svih 15 sirocadi bio je -130,25, a BRUTO 2.609,78 — dvadeset puta
vise. Da se gledao samo krajnji broj, izgledalo bi kao sitni sum. (Ista zamka
kao S110: mali zbirni delta moze znaciti paran broj gresaka.)

--------------------------------------------------------------------------------
PRAVILO KOJE ODLUCUJE STO SE BRISE

  Ostaje redak ciji se iznos poklapa s BANKOVNIM IZVODOM. Banka je autoritet za
  iznos; Kokin redak je covjekov unos po sjecanju.

Zato svaki zapis u SPEC nosi i BLIZANCA (drugi clan para). Ako blizanac NE
postoji u bazi, redak se NE brise — tada nije duplikat nego jedini svjedok.

--------------------------------------------------------------------------------
STO SE NAMJERNO NE DIRA

  * 20.05.2026. -66,00 [Cash] "Promjena guma" — gotovinski trosak, po definiciji
    ga NEMA na bankovnom izvodu. Pitanje modela (smije li nositi Racun = RF kad
    je gotovina vec odbijena podizanjem), ne greska unosa. Odluka je Sasina.
  * 07.10.2025. -20,00 · 04.04.2025. -1,32 · 02.07.2026. -0,11 · 18.03.2025.
    +1,15 · 05.05.2025. +0,09 — nemaju jasnog blizanca. Ostaju dok se ne objasne.

--------------------------------------------------------------------------------
TRI ZASTITE (sve tri zato sto su vec jednom pukle u ovom projektu)

1. `select_all` bez `order=` je tiho pogresan — paginacija bez stabilnog
   sortiranja preklopi i istovremeno preskoci retke. Naslijedeno iz
   verify_rpc_vs_model.Supa, koje to samo provjerava.
2. RLS-blokiran DELETE "uspije" s 0 redaka. Zato svaki DELETE trazi
   `Prefer: return=representation` i broji vracene retke; 0 = greska, ne uspjeh.
3. `event_attributes` NEMA `ON DELETE CASCADE` (shema V5) => djeca prva,
   roditelj drugi. Preskocen atribut => DELETE eventa pada na FK.

Kategorija `Transakcija` je L1 bez roditelja => nema P2 parent eventa za upsert.

--------------------------------------------------------------------------------
Pokretanje (run.bat gusi zarez — jedan argument po pozivu):

    Financije\\run.bat fix_rf_duplikati.py            -> DRY-RUN, nista se ne pise
    Financije\\run.bat fix_rf_duplikati.py --apply    -> brise (uz backup)

Kljucevi iz `.env.local` (TEST): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
Servisni kljuc zaobilazi RLS => pokretati lokalno, nikad iz preglednika.
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

from verify_rpc_vs_model import (ENV_FILE, Supa, izvrseno_db, load_env, pull_db)

RACUN = 'Sa\u0161in teku\u0107i RF'
ARHIVA = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije\_arhiva")
EPS = 0.005

SIDRO = 3458.03                 # potvrdeno stanje 02.01.2025 (ispisano, RF_2024-12.pdf)
META = 461.82                   # ispisano stanje 06.07.2026 (RF_2026-06.pdf)
OD, DO = date(2025, 1, 2), date(2026, 7, 6)

# (datum, iznos, komentar)  +  blizanac koji MORA postojati da bi brisanje proslo
SPEC = [
    # brisati (Kokin unos)                              zadrzati (iznos s izvoda)
    ((date(2025, 12, 4), -1265.59, 'Visa'), (date(2025, 12, 4), -1285.59)),
    ((date(2025, 2, 1), 908.64, 'Mirovina I stup'), (date(2025, 2, 1), 882.94)),
    ((date(2025, 5, 10), 225.47, 'Mirovina III stup'), (date(2025, 5, 12), 225.74)),
    ((date(2025, 2, 1), 89.13, 'Mirovina II stup'), (date(2025, 2, 3), 85.07)),
    ((date(2025, 1, 28), 15.20, ''), (date(2025, 1, 28), 15.22)),
    ((date(2025, 4, 27), -11.48, ''), (date(2025, 4, 27), -11.49)),
    ((date(2026, 6, 15), -2.88, 'Naknada'), (date(2026, 6, 15), -2.99)),
    ((date(2025, 6, 16), -2.55, ''), (date(2025, 6, 16), -2.38)),
    ((date(2025, 1, 21), -0.17, ''), (date(2025, 1, 21), -0.19)),
]


def delete_returning(sp, path):
    """DELETE koji VRACA obrisane retke. Prazan rezultat = nista nije obrisano
    (RLS ili kriv filtar) — nikad se ne smije procitati kao uspjeh."""
    req = urllib.request.Request(f'{sp.base}/rest/v1/{path}', method='DELETE')
    req.add_header('apikey', sp.key)
    req.add_header('Authorization', f'Bearer {sp.key}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    try:
        with urllib.request.urlopen(req, None, timeout=60) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        sys.exit(f'DELETE {path} -> {e.code}\n{e.read().decode()[:600]}')
    return json.loads(raw) if raw else []


def saldo(rf_rows):
    win = [r for r in rf_rows if OD < r['date'] <= DO]
    return SIDRO + sum(r['signed'] for r in win), len(win)


def main():
    apply = '--apply' in sys.argv

    print('=' * 78)
    print('fix_rf_duplikati.py — ' + ('APPLY (brise!)' if apply else 'DRY-RUN (nista se ne pise)'))
    print('=' * 78)

    sp = Supa(load_env(ENV_FILE))
    rows, _, _ = pull_db(sp)
    rf = [r for r in rows if r['racun'] == RACUN and izvrseno_db(r)]
    bal, n = saldo(rf)
    print(f'\nRedaka na "{RACUN}" koji micu saldo: {len(rf)}')
    print(f'Saldo na {DO} prije zahvata: {bal:.2f}   (meta {META:.2f}, delta {bal - META:+.2f})')

    def find(d, amt, comment=None):
        return [r for r in rf
                if r['date'] == d and abs(r['signed'] - amt) < EPS
                and (comment is None or (r['comment'] or '').strip() == comment)]

    plan, blocked = [], []
    for (d, amt, com), (kd, kamt) in SPEC:
        label = f'{d}  {amt:>10.2f}  "{com or "(bez opisa)"}"'
        hits = find(d, amt, com)
        twins = find(kd, kamt)
        if len(hits) != 1:
            blocked.append(f'{label} -> {len(hits)} pogodaka (ocekivan tocno 1)')
        elif len(twins) != 1:
            blocked.append(f'{label} -> blizanac {kd} {kamt:+.2f} ima {len(twins)} pogodaka')
        else:
            plan.append((hits[0], twins[0], label))

    print(f'\n-- PLAN ({len(plan)} od {len(SPEC)}) ' + '-' * 40)
    total = 0.0
    for ev, tw, label in plan:
        total += ev['signed']
        print(f'   BRISEM   {label}')
        print(f'            id={ev["id"]}  atributa={len(ev["a"])}')
        print(f'   ostaje   {tw["date"]}  {tw["signed"]:>10.2f}  '
              f'"{(tw["comment"] or "(bez opisa)")[:44]}"')

    if blocked:
        print(f'\n-- BLOKIRANO ({len(blocked)}) — NE brise se --')
        for b in blocked:
            print(f'   ! {b}')

    print(f'\n   neto iznos redaka za brisanje: {total:+.2f}')
    print(f'   ocekivani saldo poslije:       {bal - total:.2f}   '
          f'(meta {META:.2f}, ostatak {bal - total - META:+.2f})')

    if not apply:
        print('\nDRY-RUN gotov. Za stvarno brisanje: --apply')
        return
    if not plan:
        sys.exit('\nNema sto brisati — prekidam.')

    # -- backup PRIJE brisanja (ne u git; ide u _arhiva/) ----------------------
    ARHIVA.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bpath = ARHIVA / f'rf_duplikati_obrisano_{stamp}.json'
    dump = []
    for ev, tw, label in plan:
        attrs = sp.select_all(f'event_attributes?select=*&event_id=eq.{ev["id"]}&order=id')
        evrow = sp.select_all(f'events?select=*&id=eq.{ev["id"]}&order=id')
        dump.append({'event': evrow[0] if evrow else None, 'attributes': attrs,
                     'signed': ev['signed'], 'label': label})
    bpath.write_text(json.dumps(dump, ensure_ascii=False, indent=2, default=str),
                     encoding='utf-8')
    print(f'\nbackup: {bpath}')

    # -- brisanje: djeca pa roditelj ------------------------------------------
    for ev, tw, label in plan:
        eid = ev['id']
        att = delete_returning(sp, f'event_attachments?event_id=eq.{eid}')
        ea = delete_returning(sp, f'event_attributes?event_id=eq.{eid}')
        if not ea:
            sys.exit(f'{label}: 0 obrisanih atributa — stao prije DELETE eventa.')
        gone = delete_returning(sp, f'events?id=eq.{eid}')
        if len(gone) != 1:
            sys.exit(f'{label}: DELETE eventa vratio {len(gone)} redaka — PREKID. '
                     f'Atributi su vec obrisani, vrati ih iz {bpath.name}.')
        print(f'   ok  {label}  (atributa {len(ea)}, privitaka {len(att)})')

    # -- kontrolno mjerenje ---------------------------------------------------
    rows2, _, _ = pull_db(sp)
    rf2 = [r for r in rows2 if r['racun'] == RACUN and izvrseno_db(r)]
    bal2, n2 = saldo(rf2)
    print(f'\nRedaka poslije: {len(rf2)}  (bilo {len(rf)}, obrisano {len(plan)})')
    print(f'Saldo na {DO}: {bal2:.2f}   meta {META:.2f}   ostatak {bal2 - META:+.2f}')
    print('\nU aplikaciji: Date To = 06.07.2026. -> pocica mora pokazati isti broj.')


if __name__ == '__main__':
    main()
