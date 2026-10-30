> Pisano protiv `f9ec646` (S189 prijevod) + `75d2771` (S188 paralelni prozor: katalog, odluke 30.10.) + commita koji nosi ovaj file (S189 zatvaranje: mjerenje koraka 4, popravci izvoza i View/Edit).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 … S189, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187–S189 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S190) — model treninga: korak 5 (katalog vježbi) pa 6 (model + prikaz)

> **Ukratko (S189):** poruke pregleda preuređivanja su na engleskom, format „jedan zapis = jedna serija" izmjeren je
> na 7.936 probnih serija i drži, a mjerenje je našlo i popravilo dva tiha kvara — izvoz je na granici stranice
> udvostručio i izgubio retke, a Edit je pri pomaku vremena obrisao vrijednosti iznad 1000 po treningu.

> **Živi plan je tablica „Koraci" u `docs/TRENING_MIGRACIJA.md`** (koraci 1–13). Ovaj file je samo stanje u letu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S189)
- **Poruke preuređivanja na engleskom** (greške, upozorenja, „Also changes"). Tvoje odluke: sirove putanje u
  `Settings:` ostaju; poruke iz baze se prevode uz prvu sljedeću migraciju koja ih dira (BACKLOG).
- **Excel analize snage je gotov** (paralelni prozor, 30.10.) — osim lista **Mjesta**, koji nisi pregledao.
  Iz njega: `vjezbe_prijedlog.json` = izvor kataloga (60 slugova: 56 vježbi + 4 načina), glavna + sporedna skupina,
  vrste Strength / Cardio / Mobility / Stretching / Method. **Katalog je zasebna Area „Katalog vježbi"** (dijeli se,
  Koka kasnije iz predloška). Method (IMOM, HIIT, GtG, TbyT) je način bloka, ne vježba. Sve u `TRENING_MIGRACIJA.md`.
- **Korak 4 izmjeren na TEST-u** (probna Area `S189 serije proba`, 402 izmišljena treninga = 7.936 serija):
  - **Količina nije problem** — lista se učita za ~1 s, izvoz cijele Aree ~50 s (1 MB), uvoz novih treninga ~0,23 s
    po seriji (tvoja povijest, ~20.000 serija ≈ 75 min, u više fileova).
  - **Puca današnji prikaz**, ne format: lista broji po 20 *serija*, pa je jedan trening od 220 serija 11 istih
    redaka; View i Edit pokazuju jednu seriju po gumbu `#1 … #24`. To je posao koraka 6.
  - Uvoz svim serijama treninga daje isto vrijeme upisa, pa ih View miješa ⇒ svaka serija nosi i **`red`** (položaj).
- **Dva tiha kvara nađena mjerenjem i popravljena** (vrijede za sve Aree, bit će na PROD-u uz sljedeći deploy):
  izvoz je na granici svakih 1000 redaka neke retke stavio dvaput, a neke izostavio; Edit koji pomakne vrijeme
  treninga s više od ~1000 vrijednosti obrisao je višak, uz poruku o uspjehu.

## Što treba od tebe — redom
1. ✅ **Korak 4 odlučen** (30.10.): način/napor/odmor bloka na prvoj seriji bloka; zagrijavanje = blok 0.
2. ✅ **T-S189-1** (30.10.) — pregled preuređivanja na engleskom.
3. Po želji: pogledaj probnu Areu `S189 serije proba` na TEST-u (podijeljena ti je, read) — vidi se kako lista i
   View danas izgledaju s 20 serija po treningu. Briše se kad korak 6 krene.
4. Kad stigneš: list **Mjesta** u Excelu analize snage.
5. **Studeni krug Financija (bez razvoja):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3 ZABA_2026-10,
   T-S181-3. To je ispit „Financije su dovoljno gotove".
6. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).

## Sljedeće (prijedlog)
**Korak 5** — Area `Katalog vježbi` (uvoz 56 vježbi iz JSON-a) + izbornik vježbe koji čita
kategoriju iz druge Aree (zapis pamti slug). Pa **korak 6** — model `Activity1` / `Gym` na TEST-u, lista po
treninzima, prikaz serija po bloku u View/Edit (skica `docs/mockups/trening_snaga_add.html`).

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S189)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Prijevod poruka preuređivanja | `restructure/plan.ts`, `apply.ts`, `restructurePlan.test.mjs`, E2E S179 | check + S179/S186 ✅; T-S189-1 ✅ |
| Izvoz: jedinstven redoslijed + paginirani roditelji | `excelDataLoader.ts` (`loadEventsForExport` `.order('id')`; `mergeParentAttrsIntoEvents` `fetchAllPaged`) | T-S189-2 ✅ (proba: 10 dvostrukih / 3 sukoba → 0) |
| View/Edit atributi paginirani | `activityViewCache.ts`, `EditActivityPage.tsx` (`fetchAllPagedIn`) | T-S189-3 ✅ (pomak vremena 220 serija: 1.102 → 1.000 prije, 1.102 poslije) |
| Mjerenje koraka 4 | `data-prep_tools/Trening/proba_serije.py` (samo TEST; `--apply` / `--obrisi`); probni spec `Claude-temp_R/s189/_probe_S189_serije.spec.ts` (+ snimke) | `TRENING_MIGRACIJA.md` „Mjerenje za korak 4" |
| E2E e6-3 | spec bira Areu (S175: Structure export = jedna Area) | 3/3 ✅ |

Pravilo „leaf s mnogo eventa po sesiji lomi prikaz" je u CLAUDE.md § Model / atributi; `BUG-S189-PARENTSHIFT` u
Open bugs; „zastarjeli izvoz ne vraća obrisan redak" i poruke baze 058–060 u BACKLOG-u.

## Za korak 4 → 5 → 6
- **Korak 4 ✅ (S189):** zapis po seriji; atributi `vjezba`, `blok`, `serija`, `red`, `kg`, `ponavljanja`,
  `trajanje`, `intenzitet`, `zagrijavanje`; `metoda`/`rpe`/`odmor` na prvom zapisu bloka (serija 1, red 1);
  zagrijavanje = `blok` 0 (`serija` 1, `red` 1…N).
- **Korak 6 mora riješiti:** lista stranici po sesijama (danas `useActivities` po eventima, 20; grupe se preko
  stranica ne spajaju; Prev/Next nav 500 eventa ≈ 25 treninga); prikaz serija po blok → serija → red (nikad
  `created_at`); Edit pomak vremena ostavlja stari roditelj (`BUG-S189-PARENTSHIFT`); Edit Save po eventu ~0,5 s
  (220 izmijenjenih = 114 s) — nova forma piše skupno.
- **Korak 5:** „izbornik iz druge kategorije" čita kategoriju **druge Aree** (RLS čitanja); zapis kataloga je event
  ⇒ jedinstvenost sluga brani uvoz/forma; uvoz kataloga iz `vjezbe_prijedlog.json` (Excel u app format, kol. G = autor).

## Probna Area (TEST)
- `S189 serije proba` = `efe3ec96-…`, kategorije `Activity1` `e56a7a00-…`, `Gym` `9420b1c2-…`, vlasnik
  `owner@test.com`, read Saši. Sadrži 1 roditelja-siroče (18:41, iz mjerenja pomaka vremena).
- ⚠ **E2E global-setup briše sve ne-seed Aree vlasnika `owner@test.com`** i njihova dijeljenja: pri sljedećem E2E
  krugu proba će izgubiti dijeljenje (S189 se dogodilo, vraćeno) i možda dio eventa. Ako treba čista: `run.bat
  Trening\proba_serije.py --obrisi` pa `--apply` (nove id-jeve upiši u probni spec).
- Obrisati kad korak 6 krene (`--obrisi`).

## Kasnije
- **A4 „merge into"** (spec §25, §27): `planMerge` uz `retype.ts`; SQL `061` (uz njega prevesti poruke 058–060);
  „Delete source" = nova vrsta zapisa ⇒ grana u `_restructure_current` **i** `_restructure_write_config`.

## Otvoreno / zapamti
- Na TEST-u Sašin trening je **`Fitness_Garmin`**; TEST `Fitness` ×2 su demo. Slugovi na TEST-u imaju crticu.
- Deploy F2 + S187–S189 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije).
  S187 mijenja Fitness formu (7 polja s defaultom vidljiva); S188 mijenja ime sheeta (PROD export do deploya nosi
  `Preuređivanje`, koji novi uvoz ne čita — javi upozorenje); S189 popravci izvoza/View/Edit vrijede za sve Aree.
- `visible_when` za tekst ne proširuje `depends_on`; `TextOptions`/`DateMap` dijele na golom `|`.
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša; model dana DIARY (280 dana s više Garmin treninga).
