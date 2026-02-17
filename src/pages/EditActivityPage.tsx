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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
      // Decode session_start from URL
      const decodedSessionStart = decodeURIComponent(sessionStart);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Fetch all events with this session_start
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, category_id, event_date, session_start, comment, created_at, edited_at')
        .eq('session_start', decodedSessionStart)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (eventsError) throw eventsError;
      if (!events || events.length === 0) {
        throw new Error('Activity not found');
      }
      
      const loadedEvents = events as LoadedEvent[];
      
      // Get the leaf category (last event's category)
      const leafCategoryId = loadedEvents[loadedEvents.length - 1].category_id;
      setCategoryId(leafCategoryId);
      
      // Build category path
      const path = await buildCategoryPath(leafCategoryId);
      setCategoryPath(path);
      
      // Set session datetime
      const sessionDate = new Date(decodedSessionStart);
      setSessionDateTime(sessionDate);
      setOriginalDateTime(sessionDate);
      
      // Store original event IDs
      setOriginalEventIds(loadedEvents.map(e => e.id));
      
      // Fetch attributes and attachments for each event
      const pendingEventsData: PendingEvent[] = [];
      
      for (const event of loadedEvents) {
        // Fetch attributes
        const { data: attrs } = await supabase
          .from('event_attributes')
          .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
          .eq('event_id', event.id);
        
        const loadedAttrs = (attrs || []) as unknown as LoadedAttribute[];
        
        // Fetch attachments
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('id, event_id, url, filename')
          .eq('event_id', event.id)
          .eq('type', 'image');
        
        const loadedAttachments = (attachments || []) as LoadedAttachment[];
        
        // Convert to PendingEvent format
        const attributes: AttributeValue[] = loadedAttrs
          .filter(attr => attr.attribute_definitions !== null)
          .map(attr => {
          let value: string | number | boolean | null = null;
          const dataType = attr.attribute_definitions!.data_type;
          
          if (dataType === 'number' && attr.value_number !== null) {
            value = attr.value_number;
          } else if (dataType === 'boolean' && attr.value_boolean !== null) {
            value = attr.value_boolean;
          } else if (dataType === 'datetime' && attr.value_datetime !== null) {
            value = attr.value_datetime;
          } else if (attr.value_text !== null) {
            value = attr.value_text;
          }
          
          return {
            definitionId: attr.attribute_definition_id,
            value,
            dataType: dataType as 'text' | 'number' | 'boolean' | 'datetime',
            touched: false,
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
      
      // Initialize form with first event
      if (pendingEventsData.length > 0) {
        selectEvent(0, pendingEventsData);
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
  
  const selectEvent = useCallback((index: number, events?: PendingEvent[]) => {
    const eventsList = events || pendingEvents;
    if (index < 0 || index >= eventsList.length) return;
    
    const event = eventsList[index];
    setSelectedEventIndex(index);
    
    // Load event attributes into form
    const attrMap = new Map<string, LocalAttributeValue>();
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
    error: attributesError
  } = useAttributeDefinitions(chainCategoryIds);
  
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
    setIsDirty(true);
    
    // Update the pending event
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
  }, [selectedEventIndex]);
  
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
        createdAt: new Date(),
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
          })
          .eq('id', event.dbId);
        
        if (updateError) throw updateError;
        
        // Delete old attributes and insert new ones
        await supabase
          .from('event_attributes')
          .delete()
          .eq('event_id', event.dbId);
        
        const touchedAttrs = event.attributes.filter(a => a.touched && a.value != null);
        if (touchedAttrs.length > 0) {
          const attrDefs = attributesByCategory.get(event.categoryId) || [];
          const attributeRecords = touchedAttrs.map(attr => {
            const def = attrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
            
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
        
        // Insert attributes
        const touchedAttrs = event.attributes.filter(a => a.touched && a.value != null);
        if (touchedAttrs.length > 0) {
          const attrDefs = attributesByCategory.get(event.categoryId) || [];
          const attributeRecords = touchedAttrs.map(attr => {
            const def = attrDefs.find(d => d.id === attr.definitionId);
            const valueColumn = def ? VALUE_COLUMNS[def.data_type] || 'value_text' : 'value_text';
            
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
      
      // Success!
      navigate('/app');
      
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
      navigate('/app');
    }
  }, [isDirty, navigate]);
  
  const handleConfirmCancel = useCallback(() => {
    setShowCancelDialog(false);
    navigate('/app');
  }, [navigate]);
  
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
        mode="edit"
        categoryPath={categoryPath}
        dateTime={sessionDateTime}
        onDateTimeChange={handleDateTimeChange}
        totalDuration={totalDuration}
        onCancel={handleCancel}
        onSave={handleSave}
        canSave={canSave}
        saving={saving}
      />
      
      {/* Events List */}
      <div className="max-w-2xl mx-auto px-4 py-4">
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
                  if (!event.isDeleted) {
                    selectEvent(index);
                  }
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  flex items-center gap-1.5
                  ${event.isDeleted
                    ? 'bg-red-100 text-red-400 line-through cursor-not-allowed'
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
                {event.isDeleted && <span className="text-xs">🗑️</span>}
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
                Event #{selectedEventIndex + 1} · created {currentEvent.createdAt.toLocaleDateString('sv-SE')} {currentEvent.createdAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
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
                  expandedByDefault={true}
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
