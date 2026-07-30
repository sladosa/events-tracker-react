# S107r — migracija na Kokinu taksonomiju (`Taksonomija (2)`)

**Datum:** 2026-07-30 · **Model:** Opus 5 · Python data-prep, **NEMA app koda**
**File:** `data-prep_data/Financije/Financije_review_20260710_1448.xlsx`

---

## Kontekst

Koka je u sesijama sa Sašom klasificirala dosta redaka, ali je imala primjedbu na
taksonomiju. Saša je napravio kopiju sheeta `Taksonomija` → `Taksonomija (2)` i pustio
je da je složi po svom. Rezultat: **18 Tipova / 66 parova** (stara: 19 / 65), s time da
**2061 od 3426 klasificiranih Review redaka (58 %)** nosi par kojeg u novoj taksonomiji
više nema. Bez migracije bi ih `apply_rules.py` **tiho resetirao na N/A**.

**Odluke (Saša + Koka, 2026-07-30):** v. `ENRICH_PLAN.md` §2p i `CLAUDE.md`.

---

## Što je promijenjeno u kodu

| File | Promjena |
| ---- | -------- |
| `apply_rules.py` | `Preimenovanja` dobio 4 opcionalne uvjetne kolone (`Smjer uvjet`, `Iznos min`, `Iznos max`, `Napomena uvjet`) + `--only-renames` flag |
| `migrate_taksonomija.py` | **NOVO** — jednokratna migracija: taksonomija, `Preimenovanja`, `Pravila`, `Tip_AI`/`Podtip_AI`, `Neklasificirano` |
| `sync_taxonomy.py` | garantira `freeze_panes` na `F{HEADER_ROW+1}` (drift je uhvaćen 3. put) |
| `Tools/backup_to_external.bat` | **NOVO** — additive robocopy backup gitignoriranih data direktorija |

---

## Programske kontrole (sve ✅)

### T-S107r-A — regresija `apply_rules.py`
Stara verzija (`git show HEAD:…`) i nova pokrenute s `--dry` na istom fileu.
**Očekivano:** bajt-identičan stdout (`Preimenovanja: 17`, `Pravila: 70`, `0 redova`).
**Rezultat:** `diff` prazan. ✅
*Zašto je važno:* stari 7-kolonski `Preimenovanja` sheet mora raditi nepromijenjeno
(kolone se traže po imenu, nepostojeća kolona = uvjet se ne provjerava).

### T-S107r-B — pokrivenost mappinga (read-only, prije ijednog upisa)
Skripta `check_mapping.py` (scratchpad) simulirala je matcher nad svim nevaljanim redcima.
**Očekivano:** svaki nevaljan redak pokriva točno jedan mapping red, 0 nepokrivenih.
**Rezultat:** `2061 nevaljanih / 2061 pokriveno / 0 nepokrivenih`. ✅

### T-S107r-C — puni lanac na KOPIJI Reviewa
`migrate_taksonomija.py` → `apply_rules.py --only-renames` → `sync_taxonomy.py` →
`apply_rules.py --dry`, sve na `scratchpad/TEST_review.xlsx`.
**Rezultat:** 2061 preimenovano; svih 10 uvjetnih redova dalo predviđene brojke:

| mapping red | očekivano | dobiveno |
| --- | --- | --- |
| `Povrat\|Anja` Smjer=Uplata 450 € → `Prihodi\|Povrat Anja` | 41 | 41 ✅ |
| `Povrat\|Anja` → `Transfer\|Anja` | 31 | 31 ✅ |
| `Ostali prihodi` nap~`natasa povrat` → `Transfer\|Natasa` | 5 | 5 ✅ |
| `Ostali prihodi` Racun~sasin + Smjer=Isplata → `Investicije\|Štednja` | 1 | 1 ✅ |
| `Ostali prihodi` Racun~kokin → `Prihodi\|Koka` | 43 | 43 ✅ |
| `Ostali prihodi` Racun~sasin → `Prihodi\|Saša` | 21 | 21 ✅ |
| `Domaćinstvo\|Povrat Nataša` nap~`holding` → `Kuća\|Holding (smeće)` | 41 | 41 ✅ |
| `Domaćinstvo\|Povrat Nataša` → `Transfer\|Natasa` | 3 | 3 ✅ |
| `Domaćinstvo\|Groblja` nap~`nena` → `Transfer\|Nena` | 1 | 1 ✅ |
| `Domaćinstvo\|Groblja` → `Transfer\|Natasa` | 2 | 2 ✅ |

### T-S107r-D — integritet (kopija, pa isto na pravom fileu)
| kontrola | rezultat |
| --- | --- |
| broj redaka / kolona / header | 4996 / 30 / identičan ✅ |
| nevaljanih `Tip` parova nakon migracije | **0** ✅ |
| nevaljanih `Tip_AI` parova nakon migracije | **0** ✅ |
| `Tip_O`/`Podtip_O` promijenjenih | **0** ✅ (zamrznut snimak originala netaknut) |
| `Pouzdanost` distribucija | **identična**, `VISOKA` 1014 → 1014 ✅ |
| Σ Uplata / Σ Isplata | 321.192,07 / 375.196,80 — **delta 0,00** ✅ |
| promijenjene kolone | samo `Tip` 1726, `Podtip` 766, `Alternativa` 2061, `Pravilo run` 2061, `Tip_AI` 752, `Podtip_AI` 258 ✅ |

### T-S107r-E — brojke se rekonciliraju
- Nevaljanih Review redaka: **1989 → 2061** nakon što je Saša obrisao `Domaćinstvo | Investicije`
  iz `Taksonomija (2)` (+72 = točno koliko taj par nosi). ✅
- Nevaljanih `Tip_AI`: **911** = 839 (jutarnje mjerenje) + 42 `Domaćinstvo\|Investicije`
  + 22 `auto C5\|parking` + 8 `auto Lacetti\|parking` (Kokine izmjene tijekom dana). ✅
- `Pravila`: 37 nevaljanih = 35 mehanički + `grobn` + `UPLATA ANJA CRNKOVIĆ`; nakon migracije
  **71 valjano** (70 + 1 iz splita), 0 preskočenih. ✅

### T-S107r-F — `sync_taxonomy.py`
DV rasponi konsolidirani iz **26 fragmenata s ~30 rupa** u 2 čista (`J2:J4997`, `K2:K4997`);
`freeze_panes` `F84` → `F2`. ✅

### Lažni alarm koji je provjeren i odbačen
`read_only=True` iteracija javljala je `5003 → 4996` redaka. **Nije gubitak podataka:**
`max_row` je u oba filea `4997`, sume novca identične u cent. Radi se o fantomskim
ćelijama do reda 5005 (ostatak starih DV raspona) koje openpyxl pri snimanju očisti.

---

## Testovi za Sašu (ručno / vizualno)

### T-S107r-1 — spot-check preimenovanih redaka ✅ (2026-07-30, Saša)
1. Otvori Review, filtriraj `Pravilo run` = `2026-07-30 11:23` (ili `Alternativa / nap.`
   sadrži `PREIM:`) → mora biti **2061 redaka**.
   → **Potvrđeno:** statusna traka `2061 of 4996 records found`. ✅
2. Provjeri da svaki takav redak ima **isti `Tip_O`/`Podtip_O`** kao prije (stari par) i
   **novi** `Tip`/`Podtip`. → potvrđeno vizualno (`Domaćinstvo|Povrat Nataša` → `(smeće)`,
   `Domaćinstvo|Struja/Plin` → `Kuća|…`, `Povrat|Anja` → `…nja`). ✅
3. Dodaj **drugi filtar `Pouzdanost` = `VISOKA`** → mora biti **646**.
   Raspored na tih 2061 redaka: `VISOKA` 646 · `PRAVILO` 661 · `NEMA` 558 · `SREDNJA` 116 ·
   `NISKA` 80.

> ⚠ **KOREKCIJA (2026-07-30):** prvotni kriterij "`Pouzdanost` na tim redcima **nije**
> `PRAVILO`" bio je **pogrešno formuliran** i dao je lažni alarm. Redak koji je u S107g/h/l
> klasificiralo keyword pravilo legitimno **ima** `Pouzdanost = PRAVILO` još od tada;
> preimenovanje `Pouzdanost` **ne dira**, pa oznaka ostaje. Takvih je **661**, i **svih 661
> imalo je `PRAVILO` i prije migracije** — novih `PRAVILO` oznaka je **0**.
> Trag u `Alternativa / nap.` pokazuje oba koraka, npr.:
> `pravilo #19: generali | PREIM: bio Domaćinstvo/Popravci, održavanje, osiguranje`.
>
> **Pravi dokaz da nijedno pravilo nije pregazilo ručnu odluku je nepromijenjen RASPORED**,
> ne odsutnost `PRAVILO`: programski provjereno da je `Pouzdanost` **identična po retku**
> (0 promjena na svih 2061) i u cijelom fileu (`VISOKA` 1014 → 1014).

**Pad:** broj redaka ≠ 2061, ili `VISOKA` pod tim filtrom ≠ 646, ili `Tip_O`/`Podtip_O`
pokazuje **novi** par (mora pokazivati stari).

### T-S107r-2 — 4 uvjetna slučaja ⬜ (brojke provjerene programski)
Filtriraj i pogledaj sadržaj:
1. `Prihodi|Povrat Anja` → **41** retka, svi `Smjer=Uplata` 450 €.
2. `Transfer|Anja` → **31** (sve što nije uplata od 450: iznosi 20–600 €).
3. `Kuća|Holding (smeće)` → **91** = 45 (`Podtip_O` = `Holding (smeće)`) + 41
   (`Podtip_O` = `Povrat Nataša`) + 5 (`Podtip_O` prazan — bili N/A u trenutku snapshota,
   klasificirani pravilom kasnije).
4. `Investicije|Štednja` → **1** redak (2024-03-04, Sašin RF, 550 €, Napomena `Stednja`).
**Pad:** brojevi ne odgovaraju.

> ⚠ **KOREKCIJA (2026-07-30):** prvotna tvrdnja "među 31 su i **2 Isplate od 450 €** koje
> namjerno nisu povrat" je **dvostruko pogrešna** i ispod nje je pravi nalaz — v.
> **T-S107r-7** ispod. Ta dva retka (397, 3727) nemaju Isplatu od 450 (imaju `Uplata` = 450
> **i** `Isplata` = 0,30/0,70), i **nisu** ispravno izuzeta: to su `rata 45/96` i `rata 73/96`
> iste serije čijih je ostalih 38 otišlo u `Prihodi|Povrat Anja`.

### T-S107r-7 — ⚠ NALAZ: 4 rate Anjine posudbe izvan `Prihodi|Povrat Anja` ⬜ ODLUKA
**Nije regresija migracije** — anomalija u izvornim podacima koju je migracija razotkrila.

Od **41** retka s oznakom `X/96`, **38** je u `Prihodi|Povrat Anja`, a **3** su pala u
`Transfer|Anja` (+ 1 parnjak bez oznake):

| red | oznaka | Smjer | Uplata | Isplata | zašto je promašilo mapping |
| --- | --- | --- | --- | --- | --- |
| 397 | `rata 45/96` | **Isplata** | 450 | 0,30 | uvjet je `Smjer=Uplata`; uz to `row_amount()` čita `Isplata` prvo pa vidi 0,30, ne 450 |
| 3727 | `rata 73/96` | **Isplata** | 450 | 0,70 | isto |
| 3612 | `72/96` | Uplata | 400 | — | rata plaćena u **dva dijela** (400 + 50 = 450) pa ni jedan nije 450 |
| 3613 | `72/96` | Uplata | 50 | — | isto |

**Opseg anomalije je zatvoren:** u cijelom fileu samo **3** retka imaju popunjene **obje**
kolone iznosa (397, 3727, i 3264 = bankovna naknada 0,26/0,17, ispravno klasificirana);
`Smjer` se svugdje inače slaže s popunjenom kolonom ⇒ **nema sistemskog rizika** za
`row_amount()` i `Iznos min/max` pravila.

**Predlažem:** sva 4 retka → `Prihodi|Povrat Anja` (sve su uplate Anje po istoj posudbi).
⚠ `apply_rules` ih **neće** dirnuti — `Transfer|Anja` je sad **valjan** par, a alat preskače
retke s valjanim parom (poznata zamka). Treba jednokratna skripta, uzor
`fix_vocarna_pravilo.py`. Iznose (0,30/0,70) ne dirati — izgledaju kao naknada za transfer.
**Čeka Sašinu potvrdu** (posebno je li 400+50 split isto povrat).

### T-S107r-3 — Preimenovanja i Taksonomija sheetovi ⬜
1. `Taksonomija` = Kokina verzija (18 Tipova, `Kuća`/`Prihodi`/`Prijevoz`/`Advokati`,
   bez `Namirnice`/`Mirovina`/`Povrat`/`Ostali prihodi`/`Ostavine`), + `Investicije | Štednja`.
2. `Taksonomija_v1` i `Preimenovanja_v1` postoje kao **skriveni** sheetovi (audit).
3. `Preimenovanja` ima **33 reda** i nove kolone `Smjer uvjet`/`Iznos min`/`Iznos max`/
   `Napomena uvjet`; uvjetni redovi su **iznad** bezuvjetnog za isti par.
4. Dropdowni `Tip`/`Podtip` u Reviewu rade na **svim** redcima (prije su ~30 redaka
   imala rupu u DV rasponu) i nude nove vrijednosti.
**Pad:** dropdown nudi stare vrijednosti (`Namirnice`…) ili je prazan.

### T-S107r-4 — `Pravila` sheet ⬜
1. **71 red** (bio 70).
2. `UPLATA ANJA CRNKOVIĆ` postoji **dva puta**: prvi s `Iznos min`=`Iznos max`=450 →
   `Prihodi|Povrat Anja`, drugi bez iznosa → `Transfer|Anja`. **Redoslijed je bitan** —
   prvi match pobjeđuje, pa onaj s iznosom mora biti gore.
3. `grobn` → `Transfer|Natasa`, i dalje **iznad** reda `NAKNADA`.
**Pad:** obrnut redoslijed dva Anja pravila, ili `grobn` ispod `NAKNADA`.

### T-S107r-5 — AI kolone ⬜
1. Filtriraj `Tip_AI` na stare vrijednosti (`Namirnice`, `Razno` + `Kave/jelo vani`…) →
   **0 redaka**.
2. Uzorak od ~10 redaka gdje je `Tip_AI` remapiran: prijedlog i dalje ima smisla.
**Pad:** `apply_ai.py --harvest` odbija par uz "nije u Taksonomiji".

### T-S107r-6 — backup na vanjski disk ⬜
Dvoklik na `data-prep_tools\Tools\backup_to_external.bat` (disk priključen) →
`[OK] Backup zavrsen`. Provjeri da je `Financije_review_20260710_1448.xlsx` na
`D:\DATA\events-tracker-react\data-prep_data\Financije\` s današnjim datumom.
Ako disk nije `D:`, pokreni s argumentom: `backup_to_external.bat E:\DATA\events-tracker-react`.
**Pad:** javi `[X] Disk … nije dostupan` iako je disk priključen.

---

## Backup lanac ove sesije

| file | trenutak |
| --- | --- |
| `*.pre-taks2-20260730_112322.xlsx` | prije migracije taksonomije |
| `*.pre-rules-20260730_112346.xlsx` | prije preimenovanja 2061 retka |
| `*.pre-sync-20260730_112349.xlsx` | prije sync dropdowna |

Sve troje + Review u konačnom stanju su i na **vanjskom disku** (`D:`, 11:25).

---

## Otvoreno / sljedeće

1. **Layout faza 1** (`sheet_layout.py`) — header-row-tolerantni čitači prije promjene
   rasporeda. Odluke: Review freeze `F4` **tek kad header pređe u red 3** (dok je u redu 1
   ispravno je `F2`, sad garantirano); help u collapsed redove 1–2, kolona **B**.
   Blast radius: header red 1 hardkodiran u **15** skripti, `min_row=2`/`range(2,` u **22**,
   **12 kopija** funkcije za traženje kolone.
2. `apply_ai.py` — nastavak `srednja` (205) / `niska` (1023) trake nad **novom** taksonomijom.
3. AI re-run: bump `PROMPT_VER`, **nov eval** (baseline 81,5 %/Tip 92,3 % je mjeren na
   staroj taksonomiji i više ne vrijedi), pa `niska`+`srednja` (~$1).
4. Za Koku: 700 € bankomat 26.11.2025; `Saldo kontrola` 7 razlika.
