# -*- coding: utf-8 -*-
"""
delete_by_comment.py
====================
Finds (and optionally deletes) events whose comment contains a given string.

Usage:
  python delete_by_comment.py --match IZBRISATI              # dry-run, PROD
  python delete_by_comment.py --match IZBRISATI --apply      # delete, PROD
  python delete_by_comment.py --match IZBRISATI --env .env.local          # TEST
  python delete_by_comment.py --match IZBRISATI --env .env.local --apply  # delete TEST
"""

import sys, argparse
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).parent.parent.parent

def load_env(env_file):
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
    parser.add_argument("--match",  required=True,
                        help="substring to search in event comment (case-insensitive)")
    parser.add_argument("--env",    default=".env.prod.local")
    parser.add_argument("--email",  default="sasasladoljev59@gmail.com")
    parser.add_argument("--area",   default="",
                        help="limit to specific area name (optional)")
    parser.add_argument("--apply",  action="store_true",
                        help="actually delete (default: dry-run)")
    args = parser.parse_args()

    env_path = REPO_ROOT / args.env
    if not env_path.exists():
        print(f"ERROR: env file not found: {env_path}")
        sys.exit(1)

    env = load_env(str(env_path))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required")
        sys.exit(1)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: pip install supabase")
        sys.exit(1)

    sb = create_client(url, key)
    mode = "PROD" if "prod" in args.env else "TEST"
    print(f"Connected to {mode} db ({url[:40]}...)")
    print(f"Searching for comment containing: '{args.match}'")
    print(f"Mode: {'APPLY (will delete!)' if args.apply else 'DRY-RUN (no changes)'}")
    print()

    # ── Find user ──────────────────────────────────────────────────────────────
    profile = sb.table("profiles").select("id").eq("email", args.email).execute()
    if not profile.data:
        print(f"ERROR: no profile for {args.email}")
        sys.exit(1)
    user_id = profile.data[0]["id"]

    # ── Load categories for path display ──────────────────────────────────────
    cats = sb.table("categories").select("id, name, parent_category_id").execute().data
    cat_by_id = {c["id"]: c for c in cats}

    def cat_path(cat_id):
        parts = []
        cid = cat_id
        while cid:
            c = cat_by_id.get(cid)
            if not c:
                break
            parts.append(c["name"])
            cid = c.get("parent_category_id")
        return " > ".join(reversed(parts))

    # ── Load areas for optional filter ────────────────────────────────────────
    area_ids = None
    if args.area:
        areas = sb.table("areas").select("id, name") \
            .eq("user_id", user_id).execute().data
        matched = [a["id"] for a in areas if args.area.lower() in a["name"].lower()]
        if not matched:
            print(f"ERROR: no area matching '{args.area}'")
            sys.exit(1)
        # Get all category ids in those areas
        area_cats = sb.table("categories").select("id") \
            .in_("area_id", matched).execute().data
        area_ids = [c["id"] for c in area_cats]
        print(f"Limiting to area '{args.area}': {len(area_ids)} categories")

    # ── Query events with matching comment ─────────────────────────────────────
    query = sb.table("events") \
        .select("id, session_start, comment, category_id") \
        .eq("user_id", user_id) \
        .ilike("comment", f"%{args.match}%") \
        .order("session_start", desc=True)

    if area_ids:
        query = query.in_("category_id", area_ids)

    events = query.execute().data
    print(f"Found {len(events)} event(s) matching '{args.match}':\n")

    for ev in events:
        date = (ev.get("session_start") or "")[:10]
        path = cat_path(ev.get("category_id"))
        comment = (ev.get("comment") or "")[:80]
        print(f"  {date}  {path:<40}  {comment}")

    if not events:
        print("Nothing to delete.")
        return

    if not args.apply:
        print(f"\nDRY-RUN: {len(events)} event(s) would be deleted.")
        print("Re-run with --apply to actually delete.")
        return

    # ── Delete ─────────────────────────────────────────────────────────────────
    ids = [e["id"] for e in events]
    print(f"\nDeleting {len(ids)} event(s)...")
    CHUNK = 50
    deleted = 0
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i + CHUNK]
        sb.table("event_attributes").delete().in_("event_id", chunk).execute()
        sb.table("events").delete().in_("id", chunk).execute()
        deleted += len(chunk)
    print(f"Done. Deleted {deleted} event(s).")

if __name__ == "__main__":
    main()
