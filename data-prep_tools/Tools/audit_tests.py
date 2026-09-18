# -*- coding: utf-8 -*-
"""Uskladi `PENDING_TESTS.md` s fajlovima u `docs/sessions/tests/`.

Ritual kaze: session file ciji su SVI testovi ✅ ide u arhivu. Kriterij se nije
dao primijeniti jer kurirani redak „Otvoreno:" i ⬜ oznake u tijelu navode
razlicite skupove. Ovo to prebrojava umjesto da procjenjuje.
"""
import io
import re
import sys
from pathlib import Path

# ⚠ Windows konzola je cp1252 i ✅/⬜ je ruse s UnicodeEncodeError prije nego
#   ispise ijedan redak — alat je zato izgledao pokvaren, a samo nije mogao
#   ispisati. Ritual ga trazi svaku sesiju, pa mora raditi bez chcp 65001.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TESTS = Path('docs/sessions/tests')
PENDING = Path('docs/sessions/PENDING_TESTS.md')

# ⚠ Sufiks zna biti `A7`/`B5`, ne samo broj (S129 ih ima 15). Dok je regex tražio
#   samo znamenke, alat ih NIJE VIDIO — i S129 je prijavljivao kao „sve ✅, za arhivu"
#   dok su unutra stajala 4 otvorena testa. Instrument slijep točno ondje gdje se
#   donosi odluka o arhiviranju (isti razred kao sonda bez `areas INSERT`, S135).
# /!\ Do S137b regex je trazio `T-S<broj>-<broj>` i time bio slijep za SEST
#     oblika koji u PENDING-u stvarno postoje. Posljedica nije bila kozmeticka:
#     `T-S108-1b` je otvoren, a S108 je izgledao kao da mu fali samo `T-S108-9`
#     -- dakle sesija bi otisla u arhivu s otvorenim testom unutra, tiho.
#         T-S107k-A    slovni sufiks
#         T-S107r-A...F  raspon slova (jedan redak, vise testova)
#         T-S108-1b    broj + slovo
#         E8-2 / E15-full / E7-2/3   E2E oznake, bez `T-S` prefiksa
#     /!\ Grana MORA traziti sufiks: gola `E[0-9]+` hvata `E2` iz rijeci
#         `E2E`, koje je u ovom fileu na desetke mjesta.
ID = re.compile(r'T-S[0-9]+[a-z]?-[A-Za-z0-9]+|E[0-9]+-[A-Za-z0-9]+')

# ⚠ ID u prvoj celiji dolazi u PET oblika, i alat je do S137 vidio samo prvi:
#       T-S119-3   **T-S119-1** ⭐   `T-S121-1`   `T-S122-1` (2 slučaja)   `T-S123-1/-2`
#   Ostala cetiri su ispadala iz brojanja ⇒ file je izgledao kao da mu fali
#   redak, a redak je bio ondje. Isti razred kao `A7` sufiks (S136): instrument
#   slijep tocno ondje gdje se donosi odluka.
DECOR = re.compile(r'[*~`⭐⚠]|\([^)]*\)')


def ids_in_cell(raw):
    """ID-evi iz prve celije, ukljucujuci spojeni oblik `T-S123-1/-2`."""
    cell = DECOR.sub('', raw).strip()
    found = ID.findall(cell)
    if not found:
        return []
    # spojeni oblik: prefiks zadnjeg punog ID-a + fragmenti `/-2`, `/2`
    prefix = found[-1].rsplit('-', 1)[0]
    frags = re.findall(r'/\s*-?([A-Z]?[0-9]+)\b', cell)
    # /!\ Provjera cistoce ide nad ostatkom IZ KOJEG SU FRAGMENTI VEC MAKNUTI.
    #     Inace `T-S123-1/-2` ostavi golu `2`, celija ispadne "proza" i oba ID-a
    #     se izgube - dakle popravak spojenog oblika ponisti sam sebe.
    rest = re.sub(r'/\s*-?[A-Z]?[0-9]+\b', '', cell)
    # /!\ Uzorak se NE prepisuje ovdje -- koristi se `ID.pattern`. Dok je bio
    #     zakucan, prosirenje gornjeg regexa nije vrijedilo i za provjeru
    #     cistoce, pa je `T-S108-1b` ostavljao golo `b` i ispadao „proza".
    #     Dva uvjeta koja se moraju mijenjati ZAJEDNO.
    rest = re.sub(ID.pattern + r'|[/\s,-]', '', rest)
    if rest:
        return []
    return list(dict.fromkeys(found + ['%s-%s' % (prefix, f) for f in frags]))


def status_of(row_text, last, heading):
    """Otvoreno pobjedjuje zatvoreno U ISTOM RETKU: `✅ u kodu . ⬜ trazi deploy`
    je OTVOREN, ne pola-pola.

    Rjecnik ima PET oznaka, ne dvije - i tri su se do S137 citale kao
    "bez oznake", pa je file izgledao nedovrsen a odluka je bila donesena:
        ✅  gotovo        ⬜  otvoreno
        ~ / ->   nadidjeno drugim testom (kriterij ritual-a: 'izvela ga novija sesija')
        ⏸        parkirano odlukom (nije otvoren posao)
    Kad redak ne nosi nista, oznaku nasljedjuje od naslova sekcije - tablica
    "✅ Proslo uzivo na PROD-u" nosi je u naslovu, ne u retcima.
    """
    if last.startswith('~') or last.startswith(chr(0x2192)) or chr(0x21B3) in last:
        return 'superseded'
    if chr(0x23F8) in last:
        return 'parked'
    for text in (row_text, heading):
        if chr(0x2B1C) in text:
            return 'open'
        if chr(0x2705) in text:
            return 'done'
    return 'unclear'


# --- testovi definirani po session fileu ---
# /!\ FILE "DEFINIRA" SAMO ID-eve SVOG BROJA SESIJE -- izmjereno S140.
#     `ID.findall(txt)` kupi i UNAKRSNE REFERENCE iz proze, pa je tudji
#     otvoren test blokirao arhiviranje filea koji je zavrsen. Konkretno:
#     `S134_tests.md` u recenici spominje `T-S133-8` ("kao T-S133-8 u S135"),
#     i alat je zbog toga presudio "ne (1 otvorenih)" iako je sva 21 njegova
#     testa ✅. Izmjereno na 12 fileova: 4 nose tudje ID-eve, a `S137_tests.md`
#     ih ima 8 od 17 -- dakle manje od pola pripisanog posla bilo je njegovo.
#     Posljedica nije bila kozmeticka: to je razlog zasto je korak arhiviranja
#     "preskocen tri sesije zaredom" -- alat je tvrdio da nema sto arhivirati.
#     /!\ Tudji ID-evi se NE GUTAJU nego ispisuju zasebno: alat koji tiho
#     odbaci dio ulaza je isti razred greske koji se ovdje popravlja.
defined = {}
crossrefs = {}
for f in sorted(TESTS.glob('S*_tests.md')):
    txt = io.open(f, encoding='utf-8').read()
    own_prefix = 'T-%s-' % f.name.split('_')[0]
    found = set(ID.findall(txt))
    defined[f.name] = set(i for i in found if i.startswith(own_prefix))
    foreign = sorted(i for i in found if not i.startswith(own_prefix))
    if foreign:
        crossrefs[f.name] = foreign

# --- status iz PENDING_TESTS: gledaju se SAMO tablicni retci ---
pend = io.open(PENDING, encoding='utf-8').read()
status = {}
heading = ''
for line in pend.splitlines():
    if line.startswith('#'):
        heading = line
        continue
    if not line.startswith('|'):
        continue
    cells = [c.strip() for c in line.strip('|').split('|')]
    if len(cells) < 2:
        continue
    row_ids = ids_in_cell(cells[0])
    if not row_ids:
        continue
    last = cells[-1].strip()
    st = 'dropped' if last in ('—', '-', '') else status_of(line, last, heading)
    for i in row_ids:
        status[i] = st

# --- kurirani redak „Otvoreno:" ---
curated = set()
curated_retired = False
for line in pend.splitlines():
    if line.startswith('**Otvoreno:'):
        if 'NE VODI SE OVDJE' in line:
            curated_retired = True
        else:
            curated = set(ID.findall(line))
        break

print('=' * 78)
print('%-22s %5s %5s %5s %5s %5s  %s'
      % ('session file', 'def', '✅', '⬜', 'n/a', '?', 'arhivirati?'))
print('=' * 78)
archivable, unknown, unclear = [], {}, {}
for name, ids in sorted(defined.items()):
    if not ids:
        continue
    done = sum(1 for i in ids if status.get(i) in ('done', 'superseded', 'parked'))
    open_ = sum(1 for i in ids if status.get(i) == 'open')
    na = sorted(i for i in ids if i not in status)
    unc = sorted(i for i in ids if status.get(i) == 'unclear')
    if na:
        unknown[name] = na
    if unc:
        unclear[name] = unc
    if open_ == 0 and not na and not unc:
        verdict, _ = 'DA', archivable.append(name)
    else:
        bits = []
        if open_:
            bits.append('%d otvorenih' % open_)
        if na:
            bits.append('%d bez retka' % len(na))
        if unc:
            bits.append('%d bez oznake' % len(unc))
        verdict = 'ne (%s)' % ', '.join(bits)
    print('%-22s %5d %5d %5d %5d %5d  %s'
          % (name, len(ids), done, open_, len(na), len(unc), verdict))

print('=' * 78)
print('Za arhivu (%d): %s' % (len(archivable), ', '.join(archivable) or '—'))

if crossrefs:
    print()
    print('Unakrsne reference (spomenute u prozi, NE ulaze u presudu):')
    for name, ids in sorted(crossrefs.items()):
        print('  %-22s %s' % (name, ', '.join(ids)))

# ⚠ IMENUJ, NE BROJI. Dok je alat ispisivao samo „10 bez oznake", triaza se
#   morala raditi rucnim skriptom — a brojka se cita kao „negdje nesto fali".
for title, bucket in (('PENDING nema redak za', unknown),
                      ('redak postoji, ali bez ✅/⬜', unclear)):
    if bucket:
        print()
        print('%s (%d):' % (title, sum(len(v) for v in bucket.values())))
        for name, ids in sorted(bucket.items()):
            print('  %-22s %s' % (name, ', '.join(ids)))

# --- naslov u detaljnom fileu vs redak u PENDING-u ---
# /!\ Naslovi se u praksi NE azuriraju kad test prodje: pri uvodjenju ove
#     provjere 13 ih se razilazilo. Nije kozmetika -- Sasa cita BAS detaljni
#     file kad izvodi test, pa mu `[ ]` iznad prosloga testa kaze da posao
#     jos stoji. PENDING je autoritet; naslov je kopija koja odluta.
HEAD = re.compile(r'^#{1,3} .*?(' + ID.pattern + ')')
drift = []
for f in sorted(TESTS.glob('S*_tests.md')):
    for line in io.open(f, encoding='utf-8'):
        m = HEAD.match(line)
        if not m:
            continue
        want = status.get(m.group(1))
        if want is None:
            continue
        got = 'open' if '⬜' in line else ('done' if '✅' in line else None)
        if got and want in ('done', 'open') and got != want:
            drift.append((m.group(1), f.name, want, got))
if drift:
    print()
    print('NASLOV SE NE SLAZE S PENDING-om (%d):' % len(drift))
    for i, fn, want, got in drift:
        print('  %-13s %-22s PENDING=%-5s naslov=%s' % (i, fn, want, got))

# --- proturjecnost: kurirani redak vs tablice ---
open_in_tables = {i for i, st in status.items() if st == 'open'}
only_curated = sorted(curated - open_in_tables)
only_tables = sorted(open_in_tables - curated)
print()
if curated_retired:
    # /!\\ Kurirani popis je UKINUT u S116 (redak glasi 'NE VODI SE OVDJE') jer se
    #     rucno odrzavao i razilazio s tablicama. Do S139 je alat taj marker citao
    #     kao PRAZAN popis, pa je SVAKI otvoren redak prijavljivao kao proturjecnost:
    #     izmjereno 22 od 22, dakle brojka je bila artefakt provjere, a ne stanje
    #     dokumenta. Audit od 2026-09-16 ju je preuzeo kao nalaz o dokumentu.
    # /!\\ Upozorenje koje uvijek pali covjek nauci preskakati -- pa onda ne vidi
    #     ni ono pravo. Zato se ovdje SUTI, ne ispisuje nula.
    print('Kurirani popis Otvoreno: ukinut je u S116 -- tablice su jedini izvor.')
    print('Provjera proturjecnosti se preskace: nema s cim usporediti.')
else:
    print('PROTURJECNOST u PENDING_TESTS.md')
    print('  „Otvoreno:" navodi, a tablica ne kaze ⬜ : %d  %s' % (len(only_curated), only_curated[:12]))
    print('  tablica kaze ⬜, a „Otvoreno:" ne navodi : %d  %s' % (len(only_tables), only_tables[:12]))
