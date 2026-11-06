> Pisano protiv `0c0588c` (S194) i commita koji nosi ovaj file (S194 zatvaranje).
> **Stanje:** `main` = `c232ee5` (S185–S193, **PROD od 06.11.2026.**); `test-branch` = `main` + S194 (alati, T46, T42), **nije deployano**.
> **Baze:** `058`, `059`, `060` su na PROD-u i TEST-u. S194 nema migraciju. PROD `Visa=cutoff:2:5` (06.11.), TEST još `cutoff:3:5`.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S195) — trening, korak 6 (prijedlog); Financije samo 11.11. i u prosinačkom krugu

> **Ukratko (S194):** S185–S193 su na PROD-u (backup, 059/060, shema u gitu), pet alata mjesečnog kruga popravljeno i
> izmjereno usporedbom stare i nove verzije nad izvodima 2026., Visa pravilo naplate je cutoff:2:5, a čip „saldo na
> dan" i tiše upozorenje „older records" čekaju idući deploy.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S194, 06.11.)
- **Deploy** S185–S193 na PROD (backup `2026-11-06_1345` samo na laptopu — **pusti `backup_to_external.bat` kad
  disk bude pri ruci**).
- **Alati za izvode** (rade lokalno, bez deploya): ZABA storno i „krivo mjesto" (kartica plaćena s računa — jasan
  slučaj alat sam prebaci), MC kupnje s kraja izvoda same idu u iduću košaru, Visa bliski iznos istog dana,
  razvrstač i za izvode bačene ravno u `izvodi\`.
- **Visa `cutoff:2:5`** na PROD-u (ti, pod Kokom) — kupnja od 3. u mjesecu sada ide u sljedeću naplatu.
- **Na test-branch, čeka deploy:** čip „na dan X · Custom ↺ This Year" na saldu (T46, provjerio si na TEST-u) i
  upozorenje „older records" koje više ne pali na rate (T42).

## Što treba od tebe / Koke (sve: blok „Na redu" u `docs/sessions/PENDING_TESTS.md`)
1. **Koka: osvježi app prije 11.11.** (zatvori karticu i otvori ponovo) — inače traka ne upisuje Namjenu.
2. **11.11.:** ti u traci upiši 2783,26 ⇒ „✓ slaže se" (T-S193-2); Koka „Da, upiši" ⇒ Edit novog retka:
   Namjena = Zajedničko (T-S193-1, T-S175-1 E).
3. **Prvi Kokin Excel uvoz:** „Trajanje" na kraju, filtar ostaje This Year (T-S193-3).
4. **Mobitel na PROD-u** (T-S191-6): ✕ na slici i kamera u Editu — sada je moguće, deploy je prošao.
5. **Deploy prije prosinačkog kruga (~1.12.)** — T46 i T42 (T-S194-5/6). Iste naredbe kao 06.11., bez SQL koraka.
6. **Prosinački krug** (MC ~02.12., Visa ~03.12., ZABA): novi alati (T-S194-1..3) — to je ujedno ispit
   „Financije dovoljno gotove" (krug bez ručnog slaganja i bez razvojne sesije).

## Što mislim da treba dalje
**Financije su sada u održavanju** — do prosinca nema razvojnog posla za njih osim onoga što krug sam pokaže.
Preporuka za S195 je **trening, korak 6** (Strategic Position, korak 4): forma i Edit nad modelom serija.
Prije toga trebam od tebe:
- **P-2:** tvoje mišljenje o skici View-a treninga (<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>);
- **P-1:** Gibljivost — Structure export `Health_Sasa` s PROD-a u `Claude-temp_R\`;
- **T-S191-5** (katalog, „Slično" za `lat_raises`) — 2 minute na TEST-u.

Uz korak 6 ide i **BUG-S189-PARENTSHIFT** (Edit koji pomakne vrijeme ostavi stari roditeljski event) — prvo izmjeriti
na PROD-u koliko takvih siročadi postoji (naredbu ti dam).

Ostaje u pričuvi (Financije, kad zatreba): uvoz NOVIH redaka (MC/Visa) brzina — nije mjeren kao T43; T-S174-3/5
(starija povijest s pravilima, Nenini retci) — posao kad imaš vremena.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S194)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Deploy S185–S193 | `main` = `c232ee5`, `sql/SCHEMA_PROD.sql` (`cb2ea65`) | diff sheme = samo 059/060 |
| T45 ZABA dedup | `_zaba_spajanje.py` (`--test` 19), `fill_from_izvod` (`Target.postojeci`, `premjesti_na_racun`, storno u `zaba_rows`) | stari/novi ZABA 01–10/2026: 2 razlike / 287 |
| T47 MC kraj izvoda | `mc_odluke` (`MC_KASNI_DANA = 2`, ispravak `Datum naplate` u `izmj`) | TEST povijest MC; simulacija u memoriji |
| T41/T44 Visa | `spari_blizu`, `_test()` (`--test` 6), naslov ISPRAVCI | stari/novi Visa 08–10: samo TEDI |
| T49 | `razvrstaj_izvode.korijen()` | privremena mapa: preimenuj / duplikat / drugi prolaz 0 |
| T40 | PROD config (Saša) | TEST povijest: dan 3. ⇒ 37/50 sljedeći ciklus |
| T46 | `BalanceByGroupTile` (`periodLabel`, `resetPeriod`), `OverviewTab` (preset iz `default_period`) | E2E `S194_balance_past_chip` |
| T42 | `statementStampSlugs` / `isStampOnly` (`confirmedRowEdit.ts`), `UpdatePreview.changeKeys`, `ExcelImportModal` | unit `statementStamp`, E2E `S194_old_records_stamp` |

## Otvoreno / zapamti
- **Puni E2E nije pušten u S194** (pušteni samo S165, S171, S168, S193 + dva nova). Paralelni run na TEST-u opet
  `statement timeout` (S193_import_speed pao u paru, sam prolazi 12 s / 103 poziva). Prije deploya T46/T42: barem
  specovi Overviewa i uvoza serijski.
- E2E global-setup i dalje „COULD NOT delete leftover area S189 serije proba" — riješiti uz korak 6 (iz S193).
- TEST config `Visa=cutoff:3:5` — `prod_to_test.py --settings` kad zatreba usporedba TEST/PROD.
- Klasifikator i dalje blokira Claudeove PROD pozive ⇒ deploy, backup, `dump_schema --env prod` i PROD mjerenja radi Saša.
- `S190 Trening proba` i `S189 serije proba` brisati kad korak 6 ima pravu Areu.
