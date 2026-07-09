/**
 * Events Tracker – Excel Row Fingerprint (S107, D7 — row_hash skip)
 * ==================================================================
 * Shared between excelExport.ts and excelImport.ts.
 *
 * Export writes a fingerprint of every event row into a `row_hash` column.
 * Import recomputes the fingerprint from the row as parsed back from Excel:
 * if it matches, the row was NOT touched in Excel → skip entirely (no DB
 * reads, no writes). This protects historical records from accidental Excel
 * edits (wrong sort, drag-fill) AND from stale exports overwriting changes
 * made in the app after the export.
 *
 * Safety property: both sides canonicalise values the same way (trimmed
 * strings, String(number/boolean), dates as YYYY-MM-DD / HH:MM text). If any
 * Excel roundtrip quirk ever makes the two sides disagree, the only
 * consequence is a MISSED skip — the row falls through to the normal
 * hasChanges() DB diff. A false "unchanged" would require a hash collision
 * against the stored value (~2^-64 per row).
 */

/** Header text of the fingerprint column in the EVENT DATA section. */
export const ROW_HASH_HEADER = 'row_hash';

// Non-printable separators prevent field-boundary ambiguity in the canonical string
const FIELD_SEP = String.fromCharCode(1);
const ATTR_SEP  = String.fromCharCode(2);

export interface RowFingerprintInput {
  event_id:      string;
  area:          string;
  category_path: string;
  event_date:    string;   // YYYY-MM-DD
  session_start: string;   // HH:MM
  created_at:    string;   // HH:mm:ss ('' if blank)
  user_email:    string;   // '' if blank
  comment:       string;
  attributes:    Record<string, string | number | boolean | null>;
}

/** Canonicalise one attribute value the way excelImport's parseDataRows sees it. */
function canonValue(value: string | number | boolean | null): string | null {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** FNV-1a 64-bit hash → 16 hex chars. */
function fnv1a64(str: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask  = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Compute the row fingerprint. Attribute entries with empty/null values are
 * excluded (import ignores empty cells — P3), remaining entries are sorted by
 * attribute name so column order never affects the hash.
 */
export function computeRowFingerprint(input: RowFingerprintInput): string {
  const attrParts: string[] = [];
  for (const name of Object.keys(input.attributes).sort()) {
    const v = canonValue(input.attributes[name]);
    if (v == null) continue;
    attrParts.push(`${name}=${v}`);
  }

  const canonical = [
    input.event_id.trim(),
    input.area.trim(),
    input.category_path.trim(),
    input.event_date.trim(),
    input.session_start.trim(),
    input.created_at.trim(),
    input.user_email.trim(),
    input.comment.trim(),
    attrParts.join(ATTR_SEP),
  ].join(FIELD_SEP);

  return fnv1a64(canonical);
}
