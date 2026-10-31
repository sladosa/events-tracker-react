> Pisano protiv `147a584` (S190: Excel uvoz i katalog) i commita koji nosi ovaj file (S190 zatvaranje). Ranije u S190: `eea9b97` katalog na TEST-u, `461da7a`/`e808cf5`/`e3d3e68` skica (3 verzije) + odluke, `2da5e9d` unique + kolone + Edit bez vremena, `0f5881e` E2E, `db3445e` izbornik, `105a08d` slike u listi.
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 … S190, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187–S190 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S191) — testovi koraka 5, pa korak 6 (model treninga + prikaz serija)

> **Ukratko (S190):** katalog vježbi je Area na TEST-u, a vježba se bira iz njega (skupine, najčešće u 12 mj,
> kartica, uređivanje) — sve na `test-branch`, prema skici koju je Saša odobrio prije koda.

> **Živi plan je tablica „Koraci" u `docs/TRENING_MIGRACIJA.md`** (koraci 1–13; odluke koraka 5 u
> „Korak 5 — odluke S190"). Ovaj file je samo stanje u letu.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S190), sve na TEST-u
- **Katalog vježbi** je Area `Katalog vježbi` pod tvojim TEST računom: 56 vježbi, polja na engleskom, imena hrvatski.
  „Per hand" i slike dodaješ sam.
- **Nova vježba u katalogu:** slug se predloži iz imena, ispod piše koje slične vježbe već postoje, a postojeći slug
  ne prolazi (ni u formi, ni u Editu, ni Excel uvozom). Nema datuma, vremena ni Event Note.
- **Izbor vježbe u treningu** (probna Area `S190 Trening proba` › Gym):
  - skupine, u skupini 6 najčešćih u zadnjih 12 mjeseci + „Sve";
  - uz skupinu „zadnje prije N d";
  - dodir na vježbu otvara karticu (slike, opis), a tek **Izaberi** je stavlja u polje;
  - **Uredi vježbu** u kartici mijenja katalog na licu mjesta.
- **Za sve Aree:** tekstualno polje raste u nove retke dok pišeš; **📷 N** na retku liste otvara slike ispod retka
  (povlačenje na mobitelu, ‹ › na laptopu); Area može isključiti Event Note.
- **Nije napravljeno:** povlačenje vježbe ⠿ i „+ vježba" u bloku. To je forma serija (korak 6), koja još ne postoji.

## Što treba od tebe — redom
1. **T-S190-1 … T-S190-5** (TEST, `npm run dev`, prvo Ctrl+Shift+R) — koraci su u
   `docs/sessions/tests/S190_tests.md`. Najvažniji je **T-S190-3** (izbor vježbe, na mobitelu). Za T-S190-4 dodaj
   par slika nekoj vježbi kroz Edit kataloga.
2. Obriši svoju probnu vježbu `test` iz kataloga (⋮ → Delete) i onu iz testa (`hand_lat_test`).
3. **Pregledaj skicu View-a** (<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>) — treba prije koraka 6.
4. Kad stigneš: list **Mjesta** u Excelu analize snage.
5. **Studeni krug Financija (bez razvoja):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3 ZABA_2026-10,
   T-S181-3. To je ispit „Financije su dovoljno gotove".
6. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).

## Sljedeće (prijedlog)
Popravci po T-S190, pa **korak 6**: model `Activity1` / `Gym` na TEST-u, forma serija (blok → serija → `red`,
⠿ povlačenje, „+ vježba" otvara izbornik na skupini vježbe iznad), lista po treninzima, View po bloku.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S190)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Katalog na TEST-u | `Trening/katalog.py` (`--apply`, `--obrisi`, `--pravila`, `--proba-trening`); Area `0d81ea2f…`, probna `S190 Trening proba` `e2191f7c…` (vlasnik Saša) | baza izmjerena: 56 zapisa / 227 vrijednosti |
| Pravilo `unique` | `uniqueValue.ts`, `uniqueCheck.ts`, `UniqueHint.tsx`; Add Finish / Edit Save; `findImportUniqueConflicts` (pregled gasi Apply) | unit `uniqueOptionsFrom` 37; E2E `S190_unique_catalog` (sabotaža Add pada) |
| Pravilo `options_from` | `optionsFrom.ts`, `catalogOptions.ts`, `catalogPicker.ts`, `CatalogPickerField.tsx` (u `AttributeInput`) | unit `catalogPicker` 13; E2E `S190_catalog_picker` (sabotaža „dodir bira" pada) |
| Structure kolone `AddNote`, `Unique`, `OptionsFrom` (na kraju) | `structureExcel.ts`, `structureImport.ts` (`resolveCellRule`), panel prenosi (`kept`) | unit; ručno T-S190-5 ⬜ |
| Edit bez vremena, Event Note po Arei | `ActivityHeader` `timeless`; Add/Edit `showNote` (`add_header.note`) | E2E `S190_unique_catalog` Edit |
| Tekst koji raste | `AttributeInput` `AutoGrowTextarea` (link ostaje input); S187 spec `input, textarea` | E2E S187 + e2 + S187_default ✅ (5/5) |
| 📷 N u listi | `useActivities` (`photos`), `ActivitiesTable` (`photoButton`, `openPhotoRows`), `PhotoCarousel` | E2E `S190_unique_catalog` Lista |
| Excel uvoz: vrijednost izvan kataloga | `optionsFromMissesWarning` (pregled + izvještaj, ne zabrana) | — (nije pokriveno testom) |

## Prije deploya / otvoreno
- **Puni E2E run nije vrćen** — vrćeni su S190 (4), S187 (3), e2 i S187_default (5/5 ✅). Tekst je sada
  `<textarea>`: spec koji traži `input` za tekstualni atribut pada iz razloga selektora. Prvi posao S191: puni run.
- Uređivanje kataloga iz kartice: samo **vlasnik** (`canEdit = area.user_id === uid`). Write grantee: izmjeriti
  `rls_probe` za `event_attributes` tuđeg zapisa prije nego se otvori.
- **Preimenovanje sluga u katalogu ne dira treninge** (druga Area) — v. CLAUDE.md; planer nema tu granu.
- `Save +` ne provjerava `unique` (katalog ga gasi) — brana ako ikad Area s `unique` dopusti Save +.
- „+ vježba" za novu vježbu otvara skupinu vježbe iznad — ide uz formu serija (korak 6); danas izbornik otvara
  skupinu trenutne vrijednosti.

## Probne Aree (TEST)
- `S190 Trening proba` (Saša) — za T-S190-3; obrisati kad korak 6 ima pravu Areu.
- `S189 serije proba` (`owner@test.com`) — global-setup je svaki E2E run pokušava obrisati („COULD NOT delete
  leftover area" — 7.936 eventa); obrisati `run.bat Trening\proba_serije.py --obrisi` kad korak 6 krene.

## Kasnije
- **A4 „merge into"** (spec §25, §27): `planMerge` uz `retype.ts`; SQL `061` (uz njega prevesti poruke 058–060).
- Katalog na PROD: app Structure + Activities export Aree `Katalog vježbi` s TEST-a ⇒ uvoz pod Sašom (nakon deploya).

## Otvoreno / zapamti
- Na TEST-u Sašin trening je **`Fitness_Garmin`**; TEST `Fitness` ×2 su demo. Slugovi na TEST-u imaju crticu.
- Deploy F2 + S187–S190 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije).
  S187 mijenja Fitness formu; S188 ime sheeta; S189 popravci izvoza/View/Edit; S190 textarea i 📷 u svim Areama.
- `visible_when` za tekst ne proširuje `depends_on`; `TextOptions`/`DateMap` dijele na golom `|`.
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša.
