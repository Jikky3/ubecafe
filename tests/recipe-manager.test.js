// Quantity / unit checks first (independent of which food a line matches), then the
// food-matching rules ported from the Phase 1 food table work.
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE_MATCH, RecipeManager } from '../js/engines/recipe-manager.js';
import { SEED_RECIPES } from '../js/data/seeds.js';

const parse = (line, matches) => RecipeManager.parseIngredientLine(line, matches);

describe('RecipeManager quantities and units', () => {
  it('reads mixed numbers and plural units', () => {
    const line = parse('1 1/2 cups rolled oats');
    assert.equal(line.qty, 1.5);
    assert.equal(line.unit, 'cup');
  });

  it('reads Unicode fractions, alone and after a whole number', () => {
    assert.equal(parse('½ cup milk').qty, 0.5);
    assert.equal(parse('½ cup milk').unit, 'cup');
    assert.equal(parse('1 ½ cups milk').qty, 1.5);
  });

  it('uses a parenthesized package size: "1 (15 oz) can"', () => {
    const line = parse('1 (15 oz) can black beans');
    assert.equal(line.qty, 1);
    assert.ok(Math.abs(line.grams - 15 * 28.35) < 0.01, `got ${line.grams} g`);
    assert.doesNotMatch(line.name, /\(|oz|^can\b/);
  });

  it('uses the drained can weight instead of the label weight for drained cans', () => {
    const line = parse('1 (15 oz) can black beans, drained');
    assert.equal(line.qty, 1);
    assert.equal(line.grams, line.food.portions.can);
    assert.ok(line.grams < 15 * 28.35, 'the label weight includes the liquid');
    assert.doesNotMatch(line.name, /\(|oz|^can\b/);
  });

  it('converts weights directly to grams', () => {
    assert.equal(parse('250 g chicken breast').grams, 250);
    assert.equal(parse('2 tsp xyzzy').unit, 'tsp');
  });

  it('strips list markers', () => {
    assert.equal(parse('- 3/4 cup quinoa').qty, 0.75);
    assert.equal(parse('2. 2 tbsp olive oil').qty, 2);
  });
});

describe('RecipeManager amounts', () => {
  it('averages quantity ranges', () => {
    assert.equal(parse('2-4 cups spinach').qty, 3);
    assert.equal(parse('1 to 2 tbsp olive oil').qty, 1.5);
  });

  it('defaults to one unit when no quantity is given', () => {
    const line = parse('xyzzy');
    assert.equal(line.qty, 1);
    assert.equal(line.unit, null);
    assert.equal(line.foodId, null);
    assert.ok(Object.values(line.nutrients).every((v) => v === 0), 'unmatched lines carry no nutrients');
  });

  it('converts metric volumes and weights', () => {
    assert.equal(RecipeManager.toGrams(null, 1, 'kg'), 1000);
    assert.equal(RecipeManager.toGrams(null, 240, 'ml'), 240); // water density without a food
    assert.equal(RecipeManager.toGrams({ gPerCup: 120 }, 1, 'tbsp'), 7.5);
    assert.equal(RecipeManager.toGrams(null, 1, 'can'), 400);
  });
});

describe('RecipeManager.analyze', () => {
  it('totals ingredients, divides per serving and counts unmatched lines', () => {
    const recipe = { servings: 2, ingredientsText: '250 g chicken breast\n\n2 tbsp xyzzy paste' };
    const result = RecipeManager.analyze(recipe);
    assert.equal(result.ingredients.length, 2, 'blank lines are skipped');
    assert.equal(result.unmatched, 1);
    Object.keys(result.totals).forEach((k) => {
      assert.ok(Math.abs(result.perServing[k] - result.totals[k] / 2) < 1e-9, k);
    });
  });

  it('treats missing or invalid servings as one', () => {
    const result = RecipeManager.analyze({ servings: 0, ingredientsText: '100 g chicken breast' });
    assert.deepEqual(result.perServing, result.totals);
  });

  it('memoizes per recipe object', () => {
    const recipe = { servings: 1, ingredientsText: '100 g chicken breast' };
    assert.equal(RecipeManager.analyze(recipe), RecipeManager.analyze(recipe));
    assert.notEqual(RecipeManager.analyze({ ...recipe }), RecipeManager.analyze(recipe));
  });
});

describe('RecipeManager.parseRecipeText', () => {
  it('splits title, servings, ingredients and instructions', () => {
    const parsed = RecipeManager.parseRecipeText([
      'Title: Lentil Soup',
      'Serves 4',
      'Ingredients:',
      '- 1 cup red lentils',
      '• 4 cups vegetable broth',
      'Directions',
      '1. Simmer 20 minutes.',
    ].join('\n'));
    assert.equal(parsed.title, 'Lentil Soup');
    assert.equal(parsed.servings, 4);
    assert.equal(parsed.ingredientsText, '1 cup red lentils\n4 cups vegetable broth');
    assert.equal(parsed.instructions, 'Simmer 20 minutes.');
  });

  it('uses the first loose line as the title and defaults to one serving', () => {
    const parsed = RecipeManager.parseRecipeText('Morning Oats\nIngredients\n1/2 cup oats');
    assert.equal(parsed.title, 'Morning Oats');
    assert.equal(parsed.servings, 1);
    assert.equal(parsed.ingredientsText, '1/2 cup oats');
    assert.equal(parsed.instructions, '');
  });
});

// ---------- Food matching (Phase 1 food table) ----------

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} not within ${tolerance} of ${expected}`);

test('ROADMAP failing cases now match the right food', () => {
  const cases = [
    ['2 cups cooked brown rice', 'brown-rice-cooked'],
    ['1 tbsp butter beans', 'lima-beans-cooked'],
    ['1 tsp red pepper flakes', 'red-pepper-flakes'],
    ['1 cup almond milk', 'almond-milk'],
    ['1 cup coconut milk', 'coconut-milk'],
    ['4 oz feta', 'feta'],
    ['1 tbsp maple syrup', 'maple-syrup'],
    ['1 lb ground turkey', 'ground-turkey'],
  ];
  cases.forEach(([line, id]) => assert.equal(parse(line).foodId, id, line));
});

test('ROADMAP cases produce sensible energy', () => {
  near(parse('2 cups cooked brown rice').nutrients.calories, 433, 30, 'cooked brown rice');
  near(parse('1 cup coconut milk').nutrients.calories, 445, 30, 'coconut milk');
  assert.ok(parse('1 tbsp butter beans').nutrients.calories < 20, 'butter beans are not butter');
  near(parse('1 lb ground turkey').nutrients.calories, 680, 20, 'ground turkey');
  assert.equal(parse('1 cup almond milk').nutrients.vitaminB12, 0, 'almond milk has no dairy B12');
});

test('other conflations are split', () => {
  [
    ['1 cup oat milk', 'oat-milk'], ['1 cup soy milk', 'soy-milk'], ['1 cup milk', 'milk'], ['1 cup whole milk', 'whole-milk'],
    ['1/4 cup cheddar cheese', 'cheddar'], ['1/2 cup crumbled feta cheese', 'feta'], ['1 tbsp honey', 'honey'],
    ['1 lime', 'lime'], ['2 tbsp lime juice', 'lime-juice'], ['1 lemon', 'lemon'], ['1 tbsp lemon juice', 'lemon-juice'],
    ['1 red bell pepper', 'bell-pepper'], ['1 green bell pepper', 'bell-pepper-green'], ['1 tsp crushed red pepper', 'red-pepper-flakes'],
    ['1 tsp chili flakes', 'red-pepper-flakes'], ['1/2 tsp cayenne pepper', 'red-pepper-flakes'],
    ['1 jalapeño, minced', 'jalapeno'], ['2 jalapeno peppers', 'jalapeno'],
    ['2 tbsp butter', 'butter'], ['1 stick unsalted butter', 'butter-unsalted'], ['1 cup lima beans', 'lima-beans-cooked'],
  ].forEach(([line, id]) => assert.equal(parse(line).foodId, id, line));
});

test('longest alias wins and product words block false hits', () => {
  [
    ['2 tbsp peanut butter', 'peanut-butter'], ['2 tbsp almond butter', 'almond-butter'],
    ['1 tbsp extra virgin olive oil', 'olive-oil'], ['1 cup cherry tomatoes', 'tomato'],
    ['1 cup cauliflower rice', 'cauliflower'], ['2 egg whites', 'egg-white'], ['3 large eggs', 'eggs'],
    ['1 tbsp apple cider vinegar', 'cider-vinegar'], ['1 cup sweet potato', 'sweet-potato'],
    ['2 tbsp sunflower seed butter', 'sunflower-butter'], ['1 cup gluten free pasta', 'gf-pasta'],
    ['1 cup chicken broth', 'chicken-broth'], ['1/2 tsp salt', 'salt'], ['1/2 tsp black pepper', 'black-pepper'],
  ].forEach(([line, id]) => assert.equal(parse(line).foodId, id, line));

  // Distinct products with no row stay unmatched instead of borrowing a wrong one.
  ['1 cup almond flour', '1 cup rice milk', '8 oz egg noodles', '1 tbsp cashew butter', '1 banana pepper', '2 peppers',
    '1 cup tomato sauce', '1 cup light coconut milk', '1 tsp onion powder', '1 tbsp butter lettuce'].forEach((line) => {
    assert.equal(parse(line).foodId, null, line);
  });
});

test('regex metacharacters and accents in lines are harmless', () => {
  assert.equal(parse('1 cup (packed) spinach [fresh]*').foodId, 'spinach');
  assert.equal(parse('2 tbsp c++ sauce?').foodId, null);
  assert.equal(parse('1 JALAPEÑO').foodId, 'jalapeno');
});

test('cooked / dry / canned detection picks the state variant', () => {
  [
    ['1 cup rice', 'white-rice-dry'], ['1 cup cooked rice', 'white-rice-cooked'], ['1 cup basmati rice, cooked', 'white-rice-cooked'],
    ['1/2 cup quinoa', 'quinoa'], ['1 cup cooked quinoa', 'quinoa-cooked'], ['1 cup uncooked brown rice', 'brown-rice'],
    ['8 oz spaghetti', 'pasta'], ['2 cups cooked penne', 'pasta-cooked'],
    ['1 cup red lentils', 'lentils'], ['1 cup cooked lentils', 'lentils-cooked'], ['1 cup boiled lentils', 'lentils-cooked'],
    ['1 can black beans, drained', 'black-beans'], ['1 cup dried black beans', 'black-beans-dry'], ['1 cup dry chickpeas', 'chickpeas-dry'],
    ['1 cup chickpeas', 'chickpeas'], ['1 lb dried butter beans', 'lima-beans-dry'],
    ['2 cups grilled chicken', 'chicken-cooked'], ['300 g chicken breast', 'chicken'],
    ['1 can diced tomatoes', 'tomato-canned'], ['2 tomatoes', 'tomato'], ['1 cup cooked oatmeal', 'oats-cooked'],
  ].forEach(([line, id]) => assert.equal(parse(line).foodId, id, line));
  assert.equal(RecipeManager.detectState('1 cup uncooked rice'), 'dry');
  assert.equal(RecipeManager.detectState('1 cup dry rice, cooked'), 'dry', 'earliest state word wins');
  assert.equal(RecipeManager.detectState('beans', 'can'), 'canned');
  assert.equal(RecipeManager.detectState('beans'), null);
});

test('weights: cups, cans, packages and "to taste"', () => {
  near(parse('1 cup cooked brown rice').grams, 195, 0.01, 'cup of cooked rice');
  near(parse('1 can black beans, drained').grams, 240, 0.01, 'drained can');
  near(parse('1 (15 oz) can chickpeas, drained').grams, 240, 0.01, 'drained package uses drained weight');
  near(parse('1 (14.5 oz) can diced tomatoes').grams, 411, 1, 'package weight');
  near(parse('salt to taste').grams, 0.4, 0.01, 'to taste is a pinch');
  near(parse('1/2 tsp salt').nutrients.sodium, 1163, 5, 'sodium in 1/2 tsp salt');
});

test('user overrides and ignored lines', () => {
  const line = '1 tbsp gochujang, divided';
  const auto = parse(line);
  assert.equal(auto.foodId, null);
  assert.equal(auto.key, 'gochujang');
  const picked = parse(line, { gochujang: 'ketchup' });
  assert.equal(picked.foodId, 'ketchup');
  assert.equal(picked.matchSource, 'user');
  const ignored = parse(line, { gochujang: IGNORE_MATCH });
  assert.equal(ignored.matchSource, 'ignored');
  assert.equal(ignored.nutrients.calories, 0);
  // An override can also correct an automatic match; unknown ids fall back to automatic.
  assert.equal(parse('1 cup milk', { milk: 'oat-milk' }).foodId, 'oat-milk');
  assert.equal(parse('1 cup milk', { milk: 'custom-gone' }).foodId, 'milk');
});

test('analyze counts unmatched lines and honours recipe.matches and custom foods', () => {
  const recipe = { servings: 2, ingredientsText: '1 cup cooked rice\n1 tbsp gochujang\n1 cup ice' };
  const before = RecipeManager.analyze(recipe);
  assert.equal(before.unmatched, 2);
  assert.deepEqual(before.unmatchedLines.map((l) => l.key), ['gochujang', 'ice']);

  RecipeManager.setCustomFoods([{ id: 'custom-g', name: 'Gochujang', nutrients: { calories: 200, sodium: 2400 } }]);
  try {
    const after = RecipeManager.analyze({ ...recipe, matches: { gochujang: 'custom-g', ice: IGNORE_MATCH } });
    assert.equal(after.unmatched, 0);
    const tbsp = 240 / 16;
    near(after.totals.sodium, (2400 * tbsp) / 100 + 1, 1, 'custom sodium counted');
    near(after.perServing.calories, (130 * 1.58 + (200 * tbsp) / 100) / 2, 1, 'per serving');
    assert.equal(RecipeManager.getFood('custom-g').name, 'Gochujang');
  } finally {
    RecipeManager.setCustomFoods([]);
  }
  assert.equal(RecipeManager.getFood('custom-g'), null);
});

test('every seed recipe is fully matched', () => {
  SEED_RECIPES.forEach((recipe) => {
    const { unmatched, ingredients } = RecipeManager.analyze(recipe);
    assert.equal(unmatched, 0, `${recipe.title}: ${ingredients.filter((i) => !i.foodId).map((i) => i.raw).join(', ')}`);
  });
});

test('seed recipes keep plausible per-serving energy', () => {
  SEED_RECIPES.forEach((recipe) => {
    const kcal = RecipeManager.analyze(recipe).perServing.calories;
    assert.ok(kcal > 150 && kcal < 1000, `${recipe.title}: ${kcal}`);
  });
});
