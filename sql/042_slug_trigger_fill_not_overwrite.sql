-- ============================================================
-- 042_slug_trigger_fill_not_overwrite.sql — slug se POPUNJAVA, ne prepisuje (S118)
-- ============================================================
-- ŠTO SE POPRAVLJA
--   `generate_slug_from_name()` nosi komentar
--       -- Generate slug ONLY on INSERT or if slug is empty
--   i uvjet
--       IF TG_OP = 'INSERT' OR NEW.slug IS NULL OR NEW.slug = '' THEN
--   Komentar opisuje namjeru, uvjet radi nešto drugo: na INSERT-u gazi SVAKI
--   proslijeđeni slug i slaže novi iz imena. Nije rubni slučaj — to je svaki
--   redak koji app ili Excel ikad umetne.
--
-- KAKO SE OČITOVALO (izmjereno 2026-08-25, S118)
--   Structure import Financije_all na PROD: Excel nosi `izvorplacanja`,
--   `datum_naplate`, `brojrata`, `rata_br`, `izvod_opis`; baza je spremila
--   `izvor`, `datum-naplate`, `broj-rata`, `rata-br`, `izvod-opis`.
--   Imena su ostala točna, pa je struktura izgledala uredno uvezena — a
--   `automations.attribute_rules` i `Status.depends_on` su pokazivali na
--   slugove kojih više nema. Dakle `set_attribute` i Status dropdown su bili
--   MRTVI, a u bazi izgledali konfigurirano. Popravljeno u 040 (UPDATE prolazi
--   jer trigger na UPDATE-u ne dira slug).
--
-- ⚠ ZAŠTO JE OVO VAŽNIJE OD JEDNOG UVOZA
--   TEST ovaj trigger NEMA. Dvije baze su zato slug računale različito, pa se
--   svaki slug-based config (`dashboard`, `list_columns`, `automations`,
--   `depends_on`) razilazi u trenutku uvoza na PROD — tiho, jer imena prežive.
--
-- IZMJENA: iz uvjeta se miče `TG_OP = 'INSERT'`. Ostaje „popuni ako ga nema".
--   Tijelo je inače nepromijenjeno; `updated_at` se i dalje uvijek osvježava.
--   Slugify ponašanje provjereno pokusima prije pisanja ovog filea:
--     'ZZ  Test--Slug!!'      → 'zz-test-slug'
--     '  Rubni   Slucaj  '    → 'rubni-slucaj'
--     'Cage & Ostalo / Drugo' → 'cage-ostalo-drugo'
--   (globalna zamjena + trim crtica — otud 'g' i trim ispod).
--
-- ⚠ FUNKCIJA JE ZAJEDNIČKA za tri trigera: `set_area_slug` (areas),
--   `set_category_slug` (categories), `set_attribute_slug` (attribute_definitions).
--   Ovo ih mijenja sva tri, namjerno — isti kvar vrijedi za sve.
--   Areama se dosad nije očitovao samo zato što app i trigger slučajno
--   proizvode isti oblik (`Financije_all` → `financije-all`).
--
-- Idempotentno. Ne dira nijedan postojeći redak — mijenja samo buduće INSERT-e.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_slug_from_name()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Popuni slug samo ako ga pozivatelj nije dao. Proslijeđen slug je podatak,
  -- ne prijedlog: o njemu ovise reference u `validation_rules.depends_on`,
  -- `areas.settings.dashboard`, `list_columns` i `automations`.
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := trim(both '-' from NEW.slug);
  END IF;

  -- Always update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$function$;

-- Provjera da je uvjet stvarno promijenjen (mora vratiti redak s novim IF-om):
SELECT l.line
FROM   pg_proc p,
       LATERAL unnest(string_to_array(pg_get_functiondef(p.oid), E'\n'))
              WITH ORDINALITY AS l(line, ord)
WHERE  p.proname = 'generate_slug_from_name'
  AND  l.line LIKE '%IF NEW.slug%';
