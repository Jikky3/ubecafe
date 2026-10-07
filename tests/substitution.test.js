import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SubstitutionEngine } from '../js/engines/substitution.js';
import { RecipeManager } from '../js/engines/recipe-manager.js';
import { FOOD_DB } from '../js/data/foods.js';
import { DIETS, SUBSTITUTES } from '../js/data/restrictions.js';
import { scaleNutrients } from '../js/util.js';

const profile = (overrides = {}) => ({ diet: 'omnivore', allergies: [], ...overrides });
const recipe = (ingredientsText, servings = 1) => ({ id: `r-${ingredientsText}`, title: 'Test', servings, ingredientsText, instructions: '' });
const close = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${label} ${actual} vs ${expected}`);
const nutrientsClose = (actual, expected) => Object.keys(expected).forEach((k) => close(actual[k], expected[k], k));
const pick = (restriction, foodId, active) => SubstitutionEngine.pickSubstitute(restriction, foodId, active)?.foodId;

describe('SubstitutionEngine.restrictionsFor', () => {
  it('is empty for an omnivore without allergies', () => {
    assert.deepEqual(SubstitutionEngine.restrictionsFor(profile()), []);
  });

  it('combines chosen allergies with the diet exclusions', () => {
    assert.deepEqual(
      SubstitutionEngine.restrictionsFor(profile({ diet: 'vegetarian', allergies: ['peanuts', 'gluten'] })),
      ['peanuts', 'gluten', 'meat', 'fish', 'shellfish'],
    );
    assert.deepEqual(SubstitutionEngine.restrictionsFor(profile({ diet: 'keto' })), DIETS.keto.excludes);
  });

  it('lists a restriction once when an allergy overlaps the diet', () => {
    const active = SubstitutionEngine.restrictionsFor(profile({ diet: 'vegan', allergies: ['dairy', 'eggs'] }));
    assert.equal(active.filter((t) => t === 'dairy').length, 1);
    assert.deepEqual([...active].sort(), [...DIETS.vegan.excludes].sort());
  });
});

describe('SubstitutionEngine.detect', () => {
  it('uses the dictionary tags for matched foods', () => {
    assert.deepEqual(SubstitutionEngine.detect({ foodId: 'tofu', name: 'firm tofu' }), ['soy', 'legumes']);
    assert.deepEqual(SubstitutionEngine.detect({ foodId: 'honey', name: 'honey' }), ['honey', 'sugar']);
  });

  it('trusts the dictionary over keywords in the line', () => {
    // "cream" would hit the dairy keyword, but a matched food uses only its tags.
    assert.deepEqual(SubstitutionEngine.detect({ foodId: 'spinach', name: 'creamed spinach with bacon' }), []);
  });

  it('falls back to keywords for unmatched ingredients', () => {
    assert.deepEqual(SubstitutionEngine.detect({ foodId: null, name: 'Cashew Cream' }), ['tree_nuts', 'dairy']);
    assert.deepEqual(SubstitutionEngine.detect({ foodId: null, name: 'smoked bacon' }), ['meat']);
    assert.deepEqual(SubstitutionEngine.detect({ foodId: null, name: 'panko breadcrumbs' }), ['gluten']);
    assert.deepEqual(SubstitutionEngine.detect({ foodId: null, name: 'xyzzy paste' }), []);
  });

  it('matches whole keywords, with plurals, not substrings', () => {
    assert.deepEqual(SubstitutionEngine.detect({ foodId: null, name: 'two scallops' }), ['shellfish']);
    assert.ok(!SubstitutionEngine.detect({ foodId: null, name: 'hamburger buns' }).includes('meat'), '"ham" inside a word');
  });
});

describe('SubstitutionEngine.pickSubstitute', () => {
  it('prefers a food-specific option', () => {
    assert.equal(pick('dairy', 'cheddar', ['dairy']), 'nutritional-yeast');
    assert.equal(pick('dairy', 'butter', ['dairy']), 'olive-oil');
    assert.equal(pick('peanuts', 'peanut-butter', ['peanuts']), 'sunflower-butter');
    assert.equal(pick('gluten', 'bread', ['gluten']), 'gf-bread');
  });

  it('uses generic options for other foods and never another food\'s specific swap', () => {
    assert.equal(pick('peanuts', null, ['peanuts']), 'pumpkin-seeds');
    assert.equal(pick('dairy', 'milk', ['dairy']), 'soy-milk');
    assert.equal(pick('gluten', 'pasta', ['gluten']), 'gf-pasta');
    assert.equal(pick('gluten', null, ['gluten']), 'quinoa');
  });

  it('skips options that conflict with another active restriction', () => {
    // Tree nut + dairy allergies: almond milk must never stand in for milk.
    assert.equal(pick('dairy', 'milk', ['tree_nuts', 'dairy']), 'soy-milk');
    assert.equal(pick('dairy', 'milk', ['tree_nuts', 'dairy', 'soy']), 'oat-milk');
    assert.equal(pick('dairy', 'milk', ['dairy', 'soy', 'grains']), 'almond-milk');
    assert.equal(pick('dairy', 'milk', ['dairy', 'soy', 'grains', 'tree_nuts']), undefined);
  });

  it('falls through food-specific options to generic ones when all are unsafe', () => {
    assert.equal(pick('tree_nuts', 'almond-milk', ['tree_nuts']), 'oat-milk');
    assert.equal(pick('tree_nuts', 'almond-milk', ['tree_nuts', 'grains']), 'soy-milk');
    assert.equal(pick('tree_nuts', 'almond-milk', ['tree_nuts', 'grains', 'soy']), 'sunflower-seeds');
    assert.equal(pick('shellfish', 'shrimp', ['meat', 'fish', 'shellfish']), 'tofu');
  });

  it('returns an omit option (foodId null) as always safe', () => {
    const sub = SubstitutionEngine.pickSubstitute('honey', 'honey', ['honey', 'sugar']);
    assert.equal(sub.foodId, null, 'maple syrup is a sugar, so honey is omitted');
    assert.equal(pick('honey', 'honey', ['honey']), 'maple-syrup');
    assert.equal(SubstitutionEngine.pickSubstitute('sugar', 'maple-syrup', ['sugar']).foodId, null);
  });

  it('returns null when there is no option at all', () => {
    assert.equal(SubstitutionEngine.pickSubstitute('nonexistent', 'milk', ['nonexistent']), null);
    assert.equal(SubstitutionEngine.pickSubstitute('dairy', 'milk', ['dairy', 'soy', 'grains', 'tree_nuts']), null);
  });

  it('every substitute in the table links to a real food', () => {
    Object.entries(SUBSTITUTES).forEach(([restriction, options]) => options.forEach((o) => {
      assert.ok(o.foodId === null || FOOD_DB[o.foodId], `${restriction}: ${o.foodId}`);
      assert.ok(o.foodId === null || !FOOD_DB[o.foodId].tags.includes(restriction), `${o.foodId} violates ${restriction}`);
      assert.equal(typeof o.gramRatio, 'number');
    }));
  });
});

describe('SubstitutionEngine.screen', () => {
  it('returns the plain analysis when nothing is restricted', () => {
    const r = recipe('1 cup milk\n100 g spinach');
    const result = SubstitutionEngine.screen(r, profile());
    assert.equal(result.isSafe, true);
    assert.deepEqual(result.flagged, []);
    assert.equal(result.ingredients, RecipeManager.analyze(r).ingredients);
  });

  it('swaps a restricted ingredient, scaling grams by gramRatio and recomputing nutrients', () => {
    const r = recipe('100 g butter\n100 g spinach', 2);
    const result = SubstitutionEngine.screen(r, profile({ allergies: ['dairy'] }));
    const [oil, spinach] = result.ingredients;
    assert.equal(oil.foodId, 'olive-oil');
    close(oil.grams, 75);
    nutrientsClose(oil.nutrients, scaleNutrients(FOOD_DB['olive-oil'].nutrients, 0.75));
    assert.equal(oil.swappedFrom, 'Butter');
    assert.equal(oil.raw, '100 g butter', 'the original line is kept for display');
    assert.equal(spinach, RecipeManager.analyze(r).ingredients[1], 'safe ingredients pass through');

    const expectedTotals = Object.fromEntries(Object.keys(oil.nutrients).map((k) => [k, oil.nutrients[k] + spinach.nutrients[k]]));
    nutrientsClose(result.totals, expectedTotals);
    nutrientsClose(result.perServing, scaleNutrients(expectedTotals, 0.5));
    assert.equal(result.isSafe, true);
  });

  it('describes each flagged ingredient', () => {
    const result = SubstitutionEngine.screen(recipe('100 g butter'), profile({ allergies: ['dairy'] }));
    assert.deepEqual(result.flagged, [{
      raw: '100 g butter',
      original: 'Butter',
      hits: ['dairy'],
      isAllergy: true,
      substitute: { name: FOOD_DB['olive-oil'].name, ratio: '3/4 the amount', note: SUBSTITUTES.dairy[1].note },
    }]);
  });

  it('marks diet conflicts as not allergies', () => {
    const result = SubstitutionEngine.screen(recipe('200 g chicken breast'), profile({ diet: 'vegetarian' }));
    assert.equal(result.flagged[0].isAllergy, false);
    assert.equal(result.ingredients[0].foodId, 'tofu');
  });

  it('zeros an ingredient whose substitute is "Omit"', () => {
    const result = SubstitutionEngine.screen(recipe('2 tbsp maple syrup\n100 g spinach'), profile({ diet: 'keto' }));
    const [syrup] = result.ingredients;
    assert.equal(syrup.omitted, true);
    assert.equal(syrup.grams, 0);
    assert.ok(Object.values(syrup.nutrients).every((v) => v === 0));
    assert.equal(syrup.swappedFrom, 'Maple syrup');
    assert.equal(result.flagged[0].substitute.name, 'Omit');
    assert.equal(result.isSafe, true);
    nutrientsClose(result.totals, result.ingredients[1].nutrients);
  });

  it('screens unmatched ingredients by keyword', () => {
    const result = SubstitutionEngine.screen(recipe('50 g cashew cream'), profile({ allergies: ['tree_nuts'] }));
    const [ing] = result.ingredients;
    assert.equal(ing.foodId, 'sunflower-seeds');
    close(ing.grams, 50);
    assert.equal(ing.swappedFrom, 'cashew cream');
    assert.deepEqual(result.flagged[0].hits, ['tree_nuts'], 'only active restrictions are reported');
  });

  it('marks a recipe unsafe when an allergen has no safe option', () => {
    const strict = profile({ diet: 'keto', allergies: ['dairy', 'soy', 'tree_nuts'] });
    const result = SubstitutionEngine.screen(recipe('1 cup milk\n100 g spinach'), strict);
    assert.equal(result.isSafe, false);
    assert.equal(result.flagged[0].substitute, null);
    assert.equal(result.ingredients[0].blocked, true);
    assert.ok(Object.values(result.ingredients[0].nutrients).every((v) => v === 0));
  });

  it('applies the conflict check inside a recipe: tree nuts + dairy never yields almond milk', () => {
    const result = SubstitutionEngine.screen(recipe('1 cup milk\n1 cup almond milk'), profile({ allergies: ['tree_nuts', 'dairy'] }));
    const ids = result.ingredients.map((i) => i.foodId);
    assert.ok(!ids.includes('almond-milk'), ids.join());
    assert.deepEqual(ids, ['soy-milk', 'oat-milk']);
    assert.equal(result.isSafe, true);
  });

  it('does not change the cached recipe analysis', () => {
    const r = recipe('100 g butter');
    const before = structuredClone(RecipeManager.analyze(r));
    SubstitutionEngine.screen(r, profile({ allergies: ['dairy'] }));
    assert.deepEqual(RecipeManager.analyze(r), before);
  });

  it('memoizes results per recipe and restriction set', () => {
    const r = recipe('100 g butter\n1 tsp honey');
    const a = SubstitutionEngine.screen(r, profile({ allergies: ['dairy', 'peanuts'] }));
    assert.equal(SubstitutionEngine.screen(r, profile({ allergies: ['peanuts', 'dairy'] })), a, 'order does not matter');
    const vegan = SubstitutionEngine.screen(r, profile({ diet: 'vegan' }));
    assert.notEqual(vegan, a);
    assert.equal(vegan.ingredients[1].foodId, 'maple-syrup');
    assert.equal(a.ingredients[1].foodId, 'honey');
    assert.equal(SubstitutionEngine.screen(r, profile({ diet: 'vegan' })), vegan);
    assert.notEqual(SubstitutionEngine.screen({ ...r }, profile({ allergies: ['dairy', 'peanuts'] })), a, 'a new recipe object is screened again');
  });
});

describe('SubstitutionEngine.badge', () => {
  it('labels allergens with an icon, text and a screen-reader prefix', () => {
    const html = SubstitutionEngine.badge(['dairy', 'tree_nuts']);
    assert.match(html, /^<span class="badge badge--warn">/);
    assert.match(html, /<span aria-hidden="true">!<\/span>/);
    assert.match(html, /<span class="sr-only">Allergen warning:<\/span> Dairy, Tree nuts<\/span>$/);
  });

  it('labels diet conflicts differently', () => {
    assert.match(SubstitutionEngine.badge(['meat'], { isAllergy: false }), /<span class="sr-only">Diet conflict:<\/span> Meat & poultry<\/span>$/);
  });

  it('uses the danger style and a cross for blocked ingredients', () => {
    const html = SubstitutionEngine.badge(['soy'], { blocked: true });
    assert.match(html, /badge--danger/);
    assert.match(html, /<span aria-hidden="true">✕<\/span>/);
    assert.match(html, /sr-only">Allergen warning:/);
  });
});
