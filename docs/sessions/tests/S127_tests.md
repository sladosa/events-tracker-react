# S127 — testovi

**Tema:** shortcut je zamrzavao IZVEDENE vrijednosti, pa je `set_attribute`
pravilo ostajalo bez učinka (BUG-S127-PRESETFREEZE).

**Preduvjeti za sve testove:** Area `Financije_all`, PROD, Kokin račun (ili Sašin
kao write grantee). ⚠ **Hard refresh prije početka** (Ctrl+Shift+R; na mobitelu
zatvori i ponovno otvori aplikaciju) — stari bundle nema popravak, a razlika se
vidi tek u ponašanju.

---

## T-S127-1 ⭐ `Datum naplate` se konačno računa iz `Izvora`

Ovo je izvorna prijava od 04.09.2026.

1. Activities → Area `Financije_all`, kategorija `Transakcija`.
2. **Add Activity.**
3. Pogledaj polje **`Datum naplate` PRIJE nego išta odabereš.**
4. Odaberi `Racun` = `Kokin tekući ZABA`.
5. Odaberi `Izvor` = **`Racun`**.

**Očekivano:**
- korak 3: `Datum naplate` je **prazan**. (Prije popravka: `11.10.2026.`)
- korak 5: `Datum naplate` se popuni na **današnji dan**, `Status` na `Izvrsen`.

**Pad:** polje već u koraku 3 nosi datum, ili nakon koraka 5 pokazuje bilo što
osim današnjeg dana. Ako pokazuje `11.10.2026.`, popravak nije stigao do
preglednika — ponovi hard refresh prije nego prijaviš pad.

---

## T-S127-2 Mastercard i dalje daje svoj datum, i vraća se natrag

Čuva da popravak nije ugasio pravilo nego samo maknuo ono što ga je blokiralo.

1. Add Activity, `Racun` = `Kokin tekući ZABA`.
2. `Izvor` = **`Mastercard`** → zapamti `Datum naplate` i `Status`.
3. Promijeni `Izvor` natrag na **`Racun`**.

**Očekivano:**
- korak 2: `Datum naplate` = **11. u sljedećem mjesecu**, `Status` = `Planiran`.
- korak 3: `Datum naplate` **skoči na današnji dan**, `Status` na `Izvrsen`.

**Pad:** nakon koraka 3 ostane listopadski datum — to je točno stara greška, samo
kroz drugi ulaz.

---

## T-S127-3 Ručni unos se i dalje poštuje

Popravak ne smije početi gaziti ono što je čovjek upisao.

1. Add Activity, `Izvor` = `Racun` (`Datum naplate` = danas).
2. **Rukom promijeni** `Datum naplate` na neki drugi dan.
3. Promijeni `Izvor` na `Mastercard`, pa natrag na `Racun`.

**Očekivano:** tvoj ručno upisani datum **ostaje** kroz cijeli korak 3.

**Pad:** pravilo prepiše ručni unos.

---

## T-S127-4 ⭐ Nov shortcut ne nosi izvedene vrijednosti

1. Add Activity, popuni: `Racun`, `Izvor = Mastercard`, `Tip`, `Podtip`, iznos.
   `Datum naplate` se sam popuni na 11. sljedećeg mjeseca, `Status` na `Planiran`.
2. **Save as Shortcut** → spremi pod novim imenom (npr. `TEST-S127`).
3. Otiđi s ekrana i vrati se: Activities → `Transakcija` → **Add Activity**.
4. Odaberi shortcut `TEST-S127` (⚡ Shortcuts) ako već nije odabran.
5. Odaberi `Izvor` = **`Racun`**.

**Očekivano:**
- korak 4: vrate se `Racun`, `Izvor = Mastercard`, `Tip`, `Podtip` — i pravilo
  **okine na učitavanju**: `Datum naplate` = **11. sljedećeg mjeseca računat od
  DANAS**, `Status` = `Planiran`.
- korak 5: `Datum naplate` skoči na **današnji dan**, `Status` na `Izvrsen`.

**Pad:** `Datum naplate` pokazuje 11. u mjesecu koji slijedi **danu kad je
shortcut spremljen**, a ne današnjem danu. To znači da je datum došao iz snimke
umjesto iz pravila — dakle stara greška.

⚠ Ovo je test **Sašine točke A**: shortcut smije nositi `Izvor` (to je odluka
čovjeka), a `Datum naplate` se iz njega **izračuna pri svakoj upotrebi**. Razlika
se najjasnije vidi ako shortcut spremiš krajem mjeseca a upotrijebiš ga idući —
tada snimka i pravilo daju **različit** mjesec.

⚠ Poslije obriši `TEST-S127` (⚡ Shortcuts → ✕), da ne ostane u popisu.

---

## T-S127-5 Kokin postojeći preset `Isplata` je izliječen bez diranja baze

Preset `ae04685d` (spremljen 02.09.) **i dalje nosi** `datum_naplate =
2026-10-11T12:00` u bazi — popravak ga ignorira pri primjeni, umjesto da se
zapis mijenja. Ovaj test provjerava da to doista tako radi.

1. Pod **Kokinim** računom: Activities → `Financije_all` → `Transakcija`.
2. Add Activity — preset `Isplata` se **sam odabere** (nitko ga ne klika).
3. Pogledaj koja su polja popunjena.

**Očekivano:** popunjeni su `Racun`, `Smjer`, `Tip`, `Podtip` (ono što je Koka
odabrala), a `Datum naplate` je **prazan**.

**Pad:** `Datum naplate` = `11.10.2026.`

⚠ Zastarjeli ključ nestaje iz baze sam, prvi put kad se taj shortcut ponovno
spremi (`Save as Shortcut` → *Update*). Do tada je bezopasan.

---

## T-S127-6 Zapis od 04.09. je ispravljen

`event 7a84bcd1-e4aa-4fef-b0b3-f469c513ffbd` (04.09.2026., `Bankovni troškovi`,
`11,50`) nosio je `datum_naplate = 2026-10-04` — dan je bio ispravljen u Editu,
mjesec je ostao listopad.

1. Activities → nađi taj redak (04.09.2026., `Bankovni troškovi`).
2. View / Edit → pogledaj `Datum naplate`.

**Očekivano:** `04.09.2026.` (isti dan, jer je `Izvor = Racun`).

**Pad:** `04.10.2026.` — ispravak nije napravljen.

---

## T-S127-7 Nacrt (`Resume`) — ista bolest, druga vrata?

Mjerenje, ne popravak. Nacrt ne pamti je li `Datum naplate` upisao čovjek ili
pravilo, pa se popravak ne smije napraviti napamet.

1. Add Activity → `Racun` = `Kokin tekući ZABA`, `Izvor` = **`Mastercard`**,
   upiši iznos. `Datum naplate` = 11. sljedećeg mjeseca.
2. Pričekaj ~6 s (auto-save piše svakih 5 s), pa **back gumbom** izađi.
3. Vrati se u **Add Activity** → prihvati **`Resume Previous Session?`**.
4. Promijeni `Izvor` na **`Racun`**.

**Što mjerimo:** pomakne li se `Datum naplate` na današnji dan (kao u T-S127-2),
ili ostane listopadski.

⚠ **Ostane li listopadski, to NIJE nužno bug** — možda je čovjek taj datum
upisao rukom, a nacrt tu razliku ne pamti. Zabilježi rezultat; odluka o popravku
(nositi `autoFilledValues` u nacrtu) dolazi poslije mjerenja.

---

## T-S127-8 ⭐ Edit sada evaluira `set_attribute` (slika 3)

Do S127 je Edit izvodio samo `depends_on.default_map`, a `set_attribute` nikako.
Nesimetrija je bila zamka: `Status` se poslušno pomakne, `Datum naplate` šuti —
pa izgleda kao da su se pomaknula oba. Tako je 04.09.2026. nastao redak s
`Izvor = Racun` i datumom naplate u listopadu.

1. Otvori postojeći redak s `Izvor = Racun` → **Edit**.
2. Promijeni `Izvor` na **`Mastercard`**.
3. Promijeni `Izvor` natrag na **`Racun`**.
4. Promijeni `Izvor` na prazno (ako se ponudi) ili promijeni **`Racun`** (račun),
   čime se `Izvor` očisti.

**Očekivano:**
- korak 2: `Datum naplate` = **11. sljedećeg mjeseca**, `Status` = `Planiran`.
  (Prije S127: datum se **nije mijenjao** — to je slika 3.)
- korak 3: `Datum naplate` = **datum tog retka**, `Status` = `Izvrsen`.
- korak 4: `Datum naplate` **ostaje** na zadnjoj vrijednosti — ne prazni se.

**Pad:** datum se ne miče (popravak nije stigao), ili se u koraku 4 **isprazni**.

---

## T-S127-9 ⚠ Otvaranje retka ne smije NIŠTA promijeniti

Ovo je zaštita, ne feature — i važnija je od T-S127-8.

1. Nađi kartični redak čiji `Datum naplate` **ne slijedi pravilo** — npr. bilo
   koji Visa redak (izmjereno: Visa se naplaćuje 5., 4., 6., 7., 11. i 3. u
   mjesecu, dakle `next:3` vrijedi za manjinu).
2. Zapamti mu `Datum naplate`.
3. Otvori ga u **Editu**, **ne diraj ništa**, i spremi (`Save → View`).
4. Provjeri `Datum naplate`.

**Očekivano:** **nepromijenjen.**

**Pad:** datum se pomaknuo na `next:3`. To bi značilo da se pravilo evaluira pri
**otvaranju** umjesto pri promjeni — i tihо bi prepisalo stvarne datume s izvoda
na 855 Visa redaka. Ovo je razlog zašto okidač mora biti čovjekov potez.

---

## T-S127-10 Promjena DATUMA u Editu i dalje ne miče `Datum naplate`

Poznata rupa (CLAUDE.md, „delta-shift"), **nije** dirana u S127. Test postoji da
se zna da je svjesna, a ne previd.

1. Edit bilo kojeg retka s `Izvor = Racun` (`Datum naplate` = datum retka).
2. Promijeni **datum aktivnosti** u zaglavlju na neki drugi dan.
3. Pogledaj `Datum naplate`.

**Očekivano (današnje ponašanje):** `Datum naplate` **ostaje star**, iako bi po
pravilu `Racun → same` trebao pratiti novi datum.

⚠ Ako ovo počne smetati u radu, popravak je mali (`handleDateTimeChange` zove
istu derivaciju), ali nosi isti rizik kao T-S127-9 — pa mora ići uz odluku, ne
usput.
