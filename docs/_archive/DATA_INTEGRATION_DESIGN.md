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

### Konkretni plan: "Stage before merge" pristup

Umjesto direktnog spajanja, drži izvore odvojeno dok QA nije gotov:

```
Garmin .fit files  →  [Garmin adapter]  →  Area: Garmin_fitness
Excel trening.xlsm →  [Excel import]   →  Area: Excel_fitness

         ↓ QA + photo matching ↓

                Area: Fitness  (finalni lanac)
```

**Faza 1 — Import Garmin → Area: Garmin_fitness**
- Garmin je autoritativan za: `session_start`, `duration`, `avg_hr`, `distance`,
  `elevation`, `cadence`, GPS track
- Filter outliera: sesije > 4h, HR > 220, nemoguće vrijednosti → označiti za review
- Svaka sesija dobiva Garmin-specific atribute (bogat skup)

**Faza 2 — Import Excel → Area: Excel_fitness**
- Excel je autoritativan za: subjektivne bilješke, serije/ponavljanja/težine,
  korekcije koje Garmin ne zna (npr. "sat ostao uključen 30min extra")
- ~15 godina podataka, jednostavniji atributi

**Faza 3 — Cross-QA između dva Area-a**
- Usporedi coverage: koje datume ima Garmin ali ne Excel (novi treninzi)?
  Koje ima Excel ali ne Garmin (preGarmin era ili zaboravljeno isključiti)?
- Identificiraj sumnjive Garmin sesije (trajanje outlieri) → označi u Excel komentaru
- Ovaj korak je ručan ali s dvije odvojene Area-e je pregledan

**Faza 4 — Photo matching**
- App već podržava `image` tip atributa i `activity-attachments` storage bucket
- Workflow: skeniraj direktorije starih fotografija, match po datumu na sesiju,
  upload kao event attachment
- Nije potreban novi feature — ručni upload po sesiji via Edit Activity već radi
- Opcija za budućnost: batch upload helper koji čita EXIF datum iz .jpg i predlaže
  sesiju (osobito korisno za 15 godina materijala)

**Faza 5 — Finalni merge → Area: Fitness**
- Excel Roundtrip + Delete Backup za oba izvora
- Attr def naming: Garmin i Excel Area-e dobivaju iste display name-ove na
  finalnim atributima → import direktno mapira bez schema problema
- Redoslijed: prvo importaj Excel (baseline), pa Garmin s `fill_gaps` pristupom
  (Garmin popunjava precizne vrijednosti, ne overwritea ručne bilješke)

### Redoslijed implementacije

1. Historijska migracija (Excel 15 godina) — može ići BEZ Garmin adaptera
2. Garmin adapter — kad/ako Garmin integracija postane prioritet
3. Photo batch helper — opcija ako je volumen fotografija velik
4. Enhanced Merge Import — samo ako se pokaže potreba kod finalne faze

---

## Automatski dnevni sync (budući projekt)

### Vizija

Svaki dan automatski povuci Health metrike i Trening aktivnosti s Garmina
(direktno ili via Strava) → kreira evente u aplikaciji bez ručnog unosa.

### Arhitektura

```
Garmin device
    ↓ auto-sync
Garmin Connect  ──→  Garmin Health API (partner approval potreban)
    ↓ auto-sync
Strava  ──────────→  Strava API (javni, OAuth2, webhook podrška)  ← preporučeno
    ↓
Netlify scheduled function / webhook handler
    ↓
Supabase INSERT (events + event_attributes)
```

**Strava je preporučen ulazni punkt** jer:
- Javni API, bez partner approvala
- Garmin automatski syncira na Strava (korisnik samo jednom poveže)
- Webhook podrška: nova aktivnost → odmah okida Netlify funkciju
- Bogat skup podataka: tip, trajanje, distanca, avg/max HR, elevacija,
  pace, cadenca, snaga (bicikl), training load

**Garmin Health API** (sleep, HRV, stress, steps, SpO2) zahtijeva
Garmin partner program approval — alternativa je Google Fit/Apple Health
koji agregiraju iz Garmina i imaju pristupačnije API-je.

### Dva moda

**Real-time (webhook):** Strava webhook → Netlify function → INSERT
- Aktivnost završi na Garminu → Strava sync (~5 min) → app event (~1 min)
- Idealno za trening aktivnosti

**Daily batch (cron):** Netlify scheduled function svaki dan u ponoć
- Povuci sve aktivnosti i health metrike za prethodni dan
- Idempotentno (upsert, ne insert) — sigurno za ponovni run
- Za health metrike (sleep, HRV) koje se retroaktivno ažuriraju

### Veza s historijskom migracijom

Isti Garmin adapter koji se napravi za jednokratnu historijsku migraciju
(.fit → Excel format) postaje temelj za automatski sync — samo s drugačijim
inputom (Strava API response umjesto .fit datoteke), isti output format.

