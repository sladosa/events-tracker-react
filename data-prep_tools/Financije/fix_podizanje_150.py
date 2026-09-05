# -*- coding: utf-8 -*-
"""
fix_podizanje_150.py — jedan dokazan popravak na PROD-u. S129.

--------------------------------------------------------------------------------
STO POPRAVLJA

Podizanje gotovine od 150,00 postoji u bazi DVAPUT, jednom krivo datirano:

    2025-10-12   Kokin redak   Tip=N/A, bez komentara, bez `Izvod opis`
    2025-11-12   bankin redak  Tip=Transfer, komentar i `Izvod opis` s izvoda

Banka u rujnu-studenom ima TOCNO JEDNO podizanje od 150,00, i to 12.11.
Kokin file (`koka EU!2137`) ima TOCNO JEDAN redak od 150,00, i to 12.10.,
bez opisa. Dakle jedan dogadjaj, dva zapisa, mjesec dana razlike — isti
dan u mjesecu, dakle tipfeler u MJESECU (razred S116, redak 2564).

Brojke to potvrdjuju neovisno: Δ(2025-10) = -150,00 tocno, Δ(2025-11) = 0,00.

⚠ Brise se KOKIN, ne bankin. Vrijedi pravilo iz CLAUDE.md: bankini retci su
  KOSTUR, Kokin DOPUNJAVA i zatim nestaje. Ovdje njegov nema sto dopuniti —
  bankin vec nosi opis, klasifikaciju i potvrdu izvodom.

⚠ NE popravlja se datum umjesto brisanja. Pomak na 12.11. dao bi DVA
  identicna retka istog dana i iznosa — dakle ono sto se cisti.

--------------------------------------------------------------------------------
⚠ ZASTO SKRIPTA PRVO MJERI PA TEK ONDA PISE

ID je izmjeren, ali ID nije dokaz. Prije upisa se invarijanta izvodi iznova
iz PDF-a izvoda i iz zive baze; ne poklopi li se, STOP. Inace bi popravak
koji je jednom bio tocan ostao "tocan" i nakon sto ga netko rukom rijesi.

⚠ RLS-blokiran DELETE "uspije" s 0 redaka ⇒ svaki upis mjeri BROJ redaka.

Pokretanje:
    python fix_podizanje_150.py            # dry run, nista se ne pise
    python fix_podizanje_150.py --apply
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from enrich_from_izvoda import _parse_zaba_all, _zaba_is_tekuci  # noqa: E402
from uskladi_izvod import ev_date, load_db, load_env, net  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IZVODI = ROOT / 'data-prep_data' / 'Financije' / 'izvodi' / 'Analizirani_izvodi'
RACUN = 'Kokin tekući ZABA'
DRY = '--apply' not in sys.argv

IZNOS = 150.00
BRISEM_NA = date(2025, 10, 12)          # Kokin, krivi mjesec
CUVAM_NA = date(2025, 11, 12)           # bankin, potvrdjen izvodom
PROZOR_OD, PROZOR_DO = date(2025, 9, 1), date(2025, 12, 1)
STEMOVI = ['ZABA_2025-09', 'ZABA_2025-10', 'ZABA_2025-11']


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    print('=' * 92)
    print('POPRAVAK NA PROD — podizanje 150,00' + ('   [DRY RUN]' if DRY else '   [APPLY]'))
    print('=' * 92)

    # -- 1. koliko ih banka ima, i kada ------------------------------------
    print('\n1 · IZVODI — koliko podizanja od 150,00 banka uopce ima')
    bank = []
    for stem in STEMOVI:
        txs, _ = _parse_zaba_all(IZVODI / (stem + '.pdf'))
        for t in txs:
            if _zaba_is_tekuci(t['account']) and abs(abs(t['iznos']) - IZNOS) < 0.005:
                bank.append((stem, t))
                print('   ' + stem + '   ' + str(t['date']) + '   ' + t['opis'][:52])
    if len(bank) != 1:
        sys.exit('   x ocekujem TOCNO jedan bankin redak, nasao ' + str(len(bank)) + '. STOP.')
    if bank[0][1]['date'] != CUVAM_NA:
        sys.exit('   x bankin redak nije na ' + str(CUVAM_NA) + '. STOP.')

    # -- 2. koliko ih baza ima --------------------------------------------
    print('\n2 · BAZA — koliko ih ima na istom racunu u istom prozoru')
    db = load_db(url, key)
    moji = [r for r in db if r['attrs'].get('Racun') == RACUN
            and PROZOR_OD <= ev_date(r) < PROZOR_DO
            and abs(abs(net(r['attrs'])) - IZNOS) < 0.005]
    for r in sorted(moji, key=ev_date):
        a = r['attrs']
        print('   ' + str(ev_date(r)) + '   Tip=' + str(a.get('Tip')).ljust(10)
              + '   Izvod opis: ' + ('DA' if a.get('Izvod opis') else 'ne')
              + '   komentar: ' + ('DA' if r['comment'] else 'ne'))
    if len(moji) != 2:
        sys.exit('   x ocekujem TOCNO dva retka, nasao ' + str(len(moji)) + '. STOP.')

    brisem = [r for r in moji if ev_date(r) == BRISEM_NA]
    cuvam = [r for r in moji if ev_date(r) == CUVAM_NA]
    if len(brisem) != 1 or len(cuvam) != 1:
        sys.exit('   x datumi se ne slazu s nalazom. STOP.')
    brisem, cuvam = brisem[0], cuvam[0]

    # /!\ Brise se samo redak koji NEMA sto izgubiti. Nosi li komentar ili
    #     `Izvod opis`, netko ga je u medjuvremenu dopunio — tada odluka vise
    #     nije nasa i mehanicko brisanje bi progutalo tudji rad.
    if brisem['comment'] or brisem['attrs'].get('Izvod opis'):
        sys.exit('   x redak za brisanje u medjuvremenu ima komentar ili `Izvod opis`. STOP.')
    if not cuvam['attrs'].get('Izvod opis'):
        sys.exit('   x redak koji cuvam nema `Izvod opis` — nije potvrdjen izvodom. STOP.')

    # -- backup ------------------------------------------------------------
    bak = {'events': req('GET', 'events?id=eq.' + brisem['id'] + '&select=*'),
           'attributes': req('GET', 'event_attributes?event_id=eq.' + brisem['id'] + '&select=*')}
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    p = ROOT / 'data-prep_data' / 'Financije' / '_arhiva' / ('backup_S129_' + stamp + '.json')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(bak, ensure_ascii=False, indent=1), encoding='utf-8')
    n_at = len(bak['attributes'])
    print('\nbackup: ' + p.name + '   (1 event, ' + str(n_at) + ' atributa)')

    # -- 3. brisanje -------------------------------------------------------
    print('\n3 · BRISANJE')
    print('   ' + str(BRISEM_NA) + '   podizanje 150,00 (Kokin, krivi mjesec)   '
          + str(n_at) + ' atr.')
    print('   ostaje ' + str(CUVAM_NA) + '   ' + repr(cuvam['comment'])[:56])
    if not DRY:
        d1 = req('DELETE', 'event_attributes?event_id=eq.' + brisem['id'] + '&select=id')
        if len(d1) != n_at:
            sys.exit('   x obrisano ' + str(len(d1)) + ' od ' + str(n_at)
                     + ' atributa — STOP prije eventa.')
        d2 = req('DELETE', 'events?id=eq.' + brisem['id'] + '&select=id')
        if len(d2) != 1:
            sys.exit('   x brisanje eventa vratilo ' + str(len(d2)) + ' redaka — STOP.')

    print('\n' + '=' * 92)
    if DRY:
        print('DRY RUN gotov — nista nije promijenjeno. Za primjenu: --apply')
        return
    ost = req('GET', 'events?id=eq.' + brisem['id'] + '&select=id')
    print('provjera: obrisanih redaka ostalo ' + str(len(ost)) + ' (mora biti 0)')
    print('gotovo. Pusti `promet_check.py --od=2025-09` — 2025-10 mora pasti na 0,00.')


if __name__ == '__main__':
    main()
