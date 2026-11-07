# -*- coding: utf-8 -*-
"""
krug.py — jedna naredba za mjesečni krug Financija (S195, `docs/KRUG_SPEC.md`).

    Financije\\krug.bat                       # PROD, dvoklik: cijeli krug, izvještaj se otvori sam
    Financije\\run.bat krug.py --suho         # baza iz ET_TARGET (bez njega TEST), NIŠTA ne upisuje
    Financije\\run.bat krug.py --izvod MC_2026-09.pdf   # i izvod izvan korijena izvodi\ (K5)
    dodatno: --izlaz <mapa> · --ne-otvaraj · --detalji (ispis alata i na ekran)

Ovo je OMOTAČ: putanje, razvrstač, sidro (K6), seljenje gotovih (K5), Excel i izvještaj.
Odluke donosi `_krug.py` (bez putanja i bez ukucanih računa, K9).

Što upisuje (bez `--suho`):
  • sidro ZABA/RF — samo kad je promet izvoda ✓ u cent I saldo na dan izvoda = ispisano
    stanje (inače bi sidro sakrilo stariju grešku);
  • gotov izvod premjesti iz korijena `izvodi\\` u `Analizirani_izvodi\\` (naša mapa);
  • Excel + izvještaj: PROD ⇒ Kokina mapa `OneDrive\\Izvodi\\Za uvoz` (K1: samo dodaje novi
    file, nikad ne prepisuje ni ne briše); TEST ili PROD uz `--suho` ⇒ lokalno
    `data-prep_data\\Financije\\krug_lokalno` — probni file nikad ne smije u Kokinu mapu.
"""
from __future__ import annotations

import contextlib
import io
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))

import _krug  # noqa: E402
from _db import target  # noqa: E402
from _izvodi import IZVODI, nadji, svi  # noqa: E402

ANALIZIRANI = IZVODI / 'Analizirani_izvodi'
ZA_UVOZ = Path(r'C:\0_Sasa\OneDrive\Izvodi\Za uvoz')          # K1: Kokina mapa, samo dodaje
LOKALNO = IZVODI.parent / 'krug_lokalno'                         # TEST i --suho: nikad Kokina mapa
ZNAK = {'gotovo': '✓', 'excel': '→', 'sidro': '⚓', 'ceka': '⏳', 'stani': '✗'}


def razvrstaj(apply: bool) -> str:
    import razvrstaj_izvode
    stari = sys.argv
    sys.argv = ['razvrstaj_izvode.py'] + (['--apply'] if apply else [])
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            razvrstaj_izvode.main()
    except SystemExit as e:              # npr. inbox ne postoji (OneDrive odjavljen)
        buf.write(f'\n{e.code}\n')
    finally:
        sys.argv = stari
    return buf.getvalue()


def slobodno_ime(mapa: Path, ime: str, nastavak: str) -> Path:
    out, i = mapa / f'{ime}{nastavak}', 2
    while out.exists():                      # K1: nikad ne prepisuje
        out, i = mapa / f'{ime}_{i}{nastavak}', i + 1
    return out


def main() -> None:
    args = sys.argv[1:]
    suho, detalji, otvori = '--suho' in args, '--detalji' in args, '--ne-otvaraj' not in args
    arg = {a: args[i + 1] for i, a in enumerate(args[:-1]) if a in ('--izlaz',)}
    dodatni = [args[i + 1] for i, a in enumerate(args[:-1]) if a == '--izvod']
    env = target()
    print(f'[{env.upper()}] Mjesečni krug' + ('  (--suho: ništa se ne upisuje ni ne premješta)' if suho else ''))

    rz = razvrstaj(apply=not suho)
    nove = [ln.strip() for ln in rz.splitlines() if 'KOPIRAJ' in ln or 'PREIMENUJ' in ln or '✗' in ln]
    print('Razvrstač: ' + ('; '.join(nove) if nove else 'ništa novo u inboxu'))

    korijen = sorted(p for p in IZVODI.glob('*.pdf') if p.is_file())
    pdfs = korijen + [nadji(x) for x in dodatni if nadji(x) not in korijen]
    neznani = [p for p in pdfs if not _krug.prefiks(p)]
    pdfs = [p for p in pdfs if _krug.prefiks(p)]
    popis = ', '.join(p.name for p in pdfs) or 'nijedan u korijenu izvodi' + chr(92)
    print(f'Izvodi: {popis}'
          + (f'  (preskočeno, nepoznato ime: {", ".join(p.name for p in neznani)})' if neznani else ''))

    k = _krug.ucitaj(env)
    print(f'Baza: {len(k.db)} eventa · {len(k.sidra)} sidara · danas {k.danas:%d.%m.%Y.}\n')
    stanja = _krug.obradi(k, pdfs, svi) if pdfs else []

    sidra = []
    for s in stanja:
        if s.stanje == 'sidro' and s.sidro:
            t = f'{s.sidro["racun"]}: {_krug._eur(s.sidro["iznos"])} na {s.sidro["na"]:%d.%m.%Y.} ({s.izvod})'
            if suho:
                s.ceka.append(f'(--suho) sidro {t} NIJE upisano')
            else:
                _krug.upisi_sidro(k, s.sidro['racun'], s.sidro['iznos'], s.sidro['na'], s.izvod)
                s.stanje = 'gotovo'
                s.sazetak += ' · sidro UPISANO'
                sidra.append(t)

    for s in stanja:
        print(f'{ZNAK.get(s.stanje, "?")} {s.izvod:<20} {s.stanje.upper():<7} {s.sazetak}')
        for eid, t in s.odluke:
            print(f'      ODLUKA [{(eid or "novi")[:8]}] {t}')
        for t in s.ceka:
            print(f'      ČEKA  {t}')
        for t in s.napomene:
            print(f'      SAMO  {t}')
        if detalji and s.ispis:
            print('      ' + s.ispis.replace('\n', '\n      '))

    preseljeni = []
    for s in [s for s in stanja if s.stanje == 'gotovo']:
        p = IZVODI / s.izvod
        if not p.exists():
            continue
        if suho:
            print(f'(--suho) {s.izvod} bi otišao u Analizirani_izvodi' + chr(92))
        elif (ANALIZIRANI / s.izvod).exists():
            print(f'⚠ {s.izvod} je gotov, ali Analizirani_izvodi već ima file istog imena — ostaje u korijenu')
        else:
            shutil.move(str(p), str(ANALIZIRANI / s.izvod))
            preseljeni.append(s.izvod)
            print(f'{s.izvod} → Analizirani_izvodi (gotov)')

    n, m = (sum(getattr(s, x) for s in stanja if s.stanje == 'excel') for x in ('novi', 'modify'))
    gotovo = sum(1 for s in stanja if s.stanje == 'gotovo')
    print(f'\nUKUPNO: {gotovo}/{len(stanja)} izvoda gotovo · za uvoz {n} New · {m} Modify'
          + f' · odluka {sum(len(s.odluke) for s in stanja)}')

    izlaz = Path(arg['--izlaz']) if '--izlaz' in arg else (
        ZA_UVOZ if env == 'prod' and not suho else LOKALNO)
    izlaz.mkdir(parents=True, exist_ok=True)
    ime = f'krug_{k.danas:%Y-%m-%d}_{datetime.now():%H%M}'

    plan, excel = None, None
    if any(s.stanje == 'excel' for s in stanja):
        import _krug_excel
        plan = _krug_excel.gradi(k, stanja)
        if (plan['novih'], plan['izmjena']) != (n, m):
            print(f'⚠ File ima {plan["novih"]} New · {plan["izmjena"]} Modify, a analize kažu {n} · {m} '
                  '— razlika je u spajanju; provjeri retke prije uvoza.')
        excel = slobodno_ime(izlaz, ime, '.xlsx')
        _krug_excel.pisi_file(k, plan, excel)
        print(f'\n→ {excel}')
        print(f'OČEKIVANO U PREGLEDU UVOZA: {plan["novih"]} New · {plan["izmjena"]} Modify · 0 Delete'
              + (f'  (+ {plan["samo_odluka"]} redaka samo radi odluke)' if plan['samo_odluka'] else ''))

    import _krug_izvjestaj
    rep = slobodno_ime(izlaz, ime if not excel else excel.stem, '.html')
    rep.write_text(_krug_izvjestaj.gradi(env, k.danas, stanja, plan, excel.name if excel else None,
                                         rz.splitlines(), sidra, preseljeni, suho), encoding='utf-8')
    print(f'→ {rep}')
    if otvori and hasattr(os, 'startfile'):
        os.startfile(str(rep))


if __name__ == '__main__':
    main()
