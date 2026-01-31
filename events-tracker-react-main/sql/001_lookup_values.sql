-- ============================================
-- lookup_values - Dinamički dropdown vrijednosti
-- ============================================
-- Koristi se za attribute_definitions.validation_rules
-- kada atribut ima dropdown čije opcije ovise o kontekstu
-- ============================================

CREATE TABLE IF NOT EXISTS public.lookup_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Identifikacija lookup-a
    lookup_name TEXT NOT NULL,          -- 'exercise_types', 'mood_options', 'equipment'...
    parent_key TEXT,                     -- NULL = globalno, ili 'gym', 'outdoor', category_id...
    
    -- Vrijednost
    value TEXT NOT NULL,                 -- Prikazana vrijednost
    value_key TEXT,                      -- Opcionalni interni ključ (ako treba)
    
    -- Organizacija
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,      -- Soft delete / disable
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Jedan korisnik ne može imati duplikat
    CONSTRAINT lookup_values_unique UNIQUE(user_id, lookup_name, parent_key, value)
);

-- ============================================
-- Indeksi za brže pretrage
-- ============================================

CREATE INDEX IF NOT EXISTS idx_lookup_values_user 
    ON public.lookup_values(user_id);

CREATE INDEX IF NOT EXISTS idx_lookup_values_name 
    ON public.lookup_values(lookup_name);

CREATE INDEX IF NOT EXISTS idx_lookup_values_lookup 
    ON public.lookup_values(user_id, lookup_name, parent_key);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;

-- Korisnici vide samo svoje lookup vrijednosti
CREATE POLICY "Users can view own lookup_values"
    ON public.lookup_values
    FOR SELECT
    USING (auth.uid() = user_id);

-- Korisnici mogu unositi svoje lookup vrijednosti
CREATE POLICY "Users can insert own lookup_values"
    ON public.lookup_values
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Korisnici mogu ažurirati svoje lookup vrijednosti
CREATE POLICY "Users can update own lookup_values"
    ON public.lookup_values
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Korisnici mogu brisati svoje lookup vrijednosti
CREATE POLICY "Users can delete own lookup_values"
    ON public.lookup_values
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Trigger za updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_lookup_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lookup_values_updated_at
    BEFORE UPDATE ON public.lookup_values
    FOR EACH ROW
    EXECUTE FUNCTION update_lookup_values_updated_at();

-- ============================================
-- Komentar na tablicu
-- ============================================

COMMENT ON TABLE public.lookup_values IS 
'Dinamičke dropdown vrijednosti za attribute_definitions. 
Koristi lookup_name za grupiranje (npr. exercise_types), 
parent_key za kontekst-ovisne opcije (npr. gym vs outdoor).';

COMMENT ON COLUMN public.lookup_values.lookup_name IS 
'Ime lookup grupe - koristi se u attribute_definitions.validation_rules';

COMMENT ON COLUMN public.lookup_values.parent_key IS 
'Kontekst za ovisne dropdowne. NULL = globalne opcije za taj lookup_name';
