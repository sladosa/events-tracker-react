# -*- coding: utf-8 -*-
"""
analiza_snage.py — korak 3 modela treninga (TRENING_MIGRACIJA.md „Dogovor 28.10.", S187).

SAMO ČITA lokalne kopije — PROD backup (`data-prep_data/_backup/prod/<zadnji>/db.json.gz`)
i kopiju `trening*.xlsm` (Claude-temp_R/trening/) — i piše Excel za Sašu:

  Vjezbe   nazivi vježbi iz PROD `Fitness` (exercise_name, sets_reps, weight_info) i DIARY `M`,
           grupirani po ključu (aliasi `pull`, `pull.m`, `pull m.` = jedan ključ), s brojevima,
           rasponom datuma, primjerom i PRIJEDLOGOM (slug, puno ime, skupina, vrsta) iz
           `vjezbe_prijedlog.json`. Saša ispravlja stupce prijedloga.
  Mjesta   riječi s velikim slovom u danima teretane (GymS, Westin, CleverFIT…) + prijedlog.
  Rutine   PROD: po treningu (sesiji) Strength_type i vježbe — koje se javljaju zajedno.
  Serije   oblik zapisa uz vježbu (piramida, AxB, kg×reps, vrijeme, superset…) — za format.

⚠ DIARY `M` je osobni tekst (ljudi, zdravlje) — izlaz ide SAMO u `Claude-temp_R/` (gitignore),
   nikad u repo. Ovaj file i `vjezbe_prijedlog.json` nose samo nazive vježbi i mjesta.

Pokretanje:  Tools\\run.bat Trening\\analiza_snage.py            (pa otvori ispisani .xlsx)
             Tools\\run.bat Trening\\analiza_snage.py --termini  (samo ispiši top nazive)
"""
from __future__ import annotations

import collections
import datetime as dt
import gzip
import json
import re
import sys
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

ROOT = Path(__file__).resolve().parents[2]
BACKUP_DIR = ROOT / 'data-prep_data' / '_backup' / 'prod'
TRENING_DIR = ROOT / 'Claude-temp_R' / 'trening'
OUT_DIR = ROOT / 'Claude-temp_R' / 's187'
PRIJEDLOG = Path(__file__).with_name('vjezbe_prijedlog.json')

DIARY_OD = 2021          # teretana je u DIARY-ju gusta od 2021. (138 → 260 dana/god.)

# ─────────────────────────────────────────────
# Tekst → kandidati za naziv vježbe
# ─────────────────────────────────────────────

# Riječ malim slovom (s točkama/crticama: `z.sklek`, `squat-bulg`), po želji + kratica s točkom
# (`pull m.`, `leg r.`, `kosa k.`). Uz to kratice VELIKIM slovima (IMOM, HIIT, GtG).
_TERM = re.compile(
    r"(?<![A-Za-zčćšđžČĆŠĐŽ])"
    r"([a-zčćšđž][a-zčćšđž.\-]*[a-zčćšđž.](?:\s[a-zčćšđž]{1,3}\.)?|[A-Z][A-Za-z]{1,5}[A-Z]\w*)"
)
# Riječ odmah iza broja i apostrofa/mjere: `5'erg`, `30'orb`, `10min orb`
_AFTER_NUM = re.compile(r"\d+\s*['’]\s*([a-zčćšđž][a-zčćšđž.\-]*)")

# Riječi koje nisu vježba (veznici, prilozi, česte riječi pripovijedanja). Namjerno kratko:
# ostatak razvrstava prijedlog (`vjezbe_prijedlog.json` → vrsta „nije vježba").
_STOP = set("""
s sa i u na do od za po pa ali a o uz iz pri kod te ni no ili jer kao sto što da ne nisam sam me mi se je su
bio bila bilo ima imam nema malo jako vise više manje oko cca dosta jos još opet tek bas baš samo sve svi
poslije prije onda zatim lagano lagana jace jače jaci jači dobro dobar los loš umoran umorna gnjavaza
pjeske pješke setnja šetnja hodam hodanje ujutro navecer navečer danas jutro popodne dan h min x kg km
serija serije ponavljanja put puta zbog zato kad kada gdje tu tamo nesto nešto nije bez puls
""".split())


def _key(term: str) -> str:
    """Ključ aliasa: mala slova, bez točaka, razmaka i crtica (`pull m.` = `pull.m` = `pullm`)."""
    return re.sub(r"[.\s\-]", "", term.lower())


def termini(text: str) -> list[str]:
    out: list[str] = []
    for m in _AFTER_NUM.finditer(text):
        out.append(m[1].rstrip('.'))
    for m in _TERM.finditer(text):
        t = m[1].strip()
        if t.lower().rstrip('.') in _STOP or len(_key(t)) < 3:
            continue
        out.append(t)
    return out


# ─────────────────────────────────────────────
# Oblik zapisa serija (za odluku o formatu, korak 4)
# ─────────────────────────────────────────────

OBLICI: list[tuple[str, re.Pattern]] = [
    ('piramida težina (44-52-58kg)', re.compile(r"\d+(?:[,.]\d)?\s*-\s*\d+(?:[,.]\d)?\s*-\s*\d+(?:[,.]\d)?\s*kg", re.I)),
    ('piramida ponavljanja (15-12-8 / 15,12,8)', re.compile(r"\(?\s*\d+x?\s*[-,]\s*\d+\s*[-,]\s*\d+(?:\s*[-,]\s*\d+)*\s*\)?(?!\s*kg)")),
    ('serije×ponavljanja×kg (4x12x10kg)', re.compile(r"\d+\s*x\s*\d+\s*x\s*\d+(?:[,.]\d)?\s*kg", re.I)),
    ('serije×ponavljanja (3x15, 2 x 20)', re.compile(r"\b\d+\s*x\s*\d+\b(?!\s*x)(?!\s*kg)", re.I)),
    ('kg × ponavljanja (60kg x 12, 12xkg55)', re.compile(r"\d+(?:[,.]\d)?\s*kg\s*x\s*\d+|\d+\s*x\s*kg\s*\d+", re.I)),
    ('samo kg (bic 20kg)', re.compile(r"\b\d+(?:[,.]\d)?\s*kg\b", re.I)),
    ('vrijeme mm:ss (plank 2:30)', re.compile(r"\b\d{1,2}:\d{2}\b")),
    ("minute (10'erg, 10min)", re.compile(r"\d+\s*(?:['’]|min\b)", re.I)),
    ('sekunde (45", 30s)', re.compile(r"\d+\s*(?:\"|s\b|sec\b)", re.I)),
    ('superset / između serija', re.compile(r"izme[dđ]u|\+", re.I)),
    ('blok N×( … )', re.compile(r"\d+\s*x\s*\(", re.I)),
    ('IMOM / GtG / HIIT', re.compile(r"\b(?:IMOM|GtG|HIIT)", re.I)),
]


def oblici(text: str) -> list[str]:
    return [ime for ime, rx in OBLICI if rx.search(text)]


# ─────────────────────────────────────────────
# Izvori
# ─────────────────────────────────────────────

def zadnji_backup() -> Path:
    dirs = sorted(p for p in BACKUP_DIR.iterdir() if (p / 'db.json.gz').exists())
    if not dirs:
        sys.exit(f'Nema PROD backupa u {BACKUP_DIR}')
    return dirs[-1] / 'db.json.gz'


def zadnji_diary() -> Path:
    files = sorted(TRENING_DIR.glob('trening*.xlsm'), key=lambda p: p.stat().st_mtime)
    if not files:
        sys.exit(f'Nema kopije trening*.xlsm u {TRENING_DIR} (OneDrive original se ne otvara)')
    return files[-1]


def prod_fitness(path: Path):
    """PROD `Fitness`: leaf eventi Gym > Strength / Cardio s atributima, po sesiji."""
    t = json.load(gzip.open(path))['tables']
    areas = {a['id']: a['name'] for a in t['areas']}
    cats = {c['id']: c for c in t['categories']}
    fit = {cid for cid, c in cats.items() if areas.get(c['area_id']) == 'Fitness'}
    defs = {d['id']: d for d in t['attribute_definitions'] if d['category_id'] in fit}
    vals: dict[str, dict[str, str]] = collections.defaultdict(dict)
    for ea in t['event_attributes']:
        d = defs.get(ea['attribute_definition_id'])
        if d is None:
            continue
        v = ea.get('value_text')
        if v is None and ea.get('value_number') is not None:
            v = str(ea['value_number'])
        if v not in (None, ''):
            vals[ea['event_id']][d['slug']] = v
    events = []
    for e in t['events']:
        c = cats.get(e['category_id'])
        if not c or e['category_id'] not in fit or c['name'] not in ('Strength', 'Cardio'):
            continue
        events.append({'id': e['id'], 'leaf': c['name'], 'date': e['event_date'],
                       'session': e['session_start'], 'v': vals.get(e['id'], {})})
    return events


def diary_m(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['DIARY']
    out = []
    for r in ws.iter_rows(min_row=1, max_col=13, values_only=True):
        d = next((c for c in r[:4] if isinstance(c, dt.datetime)), None)
        if d and d.year >= DIARY_OD and r[12]:
            out.append((d.date().isoformat(), str(r[12])))
    return out


_GYM_DAN = re.compile(
    r"(?i)\b(gym\w*|clever\w*|westin|mofit|teretan\w*|aso\s+f)\b|\d+\s*['’]\s*(erg|orb|bic|byc)|"
    r"pull|sklek|plank|girj|swing|squat|bulg|leg\.?\s?r|biceps|tric|kosa k|istezanj|IMOM")


# ─────────────────────────────────────────────
# Excel
# ─────────────────────────────────────────────

def tekst(v):
    """Slobodan tekst nikad kao formula (zamka S124: `=`, `+`, `-`, `@` na početku)."""
    if isinstance(v, str) and v[:1] in ('=', '+', '-', '@'):
        return "'" + v
    return v


def sheet(wb, ime, zaglavlje, retci, sirine, uputa=None):
    ws = wb.create_sheet(ime)
    start = 1
    if uputa:
        ws.cell(1, 1, tekst(uputa)).font = Font(italic=True, color='FF555555')
        start = 3
    for i, h in enumerate(zaglavlje, 1):
        c = ws.cell(start, i, h)
        c.font = Font(bold=True)
        c.fill = PatternFill('solid', fgColor='FFDDEBF7')
    for r, row in enumerate(retci, start + 1):
        for i, v in enumerate(row, 1):
            ws.cell(r, i, tekst(v))
    for i, w in enumerate(sirine, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(start + 1, 1)
    ws.auto_filter.ref = f"A{start}:{openpyxl.utils.get_column_letter(len(zaglavlje))}{start + max(1, len(retci))}"
    return ws


def main():
    # Windows konzola je cp1252 — „Vježbe" bi srušio ispis nakon što je Excel već napisan.
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    samo_termini = '--termini' in sys.argv
    bpath, dpath = zadnji_backup(), zadnji_diary()
    print(f'PROD backup: {bpath.parent.name}   DIARY kopija: {dpath.name}')
    prod = prod_fitness(bpath)
    diary = [(d, m) for d, m in diary_m(dpath) if _GYM_DAN.search(m)]
    print(f'PROD Strength/Cardio eventa: {len(prod)}   DIARY dana s teretanom od {DIARY_OD}.: {len(diary)}')

    # ── Vježbe ──
    stat = collections.defaultdict(lambda: {'oblici': collections.Counter(), 'prod': 0, 'diary': set(),
                                            'prvi': None, 'zadnji': None, 'primjer': '', 'polja': collections.Counter()})

    def vidi(term, datum, izvor, primjer, polje=None):
        s = stat[_key(term)]
        s['oblici'][term] += 1
        if izvor == 'prod':
            s['prod'] += 1
        else:
            s['diary'].add(datum)
        if polje:
            s['polja'][polje] += 1
        s['prvi'] = min(filter(None, [s['prvi'], datum]))
        s['zadnji'] = max(filter(None, [s['zadnji'], datum]))
        if not s['primjer'] or (izvor == 'diary' and len(s['primjer']) > 120):
            s['primjer'] = primjer[:160]

    for e in prod:
        v = e['v']
        if v.get('exercisename'):
            vidi(v['exercisename'], e['date'], 'prod', ' | '.join(filter(None, [v.get('exercisename'), v.get('setsreps'), v.get('weightinfo')])), 'exercise_name')
        if v.get('equipment'):
            vidi(v['equipment'], e['date'], 'prod', f"Cardio: {v['equipment']} {v.get('cardio-type', '')}", 'equipment')
        for slug in ('setsreps', 'weightinfo'):
            for t in termini(v.get(slug, '')):
                vidi(t, e['date'], 'prod', f"{v.get('exercisename', '')} | {v.get(slug)}", slug)
    for d, m in diary:
        for t in termini(m):
            vidi(t, d, 'diary', m)

    prijedlog = json.loads(PRIJEDLOG.read_text('utf-8')) if PRIJEDLOG.exists() else {}
    vjezbe = sorted(stat.items(), key=lambda kv: -(kv[1]['prod'] + len(kv[1]['diary'])))
    vjezbe = [kv for kv in vjezbe if kv[1]['prod'] + len(kv[1]['diary']) >= 3]

    if samo_termini:
        for k, s in vjezbe[:300]:
            alias = ', '.join(f'{a}' for a, _ in s['oblici'].most_common(4))
            print(f"{s['prod']:4} {len(s['diary']):4}  {k:22} {alias}")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    redovi = []
    for k, s in vjezbe:
        p = prijedlog.get(k, {})
        if p.get('vrsta') == 'nije vježba' and not p.get('prikazi'):
            continue
        redovi.append([
            p.get('slug', ''), p.get('ime', ''), p.get('skupina', ''), p.get('vrsta', ''),
            k, ', '.join(a for a, _ in s['oblici'].most_common(6)),
            s['prod'], len(s['diary']), s['prvi'], s['zadnji'],
            ', '.join(f'{p_}×{n}' for p_, n in s['polja'].most_common()), s['primjer'],
        ])
    # Prijedlozi gore (po slugu, pa po broju), bez prijedloga dolje — ondje je većinom
    # pripovijedanje („nemam", „umoran"), a vrijedno se traži u prvih stotinjak redaka.
    redovi.sort(key=lambda r: (r[0] == '' and r[3] == '', r[0] or '~', -(r[6] + r[7])))
    sheet(wb, 'Vjezbe',
          ['slug (prijedlog)', 'puno ime (prijedlog)', 'skupina', 'vrsta', 'ključ', 'kako je pisano',
           'PROD eventa', 'DIARY dana', 'prvi', 'zadnji', 'polje u PROD', 'primjer'],
          redovi, [14, 26, 12, 13, 16, 34, 7, 7, 11, 11, 22, 90],
          uputa='Ispravi ŽUTE stupce A–D (slug, puno ime, skupina, vrsta). Isti slug u dva retka = isti zapis kataloga '
                '(aliasi). vrsta „nije vježba" = ne ide u katalog. Retke bez prijedloga popuni ili ostavi prazne.')
    ws = wb['Vjezbe']
    for r in range(4, 4 + len(redovi)):
        for c in range(1, 5):
            ws.cell(r, c).fill = PatternFill('solid', fgColor='FFFFF2CC')

    # ── Mjesta ──
    mjesta = collections.Counter()
    primjer_m: dict[str, str] = {}
    for d, m in diary:
        for w in re.findall(r"\b(?:Gym\s?[A-Z]\b\.?|[A-Z][A-Za-z]+(?:FIT)?)", m):
            w = w.rstrip('.')
            mjesta[w] += 1
            primjer_m.setdefault(w, f'{d} | {m[:140]}')
    pm = prijedlog.get('_mjesta', {})
    sheet(wb, 'Mjesta', ['mjesto (prijedlog)', 'kako je pisano', 'DIARY dana', 'primjer'],
          [[pm.get(w, ''), w, n, primjer_m[w]] for w, n in mjesta.most_common() if n >= 3],
          [22, 18, 9, 110],
          uputa='Riječi s velikim slovom u danima teretane (od 2021.). Upiši ime mjesta u stupac A gdje je to mjesto; '
                'isto ime u više redaka = aliasi (GymS, Gym S, Gyms). Ljudi i ostalo: ostavi prazno.')

    # ── Rutine (PROD) ──
    sesije = collections.defaultdict(list)
    for e in prod:
        if e['leaf'] == 'Strength':
            sesije[e['session']].append(e)
    po_tipu = collections.defaultdict(lambda: {'n': 0, 'vj': collections.Counter()})
    for evs in sesije.values():
        tipovi = collections.Counter(e['v'].get('strengthtype', '?') for e in evs)
        glavni = [t for t, _ in tipovi.most_common() if t != 'wormup'][:1] or ['wormup']
        r = po_tipu[glavni[0]]
        r['n'] += 1
        for vj in {e['v'].get('exercisename') for e in evs if e['v'].get('exercisename')}:
            r['vj'][vj] += 1
    rut = []
    for tip, r in sorted(po_tipu.items(), key=lambda kv: -kv[1]['n']):
        for vj, n in r['vj'].most_common():
            rut.append([tip, r['n'], vj, n, round(100 * n / r['n'])])
    cardio = collections.Counter((e['v'].get('cardio-type', '?'), e['v'].get('equipment', '?')) for e in prod if e['leaf'] == 'Cardio')
    for (ct, eq), n in cardio.most_common():
        rut.append([f'Cardio: {ct}', '', eq, n, ''])
    sheet(wb, 'Rutine', ['vrsta treninga (glavni Strength_type)', 'treninga', 'vježba', 'u koliko treninga', '%'],
          rut, [30, 9, 24, 12, 6],
          uputa=f'PROD Fitness, {len(sesije)} treninga snage (sesija = jedan trening). Koje se vježbe javljaju u kojoj vrsti '
                '— temelj za rutine (Upper / Core / Legs …).')

    # ── Oblik serija ──
    obl = collections.defaultdict(lambda: {'prod': 0, 'diary': 0, 'pr': []})
    for e in prod:
        for slug in ('setsreps', 'weightinfo'):
            txt = e['v'].get(slug)
            if not txt:
                continue
            for o in oblici(txt):
                obl[o]['prod'] += 1
                if len(obl[o]['pr']) < 4:
                    obl[o]['pr'].append(f"PROD {e['v'].get('exercisename', '')}: {txt}")
    for d, m in diary:
        # Vrijeme na početku retka (`10:10 CleverFIT …`, `16h …`) je doba dana, ne serija.
        for o in oblici(re.sub(r"^\s*(?:u\s+)?\d{1,2}(?::\d{2}|h)\b", '', m)):
            obl[o]['diary'] += 1
            if len(obl[o]['pr']) < 8 and o not in ('superset / između serija',):
                obl[o]['pr'].append(f'{d}: {m[:120]}')
    sheet(wb, 'Serije', ['oblik zapisa', 'PROD polja', 'DIARY dana', 'primjeri'],
          [[o, obl[o]['prod'], obl[o]['diary'], '\n'.join(obl[o]['pr'])] for o, _ in OBLICI if o in obl],
          [40, 10, 10, 120],
          uputa='Koliko se koji oblik javlja — podloga za format zapisa serija (korak 4). Jedan redak teksta može imati više oblika.')
    for row in wb['Serije'].iter_rows(min_row=4):
        row[3].alignment = Alignment(wrap_text=True, vertical='top')

    out = OUT_DIR / f'analiza_snage_{dt.date.today():%Y%m%d}.xlsx'
    wb.save(out)
    print(f'Vježbe: {len(redovi)} ključeva (s prijedlogom: {sum(1 for r in redovi if r[0])})   '
          f'Mjesta: {sum(1 for n in mjesta.values() if n >= 3)}   Rutine: {len(sesije)} treninga snage')
    print(f'→ {out}')


if __name__ == '__main__':
    main()
