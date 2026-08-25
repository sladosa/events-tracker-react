-- ============================================================
-- 040_prod_fix_attr_slugs.sql — poravnanje slugova u PROD Financije_all (S118)
-- ============================================================
-- ZAŠTO POSTOJI
--   Structure import u NOVU areu nije upisao slugove iz Excela, iako ih file
--   nosi (kolona `Slug`, provjereno u samom fileu). Umjesto njih je slugove
--   složio DB trigger iz imena — otud crtica (`broj-rata`), koju `makeAttrSlug`
--   u kodu ne proizvodi (on daje podvlaku).
--
-- ⚠ ZAŠTO JE TO OPASNO, A NE SAMO RUŽNO
--   Slug je referenca. Ono što je uvoz ipak upisao — `automations.attribute_rules`
--   (`map_slug: izvorplacanja`, `target_slug: datum_naplate`) i
--   `Status.depends_on.attribute_slug = izvorplacanja` — pokazuje na TEST slugove,
--   kojih na PROD-u nema. Rezultat: `set_attribute` i Status dropdown su MRTVI,
--   a u bazi izgledaju uredno konfigurirano. Isti razred kao mrtva referenca u
--   `list_columns` (CLAUDE.md): prazno zbog reference izgleda identično kao
--   prazno zbog nedostatka podatka.
--
--   Zato se slugovi poravnavaju prema TEST-u/Excelu, a ne configi prema slugovima:
--   ovako se istim potezom poprave i reference koje su već upisane.
--
-- ⚠ REDOSLIJED: ovo ide PRIJE ponovnog uvoza istog filea.
--   Obrnuto, uvoz traži atribut po slugu iz Excela, ne nađe ga i NAPRAVI NOVI —
--   pet ispravnih uz pet krivih, bez ijedne poruke.
--
-- Sigurno je jer `event_attributes` referencira `attribute_definition_id`, ne slug,
-- a area nema nijedan event (uvezena danas).
--
-- Izmjereno 2026-08-25 protiv obje baze (usporedba po IMENU atributa).
-- ============================================================

DO $$
DECLARE
  v_area_id uuid := 'de8662e6-54f7-4ded-ab42-a786e7456067';  -- Financije_all (PROD, Kokina)
  v_cat_id  uuid;
  v_n       int;
BEGIN
  SELECT id INTO v_cat_id FROM public.categories
  WHERE area_id = v_area_id AND slug = 'transakcija';
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION 'Kategorija transakcija nije nadjena u arei % — provjeri id.', v_area_id;
  END IF;

  -- ime → slug kakav je na TEST-u i u Excelu (jedini izvor istine za reference)
  UPDATE public.attribute_definitions a
  SET    slug = m.want
  FROM  (VALUES
           ('Izvor',         'izvorplacanja'),
           ('Datum naplate', 'datum_naplate'),
           ('Broj rata',     'brojrata'),
           ('Rata br',       'rata_br'),
           ('Izvod opis',    'izvod_opis')
        ) AS m(nm, want)
  WHERE  a.category_id = v_cat_id
    AND  a.name = m.nm
    AND  a.slug IS DISTINCT FROM m.want;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Poravnano slugova: %', v_n;   -- ocekivano 5 (drugi put 0)
END $$;

-- Provjera — mora vratiti 15 redaka, svih 5 dolje s ispravnim slugom,
-- i nijedan slug s crticom.
SELECT a.name, a.slug
FROM   public.attribute_definitions a
JOIN   public.categories c ON c.id = a.category_id
WHERE  c.area_id = 'de8662e6-54f7-4ded-ab42-a786e7456067'
ORDER  BY a.sort_order;
