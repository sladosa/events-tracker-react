> Pisano protiv `a0efbf9` (S191: redoslijed slika) i commita koji nosi ovaj file (S191 zatvaranje). Ranije u S191:
> `a5253bf` katalog (Name/Group/rotacija/rolanje) + odluke, `9ed4c29`…`ec59dae` popravci Viewa i „slično", `0721abd` slike iz kartice + `eventPhotos.ts`.
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 … S191, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187–S191 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S192) — preostali testovi koraka 5, Gibljivost, pa korak 6

> **Ukratko (S191):** Saša je prošao T-S190-1..4 (mobitel kroz F12) i usput našao pet sitnica koje su popravljene, a
> slike se sada dodaju i iz kartice vježbe, kroz jednu funkciju za Add, Edit i katalog.

> **Živi plan je tablica „Koraci" u `docs/TRENING_MIGRACIJA.md`** (odluke koraka 5 u „Korak 5 — odluke S190" i
> „Katalog i gibljivost — odluke S191"). Ovaj file je samo stanje u letu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S191), sve na TEST-u
- Tvoji testovi T-S190-1..4 i T-S191-1..4 su prošli.
- **Katalog:** Name je iznad Sluga, Group je obavezan; Istezanje i Rotacija kralježnice (bivša „Mobilnost") su u Core;
  Rolanje više nije vježba nego vrsta bloka „Oporavak" (uz korak 6).
- **View:** dug opis se prelama; katalog nema datum; slika se otvara u pregledniku slika kao u Editu, a povlačenje po
  slici lista slike (ne skače na drugu vježbu).
- **„Slično u kategoriji"** gleda samo ime i slug — ne vrstu, skupinu ni opis.
- **Slikaj spravu iz kartice:** izbornik → kartica → Uredi vježbu → „Add" (stražnja kamera na mobitelu) → Spremi.
- Ako se slika ne spremi, app to sada **kaže** (prije je šutio — i u Addu i u Editu). Slike su svugdje redom kojim su dodane.
- Puni automatski test: 102/103, a jedini pad je bio stvaran kvar (redoslijed slika) i popravljen je.

## Što treba od tebe — redom (kad stigneš)
1. **T-S191-5** (2 min, laptop): katalog → ⋮ → Edit `lat_raises` ⇒ „Slično" su samo leg_raises i calf_raises.
2. **T-S191-6** (pravi mobitel: `npm run dev -- --host`, pa na mobitelu `http://192.168.1.8:5173`): slika sprave iz
   kartice, brisanje ✕; usput slika u Addu i Editu bilo koje Aree. Pazi pojavljuje li se ✕ na sličici na dodir.
3. **T-S190-5:** Structure export kataloga i `S190 Trening proba` — nove kolone; nepromijenjen uvoz = 0 promjena.
4. **Gibljivost:** `npm run dev:prod` → filtar `Health_Sasa` → Structure → **Export** → file u `Claude-temp_R\`. Ja dodam
   `Gibljivost` (3 testa, 5 brojki u cm), ti uvezeš i izmjeriš prvi put.
5. Pospremi probne vježbe ako su ostale (`hand_lat_test`, `lat_raises_test`, stara `test`).
6. Skica View-a (<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>) — treba prije koraka 6.
7. **Studeni krug Financija (bez razvoja):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3 ZABA_2026-10,
   T-S181-3. To je ispit „Financije su dovoljno gotove".

## Sljedeće (prijedlog)
Popravci po T-S191-5/6, Gibljivost na PROD, pa **korak 6**: model `Activity1` / `Gym` na TEST-u, forma serija
(blok → serija → `red`, ⠿ povlačenje, „+ vježba"), vrsta bloka `Oporavak`, lista po treninzima, View po bloku.
Uz korak 6: „vidljivo kad fali" (vježba bez opisa/slike) u kartici i popis nepotpunih vježbi.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S191)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Katalog: ATTRS (Name prvi, Group obavezan), JSON (istezanje, rotacija_kicme, rolanje `Oporavak`) | `Trening/katalog.py` (`--pravila` suho/`--apply`, `S191_ZAPISI` mijenja samo zatečeno staro), `vjezbe_prijedlog.json` | TEST: drugi suhi prolaz 0 promjena |
| View: dug tekst ispod naziva; bez datuma za Areu bez vremena; `PhotoLightbox` | `ViewDetailsPage.tsx`, `timelessArea.ts` (`isTimelessArea` i za Edit) | T-S191-1, -3, -4 ✅ |
| Povlačenje stranice ne hvata `[data-no-page-swipe]` (preglednik, `PhotoCarousel`) | `useTouchSwipe.ts` | T-S191-4 2. krug ✅ |
| „Slično": ključ + `unique.from` polje (bez izbornika i opisa) | `uniqueValue.ts` (`similarityInputs`, `isFreeTextRule`), `UniqueHint.tsx` | unit 43 (sabotaža pada); T-S191-2 ✅ |
| **`eventPhotos.ts`** — jedini upload/brisanje slike; Add, Edit, kartica (`saveCatalogPhotos`) | `AddActivityPage`, `EditActivityPage`, `catalogOptions.ts`, `CatalogPickerField.tsx` | unit `eventPhotos` 17; E2E `S191_event_photos`, `S190_catalog_picker` kartica (sabotaže padaju) |
| Slike `order(created_at, id)` na 4 čitanja | `useActivities`, `catalogOptions`, `activityViewCache`, `EditActivityPage` | puni E2E pad `S190 Lista` 1/2 ⇒ 5/5 |

## Otvoreno / zapamti
- **Puni E2E 102/103** prije popravka redoslijeda; poslije su vrćeni samo specovi sa slikama (9/9). Jednom viđen pad
  `S190_catalog_picker` „kartica" u paralelnoj trojci (uz `deleteAreaCascade … 409 attribute_definitions` u logu,
  možda od drugog speca) — nije ponovljen u 13 pokretanja; artefakt prebrisan. Ako se vrati: uhvatiti `error-context.md`.
- ✕ na sličici (`PhotoGallery`, `opacity-0 group-hover`) je pisan za miš — na dodiru provjeriti (T-S191-6 korak 5).
- Brisanje cijelog eventa (Edit „obriši event", uvoz, Structure) briše `event_attachments` svojim putem, ne kroz
  `eventPhotos.ts`; Edit pritom ne briše datoteke iz Storagea (staro, nedirnuto).
- Gibljivost: file za PROD uvoz iz **PROD** exporta `Health_Sasa` (Claude ne čita PROD) — dodati L1 leaf `Gibljivost`,
  5 `number` atributa (rame L/D, pretklon, gležanj L/D; cm; postupak u opisu), ništa drugo u fileu ne mijenjati.
- Katalog na TEST-u ima 55 vježbi (+ Sašine probne). Na PROD ide app exportom nakon deploya.
- Iz S190 i dalje: uređivanje kataloga iz kartice samo **vlasnik**; preimenovanje sluga u katalogu ne dira treninge;
  `Save +` ne provjerava `unique`; probne Aree `S190 Trening proba` (Saša) i `S189 serije proba` (E2E račun,
  `proba_serije.py --obrisi`) brisati kad korak 6 ima pravu Areu.
- Deploy F2 + S187–S191 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije).
- Kasnije: A4 „merge into" (`061`, uz prijevod poruka 058–060); slika po vrijednosti opcije (BACKLOG, poslije koraka 6).
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒ PROD
  mjerenja pokreće Saša.
