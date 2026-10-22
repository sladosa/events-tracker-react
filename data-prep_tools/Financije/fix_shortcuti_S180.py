# -*- coding: utf-8 -*-
"""Jednokratno (S180): shortcuti `Financije_all` koje Kokino preuređivanje NE VIDI.

ZAŠTO
  Preuređivanje (sheet `Preuređivanje`, korak 8 Financija, 22.10.) preimenuje parove
  Tip/Podtip svugdje u Arei — ali shortcute vidi samo POZIVATELJEVE (RLS po korisniku,
  PREUREDJIVANJE_SPEC §19). Uvozi Koka (vlasnica), pa Sašini shortcuti ostanu sa starim
  nazivom. Izmjereno na PROD-u 22.10.: 5 shortcuta u Arei, 1 pogođen — `AI_rucak`
  (Saša, 4 korištenja) nosi `Projekti / Sasa`. Bez popravka bi svaki unos kroz njega
  upisao Podtip kojeg više nema u izborniku (siroče, bez greške).

ŠTO RADI
  Za svaki shortcut Aree (svih korisnika): ako `default_attributes` nosi (Tip, Podtip)
  iz `RENAME`, Podtip → novi naziv; a ako Namjenu nema, doda je (`RENAME` zna čija je
  — inače bi unos dobio zadano „Zajedničko", a retci tog para su Koka/Saša).

SIGURNOST
  - zadano je DRY RUN; upisuje tek `--apply`; PROD traži i `--yes-prod`
  - STAJE ako izbornik u bazi još nosi stari naziv: alat ide TEK POSLIJE Kokinog Apply
    (inače bi shortcut nudio naziv kojeg izbornik još nema)
  - poslije upisa se PONOVO ČITA iz baze (RLS/greška vraća 200 i 0 redaka)

Pokretanje (PowerShell, iz `data-prep_tools`):
  $env:ET_TARGET='prod'; .\\Financije\\run.bat fix_shortcuti_S180.py                       dry run
  $env:ET_TARGET='prod'; .\\Financije\\run.bat fix_shortcuti_S180.py --apply --yes-prod
"""
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest, target                           # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
APPLY = '--apply' in sys.argv

# (Tip, stari Podtip) → (novi Podtip, Namjena) — isti koraci kao sheet (Claude-temp_R/s180/build_sheet.mjs)
RENAME = {
    ('Zabava', 'Audible_Koka'): ('Audible', 'Koka'),
    ('Zabava', 'Audible_Sasa'): ('Audible', 'Saša'),
    ('Zabava', 'Kindle_Koka'): ('Kindle', 'Koka'),
    ('Zdravlje', 'Sport_Koka'): ('Sport', 'Koka'),
    ('Zdravlje', 'Sport_Sasa'): ('Sport', 'Saša'),
    ('Zdravlje', 'Medical_Koka'): ('Medical', 'Koka'),
    ('Zdravlje', 'Medical_Sasa'): ('Medical', 'Saša'),
    ('Zdravlje', 'Lječnička komora_Koka'): ('Lječnička komora', 'Koka'),
    ('Razno', 'Odjeća/obuća/ostalo_Koka'): ('Odjeća/obuća/ostalo', 'Koka'),
    ('Razno', 'Odjeća/obuća/ostalo_Sasa'): ('Odjeća/obuća/ostalo', 'Saša'),
    ('Projekti', 'Sasa'): ('Saša', 'Saša'),
    ('Kuća', 'Osiguranje'): None,   # premješten pod Tip Osiguranje — shortcut se samo prijavi
}


def main():
    env = target()
    if env == 'prod' and APPLY and '--yes-prod' not in sys.argv:
        sys.exit('✗ PROD upis traži i --yes-prod.')
    url, key = load_env(env)
    h = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    print(f'[{env.upper()}] {url}  {"APPLY" if APPLY else "DRY RUN"}\n')

    area = rest(url, key, 'areas?name=eq.Financije_all&select=id')
    if len(area) != 1:
        sys.exit(f'✗ Area Financije_all: nađeno {len(area)}.')
    defs = rest(url, key, 'attribute_definitions?select=id,slug,validation_rules,category_id,'
                'categories!inner(area_id)&categories.area_id=eq.' + area[0]['id'])
    by = {d['slug']: d for d in defs}
    tip_id, pod_id, nam_id = by['tip']['id'], by['podtip']['id'], by['namjena']['id']
    om = by['podtip']['validation_rules']['depends_on']['options_map']
    stale = [f'{t} / {p}' for (t, p), v in RENAME.items() if v and p in om.get(t, [])]
    if stale:
        sys.exit('✗ Izbornik još nosi stare nazive (' + ', '.join(stale) + ') — prvo Kokin Apply preuređivanja.')

    cats = {d['category_id'] for d in defs}
    presets = rest(url, key, 'activity_presets?select=id,name,user_id,default_attributes'
                   '&category_id=in.(' + ','.join(cats) + ')')
    todo = []
    for p in presets:
        da = p['default_attributes'] or {}
        k = (da.get(tip_id), da.get(pod_id))
        if k not in RENAME:
            print(f'  ·  {p["name"]:<22} {p["user_id"][:8]}  bez starog para')
            continue
        if RENAME[k] is None:
            print(f'  ⚠  {p["name"]:<22} {p["user_id"][:8]}  {k[0]} / {k[1]} — premjesti ručno (Osiguranje / Kuća)')
            continue
        novi, tko = RENAME[k]
        nda = dict(da)
        nda[pod_id] = novi
        if not nda.get(nam_id):
            nda[nam_id] = tko
        print(f'  →  {p["name"]:<22} {p["user_id"][:8]}  {k[0]} / {k[1]}  ⇒  {k[0]} / {novi} · Namjena {nda[nam_id]}')
        todo.append((p, nda))

    print(f'\nZa ispravak: {len(todo)} od {len(presets)}')
    if not APPLY or not todo:
        print('(dry run — ništa nije upisano; dodaj --apply)' if not APPLY else 'Ništa za upis.')
        return
    for p, nda in todo:
        r = urllib.request.Request(f'{url}/rest/v1/activity_presets?id=eq.{p["id"]}', method='PATCH', headers=h,
                                   data=json.dumps({'default_attributes': nda}).encode())
        with urllib.request.urlopen(r) as resp:
            if len(json.loads(resp.read().decode() or '[]')) != 1:
                sys.exit(f'✗ {p["name"]}: upis nije pogodio 1 redak.')
        back = rest(url, key, f'activity_presets?select=default_attributes&id=eq.{p["id"]}')[0]['default_attributes']
        print(f'  ✓ {p["name"]}: ' + ('upisano i pročitano natrag' if back == nda else '✗ NE ODGOVARA nakon čitanja'))


main()
