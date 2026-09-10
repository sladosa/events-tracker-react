-- ============================================================
-- SCHEMA_TEST.sql -- SNIMKA STVARNE SHEME, generirano alatom
-- ============================================================
-- Generirao: data-prep_tools/Tools/dump_schema.py --env test
-- Vrijeme:   2026-09-10T14:53:29+02:00
--
-- ⚠ OVO SE NE PUSTA I NE UREĐUJE RUKOM. Ovo je ono sto u bazi
--   STVARNO STOJI, ne ono sto smo mislili da smo pustili. Promjene
--   idu kroz numerirane migracije (`sql/0NN_*.sql`), pa se ovaj file
--   regenerira -- i `git diff` pokaze je li migracija ucinila ono sto
--   je obecala.
--
-- ⚠ TEST I PROD NISU ISTA BAZA. Usporedi ih diffom prije nego
--   zakljucis da je nesto provjereno na TEST-u provjereno i za PROD.
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict EgxFtQnKO8hhA9ewzjqFHfDq9cLIJIb0Bh8O0GwPeJDdZq2m8fhKUWFfprJNpKb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_assert_slugs(uuid, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_assert_slugs(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

DECLARE

  v_slug text;

  v_op   text;

BEGIN

  IF p_group_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_group_slug) = 0 THEN

    RAISE EXCEPTION 'Group attribute slug "%" not found in area %', p_group_slug, p_area_id

      USING ERRCODE = '22023';

  END IF;



  -- plus/minus must be numeric: rule 3 reads value_number, so a text attribute

  -- would silently sum to zero instead of failing

  IF p_plus_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_plus_slug, true) = 0 THEN

    RAISE EXCEPTION 'Plus attribute slug "%" not found in area % as a number', p_plus_slug, p_area_id

      USING ERRCODE = '22023';

  END IF;



  IF p_minus_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_minus_slug, true) = 0 THEN

    RAISE EXCEPTION 'Minus attribute slug "%" not found in area % as a number', p_minus_slug, p_area_id

      USING ERRCODE = '22023';

  END IF;



  FOR v_slug, v_op IN

    SELECT elem->>'slug', lower(coalesce(elem->>'op', 'in'))

    FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) elem

  LOOP

    IF v_op NOT IN ('in', 'not_in') THEN

      RAISE EXCEPTION 'Unsupported filter op "%" (v1 knows in / not_in)', v_op

        USING ERRCODE = '22023';

    END IF;

    IF v_slug IS NULL OR public.app_slug_count(p_area_id, v_slug) = 0 THEN

      RAISE EXCEPTION 'Filter attribute slug "%" not found in area %', v_slug, p_area_id

        USING ERRCODE = '22023';

    END IF;

  END LOOP;

END;

$$;


--
-- Name: app_can_read_area(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_can_read_area(p_area_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

  -- nullif('') before the cast: the setting is absent in the SQL Editor and can

  -- be an empty string elsewhere, and ''::jsonb raises instead of returning NULL.

  SELECT

    coalesce(

      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',

      ''

    ) = 'service_role'

  OR EXISTS (

    SELECT 1

    FROM public.areas a

    WHERE a.id = p_area_id

      AND (

        a.user_id = auth.uid()

        -- template user: its Areas are readable by everyone (see areas_select)

        OR a.user_id = 'be785f09-b7c6-497f-b351-363d224c93c8'::uuid

        OR EXISTS (

          SELECT 1 FROM public.data_shares ds

          WHERE ds.target_id  = a.id

            AND ds.share_type = 'area'

            AND (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())

        )

      )

  );

$$;


--
-- Name: FUNCTION app_can_read_area(p_area_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.app_can_read_area(p_area_id uuid) IS 'True when the caller may read this Area (service_role, owner, template user, or a data_shares row). Mirrors the areas_select RLS policy; keep the two in sync.';


--
-- Name: app_can_write_area(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_can_write_area(p_area_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

  SELECT EXISTS (

    SELECT 1

    FROM public.areas a

    WHERE a.id = p_area_id

      AND (

        a.user_id = auth.uid()

        OR EXISTS (

          SELECT 1 FROM public.data_shares ds

          WHERE ds.target_id  = a.id

            AND ds.share_type = 'area'

            AND ds.permission = 'write'

            AND ds.grantee_id = auth.uid()

        )

      )

  );

$$;


--
-- Name: app_slug_count(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_slug_count(p_area_id uuid, p_slug text, p_numeric boolean DEFAULT false) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

  SELECT count(*)::integer

  FROM public.attribute_definitions ad

  JOIN public.categories c ON c.id = ad.category_id

  WHERE c.area_id = p_area_id

    AND ad.slug = p_slug

    AND (NOT p_numeric OR ad.data_type = 'number');

$$;


--
-- Name: area_agg_rows(uuid, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.area_agg_rows(p_area_id uuid, p_group_slug text DEFAULT NULL::text, p_plus_slug text DEFAULT NULL::text, p_minus_slug text DEFAULT NULL::text, p_filters jsonb DEFAULT '[]'::jsonb) RETURNS TABLE(event_id uuid, event_date date, group_value text, plus_val numeric, minus_val numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$

  WITH

  -- slug → attribute_definition ids inside THIS area.

  -- P1 allows the same slug on several category levels, hence a set, not one id.

  defs AS (

    SELECT ad.id, ad.slug, ad.data_type

    FROM public.attribute_definitions ad

    JOIN public.categories c ON c.id = ad.category_id

    WHERE c.area_id = p_area_id

  ),

  group_defs AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_group_slug),

  plus_defs  AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_plus_slug  AND data_type = 'number'),

  minus_defs AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_minus_slug AND data_type = 'number'),

  -- filter list, each slug resolved to its definition ids

  fdef AS (

    SELECT

      lower(coalesce(elem->>'op', 'in')) AS op,

      ARRAY(SELECT jsonb_array_elements_text(elem->'values')) AS vals,

      ARRAY(SELECT d.id FROM defs d WHERE d.slug = elem->>'slug') AS def_ids

    FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) AS elem

  ),

  elig AS (

    SELECT e.id, e.event_date

    FROM public.events e

    JOIN public.categories c ON c.id = e.category_id

    WHERE c.area_id = p_area_id

      -- rule 2, guard A: leaf categories only

      AND NOT EXISTS (SELECT 1 FROM public.categories ch WHERE ch.parent_category_id = c.id)

      -- rule 2, guard B: chain_key is set on parent events only

      AND e.chain_key IS NULL

      -- attribute filters (bool_and over an empty set is NULL ⇒ coalesce to true)

      AND coalesce((

        SELECT bool_and(CASE WHEN fd.op = 'not_in' THEN NOT hit.v ELSE hit.v END)

        FROM fdef fd

        CROSS JOIN LATERAL (

          SELECT EXISTS (

            SELECT 1 FROM public.event_attributes ea

            WHERE ea.event_id = e.id

              AND ea.attribute_definition_id = ANY (fd.def_ids)   -- rule 3

              AND ea.value_text = ANY (fd.vals)

          )

        ) AS hit(v)

      ), true)

  )

  SELECT e.id, e.event_date, g.v, p.v, m.v

  FROM elig e

  -- LEFT JOIN, never INNER: an event without a group value must stay visible as

  -- a NULL group rather than vanish from the total.

  LEFT JOIN LATERAL (

    SELECT coalesce(

             ea.value_text,

             ea.value_number::text,

             to_char(ea.value_datetime, 'YYYY-MM-DD'),

             ea.value_boolean::text

           ) AS v

    FROM public.event_attributes ea, group_defs gd

    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (gd.ids)

    LIMIT 1

  ) g ON true

  LEFT JOIN LATERAL (

    SELECT ea.value_number AS v

    FROM public.event_attributes ea, plus_defs pd

    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (pd.ids)

    LIMIT 1

  ) p ON true

  LEFT JOIN LATERAL (

    SELECT ea.value_number AS v

    FROM public.event_attributes ea, minus_defs md

    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (md.ids)

    LIMIT 1

  ) m ON true;

$$;


--
-- Name: FUNCTION area_agg_rows(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.area_agg_rows(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) IS 'Internal row source for the Overview aggregates. Not for direct client use — EXECUTE is revoked.';


--
-- Name: guard_event_author_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_event_author_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id <> auth.uid() THEN

    RAISE EXCEPTION

      'Autorstvo retka (user_id) smije se promijeniti samo u preuzimanje na vlastiti racun.';

  END IF;

  RETURN NEW;

END;

$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  INSERT INTO public.profiles (id, email)

  VALUES (new.id, new.email)

  ON CONFLICT (id) DO NOTHING;

  RETURN new;

END;

$$;


--
-- Name: handle_pending_invites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_pending_invites() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  INSERT INTO public.data_shares (owner_id, grantee_id, share_type, target_id, permission)

  SELECT owner_id, new.id, share_type, target_id, permission

  FROM public.share_invites

  WHERE grantee_email = new.email AND status = 'pending';



  UPDATE public.share_invites

  SET status = 'accepted'

  WHERE grantee_email = new.email AND status = 'pending';



  RETURN new;

END;

$$;


--
-- Name: rpc_area_balance_anchored(uuid, text, text, text, jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text DEFAULT NULL::text, p_minus_slug text DEFAULT NULL::text, p_filters jsonb DEFAULT '[]'::jsonb, p_as_of date DEFAULT NULL::date) RETURNS TABLE(group_value text, anchored boolean, anchor_amount numeric, anchor_on date, plus_sum numeric, minus_sum numeric, n integer, balance numeric, last_on date)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

BEGIN

  -- SECURITY DEFINER must check access itself, or it leaks the whole database

  -- through one RPC (035 §2). Unchanged from 036.

  IF NOT public.app_can_read_area(p_area_id) THEN

    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';

  END IF;



  PERFORM public.app_assert_slugs(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters);



  RETURN QUERY

  WITH anchors AS (

    SELECT DISTINCT ON (ba.group_value)

           ba.group_value, ba.amount, ba.confirmed_on

    FROM public.balance_anchors ba

    WHERE ba.area_id    = p_area_id

      AND ba.group_slug = p_group_slug

      AND (p_as_of IS NULL OR ba.confirmed_on <= p_as_of)

    ORDER BY ba.group_value, ba.confirmed_on DESC, ba.created_at DESC

  ),

  counted AS (

    SELECT r.group_value,

           coalesce(sum(r.plus_val), 0)  AS plus_sum,

           coalesce(sum(r.minus_val), 0) AS minus_sum,

           count(*)::integer             AS n,

           -- 038: same WHERE, so this can only ever describe rows that are in

           -- the number above. Deriving it anywhere else would let the two

           -- drift apart, which is exactly the failure this column exists for.

           max(r.event_date)             AS last_on

    FROM public.area_agg_rows(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters) r

    LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM r.group_value

    WHERE (p_as_of IS NULL OR r.event_date <= p_as_of)

      -- §2.17 point 3: STRICTLY after, no exception

      AND (a.confirmed_on IS NULL OR r.event_date > a.confirmed_on)

    GROUP BY r.group_value

  ),

  keys AS (

    SELECT c.group_value FROM counted c

    UNION

    SELECT a.group_value FROM anchors a

  )

  SELECT

    k.group_value,

    a.confirmed_on IS NOT NULL,

    a.amount,

    a.confirmed_on,

    coalesce(c.plus_sum, 0),

    coalesce(c.minus_sum, 0),

    coalesce(c.n, 0),

    coalesce(a.amount, 0) + coalesce(c.plus_sum, 0) - coalesce(c.minus_sum, 0),

    c.last_on                       -- NULL when nothing moved since the anchor

  FROM keys k

  LEFT JOIN counted c ON c.group_value IS NOT DISTINCT FROM k.group_value

  LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM k.group_value

  ORDER BY k.group_value NULLS LAST;

END;

$$;


--
-- Name: FUNCTION rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date) IS 'Overview balance tile: confirmed anchor + movement strictly after it, per group value, plus last_on = newest event_date that entered the sum. Checks area access itself.';


--
-- Name: rpc_area_group_agg(uuid, text, text, text, jsonb, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_area_group_agg(p_area_id uuid, p_group_slug text DEFAULT NULL::text, p_plus_slug text DEFAULT NULL::text, p_minus_slug text DEFAULT NULL::text, p_filters jsonb DEFAULT '[]'::jsonb, p_from date DEFAULT NULL::date, p_as_of date DEFAULT NULL::date) RETURNS TABLE(group_value text, plus_sum numeric, minus_sum numeric, n integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

BEGIN

  -- rule 1 — this function bypasses RLS, so it must gate itself

  IF NOT public.app_can_read_area(p_area_id) THEN

    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';

  END IF;



  PERFORM public.app_assert_slugs(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters);



  RETURN QUERY

  SELECT r.group_value,

         coalesce(sum(r.plus_val), 0)::numeric,

         coalesce(sum(r.minus_val), 0)::numeric,

         count(*)::integer

  FROM public.area_agg_rows(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters) r

  WHERE (p_from  IS NULL OR r.event_date >  p_from)

    AND (p_as_of IS NULL OR r.event_date <= p_as_of)

  GROUP BY r.group_value

  ORDER BY r.group_value NULLS LAST;

END;

$$;


--
-- Name: FUNCTION rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date) IS 'Overview: sum plus/minus per group value for one Area. Checks area access itself (SECURITY DEFINER).';


--
-- Name: user_owns_area(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_area(area_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = area_uuid
      AND a.user_id = auth.uid()
  );
$$;


--
-- Name: user_owns_category_area(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_category_area(cat_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.areas a ON a.id = c.area_id
    WHERE c.id = cat_uuid
      AND a.user_id = auth.uid()
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_presets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    area_id uuid,
    category_id uuid,
    usage_count integer DEFAULT 0,
    last_used timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    default_attributes jsonb,
    filter_state jsonb
);


--
-- Name: COLUMN activity_presets.filter_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activity_presets.filter_state IS 'Saved filter state: periodKey, sortOrder, commentSearch, attrFilter';


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    icon text,
    color text,
    sort_order integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb
);


--
-- Name: attribute_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute_definitions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    category_id uuid,
    name text NOT NULL,
    data_type text NOT NULL,
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
    CONSTRAINT attribute_definitions_data_type_check CHECK ((data_type = ANY (ARRAY['number'::text, 'text'::text, 'datetime'::text, 'boolean'::text, 'link'::text, 'image'::text])))
);


--
-- Name: balance_anchors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balance_anchors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    area_id uuid NOT NULL,
    group_slug text NOT NULL,
    group_value text NOT NULL,
    amount numeric NOT NULL,
    confirmed_on date NOT NULL,
    note text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE balance_anchors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.balance_anchors IS 'Confirmed balance per group value, typed in by a human reading the bank app. Append-only history; the balance is anchor + changes strictly after confirmed_on. Never travels with the Area (see OVERVIEW_TAB_SPEC §2.17).';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    area_id uuid,
    parent_category_id uuid,
    name text NOT NULL,
    description text,
    level integer NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    slug text NOT NULL,
    path public.ltree,
    settings jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT categories_level_check CHECK (((level >= 1) AND (level <= 10)))
);


--
-- Name: category_full_paths; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.category_full_paths AS
 WITH RECURSIVE cat_tree AS (
         SELECT c.id,
            c.name,
            c.area_id,
            ARRAY[c.name] AS path_names
           FROM public.categories c
          WHERE (c.parent_category_id IS NULL)
        UNION ALL
         SELECT c.id,
            c.name,
            ct_1.area_id,
            (ct_1.path_names || c.name)
           FROM (public.categories c
             JOIN cat_tree ct_1 ON ((c.parent_category_id = ct_1.id)))
        )
 SELECT ct.id AS category_id,
    ct.name AS category_name,
    ct.area_id,
    a.name AS area_name,
    a.icon AS area_icon,
    (ARRAY[a.name] || ct.path_names) AS full_path
   FROM (cat_tree ct
     LEFT JOIN public.areas a ON ((a.id = ct.area_id)));


--
-- Name: data_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_shares (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    grantee_id uuid NOT NULL,
    share_type text NOT NULL,
    target_id uuid NOT NULL,
    permission text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    note text,
    CONSTRAINT data_shares_permission_check CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text]))),
    CONSTRAINT data_shares_share_type_check CHECK ((share_type = ANY (ARRAY['area'::text, 'category'::text])))
);


--
-- Name: event_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_attachments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid,
    type text,
    url text NOT NULL,
    filename text,
    size_bytes integer,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT event_attachments_type_check CHECK ((type = ANY (ARRAY['image'::text, 'link'::text, 'file'::text])))
);


--
-- Name: event_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_attributes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid,
    attribute_definition_id uuid,
    value_text text,
    value_number numeric,
    value_datetime timestamp with time zone,
    value_boolean boolean,
    value_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    category_id uuid,
    event_date date NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    edited_at timestamp with time zone DEFAULT now(),
    session_start timestamp with time zone,
    chain_key uuid,
    edited_by uuid
);


--
-- Name: COLUMN events.edited_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.edited_by IS 'Tko je zadnji spremio izmjenu. NULL = od zadnjeg uvoza/unosa nitko, ili je redak stariji od 043. Prikazuje se samo kad se razlikuje od user_id.';


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    message text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_type_check CHECK ((type = ANY (ARRAY['wish'::text, 'bug'::text, 'question'::text])))
);


--
-- Name: help_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    question text NOT NULL,
    answer text,
    context jsonb DEFAULT '{}'::jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: share_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_invites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    grantee_email text NOT NULL,
    share_type text DEFAULT 'area'::text NOT NULL,
    target_id uuid NOT NULL,
    permission text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    action_link text,
    CONSTRAINT share_invites_permission_check CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text]))),
    CONSTRAINT share_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])))
);


--
-- Name: activity_presets activity_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_presets
    ADD CONSTRAINT activity_presets_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: attribute_definitions attribute_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_pkey PRIMARY KEY (id);


--
-- Name: balance_anchors balance_anchors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_anchors
    ADD CONSTRAINT balance_anchors_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: data_shares data_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_shares
    ADD CONSTRAINT data_shares_pkey PRIMARY KEY (id);


--
-- Name: data_shares data_shares_unique_share; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_shares
    ADD CONSTRAINT data_shares_unique_share UNIQUE (owner_id, grantee_id, target_id, share_type);


--
-- Name: event_attachments event_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attachments
    ADD CONSTRAINT event_attachments_pkey PRIMARY KEY (id);


--
-- Name: event_attributes event_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attributes
    ADD CONSTRAINT event_attributes_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: help_log help_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_log
    ADD CONSTRAINT help_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: share_invites share_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_invites
    ADD CONSTRAINT share_invites_pkey PRIMARY KEY (id);


--
-- Name: idx_balance_anchors_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_anchors_lookup ON public.balance_anchors USING btree (area_id, group_slug, group_value, confirmed_on DESC, created_at DESC);


--
-- Name: idx_ea_value_text_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ea_value_text_trgm ON public.event_attributes USING gin (value_text public.gin_trgm_ops);


--
-- Name: idx_event_attributes_attr_def_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attributes_attr_def_id ON public.event_attributes USING btree (attribute_definition_id);


--
-- Name: idx_event_attributes_attr_def_value_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attributes_attr_def_value_text ON public.event_attributes USING btree (attribute_definition_id, value_text);


--
-- Name: idx_event_attributes_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attributes_event_id ON public.event_attributes USING btree (event_id);


--
-- Name: events guard_event_author; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_event_author BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_event_author_change();


--
-- Name: profiles on_profile_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_pending_invites();


--
-- Name: activity_presets activity_presets_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_presets
    ADD CONSTRAINT activity_presets_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: activity_presets activity_presets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_presets
    ADD CONSTRAINT activity_presets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: activity_presets activity_presets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_presets
    ADD CONSTRAINT activity_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: areas areas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: attribute_definitions attribute_definitions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: attribute_definitions attribute_definitions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: balance_anchors balance_anchors_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_anchors
    ADD CONSTRAINT balance_anchors_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE CASCADE;


--
-- Name: balance_anchors balance_anchors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_anchors
    ADD CONSTRAINT balance_anchors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: categories categories_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: categories categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(id);


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: data_shares data_shares_grantee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_shares
    ADD CONSTRAINT data_shares_grantee_id_fkey FOREIGN KEY (grantee_id) REFERENCES auth.users(id);


--
-- Name: data_shares data_shares_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_shares
    ADD CONSTRAINT data_shares_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: event_attachments event_attachments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attachments
    ADD CONSTRAINT event_attachments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: event_attachments event_attachments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attachments
    ADD CONSTRAINT event_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: event_attributes event_attributes_attribute_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attributes
    ADD CONSTRAINT event_attributes_attribute_definition_id_fkey FOREIGN KEY (attribute_definition_id) REFERENCES public.attribute_definitions(id);


--
-- Name: event_attributes event_attributes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attributes
    ADD CONSTRAINT event_attributes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: event_attributes event_attributes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attributes
    ADD CONSTRAINT event_attributes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: events events_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: events events_chain_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_chain_key_fkey FOREIGN KEY (chain_key) REFERENCES public.categories(id);


--
-- Name: events events_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES auth.users(id);


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: help_log help_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_log
    ADD CONSTRAINT help_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: share_invites share_invites_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_invites
    ADD CONSTRAINT share_invites_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: activity_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

--
-- Name: areas areas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY areas_delete ON public.areas FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: areas areas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY areas_insert ON public.areas FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: areas areas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY areas_select ON public.areas FOR SELECT USING (public.app_can_read_area(id));


--
-- Name: areas areas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY areas_update ON public.areas FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: attribute_definitions attr_def_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attr_def_delete ON public.attribute_definitions FOR DELETE USING (public.user_owns_category_area(category_id));


--
-- Name: attribute_definitions attr_def_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attr_def_insert ON public.attribute_definitions FOR INSERT WITH CHECK (public.user_owns_category_area(category_id));


--
-- Name: attribute_definitions attr_def_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attr_def_select ON public.attribute_definitions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = attribute_definitions.category_id) AND public.app_can_read_area(c.area_id)))));


--
-- Name: attribute_definitions attr_def_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attr_def_update ON public.attribute_definitions FOR UPDATE USING (public.user_owns_category_area(category_id)) WITH CHECK (public.user_owns_category_area(category_id));


--
-- Name: attribute_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: balance_anchors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.balance_anchors ENABLE ROW LEVEL SECURITY;

--
-- Name: balance_anchors balance_anchors_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY balance_anchors_delete ON public.balance_anchors FOR DELETE USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.areas a
  WHERE ((a.id = balance_anchors.area_id) AND (a.user_id = auth.uid()))))));


--
-- Name: balance_anchors balance_anchors_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY balance_anchors_insert ON public.balance_anchors FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.app_can_write_area(area_id)));


--
-- Name: balance_anchors balance_anchors_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY balance_anchors_select ON public.balance_anchors FOR SELECT USING (public.app_can_read_area(area_id));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_delete ON public.categories FOR DELETE USING (public.user_owns_area(area_id));


--
-- Name: categories categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert ON public.categories FOR INSERT WITH CHECK (public.user_owns_area(area_id));


--
-- Name: categories categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select ON public.categories FOR SELECT USING (public.app_can_read_area(area_id));


--
-- Name: categories categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update ON public.categories FOR UPDATE USING (public.user_owns_area(area_id)) WITH CHECK (public.user_owns_area(area_id));


--
-- Name: data_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: data_shares data_shares_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_shares_delete ON public.data_shares FOR DELETE USING (((owner_id = auth.uid()) OR (grantee_id = auth.uid())));


--
-- Name: data_shares data_shares_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_shares_insert ON public.data_shares FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: data_shares data_shares_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_shares_select ON public.data_shares FOR SELECT USING (((owner_id = auth.uid()) OR (grantee_id = auth.uid())));


--
-- Name: data_shares data_shares_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_shares_update ON public.data_shares FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: event_attachments event_attach_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attach_delete ON public.event_attachments FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: event_attachments event_attach_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attach_insert ON public.event_attachments FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: event_attachments event_attach_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attach_select ON public.event_attachments FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ((public.events e
     JOIN public.categories c ON ((c.id = e.category_id)))
     JOIN public.data_shares ds ON ((ds.target_id = c.area_id)))
  WHERE ((e.id = event_attachments.event_id) AND (ds.share_type = 'area'::text) AND ((ds.grantee_id = auth.uid()) OR (ds.owner_id = auth.uid())))))));


--
-- Name: event_attachments event_attach_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attach_update ON public.event_attachments FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: event_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: event_attachments event_attachments_delete_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attachments_delete_by_area_owner ON public.event_attachments FOR DELETE USING (((auth.uid() = user_id) OR (event_id IN ( SELECT e.id
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid())))));


--
-- Name: event_attributes event_attr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attr_delete ON public.event_attributes FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: event_attributes event_attr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attr_insert ON public.event_attributes FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE ((e.id = event_attributes.event_id) AND (a.user_id = auth.uid()) AND (e.user_id = event_attributes.user_id))))));


--
-- Name: event_attributes event_attr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attr_select ON public.event_attributes FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ((public.events e
     JOIN public.categories c ON ((c.id = e.category_id)))
     JOIN public.data_shares ds ON ((ds.target_id = c.area_id)))
  WHERE ((e.id = event_attributes.event_id) AND (ds.share_type = 'area'::text) AND ((ds.grantee_id = auth.uid()) OR (ds.owner_id = auth.uid())))))));


--
-- Name: event_attributes event_attr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attr_update ON public.event_attributes FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: event_attributes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_attributes ENABLE ROW LEVEL SECURITY;

--
-- Name: event_attributes event_attrs_delete_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attrs_delete_by_area_owner ON public.event_attributes FOR DELETE USING (((auth.uid() = user_id) OR (event_id IN ( SELECT e.id
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid())))));


--
-- Name: event_attributes event_attrs_select_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attrs_select_by_area_owner ON public.event_attributes FOR SELECT USING ((event_id IN ( SELECT e.id
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid()))));


--
-- Name: event_attributes event_attrs_update_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_attrs_update_by_area_owner ON public.event_attributes FOR UPDATE USING (((auth.uid() = user_id) OR (event_id IN ( SELECT e.id
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid()))))) WITH CHECK (((auth.uid() = user_id) OR (event_id IN ( SELECT e.id
   FROM ((public.events e
     JOIN public.categories c ON ((e.category_id = c.id)))
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid())))));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_delete ON public.events FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: events events_delete_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_delete_by_area_owner ON public.events FOR DELETE USING (((auth.uid() = user_id) OR (category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid())))));


--
-- Name: events events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_insert ON public.events FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = events.category_id) AND public.app_can_write_area(c.area_id))))));


--
-- Name: events events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_select ON public.events FOR SELECT USING (((auth.uid() = user_id) OR (category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.data_shares ds ON ((c.area_id = ds.target_id)))
  WHERE ((ds.grantee_id = auth.uid()) AND (ds.share_type = 'area'::text)))) OR (category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.data_shares ds ON ((c.area_id = ds.target_id)))
  WHERE ((ds.owner_id = auth.uid()) AND (ds.share_type = 'area'::text))))));


--
-- Name: events events_select_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_select_by_area_owner ON public.events FOR SELECT USING ((category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid()))));


--
-- Name: events events_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_update ON public.events FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: events events_update_by_area_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_update_by_area_owner ON public.events FOR UPDATE USING (((auth.uid() = user_id) OR (category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid()))))) WITH CHECK (((auth.uid() = user_id) OR (category_id IN ( SELECT c.id
   FROM (public.categories c
     JOIN public.areas a ON ((c.area_id = a.id)))
  WHERE (a.user_id = auth.uid())))));


--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback feedback_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_insert ON public.feedback FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feedback feedback_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_select ON public.feedback FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: help_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_log ENABLE ROW LEVEL SECURITY;

--
-- Name: help_log help_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_log_select ON public.help_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: share_invites invites_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_delete ON public.share_invites FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: share_invites invites_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_insert ON public.share_invites FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: share_invites invites_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_select ON public.share_invites FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: activity_presets presets_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presets_delete ON public.activity_presets FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: activity_presets presets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presets_insert ON public.activity_presets FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: activity_presets presets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presets_select ON public.activity_presets FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: activity_presets presets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presets_update ON public.activity_presets FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: share_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION app_assert_slugs(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_assert_slugs(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_assert_slugs(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) TO service_role;


--
-- Name: FUNCTION app_can_read_area(p_area_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.app_can_read_area(p_area_id uuid) TO anon;
GRANT ALL ON FUNCTION public.app_can_read_area(p_area_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.app_can_read_area(p_area_id uuid) TO service_role;


--
-- Name: FUNCTION app_can_write_area(p_area_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.app_can_write_area(p_area_id uuid) TO anon;
GRANT ALL ON FUNCTION public.app_can_write_area(p_area_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.app_can_write_area(p_area_id uuid) TO service_role;


--
-- Name: FUNCTION app_slug_count(p_area_id uuid, p_slug text, p_numeric boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_slug_count(p_area_id uuid, p_slug text, p_numeric boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_slug_count(p_area_id uuid, p_slug text, p_numeric boolean) TO service_role;


--
-- Name: FUNCTION area_agg_rows(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.area_agg_rows(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.area_agg_rows(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb) TO service_role;


--
-- Name: FUNCTION guard_event_author_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_event_author_change() TO anon;
GRANT ALL ON FUNCTION public.guard_event_author_change() TO authenticated;
GRANT ALL ON FUNCTION public.guard_event_author_change() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_pending_invites(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_pending_invites() TO anon;
GRANT ALL ON FUNCTION public.handle_pending_invites() TO authenticated;
GRANT ALL ON FUNCTION public.handle_pending_invites() TO service_role;


--
-- Name: FUNCTION rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date) TO anon;
GRANT ALL ON FUNCTION public.rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_area_balance_anchored(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_as_of date) TO service_role;


--
-- Name: FUNCTION rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date) TO anon;
GRANT ALL ON FUNCTION public.rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_area_group_agg(p_area_id uuid, p_group_slug text, p_plus_slug text, p_minus_slug text, p_filters jsonb, p_from date, p_as_of date) TO service_role;


--
-- Name: FUNCTION user_owns_area(area_uuid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_owns_area(area_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.user_owns_area(area_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_owns_area(area_uuid uuid) TO service_role;


--
-- Name: FUNCTION user_owns_category_area(cat_uuid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_owns_category_area(cat_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.user_owns_category_area(cat_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_owns_category_area(cat_uuid uuid) TO service_role;


--
-- Name: TABLE activity_presets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_presets TO anon;
GRANT ALL ON TABLE public.activity_presets TO authenticated;
GRANT ALL ON TABLE public.activity_presets TO service_role;


--
-- Name: TABLE areas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.areas TO anon;
GRANT ALL ON TABLE public.areas TO authenticated;
GRANT ALL ON TABLE public.areas TO service_role;


--
-- Name: TABLE attribute_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attribute_definitions TO anon;
GRANT ALL ON TABLE public.attribute_definitions TO authenticated;
GRANT ALL ON TABLE public.attribute_definitions TO service_role;


--
-- Name: TABLE balance_anchors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.balance_anchors TO anon;
GRANT ALL ON TABLE public.balance_anchors TO authenticated;
GRANT ALL ON TABLE public.balance_anchors TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE category_full_paths; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.category_full_paths TO anon;
GRANT ALL ON TABLE public.category_full_paths TO authenticated;
GRANT ALL ON TABLE public.category_full_paths TO service_role;


--
-- Name: TABLE data_shares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_shares TO anon;
GRANT ALL ON TABLE public.data_shares TO authenticated;
GRANT ALL ON TABLE public.data_shares TO service_role;


--
-- Name: TABLE event_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_attachments TO anon;
GRANT ALL ON TABLE public.event_attachments TO authenticated;
GRANT ALL ON TABLE public.event_attachments TO service_role;


--
-- Name: TABLE event_attributes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_attributes TO anon;
GRANT ALL ON TABLE public.event_attributes TO authenticated;
GRANT ALL ON TABLE public.event_attributes TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feedback TO anon;
GRANT ALL ON TABLE public.feedback TO authenticated;
GRANT ALL ON TABLE public.feedback TO service_role;


--
-- Name: TABLE help_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.help_log TO anon;
GRANT ALL ON TABLE public.help_log TO authenticated;
GRANT ALL ON TABLE public.help_log TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE share_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.share_invites TO anon;
GRANT ALL ON TABLE public.share_invites TO authenticated;
GRANT ALL ON TABLE public.share_invites TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict EgxFtQnKO8hhA9ewzjqFHfDq9cLIJIb0Bh8O0GwPeJDdZq2m8fhKUWFfprJNpKb

