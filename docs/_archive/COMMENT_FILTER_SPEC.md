# Comment Filter Spec

**Status:** Planned (S80)
**Priority:** P1 (S81)

---

## Goal

Allow users to quickly locate Activity rows by searching the `leaf comment` field.
Primary use cases:
1. Find events marked for deletion (e.g. "IZBRISATI")
2. Find TODO items — events with a future `session_start` and a comment like "TODO"
3. General keyword lookup (e.g. a doctor name, a test name, a supplement brand)

---

## Decision: inline filter, no new modal

Add a single text input to the existing Filter section in `AppHome.tsx` (the collapsible filter bar).
No separate modal — keeps the UI minimal and consistent with how Area/Category/Date filters work.

---

## Scope

### Phase 1 — leaf comment search (S81)

Filter by `comment` on leaf events only (the comment field users actually type into).
Parent event comments are system-managed (mostly empty or duplicates) — skip them.

**Filter placement:**
- In the filter bar, after the Date range row
- Label: `Comment contains`
- Input: text, placeholder `search comments...`
- Clear (×) button when non-empty
- Persists in `FilterContext` (lost on page reload — same as date filter)

**Query behaviour:**
- Applied server-side: `.ilike('comment', '%text%')` on the `events` query in `useActivities.ts`
- Case-insensitive (PostgREST `ilike`)
- Only when the value is non-empty (empty string → no filter clause)
- Combines with existing filters (area, category, date) via AND

**FilterContext changes:**
```typescript
// add to FilterState
commentSearch: string;

// add to FilterActions
setCommentSearch: (v: string) => void;
clearCommentSearch: () => void;
```

**useActivities changes:**
- Receive `commentSearch` from `FilterContext`
- Append `.ilike('comment', `%${commentSearch}%`)` when non-empty

**UI indicator:**
- When active, the filter bar "active filters" chip count should include it
- Chip label: `comment: "xyz"` with × to clear

---

### Phase 2 — TODO reminder view (future, not S81)

When a comment starts with `TODO` and `session_start` is in the future, surface these as
a dedicated "Reminders" view or badge count in the header.

**Not in scope for S81.** Document here so the Phase 1 design doesn't block it:
- `commentSearch` filter is general-purpose — `TODO` is just a search term for Phase 1
- Phase 2 would add a separate filter preset (chip: "Future TODOs") rather than a modal

---

## Implementation plan

| Step | File | Change |
|------|------|--------|
| 1 | `src/context/FilterContext.tsx` | Add `commentSearch` state + `setCommentSearch` + `clearCommentSearch`; expose in context value |
| 2 | `src/hooks/useActivities.ts` | Read `commentSearch` from context; append `.ilike('comment', ...)` when non-empty |
| 3 | `src/pages/AppHome.tsx` | Add text input row in filter bar (after date range); active chip |
| 4 | `docs/help/activities.md` | One-liner about comment search |

Estimated effort: ~1h (straightforward, no new components needed).

---

## Out of scope

- Searching attribute values (not in comment field) — separate backlog item
- Full-text search across multiple fields — Supabase `fts` column would be needed
- Saved searches / presets
- Regex or AND/OR operators
