# -*- coding: utf-8 -*-
"""
uskladi_izvod.py — jedan bankovni izvod protiv baze i protiv Kokinog filea. S124.

ZASTO POSTOJI (i sto zamjenjuje)
    `kosara_naplate.py` (S123) je pitao "zasto se kosara `Datum naplate` ne
    zatvara" BEZ izvoda u ruci, pa je mogao samo razdvojiti slucajeve po
    pravilu. S izvodom pitanje nestaje: izmjereno S124, `MC_2026-06.pdf` daje
    48/48 sparenih redaka i suma 1.244,74 u cent, a od 73 retka kosare ostaju
    2 duplikata i 23 krivo datirana. Dakle papir odgovara na sve.

    Ovaj alat zato ne dijagnosticira nego USKLADJUJE, i dijeli nalaz po tome
    TKO ODLUCUJE:

      potvrdjeno   izvod <-> baza spareno 1:1        nitko (samo kontrola u cent)
      za ispravak  u bazi, izvod dokazuje drugacije   mi, mehanicki
      za uvoz      na izvodu, nema u bazi             mi, transa
      PITANJA      razilazi se, ili banka ne zna      Koka

    Kod Koke ide SAMO zadnja sekcija. Stari file joj je postavljao 73 pitanja
    na koja papir odgovara svih 73 — file koji uvijek pita sve gubi povjerenje
    brze nego sto ga stekne.

SIDRO SPARIVANJA: `Izvod opis`
    Izmjereno S124: za MC retke `Izvod opis` je DOSLOVNO opis s izvoda
    (`PAYPAL *TEMU`, `KONZUM P-3200 RATA 4/12`, `LUFTHAN2202242474447 RATA 1/3`).
    Nije izvedena vrijednost nego prepisana, pa je to najjaci link koji imamo.

    => `Izvod opis` je de facto oznaka POTVRDJENO IZVODOM. Nitko je dosad nije
       citao. Pokrivenost: Visa 96 %, Racun 92 %, Mastercard 91 %. Po mjesecima
       kupovine (MC): 04/2026 36 ima / 3 nema, 05 31/2, 06 47/5, **07 0 od 22**
       — nula jer `MC_2026-07` nije obradjen.

    ⚠ Prazan `Izvod opis` u razdoblju koje izvod POKRIVA je pitanje, ne greska:
      ili je duplikat, ili banka za taj trosak ne zna.

TRI STANJA, NE DVA
    prazan                         Kokina tvrdnja; iznos/datum/oblik privremeni
    popunjen                       banka potvrdila; njen iznos i datum
    prazan a razdoblje pokriveno   PITANJE

⚠ 1:N — ISTI DOGADJAJ, RAZLICIT BROJ REDAKA (razred S114)
    Banka za Kokin jedan redak zna imati N. Izmjereno: `LH 1/3` 63,33 kod nje =
    `LUFTHAN...447 RATA 1/3` 62,01 + `NAKNADA ZA OBROCNU OTPLATU` 1,32 kod
    banke. Dedup po `(datum, iznos)` to NE MOZE vidjeti — kljuc se razlikuje pa
    udju oba. Alat zato pokusava nespareni iznos iz baze SLOZITI iz 2-3
    nesparena retka izvoda u prozoru, i to PRIJAVLJUJE, nikad ne spaja sam.
    ⚠ Postoji i obrnut smjer (ZABA `Anja 73/96`: jedan event nosi uplatu 450,00
      I isplatu 0,70, i to nije greska nego vjeran spoj dvaju redaka izvoda) —
      zato samo prijava.

PRAVILO ZA 1:N (Sasina odluka S124, ispravljena mjerenjem)
    Bankini redci su KOSTUR (iznos, datum, klasifikacija, potvrda), Kokin redak
    DOPUNJAVA (opis, `Rate?`/`Broj rata`/`Rata br`) i zatim nestaje.
    Nikad ne ostaju oba.
    ⚠ Smjer je bio obrnut u prvoj skici. Mjereno: Kokin `LH 1/3` nosi
      `Tip = N/A`, bez `Podtip`, bez `Izvod opis`, datum 30.06.; bankin nosi
      `Putovanja / Karte, osiguranje` + potvrdu + tocan datum 28.06. Zadrzati
      njen redak znacilo bi zadrzati prazniji.
    ⚠ Ciljni oblik VEC POSTOJI u podacima: ostalih 8 rata od 28.06. su jedan
      redak s njenim opisom + bankinim iznosom + klasifikacijom + `Izvod opis`
      + ratom. Pipeline taj spoj radi za 1:1; padne samo na 1:N.

⚠ STATUS SE NE MIJENJA PO PRAVILU NEGO KAO POSLJEDICA POTVRDE
    Odbaceni automat je bio "dospjelo => izvrseno" (dospijece nije dokaz da je
    banka naplatila). Ovdje dokaz nije dospijece nego izvod, pa `Status` prelazi
    u `Izvrsen` SAMO na retku kojem istovremeno upisujemo `Izvod opis` s tog
    izvoda. Redak koji ne mozemo ozigosati ne diramo.

⚠ NE PUSTATI NA RAZDOBLJE CIJI IZVOD NIJE STIGAO
    Ondje je svaki redak legitimno nepotvrdjen, pa bi sekcija PITANJA bila
    cijeli mjesec. Alat radi nad JEDNIM izvodom i prozor uzima iz njega.

Pokretanje:
    python uskladi_izvod.py --izvod ..\\..\\data-prep_data\\Financije\\izvodi\\MC_2026-07.pdf --dry
    python uskladi_izvod.py --izvod <pdf> --dry --env test
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from itertools import combinations
from pathlib import Path

import openpyxl
import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
CAT_PROD = '986a4612-86a2-49fa-b73f-a29e048e5750'
KOKA_DEFAULT = ROOT / 'data-prep_data' / 'Financije' / 'Financije 2026-08-23.xlsx'


# -- DB ----------------------------------------------------------------------
def load_env(which):
    fn = '.env.prod.local' if which == 'prod' else '.env.testing'
    path = ROOT / fn
    if not path.exists():
        sys.exit('Nema ' + fn + ' — bez njega alat ne moze citati bazu.')
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('VITE_SUPABASE_ANON_KEY')
    if not url or not key:
        sys.exit(fn + ' nema SUPABASE_URL / kljuc.')
    return url, key


def rest(url, key, path):
    """PostgREST reze na 1000 redaka BEZ GRESKE, a paginacija bez `order` je
    tiho pogresna — stranice se preklope i istovremeno preskoce (S108)."""
    out, off = [], 0
    while True:
        req = urllib.request.Request(
            url + '/rest/v1/' + path + '&order=id',
            headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                     'Range': str(off) + '-' + str(off + 999)})
        rows = json.load(urllib.request.urlopen(req))
        out += rows
        off += len(rows)
        if len(rows) < 1000:
            return out


def load_db(url, key):
    defs = {d['id']: d['name'] for d in rest(
        url, key, 'attribute_definitions?category_id=eq.' + CAT_PROD + '&select=id,name')}
    events = {e['id']: e for e in rest(
        url, key, 'events?category_id=eq.' + CAT_PROD
        + '&select=id,event_date,session_start,comment,user_id')}
    vals = defaultdict(dict)
    for a in rest(url, key,
                  'event_attributes?attribute_definition_id=in.(' + ','.join(defs) + ')'
                  '&select=event_id,attribute_definition_id,value_text,value_number,'
                  'value_datetime,value_boolean'):
        n = defs.get(a['attribute_definition_id'])
        if not n:
            continue
        v = a['value_text']
        for alt in ('value_number', 'value_datetime', 'value_boolean'):
            if v is None:
                v = a[alt]
        vals[a['event_id']][n] = v
    return [dict(e, attrs=vals.get(eid, {})) for eid, e in events.items()]


def net(attrs):
    return round(float(attrs.get('Isplata') or 0) - float(attrs.get('Uplata') or 0), 2)


def ev_date(r):
    return datetime.strptime(r['event_date'], '%Y-%m-%d').date()


# -- izvod -------------------------------------------------------------------
AMT = r'(-?\d{1,3}(?:\.\d{3})*,\d{2})'
ROW_RE = re.compile(r'^(B\d{10,20})\s+(\d{2}\.\d{2}\.\d{4})\.\s+(.+?)\s+' + AMT + r'\s*$')


def to_f(s):
    return round(float(s.replace('.', '').replace(',', '.')), 2)


def clean_opis(s):
    """DB drzi opis odrezan na prvom zarezu kod tecajnih redaka — izmjereno:
    izvod `AUDIBLE*P99FS38Y3, TECAJ ZABA 22.06.2026. 1 8,99 USD` -> DB
    `AUDIBLE*P99FS38Y3`. Bez ovoga se tecajni redci nikad ne spare."""
    s = re.split(r',\s*TE[C\u010c]AJ\b', s, flags=re.I)[0]
    return re.sub(r'\s+', ' ', s).strip()


def parse_mc(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            lines += (p.extract_text() or '').splitlines()
    dosp = total = None
    rows, card = [], None
    for ln in lines:
        ln = ln.strip()
        m = re.search(r'Datum dospije[c\u0107]a:\s*(\d{2}\.\d{2}\.\d{4})', ln)
        if m:
            dosp = datetime.strptime(m.group(1), '%d.%m.%Y').date()
        m = re.search(r'UKUPNO \(EUR\):\s*' + AMT, ln)
        if m:
            total = to_f(m.group(1))
        m = re.search(r'Kartica broj:\s*\S+\s+(.+?)\s*$', ln)
        if m:
            card = m.group(1).strip()
            continue
        if ln.startswith('UKUPNO'):
            continue
        m = ROW_RE.match(ln)
        if m:
            rows.append({'ref': m.group(1),
                         'datum': datetime.strptime(m.group(2), '%d.%m.%Y').date(),
                         'opis': clean_opis(m.group(3)),
                         'iznos': to_f(m.group(4)),
                         'kartica': card})
    if dosp is None or total is None:
        sys.exit(path.name + ': ne mogu procitati datum dospijeca / UKUPNO.')
    got = round(sum(r['iznos'] for r in rows), 2)
    if abs(got - total) > 0.005:
        # Parser koji procita 47 od 48 redaka daje uvjerljiv i nepotpun nalaz.
        sys.exit(path.name + ': parsirano ' + str(len(rows)) + ' redaka suma '
                 + format(got, '.2f') + ', a na papiru pise ' + format(total, '.2f')
                 + ' (razlika ' + format(got - total, '+.2f') + ') — STOP.')
    return {'dospijece': dosp, 'total': total, 'rows': rows,
            'od': min(r['datum'] for r in rows), 'do': max(r['datum'] for r in rows)}


# -- Kokin file --------------------------------------------------------------
def norm(s):
    return unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower().strip()


def parse_koka_date(v):
    """103 njena retka nose datum kao TEKST (`11.05.23.`, `28.6.23.`) — alat
    koji prima samo `datetime` progutao bi ih bez ijedne poruke (S116)."""
    if v in (None, ''):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    m = re.match(r'^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})\.?\s*$', str(v))
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    y += 2000 if y < 100 else 0
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def index_koka(path):
    """Kolona C je dan kad novac napusti racun; dok naplata nije poznata C je
    prazan a dan troska stoji u G — zato se gledaju OBJE (S113)."""
    if not path.exists():
        print('⚠ Kokin file nije nadjen (' + path.name + ') — usporedba se preskace.')
        return {}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    idx = defaultdict(list)
    for sn in wb.sheetnames:
        ws = wb[sn]
        for r, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            c = list(row) + [None] * 10
            for raw in (c[2], c[6]):
                d = parse_koka_date(raw)
                if not d:
                    continue
                for amt in (c[3], c[4]):
                    try:
                        a = round(float(amt), 2)
                    except (TypeError, ValueError):
                        continue
                    if a:
                        idx[(d, a)].append((sn, r, str(c[1] or ''), str(c[0] or '')))
    return idx


def koka_par(idx, d, iznos, tol=3):
    """Prazno nije dokaz da redak kod nje ne postoji — samo da nije nadjen."""
    for dd in range(-tol, tol + 1):
        hit = idx.get((d + timedelta(days=dd), abs(iznos)))
        if hit:
            return hit
    return []


# -- usklada -----------------------------------------------------------------
def uskladi(iz, db, izvor, tol):
    """Dvije populacije, ne jedna:

      `mc`     svi retci tog Izvora u bazi — protiv njih se spare retci izvoda,
               da se vidi sto stvarno FALI (sekcija 3). Bez prozora: redak s
               krivim `Datum naplate` je i dalje isti trosak.
      `kosara` retci za koje BAZA TVRDI da pripadaju ovom izvodu
               (`Datum naplate` == dospijece). To je skup koji se mora poklopiti
               s papirom; svaki visak u njemu je ispravak, duplikat ili pitanje.

    ⚠ Prozor oko datuma kupovine NE valja kao populacija: uz toleranciju u nju
      upadnu susjedni izvodi, pa 12 uredno potvrdjenih svibanjskih redaka
      ispadne kao "pitanje". Izmjereno pri prvom pokretanju (28 laznih pitanja).
    """
    mc = [r for r in db if r['attrs'].get('Izvor') == izvor]
    dosp = iz['dospijece'].isoformat()
    kosara = [r for r in mc if str(r['attrs'].get('Datum naplate') or '')[:10] == dosp]

    # ⚠ `Izvod opis` NIJE jedinstven kroz vrijeme. `ZAGREBPARKING.HR APP 3` s
    #   26,60 postoji u vise mjeseci, pa je prvo pokretanje sparilo lipanjski
    #   redak izvoda s retkom iz RUJNA 2025. i predlozilo mu pomak `event_date`
    #   devet mjeseci unaprijed — a pravi lipanjski redak gurnulo u "pitanja".
    #   Sidro govori KOJI TRGOVAC, ne KOJE POJAVLJIVANJE => obavezan i prozor.
    lo, hi = iz['od'] - timedelta(days=tol), iz['do'] + timedelta(days=tol)
    st_left = list(iz['rows'])

    # ⚠ POTVRDJEN REDAK PRIPADA TOCNO JEDNOM IZVODU. Bez ovog uvjeta je
    #   MC_2026-07 "spario" `TV zabava` 6,99 od 26.06. (koju je vec potvrdio
    #   MC_2026-06) sa svojim `PRIME VIDEO` od 26.07. i predlozio da joj se
    #   `event_date` pomakne mjesec dana naprijed — dakle ISPRAVAK KOJI KVARI.
    #   Kandidat je zato redak koji je ili nepotvrdjen, ili potvrdjen a vec
    #   pripisan ovom dospijecu.
    db_left = [r for r in mc if lo <= ev_date(r) <= hi
               and (not r['attrs'].get('Izvod opis')
                    or str(r['attrs'].get('Datum naplate') or '')[:10] == dosp)]
    pairs = []

    # 1. sidro: `Izvod opis` + iznos, unutar prozora, najblizi datum pobjedjuje
    for s in list(st_left):
        best = None
        for r in db_left:
            io = r['attrs'].get('Izvod opis')
            if not io or norm(io) != norm(s['opis']) or net(r['attrs']) != s['iznos']:
                continue
            dd = abs((ev_date(r) - s['datum']).days)
            if best is None or dd < best[0]:
                best = (dd, r)
        if best:
            pairs.append((s, best[1], 'Izvod opis'))
            st_left.remove(s)
            db_left.remove(best[1])

    # 1b. RATE: iznos + broj rate `n/N`. ⚠ Datum tu NE VALJA kao veza — Koka
    #     ratu datira na dospijece (11.07.), banka na dan terecenja (29.07.),
    #     dakle 18 dana razlike; s tolerancijom od 5 dana ispale bi kao "za
    #     uvoz" i uvoz bi ih UDVOSTRUCIO. `RATA n/N` stoji na obje strane
    #     (u tekstu izvoda i u `Rata br`/`Broj rata`) i jednoznacna je.
    for s in list(st_left):
        m = re.search(r'\bRATA\s+(\d+)\s*/\s*(\d+)', s['opis'], re.I)
        if not m:
            continue
        n, N = int(m.group(1)), int(m.group(2))
        for r in db_left:
            a = r['attrs']
            if (a.get('Rate?') is True and net(a) == s['iznos']
                    and int(a.get('Rata br') or 0) == n
                    and int(a.get('Broj rata') or 0) == N):
                pairs.append((s, r, 'rata n/N'))
                st_left.remove(s)
                db_left.remove(r)
                break

    # 2. po iznosu blizu datuma — redak koji izvod jos nije ozigosao
    for s in list(st_left):
        best = None
        for r in db_left:
            if net(r['attrs']) != s['iznos']:
                continue
            dd = abs((ev_date(r) - s['datum']).days)
            if dd <= tol and (best is None or dd < best[0]):
                best = (dd, r)
        if best:
            pairs.append((s, best[1], 'iznos+datum'))
            st_left.remove(s)
            db_left.remove(best[1])

    spareni_db = {id(r) for _, r, _ in pairs}
    visak = [r for r in kosara if id(r) not in spareni_db]

    # 3. 1:N — visak iz kosare slozen iz 2-3 retka izvoda koji su VEC spareni
    #    drugdje. ⚠ Ovo NIJE korak sparivanja nego detektor duplikata: kod 1:N
    #    su bankini redci u bazi i vec spareni, pa trazenje samo medju
    #    nesparenima ne nadje nista (prvo pokretanje: 0 pogodaka za `LH 1/3`).
    #    ⚠ Izvor NISU samo retci kosare. Za izvod koji jos nije obradjen kosara
    #      je PRAZNA (nijedan redak ne nosi to dospijece), pa bi provjera nad
    #      njom propustila duplikat U NASTAJANJU: `LH 2/3` 63,33 postoji u bazi
    #      samo u Kokinom spojenom obliku, a transa tek donosi bankin razdvojeni
    #      62,01 + 1,32. Uhvatiti ga PRIJE uvoza je jedini jeftin trenutak.
    #    ⚠ ZBROJ SAM PO SEBI NIJE DOKAZ. Bez ogranicenja je provjera "nasla" da
    #      je `LH 2/3` 63,33 = PEVEX 24,29 (02.07.) + TEMU 21,26 (24.07.) +
    #      KONZUM 17,78 (29.07.) — cista slucajnost preko 27 dana, i uz nju
    #      `LH 1/3` (rata 1/3) sparen s bankinim retcima za ratu 2/3.
    #      Zato dva uvjeta koja opisuju sto banka STVARNO radi:
    #        a) razdvojeni redci su ISTOG DANA na izvodu (glavnica + naknada),
    #        b) je li redak rata odlucuje BROJ RATE, ne datum — Koka ratu datira
    #           na dospijece, banka na dan terecenja (18 dana razlike).
    slozeni = []
    izvor_kandidati = visak + [r for r in db_left if r not in visak]
    potroseni = set()
    po_danu = defaultdict(list)
    for s in iz['rows']:
        po_danu[s['datum']].append(s)
    for r in list(izvor_kandidati):
        a = r['attrs']
        n, rd = net(a), ev_date(r)
        rata = (int(a.get('Rata br') or 0), int(a.get('Broj rata') or 0)) if a.get('Rate?') else None
        hit = None
        for dan, grupa in po_danu.items():
            if rata is None and abs((dan - rd).days) > tol:
                continue
            slobodni = [s for s in grupa if s['ref'] not in potroseni]
            for k in (2, 3):
                for combo in combinations(slobodni, k):
                    if abs(sum(c['iznos'] for c in combo) - n) >= 0.005:
                        continue
                    if rata is not None:
                        nn = [re.search(r'\bRATA\s+(\d+)\s*/\s*(\d+)', c['opis'], re.I)
                              for c in combo]
                        if not any(m and (int(m.group(1)), int(m.group(2))) == rata
                                   for m in nn):
                            continue
                    hit = combo
                    break
                if hit:
                    break
            if hit:
                break
        if hit:
            # Retci izvoda se troše — inače oba `LH 1/3` pokažu isti bankin par
            # (447 dvaput), pa izgleda kao da dva viška imaju jedan uzrok.
            for c in hit:
                potroseni.add(c['ref'])
            slozeni.append((r, list(hit)))
            if r in visak:
                visak.remove(r)

    # 4. redak izvoda koji nema para U PROZORU, ali isti trosak postoji u bazi
    #    izvan njega. ⚠ Bez ove provjere bi ispao kao "za uvoz", a uvoz bi ga
    #    UDVOSTRUCIO — dedup po `(datum, iznos)` ga ne bi vidio jer je datum
    #    upravo ono sto je krivo (razred S115: ispravak + uvoz udvostrucuje tiho).
    daleki = {}
    ost = [r for r in mc if id(r) not in {id(x) for _, x, _ in pairs}]
    for s in st_left:
        for r in ost:
            if net(r['attrs']) != s['iznos']:
                continue
            dd = abs((ev_date(r) - s['datum']).days)
            # Prag je 20 dana, ne 45: mjesecne pretplate su 28-31 dan razmaknute
            # pa su na 45 dana davale 16 "kandidata" za jedan `iCloud 2,99` i
            # zatrpale nalaz. Blizi par je stvarna sumnja, mjesecni nije.
            if dd <= 20:
                daleki.setdefault(s['ref'], []).append((r, dd))
    return {'pairs': pairs, 'slozeni': slozeni, 'izvod_bez_para': st_left,
            'visak': visak, 'kosara': kosara, 'mc': mc, 'daleki': daleki}


def ispravci(iz, pairs):
    """Sto na sparenom retku ne odgovara izvodu. `Status` se mijenja SAMO uz
    istovremeni upis `Izvod opis` — nikad kao zakljucak iz dospijeca."""
    out = []
    for s, r, _ in pairs:
        a, promjene = r['attrs'], []
        dn = str(a.get('Datum naplate') or '')[:10]
        if dn != iz['dospijece'].isoformat():
            promjene.append(('Datum naplate', dn or '—', iz['dospijece'].isoformat()))
        if not a.get('Izvod opis'):
            promjene.append(('Izvod opis', '—', s['opis']))
            # Status prelazi SAMO zajedno sa zigom; bez ziga se ne dira.
            if a.get('Status') == 'Planiran':
                promjene.append(('Status', 'Planiran', 'Izvrsen'))
        elif a.get('Status') == 'Planiran':
            promjene.append(('Status', 'Planiran', 'Izvrsen'))
        if ev_date(r) != s['datum']:
            promjene.append(('event_date', r['event_date'], s['datum'].isoformat()))
        if promjene:
            out.append((s, r, promjene))
    return out


# -- ispis -------------------------------------------------------------------
def hr(t=''):
    print('\n' + t)
    print('-' * 100)


def opis_db(r):
    return (r['comment'] or '«bez komentara»')[:34]


def report(iz, u, isp, koka, path):
    dosp = iz['dospijece']
    print('=' * 102)
    print('USKLADA  ' + path.name + '   dospijece ' + dosp.strftime('%d.%m.%Y')
          + '   kupovine ' + iz['od'].strftime('%d.%m.') + '-' + iz['do'].strftime('%d.%m.%Y'))
    print('=' * 102)
    s_p = sum(s['iznos'] for s, _, _ in u['pairs'])
    n_io = sum(1 for _, _, how in u['pairs'] if how == 'Izvod opis')
    print('Izvod  : ' + str(len(iz['rows'])) + ' redaka   ' + format(iz['total'], '.2f')
          + '   (parsirano i provjereno protiv ispisanog UKUPNO)')
    print('Kosara : ' + str(len(u['kosara'])) + ' redaka   '
          + format(sum(net(r['attrs']) for r in u['kosara']), '.2f')
          + '   (baza tvrdi da pripadaju ovom izvodu)')
    print()
    s_u = sum(x['iznos'] for x in u['izvod_bez_para'])
    print('  spareno s izvodom          ' + str(len(u['pairs'])).rjust(3)
          + '   ' + format(s_p, '10.2f')
          + '   (' + str(n_io) + ' preko `Izvod opis`, '
          + str(len(u['pairs']) - n_io) + ' ostalo)')
    print('  jos nije u bazi            ' + str(len(u['izvod_bez_para'])).rjust(3)
          + '   ' + format(s_u, '10.2f'))
    # KONTROLA: spareno + za uvoz mora dati izvod u cent. Manjak nije greska
    # dok je tocno objasnjen sekcijom 3 — greska je kad se ne zbroji.
    print('  ' + '-' * 44)
    if abs(s_p + s_u - iz['total']) < 0.005:
        print('  KONTROLA  ' + format(s_p + s_u, '10.2f')
              + '  == izvod, u cent   (svaki redak izvoda je objasnjen)')
    else:
        print('  KONTROLA  ' + format(s_p + s_u, '10.2f') + '  != izvod '
              + format(iz['total'], '.2f') + '   RAZLIKA '
              + format(s_p + s_u - iz['total'], '+.2f')
              + '  — nista ispod nije pouzdano')

    hr('1 · POTVRDJENO — spareno i tocno datirano, ne dira se')
    ok = [p for p in u['pairs'] if not any(p[1] is r for _, r, _ in isp)]
    print('    ' + str(len(ok)) + ' redaka   '
          + format(sum(s['iznos'] for s, _, _ in ok), '.2f'))

    hr('2 · ZA ISPRAVAK — spareno, ali se polje ne slaze s izvodom   ['
       + str(len(isp)) + ' redaka]   MI, mehanicki')
    if not isp:
        print('    nema')
    for s, r, ch in sorted(isp, key=lambda x: x[1]['event_date']):
        print('  ' + r['event_date'] + '  ' + opis_db(r).ljust(36)
              + format(net(r['attrs']), '9.2f') + '   ' + r['id'][:8]
              + '   izvod: ' + s['opis'][:26])
        for f, old, new in ch:
            print('        ' + f.ljust(15) + str(old)[:22].ljust(24) + '->  ' + str(new)[:36])

    hr('3 · ZA UVOZ — na izvodu, nema ga u bazi   [' + str(len(u['izvod_bez_para']))
       + ' redaka, ' + format(sum(x['iznos'] for x in u['izvod_bez_para']), '.2f')
       + ']   MI, transa')
    if not u['izvod_bez_para']:
        print('    nema')
    for s in sorted(u['izvod_bez_para'], key=lambda x: x['datum']):
        k = koka_par(koka, s['datum'], s['iznos'])
        kk = ('Koka ' + k[0][0] + ' r.' + str(k[0][1]) + ' "' + k[0][2][:20] + '"') if k else 'Koka: nije nadjena'
        print('  ' + s['datum'].strftime('%d.%m.%Y') + '  ' + s['opis'][:34].ljust(36)
              + format(s['iznos'], '9.2f') + '   ' + kk)
        for r, dd in u['daleki'].get(s['ref'], []):
            print('      ⚠ NE UVOZITI SLIJEPO — isti iznos vec u bazi: '
                  + r['event_date'] + ' "' + str(r['comment'])[:24] + '" ('
                  + str(dd) + ' dana razlike, ' + r['id'][:8] + ')')

    hr('4 · DUPLIKAT 1:N — redak baze = zbroj vise redaka izvoda koji su vec u bazi   ['
       + str(len(u['slozeni'])) + ']')
    if not u['slozeni']:
        print('    nema')
    for r, combo in u['slozeni']:
        a = r['attrs']
        print('  VISAK  ' + r['event_date'] + '  ' + opis_db(r).ljust(34)
              + format(net(a), '9.2f') + '   ' + r['id']
              + '   Tip=' + str(a.get('Tip')))
        for c in combo:
            print('   = izvod ' + c['datum'].strftime('%d.%m.') + '  ' + c['opis'][:34].ljust(36)
                  + format(c['iznos'], '9.2f'))
        rt = (str(a.get('Rata br')) + '/' + str(a.get('Broj rata'))) if a.get('Rate?') else '—'
        print('         PRAVILO: bankini redci su kostur; s ovoga preuzeti opis "'
              + str(r['comment']) + '" i ratu ' + rt + ', pa ga obrisati.')

    hr('5 · PITANJA ZA KOKU — u kosari, a banka za njih ne zna   ['
       + str(len(u['visak'])) + ' redaka, '
       + format(sum(net(r['attrs']) for r in u['visak']), '.2f') + ']')
    if not u['visak']:
        print('    nema')
    else:
        print('    Ili im je `Datum naplate` kriv (pripadaju drugom izvodu), ili banka')
        print('    za taj trosak ne zna. Prazan `Izvod opis` = nijedan izvod ih jos nije')
        print('    potvrdio; popunjen = potvrdio ih je NEKI DRUGI izvod, pa je datum kriv.\n')
    for r in sorted(u['visak'], key=lambda x: x['event_date']):
        a = r['attrs']
        k = koka_par(koka, ev_date(r), net(a))
        kk = ('Koka r.' + str(k[0][1])) if k else 'Koka: —'
        print('  ' + r['event_date'] + '  ' + opis_db(r).ljust(34)
              + format(net(a), '9.2f') + '  ' + str(a.get('Status'))[:8].ljust(10)
              + ('potvrdio drugi izvod' if a.get('Izvod opis') else 'NEPOTVRDJEN').ljust(22) + kk)
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--izvod', required=True)
    ap.add_argument('--koka', default=str(KOKA_DEFAULT))
    ap.add_argument('--env', default='prod', choices=['prod', 'test'])
    ap.add_argument('--izvor', default='Mastercard')
    ap.add_argument('--tol', type=int, default=5,
                    help='tolerancija u danima oko prozora izvoda')
    ap.add_argument('--dry', action='store_true',
                    help='samo ispis (zasad je to jedini nacin rada)')
    args = ap.parse_args()

    path = Path(args.izvod)
    if not path.exists():
        sys.exit('Nema ' + str(path))
    if not path.name.upper().startswith('MC_'):
        sys.exit('Zasad samo MC izvodi (' + path.name + '). Visa/ZABA imaju drugi format.')

    iz = parse_mc(path)
    url, key = load_env(args.env)
    db = load_db(url, key)
    koka = index_koka(Path(args.koka))
    u = uskladi(iz, db, args.izvor, args.tol)
    isp = ispravci(iz, u['pairs'])
    report(iz, u, isp, koka, path)


if __name__ == '__main__':
    main()
