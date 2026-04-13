-- ============================================================
-- 010_template_seed.sql — Events Tracker React
-- System template user + starter data (Areas, Categories, Attrs)
-- ============================================================
-- Run AFTER 009_sharing.sql.
-- Idempotent: safe to run multiple times (ON CONFLICT DO NOTHING).
--
-- Purpose: New users see a starter set of Areas/Categories in the
-- Area dropdown (RLS allows all authenticated users to read
-- template user data). Template user cannot log in.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Template user in auth.users
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
  '00000000-0000-0000-0000-000000000001',
  'system-templates@events-tracker.local',
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

-- ------------------------------------------------------------
-- 2. Profile
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'system-templates@events-tracker.local')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Areas RLS — allow all authenticated users to read template areas
-- (must run after 009_sharing.sql which creates areas_select)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "areas_select" ON public.areas;
CREATE POLICY "areas_select" ON public.areas FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = '00000000-0000-0000-0000-000000000001'
  OR id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

-- ------------------------------------------------------------
-- 4. Categories RLS — allow reading template categories
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT
USING (
  area_id IN (SELECT id FROM public.areas WHERE user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000001')
  OR area_id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

-- ------------------------------------------------------------
-- 5. Attribute definitions RLS — allow reading template attr_defs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "attr_def_select" ON public.attribute_definitions;
CREATE POLICY "attr_def_select" ON public.attribute_definitions FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = '00000000-0000-0000-0000-000000000001'
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
);

-- ------------------------------------------------------------
-- 6. Areas
-- ------------------------------------------------------------
INSERT INTO areas (id, user_id, name, slug, sort_order, created_at) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Health',   'health',   1, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Fitness',  'fitness',  2, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Finance',  'finance',  3, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Work',     'work',     4, '2026-01-07 15:31:15.702558+00'),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Personal', 'personal', 5, '2026-01-07 15:31:15.702558+00')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. Categories
-- ------------------------------------------------------------
INSERT INTO categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order, description) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, 'Sleep',            'sleep',            1, 1, 'Track sleep duration and quality'),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, 'Nutrition',         'nutrition',         1, 2, 'Track meals and nutrition'),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, 'Medical',           'medical',           1, 3, 'Track medical appointments and medications'),
('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, 'Strength Training', 'strength-training', 1, 1, 'Weight lifting and resistance exercises'),
('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, 'Cardio',            'cardio',            1, 2, 'Running, cycling, swimming, etc.'),
('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, 'Flexibility',       'flexibility',       1, 3, 'Yoga, stretching, mobility work'),
('20000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Expenses',          'expenses',          1, 1, 'Track spending and purchases'),
('20000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Income',            'income',            1, 2, 'Track salary, freelance, passive income'),
('20000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Investments',       'investments',       1, 3, 'Track investments and portfolio')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Attribute definitions
-- ------------------------------------------------------------
INSERT INTO attribute_definitions (id, user_id, category_id, name, slug, data_type, unit, sort_order, validation_rules, description) VALUES
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Duration',       'duration',       'number', 'hours', 1, '{}', 'Hours of sleep'),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Quality',        'quality',        'number', '1-10',  2, '{}', 'Sleep quality rating 1-10'),
('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Exercise',       'exercise',       'text',   NULL,    1, '{}', 'Name of exercise'),
('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Sets',           'sets',           'number', NULL,    2, '{}', 'Number of sets'),
('30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Reps',           'reps',           'number', NULL,    3, '{}', 'Repetitions per set'),
('30000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Weight',         'weight',         'number', 'kg',    4, '{}', 'Weight used'),
('30000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Activity',       'activity',       'text',   NULL,    1, '{}', 'Type of cardio activity'),
('30000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Duration',       'duration',       'number', 'min',   2, '{}', 'Duration in minutes'),
('30000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Distance',       'distance',       'number', 'km',    3, '{}', 'Distance covered'),
('30000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Calories',       'calories',       'number', 'kcal',  4, '{}', 'Calories burned'),
('30000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', 'Amount',         'amount',         'number', 'EUR',   1, '{}', 'Expense amount'),
('30000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', 'Category',       'category',       'text',   NULL,    2, '{}', 'Expense category (food, transport, etc.)'),
('30000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', 'Payment Method', 'payment-method', 'text',   NULL,    3, '{}', 'Cash, card, transfer, etc.'),
('30000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', 'Receipt',        'receipt',        'image',  NULL,    4, '{}', 'Photo of receipt')
ON CONFLICT (id) DO NOTHING;
