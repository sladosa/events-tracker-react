# -*- coding: utf-8 -*-
"""
make_saldo_anchors.py  (S110, 2026-08-17)
================================================================================
ISPISANA BANKOVNA STANJA SA ZABA IZVODA → provjera app-ovog lanca → `balance_anchors`.

Spec: docs/OVERVIEW_TAB_SPEC.md §2.17 (sidro) · NEXT_SESSION_PROMPT.md korak 2
      SALDO_MODEL_NALAZI.md (17/30 mjeseci u cent — ovaj alat izolira ostalih 13)

--------------------------------------------------------------------------------
JEDNO PRAVILO KOJE DEFINIRA ISPRAVNOST OVOG ALATA

  Upisuje se ISPISANI `NOVO STANJE` s izvoda. Nikad zbroj eventa iz baze.

Prekršaj se NE VIDI: Δ postane trajno nula, pločica izgleda savršeno, a mehanizam
usklađenja je mrtav bez ijedne greške. Isti razred kao odbačeni automat
`Planiran → Izvršen` po dospijeću. Zato ovaj alat čita PDF, a jedini put do baze
je `--anchor` / `--load-all`; `--report` NIŠTA ne piše.

--------------------------------------------------------------------------------
TRI ZAMKE, SVE TRI IZMJERENE A NE PRETPOSTAVLJENE

1. ⚠ IZVOD SE NE ZATVARA NA KRAJU MJESECA. `ZABA_2024-12` ima zadnju tekuću
   transakciju **2025-01-01**, a `ZABA_2025-12` **2025-12-24**. `NOVO STANJE`
   pripada TOM datumu. Sidro datirano na „31.12.2024." s vrijednošću izvoda za
   prosinac bilo bi krivo: pravilo je „promjene STROGO nakon", pa bi transakcije
   1.1.2025. ušle dvaput (jednom u ispisano stanje, jednom kao promjena poslije).
   Zato `confirmed_on` = *close date izvoda*, nikad kalendarski kraj mjeseca.
   (Plan iz NEXT_SESSION_PROMPT je govorio „31.12.2024." — to je ovime ispravljeno.)

2. ⚠ MJESEČNA SIDRA UBIJAJU PROVJERU NA SVOJIM DATUMIMA. `036` bira najnovije
   sidro `confirmed_on <= p_as_of` i zbraja promjene strogo nakon njega ⇒ sidro
   NA datum usporedbe daje `balance == amount`, pa Δ = 0 po konstrukciji.
   `--report` zato provjerava postoji li međusidro i takav redak označi
   `SIDRO (nije provjera)` umjesto lažne kvačice. **Prvo provjera, sidra poslije.**

3. ⚠ ZABA I RF NISU ISTE KVALITETE. ZABA lanac je verificiran (T-S107j-A:
   Σupl/Σisp = bankov „Zbroj prometa" 40/40 u cent). RF je išao kroz OCR i
   T-S107d-6 je OTVOREN. Ovaj alat pokriva SAMO ZABA i to kaže naglas — RF se
   ne uvodi „za konzistentnost" dok mu izvori nisu spot-checkani.

--------------------------------------------------------------------------------
Pokretanje (⚠ run.bat guši zarez — jedan argument po pozivu):

    Financije\\run.bat make_saldo_anchors.py                    → ispisana stanja + lanac
    Financije\\run.bat make_saldo_anchors.py --report           → app vs banka po izvodu
    Financije\\run.bat make_saldo_anchors.py --anchor 2025-01-01
    Financije\\run.bat make_saldo_anchors.py --load-all         → sva sidra (nakon reporta!)

Ključevi iz `.env.local` (TEST): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
Servisni ključ zaobilazi RLS ⇒ alat se pokreće lokalno, nikad iz preglednika.
"""
from __future__ import annotations

import sys
from datetime import date, datetime
from pathlib import Path

from enrich_from_izvoda import _parse_zaba_all, _zaba_is_tekuci
from verify_rpc_vs_model import (AREA_ID, ENV_FILE, FILTERS_IZVRSENO, Supa, target_banner,
                                 eur, load_env)

sys.stdout.reconfigure(encoding='utf-8')

IZVODI = Path(r"C:\0_Sasa\events-tracker-react\data-prep_data\Financije"
              r"\izvodi\Analizirani_izvodi")

# Vrijednost `racun` atributa u bazi — grupa po kojoj pločica zbraja.
GROUP_SLUG = 'racun'
GROUP_VALUE = 'Kokin tekući ZABA'

EPS = 0.005
SEP = '─' * 86


# ------------------------------------------------------------ ispisana stanja --
def printed_series() -> list[dict]:
    """Ispisani bankovni brojevi Tekućeg računa, po izvodu, kronološki.

    `close` = datum zadnje tekuće transakcije izvoda = datum kojem `novo`
    pripada (zamka 1). `pocetno`/`novo` su bankovni brojevi, ne naši."""
    out = []
    for f in sorted(IZVODI.glob('ZABA_*.pdf')):
        txs, balances = _parse_zaba_all(f)
        tek = [t for t in txs if _zaba_is_tekuci(t['account'])]
        tb = [b for b in balances
              if _zaba_is_tekuci(b['account']) and b['novo'] is not None]
        if not (tek and tb):
            print(f'  ⚠ {f.stem}: nema tekućih transakcija ili nema NOVO STANJE — preskočeno')
            continue
        out.append({'ym': f.stem.split('_')[1], 'file': f.name,
                    'close': max(t['date'] for t in tek),
                    'pocetno': tb[-1]['pocetno'], 'novo': tb[-1]['novo']})
    out.sort(key=lambda r: r['close'])
    return out


def check_chain(series: list[dict]) -> int:
    """`novo` jednog izvoda mora biti `pocetno` sljedećeg. Neprekinut lanac je
    dokaz da nijedan izvod ne fali — a to je jedina stvar koja se ovdje NE može
    provjeriti brojanjem transakcija (izvod koji fali izgleda kao mjesec bez
    prometa). Vraća broj prekida."""
    breaks = 0
    for a, b in zip(series, series[1:]):
        if abs(a['novo'] - b['pocetno']) >= EPS:
            breaks += 1
            print(f"  ⚠ PREKID LANCA: {a['file']} NOVO {a['novo']:.2f} "
                  f"≠ {b['file']} POČETNO {b['pocetno']:.2f} "
                  f"(fali izvod između?)")
    return breaks


# ------------------------------------------------------------------- baza --
def db_anchors(sp: Supa) -> list[dict]:
    rows = sp.select_all(
        f'balance_anchors?area_id=eq.{AREA_ID}&group_slug=eq.{GROUP_SLUG}'
        f'&select=id,group_value,amount,confirmed_on,note&order=id')
    return [r for r in rows if r['group_value'] == GROUP_VALUE]


def app_balance(sp: Supa, as_of: date) -> tuple[float, int] | None:
    """Saldo koji pločica pokazuje za `as_of` — isti RPC, isti filtri."""
    res = sp.rpc('rpc_area_balance_anchored', {
        'p_area_id': AREA_ID, 'p_group_slug': GROUP_SLUG,
        'p_plus_slug': 'uplata', 'p_minus_slug': 'isplata',
        'p_filters': FILTERS_IZVRSENO, 'p_as_of': as_of.isoformat(),
    })
    for r in res or []:
        if r['group_value'] == GROUP_VALUE:
            return float(r['balance']), int(r['n'])
    return None


def area_owner(sp: Supa) -> str:
    rows = sp.select_all(f'areas?id=eq.{AREA_ID}&select=user_id&order=id')
    if not rows:
        sys.exit(f'✗ Area {AREA_ID} nije nađena.')
    return rows[0]['user_id']


# ---------------------------------------------------------------- naredbe --
def cmd_saldi(series: list[dict]) -> None:
    print(f'\nISPISANA BANKOVNA STANJA — {GROUP_VALUE} ({len(series)} izvoda)   {target_banner()}')
    print(SEP)
    print(f"{'izvod':<9} {'close':<12} {'POČETNO':>12} {'NOVO':>12} {'promet':>12}")
    print(SEP)
    for r in series:
        print(f"{r['ym']:<9} {r['close'].isoformat():<12} "
              f"{eur(r['pocetno']):>12} {eur(r['novo']):>12} "
              f"{eur(r['novo'] - r['pocetno']):>12}")
    print(SEP)
    breaks = check_chain(series)
    print(f"Lanac: {'✓ neprekinut' if breaks == 0 else f'✗ {breaks} prekid(a)'}"
          f"  ·  raspon {series[0]['close']} → {series[-1]['close']}")
    print('\nRF nije pokriven: njegovi izvodi su išli kroz OCR, T-S107d-6 je otvoren (zamka 3).')


def cmd_report(sp: Supa, series: list[dict]) -> None:
    """Za svaki izvod: što app pokaže na close date vs što banka ispisuje.

    Dvije kolone, dvije različite tvrdnje:
      Δ      — apsolutna razlika. Nosi SVU nakupljenu povijest, uključujući ono
               što u bazi ne postoji (pre-2025). Bez sidra je velika i to nije pad.
      Δpromet — razlika MJESEČNOG prometa (app vs banka). Ne ovisi o nakupljenom
               pomaku ⇒ ovo je kolona koja kaže KOJI MJESEC ne štima."""
    anchors = db_anchors(sp)
    print(f'\nAPP vs BANKA — {GROUP_VALUE}   {target_banner()}')
    print(f'sidara u bazi: {len(anchors)}'
          + (''.join(f"\n  · {a['confirmed_on']} = {eur(float(a['amount']))}" for a in anchors)
             if anchors else ' (saldo se računa od početka podataka)'))
    print(SEP)
    print(f"{'izvod':<9} {'close':<12} {'app':>12} {'banka':>12} {'Δ':>11} "
          f"{'Δpromet':>10} {'n':>5}  status")
    print(SEP)

    anchor_dates = sorted(datetime.fromisoformat(a['confirmed_on']).date() for a in anchors)
    prev_app = prev_close = None
    ok = off = skipped = 0

    for r in series:
        got = app_balance(sp, r['close'])
        if got is None:
            print(f"{r['ym']:<9} {r['close'].isoformat():<12} "
                  f"{'—':>12} {eur(r['novo']):>12} {'':>11} {'':>10} {'':>5}  "
                  f"nema zapisa u bazi")
            prev_app, prev_close = None, r['close']
            skipped += 1
            continue

        app, n = got
        delta = app - r['novo']

        # zamka 2: sidro NA ovaj datum (ili između) čini usporedbu tautološkom
        tautology = any(d == r['close'] for d in anchor_dates)

        if prev_app is not None and prev_close is not None:
            mid_anchor = any(prev_close < d <= r['close'] for d in anchor_dates)
            dp = (app - prev_app) - (r['novo'] - r['pocetno'])
            dp_txt = '—' if mid_anchor else eur(dp)
        else:
            dp, dp_txt = None, '—'

        if tautology:
            status = 'SIDRO (nije provjera)'
        elif abs(delta) < EPS:
            status = '✓ u cent'
            ok += 1
        elif dp is not None and abs(dp) < EPS:
            status = 'promet OK (nosi stari pomak)'
        else:
            status = 'promet se razilazi'
            off += 1

        print(f"{r['ym']:<9} {r['close'].isoformat():<12} {eur(app):>12} "
              f"{eur(r['novo']):>12} {eur(delta):>11} {dp_txt:>10} {n:>5}  {status}")
        prev_app, prev_close = app, r['close']

    print(SEP)
    print(f'✓ u cent: {ok}   ·   promet se razilazi: {off}   ·   bez zapisa: {skipped}')
    print('\nČitanje: Δpromet je instrument. Δ bez sidra nosi povijest koje u bazi nema')
    print('(uvezeno je 2025+2026), pa je velik i to NIJE pad. Mjesec s Δpromet ≠ 0 je')
    print('mjesec koji treba otvoriti — pa kolona `Stanje` u Activities listi kaže na kojem retku.')


def cmd_write(sp: Supa, series: list[dict], only: date | None) -> None:
    targets = [r for r in series if only is None or r['close'] == only]
    if only is not None and not targets:
        print(f'✗ Nijedan izvod se ne zatvara na {only}. Dostupni close datumi:')
        for r in series:
            print(f"    {r['close']}  ({r['file']}, NOVO {eur(r['novo'])})")
        sys.exit(1)

    existing = {datetime.fromisoformat(a['confirmed_on']).date() for a in db_anchors(sp)}
    owner = area_owner(sp)
    wrote = skipped = 0

    for r in targets:
        if r['close'] in existing:
            print(f"  · {r['close']} već ima sidro — preskočeno "
                  f"(tablica je append-only, duplikat bi samo zamutio povijest)")
            skipped += 1
            continue
        sp._call('balance_anchors', method='POST', body={
            'area_id': AREA_ID, 'group_slug': GROUP_SLUG, 'group_value': GROUP_VALUE,
            'amount': r['novo'], 'confirmed_on': r['close'].isoformat(),
            # Isti oblik koji piše i pločica (`BalanceByGroupTile`):
            # `<kategorija> · <detalj>`, kategorija iz zatvorenog popisa.
            # Bilješka se čita i uspoređuje, pa mora biti ista bez obzira tko ju piše.
            'note': f"ispisano stanje s izvoda · {r['file']}",
            'created_by': owner,
        })
        print(f"  ✓ {r['close']} = {eur(r['novo'])}   ← {r['file']}")
        wrote += 1

    print(f'\nUpisano: {wrote}   ·   preskočeno: {skipped}')
    if wrote:
        print('⚠ Sidra NA ovim datumima od sada čine `--report` tautološkim na njima (zamka 2).')


# ------------------------------------------------------------------- main --
def main() -> None:
    args = sys.argv[1:]
    series = printed_series()
    if not series:
        sys.exit('✗ Nijedan ZABA izvod nije pročitan — provjeri putanju do Analizirani_izvodi.')

    if '--report' in args:
        cmd_report(Supa(load_env(ENV_FILE)), series)
    elif '--load-all' in args:
        if check_chain(series):
            sys.exit('✗ Lanac izvoda je prekinut — ne upisujem sidra dok se to ne razriješi.')
        cmd_write(Supa(load_env(ENV_FILE)), series, None)
    elif '--anchor' in args:
        i = args.index('--anchor')
        if i + 1 >= len(args):
            sys.exit('✗ --anchor traži datum: --anchor 2025-01-01')
        cmd_write(Supa(load_env(ENV_FILE)), series,
                  datetime.fromisoformat(args[i + 1]).date())
    else:
        cmd_saldi(series)


if __name__ == '__main__':
    main()
