# S107w — `Delete?` kolona + izvještaj nakon uvoza kao radni file

**Datum:** 2026-08-04 · **Grana:** `test-branch` · **Model:** Opus 5

Excel roundtrip je znao dodati i izmijeniti zapis, ali **ne i obrisati**. Rupa se osjeti
čim netko slučajno napravi kopiju retka: kopija postane pravi zapis i nema načina da se makne.
Ova sesija gradi oba koraka iz handoffa (odluke donesene u S107v, kod nije bio napisan).

---

## Što je napravljeno (kod)

### 1. Kolona `Delete?` (`excelExport.ts`)

- Nova kolona **skroz desno, odmah do `row_hash`**, header `Delete?`, **vidljiva** (nikad
  grupirana — zastavicu koju nitko ne nađe nitko ne može ni maknuti)
- Dropdown s jedinom vrijednošću **`DELETE`** + dopuštena prazna ćelija. Namjerno **ne**
  `TRUE`/`FALSE`: to koriste obični booleani (`Rate?`), destruktivna zastavica ne smije
  izgledati kao atribut, a `TRUE` je najvjerojatnija stvar koja preživi nepažljivi fill-down
- Excel odbija drugu vrijednost pri upisu (`showErrorMessage`), a import je odbija i kad
  dođe pasteom ili iz ručno složenog filea
- **Crveni conditional formatting** na cijelom retku gdje je zastavica postavljena
- Kolona je **unutar autofiltera** — inače bi je Excelov sort raspario od retka i brisanje
  bi pogodilo krivi zapis (isti razlog zbog kojeg je `row_hash` unutra)
- Odsutnost kolone (stariji export) = **ništa se ne briše** (isti princip kao `DisableSavePlus`)

### 2. Import (`excelImport.ts`)

- `Delete?` se traži **skeniranjem zaglavlja**, ne po fiksnom slovu ⇒ pozicija se smije mijenjati
- Bilo koja vrijednost osim `DELETE`/prazno = **greška koja prekida uvoz**, s popisom redaka.
  Tiho ignoriranje je način da se izgubi brisanje koje je korisnik htio
- **Redoslijed je bitan:** delete se odvaja **prije** `row_hash` skipa. Otisak pokriva samo
  polja zapisa, pa redak koji je nediran osim zastavice i dalje matcha svoj `row_hash` —
  bez ovog redoslijeda bi ispao kao „unchanged" i brisanje bi nestalo
- **Kopirani redak označen DELETE = greška, ne brisanje.** Kopija nosi originalov `event_id`,
  pa bi se obrisao zapis na koji se poziva drugi (neoznačeni) redak
- Redak bez `event_id` označen DELETE: ništa za brisati **i ne kreira se** (warning)
- `applyDeletes()`: briše samo označene leaf zapise, pa **tek kad ode zadnji zapis sesije**
  ruši i parent lanac (`chain_key` = leaf kategorija) — isto pravilo kao
  `AppHome.handleDeleteActivity` (S104, Fable I.1). Ključevi za lanac dolaze iz **DB redaka
  pročitanih prije brisanja**, ne iz Excel vrijednosti
- Attachmenti se brišu i iz storagea; popis se dohvaća **paginirano** (`fetchAllPagedIn` —
  S107v lekcija: `select` tiho staje na 1000 redaka)
- `DELETE` na `events` ide s `.select('id')` — RLS-blokiran DELETE „uspije" s 0 redaka i to
  se inače ne vidi
- Brisanja se izvršavaju **prije** create/update; greška prekida uvoz prije ijednog upisa

### 3. Delete guard (`ExcelImportModal.tsx`)

- **Zaseban popis i zasebna kvačica**, odvojeni od update-guarda: „da, promijeni" nikad ne
  smije značiti i „da, obriši". Apply je zaključan dok obje potrebne kvačice nisu označene
- Po zapisu: datum, vrijeme, kategorija, komentar, broj atributa, **fotografije**, i oznaka
  „zadnji zapis sesije → parent zapisi idu s njim"

### 4. Izvještaj nakon uvoza (`excelImportReport.ts`, novo)

- Skida se **automatski** nakon Applya
- **Nije log nego radni file**: običan export s točno onim zapisima koje je uvoz dirnuo —
  pravi `event_id`, ispravan `row_hash`, `Delete?` dropdown već na njemu
- Petlja: uvoz → izvještaj → označiš krivu kopiju `DELETE` → uvezeš **taj isti file**
- Tri dodatne kolone skroz desno: `Result`, `Source row`, `Changed`. **Provjereno u kodu
  (ne pretpostavljeno):** `parseDataRows` čita fiksne kolone A–H, kolone iz LEGEND-a i
  `row_hash`/`Delete?` po zaglavlju — sve desno od toga se ignorira
- Generira se **nakon** Applya (da su `event_id` i `row_hash` stvarni) — ponovni export tih
  zapisa iz baze (`loadEventsByIdsForExport`, novo)
- Sheet `ImportReport` (sažetak + upute) i `Deleted` (obrisani zapisi — njih se ne može
  izvesti, postoje samo kao zapis što je otišlo)
- Workbook se **sastavlja u jednom prolazu**, ne učitava-pa-sprema: ExcelJS load/save
  roundtrip ne jamči očuvanje data validationa, CF-a i skrivenog `DropdownData` sheeta —
  a upravo to file čini editabilnim

---

## Programske kontrole (Claude)

| ID | Kontrola | Status |
| --- | --- | --- |
| P-1 | `npm run typecheck` + `npm run build` čisti | ✅ |
| P-2 | E2E `S107w_delete_column.spec.ts` — 3 testa, sve PASS (živa TEST baza) | ✅ |
| P-3 | Regresija: E2, E3, E6 (3), S107_row_hash (3), S104_import_progress (3) — **11/11 PASS** | ✅ |
| P-4 | `S104_delete_bug` pao u batchu pa **prošao sam** — leftover redci iz prekinutog pokušaja (beforeEach inserta bez čišćenja), ne regresija; taj put ova sesija nije dirala | ✅ |
| P-5 | `hasChanges()` uklonjen — apply put sad koristi `computeRowDiff()` izravno (treba mu popis polja za `Changed` kolonu); single source of truth ostaje jedan | ✅ |

---

## E2E testovi (Playwright) — `e2e/tests/S107w_delete_column.spec.ts`

| ID | Test | Status |
| --- | --- | --- |
| T-S107w-1 | ⭐ **Puna petlja:** kopiraj redak → uvoz → izvještaj se skine → u **izvještaju** označi `DELETE` → uvezi ga → guard pokaže 1, Apply **disabled** dok se ne označi kvačica → `Events deleted` = 1 → zapisa **nema u bazi** | ✅ PASS |
| T-S107w-2 | Vrijednost `TRUE` u `Delete?` → **greška**, uvoz se ne otvori (nema Apply gumba) | ✅ PASS |
| T-S107w-3 | Ponovni uvoz **nediranog izvještaja** = no-op (0/0, sve unchanged) ⇒ dokaz da dodatne kolone desno ne lome parsiranje i da `row_hash` skip radi na izvještaju | ✅ PASS |

⚠ **Zamka u testu (plaćena dvaput):** oba testa su isprva koristila isti komentar i isti
`session_start`. Ostatak iz prekinutog pokušaja onda ne izazove grešku nego **koliziju**, Apply
postane „All skipped", ništa se ne kreira i nema izvještaja — što izgleda kao pad featurea.
Sada: poseban komentar + vrijeme po testu + `cleanupTestRows()` koji briše **po prefiksu**
(sve što je spec ikad zapisao), ne po točnom tekstu.

---

## Ručni testovi (Saša) — SVIH 6 ZAVRŠENO 2026-08-12

Vođeno kroz Claude Code, korak po korak. Testovi 4–7 su rađeni na `Financije_all`/`Health_Sasa`
gdje je bilo moguće; T-S107w-8 (parent lanac) je trebao kategoriju s roditeljskom razinom koju
Financije_all nema (L1 leaf, bez roditelja) — kreirana je posve nova scratch Area
(`sql/034_s107w_test_area.sql`: Workout L1 s atributom → Set leaf s atributom) da se ne dira
stvarne podatke. Svih 6 prošlo bez otvorenih nalaza na samoj `Delete?` funkcionalnosti.

Usput otkriveno i popravljeno: (a) UI polish — "(Excel row N)" oznaka u guard listama bila
jedva čitljiva (`text-gray-300`/10px) → `text-gray-500`/11px na oba mjesta u
`ExcelImportModal.tsx`; (b) TEST baza seed-data drift — `e5-structure.spec.ts` T-S107w-4 (Add
Child blocked state) je padao jer je Cardio leaf negdje ranije izgubio svoj seed event; **nije
regresija ovog rada** (S107w kod ne dira Structure add-child logiku) — `e2e/setup/seed.sql`
je idempotentan pa ga je bilo dovoljno ponovo pokrenuti; E5 5/5 PASS nakon toga.

Puni regresijski set (28 testova: E2, E3, E4×3, E5×5, E6×3, E14×2, S104_delete_bug,
S104_parent_event, S104_import_progress, S107_row_hash_guard×3, S107b×2,
S107w_delete_column×3) — **28/28 PASS**. Spreman za PROD kad Saša zatraži deploy.

### T-S107w-4 — Excel izgled `Delete?` kolone

1. Activities → filtriraj bilo što → **Export** → otvori file
2. Skrolaj skroz desno u EVENT DATA: iza zadnjeg atributa je `row_hash` (uska, grupirana),
   pa **`Delete?`**
3. Klikni ćeliju u `Delete?` → mora se pojaviti **padajući izbornik s jednom stavkom `DELETE`**
   + input poruka („Pick DELETE to permanently remove…")
4. Odaberi `DELETE` → **cijeli redak pocrveni**
5. Upiši ručno `da` u drugu ćeliju te kolone → Excel mora **odbiti** upis
   („Only DELETE or empty")

**Fail ako:** kolone nema · dropdown prazan ili nudi TRUE/FALSE · redak ne pocrveni ·
Excel prihvati proizvoljan tekst · Excel pri otvaranju nudi „repair" (⚠ DV `promptTitle` ≤32,
`prompt` ≤255 znakova)

### T-S107w-5 — Sort ne rasparuje zastavicu

1. U izvezenom fileu označi `DELETE` na **jednom** retku (zapamti koji zapis)
2. Sortiraj tablicu po nekoj drugoj koloni (npr. Iznos) preko autofiltera
3. `DELETE` mora ostati **na svom retku** (crveni redak je isti zapis kao prije)
4. Uvezi → guard mora nabrojati **taj** zapis

**Fail ako:** nakon sorta je zastavica na drugom retku (znači da kolona nije u autofilteru)

### T-S107w-6 — Guard: dvije odvojene kvačice

1. U izvezenom fileu **istovremeno**: promijeni komentar jednom retku **i** označi `DELETE`
   drugom
2. Uvoz → moraju biti vidljiva **dva odvojena bloka**: crveni „will be modified" (izmjene) i
   crveni s dvostrukim rubom „will be permanently deleted" (brisanja)
3. Označi **samo** kvačicu za izmjene → Apply **i dalje disabled**
4. Označi i kvačicu za brisanja → Apply se otključa

**Fail ako:** jedna kvačica otključa oboje · brisanja se pojave u listi izmjena · Apply radi
bez ijedne kvačice

### T-S107w-7 — Financije: brisanje jednog zapisa (leaf = L1, nema roditelja)

1. `Financije_all` → Export → u fileu označi `DELETE` na jednom **testnom** retku
   (⚠ ne na pravom Kokinom podatku)
2. Uvoz → guard pokaže datum/kategoriju/komentar + broj atributa
3. Apply → `Events deleted` = 1, zapis nestane iz liste
4. Skinuti izvještaj → sheet **`Deleted`** sadrži taj zapis

**Fail ako:** obrisano više od jednog zapisa · ostali zapisi istog dana nestali
(⚠ to bi bila klasa buga T-BUGG-5)

### T-S107w-8 — Fitness: parent lanac pada tek sa zadnjim zapisom sesije

Financije ovo ne testira (leaf je L1, nema roditelja) — Fitness testira.

1. Fitness → dodaj aktivnost s **2 zapisa** u istoj sesiji (npr. Cardio, dvije serije)
2. Export → označi `DELETE` **samo na jednom** od ta dva retka → uvoz
3. Aktivnost i dalje postoji, ima 1 zapis; **View** radi normalno (parent lanac je živ)
4. Export → označi `DELETE` na preostalom retku → uvoz; guard mora javiti
   „last event of its session → parent records removed too"
5. Aktivnost nestaje u cijelosti

**Fail ako:** korak 2 sruši parent lanac (View puca / atributi roditelja nestanu) ·
korak 4 ostavi siročad parent zapise

### T-S107w-9 — Izvještaj kao radni file (ručna potvrda E2E scenarija)

1. Napravi bilo kakav uvoz (npr. dodaj jedan redak) → izvještaj se **sam skine**
2. Otvori ga: `Events` sheet ima **samo** dirnute zapise; skroz desno `Result`, `Source row`,
   `Changed`; `Delete?` dropdown je na njemu
3. Označi `DELETE` na tom retku → uvezi **taj isti file** → zapis nestane

**Fail ako:** izvještaj se ne skine · sadrži nedirnute zapise · `event_id` je prazan ·
ponovni uvoz javlja grešku formata

---

## Odluke i nalazi ove sesije

1. **Kopirani redak označen DELETE = greška, nije brisanje.** Jedina alternativa bila bi
   pogađati koji od dva retka s istim `event_id` je „pravi" — a cijena krivog pogađanja je
   obrisan tuđi zapis. Poruka govori točno što napraviti (očisti kolonu A na kopiji).
2. **Brisanja idu prije create/update.** Tako se u jednom uvozu smije obrisati zapis i istu
   sesiju ponovo izgraditi drugim retcima. Uz to, pad brisanja zaustavi uvoz **prije** ijednog
   upisa, umjesto da ostavi pola posla.
3. **`Delete?` desno od `row_hash`, ne lijevo** — pozicija `row_hash` kolone ostaje
   nepromijenjena, pa stari kod i stari fileovi ostaju točni.
4. **Izvještaj se ne generira kad nema što prijaviti** (0 kreiranih, 0 promijenjenih,
   0 obrisanih) — prazan file bi bio samo šum.
5. **Progress bar ne pokriva fazu brisanja** (obično par redaka); poruka se mijenja u
   „Preparing import report…" na kraju. Ako se ikad bude brisalo stotine redaka, ovo treba
   dodati u traku.

---

## Otvoreno / nije dirano

- **E2E fixture timeout 10 → 20 s** (`e2e/fixtures/filter.ts`) — cold-start flake iz handoffa,
  i dalje čeka dogovor. Danas se pojavio jednom kao pad `S104_delete_bug` u batchu (prošao
  sam u ponovnom pokretanju).
- **Bulk delete (checkbox) za grantee-a** — i dalje neograničen (stari backlog).
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu.
- T-S107v-1…4, T-S107v-7 (PROD dijagnostika View-a) — nepromijenjeno.
