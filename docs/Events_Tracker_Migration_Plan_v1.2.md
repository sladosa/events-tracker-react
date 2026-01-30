# Events Tracker - Plan Migracije i Razvoja

**Verzija:** 1.2  
**Datum:** 2026-01-28  
**Autor:** Claude (na temelju diskusije sa Sašom)

---

## 📋 Sadržaj

1. [Status Projekta](#1-status-projekta)
2. [Lessons Learned](#2-lessons-learned)
3. [Arhitektura i Koncepti](#3-arhitektura-i-koncepti)
4. [Radni Plan W1-W3](#4-radni-plan-w1-w3)
5. [Sljedeći Koraci](#5-sljedeći-koraci)
6. [Tehnička Dokumentacija](#6-tehnička-dokumentacija)

---

## 1. Status Projekta

### ✅ Završeno (2026-01-28)

| Stavka | Status | Napomena |
|--------|--------|----------|
| GitHub repo kreiran | ✅ | `sladosa/events-tracker-react` |
| Vite + React + TypeScript | ✅ | React 19, Vite 7 |
| Tailwind CSS | ✅ | Konfiguriran s PostCSS |
| Supabase client | ✅ | Povezan s postojećom bazom |
| Netlify deployment | ✅ | Auto-deploy na push |
| **W1: Auth System** | ✅ | Login, SignUp, Forgot/Reset Password |
| **W2.1: Temelji** | ✅ | TypeScript tipovi, Hooks, FilterContext |
| **W2.2: UniversalFilter** | ✅ | TreeView, Breadcrumb, Search |

### W2 Implementirane Komponente

| Komponenta | Lokacija | Funkcionalnost |
|------------|----------|----------------|
| TypeScript tipovi | `src/types/database.ts` | Svi tipovi za tablice |
| useAreas | `src/hooks/useAreas.ts` | Dohvat Area-a s template filterom |
| useCategories | `src/hooks/useCategories.ts` | Dohvat kategorija s filterima |
| useCategoryPath | `src/hooks/useCategoryPath.ts` | Breadcrumb path builder |
| useCategoryTree | `src/hooks/useCategoryTree.ts` | Hijerarhijsko stablo |
| FilterContext | `src/context/FilterContext.tsx` | Shared filter state |
| TreeView | `src/components/filter/TreeView.tsx` | Hijerarhijski prikaz |
| Breadcrumb | `src/components/filter/Breadcrumb.tsx` | Navigacija |
| UniversalFilter | `src/components/filter/UniversalFilter.tsx` | Glavna komponenta |
| UI komponente | `src/components/ui/*` | Button, Card, Input, Spinner |

### Deployment Info

| Resurs | URL |
|--------|-----|
| **React App (LIVE)** | https://events-tracker-react.netlify.app |
| GitHub Repo | https://github.com/sladosa/events-tracker-react |
| Supabase Dashboard | https://supabase.com/dashboard/project/zdojdazosfoajwnuafgx |
| Streamlit (backup) | https://events-tracker.streamlit.app |

---

## 2. Lessons Learned

### 🔐 RLS (Row Level Security) - KRITIČNO!

#### Problem koji smo imali:
Korisnik je vidio podatke SVIH korisnika u bazi, uključujući template usera i druge korisnike.

#### Uzrok:
- RLS nije bio uključen na tablicama
- Stare politike su imale konfliktne uvjete (npr. `qual = NULL` što znači "dopusti svima")
- Postojale su duplirane politike s istim imenima

#### Rješenje:

**1. Uvijek uključi RLS:**
```sql
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
```

**2. Koristi ČISTE, jednostavne politike:**
```sql
-- Obriši sve stare
DROP POLICY IF EXISTS "staro_ime" ON public.tablica;

-- Kreiraj nove s jasnim imenima
CREATE POLICY "areas_select" ON public.areas
    FOR SELECT USING (auth.uid() = user_id);
```

**3. Za template podatke - dozvolj čitanje ali ne pisanje:**
```sql
CREATE POLICY "areas_select" ON public.areas
    FOR SELECT USING (
        auth.uid() = user_id 
        OR user_id = '00000000-0000-0000-0000-000000000000'::uuid
    );

-- INSERT/UPDATE/DELETE samo za vlastite
CREATE POLICY "areas_insert" ON public.areas
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**4. Provjera politika:**
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'areas';
```

---

### 👤 Template User Koncept

#### Što je template user?
- Specijalni user s ID-em `00000000-0000-0000-0000-000000000000`
- Sadrži "starter" Area-e i kategorije koje služe kao predlošci
- Novi korisnici vide ove podatke kao suggestions

#### Kako ga koristimo:

| Kontekst | Template podatke |
|----------|------------------|
| **Prikaz u UI-u** | NE - filtriramo ih |
| **Add Area dropdown** | DA - kao suggestions |
| **Add Category dropdown** | DA - kao suggestions |
| **Excel import** | NE - korisnik unosi svoje |

#### Implementacija u React hookovima:
```typescript
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// Default: NE prikazuj template
export function useAreas(options = { includeTemplates: false }) {
  // ...
  if (!includeTemplates) {
    query = query.neq('user_id', TEMPLATE_USER_ID);
  }
}

// Za suggestions: SAMO template
export function useTemplateAreas() {
  // ...
  query = query.eq('user_id', TEMPLATE_USER_ID);
}
```

---

### 📦 Supabase Nested Select - GOTCHA!

**Problem:** Nested relations se tiho ignoriraju ako nisu u jednoj liniji.

```typescript
// ❌ BROKEN - nested relations silently ignored!
const { data } = await supabase
  .from('categories')
  .select(`
    id,
    area:areas(
      name
    )
  `);

// ✅ CORRECT - single line
const { data } = await supabase
  .from('categories')
  .select('id, area:areas(name)');
```

---

### 🔄 Koegzistencija React i Streamlit

Oba sustava koriste istu Supabase bazu. Promjene u RLS politikama utječu na OBA!

**Važno:**
- Testiraj Streamlit nakon svake promjene RLS-a
- Ako Streamlit prestane raditi → provjeri RLS politike
- JWT expired greška = potreban re-login

---

## 3. Arhitektura i Koncepti

### 3.1 Hijerarhija Podataka

```
User
└── Areas (Health, Fitness, Finance...)
    └── Categories (level 1)
        └── Categories (level 2-10)
            └── Attribute Definitions
                └── Events
                    └── Event Attributes (EAV)
```

### 3.2 Template User Flow

```
┌─────────────────┐
│  Novi Korisnik  │
└────────┬────────┘
         │ Vidi template podatke (read-only)
         ▼
┌─────────────────┐
│  Add Area       │──► Suggestions iz template-a
└────────┬────────┘
         │ Kreira SVOJE podatke
         ▼
┌─────────────────┐
│  Vlastiti       │
│  podaci         │──► user_id = auth.uid()
└─────────────────┘
```

### 3.3 Filter State Management

```typescript
interface FilterState {
  areaId: UUID | null;
  categoryId: UUID | null;
  categoryPath: UUID[];    // Za breadcrumb
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}
```

Shared kroz `FilterContext` - koristi se u:
- UniversalFilter (lijevi panel)
- Structure View (desni panel)
- Events View (kad bude implementiran)

---

## 4. Radni Plan W1-W3

### W1: Auth Screen ✅ ZAVRŠENO

- [x] Login page s tabovima
- [x] Sign Up s potvrdom
- [x] Forgot Password flow
- [x] Reset Password page
- [x] Mobile responsive
- [x] PWA installable na Android

### W2: Univerzalni Filter 🔄 U TIJEKU

- [x] W2.1: TypeScript tipovi
- [x] W2.1: Hooks (useAreas, useCategories, useCategoryPath, useCategoryTree)
- [x] W2.1: FilterContext
- [x] W2.1: UI komponente (Button, Card, Input, Spinner)
- [x] W2.2: TreeView komponenta
- [x] W2.2: Breadcrumb navigacija
- [x] W2.2: Search funkcionalnost
- [x] W2.2: Template user filtering
- [ ] W2.3: Sunburst vizualizacija (D3.js)
- [ ] W2.4: Events tab s date range picker

### W3: Add Activity ⏳ ČEKA

- [ ] Activity Wizard / All-in-one forma
- [ ] DateTimePicker komponenta
- [ ] CategorySelector (koristi UniversalFilter)
- [ ] AttributeForm (dinamički generirani inputi)
- [ ] Template suggestions za Area/Category

---

## 5. Sljedeći Koraci

### Prioritet 1: W2.3 - Sunburst vizualizacija
- Implementirati D3.js sunburst chart
- Povezati s FilterContext (klik = filter)
- Hover tooltip s detaljima

### Prioritet 2: W2.4 - Events tab
- Date range picker komponenta
- Events lista (read-only za sada)
- Sort opcije (newest first, oldest first)

### Prioritet 3: W3 - Add Activity
- Odabir pristupa (Wizard vs All-in-one)
- Template suggestions
- Dinamički atributi prema kategoriji

---

## 6. Tehnička Dokumentacija

### 6.1 SQL Skripte (sql/ folder)

| Datoteka | Svrha |
|----------|-------|
| `001_lookup_values.sql` | Nova tablica za dinamičke dropdowne |
| `002_lookup_values_examples.sql` | Primjeri korištenja (dokumentacija) |
| `003_fix_rls_policies.sql` | Čišćenje i postavljanje RLS politika |

### 6.2 Konstante

```typescript
// Template user ID
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// Supabase
const SUPABASE_URL = 'https://zdojdazosfoajwnuafgx.supabase.co';
```

### 6.3 Folder Struktura

```
events-tracker-react/
├── sql/                    # SQL skripte
├── src/
│   ├── components/
│   │   ├── filter/         # UniversalFilter, TreeView, Breadcrumb
│   │   └── ui/             # Button, Card, Input, Spinner
│   ├── context/            # FilterContext
│   ├── hooks/              # useAreas, useCategories, etc.
│   ├── lib/                # supabaseClient, cn (classnames)
│   ├── pages/              # AuthPage, AppHome, ResetPasswordPage
│   └── types/              # TypeScript tipovi
├── .env.example
├── netlify.toml
└── package.json
```

---

## Changelog

### v1.2 (2026-01-28)
- ✅ W2.1 i W2.2 implementirani
- ✅ RLS politike očišćene i popravljene
- ✅ Template user filtering implementiran
- 📝 Lessons learned dokumentirani
- 🐛 Fix: Streamlit opet radi nakon RLS popravka

### v1.1 (2026-01-27)
- ✅ W1 Auth kompletno završen
- ✅ GitHub + Netlify deployment postavljen

### v1.0 (2026-01-25)
- Inicijalni plan kreiran

---

*Dokument ažuriran: 2026-01-28*
