# S180 — testovi (2026-10-22)

Korak 8 preuređivanja Financija: sheet `Preuređivanje` s odlukama §8.2 (Saša 22.10.), izbornik Namjene
„Nena / Kućište", grep po Python rječnicima, shortcuti koje Kokin uvoz ne vidi. Sve brojke ispod su
**izmjerene** 22.10. na TEST-u = kopija PROD-a od 22.10. 14:15 (`prod_to_test.py --settings`), kroz modal,
pod vlasnikom. PROD je u 14:40 bio **identičan** (kontrola: saldo, N/A, svi parovi, Σ — ISTO).

⚠ **Prije svakog testa u pregledniku: Ctrl+Shift+R** (stari bundle tiho osakati uvoz, S118).

---

## T-S180-1 ✅ S180 (TEST, automatski kroz modal) Pregled → Primijeni → kontrola → Poništi → kontrola

**File:** `Claude-temp_R/s180/structure_export_test_preuredjivanje.xlsx` (Structure export TEST-a +
`node Claude-temp_R/s180/build_sheet.mjs`). Pokretač: `node Claude-temp_R/s180/run.mjs <file> [--keep]`.

- Rezultat uvoza: `Attributes updated 1` (namjena: „Kućište" → „Nena / Kućište"), `Area settings changed 1 ·
  Financije_all: groupings` (dva bucketa koja bi se raspala), ostalo 0.
- Pregled: `24 steps · 6.066 changes · 5.455 rows`, bez grešaka i bez upozorenja; „Also changes (14)".
- Apply **2,4 s** (RPC 2.338 ms; granica 8 s), „exactly what the preview predicted ✓"; Undo **1,1 s**,
  „exactly what it was before ✓". Drugi put (`--keep`, TEST ostaje primijenjen): Apply 2,1 s, op `2b200967`.
- Kontrola (`kontrola.mjs --diff`): saldo ZABA 10.304,61 / RF 905,45 **isto** · Σ neto 55.693,64 **isto** ·
  N/A 1.392 → 1.379 · povrat: sve četiri tablice ISTO.

## T-S180-2 ⬜ (PROD — Saša pa Koka) Preuređivanje Financija na PROD-u

Naredbe: `NEXT_SESSION_PROMPT.md` § „PROD — korak 8". Preduvjet: deploy s `ca7fa08` (klik sa strane ne
zatvara modal) — inače slučajan klik poslije Apply odnese Undo.

1. **Saša:** backup PROD-a (`backup_db.py --env prod`).
2. **Saša:** Ctrl+Shift+R → Area `Financije_all` → Structure → **Export** → `node
   Claude-temp_R\s180\build_sheet.mjs "<export>.xlsx"`.
   **Očekivano:** `AreaSettings: makni rows[39] (Razno / Odjeća/obuća/ostalo_Sasa)` i `rows[44] (Kuća /
   Osiguranje)`, `namjena: 3 retka`, `Preuređivanje: 24 koraka`. Alat STANE ako nešto ne nađe točno.
3. **Koka (vlasnica), na računalu:** Ctrl+Shift+R → Structure → **Import** → `…_preuredjivanje.xlsx` → Import.
   **Očekivano — rezultat uvoza:** `Attributes updated 1`, `Area settings changed 1 · Financije_all:
   groupings`, ostalo 0.
4. **Očekivano — pregled** (sam se pojavi): `Financije_all · 24 steps · 6.066 changes · 5.455 rows`
   (svaki redak upisan poslije 22.10. 14:15 dodaje +1 u korak 99 i u zbroj). Koraci (rows / changes):
   **1:** 13/39 · **2:** 13/39 · **3:** 1/2 · **4:** 2/4 · **5:** 1/2 · **6:** 4/8 · **7:** 14/28 · **8:** 54/108 ·
   **9:** 10/20 · **10:** 18/36 · **11:** 126/252 · **12:** 23/46 · **13:** 53/106 · **14:** 20/40 ·
   **15:** 104/208 · **16:** 10/20 · **17:** 109/109 · **18:** 134/134 · **19:** 1/1 · **20:** 113/226 ·
   **21:** 14/14 · **22:** 32/32 · **23:** 172/172 · **99:** 4.420/4.420.
   „Also changes (14)": izbornik Podtipa (Audible, Kindle, Sport, Medical, Lječnička komora,
   Odjeća/obuća/ostalo, `Projekti: Sasa → Saša`, `Kuća: makni Osiguranje`, `Prihodi: dodaj Nasljedstvo`,
   `Osiguranje: dodaj Kuća`) + 13 redaka bucketa (tri para „sažet u jedan redak").
   **Novo u odnosu na TEST:** žuto upozorenje o shortcutima (Area je dijeljena) — očekivano, rješava korak 7.
5. Kvačica → **Apply**. **Očekivano:** `✓ Applied · op … · 6.066 changes · ~2–5 s`, „exactly what the
   preview predicted ✓". **Ne zatvarati** modal dok se ne pogleda (Undo živi samo u njemu).
6. **Saša:** `node Claude-temp_R\s180\kontrola.mjs poslije --env prod` i
   `node Claude-temp_R\s180\kontrola.mjs --diff Claude-temp_R\s180\kontrola_prod_prije.json Claude-temp_R\s180\kontrola_prod_poslije.json`.
   **Očekivano (isto kao TEST):** `saldo: ISTO ✓` · `na 1392 → 1379` · `ukupno … ✓` · namjena
   Zajedničko 4.420 · Saša 548 · Koka 471 · Nena / Kućište 16 (Σ −9.534,95 = u fondu ostaje 9.534,95).
7. **Saša:** `fix_shortcuti_S180.py` (dry run pa `--apply --yes-prod`). **Očekivano:** `AI_rucak 768a6056
   Projekti / Sasa ⇒ Projekti / Saša · Namjena Saša`, `Za ispravak: 1 od 5`, pa „upisano i pročitano natrag".
8. **Saša:** `set_breakdown.py` dry run na PROD-u. **Očekivano:** `grupiranje: ISTO`, `nesvrstano u cijeloj
   povijesti: ništa`.
9. **Koka, mobitel:** Add → Tip `Zabava` ⇒ Podtip nudi `Audible` i `Kindle` (bez `_Koka/_Sasa`), Namjena
   zadano Zajedničko i nudi `Nena / Kućište`. Overview → „Kamo ide novac" This Year: `Audible` jedan redak.

**Pad:** crvena greška u pregledu / nema Apply ⇒ ne dirati, slika ekrana. „baza se promijenila od pregleda"
⇒ netko je upisao redak između pregleda i Apply — ponoviti uvoz. Saldo pomaknut ⇒ **Undo** odmah.

## T-S180-3 ✅ S180 `preuredjivanje_grep.py`: korak s `event_id` ne gasi naziv

Korak `kad tip = N/A` + 13 `event_id` davao je jak pogodak za svaki `'N/A'` u kodu (106 jakih, od toga
77 lažnih). Sada: **29**, poslije ispravka četiri živa alata **8** — svi u jednokratnim skriptama S107
(`update_pravila_s107h`, `apply_label_fixes`, `migrate_taksonomija` — zapis, ne diraju se). S179 sheet i
dalje 71 (T-S179-5 nepromijenjen).

## T-S180-4 ✅ S180 `fix_shortcuti_S180.py` na TEST-u

Podmetnut shortcut `S180_fake_AI_rucak` (`Projekti / Sasa`) ⇒ dry run `1 od 4` ⇒ `--apply` „upisano i
pročitano natrag" ⇒ ponovni dry run `0 od 4` ⇒ shortcut obrisan. TEST-ov vlastiti `Biberon` je planer već
preimenovao sam (vlasnikov je) — rupa je samo kod tuđih shortcuta.
