> Pisano protiv commita **`02c5f0d`** (S151) + commit S151 koji nosi ovaj file (samo docs).
> ⚠ Ako `git log` pokazuje noviji commit od S151 handoffa, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S151 (2026-09-26)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

1. **`docs/` pospremljen.** U korijenu je 15 dokumenata umjesto 28. Gotovo i zamijenjeno je u
   `docs/_archive/`, ono što čeka okidač u `docs/parked/`. Audit od 16.09. ostaje za usporedbu sa
   sljedećim auditom.
2. **Kokin dokument prepisan:** `docs/FINANCIJE_KOKA_PROCES.md`. Opisuje kako Koka radi danas
   (mobitel, Add/Edit, saldo) i cilj: plohu **„Raščišćavanje izvoda"** koja se otvara s Overview
   pločice. Tvoje odluke K1–K5 su upisane.
3. **CLAUDE.md je 30 % kraći** (3.152 → 2.189 redaka). Ništa nije obrisano: E2E zamke su u
   `e2e/CLAUDE.md`, pravila alata i Financija u `data-prep_tools/CLAUDE.md`, backlog u
   `docs/sessions/BACKLOG.md`. Skripta je dokazala da nijedan redak ne fali.

## Što treba od tebe / Koke (iz S150 — nije provjereno je li odrađeno)

- **Koka:** OneDrive na mobitel (bez backupa fotografija), ZABA izvod *Podijeli → OneDrive → Izvodi*.
- **Ti:** ima li RF aplikacija gotov PDF izvod; zatražiti novi **Garmin export**.
- **Koka:** crveni ✕ na OneDrive Desktopu (greška sinkronizacije).

## Redoslijed — što slijedi (dogovoreno S151)

1. **B1 + B2** — Structure uvoz: brojila koja broje neizmjene + alat koji briše podtipove
   (živa mina: `make_financije_all_structure.py` se ne smije pokretati dok ovo nije gotovo).
2. **C1** — izvodi od inboxa do žiga; prvi korak **razvrstač** (preimenovanje po sadržaju).
   Izvodi već stižu u OneDrive, pa je ovo najbliže Kokinom stvarnom radu.
3. **C2 + C3** — točni datumi rata; `Datum naplate` prati promjenu datuma u Editu.
4. **C5** — „Dospjelo → potvrdi", faza 1 (samo čitanje, MC). Nakon nje ploha za izvode (K3).
5. Ostatak B, C4 performanse, D-sitnice, F4 filtar za brojeve; zatim veliki projekt `trening.xlsm`.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `515df05` (S149 deploy). `test-branch` = S151 (samo docs; deploy ne treba).
Grana `claude-split` je mergeana i obrisana (lokalno i na originu).

## S151 promjene (bez koda aplikacije)

- Nove putanje: `docs/_archive/*`, `docs/parked/{RULES_ENGINE_SPEC,Analytics_tab}.md`,
  `docs/FINANCIJE_KOKA_PROCES.md` (bivši `KOKA_PRVI_MJESEC.md`), `docs/sessions/BACKLOG.md`.
- **Podmapni CLAUDE.md:** `e2e/CLAUDE.md`, `data-prep_tools/CLAUDE.md`. ⚠ Izmjereno da se **ne
  učitaju sami** kad se čita Bashom — Key docs zato nosi retke „prije rada na X pročitaj Y".
  Radiš li na testovima ili alatima, **pročitaj ih izravno**.
- `Tools/verify_claude_split.py <original>` — dokaz da selidba nije izgubila redak.
- K1–K5 (ploha izvoda): nova tablica stavki izvoda · Python parsira · C5 faza 1 prvo · kartice
  kao košara · potvrđuje vlasnica Aree. Spec plohe još ne postoji — piše se prije koda.

## Otvoreno — iz S149/S150, i dalje vrijedi

- ⭐ `make_financije_all_structure.py` **ne pokretati** dok taksonomija ne dolazi iz `--base` (B2).
- 1 loš par `Hlace i carape` `Razno / Poklon`; rata 1/6 `117,32` (atribut 19,57 / komentar 19,55);
  MC par `+105,30 / −105,30` `Planiran` — B5, jedan roundtrip.
- E8-2: treba trace pada, ne novu hipotezu.
- Razvrstač: testni ne-izvod leži u inboxu (PBZ „Detalji transakcije") — mora ga odbiti.
  Imena `PBZVISA_`/`PBZVIZA_` — razvrstač ih ujednačava.
- Preimenovanje `Financije_all` → `Financije`: odluka **nakon C1**.
- Daljnje smanjenje CLAUDE.md-a traži **sažimanje** priča uz pravila — sukob s „X ne skraćivati";
  samo uz Sašin pristanak, zaseban razgovor.
