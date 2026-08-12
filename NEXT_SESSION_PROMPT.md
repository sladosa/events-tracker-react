# NEXT SESSION PROMPT — nakon S107w (testovi gotovi) + S107x Faza 1a (model dokazan)

**Zadnje dvije sesije. PROD deploy izvršen 2026-08-12 (`main` = `7239c8d`).**

| sesija | što | commit |
| --- | --- | --- |
| **S107w** (Sonnet) | ručni testovi T-S107w-4…9 ✅, **regresija 28/28 PASS** | `837a201` |
| **S107x Faza 1a** (Opus) | model salda **dokazan** nad 4.996 redaka, prije ijednog reda koda | `d692791`, `8579bba` |

**Trajni plan prelaska:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13**.

---

# ŠTO PROČITATI PRIJE NEGO SE DOGOVORIMO

Poredano po tome što otključava odluku. Ukupno ~30 min.

| # | Što | Koliko | Zašto baš to |
| --- | --- | --- | --- |
| 1 | **Ovaj file, DIO 1** | 5 min | tri odluke koje čekaju tebe |
| 2 | `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` — **§1 i §2** | 10 min | presuda + tri stvari koje su mi promijenile način mjerenja. §3 preskoči zasad. |
| 3 | `data-prep_data/Financije/saldo_model_nalazi.xlsx` (⚠ **.xlsx**, ne .tsv — dvoklik) | 10 min | preostalih 69 označenih redaka, autofiltar na `sifra`. Ono što je bilo hitno (`NAPLATA<KUPNJA`) je **popravljeno** — v. §B |
| 4 | `docs/OVERVIEW_TAB_SPEC.md` — **samo** „Faza 1a" u §2.5, plus §2.10 i §2.14 | 5 min | ta tri bloka su prepisana s rezultatima; ostatak si već pregledao |

**Opcionalno, samo ako želiš još jednom prije PROD-a:** `Claude-temp_R/test-sessions/S107w_tests.md`
(rezultati Sonnetove sesije) i `Claude-temp_R/PENDING_TESTS.md`.

**Ne moraš čitati** `verify_saldo_model.py` — sve što iz njega slijedi je u NALAZI dokumentu.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je novo

**Model salda je dokazan.** Pravilo „saldo miče `Izvor`, ne `Racun`" reproducira **bankovni
pomak u 17 od 30 mjeseci u cent**. Naivni zbroj (sve po računu) pogađa **0 od 30** — dakle to
nije bilo „malo netočno", nego besmisleno. Formula može ravno u bazu.

**Transfer se piše dvaput** (90,6 % iznosa), pa su oba salda točna i ništa se ne dupla.

**Jedno pitanje ostaje neodgovoreno**: raspodjela „planiranog" na dospjelo/uskoro/kasnije se na
ovim podacima **ne može** provjeriti, jer buduće rate u Reviewu ne postoje kao retci — njih tek
generira rata modal nakon uvoza. Nije rizik za pločicu salda, ali ne vodimo to kao potvrđeno.

## Odluke (sve tri zatvorene 2026-08-12)

### A. ✅ NAPRAVLJENO 2026-08-12 — PROD deploy izvršen

Merge `test-branch` → `main` (fast-forward `3930c8e..7239c8d`), `typecheck` + `build` čisti
prije mergea. Na PROD otišlo: S107v (kopirani redak = novi event) + S107w (`Delete?` kolona
+ izvještaj kao radni file) + S107x Faza 1a (alat i dokumentacija, ne dira bundle).

**⚠ Ovo je prvi put da Excel može brisati zapise na PROD-u.** Zaštita: zaseban popis + zasebna
kvačica. Smoke test na jednom bezopasnom zapisu nije naodmet.
**⚠ `sql/034_s107w_test_area.sql` je u mergeu ali se NE izvršava sam** — za TEST bazu je,
ne pokretati na PROD-u.

### B. ✅ NAPRAVLJENO 2026-08-12 — `Datum naplate` popravljen (49 redaka) + KEKS/trener (20)

`fix_datum_naplate_statement.py` i `fix_keks_trener.py`, oba s `.pre-*` backupom i
kontrolom (Σ Uplata/Isplata nepromijenjeni u cent, mijenjaju se samo ciljane kolone).
Označenih redaka **115 → 69**. Detalji: `SALDO_MODEL_NALAZI.md` §4b.

**⚠ 8 redaka svjesno ostavljeno** (`--include-obrnute` ih pokreće) — manjinska odstupanja
unutar statementa koji inače slijedi pravilo; jedan je pomak od 1 dana (11.04.2026. =
subota), šest su rate kupljene 29.05.2025. Treba ljudski pogled prije diranja.

**Sljedeće je batch 2025** (odluka C).

<details><summary>Izvorni opis nalaza (za kontekst)</summary>

Simptom: **`Datum naplate` je PRIJE datuma kupnje** — naplaćeno prije nego kupljeno, nemoguće.
Primjer: red 3494, kupnja **28.06.2025.**, naplata **11.06.2025.** (trebalo bi 11.07.2025.).

**Koji je datum kriv — riješeno dokazom, ne pogledom:** svih 27 (od 28) ima popunjen
`Izvod opis`, dakle matchani su na bankovnu transakciju i `event_date` im je sinkroniziran na
bankovni datum (`date_accuracy.py`, S107k). ⇒ **datum kupnje je bankovno potvrđen, kriva je
naplata.** 28. je red 4997, poznati loši redak iz S107v.

**⚠ Nije sustavni bug pravila.** Provjereno koliko *ostalih* MC kupnji poslije 11. ima ispravnu
naplatu:

| tok | ukupno MC | kriva naplata | kupnja >11. **ispravna** |
| --- | --- | --- | --- |
| `koka EU` | 1653 | 28 | **1096** |
| `Konsolidacija` | 88 | 0 | 68 |

Krivih je **28 od 1124**, u dva uska grozda: **3 retka 28.06.2025.** i **24 retka
16.–31.10.2025.** Pravilo dakle radi; ovo su zaostali.

**Popravak:** ne dirati pravilo u `kartice_datum_naplate.py`, nego **preračunati tih 28** —
nađi `Datum naplate < event_date`, dodijeli 11. sljedećeg mjeseca. Prije pisanja pogledati u
skripti zašto su baš lipanj i listopad 2025. ispali, da se ne ponovi kod sljedećeg batcha.
Backup prije pisanja.

**Zašto sad, a ne poslije:** kad redak jednom uđe u bazu, ne može se popraviti novim batchom
(sudario bi se `session_start` s već uvezenim danom, S107v). Popravak sad je izmjena u Reviewu;
popravak poslije je ručni rad kroz app. **26 od 28 je u 2025.** — a 2025. je sljedeći batch.

**Pregled (ako želiš vidjeti sam):** `data-prep_data/Financije/saldo_model_nalazi.tsv`,
filtar `sifra = NAPLATA<KUPNJA`; kolona `red` je broj retka u Review sheetu.

</details>

### C. ✅ ODLUČENO — prvo batch 2025, pa Faza 1

Saša, 2026-08-12. Popravak podataka (B) je gotov, pa je **batch 2025 sljedeći korak**,
a `balance_by_group` pločica (Faza 1) dolazi nakon njega — s više podataka je i zanimljivija
Koki kad dođe do koraka 3 (proba na mobitelu).

## Što ostaje za Koku (nepromijenjeno)

1. **700 € bankomat 26.11.2025.** — nije na izvodu
2. **`Saldo kontrola`, 7 razlika** — 2026-01 `+359`, 2024-09 `+149`, 2×`±49` multisport, 3 sitna
3. **Red 4997** (MC 21,88 €) — duplikat reda 4247?
4. **Red 4996** (parking 1,60 €) — datum kriv (stoji 07.08., pripada 04.–08.07.)

Faza 1a je dodala još četiri, sve iz 2025., sve s dokazom iz banke:

5. **Mirovina + Triglav** (redovi 2787/2788) — datirani u siječanj, banka ih vidi u veljači
   (2.385,65 €). Poništavaju se između dva mjeseca, pa je to sigurno datum, ne iznos.
6. **Anjina rata 72/96 dvaput** — Kokinih 450 € (red 3609) *i* bankovni split 400+50 (3612/3613)
7. **Allianz Lacetti** (red 2368, 236,04 €) — banka ga nema u tom prozoru
8. **Dvije Mirovine isti dan** 08.07.2024. (redovi 2001/2004, različiti iznosi)

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje grana

| grana | commit | sadrži |
| --- | --- | --- |
| `test-branch` | v. `git log` | S107v + S107w + S107x Faza 1a + popravci podataka |
| `main` (PROD) | `7239c8d` | **isto** — PROD deploy izvršen 2026-08-12 |

`typecheck` + `build` čisti (pokrenuti prije mergea na `main`). Faza 1a nije dirala `src/`.
Radna kopija: samo `Claude-temp_R/test-sessions/S107_tests.md` (gitignoriran direktorij).

## Faza 1a — što je dokazano i čime

Alat `data-prep_tools/Financije/verify_saldo_model.py` (READ-ONLY, nema `.save()`;
`--rows` = detalj rezidualnih mjeseci, `--nalazi` = izvoz u TSV).

**Tri stvari koje ne otkrivati ponovo:**

1. **Mjeri se POMAK protiv banke, ne razina.** Usporedba s `Saldo kontrola` (kako je izvorno
   planirano) **nije izvediva** — Kokin `Stanje` je lanac iz redoslijeda *njenog* workbooka, a
   Review je presortiran po `event_date` (S107i) ⇒ **969 puknuća od 2.564**. Usporedba razine
   mjerila bi artefakt sortiranja. Pomak je neovisan o sidru. ➡ potvrđuje **OQ-5**.
2. **Udio po iznosu ≠ udio po komadima.** Transferi: 42,5 % po komadima, **90,6 % po iznosu** —
   vodi u suprotan zaključak.
3. **Neto zbroj isključenih redaka može podcijeniti problem** kad isključeni skup nosi obje
   strane iste stvari (32 retka `PRIMLJENA UPLATA` imaju `Izvor=Visa`, Σ +40.244,88, pa se s
   Visa potrošnjom skrate). Mjeriti bruto: **81.591 €** RF, **56.894 €** ZABA.

**Zamka:** ime skripte ne smije biti ime stdlib modula — `inspect.py` je srušio `openpyxl`
(`partially initialized module`, jer `numpy` radi `import inspect`).

## Sljedeći koraci (prijedlog, ovisan o odlukama A/B/C)

1. **PROD deploy** — ⚠ samo na izričit Sašin zahtjev (Netlify troši kredite). Slijed:
   `git checkout main && git merge test-branch --no-edit && git push origin main`, pa
   **sync back** na `test-branch` (bez toga `test-branch` zaostaje).
2. ~~Preračunati `Datum naplate`~~ ✅ **NAPRAVLJENO 2026-08-12** —
   `fix_datum_naplate_statement.py` (49 redaka) + `fix_keks_trener.py` (20). Označenih
   115 → 69. **8 redaka svjesno ostavljeno**, pokreće ih `--include-obrnute` (v. §4b NALAZI).
3. **Batch 2025** — `--to 2025-12-31`, granica **uvijek na danu** (inače `session_start`
   `09:00 + n` sudara s već uvezenim danom).
4. **Faza 1 — `sql/035_area_group_agg.sql`** (⚠ **ne 034**, zauzeo ga `034_s107w_test_area.sql`)
   + hook + jedna pločica `balance_by_group` iznad Activities liste.
   Tri pravila iz §2.4 koja se ne smiju prekršiti: `SECURITY DEFINER` **mora sam provjeriti
   pristup**; **P2 parent eventi se nikad ne zbrajaju**; čita se `value_number`, ne parse teksta.
5. **`TRANSFER-BEZ-PARA` (42 retka)** — labela, ne saldo. Popraviti **prije `breakdown`
   pločice**, ne prije `balance_by_group`. 23 od 42 su u 2023. (zadnji batch) ⇒ nema žurbe.

## Otvoreno (nepromijenjeno)

- **T-S107v-7 (PROD):** kad se View opet ne otvori nakon Finish — poslati poruku s ekrana
  („Couldn't load this activity" + tekst greške vs „Activity not found"). Uzrok još nije nađen.
- **E2E cold start:** prvi test u hladnom pokretanju zna pasti (leftover iz prekinutog pokušaja;
  `beforeEach` inserta bez čišćenja). Predloženo: timeout 10 → 20 s u `e2e/fixtures/filter.ts`.
- `sql/033_delete_area_cascade.sql` SECTION 2b — jesu li policyji iz `020_orphan_rls.sql` na TEST-u
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu
- `T-S107u-2` — `groupAttributes` uzima `Default` s prvog retka grupe (bezopasno, konvergira)
- **Bulk delete (checkbox) nije ograničen za grantee-a** — stari backlog
- **§2.13 (tri kante planiranog)** — neprovjerljivo do prvog importa s generiranim ratama
- `Claude-temp_R/` i `data-prep_data/` su gitignorirani ⇒ test-session dokumenti i TSV su **samo
  lokalni** + na vanjskom disku (`Tools/backup_to_external.bat`). Trajni zapis ide u `CLAUDE.md`.
