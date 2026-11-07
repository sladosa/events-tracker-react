# -*- coding: utf-8 -*-
"""
_krug_excel.py — JEDAN Excel za uvoz iz svih izvoda kruga (S195 korak 3, KRUG_SPEC §3).

Ulaz su `Stanje`-a iz `_krug.obradi`; izlaz su retci za `visa_popravak.pisi` + stupci
`Izvod` i `Napomena` iza `Delete?` (uvoz ih ne čita — nisu u ATTRIBUTE LEGEND).

Pravila (KRUG_SPEC §3):
  • u file idu samo izvodi u stanju `excel` — `stani` znači „ne uvoziti", `ceka` nema retke;
  • JEDAN redak po `event_id` — dva izvoda na istom retku su `sukob` i redak ide samo kao
    odluka, bez izmjene;
  • `Delete?` se NIKAD ne popunjava sam; odluka je redak s napomenom „ODLUČI";
  • premještanje (veza među izvodima, krivo mjesto) je ISPRAVAK istog `event_id`, nikad
    novi redak + brisanje;
  • minuta novog retka je slobodna U BAZI tog dana i jedinstvena u CIJELOM fileu (MC i
    Visa bi inače nezavisno dale istu 14:00 istog dana ⇒ lažna kolizija pri uvozu);
  • redoslijed: po izvodu, unutar izvoda ODLUČI → NOVO → ISPRAVAK.
"""
from __future__ import annotations

import contextlib
import io
from collections import defaultdict
from datetime import date, datetime, time
from pathlib import Path

from _db import namjena_pravilo, namjena_za, rest

RED = {'ODLUČI': 0, 'NOVO': 1, 'ISPRAVAK': 2}


def _tiho(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        return fn(*a, **kw)


def _d(v) -> date:
    return v if isinstance(v, date) and not isinstance(v, datetime) else date.fromisoformat(str(v)[:10])


def _novi_attrs(racun, izvor, smjer, iznos, tip, podtip, izvod_opis, naplata, status, rata=None):
    a = {'Racun': racun, 'Izvor': izvor, 'Smjer': smjer,
         ('Uplata' if smjer == 'Uplata' else 'Isplata'): round(iznos, 2),
         'Tip': tip or 'N/A', 'Podtip': podtip or 'N/A', 'Izvod opis': izvod_opis or None,
         'Datum naplate': naplata, 'Status': status}
    if rata:
        a.update({'Rate?': True, 'Broj rata': rata[1], 'Rata br': rata[0]})
    return a


def _promjena(e) -> bool:
    r = e['r']
    if r is None:
        return True
    if e.get('rr') is not None and e['rr'] is not r:
        return True
    if (e['kom'] or None) != (r.get('comment') or None):
        return True
    for x, v in e['a'].items():
        st = r['attrs'].get(x)
        if x == 'Datum naplate' and st and v:
            if str(st)[:10] != str(v)[:10]:
                return True
        elif str(v) != str(st) and not (v in (None, '') and st in (None, '')):
            return True
    return False


def gradi(k, stanja) -> dict:
    from fill_from_izvod import klasificiraj
    from visa_popravak import lokalno, ZG
    by_id = {r['id']: r for r in k.db}
    nam = namjena_pravilo(k.url, k.key)
    sukob = set().union(*[s.podaci.get('sukob', set()) for s in stanja]) if stanja else set()
    unosi: list[dict] = []          # {r, rr, a, kom, zasto, izvod, vrsta, napomene[], date}

    def dodaj(s, vrsta, r, a, kom, zasto, datum=None, rr=None):
        if r is not None and r['id'] in sukob and vrsta != 'ODLUČI':
            return
        unosi.append({'r': r, 'rr': rr, 'a': a, 'kom': kom, 'zasto': zasto, 'izvod': s.izvod,
                      'vrsta': vrsta, 'napomene': [zasto], 'date': datum})

    for s in stanja:
        if s.stanje != 'excel':
            continue
        p = s.podaci
        if s.vrsta == 'MC':
            racun, izvor, dosp = k.racun_kartice('Mastercard'), 'Mastercard', p['dospijece']
            makni = {id(x['t']['red']) for x in p.get('premjesti', [])}
            novi = [n for n in p['novi'] if id(n) not in makni]
            if novi:
                _tiho(klasificiraj, novi, racun, k.env, db=k.db)
            for n in novi:
                a = _novi_attrs(racun, n['izvor'], n['smjer'], n['iznos'], n['tip'], n['podtip'],
                                n['opis'], n['naplata'], n['status'], n.get('rata'))
                dodaj(s, 'NOVO', None, a, n['komentar'], 'NOVO — ' + n['mc_zasto'], n['date'])
            for z in p['izmjene']:
                r = z['r']
                dodaj(s, 'ISPRAVAK', r, dict(r['attrs'], **z['polja']), z['komentar'],
                      'ISPRAVAK — ' + z['zasto'])
            for x in p.get('premjesti', []):
                r, n = x['r'], x['t']['red']
                a = dict(r['attrs'], Izvor=izvor, Racun=racun, **{'Datum naplate': dosp,
                         'Izvod opis': n['opis'], 'Status': 'Planiran'})
                if a.get('Tip') in (None, 'N/A') and n.get('tip') not in (None, 'N/A'):
                    a.update(Tip=n['tip'], Podtip=n['podtip'])
                dodaj(s, 'ISPRAVAK', r, a, r.get('comment') or n['komentar'],
                      f'ISPRAVAK — premješteno s {x["iz"]}: stavka ovog izvoda {x["t"]["date"]:%d.%m.} '
                      f'{(n["opis"] or "")[:40]}')
        elif s.vrsta == 'PBZVISA':
            izlaz = p['izlaz']
            if p.get('premjesti'):
                from visa_uvoz_izvoda import analiza
                ids = {x['r']['id'][:8] for x in p['premjesti']}
                izlaz = _tiho(analiza, p['pdf'], k.db, k.tax, naplata=p['naplata_d'],
                              dosp=p['dosp'], premjesti=ids)['izlaz']
                nadjeni = {r['id'][:8] for r, *_ in izlaz if r}
                for x in p['premjesti']:
                    if x['r']['id'][:8] not in nadjeni:     # Visa alat ga nije mogao premjestiti
                        s.odluke.append((x['r']['id'], 'veza s Visa stavkom nije provedena — provjeri ručno'))
            for r, a, kom, dele, zasto, *extra in izlaz:
                if r is None:
                    a = dict(a)
                    if not a.get('Namjena'):
                        a['Namjena'] = namjena_za(nam, a.get('Tip'))
                    dodaj(s, 'NOVO', None, a, kom, zasto, _d(extra[0][0]))
                else:
                    # premješten redak dolazi kao kopija s novim danom i minutom (Visa alat)
                    orig = by_id.get(r['id'], r)
                    zasto = zasto.replace('ISPRAVI — ', 'ISPRAVAK — ', 1).replace(
                        '(--premjesti)', '(veza s drugim izvodom)')
                    dodaj(s, 'ISPRAVAK', orig, a, kom, zasto,
                          rr=r if r is not orig else None)
        else:                                               # ZABA / RF
            racun = p['racun']
            novi = list(p['novi_t'])
            if novi:
                _tiho(klasificiraj, novi, racun, k.env, db=k.db)
            for t in novi:
                a = _novi_attrs(racun, 'Racun', t['smjer'], t['iznos'], t['tip'], t['podtip'],
                                t['opis'], t['naplata'], 'Izvrsen')
                dodaj(s, 'NOVO', None, a, t['komentar'],
                      'NOVO — s izvoda' + (' (storno: novac vraćen)' if t.get('storno') else ''), t['date'])
            prem = [(r_iz, kand[0]['r'], 'plaćeno s računa, a upisano kao ' + (kand[0]['izvor'] or '?'))
                    for r_iz, kand, j in p['odluke']['krivo'] if j]
            prem += [(x['t'], x['r'], f'premješteno s {x["iz"]}') for x in p.get('premjesti', [])]
            for r_iz, r, zasto in prem:
                a = dict(r['attrs'], Izvor='Racun', Racun=racun, Status='Izvrsen',
                         **{'Izvod opis': r_iz['opis'] or None, 'Datum naplate': r_iz['date']})
                rr = None
                if _d(r['event_date']) != r_iz['date']:
                    rr = dict(r, event_date=r_iz['date'].isoformat(), _novi_dan=True)
                dodaj(s, 'ISPRAVAK', r, a, r.get('comment'),
                      f'ISPRAVAK — krivo mjesto: {zasto} (izvod {r_iz["date"]:%d.%m.} {(r_iz["opis"] or "")[:40]})',
                      rr=rr)

    # ---- odluke: postojeći redak s napomenom (jedan redak po event_id)
    po_id = {e['r']['id']: e for e in unosi if e['r'] is not None}
    for s in stanja:
        if s.stanje != 'excel':
            continue
        for eid, tekst in s.odluke:
            if not eid or eid not in by_id:
                continue
            nap = (f'ODLUČI: {tekst}. Ako je duplikat ili ne postoji — odaberi DELETE u stupcu '
                   'Delete?. Ako je ispravan — ostavi prazno.')
            if eid in po_id:
                e = po_id[eid]
                if nap not in e['napomene']:
                    e['napomene'].insert(0, nap)
                e['vrsta'] = 'ODLUČI'
                continue
            r = by_id[eid]
            e = {'r': r, 'rr': None, 'a': dict(r['attrs']), 'kom': r.get('comment'), 'zasto': 'ODLUČI — ' + tekst,
                 'izvod': s.izvod, 'vrsta': 'ODLUČI', 'napomene': [nap], 'date': None}
            unosi.append(e)
            po_id[eid] = e

    # ---- redoslijed i minute
    red_izvoda = {s.izvod: i for i, s in enumerate(stanja)}
    unosi.sort(key=lambda e: (red_izvoda[e['izvod']], RED[e['vrsta']],
                              str(e['date'] or (e['r'] or {}).get('event_date')), e['kom'] or ''))
    zauzeto = defaultdict(set)
    for r in k.db:
        if r.get('session_start'):
            zauzeto[r['event_date']].add(lokalno(r['session_start']))

    def slobodna(dan: str) -> str:
        for m in range(14 * 60, 24 * 60):
            hh = f'{m // 60:02d}:{m % 60:02d}'
            if hh not in zauzeto[dan]:
                zauzeto[dan].add(hh)
                return hh
        raise RuntimeError(f'nema slobodne minute na {dan}')

    redci, izv, nap = [], [], []
    for e in unosi:
        a = {x: v for x, v in e['a'].items() if v is not None}
        if e['r'] is None:
            # S181: zadana Namjena po Tipu (isti `default_map` kao forma) — SVAKOM novom retku,
            #   ne samo Visi (S195: MC i ZABA su prvim pisanjem izašli bez Namjene).
            if not a.get('Namjena'):
                a['Namjena'] = namjena_za(nam, a.get('Tip'))
            d = e['date'].isoformat()
            redci.append((None, a, e['kom'], False, e['zasto'], [d, slobodna(d)]))
        else:
            rr = e['r']
            if e.get('rr') is not None:
                rr = dict(e['rr'])
                if rr.pop('_novi_dan', False) or rr['event_date'] != e['r']['event_date']:
                    hh = slobodna(rr['event_date'])
                    rr['session_start'] = datetime.combine(_d(rr['event_date']),
                                                           time(int(hh[:2]), int(hh[3:])), tzinfo=ZG).isoformat()
            redci.append((rr, a, e['kom'], False, e['zasto']))
        izv.append(e['izvod'])
        nap.append(' · '.join(dict.fromkeys(e['napomene'])))

    novih = sum(1 for e in unosi if e['r'] is None)
    izmjena = sum(1 for e in unosi if e['r'] is not None and _promjena(e))
    samo_odluka = sum(1 for e in unosi if e['r'] is not None and not _promjena(e))
    return {'redci': redci, 'izvod': izv, 'napomena': nap, 'namjena': nam,
            'novih': novih, 'izmjena': izmjena, 'samo_odluka': samo_odluka,
            'odluka': sum(1 for e in unosi if e['vrsta'] == 'ODLUČI')}


def pisi_file(k, plan: dict, out: Path) -> Path:
    """Piše file kroz zajednički pisač (`visa_popravak.pisi`: kol. G = autor iz baze,
    izbornici Tip/Podtip/Namjena + `provjeri()`). E-mailovi se čitaju iz baze (K9)."""
    from visa_popravak import pisi
    ids = sorted({r['user_id'] for r, *_ in plan['redci'] if r} | {k.area['user_id']})
    prof = rest(k.url, k.key, f'profiles?id=in.({",".join(ids)})&select=id,email')
    emails = {p['id']: p['email'] for p in prof if p.get('email')}
    if k.area['user_id'] not in emails:
        raise SystemExit('✗ Ne nalazim e-mail vlasnice Aree — novi retci bi bili „tuđi" (S125).')
    _tiho(pisi, plan['redci'], {}, 'krug', k.tax, namjena=plan['namjena'], emails=emails,
          vlasnik=emails[k.area['user_id']], stupci=[('Izvod', plan['izvod']), ('Napomena', plan['napomena'])],
          out=out, delete_izbornik=True)
    return out
