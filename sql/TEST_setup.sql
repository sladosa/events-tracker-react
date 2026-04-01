-- ============================================================
-- TEST_setup.sql — Events Tracker React
-- Runnable schema for TEST Supabase project (collab development)
-- ============================================================
-- Run this in Supabase SQL Editor on the TEST project.
-- Tables created in correct FK order.
-- RLS: basic user_id = auth.uid() policies (collab RLS added later via 008/009).
-- ============================================================

-- Extension: ltree (for categories.path)
CREATE EXTENSION IF NOT EXISTS ltree;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.areas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
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

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
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
  path ltree,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id),
  CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.attribute_definitions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
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

CREATE TABLE IF NOT EXISTS public.events (
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

CREATE TABLE IF NOT EXISTS public.event_attributes (
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

CREATE TABLE IF NOT EXISTS public.event_attachments (
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

CREATE TABLE IF NOT EXISTS public.data_shares (
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

CREATE TABLE IF NOT EXISTS public.activity_presets (
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

-- ============================================================
-- RLS — Enable Row Level Security on all tables
-- ============================================================

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_presets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — basic user_id = auth.uid()
-- (collab policies added later via 008_profiles.sql + 009_sharing.sql)
-- ============================================================

-- areas
CREATE POLICY "areas_select" ON public.areas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "areas_insert" ON public.areas FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "areas_update" ON public.areas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "areas_delete" ON public.areas FOR DELETE USING (user_id = auth.uid());

-- categories
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (user_id = auth.uid());

-- attribute_definitions
CREATE POLICY "attr_def_select" ON public.attribute_definitions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attr_def_insert" ON public.attribute_definitions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attr_def_update" ON public.attribute_definitions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "attr_def_delete" ON public.attribute_definitions FOR DELETE USING (user_id = auth.uid());

-- events
CREATE POLICY "events_select" ON public.events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "events_update" ON public.events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "events_delete" ON public.events FOR DELETE USING (user_id = auth.uid());

-- event_attributes
CREATE POLICY "event_attr_select" ON public.event_attributes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "event_attr_insert" ON public.event_attributes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_attr_update" ON public.event_attributes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "event_attr_delete" ON public.event_attributes FOR DELETE USING (user_id = auth.uid());

-- event_attachments
CREATE POLICY "event_attach_select" ON public.event_attachments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "event_attach_insert" ON public.event_attachments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_attach_update" ON public.event_attachments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "event_attach_delete" ON public.event_attachments FOR DELETE USING (user_id = auth.uid());

-- data_shares (owner controls their shares)
CREATE POLICY "data_shares_select" ON public.data_shares FOR SELECT USING (owner_id = auth.uid() OR grantee_id = auth.uid());
CREATE POLICY "data_shares_insert" ON public.data_shares FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "data_shares_update" ON public.data_shares FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "data_shares_delete" ON public.data_shares FOR DELETE USING (owner_id = auth.uid());

-- activity_presets
CREATE POLICY "presets_select" ON public.activity_presets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "presets_insert" ON public.activity_presets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "presets_update" ON public.activity_presets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "presets_delete" ON public.activity_presets FOR DELETE USING (user_id = auth.uid());
