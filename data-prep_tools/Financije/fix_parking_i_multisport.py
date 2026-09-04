# -*- coding: utf-8 -*-
"""
fix_parking_i_multisport.py — dva dokazana popravka na PROD-u. S128.

--------------------------------------------------------------------------------
STO POPRAVLJA (oba dokazana IZVODOM, ne zakljuckom)

1. PARKING 1:N  — tri Kokina retka `Parking 1,40` koje je banka naplatila kao
   DVA naloga po 0,70. U bazi su zavrsila oba oblika, pa je isti trosak brojan
   dvaput. Vrijedi pravilo iz CLAUDE.md: bankini retci su KOSTUR, Kokin
   DOPUNJAVA i zatim nestaje -- dakle brise se njezin `1,40`, ne bankina 0,70.

       2026-03-05   banka 2x0,70   baza 2x0,70 + 1,40   ⇒ visak 1,40
       2026-03-21   banka 2x0,70   baza 2x0,70 + 1,40   ⇒ visak 1,40
       2026-04-11   banka 2x0,70   baza 2x0,70 + 1,40   ⇒ visak 1,40

   Zbroj viska 4,20 = Δ(2026-03) 2,80 + Δ(2026-04) 1,40, u cent.

2. MULTISPORT 49,00 — jedan redak s KRIVE STRANE zatvaranja izvoda. Banka ima
   `IziPay Anja 49,00` mjesecno: 03.02.2025. i 02.03.2025. Baza ima oba, ali je
   ozujski datiran 24.02. ⇒ pada u veljacki prozor. Otud Δ(2025-02) = -49,00 i
   Δ(2025-03) = +49,00, koji se ponistavaju. Ne dodaje se nista i ne brise --
   mijenja se DATUM jednog retka.

--------------------------------------------------------------------------------
⚠ ZASTO SKRIPTA PRVO MJERI PA TEK ONDA PISE

Popis ID-eva je izmjeren, ali ID nije dokaz. Prije ijednog upisa skripta ponovo
izvede invarijantu iz PDF-a izvoda i iz zive baze; ne poklopi li se, STOP.
Inace bi popravak koji je jednom bio tocan ostao "tocan" i nakon sto ga netko
rukom rijesi -- pa bi obrisao bankin redak umjesto Kokinog.

⚠ `Datum naplate` ide S DATUMOM. Za `Izvor = Racun` je po D1b jednak
`event_date`-u; ostavljen na starom danu tvrdio bi da je banka teretila racun
prije nego je transakcija postojala.

⚠ `session_start` se pomice, `Stanje` NE. `useActivities` grupira po
(user, kategorija, session_start) ⇒ dan se mora slagati, inace redak visi u
tudem danu. `Stanje` je snimka KOKINOG lanca i jedini neovisni svjedok protiv
naseg izracuna (CLAUDE.md) -- ne pise se i ne brise.

⚠ RLS-blokiran write "uspije" s 0 redaka ⇒ svaki upis mjeri BROJ redaka.

Pokretanje:
    python fix_parking_i_multisport.py            # dry run, nista se ne pise
    python fix_parking_i_multisport.py --apply
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from enrich_from_izvoda import _parse_zaba_all, _zaba_is_tekuci  # noqa: E402
from uskladi_izvod import CAT_PROD, ev_date, load_db, load_env, net  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IZVODI = ROOT / 'data-prep_data' / 'Financije' / 'izvodi' / 'Analizirani_izvodi'
RACUN = 'Kokin tekući ZABA'
DRY = '--apply' not in sys.argv

# (dan, izvod) — banka mora imati TOCNO 2x0,70, baza 2x0,70 + jedan 1,40.
PARKING = [(date(2026, 3, 5), 'ZABA_2026-03'),
           (date(2026, 3, 21), 'ZABA_2026-03'),
           (date(2026, 4, 11), 'ZABA_2026-04')]

# Redak se seli s KRIVE strane zatvaranja izvoda 25.02.2025. na bankin dan.
SELI_S, SELI_NA = date(2025, 2, 24), date(2025, 3, 2)
FEB_OD, FEB_DO = date(2025, 1, 28), date(2025, 2, 25)   # prozor izvoda 2025-02


def banka(stem, dan, iznos, tol=0.005):
    txs, _ = _parse_zaba_all(IZVODI / (stem + '.pdf'))
    return [t for t in txs if _zaba_is_tekuci(t['account']) and t['date'] == dan
            and abs(t['iznos'] - iznos) <= tol]


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    print('=' * 92)
    print('POPRAVCI NA PROD' + ('   [DRY RUN]' if DRY else '   [APPLY]'))
    print('=' * 92)

    db = load_db(url, key)
    moji = [r for r in db if r['attrs'].get('Racun') == RACUN
            and r['attrs'].get('Izvor') == 'Racun']
    defs = {d['name']: d for d in req(
        'GET', 'attribute_definitions?category_id=eq.' + CAT_PROD
        + '&select=id,name,data_type')}

    # -- 1. provjera invarijante parkinga -----------------------------------
    print('\n1 · PARKING 1:N — provjera protiv izvoda')
    brisanja = []
    for dan, stem in PARKING:
        b70 = banka(stem, dan, 0.70)
        d70 = [r for r in moji if ev_date(r) == dan and abs(net(r['attrs']) - 0.70) < 0.005]
        d140 = [r for r in moji if ev_date(r) == dan and abs(net(r['attrs']) - 1.40) < 0.005]
        print('   ' + str(dan) + '   banka ' + str(len(b70)) + 'x0,70   baza '
              + str(len(d70)) + 'x0,70 + ' + str(len(d140)) + 'x1,40')
        if not (len(b70) == 2 and len(d70) == 2 and len(d140) == 1):
            sys.exit('   ✗ invarijanta ne stoji — netko je ovo vec dirao. STOP.')
        brisanja.append((d140[0], 'Parking 1,40 @ ' + str(dan) + ' (banka ima 2x0,70)'))

    # -- 2. provjera invarijante multisporta ---------------------------------
    print('\n2 · MULTISPORT 49,00 — provjera protiv izvoda')
    b_feb = banka('ZABA_2025-02', date(2025, 2, 3), 49.00)
    b_ozu = banka('ZABA_2025-03', SELI_NA, 49.00)
    d_feb = [r for r in moji if FEB_OD < ev_date(r) <= FEB_DO
             and abs(net(r['attrs']) - 49.00) < 0.005]
    d_ozu = [r for r in moji if FEB_DO < ev_date(r) <= date(2025, 3, 31)
             and abs(net(r['attrs']) - 49.00) < 0.005]
    print('   banka: veljaca ' + str(len(b_feb)) + 'x49,00 (03.02.)   ozujak '
          + str(len(b_ozu)) + 'x49,00 (02.03.)')
    print('   baza : veljacki prozor ' + str(len(d_feb)) + 'x49,00   ozujski prozor '
          + str(len(d_ozu)) + 'x49,00')
    if not (len(b_feb) == 1 and len(b_ozu) == 1 and len(d_feb) == 2 and len(d_ozu) == 0):
        sys.exit('   ✗ invarijanta ne stoji — netko je ovo vec dirao. STOP.')
    seli = [r for r in d_feb if ev_date(r) == SELI_S]
    if len(seli) != 1:
        sys.exit('   ✗ ocekujem tocno jedan redak na ' + str(SELI_S)
                 + ', nasao ' + str(len(seli)) + '. STOP.')
    seli = seli[0]
    print('   ⇒ selim ' + repr(seli['comment']) + ' s ' + str(SELI_S) + ' na ' + str(SELI_NA))

    kolizija = [r for r in db if ev_date(r) == SELI_NA
                and r['session_start'][11:16] == seli['session_start'][11:16]]
    if kolizija:
        sys.exit('   ✗ minuta ' + seli['session_start'][11:16] + ' na ' + str(SELI_NA)
                 + ' je zauzeta — dva retka bi postala JEDAN redak liste. STOP.')

    # -- backup --------------------------------------------------------------
    dirnuti = [r['id'] for r, _ in brisanja] + [seli['id']]
    inl = '(' + ','.join(dirnuti) + ')'
    bak = {'events': req('GET', 'events?id=in.' + inl + '&select=*'),
           'attributes': req('GET', 'event_attributes?event_id=in.' + inl + '&select=*')}
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    p = ROOT / 'data-prep_data' / 'Financije' / '_arhiva' / ('backup_S128_' + stamp + '.json')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(bak, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\nbackup: ' + p.name + '   (' + str(len(bak['events'])) + ' eventa, '
          + str(len(bak['attributes'])) + ' atributa)')

    # -- 3. brisanja ---------------------------------------------------------
    print('\n3 · BRISANJA')
    for r, lbl in brisanja:
        n_at = sum(1 for a in bak['attributes'] if a['event_id'] == r['id'])
        print('   ' + r['event_date'] + '  ' + lbl.ljust(46) + str(n_at) + ' atr.')
        if DRY:
            continue
        d1 = req('DELETE', 'event_attributes?event_id=eq.' + r['id'] + '&select=id')
        if len(d1) != n_at:
            sys.exit('   ✗ obrisano ' + str(len(d1)) + ' od ' + str(n_at)
                     + ' atributa — STOP prije eventa.')
        d2 = req('DELETE', 'events?id=eq.' + r['id'] + '&select=id')
        if len(d2) != 1:
            sys.exit('   ✗ brisanje eventa vratilo ' + str(len(d2)) + ' redaka — STOP.')

    # -- 4. pomak datuma -----------------------------------------------------
    print('\n4 · POMAK DATUMA')
    novi_ss = SELI_NA.isoformat() + seli['session_start'][10:]
    dn = defs['Datum naplate']
    print('   event_date     ' + seli['event_date'] + ' → ' + str(SELI_NA))
    print('   session_start  ' + seli['session_start'] + ' → ' + novi_ss)
    print('   Datum naplate  ' + str(seli['attrs'].get('Datum naplate')) + ' → '
          + str(SELI_NA) + 'T12:00:00+00:00   (Izvor=Racun ⇒ isti dan, D1b)')
    print('   Stanje         ostaje netaknuto (Kokin lanac je svjedok, ne nas zapis)')
    if not DRY:
        got = req('PATCH', 'events?id=eq.' + seli['id'],
                  {'event_date': SELI_NA.isoformat(), 'session_start': novi_ss})
        if len(got) != 1:
            sys.exit('   ✗ PATCH eventa vratio ' + str(len(got)) + ' redaka — RLS? STOP.')
        ex = req('GET', 'event_attributes?event_id=eq.' + seli['id']
                 + '&attribute_definition_id=eq.' + dn['id'] + '&select=id')
        if not ex:
            sys.exit('   ✗ redak nema `Datum naplate` — STOP, provjeri rucno.')
        got = req('PATCH', 'event_attributes?id=eq.' + ex[0]['id'],
                  {'value_datetime': SELI_NA.isoformat() + 'T12:00:00+00:00'})
        if len(got) != 1:
            sys.exit('   ✗ PATCH atributa vratio ' + str(len(got)) + ' redaka — STOP.')

    print('\n' + '=' * 92)
    if DRY:
        print('DRY RUN gotov — nista nije promijenjeno. Za primjenu: --apply')
        return
    ost = req('GET', 'events?id=in.(' + ','.join(r['id'] for r, _ in brisanja) + ')&select=id')
    print('provjera: obrisanih redaka ostalo ' + str(len(ost)) + ' (mora biti 0)')
    print('gotovo. Pusti `promet_check.py --od=2025-02` — 2025-02, 2025-03, '
          '2026-03 i 2026-04 moraju pasti na 0,00.')


if __name__ == '__main__':
    main()
