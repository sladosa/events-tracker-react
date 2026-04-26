# ADD_CATEGORY_BETWEEN_SPEC_v1.md
# Events Tracker — Add Category Between + Collapse Level

**Datum:** 2026-04-16
**Session:** S55
**Status:** Plan — spreman za implementaciju
**Podloga:** `docs/RESTRUCTURE_ANALYSIS.md` (Scenarij A + D), `docs/RESTRUCTURE_DECISIONS_2026-04-01.md`

---

## Kontekst

Scenarij A iz RESTRUCTURE_ANALYSIS.md: ubacivanje nove međurazine između odabrane
ne-leaf kategorije i SVIH njezinih direktnih djece.

Ovo je **operacija niskog rizika** — eventi se ne diraju:
- Leaf eventi zadržavaju `category_id` i `chain_key` nepromijenjene
- Nove sesije automatski dobivaju novi parent event via `buildParentChainIds()`
- Stare sesije nemaju novi parent event (prihvatljivo per RESTRUCTURE_DECISIONS)

Stub za ovu akciju već postoji:
- `CategoryChainRow.tsx` linija 202 — "Add Between ↕️" u ⋮ meniju za ne-leaf kategorije u Edit Modu
- `StructureTableView.tsx` linije 70-99 — `AddBetweenModal` placeholder koji kaže "planned for future version"

Implementacija zamjenjuje taj placeholder pravim panelom.

---

## Primjer

```
BEFORE: Fitness > Activity > Gym (L2, ne-leaf) > [Strength (L3), Cardio (L3)]
                                  ↓  korisnik klikne "Add Between" na Gym
AFTER:  Fitness > Activity > Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
```

---

## DB operacije (eventi se NE diraju)

1. **INSERT** nova kategorija
   - `level = parentNode.level + 1`
   - `parent_category_id = parentNode.id`
   - `area_id = parentNode.areaId`
   - `path` polje se izostavlja (app koristi adjacency list; ltree path nije u upotrebi)

2. **UPDATE** svako direktno dijete parentNode
   - `parent_category_id = newId`
   - `level = child.level + 1`
   - (jedan UPDATE po djetetu)

3. **UPDATE** svi dublji potomci (grandchildren, itd.)
   - `level = level + 1` (samo level, parent ostaje isti)
   - (jedan UPDATE po nodu; vrijednosti poznate iz allNodes koji su već u memoriji)

**Level check prije Save:** `max(level svih potomaka) + 1 ≤ 10` — ako nije, blokirati Save s greškom.

---

## Datoteke

| Datoteka | Akcija |
|----------|--------|
| `src/components/structure/StructureAddBetweenPanel.tsx` | **KREIRATI** — pravi panel |
| `src/components/structure/StructureTableView.tsx` | **MODIFICIRATI** — zamijeniti AddBetweenModal stub |

---

## StructureAddBetweenPanel.tsx — specifikacija

### Props

```ts
interface Props {
  parentNode: StructureNode;   // ne-leaf kategorija na kojoj je kliknut "Add Between"
  allNodes: StructureNode[];   // cijeli unfiltered node list (za traženje potomaka)
  userId: string;
  onClose: () => void;
  onCreated: (newNodeId: string) => void;
}
```

### Forma

- Text input: ime kategorije (required)
- Auto-generated slug preview — isti algoritam kao `StructureAddChildPanel`:
  `name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`

### Info box

Prikazati korisniku scope operacije:
> "Inserting '**[New Name]**' between **[parentNode.name]** and its N children: Strength, Cardio"

### Validacija (blokira Save)

- Name nije prazan
- Slug nije prazan / valjan pattern
- Level check: ako `maxDescendantLevel + 1 > 10` → error "Cannot insert — hierarchy would exceed max depth (10)"

### Računanje direktne djece

```ts
const directChildren = allNodes.filter(
  n => n.nodeType === 'category' && n.category.parent_category_id === parentNode.id
);
```

### Računanje dubljih potomaka

BFS od svake direktne djece (isključujući samu direktnu djecu):

```ts
function collectDeeperDescendants(
  directChildren: StructureNode[],
  allNodes: StructureNode[]
): StructureNode[] {
  const directIds = new Set(directChildren.map(c => c.id));
  const queue = [...directChildren];
  const result: StructureNode[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    const children = allNodes.filter(
      n => n.nodeType === 'category' && n.category.parent_category_id === current.id
    );
    for (const child of children) {
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}
```

(Isti BFS pattern kao u `StructureDeleteModal`)

### Slijed Save

```ts
// 1. Insert nove kategorije
const newId = crypto.randomUUID();
await supabase.from('categories').insert({
  id: newId,
  user_id: userId,
  area_id: parentNode.areaId,
  parent_category_id: parentNode.id,
  name,
  slug,
  level: parentNode.level + 1,
  sort_order: 10,
});

// 2. Update direktne djece (novi parent + level++)
for (const child of directChildren) {
  await supabase.from('categories')
    .update({ parent_category_id: newId, level: child.level + 1 })
    .eq('id', child.id)
    .eq('user_id', userId);
}

// 3. Update dubljih potomaka (samo level++)
for (const desc of deeperDescendants) {
  await supabase.from('categories')
    .update({ level: desc.level + 1 })
    .eq('id', desc.id)
    .eq('user_id', userId);
}

// 4. Callback → refetch + highlight
onCreated(newId);
```

### Error handling

Ako bilo koji korak padne: prikazati toast s greškom, ostaviti DB u trenutnom stanju.
Prihvatljivo jer je površina operacije mala i Structure Excel backup postoji kao safety net.

### UI pattern

Kopirati strukturu `StructureAddChildPanel`:
- Amber header (THEME.structureEdit)
- Spinner during save
- Cancel + Save gumbi

---

## StructureTableView.tsx — promjene

1. **Obrisati** `AddBetweenModal` funkciju (linije 70–99)
2. **Dodati** import: `import { StructureAddBetweenPanel } from './StructureAddBetweenPanel';`
3. **Osigurati** da je `userId` dostupan u scope-u (dohvatiti iz `supabase.auth.getUser()` ako već nije)
4. **Zamijeniti** `addBetweenNode && <AddBetweenModal ...>` blok s:

```tsx
{addBetweenNode && (
  <StructureAddBetweenPanel
    parentNode={addBetweenNode}
    allNodes={nodes}          // puni unfiltered list iz useStructureData
    userId={userId}
    onClose={() => setAddBetweenNode(null)}
    onCreated={async (newId) => {
      setAddBetweenNode(null);
      await refetch();
      setHighlightedNodeId(newId);
      window.dispatchEvent(new CustomEvent('areas-changed'));
    }}
  />
)}
```

Koristiti `nodes` (ne `filtered`) jer trebamo cijeli tree za traženje potomaka.

---

---

## Scenarij D — Collapse Level (inverzija Scenarija A)

**Što radi:** Briše intermediarnu ne-leaf kategoriju i **podiže njenu djecu** na razinu roditelja.
Ovo je "undo Add Between" operacija — vraća strukturu u prethodno stanje.

**Primjer:**
```
BEFORE: Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
                    ↓  korisnik klikne "Collapse Level" na Upper Body
AFTER:  Gym (L2) > [Strength (L3), Cardio (L3)]
```

**Gdje se prikazuje:** Novi menu item "Collapse Level ↑" u ⋮ meniju za ne-leaf, ne-area kategorije u Edit Modu (isti uvjeti kao "Add Between").

### Dva puta ovisno o attr defs

#### Put 1 — 0 attr defs (jednostavno)

Upper Body nema attribute definitions → parent eventi na njoj nemaju vrijednosti → sigurno brisanje:

1. DELETE svi eventi s `category_id = upperBody.id` (prazni parent eventi)
2. UPDATE direktna djeca: `parent_category_id = upperBody.parent_category_id, level--`
3. UPDATE svi dublji potomci: `level--`
4. DELETE upper_body kategorija (attr_defs i event_attributes su prazni → kaskada je trivijalna)

#### Put 2 — ima attr defs (merge-down)

Upper Body ima attribute definitions → parent eventi imaju vrijednosti → merge prema dolje.

**Ključna napomena o chain_key:** Parent eventi na Upper Body uvijek imaju `chain_key = UUID nekog leaf-a` (P2 arhitektura). Taj isti chain_key postoji i na parent eventima direktne djece (ako su non-leaf). Za leaf djecu, leaf event ima `chain_key = NULL` ali je jedinstven po `category_id + session_start`.

**Slijed merge-down:**

```
Korak 1: Kopiraj attr defs na direktnu djecu
```
```ts
const attrDefIdMap = new Map<string, Map<string, string>>();
// attrDefIdMap: childId → Map<oldAttrDefId → newAttrDefId>

for (const child of directChildren) {
  const childMap = new Map<string, string>();
  for (const attrDef of upperBodyAttrDefs) {
    // Provjeri slug collision na child kategoriji
    const slugExists = child.attributeDefinitions.some(a => a.slug === attrDef.slug);
    if (slugExists) {
      skippedSlugs.push({ child: child.name, slug: attrDef.slug });
      continue; // preskoči, ne gubi ostale
    }
    const newAttrDefId = crypto.randomUUID();
    await supabase.from('attribute_definitions').insert({
      id: newAttrDefId,
      category_id: child.id,
      user_id: userId,
      name: attrDef.name,
      slug: attrDef.slug,
      data_type: attrDef.data_type,
      sort_order: attrDef.sort_order,
      validation_rules: attrDef.validation_rules,
    });
    childMap.set(attrDef.id, newAttrDefId);
  }
  attrDefIdMap.set(child.id, childMap);
}
```

```
Korak 2: Kopiraj event_attributes prema dolje (po eventu)
```
```ts
// Dohvati sve UpperBody evente + njihove event_attributes
const { data: upperBodyEvents } = await supabase
  .from('events')
  .select('id, chain_key, session_start, event_attributes(*)')
  .eq('category_id', upperBodyNode.id)
  .eq('user_id', userId);

for (const ubEvent of upperBodyEvents) {
  // Pronađi koji direktni child "posjeduje" ovaj event lanac
  // chain_key = UUID leaf-a → tražimo child koji je ancestor tog leaf-a (ili jest taj leaf)
  const ownerChild = findOwnerChild(ubEvent.chain_key, directChildren, allNodes);
  if (!ownerChild) continue; // ne bi se trebalo desiti

  // Pronađi target event na owner childu
  let targetEvent;
  if (ownerChild.isLeaf) {
    // Leaf event: category_id = leaf.id, chain_key = NULL, session_start = isti
    const { data } = await supabase.from('events')
      .select('id')
      .eq('category_id', ownerChild.id)
      .eq('session_start', ubEvent.session_start)
      .eq('user_id', userId)
      .maybeSingle();
    targetEvent = data;
  } else {
    // Non-leaf parent event: category_id = child.id, chain_key = isti, session_start = isti
    const { data } = await supabase.from('events')
      .select('id')
      .eq('category_id', ownerChild.id)
      .eq('chain_key', ubEvent.chain_key)
      .eq('session_start', ubEvent.session_start)
      .eq('user_id', userId)
      .maybeSingle();
    targetEvent = data;
  }

  if (!targetEvent) continue; // target event ne postoji (stara sesija bez tog parenta)

  // Kopiraj event_attributes
  const childMap = attrDefIdMap.get(ownerChild.id);
  if (!childMap) continue;
  for (const ea of ubEvent.event_attributes) {
    const newAttrDefId = childMap.get(ea.attribute_definition_id);
    if (!newAttrDefId) continue; // slug je bio collision, preskoči
    await supabase.from('event_attributes').insert({
      event_id: targetEvent.id,
      attribute_definition_id: newAttrDefId,
      value_text: ea.value_text,
      value_number: ea.value_number,
      value_datetime: ea.value_datetime,
      value_boolean: ea.value_boolean,
    });
  }
}
```

```
Korak 3: Cleanup + re-parent
```
```ts
// Briši event_attributes → events → attr_defs na Upper Body
// (redosljed važan zbog FK constraints)
await supabase.from('event_attributes')
  .delete()
  .in('event_id', upperBodyEventIds);

await supabase.from('events')
  .delete()
  .eq('category_id', upperBodyNode.id)
  .eq('user_id', userId);

await supabase.from('attribute_definitions')
  .delete()
  .eq('category_id', upperBodyNode.id)
  .eq('user_id', userId);

// Re-parent direktna djeca (level--)
for (const child of directChildren) {
  await supabase.from('categories')
    .update({
      parent_category_id: upperBodyNode.category.parent_category_id,
      level: child.level - 1,
    })
    .eq('id', child.id).eq('user_id', userId);
}

// Level-- za sve dublje potomke
for (const desc of deeperDescendants) {
  await supabase.from('categories')
    .update({ level: desc.level - 1 })
    .eq('id', desc.id).eq('user_id', userId);
}

// Briši Upper Body kategoriju
await supabase.from('categories')
  .delete()
  .eq('id', upperBodyNode.id)
  .eq('user_id', userId);
```

### Helper: findOwnerChild

```ts
function findOwnerChild(
  chainKey: string,           // UUID leaf-a
  directChildren: StructureNode[],
  allNodes: StructureNode[]
): StructureNode | null {
  // chainKey = leaf category UUID
  // Tražimo koji direktni child je ancestor tog leaf-a (ili jest taj leaf)
  for (const child of directChildren) {
    if (child.id === chainKey) return child; // direktno dijete JE leaf
    if (isAncestorOf(child.id, chainKey, allNodes)) return child;
  }
  return null;
}

function isAncestorOf(
  ancestorId: string,
  descendantId: string,
  allNodes: StructureNode[]
): boolean {
  let current = allNodes.find(n => n.id === descendantId);
  while (current && current.category.parent_category_id) {
    if (current.category.parent_category_id === ancestorId) return true;
    current = allNodes.find(n => n.id === current!.category.parent_category_id);
  }
  return false;
}
```

### UI za Collapse Level

**Panel:** `StructureCollapseLevelPanel.tsx` (novi komponent, analogno Add Between panelu)

**Info box (crveni/amber):**
> "Removing **Upper Body** and moving its N children up to **Gym**."

Ako ima attr defs:
> "N attribute definitions will be merged into children. ⚠ Attribute values for sessions where no matching event exists will be lost."

Ako ima skipped slugs (slug collision):
> "Warning: [slug] already exists on [child name] — those values will not be merged."

**Gumbi:** Cancel | Collapse Level (destructive → crveni gumb)

### Datoteke — Scenarij D

| Datoteka | Akcija |
|----------|--------|
| `src/components/structure/StructureCollapseLevelPanel.tsx` | **KREIRATI** |
| `src/components/structure/CategoryChainRow.tsx` | **MODIFICIRATI** — dodati "Collapse Level ↑" menu item |
| `src/components/structure/StructureTableView.tsx` | **MODIFICIRATI** — state + render za CollapseLevel panel |

---

## Testiranje

### T-S55-1 — Add Between smoke test

**Preduvjet:** Postoji ne-leaf kategorija s barem jednim djetetom (npr. Fitness > Gym > Strength)

1. Ući u Edit Mode na Structure tabu
2. Kliknuti ⋮ na Gym (ne-leaf) → "Add Between ↕️"
3. Upisati ime "Upper Body" → Save
4. **Očekivano:** nova kategorija "Upper Body" vidljiva između Gym i Strength; Strength sada prikazuje L+1
5. Otvoriti Activities tab → naći stari event na Strength → View/Edit radi ispravno

### T-S55-2 — Level limit blokada

**Preduvjet:** Postoji ne-leaf kategorija čiji najdublji potomak je na level 9

1. Edit Mode → ⋮ → "Add Between" na toj kategoriji
2. **Očekivano:** modal pokazuje grešku "Cannot insert — hierarchy would exceed max depth (10)"; Save je disabled

### T-S55-3 — Collapse Level (0 attr defs)

1. Izvedi T-S55-1 (dobiti Upper Body između Gym i Strength)
2. Edit Mode → ⋮ na Upper Body → "Collapse Level ↑"
3. **Očekivano:** Upper Body nestaje, Strength je opet direktno ispod Gym na istom levelu kao prije
4. Provjeri da stari Strength eventi i dalje rade u Activities tab

### T-S55-4 — Collapse Level s merge-down (ima attr defs)

1. Dodaj attr def "equipment" na Upper Body (u Structure Edit)
2. Dodaj activity na Strength leaf → u View/Edit provjeri da se Upper Body prikazuje s "equipment" poljem
3. Edit Mode → ⋮ na Upper Body → "Collapse Level ↑"
4. **Očekivano:** Strength dobiva "equipment" attr def; Value iz sesije iz koraka 2 vidljiv na Strength eventu

### E13 — Playwright E2E

- Add Between: seed 3-level tree → trigger → provjeri novu strukturu
- Collapse Level (0 attr): trigger na upravo dodanoj razini → provjeri vraćanje na original
- Koristiti `data-testid` selektore konzistentno s postojećim E2E patternima

### Typecheck + build

```
npm run typecheck && npm run build
```

---

*Kreiran: 2026-04-16 — S55 implementation plan (Scenarij A + D)*
