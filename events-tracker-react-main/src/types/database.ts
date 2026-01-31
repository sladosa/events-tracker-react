// ============================================
// Database Types - Events Tracker
// ============================================
// Bazirano na SQL shemi v2
// Može se regenerirati: npx supabase gen types typescript
// ============================================

// --------------------------------------------
// Base Types
// --------------------------------------------

export type UUID = string;
export type Timestamp = string; // ISO 8601 format

// --------------------------------------------
// Enums
// --------------------------------------------

export type DataType = 'number' | 'text' | 'datetime' | 'boolean' | 'link' | 'image';
export type ShareType = 'area' | 'category';
export type SharePermission = 'read' | 'write';
export type AttachmentType = 'image' | 'link' | 'file';

// --------------------------------------------
// Table: areas
// --------------------------------------------

export interface Area {
  id: UUID;
  user_id: UUID | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  description: string | null;
  slug: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type AreaInsert = Omit<Area, 'created_at' | 'updated_at'> & {
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export type AreaUpdate = Partial<AreaInsert>;

// --------------------------------------------
// Table: categories
// --------------------------------------------

export interface Category {
  id: UUID;
  user_id: UUID | null;
  area_id: UUID | null;
  parent_category_id: UUID | null;
  name: string;
  description: string | null;
  slug: string;
  level: number; // 1-10
  sort_order: number;
  path: string | null; // ltree path
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type CategoryInsert = Omit<Category, 'created_at' | 'updated_at'> & {
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export type CategoryUpdate = Partial<CategoryInsert>;

// Extended category with area info (for joins)
export interface CategoryWithArea extends Category {
  area?: Area;
}

// Category with full hierarchy path
export interface CategoryWithPath extends Category {
  area?: Area;
  parent?: Category;
  pathNames?: string[]; // ['Health', 'Daily Metrics']
}

// --------------------------------------------
// Table: attribute_definitions
// --------------------------------------------

export interface ValidationRules {
  min?: number;
  max?: number;
  pattern?: string;
  dropdown?: {
    type: 'static' | 'lookup' | 'dynamic_lookup';
    options?: string[]; // for static
    lookup_name?: string; // for lookup types
    depends_on?: {
      field: string;
      mapping?: Record<string, string>;
    };
    include_global?: boolean;
    allow_custom?: boolean;
  };
}

export interface AttributeDefinition {
  id: UUID;
  user_id: UUID | null;
  category_id: UUID | null;
  name: string;
  slug: string;
  description: string | null;
  data_type: DataType;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  validation_rules: ValidationRules;
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type AttributeDefinitionInsert = Omit<AttributeDefinition, 'created_at' | 'updated_at'> & {
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export type AttributeDefinitionUpdate = Partial<AttributeDefinitionInsert>;

// --------------------------------------------
// Table: events
// --------------------------------------------

export interface Event {
  id: UUID;
  user_id: UUID | null;
  category_id: UUID | null;
  event_date: string; // DATE format: YYYY-MM-DD
  session_start: Timestamp | null;
  comment: string | null;
  created_at: Timestamp;
  edited_at: Timestamp;
}

export type EventInsert = Omit<Event, 'id' | 'created_at' | 'edited_at'> & {
  id?: UUID;
  created_at?: Timestamp;
  edited_at?: Timestamp;
};

export type EventUpdate = Partial<EventInsert>;

// Event with related data
export interface EventWithDetails extends Event {
  category?: CategoryWithArea;
  attributes?: EventAttributeWithDefinition[];
}

// --------------------------------------------
// Table: event_attributes (EAV)
// --------------------------------------------

export interface EventAttribute {
  id: UUID;
  user_id: UUID | null;
  event_id: UUID | null;
  attribute_definition_id: UUID | null;
  value_text: string | null;
  value_number: number | null;
  value_datetime: Timestamp | null;
  value_boolean: boolean | null;
  value_json: Record<string, unknown> | null;
  created_at: Timestamp;
}

export type EventAttributeInsert = Omit<EventAttribute, 'id' | 'created_at'> & {
  id?: UUID;
  created_at?: Timestamp;
};

export type EventAttributeUpdate = Partial<EventAttributeInsert>;

// With definition info
export interface EventAttributeWithDefinition extends EventAttribute {
  attribute_definition?: AttributeDefinition;
}

// --------------------------------------------
// Table: event_attachments
// --------------------------------------------

export interface EventAttachment {
  id: UUID;
  user_id: UUID | null;
  event_id: UUID | null;
  type: AttachmentType | null;
  url: string;
  filename: string | null;
  size_bytes: number | null;
  created_at: Timestamp;
}

// --------------------------------------------
// Table: activity_presets (shortcuts)
// --------------------------------------------

export interface ActivityPreset {
  id: UUID;
  user_id: UUID;
  name: string;
  area_id: UUID | null;
  category_id: UUID | null;
  usage_count: number;
  last_used: Timestamp | null;
  created_at: Timestamp;
}

export type ActivityPresetInsert = Omit<ActivityPreset, 'id' | 'created_at' | 'usage_count'> & {
  id?: UUID;
  created_at?: Timestamp;
  usage_count?: number;
};

// With related data
export interface ActivityPresetWithDetails extends ActivityPreset {
  area?: Area;
  category?: CategoryWithPath;
}

// --------------------------------------------
// Table: lookup_values (NEW)
// --------------------------------------------

export interface LookupValue {
  id: UUID;
  user_id: UUID;
  lookup_name: string;
  parent_key: string | null;
  value: string;
  value_key: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type LookupValueInsert = Omit<LookupValue, 'id' | 'created_at' | 'updated_at'> & {
  id?: UUID;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

// --------------------------------------------
// Table: data_shares
// --------------------------------------------

export interface DataShare {
  id: UUID;
  owner_id: UUID;
  grantee_id: UUID;
  share_type: ShareType;
  target_id: UUID;
  permission: SharePermission;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// --------------------------------------------
// Helper Types for UI
// --------------------------------------------

// For filter/selection state
export interface FilterState {
  areaId: UUID | null;
  categoryId: UUID | null;
  categoryPath: UUID[]; // Array of category IDs from root to leaf
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}

// For breadcrumb display
export interface BreadcrumbItem {
  id: UUID | null; // null for "All" root
  name: string;
  type: 'root' | 'area' | 'category';
  level?: number;
}

// Tree node for hierarchical display
export interface TreeNode {
  id: UUID;
  name: string;
  type: 'area' | 'category';
  icon?: string | null;
  color?: string | null;
  level: number;
  children: TreeNode[];
  parent_id: UUID | null;
  area_id?: UUID;
  hasAttributes?: boolean;
  eventCount?: number;
}
