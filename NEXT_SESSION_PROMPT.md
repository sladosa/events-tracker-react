> Pisano protiv commita **S169 ritual** na `test-branch` (zadnji commit = „S169: …").
> **`main` = `119653c` (deploy 12.10., S168)** — S169 je samo alati + docs, **app kod nije mijenjan**,
> deploy ne treba. **PROD baza (S169, 12.10.):** 72 ZABA N/A razvrstana, Pharmalog i Triglav u
> prihodima, Investicije izvan razreza (`set_breakdown.py` upisan).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S169 (2026-10-12)

> **Ukratko (S169):** S Kokom smo razvrstali svih 72 neodređenih transakcija na njezinom računu iz zadnjih godinu dana i potvrdili da su Pharmalog uplate njezin prihod, a Investicije i isplata Triglav police su maknute iz troškova — pločica „Kamo ide novac" kroz cijelu povijest više nema ni „nesvrstano" ni stavki u minusu.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno (sve na PROD-u)

- Kokin ZABA: svih 72 N/A iz zadnjih 12 mj razvrstano, uz 24 njezina opisa.
- Pharmalog (10 uplata, 22.493,19 €) → `Prihodi / Koka`; Triglav 7.782,55 → `Prihodi / Saša`.
- Investicije (9.543,16) su izvan razreza, kao Transfer.
- Pločica All Time: Ušlo 189.787,17 · Izašlo 178.592,28 · nema „nesvrstano".

## Što treba od tebe

1. **RF N/A** (T-S169-6): prođi `na_razvrstavanje_sasin_tekuci_rf_20261012_1102.xlsx`
   (promijenjena ćelija postane svijetloplava), pa `--preuzmi` na PROD i uvoz **novog** filea
   (koraci u `docs/sessions/tests/S169_tests.md`).
2. **Morra ceramics 58,50 (17.11.2025.)** — Koka je obrisala broj rata; ako nije obročna kupnja,
   u appu `Rate? = No`.
3. **T-S169-5** — drill na pločici (All Time): Medical_Koka ≈ 1.151, Zivotno pozitivan.
4. Iz S168 i dalje: T-S168-2/3/4 (Structure `Remainder`, prvi Kokin MC plan, Kokin mobitel);
   **~03.11.** Visa izvod, **11.11.** MC traka (D7).

## Što ostaje od klasifikacije (nije hitno)

`nerazvrstano (N/A)` **29.056,73** na All Time = starija povijest (ZABA 769, RF 672 redaka).
2023. je većinom bez teksta izvoda ⇒ ostaje N/A. **2025. siječanj–rujan (ZABA 149)** se isplati
istim postupkom (`--od 2025-01-01 --do 2025-09-30`) — sada s 72 Kokine odluke više kao presedanima.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` ispred `main` samo za docs/alate (S167, S169) — nema app koda.
- Novi alat `ispravi_tip.py`; `razvrstaj_na.py --preuzmi` nosi i komentar; `visa_popravak.pisi`
  dodaje svijetloplavi CF na Tip/Podtip; `set_breakdown.py` outside + provjera cijele povijesti.
  TEST: `set_breakdown.py` upisan (isto kao PROD). TEST **nema** S169 Tip/Podtip izmjena (išle su
  samo na PROD) — za testove nad Financijama prvo `prod_to_test.py`.
- ⚠ Klasifikator blokira i **dry run** PROD alata — PROD naredbe idu Saši (`cd …\data-prep_tools`, `.\`).
- ⚠ Python skripte u scratchpad, s `python -I` (u `$TEMP` leži `struct.py` koji ruši openpyxl).

## Otvoreno — kod (po prioritetu iz plana S167)

1. **Lazy Plotly** (4,9 MB, Kokin spori mobitel; na uskom ekranu kruga ni nema) — izmjeriti
   prije/poslije. ⚠ `clearChainCache` ovisi o tome da rute nisu lazy (CLAUDE.md § UI, S133).
2. **Filtar predug na malom ekranu** — prvo razgovor o obliku (sam se sklopi / sažetak u redu).
3. **Filtar `depends_on` atributa kao izbornik** grupiran po roditelju (Backlog S167).
4. **T21** guard „potvrđeno razdoblje" za kartične retke; **F5** (`groupings` kroz Structure
   Excel); Visa u traku (T2, prije ~05.11.); alati T4, T13–T18.
