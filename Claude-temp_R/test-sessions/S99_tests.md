# S99 Test Details — Delete Area fixes + Financije PROD reorganizacija

**Branch:** test-branch
**Datum:** 2026-06-25

---

## T-S99-1: Delete Area (no events)
**Preconditions:** PROD baza, Financije_old area (pre-2026 podaci, nema aktivnih eventa vidljivih kroz RLS)
**Steps:**
1. Structure tab → Edit Mode → Financije_old ⋮ → Delete
2. Modal prikazuje "0 events" ili "allowed" state
3. Klikni Delete
**Expected:** Area obrisana bez greške
**Status:** ✅ (obrisana bez problema)

## T-S99-2: Delete Area (with events) — "Delete without backup"
**Preconditions:** Area s eventima, dev server aktivan
**Steps:**
1. Structure tab → Edit Mode → Area s eventima ⋮ → Delete
2. Modal prikazuje amber header s event countom
3. Vidljiv "Delete without backup" tekst link između Cancel i "Download Backup & Delete"
4. Klikni "Delete without backup"
**Expected:** Area obrisana, backup se NE skida
**Status:** ⬜

## T-S99-3: Delete Area — backup je area-scoped
**Preconditions:** PROD baza, Financije area s 1 eventom
**Steps:**
1. Structure → Delete Financije → "Download Backup & Delete"
2. Backup xlsx se skine
**Expected:** Filename = `backup_Financije_YYYYMMDD_HHMMSS.xlsx`, sadrži samo Financije evente (ne Garmin, Health itd.)
**Status:** ✅ (skinuo backup_Financije_20260625_121430.xlsx, samo Financije podaci)

## T-S99-4: Backup xlsx scope verification
**Preconditions:** Skinuti backup iz T-S99-3
**Steps:**
1. Otvori xlsx
2. Events sheet — samo Financije eventi
3. Structure sheet — samo Financije struktura
**Expected:** Nema podataka iz drugih Area (Fitness, Health...)
**Status:** ✅ (verificirano u xlsx)

## T-S99-5: Financije PROD SQL delete
**Preconditions:** PROD Supabase SQL Editor, Role: postgres
**Steps:**
1. Pokreni 029_delete_financije_prod.sql
**Expected:** "Success. No rows returned" — svih 2118 eventa + struktura obrisani
**Status:** ✅

## T-S99-6: Financije_old import na PROD
**Preconditions:** PROD baza, Financije obrisana, TEST export za pre-2026 podatke
**Steps:**
1. Import xlsx s Financije_old podacima (pre-2026) na PROD
2. Koka dobije read-only invite
**Expected:** Area "Financije_old" vidljiva na PROD-u, Koka ima read pristup
**Status:** ✅

## T-S99-7: Koka importa Financije (2026+)
**Preconditions:** Koka ima PROD account, TEST export za 2026+ podatke
**Steps:**
1. Koka importa Financije xlsx (This Year) na PROD
2. Koka je owner, Saša dobije invite (write?)
**Expected:** Area "Financije" na PROD-u, Koka = owner
**Status:** ⬜ (čeka Koku)

## T-S99-8: Error poruka detalji
**Preconditions:** Delete modal s greškom
**Steps:**
1. Probaj obrisati Area koja ima skrivene evente (RLS)
2. Error se pojavi u modalu
**Expected:** Prikazuje `[step] code — message — details` format, ne samo "Bad Request"
**Status:** ✅ (vidjeli `[delete categories] P0001 — Cannot delete category "Transakcija" because it has 2118 event(s)...`)
