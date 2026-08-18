# S107i — testovi i radni koraci (2026-07-20)

Kontekst sesije: **PBZ Visa split + merge** (1538 tx iz `Nematchano` sheeta u Review kao novi retci) +
reconcile/Problem dijagnoza. Jači model (Opus) jer je rizičnije (pravi novac, person-split, sortiranje
s DV dropdownima). Detalji: `data-prep_tools/Financije/ENRICH_PLAN.md` §2g.

**Ključne odluke (Saša + Koka):** dedup TAG-AGNOSTIČKI (Kartica tag ≠ osoba — Saša bilježio kupovine s
obje kartice); BEZ person-splita (Odluka 2a — svi novi retci Racun=Sašin RF, Izvor=Visa, osoba kroz
Podtip); lump→Transfer/izmedju racuna; povijesne Sašine Visa (2023-25, nisu bile u Excelu) → dodaju se.
Sort Opcija B (presortirati cijeli Review po event_date).

---

## T-S107i-1 — merge_pbzvisa.py PREVIEW (dry-run)

`Financije\run.bat merge_pbzvisa.py --dry` → `pbzvisa_PREVIEW.xlsx` (kopija Review + dodani retci, NE dira Review).

**Verificirano skriptom (scratchpad):**
- 1538 PBZ tx → dedup **187** matcha postojećih 220 Sašinih Visa (tag-agnostički, plateau na ±2 dana) → **1351 novih**
- Split: Koka 895, SAŠA 424 (povijesne), lump 32
- Sort: **0 event_date padova** (savršeno usortirano)
- DV dropdowni prošireni `J2:J4856` / `K2:K4856` (novi retci imaju Tip/Podtip dropdown)
- Formati (datum ISO, iznos, obrubi) naslijeđeni s postojećeg Visa reda
- **3503 postojećih source_key svih prisutno, 0 promijenjeno**; 1351 novih source_key jedinstveno
- 1 duplikat source_key = **pre-existing** (Mastercard par 17.82€ 2022-12-21, nije iz mergea)

**Status:** ✅ verificirano; Saša pregledao PREVIEW ("izgleda ok").

## T-S107i-2 — Pravi merge run

`Financije\run.bat merge_pbzvisa.py` (bez --dry). Review 3504 → **4855**; `Sašin RF|Visa` 220 → **1571**.
Backup `Financije_review_20260710_1448.pre-pbzvisa-20260720_110952.xlsx`.
**Status:** ✅ (finalno stanje verificirano: 0 sort padova, Racun×Izvor cross točan).

## T-S107i-3 — apply_rules na mergeanom Review-u

`apply_rules.py --dry` → 257 → pravi run (identično): **257 klasificirano + 246 Napomena**
(konzum 230, bauhaus 16, parking 10, podizanje 1). Backup `pre-rules-20260720_111111`.
N/A: novih 1351 → 289 klasificirano (257 pravila + 32 lump), 1062 ostaje N/A za sljedeći krug.
**Status:** ✅ (dry=real brojevi, Pravilo run stamp 2026-07-20 11:11 na 257 redaka).

## T-S107i-4 — reconcile_izvoda.py (Coverage + Nematchano_v2 + Problem)

`reconcile_izvoda.py` → piše u `Izvodi_transakcije.xlsx` (backup `pre-reconcile-20260720_123953`):
- **`Nematchano_v1`** = freeze pre-mergea (baseline za diff)
- **`Nematchano_v2`** = 257 nematchanih tx + **`Problem`** kolona (crveno = Smjer problemi)
- **`Coverage`** = matched/NEDOSTAJE po tipu + Problem breakdown

Coverage: **PBZVISA 1538/1539** (bilo 1/1539 — merge potvrđen!), ZABA 516/108, RF 235/29, MC 973/119.
Problem breakdown (257): 101 "možda već u Reviewu", 66 kartična kupovina, 51 nedostaje, **39 Smjer?** (ZABA bug).
**Status:** ✅ sheetovi zapisani.

## T-S107i-5 — Saša vizualni pregled Reviewa ⬜

U `Financije_review_20260710_1448.xlsx`, Review sheet:
1. Filtriraj `Izvor reda` = `PBZ Visa:*` (search "PBZ") → 1351 novi redak
2. Provjeri da su usortirani po datumu (2023-10 HGSPOT rate među ostalim 2023-10 retcima)
3. RATA retci → `Rate?=DA` + `Broj rata`; lump (`PBZ Visa:lump`, 32) → Transfer/izmedju racuna
4. Klik na Tip/Podtip ćeliju novog reda → dropdown radi
5. Filtriraj `Pouzdanost=PRAVILO` + `Pravilo run=2026-07-20 11:11` → 257 auto-klasificiranih

## T-S107i-6 — Saša pregled Problema ⬜

U `Izvodi_transakcije.xlsx` → sheet **`Nematchano_v2`**, filtriraj kolonu `Problem`:
- **crveni redovi** (`Smjer?`, 39) → ZABA parser bug, kandidati za fix
- `nedostaje (nema kandidata)` (51) → stvarno fali, istražiti
- `možda već u Reviewu` (101) → vjerojatno unutra, datum odmaknut
- `kartična kupovina` (66) → MC/Visa, nije itemizirano (očekivano)

---

## Novi/izmijenjeni alati

- **`merge_pbzvisa.py`** (novo) — merge PBZ Visa iz Nematchano u Review; tag-agnostički dedup, Opcija B
  sort (cijeli Review po event_date + stil s template reda + DV/autofilter proširenje), idempotentno
  (source_key skip), `--dry` piše PREVIEW.
- **`reconcile_izvoda.py`** (novo) — coverage izvod→Review + Nematchano_v1 freeze + Nematchano_v2 s
  Problem dijagnozom (Smjer?/nedostaje/možda-u-Reviewu/kartična) + Coverage sažetak. Ne dira Review.
- **`merge_missing_account.py`** (novo, SPREMAN ali NE koristiti) — dodavanje nedostajućih account tx;
  BLOKIRAN dok se ne popravi ZABA Smjer bug (dry-run uhvatio priljeve krivo označene kao Isplata).

## Backlog nalaz (S107i)

**Fix `parse_zaba_racun` (Smjer + potpunost)** — parser krivo određuje Priljev/Odljev za dio tx
(≥35 ZABA: mirovina, Priljev iz inozemstva, uplate → Isplata) po X-poziciji iznosa; saldo-lanac
(POČETNO+Σtx=NOVO) ne zatvara (fali ~359-544€/mjesec 2026). Preduvjet za: account merge, bank kolone
UplataB/IsplataB/SaldoB, saldo-vs-Koka reconcile (tekuća godina prioritet, dio s Kokom). Bankovni
mjesečni saldi (ZABA POČETNO/NOVO STANJE) su pouzdani i ulančavaju — parsabilni iz teksta kad fix dođe.
