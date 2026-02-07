# Events Tracker React - Code Framework & Implementation Guide

**Verzija:** 2.0  
**Datum:** 2026-02-07  
**Status:** ENHANCED WITH ERROR HANDLING & PERFORMANCE OPTIMIZATIONS  
**Referentni dokumenti:**
- Events_Tracker_Wireframes_20260205-1.pptx (s Sasa komentarima)
- Add_Activity_Framework_V5.md
- Events_Tracker_React_Roadmap_V3.md
- Code_Guidelines_React_v4.md
- Code_Framework_20260206.md (V1)

**Changelog V2:**
- ✅ Added Section 3.7: Performance Strategy (Hybrid prefetch/lazy)
- ✅ Added Section 3.8: Caching Layer
- ✅ Added Section 4.7: Error Handling & Edge Cases
- ✅ Added Section 4.8: Optimistic Updates
- ✅ Added Section 4.9: Type Safety Improvements
- ✅ Added Section 5.5: Loading States & Skeleton UI
- ✅ Added Section 9.6: Cache Management Utilities

---

## 📋 SADRŽAJ

1. [Executive Summary](#1-executive-summary)
2. [Arhitektura i Prioriteti](#2-arhitektura-i-prioriteti)
3. [POSTEPENI PROLAZ - Category Selection](#3-postepeni-prolaz---category-selection)
4. [TextOptions & Dependencies System](#4-textoptions--dependencies-system)
5. [Add Activity - Final Layout](#5-add-activity---final-layout)
6. [Edit Activity - Auto-Offset & Validation](#6-edit-activity---auto-offset--validation)
7. [Database Schema Details](#7-database-schema-details)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Technical Reference](#9-technical-reference)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Ključne Odluke

| Aspekt | Odluka | Razlog |
|--------|--------|--------|
| **Category Selection** | POSTEPENI PROLAZ u Home screenu | Rješava problem dugih lanaca kategorija |
| **Filter Location** | Univerzalni filter u Home | Add/Edit primaju LOCKED category |
| **TextOptions Separator** | Pipe `\|` ne comma `,` | Kompatibilnost s Excel strukturom |
| **"Other" Behaviour** | Updatea TextOptions attributa | User ne mora editirati Excel |
| **Add Activity Layout** | Session Log ispod, Parent attrs gore | Per Slide 11 feedback |
| **Edit Activity Time** | Auto-offset + manual edit + validation | Premium UX |
| **Structure Tab** | Lower priority - Streamlit MVP | Fokus na Activities workflow |
| **Performance Strategy** | Hybrid prefetch/lazy loading | Optimalno za male i velike strukture |
| **Error Handling** | Graceful degradation + user feedback | Robusnost sistema |

### 1.2 User Ownership Model

**KRITIČNO:**
```sql
-- SVAKI USER IMA SVOJU STRUKTURU
attribute_definitions (
  user_id uuid  -- ← Vlastite definicije!
)

-- Iznimka: Template user
'00000000-0000-0000-0000-000000000001' = 'system-templates@events-tracker.local'
```

**Implikacije:**
- User A dodavanje "Other" vrijednosti **NE utječe** na User B
- Svaki user gradi svoju strukturu (UI ili Excel import)
- TextOptions je **per-user**, ne global
- Template user je starter pack koji se kopira pri onboardingu

---

## 2. ARHITEKTURA I PRIORITETI

### 2.1 Implementation Phases

```
PHASE 1: HOME + UNIVERZALNI FILTER (3-4 dana)
  └─ 1.1 Header & Settings (2-3h)
  └─ 1.2 Tab Navigation (1-2h)
  └─ 1.3 POSTEPENI PROLAZ Logic (4-5h)
  └─ 1.4 Shortcuts (2-3h)
  └─ 1.5 Date Range & Sort (1-2h)
  └─ 1.6 Filter State Management (2h)
  └─ 1.7 Activities Table (4-5h)
  └─ 1.8 Control Buttons (2-3h)
       ↓
PHASE 2: ADD ACTIVITY (2-3 dana)
  └─ 2.1 Layout Reorganizacija (3-4h)
  └─ 2.2 Button Behaviour Fix (1h)
  └─ 2.3 "Other" → TextOptions Update (2-3h)
  └─ 2.4 Reusable Components (2-3h)
       ↓
PHASE 3: EDIT ACTIVITY (2.5-3 dana)
  └─ 3.1 Basic Edit Form (2-3h)
  └─ 3.2 Pre-populate Data (2h)
  └─ 3.3 Auto-offset Logic (3-4h)
  └─ 3.4 Validation Logic (3-4h)
  └─ 3.5 Parent Attrs Edit (1-2h)
  └─ 3.6 DB Transaction (2h)
```

**Total Effort:** 7.5-10 dana (60-80 sati)

### 2.2 Priority Matrix (iz Wireframe Slide 13)

| Screen | Priority | Status | Start After |
|--------|----------|--------|-------------|
| **Home - Activities** | 🔴 HIGH | ⏳ In Progress | NOW |
| **Add Activity** | 🔴 HIGH | ⏳ In Progress | PHASE 1 Done |
| **Edit Activity** | 🔴 HIGH | ❌ Not Started | PHASE 2 Done |
| Structure (Read) | 🟡 LOW | ❌ Streamlit MVP | Future |
| Structure (Edit) | 🟡 LOW | ❌ Streamlit MVP | Future |

---

## 3. POSTEPENI PROLAZ - CATEGORY SELECTION

### 3.1 Koncept

**Problem:** Dugački lanci kategorija (5-10 nivoa) su nepregledni u jednom dropdownu.

**Rješenje:** Progresivno odabiranje - svaki korak prikazuje samo 1 level dublji.

### 3.2 Flow Example

```
User Selects: Area = "Finance"
  ↓
STEP 1: Category dropdown nudi samo Level 1 & Level 2
  Options: [Domaćinstvo (L1), Putovanja (L1), Porez (L2)]
  ↓
User Selects: "Domaćinstvo" (L1)
  ↓
STEP 2: Category dropdown nudi samo IMMEDIATE CHILDREN
  Options: [Automobili (L2), Režije (L2)]
  ↓
User Selects: "Automobili" (L2)
  ↓
STEP 3: Category dropdown nudi samo IMMEDIATE CHILDREN
  Options: [Registracija (L3), Servis (L3), Gorivo (L3)]
  ↓
User Selects: "Registracija" (L3)
  ↓
CHECK: Is Leaf? (no children) → YES ✓
  ↓
Full Path Generated: "Finance > Domaćinstvo > Automobili > Registracija"
[+ Add Activity] button is now ACTIVE
```

### 3.3 Database Queries

```sql
-- Query 1: Get L1 & L2 for selected Area
SELECT 
  id, name, level, sort_order, parent_category_id
FROM categories
WHERE area_id = $area_id 
  AND user_id = $user_id
  AND level IN (1, 2)
ORDER BY level ASC, sort_order ASC;

-- Query 2: Get immediate children of selected category
SELECT 
  id, name, level, sort_order, parent_category_id
FROM categories
WHERE parent_category_id = $selected_category_id
  AND user_id = $user_id
ORDER BY sort_order ASC;

-- Query 3: Check if category is leaf
SELECT COUNT(*) as child_count
FROM categories
WHERE parent_category_id = $category_id
  AND user_id = $user_id;
-- If child_count = 0 → LEAF
```

### 3.4 State Management

```typescript
interface ProgressiveCategoryState {
  selectedArea: Area | null;
  
  // Step tracking
  currentStep: number;  // 1, 2, 3...
  categoryPath: Category[];  // [L1, L2, L3...]
  
  // Current step options
  availableCategories: Category[];
  selectedCategory: Category | null;
  
  // Final state
  isLeafSelected: boolean;
  fullPathString: string;  // "Finance > Domaćinstvo > Automobili > Registracija"
}

// Actions
function selectArea(area: Area) {
  // Reset path, load L1 & L2
}

function selectCategory(category: Category) {
  // Add to path, check if leaf, load next level if needed
}

function resetSelection() {
  // Clear all, go back to area selection
}
```

### 3.5 UI Components

```typescript
// components/ProgressiveCategorySelector.tsx
export function ProgressiveCategorySelector() {
  const [state, dispatch] = useProgressiveSelection();
  
  return (
    <div className="progressive-selector">
      <AreaDropdown 
        value={state.selectedArea}
        onChange={area => dispatch(selectArea(area))}
      />
      
      {state.selectedArea && (
        <CategoryStepDropdown
          step={state.currentStep}
          options={state.availableCategories}
          value={state.selectedCategory}
          onChange={category => dispatch(selectCategory(category))}
          placeholder={`Select ${state.currentStep === 1 ? 'category' : 'subcategory'}`}
        />
      )}
      
      {state.fullPathString && (
        <div className="path-display">
          📁 {state.fullPathString}
        </div>
      )}
      
      <button 
        disabled={!state.isLeafSelected}
        onClick={handleAddActivity}
      >
        + Add Activity
      </button>
    </div>
  );
}
```

### 3.6 Validation Rules

```typescript
// Before navigating to Add Activity
function validateCategorySelection(): boolean {
  if (!selectedCategory) {
    toast.error("Prvo odaberi kategoriju");
    return false;
  }
  
  if (!isLeaf(selectedCategory.id)) {
    toast.error("Odaberi kategoriju do kraja (leaf kategoriju)");
    // Opciono: prikaži dostupne leaf kategorije
    return false;
  }
  
  return true;
}
```

### 3.7 Performance Strategy - Hybrid Prefetch/Lazy Loading

**Problem:** Za duboke hijerarhije (10 levels), svaki korak radi novi query = 10+ roundtrip-ova.

**Rješenje:** Hybrid strategija bazirana na veličini strukture.

```typescript
// Configuration
const PREFETCH_THRESHOLD = 100; // Ako Area ima <100 kategorija → prefetch ALL
const CACHE_TTL = 5 * 60 * 1000; // 5 minuta

// Decision Logic
async function loadCategoriesForArea(areaId: string): Promise<CategoryData> {
  // Prvo provjeri COUNT
  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('area_id', areaId)
    .eq('user_id', userId);
  
  if (count && count < PREFETCH_THRESHOLD) {
    console.log(`Prefetching ${count} categories for area ${areaId}`);
    return prefetchAllCategories(areaId);
  } else {
    console.log(`Using lazy load for area ${areaId} (${count} categories)`);
    return lazyLoadCategories(areaId);
  }
}

// PREFETCH: Load all categories at once
async function prefetchAllCategories(areaId: string): Promise<CategoryData> {
  const { data: allCategories, error } = await supabase
    .from('categories')
    .select('id, name, level, sort_order, parent_category_id, slug')
    .eq('area_id', areaId)
    .eq('user_id', userId)
    .order('level', { ascending: true })
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  
  // Build tree client-side for O(1) lookups
  const tree = buildCategoryTree(allCategories);
  const childrenMap = buildChildrenMap(allCategories);
  const lookup = new Map(allCategories.map(c => [c.id, c]));
  
  return {
    mode: 'prefetched',
    tree,
    lookup,
    childrenMap,
    allCategories
  };
}

// LAZY LOAD: Load level by level (existing approach)
async function lazyLoadCategories(areaId: string): Promise<CategoryData> {
  return {
    mode: 'lazy',
    areaId
  };
}

// Helper: Build children map for O(1) lookup
function buildChildrenMap(categories: Category[]): Map<string, Category[]> {
  const map = new Map<string, Category[]>();
  
  categories.forEach(cat => {
    const parentId = cat.parent_category_id || 'root';
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId)!.push(cat);
  });
  
  return map;
}

// Helper: Build full category tree
function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const lookup = new Map(categories.map(c => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  
  categories.forEach(cat => {
    const node = lookup.get(cat.id)!;
    if (cat.parent_category_id) {
      const parent = lookup.get(cat.parent_category_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}

// Usage in component
function getChildrenForCategory(categoryId: string): Category[] {
  if (categoryData.mode === 'prefetched') {
    // O(1) lookup from cache
    return categoryData.childrenMap.get(categoryId) || [];
  } else {
    // Lazy load from database
    return fetchChildrenFromDB(categoryId);
  }
}

function isLeafCategory(categoryId: string): boolean {
  if (categoryData.mode === 'prefetched') {
    const children = categoryData.childrenMap.get(categoryId);
    return !children || children.length === 0;
  } else {
    return checkIsLeafFromDB(categoryId);
  }
}
```

### 3.8 Caching Layer

```typescript
// Cache manager for categories
interface CategoryCache {
  areaId: string;
  timestamp: number;
  data: CategoryData;
}

const categoryCache = new Map<string, CategoryCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuta

// Get categories with caching
async function getCategoriesForArea(areaId: string): Promise<CategoryData> {
  const cached = categoryCache.get(areaId);
  
  // Return cached if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ Using cached categories for', areaId);
    return cached.data;
  }
  
  // Load fresh data
  console.log('🔄 Loading fresh categories for', areaId);
  const freshData = await loadCategoriesForArea(areaId);
  
  // Cache it
  categoryCache.set(areaId, {
    areaId,
    timestamp: Date.now(),
    data: freshData
  });
  
  return freshData;
}

// Invalidate cache after structure changes
function invalidateCategoryCache(areaId?: string) {
  if (areaId) {
    categoryCache.delete(areaId);
    console.log('🗑️ Cache invalidated for area:', areaId);
  } else {
    categoryCache.clear();
    console.log('🗑️ All category cache cleared');
  }
}

// Preload cache for all areas (optional, on app init)
async function preloadAllAreaCategories() {
  const { data: areas } = await supabase
    .from('areas')
    .select('id')
    .eq('user_id', userId);
  
  if (areas) {
    await Promise.all(
      areas.map(area => getCategoriesForArea(area.id))
    );
    console.log('✅ Preloaded categories for all areas');
  }
}

// React Hook for categories with cache
function useCategoriesForArea(areaId: string | null) {
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!areaId) {
      setCategoryData(null);
      return;
    }
    
    setIsLoading(true);
    getCategoriesForArea(areaId)
      .then(data => {
        setCategoryData(data);
        setError(null);
      })
      .catch(err => {
        setError(err);
        setCategoryData(null);
      })
      .finally(() => setIsLoading(false));
  }, [areaId]);
  
  return { categoryData, isLoading, error, invalidateCache: invalidateCategoryCache };
}
```

---

## 4. TEXTOPTIONS & DEPENDENCIES SYSTEM

### 4.1 Separator Format

**KRITIČNO:** TextOptions koristi **PIPE `|`** ne **COMMA `,`**

```
❌ KRIVO: "biceps,triceps,shoulders"
✅ TOČNO: "biceps|triceps|shoulders"
```

**Razlog:** Kompatibilnost s Excel strukturom koja user uploada.

### 4.2 Simple TextOptions (bez dependencies)

```typescript
// attribute_definitions.validation_rules
{
  "data_type": "text",
  "text_options": "Small|Medium|Large|XL"
}

// Parse u array:
const options = validationRules.text_options.split('|');
// → ["Small", "Medium", "Large", "XL"]
```

### 4.3 Conditional TextOptions (s dependencies)

**Excel Format:**
```
Area    | Category | Attribute      | TextOptions                          | DependsOn     | WhenValue
--------|----------|----------------|--------------------------------------|---------------|----------
Fitness | Gym      | strength_type  | Upper|Lower|Full Body                |               |
Fitness | Gym      | exercise_name  | pull.m|biceps|triceps|rame|z.sklek   | strength_type | Upper
Fitness | Gym      | exercise_name  | squats|deadlifts|leg.press           | strength_type | Lower
Fitness | Gym      | exercise_name  | burpees|clean.jerk                   | strength_type | Full Body
```

**Database Storage:**
```json
// Parent Attribute: strength_type
{
  "data_type": "text",
  "text_options": "Upper|Lower|Full Body"
}

// Child Attribute: exercise_name
{
  "data_type": "text",
  "text_options_conditional": {
    "Upper": "pull.m|biceps|triceps|rame|z.sklek",
    "Lower": "squats|deadlifts|leg.press",
    "Full Body": "burpees|clean.jerk"
  },
  "depends_on": {
    "attribute_slug": "strength_type"
  }
}
```

### 4.4 "Other" Option Behaviour

**Kada user upiše custom vrijednost koja nije u listi:**

```typescript
// STARA LOGIKA (Streamlit):
// 1. Prihvati custom vrijednost
// 2. Spremi u DB
// 3. User mora ručno editirati Excel i re-importirati

// NOVA LOGIKA (React):
// 1. Prihvati custom vrijednost
// 2. AUTO-UPDATE TextOptions u attribute_definition
// 3. User NE MORA editirati Excel
```

**Implementation:**

```typescript
async function handleCustomTextValue(
  attributeDefId: string,
  customValue: string,
  currentOptions: string
): Promise<void> {
  // 1. Check if value already exists
  const optionsArray = currentOptions.split('|');
  if (optionsArray.includes(customValue)) {
    // Already exists, just use it
    return;
  }
  
  // 2. Update validation_rules.text_options
  const updatedOptions = [...optionsArray, customValue].join('|');
  
  const { error } = await supabase
    .from('attribute_definitions')
    .update({
      validation_rules: {
        text_options: updatedOptions
      }
    })
    .eq('id', attributeDefId);
  
  if (error) throw error;
  
  // 3. Toast success
  toast.success(`"${customValue}" added to options`);
}
```

### 4.5 React Component Pattern

```typescript
// components/AttributeInput.tsx
export function AttributeInput({ attribute, value, onChange }) {
  const hasTextOptions = !!attribute.validation_rules.text_options;
  const hasConditionalOptions = !!attribute.validation_rules.text_options_conditional;
  
  if (hasConditionalOptions) {
    // Dependency-based dropdown
    const parentValue = getDependencyValue(attribute.validation_rules.depends_on.attribute_slug);
    const options = getConditionalOptions(attribute.validation_rules, parentValue);
    
    return (
      <ComboboxWithOther
        options={options}
        value={value}
        onChange={onChange}
        onOtherSubmit={val => handleCustomTextValue(attribute.id, val, options.join('|'))}
      />
    );
  }
  
  if (hasTextOptions) {
    // Simple dropdown with "Other"
    const options = attribute.validation_rules.text_options.split('|');
    
    return (
      <ComboboxWithOther
        options={options}
        value={value}
        onChange={onChange}
        onOtherSubmit={val => handleCustomTextValue(attribute.id, val, attribute.validation_rules.text_options)}
      />
    );
  }
  
  // Regular text input
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} />;
}
```

### 4.6 Dependency Resolution Logic

```typescript
// When parent value changes, child dropdowns update
function handleParentChange(parentSlug: string, newValue: string) {
  // 1. Find all child attributes that depend on this parent
  const childAttributes = attributeDefinitions.filter(
    attr => attr.validation_rules.depends_on?.attribute_slug === parentSlug
  );
  
  // 2. Update dependency value in state
  setDependencyValue(parentSlug, newValue);
  
  // 3. Each child will re-render with new options via getConditionalOptions()
}

// Get options based on current parent value
function getConditionalOptions(
  validationRules: ValidationRules,
  parentValue: string | undefined
): string[] {
  if (!validationRules.text_options_conditional || !parentValue) {
    return [];
  }
  
  const optionsString = validationRules.text_options_conditional[parentValue];
  return optionsString ? optionsString.split('|') : [];
}
```

### 4.7 Error Handling & Edge Cases

```typescript
// 1. Parent Value Doesn't Exist in Conditional
function getOptionsForParentValue(
  validationRules: ValidationRules,
  parentValue: string
): string[] {
  const conditional = validationRules.text_options_conditional;
  
  if (!conditional || !conditional[parentValue]) {
    console.warn(`No options defined for parent value: "${parentValue}"`);
    
    // DECISION: Return empty array (user can type custom value)
    return [];
    
    // ALT: Fallback to simple text_options if exists
    // return validationRules.text_options 
    //   ? parseTextOptions(validationRules.text_options) 
    //   : [];
  }
  
  return conditional[parentValue].split('|').filter(Boolean);
}

// 2. Parent Value Changed → Reset Children
function handleParentChange(parentSlug: string, newValue: string) {
  const childAttributes = getChildAttributes(parentSlug);
  
  if (childAttributes.length > 0) {
    // OPTIONAL: Confirm before resetting
    const confirmReset = window.confirm(
      `Changing this will reset ${childAttributes.length} dependent field(s). Continue?`
    );
    
    if (!confirmReset) {
      return; // User cancelled
    }
  }
  
  // Clear child values
  childAttributes.forEach(child => {
    setAttributeValue(child.slug, null);
  });
  
  setDependencyValue(parentSlug, newValue);
}

// 3. "Other" Database Update Failure
async function handleOtherValueSubmit(
  attributeDefId: string,
  newOption: string
): Promise<boolean> {
  try {
    const { data: currentDef } = await supabase
      .from('attribute_definitions')
      .select('validation_rules')
      .eq('id', attributeDefId)
      .single();
    
    if (!currentDef) throw new Error('Attribute definition not found');
    
    const updatedRules = {
      ...currentDef.validation_rules,
      text_options: addTextOption(
        currentDef.validation_rules.text_options,
        newOption
      )
    };
    
    const { error } = await supabase
      .from('attribute_definitions')
      .update({ validation_rules: updatedRules })
      .eq('id', attributeDefId);
    
    if (error) throw error;
    
    // SUCCESS: Refresh local attribute definitions
    await refreshAttributeDefinitions();
    toast.success(`Added "${newOption}" to options`);
    return true;
    
  } catch (error) {
    console.error('Failed to update TextOptions:', error);
    
    // FALLBACK: Spremi vrijednost ali NE updatiraj definiciju
    toast.error('Could not update options list, but value was saved');
    return false;
  }
}

// 4. Conditional Options - Empty String Parent Value
function getConditionalOptions(
  validationRules: ValidationRules,
  parentValue: string | undefined | null
): string[] {
  // Edge case: parent je "" (empty string) što je validna vrijednost
  if (parentValue === undefined || parentValue === null) {
    return [];
  }
  
  if (!validationRules.text_options_conditional) {
    return [];
  }
  
  // Provjera postoji li key za parentValue (uključujući "")
  const optionsString = validationRules.text_options_conditional[parentValue];
  
  if (!optionsString) {
    console.warn(`No conditional options for parent: "${parentValue}"`);
    return [];
  }
  
  return parseTextOptions(optionsString);
}

// 5. Circular Dependencies Detection (Advanced)
function detectCircularDependency(
  attributeDefs: AttributeDefinition[]
): string | null {
  const graph = new Map<string, string[]>();
  
  // Build dependency graph
  attributeDefs.forEach(attr => {
    const dependsOn = attr.validation_rules.depends_on?.attribute_slug;
    if (dependsOn) {
      if (!graph.has(attr.slug)) {
        graph.set(attr.slug, []);
      }
      graph.get(attr.slug)!.push(dependsOn);
    }
  });
  
  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        return `Circular dependency detected involving: ${node}`;
      }
    }
  }
  
  return null; // No cycles
}

// 6. Missing Attribute Definition
function validateDependency(
  childAttr: AttributeDefinition,
  allAttributes: AttributeDefinition[]
): string | null {
  const dependsOnSlug = childAttr.validation_rules.depends_on?.attribute_slug;
  
  if (!dependsOnSlug) return null;
  
  const parentExists = allAttributes.find(a => a.slug === dependsOnSlug);
  
  if (!parentExists) {
    return `Dependency broken: "${dependsOnSlug}" not found for attribute "${childAttr.slug}"`;
  }
  
  return null;
}
```

### 4.8 Optimistic Updates

**Problem:** "Other" value mora čekati DB update prije nego se prikaže u dropdown-u.

**Rješenje:** Optimistic UI update s rollback ako fajla.

```typescript
// Optimistic update pattern
async function handleOtherValue(
  attr: AttributeDefinition,
  customValue: string
) {
  // 1. OPTIMISTIC: Update local state immediately
  const currentOptions = parseTextOptions(attr.validation_rules.text_options);
  const optimisticOptions = [...currentOptions, customValue];
  
  updateLocalAttributeOptions(attr.id, optimisticOptions);
  
  try {
    // 2. BACKGROUND: Update database
    await updateTextOptionsInDB(attr.id, customValue);
    
    toast.success(`"${customValue}" added to options`);
    
  } catch (error) {
    // 3. ROLLBACK: Restore previous state
    updateLocalAttributeOptions(attr.id, currentOptions);
    
    toast.error('Failed to save option. Please try again.');
    console.error('TextOptions update failed:', error);
  }
}

// Local state management
function updateLocalAttributeOptions(
  attributeId: string,
  newOptions: string[]
) {
  setAttributeDefinitions(prev =>
    prev.map(attr =>
      attr.id === attributeId
        ? {
            ...attr,
            validation_rules: {
              ...attr.validation_rules,
              text_options: newOptions.join('|')
            }
          }
        : attr
    )
  );
}

// Alternative: Use React Query for automatic optimistic updates
const updateTextOptionsMutation = useMutation({
  mutationFn: (params: { attrId: string; newValue: string }) =>
    updateTextOptionsInDB(params.attrId, params.newValue),
  
  onMutate: async ({ attrId, newValue }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['attributes'] });
    
    // Snapshot previous value
    const previousAttributes = queryClient.getQueryData(['attributes']);
    
    // Optimistic update
    queryClient.setQueryData(['attributes'], (old: AttributeDefinition[]) =>
      old.map(attr =>
        attr.id === attrId
          ? {
              ...attr,
              validation_rules: {
                ...attr.validation_rules,
                text_options: addTextOption(attr.validation_rules.text_options, newValue)
              }
            }
          : attr
      )
    );
    
    return { previousAttributes };
  },
  
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['attributes'], context?.previousAttributes);
    toast.error('Failed to update options');
  },
  
  onSuccess: () => {
    toast.success('Option added successfully');
  }
});
```

### 4.9 Type Safety Improvements

**Problem:** Trenutni `ValidationRules` je previše permisivan - može imati `text_options_conditional` bez `depends_on`.

**Rješenje:** Discriminated union types za različite scenarije.

```typescript
// Existing (too permissive)
interface ValidationRules {
  text_options?: string;
  text_options_conditional?: Record<string, string>;
  depends_on?: { attribute_slug: string };
}

// Improved: Discriminated Union
type SimpleTextOptions = {
  text_options: string;
  text_options_conditional?: never;
  depends_on?: never;
};

type ConditionalTextOptions = {
  text_options?: never;
  text_options_conditional: Record<string, string>;
  depends_on: { attribute_slug: string };
};

type NumericValidation = {
  text_options?: never;
  text_options_conditional?: never;
  depends_on?: never;
  min_value?: number;
  max_value?: number;
};

type ValidationRules =
  | SimpleTextOptions
  | ConditionalTextOptions
  | NumericValidation
  | {}; // No validation

// Type guards
function hasSimpleTextOptions(rules: ValidationRules): rules is SimpleTextOptions {
  return 'text_options' in rules && !!rules.text_options;
}

function hasConditionalTextOptions(rules: ValidationRules): rules is ConditionalTextOptions {
  return 'text_options_conditional' in rules && !!rules.text_options_conditional;
}

// Usage with type safety
function getOptionsForAttribute(attr: AttributeDefinition): string[] {
  const rules = attr.validation_rules;
  
  if (hasSimpleTextOptions(rules)) {
    // TypeScript KNOWS: rules.text_options exists
    // TypeScript KNOWS: rules.depends_on does NOT exist
    return parseTextOptions(rules.text_options);
  }
  
  if (hasConditionalTextOptions(rules)) {
    // TypeScript KNOWS: rules.text_options_conditional exists
    // TypeScript KNOWS: rules.depends_on exists (required!)
    const parentValue = getDependencyValue(rules.depends_on.attribute_slug);
    return getConditionalOptions(rules, parentValue);
  }
  
  return [];
}

// Enhanced AttributeDefinition with stricter typing
interface AttributeDefinition<T extends ValidationRules = ValidationRules> {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  slug: string;
  data_type: 'text' | 'number' | 'datetime' | 'boolean' | 'link' | 'image';
  unit?: string;
  is_required: boolean;
  default_value?: string;
  validation_rules: T;
  sort_order: number;
  description?: string;
}

// Specific attribute types
type SimpleTextAttribute = AttributeDefinition<SimpleTextOptions>;
type ConditionalTextAttribute = AttributeDefinition<ConditionalTextOptions>;
type NumericAttribute = AttributeDefinition<NumericValidation>;
```

---

## 5. ADD ACTIVITY - FINAL LAYOUT

### 5.1 Screen Structure (per Wireframe Slide 11)

```
┌────────────────────────────────────┐
│ ← Back   Fitness > Gym > Strength  │ ← Category locked from filter
├────────────────────────────────────┤
│                                    │
│ PARENT CATEGORY ATTRIBUTES (if >0) │
│ • Attribute 1                      │
│ • Attribute 2                      │
│                                    │
├────────────────────────────────────┤
│                                    │
│ LEAF CATEGORY ATTRIBUTES           │
│ • Date          [2024-02-07]       │
│ • Time          [14:30]            │
│ • Attribute 3                      │
│ • Attribute 4                      │
│                                    │
├────────────────────────────────────┤
│                                    │
│ EVENT NOTE                         │
│ [Text area...]                     │
│                                    │
├────────────────────────────────────┤
│                                    │
│ PHOTO                              │
│ [📷 Camera | 🖼️ Gallery]          │
│                                    │
├────────────────────────────────────┤
│                                    │
│ SESSION LOG                        │
│ ┌──────────────────────────────┐  │
│ │ Timer: 00:45:23              │  │
│ │ Events: 3                    │  │
│ └──────────────────────────────┘  │
│                                    │
├────────────────────────────────────┤
│                                    │
│ [✕ Cancel]         [✓ Finish]      │ ← UVIJEK dostupni
│                                    │
│ [💾 Save+]                         │ ← Dodaje event, resetira Note
│                                    │
└────────────────────────────────────┘
```

### 5.2 Layout Rules

```typescript
// Render logic
function AddActivityForm({ selectedCategory }) {
  // 1. Get ALL categories in path (L1, L2, L3...)
  const categoryPath = getCategoryPath(selectedCategory.id);
  
  // 2. Fetch attribute definitions for EACH category in path
  const allAttributes = await Promise.all(
    categoryPath.map(cat => getAttributeDefinitions(cat.id))
  );
  
  // 3. Group by category level
  const parentAttributes = allAttributes.slice(0, -1).flat();
  const leafAttributes = allAttributes[allAttributes.length - 1];
  
  // 4. Filter out parent categories with 0 attributes
  const parentCategoriesWithAttrs = parentAttributes.filter(
    attrs => attrs.length > 0
  );
  
  return (
    <form>
      {/* Title */}
      <h1>Fitness > Gym > Strength</h1>
      
      {/* Parent Category Attrs (only if > 0) */}
      {parentCategoriesWithAttrs.length > 0 && (
        <section className="parent-attrs">
          <h2>Gym Attributes</h2>
          {parentCategoriesWithAttrs.map(renderAttribute)}
        </section>
      )}
      
      {/* Leaf Category Attrs */}
      <section className="leaf-attrs">
        <h2>Strength Attributes</h2>
        <DateInput />
        <TimeInput />
        {leafAttributes.map(renderAttribute)}
      </section>
      
      {/* Event Note */}
      <section className="event-note">
        <label>Note</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} />
      </section>
      
      {/* Photo */}
      <section className="photo">
        <button onClick={openCamera}>📷 Camera</button>
        <button onClick={openGallery}>🖼️ Gallery</button>
      </section>
      
      {/* Session Log (collapsed by default) */}
      <section className="session-log">
        <SessionLogWidget events={sessionEvents} />
      </section>
      
      {/* Buttons - ALWAYS ENABLED */}
      <div className="actions">
        <button onClick={handleCancel}>✕ Cancel</button>
        <button onClick={handleFinish}>✓ Finish</button>
        <button onClick={handleSavePlus}>💾 Save+</button>
      </div>
    </form>
  );
}
```

### 5.3 Button Behaviour

```typescript
// ✓ Finish - UVIJEK aktivan (bez validacije)
async function handleFinish() {
  // 1. Collect all data
  const activityData = collectFormData();
  
  // 2. Save to DB
  await saveActivity(activityData);
  
  // 3. Navigate back to Home
  router.push('/home');
}

// 💾 Save+ - Dodaje event u session, RESETS Note
async function handleSavePlus() {
  // 1. Collect current state
  const eventData = {
    timestamp: new Date(),
    note: currentNote,
    attributes: collectCurrentAttributes()
  };
  
  // 2. Add to session log
  addEventToSession(eventData);
  
  // 3. RESET Event Note (ostali fieldi ostaju)
  setNote('');
  
  // 4. Show feedback
  toast.success('Event added to session');
}

// ✕ Cancel
function handleCancel() {
  const hasData = checkIfFormHasData();
  
  if (hasData) {
    const confirm = window.confirm('Discard unsaved changes?');
    if (!confirm) return;
  }
  
  router.push('/home');
}
```

### 5.4 Session Log Widget

```typescript
interface SessionEvent {
  id: string;
  timestamp: Date;
  note?: string;
  attributes: Record<string, any>;
}

function SessionLogWidget({ events }: { events: SessionEvent[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalDuration = calculateDuration(events);
  
  return (
    <div className="session-log">
      <button onClick={() => setIsExpanded(!isExpanded)}>
        Session Log ({events.length} events) - {formatDuration(totalDuration)}
        {isExpanded ? '▼' : '▶'}
      </button>
      
      {isExpanded && (
        <ul>
          {events.map(event => (
            <li key={event.id}>
              <time>{formatTime(event.timestamp)}</time>
              {event.note && <p>{event.note}</p>}
              <button onClick={() => removeEvent(event.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 5.5 Loading States & Skeleton UI

```typescript
// Loading skeleton while fetching attribute definitions
function AddActivitySkeleton() {
  return (
    <div className="add-activity-skeleton">
      <div className="skeleton-header h-8 w-3/4 mb-4" />
      
      {/* Parent attrs skeleton */}
      <div className="skeleton-section mb-6">
        <div className="skeleton-label h-4 w-1/3 mb-2" />
        <div className="skeleton-input h-10 w-full mb-3" />
        <div className="skeleton-input h-10 w-full mb-3" />
      </div>
      
      {/* Leaf attrs skeleton */}
      <div className="skeleton-section mb-6">
        <div className="skeleton-label h-4 w-1/3 mb-2" />
        <div className="skeleton-input h-10 w-full mb-3" />
        <div className="skeleton-input h-10 w-full mb-3" />
        <div className="skeleton-input h-10 w-full mb-3" />
      </div>
      
      {/* Note skeleton */}
      <div className="skeleton-section mb-6">
        <div className="skeleton-label h-4 w-1/4 mb-2" />
        <div className="skeleton-textarea h-24 w-full" />
      </div>
    </div>
  );
}

// Main component with loading state
function AddActivityForm({ selectedCategory }) {
  const [isLoading, setIsLoading] = useState(true);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  
  useEffect(() => {
    async function loadAttributes() {
      setIsLoading(true);
      
      try {
        const categoryPath = await getCategoryPath(selectedCategory.id);
        const allAttrs = await Promise.all(
          categoryPath.map(cat => getAttributeDefinitions(cat.id))
        );
        
        setAttributeDefinitions(allAttrs.flat());
      } catch (error) {
        toast.error('Failed to load form');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAttributes();
  }, [selectedCategory.id]);
  
  if (isLoading) {
    return <AddActivitySkeleton />;
  }
  
  return <ActualForm attributeDefinitions={attributeDefinitions} />;
}

// Progressive rendering for large forms
function AddActivityForm({ attributeDefinitions }) {
  const [renderProgress, setRenderProgress] = useState(10); // Render first 10 attrs
  
  useEffect(() => {
    // Progressive rendering for forms with many attributes
    if (renderProgress < attributeDefinitions.length) {
      const timer = setTimeout(() => {
        setRenderProgress(prev => Math.min(prev + 10, attributeDefinitions.length));
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [renderProgress, attributeDefinitions.length]);
  
  const visibleAttributes = attributeDefinitions.slice(0, renderProgress);
  
  return (
    <form>
      {visibleAttributes.map(attr => (
        <AttributeInput key={attr.id} attribute={attr} />
      ))}
      
      {renderProgress < attributeDefinitions.length && (
        <div className="loading-more">Loading more fields...</div>
      )}
    </form>
  );
}

// Optimistic state for dropdown dependencies
function DependentDropdown({ attribute, parentValue }) {
  const [options, setOptions] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  
  useEffect(() => {
    if (!parentValue) {
      setOptions([]);
      return;
    }
    
    setIsLoadingOptions(true);
    
    // Fetch or compute options based on parent value
    const newOptions = getConditionalOptions(
      attribute.validation_rules,
      parentValue
    );
    
    // Simulate async if needed (e.g., DB lookup for complex conditionals)
    setTimeout(() => {
      setOptions(newOptions);
      setIsLoadingOptions(false);
    }, 100);
  }, [parentValue, attribute]);
  
  if (isLoadingOptions) {
    return <div className="skeleton-input h-10 w-full animate-pulse" />;
  }
  
  return (
    <Combobox
      options={options}
      placeholder="Select option..."
      disabled={options.length === 0}
    />
  );
}
```

---

## 6. EDIT ACTIVITY - AUTO-OFFSET & VALIDATION

### 6.1 Problem Statement

**Scenario:** Activity s više logged event-ova ima specifičan timing:

```
Activity Started: 14:00
  Event 1 logged at: 14:05 (offset +5 min)
  Event 2 logged at: 14:12 (offset +12 min)
  Event 3 logged at: 14:20 (offset +20 min)
```

**User edita:** "Zapravo sam počeo u 13:30, ne 14:00"

**Expected Behaviour:**
```
New Activity Start: 13:30
  Event 1 → 13:35 (auto-offset +5 min)
  Event 2 → 13:42 (auto-offset +12 min)
  Event 3 → 13:50 (auto-offset +20 min)
```

### 6.2 Edit Activity Flow

```
1. User selects activity from Activities table
   ↓
2. Navigate to Edit Activity screen
   ↓
3. Form pre-populated with:
   - Locked category (path shown, cannot change)
   - All attributes from PARENT categories (if any)
   - All attributes from LEAF category
   - Event note
   - Photo (if any)
   - Session events (if any)
   ↓
4. User edits session_start time
   ↓
5. AUTOMATIC: All child event times offset by same amount
   ↓
6. User can MANUALLY edit individual event times
   ↓
7. VALIDATION: Check time ordering before save
   ↓
8. Save to DB (transaction)
```

### 6.3 Auto-Offset Logic

```typescript
import { differenceInMinutes, addMinutes } from 'date-fns';

interface EditActivityState {
  originalActivityStart: Date;
  newActivityStart: Date;
  originalEvents: ChildEvent[];
  editedEvents: ChildEvent[];
}

interface ChildEvent {
  id: string;
  session_start: Date;
  note?: string;
  // ... other fields
}

// Calculate offset when activity start time changes
function handleActivityStartChange(newStartTime: Date) {
  const oldStart = state.originalActivityStart;
  const offset = differenceInMinutes(newStartTime, oldStart);
  
  if (offset === 0) return; // No change
  
  // Auto-offset all child events
  const updatedEvents = state.originalEvents.map(event => ({
    ...event,
    session_start: addMinutes(event.session_start, offset),
    autoOffsetApplied: true  // Flag to show in UI
  }));
  
  setState({
    ...state,
    newActivityStart: newStartTime,
    editedEvents: updatedEvents
  });
  
  toast.info(`All event times adjusted by ${offset} minutes`);
}

// Manual edit of individual event time
function handleEventTimeManualEdit(eventId: string, newTime: Date) {
  const updatedEvents = state.editedEvents.map(event =>
    event.id === eventId
      ? { ...event, session_start: newTime, manuallyEdited: true }
      : event
  );
  
  setState({
    ...state,
    editedEvents: updatedEvents
  });
}
```

### 6.4 Validation Rules

```typescript
import { isAfter } from 'date-fns';

interface TimeValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// Validate event times before save
function validateEventTimes(
  activityStart: Date,
  childEvents: ChildEvent[]
): TimeValidationError[] {
  const errors: TimeValidationError[] = [];
  
  // Rule 1: All child events MUST be AFTER activity start
  childEvents.forEach((event, idx) => {
    if (!isAfter(event.session_start, activityStart)) {
      errors.push({
        field: `event_${event.id}`,
        message: `Event ${idx + 1} time must be after Activity start time`,
        severity: 'error'
      });
    }
  });
  
  // Rule 2: Events must be in chronological order
  for (let i = 1; i < childEvents.length; i++) {
    const currentEvent = childEvents[i];
    const previousEvent = childEvents[i - 1];
    
    if (!isAfter(currentEvent.session_start, previousEvent.session_start)) {
      errors.push({
        field: `event_${currentEvent.id}`,
        message: `Event ${i + 1} must be after Event ${i}`,
        severity: 'error'
      });
    }
  }
  
  return errors;
}

// Pre-save validation
async function handleSave() {
  const errors = validateEventTimes(
    state.newActivityStart,
    state.editedEvents
  );
  
  if (errors.length > 0) {
    // Show errors
    errors.forEach(err => {
      toast.error(err.message);
    });
    
    // Highlight problematic fields
    setFieldErrors(errors);
    
    return; // Block save
  }
  
  // Proceed with save
  await saveActivityEdits();
}
```

### 6.5 UI Components

```typescript
// Edit Activity Form
function EditActivityForm({ activityId }: { activityId: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [originalStart, setOriginalStart] = useState<Date | null>(null);
  const [editedStart, setEditedStart] = useState<Date | null>(null);
  const [childEvents, setChildEvents] = useState<ChildEvent[]>([]);
  const [validationErrors, setValidationErrors] = useState<TimeValidationError[]>([]);
  
  useEffect(() => {
    async function loadActivity() {
      const data = await fetchActivityWithEvents(activityId);
      
      setActivity(data.activity);
      setOriginalStart(new Date(data.activity.session_start));
      setEditedStart(new Date(data.activity.session_start));
      setChildEvents(data.events.map(e => ({
        ...e,
        session_start: new Date(e.session_start)
      })));
    }
    
    loadActivity();
  }, [activityId]);
  
  function handleStartTimeChange(newTime: Date) {
    const offset = differenceInMinutes(newTime, originalStart!);
    
    const offsetEvents = childEvents.map(event => ({
      ...event,
      session_start: addMinutes(new Date(event.session_start), offset)
    }));
    
    setEditedStart(newTime);
    setChildEvents(offsetEvents);
  }
  
  async function handleSave() {
    // Validate
    const errors = validateEventTimes(editedStart!, childEvents);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      toast.error('Please fix validation errors');
      return;
    }
    
    // Save
    await updateActivity({
      id: activityId,
      session_start: editedStart,
      events: childEvents
    });
    
    toast.success('Activity updated');
    router.push('/home');
  }
  
  return (
    <form>
      <h1>Edit Activity</h1>
      
      {/* Locked Category Display */}
      <div className="category-locked">
        📁 {activity?.categoryPath}
      </div>
      
      {/* Activity Start Time */}
      <div className="field">
        <label>Activity Start Time</label>
        <DateTimeInput
          value={editedStart}
          onChange={handleStartTimeChange}
        />
        {editedStart && originalStart && differenceInMinutes(editedStart, originalStart) !== 0 && (
          <span className="offset-indicator">
            {differenceInMinutes(editedStart, originalStart) > 0 ? '+' : ''}
            {differenceInMinutes(editedStart, originalStart)} min offset applied to all events
          </span>
        )}
      </div>
      
      {/* Parent Category Attributes (editable) */}
      <section className="parent-attrs">
        <h2>Parent Category Attributes</h2>
        {/* Render parent attribute inputs */}
      </section>
      
      {/* Leaf Category Attributes */}
      <section className="leaf-attrs">
        <h2>Activity Attributes</h2>
        {/* Render leaf attribute inputs */}
      </section>
      
      {/* Child Events */}
      {childEvents.length > 0 && (
        <section className="child-events">
          <h2>Session Events ({childEvents.length})</h2>
          {childEvents.map((event, idx) => (
            <div key={event.id} className="event-item">
              <label>Event {idx + 1} Time</label>
              <DateTimeInput
                value={event.session_start}
                onChange={time => handleEventTimeEdit(event.id, time)}
                error={validationErrors.find(e => e.field === `event_${event.id}`)}
              />
              {event.note && <p>{event.note}</p>}
            </div>
          ))}
        </section>
      )}
      
      {/* Actions */}
      <div className="actions">
        <button type="button" onClick={() => router.back()}>Cancel</button>
        <button type="button" onClick={handleSave}>Save</button>
      </div>
    </form>
  );
}
```

### 6.6 Database Transaction

```typescript
// Save activity edit with child events in single transaction
async function updateActivity(params: {
  id: string;
  session_start: Date;
  attributes: Record<string, any>;
  events: ChildEvent[];
}) {
  const supabase = createClient();
  
  try {
    // Start transaction (use RPC function in Supabase)
    const { error: activityError } = await supabase
      .from('events')
      .update({
        session_start: params.session_start.toISOString(),
        edited_at: new Date().toISOString()
      })
      .eq('id', params.id);
    
    if (activityError) throw activityError;
    
    // Update child events (if any)
    if (params.events.length > 0) {
      const { error: eventsError } = await supabase
        .from('events')
        .upsert(
          params.events.map(event => ({
            id: event.id,
            session_start: event.session_start.toISOString(),
            edited_at: new Date().toISOString()
          }))
        );
      
      if (eventsError) throw eventsError;
    }
    
    // Update attributes
    const { error: attrsError } = await supabase
      .from('event_attributes')
      .upsert(
        Object.entries(params.attributes).map(([attrId, value]) => ({
          event_id: params.id,
          attribute_definition_id: attrId,
          value_text: value  // Simplified - handle all types
        }))
      );
    
    if (attrsError) throw attrsError;
    
    return { success: true };
    
  } catch (error) {
    console.error('Failed to update activity:', error);
    throw error;
  }
}
```

---

## 7. DATABASE SCHEMA DETAILS

### 7.1 Key Tables

```sql
-- Areas (Top-level grouping)
CREATE TABLE areas (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  color text,
  sort_order integer NOT NULL
);

-- Categories (Hierarchical structure)
CREATE TABLE categories (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  area_id uuid REFERENCES areas(id),
  parent_category_id uuid REFERENCES categories(id),
  name text NOT NULL,
  slug text NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 10),
  sort_order integer NOT NULL,
  path ltree  -- PostgreSQL ltree for efficient hierarchy queries
);

-- Attribute Definitions (EAV pattern)
CREATE TABLE attribute_definitions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  category_id uuid REFERENCES categories(id),
  name text NOT NULL,
  slug text NOT NULL,
  data_type text CHECK (data_type IN ('text', 'number', 'datetime', 'boolean', 'link', 'image')),
  unit text,
  is_required boolean DEFAULT false,
  validation_rules jsonb DEFAULT '{}',
  sort_order integer NOT NULL
);

-- Events (Activities)
CREATE TABLE events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  category_id uuid REFERENCES categories(id),
  event_date date NOT NULL,
  session_start timestamp with time zone,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  edited_at timestamp with time zone DEFAULT now()
);

-- Event Attributes (EAV values)
CREATE TABLE event_attributes (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  attribute_definition_id uuid REFERENCES attribute_definitions(id),
  value_text text,
  value_number numeric,
  value_datetime timestamp with time zone,
  value_boolean boolean,
  value_json jsonb
);
```

### 7.2 TextOptions Storage Examples

```sql
-- Simple TextOptions
INSERT INTO attribute_definitions (
  category_id,
  name,
  slug,
  data_type,
  validation_rules
) VALUES (
  'cat-123',
  'Exercise Type',
  'exercise_type',
  'text',
  '{"text_options": "Upper|Lower|Full Body"}'::jsonb
);

-- Conditional TextOptions
INSERT INTO attribute_definitions (
  category_id,
  name,
  slug,
  data_type,
  validation_rules
) VALUES (
  'cat-123',
  'Exercise Name',
  'exercise_name',
  'text',
  '{
    "text_options_conditional": {
      "Upper": "pull.m|biceps|triceps|rame",
      "Lower": "squats|deadlifts|leg.press",
      "Full Body": "burpees|clean.jerk"
    },
    "depends_on": {
      "attribute_slug": "exercise_type"
    }
  }'::jsonb
);
```

---

## 8. IMPLEMENTATION ROADMAP

### 8.1 Phase 1: Home + Universal Filter (3-4 dana)

**Goal:** User može filtrirati i vidjeti liste activities.

**Tasks:**
1. ✅ Setup React + Vite + TypeScript + Tailwind
2. ✅ Setup Supabase client
3. ⏳ Header component (logo, settings, user dropdown)
4. ⏳ Tab navigation (Activities, Structure)
5. ⏳ POSTEPENI PROLAZ - Progressive Category Selector
   - Area dropdown
   - Category step dropdowns
   - Leaf validation
   - Full path display
6. ⏳ Shortcuts section (Presets)
7. ⏳ Date range picker
8. ⏳ Sort dropdown
9. ⏳ Activities table (virtualized for performance)
10. ⏳ Control buttons (+ Add Activity, filters)

**Deliverables:**
- Working Home screen
- Category selection working end-to-end
- Activities table displaying data from Supabase

---

### 8.2 Phase 2: Add Activity (2-3 dana)

**Goal:** User može dodati novu aktivnost s attributima, note, photo, session logging.

**Tasks:**
1. ⏳ Add Activity route & layout
2. ⏳ Locked category display (from filter)
3. ⏳ Load attribute definitions for category path
4. ⏳ Render parent category attributes (if > 0)
5. ⏳ Render leaf category attributes
6. ⏳ Date/Time inputs
7. ⏳ Event Note textarea
8. ⏳ Photo capture (camera + gallery)
9. ⏳ Session Log widget
10. ⏳ "Other" option → TextOptions update
11. ⏳ Conditional dropdowns (dependencies)
12. ⏳ Save+ button (reset Note)
13. ⏳ Finish button (navigate back)
14. ⏳ Cancel button (with confirmation)

**Deliverables:**
- Fully functional Add Activity form
- "Other" values auto-updating TextOptions
- Session logging working

---

### 8.3 Phase 3: Edit Activity (2.5-3 dana)

**Goal:** User može editirati postojeću aktivnost, uključujući auto-offset za child events.

**Tasks:**
1. ⏳ Edit Activity route
2. ⏳ Load activity + child events
3. ⏳ Pre-populate form with existing data
4. ⏳ Locked category display
5. ⏳ Editable parent category attributes
6. ⏳ Editable leaf category attributes
7. ⏳ Auto-offset logic for session_start change
8. ⏳ Manual edit of individual event times
9. ⏳ Time validation (before save)
10. ⏳ Save transaction (activity + events + attributes)
11. ⏳ Cancel with confirmation

**Deliverables:**
- Fully functional Edit Activity
- Auto-offset working correctly
- Validation preventing time conflicts

---

## 9. TECHNICAL REFERENCE

### 9.1 Tech Stack

```yaml
Frontend:
  Framework: React 18
  Language: TypeScript 5
  Styling: Tailwind CSS
  Build: Vite
  Routing: React Router v6
  State: Zustand (lightweight) or Context API
  Forms: React Hook Form + Zod validation
  Date/Time: date-fns
  UI Components: shadcn/ui (Radix primitives)

Backend:
  Database: PostgreSQL (Supabase)
  Auth: Supabase Auth
  Storage: Supabase Storage (for photos)
  Real-time: Supabase Subscriptions (optional)

Deployment:
  Hosting: Netlify
  CI/CD: Netlify build pipeline
  Environment: Node.js 18+
```

### 9.2 Project Structure

```
events-tracker-react/
├── src/
│   ├── components/
│   │   ├── ProgressiveCategorySelector.tsx
│   │   ├── AttributeInput.tsx
│   │   ├── ComboboxWithOther.tsx
│   │   ├── DateTimeInput.tsx
│   │   ├── SessionLogWidget.tsx
│   │   └── Skeletons/
│   │       ├── AddActivitySkeleton.tsx
│   │       └── CategoryDropdownSkeleton.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── AddActivity.tsx
│   │   └── EditActivity.tsx
│   ├── hooks/
│   │   ├── useProgressiveSelection.ts
│   │   ├── useCategoriesForArea.ts
│   │   ├── useAttributeDefinitions.ts
│   │   └── useOptimisticUpdate.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── cache.ts                 # Category cache manager
│   │   └── performance.ts           # Prefetch vs lazy loading
│   ├── types/
│   │   ├── database.ts
│   │   └── validation.ts
│   └── utils/
│       ├── textOptionsParser.ts     # Parse "opt1|opt2|opt3"
│       ├── validation.ts            # Time validation logic
│       ├── dateHelpers.ts
│       └── errorHandling.ts         # Error boundary & logging
```

### 9.3 TextOptions Parser Utility

```typescript
// utils/textOptionsParser.ts

/**
 * Parse pipe-separated TextOptions string into array
 * @param optionsString - "opt1|opt2|opt3"
 * @returns ["opt1", "opt2", "opt3"]
 */
export function parseTextOptions(optionsString: string | undefined): string[] {
  if (!optionsString || optionsString.trim() === '') {
    return [];
  }
  return optionsString.split('|').map(opt => opt.trim()).filter(Boolean);
}

/**
 * Join array of options into pipe-separated string
 * @param options - ["opt1", "opt2", "opt3"]
 * @returns "opt1|opt2|opt3"
 */
export function joinTextOptions(options: string[]): string {
  return options.join('|');
}

/**
 * Add new option to existing TextOptions string
 * @param existingOptions - "opt1|opt2"
 * @param newOption - "opt3"
 * @returns "opt1|opt2|opt3"
 */
export function addTextOption(existingOptions: string | undefined, newOption: string): string {
  const current = parseTextOptions(existingOptions);
  
  // Prevent duplicates
  if (current.includes(newOption)) {
    return existingOptions || '';
  }
  
  current.push(newOption);
  return joinTextOptions(current);
}

/**
 * Get options for specific parent value (conditional TextOptions)
 * @param validationRules - Attribute validation_rules
 * @param parentValue - Value of parent attribute
 * @returns Array of options for that parent value
 */
export function getConditionalOptions(
  validationRules: ValidationRules,
  parentValue: string | undefined
): string[] {
  if (!validationRules.text_options_conditional || !parentValue) {
    return [];
  }
  
  const optionsString = validationRules.text_options_conditional[parentValue];
  return parseTextOptions(optionsString);
}
```

### 9.4 Validation Helpers

```typescript
// utils/validation.ts

import { differenceInMinutes, isAfter, isBefore } from 'date-fns';

export interface TimeValidationError {
  field: string;
  message: string;
}

/**
 * Validate child event times against parent and each other
 */
export function validateEventTimes(
  parentStartedAt: Date,
  childEvents: Array<{ id: string; session_start: Date }>
): TimeValidationError[] {
  const errors: TimeValidationError[] = [];
  
  childEvents.forEach((child, idx) => {
    // Rule 1: Child must be AFTER parent
    if (!isAfter(child.session_start, parentStartedAt)) {
      errors.push({
        field: `child_${idx}`,
        message: `Event ${idx + 1} time must be after Activity start time`
      });
    }
    
    // Rule 2: Each child must be AFTER previous child
    if (idx > 0) {
      const prevChild = childEvents[idx - 1];
      if (!isAfter(child.session_start, prevChild.session_start)) {
        errors.push({
          field: `child_${idx}`,
          message: `Event ${idx + 1} must be after Event ${idx}`
        });
      }
    }
  });
  
  return errors;
}

/**
 * Calculate time offset between two dates
 */
export function calculateOffset(oldTime: Date, newTime: Date): number {
  return differenceInMinutes(newTime, oldTime);
}
```

### 9.5 TypeScript Interfaces

```typescript
// types/database.ts

export interface Area {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  color?: string;
  sort_order: number;
  slug: string;
}

export interface Category {
  id: string;
  user_id: string;
  area_id: string;
  parent_category_id?: string;
  name: string;
  slug: string;
  description?: string;
  level: number;
  sort_order: number;
  path?: string;  // ltree
}

export interface AttributeDefinition {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  slug: string;
  data_type: 'text' | 'number' | 'datetime' | 'boolean' | 'link' | 'image';
  unit?: string;
  is_required: boolean;
  default_value?: string;
  validation_rules: ValidationRules;
  sort_order: number;
  description?: string;
}

export interface ValidationRules {
  // Simple TextOptions
  text_options?: string;  // "opt1|opt2|opt3"
  
  // Conditional TextOptions
  text_options_conditional?: Record<string, string>;
  depends_on?: {
    attribute_slug: string;
  };
  
  // Other validations
  min_value?: number;
  max_value?: number;
  regex?: string;
  is_required?: boolean;
}

export interface Event {
  id: string;
  user_id: string;
  category_id: string;
  event_date: string;  // ISO date
  session_start?: string;  // ISO datetime
  comment?: string;
  created_at: string;
  edited_at: string;
}

export interface EventAttribute {
  id: string;
  event_id: string;
  attribute_definition_id: string;
  value_text?: string;
  value_number?: number;
  value_datetime?: string;
  value_boolean?: boolean;
  value_json?: any;
}

export interface ActivityPreset {
  id: string;
  user_id: string;
  name: string;
  area_id: string;
  category_id: string;
  usage_count: number;
  last_used?: string;
}
```

### 9.6 Cache Management Utilities

```typescript
// lib/cache.ts

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttl: number;
  
  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttl = ttlMs;
  }
  
  set(key: string, data: T): void {
    this.store.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  invalidate(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
  
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    // Check if not expired
    return Date.now() - entry.timestamp <= this.ttl;
  }
  
  size(): number {
    return this.store.size;
  }
}

// Global category cache instance
export const categoryCache = new Cache<CategoryData>(5 * 60 * 1000);

// Performance monitoring
export function logCacheStats() {
  console.log('📊 Cache Stats:', {
    size: categoryCache.size(),
    ttl: '5 minutes'
  });
}
```

---

## 10. APPENDIX: WIREFRAME FEEDBACK SUMMARY

### Slide 2: App Flow
✅ Odličan slide – nemam nikakvih primjedbi

### Slide 3: POSTEPENI PROLAZ
- Area selection → Category nudi samo L1 & L2
- Svaki korak nudi samo 1 level niže
- Rješava problem dugih lanaca kategorija
- Generira Full Path Title

### Slide 4: Home - Activities
- Pitanje: Što bi bio sadržaj settings-a?
  - Email adresa (user)
  - Change Password?
  - Logout?
  - Connection Status? (kao u Streamlitu)

### Slide 5: Home - Structure (Read-Only)
- NEDOSTAJE Shortcuts section
- MOŽE LI SUNBURST UTJECATI NA FILTER?
- Moze li se dodati 3 vert točkice na red s edit ekranom
- **Structure tab - lower priority - koristimo Streamlit MVP**

### Slide 6: Home - Structure (Edit Mode)
- IPAK IMA univerzalni filter bez datuma
- + Add Area iznad tabele popisa
- 3 vert točkice za edit redova
- **Structure tab - lower priority - koristimo Streamlit MVP**

### Slides 7-9: Structure Details
- Sve kontrole: Add, Insert, Remove iznad popisa
- 3 vert točkice na red s edit ekranom
- **Vidi Streamlit kod za inspiraciju**
- **Structure tab - lower priority - koristimo Streamlit MVP**

### Slide 10: Add Activity (Claude predlog)
- Session Log gore (zastarjelo)

### Slide 11: Add Activity (Sasa preference)
**IMPLEMENTIRATI OVO:**
- Session Log ide ISPOD svega
- Parent kategorije (ako >0 attrs) idu IZNAD leaf-a
- Parent kategorije s 0 attrs se NE ISPISUJU
- Title sa cijelim lancem: "Fitness > Activity > Gym > Strength"
- Event Note IZNAD Photo
- Note RESETS after Save+
- **PAZI: UVIJEK SU DOSTUPNI CANCEL (✕) i Finish (✓)**
  - Trenutno Finish nije aktivan dok se nešto ne upiše - NIJE OK

### Slide 12: Edit Activity
- Category LOCKED
- **MORA SE MOĆI UĆI U ATRIBUTE VIŠIH KATEGORIJA ZA EDIT**
- Razlika u rasporedu kategorija polja vidi Add Activity slide
- **Date/Time edit + event lapovi - KOMENTIRAJ**
  - Implementirano kroz auto-offset + validation

### Slide 13: Sažetak - Prioriteti
**HIGH PRIORITY:**
- ⏳ Home - Activities (In Progress)
- ⏳ Add Activity (In Progress)
- ❌ Edit Activity (Not Started)

**LOW PRIORITY:**
- ❌ Structure Read (Streamlit MVP)
- ❌ Structure Edit (Streamlit MVP)

---

## KRAJ DOKUMENTA

**Verzija:** 2.0  
**Zadnji update:** 2026-02-07  
**Status:** ENHANCED - READY FOR IMPLEMENTATION

**Changelog V2:**
- Added Performance Optimization (Hybrid prefetch/lazy loading)
- Added Caching Layer for categories
- Added Comprehensive Error Handling
- Added Optimistic UI Updates
- Added Type Safety Improvements
- Added Loading States & Skeleton UI
- Added Cache Management Utilities

**Kontakt za pitanja:** Sasa (solo developer)

**Referentni dokumenti:**
- Events_Tracker_Wireframes_20260205-1.pptx
- Add_Activity_Framework_V5.md
- Events_Tracker_React_Roadmap_V3.md
- Code_Guidelines_React_v4.md
- SQL_schema_V3.sql
- Code_Framework_20260206.md (V1)