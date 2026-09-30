-- ============================================================
-- 055_due_basket_members.sql — „Dospjelo → potvrdi", faza 2 (S156)
-- ============================================================
-- Spec: docs/DOSPJELO_SPEC.md §5 (potvrda košare), §7.
--
-- ŠTO RADI
--   1. `app_due_rows` — JEDNA definicija „koji redak je u kojoj košari"
--      (kartica + dan dospijeća u zoni korisnika). Do sada je živjela samo
--      unutar `rpc_area_due_baskets`; faza 2 je treba i za POPIS redaka.
--   2. `rpc_area_due_baskets` — ista funkcija kao u 053 (isti potpis, isti
--      izlaz), sada agregira nad `app_due_rows`.
--   3. `rpc_area_due_basket_members` — NOVO: retci jedne košare (id, autor,
--      kategorija, status). Potvrda po njima prebacuje `Status`.
--
-- ⚠ ZAŠTO NE DVIJE KOPIJE: traka pokaže Σ nad jednim skupom redaka, a
--   potvrda bi prebacila drugi. Razlika bi bila baš u rubu koji je već
--   jednom ugrizao — dan dospijeća u UTC-u vs lokalno (S152). Isti razred
--   kao `canUpdateExisting` (S125): svaka kopija uvjeta je prilika da se
--   raziđe.
--
-- ⚠ SAMO ČITANJE. Upis (Status, skupni redak) ide iz klijenta, kroz RLS —
--   tako baza sama brani D5 (vlasnica Aree smije mijenjati tuđe atribute,
--   `event_attrs_update_by_area_owner`), a klijent broji promijenjene retke.
--   SECURITY DEFINER RPC koji piše zaobišao bi RLS i morao bi pravila prava
--   ponoviti — treća kopija.
--
-- ⚠ `app_due_rows` NIJE dostupna izvana (REVOKE): nema provjeru pristupa,
--   pa je smiju zvati samo dvije funkcije ispod, koje je same provjeravaju.
--
-- Provjera nakon puštanja: `rpc_area_due_baskets` mora vratiti ISTO što i
-- prije (isti retci, isti brojevi) — izmjeriti prije i poslije.
--
-- Bezopasno i prije deploya: stari kod zove `rpc_area_due_baskets` istim
-- potpisom i dobiva isti oblik; nova funkcija nitko ne zove dok je kod ne pozove.
-- ============================================================

CREATE OR REPLACE FUNCTION public.app_due_rows(
  p_area_id     uuid,
  p_basket_slug text,
  p_due_slug    text,
  p_status_slug text,
  p_plus_slug   text,
  p_minus_slug  text,
  p_baskets     text[],
  p_tz          text
)
RETURNS TABLE (
  event_id    uuid,
  user_id     uuid,
  category_id uuid,
  basket      text,
  due_date    date,
  status      text,
  plus_v      numeric,
  minus_v     numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH
  defs AS (
    SELECT ad.id, ad.slug, ad.data_type
    FROM public.attribute_definitions ad
    JOIN public.categories c ON c.id = ad.category_id
    WHERE c.area_id = p_area_id
  ),
  basket_ids AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_basket_slug),
  due_ids    AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_due_slug),
  status_ids AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_status_slug),
  plus_ids   AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_plus_slug  AND data_type = 'number'),
  minus_ids  AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_minus_slug AND data_type = 'number'),
  elig AS (
    SELECT e.id, e.user_id, e.category_id
    FROM public.events e
    JOIN public.categories c ON c.id = e.category_id
    WHERE c.area_id = p_area_id
      -- P2 parenti se ne broje (035): samo leaf, samo bez chain_key
      AND NOT EXISTS (SELECT 1 FROM public.categories ch WHERE ch.parent_category_id = c.id)
      AND e.chain_key IS NULL
      -- rano suzi na konfigurirane košare (kartice), prije ostalih lookupa
      AND EXISTS (
        SELECT 1 FROM public.event_attributes ea, basket_ids b
        WHERE ea.event_id = e.id
          AND ea.attribute_definition_id = ANY (b.ids)
          AND ea.value_text = ANY (p_baskets)
      )
  ),
  r AS (
    SELECT
      e.id, e.user_id, e.category_id,
      (SELECT ea.value_text FROM public.event_attributes ea, basket_ids b
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (b.ids) LIMIT 1) AS b,
      -- ⚠ dan dospijeća u ZONI KORISNIKA (053, S152)
      (SELECT (ea.value_datetime AT TIME ZONE p_tz)::date FROM public.event_attributes ea, due_ids d
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (d.ids) LIMIT 1) AS d,
      (SELECT ea.value_text FROM public.event_attributes ea, status_ids s
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (s.ids) LIMIT 1) AS s,
      (SELECT ea.value_number FROM public.event_attributes ea, plus_ids p
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (p.ids) LIMIT 1) AS pv,
      (SELECT ea.value_number FROM public.event_attributes ea, minus_ids m
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (m.ids) LIMIT 1) AS mv
    FROM elig e
  )
  SELECT r.id, r.user_id, r.category_id, r.b, r.d, r.s, r.pv, r.mv
  FROM r
  WHERE r.b = ANY (p_baskets)
    AND r.d IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.app_due_rows(uuid, text, text, text, text, text, text[], text)
  FROM PUBLIC, anon, authenticated;

-- Zajednička vrata: pristup + slugovi. Nepoznat slug NIJE „nema dospjelog" —
-- mora pasti glasno, da poruka imenuje preimenovani atribut (035 §2).
CREATE OR REPLACE FUNCTION public.app_due_check(
  p_area_id     uuid,
  p_basket_slug text,
  p_due_slug    text,
  p_status_slug text,
  p_plus_slug   text,
  p_minus_slug  text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_read_area(p_area_id) THEN
    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';
  END IF;
  PERFORM public.app_assert_slugs(p_area_id, p_basket_slug, p_plus_slug, p_minus_slug, '[]'::jsonb);
  IF p_due_slug IS NULL OR public.app_slug_count(p_area_id, p_due_slug) = 0 THEN
    RAISE EXCEPTION 'Due attribute slug "%" not found in area %', p_due_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;
  IF p_status_slug IS NULL OR public.app_slug_count(p_area_id, p_status_slug) = 0 THEN
    RAISE EXCEPTION 'Status attribute slug "%" not found in area %', p_status_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_due_check(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- 2. Ista funkcija kao 053 — isti potpis, isti izlaz.
CREATE OR REPLACE FUNCTION public.rpc_area_due_baskets(
  p_area_id     uuid,
  p_basket_slug text,
  p_due_slug    text,
  p_status_slug text,
  p_pending     text,
  p_plus_slug   text,
  p_minus_slug  text,
  p_baskets     text[],
  p_as_of       date,
  p_tz          text DEFAULT 'UTC'
)
RETURNS TABLE (
  basket      text,
  due_date    date,
  n           integer,
  n_pending   integer,
  gross_plus  numeric,
  gross_minus numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.app_due_check(p_area_id, p_basket_slug, p_due_slug, p_status_slug, p_plus_slug, p_minus_slug);

  RETURN QUERY
  SELECT x.basket,
         x.due_date,
         count(*)::integer,
         (count(*) FILTER (WHERE x.status = p_pending))::integer,
         coalesce(sum(x.plus_v), 0)::numeric,
         coalesce(sum(x.minus_v), 0)::numeric
  FROM public.app_due_rows(p_area_id, p_basket_slug, p_due_slug, p_status_slug,
                           p_plus_slug, p_minus_slug, p_baskets, p_tz) x
  WHERE x.due_date <= p_as_of
  GROUP BY x.basket, x.due_date
  HAVING count(*) FILTER (WHERE x.status = p_pending) > 0
  ORDER BY x.due_date, x.basket;
END;
$$;

-- 3. Retci JEDNE košare — CIJELE, ne samo `pending` (isti razlog kao 053:
--    klijent mora vidjeti i redak koji je netko već prebacio).
CREATE OR REPLACE FUNCTION public.rpc_area_due_basket_members(
  p_area_id     uuid,
  p_basket_slug text,
  p_due_slug    text,
  p_status_slug text,
  p_plus_slug   text,
  p_minus_slug  text,
  p_basket      text,
  p_due_date    date,
  p_tz          text DEFAULT 'UTC'
)
RETURNS TABLE (
  event_id    uuid,
  user_id     uuid,
  category_id uuid,
  status      text,
  plus_v      numeric,
  minus_v     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.app_due_check(p_area_id, p_basket_slug, p_due_slug, p_status_slug, p_plus_slug, p_minus_slug);

  RETURN QUERY
  SELECT x.event_id, x.user_id, x.category_id, x.status, x.plus_v, x.minus_v
  FROM public.app_due_rows(p_area_id, p_basket_slug, p_due_slug, p_status_slug,
                           p_plus_slug, p_minus_slug, ARRAY[p_basket], p_tz) x
  WHERE x.due_date = p_due_date
  ORDER BY x.event_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_due_basket_members(uuid, text, text, text, text, text, text, date, text) IS
  'Overview „Dospjelo": rows of ONE card basket (basket value + due date), all statuses. Checks area access itself (SECURITY DEFINER). Read-only.';

REVOKE ALL ON FUNCTION public.rpc_area_due_basket_members(uuid, text, text, text, text, text, text, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_area_due_basket_members(uuid, text, text, text, text, text, text, date, text)
  TO authenticated;
