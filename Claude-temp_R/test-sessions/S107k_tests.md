# S107k testovi (2026-07-23) — v3 Verdikt tok + date_accuracy + kartice_datum_naplate

**Python data-prep alati — NEMA app koda.** Detalji dizajna: `data-prep_tools/Financije/ENRICH_PLAN.md` §2k.
Svi pravi runovi IZVRŠENI ovu sesiju (Saša dao GO); testovi dolje su verifikacije koje su obavljene
programski + preostale ručne kontrole za Sašu.

## Kontekst / odluke sesije

- **Prag sitniša 5 €** (Saša): ispod praga se ništa ručno ne pregledava — auto-DUP (slobodan kandidat)
  ili auto-DODAJ (kandidat zauzet → tx stvarno fali; klasificiraju je pravila). Klasifikacija NEMA prag.
- **DUP verdikt = potvrđen izvod↔Review par ⇒ event_date sync** (kombinirani Nematchano_v3 +
  date-accuracy pass — Sašin zahtjev da se ne brišu redovi prije korekcije datuma).
- **`Datum naplate` se puni u Review SADA** (ne tek u import generatoru).
- Verificiran obrazac PBZ Visa naplate: suma kupovina statementa M == PRIMLJENA UPLATA u M+1 ==
  RF PBZCARD isplata isti dan — **30/30 statementa u cent**.
- MC pravilo (Koka): naplata = 11. u mjesecu M+1 — potvrđeno u podacima (1650/1653 redaka dan 11).

## Izvršeni pravi runovi (redoslijed)

1. `date_accuracy.py` — 360 event_date → bankovni datum (+89 Datum naplate follow, +187 Izvod opis)
2. `consolidate_review.py` — +18 sitniš auto-DODAJ; v3 regeneriran s Verdikt dropdownom (41 za odluku)
3. **Saša: Verdikt pass** (20 DUP + 19 DODAJ + 2 PRESKOČI; 1 KONZUM ispravljen DUP→DODAJ naknadno)
4. `consolidate_review.py --harvest` ×2 — svi verdikti primijenjeni; **v3 = 0 za odluku**
5. `kartice_datum_naplate.py` — 1658 popunjeno; **Datum naplate kolona kompletna (0 praznih)**
6. `apply_rules.py` — 30 novih klasificirano (parking 8, Spotify 4, Prime 4, Claude, Konzum…)
7. `backfill_napomena.py` — +29 Napomena

**Završno stanje:** Review 5004 redaka; Saldo kontrola razlike 10 → **7**; N/A 2026 = 178;
1 poznati pre-postojeći dupli source_key (`koka EU:31`, 2022-12-21, 2×17.82 — pre-2024 cleanup).

## Testovi

| ID | Test | Koraci / očekivano | Status |
|----|------|--------------------|--------|
| T-S107k-A | date_accuracy dry=real konzistentnost | dry brojke == real brojke (360/89/187); re-sort bez gubitka redaka | ✅ programski |
| T-S107k-B | Harvest E2E ciklus na test kopiji | consolidate → prefill verdikti → harvest → v3 44→0; drugi harvest idempotentan (0 grupa) | ✅ programski |
| T-S107k-C | "Used kandidat" zaštita | DUP sync NE smije uzeti red već matchan drugom tx (bug uhvaćen na kopiji: raw v3 rastao); nakon fixa: green `Review (matchan)` info-only, prefill DODAJ | ✅ programski |
| T-S107k-D | kartice_datum_naplate spot-check | stm 2024-09 → 2024-10-08; stm 2026-06 → 2026-07-06; 0 redaka naplata < kupovina; P3 (1653 Kokinih MC netaknuto) | ✅ programski |
| T-S107k-E | Saldo kontrola prije/poslije | 10 → 7 razlika, nijedna nova (riješeni 2025-02, 2025-07 Astrum −2875, 2025-08) | ✅ programski |
| T-S107k-F | Claude tipfeler fix (EU:549) | Review red 2024-10-27 22.50 → DUP sync → 2025-10-27 + Izvod opis + pravilo #15 → Projekti | ✅ (Saša otkrio, programski verificirano) |
| T-S107k-1 | **Saša:** vizualni pregled Reviewa — filtriraj `Pravilo run` = 2026-07-23 (30 novih klasifikacija) + `Izvor reda` = Konsolidacija (36+1 novih redaka: sitniš parkinzi/naknade + tvoji DODAJ) | ⬜ |
| T-S107k-2 | **Saša:** `Datum naplate` kontrola — filtar Izvor=Visa: vrijednosti ~4.–8. u mjesecu nakon statementa; Izvor=Mastercard novi redci: 11. u mjesecu | ⬜ |
| T-S107k-3 | **Saša:** `Saldo kontrola` — 7 preostalih razlika; velike 3 (2026-01 +359, 2024-09 +149, 2×±49 multisport) = pitanja za Koku | ⬜ |

## Napomene za sljedeću sesiju

- `Nematchano_v3` je na **0 za odluku** — regeneracija (svaki consolidate run) može donijeti nove
  retke samo ako se pojave novi izvodi.
- **Sljedeći korak: N/A petlja 2026** (`suggest_candidates.py --year 2026`, 178 preostalo) → PROD.
  Sonnet dovoljan; svaki krug: suggest → Saša popuni Neklasificirano → `--harvest` → `apply_rules`.
- 2 PRESKOČENA reda (bankomat 150 iz 11/2025 + još 1) čekaju Kokin odgovor o zbirnih 700 €.
