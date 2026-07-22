# NEXT SESSION PROMPT — nastavak Financije (poslije S107j)

Nastavljam Financije migraciju. S107j je **popravio ZABA parser** i **zatvorio izvode** — svi
dostupni izvodi su sada konsolidirani u Review; dalji rad živi u Review workbooku.

## Kontekst pročitaj ovim redom
1. `CLAUDE.md` (auto) — zadnji "Done 2026-07-22 (S107j)" blok
2. `data-prep_tools/Financije/ENRICH_PLAN.md` — **§2h** (parser fix), **§2i** (suggest_candidates),
   **§2j** (consolidate_review) + **§3** (sljedeći koraci)
3. `Claude-temp_R/test-sessions/S107j_tests.md` — što je odrađeno + pending ručni testovi

## STANJE (kraj S107j, 2026-07-22; commits 87c13d6 → 39db5a9 test-branch)
- **ZABA parser popravljen** (`enrich_from_izvoda.py parse_zaba_racun`): granica Priljev|Odljev iz
  header reda + prijenos kroz stranice + account-tagging (samo Tekući račun; žiro pass-through
  izostavljen, ime poslodavca prenesen) + saldo-validacija. **Saldo-lanac zatvara 40/40 u cent.**
- **Svi izvodi konsolidirani** (`consolidate_review.py`): +113 redaka (31 MASTERCARD lump→Transfer,
  82 kartične/account→N/A). **Review = `Financije_review_20260710_1448.xlsx`, 4968 redaka.**
  **Izvodi_transakcije.xlsx VIŠE NE TREBA za odluke.**
- **Novi sheetovi U REVIEW workbooku** (alati ih biraju po IMENU, ne poziciji — tabovi se smiju slagati):
  - `Neklasificirano` — top 20 N/A merchant klastera (2026), Tip/Podtip dropdowni. `suggest_candidates.py`.
  - `Nematchano_v3` — **57 problematičnih** izvod-tx (recent-first), side-by-side Izvod↔Review kandidat +
    Verdikt + saldo-hint. **VAŽNO: peach `Izvod` red = odluka; green `Review` red = read-only kopija
    (brisanje iz v3 NE dira Review).**
  - `Saldo kontrola` — po ZABA izvatku Kokin `Stanje` @ zatvaranju vs bankovni NOVO STANJE
    (21/31 balansira u cent; 10 razlika).
  - Sve wide tabele: `freeze_panes=F2` (pinaj A–E + header).
- **N/A: 2803** (1979 s tekstom = rules-resolvable; 824 no-text pre-2024 = hard). Po godini:
  2024 970 (817 text), 2025 813 (767 text), **2026 182 (163 text)**. Visa 1130 SVE text.
- **Napomena backfill** (`backfill_napomena.py`): 1870 praznih Napomena ← očišćen Izvod opis.

## ALATI (svi `data-prep_tools/Financije/`, pokretati `../Tools/venv/Scripts/python.exe <skripta>`
## jer `run.bat` ima `pause` koji visi u non-interactive; PYTHONUTF8=1; Review ZATVOREN u Excelu)
- `suggest_candidates.py [--year Y] [--top N] [--preview] [--harvest]` — N/A rule petlja
- `consolidate_review.py [--dry]` — idempotentno (source_key dedup); regenerira v3 + Saldo kontrola
- `backfill_napomena.py [--dry]` — prazna Napomena ← Izvod opis
- `apply_rules.py [--dry]` — Pravila/Preimenovanja na N/A; `sync_taxonomy.py` — dropdowni iz Taksonomije

## ZADACI (prioritetom; Saša potvrdi na početku)

**1. N/A KLASIFIKACIJA — glavni put do PROD (Sonnet OK, iterativno sa Sašom).**
   Petlja po godini (**2026 PRVO** → pa PROD; zatim 2025, 2024):
   a. `suggest_candidates.py --year 2026` → Saša popuni Tip/Podtip u `Neklasificirano` (dropdowni;
      ako Podtip fali → doda red u `Taksonomija` + `sync_taxonomy.py`).
   b. `suggest_candidates.py --harvest` → popunjeni → `Pravila`. `apply_rules.py --dry` pa bez.
   c. Ponovi (`--year 2026` opet, sada kraći). Cilj: 2026 text-N/A → ~0.
   Zamke: prekratke riječi lažno pale; specifičnija pravila IZNAD općenitih (rule ORDER);
   Iznos min/max za split istog merchanta po cijeni.

**2. `Nematchano_v3` (57) — Saša prođe (nisko-rizično, većina dup).**
   Recent-first. Za svaki peach `Izvod` red: green kandidat isti + blizu datum = **dup, obriši grupu
   iz v3** (ne dira Review). Genuine missing (nema kandidata / saldo kratak) = dodaj u Review.
   Kartica/RF = pretplate (Youtube/Audible) uglavnom dup. ZABA-account = uglavnom timing/agregacija
   dup (sitni parkinzi negligible). **NE agonizirati** — sitne iznose preskoči.

**3. Sitni popravci (brzo):**
   - **PBZ Visa Transfer stragglers:** 3 N/A "PBZCARD..." na Sašin RF (od 20, ostalih 17 već Transfer)
     → pravilo `PBZCARD → Transfer/izmedju racuna` (Napomena čuva Visa mjesec) ILI ručno.
   - **Nevenka/Ostali prihodi provjere** ako iskrsnu.

**4. OPCIONALNI ALATI (kad Saša poželi):**
   - **Date-accuracy pass:** za potvrđene dup parove (izvod↔Review) ažuriraj Review `event_date` na
     TOČAN bankovni datum (izvod je precizniji od Kokine procjene). PAZI: mijenja Kokine podatke →
     deliberate/reviewable pass (dry + izvještaj prvo).
   - **Per-month reconciliation view** za 3 velike saldo razlike (**2026-01 +359, 2025-08 +200,
     2024-09 +149**): sve Kokine + sve bankovne tx tog mjeseca side-by-side → pronaći što fali/krivo.
     = pitanja za Koku (nisu objašnjene v3 redovima).

**5. PREMA PROD (2026-first, kad je 2026 klasificiran + v3 čist):**
   Draft `KOKA_HANDOFF.md` (faze A–D — vidi CLAUDE.md); struktura **`Financije_all` (owner Koka)** iz
   Taksonomije; import generator (period `--from/--to`, CommentTemplate `{racun}/{tip}/{podtip}/{napomena}`,
   Visa `Datum naplate` iz PBZ/RF lump datuma); import pod **Kokinim accountom** (D6) + spot-check saldo
   u aplikaciji; stare Financije aree obrisati NA KRAJU (backup). **Odluka za Koku:** ongoing workflow —
   ručni in-app unos vs mjesečni izvod-import routine (njena odluka; friction točka).

## PRAVILA
Review ZATVOREN u Excelu prije skripti (inače PermissionError — backup svejedno nastane); backup
automatski; **NIKAD ne pushati/mergati na main** bez izričitog Sašinog zahtjeva; **--dry/kopija prvo,
pokaži brojke, čekaj Sašinu potvrdu prije pravog pisanja**; alati sheet biraju po imenu.

## OTVORENO ZA KOKU (ne blokira)
700€ isplata 2025-11-26 (nije na ZABA izvodu); 3 velike saldo divergencije (2026-01/2025-08/2024-09);
odluka o preostaloj no-text N/A masi (824, pre-2024, nema izvoda).
