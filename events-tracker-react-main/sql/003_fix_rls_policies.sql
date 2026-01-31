-- ============================================
-- FIX: Dodaj RLS na areas i categories
-- ============================================
-- Problem: Korisnik vidi podatke svih usera
-- Rješenje: Uključi RLS i dodaj politike
-- ============================================

-- AREAS
-- ============================================

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (ignore errors if don't exist)
DROP POLICY IF EXISTS "Users can view own areas" ON public.areas;
DROP POLICY IF EXISTS "Users can insert own areas" ON public.areas;
DROP POLICY IF EXISTS "Users can update own areas" ON public.areas;
DROP POLICY IF EXISTS "Users can delete own areas" ON public.areas;

-- Create policies
CREATE POLICY "Users can view own areas"
    ON public.areas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own areas"
    ON public.areas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own areas"
    ON public.areas FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own areas"
    ON public.areas FOR DELETE
    USING (auth.uid() = user_id);


-- CATEGORIES
-- ============================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories"
    ON public.categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON public.categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON public.categories FOR DELETE
    USING (auth.uid() = user_id);


-- ATTRIBUTE_DEFINITIONS
-- ============================================

ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attribute_definitions" ON public.attribute_definitions;
DROP POLICY IF EXISTS "Users can insert own attribute_definitions" ON public.attribute_definitions;
DROP POLICY IF EXISTS "Users can update own attribute_definitions" ON public.attribute_definitions;
DROP POLICY IF EXISTS "Users can delete own attribute_definitions" ON public.attribute_definitions;

CREATE POLICY "Users can view own attribute_definitions"
    ON public.attribute_definitions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attribute_definitions"
    ON public.attribute_definitions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attribute_definitions"
    ON public.attribute_definitions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attribute_definitions"
    ON public.attribute_definitions FOR DELETE
    USING (auth.uid() = user_id);


-- EVENTS
-- ============================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

CREATE POLICY "Users can view own events"
    ON public.events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
    ON public.events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
    ON public.events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
    ON public.events FOR DELETE
    USING (auth.uid() = user_id);


-- EVENT_ATTRIBUTES
-- ============================================

ALTER TABLE public.event_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event_attributes" ON public.event_attributes;
DROP POLICY IF EXISTS "Users can insert own event_attributes" ON public.event_attributes;
DROP POLICY IF EXISTS "Users can update own event_attributes" ON public.event_attributes;
DROP POLICY IF EXISTS "Users can delete own event_attributes" ON public.event_attributes;

CREATE POLICY "Users can view own event_attributes"
    ON public.event_attributes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event_attributes"
    ON public.event_attributes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own event_attributes"
    ON public.event_attributes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own event_attributes"
    ON public.event_attributes FOR DELETE
    USING (auth.uid() = user_id);


-- LOOKUP_VALUES (ako nema RLS)
-- ============================================

ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lookup_values" ON public.lookup_values;
DROP POLICY IF EXISTS "Users can insert own lookup_values" ON public.lookup_values;
DROP POLICY IF EXISTS "Users can update own lookup_values" ON public.lookup_values;
DROP POLICY IF EXISTS "Users can delete own lookup_values" ON public.lookup_values;

CREATE POLICY "Users can view own lookup_values"
    ON public.lookup_values FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lookup_values"
    ON public.lookup_values FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lookup_values"
    ON public.lookup_values FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lookup_values"
    ON public.lookup_values FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- DONE! Refresh stranici i trebao bi vidjeti samo svoje podatke
-- ============================================
