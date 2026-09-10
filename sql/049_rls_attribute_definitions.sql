-- ============================================================
-- 049_rls_attribute_definitions.sql — jedna politika po operaciji
-- ============================================================
-- Traži `046_rls_helpers.sql`. Pusti nakon `048`.
--
-- Ista rupa i ista odluka kao kod `categories`, samo jedan korak dublje:
--   · `attribute_definitions_insert_policy` provjerava samo `user_id =
--     auth.uid()`, bez ijednog uvjeta na kategoriju ⇒ izmjereno
--     `stranac → attribute_definitions INSERT → DA` (PROD i TEST).
--   · `write grantee → attribute_definitions UPDATE → DA, 1 redak` na PROD-u,
--     što odluka S133 zabranjuje.
--
-- ⚠ OVDJE JE BILO NAJVIŠE NASLAGA: PROD ima **17** politika na ovoj tablici,
--   od toga **5** samo za UPDATE (`Users can update their attribute
--   definitions`, `attribute_definitions_update_policy`, `Users can update own
--   attributes`, `Users can update own attribute_definitions`, `attr_def_update`).
--   Pet permissive politika znači da je dovoljno da JEDNA propusti — i upravo
--   zato se ovo ne popravlja dodavanjem šeste.
--
-- ⚠ Kriterij je vlasništvo AREE (`user_owns_category_area`), ne
--   `attribute_definitions.user_id`. Razlog je isti kao u 048: `user_id` se
--   prepisivao pri svakom spremanju panela — izmjereno da je svih 15 atributa
--   Kokine `Transakcije` bilo Sašino, jer je on zadnji spremao.
--
-- ⚠ POVRATAK: `sql/SCHEMA_PROD.sql` (commit f374851).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE
-- ============================================================
SELECT polname, polcmd, polpermissive
FROM   pg_policy
WHERE  polrelid = 'public.attribute_definitions'::regclass
ORDER  BY polcmd, polname;


-- ============================================================
-- 2. Briši sve postojeće
-- ============================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.attribute_definitions'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON public.attribute_definitions', p.polname);
  END LOOP;
END $$;


-- ============================================================
-- 3. Četiri politike
-- ============================================================

-- Čitanje prati kategoriju, koja prati Areu.
-- ⚠ `category_id` smije biti NULL (kolona je nullable). Takav redak nema Areu
--   kojoj bi pripadao, pa ga ne vidi nitko osim service ključa — što je točno:
--   atribut bez kategorije je siroče, ne zajedničko dobro.
CREATE POLICY attr_def_select ON public.attribute_definitions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = attribute_definitions.category_id
      AND public.app_can_read_area(c.area_id)
  ));

CREATE POLICY attr_def_insert ON public.attribute_definitions
  FOR INSERT
  WITH CHECK (public.user_owns_category_area(category_id));

-- WITH CHECK gleda NOVI redak — brani premještanje atributa u tuđu kategoriju.
CREATE POLICY attr_def_update ON public.attribute_definitions
  FOR UPDATE
  USING      (public.user_owns_category_area(category_id))
  WITH CHECK (public.user_owns_category_area(category_id));

CREATE POLICY attr_def_delete ON public.attribute_definitions
  FOR DELETE
  USING (public.user_owns_category_area(category_id));


-- ============================================================
-- 4. POSLIJE — mora biti točno četiri
-- ============================================================
SELECT polname, polcmd, polpermissive,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM   pg_policy
WHERE  polrelid = 'public.attribute_definitions'::regclass
ORDER  BY polcmd, polname;

COMMIT;

-- ============================================================
-- 5. Nakon COMMIT-a
-- ============================================================
--   Tools\run.bat Tools\rls_probe.py --env <env>
--   Tools\run.bat Tools\dump_schema.py --env <env>     ← shema natrag u git
--
-- Očekivano:
--   vlasnik Aree   sve DA
--   write grantee  SELECT DA · ostalo **NE**
--   stranac        sve **NE**
--
-- ⚠ Nakon sve tri migracije `dump_schema.py --env prod --diff` mora pokazati
--   razliku SAMO u politikama koje su ovdje dirane. Bilo što drugo znači da je
--   u međuvremenu netko mijenjao shemu izvan migracija.
