"""Ispravak Tip/Podtip zadanih redaka kao APP EXCEL koji vlasnica Aree uvozi (S169).

ZAŠTO: odluka o klasifikaciji pojedinih redaka (T34 Pharmalog, T35 Triglav, …) ne smije ići
izravno u PROD bazu — ide kao app Excel koji Koka uvozi pod svojim računom, s pregledom svake
izmjene (memorija `fixes_as_import_excel`). Retci se biraju po `event_id` — isti na TEST-u i
PROD-u (`prod_to_test.py`), pa se popis može složiti na TEST-u, a file pisati s PROD-a.

    $env:ET_TARGET = 'prod'
    Financije\\run.bat ispravi_tip.py --tip Prihodi --podtip Koka --id <id> <id> ... [--komentar Pharmalog]

Alat samo ČITA bazu; piše `ispravak_tip_<Tip>_<Podtip>_*.xlsx` u data-prep_data/Financije.
Kol. G = autor retka iz baze (S148: e-mail uvoznika na tuđem retku ⇒ duplikat).
`--komentar T` upiše T samo retku čiji komentar T već ne sadrži (ostali se ne diraju).
/!\\ Staje ako id ne postoji ili par Tip/Podtip nije u izborniku (Podtip mimo `validation_rules`
    uveze se kao tekst BEZ GREŠKE, CLAUDE.md).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _db import load_env, rest, target  # noqa: E402
from uskladi_izvod import load_db, net  # noqa: E402
from visa_uvoz_izvoda import taksonomija  # noqa: E402
from _excel_izbornici import izgled_pregleda  # noqa: E402
import visa_popravak  # noqa: E402


def arg(name):
    i = sys.argv.index(name)
    return sys.argv[i + 1]


def lista(name):
    i = sys.argv.index(name)
    out = []
    for a in sys.argv[i + 1:]:
        if a.startswith('--'):
            break
        out.append(a)
    return out


def main():
    if '--tip' not in sys.argv or '--id' not in sys.argv:
        sys.exit(__doc__)
    tip, podtip = arg('--tip'), (arg('--podtip') if '--podtip' in sys.argv else '')
    komentar = arg('--komentar') if '--komentar' in sys.argv else None
    ids = lista('--id')
    env = target()
    url, key = load_env(env)
    print(f'[{env.upper()}] {url}')
    tax = taksonomija(url, key)
    if tip not in tax or (podtip and podtip not in tax[tip]):
        sys.exit(f'✗ {tip} / {podtip} nije u izborniku ove baze')
    po_id = {r['id']: r for r in load_db(url, key)}
    nema = [i for i in ids if i not in po_id]
    if nema:
        sys.exit('✗ nema u bazi: ' + ', '.join(nema))
    for pr in rest(url, key, 'profiles?select=id,email'):
        if pr.get('email'):
            visa_popravak.EMAIL.setdefault(pr['id'], pr['email'])

    redci, izmjena = [], 0
    for i in ids:
        r = po_id[i]
        a = dict(r['attrs'])
        staro = (a.get('Tip'), a.get('Podtip'))
        kom = r.get('comment')
        if komentar and komentar.lower() not in (kom or '').lower():
            kom = komentar
        a['Tip'], a['Podtip'] = tip, podtip or None
        promjena = staro != (tip, podtip or None) or kom != r.get('comment')
        izmjena += promjena
        print(f"  {r['event_date']} {net(r['attrs']):>10,.2f} {a.get('Racun', ''):<18} "
              f"{staro[0]} / {staro[1]} → {tip} / {podtip}"
              f"{'  · komentar → ' + kom if kom != r.get('comment') else ''}"
              f"{'' if promjena else '  (već tako — bez izmjene)'}"
              f"   | {(r.get('comment') or '')[:40]}")
        redci.append((r, a, kom, False, f'ISPRAVAK {tip} / {podtip} (S169)'))
    ime = 'ispravak_tip_' + re.sub(r'[^A-Za-z0-9]+', '_', f'{tip}_{podtip}').strip('_')
    visa_popravak.pisi(redci, {}, ime, tax=tax, izgled=izgled_pregleda)
    print(f'\nUvoz pod Kokinim računom. Očekivani pregled: 0 New · {izmjena} Modify · 0 Delete; '
          'saldo se ne miče (mijenja se samo klasifikacija).')


if __name__ == '__main__':
    main()
