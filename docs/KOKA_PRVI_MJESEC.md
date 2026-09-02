# Kokin prvi mjesec — što je riješeno, što nije, i redoslijed

**Pisano:** 2026-09-02 (S125) · **Za:** Sašu, prije nego Koka počne gledati
**Susjedni dokumenti:** `CLAUDE.md` (trajna pravila) · `NEXT_SESSION_PROMPT.md`
(stanje u letu) · `docs/OVERVIEW_TAB_SPEC.md` (saldo i sidra)

---

## Zašto ovaj dokument postoji

Sašin zahtjev: *„Koka će uskoro trebat početi to gledat i bilo bi mi važno da ne
izgubi povjerenje i volju."*

To je uži kriterij od „radi li aplikacija". Aplikacija može biti točna, a da je ona
prestane koristiti — i obrnuto, može imati sitne smetnje koje je neće smetati.
Razlika je u **jednoj vrsti greške**:

> **Tihi gubitak njenog rada košta više od deset vidljivih smetnji.**
>
> Ako klikne, ništa se ne dogodi i nigdje ne piše zašto — zaključit će da se
> aplikaciji ne može vjerovati. Ako klikne i dobije poruku koja objasni što se
> dogodilo, čak i kad je poruka neugodna, povjerenje ostaje.

Cijela današnja sesija bila je lov na takve greške, i našle su se **četiri**. Sve
četiri su bile nevidljive po konstrukciji.

---

## Njen mjesečni tok

Ovo je ono što će raditi, i redoslijed po kojem stvari mogu puknuti:

1. **Unos tijekom mjeseca** — Add Activity, po nekoliko redaka dnevno
2. **Stigne izvod** (ZABA izvadak, MC, Visa)
3. **Izvoz delta sheeta** za jedan račun → Excel
4. **Rad u Excelu**: dopiše retke s izvoda, potvrdi košaru (`Planiran` → `Izvrsen`),
   ispravi što je krivo
5. **Uvoz natrag** → izvještaj o uvozu
6. **Pogled na Overview**: saldo mora odgovarati banci

Koraci 3–5 su njen dom — na to je naviknuta iz svoje Excelice. **Excel put joj je
važniji od aplikacije**, i to je Sašina izričita ocjena (S125). Ako ondje nešto tiho
zakaže, ne prelazi.

---

## Što je riješeno danas (S125)

Sve je na `test-branch`. ⚠ **Koka ovo još ne vidi** — v. „Redoslijed", P0.

| bilo je | sada |
| --- | --- |
| ✎ „netko je dirao tvoj redak" nije se vidjela na širokom ekranu | vidi se na oba |
| izvoz je mogao izaći **bez ijedne atributske kolone** i izgledati uredno | pada s porukom što se nije učitalo |
| kartični redak s krivim `Statusom` ispadao iz **obje** strane delta sheeta | sekcija je cijela košara; `Σ` je neto |
| ništa nije govorilo **što** s retkom nije u redu | stupac `Provjeri`, kao formula koja nestane kad se redak popravi |
| Koka nije mogla ispraviti Sašin redak kroz Excel | „Ispravi kao vlasnik Aree" — mijenja original, bez duplikata |
| oznaka `DELETE` na tuđem retku obrisala bi mu **sve atribute**, a redak ostavila | odbija se uz poruku |
| preview je obećavao „bit će uvezen kao NOV" (duplikat) za tuđi redak | 1 Modify, bez upozorenja |
| ugašena kvačica Delta sheeta bez objašnjenja | kaže **zašto** i **što učiniti** |
| „2.342 events will be exported" i kad izlazi 16 redaka | jantarna kutija s onim što file stvarno nosi |
| preskočen redak (`row_hash`) nije javljao ništa | javlja koliko ih je i imenuje do pet |

---

## Otvoreni problemi, po riziku za njeno povjerenje

### 🔴 P0 — Deploy na `main`

**Problem:** ništa od gornje tablice nije na PROD-u. `main` je na `bb13153` (S124);
PROD ima samo migracije `043` i `044`.

**Što bi ona vidjela:** stare probleme, uključujući onaj s duplikatom pri ispravku
tuđeg retka.

**Namjera:** merge `test-branch` → `main` čim Saša potvrdi. Migracije su već gore i
stari ih kod ignorira, pa nema redoslijednog rizika kao kod `043`.

---

### 🔴 P1 — Sumnjiv redak mora doći do nje, a ne samo do poruke

**Problem, izmjeren 2026-09-02.** Uvoz preskače redak čiji se `row_hash` poklapa s
fileom. To je **namjerna zaštita**: zastarjeli izvoz ne smije vratiti unatrag ono što
je netko u međuvremenu promijenio u aplikaciji. Ali dva slučaja se iz filea **ne daju
razlikovati**:

| slučaj | preskok je |
| --- | --- |
| redak nisi dirala, netko ga je promijenio u appu | **ispravan** — štiti tuđu izmjenu |
| redak si **vratila** na staru vrijednost | **pogrešan** — tvoja namjera nestaje |

Danas je Saša upravo to napravio: vratio `Studio Nataši` na `Planiran`, uvoz je rekao
`0 Modify`, baza ostala na `Izvrsen`. **Ništa nije javilo da je ispravak progutan.**

**Što je već napravljeno:** upozorenje u modalu — koliko je redaka preskočeno i koji
su (do pet imena). Uz to delta file sada nosi `Filter` list, bez kojeg provjera nije
mogla ni krenuti.

**Što još treba (Sašina ideja, i bolja je od poruke):** *ne vraćati redak, nego ga
**proglasiti sumnjivim** i pustiti čovjeka da odluči.*

Mehanizam se uklapa u ono što već postoji:

1. Uvoz otkrije preskočene retke koji su u bazi promijenjeni nakon izvoza
   (`warnStaleUntouched`, već napisano)
2. Ti retci se **dodaju u izvještaj o uvozu** — kao nov ishod uz `Created`/`Updated`,
   npr. `Preskočen — promijenjen nakon izvoza`
3. Izvještaj je **svjež izvoz**, pa ti retci u njemu nose **aktualne vrijednosti iz
   baze i aktualan `row_hash`**

⇒ ona vidi sumnjiv redak, usporedi ga sa svojim Excelom, ispravi ako treba i uveze
izvještaj natrag — **bez ikakvog trika.** Izvještaj postaje lijek, a ne samo zapisnik.

⚠ **Postoji i ručni izlaz koji već radi, a nitko ga ne zna:** obriši ćeliju
`row_hash` u tom retku. Prazan otisak znači „nije netaknut", pa redak ide u usporedbu
s bazom. Vrijedi joj to reći, ali ne kao glavni put — brisanje stupca koji ne razumije
nije nešto na što treba navikavati.

⚠ **Preduvjet:** `BUG-S114-REPORTDD` (niže). Ako izvještaj postaje mjesto na kojem
ispravlja, mora imati dropdowne.

---

### 🟠 P2 — Izvještaj o uvozu nema `DropdownData` (BUG-S114-REPORTDD)

**Problem:** izvještaj nema list s dopuštenim vrijednostima, pa u njemu `Tip` i
`Podtip` nemaju padajući izbornik.

**Što bi ona vidjela:** tipkala bi slobodan tekst bez ijedne provjere. Podtip mimo
`validation_rules` uveze se kao običan tekst i **ne javi grešku** — vidi se tek kad
ga dropdown poslije odbije, a tada je već u bazi.

**Namjera:** izvještaj nosi `DropdownData` kao i običan izvoz. Malo posla, i postaje
blokirajuće čim P1 krene.

---

### 🟠 P2 — Visa nema fiksan dan naplate, pa 855 redaka ne pada ni u jednu košaru

**Problem (S124 nalaz, i dalje otvoren):** pravilo `Visa = 3. u sljedećem mjesecu`
ne slaže se s podacima. Izmjereno na 855 Visa redaka: **5. (383×)**, 4. (231×),
6. (109×), 7. (82×), 11. (49×), 3. (11×).

**Što bi ona vidjela:** kontrola košare radi za Mastercard, a za Visu ne — zbroj se
ne slaže ni s jednim izvodom, i to bez objašnjenja.

**Namjera:** zaseban prolaz s PBZVISA izvodima, po uzoru na `uskladi_izvod.py` za MC.
**Ne popravljati napamet** — dospijeće treba doći s papira.

⚠ Sada je vidljivije nego prije, jer sekcija radi po dospijeću.

---

### 🟡 P3 — Gotovina je 99 % neevidentirana, i to je svjesno

**Izmjereno (S121):** 57 podizanja / 9.894,00 € naspram **2** gotovinska troška /
86,00 €.

**Zašto nije problem za saldo:** podizanje ga miče, gotovinski trošak ne — saldo je
zato savršeno točan.

**Gdje ugrize:** kad se bude radio **razrez po Tipu**. Bez vlastitog retka
`gotovina, nerazvrstano` prešutio bi ~9.800 € i podcijenio potrošnju.

**Namjera:** kad se taj widget gradi, nosi taj redak. Sašina odluka je da se svaka
sitnica **ne bilježi** — parcijalnost je u redu, ali mora biti **vidljiva**.

---

### 🟡 P3 — Da se sumnjivo vidi u LISTI, ne samo pri uvozu

**Sašina ideja (S125):** *„…napravi filter po datumu i računu ili nečemu što bi UI-u
omogućilo da se vidi što je sumnjivo."*

Poruka pri uvozu je jednokratna — pročita se i nestane. Ono što zapravo treba je da
se sumnjivo vidi **kad god pogleda listu**.

Dijelovi postoje: ✎ već pokazuje „netko drugi je dirao ovaj redak", `edited_at` je u
bazi, filtar zna po računu i datumu. Fali veza — uvjet filtra **„promijenjeno nakon
<datum>"** ili kolona `Zadnja izmjena`.

⚠ Dodiruje se s **filtrom od dva uvjeta**, koji je u S118 svjesno odgođen. Ne krenuti
prije te odluke.

---

## Što joj treba reći, njenim jezikom

Kratko, i samo ovo:

1. **Kad počneš upisivati u app, u Excelicu više ne.** Radi li se oboje, sve dobivamo
   dvaput — a to se neće vidjeti dok se saldo ne raziđe. *(stoji od S124, još nije
   rečeno)*
2. **Redak se potvrđuje kad se zbroj složi s izvodom, ne kad datum dođe.** Dospjeli
   datum nije dokaz da je banka naplatila.
3. **Stanje na pločici uvijek uspoređuj s bankom, a razliku prijavi.** Δ znači da
   nešto fali, nešto je dvaput, ili je iznos kriv — nikad grešku u izračunu.
4. **Ako nešto ispraviš u Excelu pa uvezeš, a ništa se ne dogodi** — javi. To je
   greška aplikacije, ne tvoja.

⚠ Četvrta je najvažnija za povjerenje: daje joj dopuštenje da prijavi tišinu umjesto
da zaključi da je nešto krivo napravila.

---

## Otvorene odluke za Sašu

| odluka | zašto sada |
| --- | --- |
| **Deploy na `main`** | bez toga Koka ne vidi nijedan današnji popravak |
| **Ide li P1 (sumnjiv redak u izvještaj) prije nego ona počne?** | ako počne bez toga, prvi tihi preskok bit će njen |
| **Tko odrađuje Visa dospijeća** | pipeline (Saša) ili se ostavlja da ona potvrđuje ručno |
| **Odglumiti Kokin unos 3 dana** (iz S124 popisa) | pretvara „bi li bila zadovoljna" u brojku, prije nego je pitamo |
