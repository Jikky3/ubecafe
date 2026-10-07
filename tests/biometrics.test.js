import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BiometricsEngine } from '../js/engines/biometrics.js';
import { DEFAULT_PROFILE } from '../js/data/seeds.js';

const profile = (overrides = {}) => ({ ...DEFAULT_PROFILE, ...overrides });
const close = (actual, expected, epsilon = 1e-9) => assert.ok(
  Math.abs(actual - expected) < epsilon,
  `expected ${actual} to be within ${epsilon} of ${expected}`,
);

describe('BiometricsEngine.bmr (Mifflin-St Jeor)', () => {
  it('uses +5 for men', () => {
    // 10·80 + 6.25·180 − 5·30 + 5
    assert.equal(BiometricsEngine.bmr({ weightKg: 80, heightCm: 180, age: 30, gender: 'male' }), 1780);
  });

  it('uses −161 for women', () => {
    // 10·60 + 6.25·165 − 5·40 − 161
    assert.equal(BiometricsEngine.bmr({ weightKg: 60, heightCm: 165, age: 40, gender: 'female' }), 1270.25);
  });

  it('uses the averaged −78 offset for "other"', () => {
    assert.equal(BiometricsEngine.bmr({ weightKg: 70, heightCm: 170, age: 35, gender: 'other' }), 700 + 1062.5 - 175 - 78);
  });
});

describe('BiometricsEngine.calculate', () => {
  it('computes the default profile targets', () => {
    // 68.04 kg, 167.64 cm, 32 y, female, moderate, maintain.
    const { bmr, tdee, targets } = BiometricsEngine.calculate(profile());
    assert.equal(bmr, 1407); // 680.4 + 1047.75 − 160 − 161 = 1407.15
    assert.equal(tdee, 2181); // × 1.55
    assert.equal(targets.calories, 2181);
    assert.equal(targets.protein, 95); // 1.4 g/kg
    assert.equal(targets.fat, 73); // 30 % of energy / 9
    assert.equal(targets.carbs, 286); // remainder / 4
    assert.equal(targets.sugar, 55); // 10 % of energy / 4
    assert.equal(targets.fiber, 31); // 14 g per 1,000 kcal
  });

  it('applies the activity factor to BMR', () => {
    const factors = BiometricsEngine.ACTIVITY_FACTORS;
    const base = BiometricsEngine.bmr(profile());
    Object.entries(factors).forEach(([activity, factor]) => {
      assert.equal(BiometricsEngine.calculate(profile({ activity })).tdee, Math.round(base * factor));
    });
  });

  it('applies goal calorie factors, protein per kg and fat share', () => {
    const maintain = BiometricsEngine.calculate(profile({ goal: 'maintain' }));
    const loss = BiometricsEngine.calculate(profile({ goal: 'loss' }));
    const gain = BiometricsEngine.calculate(profile({ goal: 'gain' }));

    assert.equal(loss.targets.calories, Math.round(maintain.tdee * 0.8));
    assert.equal(gain.targets.calories, Math.round(maintain.tdee * 1.1));
    assert.equal(loss.targets.protein, Math.round(68.04 * 1.8));
    assert.equal(gain.targets.protein, Math.round(68.04 * 2.0));
    assert.equal(gain.targets.fat, Math.round((gain.targets.calories * 0.25) / 9));
  });

  it('keeps macro energy close to the calorie target', () => {
    ['loss', 'maintain', 'gain'].forEach((goal) => {
      const { targets } = BiometricsEngine.calculate(profile({ goal }));
      const energy = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
      assert.ok(Math.abs(energy - targets.calories) <= 10, `${goal}: ${energy} vs ${targets.calories}`);
    });
  });

  it('never goes below 1,200 kcal for women', () => {
    const small = profile({ weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary', goal: 'loss' });
    assert.equal(BiometricsEngine.calculate(small).targets.calories, 1200);
  });

  it('never goes below 1,500 kcal for men', () => {
    const small = profile({ gender: 'male', weightKg: 50, heightCm: 160, age: 80, activity: 'sedentary', goal: 'loss' });
    assert.equal(BiometricsEngine.calculate(small).targets.calories, 1500);
  });

  it('uses the 1,200 kcal floor for "other"', () => {
    const small = profile({ gender: 'other', weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary', goal: 'loss' });
    assert.equal(BiometricsEngine.calculate(small).targets.calories, 1200);
  });

  it('never returns negative carbohydrates', () => {
    const lean = profile({ gender: 'male', weightKg: 150, heightCm: 150, age: 80, activity: 'sedentary', goal: 'loss' });
    assert.ok(BiometricsEngine.calculate(lean).targets.carbs >= 0);
  });

  it('includes every micronutrient RDA in the targets', () => {
    const { targets } = BiometricsEngine.calculate(profile());
    assert.deepEqual(
      Object.fromEntries(Object.keys(BiometricsEngine.micronutrientRDA(32, 'female')).map((k) => [k, targets[k]])),
      BiometricsEngine.micronutrientRDA(32, 'female'),
    );
  });
});

describe('BiometricsEngine.micronutrientRDA', () => {
  it('returns adult female values (19–30)', () => {
    const rda = BiometricsEngine.micronutrientRDA(25, 'female');
    assert.equal(rda.iron, 18);
    assert.equal(rda.calcium, 1000);
    assert.equal(rda.magnesium, 310);
    assert.equal(rda.vitaminC, 75);
    assert.equal(rda.vitaminA, 700);
    assert.equal(rda.zinc, 8);
  });

  it('lowers iron and raises calcium for women over 50', () => {
    const rda = BiometricsEngine.micronutrientRDA(55, 'female');
    assert.equal(rda.iron, 8);
    assert.equal(rda.calcium, 1200);
    assert.equal(rda.magnesium, 320);
    assert.equal(rda.vitaminD, 15);
  });

  it('returns teen values under 19', () => {
    const girl = BiometricsEngine.micronutrientRDA(16, 'female');
    const boy = BiometricsEngine.micronutrientRDA(16, 'male');
    assert.equal(girl.iron, 15);
    assert.equal(girl.calcium, 1300);
    assert.equal(girl.zinc, 9);
    assert.equal(boy.iron, 11);
    assert.equal(boy.calcium, 1300);
    assert.equal(boy.magnesium, 410);
  });

  it('returns adult male values and age bands', () => {
    assert.equal(BiometricsEngine.micronutrientRDA(25, 'male').magnesium, 400);
    assert.equal(BiometricsEngine.micronutrientRDA(40, 'male').magnesium, 420);
    assert.equal(BiometricsEngine.micronutrientRDA(40, 'male').calcium, 1000);
    assert.equal(BiometricsEngine.micronutrientRDA(40, 'male').iron, 8);
    assert.equal(BiometricsEngine.micronutrientRDA(40, 'male').vitaminC, 90);
  });

  it('raises vitamin D and calcium over 70', () => {
    const man = BiometricsEngine.micronutrientRDA(75, 'male');
    const woman = BiometricsEngine.micronutrientRDA(75, 'female');
    assert.equal(man.vitaminD, 20);
    assert.equal(man.calcium, 1200);
    assert.equal(woman.vitaminD, 20);
  });

  it('averages male and female values for "other"', () => {
    const male = BiometricsEngine.micronutrientRDA(30, 'male');
    const female = BiometricsEngine.micronutrientRDA(30, 'female');
    const other = BiometricsEngine.micronutrientRDA(30, 'other');
    assert.equal(other.vitaminA, 800);
    assert.equal(other.iron, 13);
    Object.keys(male).forEach((key) => close(other[key], Math.round(((male[key] + female[key]) / 2) * 10) / 10));
  });
});

describe('BiometricsEngine.bodyComposition', () => {
  it('classifies BMI using WHO cut-offs', () => {
    const bmiFor = (weightKg) => BiometricsEngine.bodyComposition({ heightCm: 200, weightKg, gender: 'female' });
    // At 2 m, BMI = kg / 4.
    assert.equal(bmiFor(72).bmiCategory, 'Underweight'); // 18.0
    assert.equal(bmiFor(74).bmiCategory, 'Healthy range'); // 18.5
    assert.equal(bmiFor(99.6).bmiCategory, 'Healthy range'); // 24.9
    assert.equal(bmiFor(100).bmiCategory, 'Overweight'); // 25.0
    assert.equal(bmiFor(120).bmiCategory, 'Obesity'); // 30.0
    close(bmiFor(100).bmi, 25);
  });

  it('omits optional indicators when measurements are missing', () => {
    const result = BiometricsEngine.bodyComposition({ heightCm: 170, weightKg: 65, gender: 'male', bodyFatPct: null, waistCm: null, hipCm: null });
    assert.deepEqual(Object.keys(result).sort(), ['bmi', 'bmiCategory']);
  });

  it('uses sex-specific waist-to-hip limits', () => {
    const whr = (gender) => BiometricsEngine.bodyComposition({ heightCm: 170, weightKg: 65, gender, waistCm: 86, hipCm: 100 });
    assert.equal(whr('female').waistToHipRisk, 'Increased risk'); // 0.86 ≥ 0.85
    assert.equal(whr('male').waistToHipRisk, 'Low risk'); // 0.86 < 0.90
    assert.equal(whr('female').waistToHipLimit, 0.85);
    assert.equal(whr('male').waistToHipLimit, 0.9);
    assert.equal(whr('other').waistToHipLimit, 0.875);
    close(whr('male').waistToHip, 0.86);
  });

  it('flags waist-to-height at 0.5 and above', () => {
    const at = (waistCm) => BiometricsEngine.bodyComposition({ heightCm: 170, weightKg: 65, gender: 'female', waistCm });
    assert.equal(at(84).waistToHeightRisk, 'Low risk');
    assert.equal(at(85).waistToHeightRisk, 'Increased risk');
    assert.equal(at(85).waistToHip, undefined, 'waist-to-hip needs a hip measurement');
  });

  it('derives lean mass and Katch-McArdle BMR from body fat', () => {
    const result = BiometricsEngine.bodyComposition({ heightCm: 180, weightKg: 80, gender: 'male', bodyFatPct: 25 });
    close(result.leanMassKg, 60);
    close(result.katchBmr, 370 + 21.6 * 60);
  });
});
