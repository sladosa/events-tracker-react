# S188 — testovi (2026-10-29)

Dvije želje iz T-S187-2 (Saša): sklapanje razina u Structure **View** panelu; Restructure sheetovi na
engleskom, s primjerima u pravim stupcima. Kod je na `test-branch`, nije deployan, bez migracije.

---

## T-S188-1 ⬜ (TEST, `npm run dev`) View panel: razine se sklapaju

**Automatski:** nema (čisti UI, jedan file `CategoryDetailPanel.tsx`); E2E koji otvaraju View
(`S133_structure_event_count`) čitaju samo zaglavlje i ne ovise o sklapanju.

**Koraci:**
1. Structure → redak `Fitness_Garmin > Activity > Gym > Strength` → View.
2. Gledaj razine L1 `Activity`, L2 `Gym`, L3 `Strength`.
3. Klikni na zaglavlje `Activity` ⇒ otvori se; opet ⇒ zatvori se.
4. Gore desno **Expand all** ⇒ sve tri otvorene, natpis postaje **Collapse all** ⇒ sve zatvorene.
5. Otvori `Activity`, pa **Next** (ili Prev) na drugi čvor, pa natrag.
6. Zatvori View i otvori ga ponovo na istom čvoru.
7. View na Areu (`Fitness_Garmin`) i na `Activity` (L1).

**Očekivano:**
- 1–2: otvorena je **samo** `Strength` (razina kliknutog čvora); `Activity` i `Gym` su sklopljene, sa
  strelicom ▶ i brojem atributa u zaglavlju („12 attrs", „no attrs").
- 5–6: svaki novi čvor i svako novo otvaranje kreće od zadanog (otvorena samo njegova razina) —
  sklapanje se **ne pamti**.
- 7: Area izgleda kao prije (popis kategorija); na `Activity` je otvorena `Activity`.

**Pad:** sve razine otvorene ili sve sklopljene na otvaranju; zapamćeno stanje s prošlog čvora; klik
na zaglavlje ne radi.

---

## T-S188-2 ⬜ (TEST, `npm run dev`) Restructure sheetovi: engleski + primjeri

**Automatski:** unit `restructureSheet.test.mjs` (44; pravi export oba sheeta ⇒ 0 pročitanih redaka;
svaki primjer prolazi parser; sabotaža „čitač ne staje na HELP" pada 4) i E2E `S179_restructure_apply_undo`
(novi stupci `Step` / `Category` / `when: tip` / `set: tip`), `S186_attr_restructure`.

**Koraci:**
1. Structure → Area `Fitness_Garmin` → Export.
2. Sheet **`Restructure options`** (više nema `Preuređivanje`): zaglavlje `Step | Category | when: … | set: … |
   event_id | Note`; ispod dva prazna retka uputa `HELP — restructure MENU OPTIONS …` na engleskom.
3. Ispod upute: `EXAMPLES — never imported …`, pa sivi retci u pravim stupcima, svaki s objašnjenjem
   `↑ 1. Rename …` ispod. Vrijednosti su iz tvoje Aree (npr. `strength-type` = Upp/Low…, `exercise-name`).
4. Sheet **`Restructure attributes`**: isto — uputa, pa primjeri `change type` (number, mm:ss, map, → text),
   stupac `Conversion` je sada širok.
5. Uvezi file **nepromijenjen** ⇒ nema faze preuređivanja (primjeri se ne izvode), `Attributes updated` 0.
6. U istom fileu preimenuj sheet `Restructure options` u `Preuređivanje`, u redak 2 upiši bilo što
   (npr. `1` u `Step`), uvezi.
7. (Po želji) kopiraj primjer 1 iz `Restructure options` u redak 2 (iznad HELP) i uvezi ⇒ pojavi se
   pregled preuređivanja s jednim korakom — **ne primjenjuj**, zatvori.

**Očekivano:**
- 2–4 kako piše; primjeri su vidljivo drukčiji od retka za upis (sivo, kurziv, okvir).
- 5: ništa se ne mijenja.
- 6: upozorenje `Sheet "Preuređivanje" was NOT read — it is now called "Restructure options" …`.
- 7: pregled pokaže korak 1 (preimenovanje) s brojem redaka.

**Pad:** primjer pročitan kao korak (pregled preuređivanja uz nepromijenjen file); stari sheet tiho
preskočen bez upozorenja; objašnjenje koje ne odgovara retku iznad.
