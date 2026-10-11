# S167 — detaljni testovi (2026-10-11)

> Sesija: **R3 na PROD-u** (T-S164-2 ✅, Koka pristala) i nastavak: stari Podtip
> `Kuća / Popravci, održavanje, osiguranje` → **`Kuća / Popravci, održavanje`**, alatom
> `Financije/fix_kuca_popravci_S167.py` (opcija + 128 redaka + `areas.settings` odjednom; UI
> preimenovanje bi promijenilo samo izbornik). U istom commitu `set_breakdown.py` i
> `visa_uvoz_izvoda.py` (`BAUHAUS`) nose novi naziv.
> Naredbe: PowerShell iz `data-prep_tools\` (`cd C:\0_Sasa\events-tracker-react\data-prep_tools`).

## T-S167-1 ⬜ TEST app — novi naziv, stari nestao

Izvedeno alatom na TEST-u 11.10.: `opcija ✓ · upisano 128 · 128 od 128 ✓ · sa starim 0 ·
settings bez starog naziva ✓`; ponovni prolaz ne mijenja ništa; `set_breakdown.py` dry run:
„svi parovi u validation_rules ✓", grupiranje ISTO.

Preduvjet: `npm run dev` (banner **TEST**), `Financije_all`, **Ctrl+Shift+R**.

1. Activities, Filter by **Podtip** = `Popravci, održavanje` (All Time) ⇒ **128 redaka**.
   Isto s `Popravci, održavanje, osiguranje` ⇒ **0**.
2. Add → Tip `Kuća`: izbornik Podtipa nudi `Popravci, održavanje` i `Osiguranje`, **nema**
   `…, osiguranje`.
3. Otvori jedan stari Bauhaus redak u Editu ⇒ Podtip pokazuje `Popravci, održavanje` (ne prazno).
4. Overview → „Kamo ide novac" (This Year) ⇒ bucket **Kuća investicije** postoji s istim iznosom
   kao prije, `nesvrstano` se nije pojavilo.

**Pad:** 1. daje manje od 128 ili 2. nudi stari naziv (keš — F5 pa ponovo; ako ostane, javiti);
4. pokazuje `nesvrstano` s Kućom (grupiranje nije prepisano).

## T-S167-2 ⬜ PROD — preimenovanje (nakon Kokinog pristanka)

Struktura je Kokina (S133) — pitati: *„Mogu li `Popravci, održavanje, osiguranje` preimenovati u
`Popravci, održavanje`, na svim starim retcima isto?"*

1. Backup: `.\Tools\run.bat Tools\backup_db.py --env prod`
2. Dry run:
   ```powershell
   $env:ET_TARGET='prod'
   .\Financije\run.bat fix_kuca_popravci_S167.py
   ```
   **Očekivano:** `[PROD]`, `⇒ preimenovati na istom mjestu (5. od 8)`,
   `drugdje u validation_rules: nigdje ✓`, `Retci …: 128`, `pod Tipom Kuća: 128`,
   `već „Popravci, održavanje": 0`, `areas.settings … 0 vrijednosti` (PROD još nema grupiranje),
   shortcuti `0`.
   **Pad:** alat stane s `✗` ili broj nije 128 ⇒ ne pokretati `--apply`, javiti Claudeu
   (128 je izmjereno na TEST = kopija PROD-a; Koka je mogla u međuvremenu dodati redak — tada
   je 129 ispravno, ali neka Claude pogleda).
3. Upis: `.\Financije\run.bat fix_kuca_popravci_S167.py --apply --yes-prod`
   **Očekivano:** `U bazi: opcija ✓ · upisano 128 · … 128 od 128 ✓ · sa starim (pod Kuća): 0 ·
   settings bez starog naziva ✓`.
4. App (PROD, Ctrl+Shift+R): koraci 1–3 iz T-S167-1. Saldo nepomaknut (mijenja se samo Podtip).

⚠ **Redoslijed prema T-S165-9:** ovo ide **prije** `set_breakdown.py --apply --yes-prod` — alat
razreza sada traži novi naziv u `validation_rules` i na PROD-u bez ovoga stane.
