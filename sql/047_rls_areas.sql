-- ============================================================
-- 047_rls_areas.sql — jedna politika po operaciji na `areas`
-- ============================================================
-- Traži `046_rls_helpers.sql`.
--
-- ŠTO SE MIJENJA U PRAVIMA
--   Write-grantee VIŠE NE SMIJE mijenjati `areas` (Sašina odluka, S134).
--   `areas.settings` nosi `comment_template`, `automations`, `dashboard`,
--   `list_columns`, `export_profiles` — dakle konfiguraciju CIJELE Aree. Po
--   istoj logici po kojoj struktura nije grantee-jeva, nije ni to.
--
--   ⚠ CLAUDE.md je tvrdio da RLS to VEĆ brani („009_sharing.sql: only owner
--     writes"). Ne brani: `areas_update_policy` na PROD-u ima granu
--     `permission = 'write'`. Izmjereno `rls_probe.py --env prod`:
--     write grantee → `areas UPDATE settings` → **DA, 1 redak**.
--     Branio je samo app (`ExcelExportModal.tsx:557`) — dakle disciplina.
--
-- ŠTO SE NE MIJENJA
--   Čitanje. `app_can_read_area` (iz 035) već pokriva vlasnika, dijeljenu Areu
--   i template usera — a template razrješava PREKO EMAILA, ne hardkodiranog
--   UUID-a, jer se id razlikuje između baza (S118).
--
-- ⚠ POVRATAK: staro stanje je u `sql/SCHEMA_PROD.sql` (commit f374851).
-- ⚠ PRIJE I POSLIJE: `Tools\run.bat Tools\rls_probe.py --env <env>`.
--   Migracija koja mijenja RLS bez tog ispisa s obje strane je nagađanje.
--
-- Pusti: TEST → sonda → PROD → sonda. Idempotentno.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE — što je zatečeno
-- ============================================================
SELECT polname, polcmd, polpermissive
FROM   pg_policy
WHERE  polrelid = 'public.areas'::regclass
ORDER  BY polcmd, polname;


-- ============================================================
-- 2. Briši SVE postojeće politike na `areas`
-- ============================================================
-- ⚠ Dinamički, ne popisom imena. Dva razloga:
--   (a) PROD i TEST NEMAJU ista imena politika (13 naspram 4) — popis bi na
--       jednoj bazi tiho promašio dio, a `DROP POLICY IF EXISTS` na promašaju
--       ne javlja ništa;
--   (b) svaka preživjela permissive politika poništava cijelu migraciju, jer
--       se OR-a s novom i vraća staru propusnost.

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy WHERE polrelid = 'public.areas'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON public.areas', p.polname);
  END LOOP;
END $$;


-- ============================================================
-- 3. Četiri politike — po jedna za svaku operaciju
-- ============================================================

-- Čitati smiju: vlasnik · svatko kome je Area podijeljena · svi (template Aree)
CREATE POLICY areas_select ON public.areas
  FOR SELECT
  USING (public.app_can_read_area(id));

-- Stvoriti se može samo Area koja je odmah tvoja.
CREATE POLICY areas_insert ON public.areas
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ⚠ WITH CHECK ponavlja isti uvjet namjerno: bez njega bi vlasnik smio
--   UPDATE-om prebaciti `user_id` na drugoga i time pokloniti Areu (a s njom i
--   sve evente u njoj) bez ijednog traga. USING gleda STARI redak, WITH CHECK
--   NOVI — i samo drugi može reći „i dalje mora biti tvoja".
CREATE POLICY areas_update ON public.areas
  FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY areas_delete ON public.areas
  FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- 4. POSLIJE — mora biti točno četiri
-- ============================================================
SELECT polname, polcmd, polpermissive,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM   pg_policy
WHERE  polrelid = 'public.areas'::regclass
ORDER  BY polcmd, polname;

COMMIT;

-- ============================================================
-- 5. Nakon COMMIT-a — obavezno
-- ============================================================
--   Tools\run.bat Tools\rls_probe.py --env <env>
--
-- Očekivano, protiv `docs/RLS_INVENTORY.md`:
--   vlasnik Aree   areas SELECT DA · UPDATE DA · DELETE DA
--   write grantee  areas SELECT DA · UPDATE **NE** · DELETE NE
--   stranac        sve NE
--
-- ⚠ Promjena koju treba očekivati u aplikaciji: Saša kao grantee na
--   `Financije_all` više ne može spremiti Export/Import profil ni bilo koju
--   per-Area konfiguraciju. To je bila i dosad namjera (app ga je već
--   zaustavljao), samo sada i baza to drži.
