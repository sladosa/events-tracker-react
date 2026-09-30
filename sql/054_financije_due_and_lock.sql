-- ============================================================
-- 054_financije_due_and_lock.sql — config za C5 (traka „Dospjelo") i C3b (žig)
-- ============================================================
-- Sašina odluka S155: config ide JEDNOKRATNO SQL-om, `Dashboard` sheet (F5)
-- dolazi poslije. Isti put kojim su išli 037, 041 i 044.
--
-- ŠTO UPISUJE u Areu `Financije_all` (traži se po IMENU, pa ista datoteka
-- radi na TEST-u i na PROD-u — id-evi se razlikuju):
--
--   1. `settings.dashboard.widgets[0].due` — koje kartice čine košare i s
--      kojeg računa ih banka naplaćuje (DOSPJELO_SPEC §6).
--      ⚠ SAMO MASTERCARD (odluka D4): Visa se od 2026-02 ne slaže s bankom,
--        a traka koja svaki mjesec prijavljuje neobjašnjivu razliku nauči
--        se ne čitati. Visa ulazi dodavanjem JEDNOG ključa, bez deploya.
--   2. `lock_slug = izvod_opis` na pravilu „Datum naplate po Izvoru" — Edit
--      više ne pomiče bankin datum naplate na retku potvrđenom izvodom.
--
-- ⚠ Structure uvoz ovo NE BRIŠE: postavke Aree piše kao `{ ...postojeće }`,
--   a `LockAttr` bez kolone u fileu zadržava žig iz baze (`resolveLockSlug`).
--   Ali `due` blok do F5 NE PUTUJE Excelom — novi Structure export ga nema.
--
-- ⚠ Bezopasno i prije deploya: stari kod ne zna za `due` ni `lock_slug`
--   i jednostavno ih ne čita.
--
-- Idempotentno: drugi prolaz upiše iste vrijednosti.
-- ============================================================

DO $$
DECLARE
  v_area_id uuid;
  v_n       int;
  v_rules   jsonb;
  v_hit     int;
BEGIN
  SELECT count(*), min(id::text)::uuid INTO v_n, v_area_id
  FROM areas WHERE name = 'Financije_all';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Očekivana TOČNO jedna Area "Financije_all", nađeno %.', v_n;
  END IF;

  -- slugovi na koje config pokazuje moraju postojati (inače RPC pada, a
  -- Edit šuti — bolje pasti ovdje, s imenom)
  PERFORM 1 FROM (VALUES ('izvorplacanja'), ('datum_naplate'), ('status'),
                         ('uplata'), ('isplata'), ('izvod_opis'), ('racun')) s(slug)
  WHERE NOT EXISTS (
    SELECT 1 FROM attribute_definitions ad JOIN categories c ON c.id = ad.category_id
    WHERE c.area_id = v_area_id AND ad.slug = s.slug);
  IF FOUND THEN
    RAISE EXCEPTION 'Area % nema sve potrebne slugove (izvorplacanja, datum_naplate, status, uplata, isplata, izvod_opis, racun).', v_area_id;
  END IF;

  IF (SELECT settings #>> '{dashboard,widgets,0,type}' FROM areas WHERE id = v_area_id)
     IS DISTINCT FROM 'balance_by_group' THEN
    RAISE EXCEPTION 'Area % nema pločicu balance_by_group na widgets[0] — pusti 041 prije ovoga.', v_area_id;
  END IF;

  -- 1. due blok
  UPDATE areas
  SET settings = jsonb_set(settings, '{dashboard,widgets,0,due}', jsonb_build_object(
        'basket_by',   'izvorplacanja',
        'due_slug',    'datum_naplate',
        'status_slug', 'status',
        'pending',     'Planiran',
        'done',        'Izvrsen',
        'baskets', jsonb_build_object(
          'Mastercard', jsonb_build_object(
            'account', 'Kokin tekući ZABA',
            'text',    'TROŠKOVI UČINJENI MASTERCARD KARTICOM')),
        'settle', jsonb_build_object(
          'izvorplacanja', 'Racun', 'tip', 'Transfer', 'podtip', 'izmedju racuna')
      ), true)
  WHERE id = v_area_id;

  -- 2. žig na pravilu datuma naplate
  SELECT settings #> '{automations,attribute_rules}' INTO v_rules FROM areas WHERE id = v_area_id;
  SELECT count(*) INTO v_hit FROM jsonb_array_elements(coalesce(v_rules, '[]'::jsonb)) r
  WHERE r->>'action' = 'set_attribute'
    AND r->>'target_slug' = 'datum_naplate' AND r->>'map_slug' = 'izvorplacanja';
  IF v_hit <> 1 THEN
    RAISE EXCEPTION 'Očekivano TOČNO jedno pravilo datum_naplate ← izvorplacanja, nađeno %.', v_hit;
  END IF;

  UPDATE areas
  SET settings = jsonb_set(settings, '{automations,attribute_rules}', (
        SELECT jsonb_agg(
                 CASE WHEN r->>'action' = 'set_attribute'
                       AND r->>'target_slug' = 'datum_naplate'
                       AND r->>'map_slug' = 'izvorplacanja'
                      THEN r || '{"lock_slug": "izvod_opis"}'::jsonb
                      ELSE r END
                 ORDER BY ord)
        FROM jsonb_array_elements(v_rules) WITH ORDINALITY AS t(r, ord)))
  WHERE id = v_area_id;

  RAISE NOTICE 'Financije_all (%): due + lock_slug upisani.', v_area_id;
END $$;

-- Provjera (čita se, ne preskače):
SELECT jsonb_pretty(settings #> '{dashboard,widgets,0,due}')          AS due,
       jsonb_pretty(settings #> '{automations,attribute_rules}')      AS rules
FROM areas WHERE name = 'Financije_all';
