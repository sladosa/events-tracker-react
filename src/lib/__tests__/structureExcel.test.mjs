/**
 * structureExcel helper tests
 * ============================
 * Tests all pure helper functions from structureExcel.ts
 * WITHOUT requiring ExcelJS or any npm install.
 *
 * Run from project root:
 *   node src/lib/__tests__/structureExcel.test.mjs
 *
 * Expected output: all tests PASS, final "All X tests passed."
 *
 * What is tested:
 *   1. parseValidationRules   — object / JSON string / null / garbage
 *   2. getValidationType      — none / suggest / depends_on
 *   3. getTextOptions         — pipe-separated options
 *   4. getDependsOnAttr       — parent attribute slug
 *   5. getDependsOnMap        — options_map serialised to pipe strings
 *   6. groupNodesByArea       — correct grouping + order preservation
 *   7. buildRowsForNode       — Category row count, Attribute row count,
 *                               correct field values, depends_on dynamic columns
 *   8. filterStructureNodes   — no filter / area filter / category filter
 *   9. structureExportFilename — format YYYYMMDD_HHMMSS
 */

// ─────────────────────────────────────────────────────────────────
// Inline copies of helper functions from structureExcel.ts
// (identical logic, plain JS — no TypeScript, no imports)
// If you change structureExcel.ts, update these copies too.
// ─────────────────────────────────────────────────────────────────

function parseValidationRules(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (obj['type'] === 'suggest') return obj;
  return null;
}

function getValidationType(attrDef) {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules) return 'none';
  if (rules.depends_on) return 'depends_on';
  if (rules.suggest && rules.suggest.length > 0) return 'suggest';
  return 'none';
}

function getTextOptions(attrDef) {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules || rules.depends_on) return '';
  if (rules.suggest && rules.suggest.length > 0) return rules.suggest.join('|');
  return '';
}

function getDependsOnAttr(attrDef) {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules?.depends_on) return '';
  return rules.depends_on.attribute_slug;
}

function getDependsOnMap(attrDef) {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules?.depends_on?.options_map) return {};
  const result = {};
  for (const [key, vals] of Object.entries(rules.depends_on.options_map)) {
    result[key] = Array.isArray(vals) ? vals.join('|') : String(vals);
  }
  return result;
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function structureExportFilename() {
  return `structure_export_${nowTimestamp()}.xlsx`;
}

function groupNodesByArea(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const areaId = node.areaId;
    const existing = map.get(areaId) ?? [];
    existing.push(node);
    map.set(areaId, existing);
  }
  return map;
}

function buildRowsForNode(node) {
  const rows = [];
  rows.push({
    type:           'Category',
    sort:           node.sortOrder,
    area:           node.area.name,
    chain:          node.fullPath,
    level:          node.level,
    isLeaf:         node.isLeaf ? 'Yes' : 'No',
    description:    node.description ?? '',
    attrName:       '',
    attrSlug:       '',
    attrType:       '',
    unit:           '',
    isRequired:     '',
    validationType: '',
    textOptions:    '',
    dependsOnAttr:  '',
  });
  for (const attr of node.attributeDefinitions) {
    const validationType = getValidationType(attr);
    const dependsOnMap   = getDependsOnMap(attr);
    const attrRow = {
      type:           'Attribute',
      sort:           attr.sort_order,
      area:           node.area.name,
      chain:          node.fullPath,
      level:          node.level,
      isLeaf:         node.isLeaf ? 'Yes' : 'No',
      description:    attr.description ?? '',
      attrName:       attr.name,
      attrSlug:       attr.slug,
      attrType:       attr.data_type,
      unit:           attr.unit ?? '',
      isRequired:     attr.is_required ? 'Yes' : 'No',
      validationType,
      textOptions:    getTextOptions(attr),
      dependsOnAttr:  getDependsOnAttr(attr),
    };
    for (const [value, options] of Object.entries(dependsOnMap)) {
      attrRow[`DependsOnWhen_${value}`] = options;
    }
    rows.push(attrRow);
  }
  return rows;
}

function filterStructureNodes(nodes, areaId, categoryId) {
  if (!areaId && !categoryId) return nodes;
  if (categoryId) {
    const pivot = nodes.find(n => n.id === categoryId);
    if (!pivot) return nodes;
    const prefix = pivot.fullPath;
    return nodes.filter(
      n => n.fullPath === prefix || n.fullPath.startsWith(prefix + ' > ')
    );
  }
  return nodes.filter(n => n.areaId === areaId);
}

// ─────────────────────────────────────────────────────────────────
// Test fixtures  (realistic data matching your actual schema)
// ─────────────────────────────────────────────────────────────────

const AREA_FITNESS = { id: 'area-fitness', name: 'Fitness', slug: 'fitness', sort_order: 1, description: null };
const AREA_PERSONAL = { id: 'area-personal', name: 'Personal', slug: 'personal', sort_order: 2, description: 'Personal stuff' };

// Attribute: simple suggest (Cardio type)
const ATTR_CARDIO_TYPE = {
  id: 'attr-1', name: 'Cardio Type', slug: 'cardio_type',
  data_type: 'text', unit: null, is_required: false,
  description: 'Type of cardio', sort_order: 1, default_value: null,
  validation_rules: { type: 'suggest', suggest: ['Run', 'Bike', 'Swim'] },
};

// Attribute: no suggest (free text)
const ATTR_DURATION = {
  id: 'attr-2', name: 'Duration', slug: 'duration',
  data_type: 'number', unit: 'min', is_required: true,
  description: null, sort_order: 2, default_value: null,
  validation_rules: {},
};

// Attribute: depends_on (Exercise Name depends on Strength Type)
const ATTR_EXERCISE_NAME = {
  id: 'attr-3', name: 'Exercise Name', slug: 'exercise_name',
  data_type: 'text', unit: null, is_required: false,
  description: 'Exercise performed', sort_order: 2, default_value: null,
  validation_rules: {
    type: 'suggest',
    depends_on: {
      attribute_slug: 'strength_type',
      options_map: {
        'Upp': ['pull.m', 'biceps', 'triceps'],
        'Low': ['squat-bw', 'squat-bulg', 'iskoraci'],
        'Core': ['leg.raises', 'plank', 'side.pl'],
      },
    },
  },
};

// Attribute: validation_rules stored as JSON string (DB edge case)
const ATTR_WITH_JSON_STRING = {
  id: 'attr-4', name: 'Intensity', slug: 'intensity',
  data_type: 'text', unit: null, is_required: false,
  description: null, sort_order: 3, default_value: null,
  validation_rules: '{"type":"suggest","suggest":["Low","Medium","High"]}',
};

// StructureNode fixtures
const NODE_AREA_FITNESS = {
  id: 'area-fitness', nodeType: 'area', name: 'Fitness',
  fullPath: 'Fitness', level: 0, isLeaf: false,
  description: null, sortOrder: 1, areaId: 'area-fitness',
  parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0,
  area: AREA_FITNESS, category: null,
};

const NODE_L1_ACTIVITY = {
  id: 'cat-activity', nodeType: 'category', name: 'Activity',
  fullPath: 'Fitness > Activity', level: 1, isLeaf: false,
  description: null, sortOrder: 1, areaId: 'area-fitness',
  parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0,
  area: AREA_FITNESS, category: { id: 'cat-activity' },
};

const NODE_L2_GYM = {
  id: 'cat-gym', nodeType: 'category', name: 'Gym',
  fullPath: 'Fitness > Activity > Gym', level: 2, isLeaf: false,
  description: null, sortOrder: 1, areaId: 'area-fitness',
  parentCategoryId: 'cat-activity', attributeDefinitions: [], attrCount: 0, eventCount: 0,
  area: AREA_FITNESS, category: { id: 'cat-gym' },
};

const NODE_LEAF_CARDIO = {
  id: 'cat-cardio', nodeType: 'category', name: 'Cardio',
  fullPath: 'Fitness > Activity > Gym > Cardio', level: 3, isLeaf: true,
  description: 'Aerobna aktivnost', sortOrder: 1, areaId: 'area-fitness',
  parentCategoryId: 'cat-gym',
  attributeDefinitions: [ATTR_CARDIO_TYPE, ATTR_DURATION],
  attrCount: 2, eventCount: 47,
  area: AREA_FITNESS, category: { id: 'cat-cardio' },
};

const NODE_LEAF_STRENGTH = {
  id: 'cat-strength', nodeType: 'category', name: 'Strength',
  fullPath: 'Fitness > Activity > Gym > Strength', level: 3, isLeaf: true,
  description: 'Trening snage', sortOrder: 2, areaId: 'area-fitness',
  parentCategoryId: 'cat-gym',
  attributeDefinitions: [ATTR_EXERCISE_NAME],
  attrCount: 1, eventCount: 120,
  area: AREA_FITNESS, category: { id: 'cat-strength' },
};

const NODE_AREA_PERSONAL = {
  id: 'area-personal', nodeType: 'area', name: 'Personal',
  fullPath: 'Personal', level: 0, isLeaf: false,
  description: 'Personal stuff', sortOrder: 2, areaId: 'area-personal',
  parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0,
  area: AREA_PERSONAL, category: null,
};

const NODE_LEAF_DIARY = {
  id: 'cat-diary', nodeType: 'category', name: 'Diary',
  fullPath: 'Personal > Diary', level: 1, isLeaf: true,
  description: null, sortOrder: 1, areaId: 'area-personal',
  parentCategoryId: null, attributeDefinitions: [],
  attrCount: 0, eventCount: 5,
  area: AREA_PERSONAL, category: { id: 'cat-diary' },
};

const ALL_NODES = [
  NODE_AREA_FITNESS, NODE_L1_ACTIVITY, NODE_L2_GYM,
  NODE_LEAF_CARDIO, NODE_LEAF_STRENGTH,
  NODE_AREA_PERSONAL, NODE_LEAF_DIARY,
];

// ─────────────────────────────────────────────────────────────────
// Mini test framework
// ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(msg ?? `Expected ${e} but got ${a}`);
}

function contains(str, sub) {
  if (!str.includes(sub)) throw new Error(`Expected "${str}" to contain "${sub}"`);
}

// ─────────────────────────────────────────────────────────────────
// 1. parseValidationRules
// ─────────────────────────────────────────────────────────────────
console.log('\n1. parseValidationRules');

test('returns null for empty object {}', () => {
  eq(parseValidationRules({}), null);
});
test('returns null for null', () => {
  eq(parseValidationRules(null), null);
});
test('returns null for undefined', () => {
  eq(parseValidationRules(undefined), null);
});
test('returns null for garbage string', () => {
  eq(parseValidationRules('not-json'), null);
});
test('parses object with type=suggest', () => {
  const r = parseValidationRules({ type: 'suggest', suggest: ['A', 'B'] });
  eq(r?.type, 'suggest');
  eq(r?.suggest, ['A', 'B']);
});
test('parses JSON string with type=suggest', () => {
  const r = parseValidationRules('{"type":"suggest","suggest":["X","Y"]}');
  eq(r?.type, 'suggest');
  eq(r?.suggest, ['X', 'Y']);
});
test('parses depends_on config', () => {
  const r = parseValidationRules(ATTR_EXERCISE_NAME.validation_rules);
  eq(r?.depends_on?.attribute_slug, 'strength_type');
});

// ─────────────────────────────────────────────────────────────────
// 2. getValidationType
// ─────────────────────────────────────────────────────────────────
console.log('\n2. getValidationType');

test('returns "none" for empty validation_rules', () => {
  eq(getValidationType(ATTR_DURATION), 'none');
});
test('returns "suggest" for simple suggest list', () => {
  eq(getValidationType(ATTR_CARDIO_TYPE), 'suggest');
});
test('returns "depends_on" for depends_on config', () => {
  eq(getValidationType(ATTR_EXERCISE_NAME), 'depends_on');
});
test('returns "suggest" for JSON string rules', () => {
  eq(getValidationType(ATTR_WITH_JSON_STRING), 'suggest');
});
test('returns "none" for suggest list with 0 options', () => {
  const attr = { ...ATTR_DURATION, validation_rules: { type: 'suggest', suggest: [] } };
  eq(getValidationType(attr), 'none');
});

// ─────────────────────────────────────────────────────────────────
// 3. getTextOptions
// ─────────────────────────────────────────────────────────────────
console.log('\n3. getTextOptions');

test('returns pipe-separated options for simple suggest', () => {
  eq(getTextOptions(ATTR_CARDIO_TYPE), 'Run|Bike|Swim');
});
test('returns empty string for "none" type', () => {
  eq(getTextOptions(ATTR_DURATION), '');
});
test('returns empty string for depends_on (those use DependsOnWhen_* columns)', () => {
  eq(getTextOptions(ATTR_EXERCISE_NAME), '');
});
test('parses JSON string validation_rules correctly', () => {
  eq(getTextOptions(ATTR_WITH_JSON_STRING), 'Low|Medium|High');
});

// ─────────────────────────────────────────────────────────────────
// 4. getDependsOnAttr
// ─────────────────────────────────────────────────────────────────
console.log('\n4. getDependsOnAttr');

test('returns parent attribute slug for depends_on', () => {
  eq(getDependsOnAttr(ATTR_EXERCISE_NAME), 'strength_type');
});
test('returns empty string for simple suggest', () => {
  eq(getDependsOnAttr(ATTR_CARDIO_TYPE), '');
});
test('returns empty string for "none"', () => {
  eq(getDependsOnAttr(ATTR_DURATION), '');
});

// ─────────────────────────────────────────────────────────────────
// 5. getDependsOnMap
// ─────────────────────────────────────────────────────────────────
console.log('\n5. getDependsOnMap');

test('returns empty object for "none" type', () => {
  eq(getDependsOnMap(ATTR_DURATION), {});
});
test('returns empty object for simple suggest', () => {
  eq(getDependsOnMap(ATTR_CARDIO_TYPE), {});
});
test('returns pipe-joined options for each key', () => {
  const map = getDependsOnMap(ATTR_EXERCISE_NAME);
  eq(map['Upp'], 'pull.m|biceps|triceps');
  eq(map['Low'], 'squat-bw|squat-bulg|iskoraci');
  eq(map['Core'], 'leg.raises|plank|side.pl');
});
test('returns exactly 3 keys for 3-value depends_on', () => {
  const map = getDependsOnMap(ATTR_EXERCISE_NAME);
  eq(Object.keys(map).length, 3);
});

// ─────────────────────────────────────────────────────────────────
// 6. groupNodesByArea
// ─────────────────────────────────────────────────────────────────
console.log('\n6. groupNodesByArea');

test('produces 2 groups for 2 areas', () => {
  const map = groupNodesByArea(ALL_NODES);
  eq(map.size, 2);
});
test('Fitness group has 5 nodes', () => {
  const map = groupNodesByArea(ALL_NODES);
  eq(map.get('area-fitness')?.length, 5);
});
test('Personal group has 2 nodes', () => {
  const map = groupNodesByArea(ALL_NODES);
  eq(map.get('area-personal')?.length, 2);
});
test('preserves DFS order within group', () => {
  const map = groupNodesByArea(ALL_NODES);
  const fitness = map.get('area-fitness');
  eq(fitness?.[0].id, 'area-fitness');
  eq(fitness?.[1].id, 'cat-activity');
  eq(fitness?.[3].id, 'cat-cardio');
  eq(fitness?.[4].id, 'cat-strength');
});

// ─────────────────────────────────────────────────────────────────
// 7. buildRowsForNode
// ─────────────────────────────────────────────────────────────────
console.log('\n7. buildRowsForNode');

test('Area node → 1 Category row, 0 Attribute rows', () => {
  const rows = buildRowsForNode(NODE_AREA_FITNESS);
  eq(rows.length, 1);
  eq(rows[0].type, 'Category');
});

test('Cardio leaf (2 attrs) → 1 Category + 2 Attribute rows', () => {
  const rows = buildRowsForNode(NODE_LEAF_CARDIO);
  eq(rows.length, 3);
  eq(rows[0].type, 'Category');
  eq(rows[1].type, 'Attribute');
  eq(rows[2].type, 'Attribute');
});

test('Category row has correct chain, level, isLeaf', () => {
  const row = buildRowsForNode(NODE_LEAF_CARDIO)[0];
  eq(row.chain, 'Fitness > Activity > Gym > Cardio');
  eq(row.level, 3);
  eq(row.isLeaf, 'Yes');
});

test('Non-leaf category row has isLeaf=No', () => {
  const row = buildRowsForNode(NODE_L2_GYM)[0];
  eq(row.isLeaf, 'No');
});

test('Attribute row for ATTR_CARDIO_TYPE has correct fields', () => {
  const rows = buildRowsForNode(NODE_LEAF_CARDIO);
  const attrRow = rows.find(r => r.attrName === 'Cardio Type');
  if (!attrRow) throw new Error('Cardio Type attr row not found');
  eq(attrRow.attrSlug, 'cardio_type');
  eq(attrRow.attrType, 'text');
  eq(attrRow.validationType, 'suggest');
  eq(attrRow.textOptions, 'Run|Bike|Swim');
  eq(attrRow.isRequired, 'No');
  eq(attrRow.dependsOnAttr, '');
});

test('Attribute row for ATTR_DURATION (number, required, no suggest)', () => {
  const rows = buildRowsForNode(NODE_LEAF_CARDIO);
  const attrRow = rows.find(r => r.attrName === 'Duration');
  if (!attrRow) throw new Error('Duration attr row not found');
  eq(attrRow.attrType, 'number');
  eq(attrRow.unit, 'min');
  eq(attrRow.isRequired, 'Yes');
  eq(attrRow.validationType, 'none');
  eq(attrRow.textOptions, '');
});

test('Strength node with depends_on attr → dynamic DependsOnWhen_* columns present', () => {
  const rows = buildRowsForNode(NODE_LEAF_STRENGTH);
  const attrRow = rows.find(r => r.attrName === 'Exercise Name');
  if (!attrRow) throw new Error('Exercise Name attr row not found');
  eq(attrRow.validationType, 'depends_on');
  eq(attrRow.dependsOnAttr, 'strength_type');
  eq(attrRow.textOptions, '');  // empty — uses DependsOnWhen_* instead
  eq(attrRow['DependsOnWhen_Upp'], 'pull.m|biceps|triceps');
  eq(attrRow['DependsOnWhen_Low'], 'squat-bw|squat-bulg|iskoraci');
  eq(attrRow['DependsOnWhen_Core'], 'leg.raises|plank|side.pl');
});

test('Category row fields that should be empty strings for leaf', () => {
  const catRow = buildRowsForNode(NODE_LEAF_CARDIO)[0];
  eq(catRow.attrName, '');
  eq(catRow.attrSlug, '');
  eq(catRow.validationType, '');
  eq(catRow.textOptions, '');
});

test('Category description is preserved', () => {
  const row = buildRowsForNode(NODE_LEAF_CARDIO)[0];
  eq(row.description, 'Aerobna aktivnost');
});

test('null description becomes empty string', () => {
  const row = buildRowsForNode