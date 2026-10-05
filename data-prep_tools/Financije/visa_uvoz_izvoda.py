# -*- coding: utf-8 -*-
"""
visa_uvoz_izvoda.py  (S148, 2026-09-24; bez mjesecnih popisa od S161, 2026-10-05)
=================================================================================
Jedan PBZ Visa izvod -> Excel za uvoz kroz aplikaciju (Koka, vlasnica Aree):
  * NOVI retci  — stavke izvoda kojih baza nema (iznos/datum/`Izvod opis` s
                  izvoda, `Tip`/`Podtip` iz BROJANE povijesti — `presedani.py`);
  * ISPRAVCI    — retci koji postoje: `Izvod opis`, `Datum naplate`, iznos s
                  izvoda kad se razlikuje; nakon naplate i `Status = Izvrsen`.

Prvi put izveden nad `PBZVIZA_2026-08.pdf` (naplata 07.09.2026. = 1.218,38).

DVA NACINA (S161) — izvod stize PRIJE naplate (03.10. izdan, dospijece 12.10.):
  * bez datuma   = PRIJE NAPLATE: `Datum naplate` = dospijece s izvoda, `Status`
                   se ne dira (novi retci `Planiran`). S147: `Izvrsen` tek kad
                   racun stvarno tereti.
  * s datumom    = NAKON NAPLATE: `Datum naplate` = taj dan, `Status = Izvrsen`.
                   Nema li na RF-u retka naplate, alat ga DODA (uz naknadu 0,17)
                   — osim ako na RF-u ±3 dana stoji nesto sto lici na nju (drugi
                   dan ili drugi iznos): tada STANE, jer bi drugi redak naplate
                   dvaput pomaknuo saldo.
  Saša placa Visu rucno (fotonalog) => preporuceni tok je: platiti, pa JEDNOM
  pokrenuti s datumom placanja => Koka uvozi jedan file.

/!\ RATA SE SPARUJE PO PLANU I BROJU RATE, NIKAD PO DATUMU. Sve rate jedne
    kupnje dijele `event_date` = dan kupnje; sparivanje po (datum, iznos)
    spoji `RATA 03/06` s retkom `2/6` koji je naplacen PROSLI mjesec —
    izmjereno u prvom prolazu ove sesije (7 od 7 rata "nadjeno", 0 stvarno).
    Plan = isti `event_date` i (trgovac u `Izvod opis` ILI redak bez `Izvod
    opis` s istim `Broj rata`). Druga grana hvata planove upisane U APPU (rata
    modal, `rate_alat`) — do S161 ih alat nije vidio i dopisao bi ih drugi put
    (izmjereno: Konzum dostava 1/3, Maxi Konzum 1/6).

/!\ IZNOS KOJI SE MALO RAZLIKUJE (tecaj, `~`, cent ostatka) ISPRAVLJA se na
    postojecem retku, nikad novim retkom (dedup je `(datum, iznos)`, pa bi
    `55,00` i `58,19` ostala DVA). Uvjet je strog: ±2 dana, ≤15 %, i par mora
    biti JEDINI s obje strane. Do S161 je to bio rucni popis po mjesecu (`RUCNO`)
    — i na sljedecem izvodu je alat stao s greskom.

/!\ STAVKA KOJE NEMA U VISA KOSARI, A ISTI IZNOS ±3 DANA STOJI NA DRUGOM MJESTU
    (drugi `Izvor`/racun, bez `Izvod opis`) prijavljuje se kao "MOZDA KRIVO
    MJESTO" i premjesta SAMO uz `--premjesti=<id8>`. Izmjereno S161: Visa
    kupnja u ljekarni 8,60 upisana kao `Racun`/ZABA — ZABA saldo je zbog nje
    bio 8,60 nizi od banke, a ZABA izvod sam to ne moze reci (tamo je samo
    "visak"). Bez potvrde se ne premjesta: isti iznos zna biti slucajnost.

/!\ DUPLIKAT U KOSARI (isti iznos ±2 dana kao vec sparen redak) se prijavljuje,
    a brise SAMO uz `--brisi=<id8>`.

/!\ NOVI REDAK DOBIVA SLOBODNU MINUTU U POJASU 14:00+ (lokalno), izbjegavajuci
    svaki postojeci `session_start` tog dana — `useActivities` grupira po
    (user, kategorija, session_start), a kolizija je zastita od dvostrukog uvoza.

Pokretanje (PowerShell, iz data-prep_tools\\):
  $env:ET_TARGET='prod'
  Financije\\run.bat visa_uvoz_izvoda.py PBZVISA_2026-09.pdf               (prije naplate)
  Financije\\run.bat visa_uvoz_izvoda.py PBZVISA_2026-09.pdf 2026-10-06    (nakon naplate)
  dodaj --file za xlsx; --premjesti=<id8> / --brisi=<id8> po potrebi (svaki
  zaseban argument — run.bat guši zarez)
"""
from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, time
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from _db import cat_transakcija, load_env, target as _target  # noqa: E402
from _izvodi import nadji  # noqa: E402
from enrich_from_izvoda import parse_pbz_visa  # noqa: E402
from fill_from_izvod import short_opis  # noqa: E402
from presedani import Presedani  # noqa: E402
from uskladi_izvod import load_db  # noqa: E402
from visa_kosare import num  # noqa: E402
from visa_popravak import ZG, lokalno as lokalno_hhmm, pisi  # noqa: E402

RACUN = 'Sašin tekući RF'
RATA_RE = re.compile(r'^RATA\s*(\d+)\s*/\s*(\d+)\s*-\s*(.+)$')
DOSP_RE = re.compile(r'Dospije[cć]e pla[cć]anja:\s*(\d{2}\.\d{2}\.\d{4})')
EPS = 0.005
NAKNADA = 0.17          # RF naplacuje on-line nalog prema PBZ Cardu (izmjereno 06–09/2026)
BLIZU_DANA, BLIZU_UDIO = 2, 0.15
DRUGDJE_DANA = 3

# Klasifikacija gdje je povijest jasna, a automat je ne nalazi (rata 1 plana je
# u bazi `N/A`, pa rata 2 nema od koga naslijediti). S148, prikazano Sasi.
# Pravila po trgovcu, ne po mjesecu — vrijede za svaki izvod.
KLASA = {
    'BAUHAUS': ('Kuća', 'Popravci, održavanje, osiguranje'),     # 32/32
    'SPAR': ('Domaćinstvo', 'Hrana i ostalo'),                    # 85/91
    'PEKARA DINARA': ('Domaćinstvo', 'Hrana i ostalo'),           # 2/2
    'GARAGE CVJETNI': ('Prijevoz', 'Taksi, Zet, Parking'),
}


def rucna_klasa(opis: str):
    o = opis.upper()
    for k, v in KLASA.items():
        if k in o:
            return {'tip': v[0], 'podtip': v[1], 'comment': None, 'dokaz': f'KLASA {k}'}
    return None


def taksonomija(url, key):
    from _db import rest
    d = rest(url, key, 'attribute_definitions?category_id=eq.' + cat_transakcija(url, key)
             + '&name=eq.Podtip&select=id,validation_rules')[0]
    om = d['validation_rules']['depends_on']['options_map']
    return {t: v for t, v in om.items() if t not in ('*', 'N/A')}


def trgovac(opis: str) -> str:
    return re.sub(r'\[kartica:[^\]]*\]', '', opis).split(' - ')[0].strip().upper()


def dospijece(pdf: Path) -> date | None:
    import pdfplumber
    with pdfplumber.open(pdf) as p:
        m = DOSP_RE.search(p.pages[0].extract_text() or '')
    return datetime.strptime(m.group(1), '%d.%m.%Y').date() if m else None


def dan(r) -> date:
    return date.fromisoformat(r['event_date'])


def potvrdjen_drugdje(r, ym: str) -> bool:
    """Redak koji je izvod DRUGOG ciklusa vec ozigosao nije kandidat — inace bi
    se ista kupnja sparila dvaput preko granice izvoda. Zig istog ciklusa (`ym`
    = mjesec naplate) ostaje kandidat: tako ponovno pokretanje nad vec uvezenim
    izvodom daje nula promjena umjesto drugog kompleta redaka."""
    a = r['attrs']
    return bool(a.get('Izvod opis')) and str(a.get('Datum naplate'))[:7] != ym


def opcije(prefix: str) -> set[str]:
    return {a.split('=', 1)[1][:8] for a in sys.argv[1:] if a.startswith(prefix + '=')}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) not in (1, 2):
        sys.exit('Upotreba: visa_uvoz_izvoda.py <PBZVISA_YYYY-MM.pdf> [naplata YYYY-MM-DD] '
                 '[--file] [--premjesti=<id8>] [--brisi=<id8>]')
    izvod = nadji(args[0])
    naplata = date.fromisoformat(args[1]) if len(args) == 2 else None
    premjesti, brisi = opcije('--premjesti'), opcije('--brisi')
    dosp = dospijece(izvod)
    if not naplata and not dosp:
        sys.exit('✗ Na izvodu ne nalazim „Dospijeće plaćanja" — zadaj datum naplate.')
    ciklus = naplata or dosp
    ym = f'{ciklus.year:04d}-{ciklus.month:02d}'
    status = 'Izvrsen' if naplata else None

    target = _target()
    url, key = load_env(target)
    nacin = f'NAKON NAPLATE {naplata}' if naplata else f'PRIJE NAPLATE (dospijeće {dosp})'
    print(f'[{target.upper()}] {url}   izvod {izvod.name}   {nacin}')
    rows = load_db(url, key)

    tx = parse_pbz_visa(izvod)
    isp = sorted([t for t in tx if t['smjer'] == 'Isplata'], key=lambda t: t['date'])
    s_iz = round(sum(t['iznos'] for t in isp), 2)
    print(f'izvod: {len(isp)} isplata, Σ {s_iz:.2f}')

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

    # -- 0. naplata na RF-u (samo nakon naplate)
    if naplata:
        rf = [r for r in rows if r['attrs'].get('Izvor') == 'Racun'
              and r['attrs'].get('Racun') == RACUN and num(r['attrs'].get('Isplata')) > 0
              and abs((dan(r) - naplata).days) <= DRUGDJE_DANA]
        tocna = [r for r in rf if dan(r) == naplata and abs(num(r['attrs'].get('Isplata')) - s_iz) < EPS]
        slicna = [r for r in rf if r not in tocna and (
            abs(num(r['attrs'].get('Isplata')) - s_iz) < EPS
            or ('visa' in str(r.get('comment') or '').lower()
                and abs(num(r['attrs'].get('Isplata')) - NAKNADA) > EPS))]
        if tocna:
            print(f'RF naplata {naplata} {s_iz:.2f}: ✓ već upisana')
        elif slicna:
            for r in slicna:
                print(f'  ? {r["event_date"]} {num(r["attrs"].get("Isplata")):.2f} {r.get("comment")}  [{r["id"][:8]}]')
            sys.exit('✗ Na RF-u ±3 dana stoji redak koji liči na naplatu Vise, a nije '
                     f'{naplata} / {s_iz:.2f}. Ispravi ga u appu ili zadaj njegov datum — '
                     'drugi redak naplate dvaput bi pomaknuo saldo. Stajem.')
        else:
            d = str(naplata)
            izlaz.append((None, {'Racun': RACUN, 'Izvor': 'Racun', 'Smjer': 'Isplata',
                                 'Isplata': s_iz, 'Tip': 'Transfer', 'Podtip': 'izmedju racuna',
                                 'Status': 'Izvrsen', 'Datum naplate': naplata},
                          'Visa', False, 'NOVO — naplata Vise s RF-a (iznos = Σ izvoda)',
                          [d, slobodna(d)]))
            print(f'RF naplata {naplata} {s_iz:.2f}: nije upisana ⇒ DODAJEM u file (+ naknada)')
            if not any(dan(r) == naplata and abs(num(r['attrs'].get('Isplata')) - NAKNADA) < EPS
                       for r in rf):
                izlaz.append((None, {'Racun': RACUN, 'Izvor': 'Racun', 'Smjer': 'Isplata',
                                     'Isplata': NAKNADA, 'Tip': 'Domaćinstvo',
                                     'Podtip': 'Bankovni troškovi', 'Status': 'Izvrsen',
                                     'Datum naplate': naplata},
                              'Naknada', False, 'NOVO — naknada RF-a za nalog (0,17)',
                              [d, slobodna(d)]))

    visa = [r for r in rows if r['attrs'].get('Izvor') == 'Visa' and not potvrdjen_drugdje(r, ym)]
    iskoristeni: set[str] = set()
    par: dict[int, tuple] = {}        # id(t) -> (redak, nove vrijednosti, zasto)
    novi_rata: dict[int, dict] = {}

    # -- 1. rate: po planu i broju rate
    for t in isp:
        m = RATA_RE.match(t['opis'])
        if not m:
            continue
        n, N, trg = int(m.group(1)), int(m.group(2)), trgovac(m.group(3))
        plan = [r for r in rows if r['attrs'].get('Izvor') == 'Visa' and dan(r) == t['date']
                and (trg[:12] in str(r['attrs'].get('Izvod opis') or '').upper()
                     or (not r['attrs'].get('Izvod opis')
                         and int(num(r['attrs'].get('Broj rata'))) == N))]
        ista = [r for r in plan if r['id'] not in iskoristeni and not potvrdjen_drugdje(r, ym)
                and int(num(r['attrs'].get('Rata br'))) == n]
        if ista:
            r = min(ista, key=lambda r: abs(num(r['attrs'].get('Isplata')) - t['iznos']))
            iskoristeni.add(r['id'])
            st = num(r['attrs'].get('Isplata'))
            if abs(st - t['iznos']) > EPS:
                par[id(t)] = (r, {'Isplata': t['iznos']}, f'rata {n}/{N}; iznos {st:.2f} → {t["iznos"]:.2f} (banka)')
            else:
                par[id(t)] = (r, {}, f'rata {n}/{N}')
        else:
            uzor = sorted(plan, key=lambda r: (r['attrs'].get('Tip') in (None, 'N/A'),
                                               num(r['attrs'].get('Rata br'))))
            novi_rata[id(t)] = {'rata': (n, N), 'uzor': uzor[0] if uzor else None}

    ostali = [t for t in isp if id(t) not in par and id(t) not in novi_rata]

    # -- 2. tocan iznos, ±3 dana
    for t in ostali:
        k = [r for r in visa if r['id'] not in iskoristeni
             and abs(num(r['attrs'].get('Isplata')) - t['iznos']) < EPS
             and abs((dan(r) - t['date']).days) <= 3]
        if k:
            r = min(k, key=lambda r: abs((dan(r) - t['date']).days))
            par[id(t)] = (r, {}, 'sparen')
            iskoristeni.add(r['id'])
    ostali = [t for t in ostali if id(t) not in par]

    # -- 3. blizak iznos: jedini par s obje strane
    def blizu(r, t):
        st = num(r['attrs'].get('Isplata'))
        return (r['id'] not in iskoristeni and abs((dan(r) - t['date']).days) <= BLIZU_DANA
                and abs(st - t['iznos']) > EPS and abs(st - t['iznos']) <= BLIZU_UDIO * t['iznos'])
    kand = {id(t): [r for r in visa if blizu(r, t)] for t in ostali}
    for t in ostali:
        k = kand[id(t)]
        if len(k) > 1:
            # Duplikat u kosari zna biti drugi kandidat (izmjereno S161: Purex
            # 31,36 ↔ 31,13 uz Eurospin 29,63 dva dana ranije). Jedini istog
            # dana je tada jaci dokaz od „jedini uopce".
            k = [r for r in k if dan(r) == t['date']]
        if len(k) == 1 and sum(1 for t2 in ostali if k[0] in kand[id(t2)]) == 1:
            r = k[0]
            iskoristeni.add(r['id'])
            st = num(r['attrs'].get('Isplata'))
            par[id(t)] = (r, {'Isplata': t['iznos']}, f'iznos {st:.2f} → {t["iznos"]:.2f} (banka)')
    ostali = [t for t in ostali if id(t) not in par]

    # -- 4. isti iznos na drugom mjestu (drugi Izvor / racun), bez ziga
    drugdje: dict[int, list] = {}
    for t in ostali:
        k = [r for r in rows if r['attrs'].get('Izvor') != 'Visa' and r['id'] not in iskoristeni
             and not r['attrs'].get('Izvod opis')
             and abs(num(r['attrs'].get('Isplata')) - t['iznos']) < EPS
             and abs((dan(r) - t['date']).days) <= DRUGDJE_DANA]
        if k:
            drugdje[id(t)] = k
        for r in k:
            if r['id'][:8] in premjesti:
                iskoristeni.add(r['id'])
                a = r['attrs']
                par[id(t)] = (r, {'Izvor': 'Visa', 'Racun': RACUN, '_datum': t['date']},
                              f'PREMJEŠTENO s {a.get("Izvor")}/{a.get("Racun")} {r["event_date"]} '
                              f'(--premjesti)')
                break
    ostali = [t for t in ostali if id(t) not in par]

    # -- 5. klasifikacija iz povijesti Visa redaka PRIJE ovog izvoda
    bez_rate = [t for t in isp if not RATA_RE.match(t['opis'])]
    od = str(min(t['date'] for t in bez_rate)) if bez_rate else str(isp[0]['date'])
    pres = Presedani([r for r in rows if r['attrs'].get('Izvor') == 'Visa'], prije=od)
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
        (tp, n), = Counter(same).most_common(1)
        if n / len(same) < 0.9:
            return None
        return {'tip': tp[0], 'podtip': tp[1], 'comment': None,
                'dokaz': f'trgovac {short_opis(opis)!r}, {n}/{len(same)} (Visa+MC)'}

    def klasa(t):
        return pres.nadji(t['iznos'], t['opis']) or po_trgovcu(t['opis']) or rucna_klasa(t['opis'])

    zbroj = 0.0
    print(f'\nISPRAVCI ({len(par)}):')
    bez_promjene = 0
    for t in isp:
        if id(t) not in par:
            continue
        r, nove, zasto = par[id(t)]
        nove = dict(nove)
        novi_dan = nove.pop('_datum', None)
        a = dict(r['attrs'])
        a.update({'Datum naplate': ciklus, 'Izvod opis': t['opis']})
        if status:
            a['Status'] = status
        a.update(nove)
        k = r.get('comment')
        if 'Isplata' in nove:
            k = re.sub(r'\s*~\s*', ' ', str(k or '')).strip() or None
        if a.get('Tip') in (None, 'N/A'):
            p = klasa(t)
            if p:
                a.update({'Tip': p['tip'], 'Podtip': p['podtip']})
                zasto += f'; Tip iz povijesti ({p["dokaz"]})'
        rr = r
        if novi_dan and novi_dan != dan(r):
            d = str(novi_dan)
            hh = slobodna(d)
            ss = datetime.combine(novi_dan, time(int(hh[:2]), int(hh[3:])), tzinfo=ZG).isoformat()
            rr = dict(r, event_date=d, session_start=ss)
            k = k or short_opis(t['opis'])
        zbroj += num(a.get('Isplata'))
        promjena = (rr is not r or k != r.get('comment')
                    or any(str(a.get(x)) != str(r['attrs'].get(x)) and not (
                        x == 'Datum naplate' and str(r['attrs'].get(x))[:10] == str(a.get(x))[:10])
                        for x in a))
        if not promjena:
            bez_promjene += 1
            continue
        izlaz.append((rr, a, k, False, f'ISPRAVI — {zasto}; naplata {ciklus}'
                      + (', Izvrsen' if status else ', Status ostaje')))
        print(f'  {rr["event_date"]} {num(a.get("Isplata")):8.2f}  {str(k)[:30]:30} ← {t["opis"][:40]}  [{zasto}]')
    if bez_promjene:
        print(f'  (+ {bez_promjene} sparenih bez ijedne promjene — nisu u fileu)')

    novi = [t for t in isp if id(t) not in par]
    print(f'\nNOVI ({len(novi)}, Σ {sum(t["iznos"] for t in novi):.2f}):')
    bez = 0
    for t in novi:
        info = novi_rata.get(id(t), {})
        a = {'Racun': RACUN, 'Izvor': 'Visa', 'Smjer': 'Isplata', 'Isplata': t['iznos'],
             'Izvod opis': t['opis'], 'Datum naplate': ciklus, 'Status': status or 'Planiran'}
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
                p = klasa(t)
                a.update({'Tip': p['tip'] if p else 'N/A', 'Podtip': p['podtip'] if p else 'N/A'})
                kom = (p and p['comment'] or short_opis(t['opis'])) + f' {n}/{N}'
                dokaz = f'NOV PLAN {n}/{N}; ' + (p['dokaz'] if p else 'nema presedana')
        else:
            p = klasa(t)
            a.update({'Tip': p['tip'] if p else 'N/A', 'Podtip': p['podtip'] if p else 'N/A'})
            kom = (p and p['comment']) or short_opis(t['opis'])
            dokaz = p['dokaz'] if p else 'NEMA PRESEDANA — N/A'
        if id(t) in drugdje:
            dokaz += '; ⚠ MOŽDA KRIVO MJESTO — v. dolje'
        if a['Tip'] == 'N/A':
            bez += 1
        zbroj += t['iznos']
        d = str(t['date'])
        izlaz.append((None, a, kom, False, 'NOVO — ' + dokaz, [d, slobodna(d)]))
        print(f'  {d} {t["iznos"]:8.2f}  {kom[:28]:28} {a["Tip"]}/{a["Podtip"]}  [{dokaz}]')
    print(f'  → {bez} bez klasifikacije (N/A) — klasificira se u fileu (narančasto)')

    if drugdje:
        print('\nMOŽDA KRIVO MJESTO — stavka izvoda nema par u Visa košari, a isti iznos ±3 dana '
              'stoji drugdje, bez žiga izvoda:')
        for t in isp:
            for r in drugdje.get(id(t), []):
                a = r['attrs']
                stanje = 'PREMJEŠTA SE' if r['id'][:8] in premjesti else f'--premjesti={r["id"][:8]}'
                print(f'  izvod {t["date"]} {t["iznos"]:.2f} {t["opis"][:30]}  ⇐  {r["event_date"]} '
                      f'{a.get("Izvor")}/{a.get("Racun")} {a.get("Tip")}/{a.get("Podtip")} '
                      f'{r.get("comment")}   [{stanje}]')

    visak = [r for r in visa if r['id'] not in iskoristeni
             and str(r['attrs'].get('Datum naplate'))[:7] == ym]
    spareni = [par[k][0] for k in par]
    print(f'\nU KOŠARI {ym}, IZVOD IH NE POTVRĐUJE ({len(visak)}):')
    for r in visak:
        dup = next((s for s in spareni if abs(num(s['attrs'].get('Isplata')) - num(r['attrs'].get('Isplata'))) < EPS
                    and abs((dan(s) - dan(r)).days) <= BLIZU_DANA), None)
        oznaka = ''
        if dup:
            oznaka = f'  ⚠ DUPLIKAT? isti iznos kao sparen {dup["event_date"]} [{dup["id"][:8]}]'
        if r['id'][:8] in brisi:
            oznaka += '  → BRIŠE SE (--brisi)'
            izlaz.append((r, dict(r['attrs']), r.get('comment'), True,
                          'BRIŠI — ' + (f'duplikat retka {dup["event_date"]} (izvod ga nosi jednom)'
                                        if dup else 'izvod ga ne nosi') + ' (--brisi)'))
        elif dup:
            oznaka += f'  → --brisi={r["id"][:8]}'
        print(f'  {r["event_date"]} {num(r["attrs"].get("Isplata")):8.2f} {r.get("comment")}  [{r["id"][:8]}]{oznaka}')

    zbroj = round(zbroj, 2)
    print(f'\nKONTROLA: Σ (spareni + novi) = {zbroj:.2f}  vs izvod {s_iz:.2f}  '
          f'→ {"✓ u cent" if abs(zbroj - s_iz) < EPS else "✗ RAZLIKA — ne uvoziti"}')

    nove = sum(1 for r, *_ in izlaz if r is None)
    brisanja = sum(1 for _, _, _, dele, *_ in izlaz if dele)
    print(f'OČEKIVANO U PREGLEDU UVOZA: {nove} New · {len(izlaz) - nove - brisanja} Modify'
          + (f' · {brisanja} Delete' if brisanja else ''))

    if '--file' in sys.argv:
        pisi(izlaz, {r['id'][:8]: r for r in rows}, 'visa_uvoz_' + izvod.stem.split('_')[-1],
             taksonomija(url, key))


if __name__ == '__main__':
    main()
