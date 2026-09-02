# Sljedeća sesija — handoff

**Pisano protiv commita:** `S125: preview i reklasifikacija su tudji redak jos uvijek zvali NEPOSTOJECIM`
(`00fd87b`, grana `test-branch`). Ako `git log` pokazuje novije, čitaj ovo kao
**povijest** — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

Krenulo je od „gdje je 15 €", završilo s **Excel putem kojim Koka ispravlja tvoj
redak**. To više nije polish nego preduvjet cutovera — sam si rekao: bez roundtripa
ne prelazi na aplikaciju.

| | |
| --- | --- |
| razlika od 15 € | ✅ riješena — KEKS Pay je bio zaveden kao `Visa` |
| RF saldo | **1.920,34** = banka, bez novog sidra |
| `043` na PROD-u | ✅ pušten, radi kroz UI **i** kroz Excel |
| BUG-S123-EDITMARK | ✅ zatvoren — ✎ nije crtao **desktop** raspored |
| tiha kvara nađena | **3**, sva tri iz tvojih pitanja |

## Što čeka tebe

**1. Vrati `Studio Nataši` na `Planiran`.** Ostao je `Izvrsen` iz testa, a nema
pokrića na izvodu — točno ono što smo ujutro proglasili greškom. Izvoz → promjena →
Import kao „Ispravi kao vlasnik Aree". Usput se provjeri da put radi u oba smjera.

**2. Deploy na `main` — svjesno odgođen.** PROD ima migracije `043` i `044`, ali kod
od `c156057` nadalje nije gore. Koka zato **još ne vidi** ni ✎ na desktopu, ni
košaru, ni „Ispravi kao vlasnik Aree". Reci kad želiš.

**3. Deset testova čeka pogled** — `T-S125-1…10`. Nisu neizvedeni nego neprovjereni:
mjerenja nad bazom su prošla, ali ih nitko nije potvrdio u aplikaciji.

**4. ⭐ Pročitaj `docs/KOKA_PRVI_MJESEC.md`** — što je riješeno, što nije, i
redoslijed po **riziku za njeno povjerenje**, ne po tehničkoj težini. Ondje je i
razrađen plan „sumnjiv redak ide u izvještaj o uvozu" (tvoja ideja).

**5. Rečenica koju Koki još nitko nije rekao** (stoji od S124): *kad počne upisivati
u app, u Excelicu više ne.* Radi li oboje, sve dobivamo dvaput.

## Što se pokazalo vrijednim, za ubuduće

**Tri tiha kvara nađena su tvojim pitanjima, nijedan planom.** „Radi li kao UI — edit
da, delete ne?" spriječilo je brisanje koje bi retku pojelo sve atribute a ostavilo
ga u bazi. „Hoće li uvoz raditi kroz 40 praznih redaka?" natjeralo je mjerenje umjesto
pretpostavke. „Ovo je zbunjujuće" otkrilo je da bi Apply napravio duplikat.

**Pogledati isto na dva ekrana** riješilo je bug koji je tri sesije imao krivu
dijagnozu. Uski ekran je pokazivao ✎, široki nije.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` **8 commitova ispred `main`** (`c156057` … `00fd87b`).
  `main` = `bb13153` (S124), deployan.
- **PROD ima `043` i `044`.** `044` dodaje `split.due_slug = datum_naplate` u
  `areas.settings.dashboard` — bez njega je delta sekcija kakva je bila.
- Saša je testirao **lokalno protiv PROD baze** (dev server na `.env.prod.local`).
- Snimke košare 03.09. za usporedbu: scratchpad `prije.json`, `poslije.json`,
  `poslije2.json` (nisu u repou).

## Što je S125 napravio

```
c156057  ✎ na desktop raspored — BUG-S123-EDITMARK zatvoren
e31c53b  delta sekcija = cijela košara (`split.due_slug`, sql/044) + neto Σ
73dbc25  grana "dospijeće otvoreno" iz već učitanih redaka (izvoz je bio stao)
020b29b  stupac `Provjeri`
a69346c  ugašena kvačica delta sheeta objašnjava sebe
90d1a24  brojač događaja u delta načinu ne tvrdi puni izvoz
db3e7c3  excelDataLoader: izvoz pada s porukom umjesto da izađe kraći
1be6952  uvoz: `fix_as_owner` — vlasnik Aree ispravlja tuđi redak
edae267  tuđi redak se NE briše (dva zida) + `importForeignRows.test.mjs`
6db489c  test da uvoz doseže sekciju ispod 40 praznih redaka
00fd87b  preview i reklasifikacija — `canUpdateExisting()`
```

## Testovi

| file | slučajeva |
| --- | --- |
| `src/lib/__tests__/deltaSheetLayout.test.mjs` | 31 |
| `src/lib/__tests__/importForeignRows.test.mjs` | 21 (nov) |
| `src/lib/__tests__/deltaAccount.test.mjs` | 11 |
| `e2e/tests/S123_owner_edits_grantee_row.spec.ts` | 3 (`T-S123-3` nov, mijenja viewport) |

⚠ `importForeignRows` gradi **pravi .xlsx** i parsira ga — pokriva sva tri
`foreignMode`a i delta file s praznim retcima. Ne dira bazu.

## Otvoreno / sljedeće

- ⭐ **P1: sumnjiv redak u izvještaj o uvozu.** Razrada u `docs/KOKA_PRVI_MJESEC.md`.
  Ukratko: `warnStaleUntouched` već zna koji su retci preskočeni a u bazi promijenjeni;
  treba ih dodati u `outcomes` s novim ishodom (`Preskočen — promijenjen nakon izvoza`).
  Izvještaj je **svjež izvoz**, pa ti retci u njemu nose aktualne vrijednosti i
  aktualan `row_hash` ⇒ ona ih ispravi i uveze natrag bez ikakvog trika.
  ⚠ Preduvjet: `BUG-S114-REPORTDD` (izvještaj nema `DropdownData`) — ako izvještaj
  postaje mjesto na kojem ispravlja, mora imati dropdowne.
  ⚠ Ručni izlaz koji VEĆ radi, a nitko ga ne zna: **obriši ćeliju `row_hash`** —
  prazan otisak znači „nije netaknut", pa redak ide u usporedbu s bazom.
- **Merge na `main`** kad Saša kaže. ⚠ `044` je već na PROD-u i stari kod ga
  ignorira, pa nema redoslijednog rizika kao kod `043`.
- **`T-S125-6` nije provjeren nad živim RLS-om** — grana brisanja tuđeg retka
  pokrivena je samo unit testom.
- **Preostali gutači grešaka:** dva upita u `loadSharedEmailsByArea`
  (`excelDataLoader.ts:611,620`), namjerno ostavljena. Ako se ikad pokaže da prazan
  popis emailova nekome smeta, ondje treba **upozorenje**, ne bacanje.
- **Padajući izbornik računa uz ugašenu kvačicu delta sheeta** — Saši ponuđeno,
  nije tražio. Uklonio bi odlazak u Filter panel.
- **Visa nema fiksan dan naplate** (S124 nalaz, i dalje otvoreno): 855 redaka ne pada
  ni u jednu košaru. Sada je to vidljivije jer sekcija radi po dospijeću.
- **185 MC redaka s `Tip = N/A`** — rječnik postoji i može se pustiti preko njih.

## Zamke potvrđene ovom sesijom (detalji u CLAUDE.md)

- **Redak liste renderiraju DVA mjesta** — popravi li se jedno, kvar se vidi samo na
  jednoj širini. Komentar je tvrdio „oba", kod je radio jedno.
- **Isto pravilo na tri mjesta se raziđe** — apply/reklasifikacija/preview. Posljedica
  nije poruka o pravima nego obećan **duplikat**.
- **Brisanje mora prvo provjeriti što smije obrisati**, pa tek onda brisati — inače
  redak izgubi atribute a preživi.
- **`const { data } = await supabase…` je landmina** — palo čitanje se čita kao „nema
  ničega". Šest mjeseci u izvoznom putu.
- **Bilješka u Excelu kod desnog ruba nije čitljiva** — Data Validation input message,
  uz limite 32/255 i pad natrag na bilješku.
