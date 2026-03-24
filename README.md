# Events Tracker

Personal activity tracking web app — fitness, habits, diary — built on a hierarchical EAV data model with Excel roundtrip as primary bulk workflow.

---

## What is this?

A single-user activity tracker with flexible structure:

- **Hierarchy:** Areas → Categories (up to 10 levels) → Attribute Definitions
- **EAV pattern:** Dynamic per-category attributes (number, text, datetime, boolean, dropdown)
- **Multi-session:** Multiple activities per day identified by `session_start` + `chain_key`
- **Excel roundtrip:** Export structure or activities → edit in Excel → import back

**Use cases:** Fitness tracking, health diary, personal diary, habit tracking.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript 5.9 + Tailwind CSS 3 |
| Build | Vite 7 (chunked: react, supabase, excel, plotly, ui) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Netlify (CI: typecheck + build on every push) |

---

## What Works (through S24)

**Activities tab**
- Add Activity — wizard with progressive category selector, EAV attribute inputs
- Edit Activity — delta-shift, collision detection, parent event upsert
- View Details — read-only, Prev/Next navigation
- Excel Export/Import — with collision handling and conflict report

**Structure tab**
- Table view (DFS order) + Sunburst chart (Plotly)
- Edit Mode — rename node, edit attribute definitions
- Add Child — blocked if leaf has events (data integrity)
- Add Area — creates new top-level area, refreshes Area dropdown
- Delete — blocked if node has events; cascade delete for empty nodes
- Excel Export v2 (17 cols, HierarchicalView sheet) + Import (non-destructive)

**Cross-cutting**
- Area dropdown live refresh via `areas-changed` CustomEvent
- Theme system with per-context colour tokens (`src/lib/theme.ts`)
- P1/P2/P3 data model invariants enforced in all write paths

---

## Quick Start

```bash
git clone https://github.com/USERNAME/events-tracker-react.git
cd events-tracker-react
npm install

cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev
```

Pre-commit check:
```bash
npm run typecheck && npm run build
```

---

## Project Structure

```
src/
├── components/
│   ├── activity/           Activity form components, ExcelImportModal
│   ├── structure/          Structure tab — table, panels, modals, sunburst
│   └── ui/                 Base components
├── context/
│   └── FilterContext.tsx   Global filter state (area, category, date range)
├── hooks/
│   └── useAttributeDefinitions.ts
├── lib/
│   ├── parentEventLoader.ts    Shared: parent event upsert logic
│   ├── excelExport.ts          Activities export
│   ├── excelImport.ts          Activities import
│   ├── structureExcel.ts       Structure export v2
│   ├── structureImport.ts      Structure import (non-destructive)
│   └── theme.ts                Colour tokens
└── pages/
    ├── AppHome.tsx             Tabs, filter, export/import triggers
    ├── AddActivityPage.tsx
    ├── EditActivityPage.tsx
    └── ViewDetailsPage.tsx
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `CLAUDE.md` | Session context, P1/P2/P3 rules, backlog — read by Claude Code automatically |
| `docs/ARCHITECTURE_v1_6.md` | Data model, chain_key, session identity |
| `docs/STRUCTURE_TAB_CONTEXT_FOR_CLAUDE_v1.5.md` | Structure tab design decisions |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md` | Excel format spec (17 cols, v2) |
| `docs/SQL_schema_V5_commented.sql` | Full DB schema with comments |
| `docs/Code_Guidelines_React_v6.md` | Code conventions |
| `docs/Playwright_Supabase_Setup_Guide.md` | E2E test setup guide (planned) |
| `Claude-temp_R/PENDING_TESTS.md` | Active manual tests pending confirmation |
| `Claude-temp_R/test-sessions/` | Full test history (S01–S24) |

---

## Development Workflow

Branch: `test-branch` → merge to `main` when stable (Netlify deploys from `main`).

Claude Code (VSCode extension) is used for development. `CLAUDE.md` is the session onboarding file — it loads automatically and contains the backlog, critical rules, and session procedure.

---

## Database

Main tables:
```
areas                  Top-level organization
categories             Hierarchical (parent_category_id, level 1–10)
attribute_definitions  Per-category attribute schema
events                 Activity records (session_start rounded to minute)
event_attributes       EAV values (text / number / datetime / boolean)
event_attachments      Images and links
```

Full schema: `docs/SQL_schema_V5_commented.sql`

---

## License

MIT

---

*Last updated: S24 — 2026-03-24*
