# NEXT SESSION PROMPT — Financije: N/A petlja 2026 → PROD priprema (poslije S107k)

**Sesija za SONNET** — iterativna rules-craft pratnja, bez teškog dizajna. Saša radi u Excelu,
Claude vrti alate, provjerava pravila prije runa i čuva zamke ispod.

Nastavljam Financije migraciju. S107k je **zatvorio sve datume i Nematchano_v3**:
`Datum naplate` 100% popunjen (svih 5004 redaka), event_date sinkan na bankovne datume
(380 pomaka), v3 = **0 za odluku**, Saldo kontrola 10→7 razlika. Ostala je još samo
**klasifikacija N/A mase** — glavni i praktički jedini put do PROD-a.

## Kontekst pročitaj ovim redom
1. `CLAUDE.md` (auto) — zadnji "Done 2026-07-23 (S107k)" blok
2. `data-prep_tools/Financije/ENRICH_PLAN.md` — **§2k** (S107k alati/tok), **§2i**
   (suggest_candidates petlja), **§2e/§2f** (zamke pravila iz prošlih krugova) + **§3**
3. `Claude-temp_R/test-sessions/S107k_tests.md` — što je odrađeno + pending ručni testovi

## STANJE (kraj S107k, 2026-07-23; commit 3466362 test-branch)
- **Review = `Financije_review_20260710_1448.xlsx`, 5004 redaka.** Sve iz izvoda konsolidirano;
  Izvodi_transakcije.xlsx ne treba za odluke. Alati sheetove biraju PO IMENU (tabovi se smiju slagati).
- **`Datum naplate` KOMPLETAN:** Racun/Cash = event_date (D1); Visa = stvarni datum lump uplate
  statementa (verificirano 30/30 u cent); MC = 11. u M+1 (Kokino pravilo). NIŠTA više ne treba puniti.
- **`Nematchano_v3` = 0 za odluku.** Verdikt tok (DUP/DODAJ/PRESKOČI + `--harvest`) radi i idempotentan
  je; regeneracija može donijeti nove retke samo ako stignu novi izvodi. 2 PRESKOČENA reda (bankomat
  150 + 1) čekaju Kokin odgovor o zbirnih 700 €.
- **N/A: 2812 ukupno**, po godini: 2024 ~965, 2025 ~810, **2026 = 178**, pre-2024 ~820 no-text (hard).
  **Pravila: 26 valjanih** u Pravila sheetu (+ Preimenovanja 17). `Pravilo run` kolona = audit trail.
- **Saldo kontrola: 7 razlika** — 2026-01 +359.43, 2024-09 +149, 2×±49 multisport (2023-12/2024-02),
  3 sitna (0.70/1.60/8.40). To su PRAVA pitanja za Koku, ne timing šum (datumi su sad bankovni).
- Poznat 1 pre-postojeći dupli source_key: `koka EU:31` (2022-12-21, 2×17.82 MC) — pre-2024 cleanup,
  ne dirati sada.

## ALATI (svi `data-prep_tools/Financije/`, pokretati `../Tools/venv/Scripts/python.exe <skripta>`
## jer `run.bat` ima `pause` koji visi u non-interactive; PYTHONUTF8=1; Review ZATVOREN u Excelu)
- `suggest_candidates.py [--year Y] [--top N] [--preview] [--harvest]` — N/A rule petlja (GLAVNI alat)
- `apply_rules.py [--dry] [--all]` — Pravila/Preimenovanja; `sync_taxonomy.py` — dropdowni iz Taksonomije
- `consolidate_review.py [--dry] [--harvest]` — regen v3/Saldo kontrola (treba samo uz nove izvode)
- `date_accuracy.py` / `kartice_datum_naplate.py` / `backfill_napomena.py` — IZVRŠENI; idempotentni,
  ponovni run smislen samo nakon novih redaka/izvoda

## ZADACI (prioritetom; Saša potvrdi na početku)

**1. N/A PETLJA 2026 — glavni posao (cilj: 178 → ~0).**
   Krug: a) `suggest_candidates.py --year 2026` → Saša popuni Tip/Podtip u `Neklasificirano`
   (dropdowni; fali li Podtip → red u `Taksonomija` + `sync_taxonomy.py`); b) Claude PREGLEDA
   popunjeno PRIJE harvesta (v. zamke); c) `--harvest` → `apply_rules.py --dry` → pokaži brojke →
   pravi run; d) ponovi (svaki krug kraći). Preostali poznati kandidati bez pravila (ENRICH_PLAN §3
   t.2): `paypal` ostatak (merchant varira — NE blanket), `keks pay` (P2P — ovisi o namjeni),
   `bmove` (nepoznat merchant — pitati), porez grupa (porez/prirez — treba li nov Tip? Sašina odluka).

**2. Kad je 2026 čist → PROD PRIPREMA (može ista ili sljedeća sesija):**
   a) Draft **`KOKA_HANDOFF.md`** (faze A–D); b) **struktura `Financije_all` (owner = KOKA!)** generirana
   iz Taksonomija sheeta (Structure import Excel); c) **import generator** (period `--from/--to` za
   2026-first, CommentTemplate `{racun}/{tip}/{podtip}/{napomena}`, `Datum naplate` se ČITA iz Reviewa —
   gotov je); d) import pod **Kokinim accountom** (D6, treba njen login) + spot-check saldo u appu;
   e) stare Financije aree obrisati NA KRAJU (backup prvo). **Odluka za Koku:** ongoing workflow —
   ručni in-app unos vs mjesečna izvod-import rutina.

**3. USPUT (ako Saša javi rezultate):** T-S107k-1/2/3 ručni pregledi (PENDING_TESTS) — markirati;
   Kokini odgovori (700 € bankomat → razriješiti 2 PRESKOČENA v3 reda; saldo 2026-01/2024-09).

**4. NAKON PROD-a: petlja za 2025 (810) pa 2024 (965)** — isti postupak, `--year 2025` itd.

## ZAMKE KOD PRAVILA (iz S107g/h/k iskustva — Claude provjeri SVAKO novo pravilo prije runa)
- Zvjezdica `*` NIJE wildcard — traži se doslovno (radi samo za literal `*` u tekstu, npr. `GOOGLE *YOUTUBE`)
- Tip/Podtip para MORA postojati u Taksonomiji (inače se pravilo tiho preskače uz warning)
- Prekratke riječi lažno pale (`zaba`, `eu`); specifičnija pravila IZNAD općenitijih (prvi match pobjeđuje)
- `Iznos min`/`Iznos max` za split istog merchanta po cijeni (v. Audible/Apple primjer §2f)
- `Komentar` kolona = bilješka u Alternativa (NE ide u comment); `Napomena` kolona = gotova labela za comment
- openpyxl: `cell(r,c,None)` NE briše — mora `.value = None`; cmd guši zarez u argumentima (1 substring/poziv)

## PRAVILA OKRUŽENJA
Review ZATVOREN u Excelu prije skripti (inače PermissionError; backup svejedno nastane); backup
automatski; **NIKAD ne pushati/mergati na main** bez izričitog Sašinog zahtjeva — PROD deploy app koda
NIJE dio ove sesije (import ide na PROD Supabase podatke pod Kokom, ali to je korak 2d i čeka izričit GO);
**--dry prvo, pokaži brojke, čekaj Sašinu potvrdu prije pravog pisanja**; alati sheet biraju po imenu.

## OTVORENO ZA KOKU (ne blokira petlju)
Zbirnih 700 € bankomat 26.11.2025 (banka: 100+150+100+200; 2 PRESKOČENA v3 reda čekaju);
saldo divergencije 2026-01 +359.43 i 2024-09 +149 (+2×±49 multisport); odluka o pre-2024
no-text N/A masi (~820, nema izvoda).
