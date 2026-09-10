-- ============================================================
-- 045_align_structure_ownership.sql — struktura pripada vlasniku Aree
-- ============================================================
-- Odluka S133: vlasnik Aree je vlasnik strukture cijelog lanca. Grantee ne
-- smije uredjivati strukturu, ni s `write` dozvolom.
--
-- ⚠ OVA MIGRACIJA IDE PRVA, PRIJE RLS ZABRANE — i to nije redoslijed radi
--   urednosti nego radi toga da se ne zakljuca i vlasnica.
--
--   Izmjereno na PROD-u 10.09.2026. (iz backupa `_backup/prod/2026-09-10_1245`):
--
--       Financije_all            areas.user_id      = eeb78414 (Koka)
--         └ Transakcija          categories.user_id = 768a6056 (Sasa)   5.173 eventa
--             15 atributa        svi                = 768a6056 (Sasa)
--       eventi u toj kategoriji: 5.161 Kokinih, 12 Sasinih
--
--   Dakle podaci su njeni, a struktura se vodi kao njegova. Nije bila takva od
--   pocetka: `StructureNodeEditPanel` je slao `user_id: <onaj tko sprema>` na
--   SVAKOM spremanju (popravljeno u istom commitu), pa je vlasnistvo preslo
--   na Sasu jer je on zadnji spremao — `updated_at` je bio isti taj dan.
--
--   Posljedica za redoslijed: ako se prvo zabrani pisanje grantee-u, a
--   `categories.user_id` ostane Sasin, onda po politici oblika
--   `user_id = auth.uid()` **ni Koka ne moze uredjivati vlastitu strukturu**.
--   Rezultat bi bio da ne moze NITKO, i to bez ijedne poruke — RLS-blokiran
--   UPDATE vraca 200 s nula promijenjenih redaka.
--
-- ⚠ PRIJE PUSTANJA: napravi snimku baze
--       Tools\run.bat Tools\backup_db.py --env prod
--   Ovo je prvo pisanje po PROD-u otkad backup postoji; neka i bude razlog.
--
-- ⚠ Trigger `set_category_slug` NE DIRA UPDATE (042), pa slugovi prezive.
--   `updated_at` se namjerno ne dira — ovo nije izmjena sadrzaja.
--
-- Idempotentno: drugi run ne mijenja nista (uvjet je `IS DISTINCT FROM`).
-- Pusti u Supabase SQL editoru: TEST prvo, pa PROD.
-- ============================================================


-- ============================================================
-- 1. PRIJE — sto je neuskladjeno
-- ============================================================
-- Ocekivano na PROD-u: 1 kategorija + 15 atributa, svi u `Financije_all`.
-- Vrati li vise, STANI i pogledaj sto je jos odlutalo prije nego pustis 2.

SELECT 'category' AS sto, c.id, c.name, a.name AS area,
       c.user_id AS sada, a.user_id AS treba_biti
FROM public.categories c
JOIN public.areas a ON a.id = c.area_id
WHERE c.user_id IS DISTINCT FROM a.user_id
UNION ALL
SELECT 'attribute', d.id, d.name, a.name,
       d.user_id, a.user_id
FROM public.attribute_definitions d
JOIN public.categories c ON c.id = d.category_id
JOIN public.areas a ON a.id = c.area_id
WHERE d.user_id IS DISTINCT FROM a.user_id
ORDER BY 4, 1, 3;


-- ============================================================
-- 2. POPRAVAK
-- ============================================================
-- Opcenit uvjet, ne popis ID-eva: pravilo je "struktura pripada vlasniku Aree",
-- pa se isto odnosi na svaki buduci slucaj. Hardkodiran ID bi popravio danasnji
-- redak i pustio sljedeci.
--
-- ⚠ Retke BEZ vlasnika (`user_id IS NULL`, template/Streamlit uvoz) ovo takodjer
--   preuzima na vlasnika Aree — sto je bila i izvorna namjera koda koji je
--   popravljen: preuzmi ono sto nema vlasnika, ne ono sto ga ima.

UPDATE public.categories c
SET    user_id = a.user_id
FROM   public.areas a
WHERE  a.id = c.area_id
  AND  c.user_id IS DISTINCT FROM a.user_id;

UPDATE public.attribute_definitions d
SET    user_id = a.user_id
FROM   public.categories c
JOIN   public.areas a ON a.id = c.area_id
WHERE  c.id = d.category_id
  AND  d.user_id IS DISTINCT FROM a.user_id;


-- ============================================================
-- 3. POSLIJE — mora vratiti NULA redaka
-- ============================================================
-- Isti upit kao 1. Prazan rezultat je jedini dokaz da je proslo: broj
-- promijenjenih redaka koji javi editor mjeri sto je UPDATE dirnuo, ne sto je
-- ostalo neuskladjeno.

SELECT 'category' AS sto, c.id, c.name, a.name AS area,
       c.user_id AS sada, a.user_id AS treba_biti
FROM public.categories c
JOIN public.areas a ON a.id = c.area_id
WHERE c.user_id IS DISTINCT FROM a.user_id
UNION ALL
SELECT 'attribute', d.id, d.name, a.name,
       d.user_id, a.user_id
FROM public.attribute_definitions d
JOIN public.categories c ON c.id = d.category_id
JOIN public.areas a ON a.id = c.area_id
WHERE d.user_id IS DISTINCT FROM a.user_id;


-- ============================================================
-- 4. STO JOS NIJE NAPRAVLJENO — ne zatvara se ovom migracijom
-- ============================================================
-- Ovo poravnava PODATKE. Zabrana jos ne postoji:
--   * RLS — politika PROD-a nije u repou i mora se PROCITATI prije nego se
--     mijenja (`pg_policy` nad `public.categories`). Izmjereno je da danas
--     propusta write-grantee-a bez obzira na `categories.user_id`.
--   * UI — tri puta do istog pisanja: `CategoryDetailPanel` (Edit gumb, prati
--     samo `isEditMode`), Edit Mode u `StructureTableView`, i
--     `StructureImportModal` (nijedna provjera prava — uvoz Structure Excela
--     je puna zamjena za panel).
-- "Nema gumb" nije "baza brani". Bez RLS-a ostaje otvoreno kroz uvoz i REST.
