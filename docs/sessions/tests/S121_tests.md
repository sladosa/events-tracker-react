# S121 — testovi (2026-08-28)

Sesija je nastala iz dva Sašina nalaza s PROD-a: **duplikat od 2,70 €** i **nestali Overview
tab s iznosima**. Oba su ispala veća nego što su izgledala.

**Automatizirano u ovoj sesiji (ne traži ništa od tebe):**
`e2e/tests/S121_draft_after_finish.spec.ts` (T-S121-1) i
`e2e/tests/S121_area_context_failure.spec.ts` (T-S121-2, tri slučaja).
Oba su provjerena **i u drugom smjeru** — s vraćenim kodom padaju.

---

## T-S121-1 — Finish ne ostavlja nacrt ✅ AUTOMATIZIRAN

**Zašto:** `finish()` je zvao `clearDraft()` ali ne i `stopAutoSave()`, pa je interval 15 s
kasnije vratio nacrt s vrijednostima upravo spremljenog eventa. Sljedeći Add Activity je
ponudio „Resume Previous Session?", i Resume + Finish je upisao **isti redak drugi put**
(2,70 € na `session_start` 09:51 i 09:53).

Pokriva `S121_draft_after_finish.spec.ts`. Izmjereno: bez popravka nacrt se vrati na t+15 s
(385 B, jedna poruka `[AutoSave] Draft saved`); s popravkom nikad, i nema nijednog tika.

---

## T-S121-2 — neuspjelo čitanje postavki Aree se prijavljuje ✅ AUTOMATIZIRAN

**Zašto:** jedno palo čitanje `areas` ugasilo je Overview tab, kratice računa, iznose i
„Write access" baner — trajno, do reloada. Pokriva `S121_area_context_failure.spec.ts`,
tri slučaja: prolazna greška se proguta retryjem, trajna digne traku, gumb je počisti.

---

## T-S121-3 — ⭐ duplikat se više ne događa (PROD, nakon deploya)

**Zašto:** ovo je točno onaj tok koji je u S121 proizveo duplikat. Automat ga pokriva na
TEST-u i na seed Arei; ovo ga potvrđuje ondje gdje se dogodio.

**Preduvjet:** PROD, **Ctrl+Shift+R** nakon deploya (inače vrtiš stari bundle).

1. `Financije_all > Transakcija` → **Add Activity**
2. Popuni jedan pravi redak (Racun, Izvor, Smjer, iznos, Tip, Podtip, opis)
3. **Finish** → pojavi se „Activity Saved!"
4. **Go to Home**
5. Odmah opet **Add Activity**

**Očekivano:** forma je **prazna**, nikakav dijalog se ne pojavljuje.
**Pad:** iskoči „Resume Previous Session?" — javi odmah, i **ne** kliknuti Resume.

⚠ Korak 4 nemoj preskočiti čekanjem: kvar se prije javljao **15 s** nakon Finisha, pa bi
brzi prolaz mogao proći i na pokvarenom kodu. Ako želiš biti siguran, između koraka 3 i 5
**pričekaj pola minute** na success dijalogu.

---

## T-S121-4 — nacrt sada stvarno čuva nedovršen unos (PROD)

**Zašto:** do S121 auto-save **nikad nije radio** — interval se rušio na svakom renderu.
Jedini upis nacrta bio je `Save +`, a Financije ga imaju ugašen ⇒ Koka nije imala nikakvu
zaštitu od gubitka unosa. Ovo provjerava da je sada ima.

1. **Add Activity**, popuni 3–4 polja, **ne** pritiskaj Finish
2. Pričekaj ~10 s
3. **Zatvori tab** (ne Cancel, ne Finish)
4. Otvori app ponovno → `Financije_all > Transakcija` → **Add Activity**

**Očekivano:** pojavi se „Resume Previous Session?"; **Resume Session** vrati polja onako
kako su ostavljena. Zapis u bazi **ne postoji** dok se ne pritisne Finish.
**Pad:** nema dijaloga (nacrt se ne piše), ili Resume vrati prazna polja.

5. Ponovi 1–3, ali u koraku 3 pritisni **✕ (Cancel)** umjesto zatvaranja taba

**Očekivano:** sljedeći Add Activity **nema** dijaloga — Cancel briše nacrt.

---

## T-S121-5 — traka kad postavke Aree ne mogu doći (opcionalno)

**Zašto:** ovo je kvar koji je Sašu natjerao da pomisli da su podaci nestali. Automat ga
pokriva u sva tri smjera, pa je ovo „vidjeti svojim očima", ne nužnost.

1. DevTools → **Network** → padajući `No throttling` → **Offline**
2. U filtru promijeni Areu na drugu **pa natrag** na `Financije_all`

**Očekivano:** amber traka *„Nisam uspio učitati postavke ove Aree… **Podaci su netaknuti**"*
s gumbom **Pokušaj ponovno**.

3. Vrati **No throttling** → klikni **Pokušaj ponovno**

**Očekivano:** traka nestaje, Overview tab i kolona `Iznos` se vraćaju.
**Pad:** tab i iznosi nestanu **bez** trake (staro ponašanje), ili traka ostane nakon
uspješnog ponovnog pokušaja.

---

## T-S121-6 — `e16-filter-persistence` je flaky (za Claudea, ne za Sašu)

**Zašto:** pada kao čist timeout od 120 s, i to **i na kodu bez izmjena iz S121**
(izmjereno 1/3 bez, 2/3 s izmjenama — uzorak premalen da se razlikuje). To je test koji
čuva S120 popravak „filtar preživi View Details", pa dok je flaky, taj popravak **nije
čuvan**.

1. `npx playwright test e2e/tests/e16-filter-persistence.spec.ts` — pusti 5–10 puta
2. Iz `test-results/` pročitaj trace pada i utvrdi **na kojem koraku** visi

**Očekivano:** uzrok imenovan i popravljen u **spec fileu** ako je selektor, u appu ako nije.
⚠ Ne zatvarati kao „flaky pa nema veze" — to je upravo obrazac koji je u S120 sakrio
statement timeout od paralelnih workera.

---

## T-S121-7 — gotovina: razrez mora pokazati nerazvrstano (kad se gradi)

**Zašto:** izmjereno u S121 — **57 podizanja / 9.894,00 €** naspram **2 gotovinska troška /
86,00 €**. Saldo je zbog toga točan (podizanje ga miče, trošak ne), ali razrez po Tipu, kad
se sagradi, prešutio bi ~9.800 €.

**Nije test nego zahtjev na budući razrez:** mora imati vlastiti redak
`gotovina, nerazvrstano = Σ(Transfer/cash - bankomat) − Σ(Izvor = Cash)`.
Saša je odlučio da **ne** vodi svaki gotovinski trošak — pa parcijalnost mora biti
**vidljiva**, a ne skrivena.
