# S168 — detaljni testovi (2026-10-11)

> Sesija (nastavak S167 u istom razgovoru): **T22** — rata modal stavlja ostatak zaokruživanja
> po kartici (`automations.rata.remainder_map`, Structure kolona `Remainder`); **lista čeka
> kolone Aree** (Kokina „lista bez iznosa"); **brojač** umjesto `Date.now()` u `useActivities`.
> Kod na `test-branch`; TEST config upisan (`set_rata_ostatak_S168.py --apply` ✓). PROD: deploy +
> alat. Automatski: `rataAmounts.test.mjs` (40, sabotaža ruši 4), `structureLockAttr.test.mjs`
> (+7 za `Remainder`), E2E `S168_list_waits_for_columns` (sabotaža ruši).
> Naredbe: PowerShell iz `data-prep_tools\` (`cd C:\0_Sasa\events-tracker-react\data-prep_tools`).

## T-S168-1 ✅ TEST — rata modal: MC zadnja, Visa prva

Preduvjet: `npm run dev` (banner **TEST**), `Financije_all > Transakcija`, **Ctrl+Shift+R**.

1. **+** → Izvor `Mastercard`, Isplata `55,45`, `Rate?` = da, `Broj rata` = `3`, ostalo po volji → **Finish**.
   **Očekivano u modalu:** `Iznos po rati: 18.48 (55.45 / 3)`, narančasta rečenica
   **„Zadnja rata nosi ostatak zaokruživanja — zbroj je točno 55.45."**, popis rata
   **18.49 · 18.49 · 18.47**.
2. **Preskoči** (ili Kreiraj pa obriši rate), zatim isto s Izvor `Visa`, Isplata `37,48`, 3 rate.
   **Očekivano:** **„Prva rata nosi ostatak…"**, **12.50 · 12.49 · 12.49**.
3. Obriši probne retke (TEST).

**Pad:** MC pokazuje `18.49 · 18.48 · 18.48` (stari kod ili keš ⇒ Ctrl+Shift+R; ako ostane, javiti).

## T-S168-2 ⬜ TEST — Structure export nosi `Remainder`, ponovni uvoz ne mijenja ništa

1. Structure → Export. List `Automations`, redak `rata` za `Financije_all`: zadnja kolona
   **`Remainder`** = `Mastercard=last | Visa=first` (redoslijed smije biti obrnut).
2. Isti file → Import. **Očekivano:** `Automations` siva `0` (ništa promijenjeno).

## T-S168-3 ⬜ PROD — nakon deploya: config + prvi MC plan

1. Deploy (merge `test-branch` → `main`, Saša; PowerShell blok iz CLAUDE.md § End of session 11).
2. ```powershell
   $env:ET_TARGET='prod'
   .\Financije\run.bat set_rata_ostatak_S168.py
   ```
   **Očekivano:** `[PROD]`, ključevi `['Mastercard', 'Visa']`, `remainder_map sada: None`.
   Zatim `--apply --yes-prod` ⇒ `U bazi: remainder_map ✓ · ostale postavke netaknute ✓`.
3. Prvi sljedeći MC plan s nedjeljivim iznosom (Koka): modal kaže **„Zadnja rata…"**; na izvodu
   se rate slažu u cent (traka 11. „slaže se").

## T-S168-4 ⬜ PROD (praćenje) — Kokin mobitel: lista nikad bez iznosa

Nakon deploya, na Kokinom iPhoneu: otvaranje appa / povratak u listu pokaže kostur („Loading…")
pa retke **s iznosima** — nikad retke bez iznosa. Mehanizam je potvrđen E2E-om (sabotaža: redak
se pojavi prije kolone iz configa); ovo je potvrda na stvarnoj sporoj mreži.

## T-S168-5 ✅ D7 — traka pita, ne traži tipkanje (TEST ako ima košaru, inače PROD 11.11.)

Odluka D7 (`docs/DOSPJELO_SPEC.md` §8). Automatski: E2E `S168_due_quick_confirm` (podmetnuta
košara; sabotaže „bez pitanja" i „dan unaprijed označen" padaju).

Ručno, kao **vlasnica** (Koka na PROD-u nakon deploya, ili TEST vlasnik ako TEST ima dospjelu košaru):
1. Overview → traka: **„Je li banka skinula 1.189,34 €?"** i gumbi dana (npr. `ned 11.10.`,
   `pon 12.10.`, … do danas). **Nijedan nije zelen** dok se ne dodirne; sutrašnjeg nema.
2. Dodir dana s ekrana banke ⇒ gumb pozeleni, ispod sažetak *„Upisat ću redak … <dan> · 1.189,34 €"*
   + **Da, upiši**. Tek „Da, upiši" upisuje (isti ishod kao T-S158-1).
3. (Druga košara ili Odustani) **„Ne — iznos ili dan je drukčiji →"** ⇒ polja „banka skinula" i
   „dana" **prazna**; **„← ipak se slaže"** vraća pitanje.
4. Kao grantee (Saša): pitanja nema, samo polje za usporedbu i rečenica „Potvrđuje vlasnica Aree".
