# S159 — detaljni testovi (2026-10-02)

> Sesija: **ne-Financije stavke backloga** — B3 (Help zna Areu), Structure fan-out, B6 (`—` dok
> se lista učitava), D2/D4/D5 (grantee poruke), **F4 filtar za brojeve**, **C4** (lista se
> preupitavala). Sve u `src/` + `netlify/functions/help.ts`; nema migracije.
> Automatski: `attrFilterNumeric.test.mjs` (26 tvrdnji, dvije sabotaže ruše 3 i 4), `npm run check`
> zeleno, E2E e16/e17/S119/S133/e6/e12 — 11/12 (E12-2 pada na podacima TEST-a, v. dolje).
> TEST = kopija PROD-a ⇒ `Financije_all` ima prave iznose za F4.

---

## T-S159-1 ⬜ Help zna u kojoj si Arei (B3) — tek nakon deploya

Help funkcija ne radi lokalno (`netlify dev` ili PROD).

1. PROD, Area **Fitness** → Help → Ask AI: *„Kako aplikacija računa saldo računa?"*
   **Očekivano:** odgovor **prvo kaže** da Fitness nema Overview / saldo, pa ukratko gdje to postoji.
   **Pad:** objašnjava sidra i delta sheet kao da su ondje (stanje prije S159).
2. Ista pitanje u **Financije_all**. **Očekivano:** normalno objašnjenje salda, bez „ova Area nema".

## T-S159-2 ✅ Filtar za brojeve (F4) — TEST, `Financije_all > Transakcija`

1. `npm run dev` (TEST). Filter → Area `Financije_all`, kategorija `Transakcija`, All time.
2. `Filter by` → **Isplata**. **Očekivano:** uz polje stoji operator (`>` zadano), polje „npr. 1000".
3. Upiši `1000`. **Očekivano:** desno `→ 1.000,00`; lista samo retci s isplatom **> 1000**;
   chip iznad liste `> 1000 ×`.
4. Promijeni operator u `≤`. **Očekivano:** lista se odmah okrene (isplate ≤ 1000), chip `≤ 1000`.
5. Upiši `1.000`. **Očekivano:** desno `→ 1,00` (čita se kao jedan — namjerno isti parser kao
   Add forma; Help to kaže).
6. Upiši `12a`. **Očekivano:** polje **crveno**, desno crveno „nije broj — bez filtra", nema chipa, lista **bez** filtra po iznosu (svi retci).
   **Pad:** prazna lista (filtar primijenjen s nagađanjem).
7. Vrati `> 1000` → Excel Export (bez profila). **Očekivano:** broj u modalu = broj redaka liste
   (uz „load more" do kraja); u fileu list `Filter` → `Attribute filter` = `isplata: >1000`.
8. `💾` spremi shortcut, makni filtar, pa `⚡ Use` shortcut. **Očekivano:** vraća se `Isplata`
   + `>` + `1000`, ista lista.
9. Isti filtar s `=` i `0` na nekom broju koji ima nule. **Očekivano:** `= 0` je uvjet
   (nula je odgovor), ne „prazno".

## T-S159-3 ✅ Lista ne laže `—` dok se učitava (B6) — `dev:prod` ili TEST, uski ekran

1. `Financije_all`, lista s kolonama iznosa. Promijeni Areu/kategoriju i natrag.
   **Očekivano:** dok vrijednosti stižu, ćelije iznosa pokazuju **sivu traku koja pulsira**,
   nikad `—`.
2. Na dnu „Load more". **Očekivano:** stari retci zadrže iznose, **novi** kratko pulsiraju.
3. DevTools (F12) → ⋮ → More tools → **Request conditions** → uključi blokiranje → **+** →
   `*://*/rest/v1/event_attributes*` → **Enter** (crveni okvir = još se uređuje) → F5 → `Financije_all`.
   ⚠ Chrome uzorak čita kao **URLPattern**: `*/rest/...` se ne parsira, a preširok uzorak
   (npr. cijeli host) blokira i `areas` ⇒ žuta traka „Nisam uspio učitati postavke” i zadane
   kolone — to je drugi test (S121), ne ovaj. Na kraju makni kvačicu i F5.
   **Očekivano:** ćelije bez vrijednosti pokazuju narančasti `?`, ne `—`.

## T-S159-4 ✅ „Import as mine" ugašen u dijeljenoj Arei (D5) — TEST, grantee

1. Na TEST-u kao **grantee** (`userb`, ili Saša na kopiji ako ima share) izvezi Activities
   dijeljene Aree koja ima vlasnikove retke.
2. Uvezi taj isti file. **Očekivano:** ekran „Multi-user file detected"; **Import as mine je
   siv**, ispod: *„Nedostupno — ti retci žive u dijeljenoj Arei …"*. `Skip` ostaje zadan.
3. (Kontrola) Kao vlasnik uvezi file **stranca** čija Area kod tebe ne postoji.
   **Očekivano:** Import as mine je i dalje ponuđen.

## T-S159-5 ⬜ Tuđi redak s `Delete?` — poruka kaže zašto (D2) — TEST, grantee

1. Isti file iz T-S159-4: na vlasnikovom retku u koloni `Delete?` odaberi `DELETE`. Uvezi.
   **Očekivano:** u upozorenjima *„Red N: redak je označen DELETE, ali pripada drugom
   korisniku (…) — brisanje tuđeg retka nije moguće. Redak je preskočen."*; ništa obrisano.
2. Provjeri u listi da vlasnikov redak i dalje postoji, **sa svim atributima**.

## T-S159-6 ✅ Manje upita (fan-out + C4) — DevTools Network

1. Activities tab, F5, Network filtar `select=id&` (⊘ Clear prije F5).
   **Očekivano:** **nema** niza od ~39 `events?select=id` upita (to je bio Structure fan-out
   na svakom učitavanju Activitiesa). Na Structure tabu ih i dalje ima — ondje su potrebni.
2. Network filtar `select=id%2Ccategory` (Chrome prikazuje zarez kao `%2C`; ⊘ Clear). Promijeni Areu (period All time).
   **Očekivano:** **2** takva upita (lista + Prev/Next), ne 3; nijedan s `event_date=gte`.
   ✅ 03.10. TEST (Saša): 2 upita, 2,4 kB + 27,9 kB.
2b. Isti filtar, ⊘ Clear, **F5** na `Financije_all`. **Očekivano:** **2** upita.
   ⚠ Izmjereno 03.10. PRIJE popravka: **6** — par za SVE Aree (obnova filtra još nije
   završila, kontekst kaže „nema Aree"; u devu ×2 StrictMode) pa par za obnovljenu Areu.
   Popravak: lista i Prev/Next čekaju `isRestored`. Playwright poslije: 6 → 2.
3. Tab **Structure** (ne Activities!) → **Export**. **Očekivano:** file `structure_….xlsx` brzo izlazi; nosi Aree iz filtra (odabrana Area ⇒ samo ona).

## T-S159-7 ✅ Structure Import i dalje osvježi tablicu — TEST

1. Structure tab → Import nekog Structure filea koji **dodaje** atribut.
2. Close. **Očekivano:** novi atribut je u tablici bez F5.
   (S159 je maknuo jedan suvišan `refetchStructure()` nakon uvoza; tablicu osvježava
   `refreshKey`.)

## T-S159-8 ✅ `⚡ Use` radi i bez leafa kad je leaf samo jedan — TEST

Sašin zahtjev iz testiranja T-S159-2: shortcut spremljen na `Financije_all > All Categories`
imao je sivi `⚡ Use`, a `+` pored njega je radio (S154). Isto pravilo (`singleLeaf.ts`).

1. Shortcuts → `isplata>1000` (spremljen na `All Categories`). **Očekivano:** `⚡ Use` **nije siv**.
2. Klik `⚡ Use`. **Očekivano:** otvara se Add Activity na `Financije_all > Transakcija`.
3. Kontrola: shortcut na Arei s **više** leafova (npr. Fitness, `All Categories`).
   **Očekivano:** `⚡ Use` ostaje siv (treba birati kategoriju).

---

## Usput — E2E

- **E12-4** i **T-S119-6**: popravljen samo spec (selektor `All` je hvatao i „Collapse all";
  od S152 nepromijenjen re-import kaže „Nothing to import", ne „completed"). App ispravan.
- **E12-2 pada na podacima TEST-a**: `Health` predložak se više ne nudi (u popisu Area dva
  `Health_Sasa` — predložak je već kopiran). Nije dirano.
