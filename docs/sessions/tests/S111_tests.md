# S111 — detaljni testovi (2026-08-18)

**Tema sesije:** RF lanac zatvoren (sidro + čišćenje duplikata) · `Cash` izbačen iz salda ·
datumski filtar na Overviewu · `038` — datum zadnjeg zapisa po računu.

**Preduvjeti za sve testove:** TEST baza, Area `Financije_all`, puštene migracije
`035` + `036` + **`037` ponovno** (bez `Cash` u filtru) + **`038`**.

**Sidra u bazi na kraju sesije — pet** (`balance_anchors`):

| `confirmed_on` | `group_value` | iznos | odakle |
| --- | --- | --- | --- |
| `2025-01-01` | Kokin tekući ZABA | 3.054,41 | ispisano, `ZABA_2024-12.pdf` |
| `2025-12-31` | Kokin tekući ZABA | 1.184,86 | ispisano, `ZABA_2025-12.pdf` |
| `2026-07-01` | Kokin tekući ZABA | 2.255,64 | ispisano, `ZABA_2026-06.pdf` |
| `2025-01-02` | Sašin tekući RF | **3.453,03** | ⚠ **KRIVO** — tipfelerica, ostaje kao povijest |
| `2025-01-02` | Sašin tekući RF | **3.458,03** | ispisano, `RF_2024-12.pdf` — **ovo je važeće** |

⚠ Dva sidra istog dana su **namjerna**: `036` nema UPDATE policy, ispravak je novi redak, a RPC
bira najnoviji `created_at`. Ako se testira `T-S111-2`, ne brisati ono krivo — ono **je** test.

---

## T-S111-1 ⭐ Datumski filtar postoji na Overviewu i ne resetira se

**Zašto:** filtar je bio montiran samo na Activities tabu, pa je (a) sidrenje unatrag tražilo
skok na drugi tab i natrag, i (b) **svaki** prolaz kroz Overview je odmontirao komponentu,
resetirao njeno lokalno `userModified` i vratio raspon na „All time".

**Preduvjet:** Area s Overview tabom (`Financije_all`).

1. Otvori `Financije_all`, tab **Activities**. Rasklopi Filter.
2. Postavi **To = 06.07.2026.** (From ostavi kakav jest). Period mora prijeći u `Custom`.
3. Prijeđi na tab **Overview**.
   - **Očekivano:** polja `From`/`To`/`Period` su **i ovdje vidljiva**, s istim vrijednostima.
   - **Pad:** filtra nema, ili pokazuje druge datume.
4. Podnaslov pločice mora glasiti **„na dan 06.07.2026."**, gumb **„Potvrdi na 06.07.2026."**
5. Vrati se na **Activities**.
   - **Očekivano:** `To` je i dalje `06.07.2026.`, Period je i dalje `Custom`.
   - **Pad (stari bug):** vratilo se na „All time" i pun raspon podataka.
6. Ponovi 3↔5 još dvaput — mora ostati stabilno.

⚠ Na tabu **Structure** filtra datuma **nema** i tako treba biti.
⚠ Na Overviewu je `From` **dekorativan** — pločica ga namjerno ignorira (saldo nema početak),
ali se prenosi u drill. To nije pad.

---

## T-S111-2 ⭐ Ispravak sidra je novi redak, ne izmjena

**Zašto:** `036` namjerno nema UPDATE policy — potvrđeno stanje je zapis, a zapis koji se može
naknadno doraditi prestaje biti dokaz (§2.18).

1. Overview, **To = 02.01.2025.**
2. Pločica, redak `Sašin tekući RF` → mora pisati **„od potvrde 02.01.2025. · 3.458,03 € ·
   0 promjena poslije"**, iznos **3.458,03 €**.
   - „0 promjena poslije" je točno: `asOf` i `confirmed_on` su isti dan, pravilo je *strogo nakon*.
3. U polje „u banci na 02.01.2025." upiši `3458,03` → čip mora biti **✓ slaže se**.
4. Upiši `3453,03` → čip **Δ −5,00 €**.
5. U Supabase Table Editoru: `balance_anchors` mora imati **dva** retka za
   `Sašin tekući RF` / `2025-01-02` (3.453,03 i 3.458,03), različitih `created_at`.
   - **Pad:** samo jedan redak ⇒ negdje se dogodio UPDATE.

---

## T-S111-3 ⭐ RF lanac se zatvara na ispisano bankovno stanje

**Ovo je glavni rezultat sesije.** Provjerava se protiv `RF_2026-06.pdf`, koji se zatvara
**06.07.2026. na 461,82 €**.

1. Overview, **To = 06.07.2026.**
2. `Sašin tekući RF` → **461,82 €**, podnaslov „od potvrde 02.01.2025. · 3.458,03 € ·
   **196** promjena poslije".
3. Broj promjena `196` mora biti **jednak broju transakcija na RF izvodima** u istom prozoru.
   Kontrola: `Financije\run.bat fix_rf_ostatak.py` (dry-run, ništa ne piše) ispisuje saldo.
4. Upiši `461,82` u „u banci" → **✓ slaže se**.

**Pad i što znači:**

| Vidiš | Znači |
| --- | --- |
| `395,82` | `037` nije ponovno pušten — `Cash` je još u filtru |
| `441,80` | `fix_rf_ostatak.py --apply` nije pokrenut |
| `375,80` | ni jedno ni drugo |
| `456,82` | važeće sidro je ono krivo (3.453,03) — provjeri `created_at` |

---

## T-S111-4 ⭐ `Cash` više ne miče bankovni saldo, ali ostaje vidljiv

**Zašto:** podizanje gotovine (`Transfer | cash - bankomat`, `Izvor = Racun`) **već** je
oduzelo novac s računa; gotovinski trošak (`Izvor = Cash`) isti novac broji drugi put.

Podaci: `Sašin tekući RF`, 18.05.2026. `−150,00` (podizanje) i 20.05.2026. `−66,00`
(`Izvor = Cash`, „Promjena guma", `auto C5 | popravci`).

1. Overview, **To = 06.07.2026.** → `461,82 €` (test 3).
2. Activities, filtar na `Financije_all > Transakcija`, nađi zapis „Promjena guma"
   (20.05.2026.).
   - **Očekivano:** zapis **postoji**, `Izvor = Cash`, iznos 66,00. **Nije obrisan.**
3. Excel Export s tim rasponom → redak „Promjena guma" je u fileu, s `Tip = auto C5`.
   - **Očekivano:** trošak je i dalje dostupan analizi; samo ne ulazi u bankovni saldo.
4. (opcionalno, SQL) Provjeri config:
   ```sql
   SELECT settings->'dashboard'->'widgets'->0->'filters' FROM areas
   WHERE slug = 'financije-all';
   ```
   `izvorplacanja` mora imati **samo** `["Racun"]`.

---

## T-S111-5 ⭐ `038` — datum zadnjeg zapisa po računu

**Zašto:** bez toga pločica na „na dan 18.08.2026." prikazuje broj čiji je najnoviji zapis od
10.07.2026. — 39 dana star, a izgleda kao današnji.

1. Overview, **Clear all** na filtru (ili `To` = danas).
2. Zaglavlje pločice **nema** redak „na dan …" — gleda se sadašnjost, nema što reći.
3. Svaki račun mora imati **drugi redak podnaslova**:
   - `Kokin tekući ZABA` → `zadnji zapis 08.07.2026. · prije N dana`
   - `Sašin tekući RF` → `zadnji zapis 10.07.2026. · prije N dana`
4. Kad je razmak **> 7 dana**, tekst je **amber** (`THEME.overview.asOfNote`); ispod toga siv.
5. Postavi **To = 06.07.2026.** → RF mora pokazati `zadnji zapis 06.07.2026.` **bez** „prije N
   dana" (razmak je 0 — pitanje i podatak se poklapaju, ništa nije ustajalo).
6. **Rubni slučaj:** postavi **To = 02.01.2025.** → RF ima sidro i 0 promjena poslije ⇒
   `zadnji zapis: nema poslije potvrde`.

7. **⚠ Budući `dateTo` (regresija S111).** Period = **All Time** (razriješi se na
   `30.04.2027.` zbog budućih rata).
   - Zaglavlje **NE smije** pisati „na dan 30.04.2027." — ne smije pisati ništa.
   - Gumb mora glasiti **„Potvrdi"**, nikad „Potvrdi na 30.04.2027.".
   - `zadnji zapis … · prije N dana` mora brojati **od danas** (ZABA ~41, RF ~39 dana),
     ne ~296.
   - **„planirano" se NE smije smanjiti** — ostaje `−2.521,38 € (13)`. Ako padne, stegnut je
     i `split`, a on se ne smije stezati: rata datirana u 2027. je upravo ono što taj broj broji.

⚠ **Ako `038` nije pušten,** taj se redak **ne smije pojaviti uopće** (ni s tekstom „nema
poslije potvrde"). Tvrdnja „nema ničega" kad ih ima 196 bila bi neistina, a ne izostanak —
zato je uvjet `row.last_on || row.n === 0`, a ne samo `last_on`.

---

## T-S111-6 Skripte (programski, bez UI)

| Što | Kako | Očekivano |
| --- | --- | --- |
| `fix_rf_duplikati.py` idempotentan | pokreni **dry-run** ponovo nakon `--apply` | `PLAN (0 od 9)`, svih 9 **BLOKIRANO** („0 pogodaka") — ništa se ne nudi dvaput |
| `fix_rf_ostatak.py` idempotentan | isto | `BRISANJE (0/4)`, `MICANJE (0/1)` |
| backup postoji | `data-prep_data/Financije/_arhiva/` | `rf_duplikati_obrisano_*.json` + `rf_ostatak_*.json`, svaki s punim `event` + `attributes` |
| zaštita blizanca radi | u `SPEC`u privremeno promijeni iznos blizanca | redak mora završiti u **BLOKIRANO**, ne u planu |

---

## Otvoreno iz ranijih sesija (nepromijenjeno)

T-S110-4, -5 · T-S108-4 koraci 4–5, T-S108-1b, T-S108-5…13 · T-S107v-2…4, -7 · T-S107u-2.

**Zatvoreno ovom sesijom:** `T-S107d-6` (kvaliteta RF OCR lanca) — izvodi reproduciraju
ispisano stanje **u cent** kroz 18 mjeseci i 196 transakcija.
