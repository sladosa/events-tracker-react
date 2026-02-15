# Add/Edit Activity Implementation - Handover Document

**Date:** 2026-02-15  
**Session:** AddActivityPage Refactoring  
**Status:** PHASE 2 IN PROGRESS

---

## ✅ Completed This Session

### 1. Refactored AddActivityPage.tsx

| Change | Description |
|--------|-------------|
| Removed Area/Category dropdowns | Category now locked from navigation state |
| Added localStorage sync | Auto-save every 15s using `useLocalStorageSync` |
| Resume dialog on mount | Detects existing draft and offers Resume/Discard |
| New `ActivityHeader` | Replaced `SessionHeader` with mode-aware header |
| `PhotoGallery` | Replaced `PhotoUpload` - now supports multiple photos |
| Pending events array | Events stored in memory until Finish |
| Batch DB write | All events written to DB only on Finish |
| Cancel confirmation | Shows dialog with event/photo counts |
| Category display (locked) | Shows category path with "locked" indicator |

### 2. Updated SessionLog

- Made `timestamp` and `lapTime` optional fields
- More flexible interface for different use cases

### 3. Files Modified

| File | Changes |
|------|---------|
| `src/pages/AddActivityPage.tsx` | Complete rewrite |
| `src/components/activity/SessionLog.tsx` | Made fields optional |

### 4. TypeScript Check
- ✅ All files pass `npm run typecheck`

---

## 🏗️ Architecture Summary

### New Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Home Page                                                       │
│  ↓ Select leaf category → Click "Add Activity"                  │
│  ↓ navigate('/add-activity', { state: { areaId, categoryId, categoryPath } })
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  AddActivityPage                                                 │
│  1. Check for existing draft in localStorage                     │
│     - If found → Show ResumeDialog                               │
│     - If not → Initialize with navigation state                  │
│  2. Category is LOCKED (no dropdowns)                            │
│  3. Fill attributes, add photos, write note                      │
│  4. Click "Save +" → Add to pendingEvents array (stored in localStorage)
│  5. Click "Finish" → Batch write all events to Supabase         │
│  6. Click "Cancel" → Show confirmation, clear draft, go home    │
└─────────────────────────────────────────────────────────────────┘
```

### LocalStorage Structure

```typescript
// Key: 'et_activity_draft'
{
  version: 1,
  mode: 'add',
  createdAt: '2026-02-15T10:00:00Z',
  updatedAt: '2026-02-15T10:05:00Z',
  areaId: 'uuid...',
  categoryId: 'uuid...',
  categoryPath: ['Fitness', 'Activity', 'Gym', 'Strength'],
  sessionStart: '2026-02-15T10:00:00Z',
  pendingEvents: [
    {
      tempId: 'temp_123...',
      categoryId: 'uuid...',
      createdAt: '2026-02-15T10:02:00Z',
      attributes: [...],
      note: 'Felt strong',
      photos: [{ id, base64, filename, sizeBytes }],
      ...
    }
  ],
  currentForm: {
    attributes: {...},
    note: '',
    photos: []
  }
}
```

---

## 🔄 Next Steps (Priority Order)

### Step 1: Update Home Page Navigation ⬅️ NEXT

**File:** `src/pages/AppHome.tsx`

The Home page needs to send navigation state when clicking "Add Activity":

```tsx
// Current (placeholder):
<Link to="/add-activity">Add Activity</Link>

// Required:
<button
  onClick={() => {
    if (!selectedCategoryId || !isLeafCategory) {
      alert('Please select a leaf category first');
      return;
    }
    navigate('/add-activity', {
      state: { 
        areaId: selectedAreaId, 
        categoryId: selectedCategoryId, 
        categoryPath: buildCategoryPath() 
      }
    });
  }}
  disabled={!isLeafCategory}
>
  Add Activity
</button>
```

**Note:** Currently AddActivityPage will redirect to home if no categoryId is provided via navigation state (and no draft exists).

### Step 2: Create EditActivityPage.tsx

**New file:** `src/pages/EditActivityPage.tsx`

- Entry from Activities table (⋮ menu → Edit)
- Load existing activity events from DB
- Use same `ActivityHeader` with `mode="edit"`
- Date/Time editable
- Copy/Delete event functionality
- Amber color theme

### Step 3: Update App.tsx Routing

**Add new route:**
```tsx
<Route path="/edit-activity/:sessionStart" element={<EditActivityPage />} />
```

### Step 4: Update ActivitiesTable

**Add Edit option to row menu:**
```tsx
// In row actions menu:
<button onClick={() => navigate(`/edit-activity/${activity.sessionStart}`)}>
  Edit
</button>
```

---

## 📦 Quick Reference: Key Imports

```tsx
// Types
import type { 
  PendingEvent, 
  PendingPhoto, 
  ActivityDraft,
  EditorMode,
  DraftSummary,
  AttributeValue,
} from '@/types/activity';

import { 
  messages,
  STORAGE_KEY,
  MAX_PHOTOS_SIZE_BYTES,
  AUTO_SAVE_INTERVAL,
} from '@/types/activity';

// Hooks
import { 
  useLocalStorageSync,
  createEmptyDraft,
  createDraftFromState,
  deserializeEvent,
} from '@/hooks/useLocalStorageSync';

// Components
import { 
  ActivityHeader,
  PhotoGallery,
  ConfirmDialog,
  ResumeDialog,
  CancelDialog,
  DiscardDraftDialog,
  SessionLog,
} from '@/components/activity';
```

---

## 🎨 Color Reference (Tailwind)

| Element | Add Activity | Edit Activity |
|---------|--------------|---------------|
| Header bg | `bg-blue-500` | `bg-amber-500` |
| Save+ button | `bg-green-500` | N/A |
| Finish/Save | `bg-teal-500` | `bg-amber-600` |
| Cancel | `bg-white/20` | `bg-white/20` |
| Locked category | `bg-sky-50` | `bg-amber-50` |

---

## 🛠 Known Issues / Notes

1. **Home page navigation:** Currently AddActivityPage expects navigation state. Without it, redirects to home (unless draft exists).

2. **ShortcutsBar:** Still shows in AddActivityPage but only before first event. May need adjustment based on new locked category flow.

3. **React 18 StrictMode:** Auto-save interval is properly cleaned up on unmount.

4. **Photo compression:** Large photos compressed to max 1200px, JPEG 0.7 quality before localStorage storage.

5. **localStorage limit:** ~5MB total. Photos are the main consumer. Error handling for QuotaExceededError included.

---

## 💬 Session Context

### What we did:
- Complete rewrite of AddActivityPage.tsx
- Implemented localStorage-based crash protection
- Added Resume/Discard draft dialogs
- Changed from immediate DB writes to pending events array
- Batch write all events on Finish
- Integrated new PhotoGallery (multiple photos)
- Integrated new ActivityHeader (mode-aware)
- Made SessionLog more flexible

### Files backed up:
- `src/pages/AddActivityPage.tsx.bak` - Original version before refactor

---

## 📞 Resume Prompt for Next Session

```
Bok Claude, nastavljamo rad na Events Tracker React aplikaciji.

KONTEKST:
- SQL_schema_V3.sql - struktura baze
- Code_Guidelines_React_v5.md - konvencije i naučene lekcije

PROŠLA SESIJA:
Refaktorirali smo AddActivityPage.tsx:
- Uklonili Area/Category filtere (kategorija sada locked)
- Dodali localStorage auto-save (15s) s Resume dialog
- Pending events array umjesto immediate DB write
- Batch write na "Finish"
- Integrirali PhotoGallery i ActivityHeader

SLJEDEĆI KORACI:
1. Ažurirati AppHome.tsx da šalje categoryPath u navigation state
2. Kreirati EditActivityPage.tsx
3. Update routing u App.tsx
4. Dodati Edit opciju u ActivitiesTable

Uploadam:
- Handover_Add_Edit_Activity_2026-02-15.md (ovaj dokument)
- events-tracker-react-test-branch.zip (ažurirano stanje)
- SQL_schema_V3.sql
- Code_Guidelines_React_v5.md

Možemo nastaviti s ažuriranjem Home navigacije?
```

---

*Document created: 2026-02-15*  
*For: Events Tracker React Migration*
