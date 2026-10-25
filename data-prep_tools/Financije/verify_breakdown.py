# -*- coding: utf-8 -*-
"""
verify_breakdown.py  (S165, 2026-10-07)
================================================================================
PRIHVATNI TEST ZA `rpc_area_breakdown` (sql/056) — RPC protiv Pythona, U LIPU.

Spec: docs/RAZREZ_SPEC.md §11 (RPC), §14 (testovi), §4.3/§8.6 (očekivane brojke).

⚠ STROGO READ-ONLY.

DVIJE TVRDNJE, RAZDVOJENE NAMJERNO (obrazac `verify_rpc_vs_model.py`)
  1. RPC == Python PO GRUPI  — „radi li SQL ono što mislim"  (kodno pitanje)
     Python zbraja SIROVE retke (events + event_attributes, service ključ), sam
     primjenjuje leaf + `chain_key IS NULL`, uključive granice i datum naplate
     kao UTC dan. Svaka grupa (tip, podtip, izvorplacanja, namjena) mora se poklopiti
     u plus, minus, n i n_no_date. Razlika = kvar SQL-a (ili Pythona) — ne podataka.
  2. MODEL == očekivano      — „daje li pravilo razreza brojke koje je Saša vidio"
     Python model (strana, izvan razreza, N/A, gotovina, bucketi iz
     `set_breakdown.py`, Namjena po strani) nad RPC retcima. Na TEST-u se uspoređuje
     s `EXPECTED_12` (TEST 25.10., S183; prije: snimka 07.10. = RAZREZ §4.3); na
     PROD-u se samo ispisuje.
     ⚠ Novi retci u bazi pomiču brojke za ZADNJI mjesec — tvrdnja 1 i dalje vrijedi.

Pokretanje (PowerShell, iz data-prep_tools\\):
    Financije\\run.bat verify_breakdown.py
    $env:ET_TARGET='prod'; Financije\\run.bat verify_breakdown.py
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, str(Path(__file__).parent))
from verify_rpc_vs_model import AREA_ID, ENV_FILE, IS_PROD, Supa, load_env, target_banner  # noqa: E402
from set_breakdown import ADJUSTMENT_ROWS, WIDGET, bucket_of  # noqa: E402

# = breakdownDims(WIDGET) za Financije; S183: + `namjena` (os pogleda Namjena, 4. dimenzija)
DIMS = ['tip', 'podtip', 'izvorplacanja', 'namjena']
NEED = DIMS + ['uplata', 'isplata', 'datum_naplate']

WINDOWS = [('12 mj', '2025-10-01', '2026-09-30'), ('rujan', '2026-09-01', '2026-09-30')]
AXES = [('po kupnji', None), ('po naplati', 'datum_naplate')]

# TEST 25.10.2026. (= PROD 22.10. + S180 preuređivanje + S183 bucketi 1A), 12 mj:
# (po kupnji, po naplati). ⚠ Snimka 07.10. (RAZREZ §4.3) više ne postoji — S167 i S180
# su promijenili podatke. Unakrsno provjereno S183: Ušlo, Kvaliteta, Putovanja, Kuća i
# Kućište = mjerenje prije 1A u lipu; prirast Mjesečnih (bez gotovine) + Povremenih +
# Projekti = staro „Koka razno" + „Saša razno" (6.355,90). Namjena = zasebno mjerenje
# (scratchpad s183_namjena.py, drugi klasifikator) u lipu.
EXPECTED_12 = {
    'Ušlo': (49756.32, 49756.32),
    'Izašlo': (42461.75, 41639.04),
    'Mjesečni troškovi': (23920.54, 22817.62),
    'Kvaliteta života': (5276.48, 5243.48),
    'Putovanja i pokloni': (3698.43, 3069.93),
    'Povremeno nužno': (7026.20, 6889.86),
    'Kuća investicije': (614.44, 716.33),
    'Kućište · Nenin novac': (642.97, 642.97),
    'Projekti': (1282.69, 1339.79),
    'nerazvrstano (N/A)': (0.00, 919.06),
    'gotovina, nerazvrstano': (3830.90, 3830.90),
    'Namjena trošak: Zajedničko': (26578.15, 25009.39),
    'Namjena trošak: Koka': (6876.88, 6704.22),
    'Namjena trošak: Saša': (4532.85, 4532.50),
    'Namjena trošak: Nena / Kućište': (642.97, 642.97),
    'Namjena prihod: Saša': (16372.10, 16372.10),
    'Namjena prihod: Koka': (15984.22, 15984.22),
    'Namjena prihod: Nena / Kućište': (12000.00, 12000.00),
    'Namjena prihod: Zajedničko': (5400.00, 5400.00),
}


def c(x) -> int:
    """U lipe. Sve usporedbe su cjelobrojne — decimale nose grešku zapisa."""
    return round(float(x or 0) * 100)


def eur(cents: int) -> str:
    return f'{cents / 100:,.2f}'.replace(',', ' ')


# ── strana Python: sirovi retci ─────────────────────────────────────────────
def pull(sp: Supa):
    cats = sp.select_all(f'categories?select=id,parent_category_id&area_id=eq.{AREA_ID}&order=id')
    parents = {x['parent_category_id'] for x in cats if x['parent_category_id']}
    leaf = [x['id'] for x in cats if x['id'] not in parents]
    ids = ','.join(x['id'] for x in cats)
    defs = sp.select_all(f'attribute_definitions?select=id,slug,data_type&category_id=in.({ids})&order=id')
    slug_of = {d['id']: d['slug'] for d in defs if d['slug'] in NEED}
    events = sp.select_all(
        f'events?select=id,event_date,chain_key&category_id=in.({",".join(leaf)})&order=id')
    ev = {e['id']: {'date': e['event_date'], 'a': {}} for e in events if e['chain_key'] is None}
    rows = sp.select_all(
        'event_attributes?select=event_id,attribute_definition_id,value_text,value_number,value_datetime'
        f'&attribute_definition_id=in.({",".join(slug_of)})&order=id')
    for r in rows:
        e = ev.get(r['event_id'])
        if e is None:
            continue
        slug = slug_of[r['attribute_definition_id']]
        if slug in e['a']:
            continue    # SQL: LIMIT 1 — dvostruki atribut bi se ovdje vidio kao razlika
        if slug == 'datum_naplate':
            # zidni sat spremljen kao `…T12:00:00+00:00` ⇒ UTC dan = prvih 10 znakova
            v = r['value_datetime'][:10] if r['value_datetime'] else None
        elif slug in ('uplata', 'isplata'):
            v = r['value_number']
        else:
            v = r['value_text'] if r['value_text'] is not None else (
                None if r['value_number'] is None else str(r['value_number']))
        e['a'][slug] = v
    return ev


def python_groups(ev, axis, od, do):
    g = defaultdict(lambda: [0, 0, 0, 0])   # plus, minus, n, n_no_date
    for e in ev.values():
        d = e['date'] if axis is None else e['a'].get(axis)
        key = tuple(e['a'].get(s) for s in DIMS)
        if d is None:
            if od <= e['date'] <= do:        # zamjena: event_date u razdoblju (056 zaglavlje)
                g[key][3] += 1
            continue
        if not (od <= d <= do):
            continue
        x = g[key]
        x[0] += c(e['a'].get('uplata'))
        x[1] += c(e['a'].get('isplata'))
        x[2] += 1
    return g


def rpc_groups(sp, axis, od, do):
    rows = sp.rpc('rpc_area_breakdown', {
        'p_area_id': AREA_ID, 'p_group_slugs': DIMS, 'p_plus_slug': 'uplata',
        'p_minus_slug': 'isplata', 'p_date_slug': axis, 'p_date_from': od, 'p_date_to': do})
    if len(rows) >= 1000:
        sys.exit('✗ RPC je vratio ≥ 1000 redaka — PostgREST reže bez greške.')
    return {tuple(r['g']): [c(r['plus_sum']), c(r['minus_sum']), r['n'], r['n_no_date']] for r in rows}


# ── model (Python kopija pravila iz breakdownModel.ts) ──────────────────────
def passes(v, f):
    return (v is None or v not in f['values']) if f['op'] == 'not_in' else (v is not None and v in f['values'])


def model(rpc):
    w = WIDGET
    out = defaultdict(int)
    for key, (plus, minus, n, _) in rpc.items():
        a = dict(zip(DIMS, key))
        net = minus - plus
        if passes(a['tip'], w['income']):
            out['Ušlo'] += plus - minus
            out[f"Namjena prihod: {a['namjena']}"] += plus - minus
            continue
        if any(passes(a[f['slug']], f) for f in w['outside']):
            continue
        if a['tip'] in (None, '') or a['tip'] in w['unclassified']:
            out['nerazvrstano (N/A)'] += net
        else:
            b = bucket_of(a['tip'], a['podtip'])
            out[b or 'nesvrstano'] += net
            out[f"Namjena trošak: {a['namjena']}"] += net   # pogled Namjena: N/A je zasebna kriška
        out['Izašlo'] += net
    for adj in w['adjustments']:
        v = 0
        for key, (plus, minus, n, _) in rpc.items():
            a = dict(zip(DIMS, key))
            if all(passes(a[f['slug']], f) for f in adj['add']):
                v += minus - plus
            if all(passes(a[f['slug']], f) for f in adj['subtract']):
                v -= minus - plus
        out[adj['label']] += v
        out['Izašlo'] += v
        for b, label in ADJUSTMENT_ROWS:
            if label == adj['label']:
                out[b] += v
    return out


def main():
    print(target_banner())
    sp = Supa(load_env(ENV_FILE))
    ev = pull(sp)
    print(f'retci (leaf, bez chain_key): {len(ev)}\n')

    bad = 0
    models = {}
    for wname, od, do in WINDOWS:
        for aname, axis in AXES:
            py = python_groups(ev, axis, od, do)
            rp = rpc_groups(sp, axis, od, do)
            diff = [(k, py.get(k), rp.get(k)) for k in sorted(set(py) | set(rp), key=str)
                    if py.get(k) != rp.get(k)]
            tot = [sum(x[i] for x in rp.values()) for i in range(4)]
            mark = '✓' if not diff else '✗'
            print(f'{mark} {wname:6} {aname:10}  grupa {len(rp):3}  n {tot[2]:5}  bez datuma {tot[3]}  '
                  f'uplata {eur(tot[0]):>12}  isplata {eur(tot[1]):>12}')
            for k, a, b in diff[:15]:
                print(f'     {k}: python {a}  rpc {b}')
            bad += len(diff)
            models[(wname, aname)] = model(rp)

    print('\nMODEL (12 mj)                     po kupnji     po naplati' +
          ('' if IS_PROD else '   očekivano'))
    m1, m2 = models[('12 mj', 'po kupnji')], models[('12 mj', 'po naplati')]
    keys = list(EXPECTED_12) + [k for k in set(m1) | set(m2) if k not in EXPECTED_12]
    mbad = 0
    for k in keys:
        got = (m1.get(k, 0), m2.get(k, 0))
        line = f'  {k:28} {eur(got[0]):>13} {eur(got[1]):>14}'
        if not IS_PROD and k in EXPECTED_12:
            exp = tuple(c(x) for x in EXPECTED_12[k])
            ok = exp == got
            mbad += not ok
            line += '   ✓' if ok else f'   ✗ očekivano {eur(exp[0])} / {eur(exp[1])}'
        print(line)
    sb = sum(v for k, v in m1.items() if k not in ('Ušlo', 'Izašlo', 'gotovina, nerazvrstano')
             and not k.startswith('Namjena'))
    print(f'\n  Σ bucketa + N/A (po kupnji) = {eur(sb)}  ·  Izašlo = {eur(m1["Izašlo"])}  '
          + ('✓' if sb == m1['Izašlo'] else '✗'))
    mbad += sb != m1['Izašlo']

    print()
    if bad:
        print(f'✗ RPC i Python se razilaze u {bad} grupa.')
    else:
        print('✓ RPC = Python u lipu, sve grupe, oba razdoblja, obje osi.')
    if mbad:
        print(f'✗ Model se ne slaže s očekivanim u {mbad} stavki.')
    elif not IS_PROD:
        print('✓ Model = očekivano (TEST 25.10.) u lipu.')
    sys.exit(1 if bad or mbad else 0)


if __name__ == '__main__':
    main()
