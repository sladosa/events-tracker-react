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
