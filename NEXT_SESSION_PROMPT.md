# NEXT SESSION PROMPT — Financije: AI klasifikacija, produkcijski run

**Prethodna sesija: S107m (2026-07-26).** Izmjeren je AI pristup klasifikaciji, očišćene su
labele, napisan je alat. **Odgovor na pitanje "isplati li se AI" je DA, kao predlagač** —
i to sad znamo mjereno, ne po osjećaju.

## Kontekst pročitaj ovim redom
1. `CLAUDE.md` — blok "Done 2026-07-26 (S107m)"
2. **ovaj file** — brojke, zamke, što je otvoreno
3. `Claude-temp_R/test-sessions/S107m_tests.md` — koraci i kontrole
4. `data-prep_tools/Financije/ai_classify.py` — docstring + `SYSTEM` prompt

---

## GDJE SMO — izmjereno, ne procijenjeno

Eval je **naslijepo** na već klasificiranim redcima, na **zamrznutom stratificiranom uzorku
od 600** (`--sample 600`, `EVAL_SEED=20260726`) — isti uzorak svaki put, pa su runovi usporedivi.

| Verzija prompta | Ručne labele — par | Ručne — Tip | `visoka` točnost / pokrivenost | Trošak |
| --- | --- | --- | --- | --- |
| v1 (samo popis kategorija, cijelih 2525) | 62,5 % | 79,7 % | 84,8 % / 51 % | $1,91 |
| v2 (+ Sašin kontekst file) | 80,3 % | 88,3 % | 92,7 % / 57 % | $0,57 |
| v3 (+ tvrda pravila), effort medium | 80,8 % | 91,9 % | 95,0 % / 47 % | $0,77 |
| **v3 + `--effort high`** ← ODABRANO | **81,5 %** | **92,3 %** | **95,2 % / 57 %** | $0,73 |

**Zašto `high` pobjeđuje:** točnost je unutar šuma (+0,7 pp), ali `visoka` pokriva **57 % umjesto
47 % redaka uz istu preciznost od 95 %** — deset postotnih bodova više ide u bulk-accept traku,
a to je izravno manje posla za Sašu. Cijena je ista. **Produkcijski run vrtjeti s `--effort high`.**

⚠ **Potpunost pada s effortom:** vraćeno 600 → 577 (medium) → 550 (high) redaka od 600.
Guard to prijavljuje, ali prije produkcijskog runa **treba istražiti zašto** — vjerojatno smanjiti
`BATCH` s 40 na ~25.

**Kako čitati:** v1→v2 je pravi skok i dolazi od Sašinih objašnjenja, ne od modela.
v2→v3 nije pomaknuo točan par (razlika ≈ 1,5 retka = šum) ali jest Tip (+3,6 pp) i
preciznost `visoka` (+2,3 pp). **To je granica povrata od dorade prompta.**

**Pragovi postavljeni PRIJE mjerenja:** 95 %+ → puna automatika · **~80 % → model predlaže,
čovjek potvrđuje** · <70 % → taksonomija je problem. **Sletjeli smo u srednju kategoriju.**

Radna podjela koja iz toga slijedi (nema smisla fiksni prag — sortira se po pouzdanosti):
```
visoka   47 %  ·  95 % točno   →  bulk-accept + pregled na uzorku
srednja  11 %  ·  63 % točno   →  pregled
niska    38 %  ·  65 % točno   →  pregled
```

Preostale greške su uglavnom **neizvedive iz teksta**: koji auto (`auto C5 ↔ Lacetti`, D8
default), atribucija osobe kod mirovine, i nešto šuma u samim labelama.

---

## ŠTO JE NAPRAVLJENO U S107m

### 1. Očišćene labele — 223 retka (`apply_label_fixes.py`, IZVRŠENO)
Eval je otkrio da dio "grešaka modela" nisu greške modela:
- **171 redak imao je Tip bez Podtipa** — par koji ne postoji u Taksonomiji, pa ga model
  nije mogao ni vratiti. `apply_rules.py` ih nikad nije prijavio jer njegova validacija
  preskače prazan Podtip. **Sad 0.**
- **BIBERON je bio 33/22 nedosljedan** (isti restoran, ista adresa, dvije različite labele).
  Sad 55/55 `Projekti | Sasa_Informatika`.
- Nova Taksonomija: **`Investicije | Dionice`** (Sašino ime; napomena: sudara se s postojećim
  Podtipom `Domaćinstvo | Investicije` — 4 retka, trivijalno preimenovati ako zasmeta).

Backup: `Financije_review_20260710_1448.pre-labelfix-20260726_145103.xlsx`.
Svaki dirani redak nosi žig `2026-07-26` u `Pravilo run` i marker `fix-2026-07-26: <pravilo>`
u `Alternativa / nap.` (P3 — stara vrijednost dopisana, ne pregažena). `Tip_O`/`Podtip_O` netaknuti.

**Odluke koje su to omogućile (Saša):** Visa → `Transfer | izmedju racuna`; BIBERON sve u
Projekti; Konzum+Radnička **< 30 €** → Projekti; Putovanja → `Restoran`; pričuva → Transfer;
Dionice → novi Tip; Audible prag ostaje 10 €. **Ašo/Aso** (25 redaka, 24× točno 20 €) je bio
personal trener → `Zdravlje | Sport_Sasa`. **SS = Saša Sladoljev, DPS = Dubravka Pavić-Sladoljev.**

### 2. `AI_KONTEKST_pitanja.txt` — Sašini odgovori (NAJVRJEDNIJI ARTEFAKT)
`data-prep_data/Financije/AI_KONTEKST_pitanja.txt`, generiran s `make_context_questions.py`,
popunio Saša. Sadrži: značenje `N/M` (rata N od M, 354 retka), Bulatova 19 = kuća s tri
kućanstva (zato Nataša/Zoran vraćaju svoj dio), e-Zaba do ~15 € = bankovni trošak a iznad
ostaje N/A, Temu/BOLT/Konzum glosar, Radnička 49 = Sašino radno mjesto.

**Ide u prompt DOSLOVNO, ne parsira se** — Saša je odgovarao inline uz stavke, ne iza
`ODGOVOR:`, i svaki parser bi nešto pojeo. 22 410 znakova, kešira se.

### 3. `ai_classify.py` — alat
```
--eval                 obavezno; naslijepo na klasificiranim redcima, NE PIŠE u Review
--sample 600           zamrznut stratificiran uzorak (pola ručnih / pola pravilo)
--limit N              nasumičnih N (smoke test)
--resume               preskoči što store već ima za isti prompt_ver+model+effort
--only-conf niska      ponovi SAMO nesigurne, jačim configom
--effort low|medium|high|xhigh        --model, --workers
```
Store: **`ai_predictions.jsonl`**, append-only, **ključ = `source_key`** (NE broj retka —
retci se pomiču pri re-sortu). Zapis: key, row, run_id, prompt_ver, model, effort, par, conf, ts.
`PROMPT_VER` se bumpa pri svakoj promjeni prompta; predikcije iz starije verzije se ne recikliraju.

---

## ⚠ ZAMKE — sve su plaćene otkrićem, ne ponavljaj ih

1. **`effort: low` vraća 1 rezultat na 40 redaka**, uz uredan `stop_reason: end_turn` i bez
   greške. Sonnet 5 čita upute doslovno i ne generalizira s prve stavke na ostale. Rješenje
   u kodu: broj redaka i popis ID-eva **eksplicitno** u user poruci + `classify()` doziva
   nedostajuće i **glasno prijavljuje** ako ih i dalje nema. **Nikad ne vjeruj da je odgovor
   potpun — usporedi broj poslanih i vraćenih redaka.**
2. **Structured-output `enum` NIJE obvezujuć.** Model je vraćao `Hrana I ostalo` (veliko I)
   iako taj par nije u enumu od 64. U kodu postoji normalizacija natrag na kanonski par.
3. **`python - <<PY` patchevi znaju tiho ne pogoditi**, a `py_compile` svejedno prođe —
   pa izgleda kao uspjeh. **Uvijek provjeri `grep`-om da je zamjena stvarno primijenjena**,
   ne samo da se kompajlira. Za izmjene koda koristi Edit alat, ne heredoc patch.
4. **`date_accuracy.py` je bezuvjetno gazio `freeze_panes = 'F2'` na Reviewu** — popravljeno,
   više ne dira korisnikovu postavku.
5. **Preširoki keyword** (isti obrazac kao `NAKNADA`/`grobn` iz S107l): Konzum+Radnička<30 €
   hvatao je i 22 retka `RATA nn/mm`, a rata od 18 € je dio kupovine od 180 € — nije ručak.
   Izuzeto.
6. Eval mora dati **DVA broja** — od 2580 labela ~1414 je od `apply_rules` (keyword =
   trivijalno predvidljivo, napuhuje). Odluka se donosi na **ručnim** labelama.
7. **`ai_eval_neslaganja.tsv` se PREPISUJE pri svakom runu** — ako trebaš usporedbu, kopiraj ga.

---

## OTVORENO — prvo pitanje za sljedeću sesiju

### A. `--run` mode NE POSTOJI (glavna rupa)
Docstring ga spominje kao "dolazi kasnije". Treba napisati: čita N/A retke (2424), zove model,
piše **`Tip_AI` / `Podtip_AI` / `Pouzdanost_AI` / `AI run`** u Review.
**Odlučeno u S107m:** imena s `_AI` sufiksom (konzistentno s postojećim `Tip_O`/`Podtip_O`),
`Tip_AI`+`Podtip_AI` **vidljive** uz `Tip`/`Podtip`, `Pouzdanost_AI`+`AI run` u collapsed grupi.
**Model NIKAD ne piše u `Tip`/`Podtip`** — prijenos je zaseban svjestan korak (skripta s pragom
pouzdanosti ili kolona s kvačicom).

### B. Produkcijski run na 2424 N/A retka
Procjena ~$2–3 uz `--effort` koji pobijedi. Nakon toga Sašin pregled sortiran po pouzdanosti.

### C. Ostalo iz ranijih odluka (nepromijenjeno)
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u
  fileu) → preduvjet za ponovljivi re-ingest Kokinog filea. NIJE napravljeno.
- **Staging u TEST Supabase** (`events-tracker-test`, Saša ga restorirao 2026-07-26, Healthy).
  `sql/0NN_staging_financije.sql` nije napisan. Seli u PROD kad UI bude gotov (Koka tamo ima
  account; app ima 1 Supabase klijent po buildu).
- **Preparation tab** — gating preko `profiles` flaga (NE env var: rebuild = Netlify krediti),
  **dva moda** (pregled + Kokin dnevni unos, inače se vraća u Excel).
- **⭐ Reconciliation engine iz S107d–S107k JE Kokin budući mjesečni workflow**, nije
  jednokratni alat. To je odgovor na "što dobiva prvog dana".
- Merge-by-source_key alat (~40 linija) da Saša ne mora zatvarati Excel.

---

## STANJE PODATAKA (2026-07-26, nakon ispravki)
Review `Financije_review_20260710_1448.xlsx` · 5004 retka · klasificiranih s tekstom 2580 ·
**nevaljanih parova 0** (bilo 171) · N/A ukupno ~2424 (1606 s tekstom) · Taksonomija 64 para
(18+1 Tipova) · Pravila 69 + Preimenovanja 17.

**Ukupno potrošeno na API u S107m: ~$4,4.**

## PRAVILA OKRUŽENJA
Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi
non-interactive); `PYTHONUTF8=1`; `anthropic` SDK instaliran u venv; `ANTHROPIC_API_KEY` je u
`.env.local` (od AI Help funkcije). Review mora biti **zatvoren** samo za pisanje — eval čita.
`--dry` prvo, pokazati brojke, čekati potvrdu prije pravog pisanja.
**NIKAD ne pushati/mergati na main bez izričitog Sašinog zahtjeva.**

⚠ **`data-prep_data/` i `Claude-temp_R/` su gitignorirani = postoje SAMO na Sašinom disku,
u jednom primjerku.** Git čuva alate, ne podatke. Vrijedi napraviti vanjsku kopiju.
