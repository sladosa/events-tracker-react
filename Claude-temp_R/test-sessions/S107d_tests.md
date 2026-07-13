# S107d testovi — inventory_izvoda + MC/PBZ parseri + enrich Excel mode (2026-07-13)

Python data-prep alati, NEMA app koda. Pokretanje: `data-prep_tools\Financije\run.bat <skripta>`
(review file zatvoren u Excelu!).

**Napomena o stanju:** inventory je VEĆ pokrenut (pravi run) 2026-07-13 — izvodi su
premješteni/preimenovani i `Izvodi_transakcije.xlsx` postoji. Enrich je testiran samo `--dry`
na kopiji (Review je bio otvoren u Excelu); **pravi enrich run je prvi korak sljedeći put**.
D1 header ('Smjer') u Review fileu je bio pregažen tekstom (`run.bat sync_taxonomy.py`) —
popravlja se automatski/skriptom prije enricha (backup `*.pre-fixd1-*` postoji).

---

## T-S107d-1 — inventory_izvoda.py idempotentnost

**Preduvjet:** inventory već pokrenut (stanje: `Analizirani_izvodi/` 89 pdf, `duplikati/` 6 pdf).

1. `run.bat inventory_izvoda.py --dry`
2. **Očekivano:** isti brojevi kao prvi run (MC 29/1062, PBZVISA 31/1539, ZABA 29/581);
   NIJEDAN file se ne planira premjestiti (nema "premješten ←" statusa za Analizirane);
   rupe: MC 2026-05, ZABA 2024-07/08.
3. **Fail:** file iz `Analizirani_izvodi/` proglasi duplikatom ili ga preimenuje.

## T-S107d-2 — Izvodi_transakcije.xlsx sadržaj

1. Otvori `data-prep_data/Financije/izvodi/Izvodi_transakcije.xlsx`.
2. **Transakcije sheet:** 3182 reda; kolone Datum|Opis|Iznos|Smjer|Kartica|Racun|Izvor|Tip|File|Src;
   filtriraj Tip=MC, File=MC_2024-02.pdf → 23 reda, suma Iznos = 1.642,83 (UKUPNO s PDF-a).
3. **Manifest sheet:** 117 redova; duplikati imaju Tip=DUP; RF/2025-N/2026-N status
   "bez tekst-sloja"; Original kolona čuva izvorna (generička) imena.
4. **Kartica kolona:** Sašine transakcije na Kokinim karticama označene
   (Kartica = SAŠA SLADOLJEV; opis ima sufiks `[kartica: SAŠA]`).

## T-S107d-3 — pravi enrich run (PRVI KORAK SLJEDEĆI PUT)

**Preduvjet:** Review file ZATVOREN u Excelu.

1. `run.bat enrich_from_izvoda.py --dry`
   → očekivano: "Izvor transakcija: Izvodi_transakcije.xlsx (3182)"; Matchano ≈ 1429/3182.
   (Ako skripta padne s `Kolona "Smjer" nije nađena` → D1 header još nije popravljen;
   javi Claudeu ili ručno u Excelu vrati D1 na `Smjer`.)
2. `run.bat enrich_from_izvoda.py` (bez --dry)
3. **Očekivano:** backup `*.pre-izvod-*`; Review dobiva `Izvod opis`/`Izvod file` kolone
   (~1429 redova, od toga ~938 s Tip=N/A); `Nematchano` sheet u Izvodi_transakcije.xlsx
   (~1753 reda, većinom PBZVISA).
4. **Fail:** bilo koja postojeća kolona Review sheeta promijenjena (Tip/Podtip/Napomena...).

## T-S107d-4 — apply_rules nad Izvod opis (lanac)

1. Nakon T-S107d-3: u `Pravila` sheet dodaj npr. `konzum` → Tip/Podtip po Taksonomiji.
2. `run.bat apply_rules.py --dry` → pogodci uključuju redove kojima je merchant SAMO
   u `Izvod opis` (Napomena prazna).
3. **Fail:** pravilo pogađa redove s ručno unesenim Tipom.

## T-S107d-5 — Nematchano = PBZ Visa nalaz (za odluku, ne bug)

1. U Nematchano sheetu filtriraj Src po `PBZVISA` → ~1538 transakcija.
2. Spot-check 3 nasumične protiv PDF-a u `Analizirani_izvodi/`.
3. **Svrha:** podloga za odluku Saša/Koka — importati PBZ Visa kupovine kao nove retke,
   ili ignorirati (v. ENRICH_PLAN.md §3.2).
