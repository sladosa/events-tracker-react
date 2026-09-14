# S136 Test Details — ⋮ meni, poruke o pravima, triaža PENDING-a

**Branch:** `test-branch` (commit `e79637d`)
**Baza:** TEST za E2E i ručnu provjeru; `sql/052` je toga dana pušten na PROD
**Preduvjet za T-S136-2:** deploy na `main` (popravak još nije na PROD-u)

---

## T-S136-1 ✅ ⋮ meni se na scroll premješta, ne zatvara

**Što čuva:** `CategoryChainRow` je meni zatvarao na **svaki** `scroll`, uz
`capture: true`. `capture` na `window` hvata scroll iz **svakog** ugniježđenog
spremnika, pa je meni nestajao na pomak koji s njim nema veze — korisnik to vidi
kao „meni mi se sam zatvorio", a tri E2E speca su padala na stavci **unutar**
izbornika.

### Automatski dio (izveden)

1. `npx playwright test e2e/tests/e7-share.spec.ts` → `E7-1` **prolazi**
2. `…/e13-add-between.spec.ts` → `E13-1` **prolazi**
3. `…/e15-revoke-with-events.spec.ts` → **2 prolaze** (prije: 3 pada)

### ⭐ Protuprovjera (obavezna — test koji nikad ne pada ne čuva ništa)

4. `git stash push -- src/components/structure/CategoryChainRow.tsx`
5. Ponovo `e13-add-between.spec.ts`
6. **Expected:** `E13-1` **pada** na `addBetweenBtn` (`expect(locator).toBeVisible()`,
   linija 156) — dakle stavka ⋮ izbornika nestane prije klika
7. `git stash pop`

**Izmjereno 14.09.2026.:** koraci 1–3 zeleni, korak 6 crven. Oba smjera.

### Ručni dio (E2E ga strukturno ne može vidjeti)

Playwright scrolla **programski** i nikad ne provjerava **gdje** meni stoji.

8. `npm run dev` (TEST), Structure tab → **Edit Mode**
9. Klik na ⋮ bilo kojeg retka, pa **zavrti kotačić**
10. **Expected:** meni **prati redak** i ostaje upotrebljiv
11. **Pad:** meni nestane (staro ponašanje) **ili** ostane visjeti na mjestu dok
    redak bježi (znak da premještanje ne hvata pravi scroll spremnik)

**Potvrdio Saša 14.09.2026.:** meni prati redak.

---

## T-S136-2 ⬜ Poruke o export profilima ne lažu write-grantee-u

**Što čuva:** obje poruke (spremanje i brisanje profila) tvrdile su
*„read-only access"* i **write**-grantee-u. Ponašanje je ispravno i ostaje —
profili žive u `areas.settings`, koji je vlasnikov (S134) — ali poruka je
imenovala **krivi razlog**, a to šalje na krivi trag (isti razred kao S135
`42501`: baza je prijavila zabranjen upis umjesto zabranjenog čitanja).

**Preduvjet:** deploy na `main`.

1. Prijavi se kao **write grantee** tuđe Aree (na PROD-u: Saša u `Financije_all`)
2. Activities → Excel Export → pokušaj **spremiti** profil
3. **Expected:** poruka kaže da su profili u postavkama Aree i da ih mijenja
   **samo vlasnik**, uz izričito *„this applies to write access too"*
4. **Pad:** i dalje piše „(read-only access)"
5. Ponovi za **brisanje** profila (druga poruka, `handleDeleteProfile`)
6. **Expected:** `Only the Area owner can delete export profiles`

⚠ Ponašanje se **ne smije** promijeniti: u oba slučaja profil ostaje nespremljen
odnosno neobrisan. Mijenja se samo tekst.

---

## T-S136-3 ⬜ ⭐ Smoke za `is_required` (sažima `T-S131-6..24`)

**Zašto sažeto:** `is_required` je oživljen u S131 i **živ je na PROD-u** — blokira
Kokin Save — a nije provjeren nijednom. Za njega je stajalo **14 ručnih testova**;
četrnaest se neće dogoditi nikad, dva hoće. Ovo je ono što stvarno mora vrijediti.

### Dio 1 — forma blokira

1. Area s obaveznim atributom (Structure → atribut → kvačica „Required")
2. Add Activity → ostavi to polje **prazno** → `Finish`
3. **Expected:** spremanje **blokirano**, polje označeno, poruka imenuje **koje**
   polje fali
4. Upiši vrijednost → `Finish` prolazi

⚠ **`false` i `0` su ODGOVORI, ne izostanak.** Ako je obavezan atribut `boolean`,
odabir „ne" mora **proći**; ako je `number`, nula mora proći. Naivni `if (value)`
bi oboje odbio — to je jedini način da ovaj test nešto ulovi.

### Dio 2 — uvoz NE provjerava

5. Excel uvoz aktivnosti s retkom kojem to polje **nedostaje**
6. **Expected:** redak **prolazi** (povijesni batchevi i `N/A` moraju proći)
7. **Pad:** uvoz odbije redak ⇒ pravilo forme je procurilo u uvoz

---

## T-S136-4 ✅ ⭐ `audit_tests.py` nije vidio slovne sufikse

**Nalaz:** `ID = re.compile(r'T-S[0-9]+[a-z]?-[0-9]+')` ne hvata `T-S129-A7` ni
`T-S129-B5`. Posljedica nije kozmetička: alat je `S129` prijavljivao kao
**„24 → 10 definiranih, svi ✅, spremno za arhivu"**, dok su unutra stajala
**4 otvorena testa**.

1. Prije popravka: `python data-prep_tools/Tools/audit_tests.py` → `S129_tests.md  10  10  0  0  DA`
2. Popravak: regex prima neobavezno slovo (`-[A-Z]?[0-9]+`)
3. Poslije: `S129_tests.md  24  19  3  1` ⇒ **nije** za arhivu

**Izmjereno 14.09.2026.** U `docs/sessions/` je **15** takvih ID-eva, svi iz S129.

⚠ **Guard je ono što je spasilo posao, ne pažnja.** Skripta koja miče sekcije
odbija maknuti onu u kojoj postoji ijedan ⬜ — i baš je ona stala na S129.
Bez nje bi sesija s otvorenim poslom otišla u arhivu **tiho**.

⚠ **Drugi, manji promašaj iz istog posla:** prvi pokušaj guarda tražio je ⬜ **bilo
gdje u sekciji**, pa ga je zapalio moj vlastiti pokazivački tekst koji sadrži znak
⬜ — i `S128` je lažno odbijen. Guard sada gleda **samo tablične retke** (`|`).

---

## T-S136-5 ✅ Izvještaj o uvozu ima `DropdownData` (zatvara `T-S114-5`)

`BUG-S114-REPORTDD` je tvrdio da izvještaj nema `DropdownData`, pa `Tip`/`Podtip`
u njemu nemaju izbornik. Izmjereno da to više ne vrijedi: `buildImportReport` gradi
list kroz `addActivitiesSheetsTo`, koja **bezuvjetno** zove `addDependentDropdowns`.

Sonda nad `addActivitiesSheetsTo`, s anotacijama kakve šalje izvještaj:

```
Listovi: Events | DropdownData [veryHidden] | HelpEvents
  DA  `Tip` ima padajuci izbornik   | type=list "Domacinstvo,Prihodi,Zabava"
  DA  `Podtip` ima ovisan izbornik  | INDIRECT("Dep_tip_"&SUBSTITUTE(J12,…))
  DA  `Result` kolona               | vrijednost=updated
```

⚠ **Ograničenje mjerenja:** sonda gađa **pisač lista**, ne puni `buildImportReport`
(on ide u bazu). Put do baze na dropdowne ne utječe, a `Result` kolona dokazuje da je
riječ o obliku izvještaja — ali file otvoren u Excelu bi to potvrdio bez ograde.
