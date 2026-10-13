# -*- coding: utf-8 -*-
"""Jednokratno (S170, T2): Visa u traku „Čeka potvrdu".

ŠTO RADI
  U `settings.dashboard.widgets[<saldo>].due.baskets` Financije_all doda
    "Visa": {"account": "Sašin tekući RF", "text": "Visa",
             "window": {"before": 2, "after": 6}, "measure": "gross"}
  Ništa drugo u `settings` se ne dira (provjerava se poslije upisa).

ZAŠTO BAŠ TAKO (DOSPJELO_SPEC §2, FINANCIJE_PROCES §8.2)
  - `text: "Visa"` — isti opis kojim `visa_uvoz_izvoda.py` upisuje naplatu na RF-u
    (pravilo B traži opis DOSLOVNO). NE PBZ tekst izvoda (6 varijanti).
  - `window` — Visa nema stalan dan (5. 383×, 4. 231×, 6. 109×, 7. 82×, 11. 49×,
    3. 11× na 855 redaka), a `Datum naplate` je procjena 5. ⇒ 3.–11.
  - `measure: gross` — košara nosi zrcalo naplate (`PRIMLJENA UPLATA`, uplata s
    `Izvor = Visa`); neto bi ga pojeo. Bruto = PBZ naplata 16 mjeseci u cent.

ISPIS PRIJE UPISA
  Visa košare koje traka ODMAH pokaže (`Planiran`, dospijeće ≤ danas), s bruto Σ —
  da se zna što će Koka vidjeti prvi put. Stare košare s krivim datumom (npr.
  03.10. iz doba `next:3`) ispravlja `visa_uvoz_izvoda.py` uz izvod, ne ovaj alat.

SIGURNOST
  - zadano DRY RUN; upis tek `--apply`; PROD traži i `--yes-prod`
  - baza iz `ET_TARGET` (bez njega TEST)
  - staje ako widget nema `due` ili `due.baskets` već ima Visu s drugim sadržajem
  - poslije upisa PONOVO ČITA iz baze
  /!\\ Tek POSLIJE deploya koda S170: stari bundle ne zna `window`/`measure`, pa bi
      Visu računao NETO i ±3 dana — traka bi pokazivala krive brojke.

Pokretanje (PowerShell, iz `data-prep_tools`):
  .\\Financije\\run.bat set_due_visa_S170.py                     TEST, dry run
  .\\Financije\\run.bat set_due_visa_S170.py --apply             TEST, upis
  $env:ET_TARGET='prod'; .\\Financije\\run.bat set_due_visa_S170.py --apply --yes-prod
"""
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import load_env, rest, target                           # noqa: E402

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

APPLY = '--apply' in sys.argv
VISA = {'account': 'Sašin tekući RF', 'text': 'Visa',
        'window': {'before': 2, 'after': 6}, 'measure': 'gross'}


def balance_widget(settings: dict) -> dict | None:
    for w in (settings.get('dashboard') or {}).get('widgets') or []:
        if w.get('type') == 'balance_by_group' and w.get('due'):
            return w
    return None


def pending_visa(url, key, area_id: str, due: dict, w: dict) -> None:
    defs = rest(url, key, f'attribute_definitions?select=id,slug,categories!inner(area_id)'
                          f'&categories.area_id=eq.{area_id}')
    by_slug = {d['slug']: d['id'] for d in defs}
    need = [due['status_slug'], due['basket_by'], due['due_slug'], w.get('minus'), w.get('plus')]
    if not all(s in by_slug for s in need if s):
        print(f'  ⚠ ne nalazim sve atribute ({need}) — preskačem pregled košara')
        return
    st = rest(url, key, f'event_attributes?select=event_id&attribute_definition_id=eq.{by_slug[due["status_slug"]]}'
                        f'&value_text=eq.{urllib.request.quote(due["pending"])}')
    ids = [r['event_id'] for r in st]
    vals: dict[str, dict] = defaultdict(dict)
    want = {by_slug[s]: s for s in need if s}
    for i in range(0, len(ids), 80):
        chunk = ','.join(ids[i:i + 80])
        for a in rest(url, key, f'event_attributes?select=event_id,attribute_definition_id,value_text,'
                                f'value_number,value_datetime&event_id=in.({chunk})'):
            s = want.get(a['attribute_definition_id'])
            if s:
                vals[a['event_id']][s] = a['value_number'] if a['value_number'] is not None \
                    else (a['value_datetime'] or a['value_text'])
    today = date.today().isoformat()
    kos = defaultdict(lambda: [0, 0.0, 0.0])
    for v in vals.values():
        if v.get(due['basket_by']) != 'Visa' or not v.get(due['due_slug']):
            continue
        d = str(v[due['due_slug']])[:10]
        k = kos[d]
        k[0] += 1
        k[1] += float(v.get(w.get('minus')) or 0)
        k[2] += float(v.get(w.get('plus')) or 0)
    if not kos:
        print('  Visa „Planiran": nijedan redak — traka za Visu zasad ništa ne pokazuje.')
        return
    print('  Visa „Planiran" po dospijeću (traka pokazuje ≤ danas):')
    for d in sorted(kos):
        n, minus, plus = kos[d]
        oznaka = '  ← ODMAH U TRACI' if d <= today else ''
        print(f'    {d}  {n:3d} redaka  bruto {minus:10.2f}  (uplate {plus:.2f}){oznaka}')


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
    w = balance_widget(settings)
    if not w:
        sys.exit('✗ Nijedna pločica salda nema `due` — traka ne postoji, nema se čemu dodati Visa.')
    due = w['due']
    print(f'due.baskets sada: {json.dumps(due.get("baskets"), ensure_ascii=False)}')
    print(f'Visa treba:       {json.dumps(VISA, ensure_ascii=False)}\n')
    pending_visa(url, key, area['id'], due, w)

    cur = (due.get('baskets') or {}).get('Visa')
    if cur == VISA:
        print('\n= već upisano, ništa za napraviti.')
        return
    if cur is not None:
        sys.exit(f'\n✗ Visa u configu već postoji, ali drukčija ({cur}). Ne prepisujem naslijepo.')
    if not APPLY:
        print('\nDry run. Za upis: --apply' + (' --yes-prod' if env == 'prod' else ''))
        return

    new = json.loads(json.dumps(settings))
    nw = balance_widget(new)
    nw['due']['baskets']['Visa'] = VISA
    h = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    req = urllib.request.Request(url + '/rest/v1/areas?id=eq.' + area['id'], method='PATCH',
                                 headers=h, data=json.dumps({'settings': new}).encode())
    with urllib.request.urlopen(req) as resp:
        got = json.loads(resp.read().decode() or '[]')
    if len(got) != 1:
        sys.exit(f'✗ areas: upisano {len(got)} redaka.')

    s2 = rest(url, key, 'areas?select=id,settings&id=eq.' + area['id'])[0]['settings']
    w2 = balance_widget(s2)
    ok = w2 is not None and w2['due']['baskets'].get('Visa') == VISA
    # Sve ostalo mora biti isto: usporedba s ocekivanim (`new`), ne s onim sto je upisano.
    same = s2 == new
    print(f'\nU bazi: Visa {"✓" if ok else "✗"} · ostale postavke netaknute {"✓" if same else "✗"}')


if __name__ == '__main__':
    main()
