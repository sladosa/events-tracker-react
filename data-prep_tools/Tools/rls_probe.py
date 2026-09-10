# -*- coding: utf-8 -*-
"""
rls_probe.py -- sto RLS STVARNO dopusta, po ulozi. S134.

ZASTO
  Prava su se tri sesije zaredom zakljucivala citanjem migracija i svaki put
  je bilo krivo (S118, S133, S134). `sql/SCHEMA_PROD.sql` sada pokazuje sto
  politike PISU; ovaj alat pokazuje sto one RADE. To nije isto: na jednoj
  operaciji stoji 3-5 permissive politika koje se OR-aju, pa se iz pojedinacnog
  izraza ne moze procitati ishod.

  Sluzi kao mjera PRIJE i POSLIJE migracije. Migracija koja mijenja RLS bez
  ovog ispisa s obje strane je nagadjanje.

KAKO -- i zasto je sigurno
  Svaka proba je VLASTITA TRANSAKCIJA koja zavrsava `ROLLBACK`. Nista se ne
  upisuje, ni na PROD-u. Uloga se glumi kako to radi i PostgREST:
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claims', '{"sub":"<uuid>",...}', true);
  pa `auth.uid()` vrati zeljenog korisnika. (Provjereno: vraca tocan uuid.)

  ⚠ Zasebna transakcija po probi, ne savepoint: prva greska ABORTA transakciju,
    pa bi sve poslije nje javljalo "current transaction is aborted" -- dakle
    ispis pun lazi koji izgleda kao rezultat.

⚠ KAKO SE CITA ISHOD -- ovdje je lako pogrijesiti
  RLS-blokiran UPDATE/DELETE **NE BACA GRESKU** nego pogodi 0 redaka. Zato:
      0 redaka, bez greske      -> RLS JE BLOKIRAO
      >0 redaka                 -> RLS JE PUSTIO
      greska "row-level security" -> blokirao (WITH CHECK, na INSERT/UPDATE)
      druga greska (FK, trigger, NOT NULL) -> PUSTIO, pao je na necem drugom
  Zadnji red je bitan: `prevent_category_deletion` i FK-ovi pucaju TEK ako je
  RLS propustio, pa je njihova greska dokaz propusnosti, ne zabrane.

⚠ INSERT SE MJERI BEZ `RETURNING`. S njim Postgres trazi i SELECT pravo na novi
  redak, pa politika koja INSERT propusta izgleda kao da ga brani -- upravo je
  ta zabuna S134 skoro sakrila otvorenu rupu (supabase-js salje
  `Prefer: return=representation`, sto je isto to).

Upotreba:
    Tools\\run.bat Tools\\rls_probe.py --env prod
    Tools\\run.bat Tools\\rls_probe.py --env test
    Tools\\run.bat Tools\\rls_probe.py --env prod --sql   (samo ispisi SQL)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:  # noqa: BLE001
        pass

PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'


def load_env(which):
    fn = '.env.prod.local' if which == 'prod' else '.env.local'
    env = {}
    for line in (ROOT / fn).read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    db = env.get('SUPABASE_DB_URL')
    if not (url and key and db):
        sys.exit(fn + ' treba SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i SUPABASE_DB_URL.')
    return url, key, db


def rest(url, key, path):
    req = urllib.request.Request(url + '/rest/v1/' + path,
                                 headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    return json.load(urllib.request.urlopen(req))


def pick_scene(url, key):
    """Nadji stvarnu Areu koja ima vlasnika, write-grantee-a i podatke.
    Uloge se glume nad ISTIM retcima -- inace se usporedjuju razlicite stvari."""
    shares = rest(url, key, 'data_shares?select=target_id,owner_id,grantee_id,permission'
                            '&share_type=eq.area&permission=eq.write')
    if not shares:
        sys.exit('Nema nijednog write-sharea -- nema sto mjeriti za tu ulogu.')
    sh = shares[0]
    area = rest(url, key, 'areas?select=id,name,user_id&id=eq.' + sh['target_id'])[0]
    cats = rest(url, key, 'categories?select=id,name,user_id&area_id=eq.' + area['id'] + '&limit=1')
    if not cats:
        sys.exit('Area "%s" nema nijednu kategoriju.' % area['name'])
    cat = cats[0]
    defs = rest(url, key, 'attribute_definitions?select=id,name&category_id=eq.' + cat['id'] + '&limit=1')
    ev_owner = rest(url, key, 'events?select=id,user_id&category_id=eq.' + cat['id']
                    + '&user_id=eq.' + area['user_id'] + '&limit=1')
    users = {u['id']: (u.get('email') or '') for u in
             json.load(urllib.request.urlopen(urllib.request.Request(
                 url + '/auth/v1/admin/users?per_page=200',
                 headers={'apikey': key, 'Authorization': 'Bearer ' + key})))['users']}
    # ⚠ Template user NE SMIJE glumiti stranca: njegove Aree citaju svi, pa nosi
    #   vlastite grane u SELECT politikama. Mjerenje s njim izgleda uredno i
    #   opisuje krivu ulogu.
    tmpl = os.environ.get('_ET_TEMPLATE_UID', '')
    stranac = next((uid for uid in users
                    if uid not in (area['user_id'], sh['grantee_id'], tmpl)), None)
    return {
        'area': area, 'cat': cat,
        'attr': defs[0] if defs else None,
        'event_owner': ev_owner[0] if ev_owner else None,
        'roles': [
            ('vlasnik Aree',  area['user_id'],     users.get(area['user_id'], '')),
            ('write grantee', sh['grantee_id'],    users.get(sh['grantee_id'], '')),
            ('stranac',       stranac,             users.get(stranac, '')),
        ],
    }


def probes(sc):
    """(tablica, operacija, SQL). Bez RETURNING -- v. zaglavlje."""
    a, c = sc['area']['id'], sc['cat']['id']
    d = sc['attr']['id'] if sc['attr'] else None
    e = sc['event_owner']['id'] if sc['event_owner'] else None
    out = [
        ('areas', 'SELECT', "SELECT count(*) FROM public.areas WHERE id='%s'" % a),
        ('areas', 'UPDATE settings',
         "UPDATE public.areas SET settings = coalesce(settings,'{}'::jsonb) WHERE id='%s'" % a),
        ('areas', 'DELETE', "DELETE FROM public.areas WHERE id='%s'" % a),
        ('categories', 'SELECT', "SELECT count(*) FROM public.categories WHERE id='%s'" % c),
        ('categories', 'INSERT u tu Areu',
         "INSERT INTO public.categories (area_id,name,slug,level,sort_order,user_id) "
         "VALUES ('%s','ZZZ_PROBE','zzz-probe',1,999,auth.uid())" % a),
        ('categories', 'UPDATE (rename)',
         "UPDATE public.categories SET name=name WHERE id='%s'" % c),
        ('categories', 'DELETE', "DELETE FROM public.categories WHERE id='%s'" % c),
    ]
    if d:
        out += [
            ('attribute_definitions', 'SELECT',
             "SELECT count(*) FROM public.attribute_definitions WHERE id='%s'" % d),
            ('attribute_definitions', 'INSERT',
             "INSERT INTO public.attribute_definitions (category_id,name,slug,data_type,sort_order,user_id) "
             "VALUES ('%s','ZZZ_PROBE','zzz_probe','text',999,auth.uid())" % c),
            ('attribute_definitions', 'UPDATE',
             "UPDATE public.attribute_definitions SET name=name WHERE id='%s'" % d),
            ('attribute_definitions', 'DELETE',
             "DELETE FROM public.attribute_definitions WHERE id='%s'" % d),
        ]
    if e:
        out += [
            ('events', 'SELECT tudji',
             "SELECT count(*) FROM public.events WHERE id='%s'" % e),
            ('events', 'INSERT svoj',
             "INSERT INTO public.events (category_id,user_id,event_date,session_start) "
             "VALUES ('%s',auth.uid(),current_date,now())" % c),
            ('events', 'UPDATE tudji',
             "UPDATE public.events SET comment=comment WHERE id='%s'" % e),
            ('events', 'DELETE tudji',
             "DELETE FROM public.events WHERE id='%s'" % e),
        ]
    return out


def build_sql(sc):
    # ⚠ BEZ tihog nacina: psql s `-q` / `QUIET` ne ispisuje status naredbe
    #   (`UPDATE 1`), pa bi svaka write proba ostala neprocitana -- a to izgleda
    #   isto kao "nema odgovora", ne kao "nismo pitali".
    lines = ['\\set ON_ERROR_STOP 0', "\\pset tuples_only on"]
    for role, uid, _ in sc['roles']:
        if not uid:
            continue
        claims = json.dumps({'sub': uid, 'role': 'authenticated'})
        for tab, op, sql in probes(sc):
            lines += [
                '\\echo #PROBE|%s|%s|%s' % (role, tab, op),
                'BEGIN;',
                'SET LOCAL ROLE authenticated;',
                "SELECT set_config('request.jwt.claims', '%s', true);" % claims,
                sql + ';',
                'ROLLBACK;',
            ]
    return '\n'.join(lines) + '\n'


def read_result(chunk):
    """v. zaglavlje: 0 redaka bez greske = BLOKIRAO."""
    # `SELECT set_config(...)` vrati postavljene claimove i ispise ih -- to nije
    # rezultat probe nego njezina priprema; bez ovoga parser cita nju.
    chunk = '\n'.join(l for l in chunk.splitlines() if '"sub"' not in l)
    err = re.search(r'ERROR:\s*(.+)', chunk)
    if err:
        msg = err.group(1).strip()
        if 'row-level security' in msg:
            return 'NE', 'RLS odbio (WITH CHECK)'
        return 'DA*', 'proslo RLS, palo na: ' + msg[:58]
    m = re.search(r'\b(INSERT 0|UPDATE|DELETE)\s+(\d+)', chunk)
    if m:
        n = int(m.group(2))
        return ('DA', '%s redaka' % n) if n else ('NE', '0 redaka, bez greske')
    m = re.search(r'^\s*(\d+)\s*$', chunk, re.M)
    if m:
        n = int(m.group(1))
        return ('DA', 'vidi %d' % n) if n else ('NE', 'ne vidi')
    return '?', chunk.strip()[:60].replace('\n', ' ')


def main():
    ap = argparse.ArgumentParser(description='Sto RLS stvarno dopusta, po ulozi.')
    ap.add_argument('--env', choices=['prod', 'test'], required=True)
    ap.add_argument('--sql', action='store_true', help='samo ispisi SQL, ne pokreci')
    args = ap.parse_args()

    url, key, db = load_env(args.env)
    # template uid ide kroz okolinu jer `pick_scene` prima samo url/key
    fn = '.env.prod.local' if args.env == 'prod' else '.env.local'
    for line in (ROOT / fn).read_text(encoding='utf-8').splitlines():
        if line.startswith('VITE_TEMPLATE_USER_ID='):
            os.environ['_ET_TEMPLATE_UID'] = line.split('=', 1)[1].strip()
    sc = pick_scene(url, key)
    print('Baza      : %s (%s)' % (url.split('//')[1].split('.')[0], args.env.upper()))
    print('Area      : %s' % sc['area']['name'])
    print('Kategorija: %s' % sc['cat']['name'])
    print('Uloge     :')
    for r, uid, email in sc['roles']:
        print('    %-14s %s  %s' % (r, (uid or '-')[:8], email))
    print('\n⚠ Svaka proba je vlastita transakcija koja zavrsava ROLLBACK-om.\n')

    sql = build_sql(sc)
    if args.sql:
        print(sql)
        return

    env = dict(os.environ)
    # ⚠ stderr MORA ici u isti stream kao stdout. psql greske pise na stderr, a
    #   markere `#PROBE|` na stdout; spoje li se tek na kraju, SVAKA greska
    #   zavrsi u posljednjem chunku -- dakle pripise se krivoj probi, i to
    #   uvjerljivo. (Izmjereno: TEST je tako "pokazao" da stranac smije obrisati
    #   tudji event, a poruka je zapravo pripadala `areas DELETE` probi.)
    res = subprocess.run([PSQL, db, '-X', '-f', '-'], input=sql,
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, encoding='utf-8', env=env)
    raw = res.stdout or ''
    parts = raw.split('#PROBE|')[1:]
    if not parts:
        sys.exit('psql nije vratio nijednu probu:\n' + raw[:800])

    cur = None
    for part in parts:
        head, _, body = part.partition('\n')
        role, tab, op = head.split('|')
        if role != cur:
            print('\n=== %s ===' % role.upper())
            print('    %-22s %-18s %-4s %s' % ('tablica', 'operacija', 'smije', 'dokaz'))
            cur = role
        smije, dokaz = read_result(body)
        print('    %-22s %-18s %-4s %s' % (tab, op, smije, dokaz))
    print('\nDA*  = RLS je PROPUSTIO; zaustavio ga je FK/trigger/constraint, ne prava.')


if __name__ == '__main__':
    main()
