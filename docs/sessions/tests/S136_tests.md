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

---

## T-S136-6 ⭐ Shortcutovi se prikazivali dvaput, jednom pod „Nepoznata Area"

**Prijavio Saša s PROD-a 14.09.2026.** U `Shortcuts` dropdownu isti shortcutovi
stoje **dva puta**: jednom u grupi „Nepoznata Area", jednom pod pravim imenom Aree.
Klik na oba vodi na isto mjesto.

### ⚠ Prvo je izmjereno da NIJE podatak

Sonda nad PROD-om (read-only, service ključ):

```
activity_presets : 7 redaka
mrtav area_id    : 0
area_id = NULL   : 0
istih imena      : 0
```

Svaki preset se razrješava u postojeću Areu. **A brojke u dupliciranim grupama bile
su starije od baze** — `Strength 139× · 11.09.` na ekranu prema `140 · 14.09.` u
bazi, `Financije 6× · 12.09.` prema `9 · 14.09.` ⇒ ono što se vidi je **otisak
ranijeg rendera**, ne drugi redak.

### Uzrok — dvoje u istom `<select>`u

1. `<optgroup key={group.label}>` — key je bio **label**. Label se mijenja čim
   `areas` stigne, a promjena keya je za React **drugi element**: stari se odmontira,
   novi montira. Dok je nativni `<select>` **otvoren**, preglednik popup crta iz
   DOM-a zatečenog pri otvaranju ⇒ vide se obje generacije.
2. „Nepoznata Area" se izgovaralo i **dok `areas` još nije učitan** — tvrdnja o
   podatku kojeg nema. Isti razred kao „neuspjelo čitanje nije nema ničega" (S121).

### Koraci (traži deploy)

1. Filter panel → otvori `Shortcuts` dropdown **odmah** nakon učitavanja stranice
   (dok `areas` još stiže — dakle bez čekanja)
2. **Expected:** svaka grupa se pojavi **jednom**; dok `areas` traje label je
   `Učitavanje…`, poslije pravo ime Aree
3. **Pad:** grupe se dupliciraju, ili piše „Nepoznata Area" nad Areom koja postoji

⚠ Ponovljivost ovisi o brzini mreže — kvar se vidi kad se dropdown otvori **prije**
nego `areas` dođe. Na brzoj vezi treba throttle (DevTools → Network → Slow 3G).

---

## T-S136-7 ⚠ NALAZ: poruka o greški u Export modalu je izvan vidljivog dijela

**Nije popravljeno.** Gumb „Import Profile" je u sekciji *Export Profile*
(~redak 898 JSX-a), a error banner se crta **tek na ~1105** — ispod „Records per
file". U skrolanom modalu poruka padne izvan ekrana, pa radnja izgleda kao da
**nije napravila ništa**.

Izmjereno 14.09.: Saša je prijavio *„na OK nestane izbornik ali profil nije dodan
i nema poruka o tome"*. Poruka je bila ondje — trebalo je skrolati do dna.

⚠ Razred je „tihi neuspjeh", isti zbog kojeg je u S134 uveden `assertWrote()`:
**povratna informacija koju nitko ne vidi jednaka je onoj koje nema.**

**Popravak (predložen, nije izveden):** banner uz sekciju koja ga izazove, ili
scroll-to-error. ⚠ Ne rješava se toastom — poruka je dugačka i objašnjava pravilo,
a toast nestane prije nego se pročita.

---

## T-S136-8 `sharedContext` u dep listi oba profila

`handleImportProfile` (`:784`) i `handleDeleteProfile` (`:816`) čitaju
`sharedContext` u guardu, a nisu ga imali u dependency arrayu ⇒ callback nosi
vrijednost iz rendera u kojem su se zadnji put mijenjale **ostale** ovisnosti.

⚠ **Promašen guard ovdje ne daje grešku:** RLS-blokiran UPDATE nad `areas` vraća
**200 i nula redaka**, pa bi app javio „Profile saved" nad upisom kojeg nema
(CLAUDE.md: „RLS-blokiran write uspije s 200 i praznim rezultatom").

1. Kao **write grantee** otvori Export modal **prije** nego se share razriješi
   (odmah nakon učitavanja), pa pokušaj spremiti profil
2. **Expected:** poruka o vlasniku Aree; profila nema ni nakon reopena modala
3. **Pad:** toast „Profile saved", a profil nakon reopena **nije** ondje

⚠ **Ostaje neizvedeno:** `assertWrote()` na tom UPDATE-u. Dep lista sprječava da
guard promaši, ali ne štiti od bilo kojeg drugog puta do istog upisa.

---

## T-S136-9 ⭐ Skrivena polja se IMENUJU, i ime je klikabilno

**Sašino pitanje koje je ovo pokrenulo (14.09.):** *„što ako hoću otvoriti i
mijenjati default vrijednost — moram Show all a ni ne znam što je unutra"*.

Mehanizme smo razdvojili u **modelu** (S117 pa S131), ali ne u **UI-ju**: sažeta
linija je bila puki brojač (`1 field hidden`) koji zbraja dva razloga u jedan broj.
Brojka je nastala baš iz tog spajanja — dva razloga nose različitu količinu
informacije:

| razlog | što se može pokazati |
| --- | --- |
| *na defaultu* | polje **ima** vrijednost i ta je vrijednost cijeli odgovor; kratka je po definiciji |
| `hidden_in_add` | **ništa** — vrijednost je prazna jer tako treba biti; vrijedi samo ime |

### Koraci

1. Add Activity → `Fitness > Activity > Gym > Strength`
2. **Expected:** ispod atributa stoji `▸ na defaultu  [Strength_type = Core]`, a ne
   `1 field hidden`
3. Add Activity → `Financije_all > Transakcija`
4. **Expected:** `▸ prazna po pravilu  [Valuta] [Izvod opis]`
5. Klikni **ime** (`Strength_type = Core`)
6. **Expected:** otvori se **samo to** polje, s oznakom *skriveno*; ostala ostaju
   skrivena; pojavi se `Hide again`
7. Klikni `Hide again`
8. **Expected:** polje se vrati u sažetu liniju

### Što se NE smije dogoditi

- ⚠ Linija **ne smije** nabrajati `depends_on`-skrivena polja — „Show all" ih ne
  otkriva, pa bi ih imenovanje obećalo. Kontrola: u `Financije_all` se u liniji ne
  smije pojaviti `Stanje` (skriveno na **oba** načina), ni `Podtip`/`Status`
  (čekaju roditelja).
- ⚠ `Hide again` se mora pojaviti **i** kad su polja otkrivena samo pojedinačno.
  Inače gornji blok nestane (nema više skrivenih), a s njim i jedini put natrag —
  polje bi ostalo otvoreno do kraja sesije bez ičega što kaže kako ga vratiti.
- ⚠ Pojedinačno otkriveno polje nosi oznaku *skriveno* kao i ono iz „Show all".
  Bez nje izgleda kao da je oduvijek bilo na ekranu, pa `Hide again` odnese nešto
  što korisnik ne očekuje da će nestati.

### Odbačeno

**Dva odvojena „Show all" prekidača** (jedan po razlogu) — Sašina odluka: linija s
imenom već rješava otkrivost, a svaki dodatni prekidač je nova stvar koju treba
naučiti. Dodaje se tek ako se pokaže da smeta.
