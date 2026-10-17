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
  pa ZABA saldo opet pokazuje danas. Ručno izabrano razdoblje u Activities ostaje. I: zaglavlje
  košare u dva retka (na Kokinom iPhoneu se broj kupnji podvlačio pod iznos).
- **TEST = kopija PROD-a od 17.10.** (s postavkama, `--settings`); jednokratno, ponavlja se kad zatreba.
- **E2E:** TEST očišćen, provjera prije svakog runa briše tuđe shareove i zaostale Aree E2E računa.
  Puni run 84/3 (bilo 54/17).

## Što treba od tebe
1. **Deploy kad želiš** (PowerShell naredbe u CLAUDE.md § End of session 11), pa T-S172-1 i T-S172-3 (Koka, iPhone).
2. **T-S170-4** (Network: `vendor` filtar, Disable cache, Ctrl+Shift+R) — upute dane u sesiji, slike pošalji.
3. Brzi: T-S169-8 (razrez nakon ↗ na PROD-u), T-S170-1 (broj `Racun`), T-S168-2 (Structure `Remainder`), T-S170-10.
4. **Koku pitaj:** lista bez iznosa od 14.10.? (T-S168-4) · `+` iz prve? (T-S154-2) — ako ne, zatvaramo.
5. T-S145-3 (kvačica `Not set`) se nije ponovila od 22.09. — zatvoriti?
6. Ručni test koji treba grantee ide pod **zasebnim** računom — E2E računi su samo za testove
   (inače ih provjera prije runa počisti).
7. Studeni: ~03.–11.11. Visa traka (T-S170-9) · 11.11. MC traka (T-S171-5, T-S168-3, T-S156-5) ·
   izvodi listopad (T-S156-7, T-S170-12, T-S161-3, T-S158-2). Razvrstavanje RF N/A (T-S169-6), starija povijest (T-S169-7), T37 Intercar.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- `dayDrillReturn.ts` (modul): `OverviewTab.showDay` pamti, `AppHome.openOverview` vraća prije montiranja.
- Puni E2E 17.10. (nakon čišćenja): 84/3; S133-1 poslije popravljen (sije vlastite evente).
  Povremeni: S104-3 (kategorije > 10 s), S107-3 — T-S172-4, izmjeriti prije produljenja čekanja.
- `global-setup` (S172) briše tuđe shareove i Aree izvan seeda (`SEED_AREAS`) za oba E2E računa.
- `prod_to_test.py --settings` — TEST config = PROD od 17.10.
- PROD od 12.10. nema MC plana rata (T-S168-3 čeka prvi Kokin plan).

## Otvoreno — kod (po prioritetu)
1. **Prije 11.11. (preporuka S172):** MC alat — T13/T14 (blizak iznos = ispravak, duplikati) u
   `fill_from_izvod`, T16 (rata nasljeđuje Tip/Podtip), T23 (naknada 1,32).
2. „Review" sheet — provjera košara (čeka Sašu; Backlog).
3. F5 (`groupings` / `due` kroz Structure Excel).
4. Delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni u bojanju.
5. Nakon ↗ se ne vraćaju `attrFilter`/komentar u Activities (↗ ih briše) — nitko nije tražio.
