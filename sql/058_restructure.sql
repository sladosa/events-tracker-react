-- ============================================================
-- 058_restructure.sql — preuređivanje strukture: primijeni / poništi (F1, S178)
-- ============================================================
-- Spec: docs/PREUREDJIVANJE_SPEC.md DIO 2 (§9 arhitektura, §10 korak, §13 baza).
--
-- ŠTO RADI
--   `rpc_restructure_apply` izvede korake „kad … postavi …" nad atributima
--   eventa jedne Aree i upiše config (validation_rules, areas.settings,
--   shortcuti, sidra) — U JEDNOJ TRANSAKCIJI — i za svaki dirnuti redak
--   zapiše prije / poslije. `rpc_restructure_undo` vrati „prije" za cijelu
--   operaciju, ili ništa.
--
-- PODJELA POSLA (§9)
--   Planer (`src/lib/restructure/plan.ts`) zna OBLIK configa i računa „poslije".
--   Baza ne zna ništa o obliku `dashboard`/`groupings`/`due`; ona radi samo ono
--   što samo ona može: pravo, zaključavanje, atomičnost i dokaz da se baza
--   nije promijenila od pregleda. Retke mijenja PO PRAVILU koraka, ne po popisu
--   ID-eva — planer šalje samo očekivane brojeve.
--
-- OBLIK ULAZA
--   p_steps  = [{ "n": 1, "category_id": uuid,
--                 "when": [{"attr": uuid, "value": "Zabava" | null}],
--                 "event_ids": [uuid] | null,
--                 "set":  [{"attr": uuid, "value": "Audible" | null}],
--                 "expected_matched": 22, "expected_changed": 31 }]
--              `value: null` u `when` = atribut nema vrijednost;
--              u `set` = obriši vrijednost.
--   p_config = [{ "kind": "attribute_rules" | "area_settings" | "preset" | "anchor",
--                 "target_id": uuid, "before": jsonb, "after": jsonb }]
--              attribute_rules: validation_rules · area_settings: settings ·
--              preset: {default_attributes, filter_state} · anchor: {group_value}
--
-- ⚠ PROVJERA „NIŠTA SE NIJE PROMIJENILO OD PREGLEDA" (§13)
--   config: trenutna vrijednost `jsonb =` `before` (redoslijed ključeva nebitan,
--   S153); korak: broj pogođenih eventa I broj stvarnih promjena atributa točno
--   kao u planu. Bilo što drugo ⇒ RAISE ⇒ cijela transakcija se poništi.
--   ⚠ Broji se U TRENUTKU IZVOĐENJA koraka, poslije prethodnih koraka — isto
--   kako planer simulira.
--
-- ⚠ `events` SE NE DIRA — ni `user_id` (autor ostaje), ni `edited_by` (inače bi
--   tisuće redaka dobile ✎ u listi; trag je u zapisu operacije). Novi atribut
--   dobiva `user_id` = AUTOR EVENTA (isto pravilo kao Edit tok, CLAUDE.md
--   § Collab — vlasnik Aree), nikad pozivatelja.
-- ⚠ Mijenja se NA MJESTU (UPDATE), nikad „obriši pa upiši" (razred S125/S134).
--
-- ⚠ PRAVO: vlasnik Aree ILI JWT `role = service_role` (obrazac `app_can_read_area`,
--   035). NIKAD `current_user` — u DEFINER funkciji to je vlasnik funkcije, pa bi
--   provjera uvijek prošla. Write-grantee NE SMIJE: struktura je vlasnikova (S133).
--
-- ⚠ ZAPIS: jedan redak po (operacija, vrsta, cilj). Dira li isti redak više
--   koraka, `before` ostaje PRVI, `after` postaje ZADNJI. Bez toga bi povrat
--   provjeravao međustanje koje više ne postoji i odbio bi ispravnu operaciju.
--
-- Run: TEST kroz psql (Claude), PROD u Supabase SQL editoru (Saša). Idempotent.
-- ============================================================

-- ── Tablice ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restructure_ops (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  -- ⚠ ON DELETE CASCADE: bez njega bi zapis operacija blokirao Delete Area
  --   (FK), a to brisanje je put kojim Koka čisti Aree kroz UI.
  area_id     uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  actor       uuid,                         -- auth.uid(); NULL za service
  actor_label text,                         -- 'service: <izvor>' kad nema uid-a
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text,                         -- ime filea / sheeta
  plan        jsonb NOT NULL,               -- koraci + očekivani brojevi (dokaz)
  status      text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone')),
  undone_at   timestamptz,
  undone_by   uuid
);

CREATE TABLE IF NOT EXISTS public.restructure_op_rows (
  op_id     uuid NOT NULL REFERENCES public.restructure_ops(id) ON DELETE CASCADE,
  seq       int  NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('event_attribute', 'attribute_rules',
                                          'area_settings', 'preset', 'anchor')),
  target_id uuid NOT NULL,
  before    jsonb,                          -- NULL = redak nije postojao
  after     jsonb,                          -- NULL = redak obrisan
  PRIMARY KEY (op_id, kind, target_id)
);

CREATE INDEX IF NOT EXISTS restructure_ops_area_idx ON public.restructure_ops (area_id, created_at);
CREATE INDEX IF NOT EXISTS restructure_op_rows_seq_idx ON public.restructure_op_rows (op_id, seq);

-- RLS: čita samo vlasnik Aree; NEMA INSERT/UPDATE/DELETE politika — pišu samo
-- funkcije (DEFINER). Zabrana se postiže ODSUTNOŠĆU politike (S134: permissive
-- politike se OR-aju, pa dodavanje nikad ništa ne zabrani).
ALTER TABLE public.restructure_ops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restructure_op_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restructure_ops_select ON public.restructure_ops;
CREATE POLICY restructure_ops_select ON public.restructure_ops FOR SELECT
USING (EXISTS (SELECT 1 FROM public.areas a
               WHERE a.id = restructure_ops.area_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS restructure_op_rows_select ON public.restructure_op_rows;
CREATE POLICY restructure_op_rows_select ON public.restructure_op_rows FOR SELECT
USING (EXISTS (SELECT 1 FROM public.restructure_ops o
               JOIN public.areas a ON a.id = o.area_id
               WHERE o.id = restructure_op_rows.op_id AND a.user_id = auth.uid()));

REVOKE ALL ON public.restructure_ops, public.restructure_op_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restructure_ops, public.restructure_op_rows TO authenticated;
GRANT ALL ON public.restructure_ops, public.restructure_op_rows TO service_role;

-- ── Pomoćne ─────────────────────────────────────────────────────────────────

-- Smije li pozivatelj preuređivati Areu: service_role ili vlasnik.
CREATE OR REPLACE FUNCTION public.app_can_restructure_area(p_area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- nullif('') prije casta: postavka zna biti prazan string, a ''::jsonb baca.
  SELECT
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
      = 'service_role'
  OR EXISTS (SELECT 1 FROM public.areas a WHERE a.id = p_area_id AND a.user_id = auth.uid());
$$;

-- Trenutno stanje cilja u ISTOM obliku u kojem ga planer šalje kao `before`
-- i u kojem ga zapis drži. NULL = redak ne postoji.
-- ⚠ Jedna funkcija za apply i undo: dvije kopije oblika bi se razišle, a
--   razilaženje izgleda kao „netko je dirao redak" — povrat bi se tiho odbijao.
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

-- Postavi config cilj na `p_value` (oblik kao `_restructure_current`).
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

-- ── rpc_restructure_apply ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_restructure_apply(
  p_area_id uuid,
  p_steps   jsonb,
  p_config  jsonb,
  p_source  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_op      uuid := extensions.uuid_generate_v4();
  v_seq     int  := 0;
  v_step    jsonb;
  v_cond    jsonb;
  v_cfg     jsonb;
  v_n       int;
  v_cat     uuid;
  v_attr    uuid;
  v_val     text;
  v_ids     uuid[];
  v_matched int;
  v_changed int;
  v_k       int;
  v_cur     jsonb;
  v_ok      boolean;
BEGIN
  IF NOT public.app_can_restructure_area(p_area_id) THEN
    RAISE EXCEPTION 'Preuređivanje smije samo vlasnik Aree (ili service ključ).'
      USING ERRCODE = '42501';
  END IF;

  -- Dvije operacije nad istom Areom ne mogu se preplesti.
  PERFORM 1 FROM public.areas WHERE id = p_area_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Area % ne postoji.', p_area_id;
  END IF;

  p_steps  := coalesce(p_steps, '[]'::jsonb);
  p_config := coalesce(p_config, '[]'::jsonb);
  IF jsonb_typeof(p_steps) <> 'array' OR jsonb_typeof(p_config) <> 'array' THEN
    RAISE EXCEPTION 'p_steps i p_config moraju biti nizovi.';
  END IF;
  IF jsonb_array_length(p_steps) = 0 AND jsonb_array_length(p_config) = 0 THEN
    RAISE EXCEPTION 'Prazan plan — nema što primijeniti.';
  END IF;

  INSERT INTO public.restructure_ops (id, area_id, actor, actor_label, source, plan)
  VALUES (v_op, p_area_id, v_uid,
          CASE WHEN v_uid IS NULL THEN 'service: ' || coalesce(p_source, '?') END,
          p_source,
          jsonb_build_object(
            'steps', p_steps,
            -- before/after configa su u restructure_op_rows; ovdje samo što je dirano
            'config', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                         'kind', c -> 'kind', 'target_id', c -> 'target_id')), '[]'::jsonb)
                       FROM jsonb_array_elements(p_config) c)));

  -- ── 1. Config: provjera „prije" (prije ijednog upisa — pad je jeftiniji) ──
  FOR v_cfg IN SELECT * FROM jsonb_array_elements(p_config) LOOP
    v_attr := (v_cfg ->> 'target_id')::uuid;
    -- cilj mora pripadati OVOJ Arei — DEFINER inače piše bilo gdje
    v_ok := CASE v_cfg ->> 'kind'
      WHEN 'area_settings'   THEN v_attr = p_area_id
      WHEN 'attribute_rules' THEN EXISTS (
        SELECT 1 FROM public.attribute_definitions d
        JOIN public.categories c ON c.id = d.category_id
        WHERE d.id = v_attr AND c.area_id = p_area_id)
      WHEN 'preset'          THEN EXISTS (
        SELECT 1 FROM public.activity_presets p
        LEFT JOIN public.categories c ON c.id = p.category_id
        WHERE p.id = v_attr AND (p.area_id = p_area_id OR c.area_id = p_area_id))
      WHEN 'anchor'          THEN EXISTS (
        SELECT 1 FROM public.balance_anchors b WHERE b.id = v_attr AND b.area_id = p_area_id)
      ELSE false END;
    IF NOT coalesce(v_ok, false) THEN
      RAISE EXCEPTION 'config %/%: cilj ne postoji ili nije u ovoj Arei.',
        v_cfg ->> 'kind', v_attr;
    END IF;
    v_cur := public._restructure_current(v_cfg ->> 'kind', v_attr);
    IF v_cur IS DISTINCT FROM (v_cfg -> 'before') THEN
      RAISE EXCEPTION 'config %/%: promijenjen od pregleda — napravi pregled ponovo.',
        v_cfg ->> 'kind', v_attr;
    END IF;
  END LOOP;

  -- ── 2. Koraci, redom ──────────────────────────────────────────────────────
  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
    v_n   := coalesce((v_step ->> 'n')::int, 0);
    v_cat := (v_step ->> 'category_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = v_cat AND c.area_id = p_area_id) THEN
      RAISE EXCEPTION 'korak %: kategorija nije u ovoj Arei.', v_n;
    END IF;
    IF coalesce(jsonb_array_length(v_step -> 'when'), 0) = 0
       AND jsonb_typeof(v_step -> 'event_ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'korak %: nema nijednog uvjeta (kad / event_id).', v_n;
    END IF;
    IF coalesce(jsonb_array_length(v_step -> 'set'), 0) = 0 THEN
      RAISE EXCEPTION 'korak %: nema što postaviti.', v_n;
    END IF;
    -- F1: samo tekstualni atributi, i samo atributi TOG leafa (P1 roditelji su F3)
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_step -> 'when', '[]') || (v_step -> 'set')) c
      WHERE NOT EXISTS (SELECT 1 FROM public.attribute_definitions d
                        WHERE d.id = (c ->> 'attr')::uuid
                          AND d.category_id = v_cat AND d.data_type = 'text'))
    THEN
      RAISE EXCEPTION 'korak %: atribut nije tekstualni atribut te kategorije.', v_n;
    END IF;
    IF (SELECT count(*) <> count(DISTINCT c ->> 'attr')
        FROM jsonb_array_elements(v_step -> 'set') c) THEN
      RAISE EXCEPTION 'korak %: isti atribut dvaput u „postavi".', v_n;
    END IF;

    -- Izbor eventa: kategorija (+ popis), pa uvjet po uvjet.
    SELECT array_agg(e.id) INTO v_ids
    FROM public.events e
    WHERE e.category_id = v_cat
      AND (jsonb_typeof(v_step -> 'event_ids') IS DISTINCT FROM 'array'
           OR e.id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(v_step -> 'event_ids') x));
    v_ids := coalesce(v_ids, '{}');

    FOR v_cond IN SELECT * FROM jsonb_array_elements(coalesce(v_step -> 'when', '[]')) LOOP
      v_attr := (v_cond ->> 'attr')::uuid;
      v_val  := v_cond ->> 'value';
      IF v_val IS NULL THEN
        SELECT coalesce(array_agg(i), '{}') INTO v_ids FROM unnest(v_ids) i
        WHERE NOT EXISTS (SELECT 1 FROM public.event_attributes ea
                          WHERE ea.event_id = i AND ea.attribute_definition_id = v_attr
                            AND ea.value_text IS NOT NULL);
      ELSE
        SELECT coalesce(array_agg(i), '{}') INTO v_ids FROM unnest(v_ids) i
        WHERE EXISTS (SELECT 1 FROM public.event_attributes ea
                      WHERE ea.event_id = i AND ea.attribute_definition_id = v_attr
                        AND ea.value_text = v_val);
      END IF;
    END LOOP;

    v_matched := cardinality(v_ids);
    IF v_matched <> (v_step ->> 'expected_matched')::int THEN
      RAISE EXCEPTION 'korak %: očekivano % eventa, nađeno % — baza se promijenila od pregleda, napravi pregled ponovo.',
        v_n, v_step ->> 'expected_matched', v_matched;
    END IF;

    -- ⚠ Dvostruki redak (event, atribut) bi dao dvosmislen „prije" i dvostruko
    --   brojanje. Izmjereno 18.10.: 0 na PROD-u — zato brana, ne grana.
    IF EXISTS (
      SELECT 1 FROM public.event_attributes ea
      WHERE ea.event_id = ANY (v_ids)
        AND ea.attribute_definition_id IN (SELECT (c ->> 'attr')::uuid
                                           FROM jsonb_array_elements(v_step -> 'set') c)
      GROUP BY ea.event_id, ea.attribute_definition_id HAVING count(*) > 1)
    THEN
      RAISE EXCEPTION 'korak %: event ima isti atribut dvaput — popravi prije preuređivanja.', v_n;
    END IF;

    v_changed := 0;
    FOR v_cond IN SELECT * FROM jsonb_array_elements(v_step -> 'set') LOOP
      v_attr := (v_cond ->> 'attr')::uuid;
      v_val  := v_cond ->> 'value';

      IF v_val IS NULL THEN
        -- obriši vrijednost
        WITH del AS (
          DELETE FROM public.event_attributes ea
          WHERE ea.event_id = ANY (v_ids) AND ea.attribute_definition_id = v_attr
          RETURNING ea.*
        )
        INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
        SELECT v_op, v_seq + row_number() OVER (), 'event_attribute', d.id, to_jsonb(d), NULL
        FROM del d
        ON CONFLICT (op_id, kind, target_id) DO UPDATE SET after = NULL;
        GET DIAGNOSTICS v_k = ROW_COUNT;
      ELSE
        -- izmijeni postojeće: zapis PRIJE upisa (Postgres < 18 nema OLD u RETURNING)
        INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
        SELECT v_op, v_seq + row_number() OVER (ORDER BY ea.id), 'event_attribute', ea.id,
               to_jsonb(ea), to_jsonb(ea) || jsonb_build_object('value_text', v_val)
        FROM public.event_attributes ea
        WHERE ea.event_id = ANY (v_ids) AND ea.attribute_definition_id = v_attr
          AND ea.value_text IS DISTINCT FROM v_val
        ON CONFLICT (op_id, kind, target_id) DO UPDATE SET after = EXCLUDED.after;
        GET DIAGNOSTICS v_k = ROW_COUNT;

        UPDATE public.event_attributes ea SET value_text = v_val
        WHERE ea.event_id = ANY (v_ids) AND ea.attribute_definition_id = v_attr
          AND ea.value_text IS DISTINCT FROM v_val;
        v_seq := v_seq + v_k;
        v_changed := v_changed + v_k;

        -- dodaj gdje ga nema; autor = autor eventa
        WITH ins AS (
          INSERT INTO public.event_attributes (event_id, attribute_definition_id, value_text, user_id)
          SELECT e.id, v_attr, v_val, e.user_id
          FROM public.events e
          WHERE e.id = ANY (v_ids)
            AND NOT EXISTS (SELECT 1 FROM public.event_attributes x
                            WHERE x.event_id = e.id AND x.attribute_definition_id = v_attr)
          RETURNING *
        )
        INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
        SELECT v_op, v_seq + row_number() OVER (), 'event_attribute', i.id, NULL, to_jsonb(i)
        FROM ins i;
        GET DIAGNOSTICS v_k = ROW_COUNT;
      END IF;
      v_seq := v_seq + v_k;
      v_changed := v_changed + v_k;
    END LOOP;

    IF v_changed <> (v_step ->> 'expected_changed')::int THEN
      RAISE EXCEPTION 'korak %: očekivano % promjena, izvedeno % — baza se promijenila od pregleda, napravi pregled ponovo.',
        v_n, v_step ->> 'expected_changed', v_changed;
    END IF;
  END LOOP;

  -- ── 3. Config: upis „poslije" ─────────────────────────────────────────────
  FOR v_cfg IN SELECT * FROM jsonb_array_elements(p_config) LOOP
    v_attr := (v_cfg ->> 'target_id')::uuid;
    PERFORM public._restructure_write_config(v_cfg ->> 'kind', v_attr, v_cfg -> 'after');
    v_seq := v_seq + 1;
    INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
    VALUES (v_op, v_seq, v_cfg ->> 'kind', v_attr, v_cfg -> 'before',
            public._restructure_current(v_cfg ->> 'kind', v_attr))
    ON CONFLICT (op_id, kind, target_id) DO UPDATE SET after = EXCLUDED.after;
  END LOOP;

  RETURN v_op;
END;
$$;

-- ── rpc_restructure_undo ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_restructure_undo(p_op_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op     public.restructure_ops%ROWTYPE;
  v_row    public.restructure_op_rows%ROWTYPE;
  v_bad    text;
  v_nbad   int;
  v_n      int := 0;
  v_status text;
BEGIN
  SELECT * INTO v_op FROM public.restructure_ops WHERE id = p_op_id;
  -- ⚠ Pravo PRIJE poruke „ne postoji": inače stranac pogađanjem ID-eva saznaje
  --   koje operacije postoje.
  IF NOT FOUND OR NOT public.app_can_restructure_area(v_op.area_id) THEN
    RAISE EXCEPTION 'Poništiti smije samo vlasnik Aree (ili service ključ).'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.areas WHERE id = v_op.area_id FOR UPDATE;
  -- i sam zapis: dva povrata iste operacije ne smiju ići usporedno
  PERFORM 1 FROM public.restructure_ops WHERE id = p_op_id FOR UPDATE;
  SELECT status INTO v_status FROM public.restructure_ops WHERE id = p_op_id;
  IF v_status <> 'applied' THEN
    RAISE EXCEPTION 'Operacija je već poništena.';
  END IF;

  -- ⚠ SVE ILI NIŠTA: prvo provjeri sve, pa tek onda vraćaj. Djelomičan povrat
  --   ostavio bi mješavinu starog i novog — gore od ijednog od njih (§13).
  SELECT count(*),
         string_agg(r.kind || ' ' || r.target_id, ', ' ORDER BY r.seq)
           FILTER (WHERE r.rn <= 20)
    INTO v_nbad, v_bad
  FROM (SELECT x.*, row_number() OVER (ORDER BY x.seq) rn
        FROM public.restructure_op_rows x
        WHERE x.op_id = p_op_id
          AND public._restructure_current(x.kind, x.target_id) IS DISTINCT FROM x.after) r;
  IF v_nbad > 0 THEN
    RAISE EXCEPTION 'Povrat odbijen: % zapisa je mijenjano poslije operacije (prvih 20: %). Ništa nije vraćeno.',
      v_nbad, v_bad;
  END IF;

  FOR v_row IN SELECT * FROM public.restructure_op_rows
               WHERE op_id = p_op_id ORDER BY seq DESC LOOP
    IF v_row.kind = 'event_attribute' THEN
      IF v_row.before IS NULL THEN
        DELETE FROM public.event_attributes WHERE id = v_row.target_id;
      ELSIF v_row.after IS NULL THEN
        INSERT INTO public.event_attributes
        SELECT * FROM jsonb_populate_record(NULL::public.event_attributes, v_row.before);
      ELSE
        UPDATE public.event_attributes t
           SET value_text = r.value_text, value_number = r.value_number,
               value_datetime = r.value_datetime, value_boolean = r.value_boolean,
               value_json = r.value_json, user_id = r.user_id
          FROM jsonb_populate_record(NULL::public.event_attributes, v_row.before) r
         WHERE t.id = v_row.target_id;
      END IF;
    ELSE
      PERFORM public._restructure_write_config(v_row.kind, v_row.target_id, v_row.before);
    END IF;
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.restructure_ops
     SET status = 'undone', undone_at = now(), undone_by = auth.uid()
   WHERE id = p_op_id;

  RETURN v_n;
END;
$$;

-- ── Prava na funkcije ───────────────────────────────────────────────────────
-- ⚠ i `anon`: Supabase novoj funkciji sam dodijeli EXECUTE anonimnoj ulozi (057).
REVOKE ALL ON FUNCTION public.rpc_restructure_apply(uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_restructure_undo(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_can_restructure_area(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._restructure_current(text, uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._restructure_write_config(text, uuid, jsonb)   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_restructure_apply(uuid, jsonb, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_restructure_undo(uuid)                      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_restructure_area(uuid)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._restructure_current(text, uuid)               TO service_role;
GRANT EXECUTE ON FUNCTION public._restructure_write_config(text, uuid, jsonb)   TO service_role;

NOTIFY pgrst, 'reload schema';
