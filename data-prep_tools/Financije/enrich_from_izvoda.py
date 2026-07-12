# -*- coding: utf-8 -*-
"""
enrich_from_izvoda.py  (S107c prototip, 2026-07-12)
===================================================
Izvod enrichment (FINANCIJE_MIGRACIJA.md §12.5): čita bankovne e-izvode (PDF) iz
`data-prep_data/Financije/izvodi/`, matcha transakcije na redove REVIEW Excela
(datum ±2 dana + iznos + smjer, isti mehanizam kao Za Sašu labele) i upisuje
opis s izvoda u NOVE kolone Review sheeta:

    'Izvod opis'  — opis prometa s izvoda (primatelj/merchant)
    'Izvod file'  — iz kojeg filea/retka dolazi (kontrola)

RUČNI RAD SE NE DIRA — pune se samo 'Izvod *' kolone. Nakon ovoga pokreni
apply_rules.py: pravila pretražuju i 'Izvod *' kolone → auto Tip/Podtip.

Podržani formati (registry PARSERS na dnu — proširivati po potrebi):
  ZABA_*.pdf  — izvadak Kokinog tekućeg računa (tekst-sloj) ✅ radi
  RF_*.pdf    — Sašin RF: NEMA tekst-sloja (vektorske krivulje) → preskače se
                uz upozorenje; treba OCR ili CSV export iz RF aplikacije
  MC_*.pdf    — ZABA Mastercard IZVOD KARTICE (itemizirane kupovine) — TODO:
                parser se dodaje kad Koka skine prve uzorke (v. ENRICH_PLAN.md)

Pokretanje (review file zatvoren u Excelu!):
  Financije\\run.bat enrich_from_izvoda.py            → najnoviji review + svi PDF-ovi
  ... enrich_from_izvoda.py --dry                     → bez snimanja, samo report
  ... enrich_from_izvoda.py <review.xlsx> [--dry]
"""

import re
import shutil
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl
import pdfplumber
from openpyxl.styles import Border, Font, PatternFill, Side

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR   = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije")
IZVODI_DIR = DATA_DIR / 'izvodi'

RACUN_KOKA = 'Kokin tekući ZABA'
RACUN_SASA = 'Sašin tekući RF'

HDR_FILL   = PatternFill('solid', fgColor='4472C4')
WHITE_BOLD = Font(color='FFFFFF', bold=True)
THIN       = Side(style='thin')
BORDER     = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

RE_DATE   = re.compile(r'^(\d{2})\.(\d{2})\.(\d{4})\.$')
RE_REF    = re.compile(r'^[A-Z]\d{12,18}$')
RE_AMOUNT = re.compile(r'^-?\d{1,3}(?:\.\d{3})*,\d{2}$')


def parse_amount(s: str) -> float:
    return round(float(s.replace('.', '').replace(',', '.')), 2)


# ── Parser: ZABA izvadak tekućeg računa ────────────────────────────────────────

def parse_zaba_racun(path: Path) -> list[dict]:
    """→ [{date, opis, iznos, smjer('Uplata'/'Isplata'), src}]
    Transakcijska linija: 'dd.mm.yyyy. REFERENCA Opis ... IZNOS' + eventualne
    continuation linije opisa. Priljev/Odljev se razlikuje po x-poziciji iznosa
    (granica = sredina između header riječi 'Priljev' i 'Odljev')."""
    txs: list[dict] = []
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            # gate: stranica mora imati tablicu prometa
            priljev_x = odljev_x = None
            for w in words:
                if w['text'] == 'Priljev':
                    priljev_x = (w['x0'] + w['x1']) / 2
                elif w['text'] == 'Odljev':
                    odljev_x = (w['x0'] + w['x1']) / 2
            if priljev_x is None or odljev_x is None:
                continue
            boundary = (priljev_x + odljev_x) / 2

            # grupiraj riječi u linije po y (top zaokružen)
            lines: dict[float, list] = defaultdict(list)
            for w in words:
                lines[round(w['top'], 0)].append(w)
            current: dict | None = None
            cont_left = 0
            for top in sorted(lines):
                ws_ = sorted(lines[top], key=lambda w: w['x0'])
                tokens = [w['text'] for w in ws_]
                m = RE_DATE.match(tokens[0]) if tokens else None
                if m:
                    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                    # zadnji token koji izgleda kao iznos
                    amt_w = next((w for w in reversed(ws_) if RE_AMOUNT.match(w['text'])), None)
                    if amt_w is None:
                        current = None
                        continue
                    smjer = 'Uplata' if (amt_w['x0'] + amt_w['x1']) / 2 < boundary else 'Isplata'
                    mid = [t for t, w in zip(tokens[1:], ws_[1:]) if w is not amt_w]
                    if mid and RE_REF.match(mid[0]):
                        mid = mid[1:]          # makni referencu (O16023...)
                    current = {
                        'date': d, 'opis': ' '.join(mid),
                        'iznos': parse_amount(amt_w['text']), 'smjer': smjer,
                        'src': f'{path.name}:p{pno}',
                    }
                    txs.append(current)
                    cont_left = 2              # opis se prelama u max ~2 dodatna reda
                elif current and cont_left > 0 and tokens:
                    first = tokens[0]
                    if first.isupper() and ('STANJE' in first or first in ('IZVADAK', 'S/N:')):
                        current = None
                        continue
                    current['opis'] += ' ' + ' '.join(tokens)
                    cont_left -= 1
                else:
                    current = None
    return txs


def parse_rf_racun(path: Path) -> list[dict]:
    print(f'  ⚠ {path.name}: RF PDF nema tekst-sloj (vektorske krivulje) — PRESKOČEN.')
    print('    Opcije: CSV/Excel export iz RF aplikacije ili OCR (v. ENRICH_PLAN.md).')
    return []


# TODO (sljedeća sesija): parser za ZABA Mastercard IZVOD KARTICE (MC_*.pdf) —
# itemizirane kupovine s merchant imenima; dodati kad stignu prvi uzorci.
# Račun za match = RACUN_KOKA, Izvor='Mastercard', datum s izvoda kartice =
# datum KUPOVINE (event_date u Review), smjer='Isplata'.

PARSERS: list[tuple[str, callable, str, str]] = [
    # (filename prefix, parser, racun za match, Izvor za match)
    ('ZABA', parse_zaba_racun, RACUN_KOKA, 'Racun'),
    ('RF',   parse_rf_racun,   RACUN_SASA, 'Racun'),
    # ('MC', parse_zaba_kartica, RACUN_KOKA, 'Mastercard'),   # TODO
]


# ── Review match & write ───────────────────────────────────────────────────────

def pick_file(args: list[str]) -> Path:
    explicit = [a for a in args if not a.startswith('--')]
    if explicit:
        p = Path(explicit[0])
        if not p.exists():
            sys.exit(f'✗ File ne postoji: {p}')
        return p
    candidates = sorted(DATA_DIR.glob('Financije_review_*.xlsx'),
                        key=lambda p: p.stat().st_mtime, reverse=True)
    candidates = [c for c in candidates
                  if '.pre-sync-' not in c.name and '.pre-rules-' not in c.name
                  and '.pre-izvod-' not in c.name]
    if not candidates:
        sys.exit(f'✗ Nema Financije_review_*.xlsx u {DATA_DIR}')
    return candidates[0]


def find_header_col(ws, header: str, create: bool = False) -> int:
    for c in range(1, ws.max_column + 1):
        if str(ws.cell(1, c).value or '').strip() == header:
            return c
    if not create:
        sys.exit(f'✗ Kolona "{header}" nije nađena u Review sheetu.')
    c = ws.max_column + 1
    cell = ws.cell(1, c, header)
    cell.fill, cell.font, cell.border = HDR_FILL, WHITE_BOLD, BORDER
    ws.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 34 if 'opis' in header else 22
    return c


def to_date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


def main() -> None:
    args = sys.argv[1:]
    dry = '--dry' in args
    path = pick_file(args)
    print(f'Review: {path.name}{"  [DRY RUN]" if dry else ""}')

    # 1. Parsiraj sve PDF-ove
    all_tx: list[tuple[dict, str, str]] = []   # (tx, racun, izvor)
    pdfs = sorted(IZVODI_DIR.glob('*.pdf'))
    if not pdfs:
        sys.exit(f'✗ Nema PDF-ova u {IZVODI_DIR}')
    for pdf in pdfs:
        parser = next(((fn, rac, izv) for pref, fn, rac, izv in PARSERS
                       if pdf.name.upper().startswith(pref)), None)
        if parser is None:
            print(f'  ⚠ {pdf.name}: nepoznat prefix — preskočen (dodaj parser u PARSERS)')
            continue
        fn, racun, izvor = parser
        txs = fn(pdf)
        if txs:
            print(f'  ✔ {pdf.name}: {len(txs)} transakcija')
        all_tx.extend((t, racun, izvor) for t in txs)
    if not all_tx:
        sys.exit('✗ Nijedna transakcija parsirana — nema se što matchati.')

    # 2. Učitaj Review i indeksiraj kandidate: (racun, izvor, smjer, datum, iznos) → [row]
    wb = openpyxl.load_workbook(path)
    ws = wb['Review']
    col = {h: find_header_col(ws, h) for h in
           ('Racun', 'event_date', 'Smjer', 'Izvor', 'Uplata', 'Isplata', 'Napomena')}
    col_iopis = find_header_col(ws, 'Izvod opis', create=True)
    col_ifile = find_header_col(ws, 'Izvod file', create=True)

    index: dict[tuple, list[int]] = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        d = to_date(ws.cell(r, col['event_date']).value)
        if d is None:
            continue
        racun = str(ws.cell(r, col['Racun']).value or '')
        izvor = str(ws.cell(r, col['Izvor']).value or '')
        smjer = str(ws.cell(r, col['Smjer']).value or '')
        iznos = ws.cell(r, col['Uplata' if smjer == 'Uplata' else 'Isplata']).value
        if iznos is None:
            continue
        index[(racun, izvor, smjer, d, round(float(iznos), 2))].append(r)

    used: set[int] = set()
    matched, unmatched = 0, []
    for tx, racun, izvor in all_tx:
        row = None
        for delta in (0, 1, -1, 2, -2):
            key = (racun, izvor, tx['smjer'], tx['date'] + timedelta(days=delta), tx['iznos'])
            row = next((r for r in index.get(key, []) if r not in used), None)
            if row:
                break
        if row is None:
            unmatched.append(tx)
            continue
        used.add(row)
        matched += 1
        if not dry:
            ws.cell(row, col_iopis, tx['opis'][:250])
            ws.cell(row, col_ifile, tx['src'])

    # 3. Report + save
    print(f'\nMatchano: {matched}/{len(all_tx)} transakcija → kolone "Izvod opis"/"Izvod file"')
    if unmatched:
        print(f'Nematchano ({len(unmatched)}) — očekivano za lump/kartične retke koji nisu u Review kao Racun redovi:')
        for t in unmatched[:15]:
            print(f'  {t["date"]} {t["smjer"]:<7} {t["iznos"]:>10.2f}  {t["opis"][:60]}')
        if len(unmatched) > 15:
            print(f'  ... i još {len(unmatched) - 15}')

    if dry or not matched:
        return
    backup = path.with_name(f'{path.stem}.pre-izvod-{datetime.now():%Y%m%d_%H%M%S}.xlsx')
    shutil.copy2(path, backup)
    try:
        wb.save(path)
    except PermissionError:
        sys.exit(f'✗ Ne mogu snimiti — zatvori file u Excelu i ponovi. (Backup: {backup.name})')
    print(f'✔ Snimljeno. Backup: {backup.name}')
    print('  Sljedeći korak: apply_rules.py (pravila vide i "Izvod opis" kolonu).')


if __name__ == '__main__':
    main()
