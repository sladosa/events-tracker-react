# ENRICH_PLAN — Izvod enrichment + keyword klasifikacija

**Napisano:** 2026-07-12 (S107c, Fable); **ažurirano 2026-07-14 (S107e)** — recovery pass
testiran i izvršen, RF pokrivenost kompletna (RBA_2026-05 stigao), finalni enrich re-run.
**Kontekst:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` (§6 klasifikacija, §12.5/§12.7).
**Cilj:** maksimalno smanjiti ručni rad u Tip/Podtip klasifikaciji `Financije_review_*.xlsx`
(3503 reda, ~2104 N/A) pomoću bankovnih izvoda + editabilnih keyword pravila.

---

## 1. Alati (svi u `data-prep_tools/Financije/`, status 2026-07-13)

Pokretanje: `Financije\run.bat <skripta.py> [args]` (ili direktno venv python, `PYTHONUTF8=1`).
**Review file mora biti ZATVOREN u Excelu.** Svaki alat radi backup prije snimanja Review filea.

| Alat | Status | Što radi |
| --- | --- | --- |
| `inventory_izvoda.py` | ✅ NOVO S107d | Sredi `izvodi/`: md5 dedup (→ `duplikati/`), klasifikacija PDF-a po SADRŽAJU (bez tekst-sloja → OCR vrha stranice), parse, rename `PREFIX_YYYY-MM.pdf` → `Analizirani_izvodi/`, piše **`izvodi/Izvodi_transakcije.xlsx`** (Transakcije + Manifest sheet, report pokrivenosti s rupama). **Md5 keš:** već parsirani fajlovi se ne parsiraju ponovno (bitno za OCR!). Idempotentno; `--dry` za probu. |
| `rf_ocr.py` | ✅ + recovery S107e | OCR parser za Sašine RBA izvode (bez tekst-sloja): pypdfium2 render 300 DPI + RapidOCR **po horizontalnim trakama** (full-page OCR tiho gubi retke!) + **stanje-chain validacija** (svaki red se provjerava protiv tekućeg stanja; sumnjivi dobiju `[OCR?]` u opisu) + **recovery pass (S107e, testiran ✅)**: na chain-breaku re-OCR uskog y-pojasa između susjednih redova, red se umeće SAMO ako savršeno popravlja chain. ~25 s/stranici. |
| `enrich_from_izvoda.py` | ✅ ZABA+MC+PBZVISA | Čita `Izvodi_transakcije.xlsx` (fallback: PDF-ovi) → match na Review (datum ±2 + iznos + smjer + Racun/Izvor) → `Izvod opis`/`Izvod file` kolone. Nematchane transakcije → **`Nematchano` sheet** u Izvodi_transakcije.xlsx (= kandidati za retke koji FALE u Kokinom Excelu). `--dry` za probu. |
| `apply_rules.py` | ✅ radi | `Pravila` sheet (keyword → Tip/Podtip) na redove gdje je **Tip prazan ili N/A** (ručni rad se NIKAD ne gazi). Pretražuje Napomena + `Izvod opis`. Prvi run kreira sheet s primjerima. `--dry`. |
| `sync_taxonomy.py` | ✅ radi | Taksonomija sheet → regenerira Tip/Podtip dropdowne Review sheeta |

**Redoslijed:** `inventory_izvoda.py` → `enrich_from_izvoda.py` → `apply_rules.py` →
ručno u Excelu što preostane → `sync_taxonomy.py` po potrebi.

## 2. Rezultati (2026-07-14, S107e — FINALNO; recovery izvršen, enrich re-run na Review)

120 PDF-ova (117 od Koke + 3 `propusteno_Koka/` + RBA_2026-05 od Saše) → dedup po md5 (6)
+ po SADRŽAJU transakcija (1). Stanje `Izvodi_transakcije.xlsx` (3519 tx, 114 manifest):

| Tip | Izvodi | Tx | Pokrivenost | Rupe | Match na Review |
| --- | --- | --- | --- | --- | --- |
| MC (ZABA Mastercard kartica) | 30 | 1092 | 2024-01 → 2026-06 | — | 973/1092 (89%) |
| PBZVISA (PBZ Visa Gold, Kokina + Sašina dodatna) | 31 | 1539 | 2023-12 → 2026-06 | — | **1/1539!** |
| ZABA (Kokin tekući, izvadak računa) | 31 | 624 | 2023-12 → 2026-06 | — | 516/624 (83%) |
| RF (Sašin Raiffeisen tekući, **OCR**) | 22 | 264 | 2024-09 → 2026-06 | **—** | 235/264 (89%) |

- **Recovery pass (S107e) testiran i izvršen:** svih 6 očekivanih redova ubačeno
  (RF_2024-11: +225.34 mirov. fond, −100.00 bankomat, **+984.78 MACGREGOR plaća**;
  RF_2024-12: +47.78, −2.39; RF_2025-02: −150.00), 0 novih flagova na ta 3 fajla.
  `[OCR?]` flagovi pali **9 → 1**.
- **RBA_2026-05.pdf** (Saša skinuo) → klasificiran, OCR-an, preimenovan `RF_2026-05.pdf`
  → **RF pokrivenost BEZ rupa**. Recovery u njemu ubacio 1 red s nečitljivim opisom
  (1282.79) — **Saša potvrdio na dokumentu (2026-07-14): PBZ Card / Visa Gold lump,
  05.06.2026** → ručno upisan opis+datum u Transakcije i Review (red je bio matchan).
  **0 `[OCR?]` flagova preostalo.** (Ručni fix je trajan: inventory koristi
  Izvodi_transakcije.xlsx kao keš — gubi se samo uz `--reparse RF_2026-05`.)
- **Enrich (2026-07-14): 1725/3519 matchano → `Izvod opis`/`Izvod file` u Review;
  1075 od 2219 N/A redova pokriveno** (Koka MC 778, Koka Racun 177, Saša RF 120).
  Backup: `*.pre-izvod-20260714_145329.xlsx`.
- **PBZVISA 1/1539 — Koka PBZ Visa kupovine UOPĆE ne vodi u Excelu** → 1538 tx u
  `Nematchano` sheetu (ukupno 1794); **odluka Saša/Koka: importati kao nove retke?** (v. §3.1)
- MC prije 2024-01 **ne postoji u e-bankarstvu** (potvrđeno 2026-07-13) → 2023. N/A masa
  se pokriva PBZ Visa izvodima (od 2023-12) + keyword pravilima.
- Parsiranje verificirano u cent na uzorcima (MC 2024-02: 1.642,83; PBZ 2024-12:
  1.505,17 + 1.612,81); RF preko stanje-chaina.
- ⚠ **cmd/run.bat guši zarez u argumentima** (`--reparse A,B,C` → samo A): cmd tretira
  `,` kao delimiter. Reparse pokretati **jedan substring po pozivu** (ili popraviti
  skriptu da skuplja sve argove nakon `--reparse`).

## 3. SLJEDEĆI KORACI

1. **Odluka: PBZ Visa transakcije (1538 u Nematchano sheetu).** Opcije:
   (a) generirati NOVE review retke iz Nematchano (datum, iznos, opis, Izvor — treba novi
   Izvor `Visa Koka` ili slično u Review + Taksonomija odluka), (b) ignorirati za migraciju
   (Kokin Excel = izvor istine), (c) importati kasnije kao zaseban batch. Sašina odluka.
2. **Pravila sa Sašom (iterativno):** `apply_rules.py` na obogaćenom Review — Tip=N/A +
   neprazan `Izvod opis` → grupiraj po merchantu → pravila. Zamke: prekratke riječi lažno
   pale (`zaba`, `eu`); specifičnija pravila IZNAD općenitijih; Tip/Podtip mora postojati
   u Taksonomiji. OCR opisi NEMAJU razmake (`RBAISPLATAGOTOVI...`) — substring match radi.
   **Dogovorene dorade apply_rules.py PRIJE prvog runa (Saša, 2026-07-14):**
   - **`Tip_O`/`Podtip_O` snapshot kolone** — jednom, prije prvog pisanja, iskopirati
     trenutne Tip/Podtip vrijednosti (trajni trag "prije pravila").
   - **Validacijski prolaz protiv Taksonomije:** red čiji Tip/Podtip par ne postoji u
     aktualnom Taksonomija sheetu → reset na N/A (+oznaka; original ostaje u `_O`).
     Hvata redove koje je izmjena Taksonomije učinila krivima — NE resetirati sve
     (VISOKA klasifikacije iz Za Sašu labela su kvalitetniji signal od keyword pravila).
   - **`Napomena` output kolona u Pravila sheetu** (keyword → Tip | Podtip | Napomena):
     red bez napomene dobije čistu ljudsku labelu; puna Napomena se NE gazi (P3).
   - Opcionalno `--all` mod: pravila se provjere i nad klasificiranim redovima,
     konflikt se samo REPORTA (staro→novo lista), ne piše.
   - Leaf comment se NE definira ovdje — gradi ga import generator iz CommentTemplate
     (`{racun}/{tip}/{podtip}/{napomena}`).
3. ~~Provjeriti 1 preostali `[OCR?]` red~~ — ✅ riješeno 2026-07-14 (PBZ Card/Visa lump
   05.06.2026, potvrdio Saša na dokumentu; ručno upisano u Transakcije + Review).

## 4. Pravila okruženja (OBAVEZNO pročitati)

- Python: `data-prep_tools\Tools\venv` (koristi ga `run.bat`; openpyxl 3.1, pdfplumber 0.11)
  ILI `C:\0_Sasa\events-tracker\venv`. `PYTHONUTF8=1` uvijek; skripte ne smiju nositi imena
  stdlib modula.
- **Nikad ne mijenjati postojeće vrijednosti Review sheeta** osim: Tip/Podtip/Pouzdanost/
  Alternativa na redovima gdje je Tip prazan/N/A (apply_rules) i `Izvod *` kolona (enrich).
- Review file zatvoren u Excelu prije pokretanja (inače PermissionError — backup svejedno nastane).
- Excel DV formula limit 255 znakova (relevantno samo za sync_taxonomy, već se provjerava).
- NE pisati ništa u bazu — sve ovo je pre-import review faza (import generator je poseban korak,
  v. FINANCIJE_MIGRACIJA.md §8 korak 4).
- `izvodi/` struktura: `Analizirani_izvodi/` (prepoznati, preimenovani), `duplikati/`
  (identičan sadržaj — ništa se ne briše), root = još neobrađeno/neparsabilno.
