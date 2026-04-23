-- ============================================================
-- 014_demo_area.sql — Events Tracker React
-- Template "Demo" Area — demonstrates all attribute types and features
-- Run on: TEST + PROD (auto-detects template user by email)
-- ============================================================
-- Features demonstrated:
--   • Multi-level hierarchy (3 levels: Area → L1 → L2 → L3 leaf)
--   • All 6 attribute types: text, number, datetime, boolean, link, image
--   • Suggest attribute (text with predefined options)
--   • Dependent suggest (options depend on another attribute's value)
-- ============================================================
-- Structure:
--   Demo (Area)
--   ├── Exercise (L1)
--   │   ├── Strength (L2)
--   │   │   ├── Upper Body (L3 leaf) — exercise suggest, sets/reps/weight number
--   │   │   └── Lower Body (L3 leaf) — exercise suggest, sets/reps/weight number
--   │   └── Cardio (L2 leaf) — activity-type suggest + subtype dependent suggest, duration, distance, notes
--   └── Daily Log (L1)
--       ├── Mood (L2 leaf) — mood suggest, notes text, photo image
--       └── Task (L2 leaf) — title text, done boolean, due-date datetime, reference link
-- ============================================================

DO $$
DECLARE
  tpl uuid;
BEGIN
  SELECT id INTO tpl
  FROM auth.users
  WHERE email = 'sasasladoljev59+template@gmail.com'
  LIMIT 1;

  IF tpl IS NULL THEN
    RAISE EXCEPTION 'Template user not found — run 010_template_seed.sql first';
  END IF;

  -- ----------------------------------------------------------
  -- Area: Demo
  -- ----------------------------------------------------------
  INSERT INTO public.areas (id, user_id, name, slug, sort_order, created_at)
  VALUES ('10000000-0000-0000-0000-000000000006', tpl, 'Demo', 'demo', 6, now())
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- Categories
  -- ----------------------------------------------------------
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order, description)
  VALUES
    -- L1
    ('20000000-0000-0000-0000-000000000100', tpl, '10000000-0000-0000-0000-000000000006', NULL,
     'Exercise', 'exercise-demo', 1, 1, 'Exercise and sport tracking'),
    ('20000000-0000-0000-0000-000000000110', tpl, '10000000-0000-0000-0000-000000000006', NULL,
     'Daily Log', 'daily-log-demo', 1, 2, 'Daily mood, tasks and notes'),

    -- L2 under Exercise
    ('20000000-0000-0000-0000-000000000101', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000100',
     'Strength', 'strength-demo', 2, 1, 'Strength training workouts'),
    ('20000000-0000-0000-0000-000000000104', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000100',
     'Cardio', 'cardio-demo', 2, 2, 'Cardio — demonstrates suggest + dependent suggest'),

    -- L3 under Strength (leaves)
    ('20000000-0000-0000-0000-000000000102', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000101',
     'Upper Body', 'upper-body-demo', 3, 1, 'Push/pull upper body exercises'),
    ('20000000-0000-0000-0000-000000000103', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000101',
     'Lower Body', 'lower-body-demo', 3, 2, 'Squat/hinge lower body exercises'),

    -- L2 under Daily Log (leaves)
    ('20000000-0000-0000-0000-000000000111', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000110',
     'Mood', 'mood-demo', 2, 1, 'Daily mood and wellbeing log'),
    ('20000000-0000-0000-0000-000000000112', tpl, '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000110',
     'Task', 'task-demo', 2, 2, 'Tasks — demonstrates text, boolean, datetime, link')
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- Attribute Definitions
  -- ----------------------------------------------------------
  INSERT INTO public.attribute_definitions (id, user_id, category_id, name, slug, data_type, unit, sort_order, validation_rules, description)
  VALUES
    -- Upper Body (leaf L3): suggest + 3x number
    ('30000000-0000-0000-0000-000000000100', tpl, '20000000-0000-0000-0000-000000000102',
     'Exercise', 'exercise-upper', 'text', NULL, 1,
     '{"options": ["Push-up", "Bench Press", "Shoulder Press", "Tricep Dip", "Pull-up", "Dumbbell Row"]}',
     'Type of upper body exercise — suggest type demo'),
    ('30000000-0000-0000-0000-000000000101', tpl, '20000000-0000-0000-0000-000000000102',
     'Sets', 'sets-upper', 'number', NULL, 2, '{}', 'Number of sets'),
    ('30000000-0000-0000-0000-000000000102', tpl, '20000000-0000-0000-0000-000000000102',
     'Reps', 'reps-upper', 'number', NULL, 3, '{}', 'Repetitions per set'),
    ('30000000-0000-0000-0000-000000000103', tpl, '20000000-0000-0000-0000-000000000102',
     'Weight', 'weight-upper', 'number', 'kg', 4, '{}', 'Weight used in kg — number type demo'),

    -- Lower Body (leaf L3): suggest + 3x number
    ('30000000-0000-0000-0000-000000000110', tpl, '20000000-0000-0000-0000-000000000103',
     'Exercise', 'exercise-lower', 'text', NULL, 1,
     '{"options": ["Squat", "Deadlift", "Lunge", "Leg Press", "Calf Raise", "Hip Thrust"]}',
     'Type of lower body exercise — suggest type demo'),
    ('30000000-0000-0000-0000-000000000111', tpl, '20000000-0000-0000-0000-000000000103',
     'Sets', 'sets-lower', 'number', NULL, 2, '{}', 'Number of sets'),
    ('30000000-0000-0000-0000-000000000112', tpl, '20000000-0000-0000-0000-000000000103',
     'Reps', 'reps-lower', 'number', NULL, 3, '{}', 'Repetitions per set'),
    ('30000000-0000-0000-0000-000000000113', tpl, '20000000-0000-0000-0000-000000000103',
     'Weight', 'weight-lower', 'number', 'kg', 4, '{}', 'Weight used in kg'),

    -- Cardio (leaf L2): suggest + dependent suggest + 2x number + text
    ('30000000-0000-0000-0000-000000000120', tpl, '20000000-0000-0000-0000-000000000104',
     'Activity Type', 'activity-type', 'text', NULL, 1,
     '{"options": ["Running", "Cycling", "Swimming", "Rowing"]}',
     'Type of cardio — suggest type demo (parent for dependent suggest)'),
    ('30000000-0000-0000-0000-000000000121', tpl, '20000000-0000-0000-0000-000000000104',
     'Subtype', 'subtype', 'text', NULL, 2,
     '{"depends_on": {"slug": "activity-type", "values": {"Running": ["Sprint", "Tempo Run", "Easy Run", "Long Run"], "Cycling": ["Road Ride", "Mountain Bike", "Indoor Trainer"], "Swimming": ["Freestyle", "Backstroke", "Mixed"], "Rowing": ["Machine", "Water"]}}}',
     'Specific variant — dependent suggest demo (options change based on Activity Type)'),
    ('30000000-0000-0000-0000-000000000122', tpl, '20000000-0000-0000-0000-000000000104',
     'Duration', 'duration-cardio', 'number', 'min', 3, '{}', 'Duration in minutes'),
    ('30000000-0000-0000-0000-000000000123', tpl, '20000000-0000-0000-0000-000000000104',
     'Distance', 'distance-cardio', 'number', 'km', 4, '{}', 'Distance in km'),
    ('30000000-0000-0000-0000-000000000124', tpl, '20000000-0000-0000-0000-000000000104',
     'Notes', 'notes-cardio', 'text', NULL, 5, '{}', 'Free text notes — text type demo'),

    -- Mood (leaf L2): suggest + text + image
    ('30000000-0000-0000-0000-000000000130', tpl, '20000000-0000-0000-0000-000000000111',
     'Mood', 'mood', 'text', NULL, 1,
     '{"options": ["Happy", "Neutral", "Sad", "Anxious", "Energetic", "Tired"]}',
     'Current mood — suggest type demo'),
    ('30000000-0000-0000-0000-000000000131', tpl, '20000000-0000-0000-0000-000000000111',
     'Notes', 'notes-mood', 'text', NULL, 2, '{}', 'What happened today — text type demo'),
    ('30000000-0000-0000-0000-000000000132', tpl, '20000000-0000-0000-0000-000000000111',
     'Photo', 'photo-mood', 'image', NULL, 3, '{}', 'Optional photo — image type demo'),

    -- Task (leaf L2): text + boolean + datetime + link
    ('30000000-0000-0000-0000-000000000140', tpl, '20000000-0000-0000-0000-000000000112',
     'Title', 'title-task', 'text', NULL, 1, '{}', 'Task description — text type demo'),
    ('30000000-0000-0000-0000-000000000141', tpl, '20000000-0000-0000-0000-000000000112',
     'Done', 'done-task', 'boolean', NULL, 2, '{}', 'Completed? — boolean type demo'),
    ('30000000-0000-0000-0000-000000000142', tpl, '20000000-0000-0000-0000-000000000112',
     'Due Date', 'due-date-task', 'datetime', NULL, 3, '{}', 'Deadline — datetime type demo'),
    ('30000000-0000-0000-0000-000000000143', tpl, '20000000-0000-0000-0000-000000000112',
     'Reference', 'reference-task', 'link', NULL, 4, '{}', 'Related URL — link type demo')
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ============================================================
-- Verify after running:
-- SELECT name, slug FROM public.areas WHERE slug = 'demo';
-- SELECT name, level FROM public.categories WHERE area_id = '10000000-0000-0000-0000-000000000006' ORDER BY level, sort_order;
-- SELECT name, data_type, validation_rules FROM public.attribute_definitions WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sasasladoljev59+template@gmail.com') AND category_id IN (SELECT id FROM public.categories WHERE area_id = '10000000-0000-0000-0000-000000000006') ORDER BY category_id, sort_order;
-- ============================================================
