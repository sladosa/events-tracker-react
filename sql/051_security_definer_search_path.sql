-- ============================================================
-- 051_security_definer_search_path.sql — higijena, ne rupa
-- ============================================================
-- ⚠ NIJE HITNO I NIJE ISKORISTIVO DANAS. Napisano pošteno da se ne bi poslije
--   čitalo kao propuštena rupa:
--
--   `SECURITY DEFINER` funkcija bez `SET search_path` razrješava nekvalificirana
--   imena po search_pathu POZIVATELJA. Klasičan put je: napadač stvori tablicu
--   ili funkciju istog imena u shemi koja mu je prva na search_pathu, i definer
--   je izvrši s pravima svog vlasnika (`postgres`).
--
--   Izmjereno na TEST-u 10.09.2026. da to ovdje NE PROLAZI:
--       has_schema_privilege('authenticated','public','CREATE')  = false
--       has_schema_privilege('anon','public','CREATE')           = false
--       has_database_privilege('authenticated', …, 'CREATE')     = false
--   Dakle korisnik nema gdje podmetnuti. Ovo je zatvaranje puta prije nego
--   postane prohodan — ako se ikad ikome da CREATE, ove funkcije ne smiju biti
--   ono što tada popušta.
--
-- ZAŠTO JE SIGURNO PUSTITI
--   Provjerena su tijela svih osam: svaka referenca na `auth` shemu je
--   KVALIFICIRANA (`auth.users`, `auth.uid()`), i nema nijednog golog imena iz
--   druge sheme. `search_path` od `public, pg_temp` im zato ne mijenja ništa.
--   `ALTER FUNCTION … SET` ne dira tijelo funkcije.
--
--   `user_owns_area` nije ovdje — nju je `046` već popravio, zajedno s tijelom.
--
-- Idempotentno. Pusti nakon `046`–`050` (redoslijed nije bitan, samo urednost).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE — koje SECURITY DEFINER funkcije nemaju search_path
-- ============================================================
SELECT p.proname,
       (p.proconfig IS NULL
        OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
                       WHERE c LIKE 'search\_path=%')) AS bez_search_patha
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public' AND p.prosecdef
ORDER  BY 2 DESC, 1;


-- ============================================================
-- 2. Popravak — nad onim što baza STVARNO ima
-- ============================================================
-- ⚠ Prva verzija ove migracije nabrajala je osam funkcija po imenu i potpisu,
--   prepisanih iz `SCHEMA_PROD.sql`. Na TEST-u je pala na prvoj:
--       ERROR: function public.copy_template_area_to_user(uuid, uuid) does not exist
--   Šest od osam na TEST-u UOPĆE NE POSTOJI (ondje su bez `search_path` samo
--   `handle_new_user` i `handle_pending_invites`). Isti razred koji je danas
--   ugrizao već tri puta: popis prepisan iz jedne baze ne opisuje drugu.
--
--   Zato popis dolazi iz `pg_proc`, a potpis iz
--   `pg_get_function_identity_arguments` — pa migracija radi na obje baze i
--   pokrije svaku buduću funkciju koja se pojavi bez `search_path`.

DO $$
DECLARE
  f record;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM   pg_proc p
    JOIN   pg_namespace ns ON ns.oid = p.pronamespace
    WHERE  ns.nspname = 'public'
      AND  p.prosecdef
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
                          WHERE c LIKE 'search\_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public'', ''pg_temp''', f.sig);
    n := n + 1;
    RAISE NOTICE 'search_path postavljen: %', f.sig;
  END LOOP;
  RAISE NOTICE 'ukupno popravljeno: %', n;
END $$;


-- ============================================================
-- 3. POSLIJE — stupac `bez_search_patha` mora biti `f` za sve
-- ============================================================
SELECT p.proname,
       (p.proconfig IS NULL
        OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
                       WHERE c LIKE 'search\_path=%')) AS bez_search_patha
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public' AND p.prosecdef
ORDER  BY 2 DESC, 1;

COMMIT;

-- ============================================================
-- 4. Nakon puštanja
-- ============================================================
-- ⚠ Dvije funkcije se ne daju provjeriti običnim pozivom jer su triggeri na
--   registraciji (`handle_new_user`, `handle_pending_invites`). Njih provjerava
--   tek sljedeća stvarna registracija korisnika — do tada stoji da su
--   promijenjene, ne da su provjerene.
--   Ostale se pozivaju iz aplikacije (`get_user_areas`, `get_my_shares`,
--   `share_area_with_user`, „From template") i vidjet će se odmah.
