import { useState, useEffect, useMemo, useCallback, Component, type ErrorInfo, type ReactNode } from 'react';
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
import type { UUID } from '@/types';

// Debug logger - uses localStorage to survive crashes!
const DEBUG_KEY = 'events_tracker_debug_log';

const persistLog = (message: string) => {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(entry);
    
    // Get existing logs
    const existing = localStorage.getItem(DEBUG_KEY) || '';
    const lines = existing.split('\n').filter(Boolean);
    
    // Keep last 100 lines
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

// Log immediately on module load
persistLog('=== MODULE LOADED ===');

// Error Boundary Component
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
    persistLog(`Component Stack: ${errorInfo.componentStack?.slice(0, 300)}`);
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

interface AttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  touched: boolean;
}

export function AddActivityPage() {
  const navigate = useNavigate();
  
  // Get persisted logs on mount
  const [logs, setLogs] = useState<string[]>(() => getPersistedLogs());
  const [showDebug, setShowDebug] = useState(true);
  
  // Wrapper for logging
  const log = useCallback((message: string) => {
    persistLog(message);
    setLogs(getPersistedLogs());
  }, []);
  
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
  const [renderError, setRenderError] = useState<string | null>(null);

  // Log on mount
  useEffect(() => {
    log('AddActivityPage MOUNTED');
    return () => {
      persistLog('AddActivityPage UNMOUNTED');
    };
  }, [log]);

  // Fetch category chain (from leaf to root)
  const { chain: categoryChain, loading: chainLoading, error: chainError } = useCategoryChain(categoryId);

  // Log chain changes
  useEffect(() => {
    log(`Chain state: loading=${chainLoading}, error=${chainError?.message || 'none'}, length=${categoryChain.length}`);
    if (categoryChain.length > 0) {
      log(`Chain names: ${categoryChain.map(c => c.name).join(' → ')}`);
    }
  }, [categoryChain, chainLoading, chainError, log]);

  // Get all category IDs in chain
  const chainCategoryIds = useMemo(() => {
    const ids = categoryChain.map(c => c.id);
    if (ids.length > 0) {
      persistLog(`Chain IDs computed: ${ids.length} categories`);
    }
    return ids;
  }, [categoryChain]);

  // Fetch attribute definitions for all categories in chain
  const { 
    attributesByCategory, 
    loading: attributesLoading,
    error: attributesError
  } = useAttributeDefinitions(chainCategoryIds);

  // Log attributes changes
  useEffect(() => {
    log(`Attrs state: loading=${attributesLoading}, error=${attributesError?.message || 'none'}, size=${attributesByCategory.size}`);
  }, [attributesByCategory, attributesLoading, attributesError, log]);

  // Reset attribute values when category changes
  useEffect(() => {
    log(`Category changed to: ${categoryId || 'null'}`);
    setAttributeValues(new Map());
    setPhoto(null);
    setRenderError(null);
  }, [categoryId, log]);

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
      {/* Debug Panel - uses localStorage, survives crashes */}
      {showDebug && (
        <div className="fixed bottom-0 left-0 right-0 bg-black text-green-400 text-xs font-mono p-2 max-h-64 overflow-auto z-50 border-t-2 border-yellow-500">
          <div className="flex justify-between items-center mb-1 sticky top-0 bg-black pb-1">
            <span className="text-yellow-400 font-bold">DEBUG LOG (localStorage - survives crash)</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setLogs(getPersistedLogs())}
                className="text-blue-400 hover:text-blue-300 px-2"
              >
                [↻ Refresh]
              </button>
              <button 
                onClick={() => { clearPersistedLogs(); setLogs([]); }}
                className="text-orange-400 hover:text-orange-300 px-2"
              >
                [Clear]
              </button>
              <button 
                onClick={() => setShowDebug(false)}
                className="text-red-400 hover:text-red-300 px-2"
              >
                [X Close]
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
      
      {!showDebug && (
        <button
          onClick={() => setShowDebug(true)}
          className="fixed bottom-2 left-2 bg-black text-green-400 text-xs px-2 py-1 rounded z-50"
        >
          Show Debug
        </button>
      )}

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
      <div className="max-w-2xl mx-auto px-4 py-6 pb-56">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Filter section */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AreaDropdown
                value={areaId}
                onChange={(id) => {
                  log(`Area selected: ${id}`);
                  setAreaId(id);
                  setCategoryId(null);
                }}
              />
              <CategoryDropdown
                areaId={areaId}
                value={categoryId}
                onChange={(id) => {
                  log(`Category selected: ${id}`);
                  setCategoryId(id);
                }}
                leafOnly={true}
              />
            </div>
          </div>

          {/* Attributes section */}
          <div className="p-4">
            {/* Error display */}
            {(chainError || attributesError || renderError) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {chainError && <p>Chain error: {chainError.message}</p>}
                {attributesError && <p>Attributes error: {attributesError.message}</p>}
                {renderError && <p>Render error: {renderError}</p>}
              </div>
            )}
            
            {/* Debug state */}
            <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
              <p>categoryId: {categoryId || 'null'}</p>
              <p>chainLoading: {String(chainLoading)} | attrsLoading: {String(attributesLoading)}</p>
              <p>chainLength: {categoryChain.length} | attrsCategories: {attributesByCategory.size}</p>
            </div>
            
            {(chainLoading || attributesLoading) ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="ml-2 text-gray-500">Loading...</span>
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
                  />
                </ErrorBoundary>
              ) : (
                <div className="text-center py-8 text-amber-600">
                  ⚠️ Category chain is empty. Check RLS policies.
                </div>
              )
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
