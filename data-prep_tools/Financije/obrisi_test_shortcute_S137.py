# -*- coding: utf-8 -*-
"""Jednokratno: brise DVA Kokina test-shortcuta na leafu `Transakcija`.

ZASTO
  Oba su nastala kao **proba prefilla** (Sasin nalaz S137), nisu upotrijebljena
  (`usage_count = 0`, `last_used = NULL`) i zajedno rade dvije stete:

  1. /!\ ZAMRZNUTA IZVEDENA VRIJEDNOST. `Isplata` nosi
     `Datum naplate = 2026-10-11`, snimljen 02.09. -- prije S127 popravka.
     Danas je neutralan jer `collectRuleManagedIds` preskace svaki atribut
     koji je `target_slug` nekog `set_attribute` pravila. Ali to je ZASTITA
     KROZ POSREDNIKA: preimenuje li se slug `datum_naplate` ili se makne
     pravilo, vrijednost OZIVI -- i to tiho. (Razred `T-S107u-2`: „bezopasno"
     vrijedi dok nitko ne cita, i prestaje bez ijedne poruke.)

  2. /!\ DVOZNACAN AUTO-ODABIR. Oba su vezana na ISTI leaf, pa je Koka imala
     dva preseta koja se natjecu. Auto-odabir je do S137 bio `.find()`, dakle
     prvi u nizu sortiranom po `usage_count desc, last_used desc` -- a oba su
     `0` i `NULL`, dakle izjednaceni bez tiebreaka. Koji ce joj preset tiho
     napuniti formu moglo se mijenjati izmedu ucitavanja: jednom
     `Racun = Kokin tekuci ZABA`, drugi put `Racun = Sasin tekuci RF` uz
     `Isplata = 11`. Popravljeno je i u kodu (auto-odabir samo kad je
     poklapanje jednoznacno), ali brisanje uklanja sam povod.

/!\ OVO JE KOKIN ZAPIS. Brise se na Sasinu izricitu odluku (S137), jer su
    obje snimke njegove probe prefilla. Prave shortcute radi ona, kad se zna
    sto joj treba.

SIGURNOST
  - zadano je DRY RUN; brise tek `--apply`
  - backup CIJELOG retka (ukljucujuci `default_attributes`) prije brisanja
  - brise po `id`, nikad po imenu -- ime nije jedinstveno medu korisnicima
  - staje ako redak nije onakav kakvim ga je alat zatekao (ime, vlasnik,
    `usage_count = 0`) => netko ga je u medjuvremenu pocelo koristiti
  - poslije brisanja PONOVO CITA i broji; RLS-blokiran DELETE „uspije"
    s 0 redaka (CLAUDE.md), pa se mjeri broj, ne HTTP status
"""
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest                                    # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

APPLY = '--apply' in sys.argv
KOKA = 'dubravka.pavic-sladoljev@dps-perceptum.com'

# (id, ocekivano ime) -- id je autoritet, ime je samo provjera da nismo promasili
META = [
    ('ae04685d-4417-4e3b-aa6a-60ef68022c75', 'Isplata'),
    ('0110e58c-105a-4a2a-ad5f-fc01880c3f9a', 'RF Bankovna naknada'),
]


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H)
        return json.load(urllib.request.urlopen(r))

    rows = {p['id']: p for p in rest(url, key, 'activity_presets?select=*')}

    print('=' * 92)
    print('BRISANJE TEST-SHORTCUTA   ' + ('[APPLY]' if APPLY else '[DRY RUN]'))
    print('=' * 92)

    todo = []
    for pid, name in META:
        r = rows.get(pid)
        if r is None:
            print('  %-24s vec ne postoji -- preskacem' % name)
            continue
        # /!\ Staje umjesto da „popravi": redak koji se ne poklapa s ocekivanjem
        #     je redak o kojem ovaj alat nista ne zna.
        if r['name'] != name:
            sys.exit('STOP: %s se zove "%s", ocekivano "%s"' % (pid[:8], r['name'], name))
        if (r.get('usage_count') or 0) != 0 or r.get('last_used'):
            sys.exit('STOP: "%s" je u medjuvremenu koristen (%sx, %s) -- vise nije proba'
                     % (name, r.get('usage_count'), r.get('last_used')))
        da = r.get('default_attributes') or {}
        print('  %-24s  %d vrijednosti  ·  %sx  ·  vlasnik %s'
              % (name, len(da), r.get('usage_count'), str(r.get('user_id'))[:8]))
        todo.append(r)

    print()
    print('za brisanje: %d' % len(todo))
    if not todo:
        return
    if not APPLY:
        print()
        print('DRY RUN -- nista nije obrisano. Za brisanje: --apply')
        return

    bakdir = Path(__file__).resolve().parents[2] / 'data-prep_data' / 'Financije' / '_arhiva'
    bakdir.mkdir(parents=True, exist_ok=True)
    bak = bakdir / ('backup_shortcuts_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.json')
    bak.write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding='utf-8')
    print()
    print('backup: ' + bak.name + '   (cijeli redak, pa se da vratiti POST-om)')

    for r in todo:
        got = req('DELETE', 'activity_presets?id=eq.' + r['id'])
        # /!\ RLS-blokiran DELETE vraca 200 i PRAZAN rezultat -- mjeri se broj
        #     redaka, nikad HTTP status (CLAUDE.md).
        if not got:
            sys.exit('STOP: brisanje nije pogodilo nijedan redak (' + r['name'] + ')')
        print('  obrisan: ' + r['name'])

    left = [p['id'] for p in rest(url, key, 'activity_presets?select=id')]
    bad = [r['name'] for r in todo if r['id'] in left]
    print()
    print('provjera nakon citanja: %s' % ('SVE OBRISANO' if not bad else 'OSTALO: ' + ', '.join(bad)))
    if bad:
        sys.exit('STOP: brisanje nije proslo do kraja')

    # koliko je presetova ostalo po leafu -- dvoznacnost je bila sam povod
    ps = rest(url, key, 'activity_presets?select=name,category_id,user_id')
    from collections import Counter
    c = Counter((p['user_id'], p['category_id']) for p in ps)
    dv = [k for k, v in c.items() if v > 1]
    print('presetova ukupno: %d   ·   parova (korisnik, kategorija) s VISE od jednog: %d'
          % (len(ps), len(dv)))


main()
