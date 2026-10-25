# S183 — testovi (2026-10-25)

Prekidač **Bucketi | Namjena | Tip** na pločici „Kamo ide novac" (RAZREZ_SPEC §18), odluke Saše
1A 2A 3A 4 5A 6A. Bez migracije. TEST config upisan `set_breakdown.py --apply` (25.10.).
TEST = PROD 22.10. + S180 (nepromijenjen od snimke `fixtures/breakdown_financije_2026_namjena.json`).

---

## T-S183-1 ⬜ (TEST lokalno, Saša) Pločica s tri pogleda

**Preduvjet:** `npm run dev` (žuti banner **TEST**), Sašin račun (vlasnik `Financije_all` na TEST-u),
**Ctrl+Shift+R**.

**Koraci i očekivano** (Overview → otvori „Kamo ide novac", razdoblje **This Year**, po kupnji):
1. Gore: **Ušlo 43.072,27 · Izašlo 36.148,05**. Prekidači: `Troškovi | Prihodi` · `Bucketi | Namjena | Tip`
   · `po kupnji | po naplati`.
2. **Bucketi** (zadano): Mjesečni troškovi 20.035,67 · Povremeno nužno 5.442,14 · Kvaliteta života
   3.775,64 · Putovanja i pokloni 3.130,40 · Kućište · Nenin novac 2.465,05 · **Projekti 683,91** ·
   Kuća investicije 614,44 · nerazvrstano (N/A) 0,80. **Nema** „Koka razno" ni „Saša razno".
3. **Namjena**: Izašlo i dalje **36.148,05**. Zajedničko 21.223,00 · Koka 5.765,86 · Saša 3.376,44 ·
   gotovina, nerazvrstano 3.316,90 · Nena / Kućište 2.465,05 · nerazvrstano (N/A) 0,80. Rečenice o
   fondu **nema** (preselila u Fond, korak 10). Krug: unutra
   Namjena, vani Tip. ↗ postoji uz Koka; rasklopi Koka ⇒ auto C5 3.998,72 **bez** ↗.
4. ↗ uz **Koka** ⇒ Activities s filtrom Namjena = Koka (samo Kokini retci, This Year) ⇒ natrag na
   Overview ⇒ pločica je i dalje u pogledu **Namjena**.
5. **Prihodi** (u pogledu Namjena): Saša 13.611,83 · Koka 13.410,44 · Nena / Kućište 12.000,00 ·
   Zajedničko 4.050,00; prekidač `po kupnji | po naplati` **nestaje**. Rasklopi Nena / Kućište ⇒
   odmah **Nasljedstvo** (bez međurazine „Prihodi"). Isto u pogledu Bucketi: Prihodi = Koka · Saša · Povrat Anja · Nasljedstvo.
6. Natrag Troškovi ⇒ **po naplati** ⇒ Izašlo **39.031,63** ⇒ Prihodi ⇒ Izašlo u gornjem retku
   **ostaje 39.031,63** (os se ne mijenja), prekidača osi nema.
7. **Tip**: ravno, prvi Domaćinstvo 8.833,31 (po kupnji), Izašlo 36.148,05.
8. Uski prozor (ili mobitel na lokalnoj mreži): tri prekidača se prelome, nema vodoravnog scrolla, krug se ne crta.
9. **↗ (dopuna, Saša 25.10.)**, Bucketi: rasklopi „Kućište · Nenin novac" ⇒ uz **Razno nema ↗**
   (hover kaže „Razno je u 4 bucketa…"), uz **Nena's funds ima**. Uz Putovanja (u „Putovanja i pokloni") ↗ ima.
   This Year: „nerazvrstano (N/A)" 0,80 **bez ↗** (hover: „1 redak bez vrijednosti „tip"…").
   Filtar **All Time** ⇒ N/A se rasklopi u **N/A** (↗, 1.378 redaka) i **(prazno)** (1, bez ↗); ↗ uz N/A ⇒
   Activities s filtrom Tip = N/A.
10. **Fond (dopuna, Saša 25.10.)**: This Year, pogled **Namjena** ⇒ treći izbor **Fond** ⇒ ploča
    „Fond Nena / Kućište": krupno **+9.534,95 €** („u fondu je (od početka)"), traka žuto ~⅕, ispod
    *ušlo 12.000,00 · potrošeno 2.465,05 (20,5 %) · ostaje +9.534,95* i *u razdoblju 01.01.–31.12.2026.:
    ušlo 12.000,00 · izašlo 2.465,05*; *Kamo je otišlo*: Razno › Nena's funds 2.465,05; *Odakle je ušlo*:
    Nasljedstvo 12.000,00; „retci ↗" ⇒ 16 redaka (14 troškova + 2 uplate). Bez kruga (jedna stavka troška).
    **Ključna provjera:** Period **This Month** (listopad) ⇒ krupni broj **ostaje +9.534,95** (od početka),
    a „u razdoblju" pokazuje samo listopad (ušlo 0,00 · izašlo 1.822,08).
    Pogled **Bucketi** ⇒ izbora Fond nema, pločica je na Troškovima.

**Pad:** Izašlo različit između pogleda; ↗ ispod Namjene; prekidač osi na Prihodima; nakon koraka 4
pogled vraćen na Bucketi.

---

## T-S183-2 ⬜ (PROD **poslije deploya**, Saša) Config i provjera

**Redoslijed (CLAUDE.md § Overview):** deploy → **Ctrl+Shift+R** → config. Migracije nema.

**Koraci** (PowerShell, iz `data-prep_tools\`):
1. `$env:ET_TARGET='prod'; Financije\run.bat set_breakdown.py` (dry run). Očekivano:
   `✓ slugovi…`, `✓ nesvrstano u cijeloj povijesti: ništa`, `pločica: MIJENJA SE`, `grupiranje: MIJENJA SE`,
   i točno ovih 9 redaka razlike:
   `('Projekti', '*'): None → Projekti` · `('Projekti', 'Koka'): Koka razno → None` ·
   `('Projekti', 'Saša'): Saša razno → None` · `('Zdravlje', 'Lječnička komora'): Koka razno → Mjesečni troškovi` ·
   `('auto C5', '*'): Koka razno → Povremeno nužno` · `('auto C5', 'gorivo'): None → Mjesečni troškovi` ·
   `('auto C5', 'leasing'): None → Mjesečni troškovi` · `('auto Lacetti', '*'): Saša razno → Povremeno nužno` ·
   `('auto Lacetti', 'gorivo'): None → Mjesečni troškovi`.
   ⚠ Ako javi ijednu drugu razliku (PROD ≠ TEST u grupiranju) — **stani** i pošalji ispis.
2. `Financije\run.bat set_breakdown.py --apply --yes-prod` ⇒ `✓ Upisano i pročitano natrag`.
3. `Financije\run.bat verify_breakdown.py` ⇒ `✓ RPC = Python u lipu…` (tvrdnja 2 na PROD-u se samo ispisuje).
   Pošalji ispis — iz njega Claude čita PROD brojke po bucketu i Namjeni.
4. App (Koka ili Saša) **Ctrl+Shift+R** ⇒ „Kamo ide novac", This Year: Izašlo **isti** u Bucketi,
   Namjena i Tip; fond Nena / Kućište ušlo **12.000,00**, izašlo ≥ 2.465,05; nema „Koka razno".

**Pad:** dry run s drugim razlikama; Izašlo različit među pogledima; žuti okvir „Nepoznat tip
pločice" (= stari bundle ⇒ Ctrl+Shift+R).

---

## Izmjereno u S183 (automatski; nije ručni test)

- `breakdownModel.test.mjs` 105/105 (§10 sintetika, §11 snimka); sabotaže fond+Transfer / N/A dvaput /
  drill ispod osi ruše 1 / 4 / 1.
- `verify_breakdown.py` TEST: RPC = Python u lipu s 4 dimenzije (4/4), model = `EXPECTED_12` (19/19).
- E2E `S183_breakdown_views.spec.ts` 2/2, `S165_breakdown_tile.spec.ts` 5/5 (stari config bez `views`).
- `AreaSettings` roundtrip novog configa: 191 redak, ISTO. `npm run check` 53 fileova / 0 palo, ratchet 0.
