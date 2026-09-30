# S156 — detaljni testovi (2026-09-30)

> Sesija: **C5 faza 2** — traka „Čeka potvrdu” sada i upisuje: `Potvrdi` (skupni `Racun`
> redak + `Planiran → Izvrsen`) i `Upiši naplatu kako ju je banka skinula` (samo skupni redak,
> košara ostaje otvorena). Plus drugi prolaz u `fill_from_izvod.py --zaba`.
> Na `test-branch`, **nije na `main`**. `sql/055` pušten **samo na TEST-u** (Claude, 30.09.;
> izmjereno da `rpc_area_due_baskets` vraća isto kao prije).
> ⚠ Poslije `git pull`: **Ctrl+Shift+R** (stari bundle, S118).
> ⚠ **Merge tek nakon 11.10.** (handoff S155: prva prava MC košara ide kao usporedba), i tek
> kad Saša pusti `sql/055` na PROD-u — **prije** deploya (bez nje gumbi padnu na RPC-u).

**Gdje (T-S156-1 … 4):** `npm run dev` (**TEST**), **tvoj račun** (na TEST-u si vlasnik
`Financije_all`). Košara na TEST-u: **Mastercard · naplata 11.07.2026. · 73 stavke ·
Σ 2.231,02 €**, od toga **11** još `Planiran`, **bez** skupnog retka (banka je te košare
stvarno skinula 1.244,74 — razlika su kupovine s krivim datumom naplate, S112).
Testovi mijenjaju TEST podatke; **između testova Claude vraća stanje** (snimka 11 redaka je
u `Claude-temp_R/S156_planiran_ids.txt`) — reci „vrati” kad treba.

---

## T-S156-1 ⬜ Ne slaže se → „Upiši naplatu kako ju je banka skinula”

1. Overview → traka „Čeka potvrdu”. Zapiši stanje **Kokin tekući ZABA** na pločici ispod.
2. „banka skinula” = `1244,74`, „dana” = **11.07.2026.**
   **Očekivano:** `razlika 986,28 €` + tekst „Košara je veća od naplate…”, žuti gumb
   **„Upiši naplatu kako ju je banka skinula”**.
3. Klik → **Očekivano:** siva kutija: *Upisat ću redak TROŠKOVI UČINJENI MASTERCARD KARTICOM ·
   Kokin tekući ZABA · 11.07.2026. · 1.244,74 €* + *Retci košare ostaju „Planiran”…*.
   **Odustani** → kutija nestane, ništa upisano.
4. Ponovo klik → **Da, upiši**.
   **Očekivano:** toast „Naplata upisana”. Košara **ostaje** u traci, ali sada bez polja:
   *Naplata upisana 11.07.2026.: 1.244,74 €* + crveno **„naplaćeno — neusklađeno · razlika
   986,28 €”**, bez gumba. Stanje ZABA na pločici je **manje za 1.244,74**.
5. Activities, 11.07.2026.: jedan nov redak `TROŠKOVI UČINJENI MASTERCARD KARTICOM`,
   `Racun`, `Transfer / izmedju racuna`, isplata 1.244,74, `Status = Izvrsen`,
   `Datum naplate = 11.07.2026.`, i **zaseban redak liste** (ne stopljen s drugim).
6. F5 → traka i dalje isto (stanje se izvodi, ne pamti).

**Pad:** gumb „Potvrdi” umjesto žutog na koraku 2 ⇒ razlika bi se prešutjela (D2).
Pločica se ne pomakne ⇒ redak nije `Izvrsen` ili nije na ZABA računu. Nakon F5 opet polje za
unos ⇒ traka ne prepoznaje vlastiti redak ⇒ ponudila bi drugi (pravilo B).

---

## T-S156-2 ⬜ Skupni redak postoji i slaže se → „Potvrdi” samo prebaci statuse

Nastavak na T-S156-1 (redak 1.244,74 postoji).

1. Activities → Edit tog retka → isplata **2231,02** → Save.
2. Overview → **Očekivano:** *Naplata upisana 11.07.2026.: 2.231,02 € ✓ slaže se* i zeleni
   **„Potvrdi”**.
3. Potvrdi → **Očekivano:** kutija kaže samo *11 redaka košare prelazi „Planiran” → „Izvrsen”*
   (**bez** „Upisat ću redak”). Da, upiši.
4. **Očekivano:** toast „11 redaka potvrđeno”; traka nestane (ako je to bila jedina košara).
5. Activities 11.07.: **i dalje JEDAN** redak `TROŠKOVI UČINJENI…` (nije nastao drugi).

**Pad:** drugi redak naplate u koraku 5 ⇒ duplikat koji miče saldo. Toast „Potvrđeno X od 11” ⇒
dio redaka nije prebačen (prava) — javi broj.

➡ Reci **„vrati”** — Claude vraća 11 statusa na `Planiran` i briše skupni redak.

---

## T-S156-3 ⬜ Slaže se, nema retka → „Potvrdi” upiše redak I prebaci statuse

(Nakon što je Claude vratio stanje.)

1. „banka skinula” = `2231,02`, „dana” = **11.07.2026.** → **✓ slaže se** + zeleni **Potvrdi**.
2. Potvrdi → kutija nosi **oba** reda: *Upisat ću redak … 2.231,02 €* i *11 redaka … →
   „Izvrsen”*. Da, upiši.
3. **Očekivano:** toast „Naplata upisana · 11 redaka potvrđeno”, traka nestane, pločica ZABA
   manja za 2.231,02; u Activities jedan redak naplate.

➡ Reci **„vrati”**.

---

## T-S156-4 ⬜ Brane u traci (ništa se ne upisuje)

1. „banka skinula” = `1244,74`, **bez** dana → siva poruka *„Upiši i dan kad je banka skinula
   — s ekrana banke, ne pogađaj.”*, gumba **nema**.
2. Dan **15.07.2026.** → polje **crveno** + *„Banka tereti oko 11.07.2026. (najviše 3 dana
   razlike) — provjeri dan.”*, gumba nema. Dan **14.07.** → gumb se vrati.
3. „banka skinula” = `abc` → polje crveno, gumba nema.
4. Otvori kutiju (klik na gumb), pa **promijeni iznos** → kutija se sama zatvori (potvrda
   vrijedi samo za ono što je pisalo kad si kliknuo).
5. Uska širina (iPhone SE u DevToolsima): polja i gumbi bez vodoravnog scrolanja.

**Pad:** gumb postoji bez dana ⇒ datum bi se pogađao (BUG-S115).

---

## T-S156-5 ⬜ PROD, grantee: vidiš usporedbu, ne i gumb (nakon merge-a)

**Gdje:** PROD, **tvoj** račun (na PROD-u si write grantee `Financije_all`), kad traka nešto
pokaže (11.10.). Upiši bankin broj i dan.
**Očekivano:** ✓ / razlika se računa, a umjesto gumba *„Potvrđuje vlasnica Aree — ti vidiš
usporedbu, ali ne upisuješ.”* Polje „dana” se ne prikazuje.

---

## T-S156-6 ⬜ PROD, Koka, 11.10.: prava košara

**Gdje:** PROD, **Kokin** račun (D5), na dan kad banka skine MC (11.10.; košara ~40 stavki,
Σ 859,58 prema RPC-u 30.09.).
1. Koka upiše **iznos i dan s ekrana banke**.
2. Slaže se ⇒ Potvrdi. Ne slaže se ⇒ „Upiši naplatu kako ju je banka skinula”, pa javi razliku.
**Očekivano:** saldo ZABA isti dan jednak banci.
⚠ Ako se test radi odmah, poželjno je da Koka **jednom** upiše krivi broj i vidi „razlika”
prije pravog (S129: test mora izvesti i granu koja se ne slaže) — ali bez spremanja.

---

## T-S156-7 ⬜ `fill_from_izvod.py --zaba` ne donosi drugi skupni redak

**Kad:** kad stigne `ZABA_2026-10.pdf` (poslije T-S156-6).
1. Delta sheet ZABA iz appa (prozor uključuje 11.10.) → `fill_from_izvod.py <file> --zaba
   ZABA_2026-10.pdf --zigosi`.
2. **Očekivano:** redak `TROŠKOVI UČINJENI MASTERCARD KARTICOM` je **„već na listu
   (preskočeno)”** — ili, ako je Koka upisala dan različit od izvoda, `≈ … skupna naplata
   istog iznosa već upisana na …` s uputom za ispravak datuma. **Nikad** kao nov redak.
