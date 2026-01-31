import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { VALUE_COLUMNS } from '@/lib/constants';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useCategoryChain } from '@/hooks/useCategoryChain';
import { useAttributeDefinitions } from '@/hooks/useAttributeDefinitions';
import { SessionHeader } from '@/components/activity/SessionHeader';
import { SessionLog } from '@/components/activity/SessionLog';
import { AreaDropdown } from '@/components/activity/AreaDropdown';
import { CategoryDropdown } from '@/components/activity/CategoryDropdown';
import { AttributeChainForm } from '@/components/activity/AttributeChainForm';
import { PhotoUpload } from '@/components/activity/PhotoUpload';
import type { UUID, Category } from '@/types';

interface AttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  touched: boolean;
}

export function AddActivityPage() {
  const navigate = useNavigate();
  
  // Session timer
  const {
    sessionStart,
    elapsed,
    lapElapsed,
    savedEvents,
    isActive,
    addSavedEvent,
    formatTime,
    endSession,
  } = useSessionTimer();

  // Form state
  const [areaId, setAreaId] = useState<UUID | null>(null);
  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [attributeValues, setAttributeValues] = useState<Map<string, AttributeValue>>(new Map());
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch category chain (from leaf to root)
  const { chain: categoryChain, loading: chainLoading } = useCategoryChain(categoryId);

  // Get all category IDs in chain
  const chainCategoryIds = useMemo(() => 
    categoryChain.map(c => c.id), 
    [categoryChain]
  );

  // Fetch attribute definitions for all categories in chain
  const { 
    attributesByCategory, 
    loading: attributesLoading 
  } = useAttributeDefinitions(chainCategoryIds);

  // Reset attribute values when category changes
  useEffect(() => {
    setAttributeValues(new Map());
    setPhoto(null);
  }, [categoryId]);

  // Handle attribute value change
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

  // Handle attribute touched
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

  // Check if form has any touched attributes
  const hasTouchedAttributes = useMemo(() => {
    return Array.from(attributeValues.values()).some(v => v.touched && v.value != null);
  }, [attributeValues]);

  // Check if form is valid for save
  const canSave = useMemo(() => {
    if (!categoryId) return false;
    // Potrebno: touched atribut ILI komentar ILI photo
    return hasTouchedAttributes || comment.trim() !== '' || photo !== null;
  }, [categoryId, hasTouchedAttributes, comment, photo]);

  // Get leaf category name for display
  const leafCategoryName = useMemo(() => {
    return categoryChain[0]?.name || 'Unknown';
  }, [categoryChain]);

  // Build summary from attribute values (for session log)
  const buildSummary = useCallback(() => {
    const parts: string[] = [];
    
    // Get touched attributes with values
    for (const [defId, attrVal] of attributeValues) {
      if (attrVal.touched && attrVal.value != null) {
        // Find attribute definition
        for (const [, attrs] of attributesByCategory) {
          const def = attrs.find(a => a.id === defId);
          if (def) {
            const displayValue = String(attrVal.value);
            const unit = def.unit ? ` ${def.unit}` : '';
            parts.push(`${displayValue}${unit}`);
            break;
          }
        }
      }
    }
    
    return parts.slice(0, 3).join(', '); // Max 3 values
  }, [attributeValues, attributesByCategory]);

  // Save event(s)
  const handleSave = async (andFinish: boolean = false) => {
    if (!canSave || !categoryId) return;

    setSaving(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const eventDate = sessionStart.toISOString().split('T')[0];
      const sessionStartIso = sessionStart.toISOString();
      const createdAt = new Date().toISOString();

      // Create events for entire category chain
      const createdEvents: { id: string; category_id: string }[] = [];

      for (const category of categoryChain) {
        const categoryAttrs = attributesByCategory.get(category.id) || [];
        const touchedAttrs = categoryAttrs.filter(attr => {
          const val = attributeValues.get(attr.id);
          return val?.touched && val.value != null;
        });

        // Skip categories without touched attributes (unless it's the leaf)
        const isLeaf = category.id === categoryId;
        if (!isLeaf && touchedAttrs.length === 0) continue;

        // Insert event
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            category_id: category.id,
            event_date: eventDate,
            session_start: sessionStartIso,
            comment: isLeaf ? comment || null : null, // Comment only on leaf
            created_at: createdAt,
          })
          .select('id, category_id')
          .single();

        if (eventError) throw eventError;
        createdEvents.push(event);

        // Insert attribute values
        if (touchedAttrs.length > 0) {
          const attributeRecords = touchedAttrs.map(attr => {
            const val = attributeValues.get(attr.id)!;
            const valueColumn = VALUE_COLUMNS[attr.data_type] || 'value_text';
            
            return {
              event_id: event.id,
              user_id: user.id,
              attribute_definition_id: attr.id,
              [valueColumn]: val.value,
            };
          });

          const { error: attrError } = await supabase
            .from('event_attributes')
            .insert(attributeRecords);

          if (attrError) throw attrError;
        }
      }

      // Upload photo if present (attach to leaf event)
      if (photo && createdEvents.length > 0) {
        const leafEvent = createdEvents.find(e => e.category_id === categoryId);
        if (leafEvent) {
          // Upload to Supabase Storage
          const fileExt = photo.name.split('.').pop();
          const fileName = `${user.id}/${leafEvent.id}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('event-attachments')
            .upload(fileName, photo);

          if (uploadError) {
            console.error('Photo upload failed:', uploadError);
            // Don't fail the whole save for photo upload
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('event-attachments')
              .getPublicUrl(fileName);

            // Insert attachment record
            await supabase.from('event_attachments').insert({
              event_id: leafEvent.id,
              user_id: user.id,
              type: 'image',
              url: urlData.publicUrl,
              filename: photo.name,
              size_bytes: photo.size,
            });
          }
        }
      }

      // Add to session log
      addSavedEvent({
        eventId: createdEvents[0]?.id || '',
        categoryName: leafCategoryName,
        summary: buildSummary(),
        hasPhoto: photo !== null,
      });

      // Reset form (keep Area/Category/Comment)
      setAttributeValues(new Map());
      setPhoto(null);

      if (andFinish) {
        endSession();
        navigate('/events');
      }
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Handle finish session (without saving current form)
  const handleFinishSession = () => {
    if (savedEvents.length === 0) {
      // No events saved, just go back
      navigate('/');
      return;
    }
    
    if (canSave) {
      // Has unsaved changes, ask to save
      if (window.confirm('You have unsaved changes. Save before finishing?')) {
        handleSave(true);
        return;
      }
    }
    
    endSession();
    navigate('/events');
  };

  // Handle cancel
  const handleCancel = () => {
    if (savedEvents.length > 0 || canSave) {
      if (!window.confirm('Discard this session?')) {
        return;
      }
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with timers */}
      <SessionHeader
        elapsed={elapsed}
        lapElapsed={lapElapsed}
        formatTime={formatTime}
        onFinish={handleFinishSession}
        isActive={isActive}
      />

      {/* Session log */}
      <SessionLog savedEvents={savedEvents} />

      {/* Main form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Filter section */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AreaDropdown
                value={areaId}
                onChange={(id) => {
                  setAreaId(id);
                  setCategoryId(null); // Reset category when area changes
                }}
              />
              <CategoryDropdown
                areaId={areaId}
                value={categoryId}
                onChange={setCategoryId}
                leafOnly={true}
              />
            </div>
          </div>

          {/* Attributes section */}
          <div className="p-4">
            {(chainLoading || attributesLoading) ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : categoryId ? (
              <AttributeChainForm
                categoryChain={categoryChain}
                attributesByCategory={attributesByCategory}
                values={attributeValues}
                onChange={handleAttributeChange}
                onTouch={handleAttributeTouch}
                disabled={saving}
                expandedByDefault={false}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select Area and Category to start
              </div>
            )}
          </div>

          {/* Photo upload */}
          {categoryId && (
            <div className="px-4 pb-4">
              <PhotoUpload
                value={photo}
                onChange={setPhoto}
                disabled={saving}
              />
            </div>
          )}

          {/* Comment */}
          {categoryId && (
            <div className="px-4 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💬 Comment
                <span className="font-normal text-gray-400 ml-1">(shared across session)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={saving}
                rows={2}
                placeholder="Optional notes for this session..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={!canSave || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={!canSave || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
