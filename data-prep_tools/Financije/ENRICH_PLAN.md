# ENRICH_PLAN — Izvod enrichment + keyword klasifikacija

**Napisano:** 2026-07-12 (S107c, Fable); **ažurirano 2026-07-13 (S107d)** — stigli svi Kokini
izvodi, MC + PBZ Visa parseri gotovi, inventory pipeline gotov.
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
| `rf_ocr.py` | ✅ NOVO S107d | OCR parser za Sašine RBA izvode (bez tekst-sloja): pypdfium2 render 300 DPI + RapidOCR **po horizontalnim trakama** (full-page OCR tiho gubi retke!) + **stanje-chain validacija** (svaki red se provjerava protiv tekućeg stanja; sumnjivi dobiju `[OCR?]` u opisu). ~25 s/stranici. |
| `enrich_from_izvoda.py` | ✅ ZABA+MC+PBZVISA | Čita `Izvodi_transakcije.xlsx` (fallback: PDF-ovi) → match na Review (datum ±2 + iznos + smjer + Racun/Izvor) → `Izvod opis`/`Izvod file` kolone. Nematchane transakcije → **`Nematchano` sheet** u Izvodi_transakcije.xlsx (= kandidati za retke koji FALE u Kokinom Excelu). `--dry` za probu. |
| `apply_rules.py` | ✅ radi | `Pravila` sheet (keyword → Tip/Podtip) na redove gdje je **Tip prazan ili N/A** (ručni rad se NIKAD ne gazi). Pretražuje Napomena + `Izvod opis`. Prvi run kreira sheet s primjerima. `--dry`. |
| `sync_taxonomy.py` | ✅ radi | Taksonomija sheet → regenerira Tip/Podtip dropdowne Review sheeta |

**Redoslijed:** `inventory_izvoda.py` → `enrich_from_izvoda.py` → `apply_rules.py` →
ručno u Excelu što preostane → `sync_taxonomy.py` po potrebi.

## 2. Rezultati (2026-07-13, S107d — FINALNO, enrich IZVRŠEN na Review fileu)

120 PDF-ova (117 od Koke + 3 `propusteno_Koka/`) → dedup po md5 (6) + po SADRŽAJU
transakcija (1: RBA generira druge bajtove pri svakom downloadu, `2026-5.pdf` i
`2026-6.pdf` bili su ISTI lipanjski izvadak!). Stanje `Izvodi_transakcije.xlsx`:

| Tip | Izvodi | Tx | Pokrivenost | Rupe | Match na Review |
| --- | --- | --- | --- | --- | --- |
| MC (ZABA Mastercard kartica) | 30 | 1092 | 2024-01 → 2026-06 | — | ~89% |
| PBZVISA (PBZ Visa Gold, Kokina + Sašina dodatna) | 31 | 1539 | 2023-12 → 2026-06 | — | **1/1539!** |
| ZABA (Kokin tekući, izvadak računa) | 31 | 624 | 2023-12 → 2026-06 | — | ~83% |
| RF (Sašin Raiffeisen tekući, **OCR**) | 21 | 246 | 2024-09 → 2026-06 | **2026-05** | 88% |

- **Enrich (2026-07-13): 1707/3501 matchano → `Izvod opis`/`Izvod file` u Review;
  1069 od 2221 N/A redova pokriveno** (Koka MC 974, Koka Racun 516, Saša RF 217).
  Backup: `*.pre-izvod-20260713_152340.xlsx`. Ručne kolone verificirane netaknute.
- **PBZVISA 1/1539 — Koka PBZ Visa kupovine UOPĆE ne vodi u Excelu** → 1538 tx u
  `Nematchano` sheetu; **odluka Saša/Koka: importati kao nove retke?** (v. §3.1)
- RF OCR: 9/246 redova flagano `[OCR?]` (stanje-chain validacija) — provjeriti ručno.
- MC prije 2024-01 **ne postoji u e-bankarstvu** (potvrđeno 2026-07-13) → 2023. N/A masa
  se pokriva PBZ Visa izvodima (od 2023-12) + keyword pravilima.
- Parsiranje verificirano u cent na uzorcima (MC 2024-02: 1.642,83; PBZ 2024-12:
  1.505,17 + 1.612,81); RF preko stanje-chaina.

## 2b. ⚠ GDJE SMO STALI (kraj sesije 2026-07-13 navečer — PROČITAJ PRVO)

**RF OCR saga (kronologija):** single-pass strip OCR promašivao retke → dvoprolazni
(fazni pomak traka) popravio 2 od 5 flaganih fajlova, ali 3 i dalje imaju promašene
retke (delta hintovi: RF_2024-11: +225.34, -100.00, **+984.78 = MACGREGOR plaća!**;
RF_2024-12: +47.78, -2.39; RF_2025-02: -150.00). Otkriveno i da je lipanjskom izvatku
(RF_2026-06) falio red `PBZ Card d.o.o. 1.495,78` — **Sašin RBA plaća Kokinu PBZ Visu!**
(sad uhvaćen dvoprolaznim).

**NAPISAN ALI NETESTIRAN: recovery pass u `rf_ocr.py`** — kad se stanje-chain slomi
između dva susjedna retka, re-OCR-a se uski y-pojas između njih (izolirani crop čita
pouzdano — dokazano ranije) i red se umeće SAMO ako savršeno popravlja chain
(+ zaštita od re-detekcije rubnih redova a/b). **Sesija prekinuta točno prije testa.**

**Sljedeća sesija — točan redoslijed:**
1. Test: `run.bat rf_ocr.py <path>\Analizirani_izvodi\RF_2024-11.pdf`
   → očekivano: `✚ recovery ubacio ...` redovi (~225.34 uplata?, 100 isplata, 984.78
   MACGREGOR uplata), 0 flagova na kraju. Pa isto RF_2024-12.pdf i RF_2025-02.pdf.
2. `run.bat inventory_izvoda.py --reparse RF_2024-11,RF_2024-12,RF_2025-02`
   (--reparse ignorira keš za te fajlove; ostali iz keša)
3. `run.bat enrich_from_izvoda.py --dry` pa bez `--dry` (Review zatvoren!)
4. Ažurirati brojke u §2 + CLAUDE.md S107d blok + memory; commit.

**Stanje podataka SADA:** Izvodi_transakcije.xlsx ima 3501 tx ali RF_2024-11/12 i
RF_2025-02 su iz dvoprolaznog runa BEZ recoveryja (falih ~6 redova, 6× `[OCR?]` flag).
Review file: enrich zadnji put pokrenut PRIJE reparsa (1707 match) — brojke se
neznatno mijenjaju nakon koraka 3.

## 3. SLJEDEĆI KORACI

1. **Odluka: PBZ Visa transakcije (1538 u Nematchano sheetu).** Opcije:
   (a) generirati NOVE review retke iz Nematchano (datum, iznos, opis, Izvor — treba novi
   Izvor `Visa Koka` ili slično u Review + Taksonomija odluka), (b) ignorirati za migraciju
   (Kokin Excel = izvor istine), (c) importati kasnije kao zaseban batch. Sašina odluka.
2. **Pravila sa Sašom (iterativno):** `apply_rules.py` na obogaćenom Review — Tip=N/A +
   neprazan `Izvod opis` → grupiraj po merchantu → pravila. Zamke: prekratke riječi lažno
   pale (`zaba`, `eu`); specifičnija pravila IZNAD općenitijih; Tip/Podtip mora postojati
   u Taksonomiji. OCR opisi NEMAJU razmake (`RBAISPLATAGOTOVI...`) — substring match radi.
3. **Saša: skinuti RBA izvadak br. 5/2026 (svibanj)** → `izvodi/` → inventory → enrich.
4. Pregledati 9 `[OCR?]` redova (filter u Review/Transakcije po `[OCR?]`).

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
