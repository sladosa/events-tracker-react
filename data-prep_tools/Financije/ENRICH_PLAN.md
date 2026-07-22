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

## 2f. S107h (2026-07-17) — drugi krug pravila + Iznos min/max novi feature

- **Code review novih Pravila redova PRIJE runa** (Saša ih sam dodao) — 2 stvarna bug-a
  nađena: `*osiguranje*`/`*porez*` zvjezdica se tretira doslovno (nije wildcard) → 0
  pogodaka; `APPLE.COM` → Podtip "Apple" ne postoji u Taksonomiji → pravilo preskočeno.
- **`Komentar` → `Alternativa` dopisivanje (novo, trajno u `apply_rules.py`):** kolona je
  postojala ali se nikad nije čitala; sad se, ako popunjena, dopisuje uz keyword marker u
  Alternativa/nap. — sigurno mjesto za "TODO razdvoji po X" bilješke, ne dira comment polje.
- **Novi `Iznos min`/`Iznos max` uvjet (novo, trajno u `apply_rules.py`):** opcionalni
  stupci u Pravila; pravilo pogađa samo ako je Isplata/Uplata reda unutar raspona. Otkriće:
  APPLE.COM (60 redova) je iCloud pretplata (2 price-point clustera 2.99€/7.99→9.99€,
  potvrđeno postojećim ručno klasificiranim redom), NE "Zabava" → `Informatika`/`Cloud
  backup`. AUDIBLE razdvojen Audible_Koka/Sasa po pragu 10€ (Koka: Sasin je skuplji,
  jasan gap 8.99→13.21 u podacima).
- **Osiguranje/Allianz/Generali/Triglav redizajn (Koka odluke, chat s Kokom):** sve ide u
  POSTOJEĆE kategorije, Taksonomija combined-bucket placeholder obrisan. Allianz (auto,
  Koka ne zna pouzdano koji auto) → `auto C5`/`registracija` blanket (25×) + eksplicitno
  označeni red "Allianz Lacetti" → `auto Lacetti`/`registracija` (1×, rule ORDER bitan —
  specifičniji prije generičkog). Generali (kuća, oba računa) → `Domaćinstvo`/`Popravci,
  održavanje, osiguranje` (5×). Triglav (životno, "prošlost", ne treba D/I split) →
  `Osiguranje`/`Osiguranje` (16×).
- **AMAZON pravilo maknuto** — samo 2 retka (48.45€, 52.41€), cijena ne odgovara Amazon
  Prime pretplati na amazon.de (89.90€/god), transaction-reference format izgleda kao
  obična narudžba. Ostaje ručno.
- **`update_pravila_s107h.py` (novo, one-off):** Claude je na Sašin zahtjev direktno
  regenerirao cijeli Pravila body iz `FINAL_RULES` liste (idempotentan, auto-backup).
- **PRAVI RUN #2 izvršen:** 294 redova, +46 Napomena popunjeno. N/A **2000 → 1706**.
  Sve programske kontrole prošle (Audible threshold 0 kršenja, Pravilo run timestamp
  count = 294, Napomena fill count 43/44).
- **Odluka za sljedeću sesiju (Saša + Claude, kraj S107h):** PRIJE sljedećeg kruga
  pravila, odraditi **PBZ Visa split s jačim modelom** (v. §3 t.1) — 1538 tx trenutno
  NISU u Review sheetu (sjede u Nematchano), pa ih pravila ne mogu ni vidjeti; nakon
  merge-a kao novi Review redovi, postojeća pravila odmah klasificiraju dobar dio
  besplatno. Zadatak i rizičniji (pravi novac, person-split, PDF datumi) → opravdano
  jačim modelom nego dosadašnje Sonnet rules-craft sesije.

## 2g. S107i (2026-07-20) — PBZ Visa merge u Review + reconcile/Problem dijagnoza

- **Nalaz koji je promijenio plan:** Kartica tag **NIJE** pouzdan pokazatelj osobe — od 220 postojećih
  Sašinih Visa redaka, **121 matcha KOKA-tagirane** PBZ tx, samo 66 SAŠA-tagirane (Saša je u Excel
  bilježio kupovine s OBJE kartice). → dedup TAG-AGNOSTIČKI (protiv svih PBZ tx), i **BEZ person-splita**
  (Odluka 2a, Saša): svi novi retci Racun=Sašin RF, Izvor=Visa; osoba samo kroz Podtip (pravila) gdje ima
  signala. Kartica se čuva kao audit trag u `Izvor reda` (`PBZ Visa:Koka/SAŠA/lump`).
- **`merge_pbzvisa.py` (novo):** 1538 PBZ tx → dedup 187 (matcha postojeće, plateau ±2 dana) → **1351
  novih redaka** (Koka 895, SAŠA povijesne 424, lump 32). Povijesne Sašine Visa 2023-25 (nisu bile u
  Excelu, 402 kom) → dodane. Lump `PRIMLJENA UPLATA` → Transfer/izmedju racuna. RATA → Rate?=DA + Broj rata.
  **Opcija B sort:** cijeli Review presortiran po event_date (0 padova), stil naslijeđen s Visa template
  reda, DV Tip/Podtip prošireni `J2:J4856`/`K2:K4856`, autofilter na sve. Idempotentno (source_key skip).
  Review **3504 → 4855**; `Sašin RF|Visa` 220 → 1571. Backup `pre-pbzvisa-20260720_110952`.
- **apply_rules run:** 257 novih N/A klasificirano besplatno postojećim pravilima (konzum 230, bauhaus 16,
  parking 10) + 246 Napomena. Backup `pre-rules-20260720_111111`. N/A novih: 1351 → 289 klasificirano.
- **`reconcile_izvoda.py` (novo):** coverage izvod→Review + `Nematchano_v1` freeze + `Nematchano_v2` s
  **`Problem` kolonom** (dijagnoza) + `Coverage` sažetak, u `Izvodi_transakcije.xlsx` (backup
  `pre-reconcile-20260720_123953`). **Coverage: PBZVISA 1538/1539** (bilo 1/1539!), ZABA 516/108, RF
  235/29, MC 973/119. NEDOSTAJE 257: 101 "možda već u Reviewu (datum>±7d)", 66 kartična kupovina, 51
  nedostaje, **39 Smjer?** (crveni u sheetu).
- **⚠ KLJUČAN NALAZ — ZABA parser bug:** `parse_zaba_racun` krivo određuje Smjer za dio priljeva
  (≥35: mirovina, Priljev iz inozemstva, uplate → Isplata) po X-poziciji iznosa; saldo-lanac
  (POČETNO+Σtx=NOVO) NE zatvara (fali ~359-544€/mjesec 2026). **Account merge + bank kolone
  (UplataB/IsplataB/SaldoB) + saldo-reconcile BLOKIRANI dok se ne popravi** (v. §3 t.1b). Dry-run
  `merge_missing_account.py` uhvatio greške (117 "nedostajućih" account tx sadrži mirovine kao Isplata)
  → NIŠTA upisano. Bankovni mjesečni saldi (ZABA POČETNO/NOVO STANJE) SU pouzdani i ulančavaju
  (parsabilni iz teksta) — čekaju parser fix. Koka je vodila SALDO računa, ne svaku tx pojedinačno →
  fokus reconcilea: tekuća godina, saldo-vs-Koka, dio s Kokom.

## 2h. S107j (2026-07-22) — parse_zaba_racun fix (Smjer + potpunost + žiro split) ✅

**Nalaz (Saša + Claude/Opus):** Saša ručno pregledao `Nematchano_v2` (crveni `Smjer?`), prebacio original
Smjer u kolonu K, i ispravno zaključio da su ti retci zapravo `Uplata` + da transfere treba obrisati.
Root cause potvrđen i **mehanički** (ne fundamentalni x-pozicija problem):
1. **Smjer flip:** `parse_zaba_racun` je za granicu Priljev|Odljev uzimao **zadnju** pojavu riječi
   "Priljev" na stranici — a "Priljev" se pojavljuje i **unutar opisa** *"**Priljev** iz inozemstva …"*
   (x≈188, opis-kolona) → granica se pomakne i **cijela stranica padne u Isplata**. Pogađa točno
   mjesece sa stranom uplatom (Pharmalog/Astrum/TechProtect/TOPFORSPORT) = baš one stranice s Uplatama
   koje treba. 8/31 fajlova.
2. **Potpunost:** continuation stranice (str. 2+) NE ponavljaju header "Priljev Odljev" → boundary=None →
   parser je **tiho ispuštao sve transakcije tih stranica** (2024-01: baš 450 Anja + 49 multisport).
3. **Dva računa:** izvadak ima **Tekući račun** (Kokin tekući ZABA) + **Multivalutni žiroračun**
   (pass-through 0→0, samo strana uplata → odmah prijenos na tekući). Parser je oba tagirao kao tekući
   → žiro retci = "transferi koji nemaju smisla".

**Fix (`enrich_from_izvoda.py`):** `_zaba_header_boundary` (header red: Priljev+Odljev na istoj liniji) +
**prijenos boundary kroz stranice** + account-tagging + `_validate_zaba` (saldo-lanac vs bankovni
POČETNO/Zbroj prometa/NOVO STANJE, mismatch → stderr). `parse_zaba_racun` vraća **SAMO Tekući račun**;
žiro pass-through se izostavlja (Odluka Saša: **izostavi + prenesi ime poslodavca** — žiro "Priljev iz
inozemstva X" se dopisuje kao `[izvor: …]` na tekući self-transfer redak; podržava lump 436+2038→2474).

**Dokaz (read-only, svih 31 ZABA):** Σupl/Σisp = bankov "Zbroj prometa" **40/40 account-mjeseci u cent**;
**saldo-lanac tekućeg neprekinut 2023-12→2026-06, 0 pukotina** (calc svakog mjeseca = POČETNO idućeg);
20 žiro redaka izostavljeno; 8 uplata dobilo `[izvor:]` tag. Protiv pravog Reviewa: **match 625/700**
(bilo 516) → 39 "Smjer?" spalo na **11 pravih unmatched Uplata** (mirovine 2025-02/07, Anja rate…).
Ostali unmatched očekivani (MASTERCARD lump = itemizirano MC izvodom; rani Kreditni transferi koje Koka
nije vodila). Parser signatura nepromijenjena (vraća date/opis/iznos/smjer/src; `account` se popa) —
inventory/reconcile/merge_missing_account svi importaju čisto, py_compile OK.

**✅ POKRENUTO na podacima (2026-07-22):** `inventory --reparse ZABA` (ZABA 624→**700** tx, 0 saldo
warninga) → `enrich` (**1834/3595** match, bilo 1725; Review backup `pre-izvod-20260722_090554`) →
`reconcile` (**Smjer? 39→1**, NEDOSTAJE 257→**224**) → `apply_rules` (+16 N/A). Backup Izvodi_transakcije
`pre-zabafix-20260722_090442` (čuva stari Nematchano_v2 s ručnim editima).
**Nematchano_v2 (224) mapiran:** 110 možda-dup (date-shift, NE dodavati auto), 66 kartična (MC/Visa
kupovine za dodati), 47 nedostaje (31 MASTERCARD lump→Transfer, 16 pravi account tx), 1 Smjer?.

## 2i. S107j (2026-07-22 nastavak) — suggest_candidates.py (N/A rule-authoring petlja)

**`suggest_candidates.py` (novo):** skenira N/A retke Review-a S TEKSTOM (Izvod opis/Napomena), grupira
po normaliziranom merchant ključu (strip RATA-marker/IBAN/ref/boilerplate; ključ = 1. token ako ≥5 slova
inače 2 tokena — spaja AFRODITA/AFRODITA BEAUTY, KEINDL/KEINDL SPORT), nudi **top N** (default 20, da ne
preplavi) u sheetu **`Neklasificirano`** s Tip/Podtip **dropdownima** (isti TipList/INDIRECT named-range
mehanizam kao Review). Fokus po godini (`--year 2026`). Petlja: popuni Tip/Podtip → `--harvest`
(popunjeni → Pravila, dedup) → `apply_rules` → sljedeći krug kraći. `--preview` samo ispiše.
Prvi run: `Neklasificirano` (2026, 20 klastera) zapisan (backup `pre-neklas-20260722_094229`);
top: BIBERON 9, KEINDL 7, HLK članarina 5, TRAPERICE 5, PAYPAL 5, AFRODITA 4, BATES/EUROPA/AUTOCENTAR (rate).

**N/A po godini (2026-07-22, Review 4855):** 2022 30 (0 text), 2023 808 (232 text), 2024 946 (**793 text**),
2025 792 (**746 text**), 2026 174 (**155 text**). Po izvoru: Visa 1129 (SVE text!), MC 998 (479 text),
Racun 623 (318 text). **Resolvable (2024-26 s tekstom) ~1694; hard no-text pre-2024 ~600** (nema izvoda
tako daleko). **Plan (Saša): prvo zatvoriti 2026 → poslati u PROD da Koka nastavi u aplikaciji.**

## 2j. S107j (2026-07-22 nastavak) — consolidate_review.py: izvodi ZATVORENI, sve u Review ✅

**`consolidate_review.py` (novo):** upiše u Review sve JASNO iz Izvodi_transakcije, ostatak → sheetovi
**UNUTAR Review workbooka** (da Izvodi_transakcije.xlsx više ne treba za odluke). Match ±2 dana; ostatak:
- **DODANO 113 redaka:** 31 ZABA MASTERCARD lump ("TROŠKOVI UČINJENI MASTERCARD KARTICOM") →
  **Tip=Transfer/izmedju racuna** (Sašina ideja #1 — novac s tekućeg na karticu, itemizirano posebno MC
  izvodom, Transfer isključuje dvostruko brojanje); 65 MC + 1 Visa kartične kupovine → N/A Mastercard/Visa;
  16 ZABA/RF account tx → N/A Racun. Sort Opcija B, DV/autofilter prošireni, source_key dedup (idempotentno).
- **`Nematchano_v3` sheet (111 izvod tx, 307 redaka):** side-by-side **Source Izvod↔Review** kandidat
  (Sašin dizajn) — svaki dvojbeni izvod redak + najbliži Review redovi (Δ dana, njihov Tip/Napomena) +
  **Transfer Y/n** (default n) + **Saldo-hint**. Za odluku dup-vs-dodaj.
- **`Saldo kontrola` sheet:** po ZABA izvatku Kokin `Stanje` **na datumu zatvaranja izvatka** vs bankovni
  NOVO STANJE (izvadak se zatvara par dana u idući mjesec → NE kalendarski kraj mjeseca!). **21/31
  balansira u cent; 10 razlika:** rekurentni ±49 (multisport na granici izvatka), 2025-07 −2875 (Astrum
  priljev Koka upisala kasnije), 2026-01 +359.43 / 2025-08 +200 / 2024-09 +149 (za provjeriti s Kokom).
- **Pokrenuto:** Review 4855→**4968**; apply_rules klasificirao ~40 novih kartičnih (temu/konzum/audible…).
  Backup `pre-consolidate-20260722_102449`. **Izvodi_transakcije.xlsx više NE treba za odluke.**
- **Dorada (Sašin zahtjev):** `Nematchano_v3` reduciran na **SAMO problematične** (`v3_verdict`: ZABA
  balansiran mjesec ⇒ DUP izbačen; kartica/RF kandidat ≤7 dana ⇒ DUP; ostalo PROVJERI) — 111→**57
  zadržano** (54 dupa izbačeno), **recent-first sort** (2026/2025 gore; 44/57 su 2025-26), `Verdikt`
  kolona objašnjava zašto je zadržan. 10 ZABA-account (saldo-vođeno) + 47 kartica/RF (kandidat >7d).
- **`backfill_napomena.py` (novo):** prazna `Napomena` ← očišćen `Izvod opis` (makne "Kreditni
  transfer… (m-zaba)" prefiks + IBAN); **1870 popunjeno**, 824 ostaje prazno (pre-2024 no-text). P3 —
  ne dira ne-praznu Napomenu. Cilj: svaki potvrđeni redak čitljiv za ručnu Tip/Podtip klasifikaciju.
- **Split-screen:** Review/Nematchano_v3/Neklasificirano `freeze_panes='F2'` (pinaj A–E + header).
  **Alati identificiraju sheetove po IMENU (ne poziciji) → Saša smije slobodno presložiti tabove.**

## 3. SLJEDEĆI KORACI

1. ~~PBZ Visa split~~ ✅ S107i. ~~Fix parse_zaba_racun~~ ✅ S107j (§2h). ~~Konsolidacija~~ ✅ S107j (§2j).
   **Preostalo iz konsolidacije:** (a) `Nematchano_v3` (111) — Saša prođe side-by-side, odluči dup-vs-dodaj
   (saldo-hint pomaže); (b) `Saldo kontrola` 10 razlika — pitanja za Koku (2026-01 +359, 2025-08 +200,
   2024-09 +149); (c) bank kolone `UplataB/IsplataB/SaldoB` opcionalno (Saldo kontrola već daje kontrolu).
1c. **N/A rule-authoring petlja (`suggest_candidates.py`, v. §2i):** Neklasificirano sheet → Saša popuni
   Tip/Podtip → `--harvest` → `apply_rules` → sljedeći krug. **Prioritet 2026** (163 text N/A) pa PROD.
   Zatim 2025 (767 text) + 2024 (817 text). Visa 1130 (sve text) = najveći target. Ukupno N/A 2803
   (1979 text = resolvable, 824 no-text pre-2024 = hard).
2. **Pravila sa Sašom (iterativno) — NASTAVAK, kad PBZ Visa merge završi (Sonnet OK).**
   Prvi + drugi krug gotovi (v. §2e/§2f). Preostali kandidati: `paypal` ostatak (~45 redova,
   merchant varira — NE blanket pravilo), `spotify` ostatak, `leasing` (OTP Leasing — VEĆ
   riješeno §2f, provjeri je li još što ostalo), `bmove` (30×, nepoznat merchant — pitati
   Sašu/Koku), `keks pay` (63×, P2P transfer app — ovisi o namjeni), `zagrebparking` (45×,
   vjerojatno `auto C5/parking` — potvrditi), porez grupa (porez/prirez/dohodak — treba nov
   Tip "Porezi"? odgođeno, nije riješeno u §2f). Zamke: prekratke riječi lažno pale (`zaba`,
   `eu`); specifičnija pravila IZNAD općenitijih (rule ORDER, v. allianz&lacetti primjer §2f);
   Tip/Podtip mora postojati u Taksonomiji. Nakon svakog kruga: `--dry` prvo, provjeri
   `Pravilo run` kolonu za kontrolu.
3. ~~Provjeriti 1 preostali `[OCR?]` red~~ — ✅ riješeno 2026-07-14.
4. ~~backfill `Datum naplate` za Racun/Cash~~ — ✅ IZVRŠENO 2026-07-15.
5. ~~`sync_taxonomy.py`~~ — ✅ Saša pokrenuo 2026-07-15.
5b. ~~Preimenovanja sheet popuna + prvi pravi run~~ — ✅ IZVRŠENO 2026-07-16 (v. §2e).
5c. ~~Drugi krug pravila (Osiguranje/Allianz/Generali/Triglav/Apple/Audible)~~ — ✅
   IZVRŠENO 2026-07-17 (v. §2f).
6. **Pitanje za Koku:** 700€ isplata 2025-11-26 (v. §2c) + odluka o preostaloj N/A masi.
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
