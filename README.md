# Events Tracker

Personal activity tracking web app — fitness, habits, health, diary — built on a hierarchical EAV data model with Excel roundtrip as primary bulk workflow and multi-user sharing.

---

## What is this?

A multi-user activity tracker with flexible structure:

- **Hierarchy:** Areas → Categories (up to 10 levels) → Attribute Definitions
- **EAV pattern:** Dynamic per-category attributes (number, text, datetime, boolean, dropdown, suggest)
- **Multi-session:** Multiple activities per day identified by `session_start` + `chain_key`
- **Excel roundtrip:** Export structure or activities → edit in Excel → import back
- **Sharing:** Owner shares an Area with grantees (read or write); full access control

**Use cases:** Fitness tracking, health diary, personal diary, habit tracking, financial diary.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript 5.9 + Tailwind CSS 3 |
| Build | Vite 7 (chunked: react, supabase, excel, plotly, ui) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Netlify (CI: typecheck + build on every push) |
| Functions | Netlify Functions (help AI, invite email, share invite) |
| E2E Tests | Playwright |

---

## What Works (through S77)

**Activities tab**
- Add Activity — wizard with progressive category selector, EAV attribute inputs, Save+ batch mode
- Edit Activity — delta-shift, collision detection, parent event upsert
- View Details — read-only, Prev/Next navigation with prefetch cache, touch swipe
- Excel Export/Import — collision handling, conflict report, foreign-user row detection
- User column — avatar + name for multi-user areas; orphan event detection

**Structure tab**
- Table view (DFS order) + Sunburst chart (Plotly)
- Edit Mode — rename node, edit/add/delete attribute definitions
- Add Child, Add Area, Add Between levels, Add Above leaf, Collapse Level
- Delete — blocked if node has events; cascade delete with backup download
- Excel Export v2 (17 cols) + Import (non-destructive, creates missing categories)
- Area collapse/expand + Collapse all; filter segments (Mine / All / Templates)
- Template Areas — copy starter structure from template user

**Multi-user sharing (collab)**
- Owner shares Area via email invite (registered or new user)
- Grantee roles: read (view only) or write (add own activities)
- Share Management modal — invite, list active, change permission, revoke
- Revoke with events: claim, delete, or revoke-only
- Grantee "Take your data" (Detach with data or Leave without data)
- Orphan events management — re-invite, claim, or delete orphan events
- Role-aware UI: banners, ⋮ menus, Edit Mode guards throughout

**AI Help system**
- Embedded Claude Haiku (Netlify Function) — contextual help chat
- Draggable floating panel + dock mode; context chips per page
- Feedback tab (wish / bug / question → DB)

**Data pipeline**
- `data-prep_tools/` — Python scripts for Garmin, Health, Financije imports
- `data-prep_tools/MIGRATION_STATE.md` — per-source pipeline tracking

---

## Quick Start

```bash
git clone https://github.com/USERNAME/events-tracker-react.git
cd events-tracker-react
npm install

cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TEMPLATE_USER_ID

npm run dev
```

With Netlify functions (AI help, invite):
```bash
npm run dev:netlify
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
│   ├── sharing/            SharedAreaBanner, ShareManagementModal, LeaveAreaModal, OrphanManagementModal
│   ├── structure/          Structure tab — table, panels, modals, sunburst
│   ├── help/               HelpPanel (AI chat + feedback)
│   └── ui/                 Base components
├── context/
│   ├── FilterContext.tsx   Global filter state (area, category, date range, shared context)
│   └── HelpContext.tsx     Help panel global state
├── hooks/
│   ├── useDataShares.ts    Share management (list, create, revoke, invite)
│   ├── useOrphanUsers.ts   Orphan event detection
│   └── useAttributeDefinitions.ts
├── lib/
│   ├── parentEventLoader.ts    Shared: parent event upsert logic
│   ├── excelExport.ts          Activities export
│   ├── excelImport.ts          Activities import (with foreign-user handling)
│   ├── structureExcel.ts       Structure export v2
│   ├── structureImport.ts      Structure import (non-destructive)
│   ├── leaveArea.ts            Grantee leave-area logic (detach or leave)
│   ├── activityViewCache.ts    LRU prefetch cache for ViewDetailsPage
│   └── theme.ts                Colour tokens
├── pages/
│   ├── AppHome.tsx             Tabs, filter, export/import triggers
│   ├── AddActivityPage.tsx
│   ├── EditActivityPage.tsx
│   ├── ViewDetailsPage.tsx
│   └── InviteRedirectPage.tsx  /invite/:id → Supabase redirect
netlify/
└── functions/
    ├── help.ts             AI help (Claude Haiku, non-streaming)
    ├── send-share-invite.ts  Email invite for new users
    └── get-invite-link.ts    Invite link lookup by ID
data-prep_tools/
├── Tools/                  Reusable scripts (structure export, Garmin, template)
├── Health/                 Health data preparation scripts
└── MIGRATION_STATE.md      Per-source pipeline tracking
e2e/
└── tests/                  Playwright E2E specs (E1–E15)
sql/
└── 001–020_*.sql           DB migration scripts
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `CLAUDE.md` | Session context, P1/P2/P3 rules, backlog — read by Claude Code automatically |
| `docs/ARCHITECTURE_v1_6.md` | Data model, chain_key, session identity |
| `docs/EXCEL_FORMAT_ANALYSIS_v2.md` | Excel format spec (17 cols, v2) |
| `docs/COLLAB_PLAN_v2.md` | Multi-user sharing implementation plan |
| `docs/TEMPLATE_SYSTEM_SPEC.md` | Template user system |
| `docs/PLAYWRIGHT_E2E_GUIDE.md` | E2E test setup and workflow |
| `docs/HELP_STRUCTURE.md` | Help system — chip map, context detection |
| `docs/Code_Guidelines_React_v6.md` | Code conventions |
| `sql/SQL_schema_V5_commented.sql` | Full DB schema with comments |
| `data-prep_tools/MIGRATION_STATE.md` | Data migration pipeline status |
| `Claude-temp_R/PENDING_TESTS.md` | Active manual tests pending confirmation |

---

## Development Workflow

Branch: `test-branch` → merge to `main` when stable (Netlify deploys from `main`).

Claude Code (VSCode extension) is used for development. `CLAUDE.md` is the session onboarding file — it loads automatically and contains the backlog, critical rules, and session procedure.

---

## Database

Main tables:
```
areas                  Top-level organization (+ settings jsonb)
categories             Hierarchical (parent_category_id, level 1–10)
attribute_definitions  Per-category attribute schema
events                 Activity records (session_start rounded to minute)
event_attributes       EAV values (text / number / datetime / boolean)
event_attachments      Images and links
data_shares            Active shares (owner → grantee, read/write)
share_invites          Pending invites (email-based, action_link)
profiles               User display names
help_log               AI help query log
feedback               User feedback (wish / bug / question)
```

Full schema: `sql/SQL_schema_V5_commented.sql`

---

## License

MIT

---

*Last updated: S77 — 2026-05-18*
