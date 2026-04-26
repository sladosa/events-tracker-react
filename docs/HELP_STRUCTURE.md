# Events Tracker — Help System Structure

Reference document for understanding, maintaining, and evolving the embedded Help system.

---

## Overview

The Help system consists of:
1. **UI panel** — slide-in panel with 3 tabs (Ask AI / Concepts / Feedback)
2. **AI backend** — Netlify Function calling Claude Haiku (non-streaming)
3. **Content docs** — `docs/help/*.md` files that are the source of truth for AI knowledge
4. **Database tables** — `help_log` (AI queries) and `feedback` (user feedback)

---

## File Locations

| File/Folder                                | Purpose                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/components/help/HelpPanel.tsx`        | UI: panel, tabs (Ask AI / Concepts / Feedback), FAB, chips  |
| `src/context/HelpContext.tsx`              | Global state: `isOpen`, `pageHint`, `open()`, `close()`     |
| `src/App.tsx`                              | `HelpProvider` wraps `/app/*` routes; `HelpOverlay` in `AppShell` |
| `netlify/functions/help.ts`                | Netlify Function: Claude Haiku call, help_log insert, system prompt |
| `docs/help/concepts.md`                    | Core concepts — also embedded in HelpPanel ConceptsTab       |
| `docs/help/activities.md`                  | Activities tab how-to                                        |
| `docs/help/structure.md`                   | Structure tab how-to                                         |
| `docs/help/sharing.md`                     | Sharing/collaboration how-to                                 |
| `docs/help/excel.md`                       | Excel import/export how-to                                   |
| `docs/help/attributes.md`                  | Attribute types and editing                                  |
| `docs/help/templates.md`                   | Template system how-to                                       |
| `sql/013_help_tables.sql`                  | DDL for `help_log` and `feedback` tables                     |

---

## Context Detection — Which Chips Show Where

Context is determined by `useCurrentPage()` in `HelpPanel.tsx`:
- pathname `/add` → `'add'`
- pathname `/edit` → `'edit'`
- pathname `/view` → `'view'`
- `pageHint` from `HelpContext` → `'activities'` or `'structure'` (set by `AppHome.tsx`)
- fallback → `'activities'`

| Context      | Page/Route          | Chip 1                              | Chip 2                               | Chip 3                                    |
| ------------ | ------------------- | ----------------------------------- | ------------------------------------ | ----------------------------------------- |
| `activities` | AppHome Activities  | How do I add an activity?           | What is a session?                   | How do I import from Excel?               |
| `structure`  | AppHome Structure   | What are Area and Category?         | What does the ⋮ menu do?             | How do I share an area with someone?      |
| `add`        | AddActivityPage     | What happens to parent categories?  | How does suggest work?               | Why can't I select a category?            |
| `edit`       | EditActivityPage    | Can I change the date?              | Why am I seeing someone else's record? | What happens when I change the time?    |
| `view`       | ViewDetailsPage     | How do I edit this record?          | What does Prev/Next do?              | How do I see all records for a category?  |

Chips appear only before the first user message (`messages.length === 1 && tab === 'ask'`).
After the first message, chips disappear and the conversation continues.

---

## Chat State & Context Reset

- **Reset on page change:** When panel opens in a different context than last time, chat resets (new conversation + chips).
- **Preserved on same page:** Re-opening Help on the same page restores the last conversation.
- **Manual reset:** "↺ New conversation" button (visible when `messages.length > 1`).
- **History sent to AI:** Last 8 messages (excl. WELCOME) — enables multi-turn conversations.

---

## System Prompt (AI Knowledge)

Location: `netlify/functions/help.ts` — `SYSTEM_PROMPT` constant.

The prompt covers:
- App overview and data model
- How to use Activities, Structure, Excel, Sharing, Templates tabs
- Demo Area structure (as a live example for explaining features)
- Attribute types with examples
- Rules: answer in same language, be concise, reference UI paths, never invent features

**Update the system prompt when:**
- A new major feature is added
- UI navigation paths change
- New attribute types are added

---

## Concepts Tab Content

The **Concepts tab** in HelpPanel.tsx is static — content is defined directly in the component
(no file import, no API call). Sections:

1. **Core Concepts** — Area, Category, Leaf, Session, Session Start, Attribute, Suggest, Dependent Suggest, Shortcut
2. **Key Behaviors** — Parent Events, Last Non-Empty Wins, Delta Shift, Edit Mode, Session Collision
3. **Design Decisions** (amber style) — WHY decisions were made + trade-offs:
   - EAV model trade-offs
   - Why parent events are auto-created
   - Why editing time shifts all related records
   - Why empty never overwrites (P3 rule)
   - Why Excel is the primary bulk workflow

**When to update the Concepts tab:** When a core concept changes behavior, a new concept is added,
or user questions reveal that a concept needs better explanation (see Content Evolution below).

---

## Database Tables

### `help_log`
Logs every AI question sent through the Help panel.

| Column      | Type      | Notes                        |
| ----------- | --------- | ---------------------------- |
| id          | UUID      | PK                           |
| user_id     | UUID      | FK to auth.users             |
| question    | text      | User's question              |
| answer      | text      | AI response                  |
| context     | jsonb     | `{ page, areaId }`           |
| created_at  | timestamp |                              |

### `feedback`
Stores user feedback from the Feedback tab.

| Column     | Type      | Notes                                |
| ---------- | --------- | ------------------------------------ |
| id         | UUID      | PK                                   |
| user_id    | UUID      | FK to auth.users                     |
| type       | text      | `'wish' | 'bug' | 'question'`        |
| message    | text      | User's message                       |
| context    | jsonb     | `{ page, areaId }`                   |
| created_at | timestamp |                                      |

---

## Content Evolution Protocol

The help system is designed to improve over time based on actual usage.

### Step 1 — Identify knowledge gaps (monthly or after major releases)

Run this query on Supabase to find frequently asked topics:

```sql
SELECT
  context->>'page' as page,
  question,
  count(*) as times_asked,
  min(created_at) as first_seen,
  max(created_at) as last_seen
FROM help_log
GROUP BY context->>'page', question
ORDER BY times_asked DESC, last_seen DESC
LIMIT 50;
```

Also check for patterns where users ask follow-up questions (suggesting the first answer was incomplete):

```sql
SELECT question, answer
FROM help_log
WHERE context->>'page' IN ('structure', 'activities')
ORDER BY created_at DESC
LIMIT 100;
```

### Step 2 — Identify areas needing more depth

Look for:
- Questions asked 3+ times on the same topic → add to Concepts tab or expand system prompt
- Topics where users ask "why" → add to Design Decisions section in Concepts tab
- Questions about non-existent features → update system prompt to address limitations clearly
- Questions in a specific context (e.g., Edit Activity) → update that page's chips

### Step 3 — Update content

| Finding                              | Where to update                                                    |
| ------------------------------------ | ------------------------------------------------------------------ |
| New concept users don't understand   | Add Term to ConceptsTab + expand `docs/help/concepts.md`           |
| Workflow step confusing users        | Update relevant `docs/help/*.md` + system prompt in `help.ts`      |
| Architectural decision not clear     | Add Decision to ConceptsTab (Design Decisions section)             |
| Context chip not relevant            | Update `CHIPS` object in `HelpPanel.tsx`                           |
| Feature missing from AI knowledge    | Update `SYSTEM_PROMPT` in `netlify/functions/help.ts`              |

### Step 4 — Test

After updates: run `npm run dev:netlify` and test the changed questions manually.
Verify AI answers with updated system prompt are correct and concise.

---

## Adding Modal Context (D4 — future enhancement)

Currently, Help context is page-based (Activities / Structure / Add / Edit / View).
For modal-specific context (e.g., user has the ⋮ menu open), the pattern would be:

1. In the component opening the modal, call `setPageHint('structure-actions')` via `useHelp()`
2. Add the hint to `useCurrentPage()` in HelpPanel
3. Add chips for the new context in `CHIPS`

This is an opt-in enhancement per modal — not required for all modals, only the most complex ones
(e.g., Manage Access modal, Add Between panel, Edit panel).

---

## Env Variables

| Variable                     | Where used                                  | Required on     |
| ---------------------------- | ------------------------------------------- | --------------- |
| `ANTHROPIC_API_KEY`          | `netlify/functions/help.ts`                 | Netlify (PROD)  |
| `SUPABASE_URL`               | `netlify/functions/help.ts`                 | Netlify (PROD)  |
| `SUPABASE_SERVICE_ROLE_KEY`  | `netlify/functions/help.ts` (for help_log)  | Netlify (PROD)  |
| `VITE_HELP_API_URL`          | `src/components/help/HelpPanel.tsx`         | local `.env.local` |

For local testing: `npm run dev:netlify` (starts Netlify dev server on :8888, proxy handles functions).
