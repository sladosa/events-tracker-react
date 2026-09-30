# S155 — detaljni testovi (2026-09-30)

> Sesija: **C3b** (žig izvoda — Edit ne pomiče bankin datum naplate), **C3c** (upozorenje
> u Editu kad se mijenja bankin podatak na potvrđenom retku), **C5 faza 1** (traka
> „Čeka potvrdu" na Overviewu, samo čitanje, samo MC).
> Na `test-branch`, **nije na `main`**. `sql/053` + `sql/054` su pušteni na TEST-u
> (Claude) i **na PROD-u** (Saša), oboje 30.09.
> ⚠ Poslije `git pull` / prelaska grane: **Ctrl+Shift+R** (stari bundle, S118).

**Gdje (T-S155-1 … 6):** `npm run dev` (**TEST**), **tvoj račun** (`sasasladoljev59@gmail.com`
je na TEST-u vlasnik `Financije_all`). Testovi 1–4 mijenjaju TEST retke — na kraju svakog
vrati izvornu vrijednost (ili nemoj spremiti).

---

## T-S155-1 ✅ Potvrđen redak: oznaka se vidi, a reklasifikacija ne pali upozorenje

**Redak:** `Financije_all`, **07.08.2026.**, `Racun`, isplata **1.171,59**, opis s izvoda
`PBZCard d.o.o. Radnicka cesta …`, račun `Sašin tekući RF` (TEST sidro RF je na 11.08.2026.,
pa ga pokriva).

1. Otvori redak u **Edit**.
   **Očekivano:** ispod `Event #1 · …` sivo: *„✓ potvrđen izvodom (Izvod opis: „PBZCard…") ·
   unutar potvrđenog stanja računa Sašin tekući RF na 11.08.2026. (…)"*. Žutog okvira **nema**.
2. Promijeni **Podtip** (ili Tip) → **Očekivano:** žuti okvir se **ne** pojavi.
3. Vrati Podtip na staro i izađi bez spremanja (ili spremi — ništa bankino nije dirnuto).

**Pad:** žuti okvir na koraku 2 ⇒ upozorenje pali na reklasifikaciji (nauči se otklikati).
Oznake nema na koraku 1 ⇒ sidra ili config nisu učitani (F12 → Console: `[C3c]`).

---

## T-S155-2 ✅ Promjena datuma na ožigosanom retku: `Datum naplate` stoji, app kaže zašto, Save traži kvačicu

**Redak:** isti kao T-S155-1 (07.08.2026., `Datum naplate` = 07.08.2026.).

1. Edit → promijeni **datum** na **05.08.2026.**
   **Očekivano:** `Datum naplate` ostaje **07.08.2026.** Žuti okvir:
   *„Mijenjaš podatak koji dolazi iz banke"* · `Datum: 07.08.2026. → 05.08.2026.` · rečenica o
   sidru („izmjena ne pomiče saldo…") · i dolje *„Datum naplate nije pomaknut s datumom:
   redak je potvrđen izvodom…"*.
2. Klikni **Save** bez kvačice → **Očekivano:** toast *„Mijenjaš podatak s izvoda — potvrdi
   izmjenu u žutom okviru."*, stranica skroli na okvir, **ništa se ne sprema**.
3. Vrati datum na **07.08.2026.** → **Očekivano:** popis izmjena nestane (ostaje samo ako je
   nešto drugo bankino promijenjeno). **Ne spremaj.**

**Protuprovjera (S129 pravilo — test mora vidjeti razliku):** na **neožigosanom** `Racun`
retku ista promjena datuma **pomakne** `Datum naplate` (C3 iz S152 i dalje radi).

**Pad:** `Datum naplate` se pomaknuo na 05.08. ⇒ žig ne radi (je li `sql/054` pušten na TEST?).

---

## T-S155-3 ✅ Ispravak iznosa na potvrđenom retku — kvačica vrijedi samo za viđene izmjene

**Redak:** isti.

1. Edit → isplata `1171,59` → `1171,50`.
   **Očekivano:** okvir: `Isplata: 1171.59 → 1171.5`.
2. Označi kvačicu *„Da, podatak s izvoda je bio krivo upisan — spremi izmjenu"*.
3. Promijeni isplatu još jednom (`1171,40`) → **Očekivano:** kvačica se **sama skine**.
4. Vrati `1171,59` → okvir nestane. Izađi bez spremanja.
5. (Po želji, cijeli put) promijeni na `1171,50`, kvačica, **Save** → spremi se; zatim ponovo
   Edit, vrati `1171,59`, kvačica, Save.

---

## T-S155-4 ✅ Kartica na NEožigosanom retku sada prati datum (C3b)

**Redak:** `Financije_all`, **28.05.2026.**, `Mastercard`, isplata **0,90**, `Datum naplate`
= **11.06.2026.**, bez `Izvod opis`.

1. Edit → datum **02.06.2026.**
   **Očekivano:** `Datum naplate` postaje **11.07.2026.** (nova košara). Žutog okvira nema
   (redak nije potvrđen).
2. Datum natrag na **28.05.2026.** → `Datum naplate` natrag **11.06.2026.**
3. Izađi bez spremanja.

**Pad:** `Datum naplate` ostaje 11.06. na koraku 1 ⇒ C3b ne pomiče kartice.

---

## T-S155-5 ✅ Traka „Čeka potvrdu" na Overviewu

**Gdje:** TEST, `Financije_all`, tab **Overview**.

1. **Očekivano:** iznad „Stanje po računu" žuta traka *„Čeka potvrdu (1)"*:
   `Mastercard · naplata 11.07.2026. · 73 stavke` · *„od toga 11 još „Planiran""* ·
   `Σ 2.231,02 € → s računa Kokin tekući ZABA`.
   (To je stara TEST košara iz S112 s 12 krivo datiranih kupovina — zato je veća od naplate.)
2. U „banka skinula" upiši `2231,02` → **✓ slaže se**.
3. Upiši `1244,74` (stvarna naplata iz S112) → **razlika 986,28 €** + *„Košara je veća od
   naplate…"*.
4. Upiši `abc` → polje crveno, bez oznake.
5. F5 → polje prazno (ništa se ne sprema — faza 1).
6. **Mobitel** (DevTools → iPhone SE): traka stane u širinu, bez vodoravnog skrolanja.

**Pad:** traka se ne pojavi ⇒ Console/Network: `rpc_area_due_baskets`. Crvena poruka
*„Nisam uspio provjeriti…"* je **ispravno** ponašanje kad RPC padne — nije „ništa ne čeka".

---

## T-S155-6 ✅ `LockAttr` preživljava Structure roundtrip, i stari file ga ne briše

**Gdje:** TEST, Structure tab, `Financije_all`.

1. **Export** Structure → sheet `Automations`, redak „Datum naplate po Izvoru":
   kolona **`LockAttr` = `izvod_opis`**.
2. **Import** istog filea → **Očekivano:** `Automations` **0** (sivo — ništa promijenjeno).
3. U fileu **obriši cijelu kolonu `LockAttr`** (kao stari export) → Import →
   **Očekivano:** `Automations` 0; novi export i dalje nosi `izvod_opis`.
4. Vrati kolonu, ćeliju **isprazni** → Import → `Automations` **1**; novi export: `LockAttr`
   prazan. **Na kraju** upiši `izvod_opis` natrag i uvezi (ili pusti `sql/054` ponovo).

---

## T-S155-7 ✅ PROD: `sql/053` + `sql/054`, pa traka nakon deploya

> ✅ **Koraci 1–2 izvedeni 30.09.** (Saša, SQL Editor). Izmjereno REST-om: config i RPC
> odgovaraju očekivanom iz koraka 3 u cent. Ostaje korak 3 **u aplikaciji** nakon deploya, i korak 4.

**Tko:** Saša, Supabase SQL Editor na **PROD**-u. Redoslijed nije bitan prema deployu —
obje su bezopasne i prije njega (stari kod ne zna za nove ključeve ni funkciju).

1. Zalijepi `sql/053_due_baskets.sql` → Run → bez greške.
2. Zalijepi `sql/054_financije_due_and_lock.sql` → Run →
   **Očekivano:** `NOTICE … Financije_all (de8662e6-…): due + lock_slug upisani.` i ispis
   `due` bloka + pravila s `"lock_slug": "izvod_opis"`.
3. Nakon deploya, `Financije_all` → Overview. **Očekivano (izračunato iz PROD podataka
   30.09., samo čitanje):** *„Čeka potvrdu (2)"*:
   - `Mastercard · naplata 07.09.2026. · 1 stavka` · `Σ 105,30 €`
   - `Mastercard · naplata 12.09.2026. · 1 stavka` · `Σ −105,30 €`
   To je poznati par `±105,30` (B5) — **ne** u istoj košari, i ni jedan na 11. — traka ga je
   upravo zato pokazala. Ispravak ide kroz B5.
4. **11.10.** se pojavi `Mastercard · naplata 11.10.2026. · 38 stavki` (Σ ~ **859,58 €**
   na 30.09., mijenja se s novim unosima) — prvi pravi ispit: upiši što je banka skinula.

---

## T-S155-8 ✅ BUG-S155-EDITNAN — brisanje dana u polju datuma više ne kvari formu

**Nađeno u T-S155-2 (Saša, 30.09.):** vraćanje datuma u više pokušaja (obrisan dan/mjesec,
pa upisan ponovo) dalo je `Event #1 · NaN/NaN/NaN NaN:NaN:NaN`, `Duration NaNs` i sat **00:00**.
**Uzrok:** Edit polje datuma (i vremena) u zaglavlju nije provjeravalo prazan unos (Add jest):
`Number('')` ⇒ neispravan datum. Pomak je inkrementalan, pa je nakon jednog neispravnog
datuma svaki sljedeći pomak bio `NaN`; `setFullYear` nad neispravnim datumom kreće od ponoći.
Podaci nisu bili ugroženi — Save ima provjeru „vrijeme jednog zapisa je neispravno".
**Drugi dio:** godina se u polje pisala bez dopune (`2-08-07`), pa je usred tipkanja
polje bilo prazno. **Popravak:** Add i Edit dijele `src/lib/dateInput.ts` (bile su dvije
kopije i razišle su se); zaglavlje ignorira prazno polje; `handleDateTimeChange` odbacuje neispravan
datum prije ičega (brana za svakog pozivatelja).

**Gdje:** TEST, bilo koji redak u **Edit**.

1. U polju datuma klikni na **dan** i obriši ga (Backspace), pa na **mjesec** i obriši ga.
2. Upiši ih ponovo (isti datum).
   **Očekivano:** vrijeme ostaje izvorno (npr. **14:01**), `Event #1 · 2026/08/07 14:01:01`,
   `Duration 0s` — nigdje `NaN`.
3. Isto s poljem **vremena** (obriši sate) → nema `NaN`.
4. **Drugi nalaz (Saša, isti dan):** klikni na **godinu** i upiši `2` → polje pokaže
   **`0002`** (ne prazno `dd/mm/yyyy`), tekst lijevo `0002-08-07`; dopiši `026` → `2026`,
   vrijeme i dalje izvorno.
5. Isto u **Add** (Financije ima birač datuma): prazno polje i međustanje godine
   ponašaju se jednako — Add i Edit od S155 dijele `dateInput.ts`.
6. Izađi bez spremanja.
7. **Treći nalaz:** Chrome je u godinu puštao **6 znamenki** (`252026`, i u filtru `To` =
   `202566`). Sada polja imaju granice 1900–2200 ⇒ najviše 4 znamenke. ✅ Edit (Saša, 30.09.).
   **Filtar:** u `To` klikni godinu i tipkaj — staje na 4; nedovršena godina (`0002`) ne mijenja
   listu, a nakon F5 filtar nije zapamtio smeće.

---

## T-S155-9 ✅ BUG-S155-VIEWSTALE — View nakon Savea pokazuje staru vrijednost

**Nađeno u T-S155-3 korak 5 (Saša, 30.09.):** spremljeno `1171,5` → View `1171.5`; zatim
Edit → `1171,59` → Save → View i dalje **`1171.5`**. Baza je cijelo vrijeme bila ispravna
(REST: `isplata 1171.59`, upisano 11:15:25) — lagao je **prikaz**.
**Uzrok:** View čita iz `activityViewCache` (keš u memoriji modula, za brzi Prev/Next).
`invalidateCacheKey` je imao napomenu „after Edit saves new data", a **nitko ga nije zvao** —
drugi posjet istom retku dobio je snimku s prvog. Razred S132.
**Popravak:** View pri montiranju isprazni keš. Svako pisanje (Edit, Add, brisanje, uvoz) je
izvan Viewa ⇒ svaki dolazak u View počinje svježe; Prev/Next ne remontira pa prefetch ostaje.
⚠ Mogući rođak: `BUG-S131-VIEWSTALE` („Activity not found" nakon Edita koji pomakne
datum, F5 riješi) — zatvoren kao neponovljen; isti keš je vjerojatno bio uzrok.

**Gdje:** TEST, redak 07.08.2026. PBZCard (ili bilo koji svoj redak).

1. Edit → promijeni **opis** (Event Note) u `test1` → Save → View: piše `test1`.
2. Edit → `test2` → Save → **View mora pisati `test2`** (prije popravka: `test1`).
3. Edit → isprazni opis → Save → View bez opisa.
4. **Prev / Next** i natrag: prikaz ostaje ispravan i brz.
