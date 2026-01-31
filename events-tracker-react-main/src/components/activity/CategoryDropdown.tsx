import { useMemo } from 'react';
import { useCategories } from '@/hooks/useCategories';
import type { Category, UUID } from '@/types';

interface CategoryDropdownProps {
  areaId: UUID | null;
  value: UUID | null;
  onChange: (categoryId: UUID | null) => void;
  leafOnly?: boolean;      // Ako true, prikazuje samo leaf kategorije
  disabled?: boolean;
  className?: string;
}

export function CategoryDropdown({ 
  areaId, 
  value, 
  onChange, 
  leafOnly = true,
  disabled, 
  className = '' 
}: CategoryDropdownProps) {
  const { categories, loading, error } = useCategories({ areaId: areaId || undefined });

  // Build hierarchy i identificiraj leaf kategorije
  const processedCategories = useMemo(() => {
    if (!categories.length) return [];

    // Nađi sve parent IDs
    const parentIds = new Set(
      categories.filter(c => c.parent_category_id).map(c => c.parent_category_id)
    );

    // Označi leaf kategorije
    const categoriesWithLeaf = categories.map(cat => ({
      ...cat,
      isLeaf: !parentIds.has(cat.id),
    }));

    // Build path names za svaku kategoriju
    const categoryMap = new Map<string, typeof categoriesWithLeaf[0]>();
    categoriesWithLeaf.forEach(c => categoryMap.set(c.id, c));

    const getPathNames = (cat: Category): string[] => {
      const names: string[] = [cat.name];
      let current = cat;
      while (current.parent_category_id) {
        const parent = categoryMap.get(current.parent_category_id);
        if (!parent) break;
        names.unshift(parent.name);
        current = parent;
      }
      return names;
    };

    return categoriesWithLeaf.map(cat => ({
      ...cat,
      pathNames: getPathNames(cat),
      displayName: leafOnly 
        ? getPathNames(cat).join(' > ')  // Full path za leaf-only mode
        : '  '.repeat(cat.level - 1) + cat.name,  // Indented za hierarchical mode
    }));
  }, [categories, leafOnly]);

  // Filtriraj samo leaf ako je leafOnly
  const displayCategories = useMemo(() => {
    if (leafOnly) {
      return processedCategories.filter(c => c.isLeaf);
    }
    return processedCategories;
  }, [processedCategories, leafOnly]);

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Error loading categories: {error.message}
      </div>
    );
  }

  const isEmpty = !areaId;
  const noCategories = areaId && !loading && displayCategories.length === 0;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Category {leafOnly && <span className="text-gray-400 font-normal">(leaf only)</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading || isEmpty}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">
          {isEmpty 
            ? 'Select Area first' 
            : loading 
              ? 'Loading...' 
              : noCategories
                ? 'No categories found'
                : 'Select Category'
          }
        </option>
        {displayCategories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.displayName}
          </option>
        ))}
      </select>
      
      {/* Helper text za non-leaf selection */}
      {!leafOnly && value && !processedCategories.find(c => c.id === value)?.isLeaf && (
        <p className="mt-1 text-sm text-amber-600">
          ⚠️ This category has sub-categories. Select a leaf category to add events.
        </p>
      )}
    </div>
  );
}
