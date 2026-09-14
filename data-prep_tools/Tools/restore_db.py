# -*- coding: utf-8 -*-
"""
restore_db.py — vracanje snimke koju je napravio `backup_db.py`. S136.

  Tools\\run.bat Tools\\restore_db.py --env test --snapshot <mapa>            (dry run)
  Tools\\run.bat Tools\\restore_db.py --env test --snapshot <mapa> --apply    (fill)
  Tools\\run.bat Tools\\restore_db.py --env test --snapshot <mapa> --apply --mode exact

/!\\ ZASTO POSTOJI
  Do S134 PROD nije imao NIJEDNU kopiju. Od S134 ima kopiju, ali je nitko nikad
  nije vratio -- a kopija iz koje se nije dokazalo vracanje nije backup nego
  nada. Ovaj alat zatvara tu razliku, i mjeri je: poslije vracanja usporedi
  `sha256` po tablici s onim iz manifesta.

/!\\ OPASNOST JE VECA OD „PREPISATI STARIM PODACIMA" (Sasin nalaz, S136)
  Restore pokrenut mjesecima kasnije ne bi samo prepisao -- OBRISAO BI SVAKI
  REDAK NASTAO POSLIJE SNIMKE. To je razlika izmedju „izgubio sam izmjenu" i
  „izgubio sam cetiri dana rada". Zato se ne rjesava upozorenjem nego OBLIKOM
  ALATA:

    dry run (zadano)  samo ispise sto bi se dogodilo
    --mode fill       upise SAMO retke kojih nema; ne mijenja i ne brise nista
                      => ne moze unistiti novije podatke PO KONSTRUKCIJI
    --mode exact      uskladi bazu sa snimkom: insert + update + DELETE

  `fill` je ono sto treba u gotovo svakom stvarnom slucaju („vratio sam
  obrisano"). `exact` je katastrofa-opcija i trazi izricitu potvrdu utipkavanjem.

/!\\ TRI BRANE
  1. Zadano je dry run. Broj redaka koji bi se OBRISAO ispisuje se uvijek, i to
     prvi -- jer je to jedina nepovratna posljedica.
  2. `project_ref` iz manifesta mora se poklapati s bazom. Snimka vracena u krivi
     projekt tiho prepisuje autorstvo; `backup_db.py` je to predvidio u komentaru,
     ovdje se konacno provjerava.
  3. `--env prod` trazi `--yes-i-mean-prod` I svjez backup, koji alat uzima SAM.
     Vracanje bez mreze za pad je ista vrsta rizika koju ovaj alat zatvara.

/!\\ REDOSLIJED JE DIO ISPRAVNOSTI
  Insert ide po `table_order` (roditelji prvi), DELETE obrnutim redom (djeca
  prva). Obrnuto padne na FK: `event_attributes` prije `events`, `categories`
  prije `areas`.

/!\\ STO OVAJ ALAT NE MOZE, i to mora pisati naglas
  - `auth.users` se NE vraca (u manifestu je samo popis). Redak cijeg korisnika
    vise nema padne na FK -- alat to prijavi po retku, ne srusi se.
  - Fotografije (Storage) idu svojim putem, nisu dio ovog vracanja.
  - Triggeri mogu promijeniti ono sto se upisuje. PROD ih ima 8, TEST 2
    (`maintain_paths`, slug triggeri, `prevent_category_deletion`...). Zato se
    poslije vracanja MJERI, a ne pretpostavlja.
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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:  # noqa: BLE001
        pass

from backup_db import (  # noqa: E402
    TABLES, count_rows, do_backup, fetch_table, headers, load_service_env,
)

CHUNK_WRITE = 200      # redaka po POST-u
CHUNK_DELETE = 100     # id-eva po DELETE-u (duljina URL-a)


def canon(row):
    """Kanonski oblik retka za usporedbu — isti kljucevi, isti redoslijed."""
    return json.dumps(row, ensure_ascii=False, sort_keys=True)


def sha_of(rows):
    return hashlib.sha256(canon(rows).encode('utf-8')).hexdigest()


def load_snapshot(path):
    p = Path(path)
    if p.is_dir():
        p = p / 'db.json.gz'
    if not p.exists():
        sys.exit('Nema snimke: ' + str(p))
    with gzip.open(p, 'rt', encoding='utf-8') as fh:
        data = json.load(fh)
    if 'manifest' not in data or 'tables' not in data:
        sys.exit('Ovo nije snimka koju pravi `backup_db.py`.')
    return data, p


def project_ref_of(url):
    return url.split('//', 1)[-1].split('.', 1)[0]


def post_rows(url, key, table, rows, upsert):
    """PostgREST prima niz. `return=minimal` jer nam vraceni retci ne trebaju —
    a i jeftinije je (v. CLAUDE.md o `return=representation`)."""
    prefer = 'return=minimal'
    if upsert:
        prefer += ',resolution=merge-duplicates'
    for i in range(0, len(rows), CHUNK_WRITE):
        chunk = rows[i:i + CHUNK_WRITE]
        req = urllib.request.Request(
            url + '/rest/v1/' + table,
            data=json.dumps(chunk, ensure_ascii=False).encode('utf-8'),
            headers={**headers(key), 'Content-Type': 'application/json',
                     'Prefer': prefer},
            method='POST')
        try:
            urllib.request.urlopen(req).read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode('utf-8', 'replace')[:400]
            raise RuntimeError('%s: HTTP %d — %s' % (table, exc.code, body)) from None


def delete_ids(url, key, table, ids):
    for i in range(0, len(ids), CHUNK_DELETE):
        chunk = ids[i:i + CHUNK_DELETE]
        quoted = ','.join('"%s"' % x for x in chunk)
        req = urllib.request.Request(
            url + '/rest/v1/' + table + '?id=in.(' + quoted + ')',
            headers={**headers(key), 'Prefer': 'return=minimal'},
            method='DELETE')
        try:
            urllib.request.urlopen(req).read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode('utf-8', 'replace')[:400]
            raise RuntimeError('%s: HTTP %d — %s' % (table, exc.code, body)) from None


def compare(url, key, snap_tables):
    """Za svaku tablicu: sto fali, sto se razlikuje, sto je VISAK u bazi."""
    plan = {}
    for table in TABLES:
        want = {r['id']: r for r in snap_tables.get(table, [])}
        expected = count_rows(url, key, table)
        have_rows = fetch_table(url, key, table, expected) if expected else []
        have = {r['id']: r for r in have_rows}

        missing = [want[i] for i in want if i not in have]
        differing = [want[i] for i in want
                     if i in have and canon(want[i]) != canon(have[i])]
        extra = [i for i in have if i not in want]
        plan[table] = {'missing': missing, 'differing': differing,
                       'extra': extra, 'live': len(have), 'snap': len(want)}
    return plan


def print_plan(plan, mode):
    print('\n%-24s %8s %8s %9s %9s %9s'
          % ('tablica', 'snimka', 'baza', 'DODATI', 'promij.', 'OBRISATI'))
    print('-' * 72)
    tot_add = tot_diff = tot_del = 0
    for table in TABLES:
        p = plan[table]
        n_del = len(p['extra']) if mode == 'exact' else 0
        n_diff = len(p['differing']) if mode == 'exact' else 0
        tot_add += len(p['missing']); tot_diff += n_diff; tot_del += n_del
        flag = '  <<< BRISE' if n_del else ''
        print('%-24s %8d %8d %9d %9d %9d%s'
              % (table, p['snap'], p['live'], len(p['missing']), n_diff, n_del, flag))
    print('-' * 72)
    print('%-24s %8s %8s %9d %9d %9d' % ('UKUPNO', '', '', tot_add, tot_diff, tot_del))

    if mode == 'fill':
        skipped = sum(len(plan[t]['differing']) for t in TABLES)
        extra = sum(len(plan[t]['extra']) for t in TABLES)
        print('\n`fill` NE dira %d razlicitih i NE brise %d redaka kojih snimka nema.'
              % (skipped, extra))
        print('To je namjerno: tako novije podatke ne moze unistiti ni greskom.')
    return tot_add, tot_diff, tot_del


def main():
    ap = argparse.ArgumentParser(description='Vracanje snimke iz `backup_db.py`.')
    ap.add_argument('--env', choices=['prod', 'test'], required=True)
    ap.add_argument('--snapshot', required=True, help='mapa snimke ili db.json.gz')
    ap.add_argument('--mode', choices=['fill', 'exact'], default='fill')
    ap.add_argument('--apply', action='store_true', help='bez ovoga je dry run')
    ap.add_argument('--yes-i-mean-prod', action='store_true')
    ap.add_argument('--tables', help='samo ove tablice (zarezom), za dokaz na TEST-u')
    args = ap.parse_args()

    data, path = load_snapshot(args.snapshot)
    man = data['manifest']
    url, key = load_service_env(args.env)

    # Brana 2 — snimka mora biti IZ TE baze.
    ref_db = project_ref_of(url)
    if man.get('project_ref') != ref_db:
        sys.exit('[X] Snimka je iz projekta `%s`, a ciljas `%s` (%s).\n'
                 '    Vracanje u krivi projekt tiho prepisuje autorstvo.'
                 % (man.get('project_ref'), ref_db, args.env))

    print('snimka   : %s' % path)
    print('nastala  : %s  (env=%s, projekt=%s)'
          % (man.get('created_at'), man.get('env'), man.get('project_ref')))
    print('cilj     : %s  (%s)' % (url, args.env))
    print('nacin    : %s%s' % (args.mode, '' if args.apply else '   [DRY RUN]'))

    global TABLES  # noqa: PLW0603 -- svjesno suzavanje opsega za dokaz na TEST-u
    if args.tables:
        want = [t.strip() for t in args.tables.split(',') if t.strip()]
        unknown = [t for t in want if t not in TABLES]
        if unknown:
            sys.exit('Nepoznate tablice: %s' % unknown)
        # /!\ Redoslijed se NE preuzima od korisnika nego ostaje iz `TABLES`:
        #     FK ne mari za to kako je netko posložio argument.
        TABLES[:] = [t for t in TABLES if t in want]
        print('tablice  : %s  (suzeno)' % ', '.join(TABLES))

    print('\nCitam bazu i usporedjujem...')
    plan = compare(url, key, data['tables'])
    tot_add, tot_diff, tot_del = print_plan(plan, args.mode)

    if not args.apply:
        print('\n[DRY RUN] Nista nije upisano. Dodaj `--apply` kad brojke budu u redu.')
        return

    if tot_add == 0 and tot_diff == 0 and tot_del == 0:
        print('\n[OK] Baza vec odgovara snimci — nema sto vratiti.')
        return

    # Brana 3 — PROD.
    if args.env == 'prod':
        if not args.yes_i_mean_prod:
            sys.exit('\n[X] PROD trazi i `--yes-i-mean-prod`.')
        print('\nPROD: uzimam svjez backup prije vracanja...')
        do_backup('prod', ROOT / 'data-prep_data' / '_backup', True)
        print('[OK] Mreza za pad je na mjestu.')

    if args.mode == 'exact' and tot_del:
        print('\n/!\\ `exact` ce OBRISATI %d redaka kojih u snimci nema.' % tot_del)
        print('    Ako je snimka starija od tih redaka, to je gubitak rada.')
        if input('    Utipkaj OBRISI da nastavis: ').strip() != 'OBRISI':
            sys.exit('    Prekinuto.')

    t0 = time.time()
    # DELETE ide PRVI i OBRNUTIM redom (djeca prije roditelja) — inace FK.
    if args.mode == 'exact':
        for table in reversed(TABLES):
            ids = plan[table]['extra']
            if ids:
                print('  brisem  %-22s %6d' % (table, len(ids)))
                delete_ids(url, key, table, ids)

    for table in TABLES:
        rows = plan[table]['missing']
        if args.mode == 'exact':
            rows = rows + plan[table]['differing']
        if rows:
            print('  upisujem %-21s %6d%s'
                  % (table, len(rows), ' (upsert)' if args.mode == 'exact' else ''))
            post_rows(url, key, table, rows, upsert=(args.mode == 'exact'))

    # /!\ DOKAZ, ne nada: procitaj natrag i usporedi sa `sha256` iz manifesta.
    print('\nProvjera nakon vracanja:')
    ok = True
    for table in TABLES:
        expected = count_rows(url, key, table)
        rows = fetch_table(url, key, table, expected) if expected else []
        want_meta = man['tables'].get(table, {})
        same = sha_of(rows) == want_meta.get('sha256')
        if same:
            print('  [OK] %-22s %6d redaka — sha256 se poklapa' % (table, len(rows)))
        else:
            ok = False
            extra_now = len(rows) - want_meta.get('count', 0)
            note = ('baza ima %+d redaka u odnosu na snimku' % extra_now
                    if extra_now else 'isti broj redaka, ali sadrzaj se razlikuje')
            print('  [--] %-22s %6d redaka — %s' % (table, len(rows), note))

    print('\n[%s] %.0f s' % ('OK' if ok else 'GOTOVO', time.time() - t0))
    if not ok and args.mode == 'fill':
        # /!\ Ovo NIJE neuspjeh. `fill` namjerno ostavlja novije retke, pa se
        #     `sha256` po definiciji ne moze poklopiti kad ih ima. Poruka to
        #     mora reci, inace izgleda kao pad i sljedeci covjek posegne za
        #     `exact` -- tocno onim sto smo htjeli izbjeci.
        print('    `fill` ostavlja novije retke netaknutima, pa se `sha256` ne')
        print('    poklapa kad ih baza ima. Potpuno poklapanje trazi `--mode exact`.')


if __name__ == '__main__':
    main()
