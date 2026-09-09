# Sljedeća sesija — handoff

**Pisano protiv commita:** `ff35846` (`S132: load_env/rest u _db.py`).
`main` = `44ea1b9` (podignut u S132, Netlify deployao). Ako `git log` pokazuje
novije, čitaj ovo kao povijest — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

| | stanje |
| --- | --- |
| `main` podignut na S130+S131 (delta dropdowni, decimalni zarez, `Required`) | ✅ deployano |
| Auto-comment (`Event Note`) — pravilo maknuto iz baze | ✅ ti, kroz UI |
| 11 redundantnih komentara obrisano s PROD-a | ✅ `11/11`, backup postoji |
| ⭐ Uzrok zašto se upisivao i **poslije** brisanja — nađen i popravljen | ✅ kod na `test-branch` |
| `no events yet` na Structure tabu — nađeno, **nije popravljeno** | ⬜ |

## Ono što je zapravo bila poanta dana

Auto-comment se nastavio upisivati iako je pravilo bilo obrisano iz baze. Dvije
moje hipoteze bile su krive; **tvoje mjerenje ih je oborilo** — nov export s
praznim ćelijama i oba prazna Edit panela.

Pravi uzrok: aplikacija drži snimku kategorije (zajedno s pravilom) u pregledniku,
i ta snimka **preživi F5**. Gasi se tek zatvaranjem kartice. Zato je izgledalo kao
da baza laže.

⚠ **Jedna stvar te još čeka:** popravak je na `test-branch`, **nije na PROD-u**.
Dok se ne deploya, tebi i Koki i dalje treba **zatvaranje kartice** (ne F5) nakon
svake promjene strukture. Ako se to ne napravi, novi unosi opet dobiju auto-komentar.

## Što tebe čeka

1. **Reci Koki da zatvori karticu aplikacije** (ne samo osvježi). Jednokratno.
2. **Odluči hoćeš li deployati S132 na `main`.** Nisi tražio push i nisam ga
   napravio. Dobitak je da nestane ono „zatvori karticu" pravilo.
3. **Pusti `--restore` barem u dry runu** (T-S132-7). Backup od 11 redaka postoji,
   ali nikad nije isproban — a backup bez provjerenog restorea nije backup.
4. **Koka na svom laptopu** — ništa je ne sprječava. Vlasnica je Aree, pa svi
   grantee zidovi otpadaju. Treba joj **desktop Excel** (ne Online/Sheets —
   padajući izbornici idu preko `INDIRECT` i skrivenog lista).

## Što treba od Koke

Ništa novo. Samo ono jednokratno zatvaranje kartice.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `main` = `44ea1b9` — S130 + S131. Netlify deployao 09.09.
- `test-branch` = `ff35846` — tri commita ispred: `0d275a2` (popravak keša + test),
  `ff35846` (`_db.py`), `b7beb22` (`ocisti_auto_komentare.py`).
- Sync-back nije potreban; `main` je u cijelosti sadržan u `test-branch`.

## Novo u kodu

- **`useCategoryChain` sluša `areas-changed`** (`src/hooks/useCategoryChain.ts:133`).
  Listener je **u hooku**, ne u pozivateljima — invarijanta. Puna zamka je u
  CLAUDE.md („Keš mora slušati onoga tko ga čini zastarjelim").
- **`src/hooks/__tests__/categoryChainCache.test.mjs`** — vrti **pravi kod hooka**
  nad minimalnim React shimom (projekt nema unit runner za hookove; samo Playwright).
  ⚠ Ako budeš pisao još hook testova, ovaj shim je predložak — `useState`/`useCallback`/
  `useEffect` s deps usporedbom, `window` preko `EventTarget`, `sessionStorage` preko Mape.
  Provjeren u oba smjera: bez listenera pada 2 od 7.

## Novo u alatima

- **`data-prep_tools/Financije/_db.py`** — `load_env` + pagirani `rest`, **preseljeni**
  iz `uskladi_izvod.py`. Taj ih re-exporta, pa svih devet pozivatelja radi dalje.
- **`ocisti_auto_komentare.py`** — kriterij je rekonstrukcija po retku. Staje dok je
  template živ na **bilo kojoj** razini.

## Otvoreno

- **T-S132-2/-3** (jezgra popravka, uživo) **nisu izvedeni.** ⚠ Moraju se raditi
  **u istoj kartici** — zatvaranje kartice ionako briše `sessionStorage`, pa bi test
  prošao i nad pokvarenim kodom (razred S129).
- **T-S132-7** `--restore` netestiran.
- **BUG-S132-EVENTCOUNT** — `useStructureData.ts:80-82` čita `events` bez `.range()`
  i bez `.order()`. Prije popravka **izmjeriti** zašto ispada baš `0` (Network →
  duljina odgovora; točno `1000` potvrđuje rez). Ispravak preko `fetchAllPaged` vuče
  2.300+ redaka na svako otvaranje taba ⇒ vjerojatno je bolji RPC s `GROUP BY`.
- **`--i-stare` grana nije se izvršila nad stvarnim podacima** — na PROD-u je nula
  reklasificiranih. Regex je provjeren jedinično (uklj. `N/A` sa separatorom).

## Pouke koje vrijede šire od ovog buga

- **Okolinu provjeri u korisnikovoj ljusci, ne u svojoj.** Tvrdio sam da skripta
  radi golim `python`om jer se u Bash alatu `python` razrješava u drugi interpreter
  nego u Sašinom PowerShellu. Njemu je pala na `pdfplumber`.
- **Odsutnost retka u izvještaju je podatak.** `Settings updated` se renderira samo
  kad je `> 0`; njegov izostanak je jedini pouzdan signal da uvoz nije dirnuo
  `comment_template`. Suprotno tome, `List columns 8` broji **parsirane retke**, ne
  promjene.
- **Prije nego proglasiš uzrok, provjeri govori li ijedan sloj istinu.** Baza, export
  i oba panela slagali su se; jedini koji je odstupao bio je preglednik.

## Nepromijenjeno od S131

Financije pipeline, sidra, delta sheet, tranše — ništa od toga danas nije dirano.
Za to stanje vrijedi CLAUDE.md i `DONE_HISTORY` S129–S131.
