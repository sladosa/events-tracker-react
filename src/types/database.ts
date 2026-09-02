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

export interface RataAutomationConfig {
  trigger_slug: string;
  count_slug: string;
  amount_slug: string;
  date_map_slug: string;
  date_map: Record<string, number>;   // vrijednost date_map_slug atributa → dan naplate (1–31)
  override_attrs?: Record<string, string>;
  comment_attr_slug?: string; // attr to use as comment prefix when event note is empty
  // S107t — sve rate dijele event_date (= dan kupnje), pa datum naplate ide u
  // atribut, a ne u event_date. Oba su opcionalna radi starijih konfiguracija.
  charge_date_slug?: string;  // datetime attr koji prima datum naplate te rate
  index_slug?: string;        // number attr koji prima redni broj rate (1..count)
}

// Faza 2b (AUTOMATION_SPEC.md): derive attribute value from another attribute.
// date_map values: 'same' (= session date) | 'next:N' (Nth day of next month).
export interface AttributeRuleConfig {
  action: 'set_attribute';
  name?: string; // display name in Automations sheet
  target_slug: string;
  map_slug: string;
  date_map: Record<string, string>;
}

// --------------------------------------------
// Overview dashboard (docs/OVERVIEW_TAB_SPEC.md §2.3, §2.15)
// --------------------------------------------
// The config is the missing layer of MEANING over a generic EAV model: which
// slug is money in, which is money out, what counts as "already happened".
// The model does not carry that — `Uplata` is just a number, same as `Težina`.
//
// Slug-based, never ID-based: this travels through the Structure Excel into
// another database, where IDs do not exist (§2.16). And it never names the Area
// or a category path — that is the mistake `export_profiles` made.

/** One attribute condition. Mirrors `p_filters` in sql/035_area_group_agg.sql. */
export interface WidgetFilter {
  slug: string;
  op: 'in' | 'not_in';
  values: string[];
}

export interface BalanceByGroupWidget {
  type: 'balance_by_group';
  title: string;
  /** Attribute slug to group by, e.g. `racun`. */
  group_by: string;
  /** Numeric slug added to the balance. */
  plus?: string;
  /** Numeric slug subtracted from it. */
  minus?: string;
  /** What counts as "already happened" — for Financije this is the §2.10 rule. */
  filters?: WidgetFilter[];
  /**
   * A second, separate number beside the balance (e.g. Status = Planiran).
   * `due_slug` (opcionalan) imenuje datumski atribut dospijeca. Kad ga ima,
   * sekcija delta sheeta pokazuje CIJELU kosaru -- ukljucujuci retke koje je
   * netko vec prebacio u izvrseno bez potvrde s izvoda. Bez njega se ponasanje
   * ne mijenja, pa Area koja ga nema dobiva tocno danasnju sekciju.
   */
  split?: { label: string; filters: WidgetFilter[]; due_slug?: string };
  /** Show the "u banci" field, the ✓/Δ chip, and let the user write an anchor. */
  reconcile?: boolean;
  /** Suffix appended to every amount, e.g. `€`. */
  unit?: string;
}

/** v1 dictionary. Widening it is a code change on purpose (§2.15 — the
 *  dictionary lives in code, the semantics of one Area live in config). */
export type DashboardWidget = BalanceByGroupWidget;

export interface DashboardConfig {
  widgets: DashboardWidget[];
}

// --------------------------------------------
// Activities list columns (CLAUDE.md Backlog — "Kolone Activities liste po Arei")
// --------------------------------------------
// WHY THIS EXISTS
//   The list is generic for every Area (`Date, Time, Category, Events, Comment`)
//   because the model is. For an Area with an L1 leaf and everything in
//   attributes — Financije — three of those five columns are blank space, and
//   the two numbers the user actually came for live behind a click.
//
//   This is the SAME move the Overview tiles made (§2.15): the shape is generic,
//   the meaning arrives as configuration. Columns are therefore described by
//   ROLE, never by a name out of one domain — `pair` and `attr`, not `Iznos`
//   and `Tip`. The test is unchanged: a new Area must cost zero lines of code.
//
//   Slug-based for the same reason the dashboard is: this travels through the
//   Structure Excel into another database, where IDs mean nothing. A renamed
//   slug must be fixed up in the same write as the rename (`listColumns.ts`),
//   or the column silently goes blank — the S105d failure shape.
//
//   An Area with no config keeps today's list exactly as it is. Absence is not
//   an empty table; it is the default.

/** What a column shows. Widening this dictionary is a code change on purpose. */
export type ListColumnRole =
  | 'date'      // event_date
  | 'time'      // session_start, HH:MM
  | 'category'  // category path (+ area icon)
  | 'events'    // event count in the session + photo marker
  | 'user'      // collab avatar; renders only when the Area is shared
  | 'pair'      // ONE column: direction + amount, from a plus and a minus slug
  | 'attr'      // one or more attribute slugs, joined into one cell
  | 'comment'   // the leaf event's comment
  | 'balance'   // the computed `Stanje` column (§2.12); needs a dashboard widget
  | 'actions';  // the ⋮ menu — always rendered, always last

export interface ListColumn {
  role: ListColumnRole;
  /** Header text. Falls back to a per-role default. */
  label?: string;
  /** `pair`: numeric slug shown as money in. */
  plus?: string;
  /** `pair`: numeric slug shown as money out. */
  minus?: string;
  /** `attr`: attribute slugs, joined with `sep` into a single cell. */
  slugs?: string[];
  /** `attr`: separator between slug values. Default ` / `. */
  sep?: string;
  /**
   * `attr`: short display form per value, e.g. `Kokin tekući ZABA` -> `ZABA`.
   *
   * A value with no entry falls back to ITSELF, never to a guess. That is the
   * whole reason this is a dictionary and not a rule like "last word": when an
   * account is renamed the column shows the full name — visibly unabbreviated,
   * which reads as "nobody taught me this one", not as a wrong account.
   */
  map?: Record<string, string>;
  /** Suffix on amounts, e.g. `€`. `pair` and `balance` only. */
  unit?: string;
  /**
   * Where the column goes on a narrow screen (< 640px), which renders as two
   * lines rather than a table. Defaults per role; `hide` drops it entirely.
   */
  mobile?: 'line1' | 'line2' | 'hide';
  /** Tailwind width class for the desktop table, e.g. `w-28`. */
  width?: string;
  /** Right-align the cell (numbers). Default true for `pair` and `balance`. */
  align?: 'left' | 'right' | 'center';
}

export interface ListColumnsConfig {
  columns: ListColumn[];
}

export interface AreaSettings {
  disable_save_plus?: boolean;
  comment_template?: string;
  automations?: {
    rata?: RataAutomationConfig;
    attribute_rules?: AttributeRuleConfig[];
  };
  export_profiles?: Record<string, unknown>;
  dashboard?: DashboardConfig;
  /** Activities list columns for this Area (Backlog — kolone po Arei). */
  list_columns?: ListColumnsConfig;
  /** Add Activity header for this Area. Absent = today's behaviour, exactly as
   *  with `list_columns`: the default is a real default, not an empty object. */
  add_header?: AddHeaderConfig;
}

/** What the Add Activity header shows.
 *
 *  Roles, not domain — the same shape has to make sense for any Area. The
 *  stopwatch earns its place while an activity is being PERFORMED (a workout);
 *  it makes none for something being RECORDED after the fact (a transaction
 *  from three days ago), where the useful control is the date instead. */
export interface AddHeaderConfig {
  /** SESSION / LAP stopwatch. Default true. */
  timer?: boolean;
  /** Date picker, defaulting to today. Default false. */
  date?: boolean;
}

export interface CategorySettings {
  comment_template?: string;
}

export interface Area {
  id: UUID;
  user_id: UUID | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  description: string | null;
  slug: string;
  settings: AreaSettings | null;
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
  settings: CategorySettings | null;
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

/** Default attribute values applied when the shortcut is selected — keyed by attribute_definition id */
export type PresetDefaultAttributes = Record<string, string | number | boolean | null>;

/** Saved filter state for shortcut — dynamic periods resolve on load */
export interface PresetFilterState {
  periodKey: string;        // PeriodKey enum value (e.g. 'this-year', 'last-3-months')
  sortOrder: 'asc' | 'desc';
  commentSearch?: string;
  attrFilter?: { attrDefId: string; value: string; isExact: boolean } | null;
}

export interface ActivityPreset {
  id: UUID;
  user_id: UUID;
  name: string;
  area_id: UUID | null;
  category_id: UUID | null;
  usage_count: number;
  last_used: Timestamp | null;
  created_at: Timestamp;
  default_attributes: PresetDefaultAttributes | null;
  filter_state: PresetFilterState | null;
}

export type ActivityPresetInsert = Omit<ActivityPreset, 'id' | 'created_at' | 'usage_count' | 'default_attributes' | 'filter_state'> & {
  id?: UUID;
  created_at?: Timestamp;
  usage_count?: number;
  default_attributes?: PresetDefaultAttributes | null;
  filter_state?: PresetFilterState | null;
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
// Table: profiles
// --------------------------------------------

export interface Profile {
  id: UUID;
  email: string;
  display_name: string | null;
  created_at: Timestamp;
}

// --------------------------------------------
// Table: share_invites
// --------------------------------------------

export type ShareInviteStatus = 'pending' | 'accepted';

export interface ShareInvite {
  id: UUID;
  owner_id: UUID;
  grantee_email: string;
  share_type: ShareType;
  target_id: UUID;
  permission: SharePermission;
  status: ShareInviteStatus;
  created_at: Timestamp;
}

export type ShareInviteInsert = Omit<ShareInvite, 'id' | 'created_at' | 'status'> & {
  id?: UUID;
  created_at?: Timestamp;
  status?: ShareInviteStatus;
};

// DataShare with joined profile info (for share management UI)
export interface DataShareWithProfile extends DataShare {
  grantee?: Profile;
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
