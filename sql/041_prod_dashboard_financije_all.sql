-- ============================================================
-- 041_prod_dashboard_financije_all.sql — Overview config za PROD (S118)
-- ============================================================
-- Isto sto 037 radi na TEST-u, ali:
--   · cilja PROD areu de8662e6-… (Kokina Financije_all, uvezena 2026-08-25)
--   · JSON je izvucen iz ZIVE TEST vrijednosti, ne prepisan iz 037 rukom
--     (provjereno: identicni su, pa je ovo osiguranje protiv buduceg drifta)
--
-- Puno obrazlozenje filtra je u 037 — ukratko: `izvorplacanja = Racun` SAMO,
-- nikad zbroj po `Racun`u, jer kartica i njena skupna naplata sjede na istom
-- racunu i naivni zbroj broji novac dvaput.
--
-- ⚠ Slugovi u ovom configu (`izvorplacanja`, `status`, `racun`, `uplata`,
--   `isplata`) moraju postojati u toj arei. Na PROD-u su poravnati u 040 —
--   bez toga bi plocica bila prazna, a prazno zbog mrtve reference izgleda
--   identicno kao prazno zbog nedostatka podatka.
--
-- Merge, nikad replace: settings vec nose automations, comment_template,
-- add_header i list_columns (uvezeni Structure importom).
-- Idempotentno — ponovno pokretanje upisuje istu vrijednost.
-- ============================================================

DO $$
DECLARE
  v_area_id uuid := 'de8662e6-54f7-4ded-ab42-a786e7456067';   -- Financije_all (PROD)
  v_name    text;
BEGIN
  SELECT name INTO v_name FROM areas WHERE id = v_area_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Area % nije nadjena — provjeri id.', v_area_id;
  END IF;

  UPDATE areas
  SET    settings = coalesce(settings, '{}'::jsonb)
                    || jsonb_build_object('dashboard', '{"widgets": [{"filters": [{"op": "in", "slug": "izvorplacanja", "values": ["Racun"]}, {"op": "not_in", "slug": "status", "values": ["Planiran"]}], "group_by": "racun", "minus": "isplata", "plus": "uplata", "reconcile": true, "split": {"filters": [{"op": "in", "slug": "izvorplacanja", "values": ["Racun"]}, {"op": "in", "slug": "status", "values": ["Planiran"]}], "label": "planirano"}, "title": "Stanje po računu", "type": "balance_by_group", "unit": "€"}]}'::jsonb)
  WHERE  id = v_area_id;

  RAISE NOTICE 'dashboard upisan u areu "%" (%)', v_name, v_area_id;
END $$;

-- Provjera: mora ispisati widget s group_by=racun i oba filtra.
SELECT jsonb_pretty(settings -> 'dashboard')
FROM   areas
WHERE  id = 'de8662e6-54f7-4ded-ab42-a786e7456067';
