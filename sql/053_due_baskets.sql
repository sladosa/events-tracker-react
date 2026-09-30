-- ============================================================
-- 053_due_baskets.sql — „Dospjelo → potvrdi", faza 1 (S155)
-- ============================================================
-- Spec: docs/DOSPJELO_SPEC.md §3, §7, §9 (faza 1: samo čitanje).
--
-- ŠTO VRAĆA
--   Dospjele KOŠARE: skupine redaka s istim (`basket`, `due`) — npr.
--   (`Mastercard`, 11.10.) — u kojima je barem jedan redak još `pending`
--   (`Planiran`), a dospijeće je `<= p_as_of`. Uz svaku: broj redaka, broj
--   `pending` redaka, i BRUTO plus/minus cijele košare.
--
-- ⚠ KOŠARA JE CIJELA, NE SAMO `Planiran` (isti nalaz kao 044 / S125):
--   redak koji je netko prebacio u izvršeno bez potvrde i dalje je dio iste
--   skupne naplate. Bez njega bi razlika prema banci bila točno taj iznos,
--   a na ekranu ništa ne bi objašnjavalo zašto.
--
-- ⚠ BRUTO, NE NETO — namjerno se vraćaju OBJE strane. Za MC je mjera neto
--   (minus − plus: povrat umanjuje naplatu), a za Visu bruto isplata, jer
--   Visa košara nosi zrcalo skupne naplate (`PRIMLJENA UPLATA - HVALA`) koje
--   bi neto pojelo (spec §2). Koja mjera vrijedi, odlučuje klijent.
--
-- ⚠ DATUM DOSPIJEĆA SE ČITA U ZONI KORISNIKA (`p_tz`), ne u UTC-u.
--   `datum_naplate` je timestamptz i stiže u tri oblika (lokalno podne iz
--   pravila, UTC ponoć iz uvoza, lokalna ponoć). Lokalna ponoć je u UTC-u
--   DAN PRIJE — isti razred kao S152 („This Month" rezao zadnji dan).
--   Zona dolazi iz preglednika, isti dan koji čovjek vidi (`localDate.ts`).
--
-- Pravila iz 035 vrijede i ovdje: SECURITY DEFINER sam provjerava pristup;
-- P2 parent eventi se ne broje (leaf + `chain_key IS NULL`); čita se po
-- `attribute_definition_id`, nikad `ILIKE`.
--
-- Bezopasno pustiti na bilo kojoj bazi, i prije deploya: funkcija je nova,
-- nitko je ne zove dok je kod ne pozove.
-- ============================================================

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
  -- 035 pravilo 1 — funkcija zaobilazi RLS, pa mora sama čuvati vrata
  IF NOT public.app_can_read_area(p_area_id) THEN
    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';
  END IF;

  -- Nepoznat slug NIJE „nema dospjelog" — mora pasti glasno, da poruka
  -- imenuje preimenovani atribut (isti razlog kao 035 §2).
  PERFORM public.app_assert_slugs(p_area_id, p_basket_slug, p_plus_slug, p_minus_slug, '[]'::jsonb);
  IF p_due_slug IS NULL OR public.app_slug_count(p_area_id, p_due_slug) = 0 THEN
    RAISE EXCEPTION 'Due attribute slug "%" not found in area %', p_due_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;
  IF p_status_slug IS NULL OR public.app_slug_count(p_area_id, p_status_slug) = 0 THEN
    RAISE EXCEPTION 'Status attribute slug "%" not found in area %', p_status_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
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
    SELECT e.id
    FROM public.events e
    JOIN public.categories c ON c.id = e.category_id
    WHERE c.area_id = p_area_id
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
      (SELECT ea.value_text FROM public.event_attributes ea, basket_ids b
        WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (b.ids) LIMIT 1) AS b,
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
  SELECT r.b,
         r.d,
         count(*)::integer,
         (count(*) FILTER (WHERE r.s = p_pending))::integer,
         coalesce(sum(r.pv), 0)::numeric,
         coalesce(sum(r.mv), 0)::numeric
  FROM r
  WHERE r.b = ANY (p_baskets)
    AND r.d IS NOT NULL
    AND r.d <= p_as_of
  GROUP BY r.b, r.d
  HAVING count(*) FILTER (WHERE r.s = p_pending) > 0
  ORDER BY r.d, r.b;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_due_baskets(uuid, text, text, text, text, text, text, text[], date, text) IS
  'Overview „Dospjelo": due card baskets (same basket value + due date) with at least one pending row. Checks area access itself (SECURITY DEFINER).';

REVOKE ALL ON FUNCTION public.rpc_area_due_baskets(uuid, text, text, text, text, text, text, text[], date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_area_due_baskets(uuid, text, text, text, text, text, text, text[], date, text)
  TO authenticated;
