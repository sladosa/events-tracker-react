> Pisano protiv `c65485e` (S188: statični primjer Move; prije toga `8876660` View panel + Restructure sheetovi na engleskom) + commita koji nosi ovaj file (S188 drugo zatvaranje, 29.10.).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 + S186 + S187 + S188, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187 i S188 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S189) — model treninga, korak 4: format zapisa serija

> **Ukratko (S188):** pravilo vidljivosti je prošlo Sašin ručni test u panelu, formi i Excelu, View panel u
> Structure tabu sada sklapa razine (otvorena samo kliknuta), a sheet `Preuređivanje` se zove
> `Restructure options` i oba Restructure sheeta nose primjere u pravim stupcima.

> **Živi plan je tablica „Koraci" u `docs/TRENING_MIGRACIJA.md`** (koraci 1–10). Ovaj file je samo stanje u letu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S188)
- **T-S187-2 ✅** — „polje vidljivo samo uz vrijednost" radi u panelu, formi i Excelu (tvoj test, 8/8).
- **View panel u Structure tabu:** razine se sklapaju; otvorena je samo razina koju si kliknuo.
- **Restructure sheetovi:** `Preuređivanje` se sada zove **`Restructure options`** (engleski, kao
  `Restructure attributes`); oba imaju ispod uputa sive primjere u pravim stupcima s objašnjenjem.
  Stari sheet s upisanim retkom uvoz više ne preskače tiho, nego to kaže.
- **T-S188-1 i T-S188-2 ✅** (tvoj test, isti dan). Usput: primjeri se uzimaju iz kategorije s ovisnim izbornikom
  (kod tebe `Strength`, 5 primjera s „Move“), a Area bez njega (`Health_Sasa`) dobiva primjer „Move“ iz izmišljene Aree.

## Što treba od tebe — redom
1. **Excel analize snage** `C:\0_Sasa\events-tracker-react\Claude-temp_R\s187\analiza_snage_20261028.xlsx`
   (nepromijenjeno iz S187): list **Vjezbe** žuti stupci A–D, napomene u M; list **Mjesta**; pogledaj
   **Rutine** i **Serije**. Spremi pod istim imenom i javi. Ne treba savršeno.
2. **Odluka za korak 4 — kružni blokovi** (235 dana `4x(leg r.12 + plank)`): treba li aplikacija pamtiti da
   su vježbe bile u istom krugu, ili je dovoljna bilješka? Dogovaramo prije koda.
3. **Studeni krug Financija (bez razvoja, nepromijenjeno):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11.,
   T-S175-3 ZABA_2026-10, T-S181-3. To je ispit „Financije su dovoljno gotove".
4. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).

## Sljedeće (prijedlog)
Korak 4 — format zapisa serija: kako se jedna vježba s piramidom (`12/10/8 × 20/25/30 kg`) i kružni blok
zapisuju u bazi, na temelju tvog ispravljenog Excela. Pa korak 5 (katalog vježbi + izbornik) i 6 (model na TEST-u).
Kasnije (BACKLOG): poruke pregleda preuređivanja na engleski.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S188)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| T-S187-2 | ručni, TEST `Fitness_Garmin` (ne `Fitness`!), slug `strength-type` | baza po koracima `[Upp]` → `[Upp, Low]` → ostao → `{}` |
| View sklapa razine | `CategoryDetailPanel.tsx` (`CategoryContent` stanje, `key = node.id`) | T-S188-1 ✅ (nema automatskog) |
| `Restructure options` + primjeri | `restructure/sheet.ts` (`rowsBeforeHelp`, `restructureExamples`, `legacyRestructureWarning`), `attrSheet.ts` (`attrExamples`), `structureExcel.ts` (`writeHelpAndExamples`, `exampleSourceOf`), `structureImport.ts` §12 | unit `restructureSheet` 51 (sabotaža „ne staje na HELP" pada 4), E2E S179 + S186 ✅, T-S188-2 ✅ |
| Primjeri iz leafa s `depends_on`; statični Move (`restructureStaticMoveExample`, vlastito zaglavlje ispod HELP) | `structureExcel.ts` (`writeRestructureSheet`, `writeHelpAndExamples(extra)`), `sheet.ts` | unit +7, obje sabotaže padaju; T-S188-2 ✅ (`Fitness_Garmin` 5, `Health_Sasa` 4 + blok) |

Pravilo (primjeri ispod `HELP`, `rowsBeforeHelp` jedina kopija) je u CLAUDE.md § Model / atributi (F1).
`PREUREDJIVANJE_SPEC.md` nosi napomenu da su imena u njemu stara.

## Za S189 — korak 4 (nepromijenjeno iz S187)
- **Prvo pročitaj Sašin ispravljeni Excel** (stupci A–D lista `Vjezbe`, `Mjesta` A) i prenesi odluke u
  `data-prep_tools/Trening/vjezbe_prijedlog.json` (izvor za katalog u koraku 5) — Excel je radni stol, JSON u git.
- Format serija: izmjereno — piramide ponavljanja 183 dana, težina 76; kružni blokovi `N×(…)` 235 dana;
  `mm:ss` 324. Prijedlog prije koda: jedan event po vježbi (leaf `Dio`?) s `serije`/`ponavljanja`/`kg` — ili
  tekst po seriji — i kako izgleda blok. Odluku upisati u `TRENING_MIGRACIJA.md` (tablica „Koraci", red 4)
  **prije** koda.
- `analiza_snage.py --termini` ispisuje sirove termine; `pravila.py` je jedino mjesto za parsere DIARY teksta.

## Kasnije
- **Poruke planera na engleski** — BACKLOG (S188): `plan.ts` ~30 poruka + `show()` `(prazno)`, `apply.ts`,
  tvrdnje u `restructurePlan.test.mjs`.
- **A4 „merge into"** (spec §25, §27): `planMerge` uz `retype.ts`; SQL `061`; „Delete source" = nova vrsta
  zapisa ⇒ grana u `_restructure_current` **i** `_restructure_write_config`. Help sheeta već kaže „not available yet".

## Otvoreno / zapamti
- Na TEST-u Sašin trening je **`Fitness_Garmin`**; TEST `Fitness` ×2 su demo
  (`owner@test.com`, `+template`). Slugovi na TEST-u imaju crticu (`strength-type`, `weight-info`).
- Deploy F2 + S187 + S188 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff`
  poslije). S187 mijenja Fitness formu (7 polja s defaultom vidljiva); S188 mijenja ime sheeta — PROD export do
  deploya nosi `Preuređivanje`, koji novi uvoz ne čita (javi upozorenje).
- `visible_when` za tekst ne proširuje `depends_on`; `TextOptions`/`DateMap` dijele na golom `|`.
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša; model dana DIARY (280 dana s više Garmin treninga).
