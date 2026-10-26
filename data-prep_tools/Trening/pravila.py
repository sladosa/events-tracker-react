# -*- coding: utf-8 -*-
"""
pravila.py — pravila izvođenja atributa (A2, PREUREDJIVANJE_SPEC §26). S185.

JEDAN izvor istine za čitanje brojeva iz teksta (DIARY `O`, `M`, `AM`) i za
pretvorbe na mjestu. Zovu ga:
  - `izvedi.py`     — nad bazom, unutar istog eventa (§26.2);
  - generator DIARY — prije uvoza, za ono što ide u drugu Areu (§26.5: san/HRV/bb
    iz privatnog `AM` ne smiju u `Health_Sasa` ni privremeno kao tekst).
/!\\ Kopija ovih regexa bilo gdje drugdje = drugo mjesto koje odluta.

Oblici su izmjereni na DIARY-ju 26.10. (spec §22.1). Samoprovjera:
    python pravila.py --test
(`izvedi.py --apply` odbija rad ako ona pada.)
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from typing import Callable

# ─────────────────────────────────────────────
# Parseri (čiste funkcije: tekst → broj / None)
# ─────────────────────────────────────────────

def _num(s: str) -> float:
    return float(s.replace(',', '.'))


_HR = re.compile(r'HR\s*(\d{2,3})\s*\(\s*(\d{2,3})\s*\)')
# t.ef.2,3 (2015–2020, samo aerobni) · t.ef.2,3/0 (2021.→, i anaerobni)
_TE = re.compile(r't\.?\s*ef\.?\s*(\d(?:[,.]\d)?)(?:\s*/\s*(\d(?:[,.]\d)?))?', re.I)
_KCAL = re.compile(r'(\d{2,4})\s*k?cal\b', re.I)          # 63 × `cal` od 2020.
_OPT = re.compile(r'\bopt\s*(\d{1,3})', re.I)             # Garmin opterećenje (Saša 26.10.)
_VR = re.compile(r'\bv\.?\s*r\.?\s*(\d{2,4})', re.I)      # visinska razlika (Saša 26.10.)
_TIME = re.compile(r'^\s*(\d{1,2})(?::(\d{2})|h)(?!\d)')  # `16:30 …`, `9:00 …`, `16h …`


def hr(o: str | None) -> tuple[int, int] | None:
    m = _HR.search(o or '')
    return (int(m[1]), int(m[2])) if m else None


def te(o: str | None) -> tuple[float, float | None] | None:
    m = _TE.search(o or '')
    if not m:
        return None
    return _num(m[1]), (_num(m[2]) if m[2] else None)


def kcal(o: str | None) -> int | None:
    m = _KCAL.search(o or '')
    return int(m[1]) if m else None


def opt(o: str | None) -> int | None:
    m = _OPT.search(o or '')
    return int(m[1]) if m else None


def vr(o: str | None) -> int | None:
    m = _VR.search(o or '')
    return int(m[1]) if m else None


def vrijeme(m_text: str | None) -> str | None:
    """Vrijeme na početku `M` komentara → 'HH:MM'. Ne ulazi u identitet (session_start)."""
    m = _TIME.match(m_text or '')
    if not m:
        return None
    h, mi = int(m[1]), int(m[2] or 0)
    return f'{h:02d}:{mi:02d}' if h < 24 and mi < 60 else None


def _am_prefix(am: str | None) -> list[str]:
    """Prva tri zarezom odvojena dijela — brojevi žive samo ondje; ostatak je privatan tekst."""
    return [t.strip() for t in re.split(r'[,]', am or '')[:3]]


def am_san(am: str | None) -> int | None:
    m = re.match(r'\s*(\d{1,3})\s*%', am or '')
    return int(m[1]) if m else None


def am_hrv(am: str | None) -> int | None:
    for t in _am_prefix(am)[1:]:
        m = re.fullmatch(r'(\d{2,3})\s*HRV|HRV\s*(\d{2,3})', t, re.I)
        if m:
            return int(m[1] or m[2])
    return None


def am_bb(am: str | None) -> int | None:
    for t in _am_prefix(am)[1:]:
        t = t.split(' - ')[0].strip()
        m = re.fullmatch(r'(\d{1,3})\s*bb|bb\s*(\d{1,3})', t, re.I)
        if m:
            return int(m[1] or m[2])
    return None


# ─────────────────────────────────────────────
# Pretvorbe na mjestu
# ─────────────────────────────────────────────

KJ_PO_KCAL = 4.184


def kj_u_kcal(v) -> int | None:
    """Garmin `summarizedActivities.calories` je u kJ, a `garmin_activities_to_xlsx.py`
    ga je do S185 upisivao u `kcal` bez pretvorbe (spec §22.3: omjer 4,19 na 1.794 dana)."""
    if v is None:
        return None
    return round(float(v) / KJ_PO_KCAL)


# ─────────────────────────────────────────────
# Registar pravila (izvedi.py --pravilo <ime>)
# ─────────────────────────────────────────────

@dataclass(frozen=True)
class Pravilo:
    ime: str
    opis: str
    cilj: str                        # slug ciljnog atributa (number ili text)
    izvor: str | None                # slug izvornog atributa · 'comment' · None = cilj sam
    racun: Callable[[object], object | None]
    # Pretvorba na mjestu: drugi prolaz bi je ponovio (kJ → kcal dvaput). Alat
    # odbija ako u bazi već postoji neponištena operacija istog pravila.
    jednokratno: bool = False
    # Izvor je privatan tekst: pregled ne smije ispisati sadržaj, samo oblik.
    privatno: bool = False


PRAVILA: dict[str, Pravilo] = {p.ime: p for p in [
    Pravilo('kcal_kj', 'kcal treninga iz kJ (Garmin GDPR izvoz) u kcal', cilj='kcal', izvor=None,
            racun=kj_u_kcal, jednokratno=True),
    # DIARY pravila (`O` → Activity) dolaze s generatorom: izvorni atribut se još ne zove.
]}


# ─────────────────────────────────────────────
# Samoprovjera — sintetički primjeri OBLIKA iz §22.1 (bez privatnog teksta)
# ─────────────────────────────────────────────

_PRIMJERI = [
    (hr, 'HR 110(134), t.ef.2,3/0 394kcal, opt35', (110, 134)),
    (hr, 'HR 99 (127)', (99, 127)),
    (hr, 'VO2max 52, 600kcal', None),
    (te, 'HR 110(134), t.ef.2,3/0 394kcal', (2.3, 0.0)),
    (te, 'HR 128(150) t.ef.3,1 612kcal', (3.1, None)),
    (te, 't.ef.4/2,1', (4.0, 2.1)),
    (kcal, 'HR 110(134), t.ef.2,3/0 394kcal', 394),
    (kcal, 'HR 120(140) 512cal', 512),
    (kcal, 'HR 120(140)', None),
    (opt, 'HR 110(134) 394kcal opt35', 35),
    (opt, 'optimalno', None),
    (vr, 'v.r.190 HR 120(140)', 190),
    (vr, 'vr 85, HR 120(140)', 85),
    (vr, 'VO2max 52', None),
    (vr, 'povratak 150', None),
    (vrijeme, '16:30 Sljeme', '16:30'),
    (vrijeme, '9:00 teretana', '09:00'),
    (vrijeme, '16h trčanje', '16:00'),
    (vrijeme, 'trčao 10 km', None),
    (vrijeme, '25:00 nešto', None),
    (am_san, '78%, 45HRV, 62bb - tekst', 78),
    (am_hrv, '78%, 45HRV, 62bb - tekst', 45),
    (am_bb, '78%, 45HRV, 62bb - tekst', 62),
    (am_hrv, '80%, HRV52, bb70, tekst', 52),
    (am_bb, '80%, HRV52, bb70, tekst', 70),
    (am_bb, '81%, 44HRV, tekst', None),
    (am_hrv, '78%, 45hev, 62bb', None),           # tipfeler ⇒ nepogođeno, ne pogađanje
    (am_san, 'tekst bez prefiksa', None),
    (kj_u_kcal, 1454, 348),
    (kj_u_kcal, None, None),
]


def selftest(verbose: bool = False) -> bool:
    bad = 0
    for fn, ulaz, ocek in _PRIMJERI:
        got = fn(ulaz)
        okk = got == ocek
        bad += not okk
        if verbose or not okk:
            print(f"  {'PASS' if okk else 'FAIL'}  {fn.__name__}({ulaz!r}) = {got!r}" + ('' if okk else f'  (očekivano {ocek!r})'))
    if verbose:
        print(f'\n{len(_PRIMJERI) - bad} prošlo, {bad} palo')
    return bad == 0


if __name__ == '__main__':
    if '--test' in sys.argv:
        sys.exit(0 if selftest(verbose=True) else 1)
    for p in PRAVILA.values():
        print(f'{p.ime:12} → {p.cilj:16} izvor: {p.izvor or "(cilj sam)"} — {p.opis}')
