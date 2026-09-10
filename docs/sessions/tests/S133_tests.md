# S133 — detalji testova (2026-09-10)

Dvije stvari, obje otkrivene mjerenjem a ne čitanjem koda:

1. **Popravak keša iz S132 nije radio ništa u stvarnom toku.** Listener je bio
   vezan *u hooku*, a hook (`useCategoryChain`) živi samo na `/app/add` i
   `/app/edit/:s`; svaki dispatcher `areas-changed` je u `AppHome` (`/app/`).
   U trenutku kad signal ode, hook ne postoji.
2. **BUG-S132-EVENTCOUNT** — Structure tab je brojao evente u pregledniku nad
   odrezanih 1000 redaka.

---

## A. Keš lanca kategorija — module-level listener

### T-S133-1 — ⭐ `categoryChainCache.test.mjs` (automatski)

**Preduvjeti:** korijen projekta.

1. `node src/hooks/__tests__/categoryChainCache.test.mjs`

**Očekivano:** `All 12 tests passed.`

**Protuprovjera (obavezna):** zakomentiraj **obje** registracije u
`src/hooks/useCategoryChain.ts`:

```
// window.addEventListener('areas-changed', clearChainCache);
// window.addEventListener('structure-deleted', clearChainCache);
```

**Očekivano:** pada **4 od 12**, a prva greška je doslovno PROD simptom
(`dobio null`). Preostalih 8 prolazi — dokaz da test mjeri popravak, a ne
okolinu. Vrati linije.

**Status:** ✅ izmjereno 10.09.2026. — 12/12, protuprovjera 4/12 pada.

⚠ Jezgra testa (6) **odmontira hook prije dispatcha**. Verzija koja dispatcha
dok je hook montiran prolazi nad kodom koji u aplikaciji ne radi — točno to je
propustila S132 verzija.

---

### T-S133-2 — ⭐ Structure Save probije keš, smjer PISANJA (uživo)

**Preduvjeti:** `npm run dev:prod`, prijavljen kao **vlasnik** Aree
(RLS dopušta UPDATE na `areas`/`categories` samo vlasniku — grantee bi „spremio"
s 0 redaka).

1. Structure → leaf → Edit → **Auto-comment template** = `TEST132 {tip}/{podtip}` → Save.
2. **Bez F5 i bez zatvaranja kartice** → Add Activity → popuni atribute → Finish.
3. Otvori taj redak u Editu.

**Očekivano:** `Event Note` = `TEST132 Domaćinstvo/Hrana i ostalo`.

**Pad:** prazan ⇒ keš nije probijen.

⚠ **Add Activity forma NIKAD ne prikazuje template** — placeholder
`e.g., Felt strong today` je hardkodiran (`AddActivityPage.tsx:1865`). Template
se primjenjuje tek na Finishu (`resolveEventNote`). Prazno polje u formi nije
dokaz ničega; ovo je u S133 prvo odvelo na krivi zaključak.

**Status:** ✅ izmjereno na PROD-u 10.09.2026. Isti korak je istog jutra, prije
popravka, davao `comment = null` (potvrđeno REST-om).

---

### T-S133-3 — ⭐ Structure Save probije keš, smjer BRISANJA (uživo)

Kao T-S133-2, ali korak 1 **isprazni** template.

**Očekivano:** `Event Note` **prazan**.

**Status:** ✅ izmjereno na PROD-u 10.09.2026.

⚠ Nakon testa: obriši testne retke i provjeri da je template prazan na **obje**
razine — `resolveCommentTemplate` bira leaf pa tek onda Areu.

---

### T-S133-4 — Structure IMPORT probije keš

Kao T-S133-3, ali promjena ide kroz **Structure import** (Excel s praznom
ćelijom `CommentTemplate`).

**Očekivano:** isto — prazan `Event Note` bez zatvaranja kartice. Modal usput
mora javiti `Settings updated`; **odsutnost tog retka znači da promjene nije ni
bilo** (`StructureImportModal.tsx:266` ga renderira samo kad je > 0).

**Status:** ⬜

---

### T-S133-5 — ⭐ Rename/premještanje pa Add u istoj kartici

**Zašto:** keširani lanac ne hrani samo `comment_template`. `categoryChain.map(c => c.id)`
gradi **P2 parent evente** (`AddActivityPage.tsx:1178`). Stara snimka nakon
preimenovanja ili premještanja upisala bi parent evente po **staroj** hijerarhiji
— posljedica teža od komentara, i nevidljiva u formi.

1. Structure → premjesti ili preimenuj kategoriju u lancu → Save.
2. **Bez F5** → Add Activity na tom leafu → Finish.
3. Provjeri parent evente (`chain_key`, `category_id` roditelja).

**Očekivano:** parent eventi po **novoj** hijerarhiji.

**Status:** ⬜ **nije provjereno**

---

## B. Broj eventa na Structure tabu (BUG-S132-EVENTCOUNT)

### T-S133-6 — ⭐ E2E `S133_structure_event_count.spec.ts`

**Preduvjeti:** ⚠ **ugašen `npm run dev:prod`** — v. T-S133-10.

1. `npx playwright test e2e/tests/S133_structure_event_count.spec.ts`

**Očekivano:** 1 passed. Test otvara ⋮ → „View details" na kategoriji s najviše
eventa i traži da panel piše **točno onaj broj koji baza vrati**.

**Protuprovjera (obavezna):** vrati stari upit u `useStructureData.ts`:

```ts
const { data: eventCountsRaw } = await supabase.from('events').select('category_id');
```

**Očekivano:** pada s `panel mora pisati 3624, a ne odrezanu brojku`.

**Status:** ✅ izmjereno 10.09.2026., protuprovjera pada.

⚠ **PRVA VERZIJA OVOG TESTA NIJE ČUVALA NIŠTA.** Tvrdila je samo da leaf s
eventima nema značku `no events yet`. Prošla je **i s vraćenim pokvarenim
upitom**: na TEST-u `Garmin_data` ima 3.624 od ukupno 3.727 eventa, pa je onih
odrezanih 1000 redaka ionako gotovo sve iz te kategorije — brojka ispadne ~1000,
značka izostane, test zadovoljan. Na PROD-u je prozor slučajno pao drugdje i dao
nulu; oslonac na značku čuvao bi **tu slučajnost**, ne pravilo.
Uhvatila je to **samo protuprovjera** (razred S120).

---

### T-S133-7 — ⭐ PROD: stvaran broj na Structure tabu

**Preduvjeti:** deploy S133, **Ctrl+Shift+R**.

1. Structure → `Financije_all > Transakcija` → ⋮ → View details.

**Očekivano:** `5173 events` (ili koliko ih tada bude), **nikad** `no events yet`.

**Status:** ⬜ nakon deploya

---

### T-S133-8 — ⭐ S24 brava mora opet držati

**Ovo je razlog zbog kojeg se popravljalo.** Lažna nula je otključavala zabranu.

1. Structure → Edit Mode → ⋮ na `Financije_all > Transakcija` → `+ Add Leaf`.

**Očekivano:** blokirano, uz poruku da kategorija ima evente. Gumb `Create`
se **ne pojavljuje**.

**Pad:** pojavi li se forma za kreiranje, brava je i dalje otvorena.

**Status:** ⬜ nakon deploya

---

### T-S133-9 — Structure tab se otvara bez osjetnog čekanja

**Zašto:** popravak šalje **jedan upit po kategoriji**. Izmjereno na TEST-u kao
prijavljen korisnik: 39 kategorija, 127 ms po upitu — serijski 4,95 s,
**usporedno 0,46 s**.

⚠ Na PROD-u si **grantee** na `Financije_all`, a to je skuplja RLS grana
(jeftina grana je `auth.uid() = user_id`, skupa je join na `data_shares`).
Neizmjereno.

1. Otvori Structure tab i broji do tri.

**Očekivano:** tablica se iscrta prije nego izbrojiš.

**Pad:** osjetno čekanje ⇒ vrijeme je za RPC s `GROUP BY` (v. CLAUDE.md).

**Status:** ⬜

---

## C. Zamka koja nije riješena

### T-S133-10 — ⚠ E2E preuzme dev server koji već stoji

`playwright.config.ts` ima `reuseExistingServer: true` i `baseURL: localhost:5173`.
Stoji li ondje `npm run dev:prod`, Playwright **ne podiže svoj TEST server nego
preuzme PROD**, ubrizga TEST sesijski token i krene.

Izmjereno 10.09.2026.: dev server na :5173 servirao je
`zdojdazosfoajwnuafgx` (PROD), dok `.env.testing` pokazuje na
`xtnbhmojmffjelsqejpw` (TEST). Test je stao na login ekranu — ali **spec koji se
uspije prijaviti radio bi stvarne izmjene na PROD-u**, a u izlazu Playwrighta
nigdje ne piše na koju bazu gađa.

⚠ `global-setup.ts` ima **vlastitog** klijenta iz `.env.testing`, pa on čisti
TEST i kad preglednik gleda PROD — dakle dvije polovice runa mogu gledati
**različite baze**.

**Prijedlog (nije izveden):** ili `reuseExistingServer: false`, ili provjera u
`global-setup` da `VITE_SUPABASE_URL` posluženog builda odgovara `.env.testing` —
inače stani s greškom.

**Status:** ⬜ ZAMKA, konfiguracija nije mijenjana
