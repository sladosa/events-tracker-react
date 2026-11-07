# -*- coding: utf-8 -*-
"""
_krug.py — jezgra mjesečnog kruga (S195, `docs/KRUG_SPEC.md`).

Za svaki izvod pusti ISTU analizu kao alat (`visa_uvoz_izvoda.analiza`,
`fill_from_izvod.mc_odluke` / `zaba_odluke`) i iz rezultata IZRAČUNA stanje
(K2) — ništa se ne pamti u fileu:

    gotovo   analiza nema što predložiti (0 New · 0 Modify · 0 odluka) i kontrola ✓
    excel    ima što uvesti (ispravci, novi retci) — možda i odluke za čovjeka
    sidro    bankovni izvod ✓ u cent, a sidra na datum izvoda nema (K6: upiše ga krug)
    ceka     čeka čovjeka izvan filea (Visa: plaćanje; MC: traka 11.)
    stani    nešto ne štima, a alat ne zna što predložiti — čovjek mora pogledati

⚠ JEZGRA NE ZNA PUTANJE NI IMENA RAČUNA (K9). Dobiva popis PDF-ova i `Kontekst`
  (baza, Area, konfiguracija iz `areas.settings.dashboard`). Ukucano je samo
  `CITACI` — koji čitač čita koji izvod — jer to nije podatak baze nego koda.
⚠ JEZGRA NE PIŠE NIŠTA osim sidra (K6), i to samo kroz `upisi_sidro`, koju
  pozivatelj zove izričito. Excel piše omotač (korak 3).
⚠ Baza se učita JEDNOM (`load_db`) za sve izvode — odluke se zatim spajaju:
  jedan redak baze smije dirati samo jedan izvod (`sukobi`).
"""
from __future__ import annotations

import contextlib
import io
import json
import re
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace

from _db import load_env, rest

EPS = 0.005

# Koji izvod čita koji čitač — po prefiksu imena koje daje razvrstač (`TIP_YYYY-MM.pdf`).
# `racun` banke i `izvor` kartice su VRIJEDNOSTI atributa; račun kartice se ne piše
# ovdje nego čita iz `due.baskets[izvor].account` (jedan izvor istine s trakom).
# ⚠ Kad Area dobije `settings.statements` (KRUG_SPEC §6), ovo se čita odande.
CITACI = {
    'ZABA':    {'vrsta': 'banka',   'citac': 'zaba',     'racun': 'Kokin tekući ZABA'},
    'RF':      {'vrsta': 'banka',   'citac': 'rf',       'racun': 'Sašin tekući RF'},
    'MC':      {'vrsta': 'kartica', 'citac': 'zaba_mc',  'izvor': 'Mastercard'},
    'PBZVISA': {'vrsta': 'kartica', 'citac': 'pbz_visa', 'izvor': 'Visa'},
}
AREA = 'Financije_all'
RF_BEZ_PRETHODNOG = 40      # dana: RF ne dolazi svaki mjesec — dalji prethodni nije „prethodni"


def prefiks(pdf: Path) -> str | None:
    m = re.match(r'^([A-Z]+)_\d{4}-\d{2}', pdf.name)
    return m.group(1) if m and m.group(1) in CITACI else None


# --------------------------------------------------------------------------- kontekst
@dataclass
class Kontekst:
    env: str
    url: str
    key: str
    area: dict                     # id, user_id, settings
    db: list[dict]                 # load_db
    tax: dict                      # Tip -> [Podtip]
    danas: date
    saldo: dict = field(default_factory=dict)    # widget balance_by_group
    sidra: list[dict] = field(default_factory=list)

    @property
    def kosare(self) -> dict:
        return (self.saldo.get('due') or {}).get('baskets') or {}

    def racun_kartice(self, izvor: str) -> str:
        b = self.kosare.get(izvor)
        if not b or not b.get('account'):
            raise KeyError(f'`due.baskets.{izvor}.account` nije u configu pločice')
        return b['account']


def ucitaj(env: str, danas: date | None = None) -> Kontekst:
    from uskladi_izvod import load_db
    from visa_uvoz_izvoda import taksonomija
    url, key = load_env(env)
    areas = rest(url, key, f'areas?name=eq.{AREA}&select=id,user_id,settings')
    if len(areas) != 1:
        raise SystemExit(f'✗ Area `{AREA}`: nađeno {len(areas)}, očekivana točno jedna.')
    area = areas[0]
    saldo = next((w for w in (area['settings'].get('dashboard') or {}).get('widgets', [])
                  if w.get('type') == 'balance_by_group'), None)
    if not saldo:
        raise SystemExit('✗ Area nema pločicu salda (`balance_by_group`) — krug nema po čemu mjeriti.')
    sidra = rest(url, key, f"balance_anchors?area_id=eq.{area['id']}"
                 '&select=id,group_slug,group_value,amount,confirmed_on,note')
    return Kontekst(env=env, url=url, key=key, area=area, db=load_db(url, key),
                    tax=taksonomija(url, key), danas=danas or date.today(),
                    saldo=saldo, sidra=sidra)


def _rpc(k: Kontekst, ime: str, args: dict):
    req = urllib.request.Request(f'{k.url}/rest/v1/rpc/{ime}', method='POST',
                                 data=json.dumps(args).encode(),
                                 headers={'apikey': k.key, 'Authorization': 'Bearer ' + k.key,
                                          'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode() or 'null')


def promet_app(k: Kontekst, racun: str, od: date, do: date) -> tuple[float, int]:
    """Σ uplata − Σ isplata u `(od, do]` — ISTI RPC i ISTI filtri kao pločica (čitani iz
    configa, ne prepisani: S143 `FILTERS_IZVRSENO` je zaostajao za pločicom).
    ⚠ `p_from` je isključiv (S144)."""
    w = k.saldo
    res = _rpc(k, 'rpc_area_group_agg', {
        'p_area_id': k.area['id'], 'p_group_slug': w['group_by'],
        'p_plus_slug': w['plus'], 'p_minus_slug': w['minus'], 'p_filters': w.get('filters') or [],
        'p_from': od.isoformat(), 'p_as_of': do.isoformat()})
    for r in res or []:
        if r['group_value'] == racun:
            return round(float(r['plus_sum']) - float(r['minus_sum']), 2), int(r['n'])
    return 0.0, 0


def saldo_app(k: Kontekst, racun: str, na: date) -> float | None:
    """Saldo koji pločica pokazuje na dan `na`. ⚠ BEZ `p_plus_slug`/`p_minus_slug` RPC
    vraća nule i saldo = sidro (S129) — zato se slugovi uvijek predaju."""
    w = k.saldo
    res = _rpc(k, 'rpc_area_balance_anchored', {
        'p_area_id': k.area['id'], 'p_group_slug': w['group_by'],
        'p_plus_slug': w['plus'], 'p_minus_slug': w['minus'], 'p_filters': w.get('filters') or [],
        'p_as_of': na.isoformat()})
    for r in res or []:
        if r['group_value'] == racun:
            return round(float(r['balance']), 2)
    return None


def upisi_sidro(k: Kontekst, racun: str, iznos: float, na: date, izvod: str) -> dict:
    """K6: sidro iz ISPISANOG stanja izvoda. Isti oblik bilješke kao pločica i
    `make_saldo_anchors` (`ispisano stanje s izvoda · <file>`). Vraća upisani redak —
    ⚠ upis se mjeri brojem redaka (RLS-blokiran upis „uspije" s 0 redaka)."""
    body = {'area_id': k.area['id'], 'group_slug': k.saldo['group_by'], 'group_value': racun,
            'amount': iznos, 'confirmed_on': na.isoformat(),
            'note': f'ispisano stanje s izvoda · {izvod}', 'created_by': k.area['user_id']}
    req = urllib.request.Request(f'{k.url}/rest/v1/balance_anchors', method='POST',
                                 data=json.dumps(body).encode(),
                                 headers={'apikey': k.key, 'Authorization': 'Bearer ' + k.key,
                                          'Content-Type': 'application/json',
                                          'Prefer': 'return=representation'})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.loads(r.read().decode() or '[]')
    if len(rows) != 1:
        raise RuntimeError(f'Sidro nije upisano (vraćeno {len(rows)} redaka).')
    k.sidra.append(rows[0])
    return rows[0]


# --------------------------------------------------------------------------- rezultat
@dataclass
class Stanje:
    izvod: str
    vrsta: str                       # MC | PBZVISA | ZABA | RF
    stanje: str                      # gotovo | excel | sidro | ceka | stani
    sazetak: str                     # jedna rečenica za izvještaj
    novi: int = 0
    modify: int = 0
    brisanja: int = 0
    odluke: list = field(default_factory=list)       # [(event_id|None, tekst)]
    ceka: list = field(default_factory=list)         # stvari izvan filea (traka, plaćanje)
    napomene: list = field(default_factory=list)     # što je krug sam razriješio (veze, pomaknut dan)
    diraju: set = field(default_factory=set)         # event_id-evi koje bi izvod mijenjao
    sidro: dict | None = None                        # {'racun','iznos','na'} — za upis (K6)
    podaci: dict = field(default_factory=dict)       # sirovi rezultat analize (korak 3: Excel)
    ispis: str = ''                                  # ispis alata (detalji u izvještaju)


def _tiho(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r = fn(*a, **kw)
    return r, buf.getvalue()


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _d(v) -> date:
    return date.fromisoformat(str(v)[:10])


def _eur(x: float) -> str:
    return f'{x:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


# --------------------------------------------------------------------------- MC
def kosara_stanje(k: Kontekst, izvor: str, dosp: date, iznos: float) -> tuple[str, str]:
    """Je li skupna naplata košare upisana (traka) i jesu li kupnje `Izvrsen`.
    Skupni redak se PREPOZNAJE, ne veže (isto pravilo kao traka, `matchSettleRow`):
    račun košare + opis = `due.baskets[k].text` + ≤ 3 dana od dospijeća."""
    b = k.kosare.get(izvor) or {}
    tekst, racun = (b.get('text') or '').strip().lower(), b.get('account')
    w = b.get('window') or {}
    prije, poslije = w.get('before', 3), w.get('after', 3)
    skupni = [r for r in k.db if r['attrs'].get('Racun') == racun
              and r['attrs'].get('Izvor') == 'Racun'
              and str(r.get('comment') or '').strip().lower() == tekst
              and -prije <= (_d(r['event_date']) - dosp).days <= poslije]
    clanovi = [r for r in k.db if r['attrs'].get('Izvor') == izvor
               and str(r['attrs'].get('Datum naplate') or '')[:10] == dosp.isoformat()]
    planiran = sum(1 for r in clanovi if r['attrs'].get('Status') == 'Planiran')
    if not skupni:
        if k.danas < dosp:
            return 'ceka', f'naplata {dosp:%d.%m.} — traka „Čeka potvrdu" (Koka), iznos {_eur(iznos)}'
        return 'ceka', (f'dospjelo {dosp:%d.%m.}, skupna naplata nije upisana — traka '
                        f'„Čeka potvrdu" (Koka), iznos s izvoda {_eur(iznos)}')
    s = round(sum(_num(r['attrs'].get('Isplata')) for r in skupni), 2)
    if abs(s - iznos) >= EPS:
        return 'stani', (f'skupna naplata upisana kao {_eur(s)}, izvod kaže {_eur(iznos)} — '
                         f'provjeri iznos s bankom')
    if planiran:
        return 'ceka', f'naplata upisana, ali {planiran} kupnji još `Planiran` — traka „prebaci statuse"'
    return 'gotovo', f'naplaćeno {_d(skupni[0]["event_date"]):%d.%m.} {_eur(s)} ✓'


def analiza_mc(k: Kontekst, pdf: Path, cfg: dict) -> Stanje:
    from fill_from_izvod import mc_odluke
    izvor = cfg['izvor']
    a = SimpleNamespace(presedan=k.env, mc=pdf, mc_izvor=izvor, mc_tol=5, brisi=[])
    res, ispis = _tiho(mc_odluke, a, k.racun_kartice(izvor), None, [], db=k.db)
    st = Stanje(pdf.name, 'MC', 'excel', '', novi=len(res['novi']), modify=len(res['izmjene']),
                podaci=res, ispis=ispis)
    st.diraju = {z['r']['id'] for z in res['izmjene']} | {r['id'] for r, _ in res['prijavljeni'].values()}
    pomaknuti = res['pomaknuti']
    for i8, (r, zasto) in res['prijavljeni'].items():
        if r['id'] in pomaknuti:
            continue
        st.odluke.append((r['id'], f'{r["event_date"]} {_eur(abs(_num(r["attrs"].get("Isplata")) - _num(r["attrs"].get("Uplata"))))} '
                                   f'„{r.get("comment") or ""}" — {zasto}'))
    # za vezu među izvodima (`veze`): višak košare i stavke izvoda koje bi ušle kao NOVE
    st.podaci['visak_r'] = [r for r in res['sparivanje']['visak'] if r['id'] not in pomaknuti]
    st.podaci['novi_t'] = [{'date': n['date'], 'iznos': n['iznos'], 'smjer': n['smjer'],
                            'opis': n['opis'], 'red': n} for n in res['novi'] if n.get('opis')]
    kontrola = (f'košara {res["dospijece"]:%d.%m.}: Σ poslije uvoza {_eur(res["kontrola"])} '
                f'vs izvod {_eur(res["izvod_suma"])} ' + ('✓ u cent' if res['kontrola_ok'] else '✗'))
    ks, kt = kosara_stanje(k, izvor, res['dospijece'], res['izvod_suma'])
    if not res['izmjene'] and not res['novi'] and not st.odluke and res['kontrola_ok']:
        st.stanje = 'stani' if ks == 'stani' else 'gotovo'
        st.sazetak = f'{len(res["sparivanje"]["parovi"])} stavki potvrđeno · {kontrola}'
    else:
        st.sazetak = f'{st.novi} New · {st.modify} Modify · {len(st.odluke)} odluka · {kontrola}'
        if pomaknuti:
            st.sazetak += f' · {len(pomaknuti)} kupnji s kraja izvoda u košaru {res["iduca"]:%d.%m.}'
    # Košara se mjeri UVIJEK (i kad izvod ima posla): naplata je zaseban korak (traka).
    if ks == 'gotovo':
        st.sazetak += f' · {kt}'
    else:
        st.ceka.append(kt)
    return st


# --------------------------------------------------------------------------- Visa
def nadji_naplatu_vise(k: Kontekst, racun: str, suma: float, dosp: date) -> tuple[list, list]:
    """Redak naplate Vise na računu (K7: datum naplate dolazi IZ BAZE, iz trake).
    Vraća (točni, slični): točan = isti iznos kao Σ izvoda; sličan = opis „visa" ili
    isti iznos — kao pravilo `visa_uvoz_izvoda` (drugi redak naplate miče saldo dvaput)."""
    kand = [r for r in k.db if r['attrs'].get('Racun') == racun
            and r['attrs'].get('Izvor') == 'Racun' and _num(r['attrs'].get('Isplata')) >= 1
            and -15 <= (_d(r['event_date']) - dosp).days <= 6]
    tocni = [r for r in kand if abs(_num(r['attrs'].get('Isplata')) - suma) < EPS]
    slicni = [r for r in kand if r not in tocni and 'visa' in str(r.get('comment') or '').lower()]
    return tocni, slicni


def analiza_visa(k: Kontekst, pdf: Path, cfg: dict) -> Stanje:
    from enrich_from_izvoda import parse_pbz_visa
    from visa_uvoz_izvoda import Stani, analiza, dospijece
    izvor = cfg['izvor']
    racun = k.racun_kartice(izvor)
    dosp = dospijece(pdf)
    isp = [t for t in parse_pbz_visa(pdf) if t['smjer'] == 'Isplata']
    suma = round(sum(t['iznos'] for t in isp), 2)
    st = Stanje(pdf.name, 'PBZVISA', 'ceka', '')
    tocni, slicni = nadji_naplatu_vise(k, racun, suma, dosp)
    if len(tocni) > 1:
        st.stanje = 'stani'
        st.sazetak = (f'na {racun} stoji {len(tocni)} retka od {_eur(suma)} oko dospijeća — '
                      'koji je naplata? (drugi bi saldo pomaknuo dvaput)')
        st.odluke = [(r['id'], f'{r["event_date"]} {_eur(suma)} „{r.get("comment") or ""}"') for r in tocni]
        return st
    if not tocni and not slicni:
        # K7: prije plaćanja nema filea — jedan uvoz poslije
        st.sazetak = f'izvod {len(isp)} stavki, Σ {_eur(suma)} · naplata još nije upisana'
        st.ceka.append(f'Saša plati {_eur(suma)} („Novi saldo") do {dosp:%d.%m.} → Koka u traci '
                       '(Visa, „Ne — iznos ili dan je drukčiji", iznos s izvoda) → pusti krug')
        return st
    naplata = _d((tocni or slicni)[0]['event_date'])
    try:
        res, ispis = _tiho(analiza, pdf, k.db, k.tax, naplata=naplata, dosp=dosp)
    except Stani as e:
        st.stanje = 'stani'
        st.sazetak = str(e).lstrip('✗ ').strip()
        st.odluke = [(r['id'], f'{r["event_date"]} {_eur(_num(r["attrs"].get("Isplata")))} '
                               f'„{r.get("comment") or ""}" — liči na naplatu, izvod kaže {_eur(suma)}')
                     for r in slicni]
        return st
    st.podaci, st.ispis = res, ispis
    res.update(pdf=pdf, naplata_d=naplata, dosp=dosp)     # korak 3: ponovo s `premjesti=`
    st.novi, st.modify, st.brisanja = res['nove'], res['modify'], res['brisanja']
    st.diraju = {r['id'] for r, *_ in res['izlaz'] if r}
    st.podaci['visak_r'] = [r for r, _ in res['visak']]
    st.podaci['novi_t'] = [{'date': _d(extra[0][0]), 'iznos': _num(a.get('Isplata')), 'smjer': 'Isplata',
                            'opis': a.get('Izvod opis'), 'red': (r, a, kom, dele, zasto, *extra)}
                           for r, a, kom, dele, zasto, *extra in res['izlaz']
                           if r is None and a.get('Izvor') == izvor]
    for t, kand in res['drugdje']:
        for r in kand:
            st.diraju.add(r['id'])
            st.odluke.append((r['id'], f'izvod {t["date"]:%d.%m.} {_eur(t["iznos"])} {t["opis"][:30]} — u bazi '
                                       f'kao {r["attrs"].get("Izvor")}/{r["attrs"].get("Racun")} '
                                       f'{r["event_date"]} „{r.get("comment") or ""}" (krivo mjesto?)'))
    for r, dup in res['visak']:
        st.diraju.add(r['id'])
        st.odluke.append((r['id'], f'{r["event_date"]} {_eur(_num(r["attrs"].get("Isplata")))} '
                                   f'„{r.get("comment") or ""}" u košari, izvod ga ne nosi'
                                   + (f' — DUPLIKAT? isti iznos kao {dup["event_date"]}' if dup else '')))
    kontrola = (f'Σ {_eur(res["zbroj"])} vs izvod {_eur(suma)} '
                + ('✓ u cent' if res['kontrola_ok'] else '✗'))
    if not (st.novi or st.modify or st.brisanja or st.odluke) and res['kontrola_ok']:
        st.stanje = 'gotovo'
        st.sazetak = f'{len(isp)} stavki potvrđeno, naplata {naplata:%d.%m.} · {kontrola}'
    else:
        st.stanje = 'excel'
        st.sazetak = (f'{st.novi} New · {st.modify} Modify · {len(st.odluke)} odluka · '
                      f'naplata {naplata:%d.%m.} · {kontrola}')
    return st


# --------------------------------------------------------------------------- banka
def _prethodni_close(pdf: Path, citac: str, prije_od: date, svi_izvodi) -> date | None:
    """Zadnja transakcija PRETHODNOG izvoda istog računa — granica prozora (kao
    `promet_check`). ⚠ RF ne dolazi svaki mjesec: dalji prethodni nije granica."""
    from fill_from_izvod import zaba_printed_balance, rf_rows
    pref = prefiks(pdf)
    stariji = [p for p in svi_izvodi(f'{pref}_*.pdf') if p.name < pdf.name and prefiks(p) == pref]
    if not stariji:
        return None
    p = stariji[-1]
    if citac == 'zaba':
        return zaba_printed_balance(p)[1]
    rr, _ = _tiho(rf_rows, p, None, None)
    zadnji = max((r['date'] for r in rr), default=None)
    if zadnji and (prije_od - zadnji).days <= RF_BEZ_PRETHODNOG:
        return zadnji
    return None


def analiza_banka(k: Kontekst, pdf: Path, cfg: dict, svi_izvodi) -> Stanje:
    from fill_from_izvod import (postojeci_iz_baze, rf_rows, spojeni_retci, zaba_odluke,
                                 zaba_printed_balance, zaba_rows)
    from _zaba_spajanje import obrni_storno
    citac, racun = cfg['citac'], cfg['racun']
    st = Stanje(pdf.name, prefiks(pdf), 'excel', '')
    if citac == 'zaba':
        izv, ispis = _tiho(zaba_rows, pdf, None, None)
        novo, close = zaba_printed_balance(pdf)
    else:
        izv, ispis = _tiho(rf_rows, pdf, None, None)
        for r in izv:                       # RF parser ne obrće storno (ZABA da, S194)
            r['smjer'], r['iznos'], r['storno'] = obrni_storno(r['smjer'], r['iznos'])
        close = max((r['date'] for r in izv), default=None)
        novo = next((r['stanje'] for r in reversed(izv) if r.get('stanje') is not None), None)
    if not izv or not close:
        st.stanje, st.sazetak = 'stani', 'čitač izvoda nije našao nijednu transakciju'
        return st
    prvi = min(r['date'] for r in izv)
    prev = _prethodni_close(pdf, citac, prvi, svi_izvodi)
    od = prev if prev and prev < prvi else prvi - timedelta(days=1)

    banka = round(sum(r['iznos'] if r['smjer'] == 'Uplata' else -r['iznos'] for r in izv), 2)
    app, n = promet_app(k, racun, od, close)
    promet_ok = abs(app - banka) < EPS

    post = postojeci_iz_baze(k.db, racun, od - timedelta(days=3), close + timedelta(days=3))
    o = zaba_odluke(izv, post)
    novi, spojevi = spojeni_retci([p for p in post if (p['izvor'] or 'Racun') == 'Racun'],
                                  o['novi'], izv)
    iskoristeni = ({id(p) for _, p in o['dup']} | {id(p) for _, p in o['blizu']}
                   | {id(p) for _, k_, j in o['krivo'] if j for p in k_} | {id(p) for p, _ in spojevi})
    skupni = {(h, r['iznos']) for r, h in o['skupna_blizu']}
    visak = [p for p in post if (p['izvor'] or 'Racun') == 'Racun' and id(p) not in iskoristeni
             and od < p['date'] <= close and p['r']['attrs'].get('Status') != 'Planiran'
             and (p['date'].isoformat(), p['iznos']) not in skupni]
    # Pomaknut dan (S195, izmjereno ZABA_2026-09: parking 0,70 ×2 u bazi 07.09., banka 09.09.;
    #   ZABA_2026-10: Zoran 94,47 22.10. / 25.10.): stavka izvoda bez para i redak baze bez
    #   para, isti smjer i iznos, ≤ DRUGDJE_DANA, OBA u prozoru ovog izvoda ⇒ isti redak.
    #   Promet prozora ne mijenja, pa nije izmjena nego napomena. Najbliži dan prvi, 1:1.
    from _zaba_spajanje import DRUGDJE_DANA
    pomaknut = []
    for r in sorted(novi, key=lambda r: r['date']):
        k_ = [p for p in visak if p['smjer'] == r['smjer'] and abs(p['iznos'] - r['iznos']) < EPS
              and abs((p['date'] - r['date']).days) <= DRUGDJE_DANA]
        if k_:
            p = min(k_, key=lambda p: abs((p['date'] - r['date']).days))
            visak.remove(p)
            pomaknut.append((r, p))
    novi = [r for r in novi if all(r is not x for x, _ in pomaknut)]
    for r, p in pomaknut:
        st.napomene.append(f'{r["date"]:%d.%m.} {r["smjer"]} {_eur(r["iznos"])} {r["opis"][:30]} — u bazi '
                           f'{p["date"]:%d.%m.}: isti redak, banka ga je knjižila drugi dan')
    st.podaci = {'izvod': izv, 'odluke': o, 'novi': novi, 'spojevi': spojevi, 'visak': visak,
                 'pomaknut': pomaknut, 'visak_r': [p['r'] for p in visak], 'novi_t': novi,
                 'od': od, 'close': close, 'novo': novo, 'banka': banka, 'app': app, 'n': n,
                 'racun': racun}
    st.ispis = ispis
    st.novi = len(novi)
    st.modify = sum(1 for _, _, j in o['krivo'] if j)
    for r, kand, jasno in o['krivo']:
        for p in kand:
            st.diraju.add(p['r']['id'])
            if not jasno:
                st.odluke.append((p['r']['id'], f'izvod {r["date"]:%d.%m.} {_eur(r["iznos"])} {r["opis"][:30]} — '
                                                f'u bazi kao {p["izvor"]} {p["date"]:%d.%m.} „{p["opis"] or ""}" (krivo mjesto?)'))
    for p in visak:
        st.diraju.add(p['r']['id'])
        st.odluke.append((p['r']['id'], f'{p["date"]:%d.%m.} {p["smjer"]} {_eur(p["iznos"])} „{p["opis"] or ""}" '
                                        '— u bazi, a izvod ga nema'))
    prozor = f'{od + timedelta(days=1):%d.%m.}–{close:%d.%m.%Y.}'
    kontrola = (f'promet {prozor}: app {_eur(app)} vs banka {_eur(banka)} '
                + ('✓ u cent' if promet_ok else f'✗ Δ {_eur(app - banka)}'))

    if novi or st.modify or st.odluke:
        st.stanje = 'excel'
        st.sazetak = f'{st.novi} New · {st.modify} Modify · {len(st.odluke)} odluka · {kontrola}'
        return st
    if not promet_ok:
        st.stanje = 'stani'
        st.sazetak = (f'{kontrola} — izvod i baza se slažu redak po redak, a promet ne: traži na '
                      'drugim izvodima istog mjeseca (S161, S192); sidro se ne upisuje')
        return st
    # promet ✓ i ništa za predložiti ⇒ sidro (K6)
    if novo is None:
        st.stanje, st.sazetak = 'stani', f'{kontrola} · izvod nema ispisano stanje — sidro ručno na pločici'
        return st
    vec = [s for s in k.sidra if s['group_value'] == racun and _d(s['confirmed_on']) >= close]
    tocno = [s for s in vec if _d(s['confirmed_on']) == close]
    if tocno and all(abs(float(s['amount']) - novo) >= EPS for s in tocno):
        st.stanje = 'stani'
        st.sazetak = (f'{kontrola} · sidro {close:%d.%m.} = {_eur(float(tocno[0]["amount"]))}, a izvod '
                      f'ispisuje {_eur(novo)} — koje je točno?')
        return st
    if vec:
        st.stanje = 'gotovo'
        s = max(vec, key=lambda s: s['confirmed_on'])
        st.sazetak = f'{kontrola} · sidro {_d(s["confirmed_on"]):%d.%m.} {_eur(float(s["amount"]))} ✓'
        return st
    saldo = saldo_app(k, racun, close)
    if saldo is None or abs(saldo - novo) >= EPS:
        st.stanje = 'stani'
        st.sazetak = (f'{kontrola}, ali saldo na {close:%d.%m.} je {_eur(saldo or 0)}, a izvod ispisuje '
                      f'{_eur(novo)} — greška je STARIJA od ovog izvoda; sidro bi je sakrilo')
        return st
    st.stanje = 'sidro'
    st.sidro = {'racun': racun, 'iznos': novo, 'na': close}
    st.sazetak = f'{kontrola} · saldo {_eur(saldo)} = izvod ⇒ sidro {_eur(novo)} na {close:%d.%m.}'
    return st


# --------------------------------------------------------------------------- cijeli krug
def obradi(k: Kontekst, pdfs: list[Path], svi_izvodi) -> list[Stanje]:
    """Svi izvodi jednim prolazom. Redoslijed: kartice pa banke (krivo mjesto se
    razrješava protiv oba). Na kraju sukobi: redak koji traže dva izvoda."""
    red = {'MC': 0, 'PBZVISA': 1, 'ZABA': 2, 'RF': 3}
    out = []
    for pdf in sorted(pdfs, key=lambda p: (red.get(prefiks(p) or '', 9), p.name)):
        pref = prefiks(pdf)
        cfg = CITACI.get(pref) if pref else None
        if not cfg:
            out.append(Stanje(pdf.name, '?', 'stani', 'ne znam koji je ovo izvod (ime nije TIP_YYYY-MM.pdf)'))
            continue
        try:
            if pref == 'MC':
                out.append(analiza_mc(k, pdf, cfg))
            elif pref == 'PBZVISA':
                out.append(analiza_visa(k, pdf, cfg))
            else:
                out.append(analiza_banka(k, pdf, cfg, svi_izvodi))
        except SystemExit as e:          # alat je stao porukom (npr. nepoznat autor retka)
            out.append(Stanje(pdf.name, pref, 'stani', str(e.code).lstrip('✗ ').strip()))
    veze(out)
    sukobi(out)
    zakljuci(out)
    return out


def _neto(smjer: str, iznos: float) -> float:
    return iznos if smjer == 'Uplata' else -iznos


def zakljuci(stanja: list[Stanje]) -> None:
    """Sažetak iz KONAČNIH brojki — veze i sukobi mijenjaju New/Modify/odluke poslije
    analize. Bankovni izvod dobiva i promet POSLIJE uvoza (kao MC „Σ poslije uvoza"):
    app + novi retci + kartični redak premješten na račun − redak koji odlazi s računa."""
    for s in stanja:
        if s.stanje != 'excel':
            continue
        s.sazetak = re.sub(r'^-?\d+ New · \d+ Modify · \d+ odluka',
                           f'{s.novi} New · {s.modify} Modify · {len(s.odluke)} odluka', s.sazetak)
        p = s.podaci
        if s.vrsta in ('MC', 'PBZVISA') and p.get('odlazi'):
            # redak koji odlazi na drugi izvod izlazi iz ove košare; premješten na ovaj
            # zamjenjuje novu stavku istog iznosa, pa Σ ne mijenja
            prije = p['kontrola'] if s.vrsta == 'MC' else p['zbroj']
            van = sum(_num(x['r']['attrs'].get('Isplata')) - _num(x['r']['attrs'].get('Uplata'))
                      for x in p['odlazi'])
            poslije = round(prije - van, 2)
            ok = abs(poslije - p['izvod_suma']) < EPS
            s.sazetak += (f' · poslije veza Σ {_eur(poslije)} ' + ('✓ u cent' if ok else
                          f'✗ Δ {_eur(poslije - p["izvod_suma"])}'))
            p['poslije_ok'] = ok
        if s.vrsta not in ('ZABA', 'RF') or 'app' not in p:
            continue
        poslije = p['app'] + sum(_neto(t['smjer'], t['iznos']) for t in p['novi_t'])
        poslije += sum(_neto(r['smjer'], r['iznos']) for r, _, j in p['odluke']['krivo'] if j)
        poslije += sum(_neto(x['t']['smjer'], x['t']['iznos']) for x in p.get('premjesti', []))
        for x in p.get('odlazi', []):
            a = x['r']['attrs']
            poslije -= _num(a.get('Uplata')) - _num(a.get('Isplata'))
        poslije = round(poslije, 2)
        ok = abs(poslije - p['banka']) < EPS
        s.sazetak += (f' · poslije uvoza {_eur(poslije)} ' + ('✓ u cent' if ok else
                      f'✗ Δ {_eur(poslije - p["banka"])} — ne uvoziti dok se ne razjasni'))
        p['poslije_ok'] = ok


def veze(stanja: list[Stanje]) -> None:
    """Višak jednog izvoda koji je par NOVOG retka drugog izvoda (KRUG_SPEC §2, S161).

    Izmjereno S195 (TEST, listopad): ZABA višak 9,55 @ 17.10. (`Racun`) je MC stavka
    GOOGLE *YOUTUBE 9,55 @ 17.10.; MC višak Studenac 11,75 je Visa stavka (S192). Bez veze
    jedan izvod kaže „baza ima, izvod nema", drugi „izvod ima, baza nema" — dvije odluke
    za Koku i jedan duplikat ako ih ne spoji.

    Jasno (jedini kandidat s OBJE strane, isti iznos i smjer, ≤ 3 dana) ⇒ redak se
    PREMJEŠTA na izvod koji ga nosi (korak 3: Modify istog `event_id`, nikad novi + brisanje),
    a nova stavka otpada. Nejasno ⇒ odluka na oba izvoda."""
    from _zaba_spajanje import DRUGDJE_DANA

    def iznos_r(r):
        a = r['attrs']
        return abs(_num(a.get('Isplata')) - _num(a.get('Uplata')))

    def smjer_r(r):
        return 'Uplata' if _num(r['attrs'].get('Uplata')) > _num(r['attrs'].get('Isplata')) else 'Isplata'

    visak = [(s, r) for s in stanja for r in s.podaci.get('visak_r', [])]
    novi = [(s, t) for s in stanja for t in s.podaci.get('novi_t', [])]

    def par(r, t):
        return (abs(iznos_r(r) - t['iznos']) < EPS and smjer_r(r) == t['smjer']
                and abs((_d(r['event_date']) - t['date']).days) <= DRUGDJE_DANA)

    for sa, r in visak:
        kand = [(sb, t) for sb, t in novi if sb is not sa and par(r, t)]
        if not kand:
            continue
        sb, t = kand[0]
        drugi = [r2 for sx, r2 in visak if sx is not sb and r2 is not r and par(r2, t)]
        opis = (f'{r["event_date"]} {_eur(iznos_r(r))} „{r.get("comment") or ""}" '
                f'({r["attrs"].get("Izvor")}/{r["attrs"].get("Racun")})')
        if len(kand) == 1 and not drugi:
            # jasno: makni odluke o tom retku s oba izvoda, nova stavka otpada
            for s in (sa, sb):
                s.odluke = [(e, x) for e, x in s.odluke if e != r['id']]
            sb.podaci['novi_t'] = [x for x in sb.podaci['novi_t'] if x is not t]
            sb.podaci.setdefault('premjesti', []).append({'r': r, 't': t, 'iz': sa.izvod})
            sa.podaci.setdefault('odlazi', []).append({'r': r, 'u': sb.izvod})
            sb.novi -= 1
            sb.modify += 1
            sb.diraju.add(r['id'])
            sa.diraju.discard(r['id'])
            sa.napomene.append(f'{opis} pripada {sb.izvod} — premješta se (Modify u {sb.izvod})')
            sb.napomene.append(f'{opis} s {sa.izvod} je stavka ovog izvoda {t["date"]:%d.%m.} '
                           f'{(t["opis"] or "")[:30]} — premješta se, nema novog retka')
        else:
            tekst = (f'{opis} — možda je stavka {sb.izvod} {t["date"]:%d.%m.} {(t["opis"] or "")[:30]}'
                     f' (kandidata: {len(kand) + len(drugi)})')
            for s in (sa, sb):
                s.odluke.append((r['id'], tekst))
    for s in stanja:
        if s.stanje == 'gotovo' and (s.odluke or s.podaci.get('premjesti')):
            s.stanje = 'excel'


def sukobi(stanja: list[Stanje]) -> None:
    """Jedan redak baze smije mijenjati samo JEDAN izvod (KRUG_SPEC §2). Traže li ga
    dva (S161: ZABA „višak" = Visa kupnja na krivom računu), oba dobiju odluku, a
    redak ne ide ni u jedan file kao izmjena (korak 3 to poštuje preko `sukob`)."""
    tko: dict[str, list[Stanje]] = {}
    for s in stanja:
        for eid in s.diraju:
            tko.setdefault(eid, []).append(s)
    for eid, ss in tko.items():
        if len(ss) < 2:
            continue
        imena = ', '.join(x.izvod for x in ss)
        for s in ss:
            s.podaci.setdefault('sukob', set()).add(eid)
            s.odluke.append((eid, f'isti redak traže {imena} — odluči kojem pripada'))
            if s.stanje == 'gotovo':
                s.stanje = 'excel'
