-- ============================================================
-- 059_restructure_values.sql — preuređivanje F2 / A2: upiši izvedene vrijednosti (S185)
-- ============================================================
-- Spec: docs/PREUREDJIVANJE_SPEC.md DIO 3 (§26 A2, §27 baza).
--
-- ŠTO RADI
--   `rpc_restructure_values` upiše GOTOVE vrijednosti jednog atributa po eventu
--   (računa ih Python alat `izvedi.py` iz pravila u `pravila.py`) — U JEDNOJ
--   TRANSAKCIJI — i za svaki dirnuti redak zapiše prije / poslije u isti zapis
--   operacija kao F1 (`058`). Poništava se POSTOJEĆIM `rpc_restructure_undo`.
--
-- ZAŠTO ZASEBNA FUNKCIJA, A NE NOVA VRSTA KORAKA U `rpc_restructure_apply`
--   Spec §27 je predlagao `kind: 'values'` u `p_steps`. Izvedeno odvojeno: F1
--   funkcija ostaje netaknuta (dokazana na PROD-u, S180), a A2 ne treba ništa
--   od nje osim prava, zaključavanja i zapisa — sve troje je ovdje isto.
--   Povrat je zajednički jer zapis ima isti oblik (`event_attribute`, to_jsonb).
--
-- OBLIK ULAZA
--   p_attr = atribut koji se piše (number ili text)
--   p_rows = [{ "event": uuid, "value": 347 | "x", "expect": null | 1454 | "y",
--               "src_md5": "…" | null }]
--     value   — nova vrijednost; nikad null (A2 nikad ne briše, §26.3)
--     expect  — vrijednost cilja koju je alat VIDIO (null = prazno, način `prazno`)
--     src_md5 — md5 izvornog teksta koji je alat čitao; null = bez provjere izvora
--   p_src  = null | {"attr": uuid} | {"comment": true} — odakle je čitan izvor
--
-- ⚠ „NIŠTA SE NIJE PROMIJENILO OD PREGLEDA" (isto načelo kao 058 §13)
--   Svaki redak: trenutna vrijednost cilja = `expect` I md5 trenutnog izvora =
--   `src_md5`. Ijedno odstupanje ⇒ RAISE s brojem i prvih 20 ⇒ ništa nije upisano.
--   Za razliku od F1 (pravilo ⇒ baza sama bira retke) ovdje alat šalje popis,
--   jer regex živi u Pythonu; zato je provjera po retku, ne samo broj.
--
-- ⚠ `events` SE NE DIRA. Novi `event_attributes` redak dobiva user_id = AUTOR
--   EVENTA (kao 058 i Edit tok). Mijenja se NA MJESTU, nikad obriši-pa-upiši.
-- ⚠ PRAVO: vlasnik Aree ili service_role (`app_can_restructure_area`, 058).
--
-- Run: TEST kroz psql (Claude), PROD u Supabase SQL editoru (Saša). Idempotent.
-- Ovisi o 058 (tablice zapisa, helperi).
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_restructure_values(
  p_area_id uuid,
  p_attr    uuid,
  p_rows    jsonb,
  p_src     jsonb DEFAULT NULL,
  p_source  text  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_op    uuid := extensions.uuid_generate_v4();
  v_type  text;
  v_cat   uuid;
  v_src   uuid;
  v_n     int;
  v_bad   int;
  v_list  text;
  v_upd   int;
  v_ins   int;
BEGIN
  IF NOT public.app_can_restructure_area(p_area_id) THEN
    RAISE EXCEPTION 'Preuređivanje smije samo vlasnik Aree (ili service ključ).'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.areas WHERE id = p_area_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Area % ne postoji.', p_area_id;
  END IF;

  SELECT d.data_type, d.category_id INTO v_type, v_cat
  FROM public.attribute_definitions d
  JOIN public.categories c ON c.id = d.category_id
  WHERE d.id = p_attr AND c.area_id = p_area_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribut % nije u ovoj Arei.', p_attr;
  END IF;
  IF v_type NOT IN ('number', 'text') THEN
    RAISE EXCEPTION 'A2 piše samo number ili text atribut (ovaj je %).', v_type;
  END IF;

  IF p_src IS NOT NULL AND p_src ? 'attr' THEN
    v_src := (p_src ->> 'attr')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.attribute_definitions d
                   WHERE d.id = v_src AND d.category_id = v_cat) THEN
      RAISE EXCEPTION 'Izvorni atribut % nije na kategoriji cilja.', v_src;
    END IF;
  ELSIF p_src IS NOT NULL AND NOT (p_src ? 'comment') THEN
    RAISE EXCEPTION 'p_src mora biti null, {"attr": …} ili {"comment": true}.';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Prazan popis — nema što upisati.';
  END IF;

  -- ── Ulaz u radnu tablicu ──────────────────────────────────────────────────
  DROP TABLE IF EXISTS pg_temp._rv;
  CREATE TEMP TABLE _rv ON COMMIT DROP AS
  SELECT r.event, r.value, r.expect, r.src_md5,
         row_number() OVER () AS seq
  FROM jsonb_to_recordset(p_rows) AS r(event uuid, value jsonb, expect jsonb, src_md5 text);

  SELECT count(*) INTO v_n FROM _rv;

  IF EXISTS (SELECT 1 FROM _rv GROUP BY event HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Isti event dvaput u popisu.';
  END IF;
  IF EXISTS (SELECT 1 FROM _rv WHERE value IS NULL OR value = 'null'::jsonb
             OR jsonb_typeof(value) <> CASE v_type WHEN 'number' THEN 'number' ELSE 'string' END
             OR (expect IS NOT NULL AND expect <> 'null'::jsonb
                 AND jsonb_typeof(expect) <> CASE v_type WHEN 'number' THEN 'number' ELSE 'string' END)) THEN
    RAISE EXCEPTION 'Vrijednost mora biti % i ne smije biti prazna (A2 ne briše).', v_type;
  END IF;

  -- event postoji, u ovoj je Arei i na kategoriji atributa
  SELECT count(*), string_agg(r.event::text, ', ') FILTER (WHERE r.seq <= 20)
    INTO v_bad, v_list
  FROM _rv r
  LEFT JOIN public.events e ON e.id = r.event AND e.category_id = v_cat
  WHERE e.id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% eventa nije na kategoriji atributa (prvih 20: %).', v_bad, v_list;
  END IF;

  -- ⚠ dvostruki redak (event, atribut) ⇒ dvosmislen „prije" (isto kao 058)
  IF EXISTS (SELECT 1 FROM public.event_attributes ea JOIN _rv r ON r.event = ea.event_id
             WHERE ea.attribute_definition_id = p_attr
             GROUP BY ea.event_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Event ima isti atribut dvaput — popravi prije preuređivanja.';
  END IF;

  -- ── Provjera „ništa se nije promijenilo" ──────────────────────────────────
  -- cilj: trenutna vrijednost = expect (oboje kao jsonb; broj se uspoređuje kao broj)
  SELECT count(*), string_agg(r.event::text, ', ') FILTER (WHERE r.seq <= 20)
    INTO v_bad, v_list
  FROM _rv r
  LEFT JOIN public.event_attributes ea
    ON ea.event_id = r.event AND ea.attribute_definition_id = p_attr
  WHERE (CASE v_type WHEN 'number' THEN to_jsonb(ea.value_number)
                     ELSE to_jsonb(ea.value_text) END)
        IS DISTINCT FROM nullif(r.expect, 'null'::jsonb);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% redaka: cilj nije ono što je alat vidio (prvih 20: %) — baza se promijenila od pregleda, pokreni alat ponovo.',
      v_bad, v_list;
  END IF;

  -- nova = stara nije promjena; alat ih ne smije slati (brojevi bi lagali)
  IF EXISTS (SELECT 1 FROM _rv WHERE value = expect) THEN
    RAISE EXCEPTION 'Popis sadrži retke bez promjene (vrijednost = postojeća).';
  END IF;

  -- izvor: md5 teksta koji je alat čitao
  IF p_src IS NOT NULL THEN
    SELECT count(*), string_agg(r.event::text, ', ') FILTER (WHERE r.seq <= 20)
      INTO v_bad, v_list
    FROM _rv r
    JOIN public.events e ON e.id = r.event
    LEFT JOIN public.event_attributes s
      ON v_src IS NOT NULL AND s.event_id = r.event AND s.attribute_definition_id = v_src
    WHERE md5(coalesce(CASE WHEN v_src IS NULL THEN e.comment ELSE s.value_text END, ''))
          IS DISTINCT FROM r.src_md5;
    IF v_bad > 0 THEN
      RAISE EXCEPTION '% redaka: izvorni tekst se promijenio od pregleda (prvih 20: %) — pokreni alat ponovo.',
        v_bad, v_list;
    END IF;
  END IF;

  -- ── Upis ──────────────────────────────────────────────────────────────────
  INSERT INTO public.restructure_ops (id, area_id, actor, actor_label, source, plan)
  VALUES (v_op, p_area_id, v_uid,
          CASE WHEN v_uid IS NULL THEN 'service: ' || coalesce(p_source, '?') END,
          p_source,
          jsonb_build_object('kind', 'values', 'attr', p_attr, 'src', p_src,
                             'rows', v_n, 'type', v_type));

  -- (a) postojeći retci: zapis PRIJE upisa, „poslije" se čita iz baze nakon UPDATE-a
  INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
  SELECT v_op, r.seq, 'event_attribute', ea.id, to_jsonb(ea), NULL
  FROM _rv r
  JOIN public.event_attributes ea ON ea.event_id = r.event AND ea.attribute_definition_id = p_attr;

  UPDATE public.event_attributes ea
     SET value_number = CASE WHEN v_type = 'number' THEN (r.value #>> '{}')::numeric ELSE ea.value_number END,
         value_text   = CASE WHEN v_type = 'text'   THEN  r.value #>> '{}'            ELSE ea.value_text   END
    FROM _rv r
   WHERE ea.event_id = r.event AND ea.attribute_definition_id = p_attr;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  -- (b) nema retka ⇒ novi, autor = autor eventa
  WITH ins AS (
    INSERT INTO public.event_attributes (event_id, attribute_definition_id, value_number, value_text, user_id)
    SELECT e.id, p_attr,
           CASE WHEN v_type = 'number' THEN (r.value #>> '{}')::numeric END,
           CASE WHEN v_type = 'text'   THEN  r.value #>> '{}' END,
           e.user_id
    FROM _rv r
    JOIN public.events e ON e.id = r.event
    WHERE NOT EXISTS (SELECT 1 FROM public.event_attributes x
                      WHERE x.event_id = r.event AND x.attribute_definition_id = p_attr)
    RETURNING *
  )
  INSERT INTO public.restructure_op_rows (op_id, seq, kind, target_id, before, after)
  SELECT v_op, r.seq, 'event_attribute', i.id, NULL, to_jsonb(i)
  FROM ins i JOIN _rv r ON r.event = i.event_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  -- „poslije" za (a) iz stvarnog retka — povrat uspoređuje baš to (058 undo)
  UPDATE public.restructure_op_rows o
     SET after = to_jsonb(ea)
    FROM public.event_attributes ea
   WHERE o.op_id = v_op AND o.after IS NULL AND o.before IS NOT NULL
     AND ea.id = o.target_id;

  IF v_upd + v_ins <> v_n THEN
    RAISE EXCEPTION 'Upisano % (izmjena %, novih %), a popis ima % — ništa nije upisano.',
      v_upd + v_ins, v_upd, v_ins, v_n;
  END IF;

  RETURN v_op;
END;
$$;

-- ── Prava ───────────────────────────────────────────────────────────────────
-- ⚠ i `anon`: Supabase novoj funkciji sam dodijeli EXECUTE anonimnoj ulozi (057).
REVOKE ALL ON FUNCTION public.rpc_restructure_values(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_restructure_values(uuid, uuid, jsonb, jsonb, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
