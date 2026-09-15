# -*- coding: utf-8 -*-
"""Jednokratno: `Tip`/`Podtip` za neklasificirane retke MC kosare 11.09.2026.

Nastalo u S137. Kosara ima 48 redaka i zatvara se s izvodom u cent
(`uskladi_izvod.py --izvod MC_2026-08.pdf`), ali **16 ih nema `Tip`**.

ODAKLE VRIJEDNOSTI
  Trinaest je prebrojano iz povijesti iste Aree (jednoglasno), tri je odlucio
  Sasa. Nista se ne pogadja: kljuc bez jednoglasnog presedana ovdje ne postoji
  -- za njega je covjek dao odgovor, ili redak ostaje `N/A`.

  /!\ `PAYPAL *BANDIFY BANDIF` NAMJERNO NIJE U POPISU -- ceka Kokin odgovor.
      Prazno je posteno stanje; pogodjen `Tip` izgleda isto kao izmjeren.

  /!\ `AUDIBLE` je razrijesen DRUGOM RAZINOM. Po trgovcu je 51:13 za
      `Audible_Sasa` -- ispod praga; kartica ne pomaze (svih 64 su Mastercard).
      Iznos pomaze: Kokini su 2,55-8,99, Sasini 13,57-18,65, redak je 16,82.

  /!\ `MIELE` je masina za pranje vesa, a `Domacinstvo` ima samo tri Podtipa
      (`Kave/jelo vani`, `Bankovni troskovi`, `Hrana i ostalo`) -- `Hrana i
      ostalo` je kolektivni, ne promasaj. Redak je RATA 1/3, pa ova odluka
      postaje presedan za 2/3 i 3/3.

SIGURNOST
  - zadano je DRY RUN; upisuje tek `--apply`
  - backup prije ijedne promjene
  - cilja se po `event_id`, nikad po opisu -- dva retka znaju imati isti opis
  - dira SAMO retke kojima je `Tip` prazan ili `N/A` (nikad vec klasificirane)
  - poslije upisa se PONOVO CITA iz baze i usporedjuje; RLS-blokiran write
    vraca 200 i nula redaka, pa se uspjeh mjeri brojem redaka, ne statusom
"""
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest                                    # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

AREA = 'de8662e6-54f7-4ded-ab42-a786e7456067'
DUE = '2026-09-11'
APPLY = '--apply' in sys.argv

# kljuc iz `Izvod opis`  ->  (Tip, Podtip, odakle vrijednost dolazi)
PLAN = {
    'PAYPAL *DM HRVATSKA':    ('Domaćinstvo', 'Hrana i ostalo',    'povijest 2/2'),
    'PRIME VIDEO RENT / BUY': ('Zabava',           'Prime',             'povijest 2/2'),
    'DM PM 192':              ('Domaćinstvo', 'Hrana i ostalo',    'povijest 2/2'),
    'AUDIBLE':                ('Zabava',           'Audible_Sasa',      'iznosni pojas'),
    'KONZUM':                 ('Domaćinstvo', 'Hrana i ostalo',    'povijest 134/134'),
    'SPAR':                   ('Domaćinstvo', 'Hrana i ostalo',    'povijest 5/5'),
    'LUFTHAN':                ('Putovanja',        'Karte, osiguranje', 'povijest 2/2'),
    'PAYPAL *AC WALKFT':      ('Zdravlje',         'Sport_Koka',        'Sasina odluka S137'),
    'MIELE TRGOVINA I SERVI': ('Domaćinstvo', 'Hrana i ostalo',    'Sasina odluka S137'),
}
# kljucevi koji se traze kao PREFIKS -- ime trgovca nosi zalijepljene znamenke
# (`SPAR87017`, `LUFTHAN2202242474447`, `AUDIBLE*M842778Y3`, `KONZUM P-3208`)
PREFIX = ('AUDIBLE', 'KONZUM', 'SPAR', 'LUFTHAN')


def match(opis):
    o = (opis or '').upper()
    for k in PLAN:
        if k in PREFIX:
            if o.startswith(k):
                return k
        elif o.split(' RATA ')[0].strip().upper() == k:
            return k
    return None


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    cats = rest(url, key, 'categories?select=id,name&area_id=eq.' + AREA)
    leaf = {c['name']: c['id'] for c in cats}['Transakcija']
    defs = rest(url, key, 'attribute_definitions?select=id,slug,name&category_id=eq.' + leaf)
    sid = {d['slug']: d['id'] for d in defs}
    sl = {d['id']: d['slug'] for d in defs}

    ev = {e['id']: e for e in rest(
        url, key, 'events?select=id,event_date,comment,user_id&category_id=eq.' + leaf)}
    at = rest(url, key, 'event_attributes?select=id,event_id,attribute_definition_id,'
                        'value_text,value_number,value_datetime')
    cur, arow = {}, {}
    for a in at:
        s = sl.get(a['attribute_definition_id'])
        if not s:
            continue
        v = a['value_text']
        v = a['value_number'] if v is None else v
        v = a['value_datetime'] if v is None else v
        cur.setdefault(a['event_id'], {})[s] = v
        arow.setdefault(a['event_id'], {})[s] = a['id']

    todo, skipped = [], []
    for eid, e in ev.items():
        c = cur.get(eid, {})
        if not str(c.get('datum_naplate') or '').startswith(DUE):
            continue
        if (c.get('tip') or 'N/A') != 'N/A':
            continue                      # nikad ne diramo vec klasificirano
        k = match(c.get('izvod_opis'))
        (todo.append((eid, e, c, k)) if k else skipped.append(e))

    print('=' * 96)
    print('TIP/PODTIP za kosaru ' + DUE + '   ' + ('[APPLY]' if APPLY else '[DRY RUN]'))
    print('=' * 96)
    print('%-12s %-28s %8s  %-14s %-20s %s'
          % ('datum', 'opis', 'iznos', 'Tip', 'Podtip', 'odakle'))
    for eid, e, c, k in sorted(todo, key=lambda x: x[1]['event_date']):
        t, p, why = PLAN[k]
        print('%-12s %-28s %8s  %-14s %-20s %s'
              % (e['event_date'], (e.get('comment') or '')[:28], c.get('isplata'), t, p, why))
    print()
    print('za promjenu: %d redaka' % len(todo))

    if skipped:
        print()
        print('OSTAJU `N/A` (nema odluke) -- %d:' % len(skipped))
        for e in sorted(skipped, key=lambda x: x['event_date']):
            print('   %-12s %s' % (e['event_date'], (e.get('comment') or '')[:40]))

    if not APPLY:
        print()
        print('DRY RUN -- nista nije promijenjeno. Za upis: --apply')
        return

    # /!\ Isto mjesto gdje pise `primijeni_uskladu.py`. Prva verzija je pisala
    #     u `Financije/`, a kucni alat u `_arhiva/` -- oboje zavrsi na D: preko
    #     `backup_to_external.bat` (/E), pa se kvar ne bi vidio; vidio bi ga tek
    #     covjek koji za pola godine trazi backup na dva mjesta.
    bakdir = Path(__file__).resolve().parents[2] / 'data-prep_data' / 'Financije' / '_arhiva'
    bakdir.mkdir(parents=True, exist_ok=True)
    bak = bakdir / ('backup_tip_podtip_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.json')
    ids = {x[0] for x in todo}
    bak.write_text(json.dumps(
        {'events': [e for _, e, _, _ in todo],
         'attributes': [a for a in at if a['event_id'] in ids]},
        ensure_ascii=False, indent=1), encoding='utf-8')
    print()
    print('backup: ' + bak.name)

    changed = 0
    for eid, e, c, k in todo:
        t, p, _ = PLAN[k]
        for slug, val in (('tip', t), ('podtip', p)):
            existing = arow.get(eid, {}).get(slug)
            if existing:
                got = req('PATCH', 'event_attributes?id=eq.' + existing, {'value_text': val})
            else:
                got = req('POST', 'event_attributes',
                          {'event_id': eid, 'attribute_definition_id': sid[slug],
                           'user_id': e['user_id'], 'value_text': val})
            # /!\ RLS-blokiran write vraca 200 i PRAZAN rezultat -- uspjeh se
            #     mjeri brojem redaka, nikad HTTP statusom (CLAUDE.md, S123).
            if not got:
                sys.exit('STOP: upis nije pogodio nijedan redak (' + slug + ', ' + eid + ')')
            changed += 1

    # ponovno citanje iz baze -- dokaz, ne nada
    at2 = rest(url, key, 'event_attributes?select=event_id,attribute_definition_id,value_text')
    now = {}
    for a in at2:
        s = sl.get(a['attribute_definition_id'])
        if s in ('tip', 'podtip'):
            now.setdefault(a['event_id'], {})[s] = a['value_text']
    bad = [eid for eid, _, _, k in todo
           if (now.get(eid, {}).get('tip'), now.get(eid, {}).get('podtip'))
           != (PLAN[k][0], PLAN[k][1])]
    print('upisano polja: %d   ·   provjera nakon citanja: %s'
          % (changed, 'SVE SE SLAZE' if not bad else ('NE SLAZE SE %d' % len(bad))))
    if bad:
        sys.exit('STOP: ' + str(len(bad)) + ' redaka nije onako kako je trebalo biti')


main()
