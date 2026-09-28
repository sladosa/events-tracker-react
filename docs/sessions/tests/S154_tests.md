# S154 — detaljni testovi (2026-09-28)

> Sesija: dovršeni testovi S152 (T-S152-4/5/6 ✅) i popravak `BUG-S154-DATARANGE`.
> Na `test-branch`, **nije na `main`** ⇒ lokalni dev server (`npm run dev` = **TEST**).
> ⚠ Poslije `git pull` / prelaska grane: **Ctrl+Shift+R** (stari bundle, S118).

---

## T-S154-1 ⬜ „Data range" broji samo odabranu Areu (BUG-S154-DATARANGE)

**Što je popravljeno:** ispod `Period` je na TEST-u za `Financije_all` pisalo
`Data range: 2003-04-07 — 2027-04-30`, a Area stvarno ide `2025-01-01 → 2026-08-24`.
Izmjereno REST-om: obje granice su iz **drugih** Area (`Health > Lab Results`,
`Health_Sasa > Medical Visit`). Uzrok: pri učitavanju je Area kratko prazna, pa je upit
nad cijelom bazom mogao stići **zadnji** i pregaziti točan; isto je radilo palo čitanje
kategorija i Area bez kategorija. Isti broj je hranio `From` kod **All Time**.

**Gdje:** `npm run dev` (**TEST**), Area `Financije_all`, bez odabrane kategorije.

1. Otvori app → **Očekivano:** `Data range: 2025-01-01 — 2026-09-28` (kraj = danas, jer je
   zadnji redak 24.08. u prošlosti).
2. **F5** (to je tok u kojem je utrka nastajala), dva–tri puta → svaki put isti raspon.
3. Period **All Time** → **Očekivano:** `From = 01/01/2025`, ne `07/04/2003`.
4. Promijeni Areu (npr. `Health`) pa natrag na `Financije_all` → raspon se mijenja s Areom
   i vraća na `2025-01-01 — …`.

**Pad:** ikad `2003-04-07` ili `2027-04-30` uz `Financije_all` ⇒ pošalji sliku i što je
prethodilo (F5, promjena Aree, povratak s View details).
⚠ Ako se pojavi žuto *„Could not load the data range. Retry"* — to je **novo** i znači da je
čitanje stvarno palo; prije bi app tu tiho pokazao pogrešan raspon.

---

## Kokine prijave (28.09.) — mali iPhone, zajednički uvjeti

**Gdje:** `npm run dev:prod`, **Kokin račun** (sva tri u jednom sjedenju). U Chromeu
DevTools → *Toggle device toolbar* → **iPhone SE** (375 × 667), da je ekran njezine veličine.
⚠ Poslije `git pull`: **Ctrl+Shift+R**.

## T-S154-2 ⬜ `+` dodirnut za vrijeme učitavanja više ne propada

**Što je popravljeno:** nakon otvaranja app obnavlja zadnji filtar, a dok to traje `+` je bio
**ugašen** — dodir nije radio ništa i nije rekao ništa. Poruka koja je trebala reći zašto bila
je mrtva (ugašen gumb ne okida klik). Sada gumb zapamti dodir: vrti kružić i otvori Add čim
se filtar učita.

1. Filtar na `Financije_all > Transakcija`. DevTools → *Network* → throttling **Slow 3G**.
2. **F5** i odmah, dok se filtar još učitava, dodirni `+`.
3. **Očekivano:** na `+` se vrti kružić, pa se **sam** otvori Add za `Transakcija` — jedan dodir.
4. Vrati throttling na *No throttling*.

**Pad:** dodir ne napravi ništa (bez kružića) ⇒ pošalji sliku.

## T-S154-3 ⬜ Area s jednim leafom: `+` ide ravno na njega

**Što je popravljeno:** na `Financije_all > All Categories` `+` je bio siv, a Area ima samo
jedan leaf (`Transakcija`). Pravilo je generičko: **točno jedan** leaf ispod odabira ⇒ `+` ide
na njega; dva ili više ⇒ i dalje treba birati.

1. Filtar: Area `Financije_all`, Category **All Categories**.
2. **Očekivano:** `+` **zelen**, žute trake „odaberi kategoriju" **nema**.
3. Dodir `+` ⇒ Add s naslovom `Financije_all > Transakcija`. Zatvori ✕ bez unosa.
4. Protuprovjera: Area s više leafova (npr. `Health_Sasa`), All Categories ⇒ `+` blijed, traka
   *„⚠️ Za unos odaberi kategoriju u filtru (onu bez podkategorija)"*; dodir ⇒ crvena poruka
   *„Odaberi kategoriju u filtru …"* (prije: ništa).

## T-S154-4 ⬜ Zatvorena `Transakcija` se ne pamti

**Što je popravljeno:** zatvaranje odjeljka u Add formi pamtilo se **trajno** u pregledniku, pa
je jedan slučajan dodir na naslov `Transakcija` ostavljao svaki sljedeći unos bez ijednog polja.
Sada se leaf uvijek otvara; zatvaranje radi samo unutar tog unosa. Roditeljske razine
(npr. u `Health_Sasa`) i dalje pamte svoje stanje.

1. `+` → Add `Transakcija` → dodirni naslov **Transakcija** (▸) ⇒ polja se zatvore.
2. Zatvori Add ✕ (bez unosa; ako pita za nacrt — *Discard*).
3. Ponovo `+` ⇒ **Očekivano:** `Transakcija` je **otvorena**, polja vidljiva.
4. (Kokin iPhone) Ako joj je i dalje zatvorena nakon deploya ⇒ hard refresh; stari zapis u
   pregledniku se ne briše, ali ga app za leaf više ne čita.
