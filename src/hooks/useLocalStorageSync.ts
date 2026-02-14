/**
 * useLocalStorageSync Hook
 * 
 * Handles all localStorage operations for activity drafts:
 * - Save/load/clear drafts
 * - Auto-save functionality
 * - Draft age calculation for resume dialog
 */

import { useCallback, useEffect, useRef } from 'react';
import type {
  ActivityDraft,
  DraftSummary,
  PendingEvent,
  PendingPhoto,
  SerializedEvent,
  SerializedFormState,
  AttributeValue,
} from '@/types/activity';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  AUTO_SAVE_INTERVAL,
} from '@/types/activity';

// ============================================
// Serialization Helpers
// ============================================

function serializeEvent(event: PendingEvent): SerializedEvent {
  return {
    tempId: event.tempId,
    dbId: event.dbId,
    categoryId: event.categoryId,
    createdAt: event.createdAt.toISOString(),
    attributes: event.attributes.map(attr => ({
      definitionId: attr.definitionId,
      value: attr.value,
      dataType: attr.dataType,
      touched: attr.touched,
    })),
    note: event.note,
    photos: event.photos.map(p => ({
      id: p.id,
      base64: p.base64,
      filename: p.filename,
      sizeBytes: p.sizeBytes,
    })),
    existingPhotos: event.existingPhotos.map(p => ({
      id: p.id,
      url: p.url,
      filename: p.filename,
    })),
    photosToDelete: event.photosToDelete,
    isModified: event.isModified,
    isNew: event.isNew,
    isDeleted: event.isDeleted,
  };
}

function deserializeEvent(data: SerializedEvent): PendingEvent {
  return {
    tempId: data.tempId,
    dbId: data.dbId,
    categoryId: data.categoryId,
    createdAt: new Date(data.createdAt),
    attributes: data.attributes.map(attr => ({
      definitionId: attr.definitionId,
      value: attr.value,
      dataType: attr.dataType as 'text' | 'number' | 'boolean' | 'datetime',
      touched: attr.touched,
    })),
    note: data.note,
    photos: data.photos.map(p => ({
      id: p.id,
      base64: p.base64,
      filename: p.filename,
      sizeBytes: p.sizeBytes,
    })),
    existingPhotos: data.existingPhotos.map(p => ({
      id: p.id,
      url: p.url,
      filename: p.filename,
    })),
    photosToDelete: data.photosToDelete,
    isModified: data.isModified,
    isNew: data.isNew,
    isDeleted: data.isDeleted,
  };
}

function serializeFormState(
  attributes: Map<string, AttributeValue>,
  note: string,
  photos: PendingPhoto[]
): SerializedFormState {
  const serializedAttrs: Record<string, SerializedFormState['attributes'][string]> = {};
  
  attributes.forEach((attr, key) => {
    serializedAttrs[key] = {
      definitionId: attr.definitionId,
      value: attr.value,
      dataType: attr.dataType,
      touched: attr.touched,
    };
  });
  
  return {
    attributes: serializedAttrs,
    note,
    photos: photos.map(p => ({
      id: p.id,
      base64: p.base64,
      filename: p.filename,
      sizeBytes: p.sizeBytes,
    })),
  };
}

function deserializeFormState(data: SerializedFormState): {
  attributes: Map<string, AttributeValue>;
  note: string;
  photos: PendingPhoto[];
} {
  const attributes = new Map<string, AttributeValue>();
  
  Object.entries(data.attributes).forEach(([key, attr]) => {
    attributes.set(key, {
      definitionId: attr.definitionId,
      value: attr.value,
      dataType: attr.dataType as 'text' | 'number' | 'boolean' | 'datetime',
      touched: attr.touched,
    });
  });
  
  return {
    attributes,
    note: data.note,
    photos: data.photos.map(p => ({
      id: p.id,
      base64: p.base64,
      filename: p.filename,
      sizeBytes: p.sizeBytes,
    })),
  };
}

// ============================================
// Age Calculation
// ============================================

function calculateAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  return `${diffWeeks} weeks ago`;
}

// ============================================
// Main Hook
// ============================================

interface UseLocalStorageSyncOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseLocalStorageSyncReturn {
  // Check operations
  hasDraft: () => boolean;
  getDraftSummary: () => DraftSummary | null;
  
  // Load/Save operations
  loadDraft: () => ActivityDraft | null;
  saveDraft: (draft: ActivityDraft) => boolean;
  clearDraft: () => void;
  
  // Auto-save setup
  setupAutoSave: (getDraftData: () => ActivityDraft | null) => void;
  stopAutoSave: () => void;
}

export function useLocalStorageSync(
  options: UseLocalStorageSyncOptions = {}
): UseLocalStorageSyncReturn {
  const { enabled = true, onError } = options;
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getDraftDataRef = useRef<(() => ActivityDraft | null) | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);
  
  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    if (!enabled) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }, [enabled]);
  
  // Get draft summary for resume dialog
  const getDraftSummary = useCallback((): DraftSummary | null => {
    if (!enabled) return null;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const draft = JSON.parse(stored) as ActivityDraft;
      
      // Version check
      if (draft.version !== STORAGE_VERSION) {
        console.warn('Draft version mismatch, will discard on load');
        return null;
      }
      
      // Count photos across all events + current form
      let photoCount = draft.currentForm.photos.length;
      draft.pendingEvents.forEach(event => {
        photoCount += event.photos.length;
      });
      
      return {
        mode: draft.mode,
        age: calculateAge(new Date(draft.updatedAt)),
        categoryPath: draft.categoryPath.join(' > '),
        eventCount: draft.pendingEvents.length,
        photoCount,
        updatedAt: new Date(draft.updatedAt),
      };
    } catch (e) {
      console.error('Failed to get draft summary:', e);
      return null;
    }
  }, [enabled]);
  
  // Load draft from storage
  const loadDraft = useCallback((): ActivityDraft | null => {
    if (!enabled) return null;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const draft = JSON.parse(stored) as ActivityDraft;
      
      // Version check - discard incompatible drafts
      if (draft.version !== STORAGE_VERSION) {
        console.warn('Draft version mismatch, discarding');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      
      return draft;
    } catch (e) {
      console.error('Failed to load draft:', e);
      onError?.(e instanceof Error ? e : new Error('Failed to load draft'));
      return null;
    }
  }, [enabled, onError]);
  
  // Save draft to storage
  const saveDraft = useCallback((draft: ActivityDraft): boolean => {
    if (!enabled) return false;
    
    try {
      draft.updatedAt = new Date().toISOString();
      draft.version = STORAGE_VERSION;
      
      const serialized = JSON.stringify(draft);
      localStorage.setItem(STORAGE_KEY, serialized);
      
      return true;
    } catch (e) {
      console.error('Failed to save draft:', e);
      
      // Check if it's a quota exceeded error
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        onError?.(new Error('Local storage is full. Please finish or discard current session.'));
      } else {
        onError?.(e instanceof Error ? e : new Error('Failed to save draft'));
      }
      
      return false;
    }
  }, [enabled, onError]);
  
  // Clear draft from storage
  const clearDraft = useCallback((): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }, []);
  
  // Setup auto-save interval
  const setupAutoSave = useCallback((getDraftData: () => ActivityDraft | null): void => {
    if (!enabled) return;
    
    // Store reference for interval callback
    getDraftDataRef.current = getDraftData;
    
    // Clear existing interval if any
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }
    
    // Setup new interval
    autoSaveIntervalRef.current = setInterval(() => {
      const draftData = getDraftDataRef.current?.();
      if (draftData) {
        saveDraft(draftData);
        console.log('[AutoSave] Draft saved at', new Date().toISOString());
      }
    }, AUTO_SAVE_INTERVAL);
  }, [enabled, saveDraft]);
  
  // Stop auto-save
  const stopAutoSave = useCallback((): void => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    getDraftDataRef.current = null;
  }, []);
  
  return {
    hasDraft,
    getDraftSummary,
    loadDraft,
    saveDraft,
    clearDraft,
    setupAutoSave,
    stopAutoSave,
  };
}

// ============================================
// Utility Functions (exported for use elsewhere)
// ============================================

export {
  serializeEvent,
  deserializeEvent,
  serializeFormState,
  deserializeFormState,
  calculateAge,
};

// ============================================
// Create Draft Helper
// ============================================

export function createEmptyDraft(
  mode: 'add' | 'edit',
  areaId: string,
  categoryId: string,
  categoryPath: string[],
  sessionStart: Date | null = null
): ActivityDraft {
  const now = new Date().toISOString();
  
  return {
    version: STORAGE_VERSION,
    mode,
    createdAt: now,
    updatedAt: now,
    areaId,
    categoryId,
    categoryPath,
    sessionStart: sessionStart?.toISOString() ?? null,
    pendingEvents: [],
    currentForm: {
      attributes: {},
      note: '',
      photos: [],
    },
    originalEventIds: mode === 'edit' ? [] : undefined,
  };
}

export function createDraftFromState(
  mode: 'add' | 'edit',
  areaId: string,
  categoryId: string,
  categoryPath: string[],
  sessionStart: Date | null,
  pendingEvents: PendingEvent[],
  currentAttributes: Map<string, AttributeValue>,
  currentNote: string,
  currentPhotos: PendingPhoto[],
  originalEventIds?: string[]
): ActivityDraft {
  const now = new Date().toISOString();
  
  return {
    version: STORAGE_VERSION,
    mode,
    createdAt: now, // Will be overwritten if loading existing
    updatedAt: now,
    areaId,
    categoryId,
    categoryPath,
    sessionStart: sessionStart?.toISOString() ?? null,
    pendingEvents: pendingEvents.map(serializeEvent),
    currentForm: serializeFormState(currentAttributes, currentNote, currentPhotos),
    originalEventIds: mode === 'edit' ? originalEventIds : undefined,
  };
}
