-- ============================================================
-- 043 — Vlasnik Aree smije ISPRAVITI grantee-jev redak (ne obrisati)
-- ============================================================
-- Sasina odluka, S123: Koka je vlasnica `Financije_all`, Sasa upisuje kroz UI.
-- Kad ona primijeti pogresku na njegovom retku, danas nema sto napraviti:
--   * Excel put ne postoji  — "Import as mine" NE mijenja redak nego forsira
--     INSERT s novim ID-em (excelImport.ts:443) => duplikat, original ostaje;
--   * UI put ne postoji     — D4 gate skriva Edit i Delete za tudji redak;
--   * a i da ga otvorimo, RLS bi ga zaustavio: 020_orphan_rls.sql nosi
--     WITH CHECK (auth.uid() = user_id), pisan za PREUZIMANJE siroceta, pa
--     vlasnica tudji redak moze samo uzeti sebi, ne ispraviti.
--
-- ⚠ SAMO UPDATE. Brisanje tudjeg retka ostaje skriveno u UI-ju (Sasina odluka):
--   ispravak detalja je ono sto joj treba, a brisanje nema povratka. RLS DELETE
--   iz 020 se NE dira — nije se ni koristio kroz UI, sluzi ciscenju sirocadi.
--
-- ⚠ AUTORSTVO SE NE MIJENJA. `user_id` ostaje na onome tko je redak unio, inace
--   bi `User` kolona tvrdila da je Koka upisala ono sto je upisao Sasa.

-- ── 1. Tko je zadnji dirnuo redak ───────────────────────────────────────────
-- `edited_at` vec postoji i app ga pise; falio je samo TKO. Bez toga je
-- ispravak vlasnice NEVIDLJIV granteeju — a nevidljiva izmjena tudjeg zapisa je
-- gore od nemogucnosti da se ispravi.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.events.edited_by IS
  'Tko je zadnji spremio izmjenu. NULL = od zadnjeg uvoza/unosa nitko, ili je '
  'redak stariji od 043. Prikazuje se samo kad se razlikuje od user_id.';

-- ── 2. events: vlasnik Aree smije UPDATE uz nepromijenjeno autorstvo ────────
DROP POLICY IF EXISTS "events_update_by_area_owner" ON public.events;
CREATE POLICY "events_update_by_area_owner" ON public.events FOR UPDATE
USING (
  auth.uid() = user_id
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  -- ⚠ Ovo je prosirenje u odnosu na 020: prije je redak nakon UPDATE-a morao
  --   pripasti pozivatelju (dakle samo preuzimanje). Sada vlasnik Aree smije
  --   ostaviti tudje autorstvo. Da prosirenje ne bi usput dopustilo i
  --   prepisivanje autorstva na TRECEGA, cuva ga trigger ispod.
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ── 3. `user_id` se smije mijenjati SAMO u preuzimanje ──────────────────────
-- Invarijanta, ne disciplina: WITH CHECK vidi samo NOVI redak, pa u njemu nema
-- nacina reci "autorstvo se nije promijenilo". Trigger vidi i stari.
-- ⚠ Za `service_role` je `auth.uid()` NULL => uvjet je NULL => iznimka se ne
--   podize. Migracije i SQL editor time i dalje mogu preraspodijeliti retke.
CREATE OR REPLACE FUNCTION public.guard_event_author_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION
      'Autorstvo retka (user_id) smije se promijeniti samo u preuzimanje na vlastiti racun.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_event_author ON public.events;
CREATE TRIGGER guard_event_author
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_author_change();

-- ── 4. event_attributes: isti zid, i lako ga je zaboraviti ─────────────────
-- ⚠ Popravi li se samo `events`, event se spremi a atributi NE — RLS-blokiran
--   write "uspije" s 0 redaka, pa redak ostane polovicno spremljen i izgleda
--   uredno. Zato oba u istoj migraciji.
DROP POLICY IF EXISTS "event_attrs_update_by_area_owner" ON public.event_attributes;
CREATE POLICY "event_attrs_update_by_area_owner" ON public.event_attributes FOR UPDATE
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ── 5. event_attributes INSERT ─────────────────────────────────────────────
-- ⚠ Edit tok BRISE pa PONOVNO UPISUJE sve atribute retka
--   (EditActivityPage.tsx:940-966). Bez ove grane bi Kokin ispravak Sasinog
--   retka pao na INSERT-u, i to nakon uspjesnog DELETE-a — dakle redak bi ostao
--   BEZ IJEDNOG ATRIBUTA. Zato INSERT mora proci, ali samo pod autorstvom
--   vlasnika eventa: inace bi svaki ispravak prebacio SVE atribute (i one koje
--   nitko nije dirao) na onoga tko je ispravljao.
DROP POLICY IF EXISTS "event_attr_insert" ON public.event_attributes;
DROP POLICY IF EXISTS "event_attributes_insert" ON public.event_attributes;
CREATE POLICY "event_attr_insert" ON public.event_attributes FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE e.id = event_attributes.event_id
      AND a.user_id = auth.uid()
      AND e.user_id = event_attributes.user_id
  )
);
