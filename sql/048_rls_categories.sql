-- ============================================================
-- 048_rls_categories.sql — jedna politika po operaciji na `categories`
-- ============================================================
-- Traži `046_rls_helpers.sql`. Pusti nakon `047`.
--
-- ZATVARA DVIJE STVARI ODJEDNOM
--
-- 1. **OTVORENU RUPU.** Izmjereno 10.09.2026. (S134): bilo koji prijavljen
--    korisnik može ubaciti kategoriju u BILO ČIJU Areu. `categories_insert`
--    provjerava `user_id = auth.uid()` — dakle TKO POTPISUJE redak, a ne ČIJA
--    JE AREA u koju ga stavlja.
--    Dokaz: `INSERT 0 1` u psql-u pod tuđim korisnikom; `HTTP 201` preko REST-a
--    (redak počišćen); `rls_probe.py` daje `stranac → categories INSERT → DA`
--    na PROD-u **i** na TEST-u.
--    ⚠ Zašto se dosad činilo zatvoreno: supabase-js šalje
--      `Prefer: return=representation`, pa Postgres traži i SELECT pravo na
--      novi redak — i *to* politika odbija. Obrana je bila slučajna posljedica
--      jednog headera; s `return=minimal` prolazi. Isti razred kao „nema gumb
--      ≠ baza brani", samo jedan sloj niže: ovdje je i baza izgledala kao da brani.
--
-- 2. **Odluku S133**: struktura pripada vlasniku Aree, cijelim lancem.
--    Write-grantee je ne smije mijenjati. Izmjereno da danas može:
--    `write grantee → categories UPDATE (rename) → DA, 1 redak`.
--
-- ⚠ KRITERIJ JE VLASNIŠTVO AREE, NE `categories.user_id`.
--    `user_id` se do S134 prepisivao na svakom spremanju panela, pa je stupac
--    govorio „tko je zadnji spremio" a politike su ga čitale kao „čije je".
--    Vlasništvo Aree se spremanjem ne mijenja — jedini stabilan temelj. Time
--    `user_id` na strukturi ostaje informacija, a prestaje biti pravo, i
--    popravak `sql/045` više ne može odlutati.
--
-- ⚠ ŠTO OVO NE LOMI (provjereno u kodu):
--    · „From template" — `copy_template_area_to_user` prvo stvori Areu pod
--      novim vlasnikom, pa kopira kategorije u NJEGOVU Areu ⇒ prolazi.
--    · Structure import u vlastitu Areu ⇒ prolazi. U tuđu ⇒ blokiran, što i jest
--      svrha (`StructureImportModal` nema nijednu provjeru prava).
--    · `prevent_category_deletion` trigger i dalje brani brisanje kategorije s
--      eventima — RLS ga ne zamjenjuje nego dolazi prije njega.
--
-- ⚠ POVRATAK: `sql/SCHEMA_PROD.sql` (commit f374851).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE
-- ============================================================
SELECT polname, polcmd, polpermissive
FROM   pg_policy
WHERE  polrelid = 'public.categories'::regclass
ORDER  BY polcmd, polname;


-- ============================================================
-- 2. Briši sve postojeće (v. 047 zašto dinamički, ne popisom)
-- ============================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy WHERE polrelid = 'public.categories'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON public.categories', p.polname);
  END LOOP;
END $$;


-- ============================================================
-- 3. Četiri politike
-- ============================================================

-- Čitanje prati Areu: tko smije vidjeti Areu, smije vidjeti i njezinu strukturu.
CREATE POLICY categories_select ON public.categories
  FOR SELECT
  USING (public.app_can_read_area(area_id));

-- ⚠ OVDJE JE RUPA ZATVORENA: uvjet je na `area_id`, ne na `user_id`.
CREATE POLICY categories_insert ON public.categories
  FOR INSERT
  WITH CHECK (public.user_owns_area(area_id));

-- ⚠ WITH CHECK gleda NOVI redak — bez njega bi vlasnik Aree smio UPDATE-om
--   prebaciti kategoriju (s njezinih 5.173 eventa) u TUĐU Areu, i tamo bi
--   nestala s ekrana bez ijedne poruke.
CREATE POLICY categories_update ON public.categories
  FOR UPDATE
  USING      (public.user_owns_area(area_id))
  WITH CHECK (public.user_owns_area(area_id));

CREATE POLICY categories_delete ON public.categories
  FOR DELETE
  USING (public.user_owns_area(area_id));


-- ============================================================
-- 4. POSLIJE — mora biti točno četiri
-- ============================================================
SELECT polname, polcmd, polpermissive,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM   pg_policy
WHERE  polrelid = 'public.categories'::regclass
ORDER  BY polcmd, polname;

COMMIT;

-- ============================================================
-- 5. Nakon COMMIT-a — obavezno
-- ============================================================
--   Tools\run.bat Tools\rls_probe.py --env <env>
--
-- Očekivano:
--   vlasnik Aree   SELECT DA · INSERT DA · UPDATE DA · DELETE DA
--   write grantee  SELECT DA · INSERT **NE** · UPDATE **NE** · DELETE NE
--   stranac        sve **NE**   ← INSERT je dosad bio DA; to je rupa
--
-- ⚠ Ostane li ijedan `DA` gdje inventura kaže `NE`, negdje je preživjela stara
--   politika — provjeri korak 4, ne pretpostavljaj.
