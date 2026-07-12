# ENRICH_PLAN — Izvod enrichment + keyword klasifikacija (handoff za sljedeću sesiju)

**Napisano:** 2026-07-12 (S107c, Fable). **Za:** sljedeću sesiju (može jeftiniji model — Sonnet).
**Kontekst:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` (§6 klasifikacija, §12.5 izvod enrichment).
**Cilj:** maksimalno smanjiti ručni rad u Tip/Podtip klasifikaciji `Financije_review_*.xlsx`
(3503 reda, ~2104 N/A) pomoću bankovnih izvoda + editabilnih keyword pravila.

---

## 1. Što je već NAPRAVLJENO i TESTIRANO (2026-07-12)

Svi alati u `data-prep_tools/Financije/`, pokreću se s `Financije\run.bat <skripta.py> [args]`
(ili direktno: `$env:PYTHONUTF8=1; C:\0_Sasa\events-tracker\venv\Scripts\python.exe <skripta>` u PowerShellu).
**Review file mora biti ZATVOREN u Excelu.** Svaki alat radi backup prije snimanja
(`*.pre-sync-*` / `*.pre-rules-*` / `*.pre-izvod-*`).

| Alat | Status | Što radi |
| --- | --- | --- |
| `sync_taxonomy.py` | ✅ radi | Taksonomija sheet → regenerira Tip/Podtip dropdowne Review sheeta (Liste + named ranges + DV + CF) |
| `apply_rules.py` | ✅ radi | `Pravila` sheet (keyword → Tip/Podtip) primjenjuje na redove gdje je **Tip prazan ili N/A** (ručni rad se NIKAD ne gazi). Prvi run kreira sheet s primjerima. `--dry` za probu. |
| `enrich_from_izvoda.py` | ✅ ZABA račun; ⬜ MC kartica; ⬜ RF | PDF-ovi iz `data-prep_data/Financije/izvodi/` → match (datum ±2 + iznos + smjer) → upiše `Izvod opis` + `Izvod file` kolone u Review. `--dry` za probu. |

**Redoslijed korištenja:** `enrich_from_izvoda.py` → `apply_rules.py` (pravila pretražuju
Napomena + `Izvod opis` kolone) → ručno u Excelu što preostane → `sync_taxonomy.py` po potrebi
(ako se mijenjala Taksonomija).

**Verificirano na uzorku:** `ZABA_2024-01.pdf` → 18 transakcija parsirano, 15/18 matchano
(3 nematchana = očekivano: Mastercard lump 926,52 nije Racun red u Review; 2× Triglav 33,98
duplikat koji Kokin Excel nema kao zasebne retke). Pravilo preko `Izvod opis` teksta radi
(test: `kamata & prekoracenje` → pogodio "Redovna kamata na prekoračenje" red).

---

## 2. GLAVNI ZADATAK sljedeće sesije: Mastercard IZVOD KARTICE parser

**Zašto:** N/A masa (2104 reda) su Kokine Mastercard kupovine 2023-01–2025-06 bez opisa.
Izvadak RAČUNA ih ima samo kao lump (`TROŠKOVI UČINJENI MASTERCARD KARTICOM`) — **merchant
detalj je SAMO na izvodu KARTICE** (zaseban dokument u e-zabi). Saša+Koka ih skidaju u
`data-prep_data/Financije/izvodi/` — dogovoreno ime: **`MC_YYYY-MM.pdf`**.

**Koraci:**
1. Provjeri ima li tekst-sloj + pogledaj strukturu:
   ```python
   import pdfplumber
   with pdfplumber.open(r'...\izvodi\MC_2024-01.pdf') as pdf:
       print(pdf.pages[0].extract_text()[:2000])
   ```
   (Ako 0 znakova → isti problem kao RF, vidi §4.)
2. Napiši `parse_zaba_kartica(path) -> list[dict]` u `enrich_from_izvoda.py` po uzoru na
   `parse_zaba_racun` (vrati `{date, opis, iznos, smjer, src}`).
   **VAŽNO — semantika datuma:** na kartičnom izvodu datum transakcije = **datum KUPOVINE**,
   a to je u Review upravo `event_date` Mastercard redova (D1) → match mehanizam ostaje isti.
   Kupovine su `smjer='Isplata'`; povrati (ako postoje) `'Uplata'`.
3. Registriraj u `PARSERS` listu: `('MC', parse_zaba_kartica, RACUN_KOKA, 'Mastercard')`.
4. Test: `run.bat enrich_from_izvoda.py --dry` → provjeri match rate; pa bez `--dry`.
5. Ako izvod kartice pokriva i rate (obročna plaćanja) — NE brinuti o X/N parsiranju,
   samo opis; rate su već parsirane iz Kokinog Excela.

## 3. Drugi zadatak: pravila s Sašom (iterativno)

1. `run.bat apply_rules.py` (prvi put na pravom fileu → kreira `Pravila` sheet s primjerima).
2. Saša upisuje pravila; `--dry` pokazuje broj pogodaka po pravilu + primjere prije snimanja.
3. Korisni kandidati za pravila vide se filtriranjem Review: Tip=N/A + neprazan `Izvod opis`
   → sortiraj/grupiraj po sadržaju opisa.

**Zamke kod pravila:**
- Prekratke/generičke riječi lažno pale: `zaba`, `eu`, `on-line`… — bankovni opisi sadrže
  "on-line bankarstvom (m-zaba)". Koristi specifične riječi (merchant imena) ili `&` kombinacije.
- Prvi match odozgo pobjeđuje → specifičnija pravila stavljati IZNAD općenitijih.
- Tip/Podtip pravila moraju postojati u `Taksonomija` sheetu (validira se, preskače uz warning).

## 4. RF izvodi (Sašin račun) — tek ako ostane vremena / bude potrebe

RF PDF-ovi (`RF_*.pdf`) NEMAJU tekst-sloj — tekst je pretvoren u vektorske krivulje
(0 chars, ~2000 curves/str.). Opcije po prioritetu:
1. **Najbolje:** Saša provjeri nudi li RF aplikacija CSV/Excel export prometa → trivijalan parser.
2. OCR: render preko `pypdfium2` (već instaliran kao pdfplumber dep) na ~300 DPI + `rapidocr-onnxruntime`
   (pip-instalabilan, offline). Novi parser vraća isti dict format.
3. Napomena: RF izvadak RAČUNA ionako sadrži samo Visa lump + direktna plaćanja; Visa
   itemizacija prije 2025-07 tražila bi izvode Visa KARTICE.

## 5. Pravila okruženja (OBAVEZNO pročitati)

- Python: `C:\0_Sasa\events-tracker\venv` (openpyxl 3.1, pdfplumber 0.11) ILI
  `data-prep_tools\Tools\venv` (koristi ga `run.bat`; pdfplumber instaliran 2026-07-12).
- `PYTHONUTF8=1` uvijek; skripte ne smiju nositi imena stdlib modula.
- **Nikad ne mijenjati postojeće vrijednosti Review sheeta** osim: Tip/Podtip/Pouzdanost/
  Alternativa na redovima gdje je Tip prazan/N/A (apply_rules) i `Izvod *` kolona (enrich).
- Review file zatvoren u Excelu prije pokretanja (inače PermissionError — backup svejedno nastane).
- Excel DV formula limit 255 znakova (relevantno samo za sync_taxonomy, već se provjerava).
- NE pisati ništa u bazu — sve ovo je pre-import review faza (import generator je poseban korak,
  v. FINANCIJE_MIGRACIJA.md §8 korak 4).
