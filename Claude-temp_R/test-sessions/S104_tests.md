# S104 Test Details — Fable critical findings: Delete bug + parent event extraction + import progress

**Branch:** test-branch
**Baza:** TEST Supabase project (`e2e/setup/seed.sql`)
**Preconditions:** seed.sql applied (Fitness > Activity > Gym > {Strength (no events), Cardio (1 seed event 2026-01-01)})

All three E2E tests below are automated (Playwright) and have been run and confirmed passing against the TEST project in this session.

---

## T-S104-1 ✅ Delete Activity scopes to its own chain (chain_key fix)

**File:** `e2e/tests/S104_delete_bug.spec.ts`
**Bug fixed:** `handleDeleteActivity()` in `AppHome.tsx` used to delete ALL events matching `(session_start + user_id)`, ignoring category — deleting one activity chain also deleted any other chain sharing the same `session_start`.

1. Seed (via REST) two full chains at the SAME `session_start` (2031-03-10T09:00):
   - Cardio leaf + Gym/Activity parents (`chain_key = Cardio`)
   - Strength leaf + Gym/Activity parents (`chain_key = Strength`)
2. Filter Activities table to Gym level (shows both leaf rows together)
3. Open the Cardio row's ⋮ menu → "Delete Activity" → "Yes, delete"
4. **Expected:**
   - Cardio row disappears from the UI; Strength row remains
   - DB: Cardio leaf (`category_id=Cardio`) — 0 rows remaining
   - DB: Cardio parents (`chain_key=Cardio`) — 0 rows remaining
   - DB: Strength leaf (`category_id=Strength`) — 1 row remaining (untouched)
   - DB: Strength parents (`chain_key=Strength`) — 2 rows remaining (Gym + Activity, untouched)
5. **Confirmed:** Playwright run, passing (14.4s)

---

## T-S104-2 ✅ Shared upsertParentEvent(): P2 anchor + no duplicate on re-save

**File:** `e2e/tests/S104_parent_event.spec.ts`
**Context:** Originally scoped as a unit test; this repo has no unit-test runner (Playwright E2E is the only tooling — see `docs/PLAYWRIGHT_E2E_GUIDE.md`), so converted to E2E per session decision.

**Also fixed as a side effect of writing this test:** `canFinish` in `AddActivityPage.tsx` did not wait for `categoryChain` (parent chain) to finish loading — clicking Finish quickly (before that DB round-trip resolves) saved the leaf event but silently skipped P2 anchor (parent event) creation. Now `canFinish` also requires `!chainLoading`.

1. Add Activity → Strength (leaf, no attribute_definitions seeded on Gym/Activity in TEST project) with just a note, Finish
2. Verify via REST: Gym + Activity parent events exist, `chain_key = Strength`, **even though they have zero `event_attributes`** — proves the P2 anchor is created unconditionally (hybrid decision: "Follow Add flow — always create parent event")
3. Edit the same activity (change the note), Save
4. Verify via REST: still exactly 1 Gym parent + 1 Activity parent for that chain — **same event IDs as before** (not new rows) — proves upsert, not duplicate-insert
5. **Confirmed:** Playwright run, passing (16.4s)

---

## T-S104-3 ✅ Import progress bar (Q3 batch insert + Q4 progress callback)

**File:** `e2e/tests/S104_import_progress.spec.ts`
**Context:** Diary migration target is 7000+ rows; without Q3 (batched `event_attributes` INSERT) + Q4 (`onProgress` callback → progress bar), a large import looked "frozen" with no feedback.

1. Export the real Cardio template (Legend + headers) via the UI — guarantees a correctly-formatted file instead of hand-building one
2. Clone the exported row into 150 new CREATE rows (future dates 2032+, no collisions, own session per row — worst case for per-session parent-upsert overhead)
3. Re-import that file via the Import modal → Apply Import
4. **Expected:**
   - Progress bar appears mid-import showing `N / 151 rows` (150 new + 1 pre-existing template row counted as an unchanged/skipped update)
   - Import completes (doesn't hang) — Done screen shows "150" under "Events created"
5. **Confirmed:** Playwright run, passing (2.3min — dominated by per-session parent-chain upsert overhead against the remote TEST DB, not by attribute inserts since Cardio/Gym/Activity have no attr_defs in seed data; the progress bar visibly incrementing throughout is itself the proof Q4 works)

---

## Manual / non-automated quick wins (S104 Q1–Q6, sanity-checked via typecheck + build + regression suite, not separately scripted)

| # | Fix | How verified |
|---|-----|--------------|
| Q1 | Delete bug | T-S104-1 above |
| Q2 | `useMemo` on FilterContext value | typecheck + full regression suite (e2/e3/e6) pass; no behavior change expected, pure re-render optimization |
| Q3 | Batch `event_attributes` INSERT in import | T-S104-3 exercises the code path (0 attrs in this seed, so batching itself isn't visually distinguishable here — see BUG-S104-3 note below on follow-up with attributes) |
| Q4 | Import progress bar | T-S104-3 above |
| Q5 | Escape ILIKE wildcards | Not separately scripted this session — logic change is a pure string-escape, low risk; consider adding a comment-search test with `%`/`_` in a future session |
| Q6 | Dead code cleanup (`useLookupValues`, `DEBUG_ENABLED` blocks, dead `src/pages/useActivities.ts`) | Confirmed zero remaining references via grep before removal; typecheck + build clean |

---

## Regression suite (pre-existing tests, re-run to confirm no breakage from the parentEventLoader refactor)

| Test | Result |
|------|--------|
| E2-1, E2-2 (Add Activity) | ✅ passing |
| E3-1, E3-2 (Edit Activity) | ✅ passing |
| E6-1, E6-2, E6-3 (Excel Export) | ✅ passing |

---

## Environment note for future sessions

Playwright's `webServer.reuseExistingServer: true` will reuse ANY server already listening on port 5173 — including one started via plain `npm run dev` (not wired to TEST Supabase credentials). If E2E tests fail at login with no obvious cause, check for a stray dev server on port 5173 first (`netstat -ano | grep :5173` on Windows) before assuming the test or app code is broken.
