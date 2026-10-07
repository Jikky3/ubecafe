// Basic quantity / unit sanity checks only. Food matching and nutrient values are
// covered by the food-database tests, so nothing here depends on which food a line matches.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecipeParser } from '../js/engines/recipe-parser.js';

const parse = (line) => RecipeParser.parseIngredientLine(line);

describe('RecipeParser quantities and units', () => {
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
