"""Kopija `Financije_all` PROD → TEST (S157). PROD se samo ČITA.

  Toolsun.bat Tools\prod_to_test.py            dry run: što bi se dogodilo
  Toolsun.bat Tools\prod_to_test.py --apply    zamijeni TEST-ove evente, atribute i sidra Aree

Što se prenosi:
  • svi eventi Aree + njihovi atributi (event ID-evi ostaju PROD-ovi ⇒ lako uspoređivanje)
  • sva sidra Aree (`balance_anchors`)
  • `validation_rules` atributa po slugu (dropdowni moraju odgovarati podacima)
Što NE: `areas.settings` (TEST nosi config trake koji PROD možda još nema), presetovi, prilozi.

Autorstvo (Sašina odluka S157, „a"): SVI retci idu pod vlasnika TEST Aree.
  ⚠ Posljedica: `useActivities` grupira po user+kategorija+session_start, pa dva retka
    različitih PROD autora iste minute postanu JEDAN redak liste. Takvi se pomaknu na
    prvu slobodnu minutu (ispisuje se koliko).

⚠ Prije --apply: `Tools\\run.bat Tools\\backup_db.py --env test --no-files`.
"""
import json, sys, urllib.request
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]   # data-prep_tools/Tools/ -> repo
APPLY = '--apply' in sys.argv


def client(envfile, expect_ref):
    env = {}
    for line in (ROOT / envfile).read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')
    U, K = env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']
    if expect_ref not in U:
        sys.exit(f'STOP: {envfile} gađa {U}, očekivano {expect_ref}.')

    def call(method, path, body=None, prefer=None):
        h = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'}
        if prefer:
            h['Prefer'] = prefer
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(U + '/rest/v1/' + path, data=data, headers=h, method=method)
        with urllib.request.urlopen(r, timeout=120) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else None
    return call


PROD = client('.env.prod.local', 'zdojdazosfoajwnuafgx')
TEST = client('.env.local', 'xtnbhmojmffjelsqejpw')


def paged(call, path):
    """Sve retke, stranicama po 1000, uz `order=id` (S108: bez reda se preklapaju)."""
    out, off = [], 0
    while True:
        page = call('GET', f'{path}&order=id&limit=1000&offset={off}')
        out += page
        if len(page) < 1000:
            return out
        off += 1000


def area_data(call):
    a = call('GET', 'areas?select=id,user_id&name=eq.Financije_all')[0]
    defs = call('GET', f"attribute_definitions?select=id,slug,category_id,validation_rules,categories!inner(area_id)"
                       f"&categories.area_id=eq.{a['id']}&order=id")
    evs = paged(call, f"events?select=*,categories!events_category_id_fkey!inner(area_id)&categories.area_id=eq.{a['id']}")
    for e in evs:
        e.pop('categories', None)
    return a, defs, evs


def attrs_of(call, ids):
    out = []
    for i in range(0, len(ids), 60):
        out += paged(call, f"event_attributes?select=*&event_id=in.({','.join(ids[i:i + 60])})")
    return out


print('Čitam PROD …')
p_area, p_defs, p_evs = area_data(PROD)
p_attrs = attrs_of(PROD, [e['id'] for e in p_evs])
p_anchors = PROD('GET', f"balance_anchors?select=*&area_id=eq.{p_area['id']}&order=id")
print('Čitam TEST …')
t_area, t_defs, t_evs = area_data(TEST)
t_anchors = TEST('GET', f"balance_anchors?select=*&area_id=eq.{t_area['id']}&order=id")

p_slug = {d['id']: d['slug'] for d in p_defs}
t_by_slug = {d['slug']: d for d in t_defs}
missing = sorted(set(p_slug.values()) - set(t_by_slug))
if missing:
    sys.exit(f'STOP: TEST nema atribute {missing} — struktura se razišla, kopija bi tiho izgubila vrijednosti.')
leafs = {d['category_id'] for d in t_defs}
if len(leafs) != 1:
    sys.exit(f'STOP: TEST Area ima {len(leafs)} kategorija s atributima — alat zna samo jedan leaf.')
T_LEAF, OWNER = leafs.pop(), t_area['user_id']
if any(e['chain_key'] for e in p_evs):
    sys.exit('STOP: PROD ima P2 roditeljske evente u Arei — alat ih ne zna prenijeti.')

# Autorstvo → jedan korisnik; razriješi sudare minute
taken, moved, new_evs = set(), 0, []
for e in sorted(p_evs, key=lambda e: (e['session_start'], e['id'])):
    ss = datetime.fromisoformat(e['session_start'])
    if ss in taken:
        moved += 1
    while ss in taken:
        ss += timedelta(minutes=1)
    taken.add(ss)
    new_evs.append({**e, 'category_id': T_LEAF, 'user_id': OWNER,
                    'edited_by': OWNER if e['edited_by'] else None, 'session_start': ss.isoformat()})
new_attrs = [{k: v for k, v in a.items() if k != 'id'} | {
    'attribute_definition_id': t_by_slug[p_slug[a['attribute_definition_id']]]['id'], 'user_id': OWNER}
    for a in p_attrs]
new_anchors = [{k: v for k, v in x.items() if k != 'id'} | {'area_id': t_area['id'], 'created_by': OWNER}
               for x in p_anchors]
rules_changed = [s for s, d in t_by_slug.items()
                 if s in {p_slug[i] for i in p_slug} and json.dumps(d['validation_rules'], sort_keys=True)
                 != json.dumps(next(x['validation_rules'] for x in p_defs if x['slug'] == s), sort_keys=True)]

print(f"\nPROD: {len(p_evs)} eventa, {len(p_attrs)} atributa, {len(p_anchors)} sidara, "
      f"autori {dict(Counter(e['user_id'][:8] for e in p_evs))}")
print(f"TEST: {len(t_evs)} eventa, {len(t_anchors)} sidara  ⇒  bit će ZAMIJENJENO")
print(f"Pomaknuto na slobodnu minutu (sudar nakon spajanja autora): {moved}")
print(f"validation_rules koji se mijenjaju: {rules_changed or 'nijedan'}")
if not APPLY:
    sys.exit('\nDry run. Za upis: --apply')

print('\nBrišem TEST …')
t_ids = [e['id'] for e in t_evs]
for i in range(0, len(t_ids), 60):
    ch = ','.join(t_ids[i:i + 60])
    TEST('DELETE', f'event_attributes?event_id=in.({ch})')
    got = TEST('DELETE', f'events?id=in.({ch})', prefer='return=representation')
    if len(got) != len(t_ids[i:i + 60]):
        sys.exit(f'STOP: obrisano {len(got)} od {len(t_ids[i:i + 60])}.')
for x in t_anchors:
    TEST('DELETE', f"balance_anchors?id=eq.{x['id']}")
print('Upisujem …')
for i in range(0, len(new_evs), 500):
    TEST('POST', 'events', new_evs[i:i + 500])
for i in range(0, len(new_attrs), 1000):
    TEST('POST', 'event_attributes', new_attrs[i:i + 1000])
if new_anchors:
    TEST('POST', 'balance_anchors', new_anchors)
for s in rules_changed:
    pr = next(x['validation_rules'] for x in p_defs if x['slug'] == s)
    TEST('PATCH', f"attribute_definitions?id=eq.{t_by_slug[s]['id']}", {'validation_rules': pr})

# Provjera: broj u bazi, ne broj poslanih
_, _, chk = area_data(TEST)
n_attr = len(attrs_of(TEST, [e['id'] for e in chk]))
n_anc = len(TEST('GET', f"balance_anchors?select=id&area_id=eq.{t_area['id']}"))
ok = len(chk) == len(p_evs) and n_attr == len(p_attrs) and n_anc == len(p_anchors)
print(f"TEST sada: {len(chk)} eventa, {n_attr} atributa, {n_anc} sidara  {'✓ = PROD' if ok else '✗ NE ODGOVARA PROD-u'}")
