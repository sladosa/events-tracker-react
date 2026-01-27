# Events Tracker

> Flexible event tracking system with hierarchical categories and customizable attributes.

⚠️ **STATUS: IN DEVELOPMENT** - This is a complete project rebuild. The previous Streamlit version works but is being migrated to a modern stack.

---

## 🎯 What is this?

Activity tracking system with flexible structure:
- **Hierarchy:** Areas → Categories (up to 10 levels) → Attributes
- **EAV pattern:** Dynamic attributes (number, text, datetime, boolean...)
- **Multi-session:** Multiple activities per day with timestamps

**Use cases:** Fitness tracking, health diary, project tracking, personal diary.

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Netlify |
| Legacy version | Streamlit (Python) - separate repo |

---

## 📋 Development Status

### Phase 1: Foundations
- [ ] Project setup (Vite + React + TS)
- [ ] GitHub repo + Netlify deployment
- [ ] Supabase configuration

### Phase 2: Auth (W1)
- [ ] Sign In form
- [ ] Sign Up form  
- [ ] Forgot Password
- [ ] Auth Context + protected routes

### Phase 3: Core UI (W2-W3)
- [ ] Universal Filter component
- [ ] Add Activity wizard
- [ ] Mobile-responsive layout

### Phase 4: Events Management
- [ ] Events list with filters
- [ ] Event editing
- [ ] Excel export/import integration

### Phase 5: Advanced
- [ ] Shortcuts system
- [ ] Dynamic dropdowns (lookup_values)
- [ ] Data sharing between users

---

## 🗄️ Database

Uses existing Supabase database (migrated from Streamlit version).

**Main tables:**
```
areas                  - Top-level organization
categories             - Hierarchical structure  
attribute_definitions  - Attribute definitions per category
events                 - Main activity records
event_attributes       - EAV attribute values
```

Detailed schema: `docs/SQL_schema_V2.sql`

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/USERNAME/events-tracker-react.git
cd events-tracker-react

# Install
npm install

# Environment
cp .env.example .env.local
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run
npm run dev
```

---

## 📁 Project Structure

```
src/
├── components/     # UI components
│   ├── ui/         # Base components (Button, Input...)
│   └── features/   # Feature-specific
├── hooks/          # Custom React hooks
├── lib/            # Utilities + Supabase client
├── pages/          # Route components
├── context/        # React Context providers
└── types/          # TypeScript types
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `docs/Code_Guidelines_React.md` | Coding standards for the project |
| `docs/SQL_schema_V2.sql` | Database schema |
| `docs/Migration_Plan.md` | Migration plan from Streamlit |

---

## 🔗 Links

- **Production:** *TBD*
- **Supabase:** [Dashboard](https://supabase.com/dashboard/project/zdojdazosfoajwnuafgx)
- **Legacy version (Streamlit):** [events-tracker](https://github.com/USERNAME/events-tracker)

---

## 📄 License

MIT

---

*Last updated: 2026-01-25*
