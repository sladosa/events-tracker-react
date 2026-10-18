# -*- coding: utf-8 -*-
"""
_mc_spajanje.py — MC izvod <-> baza: sto je ISPRAVAK, sto NOVO, sto DUPLIKAT. S173.
=====================================================================================
Ono sto `visa_uvoz_izvoda.py` radi za Visu od S161, za Mastercard. Zove ga
`fill_from_izvod.py --mc`; ovdje se samo odlucuje, pisanje filea je tamo.

Do S173 je `--mc` znao samo „nema para ⇒ nov redak", pa je MC_2026-09 dao 21
redak za uvoz od kojih su 4 bila DUPLIKATI (S158 slozio file rucno). Koraci:

  1. RATE — po PLANU I BROJU RATE, nikad po datumu (isti razlog kao Visa: rata
     nosi dan kupnje, izvod dan terecenja). Plan = trgovac + N + MJESEC POCETKA
     (`Datum naplate` − (n−1)), kao `rate_alat.plans()`. Iznos se smije
     razlikovati do 15 % (cent ostatka, `~` procjena) ⇒ ISPRAVAK, ne nov redak.
  2. NAKNADE 1,32 (T23) — izvod uz svaku naknadu nosi referencu RATE, pa
     naknada ide u plan te rate: postojeca (generirana) se spari, inace NOVA,
     a za buduce rate istog plana se generiraju one koje fale.
  3. OSTALO — `uskladi_izvod.uskladi()` (sidro `Izvod opis`, iznos ±5 dana,
     potvrden s krivim dospijecem, 1:N, „daleki"). Logika je ondje i ne kopira se.
  4. BLIZAK IZNOS (T13) — ±2 dana, ≤ 15 %, par JEDINI s obje strane (Visa S161).
  5. DUPLIKATI (T14) — nesparen redak kosare s istim iznosom kao sparen ±2 dana;
     za plan: drugi plan istog N/n/iznosa, a izvod zna jedan (zagrada, T15).
     Samo PRIJAVA; brise se tek uz `--brisi=<id8>`.

/!\\ RATA NASLJEDUJE PLAN (T16): `Tip`/`Podtip` i komentar `<Trgovac> n/N` od
    rate istog plana, a `event_date` = dan PRVE rate plana — isto sto upisuje
    `rate_alat` za buduce rate. Do S173 je nova rata dobivala dan knjizenja
    (28.09.) i `N/A`, iako je rata 1 bila razvrstana.

/!\\ `Status` se NE prebacuje u `Izvrsen` (S147, T19) — to radi traka kad racun
    stvarno tereti. Prazan `Status` dobiva `Planiran` (T20).
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, timedelta

from rate_alat import plans as _plans, plus_months
from uskladi_izvod import ev_date, net, norm, uskladi

EPS = 0.005
NAKNADA = 1.32
BLIZU_DANA, BLIZU_UDIO = 2, 0.15          # isto kao visa_uvoz_izvoda (S161)
RATA_RE = re.compile(r'^(.*?)\s*\bRATA\s+(\d+)\s*/\s*(\d+)\s*$', re.I)
NAKNADA_RE = re.compile(r'^NAKNADA ZA OBRO', re.I)
NAKNADA_TIP = ('Domaćinstvo', 'Bankovni troškovi')    # 7/7 presedana (S158)


def mjesec(d: date) -> int:
    return d.year * 12 + d.month - 1


def due(r) -> date | None:
    v = str(r['attrs'].get('Datum naplate') or '')[:10]
    return date.fromisoformat(v) if v else None


def rata_izvoda(opis: str):
    """`KONZUM P-3200 RATA 7/12` -> ('KONZUM P-3200', 7, 12)."""
    m = RATA_RE.match(opis or '')
    return (m.group(1).strip(), int(m.group(2)), int(m.group(3))) if m else None


def isti_trgovac(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    a, b = norm(a), norm(b)
    return a == b or a[:12] == b[:12]


def oznaka(komentar: str | None, trg: str) -> str:
    """Ime plana za komentar `<Trgovac> n/N`: komentar rate bez broja, inace
    trgovac s izvoda. `rata 1/3 · 45 od 135` (rata modal) nije ime nego opis."""
    from fill_from_izvod import short_opis
    c = re.sub(r'^~\s*', '', str(komentar or '')).strip()
    c = re.sub(r'\s*\bRATA\b\s*\d+\s*/\s*\d+\s*$', '', c, flags=re.I)
    c = re.sub(r'\s*\d+\s*/\s*\d+\s*$', '', c).strip()
    if not c or c.lower().startswith('rata') or '·' in c:
        c = short_opis(trg)
    return c


def potvrdjen_drugdje(r, dosp: date) -> bool:
    """Redak koji je izvod DRUGOG ciklusa vec ozigosao nije kandidat (Visa S161);
    zig istog dospijeca ostaje kandidat ⇒ ponovni prolaz daje nula promjena."""
    return bool(r['attrs'].get('Izvod opis')) and due(r) != dosp


def _rata_retka(r):
    """(trgovac|None, n, N) iz `Izvod opis` (autoritet), inace iz atributa."""
    x = rata_izvoda(str(r['attrs'].get('Izvod opis') or ''))
    if x:
        return x
    a = r['attrs']
    if a.get('Rate?') is True and a.get('Rata br') and a.get('Broj rata'):
        return (None, int(float(a['Rata br'])), int(float(a['Broj rata'])))
    return None


def ime_plana(redci: list, trg: str) -> str:
    """Najcesci oblik imena medju ratama plana (T18). Izmjereno: Keindl 9/12 nosi
    Kokin tipfeler `Konzum 3/3`, pa bi „ime sa zadnje rate" svaku iducu Keindl
    ratu nazvalo Konzum."""
    from collections import Counter
    from fill_from_izvod import short_opis
    imena = Counter(oznaka(r.get('comment'), trg) for r in redci)
    sirovo = short_opis(trg)
    # strojni tekst izvoda je zadnji izbor — ime koje je covjek napisao ga pobijedi
    return max(imena, key=lambda k: (k != sirovo and not k.isupper(), imena[k]))


def spari(iz: dict, db: list[dict], izvor: str = 'Mastercard', tol: int = 5,
          klasa=None) -> dict:
    """Vraca odluke; nista ne pise. `iz` = `uskladi_izvod.parse_mc()`.
    `klasa(t)` -> (Tip, Podtip) | None: presedan retka izvoda; sluzi kao dokaz
    kad isti redak baze traze dva retka izvoda (T13)."""
    dosp = iz['dospijece']
    mc = [r for r in db if r['attrs'].get('Izvor') == izvor]
    used: set[str] = set()
    parovi: list[dict] = []          # {t, r, zasto}
    novi: list[dict] = []            # {t, event_date, tip, podtip, komentar, rata, zasto}
    plan_retka: dict[str, dict] = {}  # ref izvoda -> {'E': event_date, 'oznaka', 'n', 'N'}

    # trgovac generiranih rata (bez `Izvod opis`) — od retka plana s istim
    # danom kupnje, Izvorom i N (rate_alat sve rate plana datira danom prve)
    trg_po_danu = defaultdict(set)
    for r in mc:
        x = rata_izvoda(str(r['attrs'].get('Izvod opis') or ''))
        if x:
            trg_po_danu[(r['event_date'], x[2])].add(x[0])

    rate_db = []
    for r in mc:
        x = _rata_retka(r)
        if not x or not due(r):
            continue
        trg, n, N = x
        if trg is None:
            t = trg_po_danu.get((r['event_date'], N), set())
            trg = next(iter(t)) if len(t) == 1 else None
        rate_db.append({'r': r, 'trg': trg, 'n': n, 'N': N,
                        'start': mjesec(due(r)) - (n - 1)})

    planovi = _plans(db)

    def plan_za(trg, N, start, iznos):
        """Postojeci plan iz `Izvod opis`a (rate_alat.plans): trgovac + N +
        pocetak; dva plana istog pocetka (P-1000 30,18 / 30,38) razdvaja iznos."""
        k = [(key, v) for key, v in planovi.items()
             if key[1] == N and key[2] == start and isti_trgovac(key[0], trg)
             and all(x[1]['attrs'].get('Izvor') == izvor for x in v)]
        if not k:
            return None
        key, v = min(k, key=lambda kv: min(abs(abs(net(x[1]['attrs'])) - abs(iznos)) for x in kv[1]))
        return sorted(v, key=lambda x: x[0])

    rate_iz = [t for t in iz['rows'] if rata_izvoda(t['opis'])]
    naknade_iz = [t for t in iz['rows'] if NAKNADA_RE.match(t['opis'])]

    # -- 1. RATE: plan + broj rate (+ zagrada kao dokaz kupnje)
    for t in rate_iz:
        trg, n, N = rata_izvoda(t['opis'])
        start = mjesec(dosp) - (n - 1)
        kand = []
        for x in rate_db:
            r = x['r']
            if (r['id'] in used or x['n'] != n or x['N'] != N or x['start'] != start
                    or potvrdjen_drugdje(r, dosp)):
                continue
            if x['trg'] is not None and not isti_trgovac(x['trg'], trg):
                continue
            d = abs(abs(net(r['attrs'])) - abs(t['iznos']))
            if d > BLIZU_UDIO * abs(t['iznos']):
                continue
            dokaz = x['trg'] is not None or (t.get('kupnja') and ev_date(r) == t['kupnja'])
            kand.append((not dokaz, d, r))
        if kand:
            _, _, r = min(kand, key=lambda k: (k[0], k[1]))
            used.add(r['id'])
            parovi.append({'t': t, 'r': r, 'zasto': f'rata {n}/{N}'})
            plan_retka[t['ref']] = {'E': r['event_date'], 'oznaka': oznaka(r.get('comment'), trg),
                                    'n': n, 'N': N}
            continue
        # Kokin redak rate BEZ `Rate?` (upisan rukom, `Konzum 1/6`): komentar nosi
        # `n/N`, a iznos je blizu. Bez ovoga S158 `15,36` ostaje, a `15,37` ude kao nov.
        kk = [r for r in mc if r['id'] not in used and not _rata_retka(r) and due(r) == dosp
              and re.search(rf'(?<!\d){n}\s*/\s*{N}(?!\d)', str(r.get('comment') or ''))
              and abs(abs(net(r['attrs'])) - abs(t['iznos'])) <= BLIZU_UDIO * abs(t['iznos'])]
        if len(kk) == 1:
            r = kk[0]
            used.add(r['id'])
            parovi.append({'t': t, 'r': r, 'zasto': f'rata {n}/{N} (komentar, bez `Rate?`)'})
            plan_retka[t['ref']] = {'E': r['event_date'], 'oznaka': oznaka(r.get('comment'), trg),
                                    'n': n, 'N': N}
            continue
        # nema retka: rata postojeceg plana (T16) ili nov plan
        p = plan_za(trg, N, start, t['iznos'])
        if p:
            n_u, uzor = sorted(p, key=lambda x: (x[1]['attrs'].get('Tip') in (None, 'N/A'), -x[0]))[0]
            E = p[0][1]['event_date']        # dan PRVE rate plana — kao rate_alat
            novi.append({'t': t, 'event_date': E, 'rata': (n, N),
                         'tip': uzor['attrs'].get('Tip'), 'podtip': uzor['attrs'].get('Podtip'),
                         'komentar': f'{ime_plana([x[1] for x in p], trg)} {n}/{N}',
                         'zasto': f'rata {n}/{N} plana od {E}, razvrstano s rate {n_u}'})
        else:
            E = str(t.get('kupnja') or t['datum'])
            novi.append({'t': t, 'event_date': E, 'rata': (n, N), 'tip': None, 'podtip': None,
                         'komentar': f'{oznaka(None, trg)} {n}/{N}', 'nov_plan': True,
                         'zasto': f'NOV PLAN {n}/{N}' + (f', kupnja {E} (zagrada)' if t.get('kupnja') else '')})
        plan_retka[t['ref']] = {'E': novi[-1]['event_date'], 'n': n, 'N': N,
                                'oznaka': novi[-1]['komentar'].rsplit(' ', 1)[0]}

    # Duplikat PLANA (T14): nesparena rata kosare istog N/n/iznosa kao sparena,
    # a izvod je nosi jednom. Tek POSLIJE svih rata — dva prava ista plana
    # (LUFTHAN…447 / …448, S137) izvod nosi dvaput i oba se spare.
    duplikati_plana = []
    for p in [p for p in parovi if rata_izvoda(p['t']['opis'])]:
        t, r = p['t'], p['r']
        _, n, N = rata_izvoda(t['opis'])
        start = mjesec(dosp) - (n - 1)
        for y in rate_db:
            r2 = y['r']
            if (r2['id'] in used or y['n'] != n or y['N'] != N or y['start'] != start
                    or abs(abs(net(r2['attrs'])) - abs(t['iznos'])) >= EPS
                    or (y['trg'] is not None and not isti_trgovac(y['trg'], rata_izvoda(t['opis'])[0]))
                    or potvrdjen_drugdje(r2, dosp)):
                continue
            clan = sorted((z['r'] for z in rate_db if z['r']['event_date'] == r2['event_date']
                           and z['N'] == N and z['start'] == start and z['r']['id'] not in used
                           and abs(abs(net(z['r']['attrs'])) - abs(t['iznos'])) < EPS),
                          key=lambda q: _rata_retka(q)[1])
            duplikati_plana.append({'r': r2, 'kao': r, 'clanovi': clan, 't': t})
            used.update(q['id'] for q in clan)

    # -- 2. NAKNADE (T23): svaka ide u plan svoje rate
    buduce = []
    for k in naknade_iz:
        p = plan_retka.get(k.get('za_ref'))
        if not p:
            novi.append({'t': k, 'event_date': str(k['datum']), 'tip': NAKNADA_TIP[0],
                         'podtip': NAKNADA_TIP[1], 'komentar': k['opis'],
                         'zasto': '⚠ naknada bez rate na izvodu'})
            continue
        # ⚠ Naknade su ZAMJENJIVE (sve 1,32, ista kosara) — dan plana je samo
        #   prednost. Izmjereno na stanju poslije S158: rucni uvoz ih je datirao
        #   danom KNJIZENJA (28.09.), pa bi uvjet „dan plana" proglasio tri prave
        #   naknade duplikatima i ponudio tri nove.
        kand = [r for r in mc if r['id'] not in used and abs(abs(net(r['attrs'])) - NAKNADA) < EPS
                and due(r) == dosp and not _rata_retka(r) and not potvrdjen_drugdje(r, dosp)]
        if kand:
            r = min(kand, key=lambda r: (r['event_date'] != p['E'], ev_date(r) != k['datum'],
                                         r.get('session_start') or ''))
            used.add(r['id'])
            parovi.append({'t': k, 'r': r, 'zasto': f'naknada rate {p["oznaka"]} {p["n"]}/{p["N"]}'})
        else:
            novi.append({'t': k, 'event_date': p['E'], 'tip': NAKNADA_TIP[0], 'podtip': NAKNADA_TIP[1],
                         'komentar': f'Naknada za ratu · {p["oznaka"]} {p["n"]}/{p["N"]}',
                         'zasto': f'naknada rate {p["n"]}/{p["N"]} (plan od {p["E"]})'})
        nov = any(n['t'].get('ref') == k.get('za_ref') and n.get('nov_plan') for n in novi)
        for m in range(p['n'] + 1, p['N'] + 1):
            buduce.append({'E': p['E'], 'due': plus_months(dosp, m - p['n']), 'nov': nov,
                           'komentar': f'Naknada za ratu · {p["oznaka"]} {m}/{p["N"]}'})
    # Buduce naknade: generiraju se samo one koje FALE, brojeno PO DOSPIJECU —
    # ne po (dan, dospijece): postojeca `Naknada za ratu · Miele 3/3` nosi dan
    # prve rate (29.08.), a S158 rata 2/3 dan knjizenja (28.09.). Trebaju = broj
    # planova s naknadom koji imaju ratu tog dospijeca; ima = naknade tog dospijeca.
    # KOJE fale (radi komentara — zbroj je isti): postojeca naknada pokriva plan
    # svog dana, pa plan svog imena, a ostatak pokriva STARE planove — nikad nov
    # plan s ovog izvoda (njegove naknade sigurno jos ne postoje). Izmjereno:
    # S158 ih je nazvao `Booking 3/3`, alat `PAYPAL *BOOKING HOTEL 3/3`.
    trebaju = defaultdict(list)
    for b in buduce:
        trebaju[b['due']].append(b)
    generirane = []
    for d, bs in sorted(trebaju.items()):
        ima = [r for r in mc if due(r) == d and not _rata_retka(r)
               and abs(abs(net(r['attrs'])) - NAKNADA) < EPS]
        otvoreni = list(bs)
        for uvjet in (lambda b, r: r['event_date'] == b['E'],
                      lambda b, r: norm(b['komentar'].split(' · ', 1)[-1].rsplit(' ', 1)[0])[:6]
                      in norm(r.get('comment') or ''),
                      lambda b, r: not b['nov']):
            for r in list(ima):
                b = next((b for b in otvoreni if uvjet(b, r)), None)
                if b:
                    otvoreni.remove(b)
                    ima.remove(r)
        generirane += otvoreni

    # -- 3. OSTALO: uskladi() nad onim sto rate i naknade nisu uzele
    ostalo = [t for t in iz['rows'] if t not in rate_iz and t not in naknade_iz]
    us = uskladi(dict(iz, rows=ostalo), [r for r in db if r['id'] not in used], izvor, tol)
    for s, r, how in us['pairs']:
        used.add(r['id'])
        parovi.append({'t': s, 'r': r, 'zasto': how})
    st_left = list(us['izvod_bez_para'])

    # -- 4. BLIZAK IZNOS (T13): ispravak postojeceg, ne nov redak
    lo, hi = iz['od'] - timedelta(days=tol), iz['do'] + timedelta(days=tol)
    bazen = [r for r in mc if r['id'] not in used and lo <= ev_date(r) <= hi
             and not _rata_retka(r) and not potvrdjen_drugdje(r, dosp)]

    def blizu(r, t):
        st, ti = net(r['attrs']), t['iznos']
        return (abs((ev_date(r) - t['datum']).days) <= BLIZU_DANA and abs(st - ti) > EPS
                and abs(st - ti) <= BLIZU_UDIO * abs(ti) and (st > 0) == (ti > 0))
    kand = {id(t): [r for r in bazen if blizu(r, t)] for t in st_left}
    # Jedan redak baze, dva retka izvoda koji ga traze. Dokaz redom:
    #   1. RAZVRSTAVANJE — presedan retka izvoda = Tip/Podtip retka baze.
    #   2. ISTI DAN.
    # Izmjereno MC_2026-09, oba smjera: Kokin `tonner 3,45` (12.09., Informatika/HP)
    # traze 2CO|HP 3,49 (11.09., presedan Informatika/HP) i VPA PARKING 4,00
    # (12.09.) — sam „isti dan" dao bi ga parkingu. Kokin `28,79` bez opisa
    # (07.09.) traze FENGHUA 33,10 (07.09.) i GLOVO 29,64 (06.09.) — presedana
    # nema nijedan, pa odlucuje dan. Bez ovoga „jedini s obje strane" padne na oba.
    for r in bazen:
        traze = [t for t in st_left if r in kand[id(t)]]
        if len(traze) < 2:
            continue
        par_r = (r['attrs'].get('Tip'), r['attrs'].get('Podtip'))
        po_klasi = [t for t in traze if klasa and klasa(t) == par_r]
        isti = [t for t in traze if ev_date(r) == t['datum']]
        pobjednik = po_klasi[0] if len(po_klasi) == 1 else (isti[0] if len(isti) == 1 else None)
        if pobjednik:
            for t in traze:
                if t is not pobjednik:
                    kand[id(t)] = [x for x in kand[id(t)] if x is not r]
    nejasni = []
    for t in list(st_left):
        k = kand[id(t)]
        if len(k) > 1:
            # Duplikat u kosari zna biti drugi kandidat (Visa S161, Purex/Eurospin):
            # jedini istog dana je tada jaci dokaz od „jedini uopce".
            k = [r for r in k if ev_date(r) == t['datum']] or k
        if len(k) == 1 and k[0]['id'] not in used \
                and sum(1 for t2 in st_left if k[0] in kand[id(t2)]) == 1:
            used.add(k[0]['id'])
            parovi.append({'t': t, 'r': k[0], 'zasto': f'blizak iznos {net(k[0]["attrs"]):.2f}'})
            st_left.remove(t)
        elif k:
            nejasni.append((t, k))

    sumnjivi = [t for t in st_left if t['ref'] in us['daleki']]
    for t in st_left:
        if t in sumnjivi:
            continue
        novi.append({'t': t, 'event_date': str(t['datum']), 'tip': None, 'podtip': None,
                     'komentar': None, 'zasto': 'nema para'})

    # -- 5. DUPLIKATI (T14) i visak kosare
    spareni = [p['r'] for p in parovi]
    kosara = [r for r in mc if due(r) == dosp and r['id'] not in used]
    slozeni_ids = {r['id'] for r, _ in us['slozeni']}
    duplikati, visak = [], []
    for r in kosara:
        dup = next((s for s in spareni if abs(net(s['attrs']) - net(r['attrs'])) < EPS
                    and abs((ev_date(s) - ev_date(r)).days) <= BLIZU_DANA), None)
        if dup:
            duplikati.append({'r': r, 'kao': dup})
        elif r['id'] in slozeni_ids:
            continue
        else:
            visak.append(r)
    return {'parovi': parovi, 'novi': novi, 'buduce_naknade': generirane,
            'duplikati': duplikati, 'duplikati_plana': duplikati_plana,
            'slozeni': us['slozeni'], 'sumnjivi': sumnjivi, 'daleki': us['daleki'],
            'nejasni': nejasni, 'visak': visak, 'planovi': planovi}


def izmjene(res: dict, dosp: date, klasa=None) -> list[dict]:
    """Sto se na sparenom retku mijenja: {r, polja, komentar, zasto}. Prazno = nista.

    /!\ `Izvod opis` se upisuje samo u PRAZNU celiju — popunjena je dokaz nekog
        izvoda (S124); isti dosp znaci ponovni prolaz, i tada nema promjene.
    /!\ `Status` se ne dira osim praznog (T20 ⇒ `Planiran`); `Izvrsen` radi traka."""
    out = []
    for p in res['parovi']:
        t, r = p['t'], p['r']
        a = r['attrs']
        polja = {}
        if not a.get('Izvod opis'):
            polja['Izvod opis'] = t['opis']
        if due(r) != dosp:
            polja['Datum naplate'] = dosp
        if abs(net(a) - t['iznos']) > EPS:
            polja['Isplata' if t['iznos'] > 0 else 'Uplata'] = round(abs(t['iznos']), 2)
        if not a.get('Status'):
            polja['Status'] = 'Planiran'
        x = rata_izvoda(t['opis'])
        if x:                                    # T24: rata bez oznake
            _, n, N = x
            if a.get('Rate?') is not True:
                polja['Rate?'] = True
            if a.get('Broj rata') is None or int(float(a['Broj rata'])) != N:
                polja['Broj rata'] = N
            if a.get('Rata br') is None or int(float(a['Rata br'])) != n:
                polja['Rata br'] = n
        # ⚠ `Tip` sparenog retka je NAS (T13) — presedan ga ne dira. Izmjereno
        #   MC_2026-09: Kokin `Temu .. pokloni za decke` (N/A) bi dobio `Razno /
        #   Temu`, a ona ga je razvrstala u `Pokloni`; `PAYPAL *` je posrednik.
        #   Iznimka je naknada: njen par je jednoznacan (7/7).
        if a.get('Tip') in (None, 'N/A') and NAKNADA_RE.match(t['opis']):
            polja['Tip'], polja['Podtip'] = NAKNADA_TIP
        kom = r.get('comment')
        if ('Isplata' in polja or 'Uplata' in polja) and kom and '~' in kom:
            kom = re.sub(r'\s*~\s*', ' ', kom).strip() or None   # iznos vise nije procjena
        if polja or kom != r.get('comment'):
            out.append({'r': r, 'polja': polja, 'komentar': kom, 'zasto': p['zasto'], 't': t})
    return out
