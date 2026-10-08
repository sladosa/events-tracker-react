> Pisano protiv commita **S166 ritual** na `test-branch` (zadnji commit = „S166: ritual …").
> **`main` = `006374c` (deploy S160, 04.10.)**. Na `test-branch` čekaju deploy: S160b, S161, S162,
> **S165 + S166 (pločica „Kamo ide novac" i dorade Overviewa)**, S163–S164 (dokumenti, alati, abecedni izbornici).
> **Migracija `056` je na TEST-u, NIJE na PROD-u.**
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S166 (2026-10-08)

> **Ukratko (S166):** Pločica „Kamo ide novac" prošla je sve ručne testove na TEST-u, a usput je po
> Sašinim primjedbama dobila povezan krug i listu, postotke, harmoniku sa saldom i objašnjenje potvrde
> na klik; podaci kroz cijelu povijest pokazali su tri krivo razvrstane stavke koje čekaju odluku.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S166

- **Svi testovi pločice na TEST-u prošli** (T-S165-1..8), i abecedni izbornici (T-S164-5).
- Po tvojim primjedbama: **jedna pločica otvorena** (saldo zadano, klik prebacuje), **klik na krug
  suzi listu**, **postotak** uz svaki iznos, rubovi kruga vidljivi, nema ↗ ondje gdje bi lagala,
  objašnjenje potvrde samo na klik „kako radi potvrda?".
- **PROD nije diran.**

## Što treba od tebe (kad budeš imao snage)

1. **Tri odluke o podacima** — sve je jasno zapisano u `docs/FINANCIJE_PROCES.md` §4 (**T33–T36**) i §8.7:
   - **T33** Investicije (9.543 €, 2023.–24.): izvan razreza kao Transfer (preporuka) ili vlastiti bucket?
   - **T34** „Pharmalog" (9 uplata, 19.493 €, sada pod Medical_Koka): Kokin prihod — `Prihodi / Koka`
     ili novi Podtip? **Koka potvrđuje.**
   - **T35** Triglav životno (7.782,55 €, 12/2023): `Prihodi / Saša` ili Investicije?
   - **T36** N/A fileovi `na_razvrstavanje_*_1049.xlsx` — s Kokom, u istom sjedenju kao T34.
   ⚠ Bolje riješiti **prije** PROD-a: Koka bi na pločici vidjela „Medical_Koka −18.341,95".
2. **Prije PROD-a: R3 osiguranje kuće (T-S164-2)** — treba Kokin pristanak.
3. **PROD (T-S165-9):** 056 u SQL editoru → `verify_breakdown.py` → deploy → `set_breakdown.py
   --apply --yes-prod`. Zatim T-S166-6 (Koka na mobitelu).
4. Od ranije: **11.10.** Koka potvrđuje MC naplatu u traci (T-S158-1 / T-S156-6); **~03.11.** Visa izvod.

**Otvoreno pitanje (dizajn, nije hitno):** F5 vraća filtar na All time, pa razrez tada pokazuje
2023.–danas. Treba li pločica razreza vlastito zadano razdoblje (npr. tekući mjesec)?

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- **TEST:** 056 + config razreza (S165). Nema novih upisa u bazu u S166 (samo čitanje za T33–T36).
- **PROD:** ništa od S165/S166.
- `npm run check` ✓, build ✓, E2E `S165_breakdown_tile.spec.ts` **3/3** (široki, svjež krug, uski).

## Novo u S166 (kod)

- `OverviewTab.tsx`: harmonika — `lastOpenTile` na razini modula, zadano prvi `balance_by_group`;
  `BalanceByGroupTile` dobio `collapsed`/`onToggleCollapsed` (sadržaj `hidden`, ne odmontiran) i
  `HowConfirmWorks` (objašnjenje na klik); `BreakdownTile` više ne pamti sklapanje u localStorage.
- `BreakdownTile.tsx`: `focusId` + `focusPath` (izvedeno), staza `Sve › …`, `share()` (udio u roditelju).
- `BreakdownSunburst.tsx`: `level` iz stanja, slušač vezan u `onInitialized` (⚠ ne `onSunburstClick`
  prop — CLAUDE.md § UI), `nets` u tooltipu, `marker.line` 2,5 px.
- `breakdownModel.ts`: `drillFor` — dvoznačan/prazan Podtip ⇒ `{ none }`; `SunburstData.nets`.

## Otvoreno

- T33–T36 (gore) → poslije odluka: `set_breakdown.py` (Investicije u `outside` ili bucket) + app Excel
  ispravaka po `event_id` (kol. G = autor) + **`set_breakdown.py` provjera nad svom poviješću**, ne 12 mj.
- Mjerna skripta za T33–T35 je bila u scratchpadu (`mjeri166.py`, koristi `verify_breakdown.pull`) —
  ako zatreba opet, napisati kao alat u `data-prep_tools/Financije/`.
- Nepromijenjeno od S165: F5 (Structure Excel `AreaSettings`/`Grupiranja`), „Čiji trošak" (R5),
  lazy Plotly, E12-2 na TEST-u, `export_profiles` rename, prijedlog održavanja Financija prije ~05.11.
