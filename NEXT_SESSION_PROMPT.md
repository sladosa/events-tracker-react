> Pisano protiv commita **S172** na `test-branch` (zadnji commit = „S172: …").
> **`main` = `6ff19d4` (deploy 14.10., S169 + S170 + S171).** `test-branch` = `main` + S172 (povratak razdoblja nakon ↗, **nije deployano**).
> **PROD baza:** `sql/057` ✓, Visa config ✓ (14.10.). S172 nema migracije ni configa.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S172 (2026-10-17)

> **Ukratko (S172):** povratak na Overview nakon „isti dan u Activities ↗" sada vraća razdoblje od prije, pa saldo opet pokazuje današnje stanje; zatvoreno osam testova mjerenjem (među njima puni E2E run 80/7 umjesto 54/17), a četiri sesije testova su otišle u arhivu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo
- PROD (14.10.) radi: Košare, ↗, mobilni filtar, Prev/Next kroz košaru (T-S171-4 ✅).
- **Na `test-branch`, čeka deploy:** nakon ↗ i klika na Overview vraća se razdoblje od prije (This Year),
  pa ZABA saldo opet pokazuje danas. Ručno izabrano razdoblje u Activities ostaje.

## Što treba od tebe
1. **Deploy kad želiš** (PowerShell naredbe u CLAUDE.md § End of session 11), pa T-S172-1.
2. **T-S170-4** (Network: `vendor` filtar, Disable cache, Ctrl+Shift+R) — upute dane u sesiji, slike pošalji.
3. Brzi: T-S169-8 (razrez nakon ↗ na PROD-u), T-S170-1 (broj `Racun`), T-S168-2 (Structure `Remainder`), T-S170-10.
4. **Koku pitaj:** lista bez iznosa od 14.10.? (T-S168-4) · `+` iz prve? (T-S154-2) — ako ne, zatvaramo.
5. T-S145-3 (kvačica `Not set`) se nije ponovila od 22.09. — zatvoriti?
6. **Odluka T-S172-2:** na TEST-u ukinuti share Sašin `Health_Sasa` → E2E vlasnik i obrisati zaostali
   `Health_Sasa` (10.07.) — ili spec učiniti otpornim.
7. Studeni: ~03.–11.11. Visa traka (T-S170-9) · 11.11. MC traka (T-S171-5, T-S168-3, T-S156-5) ·
   izvodi listopad (T-S156-7, T-S170-12, T-S161-3, T-S158-2). Razvrstavanje RF N/A (T-S169-6), starija povijest (T-S169-7), T37 Intercar.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- `dayDrillReturn.ts` (modul): `OverviewTab.showDay` pamti, `AppHome.openOverview` vraća prije montiranja.
- Puni E2E 17.10.: 80/7. Stalni padovi E11-4, E12-2, E13-2 (E12-5 povremeno) — T-S172-2 (podaci TEST-a).
- PROD od 12.10. nema MC plana rata (T-S168-3 čeka prvi Kokin plan).

## Otvoreno — kod (po prioritetu)
1. **Prije 11.11. (preporuka S172):** MC alat — T13/T14 (blizak iznos = ispravak, duplikati) u
   `fill_from_izvod`, T16 (rata nasljeđuje Tip/Podtip), T23 (naknada 1,32).
2. „Review" sheet — provjera košara (čeka Sašu; Backlog).
3. F5 (`groupings` / `due` kroz Structure Excel).
4. Delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni u bojanju.
5. Nakon ↗ se ne vraćaju `attrFilter`/komentar u Activities (↗ ih briše) — nitko nije tražio.
