# S149 — detaljni testovi (2026-09-25)

> Sesija je bila **bugovi** (korak 2 Sašinog redoslijeda iz S147). Pet popravaka, svaki s
> automatskim testom koji je provjeren i **u drugom smjeru** (sabotaža mora pasti). Ručni
> testovi ovdje mjere ono što automatski ne može: uvoz protiv prave baze i izgled na PROD-u.

---

## T-S149-1 ✅ Kriv e-mail u koloni G zaustavi uvoz umjesto da napravi duplikat

**Što je popravljeno:** `BUG-S148-G`. Redak koji **postoji** pod drugim autorom, a kolona G ga
prikazuje kao uvoznikov, uvoz je slao u INSERT uz poruku *„not found in database"* — S148 je
tako napravio 7 duplikata na PROD-u.

**Preduvjet:** Kokin račun (vlasnica `Financije_all`), i bilo koji **Sašin** redak u toj Arei.
Radi se na **TEST-u** ako ima takav redak; na PROD-u je bezopasno jer uvoz **ne smije** ništa
upisati — ali tek nakon deploya.

1. Export Activities s nekoliko redaka, od kojih je barem jedan Sašin.
2. U fileu: na Sašinom retku promijeni opis (da `row_hash` ne preskoči redak) i u koloni G
   upiši **Kokin** e-mail.
3. Import pod Kokinim računom.
   **Očekivano (preview):** crvena kutija *„Uvoz se ne može pokrenuti: 1 redak postoji u bazi
   pod DRUGIM autorom…"* s brojem retka filea; **Apply je siv**, tooltip spominje kolonu G.
4. Vrati Sašin e-mail u kolonu G, ponovo import.
   **Očekivano:** crvene kutije nema, nudi se *Fix as owner*; nakon Applyja redak je
   **ažuriran**, ne dodan (broj redaka u listi isti).

**Pad:** Apply dostupan u koraku 3, ili nakon koraka 4 postoje dva retka istog dana i iznosa.

⚠ Automatski dio čuva `src/lib/__tests__/importForeignRows.test.mjs` (5 tvrdnji; sabotaža
ruši 3). On mjeri **odluku**, ne ožičenje modala — zato ovaj test.

---

## T-S149-2 ✅ „Restoring filter…" ne može zapeti zauvijek

**Što je popravljeno:** `FilterContext.doRestore` ima rok od 8 s; na isteku zadrži Areu,
pusti kategoriju, i kaže to trakom *„Baza nije odgovorila na vrijeme…"*.

**Čuva:** `e2e/tests/S149_restore_deadline.spec.ts` — svi `categories` zahtjevi vise zauvijek.
Prolazi; s rokom od sat vremena (staro ponašanje) pada na `toBeHidden` spinnera.

Ručno se ne ponavlja: stanje „zahtjev bez odgovora" se rukom ne da proizvesti. Ako se na
slaboj mreži ikad opet vidi spinner dulje od ~10 s — to je nov kvar, ne ovaj.

---

## T-S149-3 ✅ Structure file bez kolone `HiddenInAdd` ne briše skrivanje

**Što je popravljeno:** nema kolone ⇒ `hidden_in_add` iz baze ostaje. Usput: `TRUE` na
**bilo kojem** retku atributa sada skriva (kao `IsRequired`), ne samo na prvom.

**Preduvjet:** **TEST**, Area s atributom koji ima `hidden_in_add` (kvačica „Hidden in Add"
u Structure Edit panelu). Ako ga nema, uključi ga na jednom atributu.

1. Structure → Export.
2. U fileu **obriši cijelu kolonu** `HiddenInAdd` (ne samo vrijednost). Promijeni i nešto
   bezazleno na tom atributu (npr. `Description`), da uvoz ima razlog pisati.
3. Structure → Import.
4. Otvori Add Activity u toj kategoriji.
   **Očekivano:** atribut je i dalje **skriven** (vidi se tek uz „Show all").
5. Protuprovjera: ponovo export, u koloni `HiddenInAdd` tog atributa **isprazni ćeliju**, import.
   **Očekivano:** atribut se sada **vidi** — prazna ćelija u postojećoj koloni i dalje znači „ne".

**Pad:** u koraku 4 atribut vidljiv ⇒ zastavica je obrisana.

⚠ **Test vrijedi samo ako je uvoz atribut STVARNO PREPISAO** (izmjereno S149): bez toga
zastavica preživi i nad starim kodom. Dokaz je promijenjen `Description` u panelu nakon
uvoza. Prvi pokušaj 25.09. nije ga imao — file nije bio spremljen (Ctrl+S) — pa je
„ostalo skriveno" bilo tvrdnja bez mjerenja. Drugi uvoz istog filea javio je `Attributes
updated 1`, što je i pokazalo da prvi nije pisao.

⚠ Automatski dio: `src/lib/__tests__/structureHiddenInAdd.test.mjs` (7 tvrdnji; sabotaža ruši 2).

---

## T-S149-4 ✅ Nacrt Add Activityja ne prelazi između TEST-a i PROD-a

**Što je popravljeno:** ključ `et_activity_draft` nosi ref baze (`dbScopedKey`).

**Čuvaju:** `S121_draft_after_finish.spec.ts` i `S122_no_phantom_draft.spec.ts`, koji ključ
sada grade istim putem kao app. 3/3 prolaze; s golim ključem u appu padaju 2 (oni koji traže
da nacrt **postoji**; treći mjeri odsutnost pa ključ ne vidi).

⚠ Jednokratna posljedica: nacrt koji je stajao pod starim ključem nestane pri prvom otvaranju
nove verzije.

---

## T-S149-5 ✅ Pločica kaže „zadnja promjena salda"

**Preduvjet:** nakon deploya, PROD, `Financije_all` → Overview.

1. Pogledaj redak `Sašin tekući RF` i `Kokin tekući ZABA`.
   **Očekivano:** ispod salda piše *„zadnja promjena salda 15.09.2026. · prije N dana"*
   (ne više „zadnji zapis").

**Pad:** i dalje „zadnji zapis" ⇒ stari bundle — hard refresh (Ctrl+Shift+R).

⚠ Narančasta boja i dalje pali nakon `STALE_DAYS` — to je namjerno netaknuto; ako na RF-u
smeta i uz nov natpis, sljedeći korak je da boja ne pali za račun kojim se plaća karticom.
