-- ============================================================
-- 056_area_breakdown.sql — „Kamo ide novac": razrez po više dimenzija (S165)
-- ============================================================
-- Spec: docs/RAZREZ_SPEC.md §11 (RPC), §10 (config), §12.1 (model u pregledniku).
--
-- Requires 035 (app_can_read_area, app_slug_count, app_assert_slugs). Idempotent.
--
-- ŠTO RADI
--   Jedan poziv vraća zbroj plus/minus PO KOMBINACIJI 1..4 dimenzija
--   (Financije: tip, podtip, izvorplacanja ⇒ ~120 redaka). Sve ostalo — strana
--   prihod/trošak, „izvan razreza", korekcija gotovine, bucketi — računa
--   `src/lib/breakdownModel.ts` nad tim retcima. Zato nema drugog poziva.
--
-- ZAŠTO NE `area_agg_rows` (035)
--   Ona zna JEDNU dimenziju i nema datumsku os: datum je uvijek `event_date`.
--   Razrez „po naplati" broji po atributu `Datum naplate`, pa treba vlastiti
--   izvor redaka. Tri pravila iz 035 vrijede doslovno:
--     1. SECURITY DEFINER ⇒ funkcija SAMA provjerava pristup (app_can_read_area).
--     2. P2 roditelji se NIKAD ne zbrajaju: samo leaf kategorija I chain_key NULL.
--     3. Atributi se traže po attribute_definition_id, nikad ILIKE (BUG-S103).
--
-- ⚠ GRANICE SU UKLJUČIVE, I TO PIŠE U IMENU (`p_date_from`, `p_date_to`).
--   `rpc_area_group_agg.p_from` je ISKLJUČIV (pravilo sidra, S144 zamka: provjera
--   s „dan nakon" ispusti cijeli dan). Razrez nema sidro; razdoblje dolazi iz
--   filtra, a filtar je uključiv s obje strane. Novi RPC zato NE nasljeđuje 035.
--
-- ⚠ DATUM ATRIBUTA: `(value_datetime AT TIME ZONE 'UTC')::date`, nikad goli `::date`.
--   `datetime` atribut je ZIDNI SAT spremljen kao `12:00+00:00` (S162). Goli cast
--   ovisi o `TimeZone` sesije i u zoni ≠ UTC pomakne ponoćne vrijednosti na dan
--   prije — a isti upis bi u SQL editoru i iz PostgREST-a dao različit dan.
--
-- ⚠ REDAK BEZ DATUMA U OSI ATRIBUTA SE NE GUBI TIHO.
--   Ne ulazi u sume (nema mu mjesta u razdoblju), ali se broji u `n_no_date`
--   svoje grupe ⇒ pločica ispiše „N redaka bez datuma naplate". Grupa koju čine
--   SAMO takvi retci vraća se s nulama — inače bi broj nestao zajedno s grupom.
--   Koji takav redak „pripada" razdoblju? Nema pravog odgovora (datuma nema), pa
--   je zamjena `event_date` u razdoblju: pločica za rujan javlja rujanske retke
--   bez naplate, ne sve iz 2019. Izmjereno 07.10.2026.: takvih redaka je 0.
--
-- ⚠ VRIJEDNOST DIMENZIJE: isti `coalesce` kao 035 (text → number → datum →
--   bool). Redak BEZ vrijednosti dobiva NULL na tom mjestu niza, ne izostaje:
--   prazan Tip mora stići do modela kao „nerazvrstano" (R10), ne nestati.
--
-- Run: TEST kroz psql (Claude), PROD u Supabase SQL editoru (Saša).
-- Bezopasno prije deploya: novu funkciju nitko ne zove dok je kod ne pozove.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_area_breakdown(
  p_area_id     uuid,
  p_group_slugs text[],
  p_plus_slug   text,
  p_minus_slug  text,
  p_filters     jsonb DEFAULT '[]'::jsonb,
  p_date_slug   text  DEFAULT NULL,   -- NULL = event_date; inače datetime atribut
  p_date_from   date  DEFAULT NULL,   -- UKLJUČIVO
  p_date_to     date  DEFAULT NULL    -- UKLJUČIVO
)
RETURNS TABLE (
  g         text[],
  plus_sum  numeric,
  minus_sum numeric,
  n         integer,
  n_no_date integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug text;
BEGIN
  -- pravilo 1 — funkcija zaobilazi RLS, pa se mora čuvati sama
  IF NOT public.app_can_read_area(p_area_id) THEN
    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';
  END IF;

  IF p_group_slugs IS NULL OR cardinality(p_group_slugs) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'p_group_slugs must have 1..4 elements, got %',
      coalesce(cardinality(p_group_slugs), 0)
      USING ERRCODE = '22023';
  END IF;

  -- plus/minus kao broj, filtri: ista provjera kao 035 (nepoznat slug = greška
  -- configa, nikad tiha nula)
  PERFORM public.app_assert_slugs(p_area_id, NULL, p_plus_slug, p_minus_slug, p_filters);

  FOREACH v_slug IN ARRAY p_group_slugs LOOP
    IF v_slug IS NULL OR public.app_slug_count(p_area_id, v_slug) = 0 THEN
      RAISE EXCEPTION 'Group attribute slug "%" not found in area %', v_slug, p_area_id
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Os datuma mora biti DATETIME: tekstualni atribut bi dao NULL na svakom retku,
  -- dakle pločicu bez ijedne brojke i n_no_date = sve — a to izgleda kao podatak.
  IF p_date_slug IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.attribute_definitions ad
       JOIN public.categories c ON c.id = ad.category_id
       WHERE c.area_id = p_area_id AND ad.slug = p_date_slug AND ad.data_type = 'datetime') THEN
    RAISE EXCEPTION 'Date attribute slug "%" not found in area % as a datetime', p_date_slug, p_area_id
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
  -- dimenzija → id-evi definicija; `i` čuva redoslijed iz p_group_slugs
  gdefs AS (
    SELECT o.i, ARRAY(SELECT d.id FROM defs d WHERE d.slug = o.s) AS ids
    FROM unnest(p_group_slugs) WITH ORDINALITY AS o(s, i)
  ),
  plus_defs  AS (SELECT coalesce(array_agg(id), '{}') AS ids FROM defs WHERE slug = p_plus_slug  AND data_type = 'number'),
  minus_defs AS (SELECT coalesce(array_agg(id), '{}') AS ids FROM defs WHERE slug = p_minus_slug AND data_type = 'number'),
  date_defs  AS (SELECT coalesce(array_agg(id), '{}') AS ids FROM defs WHERE slug = p_date_slug  AND data_type = 'datetime'),
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
      -- pravilo 2, čuvar A: samo leaf
      AND NOT EXISTS (SELECT 1 FROM public.categories ch WHERE ch.parent_category_id = c.id)
      -- pravilo 2, čuvar B: chain_key nose samo P2 roditelji
      AND e.chain_key IS NULL
      -- event_date os: razdoblje se reže odmah (jeftino). Za os atributa se
      -- isti uvjet koristi samo za retke BEZ datuma (v. zaglavlje).
      AND (p_date_slug IS NOT NULL OR (
            (p_date_from IS NULL OR e.event_date >= p_date_from)
        AND (p_date_to   IS NULL OR e.event_date <= p_date_to)))
      AND coalesce((
        SELECT bool_and(CASE WHEN fd.op = 'not_in' THEN NOT hit.v ELSE hit.v END)
        FROM fdef fd
        CROSS JOIN LATERAL (
          SELECT EXISTS (
            SELECT 1 FROM public.event_attributes ea
            WHERE ea.event_id = e.id
              AND ea.attribute_definition_id = ANY (fd.def_ids)   -- pravilo 3
              AND ea.value_text = ANY (fd.vals)
          )
        ) AS hit(v)
      ), true)
  ),
  -- Prvo datum i rez po razdoblju, tek onda dimenzije i iznosi — i datum
  -- JOIN-om nad svim vrijednostima tog atributa, ne podupitom po retku.
  -- Izmjereno na TEST-u 07.10.2026. (3 dimenzije, 12 mj, na serveru): os
  -- „po naplati" ~500 ms (sve pa rez) → ~280 ms (rez pa sve, podupit) →
  -- ~85 ms (join); os event_date ~75 ms. Os atributa nema jeftin pred-rez
  -- jer rata zna dospjeti godinu nakon kupnje.
  dvals AS (
    SELECT DISTINCT ON (ea.event_id)
           ea.event_id, (ea.value_datetime AT TIME ZONE 'UTC')::date AS d
    FROM public.event_attributes ea, date_defs dd
    WHERE ea.attribute_definition_id = ANY (dd.ids)
      AND ea.value_datetime IS NOT NULL
    ORDER BY ea.event_id, ea.id
  ),
  dated AS (
    SELECT e.id, e.event_date,
           CASE WHEN p_date_slug IS NULL THEN e.event_date ELSE dv.d END AS d
    FROM elig e
    LEFT JOIN dvals dv ON dv.event_id = e.id
  ),
  inwin AS (
    SELECT x.*
    FROM dated x
    WHERE (x.d IS NOT NULL
           AND (p_date_from IS NULL OR x.d >= p_date_from)
           AND (p_date_to   IS NULL OR x.d <= p_date_to))
       OR (x.d IS NULL
           AND (p_date_from IS NULL OR x.event_date >= p_date_from)
           AND (p_date_to   IS NULL OR x.event_date <= p_date_to))
  ),
  w AS (
    SELECT
      x.d,
      ARRAY(
        SELECT (
          SELECT coalesce(
                   ea.value_text,
                   ea.value_number::text,
                   to_char(ea.value_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                   ea.value_boolean::text)
          FROM public.event_attributes ea
          WHERE ea.event_id = x.id AND ea.attribute_definition_id = ANY (gd.ids)
          LIMIT 1)
        FROM gdefs gd ORDER BY gd.i
      ) AS gv,
      (SELECT ea.value_number FROM public.event_attributes ea, plus_defs pd
        WHERE ea.event_id = x.id AND ea.attribute_definition_id = ANY (pd.ids) LIMIT 1) AS pv,
      (SELECT ea.value_number FROM public.event_attributes ea, minus_defs md
        WHERE ea.event_id = x.id AND ea.attribute_definition_id = ANY (md.ids) LIMIT 1) AS mv
    FROM inwin x
  )
  SELECT
    w.gv,
    coalesce(sum(w.pv) FILTER (WHERE w.d IS NOT NULL), 0)::numeric,
    coalesce(sum(w.mv) FILTER (WHERE w.d IS NOT NULL), 0)::numeric,
    (count(*) FILTER (WHERE w.d IS NOT NULL))::integer,
    (count(*) FILTER (WHERE w.d IS NULL))::integer
  FROM w
  GROUP BY w.gv
  ORDER BY w.gv;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_breakdown(uuid, text[], text, text, jsonb, text, date, date) IS
  'Overview razrez: plus/minus po kombinaciji 1..4 dimenzija, os datuma event_date ili datetime atribut, granice UKLJUČIVE. Sam provjerava pristup (SECURITY DEFINER).';

REVOKE ALL ON FUNCTION public.rpc_area_breakdown(uuid, text[], text, text, jsonb, text, date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_area_breakdown(uuid, text[], text, text, jsonb, text, date, date)
  TO authenticated;


-- ============================================================
-- Smoke (read-only). ⚠ U SQL editoru je auth.uid() NULL, pa provjera pristupa
-- odbije poziv — glumi service_role u transakciji:
--
-- BEGIN READ ONLY;
-- SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- SELECT g, plus_sum, minus_sum, n, n_no_date
-- FROM rpc_area_breakdown(
--        (SELECT id FROM areas WHERE name = 'Financije_all'),
--        ARRAY['tip','podtip','izvorplacanja'], 'uplata', 'isplata',
--        '[]'::jsonb, NULL, '2025-10-01', '2026-09-30')
-- ORDER BY g;
-- ROLLBACK;
-- ============================================================
