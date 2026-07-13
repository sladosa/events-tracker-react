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
| `inventory_izvoda.py` | ✅ NOVO S107d | Sredi `izvodi/`: md5 dedup (→ `duplikati/`), klasifikacija PDF-a po SADRŽAJU, parse, rename `PREFIX_YYYY-MM.pdf` → `Analizirani_izvodi/`, piše **`izvodi/Izvodi_transakcije.xlsx`** (Transakcije + Manifest sheet, report pokrivenosti s rupama). Idempotentno; `--dry` za probu. |
| `enrich_from_izvoda.py` | ✅ ZABA+MC+PBZVISA | Čita `Izvodi_transakcije.xlsx` (fallback: PDF-ovi) → match na Review (datum ±2 + iznos + smjer + Racun/Izvor) → `Izvod opis`/`Izvod file` kolone. Nematchane transakcije → **`Nematchano` sheet** u Izvodi_transakcije.xlsx (= kandidati za retke koji FALE u Kokinom Excelu). `--dry` za probu. |
| `apply_rules.py` | ✅ radi | `Pravila` sheet (keyword → Tip/Podtip) na redove gdje je **Tip prazan ili N/A** (ručni rad se NIKAD ne gazi). Pretražuje Napomena + `Izvod opis`. Prvi run kreira sheet s primjerima. `--dry`. |
| `sync_taxonomy.py` | ✅ radi | Taksonomija sheet → regenerira Tip/Podtip dropdowne Review sheeta |

**Redoslijed:** `inventory_izvoda.py` → `enrich_from_izvoda.py` → `apply_rules.py` →
ručno u Excelu što preostane → `sync_taxonomy.py` po potrebi.

## 2. Rezultati inventory + enrich probe (2026-07-13, S107d)

117 PDF-ova od Koke → 111 unikatnih (6 duplikata po sadržaju). Klasifikacija po sadržaju
(generička download imena tipa "Jedinstveni izvadak građana (14).pdf"):

| Tip | Izvodi | Transakcija | Pokrivenost | Rupe |
| --- | --- | --- | --- | --- |
| MC (ZABA Mastercard kartica — "Obavijest o učinjenim troškovima") | 29 | 1062 | 2024-01 → 2026-06 | **2026-05** |
| PBZVISA (PBZ Visa Gold — Kokina + Sašina dodatna kartica!) | 31 | 1539 | 2023-12 → 2026-06 | — |
| ZABA (izvadak tekućeg — "Jedinstveni izvadak građana") | 29 | 581 | 2023-12 → 2026-06 | **2024-07, 2024-08** |
| bez tekst-sloja (RF 2024 + `2025-N`/`2026-N` = vjerojatno RF) | 22 | — | — | OCR/CSV potreban |

Parsiranje verificirano u cent na uzorcima (MC 2024-02: 1.642,83 = UKUPNO s dokumenta;
PBZ 2024-12: 1.505,17 troškova + 1.612,81 uplata).

**Enrich match (dry na kopiji Review filea):** 1429/3182 matchano;
**938 N/A redova dobiva `Izvod opis`** (od 2218 N/A s datumom+iznosom).
- MC: 945/1062 (89%) ✔
- ZABA: 483/581 (83%) ✔
- **PBZVISA: 1/1539 — Koka PBZ Visa kupovine UOPĆE ne vodi u Excelu** (nema Izvor='Visa'
  za Koku; vodi samo ZABA Mastercard). 1538 transakcija ide u `Nematchano` sheet →
  **odluka Saša/Koka: importati ih kao nove retke?** (v. §3.2)
- 2023. N/A masa ostaje slabo pokrivena — MC izvodi počinju s 2024-01.

## 3. SLJEDEĆI KORACI

1. **Pravi enrich run** — čekao je zatvoren Review file (bio otvoren u Excelu 2026-07-13):
   `run.bat enrich_from_izvoda.py --dry` pa bez `--dry`. (D1 header 'Smjer' popravljen —
   bio pregažen tekstom `run.bat sync_taxonomy.py`, vjerojatno slučajni paste.)
2. **Odluka: PBZ Visa transakcije (1538 u Nematchano sheetu).** Opcije:
   (a) generirati NOVE review retke iz Nematchano (datum, iznos, opis, Izvor — treba novi
   Izvor `Visa Koka` ili slično u Review + Taksonomija odluka), (b) ignorirati za migraciju
   (Kokin Excel = izvor istine), (c) importati kasnije kao zaseban batch. Sašina odluka.
3. **Pravila sa Sašom (iterativno):** `apply_rules.py` na obogaćenom Review — Tip=N/A +
   neprazan `Izvod opis` → grupiraj po merchantu → pravila. Zamke: prekratke riječi lažno
   pale (`zaba`, `eu`); specifičnija pravila IZNAD općenitijih; Tip/Podtip mora postojati
   u Taksonomiji.
4. **Rupe u izvodima** — pitati Koku: MC 2026-05; ZABA 2024-07/08; MC prije 2024-01
   (za 2023. N/A masu).
5. **RF izvodi (22 filea bez tekst-sloja):** najbolje CSV/Excel export iz RF aplikacije;
   fallback OCR (pypdfium2 render ~300 DPI + rapidocr-onnxruntime). Novi parser vraća isti
   dict format i registrira se u `SOURCE_TYPES`.

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
