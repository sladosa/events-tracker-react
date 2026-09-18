# DELTA_WINDOW_SPEC — sidro prestaje biti rez, postaje oznaka

**Status:** prijedlog prije koda (S141, 2026-09-18). Ništa od ovoga nije implementirano.
**Isti obrazac kao `FILTER_SPEC.md` i `RULES_ENGINE_SPEC.md`:** Saša čita, reže što ne
treba, pa se kodira.

**Povod:** Sašin prijedlog — *„dešava se da nema redova iza zadnjeg sidra (jer se dosta radi
kartično pa je sve u budućnosti), to je dosta neugodno korisniku (Koki, koja je navikla da
vidi zadnje unose u svojoj originalnoj Excelici)"*.

Prijedlog je bio „izbacimo redove ne od zadnjeg nego od **predzadnjeg** sidra". Ovaj spec
ga usvaja, ali ga poopćava u **„sidro prije početka prozora"** (§4.1) i dodaje mu kontrolu
koja ga čini samodostatnim (§4.4).

---

## 1. Izmjereno (PROD, 18.09.2026., read-only)

| račun | zadnje sidro | redaka iza njega | od toga miče saldo | između zadnja dva sidra | razmak |
| --- | --- | ---: | ---: | ---: | ---: |
| Kokin tekući ZABA | 06.09. `12.772,86` | 50 | **18** (`Racun`) | 101 (47 `Racun`) | 38 dana |
| Sašin tekući RF | 07.09. `690,79` | 20 | **2** (`Racun`) | 22 (9 `Racun`) | 27 dana |

**Premisa stoji, i oštrija je od opisa.** Na RF-u je od 20 redaka iza sidra **18 Visa**, a
oni s dospijećem u budućnosti odlaze u sekciju „planirano" (S125) — pa glavni blok ostaje na
**dva** retka. Sheet izgleda prazan jer **jest** prazan.

⚠ **A na ZABA-i problem nije „prazno" nego „tiho skraćeno".** Zadano `N` je 60 dana; sidro od
06.09. reže prozor na **12**. Dakle panel je tražio 60 dana, a file nosi 12 — i **47 `Racun`
redaka nestane bez ijedne poruke**. To je isti razred kao BUG-S123-DELTAACCT: file izađe
uredan, s krivim opsegom, i ništa ne kaže.

---

## 2. Što kod danas radi

### 2.1 Prozor

[`ExcelExportModal.tsx:429-441`](../src/components/activity/ExcelExportModal.tsx#L429):

```ts
const nDaysAgo = new Date(Date.now() - deltaDays * 86400000);
const startMs  = Math.max(dayAfterAnchor?.getTime() ?? 0, nDaysAgo.getTime());
```

`dayAfterAnchor` dolazi iz **najnovijeg** sidra `confirmed_on <= today` (`anchors[0]`).
Dakle sidro je **tvrd pod**: raspon upisan u panel ne može doseći ispred njega.

### 2.2 Otvarajuće stanje — **ovdje je ključ, i on već radi ono što treba**

[`ExcelExportModal.tsx:446-460`](../src/components/activity/ExcelExportModal.tsx#L446):

```ts
const openRows = await fetchAnchoredBalance({ …, asOf: dayBefore });
deltaOpening   = { amount: …, asOf: dayBefore };
```

To je **isti RPC koji hrani pločicu** (`rpc_area_balance_anchored`), a on **sam** bira
najnovije sidro `confirmed_on <= asOf` i pribraja promjene **strogo nakon** njega.

⇒ **Otvarajuće stanje je već točno za bilo koji početak prozora.** Pomakne li se prozor
unatrag, `dayBefore` je raniji, RPC odabere ranije sidro i vrati ispravan iznos —
**bez ijedne izmjene u toj funkciji.** Zato je ovaj posao manji nego što izgleda: ne gradi
se nov račun, nego se miče jedan `Math.max`.

### 2.3 Kontrolni stupac

[`deltaSheet.ts:287-300`](../src/lib/deltaSheet.ts#L287) — po retku:

```
IF(datum="", "", opening + SUMIFS(uplate, datum<=ovaj) - SUMIFS(isplate, datum<=ovaj))
```

`SUMIFS` po datumu, **nikad lančano** („prethodni redak + uplata − isplata") — jer se lanac
raspadne na prvom sortu, a korisnik sortira čim doda stariji datum.

---

## 3. Zašto je sidro uopće postalo pod — i zašto to nije bila odluka

Pravilo iz S126 (`CLAUDE.md` § Delta sheet) glasi doslovno:

> ⚠ **SIDRO TVRDO ZAKLJUČAVA POČETAK PROZORA.** […] Posljedica koja se ne vidi dok ne
> zatreba: postaviš li sidro na kraj mjeseca koji je tek usklađen, retci tog mjeseca
> **ispadaju iz svakog budućeg delta sheeta**, pa se više ne mogu ni razvrstati ni
> ispraviti tim putem. Zato: **sidro ide tek kad je prozor gotov**.

Dakle **S126 je ovo već zapisao kao zamku**, a lijek je bio **disciplina** („sidro ide tek
kad je prozor gotov"). Sašin prijedlog tu disciplinu zamjenjuje **mehanizmom** — što je
njegovo vlastito pravilo (*spriječiti > izmjeriti > sakriti*).

⚠ Pod je imao pravi razlog: spriječiti **dvostruko brojanje**. Retci ≤ datum sidra već su
**unutar** potvrđenog iznosa, pa bi njihov ulazak u kontrolnu formulu razišao sheet s
pločicom. Ali to sprječava **otvarajuće stanje** (§2.2), ne pod — pod je bio drugi pojas
preko istog remena.

---

## 4. Prijedlog

### 4.1 Prozor određuje `N` dana, sidro ga više ne reže

```ts
const startMs = nDaysAgo.getTime();          // `dayAfterAnchor` ispada iz Math.max
```

Sidro koje hrani otvarajuće stanje bira se **samo po datumu prozora**, a to RPC već radi
(§2.2). Sidra koja padnu **unutar** prozora prestaju biti rez i postaju **oznaka** (§4.3)
i **kontrolna točka** (§4.4).

⚠ **Zašto ne „predzadnje sidro"** (izvorni prijedlog): predzadnje je krhko. ZABA već ima
**16** sidara; čim se počnu upisivati češće, predzadnje bude 5 dana unatrag i problem se
vrati. „Sidro prije početka prozora" drži u oba smjera — i kad su sidra rijetka i kad su
gusta. Sašin prijedlog je poseban slučaj ovoga (kad predzadnje slučajno padne unutar `N`).

⚠ **Nula sidara se ne mijenja:** danas je `dayAfterAnchor` tada `null` pa je `startMs`
već `nDaysAgo`. Ponašanje ostaje doslovno isto.

### 4.2 Pravilo „dan nakon sidra" ostaje — ali se seli na **otvarajuće** sidro

Danas ga provodi `dayAfterAnchor`; nakon promjene ga provodi RPC („promjene **strogo
nakon**"). Za sidra **unutar** prozora vrijedi **obrnuto**: redak datiran **točno na dan**
takvog sidra **mora ući**, jer je sidro obuhvaća (ono pokriva sve `<=` svog dana).

⚠ To je isto pravilo primijenjeno na dva različita sidra, s **različitim ishodom** — i zato
traži vlastiti test. Ovo je najvjerojatnije mjesto na kojem će se pogriješiti.

### 4.3 Nova kolona: **stanje potvrde po retku**

Vrijednost po retku, odmah desno od `Stanje (kontrola)`:

| redak | kolona |
| --- | --- |
| datum ≤ nekom sidru u prozoru | `potvrđeno 06.09.` |
| datum nakon zadnjeg sidra | prazno |

⚠ **Kolona, a ne razdjelni redak** — i razlog je zapisan: korisnik **sortira čim doda
stariji datum**, pa bi razdjelni redak usred bloka odlutao od svog mjesta. Vrijednost u
koloni putuje s retkom kroz svaki sort. (Zato i sekcija „planirano" stoji **na kraju**, iza
praznih redaka — ondje sort ne doseže.)

⚠ **Mora ući u `auto_filter.ref`** — stupac izvan autofiltera se pri sortu raspari od retka.
Danas autofilter ide `to: { column: ctrlCol }` ([`deltaSheet.ts:552`](../src/lib/deltaSheet.ts#L552)),
pa se granica pomiče na novi stupac.

⚠ **Ne ide u `export_profiles`.** Kolonu dodaje delta alat **nakon** što je profil
primijenjen (postojeće pravilo: *profil se primjenjuje PRIJE delta alata*) — isti položaj
koji već ima `Stanje (kontrola)`.

### 4.4 Kontrolna točka u zaglavlju — ovo je dio koji feature čini samodostatnim

Za **svako** sidro unutar prozora, blok uz postojeće `u banci piše` / `razlika`:

```
sidro 06.09.2026.   potvrđeno:  12.772,86     (ispisano stanje s izvoda · ZABA_2026-08.pdf)
                    sheet računa: =opening + SUMIFS(…, datum<=06.09.)
                    razlika:      =ROUND(potvrđeno - sheet, 2)
```

⚠ **Zašto u zaglavlju, a ne u koloni:** kontrolna točka pripada **datumu**, ne retku — a na
taj datum možda **nema nijednog retka**. Ćelija u zaglavlju je i sort-imuna, i to je već
uhodan obrazac ovog sheeta.

⚠ **`ROUND(…, 2)` je obavezan**: razlika `banka − Σ` nosi grešku binarnog zapisa (~`1e-13`),
pa je usporedba s nulom bez zaokruživanja bojala crveno savršeno usklađen sheet (S112).

**Čemu to služi:** čim se u sheetu nađu retci **već unutar potvrđenog stanja**, otvara se
rizik da im Koka promijeni iznos ili ih označi za brisanje — a time sidro prestaje
odgovarati stvarnosti i **danas to ne bi uhvatilo ništa**. Kontrolna točka to hvata istog
trena: razlika prestane biti nula.

⇒ Time sidro iz **reza** postaje **provjera**, i sheet prvi put sam provjerava razdoblje koje
je već zaključano. Danas to radi samo `promet_check.py` — dakle izvan Kokinog dohvata.

---

## 5. Što se **ne** mijenja

- Sekcija „planirano" (cijela košara, prag je „danas", vlastita kontrola) — netaknuta.
- Prazni retci predloška i njihovi dropdowni (`dvBlankRows`, S130) — netaknuti.
- Kontrolni stupac i dalje **ne broji `Planiran`** ⇒ obavezan ručni korak potvrde ostaje.
- `deriveDeltaAccount()` i prekidač „koristi filtre iz profila" — netaknuti.
- **Uvoz ne poskupljuje**: veći prozor ne znači više pisanja, jer `row_hash` preskače
  nedirnute retke (D7). Cijena je **duži file**, ne duži uvoz.

---

## 6. Rizici, i čime se svaki zatvara

| rizik | zatvara |
| --- | --- |
| dvostruko brojanje retka koji je već u sidru | otvarajuće stanje iz RPC-a (§2.2) — nepromijenjeno |
| Koka ispravi iznos na **potvrđenom** retku | kontrolna točka (§4.4) prestane davati nulu |
| Koka označi `Delete?` na potvrđenom retku | isto |
| ne vidi se koji su retci „zaključani" | kolona (§4.3) |
| stupac se pri sortu raspari | ulazak u `auto_filter.ref` (§4.3) |
| redak **na dan** sidra unutar prozora ispadne | test iz §4.2 |
| file naraste | ZABA 60 dana ≈ **151** redak umjesto 50 — mjeriti, ali bezopasno |

---

## 7. Mjerenje (bez ovoga se ne kreće)

**Prije:** za oba računa zabilježiti broj redaka u glavnom bloku i početak prozora
(danas: ZABA 12 dana / 18 `Racun`, RF 11 dana / 2 `Racun`).

**Poslije:** isti izvoz mora dati prozor od punih `N` dana, a **kontrolna točka na zadnjem
sidru mora dati razliku `0,00`** — to je dokaz da se pomak prozora nije razišao s pločicom.

⚠ **Test se radi na računu gdje se razlikuje od trivijalnog.** RF ima samo **3** sidra;
ZABA **16** — pa ZABA nosi slučaj „više sidara unutar jednog prozora", koji je jedini
zanimljiv. (Pravilo iz S129: *kad se testira automatika, redak se bira tako da se razlikuje
od njezinog rezultata.*)

---

## 8. Faze

1. **Prozor + otvarajuće stanje** — makni `dayAfterAnchor` iz `Math.max`; potvrdi da
   kontrolna točka na sidru daje `0,00`. Bez nove kolone, bez novog teksta.
2. **Kolona „potvrđeno"** + ulazak u autofilter.
3. **Kontrolne točke u zaglavlju**, jedna po sidru unutar prozora.
4. **Napomena uz otvarajuće stanje** — mora reći iz **kojeg** sidra dolazi (postojeće
   pravilo: *otvarajuće stanje mora biti označeno kao izračunato i nositi sidro na kojem
   počiva*), jer se to sidro sada mijenja ovisno o `N`.

Faza 1 sama po sebi rješava Sašin problem. Ostale tri su ono što ga čini sigurnim.

---

## 9. Otvoreno — traži Sašinu riječ prije koda

1. **Koliko dana zadano?** Danas `N = 60`, ali je sidro to rezalo pa se nikad nije osjetilo.
   Nakon promjene `60` znači stvarnih 60 dana. Ostaje 60 ili se spušta?
2. **Smije li se potvrđeni redak uopće mijenjati kroz delta sheet?** Ovaj spec kaže: smije,
   ali se **vidi** (kolona) i **prijavljuje** (kontrolna točka). Alternativa — zaključati ih
   — tražila bi da uvoz odbija takav redak, što je veći zahvat i lomi „sve ide importom".
3. **Tekst u koloni**: `potvrđeno 06.09.` ili nešto kraće (`✓ 06.09.`)? Kolona je uska, a
   Koka je čita svaki mjesec.
