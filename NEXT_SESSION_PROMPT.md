# Sljedeća sesija — handoff

**Pisano protiv commita:** `1274929` + nespremljene izmjene S135 (idu istim commitom).
`main` = `5d58c05`. Ako `git log` pokazuje novije, čitaj ovo kao povijest;
CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

Odluka s početka dana — **ne deployati, nego prvo testirati** — pokazala se
ispravnom iz razloga koji se tada nije mogao znati: puni E2E je otkrio kvar u
jučerašnjoj migraciji.

| | stanje |
| --- | --- |
| Popravak modala provjeren uživo (selekcija ne gubi rad) | ✅ oba smjera |
| Guard stvarno zaustavlja E2E kad na :5173 stoji PROD | ✅ pravim runom |
| Structure tab na PROD-u piše stvaran broj eventa | ✅ `5173 events` |
| Structure se otvara brzo i kao grantee | ✅ ispod 3 s |
| **Kvar u `sql/047` nađen i popravljen** | ✅ `052`, **samo na TEST-u** |
| Četiri testa vraćena u život tim popravkom | ✅ |
| 22 „pada" u E2E razvrstano | ✅ pola je bila lažna uzbuna |

## Ono što je zapravo bila poanta dana

Jučerašnja migracija `047` postavila je pravilo: *„smiješ vidjeti Areu ako je
**nađeš u tablici** i piše da je tvoja."* Zvuči točno, ali dok se redak tek
upisuje, njega u tablici **još nema** — pa ga pravilo ne nađe.

Smeta samo kad se traži *„upiši ovo **i vrati mi natrag** što si upisao"*. Tada
baza mora odmah pročitati novi redak, ne smije, i **poništi cijeli upis** uz
poruku *„nemaš pravo upisati"*. To je neistina: upis si smio, čitanje natrag nisi.

⚠ **Produkcija nije bila pokvarena** — provjereno da aplikacija nigdje ne traži
Areu natrag kad je stvara. Mina je bila postavljena, nitko nije stao na nju.

I jedna stvar koja se ponavlja: **instrument kojim smo jučer dokazali da je `047`
ispravan bio je slijep točno ondje gdje je `047` pogriješio** — sonda nije imala
`areas INSERT`. Kvar su našla tri E2E testa. Sonda je sada dopunjena.

## Što tebe čeka — redoslijedom

1. **`sql/052` na PROD**, sa sondom prije i poslije (koraci u
   `docs/sessions/tests/S135_tests.md`, T-S135-5). **Ne gori** — produkcija radi;
   ovo je zatvaranje mine.
2. **Deploy koda** kad kažeš. Čeka samo popravak modala (`c1c6c86`), i sad ima
   podlogu: provjeren je uživo, a E2E ne pokazuje regresiju S134 koda.
3. **T-S133-8 treba ponoviti kao vlasnik.** Ono što si danas vidio (Edit siv,
   ⋮ bez `Add Leaf`) je S134 zabrana za grantee-a, koja te zaustavila **prije**
   nego si došao do brave koja se testira. Prošlo bi i da je ta brava otvorena.
4. **Dvije odluke koje čekaju jednu tvoju rečenicu** (v. DIO 2): arhiva starih
   testova i sudbina ~13 „Excel pregled" testova.

## Što treba od Koke

Ništa.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i migracija

- `test-branch` = S135 commit; `main` = `5d58c05` (sve osim popravka modala).
- **`sql/052` je pušten SAMO na TEST-u.** PROD i dalje ima `047` verziju
  `areas_select` ⇒ ondje `INSERT … RETURNING` nad `areas` još pada.
- ⇒ TEST i PROD opet imaju različit RLS. Svaki zaključak o pravima mora reći na
  koju bazu se odnosi.

## Otvoreno — po redu vrijednosti

- **⭐ ⋮ meni na Structure tabu gubi stavke.** `e7`, `e13` i `e15` padaju na
  **istom mjestu**: stavka unutar izbornika (`Manage Access` ×2, `Add Between`).
  Meni se dokazano otvori (`button "Actions" [active]`), pa stavka nestane.
  `CategoryChainRow:343` zatvara meni na **svaki** `scroll`, `capture: true`.
  `e7-1` jednom prošao, jednom pao ⇒ ovisi o trenutku.
  ⚠ Hipoteza (asinkrone S133 značke s brojem eventa mijenjaju sadržaj redaka ⇒
  pomak ⇒ scroll) **NIJE izmjerena**. Prvo trace, pa popravak — toga dana su dvije
  hipoteze već pale.
  ⚠ Ako se potvrdi, nije test nego korisnički kvar: klikneš ⋮ i meni se sam zatvori.
- **E7-2 / E7-3** — otprije poznati otvoreni bugovi (izostaje toast u invite flowu).
- **T-S135-11: zašto suite ruši sam sebe.** `workers: 1` je od S120, dakle nije
  paralelizam. Deset specova pada **samo** u punom runu, s ekranom koji tvrdi
  `No activities found` uz ispravan filtar — `BUG-S121-AREACTX` razred. Ako je uzrok
  gušenje TEST baze kroz 20 min, pravo pitanje je **Postgres upgrade** (otvoren od
  S105), a ne testovi.
- **Zatvaranje modala baca rad bez pitanja** — nova Backlog stavka u CLAUDE.md.
  Panel ne zna je li „prljav"; `useBackdropClose` prima `enabled` koji mu nitko ne
  šalje. Natpis `Discard changes?` (konfiguracijska ploha ⇒ engleski).
- **Dvije odluke koje čekaju Sašu:**
  (a) arhiva `S101` i `S105` — analizirani kao nadiđeni još u S120; `S99` je
  **već** u arhivi iako ga PENDING vodi kao otvoren pitanje;
  (b) ~13 „Excel pregled" testova iz `S107*`. Podjela je pripremljena: ~9 su
  **vizualni pregled redaka u zamrznutom fileu** (Review workbook zadnji put dirnut
  17.08., osam dana prije nego je PROD pušten) ⇒ arhiva; ~4 su **alati koji će se
  opet pokretati** za batch 2024/2023 (`T-S107j-1`, `T-S107d-4`, `T-S107c-2`,
  `T-S107i-6`) ⇒ zadržati.
- **`event_attributes` INSERT, `events` SELECT/UPDATE/DELETE** — i dalje nedirnuti
  (iz S134, s razlogom).
- **RESTORE NE POSTOJI.** Backup je kopija, ne provjeren povratak.

## Higijena okoline — novo, i vrijedi zapamtiti

Na `:5173` je danas zatečen `vite --mode prod` **od jučer 11:39**, siroče
zatvorenog terminala; uz njega i `playwright test-server` od 14:13. Oba ugašena.
⇒ Prije E2E vrijedi provjeriti **što stoji na portovima**, jer zamka zapisana kao
„ugasi `dev:prod`" pretpostavlja da znaš da si ga pokrenuo.

## Tri promašaja u mjerenju (moja, ne testova)

- `exit code 0` iz `npx playwright test | tail` je kod **`tail`-a**.
- Playwright **briše `test-results/` na svakom pokretanju** ⇒ petlja po specovima
  pojede artefakte svih osim zadnjeg; treba kopirati nakon svakog runa.
- Sažetak nosi ANSI znakove ⇒ `grep '^ *[0-9]+ passed'` ne hvata ništa i ispiše
  „bez rezultata", što se čita kao pad.

## Nepromijenjeno

Financije pipeline, sidra, delta sheet, tranše, Overview — ništa od toga danas
nije dirano. Vrijedi CLAUDE.md i `DONE_HISTORY` S129–S134.
