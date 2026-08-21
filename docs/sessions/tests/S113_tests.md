# S113 — detaljni testovi (2026-08-21)

**Tema sesije:** tranše 1 i 2 (Racun dio) uvezene i **potvrđene bankovnim izvodom** ·
`fill_from_izvod.py` (puni app-ov Excel iz izvoda) · izvještaj o uvozu nosi layout uvezenog
filea · sidro dobiva podrijetlo.

**Prošlo bez zasebnog testa** (viđeno uživo): T-S112-3, T-S112-4, i tranša 2 Racun dio —
`Sašin tekući RF` = **799,12 €** na 11.08.2026., u cent jednako ispisanom `NOVO STANJE`
s `RF_2026-07.pdf`. Sidro na 11.08. postavljeno kroz pločicu.

---

## T-S113-1 ⭐ Izvještaj o uvozu otvara se s layoutom filea koji je uvezen

**Zašto:** izvještaj je nastavak radnog filea. Dosad se otvarao s podrazumijevanim stupcima,
pa su kolone koje trebaš bile iza zamrznutih okna i morao si ih tražiti.

**Preduvjet:** uvoz koji stvarno nešto napravi — izvještaj se ne generira kad je sve skipped.

1. Izvezi Activities s profilom (`Financije1`), popuni bar jedan redak, uvezi.
2. Otvori `import_report_*.xlsx`, list `Events`.
   - **Očekivano:** isti redoslijed stupaca, iste grupe skupljene, iste širine kao u fileu
     koji si uvezao; `Filter` list u retku `Export profile` piše ime profila.
   - **Pad:** svi stupci razmotani, `row_hash` i `Delete?` široki i razvučeni.
3. Provjeri **desni kraj** lista.
   - **Očekivano:** `row_hash`, `Delete?`, `Result`, `Source row`, `Changed` su **vidljivi**.
   - **Pad:** sakriveni — profil je pozicijski prešao preko atributskih stupaca (izvještaj
     nosi samo dodirnute kategorije, pa ih može imati manje nego profil).

---

## T-S113-2 Sidro upisano kroz pločicu nosi podrijetlo

**Zašto:** mehanizam počiva na tome da potvrđeno stanje dolazi **izvana** (§2.17), a iz same
brojke se poslije ne vidi je li s izvoda, s ekrana banke ili izračunata. Do S113 je
`balance_anchors.note` iz UI-ja ostajao `NULL`.

1. Overview → pločica → uz „u banci" upiši iznos i u polje **„odakle"** npr.
   `ispisano NOVO STANJE, RF_2026-07.pdf` → **Potvrdi**.
2. U bazi (`select note from balance_anchors order by created_at desc limit 1`):
   - **Očekivano:** `ispisano NOVO STANJE, RF_2026-07.pdf (upisano u aplikaciji)`.
3. Ponovi bez upisanog izvora.
   - **Očekivano:** `upisano u aplikaciji — izvor nije naveden` (dakle **nikad `NULL`**:
     zapisano je da izvor nije naveden, što nije isto što i „nema bilješke").

---

## T-S113-3 `fill_from_izvod.py` — tranša 3 (ZABA)

**Zašto:** alat je dosad vožen samo na RF izvodu (11 transakcija). ZABA izvod ima 38 i drugi
parser, pa je ovo prvi pravi test generičnosti.

1. Export delta sheet za `Kokin tekući ZABA`, spremi kao `transa3.xlsx`.
2. `run.bat fill_from_izvod.py data-prep_data\Financije\transa3.xlsx --zaba …` ⚠ **ZABA izvor
   još nije spojen na alat** (`--rf` i `--visa` postoje) — dodaje se u tranši 3.
3. Kontrolni broj: **ZABA @ 30.07.2026. = 13.815,33** (ispisano `NOVO STANJE`, `ZABA_2026-07.pdf`),
   i **@ 09.08. = 14.722,84** (Kokin lanac).
   - ⚠ Ako se 30.07. poklopi a 09.08. ne, greška je u Kokinim retcima poslije izvoda.
   - ⚠ **Onih 5 spornih lipanjskih redaka** (Σ 373,11) pada prije ZABA sidra (01.07.) i po
     pravilu „strogo nakon" tiho ispada iz salda — v. CLAUDE.md.
