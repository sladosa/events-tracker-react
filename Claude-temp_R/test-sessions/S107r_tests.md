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

### T-S107r-1 — spot-check preimenovanih redaka ⬜
1. Otvori Review, filtriraj `Pravilo run` = `2026-07-30 11:23` (ili `Alternativa / nap.`
   sadrži `PREIM:`) → mora biti **2061 redaka**.
2. Provjeri da svaki takav redak ima **isti `Tip_O`/`Podtip_O`** kao prije (stari par) i
   **novi** `Tip`/`Podtip`.
3. **Ključno:** `Pouzdanost` na tim redcima **nije** `PRAVILO` nego što je i bila
   (`VISOKA`/`SREDNJA`/`NISKA`/`NEMA`) — to je dokaz da nijedno pravilo nije pregazilo
   Kokinu ručnu odluku.
**Pad:** ako se ijedan redak s `PREIM:` ima `Pouzdanost = PRAVILO`.

### T-S107r-2 — 4 uvjetna slučaja ⬜
Filtriraj i pogledaj sadržaj:
1. `Tip` = `Prihodi`, `Podtip` = `Povrat Anja` → **41** redaka, svi Uplata 450 €.
2. `Tip` = `Transfer`, `Podtip` = `Anja` → **31**; među njima i **2 Isplate od 450 €**
   (te namjerno NISU povrat).
3. `Kuća|Holding (smeće)` → 50 starih + **41** novih (Napomena `Nataša Holding`) = **91**.
4. `Investicije|Štednja` → **1** redak (2024-03-04, Sašin RF, 550 €, Napomena `Stednja`).
**Pad:** brojevi ne odgovaraju, ili u `Transfer|Anja` nema onih 2 isplate.

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
