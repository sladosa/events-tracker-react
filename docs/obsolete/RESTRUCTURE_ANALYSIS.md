# RESTRUCTURE_ANALYSIS.md
# Events Tracker — Reorganizacija strukture kategorija

**Datum:** 2026-03-31
**Status:** Analiza — osnova za razgovor i dogovor, ništa nije implementirano
**Opseg:** Sve situacije u kojima korisnik želi premjestiti, ubaciti, spojiti ili izbrisati
razine u hijerarhiji kategorija koje već potencijalno imaju evente.

---

## Sadržaj

1. [Zašto je ovo zahtjevno](#1-zasto-je-ovo-zahtjevno)
2. [Kataloška lista scenarija](#2-kataloska-lista-scenarija)
3. [Opcije implementacije](#3-opcije-implementacije)
4. [Multi-user razmatranja](#4-multi-user-razmatranja)
5. [Excel roundtrip nakon reorganizacije](#5-excel-roundtrip-nakon-reorganizacije)
6. [Preporučeni put naprijed](#6-preporuceni-put-naprijed)
7. [Otvorena pitanja za dogovor](#7-otvorena-pitanja-za-dogovor)

---

## 1. Zašto je ovo zahtjevno

Kad bi baza imala samo `categories` tablicu, reorganizacija bi bila trivijalna
(UPDATE `parent_category_id`, gotovo). Problem su **eventi** i sustav koji ih
veže za kategorije kroz dva mehanizma:

### 1.1 Dva mehanizma vezivanja

**`category_id`** (na svakom eventu) — direktna FK veza koja kaže
"ovaj event pripada ovoj kategoriji". Za leaf evente ovo je jedina veza.
Za parent evente (P2 arhitektura), ovo je eventualno pogrešno ako je
kategorija premještena.

**`chain_key`** (na parent eventima) — UUID leaf kategorije koja je "vlasnik"
tog parent eventa u sesiji. Bez ovoga nije moguće razlikovati dvije paralelne
aktivnosti u istoj sesiji (npr. Cardio i Strength oboje u 14:00).

### 1.2 Kritična funkcija koja ovisi o strukturi

```
buildParentChainIds(leafCategoryId)
```

Ova funkcija hoda TRENUTNU `parent_category_id` vezu od leaf prema
korijenu i vraća listu UUID-ova svih parent kategorija. Ako promijenimo
`parent_category_id` u bazi, ova funkcija odmah počne vraćati **novu** listu —
ali stari parent eventi i dalje imaju staru `category_id` vrijednost.

### 1.3 Shematski prikaz problema

```
PRIJE: Activity → Gym → Strength (leaf)
  parent event 1: category_id=Activity, chain_key=StrengthUUID  ← OK
  parent event 2: category_id=Gym,      chain_key=StrengthUUID  ← OK
  leaf events:    category_id=Strength,  chain_key=NULL          ← OK

POSLIJE INSERT "Upper Body" između Gym i Strength:
  buildParentChainIds(StrengthUUID) sada vraća: [UpperBody, Gym, Activity]
  ali u DB postoje samo parent eventi za Gym i Activity, ne za UpperBody
  → novi eventi dobivaju UpperBody parent event; stari eventi ga nemaju (ali rade)

POSLIJE MOVE Strength pod Sport (drugi parent):
  buildParentChainIds(StrengthUUID) sada vraća: [Sport]
  ali u DB i dalje postoje parent eventi za Gym i Activity s chain_key=StrengthUUID
  → ti eventi su SIROČAD (orphans) — pogrešna category_id, nikad se više neće dohvatiti
```

---

## 2. Kataloška lista scenarija

Svaki scenarij ima procjenu:
- **Podaci rizik**: utjecaj na integrity eventa i atributa
- **Složenost migracije**: koliko SQL koraka
- **Excel roundtrip**: hoće li stari Excel fajlovi i dalje raditi
- **Okidač**: typičan situacijski uzrok

---

### Scenarij A — Ubaciti razinu između (Insert Between)

**Primjer:** `Fitness > Activity > Gym > Strength`
               ↓
              `Fitness > Activity > Gym > Upper Body > Strength`

**Što se mijenja u DB:**
- INSERT nova kategorija `Upper Body` (level 3, parent=Gym)
- UPDATE `Strength.parent_category_id` = UpperBody.id
- UPDATE `Strength.level` = 4 (bio je 3)
- NIJE POTREBNO mijenjati ikakve evente jer `category_id` na Strength eventima
  ostaje isti → FK još uvijek valjana

**Podatkovni rizik: NIZAK**

Leaf eventi su netaknuti. Stari parent eventi (za Gym, Activity) i dalje se
ispravno nalaze jer chain_key=StrengthUUID nije promijenjen i category_id na
Gym/Activity parentima je i dalje ispravna.

Jedina posljedica: stare sesije nemaju Upper Body parent event.
- U ViewDetailsPage: Upper Body atributi su prazni za stare sesije (OK, nema atributa na njemu, to je nova razina)
- Na prvom Edit+Save stare sesije: automatski se kreira novi Upper Body parent event ✓

**Excel roundtrip: NEKA STARA STAKA**

`CategoryPath` u Structure sheetu se mijenja za Strength i sve ispod nje.
Stari Excel exportovi koji imaju `Gym > Strength` ne mogu se reimportati
jer tog patha više nema (sada je `Gym > Upper Body > Strength`).

**Složenost migracije:** Laka (2-3 SQL naredbe, bez migracije evenata)

**Pro:**
- Bez gubitka podataka
- Reverzibilno (brisanje Upper Body i vraćanje Strength parent_category_id na Gym)

**Contra:**
- Stari Excel fajlovi postaju stale (vidi sekciju 5)
- Ako Upper Body dobiva atribute, stare sesije ih ne popunjuju automatski

**Okidač:** Shvatis da postoji više vrsta vježbi i hoćeš dodati grupu kao razinu

---

### Scenarij B — Premjestiti subtree u drugu Area

**Primjer:** `Domacinstvo > Automobili > Gorivo`
               ↓
              `Financije > Automobili > Gorivo`

**Što se mijenja u DB:**
- UPDATE `categories.area_id` za sve nodove u subtreeu (Automobili, Gorivo, i sva djeca)
- UPDATE `Automobili.parent_category_id` = NULL (ako postaje L1 nova Area)
  ILI = neki parent u Financije (ako se prikvači kao child)
- UPDATE `categories.level` za sve nodove ako se dubina mijenja
- **EVENTI: NIŠTA NE TREBA MIJENJATI** — category_id na svim eventima ostaje
  isti, chain_key ostaje isti

**Podatkovni rizik: NIZAK (čisto strukturalni)**

FK veza `events.category_id` → `categories.id` ne ovisi o area_id ni levelu.
parent eventa za Gorivo (category_id=Automobili, chain_key=GorivUUID) su i dalje
ispravni jer category_id=Automobili ne mijenja.

**Excel roundtrip: STALE ZA STRUCTURE SHEET**

CategoryPath u Structure sheetu uključuje Area name (kolona D = `CategoryPath` s
area prefiksom u Structure sheetu). U Activities Events sheetu CategoryPath je
**bez area name** — dakle Activities Export ostaje nepromijenjen i dalje se može
importati.

**Složenost migracije:** Srednja (UPDATE cascade na categories tablici, pažnja na level)

**Pro:**
- Nema gubitka podataka
- Activities Excel import ostaje funkcionalan
- Relativno čist SQL

**Contra:**
- Structure Excel iz starog konteksta neće se podudarati
- Ako se razina (level) mijenja, level field mora biti konzistentno ažuriran za sve nodove

**Okidač:** Financije reorganizacija — premještanje financijskog praćenja automobila iz Domacinstvo u Financije

---

### Scenarij C — Premjestiti leaf na drugog parenta (isti level, drugačija grana)

**Primjer:** `Fitness > Activity > Gym > Cardio`
               ↓
              `Fitness > Activity > Sport > Cardio` (Cardio prelazi pod Sport)

**Što se mijenja u DB:**
- UPDATE `Cardio.parent_category_id` = Sport.id
- Leaf eventi za Cardio: category_id=Cardio ostaje isti ✓

**PROBLEM: Orphan parent eventi**

Nakon premještaja, `buildParentChainIds(CardioUUID)` vraća `[Sport, Activity]`.
Ali u DB postoje parent eventi s `category_id=Gym, chain_key=CardioUUID` —
ti eventi su sada siročad. Nikad se neće dohvatiti u View/Edit, ali i dalje
zauzimaju prostor.

**Podatkovni rizik: SREDNJI**

Stare Gym parent atribute (npr. "lokacija=Centar" na Gym eventu koji je bio
u vezu s Cardio sesijom) su izgubljene (nedohvatljive) nakon premještaja.
Mogu se rekonstruirati jedino SQL-om direktno.

**Opcije za orphan parent evente:**
1. Ostaviti ih u DB (ne smetaju, ali su "dead weight")
2. Izbrisati ih uz backup (DELETE WHERE category_id=Gym AND chain_key=CardioUUID)
3. Konvertirati — premjestiti category_id s Gym na Sport (ako Gym i Sport dijele iste atribute)

**Excel roundtrip: DJELOMIČNO SLOMLJENO**

Activities Excel iz starog konteksta ima CategoryPath `Activity > Gym > Cardio`.
Nakon premještaja, taj path ne postoji. Import bi kreirao novu Cardio kategoriju
pod Gym umjesto da mapira na pravu Cardio (pod Sport).

**Složenost migracije:** Srednja + cleanup decision

**Pro:**
- Moguće bez gubitka leaf podataka

**Contra:**
- Stari parent event atributi su nedohvatljivi nakon premještaja
- Excel import iz starih fajlova kreira duplikate kategorija
- Zahtijeva eksplicitnu odluku o orphan parent eventima

**Okidač:** Shvatis da Cardio ne spada pod Gym nego pod širi Sport kontekst

---

### Scenarij D — Ravnanje hijerarhije (uklanjanje razine)

**Primjer:** `Activity > Gym > Strength` (Gym ima atribute: lokacija, trener)
               ↓
              `Activity > Strength` (Gym se briše)

**Što se mijenja u DB:**
- INSERT-ati sve Gym atribute definicije na Activity (ili Strength) razinu — ili ih izgubiti
- DELETE Gym kategoriju (kaskadno: attribute_definitions, ali i eventi!)
- UPDATE `Strength.parent_category_id` = Activity.id
- Gym eventi (category_id=Gym, chain_key=StrengthUUID) moraju biti obrisani ILI
  migrirani na Activity (pa ažurirati chain_key)

**Podatkovni rizik: VISOK**

Svi Gym atributi (lokacija, trener...) za sve sesije su izgubljeni osim ako
se eksplicitno migriraju. Migracija znači:
1. za svaki Gym event: dohvati atribute, INSERT ih kao Activity event_attributes
2. DELETE Gym eventi

**Složenost migracije:** Visoka — potrebna pažljiva SQL skripta po sesiji

**Pro:**
- Čišća struktura ako je Gym razina postala redundantna

**Contra:**
- Zahtijeva duboku SQL migraciju
- Greška = trajan gubitak podataka
- Nema simple rollback bez full backup + reimport

**Okidač:** Otkrivanje da jedna razina hijerarhije nema smisla ili su se svi workout
tipovi homogenizirali i nema potrebe za grupiranjem

---

### Scenarij E — Spajanje dvije leaf kategorije u jednu (Merge)

**Primjer:** Imaš `Strength` i `Snaga` kao odvojene leaf kategorije (duplikat)
i hoćeš sve `Snaga` evente premjestiti pod `Strength`

**Što se mijenja u DB:**
- UPDATE `events.category_id` = StrengthUUID WHERE category_id = SnagaUUID
- UPDATE `event_attributes.user_id` ... (ostaju OK, vežu se na event_id)
- UPDATE parent eventi: chain_key = SnagaUUID → StrengthUUID (za parent evente koji su bili vezani za Snaga sesije)
- DELETE Snaga kategorija (nakon pražnjenja)
- PAŽNJA: collision check! Ako ista session_start + user_id ima evente I za Strength I za Snaga, merge kreira duplikate

**Podatkovni rizik: VISOK**

Collision je kritičan. Bez provjere, možeš imati dvije leaf sesije u istom
session_start+leafCategory, što narušava P2.

**Složenost migracije:** Visoka — collision check per-session, pa selektivni merge

**Pro:**
- Čisti duplikate koje je teško ukloniti na drugi način

**Contra:**
- Collision risk mora biti adresiran
- Parent eventi SnagaUUID chain_key moraju biti ažurirani
- Dosta SQL-a, greška ima permanentne posljedice

**Okidač:** Data cleanup, otkrivanje dupliciranih kategorija iz starih importova

---

### Scenarij F — Samo preimenovanje (Rename)

**Primjer:** `Gym` → `Teretana` (samo display name, slug se ne mijenja)

**Podatkovni rizik: NULA**

Slug se ne mijenja → svi import/export mehanizmi i dalje rade.
Slug je stable identifier koji se koristi u depends_on referencama.
Implementirano u StructureNodeEditPanel ✓

**Okidač:** Gramatička ili konceptualna korekcija naziva

---

## 3. Opcije implementacije

### Opcija 1: SQL-first (za Sašu, odmah)

**Princip:** Za svaki tip reorganizacije, pripremamo SQL skripte koje Saša
izvršava direktno u Supabase SQL Editoru. Nema frontend rada.

**Workflow:**
1. Export full backup (postoji u UI)
2. Pokrenuti odgovarajuću SQL skriptu u Supabase
3. Verificirati u aplikaciji

**Prednosti:**
- Nema potrebe za frontendom
- Precizno, transakcijsko, auditabilno
- Može se testirati na test projektu (budući Playwright Supabase)
- Dovoljno za single-user i za Financije reorganizaciju

**Nedostaci:**
- Nije prikladno za buduće shared korisnike koji nisu tech-savvy
- Svaki tip operacije zahtijeva drugu skriptu
- Greška u SQL-u = direktna šteta (ali backup je napravljen)

**Scenariji koji su laki za SQL:** A, B, F
**Scenariji koji su složeniji ali izvedivi:** C, D, E

---

### Opcija 2: UI operacije u Structure tabu (novi "Reorganize" mode)

**Princip:** Proširiti Structure tab s novim operacijama koje imaju:
- Preview impact (N evenata, N atributa zahvaćeno)
- Auto-download full backup prije svake operacije
- Confirm + execute

**Moguće operacije u UI:**
- "Insert level between" — action u context menu na parent kategoriji
- "Move to Area" — drag-and-drop ili dropdown picker u Edit panelu
- "Move under different parent" — slično

**Prednosti:**
- User-friendly, prikladno za buduće shared korisnike (owner)
- Backup je garantiran (nema skip-a)
- Impact preview smanjuje greške

**Nedostaci:**
- Značajan frontend razvoj (svaka operacija = dedicated modal + backend logic)
- Rollback je i dalje "reimport iz backupa"
- Merge (Scenarij E) je teže napraviti u UI nego u SQL

---

### Opcija 3: Excel-driven migration (proširenje Import mehanizma)

**Princip:** Korisnik exporta strukturu, editira CategoryPath u Excelu
(premješta kategorije), i importa "update mode" koji razumije premještaje.

**Što bi trebalo biti prošireno u Import:**
- Prepoznati: isti Slug, drugačiji CategoryPath = "move" operacija
- Za move: UPDATE `parent_category_id` (ne CREATE)
- Za orphan parent evente: cleanup opcija

**Prednosti:**
- Korisnik već zna raditi s Excel strukturnim fajlom
- Familijaran workflow (Export → Edit → Import)
- Dobro za batch reorganizaciju (više operacija odjednom)

**Nedostaci:**
- Proširenje Import logike nije trivijalno (trenutno je strogo non-destructive)
- Orphan parent eventi zahtijevaju zasebnu odluku
- Collision i chain_key konzistencija moraju biti provjereni za svaku operaciju

---

### Opcija 4: Hybrid pristup (preporučeno)

**Faza 0 — odmah:** SQL skripte za Sašu (Financije reorganizacija i slično)
**Faza 1 — kratkoročno:** UI operacije za "safe" scenarije (Insert Between + Move to Area)
**Faza 2 — dugoročno:** Excel-driven "update mode" Import za batch reorganizacije
**Faza 3 — collab era:** "Restructure" dostupan samo owneru, notifikacija suradnicima

---

## 4. Multi-user razmatranja

Organizacijsko pravilo koje treba kodirati u aplikaciji:

**Samo Area owner smije reorganizirati strukturu.**

Shared korisnik (korisnik B iz MULTI_USER_SHARING_ANALYSIS.md) ima read/write
na evente, ali ne i na strukturu. Ovo je već planirano kao dio collab arhitekture.

### Problemi specifični za multi-user reorganizaciju:

**Problem 1: Race condition**
- Korisnik B dodaje novu sesiju dok owner premješta kategoriju
- Rješenje: "Maintenance lock" na Area za trajanja reorganizacije (owner togglea)
  ILI optimistična strategija — reorganizacija je brza SQL operacija

**Problem 2: Stale Excel kod B korisnika**
- Korisnik B je exportao Excel jučer, owner reorganizira sutra
- Stari Excel ima stare CategoryPaths
- Rješenje: dokumentirati da Excel iz perioda prije reorganizacije nije valjan za import

**Problem 3: Notifikacija**
- Korisnik B otvori aplikaciju i vidi promijenjenu strukturu
- Ovo je OK — aplikacija uvijek čita live strukturu iz DB
- Opcija: "Structure changed" banner na Activities tabu (neobavezno)

**Problem 4: Chain_key konzistencija kod dijeljenih sesija**
- Ako owner premjesti kategoriju, chain_key ostaje isti UUID
- Korisnik B-ovi stari eventi su i dalje ispravno vezani ✓
- Ali orphan parent eventi (Scenarij C) su problem za oba korisnika

---

## 5. Excel roundtrip nakon reorganizacije

### Što se dogodi sa starim Excel fajlovima:

| Tip reorganizacije | Activities Excel (stari) | Structure Excel (stari) |
|--------------------|--------------------------|------------------------|
| Rename (F) | ✓ Radi (slug = key, ne name) | ✓ Radi |
| Insert Between (A) | ✗ CategoryPath ne odgovara | ✗ CategoryPath ne odgovara |
| Move to Area (B) | ✓ Radi (bez area u Activities) | ✗ CategoryPath ne odgovara |
| Move to Parent (C) | ✗ CategoryPath ne odgovara | ✗ CategoryPath ne odgovara |
| Flatten (D) | ✗ CategoryPath ne odgovara | ✗ CategoryPath ne odgovara |
| Merge (E) | ✗ Stara leaf kategorija ne postoji | ✗ Stara leaf ne postoji |

### Strategije za upravljanje stale Excel fajlovima:

**Strategija 1: Accept & Document (jednostavno)**
Dokumentirati da svaki Excel export ima "rok trajanja" — valjan samo dok se
struktura ne promijeni. Full backup prije reorganizacije = jedina sigurna kopija
i jedini valjan restore fajl nakon operacije.

**Strategija 2: Path Mapping Sheet (složenije)**
Dodati novi sheet `PathMapping` u unified workbook koji mapira stare CategoryPaths
na nove. Import ga čita i automatski remapira evente na ispravne kategorije.

**Strategija 3: Version Lock (najsigurnije, ali restriktivno)**
Svaki Excel workbook dobiva "structure hash" (MD5 svih CategoryPath slugova).
Import blokira ako se hash razlikuje od trenutnog stanja DB. Korisnik mora
re-exportati i koristiti novi fajl.

**Preporuka:** Strategija 1 za sada (najmanji overhead), Strategija 2 opcijalno
kad Excel-driven migration bude implementiran (Opcija 3 iz sekcije 3).

---

## 6. Preporučeni put naprijed

### 6.1 Za Financije reorganizaciju (odmah, bez frontenda)

Specificirati potrebne operacije (koje kategorije se premještaju kamo),
pa generirati SQL skripty za Scenarij B (Move to Area). Saša ih izvršava
u Supabase SQL Editoru uz full backup prethodno.

### 6.2 Za Insert Between (kratkoročno, Faza 1 backlog)

Dodati "Insert level between" UI akciju u Structure Edit Mode.
Ovo je most requested i najsigurnije za implementirati (bez orphan evenata):
- Impact preview: "N sesija dobit će novi prazan parent level"
- Auto-backup
- Execute (INSERT + UPDATE parent_category_id + UPDATE level)
- Upozorenje: stari Excel fajlovi postaju stale

### 6.3 Za Move to Area (kratkoročno, Faza 1 backlog)

Dodati "Move to Area" akciju na Area/L1 nodovima. Samo za root-level
premještaj (najčešći slučaj):
- Dropdown: odabir ciljane Area
- Impact preview: N kategorija, N atributa, N evenata
- Auto-backup
- Execute (batch UPDATE area_id + level recalc)

### 6.4 Za Merge i Flatten (dugoročno, Faza 2+)

Ove operacije su složenije i trebaju SQL-first pristup ili potpun UI
s collision detection. Predlažem ih odgoditi dok Faza 1 ne bude stabilna.

### 6.5 Za collab eru (Faza 3)

Dodati "Restructure" guard koji blokira operacije iz 6.2/6.3 ako korisnik
nije owner. Opcijalno: "Maintenance mode" na Area koji korisnik B vidi kao
read-only poruku.

---

## 7. Otvorena pitanja za dogovor

**Q1. Financije reorganizacija — konkretno:**
Koje kategorije/subtreeovi trebaju ići kamo? Je li ovo Scenarij B
(cijeli subtree u novu Area) ili Scenarij C (individualni leafovi pod
drukčije parente)?

**Q2. Insert Between — prioritet?**
Je li "ubaciti razinu između" nešto što je potrebno uskoro (npr. za
Financije reorganizaciju) ili je to buduća, nice-to-have stvar?

**Q3. Orphan parent eventi — politika:**
Kad se leaf premjesti pod novog parenta (Scenarij C), stari parent
eventi postaju siročad. Preferiraš:
- (a) Ostaviti ih u DB (zauzimaju prostor, nevidljivi u UI)
- (b) Auto-brisati s backupom
- (c) Prikazati korisniku i dopustiti mu da odluči

**Q4. Excel roundtrip strategija:**
Prihvaćaš li Strategiju 1 (stari Excel je stale, dokumentirano) kao
permanentnu politiku, ili hoćeš PathMapping Sheet (Strategija 2) kad
se radi Excel-driven migracija?

**Q5. SQL-first vs UI:**
Za Financije reorganizaciju — preferiraš SQL skripta koju sami pokrenemo,
ili preferiraš da se nešto implementira u UI da možeš u budućnosti bez
SQL Editora? (Utječe na redosljed backlog prioriteta)

**Q6. Multi-user timing:**
Hoće li reorganizacija uvijek biti operacija koja se radi dok je sustav
"miran" (jedna aktivna sesija korisnika), ili anticipiraš situacije
gdje owner reorganizira dok shared korisnik aktivno koristi app?

---

## Prilog A — SQL okvir za Scenarij B (Move Subtree to Area)

Ovaj okvir je generički template — konkretne UUID vrijednosti moraju biti
popunjene za svaki slučaj. Izvesti full backup prije izvršavanja!

```sql
-- PAŽNJA: Uvijek pokrenuti u transaction bloku i verificirati BEFORE COMMIT
-- Uvijek napraviti full_backup_*.xlsx export iz UI PRIJE pokretanja ove skripte!

BEGIN;

-- Korak 1: Identificirati subtree koji se premješta
-- Prilagoditi: zamijeniti 'Automobili' i 'Domacinstvo' s pravim vrijednostima
WITH subtree AS (
  SELECT c.id, c.level, c.name
  FROM categories c
  WHERE c.user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'  -- Saša UUID
    AND c.path <@ (
      SELECT path FROM categories
      WHERE slug = 'automobili'  -- slug root nodova koji se premješta
        AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
    )
)
SELECT * FROM subtree ORDER BY level;
-- Verificiraj da su ovo točni nodovi prije nastavka!

-- Korak 2: Dohvatiti ID ciljane area
SELECT id, name FROM areas WHERE slug = 'financije'
  AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d';

-- Korak 3: Ažurirati area_id za sve nodove u subtreeu
-- (Zamijeniti 'NEW_AREA_ID' s ID-om ciljane area iz Koraka 2)
UPDATE categories
SET area_id = 'NEW_AREA_ID',
    updated_at = now()
WHERE user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  AND path <@ (
    SELECT path FROM categories
    WHERE slug = 'automobili'
      AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  );

-- Korak 4: Ako root node postaje L1 u novoj area (nema parenta u novoj area):
-- UPDATE parent_category_id = NULL i level = 1 za root node
-- (preskočiti ako se prikvačuje pod postojeći parent u ciljnoj area)
UPDATE categories
SET parent_category_id = NULL,
    level = 1,
    updated_at = now()
WHERE slug = 'automobili'
  AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d';

-- Korak 5: Ažurirati level za sve čvorove u subtreeu ako se promijenila dubina
-- (samo ako je Korak 4 promijenio level root nodova)
-- Primjer: sve kategorije ispod automobili trebaju level-- ili level++ ovisno o novoj poziciji
-- Ovo je najkompleksniji dio — pažljivo provjeriti!

-- Korak 6: Verificirati rezultat
SELECT c.name, c.level, a.name as area_name, c.slug
FROM categories c
JOIN areas a ON a.id = c.area_id
WHERE c.user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  AND c.path <@ (
    SELECT path FROM categories
    WHERE slug = 'automobili'
      AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  )
ORDER BY c.level, c.name;

-- Ako rezultat izgleda ispravno:
COMMIT;
-- Ako nešto nije kako treba:
-- ROLLBACK;
```

---

## Prilog B — SQL okvir za Scenarij A (Insert Between)

```sql
-- SCENARIJ A: Ubaciti novu razinu između dviju postojećih
-- Primjer: Strength postaje child od Upper Body koji je novi child Gym-a
-- Uvijek napraviti full_backup_*.xlsx export iz UI PRIJE pokretanja!

BEGIN;

-- Korak 1: Dohvatiti podatke o roditeljskom nodu (npr. Gym) i djetetu (npr. Strength)
SELECT id, name, level, area_id, parent_category_id, path
FROM categories
WHERE user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  AND slug IN ('gym', 'strength');

-- Korak 2: Kreirati novu kategoriju između (zamijeniti vrijednosti!)
INSERT INTO categories (id, area_id, parent_category_id, name, slug, level, sort_order, user_id, path)
VALUES (
  gen_random_uuid(),
  'GYM_AREA_ID',        -- isti area_id kao Gym
  'GYM_ID',             -- parent je Gym
  'Upper Body',
  'upper_body',
  3,                     -- level = Gym_level + 1
  10,                    -- sort_order, prilagoditi
  '768a6056-91fd-42bb-98ae-ee83e6bd6c8d',
  -- path: ltree mora biti GYM_PATH.upper_body (ltree konkatenacija)
  (SELECT path FROM categories WHERE slug='gym' AND user_id='768a6056-91fd-42bb-98ae-ee83e6bd6c8d') || 'upper_body'
);

-- Korak 3: Ažurirati Strength da bude child Upper Body-a
UPDATE categories
SET parent_category_id = (SELECT id FROM categories WHERE slug='upper_body' AND user_id='768a6056-91fd-42bb-98ae-ee83e6bd6c8d'),
    level = 4,            -- bio je 3, sada je 4
    path = (SELECT path FROM categories WHERE slug='upper_body' AND user_id='768a6056-91fd-42bb-98ae-ee83e6bd6c8d') || 'strength',
    updated_at = now()
WHERE slug = 'strength'
  AND user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d';

-- Korak 4: Verificirati
SELECT name, level, slug FROM categories
WHERE user_id = '768a6056-91fd-42bb-98ae-ee83e6bd6c8d'
  AND slug IN ('gym', 'upper_body', 'strength')
ORDER BY level;

-- Ako OK:
COMMIT;
```

> **Napomena o ltree `path` koloni:** Supabase `ltree` tip zahtijeva da path bude
> lowercase ASCII identifikator s tačkama ili underscoreima kao separatorima.
> Ažuriranje `path` za sve descendante ubačene razine je neophodan ali nije
> prikazano u ovom okviru jer ovisi o konkretnoj hijerarhiji.
> U praksi: **category path se može ostaviti stale** — aplikacija ne koristi `path`
> za navigaciju (koristi `parent_category_id`). Path je materijaliziran za potencijalne
> DB-side `lquery` upite koji nisu trenutno u upotrebi u React appu.

---

*Dokument kreiran: 2026-03-31 — osnova za razgovor o strategiji reorganizacije*
*Sljedeći korak: Saša čita i odgovara na Q1–Q6 iz sekcije 7*
