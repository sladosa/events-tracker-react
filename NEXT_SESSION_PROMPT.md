> Pisano protiv zadnjeg commita **S172** na `test-branch` („S172: zatvaranje sesije …“).
> **`main` = `ca496cb` (deploy 17.10., S172).** `test-branch` = `main` + dokumenti zatvaranja.
> **PROD baza:** `sql/057` ✓, Visa config ✓ (14.10.). S172 nema migracije ni configa za PROD.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S172 (2026-10-17)

> **Ukratko (S172):** povratak na Overview nakon „isti dan u Activities ↗" vraća razdoblje od prije, košare na malom iPhoneu više se ne preklapaju, TEST je ponovo kopija PROD-a (sada i s postavkama), a E2E računi se prije svakog runa sami čiste — puni run 84/3 umjesto 54/17; osam testova zatvoreno mjerenjem, četiri sesije u arhivi.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo — NA PROD-u od 17.10. (T-S172-1, T-S172-3 Kokin iPhone, T-S169-8 ✅)
- Nakon ↗ u Košarama i klika na tab **Overview** vraća se razdoblje od prije (This Year), pa ZABA
  saldo opet pokazuje danas. Ručno izabrano razdoblje u Activities ostaje.
- Zaglavlje košare u dva retka — na Kokinom iPhoneu se „· 35 kupnji“ podvlačio pod iznos.

## Gotovo (bez deploya)
- **TEST = kopija PROD-a od 17.10., s postavkama** (`prod_to_test.py --settings`). Jednokratno —
  ponavlja se kad zatreba (npr. prije testova trake u studenom).
- **E2E:** TEST očišćen; prije svakog runa provjera sama briše tuđe shareove i zaostale Aree E2E
  računa. Puni run **84/3** (bilo 54/17). Ručni test s grantee-jem ide pod **zasebnim** računom.
- Zatvoreno mjerenjem: T-S152-7, T-S158-4, T-S164-1, T-S171-4, T-S140-8, T-S141-1, T-S172-2.
  Arhiva: S140, S141, S152, S164.

## Što treba od tebe
1. ~~Deploy~~ ✅ 17.10. — T-S172-1, T-S172-3, T-S169-8 potvrđeni na PROD-u.
2. ~~T-S170-4~~ ✅ 17.10. lokalnim buildom (početak 132 KB, Plotly/Excel tek na zahtjev).
3. ✅ 17.10. na laptopu: T-S170-1, T-S168-2, T-S170-10, T-S172-1, T-S170-4.
4. **Koku pitaj:** lista bez iznosa od 14.10.? (T-S168-4) · `+` iz prve? (T-S154-2) — ako ne, zatvaramo.
5. T-S145-3 (kvačica `Not set`) nije se ponovila od 22.09. — zatvoriti?
6. Studeni: ~03.–11.11. Visa traka (T-S170-9) · 11.11. MC traka (T-S171-5), prvi MC plan s ostatkom
   na zadnjoj rati (T-S168-3), ti kao grantee (T-S156-5) · izvodi listopad (T-S156-7, T-S170-12,
   T-S161-3, T-S158-2, T-S158-5 korak 1). Razvrstavanje RF N/A (T-S169-6), starija povijest
   (T-S169-7), T37 Intercar.
7. Odluka iz Backloga: provjera košara u „Review“ sheetu.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- `dayDrillReturn.ts`: `OverviewTab.showDay` pamti, `AppHome.openOverview` vraća prije montiranja.
- `BasketsTile` zaglavlje: dva retka, desni stupac `shrink-0` (CLAUDE.md § UI: razmak u `nowrap`).
- `prod_to_test.py --settings` (staje na UUID u configu). TEST `Financije_all` = PROD 17.10.
  (5.424 eventa / 51.071 atribut / 25 sidara / settings ✓). Backup TEST-a prije: `_backup/test/2026-10-17_1013`.
- `e2e/setup/global-setup.ts`: `resetAccount` za oba E2E računa (`SEED_AREAS`, `E2E_USERS`) —
  spec koji stvara Areu mora je sam brisati. S133-1 sije vlastitih 1.100 eventa.
- PROD od 12.10. nema MC plana rata (T-S168-3 čeka prvi Kokin plan).

## Otvoreno — kod (po prioritetu)
1. **Prije 11.11. (preporuka S172):** MC alat — T13/T14 (blizak iznos = ispravak, duplikati) u
   `fill_from_izvod`, T16 (rata nasljeđuje Tip/Podtip), T23 (naknada 1,32).
2. **Excel uvoz: `default_map` kad se roditelj promijeni** (Saša S172: A + upozorenje) — BACKLOG, vrh
   „Otvoreno". Okida samo na promjenu roditelja, dijete koje je čovjek promijenio pobjeđuje.
3. **T-S172-4:** povremeni E2E padovi S104-3 (kategorije Fitnessa „Loading…“ > 10 s), S107-3 —
   izmjeriti (trace/Network) prije produljenja čekanja.
4. „Review“ sheet — provjera košara (čeka Sašu).
5. F5 (`groupings` / `due` kroz Structure Excel).
6. Delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni u bojanju.
7. Nakon ↗ se ne vraćaju `attrFilter`/komentar u Activities (↗ ih briše) — nitko nije tražio.
