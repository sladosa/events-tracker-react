# NEXT SESSION PROMPT — nakon S113 (tranše 1 i 2 zatvorene, tranša 3 je na redu)

**Pisan protiv commita `36bc6c1`** (+ commitovi zatvaranja sesije koji slijede odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S113. `main` = PROD, nije diran ni danas.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je danas napravljeno

**Oba računa su usklađena s bankom, i to protiv ispisanih brojeva s izvoda, ne protiv naših.**

- **RF na 11.08.2026. = `799,12 €`** — točno kako piše na `RF_2026-07.pdf`. Sidro je postavljeno,
  pa se saldo više ne računa kroz 207 promjena unatrag nego kreće od te potvrde.
- Uvezeno: 7 redaka tranše 1, 3 retka tranše 2, pa 45 Visa kupovina.
- Izvod je usput potvrdio i tvoj ispravak `250,93 → 253,51` — banka piše `253,51`.

**Novi alat `fill_from_izvod.py`** puni Excel umjesto tebe. Ti izvezeš delta sheet iz appa,
alat u njega upiše retke s bankovnog izvoda, ti pogledaš i uvezeš. Ne prepisuješ ništa rukom,
a opisi dolaze **iz Kokine Excelice** (`Konzum`, `Parking`, `Ljekarna`) — ne iz strojnog teksta
izvoda.

## Što je sljedeće — tranša 3 (ZABA)

Sve je spremno, treba ~15 minuta:

1. Overview → klikni saldo **`Kokin tekući ZABA`** → Activities → Export → **Delta sheet** →
   spremi kao `data-prep_data\Financije\transa3.xlsx`
2. ```
   data-prep_tools\Financije\run.bat fill_from_izvod.py data-prep_data\Financije\transa3.xlsx --zaba data-prep_data\Financije\izvodi\ZABA_2026-07.pdf --koka "data-prep_data\Financije\Financije 2026-08-16.xlsx" --dry
   ```
3. Kad popis izgleda dobro, makni `--dry`, otvori `transa3_filled.xlsx`, uvezi.

**Kontrolni broj: `13.815,33` na 30.07.2026.** — to je `NOVO STANJE` ispisano na izvodu.
Ako izađe, ZABA lanac je zatvoren izvana i sidro ide na 30.07.

⚠ Ako **ne** izađe, razlika je u razdoblju **01.–08.07.** koje baza već ima od Koke — ondje su i
onih 5 spornih lipanjskih redaka (Σ `373,11`) o kojima je pitanje za nju još otvoreno.

## Što još čeka tebe

- **11 kartičnih stavki nema para u Kokinom fileu** (popis je u `DONE_HISTORY` S113 §6 i ispisuje
  ga alat). Ili ih nije zapisala, ili se iznos razlikuje — drugo bi bio isti razred greške koji
  smo lovili u S111.
- **`845,12`** — planirani redak u bazi bez komentara, i dalje neobjašnjen.
- **Onih 5 spornih redaka od 16–17.06.** — pitanje za Koku.

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S113** · CLAUDE.md sekcije „Excel", „Delta sheet",
„Python alati" (svaka je danas dobila nove zamke) · `docs/sessions/tests/S113_tests.md`.

## Novo u S113

| Što | Gdje |
| --- | --- |
| `fill_from_izvod.py` — puni app-ov Excel iz izvoda, po IMENU zaglavlja | `data-prep_tools/Financije/` |
| `--rf` / `--zaba` / `--visa`, `--protiv` (dedup referenca), `--koka` (opisi) | isto |
| OCR keš po md5 (`_arhiva/ocr_cache/`) — RF izvod se OCR-a jednom | isto |
| `rf_ocr.py` zadržava ISPISANO stanje (`stanje_izvod`) | `rf_ocr.py` |
| `fix_anchor_notes.py` — sve bilješke sidara na jedan oblik | `data-prep_tools/Financije/` |
| izbornik „odakle" uz potvrdu stanja (nikad `NULL`) | `BalanceByGroupTile.tsx` |
| broj praznih redaka u delta exportu je polje | `ExcelExportModal.tsx` |
| izvještaj o uvozu nosi layout uvezenog filea | `excelImportReport.ts`, `exportProfile.ts` |

## Popravljeni bugovi (svi „tihi")

- `Date.UTC` mjesec 0-based ⇒ delta prozor mjesec prekasno
- `Area`/`Category_Path` iz prvog retka ⇒ usklađen račun daje predložak bez `Area`
- `errorStyle="error"` ⇒ openpyxl ne može otvoriti app-ov export
- openpyxl bilješka ⇒ exceljs padne, file neuvoziv
- profil pozicijski preko atributskih stupaca ⇒ mogao sakriti `Delete?`/`Result`
- `run.bat` rezao argumente od petog nadalje

## Otvoreno / neverificirano

- **T-S113-2** (bilješka sidra iz UI-ja) i **T-S113-3** (tranša 3) ⬜.
  ⚠ T-S113-3 je pisan dok `--zaba` još nije postojao — sada postoji, korak 2 se može ispraviti.
- **T-S112-5** (započet redak predloška pada kao greška) ⬜ — prazan slučaj je pokriven.
- **T-S111-1, -3, -4, -5, -6** i dalje ⬜.
- **Kozmetika:** delta sheet nad praznim prozorom pokazuje `#N/A` u Max/Min/Summ ćelijama
  (formule bez raspona). Ne dira uvoz — leže iznad zaglavlja.
- **`sql/037` i `038` nisu na PROD-u** — Overview je i dalje TEST-only.
- **Faza 3 (automatika na Import putu)** je i dalje sljedeći veliki komad koda. Kokina kolona G
  je danas dala argument više: ona već vodi „trošak zabilježen, naplata nepoznata", što je u
  našem modelu `Status = Planiran` + prazan `Datum naplate`.
