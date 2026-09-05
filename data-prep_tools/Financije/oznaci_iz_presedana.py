# -*- coding: utf-8 -*-
"""
oznaci_iz_presedana.py — sirovi tekst izvoda u `Opis`u zamjenjuje OZNAKOM. S129.

--------------------------------------------------------------------------------
ZASTO POSTOJI

Dio redaka nosi u `Opis`u doslovan strojni tekst izvoda:

    Bmove d.o.o. CASH HR00 00056571 Parking - ZAGREB - e286w-...

To nije oznaka nego ostatak uvoza, i nije samo ruzno. Zamka je zapisana u
`presedani.py`: svaki takav tekst je JEDINSTVEN, pa brojanjem obara
jednoglasnost prave oznake. Parking je zbog toga vec jednom ostao BEZ
predlozenog komentara iako je oznaka `Parking` stajala 11 puta.

--------------------------------------------------------------------------------
⚠ KLJUC JE PRIMATELJ + POZIV NA BROJ, NIKAD `Tip`/`Podtip`

Izmjereno na PROD-u 05.09.2026.: po `Tip`/`Podtip` vodeca oznaka parking
skupine ima samo 36 % — jer isti Podtip nosi i `Prevoz` (45x). Oznacavanje
po tom kljucu bi 45 redaka nazvalo krivo.

Po primatelju je isti skup 36/37 = 97 %. I obrnuto: `ZAGREBACKI HOLDING`
ima TRI razlicita poziva na broj (`12045603` Sasin stan, `03879097` Natasin,
`07140118` treci) — kljuc bez poziva bi ih slio i svakom ponudio ime onog
cesceg, dakle uvjerljivo krivo ime stana.

⚠ Presedani se racunaju IZ ZIVE BAZE pri svakom pokretanju, ne upisuju u
  kod. Skripta koja nosi zamrznut popis oznaka bila bi tocna jednom.

⚠ Prag: jednoglasnost >= 90 % I najmanje 3 presedana. Jedan presedan je
  slucajnost (isto pravilo kao drugi red `presedani.py`). Sto ne prolazi
  prag NE POGADJA SE — ispise se s razlogom i ostane kako jest.

⚠ Mijenja se SAMO `events.comment`. Iznos, datum, `Tip`/`Podtip` i
  `Izvod opis` se ne diraju — izvorni bankin tekst ostaje u `Izvod opis`u,
  pa se brisanjem iz `Opis`a nista ne gubi.

⚠ RLS-blokiran UPDATE "uspije" s 0 redaka ⇒ svaki upis mjeri BROJ redaka.

Pokretanje:
    python oznaci_iz_presedana.py            # dry run: stari Opis -> novi + Izvod opis
    python oznaci_iz_presedana.py --apply
"""
from __future__ import annotations

import collections
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from presedani import kljuc_izvoda  # noqa: E402
from uskladi_izvod import ev_date, load_db, load_env, net  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DRY = '--apply' not in sys.argv

PRAG_UDIO = 0.90
PRAG_N = 3
MAX_OZNAKA = 28          # duze od toga vise nije oznaka nego opis

# Kljucevi koje treba tretirati kao JEDAN te isti primatelj. Prazno po zadanom:
# spajanje je odluka, ne pravilo, pa se upisuje rucno i vidi u diffu.
#   primjer: ('izvgra2 bmove d', '00056571') -> ('bmove d o', '00056571')
SPOJI: dict[tuple[str, str], tuple[str, str]] = {}


def strojni(c) -> bool:
    """Je li `Opis` ostatak uvoza, a ne oznaka koju je netko napisao."""
    if not c:
        return False
    c = c.strip()
    return len(c) >= 30 and (c.lower().startswith('kreditni transfer')
                             or 'HR00' in c or 'HR01' in c or 'HR76' in c)


def main():
    url, key = load_env('prod')
    H = {'apikey': key, 'Authorization': 'Bearer ' + key,
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}

    def req(method, path, body=None):
        r = urllib.request.Request(url + '/rest/v1/' + path, method=method, headers=H,
                                   data=json.dumps(body).encode() if body else None)
        return json.load(urllib.request.urlopen(r))

    print('=' * 108)
    print('OZNAKE IZ PRESEDANA' + ('   [DRY RUN]' if DRY else '   [APPLY]'))
    print('=' * 108)

    db = load_db(url, key)
    print('ucitano redaka: ' + str(len(db)))

    def kljuc(r):
        k = kljuc_izvoda(r['attrs'].get('Izvod opis') or r['comment'])
        return SPOJI.get(k, k)

    # -- presedani iz zive baze -------------------------------------------
    pres: dict[tuple, collections.Counter] = collections.defaultdict(collections.Counter)
    for r in db:
        c = (r['comment'] or '').strip()
        if not r['attrs'].get('Izvod opis') or not c:
            continue
        if strojni(c) or len(c) > MAX_OZNAKA:
            continue
        ime, poziv = kljuc(r)
        if ime:
            pres[(ime, poziv)][c] += 1

    # -- retci koje treba popraviti ---------------------------------------
    sirovi = [r for r in db if strojni(r['comment'])]
    skup: dict[tuple, list] = collections.defaultdict(list)
    for r in sirovi:
        skup[kljuc(r)].append(r)

    print('redaka sa sirovim tekstom u `Opis`u: ' + str(len(sirovi))
          + '   ·   razlicitih primatelja: ' + str(len(skup)))

    mijenjam: list[tuple] = []
    preskacem: list[tuple] = []
    for k, rows in sorted(skup.items(), key=lambda kv: -len(kv[1])):
        c = pres.get(k)
        if not c:
            preskacem.append((k, rows, None, 'nema nijednog presedana'))
            continue
        lbl, n = c.most_common(1)[0]
        uk = sum(c.values())
        udio = n / uk
        if uk < PRAG_N:
            preskacem.append((k, rows, lbl, 'samo ' + str(uk) + ' presedan(a), prag je ' + str(PRAG_N)))
        elif udio < PRAG_UDIO:
            preskacem.append((k, rows, lbl, 'jednoglasnost ' + ('%.0f%%' % (100 * udio))
                              + ' < ' + ('%.0f%%' % (100 * PRAG_UDIO))))
        else:
            mijenjam.append((k, rows, lbl, n, uk))

    # -- ispis: stari Opis -> novi, uz `Izvod opis` ------------------------
    print('\n' + '=' * 108)
    print('MIJENJAM   (`Opis` <- oznaka iz presedana; `Izvod opis` ostaje netaknut)')
    print('=' * 108)
    n_mij = 0
    for (ime, poziv), rows, lbl, n, uk in mijenjam:
        print('\n▸ ' + ime + ('  ·  poziv ' + poziv if poziv else '')
              + '   ⇒  ' + repr(lbl) + '   [' + str(n) + '/' + str(uk) + ' = '
              + ('%.0f%%' % (100 * n / uk)) + ']   ' + str(len(rows)) + ' redaka')
        for r in sorted(rows, key=ev_date):
            n_mij += 1
            print('    ' + str(ev_date(r)) + '  ' + ('%9.2f' % net(r['attrs'])))
            print('       Opis (stari) : ' + (r['comment'] or '')[:88])
            print('       Izvod opis   : ' + str(r['attrs'].get('Izvod opis') or '—')[:88])
            print('       Opis (novi)  : ' + lbl)

    print('\n' + '=' * 108)
    print('PRESKACEM   (ostaje kako jest — sto nije jednoglasno, ne pogadja se)')
    print('=' * 108)
    n_pre = 0
    for (ime, poziv), rows, lbl, why in preskacem:
        n_pre += len(rows)
        print('\n▸ ' + ime + ('  ·  poziv ' + poziv if poziv else '')
              + '   ' + str(len(rows)) + ' redaka   — ' + why
              + (('  (vodeca bi bila ' + repr(lbl) + ')') if lbl else ''))
        for r in sorted(rows, key=ev_date):
            print('    ' + str(ev_date(r)) + '  ' + ('%9.2f' % net(r['attrs']))
                  + '  ' + (r['comment'] or '')[:74])

    print('\n' + '=' * 108)
    print('ZBROJ:  mijenjam ' + str(n_mij) + '   ·   preskacem ' + str(n_pre)
          + '   ·   ukupno ' + str(len(sirovi)))

    if not mijenjam:
        print('nema sto mijenjati.')
        return

    # -- backup ------------------------------------------------------------
    ids = [r['id'] for _, rows, *_ in mijenjam for r in rows]
    bak = req('GET', 'events?id=in.(' + ','.join(ids) + ')&select=id,event_date,comment')
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    p = ROOT / 'data-prep_data' / 'Financije' / '_arhiva' / ('backup_S129_opis_' + stamp + '.json')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(bak, ensure_ascii=False, indent=1), encoding='utf-8')
    print('backup: ' + p.name + '   (' + str(len(bak)) + ' redaka)')

    if DRY:
        print('\nDRY RUN gotov — nista nije promijenjeno. Za primjenu: --apply')
        return

    # -- upis --------------------------------------------------------------
    ok = 0
    for _, rows, lbl, _n, _uk in mijenjam:
        for r in rows:
            got = req('PATCH', 'events?id=eq.' + r['id'], {'comment': lbl})
            if len(got) != 1:
                sys.exit('   x PATCH vratio ' + str(len(got)) + ' redaka za ' + r['id']
                         + ' — RLS? STOP nakon ' + str(ok) + ' upisanih.')
            ok += 1
    print('\nupisano: ' + str(ok) + ' od ' + str(n_mij) + ' (mora biti jednako)')
    print('gotovo. Saldo, datumi i klasifikacija nisu dirani — provjera nije potrebna.')


if __name__ == '__main__':
    main()
