# -*- coding: utf-8 -*-
"""
primijeni_uskladu.py — upisuje na PROD ono sto je `uskladi_izvod.py` nasao. S124.

ZASTO SKRIPTA, A NE EXCEL IMPORT
    Ispravke bi trebala uvesti Koka (vlasnica retka; Sasa je grantee i RLS ga
    zaustavi). Sasina odluka S124: **ne opterecivati je** ovim batchom -- nijedan
    od 25 ispravaka ne trazi njenu odluku, svaki je dokazan izvodom. Njen prvi
    uvoz neka bude njezin mjesec, kad ima razlog da mu stane na kraj.
    Review file (`uskladjenje_MC_2026.xlsx`) ostaje kao RACUN o promjeni.

    ⚠ Skripta NE cita taj xlsx nego racuna isto sto i on, istim funkcijama iz
      `uskladi_izvod.py`. Citanje xlsx-a znacilo bi reimplementirati dio
      `excelImport.ts` (mapiranje kolona, P3, tipovi) -- vise koda i vise nacina
      da se tiho razidje. Ovako je izvor istine JEDAN. Prije primjene se file
      regenerira iz istog runa, pa se ne mogu razici.

STO RADI (tri skupine, sve u jednom potezu)
    1. ISPRAVCI   `Datum naplate`, `Izvod opis`, `Status` na sparenim retcima
                  ⚠ `event_date` se NE dira -- v. `uskladi_izvod.SKIP_FIELDS`
    2. DOPUNE     rata s Kokinog retka na bankin, prije nego Kokin nestane
    3. BRISANJA   (a) `LH 1/3` x2 -- 1:N, bankina 4 retka su vec u bazi
                  (b) 7 duplikata nadjenih S124 (v. DUPLIKATI dolje)

⚠ ZASTO JE SVE U JEDNOM POTEZU
    Brisanje bez prethodne dopune gubi broj rate; dopuna bez brisanja ostavlja
    dvostruki zapis. Razdvojeno u dva runa postoji prozor u kojem je baza gora
    nego prije.

⚠ RLS-BLOKIRAN WRITE "USPIJE" S 0 REDAKA (CLAUDE.md)
    Svaki upis i svako brisanje mjeri BROJ vracenih redaka, nikad HTTP status.
    Neslaganje = odmah `sys.exit`, prije nego sljedeci korak zatekne pola posla.

Pokretanje:
    python primijeni_uskladu.py            # dry run, nista se ne pise
    python primijeni_uskladu.py --apply
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from uskladi_izvod import (CAT_PROD, ev_date, ispravci, load_db, load_env,  # noqa: E402
                           net, parse_mc, uskladi)

ROOT = Path(__file__).resolve().parents[2]
IZVODI = ROOT / 'data-prep_data' / 'Financije' / 'izvodi'
MC = [IZVODI / 'Analizirani_izvodi' / ('MC_2026-0' + str(m) + '.pdf') for m in range(1, 7)]
MC.append(IZVODI / 'MC_2026-07.pdf')

# Duplikati nadjeni S124. Svaki ima u bazi PAR potvrdjen izvodom; ovo su Kokine
# verzije bez `Izvod opis`. Nisu izracunati nego IZMJERENI -- zato popis, ne
# heuristika: svaki je provjeren protiv konkretnog retka izvoda.
DUPLIKATI = [
    ('10,94  tipfeler u GODINI (2025 umjesto 2026)',
     'f7d31f53-4cfd-4ea8-888c-b429f928d08b', 'par: 2026-02-27 Kokin Temu / PAYPAL *TEMU'),
    ('16,29  banka 16,39 (AUDIBLE, isti dan)',
     'fcc98da6-797b-4cda-a4b0-f6e9ade0e8c8', 'par: 2026-02-05 AUDIBLE*5G5G84X13'),
    ('17,19  banka 17,09 (KONZUM RATA 4/6)',
     'eccbcfd3-e9cd-453d-a97c-6631118c525e', 'par: 2026-02-26 Konzum / KONZUM P-3200 RATA 4/6'),
    ('20,01  banka 20,11 (PAYPAL *TEMU, isti dan)',
     '14a62477-cad4-419c-9c9a-c607bc7c96a4', 'par: 2026-04-01 Kokin Temu'),
    ('34,08  dio KEKS PAY 34,98 (34,98 - 34,08 = 0,90)',
     'bb5daefd-7f57-44f0-8f29-3c2139b8c930', 'par: 2026-05-12 KEKS PAY 34,98'),
    ('0,90   drugi dio istog KEKS PAY 34,98',
     'a065dc4e-e457-47ca-a452-3a65c49041d3', 'par: 2026-05-12 KEKS PAY 34,98'),
    ('51,24  banka ga ima 04.05. (INA ZAGREB KSAVER)',
     'aec00b4f-8014-4b5c-8955-c0a4975c5b15', 'par: 2026-05-04 INA ZAGREB KSAVER'),
]

# Prije brisanja 17,19 rata se prenosi na redak koji ostaje -- on je nema.
PRENESI = ('01d08676-ea2b-4f2b-90cb-9a5a43d6f776',
           {'Rate?': True, 'Broj rata': 6, 'Rata br': 4},
           '2026-02-26 Konzum 17,09')

DRY = '--apply' not in sys.argv


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    print('=' * 100)
    print('PRIMJENA USKLADE NA PROD' + ('   [DRY RUN]' if DRY else '   [APPLY]'))
    print('=' * 100)

    db = load_db(url, key)
    by_id = {r['id']: r for r in db}
    defs = {d['name']: d for d in req(
        'GET', 'attribute_definitions?category_id=eq.' + CAT_PROD
        + '&select=id,name,data_type')}

    # -- sto se mijenja -----------------------------------------------------
    ispravci_svi, dopune, brisanja = {}, [], []
    for p in MC:
        iz = parse_mc(p)
        iz['ime'] = p.name
        u = uskladi(iz, db, 'Mastercard', 5)
        for s, r, ch in ispravci(iz, u['pairs']):
            polja = {f: n for f, _, n in ch if f != 'event_date'}
            if polja:
                ispravci_svi.setdefault(r['id'], {}).update(polja)
        for r, combo in u['slozeni']:
            # ⚠ Provjera mora gledati TEKST izvoda, ne iznos. Uz iznos je
            #   `LH 2/3` (62,01 + 1,32) prosao kao "bankini su vec u bazi" --
            #   jer u bazi POSTOJE 62,01 i 1,32, ali su to lipanjske rate
            #   **1/3**. Dry run je pokazao 11 brisanja umjesto 9; primjena bi
            #   ostavila rupu od 126,66 do transe 4.
            bankini_tu = all(any(x['attrs'].get('Izvod opis') == c['opis']
                                 and net(x['attrs']) == c['iznos']
                                 for x in u['mc']) for c in combo)
            if not bankini_tu:
                continue                      # `LH 2/3` -- ceka transu 4
            a = r['attrs']
            if a.get('Rate?') is True:
                for c in combo:
                    if 'RATA' not in c['opis'].upper():
                        continue
                    for x in u['mc']:
                        if (net(x['attrs']) == c['iznos']
                                and x['attrs'].get('Izvod opis') == c['opis']):
                            dopune.append((x['id'], {'Rate?': True,
                                                     'Broj rata': a.get('Broj rata'),
                                                     'Rata br': a.get('Rata br')},
                                           str(x['comment'])))
                            break
            brisanja.append((r['id'], 'LH 1:N  ' + str(r['comment']) + '  '
                             + format(net(a), '.2f')))
    for lbl, eid, par in DUPLIKATI:
        brisanja.append((eid, 'duplikat  ' + lbl + '   ' + par))

    print('ispravci : ' + str(len(ispravci_svi)) + ' redaka')
    print('dopune   : ' + str(len(dopune)) + ' redaka')
    print('brisanja : ' + str(len(brisanja)) + ' redaka')
    print('prijenos : 1 redak (' + PRENESI[2] + ')')

    nedostaju = [e for e, _ in brisanja if e not in by_id]
    if nedostaju:
        sys.exit('Za brisanje trazim retke kojih nema: ' + str(nedostaju) + ' -- STOP.')

    # -- backup -------------------------------------------------------------
    dirnuti = sorted(set(list(ispravci_svi) + [e for e, _ in brisanja]
                         + [e for e, _, _ in dopune] + [PRENESI[0]]))
    inl = '(' + ','.join(dirnuti) + ')'
    bak_ev = req('GET', 'events?id=in.' + inl + '&select=*')
    bak_at = req('GET', 'event_attributes?event_id=in.' + inl + '&select=*')
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bak = ROOT / 'data-prep_data' / 'Financije' / '_arhiva' / ('backup_usklada_' + stamp + '.json')
    bak.parent.mkdir(parents=True, exist_ok=True)
    bak.write_text(json.dumps({'events': bak_ev, 'attributes': bak_at},
                              ensure_ascii=False, indent=1), encoding='utf-8')
    print('\nbackup: ' + bak.name + '   (' + str(len(bak_ev)) + ' eventa, '
          + str(len(bak_at)) + ' atributa)')

    def upisi(eid, name, val):
        d = defs[name]
        col = {'boolean': 'value_boolean', 'number': 'value_number',
               'datetime': 'value_datetime'}.get(d['data_type'], 'value_text')
        if col == 'value_datetime' and val:
            val = str(val)[:10] + 'T12:00:00+00:00'
        if DRY:
            return
        ex = req('GET', 'event_attributes?event_id=eq.' + eid
                 + '&attribute_definition_id=eq.' + d['id'] + '&select=id')
        if ex:
            got = req('PATCH', 'event_attributes?id=eq.' + ex[0]['id'], {col: val})
        else:
            got = req('POST', 'event_attributes',
                      {'event_id': eid, 'attribute_definition_id': d['id'],
                       'user_id': by_id[eid]['user_id'], col: val})
        if not got:
            sys.exit('Upis ' + name + ' na ' + eid[:8] + ' vratio 0 redaka -- RLS? STOP.')

    # -- 1. ispravci --------------------------------------------------------
    print('\n' + '-' * 100)
    print('1 · ISPRAVCI')
    for eid, polja in sorted(ispravci_svi.items(), key=lambda x: by_id[x[0]]['event_date']):
        r = by_id[eid]
        print('   ' + r['event_date'] + '  ' + str(r['comment'] or '(bez opisa)')[:22].ljust(24)
              + format(net(r['attrs']), '9.2f') + '   '
              + ', '.join(k + '=' + str(v)[:22] for k, v in polja.items()))
        for k, v in polja.items():
            upisi(eid, k, v)

    # -- 2. dopune + prijenos ------------------------------------------------
    print('\n' + '-' * 100)
    print('2 · DOPUNE (rata s Kokinog retka na bankin, prije brisanja)')
    for eid, polja, opis in dopune + [(PRENESI[0], PRENESI[1], PRENESI[2])]:
        print('   ' + opis[:44].ljust(46)
              + ', '.join(k + '=' + str(v) for k, v in polja.items()))
        for k, v in polja.items():
            upisi(eid, k, v)

    # -- 3. brisanja ---------------------------------------------------------
    print('\n' + '-' * 100)
    print('3 · BRISANJA')
    for eid, lbl in brisanja:
        r = by_id[eid]
        n_at = sum(1 for a in bak_at if a['event_id'] == eid)
        print('   ' + r['event_date'] + '  ' + lbl[:66].ljust(68) + str(n_at) + ' atr.')
        if DRY:
            continue
        d1 = req('DELETE', 'event_attributes?event_id=eq.' + eid + '&select=id')
        if len(d1) != n_at:
            sys.exit('Obrisano ' + str(len(d1)) + ' od ' + str(n_at)
                     + ' atributa na ' + eid[:8] + ' -- STOP prije brisanja eventa.')
        d2 = req('DELETE', 'events?id=eq.' + eid + '&select=id')
        if len(d2) != 1:
            sys.exit('Brisanje eventa ' + eid[:8] + ' vratilo ' + str(len(d2))
                     + ' redaka -- STOP.')

    print('\n' + '=' * 100)
    if DRY:
        print('DRY RUN gotov -- nista nije promijenjeno. Za primjenu: --apply')
        return
    ost = req('GET', 'events?id=in.(' + ','.join(e for e, _ in brisanja) + ')&select=id')
    print('provjera: obrisanih redaka je ostalo ' + str(len(ost)) + ' (mora biti 0)')
    print('gotovo. Pusti `uskladi_izvod.py` ponovo -- ispravci i pitanja moraju pasti na 0.')


if __name__ == '__main__':
    main()
