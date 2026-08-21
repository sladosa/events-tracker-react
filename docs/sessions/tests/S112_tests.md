# S112 — detaljni testovi (2026-08-19)

**Tema sesije:** dogovor kako Koka rješava deltu · Faza 0 (datum-atributi, `planirano` filtar)
· Faza 1 (delta sheet) — alat za usklađenje jednog računa s bankovnom aplikacijom.

**Preduvjeti za sve testove:** TEST baza, Area `Financije_all`, puštene migracije
`035` + `036` + **`037` ponovno** (sada i sa `Izvor` uvjetom na `split`) + `038`.

**Sidra u bazi na početku S112 — četiri** (`balance_anchors`):

| `confirmed_on` | `group_value`     | iznos    |
| -------------- | ----------------- | -------- |
| `2025-01-01`   | Kokin tekući ZABA | 3.054,41 |
| `2025-12-31`   | Kokin tekući ZABA | 1.184,86 |
| `2026-07-01`   | Kokin tekući ZABA | 2.255,64 |
| `2025-01-02`   | Sašin tekući RF   | 3.458,03 |

⚠ Krivo RF sidro (`3.453,03`) iz S111 **više ne postoji** — netko ga je obrisao između sesija.
Time **`T-S111-2` nema što provjeriti** i briše se s popisa; mehanizam „ispravak = novi redak"
ostaje neproviren kroz UI.

---

## T-S112-1 ⭐ Datum-atribut je pravi Excel datum, a roundtrip i dalje preskače — ✅ PROŠAO 2026-08-19

**Zašto:** export je pisao sirovu vrijednost iz baze (`2025-01-07T12:00:00+00:00`), a import je
datumsku ćeliju pretvarao u `toISOString()` (ponoć u UTC-u). Kao **stringovi** se razlikuju, kao
**trenutak** ne — pa je `computeRowDiff` svaki dodirnut redak prijavljivao kao „promijenjen
`Datum naplate`" i prepisivao ga u drugi zapis istog dana.

**Rizik koji se testira:** otisak retka (`row_hash`) haši atribute na obje strane. Ako se export
i import ne slože oko oblika datuma, D7 skip nedirnutih redaka **tiho** prestaje raditi i svaki
uvoz postaje prepisivanje.

1. Activities → filtriraj `Financije_all` na nekoliko dana → **Export**.
2. Otvori file, nađi kolonu **`Datum naplate`**.
   - **Očekivano:** `11.6.2026` (pravi datum, poravnat desno), a u traci formule `11.6.2026 12:00:00`.
   - **Pad:** `2026-06-11T12:00:00+00:00`.
3. Klikni ćeliju u toj koloni.
   - **Očekivano:** žuta poruka „Datum, npr. 7.1.2025. Prazno je dopušteno."
4. Uvezi **taj isti file, bez ijedne izmjene**.
   - **Očekivano:** `0 New`, `0 Modify`, **sve skipped** (u prošlom prolazu: 78).
   - **Pad:** bilo što u „Events to modify" — otisak se razišao.

**Rezultat 2026-08-19:** 78 skipped, 0/0. ✅

---

## T-S112-2 ⭐ `planirano` govori o istom novcu kao saldo — ✅ PROŠAO 2026-08-19

**Zašto:** `split` upit koristio je samo `Status = Planiran`, bez `Izvor` uvjeta koji nosi saldo.
Broj je zato uključivao kartične stavke koje **nikad ne odlaze same** — plaća ih skupna naplata,
koja je u tom istom zbroju. Isti razred dvostrukog brojanja protiv kojeg je cijeli model građen.

**Preduvjet:** `sql/037` pušten **ponovno** nakon 2026-08-19.

1. Overview → pločica `Stanje po računu` → redak `Kokin tekući ZABA`.
   - **Očekivano:** `planirano −2.089,86 (2)`.
   - **Pad (staro stanje):** `−2.521,38 (13)`.
2. Klikni broj `planirano` → drill u Activities.
   - **Očekivano:** filtar je `Status = Planiran` (uvjet koji **razlikuje** split od salda),
     ne `Izvor = Racun` (koji je zajednički).
   - **Pad:** filtriran je Izvor — drill uzima prvi uvjet umjesto razlikovnog.

**Rezultat 2026-08-19:** `−2.089,86 (2)`. ✅ (korak 2 nije zasebno provjeren)

---

## T-S112-3 ⭐ Delta sheet — prozor, kontrolni stupac, zelena nula — ✅ PROŠAO 2026-08-21

**Zašto:** ovo je alat kojim će Koka rješavati deltu. Sve ostalo u Fazi 1 služi njemu.

**Preduvjet:** račun mora biti odabran — drill s Overview pločice postavlja filtar atributa.

1. Overview → klikni saldo **`Sašin tekući RF`** → prebaci se na **Activities** → **Export**.
2. U modalu: kvačica **„Delta sheet — usklađenje s bankom"**, prozor **60**, profil `Financije1`.
   - **Očekivano:** modal ispisuje ime računa; polje „Prozor" je vidljivo.
   - **Pad:** kvačica je siva uz poruku „Prvo odaberi račun" — drill nije postavio filtar.
3. Download → otvori file.

| Što | Očekivano | Pad znači |
| --- | --- | --- |
| broj podatkovnih redaka | **9** | prozor ne radi ili se filtriraju krivi retci |
| prvi datum | **20.06.2026.** (danas − 60) | prozor se računa od sidra, ne od danas |
| retci | samo `Izvor = Racun` | kartične stavke su ušle (bilo bi ih ~1.000) |
| oznaka lijevo od kontrolnog stupca | `stanje 19.06.2026. ->` | dugačka oznaka se prelijeva preko sažetaka |
| ćelija uz nju | **931,98** | otvarajuće stanje se ne poklapa s RPC-om |
| bilješka na toj ćeliji | spominje sidro `02.01.2025. = 3458.03` | podrijetlo se izgubilo |
| zadnji kontrolni redak (Mirovina III, 10.07.) | **712,75** | ⚠ isti broj koji pločica pokazuje za „danas" |
| skrivene kolone | one iz profila `Financije1` | profil se ne primjenjuje u delta modu |
| `Stanje (kontrola)` | **nije** skrivena, krajnje desno | profil ju je progutao |
| prazni retci | 40 komada, `session_start` `14:00 … 14:39` | vremena bi pala na `09:00` i slijepila retke |
| prepisano u praznim retcima | Area, Category_Path, **email**, `Racun`, `Izvor` | bez emaila je redak „tuđi" i tiho se preskoči |

4. U ćeliju **„u banci piše"** upiši `712,75`.
   - **Očekivano:** `razlika` = `0,00` i ćelija **pozeleni**.
   - **Pad:** `0,00` ali **crveno** — greška zaokruživanja (`ROUND` nije primijenjen; zbroj
     `SUMIFS`-a nosi ~`1e-13` pa nula nije stvarna nula).
5. Upiši `700,00` → razlika `−12,75`, ćelija **crvena**.

**Rezultat 2026-08-21:** 9 redaka, otvarajuće `931,98` s bilješkom o sidru, zadnji kontrolni
`712,75`, razlika `0,00` **zelena**. ✅ (korak 5 nije zasebno provjeren.) Prozor je krenuo od
`22.06.` a oznaka glasi `stanje 21.06.2026.` — test je pisan 19.08., prozor se pomiče s danas,
istih 9 redaka jer između 20. i 25.06. nema RF prometa.

---

## T-S112-4 ⭐ Uvoz ispunjenog delta sheeta (tranša 1) — ✅ PROŠAO 2026-08-21

**Zašto:** ovo je prvi pravi uvoz kroz novi mehanizam i istovremeno **tranša 1** delte.
Ako prođe, ostatak delte je isti postupak ponovljen.

**Podaci koji se unose** (iz `Financije 2026-08-16.xlsx`, sheet `sasa EU`):

| Datum | Opis | Uplata | Isplata |
| --- | --- | --- | --- |
| 15.07.2026. | RF naknada | | 2,78 |
| 25.07.2026. | PassSport | | 39,00 |
| 27.07.2026. | Claude | | 22,79 |
| 27.07.2026. | Claude | | 22,50 |
| 01.08.2026. | Mirovina I stup | 1.006,75 | |
| 03.08.2026. | Mirovina II stup | 92,54 | |
| 04.08.2026. | Naknada | | 11,00 |

⚠ **Uz to jedan ISPRAVAK postojećeg retka:** `Mirovina III stup` od 10.07.2026. ima u bazi
`250,93`, a Koka ga je ispravila na **`253,51`**. Bez tog ispravka kontrolni broj ne izlazi.

1. U delta sheetu popuni gornjih 7 redaka u prazne retke (ne diraj `session_start`).
2. U postojećem retku `Mirovina III stup` promijeni `Uplata` u `253,51`.
3. Provjeri kontrolni stupac **prije uvoza**:
   - **Očekivano:** zadnji redak (04.08.) = **`1.716,55`**.
4. Uvezi file.
   - **Očekivano:** `7 New`, `1 Modify` (update-guard traži potvrdu za Mirovinu),
     ostalo skipped, plus upozorenje **„33 praznih redaka predloška preskočeno"**.
   - **Pad:** greške tipa „event_date is required" za prazne retke — pravilo o retku predloška
     ne radi.
5. Overview → `Date To` = **04.08.2026.** → `Sašin tekući RF` mora dati **`1.716,55`**.

⚠ **Kontrolna brojka dolazi iz Kokinog lanca**, dakle iz izvora neovisnog o aplikaciji.

**Rezultat 2026-08-21:** `7 Created / 1 Updated / 8 Unchanged / 0 Deleted`, upozorenje
„33 praznih redaka predloška preskočeno", Modify popis sadržavao **samo** `Uplata 250,93 → 253,51`
(dakle `Datum naplate` se više ne javlja kao promjena — usput potvrda T-S112-1).
Overview `Date To = 04.08.2026.` → `Sašin tekući RF` = **1.716,55 €**. ✅
Prazan slučaj T-S112-5 time je također pokriven; ostaje provjeriti **započet** redak predloška.

---

## T-S112-5 Redak predloška: prazan se preskače, započet pada

**Zašto:** prazni retci nose prepisani `Area`, pa ih parser inače vidi kao prave retke i svaki
neiskorišteni prijavi kao „event_date is required" — 40 grešaka na 40 praznih redaka.
Ali tiho gutanje retka koji je korisnik **počeo** puniti bilo bi gore od poruke.

1. U svježem delta sheetu **ne diraj ništa** → uvezi.
   - **Očekivano:** upozorenje „40 praznih redaka predloška preskočeno", nula grešaka.
2. U jednom praznom retku upiši **samo iznos** (`12,34`), bez datuma i opisa → uvezi.
   - **Očekivano:** **greška** „event_date is required" za taj redak.
   - **Pad:** redak se tiho preskočio — iznos je progutan.
3. U jednom praznom retku upiši **samo opis** (`test`), bez datuma → uvezi.
   - **Očekivano:** isto, greška.

---

## T-S112-6 Sidro nakon usklađenja (zatvaranje petlje)

**Zašto:** sidro pretvara sljedeće usklađenje iz „prođi kroz povijest" u „prođi kroz zadnjih
par dana". ⚠ Ali broj mora doći **s ekrana banke** (§2.17) — sidro upisano po onome što
aplikacija već pokazuje čini provjeru tautološkom i usklađenje umire bez vidljive greške.

1. Nakon T-S112-4, otvori bankovnu aplikaciju i pročitaj stvarno stanje RF-a.
2. Overview → `Date To` = današnji datum → upiši broj u polje „u banci" → **Potvrdi**.
   - **Očekivano:** Δ čip pokazuje razliku prema aplikaciji; nakon potvrde saldo = potvrđeni broj.
3. Ponovi T-S112-3 (novi delta sheet).
   - **Očekivano:** prozor sada kreće **od dana nakon novog sidra**, ne od „danas − 60",
     i otvarajuće stanje je **potvrđeni** broj.

---

## Brojke izmjerene u S112 (ne procijenjene)

| Što | Vrijednost |
| --- | --- |
| `planirano` prije/poslije `Izvor` filtra | `−2.521,38` (13) → **`−2.089,86`** (2) |
| razlika = kartične stavke koje plaća skupna naplata u istom zbroju | `431,52` |
| delta prozor 60 dana: redaka koji miču saldo | RF **9**, ZABA **15** |
| otvarajuće stanje 19.06.2026. | RF **931,98**, ZABA **1.978,09** |
| `datetime` atributa u cijeloj TEST bazi | **2** (`Datum naplate`, `Due Date` u Demo) |
| Kokini Visa retci 01–06/2026 koji već postoje u bazi | **207 od 208** |
| Kokini MC retci naplaćeni 11.08. koji već postoje | **12 od 45** |
| retci u bazi s `Datum naplate = 11.07.` | 73 kom / `2.231,02` — banka je tog dana skinula **`1.244,74`** |
