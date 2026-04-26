# Multi-User Sharing — Analiza izvedivosti

**Datum:** 2026-03-30
**Status:** Analiza — odluke donesene, nije implementirano
**Pitanje:** Što treba napraviti da grupa poznatih korisnika (obitelj, prijatelji)
vidi i editira iste evente u dijeljenom Area lanacu?

---

## 1. Definirani use-case i odluke

| Pitanje | Odluka |
|---------|--------|
| Granularnost dijeljenja | **Cijela Area** + sve ispod (ne category-level) |
| Korisnici | Poznati (obitelj, prijatelji) — bez anonimnih pristupa |
| Email notifikacija | **Ne** — B vidi share automatski pri loginu |
| Tko može Export | **I owner i korisnik B** — Export svih evenata dijeljene Area |
| Import/Restore | Import radi za oba — to je Backup/Restore flow |
| Structure editiranje | **Samo owner** — B ne može rename/add/delete kategorije |
| Event delete | Korisnik može brisati; Export = Backup prije brisanja |
| Help/pravila | Napisati jasna pravila u UI (Help panel) |

**Excel model za dijeljenu Area:**
- **Export** (oba korisnika): dohvati sve evente dijeljene Area-e, bez obzira na `user_id`
- **Import** (oba korisnika): inserti koriste importerov `user_id`, ali u shared kategorijama
- Import je Backup/Restore — exportiraš prije brisanja, importiraš za vraćanje

---

## 2. Što znači "lanac" u ovom app-u

```
Area (npr. "Fitness")              ← dijeljenje se definira na ovoj razini
  └─ Category L1 (npr. "Activity") ← B vidi, ali ne može editirati strukturu
       └─ Category L2 (npr. "Gym")
            └─ Leaf (npr. "Strength")
                 └─ Events — B ih vidi, dodaje, editira
                      └─ Event_attributes (EAV vrijednosti)
```

---

## 3. Trenutno stanje — zašto sharing ne radi od kutije

Svaka tablica ima `user_id` koji jednoznačno filtrira pristup:

| Tablica | RLS filter (trenutno) |
|---------|----------------------|
| `areas` | `auth.uid() = user_id` |
| `categories` | `auth.uid() = user_id` |
| `attribute_definitions` | `auth.uid() = user_id` |
| `events` | `auth.uid() = user_id` |
| `event_attributes` | `auth.uid() = user_id` |

`data_shares` tablica postoji u SQL shemi ali nema RLS, nema hook-a, nema UI.

---

## 4. Ključni arhitekturalni problemi i rješenja

### Problem 1: Lookup grantee-a po emailu

`auth.users` nije dostupna client-side. Owner ne može doznati UUID korisnika B
samo iz emaila bez extra tablice.

**Rješenje: `profiles` tablica** (nova, ~30 SQL linija)

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamp with time zone DEFAULT now()
);

-- Auto-populate pri svakoj registraciji:
CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

RLS na `profiles`: svi autenticirani korisnici mogu SELECT (za invite lookup);
svaki user može UPDATE/DELETE samo svoj profil.

**Migracija za postojeće korisnike:** INSERT u `profiles` za sve postojeće `auth.users`.

### Problem 2: Pristup owner-ovim kategorijama i atributima

Korisnik B mora **čitati** categories i attribute_definitions čiji je `user_id = owner`.
Bez toga ne može vidjeti strukturu forme za Add/Edit Activity.

Nije potrebna DB funkcija — jednostavan subquery po `area_id`:

**RLS promjena na `areas`:**
```sql
CREATE POLICY "view own or shared areas" ON public.areas FOR SELECT
USING (
  auth.uid() = user_id
  OR id IN (
    SELECT target_id FROM data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);
```

**RLS promjena na `categories`:**
```sql
CREATE POLICY "view own or shared categories" ON public.categories FOR SELECT
USING (
  auth.uid() = user_id
  OR area_id IN (
    SELECT target_id FROM data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);
```

**RLS promjena na `attribute_definitions`** — ista logika via JOIN na categories:
```sql
CREATE POLICY "view own or shared attr defs" ON public.attribute_definitions FOR SELECT
USING (
  auth.uid() = user_id
  OR category_id IN (
    SELECT c.id FROM categories c
    JOIN data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
);
```

INSERT/UPDATE/DELETE na sve tri tablice ostaje `user_id = auth.uid()` (samo owner).

### Problem 3: Vidljivost evenata između korisnika

Kad B doda event, `user_id = B`. Owner ga ne vidi jer RLS filtrira `user_id = owner`.
I obratno.

**RLS promjena na `events`:**
```sql
CREATE POLICY "view own or shared events" ON public.events FOR SELECT
USING (
  auth.uid() = user_id
  OR category_id IN (
    SELECT c.id FROM categories c
    JOIN data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
  OR category_id IN (
    SELECT c.id FROM categories c
    JOIN data_shares ds ON c.area_id = ds.target_id
    WHERE ds.owner_id = auth.uid() AND ds.share_type = 'area'
  )
);
```

Zadnji OR: owner vidi evente svojih grantee-a u dijeljenim Area-ma.

**RLS na `event_attributes` i `event_attachments`:** ista logika via JOIN na events.

### Problem 4: INSERT evenata u shared kategorije

B inserira event s `user_id = B`, ali `category_id` je owner-ov.
INSERT policy mora dozvoliti B-u pisanje u shared kategorije:

```sql
CREATE POLICY "insert events in own or shared categories" ON public.events FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- vlastita kategorija
    category_id IN (SELECT id FROM categories WHERE user_id = auth.uid())
    OR
    -- shared kategorija s write permisijom
    category_id IN (
      SELECT c.id FROM categories c
      JOIN data_shares ds ON c.area_id = ds.target_id
      WHERE ds.grantee_id = auth.uid()
        AND ds.share_type = 'area'
        AND ds.permission = 'write'
    )
  )
);
```

UPDATE i DELETE na events ostaju `user_id = auth.uid()` — svaki briše/editira samo svoje.

### Problem 5: Excel Export dijeljene Area

`excelDataLoader.ts` filtrira `.eq('user_id', userId)` — dohvaća samo vlastite evente.

Kad je aktivna dijeljenu Area, treba dohvatiti **sve evente** te Area-e (svih usera).
RLS će propustiti samo ono čemu user ima pristup (vlastiti + shared) — frontend treba
ukloniti `user_id` filter za events query kada je shared context aktivan:

```typescript
// Umjesto:
.from('events').select(...).eq('user_id', userId)

// Za shared Area:
.from('events').select(...)
.in('category_id', allCategoryIds)  // sve kategorije te Area-e
// RLS automatski filtrira — vidiš sve što smiješ
```

**Import (Backup/Restore):** eventi se kreiraju s `user_id = importerov UUID`,
kategorije ostaju owner-ove. Import policy (gore) dozvoljava to za write-grantee.

### Problem 6: Kaskadni delete i backup

**Trenutni S27 flow** (Structure Delete s backupom) exportira samo `user_id = owner`
evente. Ako owner briše Area koja ima i B-ove evente, B-ovi eventi se brišu **bez
backupa za B-a**.

**Rješenje:**
- Proširiti S27 Structure Delete backup da exportira **sve evente** u lanacu
  (bez user_id filtra — RLS će svejedno propustiti samo ono čemu owner smije pristupiti)
- Ili: blokirati Structure Delete ako postoje tuđi eventi, s porukom
  "Ova Area sadrži evente korisnika X. Export napravite prvo."

Za sada prihvatljivo ako su korisnici svjesni toga.

---

## 5. Pending invites — korisnik B još nema account

Ako B još nije registriran, `profiles` lookup po emailu neće naći ništa.

**Rješenje: `share_invites` tablica**

```sql
CREATE TABLE public.share_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  grantee_email text NOT NULL,
  share_type text NOT NULL DEFAULT 'area',
  target_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('read', 'write')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now()
);

-- Kad B kreira account, trigger auto-prihvati pending invite:
CREATE FUNCTION public.handle_pending_invites() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.data_shares (owner_id, grantee_id, share_type, target_id, permission)
  SELECT owner_id, new.id, share_type, target_id, permission
  FROM public.share_invites
  WHERE grantee_email = new.email AND status = 'pending';

  UPDATE public.share_invites SET status = 'accepted'
  WHERE grantee_email = new.email AND status = 'pending';

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_pending_invites();
```

B se registrira → trigger pali → `data_shares` zapis se kreira → B odmah vidi dijeljenu Area.

---

## 6. Help / Pravila dijeljenja (sadržaj za UI)

Ovo treba biti vidljivo u app-u (Help panel, tooltip, ili sidebar u Share Management UI):

```
PRAVILA DIJELJENJA AREA-E
─────────────────────────────────────────────────
Vlasnik (owner):
  ✓ Vidi sve evente u Area-i (i svoje i korisnika kojima je dao pristup)
  ✓ Može dodavati i editirati vlastite evente
  ✓ Može editirati strukturu (kategorije, atribute)
  ✓ Može pozvati nove korisnike (read ili read+write)
  ✓ Može opozvati pristup
  ✓ Može exportirati sve evente (Export = Backup)

Korisnik s read pristupom:
  ✓ Vidi sve evente u dijeljenom Area-i (i ownerove i svoje)
  ✗ Ne može dodavati ni editirati evente
  ✗ Ne može mijenjati strukturu kategorija
  ✓ Može exportirati sve evente

Korisnik s read+write pristupom:
  ✓ Vidi sve evente u dijeljenom Area-i
  ✓ Može dodavati i editirati vlastite evente
  ✓ Može brisati vlastite evente
  ✗ Ne može mijenjati strukturu kategorija (rename, add/delete)
  ✓ Može exportirati sve evente (Export = Backup)
  ✓ Može importirati Excel (eventi se kreiraju pod njegovim imenom)

Brisanje:
  ! Svaki korisnik može brisati samo vlastite evente
  ! Owner koji briše cijelu Area briše i tuđe evente — napravi Export prvo
  ! Export dijeljene Area sadrži SVE evente, ne samo tvoje — to je Backup

Identitet:
  • Svaki event pamti tko ga je upisao (nema anonimnih unosa)
  • U pregledu evenata vidljivo je koji korisnik je upisao koji event
─────────────────────────────────────────────────
```

---

## 7. SQL migracije — pregled

```
008_profiles.sql         ~30 linija
  - CREATE TABLE profiles
  - Trigger: handle_new_user → auto-populate pri registraciji
  - INSERT za postojeće korisnike
  - RLS na profiles

009_sharing.sql          ~100 linija
  - ALTER TABLE data_shares ENABLE ROW LEVEL SECURITY
  - RLS politike na data_shares
  - CREATE TABLE share_invites + RLS
  - Trigger: handle_pending_invites
  - UPDATE SELECT politike: areas, categories, attribute_definitions,
    events, event_attributes, event_attachments
  - UPDATE INSERT politike: events (dozvoli write u shared kategorijama)
```

---

## 8. Frontend promjene — pregled

| Fajl | Promjena | Složenost |
|------|---------|-----------|
| `src/hooks/useAreas.ts` | Dohvati i shared areas | Niska |
| `src/hooks/useCategories.ts` | Dohvati i shared kategorije | Niska |
| `src/hooks/useStructureData.ts` | `isShared` flag — sakrij edit mode za B | Niska |
| `src/context/FilterContext.tsx` | `sharedContext?: { ownerId, permission }` | Niska |
| `src/lib/excelDataLoader.ts` | Bez `user_id` filtra za events kad je shared | Srednja |
| `src/lib/excelImport.ts` | Dozvoli import u shared kategorije | Srednja |
| `src/lib/excelExport.ts` | Export svih evenata (svi user_id) za shared Area | Srednja |
| `src/pages/AddActivityPage.tsx` | Guard: write permisija za shared | Niska |
| `src/pages/EditActivityPage.tsx` | Vidi i tuđe evente; edit samo vlastite | Srednja |
| `src/components/structure/StructureTableView.tsx` | Sakrij Edit Mode za shared | Niska |
| **NOVO:** `src/hooks/useDataShares.ts` | CRUD za data_shares + invite lookup | Srednja |
| **NOVO:** Share management UI | Invite po emailu, lista pristupa, revoke | Srednja |
| **Eventuelno:** prikaz autora eventa | Tko je upisao event (display_name iz profiles) | Niska |

---

## 9. Redosljed implementacije (kad dođe na red)

```
1. SQL: 008_profiles.sql — profiles tablica + trigger + migracija postojećih
2. SQL: 009_sharing.sql — data_shares RLS + share_invites + sve nove RLS politike
3. Frontend: useDataShares hook (CRUD)
4. Frontend: Share management UI (invite, lista, revoke)
5. Frontend: useAreas + useCategories proširenje
6. Frontend: FilterContext sharedContext
7. Frontend: StructureTableView — sakrij edit mode
8. Frontend: AddActivity + EditActivity guard
9. Frontend: excelDataLoader + excelExport — shared Area export
10. Frontend: excelImport — shared import
11. UI: Help panel s pravilima dijeljenja
12. Test: sve kombinacije owner/grantee-read/grantee-write
```

---

## 10. Relevantni fajlovi

```
sql/SQL_schema_V5_commented.sql
Claude-temp_R/docs_OLD/003_fix_rls_policies.sql    RLS template
src/hooks/useAreas.ts
src/hooks/useCategories.ts
src/hooks/useStructureData.ts
src/context/FilterContext.tsx
src/lib/excelDataLoader.ts
src/lib/excelImport.ts
src/lib/excelExport.ts
src/pages/AddActivityPage.tsx
src/pages/EditActivityPage.tsx
src/components/structure/StructureTableView.tsx
src/types/database.ts
docs/ARCHITECTURE_v1_6.md
```
