# Code Guidelines - React + Supabase + Netlify

**Verzija:** 4.0  
**Projekt:** Events Tracker  
**Stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3 + Supabase + Netlify  
**Zadnja izmjena:** 2026-02-03

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
9. [Performance](#9-performance)
10. [Build & Deploy (NOVO)](#10-build--deploy)
11. [Poznati Gotchas](#11-poznati-gotchas)
12. [Events Tracker Specifics](#12-events-tracker-specifics)
13. [Test Checklist](#13-test-checklist)

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
│   │   └── filter/          # TreeView, Breadcrumb, UniversalFilter
│   ├── hooks/
│   │   ├── useAreas.ts
│   │   ├── useCategories.ts
│   │   ├── useCategoryChain.ts
│   │   ├── useCategoryPath.ts
│   │   ├── useCategoryTree.ts
│   │   ├── useAttributeDefinitions.ts
│   │   └── useSessionTimer.ts
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── cn.ts
│   │   └── constants.ts
│   ├── pages/
│   │   ├── AuthPage.tsx
│   │   ├── AppHome.tsx
│   │   ├── AddActivityPage.tsx
│   │   └── ResetPasswordPage.tsx
│   ├── types/
│   │   └── database.ts
│   ├── context/
│   │   └── FilterContext.tsx
│   ├── App.tsx
│   └── main.tsx
├── .env.local              # NE COMMITATI!
├── netlify.toml
├── tsconfig.json           # References app + node configs
├── tsconfig.app.json       # Strict: verbatimModuleSyntax, noUnusedLocals
├── tsconfig.node.json      # For vite.config.ts only
└── package.json
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
interface FilterState {
  areaId: string | null;
  categoryId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

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
      try {
        setIsLoading(true);
        // VAŽNO: Single-line select za nested relations!
        let query = supabase
          .from('categories')
          .select('id, name, level, parent_category_id, area_id')
          .order('level')
          .order('sort_order');
        
        if (areaId) {
          query = query.eq('area_id', areaId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        setCategories(data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
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

Supabase TypeScript SDK pokušava parsirati select string s joinovima na compile time. Kompleksni joinovi (npr. `area:areas(...)`) mogu uzrokovati `ParserError` tipove.

```typescript
// ❌ PROBLEM - tsc ne može parsirati complex join
const { data } = await supabase
  .from('categories')
  .select('id, name, area:areas(id, name, icon, color, slug)');
setCategories(data || []);  // TS error: ParserError not assignable to Category[]

// ✅ FIX - explicit type cast
const { data } = await supabase
  .from('categories')
  .select('id, name, area:areas(id, name, icon, color, slug)');
setCategories((data as unknown as CategoryWithArea[]) || []);
```

**Napomena:** Ovo je posebno problem kad je `area` vraćen kao array (Supabase convention za foreign key joins). Uvijek koristi `as unknown as T[]` za complex select stringove s joinovima.

### 6.3 RLS - Row Level Security

```typescript
// ✅ UVIJEK uključi user_id filter
const { data } = await supabase
  .from('events')
  .select('*')
  .eq('user_id', user.id);
```

### 6.4 Template User

```typescript
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// Za prikaz - ISKLJUČI template data
const { data } = await supabase
  .from('areas')
  .select('*')
  .neq('user_id', TEMPLATE_USER_ID);
```

### 6.5 Insert s EAV Pattern

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
  [`value_${attr.type}`]: attr.value  // value_number, value_text, etc.
}));

await supabase
  .from('event_attributes')
  .insert(attributeRecords);
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
<div className={colorClasses[color]}>  // ✅
```

### 7.2 Conditional Classes

```typescript
import { cn } from '@/lib/cn';

<button className={cn(
  'px-4 py-2 rounded',
  isActive && 'bg-blue-500 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

---

## 8. Error Handling

### 8.1 Try-Catch Pattern

```typescript
async function saveEvent(data: EventData) {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    toast.success('Event saved!');
    return { success: true, data: event };
  } catch (err) {
    console.error('Failed to save event:', err);
    toast.error(err instanceof Error ? err.message : 'Unknown error');
    return { success: false, error: err };
  }
}
```

### 8.2 Toast Notifikacije

```typescript
import toast from 'react-hot-toast';

toast.success('✅ Event saved successfully!');
toast.error('❌ Failed to save event');
toast.loading('Saving...');
```

---

## 9. Performance

### 9.1 Memoization

```typescript
const sortedEvents = useMemo(() => {
  return events.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}, [events]);

const handleSave = useCallback(async (data: EventData) => {
  await saveEvent(data);
}, []);
```

### 9.2 Lazy Loading

```typescript
const EventsPage = lazy(() => import('@/pages/EventsPage'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/events" element={<EventsPage />} />
      </Routes>
    </Suspense>
  );
}
```

---

## 10. Build & Deploy

### ⚠️ KRITIČNO: `npm run dev` NE PROVJERAVA TypeScript!

Ovo je **najčešći uzrok Netlify deploy failova**. Vite dev server (`npm run dev`) samo transpilira TypeScript u JavaScript - ne pokreće `tsc` type checker. Zato lokalno sve radi, a Netlify build (`tsc -b && vite build`) pukne.

```
LOKALNO:  npm run dev    → Vite transpiles TS → ✅ radi (0% type checking)
NETLIFY:  npm run build  → tsc -b + vite build → ❌ TypeScript errors!
```

### 10.1 npm Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "check": "npm run typecheck && npm run lint",
    "preview": "vite preview"
  }
}
```

**Workflow prije svakog pusha:**

```bash
# Opcija 1: Brza provjera (samo TypeScript)
npm run typecheck

# Opcija 2: Kompletna provjera (TS + lint)
npm run check

# Opcija 3: Simuliraj Netlify build
npm run build
```

### 10.2 TypeScript Strict Mode - Česte Greške

Naš `tsconfig.app.json` ima striktne opcije koje Vite ignorira:

#### `verbatimModuleSyntax: true`

Type-ovi MORAJU koristiti `import type` ili `type` keyword:

```typescript
// ❌ GREŠKA: 'ReactNode' is a type and must be imported using a type-only import
import { useState, ReactNode } from 'react';

// ✅ ISPRAVNO: Opcija A - inline type keyword
import { useState, type ReactNode } from 'react';

// ✅ ISPRAVNO: Opcija B - odvojeni import
import { useState } from 'react';
import type { ReactNode } from 'react';
```

#### `noUnusedLocals: true`

Nekorištene varijable su greška:

```typescript
// ❌ GREŠKA: 'Category' is declared but never used
import type { Category, CategoryWithArea } from '@/types';

// ✅ FIX: Ukloni nekorišteni import
import type { CategoryWithArea } from '@/types';
```

**⚠️ VAŽNO: `_` prefix - kada RADI i kada NE RADI:**

```typescript
// ═══════════════════════════════════════════════════════════════
// ✅ _ PREFIX RADI ZA:
// ═══════════════════════════════════════════════════════════════

// 1. Destructured props
export function MyComponent({ mode: _mode = 'browse' }: Props) { }

// 2. Destructured hook returns
const { data, error: _error } = useSomeHook();
const { isActive: _isActive, ...rest } = useSessionTimer();

// 3. For...of loop variables
for (const [_key, value] of Object.entries(map)) { }
for (const [_categoryId, attrs] of attributesByCategory) { }

// 4. Function parameters (covered by noUnusedParameters)
const handleClick = (item: Item, _index: number) => { };
array.map((_item, index) => index);

// ═══════════════════════════════════════════════════════════════
// ❌ _ PREFIX NE RADI ZA:
// ═══════════════════════════════════════════════════════════════

// 1. Top-level const/let/var - MORAŠ UKLONITI ILI ZAKOMENTIRATI
const _unusedVariable = 'test';        // ❌ GREŠKA!
let _temporaryValue = 42;              // ❌ GREŠKA!

// 2. Funkcije koje se nikad ne pozivaju - MORAŠ ZAKOMENTIRATI
const _handleFinish = () => { };       // ❌ GREŠKA!
function _helperFunction() { }         // ❌ GREŠKA!

// ✅ FIX za nekorištene funkcije - zakomentiraj:
// const handleFinish = () => {
//   // ... kod koji će trebati kasnije
// };
```

**Pravilo:** Ako `_` prefix ne prolazi typecheck, funkciju/varijablu **zakomentiraj** ili **ukloni**.

#### `noUnusedParameters: true`

Nekorišteni parametri su greška:

```typescript
// ❌ GREŠKA: 'index' is declared but never used
const handleClick = (item: Item, index: number) => { ... };

// ✅ FIX: Prefiksaj s _
const handleClick = (item: Item, _index: number) => { ... };
```

#### HTML Input `value` Type Mismatch

HTML `<input value={}>` prima samo `string | number | readonly string[] | undefined`, ne `boolean`:

```typescript
// ❌ GREŠKA: Type 'boolean' is not assignable to type 'string | number | ...'
interface Props { value: string | number | boolean | null; }
<input value={value ?? ''} />

// ✅ FIX: Filtriraj boolean
<input value={typeof value === 'boolean' ? '' : (value ?? '')} />
```

### 10.3 GitHub Actions CI (Preporučeno)

Datoteka `.github/workflows/typecheck.yml` automatski pokreće `tsc` na svakom pushu na `main`:

```yaml
name: TypeScript Check
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
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

**Benefit:** Vidjet ćeš ❌ ili ✅ na GitHub commitu ODMAH, bez da čekaš Netlify build koji je sporiji.

### 10.4 Netlify Deploy Flow

```
GitHub push → GitHub Actions (typecheck) → Netlify Build → Deploy
                    ↓                           ↓
              ✅ ili ❌ odmah            ✅ Published ili ❌ Failed
              (brže, ~30s)               (sporije, ~30-60s)
```

Ako GitHub Actions ✅ prođe, Netlify build će gotovo sigurno proći (osim ako nedostaju env varijable).

### 10.5 Checklist Prije Pusha

- [ ] `npm run typecheck` prolazi bez grešaka
- [ ] Nema nekorištenih importova ili varijabli
- [ ] Type-only importi koriste `import type` ili `type` keyword
- [ ] HTML input `value` props ne primaju `boolean` direktno
- [ ] Supabase join rezultati su castani s `as unknown as T[]`

---

## 11. Poznati Gotchas

### ⚠️ #1: Vite Dev ≠ Netlify Build (NAJČEŠĆI PROBLEM)

`npm run dev` ne pokreće TypeScript compiler! Uvijek pokreni `npm run typecheck` prije pusha. Vidi sekciju 10.

### ⚠️ #2: Supabase Nested SELECT - Single Line

Već objašnjeno u sekciji 6.1 - KRITIČNO!

### ⚠️ #3: Supabase Join Type Inference

Već objašnjeno u sekciji 6.2 - koristi `as unknown as T[]`.

### ⚠️ #4: React: useEffect Cleanup

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('events')
    .on('postgres_changes', { event: '*', schema: 'public' }, handleChange)
    .subscribe();

  return () => {
    subscription.unsubscribe();  // CLEANUP!
  };
}, []);
```

### ⚠️ #5: React Router: Navigate vs useNavigate

```typescript
// ❌ Ne koristi <Navigate> u event handlerima
const handleClick = () => {
  return <Navigate to="/home" />;  // NE RADI!
};

// ✅ Koristi useNavigate hook
const navigate = useNavigate();
const handleClick = () => {
  navigate('/home');
};
```

### ⚠️ #6: Widget/Input Reset

```typescript
const [resetCounter, setResetCounter] = useState(0);

<input 
  key={`input_${resetCounter}`} 
  defaultValue="" 
/>

// Na reset:
setResetCounter(prev => prev + 1);
```

---

## 12. Events Tracker Specifics

### 12.1 Hijerarhija Podataka

```
User
└── Areas (Health, Fitness, Finance...)
    └── Categories (level 1)
        └── Categories (level 2-10)
            └── Attribute Definitions
                └── Events
                    └── Event Attributes (EAV)
```

### 12.2 Data Types

```typescript
type AttributeDataType = 'number' | 'text' | 'datetime' | 'boolean' | 'link' | 'image';

const valueColumns = {
  number: 'value_number',
  text: 'value_text',
  datetime: 'value_datetime',
  boolean: 'value_boolean',
  link: 'value_text',
  image: 'value_text',
};
```

### 12.3 Filter Pattern (Simple Dropdowns)

```typescript
function AreaDropdown({ value, onChange }) {
  const { areas, isLoading } = useAreas();
  
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">All Areas</option>
      {areas.map(area => (
        <option key={area.id} value={area.id}>{area.name}</option>
      ))}
    </select>
  );
}
```

### 12.4 Parent-Child Grouping

```typescript
// ✅ CORRECT - dictionary-based grouping
function groupEventsBySession(events: Event[]) {
  const groups = new Map<string, Event[]>();
  
  for (const event of events) {
    const key = `${event.event_date}_${event.session_start}_${event.comment}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }
  
  return groups;
}
```

### 12.5 Time Default

```typescript
const DEFAULT_TIME = '09:00';
const sessionStart = `${eventDate}T${time || DEFAULT_TIME}:00`;
```

---

## 13. Test Checklist

### Build & Deploy
- [ ] `npm run typecheck` prolazi ✅
- [ ] `npm run build` prolazi ✅
- [ ] Netlify deploy Published ✅
- [ ] GitHub Actions check zeleni ✅

### Auth
- [ ] Login OK
- [ ] Login fail → error message
- [ ] Sign Up → email potvrda
- [ ] Forgot Password → email
- [ ] Reset Password OK

### Add Activity
- [ ] Area dropdown - samo user-ovi
- [ ] Category dropdown - filtrira po Area
- [ ] Atributi za kategoriju se prikazuju
- [ ] Dependency dropdowns rade
- [ ] Event se sprema
- [ ] Session timer radi

### RLS
- [ ] User A ≠ User B podaci
- [ ] Template data vidljiv (read-only)
- [ ] INSERT odbija tuđi user_id

---

*Verzija 3.0 - Dodana sekcija "Build & Deploy" na temelju Netlify deploy fail-a 2026-01-31*
