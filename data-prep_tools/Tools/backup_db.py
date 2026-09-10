# -*- coding: utf-8 -*-
"""
backup_db.py -- snimka CIJELE baze preko PostgREST-a, service kljucem. S134.

Supabase free plan nema automatske backupe (provjereno na PROD-u 10.09.2026.:
"Free Plan does not include project backups"). Do ovog alata jedina kopija
PROD podataka bila je -- nijedna.

STO POKRIVA
  Sve podatkovne tablice, popis auth korisnika (id + email, bez lozinki) i
  fileove iz Storage bucketa `activity-attachments`.

STO NE POKRIVA -- i to treba znati prije nego se netko osloni na ovaj file:
  * SHEMU (RLS politike, triggeri, funkcije, RPC). Snimka podataka + prazan
    projekt = ne moze se vratiti nista. Za to ide `pg_dump --schema-only`
    (pg_dump 17 je vec na Sasinom stroju), i to je zaseban, jednako vazan posao:
    shema PROD-a nije u gitu, sto je vec dvaput ugrizlo (S118 slug trigger,
    S133 `categories_update` politika).
  * LOZINKE korisnika -- ne mogu se izvuci ni service kljucem.

CETIRI ZASTITE, svaka odgovara zapisanoj zamci:
  1. KLJUC MORA BITI SERVICE. Anon kljuc kroz RLS vrati prazno bez ijedne
     greske -- backup bi izasao uredan i prazan. Izmjereno 10.09.: `_db.load_env
     ('test')` pada na anon, i TEST je zbog toga izgledao kao baza s 0 eventa
     (stvarno stanje 12.363). Zato ovaj alat NE koristi `_db.load_env` -- ono
     namjerno pada na anon za alate koji rade kao korisnik.
  2. BROJ REDAKA SE PROVJERAVA. `count=exact` prije dohvata, usporedba poslije.
     PostgREST reze na 1000 redaka bez greske (S108); backup koji je tiho kraci
     je gori od nikakvog, jer se u njega vjeruje.
  3. PAGINACIJA IDE KROZ `_db.rest`, koji lijepi `order=id`. Bez toga se stranice
     preklope i istovremeno preskoce -- svaki put drugacije (S108). Pravilo
     namjerno ostaje na JEDNOM mjestu; retry je ovdje, oko cijele tablice.
  4. ZAPISANI FILE SE PROCITA NATRAG. Pokvaren gz se vidi sada, ne za pola godine.

OBLIK IZLAZA
  data-prep_data/_backup/<env>/
      files/<user_id>/<ime>            zajednicki; preuzima se samo cega nema
      <YYYY-MM-DD_HHMM>/db.json.gz     {manifest, tables}
      <YYYY-MM-DD_HHMM>/manifest.json  isti manifest, citljiv bez raspakiranja

  Fotografije su izvan snimke namjerno: rijetko se mijenjaju, a 5,6 MB po
  snimci svaki dan je cista cijena. Manifest svake snimke nosi popis fileova
  koji su u tom trenutku postojali, pa se zna sto je snimci pripadalo.

  `data-prep_data/` je gitignoriran u cijelosti i `Tools\\backup_to_external.bat`
  ga vec nosi na vanjski disk -- backup time ne trazi nijednu novu naviku.

  ALAT NE BRISE NISTA. Isti razlog zbog kojeg `backup_to_external.bat` namjerno
  ne koristi /MIR: brisanje na jednoj strani ne smije stici do jedine druge kopije.

Upotreba:
    Tools\\run.bat Tools\\backup_db.py --env prod
    Tools\\run.bat Tools\\backup_db.py --env test --no-files
    Tools\\run.bat Tools\\backup_db.py --list
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Windows konzola je cp1252: `print` s dijakritikom baci UnicodeEncodeError.
# Bez ovoga bi alat pao NA ISPISU GRESKE koja nosi podatak (npr. ime racuna
# `Sasin tekuci RF`) -- dakle sakrio bi bas onu poruku zbog koje je pao.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:  # noqa: BLE001  -- stariji Python / preusmjeren izlaz
        pass

sys.path.insert(0, str(ROOT / 'data-prep_tools' / 'Financije'))
from _db import rest  # noqa: E402  -- pravilo o paginaciji zivi ondje, ne ovdje

# FK redoslijed: restore poslije smije samo ici odozgo prema dolje.
# `category_full_paths` je VIEW (nema `id`) -- izveden je iz ovih tablica i u
# snimku ne ide; upisan natrag bio bi duplikat.
TABLES = [
    'areas', 'categories', 'attribute_definitions', 'events',
    'event_attributes', 'event_attachments', 'balance_anchors',
    'activity_presets', 'data_shares', 'share_invites', 'profiles', 'feedback',
]

BUCKET = 'activity-attachments'
FORMAT_VERSION = 1


def load_service_env(which):
    """Trazi ISKLJUCIVO service kljuc -- v. zastita 1 u zaglavlju.

    TEST service kljuc zivi u `.env.local`, ne u `.env.testing` (ondje je
    zakomentiran). To nije previd nego zatecenost koju alat mora znati."""
    fn = '.env.prod.local' if which == 'prod' else '.env.local'
    path = ROOT / fn
    if not path.exists():
        sys.exit('Nema ' + fn)
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url:
        sys.exit(fn + ' nema SUPABASE_URL.')
    if not key:
        sys.exit(fn + ' nema SUPABASE_SERVICE_ROLE_KEY. Anon kljuc bi kroz RLS\n'
                      'dao PRAZAN backup bez ijedne greske -- zato alat staje.')
    if not key.startswith('sb_secret_'):
        # Novi Supabase kljucevi su `sb_secret_*`; stari su JWT s role u payloadu.
        role = None
        try:
            import base64
            payload = key.split('.')[1]
            payload += '=' * (-len(payload) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get('role')
        except Exception:  # noqa: BLE001
            role = None
        if role != 'service_role':
            sys.exit('SUPABASE_SERVICE_ROLE_KEY u ' + fn + ' nije service kljuc\n'
                     '(role=' + str(role) + '). Backup bi bio prazan a izgledao uredan.')
    return url, key


def headers(key):
    return {'apikey': key, 'Authorization': 'Bearer ' + key}


def count_rows(url, key, table):
    req = urllib.request.Request(
        url + '/rest/v1/' + table + '?select=id',
        headers={**headers(key), 'Range': '0-0', 'Prefer': 'count=exact'})
    cr = urllib.request.urlopen(req).headers.get('Content-Range', '')
    return int(cr.split('/')[-1])


def fetch_table(url, key, table, expected):
    """Retry ide oko CIJELE tablice: `_db.rest` ga nema, a free tier se zna
    gusiti (S105). Ponovni dohvat 95k redaka je skup, ali se dogadja rijetko --
    jeftinije od druge kopije pravila o paginaciji."""
    last = None
    for attempt in range(3):
        try:
            rows = rest(url, key, table + '?select=*')
            if len(rows) != expected:
                raise RuntimeError(
                    'nesklad: baza javlja %d redaka, dohvaceno %d'
                    % (expected, len(rows)))
            return rows
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError('%s: %s' % (table, last))


def fetch_auth_users(url, key):
    """Samo id + email + created_at. Lozinke se ne mogu izvuci, a i ne trebaju:
    ovo sluzi tome da se poslije zna TKO je koji uuid -- bez toga se restore u
    drugi projekt ne moze ni mapirati (svi `user_id` su FK na `auth.users`)."""
    req = urllib.request.Request(url + '/auth/v1/admin/users?per_page=200',
                                 headers=headers(key))
    data = json.load(urllib.request.urlopen(req))
    users = data.get('users', data) if isinstance(data, dict) else data
    return [{'id': u['id'], 'email': u.get('email'),
             'created_at': u.get('created_at')} for u in users]


def list_storage(url, key):
    """Bucket je slozen u foldere po `user_id`, pa jedan `list` vraca foldere
    (metadata=None), ne fileove."""
    def ls(prefix):
        body = json.dumps({'prefix': prefix, 'limit': 1000,
                           'sortBy': {'column': 'name', 'order': 'asc'}}).encode()
        req = urllib.request.Request(
            url + '/storage/v1/object/list/' + BUCKET, data=body,
            headers={**headers(key), 'Content-Type': 'application/json'},
            method='POST')
        return json.load(urllib.request.urlopen(req))

    out = []
    for top in ls(''):
        if top.get('id') is None:  # folder
            for obj in ls(top['name']):
                if obj.get('id') is not None:
                    out.append({'path': top['name'] + '/' + obj['name'],
                                'size': (obj.get('metadata') or {}).get('size', 0)})
        else:
            out.append({'path': top['name'],
                        'size': (top.get('metadata') or {}).get('size', 0)})
    return out


def download_missing(url, key, objects, files_dir):
    """Preuzima samo ono cega jos nema -- imena vec nose uuid, pa je ime dovoljan
    identitet."""
    got = skipped = failed = 0
    for obj in objects:
        dest = files_dir / obj['path']
        if dest.exists() and dest.stat().st_size == obj['size']:
            skipped += 1
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            url + '/storage/v1/object/' + BUCKET + '/' + obj['path'],
            headers=headers(key))
        try:
            dest.write_bytes(urllib.request.urlopen(req).read())
            got += 1
        except urllib.error.HTTPError as exc:
            print('    [!] %s -- HTTP %s' % (obj['path'], exc.code))
            failed += 1
    return got, skipped, failed


def show_snapshots(base, which):
    snaps = sorted(p for p in base.glob('*') if p.is_dir() and p.name != 'files')
    size = sum(f.stat().st_size for f in base.rglob('*') if f.is_file())
    print('\n     %s: %d snimki, ukupno %.1f MB (najstarija %s)'
          % (which, len(snaps), size / 1048576, snaps[0].name if snaps else '-'))
    print('     Alat ne brise nista -- stare snimke se maknu rukom.')


def do_backup(which, out_root, with_files):
    url, key = load_service_env(which)
    ref = url.split('//')[1].split('.')[0]
    stamp = datetime.now().strftime('%Y-%m-%d_%H%M')
    base = out_root / which
    snap = base / stamp
    snap.mkdir(parents=True, exist_ok=True)

    print('Baza  : %s  (%s)' % (ref, which.upper()))
    print('Snimka: %s' % snap)
    print()

    tables, meta = {}, {}
    t0 = time.time()
    for table in TABLES:
        expected = count_rows(url, key, table)
        rows = fetch_table(url, key, table, expected) if expected else []
        blob = json.dumps(rows, ensure_ascii=False, sort_keys=True).encode('utf-8')
        tables[table] = rows
        meta[table] = {'count': len(rows),
                       'sha256': hashlib.sha256(blob).hexdigest(),
                       'bytes': len(blob)}
        print('  %-24s %7d redaka' % (table, len(rows)))

    users = fetch_auth_users(url, key)
    print('  %-24s %7d' % ('auth.users', len(users)))

    objects = list_storage(url, key) if with_files else []
    if with_files:
        print('  %-24s %7d fileova (%.2f MB)'
              % ('storage/' + BUCKET, len(objects),
                 sum(o['size'] for o in objects) / 1048576))

    manifest = {
        'format_version': FORMAT_VERSION,
        'created_at': datetime.now().astimezone().isoformat(timespec='seconds'),
        'env': which,
        # /!\ Restore MORA provjeriti ovo prije upisa. Snimka vracena u krivi
        #     projekt prepisala bi autorstvo -- tiho, jer bi sve izgledalo uredno.
        'project_ref': ref,
        'supabase_url': url,
        'table_order': TABLES,
        'tables': meta,
        'auth_users': users,
        'storage_bucket': BUCKET,
        'storage_objects': objects,
    }

    payload = {'manifest': manifest, 'tables': tables}
    gz_path = snap / 'db.json.gz'
    with gzip.open(gz_path, 'wt', encoding='utf-8', compresslevel=6) as fh:
        json.dump(payload, fh, ensure_ascii=False)
    (snap / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

    # Zastita 4: procitaj natrag i usporedi. Pokvaren zapis se vidi sada.
    with gzip.open(gz_path, 'rt', encoding='utf-8') as fh:
        back = json.load(fh)
    for table in TABLES:
        got = len(back['tables'][table])
        if got != meta[table]['count']:
            sys.exit('[X] Zapisani file se ne cita ispravno: %s ima %d umjesto %d'
                     % (table, got, meta[table]['count']))
    if back['manifest']['project_ref'] != ref:
        sys.exit('[X] Manifest u fileu ne odgovara bazi iz koje je citan.')

    if with_files and objects:
        got, skipped, failed = download_missing(url, key, objects, base / 'files')
        print('\n  fotografije: %d novih, %d vec postojalo, %d neuspjelih'
              % (got, skipped, failed))

    total_rows = sum(m['count'] for m in meta.values())
    print('\n[OK] %d redaka u %d tablica, %.2f MB (gzip), %.0f s'
          % (total_rows, len(TABLES), gz_path.stat().st_size / 1048576,
             time.time() - t0))
    print('     %s' % gz_path)
    show_snapshots(base, which)
    return gz_path


def verify(snapshot):
    """Provjeri staru snimku: raspakiraj i usporedi sa sha256 iz manifesta.

    Bez ovoga se pokvaren gz otkriva tek pri restoreu -- dakle u trenutku kad je
    to jedina kopija koja je trebala pomoci. Hash se racuna nad ISTIM oblikom
    kao pri pisanju (`sort_keys=True`), inace bi provjera padala na urednoj snimci."""
    path = Path(snapshot)
    if path.is_dir():
        path = path / 'db.json.gz'
    if not path.exists():
        sys.exit('Nema ' + str(path))
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        data = json.load(fh)
    man = data['manifest']
    print('Snimka : %s' % path)
    print('Baza   : %s (%s), %s' % (man['project_ref'], man['env'], man['created_at']))
    bad = 0
    for table, meta in man['tables'].items():
        rows = data['tables'].get(table, [])
        blob = json.dumps(rows, ensure_ascii=False, sort_keys=True).encode('utf-8')
        ok = (len(rows) == meta['count']
              and hashlib.sha256(blob).hexdigest() == meta['sha256'])
        bad += 0 if ok else 1
        print('  %-24s %7d redaka  %s' % (table, len(rows), 'OK' if ok else '[X] NE VALJA'))
    files_dir = path.parent.parent / 'files'
    missing = [o['path'] for o in man.get('storage_objects', [])
               if not (files_dir / o['path']).exists()]
    if man.get('storage_objects'):
        print('  %-24s %7d fileova, %d nedostaje'
              % ('storage', len(man['storage_objects']), len(missing)))
    if bad:
        sys.exit('\n[X] %d tablica ne odgovara manifestu -- snimka je pokvarena.' % bad)
    print('\n[OK] Snimka je citljiva i odgovara manifestu.')


def main():
    ap = argparse.ArgumentParser(description='Snimka cijele baze (service kljuc).')
    ap.add_argument('--env', choices=['prod', 'test'], help='koju bazu snimiti')
    ap.add_argument('--out', default=str(ROOT / 'data-prep_data' / '_backup'))
    ap.add_argument('--no-files', action='store_true',
                    help='preskoci fotografije iz Storagea')
    ap.add_argument('--list', action='store_true',
                    help='samo ispisi postojece snimke')
    ap.add_argument('--verify', metavar='SNIMKA',
                    help='provjeri postojecu snimku (put do foldera ili db.json.gz)')
    args = ap.parse_args()

    out_root = Path(args.out)
    if args.verify:
        verify(args.verify)
        return
    if args.list:
        for which in ('prod', 'test'):
            base = out_root / which
            if base.exists():
                show_snapshots(base, which)
            else:
                print('\n     %s: nijedna snimka.' % which)
        return
    if not args.env:
        ap.error('zadaj --env prod ili --env test (ili --list)')
    do_backup(args.env, out_root, not args.no_files)


if __name__ == '__main__':
    main()
