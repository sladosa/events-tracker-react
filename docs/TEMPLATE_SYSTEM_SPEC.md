# Template System Spec — Events Tracker React

**Status:** Djelomično implementirano (S49)
**Branch:** test-branch

---

## Svrha

Template user (`system-templates@events-tracker.local`, UUID `00000000-0000-0000-0000-000000000001`)
drži "starter" Areas, Categories i Attribute Definitions koje se nude novim korisnicima
kao polazna točka. Template data je manageable kroz postojeći UI (Structure tab + Excel import/export)
— nema hardcodinga sadržaja u kodu.

---

## Što je implementirano (S49)

| Komponenta | Status | Napomena |
|-----------|--------|---------|
| Template user u TEST auth.users | ✅ | UUID: `00000000-0000-0000-0000-000000000001` |
| Template user u TEST profiles | ✅ | |
| 5 Areas (Health, Fitness, Finance, Work, Personal) | ✅ | TEST baza |
| 9 Categories (L1, bez child) | ✅ | TEST baza |
| 14 Attribute definitions | ✅ | TEST baza |
| RLS areas_select — template visible | ✅ | 009_sharing.sql + 010_template_seed.sql |
| RLS categories_select — template visible | ✅ | 009_sharing.sql + 010_template_seed.sql |
| RLS attr_def_select — template visible | ✅ | 009_sharing.sql + 010_template_seed.sql |
| useAreas.ts — template filter iz dropdowna | ✅ | `neq('user_id', TEMPLATE_USER_ID)` |
| sql/010_template_seed.sql | ✅ | Idempotent, pokrenuti na PROD kad odlučimo |
| Template user u PROD | ⬜ | Odgođeno |

---

## Što treba implementirati

### A. Add Area "From template" (prioritet 1)

**Gdje:** `src/components/structure/StructureAddAreaPanel.tsx`

**UX:**
```
+ Add New Area
─────────────────────────────
○ Create empty area
  Area Name: [___________]
  Slug: —

● Use template
  [ Health ▼ ]  ← dropdown: template areas koje user još nema (match po slug)
  
  Includes: Sleep, Nutrition, Medical (3 categories, 4 attrs total)
─────────────────────────────
              [Cancel] [Create]
```

**Logika:**
1. `useTemplateAreas()` hook (već postoji u `useAreas.ts`) — fetcha template areas
2. Filtriraj: prikaži samo one čiji `slug` ne postoji u user-ovim areas
3. Na Create:
   - INSERT nova Area pod `auth.uid()` s novim UUID-om (kopirani name/slug/sort_order)
   - INSERT sve categories te template area pod `auth.uid()` (novi UUID-ovi, isti name/slug/level/sort_order)
   - INSERT sve attribute_definitions tih categories pod `auth.uid()` (novi UUID-ovi)
4. Dispatch `areas-changed` event → filter dropdown se refresha

**Napomena:** Ako user već ima Area s istim slugom — ne nudi je u dropdownu.

### B. Template user password (prioritet 2)

- Postaviti password u TEST Supabase dashboard → Authentication → Users → template user → Reset password
- Isti postupak na PROD kad se 010_template_seed.sql pokrene na PROD
- Login kao `system-templates@events-tracker.local` → koristiti Structure tab za upravljanje templateima

### C. Garmin API adapter (future / backlog)

Template "Fitness" mogao bi imati atribute koji direktno odgovaraju Garmin API fieldovima
(`hr_avg`, `calories`, `distance`, `training_load`...). Import adapter bi mapirao
Garmin JSON response na user-ove attribute_definitions.

Scenarij:
- User ima vlastitu "Trening" area
- Garmin donese "Fitness" template s drugačijim atributima
- Merge/diff tool prikazuje razlike i nudi mapiranje

---

## Ključne konstante u kodu

```typescript
// src/hooks/useAreas.ts
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000001';
```

---

## SQL migracije

| Fajl | Svrha |
|------|-------|
| `sql/008_profiles.sql` | profiles tablica + trigger |
| `sql/009_sharing.sql` | RLS policies (uključuje template user visibility) |
| `sql/010_template_seed.sql` | Template user + Areas + Categories + Attr defs + RLS fix |

Redoslijed pokretanja: 008 → 009 → 010

---

## Napomene

- Template areas su vidljive svim authenticated userima (RLS), ali su **isključene iz filter dropdowna** (`useAreas.ts` dodaje `.neq('user_id', TEMPLATE_USER_ID)`)
- Template data je read-only za obične korisnike (RLS INSERT/UPDATE/DELETE ne dopuštaju pisanje tuđih podataka)
- Template user se može prijaviti u aplikaciju i koristiti Structure tab za upravljanje templateima
