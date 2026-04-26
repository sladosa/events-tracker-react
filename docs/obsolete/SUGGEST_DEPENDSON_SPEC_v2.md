# Suggest & DependsOn Editing — Spec v2.0

**Datum:** 2026-03-30
**Prethodna verzija:** v1.0 (specifikacija za S29, nije bila ažurirana za S30/S31)
**Status:** Implementirano — S29, S30, S31 sve završene i verificirane

---

## Kontekst i motivacija

Dva povezana problema riješena kroz S29–S31:

1. **"Other" u Add/Edit Activity nije persistirao u DB** — race condition pri Finish;
   riješeno queue mehanizmom koji piše tek na Save/Finish.

2. **DependsOn atributi su bili read-only u Structure Edit** — nije postojao UI za
   kreiranje/editiranje `depends_on` mapa. Sada je potpuno editabilno.

Dodatno implementirano u S30:
- **Ancestor atributi u depends_on dropdownu** — nije samo "isti node", nego svi
  atributi na svim roditeljskim razinama (Area → parent Category → ...).
- **Delete zaštita za referenced atribute** — upozorenje ako se briše atribut koji
  je `depends_on` izvor za neki drugi atribut.

---

## Data model (V3 JSON format u `validation_rules`)

### Plain suggest
```json
{
  "type": "suggest",
  "suggest": ["opcija1", "opcija2", "opcija3"],
  "allow_other": true
}
```

### Suggest s DependsOn
```json
{
  "type": "suggest",
  "suggest": [],
  "allow_other": true,
  "depends_on": {
    "attribute_slug": "Strength_type",
    "options_map": {
      "*":      [],
      "Upp":    ["pull.m", "biceps", "triceps", "rame", "z.sklek"],
      "Low":    ["squat-bw", "squat-bulg", "iskoraci", "squat.m"],
      "Core":   ["leg.raises", "plank", "side.pl", "bird-dog"],
      "wormup": ["erg", "indian clubs", "istezanje", "orb", "traka"]
    }
  }
}
```

**Pravila:**
- `suggest` array = default opcije kad parent vrijednost nije u `options_map`. Može biti prazan.
- `options_map["*"]` = wildcard — opcije za "bilo koja vrijednost". Obično prazan array.
- `allow_other: true` uvijek postavljeno za suggest atribute.
- Parent atribut u `attribute_slug` može biti na istoj ili roditeljskoj razini kategorije.

**Parser:** `parseValidationRules()` u `useAttributeDefinitions.ts` — ne mijenjati format.

---

## Sekcija A: "Other" persist mehanizam

### Princip (implementirano S29, prošireno S31)

`AttributeInput` **ne piše direktno u DB** kad korisnik odabere "Other". Umjesto toga,
poziva callback `onNewOption` koji dodaje u React state queue u parent page komponenti.
DB write se događa tek na Finish/Save.

### Relevantni fajlovi

| Fajl | Uloga |
|------|-------|
| `src/components/activity/AttributeInput.tsx` | `onNewOption` prop, `handleOtherConfirm` poziva callback umjesto DB write |
| `src/components/activity/AttributeChainForm.tsx` | Proslijeđuje `onNewOption` prop do `AttributeInput` |
| `src/pages/AddActivityPage.tsx` | `pendingOptionAdds` state, `handleNewOption`, `persistPendingOptions` |
| `src/pages/EditActivityPage.tsx` | Isti mehanizam, dodan S31 |

### Tok podataka

```
Korisnik odabere "Other" → upiše vrijednost → klikne OK
  └─ AttributeInput.handleOtherConfirm()
       ├─ handleChange(trimmed)           → ažurira React state (prikazuje vrijednost)
       ├─ setShowOtherInput(false)        → vraća dropdown
       └─ onNewOption(defId, trimmed, depVal)  → ide u parent

AddActivityPage / EditActivityPage
  └─ handleNewOption()
       └─ setPendingOptionAdds(prev => [...prev, { definitionId, newOption, dependencyValue }])

Na Finish/Save:
  └─ persistPendingOptions(pendingOptionAdds, allDefs)
       └─ Za svaki pending:
            ├─ Čita def.validation_rules
            ├─ Ako dependencyValue + parsed.dependsOn → dodaje u options_map[depVal]
            └─ Inače → dodaje u suggest[] array
            └─ supabase.update({ validation_rules: updatedRules })
```

### `latestRules` Map (S29b bugfix)

`persistPendingOptions` drži `Map<definitionId, latestRules>` kako bi svaki iteracija
koristila svježe stanje (ne staro iz DB). Bez toga, višestruki Other u jednoj sesiji
za isti atribut rezultira gubitkom svih osim zadnjeg.

### Kada se čisti queue

- `pendingOptionAdds` se **ne čisti na Save+** (Leaf event + nastavi) — korisnik može
  dodati još Other opcija u sljedećim aktivnostima.
- Čisti se tek na **Finish** (End Session) ili **Save** (Edit Activity) nakon uspješnog
  DB write.

---

## Sekcija B: DependsOn editing u Structure Edit

### B1. Prikaz u View panelu (CategoryDetailPanel)

**Implementirano S29.** DependsOn atributi prikazuju tablicu mapiranja:

```
DEPENDS ON: Strength_type

WhenValue    Options
────────────────────────────────────
*            (any / no filter)
Upp          pull.m, biceps, triceps, rame, z.sklek
Low          squat-bw, squat-bulg, iskoraci, squat.m
Core         leg.raises, plank, side.pl, bird-dog
wormup       erg, indian clubs, istezanje, orb, traka
```

Fajl: `src/components/structure/CategoryDetailPanel.tsx`

### B2. Edit DependsOn u StructureNodeEditPanel

**Implementirano S29.** Svaki suggest atribut u Edit panelu može imati WhenValue/Options tablicu.

#### AttrEditState polja za DependsOn

```typescript
interface AttrEditState {
  // ... ostatak polja ...
  validationType: 'none' | 'suggest' | 'depends_on';
  suggestOptions: string;       // plain suggest opcije (jedan red = jedna opcija)
  dependsOnSlug: string;        // slug parent atributa (npr. "Strength_type")
  dependsOnMap: DependsOnRow[]; // redovi mapiranja
}

interface DependsOnRow {
  whenValue: string;   // ključ u options_map (npr. "Upp", "*")
  options: string;     // newline-odvojene opcije
}
```

#### Inicijalizacija iz validation_rules

```typescript
if (parsed.dependsOn) {
  validationType = 'depends_on';
  dependsOnSlug = parsed.dependsOn.attributeSlug;
  dependsOnMap = Object.entries(parsed.dependsOn.optionsMap).map(([when, opts]) => ({
    whenValue: when,
    options: opts.join('\n'),
  }));
  suggestOptions = parsed.options.join('\n');
}
```

#### Parent atribut dropdown — S30 proširenje

**Ovo je ključna razlika od v1 specifikacije.** Dropdown više nije ograničen na atribute
iste kategorije — uključuje sve ancestor razine.

**Struktura dropdowna:**

```
— (remove dependency) —           ← prazan string, uklanja depends_on
⚠ orphan_slug (not found)         ← prikazuje se samo ako trenutni slug nije nigdje pronađen
┌ optgroup: Same level ────────────
│  attr_name (attr_slug)
│  ...
└────────────────────────────────
┌ optgroup: ↑ ParentCategoryName ─
│  parent_attr_name (parent_slug)
└────────────────────────────────
┌ optgroup: ↑ GrandparentName ────
│  ...
└────────────────────────────────
┌ optgroup: ↑ AreaName ───────────
│  ...
└────────────────────────────────
```

**Filtriranje:**
- Same level: `dataType === 'text'` ili `validationType === 'suggest'`, ne sebe samog
- Ancestor level: samo `data_type === 'text'` (filtrira se na `data_type`, ne `dataType`)
- Prazna grupa (nema atributa) → ne prikazuje optgroup

**Orphan fallback:**
Ako `attr.dependsOnSlug` nije pronađen ni u same-level ni u ancestorAttrs, prikazuje se:
```
⚠ existing_slug (not found)
```
Korisnik može odabrati drugi slug ili ukloniti dependency.

#### buildAncestorAttrs() helper

```typescript
function buildAncestorAttrs(
  node: StructureNode,
  allNodes: StructureNode[],
): { levelName: string; attrs: AttributeDefinition[] }[]
```

Hoda `node.parentCategoryId` chain prema gore, za svaki ancestor dohvaća
`node.attributeDefinitions` iz `allNodes`. Rezultat: array `{ levelName, attrs }`
od neposrednog roditelja do Area razine.

**Prop chain:**
`StructureTableView` → `StructureNodeEditPanel` via `allNodes: StructureNode[]` prop.
`buildAncestorAttrs` poziva se s `useMemo` na vrhu panel komponente.

#### Validacija empty slug (S31)

Pri Save, panel provjerava ima li atributa s `validationType === 'depends_on'`
i praznim `dependsOnSlug`:

```typescript
const emptySlugAttrs = attrStates.filter(
  a => a.validationType === 'depends_on' && !a.dependsOnSlug.trim()
);
if (emptySlugAttrs.length > 0) {
  toast.error(`depends_on parent slug is empty for: ${names}. ...`);
  return; // blokira Save
}
```

Bez ove validacije, u DB bi se snimio `attribute_slug: ""` što bi slomilo dependency
u Add/Edit Activity.

#### buildNewRules za DependsOn

```typescript
if (state.validationType === 'depends_on') {
  const defaultOpts = state.suggestOptions
    .split('\n').map(s => s.trim()).filter(Boolean);

  const optionsMap: Record<string, string[]> = {};
  for (const row of state.dependsOnMap) {
    if (!row.whenValue.trim()) continue;
    optionsMap[row.whenValue.trim()] = row.options
      .split('\n').map(s => s.trim()).filter(Boolean);
  }

  return {
    type: 'suggest',
    suggest: defaultOpts,
    allow_other: true,
    depends_on: {
      attribute_slug: state.dependsOnSlug,
      options_map: optionsMap,
    },
  };
}
```

### B3. "+ Add Dependency" konverzija (S29)

Na suggest atributu bez DependsOn: gumb **"+ Add Dependency"** koji postavlja
`validationType = 'depends_on'` i otvara UI s jednim praznim WhenValue redom.

---

## Sekcija C: Delete zaštita za referenced atribute (S30)

Kada korisnik klikne delete na nekom atributu, panel **client-side** prolazi kroz sve
nodeove u `allNodes` i sve njihove attribute definitions tražeći:

```typescript
if (parsed.dependsOn?.attributeSlug === attr.slug) {
  refs.push({ nodePath: n.fullPath, attrName: ad.name });
}
```

Ako je `refs.length > 0`, prikazuje se amber warning panel u delete confirmation UI:

```
⚠ 2 attributes use this as a depends-on source:
  • Fitness / Strength / exercise_name
  • Fitness / Cardio / drill_name

Those attributes will fall back to default options. You can restore
them by adding a new attribute with slug "Strength_type" on any
ancestor level.
```

**Brisanje nije blokirano** — korisnik može nastaviti i s brisanjem (samo je informiran).
Warning se prikazuje uz eventualni red-warning o postojećim event_attributes vrijednostima.

`DeleteState` tip:
```typescript
interface DeleteState {
  attrId:        string;
  attrName:      string;
  attrSlug:      string;
  checking:      boolean;
  eventCount:    number | null;
  dependsOnRefs: { nodePath: string; attrName: string }[];
  deleting:      boolean;
}
```

---

## Kompletna mapa fajlova

| Fajl | Što radi |
|------|----------|
| `src/components/activity/AttributeInput.tsx` | `onNewOption` prop; `handleOtherConfirm` poziva callback, ne DB |
| `src/components/activity/AttributeChainForm.tsx` | Prosljeđuje `onNewOption` do `AttributeInput` |
| `src/pages/AddActivityPage.tsx` | `pendingOptionAdds`, `handleNewOption`, `persistPendingOptions` |
| `src/pages/EditActivityPage.tsx` | Isti mehanizam dodan S31 |
| `src/components/structure/StructureNodeEditPanel.tsx` | DependsOn edit UI, `buildAncestorAttrs()`, orphan fallback, empty-slug validacija, delete refs check |
| `src/components/structure/StructureTableView.tsx` | Prosljeđuje `allNodes` prop u `StructureNodeEditPanel` i `CategoryDetailPanel` |
| `src/components/structure/CategoryDetailPanel.tsx` | DependsOn view tablica (read-only) |
| `src/hooks/useAttributeDefinitions.ts` | `parseValidationRules()` — ne mijenjati |

---

## Ključne napomene

- **Nikad ne mijenjati `parseValidationRules()`** — parser je stabilan za V3 i legacy format
- **`buildNewRules()` uvijek piše V3 format** — `type: 'suggest'`, `suggest: []`, `depends_on: {...}`
- **`allow_other: true`** uvijek postavljeno za suggest atribute
- **Slug parent atributa** se ne mijenja pri rename — koristiti slug, ne name
- **`*` ključ** u options_map je wildcard — matches sve vrijednosti koje nisu eksplicitno navedene
- **Prazan `suggest` array** je OK — znači sve opcije su u `options_map`
- **`crypto.randomUUID()`** za `id` pri INSERT novih attribute_definitions (nema DB default)
- **`data_type`** (snake_case) koristiti za ancestor attrs filter (raw DB polje);
  **`dataType`** (camelCase) za same-level filter (parsed field iz `useAttributeDefinitions`)
- **`dependsOnSlug` mora biti neprazan** pri Save — validacija blokira Save s toast errorm

---

## Testni scenariji (sve verificirano)

| ID | Sesija | Scenarij | Status |
|----|--------|----------|--------|
| T-S29-1 | S29 | Add Activity: Other → Save+ → Finish → vidi u Structure Edit suggest opcijama | ✅ |
| T-S29-2 | S29 | Add Activity: Other u DependsOn (Strength_type=Upp) → Finish → opcija u options_map["Upp"] | ✅ |
| T-S29-3 | S29 | Add Activity: Other → Finish odmah (bez Save+) → opcija persists | ✅ |
| T-S29b-1 | S29b | Add Activity: Other → 'A' + Other → 'B' za isti atribut → Finish → OBA vidljiva | ✅ |
| T-S29-4 | S29 | Structure Edit: DependsOn atribut prikazuje WhenValue/Options tablicu | ✅ |
| T-S29-5 | S29 | Structure Edit: Editirati opcije za WhenValue → Save → ispravno u Add Activity | ✅ |
| T-S29-6 | S29 | Structure Edit: Dodati novi WhenValue red → Save → radi u Add Activity | ✅ |
| T-S29-7 | S29 | Structure Edit: Obrisati WhenValue red → Save → nestaje iz Add Activity | ✅ |
| T-S29-8 | S29 | Structure Edit: Promijeniti parent atribut → Save → DB ažuriran | ✅ |
| T-S29-9 | S29 | View panel: DependsOn atribut prikazuje tablicu mapiranja | ✅ |
| T-S30-1 | S30 | Depends-on dropdown: ancestor atributi prikazani u optgroup "↑ LevelName" | ✅ |
| T-S30-2 | S30 | Depends-on dropdown: odaberi ancestor atribut → Save → radi u Add Activity | ✅ |
| T-S30-3 | S30 | Depends-on dropdown: orphan slug (attr obrisan) → prikazan "⚠ slug (not found)" | ✅ |
| T-S30-4 | S30 | Delete attr koji je depends_on referenca → amber warning s listom referenci i slug info | ✅ |
| T-S30-5 | S30 | Delete attr koji NIJE referenca → nema amber warning | ✅ |
| T-S31-2 | S31 | Edit Activity: Other → nova vrijednost → Save → vidljiva u Structure Edit | ✅ |
| T-S31-3 | S31 | Edit Activity: Other s depends_on → Save → dodan u options_map | ✅ |
| T-S31-4 | S31 | DependsOn empty slug → Save blokiran s toast porukom | ✅ |
| T-S31-5 | S31 | DependsOn s ispravnim slugom → Save prolazi bez lažnog errora | ✅ |
