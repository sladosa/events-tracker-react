# -*- coding: utf-8 -*-
"""
presedani.py — Tip/Podtip iz IZBROJANE povijesti racuna. S126.

ZASTO POSTOJI
    Kartica ima `Izvod opis` kao sidro (v. `uvezi_transu.py`): tekst izvoda je
    ime trgovca. Za tekuci racun se dugo mislilo da tog sidra nema, jer svaki
    nalog pocinje istim tekstom:

        Kreditni transfer nacionalni u eurima on-line bankarstvom (m-zaba) ...

    ⚠ TO JE BILA GRESKA MJERENJA, NE PODATKA. Ispis skracen na 60 znakova
      pokazivao je samo taj prefiks; primatelj stoji IZA njega. Puni redak glasi
      `... HT d.d. - UPLATNI RACUN T-MOBILE POSTPAID HR01 29308057000-999-8`.
      Zakljucak „tekuci racun nema sidro" drzao se dok se nije ispisao cijeli
      redak. Pouka sira od ovog alata: skracen ispis je hipoteza, ne podatak.

TRI KLJUCA, OD NAJOSTRIJEG PREMA NAJSLABIJEM
    1. ime primatelja + POZIV NA BROJ   `zagrebacki holding|12045603`
    2. samo ime primatelja              `zagrebacki holding`
    3. iznos (uz predznak)              `-450.00`

    ⚠ Poziv na broj nije ukras nego RAZLIKOVNI dio. Tri kolovoska retka nose
      istog primatelja `ZAGREBACKI HOLDING` a razlicite pozive: `12045603` je
      Sasin stan, `03879097` Natasin. Kljuc bez poziva bi ih slio i svakom
      ponudio komentar onog cesceg — dakle uvjerljivo krivo ime stana.

IZMJERENO (ZABA_2026-08.pdf, 31 redak koji baza nema, povijest 443 retka)
    po iznosu          6 jednoglasnih
    po primatelju     19 jednoglasnih  — i to bas oni koje nismo znali:
                      T-mobile 207,26 (13/13), Natasa Holding 57,19 (19/19),
                      Bulatova plin 13,31 (11/11)

⚠ KLJUC KOJI NIJE JEDNOGLASAN SE NE POGADJA
    Redak ostane `N/A`, sto je legitimna vrijednost i ne blokira uvoz (S107q).
    Krivo-ali-valjano klasificiran redak `apply_rules.py` vise NE MOZE popraviti
    (preskace retke s valjanim parom), pa je `N/A` postena cijena.

⚠ KOMENTAR SE PROVJERAVA ZASEBNO OD Tip/Podtip
    `PP Sasa 6/60` i `PP Koka 3/60` dijele Tip/Podtip 12/12, ali su dva
    razlicita komentara — a 21.08. stoje dva retka po 22,90, dakle vjerojatno
    jedan svakome. Par se zato smije predloziti i kad komentar nije jednoglasan,
    ali se komentar tada NE PISE nego prijavi kao izbor.

⚠ DIO POVIJESNIH KOMENTARA JE SIROVI TEKST IZVODA, NE OZNAKA
    (`Bmove d.o.o. CASH HR00 00056571 Parking - ZAGREB - e286w-...`). Svaki je
    jedinstven, pa brojanjem obara jednoglasnost prave oznake: parking je
    `Parking` 11x uz dva takva ostatka, i komentar zbog njih NIJE bio predlozen
    — a alternativa mu je bila 60 znakova strojnog teksta. Broje se zato samo
    kratke oznake.

⚠ BROJ RATE SE NE IZMISLJA
    Presedan `Anja 84/96` je proslomjesecni. Broj se reze iz presedana, a vraca
    samo ako ga tekst izvoda stvarno nosi (`... ANJA CRNKOVIC 85/96`).
    ⚠ Granice oko znamenki su nuzne: bez njih `rezije voda za 07/2026` daje
      „ratu 07/202" — regex uhvati prve tri znamenke godine i ispadne podatak.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict

RATA_RE = re.compile(r'(?<!\d)(\d{1,3})\s*/\s*(\d{1,3})(?!\d)')

MIN_PO_IMENU = 3           # jedan presedan po imenu je slucajnost
MIN_PO_POZIVU = 2          # ime + poziv na broj je ostar kljuc; dva su pravilo
MIN_UDIO = 0.9
MAX_OZNAKA = 30            # duze od toga nije oznaka nego prepisan tekst izvoda

# /!\ UVOD JE NEOBAVEZAN, A OZNAKA KANALA SAMOSTALNA. `Izvod opis` se od S126
#     sprema SKRACEN (`(m-zaba) POSMRTNA PRIPOMOC ...`), a CLAUDE.md je tvrdio
#     da je to sigurno „jer `kljuc_izvoda` isti uvod ionako skida". Izmjereno
#     05.09.2026. na PROD-u: NE SKIDA. Bez uvoda regex ne uhvati nista, pa
#     `(m-zaba)` postane DIO IMENA primatelja:
#         dugi   -> ('posmrtna pripomoc', '1147')
#         kratki -> ('m zaba posmrtna',   '1147')
#     ⇒ 14 povijesnih PP redaka nije bilo presedan za 2 kolovoska, i alat je
#       javio „nema presedana" ondje gdje povijest ima odgovor — razred „brojac
#       koji nula pokusaja prikazuje kao nula rezultata" (S114).
#     Zato je uvod `(?:...)?`, a zagrada s kanalom se skida i sama. Uz `m-zaba`
#     ide i `mobilne aplikacije`, koji stari regex nije hvatao ni s uvodom.
_PREFIX = re.compile(
    r'^(?:kreditni transfer nac(?:ionalni)?\.? u eurima on-?line bankarstvom\s*)?'
    r'(?:\((?:m-zaba|mobilne aplikacije)\)\s*)?(?:-\s*)?', re.I)
_IBAN = re.compile(r'\bhr\d{2}[0-9a-z]{6,}\b', re.I)
_POZIV = re.compile(r'\bHR\d{2}\s+([0-9][0-9\-]{4,})', re.I)
_KOD = re.compile(r'\b(COST|OTHR|GASB|NOWS|OTLC|SEPA)\b', re.I)


def _fold(s) -> str:
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()


def kljuc_izvoda(opis) -> tuple[str, str]:
    """`Izvod opis` -> (ime primatelja, poziv na broj). Prazno ime = nema kljuca.

    ⚠ Dijakritici se FOLDAJU jer ih baza i izvod pisu razlicito: baza drzi
      `ZAGREBAcKI HOLDING` (ostatak starijeg uvoza), izvod `ZAGREBACKI`.
      Obicna usporedba tu nade nula presedana i javi „nema" umjesto „nije ni
      usporedjeno" — isti razred kao S114 brojac.
    """
    sirovi = str(opis or '')
    t = _PREFIX.sub('', _fold(sirovi).strip())
    m = _POZIV.search(sirovi)
    poziv = m.group(1).split('-')[0] if m else ''
    ime = _KOD.split(t)[0]
    ime = _IBAN.sub(' ', ime)
    ime = re.sub(r'[^a-z0-9 ]+', ' ', ime)
    ime = ' '.join(re.sub(r'\s+', ' ', ime).strip().split()[:3])
    return ime, poziv


def _bez_rate(s: str) -> str:
    """`Anja 84/96` -> `Anja`; `PP Sasa 6/60` -> `PP Sasa`."""
    return RATA_RE.sub(' ', str(s or '')).strip(' .,-')


class Presedani:
    """Rjecnik izgradjen brojanjem povijesti JEDNOG racuna i jednog izvora."""

    def __init__(self, redci, prije=None):
        """`redci` su zapisi iz `uskladi_izvod.load_db`, vec suzeni na racun i
        izvor. `prije` je ISO datum: povijest je ono STARIJE od prozora koji
        uskladujemo — inace bi se prozor klasificirao sam sobom, a to nije
        presedan nego jeka vlastitog uvoza."""
        self.po_pozivu = defaultdict(list)
        self.po_imenu = defaultdict(list)
        self.po_iznosu = defaultdict(list)
        for d in redci:
            if prije and d['event_date'] >= prije:
                continue
            a = d['attrs']
            iznos = round(float(a.get('Isplata') or 0) - float(a.get('Uplata') or 0), 2)
            zapis = {'tip': str(a.get('Tip') or ''), 'podtip': str(a.get('Podtip') or ''),
                     'comment': str(d.get('comment') or '').strip(),
                     'datum': d['event_date']}
            if iznos:
                # ⚠ Kljuc po iznosu nosi PREDZNAK. Bez njega je uplata od 7,43
                #   presedan za isplatu od 7,43 — izmjereno na 19.08.2026.
                self.po_iznosu[iznos].append(zapis)
            ime, poziv = kljuc_izvoda(a.get('Izvod opis'))
            if ime:
                self.po_imenu[ime].append(zapis)
                if poziv:
                    self.po_pozivu[ime + '|' + poziv].append(zapis)
        self.pogodaka = 0
        self.promasaja = 0

    # -- unutarnje ----------------------------------------------------------
    @staticmethod
    def _par(same):
        # WARN `N/A` u povijesti NIJE konkurentska klasifikacija nego izostanak
        #   odluke, pa ne smije glasati protiv. Izmjereno na `HLK`: 7 redaka
        #   `Zdravlje / Ljecnicka komora` i 1 `N/A` daju 7/8 = 0,875 i padaju
        #   ispod praga — dakle jedan neklasificiran redak iz proslosti ponisti
        #   sedam odluka. Neodluceni se zato izbacuju, a prag na broj presedana
        #   se primjenjuje tek na ostatak.
        same = [p for p in same if p['tip'] and p['tip'] != 'N/A']
        if not same:
            return None
        par = Counter((p['tip'], p['podtip']) for p in same)
        (tip, podtip), n = par.most_common(1)[0]
        if n / len(same) < MIN_UDIO or not tip or tip == 'N/A':
            return None
        return tip, podtip, n

    @staticmethod
    def _komentar(isti):
        kratki = [p for p in isti if p['comment'] and len(p['comment']) <= MAX_OZNAKA]
        if not kratki:
            return None, []
        kom = Counter(_bez_rate(p['comment']) for p in kratki)
        top, kn = kom.most_common(1)[0]
        if kn / len(kratki) >= MIN_UDIO:
            return top, []
        return None, [k for k, _ in kom.most_common(3)]

    # -- javno --------------------------------------------------------------
    def nadji(self, iznos: float, tekst_izvoda: str = '', smjer: str = 'Isplata'):
        """Vrati prijedlog ili None. Nikad ne baca — nepoznat redak je normalan."""
        ime, poziv = kljuc_izvoda(tekst_izvoda)
        kandidati = []
        if ime and poziv:
            kandidati.append(('ime+poziv', self.po_pozivu.get(ime + '|' + poziv, []),
                              MIN_PO_POZIVU))
        if ime:
            kandidati.append(('ime', self.po_imenu.get(ime, []), MIN_PO_IMENU))
        znak = -1 if str(smjer).lower().startswith('upl') else 1
        kandidati.append(('iznos', self.po_iznosu.get(round(round(abs(iznos), 2) * znak, 2), []),
                          MIN_PO_IMENU))

        for oznaka, same, minimum in kandidati:
            odluceni = [p for p in same if p['tip'] and p['tip'] != 'N/A']
            if len(odluceni) < minimum:
                continue
            par = self._par(same)
            if not par:
                continue
            tip, podtip, n = par
            same = odluceni
            isti = [p for p in same if (p['tip'], p['podtip']) == (tip, podtip)]
            komentar, alternative = self._komentar(isti)
            m = RATA_RE.search(str(tekst_izvoda or ''))
            if komentar and m and not RATA_RE.search(komentar):
                komentar = '%s %s/%s' % (komentar, m.group(1), m.group(2))
            self.pogodaka += 1
            return {'tip': tip, 'podtip': podtip, 'comment': komentar,
                    'alternative': alternative, 'kljuc': oznaka,
                    'dokaz': '%s, %d/%d presedana, zadnji %s'
                             % (oznaka, n, len(same), max(p['datum'] for p in isti))}
        self.promasaja += 1
        return None
