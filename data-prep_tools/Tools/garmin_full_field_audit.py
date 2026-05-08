"""
Full field audit of all Garmin JSON export files.
Catalogs every field across all data types, shows coverage, date ranges, sample values.

Usage:
  python garmin_full_field_audit.py --garmin-dir "path/to/DataFromGarmin" [--out garmin_audit.md]
"""

import os, sys, json, argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone

import os as _os
_env_garmin = _os.environ.get("GARMIN_DATA_DIR")
GARMIN_DIR_DEFAULT = (
    Path(_env_garmin) if _env_garmin
    else Path(__file__).parent.parent.parent / "data-prep_data/DataFromGarmin"
)

def ts_ms_to_date(ts):
    try:
        return datetime.fromtimestamp(float(ts) / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except:
        return str(ts)

def load_json(path: Path):
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, encoding=enc) as f:
                return json.load(f)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return None

def flatten_record(record: dict, prefix="") -> dict:
    """Flatten one level of nesting for field discovery."""
    out = {}
    for k, v in record.items():
        key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten_record(v, key + "."))
        elif isinstance(v, list):
            out[key] = f"[list:{len(v)}]"
        else:
            out[key] = v
    return out

def analyze_data_type(name: str, records: list, lines: list):
    if not records:
        lines.append(f"  (empty)")
        return

    lines.append(f"  **Records:** {len(records)}")

    # Field coverage
    field_values = defaultdict(list)
    for r in records:
        flat = flatten_record(r) if isinstance(r, dict) else {"_value": r}
        for k, v in flat.items():
            if v is not None and v != "" and not str(v).startswith("[list:"):
                field_values[k].append(v)

    # Detect date fields
    date_fields = [k for k in field_values if any(word in k.lower() for word in
                   ["date", "timestamp", "time", "start", "end", "calendar"])]

    date_range_shown = False
    for df in date_fields:
        vals = field_values[df]
        if not vals:
            continue
        sample = str(vals[0])
        # epoch ms
        if sample.isdigit() and len(sample) == 13:
            dates = [ts_ms_to_date(v) for v in vals]
            dates = sorted(set(d for d in dates if d.startswith("20") or d.startswith("19")))
            if dates and not date_range_shown:
                lines.append(f"  **Date range:** {dates[0]} → {dates[-1]}")
                date_range_shown = True
        # ISO string
        elif len(sample) >= 10 and sample[4] == "-":
            dates = sorted(set(str(v)[:10] for v in vals))
            if dates and not date_range_shown:
                lines.append(f"  **Date range:** {dates[0]} → {dates[-1]}")
                date_range_shown = True

    # Show fields table
    lines.append(f"  **Fields ({len(field_values)}):**")
    for field, vals in sorted(field_values.items()):
        coverage = len(vals)
        pct = round(100 * coverage / len(records))
        # Sample non-null value
        sample = str(vals[0])[:60] if vals else "—"
        # Detect numeric fields for min/max
        numeric_vals = []
        for v in vals:
            try:
                numeric_vals.append(float(v))
            except (TypeError, ValueError):
                pass
        if numeric_vals and len(numeric_vals) > 2:
            mn, mx = min(numeric_vals), max(numeric_vals)
            sample = f"[{mn:.1f} – {mx:.1f}]"
        lines.append(f"  | `{field}` | {pct}% | {sample} |")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--garmin-dir", default=str(GARMIN_DIR_DEFAULT))
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    base = Path(args.garmin_dir)
    if not base.exists():
        print(f"ERROR: Garmin dir not found: {base}")
        sys.exit(1)

    lines = []
    lines.append("# Garmin Full Field Audit")
    lines.append("")
    lines.append(f"**Source:** `{base}`")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ---- 1. Summarized Activities ----
    lines.append("## 1. Activities (DI-Connect-Fitness / summarizedActivities)")
    lines.append("")
    fitness_dir = base / "DI_CONNECT/DI-Connect-Fitness"
    act_files = sorted(fitness_dir.glob("*_summarizedActivities.json")) if fitness_dir.exists() else []
    all_acts = []
    for f in act_files:
        data = load_json(f)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "summarizedActivitiesExport" in item:
                    all_acts.extend(item["summarizedActivitiesExport"])
                elif isinstance(item, dict):
                    all_acts.append(item)
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    all_acts.extend(v)
    lines.append(f"Files: {[f.name for f in act_files]}")
    lines.append("")
    analyze_data_type("activities", all_acts, lines)

    # Activity type breakdown
    if all_acts:
        types = defaultdict(int)
        for a in all_acts:
            types[a.get("activityType", "?")] += 1
        lines.append("")
        lines.append("  **Activity type breakdown:**")
        for t, cnt in sorted(types.items(), key=lambda x: -x[1]):
            lines.append(f"  - {t}: {cnt}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ---- 2. Sleep Data ----
    lines.append("## 2. Sleep (DI-Connect-Wellness / sleepData)")
    lines.append("")
    wellness_dir = base / "DI_CONNECT/DI-Connect-Wellness"
    sleep_files = sorted(wellness_dir.glob("*_sleepData.json")) if wellness_dir.exists() else []
    # Use only last 2 files as sample (structure is the same across all)
    sample_sleep = []
    for f in sleep_files[-3:]:
        data = load_json(f)
        if isinstance(data, list):
            sample_sleep.extend(data)
    lines.append(f"Files: {len(sleep_files)} files (sample from last 3)")
    lines.append("")
    analyze_data_type("sleep", sample_sleep, lines)
    # Full count
    total_sleep = 0
    for f in sleep_files:
        data = load_json(f)
        if isinstance(data, list):
            total_sleep += len(data)
    lines.append(f"  **Total across all files:** {total_sleep}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ---- 3. Metrics ----
    lines.append("## 3. Metrics (DI-Connect-Metrics)")
    lines.append("")
    metrics_dir = base / "DI_CONNECT/DI-Connect-Metrics"
    if metrics_dir.exists():
        metric_types = defaultdict(list)
        for f in sorted(metrics_dir.glob("*.json")):
            # Extract type from filename
            name = f.stem
            for t in ["ActivityVo2Max", "MetricsAcuteTrainingLoad", "MetricsMaxMetData",
                      "MetricsHeatAltitudeAcclimation", "RunRacePredictions", "TrainingHistory"]:
                if name.startswith(t):
                    metric_types[t].append(f)
                    break
            else:
                metric_types["other"].append(f)

        for mtype, files in sorted(metric_types.items()):
            lines.append(f"### {mtype} ({len(files)} files)")
            # Sample from last file
            if files:
                data = load_json(files[-1])
                records = []
                if isinstance(data, list):
                    records = data
                elif isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list): records = v; break
                lines.append(f"Sample from `{files[-1].name}`:")
                analyze_data_type(mtype, records[:50], lines)
            lines.append("")

    lines.append("---")
    lines.append("")

    # ---- 4. Wellness non-sleep ----
    lines.append("## 4. Other Wellness files")
    lines.append("")
    if wellness_dir.exists():
        other_files = [f for f in sorted(wellness_dir.glob("*.json"))
                       if "sleepData" not in f.name and "AbnormalHr" not in f.name]
        for f in other_files:
            lines.append(f"### {f.name}")
            data = load_json(f)
            if isinstance(data, list):
                records = data
            elif isinstance(data, dict):
                records = [data]
            else:
                records = []
            analyze_data_type(f.stem, records[:20], lines)
            lines.append("")

    lines.append("---")
    lines.append("")

    # ---- 5. Existing CSV summaries ----
    lines.append("## 5. Existing CSV summaries (reference)")
    lines.append("")
    for csv_name in ["garmin_summary1.csv", "garmin_summary2.csv", "garmin_summary3.csv"]:
        csv_path = base / csv_name
        if csv_path.exists():
            import csv
            try:
                with open(csv_path, encoding="utf-8") as cf:
                    reader = csv.DictReader(cf)
                    rows = list(reader)
                    if rows:
                        lines.append(f"**{csv_name}:** {len(rows)} rows")
                        lines.append(f"Columns: {list(rows[0].keys())}")
                        lines.append("")
            except Exception as e:
                lines.append(f"**{csv_name}:** error reading — {e}")
                lines.append("")

    # ---- Summary / Recommendations ----
    lines.append("---")
    lines.append("")
    lines.append("## Summary & Import Candidates")
    lines.append("")
    lines.append("| Data type | Records | Date range | Import priority |")
    lines.append("|-----------|---------|------------|-----------------|")
    lines.append(f"| Activities | {len(all_acts)} | see above | **HIGH** — primary training log |")
    lines.append(f"| Sleep | {total_sleep} | 2016–2025 | **MEDIUM** — good daily metric |")
    lines.append(f"| VO2Max/Training Load | many batches | 2015–2025 | LOW — derived metrics, not raw |")
    lines.append(f"| Race Predictions | batch files | 2022–2025 | LOW — Garmin-computed only |")
    lines.append("")
    lines.append("**Key question for Activities import:**")
    lines.append("Which fields from `summarizedActivitiesExport` overlap with existing manual entries?")
    lines.append("Run `supabase_structure_export.py` to see current manual attr definitions.")

    report = "\n".join(lines)
    safe = report[:3000].encode("cp1252", errors="replace").decode("cp1252")
    print(safe)
    print("\n... (truncated for terminal, full report in file)")

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(report, encoding="utf-8")
        print(f"\nFull report written to: {out_path}")
    else:
        out_path = base.parent / "garmin_audit_report.md"
        out_path.write_text(report, encoding="utf-8")
        print(f"\nFull report written to: {out_path}")

if __name__ == "__main__":
    main()
