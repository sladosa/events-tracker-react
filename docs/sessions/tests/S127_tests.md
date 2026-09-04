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
- korak 4: vrate se `Racun`, `Tip`, `Podtip` — a `Datum naplate` je **prazan**
  i `Status` je **prazan**.
- korak 5: `Datum naplate` = **danas**, `Status` = `Izvrsen`.

**Pad:** shortcut vrati listopadski datum ili `Planiran`.

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

## T-S127-8 Edit ne evaluira pravila — koliko to smeta?

`set_attribute` se evaluira SAMO u Add Activity (CLAUDE.md). Ovo test **potvrđuje
zapisano ponašanje**, ne traži kvar — pitanje je isplati li se mijenjati.

1. Otvori bilo koji postojeći redak s `Izvor = Racun` → **Edit**.
2. Promijeni `Izvor` na **`Mastercard`**.
3. Pogledaj `Datum naplate` i `Status`.

**Očekivano (današnje ponašanje):** `Datum naplate` ostaje **nepromijenjen**;
`Status` se **promijeni** na `Planiran` (to radi `default_map`, koji u Editu
radi, za razliku od `set_attribute`).

⚠ Baš je ta nesimetrija zamka: jedno polje se poslušno pomakne, drugo šuti — pa
izgleda kao da su se pomaknula oba. Tako je 04.09. nastao `04.10.`
