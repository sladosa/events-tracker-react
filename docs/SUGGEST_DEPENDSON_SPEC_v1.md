# Suggest & DependsOn Editing — Spec v1.0

**Datum:** 2026-03-29
**Prioritet:** S29
**Status:** Specifikacija — nije implementirano

---

## Kontekst i motivacija

Postoje dva povezana problema:

1. **"Other" u Add Activity ne persists u DB** — korisnik može u dropdown suggest polju
   odabrati "Other...", upisati novu vrijednost, ali ta vrijednost se ne sprema u
   `attribute_definitions.validation_rules`. Race condition: korisnik klikne Finish
   prije nego async DB write završi. Rješenje: odgoditi DB write do Save+/Finish.

2. **DependsOn atributi su read-only u Structure Edit** — atributi s `depends_on`
   mehanizmom (npr. `exercise_name` ovisi o `Strength_type`) mogu se definirati samo
   kroz Excel Import. UI za kreiranje/editiranje tih veza ne postoji.

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
- `suggest` (gornji array) = default opcije kad nema DependsOn ili kad parent vrijednost
  nije u `options_map`. Može biti prazan.
- `options_map["*"]` = opcije za "bilo koja vrijednost" (wildcard). Obično prazan array.
- Ključevi u `options_map` odgovaraju mogućim vrijednostima parent atributa.
- `allow_other: true` znači korisnik može upisati vlastitu vrijednost.

**Parser:** `parseValidationRules()` u `useAttributeDefinitions.ts` — ne mijenjati format,
parser razumije ovaj V3 format i legacy `dropdown` format.

---

## Sekcija A: Fix "Other" persist mehanizma

### Problem (trenutno)

U `AttributeInput.handleOtherConfirm()`:
1. `handleChange(trimmed)` — ažurira React state ✓
2. `setShowOtherInput(false)` — vraća dropdown ✓
3. **async** `supabase.update(validation_rules)` — može propasti bez user feedbacka
4. Ako user klikne Finish/navigira dalje: race condition, write možda ne završi

### Rješenje: Queue + persist na Save+/Finish

#### Promjene u `AttributeInput.tsx`

Dodati novu prop:
```typescript
onNewOption?: (definitionId: string, newOption: string, dependencyValue?: string | null) => void;
```

U `handleOtherConfirm`:
- Ukloniti cijeli async Supabase update blok
- Zvati `onNewOption?.(definition.id, trimmed, dependencyValue)` umjesto DB write
- `handleChange(trimmed)` ostaje (ažurira React state)
- `setShowOtherInput(false)` ostaje

#### Promjene u `AttributeChainForm.tsx`

Dodati prop:
```typescript
onNewOption?: (definitionId: string, newOption: string, dependencyValue?: string | null) => void;
```

Proslijediti u `renderAttribute` → `AttributeInput`:
```tsx
onNewOption={onNewOption}
```

#### Promjene u `AddActivityPage.tsx`

Dodati state:
```typescript
const [pendingOptionAdds, setPendingOptionAdds] = useState<Array<{
  definitionId: string;
  newOption: string;
  dependencyValue?: string | null;
}>>([]);
```

Handler:
```typescript
const handleNewOption = useCallback((
  definitionId: string,
  newOption: string,
  dependencyValue?: string | null
) => {
  setPendingOptionAdds(prev => [...prev, { definitionId, newOption, dependencyValue }]);
}, []);
```

#### Persist funkcija (nova helper funkcija, lokalna u AddActivityPage)

```typescript
async function persistPendingOptions(
  options: typeof pendingOptionAdds,
  attrDefs: AttributeDefinition[]
): Promise<void> {
  for (const pending of options) {
    const def = attrDefs.find(d => d.id === pending.definitionId);
    if (!def) continue;

    const parsed = parseValidationRules(def.validation_rules);

    let updatedRules: Record<string, unknown>;

    if (pending.dependencyValue && parsed.dependsOn) {
      // DependsOn: dodaj u specifičan WhenValue bucket
      const fullMap = { ...(parsed.dependsOn.optionsMap ?? {}) };
      const opts = fullMap[pending.dependencyValue] ?? [];
      if (opts.includes(pending.newOption)) continue; // već postoji
      fullMap[pending.dependencyValue] = [...opts, pending.newOption];
      updatedRules = {
        type: 'suggest',
        suggest: parsed.options,
        allow_other: true,
        depends_on: {
          attribute_slug: parsed.dependsOn.attributeSlug,
          options_map: fullMap,
        },
      };
    } else {
      // Plain suggest
      const existing = [...parsed.options];
      if (existing.includes(pending.newOption)) continue;
      existing.push(pending.newOption);
      updatedRules = { type: 'suggest', suggest: existing, allow_other: true };
    }

    const { error } = await supabase
      .from('attribute_definitions')
      .update({ validation_rules: updatedRules })
      .eq('id', pending.definitionId);

    if (error) {
      console.error('[persistPendingOptions] Failed:', error);
      // Ne bacamo error — eventi su već snimljeni, opcija nije kritična
    }
  }
}
```

#### Poziv u `handleFinish`

Nakon uspješnog commit eventa (kraj try bloka, prije navigate):
```typescript
if (pendingOptionAdds.length > 0) {
  const allDefs = Array.from(attributesByCategory.values()).flat();
  await persistPendingOptions(pendingOptionAdds, allDefs);
  setPendingOptionAdds([]);
}
```

**Napomena:** `pendingOptionAdds` se NE čisti na Save+ — čisti se samo na Finish
(jer korisnik može odabrati Other → Save+ → još opcija → Finish).

#### Dropdown prikaz za "Other" vrijednost prije Finish

Dok opcija nije persistirana u DB, dropdown je prikazuje kao `isCustomValue` (custom
opcija u `<select>`). Ovo je ispravno ponašanje — korisnik vidi svoju vrijednost.

---

## Sekcija B: DependsOn editing u Structure Edit

### B1. Prikaz postojećeg DependsOn (View mod)

Umjesto read-only notice, prikazati tablicu mapiranja:

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

Ovo se prikazuje u **CategoryDetailPanel** (View panel) i kao read-only preview
u Edit panelu ispod DependsOn notice.

### B2. Edit DependsOn u StructureNodeEditPanel

#### AttrEditState proširenje

```typescript
interface AttrEditState {
  // ... postojeća polja ...
  validationType: 'none' | 'suggest' | 'depends_on';
  suggestOptions: string;           // plain suggest opcije (jedan red = jedna opcija)

  // NOVO: DependsOn polja
  dependsOnSlug: string;            // slug parent atributa (npr. "Strength_type")
  dependsOnMap: DependsOnRow[];     // redovi mapiranja
}

interface DependsOnRow {
  whenValue: string;                // ključ u options_map (npr. "Upp", "*")
  options: string;                  // pipe ili newline odvojene opcije
  isNew?: boolean;                  // novi red (još nije u DB)
}
```

#### Inicijalizacija iz `validation_rules`

```typescript
if (parsed.dependsOn) {
  validationType = 'depends_on';
  dependsOnSlug = parsed.dependsOn.attributeSlug;
  dependsOnMap = Object.entries(parsed.dependsOn.optionsMap).map(([when, opts]) => ({
    whenValue: when,
    options: opts.join('\n'),
  }));
  suggestOptions = parsed.options.join('\n'); // default opcije (bez dependency)
}
```

#### UI layout za DependsOn atribut u Edit panelu

```
┌─────────────────────────────────────────────────┐
│ Name: exercise_name     Sort: [2]   [Delete]    │
│ Unit: ___               Data type: text (locked) │
│                                                  │
│ Depends on: [Strength_type ▼]                   │
│                                                  │
│ WhenValue       Options (one per line)           │
│ ┌──────────┐   ┌──────────────────────────┐     │
│ │ Upp      │   │ pull.m                   │[🗑] │
│ └──────────┘   │ biceps                   │     │
│                │ triceps                  │     │
│                └──────────────────────────┘     │
│ ┌──────────┐   ┌──────────────────────────┐     │
│ │ Low      │   │ squat-bw                 │[🗑] │
│ └──────────┘   │ squat-bulg               │     │
│                └──────────────────────────┘     │
│ ┌──────────┐   ┌──────────────────────────┐     │
│ │ *        │   │ (wildcards / no filter)  │[🗑] │
│ └──────────┘   └──────────────────────────┘     │
│                                                  │
│ [+ Add WhenValue row]                            │
│                                                  │
│ Default options (all WhenValues):                │
│ ┌──────────────────────────────────────────┐    │
│ │ (prazan — opcije su u options_map)        │    │
│ └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

#### Parent atribut dropdown

Lista se popunjava iz `attrStates` (atributi iste kategorije) filtrirani na:
- `dataType === 'text'` ili `validationType === 'suggest'`
- `attr.slug !== currentAttr.slug` (ne sebe samog)

#### Konverzija: plain suggest → DependsOn

Na atributu tipa `suggest` bez DependsOn: gumb **"+ Add Dependency"**.

Klik otvara DependsOn sekciju s jednim praznim redom. Korisnik:
1. Odabere parent atribut (dropdown)
2. Unese WhenValue
3. Unese opcije za taj WhenValue
4. Klikne "Save" → INSERT/UPDATE u DB

#### `buildNewRules` za DependsOn

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

### B3. Novi atribut s DependsOn (Add Attribute)

U inline formi za Add Attribute, dodati mogućnost:
- Tip: **suggest** → pojavljuje se opcija "Add Dependency"
- Isti UI kao B2 za definiranje mapiranja

Ovo je **opcijsko** za S29 — može se raditi u S30 ako je preopsežno.

---

## Redosljed implementacije (S29)

```
1. [A] Fix "Other" persist — queue + Finish write
   Fajlovi: AttributeInput.tsx, AttributeChainForm.tsx, AddActivityPage.tsx
   Trajanje: ~1h

2. [B1] DependsOn prikaz u View panelu (CategoryDetailPanel)
   Fajlovi: CategoryDetailPanel.tsx
   Trajanje: ~30min

3. [B2a] DependsOn read-only u Edit panelu — prikazati tablicu umjesto notice
   Fajlovi: StructureNodeEditPanel.tsx
   Trajanje: ~30min

4. [B2b] DependsOn edit — edit postojećih rows (WhenValue + Options)
   Fajlovi: StructureNodeEditPanel.tsx
   Trajanje: ~1.5h

5. [B2c] DependsOn edit — dodavanje novih rows, brisanje rows
   Fajlovi: StructureNodeEditPanel.tsx
   Trajanje: ~1h

6. [B2d] Konverzija suggest → DependsOn (+ Add Dependency gumb)
   Fajlovi: StructureNodeEditPanel.tsx
   Trajanje: ~45min
```

---

## Testni scenariji (S29)

| ID | Scenarij | Očekivano |
|----|----------|-----------|
| T-S29-1 | Add Activity: Other → "Nova vrijednost" → Save+ → još eventi → Finish | "Nova vrijednost" u suggest opcijama u Structure Edit |
| T-S29-2 | Add Activity: Other u DependsOn atributu (npr. exercise_name pri Strength_type=Upp) → Finish | Opcija dodana u options_map["Upp"] u DB |
| T-S29-3 | Add Activity: Other → Finish odmah (bez Save+) | Isto — persist se događa u Finish |
| T-S29-4 | Structure Edit: DependsOn atribut prikazuje tablicu mapiranja (ne "read-only notice") | Tablica s WhenValue/Options rows vidljiva |
| T-S29-5 | Structure Edit: Editirati opcije za jedan WhenValue → Save | DB ažuriran, Add Activity dropdown prikazuje nove opcije |
| T-S29-6 | Structure Edit: Dodati novi WhenValue red → Save | Novi ključ u options_map u DB |
| T-S29-7 | Structure Edit: Obrisati WhenValue red → Save | Ključ uklonjen iz options_map |
| T-S29-8 | Structure Edit: Promijeniti parent atribut (depends_on slug) → Save | DB ažuriran s novim attribute_slug |
| T-S29-9 | View panel (CategoryDetailPanel): DependsOn atribut | Tablica mapiranja vidljiva u read-only modu |

---

## Ključne napomene za implementaciju

- **Nikad ne mijenjati `parseValidationRules()`** — parser je stabilan i radi za V3 i legacy formate
- **`buildNewRules()` u StructureNodeEditPanel** uvijek piše V3 format (`type: 'suggest'`, `suggest: []`, `depends_on: {...}`)
- **`allow_other`** — uvijek `true` za suggest atribute (osim enum koji je `false`)
- **Slug parent atributa** se ne mijenja pri rename — koristiti slug, ne name
- **`*` ključ** u options_map je wildcard (matches sve vrijednosti koje nisu eksplicitno navedene)
- **Prazan `suggest` array** je OK — znači nema default opcija (sve opcije su u options_map)
- **`crypto.randomUUID()`** za `id` pri INSERT novih attribute_definitions (nema DB default)

---

## Relevantni fajlovi

```
src/components/activity/AttributeInput.tsx         "Other" logika
src/components/activity/AttributeChainForm.tsx     Proslijeđivanje onNewOption
src/pages/AddActivityPage.tsx                      Queue + persist na Finish
src/components/structure/StructureNodeEditPanel.tsx DependsOn edit UI
src/components/structure/CategoryDetailPanel.tsx   DependsOn view UI
src/hooks/useAttributeDefinitions.ts               parseValidationRules() — NE MIJENJATI
```
