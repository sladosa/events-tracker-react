# S28 Test Session

**Datum:** 2026-03-28
**Branch:** test-branch

---

## P1 — Import diff (skipped vs updated)

### T-IMP-1: Import isti xlsx dvaput
1. Exportaj bilo koji skup evenata u xlsx
2. Importaj taj xlsx → zabilježi N created/updated
3. Importaj isti xlsx PONOVO
4. **Očekivano:** 0 created, 0 updated, N skipped — prikazan sivi box "Unchanged"

### T-IMP-2: Import s jednom promijenom
1. Exportaj xlsx s npr. 5 evenata
2. U xlsx promijeni jedan attr u jednom redu
3. Importaj
4. **Očekivano:** 0 created, 1 updated, 4 skipped

### T-IMP-3: P3 — prazna xlsx vrijednost gdje DB ima vrijednost
1. Exportaj xlsx — u jednom redu ima filled attr (npr. "reps" = 10)
2. U xlsx izbrisi vrijednost atributa (prazna ćelija)
3. Importaj
4. **Očekivano:** event se broji kao skipped (P3: prazna ne briše)

### T-IMP-4: Import backup odmah nakon exporta
1. Exportaj aktivnosti → dobij backup/export xlsx
2. Importaj taj isti fajl odmah
3. **Očekivano:** 0 created, 0 updated, N skipped

---

## P2 — Add/Delete Attribute u Structure Edit

### T-ATTR-1: Add text atribut na leaf bez atributa
1. Nađi leaf kategoriju bez atributa
2. Otvori Edit Mode → otvori Edit panel za tu kategoriju
3. Klikni "Add Attribute" → unesi Name, Type=text → klikni "Add"
4. Klikni "Save" u headeru
5. **Očekivano:** atribut vidljiv u View panelu i u Add Activity formi za tu kategoriju

### T-ATTR-2: Add number atribut s unit
1. U Edit panelu klikni "Add Attribute"
2. Name="Weight", Type=number, Unit="kg" → Add → Save
3. **Očekivano:** Add Activity prikazuje "Weight (kg)" labelu

### T-ATTR-3: Delete atribut bez evenata
1. Dodaj novi atribut (T-ATTR-1)
2. Klikni ikonu za Delete na tom atributu
3. **Očekivano:** direktni confirm (bez "N recorded values" warninga), klikni Delete → atribut nestaje

### T-ATTR-4: Delete atribut s eventima
1. Nađi atribut koji ima unesene vrijednosti (event_attributes > 0)
2. Klikni Delete ikonu
3. **Očekivano:** warning "This attribute has N recorded values. Deleting will permanently remove all recorded data."
4. Confirm → atribut obrisan + sve event_attributes vrijednosti obrisane

### T-ATTR-5: Text → Suggest konverzija
1. Na text atributu pojavljuje se gumb "→ Suggest"
2. Klikni "→ Suggest"
3. **Očekivano:** pojavljuje se textarea za unos opcija (jedna po liniji)
4. Unesi opcije → Save
5. **Očekivano:** u Add Activity za tu kategoriju prikazuje se dropdown/suggest input

### T-ATTR-6: Slug collision pri Add
1. Dodaj atribut Name="Test Attr"
2. Dodaj još jedan atribut Name="Test Attr" (bez Savea između)
3. **Očekivano:** drugi dobiva slug "test_attr_2"
4. Save → oba atributa uspješno kreirana

---

## Regresija

- Existing atributi (UPDATE path) i dalje rade normalno
- Delete node s eventima (T-S27-1 flow) i dalje radi
