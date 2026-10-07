import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecipeMatcher } from '../js/engines/recipe-match.js';
import { NUTRIENT_KEYS } from '../js/data/nutrients.js';

const nutrients = (values) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, values[k] ?? 0]));
const recipe = (id, ingredientsText, servings = 1) => ({ id, title: id, servings, ingredientsText, instructions: '' });

test('gap reports remaining amount for a target below intake', () => {
  const g = RecipeMatcher.gap('iron', nutrients({ iron: 6 }), nutrients({ iron: 18 }));
  assert.equal(g.direction, 'increase');
  assert.equal(g.remaining, 12);
  assert.equal(g.pct, 33);
});

test('gap treats limits and overshoots as decrease', () => {
  const sugar = RecipeMatcher.gap('sugar', nutrients({ sugar: 60 }), nutrients({ sugar: 50 }));
  assert.equal(sugar.direction, 'decrease');
  assert.equal(sugar.over, 10);
  const calories = RecipeMatcher.gap('calories', nutrients({ calories: 2500 }), nutrients({ calories: 2000 }));
  assert.equal(calories.direction, 'decrease');
});

test('contributors orders planned meals by amount and reports their share', () => {
  const meals = {
    breakfast: { recipe: { id: 'a' }, nutrients: nutrients({ iron: 1 }) },
    lunch: { recipe: { id: 'b' }, nutrients: nutrients({ iron: 3 }) },
    snack: null,
    dinner: { recipe: { id: 'c' }, nutrients: nutrients({ iron: 0 }) },
  };
  const top = RecipeMatcher.contributors(meals, 'iron');
  assert.deepEqual(top.map((t) => t.slotId), ['lunch', 'breakfast']);
  assert.equal(top[0].share, 0.75);
});

test('rankRecipes favours the richest recipes and lists planned ones last', () => {
  const recipes = [
    recipe('spinach', '300 g spinach'),
    recipe('lentils', '100 g lentils'),
    recipe('apple', '1 apple'),
  ];
  const ranked = RecipeMatcher.rankRecipes(recipes, 'iron', { direction: 'increase', target: 18, limit: 3 });
  assert.equal(ranked[0].recipe.id, 'spinach');
  const varied = RecipeMatcher.rankRecipes(recipes, 'iron', { direction: 'increase', target: 18, excludeIds: ['spinach'], limit: 3 });
  assert.equal(varied.at(-1).recipe.id, 'spinach');
});

test('rankRecipes for a limit prefers the lowest meal-sized recipe', () => {
  const recipes = [
    recipe('sweet', '100 g honey\n100 g oats'),
    recipe('plain', '150 g oats'),
    recipe('tiny', '1 tsp honey'),
  ];
  const ranked = RecipeMatcher.rankRecipes(recipes, 'sugar', { direction: 'decrease', target: 50 });
  assert.equal(ranked[0].recipe.id, 'plain');
  assert.ok(!ranked.some((r) => r.recipe.id === 'tiny'), 'snacks under 150 kcal are not meal swaps');
});

test('highlights lists micronutrients and protein at 20 % or more, never limits or carbs', () => {
  const targets = nutrients({ iron: 10, vitaminC: 100, protein: 50, carbs: 100, sugar: 10, fiber: 30 });
  const h = RecipeMatcher.highlights(nutrients({ iron: 5, vitaminC: 10, protein: 20, carbs: 90, sugar: 20, fiber: 6 }), targets);
  assert.deepEqual(h.map((x) => x.key), ['iron', 'protein', 'fiber']);
});
