# Events Tracker - React Migration Roadmap V3

**Verzija:** 3.0  
**Datum:** 2026-02-05  
**Status:** MAJOR ARCHITECTURE REVISION

---

## 🔴 V3 Ključne Promjene

| Aspekt | V2 | V3 |
|--------|----|----|
| Home Screen | Tabs: Structure \| Events | **Tabs: Activities \| Structure** |
| Filter lokacija | U svakom screenu zasebno | **Univerzalni filter u Home** |
| Add Activity | Ima vlastiti filter | **Prima LOCKED kategoriju iz Home** |
| Show Events | Zasebna stranica | **View Activities tab u Home** |
| Category dropdown | Flat lista | **Postepeni prolaz kroz levele** |

---

## 📋 Sadržaj

1. [Nova Arhitektura](#1-nova-arhitektura)
2. [Screen Inventory](#2-screen-inventory)
3. [Prioritized Roadmap](#3-prioritized-roadmap)
4. [Feature Details](#4-feature-details)
5. [Decision Log](#5-decision-log)
6. [Documents Reference](#6-documents-reference)

---

## 1. Nova Arhitektura

### 1.1 App Flow Diagram

```
                            ┌─────────────────────────────────────┐
                            │              LOGIN                   │
                            │   Email/Password, Sign Up, Reset     │
                            └──────────────┬──────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  HOME                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ UNIVERZALNI FILTER                                                      │  │
│  │ ⚡ Shortcuts: [GymStrength1 ▼] 💾 🗑                                    │  │
│  │ Area: [Fitness ▼]    Category: [Gym > Strength ▼]  (postepeni prolaz)  │  │
│  │ From: [2026-01-01]   To: [2026-02-05]   Sort: [Newest ▼]               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐                            │
│  │   📊 Activities     │  │   🏗️ Structure      │   ← TABS                   │
│  │   (default)         │  │                     │                            │
│  └─────────────────────┘  └─────────────────────┘                            │
│                                                                               │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                               │
│  IF Activities tab:                      IF Structure tab:                   │
│  ┌────────────────────────────────┐     ┌────────────────────────────────┐  │
│  │ KONTROLE                       │     │ MODE: ○ Read-Only  ● Edit      │  │
│  │ 🗑Del 🔍Find 📥Exp 📤Imp [+Add]│     │ 📥 Export  View: ☀️ 📋         │  │
│  ├────────────────────────────────┤     ├────────────────────────────────┤  │
│  │ VIEW ACTIVITIES TABLICA        │     │ IF Read-Only:                  │  │
│  │ Date|Time|Category Path|Comment│     │   Table/Sunburst view          │  │
│  │ ...                     ⋮ Edit │     │ IF Edit:                       │  │
│  │ Load more...                   │     │   4 Tabs: Areas|Cat|Attr|Upload│  │
│  └────────────────────────────────┘     └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
         │                                           │
         │ [+ Add Activity]                          │ (No direct navigation)
         │ (ONLY if LEAF category!)                  │
         ▼                                           │
┌─────────────────────────────┐                      │
│      ADD ACTIVITY           │                      │
│  ┌───────────────────────┐  │                      │
│  │ STICKY HEADER         │  │                      │
│  │ Fitness>Gym>Strength  │  │  ← LOCKED!           │
│  │ ⏱00:12:34 🏃00:02:15 │  │                      │
│  │ [✕] [💾+] [✓]        │  │                      │
│  ├───────────────────────┤  │                      │
│  │ Session Log - na dno  │  │                      │
│  │ Attribute Form        │  │                      │
│  │ Photo + Event Note    │  │                      │
│  └───────────────────────┘  │                      │
└─────────────────────────────┘                      │
         │                                           │
         │ Done / Cancel                             │
         └─────────────► HOME ◄──────────────────────┘
                            ▲
                            │ Save (from Edit)
┌─────────────────────────────┐
│      EDIT ACTIVITY          │  ← Entry: Activities table → ⋮ → Edit
│  ┌───────────────────────┐  │
│  │ HEADER (no timer!)    │  │
│  │ ✏️ Edit Activity      │  │
│  │ Fitness>Gym>Strength  │  │  ← LOCKED!
│  │ [✕] [Save]            │  │
│  ├───────────────────────┤  │
│  │ Date/Time Picker      │  │  ← EDITABLE!
│  │ Attribute Form        │  │
│  │ Photo + Comment       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### 1.2 Ključna Pravila

| Pravilo | Opis |
|---------|------|
| **Leaf Required** | Add Activity se može otvoriti SAMO ako je leaf kategorija odabrana |
| **Locked Category** | Kategorija se NE može mijenjati unutar Add/Edit Activity |
| **Filter u Home** | Shortcuts, Area, Category - sve na jednom mjestu |
| **Dependency Persistence** | Dependency values perzistiraju unutar Add Activity sessiona |
| **Mobile-first** | Osim Structure koja je desktop-first |

---

## 2. Screen Inventory

### 2.1 Screens Overview

| Screen | Status | Prioritet | Napomena |
|--------|--------|-----------|----------|
| Login | ✅ Done | - | Email/password, Sign Up, Reset |
| Home - Activities | ⏳ In Progress | P1 | Filter + Activities table |
| Home - Structure (Read) | ❌ Not Started | P2 | Table/Sunburst view |
| Home - Structure (Edit) | ❌ Not Started | P3 | 4 tabs editing |
| Add Activity | ⏳ In Progress | P1 | Timer, locked category |
| Edit Activity | ❌ Not Started | P2 | Date/time picker, no timer |

### 2.2 Komponente po Screenu

#### HOME - Activities Tab
```
HomeActivitiesTab
├─ UniversalFilter
│   ├─ ShortcutsBar (dropdown + save + delete)
│   ├─ AreaDropdown
│   ├─ CategoryDropdown (postepeni prolaz!)
│   ├─ DateRangePicker (From, To)
│   └─ SortOrderDropdown
├─ ActivitiesControls
│   ├─ DeleteButton (multi-select)
│   ├─ FindButton (search in text fields)
│   ├─ ExportButton
│   ├─ ImportButton
│   └─ AddActivityButton (prominent!)
└─ ActivitiesTable
    ├─ TableHeader (Date, Time, Category Path, Comment)
    ├─ TableRow[] (with ⋮ menu → Edit)
    └─ LoadMoreButton
```

#### HOME - Structure Tab (Read-Only)
```
HomeStructureReadOnly
├─ ModeToggle (Read-Only selected)
├─ StructureFilter (Area, Category - NO dates)
├─ StructureControls
│   ├─ ExportButton
│   └─ ViewToggle (Sunburst | Table)
└─ StructureView
    ├─ SunburstChart (desktop only)
    └─ StructureTable (hierarchical)
```

#### HOME - Structure Tab (Edit Mode)
```
HomeStructureEditMode
├─ ModeToggle (Edit selected)
└─ EditTabs
    ├─ EditAreasTab
    │   ├─ AreasTable (inline edit)
    │   └─ AddAreaButton
    ├─ EditCategoriesTab
    │   ├─ CategoryFilter (by Area)
    │   ├─ CategoriesTable (inline edit)
    │   └─ AddCategoryButton
    ├─ EditAttributesTab
    │   ├─ AttributeFilter (by Category)
    │   ├─ AttributesTable (inline edit)
    │   └─ AddAttributeButton
    └─ UploadExcelTab
        ├─ FileDropzone
        └─ UploadPreview
```

#### ADD ACTIVITY
```
AddActivityPage (receives: areaId, categoryId, categoryPath)
├─ SessionHeader (sticky)
│   ├─ CategoryPathTitle (LOCKED!)
│   ├─ SessionTimer
│   ├─ LapTimer
│   ├─ CancelButton
│   ├─ SaveContinueButton
│   └─ DoneButton
├─ SessionLog (collapsible)
│   └─ SavedEventCard[]
├─ AttributeForm
│   ├─ LeafCategorySection (expanded)
│   └─ ParentCategorySection[] (collapsed or text-only)
├─ PhotoUpload
└─ EventNoteInput
```

#### EDIT ACTIVITY
```
EditActivityPage (receives: eventId)
├─ EditHeader
│   ├─ Title "Edit Activity"
│   ├─ CategoryPathTitle (LOCKED!)
│   ├─ CancelButton
│   └─ SaveButton
├─ DateTimePicker (EDITABLE!)
├─ AttributeForm (prepopulated)
├─ PhotoSection (existing + add new)
└─ CommentInput (prepopulated)
```

---

## 3. Prioritized Roadmap

### Phase 1: Home + Add Activity (Week 1-2)

| Task                                  | Status | Estimate |
| ------------------------------------- | ------ | -------- |
| Redesign Home layout (tabs, filter)   | ❌      | 4h       |
| Implement UniversalFilter             | ❌      | 4h       |
| Implement postepeni Category dropdown | ❌      | 3h       |
| Implement ActivitiesTable             | ❌      | 4h       |
| Refactor Add Activity (remove filter) | ⏳      | 3h       |
| Add CategoryPathTitle to header       | ❌      | 1h       |
| Fix dependency dropdowns              | ⏳      | 4h       |
| Implement dependency persistence      | ❌      | 2h       |
| Implement "Other" → new value         | ❌      | 3h       |
| Session log in Add Activity           | ❌      | 2h       |

**Total: ~30h**

### Phase 2: Edit + Events Features (Week 3)

| Task | Status | Estimate |
|------|--------|----------|
| Edit Activity screen | ❌ | 4h |
| Date/Time picker in Edit | ❌ | 2h |
| Multi-select delete in table | ❌ | 3h |
| Find/search in activities | ❌ | 2h |
| ⋮ menu with Edit option | ❌ | 1h |

**Total: ~12h**

### Phase 3: Structure View (Week 4-5)

| Task | Status | Estimate |
|------|--------|----------|
| Structure Read-Only mode | ❌ | 4h |
| Structure Table view | ❌ | 3h |
| Sunburst chart (desktop) | ❌ | 6h |
| Structure Edit mode | ❌ | 8h |
| Edit Areas tab | ❌ | 3h |
| Edit Categories tab | ❌ | 4h |
| Edit Attributes tab | ❌ | 4h |

**Total: ~32h**

### Phase 4: Excel & Polish (Week 6+)

| Task | Status | Estimate |
|------|--------|----------|
| Excel Export (Activities) | ❌ | 4h |
| Excel Import (Activities) | ❌ | 6h |
| Excel Upload (Structure) | ❌ | 4h |
| Mobile polish | ❌ | 4h |
| Error handling | ❌ | 3h |
| Loading states | ❌ | 2h |

**Total: ~23h**

---

## 4. Feature Details

### 4.1 Postepeni Category Dropdown

Umjesto flat liste svih kategorija:

**Korak 1:** Prikaži Level 1 & 2
```
Domacinstvo (L1)
  └ Automobili (L2)
Investicije (L1)
  └ Dionice (L2)
```

**Korak 2:** Kad user odabere L2, prikaži L3
```
← Automobili
Registracija (L3)
Popravci (L3)
Gorivo (L3)
```

**Korak 3:** Nastavi dok ne dođe do LEAF kategorije

### 4.2 Leaf Category Validation

```typescript
function handleAddActivityClick() {
  if (!selectedCategoryId) {
    toast.warning("Prvo odaberi kategoriju");
    return;
  }
  
  const isLeaf = !categories.some(c => c.parent_category_id === selectedCategoryId);
  
  if (!isLeaf) {
    toast.warning("Odaberi kategoriju do kraja (leaf)");
    return;
  }
  
  // OK - open Add Activity
  navigate('/add-activity', { 
    state: { 
      areaId, 
      categoryId, 
      categoryPath 
    } 
  });
}
```

### 4.3 Dependency Persistence

U Add Activity sessiona, dependency parent values PERZISTIRAJU:

```typescript
function handleSaveContinue() {
  // ... save event ...
  
  // Reset form EXCEPT dependency parents
  const dependencyParentSlugs = getDependencyParentSlugs();
  
  setAttributeValues(prev => {
    const kept = {};
    for (const slug of dependencyParentSlugs) {
      if (prev[slug]) kept[slug] = prev[slug];
    }
    return kept;
  });
  
  // Reset everything else
  setEventNote("");
  setPhoto(null);
}
```

### 4.4 "Other" Option

Kad user odabere "Other..." u suggest dropdown:

1. Prompt za unos nove vrijednosti
2. INSERT u `lookup_values` tablicu
3. Odmah dostupno u dropdownu
4. Perzistira za buduće sessione

---

## 5. Decision Log

### 2026-02-05: Major Architecture Revision (V3)

| Odluka | Razlog |
|--------|--------|
| Filter moved to Home | Konzistentnost, jedan izvor istine |
| Category locked in Add Activity | Sprječava konfuziju, simplificira UX |
| Postepeni category prolaz | Rješava problem dugih lanaca (do 10 levels) |
| Dependency persistence | User experience - ne mora ponavljati odabir |
| Edit Activity separate screen | Različita funkcionalnost od Add |
| Structure desktop-first | Kompleksna za mobile |
| Mobile-first za ostalo | Većina korisnika na mobilnom |

### 2026-01-29: Initial Decisions (V2)

| Odluka | Razlog |
|--------|--------|
| Simple dropdowns > TreeView | Streamlit koristi jednostavno, radi dobro |
| Focus na Add Activity + Show Events | Core funkcionalnost prvo |
| ISV later | Najkompleksnija, može čekati |
| Excel I/O important | 20+ godina podataka |

---

## 6. Documents Reference

| Dokument | Svrha | Lokacija |
|----------|-------|----------|
| Add_Activity_Framework_V5.md | Detaljna spec za Add Activity | /docs |
| Events_Tracker_UI_Design_v3.pptx | Wireframes | /docs |
| schema_V3.sql | Database schema | /sql |

---

*Document created: 2026-02-05*
*Based on PowerPoint review session with Saša*
