-- ============================================================
-- 050_rls_events_insert.sql — event se ne smije ubaciti u tuđu Areu
-- ============================================================
-- Traži `046_rls_helpers.sql`. Pusti nakon `048`.
--
-- ⚠ DIRA ISKLJUČIVO `INSERT` NA `events`. Ne dira SELECT, UPDATE ni DELETE —
--   ondje živi logika iz `sql/043` / S123 / S125 (vlasnik Aree smije ispraviti
--   grantee-jev redak ali ne obrisati; `guard_event_author` čuva autorstvo;
--   atributi se pišu pod autorom eventa). Ta je logika pažljivo izmjerena i
--   njezino čišćenje je zaseban posao, ne usputni.
--
-- ŠTO SE ZATVARA
--   `events_insert` ima `WITH CHECK (user_id = auth.uid())` — dakle provjerava
--   samo POTPISUJEŠ LI SE SAM, a ništa o tome u čiju kategoriju pišeš. Isti
--   oblik rupe kao kod `categories` i `attribute_definitions` (048/049).
--
--   Izmjereno na TEST-u nakon 046–049 (`rls_probe.py`): od svih proba strancu
--   je ostala točno jedna — `events INSERT svoj → DA`. Dakle korisnik bez
--   ikakve veze s Areom mogao je u nju upisati event.
--
--   ⚠ Praktični doseg je manji nego kod strukture (treba mu `category_id`, a ne
--     vidi ga jer je SELECT uži), ali „mora pogoditi UUID" nije zaštita nego
--     otežavajuća okolnost. Rupa je rupa.
--
-- ⚠ ŠTO OVO NE SMIJE SLOMITI — provjereno protiv koda:
--   · **P2 parent eventi.** `AddActivityPage` upsert-a po jedan event na svakoj
--     razini lanca; sve su kategorije iste Aree ⇒ isti uvjet ⇒ prolazi.
--   · **Excel „Import as mine"** (`excelImport.ts:443`, `event_id: null` ⇒
--     INSERT s novim ID-em pod vlastitim `user_id`) — u vlastitu ili
--     write-dijeljenu Areu prolazi; u tuđu bez dozvole više ne, što i jest svrha.
--   · **Write-grantee unosi svoje evente** u tuđu Areu — `app_can_write_area`
--     pokriva write-share, pa ostaje kako jest (Sašina odluka, S134).
--
-- ⚠ `app_can_write_area` (iz 035) = vlasnik Aree ILI write-grantee. Namjerno se
--   koristi ONA, a ne `user_owns_area` kao kod strukture: struktura je
--   vlasnikova, ali unos podataka je ono zbog čega write-share uopće postoji.
--
-- ⚠ POVRATAK: `sql/SCHEMA_PROD.sql` (commit f374851).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PRIJE — koje INSERT politike stoje na `events`
-- ============================================================
SELECT polname, polpermissive, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM   pg_policy
WHERE  polrelid = 'public.events'::regclass
  AND  polcmd IN ('a', '*')
ORDER  BY polname;


-- ============================================================
-- 2. Briši SAMO INSERT politike (`a`), i one koje pokrivaju sve (`*`)
-- ============================================================
-- ⚠ `polcmd = '*'` (FOR ALL) pokriva i INSERT, pa bi preživjela takva politika
--   poništila ovu migraciju — a u popisu „INSERT politika" se ne bi ni vidjela.

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.events'::regclass
      AND polcmd IN ('a', '*')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.events', p.polname);
  END LOOP;
END $$;


-- ============================================================
-- 3. Jedna INSERT politika
-- ============================================================
-- Dva uvjeta, oba nužna:
--   `user_id = auth.uid()`  — ne možeš pisati pod tuđim imenom
--   `app_can_write_area(…)` — i ne možeš pisati u Areu koja ti nije otvorena

CREATE POLICY events_insert ON public.events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = events.category_id
        AND public.app_can_write_area(c.area_id)
    )
  );


-- ============================================================
-- 4. POSLIJE
-- ============================================================
SELECT polname, polcmd, polpermissive,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM   pg_policy
WHERE  polrelid = 'public.events'::regclass
ORDER  BY polcmd, polname;

COMMIT;

-- ============================================================
-- 5. ŠTO OSTAJE OTVORENO NAKON OVE MIGRACIJE
-- ============================================================
-- `event_attributes` INSERT je i dalje `user_id = auth.uid()` bez uvjeta na
-- event (`event_attributes_insert_policy`). Namjerno NIJE dirano ovdje:
-- S123 traži da se atributi pišu pod **autorom eventa**, ne pod onim tko
-- ispravlja, pa uvjet ne može biti isti kao za `events` — a pogrešno sužavanje
-- ostavlja redak BEZ IJEDNOG ATRIBUTA uz poruku o uspjehu
-- (`EditActivityPage` briše pa ponovno upisuje sve atribute).
--
-- Nakon 050 to više nije dohvatljivo bez postojećeg `event_id` u tuđoj Arei,
-- koji se ne može ni vidjeti. Ostaje kao zaseban, pažljiv zahvat — s pokusom
-- nad Edit tokom, ne samo nad politikom.
