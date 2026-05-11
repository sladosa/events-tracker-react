"""
Exports full area/category/attribute structure for a given user from Supabase.
Uses service role key (bypasses RLS) — read-only queries only.

Usage:
  python supabase_structure_export.py [--env .env.local] [--email user@email.com] [--out structure_report.md]
"""

import os, sys, json, argparse
from pathlib import Path

def load_env(env_file: str) -> dict:
    env = {}
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--email", default="sasasladoljev59@gmail.com")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

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

    # --- Resolve user_id from email ---
    # auth.users is not accessible via PostgREST, use profiles table
    profile_res = sb.table("profiles").select("id, email, display_name").eq("email", args.email).execute()
    if not profile_res.data:
        print(f"ERROR: no profile found for email '{args.email}'")
        print("Available profiles:")
        all_profiles = sb.table("profiles").select("id, email, display_name").limit(20).execute()
        for p in all_profiles.data:
            print(f"  {p['email']} — {p['id']}")
        sys.exit(1)

    user = profile_res.data[0]
    user_id = user["id"]
    print(f"User: {user['email']} ({user.get('display_name','')}) — {user_id}")

    # --- Load areas ---
    areas_res = sb.table("areas").select("id, name, slug, settings").eq("user_id", user_id).order("name").execute()
    areas = areas_res.data
    print(f"Areas: {len(areas)}")

    # --- Load all categories for this user's areas ---
    area_ids = [a["id"] for a in areas]
    cats_res = sb.table("categories").select(
        "id, area_id, parent_category_id, name, slug, level"
    ).in_("area_id", area_ids).order("level").order("name").execute()
    cats = cats_res.data

    # --- Load all attribute definitions ---
    cat_ids = [c["id"] for c in cats]
    # Batch in chunks of 100 to avoid URL length limits
    all_attrs = []
    chunk_size = 100
    for i in range(0, len(cat_ids), chunk_size):
        chunk = cat_ids[i:i+chunk_size]
        attr_res = sb.table("attribute_definitions").select(
            "id, category_id, name, slug, data_type, sort_order, is_required, validation_rules, description"
        ).in_("category_id", chunk).order("sort_order").execute()
        all_attrs.extend(attr_res.data)

    # --- Build lookup maps ---
    cat_by_id = {c["id"]: c for c in cats}
    attrs_by_cat = {}
    for a in all_attrs:
        attrs_by_cat.setdefault(a["category_id"], []).append(a)

    def get_children(parent_id, area_id):
        return [c for c in cats if c["parent_category_id"] == parent_id and c["area_id"] == area_id]

    def get_top_level(area_id):
        return [c for c in cats if c["parent_category_id"] is None and c["area_id"] == area_id]

    # --- Count events per category ---
    print("Loading event counts...")
    events_res = sb.table("events").select("category_id").in_("category_id", cat_ids).execute()
    event_counts = {}
    for e in events_res.data:
        cid = e["category_id"]
        event_counts[cid] = event_counts.get(cid, 0) + 1

    # --- Render output ---
    lines = []
    lines.append(f"# Supabase Structure Export")
    lines.append(f"")
    lines.append(f"**User:** {user['email']} ({user.get('display_name', '')})")
    lines.append(f"**User ID:** `{user_id}`")
    lines.append(f"**Areas:** {len(areas)}  |  **Categories:** {len(cats)}  |  **Attribute defs:** {len(all_attrs)}")
    lines.append(f"")
    lines.append("---")
    lines.append("")

    def render_node(cat, indent=0):
        prefix = "  " * indent + ("└─ " if indent > 0 else "")
        ev = event_counts.get(cat["id"], 0)
        has_children = bool(get_children(cat["id"], cat["area_id"]))
        leaf_marker = "" if has_children else " 🍃"
        ev_str = f" [{ev} events]" if ev else " [0 events]"
        lines.append(f"{prefix}**{cat['name']}** (`{cat['slug']}`){leaf_marker}{ev_str}  L{cat['level']}")
        attrs = attrs_by_cat.get(cat["id"], [])
        if attrs:
            for a in attrs:
                vr = a.get("validation_rules") or {}
                type_detail = a["data_type"]
                if isinstance(vr, str):
                    try: vr = json.loads(vr)
                    except: vr = {}
                if a["data_type"] == "text" and vr.get("suggest"):
                    opts = vr["suggest"]
                    opt_str = ", ".join(str(o) for o in opts[:6])
                    if len(opts) > 6: opt_str += f"… (+{len(opts)-6})"
                    type_detail = f"suggest [{opt_str}]"
                elif a["data_type"] == "number" and (vr.get("min") is not None or vr.get("max") is not None):
                    type_detail = f"number [{vr.get('min','?')}–{vr.get('max','?')} {vr.get('unit','')}]"
                req = " *" if a.get("is_required") else ""
                desc = f" — {a['description']}" if a.get("description") else ""
                lines.append(f"{'  ' * (indent+1)}  • `{a['slug']}` ({type_detail}){req}{desc}")
        children = get_children(cat["id"], cat["area_id"])
        for child in sorted(children, key=lambda x: x["name"]):
            render_node(child, indent + 1)

    for area in areas:
        area_ev = sum(event_counts.get(c["id"], 0) for c in cats if c["area_id"] == area["id"])
        lines.append(f"## Area: {area['name']} (`{area['slug']}`)")
        settings = area.get("settings") or {}
        if isinstance(settings, str):
            try: settings = json.loads(settings)
            except: settings = {}
        if settings:
            lines.append(f"*Settings: {settings}*")
        lines.append(f"*{area_ev} total events*")
        lines.append("")
        top = get_top_level(area["id"])
        for cat in sorted(top, key=lambda x: x["name"]):
            render_node(cat, indent=0)
        lines.append("")
        lines.append("---")
        lines.append("")

    report = "\n".join(lines)

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(report, encoding="utf-8")
        print(f"\nReport written to: {out_path}")
    else:
        print("\n" + report)

if __name__ == "__main__":
    main()
