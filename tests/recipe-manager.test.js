// Basic quantity / unit sanity checks only. Food matching and nutrient values are
// covered by the food-database tests, so nothing here depends on which food a line matches.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecipeManager } from '../js/engines/recipe-manager.js';

const parse = (line) => RecipeManager.parseIngredientLine(line);

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
    const line = parse('1 (15 oz) can black beans, drained');
    assert.equal(line.qty, 1);
    assert.ok(Math.abs(line.grams - 15 * 28.35) < 0.01, `got ${line.grams} g`);
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
