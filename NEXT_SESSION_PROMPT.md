> Pisano protiv commita **`d345f16`** (S153) + commit S153 koji nosi ovaj file (docs + komentar).
> ⚠ Ako `git log` pokazuje noviji commit od S153 handoffa, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S153 (2026-09-27)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

Testirao si S152 na TEST-u; **3 od 7 testova prošla** (T-S152-1, -2, -3). Usput:

1. **Structure uvoz** je nad nepromijenjenim fileom javljao `List columns changed 1` — popravljeno
   (baza preslaže redoslijed polja, uvoz ga je brojao kao promjenu).
2. **Okvir u Import Structure modalu** više ne tvrdi „ništa se ne briše" — izmjerio si da uvoz
   **briše opciju koje nema u fileu**.
3. **`*` u WhenValue** sada ima objašnjenje u panelu (ovisno o tipu polja) i u Helpu.
   Help stiže na PROD tek s deployem.
4. **Plan održavanja klasifikacije** (spajanje rijetkih / brisanje nekorištenih Tip/Podtip parova):
   `docs/KLASIFIKACIJA_ODRZAVANJE_SPEC.md` + Backlog. Tvoj nalaz je postao prva faza (**K-1**):
   Structure uvoz mora **upozoriti** kad briše opciju koja ima retke i **zaustaviti** grantee-ja.

TEST je počišćen (testni retci i opcije `TESTNOVO`/`TestB` obrisani, izmjereno).

## Što treba od tebe / Koke

- **Ti: ostali testovi S152** (`docs/sessions/PENDING_TESTS.md`, koraci u `tests/S152_tests.md`):
  - **T-S152-6** — „This Month" = 01.–30.09. (najbrže, bilo gdje)
  - **T-S152-4**, **T-S152-5** — rata i pomak `Datum naplate` u Editu (`npm run dev:prod`)
  - **T-S152-7** — kad Koka pošalje novi izvod
  Kad prođu → merge na `main` (naredbe u CLAUDE.md, § End of session 11). Time na PROD idu i
  S153 popravci + novi Help.
- Iz S152 i dalje otvoreno: **C5** odluka o configu, **C3b** žig izvoda (v. S152 dio u Backlogu).

## Redoslijed — što slijedi

1. Dovršiti testove S152 → merge.
2. **C5** faza 1 (nakon tvoje odluke) · **C3b**.
3. **K-1** (brana na Structure uvozu) — samostalno, ne čeka reklasifikaciju.
4. K0 inventar klasifikacije (samo čita) kad budeš spreman za Kokinu odluku.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `515df05` (S149). `test-branch` = S153; ništa od S152 ni S153 nije na PROD-u.

## Novo u S153

- `structureImport.sameJson` (+ `normalizeJson` rekurzivno kroz nizove) — `list_columns` i
  `add_header` usporedba. Test `structureListColumnsCompare.test.mjs`.
- `StructureImportModal` okvir; `StructureNodeEditPanel` natpis ispod WhenValue tablice po
  `attr.dataType`; `docs/help/structure.md` § `depends_on`.
- `[Import dirty]` log **ostaje namjerno** (komentar ispravljen) — ne micati po starom handoffu.

## Otvoreno

- **Prvi pokušaj T-S152-2 A** spremio `Status = Planiran` bez nove opcije; čisti ponovljeni put
  radi. Edit **nije** uzrok (izmjereno). Kandidati: promjena `Izvor`a između Confirma i Finisha
  (reset na `default_map`), ili Resume nacrta (pending opcije ne putuju s nacrtom). Ako se ponovi
  u radu — tražiti redoslijed klikova.
- ⚠ `persistPendingOptions` ne postavlja `updated_at` na `attribute_definitions` — ne koristiti
  tu kolonu kao dokaz upisa kroz „Other".
- Opcije po roditelju: `getOptionsForDependency` traži **točnim slovima**, `isDependencyHidden`
  **bez obzira na veličinu**. Danas ništa ne kvari; zapisano, nije dirano.
- K-1 mora pokriti i poznatu rupu S134: Structure file tuđe Aree ⇒ tihi duplikat Aree.
- Iz S152 i dalje: C3b, C5 (`053` RPC), Python heredoc oprez (skripta u scratchpadu, `python -X utf8`,
  sken na zalutali CR), `Hlace i carape`, rata `117,32`, MC `±105,30` `Planiran`, E8-2 trace.
- Pomoćne skripte za TEST provjere su u scratchpadu S153 (nisu u repou): REST preko
  `.env.local` (`SUPABASE_URL` + service ključ); embed `events→categories` traži filtar po
  `category_id` (dvosmislen embed daje HTTP 300).
