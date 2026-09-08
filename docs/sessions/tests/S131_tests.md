# S131 — testovi

Sesija: 2026-09-08. Dvije teme, obje potekle iz Kokinog retka s mirovinom
(08.09.): **decimalni zarez u polju za broj** i **obavezna polja** (`is_required`,
koji je dosad bio mrtav na svim putevima osim crvene zvjezdice).

Stanje grana: `test-branch` = `072e6a3` + necommitane izmjene, `main` = nedirano.

---

## ⚠ Prije prvog koraka — gdje se testira

Kod **nije** na `main`, dakle nije na PROD-u. Posljedica koju treba znati prije
nego se išta klikne:

- `npm run dev:prod` — lokalni build (s popravcima) protiv **PROD podataka**.
  Kvačica „Required" se upisuje u PROD bazu, ali **Kokina aplikacija je i dalje
  stari bundle s `main`a**, pa kod nje neće ni blokirati ni pokazati zvjezdicu.
  Dakle: označavanje `Racun`/`Izvor` na PROD-u je bezopasno *i beskorisno* dok se
  ne deploya.
- `npm run dev` — TEST baza. Sve što piše u konfiguraciju je ovdje sigurnije.

**Preporuka:** A i C na TEST-u ili PROD-u svejedno; **B i D na TEST-u** (pišu u
`attribute_definitions`); PROD kvačicu na `Racun`/`Izvor` postaviti tek **nakon**
deploya, kao zadnji korak.

Izmjereno na PROD-u 08.09.2026. (samo čitanje):
`Racun` 5164/5164, `Izvor` **5163/5164** popunjeno, `bez iznosa` 0.
Jedini prazan `Izvor` je Kokin redak s mirovinom. Nijedan atribut nema
`is_required = TRUE` — dakle prije označavanja ništa ne blokira.

---

## Redoslijed — zašto baš ovaj

Sekcije su složene po temi, ali **izvođenje ide drukčije**, jer neki testovi
traže stanje koje drugi upravo pokvare. Konkretno: T-S131-7 mjeri prelazak
`FALSE → TRUE`, pa mora ići **dok još ništa nije obavezno**.

| blok | testovi | gdje | zašto tu |
| --- | --- | --- | --- |
| 1 | T-S131-1, T-S131-20 | terminal | 10 sekundi; padnu li, nema smisla klikati |
| 2 | T-S131-2, -3, -4, -5 | PROD ili TEST | zarez ne dira konfiguraciju |
| 3 | T-S131-7, -8, -9 | TEST, Excel | traže **neobavezno** početno stanje |
| 4 | T-S131-17, -19, -6, -10 | TEST, panel | -19 traži `Izvor` obavezan a `Racun` **ne**, pa ide **prije** -6 |
| 5 | T-S131-11, -12, -13, -15, -16, -14 | TEST | traže **postavljeno** obavezno |
| 6 | T-S131-18, -22, -23, -24 | TEST, Excel | jedini način da nastane „obavezno + skriveno" |
| 7 | T-S131-21 | odluka | nije test nego nalaz |

Nakon svega: vrati `Rate?` na neobavezno (blok 5), obriši testne retke iz
bloka 2, i tek onda — nakon deploya — postavi `Racun`/`Izvor` na PROD-u.

---

## A. Decimalni zarez u polju za broj

### T-S131-1 ✅ Automatski test (`amountInput.test.mjs`)

```
node src/lib/__tests__/amountInput.test.mjs
```

**Rezultat:** `All 28 tests passed.`
**Protuprovjera:** uz vraćeno staro ponašanje (bez zamjene U+2212) pada **2/28** —
„U+2212 se čita kao minus" i „formatSigned se da pročitati natrag".

### T-S131-2 ⭐ Add: iznos sa zarezom se SPREMI točan

**Zašto:** stari `<input type="number">` je decimalni separator prepuštao
lokalizaciji preglednika. Kad bi preglednik odbio znak, `e.target.value` je `''`,
a kod je to mapirao u `null` — iznos je **tiho nestajao**.

**Preduvjeti:** Area `Financije_all`, kategorija `Transakcija`.

1. Add Activity → `Racun` = `Kokin tekući ZABA`, `Izvor` = `Racun`,
   `Smjer` = `Isplata`.
2. U polje **`Isplata`** utipkaj **`1.234,56`** (s točkom kao tisućicom).
3. `Tip`/`Podtip` bilo što, Finish.
4. Nađi redak u Activities listi.

**Očekivano:** `−1.234,56 €`.
**Pad:** `−1,23 €` (naivni `parseFloat` reže na prvoj točki), `−1.234,00 €`,
`−123.456,00 €`, ili redak **bez iznosa** (`—`) — to je stari tihi kvar.

⚠ **Metoda:** baš `1.234,56`, ne `1,23`. Kod `1,23` bi i pokvaren parser mogao
dati uvjerljiv broj; kod `1.234,56` je krivi rezultat (`1.234`) **1000× manji i
posve uvjerljiv**, pa test razlikuje ispravno od „izgleda ispravno".

5. Ponovi s **`1234.56`** (točka kao decimalni separator, tvoja navika).

**Očekivano:** isto `−1.234,56 €` — oba oblika moraju proći.

⚠ Nakon testa **obriši oba retka** — nisu prave transakcije, a saldo ih broji.

### T-S131-3 ⭐ Edit: postojeći iznos preživi otvaranje i spremanje nedirnut

**Zašto:** polje sada pretvara broj u tekst i natrag. Round-trip koji izgubi
znamenku pokvario bi **svaki redak koji netko samo otvori**.

1. U listi nađi redak s iznosom koji ima **decimale različite od nule** — npr.
   `−28,79` (07.09., `Razno/Pokloni`).
2. Otvori Edit. Pogledaj polje `Isplata`.

**Očekivano:** `28,79` — sa **zarezom**, i s **običnim** minusom ako je negativan.
**Pad:** `28.79`, ili crveni rub (to bi značilo da prikaz proizvodi znak koji
parser ne prima — točno bug s U+2212).

3. Ne diraj iznos. Promijeni **komentar** (da se Save otključa) i spremi.
4. Vrati se u listu.

**Očekivano:** iznos **identičan** prije i poslije.
**Pad:** bilo koja promjena iznosa — i najmanja.

⚠ **Metoda:** redak mora imati decimale ≠ 0 i ≠ 50. Na `450,00` se točka i zarez
ne razlikuju, pa bi test prošao nad pokvarenim kodom (razred „test koji nikad ne
pada", S120).

### T-S131-4 Neprepoznat unos je vidljiv, ne tih

1. Add Activity → u `Isplata` utipkaj **`12x`**.

**Očekivano:** polje dobije **crveni rub** i ispod njega piše
*„Ne mogu pročitati broj — polje se sprema kao prazno. Npr. 1389,52"*.
**Pad:** polje izgleda normalno — to je stari kvar (vrijednost je `null`, a
nigdje ne piše).

2. Obriši `x`.

**Očekivano:** crveno nestaje istog trena.

3. Utipkaj samo **`-`**.

**Očekivano:** **nije** crveno — to je pola utipkanog negativnog broja, a rub koji
bljesne na svakom minusu nauči se ignorirati.

### T-S131-5 Broj bez decimala ne dobiva `,00`

**Zašto:** polje za broj je generičko — isti kod nosi iznos u eurima i broj
ponavljanja. Formatiranje novca (2 decimale) živi u **ulogama kolona liste**
(`amount`/`pair`/`balance`), ne ovdje.

1. Bilo koja Area s `number` atributom koji nije novac (npr. ponavljanja, km).
2. Add → upiši `12` → Finish → Edit isti redak.

**Očekivano:** polje pokazuje **`12`**.
**Pad:** `12,00` — tada formatiranje dopunjuje znamenke, i pitanje je vremena kad
će početi i rezati (npr. `7,123` → `7,12`) pa spremiti zaokruženo.

3. Upiši `7,5`, spremi, otvori ponovno.

**Očekivano:** `7,5` (ne `7,50`, ne `8`).

### T-S131-25 ⭐ Prvi znak u praznom „skriveno" polju ne smije srušiti polje

**Zašto (izmjerio Saša 08.09., PROD, `Fitness > Activity`):** u **Show all** modu
upiše se `2,8` u prazan `aerobic_effect`, a ostane **`2`**. Drugi pokušaj radi.

Uzrok nije polje za broj nego `renderAttribute`: `revealed` je birao **između dva
različita elementa** — goli `AttributeInput` ili `<div>` oko njega. React na
promjeni **tipa** elementa odmontira podstablo i montira novo, pa se `<input>`
DOM čvor uništi i stvori nanovo — **a s njim se gubi fokus**. `revealed` se
prevrće na **prvi utipkani znak**, dakle točno usred tipkanja: prvi znak sruši
polje, ostatak tipkanja ode u prazno.

⚠ **Nije bug decimalnog zareza** — pogađa **svaki** tip atributa. Na broju se vidi
kao izgubljena decimala, na tekstu kao skraćena riječ, i lako se pripiše sebi.

**Preduvjeti:** atribut koji je **prazan** i ima `default_value = ''`
(na PROD-u 14 od 110; npr. `hr_avg`, `training_load`, `intensity`, `mood`).

1. Edit Activity → uključi **„Show all"**. Polje mora nositi oznaku `skriveno`.
2. U prazno `hr_avg` utipkaj **`123`** normalnom brzinom, bez pauze.

**Očekivano:** `123`, fokus ostaje u polju, oznaka `skriveno` nestane a polje se
**ne pomakne i ne izgubi ono što je upisano**.
**Pad:** ostane `1` — to je stari kvar.

3. Ponovi na **tekstualnom** polju (`mood`) — upiši `:-)`.

**Očekivano:** `:-)` cijelo.
**Pad:** samo `:`.

⚠ **Metoda:** polje mora biti **prazno prije** unosa i mora nositi `skriveno`.
Na popunjenom polju se `revealed` ne prevrće, pa test prolazi i nad kvarom
(razred „test koji nikad ne pada", S120). I: tipkaj **normalnom brzinom** — vrlo
brz unos stigne prije re-rendera i sakrije kvar.

### T-S131-26 ⭐ Prazno polje bez defaulta se VIŠE ne skriva

**Zašto:** uvjet je glasio `attr.default_value == null`, a `'' == null` je u JS-u `false` —
pa se **prazan string tretirao kao pravi default** i svako prazno polje ispadalo je „na
svom defaultu" ⇒ skriveno. Time je skrivanje-na-defaultu radilo posao zbog kojeg je
`hidden_in_add` uopće izmišljen, i tiho poništavalo podjelu odlučenu u **S117**.

Izmjereno na PROD-u 08.09.: **14 atributa** ima `default_value = ''`, **svi u `Fitness`**;
nijedan od njih nema `hidden_in_add`, a sva **3** `hidden_in_add` su u `Financije_all`.
Dakle mehanizmi se u podacima nigdje ne preklapaju — preklapao ih je samo taj uvjet.

**Preduvjeti:** `Fitness > Activity`, „Show all" **isključen**.

1. Add Activity (ili Edit retka koji ta polja nema popunjena).

**Očekivano:** `hr_avg`, `hr_max`, `training_load`, `mood`, `Wormup_notes`, `comment`
**vidljivi su i prazni**, bez klika na „Show all".
**Pad:** i dalje skriveni, uz brojač „N fields hidden".

2. Pogledaj **`intensity`** (ima **stvarni** default `light`).

**Očekivano:** i dalje **skriven** dok stoji na `light` — to je ispravno ponašanje
skrivanja-na-defaultu i ne smije se izgubiti.
**Pad:** i `intensity` je vidljiv ⇒ popravak je otišao predaleko i ugasio feature.

⚠ **Metoda:** korak 2 je onaj koji test čini testom. Bez njega bi prošao i popravak koji
skrivanje-na-defaultu ukine u cijelosti.

3. Provjeri **Financije** (Add Activity, `Transakcija`).

**Očekivano:** **nikakve promjene** — `Stanje`, `Valuta`, `Izvod opis` su skriveni preko
`hidden_in_add`, ne preko defaulta.
**Pad:** ta tri polja se pojave ⇒ dirnut je krivi mehanizam, i to na Kokinoj Arei.

### T-S131-27 Help pokriva sva tri razloga skrivanja

1. Help (❓) → tema **Attributes** → sekcija „Kada se polje NE vidi pri unosu".

**Očekivano:** tri razloga nabrojana, uz izričitu napomenu da `depends_on` skrivanje
**„Show all" NE otkriva**, i da prazan default nije default.

2. Tema **Activities** → „Vidljivost polja u formi" — ista tri razloga, bez proturječja
   s temom Attributes.
3. Tema **Structure** → `IsRequired` / `HiddenInAdd` kolone i pravilo da ne mogu biti oboje
   `TRUE`.

⚠ Help se čita **dinamički** iz `docs/help/*.md` — nije potreban deploy `help.ts`.

---

## B. Obavezna polja — upisuje li se uopće

### T-S131-6 ⭐ Kvačica „Required field" se STVARNO sprema

**Zašto:** do S131 je panel pisao `is_required` **samo na INSERT**, dakle na
postojećem atributu se nije dao promijeniti.

1. Structure → `Financije_all > Transakcija` → Edit → atribut **`Racun`**.
2. Uključi **„Required field"** → Save.
3. ⚠ **Ne provjeravaj kroz panel.** Otvori **Add Activity**.

**Očekivano:** uz `Racun` stoji crvena **`*`**.
**Pad:** nema zvjezdice.

⚠ **Metoda:** kvačica u panelu je **lokalno stanje forme** (već zapisano u
CLAUDE.md). Panel bi pokazao kvačicu i da `UPDATE` nije prošao — pa provjera ide
kroz Add Activity ili kroz **novi** Structure izvoz, nikad kroz ponovno otvaranje
panela.

4. Ponovi za **`Izvor`**.

### T-S131-7 ⭐ Excel: kolona J mijenja stanje i uvoz to JAVI

**Zašto:** uvoz je `is_required` parsirao, ali ga nije imao ni u dirty checku ni
u `UPDATE`-u — pa je redak čija je jedina promjena bila `FALSE → TRUE` ispadao
kao *„ništa se nije promijenilo"*. Obećanje bez pokrića, i to bez poruke.

**Preduvjeti:** oba atributa iz T-S131-6 vraćena na **neobavezna** (isključi
kvačice), da promjena ima što napraviti.

1. Structure izvoz → otvori `Structure` list.
2. Nađi redak atributa **`Racun`** (kol. G) i u koloni **J (`IsRequired`)**
   postavi `TRUE`.
3. ⚠ **Ne diraj nijednu drugu ćeliju.** Spremi.
4. Structure uvoz tog filea.

**Očekivano:** izvještaj javi **`attributes updated: 1`**.
**Pad:** `0` / „nothing changed" — to je točno stari kvar.

⚠ **Metoda:** samo kolona J. Dirneš li usput i `Default` ili `Unit`, brojač
`updated` naraste iz **drugog** razloga i test prođe nad kvarom.

5. Add Activity → provjeri zvjezdicu uz `Racun`.

### T-S131-8 ⭐ TRUE na NE-prvom retku atributa (pravilo OR)

**Zašto:** `Izvor` ima **tri** retka u `Structure` listu (po jedan za svaku
vrijednost `Racun`a — retci 11–13 na izvozu od 08.09.). Ostala atributska polja
rade „prvi redak pobjeđuje"; `IsRequired` je **zastavica**, pa se spaja s **OR**.

1. Izvoz → nađi **tri** retka atributa `Izvor`.
2. U koloni J postavi `TRUE` **samo na DRUGOM ili TREĆEM** retku. Prvi ostavi
   `FALSE`.
3. Uvezi.

**Očekivano:** `Izvor` je obavezan (zvjezdica u Add Activity).
**Pad:** nije obavezan — to je „prvi redak pobjeđuje", pravilo koje bi tvoj
`TRUE` **tiho progutalo**.

⚠ **Metoda:** baš ne-prvi redak. Na prvom bi i staro i novo pravilo dalo isti
rezultat, pa test ne bi mjerio ništa.

### T-S131-9 `FALSE` na svim retcima isključi obavezno

1. Izvoz (sada nosi `TRUE`) → postavi J na `FALSE` na **svim** retcima `Izvor`a.
2. Uvezi → Add Activity.

**Očekivano:** zvjezdica nestala, Finish prolazi bez `Izvor`a.

⚠ Ovo je i potvrda upozorenja iz razgovora: **uvoz starijeg filea (u kojem je J
još `FALSE`) obavezno polje isključi**, jer je file autoritet — isto kao za
`Default` ili `Unit`. Označiš li kvačicom, sljedeći izvoz napravi **poslije** toga.

### T-S131-10 Izvoz nosi `TRUE` nakon što je postavljeno kvačicom

1. Panel → `Racun` → „Required field" → Save.
2. **Novi** Structure izvoz → kolona J na retku `Racun`.

**Očekivano:** `TRUE`.
**Pad:** `FALSE` — roundtrip nije zatvoren i sljedeći uvoz bi kvačicu poništio.

---

## C. Provjera pri spremanju

### T-S131-11 ✅ Add: Finish blokiran, poruka imenuje polje

Potvrdio Saša 08.09. (screenshot): `Racun *`, `Izvor *`, Finish ne sprema,
poruka *„Polje "Izvor" je obavezno…"*.

⚠ **Treba još jedan pogled:** tekst je otad **skraćen** — rečenica *„Ako ga ne
vidiš, otkrij ga s „Show all""* je maknuta, jer je obavezno polje od sada uvijek
na ekranu (v. T-S131-18). Očekivano sada: **`Polje "Izvor" je obavezno.`**

### T-S131-12 ⭐ Edit: spremanje blokirano kad se obavezno polje OBRIŠE

**Preduvjeti:** `Izvor` označen obaveznim.

1. Otvori Edit bilo kojeg postojećeg retka.
2. **Obriši** `Izvor` (dropdown → `Select Izvor...`).
3. Save.

**Očekivano:** ne sprema, poruka `Polje "Izvor" je obavezno.`
**Pad:** sprema se.

⚠ **Metoda:** polje se **mora obrisati**. Svi postojeći retci osim jednog imaju
`Izvor` popunjen (izmjereno 5163/5164), pa bi Edit bez brisanja prošao i nad
kodom u kojem provjere uopće nema — test koji ne može pasti ne čuva ništa.

### T-S131-13 Edit starog retka koji ima sve — regresija

1. Otvori Edit retka koji ima `Racun` i `Izvor` popunjene.
2. Promijeni samo komentar → Save.

**Očekivano:** sprema se normalno.
**Pad:** blokirano — provjera je prestroga i zaključala bi 5.163 postojeća retka.

### T-S131-14 `Save +` također blokira

**Preduvjeti:** Area koja **nema** `disable_save_plus` (Financije ga imaju
ugašen, pa ovaj test tamo nije moguć). Označi neki atribut obaveznim.

1. Add Activity → ostavi obavezno polje prazno → `Save +`.

**Očekivano:** ne dodaje u red, poruka imenuje polje.
**Pad:** događaj uđe u red — tada bi ga Finish spremio, jer provjera na Finishu
gleda samo **trenutnu formu**, ne ono što je već u redu.

### T-S131-15 ⭐ Excel uvoz aktivnosti NE provjerava obavezna polja

**Zašto:** `is_required` je pravilo **forme**. Vrijedi li i za uvoz, padaju
povijesni batchevi (2024/2023) i `N/A` prestaje biti legitiman.

**Preduvjeti:** `Izvor` označen obaveznim.

1. Activities izvoz → u jednom retku **isprazni** `Izvor`.
2. Uvezi natrag.

**Očekivano:** redak prođe, bez poruke o obaveznom polju.
**Pad:** uvoz odbije redak — to bi zaustavilo cijeli pipeline.

### T-S131-16 Obavezan boolean: netaknut blokira, `false` prolazi

**Zašto:** `false` je **odgovor**, ne izostanak. Da se broji kao prazno, obavezan
boolean bi se dao spremiti samo s „da".

1. Označi **`Rate?`** obaveznim.
2. Add Activity → ne diraj `Rate?` → Finish.

**Očekivano:** blokirano (`Not set` je izostanak odluke).

3. Klikni `Rate?` **dvaput** (uključi pa isključi) → Finish.

**Očekivano:** sprema se, vrijednost `false`.
**Pad:** i dalje blokirano — tada `false` nije priznat kao odgovor.

⚠ **Nakon testa vrati `Rate?` na neobavezno.** I zabilježi dojam: obavezan
boolean traži **dva klika** da bi se odgovorilo „ne", što je nezgrapno — možda
zaključak bude da obavezni booleani nemaju smisla.

---

## D. Obavezno + skriveno

### T-S131-17 Panel ne da složiti kombinaciju

1. Structure → Edit atributa → uključi **„Required field"**.

**Očekivano:** kvačica **„Hide in Add/Edit form"** postane **siva/onemogućena**,
uz objašnjenje *„Unavailable while the field is required…"*.

2. Isključi „Required", uključi „Hide".

**Očekivano:** sada je onemogućena **„Required field"**, uz svoje objašnjenje.
**Pad:** obje se daju uključiti.

3. ⚠ Provjeri da se **uključena** kvačica uvijek da isključiti (nijedna nije
   onemogućena dok je sama uključena) — inače se par koji dođe Excelom ne bi dao
   popraviti odande gdje se popravlja.

### T-S131-18 ⭐ Kombinacija iz Excela: forma svejedno prikaže polje

**Zašto:** panel kombinaciju više ne da složiti, ali Excel je i dalje može
donijeti — a ondje panela nema. Zato invarijanta stoji **na mjestu upotrebe**.

1. Structure izvoz → za `Izvor` postavi **J (`IsRequired`) = TRUE** i
   **K (`HiddenInAdd`) = TRUE**. Uvezi.
2. Otvori **Add Activity**.

**Očekivano:** `Izvor` je **na ekranu**, sa zvjezdicom, bez klika na „Show all".
**Pad:** polja nema — a poruka traži da ga ispuniš. To je zaključana forma.

3. Otvori panel za `Izvor`.

**Očekivano:** obje kvačice uključene + narančasto upozorenje
*„Required and hidden at the same time (came from an Excel import)…"*.

4. Očisti jednu i spremi.

### T-S131-22 ⭐ Uvoz JAVI proturječne zastavice i sam preuzme anotirani file

**Zašto:** panel kombinaciju više ne da složiti, pa je Excel jedini put kojim
može nastati — a tko radi samo u Excelu ne vidi ni panel ni njegova upozorenja.
Signal zato ide u **trenutak kad kontradikcija nastaje**.

1. Structure izvoz → za `Racun` postavi **J = TRUE** i **K = TRUE**. Uvezi.

**Očekivano u modalu:**
- narančasti okvir *„1 attribute both Required and Hidden"*
- prvo što piše je **„Imported as written"** — dakle da ništa nije palo
- ime atributa, slug i `Category_Path`
- **NEMA** zelenog *„Import completed successfully"* (poruka i nalaz ne smiju
  tvrditi suprotno na istom ekranu)
- siva kutija: *„↓ Downloaded `structure_REVIEW_NEEDED_<timestamp>.xlsx`"*

**Pad:** uvoz prođe tiho, ili se file ne preuzme, ili uz nalaz stoji i zelena
kvačica.

2. Otvori preuzeti file.

**Očekivano:** kolone **J i K su vidljive** (u običnom izvozu su skupljene i
skrivene), obje ćelije retka `Racun` **žute**, a klik na `J` otvara poruku
*„Required + Hidden — check"*.
**Pad:** ćelije jesu žute ali su kolone i dalje skrivene — oznaka koju nitko ne
vidi jednaka je onoj koje nema.

⚠ **Metoda:** provjeri i da **dropdown `TRUE/FALSE` na toj ćeliji i dalje radi**.
Per-ćelijski Data Validation gazi onaj sa raspona kolone, pa bi bez ponovljenog
popisa poruka došla po cijenu izbornika.

3. Klikni **„Download again"**.

**Očekivano:** isti file, novo vrijeme u imenu.

### T-S131-23 Oznaka preživi u OBIČNOM izvozu i sama nestane

**Zašto:** boja se izvodi **iz podataka** (`rowNeedsReview`), ne iz rezultata
uvoza — pa nalaz ne ovisi o tome je li netko baš tada uvozio.

1. Bez ikakvog uvoza napravi **običan** Structure izvoz.

**Očekivano:** `Racun` je i dalje žut u J/K, kolone vidljive.
**Pad:** čist file — tada oznaka živi samo u jednom preuzimanju i izgubi se.

2. Očisti `HiddenInAdd` (panel ili Excel), pa opet izvoz.

**Očekivano:** žuto **nestalo**, kolone opet skupljene.
**Pad:** oznaka ostaje — upozorenje koje i dalje prigovara popravljenom stanju
prestane se čitati.

### T-S131-24 Sudar putanja i dalje radi — jedan file, oba razloga

**Zašto:** ručni gumb „Download Conflict Report" je maknut; taj file se sada
preuzima sam, pod novim imenom, i nosi **oba** razloga.

1. Napravi uvoz koji ima **sudar sluga** (isti slug, druga `Category_Path`).

**Očekivano:** modal javi sudar kao i prije, file se preuzme **sam** kao
`structure_REVIEW_NEEDED_*`, slug žut u koloni **G**, kolona G vidljiva.
**Pad:** nema preuzimanja (gumb je maknut, pa bi nalaz ostao bez filea).

2. Napravi uvoz koji ima **oboje** (sudar + `Required`+`Hidden`).

**Očekivano:** **jedan** file, u njemu obje oznake; modal ima obje sekcije.
**Pad:** dva filea ili samo jedna oznaka.

### T-S131-19 Obavezno dijete neobaveznog roditelja — upozorenje

1. Panel → `Izvor` **obavezan**, `Racun` **neobavezan**.

**Očekivano:** ispod „Required field" narančasto:
*„This field depends on "racun", which is not required…"*.
**Pad:** nema upozorenja — to je jedina kombinacija koja još može ostaviti
obavezno polje izvan ekrana (polje skriveno zato što roditelj nema vrijednost ne
otkriva ni „Show all").

---

## E. Regresija i nalazi

### T-S131-20 ✅ Automatski testovi + typecheck + build

```
node src/lib/__tests__/amountInput.test.mjs          # 28/28
node src/lib/__tests__/requiredAttributes.test.mjs   # 18/18
npm run typecheck && npm run build
```

**Protuprovjera `requiredAttributes`:** uz naivni `!!v` umjesto pravila pada
**3/18** — „sami razmaci su prazno", „false je ODGOVOR", „nula je ODGOVOR".

Ostali lib testovi: `deltaAccount`, `deltaBlankRowDropdowns`, `deltaSheetLayout`,
`importForeignRows`, `ruleManagedAttrs` — svi OK.

### T-S131-21 ⚠ NALAZ: `structureExcel.test.mjs` je odrezan u gitu

Ne pada zbog S131 — file je **skraćen usred zadnjeg testa** i takav commitan još
u **S17** (`75ef760`):

```
node src/lib/__tests__/structureExcel.test.mjs
→ SyntaxError: Unexpected end of input   (linija 517 od 516)
```

Završava na `const row = buildRowsForNode` — nedostaju zadnji test, cijele
sekcije **8 (`filterStructureNodes`)** i **9 (`structureExportFilename`)** koje
zaglavlje obećava, te ispis sažetka. Dakle **taj test nikad nije prošao ni jedan
run** — a `structureExcel.ts` je od tada mijenjan mnogo puta.

**Nije popravljeno** — nadopuna nije dio ove sesije. Odluka je Sašina:
dopuniti (napisati sekcije 8 i 9 nanovo) ili obrisati (test koji se ne pokreće
lažno tvrdi da je nešto pokriveno).
