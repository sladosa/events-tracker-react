-- ============================================================
-- 052_rls_areas_select_own_row.sql — `areas_select` mora gledati i SAM redak
-- ============================================================
-- Traži `047_rls_areas.sql`. Popravlja kvar koji je `047` unio.
--
-- ŠTO JE KVAR
--   `047` je postavio:
--
--       CREATE POLICY areas_select ON public.areas
--         FOR SELECT USING (public.app_can_read_area(id));
--
--   `app_can_read_area` (iz `035`) radi `SELECT 1 FROM public.areas WHERE
--   id = p_area_id AND user_id = auth.uid()` — dakle **traži redak u tablici**.
--   Funkcija je `STABLE` + `SECURITY DEFINER`, pa gleda snimku od početka
--   naredbe. Redak koji se TEK UMEĆE u njoj ne postoji ⇒ `EXISTS` je false ⇒
--   SELECT je zabranjen ⇒ `INSERT … RETURNING` padne **cijeli**.
--
--   Poruka koju pozivatelj dobije je `42501 new row violates row-level
--   security policy for table "areas"` — dakle tvrdi da **upis** nije dopušten.
--   To je **neistina**: `areas_insert` ga propušta. Zabranjeno je bilo
--   ČITANJE NATRAG.
--
-- ⚠ ISTA MEHANIKA, DVA SUPROTNA PRIVIDA — v. CLAUDE.md:
--     S134: `Prefer: return=representation` MASKIRA OTVOREN INSERT
--           (rupa izgleda zatvoreno)
--     S135: ista stvar čini LEGITIMAN INSERT ZABRANJENIM
--           (ispravno pravo izgleda kao zabrana)
--   Oba puta uzrok je isti: uz `RETURNING` Postgres traži i SELECT pravo na
--   novi redak. Zato se INSERT mjeri i sa i bez `RETURNING` — razlika između
--   ta dva ispisa JE dijagnoza.
--
-- ZAŠTO SU `categories` I `attribute_definitions` POŠTEĐENE
--   Njihove SELECT politike traže **roditelja** (`app_can_read_area(area_id)`,
--   odnosno `EXISTS` nad `categories`), a roditelj u trenutku upisa **postoji**.
--   `areas_select` je jedina samoreferentna ⇒ jedina pogođena.
--
-- KAKO JE NAĐEN
--   Ne sondom — sonda `areas INSERT` uopće nije imala (ispravljeno u
--   `rls_probe.py` istim potezom). Našla su ga tri E2E speca (`S100`, `S107b`,
--   `S119`) koja Areu stvaraju preko REST-a s `Prefer: return=representation`.
--   ⇒ Instrument kojim se dokazivala ispravnost `047` bio je slijep točno
--     ondje gdje je `047` pogriješio.
--
-- ⚠ PRODUKCIJA NIJE BILA POKVARENA, i to je izmjereno a ne pretpostavljeno:
--   sva četiri mjesta u aplikaciji koja stvaraju Areu
--   (`StructureAddAreaPanel` ×2, `leaveArea.ts`, `structureImport.ts`) zovu
--   `.insert()` **bez** `.select()`, a `postgrest-js 2.93.0` uz `insert()`
--   dodaje samo `count=` i `missing=default` — `return=representation` dolazi
--   tek s `.select()`. Dakle mina je bila postavljena, ali nitko nije stao.
--   Popravlja se zato što je `.insert().select()` posve prirodno napisati.
--
-- ŠTO SE MIJENJA
--   Politici se dodaje **prvi, jeftiniji uvjet nad vlastitim stupcem retka**.
--   Redak koji se upisuje svoj `user_id` nosi sa sobom, pa ga nije potrebno
--   tražiti u tablici.
--
-- ⚠ Helper se NE prepisuje u politiku, iako bi „radilo". Njegov komentar
--   izričito traži da politika i helper ostanu u sinkronizaciji; dvije kopije
--   istog uvjeta su prilika da se raziđu (isti razred kao `canUpdateExisting()`
--   u S125). Ovdje se dodaje **jedan termin**, a share / template / service_role
--   i dalje razrješava helper, nedirnut.
--
-- ⚠ Prava se NE ŠIRE. `user_id = auth.uid()` je već PRVA grana unutar
--   `app_can_read_area`; ovdje se samo izvlači ispred, da ne ovisi o tome je li
--   redak vidljiv u tablici. Tko je prije smio čitati, smije i dalje; tko nije,
--   i dalje ne smije.
--
-- ⚠ POVRATAK: staro stanje je u `sql/SCHEMA_PROD.sql` / `SCHEMA_TEST.sql`.
-- ⚠ PRIJE I POSLIJE: `Tools\run.bat Tools\rls_probe.py --env <env>`.
--
-- Pusti: TEST → sonda → PROD → sonda. Idempotentno.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE — što je zatečeno
-- ============================================================
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid) AS using_expr
FROM   pg_policy
WHERE  polrelid = 'public.areas'::regclass
  AND  polcmd = 'r'
ORDER  BY polname;


-- ============================================================
-- 2. Popravak
-- ============================================================
DROP POLICY IF EXISTS areas_select ON public.areas;

CREATE POLICY areas_select ON public.areas
  FOR SELECT
  USING (
    -- Vlastiti redak — čita se sa SAMOG RETKA, pa vrijedi i dok se tek umeće.
    user_id = auth.uid()
    -- Sve ostalo (share, template user, service_role) ostaje na helperu.
    OR public.app_can_read_area(id)
  );


-- ============================================================
-- 3. POSLIJE — mora biti točno jedna SELECT politika, s oba termina
-- ============================================================
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid) AS using_expr
FROM   pg_policy
WHERE  polrelid = 'public.areas'::regclass
  AND  polcmd = 'r'
ORDER  BY polname;

COMMIT;

-- ============================================================
-- 4. Nakon COMMIT-a — obavezno
-- ============================================================
--   Tools\run.bat Tools\rls_probe.py --env <env>
--
-- Očekivano (sonda sada ima OBJE INSERT probe na `areas`):
--   vlasnik Aree   areas INSERT svoju DA · INSERT +RETURNING **DA**
--   write grantee  isto (svatko smije stvoriti VLASTITU Areu)
--   stranac        isto
--   ⇒ Prije `052` je red `INSERT +RETURNING` bio **NE** za sve tri uloge.
--      To je jedina razlika koju ova migracija smije proizvesti; svaki drugi
--      pomak u sondi znači da je dirnuto nešto što nije trebalo.
--
-- Protuprovjera bez pisanja po bazi (TEST, sve u ROLLBACK-u):
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<tvoj TEST user id>","role":"authenticated"}', true);
--   INSERT INTO public.areas (id,user_id,name,slug,sort_order)
--   VALUES (gen_random_uuid(),auth.uid(),'PROBA 1','proba-1',99);
--   INSERT INTO public.areas (id,user_id,name,slug,sort_order)
--   VALUES (gen_random_uuid(),auth.uid(),'PROBA 2','proba-2',99) RETURNING *;
--   ROLLBACK;
--   Prije `052`: prva prolazi, druga pada. Poslije: obje prolaze.
