# S164 — detaljni testovi (2026-10-07)

> Sesija: **Kamo ide novac — odluke i skica** (`docs/RAZREZ_SPEC.md`). TEST ponovo = PROD
> (`prod_to_test.py`), skica pločice nad stvarnim podacima, sve odluke R1–R15 donesene.
> Jedini upis u bazu: **R3 — osiguranje kuće u vlastiti Podtip** (`fix_kuca_osiguranje_S164.py`),
> izveden na TEST-u. Novi alat **`razvrstaj_na.py`** (prijedlog Tip/Podtip za N/A, app Excel). **Nema promjene u appu**, nema deploya, nema migracije.
> Naredbe: PowerShell iz `data-prep_tools\`.

---

## T-S164-1 ⬜ R3 na TEST-u — app vidi novi Podtip

Preduvjet: `npm run dev` (TEST, banner!), prijava pod TEST vlasnikom `Financije_all`.

1. Activities, Area `Financije_all`, Filter by **Podtip** = `Osiguranje`.
   **Očekivano:** točno **5** redaka: 21.03.2023. Generali 402,75 · 02.04.2024. Alllianz kuća 418,76 ·
   27.03.2025. Osiguranje za kuću 418,76 · 19.03.2026. Generali police 434,26 i 0,17.
2. Otvori Edit retka 19.03.2026. Generali police 434,26.
   **Očekivano:** Tip `Kuća`, Podtip `Osiguranje`; padajući izbornik Podtipa pod `Kuća` nudi
   `Osiguranje` uz stare opcije (i stari `Popravci, održavanje, osiguranje` je i dalje tu).
   Zatvori **bez spremanja**.
3. Filter by Podtip = `Popravci, održavanje, osiguranje` ⇒ **128** redaka (bilo 133).
   **Pad:** 0 redaka u koraku 1 (keš kategorija/pravila — F5 pa ponovo), ili `Osiguranje` nema u
   izborniku (⇒ `validation_rules` nije upisan, javiti).

## T-S164-2 ⬜ R3 na PROD-u (nakon Kokinog pristanka)

Struktura `Financije_all` je Kokina (S133) — alat dodaje opciju service ključem, pa se s njom
dogovori prije pokretanja.

1. Backup: `Tools\run.bat Tools\backup_db.py --env prod`
2. Dry run:
   ```powershell
   $env:ET_TARGET='prod'
   Financije\run.bat fix_kuca_osiguranje_S164.py
   ```
   **Očekivano:** zaglavlje `[PROD]`, `⇒ dodati Osiguranje`, pet redaka s `✓`, `za promjenu: 5 od 5`.
   **Pad:** ijedan `✗` ⇒ redak je u međuvremenu promijenjen; ne pokretati `--apply`, javiti Claudeu.
3. Upis:
   ```powershell
   Financije\run.bat fix_kuca_osiguranje_S164.py --apply --yes-prod
   ```
   **Očekivano:** `U bazi: opcija Osiguranje ✓ · retci s Osiguranje: 5 od 5 ✓`.
4. U appu (PROD, `Ctrl+Shift+R`): isti koraci kao T-S164-1 ⇒ 5 / 128 redaka.
   Saldo se ne smije pomaknuti (mijenja se samo Podtip).

## T-S164-3 ⬜ N/A prijedlozi — uvoz na TEST-u

Fileovi (napravljeni nad TEST = PROD 07.10., prozor 10/2025–09/2026):
`data-prep_data\Financije\na_razvrstavanje_kokin_tekuci_zaba_20261007_1049.xlsx` (72 retka, 8 prijedloga)
`data-prep_data\Financije\na_razvrstavanje_sasin_tekuci_rf_20261007_1049.xlsx` (49 redaka, 6 prijedloga)
(`…_0946` i `…_1025` su stari: ravan izbornik odnosno nesložen popis — ne koristiti.)

1. Otvori RF file. List `Pregled` za svaki redak kaže prijedlog i dokaz (ili zašto ga nema).
   Žuti Tip/Podtip = prijedlog; narančasti = `N/A`, razvrstaj ga sam iz padajućeg izbornika.
   **Izbornik Podtipa nudi samo Podtipove odabranog Tipa**; promijeniš li Tip, stari Podtip
   pocrveni dok ga ne zamijeniš. Legenda i tehnički stupci su sklopljeni (`+` gore / lijevo).
   Što ne znaš, ostavi `N/A`.
2. `npm run dev` (TEST), Activities → Import → RF file.
   **Očekivano:** **0 New · Modify = broj redaka kojima si ostavio Tip ≠ N/A** (bez ručnih: **6**)
   **· 0 Delete**. Ništa drugo osim Tip/Podtip u popisu izmjena.
3. Overview, pločica ZABA i RF: saldo se **ne smije** pomaknuti (mijenja se samo klasifikacija).
4. `Financije\run.bat razvrstaj_na.py --od 2025-10-01 --do 2026-09-30` ⇒ RF ima toliko manje N/A.
   **Pad:** ijedan New ⇒ ne uvoziti (redak se ne prepoznaje kao postojeći), javiti Claudeu.

## T-S164-4 ⬜ N/A razvrstavanje na PROD-u

⚠ **TEST file se na PROD NE uvozi**: kol. G nosi TEST vlasnika (tebe), a PROD retke je upisala Koka
⇒ uvoz stane (S149). Razvrstava se **jednom** (u TEST fileovima iz T-S164-3), a odluke se prenesu po
`event_id` (isti na TEST-u i PROD-u) u svjež PROD file s Kokinim e-mailom:

1. ```powershell
   $env:ET_TARGET='prod'
   Financije\run.bat razvrstaj_na.py --od 2025-10-01 --do 2026-09-30 --file --preuzmi "..\data-prep_data\Financije\<razvrstan RF>.xlsx" "..\data-prep_data\Financije\<razvrstan ZABA>.xlsx"
   ```
   **Očekivano:** zaglavlje `[PROD]`, `Preuzimam iz …`, `primijenjeno na N` (= razvrstani u oba
   filea, osim redaka koje je netko u međuvremenu razvrstao u appu), **nijedan `✗`**; dva nova
   filea, kol. G = **Kokin** e-mail.
2. Uvoz oba filea **pod Kokinim računom**. **Očekivano:** 0 New · Modify = N · 0 Delete; saldo nepomaknut.
3. Kontrola: korak 1 **bez** `--file` ⇒ N/A manji za N.

## T-S164-5 ⬜ Dugi izbornici abecedno (app + Excel)

Preduvjet: `npm run dev` (TEST), Area `Financije_all`, `Ctrl+Shift+R`.

1. Add Activity → izbornik **Tip**. **Očekivano:** `N/A` prvi, pa `Advokati, auto C5, auto Lacetti,
   Domaćinstvo, Informatika, …, Zabava, Zdravlje` (malo slovo `auto` je među A, ne na dnu).
2. Tip = `Zabava` → izbornik **Podtip**: `Audible_Koka, Audible_Sasa, Disney, HBOmax, …, Youtube`.
   Tip = `Razno` → `Nena's funds, Odjeća/…_Koka, …, Temu` (i kratki popis je abecedan — pravilo je
   po atributu).
3. **Smjer** (`Uplata, Isplata, PROVJERI`) i **Izvor** zadržavaju stari redoslijed (kratki popisi).
4. Isto u **Editu** postojećeg retka (zatvori bez spremanja).
5. Structure → Edit `Podtip`: popis opcija je u **starom** redoslijedu (baza se ne mijenja).
6. Activities Excel export → stupac Tip/Podtip: isti redoslijed kao forma.
   **Pad:** forma i Excel različitog redoslijeda ⇒ jedno od dva mjesta ne zove `optionOrder`.
