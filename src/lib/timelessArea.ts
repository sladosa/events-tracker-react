// Area bez štoperice i bez datuma (katalog vježbi, S190): zapis nije događaj u vremenu, pa
// Edit i View ne pokazuju datum, vrijeme, Duration ni vrijeme nastanka zapisa.
// JEDAN uvjet za oba mjesta (S191) — kopija bi se razišla pa bi View pokazivao ono što Edit skriva.
import { supabase } from '@/lib/supabaseClient';
import { getCategoryMap } from '@/lib/categoryCache';
import type { AreaSettings } from '@/types/database';
import type { UUID } from '@/types';

export function isTimelessArea(settings: AreaSettings | null | undefined): boolean {
  return settings?.add_header?.timer === false && settings?.add_header?.date !== true;
}

/** Postavke Aree kojoj kategorija pripada; `null` kad se ne da pročitati (prikaz tada ostaje kakav je bio). */
export async function loadAreaSettingsForCategory(categoryId: UUID): Promise<AreaSettings | null> {
  const catMap = await getCategoryMap();
  let cur: UUID | null = categoryId;
  let areaId: UUID | null = null;
  for (let i = 0; cur && i < 15; i++) {
    const cat = catMap.get(cur);
    if (!cat) break;
    if (cat.area_id) areaId = cat.area_id;
    cur = cat.parent_category_id;
  }
  if (!areaId) return null;
  const { data, error } = await supabase.from('areas').select('settings').eq('id', areaId).single();
  if (error) return null;
  return (data?.settings as AreaSettings | null) ?? null;
}
