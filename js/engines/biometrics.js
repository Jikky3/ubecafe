export class BiometricsEngine {
  static ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };

  static GOALS = {
    loss: { calorieFactor: 0.8, proteinPerKg: 1.8, fatShare: 0.3 },
    maintain: { calorieFactor: 1, proteinPerKg: 1.4, fatShare: 0.3 },
    gain: { calorieFactor: 1.1, proteinPerKg: 2.0, fatShare: 0.25 },
  };

  /** Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + s (s = +5 male, −161 female, −78 averaged). */
  static bmr({ weightKg, heightCm, age, gender }) {
    const sexOffset = { male: 5, female: -161, other: -78 }[gender];
    return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  }

  static calculate(profile) {
    const bmr = this.bmr(profile);
    const tdee = bmr * this.ACTIVITY_FACTORS[profile.activity];
    const goal = this.GOALS[profile.goal];
    const calorieFloor = profile.gender === 'male' ? 1500 : 1200;
    const calories = Math.max(calorieFloor, Math.round(tdee * goal.calorieFactor));
    const protein = Math.round(profile.weightKg * goal.proteinPerKg);
    const fat = Math.round((calories * goal.fatShare) / 9);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    const sugar = Math.round((calories * 0.1) / 4); // WHO: free sugars < 10 % of energy

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targets: {
        calories, protein, carbs, fat, sugar,
        fiber: Math.round((14 * calories) / 1000), // IOM: 14 g per 1,000 kcal
        ...this.micronutrientRDA(profile.age, profile.gender),
      },
    };
  }

  /**
   * Optional body-composition indicators (WHO cut-offs).
   * BMI always; waist-to-hip and waist-to-height when tape measurements exist;
   * lean mass and Katch-McArdle BMR when body fat % is known.
   */
  static bodyComposition({ heightCm, weightKg, gender, bodyFatPct, waistCm, hipCm }) {
    const bmi = weightKg / (heightCm / 100) ** 2;
    let bmiCategory = 'Obesity';
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 25) bmiCategory = 'Healthy range';
    else if (bmi < 30) bmiCategory = 'Overweight';

    const result = { bmi, bmiCategory };
    if (waistCm && hipCm) {
      const whrLimit = { male: 0.9, female: 0.85, other: 0.875 }[gender];
      result.waistToHip = waistCm / hipCm;
      result.waistToHipRisk = result.waistToHip >= whrLimit ? 'Increased risk' : 'Low risk';
      result.waistToHipLimit = whrLimit;
    }
    if (waistCm) {
      result.waistToHeight = waistCm / heightCm;
      result.waistToHeightRisk = result.waistToHeight >= 0.5 ? 'Increased risk' : 'Low risk';
    }
    if (bodyFatPct) {
      result.leanMassKg = weightKg * (1 - bodyFatPct / 100);
      result.katchBmr = 370 + 21.6 * result.leanMassKg;
    }
    return result;
  }

  /** NIH Dietary Reference Intakes (RDA / AI) by age and sex. */
  static micronutrientRDA(age, gender) {
    const teen = age < 19;
    const senior = age > 70;
    const over50 = age > 50;
    const under31 = age < 31;
    const male = {
      vitaminA: 900, vitaminC: teen ? 75 : 90, vitaminD: senior ? 20 : 15, vitaminB12: 2.4,
      calcium: teen ? 1300 : senior ? 1200 : 1000, iron: teen ? 11 : 8, potassium: teen ? 3000 : 3400,
      magnesium: teen ? 410 : under31 ? 400 : 420, zinc: 11, omega3: 1.6,
    };
    const female = {
      vitaminA: 700, vitaminC: teen ? 65 : 75, vitaminD: senior ? 20 : 15, vitaminB12: 2.4,
      calcium: teen ? 1300 : over50 ? 1200 : 1000, iron: teen ? 15 : over50 ? 8 : 18, potassium: teen ? 2300 : 2600,
      magnesium: teen ? 360 : under31 ? 310 : 320, zinc: teen ? 9 : 8, omega3: 1.1,
    };
    if (gender === 'male') return male;
    if (gender === 'female') return female;
    return Object.fromEntries(Object.keys(male).map((k) => [k, Math.round(((male[k] + female[k]) / 2) * 10) / 10]));
  }
}
