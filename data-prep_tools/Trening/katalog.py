"""S190 korak 5 — Area `Katalog vježbi` iz `vjezbe_prijedlog.json` (samo TEST).

Katalog je ZASEBNA Area (odluka 30.10.): vježbe su podaci (zapisi), pa ih „From template"
ne bi prenio, a dijeljenje cijele `Fitness` pokazalo bi i sve treninge. Model (S190, Saša):

    Vježba (leaf, L1)   1 zapis = 1 vježba: Slug, Name, Type, Group, Secondary, Per hand, Description

Jedna kategorija, skupina je POLJE (ne kategorija po skupini) — dijeljenje ili preimenovanje
skupine je tada promjena opcije (`Restructure options`), ne premještanje zapisa.

    run.bat Trening\\katalog.py            # suhi prolaz: ispis kataloga + što bi nastalo
    run.bat Trening\\katalog.py --apply    # stvori (staje ako Area već postoji)
    run.bat Trening\\katalog.py --obrisi   # obriši Areu i sve njene zapise

Vlasnik je Sašin TEST račun (NE owner@test.com — E2E global-setup briše njegove ne-seed Aree).
Na PROD katalog ide kasnije kao app EXPORT ove Aree (Structure + Activities), uvozom — ne ovim
alatom. ⚠ Samo TEST: alat odbija `ET_TARGET=prod`.

Iz JSON-a: aliasi istog sluga nose ponekad različito ime (sa i bez „?") — uzima se ime BEZ „?"
s najviše aliasa; `Method` (IMOM, GtG, HIIT, TbyT) NIJE vježba nego način bloka (odluka 30.10.)
i ne ulazi; `nije vježba` ne ulazi.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import uuid
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'Financije'))
import _db  # noqa: E402
from proba_serije import post, delete  # noqa: E402

AREA_NAME = 'Katalog vježbi'
AREA_SLUG = 'katalog_vjezbi'
LEAF_NAME = 'Vježba'
SASA_EMAIL = 'sasasladoljev59@gmail.com'
DAY = '2026-10-31'

TYPES = ['Strength', 'Cardio', 'Mobility', 'Stretching']
GROUPS = ['Upper-push', 'Upper-pull', 'Core', 'Legs-main', 'Legs-hips', 'Legs-calves']

# (slug, name, data_type, options, required, description)
ATTRS = [
    ('slug', 'Slug', 'text', None, True,
     'Short permanent name stored in every training record (e.g. pull_m). Must be unique. '
     'Change it only with the restructure tool.'),
    ('name', 'Name', 'text', None, True, 'Full name — may be changed freely.'),
    ('type', 'Type', 'text', TYPES, True, 'Strength | Cardio | Mobility | Stretching'),
    ('group', 'Group', 'text', GROUPS, False,
     'Main muscle group — used by recovery rules (rest days per group).'),
    ('secondary', 'Secondary', 'text', GROUPS, False,
     'Second group the exercise loads a lot (e.g. erg: Upper-pull).'),
    ('per_hand', 'Per hand', 'boolean', None, False,
     'Weight is entered per hand (2 kg = one 2 kg dumbbell in each hand).'),
    ('description', 'Description', 'text', None, False, 'How to do it, machine settings, notes.'),
]


def load_catalog() -> list[dict]:
    raw = json.loads((HERE / 'vjezbe_prijedlog.json').read_text(encoding='utf-8'))
    variants: dict[str, Counter] = defaultdict(Counter)
    meta: dict[str, set] = defaultdict(set)
    for k, v in raw.items():
        if k.startswith('_') or not isinstance(v, dict) or not v.get('slug'):
            continue
        if v.get('vrsta') in ('nije vježba', 'Method'):
            continue
        variants[v['slug']][v['ime']] += 1
        meta[v['slug']].add((v['vrsta'], v['skupina'], v.get('sporedna', '')))
    out = []
    for slug, names in variants.items():
        if len(meta[slug]) != 1:
            sys.exit(f'✗ {slug}: aliasi se ne slažu u vrsti/skupini {sorted(meta[slug])} — odluči u JSON-u.')
        clean = [(n, c) for n, c in names.items() if '?' not in n and '⚠' not in n]
        pick = max(clean or names.items(), key=lambda x: (x[1], -len(x[0])))[0]
        vrsta, skupina, sporedna = next(iter(meta[slug]))
        if vrsta not in TYPES or (skupina and skupina not in GROUPS) or (sporedna and sporedna not in GROUPS):
            sys.exit(f'✗ {slug}: nepoznata vrsta/skupina ({vrsta}, {skupina}, {sporedna}).')
        out.append({'slug': slug, 'name': pick, 'type': vrsta, 'group': skupina,
                    'secondary': sporedna, 'unsure': not clean})
    # redoslijed liste: po skupini pa imenu (lista je silazna po vremenu ⇒ prvi dobije zadnju minutu)
    order = {g: i for i, g in enumerate(GROUPS + [''])}
    out.sort(key=lambda r: (order[r['group']], TYPES.index(r['type']), r['name'].lower()))
    return out


def build(owner_id: str, catalog: list[dict]) -> dict:
    area_id, leaf_id = str(uuid.uuid4()), str(uuid.uuid4())
    defs, attr_rows = {}, []
    for i, (slug, name, dt, opts, req, desc) in enumerate(ATTRS, 1):
        did = str(uuid.uuid4())
        defs[slug] = (did, dt)
        attr_rows.append({'id': did, 'user_id': owner_id, 'category_id': leaf_id, 'name': name,
                          'slug': slug, 'data_type': dt, 'is_required': req, 'sort_order': i,
                          'description': desc,
                          'validation_rules': {'type': 'suggest', 'suggest': opts} if opts else {}})
    events, values = [], []
    n = len(catalog)
    for i, r in enumerate(catalog):
        minute = n - 1 - i                       # prvi u popisu = najnovija minuta = vrh liste
        start = f'{DAY}T{8 + minute // 60:02d}:{minute % 60:02d}:00+00:00'
        eid = str(uuid.uuid4())
        events.append({'id': eid, 'user_id': owner_id, 'category_id': leaf_id, 'event_date': DAY,
                       'session_start': start, 'chain_key': None, 'comment': None})
        for slug in ('slug', 'name', 'type', 'group', 'secondary'):
            if r[slug]:
                did, _ = defs[slug]
                values.append({'id': str(uuid.uuid4()), 'event_id': eid, 'attribute_definition_id': did,
                               'user_id': owner_id, 'value_text': r[slug]})
    settings = {
        'disable_save_plus': True,          # Save + bi stavio dvije vježbe u isti redak liste
        'add_header': {'timer': False, 'date': False},
        'list_columns': {'columns': [
            {'role': 'attr', 'label': 'Slug', 'slugs': ['slug'], 'mobile': 'line1', 'width': 'w-32'},
            {'role': 'attr', 'label': 'Name', 'slugs': ['name']},
            {'role': 'attr', 'label': 'Group', 'slugs': ['group', 'secondary'], 'sep': ' + '},
            {'role': 'attr', 'label': 'Type', 'slugs': ['type'], 'mobile': 'hide'},
            {'role': 'actions'}]},
    }
    area = {'id': area_id, 'user_id': owner_id, 'name': AREA_NAME, 'slug': AREA_SLUG,
            'sort_order': 60, 'settings': settings,
            'description': 'Exercise catalog — one record per exercise; training records store its Slug.'}
    leaf = {'id': leaf_id, 'user_id': owner_id, 'area_id': area_id, 'parent_category_id': None,
            'name': LEAF_NAME, 'slug': 'vjezba', 'level': 1, 'sort_order': 1}
    return {'area': area, 'leaf': leaf, 'attrs': attr_rows, 'events': events, 'values': values}


def main():
    if _db.target() != 'test':
        sys.exit('✗ Ovaj alat ide SAMO na TEST (ET_TARGET=prod odbijen) — PROD dobiva app export/uvoz.')
    catalog = load_catalog()
    for r in catalog:
        sec = f" + {r['secondary']}" if r['secondary'] else ''
        print(f"  {r['slug']:16} {r['type']:10} {(r['group'] or '—') + sec:24} {r['name']}"
              f"{'   ⚠ ime nesigurno' if r['unsure'] else ''}")
    dup = [s for s, c in Counter(r['slug'] for r in catalog).items() if c > 1]
    if dup:
        sys.exit(f'✗ dvostruki slug: {dup}')
    print(f'vježbi {len(catalog)} · po vrsti {dict(Counter(r["type"] for r in catalog))}')

    url, key = _db.load_env('test')
    print(f'[TEST] {url}')
    existing = _db.rest(url, key, f'areas?select=id&name=eq.{urllib.parse.quote(AREA_NAME)}')
    if '--obrisi' in sys.argv:
        if not existing:
            sys.exit('Nema Aree — ništa za obrisati.')
        aid = existing[0]['id']
        cats = _db.rest(url, key, f'categories?select=id&area_id=eq.{aid}')
        cids = ','.join(c['id'] for c in cats)
        evs = _db.rest(url, key, f'events?select=id&category_id=in.({cids})&order=id')
        n_attr = n_ev = 0
        for i in range(0, len(evs), 150):
            ids = ','.join(e['id'] for e in evs[i:i + 150])
            n_attr += delete(url, key, 'event_attributes', f'event_id=in.({ids})')
            n_ev += delete(url, key, 'events', f'id=in.({ids})')
        delete(url, key, 'data_shares', f'target_id=eq.{aid}')
        delete(url, key, 'attribute_definitions', f'category_id=in.({cids})')
        delete(url, key, 'categories', f'area_id=eq.{aid}')
        delete(url, key, 'areas', f'id=eq.{aid}')
        print(f'✓ obrisano: {n_ev} zapisa, {n_attr} vrijednosti, Area {aid}')
        return
    sasa = _db.rest(url, key, f'profiles?select=id&email=eq.{SASA_EMAIL}')
    if not sasa:
        sys.exit(f'✗ {SASA_EMAIL} nema profil na TEST-u.')
    b = build(sasa[0]['id'], catalog)
    print(f'nastalo bi: Area 1 · kategorija 1 · atributa {len(b["attrs"])} · zapisa {len(b["events"])} · '
          f'vrijednosti {len(b["values"])}')
    if '--apply' not in sys.argv:
        print('(suhi prolaz — --apply stvara)')
        return
    if existing:
        sys.exit(f'✗ Area „{AREA_NAME}" već postoji ({existing[0]["id"]}) — prvo --obrisi.')
    post(url, key, 'areas', [b['area']])
    post(url, key, 'categories', [b['leaf']])
    post(url, key, 'attribute_definitions', b['attrs'])
    post(url, key, 'events', b['events'])
    post(url, key, 'event_attributes', b['values'])
    # mjeri u bazi, ne vjeruj brojaču
    got_ev = _db.rest(url, key, f'events?select=id&category_id=eq.{b["leaf"]["id"]}&order=id')
    ids = ','.join(e['id'] for e in got_ev)
    got_val = _db.rest(url, key, f'event_attributes?select=id&event_id=in.({ids})&order=id')
    ok = len(got_ev) == len(b['events']) and len(got_val) == len(b['values'])
    print(f'{"✓" if ok else "✗"} Area {b["area"]["id"]} · zapisa u bazi {len(got_ev)} (očekivano '
          f'{len(b["events"])}) · vrijednosti {len(got_val)} (očekivano {len(b["values"])})')


if __name__ == '__main__':
    main()
