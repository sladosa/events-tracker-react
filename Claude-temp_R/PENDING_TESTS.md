# Pending Tests

**Zadnja izmjena:** 2026-03-25 (S25)
**Branch:** test-branch
**Detalji testova:** `Claude-temp_R/test-sessions/S25_tests.md`

---

## Aktivni (nepotvrđeni) testovi

| ID | Opis | Sesija | Detalji |
|----|------|--------|---------|
| T-S25-1 | Import Area-only → result summary vidljiv, nova Area u filteru | S25 | [S25_tests.md](test-sessions/S25_tests.md#t-s25-1) |
| T-S25-2 | Leaf bez evenata → badge "no events yet" vidljiv u tabeli | S25 | [S25_tests.md](test-sessions/S25_tests.md#t-s25-2) |
| T-S25-3 | Leaf s eventima → nema "no events yet" badge | S25 | [S25_tests.md](test-sessions/S25_tests.md#t-s25-3) |
| T-S22-T3 | Delete Area (prazna) — nikad potvrđeno | S22 | [S22_tests.md](test-sessions/S22_tests.md#t3--delete-area-prazna) |

## Zatvoreni (potvrđeni/riješeni) testovi iz ove sesije

| ID | Opis | Sesija | Status |
|----|------|--------|--------|
| T-S24-1 | Import Area-only Excel reda → kreira Area | S24 | ❌ → riješeno S25 |
| T-S24-2 | Add Child na leaf s eventima → orange blocked state | S24 | ✅ |
| T-S24-3 | Add Area UI → gumb u Edit Mode, modal, kreira area, refresh dropdown | S24 | ✅ |
| T-S24-5 | Regression: T4, T5, T9 i dalje rade | S24 | ✅ |

---

## Kako koristiti

**Testiranje:** Pokreni aplikaciju lokalno (`npm run dev`) i prođi kroz korake u linkovanim fajlovima.

**Sljedeća sesija — javi rezultate:**
> "T-S24-1 OK, T-S24-2 OK, T-S24-3 fail, T-S24-5 OK"

Claude će: ažurirati ovaj fajl, označiti ✅/❌ u test-sessions arhivi, istražiti failove.

---

## Arhiva prethodnih sesija

| Fajl | Sesije | Status |
|------|--------|--------|
| [S01-S14_summary.md](test-sessions/S01-S14_summary.md) | S01–S14 | ✅ Sve verificirano |
| [S15-S21_tests.md](test-sessions/S15-S21_tests.md) | S15–S21 | ✅ Sve verificirano |
| [S22_tests.md](test-sessions/S22_tests.md) | S22 | ✅ Osim T3 (Delete Area) |
| [S23_tests.md](test-sessions/S23_tests.md) | S23 | ✅ Osim T11 (riješeno S24) |
| [S24_tests.md](test-sessions/S24_tests.md) | S24 | ⏳ Pending |
