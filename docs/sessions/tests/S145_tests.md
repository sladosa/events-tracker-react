# S145 — detaljni testovi (2026-09-22)

> Sesija je bila **testiranje hrpe A**, ali tri od četiri popravka nisu bila na popisu —
> ispali su iz samog testiranja. Zato ovaj file ima više testova nego što je sesija planirala.

---

## T-S145-1 ✅ Overview tab preživi povratak — sva tri puta

**Što je popravljeno:** `BUG-S145-OVERVIEWTAB`. Zastavica `loaded` u `useAreaDashboard` je
preživljavala promjenu `areaId`-a, pa je u prozoru dok se `FilterContext` još obnavlja
tvrdila *„ova Area nema dashboard"* — a zaštita u `AppHome` bi korisnika maknula s Overviewa
**i to zapisala** u `ui:activeTab`. Izbor nije bio preskočen nego obrisan.

**Preduvjet:** Area s Overview tabom (`Financije_all`).

1. Otvori **Overview** tab.
2. **F5.** → **Očekivano:** ostaješ na Overviewu.
   ✅ **Izmjereno 22.09.2026. na `dev:prod`** (prije popravka: svaki put Activities).
3. S Overviewa otvori bilo koji redak → **View details** → ✕ natrag.
   **Očekivano:** vraćaš se na **Overview**, ne na Activities. ⬜
4. S Overviewa `+` → unesi bilo što → Finish → **Go to Home**.
   **Očekivano:** vraćaš se na **Overview**, pločica preračunata. ⬜
   ⚠ Ovo je korak 4 iz `T-S108-1b`, koji je 22.09. **pao** i tako otkrio kvar.
   ⚠ Redak koji pritom nastane **obriši** — u `Financije_all` svaki `Izvor = Racun` miče saldo.

**Pad:** bilo koji od tri puta te vrati na Activities ⇒ popravak ne pokriva taj remount.

⚠ **Prvi popravak je bio nedostatan i to je otkrilo tek ponovno mjerenje.** Dodavanje uvjeta
`filter.areaId` u potrošača izgleda dostatno, ali ne pokriva render u kojem je Area **već
poznata** a zastavica je **još zaliha iz prethodnog ulaza**. Zato korak 2 mora biti ponovljen
nakon svake izmjene u `useAreaDashboard` ili u toj zaštiti.

---

## T-S145-2 ✅ Rata s ostatkom zaokruživanja

**Što je popravljeno:** `BUG-S145-RATASPLIT`. Svaka rata je dobivala isti zaokruženi iznos,
pa je zbroj bio manji od ukupnog. Izmjereno na Kokinom planu od 22.09.2026.:
`117,32 / 6` → 6 × `19,55` = `117,30`, manjak `0,02`.

**Gdje se to vidi tek kasnije:** saldo ne mrda (kartični retci ga ne miču), ali kad stigne
PBZVISA izvod, **Σ košare ≠ iznos terećenja** — a to izgleda kao greška u sparivanju.

1. Add Activity u `Financije_all`, `Izvor = Visa`, **`Isplata = 100`**, `Rate? = da`,
   `Broj rata = 3` → Finish.
2. U rata modalu pogledaj iznose **prije** potvrde.

**Očekivano:** `33.34` / `33.33` / `33.33`, i žuta napomena
*„Prva rata nosi ostatak zaokruživanja — zbroj je točno 100.00"*.

3. Potvrdi, pa otvori sva tri retka.

**Očekivano:** `Isplata` = `33.34` / `33.33` / `33.33`; komentar svakog retka nosi **isti**
broj koji je u atributu (`rata 1/3 · 33.34 od 100`), ne prosjek.

**Pad:** tri puta `33.33` (zbroj `99,99`) ⇒ popravak nije aktivan.
**Pad:** iznos u atributu i broj u komentaru se razilaze ⇒ dirano je samo jedno mjesto.

4. **Obriši sva tri retka** — `Izvor = Visa` ne miče saldo, ali ulazi u otvorenu košaru.

⚠ Automatski dio je pokriven: `src/lib/__tests__/rataAmounts.test.mjs`, 21 tvrdnja.
Protuprovjera izvedena — sa starom implementacijom pada **11** tvrdnji.

---

## T-S145-3 ⬜ (praćenje) Boolean u Edit formi — ako se ponovi

**Stanje:** `BUG-S145-BOOLEDIT` **nije reproduciran.** Pojava viđena dvaput 22.09.2026.
(`Rate?` pisao `Not set` nad retkom koji u bazi ima `true`), zatim nestala na istom retku.

⚠ **Ne treba ponovno mjeriti ono što je već izmjereno:** do kvačice stiže **pravi boolean
`true`**, pod ispravnim `definitionId`, uz točan broj ključeva u mapi. Četiri hipoteze su
oborene (string umjesto boolean, izgubljen ključ, duplikat definicije, lokalno stanje u
`AttributeInput`).

**Ako se ponovi:**

1. **Prvo Ctrl+Shift+R.** Obje pojave su bile u istoj kartici koja je dugo stajala otvorena,
   a stari keširani bundle je već jednom tiho osakatio feature (S118).
2. Preživi li refresh, vrati privremeni ispis u `renderAttribute`
   (`src/components/activity/AttributeChainForm.tsx`, uz `if (attr.data_type === 'boolean')`)
   i pročitaj `typeof` + `value` + `u mapi`.
3. Tek tada je smisleno tražiti uzrok dalje.

⚠ **Ne kliktati kvačicu dok traje dijagnoza.** Drugi klik postavlja `false`, a `Rate? = No`
povlači čišćenje ovisnih polja ⇒ `Broj rata` i `Rata br` nestanu s retka koji je bio ispravan.

---

## T-S145-4 ✅ Generator ne vraća konfiguraciju unatrag

**Izmjereno 22.09.2026.** prije uvoza: `make_financije_all_structure.py` je `Automations`
pisao iz vlastitog koda (`Visa=next:3`, rata `Visa=3`), a uvoz tog sheeta **zamjenjuje**
automatike Aree ⇒ uvoz bi poništio oba popravka iz S138.

Popravljeno (`read_base_automations()`), pa provjereno na tri načina:

| provjera | rezultat |
| --- | --- |
| generirani file vs. app export | `Visa=cutoff:3:5`, rata `Visa=5` — poklapa se |
| alat javlja razilaženje | ispisuje **oba** retka (BASE i ukucano) |
| nakon uvoza, nova Visa kupovina | `Datum naplate` = **05.10.2026.** |

⚠ **Kad se generator sljedeći put pokrene** (batch 2024/2023), pročitaj taj ispis prije uvoza.
Ako javi razilaženje koje ne očekuješ, konfiguracija je u međuvremenu promijenjena u aplikaciji
— i BASE je u pravu, ne alat.
