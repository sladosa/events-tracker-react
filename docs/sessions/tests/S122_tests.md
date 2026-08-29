# S122 — detalji testova (2026-08-29)

Popis: [PENDING_TESTS.md](../PENDING_TESTS.md)

---

## Kontekst

Nalaz je Sašin, iz izvođenja `T-S121-3`. Kad je auto-save u S121 konačno proradio, počeo je
pisati nacrt **i za forme koje nitko nije dotaknuo**: Add Activity se pri otvaranju sam
napuni defaultima (`default_value`, preset, `default_map` — Valuta, Status, Izvor…), a prvi
tik intervala piše bezuvjetno (`lastSavedContentRef` kreće od `null`).

Izmjereno na PROD-u 29.08.2026.: **otvori Add → 6 s → back gumb → sljedeći Add nudi
„Resume Previous Session?"** nad nacrtom u kojem nema nijednog korisnikovog znaka
(`Events: 0`).

Šteta nije u podacima nego u tome što dijalog izgubi značenje: poruka koja treba značiti
„tvoj nedovršen unos je preživio" počne iskakati kad ništa nije uneseno — a upozorenje koje
laže korisnik nauči otklikati bez čitanja, i to baš na dan kad govori istinu.

**Popravak:** nacrt se piše tek kad u njemu ima nečega što je čovjek dodao
(`userTouchedRef`, [AddActivityPage.tsx:565](../../../src/pages/AddActivityPage.tsx#L565)).

---

## T-S122-1 — automat (`e2e/tests/S122_no_phantom_draft.spec.ts`)

Dva slučaja, oba prolaze (55 s, `workers: 1`):

1. otvori Add, **ništa** ne tipkaj, čekaj 12 s → nema nacrta u `localStorage`;
   back gumb → sljedeći Add **nema** dijaloga
2. otvori Add, **utipkaj** komentar, čekaj tik → nacrt postoji;
   back gumb → sljedeći Add **ima** dijalog; Discard ga počisti

⚠ Drugi slučaj postoji da prvi ne bude prazan: „nema dijaloga" prolazilo bi i kad se nacrt
uopće ne bi mogao napisati — a to je točno bio `BUG-S121-AUTOSAVE`.

**Provjereno u drugom smjeru:** s izvađenim guardom prvi slučaj **pada**, pa je guard vraćen.

---

## T-S122-2 — netaknut Add ne nudi Resume (PROD, **tek nakon deploya**)

**Preduvjet:** deploy na `main`, pa **Ctrl+Shift+R** (stari bundle daje stari odgovor).

1. `Financije_all > Transakcija` → **Add Activity**
2. **Ne diraj ništa.** Broji ~10 s
3. **Back gumb** preglednika (ne ✕)
4. Opet **Add Activity**

**Očekivano:** prazna forma, nikakvog dijaloga.
**Pad:** iskoči „Resume Previous Session?" — javi, i reci što piše u retku `Events:`.

---

## T-S122-3 — utipkan unos i dalje preživi (PROD, **tek nakon deploya**)

Ovo je druga strana istog guarda: zaštita se **ne smije** izgubiti.

1. **Add Activity**, popuni 3–4 polja, **ne** pritiskaj Finish
2. Pričekaj ~10 s
3. **Back gumb** (ili zatvori tab)
4. Opet **Add Activity**

**Očekivano:** „Resume Previous Session?" se pojavi, **Resume Session** vrati polja onako
kako su ostavljena.
**Pad:** nema dijaloga ⇒ guard je pretjerao i pojeo pravu zaštitu.

⚠ Ne preskakati zbog toga što izgleda kao ponavljanje `T-S121-4`: ondje se mjerio auto-save,
ovdje guard nad njim.


---

## T-S122-4 — shortcutovi po Arei (faza 1 iz `FILTER_SPEC` §5)

**Zašto:** izmjereno na tvom telefonu 29.08. — u `Financije_all > Transakcija` dropdown je
nudio `Strength`, `Outdoor`, `Gym Z2`, `Sasa_MedVisit`, dakle **nijedan iz te Aree**, a
zauzimali su cijeli ekran (native select je na mobitelu punoekranski popis).

**Preduvjet:** deploy na PROD (ili TEST build), **Ctrl+Shift+R**.

1. Filter panel → odaberi Areu `Financije_all`
2. Uz `⚡ Shortcuts` stoji kvačica **„samo ova Area"** — uključena
3. Otvori dropdown

**Očekivano:** samo shortcutovi te Aree. Ako ih nema nijedan, piše
`— nema shortcutova u ovoj Arei (isključi kvačicu za ostale) —` (**ne** tiho pokaže tuđe).
**Pad:** vide se shortcutovi drugih area, ili je popis prazan bez ijedne poruke.

4. **Isključi** kvačicu

**Očekivano:** popis pokazuje sve, **grupirane po Arei** (naslovi grupa u dropdownu),
a svaki redak nosi sufiks tipa `Gym Z2 · 23× · 12.06.` (broj korištenja i zadnje korištenje).
**Pad:** nema grupa, ili nema brojke.

5. Promijeni Areu na neku drugu, pa se vrati — kvačica mora ostati kakva je bila
   (pamti se po pregledniku)
6. Odaberi shortcut iz **druge** Aree, pa uključi kvačicu

**Očekivano:** odabrani shortcut **ostaje vidljiv** u popisu iako nije iz te Aree — inače bi
polje izgledalo prazno nad shortcutom koji je i dalje aktivan.

⚠ Ovo **nije** granica popisa („pokaži samo 15 najkorištenijih") — ona je svjesno
izostavljena dok se ne izbroje stvarni shortcutovi (`FILTER_SPEC` §9, faza 1b).
