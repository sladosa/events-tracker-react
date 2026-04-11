# COLLAB_PLAN_v1.md
# Events Tracker — Plan implementacije kolaboracije

**Datum:** 2026-04-01
**Status:** Plan — ništa nije implementirano
**Spec detalji:** `Claude-temp_R/MULTI_USER_SHARING_ANALYSIS.md`
**Branch:** `collab` (kreira se iz `test-branch`)

---

## Pregled

Cilj: Omogućiti da owner dijeli jednu ili više Area-a s poznatim korisnicima
(obitelj, prijatelji). Shared korisnik vidi i editira evente u dijeljenim Area-ama,
ali ne može mijenjati strukturu kategorija.

Granularnost: **cijela Area** (ne category-level sharing).
Scope: single Supabase projekt (ne federation) — svi korisnici u istoj auth tablici.

---

## Prerequisiti (prije prvog retka koda)

### P1 — Supabase TEST projekt

- Kreirati novi Supabase projekt (izoliran od PROD)
- Kopirati SQL shemu: pokrenuti `sql/SQL_schema_V5_commented.sql` na TEST projektu
- Kreirati `.env.testing` s TEST Supabase URL + anon key
- Setup vodič: `docs/Playwright_Supabase_Setup_Guide.md`

### P2 — Test korisnici

Minimalno 2 korisnika na TEST Supabase:
- **owner@test.com** — vlasnik Area-e
- **grantee@test.com** — shared korisnik (write permisija za testove)

### P3 — Branch

```bash
git checkout test-branch
git pull
git checkout -b collab
```

`.env.local` na `collab` grani pokazuje na TEST Supabase (ne na PROD).

---

## Faza 1 — SQL migracije (TEST Supabase)

Sve SQL migracije pokrenuti isključivo na TEST projektu. Na PROD tek kad je
sve testirano i collab → main merge spreman.

### 008_profiles.sql (~30 linija)

```
- CREATE TABLE public.profiles (id, email, display_name, created_at)
- Trigger: handle_new_user → auto-INSERT u profiles pri svakoj registraciji
- RLS: svi auth korisnici mogu SELECT profiles (za invite lookup)
- RLS: svaki user može UPDATE/DELETE samo vlastiti profil
- Migracija: INSERT u profiles za sve postojeće auth.users
```

### 009_sharing.sql (~100 linija)

```
- ALTER TABLE data_shares ENABLE ROW LEVEL SECURITY
- RLS na data_shares (owner vidi vlastite; grantee vidi gdje je invite)
- CREATE TABLE share_invites + RLS + trigger handle_pending_invites
  (B kreira account → pending invites se auto-prihvate)
- UPDATE SELECT politike: areas, categories, attribute_definitions
  (korisnik vidi i owner-ove ako je grantee)
- UPDATE SELECT politike: events, event_attributes, event_attachments
  (korisnik vidi i tuđe evente u dijeljenim Area-ama — i kao grantee i kao owner)
- UPDATE INSERT politike: events
  (dozvoli B-u INSERT s user_id=B u shared kategorije)
```

**Verifikacija Faze 1:**
- Kao owner: kreirati Area, kategorije, atribute, evente
- Kreirati data_share zapis ručno (SQL) za grantee
- Kao grantee: `/app` učita → vidi shared Area u dropdown-u
- Kao grantee: može dohvatiti kategorije i atribute (form se renderira)

---

## Faza 2 — Frontend: hooks i context (niski rizik)

Redosljed implementacije iz sekcije 9 MULTI_USER_SHARING_ANALYSIS.md:

**2a — useDataShares hook** (novi fajl: `src/hooks/useDataShares.ts`)
- CRUD za `data_shares` tablicu
- Lookup u `profiles` po emailu (za invite)
- `createShare(ownerAreaId, granteeEmail, permission)`
- `revokeShare(shareId)`
- `listShares(areaId)` — za Share management UI

**2b — useAreas + useCategories** (proširenje postojećih)
- `useAreas.ts`: dohvati vlastite + shared Areas (RLS automatski filtrira)
- `useCategories.ts`: dohvati vlastite + shared kategorije

**2c — FilterContext sharedContext**
- Dodati `sharedContext?: { ownerId: string, permission: 'read' | 'write' }`
- Kad je aktivan filter na shared Area → `sharedContext` je populated
- Koriste ga Excel Export/Import i Activity guards

---

## Faza 3 — Frontend: Structure tab guard

**3 — StructureTableView.tsx**
- Dohvatiti `sharedContext` iz FilterContext
- Ako je `sharedContext` populated (korisnik je grantee): sakrij "Edit Mode" toolbar
- `isShared` flag u `useStructureData.ts`

**Verifikacija Faze 3:**
- Kao grantee: ne vidi Edit Mode gumb u Structure tabu
- Kao owner: Edit Mode radi normalno

---

## Faza 4 — Frontend: Activity guards

**4a — AddActivityPage.tsx**
- Guard: ako je shared Area i `permission !== 'write'` → prikaži "Read only" poruku
- Ako `permission === 'write'`: Add Activity radi normalno (user_id = B-ov UUID)

**4b — EditActivityPage.tsx**
- Može dohvatiti i owner-ove evente (RLS dozvoljava SELECT)
- Edit/Save samo za vlastite evente (`event.user_id === currentUser.id`)
- Ako pokušava editirati tuđi event: prikaži "Ovo je zapis korisnika X" poruku

**Verifikacija Faze 4:**
- Kao grantee (write): može dodati event → pojavi se i kod ownera
- Kao grantee (read): Add Activity blokiran
- Kao grantee: ne može editirati owner-ov event

---

## Faza 5 — Frontend: Excel Export/Import za shared Areas

**5a — excelDataLoader.ts**
- Za shared Area: ukloni `.eq('user_id', userId)` filter na events query
- RLS automatski filtrira — dohvati sve evente te Area-e (svi korisnici)

**5b — excelExport.ts**
- Export shared Area: bez user_id filtra → sve sesije svih korisnika
- Opcijsko: dodati kolonu "Korisnik" u export (display_name iz profiles)

**5c — excelImport.ts**
- Import u shared Area: category_id je owner-ov, user_id je importerov
- INSERT policy (Faza 1) ovo već dozvoljava — frontend ne treba extra logiku
- Dodati komentar/napomenu u ImportModal: "Evente importaš pod svojim imenom"

**Verifikacija Faze 5:**
- Owner exportira shared Area → vidi i vlastite i grantee-ove evente
- Grantee (write) importira Excel → eventi se kreiraju pod grantee user_id
- Owner vidi importirane grantee evente

---

## Faza 6 — Share Management UI

**NOVO: Share management UI** (novi komponent ili modal u AppHome/Settings)

Minimalni UI:
```
Share Management — Area: "Fitness"
─────────────────────────────────
Aktivni pristup:
  • ana@example.com — read+write  [Opozovi]
  • pero@example.com — read only  [Opozovi]

Pozovi novog korisnika:
  Email: [________________]  Permisija: [read+write ▼]  [Pošalji]

Pending invites:
  • marko@example.com — čeka registraciju  [Otkaži]
```

Smještaj: tab u AppHome (ravan "Settings" tab) ili modal iz Area dropdown menija.

---

## Faza 7 — Help panel

Kratki Help panel s pravilima dijeljenja (sadržaj u MULTI_USER_SHARING_ANALYSIS.md, sekcija 6).
Smještaj: ikonica "?" u Share Management UI ili dedicirani Help tab.

---

## Faza 8 — Merge na main (produkcija)

### Checklist prije mergea:
- [ ] Sve faze testirane na TEST Supabase s 2 korisnika
- [ ] `npm run typecheck` prolazi bez novih grešaka
- [ ] `npm run build` prolazi
- [ ] SQL migracije (008, 009) testirane, revijia gotova
- [ ] CLAUDE.md backlog ažuriran
- [ ] PENDING_TESTS.md ažuriran s test rezultatima

### Redosljed za produkciju:
1. Pokrenuti `008_profiles.sql` na PROD Supabase
2. Pokrenuti `009_sharing.sql` na PROD Supabase
3. Verifikacija: postojeći korisnici rade normalno (RLS backward-compatible)
4. `git checkout main && git merge collab`
5. `git push origin main` → Netlify deploy

---

## Napomene o SQL strukturi

`data_shares` tablica **već postoji** u `sql/SQL_schema_V5_commented.sql` ali bez RLS.
Provjeri schema i `user_id` kolone prije pisanja politika — svaka ALTER/CREATE mora
biti idempotentna (`CREATE POLICY IF NOT EXISTS`, `ALTER TABLE IF NOT EXISTS` itd.)

Za detalje SQL politika: MULTI_USER_SHARING_ANALYSIS.md sekcije 4 i 7.

---

*Plan kreiran: 2026-04-01 — kodiraj u svježem chatu, grana `collab`*
