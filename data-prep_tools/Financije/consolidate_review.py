# -*- coding: utf-8 -*-
"""
consolidate_review.py  (S107j, 2026-07-22)
==========================================
Zatvori izvod-matching: sve što je JASNO iz `Izvodi_transakcije.xlsx` upiši u Review
kao nove retke, a dvojbeni ostatak stavi u sheet **`Nematchano_v3`** UNUTAR Review
workbooka (side-by-side izvod↔Review kandidat + Transfer Y/n + saldo-hint), da dalji
rad živi u Review a Izvodi_transakcije.xlsx više ne treba za odluke.

Klasifikacija nematchanih izvod-tx (match = ±2 dana isti Racun/Izvor/Smjer/Iznos):
  DODAJ u Review:
    • ZABA "TROŠKOVI UČINJENI MASTERCARD KARTICOM" (mjesečni lump) → Tip=Transfer/
      izmedju racuna (novac s tekućeg na karticu; itemizirano posebno preko MC izvoda,
      pa Transfer isključuje dvostruko brojanje)
    • MC/Visa kartična kupovina bez para → nova Isplata/Uplata (Izvor=Mastercard/Visa),
      Tip=N/A (klasificira ih apply_rules / Neklasificirano petlja)
    • ZABA/RF account tx bez para → nova Isplata/Uplata (Izvor=Racun), Tip=N/A
  → Nematchano_v3 (ručni pregled, NE dodaje se auto):
    • "možda već u Reviewu" (isti iznos, datum izvan ±7d) — vjerojatan duplikat
    • "Smjer?" (isti iznos ±7d, suprotan smjer)

Saldo-hint: po ZABA mjesecu usporedi Kokin month-end `Stanje` (Racun redovi) s bankovnim
NOVO STANJE — mjesec koji balansira ⇒ dvojbeni ZABA redak je vjerojatno dup; manjak ⇒
kandidat za dodati. Piše se i zaseban `Saldo kontrola` sheet (svi ZABA mjeseci).

Idempotentno (source_key skip). Backup Review prije snimanja.

Pokretanje (Review + Izvodi_transakcije zatvoreni u Excelu!):
  Financije\\run.bat consolidate_review.py --dry   → PREVIEW (consolidate_PREVIEW.xlsx), Review netaknut
  Financije\\run.bat consolidate_review.py         → dodaj retke + Nematchano_v3 + Saldo kontrola
"""

import hashlib
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl
from openpyxl.styles import Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from enrich_from_izvoda import _parse_zaba_all, _zaba_is_tekuci  # noqa: E402

DATA_DIR = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije")
IZVODI   = DATA_DIR / 'izvodi' / 'Analizirani_izvodi'
TX_XLSX  = DATA_DIR / 'izvodi' / 'Izvodi_transakcije.xlsx'
PREVIEW  = DATA_DIR / 'consolidate_PREVIEW.xlsx'

RACUN_KOKA = 'Kokin tekući ZABA'
RACUN_SASA = 'Sašin tekući RF'
SRC_MAP = {  # Src prefix → (Racun, Izvor)  [post-merge istina]
    'ZABA':    (RACUN_KOKA, 'Racun'),
    'RF':      (RACUN_SASA, 'Racun'),
    'MC':      (RACUN_KOKA, 'Mastercard'),
    'PBZVISA': (RACUN_SASA, 'Visa'),
}
MATCH_DELTAS = (0, 1, -1, 2, -2)
MC_LUMP = 'TROŠKOVI UČINJENI MASTERCARD KARTICOM'

HDR_FILL   = PatternFill('solid', fgColor='C55A11')
V3_IZV_FILL = PatternFill('solid', fgColor='FCE4D6')   # izvod redak (svijetlo narančasto)
V3_REV_FILL = PatternFill('solid', fgColor='E2EFDA')   # review kandidat (svijetlo zeleno)
WHITE_BOLD = Font(color='FFFFFF', bold=True)
THIN = Side(style='thin')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def src_prefix(src: str) -> str:
    s = str(src or '').upper()
    for p in ('PBZVISA', 'ZABA', 'MC', 'RF'):
        if s.startswith(p):
            return p
    return '?'


def to_date(v):
    try:
        return v.date()
    except Exception:
        return v if hasattr(v, 'year') else None


def pick_review(args):
    explicit = [a for a in args if not a.startswith('--')]
    if explicit:
        p = Path(explicit[0])
        if not p.exists():
            sys.exit(f'✗ File ne postoji: {p}')
        return p
    cands = sorted([c for c in DATA_DIR.glob('Financije_review_*.xlsx') if '.pre-' not in c.name],
                   key=lambda p: p.stat().st_mtime, reverse=True)
    if not cands:
        sys.exit('✗ Nema Financije_review_*.xlsx')
    return cands[0]


def hdr_index(ws):
    return {str(c.value).strip(): c.column for c in ws[1] if c.value is not None}


def load_tx():
    wb = openpyxl.load_workbook(TX_XLSX, read_only=True)
    ws = wb['Transakcije']
    h = {str(c.value): i for i, c in enumerate(ws[1]) if c.value is not None}
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        d = to_date(row[h['Datum']])
        pref = src_prefix(row[h['Src']])
        if d is None or pref not in SRC_MAP:
            continue
        racun, izvor = SRC_MAP[pref]
        out.append({'date': d, 'opis': str(row[h['Opis']] or ''),
                    'smjer': str(row[h['Smjer']] or ''),
                    'iznos': round(float(row[h['Iznos']]), 2),
                    'src': str(row[h['Src']] or ''), 'pref': pref,
                    'racun': racun, 'izvor': izvor})
    wb.close()
    return out


def zaba_bank_saldo():
    """{'YYYY-MM': (close_date, novo_stanje)} bankovni Tekući račun. close_date =
    zadnja tekući transakcija izvatka (izvadak se zatvara par dana u idući mjesec,
    pa Kokin saldo treba uspoređivati NA taj datum, ne na kalendarski kraj mjeseca)."""
    out = {}
    for f in sorted(IZVODI.glob('ZABA_*.pdf')):
        txs, balances = _parse_zaba_all(f)
        tek = [t for t in txs if _zaba_is_tekuci(t['account'])]
        tb = [b for b in balances if _zaba_is_tekuci(b['account']) and b['novo'] is not None]
        if tek and tb:
            out[f.stem.split('_')[1]] = (max(t['date'] for t in tek), tb[-1]['novo'])
    return out


def source_key(tx, taken):
    canon = f"cons|{tx['racun']}|{tx['date']}|{tx['smjer']}|{tx['iznos']}|{tx['opis']}|{tx['src']}"
    key = hashlib.md5(canon.encode()).hexdigest()[:12]
    salt = 0
    while key in taken:
        salt += 1
        key = hashlib.md5(f'{canon}#{salt}'.encode()).hexdigest()[:12]
    taken.add(key)
    return key


def build_row(tx, col, ncols, skey, tip, podtip):
    row = [None] * ncols
    def put(name, val):
        if name in col:
            row[col[name] - 1] = val
    ed = datetime(tx['date'].year, tx['date'].month, tx['date'].day)
    is_lump = tip == 'Transfer'
    put('Racun', tx['racun'])
    put('event_date', ed)
    put('Datum naplate', ed if tx['izvor'] in ('Racun',) else None)  # Racun→=event_date (D1); kartica puni generator
    put('Smjer', tx['smjer'])
    put('Izvor', tx['izvor'])
    put('Uplata', tx['iznos'] if tx['smjer'] == 'Uplata' else None)
    put('Isplata', tx['iznos'] if tx['smjer'] == 'Isplata' else None)
    put('Napomena', None)
    put('Tip', tip); put('Podtip', podtip)
    put('Pouzdanost', 'VISOKA' if is_lump else 'NEMA')
    put('Tip_O', tip); put('Podtip_O', podtip)
    put('Status', 'Izvrsen')
    put('Izvor reda', f'Konsolidacija:{tx["pref"]}')
    put('source_key', skey)
    put('Izvod opis', tx['opis'][:250])
    put('Izvod file', tx['src'])
    return row


def classify(tx, cand_idx):
    """→ ('add', tip, podtip) ILI ('v3', problem)."""
    cands = cand_idx.get((tx['racun'], tx['izvor'], tx['iznos']), [])
    for c in cands:                                  # suprotan smjer, blizu → Smjer?
        if c['smjer'] != tx['smjer'] and abs((c['date'] - tx['date']).days) <= 7:
            return ('v3', 'Smjer? (suprotan smjer u Reviewu)', None)
    near = [c for c in cands if c['smjer'] == tx['smjer'] and abs((c['date'] - tx['date']).days) <= 31]
    if near:
        return ('v3', 'možda već u Reviewu (isti iznos, datum izvan ±7d)', None)
    if tx['pref'] == 'ZABA' and MC_LUMP in tx['opis'].upper():
        return ('add', 'Transfer', 'izmedju racuna')
    return ('add', 'N/A', None)


def sort_review(ws, col, ncols):
    n = ws.max_row
    recs = []
    for r in range(2, n + 1):
        d = to_date(ws.cell(r, col['event_date']).value)
        cells = [(ws.cell(r, c).value, ws.cell(r, c)._style) for c in range(1, ncols + 1)]
        recs.append(((d is None, d or datetime.min.date()), cells))
    recs.sort(key=lambda x: x[0])
    for i, (_, cells) in enumerate(recs):
        for c, (val, style) in enumerate(cells, 1):
            cell = ws.cell(2 + i, c)
            cell.value = val
            cell._style = style
    for dv in ws.data_validations.dataValidation:
        sq = str(dv.sqref)
        if sq.startswith('J'):
            dv.sqref = f'J2:J{n}'
        elif sq.startswith('K'):
            dv.sqref = f'K2:K{n}'
    if ws.auto_filter.ref:
        first = ws.auto_filter.ref.split(':')[0]
        ws.auto_filter.ref = f'{first}:{get_column_letter(ncols)}{n}'


def write_v3(wb, v3_items, koka_monthend, bank_saldo):
    if 'Nematchano_v3' in wb.sheetnames:
        del wb['Nematchano_v3']
    ws = wb.create_sheet('Nematchano_v3')
    heads = ('Source', 'Datum', 'Iznos', 'Smjer', 'Racun', 'Izvor',
             'Opis / Napomena', 'Tip (Review)', 'Δ dana', 'Transfer', 'Saldo-hint')
    for c, hh in enumerate(heads, 1):
        cell = ws.cell(1, c, hh)
        cell.fill, cell.font, cell.border = HDR_FILL, WHITE_BOLD, BORDER
    for c, w in zip('ABCDEFGHIJK', (9, 11, 10, 8, 18, 11, 46, 16, 7, 9, 40)):
        ws.column_dimensions[c].width = w
    r = 2
    for tx, cands in v3_items:
        ym = f'{tx["date"]:%Y-%m}'
        hint = ''
        if tx['pref'] == 'ZABA' and ym in bank_saldo and koka_monthend.get(ym) is not None:
            k, b = koka_monthend[ym], bank_saldo[ym][1]
            diff = round(k - b, 2)
            hint = (f'{ym}: Koka {k:.2f} = banka {b:.2f} → mjesec balansira (vjerojatno dup)'
                    if abs(diff) < 0.01
                    else f'{ym}: Koka {k:.2f} vs banka {b:.2f} (Δ{diff:+.2f} → možda dodaj)')
        ws.cell(r, 1, 'Izvod'); ws.cell(r, 2, tx['date']).number_format = 'DD.MM.YYYY'
        ws.cell(r, 3, tx['iznos']).number_format = '#,##0.00'
        ws.cell(r, 4, tx['smjer']); ws.cell(r, 5, tx['racun']); ws.cell(r, 6, tx['izvor'])
        ws.cell(r, 7, tx['opis'][:120]); ws.cell(r, 10, 'n'); ws.cell(r, 11, hint)
        for c in range(1, 12):
            ws.cell(r, c).fill = V3_IZV_FILL
        r += 1
        for c in sorted(cands, key=lambda c: abs((c['date'] - tx['date']).days))[:2]:
            ws.cell(r, 1, 'Review'); ws.cell(r, 2, c['date']).number_format = 'DD.MM.YYYY'
            ws.cell(r, 3, c['iznos']).number_format = '#,##0.00'
            ws.cell(r, 4, c['smjer']); ws.cell(r, 5, c['racun']); ws.cell(r, 6, c['izvor'])
            ws.cell(r, 7, (c['napomena'] or '')[:120]); ws.cell(r, 8, c['tip'])
            ws.cell(r, 9, (c['date'] - tx['date']).days)
            for cc in range(1, 12):
                ws.cell(r, cc).fill = V3_REV_FILL
            r += 1
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f'A1:K{max(2, r - 1)}'
    ws.sheet_view.tabColor = 'C55A11'


def write_saldo_kontrola(wb, koka_monthend, bank_saldo):
    if 'Saldo kontrola' in wb.sheetnames:
        del wb['Saldo kontrola']
    ws = wb.create_sheet('Saldo kontrola')
    for c, hh in enumerate(('Izvadak', 'Datum zatvaranja', 'Koka Stanje @ zatvaranju',
                            'Banka NOVO STANJE', 'Δ (Koka−banka)', 'Status'), 1):
        cell = ws.cell(1, c, hh)
        cell.fill, cell.font, cell.border = HDR_FILL, WHITE_BOLD, BORDER
    for c, w in zip('ABCDEF', (10, 16, 24, 20, 16, 26)):
        ws.column_dimensions[c].width = w
    r = 2
    for ym in sorted(bank_saldo):
        close, b = bank_saldo[ym]
        k = koka_monthend.get(ym)
        ws.cell(r, 1, ym); ws.cell(r, 2, close).number_format = 'DD.MM.YYYY'
        ws.cell(r, 4, b).number_format = '#,##0.00'
        if k is not None:
            diff = round(k - b, 2)
            ws.cell(r, 3, k).number_format = '#,##0.00'
            ws.cell(r, 5, diff).number_format = '#,##0.00'
            ws.cell(r, 6, 'OK — balansira' if abs(diff) < 0.01 else 'RAZLIKA — provjeriti')
        else:
            ws.cell(r, 6, 'nema Kokinog Stanja za datum')
        r += 1
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f'A1:F{max(2, r - 1)}'


def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    review = pick_review(args)
    print(f'Review: {review.name}{"  [DRY — Review NETAKNUT]" if dry else ""}')

    tx = load_tx()
    wb = openpyxl.load_workbook(review)
    ws = wb['Review']
    col = hdr_index(ws)
    ncols = ws.max_column

    # indeksi: match (±2) + kandidati (isti iznos) + Kokin month-end Stanje
    match_idx = defaultdict(list)     # (racun,izvor,smjer,date,iznos) -> [row]
    cand_idx = defaultdict(list)      # (racun,izvor,iznos) -> [cand]
    existing_keys = set()
    koka_series = []                  # [(date, stanje)] ZABA Racun redovi (za saldo @ close)
    for r in range(2, ws.max_row + 1):
        sk = ws.cell(r, col['source_key']).value
        if sk:
            existing_keys.add(str(sk))
        d = to_date(ws.cell(r, col['event_date']).value)
        if d is None:
            continue
        rac = str(ws.cell(r, col['Racun']).value or '')
        izv = str(ws.cell(r, col['Izvor']).value or '')
        sm = str(ws.cell(r, col['Smjer']).value or '')
        amt = ws.cell(r, col['Uplata' if sm == 'Uplata' else 'Isplata']).value
        if amt not in (None, ''):
            a = round(float(amt), 2)
            match_idx[(rac, izv, sm, d, a)].append(r)
            cand_idx[(rac, izv, a)].append(
                {'date': d, 'smjer': sm, 'iznos': a, 'racun': rac, 'izvor': izv,
                 'napomena': ws.cell(r, col['Napomena']).value, 'tip': ws.cell(r, col['Tip']).value})
        st = ws.cell(r, col['Stanje']).value
        if 'ZABA' in rac.upper() and izv == 'Racun' and st not in (None, ''):
            koka_series.append((d, round(float(st), 2)))
    koka_series.sort()

    def koka_stanje_at(dt):           # zadnje Kokino Stanje s datumom ≤ dt
        v = None
        for dd, s in koka_series:
            if dd <= dt:
                v = s
            else:
                break
        return v

    bank_saldo = zaba_bank_saldo()    # ym -> (close_date, novo)
    koka_at_close = {ym: koka_stanje_at(close) for ym, (close, _) in bank_saldo.items()}

    used = set()
    to_add, v3 = [], []
    for t in sorted(tx, key=lambda t: t['date']):
        row = None
        for dd in MATCH_DELTAS:
            key = (t['racun'], t['izvor'], t['smjer'], t['date'] + timedelta(days=dd), t['iznos'])
            row = next((r for r in match_idx.get(key, []) if r not in used), None)
            if row:
                break
        if row:
            used.add(row)
            continue                                 # već u Review
        kind, a, b = classify(t, cand_idx)
        if kind == 'add':
            to_add.append((t, a, b))
        else:
            v3.append((t, cand_idx.get((t['racun'], t['izvor'], t['iznos']), [])))

    # build add-rows (source_key dedup)
    taken = set(existing_keys)
    rows_to_add = []
    from collections import Counter
    stats = Counter()
    for t, tip, podtip in to_add:
        canon = f"cons|{t['racun']}|{t['date']}|{t['smjer']}|{t['iznos']}|{t['opis']}|{t['src']}"
        if hashlib.md5(canon.encode()).hexdigest()[:12] in existing_keys:
            continue
        skey = source_key(t, taken)
        rows_to_add.append(build_row(t, col, ncols, skey, tip, podtip))
        stats[('Transfer' if tip == 'Transfer' else t['izvor'])] += 1

    print(f'\nIzvod tx: {len(tx)}  |  DODAJ: {len(rows_to_add)}  |  Nematchano_v3: {len(v3)}')
    for k, n in stats.most_common():
        print(f'   + {k}: {n}')
    # saldo kontrola sažetak
    off = [ym for ym in bank_saldo
           if koka_at_close.get(ym) is not None and abs(koka_at_close[ym] - bank_saldo[ym][1]) >= 0.01]
    print(f'Saldo kontrola: {len(bank_saldo)} ZABA izvadaka, {len(off)} s razlikom Koka↔banka'
          + (f' ({", ".join(off[:8])}{"…" if len(off) > 8 else ""})' if off else ''))

    # append + sort + v3 + saldo sheet
    template = next((r for r in range(2, ws.max_row + 1)
                     if str(ws.cell(r, col['Izvor']).value or '') == 'Racun'), 2)
    tstyles = [ws.cell(template, c)._style for c in range(1, ncols + 1)]
    start = ws.max_row + 1
    for i, rowvals in enumerate(rows_to_add):
        for c in range(1, ncols + 1):
            cell = ws.cell(start + i, c)
            if rowvals[c - 1] is not None:
                cell.value = rowvals[c - 1]
            cell._style = tstyles[c - 1]
    if rows_to_add:
        sort_review(ws, col, ncols)
    write_v3(wb, v3, koka_at_close, bank_saldo)
    write_saldo_kontrola(wb, koka_at_close, bank_saldo)

    if dry:
        wb.save(PREVIEW)
        print(f'\n✔ [DRY] PREVIEW: {PREVIEW.name} ({len(rows_to_add)} dodano, v3={len(v3)}). Review NETAKNUT.')
        return
    backup = review.with_name(f'{review.stem}.pre-consolidate-{datetime.now():%Y%m%d_%H%M%S}.xlsx')
    shutil.copy2(review, backup)
    try:
        wb.save(review)
    except PermissionError:
        sys.exit(f'✗ Zatvori Review u Excelu i ponovi. (Backup: {backup.name})')
    print(f'\n✔ Snimljeno: +{len(rows_to_add)} redaka, Nematchano_v3 ({len(v3)}), Saldo kontrola.')
    print(f'  Backup: {backup.name}')
    print('  Izvodi_transakcije.xlsx više ne treba za odluke — sve u Review. Sljedeći: apply_rules.py')


if __name__ == '__main__':
    main()
