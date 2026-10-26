-- ============================================================
-- 060_restructure_retype.sql — preuređivanje F2 / A1: promijeni tip atributa (S185)
-- ============================================================
-- Spec: docs/PREUREDJIVANJE_SPEC.md DIO 3 (§24 A1, §27 baza).
--
-- ŠTO RADI
--   `rpc_restructure_retype` pretvori SVE vrijednosti jednog atributa (text → number
--   po pretvorbi, ili number → text), promijeni `attribute_definitions.data_type`
--   (+ zadanu vrijednost) i upiše config koji je planer (`restructure/retype.ts`)
--   preveo — U JEDNOJ TRANSAKCIJI, sa zapisom prije/poslije. Poništava se
--   POSTOJEĆIM `rpc_restructure_undo` (058); ovdje mu se samo uči nova vrsta zapisa
--   `attribute_definition`.
--
-- ⚠ PRETVORBA ŽIVI NA DVA MJESTA: `_restructure_convert` (ovdje) i `convertValue`
--   (`src/lib/restructure/retype.ts`). Čuva ih zajednički popis primjera
--   (`CONVERT_EXAMPLES`) — TS test i SQL proba moraju dati isto.
-- ⚠ SVAKI redak se mora dati pretvoriti, inače RAISE s prvih 20 — tekst u brojčanom
--   atributu app ne prikazuje (§24.1).
-- ⚠ Broj retka i config „prije" moraju biti kao u pregledu (načelo 058 §13).
--
-- Run: TEST kroz psql (Claude), PROD u Supabase SQL editoru (Saša). Idempotent.
-- Ovisi o 058.
-- ============================================================

-- ── Nova vrsta zapisa ───────────────────────────────────────────────────────
ALTER TABLE public.restructure_op_rows DROP CONSTRAINT IF EXISTS restructure_op_rows_kind_check;
ALTER TABLE public.restructure_op_rows ADD CONSTRAINT restructure_op_rows_kind_check
  CHECK (kind IN ('event_attribute', 'attribute_rules', 'area_settings', 'preset', 'anchor',
                  'attribute_definition'));

-- ── _restructure_current / _write_config: + attribute_definition ───────────
-- (cijela tijela iz 058 + jedna grana; oblik {data_type, default_value})
CREATE OR REPLACE FUNCTION public._restructure_current(p_kind text, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  CASE p_kind
    WHEN 'event_attribute' THEN
      SELECT to_jsonb(ea) INTO v FROM public.event_attributes ea WHERE ea.id = p_target;
    WHEN 'attribute_rules' THEN
      SELECT d.validation_rules INTO v FROM public.attribute_definitions d WHERE d.id = p_target;
    WHEN 'attribute_definition' THEN
      SELECT jsonb_build_object('data_type', d.data_type, 'default_value', d.default_value)
        INTO v FROM public.attribute_definitions d WHERE d.id = p_target;
    WHEN 'area_settings' THEN
      SELECT a.settings INTO v FROM public.areas a WHERE a.id = p_target;
    WHEN 'preset' THEN
      SELECT jsonb_build_object('default_attributes', p.default_attributes,
                                'filter_state', p.filter_state)
        INTO v FROM public.activity_presets p WHERE p.id = p_target;
    WHEN 'anchor' THEN
      SELECT jsonb_build_object('group_value', b.group_value)
        INTO v FROM public.balance_anchors b WHERE b.id = p_target;
    ELSE
      RAISE EXCEPTION 'nepoznata vrsta zapisa: %', p_kind;
  END CASE;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public._restructure_write_config(p_kind text, p_target uuid, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE n int;
BEGIN
  CASE p_kind
    WHEN 'attribute_rules' THEN
      UPDATE public.attribute_definitions SET validation_rules = p_value WHERE id = p_target;
    WHEN 'attribute_definition' THEN
      UPDATE public.attribute_definitions
         SET data_type = p_value ->> 'data_type', default_value = p_value ->> 'default_value'
       WHERE id = p_target;
    WHEN 'area_settings' THEN
      UPDATE public.areas SET settings = p_value WHERE id = p_target;
    WHEN 'preset' THEN
      UPDATE public.activity_presets
         SET default_attributes = p_value -> 'default_attributes',
             filter_state       = p_value -> 'filter_state'
       WHERE id = p_target;
    WHEN 'anchor' THEN
      UPDATE public.balance_anchors SET group_value = p_value ->> 'group_value' WHERE id = p_target;
    ELSE
      RAISE EXCEPTION 'nepoznata vrsta configa: %', p_kind;
  END CASE;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'config %/%: upis pogodio % redaka (očekivan 1)', p_kind, p_target, n;
  END IF;
END;
$$;

-- ── Pretvorba (ista pravila kao `convertValue` u retype.ts) ─────────────────
-- p_conv = {"kind":"broj"} | {"kind":"mm:ss"} | {"kind":"mapa","map":{"tekst":broj}}
-- NULL = ne da se pretvoriti.
CREATE OR REPLACE FUNCTION public._restructure_convert(p_text text, p_conv jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  t text := regexp_replace(coalesce(p_text, ''), '^\s+|\s+$', '', 'g');
  m text[];
BEGIN
  CASE p_conv ->> 'kind'
    WHEN 'broj' THEN
      -- namjerno stroži od parseAmountInput: `1.234` je dvosmislen
      IF t ~ '^-?\d+([.,]\d+)?$' THEN RETURN replace(t, ',', '.')::numeric; END IF;
      RETURN NULL;
    WHEN 'mm:ss' THEN
      m := regexp_match(t, '^(\d{1,2}):([0-5]\d)$');
      IF m IS NULL THEN RETURN NULL; END IF;
      -- stotinke minute iz cijelih sekundi (t·5/3 nema ostatak .5 ⇒ isto kao JS)
      RETURN round(((m[1]::int * 60 + m[2]::int) * 5) / 3.0) / 100;
    WHEN 'mapa' THEN
      IF jsonb_typeof(p_conv -> 'map' -> t) = 'number' THEN
        RETURN (p_conv -> 'map' ->> t)::numeric;
      END IF;
      RETURN NULL;
    ELSE
      RAISE EXCEPTION 'nepoznata pretvorba: %', p_conv;
  END CASE;
END;
$$;

-- ── rpc_restructure_retype ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_restructure_retype(
  p_area_id  uuid,
  p_attr     uuid,
  p_to_type  text,
  p_conv     jsonb,
  p_config   jsonb,
  p_expected int,
  p_source   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_op   uuid := extensions.uuid_generate_v4();
  v_from text;
  v_cfg  jsonb;
  v_t    uuid;
  v_ok   boolean;
  v_n    int;
  v_bad  int;
  v_list text;
  v_seq  int;
  v_def  boolean := false;
BEGIN
  IF NOT public.app_can_restructure_area(p_area_id) THEN
    RAISE EXCEPTION 'Preuređivanje smije samo vlasnik Aree (ili service ključ).'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.areas WHERE id = p_area_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Area % ne postoji.', p_area_id;
  END IF;

  SELECT d.data_type INTO v_from
  FROM public.attribute_definitions d JOIN public.categories c ON c.id = d.category_id
  WHERE d.id = p_attr AND c.area_id = p_area_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribut % nije u ovoj Arei.', p_attr;
  END IF;
  IF NOT ((v_from = 'text' AND p_to_type = 'number') OR (v_from = 'number' AND p_to_type = 'text')) THEN
    RAISE EXCEPTION '% → % nije u F2 (samo text ↔ number).', v_from, p_to_type;
  END IF;
  IF v_from = 'text' AND p_conv IS NULL THEN
    RAISE EXCEPTION 'text → number traži pretvorbu.';
  END IF;

  p_config := coalesce(p_config, '[]'::jsonb);

  -- ── Config: provjera „prije" (kao 058) + cilj u OVOJ Arei ──
  FOR v_cfg IN SELECT * FROM jsonb_array_elements(p_config) LOOP
    v_t := (v_cfg ->> 'target_id')::uuid;
    v_ok := CASE v_cfg ->> 'kind'
      WHEN 'attribute_definition' THEN v_t = p_attr
        AND v_cfg -> 'after' ->> 'data_type' = p_to_type
      WHEN 'attribute_rules' THEN v_t = p_attr
      WHEN 'area_settings'   THEN v_t = p_area_id
      WHEN 'preset'          THEN EXISTS (
        SELECT 1 FROM public.activity_presets p
        LEFT JOIN public.categories c ON c.id = p.category_id
        WHERE p.id = v_t AND (p.area_id = p_area_id OR c.area_id = p_area_id))
      ELSE false END;
    IF NOT coalesce(v_ok, false) THEN
      RAISE EXCEPTION 'config %/%: cilj ne postoji, nije u ovoj Arei ili nije ovaj atribut.',
        v_cfg ->> 'kind', v_t;
    END IF;
    IF public._restructure_current(v_cfg ->> 'kind', v_t) IS DISTINCT FROM (v_cfg -> 'before') THEN
      RAISE EXCEPTION 'config %/%: promijenjen od pregleda — napravi pregled ponovo.',
        v_cfg ->> 'kind', v_t;
    END IF;
    IF v_cfg ->> 'kind' = 'attribute_definition' THEN v_def := true; END IF;
  END LOOP;
  IF NOT v_def THEN
    RAISE EXCEPTION 'Plan nema promjenu tipa (attribute_definition).';
  END IF;

  -- ── Pretvorba u radnu tablicu ──
  DROP TABLE IF EXISTS pg_temp._rt;
  CREATE TEMP TABLE _rt ON COMMIT DROP AS
  SELECT ea.id, e.event_date, ea.value_text,
         CASE WHEN v_from = 'text' THEN public._restructure_convert(ea.value_text, p_conv) END AS n_num,
         CASE WHEN v_from = 'number' THEN trim_scale(ea.value_number)::text END AS n_txt,
         row_number() OVER (ORDER BY ea.id) AS seq
  FROM public.event_attributes ea
  JOIN public.events e ON e.id = ea.event_id
  WHERE ea.attribute_definition_id = p_attr
    AND ((v_from = 'text' AND ea.value_text IS NOT NULL)
      OR (v_from = 'number' AND ea.value_number IS NOT NULL));

  SELECT count(*),
         string_agg(r.event_date || ' „' || r.value_text || '"', ', ') FILTER (WHERE r.rn <= 20)
    INTO v_bad, v_list
  FROM (SELECT x.*, row_number() OVER (ORDER BY x.event_date) rn FROM _rt x
        WHERE v_from = 'text' AND x.n_num IS NULL) r;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% redaka se ne da pretvoriti (prvih 20: %) — ništa nije upisano.', v_bad, v_list;
  END IF;

  SELECT count(*) INTO v_n FROM _rt;
  IF v_n <> p_expected THEN
    RAISE EXCEPTION 'očekivano % redaka, nađeno % — baza se promijenila od pregleda, napravi pregled ponovo.',
      p_expected, v_n;
  END IF;

  -- ── Upis ──
  INSERT INTO public.restructure_ops (id, area_id, actor, actor_label, source, plan)
  VALUES (v_op, p_area_id, v_uid,
          CASE WHEN v_uid IS NULL THEN 'service: ' || coalesce(p_source, '?') END,
          p_source,
          jsonb_build_object('kind', 'retype', 'attr', p_attr, 'from', v_from, 'to', p_to_type,
                             'conv', p_conv, 'rows', v_n,
                             'config', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                                          'kind', c -> 'kind', 'target_id', c -> 'target_id')), '[]'::jsonb)
                                        FROM jsonb_array_elements(p_config) c)));

  INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
  SELECT v_op, r.seq, 'event_attribute', ea.id, to_jsonb(ea), NULL
  FROM _rt r JOIN public.event_attributes ea ON ea.id = r.id;

  UPDATE public.event_attributes ea
     SET value_number = CASE WHEN v_from = 'text' THEN r.n_num END,
         value_text   = CASE WHEN v_from = 'number' THEN r.n_txt END
    FROM _rt r
   WHERE ea.id = r.id;

  UPDATE public.restructure_op_rows o
     SET after = to_jsonb(ea)
    FROM public.event_attributes ea
   WHERE o.op_id = v_op AND o.kind = 'event_attribute' AND ea.id = o.target_id;

  v_seq := v_n;
  FOR v_cfg IN SELECT * FROM jsonb_array_elements(p_config) LOOP
    v_t := (v_cfg ->> 'target_id')::uuid;
    PERFORM public._restructure_write_config(v_cfg ->> 'kind', v_t, v_cfg -> 'after');
    v_seq := v_seq + 1;
    INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
    VALUES (v_op, v_seq, v_cfg ->> 'kind', v_t, v_cfg -> 'before',
            public._restructure_current(v_cfg ->> 'kind', v_t));
  END LOOP;

  RETURN v_op;
END;
$$;

-- ── Prava ───────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_restructure_retype(uuid, uuid, text, jsonb, jsonb, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._restructure_convert(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_restructure_retype(uuid, uuid, text, jsonb, jsonb, int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._restructure_convert(text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
