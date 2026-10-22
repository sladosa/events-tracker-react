# -*- coding: utf-8 -*-
"""pravila_trgovca.py — `uzorak trgovca → Tip / Podtip`, kad povijest šuti. S174 (T17).

ZAŠTO POSTOJI
    `razvrstaj_na.py` predlaže samo iz izbrojane povijesti po KLJUČU trgovca. Nova poslovnica
    (`INA ZAGREB JAGICEVA` uz poznatu `INA ZAGREB MIRAMARSKA`) ili varijacija imena je za njega
    „trgovac bez presedana" — 302 od 574 neriješena N/A retka 2024-01…2025-09 (PROD 18.10.).

ODAKLE PRAVILA
    Predložio ih je AI (claude-opus-5-5, 18.10.2026.) iz RUČNO razvrstane povijesti `Financije_all`.
    Svako je zatim PREBROJANO nad bazom (ne nad onim što je model tvrdio): zadnji stupac =
    potvrde / svi razvrstani retci koje uzorak hvata. Saša je pregledao listu i odlučio što ulazi
    (odbijeno: `^pu\b` — dva slova hvataju tuđeg trgovca; `recepcija` — riječ, ne trgovac;
    `paypal *booking` — bez presedana). Postupak: `Claude-temp_R/s174_pravila/` (radni stol).

PRAVILA PRAVILA (data-prep_tools/CLAUDE.md „Rječnik `Izvod opis`")
    - Gađa se TRGOVAC, ne riječ (`spa` je hvatao FastSpring, `parking` uplatu Anji).
    - Posrednik (KEKS PAY, KUPOVINA…, goli PAYPAL) se ne pokušava — pozivatelj ga isključi PRIJE.
    - Pravilo je ZADNJI ključ: Kokin opis i jednoglasni presedan pobjeđuju.
    - Par mora biti u `validation_rules` — pozivatelj ga provjerava (taksonomija se mijenja).
    - Pravilo se ne dodaje rukom bez brojanja: ručna odluka za jednu transu NIJE pravilo (S164).

⚠ `izvor` sužava pravilo na jednu karticu/račun: gorivo na Visi je i Lacetti (8 od ~50), na
  Mastercardu je samo C5 (15/15). Bez toga bi „INA → C5" na Visi griješio svaki šesti put.

MJESEČNI KRUG (S177): `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda` zovu `prijedlog()` kao
ZADNJI ključ — tek kad presedan (i ručni rječnik) šuti. `prijedlog()` sam isključuje posrednika i
par izvan izbornika, pa pozivatelj ne mora ponavljati ta dva uvjeta (jedna kopija, ne tri).
"""
from __future__ import annotations

import re
import unicodedata

# (uzorak — re.search, bez obzira na velika slova, nad KLJUČEM TRGOVCA · izvor | None = svi ·
#  Tip · Podtip · potvrde/ukupno u razvrstanoj povijesti PROD 18.10.)
PRAVILA = [
    # Domaćinstvo / hrana
    (r'^dubravica\b',                           None,         'Domaćinstvo', 'Hrana i ostalo',           '12/13'),
    (r'^lidl\b',                                None,         'Domaćinstvo', 'Hrana i ostalo',           '5/5'),
    (r'\bkaufland\b',                           None,         'Domaćinstvo', 'Hrana i ostalo',           '4/4'),
    (r'\bplodine\b',                            None,         'Domaćinstvo', 'Hrana i ostalo',           '6/6'),
    (r'\bm(ue|u)ller\b',                        None,         'Domaćinstvo', 'Hrana i ostalo',           '15/16'),
    (r'^na-ma\b',                               None,         'Domaćinstvo', 'Hrana i ostalo',           '2/2'),
    (r'^speceraj\b',                            None,         'Domaćinstvo', 'Hrana i ostalo',           '1/1'),
    (r'^the meat\b',                            None,         'Domaćinstvo', 'Hrana i ostalo',           '5/5'),
    # Saša 18.10.: Miele TRGOVINA = potrošni (Hrana i ostalo). NE riječ „Miele" u opisu — servis
    # (Elektro mehanika Kovačić) i dio (OPREMANJE) su Kuća / Popravci.
    (r'^miele\b',                               None,         'Domaćinstvo', 'Hrana i ostalo',           '4/4'),
    # Domaćinstvo / kave, jelo vani — `restoran … zagreb` bez projektnih (Kvatrić, Time)
    (r'\baristos\b',                            None,         'Domaćinstvo', 'Kave/jelo vani',           '8/8'),
    (r'^vincek\b',                              None,         'Domaćinstvo', 'Kave/jelo vani',           '2/2'),
    (r'^boogie lab\b',                          None,         'Domaćinstvo', 'Kave/jelo vani',           '2/2'),
    (r'^restoran (?!kvatric|time\b).*\bzagreb$', None,        'Domaćinstvo', 'Kave/jelo vani',           '4/4'),
    # Putovanja
    (r'\b(coffee|cafe|bar rest).*\bamsterdam$', 'Visa',       'Putovanja',   'Restoran',                 '4/4'),
    (r'(^ns\b|\bgvb\b)',                        'Visa',       'Putovanja',   'Karte, osiguranje',        '3/3'),
    (r'^azm\b',                                 'Visa',       'Putovanja',   'Karte, osiguranje',        '2/2'),
    (r'^edreams\b',                             None,         'Putovanja',   'Karte, osiguranje',        '4/4'),
    # Prijevoz
    (r'^(parkiraliste|javna garaza|garaza|garage)\b', None,   'Prijevoz',    'Taksi, Zet, Parking',      '23/23'),
    (r'^bmove\b',                               None,         'Prijevoz',    'Taksi, Zet, Parking',      '86/88'),
    # Zdravlje — ljekarne samo na Visi (Sašina kartica); 2 od 36 su Kokine
    (r'(\bljekarn|^farmacia\b)',                'Visa',       'Zdravlje',    'Medical_Sasa',             '33/36'),
    (r'\boptika stepinac\b',                    None,         'Zdravlje',    'Medical_Koka',             '3/3'),
    (r'^(x dent|ord\. dent)\b',                 None,         'Zdravlje',    'Medical_Sasa',             '5/5'),
    (r'^(worldclass|playfitness|cf fitness)\b', 'Visa',       'Zdravlje',    'Sport_Sasa',               '2/2'),
    # Auto — samo Mastercard (Kokina kartica = C5); Inter Cars = zimske gume za C5 (Saša)
    (r'^(ina|petrol|lukoil|tifon)\b',           'Mastercard', 'auto C5',     'gorivo',                   '15/15'),
    (r'^inter ?cars?\b',                        'Mastercard', 'auto C5',     'popravci',                 '1/1'),
    # Kuća
    (r'^harvey norman\b',                       None,         'Kuća',        'Popravci, održavanje',     '3/3'),
    (r'^art rasvjeta\b',                        None,         'Kuća',        'Popravci, održavanje',     '3/3'),
    # Saša 18.10.: Međimurje-plin je NENIN opskrbljivač (sva 4 retka „Nena plin/grijanje") ⇒ izbačen;
    # „30/30" je uključivao jedan Nenin račun krivo razvrstan kao Kuća / Plin.
    (r'^(gpz-opskrba|gradska plinara)',         'Racun',      'Kuća',        'Plin',                     '29/29'),
    # Razno / Zabava
    (r'^zara(home)?\b',                         None,         'Razno',       'Odjeća/obuća/ostalo_Koka', '7/7'),
    (r'^google\W*youtube',                      'Mastercard', 'Zabava',      'Youtube',                  '25/25'),
    # Račun
    (r'^zarađena kamata',                       'Racun',      'Prihodi',     'Koka',                     '2/2'),
    (r'^dubravka ?pavic-sladoljev',             'Racun',      'Transfer',    'izmedju racuna',           '3/3'),
]
_RX = [(re.compile(u, re.I), u, iz, t, p, dk) for u, iz, t, p, dk in PRAVILA]

KARTICE = ('Mastercard', 'Visa')
# Posrednik nije trgovac: `Izvod opis` ne govori što je kupljeno (CLAUDE.md S124). Gleda se KLJUČ.
POSREDNIK = re.compile(r'^(keks pay|kupovina|paypal\s*$|paypal\s*\*\s*$)', re.I)
# Uvod naloga s ZABA izvoda: `Kreditni transfer nacionalni u eurima on-line bankarstvom (m-zaba) `
# (S126: `Izvod opis` se skraćuje za uvod, `(m-zaba)` zna ostati) i `UPLATA `.
_UVOD = re.compile(r'^(kreditni transfer[^()]*)?(\((m-zaba|mobilne aplikacije)\)\s*-?\s*|uplata\s+)', re.I)


def _fold(s) -> str:
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower().strip()


def kljuc_trgovca(tekst, izvor) -> str:
    """Ključ nad kojim pravila rade — ISTI kojim su prebrojana (S174).
    Kartica: trgovac kao `razvrstaj_na.kljuc_kartice` (bez adrese iza ` - `, broja transakcije,
    `[kartica: …]`). Račun: primatelj/uplatitelj bez uvoda naloga i bez IBAN-a nadalje."""
    t = str(tekst or '')
    if not t.strip():
        return ''
    if izvor in KARTICE:
        from uvezi_transu import kljuc      # lijeno: uvezi_transu vuče uskladi_izvod
        return kljuc(t.split(' - ')[0])
    t = _fold(_UVOD.sub('', t))
    t = re.sub(r'hr\d{2}[\d\s-]*.*$', '', t)
    return re.sub(r'\s+', ' ', t).strip()[:60]


def po_pravilu(tekst, izvor):
    """→ (tip, podtip, uzorak, potvrde) ili None. Prvo pravilo koje pogodi.
    ⚠ Posrednika pozivatelj isključuje PRIJE (pravila ga ne hvataju, ali ni ne znaju za njega)."""
    k = kljuc_trgovca(tekst, izvor)
    if not k:
        return None
    for rx, u, iz, t, p, dk in _RX:
        if (iz is None or iz == izvor) and rx.search(k):
            return t, p, u, dk
    return None


def prijedlog(tekst, izvor, tax=None):
    """Za mjesečni krug (S177): → dict u obliku `Presedani.nadji` ili None.
    `tax` = `visa_uvoz_izvoda.taksonomija()` ({Tip: [Podtip…]}); par izvan nje se NE predlaže
    nego JAVLJA — taksonomija se mijenja (preuređivanje), a Podtip mimo izbornika uvoz primi
    kao tekst bez greške. `comment` je None: pravilo zna kategoriju, ne i oznaku."""
    k = kljuc_trgovca(tekst, izvor)
    if not k or POSREDNIK.match(k):
        return None
    pr = po_pravilu(tekst, izvor)
    if not pr:
        return None
    t, p, u, dk = pr
    if tax is not None and (t not in tax or p not in tax[t]):
        print(f'   ⚠ pravilo „{u}" daje {t} / {p}, a toga nema u izborniku — ne predlažem '
              f'(popravi `pravila_trgovca.PRAVILA`)')
        return None
    return {'tip': t, 'podtip': p, 'comment': None, 'alternative': [], 'kljuc': 'pravilo',
            'dokaz': f'pravilo „{u}" (povijest {dk})'}
