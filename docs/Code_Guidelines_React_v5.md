# Code Guidelines - React + Supabase + Netlify

**Verzija:** 5.0  
**Projekt:** Events Tracker  
**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify  
**Zadnja izmjena:** 2026-02-09

---

## 🚨 KRITIČNO: Pre-Commit Checklist

**PRIJE SVAKOG PUSHA OBAVEZNO:**

```bash
# 1. TypeScript check (OBAVEZNO!)
npm run typecheck

# 2. Build test (OBAVEZNO!)
npm run build

# 3. Opcionalno: Lint check
npm run lint

# 4. Sve zajedno:
npm run check   # typecheck + lint
```

⚠️ **Vite dev server NE provjerava TypeScript!** Kod može raditi lokalno ali failati na Netlify deploy.

---

## 📋 Sadržaj

1. [Tech Stack](#1-tech-stack)
2. [Struktura Projekta](#2-struktura-projekta)
3. [Naming Conventions](#3-naming-conventions)
4. [Komponente](#4-komponente)
5. [State Management](#5-state-management)
6. [Supabase Integracija](#6-supabase-integracija)
7. [Styling (Tailwind)](#7-styling-tailwind)
8. [Error Handling](#8-error-handling)
9. [Performance & React Hooks](#9-performance--react-hooks)
10. [Build & Deploy](#10-build--deploy)
11. [ESLint Rules Reference](#11-eslint-rules-reference)
12. [Poznati Gotchas](#12-poznati-gotchas)
13. [Events Tracker Specifics](#13-events-tracker-specifics)
14. [Test Checklist](#14-test-checklist)
15. [Troubleshooting Guide](#15-troubleshooting-guide)

---

## 1. Tech Stack

| Tehnologija | Verzija | Svrha |
|-------------|---------|-------|
| React | 19.x | UI framework |
| TypeScript | 5.9.x | Type safety |
| Vite | 7.x | Build tool |
| Tailwind CSS | 3.x | Styling |
| Supabase JS | 2.x | Backend (Auth, DB, RLS) |
| React Router | 7.x | Routing |
| Netlify | - | Hosting (auto-deploy from GitHub main) |

---

## 2. Struktura Projekta

```
events-tracker-react/
├── .github/
│   └── workflows/
│       └── typecheck.yml        # CI: tsc check na svakom pushu
├── public/
├── src/
│   ├── components/
│   │   ├── ui/              # Button, Input, Card, Spinner
│   │   ├── activity/        # AddActivity komponente
│   │   └── filter/          # ProgressiveCategorySelector, Breadcrumb
│   ├── hooks/
│   │   ├── useAreas.ts
│   │   ├── useCategories.ts
│   │   └── ...
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── cn.ts
│   │   └── constants.ts
│   ├── pages/
│   │   ├── AuthPage.tsx
│   │   ├── AppHome.tsx       # Main home with Filter + Tabs
│   │   ├── AddActivityPage.tsx
│   │   └── ResetPasswordPage.tsx
│   ├── types/
│   │   └── database.ts
│   ├── context/
│   │   └── FilterContext.tsx  # Global filter state
│   ├── App.tsx
│   └── main.tsx
├── .env.local              # NE COMMITATI!
├── netlify.toml
├── tsconfig.json
├── tsconfig.app.json       # Strict: verbatimModuleSyntax, noUnusedLocals
└── vite.config.ts          # Build config with chunk splitting
```

---

## 3. Naming Conventions

| Tip | Konvencija | Primjer |
|-----|------------|---------|
| Komponente | PascalCase | `ActivityForm.tsx` |
| Hooks | camelCase s "use" | `useCategories.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Konstante | UPPER_SNAKE | `TEMPLATE_USER_ID` |
| Type imports | `import type` ili `type` keyword | Vidi sekciju 10.2 |

---

## 4. Komponente

### Struktura Komponente

```typescript
// ActivityForm.tsx

// 1. Imports - grupirani, type imports odvojeni
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category } from '@/types';  // ← type-only import!

// 2. Props interface
interface ActivityFormProps {
  categoryId: string;
  onSave?: (activity: Activity) => void;
}

// 3. Komponenta
export function ActivityForm({ categoryId, onSave }: ActivityFormProps) {
  // 3a. Hooks na vrhu
  const { user } = useAuth();
  
  // 3b. State
  const [isLoading, setIsLoading] = useState(false);
  
  // 3c. Effects
  useEffect(() => {
    // ...
  }, [categoryId]);
  
  // 3d. Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ...
  };
  
  // 3e. Render
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 5. State Management

### 5.1 Local State (useState)

```typescript
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

### 5.2 Context za Global State

```typescript
// context/FilterContext.tsx
interface FilterContextType {
  filter: FilterState;
  isLeafCategory: boolean;       // Track leaf status
  fullPathDisplay: string;       // "Area > L1 > L2"
  selectArea: (areaId: UUID | null) => void;
  selectCategory: (categoryId: UUID | null, path?: UUID[]) => void;
  reset: () => void;
  // ... ostale metode
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilter must be used within FilterProvider');
  return context;
}
```

### 5.3 Custom Hooks za Data Fetching

```typescript
// hooks/useCategories.ts
export function useCategories(areaId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      // ... fetch logic
    }
    fetchCategories();
  }, [areaId]);

  return { categories, isLoading, error };
}
```

---

## 6. Supabase Integracija

### 6.1 KRITIČNO: Single-Line Select

```typescript
// ❌ BROKEN - nested relations silently ignored!
const { data } = await supabase
  .from('events')
  .select(`
    id,
    event_attributes(
      value_number
    )
  `);

// ✅ CORRECT - single line
const { data } = await supabase
  .from('events')
  .select('id, event_attributes(value_number, attribute_definitions(name))');
```

### 6.2 KRITIČNO: Supabase Type Inference s Joinovima

```typescript
// ❌ PROBLEM - tsc ne može parsirati complex join
const { data } = await supabase
  .from('categories')
  .select('id, name, area:areas(id, name, icon, color, slug)');
setCategories(data || []);  // TS error!

// ✅ FIX - explicit type cast
const { data } = await supabase
  .from('categories')
  .select('id, name, area:areas(id, name, icon, color, slug)');
setCategories((data as unknown as CategoryWithArea[]) || []);
```

### 6.3 Template User

```typescript
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// Za prikaz - ISKLJUČI template data
const { data } = await supabase
  .from('areas')
  .select('*')
  .neq('user_id', TEMPLATE_USER_ID);
```

### 6.4 Insert s EAV Pattern

```typescript
// 1. Insert event
const { data: event } = await supabase
  .from('events')
  .insert({
    user_id: userId,
    category_id: categoryId,
    event_date: date,
    session_start: `${date}T${time}:00`,
    comment: comment
  })
  .select()
  .single();

// 2. Insert attributes (EAV)
const attributeRecords = attributes.map(attr => ({
  event_id: event.id,
  user_id: userId,
  attribute_definition_id: attr.definitionId,
  [`value_${attr.type}`]: attr.value
}));

await supabase.from('event_attributes').insert(attributeRecords);
```

---

## 7. Styling (Tailwind)

### 7.1 Dinamičke Klase

```typescript
// ❌ Tailwind NE vidi dinamičke klase
const color = 'blue';
<div className={`bg-${color}-500`}>  // NE RADI!

// ✅ Koristi mapiranje
const colorClasses = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
};
<div className={colorClasses[color]}>
```

### 7.2 Responsive Design (Mobile-First)

```typescript
// Mobile first - default je mobile, sm/md/lg za veće ekrane
<div className="px-3 sm:px-6 lg:px-8">
  <h1 className="text-sm sm:text-base lg:text-lg">
```

### 7.3 cn() Helper za Conditional Classes

```typescript
import { cn } from '@/lib/cn';

<button className={cn(
  'px-4 py-2 rounded-lg',
  isActive && 'bg-indigo-500 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

---

## 8. Error Handling

```typescript
// U async funkcijama
try {
  const { data, error } = await supabase.from('events').select('*');
  if (error) throw error;
  // process data
} catch (err) {
  console.error('Error:', err);
  toast.error('Failed to load events');
}
```

---

## 9. Performance & React Hooks

### 9.1 Lazy Loading

```typescript
const StructureView = lazy(() => import('./StructureView'));

<Suspense fallback={<Spinner />}>
  <StructureView />
</Suspense>
```

### 9.2 Memoization

```typescript
// useCallback za handlers koji se prosljeđuju child komponentama
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

// useMemo za expensive computations
const sortedItems = useMemo(() => 
  items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

### 9.3 React Hooks - Best Practices ⚠️ VAŽNO!

#### useEffect Rules

**❌ NIKAD:**
```typescript
// 1. NE pozivaj setState direktno u effect body-ju bez async wrappera
useEffect(() => {
  setData(computeData());  // ❌ Može uzrokovati infinite loop!
}, [deps]);

// 2. NE zaboravi cleanup za subscriptions
useEffect(() => {
  const sub = subscribe();
  // ❌ Nema cleanup!
}, []);
```

**✅ ISPRAVNO:**
```typescript
// 1. Async funkcija unutar useEffect
useEffect(() => {
  const loadData = async () => {
    const result = await fetchData();
    setData(result);  // ✅ OK - u async funkciji
  };
  loadData();
}, [deps]);

// 2. S cleanup-om
useEffect(() => {
  const sub = subscribe();
  return () => sub.unsubscribe();  // ✅ Cleanup!
}, []);
```

#### Kada koristiti useEffect vs. Event Handler

| Situacija | Koristi |
|-----------|---------|
| Fetch na mount | useEffect |
| Fetch na button click | Event handler |
| Subscribe/unsubscribe | useEffect s cleanup |
| Update na prop change | useEffect s dependency |
| User action (click, select) | Event handler |

**Primjer - ProgressiveCategorySelector:**
```typescript
// ✅ CORRECT: Event handler za user action
const handleAreaChange = (areaId: string) => {
  selectArea(areaId);
  loadCategoriesForStep(newStep);  // Pozovi async funkciju
};

// ✅ CORRECT: useEffect za reakciju na prop change
useEffect(() => {
  if (filter.areaId) {
    loadL1Categories(filter.areaId);
  }
}, [filter.areaId]);
```

---

## 10. Build & Deploy

### 10.1 Pre-Commit Checklist (OBAVEZNO!)

```bash
# UVIJEK prije pusha:
npm run typecheck    # TypeScript provjera
npm run build        # Simulira Netlify build

# Opcionalno:
npm run lint         # ESLint provjera
npm run check        # typecheck + lint
```

### 10.2 TypeScript Strict Mode - Česte Greške

#### `verbatimModuleSyntax: true`

```typescript
// ❌ GREŠKA
import { useState, ReactNode } from 'react';

// ✅ ISPRAVNO
import { useState, type ReactNode } from 'react';
```

#### `noUnusedLocals: true`

```typescript
// ❌ GREŠKA - 'Category' is declared but never used
import type { Category, CategoryWithArea } from '@/types';

// ✅ FIX - ukloni nekorišteno
import type { CategoryWithArea } from '@/types';
```

#### `noUnusedParameters: true`

```typescript
// ❌ GREŠKA
const handleClick = (item: Item, index: number) => { ... };

// ✅ FIX - prefiksaj s _
const handleClick = (item: Item, _index: number) => { ... };
```

#### `_` Prefix - Kada RADI i kada NE RADI

```typescript
// ✅ _ PREFIX RADI ZA:
// 1. Destructured props
export function MyComponent({ mode: _mode = 'browse' }: Props) { }

// 2. Destructured hook returns
const { data, error: _error } = useSomeHook();

// 3. For...of loop variables
for (const [_key, value] of Object.entries(map)) { }

// 4. Function parameters
array.map((_item, index) => index);

// ❌ _ PREFIX NE RADI ZA:
// 1. Top-level const/let - MORAŠ UKLONITI
const _unusedVariable = 'test';  // ❌ GREŠKA!

// 2. Nekorištene funkcije - MORAŠ ZAKOMENTIRATI
const _handleFinish = () => { };  // ❌ GREŠKA!
```

### 10.3 Vite Build Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
```

### 10.4 GitHub Actions CI

```yaml
# .github/workflows/typecheck.yml
name: TypeScript Check
on:
  push:
    branches: [main, test-branch]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

### 10.5 Netlify Deploy Flow

```
GitHub push → GitHub Actions (typecheck) → Netlify Build → Deploy
                    ↓                           ↓
              ✅ ili ❌ odmah            ✅ Published ili ❌ Failed
              (brže, ~30s)               (sporije, ~30-60s)
```

---

## 11. ESLint Rules Reference

### react-hooks/exhaustive-deps

```typescript
// ❌ Missing dependency
useEffect(() => {
  setData(someValue);  // 'someValue' should be in deps!
}, []);

// ✅ Fixed
useEffect(() => {
  setData(someValue);
}, [someValue]);
```

### react-hooks/rules-of-hooks

```typescript
// ❌ Hook inside condition
if (condition) {
  const [state, setState] = useState(false);  // ❌ GREŠKA!
}

// ✅ Hook at top level
const [state, setState] = useState(false);
if (condition) {
  // use state here
}
```

### @typescript-eslint/no-unused-vars

```typescript
// ❌ Variable declared but never used
const unusedVar = 42;  // Remove or use it!

// ✅ Prefix with _ if destructured
const { data, error: _error } = useHook();  // OK
```

### Quick Fix

```bash
# Auto-fix što se može
npm run lint -- --fix
```

---

## 12. Poznati Gotchas

### ⚠️ #1: Vite Dev ≠ Netlify Build

`npm run dev` NE pokreće TypeScript compiler! Uvijek `npm run typecheck` prije pusha.

### ⚠️ #2: Supabase Nested SELECT

Mora biti single line - vidi sekciju 6.1.

### ⚠️ #3: Supabase Join Type Inference

Koristi `as unknown as T[]` - vidi sekciju 6.2.

### ⚠️ #4: useEffect Cleanup

Uvijek cleanup subscriptions i timers!

### ⚠️ #5: HTML Input Value Types

```typescript
// ❌ GREŠKA - boolean not assignable
<input value={value ?? ''} />  // ako value može biti boolean

// ✅ FIX
<input value={typeof value === 'boolean' ? '' : (value ?? '')} />
```

### ⚠️ #6: Emoji/Unicode Encoding

Uvijek koristi pravilne Unicode karaktere:
- ✓ (U+2713) ili ✔ (U+2714) - ne "âœ""
- Spremi fileove kao UTF-8

---

## 13. Events Tracker Specifics

### 13.1 Hijerarhija Podataka

```
User
└── Areas (Health, Fitness, Finance...)
    └── Categories L1
        └── Categories L2-L10
            └── Attribute Definitions
                └── Events
                    └── Event Attributes (EAV)
```

### 13.2 Category Hierarchy Rules

- **Area** → može imati L1 kategorije
- **L1** → uvijek postoji ako Area ima kategorije
- **L2+** → opcionalno, parent_category_id pokazuje na parent
- **Leaf** = kategorija bez djece (može biti bilo koji level)

### 13.3 Progressive Category Selector Flow

```
1. Select Area → Load L1 categories
2. Select L1 → Check if leaf
   - If NOT leaf → Load children (L2)
   - If IS leaf → Enable "Add Activity"
3. Repeat until leaf is reached
4. Only leaf categories allow "Add Activity"
```

### 13.4 FilterContext API

```typescript
const { 
  filter,           // Current filter state
  isLeafCategory,   // Is selected category a leaf?
  fullPathDisplay,  // "Area > L1 > L2 > L3"
  selectArea,       // Select area
  selectCategory,   // Select category with path
  setIsLeafCategory,// Update leaf status
  setFullPathDisplay,// Update path display
  reset,            // Reset all filters
} = useFilter();
```

---

## 14. Test Checklist

### Build & Deploy
- [ ] `npm run typecheck` prolazi ✅
- [ ] `npm run build` prolazi ✅
- [ ] Netlify deploy Published ✅
- [ ] GitHub Actions check zeleni ✅

### Auth
- [ ] Login OK
- [ ] Sign Up → email potvrda
- [ ] Reset Password OK

### Home - Filter
- [ ] Area dropdown: "All Areas" + user areas
- [ ] Category dropdown: "All Categories" kad nema Area
- [ ] Progressive selection: Area → L1 → L2 → ... → Leaf
- [ ] Back button vraća korak unazad
- [ ] Reset button briše sve
- [ ] Full path prikazan u headeru

### Home - Add Activity
- [ ] Button disabled dok nije leaf kategorija
- [ ] Button enabled kad je leaf odabran
- [ ] Navigacija na AddActivityPage s categoryId

### Mobile Responsive
- [ ] Filter collapsible na mobilnom
- [ ] Tabs prikazani s ikonama
- [ ] Add button samo ikona na mobilnom

---

## 15. Troubleshooting Guide

### TypeScript Errors

#### Error: 'X' is declared but its value is never read (TS6133)

```typescript
// UZROK: Nekorišteni import ili varijabla
import { useState, useEffect } from 'react';  // useEffect nije korišten!

// FIX: Ukloni nekorišteni import
import { useState } from 'react';
```

#### Error: Type 'X' is not assignable to type 'Y'

```typescript
// UZROK: Supabase join type inference problem
const { data } = await supabase
  .from('categories')
  .select('id, area:areas(name)');
setCategories(data || []);  // TS Error!

// FIX: Explicit type cast
setCategories((data as unknown as CategoryWithArea[]) || []);
```

### ESLint Errors

#### Error: React Hook useEffect has missing dependencies

```typescript
// UZROK: Dependency nije u array-u
useEffect(() => {
  fetchData(userId);
}, []);  // userId missing!

// FIX: Dodaj dependency
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

### Build Errors

#### Netlify Build Failed - TypeScript Errors

```bash
# UZROK: Vite dev ne pokreće tsc

# FIX: Uvijek prije pusha:
npm run typecheck
npm run build
```

### Runtime Errors

#### Error: useFilter must be used within FilterProvider

```typescript
// UZROK: Komponenta nije wrapped u FilterProvider

// FIX: Wrap u parent
<FilterProvider>
  <YourComponent />
</FilterProvider>
```

#### Error: Cannot read property 'X' of null/undefined

```typescript
// UZROK: Data nije učitana prije rendera

// FIX: Dodaj null check ili loading state
{categories && categories.map(...)}
{isLoading ? <Spinner /> : <Content />}
```

#### Error: Categories se ne učitavaju

1. Provjeri Supabase dashboard → imaš li podatke
2. Provjeri Console → Network tab za failed requests
3. Provjeri RLS policies
4. Provjeri da je user ulogiran

---

*Verzija 5.0 - Kompletna verzija s React Hooks, ESLint, Troubleshooting sekcijama*  
*Bazirano na: Code_Guidelines_React_v4.md + Code_Guidelines_Analysis.md*  
*Datum: 2026-02-09*
