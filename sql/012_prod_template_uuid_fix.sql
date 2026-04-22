-- ============================================================
-- 012_prod_template_uuid_fix.sql
-- Migrate template user from old UUID to new UUID on PROD.
--
-- Old UUID: 00000000-0000-0000-0000-000000000001
-- New UUID: be785f09-b7c6-497f-b351-363d224c93c8 (= TEMPLATE_USER_ID in code)
--
-- Why: Template user was recreated via Supabase Dashboard to get a
-- real auth.users record with a proper UUID. Code (src/lib/constants.ts)
-- already uses the new UUID; PROD DB still has the old one.
--
-- Safe to re-run (ON CONFLICT DO NOTHING throughout).
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Clean up old template user data (bottom-up)
-- ------------------------------------------------------------
DELETE FROM public.attribute_definitions
WHERE user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.categories
WHERE user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.areas
WHERE user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.profiles
WHERE id = '00000000-0000-0000-0000-000000000001';

DELETE FROM auth.identities
WHERE user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM auth.users
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------
-- Step 2: Create template user with new UUID
-- Email: sasasladoljev59+template@gmail.com
-- This user exists in TEST project; recreate on PROD.
-- ------------------------------------------------------------
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  'be785f09-b7c6-497f-b351-363d224c93c8',
  'sasasladoljev59+template@gmail.com',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email)
VALUES ('be785f09-b7c6-497f-b351-363d224c93c8', 'sasasladoljev59+template@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Step 3: Template areas (new UUID)
-- ------------------------------------------------------------
INSERT INTO areas (id, user_id, name, slug, sort_order, created_at) VALUES
('10000000-0000-0000-0000-000000000001', 'be785f09-b7c6-497f-b351-363d224c93c8', 'Health',   'health',   1, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000002', 'be785f09-b7c6-497f-b351-363d224c93c8', 'Fitness',  'fitness',  2, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000003', 'be785f09-b7c6-497f-b351-363d224c93c8', 'Finance',  'finance',  3, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000004', 'be785f09-b7c6-497f-b351-363d224c93c8', 'Work',     'work',     4, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000005', 'be785f09-b7c6-497f-b351-363d224c93c8', 'Personal', 'personal', 5, '2026-01-07 15:31:15.702558+00')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Step 4: Template categories (new UUID)
-- ------------------------------------------------------------
INSERT INTO categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order, description) VALUES
('20000000-0000-0000-0000-000000000001', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000001', NULL, 'Sleep',            'sleep',            1, 1, 'Track sleep duration and quality'),
('20000000-0000-0000-0000-000000000002', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000001', NULL, 'Nutrition',         'nutrition',         1, 2, 'Track meals and nutrition'),
('20000000-0000-0000-0000-000000000003', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000001', NULL, 'Medical',           'medical',           1, 3, 'Track medical appointments and medications'),
('20000000-0000-0000-0000-000000000010', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000002', NULL, 'Strength Training', 'strength-training', 1, 1, 'Weight lifting and resistance exercises'),
('20000000-0000-0000-0000-000000000011', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000002', NULL, 'Cardio',            'cardio',            1, 2, 'Running, cycling, swimming, etc.'),
('20000000-0000-0000-0000-000000000012', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000002', NULL, 'Flexibility',       'flexibility',       1, 3, 'Yoga, stretching, mobility work'),
('20000000-0000-0000-0000-000000000020', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000003', NULL, 'Expenses',          'expenses',          1, 1, 'Track spending and purchases'),
('20000000-0000-0000-0000-000000000021', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000003', NULL, 'Income',            'income',            1, 2, 'Track salary, freelance, passive income'),
('20000000-0000-0000-0000-000000000022', 'be785f09-b7c6-497f-b351-363d224c93c8', '10000000-0000-0000-0000-000000000003', NULL, 'Investments',       'investments',       1, 3, 'Track investments and portfolio')
ON CONFLICT (id) DO UPDATE SET area_id = EXCLUDED.area_id, user_id = EXCLUDED.user_id;

-- ------------------------------------------------------------
-- Step 5: Template attribute definitions (new UUID)
-- ------------------------------------------------------------
INSERT INTO attribute_definitions (id, user_id, category_id, name, slug, data_type, unit, sort_order, validation_rules, description) VALUES
('30000000-0000-0000-0000-000000000001', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000001', 'Duration',       'duration',       'number', 'hours', 1, '{}', 'Hours of sleep'),
('30000000-0000-0000-0000-000000000002', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000001', 'Quality',        'quality',        'number', '1-10',  2, '{}', 'Sleep quality rating 1-10'),
('30000000-0000-0000-0000-000000000010', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000010', 'Exercise',       'exercise',       'text',   NULL,    1, '{}', 'Name of exercise'),
('30000000-0000-0000-0000-000000000011', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000010', 'Sets',           'sets',           'number', NULL,    2, '{}', 'Number of sets'),
('30000000-0000-0000-0000-000000000012', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000010', 'Reps',           'reps',           'number', NULL,    3, '{}', 'Repetitions per set'),
('30000000-0000-0000-0000-000000000013', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000010', 'Weight',         'weight',         'number', 'kg',    4, '{}', 'Weight used'),
('30000000-0000-0000-0000-000000000020', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000011', 'Activity',       'activity',       'text',   NULL,    1, '{}', 'Type of cardio activity'),
('30000000-0000-0000-0000-000000000021', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000011', 'Duration',       'duration',       'number', 'min',   2, '{}', 'Duration in minutes'),
('30000000-0000-0000-0000-000000000022', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000011', 'Distance',       'distance',       'number', 'km',    3, '{}', 'Distance covered'),
('30000000-0000-0000-0000-000000000023', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000011', 'Calories',       'calories',       'number', 'kcal',  4, '{}', 'Calories burned'),
('30000000-0000-0000-0000-000000000030', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000020', 'Amount',         'amount',         'number', 'EUR',   1, '{}', 'Expense amount'),
('30000000-0000-0000-0000-000000000031', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000020', 'Category',       'category',       'text',   NULL,    2, '{}', 'Expense category (food, transport, etc.)'),
('30000000-0000-0000-0000-000000000032', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000020', 'Payment Method', 'payment-method', 'text',   NULL,    3, '{}', 'Cash, card, transfer, etc.'),
('30000000-0000-0000-0000-000000000033', 'be785f09-b7c6-497f-b351-363d224c93c8', '20000000-0000-0000-0000-000000000020', 'Receipt',        'receipt',        'image',  NULL,    4, '{}', 'Photo of receipt')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Step 6: Update RLS policies to use new template UUID
-- (Replaces policies set by 009_sharing.sql and 010_template_seed.sql)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "areas_select" ON public.areas;
CREATE POLICY "areas_select" ON public.areas FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = 'be785f09-b7c6-497f-b351-363d224c93c8'
  OR id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT
USING (
  area_id IN (SELECT id FROM public.areas WHERE user_id = auth.uid() OR user_id = 'be785f09-b7c6-497f-b351-363d224c93c8')
  OR area_id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

DROP POLICY IF EXISTS "attr_def_select" ON public.attribute_definitions;
CREATE POLICY "attr_def_select" ON public.attribute_definitions FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = 'be785f09-b7c6-497f-b351-363d224c93c8'
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
);

-- ------------------------------------------------------------
-- Verify (run these SELECTs to confirm after the script)
-- ------------------------------------------------------------
-- SELECT id, email FROM auth.users WHERE id = 'be785f09-b7c6-497f-b351-363d224c93c8';
-- SELECT count(*) FROM public.areas WHERE user_id = 'be785f09-b7c6-497f-b351-363d224c93c8';
-- SELECT count(*) FROM public.categories WHERE user_id = 'be785f09-b7c6-497f-b351-363d224c93c8';
-- SELECT count(*) FROM public.attribute_definitions WHERE user_id = 'be785f09-b7c6-497f-b351-363d224c93c8';
-- Expected: 1 user, 5 areas, 9 categories, 14 attr_defs
