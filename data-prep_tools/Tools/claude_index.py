# -*- coding: utf-8 -*-
"""Generira navigacijski indeks CLAUDE.md-a iz njegovih `## ` naslova.

/!\ Brojevi redaka zastare cim se file dirne. Zato ovo NIJE rucno pisana tablica
    nego generator: `python data-prep_tools/Tools/claude_index.py --write`.
    Rucno odrzavan indeks koji laze o broju retka gori je od nikakvog.
"""
import io
import re
import sys

PATH = 'CLAUDE.md'
BEGIN = '<!-- INDEX:BEGIN -->'
END = '<!-- INDEX:END -->'

# Uloga sekcije odlucuje smije li se dirati:
#   stit     = svaki redak je placen izmjerenim kvarom; skracivanje = regresija
#   kvarljivo = stanje/plan; zastari sam od sebe, provjeri datum prije nego vjerujes
ROLE = {
    'Three core principles': 'stit',
    'Critical rules': 'stit',
    'Zamke': 'stit',
    'Izmjereno i': 'stit',
    'Sljedeci koraci': 'kvarljivo',
    'Sljedeći koraci': 'kvarljivo',
    'Financije migracija': 'kvarljivo',
    'Open bugs': 'kvarljivo',
    'Backlog': 'kvarljivo',
    'S112+': 'kvarljivo',
}
MARK = {'stit': 'X', 'kvarljivo': '~'}

# Povratni link ispod svakog `## ` naslova.
# /!\ BEZ ugao-zagrada, za razliku od linkova u indeksu. One su ondje nuzne jer
#     naslovi imaju RAZMAKE; meta povratka je `## Sadrzaj` -- jedna rijec, pa je
#     `(#Sadrzaj)` obican link koji renderira svaki parser. Ugao-zagrade su ovdje
#     bile suvisna sintaksa, a suvisna sintaksa je mjesto gdje se renderiranje
#     razilazi (Obsidian Live Preview ih nije prikazivao kao link, Reading jest).
BACKLINK = '[↑ Sadrzaj](#Sadrzaj)'
# /!\ CISCENJE IDE PO OBLIKU, NE PO DOSLOVNOM STRINGU -- i to je placeno (S139).
#     Prva verzija je brisala retke jednake `BACKLINK`u. Cim se `BACKLINK`
#     promijenio (maknute ugao-zagrade), stari retci se vise nisu poklapali:
#     nisu obrisani, a novi su dodani => file je narastao za 18 redaka i imao
#     DVA povratna linka ispod svakog naslova. Cuvar koji prepoznaje samo
#     danasnji oblik ne stiti od sutrasnje promjene tog oblika.
BACKLINK_RE = re.compile(r'^\[↑ Sadrzaj\]\(<?#Sadrzaj>?\)$')


def add_backlinks(lines):
    """Ubaci povratni link ispod svakog `## ` naslova. IDEMPOTENTNO.

    /!\ Prvo se makne stari, pa doda novi -- inace svaki `--write` doda jos
        jedan redak i file naraste za 18 redaka po pokretanju. Brisanje ide
        usporedbom CIJELOG retka, ne `startswith`, da se ne pojede tekst koji
        slucajno pocinje istim linkom.
    /!\ Zove se PRIJE racunanja brojeva redaka: ubacivanje pomice sve ispod
        sebe, pa bi obrnut redoslijed dao indeks koji laze -- isti razred kao
        dvoprolazni izracun offseta nize.
    /!\ `## Sadrzaj` ovdje NE postoji: indeks je vec izrezan iz body-ja, pa
        sekcija sadrzaja ne moze dobiti link na samu sebe.
    """
    stripped = [l for l in lines if not BACKLINK_RE.match(l.strip())]
    out = []
    for line in stripped:
        out.append(line)
        if line.startswith('## '):
            out.append(BACKLINK)
    return out



def role_of(title):
    for key, val in ROLE.items():
        if title.startswith(key):
            return val
    return ''


def build(lines, offset=0):
    rows = []
    for i, line in enumerate(lines, 1):
        if not line.startswith('## '):
            continue
        title = line[3:].strip()
        # /!\ SIDRO JE IME NASLOVA, NE GitHub SLUG -- i to je mjereno (S139).
        #     CLAUDE.md se cita u Obsidianu (`.obsidian/` je u korijenu), a on
        #     fragment iza `#` razrjesava kao IME NASLOVA. Neosjetljiv je na
        #     velika/mala slova, ali crtice NE pretvara u razmake -- pa je od 18
        #     sekcija radila tocno jedna (`Backlog`), jer je jedina jednorjecna.
        #     Izmjereno klikanjem svih varijanti: rade `(<#Tocan Naslov>)`,
        #     postotno kodiran oblik i wikilink; GitHub slug ne radi.
        #     Biran je ugao-zagrada oblik: standardni CommonMark (za razliku od
        #     wikilinka, koji na GitHubu ispadne kao goli tekst) i citljiv u
        #     sirovom fileu, sto je vazno jer Claude ovo cita sirovo.
        #     /!\ CIJENA: na GitHubu sidra vise ne skacu. Stupac s BROJEM RETKA
        #     radi svugdje i zato ostaje -- on je, a ne link, jamstvo navigacije.
        anchor = title.replace('**', '')
        rows.append((i + offset, title, anchor, role_of(title)))
    total = len(lines) + offset
    out = [BEGIN,
           '',
           '## Sadrzaj',
           '',
           '> Generirano: `python data-prep_tools/Tools/claude_index.py --write`.',
           '> **X** = stit od regresije, svaki redak placen izmjerenim kvarom -- ne skracivati.',
           '> **~** = kvarljivo (stanje/plan) -- prije nego vjerujes, provjeri datum u naslovu.',
           '',
           '| r. | sekcija | |',
           '| ---: | --- | :---: |']
    for i, title, anchor, role in rows:
        out.append('| %d | [%s](<#%s>) | %s |' % (i, title, anchor, MARK.get(role, '')))
    out += ['', '_Ukupno %d redaka, %d sekcija._' % (total, len(rows)), '', END]
    return '\n'.join(out)


src = io.open(PATH, encoding='utf-8').read()
body = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n*', '', src, flags=re.S)
lines = add_backlinks(body.splitlines())
# indeks ide iza uvodnog bloka, prije prvog `---`
cut = next(i for i, l in enumerate(lines) if l.strip() == '---')
# /!\ Dva prolaza: brojevi redaka moraju opisivati file KOJI IZLAZI, a indeks
#     ga produzuje. Jedan prolaz daje brojeve pomaknute za duljinu indeksa --
#     dakle indeks koji LAZE, sto je gore od nikakvog. Isti razred kao S129:
#     brojka mora opisivati file koji izlazi, ne onaj iz kojeg se racuna.
offset = len(build(lines).splitlines()) + 1
index = build(lines, offset)
assert len(index.splitlines()) + 1 == offset, 'duljina indeksa nije stabilna'
new = '\n'.join(lines[:cut]) + '\n' + index + '\n\n' + '\n'.join(lines[cut:]) + '\n'
if '--write' in sys.argv:
    io.open(PATH, 'w', encoding='utf-8').write(new)
else:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(index)
