> Pisano protiv commita **S161** na `test-branch` (zadnji commit = „S161: kraj sesije").
> **`main` = `006374c` (deploy S160, 04.10.)**. Na `test-branch` je poslije deploya S160b (grantee bez
> „Other...") + dvije sitnice (app) i S161 (samo Python alat + dokumenti) — idu s idućim deployem.
> ⚠ Ako `git log` pokazuje noviji commit od S161, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S161 (2026-10-05)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S161

- **Rujan je zatvoren.** ZABA i Visa izvod za rujan obrađeni, a ZABA, RF i Visa se slažu s bankom
  u cent. Razlika od 8,60 na Kokinoj ZABA-i bila je tvoja kupovina u Ljekarni Štimac (Visa),
  upisana na njen račun. Premještena je, i to je jedan redak, ne brisanje plus novi.
- **Visa uvoz:** Koka je uvezla 9 novih, 33 ispravka i 1 brisanje (dvostruki Eurospin). Ušle su i
  naplata Vise i naknada na RF-u. Sidra su upisana s ekrana banke: ZABA 11.191,11, RF 2.040,18 na 04.10.
- **Visa alat više ne treba doradu svaki mjesec.** Isti alat radi za svaki izvod. Sam predlaže
  duplikate i kupovine upisane na krivo mjesto, ali ih ne dira bez tvoje potvrde.
- **Mjesečni postupak** je zapisan u `docs/FINANCIJE_PROCES.md` §5:
  - **Visa:** izvod (~3.) → platiš fotonalogom → jedna naredba s datumom plaćanja → Koka uveze jedan file.
  - **ZABA:** ako je mjesec ✓ u `promet_check`, upisuje se samo sidro, bez uvoza.

## Što treba od tebe

1. **11.10.** Koka u traci potvrđuje MC naplatu (1.189,34) — T-S158-1.
2. **RF izvod**, kad stigne: kontrola `promet_check` za RF.
3. **~03.11. Visa izvod za listopad:** platiš, javiš datum, i radimo istom naredbom (T-S161-3 mjeri
   da alat prolazi bez izmjene).
4. Iz S160 i dalje: D3 odluke (spec §7) · T-S160b-1 vlasnička strana · deploy S160b + S161 kad
   ti odgovara (naredbe: CLAUDE.md § End of session 11).

## Što je sljedeće u backlogu

- **Sesija održavanja Financija (prije ~05.11.):** „Visa u traku" (T2) zajedno s budućim ratama 4
  stara Visa plana (T28: Bauhaus 4/6, Bauhaus 3/6, Šatrak 4/10, Spar 2/3) · T24 `rate_alat --only a`
  (91 redak) · T22 MC ostatak na zadnjoj rati · T21 lažna kvačica za kartične retke · T12 Σ košare
  po jednom dospijeću.
- P3: F5 `AreaSettings` · Help chip „What can I do here?" · D3-F1 (nakon tvojih odluka).
- P4: promjena Aree čita `categories` 7× · Edit `datetime` u UTC satu · rename sluga ne popravlja
  `attribute_rules`.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `006374c` (S160). `test-branch` = S160 + S160b + 2 sitnice (app) + S161 (Python + docs,
**bez migracije**). TEST = kopija PROD-a od **01.10.** (nema S161 uvoza). PROD: `Financije_all`
ZABA i RF sidra @ 04.10. (s ekrana, `created_by` Koka); `promet_check` 30 u cent, 3 stara iz 2024.

## Novo u S161

- `visa_uvoz_izvoda.py` prepisan: `[naplata]` neobavezan (bez = prije naplate, dospijeće iz PDF-a);
  s datumom dodaje RF naplatu + `NAKNADA 0,17` ako nema ničeg sličnog ±3 dana (inače `sys.exit`);
  prolazi: rate (plan = isti dan + trgovac u žigu ILI bez žiga s istim `Broj rata`) → točan iznos →
  blizak (±2 d, ≤15 %, jedini; uz više kandidata jedini istog dana) → drugo mjesto (`--premjesti`)
  → novi; `potvrdjen_drugdje(r, ym)` = žig iz drugog mjeseca naplate; nepromijenjeni spareni retci
  ne idu u file; zadnji redak ispisa = očekivani pregled uvoza.
- Test na poznatom slučaju: `PBZVISA_2026-08.pdf 2026-09-07` ⇒ 48/48, 0/0 (svaka buduća izmjena
  alata to mora ponoviti).
- File S161: `data-prep_data/Financije/visa_uvoz_2026-09_20261005_0926.xlsx` (redak d0155b1c
  `Razno/Pokloni` + komentar dopisan ručno skriptom; `--klasa` opcija namjerno nije građena).

## Otvoreno / neverificirano

- T-S161-3 (studeni bez izmjene alata) · T-S160b-1 vlasnik · T-S140-8 + T-S141-1 puni E2E run.
- MC alat (`fill_from_izvod --mc`) nema ništa od S161 pravila (blizak iznos, duplikat, krivo mjesto):
  T13/T14 za MC ostaju.
- `DOSPJELO_SPEC` Visa `text` zastario; 2 stara MC plana iz 2025.; `Rate? = No` broji samo spremljeno Ne.
