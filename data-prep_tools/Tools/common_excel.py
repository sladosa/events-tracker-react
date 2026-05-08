"""
common_excel.py — Shared utilities for Events Tracker data preparation scripts.
Import from any script in subdirectories:
    import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Tools'))
    from common_excel import excel_date, structure_headers, write_structure_row
"""

from datetime import date, datetime, timedelta
from typing import Any

# ── Excel serial date → Python date ───────────────────────────────────────────
# Excel counts days from 1899-12-30 (Windows epoch).
EXCEL_EPOCH = date(1899, 12, 30)

def excel_date(serial: Any) -> date | None:
    """Convert Excel serial number or string to Python date. Returns None if invalid."""
    if serial is None:
        return None
    if isinstance(serial, (datetime,)):
        return serial.date()
    if isinstance(serial, date):
        return serial
    try:
        n = int(float(serial))
        return EXCEL_EPOCH + timedelta(days=n)
    except (ValueError, TypeError, OverflowError):
        return None

def excel_date_str(serial: Any) -> str:
    """Return ISO date string (YYYY-MM-DD) or empty string."""
    d = excel_date(serial)
    return d.isoformat() if d else ""

# ── Structure Import Excel — column order ──────────────────────────────────────
STRUCTURE_HEADERS = [
    "Type",               # A  Area | Category | Attribute
    "IsLeaf",             # B  (auto, leave empty)
    "Area",               # C  (auto, leave empty)
    "SharedWith",         # D  (leave empty)
    "CategoryPath",       # E  "Health > Medical > Lab Results"
    "Sort",               # F  sort_order number
    "AttrName",           # G  attribute name
    "Slug",               # H  leave empty → auto-generated
    "AttrType",           # I  number | text | boolean | datetime | link | image
    "IsRequired",         # J  TRUE | FALSE
    "Val.Type",           # K  suggest | none
    "Default",            # L  default value
    "Val.Max (no)",       # M  max value for numbers
    "Unit",               # N  unit of measurement
    "TextOptions/Val.Min",# O  pipe-separated options for suggest, or min for numbers
    "DependsOn",          # P  parent attr slug (for dependent suggest)
    "WhenValue",          # Q  * or specific value (for dependent suggest)
    "Description",        # R  description / reference ranges
]

STRUCTURE_COL = {h: i+1 for i, h in enumerate(STRUCTURE_HEADERS)}

# ── Events Import Excel — fixed columns ───────────────────────────────────────
# Column indices match the app's excelImport.ts expectations (1-based).
# Sheet name: "Activities Events"
EVENTS_HEADERS = [
    "Session_Start",      # A  ISO datetime "2024-03-15 09:30"
    "Session_End",        # B  ISO datetime or empty
    "Category_Path",      # C  "Domacinstvo > Automobili > Gorivo" (NO area name)
    "Comment",            # D  free text comment
    "User",               # E  email of the owner (leave empty for own events)
]
# Note: attribute columns start at F onward (dynamic, not fixed)

# ── Formatting helpers ────────────────────────────────────────────────────────

def iso_datetime(d: date, hour: int = 8, minute: int = 0) -> str:
    """Return 'YYYY-MM-DD HH:MM' string suitable for Session_Start column."""
    return f"{d.isoformat()} {hour:02d}:{minute:02d}"
