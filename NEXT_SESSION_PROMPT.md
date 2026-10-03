> Pisano protiv commita **S159** na `test-branch`; **`main` = `c4747fa` (deploy S159, 03.10.)** — sve iz S159 je na PROD-u, T-S159-1 ✅ 03.10. — svih 8 testova S159 zatvoreno i arhivirano.
> ⚠ Ako `git log` pokazuje noviji commit od S159, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S159 (2026-10-02/03)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S159 (ne-Financije backlog)

- **Filtar za brojeve:** `Filter by` → brojčani atribut (npr. `Isplata`) → operator `>` `≥` `<` `≤` `=`
  i broj. Desno piše kako je broj pročitan. ⚠ `1.000` = **jedan** (piši `1000`). Radi i u
  Excel izvozu, profilu i shortcutu.
- **Help zna u kojoj si Arei** — u Fitnessu više ne bi trebao objašnjavati saldo kao da ga ondje ima
  (provjerljivo tek nakon deploya).
- **Lista ne pokazuje `—` dok se iznosi učitavaju** (sivo pulsira), i ne gubi iznose nakon više
  „Load more".
- **Manje nepotrebnih upita:** početni ekran više ne broji evente za Structure; promjena Aree
  pita listu 2× umjesto 3× (i više ne pokaže na trenutak retke s datumima prošle Aree).
- **Grantee poruke:** „Import as mine" je ugašen za retke dijeljene Aree (pravio bi duplikate);
  tuđi redak označen `Delete?` sada jasno kaže da se ne može obrisati.
- **Iz testiranja 03.10. (Saša na TEST-u, 7/8 testova ✅):** `⚡ Use` radi i na `All Categories`
  kad je leaf samo jedan; „Loading..." dok se lista mijenja; F5 više ne pita za retke SVIH Area
  (6 → 2 upita); vlasništvo tuđih redaka pri uvozu po `event_id`, ne po imenu Aree.
- **D3 pokus (slanje podataka drugome):** jedan Activities file prenosi cijelu Areu **savršeno** ako
  je primatelj nema. Ako ima **istoimenu Areu drukčije strukture** — atributi kojih nema **tiho
  nestanu** (29 od 43 vrijednosti, bez upozorenja). Tvoj prijedlog opcija je zapisan u backlog (D3).

## Što treba od tebe

1. **Merge je napravljen 03.10.** (`c4747fa`). Ostaje
   **T-S159-1** na PROD-u: Help u Fitnessu prvo kaže da ondje nema salda. Koka: zatvori/otvori karticu.
2. Financije — nepromijenjeno od S158:
   - **~05.–07.10. Visa izvod za rujan** — javi kad stigne (sesija za Visa buduće rate).
     Naknadu `0,17` na RF-u upiši kao `Bankovni troškovi`, opis `Naknada`.
   - **11.10. Koka u traci:** iznos i dan s ekrana banke; ako je 1.189,34 → ✓ → Potvrdi
     (prije toga zatvori/otvori karticu). T-S158-1 = T-S156-6.
   - **Kad stigne ZABA izvod** — `FINANCIJE_PROCES.md` §5 „ZABA"; T-S156-7 i T-S158-5.
   - Obrađeni PDF u OneDriveu → podmapa `Obrađeno` (prijedlog T25, vaša odluka).

## Što je još otvoreno izvan Financija (backlog)

**Novo iz S159:** spec „uvoz tuđeg filea u istoimenu Areu" (D3 nalaz, prije koda — tvoja
odluka o opcijama); popravak zapamćenog filtra između korisnika (v. DIO 2).
B4+F7 (Structure panel: „Discard changes?" + sklopive kartice), K-1 (Structure uvoz javlja
brisanje opcija s retcima, staje na file tuđe Aree), F5 (`Dashboard`/`ExportProfiles` sheet),
help chip „What can I do here?", D3 (Area kao predložak), filtar za datum/da-ne.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `e8afdac` (deploy S157). `test-branch` = S158 (alati/docs) + **S159 (app)**. Nema
migracije. TEST = kopija PROD-a od **01.10.** (prije S158 uvoza) — za test nad današnjim
stanjem: `backup_db.py --env test` → `prod_to_test.py --apply`.

## Novo u S159

- `src/lib/helpContext.ts` (`describeAreaForHelp`) → `HelpPanel` šalje `areaName` + `areaFacts`;
  `help.ts` ih piše u system prompt.
- `src/lib/attrFilterNumeric.ts` — `NumericOp`, `numericFilterValue`, ASCII oblik za profil.
  `attrFilter.op` u `AttrFilterState` i svim inline tipovima; `eventQueryBuilder`
  (`isAttrFilterActive` odbija nepročitan broj, join bira `value_number`). Profil:
  `parseAttrFilterRaw`/`formatAttrFilterDesc` u `ExcelExportModal`.
- `useStructureData({ autoFetch })`; `AppHome` ga zove s `false`.
- `useListColumnValues`: `loaded` izveden iz potpisa ulaza, `failed`, paginacija;
  `ActivitiesTable`: `FailedCell` (`?`).
- `ActivitiesTable` → `useActivities` bez datuma kad je `periodKey === 'all-time'` (C4);
  `useActivities` sort ima `.order('id')` na kraju.
- `ExcelImportModal`: `sharedForeignArea` gasi `import_as_mine`; `excelImport.ts`: tuđi redak s
  `_delete` (osim `fix_as_owner`) ⇒ upozorenje + preskok.
- Test: `src/lib/__tests__/attrFilterNumeric.test.mjs`. Specovi: E12-4 (`exact: true`),
  T-S119-6 (prihvaća „Nothing to import").

## Otvoreno / neverificirano

- **Zapamćeni filtar nije vezan uz KORISNIKA** (nađeno 03.10.): `dbScopedKey` nosi bazu, ne
  korisnika ⇒ prijava drugog računa u istom pregledniku obnovi tuđi `areaId` ⇒ žuta traka
  „Nisam uspio učitati postavke" i prazan Structure. Prijedlog: `userId` u spremljenom stanju,
  pri obnovi tuđi odbaciti. Nije napravljeno (Saša još nije odlučio); isti razred kao `et_activity_draft`.
- **D3 spec**: nalazi i opcije u `docs/sessions/BACKLOG.md` § D3. Minimalni korak koji vrijedi
  uvijek: pregled uvoza mora nabrojati atribute iz filea kojih Area nema.

- **E12-2 pada na podacima TEST-a** (Health predložak već kopiran — dva `Health_Sasa`). Nije
  app. Ili očistiti kopiju na TEST-u ili spec učiniti neovisnim o stanju.
- C4 ostatak: promjena Aree čita `categories` 7× i `areas` 4× (izmjereno usput, uzrok ne).
- Fan-out ostatak: u Sunburst načinu na desktopu rade dvije instance `useStructureData`.
- Structure Export: `refetchStructure()` na grešci vraća `[]` ⇒ file bez Area **bez poruke**
  (razred „izvoz koji ne može učitati mora pasti") — zapaženo, nije dirano.
- Financije (iz S158, nepromijenjeno): T24 higijena (38 MC rata bez `Rate?`/`Rata br`,
  `rate_alat --only a` nudi 91 ispravak), T-S158-2 (generirane MC rate u studenom), Visa
  listopad (12 redaka 03.10. + 20 na 05.10.), `DOSPJELO_SPEC` Visa `text` zastario, 2 stara MC
  plana iz 2025.
- Daljnji koraci Financija (prijedlog iz S158, čeka): Visa buduće rate uz rujanski izvod;
  `mjesec.py` (samo čita, kaže što je sljedeće); `obradi_izvod.py` (test: rujanski MC = 17 novih,
  5 ispravaka, 1 duplikat); app T12/T22/Visa u traku.
