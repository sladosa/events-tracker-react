/**
 * AddActivityPage - Refactored
 * 
 * Key changes from previous version:
 * - Category is locked (received from navigation state)
 * - No Area/Category dropdowns
 * - Uses ActivityHeader instead of SessionHeader
 * - LocalStorage auto-save for crash protection
 * - Pending events array (batch write on Finish)
 * - PhotoGallery for multiple photos
 * - Resume dialog on mount
 */

import { useState, useEffect, useMemo, useCallback, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { VALUE_COLUMNS } from '@/lib/constants';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useCategoryChain } from '@/hooks/useCategoryChain';
import { useAttributeDefinitions } from '@/hooks/useAttributeDefinitions';
import {
  useLocalStorageSync,
  createDraftFromState,
  deserializeEvent,
} from '@/hooks/useLocalStorageSync';

import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { SessionLog } from '@/components/activity/SessionLog';
import { AttributeChainForm } from '@/components/activity/AttributeChainForm';
import { PhotoGallery } from '@/components/activity/PhotoGallery';
import {
  ResumeDialog,
  DiscardDraftDialog,
  CancelDialog,
  FinishSuccessDialog,
} from '@/components/activity/ConfirmDialog';

import type { UUID } from '@/types';
import type {
  PendingEvent,
  PendingPhoto,
  AttributeValue,
  DraftSummary,
  ActivityDraft,
} from '@/types/activity';

// ============================================
// Debug Logger
// ============================================

const DEBUG_KEY = 'events_tracker_debug_log';

const persistLog = (message: string) => {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(entry);
    
    const existing = localStorage.getItem(DEBUG_KEY) || '';
    const lines = existing.split('\n').filter(Boolean);
    lines.push(entry);
    while (lines.length > 100) lines.shift();
    localStorage.setItem(DEBUG_KEY, lines.join('\n'));
  } catch (e) {
    console.error('Failed to persist log:', e);
  }
};

const getPersistedLogs = (): string[] => {
  try {
    const logs = localStorage.getItem(DEBUG_KEY) || '';
    return logs.split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const clearPersistedLogs = () => {
  try {
    localStorage.removeItem(DEBUG_KEY);
  } catch {
    // ignore
  }
};

persistLog('=== MODULE LOADED ===');

// ============================================
// Error Boundary
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    persistLog(`ERROR BOUNDARY CAUGHT: ${error.message}`);
    persistLog(`Stack: ${error.stack?.slice(0, 500)}`);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg m-4">
          <h2 className="text-red-700 font-bold text-lg mb-2">⚠️ Component Crashed!</h2>
          <p className="text-red-600 mb-2">{this.state.error?.message}</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-red-500">Stack trace</summary>
            <pre className="mt-2 p-2 bg-red-50 overflow-auto max-h-40 text-red-800">
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-3 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================
// Types
// ============================================

interface LocationState {
  areaId?: string;
  categoryId?: string;
  categoryPath?: string[];
}

interface LocalAttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  touched: boolean;
}

// ============================================
// Main Component
// ============================================

export function AddActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get navigation state
  const locationState = location.state as LocationState | null;
  const navAreaId = locationState?.areaId ?? null;
  const navCategoryId = locationState?.categoryId ?? null;
  const navCategoryPath = locationState?.categoryPath ?? [];
  
  // Debug mode
  const [showDebug, setShowDebug] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('debug') || localStorage.getItem('et_debug') === 'true';
  });
  const [logs, setLogs] = useState<string[]>(() => showDebug ? getPersistedLogs() : []);
  
  const log = useCallback((message: string) => {
    persistLog(message);
    if (showDebug) {
      setLogs(getPersistedLogs());
    }
  }, [showDebug]);
  
  // ============================================
  // LocalStorage Sync
  // ============================================
  
  const {
    getDraftSummary,
    loadDraft,
    saveDraft,
    clearDraft,
    setupAutoSave,
    stopAutoSave,
  } = useLocalStorageSync({
    onError: (err) => setError(err.message),
  });
  
  // ============================================
  // Dialog States
  // ============================================
  
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedSessionStart, setSavedSessionStart] = useState<string | null>(null);
  const [draftSummary, setDraftSummary] = useState<DraftSummary | null>(null);
  
  // ============================================
  // Session State
  // ============================================
  
  const [areaId, setAreaId] = useState<UUID | null>(navAreaId);
  const [categoryId, setCategoryId] = useState<UUID | null>(navCategoryId);
  const [categoryPath, setCategoryPath] = useState<string[]>(navCategoryPath);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Pending events (saved in this session, not yet written to DB)
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  
  // Current form state
  const [attributeValues, setAttributeValues] = useState<Map<string, LocalAttributeValue>>(new Map());
  const [eventNote, setEventNote] = useState('');
  const [currentPhotos, setCurrentPhotos] = useState<PendingPhoto[]>([]);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderError, _setRenderError] = useState<string | null>(null);
  
  // Mobile detection - na mobitelu AddActivity otvara prednju kameru direktno
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // DA1: Dinamički mjerimo visinu headera da izbjegnemo preklapanje
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(176);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  
  // Session timer
  const {
    sessionStart,
    elapsed,
    lapElapsed,
    resetLap,
    endSession,
  } = useSessionTimer();
  
  // ============================================
  // Check for Draft on Mount
  // ============================================
  
  useEffect(() => {
    const summary = getDraftSummary();
    if (summary && summary.mode === 'add') {
      log('Found existing draft');
      setDraftSummary(summary);
      setShowResumeDialog(true);
    } else if (!navCategoryId) {
      // No category from navigation and no draft - redirect to home
      log('No category provided and no draft, redirecting');
      navigate('/app', { replace: true });
    } else {
      // Fresh start with navigation state
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount
  
  // ============================================
  // Resume Draft Handler
  // ============================================
  
  const handleResumeDraft = useCallback(() => {
    log('Resuming draft...');
    
    const draft = loadDraft();
    if (!draft || draft.mode !== 'add') {
      log('Failed to load draft');
      clearDraft();
      setShowResumeDialog(false);
      
      if (!navCategoryId) {
        navigate('/app', { replace: true });
      } else {
        setIsInitialized(true);
      }
      return;
    }
    
    // Restore state from draft
    setAreaId(draft.areaId);
    setCategoryId(draft.categoryId);
    setCategoryPath(draft.categoryPath);
    
    // Restore pending events
    const restoredEvents = draft.pendingEvents.map(deserializeEvent);
    setPendingEvents(restoredEvents);
    
    // Restore current form
    const attrMap = new Map<string, LocalAttributeValue>();
    Object.entries(draft.currentForm.attributes).forEach(([key, attr]) => {
      attrMap.set(key, {
        definitionId: attr.definitionId,
        value: attr.value,
        touched: attr.touched,
      });
    });
    setAttributeValues(attrMap);
    setEventNote(draft.currentForm.note);
    setCurrentPhotos(draft.currentForm.photos);
    
    log(`Draft restored: ${restoredEvents.length} events`);
    setShowResumeDialog(false);
    setIsInitialized(true);
  }, [loadDraft, clearDraft, navCategoryId, navigate, log]);
  
  // ============================================
  // Discard Draft Handler
  // ============================================
  
  const handleDiscardDraft = useCallback(() => {
    setShowResumeDialog(false);
    setShowDiscardDialog(true);
  }, []);
  
  const handleConfirmDiscard = useCallback(() => {
    log('Discarding draft...');
    clearDraft();
    setShowDiscardDialog(false);
    
    if (!navCategoryId) {
      navigate('/app', { replace: true });
    } else {
      setAreaId(navAreaId);
      setCategoryId(navCategoryId);
      setCategoryPath(navCategoryPath);
      setIsInitialized(true);
    }
  }, [clearDraft, navAreaId, navCategoryId, navCategoryPath, navigate, log]);
  
  // ============================================
  // Auto-save Setup
  // ============================================
  
  const getDraftData = useCallback((): ActivityDraft | null => {
    if (!areaId || !categoryId || !isInitialized) return null;
    
    // Convert attributeValues Map to proper format
    const attrs = new Map<string, AttributeValue>();
    attributeValues.forEach((val, key) => {
      attrs.set(key, {
        ...val,
        dataType: 'text', // Will be updated when we have attr definitions
      });
    });
    
    return createDraftFromState(
      'add',
      areaId,
      categoryId,
      categoryPath,
      sessionStart,
      pendingEvents,
      attrs,
      eventNote,
      currentPhotos
    );
  }, [areaId, categoryId, categoryPath, sessionStart, pendingEvents, attributeValues, eventNote, currentPhotos, isInitialized]);
  
  // Setup auto-save when initialized
  useEffect(() => {
    if (isInitialized && areaId && categoryId) {
      log('Setting up auto-save');
      setupAutoSave(getDraftData);
      
      return () => {
        log('Stopping auto-save');
        stopAutoSave();
      };
    }
  }, [isInitialized, areaId, categoryId, setupAutoSave, stopAutoSave, getDraftData, log]);
  
  // ============================================
  // Category Chain & Attributes
  // ============================================
  
  const { chain: categoryChain, loading: chainLoading, error: chainError } = useCategoryChain(categoryId);
  
  useEffect(() => {
    log(`Chain state: loading=${chainLoading}, error=${chainError?.message || 'none'}, length=${categoryChain.length}`);
    if (categoryChain.length > 0) {
      log(`Chain names: ${categoryChain.map(c => c.name).join(' → ')}`);
    }
  }, [categoryChain, chainLoading, chainError, log]);
  
  const chainCategoryIds = useMemo(() => {
    return categoryChain.map(c => c.id);
  }, [categoryChain]);
  
  const { 
    attributesByCategory, 
    loading: attributesLoading,
    error: attributesError,
    refetch: refetchAttributes,
  } = useAttributeDefinitions(chainCategoryIds);
  
  useEffect(() => {
    log(`Attrs state: loading=${attributesLoading}, error=${attributesError?.message || 'none'}, size=${attributesByCategory.size}`);
  }, [attributesByCategory, attributesLoading, attributesError, log]);
  
  // ============================================
  // Form Handlers
  // ============================================
  
  const handleAttributeChange = useCallback((definitionId: string, value: string | number | boolean | null) => {
    setAttributeValues(prev => {
      const next = new Map(prev);
      next.set(definitionId, {
        definitionId,
        value,
        touched: true,
      });
      return next;
    });
  }, []);

  const handleAttributeTouch = useCallback((definitionId: string) => {
    setAttributeValues(prev => {
      const existing = prev.get(definitionId);
      if (existing?.touched) return prev;
      
      const next = new Map(prev);
      next.set(definitionId, {
        definitionId,
        value: existing?.value ?? null,
        touched: true,
      });
      return next;
    });
  }, []);
  
  // ============================================
  // Photo Handlers
  // ============================================
  
  const handlePhotosChange = useCallback((photos: PendingPhoto[]) => {
    setCurrentPhotos(photos);
  }, []);
  
  // ============================================
  // Computed Values
  // ============================================
  
  const hasTouchedAttributes = useMemo(() => {
    return Array.from(attributeValues.values()).some(v => v.touched && v.value != null);
  }, [attributeValues]);

  const canSave = useMemo(() => {
    if (!categoryId) return false;
    return hasTouchedAttributes || eventNote.trim() !== '' || currentPhotos.length > 0;
  }, [categoryId, hasTouchedAttributes, eventNote, currentPhotos]);

  const leafCategoryName = useMemo(() => {
    return categoryChain[0]?.name || categoryPath[categoryPath.length - 1] || 'Unknown';
  }, [categoryChain, categoryPath]);
  
  const canFinish = useMemo(() => {
    return pendingEvents.length > 0 || canSave;
  }, [pendingEvents.length, canSave]);

  // Count total photos across pending events + current form
  const totalPhotoCount = useMemo(() => {
    const pendingPhotos = pendingEvents.reduce((count, event) => count + event.photos.length, 0);
    return pendingPhotos + currentPhotos.length;
  }, [pendingEvents, currentPhotos]);

  // ============================================
  // Save + Continue (Add to pending)
  // ============================================

  const handleSaveContinue = useCallback(() => {
    if (!canSave || !categoryId) return;
    
    log('Save + Continue clicked');
    
    // Auto-fill duration if available
    const leafAttrs = attributesByCategory.get(categoryId) || [];
    const durationAttr = leafAttrs.find(a => 
      a.slug === 'duration' || a.slug.toLowerCase().includes('duration')
    );
    
    // Create a working copy of attribute values
    const workingAttrs = new Map(attributeValues);
    
    if (durationAttr) {
      const durationVal = workingAttrs.get(durationAttr.id);
      if (!durationVal?.touched || durationVal.value == null) {
        const durationMinutes = Math.round(lapElapsed / 60);
        if (durationMinutes > 0) {
          log(`Auto-filling duration: ${durationMinutes} min`);
          workingAttrs.set(durationAttr.id, {
            definitionId: durationAttr.id,
            value: durationMinutes,
            touched: true,
          });
        }
      }
    }
    
    // Create pending event
    const newEvent: PendingEvent = {
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      categoryId,
      createdAt: new Date(),
      attributes: Array.from(workingAttrs.values())
        .filter(v => v.touched && v.value != null)
        .map(v => ({
          definitionId: v.definitionId,
          value: v.value,
          dataType: 'text' as const,
          touched: v.touched,
        })),
      note: eventNote.trim() || null,
      photos: [...currentPhotos],
      existingPhotos: [],
      photosToDelete: [],
      isModified: false,
      isNew: true,
      isDeleted: false,
    };
    
    setPendingEvents(prev => [...prev, newEvent]);
    log(`Added pending event: ${newEvent.tempId}`);
    
    // A8 CORRECTED: Keep ALL attribute values on Save+
    // Only Event Note and Photos are reset
    // This allows quick entry of similar events (e.g., multiple exercises with same weight)
    setAttributeValues(prev => {
      const next = new Map<string, LocalAttributeValue>();
      
      for (const [attrId, currentVal] of prev) {
        if (currentVal && currentVal.value != null) {
          // Keep ALL attribute values with touched=true so they show in UI
          next.set(attrId, { 
            definitionId: currentVal.definitionId,
            value: currentVal.value, 
            touched: true
          });
        }
      }
      
      log(`Preserved ${next.size} attribute values for next event`);
      return next;
    });
    
    // Only reset Event Note and Photos
    setEventNote('');
    setCurrentPhotos([]);
    resetLap();
    
    // Immediate save to localStorage
    const draft = getDraftData();
    if (draft) {
      draft.pendingEvents.push({
        tempId: newEvent.tempId,
        categoryId: newEvent.categoryId,
        createdAt: newEvent.createdAt.toISOString(),
        attributes: newEvent.attributes.map(a => ({
          definitionId: a.definitionId,
          value: a.value,
          dataType: a.dataType,
          touched: a.touched,
        })),
        note: newEvent.note,
        photos: newEvent.photos,
        existingPhotos: [],
        photosToDelete: [],
        isModified: false,
        isNew: true,
        isDeleted: false,
      });
      saveDraft(draft);
    }
  }, [canSave, categoryId, attributeValues, attributesByCategory, eventNote, currentPhotos, lapElapsed, resetLap, getDraftData, saveDraft, log]);

  // ============================================
  // Finish (Batch Write to DB)
  // ============================================

  const handleFinish = async () => {
    if (!canFinish || !categoryId) return;
    
    log('Finish clicked');
    setSaving(true);
    setError(null);
    
    try {
      // Collect all events to save
      let eventsToSave = [...pendingEvents];
      
      // If current form has data, add it as a pending event
      if (canSave) {
        log('Adding current form to events to save');
        
        // Auto-fill duration
        const leafAttrs = attributesByCategory.get(categoryId) || [];
        const durationAttr = leafAttrs.find(a => 
          a.slug === 'duration' || a.slug.toLowerCase().includes('duration')
        );
        
        const workingAttrs = new Map(attributeValues);
        
        if (durationAttr) {
          const durationVal = workingAttrs.get(durationAttr.id);
          if (!durationVal?.touched || durationVal.value == null) {
            const durationMinutes = Math.round(lapElapsed / 60);
            if (durationMinutes > 0) {
              workingAttrs.set(durationAttr.id, {
                definitionId: durationAttr.id,
                value: durationMinutes,
                touched: true,
              });
            }
          }
        }
        
        const currentEvent: PendingEvent = {
          tempId: `temp_${Date.now()}`,
          categoryId,
          createdAt: new Date(),
          attributes: Array.from(workingAttrs.values())
            .filter(v => v.touched && v.value != null)
            .map(v => ({
              definitionId: v.definitionId,
              value: v.value,
              dataType: 'text' as const,
              touched: v.touched,
            })),
          note: eventNote.trim() || null,
          photos: [...currentPhotos],
          existingPhotos: [],
          photosToDelete: [],
          isModified: false,
          isNew: true,
          isDeleted: false,
        };
        
        eventsToSave = [...eventsToSave, currentEvent];
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const eventDate = sessionStart.toISOString().split('T')[0];
      const sessionStartIso = sessionStart.toISOString();
      
      log(`Writing ${eventsToSave.length} leaf events to database`);

      // ============================================================
      // ADD-P2: P2 arhitektura - 1 parent event po sesiji, N leaf
      // ============================================================

      const leafCategoryId = categoryId;
      // chain[0] = leaf, chain[last] = root
      const nonLeafCategories = categoryChain.filter(c => c.id !== leafCategoryId);

      // --- FAZA 1: Parent eventi (1 po kategoriji) ---
      // P2: SVAKA parent kategorija mora imati točno 1 event po sesiji (chain_key anchor).
      // Čak i ako kategorija nema attr defs, INSERT mora nastati — bez toga chain_key
      // veza ne postoji i EditActivityPage ne može locirati parent evente.
      // P3: skupi atribute iz SVIH leaf evenata, "zadnja ne-prazna vrijednost pobjeđuje"
      for (const parentCat of nonLeafCategories) {
        const parentAttrDefs = attributesByCategory.get(parentCat.id) || [];
        const parentAttrDefIds = new Set(parentAttrDefs.map(d => d.id));

        // P3 merge: iterate svi eventsToSave, zadnja ne-null vrijednost pobjeđuje
        const mergedParentAttrs = new Map<string, AttributeValue>();
        for (const ev of eventsToSave) {
          for (const attr of ev.attributes) {
            if (parentAttrDefIds.has(attr.definitionId) && attr.value != null) {
              mergedParentAttrs.set(attr.definitionId, attr);
            }
          }
        }

        // INSERT 1 parent event
        const { data: parentEvent, error: parentEventError } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            category_id: parentCat.id,
            event_date: eventDate,
            session_start: sessionStartIso,
            chain_key: leafCategoryId, // BUG-G fix v2: chain discriminator
            created_at: sessionStart.toISOString(),
          })
          .select('id')
          .single();

        if (parentEventError) throw parentEventError;
        log(`Inserted parent event for ${parentCat.name}: ${parentEvent.id}`);

        // INSERT parent atributi
        if (mergedParentAttrs.size > 0) {
          const parentAttrRecords = Array.from(mergedParentAttrs.values()).map(attr => {
            const def = parentAttrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
            return {
              event_id: parentEvent.id,
              user_id: user.id,
              attribute_definition_id: attr.definitionId,
              [valueColumn]: attr.value,
            };
          });
          const { error: parentAttrError } = await supabase
            .from('event_attributes')
            .insert(parentAttrRecords);
          if (parentAttrError) throw parentAttrError;
        }
      }

      // --- FAZA 2: Leaf eventi (1 po pendingEvent) ---
      const leafAttrDefs = attributesByCategory.get(leafCategoryId) || [];
      const leafAttrDefIds = new Set(leafAttrDefs.map(d => d.id));

      for (const pendingEvent of eventsToSave) {
        // Samo leaf atributi za leaf event
        const leafEventAttrs = pendingEvent.attributes.filter(a => leafAttrDefIds.has(a.definitionId));

        const { data: leafEvent, error: leafEventError } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            category_id: leafCategoryId,
            event_date: eventDate,
            session_start: sessionStartIso,
            comment: pendingEvent.note,
            created_at: pendingEvent.createdAt.toISOString(),
          })
          .select('id, category_id')
          .single();

        if (leafEventError) throw leafEventError;
        log(`Inserted leaf event: ${leafEvent.id}`);

        if (leafEventAttrs.length > 0) {
          const leafAttrRecords = leafEventAttrs.map(attr => {
            const def = leafAttrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
            return {
              event_id: leafEvent.id,
              user_id: user.id,
              attribute_definition_id: attr.definitionId,
              [valueColumn]: attr.value,
            };
          });
          const { error: attrError } = await supabase
            .from('event_attributes')
            .insert(leafAttrRecords);
          if (attrError) throw attrError;
        }

        // Upload photos za leaf event
        log(`Checking photos: ${pendingEvent.photos.length} photos`);
        if (pendingEvent.photos.length > 0) {
          for (const photo of pendingEvent.photos) {
            try {
              log(`Uploading photo: ${photo.id}, filename: ${photo.filename}, size: ${photo.sizeBytes}`);
              const base64Data = photo.base64.split(',')[1];
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'image/jpeg' });
              
              const fileName = `${user.id}/${leafEvent.id}_${photo.id}.jpg`;
              log(`Uploading to: activity-attachments/${fileName}`);
              const { error: uploadError } = await supabase.storage
                .from('activity-attachments')
                .upload(fileName, blob);
              
              if (uploadError) {
                log(`Photo upload FAILED: ${uploadError.message}`);
                console.error('Photo upload failed:', uploadError);
                continue;
              }
              
              const { data: urlData } = supabase.storage
                .from('activity-attachments')
                .getPublicUrl(fileName);
              
              log(`Public URL: ${urlData.publicUrl}`);
              const { error: attachError } = await supabase.from('event_attachments').insert({
                event_id: leafEvent.id,
                user_id: user.id,
                type: 'image',
                url: urlData.publicUrl,
                filename: photo.filename,
                size_bytes: photo.sizeBytes,
              });
              
              if (attachError) {
                log(`Attachment record insert FAILED: ${attachError.message}`);
              } else {
                log(`Attachment record inserted successfully`);
              }
            } catch (photoErr) {
              log(`Photo upload exception: ${photoErr instanceof Error ? photoErr.message : 'unknown'}`);
              console.error('Failed to upload photo:', photoErr);
            }
          }
        }
      }
      
      // Success! Clear draft and show success dialog
      log('All events saved successfully');
      clearDraft();
      endSession();
      
      // Store sessionStart for potential edit navigation
      setSavedSessionStart(sessionStartIso);
      setShowSuccessDialog(true);
      
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save events');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Success Dialog Handlers
  // ============================================

  const handleGoHome = useCallback(() => {
    setShowSuccessDialog(false);
    navigate('/app');
  }, [navigate]);

  const handleEditAfterFinish = useCallback(() => {
    setShowSuccessDialog(false);
    if (savedSessionStart && categoryId) {
      // KRITIČNO: ?categoryId= mora biti u URL-u da EditActivityPage filtrira samo
      // leaf evente. Bez toga vraćaju se i parent i leaf eventi (isti session_start)
      // → Edit prikazuje 2 eventa umjesto 1 (ADD-ACTIVITY-BUG fix).
      navigate(`/app/edit/${encodeURIComponent(savedSessionStart)}?categoryId=${categoryId}`);
    } else if (savedSessionStart) {
      navigate(`/app/edit/${encodeURIComponent(savedSessionStart)}`);
    } else {
      navigate('/app');
    }
  }, [navigate, savedSessionStart, categoryId]);

  // ============================================
  // Cancel Handler
  // ============================================

  const handleCancel = useCallback(() => {
    if (pendingEvents.length > 0 || canSave) {
      setShowCancelDialog(true);
    } else {
      clearDraft();
      navigate('/app');
    }
  }, [pendingEvents.length, canSave, clearDraft, navigate]);

  const handleConfirmCancel = useCallback(() => {
    log('Cancelling session');
    clearDraft();
    setShowCancelDialog(false);
    navigate('/app');
  }, [clearDraft, navigate, log]);

  // ============================================
  // Render
  // ============================================

  // Show nothing while checking for draft
  if (!isInitialized && !showResumeDialog && !showDiscardDialog) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      {/* Resume Dialog */}
      <ResumeDialog
        open={showResumeDialog}
        age={draftSummary?.age || ''}
        categoryPath={draftSummary?.categoryPath || ''}
        eventCount={draftSummary?.eventCount || 0}
        photoCount={draftSummary?.photoCount || 0}
        onResume={handleResumeDraft}
        onDiscard={handleDiscardDraft}
      />
      
      {/* Discard Draft Confirmation */}
      <DiscardDraftDialog
        open={showDiscardDialog}
        eventCount={draftSummary?.eventCount || 0}
        photoCount={draftSummary?.photoCount || 0}
        onConfirm={handleConfirmDiscard}
        onCancel={() => {
          setShowDiscardDialog(false);
          setShowResumeDialog(true);
        }}
      />
      
      {/* Cancel Confirmation */}
      <CancelDialog
        open={showCancelDialog}
        eventCount={pendingEvents.length}
        photoCount={totalPhotoCount}
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelDialog(false)}
      />
      
      {/* Finish Success Dialog */}
      <FinishSuccessDialog
        open={showSuccessDialog}
        eventCount={pendingEvents.length + (canSave ? 1 : 0)}
        onEdit={handleEditAfterFinish}
        onGoHome={handleGoHome}
      />
      
      {/* Debug Panel */}
      {showDebug && (
        <div className="fixed bottom-0 left-0 right-0 bg-black text-green-400 text-xs font-mono p-2 max-h-48 overflow-auto z-50 border-t-2 border-yellow-500">
          <div className="flex justify-between items-center mb-1 sticky top-0 bg-black pb-1">
            <span className="text-yellow-400 font-bold">DEBUG (?debug=true)</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setLogs(getPersistedLogs())}
                className="text-blue-400 hover:text-blue-300 px-2"
              >
                [↻]
              </button>
              <button 
                onClick={() => { clearPersistedLogs(); setLogs([]); }}
                className="text-orange-400 hover:text-orange-300 px-2"
              >
                [Clear]
              </button>
              <button 
                onClick={() => {
                  setShowDebug(false);
                  localStorage.removeItem('et_debug');
                }}
                className="text-red-400 hover:text-red-300 px-2"
              >
                [X]
              </button>
            </div>
          </div>
          <div className="text-gray-500 mb-1">Last {logs.length} entries:</div>
          {logs.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
          {renderError && (
            <div className="text-red-400 mt-2">RENDER ERROR: {renderError}</div>
          )}
        </div>
      )}
      
      {/* Header */}
      <ActivityHeader
        ref={headerRef}
        mode="add"
        categoryPath={categoryPath.length > 0 ? categoryPath : categoryChain.map(c => c.name).reverse()}
        sessionElapsed={elapsed}
        lapElapsed={lapElapsed}
        onCancel={handleCancel}
        onSave={handleFinish}
        onSaveContinue={handleSaveContinue}
        canSave={canFinish}
        saving={saving}
        pendingEventCount={pendingEvents.length}
      />
      
      {/* Main form - DA1: dinamički padding prema izmjerenoj visini headera */}
      <div
        className="max-w-2xl mx-auto px-4 pb-4"
        style={{ paddingTop: `${headerHeight + 12}px` }}
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* A2: ShortcutsBar REMOVED - category is locked from navigation */}
          {/* A3: Redundant locked category display REMOVED - already shown in header */}
          
          {/* Event info banner - shows current event number being created */}
          {categoryId && (
            <div className="px-3 pt-3 pb-1">
              <div className="text-sm text-gray-500">
                Event #{pendingEvents.length + 1} · in progress
              </div>
            </div>
          )}
          
          {/* Attributes section - pt-2 since we have event info banner above */}
          <div className="px-3 pt-2 pb-3">
            {(chainError || attributesError || renderError) && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {chainError && <p>Chain error: {chainError.message}</p>}
                {attributesError && <p>Attributes error: {attributesError.message}</p>}
                {renderError && <p>Render error: {renderError}</p>}
              </div>
            )}
            
            {(chainLoading || attributesLoading) ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                <span className="ml-2 text-gray-500 text-sm">Loading...</span>
              </div>
            ) : categoryId ? (
              categoryChain.length > 0 ? (
                <ErrorBoundary onError={(err) => log(`RENDER ERROR: ${err.message}`)}>
                  <AttributeChainForm
                    categoryChain={categoryChain}
                    attributesByCategory={attributesByCategory}
                    values={attributeValues}
                    onChange={handleAttributeChange}
                    onTouch={handleAttributeTouch}
                    disabled={saving}
                    expandedByDefault={false}
                    onDefinitionUpdated={refetchAttributes}
                  />
                </ErrorBoundary>
              ) : (
                <div className="text-center py-6 text-amber-600 text-sm">
                  ⚠️ Category chain is empty. Check RLS policies.
                </div>
              )
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                No category selected
              </div>
            )}
          </div>
          
          {/* A6: Event Note - MOVED ABOVE Photos */}
          {categoryId && (
            <div className="px-3 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Event Note
                <span className="font-normal text-gray-400 ml-2 text-xs">optional, resets after save</span>
              </label>
              <input
                type="text"
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                disabled={saving}
                placeholder="e.g., Felt strong today"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
          )}
          
          {/* Photo Gallery - mobitel: prednja kamera, desktop: galerija */}
          {categoryId && (
            <div className="px-3 pb-3">
              <PhotoGallery
                photos={currentPhotos}
                onPhotosChange={handlePhotosChange}
                disabled={saving}
                captureMode={isMobile ? 'user' : undefined}
              />
            </div>
          )}
          
          {/* Session Log - moved below Photos, newest event on top */}
          {pendingEvents.length > 0 && (
            <div className="px-3 pb-3">
              <SessionLog 
                savedEvents={[...pendingEvents].reverse().map(e => ({
                  eventId: e.tempId,
                  categoryName: leafCategoryName,
                  createdAt: e.createdAt,
                  summary: e.attributes
                    .slice(0, 3)
                    .map(a => String(a.value))
                    .join(', '),
                  hasPhoto: e.photos.length > 0,
                }))} 
              />
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mx-3 mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
