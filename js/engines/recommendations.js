import { NUTRIENT_BY_KEY } from '../data/nutrients.js';


export class RecommendationEngine {
  /** Restriction tags for foods named in recommendations (unlisted foods are unrestricted). */
  static FOOD_RESTRICTIONS = {
    'Oats with Nut Butter': ['grains', 'gluten', 'peanuts', 'tree_nuts', 'legumes'],
    'Greek Yogurt': ['dairy'],
    'Cottage Cheese': ['dairy'],
    'Plain Yogurt': ['dairy'],
    'Fortified Milk': ['dairy'],
    'Fortified Oat Milk': ['grains'],
    'Fortified Soy Milk': ['soy', 'legumes'],
    Eggs: ['eggs'],
    'Firm Tofu': ['soy', 'legumes'],
    Almonds: ['tree_nuts'],
    Walnuts: ['tree_nuts'],
    'Chicken Breast': ['meat'],
    'Lean Beef': ['meat'],
    Salmon: ['fish'],
    Sardines: ['fish'],
    'Canned Tuna': ['fish'],
    Lentils: ['legumes'],
    'Black Beans': ['legumes'],
    Chickpeas: ['legumes'],
    Banana: ['high_carb_fruit'],
    'Sweet Potato': ['starch'],
    'No-Salt-Added Beans': ['legumes'],
  };

  /** Removes foods that clash with active restrictions; returns the safe names and the ones left out. */
  static safeFoods(foodList, restrictions) {
    const names = foodList.split(' / ');
    const isSafe = (name) => !(this.FOOD_RESTRICTIONS[name] ?? []).some((t) => restrictions.includes(t));
    return { safe: names.filter(isSafe), removed: names.filter((n) => !isSafe(n)) };
  }

  static recommend(intake, targets, mealsPlanned, restrictions = []) {
    if (mealsPlanned === 0) {
      return [{
        food: 'Plan your first meal',
        reason: 'Add recipes to this day in the Weekly Meal Plan so the engine can compare your intake against your targets.',
        trigger: 'No meals planned',
        priority: 'info',
      }];
    }

    const recs = [];
    const ratio = (key) => (targets[key] > 0 ? intake[key] / targets[key] : 1);
    /** Adds a rule's output, swapping in `alternative` foods when every option clashes with a restriction. */
    const add = (key, foods, reason, alternative) => {
      let { safe, removed } = this.safeFoods(foods, restrictions);
      if (!safe.length && alternative) safe = this.safeFoods(alternative, restrictions).safe;
      if (!safe.length) return;
      const r = ratio(key);
      recs.push({
        key,
        food: safe.join(' / '),
        reason,
        restrictionNote: removed.length ? `Adjusted for your diet and allergies: left out ${removed.join(', ')}.` : '',
        trigger: `${NUTRIENT_BY_KEY[key].label} at ${Math.round(r * 100)}% of ${NUTRIENT_BY_KEY[key].isLimit ? 'your daily limit' : 'target'}`,
        priority: r < 0.5 || r > 1.25 ? 'high' : 'medium',
      });
    };

    // Energy balance
    if (ratio('calories') < 0.8) {
      add('calories', 'Oats with Nut Butter / Avocado', 'Nutrient-dense calories with fiber and healthy fats close your energy gap without a sugar spike.');
    } else if (ratio('calories') > 1.1) {
      add('calories', 'Leafy Greens / Broth-Based Soups', 'High-volume, low-calorie foods keep you full while trimming the day back toward your energy target.');
    }

    // Protein, with carb context
    if (ratio('protein') < 0.8 && intake.carbs >= targets.carbs) {
      add('protein', 'Greek Yogurt / Cottage Cheese', 'High-protein, low-carb boost to meet muscle protein synthesis targets.', 'Hemp Seeds / Canned Tuna');
    } else if (ratio('protein') < 0.8) {
      add('protein', 'Chicken Breast / Eggs / Firm Tofu', 'Complete protein sources that close your protein deficit while leaving room for the carbohydrates you still need.', 'Lentils / Hemp Seeds');
    }

    // Limits
    if (intake.fat > targets.fat * 1.15) {
      add('fat', 'Lean Proteins / Steamed Vegetables', 'Swap fried or oil-heavy sides for lean, steamed options to bring total fat back within range.');
    }
    if (intake.saturatedFat > targets.saturatedFat) {
      add('saturatedFat', 'Olive Oil / Avocado / Walnuts / Salmon', 'Cooking with unsaturated fats instead of butter, cream and cheese lowers LDL cholesterol; guidelines keep saturated fat under 10% of daily calories.', 'Olive Oil / Pumpkin Seeds');
    }
    if (intake.sodium > targets.sodium) {
      add('sodium', 'Herbs & Spices / Lemon or Lime / No-Salt-Added Beans', 'Season with garlic, black pepper, herbs or citrus instead of salt, and choose no-salt-added canned beans, tomatoes and broth to stay under 2,300 mg of sodium a day.');
    }
    if (intake.sugar > targets.sugar) {
      add('sugar', 'Fresh Berries / Plain Yogurt', 'Replace sweetened snacks with whole fruit and unsweetened dairy to cut added sugar while keeping sweetness.');
    }

    // Micronutrients
    if (ratio('fiber') < 0.7) {
      add('fiber', 'Chia Seeds / Black Beans', 'Soluble and insoluble fiber support digestion, cholesterol and steady blood sugar.');
    }
    if (ratio('iron') < 0.7) {
      add('iron', 'Spinach / Lentils', 'Provides plant-based bioavailable iron to close your current deficit without excess saturated fat.');
    }
    if (ratio('vitaminC') < 0.7) {
      add('vitaminC', 'Red Bell Pepper / Kiwi / Strawberries', 'Vitamin C supports immunity and multiplies non-heme iron absorption when eaten in the same meal.');
    }
    if (ratio('vitaminD') < 0.7) {
      add('vitaminD', 'Salmon / Sardines / Fortified Milk', 'Few foods contain vitamin D; oily fish and fortified dairy are the most reliable dietary sources.', 'Fortified Oat Milk / UV-Exposed Mushrooms');
    }
    if (ratio('vitaminB12') < 0.7) {
      add('vitaminB12', 'Eggs / Salmon / Greek Yogurt', 'B12 is found almost only in animal foods and fortified products, and is essential for nerve function and red blood cells.', 'Nutritional Yeast / Fortified Soy Milk');
    }
    if (ratio('calcium') < 0.7) {
      add('calcium', 'Greek Yogurt / Kale / Firm Tofu', 'Calcium-rich foods protect bone density; calcium-set tofu and kale are strong dairy-free options.');
    }
    if (ratio('potassium') < 0.7) {
      add('potassium', 'Banana / Sweet Potato / Avocado', intake.sodium > targets.sodium
        ? 'Your sodium is over its limit; potassium-rich foods help offset sodium’s effect on blood pressure.'
        : 'Potassium balances sodium to support healthy blood pressure and muscle contraction.');
    }
    if (ratio('magnesium') < 0.7) {
      add('magnesium', 'Pumpkin Seeds / Almonds', 'Among the densest magnesium sources, supporting sleep quality, muscle relaxation and energy metabolism.');
    }
    if (ratio('zinc') < 0.7) {
      add('zinc', 'Pumpkin Seeds / Lean Beef / Chickpeas', 'Zinc supports immune function and wound healing; pair plant sources with protein for better absorption.');
    }
    if (ratio('omega3') < 0.7) {
      add('omega3', 'Salmon / Chia Seeds / Walnuts', 'Omega-3 fatty acids support heart and brain health and help moderate inflammation.');
    }
    if (ratio('vitaminA') < 0.7) {
      add('vitaminA', 'Sweet Potato / Carrots', 'Beta-carotene converts to vitamin A for vision and immunity; eat with a little fat for absorption.');
    }

    if (recs.length === 0) {
      return [{
        food: 'Keep doing what you are doing',
        reason: 'Every tracked macro, micronutrient and limit is within range for this day. Maintain variety across the week.',
        trigger: 'All targets met',
        priority: 'info',
      }];
    }
    const order = { high: 0, medium: 1 };
    return recs.sort((a, b) => order[a.priority] - order[b.priority]);
  }
}
