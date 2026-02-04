import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ActivityPreset, UUID } from '@/types';

interface UseActivityPresetsResult {
  presets: ActivityPreset[];
  loading: boolean;
  error: Error | null;
  createPreset: (name: string, areaId: UUID | null, categoryId: UUID | null) => Promise<ActivityPreset | null>;
  deletePreset: (presetId: UUID) => Promise<boolean>;
  incrementUsage: (presetId: UUID) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useActivityPresets(): UseActivityPresetsResult {
  const [presets, setPresets] = useState<ActivityPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all presets for current user, sorted by usage
  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPresets([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('activity_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .order('last_used', { ascending: false, nullsFirst: false });

      if (fetchError) throw fetchError;
      setPresets(data || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch presets'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Create new preset
  const createPreset = useCallback(async (
    name: string, 
    areaId: UUID | null, 
    categoryId: UUID | null
  ): Promise<ActivityPreset | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('activity_presets')
        .insert({
          user_id: user.id,
          name: name.trim(),
          area_id: areaId,
          category_id: categoryId,
          usage_count: 0,
          last_used: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh list
      await fetchPresets();
      return data;
    } catch (err) {
      console.error('Failed to create preset:', err);
      setError(err instanceof Error ? err : new Error('Failed to create preset'));
      return null;
    }
  }, [fetchPresets]);

  // Delete preset
  const deletePreset = useCallback(async (presetId: UUID): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('activity_presets')
        .delete()
        .eq('id', presetId);

      if (deleteError) throw deleteError;

      // Update local state
      setPresets(prev => prev.filter(p => p.id !== presetId));
      return true;
    } catch (err) {
      console.error('Failed to delete preset:', err);
      setError(err instanceof Error ? err : new Error('Failed to delete preset'));
      return false;
    }
  }, []);

  // Increment usage count when preset is used
  const incrementUsage = useCallback(async (presetId: UUID): Promise<void> => {
    try {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;

      const { error: updateError } = await supabase
        .from('activity_presets')
        .update({
          usage_count: preset.usage_count + 1,
          last_used: new Date().toISOString(),
        })
        .eq('id', presetId);

      if (updateError) throw updateError;

      // Update local state
      setPresets(prev => prev.map(p => 
        p.id === presetId 
          ? { ...p, usage_count: p.usage_count + 1, last_used: new Date().toISOString() }
          : p
      ));
    } catch (err) {
      console.error('Failed to increment usage:', err);
      // Don't set error - this is non-critical
    }
  }, [presets]);

  return {
    presets,
    loading,
    error,
    createPreset,
    deletePreset,
    incrementUsage,
    refresh: fetchPresets,
  };
}
