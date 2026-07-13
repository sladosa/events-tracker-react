# -*- coding: utf-8 -*-
"""
rf_ocr.py  (S107d, 2026-07-13)
==============================
OCR parser za Sašine Raiffeisen (RBA) izvode tekućeg računa — PDF-ovi NEMAJU
tekst-sloj (tekst pretvoren u vektorske krivulje), pa se stranice renderiraju
(pypdfium2, 300 DPI) i čitaju RapidOCR-om (onnxruntime, offline).

VAŽNO — full-page OCR TIHO GUBI pojedine retke (detekcija preskoči dugu liniju;
viđeno na 2 od 6 transakcija uzorka!) → stranica se OCR-a u HORIZONTALNIM
TRAKAMA s preklopom, pa se boxovi dedupliciraju. Traka > visina retka, svaki
red je cijel u barem jednoj traci.

Pouzdanost: svaki tx red izvoda ima tekuće "Stanje računa" → parser radi
chain-validaciju (stanje_prije - isplata + uplata == stanje_reda). Red koji
ne prolazi dobiva ' [OCR?]' sufiks u opisu + warning (i resync na stanje reda
da jedna greška ne kaskadira).

Format iznosa je engleski: '2,508.47 EUR' (zarez tisućice, točka decimale).
OCR gubi razmake ('RBAISPLATAGOTOVI...') — nebitno za match (datum+iznos+smjer)
i za apply_rules (substring pretraga radi i bez razmaka).

Koristi ga enrich_from_izvoda.py (SOURCE_TYPES['RF']) i inventory_izvoda.py
(klasifikacija NOTEXT fajlova + parse). ~25 s po stranici — inventory kešira
parsirane transakcije po md5 pa se OCR plaća samo jednom po fajlu.
"""

import re
import sys
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium

DPI        = 300
STRIP_PX   = 400          # visina trake (px na 300 DPI)
OVERLAP_PX = 60           # preklop > visine retka (~45 px)
LINE_TOL   = 14           # y-tolerancija grupiranja boxova u linije

RE_RF_DATE   = re.compile(r'^(\d{2})\.(\d{2})\.(\d{4})\.?(.*)$')
RE_RF_AMOUNT = re.compile(r'^[+-]?\d{1,3}(?:,\d{3})*\.\d{2}(?:EUR)?$')

# linije koje prekidaju tekuću transakciju (footer/poruke banke)
STOP_MARKERS = ('PORUKABANKE', 'OVAJDOKUMENTSADRZI', 'SWIFTRZBHHR2X',
                'RBADIREKTINFO', 'GUBITAKILIKRADU', 'OIB:53056966535')
# continuation linije koje se preskaču (ne ulaze u opis, ne zatvaraju tx)
SKIP_PREFIXES = ('REFERENCA', 'IZNOSTRANSAKCIJE')

_ocr = None


def _get_ocr():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


def parse_rf_amount(s: str) -> float:
    return round(float(s.replace('EUR', '').replace(',', '').lstrip('+')), 2)


def _norm(s: str) -> str:
    return re.sub(r'\s+', '', s).upper()


def ocr_page_boxes(arr: np.ndarray) -> list[tuple]:
    """Strip-based OCR → [(ycen, x0, x1, text)] u globalnim koordinatama,
    deduplicirano preko preklopa traka."""
    ocr = _get_ocr()
    H = arr.shape[0]
    raw: list[tuple] = []
    y = 0
    while y < H:
        strip = arr[y:min(H, y + STRIP_PX + OVERLAP_PX), :, :]
        result, _ = ocr(strip)
        for box, text, _conf in (result or []):
            ys = [p[1] for p in box]
            top, bot = min(ys), max(ys)
            # box koji traka reže na rubu preskačemo — cijel je u susjednoj traci
            if (top < 2 and y > 0) or (bot > strip.shape[0] - 2 and y + STRIP_PX < H):
                continue
            xs = [p[0] for p in box]
            raw.append((y + (top + bot) / 2, min(xs), max(xs), text.strip()))
        y += STRIP_PX
    raw.sort(key=lambda b: (b[0], b[1]))
    boxes: list[tuple] = []
    for b in raw:                      # dedup: isti tekst na ~istoj poziciji
        if any(abs(b[0] - o[0]) < 18 and abs(b[1] - o[1]) < 25 and b[3] == o[3]
               for o in boxes[-8:]):
            continue
        boxes.append(b)
    return boxes


def _group_lines(boxes: list[tuple]) -> list[list[tuple]]:
    lines: list[list[tuple]] = []
    for b in boxes:
        if lines and abs(b[0] - lines[-1][-1][0]) < LINE_TOL:
            lines[-1].append(b)
        else:
            lines.append([b])
    for ln in lines:
        ln.sort(key=lambda b: b[1])
    return lines


def ocr_page1_head(path: Path) -> str:
    """Tekst vrha 1. stranice (za klasifikaciju NOTEXT PDF-ova) — 1 OCR poziv."""
    pdf = pdfium.PdfDocument(path)
    try:
        arr = np.array(pdf[0].render(scale=DPI / 72).to_pil())
        result, _ = _get_ocr()(arr[:600, :, :])
        return _norm(' '.join(t for _, t, _ in (result or [])))
    finally:
        pdf.close()


def parse_rf_ocr(path: Path) -> list[dict]:
    """RBA 'Izvadak o stanju i prometu po tekućem računu' → [{date, opis,
    iznos, smjer, kartica, src}]. Tx red = datum + iznos u Isplata/Uplata
    koloni + tekuće stanje; kolone se prepoznaju po x-poziciji headera."""
    from datetime import date
    txs: list[dict] = []
    balance: float | None = None
    isplata_x = uplata_x = stanje_x = None
    flagged = 0

    pdf = pdfium.PdfDocument(path)
    try:
        npages = len(pdf)
        for pno in range(npages):
            arr = np.array(pdf[pno].render(scale=DPI / 72).to_pil())
            lines = _group_lines(ocr_page_boxes(arr))
            current: dict | None = None
            cont_left = 0
            for ln in lines:
                joined = _norm(''.join(b[3] for b in ln))
                if any(m in joined for m in STOP_MARKERS):
                    current = None
                    continue
                # header tablice → x-ankeri kolona
                if 'ISPLATA' in joined and 'UPLATA' in joined:
                    for b in ln:
                        t = _norm(b[3]); xc = (b[1] + b[2]) / 2
                        if t == 'ISPLATA':
                            isplata_x = xc
                        elif t == 'UPLATA':
                            uplata_x = xc
                        elif t.startswith('STANJE'):
                            stanje_x = xc
                    current = None
                    continue
                # iznosi na liniji, po koloni
                amt_i = amt_u = amt_s = None
                text_parts: list[str] = []
                for b in ln:
                    t = b[3].replace(' ', '')
                    if RE_RF_AMOUNT.match(t) and isplata_x is not None:
                        xc = (b[1] + b[2]) / 2
                        col = min((('i', isplata_x), ('u', uplata_x), ('s', stanje_x)),
                                  key=lambda cx: abs(xc - cx[1]))[0]
                        val = parse_rf_amount(t)
                        if col == 'i':
                            amt_i = val
                        elif col == 'u':
                            amt_u = val
                        else:
                            amt_s = val
                    else:
                        text_parts.append(b[3])
                text = ' '.join(text_parts).strip()

                if 'POCETNOSTANJE' in joined:
                    if amt_s is not None:
                        balance = amt_s
                    current = None
                    continue

                m = RE_RF_DATE.match(text.replace(' ', '', 1) if text[:1].isdigit() else text)
                # pravi tx red UVIJEK nosi tekuće stanje — bez njega je linija
                # informativni blok (npr. specifikacija mirovine s iznosima)
                has_amount = (amt_i is not None or amt_u is not None) and amt_s is not None
                if m and has_amount:
                    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                    opis = m.group(4).strip()
                    current = {
                        'date': d, 'opis': opis,
                        'iznos': amt_i if amt_i is not None else amt_u,
                        'smjer': 'Isplata' if amt_i is not None else 'Uplata',
                        'kartica': '', 'src': f'{path.name}:p{pno + 1}',
                        '_stanje': amt_s,
                    }
                    txs.append(current)
                    cont_left = 3
                elif has_amount and current is None and txs:
                    # OCR izgubio datum retka — naslijedi datum prethodnog tx-a
                    prev = txs[-1]
                    current = {
                        'date': prev['date'], 'opis': (text or '(nečitljiv opis)') + ' [OCR?]',
                        'iznos': amt_i if amt_i is not None else amt_u,
                        'smjer': 'Isplata' if amt_i is not None else 'Uplata',
                        'kartica': '', 'src': f'{path.name}:p{pno + 1}',
                        '_stanje': amt_s,
                    }
                    txs.append(current)
                    cont_left = 3
                    flagged += 1
                elif current and text and cont_left > 0:
                    nt = _norm(text)
                    if any(nt.startswith(p) for p in SKIP_PREFIXES):
                        continue
                    current['opis'] += ' ' + text
                    cont_left -= 1

    finally:
        pdf.close()

    # chain-validacija preko tekućeg stanja
    for t in txs:
        exp = None
        if balance is not None:
            exp = round(balance - t['iznos'], 2) if t['smjer'] == 'Isplata' \
                else round(balance + t['iznos'], 2)
        st = t.pop('_stanje')
        if st is not None and exp is not None and abs(st - exp) > 0.01:
            if '[OCR?]' not in t['opis']:
                t['opis'] += ' [OCR?]'
                flagged += 1
            print(f'  ⚠ {t["src"]}: stanje-chain mismatch ({t["date"]} '
                  f'{t["smjer"]} {t["iznos"]:.2f}: očekivano {exp}, na izvodu {st})')
        balance = st if st is not None else exp

    if flagged:
        print(f'  ⚠ {path.name}: {flagged} redova označeno [OCR?] — provjeriti ručno')
    return txs


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    p = Path(sys.argv[1])
    for t in parse_rf_ocr(p):
        print(f'{t["date"]} {t["smjer"]:<7} {t["iznos"]:>10.2f}  {t["opis"][:80]}')
