# Add Attribute Spec — Structure Edit Mode

**Datum:** 2026-03-27
**Prioritet:** 2 (S28)
**Status:** ✅ Implementirano — S28 (Add/Delete Attribute, Text→Suggest konverzija), S29 (id fix, crypto.randomUUID)

---

## Kontekst

`StructureNodeEditPanel` trenutno može **editovati** postojeće atribute na nodu,
ali nema mogućnosti **dodavanja** novih atributa ni **brisanja** postojećih.

Slučaj koji je otkrio gap: korisnik kreira novi leaf "novi auto" bez atributa —
u Edit panelu vidi "(no attributes at this level)" ali nema gumb za dodavanje.

---

## Funkcionalnosti koje treba implementirati

### A. Add Attribute

Gumb **"+ Add Attribute"** na dnu `AttrEditSection` (vidljiv uvijek, ne samo kad ima atributa).

Klik otvara inline formu za novi atribut s poljima:

| Polje | Tip | Obavezno | Napomena |
|-------|-----|----------|---------|
| Name | text input | da | Slug se generira automatski (lowercase, underscores) |
| Type | select | da | `text`, `number`, `boolean`, `datetime` |
| Unit | text input | ne | Npr. "km", "kg" — samo za `number` tip |
| Required | checkbox | ne | Dodaje `required: true` u validation_rules |

Na Save: INSERT u `attribute_definitions` (`category_id`, `name`, `slug`, `data_type`, `unit`, `validation_rules`, `sort_order`).

**Slug generacija:**
```typescript
slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
```
Slug se ne mijenja pri rename (isto pravilo kao na kategorijama).

---

### B. Konverzija text → suggest/dropdown

Postojeći **text** atribut može se konvertirati u **suggest** tip (slobodan unos + dropdown prijedlozi).

Gumb **"→ Suggest"** vidljiv samo za atribute tipa `text` koji nemaju DependsOn.

Klik otvara sekciju za unos opcija (identično kao postojeći "Suggest Options" UI koji već radi).

Što se mijenja u DB: `validation_rules` dobiva `{ "suggest": ["opcija1", "opcija2", ...] }`.

**Napomena:** Konverzija suggest → text nije planirana (jednosmjerna).

---

### C. Sprezanje (binding) na vrijednost drugog atributa

Ovaj mehanizam već postoji u kodu (`DependsOn` u `validation_rules`), ali editing UI ne postoji — trenutno je read-only notice.

**Što korisnik želi:** Mogućnost da dropdown atribut filtrira svoje opcije na temelju vrijednosti drugog atributa na istoj razini.

Primjer: atribut "Model" (suggest) ovisi o "Marka" (suggest) — kad je Marka = "Ford", Model dropdown nudi samo Ford modele.

#### UI plan za DependsOn editing

Na atributu tipa `suggest`:
- Checkbox **"Filter options by another attribute"**
- Ako checked: dropdown za odabir parent atributa (samo `text` ili `suggest` atributi iste kategorije)
- Tablica za unos mapiranja: `parent_value → [lista child opcija]`

Ovo je **složenija** funkcionalnost — može biti odvojena pod-sesija.

---

### D. Delete Attribute

Gumb **"Delete"** (crveni) na svakom atributu u edit formi.

Ako atribut ima podataka u `event_attributes`:
- Prikazati warning: "This attribute has N recorded values. Deleting it will permanently remove all recorded data."
- Confirm → DELETE `event_attributes WHERE attribute_definition_id = X` → DELETE `attribute_definitions`

Ako nema podataka (novi atribut bez evenata):
- Direktno DELETE bez warninga.

---

## Redosljed implementacije (S28)

```
1. Add Attribute (inline forma, INSERT) — temelj
2. Delete Attribute (s warning ako ima event_attributes) — logički par
3. Text → Suggest konverzija — nadogradnja na add
4. DependsOn editing UI — složeno, možda odvojena sesija
```

---

## Što već postoji (ne diraj)

- **Suggest options editing** — unos i brisanje opcija na postojećim suggest atributima radi
- **DependsOn prikaz** — read-only notice vidljiv u Edit panelu
- **`parseValidationRules()`** u `useAttributeDefinitions.ts` — parser za validation_rules JSONB
- **Dodavanje sadržaja u dropdown i povezanim dropdownima** — već implementirano u Add/Edit Activity

---

## Testni scenariji (S28)

| ID | Scenarij | Očekivano |
|----|---------|-----------|
| T-ATTR-1 | Add text atribut na leaf bez atributa | Atribut vidljiv u View panelu i Add Activity |
| T-ATTR-2 | Add number atribut s unit "km" | Unit prikazan u Add Activity formi |
| T-ATTR-3 | Delete atribut bez evenata | Direktno briše, bez warninga |
| T-ATTR-4 | Delete atribut s eventima | Warning s brojem zapisa, confirm → briše |
| T-ATTR-5 | Konverzija text → suggest | Dropdown opcije vidljive u Add Activity |
| T-ATTR-6 | Slug collision pri Add | Dodati suffix `_2`, `_3` automatski |
