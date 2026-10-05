# S161 — detaljni testovi (2026-10-05)

> Sesija: **mjesečni krug listopad** — ZABA izvod 2026-09 (Δ −8,60 = Visa kupnja upisana na ZABA
> račun), PBZ Visa izvod 2026-09 (1.150,92, plaćeno 05.10.) i `visa_uvoz_izvoda.py` bez mjesečnih
> popisa (prije/nakon naplate, planovi iz appa, blizak iznos, „krivo mjesto”, duplikat, RF naplata).
> Samo Python alat i dokumenti — **nema promjene u appu**, nema deploya.
> Naredbe: PowerShell iz `data-prep_tools\`, uz `$env:ET_TARGET='prod'` jednom po prozoru.

---

## T-S161-1 ✅ Koka uvozi Visa file (PROD)

File: `data-prep_data\Financije\visa_uvoz_2026-09_20261005_0926.xlsx`.

1. Koka: Activities → Import → file. Tuđi (Sašini) retci: **„fix as owner"**.
   **Očekivano u pregledu:** **9 New · 33 Modify · 1 Delete**.
   Uvoz traži kvačicu „potvrđeno razdoblje" za kartične retke prije RF sidra 29.09. — lažna
   uzbuna (T21), kvačica se klikne.
2. Overview, nakon uvoza:
   - **Kokin tekući ZABA = 11.191,11** (prije 11.182,51; razlika 8,60 = Ljekarna Štimac
     premještena na Visu).
   - **Sašin tekući RF = −270,00** ako od 29.09. na RF nije bilo nijedne uplate
     (881,09 − 1.150,92 − 0,17). Usporedi s bankom: razlika = uplata na RF od 29.09. koju app
     nema (npr. mirovina/plaća) ⇒ upisati je, to nije greška ovog uvoza.
3. Claude ponovi `visa_uvoz_izvoda.py PBZVISA_2026-09.pdf 2026-10-05 --premjesti=d0155b1c`.
   **Očekivano:** `RF naplata … ✓ već upisana`, `0 New · 0 Modify`, KONTROLA ✓ u cent.
   **Pad:** bilo što u `NOVI` ⇒ uvoz nije prošao cijeli; ne uvoziti ponovno, javiti Claudeu.

## T-S161-2 ✅ ZABA sidro s izvoda (PROD, nakon T-S161-1)

1. `Financije\run.bat promet_check.py` ⇒ **2026-09 ✓** (prije: −8,60 ✗).
2. Pločica ZABA → „u banci" **11.714,47**, izvor **izvod**, datum s papira **01.10.2026.**
   (`ZABA_2026-09.pdf`).
   **Očekivano:** saldo ostaje **11.191,11**, Δ 0.
   **Pad:** Δ ≠ 0 ⇒ ne upisivati; nešto od 01.10. do danas nije u appu.

## T-S161-3 ⬜ Sljedeći Visa izvod (studeni) bez izmjene alata

Kad stigne `PBZVISA_2026-10` (~03.11.): Saša plati, pa
`visa_uvoz_izvoda.py PBZVISA_2026-10.pdf <dan plaćanja> --file` **bez ijedne izmjene koda**.
**Očekivano:** alat ne stane na mjesečnom popisu; rate Konzum 2/3 i Maxi Konzum 2/6 spare se
s postojećim retcima (iz appa), ne dodaju; KONTROLA ✓ u cent.
**Pad:** rata plana iz appa u `NOVI` ⇒ pravilo plana (isti dan kupnje + `Broj rata`) ne drži.
