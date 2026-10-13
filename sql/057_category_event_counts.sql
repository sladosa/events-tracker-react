-- ============================================================
-- 057_category_event_counts.sql — broj eventa po kategoriji JEDNIM upitom (S170)
-- ============================================================
-- Backlog „Structure fan-out" / T-S141-1. `useStructureData` je za brojanje
-- slao po jedan `count: 'exact'` upit ZA SVAKU KATEGORIJU (39 na PROD-u), a
-- jedan tok kroz Structure tab pokrene učitavanje 6–8 puta ⇒ ~300 zahtjeva.
-- Izmjereno S140/S141: u E10-2 traceu 39 + 39 u sekundi razmaka, odgovoreno 11
-- od 78. S133 je odbacio RPC „zasad, ne zauvijek" — dok su kategorije u
-- desecima; sada je trošak broj POZIVA, ne broj kategorija.
--
-- ŠTO VRAĆA
--   (category_id, n) za svaku kategoriju koja ima barem jedan VIDLJIV event.
--   Kategorija bez retka = 0 (to zna klijent: on ima popis kategorija).
--
-- ⚠ SECURITY INVOKER, NE DEFINER. Isto značenje kao dosadašnjih 39 upita:
--   broji ono što RLS pozivatelju pokazuje. (DEFINER bi brojao i tuđe evente —
--   drukčija brojka u bravi „leaf s eventima ne dobiva dijete" nego do sada.)
-- ⚠ Broji se po `category_id`, kao i prije. P2 roditeljski eventi žive na
--   roditelju pa se ondje i broje — `chain_key` ovdje ne mijenja ništa.
-- ⚠ Brojka je BRAVA (S133), pa klijent neuspjeli poziv ne čita kao nulu.
--   Nema li funkcije (PROD prije migracije), klijent pada natrag na stari
--   put — zato redoslijed migracija/deploy ne može ništa slomiti.
--
-- Run: TEST kroz psql (Claude), PROD u Supabase SQL editoru (Saša). Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_category_event_counts()
RETURNS TABLE (category_id uuid, n bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.category_id, count(*)::bigint
  FROM public.events e
  GROUP BY e.category_id;
$$;

REVOKE ALL ON FUNCTION public.rpc_category_event_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_category_event_counts() TO authenticated;

-- PostgREST mora vidjeti novu funkciju bez restarta.
NOTIFY pgrst, 'reload schema';
