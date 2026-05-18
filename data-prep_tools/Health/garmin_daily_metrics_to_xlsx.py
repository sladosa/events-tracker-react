# -*- coding: utf-8 -*-
"""
garmin_daily_metrics_to_xlsx.py
================================
Generates an app-importable xlsx for Area: Health_Sasa
  L1: Daily_metrics  →  L2 leaf: Garmin_data

Data sources (all from DataFromGarmin GDPR export):
  UDS     DI-Connect-Aggregator/UDSFile_*.json  → hr_rest, hr_min, body_battery
  VO2max  DI-Connect-Metrics/ActivityVo2Max_*.json + MetricsMaxMetData_*.json → vo2max
  Sleep   DI-Connect-Wellness/*sleepData*.json  → sleep_score, deep_min, rem_min, etc.
          *** Currently missing from export — script handles gracefully (empty columns) ***
          *** When files become available, point SLEEP_DIR to their folder            ***

Usage:
  python garmin_daily_metrics_to_xlsx.py
  python garmin_daily_metrics_to_xlsx.py --out Health_daily_v2.xlsx
  python garmin_daily_metrics_to_xlsx.py --from 2020-01-01 --to 2025-12-31

Output: data-prep_data/Health/Health_daily_import.xlsx
"""

import sys, os, json, glob, argparse
from pathlib import Path
from datetime import date, datetime, timedelta
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
except ImportError:
    print("ERROR: pip install openpyxl"); sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
TOOLS_DIR    = SCRIPT_DIR.parent / "Tools"
GARMIN_DIR   = SCRIPT_DIR.parent.parent / "data-prep_data" / "DataFromGarmin"
DI_CONNECT   = GARMIN_DIR / "DI_CONNECT"
UDS_DIR      = DI_CONNECT / "DI-Connect-Aggregator"
METRICS_DIR  = DI_CONNECT / "DI-Connect-Metrics"
SLEEP_DIR    = DI_CONNECT / "DI-Connect-Wellness"   # missing from current export
OUTPUT_DIR   = SCRIPT_DIR.parent.parent / "data-prep_data" / "Health"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── App config ─────────────────────────────────────────────────────────────────
AREA       = "Health_Sasa"
CAT_PATH   = "Daily_metrics > Garmin_data"     # WITHOUT area name
USER_EMAIL = "sasasladoljev59@gmail.com"

# ── Attribute definitions ──────────────────────────────────────────────────────
# (name, slug, type, unit, description)
ATTRS = [
    # UDS — always available
    ("HR Rest",          "hr_rest",           "number", "bpm",       "Garmin resting heart rate (daily)"),
    ("HR Min",           "hr_min",            "number", "bpm",       "Lowest HR recorded during the day"),
    ("Body Battery High","body_battery_high",  "number", "",          "Peak body battery level (0-100)"),
    ("Body Battery Low", "body_battery_low",   "number", "",          "Lowest body battery level (0-100)"),
    # VO2max — from activity-linked measurements
    ("VO2max",           "vo2max",            "number", "ml/kg/min", "VO2max estimate from activity"),
    # Sleep — stubs (DI-Connect-Wellness files missing from current export)
    ("Sleep Score",      "sleep_score",        "number", "",          "Garmin overall sleep quality (0-100)"),
    ("Recovery Score",   "recovery_score",     "number", "",          "Garmin sleep recovery score (0-100)"),
    ("Deep Sleep",       "deep_min",           "number", "min",       "Deep sleep duration"),
    ("REM Sleep",        "rem_min",            "number", "min",       "REM sleep duration"),
    ("Light Sleep",      "light_min",          "number", "min",       "Light sleep duration"),
    ("Awake Count",      "awake_count",        "number", "",          "Number of awakenings during sleep"),
    # HRV — stub (not available in GDPR export)
    # ("HRV Night",      "hrv_night",         "number", "ms",        "Overnight HRV — manual entry"),
]

# ── Formatting ─────────────────────────────────────────────────────────────────
def _fill(h): return PatternFill("solid", fgColor=h)
def _font(**kw): return Font(**kw)
def _side(): return Side(style="thin")
def _border(): return Border(left=_side(), right=_side(), top=_side(), bottom=_side())

BORDER    = _border()
ALIGN_L   = Alignment(horizontal="left",   vertical="center", wrap_text=False)
ALIGN_C   = Alignment(horizontal="center", vertical="center")
FILL_BLUE = _fill("4472C4")
FILL_PURP = _fill("7030A0")
FILL_ATTR = _fill("DDEBF7")
FILL_STRU = _fill("E2EFDA")
FILL_WARN = _fill("FFF2CC")
FONT_WHT  = _font(bold=True, color="FFFFFF")
FONT_BOLD = _font(bold=True, size=12)
FONT_WARN = _font(bold=True, color="C55A11")

def col_letter(n):
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s

FIXED = 8   # cols A-H
ATTR_START = FIXED + 1   # col I onward

# ── Data loading ───────────────────────────────────────────────────────────────

def load_uds(date_from: date, date_to: date) -> dict[str, dict]:
    """Load UDS files → {calendarDate: {hr_rest, hr_min, body_battery_high, body_battery_low}}"""
    files = sorted(UDS_DIR.glob("UDSFile_*.json"))
    print(f"UDS files found: {len(files)}")
    daily = {}
    for fp in files:
        records = json.loads(fp.read_text(encoding="utf-8"))
        for rec in records:
            cal = rec.get("calendarDate")
            if not cal:
                continue
            try:
                d = date.fromisoformat(str(cal)[:10])
            except ValueError:
                continue
            if d < date_from or d > date_to:
                continue
            dkey = d.isoformat()
            row = {"hr_rest": None, "hr_min": None,
                   "body_battery_high": None, "body_battery_low": None}
            rhr = rec.get("restingHeartRate") or rec.get("currentDayRestingHeartRate")
            if rhr:
                row["hr_rest"] = int(rhr)
            minh = rec.get("minHeartRate")
            if minh:
                row["hr_min"] = int(minh)
            bb = rec.get("bodyBattery")
            if isinstance(bb, dict):
                for stat in bb.get("bodyBatteryStatList", []):
                    t = stat.get("bodyBatteryStatType", "")
                    v = stat.get("statsValue")
                    if t == "HIGHEST" and v is not None:
                        row["body_battery_high"] = int(v)
                    elif t == "LOWEST" and v is not None:
                        row["body_battery_low"] = int(v)
            # Keep later record for same date (newer file wins)
            if dkey not in daily or any(v is not None for v in row.values()):
                daily[dkey] = {**daily.get(dkey, {}), **{k: v for k, v in row.items() if v is not None}}
    print(f"UDS records loaded: {len(daily)} unique dates")
    return daily


def load_vo2max(date_from: date, date_to: date) -> dict[str, float]:
    """Load VO2max per calendar date from ActivityVo2Max and MetricsMaxMetData files."""
    vo2 = {}
    # ActivityVo2Max — activity-level, per calendarDate
    for fp in sorted(METRICS_DIR.glob("ActivityVo2Max_*.json")):
        records = json.loads(fp.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            records = [records]
        for rec in records:
            cal = rec.get("calendarDate")
            val = rec.get("vo2MaxValue")
            if cal and val is not None:
                try:
                    d = date.fromisoformat(str(cal)[:10])
                except ValueError:
                    continue
                if date_from <= d <= date_to:
                    vo2[d.isoformat()] = float(val)
    # MetricsMaxMetData — supplementary (newer devices)
    for fp in sorted(METRICS_DIR.glob("MetricsMaxMetData_*.json")):
        records = json.loads(fp.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            records = [records]
        for rec in records:
            cal = rec.get("calendarDate")
            val = rec.get("vo2MaxValue")
            if cal and val is not None:
                try:
                    d = date.fromisoformat(str(cal)[:10])
                except ValueError:
                    continue
                if date_from <= d <= date_to:
                    # Don't overwrite ActivityVo2Max if already present
                    vo2.setdefault(d.isoformat(), float(val))
    print(f"VO2max records loaded: {len(vo2)} dates (ActivityVo2Max + MetricsMaxMetData)")
    return vo2


def load_sleep(date_from: date, date_to: date) -> dict[str, dict]:
    """Load sleep data from DI-Connect-Wellness if available."""
    sleep_files = list(SLEEP_DIR.glob("*sleepData*.json")) if SLEEP_DIR.exists() else []
    if not sleep_files:
        print("⚠ Sleep files NOT FOUND — DI-Connect-Wellness missing from export.")
        print("  Sleep columns will be empty. Re-run when files are available.")
        return {}
    print(f"Sleep files found: {len(sleep_files)}")
    daily = {}
    for fp in sorted(sleep_files):
        records = json.loads(fp.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            records = [records]
        for rec in records:
            cal = rec.get("calendarDate")
            if not cal:
                continue
            try:
                d = date.fromisoformat(str(cal)[:10])
            except ValueError:
                continue
            if d < date_from or d > date_to:
                continue
            scores = rec.get("sleepScores") or {}
            row = {
                "sleep_score":    scores.get("overallScore"),
                "recovery_score": scores.get("recoveryScore"),
                "deep_min":       _sec_to_min(rec.get("deepSleepSeconds")),
                "rem_min":        _sec_to_min(rec.get("remSleepSeconds")),
                "light_min":      _sec_to_min(rec.get("lightSleepSeconds")),
                "awake_count":    rec.get("awakeCount"),
            }
            daily[d.isoformat()] = {k: v for k, v in row.items() if v is not None}
    print(f"Sleep records loaded: {len(daily)} unique dates")
    return daily


def _sec_to_min(v) -> float | None:
    if v is None:
        return None
    try:
        return round(float(v) / 60, 1)
    except (TypeError, ValueError):
        return None


# ── Merge per date ─────────────────────────────────────────────────────────────

def merge_daily(uds: dict, vo2: dict, sleep: dict) -> list[dict]:
    """Merge all sources. One event per day. Skip days with no attribute data at all."""
    attr_keys = {a[1] for a in ATTRS}
    events = []
    # Start from UDS dates, add VO2max-only dates not in UDS
    all_dates = sorted(set(uds.keys()) | set(vo2.keys()))
    for dkey in all_dates:
        row = {"date": dkey}
        row.update(uds.get(dkey, {}))
        if dkey in vo2:
            row["vo2max"] = vo2[dkey]
        if dkey in sleep:
            row.update(sleep[dkey])
        # Skip if no actual attribute value exists
        if not any(row.get(k) is not None for k in attr_keys):
            continue
        events.append(row)
    return events


# ── Build Events sheet ─────────────────────────────────────────────────────────

def build_events_sheet(ws, events: list[dict]):
    ws.title = "Events"
    n_attr = len(ATTRS)
    attr_letters = [col_letter(ATTR_START + i) for i in range(n_attr)]
    attr_names   = [a[0] for a in ATTRS]
    row = 1

    # ATTRIBUTE LEGEND
    ws.cell(row, 1, "ATTRIBUTE LEGEND:").font = FONT_BOLD
    row += 1
    for ci, h in enumerate(["Col","Area","Category_Path","Attribute","Type","Unit"], 1):
        c = ws.cell(row, ci, h)
        c.fill = FILL_PURP; c.font = FONT_WHT; c.alignment = ALIGN_C; c.border = BORDER
    row += 1
    for i, (name, slug, dtype, unit, _desc) in enumerate(ATTRS):
        data = [attr_letters[i], AREA, CAT_PATH, name, dtype, unit or None]
        for ci, v in enumerate(data, 1):
            c = ws.cell(row, ci, v)
            c.fill = FILL_ATTR; c.border = BORDER; c.alignment = ALIGN_L
        row += 1
    row += 1  # blank

    # EVENT DATA
    ws.cell(row, 1, "EVENT DATA:").font = FONT_BOLD
    row += 1
    fixed_hdrs = ["event_id","Area","Category_Path","event_date","session_start",
                  "created_at","User","leaf comment"]
    for ci, h in enumerate(fixed_hdrs + attr_names, 1):
        c = ws.cell(row, ci, h)
        c.fill = FILL_BLUE; c.font = FONT_WHT; c.alignment = ALIGN_C; c.border = BORDER
    ws.row_dimensions[row].height = 28
    row += 1

    attr_key_map = {a[0]: a[1] for a in ATTRS}  # name → slug key in event dict

    for ev in events:
        fixed = [None, AREA, CAT_PATH, ev["date"], "07:00", None, USER_EMAIL, None]
        attr_vals = [ev.get(attr_key_map[name]) for name in attr_names]
        for ci, v in enumerate(fixed + attr_vals, 1):
            ws.cell(row, ci, v)
        row += 1

    # Column widths
    col_widths = [12, 14, 34, 12, 14, 12, 26, 18] + [14] * n_attr
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[col_letter(i)].width = w


# ── Build Structure sheet ──────────────────────────────────────────────────────

STRUCTURE_HEADERS = [
    "Type","IsLeaf","Area","SharedWith","CategoryPath","Sort",
    "AttrName","Slug","AttrType","IsRequired","Val.Type","Default",
    "Val.Max (no)","Unit","TextOptions/Val.Min","DependsOn","WhenValue","Description"
]

def build_structure_sheet(ws):
    ws.title = "Structure"
    # Header row
    for ci, h in enumerate(STRUCTURE_HEADERS, 1):
        c = ws.cell(1, ci, h)
        c.fill = FILL_STRU; c.font = _font(bold=True); c.border = BORDER; c.alignment = ALIGN_C
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["E"].width = 44
    ws.column_dimensions["R"].width = 44
    row = 2

    def srow(type_, cat_path, is_leaf="", attr_name="", slug="", attr_type="",
             required="FALSE", unit="", description="", sort=0):
        vals = [type_, is_leaf, AREA, "", f"{AREA} > {cat_path}", sort,
                attr_name, slug, attr_type, required, "", "", "", unit, "", "", "", description]
        for ci, v in enumerate(vals, 1):
            c = ws.cell(row, ci, v or None)
            c.border = BORDER; c.alignment = ALIGN_L
        return row + 1

    # Area (must exist — leave for reference only)
    # L1 category
    row = srow("Category", "Daily_metrics", sort=1)
    # L2 leaf
    row = srow("Category", "Daily_metrics > Garmin_data", is_leaf="TRUE", sort=1)
    # Attributes
    for i, (name, slug, dtype, unit, desc) in enumerate(ATTRS, 1):
        row = srow("Attribute", "Daily_metrics > Garmin_data",
                   attr_name=name, slug=slug, attr_type=dtype,
                   unit=unit, description=desc, sort=i)


# ── Build Info sheet ───────────────────────────────────────────────────────────

def build_info_sheet(ws, n_events: int, n_vo2: int, n_sleep: int):
    ws.title = "Info"
    info = [
        ["Generated", datetime.now().strftime("%Y-%m-%d %H:%M")],
        ["Script", "garmin_daily_metrics_to_xlsx.py"],
        ["Area", AREA],
        ["Category", CAT_PATH],
        ["Events total", n_events],
        ["VO2max dates", n_vo2],
        ["Sleep dates", n_sleep],
        ["", ""],
        ["SLEEP STATUS", "⚠ DI-Connect-Wellness missing — sleep columns empty"],
        ["HRV STATUS",   "⚠ Not available in GDPR export — field commented out"],
        ["", ""],
        ["UDS source",     str(UDS_DIR)],
        ["Metrics source", str(METRICS_DIR)],
        ["Sleep source",   str(SLEEP_DIR)],
    ]
    for r, (k, v) in enumerate(info, 1):
        ws.cell(r, 1, k).font = _font(bold=True)
        c = ws.cell(r, 2, str(v) if v is not None else "")
        if "⚠" in str(v):
            c.fill = FILL_WARN; c.font = FONT_WARN
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 70


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="date_from", default="2014-01-01",
                    help="Start date YYYY-MM-DD (default: 2014-01-01)")
    ap.add_argument("--to",   dest="date_to",   default="2025-12-31",
                    help="End date YYYY-MM-DD (default: 2025-12-31)")
    ap.add_argument("--out",  default="Health_daily_import.xlsx",
                    help="Output filename (default: Health_daily_import.xlsx)")
    args = ap.parse_args()

    date_from = date.fromisoformat(args.date_from)
    date_to   = date.fromisoformat(args.date_to)
    print(f"Date range: {date_from} → {date_to}")

    uds   = load_uds(date_from, date_to)
    vo2   = load_vo2max(date_from, date_to)
    sleep = load_sleep(date_from, date_to)
    events = merge_daily(uds, vo2, sleep)
    print(f"Total events to write: {len(events)}")

    if not events:
        print("ERROR: no events generated — check UDS files path"); sys.exit(1)

    out_path = OUTPUT_DIR / args.out
    wb = openpyxl.Workbook()
    build_events_sheet(wb.active, events)
    build_structure_sheet(wb.create_sheet())
    build_info_sheet(wb.create_sheet(), len(events), len(vo2), len(sleep))
    wb.save(out_path)
    print(f"\n✓ Saved: {out_path}")
    print(f"  {len(events)} events | {len(vo2)} VO2max dates | {len(sleep)} sleep dates")
    print(f"  Attributes: {', '.join(a[0] for a in ATTRS)}")


if __name__ == "__main__":
    main()
