/**
 * Events Tracker – Excel Export/Import Shared Types
 */

// ─────────────────────────────────────────────
// Data types used by excelExport and excelImport
// ─────────────────────────────────────────────

export interface ExportCategoryInfo {
  id: string;
  name: string;
  full_path: string;
  area_id: string | null;
  area_name: string;
  level: number;
  parent_category_id: string | null;
  sort_order: number;
}

export type ExportCategoriesDict = Record<string, ExportCategoryInfo>;

export interface ExportAttrDef {
  id: string;
  category_id: string;
  name: string;
  slug: string | null;
  data_type: string;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  validation_rules: unknown;
  sort_order: number;
  description?: string | null;
}

export interface ExportEventAttribute {
  id: string;
  attribute_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
}

export interface ExportEvent {
  id: string;
  category_id: string;
  event_date: string;       // YYYY-MM-DD
  session_start: string | null;  // ISO timestamp
  comment: string | null;
  created_at: string | null;    // ISO timestamp
  event_attributes: ExportEventAttribute[];
  user_id?: string;             // populated by excelDataLoader (raw DB field)
  user_email?: string;          // populated by excelDataLoader after profile lookup
}

// ─────────────────────────────────────────────
// Import types
// ─────────────────────────────────────────────

/** Mapping from Excel column letter → (area, category_path, attr_name) */
export type LegendMapping = Record<string, { area: string; categoryPath: string; attrName: string }>;

/**
 * Sto s retkom koji u koloni G nosi TUDJI email.
 *   skip           -- preskoci (zadano, sigurno)
 *   import_as_mine -- ubaci kao NOV redak pod svojim imenom (INSERT, duplikat
 *                     ako original ostaje -- v. excelImport.ts:443)
 *   fix_as_owner   -- ISPRAVI original na mjestu; autorstvo ostaje autoru.
 *                     Radi samo vlasniku Aree (RLS iz 043) i samo za retke koji
 *                     vec postoje (imaju `event_id`).
 */
export type ForeignMode = 'skip' | 'import_as_mine' | 'fix_as_owner';

export interface ParsedImportRow {
  event_id:       string | null;   // null → CREATE, filled → UPDATE
  area:           string;
  category_path:  string;
  event_date:     string;          // YYYY-MM-DD (after normalization)
  session_start:  string;          // HH:MM
  created_at:     string;          // HH:mm:ss
  comment:        string;
  attributes:     Record<string, string | number | boolean | null>;
  _source_row:    number;          // Original row number for error reporting
  _row_email?:    string;          // col G value (User/email), undefined if blank
  _row_hash?:     string;          // row_hash col value (fingerprint written at export), undefined if absent
  _delete?:       boolean;         // Delete? col held the DELETE marker (S107w)
  /**
   * Redak pripada DRUGOM korisniku, a uvozi ga vlasnik Aree (`fix_as_owner`).
   * Update tada ide pod AUTOROVIM `user_id`om, a `edited_by` biljezi tko je
   * ispravljao -- isto sto radi Edit u UI-ju od 043.
   */
  _fixForeign?:   boolean;
}

export interface ParseResult {
  toCreate:   ParsedImportRow[];
  toUpdate:   ParsedImportRow[];
  /** S107w: rows flagged DELETE in the Delete? column — deduped by event_id */
  toDelete:   ParsedImportRow[];
  warnings:   string[];
  errors:     string[];
  legendMapping: LegendMapping;
  foreignRowCount:      number;
  foreignEmailsSummary: Record<string, number>;
  /**
   * Imena Area u kojima tudji retci zive. Modal time zna smije li ponuditi
   * „ispravi kao vlasnik" -- ponuda koja ne moze uspjeti gora je od izostanka.
   */
  foreignAreas:         string[];
  /** S107 D7: UPDATE rows whose row_hash matched (not touched in Excel) — excluded from toUpdate, skipped without any DB call */
  untouchedCount: number;
}

export interface ValidationResult {
  validCreates:   ParsedImportRow[];
  validUpdates:   ParsedImportRow[];
  errors:         string[];
}

/** What the import did to one event — feeds the post-import report (S107w) */
export interface ImportOutcome {
  eventId:   string;
  sourceRow: number;
  result:    'Created' | 'Updated';
  /** Field names an update changed; empty for a create */
  changed:   string[];
}

export interface ApplyResult {
  created:  number;
  updated:  number;
  skipped:  number;
  errors:   string[];
  warnings: string[];
  /** S107w: per-row result of every created/updated event, for the report file */
  outcomes: ImportOutcome[];
}

// ─────────────────────────────────────────────
// Filter state passed to data loader
// ─────────────────────────────────────────────

export interface ExportFilters {
  areaId:     string | null;
  categoryId: string | null;
  dateFrom:   string | null;   // YYYY-MM-DD
  dateTo:     string | null;   // YYYY-MM-DD
  sortOrder:  'asc' | 'desc';
  commentSearch?: string;
  attrFilter?: { attrDefId: string; value: string; isExact: boolean } | null;
}
