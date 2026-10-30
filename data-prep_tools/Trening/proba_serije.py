"""S189 korak 4 — PROBNA Area za mjerenje formata „jedan zapis = jedna serija" (samo TEST).

Stvara Areu `S189 serije proba` pod E2E vlasnikom (owner@test.com, da je Playwright može
voziti) i dijeli je Saši (read) da je može pogledati. Model je prijedlog koraka 4:

    Activity1          1 event po treningu: rutina, s_kim
    └── Gym (leaf)     1 event po SERIJI jedne vježbe: vjezba (slug iz kataloga), blok,
                       serija, red, kg, ponavljanja, trajanje (s), intenzitet, zagrijavanje,
                       metoda + rpe (samo na prvom zapisu bloka)

Podaci su izmišljeni, ali po obrascu DIARY-ja: zagrijavanje + 2–3 bloka po 2–4 vježbe ×
2–4 serije; IMOM (svaka minuta serija); intervali na kardiju (svaki interval serija).
Dva ekstremna treninga (120 i 220 serija) mjere granicu 1000 redaka u View-u.

    run.bat Trening\\proba_serije.py            # suhi prolaz: koliko bi nastalo
    run.bat Trening\\proba_serije.py --apply    # stvori (staje ako Area već postoji)
    run.bat Trening\\proba_serije.py --obrisi   # obriši Areu i sve njene zapise

⚠ Samo TEST: alat odbija `ET_TARGET=prod`. Podaci nisu Sašini treninzi — Area se briše
kad mjerenje završi (korak 4 je odluka o formatu, ne uvoz).
"""
from __future__ import annotations

import json
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'Financije'))
import _db  # noqa: E402

AREA_NAME = 'S189 serije proba'
OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861'   # owner@test.com (E2E)
SASA_EMAIL = 'sasasladoljev59@gmail.com'
N_TRAININGS = 400
SEED = 189

CATALOG = json.loads((HERE / 'vjezbe_prijedlog.json').read_text(encoding='utf-8'))


def slugs_by(vrsta: str, skupina: str | None = None) -> list[str]:
    out = set()
    for k, v in CATALOG.items():
        if k.startswith('_') or not isinstance(v, dict) or not v.get('slug'):
            continue
        if v.get('vrsta') == vrsta and (skupina is None or v.get('skupina') == skupina):
            out.add(v['slug'])
    return sorted(out)


UPPER = slugs_by('Strength', 'Upper-push') + slugs_by('Strength', 'Upper-pull')
LEGS = slugs_by('Strength', 'Legs-main') + slugs_by('Strength', 'Legs-hips')
CORE = slugs_by('Strength', 'Core')
CARDIO = ['orb', 'bic', 'erg', 'traka']
MOBILITY = slugs_by('Mobility')
ALL_SLUGS = sorted({v['slug'] for k, v in CATALOG.items()
                    if not k.startswith('_') and isinstance(v, dict) and v.get('slug')
                    and v.get('vrsta') != 'Method'})

ATTRS_PARENT = [('rutina', 'text', ['Upper', 'Core', 'Legs', 'Z2', 'Tempo/HIIT']),
                ('s_kim', 'text', ['sam', 'Ašo', 'grupa'])]
ATTRS_LEAF = [('vjezba', 'text', ALL_SLUGS), ('blok', 'number', None), ('serija', 'number', None),
              ('red', 'number', None), ('kg', 'number', None), ('ponavljanja', 'number', None),
              ('trajanje', 'number', None), ('intenzitet', 'text', ['jako', 'lagano']),
              ('zagrijavanje', 'boolean', None), ('metoda', 'text', ['IMOM', 'HIIT', 'GtG', 'TbyT']),
              ('rpe', 'number', None)]


# ---------------------------------------------------------------- generator treninga
def warmup(rnd: random.Random) -> list[dict]:
    sets = [{'vjezba': rnd.choice(CARDIO), 'trajanje': rnd.choice([300, 420, 600]), 'zagrijavanje': True}]
    if rnd.random() < 0.6:
        sets.append({'vjezba': rnd.choice(MOBILITY), 'ponavljanja': 20, 'zagrijavanje': True})
    return sets


def strength_block(rnd: random.Random, pool: list[str], n_ex: int, n_ser: int) -> list[list[dict]]:
    """Vraća listu serija; serija = lista zapisa (vježbi) u tom prolazu kroz blok."""
    ex = rnd.sample(pool, n_ex)
    base = {e: rnd.choice([0, 4, 8, 12, 20, 32, 44]) for e in ex}
    out = []
    for s in range(n_ser):
        row = []
        for e in ex:
            if s > 0 and rnd.random() < 0.05:          # sprava zauzeta ⇒ druga vježba u toj seriji
                e = rnd.choice(pool)
            kg = base.get(e, 8) + 4 * s if base.get(e, 8) else None   # piramida
            rec = {'vjezba': e, 'ponavljanja': max(4, 15 - 3 * s)}
            if kg:
                rec['kg'] = kg
            row.append(rec)
        out.append(row)
    return out


def training(rnd: random.Random, kind: str) -> tuple[str, list[tuple[int, int, int, dict]]]:
    """(rutina, [(blok, serija, red, zapis)]). Blok 0 = zagrijavanje (bez serija: serija = red)."""
    recs: list[tuple[int, int, int, dict]] = []
    for i, w in enumerate(warmup(rnd), 1):
        recs.append((0, 1, i, w))
    if kind == 'imom' or kind.startswith('extreme'):
        minutes = {'imom': rnd.randint(10, 20), 'extreme120': 30, 'extreme220': 55}[kind]
        n_ex = 4 if kind.startswith('extreme') else rnd.choice([1, 2])
        ex = rnd.sample(['sklek', 'z_sklek', 'squat', 'kosa_k', 'swing', 'plank'], n_ex)
        for m in range(1, minutes + 1):
            for r, e in enumerate(ex, 1):
                rec = {'vjezba': e, 'ponavljanja': rnd.choice([4, 5, 6])}
                if m == 1 and r == 1:
                    rec['metoda'] = 'IMOM'
                    rec['rpe'] = 7
                recs.append((1, m, r, rec))
        # trening od 120/160 serija je SAMO blok IMOM-a (bez zagrijavanja), da broj bude točan
        if kind.startswith('extreme'):
            recs = [x for x in recs if x[0] == 1]
        return 'Core', recs
    if kind == 'intervali':
        n = rnd.randint(4, 10)
        dev = rnd.choice(['orb', 'bic', 'erg'])
        for i in range(1, n + 1):
            jako = {'vjezba': dev, 'trajanje': rnd.choice([30, 45, 60, 180, 240]), 'intenzitet': 'jako'}
            if i == 1:
                jako['metoda'] = 'HIIT'
            recs.append((1, 2 * i - 1, 1, jako))
            recs.append((1, 2 * i, 1, {'vjezba': dev, 'trajanje': rnd.choice([60, 90, 180, 210]),
                                       'intenzitet': 'lagano'}))
        return 'Tempo/HIIT', recs
    rutina = rnd.choice(['Upper', 'Legs', 'Core'])
    pool = {'Upper': UPPER, 'Legs': LEGS, 'Core': CORE}[rutina]
    blocks = [strength_block(rnd, pool, rnd.randint(3, 4), 3),
              strength_block(rnd, pool, 2, rnd.randint(2, 3))]
    if rnd.random() < 0.5:
        blocks.append(strength_block(rnd, CORE, 2, 2))
    for b, ser in enumerate(blocks, 1):
        for s, row in enumerate(ser, 1):
            for r, rec in enumerate(row, 1):
                if s == 1 and r == 1 and rnd.random() < 0.3:
                    rec['rpe'] = rnd.randint(5, 9)
                recs.append((b, s, r, rec))
    return rutina, recs


def build() -> dict:
    rnd = random.Random(SEED)
    area_id, act_id, gym_id = (str(uuid.uuid4()) for _ in range(3))
    defs = {}
    attr_rows = []
    for cat, attrs in ((act_id, ATTRS_PARENT), (gym_id, ATTRS_LEAF)):
        for i, (slug, dt, opts) in enumerate(attrs, 1):
            did = str(uuid.uuid4())
            defs[slug] = (did, dt)
            attr_rows.append({'id': did, 'user_id': OWNER_ID, 'category_id': cat, 'name': slug,
                              'slug': slug, 'data_type': dt, 'is_required': False, 'sort_order': i,
                              'validation_rules': {'suggest': opts} if opts else {}})
    events, values = [], []

    def val(ev_id, slug, v):
        did, dt = defs[slug]
        row = {'id': str(uuid.uuid4()), 'event_id': ev_id, 'attribute_definition_id': did,
               'user_id': OWNER_ID, 'value_text': None, 'value_number': None, 'value_boolean': None}
        row[{'text': 'value_text', 'number': 'value_number', 'boolean': 'value_boolean'}[dt]] = v
        values.append(row)

    kinds = (['snaga'] * 75 + ['imom'] * 10 + ['intervali'] * 15)
    day = date(2023, 1, 2)
    plan = [rnd.choice(kinds) for _ in range(N_TRAININGS)] + ['extreme120', 'extreme220']
    sizes = []
    for t, kind in enumerate(plan):
        day += timedelta(days=rnd.choice([1, 2, 2, 3, 4]))
        start = f'{day.isoformat()}T{16 + t % 3:02d}:{t % 60:02d}:00+00:00'
        rutina, recs = training(rnd, kind)
        pid = str(uuid.uuid4())
        events.append({'id': pid, 'user_id': OWNER_ID, 'category_id': act_id, 'event_date': day.isoformat(),
                       'session_start': start, 'chain_key': gym_id, 'comment': None})
        val(pid, 'rutina', rutina)
        val(pid, 's_kim', rnd.choice(['sam', 'sam', 'Ašo', 'grupa']))
        comment = f'S189 proba {kind} #{t + 1}'
        for blok, serija, red, rec in recs:
            eid = str(uuid.uuid4())
            events.append({'id': eid, 'user_id': OWNER_ID, 'category_id': gym_id,
                           'event_date': day.isoformat(), 'session_start': start, 'chain_key': None,
                           'comment': comment if (blok, serija, red) == recs[0][:3] else None})
            val(eid, 'blok', blok)
            val(eid, 'serija', serija)
            val(eid, 'red', red)
            for k, v in rec.items():
                val(eid, k, v)
        sizes.append((kind, len(recs), day.isoformat(), start))
    area = {'id': area_id, 'user_id': OWNER_ID, 'name': AREA_NAME, 'slug': 's189-serije-proba',
            'sort_order': 97,
            'settings': {'list_columns': {'columns': [
                {'role': 'date'}, {'role': 'attr', 'label': 'Rutina', 'slugs': ['rutina']},
                {'role': 'comment'}, {'role': 'actions'}]}}}
    cats = [{'id': act_id, 'user_id': OWNER_ID, 'area_id': area_id, 'parent_category_id': None,
             'name': 'Activity1', 'slug': 'activity1', 'level': 1, 'sort_order': 1},
            {'id': gym_id, 'user_id': OWNER_ID, 'area_id': area_id, 'parent_category_id': act_id,
             'name': 'Gym', 'slug': 'gym', 'level': 2, 'sort_order': 1}]
    return {'area': area, 'cats': cats, 'attrs': attr_rows, 'events': events, 'values': values,
            'sizes': sizes}


# ---------------------------------------------------------------- I/O
def post(url, key, table, rows, chunk=1000):
    for i in range(0, len(rows), chunk):
        req = urllib.request.Request(
            url + '/rest/v1/' + table, data=json.dumps(rows[i:i + chunk]).encode(),
            headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                     'Content-Type': 'application/json', 'Prefer': 'return=minimal'}, method='POST')
        try:
            urllib.request.urlopen(req, timeout=120)
        except urllib.error.HTTPError as e:
            sys.exit(f'✗ {table} [{i}]: {e.code} {e.read().decode()[:400]}')


def delete(url, key, table, flt):
    req = urllib.request.Request(url + '/rest/v1/' + table + '?' + flt, method='DELETE',
                                 headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                                          'Prefer': 'return=representation'})
    return len(json.load(urllib.request.urlopen(req, timeout=120)))


def main():
    if _db.target() != 'test':
        sys.exit('✗ Probna Area ide SAMO na TEST (ET_TARGET=prod odbijen).')
    url, key = _db.load_env('test')
    print(f'[TEST] {url}')
    existing = _db.rest(url, key, f'areas?select=id,name&name=eq.{urllib.parse.quote(AREA_NAME)}')
    if '--obrisi' in sys.argv:
        if not existing:
            sys.exit('Nema Aree — ništa za obrisati.')
        aid = existing[0]['id']
        cats = _db.rest(url, key, f'categories?select=id&area_id=eq.{aid}')
        cids = ','.join(c['id'] for c in cats)
        evs = _db.rest(url, key, f'events?select=id&category_id=in.({cids})')
        n_attr = 0
        for i in range(0, len(evs), 150):
            ids = ','.join(e['id'] for e in evs[i:i + 150])
            n_attr += delete(url, key, 'event_attributes', f'event_id=in.({ids})')
        # ⚠ roditelji (Activity1) nose chain_key → Gym: briši sve evente prije kategorija
        n_ev = 0
        for i in range(0, len(evs), 150):
            ids = ','.join(e['id'] for e in evs[i:i + 150])
            n_ev += delete(url, key, 'events', f'id=in.({ids})')
        delete(url, key, 'data_shares', f'target_id=eq.{aid}')
        delete(url, key, 'attribute_definitions', f'category_id=in.({cids})')
        delete(url, key, 'categories', f'area_id=eq.{aid}&parent_category_id=not.is.null')
        delete(url, key, 'categories', f'area_id=eq.{aid}')
        delete(url, key, 'areas', f'id=eq.{aid}')
        print(f'✓ obrisano: {n_ev} eventa, {n_attr} vrijednosti, Area {aid}')
        return
    b = build()
    n_sets = len(b['events']) - len(b['sizes'])
    sz = sorted(n for _, n, _, _ in b['sizes'])
    print(f'treninga {len(b["sizes"])} · zapisa serija {n_sets} · roditelja {len(b["sizes"])} · '
          f'vrijednosti {len(b["values"])}')
    print(f'serija po treningu: min {sz[0]} · medijan {sz[len(sz) // 2]} · '
          f'90% {sz[int(len(sz) * .9)]} · max {sz[-1]}')
    for kind, n, d, s in b['sizes'][-2:]:
        print(f'  ekstrem {kind}: {n} serija, {d} ({s}) — vrijednosti ~{n * 6}')
    if '--apply' not in sys.argv:
        print('(suhi prolaz — --apply stvara)')
        return
    if existing:
        sys.exit(f'✗ Area „{AREA_NAME}" već postoji ({existing[0]["id"]}) — prvo --obrisi.')
    sasa = _db.rest(url, key, f'profiles?select=id&email=eq.{SASA_EMAIL}')
    post(url, key, 'areas', [b['area']])
    post(url, key, 'categories', b['cats'][:1])
    post(url, key, 'categories', b['cats'][1:])
    post(url, key, 'attribute_definitions', b['attrs'])
    post(url, key, 'events', b['events'])
    post(url, key, 'event_attributes', b['values'])
    if sasa:
        post(url, key, 'data_shares', [{'owner_id': OWNER_ID, 'grantee_id': sasa[0]['id'],
                                        'share_type': 'area', 'target_id': b['area']['id'],
                                        'permission': 'read', 'note': 'S189 proba serija'}])
    # mjeri u bazi, ne vjeruj brojaču
    cids = ','.join(c['id'] for c in b['cats'])
    got_ev = len(_db.rest(url, key, f'events?select=id&category_id=in.({cids})'))
    print(f'✓ Area {b["area"]["id"]} · eventa u bazi {got_ev} (očekivano {len(b["events"])})'
          f'{" · podijeljena Saši (read)" if sasa else " · ⚠ Saša nije nađen, nije podijeljena"}')


if __name__ == '__main__':
    main()
