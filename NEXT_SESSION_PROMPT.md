# NEXT SESSION PROMPT — Excel roundtrip: Delete + izvještaj kao radni file

**Zadnja sesija: S107v (2026-08-04, Opus).** Batch 2026 **uvezen u TEST (747 zapisa, čisto)**.
Popravljena tri stvarna buga (brisanje aree, kopirani redak, dijagnostika View-a). Sve odluke za
sljedeći korak su donesene — **kod još nije napisan**.

**Trajni plan prelaska:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Gdje smo stali

2026. je uvezena u TEST i provjerena — 747 zapisa, dan s 13 transakcija daje 13 redaka.
Mehanizam radi.

Usput su iskočila tri kvara i sva tri su popravljena:

1. **Brisanje aree nije radilo.** Uzrok nije bio ono što je izgledalo — Supabase svaki upit
   odsiječe na 1000 redaka i to **ne javi kao grešku**, pa je brisanje obrisalo prvih 1000
   atributa i zapelo na ostatku. Sad se dohvaća po stranicama.
2. **Kopiranje retka u Excelu je uništavalo podatke.** Ako Koka doda transakciju tako da
   kopira postojeći redak, kopija nosi originalov `event_id` — pa se original prepisao, a nova
   transakcija se nije stvorila. Sad kopija postaje **novi zapis**.
3. **View koji se ne otvori** sad kaže *zašto* i nudi „Try again" (prije je svaki kvar
   izgledao kao „aktivnost ne postoji").

## Što slijedi

Excel roundtrip zna dodati i izmijeniti zapis, ali **ne zna obrisati**. To je rupa koja se
osjeti čim netko slučajno napravi kopiju — nema načina da je makne.

Gradi se dvoje:

| korak | što |
| --- | --- |
| 1 | **Kolona `Delete?`** u exportu — odabereš `DELETE` iz padajućeg izbornika, uvezeš, zapis nestane (uz potvrdu i popis što nestaje) |
| 2 | **Izvještaj nakon uvoza** koji se sam skine — i koji je **radni file**, ne popis: u njemu odmah označiš krivu kopiju s `DELETE` i uvezeš ga natrag |

Tvoja ideja iz razgovora, i dobra je: izvještaj izgleda kao obični export, pa se na njemu može
odmah raditi.

## Što još čeka tebe

1. **Red 4997 u Reviewu** (MC 21,88 €) — pitanje za Koku: je li duplikat reda 4247 („Kokin Temu",
   31.12.2025.)? Na izvodima postoji samo **jedna** takva transakcija, a nju već nosi 4247.
2. **Red 4996** (parking 1,60 €) — datum je kriv (stoji 07.08., pripada 04.–08.07.). Reci koji dan.
   ⚠ Kad ga popravimo, **ne** kroz novi batch — dobio bi 09:00 na dan koji je već uvezen.
3. 700 € bankomat 26.11.2025. i `Saldo kontrola` (7 razlika) — i dalje pitanja za Koku.

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje grana

| grana | commit | sadrži |
| --- | --- | --- |
| `test-branch` | `74b52d4` | sve iz S107v |
| `main` (PROD) | `3930c8e` | sve osim fixa za kopirani redak |

`typecheck` + `build` čisti. Radna kopija čista.

**`main` namjerno zaostaje za jedan commit** — fix za kopirani redak nije hitan na PROD-u jer
Koka još ne koristi Excel roundtrip. Ide na `main` zajedno s Delete + izvještajem.

## Stanje TEST baze

- `Financije_all`: **747 zapisa** (2026-01-02 → 2026-07-11), struktura 15 atributa / 2 automatike
- `Financije_2` i `Financije` **obrisane** (bile stare, smetale)
- Ostatak seed podataka netaknut

## Odluke donesene, kod NIJE napisan

### 1. Kolona `Delete?`

- **Dropdown s dvije stavke: prazno i `DELETE`.** Ne `TRUE`/`FALSE` — to koriste obični booleani
  (`Rate?`), a destruktivna zastavica ne smije izgledati kao atribut; `TRUE` je i najvjerojatnija
  stvar koja preživi nepažljivi fill-down.
- **Bilo koja druga vrijednost = greška**, ne tiho ignoriranje. Tiho ignoriranje je način da se
  izgubi brisanje koje je korisnik htio.
- Kolona **vidljiva** (ne collapsed — mora se moći naći), skroz desno uz `row_hash`,
  **crveni conditional formatting** na retku gdje je postavljena.
- Odsutnost kolone (stariji export) = ništa se ne briše — isti princip kao `DisableSavePlus`.
- **Vlastiti guard**, odvojen od update-guarda: popis što nestaje + zasebna kvačica. Brisanje je
  nepovratno pa mora biti barem jednako zaštićeno kao update.
- ⚠ **Parent eventi:** preuzeti logiku iz `AppHome.handleDeleteActivity` (S104, Fable I.1) —
  briše se po `category_id = leaf OR chain_key = leaf`, i lanac ne smije pasti dok nije obrisana
  zadnja leaf serija. Za Financije nije pitanje (leaf je L1, nema roditelja), za Fitness jest.
- ⚠ DV limiti: `promptTitle` ≤32 znaka, `prompt` ≤255 — inače Excel nudi repair.

### 2. `session_start` za kopirani redak

Redak prepoznat kao kopija (dupli `event_id`, već implementirano) **automatski dobiva prvu
slobodnu minutu tog dana**. Koka ne mora znati da `session_start` postoji.

⚠ **NE globalno pravilo „dupli `session_start` = greška".** U Fitnessu više leaf evenata
**namjerno** dijeli isti `session_start` — to je P2 (N serija = jedna aktivnost s N zapisa).
Globalno pravilo bi srušilo Fitness import. Usko pravilo pogađa samo retke koje smo već
prepoznali kao kopije.

### 3. Izvještaj nakon uvoza

Skida se **automatski** nakon Apply. Ključno: **izvještaj JE workbook u formatu exporta**, ne
pasivan log — isti `Events` sheet, pravi `event_id`, ispravan `row_hash`, `Delete?` dropdown već
na njemu. Petlja: uvoz → izvještaj → označiš krivu kopiju `DELETE` → uvezeš **taj isti file**.

Dodatne kolone skroz desno: `Result` (Created/Updated), `Source row` (redak uvoznog filea),
`Changed` (koja polja su se promijenila). Obrisani zapisi se ne mogu izvesti → zaseban
informativni list.

⚠ **Provjeriti u kodu prije gradnje** (ne pretpostaviti): da dodatne kolone desno ne razbiju
`parseLegend`/`parseDataRows` pri ponovnom uvozu. Atributi se mapiraju po slovima kolona iz
LEGEND bloka, pa bi višak desno trebao biti ignoriran — ali to treba potvrditi.

Mora se generirati **nakon** Applya (da `event_id` i `row_hash` budu stvarni) ⇒ ponovni export
tih zapisa iz baze preko `excelDataLoader`/`excelExport` s filtrom po id-evima.

### 4. Redoslijed

`Delete?` + guard **prvo** (bez toga izvještaj nema što ponuditi), pa izvještaj.

## Naučeno ove sesije — ne otkrivati ponovo

- **PostgREST `max-rows = 1000`.** Svaki `select` staje na 1000 redaka **bez greške**. Koristiti
  `fetchAllPaged` / `fetchAllPagedIn` (`src/lib/supabasePaging.ts`) za svaki upit koji mora vratiti
  *sve* retke. `excelDataLoader.ts` i `useActivities` su za to već znali; kaskada brisanja nije.
- **Dijagnoza koja izgleda uvjerljivo nije dokaz.** „Tuđi podaci skriveni RLS-om" je savršeno
  objašnjavalo FK grešku i bilo je **krivo** — oborio ju je panel koji je pokazao da su svi zapisi
  Sašini. Isto s View bugom: četiri uvjerljive hipoteze pale su na podacima.
- **E2E cold start:** prvi test u hladnom pokretanju zna pasti na `selectFilterPath`
  (10 s čekanje na opciju u dropdownu). Nije app bug. Popravak = podići timeout u
  `e2e/fixtures/filter.ts` na 20 s (nije napravljeno, čeka dogovor).
- `Claude-temp_R/` je gitignoriran — test-session dokumenti su **samo lokalni** + na vanjskom
  disku (`Tools/backup_to_external.bat`). Trajni zapis ide u `CLAUDE.md`.

## Otvoreno

- **T-S107v-7 (PROD):** kad se View opet ne otvori nakon Finish — **poslati poruku s ekrana**.
  Sad razlikuje „Couldn't load this activity" (+ tekst greške + Try again) od „Activity not found".
  To je dijagnoza koja dosad nije postojala; uzrok View buga još **nije** nađen.
- **`sql/033_delete_area_cascade.sql` SECTION 2b** — jesu li policyji iz `020_orphan_rls.sql` na
  TEST-u? Nije provjereno; nije hitno otkad je pravi uzrok bio paginacija.
- E2E fixture timeout 10 → 20 s.
- **Sljedeći batchevi:** `--to 2025-12-31`, pa unatrag. Granica **uvijek na danu** — inače se
  `session_start` (09:00 + n) sudari s već uvezenim danom.
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu.
- `T-S107u-2` — `groupAttributes` uzima `Default` s prvog retka grupe (bezopasno, konvergira).
