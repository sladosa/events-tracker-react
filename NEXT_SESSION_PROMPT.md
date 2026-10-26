> Pisano protiv `62f0713` (S185: pace odluka) + commita koji nosi ovaj file (S185 zatvaranje, 26.10.).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 (kod F2 + docs), **nije deployano**.
> **Baze:** `059` i `060` su na **TEST-u**, na PROD-u **nisu**. PROD podaci S185 nisu dirani.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S186) — A1: sheet i pregled u aplikaciji

> **Ukratko (S185):** dogovoren i napisan spec F2 (preuređivanje atributa) na stvarnim stupcima DIARY-ja, a na TEST-u izvedeni i dokazani popravak izbornika Namjene, izvođenje atributa iz teksta (Garmin kalorije su bile u kilodžulima — sada kcal) i promjena tipa atributa (`mood` smajlić → broj); sheet i pregled u aplikaciji za A1 su sljedeći korak.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S185)
- **Spec F2** je u `docs/PREUREDJIVANJE_SPEC.md`, DIO 3 (§21–§33), s tvojim odlukama (§21.1–21.2).
- **Na TEST-u:**
  - `Fitness_Garmin` je sada pod tvojim Gmailom (bio je na testnom outlook računu za pozivnice);
  - kalorije Garmin treninga su ispravljene iz kilodžula u kcal, a Garmin alat ih od sada pretvara sam;
  - `mood` je broj 1–5, a lista pokazuje sličicu (30 testnih treninga od 06.2024.).
- **Popravak izbornika Namjene** (§20) je u kodu. Na PROD-u vrijedi tek s deployem — do tada Namjenu s
  retcima ne preuređuj sheetom (ionako ne planiraš).
- **Odluke:** `Activity` ostaje trening, ostatak DIARY dana ide u Health/Life uz periode; novi model treninga
  „uz stari" (Activity1); `pace` je tekst `mm:ss`, a tempo za analizu računa se pri prikazu (BACKLOG).

## Što treba od tebe
1. **Kad stigne Garminov e-mail** (GDPR izvoz, zatražen 26.10.): zip u `C:\0_Sasa\GarminData_2026`, ne
   raspakiravati, javiti.
2. **Kad stigneš, na TEST-u** (`npm run dev`): T-S185-1 (kalorije 01.12.2024. = 630) i T-S185-2 (Mood
   kolona sa sličicama, View broj, Edit polje za broj). Koraci: `docs/sessions/tests/S185_tests.md`.
3. **Studeni krug (bez razvoja, nepromijenjeno):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3
   ZABA_2026-10, T-S181-3. To je ispit „Financije su dovoljno gotove".
4. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).

## Sljedeće (prijedlog)
A1 kroz aplikaciju: sheet **`Preuređivanje atributa`** u Structure Excelu + pregled i Poništi u modalu
(isti tok kao F1 sheet za Namjenu). Zatim A4 (spoji atribute). Deploy F2 na PROD tek kad je cijeli tok
(A1 + A4 u aplikaciji) prošao test na TEST-u.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S185)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| §20 Namjena pod `*` | `restructure/plan.ts` | `restructurePlan.test.mjs` 78/78; nad starim kodom pada 8 |
| A2 jezgra | `sql/059` (TEST), `data-prep_tools/Trening/pravila.py` + `izvedi.py` | spec §32: brane, upis = predviđanje, povrat = otisak |
| A2 prvi korisnik | TEST `Fitness_Garmin.kcal` kJ → kcal, op `a000241e` | Garmin/DIARY 4,19 → 1,00 |
| Garmin alat | `garmin_activities_to_xlsx.py` uvozi `pravila.kj_u_kcal` | 01.12.2024. = 630 |
| A1 jezgra | `sql/060` (TEST), `restructure/retype.ts` | `restructureRetype.test.mjs` 43/43; TS = SQL 15/15; dokaz `mood`/`pace` §33 |
| TEST priprema | `Fitness_Garmin` outlook → Gmail; `mood` posijan (30) + `list_columns` s mapom; `mood` → broj (op `9f749b3d`) | backup `_backup/test/2026-10-26_1621` |

## Za S186 — A1 u aplikaciji (spec §28)
- `src/lib/restructure/attrSheet.ts` — sheet `Preuređivanje atributa`
  (`Korak | Operacija | Kategorija | Atribut | Novi tip | U atribut | Pretvorba | Obriši izvor | Napomena`),
  prazan predložak u Structure exportu (slova se računaju, S160), mapa u obliku `ListColumns` `Map`.
- Faza u `StructureImportModal` / `RestructurePanel`: Structure → `Preuređivanje atributa` → `Preuređivanje`;
  tablica „nepretvorivo" (crveno, gasi Primijeni), Poništi, `areas-changed` poslije.
- Snimka za `planRetype`: obrazac je `Claude-temp_R/s185/a1_runner.mjs` (`snapshot()`), u appu kroz
  `fetchAllPaged` + `order` (pravilo S108/S179).
- E2E (§29.6): sheet A1 `mood` mapa ⇒ lista sličica, Edit broj, Poništi vraća.
- Pa A4 (`merge`): spec §25 + §27; isti obrazac kao `060` (zasebna funkcija, isti zapis, zajednički povrat).

## Otvoreno / zapamti
- `059`/`060` na PROD: tek uz prvi PROD posao F2 (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije).
- PROD `Fitness.pace` je `number` s 0 redaka ⇒ u novom modelu `text` (A1 bez redaka).
- BACKLOG (S185): tempo kao prikazna kolona (`duration` na `Activity`, `distance` na `Outdoor` — prikaz treba obje
  razine); Garmin san 3.127 noći u `Health_Sasa`; Garmin trening 01.08.2017. s krivim ulazom (0:01 min/km).
- Model dana DIARY-ja (`TRENING_MIGRACIJA.md`): 280 dana ima više Garmin treninga — kojem ide raspoloženje dana?
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša.
