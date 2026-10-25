> Pisano protiv `1ed9798` (S181, = `main` od 25.10.) + commita koji nosi ovaj file (S182, 25.10., samo docs).
> **`main` = `1ed9798` — deploy S181 na PROD-u od 25.10. (Saša), potvrđen u bundleu.** `test-branch` = `main` + docs S182.
> **PROD:** Namjena je atribut br. 8 (odmah ispod Podtipa), Izvod opis … Valuta 9–16 (Structure uvoz pod Kokom, 25.10.).
> **TEST:** isti redoslijed; inače kao PROD, osim tri stare razlike u atributima (TEST `is_required` Racun/Izvor = false,
> opis Namjene) — za PROD uvoz Structure file uvijek iz PROD exporta.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S183) — prekidač Bucketi | Namjena na pločici „Kamo ide novac"

> **Ukratko (S182):** deploy S181 potvrđen na PROD-u — Excel izbornici Namjene i Podtipa rade, a Excel uvoz praznoj Namjeni upisuje zadanu — Koka je delta exportom našla krivu transakciju od 9,55 € i saldo se poklopio s bankom, a Namjena je u formi, Viewu i Excelu bez profila sada odmah ispod Podtipa (izmjereno na TEST-u, pa Structure uvozom na PROD-u, kontrolne brojke iste).

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S182)
- Deploy S181 radi na PROD-u: Excel izbornik Namjene nudi namjene (ne Podtipove), Podtip pod `auto C5` ima izbornik,
  a novi redak iz Excela s praznom Namjenom dobije Zajedničko / Koka / Saša po pravilu.
- Kokin saldo: delta export je našao krivu transakciju (9,55 €), ispravljeno, saldo = banka.
- Namjena je u formi i u Viewu odmah ispod Podtipa. Kokin Excel se nije promijenio (profil ionako tako slaže).
- Usput naučeno: novi retci za **tvoj** račun (RF) uvoze se pod **tvojim** računom — pod Kokinim se preskoče
  (e-mail u koloni G = autor; tuđi novi redak se ne upisuje).

## Plan S183: prekidač **Bucketi | Namjena** na „Kamo ide novac"
Prvo razgovor (odluke), pa kod. Pitanja za tebe (i možda Koku):
1. **Bucketi „Koka razno" / „Saša razno"** — s Namjenom je to ista podjela dvaput. Ostaju, spajaju se u jedan
   „Razno", ili se Namjena prikazuje samo kao drugi pogled?
2. **„Nena / Kućište" na strani Prihoda** — kako izgleda u pogledu po Namjeni (prihod iz Neninog fonda)?
3. **Krug na velikom ekranu:** unutra Namjena, vani Tip (prijedlog §8.3) — ili vani bucket?
4. Uz isti zahvat (BACKLOG): **os datuma kupnja/naplata samo gdje ima smisla** (na Prihodima ne mijenja ništa).

## Što treba od tebe (izvan S183)
- **Studeni** (nepromijenjeno): T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3 ZABA_2026-10,
  uz njih T-S181-3 (alati ispisuju redak `Namjena [PROD]: …`).
- T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti), Garmin izvoz.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S182) — bez koda
| Što | Dokaz |
| --- | --- |
| deploy S181 | PROD bundle: `ExcelImportModal-*.js` nosi „Zadano iz pravila…", `excelDataLoader-*.js` `Dep_${…}` |
| T-S181-2 ✅, T-S181-4 ✅ | PROD ručno (Saša); retci provjereni čitanjem (`Claude-temp_R/s182/find_955.mjs`) |
| `sort_order` Namjena 16 → 8 | TEST: Structure uvoz kroz app `Attributes updated 9`; izvozi s profilom = 0 razlika (ćelije, stupci, formule, DV, imena); bez profila samo redoslijed; uvoz nepromijenjenih (i starog filea) `0 · 0`; kontrola ISTA. PROD: kopija PROD exporta s 19 ćelija `Sort` (`peek_structure.mjs --set`, `cell_diff.mjs`), uvoz pod Kokom `9`, kontrola prije = poslije |
| alati | `Claude-temp_R/s182/` (`structure_export.mjs`, `structure_import.mjs`, `peek_structure.mjs`, `cell_diff.mjs`, `layout_cmp.mjs`, `defs_cmp.mjs`, `form_shot.mjs`, `sort_any.mjs`, `rf_check.mjs`) |

## S183 — gdje početi
- Spec: `docs/RAZREZ_SPEC.md` (R5 ✅ „da" S164, DIO 2 = model/RPC/pločica, §17 odstupanja), `docs/PREUREDJIVANJE_SPEC.md`
  §8.3 (prijedlog prikaza), BACKLOG „Razrez: prekidač…" i „os datuma…".
- Kod: `src/lib/breakdownModel.ts` (JEDINI izračun; razine su par `[tip, podtip]`, bucketi iz `groupings`),
  `src/components/overview/BreakdownTile.tsx` (+ `BreakdownSunburst.tsx`, `lastView` u modulu), RPC `rpc_area_breakdown`
  (`sql/056`, granice UKLJUČIVE). Test `breakdownModel.test.mjs` (stvarna snimka = RAZREZ §4.3).
- ⚠ Treba li RPC-u treća razina (`namjena`)? Ako da — nova migracija (PROD redoslijed: migracija → deploy → config).
  Prije toga izmjeriti može li se Namjena dobiti iz postojećeg odgovora.
- ⚠ Config novog oblika pločice ide na PROD **tek poslije deploya** (stari bundle crta „Nepoznat tip pločice").
- Preduvjet ispunjen (S181): alati za izvode i Excel uvoz upisuju Namjenu na nove retke ⇒ Namjena prazna samo
  ako je netko obriše. Izmjereno 22.10.: Zajedničko 4.420 · Saša 548 · Koka 471 · Nena / Kućište 16.

## Otvoreno (nepromijenjeno iz S181)
- **Planer i lista `depends_on` pod `*`** (spec §20) — mina naoružana; prije idućeg preuređivanja Namjene sheetom.
  Dotad Namjenu mijenjati samo po retku (Edit / Excel uvoz).
- Pravila po trgovcu ne znaju Namjenu (ENRICH_PLAN S181). · F1b popis operacija s Poništi; brisanje opcije s
  retcima u Structure uvozu ⇒ upozorenje (§17).
- Ostalo po prioritetu: O6 traženje u izborniku · Trening F2 · pregled razlika prije Structure uvoza · S173/S172 sitnice
  (v. DONE_HISTORY S181 handoff).
