import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TEMPLATE_USER_ID } from '@/lib/constants';
import type { Area } from '@/types';

interface UseAreasOptions {
  includeTemplates?: boolean; // Default: false - prikaži samo svoje
}

interface UseAreasReturn {
  areas: Area[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAreas(options: UseAreasOptions = {}): UseAreasReturn {
  const { includeTemplates = false } = options;
  
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAreas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAreas([]);
        return;
      }

      let query = supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true });

      // Filter: RLS handles own + shared areas automatically.
      // Explicitly exclude template user so they never appear in filter dropdown.
      if (!includeTemplates) {
        query = query.neq('user_id', TEMPLATE_USER_ID);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setAreas(data || []);
    } catch (err) {
      console.error('Error fetching areas:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch areas'));
    } finally {
      setLoading(false);
    }
  }, [includeTemplates]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  return { areas, loading, error, refetch: fetchAreas };
}

// Helper za dohvat SAMO template area-a (za Add Area suggestions)
export function useTemplateAreas(): UseAreasReturn {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAreas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', TEMPLATE_USER_ID)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setAreas(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch template areas'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  return { areas, loading, error, refetch: fetchAreas };
}
