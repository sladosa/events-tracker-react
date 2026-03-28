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
  data_type: string;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  validation_rules: unknown;
  sort_order: number;
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
}

// ─────────────────────────────────────────────
// Import types
// ─────────────────────────────────────────────

/** Mapping from Excel column letter → (area, category_path, attr_name) */
export type LegendMapping = Record<string, { area: string; categoryPath: string; attrName: string }>;

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
}

export interface ParseResult {
  toCreate:   ParsedImportRow[];
  toUpdate:   ParsedImportRow[];
  warnings:   string[];
  errors:     string[];
  legendMapping: LegendMapping;
}

export interface ValidationResult {
  validCreates:   ParsedImportRow[];
  validUpdates:   ParsedImportRow[];
  errors:         string[];
}

export interface ApplyResult {
  created:  number;
  updated:  number;
  skipped:  number;
  errors:   string[];
  warnings: string[];
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
}
