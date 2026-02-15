# Add & Edit Activity Framework V1.1

**Version:** 1.1  
**Date:** 2026-02-14  
**Status:** PLANNING DOCUMENT  
**Language:** All UI messages in English
**Updates:** Softer colors, multiple photos support, 15s auto-save

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Shared Architecture](#2-shared-architecture)
3. [State Management](#3-state-management)
4. [LocalStorage Mechanism](#4-localstorage-mechanism)
5. [Add Activity Flow](#5-add-activity-flow)
6. [Edit Activity Flow](#6-edit-activity-flow)
7. [Shared Components](#7-shared-components)
8. [Visual Design System](#8-visual-design-system)
9. [Data Structures](#9-data-structures)
10. [Timer Logic](#10-timer-logic)
11. [UI Messages (English)](#11-ui-messages-english)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Overview

### 1.1 Core Principle

Both Add Activity and Edit Activity use the **same fundamental pattern**:
1. Load data into memory (new or existing)
2. User makes changes in UI
3. Changes are auto-saved to localStorage (crash protection)
4. On "Finish/Save" → batch write to database
5. On "Cancel" → discard memory + clear localStorage

### 1.2 Key Differences

| Aspect | Add Activity | Edit Activity |
|--------|--------------|---------------|
| Entry point | Home → Add button (leaf category) | Activities table → ⋮ → Edit |
| Initial data | Empty (new session) | Loaded from database |
| Category | Locked (from Home) | Locked (from event) |
| Timers | SESSION + LAP (running) | None (duration shown as info) |
| Date/Time | Auto (session start) | Editable |
| Save button | "Save+" (add another) + "Finish" | "Save" only |
| Multiple events | Yes (within session) | Yes (edit entire activity chain) |

---

## 2. Shared Architecture

### 2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    ActivityEditorProvider                        │
│  (Context: manages pendingEvents, localStorage sync, dirty state)│
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   AddActivityPage   │               │  EditActivityPage   │
│  (mode: "add")      │               │  (mode: "edit")     │
└─────────────────────┘               └─────────────────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED COMPONENTS                             │
├─────────────────────────────────────────────────────────────────┤
│  ActivityHeader        - sticky header with category chain       │
│  AttributeChainForm    - parent + leaf category attributes       │
│  CategorySection       - collapsible section per category        │
│  AttributeInput        - individual attribute field              │
│  EventNoteInput        - per-event note field                    │
│  PhotoUpload           - photo attachment                        │
│  SessionLog            - list of events in session               │
│  ConfirmDialog         - reusable confirmation modal             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Folder Structure

```
src/
├── components/
│   └── activity/
│       ├── ActivityHeader.tsx       # Shared header (Add/Edit variants)
│       ├── AttributeChainForm.tsx   # ✅ EXISTS - enhance
│       ├── CategorySection.tsx      # Collapsible category block
│       ├── AttributeInput.tsx       # ✅ EXISTS - enhance for "Other"
│       ├── EventNoteInput.tsx       # NEW - extracted component
│       ├── PhotoUpload.tsx          # ✅ EXISTS
│       ├── SessionLog.tsx           # ✅ EXISTS - enhance
│       ├── ConfirmDialog.tsx        # NEW - reusable modal
│       └── index.ts
├── context/
│   └── ActivityEditorContext.tsx    # NEW - shared state management
├── hooks/
│   ├── useActivityEditor.ts         # NEW - main editor logic
│   ├── useLocalStorageSync.ts       # NEW - localStorage operations
│   ├── useSessionTimer.ts           # ✅ EXISTS
│   └── usePendingEvents.ts          # NEW - event array management
├── pages/
│   ├── AddActivityPage.tsx          # Refactored to use shared components
│   └── EditActivityPage.tsx         # NEW
└── types/
    └── activity.ts                  # NEW - activity-specific types
```

---

## 3. State Management

### 3.1 State Locations

```
┌─────────────────────────────────────────────────────────────────┐
│                        REACT STATE (Memory)                      │
│  Fast access, lost on page refresh                               │
├─────────────────────────────────────────────────────────────────┤
│  • pendingEvents: PendingEvent[]    - events being edited        │
│  • currentForm: FormState           - current form values        │
│  • isDirty: boolean                 - unsaved changes flag       │
│  • sessionStart: Date               - when session began         │
│  • timerState: TimerState           - elapsed times              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Auto-sync every 5 seconds
                              │ + on every "Save+" click
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOCALSTORAGE (Persistent)                    │
│  Survives refresh, cleared on Finish/Cancel                      │
├─────────────────────────────────────────────────────────────────┤
│  Key: "et_activity_draft"                                        │
│  Value: JSON string of ActivityDraft                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ On "Finish" / "Save"
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Database)                         │
│  Permanent storage                                               │
├─────────────────────────────────────────────────────────────────┤
│  • events table         - main event records                     │
│  • event_attributes     - attribute values                       │
│  • event_attachments    - photos                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 State Flow Diagram

```
[User Action]
     │
     ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Update      │───▶│ Set dirty   │───▶│ Auto-save   │
│ React State │    │ flag=true   │    │ to localStorage
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          ▼                                     ▼
                   [User clicks               [Browser crashes/
                    Finish/Save]               closes unexpectedly]
                          │                                     │
                          ▼                                     ▼
                   ┌─────────────┐                       [Next visit]
                   │ Batch write │                              │
                   │ to Supabase │                              ▼
                   └─────────────┘                       ┌─────────────┐
                          │                              │ Detect draft│
                          ▼                              │ in storage  │
                   ┌─────────────┐                       └─────────────┘
                   │ Clear       │                              │
                   │ localStorage│                              ▼
                   └─────────────┘                       ┌─────────────┐
                          │                              │ Show modal: │
                          ▼                              │ "Resume?"   │
                   [Navigate to Home]                    └─────────────┘
```

---

## 4. LocalStorage Mechanism

### 4.1 Storage Key Structure

```typescript
// Single key for the entire draft
const STORAGE_KEY = 'et_activity_draft';

// What gets stored
interface ActivityDraft {
  version: number;              // Schema version for migrations
  mode: 'add' | 'edit';         // Which page created this
  createdAt: string;            // When draft was created (ISO)
  updatedAt: string;            // Last update (ISO)
  
  // Context
  areaId: string;
  categoryId: string;           // Leaf category
  categoryPath: string[];       // ['Fitness', 'Activity', 'Gym', 'Strength']
  
  // Session info (Add mode only)
  sessionStart: string | null;  // ISO timestamp
  
  // Events
  pendingEvents: StoredEvent[];
  
  // Current form state (not yet saved as event)
  currentForm: {
    attributes: Record<string, AttributeValue>;
    note: string;
    photoBase64: string | null; // Base64 encoded for localStorage
    photoName: string | null;
  };
  
  // For Edit mode: original event IDs being edited
  originalEventIds?: string[];
}
```

### 4.2 StoredEvent Structure

```typescript
interface StoredEvent {
  tempId: string;               // Local UUID (not in DB yet)
  dbId?: string;                // Real DB ID (Edit mode only)
  categoryId: string;
  createdAt: string;            // ISO timestamp
  
  attributes: {
    definitionId: string;
    value: string | number | boolean | null;
    dataType: 'text' | 'number' | 'boolean' | 'datetime';
  }[];
  
  note: string | null;
  
  // Multiple photos support
  photos: {
    id: string;                 // Local UUID for tracking
    base64: string;             // Compressed base64 data
    filename: string;           // Original filename
  }[];
  existingPhotoUrls?: string[]; // For Edit mode: already uploaded photos
  
  // Metadata
  isModified: boolean;          // For Edit mode: has changes?
  isNew: boolean;               // For Edit mode: newly added?
  isDeleted: boolean;           // For Edit mode: marked for deletion?
}
```

### 4.3 LocalStorage Operations

```typescript
// hooks/useLocalStorageSync.ts

const STORAGE_KEY = 'et_activity_draft';
const STORAGE_VERSION = 1;
const AUTO_SAVE_INTERVAL = 15000; // 15 seconds

export function useLocalStorageSync() {
  
  // Check if draft exists
  const hasDraft = (): boolean => {
    return localStorage.getItem(STORAGE_KEY) !== null;
  };
  
  // Load draft from storage
  const loadDraft = (): ActivityDraft | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const draft = JSON.parse(stored) as ActivityDraft;
      
      // Version check - migrate if needed
      if (draft.version !== STORAGE_VERSION) {
        console.warn('Draft version mismatch, discarding');
        clearDraft();
        return null;
      }
      
      return draft;
    } catch (e) {
      console.error('Failed to load draft:', e);
      return null;
    }
  };
  
  // Save draft to storage
  const saveDraft = (draft: ActivityDraft): boolean => {
    try {
      draft.updatedAt = new Date().toISOString();
      draft.version = STORAGE_VERSION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      return true;
    } catch (e) {
      console.error('Failed to save draft:', e);
      // localStorage might be full
      return false;
    }
  };
  
  // Clear draft
  const clearDraft = (): void => {
    localStorage.removeItem(STORAGE_KEY);
  };
  
  // Get draft age (for "Resume?" dialog)
  const getDraftAge = (): string | null => {
    const draft = loadDraft();
    if (!draft) return null;
    
    const updated = new Date(draft.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };
  
  return {
    hasDraft,
    loadDraft,
    saveDraft,
    clearDraft,
    getDraftAge,
  };
}
```

### 4.4 Photo Handling in LocalStorage

```typescript
// Maximum total size for photos per event
const MAX_PHOTOS_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTO_DIMENSION = 1200; // pixels (longest side)
const JPEG_QUALITY = 0.7; // compression quality

// Compress and convert image to base64
const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > height && width > MAX_PHOTO_DIMENSION) {
        height = (height * MAX_PHOTO_DIMENSION) / width;
        width = MAX_PHOTO_DIMENSION;
      } else if (height > MAX_PHOTO_DIMENSION) {
        width = (width * MAX_PHOTO_DIMENSION) / height;
        height = MAX_PHOTO_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed JPEG
      const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(base64);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Calculate current photos size
const calculatePhotosSize = (photos: string[]): number => {
  return photos.reduce((total, base64) => {
    // Base64 is ~33% larger than binary, estimate actual size
    const base64Length = base64.length - (base64.indexOf(',') + 1);
    return total + Math.ceil(base64Length * 0.75);
  }, 0);
};

// Check if can add another photo
const canAddPhoto = (existingPhotos: string[], newPhotoBase64: string): boolean => {
  const currentSize = calculatePhotosSize(existingPhotos);
  const newSize = calculatePhotosSize([newPhotoBase64]);
  return (currentSize + newSize) <= MAX_PHOTOS_SIZE_BYTES;
};

// Add photo with validation
const addPhoto = async (
  file: File, 
  existingPhotos: string[]
): Promise<{ success: boolean; base64?: string; error?: string }> => {
  try {
    const compressed = await compressImage(file);
    
    if (!canAddPhoto(existingPhotos, compressed)) {
      return { 
        success: false, 
        error: 'Photo storage limit (5MB) reached for this event.' 
      };
    }
    
    return { success: true, base64: compressed };
  } catch (e) {
    return { success: false, error: 'Failed to process photo.' };
  }
};

// Convert base64 back to File for upload to Supabase
const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};
```

**Photo Storage Rules:**
- Multiple photos allowed per event
- Each photo is compressed (max 1200px, JPEG quality 0.7)
- Total photo size per event: max 5MB
- When limit reached: show message "Photo storage limit (5MB) reached for this event."
- On Finish/Save: upload all photos to Supabase storage, save URLs in event_attachments

### 4.5 Resume Draft Dialog

When user opens Add Activity and a draft exists:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   📋 Resume Previous Session?                       │
│                                                     │
│   You have an unfinished activity session           │
│   from 2 hours ago.                                 │
│                                                     │
│   Category: Fitness > Activity > Gym > Strength     │
│   Events saved: 3                                   │
│   Photos: 5                                         │
│                                                     │
│   ┌─────────────┐  ┌─────────────────────────────┐ │
│   │   Discard   │  │   Resume Session            │ │
│   └─────────────┘  └─────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**If user clicks "Discard"** → Show confirmation:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ⚠️ Discard Session?                               │
│                                                     │
│   This will permanently delete:                     │
│   • 3 unsaved events                                │
│   • 5 photos                                        │
│                                                     │
│   This action cannot be undone.                     │
│                                                     │
│   ┌─────────────┐  ┌─────────────────────────────┐ │
│   │   Cancel    │  │   Yes, Discard              │ │
│   └─────────────┘  └─────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. Add Activity Flow

### 5.1 Entry Flow

```
[Home Page]
     │
     │ User has selected LEAF category
     │ Clicks [+ Add Activity]
     │
     ▼
┌─────────────────────────────────────────┐
│ Check localStorage for existing draft   │
└─────────────────────────────────────────┘
     │
     ├─── Draft exists? ─── YES ──▶ Show "Resume?" dialog
     │                                    │
     │                              ┌─────┴─────┐
     │                              ▼           ▼
     │                         [Resume]    [Discard]
     │                              │           │
     │                              │     Clear storage
     │                              │           │
     │                              ▼           ▼
     │                         Load draft   Continue
     │                              │      with fresh
     └─── NO ─────────────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │ Initialize Add Activity     │
                    │ • Set sessionStart = now()  │
                    │ • Start SESSION timer       │
                    │ • Start LAP timer           │
                    │ • Load category chain       │
                    │ • Load attribute defs       │
                    └─────────────────────────────┘
```

### 5.2 Save+ Flow (Add Another Event)

```
[User fills form, clicks Save+]
     │
     ▼
┌─────────────────────────────────────────┐
│ Validate required fields                │
└─────────────────────────────────────────┘
     │
     ├─── Invalid? ──▶ Show error, stop
     │
     ▼
┌─────────────────────────────────────────┐
│ Create PendingEvent from current form   │
│ • Generate tempId                       │
│ • Copy attribute values                 │
│ • Set createdAt = now()                 │
│ • Attach photo (base64)                 │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Add to pendingEvents array              │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Save to localStorage                    │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Reset form for next event               │
│ • Keep dropdown values (dependencies!)  │
│ • Clear text inputs                     │
│ • Clear note                            │
│ • Clear photo                           │
│ • Reset LAP timer                       │
└─────────────────────────────────────────┘
     │
     ▼
[Ready for next event]
```

### 5.3 Finish Flow

```
[User clicks Finish ✓]
     │
     ▼
┌─────────────────────────────────────────┐
│ Has current form data?                  │
└─────────────────────────────────────────┘
     │
     ├─── YES ──▶ Auto-save as last event
     │
     ▼
┌─────────────────────────────────────────┐
│ Stop timers                             │
│ Calculate total duration                │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Batch write to Supabase:                │
│ FOR EACH pendingEvent:                  │
│   1. INSERT into events                 │
│   2. INSERT into event_attributes       │
│   3. Upload photo → INSERT attachment   │
└─────────────────────────────────────────┘
     │
     ├─── Error? ──▶ Show error, keep in localStorage
     │
     ▼
┌─────────────────────────────────────────┐
│ Clear localStorage                      │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Show success + offer Edit option        │
│ "Activity saved! [Edit] [Go to Home]"   │
└─────────────────────────────────────────┘
```

### 5.4 Cancel Flow

```
[User clicks Cancel ✕]
     │
     ▼
┌─────────────────────────────────────────┐
│ Check: Any pending events OR dirty form?│
└─────────────────────────────────────────┘
     │
     ├─── NO (nothing to lose) ──▶ Navigate to Home
     │
     ▼ YES
┌─────────────────────────────────────────┐
│ Show confirmation dialog:               │
│ "Discard X unsaved events?"             │
│ [Cancel] [Discard]                      │
└─────────────────────────────────────────┘
     │
     ├─── [Cancel] ──▶ Stay on page
     │
     ▼ [Discard]
┌─────────────────────────────────────────┐
│ Clear localStorage                      │
│ Navigate to Home                        │
└─────────────────────────────────────────┘
```

---

## 6. Edit Activity Flow

### 6.1 Entry Flow

```
[Activities Table]
     │
     │ User clicks ⋮ → Edit on a row
     │
     ▼
┌─────────────────────────────────────────┐
│ Get activity info from row:             │
│ • session_start (groups events)         │
│ • category_id (leaf)                    │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Fetch ALL events with same:             │
│ • user_id                               │
│ • session_start                         │
│ (This gets the entire activity chain)   │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ For each event, fetch:                  │
│ • event_attributes                      │
│ • event_attachments (photos)            │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Convert to StoredEvent[] format         │
│ • Set dbId = real database ID           │
│ • Set isModified = false                │
│ • Set isNew = false                     │
│ • Load existing photos as URLs          │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Save to localStorage (backup)           │
│ Initialize Edit Activity page           │
└─────────────────────────────────────────┘
```

### 6.2 Edit Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ✏️ Edit Activity                                    [✕] [Save] │
│ Fitness > Activity > Gym > Strength                             │
├─────────────────────────────────────────────────────────────────┤
│ 📅 Date & Time                              Duration: 00:45:30  │
│ ┌──────────────┐  ┌──────────────┐                              │
│ │ 2026-02-05   │  │ 09:15        │  (editable!)                 │
│ └──────────────┘  └──────────────┘                              │
├─────────────────────────────────────────────────────────────────┤
│ ▶ Activity (11 attrs)                              [Expand ▼]  │
├─────────────────────────────────────────────────────────────────┤
│ ▼ Strength (leaf) - Event 1 of 3                   [Copy] [🗑] │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Strength_type: [Upper ▼]                                │   │
│   │ exercise_name: [biceps ▼]                               │   │
│   │ sets_reps:     [3x12        ]                           │   │
│   │ weight_info:   [10kg        ]                           │   │
│   │                                                         │   │
│   │ 💬 Comment: [Morning workout          ]                 │   │
│   │ 📷 Photo: [existing.jpg] [+ Add new]                    │   │
│   │                                                         │   │
│   │ Event time: 09:15:00   Duration: [00:15:30]            │   │
│   └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ ▶ Strength (leaf) - Event 2 of 3                   [Copy] [🗑] │
├─────────────────────────────────────────────────────────────────┤
│ ▶ Strength (leaf) - Event 3 of 3                   [Copy] [🗑] │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Time Editing Logic

When user changes session_start time:

```
Original:                    After changing start from 09:15 to 08:45
                             (delta = -30 minutes)

session_start: 09:15:00  →   session_start: 08:45:00

Event 1:                     Event 1:
  created_at: 09:15:00   →     created_at: 08:45:00 (shifted -30m)
  duration: 15:30              duration: 15:30 (unchanged)

Event 2:                     Event 2:
  created_at: 09:30:30   →     created_at: 09:00:30 (shifted -30m)
  duration: 12:00              duration: 12:00 (unchanged)

Event 3:                     Event 3:
  created_at: 09:42:30   →     created_at: 09:12:30 (shifted -30m)
  duration: 18:00              duration: 18:00 (unchanged)
```

When user changes individual event duration:

```
Event 2 duration changed from 12:00 to 20:00 (+8 minutes)

Event 1: unchanged (before edited event)

Event 2:
  duration: 12:00 → 20:00

Event 3:
  created_at: 09:30:30 + 20:00 = 09:50:30  (was 09:42:30)
  
Total activity duration: recalculated
```

### 6.4 Copy Event Logic

```
[User clicks Copy on Event 2]
     │
     ▼
┌─────────────────────────────────────────┐
│ Create new event:                       │
│ • tempId = new UUID                     │
│ • dbId = null (new event)               │
│ • Copy all attributes from Event 2      │
│ • Set note = "Copied"                   │
│ • Clear photo (don't copy)              │
│ • isNew = true                          │
│ • isModified = true                     │
│                                         │
│ Insert after Event 2 in array           │
│ Recalculate times for Event 3+          │
└─────────────────────────────────────────┘
```

### 6.5 Save Flow (Edit)

```
[User clicks Save]
     │
     ▼
┌─────────────────────────────────────────┐
│ Separate events by status:              │
│ • toUpdate: isModified && !isNew        │
│ • toInsert: isNew                       │
│ • toDelete: isDeleted                   │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ Database transaction:                   │
│ 1. DELETE marked events                 │
│ 2. UPDATE modified events               │
│ 3. INSERT new events                    │
│ 4. Handle photos (upload new, keep old) │
└─────────────────────────────────────────┘
     │
     ├─── Error? ──▶ Rollback, show error
     │
     ▼
┌─────────────────────────────────────────┐
│ Clear localStorage                      │
│ Navigate to Home (Activities tab)       │
│ Show success toast                      │
└─────────────────────────────────────────┘
```

---

## 7. Shared Components

### 7.1 ActivityHeader Component

```typescript
interface ActivityHeaderProps {
  mode: 'add' | 'edit';
  categoryPath: string[];           // ['Fitness', 'Activity', 'Gym', 'Strength']
  
  // Add mode only
  sessionElapsed?: number;          // seconds
  lapElapsed?: number;              // seconds
  
  // Edit mode only
  totalDuration?: number;           // seconds (calculated, read-only)
  dateTime?: Date;                  // editable
  onDateTimeChange?: (date: Date) => void;
  
  // Common
  onCancel: () => void;
  onSave: () => void;               // "Save" for Edit, "Finish" for Add
  onSaveContinue?: () => void;      // Add mode only: "Save+"
  canSave: boolean;
  saving: boolean;
}
```

### 7.2 CategorySection Component

```typescript
interface CategorySectionProps {
  category: Category;
  attributes: AttributeDefinition[];
  values: Map<string, AttributeValue>;
  onChange: (definitionId: string, value: any) => void;
  
  isLeaf: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  
  // Edit mode only
  eventIndex?: number;              // "Event 1 of 3"
  totalEvents?: number;
  onCopy?: () => void;
  onDelete?: () => void;
  eventDuration?: number;           // seconds
  onDurationChange?: (seconds: number) => void;
  
  disabled?: boolean;
}
```

### 7.3 ConfirmDialog Component

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;            // default: "Confirm"
  cancelLabel?: string;             // default: "Cancel"
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## 8. Visual Design System

### 8.1 Color Palette

```
┌─────────────────────────────────────────────────────────────────┐
│ ADD ACTIVITY - Soft Blue Theme (Creation/New)                   │
├─────────────────────────────────────────────────────────────────┤
│ Header background:    bg-blue-500       #3B82F6  (softer blue)  │
│ Header text:          text-white        #FFFFFF                 │
│ Session timer:        text-blue-100     #DBEAFE                 │
│ Lap timer:            text-amber-200    #FDE68A                 │
│                                                                 │
│ Primary button:       bg-blue-500       #3B82F6                 │
│ Save+ button:         bg-green-500      #22C55E  (softer green) │
│ Cancel button:        bg-gray-400       #9CA3AF  (lighter)      │
│ Finish button:        bg-teal-500       #14B8A6  (softer teal)  │
│                                                                 │
│ Card background:      bg-white          #FFFFFF                 │
│ Section header:       bg-gray-50        #F9FAFB                 │
│ Leaf expanded:        bg-sky-50         #F0F9FF  (very soft)    │
│ Parent collapsed:     bg-slate-50       #F8FAFC                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ EDIT ACTIVITY - Soft Amber Theme (Modification)                 │
├─────────────────────────────────────────────────────────────────┤
│ Header background:    bg-amber-500      #F59E0B  (warm amber)   │
│ Header text:          text-white        #FFFFFF                 │
│ Duration display:     text-amber-100    #FEF3C7                 │
│                                                                 │
│ Primary button:       bg-amber-500      #F59E0B                 │
│ Save button:          bg-amber-500      #F59E0B                 │
│ Cancel button:        bg-gray-400       #9CA3AF                 │
│ Copy button:          bg-sky-500        #0EA5E9  (softer)       │
│ Delete button:        bg-rose-500       #F43F5E  (softer red)   │
│                                                                 │
│ Card background:      bg-white          #FFFFFF                 │
│ Section header:       bg-amber-50       #FFFBEB  (very soft)    │
│ Leaf expanded:        bg-amber-50       #FFFBEB                 │
│ Parent collapsed:     bg-slate-50       #F8FAFC                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ COMMON ELEMENTS                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Input border:         border-gray-300   #D1D5DB                 │
│ Input focus:          ring-blue-400     #60A5FA  (Add mode)     │
│                       ring-amber-400    #FBBF24  (Edit mode)    │
│ Error text:           text-rose-600     #E11D48                 │
│ Success text:         text-emerald-600  #059669                 │
│ Muted text:           text-gray-500     #6B7280                 │
│ Divider:              border-gray-200   #E5E7EB                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Visual Comparison

```
ADD ACTIVITY (Soft Blue)              EDIT ACTIVITY (Soft Amber)
┌────────────────────────┐            ┌────────────────────────┐
│▓▓▓▓ BLUE-500 HEADER ▓▓▓│            │▓▓▓▓ AMBER-500 HEADER ▓▓│
│ Fitness > Gym > Str... │            │ ✏️ Edit Activity       │
│ ⏱ 00:12:34  🏃 00:02:15│            │ Fitness > Gym > Str... │
│ [✕]    [💾+]    [✓]   │            │ Duration: 00:45:30     │
├────────────────────────┤            │ [✕]         [Save]     │
│ ▶ Session Log (3)      │            ├────────────────────────┤
├────────────────────────┤            │ 📅 2026-02-05  09:15   │
│ ▶ Activity (11 attrs)  │            ├────────────────────────┤
├────────────────────────┤            │ ▶ Activity (11 attrs)  │
│ ▼ Strength (leaf)      │            ├────────────────────────┤
│ ┌────────────────────┐ │            │ ▼ Event 1/3   [📋][🗑]│
│ │ SKY-50 BACKGROUND  │ │            │ ┌────────────────────┐ │
│ │ form fields...     │ │            │ │ AMBER-50 BACKGROUND│ │
│ │                    │ │            │ │ form fields...     │ │
│ └────────────────────┘ │            │ └────────────────────┘ │
│ 📝 Event Note          │            ├────────────────────────┤
│ 📷 Photos              │            │ ▶ Event 2/3   [📋][🗑]│
│ ┌──┐ ┌──┐ [+ Add]     │            └────────────────────────┘
│ │📷│ │📷│              │
│ └──┘ └──┘              │
└────────────────────────┘
```

### 8.2.1 Photos Section Detail

```
📷 Photos (2)                          5MB limit
┌────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  📷     │  │  📷     │  │  + Add      │    │
│  │ img1.jpg│  │ img2.jpg│  │   Photo     │    │
│  │   [✕]   │  │   [✕]   │  │             │    │
│  └─────────┘  └─────────┘  └─────────────┘    │
└────────────────────────────────────────────────┘

When limit reached:
┌────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  📷     │  │  📷     │  │  + Add      │    │
│  │ img1.jpg│  │ img2.jpg│  │   Photo     │    │
│  │   [✕]   │  │   [✕]   │  │  (disabled) │    │
│  └─────────┘  └─────────┘  └─────────────┘    │
│  ⚠️ Photo storage limit (5MB) reached.        │
└────────────────────────────────────────────────┘
```

### 8.3 Button Styles

```typescript
// Tailwind classes for buttons (softer palette)

const buttonStyles = {
  // Primary action (context-dependent)
  primary: {
    add: 'bg-blue-500 hover:bg-blue-600 text-white',
    edit: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  
  // Save + Continue (Add mode)
  saveContinue: 'bg-green-500 hover:bg-green-600 text-white',
  
  // Finish / Save final
  finish: 'bg-teal-500 hover:bg-teal-600 text-white',
  
  // Cancel
  cancel: 'bg-gray-400 hover:bg-gray-500 text-white',
  
  // Danger (delete)
  danger: 'bg-rose-500 hover:bg-rose-600 text-white',
  
  // Secondary (copy, etc.)
  secondary: 'bg-sky-500 hover:bg-sky-600 text-white',
  
  // Ghost (icon only)
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
  
  // Outline (for less prominent actions)
  outline: {
    default: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    danger: 'border border-rose-300 hover:bg-rose-50 text-rose-600',
  },
};
```

### 8.4 Typography

```typescript
const typography = {
  // Page title
  pageTitle: 'text-lg font-semibold text-white',
  
  // Category path in header
  categoryPath: 'text-sm text-white/80',
  
  // Section header
  sectionHeader: 'text-base font-medium text-gray-800',
  
  // Attribute label
  attrLabel: 'text-sm font-medium text-gray-700',
  
  // Input text
  inputText: 'text-base text-gray-900',
  
  // Helper text
  helperText: 'text-xs text-gray-500',
  
  // Error text
  errorText: 'text-sm text-red-600',
  
  // Timer display
  timerLarge: 'text-xl font-mono font-bold',
  timerSmall: 'text-sm font-mono',
};
```

### 8.5 Spacing & Layout

```typescript
const layout = {
  // Page padding
  pagePadding: 'px-4 py-4',
  
  // Card padding
  cardPadding: 'p-4',
  
  // Section gap
  sectionGap: 'space-y-4',
  
  // Form field gap
  fieldGap: 'space-y-3',
  
  // Button group gap
  buttonGap: 'gap-2',
  
  // Header height
  headerHeight: 'h-14',  // 56px
  
  // Sticky header
  stickyHeader: 'sticky top-0 z-10',
};
```

---

## 9. Data Structures

### 9.1 TypeScript Interfaces

```typescript
// types/activity.ts

import type { UUID } from '@/types';

// ============================================
// Core Types
// ============================================

export type EditorMode = 'add' | 'edit';

export interface AttributeValue {
  definitionId: UUID;
  value: string | number | boolean | null;
  dataType: 'text' | 'number' | 'boolean' | 'datetime';
  touched: boolean;
}

// ============================================
// Pending Event (in-memory / localStorage)
// ============================================

export interface PendingEvent {
  tempId: string;                    // Local UUID for tracking
  dbId?: UUID;                       // Real DB ID (Edit mode only)
  categoryId: UUID;
  createdAt: Date;
  
  attributes: AttributeValue[];
  note: string | null;
  
  // Photo handling
  photoFile?: File;                  // Original file (memory only)
  photoBase64?: string;              // For localStorage
  photoUrl?: string;                 // Existing photo URL (Edit mode)
  
  // Edit mode metadata
  isModified: boolean;
  isNew: boolean;
  isDeleted: boolean;
}

// ============================================
// Activity Draft (localStorage)
// ============================================

export interface ActivityDraft {
  version: number;
  mode: EditorMode;
  createdAt: string;                 // ISO
  updatedAt: string;                 // ISO
  
  // Context
  areaId: UUID;
  categoryId: UUID;
  categoryPath: string[];
  
  // Session (Add mode)
  sessionStart: string | null;       // ISO
  
  // Events
  pendingEvents: SerializedEvent[];  // Serialized for JSON
  
  // Current form
  currentForm: SerializedFormState;
  
  // Edit mode
  originalEventIds?: UUID[];
}

export interface SerializedEvent {
  tempId: string;
  dbId?: string;
  categoryId: string;
  createdAt: string;                 // ISO
  attributes: SerializedAttributeValue[];
  note: string | null;
  photoBase64: string | null;
  photoUrl?: string;
  isModified: boolean;
  isNew: boolean;
  isDeleted: boolean;
}

export interface SerializedAttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  dataType: string;
}

export interface SerializedFormState {
  attributes: Record<string, SerializedAttributeValue>;
  note: string;
  photoBase64: string | null;
  photoName: string | null;
}

// ============================================
// Editor Context State
// ============================================

export interface EditorState {
  mode: EditorMode;
  
  // Context
  areaId: UUID | null;
  categoryId: UUID | null;
  categoryPath: string[];
  categoryChain: Category[];
  
  // Session
  sessionStart: Date | null;
  
  // Events
  pendingEvents: PendingEvent[];
  
  // Current form
  currentAttributes: Map<UUID, AttributeValue>;
  currentNote: string;
  currentPhoto: File | null;
  
  // Status
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Edit mode specific
  totalDuration: number | null;      // seconds
}

export interface EditorActions {
  // Initialization
  initAdd: (areaId: UUID, categoryId: UUID, categoryPath: string[]) => void;
  initEdit: (eventId: UUID) => Promise<void>;
  loadDraft: () => boolean;
  
  // Form actions
  setAttribute: (definitionId: UUID, value: any) => void;
  setNote: (note: string) => void;
  setPhoto: (file: File | null) => void;
  
  // Event actions
  saveAndContinue: () => Promise<void>;      // Add mode
  copyEvent: (eventIndex: number) => void;   // Edit mode
  deleteEvent: (eventIndex: number) => void; // Edit mode
  
  // Session actions
  finish: () => Promise<void>;               // Add mode
  save: () => Promise<void>;                 // Edit mode
  cancel: () => void;
  
  // Time editing (Edit mode)
  setSessionStart: (date: Date) => void;
  setEventDuration: (eventIndex: number, seconds: number) => void;
}
```

---

## 10. Timer Logic

### 10.1 Session Timer (Add Mode)

```typescript
// hooks/useSessionTimer.ts (enhanced)

export function useSessionTimer() {
  const [sessionStart] = useState<Date>(() => new Date());
  const [lapStart, setLapStart] = useState<Date>(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [lapElapsed, setLapElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  
  // Update every second
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      setElapsed(Math.floor((now.getTime() - sessionStart.getTime()) / 1000));
      setLapElapsed(Math.floor((now.getTime() - lapStart.getTime()) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionStart, lapStart, isRunning]);
  
  const resetLap = useCallback(() => {
    setLapStart(new Date());
    setLapElapsed(0);
  }, []);
  
  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);
  
  const formatTime = useCallback((seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);
  
  return {
    sessionStart,
    elapsed,
    lapElapsed,
    isRunning,
    resetLap,
    stop,
    formatTime,
  };
}
```

### 10.2 Duration Calculation (Edit Mode)

```typescript
// Calculate duration from events
function calculateTotalDuration(events: PendingEvent[]): number {
  if (events.length === 0) return 0;
  
  const sorted = [...events]
    .filter(e => !e.isDeleted)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  if (sorted.length === 0) return 0;
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  // Duration = last event end time - first event start time
  // For last event, we need its duration attribute or estimate
  const lastDuration = getEventDuration(last) || 0;
  
  return Math.floor(
    (last.createdAt.getTime() - first.createdAt.getTime()) / 1000 + lastDuration
  );
}

// Get duration from event attributes (if exists)
function getEventDuration(event: PendingEvent): number | null {
  const durationAttr = event.attributes.find(
    a => a.definitionId === 'duration' // or lookup by name
  );
  
  if (durationAttr && typeof durationAttr.value === 'number') {
    return durationAttr.value;
  }
  
  return null;
}
```

---

## 11. UI Messages (English)

### 11.1 Headers & Titles

```typescript
const messages = {
  // Page titles
  addActivity: 'Add Activity',
  editActivity: 'Edit Activity',
  
  // Section headers
  sessionLog: 'Session Log',
  attributes: 'Attributes',
  eventNote: 'Event Note',
  photo: 'Photo',
  dateTime: 'Date & Time',
  duration: 'Duration',
};
```

### 11.2 Buttons

```typescript
const buttons = {
  cancel: 'Cancel',
  save: 'Save',
  saveContinue: 'Save +',
  finish: 'Finish',
  copy: 'Copy',
  delete: 'Delete',
  addPhoto: 'Add Photo',
  removePhoto: 'Remove',
  expand: 'Expand',
  collapse: 'Collapse',
  discard: 'Discard',
  resume: 'Resume',
  goToHome: 'Go to Home',
  edit: 'Edit',
};
```

### 11.3 Dialogs

```typescript
const dialogs = {
  // Cancel confirmation (from Add/Edit page)
  cancelTitle: 'Discard Changes?',
  cancelMessageWithEvents: (count: number, photoCount: number) => 
    `You have ${count} unsaved event${count > 1 ? 's' : ''}${photoCount > 0 ? ` and ${photoCount} photo${photoCount > 1 ? 's' : ''}` : ''}. Discard and exit?`,
  cancelMessageDirty: 'You have unsaved changes. Discard and exit?',
  
  // Resume draft dialog
  resumeTitle: 'Resume Previous Session?',
  resumeMessage: (age: string, path: string, eventCount: number, photoCount: number) =>
    `You have an unfinished session from ${age}.\n\nCategory: ${path}\nEvents: ${eventCount}${photoCount > 0 ? `\nPhotos: ${photoCount}` : ''}`,
  
  // Discard draft confirmation (from Resume dialog)
  discardDraftTitle: 'Discard Session?',
  discardDraftMessage: (eventCount: number, photoCount: number) =>
    `This will permanently delete:\n• ${eventCount} unsaved event${eventCount > 1 ? 's' : ''}${photoCount > 0 ? `\n• ${photoCount} photo${photoCount > 1 ? 's' : ''}` : ''}\n\nThis action cannot be undone.`,
  discardDraftConfirm: 'Yes, Discard',
  
  // Delete event (Edit mode)
  deleteTitle: 'Delete Event?',
  deleteMessage: 'This event will be permanently deleted when you save.',
  
  // Finish success
  finishTitle: 'Activity Saved!',
  finishMessage: (count: number) =>
    `Successfully saved ${count} event${count > 1 ? 's' : ''}.`,
};
```

### 11.4 Form Labels & Placeholders

```typescript
const form = {
  // Event note
  notePlaceholder: 'Add a note for this event...',
  noteHelper: 'Optional. Resets after each save.',
  
  // Photos (multiple)
  photosLabel: 'Photos',
  addPhotoButton: '+ Add Photo',
  photosHelper: 'Optional. Multiple photos allowed.',
  photoLimitReached: 'Photo storage limit (5MB) reached for this event.',
  removePhotoConfirm: 'Remove this photo?',
  
  // Date/Time
  dateLabel: 'Date',
  timeLabel: 'Time',
  
  // Duration
  durationLabel: 'Duration',
  durationHelper: 'HH:MM:SS',
  
  // Attributes
  selectPlaceholder: 'Select...',
  otherOption: 'Other (add new)',
  addNewValuePlaceholder: 'Enter new value...',
};
```

### 11.5 Status & Errors

```typescript
const status = {
  loading: 'Loading...',
  saving: 'Saving...',
  saved: 'Saved!',
  compressingPhoto: 'Processing photo...',
  uploadingPhotos: 'Uploading photos...',
  
  // Errors
  errorGeneric: 'Something went wrong. Please try again.',
  errorNetwork: 'Network error. Check your connection.',
  errorValidation: 'Please fill in all required fields.',
  errorPhotoLimit: 'Photo storage limit (5MB) reached for this event.',
  errorPhotoProcess: 'Failed to process photo. Try a different image.',
  errorPhotoUpload: 'Failed to upload photo. Please try again.',
  errorStorageFull: 'Local storage is full. Please finish or discard current session.',
};
```

### 11.6 Session Log

```typescript
const sessionLog = {
  title: 'Session Log',
  empty: 'No events saved yet',
  eventCount: (count: number) => `${count} event${count > 1 ? 's' : ''} in this session`,
  eventSummary: (category: string, time: string) => `${category} at ${time}`,
};
```

---

## 12. Implementation Checklist

### Phase 1: Foundation (This Session)

- [ ] Create `types/activity.ts` with all interfaces
- [ ] Create `hooks/useLocalStorageSync.ts`
- [ ] Create `context/ActivityEditorContext.tsx`
- [ ] Create `components/activity/ConfirmDialog.tsx`

### Phase 2: Add Activity Refactor

- [ ] Remove filters from AddActivityPage
- [ ] Update `ActivityHeader` for locked category display
- [ ] Implement localStorage auto-save
- [ ] Implement resume draft dialog
- [ ] Implement batch save on Finish
- [ ] Test Save+ flow with persistence
- [ ] Test Cancel with confirmation

### Phase 3: Edit Activity

- [ ] Create `pages/EditActivityPage.tsx`
- [ ] Implement activity loading from database
- [ ] Implement Date/Time picker
- [ ] Implement Copy Event
- [ ] Implement Delete Event
- [ ] Implement time cascade logic
- [ ] Implement Save with transaction

### Phase 4: Polish

- [ ] Apply visual design system (colors)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Mobile responsiveness testing
- [ ] Add "Other" value mechanism for dropdowns

---

## Appendix A: File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/activity.ts` | CREATE | All activity-related types |
| `src/hooks/useLocalStorageSync.ts` | CREATE | localStorage operations |
| `src/hooks/useActivityEditor.ts` | CREATE | Main editor logic hook |
| `src/context/ActivityEditorContext.tsx` | CREATE | Shared state provider |
| `src/components/activity/ActivityHeader.tsx` | CREATE | Shared header (Add/Edit) |
| `src/components/activity/ConfirmDialog.tsx` | CREATE | Reusable modal |
| `src/components/activity/EventCard.tsx` | CREATE | Event display in Edit mode |
| `src/pages/AddActivityPage.tsx` | MODIFY | Refactor to use new architecture |
| `src/pages/EditActivityPage.tsx` | CREATE | New page |
| `src/App.tsx` | MODIFY | Add Edit route |

---

*Document created: 2026-02-14*  
*For: Events Tracker React Migration*
