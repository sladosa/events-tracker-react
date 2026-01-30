-- ============================================
-- PRIMJER: Kako koristiti lookup_values
-- ============================================
-- NAPOMENA: Ovo je samo primjer - prilagodi svojim potrebama
-- user_id trebaš zamijeniti sa svojim stvarnim UUID-om
-- ============================================

-- Primjer 1: Exercise Types ovisno o lokaciji (Gym vs Outdoor)
-- ------------------------------------------------------------

-- Globalne opcije (parent_key = NULL) - dostupne svugdje
INSERT INTO public.lookup_values (user_id, lookup_name, parent_key, value, sort_order) VALUES
('YOUR_USER_ID', 'exercise_type', NULL, 'Stretching', 1),
('YOUR_USER_ID', 'exercise_type', NULL, 'Warmup', 2);

-- Gym-specifične opcije
INSERT INTO public.lookup_values (user_id, lookup_name, parent_key, value, sort_order) VALUES
('YOUR_USER_ID', 'exercise_type', 'gym', 'Bench Press', 10),
('YOUR_USER_ID', 'exercise_type', 'gym', 'Squat', 11),
('YOUR_USER_ID', 'exercise_type', 'gym', 'Deadlift', 12),
('YOUR_USER_ID', 'exercise_type', 'gym', 'Pull-ups', 13),
('YOUR_USER_ID', 'exercise_type', 'gym', 'Rows', 14);

-- Outdoor-specifične opcije
INSERT INTO public.lookup_values (user_id, lookup_name, parent_key, value, sort_order) VALUES
('YOUR_USER_ID', 'exercise_type', 'outdoor', 'Running', 10),
('YOUR_USER_ID', 'exercise_type', 'outdoor', 'Cycling', 11),
('YOUR_USER_ID', 'exercise_type', 'outdoor', 'Hiking', 12),
('YOUR_USER_ID', 'exercise_type', 'outdoor', 'Swimming', 13);


-- Primjer 2: Strength Types (globalni - bez parent_key)
-- ------------------------------------------------------------
INSERT INTO public.lookup_values (user_id, lookup_name, parent_key, value, sort_order) VALUES
('YOUR_USER_ID', 'strength_type', NULL, 'Low', 1),
('YOUR_USER_ID', 'strength_type', NULL, 'Medium', 2),
('YOUR_USER_ID', 'strength_type', NULL, 'High', 3),
('YOUR_USER_ID', 'strength_type', NULL, 'Full', 4);


-- Primjer 3: Mood Score opcije
-- ------------------------------------------------------------
INSERT INTO public.lookup_values (user_id, lookup_name, parent_key, value, value_key, sort_order) VALUES
('YOUR_USER_ID', 'mood_score', NULL, '😢 Very Bad', '1', 1),
('YOUR_USER_ID', 'mood_score', NULL, '😕 Bad', '2', 2),
('YOUR_USER_ID', 'mood_score', NULL, '😐 Neutral', '3', 3),
('YOUR_USER_ID', 'mood_score', NULL, '🙂 Good', '4', 4),
('YOUR_USER_ID', 'mood_score', NULL, '😄 Excellent', '5', 5);


-- ============================================
-- KAKO KORISTITI U attribute_definitions.validation_rules
-- ============================================

/*
Za globalni dropdown (sve opcije):

UPDATE attribute_definitions
SET validation_rules = '{
    "dropdown": {
        "type": "lookup",
        "lookup_name": "strength_type"
    }
}'::jsonb
WHERE slug = 'strength_type';


Za kontekst-ovisan dropdown (opcije ovise o parent_key):

UPDATE attribute_definitions  
SET validation_rules = '{
    "dropdown": {
        "type": "dynamic_lookup",
        "lookup_name": "exercise_type",
        "depends_on": {
            "field": "category_slug",
            "mapping": {
                "gym-strength": "gym",
                "gym-cardio": "gym", 
                "outdoor-running": "outdoor",
                "outdoor-cycling": "outdoor"
            }
        },
        "include_global": true,
        "allow_custom": true
    }
}'::jsonb
WHERE slug = 'exercise_type';

*/


-- ============================================
-- QUERY PRIMJERI
-- ============================================

-- Dohvati sve exercise_type opcije za "gym" kontekst (uključujući globalne)
/*
SELECT value, sort_order
FROM lookup_values
WHERE user_id = 'YOUR_USER_ID'
  AND lookup_name = 'exercise_type'
  AND (parent_key = 'gym' OR parent_key IS NULL)
  AND is_active = true
ORDER BY parent_key NULLS FIRST, sort_order;
*/

-- Dohvati sve lookup_name grupe za korisnika
/*
SELECT DISTINCT lookup_name
FROM lookup_values
WHERE user_id = 'YOUR_USER_ID'
ORDER BY lookup_name;
*/
