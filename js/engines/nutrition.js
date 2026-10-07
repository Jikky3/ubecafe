import { fmt } from '../util.js';


export class NutritionEngine {
  static ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };

  static GOALS = {
    loss: { label: 'Weight loss', proteinPerKg: 1.8, fatShare: 0.3 },
    maintain: { label: 'Maintenance', proteinPerKg: 1.4, fatShare: 0.3 },
    gain: { label: 'Muscle gain', proteinPerKg: 2.0, fatShare: 0.25 },
  };

  /** Sodium upper limit in mg/day: DGA 2020-2025 and AHA (NASEM Chronic Disease Risk Reduction intake, ages 14+). */
  static SODIUM_LIMIT_MG = 2300;

  /** Shorter timelines use a larger (but capped) energy adjustment. */
  static TIMELINES = [4, 8, 12, 16, 24];

  static pace(weeks) {
    if (weeks <= 8) return { label: 'Accelerated', loss: 0.75, gain: 1.15 };
    if (weeks <= 12) return { label: 'Moderate', loss: 0.8, gain: 1.1 };
    return { label: 'Gradual', loss: 0.85, gain: 1.05 };
  }

  /** Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + s (s = +5 male, −161 female, −78 averaged). */
  static bmr({ weightKg, heightCm, age, sex }) {
    const sexOffset = { male: 5, female: -161, other: -78 }[sex];
    return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  }

  static calculate(profile) {
    const bmr = this.bmr(profile);
    const tdee = bmr * this.ACTIVITY_FACTORS[profile.activity];
    const goal = this.GOALS[profile.goal];
    const pace = this.pace(profile.timelineWeeks);
    const factor = profile.goal === 'maintain' ? 1 : pace[profile.goal];
    const calorieFloor = profile.sex === 'male' ? 1500 : 1200;
    const calories = Math.max(calorieFloor, Math.round(tdee * factor));
    const protein = Math.round(profile.weightKg * goal.proteinPerKg);

    // Keto caps net carbs at 30 g and fills the remaining energy with fat.
    let carbs;
    let fat;
    if (profile.diet === 'keto') {
      carbs = 30;
      fat = Math.max(0, Math.round((calories - protein * 4 - carbs * 4) / 9));
    } else {
      fat = Math.round((calories * goal.fatShare) / 9);
      carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    }
    const sugar = Math.min(carbs, Math.round((calories * 0.1) / 4)); // WHO: free sugars < 10 % of energy
    const saturatedFat = Math.round((calories * 0.1) / 9); // DGA 2020-2025 / AHA: saturated fat < 10 % of energy

    // ~7,700 kcal per kg of body weight change.
    const weeklyKg = ((calories - tdee) * 7) / 7700;
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      pace: profile.goal === 'maintain' ? null : pace.label,
      projectedKg: profile.goal === 'maintain' ? 0 : weeklyKg * profile.timelineWeeks,
      targets: {
        calories, protein, carbs, fat, saturatedFat, sugar,
        fiber: Math.round((14 * calories) / 1000), // IOM: 14 g per 1,000 kcal
        sodium: this.SODIUM_LIMIT_MG,
        ...this.micronutrientRDA(profile.age, profile.sex),
      },
    };
  }

  /**
   * Body-composition indicators (WHO cut-offs). BMI always; waist ratios when tape
   * measurements exist; lean mass from direct entry or body fat %, plus Katch-McArdle BMR.
   */
  static bodyComposition({ heightCm, weightKg, sex, bodyFatPct, waistCm, hipCm, leanMassKg }) {
    const bmi = weightKg / (heightCm / 100) ** 2;
    let bmiCategory = 'Obesity';
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 25) bmiCategory = 'Healthy range';
    else if (bmi < 30) bmiCategory = 'Overweight';

    const result = { bmi, bmiCategory };
    if (waistCm && hipCm) {
      const whrLimit = { male: 0.9, female: 0.85, other: 0.875 }[sex];
      result.waistToHip = waistCm / hipCm;
      result.waistToHipRisk = result.waistToHip >= whrLimit ? 'Increased risk' : 'Low risk';
      result.waistToHipLimit = whrLimit;
    }
    if (waistCm) {
      result.waistToHeight = waistCm / heightCm;
      result.waistToHeightRisk = result.waistToHeight >= 0.5 ? 'Increased risk' : 'Low risk';
    }
    const lean = leanMassKg ?? (bodyFatPct ? weightKg * (1 - bodyFatPct / 100) : null);
    if (lean) {
      result.leanMassKg = lean;
      result.leanSource = leanMassKg ? 'Entered' : `From ${fmt(bodyFatPct)}% body fat`;
      result.katchBmr = 370 + 21.6 * lean;
    }
    return result;
  }

  /** NIH Dietary Reference Intakes (RDA / AI) by age and sex. */
  static micronutrientRDA(age, sex) {
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
    if (sex === 'male') return male;
    if (sex === 'female') return female;
    return Object.fromEntries(Object.keys(male).map((k) => [k, Math.round(((male[k] + female[k]) / 2) * 10) / 10]));
  }
}
