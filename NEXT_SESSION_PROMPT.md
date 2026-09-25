> Pisano protiv commita **`f3741cb`** (S149) + commit rituala S149 koji nosi ovaj file.
> ⚠ Ako `git log` pokazuje noviji commit od S149 rituala, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S149 (2026-09-25)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

Pet bugova, svaki s automatskim testom (i provjereno da test pada kad se popravak pokvari):

1. **Kriv e-mail u koloni G više ne pravi duplikate.** Uvoz stane i kaže koji redak
   postoji pod drugim autorom — umjesto da ga upiše kao nov (S148: 7 duplikata).
2. **„Restoring filter…" više ne može zapeti.** Nakon 8 s odustane, zadrži Areu i kaže
   da kategoriju odabereš ponovno.
3. **Structure uvoz više ne briše „Hidden in Add"** kad file nema tu kolonu.
4. **Nedovršeni unos s TEST-a ne iskače na PROD-u** (i obrnuto).
5. **Pločica:** „zadnji zapis" sada glasi **„zadnja promjena salda"**.

## Što treba od tebe

1. **Deploy** — ništa od ovoga nije na PROD-u. Kad želiš (PowerShell):
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
   Poslije deploya **hard refresh** (Ctrl+Shift+R).
2. **Tri ručna testa** (`docs/sessions/tests/S149_tests.md`): T-S149-1 (kolona G),
   T-S149-3 (HiddenInAdd, na TEST-u), T-S149-5 (natpis, PROD nakon deploya).
3. Iz S148, još bez odgovora: **komentar PP retka** glasi
   `Sašin tekući RF/Zdravlje/PP (Posmrtna pripomoc)` — što da piše?
4. Kad stigne **Visa izvod za rujan** (naplata ~05.10.) — u `izvodi/`.

## Tvoj redoslijed (S147) — gdje smo

1. ~~Baza — Visa~~ ✅ · ostaje: 1 loš par (`Hlace i carape` `Razno / Poklon`), RF `Izvod opis`.
2. ~~Bugovi~~ ✅ **pet s popisa gotovo** (ostali otvoreni su teži ili čekaju — v. DIO 2).
3. **Prolaz kroz backlog** ← sljedeće.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`test-branch` = `f3741cb` + ritual S149, pushan. `main` = `7ef95ac` (S147) — **iza za 5
commita u `src/`** (S149). Deploy pušta Saša.

## Što je S149 promijenio u kodu

- `excelImport.ts`: `sortUpdateRows()` (čista, dijele je apply i preview) + `foreignOwnedMessage()`;
  `UpdateAnalysis.foreignOwned`; `smartReclassify` čita kroz `withRetryQuery` i baca; reklasifikacija
  ide **prije** `applyDeletes`.
- `FilterContext.tsx`: `RESTORE_DEADLINE_MS`, `restoreTimedOut` / `dismissRestoreTimedOut`.
- `structureImport.ts`: `resolveHiddenInAdd()`, `groupAttributes` exportan (za test).
- `useLocalStorageSync.ts`: `DRAFT_KEY = dbScopedKey(STORAGE_KEY)`.
- Novi testovi: `structureHiddenInAdd.test.mjs`, `e2e/tests/S149_restore_deadline.spec.ts`.

## Otvoreno — bugovi koji su ostali

- **E8-2** — hipoteza „restore bez roka" oslabljena (drugi mehanizam: `select` postoji i
  `disabled`). Treba trace pada, ne novu hipotezu.
- **`et_activity_draft` po korisniku** (S118) — ključ sada nosi bazu, ne i korisnika.
- **BUG-S117-RULESHAPE**, **BUG-S103-ANYATTR** (RPC), bulk delete za grantee-a.
- „signal is aborted without reason" u Export modalu (S148, jednom) — ako se ponovi.

## Otvoreno — točnost baze

- 1 loš par: 16.09. `Hlace i carape` `Razno / Poklon` → `Pokloni`.
- ⭐ `make_financije_all_structure.py`: taksonomija iz `--base` (kao `read_base_automations`).
  **Dok nije popravljen — alat se ne pokreće** (briše podtipove dodane u bazi).
- RF `Izvod opis` (Sašin izričit zahtjev S131); `Visa racun` 07.09. čeka RF_2026-09.
- MC par `+105,30`/`−105,30` (`Planiran`); `oznaci_iz_presedana.py --apply`; rata 1/6
  `117,32 / 6` (atribut `19.57`, komentar `19.55`).

## Što NE dirati

- **`main`** — merge pušta Saša.
- **PROD upisi** — sve kroz Excel uvoz (Koka) ili `--apply` koji pokreće Saša.
