> Pisano protiv commita **S168 ritual** na `test-branch` (zadnji commit = „S168: ritual …").
> **`main` = `45087b7` (deploy 08.10.)** — **S168 mijenja app kod ⇒ čeka deploy** (Saša).
> **PROD baza (S167, 11.10.):** R3 ✓ · `Popravci, održavanje` ✓ · `056` ✓ · razrez + This Year ✓.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S167 + S168 (2026-10-11, isti razgovor)

> **Ukratko (S168):** Rata modal sada ostatak zaokruživanja stavlja kao banka — kod Mastercarda na zadnju ratu, kod Vise na prvu — pa se MC planovi s izvodom slažu u cent; lista više ne pokazuje transakcije bez iznosa dok se postavke Aree učitavaju (Kokin nalaz s mobitela, mehanizam potvrđen testom), a sve čeka deploy.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno

- **S167 (PROD baza):** osiguranje kuće svoj Podtip, `Popravci, održavanje`, pločica „Kamo ide
  novac" i This Year rade na PROD-u (ti i Koka vidjeli).
- **S168 (kod, još nije na PROD-u):**
  - MC rate iz appa slažu se s bankom u cent (zadnja rata nosi ostatak, kao kod banke).
  - Lista više ne pokazuje transakcije bez iznosa na sporom mobitelu — pričeka svoje kolone.
  - Sitan popravak: lista ne može prikazati stari odgovor umjesto novog.
  - **Traka „Čeka potvrdu“ prvo pita** „Je li banka skinula 1.189,34 €?“ — kad se slaže, Koka samo
    dodirne dan (odluka D7). Tipka samo kad je iznos ili dan drukčiji.

## Što treba od tebe

1. **T-S168-1/2 na TEST-u** (5 min; T-S168-5 traku prati Koka na PROD-u 11.11. ili TEST ako ima košaru): probni MC plan 55,45 / 3 rate ⇒ modal 18,49 · 18,49 · 18,47
   „Zadnja rata…"; Visa 37,48 / 3 ⇒ 12,50 · 12,49 · 12,49; Structure export ima kolonu `Remainder`.
2. **Deploy** kad testovi prođu (PowerShell blok iz CLAUDE.md § End of session 11), zatim
   `set_rata_ostatak_S168.py --apply --yes-prod` (T-S168-3). Koka nakon deploya: zatvoriti i
   ponovo otvoriti app.
3. **Koka:** MC potvrda u traci kad naplata sjedne u banci (11.10. još nije); ZABA tada ≈ 11.257,88.
4. **Odluke T33–T36** (`docs/FINANCIJE_PROCES.md` §4) — s Kokom na laptopu. **~03.11.** Visa izvod.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` ispred `main` za S167 (samo docs/alati) i **S168 (app kod)**.
- TEST: `automations.rata.remainder_map = {Mastercard: last, Visa: first}` upisan.
- `npm run check` ✓, build ✓, E2E S121/e16/S165/S119/S168 10/10.
- ⚠ Klasifikator blokira i **dry run** PROD alata — PROD naredbe idu Saši (`cd …\data-prep_tools`, `.\`).

## Otvoreno — kod (po prioritetu iz plana S167)

1. **Lazy Plotly** (4,9 MB, Kokin spori mobitel; na uskom ekranu kruga ni nema) — izmjeriti
   prije/poslije. ⚠ `clearChainCache` ovisi o tome da rute nisu lazy (CLAUDE.md § UI, S133).
2. **Filtar predug na malom ekranu** — prvo razgovor o obliku (sam se sklopi / sažetak u redu).
3. **Filtar `depends_on` atributa kao izbornik** grupiran po roditelju (Backlog S167).
4. **T21** guard „potvrđeno razdoblje" za kartične retke; **F5** (`groupings` kroz Structure
   Excel); Visa u traku (T2, prije ~05.11.); alati T4, T13–T18.
