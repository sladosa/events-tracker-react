# -*- coding: utf-8 -*-
"""
_izvodi.py — gdje su PDF izvodi i kako se nadju po imenu. S158.

Bez `pdfplumber`a (isti razlog kao `_db.py`): alat koji samo trazi file ne
smije pasti zato sto na stroju nema PDF citaca.

/!\\ `Analizirani_izvodi/` vise NIJE uvjet da te alat vidi.
    Do S158 su `make_saldo_anchors`, `pregled_stanja` (pa i `promet_check`)
    citali SAMO tu mapu, a selidba u nju je rucna i nitko je ne radi u
    trenutku obrade. Izvod koji ostane u korijenu `izvodi/` za njih tiho nije
    postojao (CLAUDE.md, S129). Sada svi citaju cijeli `izvodi/`, pa je razlika
    korijen / `Analizirani_izvodi/` samo oznaka za covjeka.
/!\\ `duplikati/` se preskace: ondje su drugi bajtovi istog izvoda
    (`RF_2026-06b.pdf`) i neimenovani PDF-ovi — brojani bi bili dvaput.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IZVODI = ROOT / 'data-prep_data' / 'Financije' / 'izvodi'


def svi(pattern: str = '*.pdf') -> list[Path]:
    """Svi izvodi koji odgovaraju uzorku, iz `izvodi/` i podmapa osim `duplikati/`.
    Jedan po imenu — razvrstac isto ime s drugim sadrzajem ionako ne kopira."""
    nadjeni = {}
    for p in sorted(IZVODI.rglob(pattern)):
        if 'duplikati' in p.relative_to(IZVODI).parts:
            continue
        nadjeni.setdefault(p.name, p)
    return sorted(nadjeni.values(), key=lambda p: p.name)


def nadji(arg: str | Path) -> Path:
    """Putanja ako postoji, inace ime trazeno u `izvodi/` (`MC_2026-09.pdf`)."""
    p = Path(arg)
    if p.exists():
        return p
    hit = svi(p.name)
    if not hit:
        sys.exit('✗ Nema ' + str(arg) + ' ni u izvodi/ ni u njegovim podmapama.')
    return hit[0]


def put(ime: str) -> Path | None:
    """Kao `nadji`, ali bez izlaska — za alate koji nepostojeci izvod samo preskoce."""
    hit = svi(ime)
    return hit[0] if hit else None
