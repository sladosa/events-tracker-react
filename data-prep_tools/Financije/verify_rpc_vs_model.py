# -*- coding: utf-8 -*-
"""
verify_rpc_vs_model.py  (S107z Faza 1, 2026-08-15)
================================================================================
PRIHVATNI TEST ZA `rpc_area_group_agg` — prije ijednog reda UI koda.

Spec: docs/OVERVIEW_TAB_SPEC.md §2.4 (RPC), §2.10 (saldo miče Izvor, ne Racun),
§2.17 (sidro). Model je već dokazan protiv banke u Fazi 1a — v.
SALDO_MODEL_NALAZI.md (17/30 mjeseci u cent, naivni zbroj 0/30).

⚠ STROGO READ-ONLY. Ništa se ne piše — ni u Review, ni u bazu.

--------------------------------------------------------------------------------
TRI STRANE, DVIJE RAZLIČITE TVRDNJE

  A) REVIEW   — verify_saldo_model.py model nad Excelom, sužen na prozor koji
                baza uopće pokriva
  B) BAZA     — isti retci povučeni iz Supabasea i zbrojeni u Pythonu
  C) RPC      — `rpc_area_group_agg` nad istom bazom

  A vs B  odgovara na „je li uvoz vjeran Excelu"        (podatkovno pitanje)
  B vs C  odgovara na „radi li SQL ono što sam mislio"  (kodno pitanje)

  Razdvojena su namjerno. Ako se A i B razilaze, to NIJE greška RPC-a i ne smije
  se ispraviti u SQL-u — to je rupa u uvozu. (Prvi run je tako našao 45 eventa u
  svibnju 2025. bez ijednog atributa.)

--------------------------------------------------------------------------------
Pokretanje:
    Financije\\run.bat verify_rpc_vs_model.py
    Financije\\run.bat verify_rpc_vs_model.py --rows      (detalj nesparenih redaka)

⚠ run.bat guši zarez u argumentima — jedan argument po pozivu.

Ključevi se čitaju iz `.env.local` (TEST projekt): SUPABASE_URL +
SUPABASE_SERVICE_ROLE_KEY. Servisni ključ zaobilazi RLS — zato je ovo alat koji
se pokreće lokalno, nikad iz preglednika.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

from verify_saldo_model import IZVOR_IZVRSENO, load_review, pick_file

sys.stdout.reconfigure(encoding='utf-8')

REPO = Path(r"C:\0_Sasa\events-tracker-react")
ENV_FILE = REPO / '.env.local'

AREA_ID = '98dd91f3-de77-4619-9d08-d1ade604640a'      # Financije_all (TEST)
GROUP_SLUG, PLUS_SLUG, MINUS_SLUG = 'racun', 'uplata', 'isplata'

# §2.10 + §2.13: izvršeno = novac se već pomaknuo. Dva uvjeta, ne jedan —
# zato p_filters prima LISTU (odstupanje od skice §2.4, obrazloženo u 035).
FILTERS_IZVRSENO = [
    {'slug': 'izvorplacanja', 'op': 'in',     'values': ['Racun', 'Cash']},
    {'slug': 'status',        'op': 'not_in', 'values': ['Planiran']},
]

EPS = 0.005
SEP = '─' * 78


# ---------------------------------------------------------------- helpers --
def eur(x) -> str:
    return f'{x:,.2f}'.replace(',', ' ')


def kol(x, w=13) -> str:
    return eur(x).rjust(w)


def load_env(path: Path) -> dict:
    out = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$', line)
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"\'')
    return out


class Supa:
    """Minimalan PostgREST klijent. Bez vanjskih ovisnosti (urllib iz stdliba)."""

    PAGE = 1000     # ⚠ PostgREST max-rows reže BEZ GREŠKE — sve mora paginirati

    def __init__(self, env: dict):
        self.base = (env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')).rstrip('/')
        self.key = env.get('SUPABASE_SERVICE_ROLE_KEY')
        if not self.key:
            sys.exit(f'✗ SUPABASE_SERVICE_ROLE_KEY nije u {ENV_FILE}')

    def _call(self, path, *, method='GET', body=None, extra=None):
        req = urllib.request.Request(f'{self.base}/rest/v1/{path}', method=method)
        req.add_header('apikey', self.key)
        req.add_header('Authorization', f'Bearer {self.key}')
        req.add_header('Content-Type', 'application/json')
        for k, v in (extra or {}).items():
            req.add_header(k, v)
        data = json.dumps(body).encode() if body is not None else None
        try:
            with urllib.request.urlopen(req, data, timeout=60) as r:
                raw = r.read().decode()
        except urllib.error.HTTPError as e:
            sys.exit(f'✗ {method} {path} → {e.code}\n{e.read().decode()[:600]}')
        return json.loads(raw) if raw else None

    def select_all(self, path):
        """
        ⚠ POZIVATELJ MORA ZADATI `order=` PO JEDINSTVENOM KLJUČU.

        Range-paginacija bez stabilnog sortiranja je tiho pogrešna: Postgres ne
        jamči isti redoslijed između dva upita, pa se retci između stranica
        preklope i istovremeno preskoče. Rezultat izgleda uredno — samo mu fali
        dio redaka, svaki put drugi. Ovaj alat je na tome pao (v. docstring
        gore); zato je provjera ovdje, a ne u komentaru.
        """
        if 'order=' not in path:
            raise AssertionError(f'select_all bez `order=`: {path}')
        out, frm = [], 0
        while True:
            page = self._call(path, extra={'Range-Unit': 'items',
                                           'Range': f'{frm}-{frm + self.PAGE - 1}'})
            out.extend(page)
            if len(page) < self.PAGE:
                return out
            frm += self.PAGE

    def rpc(self, name, args):
        return self._call(f'rpc/{name}', method='POST', body=args)


# ------------------------------------------------------------- strana B --
def pull_db(sp: Supa):
    """Sirovi retci iz baze, pivotirani u isti oblik kakav ima Review."""
    cats = sp.select_all(f'categories?select=id,slug&area_id=eq.{AREA_ID}&order=id')
    cat_ids = ','.join(c['id'] for c in cats)
    defs = sp.select_all(
        f'attribute_definitions?select=id,slug,data_type&category_id=in.({cat_ids})&order=id')
    by_id = {d['id']: d for d in defs}

    events = sp.select_all(
        f'events?select=id,event_date,comment,chain_key&category_id=in.({cat_ids})&order=id')
    rows = {e['id']: {'id': e['id'], 'date': date.fromisoformat(e['event_date']),
                      'comment': e['comment'] or '', 'chain_key': e['chain_key'],
                      'a': {}} for e in events}

    # in.(…) s 2000+ UUID-a probije duljinu URL-a ⇒ u komadima
    ids = list(rows)
    for i in range(0, len(ids), 200):
        chunk = ','.join(ids[i:i + 200])
        for r in sp.select_all(
                'event_attributes?select=event_id,attribute_definition_id,'
                f'value_text,value_number,value_datetime,value_boolean&event_id=in.({chunk})'
                '&order=event_id,attribute_definition_id,id'):
            d = by_id.get(r['attribute_definition_id'])
            if not d:
                continue
            v = (r['value_number'] if d['data_type'] == 'number'
                 else r['value_datetime'] if d['data_type'] == 'datetime'
                 else r['value_boolean'] if d['data_type'] == 'boolean'
                 else r['value_text'])
            rows[r['event_id']]['a'][d['slug']] = v

    for r in rows.values():
        upl = r['a'].get(PLUS_SLUG)
        isp = r['a'].get(MINUS_SLUG)
        r['racun'] = r['a'].get(GROUP_SLUG)
        r['izvor'] = r['a'].get('izvorplacanja')
        r['status'] = r['a'].get('status')
        r['uplata'], r['isplata'] = upl, isp
        r['signed'] = round((upl or 0.0) - (isp or 0.0), 2)
    return list(rows.values()), cats, defs


def izvrseno_db(r) -> bool:
    """Isti predikat koji SQL gradi iz FILTERS_IZVRSENO."""
    return r['izvor'] in IZVOR_IZVRSENO and r['status'] != 'Planiran'


def izvrseno_xl(r) -> bool:
    return r['izvor'] in IZVOR_IZVRSENO and r['status'] != 'Planiran'


def zbroj(rows, key_fn, pick):
    agg = defaultdict(lambda: {'uplata': 0.0, 'isplata': 0.0, 'n': 0})
    for r in rows:
        if not pick(r):
            continue
        a = agg[key_fn(r)]
        a['uplata'] += r['uplata'] or 0.0
        a['isplata'] += r['isplata'] or 0.0
        a['n'] += 1
    for a in agg.values():
        a['uplata'] = round(a['uplata'], 2)
        a['isplata'] = round(a['isplata'], 2)
        a['saldo'] = round(a['uplata'] - a['isplata'], 2)
    return agg


def tablica(naslov, agg):
    print(f'\n{naslov}')
    print(f'   {"grupa":<22}{"uplata":>15}{"isplata":>15}{"saldo":>15}{"n":>7}')
    tot = {'uplata': 0.0, 'isplata': 0.0, 'n': 0}
    for k in sorted(agg, key=lambda x: (x is None, x)):
        a = agg[k]
        print(f'   {str(k):<22}{kol(a["uplata"], 15)}{kol(a["isplata"], 15)}'
              f'{kol(a["saldo"], 15)}{a["n"]:>7}')
        for f in ('uplata', 'isplata', 'n'):
            tot[f] += a[f]
    print(f'   {"Σ":<22}{kol(round(tot["uplata"], 2), 15)}{kol(round(tot["isplata"], 2), 15)}'
          f'{kol(round(tot["uplata"] - tot["isplata"], 2), 15)}{tot["n"]:>7}')


def usporedi(naziv_l, agg_l, naziv_d, agg_d) -> bool:
    """Vrati True ako se poklapaju u cent po svakoj grupi."""
    print(f'\n{naziv_l}  vs  {naziv_d}')
    print(f'   {"grupa":<22}{"Δ uplata":>13}{"Δ isplata":>13}{"Δ saldo":>13}{"Δ n":>7}   ')
    ok = True
    for k in sorted(set(agg_l) | set(agg_d), key=lambda x: (x is None, x)):
        l = agg_l.get(k, {'uplata': 0, 'isplata': 0, 'saldo': 0, 'n': 0})
        d = agg_d.get(k, {'uplata': 0, 'isplata': 0, 'saldo': 0, 'n': 0})
        du = round(l['uplata'] - d['uplata'], 2)
        di = round(l['isplata'] - d['isplata'], 2)
        ds = round(l['saldo'] - d['saldo'], 2)
        dn = l['n'] - d['n']
        good = abs(du) < EPS and abs(di) < EPS and dn == 0
        ok &= good
        print(f'   {str(k):<22}{kol(du, 13)}{kol(di, 13)}{kol(ds, 13)}{dn:>7}'
              f'   {"✔" if good else "← RAZLIKA"}')
    print(f'   ⇒ {"POKLAPA SE U CENT" if ok else "NE POKLAPA SE"}')
    return ok


# ---------------------------------------------------------------- main --
def main():
    args = sys.argv[1:]
    show_rows = '--rows' in args

    print(SEP)
    print('PRIHVATNI TEST — rpc_area_group_agg vs verify_saldo_model')
    print(SEP)

    env = load_env(ENV_FILE)
    sp = Supa(env)
    print(f'Baza  : {sp.base}   [READ-ONLY]')

    db, cats, defs = pull_db(sp)
    print(f'Aree  : Financije_all {AREA_ID}')
    print(f'Baza  : {len(cats)} kategorija, {len(defs)} definicija atributa, '
          f'{len(db)} eventa')

    parents = [r for r in db if r['chain_key']]
    print(f'        parent eventa (chain_key ≠ NULL): {len(parents)}   '
          f'⇒ P2 pravilo {"ISKLJUČUJE ih" if parents else "nema što isključiti (L1 leaf)"}')

    prozor_od = min(r['date'] for r in db)
    prozor_do = max(r['date'] for r in db)
    print(f'Prozor: {prozor_od} .. {prozor_do}  (uzet IZ BAZE, ne fiksiran — '
          f'sam se pomiče kad uđe novi batch)')

    xl_path = pick_file([a for a in args if not a.startswith('--')])
    xl_all, _ = load_review(xl_path)
    xl = [r for r in xl_all if prozor_od <= r['date'] <= prozor_do]
    print(f'Review: {xl_path.name} — {len(xl_all)} redaka, '
          f'{len(xl)} u prozoru')

    # ---- A / B / C -------------------------------------------------------
    key = lambda r: r['racun'] or None                       # noqa: E731
    a_agg = zbroj(xl, key, izvrseno_xl)
    b_agg = zbroj(db, key, izvrseno_db)

    rpc = sp.rpc('rpc_area_group_agg', {
        'p_area_id': AREA_ID,
        'p_group_slug': GROUP_SLUG,
        'p_plus_slug': PLUS_SLUG,
        'p_minus_slug': MINUS_SLUG,
        'p_filters': FILTERS_IZVRSENO,
    })
    c_agg = {r['group_value']: {'uplata': round(float(r['plus_sum']), 2),
                                'isplata': round(float(r['minus_sum']), 2),
                                'saldo': round(float(r['plus_sum']) - float(r['minus_sum']), 2),
                                'n': r['n']} for r in rpc}

    print()
    print(SEP)
    print('IZVRŠENO — Izvor ∈ {Racun, Cash} ∧ Status ≠ Planiran   (§2.10)')
    print(SEP)
    tablica('A) REVIEW  (Python model, prozor baze)', a_agg)
    tablica('B) BAZA    (sirovi retci, isti predikat)', b_agg)
    tablica('C) RPC     (rpc_area_group_agg)', c_agg)

    ok_bc = usporedi('C) RPC', c_agg, 'B) BAZA', b_agg)
    ok_ab = usporedi('A) REVIEW', a_agg, 'B) BAZA', b_agg)

    # ---- kontrast: naivni zbroj po Racunu (§2.10) -------------------------
    naive = zbroj(db, key, lambda r: r['status'] != 'Planiran')
    tablica('KONTROLA — naivni zbroj po `Racun`u (pločica koja NE poštuje §2.10)', naive)
    print('   ⇒ toliko bi promašila pločica bez pravila `Izvor` — '
          'v. SALDO_MODEL_NALAZI.md §2.1 (0/30 mjeseci).')

    # ---- sidro: strogo nakon (§2.17) -------------------------------------
    sidro_dan = prozor_do.replace(day=1)
    rpc_od = sp.rpc('rpc_area_group_agg', {
        'p_area_id': AREA_ID, 'p_group_slug': GROUP_SLUG,
        'p_plus_slug': PLUS_SLUG, 'p_minus_slug': MINUS_SLUG,
        'p_filters': FILTERS_IZVRSENO, 'p_from': sidro_dan.isoformat(),
    })
    d_rpc = {r['group_value']: {'uplata': round(float(r['plus_sum']), 2),
                               'isplata': round(float(r['minus_sum']), 2),
                               'saldo': round(float(r['plus_sum']) - float(r['minus_sum']), 2),
                               'n': r['n']} for r in rpc_od}
    d_py = zbroj([r for r in db if r['date'] > sidro_dan], key, izvrseno_db)
    print()
    print(SEP)
    print(f'SIDRO (§2.17) — STROGO nakon {sidro_dan}')
    print(SEP)
    print('   Retci NA sam datum potvrde ne smiju ući — to je isti razred '
          'dvostrukog\n   brojanja kao `Racun` vs `Izvor`.')
    tablica('C) RPC  p_from', d_rpc)
    ok_anchor = usporedi('C) RPC p_from', d_rpc, 'B) BAZA date > sidro', d_py)

    # ---- A vs B: koji retci nedostaju ------------------------------------
    print()
    print(SEP)
    print('A vs B — sparivanje redaka (rupe u uvozu, NE greška RPC-a)')
    print(SEP)
    mult_xl = Counter((r['date'], r['racun'], r['signed']) for r in xl)
    mult_db = Counter((r['date'], r['racun'], r['signed']) for r in db)
    samo_xl = mult_xl - mult_db
    samo_db = mult_db - mult_xl
    print(f'   u Reviewu a ne u bazi : {sum(samo_xl.values()):>5} redaka   '
          f'Σ |iznos| {eur(round(sum(abs(k[2]) * n for k, n in samo_xl.items()), 2))}')
    print(f'   u bazi a ne u Reviewu : {sum(samo_db.values()):>5} redaka   '
          f'Σ |iznos| {eur(round(sum(abs(k[2]) * n for k, n in samo_db.items()), 2))}')

    prazni = [r for r in db if not r['a']]
    if prazni:
        po_mj = Counter(r['date'].strftime('%Y-%m') for r in prazni)
        print(f'   ⚠ {len(prazni)} eventa u bazi BEZ IJEDNOG ATRIBUTA '
              f'(samo comment): {dict(sorted(po_mj.items()))}')
        print('     Saldo ne kvare (nemaju iznos) — ali su transakcije koje su '
              'izgubile podatke.')

    if show_rows:
        print('\n   Detalj (prvih 20 po strani):')
        for k, n in list(samo_xl.items())[:20]:
            print(f'      REVIEW-ONLY {k[0]} {str(k[1]):<20} {k[2]:>+10.2f} ×{n}')
        for k, n in list(samo_db.items())[:20]:
            print(f'      BAZA-ONLY   {k[0]} {str(k[1]):<20} {k[2]:>+10.2f} ×{n}')

    # ---- presuda ---------------------------------------------------------
    print()
    print(SEP)
    print('PRESUDA')
    print(SEP)
    print(f'  B vs C  (radi li SQL ono što treba)   : '
          f'{"✅ PROLAZ" if ok_bc and ok_anchor else "❌ PAD"}')
    print(f'  A vs B  (je li uvoz vjeran Excelu)    : '
          f'{"✅ poklapa se" if ok_ab else "⚠ razlikuje se — podatkovni posao, ne SQL"}')
    print()
    print('  Kriterij za Fazu 1 je B vs C. A vs B je informacija o stanju uvoza:')
    print('  razlika tamo se popravlja uvozom, NIKAD ugađanjem SQL-a.')
    print(SEP)
    return 0 if (ok_bc and ok_anchor) else 1


if __name__ == '__main__':
    sys.exit(main())
