# S107 Session Prompt — Historical Financije Pipeline

**Date:** 2026-07-07 end of S106
**Branch:** test-branch
**Status:** S106 DONE (race condition fix merged to main)

---

## Session Goal: S107 — Historical Financije Data Import & Python Classification

**Mission:** Ingest historical Financije Excel data (both områja), audit for missing categories, generate Python Tip/Podtip classifications, and re-import corrected data.

**Success criteria:** 
- Financije data flows into DB with correct Tip/Podtip classification
- No missing categories
- Data quality spot-check passed

---

## S107 Scope (in order)

### Phase 1: Export & Audit (Manual first, then automate if needed)
1. **Export both Financije områja** from app:
   - Activities Events export (Excel) for each area
   - Structure export (for audit mapping)
   - Save to `data-prep_tools/Financije/export_<area>.xlsx`

2. **Run audit skripta** (Python):
   - Detect missing categories in import vs. DB
   - List data anomalies (duplicates, malformed dates, etc.)
   - Generate mapping table
   - Script: `data-prep_tools/Financije/audit_financije.py`

### Phase 2: Python Classification
3. **Python Tip/Podtip classification**:
   - Read exported Financije events
   - Use heuristics/rules to suggest Tip/Podtip values
   - Generate corrected Excel with classification results
   - Script: `data-prep_tools/Financije/classify_na_events.py`

### Phase 3: Re-import & Verify
4. **Re-import corrected data**:
   - Load classified Excel into app (standard import flow)
   - Spot-check data integrity (parent chain, attributes, RLS)
   - Verify no collisions with existing data

---

## Key Context from S106

- **Race condition FIXED:** Test harness (supabaseUpsert); tests updated for E7/E10 modal flows
- **Collab is STABLE:** Ready for 1–2 person shared areas (Financije, projects)
- **Main is deployed:** S106 fixes on PROD (Netlify)
- **Test-branch is synced:** Ready for S107 work

---

## What NOT to do in S107

- ❌ Expand collab (that's stable enough for now)
- ❌ Rewrite Excel export/import logic (only use existing code)
- ❌ Multi-user testing (not in scope)
- ❌ Fix E7-2/E7-3 toast logika (backlog UX — not blocking)

---

## Before you start

1. Read `docs/EXCEL_FORMAT_ANALYSIS_v2.md` (export format)
2. Check `data-prep_tools/DATA_PIPELINE_PLAN.md` (existing pipeline docs)
3. Have both Financije områja (should be visible in app Structure tab)

---

## Entry point next session

- Branch: `test-branch` (synced with main)
- Tasks: Export → Audit → Classify → Re-import
- First step: Export both Financije områja from running app, save to `data-prep_tools/Financije/`

---

## Open backlog (NOT for S107)

- **E7-2/E7-3 UX:** Toast "Access granted" missing after email invitation modal dismiss
- **BUG-S103-ANYATTR:** "In any attribute" filter timeout for grantees (SECURITY DEFINER RPC fix)
- **D9 verify:** Excel User column behaviour (minor)
- **Diary archaeology:** Non-blocking parallel to S107

---

Generated: 2026-07-07 end of S106
