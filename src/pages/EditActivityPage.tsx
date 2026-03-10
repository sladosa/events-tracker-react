/**
 * EditActivityPage
 * 
 * Edit existing activity (events grouped by session_start)
 * 
 * Key features:
 * - Load existing events from database by sessionStart URL param
 * - ActivityHeader with mode="edit" (amber theme)
 * - Editable Date/Time
 * - Copy/Delete event functionality
 * - Save updates back to database
 * 
 * Entry: Activities table → ⋮ menu → Edit
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { VALUE_COLUMNS } from '@/lib/constants';
import { useCategoryChain } from '@/hooks/useCategoryChain';
import { useAttributeDefinitions } from '@/hooks/useAttributeDefinitions';

import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { AttributeChainForm } from '@/components/activity/AttributeChainForm';
import { PhotoGallery } from '@/components/activity/PhotoGallery';
import { CancelDialog } from '@/components/activity/ConfirmDialog';

import type { UUID } from '@/types';
import type {
  PendingEvent,
  PendingPhoto,
  ExistingPhoto,
  AttributeValue,
} from '@/types/activity';

// ============================================
// Types
// ============================================

interface LoadedEvent {
  id: UUID;
  category_id: UUID;
  event_date: string;
  session_start: string;
  comment: string | null;
  created_at: string;
  edited_at: string;
}

interface LoadedAttribute {
  id: UUID;
  attribute_definition_id: UUID;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
  attribute_definitions: {
    id: UUID;
    name: string;
    data_type: string;
    category_id: UUID;
  } | null;
}

interface LoadedAttachment {
  id: UUID;
  event_id: UUID;
  url: string;
  filename: string | null;
}

interface LocalAttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  touched: boolean;
}

// ============================================
// Main Component
// ============================================

export function EditActivityPage() {
  const navigate = useNavigate();
  const { sessionStart } = useParams<{ sessionStart: string }>();
  const [searchParams] = useSearchParams();
  const categoryIdParam = searchParams.get('categoryId') as UUID | null;
  const noSession = searchParams.get('noSession') === '1';
  
  // ============================================
  // EDIT-P2: Parent Events State
  // Parent eventi (Activity, Gym) su dijeljeni po sesiji.
  // parentDbIds: categoryId → dbId | null (null = ne postoji u bazi, treba INSERT)
  // parentAttrValues: definitionId → LocalAttributeValue (dijeljeni za sve tab)
  // ============================================
  
  const [parentDbIds, setParentDbIds] = useState<Map<string, UUID | null>>(new Map());
  const [parentAttrValues, setParentAttrValues] = useState<Map<string, LocalAttributeValue>>(new Map());
  // Ref za sync pristup bez dependency hell u useCallback
  const parentAttrValuesRef = useRef<Map<string, LocalAttributeValue>>(new Map());
  
  // ============================================
  // Loading State
  // ============================================
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // ============================================
  // Activity Data
  // ============================================
  
  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [sessionDateTime, setSessionDateTime] = useState<Date>(new Date());
  const [originalDateTime, setOriginalDateTime] = useState<Date>(new Date());
  const [, setOriginalEventIds] = useState<UUID[]>([]);
  
  // Events being edited
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  
  // Current form state (for the selected event)
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [attributeValues, setAttributeValues] = useState<Map<string, LocalAttributeValue>>(new Map());
  const [eventNote, setEventNote] = useState('');
  const [currentPhotos, setCurrentPhotos] = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // DA1: Dynamički mjerimo visinu headera da izbjegnemo preklapanje
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
  
  // ============================================
  // Load Activity Data
  // ============================================
  
  useEffect(() => {
    if (!sessionStart) {
      navigate('/app', { replace: true });
      return;
    }
    
    loadActivityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStart]);
  
  const loadActivityData = async () => {
    if (!sessionStart) return;
    
    setIsLoading(true);
    setLoadError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      let leafEvents: LoadedEvent[];
      let decodedSessionStart: string;
      
      if (noSession) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, category_id, event_date, session_start, comment, created_at, edited_at')
          .eq('id', sessionStart)
          .eq('user_id', user.id);
        if (eventsError) throw eventsError;
        if (!eventsData || eventsData.length === 0) throw new Error('Activity not found');
        leafEvents = eventsData as LoadedEvent[];
        decodedSessionStart = leafEvents[0].session_start;
      } else {
        decodedSessionStart = decodeURIComponent(sessionStart);
        let query = supabase
          .from('events')
          .select('id, category_id, event_date, session_start, comment, created_at, edited_at')
          .eq('session_start', decodedSessionStart)
          .eq('user_id', user.id);
        // KRITIČNO: filter by category_id to avoid returning wrong activity
        if (categoryIdParam) {
          query = query.eq('category_id', categoryIdParam);
        }
        const { data: eventsData, error: eventsError } = await query
          .order('created_at', { ascending: true });
        if (eventsError) throw eventsError;
        if (!eventsData || eventsData.length === 0) throw new Error('Activity not found');
        leafEvents = eventsData as LoadedEvent[];
      }
      
      const leafCategoryId = leafEvents[leafEvents.length - 1].category_id;
      setCategoryId(leafCategoryId);
      
      const path = await buildCategoryPath(leafCategoryId);
      setCategoryPath(path);
      
      const sessionDate = noSession
        ? new Date(leafEvents[0].created_at)
        : new Date(decodedSessionStart);
      setSessionDateTime(sessionDate);
      setOriginalDateTime(sessionDate);
      setOriginalEventIds(leafEvents.map(e => e.id));
      
      // --- Load leaf events → pendingEvents ---
      const pendingEventsData: PendingEvent[] = [];
      
      for (const event of leafEvents) {
        const { data: attrs } = await supabase
          .from('event_attributes')
          .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
          .eq('event_id', event.id);
        
        const loadedAttrs = (attrs || []) as unknown as LoadedAttribute[];
        
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('id, event_id, url, filename')
          .eq('event_id', event.id)
          .eq('type', 'image');
        
        const loadedAttachments = (attachments || []) as LoadedAttachment[];
        
        const attributes: AttributeValue[] = loadedAttrs
          .filter(attr => attr.attribute_definitions !== null)
          .map(attr => {
            let value: string | number | boolean | null = null;
            const dataType = attr.attribute_definitions!.data_type;
            if (dataType === 'number' && attr.value_number !== null) value = attr.value_number;
            else if (dataType === 'boolean' && attr.value_boolean !== null) value = attr.value_boolean;
            else if (dataType === 'datetime' && attr.value_datetime !== null) value = attr.value_datetime;
            else if (attr.value_text !== null) value = attr.value_text;
            return {
              definitionId: attr.attribute_definition_id,
              value,
              dataType: dataType as 'text' | 'number' | 'boolean' | 'datetime',
              touched: true,
            };
          });
        
        const existingPhotosList: ExistingPhoto[] = loadedAttachments.map(att => ({
          id: att.id,
          url: att.url,
          filename: att.filename || undefined,
        }));
        
        pendingEventsData.push({
          tempId: `db_${event.id}`,
          dbId: event.id,
          categoryId: event.category_id,
          createdAt: new Date(event.created_at),
          attributes,
          note: event.comment,
          photos: [],
          existingPhotos: existingPhotosList,
          photosToDelete: [],
          isModified: false,
          isNew: false,
          isDeleted: false,
        });
      }
      
      setPendingEvents(pendingEventsData);
      
      // ============================================================
      // EDIT-P2: Load parent events (Activity, Gym itd.)
      // Chain disambiguation: za svaki parent, tražimo event koji ima
      // sibling child u NAŠEM lancu (ne u nekom drugom lancu koji
      // dijeli isti session_start). Ovo sprječava mješanje Activity
      // evenata koji dijele session_start ali imaju različite lance.
      // ============================================================
      const parentChainIds: UUID[] = [];
      let currentParentId: UUID | null = null;

      const { data: leafCatData } = await supabase
        .from('categories')
        .select('parent_category_id')
        .eq('id', leafCategoryId)
        .single() as { data: { parent_category_id: string | null } | null };

      currentParentId = (leafCatData?.parent_category_id as UUID | null) ?? null;

      while (currentParentId) {
        parentChainIds.push(currentParentId);
        const { data: parentCatRow } = await supabase
          .from('categories')
          .select('parent_category_id')
          .eq('id', currentParentId)
          .single() as { data: { parent_category_id: string | null } | null };
        currentParentId = (parentCatRow?.parent_category_id as UUID | null) ?? null;
      }

      const newParentDbIds = new Map<string, UUID | null>();
      const newParentAttrValues = new Map<string, LocalAttributeValue>();

      for (const catId of parentChainIds) {
        newParentDbIds.set(catId, null);
      }

      if (parentChainIds.length > 0) {
        // parentChainIds je [Gym, Activity, ...] (leaf→root redosljed)
        // BUG-G fix: koristimo LEAF kao disambiguator, ne immediate child.
        // Isti princip kao ViewDetailsPage i excelImport — leaf je jedini
        // ID koji je unique po sesiji.
        for (let i = 0; i < parentChainIds.length; i++) {
          const catId = parentChainIds[i];

          // Fetch svi kandidati za ovaj parent category + session_start
          const { data: candidates } = await supabase
            .from('events')
            .select('id')
            .eq('user_id', user.id)
            .eq('category_id', catId)
            .eq('session_start', decodedSessionStart);

          if (!candidates || candidates.length === 0) continue;

          let parentEventId: UUID | null = null;

          // Uvijek disambiguiraj putem leafa — čak i kad je samo 1 kandidat.
          const { data: leafCheck } = await supabase
            .from('events')
            .select('id')
            .eq('user_id', user.id)
            .eq('category_id', leafCategoryId)
            .eq('session_start', decodedSessionStart)
            .limit(1);

          if (leafCheck && leafCheck.length > 0) {
            parentEventId = (candidates[0] as { id: UUID }).id;
          }

          if (!parentEventId) continue;

          newParentDbIds.set(catId, parentEventId);

          const { data: parentAttrs } = await supabase
            .from('event_attributes')
            .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
            .eq('event_id', parentEventId);

          for (const attr of (parentAttrs || []) as unknown as LoadedAttribute[]) {
            if (!attr.attribute_definitions) continue;
            const dataType = attr.attribute_definitions.data_type;
            let value: string | number | boolean | null = null;
            if (dataType === 'number' && attr.value_number !== null) value = attr.value_number;
            else if (dataType === 'boolean' && attr.value_boolean !== null) value = attr.value_boolean;
            else if (dataType === 'datetime' && attr.value_datetime !== null) value = attr.value_datetime;
            else if (attr.value_text !== null) value = attr.value_text;
            if (value !== null) {
              newParentAttrValues.set(attr.attribute_definition_id, {
                definitionId: attr.attribute_definition_id,
                value,
                touched: true,
              });
            }
          }
        }
      }
      
      setParentDbIds(newParentDbIds);
      setParentAttrValues(newParentAttrValues);
      parentAttrValuesRef.current = newParentAttrValues;
      
      // Initialize form: merge parent + leaf attrs for first event
      if (pendingEventsData.length > 0) {
        selectEventWithParent(0, pendingEventsData, newParentAttrValues);
      }
      
    } catch (err) {
      console.error('Failed to load activity:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Build Category Path
  // ============================================
  
  const buildCategoryPath = async (catId: UUID): Promise<string[]> => {
    const path: string[] = [];
    let currentId: UUID | null = catId;
    let areaId: UUID | null = null;
    
    while (currentId) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, parent_category_id, area_id')
        .eq('id', currentId)
        .single() as { data: { id: string; name: string; parent_category_id: string | null; area_id: string | null } | null };
      
      if (!cat) break;
      
      path.unshift(cat.name);
      if (cat.area_id) areaId = cat.area_id;
      currentId = cat.parent_category_id;
    }
    
    // Add area name
    if (areaId) {
      const { data: area } = await supabase
        .from('areas')
        .select('name')
        .eq('id', areaId)
        .single();
      
      if (area) {
        path.unshift(area.name);
      }
    }
    
    return path;
  };
  
  // ============================================
  // Select Event (Switch between events in session)
  // ============================================
  
  // selectEventWithParent: koristi se pri loadu (parent attrs dostupni kao parametar)
  const selectEventWithParent = useCallback((
    index: number,
    events: PendingEvent[],
    parentAttrs: Map<string, LocalAttributeValue>
  ) => {
    if (index < 0 || index >= events.length) return;
    const event = events[index];
    setSelectedEventIndex(index);
    
    // Merge: parent attrs (dijeljeni) + leaf attrs (per event)
    const attrMap = new Map<string, LocalAttributeValue>(parentAttrs);
    event.attributes.forEach(attr => {
      attrMap.set(attr.definitionId, {
        definitionId: attr.definitionId,
        value: attr.value,
        touched: attr.touched,
      });
    });
    setAttributeValues(attrMap);
    setEventNote(event.note || '');
    setCurrentPhotos(event.photos);
    setExistingPhotos(event.existingPhotos);
  }, []);

  // selectEvent: koristi se pri tab switch (parent attrs iz ref-a)
  const selectEvent = useCallback((index: number, events?: PendingEvent[]) => {
    const eventsList = events || pendingEvents;
    if (index < 0 || index >= eventsList.length) return;
    const event = eventsList[index];
    setSelectedEventIndex(index);
    
    // Merge: parent attrs iz ref (sync, bez dep) + leaf attrs
    const attrMap = new Map<string, LocalAttributeValue>(parentAttrValuesRef.current);
    event.attributes.forEach(attr => {
      attrMap.set(attr.definitionId, {
        definitionId: attr.definitionId,
        value: attr.value,
        touched: attr.touched,
      });
    });
    setAttributeValues(attrMap);
    setEventNote(event.note || '');
    setCurrentPhotos(event.photos);
    setExistingPhotos(event.existingPhotos);
  }, [pendingEvents]);
  
  
  // ============================================
  // Category Chain & Attributes
  // ============================================
  
  const { chain: categoryChain, loading: chainLoading, error: chainError } = useCategoryChain(categoryId);
  
  const chainCategoryIds = useMemo(() => {
    return categoryChain.map(c => c.id);
  }, [categoryChain]);
  
  const { 
    attributesByCategory, 
    loading: attributesLoading,
    error: attributesError,
    refetch: refetchAttributes,
  } = useAttributeDefinitions(chainCategoryIds);
  
  // ============================================
  // Form Handlers
  // ============================================
  
  const handleAttributeChange = useCallback((definitionId: string, value: string | number | boolean | null) => {
    // Uvijek update flat attributeValues map (UI prikaz)
    setAttributeValues(prev => {
      const next = new Map(prev);
      next.set(definitionId, { definitionId, value, touched: true });
      return next;
    });
    setIsDirty(true);
    
    // EDIT-P2: Determiniraj pripada li attr leaf ili parent kategoriji
    // Leaf attr → update pendingEvent[selectedEventIndex]
    // Parent attr → update parentAttrValues (dijeljeni za sve tabove)
    const leafAttrDefs = categoryId ? (attributesByCategory.get(categoryId) || []) : [];
    const isLeafAttr = leafAttrDefs.some(d => d.id === definitionId);
    
    if (isLeafAttr) {
      // Update leaf pending event (kao prije)
      setPendingEvents(prev => {
        const next = [...prev];
        const event = next[selectedEventIndex];
        if (event) {
          const attrIndex = event.attributes.findIndex(a => a.definitionId === definitionId);
          if (attrIndex >= 0) {
            event.attributes[attrIndex] = {
              ...event.attributes[attrIndex],
              value,
              touched: true,
            };
          } else {
            event.attributes.push({
              definitionId,
              value,
              dataType: 'text',
              touched: true,
            });
          }
          event.isModified = true;
        }
        return next;
      });
    } else {
      // Update parent attrs (dijeljeni za cijelu sesiju)
      setParentAttrValues(prev => {
        const next = new Map(prev);
        next.set(definitionId, { definitionId, value, touched: true });
        parentAttrValuesRef.current = next;
        return next;
      });
    }
  }, [selectedEventIndex, categoryId, attributesByCategory]);
  
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
  
  const handleNoteChange = useCallback((note: string) => {
    setEventNote(note);
    setIsDirty(true);
    
    // Update the pending event
    setPendingEvents(prev => {
      const next = [...prev];
      const event = next[selectedEventIndex];
      if (event) {
        event.note = note.trim() || null;
        event.isModified = true;
      }
      return next;
    });
  }, [selectedEventIndex]);
  
  const handlePhotosChange = useCallback((photos: PendingPhoto[]) => {
    setCurrentPhotos(photos);
    setIsDirty(true);
    
    // Update the pending event
    setPendingEvents(prev => {
      const next = [...prev];
      const event = next[selectedEventIndex];
      if (event) {
        event.photos = photos;
        event.isModified = true;
      }
      return next;
    });
  }, [selectedEventIndex]);
  
  const handleDeleteExistingPhoto = useCallback((photoId: UUID) => {
    setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
    setIsDirty(true);
    
    // Mark photo for deletion
    setPendingEvents(prev => {
      const next = [...prev];
      const event = next[selectedEventIndex];
      if (event) {
        event.existingPhotos = event.existingPhotos.filter(p => p.id !== photoId);
        event.photosToDelete.push(photoId);
        event.isModified = true;
      }
      return next;
    });
  }, [selectedEventIndex]);
  
  // ============================================
  // Date/Time Change Handler
  // ============================================
  
  const handleDateTimeChange = useCallback((newDateTime: Date) => {
    setSessionDateTime(newDateTime);
    setIsDirty(true);
    
    // Calculate time delta
    const deltaMs = newDateTime.getTime() - originalDateTime.getTime();
    
    // Shift all event times by the delta
    setPendingEvents(prev => {
      return prev.map(event => ({
        ...event,
        createdAt: new Date(event.createdAt.getTime() + deltaMs),
        isModified: true,
      }));
    });
  }, [originalDateTime]);
  
  // ============================================
  // Copy Event Handler
  // ============================================
  
  const handleCopyEvent = useCallback((index: number) => {
    setPendingEvents(prev => {
      const eventToCopy = prev[index];
      if (!eventToCopy) return prev;
      
      const newEvent: PendingEvent = {
        tempId: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        categoryId: eventToCopy.categoryId,
        // P2.1: +1 sekunda za ispravnu sekvencu u sessiji
        createdAt: new Date(eventToCopy.createdAt.getTime() + 1000),
        attributes: eventToCopy.attributes.map(a => ({ ...a, touched: true })),
        note: eventToCopy.note ? `${eventToCopy.note} (copy)` : 'Copied',
        photos: [], // Don't copy photos
        existingPhotos: [],
        photosToDelete: [],
        isModified: true,
        isNew: true,
        isDeleted: false,
      };
      
      // Insert after the copied event
      const next = [...prev];
      next.splice(index + 1, 0, newEvent);
      return next;
    });
    
    setIsDirty(true);
    
    // Select the new event
    setSelectedEventIndex(index + 1);
  }, []);
  
  // ============================================
  // Delete Event Handler
  // ============================================
  
  const handleDeleteEvent = useCallback((index: number) => {
    setPendingEvents(prev => {
      const next = [...prev];
      const event = next[index];
      if (event) {
        if (event.isNew) {
          // Remove new events entirely
          next.splice(index, 1);
        } else {
          // Mark existing events for deletion
          event.isDeleted = true;
          event.isModified = true;
        }
      }
      return next;
    });
    
    setIsDirty(true);
    
    // Adjust selected index if needed
    if (selectedEventIndex >= pendingEvents.length - 1) {
      setSelectedEventIndex(Math.max(0, selectedEventIndex - 1));
    }
  }, [selectedEventIndex, pendingEvents.length]);
  
  // ============================================
  // Restore Event Handler
  // ============================================
  
  const handleRestoreEvent = useCallback((index: number) => {
    setPendingEvents(prev => {
      const next = [...prev];
      const event = next[index];
      if (event) {
        event.isDeleted = false;
      }
      return next;
    });
    
    setIsDirty(true);
  }, []);
  
  // ============================================
  // Computed Values
  // ============================================
  
  const activeEvents = useMemo(() => {
    return pendingEvents.filter(e => !e.isDeleted);
  }, [pendingEvents]);
  
  const totalDuration = useMemo(() => {
    if (activeEvents.length === 0) return 0;
    
    const first = activeEvents[0];
    const last = activeEvents[activeEvents.length - 1];
    
    return Math.floor((last.createdAt.getTime() - first.createdAt.getTime()) / 1000);
  }, [activeEvents]);
  
  const canSave = useMemo(() => {
    return isDirty && activeEvents.length > 0;
  }, [isDirty, activeEvents.length]);
  
  // ============================================
  // Save Handler
  // ============================================
  
  const handleSave = async () => {
    if (!canSave || !categoryId) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const newSessionStart = sessionDateTime.toISOString();
      const eventDate = sessionDateTime.toISOString().split('T')[0];

      // ── Collision check ──────────────────────────────────────────
      // Provjeri postoji li već druga aktivnost s istim lancem i
      // istim session_start (može se desiti promjenom date/time pickera).
      // Isključujemo vlastite leaf evente (isti dbId).
      const ownLeafIds = pendingEvents
        .filter(e => e.dbId && !e.isNew)
        .map(e => e.dbId!);

      const { data: collision } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('session_start', newSessionStart)
        .not('id', 'in', `(${ownLeafIds.join(',')})`)
        .limit(1);

      if (collision && collision.length > 0) {
        const collisionMsg = 'Same area-category chain and session start are not allowed. Please change the date or time.';
        setError(collisionMsg);
        toast.error(collisionMsg, { duration: 6000 });
        setSaving(false);
        return;
      }
      // ────────────────────────────────────────────────────────────
      
      // Separate events by status
      const toUpdate = pendingEvents.filter(e => e.isModified && !e.isNew && !e.isDeleted && e.dbId);
      const toInsert = pendingEvents.filter(e => e.isNew && !e.isDeleted);
      const toDelete = pendingEvents.filter(e => e.isDeleted && e.dbId);
      
      // 1. Delete marked events
      for (const event of toDelete) {
        if (event.dbId) {
          // Delete attributes first
          await supabase
            .from('event_attributes')
            .delete()
            .eq('event_id', event.dbId);
          
          // Delete attachments
          await supabase
            .from('event_attachments')
            .delete()
            .eq('event_id', event.dbId);
          
          // Delete event
          await supabase
            .from('events')
            .delete()
            .eq('id', event.dbId);
        }
      }
      
      // 2. Update modified events
      for (const event of toUpdate) {
        if (!event.dbId) continue;
        
        // Update event record
        const { error: updateError } = await supabase
          .from('events')
          .update({
            event_date: eventDate,
            session_start: newSessionStart,
            comment: event.note,
            edited_at: new Date().toISOString(),
            // P2: created_at se ažurira zajedno s pomakom datuma/vremena
            created_at: event.createdAt.toISOString(),
          })
          .eq('id', event.dbId);
        
        if (updateError) throw updateError;
        
        // Delete old attributes and insert new ones
        await supabase
          .from('event_attributes')
          .delete()
          .eq('event_id', event.dbId);
        
        // FIX: Save ALL non-null attributes, not just touched ones.
        // Previously, only touched=true attrs were saved → delete+reinsert loop
        // destroyed DB-loaded attributes (touched=false) that user never modified.
        const attrsToSave = event.attributes.filter(a => a.value != null);
        if (attrsToSave.length > 0) {
          const attrDefs = attributesByCategory.get(event.categoryId) || [];
          const attributeRecords = attrsToSave.map(attr => {
            const def = attrDefs.find(d => d.id === attr.definitionId);
            // Fallback to attr.dataType (loaded from DB) if def not in chain yet
            const valueColumn = def
              ? VALUE_COLUMNS[def.data_type] || 'value_text'
              : VALUE_COLUMNS[attr.dataType] || 'value_text';
            
            return {
              event_id: event.dbId,
              user_id: user.id,
              attribute_definition_id: attr.definitionId,
              [valueColumn]: attr.value,
            };
          });
          
          await supabase.from('event_attributes').insert(attributeRecords);
        }
        
        // Handle photos to delete (from both database and storage)
        for (const photoId of event.photosToDelete) {
          try {
            // First get the attachment to find the storage path
            const { data: attachment } = await supabase
              .from('event_attachments')
              .select('url')
              .eq('id', photoId)
              .single();
            
            if (attachment?.url) {
              // Extract file path from URL
              // URL format: https://xxx.supabase.co/storage/v1/object/public/activity-attachments/user_id/event_id_photo_id.jpg
              const urlParts = attachment.url.split('/activity-attachments/');
              if (urlParts.length > 1) {
                const filePath = urlParts[1];
                // Delete from storage
                await supabase.storage
                  .from('activity-attachments')
                  .remove([filePath]);
              }
            }
            
            // Delete the database record
            await supabase
              .from('event_attachments')
              .delete()
              .eq('id', photoId);
          } catch (deleteErr) {
            console.error('Failed to delete photo:', deleteErr);
          }
        }
        
        // Handle new photos
        for (const photo of event.photos) {
          try {
            const base64Data = photo.base64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            const fileName = `${user.id}/${event.dbId}_${photo.id}.jpg`;
            await supabase.storage
              .from('activity-attachments')
              .upload(fileName, blob);
            
            const { data: urlData } = supabase.storage
              .from('activity-attachments')
              .getPublicUrl(fileName);
            
            await supabase.from('event_attachments').insert({
              event_id: event.dbId,
              user_id: user.id,
              type: 'image',
              url: urlData.publicUrl,
              filename: photo.filename,
              size_bytes: photo.sizeBytes,
            });
          } catch (photoErr) {
            console.error('Failed to upload photo:', photoErr);
          }
        }
      }
      
      // 3. Insert new events
      for (const event of toInsert) {
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            category_id: event.categoryId,
            event_date: eventDate,
            session_start: newSessionStart,
            comment: event.note,
            created_at: event.createdAt.toISOString(),
          })
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        
        // Insert attributes (all non-null - copied events have touched:true already)
        const attrsToSave = event.attributes.filter(a => a.value != null);
        if (attrsToSave.length > 0) {
          const attrDefs = attributesByCategory.get(event.categoryId) || [];
          const attributeRecords = attrsToSave.map(attr => {
            const def = attrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def
              ? VALUE_COLUMNS[def.data_type] || 'value_text'
              : VALUE_COLUMNS[attr.dataType] || 'value_text';
            
            return {
              event_id: newEvent.id,
              user_id: user.id,
              attribute_definition_id: attr.definitionId,
              [valueColumn]: attr.value,
            };
          });
          
          await supabase.from('event_attributes').insert(attributeRecords);
        }
        
        // Handle photos
        for (const photo of event.photos) {
          try {
            const base64Data = photo.base64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            const fileName = `${user.id}/${newEvent.id}_${photo.id}.jpg`;
            await supabase.storage
              .from('activity-attachments')
              .upload(fileName, blob);
            
            const { data: urlData } = supabase.storage
              .from('activity-attachments')
              .getPublicUrl(fileName);
            
            await supabase.from('event_attachments').insert({
              event_id: newEvent.id,
              user_id: user.id,
              type: 'image',
              url: urlData.publicUrl,
              filename: photo.filename,
              size_bytes: photo.sizeBytes,
            });
          } catch (photoErr) {
            console.error('Failed to upload photo:', photoErr);
          }
        }
      }
      
      // ============================================================
      // EDIT-P2: Upsert parent eventi (Activity, Gym itd.)
      // Za svaku parent kategoriju: UPDATE ako postoji, INSERT ako ne.
      // Koristimo parentAttrValues (dijeljeni za cijelu sesiju).
      // ============================================================
      for (const [catId, dbId] of parentDbIds) {
        const catAttrDefs = attributesByCategory.get(catId) || [];
        // Filtriraj atribute koji pripadaju ovoj kategoriji i imaju vrijednost
        const attrsForCat = catAttrDefs
          .map(def => parentAttrValues.get(def.id))
          .filter((v): v is LocalAttributeValue => v != null && v.value != null);
        
        if (dbId) {
          // UPDATE postojećeg parent eventa
          const { error: parentUpdateError } = await supabase
            .from('events')
            .update({
              event_date: eventDate,
              session_start: newSessionStart,
              edited_at: new Date().toISOString(),
            })
            .eq('id', dbId);
          
          if (parentUpdateError) throw parentUpdateError;
          
          // Delete + reinsert parent attrs
          await supabase.from('event_attributes').delete().eq('event_id', dbId);
          
          if (attrsForCat.length > 0) {
            const parentAttrRecords = attrsForCat.map(attr => {
              const def = catAttrDefs.find(d => d.id === attr.definitionId);
              const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
              return {
                event_id: dbId,
                user_id: user.id,
                attribute_definition_id: attr.definitionId,
                [valueColumn]: attr.value,
              };
            });
            const { error: parentAttrErr } = await supabase
              .from('event_attributes')
              .insert(parentAttrRecords);
            if (parentAttrErr) throw parentAttrErr;
          }
        } else if (attrsForCat.length > 0) {
          // INSERT novi parent event (nije postojao)
          const { data: newParentEvent, error: newParentError } = await supabase
            .from('events')
            .insert({
              user_id: user.id,
              category_id: catId,
              event_date: eventDate,
              session_start: newSessionStart,
              comment: null,
              created_at: sessionDateTime.toISOString(),
            })
            .select('id')
            .single();
          
          if (newParentError) throw newParentError;
          
          const parentAttrRecords = attrsForCat.map(attr => {
            const def = catAttrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
            return {
              event_id: newParentEvent.id,
              user_id: user.id,
              attribute_definition_id: attr.definitionId,
              [valueColumn]: attr.value,
            };
          });
          const { error: newParentAttrErr } = await supabase
            .from('event_attributes')
            .insert(parentAttrRecords);
          if (newParentAttrErr) throw newParentAttrErr;
          
          // Ažuriraj parentDbIds s novim ID-em
          setParentDbIds(prev => {
            const next = new Map(prev);
            next.set(catId, newParentEvent.id as UUID);
            return next;
          });
        }
      }
      
      // Success! Navigate to View Details
      if (sessionStart) {
        const encodedNew = encodeURIComponent(newSessionStart);
        if (noSession) {
          navigate(`/app/view/${encodedNew}?noSession=1${categoryIdParam ? `&categoryId=${categoryIdParam}` : ''}`);
        } else {
          navigate(`/app/view/${encodedNew}${categoryIdParam ? `?categoryId=${categoryIdParam}` : ''}`);
        }
      } else {
        navigate('/app');
      }
      
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  // ============================================
  // Cancel Handler
  // ============================================
  
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      // Build sessionKey for highlight: same format as useActivities groupMap
      const decodedStart = sessionStart ? decodeURIComponent(sessionStart) : null;
      const key = (decodedStart && categoryIdParam && !noSession)
        ? `${categoryIdParam}_${decodedStart}`
        : sessionStart ?? null;
      navigate('/app', { state: { highlightKey: key } });
    }
  }, [isDirty, navigate, sessionStart, categoryIdParam, noSession]);

  const handleViewMode = useCallback(() => {
    if (!sessionStart) return;
    if (noSession) {
      navigate(`/app/view/${sessionStart}?noSession=1${categoryIdParam ? `&categoryId=${categoryIdParam}` : ''}`);
    } else {
      navigate(`/app/view/${sessionStart}${categoryIdParam ? `?categoryId=${categoryIdParam}` : ''}`);
    }
  }, [sessionStart, noSession, categoryIdParam, navigate]);

  const handleConfirmCancel = useCallback(() => {
    setShowCancelDialog(false);
    const decodedStart = sessionStart ? decodeURIComponent(sessionStart) : null;
    const key = (decodedStart && categoryIdParam && !noSession)
      ? `${categoryIdParam}_${decodedStart}`
      : sessionStart ?? null;
    navigate('/app', { state: { highlightKey: key } });
  }, [navigate, sessionStart, categoryIdParam, noSession]);

  // ============================================
  // Delete Session Handler (Delete button u headeru)
  // ============================================

  const handleDeleteSession = useCallback(async () => {
    if (!sessionStart) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let eventIds: string[];

      if (noSession) {
        // No session_start: delete single event by ID (sessionStart param = eventId)
        eventIds = [sessionStart];
      } else {
        const decodedSessionStart = decodeURIComponent(sessionStart);
        let query = supabase
          .from('events')
          .select('id')
          .eq('session_start', decodedSessionStart)
          .eq('user_id', user.id);

        // KRITIČNO: filter by category_id to avoid deleting wrong activity
        if (categoryIdParam) {
          query = query.eq('category_id', categoryIdParam);
        }

        const { data: events } = await query;
        eventIds = events ? (events as { id: string }[]).map(e => e.id) : [];
      }

      if (eventIds.length > 0) {
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('url')
          .in('event_id', eventIds);

        if (attachments && attachments.length > 0) {
          const paths = (attachments as { url: string }[])
            .map(a => { const p = a.url.split('/activity-attachments/'); return p.length > 1 ? p[1] : null; })
            .filter((p): p is string => p !== null);
          if (paths.length > 0) {
            await supabase.storage.from('activity-attachments').remove(paths);
          }
        }

        await supabase.from('event_attachments').delete().in('event_id', eventIds);
        await supabase.from('event_attributes').delete().in('event_id', eventIds);
        await supabase.from('events').delete().in('id', eventIds);
        toast.success('Aktivnost obrisana');
      }
      navigate('/app');
    } catch (err) {
      console.error('Delete session failed:', err);
      toast.error('Brisanje nije uspjelo');
      setSaving(false);
    }
  }, [sessionStart, noSession, categoryIdParam, navigate]);
  
  // ============================================
  // Render - Loading State
  // ============================================
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading activity...</p>
        </div>
      </div>
    );
  }
  
  // ============================================
  // Render - Error State
  // ============================================
  
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load activity</h2>
          <p className="text-gray-500 mb-4">{loadError}</p>
          <button
            onClick={() => navigate('/app')}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  // ============================================
  // Render - Main
  // ============================================
  
  const currentEvent = pendingEvents[selectedEventIndex];
  
  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      {/* Cancel Confirmation Dialog */}
      <CancelDialog
        open={showCancelDialog}
        eventCount={activeEvents.filter(e => e.isModified || e.isNew).length}
        photoCount={activeEvents.reduce((count, e) => count + e.photos.length, 0)}
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelDialog(false)}
      />
      
      {/* Header */}
      <ActivityHeader
        ref={headerRef}
        mode="edit"
        categoryPath={categoryPath}
        dateTime={sessionDateTime}
        onDateTimeChange={handleDateTimeChange}
        totalDuration={totalDuration}
        onCancel={handleCancel}
        onSave={handleSave}
        onDeleteSession={handleDeleteSession}
        onViewMode={handleViewMode}
        canSave={canSave}
        saving={saving}
      />
      
      {/* Events List - DA1: dinamički padding prema izmjerenoj visini headera */}
      <div
        className="max-w-2xl mx-auto px-4 pb-4"
        style={{ paddingTop: `${headerHeight + 12}px` }}
      >
        {/* Error banner — shown at top so always visible without scrolling */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800">
                📋 {activeEvents.length} event{activeEvents.length !== 1 ? 's' : ''} in this session
              </span>
              {pendingEvents.some(e => e.isDeleted) && (
                <span className="text-xs text-red-500">
                  ({pendingEvents.filter(e => e.isDeleted).length} marked for deletion)
                </span>
              )}
            </div>
          </div>
          
          {/* Event Tabs */}
          <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b">
            {pendingEvents.map((event, index) => (
              <button
                key={event.tempId}
                onClick={() => {
                  if (event.isDeleted) {
                    // P1.2: Klik na deleted tab → automatski Restore (cool approach)
                    handleRestoreEvent(index);
                    selectEvent(index);
                  } else {
                    selectEvent(index);
                  }
                }}
                title={event.isDeleted ? '↩️ Klikni za Restore' : undefined}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  flex items-center gap-1.5
                  ${event.isDeleted
                    ? 'bg-red-100 text-red-500 line-through cursor-pointer hover:bg-red-200 hover:line-through ring-1 ring-red-300'
                    : index === selectedEventIndex
                      ? 'bg-amber-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }
                  ${event.isNew ? 'ring-2 ring-green-300' : ''}
                  ${event.isModified && !event.isNew && !event.isDeleted ? 'ring-2 ring-amber-300' : ''}
                `}
              >
                <span>#{index + 1}</span>
                {event.isNew && <span className="text-xs">✨</span>}
                {event.isDeleted && <span className="text-xs" title="Klikni za Restore">↩️</span>}
              </button>
            ))}
          </div>
          
          {/* Event Actions */}
          {currentEvent && !currentEvent.isDeleted && (
            <div className="flex items-center justify-end gap-2 px-3 py-2 bg-gray-50">
              <button
                onClick={() => handleCopyEvent(selectedEventIndex)}
                disabled={saving}
                className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
              >
                📋 Copy
              </button>
              <button
                onClick={() => handleDeleteEvent(selectedEventIndex)}
                disabled={saving || activeEvents.length <= 1}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title={activeEvents.length <= 1 ? 'Cannot delete the last event' : undefined}
              >
                🗑️ Delete
              </button>
            </div>
          )}
          
          {/* Restore button for deleted events */}
          {currentEvent?.isDeleted && (
            <div className="px-3 py-2 bg-red-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-600">This event is marked for deletion</span>
                <button
                  onClick={() => handleRestoreEvent(selectedEventIndex)}
                  className="px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                >
                  ↩️ Restore
                </button>
              </div>
            </div>
          )}
          
          {/* Category display REMOVED - already shown in header */}
          
          {/* Event info banner - shows event number and creation time */}
          {currentEvent && !currentEvent.isDeleted && (
            <div className="px-3 pt-3 pb-1">
              <div className="text-sm text-gray-500">
                Event #{selectedEventIndex + 1} · {(() => {
                  const d = currentEvent.createdAt;
                  const y = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, '0');
                  const dy = String(d.getDate()).padStart(2, '0');
                  const h = String(d.getHours()).padStart(2, '0');
                  const mi = String(d.getMinutes()).padStart(2, '0');
                  const sc = String(d.getSeconds()).padStart(2, '0');
                  return `${y}/${mo}/${dy} ${h}:${mi}:${sc}`;
                })()}
              </div>
            </div>
          )}
          
          {/* Attributes section - pt-3 needed to prevent leaf header from covering first attribute */}
          <div className="px-3 pb-3 pt-2">
            {(chainError || attributesError) && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {chainError && <p>Chain error: {chainError.message}</p>}
                {attributesError && <p>Attributes error: {attributesError.message}</p>}
              </div>
            )}
            
            {(chainLoading || attributesLoading) ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
                <span className="ml-2 text-gray-500 text-sm">Loading...</span>
              </div>
            ) : currentEvent && !currentEvent.isDeleted && categoryId ? (
              categoryChain.length > 0 ? (
                <AttributeChainForm
                  categoryChain={categoryChain}
                  attributesByCategory={attributesByCategory}
                  values={attributeValues}
                  onChange={handleAttributeChange}
                  onTouch={handleAttributeTouch}
                  disabled={saving}
                  onDefinitionUpdated={refetchAttributes}
                />
              ) : (
                <div className="text-center py-6 text-amber-600 text-sm">
                  ⚠️ Category chain is empty. Check RLS policies.
                </div>
              )
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                {currentEvent?.isDeleted 
                  ? 'This event is marked for deletion'
                  : 'No event selected'
                }
              </div>
            )}
          </div>
          
          {/* Event Note - MOVED ABOVE Photos */}
          {currentEvent && !currentEvent.isDeleted && categoryId && (
            <div className="px-3 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Event Note
                <span className="font-normal text-gray-400 ml-2 text-xs">optional</span>
              </label>
              <input
                type="text"
                value={eventNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                disabled={saving}
                placeholder="e.g., Felt strong today"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100"
              />
            </div>
          )}
          
          {/* Photo Gallery - combined existing and new photos */}
          {currentEvent && !currentEvent.isDeleted && categoryId && (
            <div className="px-3 pb-3">
              <PhotoGallery
                photos={currentPhotos}
                existingPhotos={existingPhotos}
                onPhotosChange={handlePhotosChange}
                onExistingPhotoRemove={handleDeleteExistingPhoto}
                disabled={saving}
              />
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
