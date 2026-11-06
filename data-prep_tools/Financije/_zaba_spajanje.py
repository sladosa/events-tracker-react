"""_zaba_spajanje.py — koji redak ZABA izvatka baza (delta sheet) vec ima (S194, T45).

Ciste funkcije bez Excela i baze: `fill_from_izvod --zaba` im daje retke izvoda i
postojece retke lista, a one vrate odluku po svakom retku izvoda. Samoprovjera:

    python _zaba_spajanje.py --test

DO S194 je dedup bio SKUP kljuceva `(datum, iznos)` — bez smjera, bez Izvora i bez
brojanja. Tri kvara iz istog uzroka (izmjereno na `ZABA_2026-10.pdf`, S192):

  * STORNO. Izvod KEKS povrat pise kao ISPLATU s minusom (`Kupovina KEKS PAY −0,10`
    @ 09.10.), baza ga ima kao UPLATU 0,10 @ 10.10. („keks vratio"). Kljuc
    `(09.10., −0,10)` nije nadjen ⇒ alat ga je nudio kao NOV redak = duplikat
    povrata. ⇒ `obrni_storno`: negativna isplata JE uplata (i obrnuto), pa par
    trazi uz isti smjer, ±1 dan.
  * KRIVI IZVOR. Parking 01.11. 1,60 placen s racuna (m-zaba), upisan kao
    `Mastercard`; kartcni redak stoji u sekciji kosare istog lista ⇒ kljuc se
    poklopio i alat je javio „vec na listu". Tocno je bilo „na listu, ali kao
    kartica" — a to MICE SALDO za 1,60 (kartica ga ne mice). ⇒ tocan par je samo
    s retkom `Izvor = Racun`; kartcni redak istog iznosa je KRIVO MJESTO.
  * BROJANJE. Tri parkinga po 0,80 istog dana na izvodu, dva u bazi ⇒ skup je
    sva tri proglasio „vec upisanim", treci bi tiho nestao. ⇒ par je 1:1.
"""
from __future__ import annotations

import sys
from datetime import date

EPS = 0.005
BLIZU_DANA = 1      # isti redak, banka knjizila dan kasnije/ranije (KEKS storno)
DRUGDJE_DANA = 3    # kartcni redak istog iznosa — isto kao Visa alat (DRUGDJE_DANA)


def obrni_storno(smjer: str, iznos: float) -> tuple[str, float, bool]:
    """Iznos s minusom na izvodu je STORNO: `Isplata −0,10` je novac koji je
    DOSAO natrag. Vraca (smjer, pozitivan iznos, je li storno)."""
    if iznos < 0:
        return ('Uplata' if smjer == 'Isplata' else 'Isplata'), round(-iznos, 2), True
    return smjer, round(iznos, 2), False


def razvrstaj(izvod: list[dict], postojeci: list[dict]) -> dict:
    """izvod     — retci izvoda: {'date', 'smjer', 'iznos'} (iznos > 0, storno vec obrnut)
    postojeci — retci lista: {'date', 'smjer', 'iznos', 'izvor', 'zig', 'pisiv', ...}
                (redak s uplatom I isplatom daje dva unosa)

    Vraca:
      dup    [(r, p)]                 tocan par s retkom `Izvor = Racun` (1:1)
      blizu  [(r, p)]                 isti smjer + iznos, datum ±BLIZU_DANA (Racun)
      krivo  [(r, [p..], jasno)]      kartcni redak istog iznosa ±DRUGDJE_DANA, bez ziga
      novi   [r]                      ostalo (+ oni iz `krivo` koji nisu jasni)
      slobodni [p]                    Racun retci lista koje izvod nije potrosio

    ⚠ Redoslijed prolaza je vazan: tocan par PRVI, pa tek onda tolerancija. Inace
      bi blizak redak „ukrao" par retku koji ga ima tocno (`Cash 100,00` se
      ponavlja, S114).
    ⚠ `jasno` = jedini kandidat, na NJEGA ne pretendira drugi redak izvoda, ≤ 1 dan
      i pisiv (na listu, ne u `--protiv` referenci). Samo tada ga alat premjesti
      sam (Sasina odluka S194); inace NOV s upozorenjem, kao Visa alat.
    """
    uzet: set[int] = set()

    def racunski(p):
        return (p.get('izvor') or 'Racun') == 'Racun'

    dup, blizu, ostali = [], [], []
    for r in izvod:
        p = next((p for p in postojeci if id(p) not in uzet and racunski(p)
                  and p['date'] == r['date'] and p['smjer'] == r['smjer']
                  and abs(p['iznos'] - r['iznos']) < EPS), None)
        if p:
            uzet.add(id(p))
            dup.append((r, p))
        else:
            ostali.append(r)

    jos = []
    for r in ostali:
        k = [p for p in postojeci if id(p) not in uzet and racunski(p)
             and p['smjer'] == r['smjer'] and abs(p['iznos'] - r['iznos']) < EPS
             and abs((p['date'] - r['date']).days) <= BLIZU_DANA]
        if k:
            p = min(k, key=lambda p: abs((p['date'] - r['date']).days))
            uzet.add(id(p))
            blizu.append((r, p))
        else:
            jos.append(r)

    kand = {id(r): [p for p in postojeci if id(p) not in uzet and not racunski(p)
                    and not p.get('zig') and p['smjer'] == r['smjer']
                    and abs(p['iznos'] - r['iznos']) < EPS
                    and abs((p['date'] - r['date']).days) <= DRUGDJE_DANA]
            for r in jos}
    krivo, novi = [], []
    for r in jos:
        k = kand[id(r)]
        if not k:
            novi.append(r)
            continue
        p = k[0]
        jasno = (len(k) == 1 and p.get('pisiv', True)
                 and abs((p['date'] - r['date']).days) <= BLIZU_DANA
                 and sum(1 for r2 in jos if p in kand[id(r2)]) == 1)
        krivo.append((r, k, jasno))
        if jasno:
            uzet.add(id(p))
        else:
            novi.append(r)

    slobodni = [p for p in postojeci if id(p) not in uzet and racunski(p)]
    return {'dup': dup, 'blizu': blizu, 'krivo': krivo, 'novi': novi, 'slobodni': slobodni}


# ---------------------------------------------------------------------------
def _test() -> int:
    D = date.fromisoformat
    bad = 0

    def ok(uvjet, opis):
        nonlocal bad
        print(('  ✓ ' if uvjet else '  ✗ ') + opis)
        bad += 0 if uvjet else 1

    def iz(d, s, a):
        return {'date': D(d), 'smjer': s, 'iznos': a}

    def po(d, s, a, izvor='Racun', zig=False, pisiv=True):
        return {'date': D(d), 'smjer': s, 'iznos': a, 'izvor': izvor, 'zig': zig, 'pisiv': pisiv}

    print('storno')
    ok(obrni_storno('Isplata', -0.1) == ('Uplata', 0.1, True), 'Isplata −0,10 ⇒ Uplata 0,10')
    ok(obrni_storno('Uplata', -5.0) == ('Isplata', 5.0, True), 'Uplata −5 ⇒ Isplata 5')
    ok(obrni_storno('Isplata', 42.0) == ('Isplata', 42.0, False), 'obican redak netaknut')

    print('KEKS 09.10. (ZABA_2026-10, baza TEST)')
    izv = [iz('2026-10-09', 'Isplata', 0.1), iz('2026-10-09', 'Isplata', 42.0),
           iz('2026-10-09', 'Uplata', 0.1)]                       # storno vec obrnut
    baza = [po('2026-10-09', 'Isplata', 42.0), po('2026-10-09', 'Isplata', 0.1),
            po('2026-10-10', 'Uplata', 0.1)]
    o = razvrstaj(izv, baza)
    ok(len(o['dup']) == 2 and not o['novi'], '0,10 i 42,00 tocan par, nista novo')
    ok(len(o['blizu']) == 1 and o['blizu'][0][1]['date'] == D('2026-10-10'),
       'storno nadje povrat od 10.10. (±1 dan, isti smjer)')
    ok(not o['slobodni'], 'svaki redak baze potrosen')

    print('smjer se gleda')
    o = razvrstaj([iz('2026-10-09', 'Uplata', 0.1)], [po('2026-10-09', 'Isplata', 0.1)])
    ok(o['novi'] and not o['dup'], 'uplata 0,10 NIJE par isplate 0,10')

    print('brojanje 1:1')
    o = razvrstaj([iz('2026-10-04', 'Isplata', 0.8)] * 3,
                  [po('2026-10-04', 'Isplata', 0.8), po('2026-10-04', 'Isplata', 0.8)])
    ok(len(o['dup']) == 2 and len(o['novi']) == 1, 'tri na izvodu, dva u bazi ⇒ jedan NOV')
    # ⚠ `[po(...)] * 3` bi bila TRI REFERENCE NA ISTI redak — par se trosi po identitetu.
    o = razvrstaj([iz('2026-10-04', 'Isplata', 0.8)] * 3,
                  [po('2026-10-04', 'Isplata', 0.8) for _ in range(3)])
    ok(len(o['dup']) == 3 and not o['novi'], 'tri i tri ⇒ nista novo')

    print('tocan par prije tolerancije')
    o = razvrstaj([iz('2026-05-02', 'Isplata', 100.0), iz('2026-05-03', 'Isplata', 100.0)],
                  [po('2026-05-02', 'Isplata', 100.0), po('2026-05-03', 'Isplata', 100.0)])
    ok(len(o['dup']) == 2 and not o['blizu'], 'Cash 100,00 dva dana zaredom: oba tocna')

    print('parking 01.11. kao Mastercard (KRIVO MJESTO)')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard')])
    ok(not o['dup'], 'kartcni redak NIJE „vec na listu"')
    ok(len(o['krivo']) == 1 and o['krivo'][0][2] and not o['novi'], 'jedini kandidat ⇒ jasno, ne NOV')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard', zig=True)])
    ok(not o['krivo'] and o['novi'], 'kartcni redak sa zigom MC izvoda je druga kupnja ⇒ NOV')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard'),
                   po('2026-10-31', 'Isplata', 1.6, izvor='Mastercard')])
    ok(o['krivo'] and not o['krivo'][0][2] and o['novi'], 'dva kandidata ⇒ nije jasno, NOV s upozorenjem')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6), iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard')])
    ok(sum(1 for _, _, j in o['krivo'] if j) == 0 and len(o['novi']) == 2,
       'dva retka izvoda na jedan kartcni ⇒ nijedan jasan')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-10-29', 'Isplata', 1.6, izvor='Mastercard')])
    ok(o['krivo'] and not o['krivo'][0][2], '3 dana razlike ⇒ prijava, ne sam pomak')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard', pisiv=False)])
    ok(o['krivo'] and not o['krivo'][0][2], 'redak iz --protiv reference se ne pomice sam')
    o = razvrstaj([iz('2026-11-01', 'Isplata', 1.6)],
                  [po('2026-11-01', 'Isplata', 1.6), po('2026-11-01', 'Isplata', 1.6, izvor='Mastercard')])
    ok(len(o['dup']) == 1 and not o['krivo'], 'Racun redak postoji ⇒ tocan par, kartica se ne dira')

    print('\n%s' % ('SVE PROSLO' if not bad else '%d PALO' % bad))
    return 1 if bad else 0


if __name__ == '__main__':
    if '--test' in sys.argv:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.exit(_test())
    print(__doc__)
