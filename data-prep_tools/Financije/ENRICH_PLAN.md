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
| `apply_rules.py` | ✅ + dorade S107e/S107g | `Pravila` sheet (keyword → Tip/Podtip/**Napomena**) na redove gdje je **Tip prazan ili N/A** (ručni rad se NIKAD ne gazi; Napomena se puni samo ako je prazna — P3). Pretražuje Napomena + `Izvod opis`. Prije pravila: **jednokratni `Tip_O`/`Podtip_O` snapshot** + **validacija protiv Taksonomije** (nepostojeći par → PRAVILO ako pogađa → inače Preimenovanja rename → inače reset na N/A, oznaka `TAKS:` u Alternativa). **`Pravilo run` kolona (S107g):** timestamp na svaki red koji taj run promijeni (rename/reset/pravilo) — filtriraj po zadnjem timestampu. **Prioritet (S107g):** Pravilo > Preimenovanja rename > reset — ako blanket rename par pogađa preširoko, specifičnije keyword pravilo ga nadvladava (mark `PRAVILO #N nadvladao Preimenovanja` u Alternativa). `--dry`; `--all` = report konflikata pravila s klasificiranim redovima (ne piše). Prvi run kreira sheet s primjerima. |
| `sync_taxonomy.py` | ✅ radi | Taksonomija sheet → regenerira Tip/Podtip dropdowne Review sheeta |
| `backfill_datum_naplate.py` | ✅ NOVO S107f | `Datum naplate` = event_date za Izvor Racun/Cash (D1). ✅ IZVRŠENO 2026-07-15: 1631 redova (Racun 1630 + Cash 1); Visa 220 namjerno preskočena (puni ih import generator). Backup `*.pre-naplata-20260715_112019.xlsx`. |
| `fix_sportski_rekviziti_split.py` | ✅ one-off S107g | Preimenovanja blanket-rename za staru `Zdravlje/Sportski rekviziti` (29 redova, mješavina Multisport/Kreatin/Decathlon) razdvojen po sadržaju Napomene: multisport→`Zdravlje/Sport_Sasa` (23), Kreatin→`Namirnice/Hrana i ostalo` (3), Decathlon netaknuto (3). Prepoznaje preko `Podtip_O` snapshot kolone — siguran za ponovno pokretanje. |
| `fix_tcom_tmobile_swap.py` | ✅ one-off S107g | Kokin originalni T-com/T-mobile label bio krivo upisan na 2 retka (od 41+40) — Izvod opis ("fiksna"/"mobilna" mreža) otkriva stvarnu uslugu, ispravlja Tip/Podtip. Ograničeno na `Tip_O=Informatika`, `Podtip_O` in (T-com, T-mobile). |

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

## 2c. Dopune kraja sesije S107e (2026-07-14 popodne)

- **Autofilter Review sheeta proširen na SVE kolone (A1:V)** + trajno u alatima:
  `enrich_from_izvoda.py` i `apply_rules.py` (ensure_snapshot) sami proširuju filter kad
  dodaju kolone. Razlog nije komfor: kolona IZVAN autofiltera ne putuje s redom pri sortu
  → tihi raspar podataka (ista lekcija kao row_hash u app exportu).
- **Pravila pretražuju: `Napomena` + `Izvod opis`** (kombinirano); namjerno NE
  `Izvod file`/`Izvor reda`/`source_key` ("zaba"/"koka" bi lažno matchale sve).
- **`Datum naplate` — analiza praznih** (Racun 1630, Visa 220, Cash 1; MC kompletan):
  Racun/Cash → = event_date (doslovno D1; backfill skripta na Sašinu potvrdu);
  **Visa NE** = event_date (skida se 4.–7. idućeg mjeseca) → puni se pri generiranju
  importa: pravilom `next:N` ILI stvarnim datumima RF lump isplata iz Izvodi_transakcije.xlsx.
- **Enrich audit nalaz za Koku:** Review red 2025-11-26 Isplata 700,00 (Racun) — na ZABA
  izvodu NE POSTOJI nikakva 700€ transakcija (bankomat podizanja u 11-12/2025: 100+150+100+200).
  Pitanje za Koku: s kojeg računa / je li zbroj više podizanja?

## 2d. S107f (2026-07-15) — backfill izvršen + Preimenovanja sheet + Visa odluke

- **`Datum naplate` backfill IZVRŠEN** (v. tablicu §1) — Saša potvrdio; `sync_taxonomy.py`
  Saša sam pokrenuo (dropdowni sada prate novu Taksonomiju).
- **`Preimenovanja` sheet u apply_rules.py (NOVO):** stari Tip/Podtip par koji više ne
  postoji u Taksonomiji se PREIMENUJE u novi (Pouzdanost OSTAJE — VISOKA se čuva,
  `PREIM:` marker u Alternativa) umjesto reseta na N/A. `Racun uvjet` kolona =
  per-osoba split (`kokin`/`sasin` substring u Racun). Prvi run auto-kreira sheet
  pred-popunjen svim nevaljanim parovima + prijedlozima (jedini kandidat po substring
  matchu; 2 kandidata koka/sasa → dva reda s uvjetom). Testirano na kopiji:
  **135 preimenovano + 61 reset = 196** ✓; per-osoba Medical Koka 13× / Sasa 10× ✓.
  Sheet kreiran u pravom fileu — **Saša treba popuniti 4 para bez kandidata**
  (Sportski rekviziti→Sport_Koka?, PassSport, AudibleSasa, Saša projekti) i
  pregledati auto-prijedloge. `pick_file` sad ignorira SVE `.pre-*` backupe.
  ⚠ Seed pravila u Pravila sheetu će se primijeniti na prvom pravom runu
  (`mirovinsk`→Mirovina/Koka hvata i Sašinu mirovinu!) — zamijeniti pravim pravilima prije.
- **Visa odluke (Saša, 2026-07-15):** 1538 PBZ Visa tx iz Nematchano → DODATI kao nove
  review retke; lump plaćanja → `Transfer/između računa` (ne trošak — bez duplog brojanja);
  `Datum naplate` izvući iz PBZ PDF-ova (dospijeće/stvarna uplata); osoba se označava
  **per-osoba Podtipom** (ne novom kolonom). **KLJUČNO (novo saznanje):** Kokina PBZ Visa
  Gold se skida sa **Sašinog tekućeg RF** (lump 1282,79 od 05.06.2026 na RF izvodu = to!),
  a Mastercard (obje kartice) sa Kokinog ZABA → novi Visa retci: Racun = `Sašin tekući RF`.
  Posljedica za enrich: `[kartica: SAŠA]` tx s PBZVISA izvoda vjerojatno odgovaraju
  POSTOJEĆIM Sašinim redovima (Racun=Sašin tekući, Izvor=Visa) — PBZVISA match mapping
  treba split po Kartica koloni (SAŠA → Sašini redovi; DUBRAVKA → novi retci), što bi
  objasnilo 1/1539 match. Ime Izvora za nove retke još otvoreno (prijedlog: isti `Visa`).
- **Kandidati u kontekstu (dogovoren dizajn):** labaviji match (~256 ne-Visa nematchanih;
  isti Racun/Izvor/Smjer + točan iznos ±7 dana) piše prijedlog u novu kolonu
  `Izvod kandidat` U Review (unutar autofiltera!) — potvrda u kontekstu susjednih redova,
  NE zaseban sheet; treći korak prebacuje potvrđene u `Izvod opis`/`Izvod file`.
  Plus **reconcile report** po računu × mjesecu (zbroj Review vs saldo izvoda) — Saša želi
  točna stanja po računu; lokalizira mjesece s manjkom (klasa "700€ bankomat").

## 2e. S107g (2026-07-16) — prvi pravi apply_rules run + Pravilo/Preimenovanja prioritet

- **Preimenovanja sheet popunjen i pregledan** (Saša): 4 prazna para popunjena, 2 auto-prijedloga
  bila zamijenjena (PassSport kokin/sasin i Medical Koka/Sasa — donja crta umjesto razmaka,
  Taksonomija imala i duplikat `Sport_Koka` bez `Sport_Sasa`, oboje ispravljeno prije runa).
- **`Pravilo run` kolona (novo, S107g):** timestamp na svaki red koji zadnji `apply_rules.py`
  run promijeni (rename/reset/pravilo) — filtrabilan audit trail, neovisan o `Alternativa`.
- **PRVI PRAVI RUN izvršen** (Pravila: 7 pravila — temu/bolt.eu/konzum/bauhaus/prime video/
  skyshowtime/google*youtube): **196 preimenovano, 0 reset (TAKS), 217 pravilo-klasificirano**
  (200 Napomena popunjeno). `Tip_O`/`Podtip_O`/`Pravilo run` kolone kreirane. Backup
  `*.pre-rules-20260716_165928.xlsx`.
- **Nalaz: blanket Preimenovanja rename može pogoditi preširoko** kad je stara kategorija
  mješavina različitog sadržaja. `Zdravlje/Sportski rekviziti` (29 redova) blanket-preimenovan
  u `Razno/Odjeća/obuća..._Sasa`, ali sadržavao je Multisport pretplatu (23), Kreatin/MyProtein
  (3), Decathlon (3) — različiti stvarni troškovi. **Fix:** `fix_sportski_rekviziti_split.py`
  (one-off) — multisport→`Zdravlje/Sport_Sasa`, Kreatin→`Namirnice/Hrana i ostalo` (Napomena
  "Kreatin"), Decathlon netaknuto.
- **Isti obrazac, druga uzrok:** T-com/T-mobile (41+40 redova) — Kokin ORIGINALNI label bio
  krivo upisan na 2 retka (Izvod opis "fiksna"/"mobilna mreža" otkrio pravu uslugu). Fix:
  `fix_tcom_tmobile_swap.py` (one-off) — 2 retka zamijenjena.
- **Nova arhitektura, trajno u `apply_rules.py` (S107g):** prioritet za invalid-par retke sad je
  **Pravilo (ako keyword pogađa) > Preimenovanja rename > reset na N/A** — ako specifičnije
  Pravilo postoji PRIJE runa, automatski nadvladava preširoki blanket rename (umjesto da treba
  one-off skriptu naknadno). Testirano sintetički (synthetic invalid-par red s "konzum" u
  Napomeni ispravno preglasio Preimenovanja mapping), na pravom fileu trenutno 0 efekta (nema
  više invalid parova). Marker u Alternativa: `PRAVILO #N nadvladao Preimenovanja: bio <stari par>`.
- **Nevenka Pavić uplata (red 2436):** jednokratni poklon od majke → `Tip=Ostali prihodi`
  (bez Podtipa, isti obrazac kao postojeći "Uplata mama"/"Nataša povrat"), Napomena netaknuta
  (Izvod opis dovoljno govori), Pouzdanost=VISOKA. Pravilo NIJE napravljeno (samo 1 pojava).
- **N/A stanje nakon sesije:** 2218 → **2000** (218 riješeno: 217 pravilima + 1 ručno Nevenka);
  od toga 1142 još ima tekst (Napomena/Izvod opis) čeka pravila, 858 nema tekst uopće (čeka
  drugi izvor ili ostaje ručno).
- **Kandidati za sljedeći krug pravila** (identificirano, NE upisano — čeka Sašinu odluku o
  Tip/Podtip za svaki): `paypal` (ostatak osim temu, ~45 redova, merchant varira — NE raditi
  blanket pravilo), `apple.com/bill` (50×, nema Podtip u Taksonomiji), `spotify` (22×, nema
  Podtip u Zabava), `allianz`/`triglav`/`zivotno`/`investicijsko` (životno osiguranje, ~26-43×,
  nema Tip "Osiguranje"), `porez`/`prirez`/`dohodak` (APN porez, ~50×, nema Tip "Porezi"),
  `leasing` (OTP Leasing, ~15×), `bmove` (30×, nepoznat merchant — pitati Sašu/Koku),
  `keks pay` (63×, P2P transfer app — ovisi o namjeni), `zagrebparking` (45×, vjerojatno
  `auto C5/parking` — sve dosadašnje auto-transakcije idu na C5, ali potvrditi).
- **Split-workbook prijedlog** (Taksonomija/Pravila/Preimenovanja → zaseban file, da Saša može
  ostaviti otvoren za referencu bez zatvaranja Reviewa) — DISKUTIRANO, tehnički izvedivo
  (dropdown mehanizam u Review-u ostaje netaknut), ali ODGOĐENO na Sašin zahtjev dok se prvo
  ne odradi par krugova s novom kolonom. Nije implementirano.

## 3. SLJEDEĆI KORACI

1. **Odluka: PBZ Visa transakcije (1538 u Nematchano sheetu).** Opcije:
   (a) generirati NOVE review retke iz Nematchano (datum, iznos, opis, Izvor — treba novi
   Izvor `Visa Koka` ili slično u Review + Taksonomija odluka), (b) ignorirati za migraciju
   (Kokin Excel = izvor istine), (c) importati kasnije kao zaseban batch. Sašina odluka.
2. **Pravila sa Sašom (iterativno) — NASTAVAK.** Prvi krug gotov (v. §2e, 7 pravila, 217
   redova). Sljedeći krug: kandidati navedeni u §2e (paypal ostatak, apple.com/bill, spotify,
   osiguranje grupa, porez grupa, leasing, bmove, keks pay, zagrebparking) — treba Sašinu
   odluku o Tip/Podtip za svaki (neki zahtijevaju nov red u Taksonomiji). Zamke: prekratke
   riječi lažno pale (`zaba`, `eu`); specifičnija pravila IZNAD općenitijih; Tip/Podtip mora
   postojati u Taksonomiji. OCR opisi NEMAJU razmake (`RBAISPLATAGOTOVI...`) — substring
   match radi. Nakon svakog kruga: `--dry` prvo, provjeri `Pravilo run` kolonu za kontrolu.
3. ~~Provjeriti 1 preostali `[OCR?]` red~~ — ✅ riješeno 2026-07-14.
4. ~~backfill `Datum naplate` za Racun/Cash~~ — ✅ IZVRŠENO 2026-07-15.
5. ~~`sync_taxonomy.py`~~ — ✅ Saša pokrenuo 2026-07-15.
5b. ~~Preimenovanja sheet popuna + prvi pravi run~~ — ✅ IZVRŠENO 2026-07-16 (v. §2e).
5c. **Enrich dorada: PBZVISA split po Kartica koloni** (SAŠA → match na Sašine Visa retke,
   DUBRAVKA → Nematchano/novi retci) + `Izvod kandidat` kolona + reconcile report — v. §2d.
6. **Pitanje za Koku:** 700€ isplata 2025-11-26 (v. §2c) + odluka o N/A masi.
7. **Split-workbook** (opcionalno, v. §2e) — ako Saša želi nakon par kruga pravila.

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
