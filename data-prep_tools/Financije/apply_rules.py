# -*- coding: utf-8 -*-
"""
apply_rules.py  (S107c, 2026-07-12; dorade S107e, 2026-07-14)
=============================================================
Primjenjuje EDITABILNA keyword pravila (`Pravila` sheet) na neklasificirane redove
Financije REVIEW Excela — cilj: minimalan ručni rad u Tip/Podtip klasifikaciji.

Kako radi (svaki pravi run, ovim redom):
  1. Prvi put: kreira `Pravila` sheet (header + primjeri + upute) i stane —
     Saša/Koka upišu pravila pa pokrenu ponovno.
  2. SNAPSHOT (jednom, S107e): ako ne postoje, kreira `Tip_O`/`Podtip_O` kolone
     na kraju Review sheeta = kopija Tip/Podtip PRIJE ikakvog pisanja pravila
     (trajni trag originala; nikad se više ne ažuriraju).
  3. VALIDACIJA TAKSONOMIJE (S107e): red čiji Tip/Podtip par NE postoji u
     aktualnom Taksonomija sheetu → reset na N/A + Pouzdanost='NEMA' +
     'TAKS: bio <tip>/<pod>' u Alternativa (original ostaje u _O kolonama).
     Hvata redove koje je izmjena Taksonomije učinila krivima; VISOKA
     klasifikacije s valjanim parovima se NE diraju. Prazan Podtip je valjan.
  4. PRAVILA: čita pravila (odozgo prema dolje, PRVI match pobjeđuje)
     i primjenjuje ih SAMO na redove gdje je Tip prazan ili 'N/A'
     (uklj. svježe resetirane iz koraka 3) → ručni rad se NIKAD ne gazi.

Sintaksa ključnih riječi (kolona A `Pravila` sheeta):
  konzum                  → tekst sadrži "konzum"
  telekom & racun         → tekst sadrži OBJE riječi (bilo gdje, bilo koji red)
  (case-insensitive, dijakritike izjednačene: č/ć→c itd.; OR = više redova pravila)

Tekst po kojem se traži = Napomena kolona + 'Izvod opis*' kolone
(enrichment kolone iz enrich_from_izvoda.py; namjerno NE 'Izvod reda'/'Izvod file').

Napomena output (S107e): pravilo može imati i `Napomena` kolonu — čista ljudska
labela (npr. "Konzum"). Upisuje se SAMO ako je Napomena reda prazna (P3 princip).

Označavanje: pogođeni red dobije Pouzdanost='PRAVILO' i 'pravilo #N: <ključne riječi>'
u koloni Alternativa / nap. — filtriraj Pouzdanost=PRAVILO za brzu kontrolu.

Validacija pravila: Tip/Podtip pravila moraju postojati u `Taksonomija` sheetu,
inače se pravilo preskače uz upozorenje (da se u Review ne upiše nevaljan par).

Pokretanje (file zatvoren u Excelu!):
  Financije\\run.bat apply_rules.py            → najnoviji Financije_review_*.xlsx
  Financije\\run.bat apply_rules.py --dry      → samo pokaži što bi se promijenilo
  Financije\\run.bat apply_rules.py --all      → + REPORT konflikata na već
                                                 klasificiranim redovima (ne piše!)
  ... apply_rules.py <putanja.xlsx> [--dry] [--all]  → eksplicitni file
"""

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije")

HDR_FILL   = PatternFill('solid', fgColor='4472C4')
WHITE_BOLD = Font(color='FFFFFF', bold=True)
THIN       = Side(style='thin')
BORDER     = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

DIACRITICS = {'ć': 'c', 'č': 'c', 'š': 's', 'ž': 'z', 'đ': 'd'}

SEED_RULES = [  # primjeri — slobodno obriši/zamijeni (kolone: ključne riječi, Tip, Podtip, Napomena, Komentar)
    ('hrvatski telekom', 'Informatika', 'T-com',           'T-com',   'primjer: opis s izvoda'),
    ('gpz',              'Domaćinstvo', 'Plin',            'Plin',    'primjer'),
    ('holding',          'Domaćinstvo', 'Holding (smeće)', 'Holding', 'primjer'),
    ('mirovinsk',        'Mirovina',    'Koka',            '',        'PRIMJER — OPREZ: mirovina može biti i Sašina (odvoji po Racun)!'),
]

HELP_TEXT = (
    'PRAVILA KLASIFIKACIJE — jedan red = jedno pravilo; odozgo prema dolje, PRVI match pobjeđuje.\n'
    'Ključne riječi: "konzum" = tekst sadrži konzum; "telekom & racun" = sadrži OBJE riječi.\n'
    'Case i dijakritike se ignoriraju (Č=č=c). OR se piše kao dva odvojena reda pravila.\n'
    'Pravilo se primjenjuje SAMO na redove gdje je Tip prazan ili N/A — ručni rad se ne dira.\n'
    'Napomena kolona (opcionalno): čista labela, upisuje se SAMO u redove s praznom Napomenom.\n'
    'Tekst za pretragu = Napomena + "Izvod opis" kolone (nakon enrich_from_izvoda.py).\n'
    'Tip i Podtip moraju postojati u Taksonomija sheetu (inače se pravilo preskače uz upozorenje).\n'
    'Prije primjene: skripta jednom snima Tip_O/Podtip_O original kolone + resetira na N/A\n'
    'redove čiji Tip/Podtip par više ne postoji u Taksonomiji (oznaka "TAKS:" u Alternativa).\n'
    'Nakon izmjena pokreni: Financije\\run.bat apply_rules.py  (--dry za probu bez snimanja;\n'
    '--all = i report konflikata pravila s već klasificiranim redovima, bez pisanja)'
)


def fold(s: str) -> str:
    s = str(s or '').lower()
    for a, b in DIACRITICS.items():
        s = s.replace(a, b)
    return s


def pick_file(args: list[str]) -> Path:
    explicit = [a for a in args if not a.startswith('--')]
    if explicit:
        p = Path(explicit[0])
        if not p.exists():
            sys.exit(f'✗ File ne postoji: {p}')
        return p
    candidates = sorted(DATA_DIR.glob('Financije_review_*.xlsx'),
                        key=lambda p: p.stat().st_mtime, reverse=True)
    candidates = [c for c in candidates if '.pre-sync-' not in c.name and '.pre-rules-' not in c.name]
    if not candidates:
        sys.exit(f'✗ Nema Financije_review_*.xlsx u {DATA_DIR}')
    return candidates[0]


def create_pravila_sheet(wb, path: Path) -> None:
    ws = wb.create_sheet('Pravila', 2)   # odmah iza Taksonomije
    headers = [('Ključne riječi', 32), ('Tip', 16), ('Podtip', 24), ('Napomena', 18), ('Komentar', 40)]
    for c, (h, w) in enumerate(headers, 1):
        cell = ws.cell(1, c, h)
        cell.fill, cell.font, cell.border = HDR_FILL, WHITE_BOLD, BORDER
        ws.column_dimensions[chr(64 + c)].width = w
    for r, rule in enumerate(SEED_RULES, 2):
        for c, v in enumerate(rule, 1):
            ws.cell(r, c, v).border = BORDER
    note = ws.cell(2, 7, HELP_TEXT)
    note.alignment = Alignment(wrap_text=True, vertical='top')
    ws.column_dimensions['G'].width = 95
    ws.row_dimensions[2].height = 150
    ws.freeze_panes = 'A2'
    wb.save(path)
    print(f'✔ Kreiran "Pravila" sheet u {path.name} (s {len(SEED_RULES)} primjera).')
    print('  Upiši/uredi pravila pa pokreni skriptu ponovno da se primijene.')


def read_taxonomy(wb) -> dict[str, set[str]]:
    tws = wb['Taksonomija']
    tax: dict[str, set[str]] = {}
    for r in range(2, tws.max_row + 1):
        tip = str(tws.cell(r, 1).value or '').strip()
        pod = str(tws.cell(r, 2).value or '').strip()
        if pod == '—':
            pod = ''
        if not tip:
            continue
        tax.setdefault(tip, set())
        if pod:
            tax[tip].add(pod)
    return tax


def read_rules(wb, tax: dict[str, set[str]]) -> list[dict]:
    ws = wb['Pravila']
    hdr = {str(ws.cell(1, c).value or '').strip().lower(): c
           for c in range(1, ws.max_column + 1)}
    c_kw  = hdr.get('ključne riječi', 1)
    c_tip = hdr.get('tip', 2)
    c_pod = hdr.get('podtip', 3)
    c_nap = hdr.get('napomena')          # None u starom (4-kolonskom) Pravila sheetu
    rules, skipped = [], 0
    for r in range(2, ws.max_row + 1):
        kw  = str(ws.cell(r, c_kw).value or '').strip()
        tip = str(ws.cell(r, c_tip).value or '').strip()
        pod = str(ws.cell(r, c_pod).value or '').strip()
        nap = str(ws.cell(r, c_nap).value or '').strip() if c_nap else ''
        if not kw and not tip:
            continue
        if not kw or not tip:
            print(f'⚠ Pravila red {r}: treba i ključne riječi i Tip — preskočen'); skipped += 1
            continue
        if tip not in tax:
            print(f'⚠ Pravila red {r}: Tip "{tip}" ne postoji u Taksonomiji — preskočen'); skipped += 1
            continue
        if pod and pod not in tax[tip]:
            print(f'⚠ Pravila red {r}: Podtip "{pod}" ne postoji pod Tipom "{tip}" — preskočen'); skipped += 1
            continue
        terms = [fold(t.strip()) for t in kw.split('&') if t.strip()]
        rules.append({'row': r, 'kw': kw, 'terms': terms, 'tip': tip, 'pod': pod, 'nap': nap})
    if skipped:
        print(f'  ({skipped} pravila preskočeno — ispravi pa ponovi)')
    return rules


def find_header_col(ws, header: str) -> int:
    for c in range(1, ws.max_column + 1):
        if str(ws.cell(1, c).value or '').strip() == header:
            return c
    sys.exit(f'✗ Kolona "{header}" nije nađena u Review sheetu.')


def ensure_snapshot(ws, col_tip: int, col_pod: int, dry: bool) -> bool:
    """Tip_O/Podtip_O kolone = kopija Tip/Podtip PRIJE prvog pisanja pravila.
    Kreira se jednom (postojanje kolona = marker); nikad se ne ažurira."""
    for c in range(1, ws.max_column + 1):
        if str(ws.cell(1, c).value or '').strip() == 'Tip_O':
            return False
    if dry:
        print('… (dry) Tip_O/Podtip_O snapshot kolone bi se kreirale pri pravom runu')
        return False
    c_tip_o, c_pod_o = ws.max_column + 1, ws.max_column + 2
    for c, h in ((c_tip_o, 'Tip_O'), (c_pod_o, 'Podtip_O')):
        cell = ws.cell(1, c, h)
        cell.fill, cell.font, cell.border = HDR_FILL, WHITE_BOLD, BORDER
    for r in range(2, ws.max_row + 1):
        v_tip, v_pod = ws.cell(r, col_tip).value, ws.cell(r, col_pod).value
        if v_tip is not None:
            ws.cell(r, c_tip_o, v_tip)
        if v_pod is not None:
            ws.cell(r, c_pod_o, v_pod)
    print(f'✔ Snapshot: Tip_O/Podtip_O kolone kreirane (kopija Tip/Podtip prije pravila)')
    return True


def main() -> None:
    args = sys.argv[1:]
    dry = '--dry' in args
    report_all = '--all' in args
    path = pick_file(args)
    print(f'File: {path.name}{"  [DRY RUN — bez snimanja]" if dry else ""}'
          f'{"  [--all: report konflikata]" if report_all else ""}')

    wb = openpyxl.load_workbook(path)
    if 'Review' not in wb.sheetnames or 'Taksonomija' not in wb.sheetnames:
        sys.exit('✗ File nema Review/Taksonomija sheet — je li ovo review Excel?')

    if 'Pravila' not in wb.sheetnames:
        create_pravila_sheet(wb, path)
        return

    tax   = read_taxonomy(wb)
    rules = read_rules(wb, tax)
    if not rules:
        sys.exit('✗ Nema valjanih pravila u "Pravila" sheetu.')
    print(f'Pravila: {len(rules)} valjanih')

    ws = wb['Review']
    col_nap  = find_header_col(ws, 'Napomena')
    col_tip  = find_header_col(ws, 'Tip')
    col_pod  = find_header_col(ws, 'Podtip')
    col_conf = find_header_col(ws, 'Pouzdanost')
    col_alt  = find_header_col(ws, 'Alternativa / nap.')
    # SAMO 'Izvod opis*' kolone — NE 'Izvod reda' (koka EU:...) ni 'Izvod file'
    # (ZABA_*.pdf) jer bi ključne riječi poput "zaba"/"koka" lažno matchale sve.
    izvod_cols = [c for c in range(1, ws.max_column + 1)
                  if str(ws.cell(1, c).value or '').startswith('Izvod opis')]

    # ── 1. SNAPSHOT (jednom): Tip_O/Podtip_O = original prije pravila ─────────
    snap_created = ensure_snapshot(ws, col_tip, col_pod, dry)

    # ── 2. VALIDACIJA TAKSONOMIJE: nepostojeći Tip/Podtip par → reset na N/A ──
    reset_rows: set[int] = set()
    tax_samples: list[str] = []
    for r in range(2, ws.max_row + 1):
        tip_now = str(ws.cell(r, col_tip).value or '').strip()
        if tip_now in ('', 'N/A'):
            continue
        pod_now = str(ws.cell(r, col_pod).value or '').strip()
        if pod_now == '—':
            pod_now = ''
        if tip_now in tax and (not pod_now or pod_now in tax[tip_now]):
            continue                          # valjan par (prazan Podtip = valjan)
        reset_rows.add(r)
        if not dry:
            ws.cell(r, col_tip, 'N/A')
            ws.cell(r, col_pod).value = None   # cell(r,c,None) NE briše — mora preko .value
            ws.cell(r, col_conf, 'NEMA')
            ws.cell(r, col_alt, f'TAKS: bio {tip_now}/{pod_now or "—"}')
        if len(tax_samples) < 8:
            tax_samples.append(f'  red {r}: {tip_now}/{pod_now or "—"} → N/A (nije u Taksonomiji)')
    if reset_rows:
        print(f'{"Bi se resetiralo" if dry else "Resetirano"} na N/A (Taksonomija validacija): '
              f'{len(reset_rows)} redova — original u Tip_O/Podtip_O, oznaka "TAKS:" u Alternativa')
        print('\n'.join(tax_samples))
        if len(reset_rows) > len(tax_samples):
            print(f'  ... i još {len(reset_rows) - len(tax_samples)}')

    # ── 3. PRAVILA na Tip prazan/N/A (uklj. svježe resetirane) ────────────────
    hits_per_rule: dict[int, int] = {}
    changed = nap_filled = 0
    samples: list[str] = []
    conflicts: list[str] = []
    n_conflicts = 0
    for r in range(2, ws.max_row + 1):
        tip_now = str(ws.cell(r, col_tip).value or '').strip()
        unclassified = tip_now in ('', 'N/A') or r in reset_rows
        if not unclassified and not report_all:
            continue                          # ručno/pipeline klasificiran — NE diraj
        text = fold(ws.cell(r, col_nap).value)
        for c in izvod_cols:
            text += ' | ' + fold(ws.cell(r, c).value)
        if not text.strip(' |'):
            continue
        for i, rule in enumerate(rules):
            if all(t in text for t in rule['terms']):
                if not unclassified:
                    # --all: klasificiran red — samo REPORT ako se pravilo ne slaže
                    pod_now = str(ws.cell(r, col_pod).value or '').strip()
                    if tip_now != rule['tip'] or (rule['pod'] and pod_now != rule['pod']):
                        n_conflicts += 1
                        if len(conflicts) < 20:
                            conflicts.append(f'  red {r}: sada {tip_now}/{pod_now or "—"} '
                                             f'vs pravilo #{i + 1} "{rule["kw"]}" → {rule["tip"]}/{rule["pod"] or "—"}')
                    break
                if not dry:
                    ws.cell(r, col_tip, rule['tip'])
                    if rule['pod']:
                        ws.cell(r, col_pod, rule['pod'])
                    ws.cell(r, col_conf, 'PRAVILO')
                    ws.cell(r, col_alt, f'pravilo #{i + 1}: {rule["kw"]}')
                    if rule['nap'] and not str(ws.cell(r, col_nap).value or '').strip():
                        ws.cell(r, col_nap, rule['nap'])   # P3: prazno se puni, puno NE
                        nap_filled += 1
                hits_per_rule[i] = hits_per_rule.get(i, 0) + 1
                changed += 1
                if len(samples) < 8:
                    samples.append(f'  red {r}: "{str(ws.cell(r, col_nap).value or "")[:40]}" → {rule["tip"]}/{rule["pod"] or "—"}')
                break

    print(f'\n{"Bi se promijenilo" if dry else "Promijenjeno"}: {changed} redova'
          + (f' (+ {nap_filled} Napomena popunjeno)' if nap_filled else ''))
    for i, rule in enumerate(rules):
        n = hits_per_rule.get(i, 0)
        if n:
            print(f'  #{i + 1} "{rule["kw"]}" → {rule["tip"]}/{rule["pod"] or "—"}: {n}×')
    if samples:
        print('Primjeri:')
        print('\n'.join(samples))
    if report_all:
        print(f'\n--all KONFLIKTI (klasificiran red vs pravilo — SAMO report, ništa se ne piše): {n_conflicts}')
        print('\n'.join(conflicts))
        if n_conflicts > len(conflicts):
            print(f'  ... i još {n_conflicts - len(conflicts)}')

    if dry or not (changed or reset_rows or snap_created):
        return

    backup = path.with_name(f'{path.stem}.pre-rules-{datetime.now():%Y%m%d_%H%M%S}.xlsx')
    shutil.copy2(path, backup)
    try:
        wb.save(path)
    except PermissionError:
        sys.exit(f'✗ Ne mogu snimiti — zatvori file u Excelu i ponovi. (Backup: {backup.name})')
    print(f'✔ Snimljeno. Backup: {backup.name}')
    print('  Kontrola: filtriraj Pouzdanost = PRAVILO (pravila) i "TAKS:" u Alternativa (reseti).')


if __name__ == '__main__':
    main()
