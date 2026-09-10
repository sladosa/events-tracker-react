-- ============================================================
-- 046_rls_helpers.sql — temelj za čišćenje RLS-a (047–049)
-- ============================================================
-- Ne mijenja NIJEDNO pravo. Samo priprema dvije funkcije koje 047–049 koriste,
-- da se isti uvjet ne prepisuje u dvanaest politika — a prepisan uvjet je
-- prilika da se razidje (isto pravilo kao `canUpdateExisting()` u S125).
--
-- KONTEKST (S134): PROD ima 107 politika, TEST 50; na jednoj operaciji stoji
-- 3–5 permissive politika iz tri generacije. Permissive politike se OR-aju, pa
-- NAJŠIRA UVIJEK POBJEĐUJE — zabrana se postiže isključivo BRISANJEM, nikad
-- dodavanjem. Puni nalaz: `docs/RLS_INVENTORY.md`.
--
-- ⚠ POVRATAK: staro stanje je u gitu (`sql/SCHEMA_PROD.sql`, commit f374851).
--   Nijedna od ovih migracija ne briše podatke — samo politike.
--
-- Pusti u Supabase SQL editoru. Idempotentno (CREATE OR REPLACE).
-- ============================================================


-- ============================================================
-- 1. `user_owns_area` — vlasništvo Aree, jedini kriterij za strukturu
-- ============================================================
-- Postoji od ranije; ovdje dobiva `SET search_path`, kojeg nije imala.
-- Bez njega SECURITY DEFINER funkcija razrješava imena po search_pathu
-- POZIVATELJA — a to je klasičan put do izvršavanja tuđeg koda s pravima
-- vlasnika funkcije. Ostale `app_*` funkcije to već imaju; ova je ispala.
--
-- ⚠ SECURITY DEFINER je ovdje NUŽAN, ne udobnost: politika na `categories` ne
--   smije ovisiti o tome vidi li pozivatelj redak u `areas` — inače bi SELECT
--   politika jedne tablice tiho određivala prava na drugoj.

CREATE OR REPLACE FUNCTION public.user_owns_area(area_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = area_uuid
      AND a.user_id = auth.uid()
  );
$$;


-- ============================================================
-- 2. `user_owns_category_area` — isti kriterij, jedan korak dalje
-- ============================================================
-- `attribute_definitions` visi o kategoriji, a kategorija o Arei. Bez ovoga
-- bi svaka politika na atributima nosila vlastiti dvostruki join, u četiri
-- primjerka.
--
-- ⚠ Namjerno NE gleda `categories.user_id` ni `attribute_definitions.user_id`.
--   To je korijen problema iz S134: `user_id` se prepisivao na svakom spremanju
--   panela, pa je stupac govorio „tko je zadnji spremio", a politike su ga
--   čitale kao „čije je". Vlasništvo **Aree** se ne mijenja spremanjem, pa je
--   jedini stabilan temelj. Time `user_id` na strukturi ostaje informacija
--   (tko je stvorio), a prestaje biti pravo.

CREATE OR REPLACE FUNCTION public.user_owns_category_area(cat_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.areas a ON a.id = c.area_id
    WHERE c.id = cat_uuid
      AND a.user_id = auth.uid()
  );
$$;


-- ============================================================
-- 3. Provjera — mora vratiti `t` za Areu koju pustač posjeduje
-- ============================================================
-- ⚠ U SQL editoru `auth.uid()` je NULL (nema JWT-a), pa ovo ondje vraća `f`
--   za sve. To NIJE kvar funkcije nego odsutnost korisnika — prava se mjere
--   alatom `data-prep_tools/Tools/rls_probe.py`, koji glumi ulogu ispravno.

SELECT
  'user_owns_area postoji'            AS provjera,
  to_regprocedure('public.user_owns_area(uuid)')            IS NOT NULL AS ok
UNION ALL
SELECT
  'user_owns_category_area postoji',
  to_regprocedure('public.user_owns_category_area(uuid)')   IS NOT NULL
UNION ALL
SELECT
  'app_can_read_area postoji (iz 035)',
  to_regprocedure('public.app_can_read_area(uuid)')         IS NOT NULL;
