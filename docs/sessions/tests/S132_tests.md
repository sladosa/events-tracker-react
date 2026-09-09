# S132 — detalji testova (2026-09-09)

Auto-comment se upisivao i nakon što je `comment_template` obrisan iz baze.
Uzrok nije bio u bazi nego u `sessionStorage` kešu lanca kategorija.

---

## A. Keš lanca kategorija (`useCategoryChain`)

### T-S132-1 — ⭐ `categoryChainCache.test.mjs` (automatski)

**Preduvjeti:** korijen projekta.

1. `node src/hooks/__tests__/categoryChainCache.test.mjs`

**Očekivano:** `All 7 tests passed.`

**Protuprovjera (obavezna, S120 pravilo „test koji nikad ne pada ne čuva ništa"):**
zakomentiraj `window.addEventListener('areas-changed', onAreasChanged);` u
`src/hooks/useCategoryChain.ts` i pokreni ponovno.

**Očekivano:** pada **2 od 7** — „`areas-changed` probija keš" i „...i to jednim
novim čitanjem baze". Ostalih 5 prolazi (dokaz da test mjeri baš popravak, a ne
okolinu). Vrati liniju.

**Status:** ✅ izmjereno 09.09.2026. — 7/7, protuprovjera 2/7 pada.

---

### T-S132-2 — ⭐ Structure panel Save odmah probije keš (uživo)

**Preduvjeti:** `npm run dev:prod`, prijavljen kao vlasnik Aree. Area s
`comment_template` (postavi ga privremeno ako ga više nema).

1. Otvori Add Activity za leaf te Aree, **ne spremaj** — samo da se lanac učita
   (to napuni `sessionStorage`).
2. Vrati se na Structure → taj leaf → Edit → isprazni „Auto-comment template" → Save.
3. **Bez F5 i bez zatvaranja kartice** otvori Add Activity, popuni atribute, Finish.
4. Otvori taj redak u Editu.

**Očekivano:** `Event Note` je **prazan**.

**Pad:** `Event Note` nosi izračunati tekst ⇒ listener ne radi; provjeri
dispatcha li `StructureNodeEditPanel` `areas-changed` i je li `refetch` stabilan.

⚠ **Test se mora raditi u ISTOJ kartici** — zatvaranje kartice ionako briše
`sessionStorage`, pa bi prošao i s pokvarenim kodom (razred S129: „test koji se
razlikuje od onoga što pravilo proizvodi").

**Status:** ⬜

---

### T-S132-3 — Structure import probija keš (uživo)

Kao T-S132-2, ali korak 2 ide kroz **Structure import** (Excel s praznom
ćelijom `CommentTemplate`) umjesto kroz panel.

**Očekivano:** isto — `Event Note` prazan bez zatvaranja kartice.
Modal usput mora javiti `Settings updated` (bez tog retka promjene nije ni bilo).

**Status:** ⬜

---

### T-S132-4 — F5 NIJE dovoljan (dokumentira uzrok)

**Preduvjeti:** aplikacija otvorena **prije** deploya popravka (stari bundle).

1. Otvori Add Activity, pa isprazni template u bazi (bilo kojim putem).
2. Pritisni **F5**.
3. Add Activity → Finish.

**Očekivano na starom bundleu:** `Event Note` je **i dalje** upisan — `sessionStorage`
preživi reload. Gasi ga tek **zatvaranje kartice**.

Ovo nije regresijski test nego zapis uzroka: bez njega sljedeća osoba opet
zaključi da „baza laže".

**Status:** ✅ izmjereno na PROD-u 09.09.2026. (Sašin nalaz, tri kruga)

---

## B. Čišćenje auto-komentara (`ocisti_auto_komentare.py`)

### T-S132-5 — dry run

1. `python data-prep_tools\Financije\ocisti_auto_komentare.py`

**Očekivano:** sekcija `1 · PRAVILO` prijavi „— nema" na obje razine; sekcija 2
razvrsta komentare u pet skupina; ispiše se uzorak **ručnih** koje ne dira.

**Status:** ✅ 09.09.2026. — 11 auto-komentara, 0 reklasificiranih, 0 „razlika u
prazninama", 767 već praznih. Ručni uzorak sadržavao `rucak s Jelenom…`,
`Konzum breskve i snacks`, `Afrodita` — dakle pravi opisi su ostali vani.

---

### T-S132-6 — `--apply`

1. Zatvori sve kartice aplikacije (⚠ inače novi unosi proizvode nove komentare).
2. `python data-prep_tools\Financije\ocisti_auto_komentare.py --apply`

**Očekivano:** backup file, pa `ukupno promijenjeno N / N`. Ne poklopi li se
broj, skripta staje s greškom (RLS-blokiran upis „uspije" s praznim rezultatom).

**Status:** ✅ 09.09.2026. — `11 / 11`, backup
`backup_autocomment_prod_20260909_115637.json`.

---

### T-S132-7 — `--restore` vraća točno ono što je obrisano

**Preduvjeti:** backup iz T-S132-6.

1. `python … --restore backup_autocomment_prod_20260909_115637.json` (dry)
2. Isto uz `--apply`
3. Provjeri u appu da je 11 redaka opet s komentarom.
4. Pokreni `--apply` ponovno da ih makneš.

**Očekivano:** `vraceno 11 / 11`.

⚠ **Netestirano — a backup bez provjerenog restorea nije backup.** Vrijedi
pustiti barem dry run.

**Status:** ⬜

---

### T-S132-8 — reklasificirani auto-oblik (`--i-stare`)

**Preduvjeti:** redak kojem je auto-komentar upisan, pa mu je poslije promijenjen
`Tip` ili `Podtip`.

1. Dry run.

**Očekivano:** takav se pojavi pod „auto-oblik, reklasificiran" s retkom
`danas bi bilo …`, i **ne** ulazi u brisanje bez `--i-stare`.

⚠ Danas ih na PROD-u ima **nula**, pa se grana nije izvršila nad stvarnim
podacima. Jedinična provjera regexa jest (uklj. `N/A` koji sadrži separator `/`).

**Status:** ⬜ (nema uzorka na PROD-u)

---

## C. Selidba `load_env`/`rest` u `_db.py`

### T-S132-9 — alati i dalje rade

1. `python data-prep_tools\Financije\ocisti_auto_komentare.py` — mora raditi
   **golim `python`om**, bez `run.bat`/venva.
2. Pokreni jedan alat koji ide preko `uskladi_izvod`, npr.
   `data-prep_tools\Financije\run.bat promet_check.py`.

**Očekivano:** oba prolaze. Prvi zato što više ne vuče `pdfplumber`, drugi zato
što je re-export zadržao stara imena.

**Status:** ✅ za (1) i za učitavanje svih 9 pozivatelja (izmjereno
`sys.modules['pdfplumber']=None`) · ⬜ za (2) stvarno pokretanje alata

---

## D. Nalaz koji NIJE popravljen

### T-S132-10 — `no events yet` na leafu s 2.300+ eventa

**Preduvjeti:** PROD, Structure tab, Area `Financije_all`.

1. Otvori Structure tab.
2. Pogledaj redak `Financije_all > Transakcija`.
3. DevTools → Network → zahtjev `events?select=category_id` → duljina odgovora.

**Očekivano (nakon popravka):** badge se ne prikazuje; broj odgovara stvarnom
broju eventa.

**Danas:** badge piše `no events yet`. Upit u
`useStructureData.ts:80-82` nema ni `.range()` ni `.order()` ⇒ PostgREST reže na
1000 redaka **bez greške**. Duljina odgovora točno `1000` potvrđuje rez.

⚠ `StructureDeleteModal` je **zaštićen** (radi vlastiti `count: 'exact'`),
`StructureAddChildPanel:123` **nije** — lažna nula otključava dodavanje djeteta
leafu koji ima evente (zabrana iz S24).

**Status:** ⬜ NALAZ, popravak nije napravljen (v. „Open bugs" u CLAUDE.md)
