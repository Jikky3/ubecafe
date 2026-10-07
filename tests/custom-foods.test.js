import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/local-storage.js';
import { Storage } from '../js/storage.js';
import { exportUserData, loadUserData, saveCustomFoods, state } from '../js/state.js';
import { RecipeManager } from '../js/engines/recipe-manager.js';
import { GroceryAggregator } from '../js/engines/grocery.js';
import { SubstitutionEngine } from '../js/engines/substitution.js';

const GOCHUJANG = { id: 'custom-g', name: 'Gochujang', nutrients: { calories: 200, sodium: 2400 }, gPerUnit: null, gPerCup: 280 };

beforeEach(async () => {
  await Storage.init({ indexedDB: null, localStorage: installLocalStorage() });
  Storage.scope = 'ana@example.com';
});

afterEach(() => {
  RecipeManager.setCustomFoods([]);
  Storage.scope = null;
});

describe('custom foods in user data', () => {
  it('loads saved custom foods and registers them with the RecipeManager', () => {
    Storage.save(Storage.KEYS.customFoods, [GOCHUJANG]);
    const data = loadUserData();
    assert.deepEqual(data.customFoods, [GOCHUJANG]);
    assert.equal(RecipeManager.getFood('custom-g').name, 'Gochujang');
    assert.equal(RecipeManager.getFood('custom-g').portions.cup, 280);
  });

  it('defaults to none and ignores malformed entries', () => {
    assert.deepEqual(loadUserData().customFoods, []);
    Storage.save(Storage.KEYS.customFoods, [GOCHUJANG, null, { name: 'no id' }, 'junk']);
    assert.deepEqual(loadUserData().customFoods, [GOCHUJANG]);
    Storage.save(Storage.KEYS.customFoods, { 'custom-g': GOCHUJANG });
    assert.deepEqual(loadUserData().customFoods, [GOCHUJANG], 'an object map is read as a list');
  });

  it('saves, exports and uses them in analysis and the grocery list', () => {
    Object.assign(state, loadUserData());
    saveCustomFoods([GOCHUJANG]);
    assert.deepEqual(Storage.load(Storage.KEYS.customFoods, null), [GOCHUJANG]);
    assert.deepEqual(exportUserData().customFoods, [GOCHUJANG]);

    const recipe = { id: 'r-g', title: 'Rice bowl', servings: 1, ingredientsText: '1 tbsp gochujang\n1 cup cooked rice', matches: { gochujang: 'custom-g' } };
    const analysis = SubstitutionEngine.screen(recipe, { diet: 'omnivore', allergies: ['dairy'] });
    assert.equal(analysis.unmatched, 0);
    const [sauce] = analysis.ingredients;
    assert.equal(sauce.matchSource, 'user');
    assert.ok(Math.abs(sauce.grams - 280 / 16) < 1e-9, 'tbsp uses the custom grams per cup');
    assert.ok(Math.abs(sauce.nutrients.sodium - (2400 * 280) / 16 / 100) < 1e-9);

    const groups = GroceryAggregator.aggregate({ monday: { lunch: recipe.id } }, new Map([[recipe.id, recipe]]), 1, [],
      (r) => SubstitutionEngine.screen(r, state.profile));
    const item = groups.flatMap((g) => g.items).find((i) => i.key === 'custom-g');
    assert.equal(item.name, 'Gochujang');
  });
});
