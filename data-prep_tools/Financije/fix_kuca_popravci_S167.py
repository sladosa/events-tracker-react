# -*- coding: utf-8 -*-
"""Jednokratno (S167): `Kuca / Popravci, odrzavanje, osiguranje` -> `Kuca / Popravci, odrzavanje`.

Nastavak R3 (`fix_kuca_osiguranje_S164.py`, PROD 11.10.2026.): osiguranje je dobilo
vlastiti Podtip, pa `…, osiguranje` u imenu starog Podtipa vise ne vrijedi.

ZASTO ALAT, A NE PREIMENOVANJE U UI-ju
  Structure panel preimenuje samo OPCIJU u izborniku; retci zadrze stari tekst
  (`KLASIFIKACIJA_ODRZAVANJE_SPEC.md`). Posljedice bez ijedne greske: 128 redaka
  sirocadi, razrez bi nove retke slao u „nesvrstano" (grupiranje zna stari naziv),
  a Python rjecnici bi i dalje predlagali stari naziv. Zato sve mjesto odjednom:

STO RADI
  1. opciju Podtipa pod `Kuca` preimenuje NA ISTOM MJESTU u popisu
  2. svaki redak `Tip = Kuca` + `Podtip = <stari>` u `Financije_all` -> novi naziv
  3. `areas.settings` Financije_all i `activity_presets` te Aree: svaka vrijednost
     JEDNAKA starom nazivu (cijeli string, ne podniz) -> novi (grupiranje razreza)
  Kod (`set_breakdown.py`, `visa_uvoz_izvoda.py`) je promijenjen u istom commitu.

SIGURNOST
  - zadano je DRY RUN; upisuje tek `--apply`
  - baza iz `ET_TARGET` (bez njega TEST); PROD trazi i `--yes-prod`
  - samo `Financije_all` (`Financije_old` ima istu kategoriju `Transakcija`, S144):
    retci se traze preko `attribute_definition_id` Podtipa TE Aree
  - stari naziv pod DRUGIM Tipom se ne dira, samo se prijavi
  - `validation_rules` se mijenja na SIROVOM pravilu (CLAUDE.md S152); bilo koje
    drugo pojavljivanje starog naziva u pravilima se prijavi i alat STANE
  - poslije upisa se PONOVO CITA iz baze (RLS/greska vraca 200 i 0 redaka)
  - prije `--apply` na PROD: `.\\Tools\\run.bat Tools\\backup_db.py --env prod`
  /!\\ Struktura je Kokina (S133) -- dogovoriti s njom prije PROD-a.

Pokretanje (PowerShell, iz `data-prep_tools`):
  .\\Financije\\run.bat fix_kuca_popravci_S167.py                  TEST, dry run
  .\\Financije\\run.bat fix_kuca_popravci_S167.py --apply          TEST, upis
  $env:ET_TARGET='prod'; .\\Financije\\run.bat fix_kuca_popravci_S167.py --apply --yes-prod
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest, target                           # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

APPLY = '--apply' in sys.argv
TIP, OLD, NEW = 'Kuća', 'Popravci, održavanje, osiguranje', 'Popravci, održavanje'
CHUNK = 50


def q(v):
    return urllib.parse.quote(v, safe='')


def replace_exact(node):
    """Kopija JSON stabla u kojoj je svaki string JEDNAK `OLD` zamijenjen s `NEW`.
    Vraca (novo, broj zamjena). Podniz se NE dira (komentari, opisi)."""
    if isinstance(node, str):
        return (NEW, 1) if node == OLD else (node, 0)
    if isinstance(node, list):
        out, n = [], 0
        for x in node:
            y, k = replace_exact(x)
            out.append(y)
            n += k
        return out, n
    if isinstance(node, dict):
        out, n = {}, 0
        for k_, x in node.items():
            y, k = replace_exact(x)
            out[k_] = y
            n += k
        return out, n
    return node, 0


def main():
    env = target()
    if env == 'prod' and APPLY and '--yes-prod' not in sys.argv:
        sys.exit('✗ PROD upis traži i --yes-prod (i backup prije: .\\Tools\\run.bat Tools\\backup_db.py --env prod).')
    url, key = load_env(env)
    h = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=h,
                                   data=json.dumps(body).encode() if body is not None else None)
        with urllib.request.urlopen(r) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else []

    print(f'[{env.upper()}] {url}  {"APPLY" if APPLY else "DRY RUN"}')
    print(f'   {TIP} / {OLD}  →  {TIP} / {NEW}\n')
    areas = rest(url, key, 'areas?name=eq.Financije_all&select=id,settings')
    if len(areas) != 1:
        sys.exit(f'✗ Area Financije_all: nađeno {len(areas)}.')
    area = areas[0]
    defs = rest(url, key, 'attribute_definitions?select=id,slug,validation_rules,'
                'categories!inner(area_id)&categories.area_id=eq.' + area['id'])
    by_slug = {d['slug']: d for d in defs}
    tip_id, pod = by_slug['tip']['id'], by_slug['podtip']

    # 1. opcija
    rules = pod['validation_rules']
    opts = rules['depends_on']['options_map'][TIP]
    print(f'1. Opcije Podtipa pod {TIP}: {opts}')
    if OLD in opts and NEW in opts:
        sys.exit(f'✗ U popisu su i „{OLD}" i „{NEW}" — to je spajanje, ne preimenovanje. Ne diram ništa.')
    need_opt = OLD in opts
    print(f'   ⇒ {"preimenovati na istom mjestu (" + str(opts.index(OLD) + 1) + ". od " + str(len(opts)) + ")" if need_opt else "već preimenovano" if NEW in opts else "✗ nema ni starog ni novog naziva"}')
    # bilo gdje drugdje u pravilima Aree? (default_map, drugi Tip, drugi atribut)
    stray = []
    for d in defs:
        r = d['validation_rules']
        if d['id'] == pod['id']:
            r = json.loads(json.dumps(r))
            r['depends_on']['options_map'][TIP] = [o for o in opts if o != OLD]
        if OLD in json.dumps(r, ensure_ascii=False):
            stray.append(d['slug'])
    if stray:
        sys.exit(f'✗ Stari naziv živi i drugdje u validation_rules: {stray} — alat to ne zna sigurno '
                 'preimenovati. Ne diram ništa; javi Claudeu.')
    print('   drugdje u validation_rules: nigdje ✓\n')

    # 2. retci
    pods = rest(url, key, 'event_attributes?select=id,event_id&attribute_definition_id=eq.' + pod['id']
                + '&value_text=eq.' + q(OLD))
    ev_ids = [p['event_id'] for p in pods]
    tips = {}
    for i in range(0, len(ev_ids), CHUNK):
        for t in rest(url, key, 'event_attributes?select=id,event_id,value_text&attribute_definition_id=eq.'
                      + tip_id + '&event_id=in.(' + ','.join(ev_ids[i:i + CHUNK]) + ')'):
            tips[t['event_id']] = t['value_text']
    todo = [p['id'] for p in pods if tips.get(p['event_id']) == TIP]
    other = {}
    for p in pods:
        t = tips.get(p['event_id'])
        if t != TIP:
            other[t or '∅'] = other.get(t or '∅', 0) + 1
    n_new_before = len(rest(url, key, 'event_attributes?select=id&attribute_definition_id=eq.' + pod['id']
                            + '&value_text=eq.' + q(NEW)))
    print(f'2. Retci s Podtipom „{OLD}": {len(pods)}')
    print(f'   pod Tipom {TIP}: {len(todo)}  ⇒ za promjenu')
    if other:
        print(f'   pod drugim Tipom (NE DIRAM): {other}')
    print(f'   već „{NEW}": {n_new_before}\n')

    # 3. areas.settings + shortcuti
    new_settings, n_set = replace_exact(area['settings'] or {})
    presets = rest(url, key, 'activity_presets?select=id,name,default_attributes,filter_state'
                   '&area_id=eq.' + area['id'])
    preset_todo = []
    for p in presets:
        da, k1 = replace_exact(p['default_attributes'])
        fs, k2 = replace_exact(p['filter_state'])
        if k1 + k2:
            preset_todo.append((p, da, fs, k1 + k2))
    print(f'3. areas.settings (grupiranje razreza i ostalo): {n_set} vrijednosti')
    print(f'   shortcuti Aree: {len(preset_todo)} od {len(presets)}'
          + ''.join(f'\n     · {p["name"]} ({k})' for p, _, _, k in preset_todo))

    if not APPLY:
        print('\nDry run. Za upis: --apply' + (' --yes-prod' if env == 'prod' else ''))
        return

    if need_opt:
        new_rules = json.loads(json.dumps(rules))
        new_rules['depends_on']['options_map'][TIP] = [NEW if o == OLD else o for o in opts]
        if len(req('PATCH', 'attribute_definitions?id=eq.' + pod['id'], {'validation_rules': new_rules})) != 1:
            sys.exit('✗ validation_rules nije upisan (0 redaka) — ništa drugo nije dirano.')
    done = 0
    for i in range(0, len(todo), CHUNK):
        part = todo[i:i + CHUNK]
        got = req('PATCH', 'event_attributes?id=in.(' + ','.join(part) + ')&value_text=eq.' + q(OLD),
                  {'value_text': NEW})
        done += len(got)
    if n_set:
        if len(req('PATCH', 'areas?id=eq.' + area['id'], {'settings': new_settings})) != 1:
            sys.exit('✗ areas.settings nije upisan.')
    for p, da, fs, _ in preset_todo:
        if len(req('PATCH', 'activity_presets?id=eq.' + p['id'],
                   {'default_attributes': da, 'filter_state': fs})) != 1:
            sys.exit(f'✗ shortcut {p["name"]} nije upisan.')

    # provjera iz baze
    pod2 = rest(url, key, 'attribute_definitions?select=id,validation_rules&id=eq.' + pod['id'])[0]
    opts2 = pod2['validation_rules']['depends_on']['options_map'][TIP]
    ok_opt = NEW in opts2 and OLD not in opts2
    left = rest(url, key, 'event_attributes?select=id&id=in.(' + ','.join(todo) + ')&value_text=eq.' + q(OLD)) \
        if todo else []
    n_new = len(rest(url, key, 'event_attributes?select=id&attribute_definition_id=eq.' + pod['id']
                     + '&value_text=eq.' + q(NEW)))
    want = n_new_before + len(todo)
    s2 = rest(url, key, 'areas?select=id,settings&id=eq.' + area['id'])[0]['settings']
    ok_set = OLD not in json.dumps(s2, ensure_ascii=False)
    print(f'\nU bazi: opcija {"✓" if ok_opt else "✗"} · upisano {done} · retci s „{NEW}": {n_new} od {want} '
          f'{"✓" if n_new == want and not left else "✗"} · sa starim (pod {TIP}): {len(left)} · '
          f'settings bez starog naziva {"✓" if ok_set else "✗"}')


if __name__ == '__main__':
    main()
