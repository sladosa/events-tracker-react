# Data Integration Design Notes

## Kontekst

Aplikacija je dizajnirana za "elastičan" sistem organizacije podataka — struktura
se može mijenjati kroz Add Between, Add Above, Collapse Level. No spajanje dva
postojeća lanca s eventima zahtijeva poseban pristup.

---

## Merge Chain Workflow (trenutno moguće bez novih featurea)

### Excel Roundtrip + Delete Backup

Za spajanje Chain B → Chain A kad oba imaju evente:

1. **Export** — preuzmi .xlsx (oba lanca vidljiva po Category_Path)
2. **Fix u Excelu** — promijeni Category_Path Chain B redova na Chain A putanju
   - Uvjet: atributi moraju imati iste slugove (ili dodaj kolone koje odgovaraju
     target chain attr definicijama)
3. **Import** — eventi se kreiraju/update-aju pod Chain A
4. **Download Backup & Delete** stari lanac → cascade briše sve stare evente
   + preuzima .xlsx backup kao safety net
5. Chain B kategorija obrisana, svi podaci sada pod Chain A ✓

**Ključna napomena:** "Download Backup & Delete" (S27) je bio ključan missing piece
koji čini ovaj workflow čistim. Bez njega stari lanac bi ostao s eventima i
Structure > Delete bi bio blokiran.

### Ograničenja

- **Attribute slug mismatch**: ako Chain B ima drugačije slugove od Chain A,
  vrijednosti se importaju pod krivim kolonama. Rješenje: pri dizajnu Chain A
  koristiti iste slugove kao Chain B (ili preimenovati u Edit panelu prije merge-a).
- **Temporalni overlap**: ako isti session_start postoji u oba lanca, collision
  handling pita što napraviti — može biti zamorno za velik broj sesija.

---

## Garmin Integration + Historijska Migracija (budući projekt)

### Problem

- ~15 godina ručnog Excel unosa (jednostavniji atributi: trajanje, serije, težina)
- Garmin .fit datoteke (bogatiji atributi: HR, pace, GPS, cadence, elevation)
- Cilj: jedan unificiran lanac s podacima iz oba izvora
- Moguće greške: ručni unosi netočni, Garmin sat nije isključen na vrijeme (outlier)

### Dva odvojena potpitanja

**1. Schema merge (atributi)**

Dva izvora imaju drugačije slugove i mjerne jedinice. Treba mapping:

```
Excel slug       → Target slug     | Transformacija
trajanje_min     → duration_s      | × 60
tezina_kg        → weight_kg       | 1:1
serije           → sets            | 1:1
—                → avg_hr          | samo Garmin
—                → distance_m      | samo Garmin
```

**2. Event merge (conflict resolution)**

Kad oba izvora imaju zapis za istu sesiju, strategija po atributu:
- `fill_gaps` — svaki izvor popunjava što drugi nema (extends P3 pravilo)
- `prefer_garmin` — Garmin pobjeđuje ako postoji
- `prefer_manual` — ručni zapis pobjeđuje

### Predložena arhitektura (za implementaciju kad dođe na red)

**Korak 1: Garmin adapter** (odvojen od merge logike)
- Input: `.fit` datoteke ili Garmin Connect CSV export
- Output: standardni app Excel format (isti columns kao Activities sheet)
- Uključuje data cleaning: filter outlier sesija (trajanje > 4h, HR > 220, itd.)

**Korak 2: Enhanced "Merge Import" mod**
- Dodatan sheet `MergeConfig` u .xlsx:
  ```
  source_path  | target_path          | attr_mapping              | conflict
  Trening > Trk | Fitness > Cardio > Trk | trajanje_min→duration_s×60 | fill_gaps
  ```
- Import engine čita MergeConfig, primjenjuje mapping i conflict strategiju
- Koristi isti collision detection koji već postoji

**Korak 3: QA pass**
- Pregledaj sessions gdje su oba izvora imala podatke
- Manualni review outliera (Garmin sesije > X sati, netipične vrijednosti)

### Redoslijed implementacije

1. Historijska migracija (Excel 15 godina) — može ići BEZ Garmin adaptera
2. Garmin adapter — kad/ako Garmin integracija postane prioritet
3. Enhanced Merge Import — samo ako se pokaže potreba kod migracije

### Bilješka o Excel roundtrip + Delete za ovaj scenarij

Za finalno spajanje Excel historijskog lanca i Garmin lanca u jedan:
- Workflow je isti kao gore (Excel Roundtrip + Delete Backup)
- Garmin adapter samo osigurava da Garmin podaci budu u ispravnom Excel formatu
- Attribute mapping je ključan korak koji treba pažljivo pripremiti
