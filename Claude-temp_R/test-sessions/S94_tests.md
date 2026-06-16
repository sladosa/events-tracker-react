# S94 Test Session — Rata modal bugfixes + Export attrFilter + PROD deploy

**Datum:** 2026-06-16
**Branch:** test-branch → main (PROD deploy)

---

## T-S94-1: Rata modal na PROD (happy path)

**Preduvjet:** PROD baza ima `025_prod_rata_config.sql` pokrenut + slug fix pokrenut (trigger_slug="rate")

**Koraci:**
1. Otvori app na Netlify (PROD), ulogiraj se
2. Odaberi Area: Financije (ili Financije_3 ako postoji)
3. Odaberi kategoriju: Transakcija (leaf)
4. Klikni "Add Activity"
5. Popuni: Rate?=Da, Broj rata=3, Iznos=300, Izvor=Visa, Status=Izvrsen
6. Klikni "Finish"

**Očekivano:**
- Pojavljuje se RataModal s naslovom "Plaćanje na rate"
- Prikazuju se 3 rate po 100 EUR
- Datumi: 3. sljedeća 3 mjeseca (Visa = dan 3)
- Svaki red prikazuje rate iznos i datum

**Fail:** Modal se ne pojavi, ili prikazuje krive iznose/datume

---

## T-S94-2: Kreiraj rate — originalni event se briše

**Preduvjet:** T-S94-1 prošao, modal je otvoren

**Koraci:**
1. U rata modalu klikni "Kreiraj 3 rata"
2. Provjeri Activities tablicu (možda treba reload)
3. Filteraj Status=Planiran

**Očekivano:**
- Toast "Kreirano 3 rata"
- Originalni event (Iznos=300) **ne pojavljuje se** u tablici
- 3 nova rata eventa s Status=Planiran
- Komentar format: "rata 1/3 · 100 od 300", "rata 2/3 · 100 od 300", "rata 3/3 · 100 od 300"

**Fail:** Originalni event ostaje u tablici, ili rata eventi nemaju komentar/Status

---

## T-S94-3: Preskoči — originalni event ostaje s resetiranim atributima

**Preduvjet:** Ponovi T-S94-1 s novim eventom (Rate?=Da, Broj rata=2, Iznos=200)

**Koraci:**
1. U rata modalu klikni "Preskoči"
2. Nađi originalni event u tablici
3. Klikni View → provjeri Rate? i Broj rata

**Očekivano:**
- Modal se zatvori, success dialog se otvori
- Originalni event ostaje u tablici
- View Activity: Rate?=Ne (ili prazno), Broj rata=— (null)

**Fail:** Rate?=Da ostaje, Broj rata ostaje popunjen

---

## T-S94-4: Export poštuje attrFilter

**Preduvjet:** Postoji barem nekoliko Planiran eventa (rata eventi iz T-S94-2)

**Koraci:**
1. U filter baru odaberi Area: Financije
2. U attr dropdown odaberi "Status" → select → odaberi "Planiran"
3. Tablica prikazuje samo Planiran evente (npr. 3 rata eventa)
4. Klikni Export → Download
5. Otvori xlsx → Activities Events sheet

**Očekivano:**
- Xlsx sadrži **samo** Planiran evente (isti broj kao u tablici)
- Ostali eventi (Izvrsen) nisu u xlsx

**Fail:** Xlsx sadrži sve evente bez obzira na Status filter

---

## PROD SQL koraci (dokumentacija)

Sljedeći SQL-ovi su pokrenuti na PROD u S94:

1. `sql/025_prod_rata_config.sql` — rata config za Financije area(s)
2. Slug fix (inline, nije u fajlu):
   ```sql
   UPDATE attribute_definitions
   SET slug = regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'), '_+$', '')
   WHERE category_id IN (
     SELECT id FROM categories 
     WHERE area_id IN (SELECT id FROM areas WHERE name ILIKE 'Financije%')
   )
   AND (slug LIKE '%-%' OR slug IS NULL OR slug = '');
   ```
3. Trigger slug fix (inline):
   ```sql
   UPDATE areas 
   SET settings = jsonb_set(settings, '{automations,rata,trigger_slug}', '"rate"')
   WHERE name ILIKE 'Financije%';
   ```
