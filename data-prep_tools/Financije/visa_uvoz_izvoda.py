# -*- coding: utf-8 -*-
"""
visa_uvoz_izvoda.py  (S148, 2026-09-24)
=======================================
Jedan PBZ Visa izvod -> Excel za uvoz kroz aplikaciju (Koka, vlasnica Aree):
  * NOVI retci  — stavke izvoda kojih baza nema (iznos/datum/`Izvod opis` s
                  izvoda, `Tip`/`Podtip` iz BROJANE povijesti — `presedani.py`);
  * ISPRAVCI    — retci koji postoje: `Datum naplate` = stvarna naplata s RF-a,
                  `Status = Izvrsen` (S147: racun je teretio), `Izvod opis`.

Prvi put izveden nad `PBZVIZA_2026-08.pdf` (naplata 07.09.2026. = 1.218,38).

/!\ RATA SE SPARUJE PO PLANU I BROJU RATE, NIKAD PO DATUMU. Sve rate jedne
    kupnje dijele `event_date` = dan kupnje; sparivanje po (datum, iznos)
    spoji `RATA 03/06` s retkom `2/6` koji je naplacen PROSLI mjesec —
    izmjereno u prvom prolazu ove sesije (7 od 7 rata "nadjeno", 0 stvarno).
    Nova rata nasljedjuje `Tip`/`Podtip`/opis od svoje rate 1 (isti plan).

/!\ PRIBLIZNI IZNOSI (`~`) SE NE POGADJAJU — idu kroz izmjeren popis `RUCNO`
    (Sasina potvrda). Ispravak ide Editom postojeceg retka, nikad novim
    retkom: dedup je `(datum, iznos)`, pa bi `55,00` i `58,19` ostala DVA.

/!\ NOVI REDAK DOBIVA SLOBODNU MINUTU U POJASU 14:00+ (lokalno), izbjegavajuci
    svaki postojeci `session_start` tog dana — `useActivities` grupira po
    (user, kategorija, session_start), a kolizija je zastita od dvostrukog uvoza.

Pokretanje:
  $env:ET_TARGET='prod'; Financije\\run.bat visa_uvoz_izvoda.py PBZVIZA_2026-08.pdf 2026-09-07
  (dodaj --file za xlsx)
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, time
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from _db import load_env  # noqa: E402
from enrich_from_izvoda import parse_pbz_visa  # noqa: E402
from fill_from_izvod import short_opis  # noqa: E402
from presedani import Presedani  # noqa: E402
from uskladi_izvod import load_db  # noqa: E402
from visa_kosare import IZVODI, num  # noqa: E402
from visa_popravak import lokalno as lokalno_hhmm, pisi  # noqa: E402

RACUN = 'Sašin tekući RF'
RATA_RE = re.compile(r'^RATA\s*(\d+)\s*/\s*(\d+)\s*-\s*(.+)$')

# Izmjeren popis priblizno upisanih redaka -> bankin redak (datum, iznos).
# Sasine potvrde, S148. Komentar gubi `~` jer iznos vise nije priblizan.
RUCNO = {
    '2629b37d': (date(2026, 8, 24), 8.50),    # Biberon rucak s Druom ~ 8,00
    '3b15c2b7': (date(2026, 8, 24), 58.19),   # Ina Heinzlova, gorivo ~ 55,00
    'e4317c28': (date(2026, 8, 25), 2.30),    # DM zubni konac 2x 5,00 (Sasa: "moze 2,30")
}


# Klasifikacija gdje je povijest jasna, a automat je nije nasao (rata 1 plana je
# u bazi `N/A`, pa rata 2 nema od koga naslijediti). S148, prikazano Sasi.
KLASA = {
    'BAUHAUS': ('Kuća', 'Popravci, održavanje, osiguranje'),     # 32/32
    'SPAR': ('Domaćinstvo', 'Hrana i ostalo'),                    # 85/91
    'PEKARA DINARA': ('Domaćinstvo', 'Hrana i ostalo'),           # 2/2
    'GARAGE CVJETNI': ('Prijevoz', 'Taksi, Zet, Parking'),
}
# Rate 1 istih planova, vec u bazi s `N/A` -> ista klasifikacija (samo Tip/Podtip).
KLASA_POSTOJECI = {'d8bcfb8b': 'BAUHAUS', '6e02c965': 'BAUHAUS', '992067fd': 'SPAR'}


def rucna_klasa(opis: str):
    o = opis.upper()
    for k, v in KLASA.items():
        if k in o:
            return {'tip': v[0], 'podtip': v[1], 'comment': None, 'dokaz': f'KLASA {k} (S148)'}
    return None


def taksonomija(url, key):
    from _db import rest
    from uskladi_izvod import CAT_PROD
    d = rest(url, key, 'attribute_definitions?category_id=eq.' + CAT_PROD
             + '&name=eq.Podtip&select=id,validation_rules')[0]
    om = d['validation_rules']['depends_on']['options_map']
    return {t: v for t, v in om.items() if t not in ('*', 'N/A')}


def trgovac(opis: str) -> str:
    return re.sub(r'\[kartica:[^\]]*\]', '', opis).split(' - ')[0].strip().upper()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2:
        sys.exit('Upotreba: visa_uvoz_izvoda.py <PBZVISA_YYYY-MM.pdf> <naplata YYYY-MM-DD>')
    izvod = next(IZVODI.rglob(args[0]), None)
    if not izvod:
        sys.exit(f'✗ Nema {args[0]} ni u izvodi/ ni u Analizirani_izvodi/')
    naplata = date.fromisoformat(args[1])

    target = os.environ.get('ET_TARGET', 'test').strip().lower()
    url, key = load_env(target)
    print(f'[{target.upper()}] {url}   izvod {izvod.name}   naplata {naplata}')
    rows = load_db(url, key)
    by8 = {r['id'][:8]: r for r in rows}

    tx = parse_pbz_visa(izvod)
    isp = [t for t in tx if t['smjer'] == 'Isplata']
    s_iz = round(sum(t['iznos'] for t in isp), 2)
    rf = [r for r in rows if r['event_date'] == str(naplata)
          and r['attrs'].get('Izvor') == 'Racun' and r['attrs'].get('Racun') == RACUN
          and abs(num(r['attrs'].get('Isplata')) - s_iz) < 0.005]
    print(f'izvod: {len(isp)} isplata, Σ {s_iz:.2f}; RF naplata tog dana istog iznosa: '
          f'{"DA" if rf else "NE"}')
    if not rf:
        sys.exit('✗ Σ izvoda nema par na RF-u zadanog dana — krivi izvod ili datum. Stajem.')

    visa = [r for r in rows if r['attrs'].get('Izvor') == 'Visa']
    iskoristeni = set()
    ispravci, novi = [], []

    # -- 1. rucni parovi (priblizni iznosi)
    rucno_tx = {}
    for pref, (d, iznos) in RUCNO.items():
        t = next((t for t in isp if t['date'] == d and abs(t['iznos'] - iznos) < 0.005
                  and id(t) not in rucno_tx), None)
        if not t:
            sys.exit(f'✗ RUCNO {pref}: na izvodu nema {d} {iznos}')
        rucno_tx[id(t)] = by8[pref]

    for t in sorted(isp, key=lambda t: t['date']):
        m = RATA_RE.match(t['opis'])
        if id(t) in rucno_tx:
            r = rucno_tx[id(t)]
            kom = re.sub(r'\s*~\s*', ' ', str(r.get('comment') or '')).strip()
            ispravci.append((r, {'Isplata': t['iznos']}, kom, t,
                             f'iznos {num(r["attrs"].get("Isplata")):.2f} → {t["iznos"]:.2f} (banka)'))
            iskoristeni.add(r['id'])
            continue
        if m:
            n, N, trg = int(m.group(1)), int(m.group(2)), trgovac(m.group(3))
            plan = [r for r in visa if r['event_date'] == str(t['date'])
                    and trg[:12] in str(r['attrs'].get('Izvod opis') or '').upper()]
            ista = [r for r in plan if int(num(r['attrs'].get('Rata br'))) == n]
            if ista:
                ispravci.append((ista[0], {}, None, t, 'rata vec postoji'))
                iskoristeni.add(ista[0]['id'])
                continue
            uzor = sorted(plan, key=lambda r: num(r['attrs'].get('Rata br')))
            novi.append((t, {'rata': (n, N), 'uzor': uzor[0] if uzor else None}))
            continue
        k = [r for r in visa if r['id'] not in iskoristeni
             and abs(num(r['attrs'].get('Isplata')) - t['iznos']) < 0.005
             and abs((date.fromisoformat(r['event_date']) - t['date']).days) <= 3]
        if k:
            k.sort(key=lambda r: abs((date.fromisoformat(r['event_date']) - t['date']).days))
            ispravci.append((k[0], {}, None, t, 'sparen'))
            iskoristeni.add(k[0]['id'])
        else:
            novi.append((t, {}))

    # -- 2. retci u kosari ovog ciklusa koje izvod ne potvrdjuje
    ym = f'{naplata.year:04d}-{naplata.month:02d}'
    visak = [r for r in visa if r['id'] not in iskoristeni
             and str(r['attrs'].get('Datum naplate'))[:7] == ym]

    # -- 3. klasifikacija novih iz povijesti Visa redaka PRIJE ovog izvoda
    od = str(min(t['date'] for t in isp if not RATA_RE.match(t['opis'])))
    pres = Presedani(visa, prije=od)
    # Druga razina: TRGOVAC bez adrese i sifre poslovnice (`short_opis`), brojen
    # nad Visa + MC povijescu. `presedani` uzima prve tri rijeci pa `INA BP TRG`
    # i `INA BP MIRAMARSKA` ispadnu dva trgovca (izmjereno S148: 22 od 37 N/A).
    # Isti prag kao `presedani`: >= 3 odlucena i >= 90 % jednoglasno.
    po_trg = defaultdict(list)
    for r in rows:
        a = r['attrs']
        if (a.get('Izvor') in ('Visa', 'Mastercard') and r['event_date'] < od
                and a.get('Izvod opis') and a.get('Tip') and a.get('Tip') != 'N/A'):
            po_trg[short_opis(str(a['Izvod opis'])).upper()].append((a['Tip'], a.get('Podtip')))

    def po_trgovcu(opis):
        same = po_trg.get(short_opis(opis).upper(), [])
        if len(same) < 3:
            return None
        from collections import Counter
        (tp, n), = Counter(same).most_common(1)
        if n / len(same) < 0.9:
            return None
        return {'tip': tp[0], 'podtip': tp[1], 'comment': None,
                'dokaz': f'trgovac {short_opis(opis)!r}, {n}/{len(same)} (Visa+MC)'}
    zauzeto = defaultdict(set)
    for r in rows:
        zauzeto[r['event_date']].add(lokalno_hhmm(r['session_start']))

    def slobodna(d: str) -> str:
        for i in range(0, 600):
            hh = f'{14 + i // 60:02d}:{i % 60:02d}'
            if hh not in zauzeto[d]:
                zauzeto[d].add(hh)
                return hh
        raise RuntimeError(d)

    izlaz = []   # (redak|None, attrs, komentar, delete?, zasto, [event_date, hh])
    print(f'\nISPRAVCI ({len(ispravci)}):')
    for r, nove, kom, t, zasto in ispravci:
        a = dict(r['attrs'])
        a.update({'Datum naplate': naplata, 'Status': 'Izvrsen', 'Izvod opis': t['opis']})
        a.update(nove)
        k = kom if kom is not None else r.get('comment')
        izlaz.append((r, a, k, False, f'ISPRAVI — {zasto}; naplata {naplata}, Izvrsen'))
        print(f'  {r["event_date"]} {num(r["attrs"].get("Isplata")):8.2f}  {str(r.get("comment"))[:30]:30} ← {t["opis"][:40]}  [{zasto}]')

    print(f'\nNOVI ({len(novi)}, Σ {sum(t["iznos"] for t, _ in novi):.2f}):')
    bez = 0
    for t, info in novi:
        a = {'Racun': RACUN, 'Izvor': 'Visa', 'Smjer': 'Isplata', 'Isplata': t['iznos'],
             'Izvod opis': t['opis'], 'Datum naplate': naplata, 'Status': 'Izvrsen'}
        if 'rata' in info:
            n, N = info['rata']
            u = info['uzor']
            a.update({'Rate?': True, 'Broj rata': N, 'Rata br': n})
            if u and u['attrs'].get('Tip') not in (None, 'N/A'):
                a.update({'Tip': u['attrs'].get('Tip'), 'Podtip': u['attrs'].get('Podtip')})
                kom = re.sub(r'\s*\d+/\d+\s*$', '', str(u.get('comment') or '')) + f' {n}/{N}'
                dokaz = f'rata {n}/{N}, klasifikacija s rate {int(num(u["attrs"].get("Rata br")))}'
            elif u:
                p = rucna_klasa(t['opis'])
                a.update({'Tip': p['tip'] if p else 'N/A', 'Podtip': p['podtip'] if p else 'N/A'})
                kom = re.sub(r'\s*\d+/\d+\s*$', '', str(u.get('comment') or '')) + f' {n}/{N}'
                dokaz = f'rata {n}/{N}; ' + (p['dokaz'] if p else 'rata 1 je N/A')
            else:
                p = pres.nadji(t['iznos'], t['opis']) or po_trgovcu(t['opis'])
                a.update({'Tip': p['tip'] if p else 'N/A', 'Podtip': p['podtip'] if p else 'N/A'})
                kom = (p and p['comment'] or short_opis(t['opis'])) + f' {n}/{N}'
                dokaz = f'NOV PLAN {n}/{N}; ' + (p['dokaz'] if p else 'nema presedana')
        else:
            p = (pres.nadji(t['iznos'], t['opis']) or po_trgovcu(t['opis'])
                 or rucna_klasa(t['opis']))
            a.update({'Tip': p['tip'] if p else 'N/A', 'Podtip': p['podtip'] if p else 'N/A'})
            kom = (p and p['comment']) or short_opis(t['opis'])
            dokaz = p['dokaz'] if p else 'NEMA PRESEDANA — N/A'
        if a['Tip'] == 'N/A':
            bez += 1
        d = str(t['date'])
        izlaz.append((None, a, kom, False, 'NOVO — ' + dokaz, [d, slobodna(d)]))
        print(f'  {d} {t["iznos"]:8.2f}  {kom[:28]:28} {a["Tip"]}/{a["Podtip"]}  [{dokaz}]')
    print(f'  → {bez} bez klasifikacije (N/A)')

    print(f'\nU KOŠARI {ym}, IZVOD IH NE POTVRĐUJE ({len(visak)}):')
    for r in visak:
        print(f'  {r["event_date"]} {num(r["attrs"].get("Isplata")):8.2f} {r.get("comment")}')

    zbroj = round(sum(num(a.get('Isplata')) for _, a, *_ in izlaz), 2)
    for pref, k in KLASA_POSTOJECI.items():
        r = by8[pref]
        a = dict(r['attrs'])
        a.update({'Tip': KLASA[k][0], 'Podtip': KLASA[k][1]})
        izlaz.append((r, a, r.get('comment'), False, f'ISPRAVI — samo Tip/Podtip (KLASA {k}); nije u kosari'))
        print(f'  + klasifikacija postojeceg {r["event_date"]} {r.get("comment")} → {KLASA[k]}')
    print(f'\nKONTROLA: Σ (ispravci + novi) = {zbroj:.2f}  vs izvod {s_iz:.2f}  '
          f'→ {"✓ u cent" if abs(zbroj - s_iz) < 0.005 else "✗ RAZLIKA"}')

    if '--file' in sys.argv:
        pisi(izlaz, by8, 'visa_uvoz_' + izvod.stem.split('_')[-1], taksonomija(url, key))


if __name__ == '__main__':
    main()
