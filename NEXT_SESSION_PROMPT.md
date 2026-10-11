> Pisano protiv commita **S167 ritual** na `test-branch` (zadnji commit = „S167: ritual …").
> **`main` = `45087b7` (deploy 08.10.)** — S167 nije mijenjao app kod, pa deploy ne treba.
> **PROD baza (11.10.):** R3 `Kuća / Osiguranje` ✓ · `Popravci, održavanje` (preimenovano, 128) ✓ ·
> `056` ✓ · config razreza + This Year ✓ ⇒ **pločica „Kamo ide novac" radi na PROD-u.**
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S167 (2026-10-11)

> **Ukratko (S167):** Pločica „Kamo ide novac" i zadano razdoblje This Year sada rade i na PROD-u — prije toga je osiguranje kuće dobilo vlastiti Podtip, a stari Podtip preimenovan u „Popravci, održavanje" alatom koji mijenja izbornik i svih 128 redaka odjednom; Mastercard naplata od 11.10. još nije skinuta, pa Kokina potvrda čeka.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S167

- Na PROD-u: osiguranje kuće je svoj Podtip, `Popravci, održavanje` bez „osiguranje",
  pločica „Kamo ide novac" i This Year. Vidjeli ste je ti (mobitel) i Koka.
- Četiri nove stavke u backlogu (v. DIO 2) — dvije s Kokinog mobitela.

## Što čeka

1. **Koka potvrđuje MC naplatu** kad je vidi u banci (11.10. je bila nedjelja, nije još skinuta):
   Overview → „Čeka potvrdu" → iznos i **bankin** datum → Potvrdi. Očekivano 55 stavki / 1.189,34;
   ZABA nakon toga ≈ 11.257,88 ako nema drugih promjena.
2. **Odluke T33–T36** (`docs/FINANCIJE_PROCES.md` §4) — kad sjednete s Kokom na laptop. Vide se samo na
   **All Time** (This Year je uredan): Investicije 9.543 € u `nesvrstano`, Pharmalog pod Medical_Koka,
   Triglav životno, N/A razvrstavanje.
3. **~03.11.** Visa izvod (T-S161-3, T-S158-4); prijedlog održavanja Financija prije ~05.11.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- Svi S165–S167 testovi ✅, sekcije preseljene u `DONE_HISTORY.md`, session fileovi arhivirani.
- Novi alat: `data-prep_tools/Financije/fix_kuca_popravci_S167.py` — predložak za preimenovanje
  opcije s retcima (CLAUDE.md § Model/atributi, „preimenovanje opcije u panelu mijenja samo izbornik").
- ⚠ Klasifikator od 11.10. blokira i **dry run** PROD alata — sve PROD naredbe idu Saši, s `cd` u
  `data-prep_tools` i `.\` ispred (memorija).

## Otvoreno — kod (backlog, S167 nove)

1. **Lista bez iznosa dok postavke Aree nisu stigle** (Koka, mali iPhone; hipoteza iz koda):
   `ActivitiesTable` → `resolveColumns(null)` = `DEFAULT_COLUMNS`. Lijek: `loadedFor` (razred
   BUG-S145-OVERVIEWTAB), ne crtati zadane kolone dok config za ovu Areu nije poznat.
2. **`useActivities.latestFetchIdRef = Date.now()`** — dva dohvata iste ms prođu guard. Brojač.
3. **Filtar `depends_on` atributa kao izbornik** grupiran po roditelju, `isExact`.
4. **Filtar predug na malom ekranu** — sam se sklopi / sažetak u jednom redu.

## Otvoreno — od ranije

- **T22** rata modal dijeli ostatak kao Visa i za MC (MC: zadnja rata, zaokruženo naviše) — traka ima
  toleranciju 0,00 ⇒ svaki MC plan s nedjeljivim iznosom iz appa odstupa za cent.
- **T21** guard „potvrđeno razdoblje" na uvozu pali i za kartične retke (lažna uzbuna).
- F5 (Structure Excel `AreaSettings`/`Grupiranja` — `groupings` još ne ide roundtripom), R5 „Čiji
  trošak", lazy Plotly (4,9 MB na Kokinom sporom mobitelu), E12-2 na TEST-u, `export_profiles` rename.
- Alati: T4 „jedna naredba obrade izvoda", T13–T18 (duplikati, rata nasljeđuje klasifikaciju…), Visa u traku (T2, ~05.11.).
