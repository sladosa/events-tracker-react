# -*- coding: utf-8 -*-
"""
fix_garmin_duplicates.py
========================
Finds and removes duplicate Garmin_data events (same session_start to the second).
For each duplicate pair, keeps the event with the lexicographically LOWER UUID,
deletes the higher one.

Usage:
  python fix_garmin_duplicates.py                          # dry-run (no changes)
  python fix_garmin_duplicates.py --apply                  # actually delete
  python fix_garmin_duplicates.py --env .env.local         # TEST db
  python fix_garmin_duplicates.py --apply --env .env.local # apply on TEST
"""

import sys, argparse
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT  = SCRIPT_DIR.parent.parent

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
    parser.add_argument("--env",   default=".env.prod.local",
                        help="env file (default: .env.prod.local = PROD)")
    parser.add_argument("--email", default="sasasladoljev59@gmail.com")
    parser.add_argument("--apply", action="store_true",
                        help="actually delete duplicates (default: dry-run only)")
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
    print(f"Mode: {'APPLY (will delete!)' if args.apply else 'DRY-RUN (no changes)'}")
    print()

    # ── Find user ──────────────────────────────────────────────────────────────
    profile = sb.table("profiles").select("id").eq("email", args.email).execute()
    if not profile.data:
        print(f"ERROR: no profile for {args.email}")
        sys.exit(1)
    user_id = profile.data[0]["id"]
    print(f"User: {args.email} ({user_id})")

    # ── Find Garmin_data category ──────────────────────────────────────────────
    cats = sb.table("categories").select("id, name").execute().data
    garmin_cat = next((c for c in cats if c["name"].lower() == "garmin_data"), None)
    if not garmin_cat:
        print(f"ERROR: Garmin_data category not found")
        sys.exit(1)
    print(f"Garmin_data category id: {garmin_cat['id']}")

    # ── Load all Garmin_data events for user ───────────────────────────────────
    print("Loading Garmin_data events...")
    all_events = []
    page_size = 1000
    offset = 0
    while True:
        batch = sb.table("events") \
            .select("id, session_start, created_at") \
            .eq("user_id", user_id) \
            .eq("category_id", garmin_cat["id"]) \
            .order("session_start") \
            .range(offset, offset + page_size - 1) \
            .execute().data
        all_events.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"  Total Garmin_data events: {len(all_events)}")

    # ── Group by session_start (to-the-second) ─────────────────────────────────
    by_session = defaultdict(list)
    for ev in all_events:
        # Normalize to first 19 chars: "2025-02-14T07:00:01"
        key = (ev["session_start"] or "")[:19]
        by_session[key].append(ev)

    # ── Find duplicate groups ──────────────────────────────────────────────────
    duplicates = {k: v for k, v in by_session.items() if len(v) > 1}
    print(f"  Sessions with duplicates: {len(duplicates)}")

    if not duplicates:
        print("\nNo duplicates found. Nothing to do.")
        return

    # ── Build delete list: for each group, keep LOWEST uuid, delete rest ───────
    to_delete = []
    for session_ts, evs in sorted(duplicates.items()):
        evs_sorted = sorted(evs, key=lambda e: e["id"])
        keep   = evs_sorted[0]
        delete = evs_sorted[1:]
        to_delete.extend([e["id"] for e in delete])
        if len(duplicates) <= 30:  # only print detail if not too many
            print(f"  {session_ts[:10]}  keep={keep['id'][:8]}  "
                  f"delete={[e['id'][:8] for e in delete]}")

    print(f"\nEvents to delete: {len(to_delete)}")

    if not args.apply:
        print("\nDRY-RUN complete. Re-run with --apply to actually delete.")
        return

    # ── Delete in batches ──────────────────────────────────────────────────────
    print("\nDeleting duplicates...")
    CHUNK = 50
    deleted = 0
    for i in range(0, len(to_delete), CHUNK):
        chunk = to_delete[i:i + CHUNK]
        # Delete event_attributes first (FK constraint)
        sb.table("event_attributes").delete().in_("event_id", chunk).execute()
        # Delete events
        sb.table("events").delete().in_("id", chunk).execute()
        deleted += len(chunk)
        print(f"  Deleted {deleted}/{len(to_delete)}...")

    print(f"\nDone. Deleted {deleted} duplicate events.")
    print(f"Garmin_data should now have {len(all_events) - deleted} events.")

if __name__ == "__main__":
    main()
