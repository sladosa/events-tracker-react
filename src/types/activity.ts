/**
 * Activity Editor Types
 * 
 * Types for Add/Edit Activity functionality including:
 * - Pending events (in-memory)
 * - LocalStorage draft structure
 * - Editor state management
 */

import type { UUID } from './index';

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
// Photo Types
// ============================================

export interface PendingPhoto {
  id: string;                    // Local UUID for tracking
  base64: string;                // Compressed base64 data
  filename: string;              // Original filename
  sizeBytes: number;             // Size after compression
}

export interface ExistingPhoto {
  id: UUID;                      // Database ID
  url: string;                   // Supabase storage URL
  filename?: string;
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
  
  // Photo handling - multiple photos
  photos: PendingPhoto[];            // New photos (base64)
  existingPhotos: ExistingPhoto[];   // Already uploaded (Edit mode)
  photosToDelete: UUID[];            // Marked for deletion (Edit mode)
  
  // Edit mode metadata
  isModified: boolean;
  isNew: boolean;
  isDeleted: boolean;
}

// ============================================
// Serialized Types (for localStorage JSON)
// ============================================

export interface SerializedAttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  dataType: string;
  touched: boolean;
}

export interface SerializedPhoto {
  id: string;
  base64: string;
  filename: string;
  sizeBytes: number;
}

export interface SerializedExistingPhoto {
  id: string;
  url: string;
  filename?: string;
}

export interface SerializedEvent {
  tempId: string;
  dbId?: string;
  categoryId: string;
  createdAt: string;                 // ISO timestamp
  attributes: SerializedAttributeValue[];
  note: string | null;
  photos: SerializedPhoto[];
  existingPhotos: SerializedExistingPhoto[];
  photosToDelete: string[];
  isModified: boolean;
  isNew: boolean;
  isDeleted: boolean;
}

export interface SerializedFormState {
  attributes: Record<string, SerializedAttributeValue>;
  note: string;
  photos: SerializedPhoto[];
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
  areaId: string;
  categoryId: string;                // Leaf category
  categoryPath: string[];            // ['Fitness', 'Activity', 'Gym', 'Strength']
  
  // Session info (Add mode only)
  sessionStart: string | null;       // ISO timestamp
  
  // Events
  pendingEvents: SerializedEvent[];
  
  // Current form state (not yet saved as event)
  currentForm: SerializedFormState;
  
  // For Edit mode: original event IDs being edited
  originalEventIds?: string[];
}

// ============================================
// Draft Summary (for Resume dialog)
// ============================================

export interface DraftSummary {
  mode: EditorMode;
  age: string;                       // "2 hours ago", "yesterday"
  categoryPath: string;              // "Fitness > Activity > Gym > Strength"
  eventCount: number;
  photoCount: number;
  updatedAt: Date;
}

// ============================================
// Editor Context State
// ============================================

export interface EditorState {
  mode: EditorMode;
  isInitialized: boolean;
  
  // Context
  areaId: UUID | null;
  categoryId: UUID | null;
  categoryPath: string[];
  
  // Session
  sessionStart: Date | null;
  
  // Events
  pendingEvents: PendingEvent[];
  
  // Current form
  currentAttributes: Map<UUID, AttributeValue>;
  currentNote: string;
  currentPhotos: PendingPhoto[];
  
  // Status
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Edit mode specific
  originalEventIds: UUID[];
  totalDuration: number | null;      // seconds
}

// ============================================
// Editor Actions
// ============================================

export interface EditorActions {
  // Initialization
  initAdd: (areaId: UUID, categoryId: UUID, categoryPath: string[]) => void;
  initEdit: (sessionStart: Date, categoryId: UUID) => Promise<void>;
  loadDraft: () => boolean;
  clearDraft: () => void;
  
  // Form actions
  setAttribute: (definitionId: UUID, value: string | number | boolean | null, dataType: string) => void;
  setNote: (note: string) => void;
  addPhoto: (file: File) => Promise<{ success: boolean; error?: string }>;
  removePhoto: (photoId: string) => void;
  removeExistingPhoto: (photoId: UUID) => void;
  
  // Event actions (Add mode)
  saveAndContinue: () => Promise<{ success: boolean; error?: string }>;
  
  // Event actions (Edit mode)
  copyEvent: (eventIndex: number) => void;
  deleteEvent: (eventIndex: number) => void;
  restoreEvent: (eventIndex: number) => void;
  
  // Session actions
  finish: () => Promise<{ success: boolean; error?: string }>;
  save: () => Promise<{ success: boolean; error?: string }>;
  cancel: () => void;
  
  // Time editing (Edit mode)
  setSessionStart: (date: Date) => void;
  setEventDuration: (eventIndex: number, seconds: number) => void;
}

// ============================================
// Constants
// ============================================

export const STORAGE_KEY = 'et_activity_draft';
export const STORAGE_VERSION = 1;
export const AUTO_SAVE_INTERVAL = 15000; // 15 seconds

export const MAX_PHOTOS_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per event
export const MAX_PHOTO_DIMENSION = 1200; // pixels (longest side)
export const JPEG_QUALITY = 0.7;

// ============================================
// UI Messages (English)
// ============================================

export const messages = {
  // Page titles
  addActivity: 'Add Activity',
  editActivity: 'Edit Activity',
  
  // Section headers
  sessionLog: 'Session Log',
  attributes: 'Attributes',
  eventNote: 'Event Note',
  photos: 'Photos',
  dateTime: 'Date & Time',
  duration: 'Duration',
  
  // Buttons
  cancel: 'Cancel',
  save: 'Save',
  saveContinue: 'Save +',
  finish: 'Finish',
  copy: 'Copy',
  delete: 'Delete',
  restore: 'Restore',
  addPhoto: '+ Add Photo',
  removePhoto: 'Remove',
  expand: 'Expand',
  collapse: 'Collapse',
  discard: 'Discard',
  resume: 'Resume',
  goToHome: 'Go to Home',
  edit: 'Edit',
  yesDiscard: 'Yes, Discard',
  
  // Dialogs
  cancelTitle: 'Discard Changes?',
  cancelMessageWithEvents: (count: number, photoCount: number) => 
    `You have ${count} unsaved event${count !== 1 ? 's' : ''}${photoCount > 0 ? ` and ${photoCount} photo${photoCount !== 1 ? 's' : ''}` : ''}. Discard and exit?`,
  cancelMessageDirty: 'You have unsaved changes. Discard and exit?',
  
  resumeTitle: 'Resume Previous Session?',
  resumeMessage: (age: string, path: string, eventCount: number, photoCount: number) =>
    `You have an unfinished session from ${age}.\n\nCategory: ${path}\nEvents: ${eventCount}${photoCount > 0 ? `\nPhotos: ${photoCount}` : ''}`,
  
  discardDraftTitle: 'Discard Session?',
  discardDraftMessage: (eventCount: number, photoCount: number) =>
    `This will permanently delete:\n• ${eventCount} unsaved event${eventCount !== 1 ? 's' : ''}${photoCount > 0 ? `\n• ${photoCount} photo${photoCount !== 1 ? 's' : ''}` : ''}\n\nThis action cannot be undone.`,
  
  deleteEventTitle: 'Delete Event?',
  deleteEventMessage: 'This event will be permanently deleted when you save.',
  
  finishTitle: 'Activity Saved!',
  finishMessage: (count: number) =>
    `Successfully saved ${count} event${count !== 1 ? 's' : ''}.`,
  
  // Form
  notePlaceholder: 'Add a note for this event...',
  noteHelper: 'Optional. Resets after each save.',
  selectPlaceholder: 'Select...',
  otherOption: 'Other (add new)',
  addNewValuePlaceholder: 'Enter new value...',
  
  // Photos
  photoLimitReached: 'Photo storage limit (5MB) reached for this event.',
  removePhotoConfirm: 'Remove this photo?',
  
  // Status
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
  
  // Session log
  sessionLogEmpty: 'No events saved yet',
  sessionLogCount: (count: number) => `${count} event${count !== 1 ? 's' : ''} in this session`,
} as const;
