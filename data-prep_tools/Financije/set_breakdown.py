# -*- coding: utf-8 -*-
"""
set_breakdown.py  (S165, 2026-10-07)
================================================================================
Upisuje pločicu „Kamo ide novac" (`settings.dashboard.widgets[]`, tip `breakdown`)
i grupiranje `settings.groupings["Vrsta troška"]` za `Financije_all`.

Spec: docs/RAZREZ_SPEC.md §10.3 (točan config), §13 (alat), §4.3 (Sašin raspored).

ZAŠTO ALAT, A NE STRUCTURE EXCEL
    R14 (S164): pločica ide PRIJE F5 (`AreaSettings` + `Grupiranja` sheet), jer će
    se raspored bucketa mijenjati nekoliko puta prije nego se Excel put isplati.
    Do F5 je ovaj file JEDINI izvor rasporeda — spec ga namjerno ne prepisuje.
    ⚠ F5 ga mora moći IZVESTI, ne samo uvesti (§16).

⚠ MERGE, NE OVERWRITE (obrazac `set_list_columns.py`). `settings` nosi i
  `dashboard` (saldo!), `automations`, `list_columns`, `export_profiles`…
  Pločica istog `type` + `title` se zamjenjuje, ostale se ne diraju.

⚠ NA PROD TEK POSLIJE DEPLOYA (CLAUDE.md § Overview, S164). Stari bundle za
  nepoznat tip crta žuti okvir „Nepoznat tip pločice" iznad salda — Koka bi ga
  vidjela. Redoslijed: 056 → deploy → ovaj alat.

PROVJERE PRIJE UPISA (alat STAJE):
    - svaki slug pločice postoji u Arei (os datuma kao `datetime`)
    - isti par dvaput u grupiranju (zbrojio bi se dvaput — kolač veći od potrošnje)
    - par čiji Tip/Podtip nije u `validation_rules` (pokazuje u prazno, K-1 razred:
      rename opcije tiho lomi par — ovo je jedino mjesto koje to hvata do F5)
    - korekcija u grupiranju koje nema na pločici
ISPIS: parovi iz PODATAKA (zadnjih 12 mj) koji nisu ni u jednom bucketu
    ⇒ „nesvrstano" na pločici. Za Financije danas mora biti prazno.

Pokretanje (PowerShell, iz data-prep_tools\\):
    Financije\\run.bat set_breakdown.py                 dry run: razlika starog i novog JSON-a
    Financije\\run.bat set_breakdown.py --apply         upiši (TEST)
    $env:ET_TARGET='prod'; Financije\\run.bat set_breakdown.py --apply --yes-prod
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, str(Path(__file__).parent))
from verify_rpc_vs_model import AREA_ID, ENV_FILE, IS_PROD, Supa, load_env, target_banner  # noqa: E402

TITLE = 'Kamo ide novac'
GROUPING_NAME = 'Vrsta troška'
GOTOVINA = 'gotovina, nerazvrstano'

# ── Pločica — RAZREZ §10.3, doslovno ─────────────────────────────────────────
WIDGET = {
    'type': 'breakdown', 'title': TITLE, 'unit': '€',
    'levels': ['tip', 'podtip'], 'plus': 'uplata', 'minus': 'isplata',
    'income': {'slug': 'tip', 'op': 'in', 'values': ['Prihodi']},
    'outside': [{'slug': 'tip', 'op': 'in', 'values': ['Transfer']}],
    'unclassified': ['N/A'],
    'date_axes': [{'label': 'po kupnji', 'slug': None},
                  {'label': 'po naplati', 'slug': 'datum_naplate'}],
    # Podignuto − evidentirano (CLAUDE.md § Overview, S121). „add" broji Transfer
    # retke koje razrez inače drži vani — namjerno: podizanje je jedini trag.
    'adjustments': [{
        'label': GOTOVINA,
        'add': [{'slug': 'tip', 'op': 'in', 'values': ['Transfer']},
                {'slug': 'podtip', 'op': 'in', 'values': ['cash - bankomat']}],
        'subtract': [{'slug': 'izvorplacanja', 'op': 'in', 'values': ['Cash']},
                     {'slug': 'tip', 'op': 'not_in', 'values': ['Transfer']}],
    }],
    'grouping': GROUPING_NAME,
}

# ── Sašin raspored (RAZREZ §4.3, R2) + R3 + gotovina + Lječnička komora ──────
# Redoslijed bucketa = redoslijed u tablici §4.3 (pločica ih ionako slaže po iznosu).
# `*` = cijeli Tip; konkretan par ima prednost pred `*` (specifičnost, §4.2).
BUCKETS: list[tuple[str, list[tuple[str, str]]]] = [
    ('Mjesečni troškovi', [
        ('Domaćinstvo', 'Hrana i ostalo'), ('Domaćinstvo', 'Bankovni troškovi'),
        ('Kuća', 'Struja'), ('Kuća', 'Plin'), ('Kuća', 'Voda'), ('Kuća', 'Holding (smeće)'),
        # R15: povrati vraćaju dio režija ⇒ umanjuju Mjesečne, ne investicije
        ('Kuća', 'Povrat Zoran'), ('Kuća', 'Povrat Nataša'),
        ('Informatika', 'Komunikacije_T-com (internet, MaxTv)'),
        ('Informatika', 'Komunikacije_T-mobile'), ('Informatika', 'Cloud backup'),
        ('Informatika', 'Microsoft'), ('Informatika', 'HP'),
        ('Informatika', 'Hosting domene (DPS, Igor)'),
        ('Zabava', 'Audible_Koka'), ('Zabava', 'Audible_Sasa'), ('Zabava', 'Kindle_Koka'),
        ('Zabava', 'Spotify'), ('Zabava', 'Prime'), ('Zabava', 'Sky'), ('Zabava', 'Disney'),
        ('Zabava', 'HBOmax'), ('Zabava', 'Youtube'),
        ('Prijevoz', '*'),
        ('Zdravlje', 'PP (Posmrtna pripomoc)'),
    ]),
    ('Kvaliteta života', [
        ('Razno', 'Temu'), ('Domaćinstvo', 'Kave/jelo vani'),
        ('Zdravlje', 'Sport_Sasa'), ('Zdravlje', 'Sport_Koka'),
        ('Zabava', 'Kino/Kazalište/Muzeji'), ('Zabava', 'Wellness'),
    ]),
    ('Putovanja i pokloni', [
        ('Putovanja', '*'), ('Razno', 'Pokloni'),
    ]),
    ('Povremeno nužno', [
        ('Osiguranje', '*'), ('Porezi', '*'),   # R11: Porezi smiju biti negativni
        ('Zdravlje', 'Medical_Sasa'), ('Zdravlje', 'Medical_Koka'), ('Zdravlje', 'Other'),
        ('Razno', 'Odjeća/obuća/ostalo_Koka'), ('Razno', 'Odjeća/obuća/ostalo_Sasa'),
        ('Razno', 'Razno, sitnice'),
        ('Informatika', 'Hardver'), ('Informatika', 'Odrzavanje i servis'),
        ('Advokati', '*'),
        ('Kuća', 'Osiguranje'),                 # R3 (§4.4)
    ]),
    ('Kuća investicije', [
        ('Kuća', 'Popravci, održavanje, osiguranje'),
    ]),
    ('Kućište · Nenin novac', [                 # R12
        ('Razno', "Nena's funds"),
    ]),
    ('Koka razno', [
        ('Projekti', 'Koka'), ('auto C5', '*'), ('Zdravlje', 'Lječnička komora_Koka'),
    ]),
    ('Saša razno', [
        ('Projekti', 'Sasa'), ('auto Lacetti', '*'),
    ]),
]
# Korekcijski redak u bucket (S164: gotovina je podstavka Mjesečnih, bez razmazivanja)
ADJUSTMENT_ROWS = [('Mjesečni troškovi', GOTOVINA)]


def grouping() -> dict:
    rows = []
    for bucket, pairs in BUCKETS:
        rows += [{'bucket': bucket, 'values': [t, p]} for t, p in pairs]
    rows += [{'bucket': b, 'adjustment': a} for b, a in ADJUSTMENT_ROWS]
    return {'levels': ['tip', 'podtip'], 'rows': rows}


def bucket_of(tip, podtip, g: dict | None = None):
    """Specifičnost, ne redoslijed: par > `Tip / *` > None (nesvrstano). Ista
    pravila kao `breakdownModel.ts` — `verify_breakdown.py` ih uspoređuje."""
    g = g or grouping()
    pair = {(r['values'][0], r['values'][1]): r['bucket'] for r in g['rows'] if 'values' in r}
    if (tip, podtip) in pair:
        return pair[(tip, podtip)]
    return pair.get((tip, '*'))


# ── provjere ────────────────────────────────────────────────────────────────
def check(sp: Supa, area_id: str) -> list[str]:
    errs = []
    cats = sp.select_all(f'categories?area_id=eq.{area_id}&select=id&order=id')
    ids = {c['id'] for c in cats}
    defs = [d for d in sp.select_all(
        'attribute_definitions?select=slug,data_type,category_id,validation_rules&order=id')
        if d['category_id'] in ids]
    by_slug = {d['slug']: d for d in defs}

    w = WIDGET
    slugs = set(w['levels']) | {w['plus'], w['minus'], w['income']['slug']}
    slugs |= {f['slug'] for f in w['outside']}
    for a in w['adjustments']:
        slugs |= {f['slug'] for f in a['add'] + a['subtract']}
    for s in sorted(slugs):
        if s not in by_slug:
            errs.append(f'slug `{s}` ne postoji u Arei')
    for s in (w['plus'], w['minus']):
        if s in by_slug and by_slug[s]['data_type'] != 'number':
            errs.append(f'`{s}` nije broj ({by_slug[s]["data_type"]})')
    for ax in w['date_axes']:
        if ax['slug'] and by_slug.get(ax['slug'], {}).get('data_type') != 'datetime':
            errs.append(f'os datuma `{ax["slug"]}` nije datetime atribut')

    g = grouping()
    seen: dict = {}
    for r in g['rows']:
        k = tuple(r['values']) if 'values' in r else ('adj', r['adjustment'])
        if k in seen:
            errs.append(f'{k} je dvaput u grupiranju ({seen[k]}, {r["bucket"]}) — zbrojio bi se dvaput')
        seen[k] = r['bucket']
        if 'adjustment' in r and r['adjustment'] not in {a['label'] for a in w['adjustments']}:
            errs.append(f'korekcija `{r["adjustment"]}` ne postoji na pločici')

    # Tip/Podtip mora postojati u validation_rules — inače par pokazuje u prazno
    tips = set((by_slug.get('tip', {}).get('validation_rules') or {}).get('suggest') or [])
    omap = (((by_slug.get('podtip', {}).get('validation_rules') or {})
             .get('depends_on') or {}).get('options_map') or {})
    for r in g['rows']:
        if 'values' not in r:
            continue
        t, p = r['values']
        if t not in tips:
            errs.append(f'Tip `{t}` (bucket {r["bucket"]}) nije u validation_rules')
        elif p != '*' and p not in (omap.get(t) or []):
            errs.append(f'Podtip `{t} / {p}` (bucket {r["bucket"]}) nije u validation_rules')
    return errs


def unassigned_pairs(sp: Supa, area_id: str) -> list[tuple]:
    """Parovi troška iz podataka zadnjih 12 punih mjeseci bez bucketa."""
    today = date.today()
    do = date(today.year, today.month, 1)
    od = date(do.year - 1, do.month, 1)
    rows = sp.rpc('rpc_area_breakdown', {
        'p_area_id': area_id, 'p_group_slugs': ['tip', 'podtip'],
        'p_plus_slug': 'uplata', 'p_minus_slug': 'isplata',
        'p_date_from': od.isoformat(), 'p_date_to': (do - timedelta(days=1)).isoformat()})
    out = []
    for r in rows or []:
        t, p = r['g']
        if t in (None, '', 'N/A', 'Prihodi', 'Transfer'):
            continue
        if bucket_of(t, p) is None:
            out.append((t, p, r['n'], round(float(r['minus_sum']) - float(r['plus_sum']), 2)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='upiši (bez toga dry run)')
    ap.add_argument('--yes-prod', action='store_true', help='obavezno uz ET_TARGET=prod')
    args = ap.parse_args()

    print(target_banner())
    if IS_PROD and args.apply and not args.yes_prod:
        sys.exit('✗ PROD upis traži i --yes-prod. ⚠ Tek POSLIJE deploya (stari bundle '
                 'crta „Nepoznat tip pločice" iznad salda).')

    sp = Supa(load_env(ENV_FILE))
    rows = sp.select_all(f'areas?id=eq.{AREA_ID}&select=name,settings&order=id')
    if not rows:
        sys.exit(f'✗ Area {AREA_ID} ne postoji u ovoj bazi.')
    area = rows[0]
    settings = area['settings'] or {}
    print(f"Area: {area['name']} · settings ključevi: {sorted(settings)}")

    errs = check(sp, AREA_ID)
    if errs:
        print('\n✗ Provjere nisu prošle — ništa se ne upisuje:')
        for e in errs:
            print('   ', e)
        sys.exit(1)
    print('✓ slugovi, os datuma, grupiranje bez duplikata, svi parovi u validation_rules')

    try:
        un = unassigned_pairs(sp, AREA_ID)
    except SystemExit:
        un = None
        print('⚠ rpc_area_breakdown nije dostupan (056 nije pušten?) — preskačem ispis nesvrstanih')
    if un is not None:
        if un:
            print(f'\n⚠ Nesvrstano u zadnjih 12 mj ({len(un)} parova) — pojavit će se kao „nesvrstano":')
            for t, p, n, v in un:
                print(f'    {t} / {p}   {n} redaka   {v:,.2f}')
        else:
            print('✓ nesvrstano u zadnjih 12 mj: ništa')

    dash = settings.get('dashboard') or {'widgets': []}
    widgets = [w for w in dash.get('widgets', [])
               if not (w.get('type') == WIDGET['type'] and w.get('title') == TITLE)]
    new_dash = {**dash, 'widgets': widgets + [WIDGET]}
    new_groupings = {**(settings.get('groupings') or {}), GROUPING_NAME: grouping()}

    old_w = next((w for w in dash.get('widgets', [])
                  if w.get('type') == WIDGET['type'] and w.get('title') == TITLE), None)
    old_g = (settings.get('groupings') or {}).get(GROUPING_NAME)
    print('\npločica:', 'ISTA' if old_w == WIDGET else ('NOVA' if old_w is None else 'MIJENJA SE'))
    print('grupiranje:', 'ISTO' if old_g == grouping() else ('NOVO' if old_g is None else 'MIJENJA SE'))
    print(f'pločice nakon upisa: {[w.get("type") + ":" + w.get("title", "") for w in new_dash["widgets"]]}')
    print(f'bucketi: {[b for b, _ in BUCKETS]} · parova {sum(len(p) for _, p in BUCKETS)}')
    if old_g and old_g != grouping():
        old = {(tuple(r.get('values') or ('adj', r.get('adjustment')))): r['bucket'] for r in old_g['rows']}
        new = {(tuple(r.get('values') or ('adj', r.get('adjustment')))): r['bucket'] for r in grouping()['rows']}
        for k in sorted(set(old) | set(new), key=str):
            if old.get(k) != new.get(k):
                print(f'    {k}: {old.get(k)} → {new.get(k)}')

    if not args.apply:
        print('\n(dry run — ništa nije upisano; dodaj --apply)')
        return

    merged = {**settings, 'dashboard': new_dash, 'groupings': new_groupings}
    got = sp._call(f'areas?id=eq.{AREA_ID}&select=id', method='PATCH',
                   body={'settings': merged}, extra={'Prefer': 'return=representation'})
    if not got:
        sys.exit('✗ PATCH je vratio 0 redaka — ništa nije upisano.')
    # Pročitaj natrag: upis koji „prođe" a ne zapiše je razred ovog projekta.
    back = sp.select_all(f'areas?id=eq.{AREA_ID}&select=settings&order=id')[0]['settings']
    ok = (back.get('groupings', {}).get(GROUPING_NAME) == grouping()
          and any(w == WIDGET for w in back.get('dashboard', {}).get('widgets', []))
          and all(k in back for k in settings))
    if not ok:
        sys.exit('✗ Upis vraćen, ali pročitano se ne slaže s upisanim — provjeri ručno.')
    print(f'\n✓ Upisano i pročitano natrag. Ostali ključevi netaknuti: '
          f'{sorted(k for k in back if k not in ("dashboard", "groupings"))}')
    print('  Saldo pločica ostaje prva u nizu.')


if __name__ == '__main__':
    main()
