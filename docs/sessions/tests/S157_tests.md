# S157 — detaljni testovi (2026-10-01)

> Sesija: **T-S156-1 izveden** → dva popravka i jedna nova zaštita u traci „Čeka potvrdu”.
> - `[object Object]` u traci: upit `events → categories` bez imena veze (PGRST201 — `events`
>   ima dva FK-a prema `categories`) + `retry.ts` je gubio poruku Supabase greške.
> - **Pravilo C:** prije upisa skupnog retka traka traži **ručni redak istog iznosa** na računu
>   (bilo kakav opis/Tip/Podtip). Ako ga ima: *„Je li to ova naplata?”* → **Da** = ispravak
>   (opis + Tip/Podtip iz configa, uz objašnjenje) · **Ne** = tek onda upis. Brana je i u
>   `settleBasket`, ne samo na ekranu.
> - **TEST `Financije_all` = kopija PROD-a** (01.10.2026., `Claude-temp_R/prod_to_test.py`,
>   5.292 eventa / 49.770 atributa / 20 sidara, svi retci pod tvojim TEST računom).
> Na `test-branch`, **nije na `main`**.

**Gdje (svi):** `npm run dev` (**TEST**), **tvoj račun**. Poslije svake izmjene koda Vite
osvježi sam; ako nešto izgleda staro — **Ctrl+Shift+R**.

**Polazno stanje** postavlja Claude: `python Claude-temp_R/s156_test_state.py --setup`
(idempotentno — vraća i nakon testa). Reci **„setup”** prije testa koji ga traži, ili
**„setup + plant”** za T-S157-4/5.

| košara | naplata | redaka | Σ | odnos prema sidru ZABA (06.09.) |
|---|---|---|---|---|
| **A** | MC 11.08.2026. | 47 | 1.332,52 | **prije** ⇒ upis naplate **ne miče** saldo |
| **B** | MC 11.09.2026. | 48 | 1.068,70 | **poslije** ⇒ upis naplate **miče** saldo |

U polaznom stanju obje košare nemaju skupni redak, a svi retci su `Planiran`.

---

## T-S157-1 ✅ A: ne slaže se → „Upiši naplatu kako ju je banka skinula”, saldo se NE miče

(Polazno stanje: **setup**.)
1. Overview → zapiši stanje **Kokin tekući ZABA** na pločici.
2. Traka, košara **A** (11.08.): „banka skinula” = `1300`, „dana” = **11.08.2026.**
   **Očekivano:** `razlika 32,52 €` + žuti gumb.
3. Klik → siva kutija *Upisat ću redak TROŠKOVI UČINJENI MASTERCARD KARTICOM · Kokin tekući
   ZABA · 11.08.2026. · 1.300,00 €* → **Da, upiši**.
4. **Očekivano:** toast „Naplata upisana”; košara A ostaje: *Naplata upisana 11.08.2026.:
   1.300,00 €* + crveno „naplaćeno — neusklađeno · razlika 32,52 €”.
   Pločica ZABA **ista kao u koraku 1** — naplata je prije sidra 06.09., sidro ju već sadrži.
5. F5 → traka isto (ne nudi polje za unos ponovo).

**Pad:** pločica se pomakne ⇒ redak prije sidra ulazi u saldo (pravilo „strogo nakon” palo).
Nakon F5 polje za unos ⇒ traka ne prepoznaje vlastiti redak.

---

## T-S157-2 ✅ A: skupni redak postoji i slaže se → „Potvrdi” samo prebaci statuse

Nastavak na T-S157-1.
1. Activities → redak `TROŠKOVI UČINJENI…` od 11.08. → Edit → **Smjer = Isplata** (redak iz
   T-S157-1 ga nema — kvar nađen u ovom testu, popravljen: config `settle` sada nosi `smjer`,
   a upis staje ako ga nema) → pojavi se polje Isplata `1300` → **1332,52** → Save.
   ⚠ Edit će tražiti **dodatnu kvačicu** (C3c, S155): redak je prije sidra 06.09., dakle
   unutar potvrđenog stanja. To je ispravno — označi je i spremi.
2. Overview → *Naplata upisana 11.08.2026.: 1.332,52 € ✓ slaže se* + zeleni **Potvrdi**.
3. Potvrdi → kutija **samo** *47 redaka košare prelazi „Planiran” → „Izvrsen”* → Da, upiši.
4. **Očekivano:** toast „47 redaka potvrđeno”; košara A nestane iz trake.
5. Activities 11.08.: **jedan** redak `TROŠKOVI UČINJENI…`.

**Pad:** drugi redak naplate ⇒ duplikat. „Potvrđeno X od 47” ⇒ javi broj.

---

## T-S157-3 ✅ B: slaže se, nema retka → Potvrdi upiše redak I prebaci statuse, saldo SE MIČE

(Polazno stanje: **setup**.)
1. Zapiši stanje **Kokin tekući ZABA**.
2. Košara **B** (11.09.): `1068,70`, **11.09.2026.** → **✓ slaže se** + zeleni Potvrdi.
3. Potvrdi → kutija nosi **oba** reda (*Upisat ću redak … 1.068,70 €* i *48 redaka … →
   „Izvrsen”*) → Da, upiši.
4. **Očekivano:** toast „Naplata upisana · 48 redaka potvrđeno”; košara B nestane;
   pločica ZABA = korak 1 **− 1.068,70**.

**Pad:** pločica se ne pomakne ⇒ redak nije `Izvrsen`/`Racun` ili nije na ZABA računu.

---

## T-S157-4 ✅ B: ručni redak „MC” → „Je li to ova naplata?” → Da → ispravak

(Polazno stanje: **setup + plant** — Claude podmetne redak *11.09., ZABA, Racun, isplata
1.068,70, opis „MC”, Domaćinstvo / Hrana i ostalo*, kakav bi Koka mogla upisati rukom.)
1. Zapiši stanje ZABA (ručni redak je već u njemu).
2. Košara B: `1068,70`, **11.09.2026.** → ✓ slaže se → **Potvrdi**.
3. **Očekivano:** umjesto sažetka upisa — žuta kutija *Na računu Kokin tekući ZABA već postoji
   isplata 1.068,70 € od 11.09.2026. · Tip: Domaćinstvo · Smjer: Isplata · Podtip: Hrana i
   ostalo · opis „MC”.
   **Je li to ova naplata?*** s gumbima **Da, to je ona** / **Ne, to je nešto drugo** /
   **Odustani**.
4. **Da, to je ona** → siva kutija: *Skupnu naplatu kartice s računa vodimo s opisom
   „TROŠKOVI UČINJENI MASTERCARD KARTICOM” i kao Tip = Transfer, Podtip = izmedju racuna,
   Izvor = Racun — po tome je prepoznaju traka i alati. Ispravit ću:* · Opis „MC” → … ·
   Tip „Domaćinstvo” → „Transfer” · Podtip „Hrana i ostalo” → „izmedju racuna”;
   *Iznos, račun i datum ostaju kakvi jesu.*
5. **U redu, ispravi** → toast „Redak ispravljen — sada je prepoznat kao naplata”.
   Košara B sada: *Naplata upisana 11.09.2026.: 1.068,70 € ✓ slaže se* + Potvrdi.
6. Potvrdi → samo *48 redaka …* → Da → toast „48 redaka potvrđeno”, košara nestane.
7. **Očekivano:** pločica ZABA **ista kao u koraku 1** (kroz cijeli test); Activities 11.09.:
   **jedan** redak naplate, opis `TROŠKOVI UČINJENI…`, `Transfer / izmedju racuna`.

**Pad:** u koraku 3 sažetak upisa umjesto pitanja ⇒ pravilo C ne radi ⇒ duplikat, pločica
−1.068,70 dvaput. Ako nakon koraka 5 traka **opet pita** ⇒ ispravljen redak pravilo B ne vidi.

---

## T-S157-5 ✅ B: ručni redak → „Ne, to je nešto drugo” → tek onda sažetak upisa

(Polazno stanje: **setup + plant**.)
1. Košara B: `1068,70`, **11.09.2026.** → Potvrdi → pitanje kao u T-S157-4.
2. **Ne, to je nešto drugo** → **Očekivano:** tek sada siva kutija *Upisat ću redak … +
   48 redaka …*. Klikni **Odustani** (ne upisujemo stvarni duplikat).
3. Ponovo Potvrdi → pitanje **opet** (odgovor „Ne” vrijedi samo za taj klik). **Odustani**.
4. Promijeni iznos na `1068,7` → Potvrdi → pitanje se pojavi (isti iznos, drugi zapis).
5. Promijeni iznos na `1000` → razlika 68,70 → „Upiši naplatu…” → **nema pitanja** (drugi
   iznos), odmah sažetak. Odustani.

**Pad:** korak 3 bez pitanja ⇒ „Ne” je zapamćen dulje nego što bi smio.

---

## T-S157-6 ✅ Brane u traci (prijašnji T-S156-4, na košari B)

(Polazno stanje: **setup**.)
1. `1068,70` **bez** dana → *„Upiši i dan kad je banka skinula — s ekrana banke, ne
   pogađaj.”*, gumba nema.
2. Dan **15.09.** → crveno + *„Banka tereti oko 11.09.2026. (najviše 3 dana razlike)”*,
   gumba nema. **14.09.** → gumb se vrati.
3. `abc` → polje crveno, gumba nema.
4. Otvori sažetak, pa promijeni iznos → sažetak se sam zatvori.
5. Uska širina (iPhone SE u DevToolsima): i **žuta kutija s pitanjem** (T-S157-4 korak 3)
   bez vodoravnog scrolanja.

---

**Na kraju:** reci **„restore”** — Claude vraća TEST na kopiju PROD-a
(`s156_test_state.py --restore`).
