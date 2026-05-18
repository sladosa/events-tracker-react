"""
Inspect events and attributes in Supabase for a given area/category.
Uses service role key (bypasses RLS) — read-only queries only.

Usage examples:
  python db_inspector.py --area "Health_Saša"
  python db_inspector.py --area "Health_Saša" --category "Lab Results" --limit 10
  python db_inspector.py --area "Health_Saša" --category "Lab Results" --fields comment
  python db_inspector.py --area "Fitness_Garmin" --category "Outdoor" --fields pace,distance,location --limit 5
  python db_inspector.py --area "Fitness_Garmin" --check duplicates
  python db_inspector.py --area "Health_Saša" --check ranges
  python db_inspector.py --area "Health_Saša" --check empty
"""

import os, sys, json, argparse
from pathlib import Path
from datetime import datetime


def load_env(env_file: str) -> dict:
    env = {}
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fmt_val(v, data_type="text"):
    if v is None:
        return "—"
    if data_type == "datetime" and isinstance(v, str):
        try:
            return v[:16].replace("T", " ")
        except:
            return str(v)
    s = str(v)
    return s[:60] + "…" if len(s) > 60 else s


def main():
    parser = argparse.ArgumentParser(description="Inspect Supabase events/attributes")
    parser.add_argument("--area", help="Area name or slug (case-insensitive)")
    parser.add_argument("--category", help="Category name or slug (case-insensitive)")
    parser.add_argument("--fields", help="Comma-separated attr slugs to show (default: all)")
    parser.add_argument("--limit", type=int, default=20, help="Max events to show (0 = all)")
    parser.add_argument("--check", choices=["duplicates", "ranges", "empty"],
                        help="PROD-ready checks instead of event listing")
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--email", default="sasasladoljev59@gmail.com")
    args = parser.parse_args()

    if not args.area:
        parser.print_help()
        sys.exit(1)

    # Resolve env file relative to repo root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent
    env_path = repo_root / args.env
    if not env_path.exists():
        print(f"ERROR: env file not found: {env_path}")
        sys.exit(1)

    env = load_env(str(env_path))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in env file")
        sys.exit(1)

    from supabase import create_client
    sb = create_client(url, key)

    # --- Resolve user_id ---
    profile_res = sb.table("profiles").select("id, email, display_name").eq("email", args.email).execute()
    if not profile_res.data:
        print(f"ERROR: no profile for '{args.email}'")
        sys.exit(1)
    user = profile_res.data[0]
    user_id = user["id"]

    # --- Find area ---
    areas_res = sb.table("areas").select("id, name, slug").eq("user_id", user_id).execute()
    area_query = args.area.lower()
    area = next((a for a in areas_res.data
                 if a["name"].lower() == area_query or a["slug"].lower() == area_query), None)
    if not area:
        names = [a["name"] for a in areas_res.data]
        print(f"ERROR: area '{args.area}' not found. Available: {names}")
        sys.exit(1)

    # --- Load categories for this area ---
    cats_res = sb.table("categories").select(
        "id, parent_category_id, name, slug, level"
    ).eq("area_id", area["id"]).order("level").order("name").execute()
    cats = cats_res.data
    cat_by_id = {c["id"]: c for c in cats}

    def is_leaf(cat_id):
        return not any(c["parent_category_id"] == cat_id for c in cats)

    def full_path(cat_id):
        parts = []
        cid = cat_id
        while cid:
            c = cat_by_id.get(cid)
            if not c:
                break
            parts.append(c["name"])
            cid = c["parent_category_id"]
        parts.append(area["name"])
        return " > ".join(reversed(parts))

    # --- Resolve target category (if --category given) ---
    target_cats = cats
    if args.category:
        cat_query = args.category.lower()
        match = next((c for c in cats
                      if c["name"].lower() == cat_query or c["slug"].lower() == cat_query), None)
        if not match:
            cat_names = [c["name"] for c in cats]
            print(f"ERROR: category '{args.category}' not found in area '{area['name']}'.")
            print(f"Available: {cat_names}")
            sys.exit(1)
        target_cats = [match]
    else:
        # Default: only leaf categories (they have events)
        target_cats = [c for c in cats if is_leaf(c["id"])]

    cat_ids = [c["id"] for c in target_cats]

    # --- Load attr defs for target categories ---
    all_attr_defs = []
    chunk_size = 50
    for i in range(0, len(cat_ids), chunk_size):
        chunk = cat_ids[i:i + chunk_size]
        res = sb.table("attribute_definitions").select(
            "id, category_id, name, slug, data_type, sort_order, unit, description"
        ).in_("category_id", chunk).order("sort_order").execute()
        all_attr_defs.extend(res.data)

    attr_defs_by_cat = {}
    for a in all_attr_defs:
        attr_defs_by_cat.setdefault(a["category_id"], []).append(a)

    # Also load parent attr defs (inherited attrs on parent categories)
    parent_cat_ids = list({c["parent_category_id"] for c in target_cats if c["parent_category_id"]})
    all_parent_attr_defs = []
    if parent_cat_ids:
        for i in range(0, len(parent_cat_ids), chunk_size):
            chunk = parent_cat_ids[i:i + chunk_size]
            res = sb.table("attribute_definitions").select(
                "id, category_id, name, slug, data_type, sort_order, unit, description"
            ).in_("category_id", chunk).order("sort_order").execute()
            all_parent_attr_defs.extend(res.data)
        for a in all_parent_attr_defs:
            attr_defs_by_cat.setdefault(a["category_id"], []).append(a)

    # --- AREA SUMMARY MODE (no --category) ---
    if not args.category and not args.check:
        print(f"\n# Area: {area['name']} (`{area['slug']}`)\n")
        print(f"**User:** {user['email']}")
        print()

        events_res = sb.table("events").select("id, category_id, session_start").eq("user_id", user_id).in_("category_id", [c["id"] for c in cats]).execute()
        event_counts = {}
        dates_by_cat = {}
        for e in events_res.data:
            cid = e["category_id"]
            event_counts[cid] = event_counts.get(cid, 0) + 1
            ss = e.get("session_start", "")
            if ss:
                dates_by_cat.setdefault(cid, []).append(ss)

        total = sum(event_counts.values())
        print(f"**Total events:** {total}\n")

        def print_node(cat, indent=0):
            prefix = "  " * indent
            n = event_counts.get(cat["id"], 0)
            leaf = "🍃" if is_leaf(cat["id"]) else "📁"
            dates = dates_by_cat.get(cat["id"], [])
            date_range = ""
            if dates:
                dates.sort()
                date_range = f"  [{dates[0][:10]} … {dates[-1][:10]}]"
            attrs = attr_defs_by_cat.get(cat["id"], [])
            attr_str = f"  ({len(attrs)} attrs)" if attrs else ""
            print(f"{prefix}{leaf} **{cat['name']}** — {n} events{date_range}{attr_str}")
            for child in sorted([c for c in cats if c["parent_category_id"] == cat["id"]], key=lambda x: x["name"]):
                print_node(child, indent + 1)

        top_level = [c for c in cats if c["parent_category_id"] is None]
        for cat in sorted(top_level, key=lambda x: x["name"]):
            print_node(cat)
        print()
        return

    # --- CHECK MODES ---
    if args.check:
        print(f"\n# Check: {args.check} — {area['name']}" + (f" > {args.category}" if args.category else "") + "\n")

        # Load all events for target cats
        events_res = sb.table("events").select(
            "id, category_id, session_start, chain_key, comment"
        ).eq("user_id", user_id).in_("category_id", cat_ids).execute()
        events = events_res.data

        if args.check == "duplicates":
            seen = {}
            dupes = []
            for e in events:
                key = (e["category_id"], e["session_start"])
                if key in seen:
                    dupes.append((seen[key], e))
                else:
                    seen[key] = e
            if not dupes:
                print(f"✅ No duplicates found across {len(events)} events.")
            else:
                print(f"⚠️  {len(dupes)} duplicate pairs found:\n")
                for a, b in dupes[:20]:
                    cat_name = cat_by_id.get(a["category_id"], {}).get("name", "?")
                    print(f"  - {cat_name} | {a['session_start'][:16]} | IDs: {a['id'][:8]}… vs {b['id'][:8]}…")
                if len(dupes) > 20:
                    print(f"  … and {len(dupes)-20} more")

        elif args.check == "empty":
            # Load all event_attributes
            event_ids = [e["id"] for e in events]
            all_ea = []
            for i in range(0, len(event_ids), 200):
                chunk = event_ids[i:i+200]
                res = sb.table("event_attributes").select(
                    "event_id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean"
                ).in_("event_id", chunk).execute()
                all_ea.extend(res.data)

            filled_by_event = {}
            for ea in all_ea:
                if any(ea.get(f) is not None for f in ["value_text", "value_number", "value_datetime", "value_boolean"]):
                    filled_by_event.setdefault(ea["event_id"], set()).add(ea["attribute_definition_id"])

            all_attr_ids = {a["id"] for a in all_attr_defs + all_parent_attr_defs}
            empty_count = sum(1 for e in events if not filled_by_event.get(e["id"]))
            print(f"Events with zero attrs filled: {empty_count} / {len(events)}")

            # Per-attr fill rate
            attr_fill = {}
            for ea in all_ea:
                if any(ea.get(f) is not None for f in ["value_text", "value_number", "value_datetime", "value_boolean"]):
                    attr_fill[ea["attribute_definition_id"]] = attr_fill.get(ea["attribute_definition_id"], 0) + 1

            print("\nAttr fill rates:\n")
            print(f"{'Attr':<30} {'Type':<12} {'Filled':>8} {'%':>6}")
            print("-" * 60)
            for a in sorted(all_attr_defs + all_parent_attr_defs, key=lambda x: x["sort_order"]):
                filled = attr_fill.get(a["id"], 0)
                pct = f"{100*filled/len(events):.0f}%" if events else "—"
                print(f"{a['name'][:30]:<30} {a['data_type']:<12} {filled:>8} {pct:>6}")

        elif args.check == "ranges":
            event_ids = [e["id"] for e in events]
            all_ea = []
            for i in range(0, len(event_ids), 200):
                chunk = event_ids[i:i+200]
                res = sb.table("event_attributes").select(
                    "attribute_definition_id, value_number"
                ).in_("event_id", chunk).not_.is_("value_number", "null").execute()
                all_ea.extend(res.data)

            values_by_attr = {}
            for ea in all_ea:
                values_by_attr.setdefault(ea["attribute_definition_id"], []).append(ea["value_number"])

            num_attrs = [a for a in all_attr_defs + all_parent_attr_defs if a["data_type"] == "number"]
            if not num_attrs:
                print("No number attributes found.")
                return

            print(f"{'Attr':<30} {'Unit':<8} {'N':>6} {'Min':>12} {'Max':>12} {'Avg':>12}")
            print("-" * 82)
            for a in sorted(num_attrs, key=lambda x: x["sort_order"]):
                vals = values_by_attr.get(a["id"], [])
                if not vals:
                    print(f"{a['name'][:30]:<30} {(a.get('unit') or ''):<8} {'0':>6} {'—':>12} {'—':>12} {'—':>12}")
                    continue
                mn, mx, avg = min(vals), max(vals), sum(vals)/len(vals)
                unit = a.get("unit") or ""
                print(f"{a['name'][:30]:<30} {unit:<8} {len(vals):>6} {mn:>12.3g} {mx:>12.3g} {avg:>12.3g}")
        return

    # --- EVENT LISTING MODE (--category required) ---
    target_cat = target_cats[0]
    print(f"\n# Events: {full_path(target_cat['id'])}\n")
    print(f"**User:** {user['email']}")

    # Load events for this category
    q = sb.table("events").select(
        "id, session_start, comment, chain_key"
    ).eq("user_id", user_id).eq("category_id", target_cat["id"]).order("session_start", desc=True)
    if args.limit > 0:
        q = q.limit(args.limit)
    events_res = q.execute()
    events = events_res.data

    print(f"**Showing:** {len(events)} events" + (f" (limit {args.limit})" if args.limit else "") + "\n")

    if not events:
        print("No events found.")
        return

    # Determine which attr defs to show
    # Leaf attrs + parent attrs (full chain would need recursion, use direct parent for now)
    leaf_attrs = attr_defs_by_cat.get(target_cat["id"], [])
    parent_id = target_cat.get("parent_category_id")
    parent_attrs = attr_defs_by_cat.get(parent_id, []) if parent_id else []
    all_show_attrs = parent_attrs + leaf_attrs  # parent first (higher level)

    if args.fields:
        wanted = set(f.strip() for f in args.fields.split(","))
        # Always include comment if requested
        show_comment = "comment" in wanted
        wanted.discard("comment")
        all_show_attrs = [a for a in all_show_attrs if a["slug"] in wanted]
    else:
        show_comment = True

    # Load event_attributes for these events
    event_ids = [e["id"] for e in events]
    ea_res = sb.table("event_attributes").select(
        "event_id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean"
    ).in_("event_id", event_ids).execute()

    attr_def_by_id = {a["id"]: a for a in all_show_attrs}
    ea_by_event = {}
    for ea in ea_res.data:
        if ea["attribute_definition_id"] in attr_def_by_id:
            ea_by_event.setdefault(ea["event_id"], {})[ea["attribute_definition_id"]] = ea

    # --- Render table ---
    # Header
    col_headers = ["Date"]
    if show_comment:
        col_headers.append("Comment")
    for a in all_show_attrs:
        unit = f" ({a['unit']})" if a.get("unit") else ""
        col_headers.append(f"{a['name']}{unit}")

    # Separator
    sep = " | "
    print(sep.join(f"**{h}**" for h in col_headers))
    print(sep.join("---" for _ in col_headers))

    for e in events:
        row = [e["session_start"][:16].replace("T", " ")]
        if show_comment:
            row.append(fmt_val(e.get("comment")))
        for a in all_show_attrs:
            ea = ea_by_event.get(e["id"], {}).get(a["id"])
            if ea is None:
                row.append("—")
            else:
                if a["data_type"] == "number":
                    row.append(fmt_val(ea.get("value_number"), "number"))
                elif a["data_type"] == "datetime":
                    row.append(fmt_val(ea.get("value_datetime"), "datetime"))
                elif a["data_type"] == "boolean":
                    v = ea.get("value_boolean")
                    row.append("✓" if v else ("✗" if v is False else "—"))
                else:
                    row.append(fmt_val(ea.get("value_text")))
        print(sep.join(row))

    print()


if __name__ == "__main__":
    main()
