import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecommendationEngine } from '../js/engines/recommendations.js';
import { NutritionEngine } from '../js/engines/nutrition.js';
import { SubstitutionEngine } from '../js/engines/substitution.js';
import { DEFAULT_PROFILE } from '../js/data/seeds.js';
import { NUTRIENT_KEYS } from '../js/data/nutrients.js';

// The seed profile leaves measurements empty until onboarding; use a filled-in adult.
const PROFILE = { ...DEFAULT_PROFILE, age: 32, sex: 'female', heightCm: 167.64, weightKg: 68.04 };
const { targets } = NutritionEngine.calculate(PROFILE);

/** Intake that meets every target exactly, with optional ratio overrides (fraction of target). */
const intakeAt = (ratios = {}) => Object.fromEntries(
  NUTRIENT_KEYS.map((key) => [key, targets[key] * (ratios[key] ?? 1)]),
);
const recommend = (ratios, mealsPlanned = 4, restrictions = []) => RecommendationEngine.recommend(intakeAt(ratios), targets, mealsPlanned, restrictions);
const triggered = (recs, label) => recs.find((r) => r.trigger.startsWith(label));

describe('RecommendationEngine.recommend', () => {
  it('asks for a first meal when nothing is planned', () => {
    const recs = RecommendationEngine.recommend(intakeAt({ iron: 0 }), targets, 0);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].trigger, 'No meals planned');
    assert.equal(recs[0].priority, 'info');
  });

  it('reports all targets met when nothing is out of range', () => {
    const recs = recommend({});
    assert.equal(recs.length, 1);
    assert.equal(recs[0].trigger, 'All targets met');
    assert.equal(recs[0].priority, 'info');
  });

  it('does not fire at the rule thresholds', () => {
    // Micronutrient rules fire below 70 %, calories below 80 % or above 110 %, fat above 115 %.
    const recs = recommend({ iron: 0.7, calories: 1.1, fat: 1.15, protein: 0.8, sugar: 1 });
    assert.equal(recs[0].trigger, 'All targets met');
  });

  it('fires a rule for each micronutrient below 70 %', () => {
    const micros = ['fiber', 'iron', 'vitaminC', 'vitaminD', 'vitaminB12', 'calcium', 'potassium', 'magnesium', 'zinc', 'omega3', 'vitaminA'];
    micros.forEach((key) => {
      const recs = recommend({ [key]: 0.6 });
      assert.equal(recs.length, 1, key);
      assert.match(recs[0].trigger, /at 60% of target$/, key);
      assert.equal(recs[0].priority, 'medium', key);
      assert.ok(recs[0].food && recs[0].reason, `${key} has a food and a reason`);
    });
  });

  it('recommends energy-dense foods when calories are low and volume foods when high', () => {
    assert.match(triggered(recommend({ calories: 0.7 }), 'Calories').food, /Oats/);
    assert.match(triggered(recommend({ calories: 1.2 }), 'Calories').food, /Leafy Greens/);
  });

  it('picks a low-carb protein when carbs are already met', () => {
    assert.match(triggered(recommend({ protein: 0.5 }), 'Protein').food, /Greek Yogurt/);
    assert.match(triggered(recommend({ protein: 0.5, carbs: 0.5 }), 'Protein').food, /Chicken Breast/);
  });

  it('describes limits as a share of the daily limit', () => {
    const recs = recommend({ sugar: 1.5 });
    assert.equal(recs[0].trigger, 'Sugar at 150% of your daily limit');
    assert.equal(recs[0].priority, 'high');
    assert.ok(triggered(recommend({ fat: 1.2 }), 'Fat'));
  });

  it('marks gaps below 50 % and excesses above 125 % as high priority', () => {
    assert.equal(recommend({ iron: 0.4 })[0].priority, 'high');
    assert.equal(recommend({ iron: 0.6 })[0].priority, 'medium');
    assert.equal(triggered(recommend({ fat: 1.3 }), 'Fat').priority, 'high');
    assert.equal(triggered(recommend({ fat: 1.2 }), 'Fat').priority, 'medium');
  });

  it('orders high priority before medium', () => {
    const recs = recommend({ fiber: 0.6, magnesium: 0.65, iron: 0.2, zinc: 0.3 });
    assert.deepEqual(recs.map((r) => r.priority), ['high', 'high', 'medium', 'medium']);
    assert.ok(triggered(recs.slice(0, 2), 'Iron'));
    assert.ok(triggered(recs.slice(0, 2), 'Zinc'));
  });

  it('treats a zero target as met', () => {
    const recs = RecommendationEngine.recommend(intakeAt({ omega3: 0 }), { ...targets, omega3: 0 }, 4);
    assert.equal(recs[0].trigger, 'All targets met');
  });
});

describe('RecommendationEngine with restrictions', () => {
  const restrictionsFor = (diet, allergies = []) => SubstitutionEngine.restrictionsFor({ diet, allergies });

  it('adds no restriction note without restrictions', () => {
    const [rec] = recommend({ calories: 0.7 });
    assert.equal(rec.food, 'Oats with Nut Butter / Avocado');
    assert.equal(rec.restrictionNote, '');
  });

  it('leaves out foods that clash and says which', () => {
    const [rec] = recommend({ calories: 0.7 }, 4, ['peanuts']);
    assert.equal(rec.food, 'Avocado');
    assert.equal(rec.restrictionNote, 'Adjusted for your diet and allergies: left out Oats with Nut Butter.');
  });

  it('lists every removed food in the note', () => {
    const [rec] = recommend({ vitaminB12: 0.5 }, 4, ['eggs', 'fish']);
    assert.equal(rec.food, 'Greek Yogurt');
    assert.match(rec.restrictionNote, /left out Eggs, Salmon\.$/);
  });

  it('switches to the alternative foods when every option clashes', () => {
    const [rec] = recommend({ protein: 0.5 }, 4, ['dairy']);
    assert.equal(rec.food, 'Hemp Seeds / Canned Tuna');
    assert.match(rec.restrictionNote, /Greek Yogurt, Cottage Cheese/);
    const [vegan] = recommend({ protein: 0.5 }, 4, restrictionsFor('vegan'));
    assert.equal(vegan.food, 'Hemp Seeds', 'the alternative is filtered too');
  });

  it('keeps vegan vitamin B12 and D advice plant-based', () => {
    const vegan = restrictionsFor('vegan');
    assert.equal(triggered(recommend({ vitaminB12: 0.5 }, 4, vegan), 'Vitamin B12').food, 'Nutritional Yeast / Fortified Soy Milk');
    assert.equal(triggered(recommend({ vitaminD: 0.5 }, 4, vegan), 'Vitamin D').food, 'Fortified Oat Milk / UV-Exposed Mushrooms');
    assert.equal(triggered(recommend({ vitaminD: 0.5 }, 4, [...vegan, 'grains']), 'Vitamin D').food, 'UV-Exposed Mushrooms');
  });

  it('never recommends a restricted food for any rule', () => {
    const allLow = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0.3]));
    const restricted = restrictionsFor('keto', ['dairy', 'tree_nuts', 'soy', 'eggs']);
    const recs = recommend(allLow, 4, restricted);
    assert.ok(recs.length > 0);
    recs.forEach((rec) => rec.food.split(' / ').forEach((name) => {
      const tags = RecommendationEngine.FOOD_RESTRICTIONS[name] ?? [];
      assert.ok(!tags.some((t) => restricted.includes(t)), `${name} clashes with ${tags}`);
    }));
  });

  it('safeFoods splits a food list into safe and removed names', () => {
    assert.deepEqual(RecommendationEngine.safeFoods('Salmon / Chia Seeds / Walnuts', ['fish', 'tree_nuts']), { safe: ['Chia Seeds'], removed: ['Salmon', 'Walnuts'] });
    assert.deepEqual(RecommendationEngine.safeFoods('Kiwi', []), { safe: ['Kiwi'], removed: [] });
  });
});
