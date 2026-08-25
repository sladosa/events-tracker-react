-- ============================================================
-- 039_prod_cleanup_shares.sql — čišćenje osirotjelih share redaka (PROD, S118)
-- ============================================================
-- Kontekst: priprema PROD-a za Kokinu `Financije_all` areu. Prije nego joj se
-- doda nova area, miču se retci koji pokazuju na nešto što više ne postoji —
-- inače Share Management modal prikazuje pristupe kojih nema, a to je točno ona
-- vrsta „izgleda uredno, a nije" koju inače lovimo.
--
-- Izmjereno na PROD-u 2026-08-25 (read-only inventura):
--   · data_shares   : 1 redak cilja na obrisanu areu 9436304e
--   · share_invites : 2 retka cilja na istu obrisanu areu
--   · share_invites : 1 redak je pozivnica za obrisan tipfeler-račun
--                     (dubravla.pavic-sladoljev@…, obrisan 25.08.)
--   · eventi / kategorije / activity_presets: NIJEDNO siroče — ne dira se ništa
--
-- Sve je pisano GENERIČKI (uvjet, ne popis id-eva) pa je idempotentno: drugi
-- put ne obriše ništa jer više nema što. Ništa se ne briše kaskadno.
--
-- ⚠ NE dira stare aree `Financije` (357 eventa) i `Financije_old` (2774).
--   One su netaknuta rezerva dok cutover nije verificiran (FINANCIJE_MIGRACIJA §13),
--   i kad dođe dan brišu se s backupom kroz 033_delete_area_cascade.sql, ne ovdje.
-- ============================================================

BEGIN;

-- ── 1. PRIJE: što će nestati ─────────────────────────────────
--    Pokreni sam ovaj SELECT ako želiš vidjeti prije nego potvrdiš.
SELECT 'data_shares' AS tbl, ds.id, ds.share_type, ds.target_id,
       ds.permission, ds.created_at
FROM   public.data_shares ds
WHERE  ds.share_type = 'area'
  AND  NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = ds.target_id)
UNION ALL
SELECT 'share_invites', si.id, si.share_type, si.target_id,
       si.grantee_email, si.created_at
FROM   public.share_invites si
WHERE  (si.share_type = 'area'
        AND NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = si.target_id))
   OR  NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.email = si.grantee_email);

-- ── 2. Share prema arei koja više ne postoji ────────────────
DELETE FROM public.data_shares ds
WHERE  ds.share_type = 'area'
  AND  NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = ds.target_id);

-- ── 3. Pozivnice prema nepostojećoj arei ────────────────────
DELETE FROM public.share_invites si
WHERE  si.share_type = 'area'
  AND  NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = si.target_id);

-- ── 4. Pozivnice za račun koji više ne postoji ──────────────
--    Vrijedi samo za prihvaćene pozivnice: neprihvaćena pozivnica na email
--    bez računa je NORMALNA (čeka da se osoba registrira) i ne smije nestati.
DELETE FROM public.share_invites si
WHERE  si.status = 'accepted'
  AND  NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.email = si.grantee_email);

-- ── 5. POSLIJE: mora vratiti 0 redaka ───────────────────────
SELECT count(*) AS preostalo_sirocadi
FROM (
  SELECT ds.id FROM public.data_shares ds
  WHERE ds.share_type = 'area'
    AND NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = ds.target_id)
  UNION ALL
  SELECT si.id FROM public.share_invites si
  WHERE (si.share_type = 'area'
         AND NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = si.target_id))
     OR (si.status = 'accepted'
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.email = si.grantee_email))
) q;

COMMIT;

-- ============================================================
-- 6. ODVOJENA ODLUKA — NE pokreće se zajedno s gornjim
-- ============================================================
---Koka trenutno ima read pristup Sašinoj `Financije_old` (2774 eventa).
-- Kad dobije `Financije_all`, u njenom Area dropdownu stajat će TRI slična
-- imena: `Financije` (njena stara), `Financije_old` (tvoja), `Financije_all`.
-- Prvi unos u krivu areu neće javiti grešku — samo će sjesti drugdje.
--
-- Ovo NE briše areu, samo joj skida pristup; vraća se jednim Share dijalogom.
--
DELETE FROM public.data_shares
WHERE  id = 'aa316ae1-60da-41e0-8906-0c7637f9a452';   -- Financije_old → Koka (read)
--
-- ⚠ Share u OBRNUTOM smjeru se NE dira:
--   7f8998e3… = Kokina `Financije` → Saša (write). To je ono što tebi daje
--   pristup njenoj arei s tvog računa i trebat će ti pri testiranju.
