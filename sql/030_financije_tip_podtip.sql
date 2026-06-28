-- ============================================================
-- Financije: Tip opcije update + Podtip atribut (depends_on Tip)
-- Run on PROD Supabase SQL Editor
-- Safe to run multiple times (upsert logic for Podtip)
-- ============================================================

-- Step 1: Update Tip validation_rules with new options (both areas)
UPDATE attribute_definitions
SET validation_rules = '{
  "type": "suggest",
  "suggest": [
    "Domaćinstvo",
    "Informatika",
    "Ostavine",
    "Zdravlje",
    "auto C5",
    "auto Lacetti",
    "Putovanja",
    "Ostalo",
    "Mirovina",
    "Najam",
    "Transfer",
    "Povrat",
    "Ostali prihodi",
    "N/A"
  ],
  "allow_other": true
}'::jsonb
WHERE name = 'Tip'
AND category_id IN (
  SELECT c.id FROM categories c
  JOIN areas a ON c.area_id = a.id
  WHERE a.name ILIKE 'Financije%'
);

-- Verify Step 1
SELECT ad.name, ad.slug, a.name as area_name,
  ad.validation_rules->'suggest' as options
FROM attribute_definitions ad
JOIN categories c ON ad.category_id = c.id
JOIN areas a ON c.area_id = a.id
WHERE ad.name = 'Tip'
AND a.name ILIKE 'Financije%';


-- Step 2: Insert Podtip attribute for each Financije area
-- Uses depends_on with Tip slug; sort_order after Tip
DO $$
DECLARE
  r RECORD;
  tip_slug TEXT;
  tip_sort INT;
  existing_id UUID;
BEGIN
  FOR r IN
    SELECT ad.id as tip_id, ad.slug as tip_slug, ad.sort_order as tip_sort,
           ad.category_id, ad.user_id, a.name as area_name
    FROM attribute_definitions ad
    JOIN categories c ON ad.category_id = c.id
    JOIN areas a ON c.area_id = a.id
    WHERE ad.name = 'Tip'
    AND a.name ILIKE 'Financije%'
  LOOP
    -- Check if Podtip already exists for this category
    SELECT id INTO existing_id
    FROM attribute_definitions
    WHERE name = 'Podtip' AND category_id = r.category_id;

    IF existing_id IS NOT NULL THEN
      -- Update existing
      UPDATE attribute_definitions
      SET validation_rules = jsonb_build_object(
        'type', 'suggest',
        'suggest', '[]'::jsonb,
        'allow_other', true,
        'depends_on', jsonb_build_object(
          'attribute_slug', r.tip_slug,
          'options_map', '{
            "Domaćinstvo": ["Struja", "Voda", "Holding (smeće)", "Plin", "Bankovni troškovi", "Popravci i održavanje", "Investicije", "Povrat Nataša", "Povrat Zoran"],
            "Informatika": ["T-mobile", "T-com", "HP", "Saša projekti", "Disney", "Sky", "Prime", "HBOmax", "Youtube", "AudibleKoka", "AudibleSasa", "Cloud backup", "Microsoft"],
            "Ostavine": ["Advokati"],
            "Zdravlje": ["Medical", "Lječnička komora", "PP", "PassSport", "Sportski rekviziti"],
            "auto C5": ["gorivo", "registracija", "parking", "popravci"],
            "auto Lacetti": ["gorivo", "registracija", "parking", "popravci"],
            "Putovanja": ["karte", "smještaj", "restoran"],
            "Ostalo": ["Odjeća/obuća", "Pokloni", "Kave/jelo vani", "Temu", "Taksi", "Kino/Kazalište/Muzeji"],
            "Mirovina": ["Saša", "Koka"],
            "Najam": ["Anja"],
            "*": []
          }'::jsonb
        )
      ),
      sort_order = r.tip_sort + 1
      WHERE id = existing_id;
      RAISE NOTICE 'Updated Podtip for area %', r.area_name;
    ELSE
      -- Insert new
      INSERT INTO attribute_definitions (
        id, user_id, category_id, name, slug, data_type,
        is_required, sort_order, validation_rules, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        r.user_id,
        r.category_id,
        'Podtip',
        'podtip',
        'text',
        false,
        r.tip_sort + 1,
        jsonb_build_object(
          'type', 'suggest',
          'suggest', '[]'::jsonb,
          'allow_other', true,
          'depends_on', jsonb_build_object(
            'attribute_slug', r.tip_slug,
            'options_map', '{
              "Domaćinstvo": ["Struja", "Voda", "Holding (smeće)", "Plin", "Bankovni troškovi", "Popravci i održavanje", "Investicije", "Povrat Nataša", "Povrat Zoran"],
              "Informatika": ["T-mobile", "T-com", "HP", "Saša projekti", "Disney", "Sky", "Prime", "HBOmax", "Youtube", "AudibleKoka", "AudibleSasa", "Cloud backup", "Microsoft"],
              "Ostavine": ["Advokati"],
              "Zdravlje": ["Medical", "Lječnička komora", "PP", "PassSport", "Sportski rekviziti"],
              "auto C5": ["gorivo", "registracija", "parking", "popravci"],
              "auto Lacetti": ["gorivo", "registracija", "parking", "popravci"],
              "Putovanja": ["karte", "smještaj", "restoran"],
              "Ostalo": ["Odjeća/obuća", "Pokloni", "Kave/jelo vani", "Temu", "Taksi", "Kino/Kazalište/Muzeji"],
              "Mirovina": ["Saša", "Koka"],
              "Najam": ["Anja"],
              "*": []
            }'::jsonb
          )
        ),
        now(),
        now()
      );
      RAISE NOTICE 'Inserted Podtip for area %', r.area_name;
    END IF;
  END LOOP;
END $$;

-- Verify Step 2
SELECT ad.name, ad.slug, ad.sort_order, a.name as area_name,
  ad.validation_rules->'depends_on'->'attribute_slug' as depends_on
FROM attribute_definitions ad
JOIN categories c ON ad.category_id = c.id
JOIN areas a ON c.area_id = a.id
WHERE ad.name = 'Podtip'
AND a.name ILIKE 'Financije%';
