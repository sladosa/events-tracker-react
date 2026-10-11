# -*- coding: utf-8 -*-
"""Jednokratno (S168, T22): rata modal -- koja rata nosi ostatak zaokruzivanja, po kartici.

Izmjereno na banci (S158, kompletni planovi): Visa PRVA rata razlicita 28/28
(`12,50 · 12,49 · 12,49`), Mastercard ZADNJA 16/16 (`18,49 · 18,49 · 18,47` =
rata zaokruzena navise). App je do S168 za obje kartice stavljao ostatak na
prvu ratu, pa se MC plan s nedjeljivim iznosom od banke razlikovao za cent u
vise mjeseci -- a traka „Ceka potvrdu" ima toleranciju 0,00.

STO RADI
  `areas.settings.automations.rata.remainder_map` Financije_all =
  {Mastercard: last, Visa: first}. Nista drugo u `settings` se ne dira.
  Isto se moze i Structure uvozom (Automations, kolona `Remainder`) -- ovo je
  da Koka ne mora raditi uvoz pod svojim racunom.

SIGURNOST
  - zadano DRY RUN; upis tek `--apply`; PROD trazi i `--yes-prod`
  - baza iz `ET_TARGET` (bez njega TEST)
  - staje ako Area nema `automations.rata` (nema se cemu dodati pravilo)
  - poslije upisa PONOVO CITA iz baze
  /!\\ Tek POSLIJE deploya koda S168: stari bundle kljuc ignorira (bezopasno),
      ali T-S168 test na PROD-u ima smisla tek s novim kodom.

Pokretanje (PowerShell, iz `data-prep_tools`):
  .\\Financije\\run.bat set_rata_ostatak_S168.py                    TEST, dry run
  .\\Financije\\run.bat set_rata_ostatak_S168.py --apply            TEST, upis
  $env:ET_TARGET='prod'; .\\Financije\\run.bat set_rata_ostatak_S168.py --apply --yes-prod
"""
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest, target                           # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

APPLY = '--apply' in sys.argv
WANT = {'Mastercard': 'last', 'Visa': 'first'}


def main():
    env = target()
    if env == 'prod' and APPLY and '--yes-prod' not in sys.argv:
        sys.exit('✗ PROD upis traži i --yes-prod.')
    url, key = load_env(env)
    print(f'[{env.upper()}] {url}  {"APPLY" if APPLY else "DRY RUN"}\n')
    areas = rest(url, key, 'areas?name=eq.Financije_all&select=id,settings')
    if len(areas) != 1:
        sys.exit(f'✗ Area Financije_all: nađeno {len(areas)}.')
    area = areas[0]
    settings = area['settings'] or {}
    rata = (settings.get('automations') or {}).get('rata')
    if not rata:
        sys.exit('✗ Financije_all nema automations.rata — nema se čemu dodati pravilo.')
    cur = rata.get('remainder_map')
    keys = sorted(rata.get('date_map', {}))
    print(f'rata.date_map ključevi (kartice): {keys}')
    print(f'remainder_map sada:  {cur}')
    print(f'remainder_map treba: {WANT}')
    missing = [k for k in WANT if k not in keys]
    if missing:
        print(f'  ⚠ {missing} nema u date_map — pravilo za njih ne smeta, ali provjeri ime kartice')
    if cur == WANT:
        print('\n= već upisano, ništa za napraviti.')
        return
    if not APPLY:
        print('\nDry run. Za upis: --apply' + (' --yes-prod' if env == 'prod' else ''))
        return

    new = json.loads(json.dumps(settings))
    new['automations']['rata']['remainder_map'] = WANT
    h = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    req = urllib.request.Request(url + '/rest/v1/areas?id=eq.' + area['id'], method='PATCH',
                                 headers=h, data=json.dumps({'settings': new}).encode())
    with urllib.request.urlopen(req) as resp:
        got = json.loads(resp.read().decode() or '[]')
    if len(got) != 1:
        sys.exit(f'✗ areas: upisano {len(got)} redaka.')

    s2 = rest(url, key, 'areas?select=id,settings&id=eq.' + area['id'])[0]['settings']
    ok = s2['automations']['rata'].get('remainder_map') == WANT
    rest_same = {k: v for k, v in s2.items() if k != 'automations'} == \
                {k: v for k, v in settings.items() if k != 'automations'}
    rata_same = {k: v for k, v in s2['automations']['rata'].items() if k != 'remainder_map'} == \
                {k: v for k, v in rata.items() if k != 'remainder_map'}
    print(f'\nU bazi: remainder_map {"✓" if ok else "✗"} · ostale postavke netaknute '
          f'{"✓" if rest_same and rata_same else "✗"}')


if __name__ == '__main__':
    main()
