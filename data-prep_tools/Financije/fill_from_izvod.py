# -*- coding: utf-8 -*-
"""
fill_from_izvod.py  (S113, 2026-08-21)
======================================
Puni retke u app-ov Excel (delta sheet ili obični Activities export) **iz
bankovnog izvoda**, umjesto da ih čovjek prepisuje kolonu po kolonu iz Kokinog
filea. Kolone se pogađaju **po imenu zaglavlja**, ne po položaju — raspored
stupaca (profil, skrivene kolone) zato ne igra nikakvu ulogu.

ZAŠTO IZ IZVODA, A NE IZ KOKINOG FILEA
  Izvod je autoritet za **iznos i datum** (v. CLAUDE.md „Politika izvora"), a i
  jedini je izvor koji se da provjeriti: RF izvod uz svaki redak nosi ISPISANO
  tekuće stanje, pa alat na kraju javi na kojoj brojci kontrolni stupac mora
  završiti. Kokin file ostaje autoritet za opis i klasifikaciju.

ŠTO ALAT NE RADI
  • ne uvozi ništa — piše samo Excel, uvoz ide kroz app kao i dosad
  • ne dira postojeće retke (samo prazne retke predloška i, ako ih ponestane,
    dopisuje nove ispod)
  • ne izmišlja `session_start` ondje gdje ga app već zapisao — prazni retci
    predloška ga imaju, a dopisani ga dobivaju iz istog pojasa (14:00+n)

⚠ AUTOFILTER: dopisani redak IZVAN `auto_filter.ref` se pri prvom sortu raspari
  od svog zaglavlja (CLAUDE.md). Alat zato širi raspon filtra na nove retke.

⚠ BOOLEAN: `Rate?` mora biti PRAVI bool. Sve osim doslovnog `true` uvozi se kao
  FALSE — `'DA'` tiho postane netočno (`excelImport.ts:1244`).

Pokretanje (target = file skinut iz appa, ostaje netaknut):
    python fill_from_izvod.py <target.xlsx> --rf   <RF_2026-07.pdf>   [--od 2026-08-05]
    python fill_from_izvod.py <target.xlsx> --visa <PBZVIZA_2026-07.pdf> --naplata 2026-08-07
Rezultat: `<target>_filled.xlsx` pokraj originala + izvještaj na ekran.
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))

AREA_COL, PATH_COL, DATE_COL, SESS_COL, USER_COL, COMMENT_COL = 2, 3, 4, 5, 7, 8
TIME_START_H = 14          # isti pojas koji piše deltaSheet.ts (DELTA_TIME_START_H)

# Klasifikacija Racun-redaka po tekstu izvoda. Namjerno kratko i vidljivo:
# krivo-ali-valjano klasificiran redak `apply_rules.py` više NE MOŽE popraviti
# (preskače retke s valjanim parom), pa se svaki pogodak ispisuje u izvještaju.
RF_RULES = [
    (re.compile(r'PBZCARD|PBZ CARD', re.I),                 'Transfer',    'izmedju racuna'),
    (re.compile(r'MIROVINSK|MIROVINSKO ?OSIGURANJE', re.I), 'Prihodi',     'Saša'),
    (re.compile(r'NAKNADA', re.I),                          'Domaćinstvo', 'Bankovni troškovi'),
]
NA = 'N/A'                 # legitimna vrijednost, ne blokira uvoz (S107q)
DATE_TOL = 3               # dana tolerancije pri prepoznavanju istog retka


def _as_date(v) -> date:
    """Parseri vraćaju datum kao `date`, `datetime` ili ISO string — ovisno o
    izvodu. Jedan oblik dalje, inače dedup uspoređuje različite tipove."""
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def _load_tolerant(path: Path):
    """openpyxl padne na nevaljanom `errorStyle="error"` koji je app-ov export
    pisao do S113 (OOXML pozna samo `stop|warning|information`; Excel ga
    progura, openpyxl ne). Fileovi skinuti prije popravka i dalje postoje, pa
    ih alat popravlja u memoriji umjesto da traži novi export."""
    try:
        return openpyxl.load_workbook(path)
    except Exception:
        import io as _io
        import zipfile
        src = zipfile.ZipFile(path)
        buf = _io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
            for item in src.infolist():
                data = src.read(item.filename)
                if item.filename.startswith('xl/worksheets/') and item.filename.endswith('.xml'):
                    data = data.decode('utf-8').replace(
                        'errorStyle="error"', 'errorStyle="stop"').encode('utf-8')
                out.writestr(item, data)
        buf.seek(0)
        print('  (popravljen nevaljan errorStyle iz starijeg exporta)')
        return openpyxl.load_workbook(buf)


class Target:
    """App-ov Events list: gdje je zaglavlje, koje kolone postoje, gdje su prazni retci."""

    def __init__(self, path: Path):
        self.path = path
        self.wb = _load_tolerant(path)
        self.ws = self.wb['Events'] if 'Events' in self.wb.sheetnames else self.wb.worksheets[0]

        self.header_row = 0
        for r in range(1, self.ws.max_row + 1):
            if str(self.ws.cell(r, 1).value or '').strip() == 'event_id':
                self.header_row = r
                break
        if not self.header_row:
            sys.exit('✗ Ne nalazim zaglavlje EVENT DATA (kolona A "event_id").')

        # `Uplata (Transakcija)` → ključ `uplata`; kolona se traži po imenu atributa
        self.col = {}
        self.last_col = 0
        for c in range(1, self.ws.max_column + 1):
            v = str(self.ws.cell(self.header_row, c).value or '').strip()
            if not v:
                continue
            self.last_col = c
            self.col[v.split(' (')[0].strip().lower()] = c

        # redak s podacima = ima Area; „pravi" = ima i datum. Ostatak su prazni
        # retci predloška (nose prepisan Area/email/vrijeme, čekaju unos).
        self.real_rows, self.blank_rows = [], []
        for r in range(self.header_row + 1, self.ws.max_row + 1):
            if not str(self.ws.cell(r, AREA_COL).value or '').strip():
                continue
            (self.real_rows if self.ws.cell(r, DATE_COL).value else self.blank_rows).append(r)

    def find(self, name: str):
        return self.col.get(name.lower())

    def put(self, row: int, name: str, value):
        """Upiši samo ako list tu kolonu uopće ima — inače tiho preskoči i javi."""
        c = self.find(name)
        if c is None:
            return False
        self.ws.cell(row, c).value = value
        return True

    def existing_keys(self) -> set:
        """(datum, iznos) postojećih redaka — ključ za dedup protiv izvoda."""
        keys = set()
        cu, ci = self.find('Uplata'), self.find('Isplata')
        for r in self.real_rows:
            d = self.ws.cell(r, DATE_COL).value
            d = d.date() if isinstance(d, datetime) else d
            for c in (cu, ci):
                if c is None:
                    continue
                v = self.ws.cell(r, c).value
                if isinstance(v, (int, float)) and v:
                    keys.add((str(d), round(float(v), 2)))
        return keys


# OCR jedne RF stranice traje ~25 s, pa se rezultat kešira po md5 filea: izvod se
# ne mijenja, a alat se pokreće više puta (dry → provjera → pravi upis).
CACHE_DIR = (Path(__file__).parents[2] / 'data-prep_data' / 'Financije'
             / '_arhiva' / 'ocr_cache')


def _rf_parse_cached(pdf: Path) -> list[dict]:
    import hashlib
    import json
    md5 = hashlib.md5(pdf.read_bytes()).hexdigest()
    cache = CACHE_DIR / f'{pdf.stem}_{md5}.json'
    if cache.exists():
        print(f'  (OCR iz keša: {cache.name})')
        return json.loads(cache.read_text(encoding='utf-8'))
    from rf_ocr import parse_rf_ocr
    txs = parse_rf_ocr(pdf)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(txs, ensure_ascii=False, default=str), encoding='utf-8')
    return txs


def rf_rows(pdf: Path, od: date | None, do: date | None) -> list[dict]:
    """Racun retci s RF izvoda — nose i ISPISANO stanje (`stanje_izvod`)."""
    out = []
    for t in _rf_parse_cached(pdf):
        d = _as_date(t['date'])
        if (od and d < od) or (do and d > do):
            continue
        tip, podtip = NA, NA
        for rx, ti, po in RF_RULES:
            if rx.search(t['opis']):
                tip, podtip = ti, po
                break
        out.append({
            'date': d, 'smjer': t['smjer'], 'iznos': round(float(t['iznos']), 2),
            'opis': t['opis'], 'izvor': 'Racun', 'tip': tip, 'podtip': podtip,
            'naplata': d,                       # D1b: Izvor=Racun ⇒ naplata istog dana
            'stanje': t.get('stanje_izvod'),
        })
    return out


def visa_rows(pdf: Path, naplata: date, od: date | None, do: date | None) -> list[dict]:
    """Kartične stavke s PBZ Visa računa. Saldo NE diraju — plaća ih jedna
    skupna naplata, koja stiže s RF izvoda kao običan Racun redak."""
    from enrich_from_izvoda import parse_pbz_visa
    out = []
    for t in parse_pbz_visa(pdf):
        d = _as_date(t['date'])
        if (od and d < od) or (do and d > do):
            continue
        if t['smjer'] != 'Isplata':
            continue                            # 'PRIMLJENA UPLATA' je protustavka naplate
        m = re.search(r'RATA\s*(\d+)\s*/\s*(\d+)', t['opis'])
        out.append({
            'date': d, 'smjer': 'Isplata', 'iznos': round(float(t['iznos']), 2),
            'opis': t['opis'], 'izvor': 'Visa', 'tip': NA, 'podtip': NA,
            'naplata': naplata,                 # dan kad je banka skinula skupnu naplatu
            'rata': (int(m.group(1)), int(m.group(2))) if m else None,
            'stanje': None,
        })
    return out


def write_rows(tg: Target, rows: list[dict], racun: str, dry: bool) -> tuple[int, int]:
    """Popuni prazne retke predloška; kad ih ponestane, dopiši nove ispod."""
    template = tg.blank_rows[0] if tg.blank_rows else (tg.real_rows[-1] if tg.real_rows else None)
    area = tg.ws.cell(template, AREA_COL).value if template else None
    path = tg.ws.cell(template, PATH_COL).value if template else None
    mail = tg.ws.cell(template, USER_COL).value if template else None

    used_blanks, appended = 0, 0
    next_free = max(tg.real_rows + tg.blank_rows) + 1 if (tg.real_rows or tg.blank_rows) else tg.header_row + 1

    # ⚠ Vrijeme dopisanog retka mora biti slobodno na CIJELOM listu, ne samo
    #   „iza broja praznih". Prazni retci koje je popunila prethodna tranša su
    #   potrošeni, ali njihova vremena i dalje stoje na listu — brojanje od
    #   `len(blank_rows)` bi zato palo točno na njih. A kolizija nije sitnica:
    #   ona je zaštita od dvostrukog uvoza istog filea, pa lažna kolizija
    #   izgleda kao pad featurea („All skipped").
    used_times = set()
    for r in tg.real_rows + tg.blank_rows:
        v = tg.ws.cell(r, SESS_COL).value
        if v:
            used_times.add(str(v)[:5])

    def free_time() -> str:
        for m in range(TIME_START_H * 60, 24 * 60):
            t = f'{m // 60:02d}:{m % 60:02d}'
            if t not in used_times:
                used_times.add(t)
                return t
        sys.exit('✗ Nema slobodnog vremena u danu — podijeli uvoz na dva filea.')

    # ⚠ Kontrolni stupac (`Stanje (kontrola)`) postoji SAMO na pripremljenim
    #   praznim retcima — dopisani su izvan njegovog raspona. Retci koji miču
    #   saldo (`Izvor = Racun`) zato idu u prazne PRVI; kartične stavke smiju
    #   ispasti ispod jer ih kontrolni stupac ionako ne broji. Obrnuti redoslijed
    #   dao bi kontrolni broj koji izgleda uvjerljivo, a ne uključuje sve.
    rows = sorted(rows, key=lambda r: (r['izvor'] != 'Racun', r['date'], r['iznos']))

    for i, r in enumerate(rows):
        if i < len(tg.blank_rows):
            row = tg.blank_rows[i]
            used_blanks += 1
        else:
            row = next_free
            next_free += 1
            appended += 1
            tg.ws.cell(row, AREA_COL).value = area
            tg.ws.cell(row, PATH_COL).value = path
            tg.ws.cell(row, USER_COL).value = mail
            tg.ws.cell(row, SESS_COL).value = free_time()
            tg.ws.cell(row, SESS_COL).number_format = '@'

        tg.ws.cell(row, DATE_COL).value = r['date'].isoformat()
        tg.ws.cell(row, COMMENT_COL).value = r['opis'][:60]
        tg.put(row, 'Racun',  racun)
        tg.put(row, 'Izvor',  r['izvor'])       # ⚠ prazni retci nose 'Racun' — mora se prepisati
        tg.put(row, 'Smjer',  r['smjer'])
        tg.put(row, 'Uplata'  if r['smjer'] == 'Uplata' else 'Isplata', r['iznos'])
        tg.put(row, 'Tip',    r['tip'])
        tg.put(row, 'Podtip', r['podtip'])
        tg.put(row, 'Status', 'Izvrsen')        # retci s izvoda su se već dogodili
        tg.put(row, 'Izvod opis', r['opis'])
        cn = tg.find('Datum naplate')
        if cn:
            tg.ws.cell(row, cn).value = r['naplata']
            tg.ws.cell(row, cn).number_format = 'd.m.yyyy'
        if r.get('rata'):
            tg.put(row, 'Rate?', True)          # PRAVI bool — 'DA' bi se uvezlo kao FALSE
            tg.put(row, 'Broj rata', r['rata'][1])
            tg.put(row, 'Rata br',   r['rata'][0])

    spilled_racun = [r for i, r in enumerate(rows)
                     if i >= len(tg.blank_rows) and r['izvor'] == 'Racun']
    if spilled_racun:
        print()
        print(f'⚠ {len(spilled_racun)} Racun redaka nije stalo u prazne retke — '
              f'kontrolni stupac ih NE broji, pa mu brojka na dnu nije potpuna. '
              f'Podijeli uvoz ili izvezi delta sheet s više praznih redaka.')

    # Autofilter mora obuhvatiti dopisane retke, inače ih prvi sort raspari.
    if appended and tg.ws.auto_filter.ref:
        last = next_free - 1
        tg.ws.auto_filter.ref = (f'A{tg.header_row}:'
                                 f'{get_column_letter(tg.last_col)}{last}')
    return used_blanks, appended


def main() -> None:
    ap = argparse.ArgumentParser(description='Popuni app-ov Excel retcima s bankovnog izvoda.')
    ap.add_argument('target', type=Path, help='xlsx skinut iz appa (delta sheet ili export)')
    ap.add_argument('--rf',      type=Path, help='RF izvod (PDF, OCR)')
    ap.add_argument('--visa',    type=Path, help='PBZ Visa račun (PDF)')
    ap.add_argument('--naplata', help='datum skupne naplate Vise, YYYY-MM-DD (s RF izvoda)')
    ap.add_argument('--od',      help='uzmi retke od datuma (YYYY-MM-DD)')
    ap.add_argument('--do',      help='uzmi retke do datuma (YYYY-MM-DD)')
    ap.add_argument('--racun',   default='Sašin tekući RF', help='vrijednost atributa Racun')
    ap.add_argument('--dry',     action='store_true', help='samo ispiši što bi upisao')
    a = ap.parse_args()

    if not a.rf and not a.visa:
        sys.exit('✗ Zadaj barem jedan izvor: --rf ili --visa.')
    if a.visa and not a.naplata:
        sys.exit('✗ --visa traži --naplata (dan kad je banka skinula skupnu naplatu; piše na RF izvodu).')

    od = date.fromisoformat(a.od) if a.od else None
    do = date.fromisoformat(a.do) if a.do else None

    tg = Target(a.target)
    print(f'Target: {a.target.name} — {len(tg.real_rows)} postojećih redaka, '
          f'{len(tg.blank_rows)} praznih redaka predloška')

    rows: list[dict] = []
    if a.rf:
        rf = rf_rows(a.rf, od, do)
        # Dedup protiv redaka koji su već na listu: prozor delta sheeta pokazuje
        # što baza ima, pa se dvostruki uvoz vidi OVDJE, prije nego što nastane.
        keys = tg.existing_keys()
        # ⚠ Dedup po TOČNOM (datum, iznos) propušta isti redak zaveden pod
        #   susjednim datumom — a to nije rijetkost nego pravilo: Kokin file i
        #   izvod se za knjiženje znaju razići za dan (`Mirovina III stup`:
        #   izvod 09.07., baza 10.07.). Bez tolerancije bi takav redak ušao
        #   DRUGI PUT, a saldo bi se razišao za točno taj iznos.
        dup, near, new = [], [], []
        for r in rf:
            k = (r['date'].isoformat(), r['iznos'])
            if k in keys:
                dup.append(r)
                continue
            hit = next((d for (d, a) in keys
                        if a == r['iznos']
                        and abs((date.fromisoformat(d) - r['date']).days) <= DATE_TOL), None)
            (near.append((r, hit)) if hit else new.append(r))
        rf = new
        print(f'RF izvod: {len(rf)} novih, {len(dup)} već na listu (preskočeno)')
        for r in dup:
            print(f'   = {r["date"]} {r["iznos"]:>9.2f}  {r["opis"][:45]}')
        for r, hit in near:
            print(f'   ≈ {r["date"]} {r["iznos"]:>9.2f}  {r["opis"][:40]}')
            print(f'       ⚠ isti iznos već postoji na {hit} — PRESKOČENO kao isti redak '
                  f'pod drugim datumom. Autoritet za datum je izvod, pa je popravak '
                  f'datuma u bazi (ne novi redak).')
        rows += rf
    if a.visa:
        vs = visa_rows(a.visa, date.fromisoformat(a.naplata), od, do)
        s = round(sum(r['iznos'] for r in vs), 2)
        print(f'Visa račun: {len(vs)} kupovina, Σ {s:.2f} — mora biti jednako '
              f'skupnoj naplati na RF izvodu, inače košara nije potpuna')
        rows += vs

    if not rows:
        print('Nema ničega za upisati.')
        return

    rows.sort(key=lambda r: (r['date'], r['iznos']))
    print(f'\nZa upis: {len(rows)} redaka')
    for r in rows:
        flag = '' if r['tip'] != NA else '   ⚠ Tip=N/A'
        print(f'   + {r["date"]} {r["smjer"]:<7} {r["iznos"]:>9.2f}  '
              f'{r["tip"]}/{r["podtip"]:<16} {r["opis"][:40]}{flag}')

    na = sum(1 for r in rows if r['tip'] == NA)
    if na:
        print(f'\n⚠ {na} redaka ide s Tip=N/A — legitimno za uvoz, ali ih netko '
              f'mora klasificirati (u appu ili pravilima).')

    last_stanje = next((r['stanje'] for r in reversed(rows) if r.get('stanje') is not None), None)
    if last_stanje is not None:
        print(f'\n► Kontrolni stupac mora završiti na {last_stanje:.2f} — '
              f'to je ISPISANO stanje s izvoda, ne naš izračun.')

    if a.dry:
        print('\n--dry: ništa nije zapisano.')
        return

    used, app = write_rows(tg, rows, a.racun, a.dry)
    out = a.target.with_name(f'{a.target.stem}_filled.xlsx')
    tg.wb.save(out)
    print(f'\n✓ {used} praznih redaka popunjeno, {app} dopisano ispod')
    print(f'✓ {out}')
    print('  Original je netaknut. Otvori novi file, provjeri kontrolni stupac, pa uvezi.')


if __name__ == '__main__':
    main()
