# Import Diff Spec — "skipped" vs "updated"

**Datum:** 2026-03-27
**Prioritet:** 1 (S28)
**Status:** ✅ Implementirano — S28 (diff check), S29 (timezone bugfix verificiran)

---

## Problem

Trenutno kad se importa xlsx (npr. full backup), svaki event koji ima ID u koloni A
ide UPDATE path i broji se kao **"updated"** — čak i kad su sve vrijednosti identične.

Rezultat: import backup fajla pokazuje "37 updated, 4 created" što zbunjuje korisnika
koji nije ništa promijenio.

---

## Željeno ponašanje

| Situacija | Trenutno | Željeno |
|-----------|----------|---------|
| Event postoji, iste vrijednosti | updated | **skipped** |
| Event postoji, neka vrijednost drugačija | updated | **updated** |
| Event ne postoji (nema ID ili ID nije u DB) | created | created |
| Event ID postoji ali ne pripada korisniku | error | error (nepromijenjen) |

---

## Što treba usporediti (diff)

### Core fields (na `events` tablici)
- `event_date`
- `session_start` — pažnja: DB format `+00:00`, import format `.000Z`, normalizirati prije usporedbe
- `comment` — null vs `""` tretirati kao identično

### Atributi (na `event_attributes`)
- Za svaki atribut koji postoji u xlsx: usporediti `value_text / value_number / value_datetime / value_boolean`
- Ako xlsx vrijednost je prazna: P3 rule — ne diramo, ali ne broji ni kao "updated"

---

## Implementacija

### Što treba promijeniti

1. **`excelImport.ts` — UPDATE path fetch query**

   Trenutni select:
   ```typescript
   .select('id, category_id, event_attributes(id, attribute_definition_id)')
   ```
   Proširiti na:
   ```typescript
   .select('id, category_id, event_date, session_start, comment, event_attributes(id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean)')
   ```

2. **Diff helper funkcija**

   ```typescript
   function hasChanges(existing: ExistingEvent, row: ParsedImportRow, attrDefs: ...): boolean
   ```
   - Uspoređuje core fields + atribute
   - Normalizira session_start format (+00:00 vs .000Z)
   - null i "" su ekvivalentni za `comment`

3. **Brojači**

   Dodati `skipped` brojač uz `created` i `updated`.

4. **UI prikaz (ExcelImportModal)**

   Ako `skipped > 0`, prikazati treći box: **"N Events unchanged"** (siva boja).

---

## Rubni slučajevi

- **P3**: ako xlsx vrijednost je prazna, a DB ima vrijednost → ne diraj (P3), ne broji kao updated
- **session_start normalizacija**: `2026-01-15T09:00:00+00:00` == `2026-01-15T09:00:00.000Z`
- **Djelomična promjena**: ako je samo jedan atribut drugačiji → cijeli event = "updated"
- **Parent eventi**: parent eventi se upsertaju po sesiji — ne broje se u "updated"

---

## Testni scenariji (S28)

| ID | Scenarij | Očekivano |
|----|---------|-----------|
| T-IMP-1 | Import isti xlsx dvaput | 2. import: 0 created, 0 updated, N skipped |
| T-IMP-2 | Import xlsx s jednom promijenjenom vrijednošću | 1 updated, N-1 skipped |
| T-IMP-3 | Import xlsx s praznom vrijednošću gdje DB ima vrijednost | P3: 0 updated (skipped) |
| T-IMP-4 | Import backup fajla odmah nakon exporta | sve skipped, 0 updated |
