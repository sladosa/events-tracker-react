# S107j — testovi i radni koraci (2026-07-22)

Sesija: **ZABA parser fix + izvodi konsolidirani u Review + N/A rule-authoring petlja**. Jači model
(Opus) — Saša ručno dijagnosticirao Nematchano_v2, Claude popravio parser + izgradio alate.
Detalji: `data-prep_tools/Financije/ENRICH_PLAN.md` §2h/§2i/§2j.

Review = `Financije_review_20260710_1448.xlsx` (4968 redaka). Commiti: 87c13d6 → 39db5a9 (test-branch).

---

## Odrađeno (programski verificirano)

- **parse_zaba_racun fix** — saldo-lanac Σupl/Σisp = bankov Zbroj prometa **40/40 u cent**; Tekući
  saldo-lanac neprekinut 2023-12→2026-06 (0 pukotina). Pokrenuto: ZABA 624→700 tx, enrich
  1725→1834 match, Smjer? 39→1.
- **consolidate_review.py** — +113 redaka (31 MASTERCARD lump→Transfer, 82 kartične/account→N/A);
  Nematchano_v3 (57 problematičnih, recent-first, verdikt) + Saldo kontrola (21/31 balansira);
  Izvodi_transakcije.xlsx više ne treba za odluke.
- **suggest_candidates.py** — Neklasificirano sheet (2026, top 20 merchant klastera, Tip/Podtip dropdowni).
- **backfill_napomena.py** — 1870 praznih Napomena ← Izvod opis (824 ostaje no-text).
- **F2 split** + sheetovi po imenu (tabovi se smiju slagati).

---

## T-S107j-1 — N/A klasifikacija petlja (Neklasificirano) ⬜
1. Otvori Review → `Neklasificirano` tab (narančasti). 20 redaka, sortirani po Broj.
2. Za par klastera (npr. BIBERON, KEINDL) klikni ćeliju `Tip` → dropdown radi; izaberi Tip → `Podtip`
   dropdown se filtrira na taj Tip. Popuni nekoliko.
3. Zatvori Review. `suggest_candidates.py --harvest` → prijavi koliko dodano u Pravila.
4. `apply_rules.py --dry` → provjeri da hvata; pa bez `--dry`.
5. `suggest_candidates.py --year 2026` opet → lista kraća (klasificirani nestali).
**Očekivano:** svaki krug smanjuje 2026 text-N/A; dropdowni rade; harvest ne duplicira postojeća pravila.

## T-S107j-2 — Nematchano_v3 pregled ⬜
1. Otvori `Nematchano_v3` (57 peach Izvod redaka + green Review kandidati, recent-first, F2 split).
2. Potvrdi mehaniku: peach = odluka, green = kontekst. Obriši par očitih dup grupa (npr. YOUTUBE↔Youtube)
   → provjeri da Review NIJE promijenjen (broj redaka Review isti).
3. Provjeri `Verdikt` kolonu: kartica/RF "kandidat N dana daleko", ZABA "PROVJERI Δ mjeseca".
4. Nađi genuine missing (nema kandidata) ako postoji → dodaj u Review (ili zabilježi).
**Očekivano:** većina dup (brzo dismiss); Izvor reda kolona pokazuje provenijenciju (koka EU / Za Sašu /
PBZ Visa / Konsolidacija).

## T-S107j-3 — Saldo kontrola pregled ⬜
1. Otvori `Saldo kontrola`. 31 ZABA izvadak; kolona Status.
2. Potvrdi 21 "OK — balansira" + 10 "RAZLIKA". Velike razlike: **2026-01 +359, 2025-08 +200,
   2024-09 +149** → kandidati za Koku (nisu objašnjene v3 redovima).
**Očekivano:** male razlike (±49, 0.70, 1.60, 8.40) = timing/sitni parkinzi (negligible); velike = pravi
reconcile s Kokom.

## T-S107j-4 — Napomena backfill kontrola ⬜
1. Review: filtriraj rane 2024 kartične retke → Napomena sada popunjena (merchant iz Izvoda).
2. Provjeri da ne-prazne (Kokine originalne) Napomene NISU promijenjene (P3).
**Očekivano:** 1870 popunjeno; pre-2024 no-text ostaje prazno.

---

## Novi/izmijenjeni alati
- `parse_zaba_racun` (fix) + `_parse_zaba_all`/`_zaba_header_boundary`/`_validate_zaba` u `enrich_from_izvoda.py`
- `consolidate_review.py` (novo), `suggest_candidates.py` (novo), `backfill_napomena.py` (novo)

## Backlog nalazi (S107j → sljedeća sesija)
- **Date-accuracy pass** (Sašina ideja): potvrđeni dup → Review event_date na bankovni (točniji) datum.
- **Per-month reconciliation view** za 3 velike saldo razlike.
- **PBZ Visa Transfer stragglers:** 3 N/A "PBZCARD" na Sašin RF → pravilo Transfer/izmedju racuna.
- Consolidate za sitne common iznose (parking 0.80) daje lažne "možda dup" — saldo je pravi arbitar,
  ali per-red auto-verdikt nepouzdan (timing+agregacija) → ostaje ručna odluka.
