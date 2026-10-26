# -*- coding: utf-8 -*-
"""
izvedi.py — A2: izvedi atribut iz teksta / pretvori na mjestu (PREUREDJIVANJE_SPEC §26). S185.

Računa u Pythonu (pravila u `pravila.py`), a bazi šalje GOTOVE vrijednosti kroz
`rpc_restructure_values` (`sql/059`): jedna transakcija, zapis prije/poslije,
Poništi istim `rpc_restructure_undo` kao F1.

    Tools\\run.bat Trening\\izvedi.py --area Fitness_Garmin --pravilo kcal_kj
    Tools\\run.bat Trening\\izvedi.py --area Fitness_Garmin --pravilo kcal_kj --apply
    Tools\\run.bat Trening\\izvedi.py --ponisti <op_id>

ZADANO JE SUHI PROLAZ. Baza: `ET_TARGET` (bez njega TEST) — zaglavlje [TEST]/[PROD]
čitaj PRIJE brojki (S137). PROD `--apply` pokreće Saša.

/!\\ Način `prazno` (zadano) puni samo prazan cilj; `uskladi` prepisuje gdje pravilo
    pogodi. Ni jedan ne briše (A2 nikad ne briše, §26.3).
/!\\ Pravilo `jednokratno` (pretvorba na mjestu) alat odbija ako u bazi već postoji
    neponištena operacija tog pravila nad tim atributom — drugi prolaz bi kJ → kcal
    podijelio još jednom, i to bi izgledalo kao uredna operacija.
/!\\ Poslije upisa mjeri: baza = ono što je suhi prolaz predvidio (pouka S179),
    nikad „ponovi pravilo i očekuj 0".
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'Financije'))
import _db           # noqa: E402
import pravila as P  # noqa: E402

OUT_DIR = _db.ROOT / 'data-prep_data' / '_izvedi'


def rpc(url, key, fn, body):
    req = urllib.request.Request(
        f'{url}/rest/v1/rpc/{fn}', method='POST', data=json.dumps(body).encode(),
        headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        msg = e.read().decode('utf-8', 'replace')
        try:
            msg = json.loads(msg).get('message', msg)
        except ValueError:
            pass
        sys.exit(f'✗ {fn}: {msg}')


def same(a, b) -> bool:
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return a == b


def md5(s: str | None) -> str:
    return hashlib.md5((s or '').encode('utf-8')).hexdigest()


def shape(s) -> str:
    import re
    s = re.sub(r'\d', '9', str(s)[:30])
    return re.sub(r'[^\W\d_]+', 'a', s)


def load(url, key, area, pr: P.Pravilo):
    a = _db.rest(url, key, f'areas?select=id&name=eq.{area}')
    if len(a) != 1:
        sys.exit(f'✗ Area „{area}": nađeno {len(a)}.')
    aid = a[0]['id']
    cats = _db.rest(url, key, f'categories?select=id,name&area_id=eq.{aid}')
    defs = _db.rest(url, key, f"attribute_definitions?select=id,slug,data_type,category_id&category_id=in.({','.join(c['id'] for c in cats)})")
    tgt = [d for d in defs if d['slug'] == pr.cilj]
    if len(tgt) != 1:
        sys.exit(f'✗ ciljni atribut „{pr.cilj}": nađeno {len(tgt)} u Arei.')
    tgt = tgt[0]
    if tgt['data_type'] not in ('number', 'text'):
        sys.exit(f'✗ cilj je {tgt["data_type"]} — A2 piše samo number ili text.')
    src = None
    if pr.izvor and pr.izvor != 'comment':
        s = [d for d in defs if d['slug'] == pr.izvor and d['category_id'] == tgt['category_id']]
        if len(s) != 1:
            sys.exit(f'✗ izvorni atribut „{pr.izvor}" nije na kategoriji cilja.')
        src = s[0]
    evs = _db.rest(url, key, f"events?select=id,event_date,comment&category_id=eq.{tgt['category_id']}")
    ids = [x['id'] for x in ([tgt] + ([src] if src else []))]
    vals = defaultdict(dict)
    for r in _db.rest(url, key, f"event_attributes?select=event_id,attribute_definition_id,value_text,value_number&attribute_definition_id=in.({','.join(ids)})"):
        d = tgt if r['attribute_definition_id'] == tgt['id'] else src
        v = r['value_number'] if d['data_type'] == 'number' else r['value_text']
        if r['event_id'] in vals and d['id'] in vals[r['event_id']]:
            sys.exit(f'✗ event {r["event_id"]} ima atribut {d["slug"]} dvaput — popravi prije.')
        vals[r['event_id']][d['id']] = v
    cat_name = next(c['name'] for c in cats if c['id'] == tgt['category_id'])
    return aid, tgt, src, cat_name, evs, vals


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--area')
    ap.add_argument('--pravilo', choices=sorted(P.PRAVILA))
    ap.add_argument('--nacin', choices=['prazno', 'uskladi'], default='prazno')
    ap.add_argument('--od'), ap.add_argument('--do')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--ponovno', action='store_true', help='jednokratno pravilo ipak opet (svjesno)')
    ap.add_argument('--ponisti', metavar='OP_ID')
    args = ap.parse_args()

    env = _db.target()
    url, key = _db.load_env(env)
    print(f'[{env.upper()}] {url.split("//")[1].split(".")[0]}\n')

    if args.ponisti:
        t0 = time.time()
        n = rpc(url, key, 'rpc_restructure_undo', {'p_op_id': args.ponisti})
        print(f'✓ poništeno: {n} zapisa vraćeno u {time.time() - t0:.1f} s')
        return
    if not (args.area and args.pravilo):
        ap.error('treba --area i --pravilo (ili --ponisti)')

    pr = P.PRAVILA[args.pravilo]
    nacin = 'uskladi' if pr.izvor is None else args.nacin   # pretvorba na mjestu uvijek prepisuje
    aid, tgt, src, cat, evs, vals = load(url, key, args.area, pr)
    print(f'pravilo  {pr.ime} — {pr.opis}')
    print(f'cilj     {args.area} > … > {cat} · {tgt["slug"]} ({tgt["data_type"]})')
    print(f'izvor    {pr.izvor or "(cilj sam — pretvorba na mjestu)"} · način {nacin}\n')

    if pr.jednokratno:
        done = [o for o in _db.rest(url, key, f"restructure_ops?select=id,created_at,status,plan&area_id=eq.{aid}&source=eq.izvedi:{pr.ime}")
                if o['status'] == 'applied' and (o['plan'] or {}).get('attr') == tgt['id']]
        if done and not args.ponovno:
            sys.exit(f'✗ pravilo {pr.ime} je jednokratno, a već je primijenjeno (op {done[0]["id"]}, {done[0]["created_at"][:16]}).\n'
                     f'  Drugi prolaz bi pretvorio već pretvoreno. Poništi ga (--ponisti) ili svjesno --ponovno.')

    rows, pred = [], {}
    yr = defaultdict(Counter)
    primjeri, nepog = [], Counter()
    for e in evs:
        d = e['event_date']
        if (args.od and d < args.od) or (args.do and d > args.do):
            continue
        y = d[:4]
        cur = vals.get(e['id'], {}).get(tgt['id'])
        if pr.izvor is None:
            s_val, s_txt = cur, None
        elif pr.izvor == 'comment':
            s_val = s_txt = e['comment']
        else:
            s_val = s_txt = vals.get(e['id'], {}).get(src['id'])
        if s_val in (None, ''):
            continue
        yr[y]['izvor'] += 1
        new = pr.racun(s_val)
        if new is None:
            yr[y]['nepogođeno'] += 1
            nepog[shape(s_val) if pr.privatno else str(s_val)[:40]] += 1
            continue
        yr[y]['pogođeno'] += 1
        if same(new, cur):
            yr[y]['već isto'] += 1
            continue
        if cur is not None and nacin == 'prazno':
            yr[y]['cilj pun, različit'] += 1
            continue
        yr[y]['upis'] += 1
        rows.append({'event': e['id'], 'value': new, 'expect': cur,
                     'src_md5': md5(s_txt) if pr.izvor else None})
        pred[e['id']] = new
        if len(primjeri) < 8:
            primjeri.append((d, e['id'], shape(s_val) if pr.privatno else s_val, cur, new))

    cols = ['izvor', 'pogođeno', 'nepogođeno', 'već isto', 'cilj pun, različit', 'upis']
    print('god   ' + ''.join(f'{c:>20}' for c in cols))
    tot = Counter()
    for y in sorted(yr):
        tot.update(yr[y])
        print(f'{y}  ' + ''.join(f'{yr[y][c]:>20}' for c in cols))
    print('sve   ' + ''.join(f'{tot[c]:>20}' for c in cols))
    if primjeri:
        print('\nprimjeri (datum · izvor · sada → novo):')
        for d, _, s, c, n in primjeri:
            print(f'  {d}  {s!s:>30}  {c!s:>8} → {n}')
    if nepog:
        print('\nnepogođeno (najčešće):', nepog.most_common(8))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M')
    out = OUT_DIR / f'izvedi_{pr.ime}_{env}_{stamp}.json'
    out.write_text(json.dumps({'area': args.area, 'pravilo': pr.ime, 'rows': rows}, ensure_ascii=False), encoding='utf-8')
    print(f'\npopis za upis: {out}  ({len(rows)} redaka)')

    if not args.apply:
        print('\nSUHI PROLAZ — ništa nije upisano. Za upis: --apply')
        return
    if not rows:
        print('\nNema što upisati.')
        return
    if not P.selftest():
        sys.exit('✗ samoprovjera pravila pada (pravila.py --test) — ne upisujem.')

    p_src = None if pr.izvor is None else ({'comment': True} if pr.izvor == 'comment' else {'attr': src['id']})
    t0 = time.time()
    op = rpc(url, key, 'rpc_restructure_values', {
        'p_area_id': aid, 'p_attr': tgt['id'], 'p_rows': rows, 'p_src': p_src, 'p_source': f'izvedi:{pr.ime}'})
    print(f'\n✓ upisano: op {op}  ({len(rows)} redaka, {time.time() - t0:.1f} s)')

    # ── mjerenje: baza = predviđanje ──
    _, tgt2, _, _, _, vals2 = load(url, key, args.area, pr)
    bad = [eid for eid, v in pred.items() if not same(vals2.get(eid, {}).get(tgt2['id']), v)]
    print(f'{"✓" if not bad else "✗"} provjera: {len(pred) - len(bad)}/{len(pred)} redaka = predviđanje'
          + ('' if not bad else f'  (prvih 5 ne: {bad[:5]})'))
    print(f'  poništi:  izvedi.py --ponisti {op}')


if __name__ == '__main__':
    main()
