-- ============================================================
-- 044_financije_split_due_slug.sql — sekcija delta sheeta pokazuje CIJELU
-- kosaru, ne samo `Status = Planiran` (S125)
-- ============================================================
-- ZASTO
--   Izmjereno na PROD-u 2026-09-02: kosara koja dospijeva 03.09. na racunu
--   `Sasin tekuci RF` ima 10 redaka / 205,36. Devet ih je `Planiran`, a jedan
--   (gorivo 55,00) je rucno prebacen u `Izvrsen` bez ijedne potvrde s izvoda.
--
--   Taj je redak ispadao iz OBJE strane delta sheeta:
--     · iz glavnog bloka — jer je kartcni, pa ne mice saldo;
--     · iz sekcije       — jer nije `Planiran`.
--   Kontrola kosare bi zato pokazala razliku od tocno 55,00 koju na listu
--   nista ne objasnjava. Gore od krive brojke: redak nije bio ni u fileu, pa
--   se nije dao ispraviti ni uvozom — a roundtrip je jedini put kojim Koka
--   uopce ispravlja retke.
--
-- STO OVO MIJENJA
--   `split.due_slug` imenuje datumski atribut dospijeca. Kad ga ima, u sekciju
--   ide i sve cije dospijece jos NIJE proslo, bez obzira na `Status`.
--   Kod bez ovog kljuca radi tocno kao dosad (`ExcelExportModal.tsx`), pa je
--   migracija bezopasna i prije nego novi kod ode na PROD.
--
-- ⚠ PRAG JE „DANAS", NE SIDRO — i to je izmjereno, ne odabrano.
--   Sa sidrom bi ZABA vratila 47 vec potvrdjenih redaka kosare 11.08.
--   (zatvorene u S124, u cent). Sekcija koja svaki mjesec ponovi zatvorenu
--   kosaru je sum, a sum se prestane citati.
--
-- ⚠ Zasto kljuc, a ne ime atributa u kodu: rjecnik plocica zivi u kodu,
--   semantika jedne Aree u configu (OVERVIEW_TAB_SPEC 2.15). `datum_naplate`
--   je pojam Financija, ne aplikacije.
--
-- Merge, nikad replace. Idempotentno.
-- ============================================================

DO $$
DECLARE
  v_area_id uuid := 'de8662e6-54f7-4ded-ab42-a786e7456067';   -- Financije_all (PROD)
  v_dash    jsonb;
  v_slug    text := 'datum_naplate';
BEGIN
  SELECT settings->'dashboard' INTO v_dash FROM areas WHERE id = v_area_id;
  IF v_dash IS NULL THEN
    RAISE EXCEPTION 'Area % nema settings.dashboard — pusti 041 prije ovoga.', v_area_id;
  END IF;

  -- Atribut mora postojati u toj Arei, inace sekcija tiho ostane kakva je bila
  -- (prazno zbog mrtve reference izgleda isto kao prazno zbog nedostatka podatka).
  IF NOT EXISTS (
    SELECT 1 FROM attribute_definitions ad
    JOIN categories c ON ad.category_id = c.id
    WHERE c.area_id = v_area_id AND ad.slug = v_slug
  ) THEN
    RAISE EXCEPTION 'Atribut sluga % ne postoji u arei % — provjeri 040.', v_slug, v_area_id;
  END IF;

  UPDATE areas
  SET settings = jsonb_set(
        settings,
        '{dashboard,widgets,0,split,due_slug}',
        to_jsonb(v_slug),
        true)
  WHERE id = v_area_id;

  RAISE NOTICE 'split.due_slug = % upisan za areu %', v_slug, v_area_id;
END $$;

-- Provjera: mora vratiti tocno jedan redak s "datum_naplate".
SELECT settings#>>'{dashboard,widgets,0,split,due_slug}' AS due_slug
FROM areas WHERE id = 'de8662e6-54f7-4ded-ab42-a786e7456067';
