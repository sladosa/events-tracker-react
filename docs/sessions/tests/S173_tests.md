# S173 — testovi (2026-10-18)

MC alat prije 11.11.: `fill_from_izvod.py --mc` dobio je ono što Visa alat ima od S161 (T13
blizak iznos = ispravak, T14 duplikati, T16 rata nasljeđuje plan) + T15 (redak u zagradi) i T23
(naknada uz ratu, buduće naknade). Samo Python alati, bez promjene appa i bez upisa u bazu.

## T-S173-1 ✅ (S173, izmjereno offline nad backup snimkama) Alat sam proizvodi ono što je S158 složio ručno

**Fixture:** `_backup/test/2026-10-07_0836` = stanje **prije** S158 uvoza (TEST = kopija PROD-a od
01.10.; košara 11.10. **40 / 859,58**); `_backup/test/2026-10-17_1013` = stanje **poslije**
(55 / 1.189,34). Delta sheet za 02.10. složen pravim `createDeltaExcel` (glavni blok 26, sekcija 48).
Harness: `Claude-temp_R/s173_mc/regresija.sh` (iz korijena repoa, offline, nula upisa).

| # | provjera | očekivano | izmjereno |
| --- | --- | --- | --- |
| 1 | stari alat (baseline) | — | 21 „za uvoz", od toga **4 duplikata** (T13), rate N/A, nijedan duplikat prijavljen |
| 2 | novi alat nad stanjem 02.10. + `--brisi` ×4 | KONTROLA ✓ u cent | **24 New · 38 Modify · 4 Delete**, Σ 1.189,34 = izvod |
| 3 | isti file kroz **pravi parser uvoza appa** (`parse_import.mjs`) | isti brojevi | toCreate **24**, toUpdate **38**, toDelete **4**, 0 grešaka |
| 4 | simulirani uvoz → košara 11.10. | = S158 | **55 / 1.189,34** (razlika samo `Tip` Temu/Glovo/VPA — Koka rukom / T17) |
| 5 | ponovni prolaz nad stanjem poslije uvoza | 0 / 0 | **0 New · 0 Modify**, svih 55 spareno |
| 6 | alat nad **stvarnim** stanjem poslije S158 | 0 New | **0 New · 45 Modify** (12 × `Rate?` na S158 ratama — T24, 33 žiga), ✓ u cent |
| 7 | sintetički studeni (košara 11.11. stanja 17.10. + 6 poremećaja) | 12 tvrdnji | **sve prošle**; sabotaža „bez početka plana" ruši 4, „bez bliskog iznosa" ruši 2 |
| 8 | živi TEST (= PROD 17.10.), kroz mrežu, `--dry` | 0 New | **0 New · 45 Modify**, ✓ u cent |

Novih 24 = 11 rata starih planova (datirane danom prve rate plana, `Tip` iz plana, komentar
`<Trgovac> n/N`) + 4 naknade + Glovo + VPA parking + **7 budućih naknada** (11.11./11.12. — točno
onih 7 koje je S158 složio jednokratno). Ispravci: Konzum 1/6 15,36→15,37 (i `Rate?`), FENGHUA
28,79→33,10, toner 3,45→3,49, Audible 8,99→8,11, Temu `Status` prazan→`Planiran`; ostalo žig.
Brisanja (prijavljena, tek uz `--brisi`): Hlace i carape (duplikat) + Kokin plan Plitvice (3 retka).

## T-S173-2 ⬜ (~02.11., PROD, Saša) MC_2026-10 kroz novi `--mc`

**Polazno stanje (TEST = PROD 17.10., izmjereno):** košara 11.11. = **35 / 2.264,35** — rate
starih planova **15 / 493,90** (generirane, bez `Izvod opis`), naknade **4**, Kokine kupnje
16 / 1.765,17. Izvod donosi i njene kupnje od 17.10. do zatvaranja izvoda.

1. `Financije\run.bat razvrstaj_izvode.py --apply` ⇒ `MC_2026-10.pdf`.
2. Delta Export ZABA iz appa (filtar na račun; sekcija košare mora biti u fileu).
3. PowerShell iz `data-prep_tools\`: `$env:ET_TARGET='prod'`, pa
   `Financije\run.bat fill_from_izvod.py <delta.xlsx> --mc MC_2026-10.pdf --dry`
4. **Očekivano u ispisu:**
   - zaglavlje `[PROD]` i `novi retci pod dubravka.pavic-sladoljev@…` (ne tvoj e-mail);
   - u `NOVI` **nijedna** od 15 rata starih planova ni od 4 postojeće naknade (one su u
     `ISPRAVCI` kao žig, eventualno s ispravkom iznosa zadnje `~` rate);
   - `NOVI` = Kokine neupisane kupnje + rate/naknade **novih** planova;
   - `KONTROLA košare 2026-11-11 … ✓ u cent` — ili `✗` uz „razlika je točno Σ prijavljenih":
     pogledaj `DUPLIKAT?` / `U KOŠARI … NE POTVRĐUJE`, odluči, ponovi s `--brisi=<id8>` (svaki zaseban).
5. Bez `--dry` ⇒ `<delta>_filled.xlsx`. Zapiši redak `OČEKIVANO U PREGLEDU UVOZA (MC): …`.
- **Pad:** rata ili naknada starog plana u `NOVI` (duplikat); KONTROLA ✗ bez objašnjenja;
  `NEJASNO` za redak koji je očito isti trošak (javi; danas je jedini izlaz `--brisi` starog
  retka, pa nov s izvoda ostaje — iznos točan, Kokin opis izgubljen).

## T-S173-3 ⬜ (~02.11., PROD, Koka) Uvoz `_filled`

1. Activities → Import → `_filled.xlsx`; za Sašine retke **„Ispravi kao vlasnik Aree"**.
2. **Očekivano:** pregled = brojke iz T-S173-2 korak 5 (New · Modify · Delete).
- **Pad:** drukčiji broj New (posebno „preskočeno — tuđi redak" za nove retke ⇒ kol. G nije Koka).

## T-S173-4 ⬜ (poslije uvoza) Ponovni prolaz i traka

1. Ponovi T-S173-2 korak 3 (`--dry`) nad novim Delta Exportom.
   **Očekivano:** `0 New · 0 Modify`, KONTROLA ✓.
2. 11.11. Koka: traka „Čeka potvrdu" za MC ⇒ **slaže se** ⇒ Potvrdi (isto što T-S171-5, T-S158-2).

## T-S173-5 ⬜ (samo ako ispis kaže `⚠ NOV PLAN`) Buduće rate novog plana

1. Poslije uvoza `Financije\run.bat rate_alat.py --only b` (dry) ⇒ nudi preostale rate novog plana.
2. **Očekivano:** buduće **naknade** tog plana (ako ima redak u zagradi) već su ušle T-S173-2
   fileom — `rate_alat` nudi samo rate, ne i naknade; nijedna rata dvaput.
