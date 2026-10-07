import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecommendationEngine } from '../js/engines/recommendations.js';
import { BiometricsEngine } from '../js/engines/biometrics.js';
import { DEFAULT_PROFILE } from '../js/data/seeds.js';
import { NUTRIENT_KEYS } from '../js/data/nutrients.js';

const { targets } = BiometricsEngine.calculate(DEFAULT_PROFILE);

/** Intake that meets every target exactly, with optional ratio overrides (fraction of target). */
const intakeAt = (ratios = {}) => Object.fromEntries(
  NUTRIENT_KEYS.map((key) => [key, targets[key] * (ratios[key] ?? 1)]),
);
const recommend = (ratios, mealsPlanned = 4) => RecommendationEngine.recommend(intakeAt(ratios), targets, mealsPlanned);
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
