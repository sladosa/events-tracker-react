# S135 — E2E triaža + `areas_select` samoreferentna politika (2026-09-11)

Kontekst: dan je počeo odlukom **„prvo testirati, pa tek onda deploy"** (da Netlify
build ne troši kredite bez potrebe). Ta je odluka bila ispravna iz razloga koji se
tada nije mogao znati: puni E2E je otkrio kvar u migraciji `047`.

---

## A. `areas_select` je tražila sam sebe

### T-S135-1 ✅ Sonda PRIJE — asimetrija u dva susjedna retka

Sondi su dodane **dvije** INSERT probe na `areas`, namjerno jedna sa i jedna bez
`RETURNING`. Izmjereno na TEST-u prije `052`:

```
areas  INSERT svoju       DA   1 redaka
areas  INSERT +RETURNING  NE   RLS odbio
```

Isti upis; jedina razlika je traži li se redak natrag.

⚠ **Zašto to jedna proba ne može uhvatiti.** `rls_probe.py` je do danas mjerio INSERT
**bez** `RETURNING` — i to s dobrim razlogom (S134: `return=representation` maskira
otvoren INSERT, pa se rupa ne vidi). Ali time je postao slijep na obrnuti privid:
politika koja **brani čitanje novog retka** obara legitiman upis. Dvije probe jedna
ispod druge razlikuju ta dva stanja; jedna ne može nijedno.

### T-S135-2 ✅ `sql/052` na TEST-u

```
prije:   app_can_read_area(id)
poslije: ((user_id = auth.uid()) OR app_can_read_area(id))
```

**Mehanizam kvara:** `app_can_read_area` radi `SELECT 1 FROM areas WHERE id = …`,
dakle **traži redak u tablici**. Funkcija je `STABLE` + `SECURITY DEFINER` pa gleda
snimku od početka naredbe, u kojoj retka koji se tek umeće **nema**. `RETURNING`
traži SELECT pravo na taj redak ⇒ `EXISTS` false ⇒ cijeli INSERT se poništi uz
`42501 new row violates row-level security policy for table "areas"` — poruku koja
tvrdi da **upis** nije dopušten, a nije bilo dopušteno **čitanje natrag**.

⚠ `categories` i `attribute_definitions` su pošteđene jer njihove SELECT politike
gledaju **roditelja** (`app_can_read_area(area_id)`, `EXISTS` nad `categories`), a
roditelj u trenutku upisa postoji. `areas_select` je bila jedina samoreferentna.

### T-S135-3 ✅ Sonda POSLIJE — pomaknuo se točno jedan redak

| uloga | promjena |
| --- | --- |
| vlasnik Aree | `INSERT +RETURNING` **NE → DA** |
| write grantee | isto; `UPDATE`/`DELETE` i dalje **NE**, struktura i dalje zatvorena |
| stranac | isto; `areas SELECT` i dalje **NE** |

Svi ostali redci znak po znak isti ⇒ prava se nisu proširila. `user_id = auth.uid()`
je ionako **prva grana unutar** helpera; `052` je samo izvlači ispred, da ne ovisi o
tome je li redak već vidljiv u tablici.

⚠ Pošteno o dosegu mjerenja: snimka „prije" uzeta je **za vlasnika**; za druge dvije
uloge zaključeno je iz toga da `052` dira samo SELECT politiku, a `areas_insert` nije
dirnut. Ostali redci su izravno uspoređeni s jutrošnjim ispisom.

### T-S135-4 ✅ Tri speca koja su kvar našla sada prolaze

`S100_same_path_two_areas` 1 ✅ · `S107b_set_attribute` 2 ✅ · `S119_list_columns_map` 1 ✅

Sva tri stvaraju Areu preko REST-a s `Prefer: return=representation` i padala su s
doslovnim `42501`. To je dokaz s one strane s koje je kvar i došao.

### T-S135-5 ⬜ `sql/052` na PROD-u — **Saša pokreće**

```
Tools\run.bat Tools\rls_probe.py --env prod        ← spremi izlaz
   052   (Supabase SQL editor)
Tools\run.bat Tools\rls_probe.py --env prod        ← usporedi
Tools\run.bat Tools\dump_schema.py --env prod      ← shema natrag u git
```

**Očekivano:** jedina razlika je `areas INSERT +RETURNING` **NE → DA**, za sve tri
uloge. Bilo koji drugi pomak znači da je dirnuto nešto što nije trebalo.

### T-S135-6 ⬜ Ručna protuprovjera (opcionalno)

Dvije naredbe koje se razlikuju **samo** u `RETURNING`, sve u `ROLLBACK`-u —
puni tekst je u podnožju `sql/052_rls_areas_select_own_row.sql`.

### T-S135-7 ⬜ „Add Area" u aplikaciji i dalje radi

**Zašto test postoji:** `052` dira politiku čitanja, a Add Area je put koji je jedini
stvarno pogođen da je aplikacija slala `RETURNING`. Nije slala — ali popravak se
provjerava i s te strane.

1. Structure → `+ Add Area` → stvori areu → mora se pojaviti u popisu.
2. Obriši je.

⚠ **Produkcija NIJE bila pokvarena, i to je izmjereno:** sva četiri mjesta koja
stvaraju Areu (`StructureAddAreaPanel` ×2, `leaveArea.ts`, `structureImport.ts`)
zovu `.insert()` **bez** `.select()`, a `postgrest-js 2.93.0` uz `insert()` šalje samo
`count=`/`missing=default` — `return=representation` dodaje tek `.select()`.

---

## B. E2E triaža — što 22 pada zapravo znače

### T-S135-8 ⚠ Puni E2E: 46 prošlo / 22 palo / 3 nisu krenula (19,9 min)

Guard je odradio posao: Playwright je digao **svoj** server protiv TEST-a
(`vite` bez `--mode prod`), baner u svakom snapshotu `⚠ TEST DATABASE`.

⚠ **Brojka 22 nije podatak o S134.** Puni suite nije pušten od **S120**, a otad su
S121, S122, S129, S131 i S133 mijenjali filtar, polje za iznos, keš lanca i brojanje
na Structureu. Reći „S134 je slomio 22 testa" bilo bi netočno, a tako se lako čita.

### T-S135-9 ✅ Pojedinačni run razdvaja kvar od artefakta

| prolaze sami (artefakt punog runa) | padaju i sami |
| --- | --- |
| e3, e6, e10, e11, e12, e14, S107, S121, S122, S123 | e7, e13, e15, S100, S107b, S119 |

**Deset specova prolazi kad ih se pusti same.** U suiteu su padali s ekranom koji
tvrdi `No activities found` uz ispravnu Areu, ispravne kategorije i „All Time" —
dakle **palo čitanje koje izgleda kao prazna lista** (`BUG-S121-AREACTX` razred).

⚠ Dvije hipoteze pale su tijekom dana, obje opovrgnute mjerenjem, pa ih ne vrijedi
nositi dalje: (1) da su padovi posljedica RLS migracija — sonda i REST pokazuju
suprotno, a test-korisnik je vlasnik seed Aree; (2) da `S100` pada preko vlastitog
smeća iz starih runova — spec aree imenuje nasumično, pa se ne može sudariti.

⚠ Dva propusta u **mjerenju**, ne u testovima, oba vrijedna pamćenja:
- `exit code 0` iz `npx playwright test | tail` je kod **`tail`-a**, ne Playwrighta.
- Playwright **briše `test-results/` na svakom pokretanju**, pa petlja po specovima
  pojede artefakte svih osim zadnjeg. Artefakti se moraju kopirati nakon svakog runa.
- Sažetak Playwrighta nosi ANSI kontrolne znakove, pa `grep '^ *[0-9]+ passed'` ne
  hvata ništa i ispadne „bez rezultata" — što se čita kao pad.

### T-S135-10 ⬜ Ostaje otvoreno

`e13-add-between` (1) · `e15-revoke-with-events` (3) · `e7-2`/`e7-3` (otprije poznati
otvoreni bugovi — izostaje toast u invite flowu). `e7-1` je u drugom prolazu **prošao**
⇒ flaky, vjerojatno isti razred kao S122: lista se preupita, redak se remounta i
**odnese tek otvoren ⋮ izbornik** (`CategoryChainRow` zatvara meni na svaki `scroll`,
s `capture: true`).

### T-S135-11 ⬜ Zašto suite ruši sam sebe — **neistraženo**

`workers: 1` je postavljen još u S120, dakle nije paralelizam. Uzorak upućuje na
iscrpljivanje TEST baze kroz 20 minuta neprekidnog rada. Ako se potvrdi, to nije
problem testova nego **mjera koliko je aplikacija osjetljiva na gušenje baze** — a
onda je pravo pitanje Postgres upgrade, otvoren od S105.
