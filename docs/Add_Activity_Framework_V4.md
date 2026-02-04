# Add Activity Framework V4 - React Implementation

**Verzija:** 4.0  
**Datum:** 2026-02-03  
**Status:** Updated with UI reorganization decisions

**Changelog V4:**
- Category order: Leaf FIRST (sticky), parents collapsed below
- Buttons in sticky header (one line)
- Compact attribute inputs (hint inline with label)
- Two-level comments: Activity (shared) + Leaf (per-event)
- Debug mode hidden by default (`?debug=true` to show)
- Duration auto-fill from lap timer

---

## 📋 Sadržaj

1. [User Flow](#1-user-flow)
2. [Session Timer System](#2-session-timer-system)
3. [UI Components](#3-ui-components)
4. [Shortcuts System](#4-shortcuts-system)
5. [Dropdown System](#5-dropdown-system)
6. [Dependencies (Conditional Dropdowns)](#6-dependencies)
7. [Photo Attachments](#7-photo-attachments)
8. [Event Creation Logic](#8-event-creation-logic)
9. [Edit Mode](#9-edit-mode)
10. [Database Integration](#10-database-integration)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. User Flow

### Osnovni Flow (Add Mode)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Otvori Add Activity                                     │
│     └─ session_start = NOW()                                │
│     └─ Timer kreće: 00:00:00                                │
│                       ↓                                     │
│  2. Odaberi Area/Category (ili koristi Shortcut)           │
│                       ↓                                     │
│  3. Ispuni atribute + optional photo                        │
│                       ↓                                     │
│  4. Save & Continue → Event saved, forma reset, lap reset   │
│     ili Save & Finish → Event saved, session ends           │
└─────────────────────────────────────────────────────────────┘
```

### Ključne Promjene vs V2

| V2 (Streamlit-style) | V3 (React - novo) |
|----------------------|-------------------|
| Time: 09:00 default | Time: NOW() local |
| Nema session timer | Session timer + Lap timer |
| Photo: per-session | Photo: per-exercise |
| created_at: automatic | created_at: used for ordering |
| Workflow mode | Leaf-only + manual Add Another |

### Pravilo: Leaf Category Required

Ako user odabere kategoriju koja NIJE leaf:
- Prikaži poruku "Odaberi jednu od najdubljih kategorija"
- Ponudi listu leaf kategorija ispod odabrane

---

## 2. Session Timer System

### 2.1 Koncept

```
Session Start (kad user otvori Add Activity)
    │
    ├─ Session Timer: ukupno vrijeme sesije (00:12:34)
    │
    ├─ Event 1 saved @ 00:03:45
    │   └─ Lap resets to 00:00:00
    │
    ├─ Lap Timer: vrijeme od zadnjeg save-a (00:02:15)
    │
    ├─ Event 2 saved @ 00:06:00
    │   └─ Lap resets to 00:00:00
    │
    └─ Session End (Save & Finish ili Finish Session)
```

### 2.2 State Management

```typescript
interface SessionState {
  sessionStart: Date;           // Kad je session započeo
  lastSaveTime: Date | null;    // Kad je zadnji event saved
  savedEvents: SavedEventInfo[]; // Log saved events
  isActive: boolean;            // Da li je session aktivan
}

interface SavedEventInfo {
  eventId: string;
  categoryName: string;
  timestamp: Date;              // created_at
  lapTime: string;              // "00:03:45" - vrijeme od prošlog save
  summary: string;              // "biceps 3x12 10kg"
  hasPhoto: boolean;
}
```

### 2.3 Timer Display

```
┌─────────────────────────────────────────────────────────────┐
│  ⏱️ Session: 00:12:34    │    🏃 Lap: 00:02:15             │
│  ────────────────────────┼──────────────────────────────────│
│  ✓ biceps (3x12, 10kg) @ 00:03:45                    📷    │
│  ✓ triceps (3x10, 8kg) @ 00:06:00                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Timer Logic

```typescript
// Custom hook za timer
function useSessionTimer() {
  const [sessionStart] = useState(() => new Date());
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lapElapsed, setLapElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - sessionStart.getTime()) / 1000));
      
      if (lastSaveTime) {
        setLapElapsed(Math.floor((now - lastSaveTime.getTime()) / 1000));
      } else {
        setLapElapsed(Math.floor((now - sessionStart.getTime()) / 1000));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionStart, lastSaveTime]);
  
  const resetLap = () => setLastSaveTime(new Date());
  
  return {
    sessionStart,
    elapsed,        // Total session seconds
    lapElapsed,     // Seconds since last save
    resetLap,
    formatTime: (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };
}
```

### 2.5 Database Mapping

| UI Element | Database Column | Purpose |
|------------|-----------------|---------|
| Session timer start | `events.session_start` | Grupiranje aktivnosti |
| Event save time | `events.created_at` | Kronološki redoslijed |
| Lap time | Calculated | UX feedback |

**Ključno:** Svi eventi iz iste sesije dijele isti `session_start`, ali imaju različite `created_at`.

---

## 3. UI Components

### 3.1 Overall Layout (V4 - Updated)

```
┌─────────────────────────────────────────────────────────────┐
│  STICKY HEADER (timers + ALL buttons)                       │
│  ⏱️ 00:12:34 │ 🏃 00:02:15  [✕ Cancel][💾+ Save][✓ Done]   │
├─────────────────────────────────────────────────────────────┤
│  SESSION LOG (collapsible, shows last 3)                    │
│  ✓ Strength (Upp, biceps, 3x12) @ 00:03:45            📷   │
│  ✓ Strength (Upp, triceps, 3x10) @ 00:06:00                │
├─────────────────────────────────────────────────────────────┤
│  FILTER SECTION                                             │
│  ⚡ Shortcuts: [Gym-Strength ▼] [+ Save] [🗑️]  ← Faza 2    │
│  Area: [Fitness ▼]    Category: [Gym > Strength ▼]         │
├─────────────────────────────────────────────────────────────┤
│  ATTRIBUTE FORM (LEAF FIRST + STICKY DROPDOWNS)             │
│  ═══════════════════════════════════════════════════════   │
│  ▼ Strength (leaf)                              [4 attrs]   │ ← STICKY
│    Strength_type (Upper/Lower/Full)                         │ ← STICKY
│    [Upp                                              ▼]     │ ← STICKY
│    exercise_name (depends on Strength_type)                 │ ← STICKY
│    [biceps                                           ▼]     │ ← STICKY
│  ───────────────────────────────────────────────────────   │
│    sets_reps (npr. "3x10")                                  │   SCROLLS
│    [3x12___________________________________________]        │   SCROLLS
│    weight_info (Informacije o težini)                       │   SCROLLS
│    [10kg___________________________________________]        │   SCROLLS
│                                                             │
│  ▶ Gym                                          [0 attrs]   │ ← COLLAPSED
│  ▶ Activity                                    [11 attrs]   │ ← COLLAPSED
├─────────────────────────────────────────────────────────────┤
│  📷 Photo (optional) - 1 per Save                           │
│     [Click to upload / Take photo]                          │
├─────────────────────────────────────────────────────────────┤
│  💬 Session Comment (shared - svi eventi u sesiji)          │
│  [Morning workout_________________________________]         │
├─────────────────────────────────────────────────────────────┤
│  💬 Event Note (optional - samo ovaj Save, resetira se)     │
│  [Biceps focus today______________________________]         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Key Layout Changes (V4)

| Aspect | V3 | V4 |
|--------|----|----|
| Button position | Bottom of form | Sticky header |
| Category order | Leaf, then parents below | **Leaf FIRST**, parents collapsed below |
| Leaf dropdowns | Normal scroll | **Sticky** (always visible) |
| Attribute hints | Below input | **Inline with label** |
| Comments | One (shared) | **Two: Session + Event** |
| Debug info | Always visible | **Hidden** (`?debug=true`) |

### 3.3 Component Hierarchy (Updated)

```
AddActivityPage
├─ SessionHeader (sticky)
│   ├─ SessionTimer
│   ├─ LapTimer
│   └─ FinishButton
├─ SessionLog (collapsible)
│   └─ SavedEventCard[]
├─ ActivityForm (shared with Edit)
│   ├─ ShortcutsBar
│   │   ├─ ShortcutDropdown
│   │   ├─ SaveShortcutButton
│   │   └─ DeleteShortcutButton
│   ├─ FilterSection
│   │   ├─ AreaDropdown
│   │   └─ CategoryDropdown (leaf-only)
│   ├─ AttributeChainForm
│   │   └─ CategoryAttributeSection[] (collapsible)
│   │       └─ AttributeInput[] (dependency-aware)
│   ├─ PhotoUpload
│   └─ CommentInput
└─ ActionButtons
    ├─ CancelButton
    ├─ SaveContinueButton
    └─ SaveFinishButton
```

### 3.3 Component Hierarchy (Updated)

```
AddActivityPage
├─ SessionHeader (sticky) ← NOW INCLUDES BUTTONS
│   ├─ SessionTimer
│   ├─ LapTimer  
│   ├─ CancelButton (icon on mobile)
│   ├─ SaveContinueButton (icon on mobile)
│   └─ SaveFinishButton ("Done")
├─ SessionLog (collapsible)
│   └─ SavedEventCard[]
├─ ActivityForm (shared with Edit)
│   ├─ ShortcutsBar ← FAZA 2 (hidden during session)
│   ├─ FilterSection
│   │   ├─ AreaDropdown
│   │   └─ CategoryDropdown (leaf-only)
│   ├─ AttributeChainForm ← REORDERED
│   │   ├─ LeafCategorySection (FIRST, expanded, sticky dropdowns)
│   │   └─ ParentCategorySection[] (collapsed)
│   ├─ PhotoUpload (per-event)
│   ├─ SessionCommentInput (shared)
│   └─ EventNoteInput (per-event, optional)
└─ [ActionButtons MOVED TO HEADER]
```

### 3.4 Sticky Dropdown Behavior

Leaf kategorija ima **sticky positioning** za dropdown atribute:

```
┌──────────────────────────────────────┐
│ ▼ Strength (leaf)         [4 attrs] │ ← position: sticky; top: 60px
│   Strength_type [Upp ▼]             │ ← position: sticky; top: 100px  
│   exercise_name [biceps ▼]          │ ← position: sticky; top: 140px
├──────────────────────────────────────┤ ← scroll boundary
│   sets_reps: [3x12]                 │   normal scroll
│   weight_info: [10kg]               │   normal scroll
│ ▶ Gym                               │   normal scroll
│ ▶ Activity                          │   normal scroll
└──────────────────────────────────────┘
```

**Pravilo:** Samo `data_type: 'text'` atributi s `validation_rules.type: 'suggest'` 
ili `'enum'` postaju sticky (jer su to dropdowni).

### 3.5 Compact Attribute Input

```
BEFORE (V3):
┌──────────────────────────────────────┐
│ Strength_type                        │  ← label
│ [Select...                        ▼] │  ← input
│ Upper body / Lower body / Full body  │  ← hint below
└──────────────────────────────────────┘

AFTER (V4):
┌──────────────────────────────────────┐
│ Strength_type  (Upper/Lower/Full)    │  ← label + hint inline
│ [Select...                        ▼] │  ← input
└──────────────────────────────────────┘
```

### 3.6 Two-Level Comment System

| Field | Scope | Behavior |
|-------|-------|----------|
| Session Comment | All events in session | Set once, applies to all Saves |
| Event Note | Single event | Optional, resets after each Save |

**Database mapping:**
- Session Comment → `events.comment` (na svim eventima u chain-u)
- Event Note → Možda novi field ili JSON u comment? TBD

### 3.7 Mobile Optimization (Updated)

- Sticky header s timerima (uvijek vidljiv)
- Collapsible session log (default: zadnja 3)
- Full-width inputs
- Large touch targets (min 44px)
- Swipe gestures: swipe left on saved event → delete?

---

## 4. Shortcuts System

### 4.1 Koncept

Shortcuts = spremljene kombinacije Area + Category za brzi odabir.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Shortcuts: [Select shortcut...     ▼]  [💾] [🗑️]       │
│                                                             │
│  Dropdown options:                                          │
│  ├─ Gym - Strength (used 45x)                              │
│  ├─ Gym - Cardio (used 23x)                                │
│  ├─ Work - Meetings (used 12x)                             │
│  └─ + Create new shortcut...                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Shortcut Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Select | Dropdown change | Popuni Area + Category |
| Save | Click 💾 | Modal: "Shortcut name?" → Save |
| Delete | Click 🗑️ | Confirm → Delete selected shortcut |

### 4.3 Database: activity_presets

```sql
activity_presets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  area_id uuid,
  category_id uuid,
  usage_count integer DEFAULT 0,
  last_used timestamp,
  created_at timestamp DEFAULT now()
)
```

### 4.4 Usage Tracking

```typescript
// Kad se shortcut koristi:
await supabase
  .from('activity_presets')
  .update({ 
    usage_count: shortcut.usage_count + 1,
    last_used: new Date().toISOString()
  })
  .eq('id', shortcut.id);
```

Shortcuts su sortirani po `usage_count DESC, last_used DESC`.

---

## 5. Dropdown System

### 5.1 Tipovi Dropdown-a

| ValidationType | Ponašanje |
|----------------|-----------|
| `suggest` | Dropdown + slobodan unos + "Other..." |
| `enum` | Strict dropdown - samo ponuđene opcije |
| `none` | Slobodan text input |

### 5.2 Suggest Dropdown Sources

```
Opcije u dropdown-u = 
  1. static_options (iz validation_rules, definirane u Excelu)
  + 2. user_values (iz lookup_values tablice, user-added)
  + 3. "Other..." opcija za dodavanje nove vrijednosti
```

### 5.3 "Other..." Flow

```
User klikne "Other..." → Modal:
┌─────────────────────────────────┐
│ Dodaj novu opciju za            │
│ "exercise_name"                 │
│                                 │
│ Nova vrijednost: [___________]  │
│                                 │
│        [Cancel] [Add & Select]  │
└─────────────────────────────────┘
```

---

## 6. Dependencies (Conditional Dropdowns)

### 6.1 Koncept

Atribut B ovisi o vrijednosti atributa A.

### 6.2 Excel Format (V5)

```
| AttributeName  | DependsOn      | WhenValue | TextOptions              |
|----------------|----------------|-----------|--------------------------|
| strength_type  |                |           | Upp|Low|Core             |
| exercise_name  | strength_type  | Upp       | pull.m|biceps|triceps    |
| exercise_name  | strength_type  | Low       | squat-bw|iskoraci        |
| exercise_name  | strength_type  | Core      | plank|leg.raises         |
| exercise_name  | strength_type  | *         |                          |
```

### 6.3 validation_rules JSON

```json
{
  "type": "suggest",
  "depends_on": {
    "attribute_slug": "strength_type",
    "options_map": {
      "Upp": ["pull.m", "biceps", "triceps"],
      "Low": ["squat-bw", "iskoraci"],
      "Core": ["plank", "leg.raises"]
    }
  },
  "allow_other": true
}
```

### 6.4 React Implementation

```typescript
function DependentDropdown({ 
  attribute, 
  parentValue,
  onChange 
}) {
  const options = useMemo(() => {
    const { depends_on } = attribute.validation_rules || {};
    if (!depends_on) return attribute.validation_rules?.suggest || [];
    
    if (!parentValue) return []; // Parent not selected yet
    
    const staticOptions = depends_on.options_map[parentValue] 
      || depends_on.options_map['*'] 
      || [];
    
    // Add user's lookup_values for this parent value
    const userOptions = lookupValues
      .filter(lv => lv.lookup_name === `${attribute.slug}_${parentValue}`)
      .map(lv => lv.value);
    
    return [...new Set([...staticOptions, ...userOptions])];
  }, [attribute, parentValue, lookupValues]);

  // If no options and fallback (*) is empty → free text input
  if (options.length === 0 && attribute.validation_rules?.allow_other) {
    return <Input value={value} onChange={onChange} />;
  }

  return (
    <Combobox 
      options={options}
      allowOther={attribute.validation_rules?.allow_other}
      onAddNew={(value) => saveLookupValue(value, parentValue)}
    />
  );
}
```

---

## 7. Photo Attachments

### 7.1 Koncept

Svaki event (vježba) može imati svoju sliku. Slika se uploada na Supabase Storage.

### 7.2 UI

```
┌─────────────────────────────────────────────────────────────┐
│  📷 Add Photo                                               │
│  ┌─────────────────┐                                        │
│  │                 │  [Choose file...]                      │
│  │   [thumbnail]   │  biceps_form.jpg                       │
│  │                 │  245 KB                                │
│  └─────────────────┘  [✕ Remove]                            │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Upload Flow

```typescript
async function uploadPhoto(file: File, userId: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const ext = file.name.split('.').pop()?.toLowerCase();
  const filename = `${timestamp}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const path = `${userId}/${filename}`;
  
  const { error } = await supabase.storage
    .from('activity-attachments')
    .upload(path, file, { contentType: file.type });
  
  if (error) throw error;
  
  const { data } = supabase.storage
    .from('activity-attachments')
    .getPublicUrl(path);
  
  return data.publicUrl;
}
```

### 7.4 Database: event_attachments

```sql
event_attachments (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  user_id uuid NOT NULL,
  type text CHECK (type IN ('image', 'link', 'file')),
  url text NOT NULL,
  filename text,
  size_bytes integer,
  created_at timestamp DEFAULT now()
)
```

### 7.5 Constraints

- Max file size: 5 MB
- Allowed types: jpg, jpeg, png, webp
- Storage bucket: `activity-attachments`

---

## 8. Event Creation Logic

### 8.1 Touched Flag Pattern

```typescript
interface AttributeInput {
  definitionId: string;
  slug: string;
  value: string | number | boolean | null;
  touched: boolean;  // true = user interacted
}
```

### 8.2 Save Logic

```typescript
async function saveEvent(
  inputs: AttributeInput[], 
  comment: string,
  photoFile: File | null,
  sessionStart: Date,
  categoryChain: Category[]
) {
  // Check if anything was touched
  const hasTouchedAttribute = inputs.some(i => i.touched);
  const hasTouchedComment = comment.trim() !== '';
  const hasPhoto = photoFile !== null;
  
  if (!hasTouchedAttribute && !hasTouchedComment && !hasPhoto) {
    return { cancelled: true, message: 'Nothing to save' };
  }
  
  const now = new Date(); // created_at for this event
  
  // Create events for EACH category in chain
  const createdEvents: Event[] = [];
  
  for (const category of categoryChain) {
    const categoryAttributes = inputs.filter(
      i => i.categoryId === category.id && i.touched && i.value !== null
    );
    
    // Create event
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        category_id: category.id,
        event_date: sessionStart.toISOString().slice(0, 10),
        session_start: sessionStart.toISOString(),
        comment: category.id === leafCategoryId ? comment : null,
        created_at: now.toISOString() // Explicit for ordering
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event_attributes
    if (categoryAttributes.length > 0) {
      const attrRecords = categoryAttributes.map(attr => ({
        event_id: event.id,
        user_id: userId,
        attribute_definition_id: attr.definitionId,
        [`value_${attr.dataType}`]: attr.value
      }));
      
      await supabase.from('event_attributes').insert(attrRecords);
    }
    
    createdEvents.push(event);
  }
  
  // Upload photo (attach to leaf event)
  if (photoFile && createdEvents.length > 0) {
    const leafEvent = createdEvents[0]; // First = leaf
    const url = await uploadPhoto(photoFile, userId);
    
    await supabase.from('event_attachments').insert({
      event_id: leafEvent.id,
      user_id: userId,
      type: 'image',
      url,
      filename: photoFile.name,
      size_bytes: photoFile.size
    });
  }
  
  return { 
    success: true, 
    events: createdEvents,
    timestamp: now
  };
}
```

### 8.3 Save & Continue vs Save & Finish

| Action | Behaviour |
|--------|-----------|
| Save & Continue | Save event, reset form (keep Area/Category/Comment), reset lap timer |
| Save & Finish | Save event, close session, redirect to Show Events or summary |
| Finish (header) | Don't save current form, close session |

---

## 9. Edit Mode

### 9.1 Shared Form Architecture

```typescript
interface ActivityFormProps {
  mode: 'add' | 'edit';
  
  // Add mode specific
  sessionStart?: Date;  // From timer
  
  // Edit mode specific
  initialData?: {
    activityGroup: Event[];
    attributes: EventAttribute[];
    attachments: EventAttachment[];
  };
  
  // Common
  presetAreaId?: string;
  presetCategoryId?: string;
  onSuccess?: (events: Event[]) => void;
  onCancel?: () => void;
}
```

### 9.2 Differences: Add vs Edit

| Aspect | Add Mode | Edit Mode |
|--------|----------|-----------|
| Timer | Visible, running | Hidden |
| Area/Category | Editable (dropdown) | Display only (locked) |
| Date | From session_start | Editable |
| Time | From session_start | Editable |
| Attributes | Empty/defaults | Prepopulated |
| Comment | Empty or session comment | Prepopulated |
| Photos | Empty | Show existing + add new |
| Save action | INSERT | UPDATE |
| Session log | Visible | Hidden |
| Shortcuts | Visible | Hidden |

### 9.3 Edit Mode Entry Point

```typescript
// From Show Events page:
function handleEditActivity(activityGroup: Event[]) {
  // Group = all events with same (date, session_start, comment)
  navigate('/activity/edit', { 
    state: { activityGroup } 
  });
}

// EditActivityPage:
function EditActivityPage() {
  const { state } = useLocation();
  const activityGroup = state?.activityGroup;
  
  if (!activityGroup) {
    return <Navigate to="/events" />;
  }
  
  return (
    <ActivityForm 
      mode="edit"
      initialData={{
        activityGroup,
        attributes: /* fetch from event_attributes */,
        attachments: /* fetch from event_attachments */
      }}
      onSuccess={() => navigate('/events')}
      onCancel={() => navigate('/events')}
    />
  );
}
```

---

## 10. Database Integration

### 10.1 Tables Summary

| Table | Purpose |
|-------|---------|
| `events` | Main event records |
| `event_attributes` | EAV attribute values |
| `event_attachments` | Photos and files |
| `activity_presets` | Shortcuts |
| `lookup_values` | User-added dropdown options |
| `attribute_definitions` | Attribute metadata + validation_rules |

### 10.2 Event Grouping (Activity)

Events are grouped as "Activity" by:
- `event_date` (same date)
- `session_start` (same session start time)
- `comment` (same comment)

Order within group: `created_at ASC`

### 10.3 TEMPLATE_USER_ID

```typescript
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// For suggestions - include template user options
const { data: suggestions } = await supabase
  .from('lookup_values')
  .select('value')
  .or(`user_id.eq.${userId},user_id.eq.${TEMPLATE_USER_ID}`)
  .eq('lookup_name', lookupName);
```

---

## 11. Implementation Phases

### Phase 1: Core Timer + Form (Week 1)
- [ ] Session timer hook
- [ ] Lap timer display
- [ ] Area dropdown
- [ ] Category dropdown (leaf-only validation)
- [ ] Basic attribute form (text/number)
- [ ] Save single event
- [ ] Session log display

### Phase 2: Full Chain + Shortcuts (Week 2)
- [ ] Fetch attributes from category chain
- [ ] Collapsible sections per category
- [ ] Save events for entire chain
- [ ] Touched flag tracking
- [ ] Shortcuts dropdown
- [ ] Save/Delete shortcuts

### Phase 3: Smart Dropdowns + Photos (Week 3)
- [ ] Suggest dropdown with static options
- [ ] "Other..." modal + lookup_values
- [ ] Dependencies (conditional options)
- [ ] Photo upload to Supabase Storage
- [ ] Photo preview + remove

### Phase 4: Edit Mode + Polish (Week 4)
- [ ] Edit mode in ActivityForm
- [ ] Prepopulate from existing events
- [ ] Update logic
- [ ] Mobile optimization
- [ ] Error handling
- [ ] Loading states

---

## Appendix A: TypeScript Types

```typescript
// Core types
interface Event {
  id: string;
  user_id: string;
  category_id: string;
  event_date: string;
  session_start: string;
  comment: string | null;
  created_at: string;
}

interface EventAttribute {
  id: string;
  event_id: string;
  attribute_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
}

interface EventAttachment {
  id: string;
  event_id: string;
  type: 'image' | 'link' | 'file';
  url: string;
  filename: string | null;
  size_bytes: number | null;
}

interface ActivityPreset {
  id: string;
  user_id: string;
  name: string;
  area_id: string | null;
  category_id: string | null;
  usage_count: number;
  last_used: string | null;
}

interface ValidationRules {
  type: 'suggest' | 'enum' | 'none';
  suggest?: string[];
  enum?: string[];
  depends_on?: {
    attribute_slug: string;
    options_map: Record<string, string[]>;
  };
  allow_other?: boolean;
}

// Session types
interface SessionState {
  sessionStart: Date;
  lastSaveTime: Date | null;
  savedEvents: SavedEventInfo[];
  isActive: boolean;
}

interface SavedEventInfo {
  eventId: string;
  categoryName: string;
  timestamp: Date;
  lapTime: string;
  summary: string;
  hasPhoto: boolean;
}

// Form types
interface AttributeInput {
  definitionId: string;
  categoryId: string;
  slug: string;
  dataType: string;
  value: string | number | boolean | null;
  touched: boolean;
}

interface ActivityFormProps {
  mode: 'add' | 'edit';
  sessionStart?: Date;
  initialData?: EditModeData;
  presetAreaId?: string;
  presetCategoryId?: string;
  onSuccess?: (events: Event[]) => void;
  onCancel?: () => void;
}

interface EditModeData {
  activityGroup: Event[];
  attributes: EventAttribute[];
  attachments: EventAttachment[];
}
```

---

*Document created: 2026-01-31*  
*Based on decisions from Session 2026-01-30 + 2026-01-31*
