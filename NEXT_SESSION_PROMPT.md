# Next session — handoff

**Pisano protiv commita `1c7af7b`** (`test-branch` = S123, 2026-08-31; `main` je i
dalje na `5533420`). Ako `git log` pokazuje nešto novije, čitaj ovo kao **povijest**,
ne kao stanje. Trajna pravila su u `CLAUDE.md` — ovdje je samo ono što je **u letu**.

---

# DIO 1 — netehnički (za Sašu)

## Najvažnija rečenica

**Ništa od jučerašnjeg posla još nije kod Koke.** PROD je na starom kodu, i to je
namjerno — jedan dio (sekcija „planirano") bi joj kao prvu stvar pokazao razliku
od **986,28 €** koju nitko ne može zatvoriti.

## Što je napravljeno

**Za Kokin roundtrip:**
- Export modal sada **sam odabere profil** — ne mora se sjetiti kliknuti
- `row_hash` se **smije sakriti** kroz profil (`Delete?` nikad — to je okidač
  brisanja), a njegovo zaglavlje ima bilješku koja objašnjava čemu služi
- **delta sheet je uzimao krivi račun** kad je profil govorio jedno a panel drugo:
  izlazio je file s točnim sidrom i **nula redaka**, što izgleda kao savršeno
  usklađen račun. Popravljeno.
- **sekcija „planirano"** u delta sheetu (tvoja ideja): ispod praznih redaka,
  odvojena praznim retkom, s vlastitom kontrolom `Σ planirano / naplaćeno s izvoda
  / razlika`. Potvrda promjenom `Status`a se uvozi natrag.

**Za rad udvoje:**
- **Koka sada smije ispraviti tvoj redak** (`sql/043`). Autorstvo ostaje tvoje, a
  uz redak stoji oznaka **✎** s njenim imenom i vremenom. **Brisati ga ne može.**

## Što čeka tebe

**Redoslijed nije stvar ukusa:**

1. `sql/043` na PROD (SQL editor, kao na TEST-u)
2. **tek onda** merge `test-branch` → `main`
3. Ctrl+Shift+R

Obrnuto (deploy bez migracije) znači da UI otvori Edit, Koka spremi, a baza je
odbije — tiho, i to nakon što je obrisala atribute retka.

⚠ **Ali prije koraka 2 stoji `Datum naplate`** — v. dolje.

Testovi nakon deploya: **T-S123-3…-8** (`docs/sessions/tests/S123_tests.md`).
Od njih je najvažniji **T-S123-7** (sekcija „planirano" nad stvarnim podacima).

## `Datum naplate` — što točno treba

File te čeka: **`data-prep_data/Financije/kosara_20260711_mastercard.xlsx`**
(lijevo app format, desno dijagnostika + gdje redak stoji u Kokinoj Excelici).

Košara 11.07. nosi **73 retka / 2.231,02**, banka je skinula **1.244,74**:

| dijagnoza | redaka | Σ | što s tim |
| --- | --- | --- | --- |
| OK | 40 | 946,48 | ništa |
| **RATA** | 21 | 832,86 | traži plan otplate, ne izvod |
| krivi mjesec ⇒ 11.08. | 11 | 431,10 | `--predlozi` → pregled → uvoz |
| krivi mjesec ⇒ 11.06. | 1 | 20,58 | isto |

⚠ **Ni nakon ispravka se ne zatvara** (946,48 + 832,86 = 1.779,34). Ostatak može
razriješiti samo **`MC_2026-06.pdf`**. Daš li mi njegov ukupni iznos i broj stavki,
mogu odmah izmjeriti koje retke izvod ne pokriva.

⚠ **Tranša 4 se ne uvozi prije ovoga.** Pipeline dedupira po `(datum, iznos)`, pa
bi krivo datirane preskočio — krivi datum preživi, a i košara 11.08. ispadne kraća
točno za njih.

## Otvoreno prema tebi, nije hitno

- **Koka: kad počne upisivati u app, u Excelicu više ne.** Radi li oboje, sve
  dobijemo dvaput, a vidjet ćemo tek kad se saldo raziđe.
- Tvojih 11 redaka od 25.08. nose tvoj email u koloni `User` — kad Koka radi
  roundtrip, oni su za njen račun „tuđi" i **preskaču se**. Njen ispravak tvog
  retka ide kroz UI, ne kroz Excel.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`test-branch` = **`1c7af7b`**, sedam commitova ispred `main` (`5533420`).
Netlify deploya samo `main` — dakle **ništa od S123 nije na PROD-u**.

⚠ **`sql/043` nije pušten na PROD.** Na TEST-u jest, i izmjeren je pokusom.

## Što je S123 napravio

| commit | što |
| --- | --- |
| `57ff33a` | BUG-S123-DELTAACCT — `deriveDeltaAccount()` + upozorenje na praznu sekciju (11 testova) |
| `afad07d` | sekcija „planirano" u delta sheetu (13 testova) |
| `9c295d0` | Export modal zadano bira prvi profil |
| `8afb268` | `row_hash` smije u profil, `Delete?` nikad + bilješka (5 testova) |
| `6ee241e` | `sql/043` + UI: vlasnica smije ispraviti grantee-jev redak |
| `de2f811` | E2E `S123_owner_edits_grantee_row.spec.ts` (2 slučaja) |
| `1c7af7b` | `kosara_naplate.py` |

## Prvo sljedeće (prijedlog reda)

1. **`MC_2026-06.pdf`** — bez njega se `Datum naplate` ne da zatvoriti, a on
   blokira deploy sekcije „planirano".
2. **BUG-S123-EDITMARK** — oznaka ✎ se ne prikazuje u E2E. ⚠ **Izmjeri mrežni
   odgovor** (`page.on('response')` na `events?select=…`) — sadrži li payload
   `edited_by`. Isključeno je: stale bundle (dev server servira aktualan kod) i
   neupisan `edited_by` (T-S123-2 prolazi). **Ne mijenjaj locator opet.**
3. **Rezultati T-S123-3…-8** nakon deploya.
4. `FILTER_SPEC` faza 0 — izbrojati refetch kaskadu (šest `events?select=…` u
   ~500 ms). I dalje neizmjereno tko je okida.

## Zamke potvrđene danas

- **„Import as mine" ne mijenja redak nego forsira INSERT s novim ID-em** —
  duplikat, i to tih (kolizija gleda `user_id`, saldo ne).
- **Edit tok briše pa ponovno upisuje SVE atribute retka** — zato `043` dira tri
  politike. Bez INSERT grane redak ostane bez ijednog atributa, a ekran pokaže
  uspjeh.
- **RLS-blokiran write „uspije" s 200 i praznim rezultatom** — mjeri broj
  promijenjenih redaka, nikad status.
- **Rata nije kupovina** — pravilo naplate se na nju ne smije primijeniti.
- **Uvoz ne popravlja krivo datirane retke** — dedup ih preskoči. Prvo ispravak.
- **Ponovno spremanje profila iz exporta vraća filtar računa u profil** (`Filter`
  list zapisuje efektivni filtar). Isprazni ćeliju prije `Import Profile`.

## Sitno, zabilježeno, nepopravljeno

- Skupna MC naplata **11.07.2026. ima prazan `comment`**, dok ostalih 18 nosi
  `TROŠKOVI UČINJENI MASTERCARD` — izmiče brojanju po opisu
  (`klasificiraj_transu.py`). Jedan `UPDATE`.
- Poruka „(read-only access)" i dalje se prikazuje **write** grantee-u pri
  spremanju Export profila (`ExcelExportModal.tsx:557`).
- `audit_tests.py`: 0 fileova za arhivu, 37 testova koje `PENDING_TESTS` ne
  spominje, 62 označena ⬜ a ne navedena u „Otvoreno". Nije nastalo danas, raste.
- ⚠ **`src/lib/__tests__/structureExcel.test.mjs` je SKRAĆEN i ne parsira se**
  (`SyntaxError: Unexpected end of input`, red 517 — `const row = buildRowsForNode`
  i ništa iza). Nađeno usput 31.08.; file je takav od commita `75ef760` (S17),
  dakle **taj test odavno ne čuva ništa i nitko to nije primijetio** jer se ne
  pokreće u CI-ju. Gore od „testa koji nikad ne pada": ovaj se ne može ni izvršiti.
  Uz to radi s **inline kopijama** logike, pa i popravljen odmah počinje lutati od
  koda — vrijedi ga prepisati kao `deltaAccount.test.mjs` (esbuild transform,
  uvozi pravu funkciju).
