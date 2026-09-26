> Pisano protiv commita **`d9cb82c`** (S152) + commit S152 koji nosi ovaj file (samo docs).
> ⚠ Ako `git log` pokazuje noviji commit od S152 handoffa, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S152 (2026-09-26)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

Sažetak za tebe: **`docs/sessions/BACKLOG_2026-09-26_S152.md`** (nova verzija backlog sažetka).

1. **Structure uvoz** više ne javlja lažne promjene. Usput zatvorena i opasnija rupa: upis nove
   vrijednosti kroz „Other" brisao je ostale postavke polja (npr. zadani `Planiran` na `Status`u).
2. **Alat za Structure file** sam staje nad postojećom `Financije_all` — nema više „ne smiješ ga pokrenuti".
3. **Razvrstač izvoda:** `Financije\run.bat razvrstaj_izvode.py [--apply]` uzima iz Kokinog
   OneDrive inboxa i imenuje po sadržaju. Kokina mapa se ne dira.
4. **Rate:** Visa kupljena 1.–3. u mjesecu dobije prvu ratu isti mjesec (kao banka).
   **Edit:** promjena datuma retku s `Racun`/`Cash` pomakne i `Datum naplate`.
5. **Usput:** filtar „This Month" je rezao zadnji dan mjeseca (danas 31.08. → 29.09.) — popravljeno.

⚠ **C3 je napravljen uže od tvoje odluke** (kartice bez žiga nisu uključene, a žig se ne provjerava)
— v. §2 sažetka; ostaje kao **C3b**.

## Što treba od tebe / Koke

- **Ti: 7 ručnih testova S152** (`docs/sessions/PENDING_TESTS.md`, koraci u `tests/S152_tests.md`).
  Kad prođu → merge na `main` (naredbe u CLAUDE.md, § End of session 11).
- **Ti: odluka za C5** — config trake: (a) prvo `Dashboard` sheet, ili (b) traka odmah + jednokratni
  SQL koji pokrećeš ti (moj prijedlog).
- **Ti: C3b** — slažeš li se da „žig izvoda" ide u config pravila (kolona u `Automations` sheetu)?
- Iz S150, neprovjereno: Koka — OneDrive app na mobitelu + ✕ na OneDrive Desktopu; ti — RF gotov
  PDF izvod, novi Garmin export.

## Redoslijed — što slijedi

1. **C5** faza 1 („Dospjelo → potvrdi", samo čitanje, MC) — nakon tvoje odluke o configu.
2. **C3b** — žig izvoda.
3. **C1 korak 4** — obrada izvoda jednom naredbom (kad stigne prvi pravi izvod kroz inbox; spec prvo).
4. B3, B4+F7, B5, B6, C4, D2/D4/D5, F4, F5; zatim `trening.xlsm`.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `515df05` (S149). `test-branch` = S152, **7 commitova ispred** (`efbf727`…`d9cb82c` + docs).
Deploy **nije** tražen — ništa od S152 nije na PROD-u.

## Novo u S152

- `src/lib/validationRules.ts` — **jedini** graditelj `validation_rules` (`buildRules`, `sameRules`,
  `addOptionToRules`, `renameDependsOnParent`). `src/lib/pendingOptions.ts` — jedna kopija „Other".
- `src/lib/localDate.ts` — `localYmd` / `todayLocalYmd`.
- `rataAutomation.findChargeDateRule` + `generateRataChargeDates(..., attributeRules)`;
  `attributeRules.shiftSameDayTarget`; `EditActivityPage.sameDayBaseRef`.
- Izloženo za testove: `structureExcel.buildAttrRows`, `structureImport.buildValidationRules`.
- Testovi: `validationRules`, `rataChargeDates`, `shiftSameDayTarget`, `localDate` (sam postavlja
  `TZ`); `ruleManagedAttrs` sada **bundla** (`attributeRules` uvozi `localDate`).
- Alati: `Financije/razvrstaj_izvode.py` (novo); `make_financije_all_structure.refuse_if_area_exists`.

## Otvoreno

- **C3b** (Sašina odluka iz prolaza): pomak `Datum naplate` u Editu za **sve** retke **bez žiga**
  (i kartice), ožigosan se ne dira. Žig iz configa (npr. `lock_slug` na pravilu + kolona u
  `Automations` sheetu), nikad `izvod_opis` u kodu. `shiftSameDayTarget` je mjesto; derived-provjeru
  (target == pravilo(stari datum)) zadržati.
- **C5**: čeka odluku o configu. Ako (b): RPC `053` na TEST puštam sam (`SUPABASE_DB_URL`, pooler),
  PROD i config pušta Saša. Provjeriti da Structure uvoz **ne briše** `settings.dashboard.*.due`.
- `DEBUG — remove after S21` log `[Import dirty]` u `structureImport.ts` i dalje živi — koristan za
  T-S152-1 ako padne; maknuti nakon.
- ⚠ **Python heredoc na Windowsu:** `\\r` u tekstu je jednom postao CR (pokvaren `BACKLOG.md`), a
  `„…"` navodnici ruše jednoredne stringove. Za veće izmjene docs-a piši skriptu u scratchpad fileu,
  pokreni s `python -X utf8`, i poslije skeniraj izmijenjene fileove na `\r` bez `\n`.
- Iz S149/S150 i dalje: 1 loš par `Hlace i carape`, rata `117,32` (19,57/19,55), MC `±105,30`
  `Planiran` (B5); E8-2 treba trace; razvrstač imena `PBZVIZA_` ostavio (alati čitaju oba).
