import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleOptimizer } from '../js/engines/schedule.js';
import { emptyNutrients } from '../js/util.js';

/** Builds a planned meal with the given per-serving nutrients. */
const meal = (nutrients = {}) => ({ recipe: { id: 'test' }, nutrients: { ...emptyNutrients(), ...nutrients } });
const day = (slots = {}) => ({ breakfast: null, lunch: null, snack: null, dinner: null, ...slots });
/** Returns the slot id each supplement was placed in. */
const placement = (plan) => Object.fromEntries(
  Object.entries(plan).flatMap(([slot, items]) => items.map((item) => [item.id, slot])),
);
const place = (meals, selected, coffee = false) => placement(ScheduleOptimizer.build(meals, selected, coffee));

describe('ScheduleOptimizer.build', () => {
  it('returns an empty list for every slot when nothing is selected', () => {
    assert.deepEqual(ScheduleOptimizer.build(day(), [], true), { breakfast: [], lunch: [], snack: [], dinner: [] });
  });

  it('places fat-soluble supplements with the highest-fat meal', () => {
    const meals = day({ breakfast: meal({ fat: 5 }), lunch: meal({ fat: 30 }), dinner: meal({ fat: 12 }) });
    const where = place(meals, ['vitaminD3', 'omega3', 'vitaminK', 'multivitamin']);
    assert.deepEqual(where, { vitaminD3: 'lunch', omega3: 'lunch', vitaminK: 'lunch', multivitamin: 'lunch' });
    const [first] = ScheduleOptimizer.build(meals, ['vitaminD3'], false).lunch;
    assert.match(first.reason, /30 g fat/);
  });

  it('falls back to dinner for fat-soluble supplements on an empty day or a tie', () => {
    assert.equal(place(day(), ['vitaminD3']).vitaminD3, 'dinner');
    const tie = day({ breakfast: meal({ fat: 10 }), dinner: meal({ fat: 10 }) });
    assert.equal(place(tie, ['vitaminA']).vitaminA, 'dinner');
  });

  it('pairs iron with the most vitamin C', () => {
    const meals = day({ lunch: meal({ vitaminC: 10 }), snack: meal({ vitaminC: 90 }), dinner: meal({ vitaminC: 40 }) });
    assert.equal(place(meals, ['iron']).iron, 'snack');
  });

  it('keeps iron away from breakfast coffee', () => {
    const meals = day({ breakfast: meal({ vitaminC: 120 }), lunch: meal({ vitaminC: 10 }) });
    assert.equal(place(meals, ['iron'], true).iron, 'lunch');
    assert.equal(place(meals, ['iron'], false).iron, 'breakfast');
    const [item] = ScheduleOptimizer.build(meals, ['iron'], true).lunch;
    assert.match(item.reason, /coffee/);
  });

  it('penalizes calcium-rich meals when placing iron', () => {
    // Snack score 60 − 900/10 = −30; dinner 30 − 0 = 30.
    const meals = day({ snack: meal({ vitaminC: 60, calcium: 900 }), dinner: meal({ vitaminC: 30 }) });
    assert.equal(place(meals, ['iron']).iron, 'dinner');
  });

  it('defaults iron to lunch on an empty day', () => {
    assert.equal(place(day(), ['iron'], true).iron, 'lunch');
  });

  it('takes vitamin C with iron, or at breakfast without it', () => {
    const meals = day({ dinner: meal({ vitaminC: 50 }) });
    const withIron = place(meals, ['iron', 'vitaminC']);
    assert.equal(withIron.vitaminC, withIron.iron);
    assert.equal(place(meals, ['vitaminC']).vitaminC, 'breakfast');
  });

  it('separates calcium from iron', () => {
    const ironAtSnack = day({ snack: meal({ vitaminC: 80 }) });
    const where = place(ironAtSnack, ['iron', 'calcium']);
    assert.equal(where.iron, 'snack');
    assert.equal(where.calcium, 'lunch');
    assert.equal(place(day(), ['calcium']).calcium, 'snack');
  });

  it('keeps zinc apart from both iron and calcium', () => {
    // Iron defaults to lunch, calcium to snack, so zinc moves to dinner.
    const where = place(day(), ['iron', 'calcium', 'zinc']);
    assert.equal(where.iron, 'lunch');
    assert.equal(where.calcium, 'snack');
    assert.equal(where.zinc, 'dinner');
    assert.equal(place(day(), ['zinc']).zinc, 'lunch');

    const ironAtDinner = day({ dinner: meal({ vitaminC: 80 }) });
    const spread = place(ironAtDinner, ['iron', 'calcium', 'zinc']);
    assert.equal(new Set([spread.iron, spread.calcium, spread.zinc]).size, 3);
  });

  it('places magnesium at dinner and B12 at breakfast', () => {
    const where = place(day(), ['magnesium', 'vitaminB12']);
    assert.deepEqual(where, { magnesium: 'dinner', vitaminB12: 'breakfast' });
  });

  it('gives every placement a reason', () => {
    const plan = ScheduleOptimizer.build(day({ lunch: meal({ fat: 20, vitaminC: 40 }) }),
      ['vitaminD3', 'iron', 'vitaminC', 'calcium', 'magnesium', 'zinc', 'vitaminB12'], true);
    const items = Object.values(plan).flat();
    assert.equal(items.length, 7);
    items.forEach((item) => assert.ok(item.reason.length > 20, item.id));
  });
});

describe('ScheduleOptimizer.mealTips', () => {
  it('returns nothing for an empty slot', () => {
    assert.deepEqual(ScheduleOptimizer.mealTips('lunch', null, true), []);
  });

  it('suggests vitamin C for an iron-rich meal that lacks it', () => {
    assert.equal(ScheduleOptimizer.mealTips('lunch', meal({ iron: 4, vitaminC: 5 }), false).length, 1);
    assert.deepEqual(ScheduleOptimizer.mealTips('lunch', meal({ iron: 4, vitaminC: 40 }), false), []);
  });

  it('warns about coffee after an iron-rich breakfast', () => {
    const tips = ScheduleOptimizer.mealTips('breakfast', meal({ iron: 4, vitaminC: 40 }), true);
    assert.equal(tips.length, 1);
    assert.match(tips[0], /coffee/);
  });

  it('suggests fat for vitamin A in a low-fat meal', () => {
    assert.equal(ScheduleOptimizer.mealTips('dinner', meal({ vitaminA: 500, fat: 2 }), false).length, 1);
    assert.deepEqual(ScheduleOptimizer.mealTips('dinner', meal({ vitaminA: 500, fat: 10 }), false), []);
  });
});
