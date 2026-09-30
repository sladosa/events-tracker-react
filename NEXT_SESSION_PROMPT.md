> Pisano protiv commita **`d035725`** (S154) + commit S155 koji nosi ovaj file (kod + docs, samo `test-branch`).
> ⚠ Ako `git log` pokazuje noviji commit od S155 handoffa, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S155 (2026-09-30)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

1. **Edit čuva bankine datume (C3b).** Redak potvrđen izvodom (`Izvod opis` popunjen) više ne
   mijenja `Datum naplate` kad mu promijeniš datum — i Edit kaže zašto. Neožigosani kartični
   retci sada prate datum (nova košara).
2. **Edit upozorava kad diraš podatak iz banke (C3c).** Na potvrđenom retku promjena datuma,
   iznosa, računa, Izvora, Statusa ili datuma naplate traži kvačicu „izvod je bio krivo
   upisan". Tip, Podtip i opis se mijenjaju slobodno.
3. **Traka „Čeka potvrdu" na Overviewu (C5, faza 1).** Dospjele Mastercard košare, Σ i polje
   „banka skinula" s ✓ / razlikom. Zasad samo usporedba — ništa se ne sprema.
4. **Tri kvara nađena tvojim testiranjem, popravljena:** `NaN` u Editu nakon brisanja dana u
   datumu; godina sa 6 znamenki (Edit i filtar); View koji je nakon spremanja pokazivao staru
   vrijednost (baza je bila ispravna).
5. `sql/053` + `054` su na PROD-u (pustio si ih; izmjereno da vraćaju točno predviđeno).

## Što treba od tebe / Koke

- **Ti: merge na `main`** (naredbe u završnoj poruci S155) — tek tada traka i žig rade na PROD-u.
- **Ti, nakon deploya (T-S155-7):** `Financije_all` → Overview → traka mora pokazati
  `07.09. Σ 105,30` i `12.09. Σ −105,30` (poznati par ±105,30 — ispravak ide kroz B5).
- **11.10.:** prva prava MC košara (38 stavki, ~859,58) — Koka upiše što je banka skinula.
- **Koka (kad se vrati):** T-S154-2 (reagira li `+` iz prve na iPhoneu); T-S152-7 kad stigne izvod.

## Redoslijed — što slijedi

1. Merge + T-S155-7 · T-S154-2 · T-S152-7.
2. **B5** (par ±105,30 — traka ga sad pokazuje svaki dan dok se ne riješi; rata 117,32; `Hlace i carape`).
3. **C5 faza 2** (`Potvrdi` + skupni `Racun` redak, samo Koka) — nakon što 11.10. prođe kao usporedba.
4. **K-1** (brana na Structure uvozu) · **F5** (`Dashboard` sheet — `due` blok ne putuje Excelom).

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `d74c084` (S154). `test-branch` = S155 (kod + docs), **nije mergeano**.
`sql/053` + `054` pušteni na **TEST i PROD**; `SCHEMA_TEST.sql` i `SCHEMA_PROD.sql` osvježeni (jedina
razlika: `rpc_area_due_baskets`).

## Novo u S155

- `attributeRules.shiftDerivedTarget` (zamijenio `shiftSameDayTarget`) — `{ value } | { locked } | null`.
- `AttributeRuleConfig.lock_slug`; `structureExcel` kolona `LockAttr` (zadnja); `structureImport.resolveLockSlug`.
- `confirmedRowEdit.ts` (`bankFieldSpec`, `rowConfirmation`, `passesFilters`, `bankFieldChanges`,
  `canonValue`, `changesSignature`); Edit: `originalValues` snimka pri loadu, `bankAckFor` otisak.
- `DueConfig` na `BalanceByGroupWidget.due`; `overviewApi.fetchDueBaskets` (šalje `p_tz` iz
  preglednika); `dueBaskets.ts`; `DueStrip.tsx` u `OverviewTab` (Fragment iznad pločice).
- `dashboardConfig` rename/refs sada pokrivaju `split.due_slug` i `due.*`.
- `dateInput.ts` (Add + Edit zaglavlje, filtar `From`/`To`); `DateRangeFilter` crveno + revert na blur.
- `activityViewCache.clearActivityViewCache()` — prvi efekt `ViewDetailsPage`.
- Testovi: `shiftDerivedTarget` (19), `confirmedRowEdit` (28), `structureLockAttr` (6),
  `dueBaskets` (10), `dateInput` (17) — svaki sabotiran.

## Otvoreno

- **Excel guard (S143) i kolona `Potvrda`** primjenjuju sidro i na kartične retke — Edit od S155 ne
  (`passesFilters`). Poravnati (pravilo je opet na dva mjesta).
- **Rename sluga** ne popravlja `attribute_rules` (`target_slug`/`map_slug`/`lock_slug`).
- **Edit prikazuje `datetime` atribut u UTC satu** (`12:00`), View lokalno (`14:00`); rub UTC ≥ 22 h ⇒
  drugi dan, a C3c bi prijavio lažnu promjenu. Pravila/uvoz takve vrijednosti ne pišu.
- `BUG-S131-VIEWSTALE` je vjerojatno bio isti keš — ako se javi nakon S155, pretpostavka je pala.
- C5 faza 1 nema drill (filtar nosi jedan uvjet, košara traži dva).
- Pomoćne REST skripte (samo čitanje, TEST/PROD, `.env.local` = TEST sa service ključem) u
  scratchpadu S155 (`cfg.py`, `rpc.py`, `sim.py`, `row.py`), nisu u repou. SQL na TEST: `psql`
  (`C:\Program Files\PostgreSQL\17\bin`) + `SUPABASE_DB_URL` iz `.env.local`.
- Iz ranije: K-1, K0; C1 korak 4; B3–B6; C4; E8-2.
