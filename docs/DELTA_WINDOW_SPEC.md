# DELTA_WINDOW_SPEC — sidro prestaje biti rez, postaje oznaka

**Status:** **sve četiri faze su IZVEDENE** (1–2 u S142 2026-09-19, 3–4 u S143 2026-09-20) — §9 nosi što je gdje.
Izvorno pisan kao prijedlog prije koda (S141, 2026-09-18).
**Isti obrazac kao `FILTER_SPEC.md` i `RULES_ENGINE_SPEC.md`:** Saša čita, reže što ne
treba, pa se kodira.

**Povod:** Sašin prijedlog — *„dešava se da nema redova iza zadnjeg sidra (jer se dosta radi
kartično pa je sve u budućnosti), to je dosta neugodno korisniku (Koki, koja je navikla da
vidi zadnje unose u svojoj originalnoj Excelici)"*. Prijedlog: krenuti od **predzadnjeg**
sidra, a zadnje označiti tekstom u koloni desno.

⚠ **Prvi nacrt ovog spec-a to je poopćio u „prozor od `N` dana" i TO JE BILO POGREŠNO.**
Opovrgnuto mjerenjem u §1.2; Sašina formulacija je zadržana i **ona je pravilo**. Zapisano
jer je pogreška poučna: „poopći pa će biti robusnije" ovdje je značilo *izgubi jedino
svojstvo zbog kojeg brojka nešto vrijedi*.

---

## 1. Izmjereno (PROD, 18.09.2026., read-only)

### 1.1 Premisa stoji, i oštrija je od opisa

| račun | zadnje sidro | redaka iza njega | od toga miče saldo | između zadnja dva sidra | razmak |
| --- | --- | ---: | ---: | ---: | ---: |
| Kokin tekući ZABA | 06.09. `12.772,86` | 50 | **18** (`Racun`) | 101 (47 `Racun`) | 38 dana |
| Sašin tekući RF | 07.09. `690,79` | 20 | **2** (`Racun`) | 22 (9 `Racun`) | 27 dana |

Na RF-u je od 20 redaka iza sidra **18 Visa**, a oni s dospijećem u budućnosti odlaze u
sekciju „planirano" (S125) — pa glavni blok ostaje na **dva** retka. Sheet izgleda prazan
jer **jest** prazan.

⚠ Na ZABA-i problem nije „prazno" nego **tiho skraćeno**: zadano `N` je 60 dana, a sidro od
06.09. reže prozor na **12** — dakle **47 `Racun` redaka nestane bez ijedne poruke**. Isti
razred kao BUG-S123-DELTAACCT: file izađe uredan, s krivim opsegom, i ništa ne kaže.

### 1.2 ⚠ Zašto „N dana" NE valja — i zašto sidra jesu prava jedinica

Sašino pitanje bilo je *„ako odemo 60 dana natrag, imamo li problema sa stanjem tog dana?"*
Izmjereno: **da, i to veliki.** „Danas − 60" pada na **20.07.2026.**, a najbliže sidro
**prije** tog datuma je:

| račun | najbliže sidro prije 20.07. | otvarajuće stanje bilo bi |
| --- | --- | --- |
| ZABA | **01.01.2025.** (rupa od 575 dana među sidrima) | sidro **+ 565 dana izračuna** |
| RF | **31.12.2022.** (*„Sašin zapis, NIJE s izvoda"*) | sidro **+ 1.297 dana izračuna** |

Nasuprot tome, **„jedno sidro ranije"** daje:

| račun | prozor | otvarajuće stanje |
| --- | ---: | --- |
| ZABA | **50 dana** | **13.815,33** — potvrđeno, `ZABA_2026-07.pdf` |
| RF | **38 dana** | **799,12** — potvrđeno, `RF_2026-07.pdf` |

⇒ **Pravilo: prozor uvijek kreće DAN POSLIJE nekog sidra, nikad na proizvoljan datum.**
Time je otvarajuće stanje **potvrđen broj, bez ijednog dijela izračuna** — a to je jedino
svojstvo zbog kojeg cijeli kontrolni stupac išta vrijedi. Prozor od `N` dana bi ga tiho
zamijenio nagađanjem dugim godinu i pol.

⚠ I duljina prozora ispadne slična onome što je `N` htio (50 i 38 naspram 60), samo bez
te cijene.

---

## 2. Što kod danas radi

### 2.1 Prozor

[`ExcelExportModal.tsx:429-441`](../src/components/activity/ExcelExportModal.tsx#L429):

```ts
const nDaysAgo = new Date(Date.now() - deltaDays * 86400000);
const startMs  = Math.max(dayAfterAnchor?.getTime() ?? 0, nDaysAgo.getTime());
```

`dayAfterAnchor` dolazi iz **najnovijeg** sidra `confirmed_on <= today` (`anchors[0]`), pa je
sidro **tvrd pod**: raspon iz panela ne može doseći ispred njega.

### 2.2 Otvarajuće stanje

[`ExcelExportModal.tsx:446-460`](../src/components/activity/ExcelExportModal.tsx#L446) zove
`fetchAnchoredBalance({ …, asOf: dayBefore })` — **isti RPC koji hrani pločicu**
(`rpc_area_balance_anchored`), a on sam bira najnovije sidro `confirmed_on <= asOf` i
pribraja promjene **strogo nakon** njega.

⇒ Kad prozor kreće **dan poslije sidra**, `dayBefore` je **točno dan sidra**, pa RPC vrati
**sam iznos sidra** i ništa više. Funkcija se **ne mijenja**; mijenja se samo koje sidro
bira pozivatelj.

### 2.3 Kontrolni stupac

[`deltaSheet.ts:287-300`](../src/lib/deltaSheet.ts#L287), po retku:

```
IF(datum="", "", opening + SUMIFS(uplate, datum<=ovaj) - SUMIFS(isplate, datum<=ovaj))
```

`SUMIFS` po datumu, **nikad lančano** — lanac se raspadne na prvom sortu, a korisnik
sortira čim doda stariji datum.

---

## 3. Zašto je sidro uopće postalo pod — i zašto to nije bila odluka

Pravilo iz S126 (`CLAUDE.md` § Delta sheet) glasi doslovno:

> ⚠ **SIDRO TVRDO ZAKLJUČAVA POČETAK PROZORA.** […] Posljedica koja se ne vidi dok ne
> zatreba: postaviš li sidro na kraj mjeseca koji je tek usklađen, retci tog mjeseca
> **ispadaju iz svakog budućeg delta sheeta**, pa se više ne mogu ni razvrstati ni
> ispraviti tim putem. Zato: **sidro ide tek kad je prozor gotov**.

Dakle **S126 je ovo već zapisao kao zamku**, a lijek je bila **disciplina**. Ovaj prijedlog
je zamjenjuje **mehanizmom** (*spriječiti > izmjeriti > sakriti*).

⚠ Pod je imao pravi razlog — spriječiti **dvostruko brojanje** retka koji je već unutar
potvrđenog iznosa. Ali to sprječava **otvarajuće stanje** (§2.2), ne pod: pod je bio drugi
pojas preko istog remena.

---

## 4. Prijedlog

### 4.1 Prozor se mjeri **sidrima**, ne danima

```
početak prozora = dan POSLIJE K-tog sidra unatrag        (zadano K = 1)
K = 0  ⇒ današnje ponašanje (dan poslije zadnjeg sidra)
K = 1  ⇒ Sašin prijedlog: prozor obuhvaća zadnje sidro
```

Polje „N dana" u panelu zamjenjuje **„koliko sidara unatrag"**. Razlog nije pojednostavljenje
nego to da **svaka** dopuštena vrijednost daje otvarajuće stanje koje je potvrđen broj
(§1.2). Dani to svojstvo ne mogu dati ni slučajno.

⚠ **Rupe među sidrima su velike i moraju se pokazati PRIJE izvoza.** ZABA ima rupu od
**575 dana** (01.01.2025. → 30.07.2026.), RF od **1.319**. Dakle `K = 2` danas na ZABA-i
ne daje „malo širi prozor" nego **~625 dana i tisuće redaka**. Panel zato uz izbor mora
ispisati **stvarni raspon i broj redaka** („od 31.07.2026., 151 redak"), i upozoriti preko
praga. Brojka koja iznenadi korisnika tek kad otvori file je ista greška koju ovaj spec
zatvara.

### 4.2 Pravilo „dan nakon sidra" ostaje — ali se seli na **otvarajuće** sidro

Danas ga provodi `dayAfterAnchor` nad zadnjim sidrom; nakon promjene ga provodi nad
**K-tim**. Za sidra koja padnu **unutar** prozora vrijedi **obrnuto**: redak datiran
**točno na dan** takvog sidra **mora ući**, jer ga to sidro obuhvaća (pokriva sve `<=` svog
dana).

⚠ Isto pravilo, dva sidra, **suprotan ishod** — i zato traži vlastiti test. Ovo je
najvjerojatnije mjesto na kojem će se pogriješiti.

### 4.3 Nova kolona desno od `Stanje (kontrola)`: stanje potvrde po retku

| redak | kolona |
| --- | --- |
| datum ≤ sidru unutar prozora | `potvrđeno 30.07. · ZABA_2026-07.pdf` |
| datum nakon zadnjeg sidra | prazno |

⚠ **Zašto ne puna rečenica po retku** (Sašin zahtjev je bio *„ono što inače pišemo"*):
izmjereno da bilješke sidara imaju **41–90 znakova** (*„ispisano stanje s izvoda ·
ZABA_2026-07.pdf"*, a ona s ekrana bankovne aplikacije **90**). Ponovljena na ~100 redaka
to je stupac koji se ne da čitati. **Puna rečenica ide jednom, u zaglavlje** (§4.4); u
koloni stoji njezin kratki oblik — datum + izvor, dakle ono po čemu se sidro prepoznaje.

⚠ **Kolona, a ne razdjelni redak** — korisnik **sortira čim doda stariji datum**, pa bi
razdjelni redak usred bloka odlutao od svog mjesta. Vrijednost u koloni putuje s retkom.
(Zato i sekcija „planirano" stoji **na kraju**, iza praznih redaka — ondje sort ne doseže.)

⚠ **Mora ući u `auto_filter.ref`** — stupac izvan autofiltera se pri sortu raspari od retka.
Danas autofilter ide `to: { column: ctrlCol }`
([`deltaSheet.ts:552`](../src/lib/deltaSheet.ts#L552)), pa se granica pomiče.

⚠ **Ne ide u `export_profiles`** — dodaje ga delta alat **nakon** primjene profila (postojeće
pravilo), isti položaj koji već ima `Stanje (kontrola)`.

### 4.5 Prazni retci za unos dobivaju **blag** format

Sašin zahtjev (S141): *„ovi redovi za unos bi trebali biti nekako blago formatirani (sada nemaju poseban format)“*.

Prazni retci predloška su **jedino mjesto gdje čovjek upisuje**, a danas izgledaju isto kao
povijest. Prijedlog: vrlo svijetla podloga + tanki obrub, dovoljno da se blok vidi na prvi
pogled, premalo da se natječe s crvenim uvjetnim formatom kontrolne ćelije.

⚠ **Ton mora biti različit od sivog** kojim se označavaju **potvrđeni** retci (§5, sloj 1)
— dva sloja značenja na istoj plohi: *„ovdje pišeš“* i *„ovo je već potvrđeno, ne diraj“*.
Ako se stope, jače upozorenje gubi snagu, a to je ono koje štiti prošlost.

⚠ **Format ostaje i nakon što se redak popuni** — i to je **korisno, ne propust**: obojeni
retci su točno oni koji će ući kao **NOVI** zapisi. Time file sam pokazuje što će uvoz dodati,
a što samo ispraviti. Vrijedi provjeriti s Kokom nakon prvog kruga — ako joj to smeta, boja
se skida uvjetnim formatom čim datum prestane biti prazan.

⚠ Boja se piše **nakon** profila (profil dira kolone po položaju) i **ne smije** dirati
`dataValidation` koji ti retci već nose (`dvBlankRows`, S130).

### 4.4 Kontrolna točka u zaglavlju — po jednom sidru u prozoru

```
sidro 30.07.2026.   potvrđeno:    13.815,33   (ispisano stanje s izvoda · ZABA_2026-07.pdf)
                    sheet računa: =opening + SUMIFS(…, datum<=30.07.)
                    razlika:      =ROUND(potvrđeno − sheet, 2)
```

⚠ **Zašto u zaglavlju, a ne u koloni:** provjera pripada **datumu**, a na taj datum možda
**nema nijednog retka** — pa nema nosača. Ćelija u zaglavlju je uz to sort-imuna, i to je
već uhodan obrazac ovog sheeta (`u banci piše` / `razlika`).

⚠ **`ROUND(…, 2)` je obavezan**: razlika nosi grešku binarnog zapisa (~`1e-13`), pa je
usporedba s nulom bez zaokruživanja bojala crveno savršeno usklađen sheet (S112).

---

## 5. Zaštita prošlosti — Sašina bojazan, i što je stvarno izloženo

Sašino pitanje: *„smije, ali treba jako uočljivo upozorenje… malo me strah mogućnosti
korumpiranja vrijednosti u prošlosti."*

⚠ **Prvo činjenica koja mijenja veličinu straha: prošlost je VEĆ pisiva.** Obični Activities
izvoz s rasponom datuma nosi stare retke, a uvoz ih ažurira; isto Edit Activity u UI-ju.
Delta sheet **ne otvara nova vrata** — on te retke stavlja u file **čija je svrha uređivanje**.
Dakle rizik je **nehotična** izmjena, ne nova mogućnost.

Zato tri sloja, od najjeftinijeg prema najjačem:

| sloj | što radi | kada uhvati |
| --- | --- | --- |
| **1. kolona + sivi ton** (§4.3) | kaže „ovaj redak je već potvrđen" | prije nego korisnik upiše |
| **2. kontrolna točka** (§4.4) | razlika prestane biti `0,00` | u sheetu, prije uvoza |
| **3. update-guard na uvozu** | **Apply zaključan dok se ne potvrdi** | pri uvozu, s točnim znanjem |

⚠ **Sloj 3 nije nov mehanizam nego proširenje postojećeg.** `row_hash` update-guard već
zaključava Apply dok korisnik ne potvrdi izmjenu dodirnutog retka (D7; čuva ga
`T-S107-2`). Dodaje mu se **jedan uvjet**: „a taj redak je unutar potvrđenog stanja" ⇒
poruka imenuje sidro koje se time dovodi u pitanje. To je prava brana, za razliku od boje
u sheetu.

⚠ **Zaključavanje takvih redaka (odbijanje uvoza) je odbačeno** — lomilo bi *„sve ide
importom"* i uzelo Koki jedini put kojim ispravlja retke. Ispravak prošlosti mora **ostati
moguć**; mora samo prestati biti **tih**.

---

## 6. Što se **ne** mijenja

- Sekcija „planirano" (cijela košara, prag „danas", vlastita kontrola) — netaknuta.
- Prazni retci predloška i njihovi dropdowni (`dvBlankRows`, S130) — netaknuti.
- Kontrolni stupac i dalje **ne broji `Planiran`** ⇒ obavezan ručni korak potvrde ostaje.
- `deriveDeltaAccount()` i prekidač „koristi filtre iz profila" — netaknuti.
- **Uvoz ne poskupljuje**: `row_hash` preskače nedirnute retke (D7). Cijena je **duži file**,
  ne duži uvoz.

---

## 7. Rizici, i čime se svaki zatvara

| rizik | zatvara |
| --- | --- |
| dvostruko brojanje retka koji je već u sidru | otvarajuće stanje iz RPC-a (§2.2) — nepromijenjeno |
| otvarajuće stanje postane nagađanje | prozor kreće **dan poslije sidra** (§4.1) |
| `K = 2` otvori prozor od 625 dana | panel ispisuje stvarni raspon + broj redaka prije izvoza (§4.1) |
| Koka ispravi iznos na potvrđenom retku | tri sloja iz §5 |
| ne vidi se koji su retci „zaključani" | kolona (§4.3) |
| stupac se pri sortu raspari | ulazak u `auto_filter.ref` (§4.3) |
| redak **na dan** sidra unutar prozora ispadne | test iz §4.2 |

---

## 8. Mjerenje (bez ovoga se ne kreće)

**Prije:** ZABA prozor 12 dana / 18 `Racun`; RF 11 dana / 2 `Racun`.

**Poslije, uz `K = 1`:** ZABA prozor **50 dana** s otvarajućim stanjem **točno `13.815,33`**;
RF **38 dana** / **`799,12`**. Otvarajuće stanje mora biti **jednako iznosu sidra u cent** —
to je dokaz da prozor kreće točno dan poslije njega.

**Kontrolna točka na zadnjem sidru mora dati razliku `0,00`** — dokaz da se pomak prozora
nije razišao s pločicom.

⚠ **Test ide na ZABA-i, ne na RF-u.** RF ima 3 sidra, ZABA **16** — dakle samo ZABA nosi
slučaj „više sidara unutar jednog prozora", koji je jedini zanimljiv. (Pravilo iz S129: *kad
se testira automatika, slučaj se bira tako da se razlikuje od njezinog rezultata.*)

---

## 9. Faze

1. ✅ **Prozor po sidru** (`K`, zadano 1) + panel ispisuje stvarni raspon — **S142**.
   `src/lib/deltaWindow.ts` (`pickDeltaWindow`) — čista funkcija izvan modala, jer isti
   izbor treba **panel** (da ispiše raspon) i **izvoz** (da ga napravi); dvije kopije uvjeta
   su prilika da panel obeća jedan raspon a file donese drugi.
   ⚠ **Pretpostavka iz §2.2 je POKUSOM POTVRĐENA, ne pročitana iz koda**
   (`_probes/faza1_otvarajuce_stanje.py`, PROD, read-only): `rpc_area_balance_anchored` s
   `as_of` = dan sidra vraća **sam iznos sidra uz `n = 0`**, za oba računa i za K = 0/1/2 —
   ZABA `13.815,33`, RF `799,12`, u cent. Šest provjera, šest prolaza.
   ⚠ Rubovi koje spec nije imenovao, odlučeni pri izvedbi: račun **bez ijednog sidra** pada
   na 60 dana (nikad „od početka vremena“), a `K` veći od broja sidara se **clampa** na
   najstarije — i panel oboje kaže naglas.
2. ✅ **Kolona „Potvrda“** + ulazak u autofilter + sivi ton — **S142**.
   ⚠ Kolona je **formula**, ne upisan tekst (isto pravilo kao `Provjeri`): promijeni li
   korisnik datum retka, oznaka nestaje istog trena.
   ⚠ Formula ide **i na prazne retke**, i to je glavna korist: upiše li korisnik u prazan
   redak datum unutar potvrđenog razdoblja, oznaka iskoči sama — jedini trenutak u kojem
   se takav unos može uhvatiti **prije** uvoza.
   ⚠ Sivi ton je **uvjetni format**, ne statički fill: podatkovni retci već nose svoje boje
   (ružičasto/plavo), a CF ih nadjačava samo dok uvjet vrijedi — statički bi zamrznuo stanje
   od trenutka izvoza.
   ⚠ Uz to su prazni retci dobili **blag topao ton** (§4.5): `FFFFFBEB` nasuprot sivom
   `FFEDEDED`, dakle dva sloja značenja koja se ne stapaju.
   Čuva `deltaSheetLayout.test.mjs` — 49 tvrdnji, protuprovjereno s 5 sabotaža.
3. ✅ **Kontrolne točke u zaglavlju**, po jedna za svako sidro u prozoru — **S143**.
   ⚠ **Izvedeno kao JEDAN BROJ po sidru, ne tri retka iz skice §4.4.** Pitanje je jedno —
   *„reproducira li sheet ovu potvrdu?"* — a odgovor je razlika; potvrđeni iznos stoji u
   natpisu, pa se sheetov izračun dobije oduzimanjem. Tri retka po sidru dala bi na dva
   sidra šest redaka zaglavlja, a zaglavlje ovog lista Koka čita.
   ⚠ **Retke rezervira PISAC** (`addActivitiesSheetsTo`, parametar `extraHeaderRows`), ne
   ukrašivač: `addDeltaHelpersTo` ne može umetnuti redak jer su položaji glavnog bloka i
   sekcije do tada već izračunati. Bez rezervacije blok sklizne gore i piše **preko praznog
   retka koji odvaja `ATTRIBUTE LEGEND`** — a legenda je uvozu izvor mapiranja stupaca.
   ⚠ To je uhvaćeno tek **apsolutnom** tvrdnjom: relativna („poruka je točno iznad prve
   točke") preživjela je sabotažu, jer u skliznutom rasporedu i dalje vrijedi.
   Čuva `deltaSheetLayout.test.mjs` — 95 tvrdnji, protuprovjereno s 4 sabotaže za ovu fazu.
4. ✅ **Update-guard na uvozu** (§5, sloj 3) — **S143**. Jedina PRAVA brana; sve prije
   nje samo označava.
   ⚠ **Ne odbija uvoz** — ispravak potvrđenog retka je legitiman (redak zna biti kriv, i
   upravo je jedan takav nađen isti dan). Guard traži da se to **izrekne**.
   ⚠ **VLASTITA kvačica, ne proširenje postojeće.** Dva su pitanja različita: *„jesi li
   vidio što se mijenja"* i *„znaš li da time dovodiš u pitanje potvrđeno stanje"*. Spojena
   bi drugo progutalo, jer se prvo klikće svaki put.
   ⚠ **Račun i datum se čitaju iz POSTOJEĆEG retka u bazi**, ne iz Excela: pitanje je je li
   potvrđeno ono što već stoji, ne kamo ga korisnik želi premjestiti.
   ⚠ Pravilo je izdvojeno u `src/lib/confirmedPeriod.ts` jer ga postavljaju **dva** mjesta
   (kolona `Potvrda` kroz Excel formulu i ovaj guard); raziđu li se, sheet bi redak označio
   a uvoz ga pustio — nevidljivo, jer izmjena retka prije sidra **ne miče saldo**.
   ⚠ Neuspjelo čitanje sidara **ne čita se kao „nema sidara"**: guard tada šuti (ponašanje
   kao prije faze 4), umjesto da tvrdi da ništa nije potvrđeno.
   Čuva `confirmedPeriod.test.mjs` — 16 tvrdnji, protuprovjereno s 3 sabotaže.

Faza 1 sama rješava Sašin problem. Faze 2–3 ga čine vidljivim, faza 4 sigurnim.

✅ **Zaštita više nije samo oznaka.** Kolona i ton kažu, kontrolna točka mjeri, a uvoz traži
pristanak — i imenuje sidro koje se dovodi u pitanje. Ostaje istinito da guard **ne brani**:
ispravak potvrđenog retka prolazi, ali ne više nehotice.

---

## 10. Odgovoreno (Saša, S141)

1. **Koliko unatrag** — ne danima nego **sidrima**, zadano **jedno ranije**. Izvorni
   prijedlog „N dana" je opovrgnut mjerenjem (§1.2).
2. **Smije li se potvrđeni redak mijenjati** — **smije, ali glasno**: tri sloja iz §5.
   Odbijanje uvoza je odbačeno jer lomi *„sve ide importom"*.
3. **Tekst u koloni** — kratki oblik (`potvrđeno 30.07. · ZABA_2026-07.pdf`), puna bilješka
   jednom u zaglavlju; razlog je duljina bilješki, izmjereno 41–90 znakova (§4.3).

### Ostalo otvoreno

4. **Prag upozorenja za širinu prozora** — **200 redaka**, upozorenje bez zabrane (Saša, S141).
5. **Sivi ton na potvrđenim retcima** — **dovoljan zasad** (Saša, S141); pojačava se tek ako
   se pokaže da se previdi.
6. **Blag format praznih redaka** (§4.5) — tražen, ton neodređen; bira se uz fazu 2, jer mora
   stajati **pored** sivog a ne s njim.

Ništa više ne čeka odluku — faza 1 se može kodirati.
