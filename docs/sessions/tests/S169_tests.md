# S169 — testovi (2026-10-12)

Klasifikacija s Kokom: N/A ZABA, Pharmalog (T34), Investicije (T33), Triglav (T35).
Pregled: [PENDING_TESTS.md](../PENDING_TESTS.md#s169--klasifikacija-s-kokom-na-zaba-pharmalog-investicije-triglav-2026-10-12)

## T-S169-1 ✅ Kokin ZABA N/A → PROD

Iskorišteni fileovi S169 su u `data-prep_data\Financije\_arhiva\izlazi\` (Kokine odluke = `…_kokin_tekuci_zaba_20261012_0939.xlsx`).

Izmjereno 12.10.: razvrstan TEST file `na_razvrstavanje_kokin_tekuci_zaba_20261012_0939.xlsx`
(72/72, 24 Kokina opisa) ⇒ `razvrstaj_na.py --file --preuzmi` s `ET_TARGET=prod` ⇒
`…_20261012_1102.xlsx` (kol. G = Koka 72/72; Tip/Podtip/komentar = TEST file 72/72; razlika samo
Morra `Broj rata`/`Rata br`, koji se ne prenose) ⇒ uvoz pod Kokinim računom: **0 created · 72
updated**, ZABA **11.290,73** nepomaknut.
⚠ Usput: prvi pokušaj uvoza je odabrao **TEST file** (0939). Modal je javio „Foreign events: 72 ·
sasasladoljev59" — to je znak da file nije PROD-ov. Zaustavljeno prije Applyja.

## T-S169-2 ✅ Pharmalog → Prihodi / Koka

`ispravi_tip.py --tip Prihodi --podtip Koka --komentar Pharmalog --id <10 id-eva>` (PROD, Saša) ⇒
`ispravak_tip_Prihodi_Koka_20261012_1117.xlsx` (kol. G = Koka 10/10) ⇒ uvoz: **0 · 10 updated**.
Pločica All Time, Prihodi: Koka **99.584,69**.

## T-S169-3 ✅ Investicije izvan razreza

`set_breakdown.py` dry run (PROD): `✓ nesvrstano u cijeloj povijesti: ništa`, `pločica: MIJENJA SE`,
`grupiranje: ISTO` ⇒ `--apply --yes-prod`. Pločica All Time: Izašlo **180.352,89 → 170.809,73**
(−9.543,16), `nesvrstano` nestao, podnožje „izvan razreza (Transfer, Investicije): ušlo 107.471,72
· izašlo 189.878,04" (+256,84 / +9.800,00 = Dionice/Kripto + Štednja).

## T-S169-4 ✅ Triglav → Prihodi / Saša

`ispravi_tip.py --tip Prihodi --podtip Saša --id 445f5f86-…` ⇒ `…_Prihodi_Sa_a_20261012_1132.xlsx`
⇒ uvoz **0 · 1 updated**. Povremeno nužno **14.455,19 → 22.237,74**, Izašlo **178.592,28**,
Ušlo **189.787,17**, Razlika **11.194,89** nepomaknuta.

## T-S169-5 ✅ (12.10.: Medical_Koka 1.168,23, Zivotno 2.090,59) Drill do Podtipa (PROD, All Time)

Preduvjet: `npm run dev:prod` ili PROD app, Financije_all, filtar All Time, Overview.

1. „Kamo ide novac" → Troškovi → **Povremeno nužno** → **Zdravlje**.
   **Očekivano:** `Medical_Koka` ≈ **1.151** (trošak, pozitivan), nema minusa.
2. Isto → **Osiguranje** → `Zivotno` pozitivan (premije), oko **2.090**.
3. **Pad:** ijedna stavka u minusu ⇒ javi Claudeu (ostao krivo razvrstan redak).

## T-S169-6 ⬜ RF N/A → PROD (Saša)

1. Otvori `data-prep_data\Financije\na_razvrstavanje_sasin_tekuci_rf_20261012_1102.xlsx` (PROD file,
   49 redaka, 6 žutih prijedloga). Razvrstaj; promijenjena ćelija postane **svijetloplava**.
   Opis po želji u `leaf comment` (prenosi se od S169).
2. ```powershell
   cd C:\0_Sasa\events-tracker-react\data-prep_tools
   $env:ET_TARGET = 'prod'
   .\Financije\run.bat razvrstaj_na.py --od 2025-10-01 --do 2026-09-30 --file --preuzmi "..\data-prep_data\Financije\na_razvrstavanje_sasin_tekuci_rf_20261012_1102.xlsx"
   ```
   **Očekivano:** `[PROD]`, `primijenjeno na N · izmijenjen komentar: K`, nijedan `✗`.
3. Uvezi **novi** `…_sasin_tekuci_rf_<vrijeme>.xlsx` (ne 1102!) pod Kokinim računom:
   **0 New · N Modify · 0 Delete**, bez „Foreign events"; RF saldo nepomaknut.
   ZABA file iz istog prolaza **ne uvoziti** (nema novih odluka).
