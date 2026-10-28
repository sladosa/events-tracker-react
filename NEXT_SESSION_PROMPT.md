> Pisano protiv `fdb3731` (S187: korak 3 — analiza zapisa snage) + commita koji nosi ovaj file (S187 zatvaranje, 28.10.).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 + S186 + S187, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187 nema migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S188) — model treninga, korak 4: format zapisa serija

> **Ukratko (S187):** polje s defaultom se u formi sada uvijek vidi (Kokina forma ista), novo pravilo „polje
> vidljivo samo uz vrijednost drugog atributa" radi u panelu, Excelu i formi, a analiza 78 treninga snage s
> PROD-a i 1.282 dana teretane iz DIARY-ja dala je prijedlog kataloga od 46 vježbi koji Saša pregledava.

> **Živi plan je tablica „Koraci" u `docs/TRENING_MIGRACIJA.md`** (koraci 1–10). Ovaj file je samo stanje u letu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S187)
- **Korak 1:** polje s defaultom (npr. `intensity = light`) se u Add formi uvijek vidi, popunjeno. Tvoj test ✅.
- **Korak 2:** novo pravilo „polje vidljivo samo kad drugi atribut ima određenu vrijednost" (npr. `weight_info`
  samo uz `Strength_type = Upp`). Postavlja se u Structure panelu („Visible only when") ili u Structure Excelu
  (kolona L `VisibleWhen`). Automatski testovi prolaze; tvoj ručni test još čeka.
- **Korak 3:** Excel s analizom tvojih zapisa snage — prijedlog kataloga od 46 vježbi, mjesta, rutine, oblici serija.

## Što treba od tebe — redom
1. **T-S187-2 (ručni test, ~15 min, TEST):** `npm run dev` (ne `dev:prod`!), koraci u
   `docs/sessions/tests/S187_tests.md`. Javi „T-S187-2 OK" ili što je palo.
2. **Pregled Excela** `C:\0_Sasa\events-tracker-react\Claude-temp_R\s187\analiza_snage_20261028.xlsx`:
   - list **Vjezbe**, žuti stupci A–D: slug, puno ime, skupina, vrsta. Isti slug = isti zapis vježbe.
     Prvo retci s ⚠ / „?": `bic` (bicikl ili biceps), `rot.`, `girja`, `z.sklek` (puno ime), IMOM / TbyT.
   - list **Mjesta**: potvrdi imena (Gym S, Gym F, Westin, CleverFIT…).
   - pogledaj **Rutine** i **Serije** — iz njih slijedi korak 4.
   Spremi pod istim imenom (ili javi novo ime). Ne treba savršeno — što ne znaš, ostavi.
3. **Odluka za korak 4 — kružni blokovi:** u 235 dana pišeš `4x(leg r.12 + plank)`. Treba li aplikacija pamtiti
   da su vježbe bile u istom krugu (npr. atribut `blok`), ili je dovoljna bilješka? Razmisli; dogovaramo prije koda.
4. **Studeni krug Financija (bez razvoja, nepromijenjeno):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11.,
   T-S175-3 ZABA_2026-10, T-S181-3. To je ispit „Financije su dovoljno gotove".
5. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).

## Sljedeće (prijedlog)
Korak 4 — format zapisa serija: kako se jedna vježba s piramidom (`12/10/8 × 20/25/30 kg`) i kružni blok
zapisuju u bazi, na temelju tvog ispravljenog Excela. Pa korak 5 (katalog vježbi + izbornik) i 6 (model na TEST-u).

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S187)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| d1: default ne skriva polje | `AttributeChainForm.tsx` (maknuto `isHiddenByDefault`, `requiredParentSlugs`, `userEditedIds`; `showAll`) | E2E `S187_default_visible`, T-S187-1 ✅ |
| `visible_when` | `src/lib/visibleWhen.ts` (jedino pravilo); forma, `missingRequired(…, hiddenIds)`, Add/Edit spremanje, `structureExcel` kol. L, `structureImport` (`resolveVisibleWhen`), panel, View, `renameVisibleWhenSlug`, `plan.ts`, `retype.ts` | unit `visibleWhen` 53, E2E `S187_visible_when` (stara forma pada 2/2), 15 E2E regresije |
| Analiza snage | `data-prep_tools/Trening/analiza_snage.py`, `vjezbe_prijedlog.json` | Excel u `Claude-temp_R/s187/` (gitignored, DIARY privatan) |

Pravila su u CLAUDE.md (§ Model / atributi: `visible_when`; § UI: „Polje s `default_value` se prikazuje").

## Za S188 — korak 4
- **Prvo pročitaj Sašin ispravljeni Excel** (stupci A–D lista `Vjezbe`, `Mjesta` A) i prenesi odluke u
  `vjezbe_prijedlog.json` (to je izvor za katalog u koraku 5) — Excel je radni stol, JSON ide u git.
- Format serija: izmjereno — piramide ponavljanja 183 dana, težina 76; kružni blokovi `N×(…)` 235 dana;
  `mm:ss` 324 (nakon skidanja vremena dana s početka retka). Prijedlog prije koda: jedan event po vježbi (leaf
  `Dio`?) s `serije`/`ponavljanja`/`kg` — ili tekst po seriji — i kako izgleda blok. Odluku upisati u
  `TRENING_MIGRACIJA.md` (tablica „Koraci", red 4) **prije** koda.
- `analiza_snage.py --termini` ispisuje sirove termine; `pravila.py` je jedino mjesto za parsere DIARY teksta —
  raspisivač notacije (korak 9) ide ondje, ne u novi file.

## Kasnije — A4 „merge into" (spec `PREUREDJIVANJE_SPEC.md` §25, §27) — nepromijenjeno iz S186
- Planer `planMerge` uz `retype.ts`; SQL `061` `rpc_restructure_merge` (isti zapis, povrat 058); „Delete source"
  = nova vrsta zapisa ⇒ grana u `_restructure_current` **i** `_restructure_write_config`; `previewAttrSteps` za
  `merge` danas `unsupported`. E2E obrazac `S186_attr_restructure`.

## Otvoreno / zapamti
- T-S187-2 ⬜ (ručni, TEST). Saši je `dev:prod` ugašen u S187 (radi E2E) — E2E global-setup staje ako :5173 služi PROD.
- `visible_when` za tekst ne proširuje `depends_on` (Financije ostaju na starom); dijete `depends_on` roditelja
  neobaveznog i dalje može sakriti obavezno polje (stara rupa, zapisana u CLAUDE.md).
- `TextOptions` i `DateMap` dijele na golom `|`; `VisibleWhen` dijeli na „ | " s razmacima.
- Deploy F2 + S187 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije).
  S187 sam ne traži migraciju, ali mijenja Fitness formu (7 polja s defaultom postaju vidljiva) — Saša je to vidio.
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša; model dana DIARY (280 dana s više Garmin treninga).
