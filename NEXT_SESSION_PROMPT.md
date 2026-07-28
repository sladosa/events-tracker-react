# NEXT SESSION PROMPT — Financije: `srednja` traka (+ ostatak `niska`)

**Prethodna sesija: S107p (2026-07-28).** `visoka` traka harvestana — praktički gotova
(2 retka ostala). Sljedeći korak je `srednja` (205 preostalo), pa `niska` (1023 preostalo).

---

## KAKO POKRENUTI SLJEDEĆU SESIJU

**Otvori NOVU sesiju** (ne `--continue`, ne `--resume` — stari transkript se ponovno šalje i
skupo je). Zalijepi ovo:

> Nastavljam Financije migraciju (S107p → S107q). Pročitaj ovim redom:
> 1. `CLAUDE.md` — blok "Done 2026-07-28 (S107p)"
> 2. `NEXT_SESSION_PROMPT.md` — ovaj file
> 3. `data-prep_tools/Financije/ENRICH_PLAN.md` §2n
> 4. `Claude-temp_R/test-sessions/S107p_tests.md`
>
> Prošao sam `srednja`/`niska` traku u Reviewu i upisao `OK`/`NE`/ispravke u kolonu `AI odluka`.
> Excel je zatvoren. Pokreni `apply_ai.py --harvest --dry`, pokaži mi brojke, pa nakon
> moje potvrde pravi run.
>
> Pravila: `--dry` prvo i čekaj potvrdu prije pisanja u Review; NIKAD push/merge na `main`
> bez mog izričitog zahtjeva.

Ako **nisi** stigao proći cijelu traku, samo napiši dokle si došao — nema veze, harvest radi
i na 20 redaka.

---

## ŠTO TI TREBA NAPRAVITI U EXCELU (bez Claudea, ne troši ništa)

1. Otvori `data-prep_data/Financije/Financije_review_20260710_1448.xlsx`, sheet `Review`.
2. Filter **`Pouzdanost_AI` = `srednja`** (205 preostalo od 239), sortiraj po **`Tip_AI`**
   pa **`Podtip_AI`** (32 para).
3. Isti postupak kao `visoka`:
   - grupa je dobra → upiši **`OK`** u `AI odluka` u prvoj ćeliji i povuci kroz grupu
   - **znaš točan odgovor → upiši ga u `Tip`/`Podtip`** (dropdown radi), **ne** `NE` —
     jedino ispravak nosi informaciju za sljedeći AI run
   - ne znaš → **`NE`**, treba razgovor → **`?`**
4. Kad `srednja` gotova (ili dosta), po volji nastavi na `niska` (1023 preostalo, teži ostatak —
   `visoka`+`srednja` su bile bulk-accept traka, `niska` će tražiti više pojedinačnih odluka).
5. Zatvori Excel i pokreni novu sesiju s promptom gore.

**Pazi na dvije slične kolone:** `Pouzdanost_AI` = AI (visoka/srednja/niska), `Pouzdanost` =
stara iz pravila (NEMA/NISKA). `AI odluka` je odmah desno od `Podtip_AI`.

**Napomena (S107p, ostavljeno namjerno):** 3 retka (861, 887, 3166) ostaju trajno `OK` u
`AI odluka` jer su već imali ručni `Tip` prije harvesta — harvest ih preskače i ne čisti
ćeliju (to je jedini slučaj gdje `OK` ne znači "još čeka"). Nije bug, ne diraj.

---

## GDJE SMO

| | |
| --- | --- |
| Review | **4996** redaka (nepromijenjeno ove sesije) |
| AI prijedlozi | **1592** · visoka 261 / srednja 239 / niska 1092 · NEPOZNATO 196 |
| Harvestano ukupno (kroz S107p) | **347** redaka prenesena u Tip/Podtip |
| Preostalo po traci (Tip i dalje N/A) | **visoka 2** · **srednja 205** · **niska 1023** |
| `AI odluka` stanje | `(prazno)` 1586 · `?` 3 · `OK` 3 (namjerno ostavljeni, v. napomena gore) |
| Pravila | **70** · Taksonomija 65 parova |
| `freeze_panes` | `F2` |

**Backup ove sesije:** `Financije_review_20260710_1448.pre-aiapply-20260728_171029.xlsx`

---

## OTVORENO (redom po prioritetu)

1. **`srednja` traka (205)** — glavni posao, gore opisano.
2. **`niska` traka (1023)** — nakon `srednja`, teži ostatak (52 para, manje bulk-accept).
3. **`reconcile_izvoda.py` matcher po `Datum naplate` + iznos** — jedina neizvršena od tri
   S107n stavke. Ne dira Review, može bilo kad.
4. **Agram / pravilo #43** — ožujak = C5 **potvrđen** (par 4505). Ostaje Sašin pregled
   listopadskih pa `Iznos min/max` split. Kandidati za `auto C5`: redovi 1463, 3038–3041, 4499
   (⚠ brojevi su prije dedupa — provjeriti).
5. **Petlja učenja** — kad se vidi koliko ispravaka pada iz `srednja`/`niska`: ispravci →
   `AI_KONTEKST_pitanja.txt` → bump `PROMPT_VER` → re-run samo `niska`+`srednja` (~$1).
   Ponovljivi merchanti idu u `Pravila`, ne u model.
6. **T-S107n-3** (196 `NEPOZNATO` — je li stvarno neodredivo) i **T-S107n-6** (red 4759
   BIBERON / "Amsteradam").

## NEPROMIJENJENO OD S107m

- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day`) → Kokin ubačeni
  redak mijenja ključeve svih redaka tog dana iza njega. Preduvjet za ponovljiv re-ingest.
  ⚠ Sad je i **dodatno bitno**: `fix_duplikati_rata.py` i `V3 preskočeno` registar ovise o ključu.
- **`sql/0NN_staging_financije.sql`** nije napisan. Store ≠ UI je korijen frikcija.
- **Review ekran** (prijedlog + ✓OK toggle + override) = Kokin prvi kontakt s aplikacijom.
- **Pravi gate nije postotak N/A nego mehanizam na koji Koka prelazi.**
- Za Koku: 700 € bankomat 26.11.2025; `Saldo kontrola` 7 razlika (2026-01 +359, 2024-09 +149, 2×±49).

## PRAVILA OKRUŽENJA

Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi
non-interactive; **cmd guši zarez u argumentima**); `PYTHONUTF8=1`; `ANTHROPIC_API_KEY` u
`.env.local`. Review mora biti **zatvoren** samo za pisanje.
**`--dry` prvo, pokazati brojke, čekati potvrdu prije upisa.**
**NIKAD ne pushati/mergati na `main` bez izričitog Sašinog zahtjeva.**

⚠ **`data-prep_data/` i `Claude-temp_R/` su gitignorirani = postoje SAMO na Sašinom disku, u
jednom primjerku.** Git čuva alate, ne podatke. Vanjska kopija Reviewa i dalje nije napravljena.

## ZAMKE (plaćene otkrićem — ne ponavljati)

1. **Pravilo ne popravlja postojeći redak** ako mu je par valjan u Taksonomiji —
   `apply_rules.py` ga preskače (~linija 516). Treba i jednokratni ispravak.
2. **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** — preskače `source_key`eve koji
   POSTOJE u Reviewu. Zato `V3 preskočeno` registar, koji taj alat sad čita.
3. **AI provenijencija ne smije u `Pravilo run`** — `--eval` bi AI labele brojao kao `rucno`.
4. **`openpyxl`**: `insert_cols`/`insert_rows` ne pomiču `column_dimensions`, DV ni CF —
   širine/outline prenositi ručno, nove kolone umetati **desno** od `J`/`K`.
5. Sve što nosi status mora biti **unutar autofiltera** (sad `A1:AD`) — inače se pri sortu raspari.
6. `BATCH` je 25, ne 40; guard poslano-vs-vraćeno se ne ignorira.
7. **`OK` retci već-klasificiranih redaka ostaju trajno `OK`** nakon harvesta (harvest ih
   preskače i ne čisti ćeliju) — 3 poznata slučaja (861, 887, 3166), ne trebaju popravak.
