# S194 — testovi (2026-11-06)

Deploy S185–S193 na PROD (backup `2026-11-06_1345`, `059`/`060`, `SCHEMA_PROD.sql` = baza) i alati mjesečnog
kruga. Svaka promjena alata je izmjerena na TEST-u **usporedbom stare i nove verzije** nad stvarnim izvodima
2026. (razlike su nabrojane u `docs/FINANCIJE_PROCES.md` §4) i čuvaju je samoprovjere:

    python data-prep_tools/Financije/_zaba_spajanje.py --test        (19, sabotaže padaju 7 / 1 / 2)
    python data-prep_tools/Financije/visa_uvoz_izvoda.py --test      (6, sabotaža pada 2)

Ovdje su provjere koje se dogode same u **prosinačkom krugu** — bez posebnog sjedenja.

---

## T-S194-1 ⬜ ZABA izvod 11/2026 (T45)

**Preduvjet:** `ZABA_2026-11.pdf` stigao, delta sheet ZABA izvezen (PROD).

1. `fill_from_izvod.py <delta> --zaba ZABA_2026-11.pdf --dry`.
2. **Očekivano:**
   - storno s izvoda (iznos s minusom), ako ga ima ⇒ redak `≈ … (STORNO)` „isti redak u bazi na …" — ne `+` u „Za upis";
   - stavka plaćena s računa a upisana kao kartica (Mastercard bez žiga, isti iznos isti dan) ⇒ odjeljak
     „MOŽDA KRIVO MJESTO" s `→ PREMJEŠTENO na račun`; u fileu taj redak `Izvor = Racun`, `Status = Izvrsen`;
   - zbirni redak „ZABA izvod: N novih, M već na listu …" — N jednak broju `+` redaka.
3. Uvoz ⇒ `promet_check` 2026-11 ✓ (Δ 0,00).

**Pad:** storno u „Za upis" kao `Isplata −…` (stari alat); kartični redak „već na listu" i Δ = njegov iznos.

## T-S194-2 ⬜ MC izvod 11/2026 (T47)

**Preduvjet:** `MC_2026-11.pdf`; Koka je u zadnja dva dana izvoda kupovala karticom (vjerojatno).

1. `fill_from_izvod.py <delta> --mc MC_2026-11.pdf --presedan prod --dry`.
2. **Očekivano:** u „U KOŠARI 2026-12-11, IZVOD IH NE POTVRĐUJE" kupnje s kraja izvoda nose
   `→ POMAKNUTO u košaru 2027-01-11`, u ISPRAVCIMA „kupnja s kraja izvoda … (T47)"; KONTROLA ✓ u cent.
   Stavka starija od zadnja 2 dana i dalje nudi `--brisi=` (to je pravi višak ili krivo mjesto).

**Pad:** kupnja od zadnjeg dana izvoda nudi `--brisi` (stari alat) ili KONTROLA ✗ za njen iznos.

## T-S194-3 ⬜ Visa izvod 11/2026 (T41, T44)

1. `visa_uvoz_izvoda.py PBZVISA_2026-11.pdf` (prije ili poslije naplate).
2. **Očekivano:** broj u „ISPRAVCI (n)" = broj redaka ispisanih ispod; ako je iznos u bazi drukčiji od
   banke (≤ 15 %) a isti dan, redak je ISPRAVAK „iznos X → Y (banka)", ne NOV + višak u košari.

## T-S194-4 ✅ T40 na PROD-u (Saša, 06.11.)

Structure Export (Koka) → `Automations` → `DateMap` `Visa=cutoff:3:5` → `cutoff:2:5` → Import: Automations 1, ostalo 0.
Add: 02.11. + Visa → `Datum naplate` 05.11.; 03.11. → 05.12. ✅

## T-S194-5 ⬜ (PROD, poslije deploya) Čip „saldo na dan" (T46)

1. Overview `Financije_all` → u filtru `To` upiši neki prošli dan (npr. 01.11.).
2. **Očekivano:** uz naslov „Stanje po računu" žuti čip **„na dan 01.11.2026. · Custom ↺ This Year"** (vidljiv i kad je
   pločica sklopljena). Klik na „↺ This Year" ⇒ čip nestaje, Period = This Year, saldo današnji.
3. This Year (zadano): čipa nema.

**Pad:** nema čipa (stari bundle — Ctrl+Shift+R) ili gumb ne vraća This Year.

## T-S194-6 ⬜ (PROD, prvi uvoz izvoda poslije deploya) „older records" bez rata (T42)

1. Uvoz filea iz `fill_from_izvod --mc` / `visa_uvoz_izvoda` (ispravci, rate s danom kupnje).
2. **Očekivano:** u crvenom okviru „N existing events will be modified" **nema** retka „N of them are older records" za
   rate kojima se mijenja samo `Izvod opis` / `Datum naplate` / `Status`; umjesto toga sivi redak „N older records change
   only what the bank statement confirms …". Ako se starom retku mijenja iznos ili Tip — crveni redak ostaje.
