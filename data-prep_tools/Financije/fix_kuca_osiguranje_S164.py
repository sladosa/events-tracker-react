# -*- coding: utf-8 -*-
"""Jednokratno (S164, R3 iz `docs/RAZREZ_SPEC.md` §4.4): osiguranje kuće u vlastiti Podtip.

`Kuca / Popravci, odrzavanje, osiguranje` ima 133 retka, a osiguranje su samo 5
(polica jednom godisnje + naknada 0,17). Plocica „Kamo ide novac" stavlja osiguranja
u bucket „Povremeno nuzno", a popravke/opremu u „Kuca investicije" -- dok su u
istom Podtipu, to se ne moze izraziti.

STO RADI
  1. opciji Podtipa pod `Kuca` doda `Osiguranje` (ako je vec nema)
  2. pet redaka prebaci na `Podtip = Osiguranje`

  Stari Podtip se NE preimenuje: preimenovanje opcije ostavlja stari tekst na
  128 redaka (`KLASIFIKACIJA_ODRZAVANJE_SPEC.md`). To ide u odrzavanje.

SIGURNOST
  - zadano je DRY RUN; upisuje tek `--apply`
  - baza iz `ET_TARGET` (bez njega TEST); PROD trazi i `--yes-prod`
  - cilja se po `event_id`, nikad po opisu. TEST je kopija PROD-a s ISTIM
    event ID-evima (`prod_to_test.py`), pa isti popis vrijedi za obje baze.
  - redak koji vise nije `Kuca / Popravci, odrzavanje, osiguranje` se NE dira
    (prijavi se) -- netko ga je u medjuvremenu promijenio
  - `validation_rules` se mijenja na SIROVOM pravilu, samo jedan popis
    (CLAUDE.md S152: nikad iz parsiranog oblika)
  - poslije upisa se PONOVO CITA iz baze; RLS/greska vraca 200 i nula redaka,
    pa se uspjeh mjeri stanjem u bazi, ne statusom
  - prije `--apply` na PROD: `Tools\\run.bat Tools\\backup_db.py --env prod`

  /!\\ Na PROD-u je struktura Kokina (S133). Opciju dodaje alat service kljucem
      -- dogovoriti s Kokom prije pokretanja.

Pokretanje (PowerShell):
  Financije\\run.bat fix_kuca_osiguranje_S164.py                  TEST, dry run
  Financije\\run.bat fix_kuca_osiguranje_S164.py --apply          TEST, upis
  $env:ET_TARGET='prod'; Financije\\run.bat fix_kuca_osiguranje_S164.py --apply --yes-prod
"""
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest, target                           # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

APPLY = '--apply' in sys.argv
TIP, OLD, NEW = 'Kuća', 'Popravci, održavanje, osiguranje', 'Osiguranje'

# event_id -> sto je (za ispis); izmjereno S164 na TEST = PROD od 07.10.2026.
ROWS = {
    'ded117e9-decf-4fad-96e2-8d35b38263f5': '21.03.2023. Generali 402,75',
    '8ead613e-1f27-4bad-a557-2bc990f93437': '02.04.2024. Allianz kuća 418,76',
    '8a952187-bd6e-4119-aa1d-9b9277dfd6e5': '27.03.2025. Osiguranje za kuću 418,76',
    'ae5706d3-38f4-4095-b9f0-d300c116c565': '19.03.2026. Generali police (polica ili naknada)',
    'b2edd120-c320-4626-8c62-9abb44a0ae5f': '19.03.2026. Generali police (polica ili naknada)',
}


def main():
    env = target()
    if env == 'prod' and APPLY and '--yes-prod' not in sys.argv:
        sys.exit('✗ PROD upis traži i --yes-prod (i backup prije: Tools\\run.bat Tools\\backup_db.py --env prod).')
    url, key = load_env(env)
    h = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=h,
                                   data=json.dumps(body).encode() if body is not None else None)
        with urllib.request.urlopen(r) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else []

    print(f'[{env.upper()}] {url}  {"APPLY" if APPLY else "DRY RUN"}\n')
    areas = rest(url, key, 'areas?name=eq.Financije_all&select=id')
    if len(areas) != 1:
        sys.exit(f'✗ Area Financije_all: nađeno {len(areas)}.')
    defs = {d['slug']: d for d in rest(url, key, 'attribute_definitions?select=id,slug,validation_rules,'
                                       'categories!inner(area_id)&categories.area_id=eq.' + areas[0]['id'])}
    tip_id, pod = defs['tip']['id'], defs['podtip']

    # 1. opcija
    rules = pod['validation_rules']
    opts = rules['depends_on']['options_map'][TIP]
    need_opt = NEW not in opts
    print(f'1. Opcije Podtipa pod {TIP}: {opts}')
    print(f'   ⇒ {"dodati " + NEW if need_opt else NEW + " već postoji"}\n')

    # 2. retci
    attrs = rest(url, key, 'event_attributes?select=id,event_id,attribute_definition_id,value_text'
                 '&event_id=in.(' + ','.join(ROWS) + ')'
                 '&attribute_definition_id=in.(' + tip_id + ',' + pod['id'] + ')')
    todo = []
    print('2. Retci:')
    for eid, label in ROWS.items():
        t = next((a for a in attrs if a['event_id'] == eid and a['attribute_definition_id'] == tip_id), None)
        p = next((a for a in attrs if a['event_id'] == eid and a['attribute_definition_id'] == pod['id']), None)
        cur = f"{t['value_text'] if t else '∅'} / {p['value_text'] if p else '∅'}"
        if t and p and t['value_text'] == TIP and p['value_text'] == OLD:
            todo.append(p['id'])
            print(f'   ✓ {label:<52} {cur}  →  {TIP} / {NEW}')
        elif t and p and t['value_text'] == TIP and p['value_text'] == NEW:
            print(f'   = {label:<52} već {NEW}')
        else:
            print(f'   ✗ {label:<52} {cur}  — NE DIRAM (redak ne postoji ili je promijenjen)')
    print(f'\n   za promjenu: {len(todo)} od {len(ROWS)}')

    if not APPLY:
        print('\nDry run. Za upis: --apply' + (' --yes-prod' if env == 'prod' else ''))
        return
    if need_opt:
        new_rules = json.loads(json.dumps(rules))
        new_rules['depends_on']['options_map'][TIP] = opts + [NEW]
        got = req('PATCH', 'attribute_definitions?id=eq.' + pod['id'], {'validation_rules': new_rules})
        if len(got) != 1:
            sys.exit('✗ validation_rules nije upisan (0 redaka) — ništa drugo nije dirano.')
    for aid in todo:
        got = req('PATCH', 'event_attributes?id=eq.' + aid, {'value_text': NEW})
        if len(got) != 1:
            sys.exit(f'✗ event_attributes {aid}: upisano {len(got)} redaka.')

    # provjera iz baze
    pod2 = rest(url, key, 'attribute_definitions?select=id,validation_rules&id=eq.' + pod['id'])[0]
    ok_opt = NEW in pod2['validation_rules']['depends_on']['options_map'][TIP]
    n_new = len(rest(url, key, 'event_attributes?select=id&attribute_definition_id=eq.' + pod['id']
                     + '&value_text=eq.' + NEW + '&event_id=in.(' + ','.join(ROWS) + ')'))
    print(f'\nU bazi: opcija {NEW} {"✓" if ok_opt else "✗"} · retci s {NEW}: {n_new} od {len(ROWS)} '
          f'{"✓" if n_new == len(ROWS) else "✗"}')


if __name__ == '__main__':
    main()
