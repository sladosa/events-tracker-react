> Pisano protiv commita **S164** na `test-branch` (zadnji commit = „S164: ritual …").
> **`main` = `006374c` (deploy S160, 04.10.)**. Na `test-branch` čekaju deploy: S160b, S161, S162
> (app) i S163–S164 (samo dokumenti i Python alati). Nijedna migracija još.
> ⚠ Ako `git log` pokazuje noviji commit od S164, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S164 (2026-10-07)

> **Ukratko (S164):** Saša je donio sve odluke o pločici „Kamo ide novac" uz interaktivnu skicu nad
> stvarnim podacima (osam bucketa, gotovina u mjesečnim troškovima, osiguranje kuće odvojeno), dobio
> dva alata (osiguranje kuće u vlastiti Podtip i prijedlog razvrstavanja N/A redaka, 97 % točan na
> povijesti) i detaljni spec za RPC i pločicu, s izmjerenim prototipom upita koji se s Python modelom
> slaže u cent.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S164

- **Tvoja izmjena 50.000 € na PROD-u je provjerena** — čista, saldo se nije pomaknuo.
- **TEST je ponovno kopija PROD-a** (07.10.).
- **Sve odluke o pločici su donesene** (R1–R15). Raspored u 8 bucketa je tvoj; skica:
  https://claude.ai/artifact/CKaA4SgUbfuvV5qo4zNvFs
- **Osiguranje kuće** je na TEST-u odvojeno u Podtip `Kuća / Osiguranje` (5 redaka polica).
- **Alat za N/A retke** predlaže Tip/Podtip iz povijesti (97 % točno na provjeri). Od 121 N/A u
  zadnjih 12 mj predlaže 14; ostale (jednokratni trgovci, KEKS PAY) razvrstavate vi u Excelu.
- **Detaljni spec za kod** je gotov (`docs/RAZREZ_SPEC.md`, DIO 2).

## Što slijedi

**Sljedeća sesija: kodiranje pločice „Kamo ide novac"** (spec §15, koraci 1–4: migracija na TEST,
provjera u cent, model + pločica + testovi, config na TEST). Onda ti testiraš na TEST-u.

## Što treba od tebe / Koke (ne blokira kodiranje)

1. **T-S164-1** — na TEST-u (`npm run dev`) filtar Podtip = `Osiguranje` ⇒ 5 redaka.
2. **T-S164-2** — kad Koka pristane: osiguranje kuće na PROD-u (naredbe u
   `docs/sessions/tests/S164_tests.md`).
3. **T-S164-3/4** — pregled N/A fileova (tvoj RF, Kokin ZABA) i uvoz; prvo na TEST-u.
4. Od ranije: **11.10.** Koka potvrđuje MC naplatu u traci (T-S158-1 / T-S156-6); RF izvod →
   `promet_check`; **~03.11.** Visa izvod (T-S161-3); **deploy** S160b–S162 kad ti odgovara.

---

# DIO 2 — tehnički (za Claudea)

## Zadatak sljedeće sesije

**Izvesti `docs/RAZREZ_SPEC.md` §15 korake 1–4** po DIO 2 (§10–§14). Spec je pisan da se kodira bez
novih pitanja; ako se nešto u kodu ne poklapa sa specom, **izmjeri i javi**, ne pogađaj.
1. `sql/056_area_breakdown.sql` — na TEST pokreće Claude kroz `psql` (`SUPABASE_DB_URL` iz
   `.env.local`, `C:\Program Files\PostgreSQL\17\bin\psql.exe`); PROD pokreće Saša u SQL editoru.
2. `data-prep_tools/Financije/verify_breakdown.py` — RPC vs Python, mora biti u cent.
3. `src/lib/breakdownModel.ts` + `breakdownModel.test.mjs` (sabotaže!) → `BreakdownTile` +
   `BreakdownSunburst` → `OverviewTab` → `dashboardConfig` fixup → `docs/help/overview.md`.
4. `set_breakdown.py --apply` na TEST (raspored bucketa = §4.3 „Sašin raspored" + `Kuća/Osiguranje`
   → Povremeno nužno + gotovina → Mjesečni; Lječnička komora → Koka razno).
Pa `npm run check` + build, ručni testovi u `S165_tests.md`.

⚠ Config na PROD **tek poslije deploya** (CLAUDE.md § Overview, S164).

## Stanje baza

- **TEST = PROD od 07.10.** + R3 (`Kuća / Osiguranje`, 5 redaka) — **TEST se ovdje razlikuje od
  PROD-a** dok Saša ne izvede T-S164-2. Pločica na TEST-u zato pokazuje Povremeno nužno
  **2.911,14** / Kuća investicije **614,44** (12 mj, po kupnji); na PROD-u bez R3 bilo bi 2.476,71 /
  1.048,87. Ostali bucketi isti.
- Očekivane brojke (TEST, 10/2025–09/2026, po kupnji / po naplati): ušlo **46.972,48**; izašlo
  **40.127,91 / 39.305,20**; Mjesečni **20.994,89 / 19.939,85**; N/A **2.110,80 / 3.054,84**;
  gotovina nerazvrstano **3.830,90**. Tablica: RAZREZ §4.3.
- Backup TEST-a prije kopije: `data-prep_data/_backup/test/2026-10-07_0836`.

## Novo u S164

- `data-prep_tools/Financije/fix_kuca_osiguranje_S164.py` — jednokratno, po `event_id`, TEST ✓.
- `data-prep_tools/Financije/razvrstaj_na.py` — N/A → prijedlog; `--provjera`, `--file`, `--sve`,
  `--od/--do`. Fileovi `data-prep_data/Financije/na_razvrstavanje_*_20261007_0946.xlsx` (TEST).
- Skica (artifact) je statičan HTML u scratchpadu prošle sesije; ne treba za kod — spec nosi sve.
- Mjerne skripte i prototip SQL-a bili su u scratchpadu; prototip je opisan u RAZREZ §11.

## Otvoreno / neverificirano (nepromijenjeno od S162, skraćeno)

- E12-2 pada na TEST-u (nema predloška `Health`) — stanje baze, ne kod.
- `export_profiles` ne preživi rename. `Zdravlje / Other` opcija bez retka (K-održavanje).
- Otvoreni testovi: T-S164-1..4, T-S161-3, T-S158-1/2/4/5, T-S156-5/6/7, T-S154-2, T-S152-7,
  T-S145-3, T-S141-1, T-S140-8 (`audit_tests.py`).
- Prijedlog iz S162 (održavanje Financija prije ~05.11.: T2, T28, T24, T22, T21, T12; pa
  `trening.xlsm`; pa D3-F1) i dalje stoji — razrez je ušao ispred njega.
