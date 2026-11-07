# -*- coding: utf-8 -*-
"""
krug.py — jedna naredba za mjesečni krug Financija (S195, `docs/KRUG_SPEC.md`).

    $env:ET_TARGET='prod'
    Financije\\run.bat krug.py                # razvrstač → svi izvodi u korijenu izvodi\ → stanje
    Financije\\run.bat krug.py --suho         # isto, ali NIŠTA ne upisuje ni ne premješta
    Financije\\run.bat krug.py --izvod MC_2026-09.pdf   # i izvod izvan korijena (iznimka, K5)
    dodaj --detalji za ispis svakog alata

Ovo je OMOTAČ: putanje, razvrstač, sidro (K6), seljenje gotovih (K5). Odluke donosi
`_krug.py` (bez putanja i bez ukucanih računa, K9). Excel i izvještaj: koraci 3–4.

Što upisuje (bez `--suho`):
  • sidro ZABA/RF — samo kad je promet izvoda ✓ u cent I saldo na dan izvoda = ispisano
    stanje (inače bi sidro sakrilo stariju grešku);
  • gotov izvod premjesti iz korijena `izvodi\\` u `Analizirani_izvodi\\` (naša mapa).
Kokina mapa (OneDrive) se samo ČITA (razvrstač kopira) — `Za uvoz` dolazi u koraku 3.
"""
from __future__ import annotations

import contextlib
import io
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))

import _krug  # noqa: E402
from _db import target  # noqa: E402
from _izvodi import IZVODI, nadji, svi  # noqa: E402

ANALIZIRANI = IZVODI / 'Analizirani_izvodi'
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


def main() -> None:
    args = sys.argv[1:]
    suho, detalji = '--suho' in args, '--detalji' in args
    dodatni = [args[i + 1] for i, a in enumerate(args) if a == '--izvod' and i + 1 < len(args)]
    env = target()
    print(f'[{env.upper()}] Mjesečni krug' + ('  (--suho: ništa se ne upisuje ni ne premješta)' if suho else ''))

    rz = razvrstaj(apply=not suho)
    nove = [ln for ln in rz.splitlines() if 'KOPIRAJ' in ln or 'PREIMENUJ' in ln or '✗' in ln]
    print('Razvrstač: ' + ('; '.join(ln.strip() for ln in nove) if nove else 'ništa novo u inboxu'))

    korijen = sorted(p for p in IZVODI.glob('*.pdf') if p.is_file())
    pdfs = korijen + [nadji(x) for x in dodatni if nadji(x) not in korijen]
    neznani = [p for p in pdfs if not _krug.prefiks(p)]
    pdfs = [p for p in pdfs if _krug.prefiks(p)]
    popis = ', '.join(p.name for p in pdfs) or 'nijedan u korijenu izvodi' + chr(92)
    print(f'Izvodi: {popis}'
          + (f'  (preskočeno, nepoznato ime: {", ".join(p.name for p in neznani)})' if neznani else ''))
    if not pdfs:
        return

    k = _krug.ucitaj(env)
    print(f'Baza: {len(k.db)} eventa · {len(k.sidra)} sidara · danas {k.danas:%d.%m.%Y.}\n')
    stanja = _krug.obradi(k, pdfs, svi)

    for s in stanja:
        if s.stanje == 'sidro' and s.sidro:
            if suho:
                s.ceka.append(f'(--suho) sidro {s.sidro["iznos"]:.2f} na {s.sidro["na"]} NIJE upisano')
            else:
                _krug.upisi_sidro(k, s.sidro['racun'], s.sidro['iznos'], s.sidro['na'], s.izvod)
                s.stanje = 'gotovo'
                s.sazetak += ' · UPISANO'

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

    gotovi = [s for s in stanja if s.stanje == 'gotovo']
    for s in gotovi:
        p = IZVODI / s.izvod
        if p.exists():
            if suho:
                print(f'(--suho) {s.izvod} bi otišao u Analizirani_izvodi\\')
            elif (ANALIZIRANI / s.izvod).exists():
                print(f'⚠ {s.izvod} je gotov, ali Analizirani_izvodi\\ već ima file istog imena — ostaje u korijenu')
            else:
                shutil.move(str(p), str(ANALIZIRANI / s.izvod))
                print(f'{s.izvod} → Analizirani_izvodi\\ (gotov)')

    n, m, b = (sum(getattr(s, x) for s in stanja) for x in ('novi', 'modify', 'brisanja'))
    print(f'\nUKUPNO: {len(gotovi)}/{len(stanja)} izvoda gotovo · za uvoz {n} New · {m} Modify'
          + (f' · {b} Delete' if b else '')
          + f' · odluka {sum(len(s.odluke) for s in stanja)}')


if __name__ == '__main__':
    main()
