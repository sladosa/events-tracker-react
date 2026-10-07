# S164 — detaljni testovi (2026-10-07)

> Sesija: **Kamo ide novac — odluke i skica** (`docs/RAZREZ_SPEC.md`). TEST ponovo = PROD
> (`prod_to_test.py`), skica pločice nad stvarnim podacima, sve odluke R1–R15 donesene.
> Jedini upis u bazu: **R3 — osiguranje kuće u vlastiti Podtip** (`fix_kuca_osiguranje_S164.py`),
> izveden na TEST-u. **Nema promjene u appu**, nema deploya, nema migracije.
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
