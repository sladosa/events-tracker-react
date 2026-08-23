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
| `date_accuracy.py` | ✅ NOVO S107k | Tier A datum-sync: matchani parovi Δ=±1/±2 → `event_date` ← bankovni datum (+ `Datum naplate` follow-up ako je bio == event_date) + prazan `Izvod opis` usput. Re-sort. `--dry`. V. §2k. |
| `kartice_datum_naplate.py` | ✅ NOVO S107k | Prazan `Datum naplate` kartičnih redaka: **Visa** ← stvarni datum uplate statementa (lump M+1 / RF PBZCARD; cutoff pravilo dan≤3 bez `Izvod file`); **Mastercard** ← 11. u mjesecu M+1 (Kokino pravilo, statement iz `Izvod file`). P3. `--dry`. V. §2k. |
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

## 2k. S107k (2026-07-23) — v3 Verdikt tok + date_accuracy + visa_datum_naplate (alati NAPISANI, čeka Sašin run)

**Kontekst (Sašine odluke):** prag sitniša **5 €**; klasifikacija NEMA prag (sitniš se DODAJE pa ga
pravila klasificiraju); `Datum naplate` za Visu punimo **u Review sada** (ne tek u import generatoru);
Nematchano_v3 pass i date-accuracy su JEDAN kombinirani tok (DUP verdikt = potvrđen par ⇒ datum-sync).

**Verificiran obrazac naplate (30/30 statementa u cent):** suma kupovina PBZ statementa M ==
`PRIMLJENA UPLATA` u statementu M+1 == PBZCARD isplata sa Sašinog RF **isti dan** (≈4.–8. u M+1).

**1. `date_accuracy.py` (novo) — Tier A:** matcha sve izvod tx na Review (±2d, isti algoritam kao
consolidate); parovi s Δ=±1/±2 dobiju `event_date` ← bankovni datum; `Datum naplate` prati ako je bio
== starom event_date; usput puni prazan `Izvod opis`; re-sort. **Dry na pravom Reviewu: 360 pomaka**
(MC 254, ZABA 65, RF 23, PBZVISA 18; Δ=0 već točnih 3124).

**2. `consolidate_review.py` nadogradnja — Verdikt tok:**
- kandidati se označavaju **slobodan vs. već matchan** drugim izvod-tx (`used`) — DUP se smije
  predložiti/sinkati SAMO na slobodnog kandidata ≤31d (bug uhvaćen na test kopiji: sync je krao
  Δ0-matchane retke drugih transakcija, raw v3 rastao umjesto padao)
- **sitniš < 5 €:** slobodan kandidat ⇒ auto-DUP (izbačen iz v3, samo brojka); bez slobodnog
  kandidata ⇒ **auto-DODAJ u Review kao N/A** (parking/naknade — apply_rules ih klasificira)
- v3 kolone: `Analiza / saldo` (razlog) + **`Verdikt` dropdown DUP/DODAJ/PRESKOČI (pre-popunjen
  prijedlogom — Saša samo overridea)** + `Src` + `key`; green red `Review (matchan)` = info-only
- **`--harvest`:** pročita Verdikt PRIJE regeneracije: DODAJ → novi red (Transfer ako kolona
  Transfer='y' ili MC lump); DUP → slobodni green kandidat dobiva event_date ← bankovni datum
  (par time trajno nestaje iz v3); PRESKOČI → hidden sheet `V3 preskočeno`; prazno → ostaje
- **Test kopija, puni ciklus:** 44 za odluku (13 sitniš auto-DUP + 18 sitniš auto-DODAJ) → harvest
  prefillova (24 DUP + 20 DODAJ) → **0 za odluku**; drugi harvest idempotentan (0 grupa)

**3. `kartice_datum_naplate.py` (novo; bivši visa_datum_naplate):** puni prazan `Datum naplate`
kartičnih redaka. **Visa:** lump redci = event_date; `Izvod file` PBZVISA_ym ⇒ **egzaktni** datum
uplate statementa (lump ym+1, RF fallback); bez filea ⇒ cutoff pravilo (dan ≤3 → prethodni statement;
Kokino "račun se formira 3.–5."). **Mastercard (Sašino pitanje 2026-07-23):** prazni MC redci su oni
dodani konsolidacijom (build_row kartici ne puni naplatu) — naplata = **11. u mjesecu M+1** (Kokino
pravilo, potvrđeno: 1650/1653 njenih redaka = dan 11); svi imaju `Izvod file` MC_ym ⇒ egzaktno. P3 —
postojeće vrijednosti se ne gaze. **Dry na pravom Reviewu: 1636 popunjivo** (Visa 1571: 1311 egzaktno
+ 219 cutoff + 32 lump + 9 RF; MC 65 egzaktno); nakon harvesta više (test: MC 86). Spot-check na test
kopiji: stm 2024-09 → 2024-10-08 ✓, stm 2026-06 → 2026-07-06 ✓, 0 redaka s naplatom prije kupovine.

**Utjecaj na Saldo kontrolu (Sašino pitanje 2026-07-23) — IZMJEREN na test kopiji:** datum-syncevi
(date_accuracy + harvest DUP) pomiču Kokine retke na bankovnu vremensku liniju → razlike **10 → 7,
nijedna nova**: riješeni 2025-07 (−2875 Astrum — DUP sync priljeva u pravi izvadak), 2025-02 (−49) i
2025-08 (+200, granica izvatka). Ostaje 7: 2×±49 rekurentni multisport (2023-12/2024-02, prije MC
pokrivenosti), 2024-09 +149, 2026-01 +359.43 (prava pitanja za Koku) + 3 sitna (0.70/1.60/8.40).
Kokin `Stanje` IZNOS se ne dira — miču se samo datumi; usporedba "zadnji Stanje ≤ zatvaranje izvatka"
zato postaje točnija.

**Redoslijed pravih runova (čeka Sašin GO; Review zatvoren):**
1. `date_accuracy.py` (360 pomaka) → 2. `consolidate_review.py` (regen v3 s Verdiktom + ~18 sitniš
DODAJ) → 3. **Saša: Verdikt pass u Excelu (~44 reda, prefill)** → 4. `consolidate_review.py --harvest`
→ 5. `kartice_datum_naplate.py` → 6. `apply_rules.py` (klasificira nove N/A retke).

## 2l. S107n (2026-07-27) — AI `--run` izvršen + NALAZ: duplikati rata

### AI klasifikacija — produkcijski run IZVRŠEN

`ai_classify.py --run --only-text --effort high` (v. §1). **1593 retka** dobilo prijedlog u
**`Tip_AI` / `Podtip_AI` / `Pouzdanost_AI` / `AI run`** (nove kolone L–O, odmah desno od `Podtip`;
`Pouzdanost_AI`+`AI run` u collapsed grupi). **Model NIKAD ne piše u `Tip`/`Podtip`.**

| | |
| --- | --- |
| Opseg | 1606 N/A redaka **s tekstom** (818 bez teksta namjerno preskočeno — Sašina odluka) |
| Vraćeno | 1593 (13 bez odgovora, guard prijavio) · NEPOZNATO 196 |
| Pouzdanost | visoka **261 (16,4 %)** · srednja 239 (15,0 %) · niska 1093 (68,6 %) |
| Trošak | $1,17 (+$0,13 smoke/prekinuti run) |
| Backup | `Financije_review_20260710_1448.pre-aiclass-20260727_092128.xlsx` |

**⚠ Pouzdanost NE prati eval.** Eval je davao `visoka` na 57 % redaka; ovdje je 16 %. Nije regresija —
eval je mjeren na **već klasificiranim** redcima (prepoznatljivi merchanti), a N/A hrpa je po definiciji
ostatak koji ni Koka ni keyword pravila nisu uhvatili. Bulk-accept traka je zato tanka; pregled je
pretežno ručni, sortiran po `Pouzdanost_AI`.

Kontrola nakon upisa (skriptom, vs backup): **0 promjena u starim kolonama**, **0 AI upisa na već
klasificiran redak**, autofilter proširen `A1:Y` → `A1:AC`, `freeze_panes` netaknut, širine/outline
razine prate svoju kolonu.

**Zamke plaćene ovom sesijom:**
- `BATCH` 40 → **25** (potpunost pada s effortom). Pomaže, ali nije lijek: jedan batch je i na 25
  vratio 11/25 — guard to prijavi, ne ignorirati.
- **Kredit je pao usred runa** (19/64 batcheva) i cijeli je posao propao pri izlasku iako je 491
  predikcija bila u storeu. Popravljeno: `is_fatal()` (400/401/403 + "credit balance") ne ide u retry,
  pali batch ne ruši run, djelomičan rezultat se **zadrži i upiše**, ostatak s `--resume`.
- `openpyxl` `ColumnDimension.customWidth` je **read-only** (izvedena iz `width`).
- Skripta se ne smije zvati `inspect.py` — sjeni stdlib i ruši openpyxl importom.

### ⚠ NALAZ — duplikati rata: 8 redaka, 636,36 €

Otkriveno pri provjeri Sašinog testa T-S107m-4 (Agram). **Kad Koka ratu vodi mjesečno, a izvod sve rate
knjiži na datum kupovine, rate 2..N se udvostruče.** Dedup (`merge_pbzvisa`) i v3 Verdikt pass (±2 dana)
strukturno **ne mogu** to uhvatiti — rata je po definiciji mjesec dana odmaknuta.

Mehanizam vidljiv u retku 4500: nosi i Kokinu `Napomena` "Reg C5 1/3" **i** `Izvod opis` "RATA 01/03" —
prva rata se knjiži na datum kupovine, isti kao Kokin unos, pa ju je dedup spojio. Rate 2 i 3 nije.

**Ključ za detekciju je `Datum naplate` + iznos** (ne `event_date`) — zato ovo tek sad postaje moguće,
`Datum naplate` je 100 % popunjen od S107k.

| Izvodni red | Ručni red | Iznos |
| --- | --- | --- |
| 3665 RATA 06/06 PLODINE | 4271 "Plodine 6/6" | 24,50 |
| 3854 RATA 05/06 ŠATRAK | 4327 "AC Šatrak 5/6" | 157,03 |
| 3855 RATA 06/06 ŠATRAK | 4450 "Auto Šatrak 6/6" | 157,03 |
| 4418 RATA 02/04 LEVIS | 4528 "Traperice 2/4" | 62,50 |
| 4419 RATA 03/04 LEVIS | 4634 "Traperice 3/4" | 62,50 |
| 4420 RATA 04/04 LEVIS | 4752 "Traperice 3/4" | 62,50 |
| 4505 RATA 02/03 AGRAM | 4609 "Reg C5 2/3" | 55,15 |
| 4506 RATA 03/03 AGRAM | 4720 "Reg C5 2/3" | 55,15 |

Potvrda nije po iznosu nego po sadržaju — Kokina napomena imenuje **istu ratu**. Usput: "Traperice 3/4"
i "Reg C5 2/3" pojavljuju se **dvaput** (kopirala prethodni red, zaboravila brojač) — isti ljudski
obrazac na dva mjesta, dodatna potvrda mapiranja.

**2 lažna pozitivna, odbačena:** redovi 929 i 933 (RATA ZAKS 7,96 €) slučajno se poklapaju s "e-Zaba"
bankovnim troškom istog iznosa i datuma naplate. Različiti merchanti.

Od 159 izvodnih rata s brojem >1 samo 10 ima ručni par — ostale je Koka nije vodila, legitimno su
jedini zapis.

**Odluke (Saša):** (1) popraviti — zadržati **Kokin** redak + prepisati `Izvod opis`, izvodni u
`V3 preskočeno` (ista `DUP` semantika kao S107k); (2) dodati u `reconcile_izvoda.py` matcher po
**`Datum naplate` + iznos** uz postojeći ±2 dana, da se klasa ne vrati pri sljedećem importu.
**NIJE JOŠ IZVRŠENO.**

### Nalaz — pravilo #43 `AGRAM` ne može odrediti auto

Oba auta se servisiraju kod istog merchanta, pa keyword ne nosi informaciju o autu. Obrazac iz podataka
(**hipoteza, čeka Sašin/Kokin pregled**): **ožujak = C5** (2026. eksplicitno "Reg C5" + "Tehnički C5";
2025. identična struktura i isti iznos tehničkog 50,63), **listopad = Lacetti** (50,05 + 82,73, isti
par 2024. i 2025.). Ako se potvrdi, na `auto C5` idu redovi **1463, 3038, 3039, 3040, 3041, 4499**;
listopadski (2435, 2436, 3953, 3956) ostaju Lacetti. Rješenje za pravilo: `Iznos min/max` split
(S107h feature), jer datum nije dostupan kao uvjet.

Osim `HAK SS` (3657), **svaki** Lacetti redak s Podtipom `registracija` dolazi iz ovog pravila — tj.
pravilo je jedino što tvrdi da Lacetti uopće ima registracije.

### Nalaz — `Voćarna` (red 4512)

`Agram - voce i povrce Zagreb`, 10,33 € → pravilo #43 ga je stavilo u `auto Lacetti / registracija`.
Vočarna se slučajno zove Agram. Fix: pravilo `voce i povrce` → `Namirnice / Hrana i ostalo`, umetnuto
**IZNAD** #43 (priority-order pattern iz S107l). **Odobreno, nije izvršeno.**

### T-S107m-3: 54 vs 55 BIBERON — oba broja točna

Saša je nabrojao 54 filtrirajući po `Napomena`. Jedan redak (**4759**) ima "biberon" samo u
`Izvod opis`; `Napomena` mu je "Amsteradam". Banka kaže `BIBERON RESTORAN - RADNIČKA 49 - ZAGREB`, pa
je `Projekti` vjerojatno točno — ali bilješka je zalutala, vrijedi Sašin pogled.

### Odluka: kako označavati "PREGLEDAJ RUČNO"

**Ne nova flag-kolona** — zastava u 5000 redaka kaže *da* nešto treba pogledati, ali nikad *jesi li
gotov*; nema signala završetka pa tiho truli. **Ne `Problem` kolona** — zauzeta je parse-problemima iz
importa (`datum → fallback …`, 37 redaka), miješanje bi ubilo filtriranje.

**Dogovoreni oblik kad naraste:** zaseban sheet `Za pregled` po uzoru na `Nematchano_v3` (koji je
radio: 41 → 0) — `red | datum | iznos | Napomena | Izvod opis | Tip/Podtip sada | Prijedlog |
Odluka ▾ | Ispravak Tip | Ispravak Podtip | Zašto`, `Odluka` = `POTVRDI`/`ODBIJ`/`ISPRAVAK`
pre-popunjena gdje je stroj siguran, `--harvest` primijeni i **isprazni** sheet (prazan = nema ničega
za odlučiti), obrađeni u skriveni arhiv. Trag u Reviewu kroz postojeće: marker u `Alternativa / nap.`
+ žig u `Pravilo run`. **Nula novih kolona.** Za šačicu redaka (kao ovih 6 Agram) ne graditi — brže je
filtrirati i reći. Što god nosilo status **mora biti unutar autofiltera** (sad `A1:AC`), inače se
pri sortu raspari (zamka iz S107e).

Bulk AI pregled je drugi alat: sort po `Pouzdanost_AI` + zasebna skripta za prijenos u `Tip`/`Podtip`.

## 2m. S107o (2026-07-28) — mehanizam `AI odluka` + duplikati rata IZVRŠENI

Sesija je krenula od Sašinog pitanja "što točno da radim s T-S107n-1". Odgovor je bio da
**mehanizam za bilježenje odluke ne postoji** — test je bio neizvediv kako je napisan.

### `apply_ai.py` (novo) — kolona `AI odluka`

Dropdown `OK` / `NE` / `?` odmah desno od `Podtip_AI` (kolona `N`), unutar autofiltera.

| | |
| --- | --- |
| `OK` | `--harvest` prepiše `Tip_AI`/`Podtip_AI` → `Tip`/`Podtip` i **očisti ćeliju** |
| `NE` / `?` | ostaje — filter "nije prazno" = preostali posao (uzor `Nematchano_v3`, 41 → 0) |
| prazno | nepregledano, ne dira se |

Tvrda pravila: nikad preko postojećeg `Tip`a; par mora postojati u Taksonomiji; `NEPOZNATO`
se ne prenosi. Ispravak se piše **izravno u `Tip`/`Podtip`** — harvest preskače ne-N/A retke.
Provenijencija u **`Labela iz`** (`AI:visoka <datum>`), namjerno **ne** u `Pravilo run`: tu
kolonu `ai_classify.py --eval` čita kao "labelu je stavilo keyword pravilo", pa bi AI labele
ušle u vlastiti eval set — i to kao `rucno`, tj. baš kao pošteni benchmark. `ai_classify.py`
dodatno izbacuje `Labela iz` = `AI:*` retke iz eval seta.

**Jedinica pregleda je par, ne redak:** `visoka` = 261 redaka, ali **31 par**; tri para nose
165 (`Namirnice|Hrana i ostalo` 81, `Porezi|porez/prirez/dohodak` 47, `Razno|Kave/jelo vani` 37).
Svih 31 parova je valjano u Taksonomiji.

### `fix_duplikati_rata.py` (novo) — IZVRŠENO

8 parova iz §2l, `DUP` semantika: Kokin redak ostaje + dobiva `Izvod opis`/`Izvod file`,
izvodni obrisan, ključ u `V3 preskočeno`. Parovi se traže po **`source_key`**, ne po broju
retka, i svaki se prije diranja provjerava po iznosu + `Datum naplate` + Napomeni.

Review **5004 → 4996**; Σ Isplata 375.833,16 → **375.196,80** (−636,36 u cent); 0 razlika u
149.834 ćelija ostalih redaka. Redovi 929/933 (ZAKS) netaknuti kao lažni pozitivni.

⚠ **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** — on preskače `source_key`eve
*koji postoje u Reviewu*, pa bi obrisani duplikat vratio pri sljedećem runu. Popravljeno:
`V3 preskočeno` je sad registar koji i `merge_pbzvisa` čita (isti koji `consolidate_review.py`
već koristi za trajno odbačene tx).

### `fix_vocarna_pravilo.py` (novo) — IZVRŠENO

⚠ **Pravilo samo ne bi popravilo ništa.** `apply_rules.py` (~linija 516) preskače svaki redak
čiji je par **valjan** u Taksonomiji — `auto Lacetti | registracija` jest valjan, samo je kriv.
Zato alat radi oboje: pravilo `voce i povrce` → `Namirnice | Hrana i ostalo` na red 44 (iznad
#43 `AGRAM`, priority-order) **i** jednokratni ispravak retka. Redak nađen po `source_key` na
**4504** (bio 4512 prije dedupa — dokaz da je traženje po ključu ispravno). Ključ pogađa točno
1 redak. `Pravila` 69 → **70**.

### Usput

- `freeze_panes` `F4855` → **`F2`** (potvrđeno kao slučajan klik, §2l nalaz 6).
- **Par 4505 potvrđuje hipotezu Agram:** izvodni `RATA 02/03 AUTOCENTAR AGRAM`, `event_date`
  11.03.2026, Kokina napomena "Reg C5 2/3" → **ožujak = C5**.
- **Petlja učenja (načelno, nije građeno):** `NE` sam ne nosi informaciju; vrijednost je u
  **ispravku**. `Tip_AI` ostaje u retku i nakon harvesta, pa je ispravak rekonstruktibilan
  bez ikakve oznake (`Tip` popunjen + `Tip_AI` postoji + različiti). Put natrag: ispravci →
  `AI_KONTEKST_pitanja.txt` → bump `PROMPT_VER` → re-run samo `niska`+`srednja` (~$1).
  Ponovljivi merchanti idu u `Pravila`, ne u model. Graditi tek kad se vidi koliko ispravaka
  padne iz `visoka` trake.

## 2n. S107p (2026-07-28) — harvest `visoka` trake IZVRŠEN

Kratka sesija: Saša prošao `visoka` (261) + dio `srednja`/`niska` u Reviewu, upisao `OK`/
ispravke u `AI odluka`. Claude pokrenuo `apply_ai.py --harvest --dry` → pokazao brojke →
Saša potvrdio → pravi `--harvest`.

**Rezultat:** 347 redaka preneseno `Tip_AI`/`Podtip_AI` → `Tip`/`Podtip` (37 parova; najveći:
Namirnice|Hrana i ostalo 89, Porezi|porez/prirez/dohodak 48, Razno|Kave/jelo vani 47,
Osiguranje|Osiguranje 25, Transfer|izmedju racuna 14). 3 retka preskočena (861, 887, 3166 —
već imali ručni `Tip`, `OK` ignoriran po dizajnu `harvest()`). Backup
`*.pre-aiapply-20260728_171029`. Review i dalje 4996 redaka (harvest ne dira broj redaka).

**Preostalo po traci (Tip i dalje N/A), izmjereno nakon harvesta:** visoka **2**, srednja
**205**, niska **1023**. `AI odluka`: `(prazno)` 1586 · `?` 3 · `OK` 3.

**Namjerna odluka (Saša):** ta 3 preskočena retka ostaju trajno `OK` u koloni — harvest ih
ne čisti jer ih ne primjenjuje. Dokumentirano kao poznat slučaj, ne popravlja se.

## 2o. S107q (2026-07-29) — STRATEŠKI ZAOKRET: import prvi, klasifikacija poslije

**Nema koda.** Revizija redoslijeda cijele migracije (Opus). Odluka Saša + Claude.

### Odluka

Redoslijed je **obrnut**: `import → cutover → reklasifikacija`, umjesto dosadašnjeg
`klasifikacija → import`. **`staging_financije` se NE gradi** (S107m odluka poništena;
`sql/` i dalje staje na `032`).

### Zašto — mjerenje koje je odluku prelomilo

Backlog se puni brže nego što se prazni. Kokin tempo ≈ **147 tx/mjesec** u file-u **bez
Tip/Podtip**; snapshot Reviewa je od **2026-07-08** → divergencija danas ~3 tjedna / ~150 tx
i raste. Svaki mjesec čekanja = nova hrpa kroz puni ciklus (normalize → enrich → AI → pregled).

Suprotno tome, unos u appu ima **obavezan Tip/Podtip dropdown na unosu** → klasificira osoba
koja zna transakciju, isti dan, besplatno i s 100 % točnošću. Usporedba: AI na N/A hrpi daje
`visoka` na samo **16 %** redaka (S107n).

Saša je isti zaključak zapisao još u S107m — *"Pravi gate = mehanizam na koji Koka prelazi,
ne postotak N/A"* — ali rad S107n–S107p je i dalje išao na N/A masu.

**N/A ne blokira:** `N/A` je legitimna vrijednost u taksonomiji; redak bez Tipa i dalje nosi
datum/račun/iznos/opis/`Izvod opis`. Ovo nije novi izum nego promocija već zapisanog fallbacka
(`FINANCIJE_MIGRACIJA.md` §12.3: *"sve odjednom kao N/A pa reklasifikacija kroz D7 update flow"*).

### Tri tehnička dobitka

1. **`source_key` instabilnost nestaje umjesto da se popravlja** — nakon importa identitet je
   `event_id` (stabilan), a ne `hash(racun+datum+seq+iznos+opis)` sa `seq_per_day` problemom
   (`normalize_financije.py:202`). Prestaje biti preduvjet za bilo što.
2. **Mehanizam reklasifikacije već postoji i već je na PROD-u** — D7 (`row_hash` skip +
   update-guard, deploy 2026-07-15) je napravljen baš za ovo: export Area → `apply_rules`/
   `apply_ai` nad exportom → re-import → guard pokaže staro→novo i traži izričitu potvrdu.
3. **30 kolona je simptom, ne bolest** — ~13/30 kolona Reviewa je skela pipelinea (`Tip_O`,
   `Podtip_O`, `Izvor reda`, `Labela iz`, `Problem`, `source_key`, `Izvod file`, `Pravilo run`,
   `Pouzdanost`, `AI run`, `Pouzdanost_AI`…) i **u app exportu ne postoji**. Excel petlja nakon
   importa je lakša nego danas, bez ijedne nove tablice.

### Posljedica za `staging_financije`

Glavno opravdanje ("treba mjesto za masovni pregled koje nije Excel") pada ako podaci ionako
idu u app. Potreba koja ostaje — podskup kolona + masovno potvrđivanje AI prijedloga — postaje
**mogući feature appa nad pravim eventima** (generički koristan za svaku Areu), gradi se **tek
ako** se Excel petlja nakon importa pokaže prespora. Ne gradimo treći store između Excela i baze.

### Kritični put (v. `NEXT_SESSION_PROMPT.md` DIO 2 za detalje)

1. **Delta merge Kokinog `.xlsm`** (~90 min) — `normalize_financije.py` ima hardkodiran INPUT i
   uvijek generira NOVI Review; treba input-param + filter `event_date >` cutoff + append po
   uzoru `merge_pbzvisa.py`, uz čitanje `V3 preskočeno`.
2. **Import generator (korak 4)** — **NE POSTOJI**; `make_import.py`/`make_financije3_import.py`
   u `Obsolete/` = baza. Jedina prava rupa na putu. Dijeli `normalize` logiku s (1) → ista sesija.
3. **`Financije_all` struktura** iz `Taksonomija` sheeta + `Automations` (`Datum naplate`).
4. **Batch import, 2026 prva kao proba mehanizma** (ne kao strategija — "2026-first" je pao kao
   *klasifikacijska* strategija u S107m, ali kao *import batching* i dalje vrijedi). ~5000 eventa
   × ~10 atributa ≈ 50k `event_attributes` → ne u jednom naletu (S105 IO incident). Pod **Kokinim**
   accountom (D6).
5. **Cutover** → divergencija prestaje; Excel postaje arhiva; `.pre-*` lanac prestaje rasti.
6. **Reklasifikacija povijesti** kroz export → pravila/AI → import s update-guardom, bez pritiska.

### Cutover mehanizam = Excel roundtrip, NE `Add Activity` (nalaz istog dana)

Saša: **Koka je produktivnija u Excelu na laptopu nego u ekranu za unos.** Ovisnost
"ergonomija Add Activity" time **otpada** — aplikacija taj put već ima izgrađen.

Potvrđeno u kodu (`excelExport.ts:278–395`): izvoz aktivnosti generira **dependent dropdowne
preko INDIRECT + hidden `DropdownData` sheet**, petljom po **svim** atributima s `depends_on`
⇒ višerazinski lanci rade: **`Racun → Izvor → Status`** i **`Tip → Podtip`**. SUBSTITUTE lanac
+ `sanitizeNamedRange` transliteriraju dijakritike; `prompt`/`promptTitle` unutar limita.
Isti mehanizam kao u Review file-u, samo spojen na bazu. Uz to: `row_hash`+update-guard štite
stare retke, novi redak bez `event_id` = CREATE.

**`export_profiles` već postoji** (`areas.settings`, profil `2026_RF-Sasa`: per-kolona
`width`/`hidden`/`outlineLevel`) ⇒ potreba "podskup kolona" je **riješena**, ne gradi se.
Time pada i zadnji ostatak opravdanja za `staging_financije`.

⚠ **Rupa koju to otvara:** `set_attribute` (`attributeRules.ts`) evaluira se **samo u Add
Activity** (Edit i Import ne) → `Datum naplate` bi novim Excel retcima ostao prazan, protivno
D1 ("nitko ga ne tipka ručno"). Izlazi: (1) Koka drag-fill (zna pravilo: MC = 11. u M+1);
(2) Python korak prije uvoza — **odbaciti**, vraća Python u njenu petlju; (3) **preporuka:**
proširiti evaluaciju na Import sa semantikom "popuni samo ako je prazno" (P3-kompatibilno).

### Inventura strukture — PROD `Financije` (read-only, 2026-07-29)

`eb786029-6ceb-4c36-ad62-9851092dad10` · leaf L1 `Transakcija`
(`e546d895-5e8a-454c-96c9-5815fc2cd234`) · **357 eventa** · 13 attr defs.
Postoji i `Financije_old` (`126f84fc-…`); oba se brišu NA KRAJU (D6).

**Oblik je pravi, sadržaj taksonomije je zaostao.** Ispravno i za preuzimanje 1:1:
`Racun` (2 računa) · `Izvor` `depends_on=racun` (RF→Racun/Visa/Cash, ZABA→Racun/Mastercard/Cash)
· `Status` `depends_on=izvorplacanja` + **`default_map`** (Racun/Cash→`Izvrsen`, kartice→`Planiran`)
· `Podtip` `depends_on=tip` · `settings.automations.rata` (`date_map` {RF:3, ZABA:11},
`count_slug=brojrata`, `amount_slug=isplata`, `trigger_slug=rate`, `override_attrs.status=Planiran`)
· `export_profiles`.

**Za regeneraciju iz `Taksonomija` sheeta (65 parova / 19 Tipova):**
- `Tip` u bazi = **13 starih opcija**; fale `Osiguranje`, `Projekti`, `Zabava`, `Namirnice`,
  `Porezi`, `Investicije`.
- `Podtip.options_map` = **pre-S107g** stanje (`Medical` vs `Medical_Sasa`/`_Koka`;
  `Sportski rekviziti` vs `Sport_Sasa`/`_Koka`; `PassSport` izbačen; Audible pod `Informatika`
  umjesto pod novim Tipom `Zabava`; `Komunikacije_T-mobile`/`_T-com`, `Groblja`, `leasing` fale).
- **`Datum naplate` / `Datum kupovine` NE POSTOJE** (datetime, §8).
- `automations` nema `attribute_rules`. Višak: `Valuta`; `Smjer` ima radnu opciju `PROVJERI`.

**Put:** Structure Excel export postojeće aree → osvježi Tip/Podtip iz `Taksonomija` → dodaj
2 atributa + `Automations` red → import kao **nova area `Financije_all` pod Kokinim accountom**.

**Read-only inspekcija:** `.env.prod.local` (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) preko
`urllib`; `Tools/supabase_structure_export.py` **ne radi** u `Tools/venv` (nema `supabase` modula).

### Politika izvora podataka (odgovor na "izvodi kasne, Koka pamti novo")

**Izvodi rješavaju staro, Koka rješava novo — i ne sudaraju se.** `enrich_from_izvoda.py` piše
isključivo u `Izvod opis`/`Izvod file` i **ne može** dirnuti `Tip`/`Podtip`; `apply_rules.py`
primjenjuje se samo na retke s Tip prazan/N/A. Klasifikacija prije dolaska izvoda ne zaključava
ništa — izvod poslije samo dodaje dokaz uz već donesenu odluku. Zato: **ne čekati izvode za
retke koje Koka pamti.**

### Pravila mijenjanja redaka (provjereno u kodu 2026-07-29)

| Operacija | Prije importa | Poslije importa |
| --- | --- | --- |
| **Dodavanje retka** | Sigurno — novi dan nema sudar `seq_per_day` | Sigurno — redak bez `event_id` = CREATE |
| **Spajanje / brisanje** | Samo kroz skriptu; obrisani `source_key` **mora** u `V3 preskočeno` (uzorak `fix_duplikati_rata.py`, 183 l.), inače ga `merge_pbzvisa.py` vrati | **NE u Excelu** — `excelImport.ts` briše samo u `replace` grani kolizije (~756/~778); redak odsutan iz file-a se ne obrađuje → event tiho preživi. Spajati u appu (Delete Activity) |
| **Preimenovanje Tip/Podtip** | Jeftino: `Taksonomija` sheet → `sync_taxonomy.py` (DV) + `Preimenovanja` sheet (čuva VISOKA pouzdanost, `PREIM:` marker) | Skupo: ime živi u `attribute_definitions.validation_rules` **i** u `event_attributes.value_text` svakog eventa + `depends_on` za Podtip → Structure roundtrip + data roundtrip. Povijesni rizik S105d (BUG-SLUG-NORMALIZE) |

⇒ **Taksonomiju zaključati PRIJE importa.** Podudara se s već postojećim uvjetom iz §12.3
("struktura + taksonomija moraju biti kompletne od prvog importa").

### Preporuka za sesiju s Kokom

- **`niska` traka (1023), ne `srednja` (205)** — `srednja` se može sama, `niska` je gdje je model
  nesiguran i gdje je **njeno sjećanje jedini izvor**; te su transakcije 2023–2025, dakle upravo
  one kod kojih sjećanje trenutno curi. Novih ~150 redaka je sigurno još mjesec dana.
- **Formulacije taksonomije riješiti dok je prisutna** (v. tablicu gore).
- **Ako stigne — login + jedna ručna transakcija** = mjerenje jedine otvorene ovisnosti.
- **Rad na `AI odluka` nije bačen** — `apply_ai --harvest` piše u `Tip`/`Podtip` Reviewa, a Review
  je ono što se uvozi. Što stigne do importa ide klasificirano, ostatak kao N/A. Promijenilo se
  samo to da to više nije *gate*.

## 2p. S107r (2026-07-30) — MIGRACIJA NA KOKINU TAKSONOMIJU (izvršeno)

**Povod.** Koka je u sesijama sa Sašom klasificirala dosta redaka, ali je imala primjedbu na
taksonomiju. Saša je duplicirao sheet (`Taksonomija` → `Taksonomija (2)`) i pustio je da je
složi po svom. Rezultat: **18 Tipova** — novi `Kuća`, `Prihodi`, `Prijevoz`, `Advokati`;
ukinuti `Namirnice`, `Mirovina`, `Povrat`, `Ostali prihodi`, `Ostavine`.
**2061 od 3426 klasificiranih Review redaka (58 %)** nosilo je par kojeg više nema.

**Zašto poseban alat, a ne samo `Preimenovanja`.** Sašino pitanje je bilo može li se
`Preimenovanja` iskoristiti za ovo, i može — ali pokriva samo **jedno od četiri** mjesta gdje
ime taksonomije živi. Bez ostalih triju:
- `Pravila` — 37 od 70 pravila ima nevaljan par; `read_rules()` ih **tiho preskoči** →
  izgubio bi se cijeli S107l/S107h posao (uklj. pravilo `grobn` namjerno umetnuto **iznad**
  `NAKNADA`)
- `Tip_AI`/`Podtip_AI` — 911 predikcija; `apply_ai --harvest` odbija par kojeg nema u
  Taksonomiji → $1,17 + Sašin pregled postaju neupotrebljivi
- `Neklasificirano` — 10 popunjenih redova, isti problem pri `--harvest`

⇒ **`migrate_taksonomija.py`** (novo): jedna mapping tablica (`MAP`, 33 reda) primijenjena na
sva četiri mjesta, jedan `wb.save()` = atomično. **Nema "training runa"** — remap je
deterministički rewrite; jedino stvarno model-side je AI re-run, i to **poslije** zamrzavanja.

**Tri rupe u `Preimenovanja` koje je ovaj obim otkrio** (sve popravljene u `apply_rules.py`):
1. **Prioritet `Pravilo > Preimenovanja` radi protiv nas** kod masovne migracije — uveden u
   S107g za obrnutu situaciju (preširok blanket rename). Nad 2061 nevaljanim retkom × 70
   pravila prepisao bi Kokine ručne odluke i spustio `VISOKA` → `PRAVILO`.
   ⇒ **`--only-renames`** flag: pravila se uopće ne čitaju.
2. **Nema uvjeta osim `Racun`** — a tri Kokine odluke traže druge:
   `Povrat|Anja` = 41 Uplata od **450 €** → `Prihodi|Povrat Anja`, ostalo (uklj. **2 Isplate
   od 450**, koje nisu povrat) → `Transfer|Anja`; `Povrat Nataša` = 41 s `Nataša Holding` u
   napomeni → `Kuća|Holding (smeće)`, **3 bez toga** → `Transfer|Natasa`; `Groblja` = Nena vs
   Nataša iz napomene.
   ⇒ nove opcionalne kolone **`Smjer uvjet`**, **`Iznos min`**, **`Iznos max`**,
   **`Napomena uvjet`** — AND-ane, prvi red pobjeđuje, uvjetni redovi idu **iznad**
   bezuvjetnog za isti par. Stari 7-kolonski sheet radi nepromijenjeno (kolone po imenu).
3. Pozicijski fallback za `Novi Tip`/`Novi Podtip` bi u sheetu s uvjetnim kolonama pročitao
   `Smjer uvjet` kao `Novi Tip` ⇒ te su kolone sad **obavezne po imenu**.

**Kokine odluke (mapping):** `Namirnice|Hrana i ostalo` → `Domaćinstvo|Hrana i ostalo` (716,
uklj. sredstva za čišćenje/higijenu) · `Domaćinstvo|*` komunalno → `Kuća|*` · `auto C5|parking`
+ `Razno|Taksi` → `Prijevoz|Taksi, Zet, Parking` (200; "ne da se pratiti za koji auto je
parking") · `Domaćinstvo|Investicije` → `Kuća|Popravci, održavanje, osiguranje` (72; IKEA/
namještaj/kućni hardver — `Investicije` su od sad samo štednja/dionice) · `Mirovina|*` →
`Prihodi|*` · `Ostali prihodi` → `Prihodi|Koka`/`Saša` po računu · `Osiguranje|Osiguranje` →
`Zivotno` · novi par **`Investicije | Štednja`** (Sašin red 550 € "Stednja", odljev u
kategoriji prihoda).

**Dvije stvari koje su tek `--dry` runovi otkrili:**
- `auto Lacetti|parking` ima **0** redaka u `Tip` ali **8 predikcija** u `Tip_AI` → mapping
  izveden iz stvarnih `Tip` vrijednosti je imao rupu; dodan red (33. u `MAP`).
- **Odluka koja nije u sheetu ne postoji:** Koka je *rekla* da ukida `Domaćinstvo|Investicije`,
  ali red je još stajao u `Taksonomija (2)` → par ostaje valjan → rename se **nikad ne bi
  aktivirao** (ista klasa kao zamka "pravilo ne popravlja redak s valjanim parom"). Saša ga
  obrisao pa je nevaljanih 1989 → **2061** (+72 = točno koliko taj par nosi).

**`grobn` pravilo — zadržano i preusmjereno** na `Transfer|Natasa` (ne obrisano): prag po
iznosu **ne razdvaja** grobnu naknadu (26–28 €) od bankovnih (0,13–50 €), pa nema čistog
čuvara; postojeća 3 retka su nakon renamea valjana i time trajno imuna, a za hipotetsku buduću
pojavu je "Natasa umjesto Nena" **vidljiva** greška, dok bi bez pravila `NAKNADA` zakopala
grobnu među 102 bankovne naknade.

**Rezultat (sve kontrole u `docs/sessions/tests/S107r_tests.md`):** 2061 preimenovano,
0 resetirano na N/A, **0 preostalih nevaljanih parova** ni u `Tip` ni u `Tip_AI`;
`Pouzdanost` distribucija **identična** (`VISOKA` 1014 → 1014) = nijedno pravilo nije
pregazilo ručnu odluku; `Tip_O`/`Podtip_O` netaknuti; Σ Uplata/Isplata **delta 0,00**;
`Pravila` 70 → **71** (Anja split), 0 preskočenih. Novi `Tip` raspored: N/A 1570,
`Domaćinstvo` 965, `Kuća` 349, `Transfer` 301, `Razno` 272, `Prihodi` 262, `Prijevoz` 200.

**Usput:** `sync_taxonomy.py` sad **garantira** `freeze_panes` (`F{HEADER_ROW+1}`) jer je
odlutao treći put (F2 → F4855 → F2 → F84); DV rasponi konsolidirani iz **26 fragmenata s
~30 rupa** (redaka bez dropdowna!) u 2 čista. Novo: `Tools/backup_to_external.bat` —
**additive** robocopy (`/E /XO`, **bez** `/MIR`, jer mirror prenese i lokalno brisanje na
jedinu drugu kopiju) za `data-prep_data/` + `Claude-temp_R/`; oba su gitignorirana pa je
disk jedina druga kopija. Vanjski backup napravljen **prije** i **poslije** migracije.

**Otvoreno iz ove sesije:** layout faza 1 (`sheet_layout.py` — header red 3, freeze,
collapsed help; header red 1 hardkodiran u **15** skripti, **12 kopija** funkcije za traženje
kolone ⇒ prvo čitači tolerantni na raspored, pa promjena rasporeda). AI eval baseline
(81,5 % / Tip 92,3 %) **više ne vrijedi** — mjeren na staroj taksonomiji.

## 3. SLJEDEĆI KORACI

⚠ **Prioriteti ispod su prekrojeni odlukom §2o (2026-07-29).** Novi glavni redoslijed je
kritični put iz §2o (delta merge → import generator → struktura → batch import → cutover →
reklasifikacija). Stavke ispod ostaju važeće kao *sadržaj* posla, ali **nijedna od njih više
nije uvjet za početak importa.**

0. **(S107n odobreno)** ~~(a) fix 8 duplikata rata~~ ✅ S107o · ~~(c) pravilo `voce i povrce`~~ ✅ S107o ·
   **(b) `reconcile_izvoda.py` matcher po `Datum naplate`+iznos — JOŠ OTVORENO** (ne dira Review) ·
   (d) Sašin pregled Agrama pa `Iznos min/max` split pravila #43 (ožujak=C5 već potvrđen preko 4505).
1. ~~PBZ Visa split~~ ✅ S107i. ~~Fix parse_zaba_racun~~ ✅ S107j (§2h). ~~Konsolidacija~~ ✅ S107j (§2j).
   **Preostalo iz konsolidacije — SADA KROZ §2k TOK:** (a) pravi runovi date_accuracy → consolidate →
   **Saša Verdikt pass (~44 reda)** → --harvest → kartice_datum_naplate → apply_rules; (b) `Saldo
   kontrola` 10 razlika — pitanja za Koku (2026-01 +359, 2025-08 +200, 2024-09 +149); (c) bank kolone
   `UplataB/IsplataB/SaldoB` opcionalno (Saldo kontrola već daje kontrolu).
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

---

## 5. S110 (2026-08-17) — provjera lanca salda protiv ispisanih izvoda

**Nov alat: `make_saldo_anchors.py`.** Čita ispisano `NOVO STANJE` s 31 ZABA izvoda
(2023-12 … 2026-06) i upisuje ga u `balance_anchors`. Ponovno koristi `_parse_zaba_all`
iz `enrich_from_izvoda.py` — nije pisan nov parser.

```
run.bat make_saldo_anchors.py             ispisana stanja + provjera lanca izvoda
run.bat make_saldo_anchors.py --report    app (RPC) vs banka, po izvodu
run.bat make_saldo_anchors.py --anchor 2025-01-01
run.bat make_saldo_anchors.py --load-all  (⚠ tek nakon reporta — v. zamku 2)
```

**Rezultat:** lanac izvoda **neprekinut** kroz sva 31 (`novo[i] == pocetno[i+1]`).
App reproducira banku do centa: `2.546,55` na 31.03.2025., `3.403,74` na 08.07.2026.

### 5.1 Tri zamke (sve izmjerene, ne pretpostavljene)

1. **Izvod se NE zatvara na kraju mjeseca** — `ZABA_2024-12` → `2025-01-01`,
   `ZABA_2025-12` → `2025-12-24`. `confirmed_on` mora biti *close date izvoda*.
2. **Sidro NA datum usporedbe čini provjeru tautološkom** (`balance == amount`).
   `--report` to detektira i označi `SIDRO (nije provjera)`. **Prvo provjera, sidra poslije.**
3. **RF nije pokriven** — OCR, `T-S107d-6` otvoren. Ne uvoditi „radi konzistentnosti".

### 5.2 Popravci Reviewa

- `fix_koka_datum_200.py` — Kokina tipfelerica u godini: podizanje `200,00` s bankomata
  `2026-05-29` → `2025-05-29` (+ `Datum naplate`). Dokaz: `ZABA_2025-05` ima **dva** podizanja
  po 200, Review je imao samo prvo; `ZABA_2026-05` nema nijedno; Kokin `Stanje` (925,33) ga
  smješta u svibanj 2025.
- `align_review_s110.py` — Review usklađen s ručnim unosima u app: Tip/Podtip na onoj 200
  (`Transfer` / `cash - bankomat`), `Status = Izvrsen` na parkingu 1,60.

Oba alata: uski potpis retka, staju ako ne pogode **točno jedan**, rade backup, i ne diraju
`Stanje` (Kokin neovisni svjedok) ni `source_key` (vezan uz već uvezeni redak — svjež ključ bi
prekinuo idempotenciju `merge_pbzvisa.py`).

### 5.3 ⚠ Pravila iz §4 su zastarjela

Dva pravila iz „Pravila okruženja" više ne vrijede doslovno, i S110 ih je svjesno prekršio
uz Sašino odobrenje:

- **„Nikad ne mijenjati postojeće vrijednosti Review sheeta osim Tip/Podtip/Pouzdanost/
  Alternativa…"** — S110 je mijenjao i `event_date`, `Datum naplate`, `Napomena`, `Status`.
  Pravilo je pisano za pre-import fazu; ispravljanje **dokazane** greške u datumu je druga
  stvar od prekrajanja klasifikacije. I dalje vrijedi: samo kroz skriptu, s backupom i s
  potpisom koji pogađa točno jedan redak.
- **„NE pisati ništa u bazu — sve ovo je pre-import review faza"** — 2025 i 2026 su
  **uvezeni**. Review je sada *paralelni izvor* koji se mora održavati u skladu s bazom,
  inače sljedeći uvoz tiho vrati staro (update-guard gleda `row_hash`).

### 5.4 Poznato odstupanje — ne istraživati ponovo

`−200,14` na ZABA lancu 2025-08 → 2026-04: četiri retka bez opisa i bez bankovne protustavke.
Puni nalaz, provjere i odluka: `SALDO_MODEL_NALAZI.md` §6.3.

## S113 (2026-08-21) — tranša 1 potvrđena izvodom, `fill_from_izvod.py`

- **Tranša 1 uvezena i potvrđena izvana.** `RF_2026-07.pdf` (OCR) sadrži svih 7 redaka u cent,
  uključujući ispravak `250,93 → 253,51`. Ispisana stanja s izvoda poklapaju se s kontrolnim
  stupcem delta sheeta redak po redak (`715,33 … 1.716,55`, pa `544,96 → 544,79 → 799,12`).
- **`rf_ocr.py` zadržava ispisano stanje** (`stanje_izvod`). Dosad se koristilo za
  chain-validaciju pa bacalo — a to je jedini broj u lancu koji nije izračunat iz naših
  zapisa, dakle jedini legitiman izvor za sidro salda.
- **Novo: `fill_from_izvod.py`** — puni app-ov Excel (delta sheet ili export) retcima s izvoda,
  **po imenu zaglavlja**, pa raspored kolona (profil, skrivene kolone) ne igra ulogu.
  Dedup protiv redaka koji su već na listu, s **tolerancijom na datum** (±3 dana).
- **Nalazi tranše 2:** Visa naplata je `07.08.` (ne 11.08.), uz nju ide `0,17`, a `11.08.`
  stiže `+254,33` (Mirovina III) — Kokina brojka `799,12` je točna, sastav nije bio.
  Visa košara: **47 kupovina, Σ `1.171,59`** — u cent jednako naplati na RF izvodu.
- **`Mirovina III stup` ima na izvodu `09.07.`, u bazi `10.07.`** — isti redak, dan razlike.
  Alat ga prepoznaje i preskače; popravak je izmjena datuma u bazi, ne novi redak.

**Nastavak S113 (isti dan):**

- **Tranša 2 uvezena** — 3 Racun retka (07.08. `−1.171,59`, 07.08. `−0,17`, 11.08. `+254,33`) +
  45 Visa kupovina. RF na 11.08. = **799,12**, jednako ispisanom stanju na `RF_2026-07.pdf`.
  Sidro postavljeno na 11.08.
- **`fill_from_izvod.py` dobio `--zaba`, `--protiv`, `--koka`.** Dedup ide protiv redaka na listu
  **i** protiv zasebne reference; bez `--protiv` kartični izvod duplicira sve što je Koka već
  upisala (delta sheet ne sadrži kartične retke, a saldo grešku ne osjeti).
- **Opisi dolaze iz Kokine Excelice**, sparivanjem po `(iznos, datum)` s **nesimetričnim**
  prozorom `−3 / +45` dana. Simetričnih ±3 dana: 0 od 47 spareno; ovako 36.
- **Njene dvije kolone datuma:** `Datum` (C) = dan kad novac napusti račun; dok naplata nije
  poznata, C je prazan i dan troška stoji u koloni **G** (22 takva retka na 16.08.).
- **Za tranšu 3 spremno:** `ZABA_2026-07.pdf` → 37 novih redaka, ispisano `NOVO STANJE`
  **13.815,33** na 30.07.


## S114 (2026-08-22) — tranša 3 (ZABA), klasifikacija iz izbrojane povijesti

- **Tranša 3 zatvorena protiv ispisanog broja.** `ZABA_2026-07.pdf`: 38 tx, 7 već u bazi,
  **31 novih**. `2.255,64 + 11.559,69 = 13.815,33` = ispisano `NOVO STANJE` @ 30.07.
  Uvoz `31 New / 1 Modify / 7 Unchanged`; `1 Modify` = planirana MC naplata `1.244,74` → `Izvrsen`.
- **⚠ Kontrolni stupac ne broji `Planiran`.** Dok naplata nije potvrđena u sheetu, kontrola je
  davala `15.060,07` — točno `1.244,74` previše, i to je izgledalo kao greška u podacima.
- **`--koka` je na ZABA izvodu bio mrtvo slovo** — `zaba_rows()` je primao `koka` i nikad ga
  nije pozvao. Ispis je pritom govorio `0 spareno, 0 bez para`, dakle „nije pokušano" se čitalo
  kao „pokušano bez pogotka". Spojeno; **30 od 38 spareno**.
- **Prozor sparivanja ovisi o izvoru:** kartice `−3/+45`, tekući račun **`0/+1`**.
  Široki prozor bi na tekućem dopustio da `Cash 100,00` pokupi opis kasnijeg podizanja.
  `+1` je nužan: `Zoran povrat 9,51` je na izvodu 17.07., kod nje 18.07.
- **Nalaz: ona agregira ondje gdje banka dijeli.** `Parking 1,40` (13., 27., 30.07.) = **dva**
  bankina naloga po `0,70`. Ključ `(iznos, datum)` ih ne može naći, a njihov strojni tekst vodi
  na `Domaćinstvo / Bankovni troškovi` (12× u povijesti) — krivi razred, i to uvjerljivo.
- **Novo: `klasificiraj_transu.py`** — puni `Tip`/`Podtip` u app-ovom **izvještaju o uvozu**
  (radni file s `row_hash`om, uvozi se natrag). Mapiranje je izvučeno prebrojavanjem Reviewa,
  a **svih 18 parova se provjerava protiv `DropdownData` lista prije upisa**.
  Uvoz: `0 New / 28 Modify / 4 Unchanged`.
- **`845,12` razriješen negativno** — nije na srpanjskom ZABA izvodu i nema ga nigdje u Kokinom
  fileu. Ostaje `Planiran` (ne dira kontrolni broj), pitanje za nju.
- **Zatečeno:** dva njena retka datirana `2036-04-08` (`Mirovina 1.323,64`, `Netdomena Igor
  47,76`) — tipfeler za 2026., isti razred kao S110 nalaz.


## S115 — 2026-08-22 (druga sesija) · mjerenje, bez alata

Sesija bez koda; sve navedeno je **izmjereno**, ne procijenjeno (read-only skripte nad TEST
bazom + `openpyxl` nad trima verzijama Kokinog filea).

- **`845,12` OBRISAN — i to je ispravak prošlog zaključka.** S114 je rekao „nema ga u Kokinom
  fileu ⇒ ostaje `Planiran`". Pretraga **svih triju verzija** pokazala je da postoji u najstarijoj
  (`Financije 2026.xlsx`, 08.07.), i to kao redak **bez datuma i bez opisa** — ostatak, ne
  transakcija. U bazi: `Tip = N/A`, bez `Datuma naplate`. Obrisan.
  ⇒ **Razred:** redak koji izvor obriše nakon uvoza ostaje u bazi zauvijek. Uvoz obrađuje ono
  što piše, ne ono što je nestalo. Jedini alat protiv toga je usporedba verzija izvornog filea.
- **Retci iz 2036. NE idu kroz „popravi godinu pa uvezi".** `1.323,64` i `47,76` **već postoje**
  u bazi kao `2026-04-08` (`Prihodi/Koka`, `Informatika/Hosting domene`), ušli travanjskim
  izvodom. Ispravak + uvoz bi ih udvostručio, i to tiho — padaju prije ZABA sidra pa ne bi
  pomaknuli nijednu kontrolnu brojku. Popravak ide **u njen file**.
- **Razmak baze i njenog filea** (`Financije 2026-08-16.xlsx`, nakon 30.07.):
  „koka EU" **87** redaka, „sasa EU" **68**; u bazi od toga **6**. Zadnji zapis: ZABA
  `2026-07-30`, RF `2026-08-11`. MC naplata `1.332,52` **nije u bazi**.
  ⇒ Tranša 4 je narasla iz „MC paket" u „MC paket + cijeli kolovoz".
- **Sidro ZABA je krivo datirano** (`22.08.` umjesto `30.07.`, iznos točan) — BUG-S115-ANCHORDATE.
  Alat `make_saldo_anchors.py` to radi ispravno (`confirmed_on` = close date izvoda); grešku
  proizvodi **pločica u aplikaciji**, koja žigoše dan koji se gleda.
- **Izvodi su samo PDF** — ZABA ni PBZ ne nude CSV/Excel (potvrdio Saša). Znači: čitanje izvoda
  ostaje ovdje, u Pythonu; u aplikaciju seli ono poslije čitanja — **pravila u bazi i evaluacija
  na uvozu** (Faza 3).

## S116 (2026-08-23) — `--iz-koke`, alat za sidra, kolovoz izmjeren

**Novi izvor: `fill_from_izvod.py --iz-koke`.** Za kolovoz izvoda nema do rujna, pa je po D-2
Kokin file autoritet i za iznos i za datum — jedini put kad to vrijedi. Nije nov alat:
`Target` i `write_rows` već nose sve zamke (prazni retci bez `Area`, autofilter, kolizije
vremena, pravi bool), dodan je samo izvor.

Zastavice: `--sheet`, `--tip-racuna` (vrijednost njene kolone A), `--klasificiraj`
(Tip/Podtip iz `PO_OPISU`, dijeli se s `klasificiraj_transu.py`), `--osim` (brojevi redaka),
`--lanac DATUM=IZNOS` (mehanička provjera D-2).

**Izmjereno na `Financije 2026-08-23.xlsx`** (3.735 redaka):

| | |
| --- | --- |
| nakon 30.07. | **175** · ZABA 17, RF 6, MC 80, Visa 72 |
| stvarno novih za uvoz | ZABA **14**, RF **1** |
| njen lanac ZABA 31.07.→13.08. | `13.815,33` → **`13.239,31`** = kontrolni broj tranše 4 |
| njen lanac RF nakon 11.08. | `799,12` → **`796,43`** |

**Nalazi ugrađeni u kod:**

- **Lanac salda gleda SAMO kolonu C.** `C or G` dao je `12.983,69` umjesto `13.239,31` —
  promašaj za točno zbroj nenaplaćenih kartičnih stavaka, koje kolona G datira danom troška.
  Za `event_date` vrijedi obrnuto (D1b: dan kupovine ⇒ G).
- **Njen model ≠ naš.** Ona tereti račun svakom kartičnom stavkom; banka skida jednu skupnu
  naplatu. Zbroj se poklapa u cent (45 MC stavki 11.08. = `1.332,52` = iznos s `MC_2026-07.pdf`),
  model ne. Zato `Izvor` određuje **kolona A** njenog sheeta.
  ⚠ I zato je njen lanac **svjedok**: dva modela koja broje različito a daju isti broj
  potvrđuju jedan drugoga; isti broj iz istog modela ne potvrđuje ništa.
- **Redak 2564 (`07.08. Parking 1,60`) je tipfeler u mjesecu.** Tri neovisne potvrde:
  `Parking` već u bazi na **07.07.**, njen `Stanje` stupac ga računa među srpanjskima
  (`2.142,74`), i lanac **bez** njega daje točno `13.239,31`. ⇒ `--osim 2564`.
- **Tipfeleri u godini nisu samo 2036.** Nađen i `2028-05-16` (`HLK 5/26`). Alat ih izdvaja
  i ispisuje, nikad ne popravlja — ispravak ide u njen file (S115).
- **103 njena retka nose datum kao TEKST** (`'11.05.23.'`, `'28.6.23.'`, `'29.2.2024.'`), svi
  iz **2023.** Ne diraju kolovoz, ali batch 2023 bi ih progutao bez ijedne poruke.
- **`--iz-koke` se ne kombinira s izvodom:** gdje se razilaze (~4 % redaka) nema pravila koje
  bi presudilo, pa jedan prolaz nosi jedan autoritet.

**Novi alati:**

- `anchors.py` — popis sidara s oznakom `►` (koje danas vrijedi), `--delete`, `--add`.
  Popunjava rupu iz Backloga na razini skripte; UI je u istoj sesiji dobio isto
  („povijest potvrda" + ✕), pa je ovo sada alat za rad izvan aplikacije.
- `set_list_columns.py` — prvi upis `settings.list_columns` (merge, ne overwrite).
- `Tools/audit_tests.py` — usklađuje `PENDING_TESTS.md` s `docs/sessions/tests/`;
  odgovara na „što je spremno za arhivu".

**Uvoz NIJE izveden** — pripremljeno, kontrolni brojevi gore, koraci u
`docs/sessions/tests/S116_tests.md` T-S116-7/-8. Ide u sljedeću sesiju.
