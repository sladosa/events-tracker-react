# ADD_CATEGORY_BETWEEN_SPEC_v2.md
# Events Tracker — Add Category Between + Collapse Level

**Datum:** 2026-04-16
**Session:** S55
**Status:** Finalni plan — spreman za implementaciju
**Podloga:** `docs/RESTRUCTURE_ANALYSIS.md` (Scenarij A + D), `docs/RESTRUCTURE_DECISIONS_2026-04-01.md`

---

## Pregled

Dvije komplementarne operacije koje zajedno čine "insert undo":

| Operacija | Menu item | Na kojim nodovima |
|-----------|-----------|-------------------|
| **Add Between** (Scenarij A) | ↕️ Add Between | Ne-leaf kategorije (već u CategoryChainRow) |
| **Collapse Level** (Scenarij D) | ↑ Collapse Level | Ne-leaf kategorije, samo kad nije area |

Obje su **event-safe** — leaf eventi zadržavaju `category_id` i `chain_key` nepromijenjene.

---

## Scenarij A — Add Between

### Što radi

Ubacuje novu međurazinu između odabrane ne-leaf kategorije i SVIH njenih direktnih djece.

```
BEFORE: Gym (L2) > [Strength (L3), Cardio (L3)]
          ↓  "Add Between" na Gym → unosi "Upper Body"
AFTER:  Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
```

Stare sesije nemaju Upper Body parent event — prihvatljivo (nema attr def-ova na novoj razini).
Nove sesije automatski dobivaju Upper Body parent event via `buildParentChainIds()`.

### DB operacije

1. **INSERT** nova kategorija: `level = parent.level + 1`, `parent_category_id = parent.id`, `area_id = parent.areaId`
2. **UPDATE** svako direktno dijete: `parent_category_id = newId`, `level = child.level + 1`
3. **UPDATE** svi dublji potomci: `level = level + 1` (samo level, parent_category_id ostaje)
4. `path` (ltree) se izostavlja — app koristi adjacency list, ne ltree za navigaciju

**Validacija:** `max(level svih potomaka) + 1 ≤ 10` — blokirati ako exceeded.

### Datoteke

| Datoteka | Akcija |
|----------|--------|
| `src/components/structure/StructureAddBetweenPanel.tsx` | **KREIRATI** |
| `src/components/structure/StructureTableView.tsx` | **MODIFICIRATI** — zamijeniti AddBetweenModal stub (L70–99), dodati handler |

### StructureAddBetweenPanel.tsx — props i logika

```ts
interface Props {
  parentNode: StructureNode;
  allNodes: StructureNode[];   // puni nodes iz useStructureData (ne filtered)
  userId: string;
  onClose: () => void;
  onCreated: (newNodeId: string) => void;
}
```

**UI:**
- Amber header (THEME.structureEdit) — identičan pattern kao StructureAddChildPanel
- Info box: "Inserting '[Name]' between **[parent.name]** and its N children: Strength, Cardio"
- Name input + slug preview (isti `generateSlug()` algoritam)
- Level error box ako maxDescendantLevel + 1 > 10

**Save slijed:**
```ts
// Direktna djeca i dublji potomci
const directChildren = allNodes.filter(
  n => n.nodeType === 'category' && n.category.parent_category_id === parentNode.id
);
const deeperDescendants = collectDeeperDescendants(directChildren, allNodes);
// (BFS isključujući direktnu djecu — vidi helper ispod)

// 1. INSERT
const newId = crypto.randomUUID();
await supabase.from('categories').insert({
  id: newId, user_id: userId, area_id: parentNode.areaId,
  parent_category_id: parentNode.id, name, slug,
  level: parentNode.level + 1, sort_order: 10,
});

// 2. UPDATE direktna djeca
for (const child of directChildren) {
  await supabase.from('categories')
    .update({ parent_category_id: newId, level: child.level + 1 })
    .eq('id', child.id).eq('user_id', userId);
}

// 3. UPDATE dublji potomci
for (const desc of deeperDescendants) {
  await supabase.from('categories')
    .update({ level: desc.level + 1 })
    .eq('id', desc.id).eq('user_id', userId);
}

onCreated(newId);
```

### StructureTableView.tsx — promjene za Scenarij A

1. Obrisati `AddBetweenModal` funkciju (L70–99)
2. Dodati import `StructureAddBetweenPanel`
3. Dodati `handleBetweenCreated` callback (isti pattern kao `handleChildCreated`)
4. Zamijeniti `<AddBetweenModal>` s `<StructureAddBetweenPanel parentNode={addBetweenNode} allNodes={nodes} userId={userId} ...>`
   — `userId` već postoji u scope-u (L161–166), `nodes` su full unfiltered (L140)

---

## Scenarij D — Collapse Level

### Što radi

Briše intermediarnu ne-leaf kategoriju i podiže njenu djecu na razinu roditelja.
**Inverzija Scenarija A.**

```
BEFORE: Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
          ↓  "Collapse Level" na Upper Body
AFTER:  Gym (L2) > [Strength (L3), Cardio (L3)]
```

### Dva puta ovisno o attr defs

#### Put 1 — 0 attr defs (jednostavno)

Upper Body parent eventi nemaju vrijednosti → sigurno brisanje.

```ts
// 1. Dohvati ID-jeve UpperBody evenata
const { data: ubEvents } = await supabase.from('events')
  .select('id').eq('category_id', node.id).eq('user_id', userId);
const ubEventIds = ubEvents.map(e => e.id);

// 2. Briši event_attributes → events → kategorija
if (ubEventIds.length > 0) {
  await supabase.from('event_attributes').delete().in('event_id', ubEventIds);
  await supabase.from('events').delete().eq('category_id', node.id).eq('user_id', userId);
}
await supabase.from('attribute_definitions').delete()
  .eq('category_id', node.id).eq('user_id', userId); // nema ih, ali za sigurnost

// 3. Re-parent direktna djeca (parent-- i level--)
for (const child of directChildren) {
  await supabase.from('categories')
    .update({ parent_category_id: node.category.parent_category_id, level: child.level - 1 })
    .eq('id', child.id).eq('user_id', userId);
}

// 4. Level-- za dublje potomke
for (const desc of deeperDescendants) {
  await supabase.from('categories')
    .update({ level: desc.level - 1 })
    .eq('id', desc.id).eq('user_id', userId);
}

// 5. Briši kategoriju
await supabase.from('categories').delete().eq('id', node.id).eq('user_id', userId);
```

#### Put 2 — ima attr defs (merge-down)

**Ključni koncepti:**
- UpperBody parent eventi imaju `chain_key = UUID nekog leaf-a` (P2 arhitektura)
- Merge ide na **direktno dijete** koje "posjeduje" taj leaf lanac
- Za svaki UpperBody event: pronaći odgovarajući event na direktnom djetetu, kopirati attr values

**chain_key lookupovi:**

```ts
// Pronađi koji direktni child je ancestor leaf-a na koji chain_key pokazuje
function findOwnerChild(
  chainKey: string,           // UUID leaf-a
  directChildren: StructureNode[],
  allNodes: StructureNode[]
): StructureNode | null {
  for (const child of directChildren) {
    if (child.id === chainKey) return child;             // direktno dijete JE leaf
    if (isAncestorOf(child.id, chainKey, allNodes)) return child;
  }
  return null;
}

function isAncestorOf(ancestorId: string, descendantId: string, allNodes: StructureNode[]): boolean {
  let current = allNodes.find(n => n.id === descendantId);
  while (current?.category.parent_category_id) {
    if (current.category.parent_category_id === ancestorId) return true;
    current = allNodes.find(n => n.id === current!.category.parent_category_id);
  }
  return false;
}

// Pronađi target event na direktnom djetetu
// - Leaf child:     category_id = child.id, session_start = ubEvent.session_start
// - Non-leaf child: category_id = child.id, chain_key = ubEvent.chain_key, session_start = ubEvent.session_start
```

**Cijeli merge-down slijed:**

```ts
// Korak 1: Dohvati attr defs i evente s attr values sa UpperBody
const { data: attrDefs } = await supabase.from('attribute_definitions')
  .select('*').eq('category_id', node.id).eq('user_id', userId);

const { data: ubEvents } = await supabase.from('events')
  .select('id, chain_key, session_start, event_attributes(*)')
  .eq('category_id', node.id).eq('user_id', userId);

// Korak 2: Za svako direktno dijete — INSERT attr defs (skip slug collision)
const skippedSlugs: string[] = [];
// attrDefIdMap[childId][oldAttrDefId] = newAttrDefId
const attrDefIdMap = new Map<string, Map<string, string>>();

for (const child of directChildren) {
  const childMap = new Map<string, string>();
  for (const ad of attrDefs) {
    const slugExists = child.attributeDefinitions.some(a => a.slug === ad.slug);
    if (slugExists) {
      if (!skippedSlugs.includes(ad.slug)) skippedSlugs.push(ad.slug);
      continue;
    }
    const newId = crypto.randomUUID();
    await supabase.from('attribute_definitions').insert({
      id: newId, category_id: child.id, user_id: userId,
      name: ad.name, slug: ad.slug, data_type: ad.data_type,
      sort_order: ad.sort_order, validation_rules: ad.validation_rules,
    });
    childMap.set(ad.id, newId);
  }
  attrDefIdMap.set(child.id, childMap);
}

// Korak 3: Za svaki UpperBody event — pronađi target i kopiraj event_attributes
for (const ubEvent of ubEvents ?? []) {
  if (!ubEvent.chain_key || !ubEvent.event_attributes?.length) continue;

  const ownerChild = findOwnerChild(ubEvent.chain_key, directChildren, allNodes);
  if (!ownerChild) continue;

  // Pronađi target event na owner childu
  let targetEventId: string | null = null;
  if (ownerChild.isLeaf) {
    const { data } = await supabase.from('events').select('id')
      .eq('category_id', ownerChild.id)
      .eq('session_start', ubEvent.session_start)
      .eq('user_id', userId).maybeSingle();
    targetEventId = data?.id ?? null;
  } else {
    const { data } = await supabase.from('events').select('id')
      .eq('category_id', ownerChild.id)
      .eq('chain_key', ubEvent.chain_key)
      .eq('session_start', ubEvent.session_start)
      .eq('user_id', userId).maybeSingle();
    targetEventId = data?.id ?? null;
  }
  if (!targetEventId) continue;

  // Kopiraj event_attributes
  const childMap = attrDefIdMap.get(ownerChild.id);
  if (!childMap) continue;
  for (const ea of ubEvent.event_attributes) {
    const newAttrDefId = childMap.get(ea.attribute_definition_id);
    if (!newAttrDefId) continue;
    await supabase.from('event_attributes').insert({
      event_id: targetEventId,
      attribute_definition_id: newAttrDefId,
      value_text: ea.value_text ?? null,
      value_number: ea.value_number ?? null,
      value_datetime: ea.value_datetime ?? null,
      value_boolean: ea.value_boolean ?? null,
    });
  }
}

// Korak 4: Cleanup UpperBody
const ubEventIds = (ubEvents ?? []).map(e => e.id);
if (ubEventIds.length > 0) {
  await supabase.from('event_attributes').delete().in('event_id', ubEventIds);
  await supabase.from('events').delete().eq('category_id', node.id).eq('user_id', userId);
}
await supabase.from('attribute_definitions').delete()
  .eq('category_id', node.id).eq('user_id', userId);

// Korak 5: Re-parent direktna djeca
for (const child of directChildren) {
  await supabase.from('categories')
    .update({ parent_category_id: node.category.parent_category_id, level: child.level - 1 })
    .eq('id', child.id).eq('user_id', userId);
}

// Korak 6: Level-- za dublje potomke
for (const desc of deeperDescendants) {
  await supabase.from('categories')
    .update({ level: desc.level - 1 })
    .eq('id', desc.id).eq('user_id', userId);
}

// Korak 7: Briši kategoriju
await supabase.from('categories').delete().eq('id', node.id).eq('user_id', userId);

// Vraća skippedSlugs za prikaz upozorenja u UI
```

### UI za Collapse Level panel

**Komponenta:** `StructureCollapseLevelPanel.tsx`

**Props:**
```ts
interface Props {
  node: StructureNode;         // intermediarna kategorija koja se briše
  allNodes: StructureNode[];
  userId: string;
  onClose: () => void;
  onCollapsed: () => void;     // nema newNodeId — highlight parent
}
```

**Info box (crveni/destructive):**
> "Removing **Upper Body** — its N children will move up to **Gym**."

Ako ima attr defs (Put 2):
> "N attribute definition(s) will be merged into children."

**Confirmation:** korisnik mora kliknuti "Collapse Level" (crveni gumb) — destructive akcija.

**Po završetku** ako skippedSlugs nije prazna:
> "Warning: attribute '[slug]' already exists on some children — those values were not merged."

**Header:** Crvena boja (bg-red-700) umjesto amber — signalizira destructive akciju.

### Datoteke — Scenarij D

| Datoteka | Akcija |
|----------|--------|
| `src/components/structure/StructureCollapseLevelPanel.tsx` | **KREIRATI** |
| `src/components/structure/CategoryChainRow.tsx` | **MODIFICIRATI** — dodati "↑ Collapse Level" menu item (~L202) |
| `src/components/structure/StructureTableView.tsx` | **MODIFICIRATI** — state, handler, render |

### CategoryChainRow.tsx — promjena

```tsx
{/* Non-leaf category actions */}
{node.nodeType === 'category' && !node.isLeaf && (
  <>
    {item('Edit', '✏️', () => onEdit?.(node))}
    {item('+ Add Child', '➕', () => onAddChild?.(node))}
    {item('Add Between', '↕️', () => onAddBetween?.(node))}
    {item('Collapse Level', '↑', () => onCollapseLevel?.(node), true)}  {/* destructive=true */}
    {item('Delete', '🗑️', () => onDelete?.(node), true)}
  </>
)}
```

Dodati `onCollapseLevel?: (node: StructureNode) => void` u Props i destructured params.

---

## Zajednički helper (u oba panela)

```ts
function collectDeeperDescendants(
  directChildren: StructureNode[],
  allNodes: StructureNode[]
): StructureNode[] {
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

Može biti lokalna funkcija u oba panela (DRY nije prioritet za dva fajla).

---

## Testiranje

### T-S55-1 — Add Between smoke test

**Preduvjet:** Ne-leaf kategorija s barem jednim djetetom

1. Edit Mode → ⋮ na ne-leaf → "Add Between ↕️"
2. Unijeti ime "Upper Body" → Save
3. **Očekivano:** nova kategorija vidljiva između; djeca na L+1; stari leaf eventi rade u Activities

### T-S55-2 — Add Between — level limit blokada

**Preduvjet:** Ne-leaf čiji najdublji potomak je na level 9

1. Edit Mode → ⋮ → "Add Between"
2. **Očekivano:** error box "hierarchy would exceed max depth (10)"; Save disabled

### T-S55-3 — Collapse Level (0 attr defs)

1. Izvesti T-S55-1 (dobiti Upper Body između Gym i Strength)
2. Edit Mode → ⋮ na Upper Body → "Collapse Level ↑"
3. **Očekivano:** Upper Body nestaje; Strength direktno ispod Gym na originalnom levelu
4. Leaf eventi u Activities rade ispravno

### T-S55-4 — Collapse Level s merge-down (ima attr defs)

1. Dodati attr def "equipment" na Upper Body (u Structure Edit)
2. Dodati activity na Strength leaf → Edit → unijeti vrijednost za "equipment"
3. Edit Mode → ⋮ na Upper Body → "Collapse Level ↑"
4. **Očekivano:**
   - Strength dobiva attr def "equipment"
   - U View Details za sesiju iz koraka 2: "equipment" vrijednost vidljiva na Strength eventu

### E13 — Playwright E2E

Dvije specifikacije u `e2e/tests/e13-add-between.spec.ts`:

- **E13-1:** Seed 3-level tree → Edit Mode → Add Between → provjeri: novi node postoji, djeca na L+1
- **E13-2:** Collapse Level (0 attr defs) → provjeri: node nestao, djeca na L-1, grandchildren na L-1

### Typecheck + build

```
npm run typecheck && npm run build
```

---

## Session split (ako treba)

**S55a:** Scenarij A (StructureAddBetweenPanel) + E13-1
**S55b:** Scenarij D (StructureCollapseLevelPanel) + E13-2 + T-S55-3, T-S55-4

---

*Kreiran: 2026-04-16 — S55 finalni implementacijski plan*
