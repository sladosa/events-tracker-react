# -*- coding: utf-8 -*-
"""
razvrstaj_izvode.py  (S152, 2026-09-26)  --  C1, korak 3: inbox -> izvodi/
=========================================================================
Koka salje izvode u svoju OneDrive mapu `Izvodi`, kod Sase sinkroniziranu u
`C:\\0_Sasa\\OneDrive\\Izvodi`. Imena su generička („Izvod.pdf", „Detalji
transakcije_HR61 ....pdf"), pa se izvod prepoznaje po SADRZAJU:

  1. za svaki PDF u inboxu: klasifikacija (ZABA / MC / PBZVISA / RF) i parsiranje
     -- funkcije iz `inventory_izvoda.py` / `enrich_from_izvoda.py`, NE kopije
  2. ime `TIP_YYYY-MM.pdf` po istom pravilu kao `inventory_izvoda` (period =
     mjesec s najvise transakcija; RF = mjesec prve)
  3. KOPIJA u `izvodi/` (korijen = „stiglo, ceka obradu"); `Analizirani_izvodi/`
     je mapa koju alati citaju kao obradjeno (CLAUDE.md S129), pa ide tek NAKON
     uvoza (korak 6)

/!\\ IZ INBOXA SE NISTA NE BRISE NI PREMJESTA. Mapa je Kokina (dijeljena „Can
    edit"): premjestanje bi brisalo iz NJENOG OneDrivea. Zato kopija +
    prepoznavanje vec vidjenog po md5 -- isti file pri iducem pokretanju javlja
    se kao „vec imamo".
/!\\ ALI SE PREIMENUJE (S158, Sasina odluka) -- uz `--apply`, u isto ime koje
    nosi kod nas (`MC_2026-09.pdf`). MC stize kao `Obavijest o učinjenim
    troškovima.pdf` SVAKI MJESEC, pa bi sljedeci izvod dobio `(1)` ili prepisao
    prethodni, a covjek u mapi ne vidi sto je sto. Preimenovanje nista ne
    brise; prepoznavanje ostaje po md5, pa ime ne utjece na „vec imamo".
    Postoji li u inboxu vec file tog imena, NE prepisuje se -- samo se javi.
/!\\ NIKAD NE PREPISUJE. Postoji li vec `TIP_YYYY-MM.pdf` s drugim sadrzajem
    (isti izvod skinut dvaput daje druge bajtove, ali i ispravljen izvod),
    file ostaje u inboxu i javlja se -- odluka je ljudska.
/!\\ Ne-izvod (PBZ „Detalji transakcije", potvrda placanja...) ostaje u inboxu
    uz razlog. Klasifikator ga vec odbija (`UNKNOWN`), izmjereno S152.

Pokretanje:
  Financije\\run.bat razvrstaj_izvode.py            -> samo ispis (dry run)
  Financije\\run.bat razvrstaj_izvode.py --apply    -> kopira u izvodi/ + preimenuje u inboxu
  Financije\\run.bat razvrstaj_izvode.py --inbox <mapa>
"""

import hashlib
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))

from enrich_from_izvoda import IZVODI_DIR, SOURCE_TYPES
from inventory_izvoda import RE_GOOD_NAME, classify, coverage_period

INBOX = Path(r'C:\0_Sasa\OneDrive\Izvodi')

REASON = {
    'NOTEXT': 'bez tekst-sloja i OCR ga ne prepoznaje',
    'UNKNOWN': 'nije izvod koji znamo (ZABA / MC / PBZ Visa / RF)',
    'ERROR': 'PDF se ne da otvoriti',
}


def md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def known_files() -> dict[str, Path]:
    """md5 -> file za sve PDF-ove koje vec imamo (ukljucivo arhivu i duplikate)."""
    return {md5(p): p for p in IZVODI_DIR.rglob('*.pdf')}


def existing_by_name(name: str) -> Path | None:
    for p in IZVODI_DIR.rglob(name):
        if 'duplikati' not in p.parts:
            return p
    return None


def tx_signature(txs: list[dict]) -> tuple:
    # Isti potpis kao `inventory_izvoda` (datum, smjer, iznos, opis).
    return tuple(sorted((str(t['date']), t['smjer'], t['iznos'], t['opis']) for t in txs))


def same_transactions(parser, other: Path, txs: list[dict]) -> bool:
    try:
        return tx_signature(parser(other)) == tx_signature(txs)
    except Exception:  # noqa: BLE001 — ne znamo => nije isto, covjek odlucuje
        return False


def ime_za_inbox(nasa: Path) -> str | None:
    """Ime koje file u inboxu treba nositi: ono pod kojim je kod nas -- ali samo
    pravo ime izvoda. Kopija iz `duplikati/` (`Jedinstveni izvadak (16).pdf`,
    `RF_2026-06b.pdf`) nije ime koje bi covjeku ista reklo."""
    if 'duplikati' in nasa.relative_to(IZVODI_DIR).parts or not RE_GOOD_NAME.match(nasa.name):
        return None
    return nasa.name


def plan_one(p: Path, known: dict[str, Path]) -> dict:
    h = md5(p)
    if h in known:
        return dict(src=p, action='vec imamo', detail=str(known[h].relative_to(IZVODI_DIR)),
                    inbox_name=ime_za_inbox(known[h]))

    tip = classify(p)
    if tip in REASON:
        return dict(src=p, action='OSTAJE', detail=REASON[tip])

    parser = SOURCE_TYPES[tip][0]
    try:
        txs = parser(p)
    except Exception as e:  # noqa: BLE001 — poruka ide covjeku
        return dict(src=p, action='OSTAJE', detail=f'{tip}: parsiranje palo ({e})')
    if not txs:
        return dict(src=p, action='OSTAJE', detail=f'{tip}: 0 transakcija -- provjeri rucno')

    period = coverage_period(txs, tip)
    name = f'{tip}_{period}.pdf'
    clash = existing_by_name(name)
    if clash is not None and same_transactions(parser, clash, txs):
        # Isti izvod skinut dvaput (drugi bajtovi) -- nije posao za covjeka.
        return dict(src=p, action='vec imamo',
                    detail=f'{clash.relative_to(IZVODI_DIR)} (drugi bajtovi, iste transakcije)',
                    inbox_name=ime_za_inbox(clash))
    if clash is not None:
        return dict(src=p, action='OSTAJE', tip=tip, period=period, ntx=len(txs),
                    detail=f'vec postoji {clash.relative_to(IZVODI_DIR)} s DRUGIM '
                           f'sadrzajem -- usporedi rucno, nista nije prepisano')
    return dict(src=p, action='KOPIRAJ', tip=tip, period=period, ntx=len(txs),
                target=IZVODI_DIR / name, inbox_name=name,
                detail=f'{tip} {period}, {len(txs)} transakcija -> izvodi/{name}')


def plan_rename(pl: dict, inbox: Path, zauzeta: set[str]) -> tuple[str, str] | None:
    """(akcija, opis) za preimenovanje u inboxu, ili None kad nema posla.
    /!\\ Nikad ne prepisuje: zauzeto ime u inboxu (ili dva filea za isto ime)
        ostaje covjeku."""
    novo = pl.get('inbox_name')
    if pl['action'] == 'OSTAJE' or not novo or pl['src'].name == novo:
        return None
    if novo in zauzeta or (inbox / novo).exists():
        return ('ime zauzeto', f'u inboxu vec postoji {novo} -- ostaje kako je')
    zauzeta.add(novo)
    return ('PREIMENUJ', f'u inboxu -> {novo}')


def main() -> None:
    args = sys.argv[1:]
    apply = '--apply' in args
    inbox = INBOX
    if '--inbox' in args:
        i = args.index('--inbox')
        if i + 1 >= len(args):
            sys.exit('✗ --inbox trazi putanju mape')
        inbox = Path(args[i + 1])
    if not inbox.is_dir():
        sys.exit(f'✗ Inbox ne postoji: {inbox}\n  (OneDrive prijavljen? precac `Izvodi` dodan?)')

    pdfs = sorted(p for p in inbox.iterdir() if p.is_file() and p.suffix.lower() == '.pdf')
    print(f'Inbox : {inbox}')
    print(f'Cilj  : {IZVODI_DIR}  {"[APPLY]" if apply else "[DRY RUN -- nista se ne kopira]"}')
    print()
    if not pdfs:
        print('Inbox je prazan.')
        return

    known = known_files()
    plans, taken = [], set()
    for p in pdfs:
        pl = plan_one(p, known)
        # Dva nova filea u istom pokretanju koja bi dobila isto ime.
        if pl['action'] == 'KOPIRAJ':
            if pl['target'].name in taken:
                pl['action'] = 'OSTAJE'
                pl['detail'] = f'drugi file iz inboxa vec ide u {pl["target"].name} -- usporedi rucno'
            taken.add(pl['target'].name)
        plans.append(pl)

    zauzeta: set[str] = set()
    renames = []
    for pl in plans:
        print(f'  {pl["action"]:<9} {pl["src"].name}')
        print(f'            {pl["detail"]}')
        rn = plan_rename(pl, inbox, zauzeta)
        if rn:
            print(f'            {rn[0]}: {rn[1]}')
            if rn[0] == 'PREIMENUJ':
                renames.append(pl)

    copies = [pl for pl in plans if pl['action'] == 'KOPIRAJ']
    stays = [pl for pl in plans if pl['action'] == 'OSTAJE']
    seen = [pl for pl in plans if pl['action'] == 'vec imamo']
    print()
    print(f'Novih izvoda: {len(copies)}  |  ostaje u inboxu: {len(stays)}  |  vec imamo: {len(seen)}'
          f'  |  preimenovati u inboxu: {len(renames)}')

    if not copies and not renames:
        return
    if not apply:
        print('\nDry run -- ponovi s --apply da se kopiraju i preimenuju.')
        return
    for pl in copies:
        shutil.copy2(pl['src'], pl['target'])
        if md5(pl['target']) != md5(pl['src']):
            sys.exit(f'✗ Kopija {pl["target"].name} se ne poklapa s izvorom -- stani i provjeri.')
    # Preimenovanje tek POSLIJE uspjesnih kopija: pad kopije ostavlja inbox netaknut.
    for pl in renames:
        cilj = inbox / pl['inbox_name']
        if cilj.exists():   # u medjuvremenu se pojavio -- ne prepisujemo
            print(f'  ! {cilj.name} se pojavio u medjuvremenu -- {pl["src"].name} ostaje')
            continue
        pl['src'].rename(cilj)
    print(f'\n✔ Kopirano {len(copies)} u {IZVODI_DIR}; u inboxu preimenovano {len(renames)} '
          f'(nista obrisano).')


if __name__ == '__main__':
    main()
