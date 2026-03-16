-- ============================================================
-- SQL Schema V4  —  Events Tracker React
-- ============================================================
-- SOURCE: Exported directly from Supabase 2026-03-12
--         (ground truth — reflects actual DB state)
-- WARNING: For context / reference only. Not meant to be run as-is.
--
-- Changes vs V3:
--   events.chain_key (uuid, FK → categories)
--     System field: UUID of the leaf category that owns this parent event.
--     Chain disambiguator (BUG-G fix v2). NULL for leaf events and legacy data.
--     Applied via migration 004_add_chain_key.sql (2026-03-12).
--   events.comment — exclusively user free-text (Event Note). Never system data.
--
-- Key design notes:
--   - attribute_definitions.validation_rules (jsonb) drives all dropdowns.
--     lookup_values table exists but is NOT used (legacy, empty).
--   - categories.path is ltree type (shown as USER-DEFINED in export).
--   - auth.uid() returns NULL with Role=postgres in SQL Editor.
--     Use direct UUID: 768a6056-91fd-42bb-98ae-ee83e6bd6c8d
--   - activity_presets and data_shares exist but are not used in React app.
-- ============================================================

CREATE TABLE public.activity_presets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  area_id uuid,
  category_id uuid,
  usage_count integer DEFAULT 0,
  last_used timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_presets_pkey PRIMARY KEY (id),
  CONSTRAINT activity_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT activity_presets_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id),
  CONSTRAINT activity_presets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.areas (
  id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  icon text,
  color text,
  sort_order integer NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  slug text NOT NULL,
  CONSTRAINT areas_pkey PRIMARY KEY (id),
  CONSTRAINT areas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.attribute_definitions (
  -- data_type: 'number' | 'text' | 'datetime' | 'boolean' | 'link' | 'image'
  -- validation_rules (jsonb): drives dropdowns — { type: 'suggest', suggest: [...] }
  --   or cascading: { type: 'suggest', depends_on: { attribute_slug, options_map } }
  id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  data_type text NOT NULL CHECK (data_type = ANY (ARRAY['number'::text, 'text'::text, 'datetime'::text, 'boolean'::text, 'link'::text, 'image'::text])),
  unit text,
  is_required boolean DEFAULT false,
  default_value text,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  slug text NOT NULL,
  description text,
  CONSTRAINT attribute_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT attribute_definitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT attribute_definitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  -- Hierarchy: Area → L1 (Activity) → L2 (Gym) → Leaf (Cardio)
  -- path: ltree materialized path (USER-DEFINED in export)
  id uuid NOT NULL,
  area_id uuid,
  parent_category_id uuid,
  name text NOT NULL,
  description text,
  level integer NOT NULL CHECK (level >= 1 AND level <= 10),
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  slug text NOT NULL,
  path USER-DEFINED,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id),
  CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.data_shares (
  -- Not used in React app — reserved for future data sharing between users
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  share_type text NOT NULL CHECK (share_type = ANY (ARRAY['area'::text, 'category'::text])),
  target_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission = ANY (ARRAY['read'::text, 'write'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  note text,
  CONSTRAINT data_shares_pkey PRIMARY KEY (id),
  CONSTRAINT data_shares_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT data_shares_grantee_id_fkey FOREIGN KEY (grantee_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_attachments (
  -- Photos and links for leaf events. Images in Supabase Storage bucket: event-photos
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid,
  type text CHECK (type = ANY (ARRAY['image'::text, 'link'::text, 'file'::text])),
  url text NOT NULL,
  filename text,
  size_bytes integer,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT event_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT event_attachments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_attributes (
  -- EAV: one row = one attribute value for one event.
  -- Only one value_* column populated per row (based on data_type).
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid,
  attribute_definition_id uuid,
  value_text text,
  value_number numeric,
  value_datetime timestamp with time zone,
  value_boolean boolean,
  value_json jsonb,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT event_attributes_pkey PRIMARY KEY (id),
  CONSTRAINT event_attributes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_attributes_attribute_definition_id_fkey FOREIGN KEY (attribute_definition_id) REFERENCES public.attribute_definitions(id),
  CONSTRAINT event_attributes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.events (
  -- P2 architecture: 1 session = 1 session_start = N events (1 leaf + parent chain).
  -- Leaf event:   category_id = leaf category,   chain_key = NULL
  -- Parent event: category_id = parent category, chain_key = UUID of leaf category
  --
  -- session_start: always rounded to the minute (seconds=0, ms=0).
  -- comment: user-facing Event Note only. NEVER store system data here.
  -- chain_key: system field — chain discriminator. Added in migration 004 (2026-03-12).
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  category_id uuid,
  event_date date NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  edited_at timestamp with time zone DEFAULT now(),
  session_start timestamp with time zone,
  chain_key uuid,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT events_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT events_chain_key_fkey FOREIGN KEY (chain_key) REFERENCES public.categories(id)
);
CREATE TABLE public.lookup_values (
  -- LEGACY — not used in React app. Dropdown options live in
  -- attribute_definitions.validation_rules instead. Table kept as no-op.
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  lookup_name text NOT NULL,
  parent_key text,
  value text NOT NULL,
  sort_order integer DEFAULT 0,
  CONSTRAINT lookup_values_pkey PRIMARY KEY (id),
  CONSTRAINT lookup_values_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================
-- Applied migrations:
--   001_lookup_values.sql       — lookup_values table creation
--   002_lookup_values_examples  — sample lookup data
--   003_fix_rls_policies.sql    — RLS policy fixes
--   004_add_chain_key.sql       — events.chain_key column (2026-03-12)
-- ============================================================
