# NEXT SESSION PROMPT — Financije: harvest `visoka` trake + sljedeća traka

**Prethodna sesija: S107o (2026-07-28).** Mehanizam odluke sad postoji (`AI odluka` kolona),
dva od tri odobrena popravka izvršena. Ostatak je **Sašin rad u Excelu**, koji ne troši ništa.

---

## KAKO POKRENUTI SLJEDEĆU SESIJU

**Otvori NOVU sesiju** (ne `--continue`, ne `--resume` — stari transkript se ponovno šalje i
skupo je). Zalijepi ovo:

> Nastavljam Financije migraciju (S107o → S107p). Pročitaj ovim redom:
> 1. `CLAUDE.md` — blok "Done 2026-07-28 (S107o)"
> 2. `NEXT_SESSION_PROMPT.md` — ovaj file
> 3. `data-prep_tools/Financije/ENRICH_PLAN.md` §2m
> 4. `Claude-temp_R/test-sessions/S107o_tests.md`
>
> Prošao sam `visoka` traku u Reviewu i upisao `OK`/`NE`/ispravke u kolonu `AI odluka`.
> Excel je zatvoren. Pokreni `apply_ai.py --harvest --dry`, pokaži mi brojke, pa nakon
> moje potvrde pravi run. Zatim idemo na `srednja` traku.
>
> Pravila: `--dry` prvo i čekaj potvrdu prije pisanja u Review; NIKAD push/merge na `main`
> bez mog izričitog zahtjeva.

Ako **nisi** stigao proći traku, samo napiši dokle si došao — nema veze, harvest radi i na 20 redaka.

---

## ŠTO TI TREBA NAPRAVITI U EXCELU (bez Claudea, ne troši ništa)

1. Otvori `data-prep_data/Financije/Financije_review_20260710_1448.xlsx`, sheet `Review`.
2. Filter **`Pouzdanost_AI` = `visoka`** (261 redaka), sortiraj po **`Tip_AI`** pa **`Podtip_AI`**.
3. Idi **grupu po grupu** (31 par, tri para nose 165 redaka — `Namirnice|Hrana i ostalo` 81,
   `Porezi|porez/prirez/dohodak` 47, `Razno|Kave/jelo vani` 37):
   - grupa je dobra → upiši **`OK`** u `AI odluka` u prvoj ćeliji i povuci kroz grupu
   - **znaš točan odgovor → upiši ga u `Tip`/`Podtip`** (dropdown radi), **ne** `NE` —
     jedino ispravak nosi informaciju za sljedeći AI run
   - ne znaš → **`NE`**, treba razgovor → **`?`**
4. Zatvori Excel i pokreni novu sesiju s promptom gore.

**Pazi na dvije slične kolone:** `Pouzdanost_AI` = AI (visoka/srednja/niska), `Pouzdanost` =
stara iz pravila (NEMA/NISKA). `AI odluka` je odmah desno od `Podtip_AI`.

---

## GDJE SMO

| | |
| --- | --- |
| Review | **4996** redaka (bilo 5004 — 8 duplikata rata obrisano, −636,36 €) |
| AI prijedlozi | **1592** · visoka 261 / srednja 239 / niska 1092 · NEPOZNATO 196 |
| N/A ukupno | **2423** (od toga 818 bez teksta — AI ih nije ni dirao, Sašina odluka) |
| Pravila | **70** · Taksonomija 65 parova |
| `freeze_panes` | `F2` (bio `F4855`) |

**Backupi ove sesije:** `*.pre-aiapply-20260728_082727` · `*.pre-duprata-20260728_083704` ·
`*.pre-vocarna-20260728_083708`

---

## OTVORENO (redom po prioritetu)

1. **Harvest `visoka` trake** — čeka Sašin pass, gore opisano.
2. **`srednja` traka (239)** — isti postupak nakon `visoka`.
3. **`reconcile_izvoda.py` matcher po `Datum naplate` + iznos** — jedina neizvršena od tri
   S107n stavke. Ne dira Review, može bilo kad. Sprječava povratak klase "duplikat rate".
4. **Agram / pravilo #43** — ožujak = C5 **potvrđen** (par 4505: Kokina napomena "Reg C5 2/3"
   na `AUTOCENTAR AGRAM` 11.03.2026). Ostaje Sašin pregled listopadskih pa `Iznos min/max` split.
   Kandidati za `auto C5`: redovi 1463, 3038–3041, 4499 (⚠ brojevi su prije dedupa — provjeriti).
5. **Petlja učenja** — kad se vidi koliko ispravaka padne iz `visoka`: ispravci →
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
