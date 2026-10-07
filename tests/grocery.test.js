import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GroceryAggregator } from '../js/engines/grocery.js';
import { RecipeManager } from '../js/engines/recipe-manager.js';
import { SubstitutionEngine } from '../js/engines/substitution.js';
import { FOOD_DB } from '../js/data/foods.js';
import { AISLES, PANTRY, SPICES } from '../js/data/nutrients.js';

// Expected quantities are derived from RecipeManager itself, so these tests check the
// roll-up (scaling, merging, grouping) and not the food table, which changes often.
const RECIPE = {
  id: 'r-test',
  title: 'Test bowl',
  servings: 2,
  ingredientsText: '200 g salmon\n1 cup spinach\n2 tbsp xyzzy paste',
};
const recipes = new Map([[RECIPE.id, RECIPE]]);
const plan = (days) => Object.fromEntries(days.map((d) => [d, { lunch: RECIPE.id }]));
const allItems = (groups) => groups.flatMap((g) => g.items);
const analyze = (recipe) => ({ ...RecipeManager.analyze(recipe), isSafe: true });
const matched = () => RecipeManager.analyze(RECIPE).ingredients.filter((ing) => ing.foodId);

describe('GroceryAggregator.aggregate', () => {
  it('returns no groups for an empty plan and no supplements', () => {
    assert.deepEqual(GroceryAggregator.aggregate({}, recipes, 1, [], analyze), []);
  });

  it('ignores slots pointing at deleted recipes', () => {
    assert.deepEqual(GroceryAggregator.aggregate({ monday: { lunch: 'missing' } }, recipes, 1, [], analyze), []);
  });

  it('merges the same food across days and scales by household / servings', () => {
    assert.ok(matched().length > 0, 'the fixture recipe should match at least one food');
    const items = allItems(GroceryAggregator.aggregate(plan(['monday', 'wednesday']), recipes, 1, [], analyze));
    matched().forEach((ing) => {
      const item = items.find((i) => i.key === ing.foodId);
      assert.ok(item, `${ing.foodId} is listed`);
      // Two days × (household 1 / 2 servings) = one recipe's worth.
      assert.ok(Math.abs(item.grams - ing.grams) < 1e-9);
    });
  });

  it('scales linearly with household size', () => {
    const one = allItems(GroceryAggregator.aggregate(plan(['monday']), recipes, 1, [], analyze));
    const four = allItems(GroceryAggregator.aggregate(plan(['monday']), recipes, 4, [], analyze));
    one.filter((i) => i.grams !== undefined).forEach((item) => {
      const scaled = four.find((i) => i.key === item.key);
      assert.ok(Math.abs(scaled.grams - item.grams * 4) < 1e-9, item.key);
    });
  });

  it('keeps unmatched ingredients as quantity + unit in the pantry aisle', () => {
    const items = allItems(GroceryAggregator.aggregate(plan(['monday', 'tuesday']), recipes, 2, [], analyze));
    const paste = items.find((i) => i.name === 'xyzzy paste');
    assert.ok(paste);
    assert.equal(paste.aisle, PANTRY);
    assert.equal(paste.qty, 4); // 2 tbsp × 2 days × (2 people / 2 servings)
    assert.equal(paste.amount, '4 tbsp');
  });

  it('adds selected supplements as "check supply" items', () => {
    const groups = GroceryAggregator.aggregate({}, recipes, 1, ['iron', 'vitaminD3'], analyze);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].aisle, SPICES);
    assert.deepEqual(groups[0].items.map((i) => [i.key, i.name, i.amount]), [
      ['s:iron', 'Iron', 'check supply'],
      ['s:vitaminD3', 'Vitamin D3', 'check supply'],
    ]);
  });

  it('groups by aisle in AISLES order and sorts items by name', () => {
    const groups = GroceryAggregator.aggregate(plan(['monday']), recipes, 1, ['zinc', 'calcium'], analyze);
    const order = groups.map((g) => AISLES.indexOf(g.aisle));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    groups.forEach((g) => {
      const names = g.items.map((i) => i.name);
      assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
      g.items.forEach((i) => assert.equal(typeof i.amount, 'string'));
    });
  });
});

describe('GroceryAggregator.aggregate with restrictions', () => {
  const profile = (overrides) => ({ diet: 'omnivore', allergies: [], ...overrides });
  const screened = (p) => (recipe) => SubstitutionEngine.screen(recipe, p);
  const MILKY = { id: 'r-milk', title: 'Milky oats', servings: 1, ingredientsText: '1 cup milk\n50 g butter\n100 g spinach' };
  const SWEET = { id: 'r-sweet', title: 'Sweet', servings: 1, ingredientsText: '2 tbsp maple syrup\n100 g spinach' };
  const library = new Map([[MILKY.id, MILKY], [SWEET.id, SWEET]]);

  it('calls the analyzer for each planned slot', () => {
    const seen = [];
    GroceryAggregator.aggregate({ monday: { lunch: MILKY.id, dinner: SWEET.id } }, library, 1, [], (recipe) => {
      seen.push(recipe.id);
      return analyze(recipe);
    });
    assert.deepEqual(seen.sort(), [MILKY.id, SWEET.id]);
  });

  it('buys substitutes instead of the originals and records what they replace', () => {
    const items = allItems(GroceryAggregator.aggregate({ monday: { lunch: MILKY.id } }, library, 1, [], screened(profile({ allergies: ['dairy'] }))));
    const keys = items.map((i) => i.key);
    assert.ok(!keys.includes('milk') && !keys.includes('butter'), 'dairy is not bought');
    const soy = items.find((i) => i.key === 'soy-milk');
    const oil = items.find((i) => i.key === 'olive-oil');
    assert.ok(soy && oil);
    assert.deepEqual([...soy.replaces], [FOOD_DB.milk.name.toLowerCase()]);
    assert.deepEqual([...oil.replaces], [FOOD_DB.butter.name.toLowerCase()]);
    assert.ok(Math.abs(oil.grams - 50 * 0.75) < 1e-9, 'gramRatio scales the bought amount');
    assert.equal(items.find((i) => i.key === 'spinach').replaces.size, 0);
  });

  it('merges a substitute with the same food bought directly', () => {
    const both = { ...MILKY, id: 'r-both', ingredientsText: '1 cup milk\n1 cup soy milk' };
    const items = allItems(GroceryAggregator.aggregate({ monday: { lunch: both.id } }, new Map([[both.id, both]]), 1, [], screened(profile({ allergies: ['dairy'] }))));
    const soy = items.filter((i) => i.key === 'soy-milk');
    assert.equal(soy.length, 1);
    assert.ok(Math.abs(soy[0].grams - (244 + 243)) < 1e-9, `${soy[0].grams} g`);
    assert.deepEqual([...soy[0].replaces], [FOOD_DB.milk.name.toLowerCase()]);
  });

  it('leaves omitted ingredients off the list', () => {
    const items = allItems(GroceryAggregator.aggregate({ monday: { lunch: SWEET.id } }, library, 1, [], screened(profile({ diet: 'keto' }))));
    assert.deepEqual(items.map((i) => i.key), ['spinach']);
  });

  it('skips recipes that are unsafe for the profile', () => {
    // Dairy + soy + tree nut allergies on keto (no grains): no milk substitute is safe.
    const strict = profile({ diet: 'keto', allergies: ['dairy', 'soy', 'tree_nuts'] });
    assert.equal(SubstitutionEngine.screen(MILKY, strict).isSafe, false);
    const groups = GroceryAggregator.aggregate({ monday: { lunch: MILKY.id, dinner: SWEET.id } }, library, 1, ['iron'], screened(strict));
    const keys = allItems(groups).map((i) => i.key);
    assert.deepEqual(keys.sort(), ['s:iron', 'spinach'], 'only the safe recipe and the supplement remain');
    assert.ok(Math.abs(allItems(groups).find((i) => i.key === 'spinach').grams - 100) < 1e-9);
  });

  it('formats substitutes with their own food data', () => {
    const items = allItems(GroceryAggregator.aggregate({ monday: { lunch: MILKY.id } }, library, 1, [], screened(profile({ allergies: ['dairy'] }))));
    assert.equal(items.find((i) => i.key === 'soy-milk').name, FOOD_DB['soy-milk'].name);
  });
});

describe('GroceryAggregator.formatAmount', () => {
  it('formats weights in grams and kilograms', () => {
    assert.equal(GroceryAggregator.formatAmount({ grams: 3.4, food: {} }), '3 g');
    assert.equal(GroceryAggregator.formatAmount({ grams: 0.2, food: {} }), '1 g');
    assert.equal(GroceryAggregator.formatAmount({ grams: 123, food: {} }), '125 g');
    assert.equal(GroceryAggregator.formatAmount({ grams: 1234, food: {} }), '1.2 kg');
  });

  it('adds a count for countable foods', () => {
    assert.equal(GroceryAggregator.formatAmount({ grams: 250, food: { count: 'pcs', gPerUnit: 100 } }), '3 pcs (250 g)');
    assert.equal(GroceryAggregator.formatAmount({ grams: 800, food: { count: 'cans', gPerCan: 400 } }), '2 cans (800 g)');
  });

  it('formats unmatched quantities with or without a unit', () => {
    assert.equal(GroceryAggregator.formatAmount({ qty: 1.5, unit: 'cup' }), '1.5 cup');
    assert.equal(GroceryAggregator.formatAmount({ qty: 2, unit: null }), '2×');
    assert.equal(GroceryAggregator.formatAmount({ qty: 1 / 3, unit: 'unit' }), '0.33×');
  });
});
