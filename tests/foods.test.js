import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIAS_INDEX, DIET_TAGS, FOOD_COUNT, FOOD_DB, FOOD_GROUPS, FOOD_LIST, FOOD_ROWS, FOOD_STATES, VALUE_KEYS,
  buildCustomFood, escapeRegExp, normalizeText,
} from '../js/data/foods.js';
import { AISLES, NUTRIENT_KEYS } from '../js/data/nutrients.js';

test('VALUE_KEYS covers exactly the tracked nutrients', () => {
  assert.deepEqual([...VALUE_KEYS].sort(), [...NUTRIENT_KEYS].sort());
  assert.ok(NUTRIENT_KEYS.includes('sodium'));
  assert.ok(NUTRIENT_KEYS.includes('saturatedFat'));
});

test('table has roughly 150+ foods with unique ids', () => {
  assert.ok(FOOD_COUNT >= 150, `only ${FOOD_COUNT} foods`);
  assert.equal(new Set(FOOD_ROWS.map((r) => r.id)).size, FOOD_ROWS.length);
  FOOD_ROWS.forEach((r) => assert.match(r.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, r.id));
});

test('every row is complete and well-formed', () => {
  FOOD_ROWS.forEach((row) => {
    const label = row.id;
    assert.equal(row.n.length, VALUE_KEYS.length, `${label}: nutrient count`);
    row.n.forEach((v, i) => assert.ok(Number.isFinite(v) && v >= 0, `${label}: ${VALUE_KEYS[i]} = ${v}`));
    assert.ok(row.name, `${label}: name`);
    assert.ok(AISLES.includes(row.aisle), `${label}: aisle`);
    assert.ok(FOOD_STATES.includes(row.state), `${label}: state ${row.state}`);
    assert.ok(typeof row.source === 'string' && row.source.length > 10, `${label}: source`);
    assert.doesNotMatch(row.source, /fdc ?id|\b\d{6,7}\b/i, `${label}: no unverified FDC ids`);
    (row.tags ?? []).forEach((t) => assert.ok(DIET_TAGS.includes(t), `${label}: unknown tag ${t}`));
    Object.values(row.g ?? {}).forEach((grams) => assert.ok(grams > 0, `${label}: portion weight`));
  });
});

test('nutrients are internally consistent', () => {
  FOOD_LIST.forEach(({ id, nutrients: n }) => {
    assert.ok(n.saturatedFat <= n.fat + 1e-9, `${id}: saturated fat > fat`);
    assert.ok(n.sugar <= n.carbs + 1e-9, `${id}: sugar > carbs`);
    assert.ok(n.fiber <= n.carbs + 1e-9, `${id}: fiber > carbs`);
    assert.ok(n.protein + n.carbs + n.fat <= 100.5, `${id}: macros exceed 100 g`);
  });
});

test('energy roughly matches Atwater factors (4P + 4C + 9F, fiber at 2 kcal/g, alcohol at 7)', () => {
  FOOD_LIST.forEach(({ id, nutrients: n, alcohol }) => {
    const estimate = 4 * n.protein + 4 * (n.carbs - n.fiber) + 2 * n.fiber + 9 * n.fat + 7 * alcohol;
    const diff = Math.abs(estimate - n.calories);
    // 20 % relative tolerance; low-energy foods (vinegar, citrus juice) get a 20 kcal absolute allowance.
    assert.ok(diff <= Math.max(0.2 * n.calories, 20), `${id}: ${n.calories} kcal listed vs ${estimate.toFixed(0)} estimated`);
  });
});

test('aliases are unique, normalized and point to the right rows', () => {
  const seen = new Map();
  ALIAS_INDEX.forEach(({ alias, id }) => {
    assert.ok(!seen.has(alias), `alias "${alias}" used by ${seen.get(alias)} and ${id}`);
    seen.set(alias, id);
    assert.equal(alias, normalizeText(alias));
  });
  for (let i = 1; i < ALIAS_INDEX.length; i += 1) assert.ok(ALIAS_INDEX[i - 1].length >= ALIAS_INDEX[i].length, 'longest first');
});

test('state groups have one row per state and a default with aliases', () => {
  Object.entries(FOOD_GROUPS).forEach(([group, variants]) => {
    const rows = FOOD_LIST.filter((f) => f.group === group);
    assert.equal(rows.length, Object.keys(variants).length, `${group}: duplicate state`);
    assert.ok(rows.length >= 2, `${group}: needs at least two states`);
    assert.ok(rows.some((f) => f.aliases.length), `${group}: no aliases`);
  });
  ['white-rice', 'brown-rice', 'pasta', 'quinoa', 'lentils', 'black-beans', 'chickpeas', 'lima-beans'].forEach((group) => {
    assert.ok(FOOD_GROUPS[group]?.cooked, `${group}: cooked`);
    assert.ok(FOOD_GROUPS[group]?.dry, `${group}: dry`);
  });
});

test('cooked grains and legumes have far less energy than dry', () => {
  Object.values(FOOD_GROUPS).forEach((v) => {
    if (v.dry && v.cooked) assert.ok(v.cooked.nutrients.calories < v.dry.nutrients.calories * 0.5, v.dry.id);
  });
});

test('ids referenced by the substitution engine exist', () => {
  ['sunflower-butter', 'sunflower-seeds', 'hemp-seeds', 'nutritional-yeast', 'gf-oats', 'gf-pasta', 'gf-bread', 'coconut-aminos',
    'coconut-yogurt', 'maple-syrup', 'cauliflower', 'zucchini', 'romaine', 'oat-milk', 'almond-milk', 'soy-milk', 'almond-butter',
    'tofu', 'chicken', 'chickpeas', 'mushroom', 'strawberries', 'chia', 'olive-oil', 'quinoa', 'pumpkin-seeds',
    'spinach', 'bell-pepper', 'eggs', 'beef', 'tuna', 'oats', 'brown-rice', 'bread', 'pasta', 'lentils', 'black-beans', 'broth',
    'peanut-butter', 'honey', 'milk', 'cheddar', 'butter', 'greek-yogurt', 'cottage-cheese', 'soy-sauce', 'salt'].forEach((id) => {
    assert.ok(FOOD_DB[id], id);
  });
});

test('diet tags follow the restriction ids', () => {
  const tags = (id) => FOOD_DB[id].tags;
  assert.deepEqual(tags('peanut-butter').sort(), ['legumes', 'peanuts']);
  assert.ok(tags('oats').includes('gluten'));
  assert.ok(!tags('gf-oats').includes('gluten'));
  assert.ok(tags('almond-milk').includes('tree_nuts'));
  assert.ok(tags('ground-turkey').includes('meat'));
  assert.ok(tags('eggs').includes('eggs'));
  assert.ok(tags('shrimp').includes('shellfish'));
  assert.ok(tags('honey').includes('honey'));
  assert.ok(tags('soy-sauce').includes('soy') && tags('soy-sauce').includes('gluten'));
  assert.deepEqual(tags('coconut-milk'), []);
});

test('split foods differ where the old table conflated them', () => {
  const n = (id) => FOOD_DB[id].nutrients;
  assert.ok(n('coconut-milk').calories > 150);
  assert.ok(n('almond-milk').calories < 30 && n('almond-milk').protein < 1);
  assert.ok(n('feta').sodium > n('cheddar').sodium);
  assert.ok(n('maple-syrup').calcium > n('honey').calcium * 5);
  assert.ok(n('lemon').vitaminC > n('lime').vitaminC);
  assert.ok(n('red-pepper-flakes').calories > n('bell-pepper').calories * 5);
  assert.ok(n('butter').fat > 80 && n('lima-beans-cooked').fat < 1);
  assert.equal(n('salt').sodium, 38758);
});

test('custom foods build a complete food', () => {
  const food = buildCustomFood({ id: 'custom-x', name: 'Gochujang', nutrients: { calories: 210, sodium: 2400, protein: -3 } });
  assert.equal(food.custom, true);
  assert.equal(food.nutrients.calories, 210);
  assert.equal(food.nutrients.protein, 0);
  assert.equal(food.nutrients.vitaminC, 0);
  assert.equal(food.gPerCup, 240);
  assert.deepEqual(Object.keys(food.nutrients).sort(), [...NUTRIENT_KEYS].sort());
});

test('helpers normalize accents and escape regex metacharacters', () => {
  assert.equal(normalizeText('Jalapeño  Peppers!'), 'jalapeno peppers');
  assert.equal(escapeRegExp('a.b*c(d)'), 'a\\.b\\*c\\(d\\)');
});
