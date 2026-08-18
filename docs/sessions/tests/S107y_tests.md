# S107y — Pitanja za Koku odgovoreno + popravci primijenjeni + batch 2025 uvezen

**Datum:** 2026-08-13 · **Model:** Sonnet 5 · **Grana:** `test-branch`
**Prethodno:** S107x Faza 1a (2026-08-12) — model salda dokazan, sheet `Pitanja za Koku`
pripremljen, 14 pitanja čekala Koku.

**Nema promjena u `src/`** — Python data-prep (jedan novi fix script) + Excel import kroz
postojeći app UI. Typecheck/build nisu potrebni (ništa u `src/` nije dirnuto).

---

## Sjedenje s Kokom — 14/14 pitanja odgovoreno

Radna kopija: `Financije_review-prolaz-s-Kokom.xlsx` (Koka i Saša popunili `Odluka` +
`Njena napomena` uživo). Original Review netaknut dok se nije potvrdio plan.

| # | Odluka | Napomena / akcija |
| --- | --- | --- |
| 1 (red 4996, parking) | datum je kriv | 07.08.2026 → 07.07.2026 |
| 2 (red 4997, MC 21,88) | duplikat — obriši | duplikat reda 4247 (PAYPAL *TEMU) |
| 3 (red 4101, 700€ bankomat) | točno je | zbroj više podizanja — bez izmjene |
| 4 (redovi 2787+2788, Mirovina+Triglav) | datum je kriv | 07.01.2025 → **07.02.2025** (točan bankovni datum nađen u `Izvodi_transakcije.xlsx`: ZABA_2025-02.pdf) |
| 5 (red 3609 vs 3612+3613, Anja rata) | duplikat — obriši | 3609 obrisan; 3612/3613 već sadrže "72/96" u Napomeni, ništa dodatno |
| 6 (red 2368, Allianz Lacetti) | točno je | plaćeno gotovinom — bez izmjene |
| 7 (redovi 2001+2004, dvije Mirovine) | duplikat — obriši | 2004 obrisan, 2001 ostaje |
| 8–14 (mjesec, Saldo kontrola razlike) | ne sjećam se | opći uzrok: izvodi banke i Kokini upisi nisu istih datuma — bez izmjene, ostaje rezidual (dizajn dopušta, saldo na kraju već točan) |

**Odluka (Saša) za #8–14:** ne rekonstruirati bankovne datume unatrag — nema pouzdanog matcha,
rizik nagađanja > korist. Kokini `event_date`/`Stanje` ostaju izvor istine za te mjesece.

---

## `fix_pitanja_koka.py` (novo) — primijenjeno na pravi Review

Verifikacija po `source_key` + iznos + trenutni datum PRIJE ijedne izmjene (isti obrazac kao
`fix_duplikati_rata.py`). `--dry` pa pravi run.

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | Verifikacija 3/3 datuma + 3/3 brisanja prije pisanja | ✅ prošlo, 0 problema |
| P-2 | Podaci nakon runa: retci 4995 → **4992** (točno −3) | ✅ |
| P-3 | Isplata delta = 21,88 € (obrisani 4997) | ✅ |
| P-4 | Uplata delta = 1608,99 € = 450,00 (3609) + 1158,99 (2004) | ✅ |
| P-5 | Dirnuta samo 3 retka (2787, 2788, 4996) — isključivo `event_date`, `Datum naplate`, `Alternativa / nap.` | ✅, 0 neočekivanih izmjena |
| P-6 | 0 dodanih redaka | ✅ |
| P-7 | 14 odgovora prepisano u `Pitanja za Koku` sheet pravog Reviewa | ✅ |

Backup: `Financije_review_20260710_1448.pre-pitanja-20260813_105537.xlsx`

⚠ `ws.max_row` prije/poslije pokazuje razliku od 10, ne 3 — kozmetički artefakt (prazni
formatirani redovi na kraju sheeta), ne podatkovna greška; provjereno brojanjem stvarnih
redaka po `source_key` (4995→4992, točno).

---

## Batch 2025 — generiran i uvezen u TEST

`make_financije_import.py --from 2025-01-01 --to 2025-12-31` →
`Financije_all_import_20260813_110152.xlsx` — **1473 redaka**, 351 dana, max 16 tx/dan
(session_start do 09:15). 4 retka izostavljena (`Smjer=PROVJERI`, poznata odluka S107s).

### T-S107y-1 — Import u app (TEST) ⭐

1. `npm run dev`, Activities tab → Import Excel → `Financije_all_import_20260813_110152.xlsx`
2. "Checking for conflicts" → **1473 new / 0 modify** (očekivano, prvi import za taj raspon)
3. Apply Import → **Import successful — 1473 created / 0 updated**

**PASS.** ✅ (Saša, 2026-08-13)

### T-S107y-2 — spot-check nakon importa

1. Export iz appa, filtriraj `event_date = 2025-02-07` → Mirovina (1125,07) + Triglav
   (1260,58) prisutni (dvije izmjene s ove sesije) ✅
2. Redak s `Rate?` → vidljivo `TRUE` u exportu (npr. RATA 05/05-DECATHLON) ✅
3. Broj redaka u exportu za 2025 filter = 1473; **ukupan broj u bazi 2220** = 1473 (2025) +
   747 (2026, S107v) — brojevi se poklapaju ✅

**PASS.** ✅ (Saša, 2026-08-13, screenshot export)

---

## Sljedeći korak

**Dogovor o Fazi 1** (RPC `balance_by_group`, `sql/035_area_group_agg.sql`) — odgođeno na
Sašin zahtjev za sljedeći session. Batch 2024/2023 se NE priprema unaprijed (odluka: usko
grlo je vetting/Pitanja-za-Koku pass po periodu, ne generiranje — pre-generirani file bi
zastario prije nego se stigne uvesti).
