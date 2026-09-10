# -*- coding: utf-8 -*-
"""
dump_schema.py -- shema baze (RLS politike, triggeri, funkcije) u git. S134.

ZASTO POSTOJI
  `backup_db.py` snima PODATKE. Podaci + prazan projekt = ne moze se vratiti
  nista: nema tablica, nema politika, nema triggera. Ovaj alat snima drugu
  polovicu.

  Vaznije od backupa: shema PROD-a NIJE BILA U REPOU, i to je ugrizlo tri puta
  u tri sesije --
    S118  PROD trigger `generate_slug_from_name` gazio je slug na INSERT-u,
          dok je komentar iznad tvrdio suprotno. TEST ga uopce nema.
    S133  `categories_update` politika PROD-a propusta write-grantee-a; u repou
          stoji `TEST_setup.sql` s uzim uvjetom, koji nije isti.
    S134  TEST-ove stvarne politike ne odgovaraju `TEST_setup.sql` ni u TEST-u.
  Svaki put se zakljucivalo citanjem migracija, i svaki put je bilo krivo.
  Otkad ovaj file postoji, na to pitanje odgovara `git diff`, ne pamcenje.

VEZA IDE PREKO POOLERA, NE DIREKTNO
  `db.<ref>.supabase.co` ima samo AAAA zapis, a stroj nema IPv6 izlaz
  (izmjereno 10.09.2026.) => direktna veza ne moze proci. Session pooler ima
  IPv4 i podrzava `pg_dump`; transaction pooler (port 6543) ne podrzava.
  ⚠ Pooler host se ne da pogoditi: PROD je `aws-1-eu-west-1`, TEST
    `aws-0-eu-west-1` -- ista regija, razlicit pooler.

  Connection string zivi u `.env.*.local` kao `SUPABASE_DB_URL`. Ti su fileovi
  gitignorirani; izlaz ovog alata NIJE i namjerno ide u `sql/`.

Upotreba:
    Tools\\run.bat Tools\\dump_schema.py --env test
    Tools\\run.bat Tools\\dump_schema.py --env prod
    Tools\\run.bat Tools\\dump_schema.py --env prod --diff   (usporedi s onim u gitu)
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:  # noqa: BLE001
        pass

PG_DUMP_CANDIDATES = [
    r'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
    r'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
    'pg_dump',
]


def find_pg_dump():
    for cand in PG_DUMP_CANDIDATES:
        if cand == 'pg_dump' or Path(cand).exists():
            return cand
    sys.exit('Ne nalazim pg_dump. Instaliraj PostgreSQL client alate ili dopuni '
             'PG_DUMP_CANDIDATES.')


def db_url(which):
    fn = '.env.prod.local' if which == 'prod' else '.env.local'
    path = ROOT / fn
    if not path.exists():
        sys.exit('Nema ' + fn)
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.strip().startswith('SUPABASE_DB_URL='):
            url = line.split('=', 1)[1].strip().strip('"').strip("'")
            if ':6543/' in url:
                sys.exit('SUPABASE_DB_URL koristi port 6543 (transaction pooler).\n'
                         'pg_dump treba SESSION pooler -- port 5432.')
            return url
    sys.exit(fn + ' nema SUPABASE_DB_URL.\n'
             'Uzmi ga iz Supabase: Connect -> Direct -> Session pooler,\n'
             'ili sastavi: postgresql://postgres.<ref>:<lozinka>@<pooler-host>:5432/postgres')


def scrub(text):
    """Iz zaglavlja dumpa makni sve sto lici na connection string s lozinkom.
    Izlaz ide u git; lozinka ne."""
    return re.sub(r'(postgresql://[^:\s]+:)[^@\s]+(@)', r'\1********\2', text)


def dump(which, out_path):
    url = db_url(which)
    env = dict(os.environ)
    cmd = [find_pg_dump(), url, '--schema-only', '--schema=public', '--no-owner']
    print('pg_dump -> %s' % out_path.name)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=env)
    if res.returncode != 0:
        sys.exit('pg_dump je pao:\n' + (res.stderr or '')[:1500])

    body = scrub(res.stdout)
    header = (
        '-- ============================================================\n'
        '-- %s -- SNIMKA STVARNE SHEME, generirano alatom\n'
        '-- ============================================================\n'
        '-- Generirao: data-prep_tools/Tools/dump_schema.py --env %s\n'
        '-- Vrijeme:   %s\n'
        '--\n'
        '-- ⚠ OVO SE NE PUSTA I NE URE\u0110UJE RUKOM. Ovo je ono sto u bazi\n'
        '--   STVARNO STOJI, ne ono sto smo mislili da smo pustili. Promjene\n'
        '--   idu kroz numerirane migracije (`sql/0NN_*.sql`), pa se ovaj file\n'
        '--   regenerira -- i `git diff` pokaze je li migracija ucinila ono sto\n'
        '--   je obecala.\n'
        '--\n'
        '-- ⚠ TEST I PROD NISU ISTA BAZA. Usporedi ih diffom prije nego\n'
        '--   zakljucis da je nesto provjereno na TEST-u provjereno i za PROD.\n'
        '-- ============================================================\n\n'
        % (out_path.name, which, datetime.now().astimezone().isoformat(timespec='seconds'))
    )
    out_path.write_text(header + body, encoding='utf-8')

    pol = body.count('CREATE POLICY')
    trg = body.count('CREATE TRIGGER')
    fun = body.count('CREATE FUNCTION')
    tab = body.count('CREATE TABLE')
    print('[OK] %s  (%.0f KB)' % (out_path, out_path.stat().st_size / 1024))
    print('     %d tablica, %d politika, %d triggera, %d funkcija' % (tab, pol, trg, fun))
    return out_path


def main():
    ap = argparse.ArgumentParser(description='Snimka sheme baze u sql/.')
    ap.add_argument('--env', choices=['prod', 'test'], required=True)
    ap.add_argument('--diff', action='store_true',
                    help='samo usporedi s onim sto je vec u gitu, bez pisanja')
    args = ap.parse_args()

    out = ROOT / 'sql' / ('SCHEMA_%s.sql' % args.env.upper())
    if args.diff and out.exists():
        import difflib
        import tempfile
        tmp = Path(tempfile.mkdtemp()) / out.name
        dump(args.env, tmp)
        old = [l for l in out.read_text(encoding='utf-8').splitlines()
               if not l.startswith('-- Vrijeme:')]
        new = [l for l in tmp.read_text(encoding='utf-8').splitlines()
               if not l.startswith('-- Vrijeme:')]
        diff = list(difflib.unified_diff(old, new, 'u gitu', 'u bazi', lineterm='', n=2))
        if not diff:
            print('\n[OK] Shema u bazi je ista kao ona u gitu.')
        else:
            print('\n[!] RAZLIKA -- baza i git se ne slazu (%d redaka):\n' % len(diff))
            print('\n'.join(diff[:200]))
        return
    dump(args.env, out)


if __name__ == '__main__':
    main()
