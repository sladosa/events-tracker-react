"""
make_context_questions.py — generira `AI_KONTEKST_pitanja.txt` iz stvarnih podataka.

Saša ga popuni, `ai_classify.py` ga pročita i ubaci u system prompt.
Cilj: modelu dati ono što postoji samo u Sašinoj/Kokinoj glavi —
(A) što znače Kokine kratice, (B) gdje je granica između kategorija koje model miješa,
(C) čime popuniti retke bez Podtipa.

Pokretanje:  python make_context_questions.py
Ulaz:  Review + ai_eval_neslaganja.tsv
Izlaz: data-prep_data/Financije/AI_KONTEKST_pitanja.txt   (ne prepisuje popunjen file)
"""
from __future__ import annotations

import collections
import csv
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ai_classify as A                                          # noqa: E402

OUT = A.DATA / 'AI_KONTEKST_pitanja.txt'
MIN_CONFUSION = 5
MAX_B = 12
EX_PER_SIDE = 6

HEAD = """\
================================================================================
  KONTEKST ZA AI KLASIFIKACIJU — pitanja za Sašu
================================================================================

KAKO ISPUNITI
  Piši iza "ODGOVOR:" — u istom retku ili u više redaka ispod, svejedno.
  Prazan odgovor = preskoči, to je u redu. Bolje 5 dobrih nego 20 nagađanih.
  Piši običnim rečenicama, ne moraš formalno. Ovo ide doslovno u prompt modelu.

ZAŠTO
  Model je na prvom evalu pogodio 62,5% ručnih labela. Kad se odbiju artefakti
  podataka, strop je ~78%. Gotovo sve prave greške su ovdje: ne zna vaše kratice
  i ne zna gdje ste povukli granicu između sličnih kategorija.

  NAJVAŽNIJE JE POGLAVLJE A. Ako stigneš samo njega, i to je velik pomak.

"""

SEC_A = """\
================================================================================
  A. VAŠE KRATICE I NAČIN BILJEŽENJA
================================================================================
Model vidi samo tekst iz kolona Napomena i Izvod opis. Kad tamo piše "Anja 45/96",
on nema pojma što to znači — i umjesto da kaže NEPOZNATO, samouvjereno pogodi krivo.
Objasni sustav, ne pojedinačne retke.

"""

SEC_B = """\
================================================================================
  B. GDJE JE GRANICA IZMEĐU KATEGORIJA
================================================================================
Ispod su parovi koje model najčešće zamjenjuje. Uz svaki su STVARNI retci koje si
TI tako labelirao — pogledaj obje strane pa opiši po čemu ih razlikuješ.
Jedna rečenica je dovoljna.

"""

SEC_C = """\
================================================================================
  C. RETCI S TIPOM ALI BEZ PODTIPA (171)
================================================================================
Ovi parovi ne postoje u Taksonomiji, pa ih model ne može ni vratiti — a import
generator će za njih tražiti Podtip. Ispod je moj prijedlog po skupinama.
Napiši "da" ako je u redu, ili upiši ispravan Podtip.

"""


def clean_txt(napomena: str, izvod: str) -> str:
    return ' / '.join(x for x in (napomena, izvod) if x).strip()


def main() -> None:
    if OUT.exists() and 'ODGOVOR:' in OUT.read_text(encoding='utf-8'):
        body = OUT.read_text(encoding='utf-8')
        if re.search(r'ODGOVOR:\s*\S', body):
            sys.exit(f'✗ {OUT.name} već ima upisane odgovore — ne prepisujem. '
                     f'Preimenuj ga ako želiš novi.')

    wb = openpyxl.load_workbook(A.pick_review(), data_only=True)
    ws = wb['Review']
    H = A.header_map(ws)

    by_pair: dict[str, list[tuple[int, str]]] = collections.defaultdict(list)
    empty_pod: dict[str, list[tuple[int, str]]] = collections.defaultdict(list)
    napomene: list[tuple[int, str, str]] = []

    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        tip, pod = A.clean(r[H['Tip']]), A.clean(r[H['Podtip']])
        if not tip or tip == 'N/A':
            continue
        nap, izv = A.clean(r[H['Napomena']]), A.clean(r[H['Izvod opis']])
        txt = clean_txt(nap, izv)
        if not txt:
            continue
        by_pair[f'{tip} | {pod}'].append((i, txt))
        if not pod and tip != 'Ostali prihodi':
            empty_pod[tip].append((i, txt))
        if nap:
            napomene.append((i, nap, f'{tip} | {pod}'))
    wb.close()

    tsv = A.DATA / 'ai_eval_neslaganja.tsv'
    if not tsv.exists():
        sys.exit(f'✗ Nema {tsv.name} — pokreni prvo `ai_classify.py --eval`.')
    miss = list(csv.DictReader(tsv.open(encoding='utf-8'), delimiter='\t'))

    out = [HEAD, SEC_A]

    # ── A. Kratice ───────────────────────────────────────────────────────────
    qa = 0
    rate = [(i, n, p) for i, n, p in napomene if re.search(r'\b\d{1,3}\s*/\s*\d{1,3}\b', n)]
    if rate:
        qa += 1
        out.append(f'--- A{qa}. Zapis "ime + broj/broj"  ({len(rate)} redaka) ---\n')
        for i, n, p in rate[:8]:
            out.append(f'    red {i:>5}  {n[:40]:<41} → labelirano: {p}\n')
        out.append('\nPITANJE: Što znači taj "N/M"? Je li to rata N od M? Nešto drugo?\n'
                   '         Kako iz njega zaključiti Tip/Podtip?\n'
                   'ODGOVOR: \n\n')

    # Kratke natuknice (1–3 riječi) koje nose osobno ime ili žargon
    short = collections.Counter()
    for i, n, p in napomene:
        w = n.split()
        if 1 <= len(w) <= 3 and not re.search(r'\d{3,}', n):
            short[n] += 1
    common_short = [(n, c) for n, c in short.most_common(60) if c >= 3][:18]
    if common_short:
        qa += 1
        out.append(f'--- A{qa}. Kratke natuknice koje se ponavljaju ---\n')
        out.append('    Uz svaku napiši u zagradi što je to, ako nije očito iz imena.\n\n')
        for n, c in common_short:
            lab = next((p for _, x, p in napomene if x == n), '')
            out.append(f'    {c:>3}×  {n[:34]:<35} (labelirano: {lab})\n')
        out.append('\nPITANJE: Ima li tu obrazaca koje model ne može pogoditi?\n'
                   '         Npr. "X kune" = povrat novca od X? "Bulatova" = adresa stana?\n'
                   'ODGOVOR: \n\n')

    qa += 1
    out.append(f'--- A{qa}. Kad model NE SMIJE pogađati ---\n'
               '    Model je za "Igor kune", "Anja 45/96" i "Zoran povrat" samouvjereno\n'
               '    rekao "Domaćinstvo | Struja". Radije bi rekao NEPOZNATO nego to.\n\n'
               'PITANJE: Po čemu se prepozna zapis koji je čista interna bilješka,\n'
               '         gdje bez vas dvoje nema šanse pogoditi?\n'
               'ODGOVOR: \n\n')

    # ── B. Granice ───────────────────────────────────────────────────────────
    out.append(SEC_B)
    conf = collections.Counter((m['istina'], m['model']) for m in miss)
    merged: dict[frozenset, int] = collections.Counter()
    for (t, m), n in conf.items():
        merged[frozenset((t, m))] += n

    qb, skipped = 0, collections.Counter()
    for pair, n in merged.most_common():
        if n < MIN_CONFUSION or len(pair) != 2:
            continue
        a, b = sorted(pair)
        if a not in by_pair and b not in by_pair:
            continue
        # Filtri — bez njih ispadne 45 pitanja od kojih pola nisu pitanja za Sašu:
        if a.lower() == b.lower():                  # moj bug s velikim slovima
            skipped['velika slova (moj bug)'] += 1
            continue
        if a.endswith('| ') or b.endswith('| '):    # prazan Podtip → pokriva sekcija C
            skipped['prazan Podtip (sekcija C)'] += 1
            continue
        ta, pa = (x.strip() for x in a.split('|'))
        tb, pb = (x.strip() for x in b.split('|'))
        if ta.startswith('auto') and tb.startswith('auto') and pa.lower() == pb.lower():
            skipped['koji auto (nerješivo iz teksta)'] += 1
            continue
        if qb >= MAX_B:
            skipped['rjeđi parovi'] += 1
            continue
        qb += 1
        out.append(f'--- B{qb}. {a}   ↔   {b}   (zamijenjeno {n}×) ---\n')
        for side in (a, b):
            out.append(f'\n  Retci koje si TI labelirao kao "{side}":\n')
            for i, txt in by_pair.get(side, [])[:EX_PER_SIDE]:
                out.append(f'      red {i:>5}  {txt[:62]}\n')
            if not by_pair.get(side):
                out.append('      (nema primjera — par možda ne postoji u Reviewu)\n')
        out.append('\nPITANJE: Po čemu ih razlikuješ?\n'
                   'ODGOVOR: \n\n')

    if skipped:
        out.append('  (Preskočeno kao nepotrebno za tebe: '
                   + ' · '.join(f'{v}× {k}' for k, v in skipped.items()) + ')\n\n')

    # ── C. Prazan Podtip ─────────────────────────────────────────────────────
    out.append(SEC_C)
    SUGG = {
        'Transfer': 'izmedju racuna (osim ako opis spominje bankomat/gotovinu → cash - bankomat)',
        'Putovanja': '???  — Karte / Smještaj / Restoran, ne mogu zaključiti iz opisa',
        'Domaćinstvo': '???  — pogledaj primjere',
        'Informatika': '???  — pogledaj primjere',
        'auto C5': '???  — pogledaj primjere',
        'Zdravlje': '???',
        'Razno': '???',
    }
    for qc, (tip, rows) in enumerate(
            sorted(empty_pod.items(), key=lambda x: -len(x[1])), start=1):
        out.append(f'--- C{qc}. Tip "{tip}" bez Podtipa — {len(rows)} redaka ---\n')
        for i, txt in rows[:8]:
            out.append(f'      red {i:>5}  {txt[:62]}\n')
        out.append(f'\n  MOJ PRIJEDLOG: {SUGG.get(tip, "???")}\n'
                   'ODGOVOR (da / ispravan Podtip): \n\n')

    out.append('================================================================================\n'
               'Kad završiš, samo javi — čitam file iz\n'
               f'{OUT}\n'
               '================================================================================\n')

    OUT.write_text(''.join(out), encoding='utf-8')
    print(f'✔ {OUT}')
    print(f'  A: {qa} pitanja o kraticama · B: {qb} granica · C: {len(empty_pod)} skupina bez Podtipa')


if __name__ == '__main__':
    main()
