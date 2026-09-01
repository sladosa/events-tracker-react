# -*- coding: utf-8 -*-
"""
uvezi_transu.py — upisuje retke s izvoda kojih baza jos nema. S124.

TRI IZVORA, SVAKI ZA ONO STO ZNA (CLAUDE.md „Politika izvora", prosireno S124)
    izvod   iznos, datum, `Izvod opis`, broj rate  -- autoritet za CINJENICE
    Koka    `comment`                              -- autoritet za ZNACENJE
    baza    `Tip` / `Podtip`                       -- iz IZBROJANE povijesti

⚠ RJECNIK SE GRADI BROJANJEM, NE PISE RUKOM
    Kljuc je `Izvod opis` normaliziran na TRGOVCA: rezu se `RATA n/N`, dugi
    brojevi i referentni kod na kraju. Izmjereno S124: bez normalizacije 14 od
    26 redaka ima presedan, s njom 17 -- jer `SPOTIFY P44015227F` i
    `SPOTIFY P450E8139E` su isti Spotify.
    ⚠ Reze se samo sufiks KOJI SADRZI ZNAMENKE. Bez tog uvjeta
      `PAYPAL *DISNEYPLUS` postane `paypal` i svi PayPal trgovci se sliju.
    ⚠ Kljuc koji nije jednoglasan (< 90 %) se NE POGADJA. `KEKS PAY` ima 8
      razlicitih Tipova jer je posrednik, ne trgovac -- rjecnik po `Izvod opis`
      ondje ne smije ni pokusati.

RUCNE ODLUKE (Sasine, S124) -- svaka postaje presedan za idući put
    001 PJ GAJEVA          Zdravlje / Medical_Koka     (Kokin opis: Getaldus)
    TERME JEZERCICA        Zabava / Wellness           (nov Podtip, dodan S124)
    PRIME VIDEO RENT/BUY   Zabava / Prime              (PRIME VIDEO 14/14)
    APPLE.COM/BILL 9,99    Zabava / HBOmax             (Kokin opis "HBOMax")
    AUDIBLE 8,16           Zabava / Audible_Koka       (kartica 1656 + iznos)

⚠ BRISANJE `LH 2/3` IDE U ISTOM POTEZU
    Kokin spojeni redak 63,33 x2 zamjenjuju bankini 62,01 + 1,32 x2 koje ovaj
    uvoz donosi. Odvojeno: prvo brisanje = rupa od 126,66; prvo uvoz = duplikat.

⚠ `session_start` SE NE DODJELJUJE AUTOMATSKI PO PRAVILU
    Kolizija je zastita od dvostrukog uvoza (CLAUDE.md). Uzimaju se SLOBODNE
    minute iz povijesnog pojasa `14:00+n`, i to se ispise u dry runu.
    ⚠ `useActivities` grupira po (user, kategorija, `session_start`), pa dva
      retka iste minute postaju JEDAN redak liste.

Pokretanje:
    python uvezi_transu.py            # dry run
    python uvezi_transu.py --apply
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from uskladi_izvod import (CAT_PROD, ev_date, index_koka, koka_par, load_db,  # noqa: E402
                           load_env, net, norm, parse_mc, uskladi)

ROOT = Path(__file__).resolve().parents[2]
IZVOD = ROOT / 'data-prep_data' / 'Financije' / 'izvodi' / 'MC_2026-07.pdf'
KOKA = ROOT / 'data-prep_data' / 'Financije' / 'Financije 2026-08-23.xlsx'
DRY = '--apply' not in sys.argv

RUCNO = {
    '001 pj gajeva': ('Zdravlje', 'Medical_Koka'),
    # `GARAZA CVJETNI` i `GARAZA KAPTOL` su presedani, ali kljuc je po trgovcu
    # pa Tuskanac nema svoj. Parking je parking -- 134/145 presedana za Podtip.
    'javna garaza tuskanac': ('Prijevoz', 'Taksi, Zet, Parking'),
    'terme jezercica-vodeni': ('Zabava', 'Wellness'),
    'prime video rent / buy': ('Zabava', 'Prime'),
}
# Kljuc + iznos, kad sam trgovac nije dovoljan
RUCNO_IZNOS = {
    ('apple.com/bill', 9.99): ('Zabava', 'HBOmax'),
    ('audible', 8.16): ('Zabava', 'Audible_Koka'),
}
LH_2_3 = ['7e5c06ca-62b8-4160-84b7-7e7024e0207f', 'a7317f60-b174-42bc-9fb6-1675169c5244']


def kljuc(s):
    s = norm(s)
    # ⚠ `[kartica: SASA]` je anotacija pipelinea, ne ime trgovca. Baza drzi
    #   `GOOGLE*YOUTUBE [kartica: SASA]`, izvod samo `GOOGLE*YOUTUBE` -- bez
    #   ovoga 18 presedana na 9,55 ispadne kao "nema presedana".
    #   Nositelj kartice OSTAJE upotrebljiv kao zasebna dimenzija (v. Audible).
    s = re.sub(r'\s*\[kartica:[^\]]*\]\s*', ' ', s)
    s = re.sub(r'\s*rata\s+\d+\s*/\s*\d+\s*$', '', s)
    s = re.sub(r'\d{6,}', '', s)
    s = re.sub(r'[*\s](?=[a-z0-9]{8,}$)(?=[a-z0-9]*\d)[a-z0-9]{8,}$', '', s)
    s = re.sub(r'\s*p-\d+.*$', '', s)
    return re.sub(r'[\s,\-*]+$', '', s).strip()


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    print('=' * 108)
    print('UVOZ TRANSE  ' + IZVOD.name + ('   [DRY RUN]' if DRY else '   [APPLY]'))
    print('=' * 108)

    db = load_db(url, key)
    by_id = {r['id']: r for r in db}
    defs = {d['name']: d for d in req(
        'GET', 'attribute_definitions?category_id=eq.' + CAT_PROD
        + '&select=id,name,data_type')}
    koka = index_koka(KOKA)

    iz = parse_mc(IZVOD)
    iz['ime'] = IZVOD.name
    u = uskladi(iz, db, 'Mastercard', 5)
    red = sorted(u['izvod_bez_para'], key=lambda x: x['datum'])
    if not red:
        sys.exit('Nema redaka za uvoz -- vec je sve u bazi.')

    # -- rjecnik iz potvrdjene povijesti -------------------------------------
    rj = defaultdict(Counter)
    rj_iznos = defaultdict(Counter)
    for r in db:
        a = r['attrs']
        io = a.get('Izvod opis')
        if io and a.get('Tip') not in (None, '', 'N/A'):
            rj[kljuc(io)][(a.get('Tip'), a.get('Podtip'))] += 1
            rj_iznos[(kljuc(io), round(net(a), 2))][(a.get('Tip'), a.get('Podtip'))] += 1

    # -- slobodne minute, po danu --------------------------------------------
    zauzeto = defaultdict(set)
    for r in db:
        ss = r.get('session_start') or ''
        if len(ss) >= 16:
            zauzeto[ss[:10]].add(ss[11:16])

    def slobodna(dan):
        for n in range(0, 300):
            t = (datetime.combine(dan, time(14, 0)) + timedelta(minutes=n)).strftime('%H:%M')
            if t not in zauzeto[dan.isoformat()]:
                zauzeto[dan.isoformat()].add(t)
                return t
        sys.exit('Nema slobodne minute na ' + dan.isoformat())

    # -- sto se upisuje -------------------------------------------------------
    user_id = by_id[LH_2_3[0]]['user_id']          # Kokin account -- ista vlasnica
    plan = []
    nepoznati = []
    for s in red:
        k = kljuc(s['opis'])
        tp = RUCNO_IZNOS.get((k, round(s['iznos'], 2))) or RUCNO.get(k)
        dokaz = 'rucna odluka'
        if not tp:
            c = rj.get(k)
            if c:
                (tip, pod), n = c.most_common(1)[0]
                tot = sum(c.values())
                if len(c) == 1 or n / tot >= 0.9:
                    tp, dokaz = (tip, pod), 'povijest ' + str(n) + '/' + str(tot)
                else:
                    # ⚠ Dvojben trgovac -> pokusaj s IZNOSOM kao drugom razinom.
                    #   `APPLE.COM/BILL` je po trgovcu 26/29 (ispod praga), ali
                    #   `2,99` je 17/17 `Cloud backup`, a `9,99` je 5:3 i ostaje
                    #   dvojben. Trazi se JEDNOGLASNOST i barem 3 presedana --
                    #   jedan presedan po iznosu je slucajnost, ne pravilo.
                    ci = rj_iznos.get((k, round(s['iznos'], 2)))
                    if ci and len(ci) == 1 and sum(ci.values()) >= 3:
                        (tip, pod), n = ci.most_common(1)[0]
                        tp, dokaz = (tip, pod), 'iznos ' + str(n) + '/' + str(n)
        if not tp:
            nepoznati.append(s)
            continue
        kp = koka_par(koka, s['datum'], s['iznos'])
        m = re.search(r'\bRATA\s+(\d+)\s*/\s*(\d+)', s['opis'], re.I)
        plan.append({
            's': s, 'tip': tp[0], 'pod': tp[1], 'dokaz': dokaz,
            'comment': (kp[0][2].strip() if kp and kp[0][2].strip() else s['opis']),
            'rata': (int(m.group(1)), int(m.group(2))) if m else None,
            'ss': slobodna(s['datum']),
        })

    if nepoznati:
        print('⚠ BEZ KLASIFIKACIJE -- ne uvozim nista dok se ne rijese:')
        for s in nepoznati:
            print('   ' + s['datum'].strftime('%d.%m.') + '  ' + s['opis'][:40] + '  '
                  + format(s['iznos'], '.2f') + '   kljuc [' + kljuc(s['opis']) + ']')
        sys.exit('STOP -- ' + str(len(nepoznati)) + ' redaka bez Tip/Podtip.')

    print(f"{'datum':<8}{'ss':<7}{'opis (Koka)':<20}{'iznos':>8}  {'rata':<6}"
          f"{'Tip / Podtip':<36}dokaz")
    print('-' * 108)
    for p in plan:
        s = p['s']
        print(f"{s['datum'].strftime('%d.%m.'):<8}{p['ss']:<7}{p['comment'][:18]:<20}"
              f"{s['iznos']:>8.2f}  "
              f"{(str(p['rata'][0]) + '/' + str(p['rata'][1])) if p['rata'] else '—':<6}"
              f"{(p['tip'] + ' / ' + p['pod'])[:35]:<36}{p['dokaz']}")
    print('-' * 108)
    print(str(len(plan)) + ' redaka   ukupno ' + format(sum(p['s']['iznos'] for p in plan), '.2f')
          + '   (izvod trazi ' + format(sum(x['iznos'] for x in red), '.2f') + ')')

    print('\nBRISANJE u istom potezu (`LH 2/3` -- zamjenjuju ih bankini redci gore):')
    for eid in LH_2_3:
        r = by_id.get(eid)
        if not r:
            sys.exit('LH 2/3 redak ' + eid[:8] + ' vise ne postoji -- STOP.')
        print('   ' + r['event_date'] + '  ' + str(r['comment']) + '  '
              + format(net(r['attrs']), '.2f'))

    if DRY:
        print('\nDRY RUN -- nista upisano. Za primjenu: --apply')
        return

    # -- backup ---------------------------------------------------------------
    inl = '(' + ','.join(LH_2_3) + ')'
    bak = {'events': req('GET', 'events?id=in.' + inl + '&select=*'),
           'attributes': req('GET', 'event_attributes?event_id=in.' + inl + '&select=*')}
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bp = ROOT / 'data-prep_data' / 'Financije' / '_arhiva' / ('backup_transa_' + stamp + '.json')
    bp.parent.mkdir(parents=True, exist_ok=True)
    bp.write_text(json.dumps(bak, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\nbackup obrisanih: ' + bp.name)

    # -- upis -----------------------------------------------------------------
    ATTR = ['Racun', 'Izvor', 'Smjer', 'Isplata', 'Uplata', 'Tip', 'Podtip',
            'Izvod opis', 'Rate?', 'Broj rata', 'Rata br', 'Datum naplate',
            'Status', 'Valuta']
    dosp = iz['dospijece'].isoformat()
    for p in plan:
        s = p['s']
        ss = s['datum'].isoformat() + 'T' + p['ss'] + ':00+00:00'
        ev = req('POST', 'events', {
            'category_id': CAT_PROD, 'user_id': user_id,
            'event_date': s['datum'].isoformat(), 'session_start': ss,
            'created_at': ss, 'comment': p['comment']})
        if not ev:
            sys.exit('INSERT eventa vratio 0 redaka -- STOP.')
        eid = ev[0]['id']
        vals = {'Racun': 'Kokin tekući ZABA', 'Izvor': 'Mastercard',
                'Smjer': 'Isplata' if s['iznos'] > 0 else 'Uplata',
                'Isplata': s['iznos'] if s['iznos'] > 0 else None,
                'Uplata': -s['iznos'] if s['iznos'] < 0 else None,
                'Tip': p['tip'], 'Podtip': p['pod'], 'Izvod opis': s['opis'],
                'Rate?': True if p['rata'] else None,
                'Broj rata': p['rata'][1] if p['rata'] else None,
                'Rata br': p['rata'][0] if p['rata'] else None,
                'Datum naplate': dosp + 'T12:00:00+00:00',
                'Status': 'Izvrsen', 'Valuta': 'EUR'}
        for name in ATTR:
            v = vals.get(name)
            if v is None:
                continue
            d = defs[name]
            col = {'boolean': 'value_boolean', 'number': 'value_number',
                   'datetime': 'value_datetime'}.get(d['data_type'], 'value_text')
            got = req('POST', 'event_attributes',
                      {'event_id': eid, 'attribute_definition_id': d['id'],
                       'user_id': user_id, col: v})
            if not got:
                sys.exit('Upis ' + name + ' na novom retku vratio 0 -- STOP.')

    for eid in LH_2_3:
        n_at = sum(1 for a in bak['attributes'] if a['event_id'] == eid)
        d1 = req('DELETE', 'event_attributes?event_id=eq.' + eid + '&select=id')
        if len(d1) != n_at:
            sys.exit('Obrisano ' + str(len(d1)) + '/' + str(n_at) + ' atributa -- STOP.')
        d2 = req('DELETE', 'events?id=eq.' + eid + '&select=id')
        if len(d2) != 1:
            sys.exit('Brisanje eventa vratilo ' + str(len(d2)) + ' -- STOP.')

    print('upisano ' + str(len(plan)) + ' novih redaka, obrisano ' + str(len(LH_2_3)))
    print('gotovo. Pusti `uskladi_izvod.py --izvod MC_2026-07.pdf --dry`'
          ' -- uvoz i duplikat moraju pasti na 0.')


if __name__ == '__main__':
    main()
