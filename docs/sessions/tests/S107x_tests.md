# S107x — Faza 1a (dokaz modela salda) + popravci podataka + Pitanja za Koku

**Datum:** 2026-08-12 · **Model:** Opus 5 · **Grana:** `test-branch`
**Prethodno u istom danu:** S107w (Sonnet) — ručni testovi 6/6, regresija 28/28 PASS
**PROD deploy izvršen** (`main` = `7239c8d`, fast-forward `3930c8e..7239c8d`)

**Nema promjena u `src/`** — cijela sesija je Python data-prep + dokumentacija.
Zato nema E2E ni typecheck testova specifičnih za S107x (typecheck+build su ipak
pokrenuti prije mergea na `main` i bili su čisti).

---

## Programske kontrole (izvršene, ne traže Sašu)

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | `verify_saldo_model.py` — model vs banka, 30 mjeseci | **17/30 u cent**; naivni zbroj po `Racun`u **0/30** ✅ |
| P-2 | Review netaknut kroz cijelu fazu mjerenja (`read_only=True`, nema `.save()`) | mtime ostao `Aug 1 14:55` ✅ |
| P-3 | `fix_datum_naplate_statement.py` — kontrola protiv backupa | **49 ćelija, sve `Datum naplate`**; Σ Uplata/Isplata u cent; broj redaka i kolona isti ✅ |
| P-4 | `fix_keks_trener.py` — kontrola protiv backupa | **80 ćelija** (20 redaka × Tip/Podtip/Alternativa/Pravilo run); Σ nepromijenjeni ✅ |
| P-5 | Ponovni `verify_saldo_model.py` nakon oba popravka | model i dalje **17/30** (popravci ne diraju iznos ni `event_date`); dvostranost transfera **90,6 % → 91,9 %** ✅ |
| P-6 | `make_pitanja_koka.py` — guard da svaki `source_key` u pitanjima postoji u Reviewu | prošao; sheetova 14 → 15, Review i dalje 4.996 redaka ✅ |
| P-7 | Označenih redaka nakon popravaka | **115 → 69**; `NAPLATA<KUPNJA` **28 → 1** ✅ |

---

## Ručni testovi (za Sašu)

### T-S107x-1 — `Pitanja za Koku` je čitljiv i upotrebljiv ⭐

**Zašto:** to je stranica koju ćeš otvoriti dok sjediš s Kokom; ako se ne čita, ne valja.

1. Otvori `data-prep_data/Financije/Financije_review_20260710_1448.xlsx`
2. Idi na sheet **`Pitanja za Koku`** (narančasti tab, odmah iza `Taksonomija`)
3. Provjeri:
   - **14 redaka**: 7 žutih (`redak`) pa 7 plavih (`mjesec`)
   - kolona **`U čemu je nejasnoća`** je bold i **cijeli tekst se vidi** (wrap, visina retka 46)
   - klik na ćeliju u koloni **`Odluka`** otvara dropdown sa 6 vrijednosti
     (`točno je`, `datum je kriv`, `iznos je kriv`, `duplikat — obriši`,
     `nedostaje zapis`, `ne sjećam se`)
   - `Njena napomena` je prazna i piše se slobodno
   - zadnja kolona `Ref` nosi broj retka i/ili `source_key`

**PASS:** sve gore točno; tekst pitanja razumiješ **bez** da gledaš Review.
**FAIL:** tekst odrezan, dropdown ne radi, ili pitanje ne možeš pročitati naglas Koki
kakvo jest → javi koje pitanje i prepisujem ga.

---

### T-S107x-2 — popravak `Datum naplate` (49 redaka)

1. U sheetu `Review` filtriraj `Izvor = Mastercard`
2. Nađi red **3494** (`Ikea 4/6`, kupnja 28.06.2025.)
   → `Datum naplate` mora biti **11.07.2025.** (bilo 11.06.2025.)
3. Nađi red **3931** (`TV zabava`, kupnja 16.10.2025.)
   → `Datum naplate` mora biti **11.11.2025.** (bilo 11.10.2025.)
4. Provjeri da **nigdje** nema retka gdje je `Datum naplate` **prije** `event_date`,
   osim reda **4997** (poznat, čeka Kokin odgovor)

**PASS:** oba retka popravljena, nema drugih „nemogućih".
**FAIL:** bilo koji drugi redak s naplatom prije kupnje → javi broj retka.

---

### T-S107x-3 — KEKS/trener (20 redaka)

1. U `Review` filtriraj `Napomena = KEKS`
2. Retci s iznosom **20,00 €** između **21.07.2023.** i **14.03.2024.** moraju imati
   `Tip|Podtip` = **`Zdravlje|Sport_Sasa`** (bilo `Transfer|izmedju racuna`)
3. Kolona `Alternativa / nap.` na njima sadrži `S107x fix: trener preko KEKS Pay`
4. Preostala 2 KEKS retka od 20 € (**29.10.2025.** `KUPOVINAKEKSPAY Zagreb` i
   **06.04.2026.** `Picek`) **NISU** dirnuta — namjerno, nisu trener

**PASS:** 20 redaka prebačeno, ona 2 netaknuta.
**FAIL:** dirnut neki koji nije trener → javi.

---

### T-S107x-4 — odluka o 8 „prekasnih" redaka ⏸ (traži tvoj sud, ne test)

`fix_datum_naplate_statement.py` je **namjerno preskočio 8 redaka** iako je opseg od 57
bio odobren — dokaz nije podupirao da su krivi:

| retci | što |
| --- | --- |
| 3366–3371 (6) | rate kupljene 29.05.2025.; statement `MC_2025-05` (32 retka točno, ovih 6 odstupa) |
| 1526 | `SPOTIFY AB`, statement `MC_2024-03` (30 točno, ovaj odstupa) |
| 4471 | `Temu`; naplata 12.04.2026. umjesto 11.04. — **11.04.2026. je subota** |

**Što treba:** pogledaj tih 8 i odluči je li pohranjeni datum stvarni datum knjiženja
(pa ostaje) ili zaostatak (pa se popravlja s `--include-obrnute`).
Šest ih je jedna te ista kupovina od 29.05. ⇒ to je **jedna** odluka, ne šest.

---

### T-S107x-5 — sjedenje s Kokom (kad stigne)

1. Prođi kroz `Pitanja za Koku`, popuni `Odluka` + `Njena napomena`
2. **⚠ NE pokreći ponovo `make_pitanja_koka.py`** — skripta je idempotentna i
   **briše popunjene odgovore**
3. Odgovori se primjenjuju ručno (14 redaka) ili se prvo napiše `--harvest`

**Trag za pitanja 10 i 11 (2×`+49`):** mjesečna Multisport uplata od 49 € nedostaje u
**07/2023, 11/2023, 06/2024, 03/2025** — jedan njen odgovor vjerojatno pokriva oba.

---

## Nakon svega — sljedeći korak

**Batch 2025 se generira TEK nakon ispravaka** (Sašin ispravak redoslijeda):
izostavljen redak se ne može vratiti novim batchom (sudar `session_start` za isti dan,
S107v) nego samo ručno kroz app.

Redoslijed: **pitanja → ispravci → batch 2025 (jednom) → dogovor o Fazi 1**.
