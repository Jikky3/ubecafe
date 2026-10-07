import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NutritionEngine } from '../js/engines/nutrition.js';
import { DEFAULT_PROFILE } from '../js/data/seeds.js';

// The seed profile leaves body measurements empty until onboarding, so tests fill them in.
// 150 lb, 5 ft 6 in, 32 y; a 12-week timeline is the "Moderate" pace (loss × 0.8, gain × 1.1).
const BASE = { ...DEFAULT_PROFILE, age: 32, sex: 'female', heightCm: 167.64, weightKg: 68.04, activity: 'moderate', goal: 'maintain', timelineWeeks: 12, diet: 'omnivore' };
const profile = (overrides = {}) => ({ ...BASE, ...overrides });
const close = (actual, expected, epsilon = 1e-9) => assert.ok(
  Math.abs(actual - expected) < epsilon,
  `expected ${actual} to be within ${epsilon} of ${expected}`,
);

describe('NutritionEngine.bmr (Mifflin-St Jeor)', () => {
  it('uses +5 for men', () => {
    // 10·80 + 6.25·180 − 5·30 + 5
    assert.equal(NutritionEngine.bmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }), 1780);
  });

  it('uses −161 for women', () => {
    // 10·60 + 6.25·165 − 5·40 − 161
    assert.equal(NutritionEngine.bmr({ weightKg: 60, heightCm: 165, age: 40, sex: 'female' }), 1270.25);
  });

  it('uses the averaged −78 offset for "other"', () => {
    assert.equal(NutritionEngine.bmr({ weightKg: 70, heightCm: 170, age: 35, sex: 'other' }), 700 + 1062.5 - 175 - 78);
  });
});

describe('NutritionEngine.calculate', () => {
  it('computes the default profile targets', () => {
    // 68.04 kg, 167.64 cm, 32 y, female, moderate, maintain.
    const { bmr, tdee, targets } = NutritionEngine.calculate(profile());
    assert.equal(bmr, 1407); // 680.4 + 1047.75 − 160 − 161 = 1407.15
    assert.equal(tdee, 2181); // × 1.55
    assert.equal(targets.calories, 2181);
    assert.equal(targets.protein, 95); // 1.4 g/kg
    assert.equal(targets.fat, 73); // 30 % of energy / 9
    assert.equal(targets.carbs, 286); // remainder / 4
    assert.equal(targets.sugar, 55); // 10 % of energy / 4
    assert.equal(targets.fiber, 31); // 14 g per 1,000 kcal
    assert.equal(targets.saturatedFat, 24); // 10 % of energy / 9
    assert.equal(targets.sodium, NutritionEngine.SODIUM_LIMIT_MG);
    assert.equal(targets.sodium, 2300);
  });

  it('applies the activity factor to BMR', () => {
    const factors = NutritionEngine.ACTIVITY_FACTORS;
    const base = NutritionEngine.bmr(profile());
    Object.entries(factors).forEach(([activity, factor]) => {
      assert.equal(NutritionEngine.calculate(profile({ activity })).tdee, Math.round(base * factor));
    });
  });

  it('applies goal calorie factors, protein per kg and fat share', () => {
    const maintain = NutritionEngine.calculate(profile({ goal: 'maintain' }));
    const loss = NutritionEngine.calculate(profile({ goal: 'loss' }));
    const gain = NutritionEngine.calculate(profile({ goal: 'gain' }));

    assert.equal(loss.targets.calories, Math.round(maintain.tdee * 0.8));
    assert.equal(gain.targets.calories, Math.round(maintain.tdee * 1.1));
    assert.equal(loss.targets.protein, Math.round(68.04 * 1.8));
    assert.equal(gain.targets.protein, Math.round(68.04 * 2.0));
    assert.equal(gain.targets.fat, Math.round((gain.targets.calories * 0.25) / 9));
  });

  it('keeps macro energy close to the calorie target', () => {
    ['loss', 'maintain', 'gain'].forEach((goal) => {
      const { targets } = NutritionEngine.calculate(profile({ goal }));
      const energy = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
      assert.ok(Math.abs(energy - targets.calories) <= 10, `${goal}: ${energy} vs ${targets.calories}`);
    });
  });

  it('never goes below 1,200 kcal for women', () => {
    const small = profile({ weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary', goal: 'loss' });
    assert.equal(NutritionEngine.calculate(small).targets.calories, 1200);
  });

  it('never goes below 1,500 kcal for men', () => {
    const small = profile({ sex: 'male', weightKg: 50, heightCm: 160, age: 80, activity: 'sedentary', goal: 'loss' });
    assert.equal(NutritionEngine.calculate(small).targets.calories, 1500);
  });

  it('uses the 1,200 kcal floor for "other"', () => {
    const small = profile({ sex: 'other', weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary', goal: 'loss' });
    assert.equal(NutritionEngine.calculate(small).targets.calories, 1200);
  });

  it('never returns negative carbohydrates', () => {
    const lean = profile({ sex: 'male', weightKg: 150, heightCm: 150, age: 80, activity: 'sedentary', goal: 'loss' });
    assert.ok(NutritionEngine.calculate(lean).targets.carbs >= 0);
  });

  it('includes every micronutrient RDA in the targets', () => {
    const { targets } = NutritionEngine.calculate(profile());
    assert.deepEqual(
      Object.fromEntries(Object.keys(NutritionEngine.micronutrientRDA(32, 'female')).map((k) => [k, targets[k]])),
      NutritionEngine.micronutrientRDA(32, 'female'),
    );
  });
});

describe('NutritionEngine.pace (timeline)', () => {
  it('maps timelines to accelerated, moderate and gradual factors', () => {
    assert.deepEqual(NutritionEngine.pace(4), { label: 'Accelerated', loss: 0.75, gain: 1.15 });
    assert.deepEqual(NutritionEngine.pace(8), { label: 'Accelerated', loss: 0.75, gain: 1.15 });
    assert.deepEqual(NutritionEngine.pace(12), { label: 'Moderate', loss: 0.8, gain: 1.1 });
    assert.deepEqual(NutritionEngine.pace(16), { label: 'Gradual', loss: 0.85, gain: 1.05 });
    assert.deepEqual(NutritionEngine.pace(24), { label: 'Gradual', loss: 0.85, gain: 1.05 });
  });

  it('offers only timelines the pace table covers', () => {
    assert.deepEqual(NutritionEngine.TIMELINES, [4, 8, 12, 16, 24]);
  });

  it('applies the pace factor for every timeline and reports its label', () => {
    const { tdee } = NutritionEngine.calculate(profile());
    NutritionEngine.TIMELINES.forEach((timelineWeeks) => {
      const pace = NutritionEngine.pace(timelineWeeks);
      const loss = NutritionEngine.calculate(profile({ goal: 'loss', timelineWeeks }));
      const gain = NutritionEngine.calculate(profile({ goal: 'gain', timelineWeeks }));
      assert.equal(loss.targets.calories, Math.round(tdee * pace.loss), `loss ${timelineWeeks} wk`);
      assert.equal(gain.targets.calories, Math.round(tdee * pace.gain), `gain ${timelineWeeks} wk`);
      assert.equal(loss.pace, pace.label);
      assert.equal(gain.pace, pace.label);
    });
  });

  it('shorter timelines cut or add more energy', () => {
    const calories = (goal, timelineWeeks) => NutritionEngine.calculate(profile({ goal, timelineWeeks })).targets.calories;
    assert.ok(calories('loss', 4) < calories('loss', 12));
    assert.ok(calories('loss', 12) < calories('loss', 24));
    assert.ok(calories('gain', 4) > calories('gain', 12));
    assert.ok(calories('gain', 12) > calories('gain', 24));
  });

  it('ignores the timeline for maintenance', () => {
    NutritionEngine.TIMELINES.forEach((timelineWeeks) => {
      const result = NutritionEngine.calculate(profile({ goal: 'maintain', timelineWeeks }));
      assert.equal(result.targets.calories, result.tdee);
      assert.equal(result.pace, null);
    });
  });
});

describe('NutritionEngine.calculate projections and diets', () => {
  it('projects loss as negative, gain as positive and maintenance as zero', () => {
    const loss = NutritionEngine.calculate(profile({ goal: 'loss', timelineWeeks: 12 }));
    const gain = NutritionEngine.calculate(profile({ goal: 'gain', timelineWeeks: 12 }));
    assert.ok(loss.projectedKg < 0, `loss projected ${loss.projectedKg}`);
    assert.ok(gain.projectedKg > 0, `gain projected ${gain.projectedKg}`);
    assert.equal(NutritionEngine.calculate(profile({ goal: 'maintain' })).projectedKg, 0);
  });

  it('projects ~7,700 kcal per kg over the timeline', () => {
    const result = NutritionEngine.calculate(profile({ goal: 'loss', timelineWeeks: 8 }));
    // Uses the unrounded TDEE, so allow for the rounding of the reported tdee.
    const expected = ((result.targets.calories - result.tdee) * 7 * 8) / 7700;
    assert.ok(Math.abs(result.projectedKg - expected) < 0.01, `${result.projectedKg} vs ${expected}`);
    const longer = NutritionEngine.calculate(profile({ goal: 'loss', timelineWeeks: 24 }));
    assert.ok(Math.abs(longer.projectedKg) > Math.abs(result.projectedKg), 'a longer timeline projects more total change');
  });

  it('caps keto carbohydrates at 30 g and fills the rest with fat', () => {
    ['loss', 'maintain', 'gain'].forEach((goal) => {
      const { targets } = NutritionEngine.calculate(profile({ goal, diet: 'keto' }));
      assert.equal(targets.carbs, 30, goal);
      assert.equal(targets.fat, Math.round((targets.calories - targets.protein * 4 - 30 * 4) / 9), goal);
      assert.ok(targets.sugar <= 30, 'sugar never exceeds total carbs');
      const energy = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
      assert.ok(Math.abs(energy - targets.calories) <= 5, `${goal}: ${energy} vs ${targets.calories}`);
    });
  });

  it('keto keeps calories and protein, and only changes the carb/fat split', () => {
    const omni = NutritionEngine.calculate(profile()).targets;
    const keto = NutritionEngine.calculate(profile({ diet: 'keto' })).targets;
    assert.equal(keto.calories, omni.calories);
    assert.equal(keto.protein, omni.protein);
    assert.equal(keto.fat, 187); // (2181 − 95·4 − 30·4) / 9
    assert.ok(keto.fat > omni.fat);
    assert.equal(keto.sugar, 30);
  });

  it('uses the standard split for other diets', () => {
    const omni = NutritionEngine.calculate(profile()).targets;
    ['vegetarian', 'vegan', 'pescatarian'].forEach((diet) => {
      assert.deepEqual(NutritionEngine.calculate(profile({ diet })).targets, omni, diet);
    });
  });

  it('sets the calorie floor by sex for the same body and goal', () => {
    const small = { weightKg: 50, heightCm: 155, age: 75, activity: 'sedentary', goal: 'loss', timelineWeeks: 4 };
    assert.equal(NutritionEngine.calculate(profile({ ...small, sex: 'male' })).targets.calories, 1500);
    assert.equal(NutritionEngine.calculate(profile({ ...small, sex: 'female' })).targets.calories, 1200);
    assert.equal(NutritionEngine.calculate(profile({ ...small, sex: 'other' })).targets.calories, 1200);
  });

  it('does not raise targets that are already above the floor', () => {
    const big = profile({ sex: 'male', weightKg: 90, heightCm: 185, age: 30, activity: 'active', goal: 'loss', timelineWeeks: 4 });
    const { tdee, targets } = NutritionEngine.calculate(big);
    assert.equal(targets.calories, Math.round(tdee * 0.75));
    assert.ok(targets.calories > 1500);
  });
});

describe('NutritionEngine.micronutrientRDA', () => {
  it('returns adult female values (19–30)', () => {
    const rda = NutritionEngine.micronutrientRDA(25, 'female');
    assert.equal(rda.iron, 18);
    assert.equal(rda.calcium, 1000);
    assert.equal(rda.magnesium, 310);
    assert.equal(rda.vitaminC, 75);
    assert.equal(rda.vitaminA, 700);
    assert.equal(rda.zinc, 8);
  });

  it('lowers iron and raises calcium for women over 50', () => {
    const rda = NutritionEngine.micronutrientRDA(55, 'female');
    assert.equal(rda.iron, 8);
    assert.equal(rda.calcium, 1200);
    assert.equal(rda.magnesium, 320);
    assert.equal(rda.vitaminD, 15);
  });

  it('returns teen values under 19', () => {
    const girl = NutritionEngine.micronutrientRDA(16, 'female');
    const boy = NutritionEngine.micronutrientRDA(16, 'male');
    assert.equal(girl.iron, 15);
    assert.equal(girl.calcium, 1300);
    assert.equal(girl.zinc, 9);
    assert.equal(boy.iron, 11);
    assert.equal(boy.calcium, 1300);
    assert.equal(boy.magnesium, 410);
  });

  it('returns adult male values and age bands', () => {
    assert.equal(NutritionEngine.micronutrientRDA(25, 'male').magnesium, 400);
    assert.equal(NutritionEngine.micronutrientRDA(40, 'male').magnesium, 420);
    assert.equal(NutritionEngine.micronutrientRDA(40, 'male').calcium, 1000);
    assert.equal(NutritionEngine.micronutrientRDA(40, 'male').iron, 8);
    assert.equal(NutritionEngine.micronutrientRDA(40, 'male').vitaminC, 90);
  });

  it('raises vitamin D and calcium over 70', () => {
    const man = NutritionEngine.micronutrientRDA(75, 'male');
    const woman = NutritionEngine.micronutrientRDA(75, 'female');
    assert.equal(man.vitaminD, 20);
    assert.equal(man.calcium, 1200);
    assert.equal(woman.vitaminD, 20);
  });

  it('averages male and female values for "other"', () => {
    const male = NutritionEngine.micronutrientRDA(30, 'male');
    const female = NutritionEngine.micronutrientRDA(30, 'female');
    const other = NutritionEngine.micronutrientRDA(30, 'other');
    assert.equal(other.vitaminA, 800);
    assert.equal(other.iron, 13);
    Object.keys(male).forEach((key) => close(other[key], Math.round(((male[key] + female[key]) / 2) * 10) / 10));
  });
});

describe('NutritionEngine.bodyComposition', () => {
  it('classifies BMI using WHO cut-offs', () => {
    const bmiFor = (weightKg) => NutritionEngine.bodyComposition({ heightCm: 200, weightKg, sex: 'female' });
    // At 2 m, BMI = kg / 4.
    assert.equal(bmiFor(72).bmiCategory, 'Underweight'); // 18.0
    assert.equal(bmiFor(74).bmiCategory, 'Healthy range'); // 18.5
    assert.equal(bmiFor(99.6).bmiCategory, 'Healthy range'); // 24.9
    assert.equal(bmiFor(100).bmiCategory, 'Overweight'); // 25.0
    assert.equal(bmiFor(120).bmiCategory, 'Obesity'); // 30.0
    close(bmiFor(100).bmi, 25);
  });

  it('omits optional indicators when measurements are missing', () => {
    const result = NutritionEngine.bodyComposition({ heightCm: 170, weightKg: 65, sex: 'male', bodyFatPct: null, waistCm: null, hipCm: null });
    assert.deepEqual(Object.keys(result).sort(), ['bmi', 'bmiCategory']);
  });

  it('uses sex-specific waist-to-hip limits', () => {
    const whr = (sex) => NutritionEngine.bodyComposition({ heightCm: 170, weightKg: 65, sex, waistCm: 86, hipCm: 100 });
    assert.equal(whr('female').waistToHipRisk, 'Increased risk'); // 0.86 ≥ 0.85
    assert.equal(whr('male').waistToHipRisk, 'Low risk'); // 0.86 < 0.90
    assert.equal(whr('female').waistToHipLimit, 0.85);
    assert.equal(whr('male').waistToHipLimit, 0.9);
    assert.equal(whr('other').waistToHipLimit, 0.875);
    close(whr('male').waistToHip, 0.86);
  });

  it('flags waist-to-height at 0.5 and above', () => {
    const at = (waistCm) => NutritionEngine.bodyComposition({ heightCm: 170, weightKg: 65, sex: 'female', waistCm });
    assert.equal(at(84).waistToHeightRisk, 'Low risk');
    assert.equal(at(85).waistToHeightRisk, 'Increased risk');
    assert.equal(at(85).waistToHip, undefined, 'waist-to-hip needs a hip measurement');
  });

  it('derives lean mass and Katch-McArdle BMR from body fat', () => {
    const result = NutritionEngine.bodyComposition({ heightCm: 180, weightKg: 80, sex: 'male', bodyFatPct: 25 });
    close(result.leanMassKg, 60);
    close(result.katchBmr, 370 + 21.6 * 60);
  });

  it('prefers an entered lean mass over body fat %', () => {
    const result = NutritionEngine.bodyComposition({ heightCm: 180, weightKg: 80, sex: 'male', bodyFatPct: 25, leanMassKg: 55 });
    close(result.leanMassKg, 55);
    close(result.katchBmr, 370 + 21.6 * 55);
    assert.equal(result.leanSource, 'Entered');
  });

  it('labels lean mass derived from body fat with its source', () => {
    const result = NutritionEngine.bodyComposition({ heightCm: 180, weightKg: 80, sex: 'male', bodyFatPct: 25, leanMassKg: null });
    close(result.leanMassKg, 60);
    assert.equal(result.leanSource, 'From 25% body fat');
  });

  it('accepts lean mass without body fat %', () => {
    const result = NutritionEngine.bodyComposition({ heightCm: 165, weightKg: 60, sex: 'female', bodyFatPct: null, leanMassKg: 45 });
    close(result.leanMassKg, 45);
    close(result.katchBmr, 370 + 21.6 * 45);
  });
});
